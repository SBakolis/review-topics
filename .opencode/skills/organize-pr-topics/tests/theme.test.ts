import { afterEach, describe, expect, it, vi } from "vitest";
import {
  THEME_STORAGE_KEY,
  getInitialTheme,
  getPreferredTheme,
  readStoredTheme,
  writeStoredTheme,
} from "../app/ui/theme";

const originalWindow = globalThis.window;

function setMockWindow(options: { stored?: string | null; prefersDark?: boolean }) {
  const store = new Map<string, string>();
  if (options.stored !== undefined && options.stored !== null) {
    store.set(THEME_STORAGE_KEY, options.stored);
  }

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: vi.fn((key: string) => store.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => {
          store.set(key, value);
        }),
      },
      matchMedia: vi.fn((query: string) => ({
        matches: query === "(prefers-color-scheme: dark)" ? Boolean(options.prefersDark) : false,
      })),
    },
  });
}

afterEach(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: originalWindow,
  });
  vi.restoreAllMocks();
});

describe("theme preference helpers", () => {
  it("uses a valid stored theme", () => {
    setMockWindow({ stored: "dark", prefersDark: false });

    expect(readStoredTheme()).toBe("dark");
    expect(getInitialTheme()).toBe("dark");
  });

  it("ignores invalid stored theme values", () => {
    setMockWindow({ stored: "sepia", prefersDark: true });

    expect(readStoredTheme()).toBeNull();
    expect(getInitialTheme()).toBe("dark");
  });

  it("falls back to system dark preference", () => {
    setMockWindow({ prefersDark: true });

    expect(getPreferredTheme()).toBe("dark");
    expect(getInitialTheme()).toBe("dark");
  });

  it("falls back to light when system dark preference is unavailable", () => {
    setMockWindow({ prefersDark: false });

    expect(getPreferredTheme()).toBe("light");
    expect(getInitialTheme()).toBe("light");
  });

  it("persists the selected theme", () => {
    setMockWindow({ prefersDark: false });

    writeStoredTheme("dark");

    expect(window.localStorage.setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, "dark");
  });
});

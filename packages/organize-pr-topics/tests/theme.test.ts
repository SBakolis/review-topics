import { afterEach, describe, expect, it, vi } from "vitest";
import {
  THEME_STORAGE_KEY,
  getInitialTheme,
  getPreferredTheme,
  readStoredTheme,
  writeStoredTheme,
} from "../app/ui/theme";

const originalWindow = globalThis.window;

function setMockWindow(options: {
  readThrows?: boolean;
  stored?: string | null;
  prefersDark?: boolean;
  writeThrows?: boolean;
}) {
  const store = new Map<string, string>();
  if (options.stored !== undefined && options.stored !== null) {
    store.set(THEME_STORAGE_KEY, options.stored);
  }

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: vi.fn((key: string) => {
          if (options.readThrows) {
            throw new Error("storage unavailable");
          }
          return store.get(key) ?? null;
        }),
        setItem: vi.fn((key: string, value: string) => {
          if (options.writeThrows) {
            throw new Error("storage unavailable");
          }
          store.set(key, value);
        }),
      },
      ...(options.prefersDark === undefined
        ? {}
        : {
            matchMedia: vi.fn((query: string) => ({
              matches: query === "(prefers-color-scheme: dark)" ? options.prefersDark : false,
            })),
          }),
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
    setMockWindow({});

    expect(getPreferredTheme()).toBe("light");
    expect(getInitialTheme()).toBe("light");
  });

  it("falls back when stored theme cannot be read", () => {
    setMockWindow({ readThrows: true, prefersDark: true });

    expect(readStoredTheme()).toBeNull();
    expect(getInitialTheme()).toBe("dark");
  });

  it("persists the selected theme", () => {
    setMockWindow({ prefersDark: false });

    writeStoredTheme("dark");

    expect(window.localStorage.setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, "dark");
  });

  it("does not throw when stored theme cannot be written", () => {
    setMockWindow({ writeThrows: true });

    expect(() => writeStoredTheme("dark")).not.toThrow();
  });
});

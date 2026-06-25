export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "pr-topic-review-theme";

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark";
}

export function readStoredTheme(): Theme | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isTheme(stored) ? stored : null;
}

export function writeStoredTheme(theme: Theme) {
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export function getPreferredTheme(): Theme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function getInitialTheme(): Theme {
  return readStoredTheme() ?? getPreferredTheme();
}

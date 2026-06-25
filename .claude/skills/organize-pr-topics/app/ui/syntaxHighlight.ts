import {
  createHighlighter,
  type BundledLanguage,
  type BundledTheme,
  type HighlighterGeneric,
} from "shiki";
import type { Theme } from "./theme";

export type HighlightToken = {
  content: string;
  color?: string;
};

const languages = [
  "bash",
  "css",
  "html",
  "javascript",
  "json",
  "jsx",
  "markdown",
  "ts",
  "tsx",
  "yaml",
] as const satisfies BundledLanguage[];

const themes = ["github-light", "github-dark"] as const satisfies BundledTheme[];

type SupportedLanguage = (typeof languages)[number];
type SupportedTheme = (typeof themes)[number];

const extensionLanguages = new Map<string, SupportedLanguage>([
  [".bash", "bash"],
  [".cjs", "javascript"],
  [".css", "css"],
  [".html", "html"],
  [".js", "javascript"],
  [".json", "json"],
  [".jsx", "jsx"],
  [".md", "markdown"],
  [".mjs", "javascript"],
  [".sh", "bash"],
  [".ts", "ts"],
  [".tsx", "tsx"],
  [".yaml", "yaml"],
  [".yml", "yaml"],
]);

let highlighterPromise: Promise<HighlighterGeneric<SupportedLanguage, SupportedTheme>> | null = null;

export function detectLanguage(path: string): SupportedLanguage | null {
  const normalized = path.toLowerCase();
  for (const [extension, language] of extensionLanguages) {
    if (normalized.endsWith(extension)) {
      return language;
    }
  }
  return null;
}

export function shikiThemeForAppTheme(theme: Theme): SupportedTheme {
  return theme === "dark" ? "github-dark" : "github-light";
}

export function highlightPlainText(content: string): HighlightToken[] {
  return [{ content: content || "\u00a0" }];
}

async function getHighlighter() {
  highlighterPromise ??= createHighlighter({ langs: languages, themes });
  return highlighterPromise;
}

export async function highlightLine(
  content: string,
  language: SupportedLanguage | null,
  theme: Theme,
): Promise<HighlightToken[]> {
  if (!language || !content) {
    return highlightPlainText(content);
  }

  try {
    const highlighter = await getHighlighter();
    const lines = highlighter.codeToTokensBase(content, {
      lang: language,
      theme: shikiThemeForAppTheme(theme),
    });
    const tokens = lines[0]?.map((token) => ({
      content: token.content,
      color: token.color,
    }));
    return tokens?.length ? tokens : highlightPlainText(content);
  } catch {
    return highlightPlainText(content);
  }
}

import { describe, expect, it } from "vitest";
import {
  detectLanguage,
  highlightPlainText,
  shikiThemeForAppTheme,
} from "../app/ui/syntaxHighlight";

describe("detectLanguage", () => {
  it.each([
    ["app/ui/App.tsx", "tsx"],
    ["server/index.ts", "ts"],
    ["scripts/start-review.mjs", "javascript"],
    ["components/Button.jsx", "jsx"],
    ["app/ui/styles.css", "css"],
    ["package.json", "json"],
    ["README.md", "markdown"],
    ["index.html", "html"],
    ["scripts/check-gh.sh", "bash"],
    ["workflow.yml", "yaml"],
  ])("maps %s to %s", (path, language) => {
    expect(detectLanguage(path)).toBe(language);
  });

  it("returns null for unknown extensions", () => {
    expect(detectLanguage("assets/logo.svg")).toBeNull();
  });
});

describe("highlight fallbacks", () => {
  it("returns a plain token for plain text", () => {
    expect(highlightPlainText("const value = 1;")).toEqual([
      { content: "const value = 1;" },
    ]);
  });

  it("preserves empty lines as a non-breaking space token", () => {
    expect(highlightPlainText("")).toEqual([{ content: "\u00a0" }]);
  });

  it("maps app themes to GitHub Shiki themes", () => {
    expect(shikiThemeForAppTheme("light")).toBe("github-light");
    expect(shikiThemeForAppTheme("dark")).toBe("github-dark");
  });
});

import { describe, expect, it } from "vitest";
import {
  detectLanguage,
  highlightLine,
  highlightPlainText,
  shikiThemeForAppTheme,
} from "../app/ui/syntaxHighlight";

describe("detectLanguage", () => {
  it.each([
    ["app/ui/App.tsx", "tsx"],
    ["server/index.ts", "ts"],
    ["app/ui/main.js", "javascript"],
    ["config/eslint.cjs", "javascript"],
    ["scripts/start-review.mjs", "javascript"],
    ["components/Button.jsx", "jsx"],
    ["app/ui/styles.css", "css"],
    ["package.json", "json"],
    ["README.md", "markdown"],
    ["index.html", "html"],
    ["scripts/install.bash", "bash"],
    ["scripts/check-gh.sh", "bash"],
    ["workflow.yaml", "yaml"],
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

  it("returns plain tokens when highlighting without a language", async () => {
    await expect(highlightLine("const value = 1;", null, "light")).resolves.toEqual([
      { content: "const value = 1;" },
    ]);
  });

  it("returns plain tokens when Shiki cannot highlight a language", async () => {
    await expect(
      highlightLine("const value = 1;", "unsupported" as never, "light"),
    ).resolves.toEqual([{ content: "const value = 1;" }]);
  });

  it("maps app themes to GitHub Shiki themes", () => {
    expect(shikiThemeForAppTheme("light")).toBe("github-light");
    expect(shikiThemeForAppTheme("dark")).toBe("github-dark");
  });
});

describe("highlightLine", () => {
  it("returns highlighted tokens for supported languages", async () => {
    const tokens = await highlightLine("const value = 1;", "ts", "light");

    expect(tokens.some((token) => token.color)).toBe(true);
  });
});

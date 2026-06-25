import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

test("package test harness runs", () => {
  expect(true).toBe(true);
});

test("claude code package includes required skill files", () => {
  const packageRoot = resolve(process.cwd(), "../../..", ".claude/skills/organize-pr-topics");
  const requiredFiles = [
    "SKILL.md",
    "README.md",
    "package.json",
    "scripts/check-gh.mjs",
    "scripts/prepare-session.mjs",
    "scripts/start-review.mjs",
  ];

  for (const file of requiredFiles) {
    expect(existsSync(resolve(packageRoot, file)), file).toBe(true);
  }
});

test("readme documents claude code install paths", () => {
  const readmePath = resolve(
    process.cwd(),
    "../../..",
    ".claude/skills/organize-pr-topics/README.md",
  );
  const readme = readFileSync(readmePath, "utf8");

  expect(readme).toContain(".claude/skills/organize-pr-topics");
  expect(readme).toContain("~/.claude/skills/organize-pr-topics");
});

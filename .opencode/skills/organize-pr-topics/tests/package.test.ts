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

test("project slash commands invoke review topics workflow", () => {
  const repoRoot = resolve(process.cwd(), "../../..");
  const commandPaths = [
    ".opencode/commands/review-topics.md",
    ".claude/commands/review-topics.md",
  ];

  for (const commandPath of commandPaths) {
    const fullPath = resolve(repoRoot, commandPath);
    expect(existsSync(fullPath), commandPath).toBe(true);

    const command = readFileSync(fullPath, "utf8");
    expect(command).toContain("organize-pr-topics");
    expect(command).toContain("$ARGUMENTS");
    expect(command).toContain("checked-out branch");
    expect(command).toContain("recent open PRs");
    expect(command).toContain("prepare-session.mjs --pr");
  }
});

test("readmes document review-topics slash command", () => {
  const repoRoot = resolve(process.cwd(), "../../..");
  const readmePaths = [
    ".opencode/skills/organize-pr-topics/README.md",
    ".claude/skills/organize-pr-topics/README.md",
  ];

  for (const readmePath of readmePaths) {
    const readme = readFileSync(resolve(repoRoot, readmePath), "utf8");
    expect(readme).toContain("/review-topics");
    expect(readme).toContain("/review-topics <pr-number>");
    expect(readme).toContain("checked-out branch");
    expect(readme).toContain("recent open PRs");
  }
});

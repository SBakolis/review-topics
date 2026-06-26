import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

test("package test harness runs", () => {
  expect(true).toBe(true);
});

test("opencode package manifest is publishable with a global cli", () => {
  const packageRoot = process.cwd();
  const packageJson = JSON.parse(
    readFileSync(resolve(packageRoot, "package.json"), "utf8"),
  );

  expect(packageJson.name).toBe("@sbakolis/organize-pr-topics");
  expect(packageJson.version).toMatch(/^\d+\.\d+\.\d+$/);
  expect(packageJson.private).toBe(false);
  expect(packageJson.bin).toEqual({
    "organize-pr-topics": "./bin/organize-pr-topics.mjs",
  });
  expect(packageJson.files).toEqual([
    "bin",
    "dist",
    "scripts",
    "templates",
    "skill",
    "README.md",
    "LICENSE",
  ]);
  expect(packageJson.scripts["build:ui"]).toBe("vite build");
  expect(packageJson.scripts["build:server"]).toContain("tsup");
  expect(packageJson.scripts.prepack).toBe(
    "npm run typecheck && npm test && npm run build",
  );
});

test("opencode package includes publishable skill instructions", () => {
  const packageRoot = process.cwd();
  const bundledSkills = [
    {
      path: "skill/claude/SKILL.md",
      extraAssertions: [] as string[],
    },
    {
      path: "skill/opencode/SKILL.md",
      extraAssertions: [
        "compatibility: opencode",
        'package: "@sbakolis/organize-pr-topics"',
      ],
    },
  ];

  for (const bundledSkill of bundledSkills) {
    const skillPath = resolve(packageRoot, bundledSkill.path);
    expect(existsSync(skillPath), bundledSkill.path).toBe(true);

    const skill = readFileSync(skillPath, "utf8");
    expect(skill).toContain("name: organize-pr-topics");
    expect(skill).toContain("organize-pr-topics check-gh");
    expect(skill).toContain(
      "organize-pr-topics prepare-session .pr-topic-review-session.json",
    );
    expect(skill).toContain(
      "organize-pr-topics start-review .pr-topic-review-session.json",
    );
    expect(skill).not.toContain("npm run dev");
    expect(skill).not.toContain("scripts/start-review.mjs");
    expect(skill).not.toContain('node "$SKILL_DIR');

    for (const expected of bundledSkill.extraAssertions) {
      expect(skill).toContain(expected);
    }
  }
});

test("legacy start-review script launches the production server directly", () => {
  const packageRoot = process.cwd();
  const script = readFileSync(resolve(packageRoot, "scripts/start-review.mjs"), "utf8");

  expect(script).not.toContain('spawn("npm"');
  expect(script).not.toContain('["run", "dev"]');
  expect(script).not.toContain("npm run dev");
  expect(script).toContain("dist/server/index.mjs");
  expect(script).toContain('NODE_ENV: "production"');
  expect(script).toContain("PR_TOPIC_SESSION_PATH");
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

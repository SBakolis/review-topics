import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { expect, test } from "vitest";

const packageRoot = process.cwd();
const cliPath = resolve(packageRoot, "bin/organize-pr-topics.mjs");

function runCli(args: string[], env: NodeJS.ProcessEnv = {}) {
  return execFileSync(process.execPath, [cliPath, ...args], {
    cwd: tmpdir(),
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

test("cli help documents supported global commands", () => {
  const output = runCli(["--help"]);

  expect(output).toContain("organize-pr-topics install-skill [--agent claude|opencode|both]");
  expect(output).toContain("organize-pr-topics check-gh");
  expect(output).toContain("organize-pr-topics prepare-session [output-path]");
  expect(output).toContain("organize-pr-topics start-review <session-path>");
});

test("install-skill defaults to installing claude and opencode skills", () => {
  const home = mkdtempSync(resolve(tmpdir(), "organize-pr-topics-home-"));
  const output = runCli(["install-skill"], { HOME: home });
  const claudePath = resolve(home, ".claude/skills/organize-pr-topics/SKILL.md");
  const opencodePath = resolve(
    home,
    ".config/opencode/skills/organize-pr-topics/SKILL.md",
  );

  expect(output).toContain(claudePath);
  expect(output).toContain(opencodePath);
  expect(existsSync(claudePath)).toBe(true);
  expect(existsSync(opencodePath)).toBe(true);

  for (const installedPath of [claudePath, opencodePath]) {
    const installedSkill = readFileSync(installedPath, "utf8");
    expect(installedSkill).toContain("organize-pr-topics check-gh");
    expect(installedSkill).toContain(
      "organize-pr-topics prepare-session .pr-topic-review-session.json",
    );
    expect(installedSkill).toContain(
      "organize-pr-topics start-review .pr-topic-review-session.json",
    );
    expect(installedSkill).not.toContain("npm run dev");
    expect(installedSkill).not.toContain("scripts/start-review.mjs");
  }
});

test("install-skill can install only the claude skill", () => {
  const home = mkdtempSync(resolve(tmpdir(), "organize-pr-topics-home-"));
  const output = runCli(["install-skill", "--agent", "claude"], { HOME: home });
  const claudePath = resolve(home, ".claude/skills/organize-pr-topics/SKILL.md");
  const opencodePath = resolve(
    home,
    ".config/opencode/skills/organize-pr-topics/SKILL.md",
  );

  expect(output).toContain(claudePath);
  expect(output).not.toContain(opencodePath);
  expect(existsSync(claudePath)).toBe(true);
  expect(existsSync(opencodePath)).toBe(false);
});

test("install-skill can install only the opencode skill", () => {
  const home = mkdtempSync(resolve(tmpdir(), "organize-pr-topics-home-"));
  const output = runCli(["install-skill", "--agent", "opencode"], { HOME: home });
  const claudePath = resolve(home, ".claude/skills/organize-pr-topics/SKILL.md");
  const opencodePath = resolve(
    home,
    ".config/opencode/skills/organize-pr-topics/SKILL.md",
  );

  expect(output).not.toContain(claudePath);
  expect(output).toContain(opencodePath);
  expect(existsSync(claudePath)).toBe(false);
  expect(existsSync(opencodePath)).toBe(true);
});

test("install-skill rejects invalid agent values", () => {
  const home = mkdtempSync(resolve(tmpdir(), "organize-pr-topics-home-"));
  const result = spawnSync(
    process.execPath,
    [cliPath, "install-skill", "--agent", "vim"],
    {
      cwd: tmpdir(),
      encoding: "utf8",
      env: { ...process.env, HOME: home },
    },
  );

  expect(result.status).toBe(1);
  expect(result.stderr).toContain("Invalid agent: vim");
  expect(result.stderr).toContain("--agent claude|opencode|both");
});

test("start-review requires an existing session path", () => {
  const missingPath = resolve(tmpdir(), "missing-pr-topic-session.json");
  const result = spawnSync(process.execPath, [cliPath, "start-review", missingPath], {
    cwd: tmpdir(),
    encoding: "utf8",
  });

  expect(result.status).toBe(1);
  expect(result.stderr).toContain(`Session file not found: ${missingPath}`);
});

test("start-review starts the built production server from any working directory", () => {
  const sessionPath = resolve(tmpdir(), "pr-topic-session.json");
  writeFileSync(sessionPath, "{}\n");

  const result = spawnSync(process.execPath, [cliPath, "start-review", sessionPath], {
    cwd: tmpdir(),
    encoding: "utf8",
    env: {
      ...process.env,
      ORGANIZE_PR_TOPICS_DRY_RUN_START: "1",
    },
  });

  expect(result.status).toBe(0);
  expect(result.stdout).toContain("node");
  expect(result.stdout).toContain("dist/server/index.mjs");
  expect(result.stdout).toContain(`PR_TOPIC_SESSION_PATH=${sessionPath}`);
  expect(result.stdout).toContain("NODE_ENV=production");
});

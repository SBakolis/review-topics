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

  expect(output).toContain("organize-pr-topics install-skill");
  expect(output).toContain("organize-pr-topics check-gh");
  expect(output).toContain("organize-pr-topics prepare-session [output-path]");
  expect(output).toContain("organize-pr-topics start-review <session-path>");
});

test("install-skill copies the publishable opencode skill into the user config", () => {
  const home = mkdtempSync(resolve(tmpdir(), "organize-pr-topics-home-"));
  const output = runCli(["install-skill"], { HOME: home });
  const installedPath = resolve(
    home,
    ".config/opencode/skills/organize-pr-topics/SKILL.md",
  );

  expect(output).toContain(installedPath);
  expect(existsSync(installedPath)).toBe(true);

  const installedSkill = readFileSync(installedPath, "utf8");
  expect(installedSkill).toContain("organize-pr-topics check-gh");
  expect(installedSkill).not.toContain("npm run dev");
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

import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { expect, test } from "vitest";

// @ts-expect-error The CLI is authored as plain ESM JavaScript.
const { promptForAgents } = (await import("../bin/organize-pr-topics.mjs")) as {
  promptForAgents: (
    detected: { claude: boolean; opencode: boolean },
    streams: { read: (prompt: string) => Promise<string>; write: (text: string) => void },
  ) => Promise<"claude" | "opencode" | "both">;
};

const packageRoot = process.cwd();
const cliPath = resolve(packageRoot, "bin/organize-pr-topics.mjs");

function runCli(args: string[], env: NodeJS.ProcessEnv = {}) {
  return execFileSync(process.execPath, [cliPath, ...args], {
    cwd: tmpdir(),
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

function skillPaths(home: string) {
  return {
    claude: resolve(home, ".claude/skills/organize-pr-topics/SKILL.md"),
    opencode: resolve(home, ".config/opencode/skills/organize-pr-topics/SKILL.md"),
  };
}

function createDetectedAgentDirs(home: string, agents: Array<"claude" | "opencode">) {
  if (agents.includes("claude")) {
    mkdirSync(resolve(home, ".claude"), { recursive: true });
  }
  if (agents.includes("opencode")) {
    mkdirSync(resolve(home, ".config/opencode"), { recursive: true });
  }
}

function runInstallNoTty(home: string) {
  return spawnSync(process.execPath, [cliPath, "install-skill"], {
    cwd: tmpdir(),
    encoding: "utf8",
    env: { ...process.env, HOME: home },
  });
}

async function promptWithAnswer(
  detected: { claude: boolean; opencode: boolean },
  answer: string,
) {
  const writes: string[] = [];
  const result = await promptForAgents(detected, {
    read: async (prompt: string) => {
      writes.push(prompt);
      return answer;
    },
    write: (text: string) => writes.push(text),
  });

  return { result, writes: writes.join("") };
}

test("cli help documents supported global commands", () => {
  const output = runCli(["--help"]);

  expect(output).toContain("organize-pr-topics install-skill [--agent claude|opencode|both]");
  expect(output).toContain("organize-pr-topics check-gh");
  expect(output).toContain("organize-pr-topics prepare-session [output-path]");
  expect(output).toContain("organize-pr-topics start-review <session-path>");
});

test("cli runs when invoked through a symlinked global bin", () => {
  const binDir = mkdtempSync(resolve(tmpdir(), "organize-pr-topics-bin-"));
  const symlinkPath = resolve(binDir, "organize-pr-topics");
  symlinkSync(cliPath, symlinkPath);

  const output = execFileSync(symlinkPath, ["--help"], {
    cwd: tmpdir(),
    encoding: "utf8",
  });

  expect(output).toContain("organize-pr-topics install-skill [--agent claude|opencode|both]");
});

test("promptForAgents defaults to detected agents and accepts menu selections", async () => {
  await expect(promptWithAnswer({ claude: true, opencode: true }, "")).resolves.toMatchObject({
    result: "both",
  });
  await expect(promptWithAnswer({ claude: true, opencode: true }, "1")).resolves.toMatchObject({
    result: "claude",
  });
  await expect(promptWithAnswer({ claude: true, opencode: true }, "2")).resolves.toMatchObject({
    result: "opencode",
  });
  await expect(promptWithAnswer({ claude: true, opencode: true }, "3")).resolves.toMatchObject({
    result: "both",
  });
  await expect(promptWithAnswer({ claude: true, opencode: true }, "claude")).resolves.toMatchObject({
    result: "claude",
  });
  await expect(promptWithAnswer({ claude: true, opencode: true }, "opencode")).resolves.toMatchObject({
    result: "opencode",
  });
  await expect(promptWithAnswer({ claude: true, opencode: true }, "both")).resolves.toMatchObject({
    result: "both",
  });
  await expect(promptForAgents({ claude: true, opencode: true }, {
    read: async () => "vim",
    write: () => undefined,
  })).rejects.toThrow("Invalid selection");
});

test("promptForAgents defaults to the only detected agent", async () => {
  await expect(promptWithAnswer({ claude: true, opencode: false }, "")).resolves.toMatchObject({
    result: "claude",
  });
  await expect(promptWithAnswer({ claude: false, opencode: true }, "")).resolves.toMatchObject({
    result: "opencode",
  });
  await expect(promptForAgents({ claude: false, opencode: false }, {
    read: async () => "",
    write: () => undefined,
  })).rejects.toThrow("No supported agents detected");
});

test("install-skill without --agent fails non-interactively when agents are detected", () => {
  const home = mkdtempSync(resolve(tmpdir(), "organize-pr-topics-home-"));
  createDetectedAgentDirs(home, ["claude", "opencode"]);
  const result = runInstallNoTty(home);
  const paths = skillPaths(home);

  expect(result.status).toBe(1);
  expect(result.stderr).toContain("--agent claude|opencode|both");
  expect(result.stderr).toContain("Detected Claude Code: yes");
  expect(result.stderr).toContain("Detected opencode: yes");
  expect(existsSync(paths.claude)).toBe(false);
  expect(existsSync(paths.opencode)).toBe(false);
});

test("install-skill without --agent fails when no supported agents are detected", () => {
  const home = mkdtempSync(resolve(tmpdir(), "organize-pr-topics-home-"));
  const result = runInstallNoTty(home);
  const paths = skillPaths(home);

  expect(result.status).toBe(1);
  expect(result.stderr).toContain("No supported agents detected");
  expect(result.stderr).toContain("--agent claude|opencode|both");
  expect(existsSync(paths.claude)).toBe(false);
  expect(existsSync(paths.opencode)).toBe(false);
});

test("install-skill can explicitly install both claude and opencode skills", () => {
  const home = mkdtempSync(resolve(tmpdir(), "organize-pr-topics-home-"));
  createDetectedAgentDirs(home, ["claude"]);
  const output = runCli(["install-skill", "--agent", "both"], { HOME: home });
  const claudePath = resolve(home, ".claude/skills/organize-pr-topics/SKILL.md");
  const opencodePath = resolve(
    home,
    ".config/opencode/skills/organize-pr-topics/SKILL.md",
  );

  expect(output).toContain(claudePath);
  expect(output).toContain(opencodePath);
  expect(existsSync(claudePath)).toBe(true);
  expect(existsSync(opencodePath)).toBe(true);
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
  const claudePath = resolve(home, ".claude/skills/organize-pr-topics/SKILL.md");
  const opencodePath = resolve(
    home,
    ".config/opencode/skills/organize-pr-topics/SKILL.md",
  );
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
  expect(existsSync(claudePath)).toBe(false);
  expect(existsSync(opencodePath)).toBe(false);
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

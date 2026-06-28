#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const binDir = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(binDir, "..");

const HELP = `organize-pr-topics

Usage:
  organize-pr-topics --help
  organize-pr-topics install-skill [--agent claude|opencode|both]
  organize-pr-topics check-gh
  organize-pr-topics prepare-session [output-path]
  organize-pr-topics start-review <session-path>
`;

function printHelp() {
  process.stdout.write(HELP);
}

function runNode(args, options = {}) {
  const child = spawn(process.execPath, args, {
    cwd: options.cwd ?? process.cwd(),
    stdio: options.stdio ?? "inherit",
    env: options.env ?? process.env,
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

const INSTALL_USAGE = "Usage: organize-pr-topics install-skill [--agent claude|opencode|both]";

const INSTALL_TARGETS = {
  claude: {
    source: "skill/claude/SKILL.md",
    target: ".claude/skills/organize-pr-topics/SKILL.md",
    restartMessage: "Restart Claude Code for the installed skill to be loaded.",
  },
  opencode: {
    source: "skill/opencode/SKILL.md",
    target: ".config/opencode/skills/organize-pr-topics/SKILL.md",
    restartMessage: "Restart opencode for the installed skill to be loaded.",
  },
};

function parseInstallAgent(args) {
  if (args.length === 0) {
    return null;
  }

  if (args.length !== 2 || args[0] !== "--agent") {
    console.error(INSTALL_USAGE);
    process.exit(1);
  }

  const agent = args[1];
  if (!["claude", "opencode", "both"].includes(agent)) {
    console.error(`Invalid agent: ${agent}`);
    console.error(INSTALL_USAGE);
    process.exit(1);
  }

  return agent;
}

function detectAgents(home = homedir()) {
  return {
    claude: existsSync(resolve(home, ".claude")),
    opencode: existsSync(resolve(home, ".config/opencode")),
  };
}

function printDetectedAgents(detected) {
  console.error(`Detected Claude Code: ${detected.claude ? "yes" : "no"}`);
  console.error(`Detected opencode: ${detected.opencode ? "yes" : "no"}`);
}

function createPromptStreams() {
  return {
    read: async (prompt) => {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      try {
        return await rl.question(prompt);
      } finally {
        rl.close();
      }
    },
    write: (text) => process.stdout.write(text),
  };
}

async function promptForAgents(detected, streams) {
  if (detected.claude && detected.opencode) {
    streams.write("Detected Claude Code and opencode.\n");
    const answer = (await streams.read(
      "Install organize-pr-topics skill into [1] Claude Code, [2] opencode, [3] both? [3] ",
    )).trim().toLowerCase();

    if (answer === "" || answer === "3" || answer === "both") {
      return "both";
    }
    if (answer === "1" || answer === "claude") {
      return "claude";
    }
    if (answer === "2" || answer === "opencode") {
      return "opencode";
    }

    throw new Error("Invalid selection. Choose 1, 2, 3, claude, opencode, or both.");
  }

  if (detected.claude) {
    streams.write("Detected Claude Code only.\n");
    const answer = (await streams.read("Install into Claude Code? [Y/n] ")).trim().toLowerCase();
    if (answer === "" || answer === "y" || answer === "yes") {
      return "claude";
    }
    if (answer === "n" || answer === "no") {
      throw new Error("Installation cancelled.");
    }
    throw new Error("Invalid selection. Choose y or n.");
  }

  if (detected.opencode) {
    streams.write("Detected opencode only.\n");
    const answer = (await streams.read("Install into opencode? [Y/n] ")).trim().toLowerCase();
    if (answer === "" || answer === "y" || answer === "yes") {
      return "opencode";
    }
    if (answer === "n" || answer === "no") {
      throw new Error("Installation cancelled.");
    }
    throw new Error("Invalid selection. Choose y or n.");
  }

  throw new Error("No supported agents detected.");
}

async function installTarget(targetConfig) {
  const source = resolve(packageDir, targetConfig.source);
  const target = resolve(homedir(), targetConfig.target);

  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
  console.log(`Installed organize-pr-topics skill to ${target}`);
  console.log(targetConfig.restartMessage);
}

async function installSkill(args) {
  let agent = parseInstallAgent(args);

  if (!agent) {
    const detected = detectAgents();

    if (!detected.claude && !detected.opencode) {
      console.error("No supported agents detected.");
      printDetectedAgents(detected);
      console.error(INSTALL_USAGE);
      console.error("Install Claude Code or opencode first, or pass --agent claude|opencode|both to install explicitly.");
      process.exit(1);
    }

    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      printDetectedAgents(detected);
      console.error(INSTALL_USAGE);
      console.error("Re-run in an interactive terminal or pass --agent claude|opencode|both.");
      process.exit(1);
    }

    agent = await promptForAgents(detected, createPromptStreams());
  }

  const targets = agent === "both" ? ["claude", "opencode"] : [agent];

  for (const target of targets) {
    await installTarget(INSTALL_TARGETS[target]);
  }
}

function startReview(sessionArg) {
  if (!sessionArg) {
    console.error("Missing session path. Usage: organize-pr-topics start-review <session-path>");
    process.exit(1);
  }

  const sessionPath = resolve(sessionArg);
  if (!existsSync(sessionPath)) {
    console.error(`Session file not found: ${sessionPath}`);
    process.exit(1);
  }

  const serverPath = resolve(packageDir, "dist/server/index.mjs");
  const env = {
    ...process.env,
    NODE_ENV: "production",
    PR_TOPIC_SESSION_PATH: sessionPath,
  };

  if (process.env.ORGANIZE_PR_TOPICS_DRY_RUN_START === "1") {
    console.log(`${process.execPath} ${serverPath}`);
    console.log(`NODE_ENV=${env.NODE_ENV}`);
    console.log(`PR_TOPIC_SESSION_PATH=${env.PR_TOPIC_SESSION_PATH}`);
    return;
  }

  if (!existsSync(serverPath)) {
    console.error(`Built server not found: ${serverPath}`);
    console.error("Run npm run build before starting the review server from source.");
    process.exit(1);
  }

  runNode([serverPath], { cwd: packageDir, env });
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "install-skill") {
    await installSkill(args);
    return;
  }

  if (command === "check-gh") {
    runNode([resolve(packageDir, "scripts/check-gh.mjs")], { cwd: process.cwd() });
    return;
  }

  if (command === "prepare-session") {
    runNode([resolve(packageDir, "scripts/prepare-session.mjs"), ...args], {
      cwd: process.cwd(),
    });
    return;
  }

  if (command === "start-review") {
    startReview(args[0]);
    return;
  }

  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exit(1);
}

function isCliEntryPoint() {
  if (!process.argv[1]) {
    return false;
  }

  return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isCliEntryPoint()) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export { promptForAgents };

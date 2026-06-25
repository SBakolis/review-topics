#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const binDir = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(binDir, "..");

const HELP = `organize-pr-topics

Usage:
  organize-pr-topics --help
  organize-pr-topics install-skill
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

async function installSkill() {
  const source = resolve(packageDir, "skill/SKILL.md");
  const target = resolve(
    homedir(),
    ".config/opencode/skills/organize-pr-topics/SKILL.md",
  );

  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
  console.log(`Installed organize-pr-topics skill to ${target}`);
  console.log("Restart opencode for the installed skill to be loaded.");
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
    await installSkill();
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

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

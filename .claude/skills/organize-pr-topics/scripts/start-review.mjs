import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const skillDir = dirname(scriptDir);
const sessionPath = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(skillDir, "session.json");

if (!existsSync(sessionPath)) {
  console.error(`Session file not found: ${sessionPath}`);
  process.exit(1);
}

const child = spawn("npm", ["run", "dev"], {
  cwd: skillDir,
  stdio: "inherit",
  env: { ...process.env, PR_TOPIC_SESSION_PATH: sessionPath },
});

child.on("exit", (code) => process.exit(code ?? 0));

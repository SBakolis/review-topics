import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const skillDir = dirname(scriptDir);
const serverPath = resolve(skillDir, "dist/server/index.mjs");
const sessionPath = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(".pr-topic-review-session.json");

if (!existsSync(sessionPath)) {
  console.error(`Session file not found: ${sessionPath}`);
  process.exit(1);
}

if (!existsSync(serverPath)) {
  console.error(`Built server not found: ${serverPath}`);
  console.error("Run npm run build before starting the review server from source.");
  process.exit(1);
}

const child = spawn(process.execPath, [serverPath], {
  cwd: skillDir,
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
    PR_TOPIC_SESSION_PATH: sessionPath,
  },
});

child.on("exit", (code) => process.exit(code ?? 0));

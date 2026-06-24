import { execFileSync } from "node:child_process";

function run(command, args) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

try {
  run("gh", ["--version"]);
} catch {
  console.error("GitHub CLI is required. On macOS, install it with: brew install gh");
  console.error("Other platforms: https://cli.github.com/");
  process.exit(1);
}

try {
  run("gh", ["auth", "status"]);
} catch {
  console.error("GitHub CLI is not authenticated. Run: gh auth login");
  process.exit(1);
}

try {
  run("gh", ["pr", "view", "--json", "number,title,url"]);
} catch {
  console.error("No current PR found. Checkout a PR branch or run: gh pr checkout <number>");
  process.exit(1);
}

console.log("GitHub CLI is ready for PR topic review.");

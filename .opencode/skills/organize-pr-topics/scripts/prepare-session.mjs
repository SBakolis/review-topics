import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { register } from "node:module";
import { resolve } from "node:path";

register("tsx/esm", import.meta.url);

const { buildSessionFromGhPr } = await import("../app/server/gh.ts");

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8" }).trim();
}

const pr = JSON.parse(
  gh([
    "pr",
    "view",
    "--json",
    "number,title,url,baseRefName,headRefName,headRefOid,files,headRepositoryOwner,headRepository",
  ]),
);
const diff = gh(["pr", "diff", "--patch"]);
const session = buildSessionFromGhPr(pr, diff);
const outputPath = resolve(process.argv[2] ?? ".opencode/skills/organize-pr-topics/session.json");

writeFileSync(outputPath, JSON.stringify(session, null, 2));
console.log(outputPath);

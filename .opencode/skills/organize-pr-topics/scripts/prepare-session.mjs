import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { register } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

register("tsx/esm", import.meta.url);

const { buildSessionFromGhPr } = await import("../app/server/gh.ts");

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8" }).trim();
}

function assertNonEmptyString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Prepared session is missing required field: ${field}`);
  }
}

function validateSession(session) {
  assertNonEmptyString(session?.pr?.owner, "pr.owner");
  assertNonEmptyString(session?.pr?.repo, "pr.repo");
  assertNonEmptyString(session?.pr?.title, "pr.title");
  assertNonEmptyString(session?.pr?.url, "pr.url");
  assertNonEmptyString(session?.pr?.baseRefName, "pr.baseRefName");
  assertNonEmptyString(session?.pr?.headRefName, "pr.headRefName");
  assertNonEmptyString(session?.pr?.headSha, "pr.headSha");

  if (!Number.isInteger(session?.pr?.number) || session.pr.number <= 0) {
    throw new Error("Prepared session is missing required field: pr.number");
  }

  if (!Array.isArray(session.files)) {
    throw new Error("Prepared session is missing required field: files");
  }

  for (const [index, file] of session.files.entries()) {
    assertNonEmptyString(file?.path, `files[${index}].path`);
  }

  if (!Array.isArray(session.topics) || session.topics.length === 0) {
    throw new Error("Prepared session is missing required field: topics");
  }

  for (const [topicIndex, topic] of session.topics.entries()) {
    if (!Array.isArray(topic?.files) || topic.files.length === 0) {
      throw new Error(`Prepared session topic has no files: topics[${topicIndex}].files`);
    }

    for (const [fileIndex, filePath] of topic.files.entries()) {
      assertNonEmptyString(filePath, `topics[${topicIndex}].files[${fileIndex}]`);
    }
  }
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
validateSession(session);

const scriptDir = dirname(fileURLToPath(import.meta.url));
const skillDir = dirname(scriptDir);
const outputPath = process.argv[2] ? resolve(process.argv[2]) : resolve(skillDir, "session.json");

writeFileSync(outputPath, JSON.stringify(session, null, 2));
console.log(outputPath);

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";

const PrInfoSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  number: z.number().int().positive(),
  title: z.string().min(1),
  url: z.string().url(),
  baseRefName: z.string().min(1),
  headRefName: z.string().min(1),
  baseSha: z.string().min(1),
  headSha: z.string().min(1),
  nodeId: z.string().min(1),
});

const PrFileSchema = z.object({
  path: z.string().min(1),
  previousPath: z.string().min(1).optional(),
  status: z.string().min(1),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
});

const ReviewTopicSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  rationale: z.string().min(1),
  files: z.array(z.string().min(1)).min(1),
});

const ReviewCommentSchema = z.object({
  id: z.string().min(1),
  topicId: z.string().min(1),
  body: z.string().min(1),
  path: z.string().min(1).optional(),
  line: z.number().int().positive().optional(),
  side: z.enum(["LEFT", "RIGHT"]).optional(),
  kind: z.enum(["inline", "topic"]),
  postingStatus: z.enum(["draft", "posting", "posted", "failed"]),
  error: z.string().optional(),
  githubUrl: z.string().url().optional(),
});

const ReviewSessionSchema = z.object({
  pr: PrInfoSchema,
  files: z.array(PrFileSchema),
  diff: z.string(),
  topics: z.array(ReviewTopicSchema).min(1),
  comments: z.array(ReviewCommentSchema),
  viewedFiles: z.array(z.string().min(1)).default([]),
  collapsedFiles: z.array(z.string().min(1)).default([]),
});

const PR_JSON_FIELDS =
  "id,number,title,url,baseRefName,headRefName,baseRefOid,headRefOid,files,headRepositoryOwner,headRepository";

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8" }).trim();
}

export function parsePrepareSessionArgs(argv = process.argv) {
  const parsed = {};

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--output") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("Missing value for --output");
      }
      parsed.outputPath = value;
      index += 1;
      continue;
    }

    if (arg === "--pr") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("Missing value for --pr");
      }
      parsed.prSelector = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    if (parsed.outputPath) {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }

    parsed.outputPath = arg;
  }

  return parsed;
}

export function buildPrViewArgs(prSelector) {
  return prSelector
    ? ["pr", "view", prSelector, "--json", PR_JSON_FIELDS]
    : ["pr", "view", "--json", PR_JSON_FIELDS];
}

export function buildPrDiffArgs(prSelector) {
  return prSelector ? ["pr", "diff", prSelector, "--patch"] : ["pr", "diff", "--patch"];
}

export function validatePreparedSession(session) {
  const result = ReviewSessionSchema.safeParse(session);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "session"}: ${issue.message}`)
      .join("; ");

    throw new Error(`Invalid prepared session: ${details}`);
  }

  return result.data;
}

export async function main(argv = process.argv) {
  const { buildSessionFromGhPr } = await import("../app/server/gh.ts");
  const { outputPath, prSelector } = parsePrepareSessionArgs(argv);
  const pr = JSON.parse(gh(buildPrViewArgs(prSelector)));
  const diff = gh(buildPrDiffArgs(prSelector));
  const session = validatePreparedSession(buildSessionFromGhPr(pr, diff));

  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const skillDir = dirname(scriptDir);
  const resolvedOutputPath = outputPath ? resolve(outputPath) : resolve(skillDir, "session.json");

  writeFileSync(resolvedOutputPath, JSON.stringify(session, null, 2));
  console.log(resolvedOutputPath);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

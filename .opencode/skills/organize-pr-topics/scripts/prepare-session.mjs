import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { register } from "node:module";
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
});

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8" }).trim();
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
  register("tsx/esm", import.meta.url);
  const { buildSessionFromGhPr } = await import("../app/server/gh.ts");
  const pr = JSON.parse(
    gh([
      "pr",
      "view",
      "--json",
      "number,title,url,baseRefName,headRefName,baseRefOid,headRefOid,files,headRepositoryOwner,headRepository",
    ]),
  );
  const diff = gh(["pr", "diff", "--patch"]);
  const session = validatePreparedSession(buildSessionFromGhPr(pr, diff));

  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const skillDir = dirname(scriptDir);
  const outputPath = argv[2] ? resolve(argv[2]) : resolve(skillDir, "session.json");

  writeFileSync(outputPath, JSON.stringify(session, null, 2));
  console.log(outputPath);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

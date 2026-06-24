import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { PrFile, ReviewSession } from "../shared/schema";

const execFileAsync = promisify(execFile);

export type GhPrFile = {
  path: string;
  previousPath?: string;
  status: string;
  additions: number;
  deletions: number;
};

export type GhPr = {
  number: number;
  title: string;
  url: string;
  baseRefName: string;
  headRefName: string;
  headRefOid: string;
  files: GhPrFile[];
  headRepositoryOwner?: { login?: string };
  headRepository?: { name?: string };
};

export async function runGh(args: string[]) {
  const { stdout } = await execFileAsync("gh", args, { encoding: "utf8" });
  return stdout.trim();
}

export async function getCurrentPr() {
  const output = await runGh([
    "pr",
    "view",
    "--json",
    "number,title,url,baseRefName,headRefName,headRefOid,files,headRepositoryOwner,headRepository",
  ]);
  return JSON.parse(output) as GhPr;
}

export async function getCurrentPrDiff() {
  return runGh(["pr", "diff", "--patch"]);
}

export function buildSessionFromGhPr(pr: GhPr, diff: string): ReviewSession {
  const files = pr.files.map((file): PrFile => {
    const normalized: PrFile = {
      path: file.path,
      status: file.status.toLowerCase(),
      additions: file.additions,
      deletions: file.deletions,
    };

    if (file.previousPath) {
      normalized.previousPath = file.previousPath;
    }

    return normalized;
  });

  return {
    pr: {
      owner: pr.headRepositoryOwner?.login ?? "",
      repo: pr.headRepository?.name ?? "",
      number: pr.number,
      title: pr.title,
      url: pr.url,
      baseRefName: pr.baseRefName,
      headRefName: pr.headRefName,
      headSha: pr.headRefOid,
    },
    files,
    diff,
    topics: [
      {
        id: "review-topic-1",
        title: "PR changes",
        summary:
          "Initial generated topic containing all changed files. The agent should replace this with purpose-based topics.",
        rationale: "Fallback topic created by the session script.",
        files: files.map((file) => file.path),
      },
    ],
    comments: [],
  };
}

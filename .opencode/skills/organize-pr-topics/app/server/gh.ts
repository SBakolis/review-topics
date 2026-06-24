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
  baseRefOid?: string;
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
    "number,title,url,baseRefName,headRefName,baseRefOid,headRefOid,files,headRepositoryOwner,headRepository",
  ]);
  return JSON.parse(output) as GhPr;
}

export async function getCurrentPrDiff() {
  return runGh(["pr", "diff", "--patch"]);
}

export function buildSessionFromGhPr(pr: GhPr, diff: string): ReviewSession {
  const owner = pr.headRepositoryOwner?.login;
  const repo = pr.headRepository?.name;

  if (!owner || !repo) {
    throw new Error("GitHub PR JSON is missing head repository owner or name.");
  }

  if (!pr.baseRefOid) {
    throw new Error("GitHub PR JSON is missing baseRefOid.");
  }

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
      owner,
      repo,
      number: pr.number,
      title: pr.title,
      url: pr.url,
      baseRefName: pr.baseRefName,
      headRefName: pr.headRefName,
      baseSha: pr.baseRefOid,
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

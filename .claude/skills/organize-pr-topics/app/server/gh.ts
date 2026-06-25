import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { PrFile, ReviewSession } from "../shared/schema";

const execFileAsync = promisify(execFile);

export type GhPrFile = {
  path: string;
  previousPath?: string;
  changeType?: string;
  status?: string;
  additions: number;
  deletions: number;
};

export type GhPr = {
  id: string;
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
    "id,number,title,url,baseRefName,headRefName,baseRefOid,headRefOid,files,headRepositoryOwner,headRepository",
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

  if (!pr.id) {
    throw new Error("GitHub PR JSON is missing id.");
  }

  if (!pr.baseRefOid) {
    throw new Error("GitHub PR JSON is missing baseRefOid.");
  }

  const files = pr.files.map((file): PrFile => {
    const rawStatus = file.status ?? file.changeType ?? "modified";
    const normalized: PrFile = {
      path: file.path,
      status: rawStatus.toLowerCase(),
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
      nodeId: pr.id,
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
    viewedFiles: [],
    collapsedFiles: [],
  };
}

export type GhGraphQLRunner = (args: string[]) => Promise<string>;

export async function fetchViewerViewedFiles(
  prNodeId: string,
  runner: GhGraphQLRunner = runGh,
): Promise<string[]> {
  const query =
    "query($id: ID!) { node(id: $id) { ... on PullRequest { files(first: 100) { nodes { path viewerViewedState } } } } }";
  const stdout = await runner(["api", "graphql", "-f", `query=${query}`, "-F", `id=${prNodeId}`]);
  const payload = JSON.parse(stdout) as {
    data?: { node?: { files?: { nodes?: Array<{ path: string; viewerViewedState: string }> } } };
  };

  const nodes = payload.data?.node?.files?.nodes ?? [];
  return nodes.filter((node) => node.viewerViewedState === "VIEWED").map((node) => node.path);
}

export async function markFileViewed(
  prNodeId: string,
  path: string,
  runner: GhGraphQLRunner = runGh,
): Promise<void> {
  const query =
    "mutation($input: MarkFileAsViewedInput!) { markFileAsViewed(input: $input) { clientMutationId } }";
  const stdout = await runner([
    "api",
    "graphql",
    "-f",
    `query=${query}`,
    "-F",
    `input[pullRequestId]=${prNodeId}`,
    "-F",
    `input[path]=${path}`,
  ]);
  const payload = JSON.parse(stdout) as { data?: unknown; errors?: Array<{ message: string }> };
  if (payload.errors) {
    throw new Error(payload.errors.map((e) => e.message).join("; "));
  }
}

export async function unmarkFileViewed(
  prNodeId: string,
  path: string,
  runner: GhGraphQLRunner = runGh,
): Promise<void> {
  const query =
    "mutation($input: UnmarkFileAsViewedInput!) { unmarkFileAsViewed(input: $input) { clientMutationId } }";
  const stdout = await runner([
    "api",
    "graphql",
    "-f",
    `query=${query}`,
    "-F",
    `input[pullRequestId]=${prNodeId}`,
    "-F",
    `input[path]=${path}`,
  ]);
  const payload = JSON.parse(stdout) as { data?: unknown; errors?: Array<{ message: string }> };
  if (payload.errors) {
    throw new Error(payload.errors.map((e) => e.message).join("; "));
  }
}

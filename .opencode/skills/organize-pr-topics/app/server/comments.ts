import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type InlineCommentInput = {
  body: string;
  commitId: string;
  path: string;
  line: number;
  side: "LEFT" | "RIGHT";
};

export type GhRunner = (args: string[]) => Promise<string>;

export function buildInlineCommentPayload(input: InlineCommentInput) {
  return {
    body: input.body,
    commit_id: input.commitId,
    path: input.path,
    line: input.line,
    side: input.side,
  };
}

export function buildTopicCommentBody(topicTitle: string, body: string) {
  return `**${topicTitle}**\n\n${body}`;
}

const defaultRunner: GhRunner = async (args) => {
  const { stdout } = await execFileAsync("gh", args, { encoding: "utf8" });
  return stdout.trim();
};

export async function postPrLevelComment(
  owner: string,
  repo: string,
  number: number,
  body: string,
  runner: GhRunner = defaultRunner,
) {
  const stdout = await runner([
    "api",
    `repos/${owner}/${repo}/issues/${number}/comments`,
    "--method",
    "POST",
    "--field",
    `body=${body}`,
  ]);
  return JSON.parse(stdout);
}

export async function postInlineComment(
  owner: string,
  repo: string,
  number: number,
  input: InlineCommentInput,
  runner: GhRunner = defaultRunner,
) {
  const stdout = await runner([
    "api",
    `repos/${owner}/${repo}/pulls/${number}/comments`,
    "--method",
    "POST",
    "--field",
    `body=${input.body}`,
    "--field",
    `commit_id=${input.commitId}`,
    "--field",
    `path=${input.path}`,
    "--field",
    `line=${input.line}`,
    "--field",
    `side=${input.side}`,
  ]);
  return JSON.parse(stdout);
}

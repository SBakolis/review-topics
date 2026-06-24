export type InlineCommentInput = {
  body: string;
  commitId: string;
  path: string;
  line: number;
  side: "LEFT" | "RIGHT";
};

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

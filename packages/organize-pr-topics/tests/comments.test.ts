import { describe, expect, it } from "vitest";
import { buildInlineCommentPayload, buildTopicCommentBody } from "../app/server/comments";

describe("comment payloads", () => {
  it("builds an inline PR review comment payload", () => {
    expect(
      buildInlineCommentPayload({
        body: "Please simplify this branch.",
        commitId: "abc123",
        path: "src/app.ts",
        line: 42,
        side: "RIGHT",
      }),
    ).toEqual({
      body: "Please simplify this branch.",
      commit_id: "abc123",
      path: "src/app.ts",
      line: 42,
      side: "RIGHT",
    });
  });

  it("prefixes topic comments with the topic title", () => {
    expect(buildTopicCommentBody("Review flow", "This needs an integration test.")).toBe(
      "**Review flow**\n\nThis needs an integration test.",
    );
  });
});

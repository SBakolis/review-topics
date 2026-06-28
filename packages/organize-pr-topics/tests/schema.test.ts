import { describe, expect, it } from "vitest";
import { ReviewSessionSchema } from "../app/shared/schema";

describe("ReviewSessionSchema", () => {
  it("accepts a valid current-PR session", () => {
    const session = ReviewSessionSchema.parse({
      pr: {
        owner: "octo",
        repo: "example",
        number: 12,
        title: "Improve review flow",
        url: "https://github.com/octo/example/pull/12",
        baseRefName: "main",
        headRefName: "feature",
        baseSha: "base456",
        headSha: "abc123",
      },
      files: [
        { path: "src/app.ts", status: "modified", additions: 3, deletions: 1 },
      ],
      diff: "diff --git a/src/app.ts b/src/app.ts",
      topics: [
        {
          id: "topic-review-flow",
          title: "Review flow",
          summary: "Updates the review flow.",
          rationale: "These files control review behavior.",
          files: ["src/app.ts"],
        },
      ],
      comments: [],
    });

    expect(session.pr.number).toBe(12);
  });

  it("rejects a topic that references no files", () => {
    expect(() =>
      ReviewSessionSchema.parse({
        pr: {
          owner: "octo",
          repo: "example",
          number: 12,
          title: "Improve review flow",
          url: "https://github.com/octo/example/pull/12",
          baseRefName: "main",
          headRefName: "feature",
          baseSha: "base456",
          headSha: "abc123",
        },
        files: [],
        diff: "",
        topics: [
          {
            id: "empty",
            title: "Empty",
            summary: "No files.",
            rationale: "Invalid.",
            files: [],
          },
        ],
        comments: [],
      }),
    ).toThrow();
  });
});

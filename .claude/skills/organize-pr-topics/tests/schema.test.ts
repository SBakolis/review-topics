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
        nodeId: "PR_node1",
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
          nodeId: "PR_node1",
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

  it("defaults viewedFiles and collapsedFiles to empty arrays when missing", () => {
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
        nodeId: "PR_node1",
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

    expect(session.viewedFiles).toEqual([]);
    expect(session.collapsedFiles).toEqual([]);
  });

  it("accepts populated viewedFiles and collapsedFiles", () => {
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
        nodeId: "PR_node1",
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
      viewedFiles: ["src/app.ts"],
      collapsedFiles: ["src/app.ts"],
    });

    expect(session.viewedFiles).toEqual(["src/app.ts"]);
    expect(session.collapsedFiles).toEqual(["src/app.ts"]);
  });

  it("rejects non-string entries in viewedFiles", () => {
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
          nodeId: "PR_node1",
        },
        files: [{ path: "src/app.ts", status: "modified", additions: 3, deletions: 1 }],
        diff: "",
        topics: [
          {
            id: "t",
            title: "T",
            summary: "S",
            rationale: "R",
            files: ["src/app.ts"],
          },
        ],
        comments: [],
        viewedFiles: [123],
      }),
    ).toThrow();
  });

  it("requires nodeId on pr", () => {
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
        files: [{ path: "src/app.ts", status: "modified", additions: 3, deletions: 1 }],
        diff: "",
        topics: [
          {
            id: "t",
            title: "T",
            summary: "S",
            rationale: "R",
            files: ["src/app.ts"],
          },
        ],
        comments: [],
      }),
    ).toThrow();
  });
});

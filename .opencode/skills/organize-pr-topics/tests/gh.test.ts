import { describe, expect, it } from "vitest";
import { buildSessionFromGhPr } from "../app/server/gh";
import { ReviewSessionSchema } from "../app/shared/schema";

describe("buildSessionFromGhPr", () => {
  it("converts GitHub PR JSON into a review session with a fallback topic", () => {
    const session = buildSessionFromGhPr(
      {
        number: 42,
        title: "Add topic review flow",
        url: "https://github.com/octo/example/pull/42",
        baseRefName: "main",
        headRefName: "topic-review",
        headRefOid: "abc123",
        headRepositoryOwner: { login: "octo" },
        headRepository: { name: "example" },
        files: [
          { path: "src/app.ts", status: "MODIFIED", additions: 12, deletions: 3 },
          {
            path: "src/new.ts",
            previousPath: "src/old.ts",
            status: "RENAMED",
            additions: 5,
            deletions: 1,
          },
        ],
      },
      "diff --git a/src/app.ts b/src/app.ts",
    );

    expect(ReviewSessionSchema.parse(session)).toEqual(session);
    expect(session).toMatchObject({
      pr: {
        owner: "octo",
        repo: "example",
        number: 42,
        title: "Add topic review flow",
        url: "https://github.com/octo/example/pull/42",
        baseRefName: "main",
        headRefName: "topic-review",
        headSha: "abc123",
      },
      files: [
        { path: "src/app.ts", status: "modified", additions: 12, deletions: 3 },
        {
          path: "src/new.ts",
          previousPath: "src/old.ts",
          status: "renamed",
          additions: 5,
          deletions: 1,
        },
      ],
      diff: "diff --git a/src/app.ts b/src/app.ts",
      topics: [
        {
          id: "review-topic-1",
          title: "PR changes",
          summary:
            "Initial generated topic containing all changed files. The agent should replace this with purpose-based topics.",
          rationale: "Fallback topic created by the session script.",
          files: ["src/app.ts", "src/new.ts"],
        },
      ],
      comments: [],
    });
  });

  it("rejects PR JSON without repository owner or name", () => {
    expect(() =>
      buildSessionFromGhPr(
        {
          number: 42,
          title: "Add topic review flow",
          url: "https://github.com/octo/example/pull/42",
          baseRefName: "main",
          headRefName: "topic-review",
          headRefOid: "abc123",
          files: [{ path: "src/app.ts", status: "MODIFIED", additions: 12, deletions: 3 }],
        },
        "diff --git a/src/app.ts b/src/app.ts",
      ),
    ).toThrow("GitHub PR JSON is missing head repository owner or name.");
  });
});

describe("prepare-session validation", () => {
  it("rejects malformed URLs and missing file change counts", async () => {
    const scriptPath = "../scripts/prepare-session.mjs";
    const { validatePreparedSession } = (await import(scriptPath)) as {
      validatePreparedSession: (session: unknown) => unknown;
    };
    const session = {
      pr: {
        owner: "octo",
        repo: "example",
        number: 42,
        title: "Add topic review flow",
        url: "not-a-url",
        baseRefName: "main",
        headRefName: "topic-review",
        headSha: "abc123",
      },
      files: [{ path: "src/app.ts", status: "modified", deletions: 3 }],
      diff: "diff --git a/src/app.ts b/src/app.ts",
      topics: [
        {
          id: "review-topic-1",
          title: "PR changes",
          summary: "Fallback topic.",
          rationale: "Fallback topic created by the session script.",
          files: ["src/app.ts"],
        },
      ],
      comments: [],
    };

    expect(() => validatePreparedSession(session)).toThrow(/Invalid prepared session/);
  });
});

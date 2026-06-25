import { describe, expect, it, vi } from "vitest";
import { buildSessionFromGhPr } from "../app/server/gh";
import { ReviewSessionSchema } from "../app/shared/schema";

describe("buildSessionFromGhPr", () => {
  it("converts GitHub PR JSON into a review session with a fallback topic", () => {
    const session = buildSessionFromGhPr(
      {
        id: "PR_kwDOABC123",
        number: 42,
        title: "Add topic review flow",
        url: "https://github.com/octo/example/pull/42",
        baseRefName: "main",
        headRefName: "topic-review",
        baseRefOid: "base456",
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
        baseSha: "base456",
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
          id: "PR_kwDOABC123",
          number: 42,
          title: "Add topic review flow",
          url: "https://github.com/octo/example/pull/42",
          baseRefName: "main",
          headRefName: "topic-review",
          baseRefOid: "base456",
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
        baseSha: "base456",
        headSha: "abc123",
        nodeId: "PR_kwDOABC123",
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

describe("buildSessionFromGhPr nodeId threading", () => {
  it("passes pr.id through to pr.nodeId", () => {
    const session = buildSessionFromGhPr(
      {
        id: "PR_kwDOABC123",
        number: 42,
        title: "Add topic review flow",
        url: "https://github.com/octo/example/pull/42",
        baseRefName: "main",
        headRefName: "topic-review",
        baseRefOid: "base456",
        headRefOid: "abc123",
        headRepositoryOwner: { login: "octo" },
        headRepository: { name: "example" },
        files: [
          { path: "src/app.ts", status: "MODIFIED", additions: 12, deletions: 3 },
        ],
      },
      "diff --git a/src/app.ts b/src/app.ts",
    );

    expect(session.pr.nodeId).toBe("PR_kwDOABC123");
  });

  it("rejects PR JSON without id", () => {
    expect(() =>
      buildSessionFromGhPr(
        {
          number: 42,
          title: "Add topic review flow",
          url: "https://github.com/octo/example/pull/42",
          baseRefName: "main",
          headRefName: "topic-review",
          baseRefOid: "base456",
          headRefOid: "abc123",
          headRepositoryOwner: { login: "octo" },
          headRepository: { name: "example" },
          files: [{ path: "src/app.ts", status: "MODIFIED", additions: 12, deletions: 3 }],
        },
        "diff --git a/src/app.ts b/src/app.ts",
      ),
    ).toThrow("GitHub PR JSON is missing id.");
  });
});

describe("fetchViewerViewedFiles", () => {
  it("queries viewerViewedState and returns viewed paths", async () => {
    const { fetchViewerViewedFiles } = await import("../app/server/gh");
    const runner = vi.fn().mockResolvedValue(
      JSON.stringify({
        data: {
          node: {
            files: {
              nodes: [
                { path: "src/app.ts", viewerViewedState: "VIEWED" },
                { path: "src/new.ts", viewerViewedState: "UNVIEWED" },
                { path: "src/old.ts", viewerViewedState: "DISMISSED" },
              ],
            },
          },
        },
      }),
    );

    const result = await fetchViewerViewedFiles("PR_kwDOABC123", runner);

    expect(runner).toHaveBeenCalledTimes(1);
    expect(runner).toHaveBeenCalledWith([
      "api",
      "graphql",
      "-f",
      "query=query($id: ID!) { node(id: $id) { ... on PullRequest { files(first: 100) { nodes { path viewerViewedState } } } } }",
      "-F",
      "id=PR_kwDOABC123",
    ]);
    expect(result).toEqual(["src/app.ts"]);
  });

  it("returns empty array when no files are viewed", async () => {
    const { fetchViewerViewedFiles } = await import("../app/server/gh");
    const runner = vi.fn().mockResolvedValue(
      JSON.stringify({
        data: { node: { files: { nodes: [] } } },
      }),
    );

    const result = await fetchViewerViewedFiles("PR_kwDOABC123", runner);
    expect(result).toEqual([]);
  });

  it("propagates runner errors", async () => {
    const { fetchViewerViewedFiles } = await import("../app/server/gh");
    const runner = vi.fn().mockRejectedValue(new Error("gh auth failed"));
    await expect(fetchViewerViewedFiles("PR_kwDOABC123", runner)).rejects.toThrow("gh auth failed");
  });
});

describe("markFileViewed", () => {
  it("calls markFileAsViewed mutation", async () => {
    const { markFileViewed } = await import("../app/server/gh");
    const runner = vi.fn().mockResolvedValue(JSON.stringify({ data: { markFileAsViewed: { clientMutationId: null } } }));

    await markFileViewed("PR_kwDOABC123", "src/app.ts", runner);

    expect(runner).toHaveBeenCalledTimes(1);
    expect(runner).toHaveBeenCalledWith([
      "api",
      "graphql",
      "-f",
      "query=mutation($input: MarkFileAsViewedInput!) { markFileAsViewed(input: $input) { clientMutationId } }",
      "-F",
      "input={\"pullRequestId\":\"PR_kwDOABC123\",\"path\":\"src/app.ts\"}",
    ]);
  });

  it("propagates runner errors", async () => {
    const { markFileViewed } = await import("../app/server/gh");
    const runner = vi.fn().mockRejectedValue(new Error("network"));
    await expect(markFileViewed("PR_kwDOABC123", "src/app.ts", runner)).rejects.toThrow("network");
  });
});

describe("unmarkFileViewed", () => {
  it("calls unmarkFileAsViewed mutation", async () => {
    const { unmarkFileViewed } = await import("../app/server/gh");
    const runner = vi.fn().mockResolvedValue(JSON.stringify({ data: { unmarkFileAsViewed: { clientMutationId: null } } }));

    await unmarkFileViewed("PR_kwDOABC123", "src/app.ts", runner);

    expect(runner).toHaveBeenCalledTimes(1);
    expect(runner).toHaveBeenCalledWith([
      "api",
      "graphql",
      "-f",
      "query=mutation($input: UnmarkFileAsViewedInput!) { unmarkFileAsViewed(input: $input) { clientMutationId } }",
      "-F",
      "input={\"pullRequestId\":\"PR_kwDOABC123\",\"path\":\"src/app.ts\"}",
    ]);
  });
});

import { describe, expect, it, vi } from "vitest";
import type { ReviewComment, ReviewSession } from "../app/shared/schema";
import {
  buildInlineCommentPayload,
  buildTopicCommentBody,
  postInlineComment,
  postPrLevelComment,
  type GhRunner,
} from "../app/server/comments";function validSession(overrides: Partial<ReviewSession> = {}): ReviewSession {
  return {
    pr: {
      owner: "octo",
      repo: "example",
      number: 12,
      title: "Improve review flow",
      url: "https://github.com/octo/example/pull/12",
      baseRefName: "main",
      headRefName: "feature",
      headSha: "abc123",
      baseSha: "base456",
      nodeId: "PR_node1",
    },
    files: [{ path: "src/app.ts", status: "modified", additions: 3, deletions: 1 }],
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
    viewedFiles: [],
    collapsedFiles: [],
    ...overrides,
  };
}

describe("postPrLevelComment", () => {
  it("calls gh api to post an issue comment and returns parsed JSON", async () => {
    const runner = vi.fn<GhRunner>().mockResolvedValue(
      JSON.stringify({
        id: 99,
        html_url: "https://github.com/octo/example/issues/12#issuecomment-99",
      }),
    );

    const result = await postPrLevelComment(
      "octo",
      "example",
      12,
      "**Review flow**\n\nPlease add tests.",
      runner,
    );

    expect(runner).toHaveBeenCalledTimes(1);
    expect(runner).toHaveBeenCalledWith([
      "api",
      "repos/octo/example/issues/12/comments",
      "--method",
      "POST",
      "--field",
      "body=**Review flow**\n\nPlease add tests.",
    ]);
    expect(result).toEqual({
      id: 99,
      html_url: "https://github.com/octo/example/issues/12#issuecomment-99",
    });
  });

  it("propagates runner errors", async () => {
    const runner = vi.fn<GhRunner>().mockRejectedValue(new Error("gh auth failed"));
    await expect(
      postPrLevelComment("octo", "example", 12, "body", runner),
    ).rejects.toThrow("gh auth failed");
  });
});

describe("postInlineComment", () => {
  it("calls gh api to post a pull request review comment with payload fields", async () => {
    const runner = vi.fn<GhRunner>().mockResolvedValue(
      JSON.stringify({
        id: 200,
        html_url: "https://github.com/octo/example/pull/12#discussion_r200",
      }),
    );

    const result = await postInlineComment("octo", "example", 12, {
      body: "Simplify this.",
      commitId: "abc123",
      path: "src/app.ts",
      line: 42,
      side: "RIGHT",
    }, runner);

    expect(runner).toHaveBeenCalledTimes(1);
    expect(runner).toHaveBeenCalledWith([
      "api",
      "repos/octo/example/pulls/12/comments",
      "--method",
      "POST",
      "--field",
      "body=Simplify this.",
      "--field",
      "commit_id=abc123",
      "--field",
      "path=src/app.ts",
      "--field",
      "line=42",
      "--field",
      "side=RIGHT",
    ]);
    expect(result).toEqual({
      id: 200,
      html_url: "https://github.com/octo/example/pull/12#discussion_r200",
    });
  });
});

describe("buildInlineCommentPayload / buildTopicCommentBody", () => {
  it("builds inline payload shape", () => {
    expect(
      buildInlineCommentPayload({
        body: "b",
        commitId: "c",
        path: "p",
        line: 1,
        side: "LEFT",
      }),
    ).toEqual({ body: "b", commit_id: "c", path: "p", line: 1, side: "LEFT" });
  });

  it("prefixes topic body with title", () => {
    expect(buildTopicCommentBody("T", "body")).toBe("**T**\n\nbody");
  });
});

describe("POST /api/comments/post-all", () => {
  it("posts inline comments via inline API and topic comments via PR-level API", async () => {
    const { buildServer } = await import("../app/server/index");
    const inlineComment: ReviewComment = {
      id: "c1",
      topicId: "topic-review-flow",
      body: "Simplify this.",
      path: "src/app.ts",
      line: 42,
      side: "RIGHT",
      kind: "inline",
      postingStatus: "draft",
    };
    const topicComment: ReviewComment = {
      id: "c2",
      topicId: "topic-review-flow",
      body: "Needs integration test.",
      kind: "topic",
      postingStatus: "draft",
    };
    const session = validSession({ comments: [inlineComment, topicComment] });

    const updated: Record<string, Partial<ReviewComment>> = {};
    const store = {
      get: () => session,
      addComment: vi.fn(),
      updateComment: vi.fn(async (id: string, updates: Partial<ReviewComment>) => {
        updated[id] = updates;
        const idx = session.comments.findIndex((c) => c.id === id);
        if (idx >= 0) session.comments[idx] = { ...session.comments[idx], ...updates };
        return session.comments[idx];
      }),
      setFileViewed: vi.fn(),
      setFileCollapsed: vi.fn(),
      syncViewedFilesFromGithub: vi.fn(),
    };

    const postInline = vi.fn().mockResolvedValue({
      id: 200,
      html_url: "https://github.com/octo/example/pull/12#discussion_r200",
    });
    const postPr = vi.fn().mockResolvedValue({
      id: 99,
      html_url: "https://github.com/octo/example/issues/12#issuecomment-99",
    });

    const app = buildServer(store, {}, { postInlineComment: postInline, postPrLevelComment: postPr, markFileViewed: vi.fn(), unmarkFileViewed: vi.fn() });

    const response = await app.inject({ method: "POST", url: "/api/comments/post-all" });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.posted).toBe(2);
    expect(body.failed).toBe(0);
    expect(body.results).toHaveLength(2);

    expect(postInline).toHaveBeenCalledTimes(1);
    expect(postInline).toHaveBeenCalledWith("octo", "example", 12, {
      body: "Simplify this.",
      commitId: "abc123",
      path: "src/app.ts",
      line: 42,
      side: "RIGHT",
    });

    expect(postPr).toHaveBeenCalledTimes(1);
    expect(postPr).toHaveBeenCalledWith(
      "octo",
      "example",
      12,
      "**Review flow**\n\nNeeds integration test.",
    );

    expect(updated["c1"]).toMatchObject({
      postingStatus: "posted",
      githubUrl: "https://github.com/octo/example/pull/12#discussion_r200",
    });
    expect(updated["c2"]).toMatchObject({
      postingStatus: "posted",
      githubUrl: "https://github.com/octo/example/issues/12#issuecomment-99",
    });
  });

  it("marks a comment as failed and stores the error message", async () => {
    const { buildServer } = await import("../app/server/index");
    const comment: ReviewComment = {
      id: "c1",
      topicId: "topic-review-flow",
      body: "Simplify this.",
      path: "src/app.ts",
      line: 42,
      side: "RIGHT",
      kind: "inline",
      postingStatus: "draft",
    };
    const session = validSession({ comments: [comment] });

    const updated: Record<string, Partial<ReviewComment>> = {};
    const store = {
      get: () => session,
      addComment: vi.fn(),
      updateComment: vi.fn(async (id: string, updates: Partial<ReviewComment>) => {
        updated[id] = updates;
        const idx = session.comments.findIndex((c) => c.id === id);
        if (idx >= 0) session.comments[idx] = { ...session.comments[idx], ...updates };
        return session.comments[idx];
      }),
      setFileViewed: vi.fn(),
      setFileCollapsed: vi.fn(),
      syncViewedFilesFromGithub: vi.fn(),
    };

    const postInline = vi.fn().mockRejectedValue(new Error("422 Unprocessable Entity"));
    const postPr = vi.fn();

    const app = buildServer(store, {}, { postInlineComment: postInline, postPrLevelComment: postPr, markFileViewed: vi.fn(), unmarkFileViewed: vi.fn() });

    const response = await app.inject({ method: "POST", url: "/api/comments/post-all" });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.posted).toBe(0);
    expect(body.failed).toBe(1);
    expect(body.results[0]).toMatchObject({ id: "c1", status: "failed" });
    expect(updated["c1"]).toMatchObject({
      postingStatus: "failed",
      error: "422 Unprocessable Entity",
    });
  });

  it("skips comments that are already posted", async () => {
    const { buildServer } = await import("../app/server/index");
    const posted: ReviewComment = {
      id: "c1",
      topicId: "topic-review-flow",
      body: "Already done.",
      kind: "topic",
      postingStatus: "posted",
      githubUrl: "https://github.com/octo/example/issues/12#issuecomment-1",
    };
    const session = validSession({ comments: [posted] });

    const store = {
      get: () => session,
      addComment: vi.fn(),
      updateComment: vi.fn(),
      setFileViewed: vi.fn(),
      setFileCollapsed: vi.fn(),
      syncViewedFilesFromGithub: vi.fn(),
    };

    const postInline = vi.fn();
    const postPr = vi.fn();

    const app = buildServer(store, {}, { postInlineComment: postInline, postPrLevelComment: postPr, markFileViewed: vi.fn(), unmarkFileViewed: vi.fn() });

    const response = await app.inject({ method: "POST", url: "/api/comments/post-all" });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.posted).toBe(0);
    expect(body.failed).toBe(0);
    expect(body.skipped).toBe(1);
    expect(postInline).not.toHaveBeenCalled();
    expect(postPr).not.toHaveBeenCalled();
  });

  it("uses baseSha as commit_id for left-side inline comments", async () => {
    const { buildServer } = await import("../app/server/index");
    const leftComment: ReviewComment = {
      id: "c-left",
      topicId: "topic-review-flow",
      body: "Removed line issue.",
      path: "src/app.ts",
      line: 10,
      side: "LEFT",
      kind: "inline",
      postingStatus: "draft",
    };
    const rightComment: ReviewComment = {
      id: "c-right",
      topicId: "topic-review-flow",
      body: "Added line issue.",
      path: "src/app.ts",
      line: 20,
      side: "RIGHT",
      kind: "inline",
      postingStatus: "draft",
    };
    const session = validSession({ comments: [leftComment, rightComment] });

    const store = {
      get: () => session,
      addComment: vi.fn(),
      updateComment: vi.fn(async (id: string, updates: Partial<ReviewComment>) => {
        const idx = session.comments.findIndex((c) => c.id === id);
        if (idx >= 0) session.comments[idx] = { ...session.comments[idx], ...updates };
        return session.comments[idx];
      }),
      setFileViewed: vi.fn(),
      setFileCollapsed: vi.fn(),
      syncViewedFilesFromGithub: vi.fn(),
    };

    const postInline = vi.fn().mockResolvedValue({
      id: 1,
      html_url: "https://github.com/octo/example/pull/12#discussion_r1",
    });
    const postPr = vi.fn();

    const app = buildServer(store, {}, { postInlineComment: postInline, postPrLevelComment: postPr, markFileViewed: vi.fn(), unmarkFileViewed: vi.fn() });

    const response = await app.inject({ method: "POST", url: "/api/comments/post-all" });

    expect(response.statusCode).toBe(200);
    expect(postInline).toHaveBeenCalledTimes(2);
    expect(postInline).toHaveBeenNthCalledWith(1, "octo", "example", 12, {
      body: "Removed line issue.",
      commitId: "base456",
      path: "src/app.ts",
      line: 10,
      side: "LEFT",
    });
    expect(postInline).toHaveBeenNthCalledWith(2, "octo", "example", 12, {
      body: "Added line issue.",
      commitId: "abc123",
      path: "src/app.ts",
      line: 20,
      side: "RIGHT",
    });
  });

  it("handles mixed success and failure in a batch independently", async () => {
    const { buildServer } = await import("../app/server/index");
    const ok: ReviewComment = {
      id: "ok",
      topicId: "topic-review-flow",
      body: "ok",
      kind: "topic",
      postingStatus: "draft",
    };
    const boom: ReviewComment = {
      id: "boom",
      topicId: "topic-review-flow",
      body: "boom",
      kind: "topic",
      postingStatus: "draft",
    };
    const session = validSession({ comments: [ok, boom] });

    const updated: Record<string, Partial<ReviewComment>> = {};
    const store = {
      get: () => session,
      addComment: vi.fn(),
      updateComment: vi.fn(async (id: string, updates: Partial<ReviewComment>) => {
        updated[id] = updates;
        const idx = session.comments.findIndex((c) => c.id === id);
        if (idx >= 0) session.comments[idx] = { ...session.comments[idx], ...updates };
        return session.comments[idx];
      }),
      setFileViewed: vi.fn(),
      setFileCollapsed: vi.fn(),
      syncViewedFilesFromGithub: vi.fn(),
    };

    const postInline = vi.fn();
    const postPr = vi
      .fn()
      .mockResolvedValueOnce({ html_url: "https://github.com/octo/example/issues/12#c1" })
      .mockRejectedValueOnce(new Error("500 Server Error"));

    const app = buildServer(store, {}, { postInlineComment: postInline, postPrLevelComment: postPr, markFileViewed: vi.fn(), unmarkFileViewed: vi.fn() });

    const response = await app.inject({ method: "POST", url: "/api/comments/post-all" });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.posted).toBe(1);
    expect(body.failed).toBe(1);
    expect(body.skipped).toBe(0);
    expect(body.results).toHaveLength(2);
    expect(updated["ok"]).toMatchObject({
      postingStatus: "posted",
      githubUrl: "https://github.com/octo/example/issues/12#c1",
    });
    expect(updated["boom"]).toMatchObject({
      postingStatus: "failed",
      error: "500 Server Error",
    });
  });

  it("returns 409 when a post-all batch is already in flight", async () => {
    const { buildServer, PostAllGuard } = await import("../app/server/index");
    const c1: ReviewComment = {
      id: "c1",
      topicId: "topic-review-flow",
      body: "first",
      kind: "topic",
      postingStatus: "draft",
    };
    const session = validSession({ comments: [c1] });

    const store = {
      get: () => session,
      addComment: vi.fn(),
      updateComment: vi.fn(async (id: string, updates: Partial<ReviewComment>) => {
        const idx = session.comments.findIndex((c) => c.id === id);
        if (idx >= 0) session.comments[idx] = { ...session.comments[idx], ...updates };
        return session.comments[idx];
      }),
      setFileViewed: vi.fn(),
      setFileCollapsed: vi.fn(),
      syncViewedFilesFromGithub: vi.fn(),
    };

    const postPr = vi.fn().mockResolvedValue({
      html_url: "https://github.com/octo/example/issues/12#c1",
    });
    const guard = new PostAllGuard();
    guard.tryAcquire();
    expect(guard.isLocked).toBe(true);

    const app = buildServer(
      store,
      {},
      { postInlineComment: vi.fn(), postPrLevelComment: postPr, markFileViewed: vi.fn(), unmarkFileViewed: vi.fn() },
      guard,
    );

    const response = await app.inject({ method: "POST", url: "/api/comments/post-all" });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: "post-all already in progress" });
    expect(postPr).not.toHaveBeenCalled();
    expect(guard.isLocked).toBe(true);

    guard.release();
    expect(guard.isLocked).toBe(false);

    const okResponse = await app.inject({ method: "POST", url: "/api/comments/post-all" });
    expect(okResponse.statusCode).toBe(200);
    const body = okResponse.json();
    expect(body.posted).toBe(1);
  });
});

import { describe, expect, it, vi } from "vitest";
import type { ReviewComment, ReviewSession } from "../app/shared/schema";

function validSession(overrides: Partial<ReviewSession> = {}): ReviewSession {
  return {
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

describe("POST /api/files/viewed", () => {
  it("optimistically updates local viewedFiles and returns the updated session", async () => {
    const { buildServer } = await import("../app/server/index");
    const session = validSession();
    const store = {
      get: () => session,
      addComment: vi.fn(),
      updateComment: vi.fn(),
      setFileViewed: vi.fn(async (path: string, viewed: boolean) => {
        if (viewed) session.viewedFiles.push(path);
        else session.viewedFiles = session.viewedFiles.filter((p) => p !== path);
        return session;
      }),
      setFileCollapsed: vi.fn(),
      syncViewedFilesFromGithub: vi.fn(),
    };

    const app = buildServer(store, {}, {
      postInlineComment: vi.fn(),
      postPrLevelComment: vi.fn(),
      markFileViewed: vi.fn().mockResolvedValue(undefined),
      unmarkFileViewed: vi.fn().mockResolvedValue(undefined),
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/files/viewed",
      payload: { path: "src/app.ts", viewed: true },
    });

    expect(response.statusCode).toBe(200);
    expect(store.setFileViewed).toHaveBeenCalledWith("src/app.ts", true);
    expect(response.json().viewedFiles).toEqual(["src/app.ts"]);
  });

  it("fires markFileViewed adapter in the background after optimistic update", async () => {
    const { buildServer } = await import("../app/server/index");
    const session = validSession();
    const store = {
      get: () => session,
      addComment: vi.fn(),
      updateComment: vi.fn(),
      setFileViewed: vi.fn(async (path: string, viewed: boolean) => {
        if (viewed) session.viewedFiles.push(path);
        else session.viewedFiles = session.viewedFiles.filter((p) => p !== path);
        return session;
      }),
      setFileCollapsed: vi.fn(),
      syncViewedFilesFromGithub: vi.fn(),
    };

    const markViewed = vi.fn().mockResolvedValue(undefined);
    const app = buildServer(store, {}, {
      postInlineComment: vi.fn(),
      postPrLevelComment: vi.fn(),
      markFileViewed: markViewed,
      unmarkFileViewed: vi.fn(),
    });

    await app.inject({
      method: "POST",
      url: "/api/files/viewed",
      payload: { path: "src/app.ts", viewed: true },
    });

    expect(markViewed).toHaveBeenCalledWith("PR_node1", "src/app.ts");
  });

  it("fires unmarkFileViewed when viewed is false", async () => {
    const { buildServer } = await import("../app/server/index");
    const session = validSession({ viewedFiles: ["src/app.ts"] });
    const store = {
      get: () => session,
      addComment: vi.fn(),
      updateComment: vi.fn(),
      setFileViewed: vi.fn(async (path: string, viewed: boolean) => {
        if (viewed) session.viewedFiles.push(path);
        else session.viewedFiles = session.viewedFiles.filter((p) => p !== path);
        return session;
      }),
      setFileCollapsed: vi.fn(),
      syncViewedFilesFromGithub: vi.fn(),
    };

    const unmarkViewed = vi.fn().mockResolvedValue(undefined);
    const app = buildServer(store, {}, {
      postInlineComment: vi.fn(),
      postPrLevelComment: vi.fn(),
      markFileViewed: vi.fn(),
      unmarkFileViewed: unmarkViewed,
    });

    await app.inject({
      method: "POST",
      url: "/api/files/viewed",
      payload: { path: "src/app.ts", viewed: false },
    });

    expect(unmarkViewed).toHaveBeenCalledWith("PR_node1", "src/app.ts");
  });

  it("returns 400 for an unknown file path", async () => {
    const { buildServer } = await import("../app/server/index");
    const store = {
      get: () => validSession(),
      addComment: vi.fn(),
      updateComment: vi.fn(),
      setFileViewed: vi.fn(),
      setFileCollapsed: vi.fn(),
      syncViewedFilesFromGithub: vi.fn(),
    };

    const app = buildServer(store, {}, {
      postInlineComment: vi.fn(),
      postPrLevelComment: vi.fn(),
      markFileViewed: vi.fn(),
      unmarkFileViewed: vi.fn(),
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/files/viewed",
      payload: { path: "src/nonexistent.ts", viewed: true },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "Unknown file path" });
    expect(store.setFileViewed).not.toHaveBeenCalled();
  });

  it("keeps local state when GitHub sync fails", async () => {
    const { buildServer } = await import("../app/server/index");
    const session = validSession();
    const store = {
      get: () => session,
      addComment: vi.fn(),
      updateComment: vi.fn(),
      setFileViewed: vi.fn(async (path: string, viewed: boolean) => {
        if (viewed) session.viewedFiles.push(path);
        return session;
      }),
      setFileCollapsed: vi.fn(),
      syncViewedFilesFromGithub: vi.fn(),
    };

    const markViewed = vi.fn().mockRejectedValue(new Error("gh timeout"));
    const app = buildServer(store, {}, {
      postInlineComment: vi.fn(),
      postPrLevelComment: vi.fn(),
      markFileViewed: markViewed,
      unmarkFileViewed: vi.fn(),
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/files/viewed",
      payload: { path: "src/app.ts", viewed: true },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().viewedFiles).toEqual(["src/app.ts"]);
  });
});

describe("POST /api/files/collapsed", () => {
  it("updates local collapsedFiles and returns the updated session", async () => {
    const { buildServer } = await import("../app/server/index");
    const session = validSession();
    const store = {
      get: () => session,
      addComment: vi.fn(),
      updateComment: vi.fn(),
      setFileViewed: vi.fn(),
      setFileCollapsed: vi.fn(async (path: string, collapsed: boolean) => {
        if (collapsed) session.collapsedFiles.push(path);
        else session.collapsedFiles = session.collapsedFiles.filter((p) => p !== path);
        return session;
      }),
      syncViewedFilesFromGithub: vi.fn(),
    };

    const app = buildServer(store, {}, {
      postInlineComment: vi.fn(),
      postPrLevelComment: vi.fn(),
      markFileViewed: vi.fn(),
      unmarkFileViewed: vi.fn(),
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/files/collapsed",
      payload: { path: "src/app.ts", collapsed: true },
    });

    expect(response.statusCode).toBe(200);
    expect(store.setFileCollapsed).toHaveBeenCalledWith("src/app.ts", true);
    expect(response.json().collapsedFiles).toEqual(["src/app.ts"]);
  });

  it("does not call any GitHub adapter", async () => {
    const { buildServer } = await import("../app/server/index");
    const session = validSession();
    const markViewed = vi.fn();
    const unmarkViewed = vi.fn();
    const store = {
      get: () => session,
      addComment: vi.fn(),
      updateComment: vi.fn(),
      setFileViewed: vi.fn(),
      setFileCollapsed: vi.fn(async () => session),
      syncViewedFilesFromGithub: vi.fn(),
    };

    const app = buildServer(store, {}, {
      postInlineComment: vi.fn(),
      postPrLevelComment: vi.fn(),
      markFileViewed: markViewed,
      unmarkFileViewed: unmarkViewed,
    });

    await app.inject({
      method: "POST",
      url: "/api/files/collapsed",
      payload: { path: "src/app.ts", collapsed: true },
    });

    expect(markViewed).not.toHaveBeenCalled();
    expect(unmarkViewed).not.toHaveBeenCalled();
  });

  it("returns 400 for an unknown file path", async () => {
    const { buildServer } = await import("../app/server/index");
    const store = {
      get: () => validSession(),
      addComment: vi.fn(),
      updateComment: vi.fn(),
      setFileViewed: vi.fn(),
      setFileCollapsed: vi.fn(),
      syncViewedFilesFromGithub: vi.fn(),
    };

    const app = buildServer(store, {}, {
      postInlineComment: vi.fn(),
      postPrLevelComment: vi.fn(),
      markFileViewed: vi.fn(),
      unmarkFileViewed: vi.fn(),
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/files/collapsed",
      payload: { path: "src/nonexistent.ts", collapsed: true },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "Unknown file path" });
  });
});

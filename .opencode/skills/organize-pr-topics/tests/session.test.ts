import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { SessionStore } from "../app/server/session";
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
    ...overrides,
  };
}

async function writeSession(session: unknown) {
  const dir = await mkdtemp(join(tmpdir(), "pr-topic-session-"));
  const path = join(dir, "session.json");
  await writeFile(path, JSON.stringify(session, null, 2));
  return path;
}

describe("SessionStore", () => {
  it("loads and returns a validated session file", async () => {
    const session = validSession();
    const store = new SessionStore(await writeSession(session));

    await expect(store.load()).resolves.toEqual(session);
    expect(store.get()).toEqual(session);
  });

  it("rejects an invalid session file", async () => {
    const store = new SessionStore(await writeSession({ comments: [] }));

    await expect(store.load()).rejects.toThrow();
  });

  it("throws when reading before loading", async () => {
    const store = new SessionStore(await writeSession(validSession()));

    expect(() => store.get()).toThrow("Session has not been loaded.");
  });

  it("appends a validated comment and writes the session file", async () => {
    const session = validSession();
    const path = await writeSession(session);
    const store = new SessionStore(path);
    const comment: ReviewComment = {
      id: "comment-1",
      topicId: "topic-review-flow",
      body: "Please simplify this branch.",
      path: "src/app.ts",
      line: 4,
      side: "RIGHT",
      kind: "inline",
      postingStatus: "draft",
    };

    await store.load();
    await expect(store.addComment(comment)).resolves.toEqual(comment);

    const written = JSON.parse(await readFile(path, "utf8"));
    expect(written.comments).toEqual([comment]);
    expect(store.get().comments).toEqual([comment]);
  });

  it("rejects an invalid comment without writing it", async () => {
    const path = await writeSession(validSession());
    const store = new SessionStore(path);

    await store.load();
    await expect(
      store.addComment({ body: "Missing required fields" } as ReviewComment),
    ).rejects.toThrow();

    const written = JSON.parse(await readFile(path, "utf8"));
    expect(written.comments).toEqual([]);
  });

  it("preserves every concurrent comment append", async () => {
    const path = await writeSession(validSession());
    const store = new SessionStore(path);
    const comments = Array.from({ length: 50 }, (_, index): ReviewComment => ({
      id: `comment-${index}`,
      topicId: "topic-review-flow",
      body: `Please review item ${index}.${"x".repeat(
        index === 0 ? 5_000_000 : 0,
      )}`,
      kind: "topic",
      postingStatus: "draft",
    }));

    await store.load();
    await Promise.all(comments.map((comment) => store.addComment(comment)));

    const written = JSON.parse(await readFile(path, "utf8"));
    expect(written.comments.map((comment: ReviewComment) => comment.id)).toEqual(
      comments.map((comment) => comment.id),
    );
  });
});

describe("review server routes", () => {
  afterEach(() => {
    delete process.env.PR_TOPIC_SESSION_PATH;
  });

  it("builds testable routes without requiring PR_TOPIC_SESSION_PATH or listening", async () => {
    const { buildServer } = await import("../app/server/index");
    const session = validSession();
    const app = buildServer({
      get: () => session,
      addComment: async (comment: ReviewComment) => {
        session.comments.push(comment);
        return comment;
      },
      updateComment: async (_id: string, updates: Partial<ReviewComment>) =>
        updates as ReviewComment,
    });

    const response = await app.inject({ method: "GET", url: "/api/session" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(session);
  });

  it("returns 400 for invalid comment payloads", async () => {
    const { buildServer } = await import("../app/server/index");
    const app = buildServer({
      get: () => validSession(),
      addComment: async (comment: ReviewComment) => comment,
      updateComment: async (_id: string, updates: Partial<ReviewComment>) =>
        updates as ReviewComment,
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/comments",
      payload: { topicId: "topic-review-flow", kind: "topic" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "Invalid comment payload",
    });
  });
});

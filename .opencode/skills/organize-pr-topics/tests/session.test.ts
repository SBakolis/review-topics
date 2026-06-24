import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
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
});

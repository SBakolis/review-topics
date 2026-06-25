# Mark Files as Viewed & Collapsible File Headers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users mark files as viewed (with GitHub sync), make file headers collapsible, and auto-collapse on mark-viewed.

**Architecture:** Schema gains `viewedFiles`/`collapsedFiles` arrays + `PrInfo.nodeId`. `gh.ts` gains GraphQL helpers (`fetchViewerViewedFiles`, `markFileViewed`, `unmarkFileViewed`) and threads `id` through `getCurrentPr`/`buildSessionFromGhPr`. `SessionStore` gains `setFileViewed`/`setFileCollapsed`/`syncViewedFilesFromGithub` using the existing write-queue. Server gains `POST /api/files/viewed` (optimistic local + background GitHub sync) and `POST /api/files/collapsed` (local only) plus load-time seeding in `startServer()`. `FileCard` header becomes a flex row with chevron + path + viewed toggle; body conditionally renders on collapse. The `prepare-session.mjs` script and its duplicated schema are updated in lockstep with the shared schema.

**Tech Stack:** React 19, Fastify 5, Zod 4, vitest 4, `gh` CLI (GraphQL mutations), TypeScript 6.

**Spec:** `docs/superpowers/specs/2026-06-25-mark-files-viewed-collapsible-headers-design.md`

**Working directory:** All paths are relative to `.claude/skills/organize-pr-topics/` unless prefixed with `docs/`.

---

## File Structure

- Modify: `app/shared/schema.ts` — add `viewedFiles`, `collapsedFiles` to `ReviewSessionSchema`; add `nodeId` to `PrInfoSchema`.
- Modify: `app/server/gh.ts` — add `id` to `GhPr` and `getCurrentPr` JSON fields; add `fetchViewerViewedFiles`, `markFileViewed`, `unmarkFileViewed`.
- Modify: `app/server/session.ts` — add `setFileViewed`, `setFileCollapsed`, `syncViewedFilesFromGithub`.
- Modify: `app/server/index.ts` — add `POST /api/files/viewed`, `POST /api/files/collapsed`; extend `ReviewSessionStore` interface; seed viewed files in `startServer()`.
- Modify: `app/ui/components/DiffReview.tsx` — redesign `FileCard` header; conditional body render on collapse.
- Modify: `app/ui/App.tsx` — pass `viewedFiles`/`collapsedFiles` + toggle handlers to `DiffReview`.
- Modify: `app/ui/styles.css` — header flex layout, chevron, viewed-toggle styles.
- Modify: `scripts/prepare-session.mjs` — mirror schema additions (`viewedFiles`, `collapsedFiles`, `nodeId`) in the duplicated validation schema; add `id` to `PR_JSON_FIELDS`.
- Modify: `tests/schema.test.ts` — defaults + populated arrays + non-string rejection.
- Modify: `tests/gh.test.ts` — `fetchViewerViewedFiles`, `markFileViewed`, `unmarkFileViewed`, `nodeId` threading.
- Modify: `tests/session.test.ts` — `setFileViewed`, `setFileCollapsed`, `syncViewedFilesFromGithub`.
- Modify: `tests/posting.test.ts` (or new `tests/viewedFiles.test.ts`) — server endpoints.
- Modify: `tests/prepareSession.test.ts` — `id` in `PR_JSON_FIELDS`.
- Modify: `tests/diffReviewAccessibility.test.ts` — header chevron + viewed toggle semantics + collapsed body hidden.

---

## Task 1: Schema — add `viewedFiles`, `collapsedFiles`, `nodeId`

**Files:**
- Modify: `.claude/skills/organize-pr-topics/app/shared/schema.ts`
- Test: `.claude/skills/organize-pr-topics/tests/schema.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/schema.test.ts` (inside the existing `describe("ReviewSessionSchema", ...)` block, before the closing `});`):

```ts
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
```

Also update the two existing tests in `schema.test.ts` to add `nodeId: "PR_node1"` to the `pr` object (both the "accepts a valid current-PR session" test and the "rejects a topic that references no files" test), since `nodeId` will become required.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- schema.test.ts`
Expected: FAIL — `viewedFiles`/`collapsedFiles` undefined, `nodeId` not in schema, existing tests fail on missing `nodeId`.

- [ ] **Step 3: Implement the schema changes**

In `app/shared/schema.ts`, add `nodeId` to `PrInfoSchema` (after `headSha`):

```ts
export const PrInfoSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  number: z.number().int().positive(),
  title: z.string().min(1),
  url: z.string().url(),
  baseRefName: z.string().min(1),
  headRefName: z.string().min(1),
  baseSha: z.string().min(1),
  headSha: z.string().min(1),
  nodeId: z.string().min(1),
});
```

Add `viewedFiles` and `collapsedFiles` to `ReviewSessionSchema` (after `comments`):

```ts
export const ReviewSessionSchema = z.object({
  pr: PrInfoSchema,
  files: z.array(PrFileSchema),
  diff: z.string(),
  topics: z.array(ReviewTopicSchema).min(1),
  comments: z.array(ReviewCommentSchema),
  viewedFiles: z.array(z.string().min(1)).default([]),
  collapsedFiles: z.array(z.string().min(1)).default([]),
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- schema.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 5: Update `session.json` fixture to include `nodeId`**

The existing `session.json` file at `.claude/skills/organize-pr-topics/session.json` is a real session used by the running app. Add `nodeId` to its `pr` object. Read the current `pr` object from the file, then add a `"nodeId": "PR_placeholder"` field (the real value is populated at prepare-session time). Also verify `viewedFiles` and `collapsedFiles` are absent (they'll default) or add them as empty arrays.

Actually, since `viewedFiles`/`collapsedFiles` default to `[]`, existing `session.json` loads fine without them. Only `nodeId` is required. Run:

```bash
node -e "const fs = require('fs'); const p = '.claude/skills/organize-pr-topics/session.json'; const s = JSON.parse(fs.readFileSync(p, 'utf8')); if (!s.pr.nodeId) { s.pr.nodeId = 'PR_placeholder'; fs.writeFileSync(p, JSON.stringify(s, null, 2)); } console.log('nodeId:', s.pr.nodeId);"
```

- [ ] **Step 6: Run full test suite to check for regressions**

Run: `npm test`
Expected: Some failures in `gh.test.ts`, `session.test.ts`, `posting.test.ts`, `prepareSession.test.ts` because their fixtures don't include `nodeId`. These will be fixed in subsequent tasks. Note the failures but don't fix them yet — they're expected until the fixture updates land.

- [ ] **Step 7: Commit**

```bash
git add .claude/skills/organize-pr-topics/app/shared/schema.ts .claude/skills/organize-pr-topics/tests/schema.test.ts .claude/skills/organize-pr-topics/session.json
git commit -m "feat: add viewedFiles, collapsedFiles, nodeId to session schema"
```

---

## Task 2: GitHub integration — `nodeId` threading + GraphQL helpers

**Files:**
- Modify: `.claude/skills/organize-pr-topics/app/server/gh.ts`
- Test: `.claude/skills/organize-pr-topics/tests/gh.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/gh.test.ts` (before the final `});` of the file, or as new `describe` blocks at the end):

```ts
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
```

Add `vi` to the vitest import at the top of `tests/gh.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
```

Also update the existing two `buildSessionFromGhPr` tests to add `id: "PR_kwDOABC123"` to the PR JSON objects (both the "converts GitHub PR JSON" test and the "rejects PR JSON without repository owner or name" test).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- gh.test.ts`
Expected: FAIL — `fetchViewerViewedFiles`/`markFileViewed`/`unmarkFileViewed` not exported, `nodeId` not threaded.

- [ ] **Step 3: Implement the gh.ts changes**

In `app/server/gh.ts`:

Add `id: string;` to the `GhPr` type (after `number`):

```ts
export type GhPr = {
  id: string;
  number: number;
  title: string;
  url: string;
  baseRefName: string;
  headRefName: string;
  baseRefOid?: string;
  headRefOid: string;
  files: GhPrFile[];
  headRepositoryOwner?: { login?: string };
  headRepository?: { name?: string };
};
```

Update the `--json` fields in `getCurrentPr` to include `id`:

```ts
export async function getCurrentPr() {
  const output = await runGh([
    "pr",
    "view",
    "--json",
    "id,number,title,url,baseRefName,headRefName,baseRefOid,headRefOid,files,headRepositoryOwner,headRepository",
  ]);
  return JSON.parse(output) as GhPr;
}
```

In `buildSessionFromGhPr`, add the `id` validation (after the `owner`/`repo` check, before the `baseRefOid` check) and thread `nodeId` into the returned `pr`:

```ts
export function buildSessionFromGhPr(pr: GhPr, diff: string): ReviewSession {
  const owner = pr.headRepositoryOwner?.login;
  const repo = pr.headRepository?.name;

  if (!owner || !repo) {
    throw new Error("GitHub PR JSON is missing head repository owner or name.");
  }

  if (!pr.id) {
    throw new Error("GitHub PR JSON is missing id.");
  }

  if (!pr.baseRefOid) {
    throw new Error("GitHub PR JSON is missing baseRefOid.");
  }

  const files = pr.files.map((file): PrFile => {
    const rawStatus = file.status ?? file.changeType ?? "modified";
    const normalized: PrFile = {
      path: file.path,
      status: rawStatus.toLowerCase(),
      additions: file.additions,
      deletions: file.deletions,
    };

    if (file.previousPath) {
      normalized.previousPath = file.previousPath;
    }

    return normalized;
  });

  return {
    pr: {
      owner,
      repo,
      number: pr.number,
      title: pr.title,
      url: pr.url,
      baseRefName: pr.baseRefName,
      headRefName: pr.headRefName,
      baseSha: pr.baseRefOid,
      headSha: pr.headRefOid,
      nodeId: pr.id,
    },
    files,
    diff,
    topics: [
      {
        id: "review-topic-1",
        title: "PR changes",
        summary:
          "Initial generated topic containing all changed files. The agent should replace this with purpose-based topics.",
        rationale: "Fallback topic created by the session script.",
        files: files.map((file) => file.path),
      },
    ],
    comments: [],
    viewedFiles: [],
    collapsedFiles: [],
  };
}
```

Add the three new functions at the end of `app/server/gh.ts`:

```ts
export type GhGraphQLRunner = (args: string[]) => Promise<string>;

export async function fetchViewerViewedFiles(
  prNodeId: string,
  runner: GhGraphQLRunner = runGh,
): Promise<string[]> {
  const query =
    "query($id: ID!) { node(id: $id) { ... on PullRequest { files(first: 100) { nodes { path viewerViewedState } } } } }";
  const stdout = await runner(["api", "graphql", "-f", `query=${query}`, "-F", `id=${prNodeId}`]);
  const payload = JSON.parse(stdout) as {
    data?: { node?: { files?: { nodes?: Array<{ path: string; viewerViewedState: string }> } } };
  };

  const nodes = payload.data?.node?.files?.nodes ?? [];
  return nodes
    .filter((node) => node.viewerViewedState === "VIEWED")
    .map((node) => node.path);
}

export async function markFileViewed(
  prNodeId: string,
  path: string,
  runner: GhGraphQLRunner = runGh,
): Promise<void> {
  const query =
    "mutation($input: MarkFileAsViewedInput!) { markFileAsViewed(input: $input) { clientMutationId } }";
  const input = JSON.stringify({ pullRequestId: prNodeId, path });
  await runner(["api", "graphql", "-f", `query=${query}`, "-F", `input=${input}`]);
}

export async function unmarkFileViewed(
  prNodeId: string,
  path: string,
  runner: GhGraphQLRunner = runGh,
): Promise<void> {
  const query =
    "mutation($input: UnmarkFileAsViewedInput!) { unmarkFileAsViewed(input: $input) { clientMutationId } }";
  const input = JSON.stringify({ pullRequestId: prNodeId, path });
  await runner(["api", "graphql", "-f", `query=${query}`, "-F", `input=${input}`]);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- gh.test.ts`
Expected: PASS — all gh tests green.

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/organize-pr-topics/app/server/gh.ts .claude/skills/organize-pr-topics/tests/gh.test.ts
git commit -m "feat: add nodeId threading and GraphQL viewed-file helpers to gh.ts"
```

---

## Task 3: Session store — `setFileViewed`, `setFileCollapsed`, `syncViewedFilesFromGithub`

**Files:**
- Modify: `.claude/skills/organize-pr-topics/app/server/session.ts`
- Test: `.claude/skills/organize-pr-topics/tests/session.test.ts`

- [ ] **Step 1: Write the failing tests**

First, update the `validSession` helper at the top of `tests/session.test.ts` to include `nodeId` in the `pr` object and add `viewedFiles: []` and `collapsedFiles: []`:

```ts
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
    viewedFiles: [],
    collapsedFiles: [],
    ...overrides,
  };
}
```

Append these new test blocks inside the `describe("SessionStore", ...)` block, before its closing `});`:

```ts
  it("adds a file to viewedFiles via setFileViewed", async () => {
    const path = await writeSession(validSession());
    const store = new SessionStore(path);
    await store.load();

    await store.setFileViewed("src/app.ts", true);

    const written = JSON.parse(await readFile(path, "utf8"));
    expect(written.viewedFiles).toEqual(["src/app.ts"]);
    expect(store.get().viewedFiles).toEqual(["src/app.ts"]);
  });

  it("removes a file from viewedFiles via setFileViewed", async () => {
    const path = await writeSession(validSession({ viewedFiles: ["src/app.ts", "src/other.ts"] }));
    const store = new SessionStore(path);
    await store.load();

    await store.setFileViewed("src/app.ts", false);

    const written = JSON.parse(await readFile(path, "utf8"));
    expect(written.viewedFiles).toEqual(["src/other.ts"]);
  });

  it("does not duplicate a file when marking viewed twice", async () => {
    const path = await writeSession(validSession({ viewedFiles: ["src/app.ts"] }));
    const store = new SessionStore(path);
    await store.load();

    await store.setFileViewed("src/app.ts", true);

    expect(store.get().viewedFiles).toEqual(["src/app.ts"]);
  });

  it("adds a file to collapsedFiles via setFileCollapsed", async () => {
    const path = await writeSession(validSession());
    const store = new SessionStore(path);
    await store.load();

    await store.setFileCollapsed("src/app.ts", true);

    const written = JSON.parse(await readFile(path, "utf8"));
    expect(written.collapsedFiles).toEqual(["src/app.ts"]);
  });

  it("removes a file from collapsedFiles via setFileCollapsed", async () => {
    const path = await writeSession(validSession({ collapsedFiles: ["src/app.ts"] }));
    const store = new SessionStore(path);
    await store.load();

    await store.setFileCollapsed("src/app.ts", false);

    expect(store.get().collapsedFiles).toEqual([]);
  });

  it("merges GitHub viewed files into local via syncViewedFilesFromGithub without removing local entries", async () => {
    const path = await writeSession(
      validSession({ viewedFiles: ["src/local.ts"] }),
    );
    const store = new SessionStore(path);
    await store.load();

    await store.syncViewedFilesFromGithub(["src/local.ts", "src/remote.ts"]);

    const written = JSON.parse(await readFile(path, "utf8"));
    expect(written.viewedFiles.sort()).toEqual(["src/local.ts", "src/remote.ts"]);
  });

  it("does not remove locally-unviewed files when syncing from GitHub", async () => {
    const path = await writeSession(validSession({ viewedFiles: ["src/local.ts"] }));
    const store = new SessionStore(path);
    await store.load();

    await store.syncViewedFilesFromGithub([]);

    expect(store.get().viewedFiles).toEqual(["src/local.ts"]);
  });

  it("serializes viewed-file writes with the existing write queue", async () => {
    const path = await writeSession(validSession());
    const store = new SessionStore(path);
    await store.load();

    await Promise.all([
      store.setFileViewed("src/a.ts", true),
      store.setFileViewed("src/b.ts", true),
      store.setFileCollapsed("src/a.ts", true),
    ]);

    const written = JSON.parse(await readFile(path, "utf8"));
    expect(written.viewedFiles.sort()).toEqual(["src/a.ts", "src/b.ts"]);
    expect(written.collapsedFiles).toEqual(["src/a.ts"]);
  });
```

Also update the two existing server route tests at the bottom of `session.test.ts` (inside `describe("review server routes", ...)`) to include `nodeId` in their `validSession()` calls — this happens automatically since `validSession` is updated, but verify the `validSession` used in the route tests is the same helper. (It is — both use the top-level `validSession`.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- session.test.ts`
Expected: FAIL — `setFileViewed`/`setFileCollapsed`/`syncViewedFilesFromGithub` not defined.

- [ ] **Step 3: Implement the session store methods**

In `app/server/session.ts`, add three new methods to the `SessionStore` class (after `updateComment`, before the closing `}`):

```ts
  async setFileViewed(path: string, viewed: boolean) {
    const operation = this.writeQueue.then(async () => {
      const session = this.get();
      const set = new Set(session.viewedFiles);
      if (viewed) {
        set.add(path);
      } else {
        set.delete(path);
      }
      session.viewedFiles = [...set];
      await writeFile(this.path, JSON.stringify(session, null, 2));
      return session;
    });

    this.writeQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  async setFileCollapsed(path: string, collapsed: boolean) {
    const operation = this.writeQueue.then(async () => {
      const session = this.get();
      const set = new Set(session.collapsedFiles);
      if (collapsed) {
        set.add(path);
      } else {
        set.delete(path);
      }
      session.collapsedFiles = [...set];
      await writeFile(this.path, JSON.stringify(session, null, 2));
      return session;
    });

    this.writeQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  async syncViewedFilesFromGithub(viewedPaths: string[]) {
    const operation = this.writeQueue.then(async () => {
      const session = this.get();
      const set = new Set(session.viewedFiles);
      for (const path of viewedPaths) {
        set.add(path);
      }
      session.viewedFiles = [...set];
      await writeFile(this.path, JSON.stringify(session, null, 2));
      return session;
    });

    this.writeQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- session.test.ts`
Expected: PASS — all session tests green.

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/organize-pr-topics/app/server/session.ts .claude/skills/organize-pr-topics/tests/session.test.ts
git commit -m "feat: add setFileViewed, setFileCollapsed, syncViewedFilesFromGithub to SessionStore"
```

---

## Task 4: Server endpoints — `POST /api/files/viewed`, `POST /api/files/collapsed`, load-time seeding

**Files:**
- Modify: `.claude/skills/organize-pr-topics/app/server/index.ts`
- Test: `.claude/skills/organize-pr-topics/tests/viewedFiles.test.ts` (new file)

- [ ] **Step 1: Write the failing tests**

Create `.claude/skills/organize-pr-topics/tests/viewedFiles.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- viewedFiles.test.ts`
Expected: FAIL — endpoints don't exist; `buildServer` doesn't accept `markFileViewed`/`unmarkFileViewed` adapters.

- [ ] **Step 3: Implement the server changes**

In `app/server/index.ts`:

Update the imports from `./gh` to include the new functions:

```ts
import {
  fetchViewerViewedFiles,
  markFileViewed,
  unmarkFileViewed,
} from "./gh";
```

Update the imports from `./comments` (unchanged) and `../shared/schema`:

```ts
import {
  ReviewCommentSchema,
  type ReviewComment,
  type ReviewSession,
} from "../shared/schema";
```

Extend the `ReviewSessionStore` interface (add three methods):

```ts
export interface ReviewSessionStore {
  get(): ReviewSession;
  addComment(comment: ReviewComment): Promise<ReviewComment>;
  updateComment(id: string, updates: Partial<ReviewComment>): Promise<ReviewComment>;
  setFileViewed(path: string, viewed: boolean): Promise<ReviewSession>;
  setFileCollapsed(path: string, collapsed: boolean): Promise<ReviewSession>;
  syncViewedFilesFromGithub(viewedPaths: string[]): Promise<ReviewSession>;
}
```

Extend the `PostingAdapters` interface (rename to `ServerAdapters` or extend — I'll extend to keep the name stable):

```ts
export interface PostingAdapters {
  postInlineComment: typeof postInlineComment;
  postPrLevelComment: typeof postPrLevelComment;
  markFileViewed: typeof markFileViewed;
  unmarkFileViewed: typeof unmarkFileViewed;
}
```

Update the `buildServer` signature to include default adapters for the new functions:

```ts
export function buildServer(
  store: ReviewSessionStore,
  options: FastifyServerOptions = {},
  adapters: PostingAdapters = {
    postInlineComment,
    postPrLevelComment,
    markFileViewed,
    unmarkFileViewed,
  },
  guard: PostAllGuard = new PostAllGuard(),
) {
```

Add the two new endpoints after the `POST /api/comments/post-all` handler (before `app.get("/api/handoff", ...)`):

```ts
  app.post("/api/files/viewed", async (request, reply) => {
    const body =
      request.body && typeof request.body === "object" ? (request.body as Record<string, unknown>) : {};
    const path = typeof body.path === "string" ? body.path : "";
    const viewed = body.viewed === true;

    const session = store.get();
    const knownPaths = new Set(session.files.map((file) => file.path));
    if (!path || !knownPaths.has(path)) {
      return reply.status(400).send({ error: "Unknown file path" });
    }

    await store.setFileViewed(path, viewed);

    const prNodeId = store.get().pr.nodeId;
    void (viewed
      ? adapters.markFileViewed(prNodeId, path)
      : adapters.unmarkFileViewed(prNodeId, path)
    ).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      request.log.warn({ path, message }, "Failed to sync file viewed state to GitHub");
    });

    return store.get();
  });

  app.post("/api/files/collapsed", async (request, reply) => {
    const body =
      request.body && typeof request.body === "object" ? (request.body as Record<string, unknown>) : {};
    const path = typeof body.path === "string" ? body.path : "";
    const collapsed = body.collapsed === true;

    const session = store.get();
    const knownPaths = new Set(session.files.map((file) => file.path));
    if (!path || !knownPaths.has(path)) {
      return reply.status(400).send({ error: "Unknown file path" });
    }

    await store.setFileCollapsed(path, collapsed);
    return store.get();
  });
```

Update `startServer()` to seed viewed files from GitHub after `store.load()`:

```ts
export async function startServer() {
  const sessionPath = process.env.PR_TOPIC_SESSION_PATH;

  if (!sessionPath) {
    throw new Error("PR_TOPIC_SESSION_PATH is required.");
  }

  const store = new SessionStore(sessionPath);
  await store.load();

  try {
    const viewedPaths = await fetchViewerViewedFiles(store.get().pr.nodeId);
    await store.syncViewedFilesFromGithub(viewedPaths);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Failed to seed viewed files from GitHub: ${message}`);
  }

  const app = buildServer(store, { logger: true });
  await registerUiHandler(app);

  const port = Number(process.env.PORT ?? 4173);
  await app.listen({ port, host: "127.0.0.1" });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- viewedFiles.test.ts`
Expected: PASS — all endpoint tests green.

- [ ] **Step 5: Run full test suite to check for regressions**

Run: `npm test`
Expected: `posting.test.ts` may fail because it calls `buildServer(store, {}, { postInlineComment, postPrLevelComment })` without the new adapters. Fix by updating those calls to include `markFileViewed: vi.fn(), unmarkFileViewed: vi.fn()`.

In `tests/posting.test.ts`, find all `buildServer(store, {}, { postInlineComment: ..., postPrLevelComment: ... })` calls and add `markFileViewed: vi.fn(), unmarkFileViewed: vi.fn()`. There are several — update each. Example:

```ts
const app = buildServer(store, {}, {
  postInlineComment: postInline,
  postPrLevelComment: postPr,
  markFileViewed: vi.fn(),
  unmarkFileViewed: vi.fn(),
});
```

Do this for all `buildServer` calls in `posting.test.ts` and `session.test.ts` (the two route tests at the bottom of `session.test.ts` use `buildServer` without the third arg — they rely on the default, so they're fine, but verify).

Run: `npm test`
Expected: PASS — all tests green.

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`
Expected: PASS — no type errors.

- [ ] **Step 7: Commit**

```bash
git add .claude/skills/organize-pr-topics/app/server/index.ts .claude/skills/organize-pr-topics/tests/viewedFiles.test.ts .claude/skills/organize-pr-topics/tests/posting.test.ts .claude/skills/organize-pr-topics/tests/session.test.ts
git commit -m "feat: add /api/files/viewed and /api/files/collapsed endpoints with GitHub sync"
```

---

## Task 5: Update `prepare-session.mjs` — mirror schema, add `id` to JSON fields

**Files:**
- Modify: `.claude/skills/organize-pr-topics/scripts/prepare-session.mjs`
- Test: `.claude/skills/organize-pr-topics/tests/prepareSession.test.ts`

- [ ] **Step 1: Write the failing test**

In `tests/prepareSession.test.ts`, update the `PR_JSON_FIELDS` expectations to include `id`. There are two places in `describe("PR gh args", ...)`:

For the test "builds current-checkout PR commands without a selector":

```ts
  test("builds current-checkout PR commands without a selector", () => {
    expect(buildPrViewArgs()).toEqual([
      "pr",
      "view",
      "--json",
      "id,number,title,url,baseRefName,headRefName,baseRefOid,headRefOid,files,headRepositoryOwner,headRepository",
    ]);
    expect(buildPrDiffArgs()).toEqual(["pr", "diff", "--patch"]);
  });
```

For the test "builds selected PR commands with a selector":

```ts
  test("builds selected PR commands with a selector", () => {
    expect(buildPrViewArgs("123")).toEqual([
      "pr",
      "view",
      "123",
      "--json",
      "id,number,title,url,baseRefName,headRefName,baseRefOid,headRefOid,files,headRepositoryOwner,headRepository",
    ]);
    expect(buildPrDiffArgs("123")).toEqual(["pr", "diff", "123", "--patch"]);
  });
```

In the `describe("main", ...)` test, update the expected first `execFileSync` call args to include `id`:

```ts
    expect(mocks.execFileSync).toHaveBeenNthCalledWith(
      1,
      "gh",
      [
        "pr",
        "view",
        "123",
        "--json",
        "id,number,title,url,baseRefName,headRefName,baseRefOid,headRefOid,files,headRepositoryOwner,headRepository",
      ],
      { encoding: "utf8" },
    );
```

Also update the mocked `buildSessionFromGhPr` mock at the top of `prepareSession.test.ts` to include `nodeId` in the returned `pr`:

```ts
vi.mock("../app/server/gh.ts", () => ({
  buildSessionFromGhPr: (pr: { number: number; title: string; url: string }, diff: string) => ({
    pr: {
      owner: "owner",
      repo: "repo",
      number: pr.number,
      title: pr.title,
      url: pr.url,
      baseRefName: "main",
      headRefName: "feature",
      baseSha: "base-sha",
      headSha: "head-sha",
      nodeId: "PR_node1",
    },
    files: [],
    diff,
    topics: [
      {
        id: "topic-1",
        title: "Topic",
        summary: "Summary",
        rationale: "Rationale",
        files: ["file.ts"],
      },
    ],
    comments: [],
    viewedFiles: [],
    collapsedFiles: [],
  }),
}));
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- prepareSession.test.ts`
Expected: FAIL — `PR_JSON_FIELDS` doesn't include `id`, mock doesn't include `nodeId`/`viewedFiles`/`collapsedFiles`.

- [ ] **Step 3: Implement the script changes**

In `scripts/prepare-session.mjs`:

Update `PR_JSON_FIELDS` (line 56-57):

```js
const PR_JSON_FIELDS =
  "id,number,title,url,baseRefName,headRefName,baseRefOid,headRefOid,files,headRepositoryOwner,headRepository";
```

Update the duplicated `PrInfoSchema` (line 7-17) to include `nodeId`:

```js
const PrInfoSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  number: z.number().int().positive(),
  title: z.string().min(1),
  url: z.string().url(),
  baseRefName: z.string().min(1),
  headRefName: z.string().min(1),
  baseSha: z.string().min(1),
  headSha: z.string().min(1),
  nodeId: z.string().min(1),
});
```

Update the duplicated `ReviewSessionSchema` (line 48-54) to include `viewedFiles` and `collapsedFiles`:

```js
const ReviewSessionSchema = z.object({
  pr: PrInfoSchema,
  files: z.array(PrFileSchema),
  diff: z.string(),
  topics: z.array(ReviewTopicSchema).min(1),
  comments: z.array(ReviewCommentSchema),
  viewedFiles: z.array(z.string().min(1)).default([]),
  collapsedFiles: z.array(z.string().min(1)).default([]),
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- prepareSession.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: PASS — all green.

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/organize-pr-topics/scripts/prepare-session.mjs .claude/skills/organize-pr-topics/tests/prepareSession.test.ts
git commit -m "feat: thread nodeId and viewed/collapsed arrays through prepare-session schema"
```

---

## Task 6: UI — `FileCard` header redesign with collapse + viewed toggle

**Files:**
- Modify: `.claude/skills/organize-pr-topics/app/ui/components/DiffReview.tsx`
- Modify: `.claude/skills/organize-pr-topics/app/ui/App.tsx`
- Modify: `.claude/skills/organize-pr-topics/app/ui/styles.css`
- Test: `.claude/skills/organize-pr-topics/tests/diffReviewAccessibility.test.ts`

- [ ] **Step 1: Write the failing tests**

Replace the contents of `tests/diffReviewAccessibility.test.ts` with:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("DiffReview row accessibility", () => {
  it("supports keyboard activation for button-like diff rows", () => {
    const source = readFileSync("app/ui/components/DiffReview.tsx", "utf8");

    expect(source).toContain("onKeyDown");
    expect(source).toContain('event.key === "Enter"');
    expect(source).toContain('event.key === " "');
  });
});

describe("FileCard header accessibility", () => {
  const source = readFileSync("app/ui/components/DiffReview.tsx", "utf8");

  it("renders a chevron button with keyboard activation", () => {
    expect(source).toContain("file-chevron");
    expect(source).toContain("onToggleCollapsed");
  });

  it("renders a viewed toggle button", () => {
    expect(source).toContain("file-viewed-toggle");
    expect(source).toContain("onToggleViewed");
  });

  it("conditionally hides the diff body when collapsed", () => {
    expect(source).toContain("collapsedFiles");
    expect(source).toMatch(/collapsed.*&&.*null|collapsed.*\?.*null/);
  });

  it("tints the header when viewed", () => {
    const css = readFileSync("app/ui/styles.css", "utf8");
    expect(css).toContain(".file-card-header.viewed");
    expect(css).toContain(".file-viewed-toggle");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- diffReviewAccessibility.test.ts`
Expected: FAIL — new assertions about chevron, viewed toggle, collapse conditional.

- [ ] **Step 3: Implement the `DiffReview.tsx` changes**

Replace the full contents of `app/ui/components/DiffReview.tsx` with:

```tsx
import { useEffect, useState } from "react";
import type { ReviewSession, ReviewTopic } from "../../shared/schema";
import { mapUnifiedDiff, type DiffCommentTarget } from "../../shared/diff";
import type { Theme } from "../theme";
import {
  detectLanguage,
  highlightLine,
  highlightPlainText,
  type HighlightToken,
} from "../syntaxHighlight";
import { CommentComposer } from "./CommentComposer";

type Props = {
  session: ReviewSession;
  theme: Theme;
  topic: ReviewTopic;
  viewedFiles: string[];
  collapsedFiles: string[];
  onToggleViewed: (path: string, viewed: boolean) => void;
  onToggleCollapsed: (path: string, collapsed: boolean) => void;
  onCommentSaved: () => void;
};

type LineTarget = {
  line: number;
  side: "LEFT" | "RIGHT";
};

function signForRow(row: DiffCommentTarget): string {
  if (row.type === "add") return "+";
  if (row.type === "del") return "-";
  return " ";
}

export function DiffReview({
  session,
  theme,
  topic,
  viewedFiles,
  collapsedFiles,
  onToggleViewed,
  onToggleCollapsed,
  onCommentSaved,
}: Props) {
  const rowsByFile = topic.files.reduce<Record<string, DiffCommentTarget[]>>(
    (acc, file) => {
      acc[file] = [];
      return acc;
    },
    {},
  );

  for (const row of mapUnifiedDiff(session.diff)) {
    if (rowsByFile[row.path]) {
      rowsByFile[row.path].push(row);
    }
  }

  return (
    <div className="diff-review">
      {topic.files.map((file) => (
        <FileCard
          file={file}
          rows={rowsByFile[file] ?? []}
          key={file}
          theme={theme}
          topicId={topic.id}
          viewed={viewedFiles.includes(file)}
          collapsed={collapsedFiles.includes(file)}
          onToggleViewed={onToggleViewed}
          onToggleCollapsed={onToggleCollapsed}
          onCommentSaved={onCommentSaved}
        />
      ))}
    </div>
  );
}

type FileCardProps = {
  file: string;
  rows: DiffCommentTarget[];
  theme: Theme;
  topicId: string;
  viewed: boolean;
  collapsed: boolean;
  onToggleViewed: (path: string, viewed: boolean) => void;
  onToggleCollapsed: (path: string, collapsed: boolean) => void;
  onCommentSaved: () => void;
};

function FileCard({
  file,
  rows,
  theme,
  topicId,
  viewed,
  collapsed,
  onToggleViewed,
  onToggleCollapsed,
  onCommentSaved,
}: FileCardProps) {
  const [activeTarget, setActiveTarget] = useState<LineTarget | null>(null);
  const [highlightedRows, setHighlightedRows] = useState<Record<number, HighlightToken[]>>({});

  useEffect(() => {
    let cancelled = false;
    const language = detectLanguage(file);

    async function loadHighlightedRows() {
      const entries = await Promise.all(
        rows.map(async (row, index) => [
          index,
          await highlightLine(row.content, language, theme),
        ] as const),
      );

      if (!cancelled) {
        setHighlightedRows(Object.fromEntries(entries));
      }
    }

    setHighlightedRows(
      Object.fromEntries(rows.map((row, index) => [index, highlightPlainText(row.content)])),
    );
    void loadHighlightedRows();

    return () => {
      cancelled = true;
    };
  }, [file, rows, theme]);

  const toggleCollapse = () => {
    onToggleCollapsed(file, !collapsed);
  };

  const handleHeaderKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleCollapse();
    }
  };

  const toggleViewed = () => {
    onToggleViewed(file, !viewed);
  };

  const handleViewedKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleViewed();
    }
  };

  return (
    <section className="file-card">
      <header
        className={`file-card-header${viewed ? " viewed" : ""}`}
        onClick={toggleCollapse}
        onKeyDown={handleHeaderKeyDown}
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
      >
        <span className="file-chevron" aria-hidden="true">
          {collapsed ? "▶" : "▼"}
        </span>
        <span className="file-path">{file}</span>
        <button
          className={`file-viewed-toggle${viewed ? " checked" : ""}`}
          onClick={(event) => {
            event.stopPropagation();
            toggleViewed();
          }}
          onKeyDown={handleViewedKeyDown}
          type="button"
          aria-pressed={viewed}
        >
          {viewed ? "✓ Viewed" : "Viewed"}
        </button>
      </header>
      {collapsed ? null : rows.length === 0 ? (
        <p className="file-diff-empty">No diff available for {file}.</p>
      ) : (
        <div className="file-diff">
          {rows.map((row, index) => {
            const isActive =
              activeTarget?.line === row.line && activeTarget?.side === row.side;
            const tokens = highlightedRows[index] ?? highlightPlainText(row.content);
            const toggleCommentComposer = () => {
              setActiveTarget(isActive ? null : { line: row.line, side: row.side });
            };
            return (
              <div className="diff-row-group" key={`${row.side}:${row.line}:${index}`}>
                <div
                  className={`diff-row${isActive ? " selected" : ""}`}
                  onClick={toggleCommentComposer}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      toggleCommentComposer();
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <span className="diff-line-number">{row.line}</span>
                  <span className={`diff-sign diff-sign-${row.type}`}>{signForRow(row)}</span>
                  <span className="diff-content">
                    {tokens.map((token, tokenIndex) => (
                      <span
                        className="syntax-token"
                        key={`${token.content}:${tokenIndex}`}
                        style={token.color ? { color: token.color } : undefined}
                      >
                        {token.content}
                      </span>
                    ))}
                  </span>
                </div>
                {isActive ? (
                  <CommentComposer
                    topicId={topicId}
                    path={file}
                    line={activeTarget.line}
                    side={activeTarget.side}
                    onSaved={() => {
                      setActiveTarget(null);
                      onCommentSaved();
                    }}
                  />
                ) : null}
              </div>
            );
          })}
          <CommentComposer topicId={topicId} path={file} onSaved={onCommentSaved} />
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Implement the `App.tsx` changes**

In `app/ui/App.tsx`, update the `DiffReview` usage (around line 90) to pass the new props:

```tsx
          <DiffReview
            session={session}
            theme={theme}
            topic={topic}
            viewedFiles={session.viewedFiles}
            collapsedFiles={session.collapsedFiles}
            onToggleViewed={(path, viewed) => {
              fetch("/api/files/viewed", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path, viewed }),
              })
                .then((response) => {
                  if (!response.ok) throw new Error(`HTTP ${response.status}`);
                })
                .then(() => loadSession())
                .catch((err) => {
                  setError(err instanceof Error ? err.message : String(err));
                });
            }}
            onToggleCollapsed={(path, collapsed) => {
              fetch("/api/files/collapsed", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path, collapsed }),
              })
                .then((response) => {
                  if (!response.ok) throw new Error(`HTTP ${response.status}`);
                })
                .then(() => loadSession())
                .catch((err) => {
                  setError(err instanceof Error ? err.message : String(err));
                });
            }}
            onCommentSaved={loadSession}
          />
```

Note: marking viewed auto-collapses per the design decision (Q2 #1). The `onToggleViewed` handler fires the viewed endpoint, then chains a collapse fetch when `viewed` is `true`, then reloads:

```tsx
            onToggleViewed={(path, viewed) => {
              fetch("/api/files/viewed", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path, viewed }),
              })
                .then((response) => {
                  if (!response.ok) throw new Error(`HTTP ${response.status}`);
                  if (viewed) {
                    return fetch("/api/files/collapsed", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ path, collapsed: true }),
                    });
                  }
                })
                .then((response) => {
                  if (response && !response.ok) throw new Error(`HTTP ${response.status}`);
                })
                .then(() => loadSession())
                .catch((err) => {
                  setError(err instanceof Error ? err.message : String(err));
                });
            }}
```

- [ ] **Step 5: Implement the `styles.css` changes**

In `app/ui/styles.css`, update the `.file-card-header` rule (around line 182) and add new rules:

```css
.file-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-weight: 600;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 13px;
  background: var(--surface-muted);
  border-bottom: 1px solid var(--border);
  word-break: break-all;
  cursor: pointer;
  user-select: none;
}

.file-card-header.viewed {
  color: var(--success);
}

.file-card-header:hover {
  background: var(--hover);
}

.file-chevron {
  display: inline-grid;
  place-items: center;
  width: 16px;
  color: var(--muted-text);
  font-size: 12px;
  flex-shrink: 0;
}

.file-path {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-viewed-toggle {
  margin-left: auto;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--muted-text);
  cursor: pointer;
  flex-shrink: 0;
}

.file-viewed-toggle.checked {
  color: var(--success);
  border-color: var(--success);
}

.file-viewed-toggle:hover:not(.checked) {
  background: var(--hover);
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- diffReviewAccessibility.test.ts`
Expected: PASS.

- [ ] **Step 7: Run full test suite**

Run: `npm test`
Expected: PASS — all green.

- [ ] **Step 8: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add .claude/skills/organize-pr-topics/app/ui/components/DiffReview.tsx .claude/skills/organize-pr-topics/app/ui/App.tsx .claude/skills/organize-pr-topics/app/ui/styles.css .claude/skills/organize-pr-topics/tests/diffReviewAccessibility.test.ts
git commit -m "feat: collapsible file headers with viewed toggle and GitHub sync"
```

---

## Task 7: Final verification — full suite, typecheck, build

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: PASS — all tests green across all test files.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS — no type errors.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: PASS — Vite build completes without errors.

- [ ] **Step 4: Commit if any fixes were needed**

If the verification surfaced any issues that required fixes, commit them:

```bash
git add -A
git commit -m "fix: verification fixes for viewed-files feature"
```

If no fixes were needed, skip this step.

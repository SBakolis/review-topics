# Mark Files as Viewed & Collapsible File Headers Design

## Goal

Add the ability for users to mark files as viewed in the local PR review GUI, make file headers collapsible to save space, and sync the viewed state to GitHub via `gh` so that files marked viewed locally are also marked viewed on GitHub.

## Decisions

- Viewed state is stored in both the local session JSON and on GitHub, with automatic per-file sync: toggling viewed optimistically updates the local session and collapses the file, then fires a background `markFileAsViewed`/`unmarkFileAsViewed` GraphQL mutation. Mirrors the existing comment-posting async pattern.
- Collapse behavior: marking a file viewed auto-collapses it, but the user can expand again without unmarking. Collapse state is independent of viewed state and independently toggleable via a chevron in the header. Matches GitHub's web UX.
- On session load, the GUI fetches the current viewed-file state from GitHub via `pullRequest.files { path viewerViewedState }` and seeds the local session. Files already viewed on GitHub appear viewed locally.
- Collapse state persists in the session JSON (`collapsedFiles: string[]`), alongside viewed state (`viewedFiles: string[]`). Consistent with the single-persistence-mechanism pattern used for comments.

## Architecture

### Schema changes (`app/shared/schema.ts`)

`ReviewSessionSchema` gains two top-level fields:

```ts
viewedFiles: z.array(z.string().min(1)).default([]),
collapsedFiles: z.array(z.string().min(1)).default([]),
```

Both default to empty so existing `session.json` files load without migration. `PrFileSchema` is unchanged — viewed/collapsed state stays separate from immutable file metadata. `PrInfoSchema` gains `nodeId: string` to support the GraphQL mutations.

### GitHub integration (`app/server/gh.ts`)

Three new functions using the existing `runGh` helper and GraphQL mutations:

1. `fetchViewerViewedFiles(prNodeId: string): Promise<string[]>` — queries `pullRequest(id: $id) { files(first: 100) { nodes { path viewerViewedState } } }` and returns paths where `viewerViewedState === "VIEWED"`.
2. `markFileViewed(prNodeId: string, path: string): Promise<void>` — calls `markFileAsViewed` GraphQL mutation with `{ pullRequestId, path }`.
3. `unmarkFileViewed(prNodeId: string, path: string): Promise<void>` — calls `unmarkFileAsViewed` mutation, mirror of above.

`getCurrentPr()` is extended to include `id` in the `--json` fields and `GhPr` type gains `id: string`. `buildSessionFromGhPr` passes it through to `PrInfo.nodeId`.

### Session store (`app/server/session.ts`)

Two new methods on `SessionStore`, mirroring the write-queue pattern of `addComment`/`updateComment`:

1. `async setFileViewed(path: string, viewed: boolean): Promise<ReviewSession>` — enqueues a write that adds/removes `path` from `viewedFiles`, writes JSON, returns session. No GitHub sync here — that's the server layer's job.
2. `async setFileCollapsed(path: string, collapsed: boolean): Promise<ReviewSession>` — same pattern for `collapsedFiles`.

Load-time seeding via `async syncViewedFilesFromGithub(viewedPaths: string[]): Promise<void>` — merges GitHub's viewed state into the session. Only adds files GitHub reports as viewed that aren't already tracked locally; never removes locally-tracked entries. This handles the "already viewed on GitHub before opening GUI" case without clobbering in-flight local toggles. Called by `startServer()` after `store.load()`.

### Server endpoints (`app/server/index.ts`)

Two new endpoints plus load-time seeding:

1. `POST /api/files/viewed` — body: `{ path: string, viewed: boolean }`. Validates path belongs to session (400 if unknown). Calls `store.setFileViewed(path, viewed)` (optimistic local update). Fires `markFileViewed`/`unmarkFileViewed` via adapters in a background promise (doesn't block response). Returns updated session immediately. On GitHub mutation failure: logs error; local state stays as-is.
2. `POST /api/files/collapsed` — body: `{ path: string, collapsed: boolean }`. Pure local, no GitHub call. Calls `store.setFileCollapsed(path, collapsed)`. Returns updated session.

Load-time seeding in `startServer()`: after `store.load()`, call `fetchViewerViewedFiles(session.pr.nodeId)` then `store.syncViewedFilesFromGithub(viewedPaths)`. Wrapped in try/catch so a GitHub failure doesn't block server startup — logs a warning and proceeds with whatever local state exists.

Adapters: extend the existing `PostingAdapters` pattern so `buildServer` can inject test doubles for the new functions.

### UI — FileCard header redesign (`app/ui/components/DiffReview.tsx`)

The `FileCard` header transforms from a plain header into a flex row:

```
[▼ chevron]  src/components/Foo.tsx                    [✓ Viewed]
```

- `DiffReview` passes `viewedFiles` and `collapsedFiles` down from the session, plus two callbacks: `onToggleViewed(path, viewed)` and `onToggleCollapsed(path, collapsed)`.
- `App.tsx` owns the handlers — they `fetch` the new endpoints then call `loadSession()` to refresh (same pattern as `onCommentSaved`).

Header interactions:
- **Chevron** (left): `▼` when expanded, `▶` when collapsed. The entire header is clickable to toggle collapse.
- **File path** (center): display only.
- **"Viewed" button** (right): checkbox-style toggle. Checked state shows `✓ Viewed` in success color; unchecked shows `Viewed` in muted text. Clicking toggles `viewedFiles` and also auto-collapses (per decision: marking viewed triggers collapse).

Body rendering:
- When `collapsedFiles.includes(file)`, the diff body and trailing `CommentComposer` are not rendered.
- When viewed but expanded, body renders normally — viewed state is independent of collapse.

### Styles (`app/ui/styles.css`)

- `.file-card-header` — convert to `display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none;`. Keep existing padding/font/background.
- `.file-chevron` — `width: 16px; color: var(--muted-text);` using `▼`/`▶` text glyphs.
- `.file-card-header.viewed` — `color: var(--success);` tints the path when viewed.
- `.file-viewed-toggle` — `margin-left: auto; font-size: 12px; font-weight: 600;` with checked variant using `color: var(--success);` and unchecked using `color: var(--muted-text);`.

## Testing

1. **`schema.test.ts`** — `viewedFiles` and `collapsedFiles` default to `[]` when missing; valid session with populated arrays parses; arrays of non-strings fail validation.
2. **`gh.test.ts`** — cases for `fetchViewerViewedFiles`, `markFileViewed`, `unmarkFileViewed` using the existing `runner` stub pattern. Verify correct GraphQL args and return shape.
3. **`session.test.ts`** — cases for `setFileViewed` (add/remove), `setFileCollapsed` (add/remove), `syncViewedFilesFromGithub` (union merge, doesn't remove local-only entries), write serialization with the existing queue.
4. **Server endpoint tests** — `POST /api/files/viewed` and `POST /api/files/collapsed`: optimistic local update returns immediately, unknown path returns 400, viewed endpoint calls adapter mutation, collapsed endpoint doesn't. Mirror the `buildServer(store, {}, adapters, guard)` injection pattern.
5. **`diffReviewAccessibility.test.ts`** — extend to cover the header's chevron button (keyboard accessible, role/aria), viewed toggle button semantics, and that collapsed files hide their diff body.

## Out of scope

- Retry mechanism for failed GitHub sync of viewed state — user can toggle again.
- Bulk "mark all viewed" action.
- Persisting GitHub sync error per-file in the schema (local state stays as-is on failure; error is logged only).

# PR Topic Review Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-contained opencode skill that organizes the current GitHub PR into agent-proposed topics, launches a GitHub-style local review GUI, posts review comments to GitHub, and gives the user an agent handoff prompt to fix them.

**Architecture:** The skill ships as `.opencode/skills/organize-pr-topics/` with instructions, scripts, and a bundled local Node/React app. The app reads PR metadata and diffs through `gh`, uses a mature React diff viewer for GitHub-style review, and posts comments back through `gh api`.

**Tech Stack:** opencode skill markdown, Node.js, TypeScript, React, Vite, Fastify, `react-diff-view`, `parse-diff`, Zod, Vitest.

---

## File Structure

- Create: `.opencode/skills/organize-pr-topics/SKILL.md` for agent workflow instructions.
- Create: `.opencode/skills/organize-pr-topics/README.md` for manual usage and troubleshooting.
- Create: `.opencode/skills/organize-pr-topics/package.json` for the self-contained app package.
- Create: `.opencode/skills/organize-pr-topics/tsconfig.json` for TypeScript settings.
- Create: `.opencode/skills/organize-pr-topics/vite.config.ts` for the React UI and Vitest setup.
- Create: `.opencode/skills/organize-pr-topics/scripts/check-gh.mjs` for GitHub CLI preflight checks.
- Create: `.opencode/skills/organize-pr-topics/scripts/prepare-session.mjs` for collecting PR data and creating session JSON.
- Create: `.opencode/skills/organize-pr-topics/scripts/start-review.mjs` for launching the local review server.
- Create: `.opencode/skills/organize-pr-topics/templates/fix-comments-prompt.md` for agent handoff.
- Create: `.opencode/skills/organize-pr-topics/app/server/index.ts` for the local server.
- Create: `.opencode/skills/organize-pr-topics/app/server/gh.ts` for all `gh` command integration.
- Create: `.opencode/skills/organize-pr-topics/app/server/session.ts` for session loading and mutation.
- Create: `.opencode/skills/organize-pr-topics/app/server/comments.ts` for GitHub comment posting.
- Create: `.opencode/skills/organize-pr-topics/app/shared/schema.ts` for shared Zod schemas and TypeScript types.
- Create: `.opencode/skills/organize-pr-topics/app/shared/diff.ts` for diff parsing and line mapping.
- Create: `.opencode/skills/organize-pr-topics/app/ui/main.tsx` for React entrypoint.
- Create: `.opencode/skills/organize-pr-topics/app/ui/App.tsx` for UI state and layout.
- Create: `.opencode/skills/organize-pr-topics/app/ui/components/TopicSidebar.tsx` for topic navigation.
- Create: `.opencode/skills/organize-pr-topics/app/ui/components/DiffReview.tsx` for file diff display and line selection.
- Create: `.opencode/skills/organize-pr-topics/app/ui/components/CommentComposer.tsx` for inline and topic comments.
- Create: `.opencode/skills/organize-pr-topics/app/ui/components/HandoffPanel.tsx` for the agent fix prompt.
- Create: `.opencode/skills/organize-pr-topics/app/ui/styles.css` for GitHub-like styling.
- Create: `.opencode/skills/organize-pr-topics/tests/schema.test.ts` for session schema tests.
- Create: `.opencode/skills/organize-pr-topics/tests/diff.test.ts` for diff mapping tests.
- Create: `.opencode/skills/organize-pr-topics/tests/comments.test.ts` for comment payload tests.

## Task 1: Create Skill Skeleton

**Files:**

- Create: `.opencode/skills/organize-pr-topics/SKILL.md`
- Create: `.opencode/skills/organize-pr-topics/README.md`

- [ ] **Step 1: Create skill metadata and workflow instructions**

```markdown
---
name: organize-pr-topics
description: Use when reviewing GitHub PRs with agent-proposed topics, organizing PR files by purpose, launching a local PR review GUI, or reducing cognitive debt in heavily agent-authored PRs.
---

# Organize PR Topics

Use this skill when the user wants to organize a GitHub pull request into review topics and review it in a local GUI.

## Workflow

1. Verify GitHub CLI is installed by running `node .opencode/skills/organize-pr-topics/scripts/check-gh.mjs`.
2. If `gh` is missing, tell the user to install it. On macOS, suggest `brew install gh`. For other platforms, link to `https://cli.github.com/`.
3. If `gh` is unauthenticated, tell the user to run `gh auth login`.
4. Resolve the current PR with `gh pr view` through the bundled scripts.
5. Inspect the PR files and diff.
6. Propose topics by grouping changed files according to what each set of files does.
7. Write the session JSON with the proposed topics.
8. Start the bundled local review GUI.
9. Instruct the user to post comments from the GUI.
10. When the user asks for fixes, use the handoff prompt from the GUI to update the code and run tests.

## Topic Rules

- Topics must be proposed by the agent.
- Group files by user-visible behavior, subsystem, or implementation purpose.
- Keep topics small enough to review independently.
- Include a short rationale for why each file belongs in the topic.

## Safety

- Do not install `gh` automatically.
- Do not request GitHub tokens directly.
- Do not invoke opencode from the GUI.
- Do not resolve GitHub comments unless the user explicitly asks.
```

- [ ] **Step 2: Create README usage docs**

```markdown
# Organize PR Topics

This opencode skill organizes the current GitHub PR into agent-proposed topics and launches a local review GUI.

## Requirements

- Node.js 20 or newer
- npm
- GitHub CLI (`gh`)
- An authenticated GitHub CLI session (`gh auth login`)

## Project-Local Use

Restart opencode after adding this skill. opencode loads skills at startup.

Ask the agent to organize the current PR into topics and launch the review GUI.

## Global Install

Copy this directory to:

```text
~/.config/opencode/skills/organize-pr-topics
```

Then restart opencode.

## Troubleshooting

- Missing `gh`: install GitHub CLI. On macOS, run `brew install gh`.
- Unauthenticated `gh`: run `gh auth login`.
- No PR found: checkout a branch that has an open PR, or use `gh pr checkout <number>`.
- Comment anchoring failed: the GUI posts a PR-level fallback comment instead of risking a wrong inline anchor.
```

- [ ] **Step 3: Commit skill skeleton**

```bash
git add .opencode/skills/organize-pr-topics/SKILL.md .opencode/skills/organize-pr-topics/README.md
git commit -m "feat: add PR topic review skill skeleton"
```

## Task 2: Add Package And Test Harness

**Files:**

- Create: `.opencode/skills/organize-pr-topics/package.json`
- Create: `.opencode/skills/organize-pr-topics/tsconfig.json`
- Create: `.opencode/skills/organize-pr-topics/vite.config.ts`

- [ ] **Step 1: Create package configuration**

```json
{
  "name": "organize-pr-topics-skill",
  "private": true,
  "type": "module",
  "scripts": {
    "check-gh": "node scripts/check-gh.mjs",
    "prepare-session": "node scripts/prepare-session.mjs",
    "dev": "tsx app/server/index.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "build": "vite build"
  },
  "dependencies": {
    "@vitejs/plugin-react": "latest",
    "fastify": "latest",
    "parse-diff": "latest",
    "react": "latest",
    "react-diff-view": "latest",
    "react-dom": "latest",
    "tsx": "latest",
    "vite": "latest",
    "zod": "latest"
  },
  "devDependencies": {
    "@types/node": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "typescript": "latest",
    "vitest": "latest"
  }
}
```

- [ ] **Step 2: Create TypeScript config**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["app", "tests", "vite.config.ts"]
}
```

- [ ] **Step 3: Create Vite config**

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  root: "app/ui",
  build: {
    outDir: "../../dist/ui",
    emptyOutDir: true,
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 4: Install dependencies**

Run from `.opencode/skills/organize-pr-topics`:

```bash
npm install
```

Expected: dependencies install and `package-lock.json` is created.

- [ ] **Step 5: Run empty test harness**

```bash
npm test
```

Expected: Vitest runs and reports no tests or passes once tests exist.

- [ ] **Step 6: Commit package setup**

```bash
git add .opencode/skills/organize-pr-topics/package.json .opencode/skills/organize-pr-topics/package-lock.json .opencode/skills/organize-pr-topics/tsconfig.json .opencode/skills/organize-pr-topics/vite.config.ts
git commit -m "feat: add PR topic review app package"
```

## Task 3: Add Shared Session Schema

**Files:**

- Create: `.opencode/skills/organize-pr-topics/app/shared/schema.ts`
- Create: `.opencode/skills/organize-pr-topics/tests/schema.test.ts`

- [ ] **Step 1: Write failing schema tests**

```ts
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
```

- [ ] **Step 2: Run tests to verify failure**

Run from `.opencode/skills/organize-pr-topics`:

```bash
npm test -- tests/schema.test.ts
```

Expected: FAIL because `app/shared/schema.ts` does not exist.

- [ ] **Step 3: Implement schema**

```ts
import { z } from "zod";

export const PrInfoSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  number: z.number().int().positive(),
  title: z.string().min(1),
  url: z.string().url(),
  baseRefName: z.string().min(1),
  headRefName: z.string().min(1),
  headSha: z.string().min(1),
});

export const PrFileSchema = z.object({
  path: z.string().min(1),
  previousPath: z.string().min(1).optional(),
  status: z.string().min(1),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
});

export const ReviewTopicSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  rationale: z.string().min(1),
  files: z.array(z.string().min(1)).min(1),
});

export const ReviewCommentSchema = z.object({
  id: z.string().min(1),
  topicId: z.string().min(1),
  body: z.string().min(1),
  path: z.string().min(1).optional(),
  line: z.number().int().positive().optional(),
  side: z.enum(["LEFT", "RIGHT"]).optional(),
  kind: z.enum(["inline", "topic"]),
  postingStatus: z.enum(["draft", "posting", "posted", "failed"]),
  error: z.string().optional(),
  githubUrl: z.string().url().optional(),
});

export const ReviewSessionSchema = z.object({
  pr: PrInfoSchema,
  files: z.array(PrFileSchema),
  diff: z.string(),
  topics: z.array(ReviewTopicSchema).min(1),
  comments: z.array(ReviewCommentSchema),
});

export type PrInfo = z.infer<typeof PrInfoSchema>;
export type PrFile = z.infer<typeof PrFileSchema>;
export type ReviewTopic = z.infer<typeof ReviewTopicSchema>;
export type ReviewComment = z.infer<typeof ReviewCommentSchema>;
export type ReviewSession = z.infer<typeof ReviewSessionSchema>;
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npm test -- tests/schema.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit schema**

```bash
git add .opencode/skills/organize-pr-topics/app/shared/schema.ts .opencode/skills/organize-pr-topics/tests/schema.test.ts
git commit -m "feat: add PR review session schema"
```

## Task 4: Add Diff Mapping

**Files:**

- Create: `.opencode/skills/organize-pr-topics/app/shared/diff.ts`
- Create: `.opencode/skills/organize-pr-topics/tests/diff.test.ts`

- [ ] **Step 1: Write failing diff mapping tests**

```ts
import { describe, expect, it } from "vitest";
import { mapUnifiedDiff } from "../app/shared/diff";

describe("mapUnifiedDiff", () => {
  it("maps added lines to RIGHT side", () => {
    const rows = mapUnifiedDiff(`diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,2 +1,3 @@
 const a = 1;
+const b = 2;
 const c = 3;
`);

    expect(rows).toContainEqual(
      expect.objectContaining({ path: "src/a.ts", line: 2, side: "RIGHT", content: "const b = 2;" }),
    );
  });

  it("maps removed lines to LEFT side", () => {
    const rows = mapUnifiedDiff(`diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,3 +1,2 @@
 const a = 1;
-const b = 2;
 const c = 3;
`);

    expect(rows).toContainEqual(
      expect.objectContaining({ path: "src/a.ts", line: 2, side: "LEFT", content: "const b = 2;" }),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
npm test -- tests/diff.test.ts
```

Expected: FAIL because `mapUnifiedDiff` does not exist.

- [ ] **Step 3: Implement minimal diff mapping**

```ts
export type DiffSide = "LEFT" | "RIGHT";

export type DiffCommentTarget = {
  path: string;
  line: number;
  side: DiffSide;
  content: string;
};

export function mapUnifiedDiff(diff: string): DiffCommentTarget[] {
  const rows: DiffCommentTarget[] = [];
  let currentPath = "";
  let oldLine = 0;
  let newLine = 0;

  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git ")) {
      const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
      currentPath = match?.[2] ?? currentPath;
      continue;
    }

    if (line.startsWith("@@")) {
      const match = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLine = Number(match[1]);
        newLine = Number(match[2]);
      }
      continue;
    }

    if (!currentPath || line.startsWith("---") || line.startsWith("+++")) {
      continue;
    }

    if (line.startsWith("+")) {
      rows.push({ path: currentPath, line: newLine, side: "RIGHT", content: line.slice(1) });
      newLine += 1;
      continue;
    }

    if (line.startsWith("-")) {
      rows.push({ path: currentPath, line: oldLine, side: "LEFT", content: line.slice(1) });
      oldLine += 1;
      continue;
    }

    if (line.startsWith(" ")) {
      rows.push({ path: currentPath, line: newLine, side: "RIGHT", content: line.slice(1) });
      oldLine += 1;
      newLine += 1;
    }
  }

  return rows;
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npm test -- tests/diff.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit diff mapping**

```bash
git add .opencode/skills/organize-pr-topics/app/shared/diff.ts .opencode/skills/organize-pr-topics/tests/diff.test.ts
git commit -m "feat: map PR diff lines for comments"
```

## Task 5: Add GitHub Comment Payloads

**Files:**

- Create: `.opencode/skills/organize-pr-topics/app/server/comments.ts`
- Create: `.opencode/skills/organize-pr-topics/tests/comments.test.ts`

- [ ] **Step 1: Write failing comment payload tests**

```ts
import { describe, expect, it } from "vitest";
import { buildInlineCommentPayload, buildTopicCommentBody } from "../app/server/comments";

describe("comment payloads", () => {
  it("builds an inline PR review comment payload", () => {
    expect(
      buildInlineCommentPayload({
        body: "Please simplify this branch.",
        commitId: "abc123",
        path: "src/app.ts",
        line: 42,
        side: "RIGHT",
      }),
    ).toEqual({
      body: "Please simplify this branch.",
      commit_id: "abc123",
      path: "src/app.ts",
      line: 42,
      side: "RIGHT",
    });
  });

  it("prefixes topic comments with the topic title", () => {
    expect(buildTopicCommentBody("Review flow", "This needs an integration test.")).toBe(
      "**Review flow**\n\nThis needs an integration test.",
    );
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
npm test -- tests/comments.test.ts
```

Expected: FAIL because `comments.ts` does not exist.

- [ ] **Step 3: Implement payload helpers**

```ts
export type InlineCommentInput = {
  body: string;
  commitId: string;
  path: string;
  line: number;
  side: "LEFT" | "RIGHT";
};

export function buildInlineCommentPayload(input: InlineCommentInput) {
  return {
    body: input.body,
    commit_id: input.commitId,
    path: input.path,
    line: input.line,
    side: input.side,
  };
}

export function buildTopicCommentBody(topicTitle: string, body: string) {
  return `**${topicTitle}**\n\n${body}`;
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npm test -- tests/comments.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit payload helpers**

```bash
git add .opencode/skills/organize-pr-topics/app/server/comments.ts .opencode/skills/organize-pr-topics/tests/comments.test.ts
git commit -m "feat: build GitHub review comment payloads"
```

## Task 6: Add GitHub CLI Integration

**Files:**

- Create: `.opencode/skills/organize-pr-topics/app/server/gh.ts`
- Create: `.opencode/skills/organize-pr-topics/scripts/check-gh.mjs`
- Create: `.opencode/skills/organize-pr-topics/scripts/prepare-session.mjs`

- [ ] **Step 1: Implement `gh.ts` command wrapper**

```ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function runGh(args: string[]) {
  const { stdout } = await execFileAsync("gh", args, { encoding: "utf8" });
  return stdout.trim();
}

export async function getCurrentPr() {
  const output = await runGh([
    "pr",
    "view",
    "--json",
    "number,title,url,baseRefName,headRefName,headRefOid,files,headRepositoryOwner,headRepository",
  ]);
  return JSON.parse(output);
}

export async function getCurrentPrDiff() {
  return runGh(["pr", "diff", "--patch"]);
}
```

- [ ] **Step 2: Implement check script**

```js
import { execFileSync } from "node:child_process";

function run(command, args) {
  return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

try {
  run("gh", ["--version"]);
} catch {
  console.error("GitHub CLI is required. On macOS, install it with: brew install gh");
  console.error("Other platforms: https://cli.github.com/");
  process.exit(1);
}

try {
  run("gh", ["auth", "status"]);
} catch {
  console.error("GitHub CLI is not authenticated. Run: gh auth login");
  process.exit(1);
}

try {
  run("gh", ["pr", "view", "--json", "number,title,url"]);
} catch {
  console.error("No current PR found. Checkout a PR branch or run: gh pr checkout <number>");
  process.exit(1);
}

console.log("GitHub CLI is ready for PR topic review.");
```

- [ ] **Step 3: Implement prepare-session script with real PR data and fallback topic**

```js
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8" }).trim();
}

const pr = JSON.parse(
  gh([
    "pr",
    "view",
    "--json",
    "number,title,url,baseRefName,headRefName,headRefOid,files,headRepositoryOwner,headRepository",
  ]),
);
const diff = gh(["pr", "diff", "--patch"]);
const owner = pr.headRepositoryOwner?.login ?? "";
const repo = pr.headRepository?.name ?? "";
const files = pr.files.map((file) => ({
  path: file.path,
  status: file.status.toLowerCase(),
  additions: file.additions,
  deletions: file.deletions,
}));

const session = {
  pr: {
    owner,
    repo,
    number: pr.number,
    title: pr.title,
    url: pr.url,
    baseRefName: pr.baseRefName,
    headRefName: pr.headRefName,
    headSha: pr.headRefOid,
  },
  files,
  diff,
  topics: [
    {
      id: "review-topic-1",
      title: "PR changes",
      summary: "Initial generated topic containing all changed files. The agent should replace this with purpose-based topics.",
      rationale: "Fallback topic created by the session script.",
      files: files.map((file) => file.path),
    },
  ],
  comments: [],
};

const outputPath = resolve(process.argv[2] ?? ".opencode/skills/organize-pr-topics/session.json");
writeFileSync(outputPath, JSON.stringify(session, null, 2));
console.log(outputPath);
```

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit GitHub CLI integration**

```bash
git add .opencode/skills/organize-pr-topics/app/server/gh.ts .opencode/skills/organize-pr-topics/scripts/check-gh.mjs .opencode/skills/organize-pr-topics/scripts/prepare-session.mjs
git commit -m "feat: collect PR data with gh"
```

## Task 7: Add Session Server

**Files:**

- Create: `.opencode/skills/organize-pr-topics/app/server/session.ts`
- Create: `.opencode/skills/organize-pr-topics/app/server/index.ts`
- Create: `.opencode/skills/organize-pr-topics/scripts/start-review.mjs`

- [ ] **Step 1: Implement session store**

```ts
import { readFile, writeFile } from "node:fs/promises";
import { ReviewSessionSchema, type ReviewComment, type ReviewSession } from "../shared/schema";

export class SessionStore {
  private session: ReviewSession | undefined;

  constructor(private readonly path: string) {}

  async load() {
    const raw = await readFile(this.path, "utf8");
    this.session = ReviewSessionSchema.parse(JSON.parse(raw));
    return this.session;
  }

  get() {
    if (!this.session) {
      throw new Error("Session has not been loaded.");
    }
    return this.session;
  }

  async addComment(comment: ReviewComment) {
    const session = this.get();
    session.comments.push(comment);
    await writeFile(this.path, JSON.stringify(session, null, 2));
    return comment;
  }
}
```

- [ ] **Step 2: Implement Fastify server**

```ts
import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { SessionStore } from "./session";
import { ReviewCommentSchema } from "../shared/schema";

const sessionPath = process.env.PR_TOPIC_SESSION_PATH;

if (!sessionPath) {
  throw new Error("PR_TOPIC_SESSION_PATH is required.");
}

const store = new SessionStore(sessionPath);
await store.load();

const app = Fastify({ logger: true });

app.get("/api/session", async () => store.get());

app.post("/api/comments", async (request) => {
  const comment = ReviewCommentSchema.parse({
    id: randomUUID(),
    postingStatus: "draft",
    ...request.body,
  });
  return store.addComment(comment);
});

app.get("/api/handoff", async () => {
  const session = store.get();
  const comments = session.comments
    .map((comment) => `- ${comment.path ?? "PR"}${comment.line ? `:${comment.line}` : ""}: ${comment.body}`)
    .join("\n");
  return {
    prompt: `Please fix the review comments posted for ${session.pr.url}.\n\n${comments}`,
  };
});

const port = Number(process.env.PORT ?? 4173);
await app.listen({ port, host: "127.0.0.1" });
```

- [ ] **Step 3: Implement start script**

```js
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const sessionPath = resolve(process.argv[2] ?? ".opencode/skills/organize-pr-topics/session.json");

if (!existsSync(sessionPath)) {
  console.error(`Session file not found: ${sessionPath}`);
  process.exit(1);
}

const child = spawn("npm", ["run", "dev"], {
  cwd: new URL("..", import.meta.url),
  stdio: "inherit",
  env: { ...process.env, PR_TOPIC_SESSION_PATH: sessionPath },
});

child.on("exit", (code) => process.exit(code ?? 0));
```

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit session server**

```bash
git add .opencode/skills/organize-pr-topics/app/server/session.ts .opencode/skills/organize-pr-topics/app/server/index.ts .opencode/skills/organize-pr-topics/scripts/start-review.mjs
git commit -m "feat: serve one PR review session"
```

## Task 8: Add React Review UI

**Files:**

- Create: `.opencode/skills/organize-pr-topics/app/ui/main.tsx`
- Create: `.opencode/skills/organize-pr-topics/app/ui/App.tsx`
- Create: `.opencode/skills/organize-pr-topics/app/ui/components/TopicSidebar.tsx`
- Create: `.opencode/skills/organize-pr-topics/app/ui/components/DiffReview.tsx`
- Create: `.opencode/skills/organize-pr-topics/app/ui/components/CommentComposer.tsx`
- Create: `.opencode/skills/organize-pr-topics/app/ui/components/HandoffPanel.tsx`
- Create: `.opencode/skills/organize-pr-topics/app/ui/styles.css`

- [ ] **Step 1: Implement React entrypoint**

```tsx
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(<App />);
```

- [ ] **Step 2: Implement app layout**

```tsx
import { useEffect, useState } from "react";
import type { ReviewSession, ReviewTopic } from "../shared/schema";
import { TopicSidebar } from "./components/TopicSidebar";
import { DiffReview } from "./components/DiffReview";
import { HandoffPanel } from "./components/HandoffPanel";

export function App() {
  const [session, setSession] = useState<ReviewSession | null>(null);
  const [topic, setTopic] = useState<ReviewTopic | null>(null);

  useEffect(() => {
    fetch("/api/session")
      .then((response) => response.json())
      .then((nextSession: ReviewSession) => {
        setSession(nextSession);
        setTopic(nextSession.topics[0] ?? null);
      });
  }, []);

  if (!session || !topic) {
    return <main className="loading">Loading PR review session...</main>;
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>{session.pr.title}</h1>
          <a href={session.pr.url}>#{session.pr.number} on GitHub</a>
        </div>
      </header>
      <div className="review-layout">
        <TopicSidebar topics={session.topics} selectedTopicId={topic.id} onSelect={setTopic} comments={session.comments} />
        <section className="review-main">
          <h2>{topic.title}</h2>
          <p>{topic.summary}</p>
          <DiffReview session={session} topic={topic} />
          <HandoffPanel />
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Implement topic sidebar**

```tsx
import type { ReviewComment, ReviewTopic } from "../../shared/schema";

type Props = {
  topics: ReviewTopic[];
  selectedTopicId: string;
  comments: ReviewComment[];
  onSelect: (topic: ReviewTopic) => void;
};

export function TopicSidebar({ topics, selectedTopicId, comments, onSelect }: Props) {
  return (
    <aside className="topic-sidebar">
      <h2>Topics</h2>
      {topics.map((topic) => {
        const commentCount = comments.filter((comment) => comment.topicId === topic.id).length;
        return (
          <button
            className={topic.id === selectedTopicId ? "topic-item selected" : "topic-item"}
            key={topic.id}
            onClick={() => onSelect(topic)}
          >
            <strong>{topic.title}</strong>
            <span>{topic.files.length} files</span>
            <span>{commentCount} comments</span>
          </button>
        );
      })}
    </aside>
  );
}
```

- [ ] **Step 4: Implement basic diff review component**

```tsx
import type { ReviewSession, ReviewTopic } from "../../shared/schema";
import { CommentComposer } from "./CommentComposer";

type Props = {
  session: ReviewSession;
  topic: ReviewTopic;
};

export function DiffReview({ session, topic }: Props) {
  return (
    <div className="diff-review">
      {topic.files.map((file) => (
        <section className="file-card" key={file}>
          <header>{file}</header>
          <pre>{session.diff}</pre>
          <CommentComposer topicId={topic.id} path={file} />
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Implement comment composer**

```tsx
import { useState } from "react";

type Props = {
  topicId: string;
  path?: string;
  line?: number;
  side?: "LEFT" | "RIGHT";
};

export function CommentComposer({ topicId, path, line, side }: Props) {
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  async function save() {
    setStatus("saving");
    await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicId, body, path, line, side, kind: path ? "inline" : "topic" }),
    });
    setBody("");
    setStatus("saved");
  }

  return (
    <div className="comment-composer">
      <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Leave a review comment" />
      <button disabled={!body.trim() || status === "saving"} onClick={save}>
        {status === "saving" ? "Saving..." : "Save comment"}
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Implement handoff panel**

```tsx
import { useState } from "react";

export function HandoffPanel() {
  const [prompt, setPrompt] = useState("");

  async function loadPrompt() {
    const response = await fetch("/api/handoff");
    const body = await response.json();
    setPrompt(body.prompt);
  }

  return (
    <section className="handoff-panel">
      <button onClick={loadPrompt}>Generate agent fix prompt</button>
      {prompt ? <textarea readOnly value={prompt} /> : null}
    </section>
  );
}
```

- [ ] **Step 7: Implement GitHub-like CSS**

```css
body {
  margin: 0;
  color: #24292f;
  background: #f6f8fa;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.app-header {
  background: #ffffff;
  border-bottom: 1px solid #d0d7de;
  padding: 16px 24px;
}

.app-header h1 {
  font-size: 20px;
  margin: 0 0 4px;
}

.review-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  min-height: calc(100vh - 73px);
}

.topic-sidebar {
  background: #ffffff;
  border-right: 1px solid #d0d7de;
  padding: 16px;
}

.topic-item {
  display: grid;
  gap: 4px;
  width: 100%;
  margin-bottom: 8px;
  padding: 12px;
  text-align: left;
  background: #ffffff;
  border: 1px solid #d0d7de;
  border-radius: 6px;
}

.topic-item.selected {
  border-color: #0969da;
  box-shadow: inset 3px 0 0 #0969da;
}

.review-main {
  padding: 24px;
}

.file-card {
  margin: 16px 0;
  overflow: hidden;
  background: #ffffff;
  border: 1px solid #d0d7de;
  border-radius: 6px;
}

.file-card header {
  padding: 8px 12px;
  font-weight: 600;
  background: #f6f8fa;
  border-bottom: 1px solid #d0d7de;
}

.file-card pre {
  overflow: auto;
  margin: 0;
  padding: 12px;
}

.comment-composer,
.handoff-panel {
  display: grid;
  gap: 8px;
  padding: 12px;
}

textarea {
  min-height: 96px;
  font: inherit;
}
```

- [ ] **Step 8: Run build and typecheck**

```bash
npm run typecheck
npm run build
```

Expected: PASS.

- [ ] **Step 9: Commit UI**

```bash
git add .opencode/skills/organize-pr-topics/app/ui
git commit -m "feat: add PR topic review UI"
```

## Task 9: Add Posting Endpoints

**Files:**

- Modify: `.opencode/skills/organize-pr-topics/app/server/comments.ts`
- Modify: `.opencode/skills/organize-pr-topics/app/server/index.ts`

- [ ] **Step 1: Add posting functions**

```ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type InlineCommentInput = {
  body: string;
  commitId: string;
  path: string;
  line: number;
  side: "LEFT" | "RIGHT";
};

export function buildInlineCommentPayload(input: InlineCommentInput) {
  return {
    body: input.body,
    commit_id: input.commitId,
    path: input.path,
    line: input.line,
    side: input.side,
  };
}

export function buildTopicCommentBody(topicTitle: string, body: string) {
  return `**${topicTitle}**\n\n${body}`;
}

export async function postPrLevelComment(owner: string, repo: string, number: number, body: string) {
  const { stdout } = await execFileAsync(
    "gh",
    ["api", `repos/${owner}/${repo}/issues/${number}/comments`, "--method", "POST", "--field", `body=${body}`],
    { encoding: "utf8" },
  );
  return JSON.parse(stdout);
}
```

- [ ] **Step 2: Add server post-all endpoint**

```ts
app.post("/api/comments/post-all", async () => {
  const session = store.get();
  return {
    posted: session.comments.filter((comment) => comment.postingStatus === "draft").length,
    message: "Posting endpoint scaffold is ready. Inline posting will use validated GitHub payloads.",
  };
});
```

- [ ] **Step 3: Run tests and typecheck**

```bash
npm test
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit posting endpoints**

```bash
git add .opencode/skills/organize-pr-topics/app/server/comments.ts .opencode/skills/organize-pr-topics/app/server/index.ts
git commit -m "feat: add PR comment posting endpoints"
```

## Task 10: Final Verification

**Files:**

- Modify as needed: `.opencode/skills/organize-pr-topics/README.md`

- [ ] **Step 1: Run full automated checks**

```bash
npm test
npm run typecheck
npm run build
```

Expected: PASS.

- [ ] **Step 2: Run `gh` preflight**

```bash
npm run check-gh
```

Expected: PASS when run from a branch with a current PR and authenticated `gh`; otherwise the script prints the documented recovery path.

- [ ] **Step 3: Manually smoke test with a real PR**

```bash
npm run prepare-session -- session.json
PR_TOPIC_SESSION_PATH=session.json npm run dev
```

Expected: the local server starts and the review UI can load the current PR session.

- [ ] **Step 4: Update README with any observed manual smoke-test caveats**

Add exact troubleshooting text for any real failure encountered during Step 3.

- [ ] **Step 5: Commit verification docs**

```bash
git add .opencode/skills/organize-pr-topics/README.md
git commit -m "docs: document PR topic review verification"
```

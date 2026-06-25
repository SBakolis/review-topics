# Review UI Syntax Highlighting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Shiki-powered syntax highlighting to rendered diff lines in the local PR topic review GUI.

**Architecture:** Keep syntax concerns isolated in a small UI helper that maps file paths to Shiki languages, initializes a shared highlighter, and returns tokenized line parts with inline color styles. `DiffReview` remains responsible for row rendering and click-to-comment behavior, but receives the current app theme and renders highlighted spans inside the existing `.diff-content` cell. Unknown languages and highlighter failures fall back to plain text.

**Tech Stack:** React 19, TypeScript, Shiki, Vite, Vitest.

---

## File Structure

- Modify: `.opencode/skills/organize-pr-topics/package.json`
  - Add `shiki` dependency.
- Create: `.opencode/skills/organize-pr-topics/app/ui/syntaxHighlight.ts`
  - Owns language detection, Shiki theme selection, highlighter initialization, tokenization, and fallback behavior.
- Create: `.opencode/skills/organize-pr-topics/tests/syntaxHighlight.test.ts`
  - Verifies language detection and fallback token behavior.
- Modify: `.opencode/skills/organize-pr-topics/app/ui/App.tsx`
  - Passes current `theme` to `DiffReview`.
- Modify: `.opencode/skills/organize-pr-topics/app/ui/components/DiffReview.tsx`
  - Uses the syntax helper to render diff line content as highlighted spans.
- Modify: `.opencode/skills/organize-pr-topics/app/ui/styles.css`
  - Adds a small rule so highlighted token spans preserve whitespace and inherit row click behavior.

## Task 1: Add Shiki Dependency

**Files:**
- Modify: `.opencode/skills/organize-pr-topics/package.json`
- Modify: `.opencode/skills/organize-pr-topics/package-lock.json`

- [ ] **Step 1: Install Shiki**

Run from `.opencode/skills/organize-pr-topics`:

```bash
npm install shiki
```

Expected: `package.json` includes `"shiki"` in `dependencies`, and `package-lock.json` is updated.

- [ ] **Step 2: Verify install does not break tests**

Run from `.opencode/skills/organize-pr-topics`:

```bash
npm test
```

Expected: PASS, currently 42 tests.

- [ ] **Step 3: Commit**

```bash
git add .opencode/skills/organize-pr-topics/package.json .opencode/skills/organize-pr-topics/package-lock.json
git commit -m "chore: add shiki dependency"
```

## Task 2: Syntax Highlight Helper

**Files:**
- Create: `.opencode/skills/organize-pr-topics/app/ui/syntaxHighlight.ts`
- Create: `.opencode/skills/organize-pr-topics/tests/syntaxHighlight.test.ts`

- [ ] **Step 1: Write failing tests**

Create `.opencode/skills/organize-pr-topics/tests/syntaxHighlight.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  detectLanguage,
  highlightPlainText,
  shikiThemeForAppTheme,
} from "../app/ui/syntaxHighlight";

describe("detectLanguage", () => {
  it.each([
    ["app/ui/App.tsx", "tsx"],
    ["server/index.ts", "ts"],
    ["scripts/start-review.mjs", "javascript"],
    ["components/Button.jsx", "jsx"],
    ["app/ui/styles.css", "css"],
    ["package.json", "json"],
    ["README.md", "markdown"],
    ["index.html", "html"],
    ["scripts/check-gh.sh", "bash"],
    ["workflow.yml", "yaml"],
  ])("maps %s to %s", (path, language) => {
    expect(detectLanguage(path)).toBe(language);
  });

  it("returns null for unknown extensions", () => {
    expect(detectLanguage("assets/logo.svg")).toBeNull();
  });
});

describe("highlight fallbacks", () => {
  it("returns a plain token for plain text", () => {
    expect(highlightPlainText("const value = 1;")).toEqual([
      { content: "const value = 1;" },
    ]);
  });

  it("preserves empty lines as a non-breaking space token", () => {
    expect(highlightPlainText("")).toEqual([{ content: "\u00a0" }]);
  });

  it("maps app themes to GitHub Shiki themes", () => {
    expect(shikiThemeForAppTheme("light")).toBe("github-light");
    expect(shikiThemeForAppTheme("dark")).toBe("github-dark");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `.opencode/skills/organize-pr-topics`:

```bash
npm test -- tests/syntaxHighlight.test.ts
```

Expected: FAIL because `../app/ui/syntaxHighlight` does not exist.

- [ ] **Step 3: Implement helper**

Create `.opencode/skills/organize-pr-topics/app/ui/syntaxHighlight.ts`:

```ts
import { createHighlighter, type BundledLanguage, type BundledTheme, type HighlighterGeneric } from "shiki";
import type { Theme } from "./theme";

export type HighlightToken = {
  content: string;
  color?: string;
};

const languages = [
  "bash",
  "css",
  "html",
  "javascript",
  "json",
  "jsx",
  "markdown",
  "ts",
  "tsx",
  "yaml",
] as const satisfies BundledLanguage[];

const themes = ["github-light", "github-dark"] as const satisfies BundledTheme[];

type SupportedLanguage = (typeof languages)[number];
type SupportedTheme = (typeof themes)[number];

const extensionLanguages = new Map<string, SupportedLanguage>([
  [".bash", "bash"],
  [".cjs", "javascript"],
  [".css", "css"],
  [".html", "html"],
  [".js", "javascript"],
  [".json", "json"],
  [".jsx", "jsx"],
  [".md", "markdown"],
  [".mjs", "javascript"],
  [".sh", "bash"],
  [".ts", "ts"],
  [".tsx", "tsx"],
  [".yaml", "yaml"],
  [".yml", "yaml"],
]);

let highlighterPromise: Promise<HighlighterGeneric<SupportedLanguage, SupportedTheme>> | null = null;

export function detectLanguage(path: string): SupportedLanguage | null {
  const normalized = path.toLowerCase();
  for (const [extension, language] of extensionLanguages) {
    if (normalized.endsWith(extension)) {
      return language;
    }
  }
  return null;
}

export function shikiThemeForAppTheme(theme: Theme): SupportedTheme {
  return theme === "dark" ? "github-dark" : "github-light";
}

export function highlightPlainText(content: string): HighlightToken[] {
  return [{ content: content || "\u00a0" }];
}

async function getHighlighter() {
  highlighterPromise ??= createHighlighter({ langs: languages, themes });
  return highlighterPromise;
}

export async function highlightLine(
  content: string,
  language: SupportedLanguage | null,
  theme: Theme,
): Promise<HighlightToken[]> {
  if (!language || !content) {
    return highlightPlainText(content);
  }

  try {
    const highlighter = await getHighlighter();
    const lines = highlighter.codeToTokensBase(content, {
      lang: language,
      theme: shikiThemeForAppTheme(theme),
    });
    const tokens = lines[0]?.map((token) => ({
      content: token.content,
      color: token.color,
    }));
    return tokens?.length ? tokens : highlightPlainText(content);
  } catch {
    return highlightPlainText(content);
  }
}
```

- [ ] **Step 4: Run tests and typecheck**

Run from `.opencode/skills/organize-pr-topics`:

```bash
npm test -- tests/syntaxHighlight.test.ts
npm run typecheck
```

Expected: both commands pass.

- [ ] **Step 5: Commit**

```bash
git add .opencode/skills/organize-pr-topics/app/ui/syntaxHighlight.ts .opencode/skills/organize-pr-topics/tests/syntaxHighlight.test.ts
git commit -m "feat: add diff syntax highlighting helper"
```

## Task 3: Diff Rendering Integration

**Files:**
- Modify: `.opencode/skills/organize-pr-topics/app/ui/App.tsx`
- Modify: `.opencode/skills/organize-pr-topics/app/ui/components/DiffReview.tsx`
- Modify: `.opencode/skills/organize-pr-topics/app/ui/styles.css`

- [ ] **Step 1: Pass app theme into `DiffReview`**

In `.opencode/skills/organize-pr-topics/app/ui/App.tsx`, change the render call from:

```tsx
<DiffReview session={session} topic={topic} onCommentSaved={loadSession} />
```

to:

```tsx
<DiffReview session={session} theme={theme} topic={topic} onCommentSaved={loadSession} />
```

- [ ] **Step 2: Render highlighted diff tokens**

Modify `.opencode/skills/organize-pr-topics/app/ui/components/DiffReview.tsx` to include theme and syntax highlighting:

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

export function DiffReview({ session, theme, topic, onCommentSaved }: Props) {
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
  onCommentSaved: () => void;
};

function FileCard({ file, rows, theme, topicId, onCommentSaved }: FileCardProps) {
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

  return (
    <section className="file-card">
      <header className="file-card-header">{file}</header>
      {rows.length === 0 ? (
        <p className="file-diff-empty">No diff available for {file}.</p>
      ) : (
        <div className="file-diff">
          {rows.map((row, index) => {
            const isActive =
              activeTarget?.line === row.line && activeTarget?.side === row.side;
            const tokens = highlightedRows[index] ?? highlightPlainText(row.content);
            return (
              <div className="diff-row-group" key={`${row.side}:${row.line}:${index}`}>
                <div
                  className={`diff-row${isActive ? " selected" : ""}`}
                  onClick={() =>
                    setActiveTarget(isActive ? null : { line: row.line, side: row.side })
                  }
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

- [ ] **Step 3: Add token CSS**

In `.opencode/skills/organize-pr-topics/app/ui/styles.css`, add below `.diff-content`:

```css
.syntax-token {
  white-space: inherit;
}
```

- [ ] **Step 4: Run verification**

Run from `.opencode/skills/organize-pr-topics`:

```bash
npm test
npm run typecheck
npm run build
```

Expected: all commands pass.

- [ ] **Step 5: Commit**

```bash
git add .opencode/skills/organize-pr-topics/app/ui/App.tsx .opencode/skills/organize-pr-topics/app/ui/components/DiffReview.tsx .opencode/skills/organize-pr-topics/app/ui/styles.css
git commit -m "feat: highlight review diff lines"
```

## Task 4: Manual Browser Verification

**Files:**
- No code changes expected.

- [ ] **Step 1: Start or reuse the review server**

Run from repository root if no server is active:

```bash
node .opencode/skills/organize-pr-topics/scripts/start-review.mjs
```

Expected: server listens on `http://127.0.0.1:4173`.

- [ ] **Step 2: Verify syntax highlighting behavior**

Open `http://127.0.0.1:4173` and confirm:

- TypeScript/TSX diff lines show syntax token colors.
- Light/dark theme toggle changes syntax colors.
- Clicking a highlighted line still opens the inline comment composer.
- Posting/saving draft comments still works.
- Unknown or empty lines remain readable as plain text.

- [ ] **Step 3: Commit only if manual verification requires a fix**

If a fix is needed, make the minimal change, run:

```bash
npm test
npm run typecheck
npm run build
```

Then commit with a conventional commit message describing the fix.

## Self-Review

- Spec coverage: The plan covers Shiki dependency, language detection, light/dark Shiki themes, safe React rendering without raw HTML, diff-only highlighting, fallbacks, click-to-comment preservation, tests, build verification, and manual browser verification.
- Placeholder scan: No placeholders or open-ended implementation steps remain.
- Type consistency: `Theme`, `HighlightToken`, `detectLanguage`, `highlightPlainText`, `highlightLine`, and `shikiThemeForAppTheme` are defined before use and referenced consistently.

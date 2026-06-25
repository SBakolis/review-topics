# Review UI Theme Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persisted light/dark theme switch to the local PR topic review GUI.

**Architecture:** Theme resolution and persistence live in a small UI module so it can be tested in the existing Node Vitest setup. `App.tsx` owns the active theme state, applies it to `document.documentElement.dataset.theme`, and renders a header toggle. `styles.css` defines semantic color variables for light and dark palettes, then existing UI rules consume those variables.

**Tech Stack:** React 19, TypeScript, CSS variables, Vite, Vitest.

---

## File Structure

- Create: `.opencode/skills/organize-pr-topics/app/ui/theme.ts`
  - Owns `Theme`, `THEME_STORAGE_KEY`, `getPreferredTheme()`, `readStoredTheme()`, `writeStoredTheme()`, and `getInitialTheme()`.
- Create: `.opencode/skills/organize-pr-topics/tests/theme.test.ts`
  - Verifies stored theme handling, system preference fallback, and invalid stored values.
- Modify: `.opencode/skills/organize-pr-topics/app/ui/App.tsx`
  - Initializes theme state, applies `data-theme`, and renders the switch in the header.
- Modify: `.opencode/skills/organize-pr-topics/app/ui/styles.css`
  - Adds light/dark CSS variables and updates existing hard-coded colors to use them.

## Task 1: Theme Preference Module

**Files:**
- Create: `.opencode/skills/organize-pr-topics/app/ui/theme.ts`
- Test: `.opencode/skills/organize-pr-topics/tests/theme.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `.opencode/skills/organize-pr-topics/tests/theme.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  THEME_STORAGE_KEY,
  getInitialTheme,
  getPreferredTheme,
  readStoredTheme,
  writeStoredTheme,
} from "../app/ui/theme";

const originalWindow = globalThis.window;

function setMockWindow(options: { stored?: string | null; prefersDark?: boolean }) {
  const store = new Map<string, string>();
  if (options.stored !== undefined && options.stored !== null) {
    store.set(THEME_STORAGE_KEY, options.stored);
  }

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: vi.fn((key: string) => store.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => {
          store.set(key, value);
        }),
      },
      matchMedia: vi.fn((query: string) => ({
        matches: query === "(prefers-color-scheme: dark)" ? Boolean(options.prefersDark) : false,
      })),
    },
  });
}

afterEach(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: originalWindow,
  });
  vi.restoreAllMocks();
});

describe("theme preference helpers", () => {
  it("uses a valid stored theme", () => {
    setMockWindow({ stored: "dark", prefersDark: false });

    expect(readStoredTheme()).toBe("dark");
    expect(getInitialTheme()).toBe("dark");
  });

  it("ignores invalid stored theme values", () => {
    setMockWindow({ stored: "sepia", prefersDark: true });

    expect(readStoredTheme()).toBeNull();
    expect(getInitialTheme()).toBe("dark");
  });

  it("falls back to system dark preference", () => {
    setMockWindow({ prefersDark: true });

    expect(getPreferredTheme()).toBe("dark");
    expect(getInitialTheme()).toBe("dark");
  });

  it("falls back to light when system dark preference is unavailable", () => {
    setMockWindow({ prefersDark: false });

    expect(getPreferredTheme()).toBe("light");
    expect(getInitialTheme()).toBe("light");
  });

  it("persists the selected theme", () => {
    setMockWindow({ prefersDark: false });

    writeStoredTheme("dark");

    expect(window.localStorage.setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, "dark");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `.opencode/skills/organize-pr-topics`:

```bash
npm test -- tests/theme.test.ts
```

Expected: FAIL because `../app/ui/theme` does not exist.

- [ ] **Step 3: Implement the theme helper module**

Create `.opencode/skills/organize-pr-topics/app/ui/theme.ts`:

```ts
export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "pr-topic-review-theme";

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark";
}

export function readStoredTheme(): Theme | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isTheme(stored) ? stored : null;
}

export function writeStoredTheme(theme: Theme) {
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export function getPreferredTheme(): Theme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function getInitialTheme(): Theme {
  return readStoredTheme() ?? getPreferredTheme();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run from `.opencode/skills/organize-pr-topics`:

```bash
npm test -- tests/theme.test.ts
```

Expected: PASS for all theme tests.

- [ ] **Step 5: Commit**

```bash
git add .opencode/skills/organize-pr-topics/app/ui/theme.ts .opencode/skills/organize-pr-topics/tests/theme.test.ts
git commit -m "feat: add review UI theme preferences"
```

## Task 2: Header Theme Toggle

**Files:**
- Modify: `.opencode/skills/organize-pr-topics/app/ui/App.tsx`
- Modify: `.opencode/skills/organize-pr-topics/app/ui/styles.css`

- [ ] **Step 1: Update `App.tsx` to apply and toggle the theme**

Modify `.opencode/skills/organize-pr-topics/app/ui/App.tsx` so imports and component setup include theme state:

```tsx
import { useCallback, useEffect, useState } from "react";
import type { ReviewSession, ReviewTopic } from "../shared/schema";
import { TopicSidebar } from "./components/TopicSidebar";
import { DiffReview } from "./components/DiffReview";
import { HandoffPanel } from "./components/HandoffPanel";
import { type Theme, getInitialTheme, writeStoredTheme } from "./theme";

export function App() {
  const [session, setSession] = useState<ReviewSession | null>(null);
  const [topic, setTopic] = useState<ReviewTopic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());

  const loadSession = useCallback(() => {
    fetch("/api/session")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load session (HTTP ${response.status}).`);
        }
        return response.json();
      })
      .then((nextSession: ReviewSession) => {
        setSession(nextSession);
        setTopic((current) =>
          current
            ? (nextSession.topics.find((next) => next.id === current.id) ??
              nextSession.topics[0] ??
              null)
            : (nextSession.topics[0] ?? null),
        );
      })
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : String(loadError));
      });
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function toggleTheme() {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      writeStoredTheme(next);
      return next;
    });
  }

  if (error) {
    return <main className="loading">Failed to load session: {error}</main>;
  }

  if (!session || !topic) {
    return <main className="loading">Loading PR review session...</main>;
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>{session.pr.title}</h1>
          <a href={session.pr.url} target="_blank" rel="noreferrer">
            #{session.pr.number} on GitHub
          </a>
        </div>
        <button className="theme-toggle" onClick={toggleTheme} type="button">
          {theme === "dark" ? "Light theme" : "Dark theme"}
        </button>
      </header>
      <div className="review-layout">
        <TopicSidebar
          topics={session.topics}
          selectedTopicId={topic.id}
          comments={session.comments}
          onSelect={setTopic}
        />
        <section className="review-main">
          <h2>{topic.title}</h2>
          <p className="topic-summary">{topic.summary}</p>
          <DiffReview session={session} topic={topic} onCommentSaved={loadSession} />
          <HandoffPanel />
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Add header layout and theme toggle styles**

In `.opencode/skills/organize-pr-topics/app/ui/styles.css`, update `.app-header` and add `.theme-toggle`:

```css
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  padding: 16px 24px;
}

.theme-toggle {
  white-space: nowrap;
}
```

- [ ] **Step 3: Run typecheck**

Run from `.opencode/skills/organize-pr-topics`:

```bash
npm run typecheck
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add .opencode/skills/organize-pr-topics/app/ui/App.tsx .opencode/skills/organize-pr-topics/app/ui/styles.css
git commit -m "feat: add review UI theme switch"
```

## Task 3: CSS Variable Palettes

**Files:**
- Modify: `.opencode/skills/organize-pr-topics/app/ui/styles.css`

- [ ] **Step 1: Add theme variables**

At the top of `.opencode/skills/organize-pr-topics/app/ui/styles.css`, replace the existing `:root` block with:

```css
:root {
  color-scheme: light;
  --background: #f6f8fa;
  --surface: #ffffff;
  --surface-muted: #f6f8fa;
  --border: #d0d7de;
  --text: #24292f;
  --muted-text: #57606a;
  --subtle-text: #6e7781;
  --accent: #0969da;
  --hover: #f3f4f6;
  --selected: #ddf4ff;
  --danger: #cf222e;
  --success: #1a7f37;
}

:root[data-theme="dark"] {
  color-scheme: dark;
  --background: #0d1117;
  --surface: #161b22;
  --surface-muted: #21262d;
  --border: #30363d;
  --text: #e6edf3;
  --muted-text: #8b949e;
  --subtle-text: #7d8590;
  --accent: #58a6ff;
  --hover: #262c36;
  --selected: #1f6feb33;
  --danger: #ff7b72;
  --success: #7ee787;
}
```

- [ ] **Step 2: Replace hard-coded colors with variables**

In `.opencode/skills/organize-pr-topics/app/ui/styles.css`, make these replacements:

```css
body {
  margin: 0;
  color: var(--text);
  background: var(--background);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue",
    Arial, sans-serif;
  line-height: 1.5;
}

a {
  color: var(--accent);
  text-decoration: none;
}

.loading {
  padding: 48px 24px;
  font-size: 16px;
  color: var(--muted-text);
}

.topic-sidebar,
.topic-item,
.file-card,
.handoff-panel,
textarea,
button {
  background: var(--surface);
  color: var(--text);
}

.topic-sidebar {
  border-right: 1px solid var(--border);
}

.topic-sidebar h2,
.topic-meta,
.topic-summary,
.composer-label,
.file-diff-empty {
  color: var(--muted-text);
}

.topic-item,
.file-card,
.handoff-panel,
textarea,
button {
  border-color: var(--border);
}

.topic-item:hover,
.diff-row:hover,
button:hover:not(:disabled) {
  background: var(--hover);
}

.topic-item.selected {
  border-color: var(--accent);
  box-shadow: inset 3px 0 0 var(--accent);
}

.file-card-header,
.comment-composer,
textarea[readOnly] {
  background: var(--surface-muted);
}

.file-card-header,
.comment-composer,
.handoff-panel,
.app-header {
  border-color: var(--border);
}

.file-diff {
  background: var(--surface);
}

.diff-row.selected {
  background: var(--selected);
}

.diff-line-number,
.diff-sign-context {
  color: var(--subtle-text);
}

.diff-sign-add {
  color: var(--success);
}

.diff-sign-del,
.comment-error {
  color: var(--danger);
}

button:disabled {
  color: var(--subtle-text);
}
```

Keep existing layout properties such as padding, margin, display, border-radius, font, overflow, and grid settings unchanged.

- [ ] **Step 3: Run build and tests**

Run from `.opencode/skills/organize-pr-topics`:

```bash
npm test
npm run typecheck
npm run build
```

Expected: all commands pass.

- [ ] **Step 4: Manually verify in browser**

Run from repository root if the review server is not already running:

```bash
node .opencode/skills/organize-pr-topics/scripts/start-review.mjs
```

Open `http://127.0.0.1:4173`, toggle the theme, refresh the page, and confirm the selected theme persists.

- [ ] **Step 5: Commit**

```bash
git add .opencode/skills/organize-pr-topics/app/ui/styles.css
git commit -m "feat: add review UI dark theme palette"
```

## Self-Review

- Spec coverage: The plan covers system preference first load, persisted manual choice, header toggle placement, `data-theme`, CSS variables, no server changes, and verification.
- Placeholder scan: No TBD/TODO placeholders are present.
- Type consistency: `Theme`, `THEME_STORAGE_KEY`, `getPreferredTheme`, `readStoredTheme`, `writeStoredTheme`, and `getInitialTheme` are defined before use and referenced consistently.

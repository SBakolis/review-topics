# Review UI Theme Icon Switch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the text theme toggle with a minimal active-theme icon switch.

**Architecture:** Keep the existing `App.tsx` theme state and toggle logic unchanged. Update only the button presentation and accessibility attributes, then restyle `.theme-toggle` as a compact circular icon button using existing CSS theme variables.

**Tech Stack:** React 19, TypeScript, CSS variables, Vite, Vitest.

---

## File Structure

- Modify: `.opencode/skills/organize-pr-topics/app/ui/App.tsx`
  - Replace text label with active-theme icon and add action-oriented `aria-label`/`title`.
- Modify: `.opencode/skills/organize-pr-topics/app/ui/styles.css`
  - Restyle `.theme-toggle` as a 34x34 circular icon switch with hover and focus-visible states.

## Task 1: Theme Icon Switch UI

**Files:**
- Modify: `.opencode/skills/organize-pr-topics/app/ui/App.tsx`
- Modify: `.opencode/skills/organize-pr-topics/app/ui/styles.css`

- [ ] **Step 1: Update the theme toggle markup**

In `.opencode/skills/organize-pr-topics/app/ui/App.tsx`, replace the current theme button:

```tsx
<button className="theme-toggle" onClick={toggleTheme} type="button">
  {theme === "dark" ? "Light theme" : "Dark theme"}
</button>
```

with:

```tsx
<button
  aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
  className="theme-toggle"
  onClick={toggleTheme}
  title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
  type="button"
>
  <span aria-hidden="true">{theme === "dark" ? "☾" : "☀︎"}</span>
</button>
```

- [ ] **Step 2: Restyle the toggle as a compact icon switch**

In `.opencode/skills/organize-pr-topics/app/ui/styles.css`, replace the existing `.theme-toggle` block with:

```css
.theme-toggle {
  display: inline-grid;
  place-items: center;
  width: 34px;
  height: 34px;
  padding: 0;
  color: var(--text);
  background: var(--surface-muted);
  border: 1px solid var(--border);
  border-radius: 999px;
  font-size: 17px;
  line-height: 1;
}

.theme-toggle:hover:not(:disabled) {
  background: var(--hover);
}

.theme-toggle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

- [ ] **Step 3: Run verification**

Run from `.opencode/skills/organize-pr-topics`:

```bash
npm test
npm run typecheck
npm run build
```

Expected: all commands pass. `npm run build` may still show the existing Shiki chunk-size warning.

- [ ] **Step 4: Manual browser check**

Open `http://127.0.0.1:4173` and confirm:

- The header shows a compact icon-only switch.
- Light mode displays `☀︎`.
- Dark mode displays `☾`.
- Clicking the switch toggles theme and icon.
- The button still has an accessible action label in DevTools or the accessibility tree.

- [ ] **Step 5: Commit**

```bash
git add .opencode/skills/organize-pr-topics/app/ui/App.tsx .opencode/skills/organize-pr-topics/app/ui/styles.css
git commit -m "feat: add minimal theme icon switch"
```

## Self-Review

- Spec coverage: The plan preserves existing theme logic, shows only active icons, adds action labels/titles, keeps native button behavior, uses existing theme variables, preserves header placement, and includes command plus browser verification.
- Placeholder scan: No placeholders or open-ended implementation steps remain.
- Type consistency: Existing `theme` and `toggleTheme` names are reused unchanged.

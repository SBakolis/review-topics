# Claude Code Skill Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a self-contained Claude Code copy of the PR topic review skill.

**Architecture:** Keep the existing opencode package intact and duplicate it into `.claude/skills/organize-pr-topics/`. Use package-level tests to verify the Claude Code copy is complete and documented.

**Tech Stack:** Markdown skills, Node.js scripts, Fastify, React, Vite, Vitest, TypeScript.

---

## File Structure

- Create: `.claude/skills/organize-pr-topics/` copied from `.opencode/skills/organize-pr-topics/`, excluding generated artifacts such as `node_modules`, `dist`, and `session.json`.
- Modify: `.opencode/skills/organize-pr-topics/SKILL.md` to use agent-neutral wording for GUI safety.
- Modify: `.opencode/skills/organize-pr-topics/README.md` to document Claude Code and opencode usage.
- Modify: `.opencode/skills/organize-pr-topics/tests/package.test.ts` to assert Claude Code package completeness and documentation.
- Modify: `.gitignore` to ignore generated Claude Code package artifacts.

### Task 1: Add Compatibility Tests

**Files:**
- Modify: `.opencode/skills/organize-pr-topics/tests/package.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests that assert `.claude/skills/organize-pr-topics/SKILL.md`, `scripts/check-gh.mjs`, `scripts/prepare-session.mjs`, `scripts/start-review.mjs`, `package.json`, and `README.md` exist, and that the README mentions `.claude/skills/organize-pr-topics` and `~/.claude/skills/organize-pr-topics`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/package.test.ts`

Expected: FAIL because `.claude/skills/organize-pr-topics/` does not exist yet.

### Task 2: Duplicate Skill Package

**Files:**
- Create: `.claude/skills/organize-pr-topics/`
- Modify: `.gitignore`

- [ ] **Step 1: Copy package**

Copy `.opencode/skills/organize-pr-topics/` into `.claude/skills/organize-pr-topics/`, excluding `node_modules`, `dist`, and `session.json`.

- [ ] **Step 2: Ignore generated Claude artifacts**

Add these entries to `.gitignore`:

```gitignore
.claude/skills/organize-pr-topics/node_modules/
.claude/skills/organize-pr-topics/dist/
.claude/skills/organize-pr-topics/session.json
```

### Task 3: Update Documentation

**Files:**
- Modify: `.opencode/skills/organize-pr-topics/SKILL.md`
- Modify: `.opencode/skills/organize-pr-topics/README.md`
- Modify: `.claude/skills/organize-pr-topics/SKILL.md`
- Modify: `.claude/skills/organize-pr-topics/README.md`

- [ ] **Step 1: Make safety wording agent-neutral**

Change the GUI safety rule to: `Do not invoke Claude Code or opencode from the GUI.`

- [ ] **Step 2: Document both install paths**

Update the README to describe Claude Code project-local use, opencode project-local use, and both global install directories.

### Task 4: Verify

**Files:**
- Test from: `.opencode/skills/organize-pr-topics/`
- Test from: `.claude/skills/organize-pr-topics/`

- [ ] **Step 1: Run opencode package tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Run Claude Code package tests**

Run from `.claude/skills/organize-pr-topics/`: `npm install`, `npm test`, `npm run typecheck`, `npm run build`.

Expected: all checks pass.

- [ ] **Step 3: Commit**

Commit with: `feat: add claude code skill package`

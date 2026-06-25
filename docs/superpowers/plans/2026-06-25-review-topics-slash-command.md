# Review Topics Slash Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/review-topics` for opencode and Claude Code with an interactive PR selection default and an optional direct PR number fast path.

**Architecture:** Keep `organize-pr-topics` as the skill package and add lightweight slash-command shims in `.opencode/commands/` and `.claude/commands/`. Extend the existing session preparation script to accept a PR selector so the selected PR flows into the current GUI/session pipeline without changing the server or UI architecture.

**Tech Stack:** Markdown slash commands, Node.js ESM scripts, GitHub CLI (`gh`), Vitest, TypeScript/Vite package checks.

---

## File Structure

- Create `.opencode/commands/review-topics.md`: opencode slash command shim. It instructs the agent to use the local `organize-pr-topics` skill and describes no-argument and PR-number behavior.
- Create `.claude/commands/review-topics.md`: Claude Code slash command shim. It mirrors the opencode command using Claude Code command syntax and `$ARGUMENTS`.
- Modify `.opencode/skills/organize-pr-topics/tests/package.test.ts`: add package tests for both command files and README command documentation.
- Modify `.opencode/skills/organize-pr-topics/tests/prepareSession.test.ts`: new focused tests for PR selector handling in `prepare-session.mjs`.
- Modify `.opencode/skills/organize-pr-topics/scripts/prepare-session.mjs`: accept optional output path and PR selector flags, and pass the selector to `gh pr view` and `gh pr diff`.
- Modify `.claude/skills/organize-pr-topics/scripts/prepare-session.mjs`: keep the Claude package self-contained by mirroring the script update.
- Modify `.opencode/skills/organize-pr-topics/SKILL.md`: document PR resolution rules shared by natural-language and `/review-topics` invocation.
- Modify `.claude/skills/organize-pr-topics/SKILL.md`: mirror the skill workflow update.
- Modify `.opencode/skills/organize-pr-topics/README.md`: document `/review-topics`, `/review-topics <pr-number>`, and fallback selection behavior.
- Modify `.claude/skills/organize-pr-topics/README.md`: mirror README command docs.

## Implementation Notes

- Use `gh` only. Do not add token handling.
- Treat PR selectors as strings because `gh pr view` accepts numbers, URLs, and branch names. The command promises PR numbers, but the script can safely pass any non-empty selector through to `gh`.
- Keep command shims as prompts, not executable scripts. The agent still performs the selection question and topic proposal.
- `prepare-session.mjs` currently uses `argv[2]` as an optional output path. Preserve that behavior by adding explicit flags instead of changing positional semantics:
  - `--output <path>` sets the session JSON path.
  - `--pr <selector>` sets the PR selector.
  - A single positional argument remains an output path for backward compatibility.

---

### Task 1: Add Failing Package Tests For Command Files

**Files:**
- Modify: `.opencode/skills/organize-pr-topics/tests/package.test.ts`

- [ ] **Step 1: Add command file existence and content tests**

Append these tests to `.opencode/skills/organize-pr-topics/tests/package.test.ts`:

```ts
test("project slash commands invoke review topics workflow", () => {
  const repoRoot = resolve(process.cwd(), "../../..");
  const commandPaths = [
    ".opencode/commands/review-topics.md",
    ".claude/commands/review-topics.md",
  ];

  for (const commandPath of commandPaths) {
    const fullPath = resolve(repoRoot, commandPath);
    expect(existsSync(fullPath), commandPath).toBe(true);

    const command = readFileSync(fullPath, "utf8");
    expect(command).toContain("organize-pr-topics");
    expect(command).toContain("$ARGUMENTS");
    expect(command).toContain("checked-out branch");
    expect(command).toContain("recent open PRs");
    expect(command).toContain("prepare-session.mjs --pr");
  }
});

test("readmes document review-topics slash command", () => {
  const repoRoot = resolve(process.cwd(), "../../..");
  const readmePaths = [
    ".opencode/skills/organize-pr-topics/README.md",
    ".claude/skills/organize-pr-topics/README.md",
  ];

  for (const readmePath of readmePaths) {
    const readme = readFileSync(resolve(repoRoot, readmePath), "utf8");
    expect(readme).toContain("/review-topics");
    expect(readme).toContain("/review-topics <pr-number>");
    expect(readme).toContain("checked-out branch");
    expect(readme).toContain("recent open PRs");
  }
});
```

- [ ] **Step 2: Run the focused failing tests**

Run from `.opencode/skills/organize-pr-topics`:

```bash
npm test -- tests/package.test.ts
```

Expected: FAIL because `.opencode/commands/review-topics.md` and `.claude/commands/review-topics.md` do not exist and the README files do not yet document `/review-topics`.

- [ ] **Step 3: Commit the failing tests**

```bash
git add .opencode/skills/organize-pr-topics/tests/package.test.ts
git commit -m "test: cover review topics slash commands"
```

---

### Task 2: Add Slash Command Shims And README Docs

**Files:**
- Create: `.opencode/commands/review-topics.md`
- Create: `.claude/commands/review-topics.md`
- Modify: `.opencode/skills/organize-pr-topics/README.md`
- Modify: `.claude/skills/organize-pr-topics/README.md`

- [ ] **Step 1: Create the opencode command shim**

Create `.opencode/commands/review-topics.md`:

```markdown
---
description: Organize a GitHub PR into review topics and launch the local review GUI
---

Use the project-local `organize-pr-topics` skill workflow to review a GitHub pull request.

Arguments: `$ARGUMENTS`

If `$ARGUMENTS` contains a PR number, use that PR directly and run the session preparation script with `prepare-session.mjs --pr <pr-number>`.

If `$ARGUMENTS` is empty:

1. Verify `gh` with the skill's `scripts/check-gh.mjs` preflight.
2. Determine the checked-out branch.
3. Look for the most recent open PR for the checked-out branch with `gh pr list --head <branch> --state open --limit 1 --json number,title,url,updatedAt`.
4. Ask the user which PR they want to review, offering that branch PR as the default when found.
5. If no branch PR is found, ask for a PR number or offer recent open PRs from `gh pr list --state open --limit 10 --json number,title,url,headRefName,updatedAt`.

After a PR is selected, inspect the PR files and diff, propose purpose-based review topics, run `prepare-session.mjs --pr <selector>`, replace the fallback topic in the generated session JSON, launch the local GUI, and instruct the user to post comments from the GUI.
```

- [ ] **Step 2: Create the Claude Code command shim**

Create `.claude/commands/review-topics.md` with the same body as the opencode command shim:

```markdown
---
description: Organize a GitHub PR into review topics and launch the local review GUI
---

Use the project-local `organize-pr-topics` skill workflow to review a GitHub pull request.

Arguments: `$ARGUMENTS`

If `$ARGUMENTS` contains a PR number, use that PR directly and run the session preparation script with `prepare-session.mjs --pr <pr-number>`.

If `$ARGUMENTS` is empty:

1. Verify `gh` with the skill's `scripts/check-gh.mjs` preflight.
2. Determine the checked-out branch.
3. Look for the most recent open PR for the checked-out branch with `gh pr list --head <branch> --state open --limit 1 --json number,title,url,updatedAt`.
4. Ask the user which PR they want to review, offering that branch PR as the default when found.
5. If no branch PR is found, ask for a PR number or offer recent open PRs from `gh pr list --state open --limit 10 --json number,title,url,headRefName,updatedAt`.

After a PR is selected, inspect the PR files and diff, propose purpose-based review topics, run `prepare-session.mjs --pr <selector>`, replace the fallback topic in the generated session JSON, launch the local GUI, and instruct the user to post comments from the GUI.
```

- [ ] **Step 3: Update both README files**

In both `.opencode/skills/organize-pr-topics/README.md` and `.claude/skills/organize-pr-topics/README.md`, replace the sentence `Ask the agent to organize the current PR into topics and launch the review GUI.` with this section:

````markdown
## Usage

Preferred command:

```text
/review-topics
```

With no arguments, the command asks which PR to review. It offers the most recent open PR for the checked-out branch when one exists. If no checked-out branch PR exists, it asks for a PR number or offers recent open PRs.

Direct PR number fast path:

```text
/review-topics <pr-number>
```

Natural-language invocation remains supported: ask the agent to organize a GitHub PR into review topics and launch the review GUI.
````

- [ ] **Step 4: Run package tests to verify command docs pass**

Run from `.opencode/skills/organize-pr-topics`:

```bash
npm test -- tests/package.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit command shims and docs**

```bash
git add .opencode/commands/review-topics.md .claude/commands/review-topics.md .opencode/skills/organize-pr-topics/README.md .claude/skills/organize-pr-topics/README.md
git commit -m "feat: add review topics slash commands"
```

---

### Task 3: Add Failing Tests For PR Selector Handling

**Files:**
- Create: `.opencode/skills/organize-pr-topics/tests/prepareSession.test.ts`
- Create: `.opencode/skills/organize-pr-topics/tests/prepare-session-script.d.ts`

- [ ] **Step 1: Create the failing prepare-session test file**

Create `.opencode/skills/organize-pr-topics/tests/prepareSession.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import {
  buildPrDiffArgs,
  buildPrViewArgs,
  parsePrepareSessionArgs,
} from "../scripts/prepare-session.mjs";

describe("parsePrepareSessionArgs", () => {
  test("keeps a single positional argument as the output path", () => {
    expect(parsePrepareSessionArgs(["node", "prepare-session.mjs", "tmp/session.json"])).toEqual({
      outputPath: "tmp/session.json",
    });
  });

  test("parses explicit output and PR selector flags", () => {
    expect(
      parsePrepareSessionArgs([
        "node",
        "prepare-session.mjs",
        "--output",
        "tmp/session.json",
        "--pr",
        "123",
      ]),
    ).toEqual({
      outputPath: "tmp/session.json",
      prSelector: "123",
    });
  });

  test("rejects missing flag values", () => {
    expect(() => parsePrepareSessionArgs(["node", "prepare-session.mjs", "--pr"])).toThrow(
      "Missing value for --pr",
    );
  });
});

describe("PR gh args", () => {
  test("builds current-checkout PR commands without a selector", () => {
    expect(buildPrViewArgs()).toEqual([
      "pr",
      "view",
      "--json",
      "number,title,url,baseRefName,headRefName,baseRefOid,headRefOid,files,headRepositoryOwner,headRepository",
    ]);
    expect(buildPrDiffArgs()).toEqual(["pr", "diff", "--patch"]);
  });

  test("builds selected PR commands with a selector", () => {
    expect(buildPrViewArgs("123")).toEqual([
      "pr",
      "view",
      "123",
      "--json",
      "number,title,url,baseRefName,headRefName,baseRefOid,headRefOid,files,headRepositoryOwner,headRepository",
    ]);
    expect(buildPrDiffArgs("123")).toEqual(["pr", "diff", "123", "--patch"]);
  });
});
```

- [ ] **Step 2: Add a TypeScript declaration for the script module**

Create `.opencode/skills/organize-pr-topics/tests/prepare-session-script.d.ts`:

```ts
declare module "../scripts/prepare-session.mjs" {
  export function parsePrepareSessionArgs(argv: string[]): {
    outputPath?: string;
    prSelector?: string;
  };
  export function buildPrViewArgs(prSelector?: string): string[];
  export function buildPrDiffArgs(prSelector?: string): string[];
}
```

- [ ] **Step 3: Run the focused failing tests**

Run from `.opencode/skills/organize-pr-topics`:

```bash
npm test -- tests/prepareSession.test.ts
```

Expected: FAIL because `parsePrepareSessionArgs`, `buildPrViewArgs`, and `buildPrDiffArgs` are not exported yet.

- [ ] **Step 4: Commit the failing tests**

```bash
git add .opencode/skills/organize-pr-topics/tests/prepareSession.test.ts .opencode/skills/organize-pr-topics/tests/prepare-session-script.d.ts
git commit -m "test: cover prepare session pr selector"
```

---

### Task 4: Implement PR Selector Support In Session Preparation

**Files:**
- Modify: `.opencode/skills/organize-pr-topics/scripts/prepare-session.mjs`
- Modify: `.claude/skills/organize-pr-topics/scripts/prepare-session.mjs`

- [ ] **Step 1: Update the opencode prepare-session script**

Replace the top-level constants and `main` argument handling in `.opencode/skills/organize-pr-topics/scripts/prepare-session.mjs` with these additions while keeping the existing schemas and `validatePreparedSession` unchanged:

```js
const PR_JSON_FIELDS =
  "number,title,url,baseRefName,headRefName,baseRefOid,headRefOid,files,headRepositoryOwner,headRepository";

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8" }).trim();
}

export function parsePrepareSessionArgs(argv = process.argv) {
  const parsed = {};
  const args = argv.slice(2);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--output") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("Missing value for --output");
      }
      parsed.outputPath = value;
      index += 1;
      continue;
    }

    if (arg === "--pr") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("Missing value for --pr");
      }
      parsed.prSelector = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    if (parsed.outputPath) {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }

    parsed.outputPath = arg;
  }

  return parsed;
}

export function buildPrViewArgs(prSelector) {
  const args = ["pr", "view"];

  if (prSelector) {
    args.push(prSelector);
  }

  args.push("--json", PR_JSON_FIELDS);
  return args;
}

export function buildPrDiffArgs(prSelector) {
  const args = ["pr", "diff"];

  if (prSelector) {
    args.push(prSelector);
  }

  args.push("--patch");
  return args;
}
```

Update `main` to use those helpers:

```js
export async function main(argv = process.argv) {
  const { buildSessionFromGhPr } = await import("../app/server/gh.ts");
  const { outputPath, prSelector } = parsePrepareSessionArgs(argv);
  const pr = JSON.parse(gh(buildPrViewArgs(prSelector)));
  const diff = gh(buildPrDiffArgs(prSelector));
  const session = validatePreparedSession(buildSessionFromGhPr(pr, diff));

  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const skillDir = dirname(scriptDir);
  const resolvedOutputPath = outputPath ? resolve(outputPath) : resolve(skillDir, "session.json");

  writeFileSync(resolvedOutputPath, JSON.stringify(session, null, 2));
  console.log(resolvedOutputPath);
}
```

- [ ] **Step 2: Mirror the script update into the Claude package**

Copy the updated `.opencode/skills/organize-pr-topics/scripts/prepare-session.mjs` to `.claude/skills/organize-pr-topics/scripts/prepare-session.mjs`.

- [ ] **Step 3: Run focused tests**

Run from `.opencode/skills/organize-pr-topics`:

```bash
npm test -- tests/prepareSession.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run typecheck**

Run from `.opencode/skills/organize-pr-topics`:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit PR selector support**

```bash
git add .opencode/skills/organize-pr-topics/scripts/prepare-session.mjs .claude/skills/organize-pr-topics/scripts/prepare-session.mjs
git commit -m "feat: support selected prs in session prep"
```

---

### Task 5: Update Skill Workflows For Shared PR Resolution

**Files:**
- Modify: `.opencode/skills/organize-pr-topics/SKILL.md`
- Modify: `.claude/skills/organize-pr-topics/SKILL.md`

- [ ] **Step 1: Update the opencode skill workflow**

Replace lines 17-22 of `.opencode/skills/organize-pr-topics/SKILL.md` with:

```markdown
6. Resolve the PR to review:
   - If the user invoked `/review-topics <pr-number>` or otherwise gave a PR selector, use that selector.
   - If no selector was provided, determine the checked-out branch and run `gh pr list --head <branch> --state open --limit 1 --json number,title,url,updatedAt`.
   - Ask the user which PR they want to review, offering the most recent open PR for the checked-out branch as the default when found.
   - If no branch PR is found, ask for a PR number or offer recent open PRs from `gh pr list --state open --limit 10 --json number,title,url,headRefName,updatedAt`.
7. Inspect the selected PR files and diff.
8. Propose topics by grouping changed files according to what each set of files does.
9. Run `scripts/prepare-session.mjs --pr <selector>` under `SKILL_DIR` to write a session JSON (defaults to `SKILL_DIR/session.json`). If no selector was needed because the checked-out branch PR is being used, `--pr` may be omitted. The script emits a fallback `topics` array containing a single catch-all topic; this is a placeholder and must be replaced.
10. Read the generated session JSON. The agent MUST replace the fallback `topics` array with the agent-proposed topics from step 8. After editing, write the session JSON back to the same path (the `topics` array must be non-empty and each topic must satisfy `ReviewTopicSchema`).
11. Launch the bundled local review GUI via `scripts/start-review.mjs` under `SKILL_DIR`, pointing it at the updated session JSON.
```

- [ ] **Step 2: Mirror the workflow update into Claude Code skill**

Apply the same replacement to `.claude/skills/organize-pr-topics/SKILL.md`.

- [ ] **Step 3: Add a safety reminder**

In both `SKILL.md` files, add this bullet under `## Safety`:

```markdown
- Do not choose a PR without asking unless the user provided a PR selector argument.
```

- [ ] **Step 4: Run package tests**

Run from `.opencode/skills/organize-pr-topics`:

```bash
npm test -- tests/package.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit workflow docs**

```bash
git add .opencode/skills/organize-pr-topics/SKILL.md .claude/skills/organize-pr-topics/SKILL.md
git commit -m "docs: document review topics pr selection"
```

---

### Task 6: Run Full Verification In Both Packages

**Files:**
- No source changes expected.

- [ ] **Step 1: Run opencode package tests**

Run from `.opencode/skills/organize-pr-topics`:

```bash
npm test
```

Expected: PASS. The total test count should include the new command and prepare-session tests.

- [ ] **Step 2: Run opencode typecheck**

Run from `.opencode/skills/organize-pr-topics`:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run opencode build**

Run from `.opencode/skills/organize-pr-topics`:

```bash
npm run build
```

Expected: PASS. The existing Shiki chunk-size warning may still appear.

- [ ] **Step 4: Run Claude package tests**

Run from `.claude/skills/organize-pr-topics`:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Run Claude package typecheck**

Run from `.claude/skills/organize-pr-topics`:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Run Claude package build**

Run from `.claude/skills/organize-pr-topics`:

```bash
npm run build
```

Expected: PASS. The existing Shiki chunk-size warning may still appear.

- [ ] **Step 7: Inspect final status**

Run from the repository root:

```bash
git status --short
```

Expected: only intentional tracked changes are present, plus any pre-existing untracked `.DS_Store` files.

- [ ] **Step 8: Commit any verification-only corrections**

If verification required fixes, commit them with a precise message. If no fixes were required, do not create an empty commit.

---

## Self-Review

- Spec coverage: The plan covers command shims for both agents, no-argument PR selection, checked-out branch default, recent PR fallback, direct PR argument support, `prepare-session.mjs --pr`, README docs, skill workflow docs, and both package verification suites.
- Placeholder scan: No prohibited placeholder wording remains. Each code-changing step includes concrete file paths, exact snippets, commands, and expected results.
- Type consistency: The planned test imports match the planned exports: `parsePrepareSessionArgs`, `buildPrViewArgs`, and `buildPrDiffArgs`. The command shims and skill docs consistently use `prepare-session.mjs --pr <selector>`.

# Dual-Agent npm Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make one global `@sbakolis/organize-pr-topics` npm package install Claude Code and opencode skills by default, while allowing explicit per-agent installs.

**Architecture:** Keep the production CLI as the single runtime interface. Bundle two agent-specific skill files under `skill/claude` and `skill/opencode`; the CLI installer copies the requested files into the correct user skill directories. Both installed skills use the same global `organize-pr-topics` commands and never depend on source-tree scripts or `npm run dev`.

**Tech Stack:** Node.js ESM CLI, Vitest, npm packaging, Markdown skill files.

---

## File Structure

- Modify: `.opencode/skills/organize-pr-topics/bin/organize-pr-topics.mjs`
  - Owns command parsing and installer behavior.
  - Add `--agent claude|opencode|both` parsing for `install-skill`.
  - Default to `both`.
- Create: `.opencode/skills/organize-pr-topics/skill/claude/SKILL.md`
  - Claude Code-compatible skill instructions that call the global CLI.
- Create: `.opencode/skills/organize-pr-topics/skill/opencode/SKILL.md`
  - opencode-compatible skill instructions that call the global CLI.
- Delete: `.opencode/skills/organize-pr-topics/skill/SKILL.md`
  - Replaced by agent-specific bundled skill files.
- Modify: `.opencode/skills/organize-pr-topics/tests/cli.test.ts`
  - Cover installer help, default install, targeted installs, and invalid agent values.
- Modify: `.opencode/skills/organize-pr-topics/tests/package.test.ts`
  - Cover bundled agent-specific skill files and package layout expectations.
- Modify: `.opencode/skills/organize-pr-topics/README.md`
  - Document one global package supporting both Claude Code and opencode.
- Optional Modify: `.claude/skills/organize-pr-topics/SKILL.md`
  - If keeping checked-in Claude skill source aligned is desired, replace source-tree script instructions with global CLI instructions.
- Optional Modify: `.claude/skills/organize-pr-topics/README.md`
  - If keeping checked-in Claude docs aligned is desired, mirror the npm install instructions.

---

### Task 1: Add Failing CLI Installer Tests

**Files:**
- Modify: `.opencode/skills/organize-pr-topics/tests/cli.test.ts`

- [ ] **Step 1: Replace the existing help and install tests with dual-agent expectations**

In `.opencode/skills/organize-pr-topics/tests/cli.test.ts`, keep the imports and helper, then replace lines 18-41 with this code:

```ts
test("cli help documents supported global commands", () => {
  const output = runCli(["--help"]);

  expect(output).toContain("organize-pr-topics install-skill [--agent claude|opencode|both]");
  expect(output).toContain("organize-pr-topics check-gh");
  expect(output).toContain("organize-pr-topics prepare-session [output-path]");
  expect(output).toContain("organize-pr-topics start-review <session-path>");
});

test("install-skill defaults to installing claude and opencode skills", () => {
  const home = mkdtempSync(resolve(tmpdir(), "organize-pr-topics-home-"));
  const output = runCli(["install-skill"], { HOME: home });
  const claudePath = resolve(home, ".claude/skills/organize-pr-topics/SKILL.md");
  const opencodePath = resolve(
    home,
    ".config/opencode/skills/organize-pr-topics/SKILL.md",
  );

  expect(output).toContain(claudePath);
  expect(output).toContain(opencodePath);
  expect(existsSync(claudePath)).toBe(true);
  expect(existsSync(opencodePath)).toBe(true);

  for (const installedPath of [claudePath, opencodePath]) {
    const installedSkill = readFileSync(installedPath, "utf8");
    expect(installedSkill).toContain("organize-pr-topics check-gh");
    expect(installedSkill).toContain(
      "organize-pr-topics prepare-session .pr-topic-review-session.json",
    );
    expect(installedSkill).toContain(
      "organize-pr-topics start-review .pr-topic-review-session.json",
    );
    expect(installedSkill).not.toContain("npm run dev");
    expect(installedSkill).not.toContain("scripts/start-review.mjs");
  }
});

test("install-skill can install only the claude skill", () => {
  const home = mkdtempSync(resolve(tmpdir(), "organize-pr-topics-home-"));
  const output = runCli(["install-skill", "--agent", "claude"], { HOME: home });
  const claudePath = resolve(home, ".claude/skills/organize-pr-topics/SKILL.md");
  const opencodePath = resolve(
    home,
    ".config/opencode/skills/organize-pr-topics/SKILL.md",
  );

  expect(output).toContain(claudePath);
  expect(output).not.toContain(opencodePath);
  expect(existsSync(claudePath)).toBe(true);
  expect(existsSync(opencodePath)).toBe(false);
});

test("install-skill can install only the opencode skill", () => {
  const home = mkdtempSync(resolve(tmpdir(), "organize-pr-topics-home-"));
  const output = runCli(["install-skill", "--agent", "opencode"], { HOME: home });
  const claudePath = resolve(home, ".claude/skills/organize-pr-topics/SKILL.md");
  const opencodePath = resolve(
    home,
    ".config/opencode/skills/organize-pr-topics/SKILL.md",
  );

  expect(output).not.toContain(claudePath);
  expect(output).toContain(opencodePath);
  expect(existsSync(claudePath)).toBe(false);
  expect(existsSync(opencodePath)).toBe(true);
});

test("install-skill rejects invalid agent values", () => {
  const result = spawnSync(
    process.execPath,
    [cliPath, "install-skill", "--agent", "vim"],
    {
      cwd: tmpdir(),
      encoding: "utf8",
    },
  );

  expect(result.status).toBe(1);
  expect(result.stderr).toContain("Invalid agent: vim");
  expect(result.stderr).toContain("--agent claude|opencode|both");
});
```

- [ ] **Step 2: Run the focused CLI tests to verify they fail**

Run from `.opencode/skills/organize-pr-topics`:

```bash
npm test -- tests/cli.test.ts
```

Expected: FAIL. The help string still says `install-skill`, default install only writes opencode, and `--agent` is not implemented.

- [ ] **Step 3: Commit the failing tests**

```bash
git add .opencode/skills/organize-pr-topics/tests/cli.test.ts
git commit -m "test: cover dual agent skill installer"
```

---

### Task 2: Implement Dual-Agent Installer and Bundled Skill Files

**Files:**
- Modify: `.opencode/skills/organize-pr-topics/bin/organize-pr-topics.mjs`
- Create: `.opencode/skills/organize-pr-topics/skill/claude/SKILL.md`
- Create: `.opencode/skills/organize-pr-topics/skill/opencode/SKILL.md`
- Delete: `.opencode/skills/organize-pr-topics/skill/SKILL.md`

- [ ] **Step 1: Create the Claude bundled skill file**

Create `.opencode/skills/organize-pr-topics/skill/claude/SKILL.md` with:

```markdown
---
name: organize-pr-topics
description: Use when reviewing GitHub PRs with agent-proposed topics, organizing PR files by purpose, launching a local PR review GUI, or reducing cognitive debt in heavily agent-authored PRs.
---

# Organize PR Topics

Use this skill when the user wants to organize a GitHub pull request into review topics and review it in a local GUI.

## Workflow

1. Verify the CLI exists:

   ```bash
   organize-pr-topics --help
   ```

   If missing, tell the user to install it:

   ```bash
   npm install -g @sbakolis/organize-pr-topics
   organize-pr-topics install-skill --agent claude
   ```

2. Verify GitHub CLI:

   ```bash
   organize-pr-topics check-gh
   ```

3. Resolve the PR to review:
   - If the user invoked `/review-topics <pr-number>` or otherwise gave a PR selector, use that selector.
   - If no selector was provided, determine the checked-out branch and offer the most recent open PR for that branch as the default when found.
   - If no branch PR is found, ask for a PR number or offer recent open PRs.
4. Inspect the selected PR files and diff.
5. Propose topics by grouping changed files according to what each set of files does.
6. Prepare the review session:

   ```bash
   organize-pr-topics prepare-session .pr-topic-review-session.json
   ```

7. Read the generated session JSON.
8. Replace the fallback `topics` array with the agent-proposed topics.
9. Write the updated session JSON.
10. Launch the GUI:

   ```bash
   organize-pr-topics start-review .pr-topic-review-session.json
   ```

11. Ask the user to review and post comments from the GUI.
12. When the user asks for fixes, use the handoff prompt from the GUI to update the code and run tests.

## Topic Rules

- Topics must be proposed by the agent.
- Group files by user-visible behavior, subsystem, or implementation purpose.
- Keep topics small enough to review independently.
- Include a short rationale for why each file belongs in the topic.

## Safety

- Do not install `gh` automatically.
- Do not request GitHub tokens directly.
- Do not choose a PR without asking unless the user provided a PR selector argument.
- Do not invoke Claude Code or opencode from the GUI.
- Do not resolve GitHub comments unless the user explicitly asks.
```

- [ ] **Step 2: Create the opencode bundled skill file**

Create `.opencode/skills/organize-pr-topics/skill/opencode/SKILL.md` with:

```markdown
---
name: organize-pr-topics
description: Use when reviewing GitHub PRs with agent-proposed topics, organizing PR files by purpose, launching a local PR review GUI, or reducing cognitive debt in heavily agent-authored PRs.
license: MIT
compatibility: opencode
metadata:
  package: "@sbakolis/organize-pr-topics"
---

# Organize PR Topics

Use this skill when the user wants to organize a GitHub pull request into review topics and review it in a local GUI.

## Workflow

1. Verify the CLI exists:

   ```bash
   organize-pr-topics --help
   ```

   If missing, tell the user to install it:

   ```bash
   npm install -g @sbakolis/organize-pr-topics
   organize-pr-topics install-skill --agent opencode
   ```

2. Verify GitHub CLI:

   ```bash
   organize-pr-topics check-gh
   ```

3. Prepare the review session:

   ```bash
   organize-pr-topics prepare-session .pr-topic-review-session.json
   ```

4. Read the generated session JSON.
5. Replace or improve the fallback `topics` array with agent-proposed review topics.
6. Write the updated session JSON.
7. Launch the GUI:

   ```bash
   organize-pr-topics start-review .pr-topic-review-session.json
   ```

8. Ask the user to review and post comments from the GUI.

## Topic Rules

- Topics must be proposed by the agent.
- Group files by user-visible behavior, subsystem, or implementation purpose.
- Keep topics small enough to review independently.
- Include a short rationale for why each file belongs in the topic.

## Safety

- Do not install `gh` automatically.
- Do not request GitHub tokens directly.
- Do not invoke Claude Code or opencode from the GUI.
- Do not post comments unless the user explicitly chooses to post them from the GUI.
```

- [ ] **Step 3: Delete the old shared skill file**

Remove `.opencode/skills/organize-pr-topics/skill/SKILL.md` because the package now installs agent-specific skill files.

- [ ] **Step 4: Update the CLI installer**

In `.opencode/skills/organize-pr-topics/bin/organize-pr-topics.mjs`, replace the `HELP` string and `installSkill` function, and update the install command call.

Use this code for the help string:

```js
const HELP = `organize-pr-topics

Usage:
  organize-pr-topics --help
  organize-pr-topics install-skill [--agent claude|opencode|both]
  organize-pr-topics check-gh
  organize-pr-topics prepare-session [output-path]
  organize-pr-topics start-review <session-path>
`;
```

Use this code below `runNode`:

```js
const INSTALL_TARGETS = {
  claude: {
    source: "skill/claude/SKILL.md",
    target: ".claude/skills/organize-pr-topics/SKILL.md",
    restart: "Restart Claude Code for the installed skill to be loaded.",
  },
  opencode: {
    source: "skill/opencode/SKILL.md",
    target: ".config/opencode/skills/organize-pr-topics/SKILL.md",
    restart: "Restart opencode for the installed skill to be loaded.",
  },
};

function parseInstallAgent(args) {
  if (args.length === 0) {
    return "both";
  }

  if (args.length === 2 && args[0] === "--agent") {
    const agent = args[1];
    if (["claude", "opencode", "both"].includes(agent)) {
      return agent;
    }

    console.error(`Invalid agent: ${agent}`);
    console.error("Usage: organize-pr-topics install-skill [--agent claude|opencode|both]");
    process.exit(1);
  }

  console.error("Usage: organize-pr-topics install-skill [--agent claude|opencode|both]");
  process.exit(1);
}

async function installSkill(args) {
  const agent = parseInstallAgent(args);
  const targetNames = agent === "both" ? ["claude", "opencode"] : [agent];

  for (const targetName of targetNames) {
    const targetConfig = INSTALL_TARGETS[targetName];
    const source = resolve(packageDir, targetConfig.source);
    const target = resolve(homedir(), targetConfig.target);

    await mkdir(dirname(target), { recursive: true });
    await copyFile(source, target);
    console.log(`Installed organize-pr-topics skill to ${target}`);
    console.log(targetConfig.restart);
  }
}
```

Replace the install command branch in `main` with:

```js
  if (command === "install-skill") {
    await installSkill(args);
    return;
  }
```

- [ ] **Step 5: Run focused CLI tests to verify they pass**

Run from `.opencode/skills/organize-pr-topics`:

```bash
npm test -- tests/cli.test.ts
```

Expected: PASS for all tests in `tests/cli.test.ts`.

- [ ] **Step 6: Commit installer implementation**

```bash
git add .opencode/skills/organize-pr-topics/bin/organize-pr-topics.mjs .opencode/skills/organize-pr-topics/skill
git commit -m "feat: install claude and opencode skills"
```

---

### Task 3: Update Package Assertions and User Documentation

**Files:**
- Modify: `.opencode/skills/organize-pr-topics/tests/package.test.ts`
- Modify: `.opencode/skills/organize-pr-topics/README.md`
- Optional Modify: `.claude/skills/organize-pr-topics/SKILL.md`
- Optional Modify: `.claude/skills/organize-pr-topics/README.md`

- [ ] **Step 1: Replace the publishable skill test with agent-specific assertions**

In `.opencode/skills/organize-pr-topics/tests/package.test.ts`, replace lines 37-55 with:

```ts
test("package includes publishable claude and opencode skill instructions", () => {
  const packageRoot = process.cwd();
  const skillPaths = [
    resolve(packageRoot, "skill/claude/SKILL.md"),
    resolve(packageRoot, "skill/opencode/SKILL.md"),
  ];

  for (const skillPath of skillPaths) {
    expect(existsSync(skillPath), skillPath).toBe(true);

    const skill = readFileSync(skillPath, "utf8");
    expect(skill).toContain("name: organize-pr-topics");
    expect(skill).toContain("organize-pr-topics check-gh");
    expect(skill).toContain(
      "organize-pr-topics prepare-session .pr-topic-review-session.json",
    );
    expect(skill).toContain(
      "organize-pr-topics start-review .pr-topic-review-session.json",
    );
    expect(skill).not.toContain("npm run dev");
    expect(skill).not.toContain("scripts/start-review.mjs");
    expect(skill).not.toContain("node \"$SKILL_DIR");
  }

  const opencodeSkill = readFileSync(resolve(packageRoot, "skill/opencode/SKILL.md"), "utf8");
  expect(opencodeSkill).toContain("compatibility: opencode");
  expect(opencodeSkill).toContain('package: "@sbakolis/organize-pr-topics"');
});
```

- [ ] **Step 2: Update README user install instructions**

In `.opencode/skills/organize-pr-topics/README.md`, replace lines 12-31 with:

```markdown
## For Users

Install the CLI globally and install the agent skills:

```bash
npm install -g @sbakolis/organize-pr-topics
organize-pr-topics install-skill
```

By default, `install-skill` installs both supported agent skills:

- Claude Code: `~/.claude/skills/organize-pr-topics/SKILL.md`
- opencode: `~/.config/opencode/skills/organize-pr-topics/SKILL.md`

To install only one agent skill, use an explicit target:

```bash
organize-pr-topics install-skill --agent claude
organize-pr-topics install-skill --agent opencode
```

Restart the relevant agent after installing the skill. Then ask the agent to organize a GitHub PR into review topics, or invoke the installed skill naturally from a PR branch.

The installed skills use these global commands:

```bash
organize-pr-topics check-gh
organize-pr-topics prepare-session .pr-topic-review-session.json
organize-pr-topics start-review .pr-topic-review-session.json
```

No user should need to clone this repository, enter the package directory, run `npm install`, or run `npm run dev`.
```

- [ ] **Step 3: Run focused package tests to verify failures or passes**

Run from `.opencode/skills/organize-pr-topics`:

```bash
npm test -- tests/package.test.ts
```

Expected: PASS after Task 2 and the assertions above. If legacy `.claude` package tests fail because checked-in files are stale, update those files in the next step.

- [ ] **Step 4: Align checked-in Claude skill source only if tests require it**

If `tests/package.test.ts` fails because `.claude/skills/organize-pr-topics/SKILL.md` still references source-tree scripts, replace that file with the same content as `.opencode/skills/organize-pr-topics/skill/claude/SKILL.md`.

If `tests/package.test.ts` fails because `.claude/skills/organize-pr-topics/README.md` documents old install behavior, update it to mention:

```markdown
npm install -g @sbakolis/organize-pr-topics
organize-pr-topics install-skill --agent claude
```

- [ ] **Step 5: Commit package assertions and docs**

```bash
git add .opencode/skills/organize-pr-topics/tests/package.test.ts .opencode/skills/organize-pr-topics/README.md .claude/skills/organize-pr-topics/SKILL.md .claude/skills/organize-pr-topics/README.md
git commit -m "docs: document dual agent package install"
```

If the optional Claude files were not changed, omit them from `git add`.

---

### Task 4: Full Verification and Package Smoke Test

**Files:**
- No source files unless verification exposes a bug.

- [ ] **Step 1: Run typecheck**

Run from `.opencode/skills/organize-pr-topics`:

```bash
npm run typecheck
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 2: Run full test suite**

Run from `.opencode/skills/organize-pr-topics`:

```bash
npm test
```

Expected: PASS for all Vitest files.

- [ ] **Step 3: Run production build**

Run from `.opencode/skills/organize-pr-topics`:

```bash
npm run build
```

Expected: PASS and produce `dist/client` plus `dist/server/index.mjs`.

- [ ] **Step 4: Run npm package dry-run**

Run from `.opencode/skills/organize-pr-topics`:

```bash
npm pack --dry-run
```

Expected: PASS. Output includes these paths:

```text
package/bin/organize-pr-topics.mjs
package/skill/claude/SKILL.md
package/skill/opencode/SKILL.md
package/dist/server/index.mjs
```

- [ ] **Step 5: Create a packed tarball for smoke testing**

Run from `.opencode/skills/organize-pr-topics`:

```bash
npm pack
```

Expected: PASS and create a tarball named like `sbakolis-organize-pr-topics-0.1.0.tgz`.

- [ ] **Step 6: Smoke-test the packed installer in an isolated temp home**

Run from `.opencode/skills/organize-pr-topics` after replacing the tarball name if needed:

```bash
TMP_HOME="$(mktemp -d)"
TMP_PREFIX="$(mktemp -d)"
npm install -g --prefix "$TMP_PREFIX" ./sbakolis-organize-pr-topics-0.1.0.tgz
HOME="$TMP_HOME" "$TMP_PREFIX/bin/organize-pr-topics" install-skill
test -f "$TMP_HOME/.claude/skills/organize-pr-topics/SKILL.md"
test -f "$TMP_HOME/.config/opencode/skills/organize-pr-topics/SKILL.md"
"$TMP_PREFIX/bin/organize-pr-topics" --help
```

Expected: PASS. The installer writes both skill files and `--help` prints the command list.

- [ ] **Step 7: Smoke-test production server dry run from packed install**

Run from `.opencode/skills/organize-pr-topics`:

```bash
SESSION_PATH="$(mktemp)"
printf '{}\n' > "$SESSION_PATH"
ORGANIZE_PR_TOPICS_DRY_RUN_START=1 "$TMP_PREFIX/bin/organize-pr-topics" start-review "$SESSION_PATH"
```

Expected output contains:

```text
dist/server/index.mjs
NODE_ENV=production
PR_TOPIC_SESSION_PATH=
```

- [ ] **Step 8: Commit any verification fixes**

If verification required fixes, commit them:

```bash
git add .opencode/skills/organize-pr-topics
git commit -m "fix: complete dual agent package verification"
```

If verification required no fixes, do not create an empty commit.

- [ ] **Step 9: Report final status**

Summarize:

- Commits created.
- Verification commands run and results.
- Packed installer smoke-test result.
- Whether the package is ready for `npm publish` from `.opencode/skills/organize-pr-topics`.

---

## Self-Review

- Spec coverage: The plan implements one package, default both-agent install, explicit agent targeting, global CLI-only skill instructions, documentation updates, package dry-run, and isolated packed CLI smoke tests.
- Placeholder scan: No placeholder markers, vague implementation instructions, or undefined future steps remain.
- Type consistency: CLI test expectations, installer option names, target paths, and bundled skill paths match across tasks.

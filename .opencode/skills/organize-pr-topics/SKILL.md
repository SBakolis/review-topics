---
name: organize-pr-topics
description: Use when reviewing GitHub PRs with agent-proposed topics, organizing PR files by purpose, launching a local PR review GUI, or reducing cognitive debt in heavily agent-authored PRs.
---

# Organize PR Topics

Use this skill when the user wants to organize a GitHub pull request into review topics and review it in a local GUI.

## Workflow

1. Locate the skill directory that contains this `SKILL.md`; use that directory as `SKILL_DIR` for all bundled paths.
2. Verify the skill package is complete by checking that `scripts/check-gh.mjs`, `scripts/prepare-session.mjs`, and `scripts/start-review.mjs` exist under `SKILL_DIR`. If any are missing, stop and explain that the skill package is incomplete.
3. Verify GitHub CLI is installed by running `node "$SKILL_DIR/scripts/check-gh.mjs"`.
4. If `gh` is missing, tell the user to install it. On macOS, suggest `brew install gh`. For other platforms, link to `https://cli.github.com/`.
5. If `gh` is unauthenticated, tell the user to run `gh auth login`.
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
12. Instruct the user to post comments from the GUI.
13. When the user asks for fixes, use the handoff prompt from the GUI to update the code and run tests.

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

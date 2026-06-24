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
6. Resolve the current PR with `gh pr view` through the bundled scripts.
7. Inspect the PR files and diff.
8. Propose topics by grouping changed files according to what each set of files does.
9. Write the session JSON with the proposed topics through `scripts/prepare-session.mjs` under `SKILL_DIR`.
10. Start the bundled local review GUI through `scripts/start-review.mjs` under `SKILL_DIR`.
11. Instruct the user to post comments from the GUI.
12. When the user asks for fixes, use the handoff prompt from the GUI to update the code and run tests.

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

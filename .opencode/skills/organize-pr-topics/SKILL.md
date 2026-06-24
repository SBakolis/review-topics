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

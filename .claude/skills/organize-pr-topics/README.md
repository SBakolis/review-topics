# Organize PR Topics

This agent skill organizes the current GitHub PR into agent-proposed topics and launches a local review GUI.

## Requirements

- Node.js 20 or newer
- npm
- GitHub CLI (`gh`)
- An authenticated GitHub CLI session (`gh auth login`)

## Project-Local Use

For Claude Code, place this package at:

```text
.claude/skills/organize-pr-topics
```

For opencode, place this package at:

```text
.opencode/skills/organize-pr-topics
```

Restart the agent after adding this skill. Agents load skills at startup.

Ask the agent to organize the current PR into topics and launch the review GUI.

## Global Install

For Claude Code, copy this directory to:

```text
~/.claude/skills/organize-pr-topics
```

For opencode, copy this directory to:

```text
~/.config/opencode/skills/organize-pr-topics
```

Then restart the relevant agent.

## Troubleshooting

- Missing `gh`: install GitHub CLI. On macOS, run `brew install gh`.
- Unauthenticated `gh`: run `gh auth login`.
- No PR found: checkout a branch that has an open PR, or use `gh pr checkout <number>`.
- Comment anchoring failed: the GUI posts a PR-level fallback comment instead of risking a wrong inline anchor.

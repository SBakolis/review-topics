# Organize PR Topics

This opencode skill organizes the current GitHub PR into agent-proposed topics and launches a local review GUI.

## Requirements

- Node.js 20 or newer
- npm
- GitHub CLI (`gh`)
- An authenticated GitHub CLI session (`gh auth login`)

## Project-Local Use

Restart opencode after adding this skill. opencode loads skills at startup.

Ask the agent to organize the current PR into topics and launch the review GUI.

## Global Install

Copy this directory to:

```text
~/.config/opencode/skills/organize-pr-topics
```

Then restart opencode.

## Troubleshooting

- Missing `gh`: install GitHub CLI. On macOS, run `brew install gh`.
- Unauthenticated `gh`: run `gh auth login`.
- No PR found: checkout a branch that has an open PR, or use `gh pr checkout <number>`.
- Comment anchoring failed: the GUI posts a PR-level fallback comment instead of risking a wrong inline anchor.

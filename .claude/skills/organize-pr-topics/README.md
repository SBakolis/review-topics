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
packages/organize-pr-topics
```

Restart the agent after adding this skill. Agents load skills at startup.

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

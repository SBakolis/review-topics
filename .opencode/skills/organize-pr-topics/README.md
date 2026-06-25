# Organize PR Topics

This agent skill organizes the current GitHub PR into agent-proposed topics and launches a local review GUI.

## Requirements

- Node.js 20 or newer
- npm
- GitHub CLI (`gh`)
- An authenticated GitHub CLI session (`gh auth login`)

## For Users

Install the CLI globally and install the opencode skill:

```bash
npm install -g @sbakolis/organize-pr-topics
organize-pr-topics install-skill
```

Restart opencode after installing the skill. Then ask opencode to organize a GitHub PR into review topics, or invoke the installed skill naturally from a PR branch.

The installed skill uses these global commands:

```bash
organize-pr-topics check-gh
organize-pr-topics prepare-session .pr-topic-review-session.json
organize-pr-topics start-review .pr-topic-review-session.json
```

No user should need to clone this repository, enter the package directory, run `npm install`, or run `npm run dev`.

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

## For Development

Contributor setup from this package directory:

```bash
npm install
npm run dev
npm run build
npm test
```

`npm run dev` starts the TypeScript server with Vite middleware for local development only. Published users run the prebuilt production server through `organize-pr-topics start-review`.

Useful contributor commands:

```bash
npm run check-gh
npm run prepare-session -- .pr-topic-review-session.json
PR_TOPIC_SESSION_PATH=.pr-topic-review-session.json npm run dev
```

## Project-Local Development Install

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

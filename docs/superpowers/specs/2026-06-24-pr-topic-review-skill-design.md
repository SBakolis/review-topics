# PR Topic Review Skill Design

## Goal

Build a self-contained opencode skill that helps users understand heavily agent-authored GitHub PRs by organizing changed files into agent-proposed topics, launching a local GitHub-style review GUI, posting review comments to GitHub, and handing those comments back to the agent for fixes.

## Decisions

- GitHub integration uses the `gh` CLI as the only authentication and API boundary.
- The skill guides the user to install and authenticate `gh` when needed; it does not perform privileged installation automatically.
- Topics are always proposed by the agent based on what each set of changed files does.
- The GUI is a temporary local server for the current PR only.
- Review comments are posted to GitHub.
- The GUI uses an existing battle-tested React diff viewer rather than custom diff rendering.
- The first implementation is project-local under `.opencode/skills/organize-pr-topics/`, but it should be portable to `~/.config/opencode/skills/organize-pr-topics/`.

## Architecture

The skill ships all runtime pieces inside its directory:

- `SKILL.md` contains the agent workflow and trigger rules.
- `scripts/` contains `gh` checks, session preparation, and local server launch scripts.
- `app/` contains the local Node/React review application.
- `templates/` contains the post-review handoff prompt used to ask the agent to fix comments.
- `README.md` documents installation, global copy usage, and troubleshooting.

The agent prepares a session file from the current PR, including PR metadata, changed files, raw diff, and proposed topics. The local server reads that one session, serves the UI, accepts comments, posts them through `gh`, and generates the handoff prompt.

## Skill Workflow

1. Check `gh --version`.
2. If `gh` is missing, explain how to install GitHub CLI, including `brew install gh` on macOS and the official GitHub CLI installation page for other platforms.
3. Check `gh auth status`.
4. If unauthenticated, guide the user through `gh auth login`.
5. Resolve the current PR with `gh pr view`.
6. Fetch PR metadata and diff data through `gh`.
7. Analyze the changed files and create topics that group files by purpose.
8. Write a session JSON file for the GUI.
9. Start the bundled local server for the current PR.
10. Let the user review topics and post comments to GitHub.
11. Use the GUI-generated handoff prompt when the user asks the agent to fix the comments.

## GUI Behavior

The UI should be intentionally close to GitHub's PR review experience:

- Header with PR title, number, and GitHub link.
- Topic sidebar with topic title, purpose, files, and comment count.
- Main pane with selected topic summary and grouped file diffs.
- Inline comment composer for diff-line comments.
- Topic-level comment composer for broad feedback that cannot be anchored to a line.
- Submit controls for posting selected comments or all comments to GitHub.
- Handoff panel with a copyable prompt for the user to send back to opencode.

Desktop review is the primary target. Mobile should remain functional but does not need a highly optimized layout in the first version.

## Data Model

The session is current-PR scoped and ephemeral. It can be represented as JSON:

- `pr`: owner, repo, number, title, URL, base/head refs, and commit identifiers needed for review comments.
- `files`: changed file paths, statuses, and patch metadata.
- `diff`: raw unified diff text.
- `topics`: topic id, title, summary, rationale, and file paths.
- `comments`: comment id, topic id, body, optional path, optional line, side, kind, posting status, error text, and GitHub URL when posted.

No database is needed for the first version.

## GitHub Posting

The server posts through `gh` only:

- Inline comments should use the GitHub pull request review comment API via `gh api` where line anchoring is valid.
- Topic-level comments should post as PR-level comments when they cannot be safely anchored.
- Failed posts should keep the local comment and expose the failure in the UI.
- Successful posts should store the returned GitHub URL when available.

Anchored comments require explicit diff line mapping from the UI row to GitHub's expected `path`, `line`, and `side` fields. This mapping is a first-class implementation concern and needs fixture tests.

## Error Handling

- Missing `gh`: explain installation and stop.
- Unauthenticated `gh`: explain `gh auth login` and stop.
- No current PR: explain how to checkout a PR branch or run from a branch with an open PR.
- GitHub API failure: show the failed comment status and preserve the comment body for retry or manual posting.
- Unsafe line mapping: fall back to a PR-level comment rather than posting an incorrectly anchored inline comment.

## Testing

- Unit tests for session schema validation.
- Unit tests for diff line mapping and GitHub comment payload construction.
- Fixture tests for added, deleted, renamed, and multi-hunk files.
- Script tests for missing `gh`, unauthenticated `gh`, no PR, and valid PR detection.
- UI tests or component tests for topic navigation, comment creation, posting state, and handoff prompt generation.
- Manual smoke test against a real test PR before considering the skill usable.

## Scope Boundaries

- The first version handles one current PR at a time.
- It does not persist review sessions across multiple PRs.
- It does not invoke opencode directly from the GUI.
- It does not implement GitHub authentication itself.
- It does not try to resolve GitHub comments automatically.

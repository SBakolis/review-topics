# Review Topics Slash Command Design

## Goal

Add a `/review-topics` entrypoint for both opencode and Claude Code so users can start the PR topic review workflow directly. The command should ask which PR to review by default, offer the most recent PR for the checked-out branch when available, and support a direct PR number fast path.

## Approach

Keep the existing skill identity as `organize-pr-topics` and add project-local slash command shims for each agent:

- opencode: `.opencode/commands/review-topics.md`
- Claude Code: `.claude/commands/review-topics.md`

The command shims will instruct the agent to use the bundled `organize-pr-topics` skill workflow. This avoids renaming the skill package and keeps both agent integrations explicit.

## Command Behavior

When invoked as `/review-topics 123`, the command reviews PR `123` directly and skips the selection prompt.

When invoked as `/review-topics` without arguments, the command should:

1. Verify GitHub CLI availability and authentication using the skill's existing `check-gh.mjs` preflight.
2. Determine the checked-out branch.
3. Look for the most recent open PR for that branch with `gh pr list --head <branch> --state open --limit 1`.
4. Ask the user which PR to review, offering the branch PR as the default when found.
5. If no branch PR is found, ask for a PR number or offer recent open PRs as choices.

After resolving a PR, the command follows the existing topic review workflow: inspect files and diff, propose review topics, prepare the session JSON, replace fallback topics, launch the local GUI, and instruct the user to post comments from the GUI.

## Runtime Changes

Update `scripts/prepare-session.mjs` in both skill packages to accept an optional PR selector argument. When present, it should pass that selector to `gh pr view <selector>` and `gh pr diff <selector> --patch`; otherwise, it should keep the current checked-out-branch behavior.

Update both `SKILL.md` files so natural-language invocation and `/review-topics` invocation share the same PR resolution rules. The skill should not assume that the current checkout has a PR when the command path has selected a specific PR.

## Documentation

Update the package README files to document:

- `/review-topics` as the preferred command entrypoint.
- `/review-topics <pr-number>` as the direct fast path.
- The no-argument prompt behavior and checked-out-branch default.
- Existing natural-language invocation remains supported.

## Testing

Add package-level tests that verify both command files exist and mention:

- The optional PR number argument.
- The checked-out branch PR default.
- The fallback prompt when no branch PR exists.
- The `organize-pr-topics` skill workflow.

Add focused tests for PR selector argument handling in `prepare-session.mjs` by mocking the `gh` command boundary where feasible. Existing full test, typecheck, and build commands must continue to pass for both `.opencode` and `.claude` packages.

## Safety

GitHub access remains delegated to `gh`; the command must not request tokens directly. The GUI remains local and must not invoke Claude Code or opencode. The command should ask before choosing a PR unless the user provided a PR selector argument.

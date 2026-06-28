---
name: organize-pr-topics
description: Use when reviewing GitHub PRs by grouping changed files into focused review topics and launching a local review GUI.
license: MIT
compatibility: opencode
metadata:
  package: "@sbakolis/organize-pr-topics"
---

# Organize PR Topics

Use this skill when the user wants to organize the current GitHub pull request into purpose-based review topics and review it in a local GUI.

## Workflow

1. Verify the CLI exists:

   ```bash
   organize-pr-topics --help
   ```

   If missing, tell the user to install it:

   ```bash
   npm install -g @sbakolis/organize-pr-topics
   organize-pr-topics install-skill
   ```

   The installer detects `~/.claude` and `~/.config/opencode` and asks which agent skill to install. For an opencode-only non-interactive install, use `organize-pr-topics install-skill --agent opencode`.

2. Verify GitHub CLI access:

   ```bash
   organize-pr-topics check-gh
   ```

3. Resolve which PR to review:

   - If the user provided a PR selector, use it.
   - If no selector was provided, determine the checked-out branch and offer the most recent open PR for that branch as the default when found.
   - If no branch PR is found, ask for a PR number or offer recent open PRs.

4. Prepare the review session:

   ```bash
   organize-pr-topics prepare-session .pr-topic-review-session.json
   ```

   If the user provided or chose a PR selector, pass it with the supported `--pr <selector>` option when needed:

   ```bash
   organize-pr-topics prepare-session .pr-topic-review-session.json --pr <selector>
   ```

5. Read the generated session JSON.
6. Replace or improve the fallback `topics` array with agent-proposed review topics.
7. Write the updated session JSON.
8. Launch the GUI:

   ```bash
   organize-pr-topics start-review .pr-topic-review-session.json
   ```

9. Ask the user to review and post comments from the GUI.

## Topic Quality

- Topics must be proposed by the agent.
- Group files by user-visible behavior, subsystem, or implementation purpose.
- Keep topics small enough to review independently.
- Include a short rationale for why each file belongs in the topic.

## Safety

- Do not install `gh` automatically.
- Do not request GitHub tokens directly.
- Do not invoke Claude Code, opencode, or any coding agent from the GUI.
- Do not post comments unless the user explicitly chooses to post them from the GUI.

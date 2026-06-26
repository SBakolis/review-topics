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
   organize-pr-topics install-skill --agent opencode
   ```

2. Verify GitHub CLI access:

   ```bash
   organize-pr-topics check-gh
   ```

3. Prepare the review session:

   ```bash
   organize-pr-topics prepare-session .pr-topic-review-session.json
   ```

4. Read the generated session JSON.
5. Replace or improve the fallback `topics` array with agent-proposed review topics.
6. Write the updated session JSON.
7. Launch the GUI:

   ```bash
   organize-pr-topics start-review .pr-topic-review-session.json
   ```

8. Ask the user to review and post comments from the GUI.

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

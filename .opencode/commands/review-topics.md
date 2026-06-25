---
description: Organize a GitHub PR into review topics and launch the local review GUI
---

Use the project-local `organize-pr-topics` skill workflow to review a GitHub pull request.

Arguments: `$ARGUMENTS`

If `$ARGUMENTS` contains a PR number, use that PR directly and run the session preparation script with `prepare-session.mjs --pr <pr-number>`.

If `$ARGUMENTS` is empty:

1. Verify `gh` with the skill's `scripts/check-gh.mjs` preflight.
2. Determine the checked-out branch.
3. Look for the most recent open PR for the checked-out branch with `gh pr list --head <branch> --state open --limit 1 --json number,title,url,updatedAt`.
4. Ask the user which PR they want to review, offering that branch PR as the default when found.
5. If no branch PR is found, ask for a PR number or offer recent open PRs from `gh pr list --state open --limit 10 --json number,title,url,headRefName,updatedAt`.

After a PR is selected, inspect the PR files and diff, propose purpose-based review topics, run `prepare-session.mjs --pr <selector>`, replace the fallback topic in the generated session JSON, launch the local GUI, and instruct the user to post comments from the GUI.

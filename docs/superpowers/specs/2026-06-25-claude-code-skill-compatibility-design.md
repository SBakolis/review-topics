# Claude Code Skill Compatibility Design

## Goal

Make the PR topic review skill usable as a project-local Claude Code skill while preserving the existing opencode skill package.

## Approach

Add a second self-contained skill package at `.claude/skills/organize-pr-topics/`. The Claude Code package will contain the same runtime scripts, server, UI, templates, tests, package metadata, and lockfile as the opencode package so Claude Code can discover and run the skill without relying on cross-directory references.

## Documentation

The skill documentation should use agent-neutral wording where possible. The README must document both project-local install paths:

- Claude Code: `.claude/skills/organize-pr-topics/`
- opencode: `.opencode/skills/organize-pr-topics/`

Global install notes should include Claude Code's personal skill directory and opencode's skill directory. Restart guidance should refer to the relevant agent instead of only opencode.

## Runtime Behavior

No runtime architecture changes are required. Existing scripts derive `SKILL_DIR` from their own file path, so the duplicated Claude Code package can run independently from `.claude/skills/organize-pr-topics/`.

## Safety

The GUI must not invoke an agent directly. This should be documented agent-neutrally as “Do not invoke Claude Code or opencode from the GUI.” GitHub access remains through `gh` only.

## Verification

Add tests that fail while only the opencode package exists and pass once the Claude Code package is present. Run the full skill package checks from the Claude Code directory:

- `npm test`
- `npm run typecheck`
- `npm run build`

Also verify the copied scripts exist and the README mentions Claude Code install paths.

# Dual-Agent npm Package Design

## Context

`@sbakolis/organize-pr-topics` should be one global npm package that works for both Claude Code and opencode users. The package already exposes `organize-pr-topics` as a global CLI and can run the production review server without `npm run dev`. The current installer only writes an opencode skill, while the checked-in Claude skill still assumes bundled scripts live next to `SKILL.md`.

## Goals

- Keep one published npm package: `@sbakolis/organize-pr-topics`.
- Make `organize-pr-topics install-skill` work out of the box for both Claude Code and opencode.
- Preserve explicit installs for users who only want one agent.
- Ensure installed skills call the global CLI commands, not source-tree scripts or `npm run dev`.
- Keep contributor workflows unchanged.

## Non-Goals

- Do not publish separate Claude and opencode npm packages.
- Do not auto-install GitHub CLI or request GitHub tokens directly.
- Do not invoke Claude Code or opencode from the review GUI.

## User Interface

The CLI installer will support these forms:

```bash
organize-pr-topics install-skill
organize-pr-topics install-skill --agent both
organize-pr-topics install-skill --agent claude
organize-pr-topics install-skill --agent opencode
```

When `--agent` is provided, `install-skill` skips detection and writes the requested target(s):

- Claude Code: `~/.claude/skills/organize-pr-topics/SKILL.md`
- opencode: `~/.config/opencode/skills/organize-pr-topics/SKILL.md`

Invalid `--agent` values fail with a clear usage error.

Without `--agent`, the installer detects available agents by directory presence:

- Claude Code: `~/.claude`
- opencode: `~/.config/opencode`

If run in an interactive terminal and at least one agent is detected, it prompts for the install target. If both agents are detected, empty Enter defaults to `both`; if one agent is detected, empty Enter confirms that agent. If run non-interactively or no supported agent directories are detected, it exits with guidance to install an agent first or pass `--agent claude|opencode|both` explicitly.

## Package Layout

The package will bundle agent-specific skill files:

- `skill/claude/SKILL.md`
- `skill/opencode/SKILL.md`

Both skill files will instruct agents to use the same global commands:

```bash
organize-pr-topics check-gh
organize-pr-topics prepare-session .pr-topic-review-session.json
organize-pr-topics start-review .pr-topic-review-session.json
```

The opencode skill can keep opencode-specific metadata. The Claude skill can keep Claude-compatible frontmatter. Both should avoid references to source checkout paths, adjacent bundled scripts, or `npm run dev`.

## Testing

Update CLI and package tests to cover:

- Help documents the `--agent` installer option.
- Default install detects available agents and prompts in interactive terminals.
- Non-interactive default install exits with `--agent` guidance.
- Targeted install writes only the requested agent skill file.
- Installed skills reference global CLI commands.
- Installed skills do not reference `npm run dev` or source-tree script execution.
- Package dry-run includes the bundled skill files.

## Rollout

After implementation, run the package verification commands from the package directory:

```bash
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

Then smoke-test the packed global CLI from an isolated install before publishing.

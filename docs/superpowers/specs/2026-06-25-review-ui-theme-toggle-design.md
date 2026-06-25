# Review UI Theme Toggle Design

## Goal

Add a light/dark theme switch to the local PR topic review GUI while preserving the existing GitHub-like layout and review flow.

## Behavior

- On first load, the UI uses the user's system color preference from `prefers-color-scheme`.
- When the user toggles the theme, the chosen `light` or `dark` value is saved in `localStorage`.
- Future visits use the saved theme instead of the system preference.
- The toggle appears in the header, aligned to the right of the PR title/link block.

## Approach

Use semantic CSS variables and a `data-theme` attribute on `document.documentElement`.

- `data-theme="light"` and `data-theme="dark"` define the palette.
- Existing hard-coded colors in `styles.css` move to variables such as background, surface, border, text, muted text, accent, hover, selected, and diff colors.
- React owns only the small theme state and persistence logic.
- No server or session model changes are needed.

## Testing

- Add focused UI tests if the existing setup supports them without expanding tooling.
- Always verify with `npm run typecheck` and `npm run build` for the skill package.
- Manually confirm the toggle updates the live UI and persists after refresh.

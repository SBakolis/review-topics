# Review UI Theme Icon Switch Design

## Goal

Replace the text theme toggle in the local PR topic review GUI with a minimal icon-only switch.

## Behavior

- Keep the existing light/dark theme state, persistence, and `data-theme` application unchanged.
- Show only the active theme icon:
  - Light mode: `☀︎`
  - Dark mode: `☾`
- Clicking the switch toggles to the opposite theme.

## Accessibility

- Keep the native `button` element for keyboard and screen reader behavior.
- Add an `aria-label` and `title` that describe the action, not just the current state:
  - Dark mode active: `Switch to light theme`
  - Light mode active: `Switch to dark theme`
- Preserve a visible focus state.

## Styling

- Restyle `.theme-toggle` as a compact 34x34 circular icon button.
- Use existing CSS variables for background, border, text, hover, and accent colors.
- Keep the switch in the existing header position on the right.

## Testing

- Verify with `npm test`, `npm run typecheck`, and `npm run build`.
- Manually confirm the icon updates when toggling between light and dark themes.

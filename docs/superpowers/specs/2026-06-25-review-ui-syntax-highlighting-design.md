# Review UI Syntax Highlighting Design

## Goal

Add syntax highlighting to diff code lines in the local PR topic review GUI without changing the review/comment workflow.

## Scope

- Highlight only rendered diff content lines.
- Do not add highlighting to comment textareas or the agent handoff prompt textarea.
- Preserve existing line numbers, diff signs, selected-row styling, and click-to-comment behavior.

## Approach

Use Shiki in the client UI for high-quality, GitHub-like syntax highlighting.

- Add Shiki as a UI dependency.
- Create a focused syntax highlighting helper for file-path language detection and safe line highlighting.
- Map common review file extensions to Shiki languages, including TypeScript, TSX, JavaScript, JSX, CSS, JSON, Markdown, HTML, shell, YAML, and plain text fallbacks.
- Use `github-light` for light mode and `github-dark` for dark mode so syntax colors track the existing theme switch.
- Render highlighted code as React elements using safe token text, not raw HTML injection.

## Data Flow

`DiffReview` already receives the file path and mapped diff rows. Each `FileCard` will resolve the file language once, pass each row's `content` through the highlighter, and render highlighted spans inside the existing `.diff-content` element.

The app's current theme state will be available to diff rendering so the highlighter can choose the matching Shiki theme. Unknown languages, empty lines, or highlighter initialization failures render as plain text.

## Error Handling

- If Shiki fails to initialize, the diff remains readable as plain text.
- If a file extension is unknown, highlight as plain text.
- Highlighting must not block commenting; line rows remain clickable regardless of highlighting state.

## Testing

- Unit-test language detection for common extensions and unknown files.
- Unit-test fallback behavior for unknown languages and empty content.
- Verify the package with `npm test`, `npm run typecheck`, and `npm run build`.
- Manually confirm highlighted diff lines update between light and dark themes and comments still attach to clicked lines.

/** The note a first-time visitor sees. It doubles as a feature tour. */
export const WELCOME_NOTE = `# Welcome to md-notes

Your notes stay **in this browser**. They are saved to IndexedDB as you type
and are never uploaded anywhere.

## Try it

- Write Markdown on the left, see the preview on the right
- Search titles and text from the box in the sidebar, or filter with \`tag:ideas\`
- Add tags below the editor, then click one to filter by it
- Export a note as a \`.md\` file, or import \`.md\` files you already have

## Keyboard shortcuts

| Action | Keys |
| --- | --- |
| New note | Alt + N |
| Search | Ctrl/Cmd + K or / |
| Toggle preview | Alt + P |
| Save now | Ctrl/Cmd + S |

- [x] Read this note
- [ ] Write your own

> The optional "Summarize" button talks to an Ollama server on *your own*
> computer. It is off by default; see Settings.
`;

export const WELCOME_TAGS = ["getting-started"];

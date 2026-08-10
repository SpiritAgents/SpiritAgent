/**
 * Desktop-only host UI Markdown capabilities (Streamdown Mermaid).
 * Injected via session.create → server runtime system message; CLI / ACP omit this.
 */
export function buildDesktopUiMarkdownPromptSection(): string {
  return [
    "When a diagram helps (architecture, data flow, sequence), use a fenced mermaid code block; the host renders it.",
    "When writing create_plan content, if architecture or dataflow is non-obvious, include one short mermaid diagram.",
  ].join("\n");
}

export interface TerminalSnippetAttachment {
  id: string;
  /** Display name frozen at insert time (tab title or default Terminal label). */
  terminalName: string;
  /** 1-based buffer line numbers from xterm selection. */
  lineStart: number;
  lineEnd: number;
  /** Raw selected terminal text for the agent. */
  selectedText: string;
}

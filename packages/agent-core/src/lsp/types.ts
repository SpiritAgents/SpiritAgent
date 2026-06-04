export type LspDiagnosticSeverity = 1 | 2 | 3 | 4;

export interface LspPosition {
  line: number;
  character: number;
}

export interface LspRange {
  start: LspPosition;
  end: LspPosition;
}

export interface LspDiagnostic {
  range: LspRange;
  message: string;
  severity?: LspDiagnosticSeverity;
  code?: string | number;
  source?: string;
}

export type LspFileChangeKind = 'create_file' | 'edit_file' | 'delete_file';

export interface LspFileSnapshot {
  exists: boolean;
  content?: string;
}

export interface LspFileChangeNotification {
  kind: LspFileChangeKind;
  path: string;
  resolvedPath: string;
  before: LspFileSnapshot;
  after: LspFileSnapshot;
}

export interface LspDiagnosticsToolRequest {
  name: 'get_diagnostics';
  path: string;
}

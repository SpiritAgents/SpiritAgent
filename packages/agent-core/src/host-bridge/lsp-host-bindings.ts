import type { JsonValue, ToolExecutionOutput } from '../ports.js';
import type { LspReadyProviderSummary } from '../lsp/tool-definitions.js';

export interface LspHostServiceInstance {
  readonly enabled: boolean;
  probe(): Promise<boolean>;
  dispose(): Promise<void>;
  syncFromRecordedChange(change: unknown): Promise<void>;
  getDiagnosticsForPath(
    path: string,
    waitMs?: number,
  ): Promise<{ relativePath: string; diagnostics: unknown[]; formatted: string }>;
  readyProvidersForToolDefinitions(): readonly LspReadyProviderSummary[];
}

export interface LspHostBindings {
  LspService: new (
    workspaceRoot: string,
    timing?: unknown,
    userConfig?: { enabled: boolean },
  ) => LspHostServiceInstance;
  appendLspDiagnosticsAfterWriteIfNeeded: (
    lsp: LspHostServiceInstance | undefined,
    request: JsonValue,
    output: ToolExecutionOutput,
  ) => Promise<ToolExecutionOutput>;
}

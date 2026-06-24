import type { LspHostServiceInstance } from '../host-bridge/lsp-host-bindings.js';
import { formatDiagnosticsBatchForLlm } from './format-diagnostics.js';

function formatDiagnosticsFailure(path: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `Failed to get diagnostics for ${path}: ${message}`;
}

export async function executeGetDiagnostics(
  lsp: LspHostServiceInstance,
  paths: readonly string[],
): Promise<string> {
  const sections = await Promise.all(
    paths.map(async (inputPath) => {
      try {
        const result = await lsp.getDiagnosticsForPath(inputPath);
        return result.formatted;
      } catch (error) {
        return formatDiagnosticsFailure(inputPath, error);
      }
    }),
  );
  return formatDiagnosticsBatchForLlm(sections);
}

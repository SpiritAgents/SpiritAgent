import type { LspWriteDiagnosticsUi } from "@spiritagent/agent-core";

import type { ToolBlockSnapshot } from "@/types";

/** Secondary text of short tool cards (shell reason, file name, LSP summary, etc.). */
export const toolCardSecondaryTextClass = "text-muted-foreground/75 dark:text-muted-foreground/65";

/** An even lighter third level for shell `{command}` etc.; separated from the reason color so the summary line does not blur into one block. */
export const toolCardFileNameDetailClass = "text-muted-foreground/42 dark:text-muted-foreground/45";

/**
 * Fourth segment of the four-part shell card (failure status); the lightest level of the
 * summary line, lighter than the command segment {@link toolCardFileNameDetailClass}.
 * Grayscale (opacity): verb 100% → reason 75/65% → command 42/45% → failure 30/32%.
 */
export const toolCardFailedStatusClass = "text-muted-foreground/30 dark:text-muted-foreground/32";

/** Clickable short tool card trigger: the whole card summary brightens uniformly while keeping the grayscale hierarchy. */
export const clickableToolCardTriggerClass =
  "transition-[filter] duration-150 hover:brightness-[1.12] focus-visible:brightness-[1.12] motion-reduce:transition-none";

export function lspDiagnosticsCounts(diagnostics: LspWriteDiagnosticsUi): {
  errorCount: number;
  warningCount: number;
} {
  let errorCount = 0;
  let warningCount = 0;
  for (const item of diagnostics.items) {
    if (item.severity === "error") {
      errorCount += 1;
    } else if (item.severity === "warning") {
      warningCount += 1;
    }
  }
  return { errorCount, warningCount };
}

export function shouldShowLspDiagnosticsOnToolCard(
  tool: Pick<ToolBlockSnapshot, "phase" | "lspWriteDiagnostics">,
): tool is ToolBlockSnapshot & { lspWriteDiagnostics: LspWriteDiagnosticsUi } {
  if (tool.phase !== "succeeded" || !tool.lspWriteDiagnostics) {
    return false;
  }
  const { errorCount, warningCount } = lspDiagnosticsCounts(tool.lspWriteDiagnostics);
  return errorCount > 0 || warningCount > 0;
}

export function formatLspDiagnosticsSummaryLabel(
  errorCount: number,
  warningCount: number,
  translate: (key: string, options?: { count: number }) => string,
): string | undefined {
  const parts: string[] = [];
  if (errorCount > 0) {
    parts.push(translate("tool.lspErrorCount", { count: errorCount }));
  }
  if (warningCount > 0) {
    parts.push(translate("tool.lspWarningCount", { count: warningCount }));
  }
  return parts.length > 0 ? parts.join(", ") : undefined;
}

// 后续：设置页 / SPIRIT_LSP_* 环境变量覆盖 server 启动命令。

export interface LspTimingConfig {
  diagnosticsWaitMs: number;
  writeAppendDiagnosticsWaitMs: number;
  syncDebounceMs: number;
}

export const DEFAULT_LSP_TIMING: LspTimingConfig = {
  diagnosticsWaitMs: 4_000,
  writeAppendDiagnosticsWaitMs: 1_500,
  syncDebounceMs: 300,
};

import type { AgentRuntime, LlmTransportConfig, SpiritAgentMode } from '@spirit-agent/core';
import type { HostToolExecutorProxy } from '@spirit-agent/core/host-bridge';
import type { JsonValue } from '@spirit-agent/core';

/**
 * ACP Server configuration derived from environment variables or ACP parameters.
 */
export interface AcpServerConfig {
  /** LLM model name (default: 'gpt-4.1-mini') */
  model: string;
  /** API key for the LLM provider (required) */
  apiKey: string;
  /** Custom base URL for the LLM endpoint (optional) */
  baseUrl?: string;
  /** Workspace root path (default: process.cwd()) */
  workspaceRoot: string;
  /** Spirit data directory (default: APPDATA/SpiritAgent or ~/.spirit-agent) */
  spiritDataDir: string;
}

/**
 * Converts AcpServerConfig to an LlmTransportConfig usable by agent-core.
 */
export function toLlmTransportConfig(config: AcpServerConfig): LlmTransportConfig {
  const result: import('@spirit-agent/core').OpenAiTransportConfig = {
    transportKind: 'openai-compatible',
    apiKey: config.apiKey,
    model: config.model,
    workspaceRoot: config.workspaceRoot,
  };
  if (config.baseUrl !== undefined) {
    result.baseUrl = config.baseUrl;
  }
  return result;
}

/**
 * Per-session state for an ACP session.
 */
export interface AcpSessionState {
  readonly sessionId: string;
  readonly runtime: AgentRuntime<LlmTransportConfig, unknown, JsonValue, JsonValue>;
  readonly toolExecutor: HostToolExecutorProxy;
  readonly workspaceRoot: string;
  currentMode: SpiritAgentMode;
  /** AbortController for the currently running prompt turn (null if idle) */
  pendingPrompt: AbortController | null;
}

/**
 * Available ACP session modes advertised by Spirit Agent.
 */
export const AVAILABLE_MODES = [
  { id: 'agent' as const, name: 'Agent', description: 'Full tool access, autonomous coding' },
  { id: 'plan' as const, name: 'Plan', description: 'Design and plan without making changes' },
  { id: 'ask' as const, name: 'Ask', description: 'Ask permission before every change' },
  { id: 'debug' as const, name: 'Debug', description: 'Systematic bug investigation' },
] as const;

/**
 * Maps an ACP mode ID string to a SpiritAgentMode, with fallback to 'agent'.
 */
export function normalizeModeId(modeId: string): SpiritAgentMode {
  switch (modeId) {
    case 'agent':
    case 'plan':
    case 'ask':
    case 'debug':
      return modeId;
    default:
      return 'agent';
  }
}

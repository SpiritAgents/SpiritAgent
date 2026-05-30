import type { JsonValue, LlmMessage } from '../ports.js';
import type { LlmTransport } from '../ports.js';
import { buildToolAgentHostPrompt } from '../tool-agent.js';
import { llmHistoryToOpenAiMessages } from '../openai/tool-agent-helpers.js';
import type { ToolAgentState } from '../tool-agent.js';
import type { OpenResponsesTransportConfig } from './responses-compat.js';

/**
 * Open Responses transport 占位实现；Phase 2 起补全工具轮与流式能力。
 */
export class AiSdkOpenResponsesTransport
  implements LlmTransport<OpenResponsesTransportConfig, ToolAgentState>
{
  async startToolAgentRound(
    _config: OpenResponsesTransportConfig,
    _state: ToolAgentState,
    _tools: JsonValue,
  ): Promise<never> {
    throw new Error('Open Responses transport: startToolAgentRound 尚未实现。');
  }

  async startToolAgentRoundStreaming(
    _config: OpenResponsesTransportConfig,
    _state: ToolAgentState,
    _tools: JsonValue,
  ): Promise<never> {
    throw new Error('Open Responses transport: startToolAgentRoundStreaming 尚未实现。');
  }

  async compactHistoryManual(
    _config: OpenResponsesTransportConfig,
    _history: LlmMessage[],
    _onProgress?: (message: string) => void,
  ): Promise<never> {
    throw new Error('Open Responses transport: compactHistoryManual 尚未实现。');
  }

  compactSummaryText(_history: LlmMessage[]): string | undefined {
    return undefined;
  }

  isContextOverflowError(error: string): boolean {
    const normalized = error.toLowerCase();
    return (
      normalized.includes('context length') ||
      normalized.includes('maximum context length') ||
      normalized.includes('too many tokens') ||
      normalized.includes('context_window_exceeded')
    );
  }

  llmHistoryAsApiMessages(history: LlmMessage[]): JsonValue[] {
    return llmHistoryToOpenAiMessages(history);
  }

  llmSystemPromptsForExport(): JsonValue {
    return {
      tool_agent: buildToolAgentHostPrompt('—'),
    };
  }
}

export type LlmTransportKind = 'openai-compatible' | 'open-responses' | 'anthropic';

export interface LlmModelCapabilities {
  chat?: true;
  vision?: true;
  audioInput?: true;
  videoInput?: true;
  imageGeneration?: true;
}

export type LlmTransportKind = 'openai-compatible' | 'open-responses' | 'anthropic';

export interface LlmModelCapabilities {
  chat?: true;
  imageInput?: true;
  audioInput?: true;
  videoInput?: true;
  imageGeneration?: true;
}

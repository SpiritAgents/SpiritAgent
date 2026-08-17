export type LlmTransportKind = "openai-compatible" | "open-responses" | "anthropic" | "bedrock";

/** Policy profile distinguishing main Agent conversations from non-Agent lightweight LLM requests such as code completion. */
export type TransportRequestProfile = "agent" | "code-completion";

export interface LlmModelCapabilities {
  chat?: true;
  imageInput?: true;
  audioInput?: true;
  videoInput?: true;
  imageGeneration?: true;
}

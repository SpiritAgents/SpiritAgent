const HUGGING_FACE_ROUTING_POLICY_SUFFIXES = new Set(['fastest', 'cheapest', 'preferred']);

/** 从 model id routing suffix（`:groq` 等）解析 Inference Provider；策略 suffix 返回 undefined。 */
export function resolveHuggingFaceInferenceProviderFromModelId(
  modelId: string,
): string | undefined {
  const trimmed = modelId.trim();
  const colonIndex = trimmed.lastIndexOf(':');
  if (colonIndex < 0) {
    return undefined;
  }

  const suffix = trimmed.slice(colonIndex + 1).trim().toLowerCase();
  if (!suffix || HUGGING_FACE_ROUTING_POLICY_SUFFIXES.has(suffix)) {
    return undefined;
  }

  return suffix;
}

export function resolveHuggingFaceInferenceProvider(input: {
  modelId: string;
  inferenceProvider?: string;
}): string | undefined {
  return (
    resolveHuggingFaceInferenceProviderFromModelId(input.modelId)
    ?? input.inferenceProvider?.trim()
    ?? undefined
  );
}

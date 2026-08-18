const HUGGING_FACE_ROUTING_POLICY_SUFFIXES = new Set(["fastest", "cheapest", "preferred"]);

/** Resolves the Inference Provider from a model id routing suffix (e.g. `:groq`); policy suffixes return undefined. */
export function resolveHuggingFaceInferenceProviderFromModelId(
  modelId: string,
): string | undefined {
  const trimmed = modelId.trim();
  const colonIndex = trimmed.lastIndexOf(":");
  if (colonIndex < 0) {
    return undefined;
  }

  const suffix = trimmed
    .slice(colonIndex + 1)
    .trim()
    .toLowerCase();
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
    resolveHuggingFaceInferenceProviderFromModelId(input.modelId) ??
    input.inferenceProvider?.trim() ??
    undefined
  );
}

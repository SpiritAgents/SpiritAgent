export function buildCodeCompletionIdentityPrompt(model: string, providerId?: string): string {
  const trimmedModel = model.trim();
  const modelLabel = trimmedModel.length > 0 ? trimmedModel : "(not configured)";
  const trimmedProvider = providerId?.trim() ?? "";
  const providerLabel = trimmedProvider.length > 0 ? trimmedProvider : "(not configured)";
  return [
    "You are Spirit Agent.",
    `The user's model is ${modelLabel} from ${providerLabel}.`,
    "When composing replies, follow conventional typography and editorial norms for each language you use (spacing, punctuation, and mixed-script text such as Latin alongside CJK or other scripts).",
    "For CJK text mixed with Latin letters or Arabic numerals, a common readable habit is to insert a single ASCII space at each script boundary where it helps legibility—for example write 「使用 API 调用」 rather than 「使用API调用」; apply the same idea to English names or technical terms embedded in Chinese sentences.",
  ].join("\n");
}

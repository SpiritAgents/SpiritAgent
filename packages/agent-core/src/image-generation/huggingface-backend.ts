import { HfInference } from "@huggingface/inference";

import { resolveHuggingFaceInferenceProvider } from "../huggingface/inference-provider.js";
import type { OpenAiImageGenerationConfig } from "../openai/openai-compat.js";
import { normalizeGeneratedImageMarkdownRef } from "../openai/ai-sdk-transport.js";
import type {
  GeneratedImageFile,
  GeneratedImageSaveRequest,
  ImageGenerationRequest,
  ToolExecutionOutput,
} from "../ports.js";
import { createLlmMessageContentFromTextAndImages } from "../ports.js";

const DEFAULT_HUGGING_FACE_IMAGE_TIMEOUT_MS = 5 * 60 * 1000;

function blobMediaType(blob: Blob): string {
  const type = blob.type?.split(";")[0]?.trim();
  return type && type.length > 0 ? type : "image/png";
}

export async function generateHuggingFaceImage(
  config: OpenAiImageGenerationConfig,
  request: ImageGenerationRequest,
  saveGeneratedImage: (request: GeneratedImageSaveRequest) => Promise<GeneratedImageFile>,
): Promise<ToolExecutionOutput> {
  const provider = resolveHuggingFaceInferenceProvider({
    modelId: config.model,
    ...(config.inferenceProvider ? { inferenceProvider: config.inferenceProvider } : {}),
  });

  console.error("[agent-core][generate-image] request.start", {
    adapter: "huggingface",
    model: config.model,
    provider,
    size: request.size,
  });

  const hf = new HfInference(config.apiKey);
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), DEFAULT_HUGGING_FACE_IMAGE_TIMEOUT_MS);

  let blob: Blob;
  try {
    blob = await hf.textToImage(
      {
        model: config.model,
        inputs: request.prompt,
        ...(provider ? { provider: provider as never } : {}),
      },
      {
        signal: abortController.signal,
      },
    );
  } finally {
    clearTimeout(timeout);
  }

  const mediaType = blobMediaType(blob);
  const data = new Uint8Array(await blob.arrayBuffer());
  const saved = await saveGeneratedImage({
    data,
    mediaType,
    prompt: request.prompt,
    model: config.model,
  });

  console.error("[agent-core][generate-image] request.success", {
    adapter: "huggingface",
    model: config.model,
    mimeType: saved.mimeType,
  });

  const summaryLines = ["[generated image]"];
  const markdownRef = normalizeGeneratedImageMarkdownRef(saved.markdownRef);
  summaryLines.push(
    `image_ref: ${markdownRef}`,
    `read_file_path: ${markdownRef}`,
    `embed_markdown: ![Generated image](${markdownRef})`,
  );
  summaryLines.push(`mime_type: ${saved.mimeType}`, `model: ${config.model}`);
  const summaryText = summaryLines.join("\n");

  return {
    content: createLlmMessageContentFromTextAndImages(summaryText, [saved.path]),
    summaryText,
  };
}

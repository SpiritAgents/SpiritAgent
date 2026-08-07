import { ArkVideoBackend } from "./ark-video-backend.js";
import { isArkApiBase, isArkLlmVendor } from "../ark/ark-provider.js";
import type { OpenAiVideoGenerationConfig } from "../openai/openai-compat.js";
import type {
  GeneratedVideoFile,
  GeneratedVideoSaveRequest,
  ToolExecutionOutput,
  VideoGenerationRequest,
} from "../ports.js";
import { AiSdkGatewayVideoBackend } from "./ai-sdk-gateway-backend.js";
import { OpenRouterVideosBackend } from "./openrouter-videos-backend.js";
import { SiliconFlowVideoBackend } from "./siliconflow-backend.js";
import { TogetherVideosBackend } from "./together-videos-backend.js";
import { DeepInfraVideosBackend } from "./deepinfra-videos-backend.js";
import { HuggingFaceVideoBackend } from "./huggingface-backend.js";
import type { VideoGenerationBackend } from "./types.js";

const arkVideoBackend = new ArkVideoBackend();
const openRouterVideosBackend = new OpenRouterVideosBackend();
const aiSdkGatewayBackend = new AiSdkGatewayVideoBackend();
const siliconFlowVideoBackend = new SiliconFlowVideoBackend();
const togetherVideosBackend = new TogetherVideosBackend();
const deepInfraVideosBackend = new DeepInfraVideosBackend();
const huggingFaceVideoBackend = new HuggingFaceVideoBackend();

export function isSiliconFlowApiBase(baseUrl: string | undefined): boolean {
  if (!baseUrl) {
    return false;
  }

  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    return hostname.includes("siliconflow.com") || hostname.includes("siliconflow.cn");
  } catch {
    return false;
  }
}

/** @deprecated Use isArkApiBase from ark-provider */
export const isVolcengineArkApiBase = isArkApiBase;

export function isTogetherAiApiBase(baseUrl: string | undefined): boolean {
  if (!baseUrl) {
    return false;
  }

  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    return hostname.includes("together.ai") || hostname.includes("together.xyz");
  } catch {
    return false;
  }
}

export function isHuggingFaceApiBase(baseUrl: string | undefined): boolean {
  if (!baseUrl) {
    return false;
  }

  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    return hostname.includes("huggingface.co");
  } catch {
    return false;
  }
}

export function isDeepInfraApiBase(baseUrl: string | undefined): boolean {
  if (!baseUrl) {
    return false;
  }

  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    return hostname.includes("deepinfra.com");
  } catch {
    return false;
  }
}

export function resolveVideoGenerationBackend(
  config: OpenAiVideoGenerationConfig,
): VideoGenerationBackend {
  if (config.llmVendor === "vercel-ai-gateway") {
    return aiSdkGatewayBackend;
  }

  if (config.llmVendor === "openrouter") {
    return openRouterVideosBackend;
  }

  if (config.llmVendor === "together-ai" || isTogetherAiApiBase(config.baseUrl)) {
    return togetherVideosBackend;
  }

  if (config.llmVendor === "deepinfra" || isDeepInfraApiBase(config.baseUrl)) {
    return deepInfraVideosBackend;
  }

  if (config.llmVendor === "hugging-face" || isHuggingFaceApiBase(config.baseUrl)) {
    return huggingFaceVideoBackend;
  }

  if (config.llmVendor === "siliconflow" || isSiliconFlowApiBase(config.baseUrl)) {
    return siliconFlowVideoBackend;
  }

  if (isArkLlmVendor(config.llmVendor) || isArkApiBase(config.baseUrl)) {
    return arkVideoBackend;
  }

  throw new Error(
    "No video generation backend is configured for the selected video model. Use Volcengine Ark, BytePlus ModelArk, Vercel AI Gateway, OpenRouter, SiliconFlow, Together AI, DeepInfra, or Hugging Face.",
  );
}

export async function generateVideoWithRouter(
  config: OpenAiVideoGenerationConfig,
  request: VideoGenerationRequest,
  saveGeneratedVideo: (request: GeneratedVideoSaveRequest) => Promise<GeneratedVideoFile>,
): Promise<ToolExecutionOutput> {
  const backend = resolveVideoGenerationBackend(config);
  try {
    return await backend.generate(config, request, saveGeneratedVideo);
  } catch (error) {
    console.error("[agent-core][generate-video] request.failed", {
      adapter: backend.id,
      model: config.model,
      baseUrl: config.baseUrl,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

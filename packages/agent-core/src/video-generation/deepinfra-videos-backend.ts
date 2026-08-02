import { getLlmFetch } from '../llm-fetch.js';
import type { OpenAiVideoGenerationConfig } from '../openai/openai-compat.js';
import type {
  GeneratedVideoFile,
  GeneratedVideoSaveRequest,
  ToolExecutionOutput,
  VideoGenerationRequest,
} from '../ports.js';
import { pollUntil } from './poll.js';
import { buildGeneratedVideoToolOutput } from './output.js';
import type { VideoGenerationBackend } from './types.js';

interface DeepInfraVideoCreateResponse {
  id?: string;
}

interface DeepInfraVideoStatusResponse {
  status?: string;
  error?: string | { message?: string };
  data?: Array<{
    video_url?: string;
    url?: string;
    output_url?: string;
  }>;
}

const DEFAULT_DEEPINFRA_VIDEO_API_BASE = 'https://api.deepinfra.com/v1';

/**
 * DeepInfra 视频生成挂在站点根 `/v1/videos`（不在 OpenAI 兼容根 `/v1/openai` 下）。
 * 连接配置存的是 …/v1/openai，须剥掉尾部 /openai；与 Together 的 v1→v2 改写不同，不复用。
 */
export function resolveDeepInfraVideoApiBase(baseUrl: string | undefined): string {
  const trimmed = baseUrl?.trim().replace(/\/+$/, '');
  if (!trimmed) {
    return DEFAULT_DEEPINFRA_VIDEO_API_BASE;
  }
  return trimmed.endsWith('/openai') ? trimmed.slice(0, -'/openai'.length) : trimmed;
}

function readDeepInfraVideoUrl(payload: DeepInfraVideoStatusResponse): string | undefined {
  if (!Array.isArray(payload.data)) {
    return undefined;
  }
  for (const item of payload.data) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const candidate = item.video_url ?? item.url ?? item.output_url;
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return undefined;
}

function readDeepInfraVideoError(payload: DeepInfraVideoStatusResponse): string | undefined {
  const error = payload.error;
  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }
  if (typeof error === 'object' && error !== null && typeof error.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }
  return undefined;
}

export class DeepInfraVideosBackend implements VideoGenerationBackend {
  readonly id = 'deepinfra-videos';

  async generate(
    config: OpenAiVideoGenerationConfig,
    request: VideoGenerationRequest,
    saveGeneratedVideo: (request: GeneratedVideoSaveRequest) => Promise<GeneratedVideoFile>,
  ): Promise<ToolExecutionOutput> {
    const videoBaseUrl = resolveDeepInfraVideoApiBase(config.baseUrl);
    const createUrl = `${videoBaseUrl}/videos`;

    console.error('[agent-core][generate-video] request.start', {
      adapter: this.id,
      model: config.model,
      baseUrl: config.baseUrl,
      videoBaseUrl,
      createUrl,
      duration: request.duration,
      aspectRatio: request.aspectRatio,
      resolution: request.resolution,
    });

    // 请求体字段以 DeepInfra OpenAPI 为准：seconds 为 integer（非 Together 的字符串）；
    // image_url 是 I2V 首帧参数，与 generate_video 工具的 T2V 入参无关，首版不接（扩展点）。
    const createResponse = await getLlmFetch()(createUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        prompt: request.prompt,
        ...(request.duration !== undefined ? { seconds: request.duration } : {}),
        ...(request.aspectRatio ? { aspect_ratio: request.aspectRatio } : {}),
        ...(request.resolution ? { size: request.resolution } : {}),
      }),
    });

    if (!createResponse.ok) {
      const body = await createResponse.text();
      throw new Error(`DeepInfra video task creation failed (${createResponse.status}): ${body}`);
    }

    const created = (await createResponse.json()) as DeepInfraVideoCreateResponse;
    const taskId = created.id?.trim();
    if (!taskId) {
      throw new Error('DeepInfra video task creation returned no task id.');
    }

    const statusUrl = `${videoBaseUrl}/videos/${encodeURIComponent(taskId)}`;
    const completed = await pollUntil(async () => {
      const statusResponse = await getLlmFetch()(statusUrl, {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
        },
      });
      if (!statusResponse.ok) {
        const body = await statusResponse.text();
        throw new Error(`DeepInfra video task polling failed (${statusResponse.status}): ${body}`);
      }

      const status = (await statusResponse.json()) as DeepInfraVideoStatusResponse;
      const state = status.status?.toLowerCase();
      if (state === 'completed' || state === 'succeeded' || state === 'success') {
        return status;
      }
      if (state === 'failed' || state === 'error') {
        throw new Error(
          readDeepInfraVideoError(status) ?? `DeepInfra video task ended with status: ${status.status}`,
        );
      }
      return undefined;
    });

    const videoUrl = readDeepInfraVideoUrl(completed);
    if (!videoUrl) {
      throw new Error('DeepInfra video task completed without a downloadable video URL.');
    }

    const downloadResponse = await fetch(videoUrl);
    if (!downloadResponse.ok) {
      throw new Error(`Failed to download DeepInfra video (${downloadResponse.status}).`);
    }

    const mediaType = downloadResponse.headers.get('content-type')?.split(';', 1)[0]?.trim() || 'video/mp4';
    const data = new Uint8Array(await downloadResponse.arrayBuffer());
    const saved = await saveGeneratedVideo({
      data,
      mediaType,
      prompt: request.prompt,
      model: config.model,
    });

    console.error('[agent-core][generate-video] request.success', {
      adapter: this.id,
      model: config.model,
      taskId,
      savedPath: saved.path,
      mimeType: saved.mimeType,
    });

    return buildGeneratedVideoToolOutput(saved, config, request);
  }
}

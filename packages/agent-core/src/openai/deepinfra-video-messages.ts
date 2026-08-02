import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

import type { JsonObject, JsonValue } from '../ports.js';
import {
  resolveOpenAiModelCompatibilityProfile,
  type OpenAiTransportConfig,
} from './openai-compat.js';
import { resolveLocalMediaPath } from './openai-multimodal-media-path.js';

/**
 * DeepInfra 视频输入：无 Chat 专用 Files upload（`/v1/openai/files` 仅 Batch，purpose=batch|fine-tune），
 * 本地视频按 Xiaomi 同款方式内联为 `data:{MIME};base64,{...}` 写入 `video_url.url`。
 * 公网 https / 已有 data: URL 不改写。
 *
 * 文档未写死上传上限，首版不设大小硬 cap；实测遇 413/400 再补阈值。
 */
export function resolveDeepInfraVideoUrlsInOpenAiMessages(
  config: OpenAiTransportConfig,
  messages: JsonValue[],
  assetRoot = process.cwd(),
): void {
  if (config.llmVendor !== 'deepinfra') {
    return;
  }

  const profile = resolveOpenAiModelCompatibilityProfile(config);
  if (!profile.capabilities.videoInput) {
    return;
  }

  for (const message of messages) {
    if (!isJsonObject(message) || message.role !== 'user' || !Array.isArray(message.content)) {
      continue;
    }

    for (const part of message.content) {
      if (!isJsonObject(part) || part.type !== 'video_url') {
        continue;
      }

      const rawVideoUrl = part['video_url'];
      if (typeof rawVideoUrl !== 'object' || rawVideoUrl === null || Array.isArray(rawVideoUrl)) {
        continue;
      }

      const urlValue = rawVideoUrl['url'];
      if (typeof urlValue !== 'string') {
        continue;
      }

      const url = urlValue.trim();
      if (!needsDeepInfraEmbeddedVideoBase64(url)) {
        continue;
      }

      const absolutePath = resolveLocalMediaPath(url, assetRoot);
      rawVideoUrl['url'] = pathToDeepInfraEmbeddedVideoDataUrl(absolutePath);
    }
  }
}

function needsDeepInfraEmbeddedVideoBase64(url: string): boolean {
  return (
    url.length > 0
    && !url.startsWith('http://')
    && !url.startsWith('https://')
    && !url.startsWith('data:')
    && !url.startsWith('ms://')
    && !url.startsWith('mm_file://')
  );
}

function pathToDeepInfraEmbeddedVideoDataUrl(absolutePath: string): string {
  const bytes = readFileSync(absolutePath);
  const base64 = Buffer.from(bytes).toString('base64');
  const mime = guessDeepInfraVideoMimeFromPath(absolutePath);
  return `data:${mime};base64,${base64}`;
}

function guessDeepInfraVideoMimeFromPath(path: string): string {
  switch (extname(path).toLowerCase()) {
    case '.mp4':
      return 'video/mp4';
    case '.mov':
      return 'video/quicktime';
    case '.webm':
      return 'video/webm';
    case '.avi':
      return 'video/x-msvideo';
    case '.wmv':
      return 'video/x-ms-wmv';
    default:
      return 'video/mp4';
  }
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

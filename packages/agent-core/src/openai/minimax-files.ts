import { readFile, stat } from 'node:fs/promises';
import { basename } from 'node:path';

import { getLlmFetch } from '../llm-fetch.js';
import type { OpenAiTransportConfig } from './openai-compat.js';
import { normalizeOpenAiCompatibleApiBase } from './moonshot-files.js';

/**
 * MiniMax 视频理解：经 Files API 上传，purpose 必须为 video_understanding。
 * 文档：https://platform.minimaxi.com/docs/api-reference/file-management-upload
 * 图片上传留待后续统一，本次不走 Files API。
 */
const DEFAULT_MINIMAX_FILES_API_BASE = 'https://api.minimax.io/v1';

const uploadCache = new Map<string, string>();

/** 从 Chat / Anthropic baseUrl 推导 Files API 根（`.../v1`）。 */
export function normalizeMinimaxFilesApiBase(baseUrl: string | undefined): string {
  const trimmed = normalizeOpenAiCompatibleApiBase(baseUrl ?? DEFAULT_MINIMAX_FILES_API_BASE);
  if (!trimmed) {
    return DEFAULT_MINIMAX_FILES_API_BASE;
  }

  const withoutAnthropic = trimmed.replace(/\/anthropic\/v1$/i, '/v1');
  if (withoutAnthropic !== trimmed) {
    return withoutAnthropic;
  }

  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
}

export async function uploadMinimaxVideoFile(
  config: Pick<OpenAiTransportConfig, 'apiKey' | 'baseUrl'>,
  absolutePath: string,
): Promise<string> {
  const apiBase = normalizeMinimaxFilesApiBase(config.baseUrl);
  if (!apiBase) {
    throw new Error('MiniMax video upload requires baseUrl');
  }

  const metadata = await stat(absolutePath);
  const cacheKey = `${absolutePath}\0${metadata.mtimeMs}`;
  const cached = uploadCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const bytes = await readFile(absolutePath);
  const form = new FormData();
  form.append('file', new Blob([bytes]), basename(absolutePath));
  form.append('purpose', 'video_understanding');

  const response = await getLlmFetch()(`${apiBase}/files/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: form,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`MiniMax video upload failed (${response.status}): ${body}`);
  }

  const payload = (await response.json()) as { file_id?: unknown; id?: unknown };
  const fileId = readMinimaxUploadedFileId(payload);
  if (!fileId) {
    throw new Error('MiniMax video upload returned no file id');
  }

  const url = `mm_file://${fileId}`;
  uploadCache.set(cacheKey, url);
  return url;
}

function readMinimaxUploadedFileId(payload: { file_id?: unknown; id?: unknown }): string | undefined {
  if (typeof payload.file_id === 'string' && payload.file_id.trim().length > 0) {
    return payload.file_id.trim();
  }
  if (typeof payload.id === 'string' && payload.id.trim().length > 0) {
    return payload.id.trim();
  }
  return undefined;
}

export function clearMinimaxVideoUploadCache(): void {
  uploadCache.clear();
}

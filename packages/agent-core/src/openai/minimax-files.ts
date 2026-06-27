import { readFile, stat } from 'node:fs/promises';
import { basename } from 'node:path';

import { FormData } from 'undici';

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
    // 必须用 undici 的 FormData：getLlmFetch 走 undici 包 fetch，与全局 FormData 非同源，
    // 全局 FormData 会被当普通对象字符串化、丢失 multipart 边界头（MiniMax 报 2013）。
    // 全局 fetch 类型不认 undici FormData，故此处断言桥接。
    body: form as unknown as BodyInit,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`MiniMax video upload failed (${response.status}): ${body}`);
  }

  const payload = (await response.json()) as unknown;
  const fileId = readMinimaxUploadedFileId(payload);
  if (!fileId) {
    throw new Error('MiniMax video upload returned no file id');
  }

  const url = `mm_file://${fileId}`;
  uploadCache.set(cacheKey, url);
  return url;
}

/**
 * MiniMax Files API 实际返回 `{ file: { file_id: <number> } }`，file_id 为数字且嵌套在 file 下。
 * 文档：https://platform.minimaxi.com/docs/api-reference/file-management-upload
 * 兼容顶层 file_id/id 仅作兜底；同时接受 string 与 number。
 */
function readMinimaxUploadedFileId(payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null) {
    return undefined;
  }
  const root = payload as Record<string, unknown>;
  const file = typeof root.file === 'object' && root.file !== null ? (root.file as Record<string, unknown>) : undefined;
  const candidates: unknown[] = [file?.file_id, file?.id, root.file_id, root.id];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return String(candidate);
    }
  }
  return undefined;
}

export function clearMinimaxVideoUploadCache(): void {
  uploadCache.clear();
}

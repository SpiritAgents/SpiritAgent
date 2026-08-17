import { readFileSync } from "node:fs";
import { extname } from "node:path";

import type { JsonObject, JsonValue } from "../ports.js";
import {
  resolveOpenAiModelCompatibilityProfile,
  type OpenAiTransportConfig,
} from "./openai-compat.js";
import { resolveLocalMediaPath } from "./openai-multimodal-media-path.js";

/**
 * MiMo video understanding does not support the Files API / local file upload; it only accepts public URLs or data URL Base64.
 * Docs: https://mimo.mi.com/docs/zh-CN/quick-start/usage-guide/multimodal-understanding/video-understanding?target=%E8%A7%86%E9%A2%91%E4%BC%A0%E5%85%A5%E6%96%B9%E5%BC%8F
 */
const MIMO_VIDEO_BASE64_MAX_ENCODED_BYTES = 50 * 1024 * 1024;

/** Rewrites a local video_url into the `data:{MIME};base64,{raw Base64}` form required by MiMo. */
export function resolveXiaomiVideoUrlsInOpenAiMessages(
  config: OpenAiTransportConfig,
  messages: JsonValue[],
  assetRoot = process.cwd(),
): void {
  if (config.llmVendor !== "xiaomi") {
    return;
  }

  const profile = resolveOpenAiModelCompatibilityProfile(config);
  if (!profile.capabilities.videoInput) {
    return;
  }

  for (const message of messages) {
    if (!isJsonObject(message) || message.role !== "user" || !Array.isArray(message.content)) {
      continue;
    }

    for (const part of message.content) {
      if (!isJsonObject(part) || part.type !== "video_url") {
        continue;
      }

      const rawVideoUrl = part["video_url"];
      if (typeof rawVideoUrl !== "object" || rawVideoUrl === null || Array.isArray(rawVideoUrl)) {
        continue;
      }

      const urlValue = rawVideoUrl["url"];
      if (typeof urlValue !== "string") {
        continue;
      }

      const url = urlValue.trim();
      if (!needsXiaomiEmbeddedVideoBase64(url)) {
        continue;
      }

      const absolutePath = resolveLocalMediaPath(url, assetRoot);
      rawVideoUrl["url"] = pathToXiaomiEmbeddedVideoDataUrl(absolutePath);
    }
  }
}

function needsXiaomiEmbeddedVideoBase64(url: string): boolean {
  return (
    url.length > 0 &&
    !url.startsWith("http://") &&
    !url.startsWith("https://") &&
    !url.startsWith("data:") &&
    !url.startsWith("ms://")
  );
}

function pathToXiaomiEmbeddedVideoDataUrl(absolutePath: string): string {
  const bytes = readFileSync(absolutePath);
  const base64 = Buffer.from(bytes).toString("base64");
  if (Buffer.byteLength(base64, "utf8") > MIMO_VIDEO_BASE64_MAX_ENCODED_BYTES) {
    throw new Error(
      "MiMo video must not exceed 50 MB after Base64 encoding; use a public URL or shorten the video instead." +
        " See https://mimo.mi.com/docs/zh-CN/quick-start/usage-guide/multimodal-understanding/video-understanding",
    );
  }

  const mime = guessMimoVideoMimeFromPath(absolutePath);
  return `data:${mime};base64,${base64}`;
}

function guessMimoVideoMimeFromPath(path: string): string {
  switch (extname(path).toLowerCase()) {
    case ".mp4":
      return "video/mp4";
    case ".mov":
      return "video/quicktime";
    case ".avi":
      return "video/x-msvideo";
    case ".wmv":
      return "video/x-ms-wmv";
    default:
      return "video/mp4";
  }
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

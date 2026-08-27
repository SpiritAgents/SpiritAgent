const MOONSHOT_VIDEO_MEDIA_TYPES = new Set([
  "video/mp4",
  "video/mpeg",
  "video/mov",
  "video/avi",
  "video/x-flv",
  "video/mpg",
  "video/webm",
  "video/wmv",
  "video/3gpp",
]);

const IANA_VIDEO_MEDIA_TYPE_TO_MOONSHOT: Record<string, string> = {
  "video/quicktime": "video/mov",
  "video/x-msvideo": "video/avi",
  "video/x-ms-wmv": "video/wmv",
};

function parseVideoDataUrl(url: string): { mediaType: string; data: string } | undefined {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(url.trim());
  if (!match) {
    return undefined;
  }

  const mediaType = match[1]?.trim().toLowerCase();
  const data = match[2]?.trim();
  if (!mediaType || !data) {
    return undefined;
  }

  return { mediaType, data };
}

function moonshotVideoMediaType(mediaType: string): string {
  if (MOONSHOT_VIDEO_MEDIA_TYPES.has(mediaType)) {
    return mediaType;
  }

  return IANA_VIDEO_MEDIA_TYPE_TO_MOONSHOT[mediaType] ?? mediaType;
}

export function buildAiSdkUserVideoFilePartFromUrl(url: string): Record<string, unknown> {
  const trimmed = url.trim();
  const dataUrl = parseVideoDataUrl(trimmed);
  if (dataUrl) {
    return {
      type: "file",
      mediaType: moonshotVideoMediaType(dataUrl.mediaType),
      data: {
        type: "data",
        data: dataUrl.data,
      },
    };
  }

  return {
    type: "file",
    mediaType: "video/*",
    data: {
      type: "url",
      url: trimmed,
    },
  };
}

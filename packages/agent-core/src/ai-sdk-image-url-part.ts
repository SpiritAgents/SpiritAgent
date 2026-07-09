function parseImageDataUrl(url: string): { mediaType: string; data: string } | undefined {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(url.trim());
  if (!match) {
    return undefined;
  }

  const mediaType = match[1]?.trim();
  const data = match[2]?.trim();
  if (!mediaType || !data) {
    return undefined;
  }

  return { mediaType, data };
}

export function buildAiSdkUserImageFilePartFromUrl(url: string): Record<string, unknown> {
  const trimmed = url.trim();
  const dataUrl = parseImageDataUrl(trimmed);
  if (dataUrl) {
    return {
      type: 'file',
      mediaType: dataUrl.mediaType,
      data: {
        type: 'data',
        data: dataUrl.data,
      },
    };
  }

  return {
    type: 'file',
    mediaType: 'image/*',
    data: {
      type: 'url',
      url: trimmed,
    },
  };
}

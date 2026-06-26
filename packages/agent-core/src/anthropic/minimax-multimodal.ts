import type { AnthropicTransportConfig } from './anthropic-compat.js';

export function isMinimaxAnthropicConfig(
  config: Pick<AnthropicTransportConfig, 'baseUrl'>,
): boolean {
  const base = config.baseUrl?.trim().toLowerCase() ?? '';
  return base.includes('minimax');
}

export type MinimaxAnthropicImageSource =
  | { type: 'url'; url: string }
  | { type: 'base64'; media_type: string; data: string };

export function parseDataUrlToAnthropicImageSource(
  value: string,
): MinimaxAnthropicImageSource | undefined {
  const trimmed = value.trim();
  const match = /^data:([^;]+);base64,(.+)$/i.exec(trimmed);
  if (!match) {
    return undefined;
  }

  const mediaType = match[1]?.trim();
  const data = match[2]?.trim();
  if (!mediaType || !data) {
    return undefined;
  }

  return {
    type: 'base64',
    media_type: mediaType,
    data,
  };
}

export function mapMinimaxAnthropicImageContentPart(
  imageUrl: string,
): Record<string, unknown> {
  const trimmed = imageUrl.trim();
  const source = parseDataUrlToAnthropicImageSource(trimmed)
    ?? { type: 'url' as const, url: trimmed };
  return {
    type: 'image',
    source,
  };
}

export function mapMinimaxAnthropicVideoContentPart(
  videoUrl: string,
): Record<string, unknown> {
  return {
    type: 'video',
    source: {
      type: 'url',
      url: videoUrl.trim(),
    },
  };
}

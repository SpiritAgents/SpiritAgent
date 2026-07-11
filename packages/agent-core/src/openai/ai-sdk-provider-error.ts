import type { JsonValue } from '../ports.js';
import { isJsonObject } from '../tool-agent.js';

type AiSdkApiCallError = Error & {
  statusCode?: number;
  responseBody?: unknown;
  data?: unknown;
};

function tryParseJsonValue(value: unknown): JsonValue | undefined {
  if (typeof value !== 'string') {
    return value as JsonValue | undefined;
  }

  try {
    return JSON.parse(value) as JsonValue;
  } catch {
    return undefined;
  }
}

function readNestedApiErrorMessage(body: JsonValue | undefined): string | undefined {
  if (!isJsonObject(body)) {
    return undefined;
  }

  const nestedError = body.error;
  if (isJsonObject(nestedError) && typeof nestedError.message === 'string') {
    const message = nestedError.message.trim();
    if (message) {
      return message;
    }
  }

  if (typeof body.message === 'string') {
    const message = body.message.trim();
    if (message) {
      return message;
    }
  }

  return undefined;
}

function extractAiSdkApiErrorMessage(error: AiSdkApiCallError): string | undefined {
  const direct = error.message.trim();
  if (direct) {
    return direct;
  }

  const fromResponseBody = readNestedApiErrorMessage(tryParseJsonValue(error.responseBody));
  if (fromResponseBody) {
    return fromResponseBody;
  }

  const fromData = readNestedApiErrorMessage(tryParseJsonValue(error.data));
  if (fromData) {
    return fromData;
  }

  if (typeof error.statusCode === 'number') {
    const label = error.name?.trim() || 'API request failed';
    return `${label} (HTTP ${error.statusCode})`;
  }

  return undefined;
}

/** Render AI SDK provider errors for user-visible turn failure text. */
export function renderAiSdkProviderError(error: unknown): string {
  if (error instanceof Error) {
    return extractAiSdkApiErrorMessage(error) ?? (error.name.trim() || 'Unknown error');
  }

  return String(error);
}

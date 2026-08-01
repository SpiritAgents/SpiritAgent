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

function isUselessRenderedProviderError(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length === 0 || trimmed === '[object Object]';
}

function readProviderErrorMessageField(error: Record<string, unknown>): string | undefined {
  const errorMessage = error.error_message;
  if (typeof errorMessage !== 'string') {
    return undefined;
  }
  const trimmed = errorMessage.trim();
  if (!trimmed) {
    return undefined;
  }
  const fromNested = readNestedApiErrorMessage(tryParseJsonValue(trimmed));
  if (fromNested) {
    return fromNested;
  }
  return trimmed;
}

function extractPlainObjectProviderError(error: Record<string, unknown>): string | undefined {
  const fromErrorMessageField = readProviderErrorMessageField(error);
  if (fromErrorMessageField) {
    return fromErrorMessageField;
  }

  for (const key of ['value', 'cause'] as const) {
    const nested = error[key];
    if (nested === undefined || nested === error) {
      continue;
    }
    const rendered = renderAiSdkProviderError(nested);
    if (!isUselessRenderedProviderError(rendered)) {
      return rendered;
    }
  }

  const fromNested = readNestedApiErrorMessage(error as JsonValue);
  if (fromNested) {
    return fromNested;
  }

  const asApiError = error as unknown as AiSdkApiCallError;
  if (
    typeof error.responseBody !== 'undefined'
    || typeof error.statusCode === 'number'
    || typeof error.message === 'string'
  ) {
    const fromApi = extractAiSdkApiErrorMessage(asApiError);
    if (fromApi && !isUselessRenderedProviderError(fromApi)) {
      return fromApi;
    }
  }

  if (typeof error.message === 'string') {
    const message = error.message.trim();
    if (message && !isUselessRenderedProviderError(message)) {
      return message;
    }
  }

  if (typeof error.name === 'string' && typeof error.statusCode === 'number') {
    const label = error.name.trim() || 'API request failed';
    return `${label} (HTTP ${error.statusCode})`;
  }

  return undefined;
}

function extractAiSdkApiErrorMessage(error: AiSdkApiCallError): string | undefined {
  const direct = typeof error.message === 'string' ? error.message.trim() : '';
  if (direct && !isUselessRenderedProviderError(direct)) {
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
    const rendered = extractAiSdkApiErrorMessage(error);
    if (rendered && !isUselessRenderedProviderError(rendered)) {
      return rendered;
    }
    if ('cause' in error && error.cause !== undefined && error.cause !== error) {
      const fromCause = renderAiSdkProviderError(error.cause);
      if (!isUselessRenderedProviderError(fromCause)) {
        return fromCause;
      }
    }
    return rendered ?? (error.name.trim() || 'Unknown error');
  }

  if (isJsonObject(error as JsonValue)) {
    const fromObject = extractPlainObjectProviderError(error as Record<string, unknown>);
    if (fromObject) {
      return fromObject;
    }
  }

  return String(error);
}

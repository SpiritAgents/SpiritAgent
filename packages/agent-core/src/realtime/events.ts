import type { Experimental_RealtimeModelV4ServerEvent } from '@ai-sdk/provider';

import type { RealtimeEvent, RealtimeSessionConfig } from './types.js';

function decodeBase64Audio(delta: string): Uint8Array {
  return Uint8Array.from(Buffer.from(delta, 'base64'));
}

export function mapSdkRealtimeServerEvent(
  event: Experimental_RealtimeModelV4ServerEvent,
): RealtimeEvent | RealtimeEvent[] {
  switch (event.type) {
    case 'session-created':
      return {
        type: 'session-created',
        ...(event.sessionId ? { sessionId: event.sessionId } : {}),
        raw: event.raw,
      };
    case 'session-updated':
      return { type: 'session-updated', raw: event.raw };
    case 'speech-started':
      return {
        type: 'speech-started',
        ...(event.itemId ? { itemId: event.itemId } : {}),
        raw: event.raw,
      };
    case 'speech-stopped':
      return {
        type: 'speech-stopped',
        ...(event.itemId ? { itemId: event.itemId } : {}),
        raw: event.raw,
      };
    case 'audio-committed':
      return {
        type: 'audio-committed',
        ...(event.itemId ? { itemId: event.itemId } : {}),
        ...(event.previousItemId ? { previousItemId: event.previousItemId } : {}),
        raw: event.raw,
      };
    case 'conversation-item-added':
      return {
        type: 'conversation-item-added',
        itemId: event.itemId,
        item: event.item,
        raw: event.raw,
      };
    case 'input-transcription-completed':
      return {
        type: 'input-transcription-completed',
        itemId: event.itemId,
        transcript: event.transcript,
        raw: event.raw,
      };
    case 'response-created':
      return { type: 'response-created', responseId: event.responseId, raw: event.raw };
    case 'response-done':
      return {
        type: 'response-done',
        responseId: event.responseId,
        status: event.status,
        raw: event.raw,
      };
    case 'output-item-added':
      return {
        type: 'output-item-added',
        responseId: event.responseId,
        itemId: event.itemId,
        raw: event.raw,
      };
    case 'output-item-done':
      return {
        type: 'output-item-done',
        responseId: event.responseId,
        itemId: event.itemId,
        raw: event.raw,
      };
    case 'content-part-added':
      return {
        type: 'content-part-added',
        responseId: event.responseId,
        itemId: event.itemId,
        raw: event.raw,
      };
    case 'content-part-done':
      return {
        type: 'content-part-done',
        responseId: event.responseId,
        itemId: event.itemId,
        raw: event.raw,
      };
    case 'text-delta':
      return {
        type: 'text-delta',
        responseId: event.responseId,
        itemId: event.itemId,
        text: event.delta,
        raw: event.raw,
      };
    case 'text-done':
      return {
        type: 'text-done',
        responseId: event.responseId,
        itemId: event.itemId,
        ...(event.text ? { text: event.text } : {}),
        raw: event.raw,
      };
    case 'audio-delta':
      return {
        type: 'audio-delta',
        responseId: event.responseId,
        itemId: event.itemId,
        data: decodeBase64Audio(event.delta),
        raw: event.raw,
      };
    case 'audio-done':
      return {
        type: 'audio-done',
        responseId: event.responseId,
        itemId: event.itemId,
        raw: event.raw,
      };
    case 'audio-transcript-delta':
      return {
        type: 'audio-transcript-delta',
        responseId: event.responseId,
        itemId: event.itemId,
        text: event.delta,
        raw: event.raw,
      };
    case 'audio-transcript-done':
      return {
        type: 'audio-transcript-done',
        responseId: event.responseId,
        itemId: event.itemId,
        ...(event.transcript ? { transcript: event.transcript } : {}),
        raw: event.raw,
      };
    case 'function-call-arguments-delta':
      return {
        type: 'function-call-arguments-delta',
        responseId: event.responseId,
        itemId: event.itemId,
        callId: event.callId,
        delta: event.delta,
        raw: event.raw,
      };
    case 'function-call-arguments-done':
      return {
        type: 'function-call-arguments-done',
        responseId: event.responseId,
        itemId: event.itemId,
        callId: event.callId,
        name: event.name,
        argumentsJson: event.arguments,
        raw: event.raw,
      };
    case 'error':
      return {
        type: 'error',
        message: event.message,
        ...(event.code ? { code: event.code } : {}),
        raw: event.raw,
      };
    case 'custom':
      return { type: 'custom', rawType: event.rawType, raw: event.raw };
    default:
      return { type: 'custom', rawType: 'unknown', raw: event };
  }
}

export function mapSdkRealtimeServerEvents(
  events: Experimental_RealtimeModelV4ServerEvent | Experimental_RealtimeModelV4ServerEvent[],
): RealtimeEvent[] {
  const normalized = Array.isArray(events) ? events : [events];
  return normalized.flatMap((event) => {
    const mapped = mapSdkRealtimeServerEvent(event);
    return Array.isArray(mapped) ? mapped : [mapped];
  });
}

export function toSdkRealtimeSessionConfig(
  config: RealtimeSessionConfig | undefined,
): Record<string, unknown> | undefined {
  if (!config) {
    return undefined;
  }

  const turnDetection = buildSdkTurnDetection(config.turnDetection);
  const providerOptions = mergeProviderOptions(
    config.providerOptions,
    buildTurnDetectionProviderOptions(config.turnDetection),
  );

  return {
    ...(config.instructions ? { instructions: config.instructions } : {}),
    ...(config.voice ? { voice: config.voice } : {}),
    ...(config.outputModalities ? { outputModalities: config.outputModalities } : {}),
    ...(config.inputAudioFormat ? { inputAudioFormat: config.inputAudioFormat } : {}),
    ...(config.outputAudioFormat ? { outputAudioFormat: config.outputAudioFormat } : {}),
    ...(config.inputAudioTranscription !== undefined
      ? {
        inputAudioTranscription: config.inputAudioTranscription === true
          ? {}
          : config.inputAudioTranscription,
      }
      : {}),
    ...(config.outputAudioTranscription !== undefined
      ? {
        outputAudioTranscription: config.outputAudioTranscription === true
          ? {}
          : config.outputAudioTranscription,
      }
      : {}),
    ...(turnDetection !== undefined ? { turnDetection } : {}),
    ...(providerOptions ? { providerOptions } : {}),
  };
}

function buildSdkTurnDetection(
  turnDetection: RealtimeSessionConfig['turnDetection'],
): Record<string, unknown> | null | undefined {
  if (turnDetection === undefined) {
    return undefined;
  }
  if (turnDetection === null) {
    return null;
  }

  return {
    type: turnDetection.type,
    ...(turnDetection.threshold !== undefined ? { threshold: turnDetection.threshold } : {}),
    ...(turnDetection.silenceDurationMs !== undefined
      ? { silenceDurationMs: turnDetection.silenceDurationMs }
      : {}),
    ...(turnDetection.prefixPaddingMs !== undefined
      ? { prefixPaddingMs: turnDetection.prefixPaddingMs }
      : {}),
  };
}

function buildTurnDetectionProviderOptions(
  turnDetection: RealtimeSessionConfig['turnDetection'],
): Record<string, unknown> | undefined {
  if (!turnDetection || turnDetection.type === 'disabled') {
    return undefined;
  }

  const hasConversationFlags = turnDetection.createResponse !== undefined
    || turnDetection.interruptResponse !== undefined;
  if (!hasConversationFlags) {
    return undefined;
  }

  const turnDetectionWire: Record<string, unknown> = {
    type: turnDetection.type === 'server-vad' ? 'server_vad' : 'semantic_vad',
    ...(turnDetection.createResponse !== undefined
      ? { create_response: turnDetection.createResponse }
      : {}),
    ...(turnDetection.interruptResponse !== undefined
      ? { interrupt_response: turnDetection.interruptResponse }
      : {}),
  };

  return {
    audio: {
      input: {
        turn_detection: turnDetectionWire,
      },
    },
  };
}

function mergeProviderOptions(
  base: Record<string, unknown> | undefined,
  extra: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!base && !extra) {
    return undefined;
  }
  if (!base) {
    return extra;
  }
  if (!extra) {
    return base;
  }

  return deepMergeRecords(base, extra);
}

function deepMergeRecords(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...left };
  for (const [key, value] of Object.entries(right)) {
    const existing = merged[key];
    if (
      typeof value === 'object'
      && value !== null
      && !Array.isArray(value)
      && typeof existing === 'object'
      && existing !== null
      && !Array.isArray(existing)
    ) {
      merged[key] = deepMergeRecords(
        existing as Record<string, unknown>,
        value as Record<string, unknown>,
      );
      continue;
    }
    merged[key] = value;
  }
  return merged;
}

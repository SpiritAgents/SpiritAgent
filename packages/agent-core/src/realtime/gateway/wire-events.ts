import type { Experimental_RealtimeModelV4ServerEvent } from '@ai-sdk/provider';

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : undefined;
}

function withOptionalField<T extends Experimental_RealtimeModelV4ServerEvent>(
  base: T,
  key: string,
  value: string | undefined,
): Experimental_RealtimeModelV4ServerEvent {
  if (value === undefined) {
    return base;
  }
  return { ...base, [key]: value } as Experimental_RealtimeModelV4ServerEvent;
}

export function mapGatewayWireServerEvent(raw: unknown): Experimental_RealtimeModelV4ServerEvent {
  const event = asRecord(raw);
  if (!event) {
    return { type: 'custom', rawType: 'invalid', raw };
  }

  const type = readString(event.type);
  if (!type) {
    return { type: 'custom', rawType: 'missing-type', raw };
  }

  if (!type.includes('.')) {
    return raw as Experimental_RealtimeModelV4ServerEvent;
  }

  const session = asRecord(event.session);
  const response = asRecord(event.response);
  const item = asRecord(event.item);
  const error = asRecord(event.error);

  switch (type) {
    case 'session.created': {
      const sessionId = readString(session?.id);
      return withOptionalField({
        type: 'session-created',
        raw,
      }, 'sessionId', sessionId);
    }
    case 'session.updated':
      return { type: 'session-updated', raw };
    case 'input_audio_buffer.speech_started': {
      const itemId = readString(event.item_id);
      return withOptionalField({
        type: 'speech-started',
        raw,
      }, 'itemId', itemId);
    }
    case 'input_audio_buffer.speech_stopped': {
      const itemId = readString(event.item_id);
      return withOptionalField({
        type: 'speech-stopped',
        raw,
      }, 'itemId', itemId);
    }
    case 'input_audio_buffer.committed': {
      const itemId = readString(event.item_id);
      const previousItemId = readString(event.previous_item_id);
      return withOptionalField(
        withOptionalField({
          type: 'audio-committed',
          raw,
        }, 'itemId', itemId),
        'previousItemId',
        previousItemId,
      );
    }
    case 'conversation.item.added':
      return {
        type: 'conversation-item-added',
        itemId: readString(item?.id) ?? readString(event.item_id) ?? 'unknown',
        item: event.item,
        raw,
      };
    case 'conversation.item.input_audio_transcription.completed':
      return {
        type: 'input-transcription-completed',
        itemId: readString(event.item_id) ?? 'unknown',
        transcript: readString(event.transcript) ?? '',
        raw,
      };
    case 'response.created':
      return {
        type: 'response-created',
        responseId: readString(response?.id) ?? readString(event.response_id) ?? 'unknown',
        raw,
      };
    case 'response.done':
      return {
        type: 'response-done',
        responseId: readString(response?.id) ?? readString(event.response_id) ?? 'unknown',
        status: readString(response?.status) ?? 'completed',
        raw,
      };
    case 'response.output_item.added':
      return {
        type: 'output-item-added',
        responseId: readString(event.response_id) ?? 'unknown',
        itemId: readString(item?.id) ?? readString(event.item_id) ?? 'unknown',
        raw,
      };
    case 'response.output_item.done':
      return {
        type: 'output-item-done',
        responseId: readString(event.response_id) ?? 'unknown',
        itemId: readString(item?.id) ?? readString(event.item_id) ?? 'unknown',
        raw,
      };
    case 'response.content_part.added':
      return {
        type: 'content-part-added',
        responseId: readString(event.response_id) ?? 'unknown',
        itemId: readString(event.item_id) ?? 'unknown',
        raw,
      };
    case 'response.content_part.done':
      return {
        type: 'content-part-done',
        responseId: readString(event.response_id) ?? 'unknown',
        itemId: readString(event.item_id) ?? 'unknown',
        raw,
      };
    case 'response.output_audio.delta':
      return {
        type: 'audio-delta',
        responseId: readString(event.response_id) ?? 'unknown',
        itemId: readString(event.item_id) ?? 'unknown',
        delta: readString(event.delta) ?? '',
        raw,
      };
    case 'response.output_audio.done':
      return {
        type: 'audio-done',
        responseId: readString(event.response_id) ?? 'unknown',
        itemId: readString(event.item_id) ?? 'unknown',
        raw,
      };
    case 'response.output_audio_transcript.delta':
      return {
        type: 'audio-transcript-delta',
        responseId: readString(event.response_id) ?? 'unknown',
        itemId: readString(event.item_id) ?? 'unknown',
        delta: readString(event.delta) ?? '',
        raw,
      };
    case 'response.output_audio_transcript.done': {
      const transcript = readString(event.transcript);
      return withOptionalField({
        type: 'audio-transcript-done',
        responseId: readString(event.response_id) ?? 'unknown',
        itemId: readString(event.item_id) ?? 'unknown',
        raw,
      }, 'transcript', transcript);
    }
    case 'response.output_text.delta':
      return {
        type: 'text-delta',
        responseId: readString(event.response_id) ?? 'unknown',
        itemId: readString(event.item_id) ?? 'unknown',
        delta: readString(event.delta) ?? '',
        raw,
      };
    case 'response.output_text.done': {
      const text = readString(event.text);
      return withOptionalField({
        type: 'text-done',
        responseId: readString(event.response_id) ?? 'unknown',
        itemId: readString(event.item_id) ?? 'unknown',
        raw,
      }, 'text', text);
    }
    case 'response.function_call_arguments.delta':
      return {
        type: 'function-call-arguments-delta',
        responseId: readString(event.response_id) ?? 'unknown',
        itemId: readString(event.item_id) ?? 'unknown',
        callId: readString(event.call_id) ?? 'unknown',
        delta: readString(event.delta) ?? '',
        raw,
      };
    case 'response.function_call_arguments.done':
      return {
        type: 'function-call-arguments-done',
        responseId: readString(event.response_id) ?? 'unknown',
        itemId: readString(event.item_id) ?? 'unknown',
        callId: readString(event.call_id) ?? 'unknown',
        name: readString(event.name) ?? 'unknown',
        arguments: readString(event.arguments) ?? '{}',
        raw,
      };
    case 'error': {
      const code = readString(error?.code) ?? readString(event.code);
      return withOptionalField({
        type: 'error',
        message: readString(error?.message) ?? readString(event.message) ?? 'Unknown error',
        raw,
      }, 'code', code);
    }
    default:
      return { type: 'custom', rawType: type, raw };
  }
}

export function normalizeGatewayServerEvent(
  parsed: Experimental_RealtimeModelV4ServerEvent | Experimental_RealtimeModelV4ServerEvent[] | unknown,
): Experimental_RealtimeModelV4ServerEvent | Experimental_RealtimeModelV4ServerEvent[] {
  if (Array.isArray(parsed)) {
    return parsed.map((event) => normalizeGatewayServerEvent(event) as Experimental_RealtimeModelV4ServerEvent);
  }

  const directType = readString(asRecord(parsed)?.type);
  if (directType?.includes('.')) {
    return mapGatewayWireServerEvent(parsed);
  }

  const normalized = parsed as Experimental_RealtimeModelV4ServerEvent;
  if (normalized.type === 'custom' && typeof normalized.rawType === 'string' && normalized.rawType.includes('.')) {
    return mapGatewayWireServerEvent(normalized.raw);
  }

  const raw = asRecord(normalized.raw);
  const rawType = readString(raw?.type);
  if (rawType?.includes('.')) {
    return mapGatewayWireServerEvent(normalized.raw);
  }

  return normalized;
}

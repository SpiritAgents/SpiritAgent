import type { JsonObject } from '../ports.js';
import { RESPONSES_BUILT_IN_SPIRIT_UI_KEY } from '../open-responses/responses-built-in-tools.js';

const SPIRIT_UI_OUTPUT_EXCERPT_MAX = 4_000;

export type StepfunWebSearchSpiritUi = {
  inputExcerpt: string;
  headlineDetail?: string;
  outputExcerpt?: string;
};

function truncateSpiritUiOutputExcerpt(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= SPIRIT_UI_OUTPUT_EXCERPT_MAX) {
    return trimmed;
  }
  return `${trimmed.slice(0, SPIRIT_UI_OUTPUT_EXCERPT_MAX)}…`;
}

export function buildStepfunWebSearchSpiritUi(
  query: string,
  options?: { outputExcerpt?: string },
): StepfunWebSearchSpiritUi {
  const trimmedQuery = query.trim();
  const spiritUi: StepfunWebSearchSpiritUi = {
    inputExcerpt: trimmedQuery.length > 0 ? trimmedQuery : 'Web search',
    ...(trimmedQuery.length > 0 ? { headlineDetail: trimmedQuery } : {}),
  };
  const outputExcerpt = options?.outputExcerpt?.trim();
  if (outputExcerpt) {
    spiritUi.outputExcerpt = truncateSpiritUiOutputExcerpt(outputExcerpt);
  }
  return spiritUi;
}

export function buildStepfunWebSearchToolPreviewArgumentsJson(input: {
  query?: string;
  status?: string;
  failed?: boolean;
  outputExcerpt?: string;
}): string {
  const query = typeof input.query === 'string' ? input.query.trim() : '';
  const spiritUi = buildStepfunWebSearchSpiritUi(query, {
    ...(input.outputExcerpt ? { outputExcerpt: input.outputExcerpt } : {}),
  });
  const payload: JsonObject = {
    status: input.failed ? 'failed' : (input.status ?? 'completed'),
    [RESPONSES_BUILT_IN_SPIRIT_UI_KEY]: spiritUi as JsonObject,
  };
  return JSON.stringify(payload);
}

import type { LlmTokenUsage } from '../ports.js';

import type { RuntimeEvent } from './types.js';

export function emitContextUsageUpdated<ToolRequest>(
  emitEvent: (event: RuntimeEvent<ToolRequest>) => void,
  usage: LlmTokenUsage | undefined,
): void {
  if (!usage) {
    return;
  }

  emitEvent({ kind: 'context-usage-updated', usage });
}

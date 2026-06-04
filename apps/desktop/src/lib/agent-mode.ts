import { normalizeSpiritAgentMode, type SpiritAgentMode } from '@spirit-agent/agent-core';

export type DesktopAgentMode = SpiritAgentMode;

export function resolveDesktopAgentMode(input?: {
  agentMode?: DesktopAgentMode;
  planMode?: boolean;
}): DesktopAgentMode {
  return normalizeSpiritAgentMode(input);
}

export function runModeLabel(mode: DesktopAgentMode): string {
  switch (mode) {
    case 'plan':
      return 'Plan';
    case 'ask':
      return 'Ask';
    default:
      return 'Agent';
  }
}

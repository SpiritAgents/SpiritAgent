export type ComposerRealtimeVoiceLayoutMode = 'hidden' | 'primary' | 'ghost';

export type ComposerRealtimeVoiceLayout = {
  mode: ComposerRealtimeVoiceLayoutMode;
};

export type ComposerRealtimeVoiceLayoutInput = {
  readOnly?: boolean;
  hasComposerPayload: boolean;
  showAbortButton: boolean;
  busy: boolean;
};

export function resolveComposerRealtimeVoiceLayout(
  input: ComposerRealtimeVoiceLayoutInput,
): ComposerRealtimeVoiceLayout {
  if (input.readOnly) {
    return { mode: 'hidden' };
  }

  const idleEmpty =
    !input.hasComposerPayload && !input.showAbortButton && !input.busy;

  if (idleEmpty) {
    return { mode: 'primary' };
  }

  return { mode: 'ghost' };
}

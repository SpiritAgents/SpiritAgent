import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveComposerRealtimeVoiceLayout } from '../../src/lib/composer-realtime-voice-layout.ts';

test('resolveComposerRealtimeVoiceLayout hides in readOnly sessions', () => {
  assert.deepEqual(
    resolveComposerRealtimeVoiceLayout({
      readOnly: true,
      hasComposerPayload: false,
      showAbortButton: false,
      busy: false,
    }),
    { mode: 'hidden' },
  );
});

test('resolveComposerRealtimeVoiceLayout shows primary for empty idle composer', () => {
  assert.deepEqual(
    resolveComposerRealtimeVoiceLayout({
      hasComposerPayload: false,
      showAbortButton: false,
      busy: false,
    }),
    { mode: 'primary' },
  );
});

test('resolveComposerRealtimeVoiceLayout shows ghost when composer has draft payload', () => {
  assert.deepEqual(
    resolveComposerRealtimeVoiceLayout({
      hasComposerPayload: true,
      showAbortButton: false,
      busy: false,
    }),
    { mode: 'ghost' },
  );
});

test('resolveComposerRealtimeVoiceLayout shows ghost for empty abort state', () => {
  assert.deepEqual(
    resolveComposerRealtimeVoiceLayout({
      hasComposerPayload: false,
      showAbortButton: true,
      busy: true,
    }),
    { mode: 'ghost' },
  );
});

test('resolveComposerRealtimeVoiceLayout shows ghost for busy loader state', () => {
  assert.deepEqual(
    resolveComposerRealtimeVoiceLayout({
      hasComposerPayload: false,
      showAbortButton: false,
      busy: true,
    }),
    { mode: 'ghost' },
  );
});

test('resolveComposerRealtimeVoiceLayout shows ghost for enqueue while busy', () => {
  assert.deepEqual(
    resolveComposerRealtimeVoiceLayout({
      hasComposerPayload: true,
      showAbortButton: false,
      busy: true,
    }),
    { mode: 'ghost' },
  );
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isOpenAiGpt56OrLaterModel,
  modelSupportsOpenAiGpt56ReasoningControls,
  resolveModelReasoningMode,
} from './gpt-reasoning-controls.js';
import {
  modelReasoningEffortOptions,
  modelSupportsReasoningModeControl,
  resolveModelReasoningEffortForContext,
  resolveOpenAiTransportReasoningEffortForContext,
} from '../reasoning-effort.js';

test('isOpenAiGpt56OrLaterModel boundaries', () => {
  assert.equal(isOpenAiGpt56OrLaterModel('gpt-5.6-sol'), true);
  assert.equal(isOpenAiGpt56OrLaterModel('openai/gpt-5.6-terra'), true);
  assert.equal(isOpenAiGpt56OrLaterModel('gpt-6'), true);
  assert.equal(isOpenAiGpt56OrLaterModel('gpt-5.5'), false);
  assert.equal(isOpenAiGpt56OrLaterModel('gpt-5.4'), false);
});

test('gpt-5.6 models expose max effort and preserve max in transport resolution', () => {
  const context = {
    provider: 'vercel-ai-gateway' as const,
    model: 'openai/gpt-5.6-sol',
    transportKind: 'open-responses' as const,
  };

  assert.equal(
    resolveOpenAiTransportReasoningEffortForContext('max', context),
    'max',
  );
  assert.equal(
    resolveModelReasoningEffortForContext('max', {
      provider: 'openai',
      model: 'gpt-5.5',
      transportKind: 'openai-compatible',
    }),
    'xhigh',
  );

  const options = modelReasoningEffortOptions(context);
  assert.ok(options.some((option) => option.value === 'max'));
  assert.ok(!options.some((option) => option.value === 'minimal'));
});

test('resolveModelReasoningMode defaults to standard and only applies on gpt-5.6+', () => {
  assert.equal(
    resolveModelReasoningMode(undefined, {
      provider: 'vercel-ai-gateway',
      model: 'openai/gpt-5.6-luna',
    }),
    'standard',
  );
  assert.equal(
    resolveModelReasoningMode('pro', {
      provider: 'vercel-ai-gateway',
      model: 'openai/gpt-5.6-luna',
    }),
    'pro',
  );
  assert.equal(
    resolveModelReasoningMode('pro', {
      provider: 'openai',
      model: 'gpt-5.5',
    }),
    'standard',
  );
});

test('modelSupportsReasoningModeControl matches gpt-5.6 routed openai models', () => {
  assert.equal(
    modelSupportsReasoningModeControl({
      provider: 'vercel-ai-gateway',
      model: 'openai/gpt-5.6-sol',
    }),
    true,
  );
  assert.equal(
    modelSupportsOpenAiGpt56ReasoningControls({
      provider: 'anthropic',
      model: 'gpt-5.6-sol',
    }),
    false,
  );
});

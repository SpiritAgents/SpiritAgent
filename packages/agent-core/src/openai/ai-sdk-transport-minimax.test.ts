import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolveOpenAiModelCompatibilityProfile } from './openai-compat.js';

test('resolveOpenAiModelCompatibilityProfile strips minimax media without explicit capabilities', () => {
  const profile = resolveOpenAiModelCompatibilityProfile({
    llmVendor: 'minimax',
    model: 'MiniMax-M2.5',
  });
  assert.equal(profile.hasExplicitCapabilities, true);
  assert.deepEqual(profile.capabilities, {});
});

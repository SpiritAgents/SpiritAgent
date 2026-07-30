import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isHuggingFaceApiBase,
  resolveVideoGenerationBackend,
} from './router.js';

test('resolveVideoGenerationBackend routes hugging-face vendor and api base', () => {
  assert.equal(
    resolveVideoGenerationBackend({
      apiKey: 'hf_test',
      model: 'tencent/HunyuanVideo',
      llmVendor: 'hugging-face',
      baseUrl: 'https://router.huggingface.co/v1',
    }).id,
    'huggingface',
  );
  assert.equal(isHuggingFaceApiBase('https://router.huggingface.co/v1'), true);
  assert.equal(isHuggingFaceApiBase('https://api.together.ai/v1'), false);
});

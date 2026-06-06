import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolveComposerDirectMediaTool } from '../../dist-electron/src/host/model-config.js';

const chatModel = {
  name: 'gpt-4o-mini',
  apiBase: 'https://api.openai.com/v1',
  capabilities: ['chat'],
};

const imageModel = {
  name: 'dall-e-3',
  apiBase: 'https://api.openai.com/v1',
  capabilities: ['imageGeneration'],
};

const videoModel = {
  name: 'doubao-seedance',
  apiBase: 'https://ark.cn-beijing.volces.com/api/v3',
  provider: 'volcengine',
  capabilities: ['videoGeneration'],
};

const dualMediaModel = {
  name: 'dual-media',
  apiBase: 'https://example.invalid/v1',
  capabilities: ['imageGeneration', 'videoGeneration'],
};

test('resolveComposerDirectMediaTool returns generate_video when active matches video slot', () => {
  assert.equal(
    resolveComposerDirectMediaTool('doubao-seedance', {
      models: [chatModel, videoModel],
      imageGenerationModel: 'dall-e-3',
      videoGenerationModel: 'doubao-seedance',
    }),
    'generate_video',
  );
});

test('resolveComposerDirectMediaTool returns generate_image when active matches image slot', () => {
  assert.equal(
    resolveComposerDirectMediaTool('dall-e-3', {
      models: [chatModel, imageModel, videoModel],
      imageGenerationModel: 'dall-e-3',
      videoGenerationModel: 'doubao-seedance',
    }),
    'generate_image',
  );
});

test('resolveComposerDirectMediaTool returns null when active is chat model', () => {
  assert.equal(
    resolveComposerDirectMediaTool('gpt-4o-mini', {
      models: [chatModel, imageModel, videoModel],
      imageGenerationModel: 'dall-e-3',
      videoGenerationModel: 'doubao-seedance',
    }),
    null,
  );
});

test('resolveComposerDirectMediaTool returns null when slot matches but capability missing', () => {
  assert.equal(
    resolveComposerDirectMediaTool('gpt-4o-mini', {
      models: [chatModel],
      imageGenerationModel: 'gpt-4o-mini',
      videoGenerationModel: 'gpt-4o-mini',
    }),
    null,
  );
});

test('resolveComposerDirectMediaTool prefers video when same model fills both slots', () => {
  assert.equal(
    resolveComposerDirectMediaTool('dual-media', {
      models: [dualMediaModel],
      imageGenerationModel: 'dual-media',
      videoGenerationModel: 'dual-media',
    }),
    'generate_video',
  );
});

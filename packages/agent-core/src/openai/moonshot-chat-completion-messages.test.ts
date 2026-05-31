import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clearMoonshotChatCompletionMessages,
  openAiMessagesContainVideoUrl,
  peekMoonshotChatCompletionMessages,
  stashMoonshotChatCompletionMessages,
} from './moonshot-chat-completion-messages.js';

test('openAiMessagesContainVideoUrl detects video_url user parts', () => {
  assert.equal(
    openAiMessagesContainVideoUrl([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'describe' },
          { type: 'video_url', video_url: { url: 'ms://file-abc' } },
        ],
      },
    ]),
    true,
  );
  assert.equal(
    openAiMessagesContainVideoUrl([{ role: 'user', content: 'plain text' }]),
    false,
  );
});

test('stash and peek preserve OpenAI-shaped messages for fetch restoration', () => {
  clearMoonshotChatCompletionMessages();
  const messages = [
    {
      role: 'user',
      content: [{ type: 'video_url', video_url: { url: 'ms://file-abc' } }],
    },
  ];

  stashMoonshotChatCompletionMessages(messages);
  const peeked = peekMoonshotChatCompletionMessages();
  assert.notEqual(peeked, messages);
  assert.deepEqual(peeked, messages);
  clearMoonshotChatCompletionMessages();
  assert.equal(peekMoonshotChatCompletionMessages(), undefined);
});

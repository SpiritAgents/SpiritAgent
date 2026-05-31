import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clearMoonshotChatCompletionMessages,
  stashMoonshotChatCompletionMessages,
  takeMoonshotChatCompletionMessages,
} from './moonshot-chat-completion-messages.js';

test('openAiUserContentToAiSdkContent drops video_url but Moonshot fetch body can restore it', () => {
  const requestMessages = [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'describe the video' },
        { type: 'video_url', video_url: { url: 'ms://fafwrkbfykqi11gdyfwi' } },
      ],
    },
  ];

  stashMoonshotChatCompletionMessages(requestMessages);

  const aiSdkOnly = requestMessages.flatMap((message) => {
    if (message.role !== 'user' || !Array.isArray(message.content)) {
      return [];
    }

    const parts = message.content.filter((part) => part.type === 'text');
    return parts.length > 0 ? [{ role: 'user', content: parts }] : [];
  });

  assert.equal(aiSdkOnly[0]?.content.length, 1);
  assert.equal((aiSdkOnly[0]?.content[0] as { type: string }).type, 'text');

  const moonshotMessages = takeMoonshotChatCompletionMessages();
  const restoredBody = {
    model: 'kimi-k2.6',
    messages: moonshotMessages ?? aiSdkOnly,
    stream: true,
  };

  const firstMessage = restoredBody.messages?.[0] as { content: Array<{ type: string }> } | undefined;
  assert.ok(firstMessage);
  const userContent = firstMessage.content;
  assert.equal(userContent.some((part) => part.type === 'video_url'), true);

  clearMoonshotChatCompletionMessages();
});

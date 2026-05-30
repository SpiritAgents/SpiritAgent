import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  rehydrateFinishTaskNoticesInConversation,
  rehydrateFinishTaskNoticesInTimeline,
} from '../../dist-electron/src/host/finish-task-notice-rehydrate.js';
import { DesktopMessageTimeline } from '../../dist-electron/src/host/message-timeline.js';
import { restoreMessagesFromArchive } from '../../dist-electron/src/host/message-ordering.js';
import { buildArchiveAssistantAuxFromConversation } from '../../dist-electron/src/host/sessions.js';

test('buildArchiveAssistantAuxFromConversation persists finishTaskNotice', () => {
  const messages = [
    { id: 1, role: 'user', content: 'hello', pending: false },
    {
      id: 2,
      role: 'assistant',
      content: 'hi there',
      pending: false,
      aux: { finishTaskNotice: '任务因 已问候 完成。' },
    },
  ];

  assert.deepEqual(buildArchiveAssistantAuxFromConversation(messages), [
    {
      messageIndex: 1,
      finishTaskNotice: '任务因 已问候 完成。',
    },
  ]);
});

test('restoreMessagesFromArchive restores finishTaskNotice from assistantAux', () => {
  const restored = restoreMessagesFromArchive({
    messages: [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' },
    ],
    assistantAux: [
      {
        messageIndex: 1,
        finishTaskNotice: '任务因 已问候 完成。',
      },
    ],
    llmHistory: [],
    subagentSessions: [],
  });

  assert.equal(restored[1]?.aux?.finishTaskNotice, '任务因 已问候 完成。');
});

test('rehydrateFinishTaskNoticesInConversation rebuilds notice from finish_task tool history', () => {
  const messages = [
    { id: 1, role: 'user', content: 'loop task', pending: false },
    {
      id: 2,
      role: 'assistant',
      content: 'done for this turn',
      pending: false,
    },
  ];

  rehydrateFinishTaskNoticesInConversation(messages, [
    { role: 'user', content: 'loop task' },
    {
      role: 'assistant',
      content: '',
      toolCalls: [
        {
          id: 'call-finish',
          name: 'finish_task',
          argumentsJson: '{"summary":"确认每条消息"}',
        },
      ],
    },
    {
      role: 'tool',
      toolCallId: 'call-finish',
      content: 'Task marked complete.',
    },
  ]);

  assert.equal(messages[1]?.aux?.finishTaskNotice, '任务因 确认每条消息 完成。');
});

test('rehydrateFinishTaskNoticesInTimeline applies notice to assistant text row by message id', () => {
  let nextMessageId = 1;
  const timeline = new DesktopMessageTimeline({
    allocateMessageId: () => nextMessageId++,
  });
  timeline.beginUserTurn('loop task');
  timeline.beginAssistantSegment('initial');
  timeline.appendAssistantTextChunk('done for this turn');
  timeline.completeActiveAssistantSegment();

  rehydrateFinishTaskNoticesInTimeline(timeline, [
    { role: 'user', content: 'loop task' },
    {
      role: 'assistant',
      content: '',
      toolCalls: [
        {
          id: 'call-finish',
          name: 'finish_task',
          argumentsJson: '{"summary":"确认每条消息"}',
        },
      ],
    },
    {
      role: 'tool',
      toolCallId: 'call-finish',
      content: 'Task marked complete.',
    },
  ]);

  assert.equal(
    timeline.toMessages().find((message) => message.role === 'assistant' && !message.tool)?.aux
      ?.finishTaskNotice,
    '任务因 确认每条消息 完成。',
  );
});

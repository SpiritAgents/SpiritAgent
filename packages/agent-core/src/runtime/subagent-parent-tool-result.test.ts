import assert from 'node:assert/strict';
import test from 'node:test';

import { buildParentSubagentToolResultText } from './subagent-parent-tool-result.js';

test('buildParentSubagentToolResultText includes sessionId and sessionTranscript', () => {
  const text = buildParentSubagentToolResultText(
    '输出“你好”。不要执行其他操作，不要修改任何文件。',
    '你好',
    false,
    'subagent-1785129948357-1',
    '/data/transcripts/session-1/subagents/subagent-1785129948357-1.json',
  );
  assert.equal(
    text,
    [
      '[subagent completed]',
      'title=输出“你好”。不要执行其他操作，不要修改任何文件。',
      'sessionId=subagent-1785129948357-1',
      'sessionTranscript=/data/transcripts/session-1/subagents/subagent-1785129948357-1.json',
      'final_output:',
      '你好',
    ].join('\n'),
  );
});

test('buildParentSubagentToolResultText omits optional metadata when absent', () => {
  const text = buildParentSubagentToolResultText('Task', 'done', false);
  assert.equal(text, '[subagent completed]\ntitle=Task\nfinal_output:\ndone');
});

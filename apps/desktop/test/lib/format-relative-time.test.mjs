import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatRelativeTime } from '../../src/lib/format-relative-time.ts';

function withMockedNow(nowUnixMs, run) {
  const originalNow = Date.now;
  Date.now = () => nowUnixMs;
  try {
    run();
  } finally {
    Date.now = originalNow;
  }
}

test('formatRelativeTime inserts spaces between digits and Chinese units for zh locales', () => {
  withMockedNow(Date.parse('2026-06-28T12:00:00.000Z'), () => {
    const threeMinutesAgo = '2026-06-28T11:57:00.000Z';
    assert.equal(formatRelativeTime(threeMinutesAgo, 'zh-CN'), '3 分钟前');
    assert.equal(formatRelativeTime(threeMinutesAgo, 'zh-Hans'), '3 分钟前');
  });
});

test('formatRelativeTime leaves Chinese auto labels without numeric units unchanged', () => {
  withMockedNow(Date.parse('2026-06-28T12:00:00.000Z'), () => {
    const yesterday = '2026-06-27T12:00:00.000Z';
    assert.equal(formatRelativeTime(yesterday, 'zh-CN'), '昨天');
  });
});

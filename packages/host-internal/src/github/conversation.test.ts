import test from 'node:test';
import assert from 'node:assert/strict';

import {
  groupReviewCommentsIntoThreads,
  mapTimelineEventToConversationItem,
  mergePullRequestConversationItems,
} from './conversation.js';

test('mapTimelineEventToConversationItem maps committed event', () => {
  const item = mapTimelineEventToConversationItem({
    id: 1,
    event: 'committed',
    created_at: '2024-01-02T10:00:00Z',
    actor: { login: 'octocat', avatar_url: 'https://github.com/octocat.png' },
    commit: {
      sha: 'abc123',
      html_url: 'https://github.com/octocat/Hello-World/commit/abc123',
      message: 'Fix login bug\n\nDetails here',
      author: { name: 'Octocat' },
    },
  });

  assert.equal(item?.kind, 'commit');
  if (item?.kind !== 'commit') {
    return;
  }
  assert.equal(item.subject, 'Fix login bug');
  assert.equal(item.sha, 'abc123');
  assert.equal(item.authorLogin, 'Octocat');
});

test('mapTimelineEventToConversationItem maps issue comment', () => {
  const item = mapTimelineEventToConversationItem({
    id: 42,
    event: 'commented',
    created_at: '2024-01-03T10:00:00Z',
    user: { login: 'octocat', avatar_url: 'https://github.com/octocat.png' },
    body: 'Looks good to me.',
    html_url: 'https://github.com/octocat/Hello-World/issues/1#issuecomment-42',
  });

  assert.equal(item?.kind, 'issueComment');
  if (item?.kind !== 'issueComment') {
    return;
  }
  assert.equal(item.body, 'Looks good to me.');
  assert.equal(item.authorLogin, 'octocat');
});

test('mapTimelineEventToConversationItem maps review event', () => {
  const item = mapTimelineEventToConversationItem({
    id: 7,
    event: 'reviewed',
    state: 'approved',
    created_at: '2024-01-04T10:00:00Z',
    user: { login: 'octocat', avatar_url: 'https://github.com/octocat.png' },
    body: 'Ship it.',
  });

  assert.equal(item?.kind, 'review');
  if (item?.kind !== 'review') {
    return;
  }
  assert.equal(item.state, 'APPROVED');
  assert.equal(item.body, 'Ship it.');
});

test('groupReviewCommentsIntoThreads groups replies under root comment', () => {
  const threads = groupReviewCommentsIntoThreads([
    {
      id: 100,
      body: 'Why this change?',
      path: 'src/app.ts',
      diff_hunk: '@@ -1 +1 @@',
      line: 12,
      created_at: '2024-01-05T10:00:00Z',
      html_url: 'https://github.com/octocat/Hello-World/pull/1#discussion_r100',
      user: { login: 'octocat', avatar_url: 'https://github.com/octocat.png' },
    },
    {
      id: 101,
      in_reply_to_id: 100,
      body: 'Because auth broke.',
      path: 'src/app.ts',
      diff_hunk: '@@ -1 +1 @@',
      line: 12,
      created_at: '2024-01-05T11:00:00Z',
      html_url: 'https://github.com/octocat/Hello-World/pull/1#discussion_r101',
      user: { login: 'octocat', avatar_url: 'https://github.com/octocat.png' },
    },
  ]);

  assert.equal(threads.length, 1);
  assert.equal(threads[0]?.kind, 'reviewThread');
  assert.equal(threads[0]?.comments.length, 2);
  assert.equal(threads[0]?.comments[0]?.body, 'Why this change?');
  assert.equal(threads[0]?.comments[1]?.body, 'Because auth broke.');
});

test('mergePullRequestConversationItems sorts ascending and dedupes', () => {
  const items = mergePullRequestConversationItems(
    [
      {
        id: 2,
        event: 'commented',
        created_at: '2024-01-03T10:00:00Z',
        user: { login: 'octocat' },
        body: 'Comment',
      },
      {
        id: 1,
        event: 'committed',
        created_at: '2024-01-02T10:00:00Z',
        actor: { login: 'octocat' },
        commit: { sha: 'abc', message: 'Initial fix' },
      },
    ],
    [],
  );

  assert.equal(items.length, 2);
  assert.equal(items[0]?.kind, 'commit');
  assert.equal(items[1]?.kind, 'issueComment');
});

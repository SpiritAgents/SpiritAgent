import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseGitHubNoreplyLogin,
  resolveGitCommitAuthorIdentity,
} from './git-author-github.js';

test('parseGitHubNoreplyLogin extracts login from numeric noreply email', () => {
  assert.equal(
    parseGitHubNoreplyLogin('121384036+N123999@users.noreply.github.com'),
    'N123999',
  );
});

test('parseGitHubNoreplyLogin extracts login from legacy noreply email', () => {
  assert.equal(parseGitHubNoreplyLogin('octocat@users.noreply.github.com'), 'octocat');
});

test('resolveGitCommitAuthorIdentity prefers linked GitHub user', () => {
  assert.deepEqual(
    resolveGitCommitAuthorIdentity({
      gitHubUser: { login: 'octocat', avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4' },
      authorName: 'Octocat',
      authorEmail: 'octocat@users.noreply.github.com',
    }),
    {
      login: 'octocat',
      avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
    },
  );
});

test('resolveGitCommitAuthorIdentity falls back to noreply email login', () => {
  assert.deepEqual(
    resolveGitCommitAuthorIdentity({
      authorName: 'XianYu',
      authorEmail: '121384036+N123999@users.noreply.github.com',
    }),
    {
      login: 'N123999',
      avatarUrl: 'https://github.com/N123999.png?size=40',
    },
  );
});

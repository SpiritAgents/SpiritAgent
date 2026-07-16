import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildGitChipUserTurn,
  GIT_CHIP_PROMPT_COMMIT,
  GIT_CHIP_PROMPT_MERGE,
  GIT_CHIP_PROMPT_PUSH,
} from '../../src/host/git-chip-prompts.ts';

test('buildGitChipUserTurn returns prompt body without YAML frontmatter', () => {
  for (const prompt of [GIT_CHIP_PROMPT_COMMIT, GIT_CHIP_PROMPT_PUSH, GIT_CHIP_PROMPT_MERGE]) {
    assert.match(prompt, /^## Goal/m);
    assert.doesNotMatch(prompt, /^---\r?\nname:/m);
  }
});

test('buildGitChipUserTurn maps commit push merge actions', () => {
  assert.equal(buildGitChipUserTurn('commit'), GIT_CHIP_PROMPT_COMMIT);
  assert.equal(buildGitChipUserTurn('push'), GIT_CHIP_PROMPT_PUSH);
  assert.equal(buildGitChipUserTurn('merge'), GIT_CHIP_PROMPT_MERGE);
});

test('buildGitChipUserTurn appends extraNote after prompt body', () => {
  const text = buildGitChipUserTurn('commit', '  use English subject  ');
  assert.equal(text, `${GIT_CHIP_PROMPT_COMMIT}\n\nuse English subject`);
});

test('buildGitChipUserTurn ignores blank extraNote', () => {
  assert.equal(buildGitChipUserTurn('push', '   '), GIT_CHIP_PROMPT_PUSH);
});

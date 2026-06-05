import assert from 'node:assert/strict';
import test from 'node:test';

import { gitClapActionToSkillName } from '../../src/host/builtin-skills.ts';

test('gitClapActionToSkillName maps host actions to builtin skills', () => {
  assert.equal(gitClapActionToSkillName('commit'), 'git-commit');
  assert.equal(gitClapActionToSkillName('push'), 'git-push');
  assert.equal(gitClapActionToSkillName('merge'), 'git-merge');
});

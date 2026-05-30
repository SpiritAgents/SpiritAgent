import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import {
  checkoutGitBranch,
  isGitCheckoutBlockedError,
  listGitBranches,
  readGitWorkspaceSnapshot,
} from './git-workspace.js';

const execFileAsync = promisify(execFile);

async function runGit(cwd: string, args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd, windowsHide: true });
}

test('listGitBranches and checkoutGitBranch work in a temp repository', async () => {
  const repoRoot = await mkdtemp(join(tmpdir(), 'spirit-host-internal-git-'));

  try {
    await runGit(repoRoot, ['init']);
    await runGit(repoRoot, ['config', 'user.email', 'test@example.com']);
    await runGit(repoRoot, ['config', 'user.name', 'Spirit Test']);
    await writeFile(join(repoRoot, 'README.md'), '# hello\n');
    await runGit(repoRoot, ['add', 'README.md']);
    await runGit(repoRoot, ['commit', '-m', 'init']);
    const { stdout: defaultBranchOutput } = await execFileAsync('git', ['branch', '--show-current'], {
      cwd: repoRoot,
      windowsHide: true,
    });
    const defaultBranch = defaultBranchOutput.trim();
    await runGit(repoRoot, ['branch', 'feature-a']);
    await runGit(repoRoot, ['checkout', '-b', 'feature-b']);

    const branches = await listGitBranches(repoRoot);
    assert.deepEqual(branches, ['feature-b', 'feature-a', defaultBranch]);

    const snapshotBefore = await readGitWorkspaceSnapshot(repoRoot);
    assert.equal(snapshotBefore.isRepository, true);
    assert.equal(snapshotBefore.branch, 'feature-b');
    assert.deepEqual(snapshotBefore.branches, branches);

    await checkoutGitBranch(repoRoot, 'feature-a');
    const snapshotAfter = await readGitWorkspaceSnapshot(repoRoot);
    assert.equal(snapshotAfter.branch, 'feature-a');
    assert.equal(snapshotAfter.branches[0], 'feature-a');
  } finally {
    await rm(repoRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('checkoutGitBranch throws GitCheckoutBlockedError when local changes block checkout', async () => {
  const repoRoot = await mkdtemp(join(tmpdir(), 'spirit-host-internal-git-blocked-'));

  try {
    await runGit(repoRoot, ['init']);
    await runGit(repoRoot, ['config', 'user.email', 'test@example.com']);
    await runGit(repoRoot, ['config', 'user.name', 'Spirit Test']);
    await writeFile(join(repoRoot, 'README.md'), 'v1\n');
    await runGit(repoRoot, ['add', 'README.md']);
    await runGit(repoRoot, ['commit', '-m', 'init']);
    const { stdout: defaultBranchOutput } = await execFileAsync('git', ['branch', '--show-current'], {
      cwd: repoRoot,
      windowsHide: true,
    });
    const defaultBranch = defaultBranchOutput.trim();
    await runGit(repoRoot, ['checkout', '-b', 'other']);
    await writeFile(join(repoRoot, 'README.md'), 'v2\n');
    await runGit(repoRoot, ['add', 'README.md']);
    await runGit(repoRoot, ['commit', '-m', 'other']);
    await runGit(repoRoot, ['checkout', defaultBranch]);
    await writeFile(join(repoRoot, 'README.md'), 'v1-local\n');

    await assert.rejects(
      () => checkoutGitBranch(repoRoot, 'other'),
      (error: unknown) => isGitCheckoutBlockedError(error),
    );

    await checkoutGitBranch(repoRoot, 'other', { discardLocalChanges: true });
    const snapshot = await readGitWorkspaceSnapshot(repoRoot);
    assert.equal(snapshot.branch, 'other');
    const readme = await readFile(join(repoRoot, 'README.md'), 'utf8');
    assert.equal(readme.replace(/\r\n/g, '\n'), 'v2\n');
  } finally {
    await rm(repoRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('readGitWorkspaceSnapshot returns empty snapshot outside git repo', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'spirit-host-internal-non-git-'));
  try {
    const snapshot = await readGitWorkspaceSnapshot(dir);
    assert.equal(snapshot.isRepository, false);
    assert.equal(snapshot.hasChanges, false);
    assert.deepEqual(snapshot.branches, []);
  } finally {
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

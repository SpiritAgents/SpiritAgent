import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import {
  addGitWorktree,
  buildWorktreeRootPath,
  checkoutGitBranch,
  isGitCheckoutBlockedError,
  isSpiritBranchName,
  isSpiritWorktreeName,
  listGitBranches,
  listGitWorktrees,
  mergeSpiritBranchToMain,
  readGitWorkspaceSnapshot,
  readWorktreeContext,
  resolveDefaultBranch,
  resolvePrimaryRepoRoot,
  resolveWorkspaceGroupingRoot,
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

test('resolveWorkspaceGroupingRoot maps linked worktrees to primary repo', () => {
  assert.equal(
    resolveWorkspaceGroupingRoot('D:\\SpiritAgent.worktrees\\spirit-hello-test'),
    'D:\\SpiritAgent',
  );
  assert.equal(resolveWorkspaceGroupingRoot('D:\\SpiritAgent'), 'D:\\SpiritAgent');
});

test('spirit worktree and branch name validation', () => {
  assert.equal(isSpiritWorktreeName('spirit-add-worktree-ui'), true);
  assert.equal(isSpiritWorktreeName('spirit-abc'), true);
  assert.equal(isSpiritWorktreeName('Spirit-Add-Worktree'), false);
  assert.equal(isSpiritWorktreeName('add-worktree'), false);

  assert.equal(isSpiritBranchName('spirit/add-worktree-ui'), true);
  assert.equal(isSpiritBranchName('spirit/abc'), true);
  assert.equal(isSpiritBranchName('Spirit/add-worktree'), false);
  assert.equal(isSpiritBranchName('feature/foo'), false);
});

test('addGitWorktree, readWorktreeContext, and mergeSpiritBranchToMain work in a temp repository', async () => {
  const repoRoot = await mkdtemp(join(tmpdir(), 'spirit-host-internal-worktree-'));
  const worktreeName = 'spirit-test-feature';
  const branchName = 'spirit/test-feature';

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
    const primaryRepoRoot = await resolvePrimaryRepoRoot(repoRoot);
    assert.equal(primaryRepoRoot, repoRoot);

    const worktreePath = buildWorktreeRootPath(repoRoot, worktreeName);
    await addGitWorktree(repoRoot, {
      worktreePath,
      branchName,
      baseBranch: defaultBranch,
    });

    const worktrees = await listGitWorktrees(repoRoot);
    assert.equal(worktrees.some((entry) => entry.path === worktreePath), true);

    const context = await readWorktreeContext(worktreePath);
    assert.equal(context.isWorktree, true);
    assert.equal(context.repoRoot, repoRoot);
    assert.equal(context.worktreeName, worktreeName);
    assert.equal(context.branch, branchName);

    await writeFile(join(worktreePath, 'feature.txt'), 'feature\n');
    await runGit(worktreePath, ['add', 'feature.txt']);
    await runGit(worktreePath, ['commit', '-m', 'feature']);

    const resolvedDefaultBranch = await resolveDefaultBranch(repoRoot);
    assert.equal(resolvedDefaultBranch, defaultBranch);

    await mergeSpiritBranchToMain(repoRoot, branchName);
    const mergedReadme = await readFile(join(repoRoot, 'feature.txt'), 'utf8');
    assert.equal(mergedReadme.replace(/\r\n/g, '\n'), 'feature\n');
    assert.equal((await readGitWorkspaceSnapshot(repoRoot)).branch, defaultBranch);
  } finally {
    await rm(`${repoRoot}.worktrees`, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    await rm(repoRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

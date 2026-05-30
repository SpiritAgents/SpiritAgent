import { execFile } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const GIT_MAX_BUFFER = 4 * 1024 * 1024;

export type WorkLocationKind = 'local' | 'worktree';

export interface GitCheckoutOptions {
  discardLocalChanges?: boolean;
}

export interface GitWorkspaceSnapshot {
  isRepository: boolean;
  hasChanges: boolean;
  branch?: string;
  branches: string[];
}

function renderGitError(error: unknown): string {
  if (typeof error !== 'object' || error === null) {
    return String(error);
  }

  const stdout = typeof (error as { stdout?: unknown }).stdout === 'string'
    ? (error as { stdout: string }).stdout.trim()
    : '';
  const stderr = typeof (error as { stderr?: unknown }).stderr === 'string'
    ? (error as { stderr: string }).stderr.trim()
    : '';
  const message = error instanceof Error ? error.message.trim() : String(error);
  return stderr || stdout || message;
}

export function isGitCheckoutBlockedByLocalChanges(message: string): boolean {
  return /local changes to the following files would be overwritten by checkout/i.test(message)
    || /please commit your changes or stash them before you switch branches/i.test(message);
}

export class GitCheckoutBlockedError extends Error {
  readonly code = 'GIT_CHECKOUT_LOCAL_CHANGES';

  constructor(message: string) {
    super(message);
    this.name = 'GitCheckoutBlockedError';
  }
}

export function isGitCheckoutBlockedError(error: unknown): error is GitCheckoutBlockedError {
  return error instanceof GitCheckoutBlockedError
    || (typeof error === 'object'
      && error !== null
      && (error as { code?: unknown }).code === 'GIT_CHECKOUT_LOCAL_CHANGES');
}

async function runGit(
  workspaceRoot: string,
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await execFileAsync('git', args, {
      cwd: workspaceRoot,
      windowsHide: true,
      maxBuffer: GIT_MAX_BUFFER,
    });
    return {
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error) {
    const message = renderGitError(error);
    throw new Error(`git ${args.join(' ')} failed: ${message}`);
  }
}

async function readBranchName(workspaceRoot: string): Promise<string | undefined> {
  const { stdout } = await runGit(workspaceRoot, ['branch', '--show-current']);
  const branch = stdout.trim();
  return branch || undefined;
}

function sortBranches(branches: string[], currentBranch?: string): string[] {
  const unique = [...new Set(branches.map((branch) => branch.trim()).filter(Boolean))];
  unique.sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }));
  if (!currentBranch) {
    return unique;
  }
  const currentIndex = unique.indexOf(currentBranch);
  if (currentIndex <= 0) {
    return unique;
  }
  const sorted = [...unique];
  const removed = sorted.splice(currentIndex, 1)[0];
  if (removed) {
    sorted.unshift(removed);
  }
  return sorted;
}

export async function listGitBranches(workspaceRoot: string): Promise<string[]> {
  const currentBranch = await readBranchName(workspaceRoot);
  const { stdout } = await runGit(workspaceRoot, [
    'for-each-ref',
    '--format=%(refname:short)',
    'refs/heads',
  ]);
  const branches = stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return sortBranches(branches, currentBranch);
}

export async function checkoutGitBranch(
  workspaceRoot: string,
  branch: string,
  options: GitCheckoutOptions = {},
): Promise<void> {
  const normalized = branch.trim();
  if (!normalized) {
    throw new Error('Branch name cannot be empty.');
  }

  const args = options.discardLocalChanges
    ? ['checkout', '-f', normalized]
    : ['checkout', normalized];

  try {
    await runGit(workspaceRoot, args);
  } catch (error) {
    const message = renderGitError(error);
    if (!options.discardLocalChanges && isGitCheckoutBlockedByLocalChanges(message)) {
      throw new GitCheckoutBlockedError(message);
    }
    throw new Error(`git ${args.join(' ')} failed: ${message}`);
  }
}

export async function readGitWorkspaceSnapshot(repoRoot: string): Promise<GitWorkspaceSnapshot> {
  try {
    const [{ stdout: repoFlag }, { stdout: statusOutput }, branch, branches] = await Promise.all([
      runGit(repoRoot, ['rev-parse', '--is-inside-work-tree']),
      runGit(repoRoot, ['status', '--porcelain', '--untracked-files=all']),
      readBranchName(repoRoot),
      listGitBranches(repoRoot),
    ]);

    if (repoFlag.trim() !== 'true') {
      return {
        isRepository: false,
        hasChanges: false,
        branches: [],
      };
    }

    return {
      isRepository: true,
      hasChanges: statusOutput.trim().length > 0,
      branches,
      ...(branch ? { branch } : {}),
    };
  } catch {
    return {
      isRepository: false,
      hasChanges: false,
      branches: [],
    };
  }
}

export function normalizeWorkLocationKind(value: unknown): WorkLocationKind {
  return value === 'worktree' ? 'worktree' : 'local';
}

const SPIRIT_WORKTREE_NAME_PATTERN = /^spirit-[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SPIRIT_BRANCH_NAME_PATTERN = /^spirit\/[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export interface GitWorktreeEntry {
  path: string;
  branch?: string;
  head?: string;
}

export interface WorktreeContext {
  isWorktree: boolean;
  repoRoot?: string;
  worktreeName?: string;
  branch?: string;
}

export interface AddGitWorktreeOptions {
  worktreePath: string;
  branchName: string;
  baseBranch: string;
}

export interface RemoveGitWorktreeOptions {
  force?: boolean;
}

export function isSpiritWorktreeName(name: string): boolean {
  return SPIRIT_WORKTREE_NAME_PATTERN.test(name.trim());
}

export function isSpiritBranchName(name: string): boolean {
  return SPIRIT_BRANCH_NAME_PATTERN.test(name.trim());
}

export function buildWorktreeRootPath(repoRoot: string, worktreeName: string): string {
  const normalizedName = worktreeName.trim();
  if (!normalizedName) {
    throw new Error('Worktree name cannot be empty.');
  }
  return path.join(`${repoRoot}.worktrees`, normalizedName);
}

/** Map a linked worktree path back to its primary repository root for UI grouping. */
export function resolveWorkspaceGroupingRoot(workspaceRoot: string): string {
  const normalized = path.resolve(workspaceRoot);
  const asPosix = normalized.replace(/\\/g, '/');
  const match = asPosix.match(/^(.+)\.worktrees\/[^/]+$/u);
  if (match?.[1]) {
    return path.resolve(match[1]);
  }
  return normalized;
}

export async function resolvePrimaryRepoRoot(workspaceRoot: string): Promise<string> {
  const { stdout } = await runGit(workspaceRoot, [
    'rev-parse',
    '--path-format=absolute',
    '--git-common-dir',
  ]);
  const commonDir = stdout.trim();
  if (!commonDir) {
    throw new Error('Unable to resolve primary repository root.');
  }
  const normalizedCommonDir = path.resolve(commonDir);
  const basename = path.basename(normalizedCommonDir).toLowerCase();
  if (basename === '.git') {
    return path.dirname(normalizedCommonDir);
  }
  return normalizedCommonDir;
}

export async function resolveDefaultBranch(repoRoot: string): Promise<string> {
  try {
    const { stdout } = await runGit(repoRoot, [
      'symbolic-ref',
      'refs/remotes/origin/HEAD',
    ]);
    const match = stdout.trim().match(/^refs\/remotes\/origin\/(.+)$/u);
    if (match?.[1]) {
      return match[1];
    }
  } catch {
    // fall through to local defaults
  }

  const branches = await listGitBranches(repoRoot);
  if (branches.includes('main')) {
    return 'main';
  }
  if (branches.includes('master')) {
    return 'master';
  }
  const current = await readBranchName(repoRoot);
  if (current) {
    return current;
  }
  if (branches.length > 0) {
    return branches[0]!;
  }
  throw new Error('Unable to resolve default branch.');
}

function parseGitWorktreeListLine(line: string): GitWorktreeEntry | undefined {
  const trimmed = line.trim();
  if (!trimmed) {
    return undefined;
  }

  const pathMatch = trimmed.match(/^worktree\s+(.+)$/u);
  if (pathMatch?.[1]) {
    return { path: path.resolve(pathMatch[1].trim()) };
  }

  const branchMatch = trimmed.match(/^branch\s+refs\/heads\/(.+)$/u);
  if (branchMatch?.[1]) {
    return { path: '', branch: branchMatch[1].trim() };
  }

  const headMatch = trimmed.match(/^HEAD\s+([0-9a-f]+)$/iu);
  if (headMatch?.[1]) {
    return { path: '', head: headMatch[1].trim() };
  }

  return undefined;
}

export async function listGitWorktrees(repoRoot: string): Promise<GitWorktreeEntry[]> {
  const { stdout } = await runGit(repoRoot, ['worktree', 'list', '--porcelain']);
  const entries: GitWorktreeEntry[] = [];
  let current: GitWorktreeEntry | undefined;

  for (const line of stdout.split(/\r?\n/u)) {
    const parsed = parseGitWorktreeListLine(line);
    if (!parsed) {
      continue;
    }
    if (parsed.path) {
      if (current) {
        entries.push(current);
      }
      current = { path: parsed.path };
      continue;
    }
    if (!current) {
      continue;
    }
    if (parsed.branch) {
      current.branch = parsed.branch;
    }
    if (parsed.head) {
      current.head = parsed.head;
    }
  }

  if (current) {
    entries.push(current);
  }

  return entries;
}

export async function addGitWorktree(
  repoRoot: string,
  options: AddGitWorktreeOptions,
): Promise<void> {
  const worktreePath = path.resolve(options.worktreePath.trim());
  const branchName = options.branchName.trim();
  const baseBranch = options.baseBranch.trim();

  if (!branchName) {
    throw new Error('Branch name cannot be empty.');
  }
  if (!baseBranch) {
    throw new Error('Base branch cannot be empty.');
  }
  if (!isSpiritBranchName(branchName)) {
    throw new Error(`Branch name must match spirit/... format: ${branchName}`);
  }

  await mkdir(path.dirname(worktreePath), { recursive: true });
  await runGit(repoRoot, [
    'worktree',
    'add',
    '-b',
    branchName,
    worktreePath,
    baseBranch,
  ]);
}

export async function removeGitWorktree(
  repoRoot: string,
  worktreePath: string,
  options: RemoveGitWorktreeOptions = {},
): Promise<void> {
  const resolvedPath = path.resolve(worktreePath.trim());
  if (!resolvedPath) {
    throw new Error('Worktree path cannot be empty.');
  }

  const args = ['worktree', 'remove', resolvedPath];
  if (options.force === true) {
    args.push('--force');
  }
  await runGit(repoRoot, args);
}

export async function readWorktreeContext(workspaceRoot: string): Promise<WorktreeContext> {
  try {
    const repoRoot = await resolvePrimaryRepoRoot(workspaceRoot);
    const branch = await readBranchName(workspaceRoot);
    const resolvedWorkspace = path.resolve(workspaceRoot);
    const resolvedRepoRoot = path.resolve(repoRoot);
    const isWorktree = resolvedWorkspace !== resolvedRepoRoot;

    if (!isWorktree) {
      return {
        isWorktree: false,
        repoRoot: resolvedRepoRoot,
        ...(branch ? { branch } : {}),
      };
    }

    const worktreeName = path.basename(resolvedWorkspace);
    return {
      isWorktree: true,
      repoRoot: resolvedRepoRoot,
      worktreeName,
      ...(branch ? { branch } : {}),
    };
  } catch {
    return { isWorktree: false };
  }
}

export function isGitMergeConflictError(message: string): boolean {
  return /fix conflicts and then commit the result/i.test(message)
    || /Automatic merge failed/i.test(message)
    || /CONFLICT/i.test(message);
}

export async function mergeSpiritBranchToMain(
  repoRoot: string,
  branchName: string,
): Promise<void> {
  const normalizedBranch = branchName.trim();
  if (!normalizedBranch) {
    throw new Error('Branch name cannot be empty.');
  }
  if (!isSpiritBranchName(normalizedBranch)) {
    throw new Error(`Branch name must match spirit/... format: ${normalizedBranch}`);
  }

  const snapshot = await readGitWorkspaceSnapshot(repoRoot);
  if (!snapshot.isRepository) {
    throw new Error('Primary repository is not a Git repository.');
  }
  if (snapshot.hasChanges) {
    throw new Error('Primary repository has uncommitted changes. Commit or stash before merging.');
  }

  const defaultBranch = await resolveDefaultBranch(repoRoot);
  if (snapshot.branch !== defaultBranch) {
    await checkoutGitBranch(repoRoot, defaultBranch);
  }

  try {
    await runGit(repoRoot, ['merge', '--no-edit', normalizedBranch]);
  } catch (error) {
    const message = renderGitError(error);
    if (isGitMergeConflictError(message)) {
      try {
        await runGit(repoRoot, ['merge', '--abort']);
      } catch {
        // best effort
      }
      throw new Error(`Merge failed due to conflicts: ${message}`);
    }
    throw new Error(`git merge ${normalizedBranch} failed: ${message}`);
  }
}

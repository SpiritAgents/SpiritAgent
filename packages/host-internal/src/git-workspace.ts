import { execFile } from 'node:child_process';
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

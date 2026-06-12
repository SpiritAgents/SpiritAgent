import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import {
  findOpenPullRequestForHead,
  getPullRequestDetail,
  GitHubOAuthError,
  parseGitHubRemoteUrl,
  type GitHubAuthStatus,
  type GitHubPullRequestDetail,
  type GitHubPullRequestForBranchResult,
} from '@spirit-agent/host-internal';

import type { DesktopGitSnapshot, GetGitHubPullRequestDetailRequest } from '../types.js';
import {
  clearGitHubOAuthCredentials,
  getGitHubAuthStatusFromStorage,
  loadGitHubAccessToken,
} from './github-auth-storage.js';
import { runGitHubOAuthFlow } from './github-oauth-bridge.js';

const execFileAsync = promisify(execFile);

export interface HostGitHubCommandContext {
  workspaceRoot: string;
  git: DesktopGitSnapshot;
}

export async function getGitHubAuthStatusCommand(): Promise<GitHubAuthStatus> {
  return getGitHubAuthStatusFromStorage();
}

export async function startGitHubOAuthCommand(): Promise<GitHubAuthStatus> {
  const result = await runGitHubOAuthFlow();
  return {
    connected: true,
    login: result.login,
  };
}

export async function disconnectGitHubCommand(): Promise<GitHubAuthStatus> {
  await clearGitHubOAuthCredentials();
  return { connected: false };
}

async function readGitOriginRemoteUrl(workspaceRoot: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', ['remote', 'get-url', 'origin'], {
      cwd: workspaceRoot,
      windowsHide: true,
    });
    const trimmed = stdout.trim();
    return trimmed || null;
  } catch {
    return null;
  }
}

function resolveCurrentBranch(git: DesktopGitSnapshot): string | null {
  const branch = git.selectedBranch?.trim() || git.branch?.trim();
  return branch || null;
}

function mapGitHubApiError(error: unknown): Error {
  if (!(error instanceof GitHubOAuthError)) {
    return error instanceof Error ? error : new Error(String(error));
  }

  if (error.status === 401) {
    return new Error('GitHub authentication expired or is invalid. Connect GitHub again.');
  }
  if (error.status === 403) {
    return new Error(
      'GitHub denied access. If this repository belongs to an organization with SSO, authorize the token for that organization on GitHub.',
    );
  }
  return error;
}

async function requireGitHubAccessToken(): Promise<string> {
  const accessToken = await loadGitHubAccessToken();
  if (!accessToken) {
    throw new Error('Connect GitHub before querying pull requests.');
  }
  return accessToken;
}

export async function getGitHubPullRequestForCurrentBranchCommand(
  ctx: HostGitHubCommandContext,
): Promise<GitHubPullRequestForBranchResult> {
  const branch = resolveCurrentBranch(ctx.git);
  if (!ctx.git.isRepository || !branch) {
    return {
      repository: null,
      branch,
      pullRequest: null,
    };
  }

  const remoteUrl = await readGitOriginRemoteUrl(ctx.workspaceRoot);
  const repository = remoteUrl ? parseGitHubRemoteUrl(remoteUrl) : null;
  if (!repository) {
    return {
      repository: null,
      branch,
      pullRequest: null,
    };
  }

  try {
    const accessToken = await requireGitHubAccessToken();
    const pullRequest = await findOpenPullRequestForHead(accessToken, repository, branch);
    return {
      repository,
      branch,
      pullRequest,
    };
  } catch (error) {
    throw mapGitHubApiError(error);
  }
}

export async function getGitHubPullRequestDetailCommand(
  request: GetGitHubPullRequestDetailRequest,
): Promise<GitHubPullRequestDetail> {
  const owner = request.owner.trim();
  const repo = request.repo.trim();
  const number = request.number;
  if (!owner || !repo || !Number.isFinite(number) || number <= 0) {
    throw new Error('Pull request owner, repository, and number are required.');
  }

  try {
    const accessToken = await requireGitHubAccessToken();
    return await getPullRequestDetail(accessToken, { owner, repo }, number);
  } catch (error) {
    throw mapGitHubApiError(error);
  }
}

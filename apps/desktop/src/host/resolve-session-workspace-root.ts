import { existsSync } from 'node:fs';
import path from 'node:path';

import {
  isSpiritBranchName,
  listGitWorktrees,
  readWorktreeContext,
  resolvePrimaryRepoRoot,
} from '@spiritagent/host-internal';

export async function resolveStoredSessionWorkspaceRoot(input: {
  workspaceRoot: string;
  gitBranch?: string;
}): Promise<string> {
  const trimmed = input.workspaceRoot.trim();
  if (!trimmed) {
    return trimmed;
  }

  const resolved = path.resolve(trimmed);
  // 非 spirit 分支时无论 readWorktreeContext 结果如何都原样返回 resolved，
  // 先判分支可省去每次 openSession 两次 git 子进程 spawn（Windows 上 100ms+）。
  const branch = input.gitBranch?.trim();
  if (!branch || !isSpiritBranchName(branch)) {
    return resolved;
  }

  const context = await readWorktreeContext(resolved);
  if (context.isWorktree) {
    return resolved;
  }

  try {
    const primaryRepoRoot = await resolvePrimaryRepoRoot(resolved);
    const worktrees = await listGitWorktrees(primaryRepoRoot);
    const match = worktrees.find((entry) => entry.branch === branch && entry.path);
    if (match?.path && existsSync(match.path)) {
      return path.resolve(match.path);
    }
  } catch {
    // 无法解析时保留 stored root
  }

  return resolved;
}

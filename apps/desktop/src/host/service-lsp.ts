import path from 'node:path';

import { LspService } from '@spirit-agent/agent-core';

export function sharedLspServiceForWorkspace(
  cache: Map<string, LspService>,
  workspaceRoot: string,
): LspService {
  const key = path.resolve(workspaceRoot);
  let service = cache.get(key);
  if (!service) {
    service = new LspService(key);
    cache.set(key, service);
  }
  return service;
}

export async function ensureLspServiceReady(service: LspService): Promise<LspService | undefined> {
  await service.probe();
  return service.enabled ? service : undefined;
}

export async function disposeLspServicesExcept(
  cache: Map<string, LspService>,
  keepWorkspaceRoot?: string,
): Promise<void> {
  const keepKey = keepWorkspaceRoot ? path.resolve(keepWorkspaceRoot) : undefined;
  for (const [key, service] of cache) {
    if (keepKey !== undefined && key === keepKey) {
      continue;
    }
    await service.dispose();
    cache.delete(key);
  }
}

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

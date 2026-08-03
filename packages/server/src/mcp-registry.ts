import path from 'node:path';

import { McpService } from '@spiritagent/agent-core';

/**
 * Per-workspace shared McpService cache (same pattern as Desktop's
 * `sharedMcpServiceForWorkspace`): sessions and host.mcp* management calls
 * share one background-refreshing service per workspace root.
 */
export class McpRegistry {
  private readonly cache = new Map<string, McpService>();

  forWorkspace(workspaceRoot: string): McpService {
    const key = path.resolve(workspaceRoot);
    let service = this.cache.get(key);
    if (!service) {
      service = new McpService(key, true);
      service.startBackgroundRefreshInBackground(false);
      this.cache.set(key, service);
    }
    return service;
  }
}

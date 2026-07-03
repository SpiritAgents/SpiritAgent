import { McpRegistry } from './registry.js';
import type {
  McpResourceIndexEntry,
  McpToolIndexEntry,
  ResolvedMcpServerConfig,
  ToolAgentMcpToolCatalogSnapshot,
} from './types.js';
import { buildMcpToolCatalogSnapshot } from './catalog-snapshot.js';

export function buildMcpToolCatalogSnapshotForTest(
  indexEntries: McpToolIndexEntry[],
  registry: McpRegistry,
  resolvedServers: Record<string, ResolvedMcpServerConfig>,
  resourceEntries: McpResourceIndexEntry[] = [],
): ToolAgentMcpToolCatalogSnapshot {
  return buildMcpToolCatalogSnapshot(
    indexEntries,
    resourceEntries,
    registry,
    resolvedServers,
  );
}

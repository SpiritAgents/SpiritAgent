import type {
  ToolAgentBuiltInToolCatalogServerEntry,
  ToolAgentMcpToolCatalogSnapshot,
} from '../mcp/types.js';
import type { BuiltInLazyToolIndexEntry } from './types.js';

export function findBuiltInLazyToolIndexEntry(
  entries: readonly BuiltInLazyToolIndexEntry[],
  server: string,
  toolName: string,
): BuiltInLazyToolIndexEntry | undefined {
  return entries.find((entry) => entry.server === server && entry.toolName === toolName);
}

export function buildBuiltInLazyToolCatalogSnapshot(
  entries: readonly BuiltInLazyToolIndexEntry[],
): Pick<ToolAgentMcpToolCatalogSnapshot, 'builtInServers' | 'builtInToolCount'> | undefined {
  if (entries.length === 0) {
    return undefined;
  }

  const grouped = new Map<string, BuiltInLazyToolIndexEntry[]>();
  for (const entry of entries) {
    const current = grouped.get(entry.server) ?? [];
    current.push(entry);
    grouped.set(entry.server, current);
  }

  const builtInServers: ToolAgentBuiltInToolCatalogServerEntry[] = [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, serverEntries]) => ({
      name,
      displayName: builtInServerDisplayName(name),
      tools: serverEntries
        .slice()
        .sort((left, right) => left.toolName.localeCompare(right.toolName))
        .map((entry) => ({
          name: entry.toolName,
          description: entry.description,
        })),
    }));

  return {
    builtInServers,
    builtInToolCount: entries.length,
  };
}

export function mergeLazyToolCatalogSnapshots(
  mcpCatalog: ToolAgentMcpToolCatalogSnapshot,
  builtInEntries: readonly BuiltInLazyToolIndexEntry[],
): ToolAgentMcpToolCatalogSnapshot {
  const builtInCatalog = buildBuiltInLazyToolCatalogSnapshot(builtInEntries);
  if (!builtInCatalog) {
    return mcpCatalog;
  }

  return {
    ...mcpCatalog,
    ...(builtInCatalog.builtInServers ? { builtInServers: builtInCatalog.builtInServers } : {}),
    ...(builtInCatalog.builtInToolCount !== undefined
      ? { builtInToolCount: builtInCatalog.builtInToolCount }
      : {}),
  };
}

function builtInServerDisplayName(server: string): string {
  if (server === 'desktop') {
    return 'Desktop';
  }
  return server;
}

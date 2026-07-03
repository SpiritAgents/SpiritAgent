import assert from 'node:assert/strict';
import test from 'node:test';

import {
  aggregateListedResourcesForServer,
  buildMcpToolCatalogSnapshot,
  MCP_CATALOG_RESOURCE_LIMIT,
} from './catalog-snapshot.js';
import { McpRegistry } from './registry.js';
import type { McpToolIndexEntry, ResolvedMcpServerConfig } from './types.js';

test('aggregateListedResourcesForServer merges mimeTypes by uri', () => {
  const entries = aggregateListedResourcesForServer('demo', [
    { uri: 'mcp://doc', name: 'doc', mimeType: 'text/plain' },
    { uri: 'mcp://doc', name: 'doc', mimeType: 'application/json' },
  ]);

  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0]?.mimeTypes, ['application/json', 'text/plain']);
});

test('buildMcpToolCatalogSnapshot truncates resources independently', () => {
  const registry = new McpRegistry();
  registry.replaceConfig({
    servers: {
      demo: {
        enabled: true,
        transport: { type: 'stdio', command: 'demo' },
      },
    },
  });
  registry.setServerState('demo', 'ready', { cachedTools: 0 });

  const resolved: Record<string, ResolvedMcpServerConfig> = {
    demo: {
      name: 'demo',
      displayName: 'Demo',
      enabled: true,
      capabilities: { tools: true, resources: true, prompts: true },
      transport: { type: 'stdio', command: 'demo', args: [], env: {}, stderr: 'pipe' },
    },
  };

  const resourceEntries = Array.from({ length: MCP_CATALOG_RESOURCE_LIMIT + 2 }, (_, index) => ({
    server: 'demo',
    uri: `mcp://demo/r${index}`,
    name: `r${index}`,
  }));

  const snapshot = buildMcpToolCatalogSnapshot([], resourceEntries, registry, resolved);
  assert.equal(snapshot.resourcesTruncated, true);
  assert.equal(snapshot.totalResourceCount, MCP_CATALOG_RESOURCE_LIMIT + 2);
  assert.equal(snapshot.servers[0]?.resources.length, MCP_CATALOG_RESOURCE_LIMIT);
});

test('buildMcpToolCatalogSnapshot includes servers with resources only', () => {
  const registry = new McpRegistry();
  registry.replaceConfig({
    servers: {
      docs: {
        enabled: true,
        transport: { type: 'stdio', command: 'docs' },
      },
    },
  });
  registry.setServerState('docs', 'ready', { cachedTools: 0 });

  const resolved: Record<string, ResolvedMcpServerConfig> = {
    docs: {
      name: 'docs',
      displayName: 'Docs',
      enabled: true,
      capabilities: { tools: false, resources: true, prompts: false },
      transport: { type: 'stdio', command: 'docs', args: [], env: {}, stderr: 'pipe' },
    },
  };

  const snapshot = buildMcpToolCatalogSnapshot(
    [],
    [{ server: 'docs', uri: 'mcp://readme', name: 'readme', mimeTypes: ['text/markdown'] }],
    registry,
    resolved,
  );

  assert.equal(snapshot.servers.length, 1);
  assert.deepEqual(snapshot.servers[0]?.resources[0], {
    uri: 'mcp://readme',
    name: 'readme',
    mimeTypes: ['text/markdown'],
  });
});

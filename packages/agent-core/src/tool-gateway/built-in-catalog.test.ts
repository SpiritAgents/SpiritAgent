import assert from 'node:assert/strict';
import test from 'node:test';

import { buildMcpCatalogSystemMessage } from '../tool-agent.js';
import {
  buildBuiltInLazyToolCatalogSnapshot,
  mergeLazyToolCatalogSnapshots,
} from './built-in-catalog.js';
import { LAZY_BUILT_IN_SERVER_DESKTOP } from './types.js';

test('buildBuiltInLazyToolCatalogSnapshot groups tools by server', () => {
  const snapshot = buildBuiltInLazyToolCatalogSnapshot([
    {
      server: LAZY_BUILT_IN_SERVER_DESKTOP,
      toolName: 'create_automation',
      description: 'Create a Desktop automation.',
      inputSchema: { type: 'object' },
    },
  ]);

  assert.deepEqual(snapshot, {
    builtInToolCount: 1,
    builtInServers: [
      {
        name: 'desktop',
        displayName: 'Desktop',
        tools: [{ name: 'create_automation', description: 'Create a Desktop automation.' }],
      },
    ],
  });
});

test('mergeLazyToolCatalogSnapshots attaches built-in servers to MCP snapshot', () => {
  const merged = mergeLazyToolCatalogSnapshots(
    {
      servers: [],
      truncated: false,
      totalToolCount: 0,
      resourcesTruncated: false,
      totalResourceCount: 0,
    },
    [
      {
        server: LAZY_BUILT_IN_SERVER_DESKTOP,
        toolName: 'create_automation',
        description: 'Create a Desktop automation.',
        inputSchema: { type: 'object' },
      },
    ],
  );

  assert.equal(merged.builtInToolCount, 1);
  assert.equal(merged.builtInServers?.[0]?.tools[0]?.name, 'create_automation');
});

test('buildMcpCatalogSystemMessage lists built-in tools and references gateway tools', () => {
  const message = buildMcpCatalogSystemMessage({
    servers: [],
    builtInServers: [
      {
        name: 'desktop',
        displayName: 'Desktop',
        tools: [{ name: 'create_automation', description: 'Create a Desktop automation.' }],
      },
    ],
    builtInToolCount: 1,
    truncated: false,
    totalToolCount: 0,
    resourcesTruncated: false,
    totalResourceCount: 0,
  });

  assert.ok(message?.includes('<mcp_catalog>'));
  assert.ok(message?.includes('tool_describe'));
  assert.ok(message?.includes('<built-in-server name="desktop"'));
  assert.ok(message?.includes('<tool name="create_automation">'));
  assert.ok(message?.includes('Create a Desktop automation.'));
});

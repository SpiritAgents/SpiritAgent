import assert from 'node:assert/strict';
import test from 'node:test';

import { buildMcpCatalogSystemMessage } from './tool-agent.js';

test('buildMcpCatalogSystemMessage returns undefined for empty catalog', () => {
  assert.equal(buildMcpCatalogSystemMessage(undefined), undefined);
  assert.equal(
    buildMcpCatalogSystemMessage({
      servers: [],
      truncated: false,
      totalToolCount: 0,
      resourcesTruncated: false,
      totalResourceCount: 0,
    }),
    undefined,
  );
});

test('buildMcpCatalogSystemMessage lists MCP tools and references gateway tools', () => {
  const message = buildMcpCatalogSystemMessage({
    servers: [
      {
        name: 'github',
        displayName: 'GitHub',
        state: 'ready',
        tools: [{ name: 'create_issue', description: 'Create a repository issue.' }],
        resources: [],
      },
    ],
    truncated: false,
    totalToolCount: 1,
    resourcesTruncated: false,
    totalResourceCount: 0,
  });

  assert.ok(message?.includes('<mcp_catalog>'));
  assert.ok(message?.includes('tool_describe'));
  assert.ok(message?.includes('tool_call'));
  assert.ok(message?.includes('<mcp-server name="github"'));
  assert.ok(message?.includes('<tool name="create_issue">'));
  assert.ok(message?.includes('Create a repository issue.'));
});

test('buildMcpCatalogSystemMessage marks truncated catalogs', () => {
  const message = buildMcpCatalogSystemMessage({
    servers: [
      {
        name: 'demo',
        displayName: 'Demo',
        state: 'error',
        lastError: 'connection failed',
        tools: [],
        resources: [],
      },
    ],
    truncated: true,
    totalToolCount: 200,
    resourcesTruncated: false,
    totalResourceCount: 0,
  });

  assert.ok(message?.includes('truncated="true"'));
  assert.ok(message?.includes('totalTools="200"'));
  assert.ok(message?.includes('lastError="connection failed"'));
});

test('buildMcpCatalogSystemMessage lists MCP resources with mimeTypes', () => {
  const message = buildMcpCatalogSystemMessage({
    servers: [
      {
        name: 'docs',
        displayName: 'Docs',
        state: 'ready',
        tools: [],
        resources: [
          {
            uri: 'mcp://readme',
            name: 'readme',
            description: 'Project readme',
            mimeTypes: ['text/markdown', 'text/plain'],
          },
        ],
      },
    ],
    truncated: false,
    totalToolCount: 0,
    resourcesTruncated: false,
    totalResourceCount: 1,
  });

  assert.ok(message?.includes('fetch_mcp_resource'));
  assert.ok(message?.includes('<resource uri="mcp://readme" name="readme" mimeTypes="text/markdown,text/plain">'));
  assert.ok(message?.includes('Project readme'));
  assert.ok(!message?.includes('tool_describe'));
});

test('buildMcpCatalogSystemMessage omits optional resource fields when absent', () => {
  const message = buildMcpCatalogSystemMessage({
    servers: [
      {
        name: 'docs',
        displayName: 'Docs',
        state: 'ready',
        tools: [],
        resources: [{ uri: 'mcp://cfg', name: 'cfg' }],
      },
    ],
    truncated: false,
    totalToolCount: 0,
    resourcesTruncated: false,
    totalResourceCount: 1,
  });

  assert.ok(message?.includes('<resource uri="mcp://cfg" name="cfg">'));
  assert.ok(!message?.includes('mimeTypes='));
});

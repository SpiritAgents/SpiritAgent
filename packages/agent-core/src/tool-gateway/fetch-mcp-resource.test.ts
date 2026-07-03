import assert from 'node:assert/strict';
import test from 'node:test';

import { McpConfigError } from '../mcp/errors.js';
import {
  FETCH_MCP_RESOURCE_TOOL_NAME,
  buildFetchMcpResourceDefinition,
  formatMcpResourceFetchResultJson,
  isFetchMcpResourceToolName,
  parseFetchMcpResourceArguments,
} from './fetch-mcp-resource.js';

test('isFetchMcpResourceToolName recognizes fetch_mcp_resource only', () => {
  assert.equal(isFetchMcpResourceToolName(FETCH_MCP_RESOURCE_TOOL_NAME), true);
  assert.equal(isFetchMcpResourceToolName('tool_call'), false);
});

test('buildFetchMcpResourceDefinition exposes server and uri parameters', () => {
  const definition = buildFetchMcpResourceDefinition() as {
    function?: { parameters?: { required?: string[] } };
  };
  assert.deepEqual(definition.function?.parameters?.required, ['server', 'uri']);
});

test('parseFetchMcpResourceArguments parses server and uri', () => {
  const parsed = parseFetchMcpResourceArguments(
    JSON.stringify({ server: 'docs', uri: 'mcp://readme' }),
  );
  assert.deepEqual(parsed, { server: 'docs', uri: 'mcp://readme' });
});

test('parseFetchMcpResourceArguments rejects missing uri', () => {
  assert.throws(
    () => parseFetchMcpResourceArguments(JSON.stringify({ server: 'docs' })),
    McpConfigError,
  );
});

test('formatMcpResourceFetchResultJson returns single-segment mimeType and text', () => {
  const result = formatMcpResourceFetchResultJson({
    contents: [{ mimeType: 'text/plain', text: 'hello' }],
  });
  assert.deepEqual(JSON.parse(result), {
    mimeType: 'text/plain',
    text: 'hello',
  });
});

test('formatMcpResourceFetchResultJson returns contents array for multiple segments', () => {
  const result = formatMcpResourceFetchResultJson({
    contents: [
      { mimeType: 'application/json', text: '{"a":1}' },
      { mimeType: 'image/png', blob: 'abc' },
    ],
  });
  assert.deepEqual(JSON.parse(result), {
    contents: [
      { mimeType: 'application/json', text: '{"a":1}' },
      { mimeType: 'image/png', blobOmitted: true, blobLength: 3 },
    ],
  });
});

test('formatMcpResourceFetchResultJson rejects empty contents', () => {
  assert.throws(() => formatMcpResourceFetchResultJson({ contents: [] }), McpConfigError);
});

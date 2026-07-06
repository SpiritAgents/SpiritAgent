import assert from 'node:assert/strict';
import test from 'node:test';

import { McpConfigError } from '../mcp/errors.js';
import { createCompositeLazyToolGatewayBackend } from './composite-backend.js';
import { TOOL_DESCRIBE_TOOL_NAME } from './definitions.js';
import { executeLazyToolGatewayCall } from './mcp-backend.js';
import { LAZY_BUILT_IN_SERVER_DESKTOP } from './types.js';

test('executeLazyToolGatewayCall routes built-in describe through composite backend', async () => {
  const result = await executeLazyToolGatewayCall(
    TOOL_DESCRIBE_TOOL_NAME,
    JSON.stringify({
      provider: 'built-in',
      server: LAZY_BUILT_IN_SERVER_DESKTOP,
      tool: 'create_automation',
    }),
    createCompositeLazyToolGatewayBackend({
      builtIn: {
        describe: async () => ({
          description: 'Create a Desktop automation.',
          inputSchema: { type: 'object' },
        }),
        call: async () => 'unused',
      },
    }),
  );

  assert.match(result, /Create a Desktop automation/u);
});

test('executeLazyToolGatewayCall rejects built-in without backend', async () => {
  await assert.rejects(
    () =>
      executeLazyToolGatewayCall(
        TOOL_DESCRIBE_TOOL_NAME,
        JSON.stringify({
          provider: 'built-in',
          server: LAZY_BUILT_IN_SERVER_DESKTOP,
          tool: 'create_automation',
        }),
        createCompositeLazyToolGatewayBackend({}),
      ),
    McpConfigError,
  );
});

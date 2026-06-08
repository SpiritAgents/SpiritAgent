import assert from 'node:assert/strict';
import { join } from 'node:path';
import test from 'node:test';

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

import {
  findMcpServerNameConflict,
  mcpServerScopesFromFiles,
  mcpWorkspaceConfigPath,
  mergeMcpConfigFiles,
  resolveDefaultSpiritAgentDataDir,
  spiritAgentDataDir,
} from './config.js';
import type { McpConfigFile } from './types.js';

const stdioServer = {
  transport: { type: 'stdio' as const, command: 'echo' },
};

function withEnv(vars: Record<string, string | undefined>, run: () => void): void {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(vars)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  try {
    run();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test('resolveDefaultSpiritAgentDataDir uses APPDATA on Windows-style hosts', () => {
  withEnv(
    {
      APPDATA: '/tmp/spirit-agent-appdata',
      HOME: '/tmp/should-not-use',
      USERPROFILE: undefined,
      SPIRIT_AGENT_DATA_DIR: undefined,
    },
    () => {
      assert.equal(resolveDefaultSpiritAgentDataDir(), join('/tmp/spirit-agent-appdata', 'SpiritAgent'));
    },
  );
});

test('resolveDefaultSpiritAgentDataDir uses Application Support on macOS', () => {
  if (process.platform !== 'darwin') {
    return;
  }

  const home = mkdtempSync(join(tmpdir(), 'spirit-agent-home-'));
  try {
    withEnv(
      {
        APPDATA: undefined,
        HOME: home,
        USERPROFILE: undefined,
        SPIRIT_AGENT_DATA_DIR: undefined,
      },
      () => {
        assert.equal(
          resolveDefaultSpiritAgentDataDir(),
          join(home, 'Library', 'Application Support', 'SpiritAgent'),
        );
      },
    );
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('spiritAgentDataDir honors SPIRIT_AGENT_DATA_DIR override', () => {
  withEnv(
    {
      SPIRIT_AGENT_DATA_DIR: '/tmp/spirit-agent-override',
      APPDATA: '/tmp/spirit-agent-appdata',
    },
    () => {
      assert.equal(spiritAgentDataDir(), '/tmp/spirit-agent-override');
    },
  );
});

test('mcpWorkspaceConfigPath resolves under .spirit directory', () => {
  assert.equal(
    mcpWorkspaceConfigPath('/tmp/project'),
    join('/tmp/project', '.spirit', 'mcp.json'),
  );
});

test('mergeMcpConfigFiles combines user and workspace servers', () => {
  const user: McpConfigFile = {
    servers: { github: stdioServer },
  };
  const workspace: McpConfigFile = {
    servers: { local: stdioServer },
  };

  const merged = mergeMcpConfigFiles(user, workspace);
  assert.deepEqual(Object.keys(merged.servers).sort(), ['github', 'local']);
});

test('mergeMcpConfigFiles lets workspace override same-named user server', () => {
  const user: McpConfigFile = {
    servers: {
      shared: { transport: { type: 'stdio', command: 'user-cmd' } },
    },
  };
  const workspace: McpConfigFile = {
    servers: {
      shared: { transport: { type: 'stdio', command: 'workspace-cmd' } },
    },
  };

  const merged = mergeMcpConfigFiles(user, workspace);
  const transport = merged.servers.shared?.transport;
  assert.equal(transport?.type, 'stdio');
  if (transport?.type === 'stdio') {
    assert.equal(transport.command, 'workspace-cmd');
  }
});

test('mcpServerScopesFromFiles labels each server by source file', () => {
  const user: McpConfigFile = { servers: { github: stdioServer } };
  const workspace: McpConfigFile = { servers: { local: stdioServer } };

  assert.deepEqual(mcpServerScopesFromFiles(user, workspace), {
    github: 'user',
    local: 'workspace',
  });
});

test('findMcpServerNameConflict detects existing names in either scope', () => {
  const user: McpConfigFile = { servers: { github: stdioServer } };
  const workspace: McpConfigFile = { servers: { local: stdioServer } };

  assert.equal(findMcpServerNameConflict(user, workspace, 'github'), 'user');
  assert.equal(findMcpServerNameConflict(user, workspace, 'local'), 'workspace');
  assert.equal(findMcpServerNameConflict(user, workspace, 'missing'), undefined);
});

test('mergeMcpConfigFiles with empty workspace yields user-only servers', () => {
  const user: McpConfigFile = { servers: { github: stdioServer } };
  const workspace: McpConfigFile = { servers: { local: stdioServer } };

  const merged = mergeMcpConfigFiles(user, { servers: {} });
  assert.deepEqual(Object.keys(merged.servers), ['github']);
  assert.deepEqual(mcpServerScopesFromFiles(user, { servers: {} }), { github: 'user' });
});

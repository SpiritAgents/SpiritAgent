import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { setKeyringStoreForTests, groupKeyAccount } from '@spiritagent/host-internal';

import { SessionManager } from '../src/session-manager.js';

function freshDataDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'spirit-server-session-'));
  writeFileSync(
    join(dir, 'config.json'),
    JSON.stringify({
      schemaVersion: 2,
      providerGroups: [
        {
          id: 'openai',
          provider: 'openai',
          apiBase: 'https://api.openai.com/v1',
          models: [
            { name: 'gpt-4o-mini' },
            { name: 'gpt-4o-mini-pane' },
          ],
        },
      ],
      activeModel: { groupId: 'openai', name: 'gpt-4o-mini' },
    }),
  );
  return dir;
}

function withMockKeyring(run: () => Promise<void>): Promise<void> {
  const store = new Map<string, string>();
  setKeyringStoreForTests({
    getPassword: (service, account) => store.get(`${service}/${account}`),
    setPassword: (service, account, password) => {
      store.set(`${service}/${account}`, password);
    },
    deletePassword: (service, account) => {
      store.delete(`${service}/${account}`);
    },
  });
  // The canonical Desktop/CLI account scheme: group::{groupId}.
  store.set(`SpiritAgent/${groupKeyAccount('openai')}`, 'test-key');
  return run().finally(() => setKeyringStoreForTests(undefined));
}

describe('SessionManager', () => {
  it('creates, lists, and closes sessions without touching the network', async () => {
    await withMockKeyring(async () => {
      const dataDir = freshDataDir();
      const events: string[] = [];
      const manager = new SessionManager(dataDir, {
        broadcastRuntimeEvent: (sessionId, event) => {
          events.push(`${sessionId}:${event.kind}`);
        },
        broadcastTurnFinished: () => {},
        broadcastSnapshot: () => {},
        broadcastTrustRequest: () => {},
        broadcastFileChange: () => {},
      });

      const created = await manager.createSession({
        workspaceRoot: tmpdir(),
        hostKind: 'cli',
      });
      assert.ok(created.sessionId.startsWith('sess_'));
      assert.equal(created.isBusy, false);
      assert.equal(created.approvalLevel, 'default');

      const listed = manager.listSessions();
      assert.deepEqual(
        listed.map((session) => session.sessionId),
        [created.sessionId],
      );

      // Unknown session ids fail loudly at the RPC boundary.
      await assert.rejects(
        manager.submitUserTurn('sess_missing', { text: 'hi' }),
        /session not found/,
      );

      await manager.closeSession(created.sessionId);
      assert.deepEqual(manager.listSessions(), []);
      // Closing twice is a no-op.
      await manager.closeSession(created.sessionId);
    });
  });

  it('applies the requested approval level and rejects invalid busy turns', async () => {
    await withMockKeyring(async () => {
      const dataDir = freshDataDir();
      const manager = new SessionManager(dataDir, {
        broadcastRuntimeEvent: () => {},
        broadcastTurnFinished: () => {},
        broadcastSnapshot: () => {},
        broadcastTrustRequest: () => {},
        broadcastFileChange: () => {},
      });
      const created = await manager.createSession({
        workspaceRoot: tmpdir(),
        hostKind: 'desktop',
        approvalLevel: 'full-approval',
        modelRef: { groupId: 'openai', name: 'gpt-4o-mini-pane' },
      });
      assert.equal(created.approvalLevel, 'full-approval');
      assert.equal(created.model, 'gpt-4o-mini-pane');
      const info = manager.getSession(created.sessionId);
      assert.equal(info?.hostKind, 'desktop');

      await manager.setApprovalLevel(created.sessionId, 'auto-approval');
      assert.equal(manager.getSession(created.sessionId)?.approvalLevel, 'auto-approval');

      await manager.shutdown();
      assert.deepEqual(manager.listSessions(), []);
    });
  });

  it('projects a bridge-compatible snapshot (field parity)', async () => {
    await withMockKeyring(async () => {
      const dataDir = freshDataDir();
      const manager = new SessionManager(dataDir, {
        broadcastRuntimeEvent: () => {},
        broadcastTurnFinished: () => {},
        broadcastSnapshot: () => {},
        broadcastTrustRequest: () => {},
        broadcastFileChange: () => {},
      });
      const created = await manager.createSession({
        workspaceRoot: tmpdir(),
        hostKind: 'cli',
      });

      const snapshot = manager.snapshot(created.sessionId);
      // Required fields of the legacy bridge snapshot contract.
      assert.equal(snapshot.isBusy, false);
      assert.equal(snapshot.loopEnabled, false);
      assert.equal(snapshot.approvalLevel, 'default');
      assert.equal(snapshot.hasPendingApproval, false);
      assert.equal(snapshot.hasPendingManualApproval, false);
      assert.equal(snapshot.hasPendingQuestions, false);
      assert.deepEqual(snapshot.pendingImagePaths, []);
      assert.deepEqual(snapshot.pendingMcpResources, []);
      assert.deepEqual(snapshot.childSessions, []);
      // No unexpected keys beyond the bridge contract.
      const allowedKeys = new Set([
        'pendingUserTurn',
        'pendingImagePaths',
        'pendingMcpResources',
        'pendingAuxState',
        'hasPendingApproval',
        'hasPendingManualApproval',
        'hasPendingQuestions',
        'currentPendingApproval',
        'currentPendingQuestions',
        'childSessions',
        'isBusy',
        'loopEnabled',
        'approvalLevel',
        'backgroundToolStatus',
      ]);
      for (const key of Object.keys(snapshot)) {
        assert.ok(allowedKeys.has(key), `unexpected snapshot key: ${key}`);
      }

      await manager.shutdown();
    });
  });

  it('broadcasts a shared user-turn boundary before runtime execution', async () => {
    await withMockKeyring(async () => {
      const dataDir = freshDataDir();
      const submitted: Array<{ sessionId: string; text: string; clientTurnId?: string }> = [];
      const manager = new SessionManager(dataDir, {
        broadcastRuntimeEvent: () => {},
        broadcastUserTurnSubmitted: (sessionId, turn) => {
          submitted.push({
            sessionId,
            text: turn.text,
            ...(turn.clientTurnId ? { clientTurnId: turn.clientTurnId } : {}),
          });
        },
        broadcastTurnFinished: () => {},
        broadcastSnapshot: () => {},
        broadcastTrustRequest: () => {},
        broadcastFileChange: () => {},
      });
      const created = await manager.createSession({
        workspaceRoot: tmpdir(),
        hostKind: 'desktop',
      });

      await manager.submitUserTurn(created.sessionId, {
        text: 'shared boundary',
        clientTurnId: 'desktop-turn-1',
      });

      assert.deepEqual(submitted, [{
        sessionId: created.sessionId,
        text: 'shared boundary',
        clientTurnId: 'desktop-turn-1',
      }]);
      manager.abort(created.sessionId);
      await manager.shutdown();
    });
  });
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CREATE_AUTOMATION_CONTRIBUTED_TOOL,
  CREATE_AUTOMATION_TOOL_NAME,
  buildAutomationHostToolDefinitions,
  deriveAutomationTitle,
  parseCreateAutomationApprovalLevel,
  parseCreateAutomationTrigger,
  parseCreateAutomationTriggerInput,
} from './automation-host-tool.js';

test('CREATE_AUTOMATION_CONTRIBUTED_TOOL exposes required overview', () => {
  assert.equal(CREATE_AUTOMATION_CONTRIBUTED_TOOL.name, CREATE_AUTOMATION_TOOL_NAME);
  const schema = CREATE_AUTOMATION_CONTRIBUTED_TOOL.inputSchema;
  assert.deepEqual(schema.required, ['overview']);
  const properties = schema.properties;
  assert.ok(properties && typeof properties === 'object' && !Array.isArray(properties));
  const trigger = properties.trigger;
  assert.equal(trigger && typeof trigger === 'object' && !Array.isArray(trigger) ? trigger.type : undefined, 'object');
});

test('buildAutomationHostToolDefinitions returns one function tool', () => {
  const definitions = buildAutomationHostToolDefinitions();
  assert.equal(definitions.length, 1);
  const fn = definitions[0] as { function?: { name?: string } };
  assert.equal(fn.function?.name, CREATE_AUTOMATION_TOOL_NAME);
});

test('deriveAutomationTitle uses explicit title or first overview line', () => {
  assert.equal(deriveAutomationTitle('line one\nline two', 'Custom'), 'Custom');
  assert.equal(deriveAutomationTitle('Check CI every morning'), 'Check CI every morning');
});

test('deriveAutomationTitle truncates long first lines', () => {
  const longLine = 'a'.repeat(100);
  assert.equal(deriveAutomationTitle(longLine).length, 80);
});

test('parseCreateAutomationTrigger accepts time schedule', () => {
  assert.deepEqual(
    parseCreateAutomationTrigger({ kind: 'time', schedule: { kind: 'hourly' } }),
    { kind: 'time', schedule: { kind: 'hourly' } },
  );
  assert.deepEqual(
    parseCreateAutomationTrigger({ kind: 'time', schedule: { kind: 'daily', hour: 9, minute: 30 } }),
    { kind: 'time', schedule: { kind: 'daily', hour: 9, minute: 30 } },
  );
});

test('parseCreateAutomationTrigger rejects invalid time schedule', () => {
  assert.throws(
    () => parseCreateAutomationTrigger({ kind: 'time', schedule: { kind: 'monthly' } }),
    /Invalid automation trigger/,
  );
});

test('parseCreateAutomationTrigger accepts github trigger', () => {
  assert.deepEqual(
    parseCreateAutomationTrigger({
      kind: 'github',
      owner: 'acme',
      repo: 'app',
      event: 'issue_created',
    }),
    {
      kind: 'github',
      owner: 'acme',
      repo: 'app',
      event: 'issue_created',
    },
  );
});

test('parseCreateAutomationTriggerInput requires trigger', () => {
  assert.deepEqual(
    parseCreateAutomationTriggerInput({
      trigger: {
        kind: 'github',
        owner: 'acme',
        repo: 'app',
        event: 'pull_request_created',
      },
    }),
    {
      kind: 'github',
      owner: 'acme',
      repo: 'app',
      event: 'pull_request_created',
    },
  );
  assert.throws(
    () => parseCreateAutomationTriggerInput({ schedule: { kind: 'daily', hour: 8, minute: 15 } }),
    /缺少 trigger/,
  );
});

test('parseCreateAutomationApprovalLevel defaults to default and accepts full-approval', () => {
  assert.equal(parseCreateAutomationApprovalLevel(undefined), 'default');
  assert.equal(parseCreateAutomationApprovalLevel('full-approval'), 'full-approval');
  assert.equal(parseCreateAutomationApprovalLevel('full-access'), 'full-approval');
});

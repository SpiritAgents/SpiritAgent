import assert from 'node:assert/strict';
import test from 'node:test';

import type { JsonValue } from './ports.js';
import {
  buildBuiltinHostToolDefinitions,
} from './host-tools.js';
import { USE_SAME_LANGUAGE_AS_USER_MESSAGE_RULE } from './user-message-language.js';
import { isJsonObject } from './tool-agent.js';

function readShellReasonDescription(definitions: JsonValue[]): string | undefined {
  for (const definition of definitions) {
    if (!isJsonObject(definition)) {
      continue;
    }
    const fn = definition.function;
    if (!isJsonObject(fn) || fn.name !== 'shell') {
      continue;
    }
    const parameters = fn.parameters;
    if (!isJsonObject(parameters)) {
      return undefined;
    }
    const properties = parameters.properties;
    if (!isJsonObject(properties)) {
      return undefined;
    }
    const reason = properties.reason;
    if (!isJsonObject(reason)) {
      return undefined;
    }
    return typeof reason.description === 'string' ? reason.description : undefined;
  }
  return undefined;
}

const environment = {
  shellDisplayName: 'zsh',
  commandParameterDescription: 'Command to run.',
};

test('shell reason schema requires matching user message language', () => {
  const definitions = buildBuiltinHostToolDefinitions(environment);
  const description = readShellReasonDescription(definitions);
  assert.ok(description);
  assert.match(description, new RegExp(USE_SAME_LANGUAGE_AS_USER_MESSAGE_RULE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

import type { JsonObject } from '../ports.js';

export const AUTO_APPROVAL_REVIEW_JSON_SCHEMA: JsonObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    allow: { type: 'boolean' },
    reason: { type: 'string', minLength: 1 },
  },
  required: ['allow', 'reason'],
};

export const AUTO_APPROVAL_REVIEW_SCHEMA_NAME = 'tool_auto_approval_review';

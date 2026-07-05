/** Re-export agent-core Azure helpers for renderer-safe host-internal consumers. */

export {
  azureApiBaseFromResourceName,
  extractAzureResourceNameFromApiBase,
  isValidAzureResourceName,
  normalizeAzureResourceName,
  validateAzureResourceName,
} from '@spiritagent/agent-core/azure-resource';

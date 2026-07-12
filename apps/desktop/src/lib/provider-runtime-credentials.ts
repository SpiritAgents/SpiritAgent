/** Renderer-safe provider credential predicates（无 keyring / host 依赖）。 */

export function hasBedrockIamCredentials(credentials: {
  accessKeyId?: string;
  secretAccessKey?: string;
}): boolean {
  return Boolean(credentials.accessKeyId?.trim() && credentials.secretAccessKey?.trim());
}

export function hasGoogleVertexServiceAccountCredentials(credentials: {
  clientEmail?: string;
  privateKey?: string;
}): boolean {
  return Boolean(credentials.clientEmail?.trim() && credentials.privateKey?.trim());
}

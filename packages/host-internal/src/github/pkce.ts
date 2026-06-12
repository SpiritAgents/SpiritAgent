import { createHash, randomBytes } from 'node:crypto';

/** RFC 7636 unreserved characters for code_verifier. */
const PKCE_VERIFIER_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

const PKCE_VERIFIER_MIN_LENGTH = 43;
const PKCE_VERIFIER_MAX_LENGTH = 128;

export interface PkcePair {
  codeVerifier: string;
  codeChallenge: string;
}

function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/u, '');
}

function createCodeVerifier(length = 64): string {
  const normalizedLength = Math.min(
    PKCE_VERIFIER_MAX_LENGTH,
    Math.max(PKCE_VERIFIER_MIN_LENGTH, length),
  );
  const bytes = randomBytes(normalizedLength);
  let verifier = '';
  for (let index = 0; index < normalizedLength; index += 1) {
    verifier += PKCE_VERIFIER_ALPHABET[bytes[index]! % PKCE_VERIFIER_ALPHABET.length];
  }
  return verifier;
}

function createS256CodeChallenge(codeVerifier: string): string {
  const digest = createHash('sha256').update(codeVerifier, 'utf8').digest();
  return base64UrlEncode(digest);
}

export function generatePkcePair(length = 64): PkcePair {
  const codeVerifier = createCodeVerifier(length);
  return {
    codeVerifier,
    codeChallenge: createS256CodeChallenge(codeVerifier),
  };
}

export function verifyPkceChallenge(codeVerifier: string, codeChallenge: string): boolean {
  return createS256CodeChallenge(codeVerifier) === codeChallenge;
}

export function isValidPkceVerifier(codeVerifier: string): boolean {
  if (
    codeVerifier.length < PKCE_VERIFIER_MIN_LENGTH
    || codeVerifier.length > PKCE_VERIFIER_MAX_LENGTH
  ) {
    return false;
  }
  return /^[A-Za-z0-9\-._~]+$/u.test(codeVerifier);
}

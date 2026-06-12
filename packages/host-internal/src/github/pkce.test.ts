import test from 'node:test';
import assert from 'node:assert/strict';

import {
  generatePkcePair,
  isValidPkceVerifier,
  verifyPkceChallenge,
} from './pkce.js';

test('generatePkcePair produces RFC 7636 compliant verifier and S256 challenge', () => {
  const pair = generatePkcePair();
  assert.ok(isValidPkceVerifier(pair.codeVerifier));
  assert.ok(verifyPkceChallenge(pair.codeVerifier, pair.codeChallenge));
  assert.match(pair.codeChallenge, /^[A-Za-z0-9\-._~]+$/u);
});

test('generatePkcePair respects verifier length bounds', () => {
  const shortPair = generatePkcePair(43);
  assert.equal(shortPair.codeVerifier.length, 43);

  const longPair = generatePkcePair(200);
  assert.equal(longPair.codeVerifier.length, 128);
});

test('verifyPkceChallenge rejects mismatched verifier', () => {
  const pair = generatePkcePair();
  assert.equal(verifyPkceChallenge(`${pair.codeVerifier}x`, pair.codeChallenge), false);
});

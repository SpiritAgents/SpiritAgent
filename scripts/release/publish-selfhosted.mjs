#!/usr/bin/env node
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EXPECTED_PRIMARY_ASSET_COUNT,
  mapPrimaryAsset,
  objectKeyFor,
  publicUrlFor,
} from './selfhosted-paths.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PURE_VERSION_RE = /^\d+\.\d+\.\d+$/;

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function usage() {
  console.error(
    [
      'Usage: node scripts/release/publish-selfhosted.mjs --input <dir> --version <X.Y.Z>',
      'Env: SPIRIT_CLOUDFLARE_ACCOUNT_ID, SPIRIT_CLOUDFLARE_API_TOKEN, SPIRIT_CLOUDFLARE_BUCKET_NAME',
    ].join('\n'),
  );
}

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'approval') {
        continue;
      }
      files.push(...(await collectFiles(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * @param {string} accountId
 * @param {string} bucketName
 * @param {string} token
 * @param {string} objectKey
 * @param {Buffer} body
 */
async function uploadObject(accountId, bucketName, token, objectKey, body) {
  const encodedKey = objectKey
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/r2/buckets/${encodeURIComponent(bucketName)}/objects/${encodedKey}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(body.length),
    },
    body,
  });
  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = undefined;
  }
  if (!response.ok || parsed?.success === false) {
    const detail = parsed ? JSON.stringify(parsed.errors ?? parsed) : text.slice(0, 500);
    throw new Error(`Upload failed for ${publicUrlFor(objectKey)}: HTTP ${response.status} ${detail}`);
  }
}

const inputDir = path.resolve(readArg('--input') ?? path.join(repoRoot, 'dist', 'release'));
const version = readArg('--version') ?? process.env.RELEASE_VERSION;
const accountId = process.env.SPIRIT_CLOUDFLARE_ACCOUNT_ID?.trim() ?? '';
const apiToken = process.env.SPIRIT_CLOUDFLARE_API_TOKEN?.trim() ?? '';
const bucketName = process.env.SPIRIT_CLOUDFLARE_BUCKET_NAME?.trim() ?? '';

if (!version || !PURE_VERSION_RE.test(version)) {
  usage();
  console.error(`Invalid or missing --version. Expected pure X.Y.Z, got ${JSON.stringify(version)}`);
  process.exit(1);
}

if (!accountId || !apiToken || !bucketName) {
  usage();
  console.error(
    'Missing SPIRIT_CLOUDFLARE_ACCOUNT_ID, SPIRIT_CLOUDFLARE_API_TOKEN, or SPIRIT_CLOUDFLARE_BUCKET_NAME.',
  );
  process.exit(1);
}

const files = (await collectFiles(inputDir)).sort((left, right) => left.localeCompare(right));
/** @type {{ filePath: string, mapped: NonNullable<ReturnType<typeof mapPrimaryAsset>> }[]} */
const primaries = [];

for (const filePath of files) {
  const relativePath = path.relative(inputDir, filePath).replaceAll(path.sep, '/');
  const mapped = mapPrimaryAsset(path.basename(relativePath));
  if (!mapped) {
    continue;
  }
  if (mapped.version !== version) {
    console.error(
      `Primary asset version mismatch for ${relativePath}: expected ${version}, got ${mapped.version}`,
    );
    process.exit(1);
  }
  primaries.push({ filePath, mapped });
}

if (primaries.length !== EXPECTED_PRIMARY_ASSET_COUNT) {
  console.error(
    `Expected ${EXPECTED_PRIMARY_ASSET_COUNT} primary installers for self-hosted upload, found ${primaries.length}.`,
  );
  for (const item of primaries) {
    console.error(`- ${path.basename(item.filePath)}`);
  }
  process.exit(1);
}

for (const { filePath, mapped } of primaries) {
  const body = await readFile(filePath);
  const size = (await stat(filePath)).size;
  if (size !== body.length) {
    throw new Error(`Size mismatch reading ${filePath}`);
  }

  for (const versionSegment of [version, 'latest']) {
    const objectKey = objectKeyFor(mapped, versionSegment);
    const publicUrl = publicUrlFor(objectKey);
    console.log(`Uploading ${publicUrl} (${size} bytes)`);
    await uploadObject(accountId, bucketName, apiToken, objectKey, body);
  }
}

console.log(`Self-hosted upload complete: ${primaries.length} primaries × 2 (version + latest)`);

#!/usr/bin/env node
import { createHash, createHmac } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EXPECTED_PRIMARY_ASSET_COUNT,
  mapPrimaryAsset,
  objectKeyFor,
  publicUrlFor,
} from './selfhosted-paths.mjs';
import { parseReleaseVersion } from './version.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const R2_REGION = 'auto';
const R2_SERVICE = 's3';

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function usage() {
  console.error(
    [
      'Usage: node scripts/release/publish-selfhosted.mjs --input <dir> --version <X.Y.Z[-alpha.N|-beta.N|-rc.N]>',
      'Env: SPIRIT_CLOUDFLARE_ACCOUNT_ID, SPIRIT_CLOUDFLARE_ACCESS_KEY_ID,',
      '     SPIRIT_CLOUDFLARE_SECRET_ACCESS_KEY, SPIRIT_CLOUDFLARE_BUCKET_NAME',
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
 * @param {import('node:crypto').BinaryLike | NodeJS.ArrayBufferView} data
 */
function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * @param {import('node:crypto').BinaryLike | NodeJS.ArrayBufferView} key
 * @param {import('node:crypto').BinaryLike | NodeJS.ArrayBufferView} data
 */
function hmacSha256(key, data) {
  return createHmac('sha256', key).update(data).digest();
}

/**
 * @param {string} secretAccessKey
 * @param {string} dateStamp
 * @param {string} region
 * @param {string} service
 */
function deriveSigningKey(secretAccessKey, dateStamp, region, service) {
  const kDate = hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  return hmacSha256(kService, 'aws4_request');
}

/**
 * R2 S3-compatible PutObject (single-part up to 5 GiB; avoids Cloudflare REST 300 MB limit).
 * @param {{
 *   accountId: string,
 *   bucketName: string,
 *   accessKeyId: string,
 *   secretAccessKey: string,
 *   objectKey: string,
 *   body: Buffer,
 * }} params
 */
async function uploadObject({
  accountId,
  bucketName,
  accessKeyId,
  secretAccessKey,
  objectKey,
  body,
}) {
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const encodedKey = objectKey
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  const canonicalUri = `/${encodeURIComponent(bucketName)}/${encodedKey}`;
  const url = `https://${host}${canonicalUri}`;

  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body);

  /** @type {Record<string, string>} */
  const signedHeaderMap = {
    'content-length': String(body.length),
    'content-type': 'application/octet-stream',
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
  const signedHeaderNames = Object.keys(signedHeaderMap).sort();
  const canonicalHeaders = signedHeaderNames
    .map((name) => `${name}:${signedHeaderMap[name]}\n`)
    .join('');
  const signedHeaders = signedHeaderNames.join(';');

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${R2_REGION}/${R2_SERVICE}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const signature = createHmac(
    'sha256',
    deriveSigningKey(secretAccessKey, dateStamp, R2_REGION, R2_SERVICE),
  )
    .update(stringToSign)
    .digest('hex');

  const authorization = [
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(', ');

  // Node fetch forbids setting Host; it is included in the signature only.
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Length': signedHeaderMap['content-length'],
      'Content-Type': signedHeaderMap['content-type'],
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      Authorization: authorization,
    },
    body,
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(
      `Upload failed for ${publicUrlFor(objectKey)}: HTTP ${response.status} ${detail}`,
    );
  }
}

const inputDir = path.resolve(readArg('--input') ?? path.join(repoRoot, 'dist', 'release'));
const version = readArg('--version') ?? process.env.RELEASE_VERSION;
const accountId = process.env.SPIRIT_CLOUDFLARE_ACCOUNT_ID?.trim() ?? '';
const accessKeyId = process.env.SPIRIT_CLOUDFLARE_ACCESS_KEY_ID?.trim() ?? '';
const secretAccessKey = process.env.SPIRIT_CLOUDFLARE_SECRET_ACCESS_KEY?.trim() ?? '';
const bucketName = process.env.SPIRIT_CLOUDFLARE_BUCKET_NAME?.trim() ?? '';

if (!version) {
  usage();
  console.error('Invalid or missing --version.');
  process.exit(1);
}

let parsed;
try {
  parsed = parseReleaseVersion(version);
} catch (error) {
  usage();
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
  usage();
  console.error(
    'Missing SPIRIT_CLOUDFLARE_ACCOUNT_ID, SPIRIT_CLOUDFLARE_ACCESS_KEY_ID, SPIRIT_CLOUDFLARE_SECRET_ACCESS_KEY, or SPIRIT_CLOUDFLARE_BUCKET_NAME.',
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

/**
 * Two-phase upload: all versioned keys first, then all `latest` keys.
 * Avoids mixed old/new `latest` URLs if the job stops mid-loop.
 * @param {'version' | 'latest'} phase
 */
async function uploadPhase(phase) {
  const versionSegment = phase === 'version' ? version : 'latest';
  for (const { filePath, mapped } of primaries) {
    const body = await readFile(filePath);
    const size = (await stat(filePath)).size;
    if (size !== body.length) {
      throw new Error(`Size mismatch reading ${filePath}`);
    }
    const objectKey = objectKeyFor(mapped, versionSegment);
    const publicUrl = publicUrlFor(objectKey);
    console.log(`Uploading ${publicUrl} (${size} bytes)`);
    await uploadObject({
      accountId,
      bucketName,
      accessKeyId,
      secretAccessKey,
      objectKey,
      body,
    });
  }
}

await uploadPhase('version');
if (parsed.prerelease) {
  console.log(
    `Self-hosted upload complete: ${primaries.length} primaries (version keys only; skipped latest because ${parsed.channel} prerelease)`,
  );
} else {
  await uploadPhase('latest');
  console.log(`Self-hosted upload complete: ${primaries.length} primaries × 2 (version then latest)`);
}

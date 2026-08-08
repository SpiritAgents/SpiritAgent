#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PURE_VERSION_RE = /^\d+\.\d+\.\d+$/;

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function resolveExpectedVersion(raw) {
  if (!raw) {
    return undefined;
  }
  if (!PURE_VERSION_RE.test(raw)) {
    console.error(
      `Invalid release version ${JSON.stringify(raw)}. Expected a pure semver patch form X.Y.Z (no "v" prefix).`,
    );
    process.exit(1);
  }
  return raw;
}

async function readJsonVersion(relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  const parsed = JSON.parse(await readFile(filePath, 'utf8'));
  return parsed.version;
}

async function readCargoVersion(relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  const content = await readFile(filePath, 'utf8');
  const match = content.match(/^\s*version\s*=\s*"([^"]+)"/m);
  if (!match) {
    throw new Error(`未在 ${relativePath} 中找到 package version`);
  }
  return match[1];
}

async function readMcpClientVersion(relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  const content = await readFile(filePath, 'utf8');
  const match = content.match(/DEFAULT_MCP_CLIENT_INFO[\s\S]*?version:\s*['"]([^'"]+)['"]/);
  if (!match) {
    throw new Error(`未在 ${relativePath} 中找到 DEFAULT_MCP_CLIENT_INFO.version`);
  }
  return match[1];
}

const explicitVersion = readArg('--version') ?? process.env.RELEASE_VERSION;
const legacyVersion = process.env.RELEASE_TAG ?? process.env.GITHUB_REF_NAME;
const expectedVersion =
  explicitVersion !== undefined
    ? resolveExpectedVersion(explicitVersion)
    : legacyVersion && PURE_VERSION_RE.test(legacyVersion)
      ? legacyVersion
      : undefined;

const versions = [
  ['desktop', 'apps/desktop/package.json', await readJsonVersion('apps/desktop/package.json')],
  ['agent-core', 'packages/agent-core/package.json', await readJsonVersion('packages/agent-core/package.json')],
  ['host-internal', 'packages/host-internal/package.json', await readJsonVersion('packages/host-internal/package.json')],
  ['acp-server', 'packages/acp-server/package.json', await readJsonVersion('packages/acp-server/package.json')],
  ['cli', 'apps/cli/Cargo.toml', await readCargoVersion('apps/cli/Cargo.toml')],
  ['mcp-client-info', 'packages/agent-core/src/mcp/config.ts', await readMcpClientVersion('packages/agent-core/src/mcp/config.ts')],
];

const baseline = expectedVersion ?? versions[0][2];
if (!PURE_VERSION_RE.test(baseline)) {
  console.error(
    `Invalid baseline version ${JSON.stringify(baseline)}. Package versions must use pure X.Y.Z (no "v" prefix).`,
  );
  process.exit(1);
}

const mismatches = versions.filter(([, , version]) => version !== baseline);

if (mismatches.length > 0) {
  console.error(`版本不一致，期望 ${baseline}:`);
  for (const [name, file, version] of versions) {
    console.error(`- ${name}: ${version} (${file})`);
  }
  process.exit(1);
}

console.log(`Release version verified: ${baseline}`);

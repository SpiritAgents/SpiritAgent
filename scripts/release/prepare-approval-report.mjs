#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PURE_VERSION_RE = /^\d+\.\d+\.\d+$/;

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function usage() {
  console.error(
    [
      'Usage: node scripts/release/prepare-approval-report.mjs --input <dir> --output-dir <dir> --version <X.Y.Z> [--sha <commit>]',
      'Env: RELEASE_VERSION, GITHUB_SHA, GITHUB_REPOSITORY, GH_TOKEN / GITHUB_TOKEN',
    ].join('\n'),
  );
}

function formatBytes(bytes) {
  return new Intl.NumberFormat('en-US').format(bytes);
}

async function collectFiles(dir, { skipPaths, skipDirs }) {
  const skipPathSet = new Set(skipPaths.map((item) => path.resolve(item)));
  const skipDirSet = new Set(skipDirs.map((item) => path.resolve(item)));
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const resolved = path.resolve(fullPath);
    if (skipPathSet.has(resolved) || skipDirSet.has(resolved)) {
      continue;
    }
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath, { skipPaths, skipDirs })));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

async function sha256(filePath) {
  const hash = createHash('sha256');
  await new Promise((resolve, reject) => {
    createReadStream(filePath)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', resolve);
  });
  return hash.digest('hex');
}

function runCapture(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    cwd: repoRoot,
    env: process.env,
    ...options,
  });
  return result;
}

function generateNotesViaGh(version, sha) {
  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository) {
    return undefined;
  }
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) {
    return undefined;
  }

  const args = [
    'api',
    '--method',
    'POST',
    `-H`,
    'Accept: application/vnd.github+json',
    `/repos/${repository}/releases/generate-notes`,
    '-f',
    `tag_name=${version}`,
  ];
  if (sha) {
    args.push('-f', `target_commitish=${sha}`);
  }

  const result = runCapture('gh', args);
  if (result.status !== 0) {
    console.error(result.stderr?.trim() || 'gh releases/generate-notes failed');
    return undefined;
  }
  try {
    const parsed = JSON.parse(result.stdout);
    if (typeof parsed.body === 'string' && parsed.body.trim()) {
      return parsed.body.trim();
    }
  } catch {
    // fall through
  }
  return undefined;
}

function generateNotesViaGitLog(sha) {
  const describe = runCapture('git', ['describe', '--tags', '--abbrev=0'], { stdio: ['ignore', 'pipe', 'pipe'] });
  const rangeArgs =
    describe.status === 0 && describe.stdout.trim()
      ? [`${describe.stdout.trim()}..${sha || 'HEAD'}`, '--']
      : [sha || 'HEAD', '--max-count=30', '--'];

  const log = runCapture('git', ['log', '--pretty=format:- %s (%h)', ...rangeArgs]);
  if (log.status !== 0) {
    return '- (changelog unavailable)';
  }
  const body = log.stdout.trim();
  return body || '- (no commits in range)';
}

function renderAssetTable(assets) {
  const lines = [
    '| File | SHA256 | Size (bytes) |',
    '| --- | --- | ---: |',
  ];
  for (const asset of assets) {
    lines.push(`| \`${asset.file}\` | \`${asset.sha256}\` | ${formatBytes(asset.size)} |`);
  }
  return lines.join('\n');
}

const inputDir = path.resolve(readArg('--input') ?? path.join(repoRoot, 'dist', 'release'));
const outputDir = path.resolve(readArg('--output-dir') ?? path.join(inputDir, 'approval'));
const version = readArg('--version') ?? process.env.RELEASE_VERSION;
const sha = readArg('--sha') ?? process.env.GITHUB_SHA ?? '';

if (!version || !PURE_VERSION_RE.test(version)) {
  usage();
  console.error(`Invalid or missing --version. Expected pure X.Y.Z, got ${JSON.stringify(version)}`);
  process.exit(1);
}

await mkdir(outputDir, { recursive: true });

const reportPath = path.join(outputDir, 'approval-report.md');
const manifestPath = path.join(outputDir, 'release-manifest.json');
const notesPath = path.join(outputDir, 'release-notes.md');
const sumsPath = path.join(inputDir, 'SHA256SUMS.txt');

const files = (
  await collectFiles(inputDir, {
    skipPaths: [reportPath, manifestPath, notesPath, sumsPath, path.join(outputDir, 'SHA256SUMS.txt')],
    skipDirs: [outputDir],
  })
).sort((left, right) => left.localeCompare(right));

if (files.length === 0) {
  console.error(`No release assets found under ${inputDir}`);
  process.exit(1);
}

const assets = [];
const sumLines = [];
for (const filePath of files) {
  const relativePath = path.relative(inputDir, filePath).replaceAll(path.sep, '/');
  const digest = await sha256(filePath);
  const size = (await stat(filePath)).size;
  assets.push({ file: relativePath, sha256: digest, size });
  sumLines.push(`${digest}  ${relativePath}`);
}

await writeFile(sumsPath, `${sumLines.join('\n')}\n`);

const changelog = generateNotesViaGh(version, sha) ?? generateNotesViaGitLog(sha);
await writeFile(notesPath, `${changelog}\n`);

const table = renderAssetTable(assets);
const npmPackages = [
  '@spiritagent/agent-core',
  '@spiritagent/host-internal',
  '@spiritagent/acp-server',
];
const npmTable = [
  '| Package | Version |',
  '| --- | --- |',
  ...npmPackages.map((name) => `| \`${name}\` | \`${version}\` |`),
].join('\n');

const report = [
  `# Release approval — ${version}`,
  '',
  `Target commit: \`${sha || '(local)'}\``,
  '',
  '## Changelog',
  '',
  changelog,
  '',
  '## GitHub Release',
  '',
  'Channel status: **Will publish after approval**',
  '',
  table,
  '',
  '## npm',
  '',
  'Channel status: **Will publish after approval** (OIDC trusted publishing)',
  '',
  'Publish order: `agent-core` → `host-internal` → `acp-server`',
  '',
  npmTable,
  '',
  '## Self-hosted (`download.spirit.fast`)',
  '',
  'Channel status: **Not publishing in this run** (architecture reserved)',
  '',
  table,
  '',
  '## Checksums',
  '',
  `Also written to \`SHA256SUMS.txt\` (${assets.length} files).`,
  '',
].join('\n');

await writeFile(reportPath, report);

const manifest = {
  version,
  sha: sha || null,
  generatedAt: new Date().toISOString(),
  channels: {
    github: { publish: true },
    npm: { publish: true, packages: npmPackages },
    selfhosted: { publish: false, host: 'download.spirit.fast' },
    msstore: { publish: false },
    homebrew: { publish: false },
  },
  assets,
  files: {
    report: 'approval-report.md',
    notes: 'release-notes.md',
    checksums: 'SHA256SUMS.txt',
  },
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

// Keep a copy of checksums next to the report for the release-bundle artifact layout.
await writeFile(path.join(outputDir, 'SHA256SUMS.txt'), `${sumLines.join('\n')}\n`);

console.log(`Wrote approval report: ${reportPath}`);
console.log(`Wrote manifest: ${manifestPath}`);
console.log(`Wrote notes: ${notesPath}`);
console.log(`Wrote checksums: ${sumsPath}`);

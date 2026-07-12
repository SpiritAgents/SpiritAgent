#!/usr/bin/env node
/**
 * Desktop renderer 仅允许从 host-internal 的 renderer-safe 子路径 import。
 * 主入口 @spiritagent/host-internal 会拉入 extensions / node:fs 依赖链（含 import type）。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
const desktopSrc = join(repoRoot, 'apps', 'desktop', 'src');

/** value import 允许的 host-internal 子路径（不含 node 依赖）。 */
const RENDERER_SAFE_HOST_INTERNAL_SUBPATHS = new Set([
  'config-v2',
  'workspace-file-reference-query',
  'model-provider-presets',
  'model-display-name',
  'openai-api-base',
  'azure-resource',
  'bedrock-region',
  'bedrock-mantle',
  'google-vertex-endpoints',
  'skill-paths',
  'tool-output-archive-path',
  'github-pull-request-url',
  'github-pull-request-checks-pages',
  'github-pull-request-conversation-pages',
  'github/types',
  'approval-level',
  'work-location',
  'local-file-composer-route',
  'image-file-support',
]);

const RENDERER_EXCLUDED_PREFIXES = [
  join(desktopSrc, 'host'),
];

function isRendererExcluded(filePath) {
  return RENDERER_EXCLUDED_PREFIXES.some(
    (prefix) => filePath === prefix || filePath.startsWith(`${prefix}/`),
  );
}

function collectSourceFiles(entryPath) {
  const stat = statSync(entryPath);
  if (stat.isFile() && /\.(tsx?|mts|d\.ts)$/u.test(entryPath)) {
    return [entryPath];
  }
  if (!stat.isDirectory()) {
    return [];
  }
  const files = [];
  for (const name of readdirSync(entryPath)) {
    const childPath = join(entryPath, name);
    if (RENDERER_EXCLUDED_PREFIXES.some((prefix) => childPath === prefix || childPath.startsWith(`${prefix}/`))) {
      continue;
    }
    files.push(...collectSourceFiles(childPath));
  }
  return files;
}

function scanHostStorageImports(filePath, content) {
  const violations = [];
  if (isRendererExcluded(filePath)) {
    return violations;
  }
  const hostImports = content.matchAll(
    /from\s+['"](?:@\/host\/|\.\.\/host\/|\.\/host\/)[^'"]*['"]/gu,
  );
  for (const match of hostImports) {
    const line = content.slice(0, match.index).split(/\r?\n/u).length;
    violations.push({
      file: relative(repoRoot, filePath),
      line,
      reason: 'renderer 禁止 import apps/desktop/src/host（会拉入 host-internal 主入口）',
    });
  }
  return violations;
}

function scanFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const violations = [];

  const importBlocks = content.matchAll(
    /import\s+(?:type\s+)?(?:(?!;|\n\s*import)[\s\S])*?from\s+['"]@spiritagent\/host-internal(?:\/([^'"]+))?['"]/gu,
  );

  for (const match of importBlocks) {
    const line = content.slice(0, match.index).split(/\r?\n/u).length;
    const subpath = match[1];
    if (!subpath) {
      violations.push({
        file: relative(repoRoot, filePath),
        line,
        reason: '禁止从 @spiritagent/host-internal 主入口 import（含 import type）',
      });
      continue;
    }
    const importStatement = match[0];
    if (/^\s*import\s+type\s+/u.test(importStatement.trimStart())) {
      continue;
    }
    if (!RENDERER_SAFE_HOST_INTERNAL_SUBPATHS.has(subpath)) {
      violations.push({
        file: relative(repoRoot, filePath),
        line,
        reason: `子路径 "${subpath}" 不在 renderer-safe allowlist`,
      });
    }
  }

  const inlineTypeImports = content.matchAll(
    /import\(['"]@spiritagent\/host-internal(?:\/([^'"]+))?['"]\)/gu,
  );
  for (const match of inlineTypeImports) {
    const line = content.slice(0, match.index).split(/\r?\n/u).length;
    const subpath = match[1];
    if (!subpath) {
      violations.push({
        file: relative(repoRoot, filePath),
        line,
        reason: '禁止 inline import("@spiritagent/host-internal") 主入口',
      });
      continue;
    }
    if (!RENDERER_SAFE_HOST_INTERNAL_SUBPATHS.has(subpath)) {
      violations.push({
        file: relative(repoRoot, filePath),
        line,
        reason: `inline import 子路径 "${subpath}" 不在 renderer-safe allowlist`,
      });
    }
  }

  violations.push(...scanHostStorageImports(filePath, content));

  return violations;
}

const files = collectSourceFiles(desktopSrc);

const violations = files.flatMap(scanFile);

if (violations.length > 0) {
  console.error('renderer host-internal import 检查失败:\n');
  for (const item of violations) {
    console.error(`  ${item.file}:${item.line} — ${item.reason}`);
  }
  process.exit(1);
}

console.log('renderer host-internal import 检查通过');

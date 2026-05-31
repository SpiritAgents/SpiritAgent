#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const inputDir = path.resolve(process.argv[2] ?? path.join(repoRoot, 'dist', 'release'));
const outputFile = path.resolve(process.argv[3] ?? path.join(inputDir, 'SHA256SUMS.txt'));

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (fullPath === outputFile) {
      continue;
    }
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

async function sha256(filePath) {
  await stat(filePath);
  const hash = createHash('sha256');
  await new Promise((resolve, reject) => {
    createReadStream(filePath)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', resolve);
  });
  return hash.digest('hex');
}

const files = (await collectFiles(inputDir)).sort((left, right) => left.localeCompare(right));
const lines = [];
for (const file of files) {
  const relativePath = path.relative(inputDir, file).replaceAll(path.sep, '/');
  lines.push(`${await sha256(file)}  ${relativePath}`);
}

await writeFile(outputFile, `${lines.join('\n')}\n`);
console.log(`Wrote ${outputFile}`);

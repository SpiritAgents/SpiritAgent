#!/usr/bin/env node
/**
 * One-shot codemod: rewrite node:test runner imports to vitest.
 *
 *   import test from "node:test"                 → import { test } from "vitest"
 *   import { test } from "node:test"             → import { test } from "vitest"
 *   import { describe, it } from "node:test"     → import { describe, it } from "vitest"
 *   import test, { afterEach } from "node:test"  → import { afterEach, test } from "vitest"
 *
 * node:assert/strict imports stay untouched (they work as-is under vitest).
 * Also prints locations needing manual migration (`{ skip: ... }` options,
 * `test.skip(...)`). Idempotent. Usage:
 *
 *   node scripts/migrate-vitest-imports.mjs <file-or-dir>...
 */
import { readFileSync, writeFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

const IMPORT_RE = /^import\s+(?:([A-Za-z_$][\w$]*)(?:\s*,\s*)?)?(?:\{([^}]*)\})?\s*from\s*"node:test";?\s*$/;

function collectFiles(target, out) {
  const stat = statSync(target);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(target)) {
      if (entry === "node_modules" || entry === "dist" || entry === "dist-electron") continue;
      collectFiles(path.join(target, entry), out);
    }
    return out;
  }
  if (/\.test\.(ts|mts|mjs)$/.test(target)) out.push(target);
  return out;
}

function migrateSource(source) {
  const manual = [];
  const lines = source.split("\n");
  const rewritten = lines.map((line, index) => {
    const match = IMPORT_RE.exec(line.trim());
    if (!match) return line;
    const defaultName = match[1];
    const named = (match[2] ?? "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (defaultName && defaultName !== "test") named.push(`test as ${defaultName}`);
    if (defaultName === "test") named.push("test");
    const unique = [...new Set(named)].sort();
    return `import { ${unique.join(", ")} } from "vitest";`;
  });
  lines.forEach((line, index) => {
    if (/\{\s*skip\s*:/.test(line) || /\btest\.skip\(/.test(line)) {
      manual.push(`${index + 1}: ${line.trim()}`);
    }
  });
  return { code: rewritten.join("\n"), changed: rewritten.join("\n") !== source, manual };
}

const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.error("usage: node scripts/migrate-vitest-imports.mjs <file-or-dir>...");
  process.exit(1);
}

let changedCount = 0;
let manualCount = 0;
for (const target of targets) {
  for (const file of collectFiles(target, [])) {
    const source = readFileSync(file, "utf8");
    const { code, changed, manual } = migrateSource(source);
    if (changed) {
      writeFileSync(file, code);
      changedCount += 1;
      console.log(`rewritten: ${file}`);
    }
    if (manual.length > 0) {
      manualCount += manual.length;
      console.log(`MANUAL: ${file}`);
      for (const hit of manual) console.log(`  ${hit}`);
    }
  }
}
console.log(`done: ${changedCount} files rewritten, ${manualCount} manual hits`);

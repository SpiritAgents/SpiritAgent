#!/usr/bin/env node
import { open, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const nodeEntitlements = path.join(scriptDir, 'entitlements', 'macos-node.plist');

// 大小端两种写法的魔数都各自唯一，因此统一按大端读一次即可，不必先判断字节序。
const THIN_MAGICS = new Set([0xfeedface, 0xcefaedfe, 0xfeedfacf, 0xcffaedfe]);
const FAT_MAGIC_BE = 0xcafebabe;
const FAT_MAGIC_LE = 0xbebafeca;

// Java class 文件与 fat Mach-O 共用 0xcafebabe，但紧随其后的字段是 class 版本号（≥45），
// 远超任何真实的架构数量，用它把两者区分开。
const MAX_FAT_ARCH_COUNT = 32;

/**
 * @param {string} filePath
 */
async function isMachO(filePath) {
  const handle = await open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(8);
    const { bytesRead } = await handle.read(buffer, 0, 8, 0);
    if (bytesRead < 4) {
      return false;
    }
    const magic = buffer.readUInt32BE(0);
    if (THIN_MAGICS.has(magic)) {
      return true;
    }
    if (bytesRead < 8 || (magic !== FAT_MAGIC_BE && magic !== FAT_MAGIC_LE)) {
      return false;
    }
    const archCount = magic === FAT_MAGIC_BE ? buffer.readUInt32BE(4) : buffer.readUInt32LE(4);
    return archCount >= 1 && archCount <= MAX_FAT_ARCH_COUNT;
  } finally {
    await handle.close();
  }
}

/**
 * @param {string} root
 * @param {string[]} skip 相对 root 的路径，命中后不再向下遍历
 */
async function collectMachO(root, skip = []) {
  const skipSet = new Set(skip);
  /** @type {string[]} */
  const found = [];

  /** @param {string} dir */
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name);
      if (skipSet.has(path.relative(root, entryPath))) {
        continue;
      }
      // node/bin 下有多个指向同一文件的符号链接，跟进去会把同一个二进制重复签几遍。
      if (entry.isSymbolicLink()) {
        continue;
      }
      if (entry.isDirectory()) {
        await walk(entryPath);
      } else if (entry.isFile() && (await isMachO(entryPath))) {
        found.push(entryPath);
      }
    }
  }

  await walk(root);
  return found;
}

/**
 * @param {string} filePath
 * @param {{ identity: string, keychain?: string, entitlements?: string }} options
 */
function signFile(filePath, { identity, keychain, entitlements }) {
  const args = ['--force', '--options', 'runtime', '--timestamp', '--sign', identity];
  if (keychain) {
    args.push('--keychain', keychain);
  }
  if (entitlements) {
    args.push('--entitlements', entitlements);
  }
  args.push(filePath);
  const result = spawnSync('codesign', args, { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`codesign 失败: ${filePath}`);
  }
}

/**
 * 读取签名身份；未配置时返回 null，调用方据此整体跳过签名。
 */
function resolveSigningIdentity() {
  const identity = process.env.SPIRIT_MACOS_SIGN_IDENTITY?.trim();
  if (!identity) {
    return null;
  }
  return { identity, keychain: process.env.SPIRIT_MACOS_KEYCHAIN?.trim() || undefined };
}

/**
 * 对 CLI 发布包内全部 Mach-O 做 Developer ID 签名。必须在打包成归档之前调用，
 * 否则归档里装的是未签名副本。
 *
 * @param {string} bundleRoot
 */
export async function signCliBundle(bundleRoot) {
  if (process.platform !== 'darwin') {
    console.log(`Skipping macOS signing: codesign is macOS-only, host is ${process.platform}`);
    return;
  }

  const signing = resolveSigningIdentity();
  if (!signing) {
    console.log('Skipping macOS signing: SPIRIT_MACOS_SIGN_IDENTITY is not set');
    return;
  }

  // node/ 子树用上游 Node 的 entitlements，其余二进制只启用 hardened runtime。
  const nodeRoot = path.join(bundleRoot, 'node');
  const groups = [
    { files: await collectMachO(nodeRoot), entitlements: nodeEntitlements },
    { files: await collectMachO(bundleRoot, ['node']), entitlements: undefined },
  ];

  let signed = 0;
  for (const group of groups) {
    for (const filePath of group.files) {
      console.log(`Signing ${path.relative(bundleRoot, filePath)}`);
      signFile(filePath, { ...signing, entitlements: group.entitlements });
      signed += 1;
    }
  }

  console.log(`Signed ${signed} Mach-O binaries with ${signing.identity}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const bundleRoot = process.argv[2];
  if (!bundleRoot) {
    console.error('Usage: node scripts/release/sign-macos.mjs <bundle root>');
    process.exit(1);
  }
  signCliBundle(path.resolve(bundleRoot)).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

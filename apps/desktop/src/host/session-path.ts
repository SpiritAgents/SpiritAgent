import path from 'node:path';

/**
 * 会话文件路径的比较键：Windows 文件系统不区分大小写，统一折叠为小写；
 * 其余平台保持大小写敏感。注册表查找与删除比较必须共用此归一化，
 * 避免 session-delete 与 session-registry 语义不一致。
 */
export function normalizeSessionPathKey(filePath: string): string {
  const resolved = path.resolve(filePath);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

export function sameSessionPath(left: string, right: string): boolean {
  return normalizeSessionPathKey(left) === normalizeSessionPathKey(right);
}

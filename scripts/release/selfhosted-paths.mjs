/** Shared GitHub artifact → download.spirit.fast path mapping (primary installers only). */

export const PUBLIC_DOWNLOAD_HOST = 'download.spirit.fast';

const PRIMARY_PATTERNS = [
  {
    channel: 'desktop',
    re: /^SpiritAgent-Desktop-(?<version>\d+\.\d+\.\d+)-darwin-(?<arch>x64|arm64)\.dmg$/,
    toKey: ({ arch, version }) => ({
      os: 'darwin',
      arch,
      version,
      fileName: `SpiritAgent-darwin-${arch}.dmg`,
    }),
  },
  {
    channel: 'desktop',
    re: /^SpiritAgent-Desktop-(?<version>\d+\.\d+\.\d+)-win-(?<arch>x64|ia32|arm64)\.exe$/,
    toKey: ({ arch, version }) => ({
      os: 'windows',
      arch,
      version,
      fileName: `SpiritAgent-windows-${arch}.exe`,
    }),
  },
  {
    channel: 'desktop',
    // electron-builder AppImage uses x86_64 for linux x64 (arm64 stays arm64).
    re: /^SpiritAgent-Desktop-(?<version>\d+\.\d+\.\d+)-linux-(?<arch>x64|x86_64|arm64)\.AppImage$/,
    toKey: ({ arch, version }) => {
      const normalizedArch = arch === 'x86_64' ? 'x64' : arch;
      return {
        os: 'linux',
        arch: normalizedArch,
        version,
        fileName: `SpiritAgent-linux-${normalizedArch}.AppImage`,
      };
    },
  },
  {
    channel: 'cli',
    re: /^SpiritAgent-CLI-(?<version>\d+\.\d+\.\d+)-darwin-(?<arch>x64|arm64)\.tar\.gz$/,
    toKey: ({ arch, version }) => ({
      os: 'darwin',
      arch,
      version,
      fileName: `SpiritAgent-CLI-darwin-${arch}.tar.gz`,
    }),
  },
  {
    channel: 'cli',
    re: /^SpiritAgent-CLI-(?<version>\d+\.\d+\.\d+)-windows-(?<arch>x64|ia32|arm64)\.zip$/,
    toKey: ({ arch, version }) => ({
      os: 'windows',
      arch,
      version,
      fileName: `SpiritAgent-CLI-windows-${arch}.zip`,
    }),
  },
  {
    channel: 'cli',
    re: /^SpiritAgent-CLI-(?<version>\d+\.\d+\.\d+)-linux-(?<arch>x64|arm64)\.tar\.gz$/,
    toKey: ({ arch, version }) => ({
      os: 'linux',
      arch,
      version,
      fileName: `SpiritAgent-CLI-linux-${arch}.tar.gz`,
    }),
  },
];

/** Expected primary installer count for a full multi-arch release matrix. */
export const EXPECTED_PRIMARY_ASSET_COUNT = 14;

/**
 * @param {string} fileName basename of a GitHub release asset
 * @returns {{ channel: string, os: string, arch: string, version: string, fileName: string } | undefined}
 */
export function mapPrimaryAsset(fileName) {
  const base = fileName.split('/').pop() ?? fileName;
  for (const pattern of PRIMARY_PATTERNS) {
    const match = base.match(pattern.re);
    if (!match?.groups) {
      continue;
    }
    const mapped = pattern.toKey(match.groups);
    return {
      channel: pattern.channel,
      ...mapped,
    };
  }
  return undefined;
}

/**
 * @param {{ channel: string, os: string, arch: string, fileName: string }} mapped
 * @param {string} versionSegment release version or "latest"
 */
export function objectKeyFor(mapped, versionSegment) {
  return `${mapped.channel}/${mapped.os}/${mapped.arch}/${versionSegment}/${mapped.fileName}`;
}

/**
 * @param {string} objectKey
 */
export function publicUrlFor(objectKey) {
  return `https://${PUBLIC_DOWNLOAD_HOST}/${objectKey}`;
}

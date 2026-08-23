import { pathToFileURL } from 'node:url';

/** X.Y.Z or X.Y.Z-(alpha|beta|rc).N — no "v" prefix. */
export const RELEASE_VERSION_RE = /^(\d+\.\d+\.\d+)(?:-(alpha|beta|rc)\.(\d+))?$/;

/** Filename capture for Desktop/CLI assets whose `${version}` may include a prerelease suffix. */
export const VERSION_IN_FILENAME_RE = String.raw`\d+\.\d+\.\d+(?:-(?:alpha|beta|rc)\.\d+)?`;

const ALLOWED_FORM =
  'Expected X.Y.Z or X.Y.Z-alpha.N / X.Y.Z-beta.N / X.Y.Z-rc.N (no "v" prefix).';

/**
 * @param {unknown} raw
 * @returns {{ version: string, channel: 'latest' | 'alpha' | 'beta' | 'rc', prerelease: boolean, npmTag: 'latest' | 'alpha' | 'beta' | 'rc' }}
 */
export function parseReleaseVersion(raw) {
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new Error(`Invalid or missing release version ${JSON.stringify(raw)}. ${ALLOWED_FORM}`);
  }
  const match = raw.match(RELEASE_VERSION_RE);
  if (!match) {
    throw new Error(`Invalid release version ${JSON.stringify(raw)}. ${ALLOWED_FORM}`);
  }
  const channel = match[2] ?? 'latest';
  return {
    version: raw,
    channel,
    prerelease: channel !== 'latest',
    npmTag: channel,
  };
}

/**
 * @param {unknown} raw
 * @returns {boolean}
 */
export function isReleaseVersion(raw) {
  return typeof raw === 'string' && RELEASE_VERSION_RE.test(raw);
}

function isCliEntry() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

if (isCliEntry()) {
  const versionIndex = process.argv.indexOf('--version');
  const raw =
    versionIndex >= 0 ? process.argv[versionIndex + 1] : (process.argv[2] ?? process.env.RELEASE_VERSION);
  try {
    process.stdout.write(`${JSON.stringify(parseReleaseVersion(raw))}\n`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

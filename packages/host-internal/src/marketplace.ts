import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { x as extractTar } from "tar";

import { installPreparedExtensionDirectory, type HostInstalledExtension } from "./extensions.js";
import type { ExtensionHostKind, ExtensionManagementContext } from "./storage.js";

const MARKETPLACE_TEMP_DIR_PREFIX = "spirit-marketplace-";
const SUPPORTED_SRI_HASH_ALGORITHMS = new Set(["sha256", "sha384", "sha512"]);
const MARKETPLACE_FETCH_TIMEOUT_MS = 20_000;
const MAX_MARKETPLACE_JSON_BYTES = 512 * 1024;
const MAX_MARKETPLACE_TEXT_BYTES = 2 * 1024 * 1024;
const MAX_MARKETPLACE_TARBALL_BYTES = 50 * 1024 * 1024;
export const DEFAULT_MARKETPLACE_REGISTRY_BASE_URL =
  "https://raw.githubusercontent.com/SpiritAgents/registry/refs/heads/main/registry/";

export type MarketplaceChannel = "stable" | "preview" | "experimental";
export type MarketplaceReviewStatus = "unverified" | "verified" | "revoked";

export interface MarketplaceCatalogItem {
  extensionId: string;
  packageName: string;
  status: string;
  featured: boolean;
  defaultVersion: string;
  defaultChannel: MarketplaceChannel;
  defaultReviewStatus: MarketplaceReviewStatus;
  detailPath: string;
  displayName: string;
  description: string;
  author?: string;
  homepageUrl?: string;
  repositoryUrl?: string;
  keywords: string[];
  supportedHosts: ExtensionHostKind[];
  requestedCapabilities: string[];
  iconUrl?: string;
}

export interface MarketplaceVersionChangelog {
  summary: string;
  body: string;
}

export interface MarketplaceDetailVersion {
  version: string;
  channel: MarketplaceChannel;
  reviewStatus: MarketplaceReviewStatus;
  displayName: string;
  description: string;
  author?: string;
  homepageUrl?: string;
  repositoryUrl?: string;
  keywords: string[];
  supportedHosts: ExtensionHostKind[];
  requestedCapabilities: string[];
  iconUrl?: string;
  publishedAt?: string;
  tarballUrl?: string;
  integrity?: string;
  shasum?: string;
  changelog?: MarketplaceVersionChangelog;
}

export interface MarketplaceDetail {
  extensionId: string;
  packageName: string;
  status: string;
  featured: boolean;
  defaultVersion: string;
  readmePath: string;
  versions: MarketplaceDetailVersion[];
}

export interface MarketplacePreparedInstall {
  extensionId: string;
  packageName: string;
  displayName: string;
  description: string;
  version: string;
  channel: MarketplaceChannel;
  reviewStatus: MarketplaceReviewStatus;
  supportedHosts: ExtensionHostKind[];
  supportsCurrentHost: boolean;
  tarballUrl?: string;
  integrity?: string;
  shasum?: string;
  sourceFileName: string;
  catalogItem: MarketplaceCatalogItem;
  detail: MarketplaceDetail;
}

export interface PrepareMarketplaceInstallRequest {
  extensionId: string;
  version?: string;
}

export interface InstallMarketplaceExtensionRequest {
  extensionId: string;
  version?: string;
  reviewAcknowledged?: boolean;
}

export interface HostExtensionMarketplaceManager {
  listCatalog(): Promise<readonly MarketplaceCatalogItem[]>;
  getDetail(extensionId: string): Promise<MarketplaceDetail>;
  getReadme(extensionId: string): Promise<string>;
  prepareInstall(request: PrepareMarketplaceInstallRequest): Promise<MarketplacePreparedInstall>;
  install(request: InstallMarketplaceExtensionRequest): Promise<HostInstalledExtension>;
}

export interface HostExtensionMarketplaceOptions {
  registryBaseUrl?: string;
  fetchImpl?: typeof fetch;
}

interface MarketplaceCatalogDocument {
  schemaVersion: number;
  items: MarketplaceCatalogItem[];
}

interface MarketplaceDetailDocument {
  schemaVersion: number;
  extensionId: string;
  packageName: string;
  status: string;
  featured: boolean;
  defaultVersion: string;
  readmePath: string;
  versions: MarketplaceDetailVersion[];
}

export function createHostExtensionMarketplace(
  context: ExtensionManagementContext,
  options: HostExtensionMarketplaceOptions = {},
): HostExtensionMarketplaceManager {
  const registryBaseUrl = ensureTrailingSlash(
    options.registryBaseUrl?.trim() || DEFAULT_MARKETPLACE_REGISTRY_BASE_URL,
  );
  const fetchImpl = options.fetchImpl ?? fetch;
  let catalogPromise: Promise<MarketplaceCatalogDocument> | undefined;
  const detailPromiseCache = new Map<string, Promise<MarketplaceDetailDocument>>();
  const readmePromiseCache = new Map<string, Promise<string>>();

  return {
    async listCatalog() {
      const catalog = await loadCatalogDocument(fetchImpl, registryBaseUrl, catalogPromise);
      catalogPromise = Promise.resolve(catalog);
      return catalog.items;
    },
    async getDetail(extensionId) {
      const detail = await loadDetailDocument(
        extensionId,
        fetchImpl,
        registryBaseUrl,
        detailPromiseCache,
        () => loadCatalogDocument(fetchImpl, registryBaseUrl, catalogPromise),
      );
      catalogPromise ??= loadCatalogDocument(fetchImpl, registryBaseUrl, undefined);
      return detail;
    },
    async getReadme(extensionId) {
      const cacheKey = extensionId.trim();
      if (!cacheKey) {
        throw new Error("Extension id must not be empty.");
      }
      const cached = readmePromiseCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const nextPromise = (async () => {
        const detail = await loadDetailDocument(
          cacheKey,
          fetchImpl,
          registryBaseUrl,
          detailPromiseCache,
          () => loadCatalogDocument(fetchImpl, registryBaseUrl, catalogPromise),
        );
        const readmeUrl = resolveRegistryAssetUrl(detail.readmePath, registryBaseUrl);
        return fetchText(readmeUrl, fetchImpl, "extension README");
      })();
      readmePromiseCache.set(cacheKey, nextPromise);
      void nextPromise.catch(() => {
        if (readmePromiseCache.get(cacheKey) === nextPromise) {
          readmePromiseCache.delete(cacheKey);
        }
      });
      return nextPromise;
    },
    async prepareInstall(request) {
      const prepared = await prepareMarketplaceInstall(
        context.hostKind,
        request,
        fetchImpl,
        registryBaseUrl,
        detailPromiseCache,
        () => loadCatalogDocument(fetchImpl, registryBaseUrl, catalogPromise),
      );
      catalogPromise ??= loadCatalogDocument(fetchImpl, registryBaseUrl, undefined);
      return prepared;
    },
    async install(request) {
      const prepared = await prepareMarketplaceInstall(
        context.hostKind,
        request,
        fetchImpl,
        registryBaseUrl,
        detailPromiseCache,
        () => loadCatalogDocument(fetchImpl, registryBaseUrl, catalogPromise),
      );
      if (!prepared.supportsCurrentHost) {
        throw new Error(
          `This extension version does not support installation on the current host: ${prepared.extensionId}@${prepared.version}`,
        );
      }
      if (prepared.reviewStatus !== "verified" && request.reviewAcknowledged !== true) {
        throw new Error(
          `Extension ${prepared.extensionId}@${prepared.version} is not verified; explicit confirmation is required before installation.`,
        );
      }
      if (!prepared.tarballUrl) {
        throw new Error(
          `Extension ${prepared.extensionId}@${prepared.version} is missing tarballUrl and cannot be installed.`,
        );
      }
      if (!prepared.integrity && !prepared.shasum) {
        throw new Error(
          `Extension ${prepared.extensionId}@${prepared.version} is missing integrity/shasum; downloaded content cannot be verified.`,
        );
      }

      const tarballBuffer = await fetchBinary(prepared.tarballUrl, fetchImpl, "extension tarball");
      verifyDownloadedTarball(tarballBuffer, prepared);

      const tempDirectory = await mkdtemp(path.join(os.tmpdir(), MARKETPLACE_TEMP_DIR_PREFIX));
      const tarballFilePath = path.join(tempDirectory, prepared.sourceFileName);
      const extractedPackageDirectory = path.join(tempDirectory, "package");

      try {
        await writeFile(tarballFilePath, tarballBuffer);
        await extractTar({
          file: tarballFilePath,
          cwd: tempDirectory,
          strict: true,
          preservePaths: false,
        });

        if (!existsSync(extractedPackageDirectory)) {
          throw new Error(
            `Extracted extension tarball is missing the package/ root directory: ${prepared.extensionId}@${prepared.version}`,
          );
        }

        const installed = await installPreparedExtensionDirectory(context, {
          preparedDirectoryPath: extractedPackageDirectory,
          fileName: prepared.sourceFileName,
          replaceExisting: true,
          installSource: "marketplace",
        });
        return installed;
      } finally {
        await rm(tempDirectory, { recursive: true, force: true });
      }
    },
  };
}

async function prepareMarketplaceInstall(
  hostKind: ExtensionHostKind,
  request: PrepareMarketplaceInstallRequest,
  fetchImpl: typeof fetch,
  registryBaseUrl: string,
  detailPromiseCache: Map<string, Promise<MarketplaceDetailDocument>>,
  loadCatalog: () => Promise<MarketplaceCatalogDocument>,
): Promise<MarketplacePreparedInstall> {
  const extensionId = request.extensionId.trim();
  if (!extensionId) {
    throw new Error("Extension id must not be empty.");
  }

  const catalog = await loadCatalog();
  const catalogItem = catalog.items.find((item) => item.extensionId === extensionId);
  if (!catalogItem) {
    throw new Error(`Extension not found in marketplace catalog: ${extensionId}`);
  }

  const detail = await loadDetailDocument(
    extensionId,
    fetchImpl,
    registryBaseUrl,
    detailPromiseCache,
    () => Promise.resolve(catalog),
  );
  const requestedVersion = request.version?.trim();
  const resolvedVersion = requestedVersion || detail.defaultVersion;
  const version = detail.versions.find((entry) => entry.version === resolvedVersion);
  if (!version) {
    throw new Error(`Extension ${extensionId} has no version: ${resolvedVersion}`);
  }

  return {
    extensionId: catalogItem.extensionId,
    packageName: catalogItem.packageName,
    displayName: version.displayName,
    description: version.description,
    version: version.version,
    channel: version.channel,
    reviewStatus: version.reviewStatus,
    supportedHosts: [...version.supportedHosts],
    supportsCurrentHost: version.supportedHosts.includes(hostKind),
    ...(version.tarballUrl
      ? { tarballUrl: normalizeMarketplaceHttpsUrl(version.tarballUrl, "marketplace tarball") }
      : {}),
    ...(version.integrity ? { integrity: version.integrity } : {}),
    ...(version.shasum ? { shasum: version.shasum } : {}),
    sourceFileName: deriveDownloadFileName(version.tarballUrl, extensionId, version.version),
    catalogItem,
    detail,
  };
}

async function loadCatalogDocument(
  fetchImpl: typeof fetch,
  registryBaseUrl: string,
  cachedPromise?: Promise<MarketplaceCatalogDocument>,
): Promise<MarketplaceCatalogDocument> {
  if (cachedPromise) {
    return cachedPromise;
  }
  const raw = await fetchJson(
    resolveRegistryAssetUrl("catalog.json", registryBaseUrl),
    fetchImpl,
    "marketplace catalog",
  );
  return parseCatalogDocument(raw);
}

async function loadDetailDocument(
  extensionId: string,
  fetchImpl: typeof fetch,
  registryBaseUrl: string,
  detailPromiseCache: Map<string, Promise<MarketplaceDetailDocument>>,
  loadCatalog: () => Promise<MarketplaceCatalogDocument>,
): Promise<MarketplaceDetailDocument> {
  const normalizedId = extensionId.trim();
  if (!normalizedId) {
    throw new Error("Extension id must not be empty.");
  }

  const cached = detailPromiseCache.get(normalizedId);
  if (cached) {
    return cached;
  }

  const nextPromise = (async () => {
    const catalog = await loadCatalog();
    const catalogItem = catalog.items.find((item) => item.extensionId === normalizedId);
    if (!catalogItem) {
      throw new Error(`Extension not found in marketplace catalog: ${normalizedId}`);
    }

    const raw = await fetchJson(
      resolveRegistryAssetUrl(catalogItem.detailPath, registryBaseUrl),
      fetchImpl,
      "marketplace detail",
    );
    const detail = parseDetailDocument(raw);
    if (detail.extensionId !== normalizedId) {
      throw new Error(
        `marketplace detail extension id mismatch: expected ${normalizedId}, got ${detail.extensionId}`,
      );
    }
    return detail;
  })();

  detailPromiseCache.set(normalizedId, nextPromise);
  void nextPromise.catch(() => {
    if (detailPromiseCache.get(normalizedId) === nextPromise) {
      detailPromiseCache.delete(normalizedId);
    }
  });
  return nextPromise;
}

async function fetchJson(url: string, fetchImpl: typeof fetch, label: string): Promise<unknown> {
  const response = await fetchResponse(url, fetchImpl, label, MAX_MARKETPLACE_JSON_BYTES);
  if (!response.ok) {
    throw new Error(`${label} fetch failed: ${response.status} ${response.statusText}`);
  }
  try {
    return JSON.parse(
      (await readResponseBuffer(response, label, MAX_MARKETPLACE_JSON_BYTES)).toString("utf8"),
    );
  } catch {
    throw new Error(`${label} is not valid JSON: ${url}`);
  }
}

async function fetchText(url: string, fetchImpl: typeof fetch, label: string): Promise<string> {
  const response = await fetchResponse(url, fetchImpl, label, MAX_MARKETPLACE_TEXT_BYTES);
  if (!response.ok) {
    throw new Error(`${label} fetch failed: ${response.status} ${response.statusText}`);
  }
  return (await readResponseBuffer(response, label, MAX_MARKETPLACE_TEXT_BYTES)).toString("utf8");
}

async function fetchBinary(url: string, fetchImpl: typeof fetch, label: string): Promise<Buffer> {
  const response = await fetchResponse(url, fetchImpl, label, MAX_MARKETPLACE_TARBALL_BYTES);
  if (!response.ok) {
    throw new Error(`${label} download failed: ${response.status} ${response.statusText}`);
  }
  return readResponseBuffer(response, label, MAX_MARKETPLACE_TARBALL_BYTES);
}

async function fetchResponse(
  url: string,
  fetchImpl: typeof fetch,
  label: string,
  maxBytes: number,
): Promise<Response> {
  const normalizedUrl = normalizeMarketplaceHttpsUrl(url, label);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MARKETPLACE_FETCH_TIMEOUT_MS);
  try {
    const response = await fetchImpl(normalizedUrl, { signal: controller.signal });
    assertMarketplaceContentLength(response, label, maxBytes);
    return response;
  } catch (error) {
    throw new Error(`${label} request failed: ${normalizedUrl}; ${extractErrorMessage(error)}`, {
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function readResponseBuffer(
  response: Response,
  label: string,
  maxBytes: number,
): Promise<Buffer> {
  assertMarketplaceContentLength(response, label, maxBytes);
  const reader = response.body?.getReader?.();
  if (!reader) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > maxBytes) {
      throw new Error(`${label} response too large: ${buffer.byteLength} bytes, limit ${maxBytes} bytes`);
    }
    return buffer;
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (!value) {
      continue;
    }
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new Error(`${label} response too large: exceeds ${maxBytes} bytes`);
    }
    chunks.push(value);
  }

  return Buffer.concat(
    chunks.map((chunk) => Buffer.from(chunk)),
    totalBytes,
  );
}

function assertMarketplaceContentLength(response: Response, label: string, maxBytes: number): void {
  const headerValue = response.headers.get("content-length");
  if (!headerValue) {
    return;
  }

  const contentLength = Number.parseInt(headerValue, 10);
  if (!Number.isFinite(contentLength) || contentLength < 0) {
    return;
  }
  if (contentLength > maxBytes) {
    throw new Error(`${label} response too large: ${contentLength} bytes, limit ${maxBytes} bytes`);
  }
}

function parseCatalogDocument(value: unknown): MarketplaceCatalogDocument {
  const root = requiredRecord(value, "marketplace catalog");
  const schemaVersion = numberField(root.schemaVersion, "catalog.schemaVersion");
  if (schemaVersion !== 1) {
    throw new Error(`Only marketplace catalog schemaVersion=1 is supported, got ${schemaVersion}`);
  }
  const items = arrayField(root.items, "catalog.items").map((entry, index) =>
    parseCatalogItem(entry, `catalog.items[${index}]`),
  );
  return { schemaVersion, items };
}

function parseCatalogItem(value: unknown, fieldPrefix: string): MarketplaceCatalogItem {
  const item = requiredRecord(value, fieldPrefix);
  return {
    extensionId: nonEmptyString(item.extensionId, `${fieldPrefix}.extensionId`),
    packageName: nonEmptyString(item.packageName, `${fieldPrefix}.packageName`),
    status: nonEmptyString(item.status, `${fieldPrefix}.status`),
    featured: booleanField(item.featured, `${fieldPrefix}.featured`),
    defaultVersion: nonEmptyString(item.defaultVersion, `${fieldPrefix}.defaultVersion`),
    defaultChannel: enumField(item.defaultChannel, `${fieldPrefix}.defaultChannel`, [
      "stable",
      "preview",
      "experimental",
    ]),
    defaultReviewStatus: enumField(item.defaultReviewStatus, `${fieldPrefix}.defaultReviewStatus`, [
      "unverified",
      "verified",
      "revoked",
    ]),
    detailPath: nonEmptyString(item.detailPath, `${fieldPrefix}.detailPath`),
    displayName: nonEmptyString(item.displayName, `${fieldPrefix}.displayName`),
    description: nonEmptyString(item.description, `${fieldPrefix}.description`),
    ...(optionalNonEmptyString(item.author)
      ? { author: optionalNonEmptyString(item.author)! }
      : {}),
    ...(optionalNonEmptyString(item.homepageUrl)
      ? { homepageUrl: optionalNonEmptyString(item.homepageUrl)! }
      : {}),
    ...(optionalNonEmptyString(item.repositoryUrl)
      ? { repositoryUrl: optionalNonEmptyString(item.repositoryUrl)! }
      : {}),
    keywords: optionalStringArray(item.keywords, `${fieldPrefix}.keywords`),
    supportedHosts: requiredHostKinds(item.supportedHosts, `${fieldPrefix}.supportedHosts`),
    requestedCapabilities: optionalStringArray(
      item.requestedCapabilities,
      `${fieldPrefix}.requestedCapabilities`,
    ),
    ...(optionalNonEmptyString(item.iconUrl)
      ? { iconUrl: optionalNonEmptyString(item.iconUrl)! }
      : {}),
  };
}

function parseDetailDocument(value: unknown): MarketplaceDetailDocument {
  const root = requiredRecord(value, "marketplace detail");
  const schemaVersion = numberField(root.schemaVersion, "detail.schemaVersion");
  if (schemaVersion !== 1) {
    throw new Error(`Only marketplace detail schemaVersion=1 is supported, got ${schemaVersion}`);
  }
  const versions = arrayField(root.versions, "detail.versions").map((entry, index) =>
    parseDetailVersion(entry, `detail.versions[${index}]`),
  );
  if (versions.length === 0) {
    throw new Error("marketplace detail.versions must not be empty.");
  }
  return {
    schemaVersion,
    extensionId: nonEmptyString(root.extensionId, "detail.extensionId"),
    packageName: nonEmptyString(root.packageName, "detail.packageName"),
    status: nonEmptyString(root.status, "detail.status"),
    featured: booleanField(root.featured, "detail.featured"),
    defaultVersion: nonEmptyString(root.defaultVersion, "detail.defaultVersion"),
    readmePath: nonEmptyString(root.readmePath, "detail.readmePath"),
    versions,
  };
}

function parseDetailVersion(value: unknown, fieldPrefix: string): MarketplaceDetailVersion {
  const version = requiredRecord(value, fieldPrefix);
  const changelogValue = version.changelog;
  const parsedChangelog = isRecord(changelogValue)
    ? {
        summary: nonEmptyString(changelogValue.summary, `${fieldPrefix}.changelog.summary`),
        body: nonEmptyString(changelogValue.body, `${fieldPrefix}.changelog.body`),
      }
    : undefined;

  return {
    version: nonEmptyString(version.version, `${fieldPrefix}.version`),
    channel: enumField(version.channel, `${fieldPrefix}.channel`, [
      "stable",
      "preview",
      "experimental",
    ]),
    reviewStatus: enumField(version.reviewStatus, `${fieldPrefix}.reviewStatus`, [
      "unverified",
      "verified",
      "revoked",
    ]),
    displayName: nonEmptyString(version.displayName, `${fieldPrefix}.displayName`),
    description: nonEmptyString(version.description, `${fieldPrefix}.description`),
    ...(optionalNonEmptyString(version.author)
      ? { author: optionalNonEmptyString(version.author)! }
      : {}),
    ...(optionalNonEmptyString(version.homepageUrl)
      ? { homepageUrl: optionalNonEmptyString(version.homepageUrl)! }
      : {}),
    ...(optionalNonEmptyString(version.repositoryUrl)
      ? { repositoryUrl: optionalNonEmptyString(version.repositoryUrl)! }
      : {}),
    keywords: optionalStringArray(version.keywords, `${fieldPrefix}.keywords`),
    supportedHosts: requiredHostKinds(version.supportedHosts, `${fieldPrefix}.supportedHosts`),
    requestedCapabilities: optionalStringArray(
      version.requestedCapabilities,
      `${fieldPrefix}.requestedCapabilities`,
    ),
    ...(optionalNonEmptyString(version.iconUrl)
      ? { iconUrl: optionalNonEmptyString(version.iconUrl)! }
      : {}),
    ...(optionalNonEmptyString(version.publishedAt)
      ? { publishedAt: optionalNonEmptyString(version.publishedAt)! }
      : {}),
    ...(optionalNonEmptyString(version.tarballUrl)
      ? { tarballUrl: optionalNonEmptyString(version.tarballUrl)! }
      : {}),
    ...(optionalNonEmptyString(version.integrity)
      ? { integrity: optionalNonEmptyString(version.integrity)! }
      : {}),
    ...(optionalNonEmptyString(version.shasum)
      ? { shasum: optionalNonEmptyString(version.shasum)! }
      : {}),
    ...(parsedChangelog ? { changelog: parsedChangelog } : {}),
  };
}

function verifyDownloadedTarball(
  buffer: Buffer,
  prepared: Pick<MarketplacePreparedInstall, "extensionId" | "version" | "integrity" | "shasum">,
): void {
  if (!prepared.integrity && !prepared.shasum) {
    throw new Error(
      `Extension tarball is missing integrity/shasum: ${prepared.extensionId}@${prepared.version}`,
    );
  }

  if (prepared.integrity) {
    const integrityEntries = prepared.integrity.split(/\s+/u).filter(Boolean);
    const matched = integrityEntries.some((entry) => verifySriEntry(buffer, entry));
    if (!matched) {
      throw new Error(
        `Extension tarball integrity verification failed: ${prepared.extensionId}@${prepared.version}`,
      );
    }
  }

  if (prepared.shasum) {
    const actual = createHash("sha1").update(buffer).digest("hex");
    if (actual.toLowerCase() !== prepared.shasum.toLowerCase()) {
      throw new Error(`Extension tarball shasum verification failed: ${prepared.extensionId}@${prepared.version}`);
    }
  }
}

function verifySriEntry(buffer: Buffer, entry: string): boolean {
  const separatorIndex = entry.indexOf("-");
  if (separatorIndex <= 0 || separatorIndex >= entry.length - 1) {
    return false;
  }
  const algorithm = entry.slice(0, separatorIndex).toLowerCase();
  if (!SUPPORTED_SRI_HASH_ALGORITHMS.has(algorithm)) {
    return false;
  }
  const expected = entry.slice(separatorIndex + 1);
  try {
    const actual = createHash(algorithm).update(buffer).digest("base64");
    return actual === expected;
  } catch {
    return false;
  }
}

function deriveDownloadFileName(
  tarballUrl: string | undefined,
  extensionId: string,
  version: string,
): string {
  if (tarballUrl) {
    try {
      const baseName = path.posix.basename(new URL(tarballUrl).pathname);
      const trimmed = decodeURIComponent(baseName).trim();
      if (trimmed) {
        return trimmed;
      }
    } catch {
      // ignore and fall back
    }
  }
  return `${extensionId.replace(/[^a-z0-9._-]+/giu, "-")}-${version}.tgz`;
}

function ensureTrailingSlash(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}

function resolveRegistryAssetUrl(relativeOrAbsolutePath: string, registryBaseUrl: string): string {
  const normalized = relativeOrAbsolutePath.trim();
  if (/^https?:\/\//iu.test(normalized)) {
    return normalizeMarketplaceHttpsUrl(normalized, "marketplace asset");
  }
  return normalizeMarketplaceHttpsUrl(
    new URL(normalized.replace(/^\.\//u, ""), registryBaseUrl).href,
    "marketplace asset",
  );
}

function normalizeMarketplaceHttpsUrl(url: string, label: string): string {
  let resolved: URL;
  try {
    resolved = new URL(url);
  } catch {
    throw new Error(`${label} URL is invalid: ${url}`);
  }
  if (resolved.protocol !== "https:") {
    throw new Error(`${label} URL must use https: ${resolved.href}`);
  }
  return resolved.href;
}

function requiredRecord(value: unknown, fieldName: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${fieldName} must be an object.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return String(error);
}

function nonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} must not be empty.`);
  }
  return value.trim();
}

function optionalNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function booleanField(value: unknown, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${fieldName} must be a boolean.`);
  }
  return value;
}

function numberField(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${fieldName} must be a number.`);
  }
  return value;
}

function arrayField(value: unknown, fieldName: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array.`);
  }
  return value;
}

function enumField<const T extends string>(
  value: unknown,
  fieldName: string,
  allowed: readonly T[],
): T {
  const normalized = nonEmptyString(value, fieldName) as T;
  if (!allowed.includes(normalized)) {
    throw new Error(`${fieldName} has an invalid value: ${normalized}`);
  }
  return normalized;
}

function optionalStringArray(value: unknown, fieldName: string): string[] {
  if (value === undefined || value === null) {
    return [];
  }
  return arrayField(value, fieldName).map((entry, index) =>
    nonEmptyString(entry, `${fieldName}[${index}]`),
  );
}

function requiredHostKinds(value: unknown, fieldName: string): ExtensionHostKind[] {
  const result = optionalStringArray(value, fieldName).map((entry) => {
    if (entry !== "cli" && entry !== "desktop") {
      throw new Error(`${fieldName} has an invalid value: ${entry}`);
    }
    return entry;
  });
  if (result.length === 0) {
    throw new Error(`${fieldName} requires at least one host.`);
  }
  return result;
}

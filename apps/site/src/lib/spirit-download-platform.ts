import {
  spiritDesktopDownloadUrl,
  type SpiritDownloadArch,
  type SpiritDownloadOs,
} from "@/lib/spirit-download-urls";
import { SPIRIT_LATEST_RELEASE_URL } from "@/lib/github-links";

export type SpiritDownloadPlatform = "macOS" | "Windows" | "Linux";

export type SpiritDownloadTarget = {
  os: SpiritDownloadOs;
  arch: SpiritDownloadArch;
  platform: SpiritDownloadPlatform;
};

export function detectSpiritDownloadPlatform(): SpiritDownloadPlatform | null {
  if (typeof navigator === "undefined") {
    return null;
  }

  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod|Android/i.test(ua)) {
    return null;
  }

  if (/Macintosh|Mac OS X/i.test(ua)) {
    return "macOS";
  }
  if (/Win(dows|32|64|16)|Windows NT/i.test(ua)) {
    return "Windows";
  }
  if (/Linux|CrOS/i.test(ua)) {
    return "Linux";
  }

  const platform = navigator.platform;
  if (platform === "MacIntel" || platform === "MacPPC") {
    return "macOS";
  }
  if (platform?.startsWith("Win")) {
    return "Windows";
  }
  if (platform?.includes("Linux")) {
    return "Linux";
  }

  return null;
}

function platformToOs(platform: SpiritDownloadPlatform): SpiritDownloadOs {
  switch (platform) {
    case "macOS":
      return "darwin";
    case "Windows":
      return "windows";
    case "Linux":
      return "linux";
  }
}

async function detectSpiritDownloadArch(
  platform: SpiritDownloadPlatform,
): Promise<SpiritDownloadArch> {
  if (typeof navigator !== "undefined") {
    const uaData = (
      navigator as Navigator & {
        userAgentData?: {
          getHighEntropyValues?: (
            hints: string[],
          ) => Promise<{ architecture?: string; bitness?: string }>;
        };
      }
    ).userAgentData;

    if (uaData?.getHighEntropyValues) {
      try {
        const { architecture, bitness } = await uaData.getHighEntropyValues([
          "architecture",
          "bitness",
        ]);
        if (architecture === "arm") {
          return "arm64";
        }
        if (architecture === "x86") {
          return bitness === "32" ? "ia32" : "x64";
        }
      } catch {
        // Fall through to UA heuristics.
      }
    }
  }

  const ua = navigator.userAgent;
  if (/aarch64|arm64|ARM64/i.test(ua)) {
    return "arm64";
  }
  if (/ia32|Win32/i.test(ua) && !/Win64|WOW64|x64|x86_64/i.test(ua) && platform === "Windows") {
    return "ia32";
  }
  if (/x64|x86_64|Win64|WOW64/i.test(ua)) {
    return "x64";
  }

  switch (platform) {
    case "macOS":
      // Safari on Apple Silicon reports MacIntel and omits arm64 from UA.
      return "arm64";
    case "Windows":
    case "Linux":
      return "x64";
  }
}

export async function resolveSpiritDownloadTarget(): Promise<SpiritDownloadTarget | null> {
  const platform = detectSpiritDownloadPlatform();
  if (!platform) {
    return null;
  }

  const arch = await detectSpiritDownloadArch(platform);
  return {
    os: platformToOs(platform),
    arch,
    platform,
  };
}

export async function resolveSpiritPlatformDownloadUrl(): Promise<string> {
  const target = await resolveSpiritDownloadTarget();
  if (!target) {
    return SPIRIT_LATEST_RELEASE_URL;
  }

  try {
    return spiritDesktopDownloadUrl(target.os, target.arch);
  } catch {
    return SPIRIT_LATEST_RELEASE_URL;
  }
}

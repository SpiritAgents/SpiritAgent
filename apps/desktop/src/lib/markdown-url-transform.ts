import { defaultUrlTransform as streamdownDefaultUrlTransform } from "streamdown";
import type { UrlTransform as StreamdownUrlTransform } from "streamdown";

import {
  isManagedGeneratedImageRef,
  isManagedGeneratedVideoRef,
} from "@/lib/managed-generated-asset";

export const streamdownUrlTransform: StreamdownUrlTransform = (url, key) => {
  if (key === "src") {
    if (isManagedGeneratedImageRef(url) || isManagedGeneratedVideoRef(url)) {
      return url;
    }
    const trimmed = typeof url === "string" ? url.trim() : "";
    if (trimmed.startsWith("//") || /^https?:/iu.test(trimmed)) {
      return "";
    }
  }
  return streamdownDefaultUrlTransform(url, key, {} as never);
};

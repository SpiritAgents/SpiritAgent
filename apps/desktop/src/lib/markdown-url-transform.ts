import { defaultUrlTransform as streamdownDefaultUrlTransform } from "streamdown";
import type { UrlTransform as StreamdownUrlTransform } from "streamdown";

import {
  isManagedGeneratedImageRef,
  isManagedGeneratedVideoRef,
} from "@/lib/managed-generated-asset";

export const streamdownUrlTransform: StreamdownUrlTransform = (url, key) => {
  if (key === "src" && (isManagedGeneratedImageRef(url) || isManagedGeneratedVideoRef(url))) {
    return url;
  }
  return streamdownDefaultUrlTransform(url, key, {} as never);
};

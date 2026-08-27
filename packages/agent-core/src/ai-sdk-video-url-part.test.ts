import assert from "node:assert/strict";
import { test } from "vitest";

import { buildAiSdkUserVideoFilePartFromUrl } from "./ai-sdk-video-url-part.js";

test("buildAiSdkUserVideoFilePartFromUrl uses video/* URL parts for https", () => {
  assert.deepEqual(buildAiSdkUserVideoFilePartFromUrl("https://example.com/clip.mp4"), {
    type: "file",
    mediaType: "video/*",
    data: {
      type: "url",
      url: "https://example.com/clip.mp4",
    },
  });
});

test("buildAiSdkUserVideoFilePartFromUrl keeps Moonshot Files API ms:// references as URL parts", () => {
  assert.deepEqual(buildAiSdkUserVideoFilePartFromUrl("ms://file-abc"), {
    type: "file",
    mediaType: "video/*",
    data: {
      type: "url",
      url: "ms://file-abc",
    },
  });
});

test("buildAiSdkUserVideoFilePartFromUrl inlines data URLs as base64 file data", () => {
  assert.deepEqual(buildAiSdkUserVideoFilePartFromUrl("data:video/mp4;base64,AAAA"), {
    type: "file",
    mediaType: "video/mp4",
    data: {
      type: "data",
      data: "AAAA",
    },
  });
});

test("buildAiSdkUserVideoFilePartFromUrl maps IANA video aliases to Moonshot media types", () => {
  assert.equal(
    buildAiSdkUserVideoFilePartFromUrl("data:video/quicktime;base64,AAAA").mediaType,
    "video/mov",
  );
  assert.equal(
    buildAiSdkUserVideoFilePartFromUrl("data:video/x-msvideo;base64,AAAA").mediaType,
    "video/avi",
  );
  assert.equal(
    buildAiSdkUserVideoFilePartFromUrl("data:video/x-ms-wmv;base64,AAAA").mediaType,
    "video/wmv",
  );
});

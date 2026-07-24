import assert from "node:assert/strict";
import { test } from "node:test";
import { sanitize } from "hast-util-sanitize";

import {
  MANAGED_GENERATED_ASSET_SANITIZE_PROTOCOL,
  streamdownSanitizeSchema,
} from "../../src/lib/markdown-streamdown-plugins.ts";

test("streamdown sanitize schema keeps spirit-agent img src", () => {
  const ref =
    "spirit://generated/image/1780701216913-a51ab479-f44c-4efc-86f8-a0a2fe4f85e7.png";
  const tree = {
    type: "root",
    children: [
      {
        type: "element",
        tagName: "img",
        properties: {
          src: ref,
          alt: "Generated image",
        },
        children: [],
      },
    ],
  };

  const safe = sanitize(tree, streamdownSanitizeSchema);
  const img = safe.children[0];
  assert.equal(img.tagName, "img");
  assert.equal(img.properties.src, ref);
});

test("streamdown sanitize schema keeps spirit-agent video src", () => {
  const ref = "spirit://generated/video/example.mp4";
  const tree = {
    type: "root",
    children: [
      {
        type: "element",
        tagName: "video",
        properties: {
          src: ref,
          controls: true,
        },
        children: [],
      },
    ],
  };

  const safe = sanitize(tree, streamdownSanitizeSchema);
  const video = safe.children[0];
  assert.equal(video.tagName, "video");
  assert.equal(video.properties.src, ref);
});

test("streamdown sanitize schema strips https image src", () => {
  const ref = "https://example.com/a.png";
  const tree = {
    type: "root",
    children: [
      {
        type: "element",
        tagName: "img",
        properties: { src: ref, alt: "remote" },
        children: [],
      },
    ],
  };

  const safe = sanitize(tree, streamdownSanitizeSchema);
  assert.equal(safe.children[0].properties.src, undefined);
});

test("streamdown sanitize schema keeps relative image src", () => {
  const ref = "./docs/diagram.png";
  const tree = {
    type: "root",
    children: [
      {
        type: "element",
        tagName: "img",
        properties: { src: ref, alt: "local" },
        children: [],
      },
    ],
  };

  const safe = sanitize(tree, streamdownSanitizeSchema);
  assert.equal(safe.children[0].properties.src, ref);
});

test("default github schema strips spirit-agent src", () => {
  const ref = "spirit://generated/image/test.png";
  const tree = {
    type: "root",
    children: [
      {
        type: "element",
        tagName: "img",
        properties: { src: ref, alt: "Generated image" },
        children: [],
      },
    ],
  };

  const safe = sanitize(tree);
  assert.equal(safe.children[0].properties.src, undefined);
  assert.equal(MANAGED_GENERATED_ASSET_SANITIZE_PROTOCOL, "spirit");
});

test("streamdown sanitize schema keeps picture link structure but strips remote media", () => {
  const actionHref = "https://example.com/action?ref=pr-review";
  const badgeSrc = "https://example.com/assets/badge-dark.png";
  const tree = {
    type: "root",
    children: [
      {
        type: "element",
        tagName: "a",
        properties: {
          href: actionHref,
          target: "_blank",
          rel: "noopener noreferrer",
        },
        children: [
          {
            type: "element",
            tagName: "picture",
            properties: {},
            children: [
              {
                type: "element",
                tagName: "source",
                properties: {
                  media: "(prefers-color-scheme: dark)",
                  srcset: badgeSrc,
                },
                children: [],
              },
              {
                type: "element",
                tagName: "img",
                properties: {
                  alt: "Apply fix",
                  width: 115,
                  height: 28,
                  src: badgeSrc,
                },
                children: [],
              },
            ],
          },
        ],
      },
    ],
  };

  const safe = sanitize(tree, streamdownSanitizeSchema);
  const link = safe.children[0];
  assert.equal(link.tagName, "a");
  assert.equal(link.properties.href, actionHref);
  const picture = link.children[0];
  assert.equal(picture.tagName, "picture");
  assert.equal(picture.children[0].tagName, "source");
  assert.equal(picture.children[0].properties.srcset, undefined);
  assert.equal(picture.children[1].tagName, "img");
  assert.equal(picture.children[1].properties.src, undefined);
});

test("streamdown sanitize schema keeps sup footnotes and drops html comments", () => {
  const tree = {
    type: "root",
    children: [
      { type: "comment", value: " METADATA_MARKER " },
      {
        type: "element",
        tagName: "sup",
        properties: {},
        children: [{ type: "text", value: "1" }],
      },
    ],
  };

  const safe = sanitize(tree, streamdownSanitizeSchema);
  assert.equal(safe.children.length, 1);
  assert.equal(safe.children[0].tagName, "sup");
});

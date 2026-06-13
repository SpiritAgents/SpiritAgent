import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultSchema, sanitize } from "hast-util-sanitize";

test("defaultSchema keeps bugbot picture link structure", () => {
  const tree = {
    type: "root",
    children: [
      {
        type: "element",
        tagName: "a",
        properties: {
          href: "https://cursor.com/open?link=example",
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
                  srcset: "https://cursor.com/assets/images/fix-in-cursor-dark.png",
                },
                children: [],
              },
              {
                type: "element",
                tagName: "img",
                properties: {
                  alt: "Fix All in Cursor",
                  width: 115,
                  height: 28,
                  src: "https://cursor.com/assets/images/fix-in-cursor-dark.png",
                },
                children: [],
              },
            ],
          },
        ],
      },
    ],
  };

  const safe = sanitize(tree, defaultSchema);
  const link = safe.children[0];
  assert.equal(link.tagName, "a");
  assert.equal(link.properties.href, "https://cursor.com/open?link=example");
  const picture = link.children[0];
  assert.equal(picture.tagName, "picture");
  assert.equal(picture.children[0].tagName, "source");
  assert.equal(picture.children[1].tagName, "img");
  assert.equal(
    picture.children[1].properties.src,
    "https://cursor.com/assets/images/fix-in-cursor-dark.png",
  );
});

test("defaultSchema keeps sup footnotes and drops html comments", () => {
  const tree = {
    type: "root",
    children: [
      { type: "comment", value: " BUGBOT_REVIEW " },
      {
        type: "element",
        tagName: "sup",
        properties: {},
        children: [{ type: "text", value: "Reviewed by Cursor Bugbot" }],
      },
    ],
  };

  const safe = sanitize(tree, defaultSchema);
  assert.equal(safe.children.length, 1);
  assert.equal(safe.children[0].tagName, "sup");
});

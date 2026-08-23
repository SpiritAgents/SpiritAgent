import assert from "node:assert/strict";
import { test } from "vitest";

import { isLspSupportedExtension, LSP_SUPPORTED_EXTENSIONS } from "./constants.js";
import { buildLspHostToolDefinitions } from "./tool-definitions.js";

test("LSP_SUPPORTED_EXTENSIONS covers in-scope languages and excludes HTML", () => {
  assert.equal(LSP_SUPPORTED_EXTENSIONS.has(".ts"), false);
  assert.ok(LSP_SUPPORTED_EXTENSIONS.has(".py"));
  assert.ok(LSP_SUPPORTED_EXTENSIONS.has(".go"));
  assert.ok(LSP_SUPPORTED_EXTENSIONS.has(".rs"));
  assert.ok(LSP_SUPPORTED_EXTENSIONS.has(".cpp"));
  assert.ok(LSP_SUPPORTED_EXTENSIONS.has(".java"));
  assert.ok(LSP_SUPPORTED_EXTENSIONS.has(".cs"));
  assert.equal(isLspSupportedExtension(".html"), false);
  assert.equal(isLspSupportedExtension(".css"), false);
});

test("buildLspHostToolDefinitions lists only ready providers", () => {
  const tools = buildLspHostToolDefinitions([
    {
      displayName: "Pyright",
      languageLabels: ["Python"],
      extensions: [".py", ".pyi"],
    },
    {
      displayName: "rust-analyzer",
      languageLabels: ["Rust"],
      extensions: [".rs"],
    },
  ]);
  assert.equal(tools.length, 1);
  const tool = tools[0] as {
    function?: {
      description?: string;
      parameters?: { properties?: { paths?: { description?: string } } };
    };
  };
  const description = tool.function?.description ?? "";
  const pathsDescription = tool.function?.parameters?.properties?.paths?.description ?? "";
  assert.match(description, /Pyright/);
  assert.match(description, /rust-analyzer/);
  assert.doesNotMatch(description, /gopls|clangd|OmniSharp|JDT/i);
  assert.match(pathsDescription, /Python/);
  assert.match(pathsDescription, /Rust/);
  assert.doesNotMatch(pathsDescription, /\.go|Java \(|C#/i);
});

test("buildLspHostToolDefinitions without ready providers avoids catalog listing", () => {
  const tools = buildLspHostToolDefinitions([]);
  const description =
    (tools[0] as { function?: { description?: string } }).function?.description ?? "";
  assert.doesNotMatch(description, /pyright|gopls|clangd|OmniSharp|JDT/i);
  assert.match(description, /No language servers are ready/i);
});

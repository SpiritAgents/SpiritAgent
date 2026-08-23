import assert from "node:assert/strict";
import { test } from "vitest";

import { formatLspInstallCommandLine, resolveLspInstallArgv } from "./install-command.js";
import { findLspProvider } from "./providers.js";

test("resolveLspInstallArgv returns npm argv for pyright", () => {
  const provider = findLspProvider("pyright");
  assert.ok(provider);
  assert.deepEqual(resolveLspInstallArgv(provider), {
    command: "npm",
    args: ["install", "-g", "pyright"],
  });
  assert.equal(formatLspInstallCommandLine(provider), "npm install -g pyright");
});

test("resolveLspInstallArgv returns go argv for gopls", () => {
  const provider = findLspProvider("gopls");
  assert.ok(provider);
  assert.deepEqual(resolveLspInstallArgv(provider), {
    command: "go",
    args: ["install", "golang.org/x/tools/gopls@latest"],
  });
  assert.equal(formatLspInstallCommandLine(provider), "go install golang.org/x/tools/gopls@latest");
});

test("resolveLspInstallArgv returns rustup argv for rust-analyzer", () => {
  const provider = findLspProvider("rust-analyzer");
  assert.ok(provider);
  assert.deepEqual(resolveLspInstallArgv(provider), {
    command: "rustup",
    args: ["component", "add", "rust-analyzer"],
  });
  assert.equal(formatLspInstallCommandLine(provider), "rustup component add rust-analyzer");
});

test("resolveLspInstallArgv is undefined for non-installable kinds", () => {
  assert.equal(resolveLspInstallArgv(findLspProvider("clangd")!), undefined);
  assert.equal(formatLspInstallCommandLine(findLspProvider("clangd")!), undefined);
  assert.equal(resolveLspInstallArgv(findLspProvider("jdtls")!), undefined);
  assert.equal(formatLspInstallCommandLine(findLspProvider("jdtls")!), undefined);
  assert.equal(resolveLspInstallArgv(findLspProvider("omnisharp")!), undefined);
});

test("resolveLspInstallArgv is undefined when npm package is missing", () => {
  assert.equal(resolveLspInstallArgv({ installKind: "npm" }), undefined);
  assert.equal(formatLspInstallCommandLine({ installKind: "npm" }), undefined);
});

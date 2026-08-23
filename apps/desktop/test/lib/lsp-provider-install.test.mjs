import assert from "node:assert/strict";
import { test } from "vitest";

import { isDesktopInstallableProvider } from "../../src/lib/lsp-provider-install.ts";

function provider(overrides = {}) {
  return {
    id: "pyright",
    displayName: "Pyright",
    languages: ["Python"],
    status: "not_found",
    installKind: "npm",
    npmPackage: "pyright",
    ...overrides,
  };
}

test("isDesktopInstallableProvider requires an install command", () => {
  assert.equal(isDesktopInstallableProvider(provider()), false);
  assert.equal(
    isDesktopInstallableProvider(provider({ installCommand: "npm install -g pyright" })),
    true,
  );
  assert.equal(
    isDesktopInstallableProvider(
      provider({
        id: "gopls",
        installKind: "go",
        installCommand: "go install golang.org/x/tools/gopls@latest",
      }),
    ),
    true,
  );
  assert.equal(
    isDesktopInstallableProvider(
      provider({
        id: "rust-analyzer",
        installKind: "rustup",
        installCommand: "rustup component add rust-analyzer",
      }),
    ),
    true,
  );
});

test("isDesktopInstallableProvider rejects non-installable kinds even with a command", () => {
  assert.equal(
    isDesktopInstallableProvider(
      provider({
        id: "clangd",
        installKind: "platform",
        installCommand: "brew install llvm",
      }),
    ),
    false,
  );
});

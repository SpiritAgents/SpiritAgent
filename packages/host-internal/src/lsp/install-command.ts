import type { LspProviderDescriptor } from "./providers.js";

export interface LspInstallCommandArgv {
  command: string;
  args: string[];
}

export type LspInstallCommandSource = Pick<LspProviderDescriptor, "installKind" | "npmPackage">;

export function resolveLspInstallArgv(
  provider: LspInstallCommandSource,
): LspInstallCommandArgv | undefined {
  switch (provider.installKind) {
    case "npm": {
      if (!provider.npmPackage) {
        return undefined;
      }
      return { command: "npm", args: ["install", "-g", provider.npmPackage] };
    }
    case "go":
      return { command: "go", args: ["install", "golang.org/x/tools/gopls@latest"] };
    case "rustup":
      return { command: "rustup", args: ["component", "add", "rust-analyzer"] };
    default:
      return undefined;
  }
}

export function formatLspInstallCommandLine(provider: LspInstallCommandSource): string | undefined {
  const argv = resolveLspInstallArgv(provider);
  if (!argv) {
    return undefined;
  }
  return [argv.command, ...argv.args].join(" ");
}

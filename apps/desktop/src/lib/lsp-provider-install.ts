import type { DesktopLspProviderSnapshot } from "@/types";

export function isDesktopInstallableProvider(provider: DesktopLspProviderSnapshot): boolean {
  return (
    Boolean(provider.installCommand) &&
    (provider.installKind === "npm" ||
      provider.installKind === "go" ||
      provider.installKind === "rustup")
  );
}

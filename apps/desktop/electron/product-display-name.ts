import { app } from "electron";

/** User-facing product name; must match electron-builder `productName`. */
export const PRODUCT_DISPLAY_NAME = "Spirit";

/** Electron reads `package.json#name` (`@spiritagent/desktop`); override for macOS menus. */
export function configureElectronProductDisplayName(): void {
  app.setName(PRODUCT_DISPLAY_NAME);
}

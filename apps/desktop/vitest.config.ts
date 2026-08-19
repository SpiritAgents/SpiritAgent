import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // Mirror the renderer alias in vite.config.ts / tsconfig.json paths.
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.mjs"],
    // Never collect compiled Electron output or dependencies.
    exclude: ["dist-electron/**", "dist/**", "node_modules/**"],
  },
});

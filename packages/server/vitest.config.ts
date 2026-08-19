import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    // daemon-lifecycle tests spawn real child processes and use real timers.
    testTimeout: 15000,
  },
});

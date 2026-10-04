import { defineConfig } from "vitest/config";
export default defineConfig({
  server: { proxy: { "/api": { target: "http://127.0.0.1:3000", changeOrigin: false } } },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.tsx"],
    setupFiles: ["./src/test-setup.ts"],
    restoreMocks: true,
  },
});

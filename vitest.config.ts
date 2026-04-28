import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    exclude: ["**/node_modules/**", "**/.next/**", "**/e2e/**"],
    setupFiles: ["./vitest.setup.ts"],
  },
});

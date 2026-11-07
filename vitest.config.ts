import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "src/x1/__tests__/**/*.test.ts",
      "src/lib/__tests__/**/*.test.ts",
    ],
  },
});

import path from "node:path";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: { alias: { "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts") } },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    env: { APP_SECRET: "test-secret-0123456789abcdef0123456789abcdef", DATABASE_URL: "postgresql://unused" },
  },
});

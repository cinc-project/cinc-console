import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    // A git worktree checked out under .claude/ is a second copy of this repo;
    // without this, vitest collects its tests too and they fail against the
    // outer node_modules.
    // e2e/ holds Playwright specs; they run under `make e2e`, not vitest.
    exclude: [...configDefaults.exclude, ".claude/**", "e2e/**"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      // server-only throws when imported outside a React Server Component;
      // stub it so server modules can be unit-tested under vitest.
      "server-only": fileURLToPath(
        new URL("./test/server-only-stub.ts", import.meta.url),
      ),
    },
  },
});

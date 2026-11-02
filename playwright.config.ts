import { defineConfig, devices } from "@playwright/test";

// End-to-end tests against a real cinc-server-ng. Run them with `make e2e`
// (scripts/e2e.sh), which boots the server, exports the console's env, and
// calls Playwright; this file alone does not start a Cinc server.
const port = Number(process.env.E2E_PORT ?? 3100);
// localhost, not 127.0.0.1: Chromium treats it as a secure context, so the
// production session cookie (Secure by default) is stored over plain HTTP.
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  // Specs share one server's state (they create and delete objects), so run
  // them in one worker rather than interleaving writes.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // A production build, not `next dev`: the CSP drops 'unsafe-eval' and the
    // session cookie is Secure only in production. (`next start` warns that
    // it isn't the standalone server the image runs; the app code is the same.)
    command: `pnpm build && pnpm start --port ${port}`,
    url: `${baseURL}/api/healthz`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    stdout: process.env.CI ? "pipe" : "ignore",
    stderr: "pipe",
  },
});

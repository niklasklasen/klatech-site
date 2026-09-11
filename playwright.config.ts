import { defineConfig, devices } from '@playwright/test';
import { BASE_URL, HOST, PORT } from './tests/e2e/pages';

/**
 * Runtime suite (QA-owned). Runs against the BUILT site in dist/, served by
 * tests/server.mjs — never against `astro dev`.
 *
 * Host/port live in tests/e2e/pages.ts and are deliberately not localhost:4321:
 * see the comment there. `reuseExistingServer` is off for the same reason — with
 * it on, an unrelated process already listening on the port is silently adopted
 * as the system under test, and the whole run reports on something that is not
 * dist/. Failing to start is the honest outcome.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `node tests/server.mjs`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 30_000,
    env: { PORT: String(PORT), HOST },
  },
});

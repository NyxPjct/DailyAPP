import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  workers: 2,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5174",
    timezoneId: "America/Sao_Paulo",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
        (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    },
  },
  webServer: [
    {
      command: "npm run dev -- --mode mobile --host 127.0.0.1 --port 5176 --strictPort --force",
      url: "http://127.0.0.1:5176",
      reuseExistingServer: false,
      env: { DAILYAPP_VITE_CACHE_DIR: "node_modules/.vite-mobile-tests" },
    },
    {
      command:
        "npm run dev -- --host 127.0.0.1 --port 5174 --strictPort --force",
      url: "http://127.0.0.1:5174",
      reuseExistingServer: false,
      env: {
        VITE_LOCAL_ONLY: "true",
        DAILYAPP_VITE_CACHE_DIR: "node_modules/.vite-local-tests",
      },
    },
    {
      command:
        "npm run dev -- --host 127.0.0.1 --port 5175 --strictPort --force",
      url: "http://127.0.0.1:5175",
      reuseExistingServer: false,
      env: {
        VITE_SUPABASE_URL: "http://127.0.0.1:54321",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_fixture",
        VITE_LOCAL_ONLY: "false",
        DAILYAPP_VITE_CACHE_DIR: "node_modules/.vite-cloud-tests",
      },
    },
  ],
});

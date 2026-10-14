import { test as base, expect } from "@playwright/test";

// Existing behavior tests explicitly exercise Portuguese, preserving their
// original assertions while new localization tests use the English default.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => localStorage.setItem("dailyapp.language", "pt-BR"));
    await use(page);
  },
});
export { expect };

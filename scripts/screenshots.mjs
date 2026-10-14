import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";

const html = await readFile(new URL("../artifacts/index.html", import.meta.url));
const output = new URL("../docs/screenshots/", import.meta.url);
await mkdir(output, { recursive: true });
const server = createServer((request, response) => {
  if (request.url !== "/") {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(html);
});
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});

const catalogSource = await readFile(new URL("../src/i18n/messages.ts", import.meta.url), "utf8");
const catalog = JSON.parse(catalogSource.slice(catalogSource.indexOf("{\n"), catalogSource.lastIndexOf(";")));
const locales = { en: "en-US", "pt-BR": "pt-BR", es: "es-ES", fr: "fr-FR", de: "de-DE" };
const languages = (process.env.DAILYAPP_SCREENSHOT_LANGUAGES || "en,pt-BR,es,fr,de").split(",");
for (const language of languages) if (!Object.hasOwn(locales, language)) throw new Error(`Unsupported screenshot language: ${language}`);
let browser;
try {
  browser = await chromium.launch({
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
      (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  });
  for (const language of languages) {
  const message = source => language === "pt-BR" ? source : catalog[source][language];
  const target = language === "en" ? output : new URL(`${language}/`, output);
  await mkdir(target, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 900 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: locales[language],
    timezoneId: "America/Sao_Paulo",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.clock.setFixedTime(new Date("2026-10-14T15:00:00Z"));
  await page.goto(`http://127.0.0.1:${server.address().port}`, {
    waitUntil: "networkidle",
  });
  await page.getByLabel("What should we call you?").fill("Ana");
  await page.getByRole("button", { name: "Get started", exact: true }).click();
  await page.getByRole("button", { name: "Explore example", exact: true }).click();
  await expect(page.getByText("You are exploring example data.")).toBeVisible();
  await page.getByRole("button", { name: "Close notification", exact: true }).click();
  // Explicit manual sample rates make the language/currency galleries
  // deterministic and demonstrate the actual language-switch behavior.
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  for (const [code, rate] of [["USD", "0.20"], ["EUR", "0.18"]]) {
    await page.getByLabel("App currency", { exact: true }).selectOption(code);
    if (await page.locator(".manual-rate").getAttribute("open") === null) await page.getByText("Enter a manual rate", { exact: true }).click();
    await page.getByLabel(`Value of 1 BRL in ${code}`).fill(rate);
    await page.getByRole("button", { name: "Save manual rate", exact: true }).click();
  }
  await page.getByLabel("App language", { exact: true }).selectOption(language);
  const profile = language === "en" ? "USD" : language === "pt-BR" ? "BRL" : "EUR";
  await expect(page.getByLabel(message("Moeda do aplicativo"), { exact: true })).toHaveValue(profile);
  if (language === "en") {
    // Keep a separate BRL gallery to show that a manual override is available.
    await page.getByLabel("App currency", { exact: true }).selectOption("BRL");
    await page.getByRole("button", { name: "Save currency", exact: true }).click();
  }
  await page.getByRole("navigation", { name: message("Navegação do aplicativo"), exact: true }).getByRole("button", { name: message("Visão geral"), exact: true }).click();
  await page.getByRole("button", { name: message("Fechar notificação"), exact: true }).click();
  await page.evaluate(() => document.fonts.ready);

  for (const [filename, navigation, heading] of [
    ["hoje.png", "Visão geral", "Seu dia, em equilíbrio."],
    ["tarefas.png", "Minhas tarefas", "Minhas tarefas"],
    ["financas.png", "Minhas finanças", "Minhas finanças"],
  ]) {
    await page.getByRole("button", { name: message(navigation), exact: true }).click();
    await expect(page.getByRole("heading", { name: message(heading), exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    await page.screenshot({ path: new URL(filename, target).pathname });
  }
  if (language === "en") {
    // An explicitly labeled manual example keeps screenshots reproducible
    // without presenting an invented rate as a current online quote.
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByLabel("App language", { exact: true }).selectOption("en");
    await expect(page.locator(".exchange-rate-info")).toContainText("Manual rate");
    if (await page.locator(".manual-rate").getAttribute("open") !== null) await page.getByText("Enter a manual rate", { exact: true }).click();
    await page.getByRole("button", { name: "Close notification", exact: true }).click();
    await page.locator(".currency-settings").scrollIntoViewIfNeeded();
    await page.locator(".currency-settings").evaluate(panel => {
      const topbar = document.querySelector(".topbar");
      const inset = (topbar?.getBoundingClientRect().bottom ?? 0) + 16;
      window.scrollBy({ top: panel.getBoundingClientRect().top - inset });
    });
    await page.screenshot({ path: new URL("moeda.png", target).pathname });
    await page.getByRole("button", { name: "My finances", exact: true }).click();
    await expect(page.locator(".stat-card").filter({ has: page.getByText("Income received", { exact: true }) })).toContainText("$1,330.00");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    await page.screenshot({ path: new URL("financas-usd.png", target).pathname });
    await page.getByRole("navigation", { name: message("Navegação do aplicativo"), exact: true }).getByRole("button", { name: message("Visão geral"), exact: true }).click();
    await expect(page.getByRole("heading", { name: message("Seu dia, em equilíbrio."), exact: true })).toBeVisible();
    await expect(page.locator(".stat-card").filter({ has: page.getByText("Monthly balance", { exact: true }) })).toContainText("$926.70");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    await page.screenshot({ path: new URL("hoje-usd.png", target).pathname });
  }
  expect(errors).toEqual([]);
  await context.close();
  }
  console.log("Capturas da interface móvel nos cinco idiomas e exemplo de conversão: docs/screenshots/");
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}

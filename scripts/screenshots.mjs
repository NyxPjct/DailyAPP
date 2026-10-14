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
  if (language !== "en") {
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByLabel("App language", { exact: true }).selectOption(language);
    await page.getByRole("button", { name: message("Visão geral"), exact: true }).click();
    await page.getByRole("button", { name: message("Fechar notificação"), exact: true }).click();
  }
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
  expect(errors).toEqual([]);
  await context.close();
  }
  console.log("Capturas da interface móvel com dados fictícios nos cinco idiomas: docs/screenshots/");
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}

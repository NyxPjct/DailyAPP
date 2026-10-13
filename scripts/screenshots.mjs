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

let browser;
try {
  browser = await chromium.launch({
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
      (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 900 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.clock.setFixedTime(new Date("2026-10-13T15:00:00Z"));
  await page.goto(`http://127.0.0.1:${server.address().port}`, {
    waitUntil: "networkidle",
  });
  await page.getByLabel("Como você quer ser chamado?").fill("Ana");
  await page.getByRole("button", { name: "Começar", exact: true }).click();
  await page.getByRole("button", { name: "Explorar exemplo", exact: true }).click();
  await expect(page.getByText("Você está explorando dados de exemplo.")).toBeVisible();
  await page.getByRole("button", { name: "Fechar notificação", exact: true }).click();
  await page.evaluate(() => document.fonts.ready);

  for (const [filename, navigation, heading] of [
    ["hoje.png", "Visão geral", "Seu dia, em equilíbrio."],
    ["tarefas.png", "Minhas tarefas", "Minhas tarefas"],
    ["financas.png", "Minhas finanças", "Minhas finanças"],
  ]) {
    await page.getByRole("button", { name: navigation, exact: true }).click();
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    await page.screenshot({ path: new URL(filename, output).pathname });
  }
  expect(errors).toEqual([]);
  console.log("Três capturas da interface móvel com dados fictícios: docs/screenshots/{hoje,tarefas,financas}.png");
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}

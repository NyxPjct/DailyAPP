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
  await page.clock.setFixedTime(new Date("2026-10-19T15:00:00Z"));
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
    await page.screenshot({ animations: "disabled",  path: new URL(filename, target).pathname });
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
    await page.screenshot({ animations: "disabled",  path: new URL("moeda.png", target).pathname });
    await page.getByRole("button", { name: "My finances", exact: true }).click();
    await expect(page.locator(".stat-card").filter({ has: page.getByText("Income received", { exact: true }) })).toContainText("$1,330.00");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    await page.screenshot({ animations: "disabled",  path: new URL("financas-usd.png", target).pathname });
    await page.getByRole("navigation", { name: message("Navegação do aplicativo"), exact: true }).getByRole("button", { name: message("Visão geral"), exact: true }).click();
    await expect(page.getByRole("heading", { name: message("Seu dia, em equilíbrio."), exact: true })).toBeVisible();
    await expect(page.locator(".stat-card").filter({ has: page.getByText("Monthly balance", { exact: true }) })).toContainText("$926.70");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    await page.screenshot({ animations: "disabled",  path: new URL("hoje-usd.png", target).pathname });
    // New version 1.2 examples use isolated, fictional ledger records. The
    // app validates them on reload and renders its normal screens and forms.
    await page.evaluate(() => {
      const data = JSON.parse(localStorage.getItem("dailyapp.v1"));
      data.accounts = [
        { id: "example-bank", name: "Daily Bank", kind: "bank", openingCents: 150000, openingDate: "2026-10-01" },
        { id: "example-wallet", name: "Pocket", kind: "cash", openingCents: 20000, openingDate: "2026-10-01" },
        { id: "example-savings", name: "Travel fund", kind: "savings", openingCents: 250000, openingDate: "2026-10-01" },
      ];
      data.transactions = data.transactions.map(t => ({ ...t, accountId: "example-bank" }));
      data.transactions.push({ id: "previous-month", description: "September expenses", amountCents: 240000, type: "expense", date: "2026-09-19", category: "Outros", paid: true, notes: "" });
      data.transfers = [{ id: "example-transfer", fromAccountId: "example-bank", toAccountId: "example-savings", amountCents: 50000, date: "2026-10-19", notes: "Monthly savings" }];
      data.categoryBudgets = { "2026-10": { Alimentação: 50000, Moradia: 120000, Transporte: 20000, Saúde: 20000 } };
      data.tasks = data.tasks.map((t,index) => ({ ...t, ...(index < 3 ? { focusDate: "2026-10-19" } : {}) }));
      data.tasks[0].subtasks = [{ id: "step-1", title: "Choose the three main outcomes", completed: true }, { id: "step-2", title: "Reserve time in the calendar", completed: false }];
      localStorage.setItem("dailyapp.v1", JSON.stringify(data));
    });
    await page.reload({ waitUntil: "networkidle" });
    for (const [file,tab,heading] of [["contas.png","Accounts","Accounts and wallets"],["limites.png","Planning","Category budgets"],["relatorio.png","Report","Monthly report"]]) {
      await page.getByRole("button",{ name:"My finances",exact:true }).click();
      await page.getByRole("group",{ name:"Financial view" }).getByRole("button",{ name:tab,exact:true }).click();
      const section = page.getByRole("heading",{ name:heading,exact:true });
      await expect(section).toBeVisible();
      await section.evaluate(element => { window.scrollBy({top: element.getBoundingClientRect().top - 100}); });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
      await page.screenshot({ animations: "disabled",  path:new URL(file,target).pathname });
    }
    await page.getByRole("navigation",{name:"App navigation"}).getByRole("button",{name:"Overview",exact:true}).click();
    await page.locator(".daily-focus").evaluate(element => { window.scrollBy({top:element.getBoundingClientRect().top-80}); });
    await page.screenshot({ animations: "disabled", path:new URL("prioridades.png",target).pathname});
    await page.getByRole("button",{name:"My tasks",exact:true}).click();
    await page.getByRole("button",{name:"Edit task: Plan this week's priorities",exact:true}).click();
    await page.getByRole("group",{name:"Subtasks",exact:true}).scrollIntoViewIfNeeded();
    await page.screenshot({ animations: "disabled", path:new URL("etapas.png",target).pathname});
    await page.getByRole("button",{name:"Cancel",exact:true}).click();
    await page.getByRole("button",{name:"Settings",exact:true}).click();
    await page.getByRole("button",{name:"Password-protected backup",exact:true}).click();
    await page.screenshot({ animations: "disabled", path:new URL("backup.png",target).pathname});

  }
  expect(errors).toEqual([]);
  await context.close();
  }
  console.log("Capturas da interface móvel nos cinco idiomas, conversão e recursos 1.2: docs/screenshots/");
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}

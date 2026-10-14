import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { freshData, validateData, money, amountInput } from "../src/domain";
import type { AppData } from "../src/domain";
import { CURRENCIES, RATE_URL, parseCurrencyAmount, parseCurrencyBalance, parseRateInput, ratesFromResponse, setCurrentCurrency, currencyForLanguage } from "../src/currency";
import { getLocale, LANGUAGES, setCurrentLanguage, translate } from "../src/i18n/core";
import { nativeBridge } from "./helpers/native";

const response = { date: "2026-10-14", brl: { brl: 1, usd: 0.2, eur: 0.18, gbp: 0.15, cad: 0.28, aud: 0.3 } };
const rates = ratesFromResponse(response, new Date("2026-10-14T15:00:00Z"));
const original: AppData = { ...freshData(), budgets: { "2026-10": 500000 }, cards: [{ id: "card", name: "Main", limitCents: 500000, closingDay: 25, dueDay: 5 }], openingBalances: { "2026-10": -10003 }, goals: [{ id: "goal", name: "Trip", targetCents: 200003, savedCents: 10003, targetDate: "2027-01-01", notes: "" }], transactions: [{ id: "expense", description: "My purchase", amountCents: 10003, type: "expense", date: "2026-10-14", category: "Compras", paid: true, notes: "" }] };
const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("dailyapp.v1")!) as AppData);
async function start(page: Page, data = original) {
  await nativeBridge(page, "android");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.setFixedTime(new Date("2026-10-14T15:00:00Z"));
  await page.addInitScript(data => { if (!localStorage.getItem("dailyapp.v1")) localStorage.setItem("dailyapp.v1", JSON.stringify(data)); }, data);
  await page.goto("http://127.0.0.1:5176", { waitUntil: "networkidle" });
}
async function settings(page: Page) { await page.getByRole("button", { name: "Settings", exact: true }).click(); }
async function finances(page: Page, tab?: string) {
  await page.getByRole("button", { name: "My finances", exact: true }).click();
  if (tab) await page.getByRole("button", { name: tab, exact: true }).click();
}
test.afterEach(() => { setCurrentCurrency("BRL"); setCurrentLanguage("en"); });

test("real conversion preserves legacy backups, validates rates, and reverses inputs without cent drift", () => {
  expect(validateData(freshData())).toEqual(freshData());
  expect(validateData({ ...original, currency: "USD", exchangeRates: rates }).transactions).toEqual(original.transactions);
  for (const value of [{ currency: "XXX" }, { currency: "USD" }, { currency: "USD", exchangeRates: { USD: { rate: 0, date: "2026-10-14", source: "manual" } } }, { exchangeRates: { USD: { rate: Infinity, date: "2026-10-14", source: "manual" } } }, { exchangeRates: { USD: { rate: 0.2, date: "2026-02-30", source: "manual" } } }]) expect(() => validateData({ ...original, ...value })).toThrow();
  for (const currency of CURRENCIES) {
    setCurrentCurrency(currency, rates);
    const rate = currency === "BRL" ? 1 : rates[currency]!.rate;
    expect(money(10000)).toBe((100 * rate).toLocaleString("en-US", { style: "currency", currency }));
    expect(parseCurrencyAmount(amountInput(10003), 10003)).toBe(10003);
    expect(parseCurrencyBalance(amountInput(-10003), -10003)).toBe(-10003);
  }
  setCurrentCurrency("USD", rates);
  expect(parseCurrencyAmount("20.00")).toBe(10000);
  expect(parseCurrencyBalance("-20.00")).toBe(-10000);
  expect(parseCurrencyBalance("0")).toBe(0);
  expect(parseCurrencyAmount("-1")).toBeNull();
  expect(parseCurrencyAmount("0")).toBeNull();
  expect(parseCurrencyAmount("200000000.01")).toBeNull();
  setCurrentCurrency("USD", { USD: { rate: 0.001, date: "2026-10-14", source: "manual" } });
  expect(parseCurrencyAmount(amountInput(1), 1)).toBe(1);
  for (const language of LANGUAGES) {
    setCurrentLanguage(language.id);
    expect(parseRateInput(language.id === "en" ? "0.20051249" : "0,20051249")).toBe(0.20051249);
  }
  for (const value of ["0", "-2", "1e3", "NaN", "0.123456789", "1,000.20"]) expect(parseRateInput(value)).toBeNull();
  for (const value of [{ ...response, date: "2028-01-01" }, { ...response, brl: { ...response.brl, usd: -1 } }, { ...response, brl: { ...response.brl, brl: 2 } }]) expect(() => ratesFromResponse(value, new Date("2026-10-14"))).toThrow();
});

test("online rate changes all financial views; unchanged edits preserve original cents and backups retain currency", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(AbortSignal, "timeout", { value: undefined }); Object.defineProperty(AbortSignal, "any", { value: undefined }); });
  const requests: string[] = [];
  await page.route(RATE_URL, async route => { requests.push(route.request().url()); await route.fulfill({ json: response, headers: { "access-control-allow-origin": "*" } }); });
  await start(page); await settings(page);
  await page.getByLabel("App currency", { exact: true }).selectOption("USD");
  await page.getByRole("button", { name: "Save currency", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Currency updated.");
  expect(requests).toHaveLength(1);
  expect((await saved(page)).transactions).toEqual(original.transactions);
  await finances(page);
  await expect(page.locator(".stat-card").filter({ has: page.getByText("Expenses paid", { exact: true }) })).toContainText("$20.01");
  await expect(page.locator(".budget-panel")).toContainText("$1,000.00");
  await page.getByRole("button", { name: "Edit transaction: My purchase", exact: true }).click();
  await expect(page.getByLabel("Amount ($)", { exact: true })).toHaveValue("20.01");
  await page.getByRole("dialog").getByRole("button", { name: "Save changes", exact: true }).click();
  expect((await saved(page)).transactions[0].amountCents).toBe(10003);
  await finances(page, "Cards and installments");
  await expect(page.locator(".card-limit")).toContainText("$1,000.00");
  await page.getByRole("button", { name: "Edit card: Main", exact: true }).click();
  await expect(page.getByLabel("Card limit ($)")).toHaveValue("1000.00");
  await page.getByRole("button", { name: "Save card", exact: true }).click();
  await finances(page, "Planning");
  await expect(page.locator(".forecast-panel")).toContainText("-$20.01");
  await page.getByRole("button", { name: "Update goal", exact: true }).click();
  await expect(page.getByLabel("Target amount ($)")).toHaveValue("400.01");
  await expect(page.getByLabel("Saved amount ($)")).toHaveValue("20.01");
  await page.getByRole("button", { name: "Save goal", exact: true }).click();
  expect((await saved(page)).goals).toEqual(original.goals);
  await settings(page);
  await page.getByRole("button", { name: "Export backup", exact: true }).click();
  const json = await page.evaluate(() => (window as any).dailyappNativeTest.calls.find((c: any) => c.method === "writeFile").options.data);
  expect(validateData(JSON.parse(json))).toMatchObject({ currency: "USD", exchangeRates: rates });
  await page.reload(); await settings(page);
  await page.unroute(RATE_URL);
  await page.context().setOffline(true);
  await expect(page.getByLabel("App currency", { exact: true })).toHaveValue("USD");
  await page.getByRole("button", { name: "Refresh exchange rate", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Use the saved rate");
  expect((await saved(page)).exchangeRates).toEqual(rates);
  await page.getByLabel("App currency", { exact: true }).selectOption("BRL");
  await page.getByRole("button", { name: "Save currency", exact: true }).click();
  expect((await saved(page)).transactions).toEqual(original.transactions);
  await page.getByLabel("Backup file").setInputFiles({ name: "currency.json", mimeType: "application/json", buffer: Buffer.from(json) });
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  expect((await saved(page)).currency).toBe("USD");
  expect((await saved(page)).exchangeRates).toEqual(rates);
});

for (const language of LANGUAGES) test(`${language.name}: manual currency choice works offline until the next language change`, async ({ page }) => {
  const tr = (key: string, ...values: unknown[]) => translate(language.id, key, ...values);
  await start(page, { ...original, language: language.id, exchangeRates: rates });
  await page.context().setOffline(true);
  await page.getByRole("button", { name: tr("Configurações"), exact: true }).click();
  for (const currency of CURRENCIES) {
    await page.getByLabel(tr("Moeda do aplicativo"), { exact: true }).selectOption(currency);
    await page.getByRole("button", { name: tr("Salvar moeda"), exact: true }).click();
    await page.getByRole("button", { name: tr("Minhas finanças"), exact: true }).click();
    const rate = currency === "BRL" ? 1 : rates[currency]!.rate;
    const expected = (Math.round(10003 * rate) / 100).toLocaleString(getLocale(language.id), { style: "currency", currency });
    await expect(page.locator(".stat-card").filter({ has: page.getByText(tr("Despesas pagas"), { exact: true }) })).toContainText(expected);
    await page.getByRole("button", { name: tr("Configurações"), exact: true }).click();
  }
  expect((await saved(page)).transactions).toEqual(original.transactions);
  await page.getByLabel(tr("Idioma do aplicativo"), { exact: true }).selectOption("en");
  expect((await saved(page)).currency).toBe("USD");
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("missing or invalid online quotes keep data unchanged; a manual rate enables conversion and inverse new entries", async ({ page }) => {
  await page.route(RATE_URL, route => route.fulfill({ json: { ...response, brl: { ...response.brl, usd: 0 } } }));
  await start(page); await settings(page);
  await page.getByLabel("App currency", { exact: true }).selectOption("USD");
  await page.getByRole("button", { name: "Save currency", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  expect((await saved(page)).currency).toBeUndefined();
  await page.getByText("Enter a manual rate", { exact: true }).click();
  await page.getByLabel("Value of 1 BRL in USD").fill("0");
  await page.getByRole("button", { name: "Save manual rate", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("valid positive rate");
  await page.getByLabel("Value of 1 BRL in USD").fill("0.20");
  await page.getByRole("button", { name: "Save manual rate", exact: true }).click();
  expect((await saved(page)).exchangeRates?.USD).toEqual({ rate: 0.2, source: "manual", date: "2026-10-14" });
  await finances(page);
  await page.locator(".heading-actions").getByRole("button", { name: "New transaction", exact: true }).click();
  await page.getByLabel("Description", { exact: true }).fill("In dollars");
  await page.getByLabel("Amount ($)", { exact: true }).fill("20.00");
  await page.getByRole("dialog").getByRole("button", { name: "Record transaction", exact: true }).click();
  expect((await saved(page)).transactions.find(t => t.description === "In dollars")?.amountCents).toBe(10000);
  await page.getByRole("button", { name: "Edit budget", exact: true }).click();
  await page.getByLabel("Expense limit ($)").fill("200.00");
  await page.getByRole("button", { name: "Save budget", exact: true }).click();
  expect((await saved(page)).budgets["2026-10"]).toBe(100000);
  await finances(page, "Cards and installments");
  await page.getByRole("button", { name: "Record purchase", exact: true }).click();
  await page.getByLabel("Purchase description").fill("Installments in dollars");
  await page.getByLabel("Total purchase amount ($)").fill("20.00");
  await page.getByLabel("Number of installments").fill("3");
  await page.getByRole("dialog").getByRole("button", { name: "Record purchase", exact: true }).click();
  expect((await saved(page)).transactions.filter(t => t.installment).map(t => t.amountCents)).toEqual([3334, 3333, 3333]);
  await finances(page, "Planning");
  await page.getByRole("button", { name: "New goal", exact: true }).click();
  await page.getByLabel("Goal name").fill("Dollars goal");
  await page.getByLabel("Target amount ($)").fill("20.00");
  await page.getByLabel("Saved amount ($)").fill("5.00");
  await page.getByRole("button", { name: "Create goal", exact: true }).click();
  expect((await saved(page)).goals?.find(g => g.name === "Dollars goal")).toMatchObject({ targetCents: 10000, savedCents: 2500 });
  await page.getByRole("button", { name: "Current month", exact: true }).click();
  await page.getByRole("button", { name: "Edit opening balance", exact: true }).click();
  await page.getByRole("dialog").getByRole("textbox").fill("-10.00");
  await page.getByRole("button", { name: "Save opening balance", exact: true }).click();
  expect((await saved(page)).openingBalances?.["2026-10"]).toBe(-5000);
});


test("stale quotes are dated and refresh changes estimates only after saving", async ({ page }) => {
  const stale = { ...rates, USD: { ...rates.USD!, date: "2026-09-01" } };
  await page.route(RATE_URL, route => route.fulfill({ json: { ...response, brl: { ...response.brl, usd: 0.25 } } }));
  await start(page, { ...original, currency: "USD", exchangeRates: stale });
  await settings(page);
  await expect(page.getByText("This rate is more than seven days old. Update it when you can.")).toBeVisible();
  await page.getByRole("button", { name: "Refresh exchange rate", exact: true }).click();
  await expect(page.getByText("1 BRL = 0.25 USD", { exact: true })).toBeVisible();
  expect((await saved(page)).exchangeRates?.USD?.rate).toBe(0.2);
  await page.getByRole("button", { name: "Save currency", exact: true }).click();
  expect((await saved(page)).exchangeRates?.USD?.rate).toBe(0.25);
  expect((await saved(page)).transactions).toEqual(original.transactions);
  await finances(page);
  await expect(page.locator(".stat-card").filter({ has: page.getByText("Expenses paid", { exact: true }) })).toContainText("$25.01");
});

for (const language of LANGUAGES) test(`${language.name}: changing language selects its currency offline without rewriting records`, async ({ page }) => {
  await start(page, { ...original, exchangeRates: rates });
  await settings(page); await page.context().setOffline(true);
  await page.getByLabel("App language", { exact: true }).selectOption(language.id);
  const target = currencyForLanguage(language.id);
  await expect(page.getByLabel(translate(language.id, "Moeda do aplicativo"), { exact: true })).toHaveValue(target);
  expect((await saved(page)).currency).toBe(target);
  expect((await saved(page)).transactions).toEqual(original.transactions);
  expect((await saved(page)).cards).toEqual(original.cards);
  expect((await saved(page)).goals).toEqual(original.goals);
  expect((await saved(page)).budgets).toEqual(original.budgets);
  expect((await saved(page)).openingBalances).toEqual(original.openingBalances);
  await page.getByRole("button", { name: translate(language.id, "Exportar backup"), exact: true }).click();
  const json = await page.evaluate(() => (window as any).dailyappNativeTest.calls.find((c: any) => c.method === "writeFile").options.data);
  expect(validateData(JSON.parse(json))).toMatchObject({ language: language.id, currency: target });
  await page.context().setOffline(false); await page.reload();
  expect((await saved(page)).currency).toBe(target);
});

test("missing rates keep the new language and original currency; selecting it again fetches and converts", async ({ page }) => {
  await page.route(RATE_URL, route => route.abort("internetdisconnected"));
  await start(page); await settings(page);
  await page.getByLabel("App language", { exact: true }).selectOption("de");
  await expect(page.locator(".currency-language-banner")).toContainText("Ohne Kurs für EUR");
  expect((await saved(page)).language).toBe("de");
  expect((await saved(page)).currency).toBeUndefined();
  expect((await saved(page)).transactions).toEqual(original.transactions);
  await page.unroute(RATE_URL); await page.route(RATE_URL, route => route.fulfill({ json: response }));
  await page.getByLabel(translate("de", "Idioma do aplicativo"), { exact: true }).selectOption("de");
  await expect(page.getByLabel(translate("de", "Moeda do aplicativo"), { exact: true })).toHaveValue("EUR");
  expect((await saved(page)).transactions).toEqual(original.transactions);
  await expect(page.locator(".currency-language-banner")).toHaveCount(0);
});

test("a late quote waits for an open amount form, preserves concurrent edits, and then applies the currency", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => release = resolve);
  let requested = false;
  await page.route(RATE_URL, async route => { requested = true; await pending; await route.fulfill({ json: response }).catch(() => {}); });
  await start(page); await settings(page);
  await page.getByLabel("App language", { exact: true }).selectOption("en");
  await expect.poll(() => requested).toBe(true);
  await finances(page);
  await page.getByRole("button", { name: "Edit transaction: My purchase", exact: true }).click();
  await expect(page.getByLabel("Amount (R$)", { exact: true })).toHaveValue("100.03");
  release();
  await expect(page.locator(".currency-language-banner")).toContainText("Close the form");
  await expect(page.getByLabel("Amount (R$)", { exact: true })).toHaveValue("100.03");
  await page.getByLabel("Description", { exact: true }).fill("Edited while fetching");
  await page.getByRole("dialog").getByRole("button", { name: "Save changes", exact: true }).click();
  await expect.poll(async () => (await saved(page)).currency).toBe("USD");
  expect((await saved(page)).transactions[0]).toMatchObject({ amountCents: 10003, description: "Edited while fetching" });
});

test("superseded language requests and manual currency choices cannot be overwritten by a late quote", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => release = resolve);
  let requested = false;
  await page.route(RATE_URL, async route => { requested = true; await pending; await route.fulfill({ json: response }).catch(() => {}); });
  await start(page); await settings(page);
  await page.getByLabel("App language", { exact: true }).selectOption("en");
  await expect.poll(() => requested).toBe(true);
  await page.getByLabel("App language", { exact: true }).selectOption("pt-BR");
  release();
  await expect(page.getByLabel("Moeda do aplicativo", { exact: true })).toHaveValue("BRL");
  expect((await saved(page)).currency).toBe("BRL");
  expect((await saved(page)).language).toBe("pt-BR");
  await page.getByLabel("Idioma do aplicativo", { exact: true }).selectOption("en");
  await expect.poll(async () => (await saved(page)).currency).toBe("USD");
  await page.getByLabel("App currency", { exact: true }).selectOption("CAD");
  await page.getByRole("button", { name: "Save currency", exact: true }).click();
  expect((await saved(page)).currency).toBe("CAD");
  await page.getByLabel("App language", { exact: true }).selectOption("fr");
  expect((await saved(page)).currency).toBe("EUR");
  expect((await saved(page)).transactions).toEqual(original.transactions);
});

test("manual saves and backup restore cancel pending currency requests, including a restore to the same language", async ({ page }) => {
  const releases: (() => void)[] = [], finishes: (() => void)[] = [];
  const gates = [0, 1].map(() => new Promise<void>(resolve => releases.push(resolve)));
  const done = [0, 1].map(() => new Promise<void>(resolve => finishes.push(resolve)));
  let requested = 0;
  await page.route(RATE_URL, async route => {
    const index = requested++; await gates[index];
    await route.fulfill({ json: response }).catch(() => {}); finishes[index]();
  });
  await start(page); await settings(page);
  await page.getByLabel("App language", { exact: true }).selectOption("en");
  await expect.poll(() => requested).toBe(1);
  await page.getByLabel("App currency", { exact: true }).selectOption("CAD");
  await page.getByText("Enter a manual rate", { exact: true }).click();
  await page.getByLabel("Value of 1 BRL in CAD").fill("0.28");
  await page.getByRole("button", { name: "Save manual rate", exact: true }).click();
  releases[0](); await done[0];
  expect((await saved(page)).currency).toBe("CAD");
  expect((await saved(page)).exchangeRates?.USD).toBeUndefined();
  await expect(page.locator(".currency-language-banner")).toHaveCount(0);
  await page.getByLabel("App language", { exact: true }).selectOption("de");
  await expect.poll(() => requested).toBe(2);
  const backup = { ...original, language: "de", currency: "GBP", exchangeRates: rates };
  await page.getByLabel(translate("de", "Arquivo de backup")).setInputFiles({ name: "restore.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
  await page.getByRole("button", { name: translate("de", "Confirmar"), exact: true }).click();
  releases[1](); await done[1];
  expect((await saved(page)).currency).toBe("GBP");
  expect((await saved(page)).transactions).toEqual(original.transactions);
  await expect(page.locator(".currency-language-banner")).toHaveCount(0);
});

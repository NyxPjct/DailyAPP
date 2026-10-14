import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { LANGUAGES, translate, parseLocalizedAmount, recordText } from "../src/i18n/core";
import { messages } from "../src/i18n/messages";
import { freshData, validateData } from "../src/domain";
import { nativeBridge } from "./helpers/native";

const expected = {
  en: { settings: "Settings", tasks: "My tasks", calendar: "My calendar", finance: "My finances", category: "Health", amount: "1,234.56", locale: "en-US" },
  "pt-BR": { settings: "Configurações", tasks: "Minhas tarefas", calendar: "Minha agenda", finance: "Minhas finanças", category: "Saúde", amount: "1.234,56", locale: "pt-BR" },
  es: { settings: "Ajustes", tasks: "Mis tareas", calendar: "Mi agenda", finance: "Mis finanzas", category: "Salud", amount: "1.234,56", locale: "es-ES" },
  fr: { settings: "Réglages", tasks: "Mes tâches", calendar: "Mon agenda", finance: "Mes finances", category: "Santé", amount: "1 234,56", locale: "fr-FR" },
  de: { settings: "Einstellungen", tasks: "Meine Aufgaben", calendar: "Mein Kalender", finance: "Meine Finanzen", category: "Gesundheit", amount: "1.234,56", locale: "de-DE" },
};
const saved = async (page: import("@playwright/test").Page) => page.evaluate(() => JSON.parse(localStorage.getItem("dailyapp.v1")!));

test("all five catalogs cover messages and placeholders; backups preserve valid language without rewriting legacy data", () => {
  expect(LANGUAGES.map(l => l.id)).toEqual(["en", "pt-BR", "es", "fr", "de"]);
  for (const filename of ["src/currency.ts", "src/features/CurrencySettings.tsx", "src/App.tsx", "src/features/FinancialPlanning.tsx", "src/features/PlanningPanels.tsx", "src/domain.ts", "src/planning.ts", "src/mobile/platform.ts"]) {
    const source = readFileSync(filename, "utf8");
    for (const call of source.matchAll(/\btr\(\s*("(?:\\.|[^"\\])*")/g)) {
      const key = JSON.parse(call[1]).trim();
      expect(messages[key], `${filename}: ${key}`).toBeDefined();
    }
  }
  for (const [key, translations] of Object.entries(messages)) {
    const parameters = [...key.matchAll(/\{\d+\}/g)].map(m => m[0]).sort();
    for (const language of ["en", "es", "fr", "de"] as const) {
      expect(translations[language].trim(), `${language}: ${key}`).not.toBe("");
      expect([...translations[language].matchAll(/\{\d+\}/g)].map(m => m[0]).sort(), `${language}: ${key}`).toEqual(parameters);
    }
  }
  expect(translate("de", "Olá, {0}!", "Ana {0}")).toBe("Hallo, Ana {0}!");
  expect(recordText("user-task", "Reunião de planejamento", "en")).toBe("Reunião de planejamento");
  expect(recordText("demo-task-2", "Reunião de planejamento", "en")).toBe("Planning meeting");
  expect(recordText("demo-task-2", "My custom title", "fr")).toBe("My custom title");
  expect(validateData(freshData())).toEqual(freshData());
  for (const language of LANGUAGES) expect(validateData({ ...freshData(), language: language.id }).language).toBe(language.id);
  expect(() => validateData({ ...freshData(), language: "xx" })).toThrow();
});

test("localized amounts preserve cents and reject ambiguous separators", () => {
  for (const language of LANGUAGES) expect(parseLocalizedAmount(expected[language.id].amount, language.id)).toBe(123456);
  expect(parseLocalizedAmount("1.234,56", "en")).toBeNull();
  expect(parseLocalizedAmount("1,234.56", "de")).toBeNull();
  expect(parseLocalizedAmount("1 23,45", "fr")).toBeNull();
  expect(parseLocalizedAmount("1\u202f234,56", "fr")).toBe(123456);
  expect(parseLocalizedAmount("0.01", "en")).toBe(1);
  expect(parseLocalizedAmount("12.34", "pt-BR")).toBe(1234);
  expect(parseLocalizedAmount("12,34", "en")).toBe(1234);
  expect(parseLocalizedAmount("999999999999999", "en")).toBeNull();
});

for (const language of LANGUAGES) test(`${language.name}: whole interface changes offline, survives restart, and preserves records and money`, async ({ page }) => {
  const id = language.id, labels = expected[id], tr = (s: string, ...v: unknown[]) => translate(id, s, ...v);
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await nativeBridge(page, "ios");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.setFixedTime(new Date("2026-10-14T15:00:00Z"));
  await page.goto("http://127.0.0.1:5176", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Your day starts here.", exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByRole("button", { name: "Start without setup", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("App language", { exact: true }).selectOption(id);
  await expect(page.locator("html")).toHaveAttribute("lang", id);
  await expect(page.getByRole("heading", { name: tr("Seu espaço, suas escolhas."), exact: true })).toBeVisible();
  await expect(page).toHaveTitle(`${labels.settings} · DailyAPP`);
  await page.context().setOffline(true);
  await page.getByRole("button", { name: labels.tasks, exact: true }).click();
  await expect(page.getByRole("heading", { name: labels.tasks, exact: true })).toBeVisible();
  await page.locator(".heading-actions").getByRole("button", { name: tr("Nova tarefa"), exact: true }).click();
  await page.getByLabel(tr("O que você precisa fazer?")).fill("Minha tarefa {0}");
  await page.getByLabel(tr("Categoria"), { exact: true }).selectOption("Saúde");
  await page.getByLabel(tr("Prioridade"), { exact: true }).selectOption("Alta");
  await page.getByRole("button", { name: tr("Criar tarefa"), exact: true }).click();
  await expect(page.getByText("Minha tarefa {0}", { exact: true })).toBeVisible();
  await expect(page.locator(".task-row .tag")).toHaveText(labels.category);
  expect((await saved(page)).tasks[0]).toMatchObject({ title: "Minha tarefa {0}", category: "Saúde", priority: "Alta" });
  await page.getByRole("button", { name: labels.calendar, exact: true }).click();
  await expect(page.getByRole("heading", { name: labels.calendar, exact: true })).toBeVisible();
  const weekdays = { en: ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"], "pt-BR": ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"], es: ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"], fr: ["DIM", "LUN", "MAR", "MER", "JEU", "VEN", "SAM"], de: ["SO", "MO", "DI", "MI", "DO", "FR", "SA"] };
  await expect(page.locator(".calendar-weekdays > span")).toHaveText(weekdays[id]);
  await page.getByRole("button", { name: labels.finance, exact: true }).click();
  await page.getByRole("button", { name: tr("Nova movimentação"), exact: true }).click();
  await page.getByLabel(tr("Descrição"), { exact: true }).fill("Minha compra {0}");
  await page.getByLabel(tr("Valor ({0})", new Intl.NumberFormat(labels.locale, { style: "currency", currency: "BRL" }).formatToParts(1).find(part => part.type === "currency")!.value), { exact: true }).fill(labels.amount);
  await page.getByRole("dialog").getByRole("button", { name: tr("Registrar movimentação"), exact: true }).click();
  expect((await saved(page)).transactions[0].amountCents).toBe(123456);
  await page.getByRole("button", { name: tr("Cartões e parcelas"), exact: true }).click();
  await expect(page.getByRole("heading", { name: tr("Seus cartões"), exact: true })).toBeVisible();
  await page.getByRole("button", { name: tr("Novo cartão"), exact: true }).click();
  await expect(page.getByLabel(tr("Lembrete da fatura"))).toBeVisible();
  await page.getByRole("button", { name: tr("Cancelar"), exact: true }).click();
  await page.getByRole("button", { name: tr("Planejamento"), exact: true }).click();
  await expect(page.getByRole("heading", { name: tr("Previsão de saldo"), exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: tr("Metas financeiras"), exact: true })).toBeVisible();
  await page.getByRole("button", { name: tr("Nova meta"), exact: true }).click();
  await expect(page.getByLabel(tr("Prazo da meta"))).toBeVisible();
  await page.getByRole("button", { name: tr("Cancelar"), exact: true }).click();
  await page.getByRole("button", { name: labels.settings, exact: true }).click();
  await page.getByRole("button", { name: tr("Como usar o DailyAPP"), exact: true }).click();
  await expect(page.getByRole("heading", { name: tr("Guia rápido"), exact: true })).toBeVisible();
  await page.getByRole("button", { name: tr("Entendi"), exact: true }).click();
  await page.getByRole("button", { name: tr("Exportar backup"), exact: true }).click();
  await expect(page.getByRole("status")).toContainText(tr("Backup preparado. Guarde sua cópia em um lugar seguro."));
  const calls = await page.evaluate(() => (window as any).dailyappNativeTest.calls);
  expect(calls.find((c: any) => c.method === "share").options.dialogTitle).toBe(tr("Salvar ou compartilhar backup"));
  const backup = JSON.parse(calls.find((c: any) => c.method === "writeFile").options.data);
  expect(backup.language).toBe(id);
  expect(backup.tasks[0].title).toBe("Minha tarefa {0}");
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.context().setOffline(false);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("html")).toHaveAttribute("lang", id);
  await page.getByRole("button", { name: labels.settings, exact: true }).click();
  await expect(page.getByLabel(tr("Idioma do aplicativo"), { exact: true })).toHaveValue(id);
  await page.getByLabel(tr("Arquivo de backup")).setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ ...backup, language: "en" })) });
  await page.getByRole("button", { name: tr("Confirmar"), exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  expect((await saved(page)).transactions[0].amountCents).toBe(123456);
  expect(errors).toEqual([]);
});

test("changing language updates native reminders, including delayed notifications, without dropping records", async ({ page }) => {
  await nativeBridge(page, "android");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.setFixedTime(new Date("2026-10-14T15:00:00Z"));
  await page.goto("http://127.0.0.1:5176", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Start without setup", exact: true }).click();
  await page.getByRole("button", { name: "New task", exact: true }).click();
  await page.getByLabel("What do you need to do?").fill("Minha consulta");
  await page.getByLabel("Time").fill("18:00");
  await page.getByLabel("Task reminder", { exact: true }).selectOption("0");
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  const pending = () => page.evaluate(() => (window as any).dailyappNativeTest.pendingNotifications.filter((n: any) => n.extra?.dailyapp));
  await expect.poll(async () => (await pending())[0]?.title).toBe("Your task is coming up");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("App language", { exact: true }).selectOption("de");
  await expect.poll(async () => (await pending())[0]?.title).toBe("Deine Aufgabe steht an");
  await page.clock.setFixedTime(new Date("2026-10-15T00:00:00Z"));
  await page.getByLabel("App-Sprache", { exact: true }).selectOption("fr");
  await expect.poll(async () => (await pending())[0]?.title).toBe("Votre tâche approche");
  expect((await pending())[0].body).toBe("Minha consulta");
  expect((await saved(page)).tasks).toHaveLength(1);
  await page.getByRole("button", { name: "Mes tâches", exact: true }).click();
  await page.getByRole("checkbox", { name: "Terminer la tâche : Minha consulta", exact: true }).click();
  await expect.poll(async () => (await pending()).length).toBe(0);
  expect(await page.evaluate(() => (window as any).dailyappNativeTest.pendingNotifications.map((n: any) => n.id))).toEqual([42]);
});


test("default-language backups include English and older backups retain the current preference", async ({ page }) => {
  await nativeBridge(page, "ios");
  await page.goto("http://127.0.0.1:5176", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Start without setup", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Export backup", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Backup ready");
  const json = await page.evaluate(() => (window as any).dailyappNativeTest.calls.find((c: any) => c.method === "writeFile").options.data);
  expect(JSON.parse(json).language).toBe("en");
  await page.getByLabel("App language", { exact: true }).selectOption("pt-BR");
  await page.getByLabel("Arquivo de backup").setInputFiles({ name: "older.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(freshData())) });
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  await expect(page.getByLabel("Idioma do aplicativo", { exact: true })).toHaveValue("pt-BR");
});

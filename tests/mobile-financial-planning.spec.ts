import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { freshData } from "../src/domain";
import type { AppData, Transaction } from "../src/domain";
import { nativeBridge } from "./helpers/native";

const entry = (id: string, amountCents: number, date: string, type: Transaction["type"] = "expense", paid = false): Transaction => ({ id, description: id, amountCents, date, type, paid, category: type === "income" ? "Salário" : "Moradia", notes: "" });
const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("dailyapp.v1")!));
async function start(page: Page, data: AppData = freshData(), platform: "android" | "ios" = "android") {
  await nativeBridge(page, platform);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.setFixedTime(new Date("2026-10-13T15:00:00Z"));
  await page.addInitScript(data => { if (!localStorage.getItem("dailyapp.v1")) localStorage.setItem("dailyapp.v1", JSON.stringify(data)); }, data);
  await page.goto("http://127.0.0.1:5176", { waitUntil: "networkidle" });
}
async function planning(page: Page) {
  await page.getByRole("button", { name: "Minhas finanças", exact: true }).click();
  await page.getByRole("button", { name: "Planejamento", exact: true }).click();
}

test("Hoje reúne contas atrasadas, de hoje e parcelas, e confirma pagamentos/recebimentos sem duplicar", async ({ page }) => {
  const card = { id: "card", name: "Principal", limitCents: 500000, closingDay: 5, dueDay: 20 };
  const parcel = { ...entry("Notebook", 10000, "2026-10-20"), installment: { cardId: "card", purchaseId: "purchase", index: 1, count: 3, purchasedOn: "2026-10-01" } };
  await start(page, { ...freshData(), cards: [card], transactions: [entry("Aluguel", 80000, "2026-09-30"), entry("Internet", 10000, "2026-10-13"), entry("Freelance", 50000, "2026-10-14", "income"), parcel, entry("Distante", 1000, "2026-10-21"), entry("Já paga", 1, "2026-10-13", "expense", true)] });
  const panel = page.getByRole("region", { name: "Contas e recebimentos próximos" });
  await expect(panel.locator("li")).toHaveCount(4);
  await expect(panel).toContainText("Em atraso");
  await expect(panel).toContainText("Notebook · 1/3");
  await expect(panel).not.toContainText("Distante");
  await panel.getByRole("button", { name: "Pagar: Internet", exact: true }).click();
  await panel.getByRole("button", { name: "Receber: Freelance", exact: true }).click();
  await expect(panel.locator("li")).toHaveCount(2);
  expect((await saved(page)).transactions).toHaveLength(6);
  expect((await saved(page)).transactions.filter((t: Transaction) => ["Internet", "Freelance"].includes(t.id)).every((t: Transaction) => t.paid)).toBe(true);
  await panel.getByRole("button", { name: "Editar conta: Notebook", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Fechar janela", exact: true }).click();
  await panel.getByRole("button", { name: "Metas e previsão do mês", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Previsão de saldo", exact: true })).toBeVisible();
});

test("previsão pede saldo inicial, permite negativos/zero, avisa aperto e mantém cada mês independente", async ({ page }) => {
  await start(page, { ...freshData(), transactions: [entry("Aluguel", 30000, "2026-10-02"), entry("Salário", 100000, "2026-10-15", "income"), entry("Conta anterior", 1000, "2026-09-30")] });
  await planning(page);
  const panel = page.getByRole("region", { name: "Previsão de saldo" });
  await expect(panel.locator(".forecast-result")).toHaveCount(0);
  await page.getByRole("button", { name: "Definir saldo inicial", exact: true }).click();
  await page.getByLabel("Saldo no início de outubro de 2026 (R$)").fill("-100,00");
  await page.getByRole("button", { name: "Salvar saldo inicial", exact: true }).click();
  await expect(panel.locator(".forecast-result")).toContainText("600,00");
  await expect(panel).toContainText("saldo negativo em 02 de out");
  await expect(panel).toContainText("10,00 de despesas pendentes de meses anteriores");
  await panel.locator("summary").click();
  await expect(panel.locator(".forecast-details li")).toHaveCount(2);
  await page.getByRole("button", { name: "Próximo mês", exact: true }).click();
  await expect(panel).toContainText("Ainda não informado");
  await page.getByRole("button", { name: "Definir saldo inicial", exact: true }).click();
  await page.getByLabel("Saldo no início de novembro de 2026 (R$)").fill("0,00");
  await page.getByRole("button", { name: "Salvar saldo inicial", exact: true }).click();
  await expect(panel.locator(".forecast-result")).toContainText("0,00");
  expect((await saved(page)).openingBalances).toEqual({ "2026-10": -10000, "2026-11": 0 });
  await page.getByRole("button", { name: "Editar saldo inicial", exact: true }).click();
  await page.getByRole("button", { name: "Remover saldo inicial deste mês", exact: true }).click();
  expect((await saved(page)).openingBalances).toEqual({ "2026-10": -10000 });
  await page.reload({ waitUntil: "networkidle" });
  await planning(page);
  await expect(panel.locator(".forecast-result")).toContainText("600,00");
});

test("metas atualizam progresso sem alterar movimentações; backup iOS restaura metas/saldos e funciona em tela estreita", async ({ page }) => {
  const transaction = entry("Salário", 100000, "2026-10-05", "income", true);
  await start(page, { ...freshData(), transactions: [transaction], openingBalances: { "2026-10": 20000 } }, "ios");
  await planning(page);
  await page.getByRole("button", { name: "Nova meta", exact: true }).click();
  await page.getByLabel("Nome da meta").fill("Reserva");
  await page.getByLabel("Valor desejado (R$)").fill("1.000,00");
  await page.getByLabel("Valor guardado (R$)").fill("250,00");
  await page.getByLabel("Prazo da meta").fill("2026-12-31");
  await page.getByRole("button", { name: "Criar meta", exact: true }).click();
  const goal = page.getByRole("article", { name: "Meta Reserva" });
  await expect(goal.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");
  await expect(goal).toContainText("250,00 por mês");
  await goal.getByRole("button", { name: "Atualizar meta", exact: true }).click();
  await page.getByLabel("Valor guardado (R$)").fill("1.100,00");
  await page.getByRole("button", { name: "Salvar meta", exact: true }).click();
  await expect(goal).toContainText("Concluída");
  await expect(goal.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  expect((await saved(page)).transactions).toEqual([transaction]);
  await goal.getByRole("button", { name: "Arquivar", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(goal).not.toBeVisible();
  await page.getByRole("button", { name: "Mostrar arquivadas", exact: true }).click();
  await goal.getByRole("button", { name: "Reativar", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Configurações", exact: true }).click();
  await page.getByRole("button", { name: "Exportar backup", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Backup preparado");
  const json = await page.evaluate(() => (window as any).dailyappNativeTest.calls.find((c: any) => c.method === "writeFile").options.data);
  expect(JSON.parse(json).goals[0].savedCents).toBe(110000);
  await page.getByRole("button", { name: "Apagar meus dados", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await page.getByLabel("Arquivo de backup").setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: Buffer.from(json) });
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  expect((await saved(page)).openingBalances).toEqual({ "2026-10": 20000 });
  await planning(page);
  await expect(goal).toContainText("Concluída");
  await goal.getByRole("button", { name: "Excluir meta: Reserva", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  expect((await saved(page)).goals).toEqual([]);
  expect((await saved(page)).transactions).toEqual([transaction]);
});

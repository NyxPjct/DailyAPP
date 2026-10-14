import { test, expect } from "./helpers/portuguese";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { STORAGE_KEY, freshData } from "../src/domain";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-13T15:00:00Z"));
  await page.goto("/");
});

async function nav(page: Page, text: string) {
  const menu = page.getByRole("button", { name: "Abrir menu" });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("button", { name: text, exact: true }).click();
}
async function createTask(page: Page, title: string) {
  await page.getByRole("button", { name: "Nova tarefa", exact: true }).click();
  await page.getByLabel("O que você precisa fazer?").fill(title);
  await page.getByLabel("Horário").fill("10:30");
  await page.getByRole("button", { name: "Criar tarefa" }).click();
}
async function createTransaction(
  page: Page,
  description: string,
  amount: string,
  income = false,
  paid = true,
) {
  await page
    .getByRole("button", { name: "Nova movimentação", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  if (income)
    await dialog.getByRole("button", { name: "Receita", exact: true }).click();
  await dialog.getByLabel("Descrição").fill(description);
  await dialog.getByLabel("Valor (R$)", { exact: true }).fill(amount);
  if (!paid) await dialog.getByRole("checkbox").uncheck();
  await dialog.getByRole("button", { name: "Registrar movimentação" }).click();
  await expect(dialog).not.toBeVisible();
}

test("cria, edita, conclui, persiste e exclui uma tarefa", async ({ page }) => {
  await createTask(page, "Consulta médica");
  await nav(page, "Minhas tarefas");
  await expect(
    page.getByText("Consulta médica", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Editar tarefa: Consulta médica" })
    .click();
  await page.getByLabel("O que você precisa fazer?").fill("Consulta de rotina");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await page
    .getByRole("checkbox", { name: "Concluir tarefa: Consulta de rotina" })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "Reabrir tarefa: Consulta de rotina" }),
  ).toHaveAttribute("aria-checked", "true");
  await page.reload();
  await nav(page, "Minhas tarefas");
  await expect(
    page.getByRole("checkbox", { name: "Reabrir tarefa: Consulta de rotina" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Excluir tarefa: Consulta de rotina" })
    .click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(
    page.getByText("Consulta de rotina", { exact: true }),
  ).not.toBeVisible();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).tasks.length,
      STORAGE_KEY,
    ),
  ).toBe(0);
});

test("calcula saldo e orçamento, paga despesa prevista e edita valores", async ({
  page,
}) => {
  await createTransaction(page, "Pagamento recebido", "1.000,00", true);
  await createTransaction(page, "Compras do mercado", "125,90");
  await createTransaction(page, "Internet prevista", "99,90", false, false);
  await nav(page, "Minhas finanças");
  await expect(
    page.locator(".stat-card").filter({ hasText: "Saldo do mês" }),
  ).toContainText("874,10");
  await expect(
    page
      .locator(".stat-card")
      .filter({ has: page.getByText("A pagar", { exact: true }) }),
  ).toContainText("99,90");
  await page
    .getByRole("button", { name: "Editar orçamento", exact: true })
    .click();
  await page.getByLabel("Limite de despesas (R$)").fill("200,00");
  await page.getByRole("button", { name: "Salvar orçamento" }).click();
  await expect(page.locator(".budget-panel")).toContainText("25,80");
  await expect(page.locator(".budget-panel")).toContainText("acima");
  await page
    .getByRole("button", { name: "Marcar como paga: Internet prevista" })
    .click();
  await expect(
    page.locator(".stat-card").filter({ hasText: "Saldo do mês" }),
  ).toContainText("774,20");
  await expect(
    page
      .locator(".stat-card")
      .filter({ has: page.getByText("A pagar", { exact: true }) }),
  ).toContainText("0,00");
  await page
    .getByRole("button", { name: "Editar movimentação: Compras do mercado" })
    .click();
  await page.getByLabel("Valor (R$)", { exact: true }).fill("25,90");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(
    page.locator(".stat-card").filter({ hasText: "Saldo do mês" }),
  ).toContainText("874,20");
  await page
    .getByRole("button", { name: "Excluir movimentação: Internet prevista" })
    .click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(
    page.locator(".stat-card").filter({ hasText: "Saldo do mês" }),
  ).toContainText("974,10");
  await page.getByLabel("Buscar movimentações").fill("mercado");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "Mês anterior", exact: true }).click();
  await expect(
    page.locator(".stat-card").filter({ hasText: "Saldo do mês" }),
  ).toContainText("0,00");
  await expect(page.locator(".budget-panel")).not.toContainText("acima");
});

test("agenda cadastra tarefa no dia selecionado e mantém filtros", async ({
  page,
}) => {
  await nav(page, "Minha agenda");
  await page
    .getByRole("button", { name: "20 de outubro, 0 tarefas", exact: true })
    .click();
  await page.getByRole("button", { name: "Adicionar neste dia" }).click();
  await expect(page.getByLabel("Data", { exact: true })).toHaveValue(
    "2026-10-20",
  );
  await page.getByLabel("O que você precisa fazer?").fill("Planejar viagem");
  await page.getByRole("button", { name: "Criar tarefa" }).click();
  await expect(
    page.getByRole("button", { name: "20 de outubro, 1 tarefas", exact: true }),
  ).toBeVisible();
  await nav(page, "Minhas tarefas");
  await page.getByRole("button", { name: "Hoje", exact: true }).click();
  await expect(
    page.getByText("Planejar viagem", { exact: true }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Todas", exact: true }).click();
  await page.getByLabel("Buscar tarefas").fill("viagem");
  await expect(
    page.getByText("Planejar viagem", { exact: true }),
  ).toBeVisible();
});

test("exporta, restaura e rejeita backups inválidos sem perder dados", async ({
  page,
}) => {
  await createTask(page, "Minha tarefa importante");
  await nav(page, "Configurações");
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exportar backup", exact: true })
    .click();
  const backup = await downloaded;
  expect(backup.suggestedFilename()).toBe("dailyapp-2026-10-13.json");
  const raw = await page.evaluate(
    (key) => localStorage.getItem(key)!,
    STORAGE_KEY,
  );
  await page.getByLabel("Arquivo de backup").setInputFiles({
    name: "invalido.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"schemaVersion":99}'),
  });
  await expect(page.getByRole("status")).toContainText(
    "não é um backup válido",
  );
  expect(
    await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY),
  ).toBe(raw);
  await page.getByRole("button", { name: "Apagar meus dados" }).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await page.getByLabel("Arquivo de backup").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(raw),
  });
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await nav(page, "Minhas tarefas");
  await expect(
    page.getByText("Minha tarefa importante", { exact: true }),
  ).toBeVisible();
});

test("dados de exemplo ficam identificados e começar do zero preserva tarefas próprias", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Explorar exemplo", exact: true })
    .last()
    .click();
  await expect(
    page.getByText("Você está explorando dados de exemplo."),
  ).toBeVisible();
  await createTask(page, "Uma tarefa minha");
  await page
    .getByRole("button", { name: "Editar orçamento", exact: true })
    .click();
  await page.getByLabel("Limite de despesas (R$)").fill("2.000,00");
  await page.getByRole("button", { name: "Salvar orçamento" }).click();
  await page.getByRole("button", { name: "Usar meus dados" }).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(
    page.getByText("Você está explorando dados de exemplo."),
  ).not.toBeVisible();
  await nav(page, "Minhas tarefas");
  await expect(
    page.getByText("Uma tarefa minha", { exact: true }),
  ).toBeVisible();
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    STORAGE_KEY,
  );
  expect(saved.tasks).toHaveLength(1);
  expect(saved.transactions).toHaveLength(0);
  expect(saved.budgets).toEqual({ "2026-10": 200000 });
});

test("protege dados ilegíveis e permite recuperação explícita", async ({
  page,
}) => {
  await page.evaluate(
    (key) => localStorage.setItem(key, "{broken"),
    STORAGE_KEY,
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("Não foi possível ler");
  await createTask(page, "Não sobrescrever dados");
  await expect(page.getByRole("status")).toContainText("Recupere seus dados");
  expect(
    await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY),
  ).toBe("{broken");
  await page.getByRole("button", { name: "Fechar janela" }).click();
  await nav(page, "Configurações");
  await page.getByLabel("Arquivo de backup").setInputFiles({
    name: "novo.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(freshData())),
  });
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(page.getByRole("alert")).not.toBeVisible();
});

test("funciona em celular sem transbordamento e permite cadastro pelo menu", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await createTask(page, "Caminhar no parque");
  await nav(page, "Minhas tarefas");
  await expect(
    page.getByText("Caminhar no parque", { exact: true }),
  ).toBeVisible();
  await nav(page, "Visão geral");
  await createTransaction(page, "Café da manhã", "12,50");
  for (const name of [
    "Visão geral",
    "Minha agenda",
    "Minhas finanças",
    "Configurações",
  ]) {
    await nav(page, name);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});

test("modal mantém foco, fecha com Escape e não apresenta erros de JavaScript", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByRole("button", { name: "Nova tarefa", exact: true }).click();
  await page.keyboard.press("Shift+Tab");
  expect(
    await page
      .getByRole("dialog")
      .evaluate((el) => el.contains(document.activeElement)),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Nova tarefa", exact: true }),
  ).toBeFocused();
  expect(errors).toEqual([]);
});

test("telas e formulários atendem às verificações automáticas de acessibilidade", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Explorar exemplo", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "Fechar notificação" }).click();
  for (const name of [
    "Visão geral",
    "Minha agenda",
    "Minhas tarefas",
    "Minhas finanças",
    "Configurações",
  ]) {
    await nav(page, name);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(result.violations, name).toEqual([]);
  }
  await nav(page, "Visão geral");
  for (const name of ["Nova tarefa", "Nova movimentação", "Editar orçamento"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.locator(".modal-backdrop")).toHaveCSS("opacity", "1");
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(result.violations, name).toEqual([]);
    await page.getByRole("button", { name: "Fechar janela" }).click();
  }
});

test("falha de armazenamento preserva registros e explica por que não salvou", async ({
  page,
}) => {
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("No space", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "Nova tarefa", exact: true }).click();
  await page
    .getByLabel("O que você precisa fazer?")
    .fill("Uma tarefa sem espaço");
  await page.getByRole("button", { name: "Criar tarefa" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Não foi possível salvar",
  );
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY),
  ).toBeNull();
});

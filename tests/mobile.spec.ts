import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { freshData, validateData } from "../src/domain";

import { nativeBridge } from "./helpers/native";

async function start(page: Page, platform: "android" | "ios", skipIntro = true) {
  await nativeBridge(page, platform);
  if (platform === "ios") {
    await page.addInitScript(() => {
      Object.defineProperty(crypto, "randomUUID", { value: undefined });
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.setFixedTime(new Date("2026-10-13T15:00:00Z"));
  await page.goto("http://127.0.0.1:5176", { waitUntil: "networkidle" });
  if (skipIntro && await page.getByRole("dialog", { name: "Seu dia começa aqui." }).isVisible()) {
    await page.getByRole("button", { name: "Começar sem configurar", exact: true }).click();
  }
}

async function task(page: Page, title = "Consulta no celular") {
  await page.getByRole("button", { name: "Nova tarefa", exact: true }).click();
  await page.getByLabel("O que você precisa fazer?").fill(title);
  await page.getByRole("button", { name: "Criar tarefa", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
}

async function movement(page: Page, description: string, amount: string, income = false) {
  await page.getByRole("button", { name: "Nova movimentação", exact: true }).click();
  const dialog = page.getByRole("dialog");
  if (income) await dialog.getByRole("button", { name: "Receita", exact: true }).click();
  await dialog.getByLabel("Descrição").fill(description);
  await dialog.getByLabel("Valor (R$)", { exact: true }).fill(amount);
  await dialog.getByRole("button", { name: "Registrar movimentação" }).click();
  await expect(dialog).not.toBeVisible();
}

for (const platform of ["android", "ios"] as const) {
  test(`${platform}: usa tarefas e finanças sem rede, mantém dados e navega pela barra inferior`, async ({ page }) => {
    const remote: string[] = [];
    page.on("request", request => {
      if (!request.url().startsWith("http://127.0.0.1:5176") && !request.url().startsWith("data:")) remote.push(request.url());
    });
    await start(page, platform);
    await expect(page.getByRole("navigation", { name: "Navegação do aplicativo" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Abrir menu" })).not.toBeVisible();
    await page.context().setOffline(true);
    await task(page);
    await movement(page, "Salário no celular", "1.000,00", true);
    await movement(page, "Mercado no celular", "125,90");
    await page.getByRole("button", { name: "Minhas finanças", exact: true }).click();
    await expect(page.locator(".stat-card").filter({ hasText: "Saldo do mês" })).toContainText("874,10");
    await page.context().setOffline(false);
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Minha agenda", exact: true }).click();
    await expect(page.locator(".task-title")).toHaveText("Consulta no celular");
    await page.getByRole("button", { name: "Configurações", exact: true }).click();
    await expect(page.getByText("Salvos automaticamente neste dispositivo.")).toBeVisible();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("dailyapp.v1")!));
    expect(validateData(saved).transactions).toHaveLength(2);
    expect(saved.tasks).toHaveLength(1);
    expect(new Set([...saved.tasks, ...saved.transactions].map(item => item.id)).size).toBe(3);
    expect(remote).toEqual([]);
  });
}

test("Android: voltar fecha o formulário, retorna ao início e minimiza sem perder registros", async ({ page }) => {
  await start(page, "android");
  await task(page);
  await page.getByRole("button", { name: "Minhas tarefas", exact: true }).click();
  await page.getByRole("button", { name: "Nova tarefa", exact: true }).click();
  await page.getByLabel("O que você precisa fazer?").fill("Rascunho não salvo");
  await expect.poll(() => page.evaluate(() => (window as any).dailyappNativeTest.callbacks.size)).toBe(1);
  const back = () => page.evaluate(() => window.dispatchEvent(new Event("dailyapp-test-back")));
  await back();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Minhas tarefas", exact: true })).toHaveAttribute("aria-current", "page");
  await back();
  await expect(page.getByRole("button", { name: "Visão geral", exact: true })).toHaveAttribute("aria-current", "page");
  await back();
  expect(await page.evaluate(() => (window as any).dailyappNativeTest.calls.filter((c: any) => c.method === "minimizeApp").length)).toBe(1);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("dailyapp.v1")!));
  expect(saved.tasks.map((t: any) => t.title)).toEqual(["Consulta no celular"]);
});

test("iPhone: exporta pelo compartilhamento nativo e restaura o mesmo backup", async ({ page }) => {
  await start(page, "ios");
  await task(page);
  await page.getByRole("button", { name: "Configurações", exact: true }).click();
  await page.getByRole("button", { name: "Exportar backup", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Backup preparado");
  const calls = await page.evaluate(() => (window as any).dailyappNativeTest.calls);
  const written = calls.find((c: any) => c.method === "writeFile");
  const backup = validateData(JSON.parse(written.options.data));
  expect(backup.tasks[0].title).toBe("Consulta no celular");
  expect(written.options.directory).toBe("CACHE");
  expect(calls.find((c: any) => c.method === "share").options.files).toEqual(["file:///cache/backups/dailyapp-2026-10-13.json"]);
  await page.getByRole("button", { name: "Apagar meus dados", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await page.getByLabel("Arquivo de backup").setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: Buffer.from(written.options.data) });
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await page.getByRole("button", { name: "Minhas tarefas", exact: true }).click();
  await expect(page.locator(".task-title")).toHaveText("Consulta no celular");
});

test("falha ao salvar o arquivo de backup preserva os registros e informa o usuário", async ({ page }) => {
  await start(page, "android");
  await task(page);
  const before = await page.evaluate(() => localStorage.getItem("dailyapp.v1"));
  await page.evaluate(() => { (window as any).dailyappNativeTest.failWrite = true; });
  await page.getByRole("button", { name: "Configurações", exact: true }).click();
  await page.getByRole("button", { name: "Exportar backup", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Não foi possível exportar o backup");
  expect(await page.evaluate(() => localStorage.getItem("dailyapp.v1"))).toBe(before);
});

test("telas pequenas respeitam áreas seguras, navegação e acessibilidade", async ({ page }) => {
  await start(page, "android");
  await page.setViewportSize({ width: 320, height: 740 });
  await page.evaluate(() => {
    document.documentElement.style.setProperty("--safe-area-inset-top", "24px");
    document.documentElement.style.setProperty("--safe-area-inset-bottom", "34px");
  });
  for (const label of ["Visão geral", "Minha agenda", "Minhas tarefas", "Minhas finanças", "Configurações"]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  }
  const tabbar = await page.locator(".mobile-tabbar").boundingBox();
  expect(tabbar!.y + tabbar!.height).toBe(740);
  expect(tabbar!.height).toBeGreaterThanOrEqual(100);
  expect((await page.locator(".topbar").boundingBox())!.height).toBe(86);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

for (const platform of ["android", "ios"] as const) {
  test(`${platform}: primeiro uso salva nome e orçamento e não reaparece ao abrir novamente`, async ({ page }) => {
    await start(page, platform, false);
    const introduction = page.getByRole("dialog", { name: "Seu dia começa aqui." });
    await expect(introduction).toBeVisible();
    expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))).toBe("Fechar janela");
    await page.getByLabel("Como você quer ser chamado?").fill("Ana");
    await page.getByLabel("Limite de gastos do mês (R$)").fill("-50");
    await page.getByRole("button", { name: "Começar", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Informe um valor maior que zero");
    expect(await page.evaluate(() => localStorage.getItem("dailyapp.v1"))).toBeNull();
    await page.getByLabel("Limite de gastos do mês (R$)").fill("2.500,00");
    await page.getByRole("button", { name: "Começar", exact: true }).click();
    await expect(introduction).not.toBeVisible();
    await page.reload({ waitUntil: "networkidle" });
    await expect(introduction).not.toBeVisible();
    await page.getByRole("button", { name: "Configurações", exact: true }).click();
    await expect(page.getByLabel("Seu nome", { exact: true })).toHaveValue("Ana");
    const saved = validateData(await page.evaluate(() => JSON.parse(localStorage.getItem("dailyapp.v1")!)));
    expect(saved.name).toBe("Ana");
    expect(saved.budgets["2026-10"]).toBe(250000);
    expect(saved.demo).toBe(false);
  });
}

test("atualização abre registros antigos sem apresentar configuração ou regravar dados", async ({ page }) => {
  const existing = { ...freshData(), name: "Meu espaço antigo", budgets: { "2026-10": 300000 },
    tasks: [{ id: "task-before-update", title: "Compromisso antigo", date: "2026-10-13", time: "09:00", category: "Pessoal", priority: "Média", completed: false, notes: "" }],
    transactions: [{ id: "transaction-before-update", description: "Saldo anterior", amountCents: 55000, date: "2026-10-13", type: "income", category: "Salário", paid: true, notes: "" }],
  };
  const raw = JSON.stringify(existing);
  await page.addInitScript(raw => { if (localStorage.getItem("dailyapp.v1") === null) localStorage.setItem("dailyapp.v1", raw); }, raw);
  await start(page, "android", false);
  await expect(page.getByRole("dialog", { name: "Seu dia começa aqui." })).not.toBeVisible();
  await page.getByRole("button", { name: "Minhas tarefas", exact: true }).click();
  await expect(page.locator(".task-title")).toHaveText("Compromisso antigo");
  await page.getByRole("button", { name: "Minhas finanças", exact: true }).click();
  await expect(page.locator(".stat-card").filter({ hasText: "Saldo do mês" })).toContainText("550,00");
  expect(await page.evaluate(() => localStorage.getItem("dailyapp.v1"))).toBe(raw);
  await page.reload({ waitUntil: "networkidle" });
  expect(await page.evaluate(() => localStorage.getItem("dailyapp.v1"))).toBe(raw);
});

test("primeiro uso pode ser pulado pelo botão voltar e fica concluído", async ({ page }) => {
  await start(page, "android", false);
  await expect.poll(() => page.evaluate(() => (window as any).dailyappNativeTest.callbacks.size)).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event("dailyapp-test-back")));
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navegação do aplicativo" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("dailyapp.v1"))).toBeNull();
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await task(page);
});

test("guia rápido é acessível, fecha com voltar e mantém os registros", async ({ page }) => {
  await start(page, "android");
  await task(page);
  const original = await page.evaluate(() => localStorage.getItem("dailyapp.v1"));
  await page.setViewportSize({ width: 320, height: 740 });
  await page.getByRole("button", { name: "Configurações", exact: true }).click();
  await page.getByRole("button", { name: "Como usar o DailyAPP", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Guia rápido" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.evaluate(() => window.dispatchEvent(new Event("dailyapp-test-back")));
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("dailyapp.v1"))).toBe(original);
});

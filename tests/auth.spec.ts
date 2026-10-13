import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { freshData, STORAGE_KEY, createDemo } from "../src/domain";
import type { AppData } from "../src/domain";

test.use({ baseURL: "http://127.0.0.1:5175" });
const userId = "00000000-0000-0000-0000-000000000001";
const otherId = "00000000-0000-0000-0000-000000000002";
const user = (id = userId) => ({
  id,
  aud: "authenticated",
  role: "authenticated",
  email: id === userId ? "ana@example.test" : "bruno@example.test",
  email_confirmed_at: new Date().toISOString(),
  app_metadata: { provider: "email" },
  user_metadata: { full_name: id === userId ? "Ana" : "Bruno" },
  created_at: new Date().toISOString(),
});
function token(id = userId) {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return (
    encode({ alg: "HS256", typ: "JWT" }) +
    "." +
    encode({
      sub: id,
      aud: "authenticated",
      role: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }) +
    ".test-fixture-signature"
  );
}

async function backend(page: Page) {
  const documents = new Map<string, { document: AppData; revision: number }>();
  let unavailable = false;
  let recovered = false;
  await page.route("http://127.0.0.1:54321/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "GET,POST,PUT,OPTIONS",
    };
    const respond = (body: unknown, status = 200) =>
      route.fulfill({ status, json: body, headers });
    if (request.method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    if (url.pathname.endsWith("/token")) {
      const input = request.postDataJSON();
      if (input.password === "incorreta")
        return respond(
          { message: "Invalid login credentials", code: "invalid_credentials" },
          400,
        );
      const id = input.email === "bruno@example.test" ? otherId : userId;
      return respond({
        access_token: token(id),
        refresh_token: "test-refresh-token",
        expires_in: 3600,
        token_type: "bearer",
        user: user(id),
      });
    }
    if (url.pathname.endsWith("/signup"))
      return respond({ ...user(), identities: [{ provider: "email" }] });
    if (url.pathname.endsWith("/recover")) {
      recovered = true;
      return respond({});
    }
    if (url.pathname.endsWith("/logout"))
      return route.fulfill({ status: 204, headers });
    if (url.pathname.endsWith("/user")) return respond(user());
    if (unavailable)
      return respond({ message: "Temporary service unavailable" }, 503);
    const authorization = request.headers().authorization ?? "";
    const id = JSON.parse(
      Buffer.from(authorization.split(".")[1], "base64url").toString(),
    ).sub as string;
    if (url.pathname.endsWith("/dailyapp_workspaces")) {
      const document = documents.get(id);
      return respond(document ? [document] : []);
    }
    if (url.pathname.endsWith("/save_dailyapp_workspace")) {
      const { p_document, p_expected_revision, p_owner_id } =
        request.postDataJSON();
      if (p_owner_id !== id)
        return respond({ message: "Account changed" }, 403);
      const existing = documents.get(id);
      if ((existing?.revision ?? 0) !== p_expected_revision) return respond([]);
      const updated = {
        document: p_document,
        revision: p_expected_revision + 1,
      };
      documents.set(id, updated);
      return respond([updated]);
    }
    return respond({ message: "Unknown test endpoint" }, 404);
  });
  return {
    documents,
    unavailable: (value: boolean) => {
      unavailable = value;
    },
    recovered: () => recovered,
  };
}

async function login(
  page: Page,
  email = "ana@example.test",
  password = "uma-senha-segura",
) {
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}

test("cadastro solicita confirmação de e-mail e recuperação usa mensagem neutra", async ({
  page,
}) => {
  const api = await backend(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await page.getByLabel("Seu nome", { exact: true }).fill("Ana");
  await page.getByLabel("E-mail", { exact: true }).fill("ana@example.test");
  await page.getByLabel("Senha", { exact: true }).fill("uma-senha-segura");
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(page.getByRole("status")).toContainText("Confira seu e-mail");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await login(page, "ana@example.test", "incorreta");
  await expect(page.getByRole("alert")).toContainText(
    "E-mail ou senha incorretos",
  );
  await page.getByRole("button", { name: "Esqueci minha senha" }).click();
  await page.getByLabel("E-mail", { exact: true }).fill("ana@example.test");
  await page
    .getByRole("button", { name: "Enviar link de recuperação" })
    .click();
  await expect(page.getByRole("status")).toContainText("Se houver uma conta");
  expect(api.recovered()).toBe(true);
});

test("login importa dados locais explicitamente e logout protege a próxima conta", async ({
  page,
}) => {
  const api = await backend(page);
  const own = {
    ...createDemo().tasks[0],
    id: "own-local",
    title: "Minha tarefa antiga",
    completed: false,
  };
  const legacy = { ...freshData(), tasks: [own] };
  await page.addInitScript(
    ({ key, value }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value);
    },
    { key: STORAGE_KEY, value: JSON.stringify(legacy) },
  );
  await page.goto("/");
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Seu dia, em equilíbrio." }),
  ).toBeVisible();
  await expect(
    page.getByText("Minha tarefa antiga", { exact: true }),
  ).not.toBeVisible();
  await page
    .getByRole("button", { name: "Configurações", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Importar meus dados locais" })
    .click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect
    .poll(() => api.documents.get(userId)?.document.tasks.length)
    .toBe(1);
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).tasks.length,
      STORAGE_KEY,
    ),
  ).toBe(1);
  await expect(page.locator(".account-bar")).toContainText("Tudo sincronizado");
  await page.getByRole("button", { name: "Sair da conta" }).click();
  await expect(
    page.getByRole("heading", { name: "Bem-vindo de volta." }),
  ).toBeVisible();
  await login(page, "bruno@example.test");
  await expect(
    page.getByRole("heading", { name: "Seu dia, em equilíbrio." }),
  ).toBeVisible();
  await expect(
    page.getByText("Minha tarefa antiga", { exact: true }),
  ).not.toBeVisible();
  expect(api.documents.has(otherId)).toBe(false);
});

test("falha de rede mantém alterações pendentes e permite nova sincronização", async ({
  page,
}) => {
  const api = await backend(page);
  await page.goto("/");
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Seu dia, em equilíbrio." }),
  ).toBeVisible();
  api.unavailable(true);
  await page.getByRole("button", { name: "Nova tarefa", exact: true }).click();
  await page
    .getByLabel("O que você precisa fazer?")
    .fill("Tarefa offline na conta");
  await page.getByRole("button", { name: "Criar tarefa" }).click();
  await expect(page.locator(".account-bar")).toContainText(
    "guardadas neste dispositivo",
  );
  await expect(
    page.getByRole("button", { name: "Sair da conta" }),
  ).toBeDisabled();
  api.unavailable(false);
  await page.getByRole("button", { name: "Sincronizar", exact: true }).click();
  await expect(page.locator(".account-bar")).toContainText("Tudo sincronizado");
  expect(api.documents.get(userId)?.document.tasks[0].title).toBe(
    "Tarefa offline na conta",
  );
});

test("atualização de outro dispositivo gera conflito sem sobrescrever os registros", async ({
  page,
}) => {
  const api = await backend(page);
  api.documents.set(userId, { document: freshData(), revision: 1 });
  await page.goto("/");
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Seu dia, em equilíbrio." }),
  ).toBeVisible();
  api.documents.set(userId, {
    document: { ...freshData(), name: "Outra edição" },
    revision: 2,
  });
  await page.getByRole("button", { name: "Nova tarefa", exact: true }).click();
  await page
    .getByLabel("O que você precisa fazer?")
    .fill("Não perder esta alteração");
  await page.getByRole("button", { name: "Criar tarefa" }).click();
  await expect(page.locator(".account-bar")).toContainText("Outro dispositivo");
  expect(api.documents.get(userId)?.document.name).toBe("Outra edição");
  await page
    .getByRole("button", { name: "Configurações", exact: true })
    .click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar cópia local" }).click();
  expect((await downloaded).suggestedFilename()).toContain(
    "dailyapp-copia-local",
  );
  await page.getByRole("button", { name: "Carregar dados da nuvem" }).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(page.locator(".account-bar")).toContainText(
    "Dados da nuvem carregados",
  );
  await expect(page.getByLabel("Seu nome", { exact: true })).toHaveValue(
    "Outra edição",
  );
});

test("tela de acesso funciona no celular e passa na auditoria de acessibilidade", async ({
  page,
}) => {
  await backend(page);
  await page.goto("/");
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "Entrar", exact: true }),
  ).toBeVisible();
});

test("link de recuperação permite definir senha nova e limpa o token da URL", async ({
  page,
}) => {
  await backend(page);
  await page.goto(
    "/#access_token=" +
      token() +
      "&refresh_token=test-refresh-token&expires_in=3600&token_type=bearer&type=recovery",
  );
  await expect(
    page.getByRole("heading", { name: "Escolha uma nova senha." }),
  ).toBeVisible();
  await page
    .getByLabel("Nova senha", { exact: true })
    .fill("uma-nova-senha-segura");
  await page
    .getByLabel("Confirmar nova senha", { exact: true })
    .fill("uma-senha-diferente");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "As duas senhas precisam ser iguais",
  );
  await page
    .getByLabel("Confirmar nova senha", { exact: true })
    .fill("uma-nova-senha-segura");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(
    page.getByRole("heading", { name: "Seu dia, em equilíbrio." }),
  ).toBeVisible();
  expect(new URL(page.url()).hash).toBe("");
});

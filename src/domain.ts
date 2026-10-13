export const STORAGE_KEY = "dailyapp.v1";
export function randomId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // getRandomValues also works in native WebViews whose custom URL scheme
  // does not expose the secure-context-only randomUUID method.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export const TASK_CATEGORIES = [
  "Pessoal",
  "Trabalho",
  "Saúde",
  "Estudos",
] as const;
export const EXPENSE_CATEGORIES = [
  "Alimentação",
  "Moradia",
  "Transporte",
  "Saúde",
  "Lazer",
  "Educação",
  "Compras",
  "Outros",
] as const;
export const INCOME_CATEGORIES = [
  "Salário",
  "Freelance",
  "Investimentos",
  "Outros",
] as const;
export const PRIORITIES = ["Baixa", "Média", "Alta"] as const;

export interface Task {
  id: string;
  title: string;
  notes: string;
  date: string;
  time: string;
  category: (typeof TASK_CATEGORIES)[number];
  priority: (typeof PRIORITIES)[number];
  completed: boolean;
}
export interface Transaction {
  id: string;
  description: string;
  amountCents: number;
  type: "income" | "expense";
  date: string;
  category: string;
  paid: boolean;
  notes: string;
}
export interface AppData {
  schemaVersion: 1;
  name: string;
  tasks: Task[];
  transactions: Transaction[];
  budgets: Record<string, number>;
  demo: boolean;
  demoBudgetMonth: string | null;
}

export const freshData = (): AppData => ({
  schemaVersion: 1,
  name: "",
  tasks: [],
  transactions: [],
  budgets: {},
  demo: false,
  demoBudgetMonth: null,
});
export function dateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export const parseDate = (date: string) => new Date(`${date}T12:00:00`);
export const monthKey = (date = new Date()) => dateKey(date).slice(0, 7);
export const shiftMonth = (month: string, offset: number) =>
  monthKey(
    new Date(
      Number(month.slice(0, 4)),
      Number(month.slice(5, 7)) - 1 + offset,
      1,
    ),
  );
export const monthLabel = (month: string) =>
  parseDate(`${month}-01`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
export const prettyDate = (date: string) =>
  parseDate(date)
    .toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
    .replace(".", "");
export const money = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const amountInput = (cents: number) =>
  (cents / 100).toFixed(2).replace(".", ",");
export const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export const sortTasks = (tasks: Task[]) =>
  [...tasks].sort(
    (a, b) =>
      Number(a.completed) - Number(b.completed) ||
      a.date.localeCompare(b.date) ||
      (a.time || "23:59").localeCompare(b.time || "23:59") ||
      PRIORITIES.indexOf(b.priority) - PRIORITIES.indexOf(a.priority),
  );

// Integer cents prevent rounding errors when adding currency amounts.
export function parseAmount(value: string): number | null {
  const clean = value.trim().replace(/\s/g, "").replace(/^R\$/, "");
  const valid = /^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?$/.test(clean);
  const decimal = /^\d+(?:\.\d{1,2})?$/.test(clean);
  if (!valid && !decimal) return null;
  const normalized = valid ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const cents = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(cents) && cents > 0 && cents <= 100_000_000_000
    ? cents
    : null;
}
export function validDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number(value.slice(0, 4)) >= 1900 &&
    Number(value.slice(0, 4)) <= 2200 &&
    dateKey(parseDate(value)) === value
  );
}
const validText = (
  value: unknown,
  max: number,
  empty = false,
): value is string =>
  typeof value === "string" &&
  value.length <= max &&
  (empty || value.trim().length > 0);
const validCents = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value > 0 &&
  value <= 100_000_000_000;
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function validateData(value: unknown): AppData {
  if (
    !object(value) ||
    value.schemaVersion !== 1 ||
    !validText(value.name, 60, true) ||
    typeof value.demo !== "boolean" ||
    !Array.isArray(value.tasks) ||
    !Array.isArray(value.transactions) ||
    !object(value.budgets) ||
    value.tasks.length > 5000 ||
    value.transactions.length > 10000
  )
    throw new Error("Este arquivo não é um backup válido do DailyAPP.");
  if (
    value.demoBudgetMonth != null &&
    !validDate(`${value.demoBudgetMonth}-01`)
  )
    throw new Error("O backup contém um orçamento de exemplo inválido.");
  const ids = new Set<string>();
  for (const task of value.tasks) {
    if (
      !object(task) ||
      !validText(task.id, 100) ||
      ids.has(task.id) ||
      !validText(task.title, 120) ||
      !validText(task.notes, 1000, true) ||
      !validDate(task.date) ||
      typeof task.time !== "string" ||
      (task.time !== "" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(task.time)) ||
      !TASK_CATEGORIES.includes(task.category as Task["category"]) ||
      !PRIORITIES.includes(task.priority as Task["priority"]) ||
      typeof task.completed !== "boolean"
    )
      throw new Error("O backup contém uma tarefa inválida.");
    ids.add(task.id);
  }
  for (const transaction of value.transactions) {
    if (
      !object(transaction) ||
      !validText(transaction.id, 100) ||
      ids.has(transaction.id) ||
      !validText(transaction.description, 120) ||
      !validText(transaction.notes, 1000, true) ||
      !validDate(transaction.date) ||
      !validCents(transaction.amountCents) ||
      !["income", "expense"].includes(transaction.type as string) ||
      !(
        transaction.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
      ).includes(transaction.category as never) ||
      typeof transaction.paid !== "boolean"
    )
      throw new Error("O backup contém uma movimentação inválida.");
    ids.add(transaction.id);
  }
  const budgets: Record<string, number> = {};
  for (const [month, amount] of Object.entries(value.budgets)) {
    if (!validDate(`${month}-01`) || !validCents(amount))
      throw new Error("O backup contém um orçamento inválido.");
    budgets[month] = amount;
  }
  // Copy only known fields; imported files cannot inject unexpected state.
  return {
    schemaVersion: 1,
    name: value.name,
    demo: value.demo,
    demoBudgetMonth: (value.demoBudgetMonth as string | null) ?? null,
    budgets,
    tasks: value.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      notes: t.notes,
      date: t.date,
      time: t.time,
      category: t.category,
      priority: t.priority,
      completed: t.completed,
    })),
    transactions: value.transactions.map((t) => ({
      id: t.id,
      description: t.description,
      notes: t.notes,
      date: t.date,
      amountCents: t.amountCents,
      type: t.type,
      category: t.category,
      paid: t.paid,
    })),
  };
}

export function summary(transactions: Transaction[], month: string) {
  const entries = transactions.filter((t) => t.date.startsWith(month));
  const sum = (type: Transaction["type"], paid?: boolean) =>
    entries
      .filter((t) => t.type === type && (paid === undefined || t.paid === paid))
      .reduce((acc, t) => acc + t.amountCents, 0);
  const income = sum("income", true),
    expense = sum("expense", true);
  return {
    entries,
    income,
    expense,
    balance: income - expense,
    pending: sum("expense", false),
    committed: sum("expense"),
    expectedIncome: sum("income", false),
  };
}

export function createDemo(): AppData {
  const today = dateKey(),
    month = monthKey();
  const onDay = (day: number) =>
    `${month}-${String(Math.min(day, new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate())).padStart(2, "0")}`;
  const later = new Date();
  later.setDate(later.getDate() + 2);
  const task = (
    id: number,
    title: string,
    time: string,
    category: Task["category"],
    priority: Task["priority"],
    completed = false,
    date = today,
  ): Task => ({
    id: `demo-task-${id}`,
    title,
    time,
    category,
    priority,
    completed,
    date,
    notes: "",
  });
  const entry = (
    id: number,
    description: string,
    amountCents: number,
    type: Transaction["type"],
    category: string,
    day: number,
    paid = true,
  ): Transaction => ({
    id: `demo-transaction-${id}`,
    description,
    amountCents,
    type,
    category,
    date: onDay(day),
    paid,
    notes: "",
  });
  return {
    ...freshData(),
    demo: true,
    demoBudgetMonth: month,
    budgets: { [month]: 350000 },
    tasks: [
      task(
        1,
        "Planejar as prioridades da semana",
        "08:30",
        "Pessoal",
        "Média",
        true,
      ),
      task(2, "Reunião de planejamento", "10:00", "Trabalho", "Alta"),
      task(3, "Fazer compras da semana", "17:00", "Pessoal", "Média"),
      task(4, "Reservar um tempo para caminhar", "18:30", "Saúde", "Baixa"),
      task(5, "Revisar os gastos do mês", "19:30", "Pessoal", "Média"),
      task(
        6,
        "Estudar um novo assunto",
        "09:00",
        "Estudos",
        "Média",
        false,
        dateKey(later),
      ),
    ],
    transactions: [
      entry(1, "Salário", 580000, "income", "Salário", 5),
      entry(2, "Projeto freelance", 85000, "income", "Freelance", 10),
      entry(3, "Aluguel", 150000, "expense", "Moradia", 6),
      entry(4, "Supermercado", 32850, "expense", "Alimentação", 8),
      entry(5, "Café com amigos", 6800, "expense", "Lazer", 11),
      entry(6, "Transporte da semana", 12000, "expense", "Transporte", 12),
      entry(7, "Internet", 9990, "expense", "Moradia", 15, false),
      entry(8, "Academia", 12000, "expense", "Saúde", 20, false),
    ],
  };
}

import { test, expect } from "@playwright/test";
import { freshData, validateData, summary } from "../src/domain";
import type { CreditCard, Task, Transaction } from "../src/domain";
import { recurrenceDate, repeatingTask, repeatingTransaction, materializeRecurrences, stopRecurrence, firstInvoiceDate, purchaseInstallments, cardSummary } from "../src/planning";
import { buildReminderPlan } from "../src/reminders-plan";

const card: CreditCard = { id: "card-test", name: "Principal", limitCents: 500000, closingDay: 25, dueDay: 5, reminderDays: 1 };
const task: Task = { id: "task-test", title: "Rotina", date: "2026-01-31", time: "14:00", priority: "Média", category: "Pessoal", notes: "", completed: false, reminderMinutes: 15 };
const purchase = { description: "Compra", amountCents: 10000, count: 3, date: "2026-10-13", category: "Compras", notes: "" };

test("repetição preserva o dia original em meses curtos, anos bissextos e viradas de ano", () => {
  expect([0, 1, 2, 3].map(i => recurrenceDate("2026-01-31", "monthly", i))).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  expect(recurrenceDate("2024-02-29", "yearly", 1)).toBe("2025-02-28");
  expect(recurrenceDate("2024-02-29", "yearly", 4)).toBe("2028-02-29");
  expect(recurrenceDate("2026-12-28", "weekly", 1)).toBe("2027-01-04");
});

test("repetição não duplica registros, não recria exclusões e mantém ajustes/conclusões após renovar", () => {
  let data = repeatingTask(freshData(), task, "monthly", "2026-01-31");
  const february = data.tasks.find(t => t.date === "2026-02-28")!;
  data = { ...data, tasks: data.tasks.filter(t => t.id !== february.id).map(t => t.date === "2026-03-31" ? { ...t, title: "Ajuste pontual", completed: true } : t) };
  const renewed = materializeRecurrences(validateData(JSON.parse(JSON.stringify(data))), "2026-04-01");
  expect(renewed.tasks.some(t => t.id === february.id)).toBe(false);
  expect(renewed.tasks.find(t => t.date === "2026-03-31")).toMatchObject({ title: "Ajuste pontual", completed: true });
  expect(new Set(renewed.tasks.map(t => t.id)).size).toBe(renewed.tasks.length);
  expect(materializeRecurrences(renewed, "2026-04-01")).toBe(renewed);
  expect(renewed.tasks.some(t => t.date === "2026-06-30")).toBe(true);
});

test("parar recorrência mantém histórico e pagamentos; futuras contas nunca são marcadas como pagas automaticamente", () => {
  const transaction: Transaction = { id: "rent", description: "Aluguel", amountCents: 150000, date: "2026-01-31", type: "expense", category: "Moradia", paid: true, notes: "" };
  let data = repeatingTransaction(freshData(), transaction, "monthly", "2026-01-31");
  expect(data.transactions.slice(1).every(t => !t.paid)).toBe(true);
  data = { ...data, transactions: data.transactions.map(t => t.date === "2026-03-31" ? { ...t, paid: true } : t) };
  const stopped = stopRecurrence(data, data.recurrences![0].id, "2026-02-15");
  expect(stopped.transactions.map(t => t.date)).toEqual(["2026-01-31", "2026-03-31"]);
  expect(materializeRecurrences(stopped, "2027-01-01")).toBe(stopped);
});

test("faturas respeitam fechamento, mês do vencimento e último dia de fevereiro", () => {
  expect(firstInvoiceDate(card, "2026-10-24")).toBe("2026-11-05");
  expect(firstInvoiceDate(card, "2026-10-25")).toBe("2026-12-05");
  expect(firstInvoiceDate({ ...card, closingDay: 10, dueDay: 25 }, "2026-01-09")).toBe("2026-01-25");
  expect(firstInvoiceDate({ ...card, closingDay: 10, dueDay: 25 }, "2026-01-10")).toBe("2026-02-25");
  expect(firstInvoiceDate({ ...card, closingDay: 31 }, "2026-02-28")).toBe("2026-04-05");
});

test("parcelas conservam centavos e pagar a fatura muda o saldo sem duplicar a compra", () => {
  const parts = purchaseInstallments(card, purchase);
  expect(parts.map(t => t.amountCents)).toEqual([3334, 3333, 3333]);
  expect(parts.map(t => t.date)).toEqual(["2026-11-05", "2026-12-05", "2027-01-05"]);
  expect(parts.reduce((sum, t) => sum + t.amountCents, 0)).toBe(10000);
  const data = { ...freshData(), cards: [card], transactions: parts };
  expect(summary(data.transactions, "2026-11")).toMatchObject({ expense: 0, committed: 3334, pending: 3334 });
  const paid = { ...data, transactions: parts.map(t => t.date.startsWith("2026-11") ? { ...t, paid: true } : t) };
  expect(cardSummary(paid, card.id, "2026-11")).toMatchObject({ pending: 0, outstanding: 6666, total: 3334 });
  expect(summary(paid.transactions, "2026-11").balance).toBe(-3334);
  expect(paid.transactions).toHaveLength(3);
  expect(() => purchaseInstallments(card, { ...purchase, amountCents: 2 })).toThrow();
});

test("backups antigos continuam válidos; novos preservam cartões/repetições e rejeitam referências ou parcelas duplicadas", () => {
  expect(validateData(freshData())).toEqual(freshData());
  const data = { ...repeatingTask(freshData(), task, "monthly", "2026-01-31"), cards: [card], transactions: purchaseInstallments(card, purchase) };
  expect(validateData(JSON.parse(JSON.stringify(data)))).toEqual(data);
  expect(() => validateData({ ...data, cards: [] })).toThrow();
  expect(() => validateData({ ...data, recurrences: [] })).toThrow();
  expect(() => validateData({ ...data, transactions: [...data.transactions, { ...data.transactions[0], id: "duplicate-part" }] })).toThrow();
  expect(() => validateData({ ...data, tasks: [{ ...task, time: "" }] })).toThrow();
});

test("lembretes usam horário local, ignoram concluídos/pagos/passados e agrupam parcelas da mesma fatura", () => {
  const now = new Date(2026, 9, 13, 12);
  const data = { ...freshData(), cards: [card], tasks: [{ ...task, date: "2026-10-13" }, { ...task, id: "done", completed: true, date: "2026-10-13" }],
    transactions: [...purchaseInstallments(card, purchase), ...purchaseInstallments(card, { ...purchase, description: "Outra compra" })] };
  const plan = buildReminderPlan(data, now);
  expect(plan).toHaveLength(4);
  expect(plan[0].schedule!.at!.getHours()).toBe(13);
  expect(plan[0].schedule!.at!.getMinutes()).toBe(45);
  expect(plan.filter(n => n.extra.kind === "card")).toHaveLength(3);
  expect(plan.every(n => n.isExact === false)).toBe(true);
  const paid = { ...data, tasks: [], transactions: data.transactions.map(t => ({ ...t, paid: true })) };
  expect(buildReminderPlan(paid, now)).toEqual([]);
});

test("plano de notificações reserva no máximo 60 horários futuros e IDs estáveis dentro do limite nativo", () => {
  const data = { ...freshData(), tasks: Array.from({ length: 80 }, (_, i) => ({ ...task, id: `task-${i}`, date: "2026-10-14" })) };
  const now = new Date(2026, 9, 13, 12);
  const plan = buildReminderPlan(data, now);
  expect(plan).toHaveLength(60);
  expect(new Set(plan.map(n => n.id)).size).toBe(60);
  expect(plan.every(n => Number.isInteger(n.id) && n.id > 0 && n.id <= 2147483647)).toBe(true);
  expect(buildReminderPlan(data, now).map(n => n.id)).toEqual(plan.map(n => n.id));
});

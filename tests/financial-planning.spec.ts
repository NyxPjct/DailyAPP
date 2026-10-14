import { test, expect } from "@playwright/test";
import { freshData, validateData } from "../src/domain";
import type { FinancialGoal, Transaction } from "../src/domain";
import { goalProgress, monthlyForecast, parseBalanceInput, upcomingMoney } from "../src/financial-planning";
import { purchaseInstallments } from "../src/planning";

const entry = (id: string, amountCents: number, date: string, type: Transaction["type"] = "expense", paid = false): Transaction => ({
  id, amountCents, date, type, paid, description: id, category: type === "income" ? "Salário" : "Moradia", notes: "",
});
const goal: FinancialGoal = { id: "goal", name: "Reserva", targetCents: 100001, savedCents: 10001, targetDate: "2027-01-31", notes: "" };

test("saldo inicial aceita zero/negativo e mantém centavos; backups antigos e novos são validados sem campos extras", () => {
  expect(["0,00", "-0.00", "-1.234,56", "12.34", "inválido", "1,234", "9999999999999999"].map(value => parseBalanceInput(value))).toEqual([0, 0, -123456, 1234, null, null, null]);
  expect(validateData(freshData())).toEqual(freshData());
  const data = { ...freshData(), goals: [{ ...goal, injected: "discard" }], openingBalances: { "2026-10": -1, "2026-11": 0 } };
  expect(validateData(data).goals).toEqual([goal]);
  expect(validateData(data).openingBalances).toEqual(data.openingBalances);
  for (const invalid of ["100", NaN, 0.5, 1e15]) expect(() => validateData({ ...data, openingBalances: { "2026-10": invalid } })).toThrow();
  expect(() => validateData({ ...data, openingBalances: { "2026-13": 0 } })).toThrow();
  for (const savedCents of [-1, 0.5, "0", 1e15]) expect(() => validateData({ ...data, goals: [{ ...goal, savedCents }] })).toThrow();
  expect(() => validateData({ ...data, goals: [goal, goal] })).toThrow();
  expect(() => validateData({ ...data, goals: [{ ...goal, targetDate: "2026-02-30" }] })).toThrow();
});

test("previsão distingue resultado mensal de saldo disponível e não conta pagamentos duas vezes", () => {
  const data = { ...freshData(), openingBalances: { "2026-10": 10000 }, transactions: [
    entry("rent", 30000, "2026-10-02"), entry("salary", 100000, "2026-10-15", "income"),
    entry("paid", 1000, "2026-10-10", "expense", true), entry("old", 9000, "2026-09-30"), entry("future", 88888, "2026-11-01"),
  ] };
  const forecast = monthlyForecast(data, "2026-10");
  expect(forecast).toMatchObject({ configured: true, opening: 10000, confirmed: -1000, pendingIncome: 100000, pendingExpense: 30000, closing: 79000, lowest: -21000, lowestDate: "2026-10-10", overdueOutside: 9000 });
  expect(forecast.days.map(d => d.balance)).toEqual([-20000, -21000, 79000]);
  const paid = { ...data, transactions: data.transactions.map(t => t.id === "rent" ? { ...t, paid: true } : t) };
  expect(monthlyForecast(paid, "2026-10")).toMatchObject({ closing: 79000, lowest: -21000, confirmed: -31000, pendingExpense: 0 });
  expect(monthlyForecast(data, "2026-11").configured).toBe(false);
  expect(monthlyForecast({ ...data, openingBalances: { "2026-12": 0 } }, "2026-12")).toMatchObject({ configured: true, closing: 0, lowest: 0, days: [] });
});

test("parcelas entram na previsão uma vez no mês correto e recebimentos no mesmo dia compensam despesas", () => {
  const card = { id: "card", name: "Principal", limitCents: 500000, closingDay: 10, dueDay: 25 };
  const parts = purchaseInstallments(card, { description: "Compra", amountCents: 10000, count: 3, date: "2026-10-09", category: "Compras", notes: "" });
  const data = { ...freshData(), cards: [card], transactions: [...parts, entry("salary", 20000, "2026-10-25", "income")], openingBalances: { "2026-10": 0, "2026-11": 0 } };
  expect(monthlyForecast(data, "2026-10")).toMatchObject({ closing: 16666, lowest: 0, pendingExpense: 3334 });
  expect(monthlyForecast(data, "2026-11").closing).toBe(-3333);
  expect(data.transactions).toHaveLength(4);
});

test("metas calculam progresso e sugestão entre anos, preservam valores acima da meta e tratam prazo vencido", () => {
  expect(goalProgress(goal, "2026-10-13")).toMatchObject({ remaining: 90000, percent: 10, monthlyCents: 22500, months: 4, overdue: false });
  expect(goalProgress({ ...goal, savedCents: 150000 }, "2027-02-01")).toMatchObject({ remaining: 0, percent: 100, achieved: true, overdue: false });
  expect(goalProgress(goal, "2027-02-01")).toMatchObject({ overdue: true, achieved: false });
  expect(goalProgress({ ...goal, targetDate: "2026-10-13", targetCents: 10000, savedCents: 0 }, "2026-10-13")).toMatchObject({ monthlyCents: 10000, months: 1, overdue: false });
});

test("Hoje inclui pendências antigas e sete dias seguintes cruzando o mês, sem pagamentos ou despesas distantes", () => {
  const entries = [entry("later", 1, "2026-11-04"), entry("paid", 1, "2026-10-29", "expense", true), entry("today", 1, "2026-10-28"), entry("old", 1, "2026-09-01"), entry("out", 1, "2026-11-05"), entry("salary", 1, "2026-10-29", "income")];
  expect(upcomingMoney(entries, "2026-10-28").map(t => t.id)).toEqual(["old", "today", "salary", "later"]);
});

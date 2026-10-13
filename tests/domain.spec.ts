import { test, expect } from "@playwright/test";
import {
  amountInput,
  createDemo,
  dateKey,
  freshData,
  parseAmount,
  shiftMonth,
  summary,
  validateData,
  validDate,
} from "../src/domain";

test("interpreta reais e centavos sem aceitar valores negativos ou ambíguos", () => {
  for (const [input, cents] of [
    ["1.234,56", 123456],
    ["12,50", 1250],
    ["0,01", 1],
    ["12.50", 1250],
    ["1.000", 100000],
    ["R$ 10,90", 1090],
  ] as const)
    expect(parseAmount(input)).toBe(cents);
  for (const input of [
    "",
    "0",
    "-10",
    "1,234",
    "1e3",
    "banana",
    "10,3,0",
    "1.20,50",
    "1000000001",
  ])
    expect(parseAmount(input)).toBeNull();
  expect(amountInput(123456)).toBe("1234,56");
});

test("distingue valores pagos de previstos e mantém precisão financeira", () => {
  const demo = createDemo();
  const date = dateKey();
  const transactions = [
    {
      ...demo.transactions[0],
      id: "1",
      type: "income" as const,
      date,
      amountCents: 10000,
      paid: true,
    },
    {
      ...demo.transactions[0],
      id: "2",
      type: "expense" as const,
      date,
      amountCents: 10,
      paid: true,
    },
    {
      ...demo.transactions[0],
      id: "3",
      type: "expense" as const,
      date,
      amountCents: 20,
      paid: true,
    },
    {
      ...demo.transactions[0],
      id: "4",
      type: "expense" as const,
      date,
      amountCents: 2000,
      paid: false,
    },
    {
      ...demo.transactions[0],
      id: "5",
      type: "income" as const,
      date,
      amountCents: 5000,
      paid: false,
    },
    {
      ...demo.transactions[0],
      id: "6",
      type: "expense" as const,
      date: "2000-01-01",
      amountCents: 500,
      paid: true,
    },
  ];
  expect(summary(transactions, date.slice(0, 7))).toMatchObject({
    income: 10000,
    expense: 30,
    balance: 9970,
    pending: 2000,
    committed: 2030,
    expectedIncome: 5000,
  });
});

test("valida datas reais e troca meses na virada do ano", () => {
  expect(validDate("2024-02-29")).toBe(true);
  expect(validDate("2025-02-29")).toBe(false);
  expect(validDate("2026-04-31")).toBe(false);
  expect(validDate("2026-13-01")).toBe(false);
  expect(validDate("1800-01-01")).toBe(false);
  expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  expect(shiftMonth("2026-01", -1)).toBe("2025-12");
});

test("aceita backups completos e rejeita valores, IDs e estrutura inválidos", () => {
  expect(validateData(freshData())).toEqual(freshData());
  const demo = createDemo();
  expect(validateData(JSON.parse(JSON.stringify(demo)))).toEqual(demo);
  expect(() => validateData({ ...demo, schemaVersion: 2 })).toThrow();
  expect(() =>
    validateData({ ...demo, tasks: [demo.tasks[0], demo.tasks[0]] }),
  ).toThrow();
  expect(() =>
    validateData({
      ...demo,
      transactions: [{ ...demo.transactions[0], amountCents: -100 }],
    }),
  ).toThrow();
  expect(() =>
    validateData({ ...demo, budgets: { "2026-13": 10000 } }),
  ).toThrow();
  expect(() =>
    validateData({
      ...demo,
      tasks: [{ ...demo.tasks[0], date: "2026-02-30" }],
    }),
  ).toThrow();
  expect(() =>
    validateData({ ...demo, tasks: [{ ...demo.tasks[0], time: "24:00" }] }),
  ).toThrow();
  expect(() =>
    validateData({
      ...demo,
      transactions: [{ ...demo.transactions[0], category: "Inexistente" }],
    }),
  ).toThrow();
  expect(() => validateData(null)).toThrow();
});

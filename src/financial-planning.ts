import { parseLocalizedAmount } from "./i18n/core";
import type { Language } from "./i18n/core";
import { dateKey, parseDate } from "./domain";
import type { AppData, FinancialGoal, Transaction } from "./domain";

// Zero and negative amounts are meaningful for opening balances; ordinary
// transactions continue to require a strictly positive amount.
export function parseBalanceInput(value: string, language: Language = "pt-BR"): number | null {
  const clean = value.trim().replace(/^R\$\s*/, "");
  const negative = /^[−-]/.test(clean);
  const unsigned = negative ? clean.slice(1).trim() : clean;
  if (/^(?:0+|0{1,3}(?:\.000)+)(?:[,.]0{1,2})?$/.test(unsigned)) return 0;
  const cents = parseLocalizedAmount(unsigned, language);
  return cents === null ? null : negative ? -cents : cents;
}

export function monthlyForecast(data: AppData, month: string) {
  const opening = data.openingBalances?.[month];
  const entries = data.transactions.filter(t => t.date.startsWith(month));
  const groups = new Map<string, { income: number; expense: number; pending: number; count: number }>();
  let confirmed = 0, pendingIncome = 0, pendingExpense = 0;
  for (const t of entries) {
    const signed = t.type === "income" ? t.amountCents : -t.amountCents;
    if (t.paid) confirmed += signed;
    else if (t.type === "income") pendingIncome += t.amountCents;
    else pendingExpense += t.amountCents;
    const group = groups.get(t.date) ?? { income: 0, expense: 0, pending: 0, count: 0 };
    group[t.type] += t.amountCents;
    group.pending += Number(!t.paid);
    group.count++;
    groups.set(t.date, group);
  }
  let balance = opening ?? 0, lowest = balance, lowestDate = `${month}-01`;
  const days = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, group]) => {
    balance += group.income - group.expense;
    if (balance < lowest) { lowest = balance; lowestDate = date; }
    return { date, ...group, balance };
  });
  return { configured: opening !== undefined, opening: opening ?? 0, confirmed,
    pendingIncome, pendingExpense, closing: balance, lowest, lowestDate, days,
    // Old overdue bills remain visible on Today but belong to their original
    // month. They are not silently charged again in a different month's forecast.
    overdueOutside: data.transactions.filter(t => !t.paid && t.type === "expense" && t.date < `${month}-01`)
      .reduce((sum, t) => sum + t.amountCents, 0) };
}

export function goalProgress(goal: FinancialGoal, today = dateKey()) {
  const remaining = Math.max(0, goal.targetCents - goal.savedCents);
  const current = parseDate(today), deadline = parseDate(goal.targetDate);
  const months = Math.max(1, (deadline.getFullYear() - current.getFullYear()) * 12 + deadline.getMonth() - current.getMonth() + 1);
  return { remaining, percent: Math.min(100, Math.floor(goal.savedCents / goal.targetCents * 100)),
    achieved: remaining === 0, overdue: remaining > 0 && goal.targetDate < today,
    monthlyCents: Math.ceil(remaining / months), months };
}

export function upcomingMoney(transactions: Transaction[], today = dateKey()) {
  const end = parseDate(today); end.setDate(end.getDate() + 7);
  return transactions.filter(t => !t.paid && t.date <= dateKey(end))
    .sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type) || a.description.localeCompare(b.description));
}

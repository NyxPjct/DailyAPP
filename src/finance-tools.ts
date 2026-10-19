import { dateKey, EXPENSE_CATEGORIES, normalize, shiftMonth, summary } from "./domain";
import type { AppData, Transaction, WalletAccount } from "./domain";

export const ACCOUNT_KINDS = { bank: "Conta bancária", cash: "Dinheiro", savings: "Poupança" } as const;
export function accountBalance(data: AppData, account: WalletAccount, asOf = dateKey()) {
  if (asOf < account.openingDate) return 0;
  let cents = account.openingCents;
  for (const t of data.transactions) if (t.accountId === account.id && t.paid && t.date >= account.openingDate && t.date <= asOf) cents += t.type === "income" ? t.amountCents : -t.amountCents;
  for (const t of data.transfers ?? []) if (t.date >= account.openingDate && t.date <= asOf) {
    if (t.fromAccountId === account.id) cents -= t.amountCents;
    if (t.toAccountId === account.id) cents += t.amountCents;
  }
  return cents;
}
export function categorySpending(data: AppData, month: string) {
  return EXPENSE_CATEGORIES.map(category => {
    const entries = data.transactions.filter(t => t.type === "expense" && t.date.startsWith(month) && t.category === category);
    const spent = entries.reduce((sum, t) => sum + t.amountCents, 0), paid = entries.filter(t => t.paid).reduce((sum, t) => sum + t.amountCents, 0);
    const limit = data.categoryBudgets?.[month]?.[category];
    return { category, spent, paid, limit, percent: limit ? Math.floor(spent / limit * 100) : 0, remaining: limit === undefined ? undefined : limit - spent };
  });
}
export function monthlyReport(data: AppData, month: string) {
  const current = summary(data.transactions, month), previous = summary(data.transactions, shiftMonth(month, -1));
  const previousEntries = data.transactions.filter(t => t.date.startsWith(shiftMonth(month, -1)));
  const categories = categorySpending(data, month);
  return { current, previous, hasPrevious: previousEntries.length > 0, expenseChange: current.expense - previous.expense,
    changePercent: previous.expense > 0 ? (current.expense - previous.expense) / previous.expense * 100 : null,
    categories, exceeded: categories.filter(c => c.limit !== undefined && c.spent > c.limit),
    top: current.entries.filter(t => t.type === "expense" && t.paid).sort((a,b) => b.amountCents-a.amountCents || a.date.localeCompare(b.date)).slice(0,5) };
}
export function quickExpenses(transactions: Transaction[]) {
  const groups = new Map<string, { count: number; latest: Transaction }>();
  for (const t of transactions) {
    if (t.type !== "expense" || t.installment || t.date > dateKey()) continue;
    const key = `${normalize(t.description.trim())}|${t.category}|${t.accountId ?? ""}`;
    const old = groups.get(key);
    groups.set(key, { count: (old?.count ?? 0)+1, latest: !old || t.date > old.latest.date ? t : old.latest });
  }
  return [...groups.values()].sort((a,b) => b.count-a.count || b.latest.date.localeCompare(a.latest.date) || a.latest.description.localeCompare(b.latest.description)).slice(0,5).map(g=>g.latest);
}

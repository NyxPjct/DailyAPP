import { dateKey, parseDate, shiftMonth, randomId, validDate } from "./domain";
import type { AppData, CreditCard, Frequency, Recurrence, Task, Transaction } from "./domain";

export function dateInMonth(month: string, day: number) {
  const [year, number] = month.split("-").map(Number);
  return `${month}-${String(Math.min(day, new Date(year, number, 0).getDate())).padStart(2, "0")}`;
}

export function recurrenceDate(anchor: string, frequency: Frequency, index: number): string {
  if (frequency === "monthly" || frequency === "yearly") return dateInMonth(shiftMonth(anchor.slice(0, 7), index * (frequency === "yearly" ? 12 : 1)), Number(anchor.slice(8)));
  const day = parseDate(anchor);
  day.setDate(day.getDate() + index * (frequency === "weekly" ? 7 : 1));
  return dateKey(day);
}

export function materializeRecurrences(data: AppData, today = dateKey()): AppData {
  if (!data.recurrences?.some(s => s.active)) return data;
  const tasks = [...data.tasks], transactions = [...data.transactions];
  const ids = new Set([...tasks, ...transactions].map(t => t.id));
  let changed = false;
  const taskHorizon = parseDate(today); taskHorizon.setDate(taskHorizon.getDate() + 90);
  const moneyHorizon = recurrenceDate(today, "monthly", 12);
  const recurrences = data.recurrences.map(series => {
    if (!series.active) return series;
    let index = series.nextIndex;
    const horizon = series.kind === "task" ? dateKey(taskHorizon) : moneyHorizon;
    while (index < 120000) {
      const date = recurrenceDate(series.anchorDate, series.frequency, index);
      if (!validDate(date)) { changed = true; return { ...series, nextIndex: index, active: false }; }
      if (date > horizon || (series.kind === "task" ? tasks.length >= 5000 : transactions.length >= 10000)) break;
      const id = `${series.id}:${date}`;
      if (series.kind === "task") {
        if (!ids.has(id)) tasks.push({ ...series.template, id, date, completed: false, recurrenceId: series.id });
      } else if (!ids.has(id)) transactions.push({ ...series.template, id, date, paid: false, recurrenceId: series.id });
      ids.add(id);
      index++;
    }
    if (index !== series.nextIndex) { changed = true; return { ...series, nextIndex: index }; }
    return series;
  });
  return changed ? { ...data, tasks, transactions, recurrences } : data;
}

export function repeatingTask(data: AppData, task: Task, frequency: Frequency, today = dateKey()): AppData {
  if ((data.recurrences?.filter(s => s.active).length ?? 0) >= 100 || (data.recurrences?.length ?? 0) >= 1000) throw new Error("Limite de repetições atingido. Exporte um backup antes de reorganizar suas rotinas.");
  const { id: _id, date: _date, completed: _completed, recurrenceId: _series, ...template } = task;
  const series: Recurrence = { id: randomId(), kind: "task", frequency, anchorDate: task.date, nextIndex: 1, active: true, template };
  return materializeRecurrences({ ...data, tasks: [...data.tasks, { ...task, recurrenceId: series.id }], recurrences: [...(data.recurrences ?? []), series] }, today);
}

export function repeatingTransaction(data: AppData, transaction: Transaction, frequency: Frequency, today = dateKey()): AppData {
  if ((data.recurrences?.filter(s => s.active).length ?? 0) >= 100 || (data.recurrences?.length ?? 0) >= 1000) throw new Error("Limite de repetições atingido. Exporte um backup antes de reorganizar suas rotinas.");
  const { id: _id, date: _date, paid: _paid, recurrenceId: _series, installment: _part, ...template } = transaction;
  const series: Recurrence = { id: randomId(), kind: "transaction", frequency, anchorDate: transaction.date, nextIndex: 1, active: true, template };
  return materializeRecurrences({ ...data, transactions: [...data.transactions, { ...transaction, recurrenceId: series.id }], recurrences: [...(data.recurrences ?? []), series] }, today);
}

export function stopRecurrence(data: AppData, id: string, today = dateKey()): AppData {
  return { ...data, recurrences: data.recurrences?.map(s => s.id === id ? { ...s, active: false } : s),
    tasks: data.tasks.filter(t => t.recurrenceId !== id || t.date <= today || t.completed),
    transactions: data.transactions.filter(t => t.recurrenceId !== id || t.date <= today || t.paid) };
}

export function firstInvoiceDate(card: CreditCard, purchasedOn: string) {
  const month = purchasedOn.slice(0, 7);
  const afterClosing = purchasedOn >= dateInMonth(month, card.closingDay);
  const invoiceMonth = shiftMonth(month, Number(afterClosing) + Number(card.dueDay <= card.closingDay));
  return dateInMonth(invoiceMonth, card.dueDay);
}

export function purchaseInstallments(card: CreditCard, input: { description: string; amountCents: number; count: number; date: string; category: string; notes: string }): Transaction[] {
  if (!Number.isInteger(input.count) || input.count < 1 || input.count > 48 || input.amountCents < input.count) throw new Error("Escolha de 1 a 48 parcelas, com pelo menos R$ 0,01 em cada parcela.");
  const first = firstInvoiceDate(card, input.date);
  const purchaseId = randomId(), base = Math.floor(input.amountCents / input.count), remainder = input.amountCents % input.count;
  return Array.from({ length: input.count }, (_, i) => {
    const date = dateInMonth(shiftMonth(first.slice(0, 7), i), card.dueDay);
    if (date > "2200-12-31") throw new Error("As parcelas ultrapassam o limite de datas do aplicativo.");
    return { id: randomId(), description: input.description, amountCents: base + Number(i < remainder), date, category: input.category,
      type: "expense", paid: false, notes: input.notes,
      installment: { cardId: card.id, purchaseId, index: i + 1, count: input.count, purchasedOn: input.date } };
  });
}

export function cardSummary(data: AppData, cardId: string, month: string) {
  const entries = data.transactions.filter(t => t.installment?.cardId === cardId);
  const invoice = entries.filter(t => t.date.startsWith(month));
  return { invoice, total: invoice.reduce((sum, t) => sum + t.amountCents, 0),
    pending: invoice.filter(t => !t.paid).reduce((sum, t) => sum + t.amountCents, 0),
    outstanding: entries.filter(t => !t.paid).reduce((sum, t) => sum + t.amountCents, 0) };
}

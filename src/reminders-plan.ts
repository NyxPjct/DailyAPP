import { parseDate } from "./domain";
import { getLanguage, isLanguage, translate, recordText } from "./i18n/core";
import type { AppData } from "./domain";
import type { LocalNotificationSchema } from "@capacitor/local-notifications";

function fireTime(date: string, time: string, minutes: number) {
  const at = parseDate(date), [hour, minute] = time.split(":").map(Number);
  at.setHours(hour, minute, 0, 0); at.setTime(at.getTime() - minutes * 60000);
  return at;
}

export function reminderStillCurrent(data: AppData, extra: Record<string, unknown>) {
  const language = isLanguage(extra.language) ? extra.language : "pt-BR";
  if (extra.kind === "task") {
    const task = data.tasks.find(t => t.id === extra.itemId);
    return !!task && !task.completed && !!task.time && task.reminderMinutes !== undefined && recordText(task.id, task.title, language) === extra.content && fireTime(task.date, task.time, task.reminderMinutes).getTime() === extra.fireAt;
  }
  if (extra.kind === "transaction") {
    const t = data.transactions.find(t => t.id === extra.itemId);
    return !!t && !t.paid && t.reminderMinutes !== undefined && recordText(t.id, t.description, language) === extra.content && fireTime(t.date, "09:00", t.reminderMinutes).getTime() === extra.fireAt;
  }
  if (extra.kind === "card") {
    const card = data.cards?.find(c => c.id === extra.itemId);
    return !!card && card.reminderDays !== undefined && typeof extra.date === "string" && extra.content === translate(language, "Confira a fatura de {0}.", card.name) &&
      data.transactions.some(t => t.installment?.cardId === card.id && t.date === extra.date && !t.paid) && fireTime(extra.date, "09:00", card.reminderDays * 1440).getTime() === extra.fireAt;
  }
  return false;
}

export function buildReminderPlan(data: AppData, now = new Date()): LocalNotificationSchema[] {
  const language = data.language ?? getLanguage();
  const pending: { key: string; date: string; at: Date; title: string; body: string; kind: string; itemId: string; month?: string }[] = [];
  const add = (key: string, date: string, time: string, minutes: number, title: string, body: string, kind: string, itemId: string, month?: string) => {
    const at = fireTime(date, time, minutes);
    if (at.getTime() > now.getTime()) pending.push({ key, date, at, title, body, kind, itemId, ...(month ? { month } : {}) });
  };
  for (const task of data.tasks) if (!task.completed && task.time && task.reminderMinutes !== undefined)
    add(`task:${task.id}`, task.date, task.time, task.reminderMinutes, translate(language, "Sua tarefa está chegando"), recordText(task.id, task.title, language), "task", task.id);
  for (const transaction of data.transactions) if (!transaction.paid && transaction.reminderMinutes !== undefined)
    add(`transaction:${transaction.id}`, transaction.date, "09:00", transaction.reminderMinutes, translate(language, transaction.type === "expense" ? "Conta a vencer" : "Receita prevista"), recordText(transaction.id, transaction.description, language), "transaction", transaction.id);
  for (const card of data.cards ?? []) {
    if (card.reminderDays === undefined) continue;
    const dates = new Set(data.transactions.filter(t => t.installment?.cardId === card.id && !t.paid).map(t => t.date));
    for (const date of dates) add(`card:${card.id}:${date}`, date, "09:00", card.reminderDays * 1440, translate(language, "Lembrete de fatura"), translate(language, "Confira a fatura de {0}.", card.name), "card", card.id, date.slice(0, 7));
  }
  const used = new Set<number>();
  return pending.sort((a, b) => a.at.getTime() - b.at.getTime() || a.key.localeCompare(b.key)).slice(0, 60).map(item => {
    let hash = 2166136261;
    for (const character of item.key) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    let id = (hash >>> 0) % 2147483647 || 1;
    while (used.has(id)) id = id % 2147483647 + 1;
    used.add(id);
    return { id, title: item.title, body: item.body, sound: "default", channelId: "dailyapp-reminders", isExact: false,
      schedule: { at: item.at, allowWhileIdle: true },
      extra: { dailyapp: true, language, kind: item.kind, itemId: item.itemId, date: item.date, fireAt: item.at.getTime(), content: item.body, ...(item.month ? { month: item.month } : {}) } };
  });
}

export function localizePendingReminder(data: AppData, reminder: LocalNotificationSchema, now: Date): LocalNotificationSchema & { isExact: false } {
  const language = data.language ?? getLanguage(), extra = reminder.extra;
  let title = "", body = "";
  if (extra.kind === "task") {
    const task = data.tasks.find(t => t.id === extra.itemId)!;
    title = translate(language, "Sua tarefa está chegando"); body = recordText(task.id, task.title, language);
  } else if (extra.kind === "transaction") {
    const transaction = data.transactions.find(t => t.id === extra.itemId)!;
    title = translate(language, transaction.type === "expense" ? "Conta a vencer" : "Receita prevista"); body = recordText(transaction.id, transaction.description, language);
  } else {
    const card = data.cards!.find(c => c.id === extra.itemId)!;
    title = translate(language, "Lembrete de fatura"); body = translate(language, "Confira a fatura de {0}.", card.name);
  }
  return { ...reminder, title, body, extra: { ...extra, language, content: body },
    schedule: { at: new Date(now.getTime() + 1000), allowWhileIdle: true }, isExact: false };
}

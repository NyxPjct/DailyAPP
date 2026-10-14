import { Capacitor } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { AppData } from "../domain";
import { buildReminderPlan, reminderStillCurrent, localizePendingReminder } from "../reminders-plan";
import { getLanguage, translate } from "../i18n/core";

export type ReminderState = { state: "web" | "ready" | "permission" | "denied" | "error" | "superseded"; count: number };
export const initialReminderState: ReminderState = { state: Capacitor.isNativePlatform() ? "permission" : "web", count: 0 };
let queue: Promise<ReminderState> = Promise.resolve(initialReminderState), generation = 0;

export async function requestReminderPermission() {
  if (!Capacitor.isNativePlatform()) return false;
  const current = await LocalNotifications.checkPermissions();
  if (current.display === "granted") return true;
  if (current.display === "denied") return false;
  return (await LocalNotifications.requestPermissions()).display === "granted";
}

export function syncReminders(data: AppData): Promise<ReminderState> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve({ state: "web", count: 0 });
  const run = ++generation;
  queue = queue.then(async (): Promise<ReminderState> => {
    if (run !== generation) return { state: "superseded", count: 0 };
    const permission = await LocalNotifications.checkPermissions();
    const pending = await LocalNotifications.getPending();
    if (run !== generation) return { state: "superseded", count: 0 };
    const now = new Date();
    const language = data.language ?? getLanguage();
    const eligible = pending.notifications.filter(n => n.extra?.dailyapp === true && permission.display === "granted" && n.extra.fireAt <= now.getTime() && reminderStillCurrent(data, n.extra));
    const delayed = eligible.filter(n => n.extra.language === language);
    const updated = eligible.filter(n => n.extra.language !== language).map(n => localizePendingReminder(data, n, now));
    const keep = new Set(delayed.map(n => n.id));
    const owned = pending.notifications.filter(n => n.extra?.dailyapp === true && !keep.has(n.id)).map(n => ({ id: n.id }));
    if (owned.length) await LocalNotifications.cancel({ notifications: owned });
    if (permission.display !== "granted") return { state: permission.display === "denied" ? "denied" : "permission", count: 0 };
    if (run !== generation) return { state: "superseded", count: 0 };
    if (Capacitor.getPlatform() === "android") await LocalNotifications.createChannel({ id: "dailyapp-reminders", name: translate(language, "Lembretes do DailyAPP"), description: translate(language, "Tarefas, contas e faturas"), importance: 4, visibility: 0, vibration: true });
    const foreign = pending.notifications.filter(n => n.extra?.dailyapp !== true);
    const notifications = [...updated, ...buildReminderPlan(data, now)].slice(0, Math.max(0, 60 - delayed.length - foreign.length));
    const occupied = new Set([...foreign, ...delayed].map(n => n.id));
    for (const n of notifications) { while (occupied.has(n.id)) n.id = n.id % 2147483647 + 1; occupied.add(n.id); }
    if (run !== generation) return { state: "superseded", count: 0 };
    if (notifications.length) await LocalNotifications.schedule({ notifications });
    return { state: "ready", count: notifications.length + delayed.length };
  }).catch(() => ({ state: "error" as const, count: 0 }));
  return queue;
}

export function attachReminderTap(onTap: (kind: string, id: string, month?: string) => void) {
  if (!Capacitor.isNativePlatform()) return () => {};
  let stopped = false, listener: PluginListenerHandle | undefined;
  void LocalNotifications.addListener("localNotificationActionPerformed", action => {
    const extra = action.notification.extra;
    if (extra?.dailyapp === true && typeof extra.kind === "string" && typeof extra.itemId === "string") onTap(extra.kind, extra.itemId, typeof extra.month === "string" ? extra.month : undefined);
  }).then(handle => { if (stopped) void handle.remove(); else listener = handle; }).catch(() => {});
  return () => { stopped = true; void listener?.remove(); };
}

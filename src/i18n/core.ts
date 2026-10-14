import { messages } from "./messages";

export const LANGUAGE_KEY = "dailyapp.language";
export const LANGUAGES = [
  { id: "en", name: "English", locale: "en-US" },
  { id: "pt-BR", name: "Português", locale: "pt-BR" },
  { id: "es", name: "Español", locale: "es-ES" },
  { id: "fr", name: "Français", locale: "fr-FR" },
  { id: "de", name: "Deutsch", locale: "de-DE" },
] as const;
export type Language = (typeof LANGUAGES)[number]["id"];
export type ForeignLanguage = Exclude<Language, "pt-BR">;
export function isLanguage(value: unknown): value is Language {
  return LANGUAGES.some(language => language.id === value);
}
export function readLanguagePreference(): Language {
  try { const value = localStorage.getItem(LANGUAGE_KEY); if (isLanguage(value)) return value; }
  catch { /* A missing preference must not block the app. */ }
  return "en";
}
let currentLanguage: Language = readLanguagePreference();
export const getLanguage = () => currentLanguage;
export const setCurrentLanguage = (language: Language) => { currentLanguage = language; };
export const getLocale = (language = currentLanguage) => LANGUAGES.find(item => item.id === language)!.locale;

export function translate(language: Language, source: string, ...values: unknown[]): string {
  const key = source.trim();
  const message = language === "pt-BR" ? key : messages[key]?.[language] ?? messages[key]?.en ?? key;
  // Preserve surrounding spaces used between inline elements, and substitute
  // parameters once so user-entered text containing {0} remains untouched.
  const leading = source.slice(0, source.length - source.trimStart().length);
  const trailing = source.slice(source.trimEnd().length);
  return leading + message.replace(/\{(\d+)\}/g, (_, index: string) => String(values[Number(index)] ?? `{${index}}`)) + trailing;
}
export const t = (source: string, ...values: unknown[]) => translate(currentLanguage, source, ...values);

const demoText: Record<string, string> = {
  "demo-task-1": "Planejar as prioridades da semana", "demo-task-2": "Reunião de planejamento",
  "demo-task-3": "Fazer compras da semana", "demo-task-4": "Reservar um tempo para caminhar",
  "demo-task-5": "Revisar os gastos do mês", "demo-task-6": "Estudar um novo assunto",
  "demo-transaction-1": "Salário", "demo-transaction-2": "Projeto freelance", "demo-transaction-3": "Aluguel",
  "demo-transaction-4": "Supermercado", "demo-transaction-5": "Café com amigos", "demo-transaction-6": "Transporte da semana",
  "demo-transaction-7": "Internet", "demo-transaction-8": "Academia",
};
export function recordText(id: string, text: string, language = currentLanguage) {
  return demoText[id] === text ? translate(language, text) : text;
}

export function parseLocalizedAmount(value: string, language = currentLanguage, maximumCents = 100_000_000_000): number | null {
  const parts = new Intl.NumberFormat(getLocale(language)).formatToParts(12345.6);
  const decimal = parts.find(p => p.type === "decimal")!.value;
  const group = parts.find(p => p.type === "group")!.value;
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const grouping = /\s/.test(group) ? "[ \\u00a0\\u202f]" : escape(group);
  const clean = value.trim().replace(/^R\$\s*/, "");
  const localized = new RegExp(`^(?:\\d{1,3}(?:${grouping}\\d{3})+|\\d+)(?:${escape(decimal)}\\d{1,2})?$`).test(clean);
  // Phone keyboards may follow the device language instead of the app. An
  // alternate decimal separator with at most two digits cannot be a thousands
  // group; accept that case without guessing mixed or three-digit separators.
  const alternate = /^\d+[.,]\d{1,2}$/.test(clean);
  if (!localized && !alternate) return null;
  const normalized = localized ? clean.replace(new RegExp(grouping, "g"), "").replace(decimal, ".") : clean.replace(",", ".");
  const cents = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(cents) && cents > 0 && cents <= maximumCents ? cents : null;
}

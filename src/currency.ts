import { getLanguage, getLocale, parseLocalizedAmount, t as tr } from "./i18n/core";
import type { Language } from "./i18n/core";

export const CURRENCIES = ["BRL", "USD", "EUR", "GBP", "CAD", "AUD"] as const;
export type Currency = typeof CURRENCIES[number];
export type ForeignCurrency = Exclude<Currency, "BRL">;
export interface ExchangeRate { rate: number; date: string; source: "currency-api" | "manual" }
export type ExchangeRates = Partial<Record<ForeignCurrency, ExchangeRate>>;
export const RATE_URL = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/brl.min.json";
export const RATE_SOURCE_URL = "https://github.com/fawazahmed0/exchange-api";
export const isCurrency = (value: unknown): value is Currency => CURRENCIES.some(c => c === value);
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
export const validRate = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0.000001 && value <= 1000000;
const validRateDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= "1900-01-01" && value <= "2200-12-31" && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

export function validateExchangeRates(value: unknown): ExchangeRates {
  if (!isObject(value) || Object.keys(value).some(key => key === "BRL" || !isCurrency(key))) throw new Error(tr("O backup contém cotações inválidas."));
  const rates: ExchangeRates = {};
  for (const currency of CURRENCIES) {
    if (currency === "BRL" || value[currency] === undefined) continue;
    const entry = value[currency];
    if (!isObject(entry) || !validRate(entry.rate) || !validRateDate(entry.date) || !["currency-api", "manual"].includes(String(entry.source))) throw new Error(tr("O backup contém cotações inválidas."));
    rates[currency] = { rate: entry.rate, date: entry.date, source: entry.source as ExchangeRate["source"] };
  }
  return rates;
}

// All stored monetary values remain integer BRL cents. Exchange rates are units
// of the selected currency per BRL, so changing the display never migrates data.
let currentCurrency: Currency = "BRL";
let currentRates: ExchangeRates = {};
export function setCurrentCurrency(currency: Currency, rates: ExchangeRates = {}) { currentCurrency = currency; currentRates = rates; }
export const getCurrency = () => currentCurrency;
export const getRate = () => currentCurrency === "BRL" ? 1 : currentRates[currentCurrency]!.rate;
const roundCents = (value: number) => Math.sign(value) * Math.round(Math.abs(value) + Number.EPSILON * Math.min(Math.abs(value), 1e9));
export const toDisplayCents = (cents: number) => roundCents(cents * getRate());
export const currencySymbol = () => new Intl.NumberFormat(getLocale(), { style: "currency", currency: currentCurrency }).formatToParts(1).find(p => p.type === "currency")!.value;

function parseDisplayBalance(value: string, language: Language) {
  const clean = value.trim();
  const negative = /^[−-]/.test(clean);
  const unsigned = negative ? clean.slice(1).trim() : clean;
  if (/^0+(?:[,.]0{1,2})?$/.test(unsigned)) return 0;
  const cents = parseLocalizedAmount(unsigned, language, Number.MAX_SAFE_INTEGER);
  return cents === null ? null : negative ? -cents : cents;
}
export function parseCurrencyBalance(value: string, original?: number, language = getLanguage()): number | null {
  const display = parseDisplayBalance(value, language);
  if (display === null) return null;
  // Saving an unchanged converted field must preserve cents that cannot be
  // represented with two decimals in the display currency.
  if (original !== undefined && display === toDisplayCents(original)) return original;
  const cents = roundCents(display / getRate());
  return Number.isSafeInteger(cents) && Math.abs(cents) <= 100_000_000_000 ? cents : null;
}
export function parseCurrencyAmount(value: string, original?: number): number | null {
  const cents = parseCurrencyBalance(value, original);
  return cents !== null && cents > 0 ? cents : null;
}
export function parseRateInput(value: string, language = getLanguage()): number | null {
  const decimal = new Intl.NumberFormat(getLocale(language)).formatToParts(1.1).find(p => p.type === "decimal")!.value;
  const clean = value.trim();
  if (!/^\d+(?:[.,]\d{1,8})?$/.test(clean)) return null;
  const number = Number(clean.replace(decimal, ".").replace(",", "."));
  return validRate(number) ? number : null;
}

export function ratesFromResponse(value: unknown, now = new Date()): ExchangeRates {
  if (!isObject(value) || !validRateDate(value.date) || !isObject(value.brl) || value.brl.brl !== 1 || Date.parse(value.date) > now.getTime() + 86400000) throw new Error(tr("A fonte retornou uma cotação inválida."));
  const rates: ExchangeRates = {};
  for (const currency of CURRENCIES) {
    if (currency === "BRL") continue;
    const rate = value.brl[currency.toLowerCase()];
    if (!validRate(rate)) throw new Error(tr("A fonte retornou uma cotação inválida."));
    rates[currency] = { rate, date: value.date, source: "currency-api" };
  }
  return rates;
}
export async function fetchExchangeRates(signal?: AbortSignal): Promise<ExchangeRates> {
  // iOS 15.4 supports AbortController but does not provide the newer static
  // AbortSignal.timeout/any helpers. Keep cancellation and timeout compatible.
  const request = new AbortController();
  const abort = () => request.abort();
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 10000);
  try {
    const response = await fetch(RATE_URL, { signal: request.signal, credentials: "omit", referrerPolicy: "no-referrer" });
    if (!response.ok) throw new Error(tr("Não foi possível atualizar a cotação. Use a taxa salva ou informe uma taxa manual."));
    return ratesFromResponse(await response.json());
  } finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
}

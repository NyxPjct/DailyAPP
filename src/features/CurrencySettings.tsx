import { useEffect, useRef, useState } from "react";
import { RefreshCw, Wallet } from "lucide-react";
import { t as tr, getLocale } from "../i18n/core";
import { dateKey, parseDate } from "../domain";
import type { AppData } from "../domain";
import { CURRENCIES, fetchExchangeRates, isCurrency, parseRateInput, RATE_SOURCE_URL } from "../currency";
import type { Currency, ExchangeRates } from "../currency";

const names = { BRL: "Real brasileiro", USD: "Dólar americano", EUR: "Euro", GBP: "Libra esterlina", CAD: "Dólar canadense", AUD: "Dólar australiano" };
export function CurrencySettings({ data, onSave }: { data: AppData; onSave: (currency: Currency, rates: ExchangeRates) => boolean }) {
  const [currency, setCurrency] = useState<Currency>(data.currency ?? "BRL");
  const [rates, setRates] = useState<ExchangeRates>(data.exchangeRates ?? {});
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => { setCurrency(data.currency ?? "BRL"); setRates(data.exchangeRates ?? {}); }, [data.currency, data.exchangeRates]);
  useEffect(() => () => controller.current?.abort(), []);
  const entry = currency === "BRL" ? undefined : rates[currency];
  const old = !!entry && Date.now() - Date.parse(entry.date) > 7 * 86400000;
  const rateText = entry?.rate.toLocaleString(getLocale(), { maximumFractionDigits: 8, useGrouping: false });
  async function loadRates() {
    controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    setBusy(true); setError("");
    try { const next = await fetchExchangeRates(request.signal); setRates(next); return next; }
    catch { if (!request.signal.aborted) setError(tr("Não foi possível atualizar a cotação. Use a taxa salva ou informe uma taxa manual.")); return null; }
    finally { if (!request.signal.aborted) setBusy(false); }
  }
  async function apply() {
    setError("");
    const next = currency === "BRL" || entry ? rates : await loadRates();
    if (next && !controller.current?.signal.aborted) onSave(currency, next);
  }
  return <section className="panel settings-panel currency-settings">
    <div className="panel-heading"><div className="section-icon sage"><Wallet size={19} /></div><div><h2>{tr("Moeda e conversão")}</h2><p>{tr("Escolha a moeda dos valores, independentemente do idioma.")}</p></div></div>
    <form onSubmit={event => { event.preventDefault(); void apply(); }}>
      <label>{tr("Moeda do aplicativo")}<select aria-label={tr("Moeda do aplicativo")} value={currency} disabled={busy} onChange={event => { if (isCurrency(event.target.value)) { setCurrency(event.target.value); setManual(""); setError(""); } }}>{CURRENCIES.map(code => <option key={code} value={code}>{code} · {tr(names[code])}</option>)}</select></label>
      {currency !== "BRL" && <>
        <div className="exchange-rate-info" aria-live="polite">
          <strong>{entry ? tr("1 BRL = {0} {1}", rateText, currency) : tr("Nenhuma cotação salva para {0}.", currency)}</strong>
          {entry && <small>{tr("Cotação de {0}", parseDate(entry.date).toLocaleDateString(getLocale()))} · {entry.source === "manual" ? tr("Taxa manual") : <a href={RATE_SOURCE_URL} target="_blank" rel="noreferrer">Currency API</a>}</small>}
          {old && <p className="form-hint">{tr("A cotação tem mais de sete dias. Atualize quando puder.")}</p>}
        </div>
        <button type="button" className="button secondary" disabled={busy} onClick={() => { void loadRates(); }}><RefreshCw size={16} />{busy ? tr("Buscando cotação…") : tr("Atualizar cotação")}</button>
        <details className="manual-rate"><summary>{tr("Informar taxa manual")}</summary>
          <label>{tr("Valor de 1 BRL em {0}", currency)}<input inputMode="decimal" autoComplete="off" disabled={busy} value={manual} onChange={event => setManual(event.target.value)} placeholder={rateText ?? "0.20"} /></label>
          <p className="form-hint">{tr("Exemplo: se 1 BRL vale 0,20 USD, informe 0,20. Aceita até oito casas decimais.")}</p>
          <button type="button" className="button secondary" disabled={busy} onClick={() => {
            const rate = parseRateInput(manual);
            if (rate === null) { setError(tr("Informe uma taxa válida, maior que zero, com até oito casas decimais.")); return; }
            setError(""); onSave(currency, { ...rates, [currency]: { rate, date: dateKey(), source: "manual" } });
          }}>{tr("Salvar taxa manual")}</button>
        </details>
      </>}
      <p className="form-hint">{tr("Os registros são preservados em BRL. Valores novos são convertidos para BRL ao salvar; telas e campos usam a moeda selecionada. As cotações são estimativas, sem tarifas bancárias.")}</p>
      <p className="form-hint">{tr("Sem internet, o app usa a última cotação salva. Novas cotações só são aplicadas ao salvar a moeda.")}</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" className="button primary" disabled={busy}>{tr("Salvar moeda")}</button>
    </form>
  </section>;
}

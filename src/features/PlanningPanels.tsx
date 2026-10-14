import { currencySymbol, parseCurrencyAmount } from "../currency";
import { t as tr, recordText } from "../i18n/core";
import { useState } from "react";
import { CreditCard as CardIcon, Plus, Pencil, Repeat2, Bell, Archive, Check } from "lucide-react";
import { FREQUENCIES, dateKey, prettyDate, money, amountInput, validDate, randomId, EXPENSE_CATEGORIES } from "../domain";
import type { AppData, CreditCard, Recurrence } from "../domain";
import { cardSummary, dateInMonth, recurrenceDate } from "../planning";

export interface PurchaseInput { cardId: string; description: string; amountCents: number; count: number; date: string; category: string; notes: string }

export function RecurrencePanel({ data, kind, onStop }: { data: AppData; kind: Recurrence["kind"]; onStop: (id: string) => void }) {
  const series = (data.recurrences ?? []).filter(s => s.kind === kind && s.active);
  if (!series.length) return null;
  return <details className="panel recurrence-panel">
    <summary><Repeat2 size={18} />{tr("Rotinas recorrentes ")}<span className="neutral-tag">{series.length}</span></summary>
    <p className="form-hint">{tr("As próximas ocorrências são criadas automaticamente ao abrir o app. Edite cada registro para ajustar só aquela ocorrência.")}</p>
    {series.map(s => {
      const next = (s.kind === "task" ? data.tasks.filter(t => !t.completed) : data.transactions.filter(t => !t.paid)).filter(t => t.recurrenceId === s.id && t.date >= dateKey()).sort((a, b) => a.date.localeCompare(b.date))[0]?.date ?? recurrenceDate(s.anchorDate, s.frequency, s.nextIndex);
      return <div className="recurrence-row" key={s.id}><div><strong>{s.kind === "task" ? s.template.title : s.template.description}</strong><small>{tr(FREQUENCIES[s.frequency])}{tr(" · próxima: ")}{prettyDate(next)}</small></div><button className="text-button" onClick={() => onStop(s.id)}>{tr("Parar repetição")}<span className="sr-only">: {s.kind === "task" ? s.template.title : s.template.description}</span></button></div>;
    })}
  </details>;
}

export function CardsPanel({ data, month, onNew, onEdit, onArchive, onPurchase, onPay }: {
  data: AppData; month: string; onNew: () => void; onEdit: (card: CreditCard) => void;
  onArchive: (card: CreditCard) => void; onPurchase: (card: CreditCard) => void; onPay: (card: CreditCard) => void;
}) {
  const cards = data.cards ?? [];
  return <section className="cards-section">
    <div className="planning-heading"><div><h2>{tr("Seus cartões")}</h2><p>{tr("Limites, parcelas e faturas em um só lugar.")}</p></div><button className="button primary" onClick={onNew}><Plus size={16} />{tr("Novo cartão")}</button></div>
    {!cards.length && <div className="panel planning-empty"><CardIcon size={32} /><h3>{tr("Comece pelo seu cartão")}</h3><p>{tr("Cadastre um nome, limite, fechamento e vencimento. Não precisamos do número do cartão.")}</p><button className="button secondary" onClick={onNew}>{tr("Cadastrar cartão")}</button></div>}
    <div className="cards-grid">{cards.map(card => {
      const totals = cardSummary(data, card.id, month);
      const available = Math.max(0, card.limitCents - totals.outstanding);
      return <article className="panel credit-card" key={card.id} aria-label={tr("Cartão {0}", card.name)}>
        <div className="credit-card-heading"><div><CardIcon size={22} /><h3>{card.name}</h3>{card.archived && <span className="neutral-tag">{tr("Arquivado")}</span>}</div><button className="icon-button" aria-label={tr("Editar cartão: {0}", card.name)} onClick={() => onEdit(card)}><Pencil size={17} /></button></div>
        <div className="card-limit"><div><span>{tr("Limite disponível")}</span><strong>{money(available)}</strong></div><small>{tr("de ")}{money(card.limitCents)}</small></div>
        <div className="progress-track" role="progressbar" aria-label={tr("Limite utilizado: {0}", card.name)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(totals.outstanding / card.limitCents * 100))}><div style={{ width: `${Math.min(100, totals.outstanding / card.limitCents * 100)}%` }} /></div>
        <p className={totals.outstanding > card.limitCents ? "form-error" : "form-hint"}>{money(totals.outstanding)}{tr(" em parcelas ainda não pagas")}{totals.outstanding > card.limitCents ? tr(" · limite ultrapassado") : ""}.</p>
        <div className="card-dates"><span>{tr("Fecha dia ")}<strong>{card.closingDay}</strong></span><span>{tr("Vence dia ")}<strong>{card.dueDay}</strong></span>{card.reminderDays !== undefined && <span><Bell size={13} />{tr("Lembrete ativo")}</span>}</div>
        <div className="invoice-summary"><span>{tr("Fatura com vencimento em ")}{totals.invoice.length ? [...new Set(totals.invoice.map(t => t.date))].sort().map(prettyDate).join(tr(" / ")) : prettyDate(dateInMonth(month, card.dueDay))}</span><strong>{money(totals.total)}</strong><small>{totals.pending ? tr("{0} a pagar", money(totals.pending)) : totals.total ? tr("Fatura marcada como paga") : tr("Nenhuma compra neste mês")}</small></div>
        {!!totals.invoice.length && <ul className="invoice-list">{totals.invoice.map(t => <li key={t.id}><div><strong>{recordText(t.id, t.description)}</strong><small>{tr("Parcela ")}{t.installment!.index}/{t.installment!.count} · {t.paid ? tr("Paga") : tr("A pagar")}</small></div><span>{money(t.amountCents)}</span></li>)}</ul>}
        <div className="card-actions">{!card.archived && <button className="button secondary" onClick={() => onPurchase(card)}><Plus size={15} />{tr("Registrar compra")}</button>}{totals.pending > 0 && <button className="button primary" onClick={() => onPay(card)}><Check size={15} />{tr("Marcar fatura como paga")}</button>}<button className="text-button" onClick={() => onArchive(card)}><Archive size={14} />{card.archived ? tr("Reativar cartão") : tr("Arquivar cartão")}</button></div>
      </article>;
    })}</div>
    <p className="form-hint">{tr("O limite é uma estimativa baseada nas compras registradas. As parcelas entram nas despesas do mês do vencimento. Marcar a fatura como paga atualiza essas parcelas, sem criar outro gasto.")}</p>
  </section>;
}

export function CardForm({ item, onSave, onClose }: { item?: CreditCard; onSave: (card: CreditCard) => boolean; onClose: () => void }) {
  const [name, setName] = useState(item?.name ?? ""), [limit, setLimit] = useState(item ? amountInput(item.limitCents) : "");
  const [closing, setClosing] = useState(String(item?.closingDay ?? 25)), [due, setDue] = useState(String(item?.dueDay ?? 5));
  const [reminder, setReminder] = useState(item?.reminderDays ?? -1), [error, setError] = useState("");
  return <form onSubmit={event => {
    event.preventDefault(); const cents = parseCurrencyAmount(limit, item?.limitCents);
    if (!name.trim() || !cents || ![closing, due].every(v => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 31)) { setError(tr("Informe um nome, limite maior que zero e dias de 1 a 31.")); return; }
    if (onSave({ ...item, id: item?.id ?? randomId(), name: name.trim(), limitCents: cents, closingDay: Number(closing), dueDay: Number(due), reminderDays: reminder >= 0 ? reminder : undefined })) onClose();
  }}>
    <label>{tr("Nome do cartão")}<input required maxLength={60} placeholder={tr("Ex.: Meu cartão principal")} value={name} onChange={e => setName(e.target.value)} /></label>
    <label>{tr("Limite do cartão ({0})", currencySymbol())}<input required inputMode="decimal" placeholder={tr("Ex.: 5.000,00")} value={limit} onChange={e => setLimit(e.target.value)} /></label>
    <div className="form-grid"><label>{tr("Dia de fechamento")}<input type="number" min={1} max={31} required value={closing} onChange={e => setClosing(e.target.value)} /></label><label>{tr("Dia de vencimento")}<input type="number" min={1} max={31} required value={due} onChange={e => setDue(e.target.value)} /></label></div>
    <label>{tr("Lembrete da fatura")}<select value={reminder} onChange={e => setReminder(Number(e.target.value))}><option value={-1}>{tr("Sem lembrete")}</option><option value={0}>{tr("No vencimento, às 9h")}</option><option value={1}>{tr("1 dia antes, às 9h")}</option><option value={3}>{tr("3 dias antes, às 9h")}</option></select></label>
    <p className="form-hint">{tr("Compras no dia do fechamento ou depois entram na próxima fatura. Dias 29, 30 e 31 são ajustados para o último dia de meses menores. Mudanças nos dias valem para novas compras.")}</p>
    {error && <p className="form-error" role="alert">{error}</p>}<div className="modal-footer"><button className="button secondary" type="button" onClick={onClose}>{tr("Cancelar")}</button><button className="button primary" type="submit">{item ? tr("Salvar cartão") : tr("Cadastrar cartão")}</button></div>
  </form>;
}

export function PurchaseForm({ cards, selectedId, onSave, onClose }: { cards: CreditCard[]; selectedId?: string; onSave: (input: PurchaseInput) => boolean; onClose: () => void }) {
  const [cardId, setCardId] = useState(selectedId ?? cards[0]?.id ?? ""), [description, setDescription] = useState("");
  const [amount, setAmount] = useState(""), [count, setCount] = useState("1"), [day, setDay] = useState(dateKey());
  const [category, setCategory] = useState("Compras"), [notes, setNotes] = useState(""), [error, setError] = useState("");
  return <form onSubmit={e => {
    e.preventDefault(); const cents = parseCurrencyAmount(amount);
    if (!cents || !description.trim() || !validDate(day) || !cards.some(c => c.id === cardId && !c.archived) || !/^\d+$/.test(count) || Number(count) < 1 || Number(count) > 48 || cents < Number(count)) { setError(tr("Escolha um cartão, descrição, valor e de 1 a 48 parcelas. Cada parcela precisa representar pelo menos um centavo em BRL.")); return; }
    if (onSave({ cardId, description: description.trim(), amountCents: cents, count: Number(count), date: day, category, notes: notes.trim() })) onClose();
  }}>
    <label>{tr("Descrição da compra")}<input required maxLength={120} placeholder={tr("Ex.: Notebook")} value={description} onChange={e => setDescription(e.target.value)} /></label>
    <label>{tr("Cartão")}<select value={cardId} required onChange={e => setCardId(e.target.value)}>{cards.filter(c => !c.archived).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <div className="form-grid"><label>{tr("Valor total da compra ({0})", currencySymbol())}<input required inputMode="decimal" placeholder={tr("0,00")} value={amount} onChange={e => setAmount(e.target.value)} /></label><label>{tr("Número de parcelas")}<input required type="number" min={1} max={48} value={count} onChange={e => setCount(e.target.value)} /></label></div>
    <label>{tr("Data da compra")}<input required type="date" min="1900-01-01" max="2200-12-31" value={day} onChange={e => setDay(e.target.value)} /></label>
    <label>{tr("Categoria")}<select value={category} onChange={e => setCategory(e.target.value)}>{EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{tr(c)}</option>)}</select></label>
    <label>{tr("Observações ")}<span className="optional">{tr("(opcional)")}</span><textarea maxLength={1000} rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></label>
    <p className="form-hint">{tr("As parcelas serão distribuídas pelas faturas e registradas como despesas previstas. A soma mantém exatamente o valor total da compra.")}</p>
    {error && <p className="form-error" role="alert">{error}</p>}<div className="modal-footer"><button className="button secondary" type="button" onClick={onClose}>{tr("Cancelar")}</button><button className="button primary" type="submit">{tr("Registrar compra")}</button></div>
  </form>;
}

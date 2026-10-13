import { useState } from "react";
import { CreditCard as CardIcon, Plus, Pencil, Repeat2, Bell, Archive, Check } from "lucide-react";
import { FREQUENCIES, dateKey, prettyDate, money, amountInput, parseAmount, validDate, randomId, EXPENSE_CATEGORIES } from "../domain";
import type { AppData, CreditCard, Recurrence } from "../domain";
import { cardSummary, dateInMonth, recurrenceDate } from "../planning";

export interface PurchaseInput { cardId: string; description: string; amountCents: number; count: number; date: string; category: string; notes: string }

export function RecurrencePanel({ data, kind, onStop }: { data: AppData; kind: Recurrence["kind"]; onStop: (id: string) => void }) {
  const series = (data.recurrences ?? []).filter(s => s.kind === kind && s.active);
  if (!series.length) return null;
  return <details className="panel recurrence-panel">
    <summary><Repeat2 size={18} />Rotinas recorrentes <span className="neutral-tag">{series.length}</span></summary>
    <p className="form-hint">As próximas ocorrências são criadas automaticamente ao abrir o app. Edite cada registro para ajustar só aquela ocorrência.</p>
    {series.map(s => {
      const next = (s.kind === "task" ? data.tasks.filter(t => !t.completed) : data.transactions.filter(t => !t.paid)).filter(t => t.recurrenceId === s.id && t.date >= dateKey()).sort((a, b) => a.date.localeCompare(b.date))[0]?.date ?? recurrenceDate(s.anchorDate, s.frequency, s.nextIndex);
      return <div className="recurrence-row" key={s.id}><div><strong>{s.kind === "task" ? s.template.title : s.template.description}</strong><small>{FREQUENCIES[s.frequency]} · próxima: {prettyDate(next)}</small></div><button className="text-button" onClick={() => onStop(s.id)}>Parar repetição<span className="sr-only">: {s.kind === "task" ? s.template.title : s.template.description}</span></button></div>;
    })}
  </details>;
}

export function CardsPanel({ data, month, onNew, onEdit, onArchive, onPurchase, onPay }: {
  data: AppData; month: string; onNew: () => void; onEdit: (card: CreditCard) => void;
  onArchive: (card: CreditCard) => void; onPurchase: (card: CreditCard) => void; onPay: (card: CreditCard) => void;
}) {
  const cards = data.cards ?? [];
  return <section className="cards-section">
    <div className="planning-heading"><div><h2>Seus cartões</h2><p>Limites, parcelas e faturas em um só lugar.</p></div><button className="button primary" onClick={onNew}><Plus size={16} />Novo cartão</button></div>
    {!cards.length && <div className="panel planning-empty"><CardIcon size={32} /><h3>Comece pelo seu cartão</h3><p>Cadastre um nome, limite, fechamento e vencimento. Não precisamos do número do cartão.</p><button className="button secondary" onClick={onNew}>Cadastrar cartão</button></div>}
    <div className="cards-grid">{cards.map(card => {
      const totals = cardSummary(data, card.id, month);
      const available = Math.max(0, card.limitCents - totals.outstanding);
      return <article className="panel credit-card" key={card.id} aria-label={`Cartão ${card.name}`}>
        <div className="credit-card-heading"><div><CardIcon size={22} /><h3>{card.name}</h3>{card.archived && <span className="neutral-tag">Arquivado</span>}</div><button className="icon-button" aria-label={`Editar cartão: ${card.name}`} onClick={() => onEdit(card)}><Pencil size={17} /></button></div>
        <div className="card-limit"><div><span>Limite disponível</span><strong>{money(available)}</strong></div><small>de {money(card.limitCents)}</small></div>
        <div className="progress-track" role="progressbar" aria-label={`Limite utilizado: ${card.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(totals.outstanding / card.limitCents * 100))}><div style={{ width: `${Math.min(100, totals.outstanding / card.limitCents * 100)}%` }} /></div>
        <p className={totals.outstanding > card.limitCents ? "form-error" : "form-hint"}>{money(totals.outstanding)} em parcelas ainda não pagas{totals.outstanding > card.limitCents ? " · limite ultrapassado" : ""}.</p>
        <div className="card-dates"><span>Fecha dia <strong>{card.closingDay}</strong></span><span>Vence dia <strong>{card.dueDay}</strong></span>{card.reminderDays !== undefined && <span><Bell size={13} />Lembrete ativo</span>}</div>
        <div className="invoice-summary"><span>Fatura com vencimento em {totals.invoice.length ? [...new Set(totals.invoice.map(t => t.date))].sort().map(prettyDate).join(" / ") : prettyDate(dateInMonth(month, card.dueDay))}</span><strong>{money(totals.total)}</strong><small>{totals.pending ? `${money(totals.pending)} a pagar` : totals.total ? "Fatura marcada como paga" : "Nenhuma compra neste mês"}</small></div>
        {!!totals.invoice.length && <ul className="invoice-list">{totals.invoice.map(t => <li key={t.id}><div><strong>{t.description}</strong><small>Parcela {t.installment!.index}/{t.installment!.count} · {t.paid ? "Paga" : "A pagar"}</small></div><span>{money(t.amountCents)}</span></li>)}</ul>}
        <div className="card-actions">{!card.archived && <button className="button secondary" onClick={() => onPurchase(card)}><Plus size={15} />Registrar compra</button>}{totals.pending > 0 && <button className="button primary" onClick={() => onPay(card)}><Check size={15} />Marcar fatura como paga</button>}<button className="text-button" onClick={() => onArchive(card)}><Archive size={14} />{card.archived ? "Reativar cartão" : "Arquivar cartão"}</button></div>
      </article>;
    })}</div>
    <p className="form-hint">O limite é uma estimativa baseada nas compras registradas. As parcelas entram nas despesas do mês do vencimento. Marcar a fatura como paga atualiza essas parcelas, sem criar outro gasto.</p>
  </section>;
}

export function CardForm({ item, onSave, onClose }: { item?: CreditCard; onSave: (card: CreditCard) => boolean; onClose: () => void }) {
  const [name, setName] = useState(item?.name ?? ""), [limit, setLimit] = useState(item ? amountInput(item.limitCents) : "");
  const [closing, setClosing] = useState(String(item?.closingDay ?? 25)), [due, setDue] = useState(String(item?.dueDay ?? 5));
  const [reminder, setReminder] = useState(item?.reminderDays ?? -1), [error, setError] = useState("");
  return <form onSubmit={event => {
    event.preventDefault(); const cents = parseAmount(limit);
    if (!name.trim() || !cents || ![closing, due].every(v => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 31)) { setError("Informe um nome, limite maior que zero e dias de 1 a 31."); return; }
    if (onSave({ ...item, id: item?.id ?? randomId(), name: name.trim(), limitCents: cents, closingDay: Number(closing), dueDay: Number(due), reminderDays: reminder >= 0 ? reminder : undefined })) onClose();
  }}>
    <label>Nome do cartão<input required maxLength={60} placeholder="Ex.: Meu cartão principal" value={name} onChange={e => setName(e.target.value)} /></label>
    <label>Limite do cartão (R$)<input required inputMode="decimal" placeholder="Ex.: 5.000,00" value={limit} onChange={e => setLimit(e.target.value)} /></label>
    <div className="form-grid"><label>Dia de fechamento<input type="number" min={1} max={31} required value={closing} onChange={e => setClosing(e.target.value)} /></label><label>Dia de vencimento<input type="number" min={1} max={31} required value={due} onChange={e => setDue(e.target.value)} /></label></div>
    <label>Lembrete da fatura<select value={reminder} onChange={e => setReminder(Number(e.target.value))}><option value={-1}>Sem lembrete</option><option value={0}>No vencimento, às 9h</option><option value={1}>1 dia antes, às 9h</option><option value={3}>3 dias antes, às 9h</option></select></label>
    <p className="form-hint">Compras no dia do fechamento ou depois entram na próxima fatura. Dias 29, 30 e 31 são ajustados para o último dia de meses menores. Mudanças nos dias valem para novas compras.</p>
    {error && <p className="form-error" role="alert">{error}</p>}<div className="modal-footer"><button className="button secondary" type="button" onClick={onClose}>Cancelar</button><button className="button primary" type="submit">{item ? "Salvar cartão" : "Cadastrar cartão"}</button></div>
  </form>;
}

export function PurchaseForm({ cards, selectedId, onSave, onClose }: { cards: CreditCard[]; selectedId?: string; onSave: (input: PurchaseInput) => boolean; onClose: () => void }) {
  const [cardId, setCardId] = useState(selectedId ?? cards[0]?.id ?? ""), [description, setDescription] = useState("");
  const [amount, setAmount] = useState(""), [count, setCount] = useState("1"), [day, setDay] = useState(dateKey());
  const [category, setCategory] = useState("Compras"), [notes, setNotes] = useState(""), [error, setError] = useState("");
  return <form onSubmit={e => {
    e.preventDefault(); const cents = parseAmount(amount);
    if (!cents || !description.trim() || !validDate(day) || !cards.some(c => c.id === cardId && !c.archived) || !/^\d+$/.test(count) || Number(count) < 1 || Number(count) > 48 || cents < Number(count)) { setError("Escolha um cartão, descrição, valor e de 1 a 48 parcelas de pelo menos R$ 0,01."); return; }
    if (onSave({ cardId, description: description.trim(), amountCents: cents, count: Number(count), date: day, category, notes: notes.trim() })) onClose();
  }}>
    <label>Descrição da compra<input required maxLength={120} placeholder="Ex.: Notebook" value={description} onChange={e => setDescription(e.target.value)} /></label>
    <label>Cartão<select value={cardId} required onChange={e => setCardId(e.target.value)}>{cards.filter(c => !c.archived).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <div className="form-grid"><label>Valor total da compra (R$)<input required inputMode="decimal" placeholder="0,00" value={amount} onChange={e => setAmount(e.target.value)} /></label><label>Número de parcelas<input required type="number" min={1} max={48} value={count} onChange={e => setCount(e.target.value)} /></label></div>
    <label>Data da compra<input required type="date" min="1900-01-01" max="2200-12-31" value={day} onChange={e => setDay(e.target.value)} /></label>
    <label>Categoria<select value={category} onChange={e => setCategory(e.target.value)}>{EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
    <label>Observações <span className="optional">(opcional)</span><textarea maxLength={1000} rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></label>
    <p className="form-hint">As parcelas serão distribuídas pelas faturas e registradas como despesas previstas. A soma mantém exatamente o valor total da compra.</p>
    {error && <p className="form-error" role="alert">{error}</p>}<div className="modal-footer"><button className="button secondary" type="button" onClick={onClose}>Cancelar</button><button className="button primary" type="submit">Registrar compra</button></div>
  </form>;
}

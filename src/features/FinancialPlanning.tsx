import { currencySymbol, parseCurrencyBalance } from "../currency";
import { t as tr, recordText, getLocale } from "../i18n/core";
import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, Check, Clock3, Pencil, Plus, Target, Trash2, TrendingUp, Wallet } from "lucide-react";
import { amountInput, dateKey, money, monthLabel, prettyDate, randomId, validDate } from "../domain";
import type { AppData, FinancialGoal, Transaction } from "../domain";
import { goalProgress, monthlyForecast, upcomingMoney } from "../financial-planning";

export function TodayMoney({ data, today, onEdit, onSettle, onPlanning }: {
  data: AppData; today: string; onEdit: (item: Transaction) => void;
  onSettle: (item: Transaction) => void; onPlanning: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const entries = upcomingMoney(data.transactions, today);
  const due = entries.filter(t => t.type === "expense" && t.date <= today).reduce((sum, t) => sum + t.amountCents, 0);
  return <section className="panel today-money" aria-label={tr("Contas e recebimentos próximos")}>
    <div className="panel-heading"><div className="section-icon sand"><Wallet size={19} /></div><div><h2>{tr("Contas e recebimentos")}</h2><p>{tr("Pendências anteriores, hoje e próximos 7 dias.")}</p></div></div>
    {due > 0 && <p className="money-due"><Clock3 size={16} />{money(due)}{tr(" a pagar até hoje")}</p>}
    {entries.length ? <ul className="money-agenda">{(expanded ? entries : entries.slice(0, 5)).map(t => <li key={t.id}>
      <button className="money-agenda-detail" onClick={() => onEdit(t)} aria-label={tr("Editar {0}: {1}", t.type === "income" ? tr("recebimento") : tr("conta"), recordText(t.id, t.description))}>
        <strong>{recordText(t.id, t.description)}{t.installment && tr(" · {0}/{1}", t.installment.index, t.installment.count)}</strong>
        <small className={t.date < today ? "agenda-overdue" : ""}>{t.date < today ? tr("Em atraso · {0}", prettyDate(t.date)) : t.date === today ? tr("Hoje") : prettyDate(t.date)}{t.installment && tr(" · {0}", data.cards?.find(c => c.id === t.installment?.cardId)?.name ?? tr("Cartão"))}{t.recurrenceId && tr(" · Recorrente")}</small>
        <span className={t.type === "income" ? "positive" : ""}>{t.type === "income" ? tr("+ ") : tr("− ")}{money(t.amountCents)}</span>
      </button>
      <button className="button secondary compact" onClick={() => onSettle(t)} aria-label={tr("{0}: {1}{2}", t.type === "income" ? tr("Receber") : tr("Pagar"), recordText(t.id, t.description), t.installment ? tr(" · {0}/{1}", t.installment.index, t.installment.count) : "")}><Check size={15} />{t.type === "income" ? tr("Receber") : tr("Pagar")}</button>
    </li>)}</ul> : <p className="planning-empty">{tr("Nenhuma conta ou recebimento pendente neste período.")}</p>}
    {entries.length > 5 && <button className="text-button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>{expanded ? tr("Mostrar menos") : tr("Ver todas as {0} pendências", entries.length)}</button>}
    <button className="panel-add" onClick={onPlanning}>{tr("Metas e previsão do mês ")}<ArrowRight size={16} /></button>
  </section>;
}

export function ForecastPanel({ data, month, onOpening }: { data: AppData; month: string; onOpening: () => void }) {
  const forecast = monthlyForecast(data, month);
  return <section className="panel forecast-panel" aria-label={tr("Previsão de saldo")}>
    <div className="panel-heading"><div className="section-icon sage"><TrendingUp size={19} /></div><div><h2>{tr("Previsão de saldo")}</h2><p>{tr("Um plano para ")}{monthLabel(month)}.</p></div></div>
    <p className="planning-explanation">{tr("Informe quanto havia disponível no início do mês. Somamos as receitas e descontamos as despesas desse mês, pagas e previstas, incluindo parcelas.")}</p>
    <div className="forecast-opening"><div><span>{tr("Saldo inicial do mês")}</span><strong>{forecast.configured ? money(forecast.opening) : tr("Ainda não informado")}</strong></div><button className="button secondary" onClick={onOpening}><Pencil size={15} />{forecast.configured ? tr("Editar saldo inicial") : tr("Definir saldo inicial")}</button></div>
    {forecast.configured ? <>
      <div className="forecast-result"><span>{tr("Saldo previsto no fim do mês")}</span><strong className={forecast.closing < 0 ? "negative" : ""}>{money(forecast.closing)}</strong><small>{tr("Saldo inicial + movimentações confirmadas + valores pendentes")}</small></div>
      <dl className="forecast-components"><div><dt>{tr("Resultado já confirmado")}</dt><dd>{money(forecast.confirmed)}</dd></div><div><dt>{tr("A receber no mês")}</dt><dd>{money(forecast.pendingIncome)}</dd></div><div><dt>{tr("A pagar no mês")}</dt><dd>{money(forecast.pendingExpense)}</dd></div><div><dt>{tr("Menor saldo por dia")}</dt><dd className={forecast.lowest < 0 ? "negative" : ""}>{money(forecast.lowest)}<small>{prettyDate(forecast.lowestDate)}</small></dd></div></dl>
      {forecast.lowest < 0 && <p className="planning-warning" role="status"><Clock3 size={17} />{tr("A previsão indica saldo negativo em ")}{prettyDate(forecast.lowestDate)}{tr(". Confira os vencimentos e as receitas previstas.")}</p>}
      {forecast.days.length > 0 && <details className="forecast-details"><summary>{tr("Ver evolução por dia")}</summary><p className="form-hint">{tr("Saldos ao fim de cada dia. Somente datas com movimentações aparecem.")}</p><ol>{forecast.days.map(day => <li key={day.date}><div><strong>{prettyDate(day.date)}</strong><small>{day.count} {day.count === 1 ? tr("movimentação") : tr("movimentações")} · {day.pending} {day.pending === 1 ? tr("prevista") : tr("previstas")}</small><small>{tr("Receitas ")}{money(day.income)}{tr(" · Despesas ")}{money(day.expense)}</small></div><strong className={day.balance < 0 ? "negative" : ""}>{money(day.balance)}</strong></li>)}</ol></details>}
    </> : <p className="planning-empty">{tr("Defina o saldo inicial para calcular quanto pode sobrar e identificar dias de aperto.")}</p>}
    {forecast.overdueOutside > 0 && <p className="planning-warning">{tr("Há ")}{money(forecast.overdueOutside)}{tr(" de despesas pendentes de meses anteriores. Elas aparecem em Hoje e não entram novamente na previsão deste mês. Se o pagamento ocorrer neste mês, ajuste a data da movimentação.")}</p>}
    <p className="form-hint">{tr("Não consulta bancos. As datas e valores cadastrados determinam a estimativa. Metas não alteram o saldo automaticamente. O saldo inicial é informado separadamente para cada mês.")}</p>
  </section>;
}

export function GoalsPanel({ goals, today, onNew, onEdit, onArchive, onDelete }: {
  goals: FinancialGoal[]; today: string; onNew: () => void; onEdit: (goal: FinancialGoal) => void;
  onArchive: (goal: FinancialGoal) => void; onDelete: (goal: FinancialGoal) => void;
}) {
  const [showArchived, setShowArchived] = useState(false);
  const visible = goals.filter(g => showArchived || !g.archived).sort((a, b) => Number(!!a.archived) - Number(!!b.archived) || a.targetDate.localeCompare(b.targetDate));
  return <section className="panel goals-panel" aria-label={tr("Metas financeiras")}>
    <div className="panel-heading"><div className="section-icon lavender"><Target size={19} /></div><div><h2>{tr("Metas financeiras")}</h2><p>{tr("Uma reserva, uma viagem ou um novo começo.")}</p></div></div>
    <button className="button secondary" onClick={onNew}><Plus size={16} />{tr("Nova meta")}</button>
    <p className="planning-explanation">{tr("Atualize o valor guardado conforme você avança. Este acompanhamento não transfere dinheiro nem cria receitas ou despesas.")}</p>
    {goals.some(g => g.archived) && <button className="text-button" aria-pressed={showArchived} onClick={() => setShowArchived(!showArchived)}>{showArchived ? tr("Ocultar arquivadas") : tr("Mostrar arquivadas")}</button>}
    {visible.length ? <div className="goal-list">{visible.map(goal => {
      const progress = goalProgress(goal, today);
      return <article className={`goal-card ${goal.archived ? "archived" : ""}`} key={goal.id} aria-label={tr("Meta {0}", goal.name)}>
        <div className="goal-header"><h3>{goal.name}</h3><span className="neutral-tag">{goal.archived ? tr("Arquivada") : progress.achieved ? tr("Concluída") : progress.overdue ? tr("Prazo vencido") : tr("Em andamento")}</span></div>
        <p><strong>{money(goal.savedCents)}</strong>{tr(" de ")}{money(goal.targetCents)}</p>
        <div className="progress-track" role="progressbar" aria-label={tr("Progresso de {0}", goal.name)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}><span style={{ width: `${progress.percent}%` }} /></div>
        <div className="goal-meta"><span>{tr("{0}% · prazo: {1}", progress.percent, new Date(`${goal.targetDate}T12:00:00`).toLocaleDateString(getLocale(), { day: "numeric", month: "short", year: "numeric" }))}</span><span>{tr("Faltam ")}{money(progress.remaining)}</span></div>
        {!goal.archived && !progress.achieved && <p className="form-hint">{progress.overdue ? tr("Revise o prazo para continuar planejando.") : tr("Sugestão: {0} por mês até o prazo, contando o mês atual.", money(progress.monthlyCents))}</p>}
        {goal.notes && <p className="goal-notes">{goal.notes}</p>}
        <div className="goal-actions"><button className="text-button" onClick={() => onEdit(goal)}><Pencil size={15} />{tr("Atualizar meta")}</button><button className="text-button" onClick={() => onArchive(goal)}>{goal.archived ? tr("Reativar") : tr("Arquivar")}</button><button className="icon-button danger-hover" aria-label={tr("Excluir meta: {0}", goal.name)} onClick={() => onDelete(goal)}><Trash2 size={16} /></button></div>
      </article>;
    })}</div> : <p className="planning-empty">{goals.length ? tr("Suas metas estão arquivadas. Você pode reativá-las quando quiser.") : tr("Crie sua primeira meta e acompanhe o progresso aqui.")}</p>}
  </section>;
}

export function GoalForm({ item, today = dateKey(), onSave, onClose }: { item?: FinancialGoal; today?: string; onSave: (goal: FinancialGoal) => boolean; onClose: () => void }) {
  const [name, setName] = useState(item?.name ?? "");
  const [target, setTarget] = useState(item ? amountInput(item.targetCents) : "");
  const [saved, setSaved] = useState(item ? amountInput(item.savedCents) : amountInput(0));
  const [date, setDate] = useState(item?.targetDate ?? today);
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [error, setError] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    const targetCents = parseCurrencyBalance(target, item?.targetCents), savedCents = parseCurrencyBalance(saved, item?.savedCents);
    if (!name.trim() || targetCents === null || targetCents <= 0 || savedCents === null || savedCents < 0 || !validDate(date)) { setError(tr("Informe nome, valor desejado maior que zero, valor guardado sem sinal negativo e um prazo válido.")); return; }
    if (onSave({ ...item, id: item?.id ?? randomId(), name: name.trim(), targetCents, savedCents, targetDate: date, notes: notes.trim() })) onClose();
  }
  return <form onSubmit={submit}>
    <label>{tr("Nome da meta")}<input autoComplete="off" required maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder={tr("Ex.: reserva de emergência")} /></label>
    <div className="form-row"><label>{tr("Valor desejado ({0})", currencySymbol())}<input inputMode="decimal" required value={target} onChange={e => setTarget(e.target.value)} placeholder={tr("5.000,00")} /></label><label>{tr("Valor guardado ({0})", currencySymbol())}<input inputMode="decimal" required value={saved} onChange={e => setSaved(e.target.value)} /></label></div>
    <label>{tr("Prazo da meta")}<input type="date" required min="1900-01-01" max="2200-12-31" value={date} onChange={e => setDate(e.target.value)} /></label>
    <label>{tr("Observações da meta")}<textarea maxLength={1000} rows={3} value={notes} onChange={e => setNotes(e.target.value)} /></label>
    <p className="form-hint">{tr("Valor guardado é o total que você já separou. Alterá-lo não cria movimentações nem muda sua previsão de saldo.")}</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="modal-footer"><button type="button" className="button secondary" onClick={onClose}>{tr("Cancelar")}</button><button className="button primary" type="submit">{item ? tr("Salvar meta") : tr("Criar meta")}</button></div>
  </form>;
}

export function OpeningBalanceForm({ month, amount, onSave, onClear, onClose }: { month: string; amount?: number; onSave: (amount: number) => boolean; onClear: () => boolean; onClose: () => void }) {
  const [value, setValue] = useState(amount === undefined ? "" : amountInput(amount));
  const [error, setError] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    const cents = parseCurrencyBalance(value, amount);
    if (cents === null) { setError(tr("Informe um valor válido. Use 0,00 para zero ou o sinal − para saldo negativo.")); return; }
    if (onSave(cents)) onClose();
  }
  return <form onSubmit={submit}><label>{tr("Saldo no início de ")}{monthLabel(month)}{tr(" ({0})", currencySymbol())}<input required inputMode="text" autoComplete="off" value={value} onChange={e => setValue(e.target.value)} placeholder={tr("Ex.: 1.500,00 ou -200,00")} /></label>
    <p className="form-hint">{tr("Informe o saldo disponível antes da primeira movimentação do mês. Não inclua novamente as receitas e despesas já cadastradas nesse mês. Zero e valores negativos são aceitos; não é o saldo atual do banco.")}</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    {amount !== undefined && <button type="button" className="text-button" onClick={() => { if (onClear()) onClose(); }}>{tr("Remover saldo inicial deste mês")}</button>}
    <div className="modal-footer"><button type="button" className="button secondary" onClick={onClose}>{tr("Cancelar")}</button><button className="button primary" type="submit">{tr("Salvar saldo inicial")}</button></div>
  </form>;
}

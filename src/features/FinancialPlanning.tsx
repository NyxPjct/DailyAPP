import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, Check, Clock3, Pencil, Plus, Target, Trash2, TrendingUp, Wallet } from "lucide-react";
import { amountInput, dateKey, money, monthLabel, prettyDate, randomId, validDate } from "../domain";
import type { AppData, FinancialGoal, Transaction } from "../domain";
import { goalProgress, monthlyForecast, parseBalanceInput, upcomingMoney } from "../financial-planning";

export function TodayMoney({ data, today, onEdit, onSettle, onPlanning }: {
  data: AppData; today: string; onEdit: (item: Transaction) => void;
  onSettle: (item: Transaction) => void; onPlanning: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const entries = upcomingMoney(data.transactions, today);
  const due = entries.filter(t => t.type === "expense" && t.date <= today).reduce((sum, t) => sum + t.amountCents, 0);
  return <section className="panel today-money" aria-label="Contas e recebimentos próximos">
    <div className="panel-heading"><div className="section-icon sand"><Wallet size={19} /></div><div><h2>Contas e recebimentos</h2><p>Pendências anteriores, hoje e próximos 7 dias.</p></div></div>
    {due > 0 && <p className="money-due"><Clock3 size={16} />{money(due)} a pagar até hoje</p>}
    {entries.length ? <ul className="money-agenda">{(expanded ? entries : entries.slice(0, 5)).map(t => <li key={t.id}>
      <button className="money-agenda-detail" onClick={() => onEdit(t)} aria-label={`Editar ${t.type === "income" ? "recebimento" : "conta"}: ${t.description}`}>
        <strong>{t.description}{t.installment && ` · ${t.installment.index}/${t.installment.count}`}</strong>
        <small className={t.date < today ? "agenda-overdue" : ""}>{t.date < today ? `Em atraso · ${prettyDate(t.date)}` : t.date === today ? "Hoje" : prettyDate(t.date)}{t.installment && ` · ${data.cards?.find(c => c.id === t.installment?.cardId)?.name ?? "Cartão"}`}{t.recurrenceId && " · Recorrente"}</small>
        <span className={t.type === "income" ? "positive" : ""}>{t.type === "income" ? "+ " : "− "}{money(t.amountCents)}</span>
      </button>
      <button className="button secondary compact" onClick={() => onSettle(t)} aria-label={`${t.type === "income" ? "Receber" : "Pagar"}: ${t.description}${t.installment ? ` · ${t.installment.index}/${t.installment.count}` : ""}`}><Check size={15} />{t.type === "income" ? "Receber" : "Pagar"}</button>
    </li>)}</ul> : <p className="planning-empty">Nenhuma conta ou recebimento pendente neste período.</p>}
    {entries.length > 5 && <button className="text-button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>{expanded ? "Mostrar menos" : `Ver todas as ${entries.length} pendências`}</button>}
    <button className="panel-add" onClick={onPlanning}>Metas e previsão do mês <ArrowRight size={16} /></button>
  </section>;
}

export function ForecastPanel({ data, month, onOpening }: { data: AppData; month: string; onOpening: () => void }) {
  const forecast = monthlyForecast(data, month);
  return <section className="panel forecast-panel" aria-label="Previsão de saldo">
    <div className="panel-heading"><div className="section-icon sage"><TrendingUp size={19} /></div><div><h2>Previsão de saldo</h2><p>Um plano para {monthLabel(month)}.</p></div></div>
    <p className="planning-explanation">Informe quanto havia disponível no início do mês. Somamos as receitas e descontamos as despesas desse mês, pagas e previstas, incluindo parcelas.</p>
    <div className="forecast-opening"><div><span>Saldo inicial do mês</span><strong>{forecast.configured ? money(forecast.opening) : "Ainda não informado"}</strong></div><button className="button secondary" onClick={onOpening}><Pencil size={15} />{forecast.configured ? "Editar saldo inicial" : "Definir saldo inicial"}</button></div>
    {forecast.configured ? <>
      <div className="forecast-result"><span>Saldo previsto no fim do mês</span><strong className={forecast.closing < 0 ? "negative" : ""}>{money(forecast.closing)}</strong><small>Saldo inicial + movimentações confirmadas + valores pendentes</small></div>
      <dl className="forecast-components"><div><dt>Resultado já confirmado</dt><dd>{money(forecast.confirmed)}</dd></div><div><dt>A receber no mês</dt><dd>{money(forecast.pendingIncome)}</dd></div><div><dt>A pagar no mês</dt><dd>{money(forecast.pendingExpense)}</dd></div><div><dt>Menor saldo por dia</dt><dd className={forecast.lowest < 0 ? "negative" : ""}>{money(forecast.lowest)}<small>{prettyDate(forecast.lowestDate)}</small></dd></div></dl>
      {forecast.lowest < 0 && <p className="planning-warning" role="status"><Clock3 size={17} />A previsão indica saldo negativo em {prettyDate(forecast.lowestDate)}. Confira os vencimentos e as receitas previstas.</p>}
      {forecast.days.length > 0 && <details className="forecast-details"><summary>Ver evolução por dia</summary><p className="form-hint">Saldos ao fim de cada dia. Somente datas com movimentações aparecem.</p><ol>{forecast.days.map(day => <li key={day.date}><div><strong>{prettyDate(day.date)}</strong><small>{day.count} {day.count === 1 ? "movimentação" : "movimentações"} · {day.pending} {day.pending === 1 ? "prevista" : "previstas"}</small><small>Receitas {money(day.income)} · Despesas {money(day.expense)}</small></div><strong className={day.balance < 0 ? "negative" : ""}>{money(day.balance)}</strong></li>)}</ol></details>}
    </> : <p className="planning-empty">Defina o saldo inicial para calcular quanto pode sobrar e identificar dias de aperto.</p>}
    {forecast.overdueOutside > 0 && <p className="planning-warning">Há {money(forecast.overdueOutside)} de despesas pendentes de meses anteriores. Elas aparecem em Hoje e não entram novamente na previsão deste mês. Se o pagamento ocorrer neste mês, ajuste a data da movimentação.</p>}
    <p className="form-hint">Não consulta bancos. As datas e valores cadastrados determinam a estimativa. Metas não alteram o saldo automaticamente. O saldo inicial é informado separadamente para cada mês.</p>
  </section>;
}

export function GoalsPanel({ goals, today, onNew, onEdit, onArchive, onDelete }: {
  goals: FinancialGoal[]; today: string; onNew: () => void; onEdit: (goal: FinancialGoal) => void;
  onArchive: (goal: FinancialGoal) => void; onDelete: (goal: FinancialGoal) => void;
}) {
  const [showArchived, setShowArchived] = useState(false);
  const visible = goals.filter(g => showArchived || !g.archived).sort((a, b) => Number(!!a.archived) - Number(!!b.archived) || a.targetDate.localeCompare(b.targetDate));
  return <section className="panel goals-panel" aria-label="Metas financeiras">
    <div className="panel-heading"><div className="section-icon lavender"><Target size={19} /></div><div><h2>Metas financeiras</h2><p>Uma reserva, uma viagem ou um novo começo.</p></div></div>
    <button className="button secondary" onClick={onNew}><Plus size={16} />Nova meta</button>
    <p className="planning-explanation">Atualize o valor guardado conforme você avança. Este acompanhamento não transfere dinheiro nem cria receitas ou despesas.</p>
    {goals.some(g => g.archived) && <button className="text-button" aria-pressed={showArchived} onClick={() => setShowArchived(!showArchived)}>{showArchived ? "Ocultar arquivadas" : "Mostrar arquivadas"}</button>}
    {visible.length ? <div className="goal-list">{visible.map(goal => {
      const progress = goalProgress(goal, today);
      return <article className={`goal-card ${goal.archived ? "archived" : ""}`} key={goal.id} aria-label={`Meta ${goal.name}`}>
        <div className="goal-header"><h3>{goal.name}</h3><span className="neutral-tag">{goal.archived ? "Arquivada" : progress.achieved ? "Concluída" : progress.overdue ? "Prazo vencido" : "Em andamento"}</span></div>
        <p><strong>{money(goal.savedCents)}</strong> de {money(goal.targetCents)}</p>
        <div className="progress-track" role="progressbar" aria-label={`Progresso de ${goal.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}><span style={{ width: `${progress.percent}%` }} /></div>
        <div className="goal-meta"><span>{progress.percent}% · até {prettyDate(goal.targetDate)} de {goal.targetDate.slice(0, 4)}</span><span>Faltam {money(progress.remaining)}</span></div>
        {!goal.archived && !progress.achieved && <p className="form-hint">{progress.overdue ? "Revise o prazo para continuar planejando." : `Sugestão: ${money(progress.monthlyCents)} por mês até o prazo, contando o mês atual.`}</p>}
        {goal.notes && <p className="goal-notes">{goal.notes}</p>}
        <div className="goal-actions"><button className="text-button" onClick={() => onEdit(goal)}><Pencil size={15} />Atualizar meta</button><button className="text-button" onClick={() => onArchive(goal)}>{goal.archived ? "Reativar" : "Arquivar"}</button><button className="icon-button danger-hover" aria-label={`Excluir meta: ${goal.name}`} onClick={() => onDelete(goal)}><Trash2 size={16} /></button></div>
      </article>;
    })}</div> : <p className="planning-empty">{goals.length ? "Suas metas estão arquivadas. Você pode reativá-las quando quiser." : "Crie sua primeira meta e acompanhe o progresso aqui."}</p>}
  </section>;
}

export function GoalForm({ item, today = dateKey(), onSave, onClose }: { item?: FinancialGoal; today?: string; onSave: (goal: FinancialGoal) => boolean; onClose: () => void }) {
  const [name, setName] = useState(item?.name ?? "");
  const [target, setTarget] = useState(item ? amountInput(item.targetCents) : "");
  const [saved, setSaved] = useState(item ? amountInput(item.savedCents) : "0,00");
  const [date, setDate] = useState(item?.targetDate ?? today);
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [error, setError] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    const targetCents = parseBalanceInput(target), savedCents = parseBalanceInput(saved);
    if (!name.trim() || targetCents === null || targetCents <= 0 || savedCents === null || savedCents < 0 || !validDate(date)) { setError("Informe nome, valor desejado maior que zero, valor guardado sem sinal negativo e um prazo válido."); return; }
    if (onSave({ ...item, id: item?.id ?? randomId(), name: name.trim(), targetCents, savedCents, targetDate: date, notes: notes.trim() })) onClose();
  }
  return <form onSubmit={submit}>
    <label>Nome da meta<input autoComplete="off" required maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: reserva de emergência" /></label>
    <div className="form-row"><label>Valor desejado (R$)<input inputMode="decimal" required value={target} onChange={e => setTarget(e.target.value)} placeholder="5.000,00" /></label><label>Valor guardado (R$)<input inputMode="decimal" required value={saved} onChange={e => setSaved(e.target.value)} /></label></div>
    <label>Prazo da meta<input type="date" required min="1900-01-01" max="2200-12-31" value={date} onChange={e => setDate(e.target.value)} /></label>
    <label>Observações da meta<textarea maxLength={1000} rows={3} value={notes} onChange={e => setNotes(e.target.value)} /></label>
    <p className="form-hint">Valor guardado é o total que você já separou. Alterá-lo não cria movimentações nem muda sua previsão de saldo.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="modal-footer"><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button className="button primary" type="submit">{item ? "Salvar meta" : "Criar meta"}</button></div>
  </form>;
}

export function OpeningBalanceForm({ month, amount, onSave, onClear, onClose }: { month: string; amount?: number; onSave: (amount: number) => boolean; onClear: () => boolean; onClose: () => void }) {
  const [value, setValue] = useState(amount === undefined ? "" : amountInput(amount));
  const [error, setError] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    const cents = parseBalanceInput(value);
    if (cents === null) { setError("Informe um valor válido. Use 0,00 para zero ou o sinal − para saldo negativo."); return; }
    if (onSave(cents)) onClose();
  }
  return <form onSubmit={submit}><label>Saldo no início de {monthLabel(month)} (R$)<input required inputMode="text" autoComplete="off" value={value} onChange={e => setValue(e.target.value)} placeholder="Ex.: 1.500,00 ou -200,00" /></label>
    <p className="form-hint">Informe o saldo disponível antes da primeira movimentação do mês. Não inclua novamente as receitas e despesas já cadastradas nesse mês. Zero e valores negativos são aceitos; não é o saldo atual do banco.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    {amount !== undefined && <button type="button" className="text-button" onClick={() => { if (onClear()) onClose(); }}>Remover saldo inicial deste mês</button>}
    <div className="modal-footer"><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button className="button primary" type="submit">Salvar saldo inicial</button></div>
  </form>;
}

import { useState } from "react";
import { ArrowRightLeft, Archive, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { accountBalance, ACCOUNT_KINDS, categorySpending, monthlyReport, quickExpenses } from "../finance-tools";
import { amountInput, dateKey, EXPENSE_CATEGORIES, money, monthLabel, prettyDate, randomId, validDate } from "../domain";
import type { AppData, Transaction, Transfer, WalletAccount } from "../domain";
import { currencySymbol, parseCurrencyAmount, parseCurrencyBalance } from "../currency";
import { getLocale, recordText, t as tr } from "../i18n/core";

export function AccountSelect({ accounts, value, onChange }: { accounts: WalletAccount[]; value: string; onChange: (value:string)=>void }) {
  return <label>{tr("Conta da movimentação")}<select aria-label={tr("Conta da movimentação")} value={value} onChange={e=>onChange(e.target.value)}><option value="">{tr("Sem conta")}</option>{accounts.filter(a=>!a.archived || a.id===value).map(a=><option value={a.id} key={a.id}>{a.name}{a.archived ? ` · ${tr("Arquivada")}` : ""}</option>)}</select></label>;
}
export function AccountsPanel({ data, today, month, onNew, onEdit, onArchive, onTransfer, onDeleteTransfer }: {
  data: AppData; today:string; month:string; onNew:()=>void; onEdit:(a:WalletAccount)=>void; onArchive:(a:WalletAccount)=>void; onTransfer:(t?:Transfer)=>void; onDeleteTransfer:(t:Transfer)=>void;
}) {
  const [showArchived,setShowArchived]=useState(false);
  const accounts=data.accounts??[], total=accounts.reduce((sum,a)=>sum+accountBalance(data,a,today),0);
  const names=new Map(accounts.map(a=>[a.id,a.name]));
  const transfers=(data.transfers??[]).filter(t=>t.date.startsWith(month)).sort((a,b)=>b.date.localeCompare(a.date));
  const unassigned=data.transactions.filter(t=>!t.accountId).length;
  return <div className="v12-stack">
    <section className="panel v12-panel"><div className="planning-heading"><div><h2>{tr("Contas e carteiras")}</h2><p>{tr("Saldo registrado até {0}",prettyDate(today))}</p></div><button className="button primary" onClick={onNew}><Plus size={16}/>{tr("Nova conta")}</button></div>
      <div className="wallet-total"><span>{tr("Total das contas, incluindo arquivadas")}</span><strong>{money(total)}</strong></div>
      <p className="form-hint">{tr("Os saldos usam o valor inicial e os registros confirmados desde essa data. Não consultamos bancos. Valores pendentes não alteram o saldo.")}</p>
      {unassigned>0&&<p className="planning-warning">{tr("{0} movimentações estão sem conta. Edite cada registro para vinculá-lo; o histórico foi preservado.",unassigned)}</p>}
      {accounts.some(a=>a.archived)&&<button className="text-button" aria-pressed={showArchived} onClick={()=>setShowArchived(!showArchived)}>{showArchived?tr("Ocultar arquivadas"):tr("Mostrar arquivadas")}</button>}
      <div className="wallet-grid">{accounts.filter(a=>showArchived||!a.archived).map(a=><article className="wallet-card" key={a.id} aria-label={tr("Conta {0}",a.name)}>
        <div className="planning-heading"><h3><Wallet size={17}/>{a.name}</h3><button className="icon-button" aria-label={tr("Editar conta: {0}",a.name)} onClick={()=>onEdit(a)}><Pencil size={16}/></button></div>
        <small>{tr(ACCOUNT_KINDS[a.kind])}{a.archived?` · ${tr("Arquivada")}`:""}</small><strong className="wallet-balance">{money(accountBalance(data,a,today))}</strong>
        <small>{tr("Saldo inicial em {0}: {1}",prettyDate(a.openingDate),money(a.openingCents))}</small>
        <button className="text-button" onClick={()=>onArchive(a)}><Archive size={14}/>{a.archived?tr("Reativar conta"):tr("Arquivar conta")}</button>
      </article>)}</div>
      {!accounts.length&&<p className="planning-empty">{tr("Cadastre banco, dinheiro ou poupança para acompanhar seus saldos.")}</p>}
    </section>
    <section className="panel v12-panel"><div className="planning-heading"><h2>{tr("Transferências entre contas")}</h2><button className="button secondary" disabled={accounts.filter(a=>!a.archived).length<2} onClick={()=>onTransfer()}><ArrowRightLeft size={16}/>{tr("Nova transferência")}</button></div>
      <p className="form-hint">{tr("Transferências movimentam as contas e não entram em receitas, despesas ou orçamentos.")}</p>
      {transfers.length?<ul className="v12-list">{transfers.map(t=><li key={t.id}><div><strong>{names.get(t.fromAccountId)} → {names.get(t.toAccountId)}</strong><small>{prettyDate(t.date)}{t.notes?` · ${t.notes}`:""}</small></div><strong>{money(t.amountCents)}</strong><button className="icon-button" aria-label={tr("Editar transferência: {0}",t.id)} onClick={()=>onTransfer(t)}><Pencil size={15}/></button><button className="icon-button" aria-label={tr("Excluir transferência: {0}",t.id)} onClick={()=>onDeleteTransfer(t)}><Trash2 size={15}/></button></li>)}</ul>:<p className="planning-empty">{tr("Nenhuma transferência neste mês.")}</p>}
    </section>
  </div>;
}
export function AccountForm({item,onSave,onClose}:{item?:WalletAccount;onSave:(a:WalletAccount)=>boolean;onClose:()=>void}) {
  const [name,setName]=useState(item?.name??""),[kind,setKind]=useState<WalletAccount["kind"]>(item?.kind??"bank");
  const [opening,setOpening]=useState(amountInput(item?.openingCents??0)),[date,setDate]=useState(item?.openingDate??dateKey()),[error,setError]=useState("");
  return <form onSubmit={e=>{e.preventDefault();const cents=parseCurrencyBalance(opening,item?.openingCents);if(!name.trim()||cents===null||!validDate(date)){setError(tr("Informe nome, saldo inicial e uma data válida."));return;}if(onSave({...item,id:item?.id??randomId(),name:name.trim(),kind,openingCents:cents,openingDate:date}))onClose();}}>
    <label>{tr("Nome da conta")}<input required maxLength={60} value={name} onChange={e=>setName(e.target.value)}/></label>
    <label>{tr("Tipo de conta")}<select aria-label={tr("Tipo de conta")} value={kind} onChange={e=>setKind(e.target.value as WalletAccount["kind"])}>{Object.entries(ACCOUNT_KINDS).map(([k,label])=><option key={k} value={k}>{tr(label)}</option>)}</select></label>
    <div className="form-grid"><label>{tr("Saldo inicial ({0})",currencySymbol())}<input inputMode="decimal" required value={opening} onChange={e=>setOpening(e.target.value)}/></label><label>{tr("Data do saldo inicial")}<input type="date" min="1900-01-01" max="2200-12-31" required value={date} onChange={e=>setDate(e.target.value)}/></label></div>
    <p className="form-hint">{tr("Informe o saldo antes das movimentações vinculadas a partir dessa data. Não inclua novamente valores já registrados. Alterar o saldo inicial recalcula o histórico da conta.")}</p>
    {error&&<p role="alert" className="form-error">{error}</p>}<div className="modal-footer"><button type="button" className="button secondary" onClick={onClose}>{tr("Cancelar")}</button><button className="button primary" type="submit">{tr("Salvar conta")}</button></div>
  </form>;
}
export function TransferForm({item,accounts,onSave,onClose}:{item?:Transfer;accounts:WalletAccount[];onSave:(t:Transfer)=>boolean;onClose:()=>void}) {
  const eligible=accounts.filter(a=>!a.archived||a.id===item?.fromAccountId||a.id===item?.toAccountId);
  const [from,setFrom]=useState(item?.fromAccountId??eligible[0]?.id??""),[to,setTo]=useState(item?.toAccountId??eligible[1]?.id??"");
  const [amount,setAmount]=useState(item?amountInput(item.amountCents):""),[day,setDay]=useState(item?.date??dateKey()),[notes,setNotes]=useState(item?.notes??""),[error,setError]=useState("");
  return <form onSubmit={e=>{e.preventDefault();const cents=parseCurrencyAmount(amount,item?.amountCents);if(!cents||from===to||!validDate(day)||day>dateKey()||!accounts.some(a=>a.id===from&&day>=a.openingDate)||!accounts.some(a=>a.id===to&&day>=a.openingDate)){setError(tr("Escolha contas diferentes, valor positivo e uma data entre o início das contas e hoje."));return;}if(onSave({id:item?.id??randomId(),fromAccountId:from,toAccountId:to,amountCents:cents,date:day,notes:notes.trim()}))onClose();}}>
    {[[tr("Conta de origem"),from,setFrom],[tr("Conta de destino"),to,setTo]].map(([label,value,setter])=><label key={String(label)}>{String(label)}<select aria-label={String(label)} value={String(value)} onChange={e=>(setter as (v:string)=>void)(e.target.value)}>{eligible.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>)}
    <label>{tr("Valor da transferência ({0})",currencySymbol())}<input required inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>{tr("Data da transferência")}<input type="date" min="1900-01-01" max={dateKey()} required value={day} onChange={e=>setDay(e.target.value)}/></label>
    <label>{tr("Observações")}<textarea maxLength={1000} value={notes} onChange={e=>setNotes(e.target.value)}/></label>{error&&<p role="alert" className="form-error">{error}</p>}<div className="modal-footer"><button type="button" className="button secondary" onClick={onClose}>{tr("Cancelar")}</button><button type="submit" className="button primary">{tr("Salvar transferência")}</button></div>
  </form>;
}
export function CategoryBudgetsPanel({data,month,onEdit}:{data:AppData;month:string;onEdit:()=>void}) {
  const rows=categorySpending(data,month);
  return <section className="panel v12-panel category-limits"><div className="planning-heading"><h2>{tr("Orçamento por categoria")}</h2><button className="button secondary" onClick={onEdit}>{tr("Definir limites")}</button></div><p className="form-hint">{tr("Inclui despesas pagas e previstas, com parcelas. Os avisos aparecem no app a partir de 80% e 100% do limite. Não são notificações do sistema.")}</p>
    <div className="category-budget-grid">{rows.map(r=><article key={r.category} aria-label={tr("Limite de {0}",tr(r.category))}><div className="planning-heading"><strong>{tr(r.category)}</strong><span>{money(r.spent)}</span></div><small>{r.limit===undefined?tr("Sem limite"):tr("Limite: {0}",money(r.limit))}</small>{r.limit!==undefined&&<><div className="progress-track" role="progressbar" aria-label={tr("Uso do limite de {0}",tr(r.category))} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100,r.percent)}><span style={{width:`${Math.min(100,r.percent)}%`}}/></div><p className={r.percent>=80?"budget-alert":"form-hint"}>{r.percent>=100?tr("Limite atingido ou ultrapassado"):r.percent>=80?tr("Atenção: pelo menos 80% do limite usado"):tr("Disponível: {0}",money(r.remaining!))}</p></>}</article>)}</div>
  </section>;
}
export function CategoryBudgetForm({data,month,onSave,onClose}:{data:AppData;month:string;onSave:(limits:Record<string,number>)=>boolean;onClose:()=>void}) {
  const old=data.categoryBudgets?.[month]??{};const [values,setValues]=useState<Record<string,string>>(()=>Object.fromEntries(EXPENSE_CATEGORIES.map(c=>[c,old[c]?amountInput(old[c]):""]))),[error,setError]=useState("");
  return <form onSubmit={e=>{e.preventDefault();const limits:Record<string,number>={};for(const category of EXPENSE_CATEGORIES){if(!values[category].trim())continue;const cents=parseCurrencyAmount(values[category],old[category]);if(!cents){setError(tr("Informe limites positivos ou deixe o campo vazio para remover."));return;}limits[category]=cents;}if(onSave(limits))onClose();}}><p className="form-hint">{tr("Cada mês tem seus próprios limites. Deixe vazio para remover um limite; o orçamento total do mês continua separado.")}</p><div className="form-grid">{EXPENSE_CATEGORIES.map(c=><label key={c}>{tr("{0} ({1})",tr(c),currencySymbol())}<input inputMode="decimal" value={values[c]} onChange={e=>setValues({...values,[c]:e.target.value})}/></label>)}</div>{error&&<p role="alert" className="form-error">{error}</p>}<div className="modal-footer"><button type="button" className="button secondary" onClick={onClose}>{tr("Cancelar")}</button><button type="submit" className="button primary">{tr("Salvar limites")}</button></div></form>;
}
export function ReportPanel({data,month}:{data:AppData;month:string}) {
  const report=monthlyReport(data,month),{current,previous}=report;
  return <section className="panel v12-panel monthly-report"><h2>{tr("Relatório mensal")}</h2><p>{monthLabel(month)}</p><p className="form-hint">{tr("Receitas e despesas confirmadas pela data registrada. Transferências e saldos iniciais ficam fora do resultado mensal. O mês atual pode estar incompleto.")}</p>
    <div className="report-grid">{[[tr("Receitas recebidas"),current.income],[tr("Despesas pagas"),current.expense],[tr("Resultado do mês"),current.balance]].map(([label,value])=><div key={String(label)}><span>{label}</span><strong>{money(Number(value))}</strong></div>)}</div>
    <h3>{tr("Comparação com o mês anterior")}</h3>{report.hasPrevious?<><p>{tr("Despesas anteriores: {0}",money(previous.expense))}</p><p>{report.expenseChange===0?tr("As despesas confirmadas ficaram iguais."):report.expenseChange>0?tr("Você gastou {0} a mais.",money(report.expenseChange)):tr("Você gastou {0} a menos.",money(-report.expenseChange))}{report.changePercent!==null?` (${Math.abs(report.changePercent).toLocaleString(getLocale(),{maximumFractionDigits:1})}%)`:""}</p></>:<p className="planning-empty">{tr("Sem registros no mês anterior para comparar.")}</p>}
    <h3>{tr("Maiores gastos confirmados")}</h3>{report.top.length?<ol className="v12-list">{report.top.map(t=><li key={t.id}><div><strong>{recordText(t.id,t.description)}</strong><small>{tr(t.category)} · {prettyDate(t.date)}</small></div><strong>{money(t.amountCents)}</strong></li>)}</ol>:<p>{tr("Nenhuma despesa confirmada neste mês.")}</p>}
    <h3>{tr("Categorias acima do limite")}</h3>{report.exceeded.length?<ul className="v12-list">{report.exceeded.map(r=><li key={r.category}><span>{tr(r.category)}</span><strong>{tr("{0} acima",money(r.spent-r.limit!))}</strong></li>)}</ul>:<p>{tr("Nenhuma categoria ultrapassou um limite definido.")}</p>}
  </section>;
}
export function QuickExpenses({data,onSelect}:{data:AppData;onSelect:(t:Transaction)=>void}) {
  const items=quickExpenses(data.transactions);if(!items.length)return null;
  return <section className="panel v12-panel quick-expenses"><h2>{tr("Gastos frequentes")}</h2><p className="form-hint">{tr("Abra um modelo com o último valor e revise antes de salvar. Nenhum gasto é criado ao tocar no atalho.")}</p><div className="quick-expense-buttons">{items.map(t=><button className="button secondary" key={t.id} onClick={()=>onSelect(t)}><Plus size={14}/>{recordText(t.id,t.description)} · {money(t.amountCents)}</button>)}</div></section>;
}

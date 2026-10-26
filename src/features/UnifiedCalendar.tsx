import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CalendarDays, Plus } from "lucide-react";
import type { AppData, Task, Transaction } from "../domain";
import { dateKey, money, parseDate, sortTasks } from "../domain";
import { getLocale, recordText, t as tr } from "../i18n/core";

export function UnifiedCalendar({data,month,today,selectedDate,monthControl,onToday,onDate,renderTask,onNewTask,onNewTransaction,onEditTransaction,onSettle}:{data:AppData;month:string;today:string;selectedDate:string;monthControl:ReactNode;onToday:()=>void;onDate:(date:string)=>void;renderTask:(task:Task)=>ReactNode;onNewTask:()=>void;onNewTransaction:()=>void;onEditTransaction:(t:Transaction)=>void;onSettle:(t:Transaction)=>void}) {
  const [filter,setFilter]=useState("all"),[pending,setPending]=useState(false);
  const days=useMemo(()=>{
    const result=new Map<string,{tasks:Task[];transactions:Transaction[]}>();
    const get=(date:string)=>{if(!result.has(date))result.set(date,{tasks:[],transactions:[]});return result.get(date)!;};
    if(filter!=="money")for(const task of data.tasks)if(!pending||!task.completed)get(task.date).tasks.push(task);
    if(filter!=="tasks")for(const t of data.transactions)if(!pending||!t.paid)get(t.date).transactions.push(t);
    return result;
  },[data.tasks,data.transactions,filter,pending]);
  const selected=days.get(selectedDate)??{tasks:[],transactions:[]};
  const income=selected.transactions.filter(t=>t.type==="income").reduce((sum,t)=>sum+t.amountCents,0);
  const expense=selected.transactions.filter(t=>t.type==="expense").reduce((sum,t)=>sum+t.amountCents,0);
  return <div className="agenda-grid unified-calendar">
    <section className="panel calendar-panel"><div className="calendar-toolbar">{monthControl}<button className="button secondary compact" onClick={onToday}>{tr("Hoje")}</button></div>
      <div className="calendar-filters"><label>{tr("Mostrar na agenda")}<select aria-label={tr("Mostrar na agenda")} value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">{tr("Tarefas e finanças")}</option><option value="tasks">{tr("Somente tarefas")}</option><option value="money">{tr("Somente finanças")}</option></select></label><label className="calendar-pending"><input type="checkbox" checked={pending} onChange={e=>setPending(e.target.checked)}/>{tr("Somente pendentes")}</label></div>
      <div className="calendar-weekdays">{Array.from({length:7},(_,i)=>new Date(2026,0,4+i,12).toLocaleDateString(getLocale(),{weekday:"short"}).replace(/\.$/,"").toLocaleUpperCase(getLocale())).map((day,i)=><span key={i}>{day}</span>)}</div>
      <div className="calendar-grid">{Array.from({length:42},(_,i)=>{
        const first=parseDate(`${month}-01`),day=new Date(first.getFullYear(),first.getMonth(),i-first.getDay()+1),key=dateKey(day);
        const {tasks,transactions}=days.get(key)??{tasks:[],transactions:[]};
        const shown=Math.min(tasks.length,transactions.length?1:2)+Math.min(transactions.length,1);
        const labelDate=day.toLocaleDateString(getLocale(),{day:"numeric",month:"long"});
        return <button key={key} aria-label={transactions.length?tr("{0}, {1} tarefas, {2} movimentações",labelDate,tasks.length,transactions.length):tr("{0}, {1} tarefas",labelDate,tasks.length)} aria-pressed={key===selectedDate} className={`calendar-day ${!key.startsWith(month)?"outside-month":""} ${key===today?"is-today":""} ${key===selectedDate?"is-selected":""}`} onClick={()=>onDate(key)}>
          <span className="day-number">{day.getDate()}</span><div className="calendar-task-labels">{tasks.slice(0,transactions.length?1:2).map(t=><span key={t.id} className={t.completed?"done":""}>{recordText(t.id,t.title)}</span>)}{transactions.slice(0,1).map(t=><span key={t.id} className={`calendar-money-label ${t.type}`}>{t.type==="expense"?"−":"+"} {money(t.amountCents)}</span>)}{tasks.length+transactions.length>shown&&<small>+{tasks.length+transactions.length-shown}</small>}</div>
          <div className="calendar-dots">{tasks.slice(0,2).map(t=><i key={t.id} className={t.completed?"done":""}/>)}{transactions.slice(0,2).map(t=><i key={t.id} className={`money-dot ${t.type} ${t.paid?"settled":""}`}/>)}</div>
        </button>;
      })}</div>
      <div className="calendar-legend"><span><i className="legend-dot income-dot"/>{tr("Tarefa pendente")}</span><span><i className="legend-dot completed-dot"/>{tr("Concluída")}</span><span><i className="legend-dot calendar-expense-dot"/>{tr("Despesa")}</span><span><i className="legend-dot calendar-income-dot"/>{tr("Receita")}</span></div>
      <p className="calendar-explanation">{tr("Receitas, contas e parcelas aparecem pela data registrada. Confirmar não cria outro lançamento. Transferências internas não entram nos totais do dia.")}</p>
    </section>
    <section className="panel agenda-day-panel"><div className="panel-heading"><div className="section-icon sage"><CalendarDays size={19}/></div><div><h2>{parseDate(selectedDate).toLocaleDateString(getLocale(),{day:"numeric",month:"long"})}</h2><p>{parseDate(selectedDate).toLocaleDateString(getLocale(),{weekday:"long"})}</p></div></div>
      {filter!=="money"&&<div className="calendar-day-tasks"><h3>{tr("Tarefas")}</h3>{selected.tasks.length?<div className="task-list">{sortTasks(selected.tasks).map(renderTask)}</div>:<p className="planning-empty">{tr("Nenhuma tarefa neste filtro para este dia.")}</p>}<button className="panel-add" onClick={onNewTask}><Plus size={16}/>{tr("Adicionar neste dia")}</button></div>}
      {filter!=="tasks"&&<div className="calendar-day-money"><h3>{tr("Finanças do dia")}</h3><div className="calendar-day-totals"><span>{tr("Receitas: {0}",money(income))}</span><span>{tr("Despesas: {0}",money(expense))}</span></div><p className="form-hint">{tr("Totais deste filtro, incluindo valores confirmados e previstos.")}</p>
        {selected.transactions.length?<ul className="calendar-money-list">{[...selected.transactions].sort((a,b)=>Number(a.paid)-Number(b.paid)||a.description.localeCompare(b.description)).map(t=><li key={t.id}><button className="calendar-money-edit" aria-label={tr("Editar movimentação: {0}",recordText(t.id,t.description))} onClick={()=>onEditTransaction(t)}><strong>{recordText(t.id,t.description)}{t.installment?` · ${t.installment.index}/${t.installment.count}`:""}</strong><span>{tr(t.category)}{t.installment?` · ${data.cards?.find(c=>c.id===t.installment?.cardId)?.name??tr("Cartão")}`:""}</span><small>{t.paid?tr(t.type==="income"?"Recebida":"Paga"):tr("Prevista")}{!t.paid&&t.date<today?` · ${tr("Vencida")}`:""}</small></button><strong>{t.type==="expense"?"−":"+"}{money(t.amountCents)}</strong>{!t.paid&&<button className="button secondary compact" aria-label={tr("Confirmar movimentação: {0}",recordText(t.id,t.description))} onClick={()=>onSettle(t)}>{tr(t.type==="income"?"Receber":"Pagar")}</button>}</li>)}</ul>:<p className="planning-empty">{tr("Nenhuma movimentação neste filtro para este dia.")}</p>}
        <button className="panel-add" onClick={onNewTransaction}><Plus size={16}/>{tr("Adicionar movimentação neste dia")}</button>
      </div>}
    </section>
  </div>;
}

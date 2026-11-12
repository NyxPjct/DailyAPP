import { normalize, parseDate } from "./domain";
import type { AppData } from "./domain";
import { getLocale, recordText, t as tr } from "./i18n/core";
import { getCurrency, toDisplayCents } from "./currency";
import { ACCOUNT_KINDS } from "./finance-tools";

export type SearchKind="task"|"transaction"|"account"|"goal"|"card"|"transfer";
export interface SearchResult {kind:SearchKind;id:string;title:string;detail:string;date:string;archived:boolean;notes:string;fields:string[]}
export const SEARCH_KINDS={task:"Tarefas",transaction:"Movimentações",account:"Contas",goal:"Metas",card:"Cartões e parcelas",transfer:"Transferências entre contas"} as const;
export function searchRecords(data:AppData,query:string,kind:SearchKind|"all"="all",notesOnly=false,limit=40){
  const terms=normalize(query.trim().slice(0,120)).split(/\s+/).filter(Boolean);
  if(query.trim().length<2||!terms.length)return {items:[] as SearchResult[],total:0};
  const numbers=new Intl.NumberFormat(getLocale(),{style:"currency",currency:getCurrency()}),dates=new Intl.DateTimeFormat(getLocale(),{day:"2-digit",month:"short"});
  const money=(cents:number)=>numbers.format(toDisplayCents(cents)/100),dateCache=new Map<string,string>();
  const prettyDate=(date:string)=>{if(!dateCache.has(date))dateCache.set(date,dates.format(parseDate(date)).replace(".",""));return dateCache.get(date)!;};
  const names=new Map(data.accounts?.map(a=>[a.id,a.name]));
  const results:SearchResult[]=[];
  const add=(result:SearchResult)=>{
    if(kind!=="all"&&kind!==result.kind)return;
    const text=normalize(notesOnly?result.notes:[result.title,result.detail,result.notes,result.date,result.date?prettyDate(result.date):"",...result.fields].join(" "));
    if(terms.every(term=>text.includes(term)))results.push(result);
  };
  for(const t of data.tasks)add({kind:"task",id:t.id,title:recordText(t.id,t.title),detail:`${tr(t.category)} · ${tr(t.completed?"Concluída":"Pendente")}`,date:t.date,archived:false,notes:t.notes,fields:[t.title,t.time,tr(t.priority),...(t.subtasks?.map(c=>c.title)??[])]});
  for(const t of data.transactions)add({kind:"transaction",id:t.id,title:recordText(t.id,t.description),detail:`${money(t.amountCents)} · ${tr(t.type==="income"?"Receita":"Despesa")} · ${tr(t.paid?t.type==="income"?"Recebida":"Paga":"Prevista")}`,date:t.date,archived:false,notes:t.notes,fields:[t.description,tr(t.category),names.get(t.accountId??"")??"",data.cards?.find(c=>c.id===t.installment?.cardId)?.name??""]});
  for(const a of data.accounts??[])add({kind:"account",id:a.id,title:a.name,detail:tr(ACCOUNT_KINDS[a.kind]),date:a.openingDate,archived:!!a.archived,notes:"",fields:[tr(a.archived?"Arquivada":"Ativa")]});
  for(const g of data.goals??[])add({kind:"goal",id:g.id,title:g.name,detail:money(g.targetCents),date:g.targetDate,archived:!!g.archived,notes:g.notes,fields:[tr(g.archived?"Arquivada":"Ativa")]});
  for(const c of data.cards??[])add({kind:"card",id:c.id,title:c.name,detail:tr("Limite: {0}",money(c.limitCents)),date:"",archived:!!c.archived,notes:"",fields:[tr(c.archived?"Arquivada":"Ativa")]});
  for(const t of data.transfers??[])add({kind:"transfer",id:t.id,title:`${names.get(t.fromAccountId)??""} → ${names.get(t.toAccountId)??""}`,detail:money(t.amountCents),date:t.date,archived:false,notes:t.notes,fields:[]});
  const needle=normalize(query.trim());
  const rank=(r:SearchResult)=>normalize(r.title)===needle?0:normalize(r.title).startsWith(needle)?1:2;
  results.sort((a,b)=>rank(a)-rank(b)||b.date.localeCompare(a.date)||a.title.localeCompare(b.title,getLocale())||a.id.localeCompare(b.id));
  return {items:results.slice(0,Math.max(1,Math.min(100,limit))),total:results.length};
}

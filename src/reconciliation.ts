import { dateKey, normalize } from "./domain";
import type { AppData, Transaction } from "./domain";

export const statementKeys = (t:Transaction):string[] => [...new Set([...(t.statementKey?[t.statementKey]:[]),...(t.statementKeys??[])])];
export function statementOwners(transactions:Transaction[]) {
  const owners=new Map<string,Set<string>>();
  for(const t of transactions)for(const key of statementKeys(t)){if(!owners.has(key))owners.set(key,new Set());owners.get(key)!.add(t.id);}
  return owners;
}
const day = (date:string) => Date.parse(`${date}T12:00:00Z`)/86400000;
const bucket = (t:Transaction) => `${t.type}:${t.amountCents}`;
export function reconciliationIndex(data:AppData) {
  const result=new Map<string,Transaction[]>();
  for(const t of data.transactions)if(!t.paid){const key=bucket(t);if(!result.has(key))result.set(key,[]);result.get(key)!.push(t);}
  return result;
}
export function canReconcile(data:AppData,source:Transaction,target:Transaction) {
  const accountId=source.accountId??target.accountId;
  return source.paid && source.date<=dateKey() && !target.paid && source.type===target.type && source.amountCents===target.amountCents &&
    Math.abs(day(source.date)-day(target.date))<=7 && (!source.accountId||!target.accountId||source.accountId===target.accountId) &&
    (!accountId||!!data.accounts?.some(a=>a.id===accountId&&!a.archived&&source.date>=a.openingDate));
}
export function reconciliationCandidates(data:AppData,source:Transaction,index=reconciliationIndex(data)) {
  if(!source.paid||source.date>dateKey())return [];
  return (index.get(bucket(source))??[]).filter(t=>canReconcile(data,source,t)).sort((a,b)=>
    Number(normalize(b.description)===normalize(source.description))-Number(normalize(a.description)===normalize(source.description)) ||
    Math.abs(day(a.date)-day(source.date))-Math.abs(day(b.date)-day(source.date)) || a.id.localeCompare(b.id)).slice(0,10);
}

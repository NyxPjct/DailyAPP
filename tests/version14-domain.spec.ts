import { test, expect } from '@playwright/test';
import { freshData, validateData } from '../src/domain';
import type { AppData, Transaction } from '../src/domain';
import { applyStatementImport, csvStatement, guessMapping, readCsv, reviewStatement } from '../src/statement-import';
import { canReconcile, statementKeys } from '../src/reconciliation';
import { searchRecords, SEARCH_KINDS } from '../src/global-search';
import { LANGUAGES, setCurrentLanguage, translate } from '../src/i18n/core';
import { setCurrentCurrency } from '../src/currency';
import { repeatingTransaction } from '../src/planning';
const transaction=(id='planned',date='2026-11-10'):Transaction=>({id,description:'Energy bill',date,amountCents:9990,type:'expense',category:'Moradia',paid:false,notes:'Invoice INV-14'});
const base=():AppData=>({...freshData(),transactions:[transaction()],accounts:[{id:'bank',name:'Energy Bank',kind:'bank',openingCents:100000,openingDate:'2026-11-01'},{id:'cash',name:'Cash',kind:'cash',openingCents:0,openingDate:'2026-11-01'}]});
const statement=(date='2026-11-12')=>{const table=readCsv(`Date;Description;Amount;ID\n${date};BANK ENERGY DEBIT;-99.90;bank-entry-14`);return csvStatement(table,guessMapping(table.headers),'DMY','.');};
const drafts=(data=base(),account?:string)=>reviewStatement(statement(),data,'BRL',account);
const matched=(data=base(),account?:string)=>drafts(data,account).map(d=>({...d,match:d.matches![0],selected:true}));
test.beforeEach(()=>{setCurrentLanguage('en');setCurrentCurrency('BRL');});

test('matching suggestions require an unpaid compatible entry with equal amount/type and at most seven days difference',()=>{
 const data=base();const source=drafts(data)[0].transaction;expect(canReconcile(data,source,data.transactions[0])).toBe(true);
 for(const bad of [{...transaction(),paid:true},{...transaction(),type:'income' as const},{...transaction(),amountCents:9991},transaction('far','2026-11-04'),{...transaction(),accountId:'cash'}])expect(canReconcile(data,{...source,accountId:'bank'},bad)).toBe(false);
 expect(canReconcile(data,source,transaction('edge','2026-11-05'))).toBe(true);expect(canReconcile(data,source,transaction('early','2026-11-19'))).toBe(true);
 expect(()=>drafts({...data,accounts:[{...data.accounts![0],archived:true}]},'bank')).toThrow();
});
test('review never chooses a match automatically and explicit confirmation preserves identity, category, notes and amount',()=>{
 const data=base(),before=JSON.stringify(data),review=drafts(data,'bank');expect(review[0].selected).toBe(false);expect(review[0].match).toBeUndefined();expect(review[0].matches?.map(t=>t.id)).toEqual(['planned']);expect(JSON.stringify(data)).toBe(before);
 const result=applyStatementImport(data,matched(data,'bank'));expect(result.transactions).toHaveLength(1);expect(result.transactions[0]).toMatchObject({...transaction(),paid:true,date:'2026-11-12',accountId:'bank'});expect(result.transactions[0].statementKey).toMatch(/^[a-f0-9]{64}$/);expect(JSON.stringify(data)).toBe(before);
});
test('payment keeps recurring and installment metadata and marks only the selected occurrence paid',()=>{
 const recurring=validateData(repeatingTransaction(base(),{...transaction('recurring'),accountId:'bank'},'monthly','2026-11-12'));const d=drafts(recurring,'bank')[0];d.match=d.matches!.find(t=>t.id==='recurring');d.selected=true;const saved=applyStatementImport(recurring,[d]);expect(saved.transactions.find(t=>t.id==='recurring')?.recurrenceId).toBe(recurring.transactions.find(t=>t.id==='recurring')?.recurrenceId);expect(saved.transactions.filter(t=>t.recurrenceId&&t.id!=='recurring').every(t=>!t.paid)).toBe(true);
 const part={...transaction(),installment:{cardId:'card',purchaseId:'purchase',index:1,count:1,purchasedOn:'2026-10-01'}};const data={...base(),transactions:[part],cards:[{id:'card',name:'Energy card',limitCents:99900,closingDay:1,dueDay:10}]};const result=applyStatementImport(data,matched(data));expect(result.transactions[0].installment).toEqual(part.installment);
});
test('existing import markers and aliases survive confirmation, backups and later reimports',()=>{
 const data={...base(),transactions:[{...transaction(),statementKey:'a'.repeat(64),statementKeys:['b'.repeat(64)]}]};const result=applyStatementImport(data,matched(data));expect(statementKeys(result.transactions[0])).toHaveLength(3);expect(statementKeys(result.transactions[0])).toEqual(expect.arrayContaining(['a'.repeat(64),'b'.repeat(64)]));
 const restored=validateData(JSON.parse(JSON.stringify(result)));expect(drafts(restored)[0].duplicate).toBe('known');expect(drafts(restored)[0].matches).toBeUndefined();
 const repeated=validateData(repeatingTransaction({...base(),transactions:[]},restored.transactions[0],'monthly','2026-11-12'));expect(repeated.transactions.filter(t=>t.id!==restored.transactions[0].id).every(t=>!t.statementKey&&!t.statementKeys)).toBe(true);
});
test('an imported planned entry may be confirmed deliberately when its actual bank date arrives',()=>{
 const data={...base(),transactions:[]};const future=reviewStatement(statement('2026-11-14'),data,'BRL');future[0].transaction.paid=false;const planned=applyStatementImport(data,future);const review=drafts(planned);expect(review[0].duplicate).toBe('known');expect(review[0].selected).toBe(false);review[0].match=review[0].matches![0];review[0].selected=true;expect(applyStatementImport(planned,review).transactions).toHaveLength(1);expect(applyStatementImport(planned,review).transactions[0].paid).toBe(true);
});
test('stale edits, repeated targets, archived accounts, amount changes and marker ownership conflicts reject the whole batch',()=>{
 const data=base(),review=matched(data,'bank'),before=JSON.stringify(data);
 for(const changed of [{...data,transactions:[]},{...data,transactions:[{...transaction(),notes:'Changed'}]},{...data,transactions:[{...transaction(),paid:true}]},{...data,accounts:data.accounts!.map(a=>({...a,archived:true}))}])expect(()=>applyStatementImport(changed,review)).toThrow();
 expect(()=>applyStatementImport(data,[...review,{...review[0],transaction:{...review[0].transaction,id:'other-source',statementKey:'c'.repeat(64)}}])).toThrow();
 const collision={...data,transactions:[...data.transactions,{...transaction('other'),paid:true,statementKey:review[0].transaction.statementKey}]};expect(()=>applyStatementImport(collision,review)).toThrow();expect(JSON.stringify(data)).toBe(before);
});
test('matching and new imports share one atomic batch, and matching alone works at the transaction limit',()=>{
 const data=base(),review=matched(data);const extra={...review[0],match:undefined,matches:undefined,duplicate:null,transaction:{...review[0].transaction,id:'new',description:'Unrelated coffee',amountCents:1200,statementKey:'d'.repeat(64)}};
 expect(applyStatementImport(data,[...review,extra]).transactions).toHaveLength(2);
 const full={...data,transactions:[transaction(),...Array.from({length:9999},(_,i)=>({...transaction('old-'+i),paid:true,amountCents:1}))]};expect(applyStatementImport(full,matched(full)).transactions).toHaveLength(10000);expect(()=>applyStatementImport(full,[...matched(full),extra])).toThrow();
});
test('flagged transfers/card payments and future source rows cannot silently confirm planned expenses',()=>{
 const data=base(),review=matched(data);expect(()=>applyStatementImport(data,[{...review[0],check:true}])).toThrow();
 const future=reviewStatement(statement('2200-11-12'),data,'BRL')[0];expect(future.matches).toBeUndefined();expect(()=>applyStatementImport(data,[{...future,match:data.transactions[0],selected:true}])).toThrow();
});
test('global search covers all record types and notes across months without changing or saving records',()=>{
 const data:AppData={...base(),tasks:[{id:'task',title:'Energy planning',date:'2025-05-12',time:'09:00',category:'Trabalho',priority:'Alta',completed:false,notes:'Call supplier',subtasks:[{id:'step',title:'Find proof of address',completed:false}]}],goals:[{id:'goal',name:'Energy upgrade',targetCents:100000,savedCents:0,targetDate:'2027-01-01',notes:'Emergency plan',archived:true}],cards:[{id:'card',name:'Energy card',limitCents:100000,closingDay:1,dueDay:10,archived:true}],transfers:[{id:'transfer',fromAccountId:'bank',toAccountId:'cash',date:'2026-11-12',amountCents:1000,notes:'Energy savings'}]};const before=JSON.stringify(data),found=searchRecords(data,'energy');expect(new Set(found.items.map(r=>r.kind))).toEqual(new Set(Object.keys(SEARCH_KINDS)));expect(searchRecords(data,'proof address').items[0].id).toBe('task');expect(searchRecords(data,'invoice','all',true).items.map(r=>r.id)).toEqual(['planned']);expect(searchRecords(data,'energy','goal').items[0].archived).toBe(true);expect(JSON.stringify(data)).toBe(before);expect(searchRecords(data,'e').total).toBe(0);
});
test('search respects accents, word order, localized categories, limits and user-entered text',()=>{
 const data={...base(),transactions:Array.from({length:70},(_,i)=>({...transaction('t'+i),description:'Café especial',date:'2025-01-01',category:'Alimentação'}))};expect(searchRecords(data,'ESPECIAL cafe').total).toBe(70);expect(searchRecords(data,'cafe').items).toHaveLength(40);
 for(const language of LANGUAGES){setCurrentLanguage(language.id);expect(searchRecords(data,translate(language.id,'Alimentação')).total).toBe(70);}expect(data.transactions[0].description).toBe('Café especial');
});
test('marker alias validation rejects malformed or excessive metadata and leaves legacy backup shapes unchanged',()=>{
 expect(validateData(freshData())).toEqual(freshData());for(const bad of [['wrong'],Array(101).fill('a'.repeat(64)),['a'.repeat(64),'a'.repeat(64)],'bad'])expect(()=>validateData({...base(),transactions:[{...transaction(),statementKeys:bad}]})).toThrow();
});

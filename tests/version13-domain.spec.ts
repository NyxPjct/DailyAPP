import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { freshData, validateData } from "../src/domain";
import type { AppData } from "../src/domain";
import { applyStatementImport, csvCurrency, csvStatement, decodeStatement, guessMapping, readCsv, readOfx, reviewStatement, statementCents, statementDate } from "../src/statement-import";
import { repeatingTransaction } from "../src/planning";
const csv=readFileSync('tests/fixtures/statement-example.csv','utf8');
const ofx=readFileSync('tests/fixtures/statement-example.ofx','utf8');
const bank={id:'bank',name:'Bank',kind:'bank' as const,openingCents:100000,openingDate:'2026-10-01'};
const base=():AppData=>({...freshData(),accounts:[bank]});
const parse=(text=csv)=>{const table=readCsv(text);return csvStatement(table,guessMapping(table.headers),'DMY','.');};

test('CSV parsing handles BOM, sep headers, escaped quotes, newlines and explicit delimiters',()=>{
 const table=readCsv('\uFEFFsep=;\r\nData;Descrição;Valor\r\n26/10/2026;"Café; \"\"Bom\"\"\nCentro";-12,50\r\n');
 const statement=csvStatement(table,guessMapping(table.headers),'DMY',',');
 expect(statement.rows[0]).toMatchObject({date:'2026-10-26',description:'Café; "Bom"\nCentro',signedCents:-1250});
 expect(readCsv('date\tdescription\tamount\n2026-10-26\tTea\t-10.00').rows).toHaveLength(1);
 for(const invalid of ['date;description;amount\n2026-10-26;"broken;-1','date;description;amount\n2026-10-26;"closed"x;-1','date;description;amount\n2026-10-26;Tea'])expect(()=>readCsv(invalid)).toThrow();
});
test('explicit decimal and date orders avoid ambiguous amounts and timezone shifts',()=>{
 expect(statementCents('-1.234,56',',')).toBe(-123456);expect(statementCents('(1,234.56)','.')).toBe(-123456);expect(statementCents('-R$ 12,50',',')).toBe(-1250);expect(statementCents('1\u202f234,56',',')).toBe(123456);expect(()=>statementCents('12 34,56',',')).toThrow();
 for(const [value,decimal] of [['1,234',','],['1.234','.'],['12x34','.'],['Infinity','.']] as const)expect(()=>statementCents(value,decimal)).toThrow();
 expect(statementDate('02/03/2026','DMY')).toBe('2026-03-02');expect(statementDate('02/03/2026','MDY')).toBe('2026-02-03');expect(statementDate('2026-10-26T23:00:00-03:00','DMY')).toBe('2026-10-26');
 expect(()=>statementDate('29/02/2025','DMY')).toThrow();
});
test('CSV accepts separate positive debit/credit columns and rejects conflicting or unknown types',()=>{
 const t=readCsv('date;description;debit;credit\n2026-10-26;Tea;10.00;\n2026-10-26;Salary;;20.00');const m=guessMapping(t.headers);
 expect(csvStatement(t,m,'DMY','.').rows.map(r=>r.signedCents)).toEqual([-1000,2000]);
 expect(()=>csvStatement({...t,rows:[['2026-10-26','Tea','10','20']]},m,'DMY','.')).toThrow();
 expect(()=>parse('date;description;amount;type\n2026-10-26;Tea;-10;credit')).toThrow();
 expect(()=>parse('date;description;amount;type\n2026-10-26;Tea;10;unknown')).toThrow();
 expect(parse('date;description;amount;type\n2026-10-26;Tea;10;DEBIT').rows[0].signedCents).toBe(-1000);
});
test('CSV currency metadata rejects mixed, missing and unsupported codes',()=>{
 expect(csvCurrency(readCsv(csv))).toBe('BRL');
 for(const text of [csv.replace('example-coffee;BRL','example-coffee;USD'),csv.replace('example-coffee;BRL','example-coffee;'),csv.replaceAll(';BRL',';JPY')])expect(()=>parse(text)).toThrow();
 expect(()=>reviewStatement(parse(),base(),'USD')).toThrow();
});
test('OFX supports SGML and XML with account scope, bank dates and escaped text',()=>{
 const s=readOfx(ofx);expect(s.currency).toBe('BRL');expect(s.rows).toHaveLength(3);expect(s.rows[1]).toMatchObject({date:'2026-10-26',description:'Groceries & household',signedCents:-14590});expect(s.rows[2].check).toBe(true);
 const xml=ofx.replace(/<(CURDEF|BANKID|ACCTID|ACCTTYPE|DTSTART|DTEND|TRNTYPE|DTPOSTED|TRNAMT|FITID|NAME|MEMO)>([^<]*?)(?=\n|<)/g,'<$1>$2</$1>');expect(readOfx(xml).rows).toEqual(s.rows);
});
test('OFX rejects entity declarations, multiple accounts, incomplete records and malformed values',()=>{
 for(const bad of ['<!DOCTYPE OFX [<!ENTITY x SYSTEM "file:///private">]>'+ofx,ofx.replace('<CURDEF>BRL','<CURDEF>JPY'),ofx.replace('<BANKACCTFROM>','<BANKACCTFROM><CCACCTFROM>'),ofx.replace('<TRNAMT>-145.90','<TRNAMT>-145,90'),ofx.replace('</STMTTRN>',''),ofx.replace('<ACCTID>FICTIONAL-ACCOUNT','<ACCTID>')])expect(()=>readOfx(bad)).toThrow();
});
test('UTF-8, Windows-1252 and UTF-16 files decode locally and file limits are enforced',()=>{
 const cp=Uint8Array.from([67,97,102,233]);expect(decodeStatement(cp.buffer)).toBe('Café');
 const utf16=new Uint8Array([255,254,67,0,97,0,102,0,233,0]);expect(decodeStatement(utf16.buffer)).toBe('Café');
 expect(()=>decodeStatement(new ArrayBuffer(5*1024*1024+1))).toThrow();
 expect(()=>readCsv('date;description;amount\n'+Array.from({length:5001},()=> '2026-10-26;Tea;-1').join('\n'))).toThrow();
});
test('review preserves amounts, defaults suspicious entries off, converts only with saved rates and creates no records',()=>{
 const data=base(),before=JSON.stringify(data),s=parse(),drafts=reviewStatement(s,data,'BRL','bank');
 expect(drafts.map(d=>d.selected)).toEqual([true,true,true,false,true]);expect(drafts[1].transaction.amountCents).toBe(14590);expect(JSON.stringify(data)).toBe(before);
 const usd={...s,currency:'USD' as const};expect(()=>reviewStatement(usd,data,'USD')).toThrow();
 const converted=reviewStatement(usd,{...data,exchangeRates:{USD:{rate:0.2,date:'2026-10-26',source:'manual'}}},'USD');expect(converted[1].transaction.amountCents).toBe(72950);
 const future=parse('date;description;amount\n2200-10-26;Future;-1');expect(reviewStatement(future,data,'BRL')[0].transaction.paid).toBe(false);
});
test('account opening dates and archived accounts are checked before importing',()=>{
 expect(()=>reviewStatement(parse(),{...base(),accounts:[{...bank,openingDate:'2026-10-27'}]},'BRL','bank')).toThrow();
 expect(()=>reviewStatement(parse(),{...base(),accounts:[{...bank,archived:true}]},'BRL','bank')).toThrow();
 const drafts=reviewStatement(parse(),base(),'BRL','bank');expect(()=>applyStatementImport({...base(),accounts:[{...bank,archived:true}]},drafts)).toThrow();
});
test('stable fingerprints prevent reimports even after editing descriptions, categories, or amounts and after backup restoration',()=>{
 const s=parse(),data=base(),saved=applyStatementImport(data,reviewStatement(s,data,'BRL','bank'));
 const edited=validateData({...saved,transactions:saved.transactions.map(t=>({...t,description:'Edited',amountCents:t.amountCents+1,category:'Outros'}))});
 const rerun=reviewStatement(s,edited,'BRL','bank');expect(rerun.filter(d=>d.duplicate==='known')).toHaveLength(4);expect(rerun[3].selected).toBe(false);
 const sameId=readOfx(ofx.replace('-145.90','-150.00'));const first=applyStatementImport(data,reviewStatement(readOfx(ofx),data,'BRL'));expect(reviewStatement(sameId,first,'BRL')[1].duplicate).toBe('known');
 expect(data.transactions).toEqual([]);
});
test('possible manual duplicates require deliberate selection, while equal legitimate entries can be retained',()=>{
 const s=parse('date;description;amount\n2026-10-26;Tea;-10\n2026-10-26;Tea;-10');const drafts=reviewStatement(s,base(),'BRL');expect(drafts.map(d=>d.duplicate)).toEqual([null,'possible']);expect(drafts[1].selected).toBe(false);
 const allowed=drafts.map(d=>({...d,selected:true,allowDuplicate:d.duplicate==='possible'}));expect(applyStatementImport(base(),allowed).transactions).toHaveLength(2);
 const manual={...base(),transactions:[{...drafts[0].transaction,statementKey:undefined}]};expect(reviewStatement(s,manual,'BRL')[0].duplicate).toBe('possible');expect(()=>applyStatementImport(manual,drafts)).toThrow();
});
test('import applies an entire valid batch or leaves existing data untouched, including stale reviews and capacity limits',()=>{
 const data=base(),s=parse(),drafts=reviewStatement(s,data,'BRL'),before=JSON.stringify(data);
 expect(()=>applyStatementImport(data,drafts.map((d,i)=>i===1?{...d,transaction:{...d.transaction,amountCents:-1}}:d))).toThrow();expect(JSON.stringify(data)).toBe(before);
 const saved=applyStatementImport(data,drafts);expect(()=>applyStatementImport(saved,drafts)).toThrow();expect(saved.transactions).toHaveLength(4);
 const full={...data,transactions:Array.from({length:10000},(_,i)=>({...drafts[0].transaction,id:String(i),statementKey:undefined}))};expect(()=>applyStatementImport(full,drafts)).toThrow();
});
test('statement identifiers remain on original entries and do not leak into recurring occurrences',()=>{
 const data=base(),draft=reviewStatement(parse(),data,'BRL')[0].transaction;
 const repeating=validateData(repeatingTransaction(data,draft,'monthly','2026-10-26'));
 expect(repeating.transactions.find(t=>t.id===draft.id)!.statementKey).toBe(draft.statementKey);
 expect(repeating.transactions.filter(t=>t.id!==draft.id).every(t=>t.statementKey===undefined)).toBe(true);
 expect(()=>validateData({...base(),transactions:[{...draft,statementKey:'private-bank-id'}]})).toThrow();
});

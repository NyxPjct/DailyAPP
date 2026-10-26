import { sha256 } from "@noble/hashes/sha2.js";
import { dateKey, normalize, randomId, validDate, validateData } from "./domain";
import type { AppData, Transaction } from "./domain";
import { isCurrency, validRate } from "./currency";
import type { Currency } from "./currency";
import { t as tr } from "./i18n/core";

export const STATEMENT_BYTES = 5 * 1024 * 1024;
export const STATEMENT_ROWS = 5000;
export interface CsvMapping { date: number; description: number; amount: number; debit: number; credit: number; type: number; identifier: number }
export interface CsvTable { headers: string[]; rows: string[][] }
export interface StatementRow { line: number; date: string; description: string; signedCents: number; externalId?: string; scope: string; check: boolean }
export interface Statement { format: "csv" | "ofx"; currency?: Currency; rows: StatementRow[] }
export interface ImportDraft { transaction: Transaction; selected: boolean; duplicate: "known" | "possible" | null; check: boolean; allowDuplicate: boolean }
const hash = (value: unknown) => Array.from(sha256(new TextEncoder().encode(JSON.stringify(value))), b => b.toString(16).padStart(2, "0")).join("");

export function decodeStatement(bytes: ArrayBuffer): string {
  if (bytes.byteLength > STATEMENT_BYTES) throw new Error(tr("O extrato deve ter no máximo 5 MB."));
  const raw = new Uint8Array(bytes);
  if (raw[0] === 255 && raw[1] === 254) return new TextDecoder("utf-16le", { fatal: true }).decode(raw);
  if (raw[0] === 254 && raw[1] === 255) return new TextDecoder("utf-16be", { fatal: true }).decode(raw);
  try { return new TextDecoder("utf-8", { fatal: true }).decode(raw); }
  catch { return new TextDecoder("windows-1252").decode(raw); }
}
export function readCsv(text: string, delimiter: string = "auto"): CsvTable {
  if (new TextEncoder().encode(text).length > STATEMENT_BYTES) throw new Error(tr("O extrato deve ter no máximo 5 MB."));
  text = text.replace(/^\uFEFF/, "");
  const separatorLine = /^sep=([;,\t])\r?\n/i.exec(text);
  if (separatorLine) { if (delimiter === "auto") delimiter = separatorLine[1]; text = text.slice(separatorLine[0].length); }
  if (delimiter === "auto") {
    let quoted = false; const counts = new Map([[",", 0], [";", 0], ["\t", 0]]);
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') { if (quoted && text[i + 1] === '"') i++; else quoted = !quoted; }
      else if (!quoted && (c === "\r" || c === "\n")) break;
      else if (!quoted && counts.has(c)) counts.set(c, counts.get(c)! + 1);
    }
    delimiter = [...counts].sort((a,b) => b[1] - a[1])[0][0];
  }
  if (![",", ";", "\t"].includes(delimiter)) throw new Error(tr("Escolha um separador CSV válido."));
  const lines: string[][] = []; let row: string[] = [], field = "", quoted = false, closed = false;
  const pushField = () => { row.push(field); field = ""; closed = false; if (row.length > 100) throw new Error(tr("O CSV tem colunas demais.")); };
  const pushRow = () => { pushField(); if (row.some(v => v.trim())) lines.push(row); row = []; if (lines.length > STATEMENT_ROWS + 1) throw new Error(tr("Importe no máximo 5.000 lançamentos por arquivo.")); };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else { quoted = false; closed = true; } } else field += c; }
    else if (c === delimiter) pushField();
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; pushRow(); }
    else if (c === '"' && !field && !closed) quoted = true;
    else { if (closed && !/\s/.test(c) || c === '"') throw new Error(tr("O CSV contém aspas inválidas.")); if (!closed) field += c; }
  }
  if (quoted) throw new Error(tr("O CSV contém aspas inválidas."));
  if (field || row.length || closed) pushRow();
  if (lines.length < 2 || lines[0].length < 2) throw new Error(tr("O CSV precisa de cabeçalho e pelo menos um lançamento."));
  const headers = lines.shift()!;
  if (lines.some(row => row.length !== headers.length)) throw new Error(tr("As linhas do CSV precisam ter o mesmo número de colunas do cabeçalho."));
  return { headers, rows: lines };
}
export function guessMapping(headers: string[]): CsvMapping {
  const names = headers.map(h => normalize(h).replace(/[^a-z0-9]/g, ""));
  const find = (aliases: string[]) => names.findIndex(h => aliases.includes(h));
  return {
    date: find(["date","data","fecha","datum","bookingdate","transactiondate","datadelancamento","datalancamento"]),
    description: find(["description","descricao","historico","memo","name","descricaooperacao","concepto","libelle","beschreibung"]),
    amount: find(["amount","valor","value","montant","importe","betrag","transactionamount"]),
    debit: find(["debit","debito","debitos","debitamount","belastung"]),
    credit: find(["credit","credito","creditos","creditamount","gutschrift"]),
    type: find(["type","tipo","natureza","transactiontype","sens","art"]),
    identifier: find(["id","fitid","transactionid","identificador","reference","referencia","documento"]),
  };
}
export function csvCurrency(table:CsvTable):Currency|undefined {
  const index=table.headers.findIndex(h=>["currency","moeda","moneda","divisa","devise","wahrung","waehrung"].includes(normalize(h).trim()));
  if(index<0)return;
  const currencies=new Set(table.rows.map(row=>row[index].trim().toUpperCase()));
  const currency=[...currencies][0];
  if(currencies.size!==1||!isCurrency(currency))throw new Error(tr("O CSV deve usar uma única moeda suportada, indicada em todas as linhas."));
  return currency;
}
export function statementDate(value: string, order: "DMY" | "MDY") {
  const text = value.trim();
  let result = /^\d{4}-\d{2}-\d{2}(?:$|T)/.test(text) ? text.slice(0, 10) : "";
  const match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(text);
  if (match) result = `${match[3]}-${(order === "DMY" ? match[2] : match[1]).padStart(2,"0")}-${(order === "DMY" ? match[1] : match[2]).padStart(2,"0")}`;
  if (!validDate(result)) throw new Error(tr("Data inválida. Confira a ordem de dia e mês."));
  return result;
}
export function statementCents(value: string, decimal: "." | ","): number {
  let text = value.trim().replace(/\u2212/g,"-");
  const parentheses = text.startsWith("(") && text.endsWith(")");
  if (parentheses) text = "-" + text.slice(1,-1).trim();
  text = text.replace(/^([+-]?)\s*(?:R\$|\$|€|£)\s*/,"$1");
  const grouping = decimal === "." ? "," : "\\.";
  const sep = decimal === "." ? "\\." : ",";
  if (!new RegExp(`^[+-]?(?:\\d+|\\d{1,3}(?:${grouping}\\d{3})+|\\d{1,3}(?:[ \\u00a0\\u202f]\\d{3})+)(?:${sep}\\d{1,2})?$`).test(text)) throw new Error(tr("Valor inválido. Confira o separador decimal."));
  const unsigned = text.replace(/[+-]/g, "").split(decimal);
  const whole = unsigned[0].replace(/[,. \u00a0\u202f]/g, "");
  const cents = (Number(whole) * 100 + Number((unsigned[1] ?? "").padEnd(2,"0"))) * (text.startsWith("-") ? -1 : 1);
  if (!Number.isSafeInteger(cents) || Math.abs(cents) > 100_000_000_000) throw new Error(tr("Valor inválido. Confira o separador decimal."));
  return cents;
}
const checkDescription = (description: string) => /transfer|pagamento.*fatura|pagto.*fatura|card.*payment|payment.*card|paiement.*carte|kreditkarten.*zahlung|pago.*tarjeta/.test(normalize(description));
export function csvStatement(table: CsvTable, mapping: CsvMapping, order: "DMY" | "MDY", decimal: "." | ","): Statement {
  const indexes = Object.values(mapping).filter(i => i >= 0);
  if (mapping.date < 0 || mapping.description < 0 || mapping.amount < 0 && (mapping.debit < 0 || mapping.credit < 0) || indexes.some(i => !Number.isInteger(i) || i >= table.headers.length) || new Set(indexes).size !== indexes.length)
    throw new Error(tr("Mapeie data, descrição e valor, ou as colunas de débito e crédito, sem repetir colunas."));
  return { format: "csv", currency:csvCurrency(table), rows: table.rows.map((row,index) => {
    try {
      const description = row[mapping.description].trim();
      if (!description || description.length > 120) throw new Error(tr("A descrição deve ter de 1 a 120 caracteres."));
      let amount: number;
      if (mapping.amount >= 0) amount = statementCents(row[mapping.amount], decimal);
      else {
        const debit = row[mapping.debit].trim() ? statementCents(row[mapping.debit],decimal) : 0;
        const credit = row[mapping.credit].trim() ? statementCents(row[mapping.credit],decimal) : 0;
        if (debit < 0 || credit < 0 || debit && credit) throw new Error(tr("Use apenas débito ou crédito positivo em cada linha."));
        amount = credit - debit;
      }
      const type = mapping.type >= 0 ? normalize(row[mapping.type].trim()) : "";
      if (["debit","debito","expense","despesa","debet","d","saida","egreso","depense"].includes(type)) amount = -Math.abs(amount);
      else if (["credit","credito","income","receita","c","entrada","ingreso","revenu","einnahme"].includes(type)) {
        if (amount < 0) throw new Error(tr("O tipo de receita conflita com o valor negativo."));
      } else if (type && !/transfer/.test(type)) throw new Error(tr("Tipo desconhecido. Confira a coluna de receita e despesa."));
      if (!amount) throw new Error(tr("Lançamentos com valor zero não podem ser importados."));
      const externalId = mapping.identifier >= 0 ? row[mapping.identifier].trim() : "";
      if (externalId.length > 200) throw new Error(tr("O identificador do lançamento é longo demais."));
      return { line:index+2, date:statementDate(row[mapping.date],order), description, signedCents:amount, scope:"csv", ...(externalId ? {externalId} : {}), check:/transfer/.test(type) || checkDescription(description) };
    } catch (error) { throw new Error(tr("Linha {0}: {1}",index+2,(error as Error).message)); }
  }) };
}
const unescapeOfx = (text: string) => text.replace(/&(?:amp|lt|gt|quot|apos|#\d{1,7}|#x[\da-fA-F]{1,6});/g, entity => {
  const predefined: Record<string,string> = { "&amp;":"&", "&lt;":"<", "&gt;":">", "&quot;":'"', "&apos;":"'" };
  if (predefined[entity]) return predefined[entity];
  const n = entity.startsWith("&#x") ? parseInt(entity.slice(3,-1),16) : Number(entity.slice(2,-1));
  if (n <= 0 || n > 0x10ffff || n >= 0xd800 && n <= 0xdfff) throw new Error(tr("O arquivo OFX é inválido."));
  return String.fromCodePoint(n);
});
function ofxField(text: string, name: string, required = false) {
  const matches = [...text.matchAll(new RegExp(`<${name}\\s*>([^<]*)`, "gi"))];
  if (matches.length > 1 || required && matches.length !== 1) throw new Error(tr("O arquivo OFX é inválido."));
  return matches.length ? unescapeOfx(matches[0][1].trim()) : "";
}
export function readOfx(text: string): Statement {
  if (new TextEncoder().encode(text).length > STATEMENT_BYTES) throw new Error(tr("O extrato deve ter no máximo 5 MB."));
  if (!/<OFX\s*>/i.test(text) || /<!DOCTYPE|<!ENTITY|<INVPOSLIST|<INVTRANLIST/i.test(text)) throw new Error(tr("Use um OFX bancário ou de cartão com apenas uma conta."));
  const lists = [...text.matchAll(/<BANKTRANLIST\s*>([\s\S]*?)<\/BANKTRANLIST\s*>/gi)];
  if (lists.length !== 1 || [...text.matchAll(/<(?:BANKACCTFROM|CCACCTFROM)\s*>/gi)].length !== 1) throw new Error(tr("Use um OFX bancário ou de cartão com apenas uma conta."));
  const currency = ofxField(text,"CURDEF",true).toUpperCase();
  if (!isCurrency(currency)) throw new Error(tr("A moeda do OFX não é suportada."));
  const scopeParts = [ofxField(text,"BANKID"),ofxField(text,"BRANCHID"),ofxField(text,"ACCTID",true),ofxField(text,"ACCTTYPE")];
  if(!scopeParts[2]||scopeParts.some(p=>p.length>200))throw new Error(tr("O arquivo OFX é inválido."));
  const scope = JSON.stringify(scopeParts);
  const blocks = [...lists[0][1].matchAll(/<STMTTRN\s*>([\s\S]*?)<\/STMTTRN\s*>/gi)];
  if (!blocks.length || blocks.length > STATEMENT_ROWS || blocks.length !== [...lists[0][1].matchAll(/<STMTTRN\s*>/gi)].length) throw new Error(tr("O OFX precisa conter de 1 a 5.000 lançamentos válidos."));
  return {format:"ofx",currency,rows:blocks.map((match,index)=>{
    try {
      const block=match[1], rawDate=ofxField(block,"DTPOSTED",true);
      if (!/^\d{8}(?:\d{6}(?:\.\d+)?(?:\[[^\]\r\n]{1,40}\])?)?$/.test(rawDate)) throw new Error(tr("Data inválida. Confira a ordem de dia e mês."));
      const date=`${rawDate.slice(0,4)}-${rawDate.slice(4,6)}-${rawDate.slice(6,8)}`;
      if (!validDate(date)) throw new Error(tr("Data inválida. Confira a ordem de dia e mês."));
      const amount=ofxField(block,"TRNAMT",true);
      if (!/^[+-]?\d+(?:\.\d{1,2})?$/.test(amount)) throw new Error(tr("O arquivo OFX é inválido."));
      const signedCents=statementCents(amount,".");
      if (!signedCents) throw new Error(tr("Lançamentos com valor zero não podem ser importados."));
      const description=ofxField(block,"MEMO") || ofxField(block,"NAME");
      const externalId=ofxField(block,"FITID");
      if (!description || description.length>120 || externalId.length>200) throw new Error(tr("A descrição deve ter de 1 a 120 caracteres."));
      return {line:index+1,date,description,signedCents,scope,...(externalId?{externalId}:{}),check:ofxField(block,"TRNTYPE").toUpperCase()==="XFER"||checkDescription(description)};
    } catch(error) { throw new Error(tr("Linha {0}: {1}",index+1,(error as Error).message)); }
  })};
}
const signature = (t:Transaction) => JSON.stringify([t.date,t.type,t.amountCents,normalize(t.description.trim())]);
function signatures(transactions:Transaction[]) {
  const result=new Map<string,Set<string>>();
  for (const t of transactions) {const key=signature(t);if(!result.has(key))result.set(key,new Set());result.get(key)!.add(t.accountId??"");}
  return result;
}
const possible = (index:Map<string,Set<string>>,t:Transaction) => {const accounts=index.get(signature(t));return !!accounts&&(!t.accountId||accounts.has("")||accounts.has(t.accountId));};
export function reviewStatement(statement:Statement,data:AppData,currency:Currency,accountId?:string):ImportDraft[] {
  if (statement.currency && statement.currency!==currency) throw new Error(tr("Use a moeda indicada pelo extrato."));
  const rate=currency==="BRL"?1:data.exchangeRates?.[currency]?.rate;
  if (!validRate(rate)) throw new Error(tr("Salve uma cotação para essa moeda em Ajustes antes de importar."));
  const account=accountId?data.accounts?.find(a=>a.id===accountId&&!a.archived):undefined;
  if (accountId&&!account) throw new Error(tr("Escolha uma conta ativa para importar."));
  const keys=new Set(data.transactions.map(t=>t.statementKey).filter(Boolean)), occurrences=new Map<string,number>(), existing=signatures(data.transactions), seen=new Set<string>();
  return statement.rows.map(row=>{
    if (account&&row.date<account.openingDate) throw new Error(tr("Há lançamentos anteriores ao saldo inicial da conta. Ajuste a conta ou importe sem vínculo."));
    const amountCents=Math.round(Math.abs(row.signedCents)/rate);
    if (!Number.isSafeInteger(amountCents)||amountCents<=0||amountCents>100_000_000_000) throw new Error(tr("O valor convertido está fora dos limites do app."));
    const keyBase=["dailyapp-statement-v1",statement.format,currency,statement.format==="ofx"?row.scope:accountId??"",row.externalId??[row.date,row.description,row.signedCents]];
    const base=JSON.stringify(keyBase),occurrence=occurrences.get(base)??0;occurrences.set(base,occurrence+1);
    const statementKey=hash([keyBase,row.externalId?0:occurrence]);
    const transaction:Transaction={id:randomId(),date:row.date,description:row.description,amountCents,type:row.signedCents>0?"income":"expense",category:"Outros",paid:row.date<=dateKey(),notes:"",...(accountId?{accountId}:{}),statementKey};
    const duplicate=keys.has(statementKey)?"known":possible(existing,transaction)||seen.has(signature(transaction))?"possible":null;
    keys.add(statementKey);seen.add(signature(transaction));
    return {transaction,duplicate,check:row.check,selected:!duplicate&&!row.check,allowDuplicate:false};
  });
}
export function applyStatementImport(data:AppData,drafts:ImportDraft[]):AppData {
  const selected=drafts.filter(d=>d.selected);
  if (!selected.length) throw new Error(tr("Selecione pelo menos um lançamento para importar."));
  if (data.transactions.length+selected.length>10000) throw new Error(tr("Limite de registros atingido. Exporte um backup antes de remover registros antigos."));
  const keys=new Set(data.transactions.map(t=>t.statementKey).filter(Boolean));
  const index=signatures(data.transactions), transactions=[...data.transactions];
  for (const draft of selected) {
    const t=draft.transaction;
    if (draft.duplicate==="known"||!t.statementKey||keys.has(t.statementKey)) throw new Error(tr("Um lançamento já foi importado. Reabra a revisão para atualizar a lista."));
    if (possible(index,t)&&!draft.allowDuplicate) throw new Error(tr("Há um possível duplicado novo. Reabra a revisão antes de importar."));
    if (t.accountId&&!data.accounts?.some(a=>a.id===t.accountId&&!a.archived)) throw new Error(tr("Escolha uma conta ativa para importar."));
    keys.add(t.statementKey);transactions.push(t);const key=signature(t);if(!index.has(key))index.set(key,new Set());index.get(key)!.add(t.accountId??"");
  }
  return validateData({...data,transactions});
}

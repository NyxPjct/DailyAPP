import { useEffect, useRef, useState } from "react";
import { CURRENCIES } from "../currency";
import type { Currency } from "../currency";
import type { AppData } from "../domain";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, money, prettyDate } from "../domain";
import { getLocale, t as tr } from "../i18n/core";
import { AccountSelect } from "./FinanceTools";
import { csvCurrency, csvStatement, decodeStatement, guessMapping, readCsv, readOfx, reviewStatement, STATEMENT_BYTES } from "../statement-import";
import type { CsvMapping, CsvTable, ImportDraft, Statement } from "../statement-import";

export function StatementImport({data,onImport,onClose}:{data:AppData;onImport:(drafts:ImportDraft[])=>boolean;onClose:()=>void}) {
  const [text,setText]=useState("");
  const [filename,setFilename]=useState("");
  const [table,setTable]=useState<CsvTable>();
  const [statement,setStatement]=useState<Statement>();
  const [mapping,setMapping]=useState<CsvMapping>();
  const [currency,setCurrency]=useState<Currency>("BRL");
  const [account,setAccount]=useState("");
  const [decimal,setDecimal]=useState<"."|",">(",");
  const [order,setOrder]=useState<"DMY"|"MDY">("DMY");
  const [delimiter,setDelimiter]=useState("auto");
  const [drafts,setDrafts]=useState<ImportDraft[]>();
  const [reviewed,setReviewed]=useState<Statement>();
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [page,setPage]=useState(0);
  const active=useRef(0);
  useEffect(()=>()=>{active.current++;},[]);
  const pageSize=25;
  function reset(){active.current++;setText("");setFilename("");setTable(undefined);setStatement(undefined);setMapping(undefined);setDrafts(undefined);setReviewed(undefined);setError("");setBusy(false);setPage(0);}
  async function load(file?:File){
    if(!file)return;reset();const request=active.current;setBusy(true);
    try {
      if(!/\.(csv|ofx)$/i.test(file.name))throw new Error(tr("Escolha um arquivo CSV ou OFX."));
      if(file.size>STATEMENT_BYTES)throw new Error(tr("O extrato deve ter no máximo 5 MB."));
      const content=decodeStatement(await file.arrayBuffer());if(request!==active.current)return;
      if(/\.ofx$/i.test(file.name)) {const parsed=readOfx(content);setStatement(parsed);setCurrency(parsed.currency!);}
      else {const parsed=readCsv(content,delimiter);setTable(parsed);setMapping(guessMapping(parsed.headers));const originalCurrency=csvCurrency(parsed);if(originalCurrency)setCurrency(originalCurrency);}
      setText(content);setFilename(file.name);
    }catch(error){if(request===active.current)setError((error as Error).message);}
    finally{if(request===active.current)setBusy(false);}
  }
  const update=(index:number,change:Partial<ImportDraft>)=>setDrafts(old=>old!.map((d,i)=>i===index?{...d,...change}:d));
  const selected=drafts?.filter(d=>d.selected)??[];
  const sourceAmount=(cents:number)=>new Intl.NumberFormat(getLocale(),{style:"currency",currency}).format(cents/100);
  return <div className="statement-import">
    <p className="form-hint">{tr("O arquivo fica neste dispositivo. Revise os lançamentos antes de confirmar; seus registros atuais serão preservados.")}</p>
    {!text&&!drafts&&<label className="statement-file">{tr("Arquivo do extrato")}<input type="file" aria-label={tr("Arquivo do extrato")} accept=".csv,.ofx,text/csv,application/x-ofx,application/ofx,text/plain,application/octet-stream" disabled={busy} onChange={e=>void load(e.target.files?.[0])}/><small>{tr("CSV com cabeçalho ou OFX de uma conta. Até 5 MB e 5.000 lançamentos.")}</small></label>}
    {busy&&<p role="status">{tr("Lendo extrato…")}</p>}
    {!!text&&!drafts&&<>
      <p className="statement-filename">{filename}</p>
      <div className="form-grid"><label>{tr("Moeda do extrato")}<select aria-label={tr("Moeda do extrato")} value={currency} disabled={statement?.format==="ofx"} onChange={e=>setCurrency(e.target.value as Currency)}>{CURRENCIES.map(c=><option key={c}>{c}</option>)}</select></label><AccountSelect accounts={data.accounts??[]} value={account} onChange={setAccount}/></div>
      <p className="form-hint">{tr("Escolha a moeda original do arquivo. Os valores serão convertidos para BRL pela cotação salva, sem alterar os registros existentes.")}</p>
      {currency!=="BRL"&&<p className="planning-warning">{data.exchangeRates?.[currency]?tr("Cotação de importação: 1 BRL = {0} {1} · {2}. Não é uma taxa histórica do banco.",data.exchangeRates[currency]!.rate,currency,data.exchangeRates[currency]!.date):tr("Salve uma cotação para essa moeda em Ajustes antes de importar.")}</p>}
      {table&&mapping&&<>
        <div className="form-grid"><label>{tr("Separador CSV")}<select aria-label={tr("Separador CSV")} value={delimiter} onChange={e=>{try{const next=readCsv(text,e.target.value);const originalCurrency=csvCurrency(next);if(originalCurrency)setCurrency(originalCurrency);setDelimiter(e.target.value);setTable(next);setMapping(guessMapping(next.headers));setError("");}catch(error){setError((error as Error).message);}}}><option value="auto">{tr("Automático")}</option><option value=";">{tr("Ponto e vírgula")}</option><option value=",">{tr("Vírgula")}</option><option value={"\t"}>{tr("Tabulação")}</option></select></label><label>{tr("Ordem da data")}<select aria-label={tr("Ordem da data")} value={order} onChange={e=>setOrder(e.target.value as "DMY"|"MDY")}><option value="DMY">{tr("Dia / mês / ano")}</option><option value="MDY">{tr("Mês / dia / ano")}</option></select></label><label>{tr("Separador decimal")}<select aria-label={tr("Separador decimal")} value={decimal} onChange={e=>setDecimal(e.target.value as "."|",")}><option value=",">{tr("Vírgula: 1.234,56")}</option><option value=".">{tr("Ponto: 1,234.56")}</option></select></label></div>
        <fieldset className="statement-mapping"><legend>{tr("Colunas do arquivo")}</legend><div className="form-grid">{([['date',tr("Coluna de data")],['description',tr("Coluna de descrição")],['amount',tr("Coluna de valor")],['debit',tr("Coluna de débito")],['credit',tr("Coluna de crédito")],['type',tr("Coluna de tipo")],['identifier',tr("Coluna de identificador")]] as const).map(([key,label])=><label key={key}>{label}<select aria-label={label} value={mapping[key]} onChange={e=>setMapping({...mapping,[key]:Number(e.target.value)})}><option value={-1}>{tr("Não usar")}</option>{table.headers.map((h,i)=><option value={i} key={i}>{i+1} · {h.slice(0,100)}</option>)}</select></label>)}</div></fieldset>
        <p className="form-hint">{tr("Use uma coluna de valor com sinal, ou débito e crédito separados. O tipo é opcional; sem ele, negativo é despesa e positivo é receita. Datas ISO são aceitas em qualquer ordem.")}</p>
        <details><summary>{tr("Ver primeiras linhas do arquivo")}</summary><div className="statement-sample">{table.rows.slice(0,3).map((row,i)=><pre key={i}>{row.join(" | ").slice(0,800)}</pre>)}</div></details>
      </>}
      <button className="button primary" onClick={()=>{try{const parsed=statement??csvStatement(table!,mapping!.amount>=0?{...mapping!,debit:-1,credit:-1}:mapping!,order,decimal);setDrafts(reviewStatement(parsed,data,currency,account||undefined));setReviewed(parsed);setPage(0);setError("");}catch(error){setError((error as Error).message);}}}>{tr("Revisar lançamentos")}</button>
    </>}
    {drafts&&<>
      <div className="statement-summary"><strong>{tr("{0} de {1} lançamentos selecionados",selected.length,drafts.length)}</strong><span>{tr("Receitas: {0}",money(selected.filter(d=>d.transaction.type==="income").reduce((sum,d)=>sum+d.transaction.amountCents,0)))}</span><span>{tr("Despesas: {0}",money(selected.filter(d=>d.transaction.type==="expense").reduce((sum,d)=>sum+d.transaction.amountCents,0)))}</span><small>{tr("Moeda do extrato: {0}",currency)} · {account?data.accounts?.find(a=>a.id===account)?.name:tr("Sem conta")}</small></div>
      <p className="planning-warning">{tr("Duplicados identificados ficam bloqueados. Possíveis duplicados, transferências e pagamentos de fatura começam desmarcados. Confira antes de selecionar: uma fatura pode já estar representada pelas parcelas.")}</p>
      <div className="statement-bulk"><button className="text-button" onClick={()=>setDrafts(drafts.map(d=>({...d,selected:!d.duplicate&&!d.check,allowDuplicate:false})))}>{tr("Selecionar novos lançamentos")}</button><button className="text-button" onClick={()=>setDrafts(drafts.map(d=>({...d,selected:false,allowDuplicate:false})))}>{tr("Desmarcar todos")}</button></div>
      <ol className="statement-rows" start={page*pageSize+1}>{drafts.slice(page*pageSize,(page+1)*pageSize).map((draft,offset)=>{
        const index=page*pageSize+offset,t=draft.transaction;
        return <li key={t.id} className={draft.duplicate==="known"?"statement-known":""}>
          <label className="statement-include"><input type="checkbox" aria-label={tr("Importar lançamento {0}",index+1)} checked={draft.selected} disabled={draft.duplicate==="known"} onChange={e=>update(index,{selected:e.target.checked,allowDuplicate:e.target.checked&&draft.duplicate==="possible"})}/><strong>{t.description}</strong></label>
          <div className="statement-row-meta"><span>{prettyDate(t.date)} · {tr(t.type==="income"?"Receita":"Despesa")}</span><strong>{t.type==="expense"?"−":"+"}{money(t.amountCents)}</strong><small>{tr("Original: {0}",sourceAmount(reviewed!.rows[index].signedCents))}</small></div>
          {draft.duplicate&&<p className="budget-alert">{draft.duplicate==="known"?tr("Já importado: não será adicionado novamente."):tr("Possível duplicado: confira os registros existentes.")}</p>}{draft.check&&<p className="budget-alert">{tr("Confira se é transferência ou pagamento de fatura.")}</p>}
          <label>{tr("Categoria do lançamento {0}",index+1)}<select aria-label={tr("Categoria do lançamento {0}",index+1)} value={t.category} disabled={draft.duplicate==="known"} onChange={e=>update(index,{transaction:{...t,category:e.target.value}})}>{(t.type==="income"?INCOME_CATEGORIES:EXPENSE_CATEGORIES).map(c=><option key={c} value={c}>{tr(c)}</option>)}</select></label>
          <label className="statement-paid"><input type="checkbox" checked={t.paid} disabled={draft.duplicate==="known"} onChange={e=>update(index,{transaction:{...t,paid:e.target.checked}})}/>{t.type==="income"?tr("Esta receita já foi recebida"):tr("Esta despesa já foi paga")}</label>
        </li>;
      })}</ol>
      {drafts.length>pageSize&&<div className="statement-pages"><button className="button secondary" disabled={page===0} onClick={()=>setPage(page-1)}>{tr("Anterior")}</button><span>{tr("Página {0} de {1}",page+1,Math.ceil(drafts.length/pageSize))}</span><button className="button secondary" disabled={(page+1)*pageSize>=drafts.length} onClick={()=>setPage(page+1)}>{tr("Próxima")}</button></div>}
      <p className="form-hint">{tr("Datas futuras começam como previstas. Você pode ajustar as categorias e o status agora, e editar os demais campos depois em Finanças.")}</p>
      <div className="modal-footer"><button className="button secondary" onClick={()=>{setDrafts(undefined);setError("");}}>{tr("Voltar às opções")}</button><button className="button primary" disabled={!selected.length} onClick={()=>{if(onImport(drafts))onClose();}}>{selected.length===1?tr("Importar lançamento"):tr("Importar {0} lançamentos",selected.length)}</button></div>
    </>}
    {error&&<p role="alert" className="form-error">{error}</p>}
    <div className="statement-bottom"><button className="button secondary" onClick={onClose}>{tr("Cancelar")}</button>{!!text&&!drafts&&<button className="text-button" onClick={reset}>{tr("Escolher outro arquivo")}</button>}</div>
  </div>;
}

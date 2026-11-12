import { useDeferredValue, useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { AppData } from "../domain";
import { parseDate } from "../domain";
import { getLanguage, getLocale, t as tr } from "../i18n/core";
import { SEARCH_KINDS, searchRecords } from "../global-search";
import type { SearchKind, SearchResult } from "../global-search";

export function GlobalSearch({data,onOpen}:{data:AppData;onOpen:(result:SearchResult)=>void}) {
  const [query,setQuery]=useState(""),[kind,setKind]=useState<SearchKind|"all">("all"),[notesOnly,setNotesOnly]=useState(false);
  const deferred=useDeferredValue(query),language=getLanguage();
  const dates=useMemo(()=>new Intl.DateTimeFormat(getLocale(),{day:"2-digit",month:"short",year:"numeric"}),[language]);
  const found=useMemo(()=>searchRecords(data,deferred,kind,notesOnly),[data,deferred,kind,notesOnly,language]);
  return <div className="global-search">
    <label>{tr("Pesquisar em todo o aplicativo")}<div className="global-search-input"><Search size={18}/><input type="search" autoComplete="off" aria-label={tr("Pesquisar em todo o aplicativo")} maxLength={120} value={query} placeholder={tr("Nome, descrição, categoria, data ou anotação…")} onChange={e=>setQuery(e.target.value)}/></div></label>
    <div className="global-search-filters"><label>{tr("Tipo de resultado")}<select aria-label={tr("Tipo de resultado")} value={kind} onChange={e=>setKind(e.target.value as SearchKind|"all")}><option value="all">{tr("Tudo")}</option>{Object.entries(SEARCH_KINDS).map(([id,label])=><option key={id} value={id}>{tr(label)}</option>)}</select></label><label className="global-search-notes"><input type="checkbox" checked={notesOnly} onChange={e=>setNotesOnly(e.target.checked)}/>{tr("Buscar apenas nas anotações")}</label></div>
    <p className="form-hint">{tr("A busca inclui todos os meses e registros arquivados. O texto pesquisado não fica salvo.")}</p>
    <p role="status" aria-live="polite">{query.trim().length<2?tr("Digite pelo menos dois caracteres para buscar."):tr("{0} resultados encontrados; {1} exibidos.",found.total,found.items.length)}</p>
    {found.items.length>0&&<ul className="global-search-results">{found.items.map(result=><li key={`${result.kind}:${result.id}`}><button onClick={()=>onOpen(result)}><span className="neutral-tag">{tr(SEARCH_KINDS[result.kind])}{result.archived?` · ${tr("Arquivada")}`:""}</span><strong>{result.title}</strong><span>{result.detail}{result.date?` · ${dates.format(parseDate(result.date))}`:""}</span>{result.notes&&<small>{result.notes.slice(0,180)}</small>}<span className="global-search-open">{tr("Abrir registro")}</span></button></li>)}</ul>}
    {query.trim().length>=2&&!found.total&&<p className="planning-empty">{tr("Nenhum resultado. Tente outro termo ou ajuste os filtros.")}</p>}
  </div>;
}

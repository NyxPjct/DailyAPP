import { Star, Trash2 } from "lucide-react";
import { randomId } from "../domain";
import type { Task } from "../domain";
import { recordText, t as tr } from "../i18n/core";
import { useState } from "react";

export function SubtaskEditor({value,onChange}:{value:NonNullable<Task["subtasks"]>;onChange:(items:NonNullable<Task["subtasks"]>)=>void}) {
  const [title,setTitle]=useState("");
  const addStep=()=>{if(!title.trim()||value.length>=30)return;onChange([...value,{id:randomId(),title:title.trim(),completed:false}]);setTitle("");};
  return <fieldset className="subtask-editor"><legend>{tr("Subtarefas")}</legend><p className="form-hint">{tr("Divida a tarefa em até 30 etapas. A conclusão das etapas é independente da tarefa principal.")}</p>
    {value.map(child=><div className="subtask-edit-row" key={child.id}><input type="checkbox" aria-label={tr("Concluir etapa: {0}",child.title)} checked={child.completed} onChange={()=>onChange(value.map(c=>c.id===child.id?{...c,completed:!c.completed}:c))}/><span>{child.title}</span><button type="button" className="icon-button" aria-label={tr("Remover etapa: {0}",child.title)} onClick={()=>onChange(value.filter(c=>c.id!==child.id))}><Trash2 size={15}/></button></div>)}
    <label>{tr("Nova etapa")}<input maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.nativeEvent.isComposing){e.preventDefault();addStep();}}} /></label><button type="button" className="button secondary" disabled={!title.trim()||value.length>=30} onClick={addStep}>{tr("Adicionar etapa")}</button>
  </fieldset>;
}
export function DailyFocus({tasks,today,onToggle,onEdit,onRemove}:{tasks:Task[];today:string;onToggle:(t:Task)=>void;onEdit:(t:Task)=>void;onRemove:(t:Task)=>void}) {
  const items=tasks.filter(t=>t.focusDate===today);
  return <section className="panel v12-panel daily-focus" aria-label={tr("Três prioridades do dia")}><div className="planning-heading"><h2><Star size={18}/>{tr("Três prioridades do dia")}</h2><span className="neutral-tag">{items.filter(t=>t.completed).length}/{items.length}</span></div>
    {items.length?<ul className="v12-list">{items.map(t=><li key={t.id}><input type="checkbox" aria-label={tr("Concluir prioridade: {0}",recordText(t.id,t.title))} checked={t.completed} onChange={()=>onToggle(t)}/><button className="text-button" onClick={()=>onEdit(t)}>{recordText(t.id,t.title)}</button><button className="icon-button" aria-label={tr("Retirar prioridade: {0}",recordText(t.id,t.title))} onClick={()=>onRemove(t)}><Star size={15}/></button></li>)}</ul>:<p className="form-hint">{tr("Toque na estrela de uma tarefa para escolher até três prioridades para hoje. Suas outras tarefas continuam na agenda.")}</p>}
  </section>;
}

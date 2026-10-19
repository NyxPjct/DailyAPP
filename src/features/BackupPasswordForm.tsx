import { useEffect, useRef, useState } from "react";
import { t as tr } from "../i18n/core";

export function BackupPasswordForm({unlock,onSubmit,onClose}:{unlock?:boolean;onSubmit:(password:string, signal:AbortSignal)=>Promise<void>;onClose:()=>void}) {
  const [password,setPassword]=useState(""),[confirmation,setConfirmation]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(()=>()=>request.current?.abort(),[]);
  return <form onSubmit={async e=>{e.preventDefault();if(!unlock&&password!==confirmation){setError(tr("As senhas não coincidem."));return;}const controller=new AbortController();request.current=controller;setBusy(true);setError("");try{await onSubmit(password,controller.signal);}catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:tr("Não foi possível processar o backup."));}finally{if(!controller.signal.aborted)setBusy(false);}}}>
    <p className="form-hint">{unlock?tr("Digite a senha usada na exportação. Os dados só serão restaurados depois de conferir a prévia e confirmar."):tr("O arquivo será criptografado com AES-256-GCM. Use uma senha de pelo menos 12 caracteres e guarde-a: não é possível recuperá-la pelo app.")}</p>
    <label>{tr("Senha do backup")}<input type="password" minLength={unlock?1:12} maxLength={256} required autoComplete={unlock?"current-password":"new-password"} disabled={busy} value={password} onChange={e=>setPassword(e.target.value)}/></label>
    {!unlock&&<label>{tr("Confirmar senha")}<input type="password" minLength={12} maxLength={256} required autoComplete="new-password" disabled={busy} value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label>}
    {error&&<p className="form-error" role="alert">{error}</p>}<div className="modal-footer"><button className="button secondary" type="button" disabled={busy} onClick={onClose}>{tr("Cancelar")}</button><button className="button primary" type="submit" disabled={busy}>{busy?tr("Processando backup…"):unlock?tr("Desbloquear e conferir"):tr("Exportar com senha")}</button></div>
  </form>;
}

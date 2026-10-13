import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  ArrowRight,
  CheckCheck,
  Cloud,
  CloudOff,
  LoaderCircle,
  LogOut,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import App from "../App";
import { supabase, authRedirect } from "./client";
import { supabaseGateway } from "./gateway";
import {
  WorkspaceStore,
  readLocalData,
  mergeLocalData,
  hasLocalData,
  browserStorage,
} from "./workspace";
import type { WorkspaceSnapshot } from "./workspace";

function authMessage(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("invalid login")) return "E-mail ou senha incorretos.";
  if (message.includes("email not confirmed"))
    return "Confirme seu e-mail antes de entrar.";
  if (message.includes("already registered"))
    return "Este e-mail já possui uma conta. Entre ou recupere sua senha.";
  if (message.includes("rate limit") || message.includes("too many"))
    return "Muitas tentativas. Aguarde um pouco antes de tentar novamente.";
  if (message.includes("password"))
    return "Use uma senha com pelo menos 8 caracteres que atenda aos requisitos da conta.";
  return "Não foi possível concluir. Confira sua conexão e tente novamente.";
}

function AuthScreen({
  recovery = false,
  onLocal,
  onRecovered,
}: {
  recovery?: boolean;
  onLocal: () => void;
  onRecovered: () => void;
}) {
  const [mode, setMode] = useState<"login" | "signup" | "reset" | "recovery">(
    recovery ? "recovery" : "login",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (recovery) setMode("recovery");
  }, [recovery]);
  function change(next: typeof mode) {
    setMode(next);
    setError("");
    setMessage("");
    setPassword("");
    setConfirmation("");
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase || busy) return;
    setError("");
    setMessage("");
    if ((mode === "signup" || mode === "recovery") && password.length < 8) {
      setError("Use uma senha com pelo menos 8 caracteres.");
      return;
    }
    if (mode === "recovery" && password !== confirmation) {
      setError("As duas senhas precisam ser iguais.");
      return;
    }
    if (mode === "signup" && !name.trim()) {
      setError("Informe seu nome para criar a conta.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") {
        const result = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (result.error) throw result.error;
      }
      if (mode === "signup") {
        const result = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: authRedirect(),
          },
        });
        if (result.error) throw result.error;
        if (!result.data.session) {
          setMessage(
            "Confira seu e-mail para confirmar a conta. Depois, volte aqui para entrar.",
          );
          setPassword("");
        }
      }
      if (mode === "reset") {
        const result = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: authRedirect(),
        });
        if (result.error) throw result.error;
        setMessage(
          "Se houver uma conta com este e-mail, você receberá um link para redefinir a senha.",
        );
      }
      if (mode === "recovery") {
        const result = await supabase.auth.updateUser({ password });
        if (result.error) throw result.error;
        setPassword("");
        setConfirmation("");
        onRecovered();
      }
    } catch (failure) {
      setError(authMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  const title =
    mode === "signup"
      ? "Seu novo começo."
      : mode === "reset"
        ? "Vamos recuperar seu acesso."
        : mode === "recovery"
          ? "Escolha uma nova senha."
          : "Bem-vindo de volta.";
  return (
    <main className="auth-shell">
      <section className="auth-story">
        <div className="auth-brand">
          <span className="brand-mark">
            <CheckCheck size={27} />
          </span>
          <strong>dailyapp.</strong>
        </div>
        <span className="eyebrow">SUA VIDA, EM EQUILÍBRIO</span>
        <h1>
          Mais tempo para viver.
          <br />
          Mais clareza para escolher.
        </h1>
        <p>
          Sua agenda e seu dinheiro caminham juntos. Cuide deles em um espaço só
          seu.
        </p>
        <div className="auth-benefits">
          <span>
            <CheckCheck size={19} />
            Uma rotina com prioridades claras
          </span>
          <span>
            <Cloud size={19} />
            Seus dados em todos os seus dispositivos
          </span>
          <span>
            <ShieldCheck size={19} />
            Uma conta só sua, com acesso protegido
          </span>
        </div>
        <span className="auth-story-foot">Um dia de cada vez.</span>
      </section>
      <section className="auth-card">
        <div className="eyebrow">SEU ESPAÇO PESSOAL</div>
        <h2>{title}</h2>
        <p>
          {mode === "signup"
            ? "Crie uma conta para levar sua organização com você."
            : mode === "reset"
              ? "Enviaremos um link para o e-mail da sua conta."
              : mode === "recovery"
                ? "Uma senha nova para continuar sua jornada."
                : "Entre para encontrar sua rotina onde você estiver."}
        </p>
        <form onSubmit={submit}>
          {mode === "signup" && (
            <label>
              Seu nome
              <input
                required
                maxLength={60}
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          )}
          {mode !== "recovery" && (
            <label>
              E-mail
              <input
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
              />
            </label>
          )}
          {mode !== "reset" && (
            <label>
              {mode === "recovery" ? "Nova senha" : "Senha"}
              <input
                type="password"
                required
                minLength={mode === "login" ? 1 : 8}
                maxLength={128}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}
          {mode === "recovery" && (
            <label>
              Confirmar nova senha
              <input
                type="password"
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </label>
          )}
          {mode === "login" && (
            <button
              type="button"
              className="text-button forgot-button"
              onClick={() => change("reset")}
            >
              Esqueci minha senha
            </button>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="auth-success" role="status">
              {message}
            </p>
          )}
          <button
            className="button primary auth-submit"
            disabled={busy || !supabase}
          >
            {busy ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <ArrowRight size={17} />
            )}
            {busy
              ? "Aguarde…"
              : mode === "signup"
                ? "Criar minha conta"
                : mode === "reset"
                  ? "Enviar link de recuperação"
                  : mode === "recovery"
                    ? "Salvar nova senha"
                    : "Entrar"}
          </button>
        </form>
        {mode !== "recovery" && (
          <>
            <div className="auth-switch">
              {mode === "login"
                ? "Ainda não tem uma conta?"
                : "Já tem uma conta?"}
              <button
                className="text-button"
                onClick={() => change(mode === "login" ? "signup" : "login")}
              >
                {mode === "login" ? "Criar conta" : "Entrar"}
              </button>
            </div>
            <button className="auth-local" onClick={onLocal}>
              Continuar apenas neste dispositivo <ArrowRight size={14} />
            </button>
          </>
        )}
        <small>
          Seus dados locais podem ser importados depois que você entrar.
        </small>
      </section>
    </main>
  );
}

export interface AccountControls {
  email: string;
  snapshot: WorkspaceSnapshot;
  store: WorkspaceStore;
  logout: () => Promise<void>;
  migrate: () => void;
  localAvailable: boolean;
}

function SignedInApp({
  session,
  logout,
}: {
  session: Session;
  logout: () => Promise<void>;
}) {
  const store = useMemo(
    () =>
      new WorkspaceStore(
        session.user.id,
        supabaseGateway(supabase!, session.user.id),
        browserStorage,
        typeof session.user.user_metadata.full_name === "string"
          ? session.user.user_metadata.full_name
          : "",
      ),
    [session.user.id],
  );
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [message, setMessage] = useState("");
  const local = readLocalData(browserStorage);
  let localAvailable = false;
  try {
    localAvailable =
      !!local &&
      hasLocalData(local) &&
      JSON.stringify(mergeLocalData(snapshot.data, local)) !==
        JSON.stringify(snapshot.data);
  } catch {
    localAvailable = !!local;
  }
  useEffect(() => {
    void store.start();
    const refresh = () => {
      if (document.visibilityState === "visible") void store.refresh();
    };
    const online = () => void store.refresh();
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("online", online);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      store.stop();
      clearTimeout(timer);
      window.removeEventListener("online", online);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [store]);
  if (snapshot.status === "loading")
    return (
      <div className="account-loading" role="status">
        <LoaderCircle size={25} className="spin" />
        <h1>Preparando seu espaço…</h1>
        <p>Estamos buscando os dados da sua conta.</p>
      </div>
    );
  const controls: AccountControls = {
    email: session.user.email ?? "",
    store,
    snapshot,
    logout,
    localAvailable,
    migrate: () => {
      if (!local) return;
      try {
        if (store.save(mergeLocalData(snapshot.data, local)))
          setMessage(
            "Registros locais importados. A cópia original foi preservada.",
          );
        else setMessage(store.getSnapshot().message);
      } catch {
        setMessage(
          "Não foi possível importar todos os registros. Exporte um backup e confira o limite da sua conta.",
        );
      }
    },
  };
  return (
    <>
      <div className={"account-bar sync-" + snapshot.status}>
        {snapshot.status === "synced" ? (
          <Cloud size={16} />
        ) : snapshot.status === "pending" ? (
          <LoaderCircle size={16} className="spin" />
        ) : (
          <CloudOff size={16} />
        )}
        <span>{snapshot.message}</span>
        <button
          onClick={() => void store.refresh()}
          disabled={
            snapshot.status === "pending" || snapshot.status === "conflict"
          }
        >
          <RefreshCw size={14} />
          Sincronizar
        </button>
        <button
          aria-label="Sair da conta"
          disabled={snapshot.pending}
          title={
            snapshot.pending
              ? "Sincronize ou resolva as alterações pendentes antes de sair."
              : undefined
          }
          onClick={() =>
            void logout().catch(() =>
              setMessage("Não foi possível sair. Tente novamente."),
            )
          }
        >
          <LogOut size={14} />
          Sair
        </button>
      </div>
      {message && (
        <div className="account-notice" role="status">
          {message}
          <button
            aria-label="Fechar aviso da conta"
            onClick={() => setMessage("")}
          >
            ×
          </button>
        </div>
      )}
      <App key={session.user.id} workspace={store} account={controls} />
    </>
  );
}

export default function AccountApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!!supabase);
  const [localMode, setLocalMode] = useState(!supabase);
  const [recovery, setRecovery] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (!mounted) return;
      setSession(next);
      setLoading(false);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (event === "SIGNED_OUT") {
        setLocalMode(false);
        setRecovery(false);
      }
      if (next) setLocalMode(false);
    });
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) {
          setSession(data.session);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);
  if (loading)
    return (
      <div className="account-loading" role="status">
        <LoaderCircle size={25} className="spin" />
        <p>Verificando seu acesso…</p>
      </div>
    );
  if (recovery)
    return (
      <AuthScreen
        recovery
        onLocal={() => setLocalMode(true)}
        onRecovered={() => {
          setRecovery(false);
          window.history.replaceState(null, "", window.location.pathname);
        }}
      />
    );
  if (session)
    return (
      <SignedInApp
        key={session.user.id}
        session={session}
        logout={async () => {
          const { error } = await supabase!.auth.signOut({ scope: "local" });
          if (error) throw error;
        }}
      />
    );
  if (localMode)
    return (
      <App
        localAccount={{
          available: !!supabase,
          login: () => setLocalMode(false),
        }}
      />
    );
  return (
    <AuthScreen
      onLocal={() => setLocalMode(true)}
      onRecovered={() => setRecovery(false)}
    />
  );
}

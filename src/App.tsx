import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  ArrowDownLeft,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Coffee,
  Download,
  Ellipsis,
  Flag,
  LayoutDashboard,
  Leaf,
  ListTodo,
  Menu,
  Pencil,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  Trash2,
  TrendingUp,
  Upload,
  Wallet,
  X,
  Bell,
  Repeat2,
} from "lucide-react";
import {
  STORAGE_KEY,
  TASK_CATEGORIES,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  PRIORITIES,
  freshData,
  randomId,
  dateKey,
  parseDate,
  monthKey,
  shiftMonth,
  monthLabel,
  prettyDate,
  money,
  amountInput,
  parseAmount,
  validDate,
  normalize,
  sortTasks,
  summary,
  validateData,
  createDemo,
  FREQUENCIES,
} from "./domain";
import type { AppData, Task, Transaction, Frequency, CreditCard } from "./domain";
import { materializeRecurrences, repeatingTask, repeatingTransaction, stopRecurrence, purchaseInstallments, cardSummary } from "./planning";
import { CardsPanel, CardForm, PurchaseForm, RecurrencePanel } from "./features/PlanningPanels";
import type { PurchaseInput } from "./features/PlanningPanels";
import { initialReminderState, syncReminders, requestReminderPermission, attachReminderTap } from "./mobile/reminders";
import type { ReminderState } from "./mobile/reminders";
import type { WorkspaceStore } from "./cloud/workspace";
import type { AccountControls } from "./cloud/AccountApp";
import {
  attachAndroidBackButton,
  attachMobileResume,
  minimizeMobile,
  saveBackup,
} from "./mobile/platform";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-700.css";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-700.css";
import "@fontsource/manrope/latin-800.css";

type View = "overview" | "tasks" | "calendar" | "finance" | "settings";
const mobileApp = import.meta.env.VITE_MOBILE_APP === true;
const INTRO_KEY = "dailyapp.intro.v1";
function introductionDone() {
  try { return localStorage.getItem(INTRO_KEY) === "1"; }
  catch { return false; }
}
type Editor =
  | { kind: "task"; item?: Task; date?: string }
  | { kind: "transaction"; item?: Transaction; type?: Transaction["type"] }
  | { kind: "budget" }
  | { kind: "card"; item?: CreditCard }
  | { kind: "purchase"; cardId: string }
  | null;
const navItems = [
  { id: "overview" as const, label: "Visão geral", icon: LayoutDashboard },
  { id: "calendar" as const, label: "Minha agenda", icon: CalendarDays },
  { id: "tasks" as const, label: "Minhas tarefas", icon: ListTodo },
  { id: "finance" as const, label: "Minhas finanças", icon: Wallet },
];
const categoryColors: Record<string, string> = {
  Alimentação: "#dea26f",
  Moradia: "#477d64",
  Transporte: "#86a8cd",
  Saúde: "#a4bb87",
  Lazer: "#b39aca",
  Educação: "#dbc06a",
  Compras: "#c9868c",
  Outros: "#a0aaa4",
};

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return {
      data: saved ? validateData(JSON.parse(saved)) : freshData(),
      error: "",
      present: saved !== null,
    };
  } catch {
    return {
      data: freshData(),
      error:
        "Não foi possível ler os dados salvos. Abra as configurações para recuperar um backup ou reiniciar.",
      present: true,
    };
  }
}

function Modal({
  title,
  subtitle,
  children,
  onClose,
  small = false,
  focusFirstInput = true,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  small?: boolean;
  focusFirstInput?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const previousFocus = useRef(document.activeElement as HTMLElement | null);
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    (
      (focusFirstInput ? ref.current?.querySelector<HTMLElement>("input, select, textarea") : null) ??
      ref.current?.querySelector<HTMLElement>("button")
    )?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previousFocus.current?.focus();
    };
  }, [focusFirstInput]);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={`modal ${small ? "modal-small" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Tab") {
            const elements = [
              ...(ref.current?.querySelectorAll<HTMLElement>(
                'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
              ) ?? []),
            ].filter((el) => el.getClientRects().length);
            const first = elements[0],
              last = elements[elements.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            }
            if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <div className="modal-header">
          <div>
            <h2 id="modal-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon-button"
            aria-label="Fechar janela"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function MobileIntroduction({ onFinish, onSkip }: {
  onFinish: (name: string, budget: number | null) => boolean;
  onSkip: () => void;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  return (
    <Modal title="Seu dia começa aqui." subtitle="Bem-vindo ao DailyAPP. Vamos abrir espaço para sua rotina." onClose={onSkip} focusFirstInput={false}>
      <div className="intro-features">
        <div><CalendarDays size={21} /><p><strong>Agenda e tarefas</strong><span>Organize seus compromissos e marque o que já concluiu.</span></p></div>
        <div><Wallet size={21} /><p><strong>Finanças com clareza</strong><span>Acompanhe receitas, despesas e o limite de gastos do mês.</span></p></div>
        <div><ShieldCheck size={21} /><p><strong>Seu espaço pessoal</strong><span>Funciona sem internet e sem conta. Os registros ficam neste aparelho.</span></p></div>
      </div>
      <form className="intro-form" onSubmit={(event) => {
        event.preventDefault();
        const budget = amount.trim() ? parseAmount(amount) : null;
        if (amount.trim() && budget === null) {
          setError("Informe um valor maior que zero ou deixe o orçamento em branco.");
          return;
        }
        onFinish(name.trim(), budget);
      }}>
        <label>Como você quer ser chamado? <span className="optional">(opcional)</span>
          <input maxLength={60} autoComplete="given-name" placeholder="Ex.: Ana" value={name} onChange={event => setName(event.target.value)} />
        </label>
        <label>Limite de gastos do mês (R$) <span className="optional">(opcional)</span>
          <input inputMode="decimal" placeholder="Ex.: 2.500,00" value={amount} onChange={event => { setAmount(event.target.value); setError(""); }} />
        </label>
        <p className="intro-note">Você pode ajustar tudo depois. Em Ajustes, exporte backups para guardar uma cópia dos seus registros.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-footer">
          <button className="button secondary" type="button" onClick={onSkip}>Começar sem configurar</button>
          <button className="button primary" type="submit">Começar <ArrowRight size={16} /></button>
        </div>
      </form>
    </Modal>
  );
}

function MobileHelp({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Guia rápido" subtitle="Um registro de cada vez. Mais clareza no seu dia." onClose={onClose} focusFirstInput={false}>
      <div className="mobile-help">
        <div><ListTodo size={22} /><section><h3>Organize o dia</h3><p>Em Hoje ou Tarefas, crie uma tarefa com data e horário. Escolha Repetir para uma rotina diária, semanal, mensal ou anual. Marque o círculo quando concluir e gerencie as rotinas em Tarefas.</p></section></div>
        <div><Wallet size={22} /><section><h3>Acompanhe seu dinheiro</h3><p>Registre receitas e despesas. Marque como recebida ou paga para incluir no saldo; os valores previstos continuam visíveis para seu planejamento.</p></section></div>
        <div><Target size={22} /><section><h3>Defina seu orçamento</h3><p>Em Finanças, escolha o mês e defina um limite de gastos. O orçamento considera despesas pagas e previstas.</p></section></div>
        <div><Wallet size={22} /><section><h3>Controle cartões e parcelas</h3><p>Em Finanças → Cartões e parcelas, cadastre o cartão e registre o valor total de cada compra. As parcelas entram nas faturas. Marcar uma fatura como paga atualiza os gastos sem duplicá-los.</p></section></div>
        <div><Bell size={22} /><section><h3>Receba lembretes</h3><p>Escolha um lembrete na tarefa, conta ou cartão e permita notificações no celular. Ao concluir ou pagar, os próximos avisos são retirados. Em Ajustes, confira os lembretes programados.</p></section></div>
        <div><Download size={22} /><section><h3>Guarde uma cópia</h3><p>Em Ajustes, exporte um backup e escolha onde guardar o arquivo. Para transferir os dados a outro aparelho, importe esse JSON e confirme a restauração.</p></section></div>
      </div>
      <p className="intro-note">Os registros ficam neste aparelho. Desinstalar o aplicativo ou limpar seus dados pode removê-los. Guarde um backup antes de trocar de celular.</p>
      <div className="modal-footer"><button className="button primary" onClick={onClose}>Entendi</button></div>
    </Modal>
  );
}

function Empty({
  icon = <Leaf size={25} />,
  title,
  text,
  action,
}: {
  icon?: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

function MonthControl({
  month,
  onChange,
}: {
  month: string;
  onChange: (month: string) => void;
}) {
  return (
    <div className="month-control">
      <button
        aria-label="Mês anterior"
        className="icon-button"
        onClick={() => onChange(shiftMonth(month, -1))}
      >
        <ChevronLeft size={17} />
      </button>
      <span>{monthLabel(month)}</span>
      <button
        aria-label="Próximo mês"
        className="icon-button"
        onClick={() => onChange(shiftMonth(month, 1))}
      >
        <ChevronRight size={17} />
      </button>
    </div>
  );
}

function TaskRow({
  task,
  onToggle,
  onEdit,
  onDelete,
  withDate = false,
}: {
  task: Task;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  withDate?: boolean;
}) {
  const overdue = !task.completed && task.date < dateKey();
  return (
    <div className={`task-row ${task.completed ? "task-done" : ""}`}>
      <button
        className="task-check"
        role="checkbox"
        aria-checked={task.completed}
        aria-label={`${task.completed ? "Reabrir" : "Concluir"} tarefa: ${task.title}`}
        onClick={onToggle}
      >
        {task.completed && <Check size={14} strokeWidth={3} />}
      </button>
      <button className="task-content" onClick={onEdit}>
        <span className="task-title">{task.title}</span>
        <span className="task-meta">
          {(task.time || withDate) && (
            <span className={overdue ? "overdue" : ""}>
              <Clock3 size={12} />
              {withDate ? prettyDate(task.date) : ""}
              {withDate && task.time ? " · " : ""}
              {task.time}
              {overdue ? " · Atrasada" : ""}
            </span>
          )}
          <span className={`tag category-${task.category.toLowerCase()}`}>
            {task.category}
          </span>
          {task.recurrenceId && <span className="planning-badge"><Repeat2 size={12} />Recorrente</span>}
          {task.reminderMinutes !== undefined && <span className="planning-badge"><Bell size={12} />Lembrete</span>}
        </span>
      </button>
      <span
        className={`priority priority-${task.priority === "Alta" ? "high" : task.priority === "Média" ? "medium" : "low"}`}
        title={`Prioridade ${task.priority.toLowerCase()}`}
      >
        <Flag size={13} />
        <span>{task.priority}</span>
      </span>
      <div className="row-actions">
        <button
          className="icon-button"
          aria-label={`Editar tarefa: ${task.title}`}
          onClick={onEdit}
        >
          <Pencil size={15} />
        </button>
        <button
          className="icon-button danger-hover"
          aria-label={`Excluir tarefa: ${task.title}`}
          onClick={onDelete}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

function FinanceChart({
  entries,
  month,
}: {
  entries: Transaction[];
  month: string;
}) {
  const days = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5, 7)),
    0,
  ).getDate();
  const series = (type: Transaction["type"]) =>
    Array.from({ length: days }, (_, i) =>
      entries
        .filter(
          (t) => t.paid && t.type === type && Number(t.date.slice(8)) <= i + 1,
        )
        .reduce((acc, t) => acc + t.amountCents, 0),
    );
  const income = series("income"),
    expense = series("expense");
  const max = Math.max(...income, ...expense, 10000) * 1.2;
  const x = (i: number) => 62 + (i / (days - 1)) * 534,
    y = (v: number) => 180 - (v / max) * 145;
  const line = (values: number[]) =>
    values.map((v, i) => `${i ? "L" : "M"} ${x(i)} ${y(v)}`).join(" ");
  return (
    <div className="chart-wrap">
      <svg
        viewBox="0 0 620 218"
        role="img"
        aria-label={`Receitas e despesas pagas acumuladas em ${monthLabel(month)}: receitas ${money(income.at(-1) ?? 0)}, despesas ${money(expense.at(-1) ?? 0)}`}
      >
        <defs>
          <linearGradient id="income-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#75a68b" stopOpacity=".2" />
            <stop offset="100%" stopColor="#75a68b" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((p) => (
          <g key={p}>
            <line
              x1="62"
              y1={y(max * p)}
              x2="596"
              y2={y(max * p)}
              stroke="#e9ece8"
              strokeDasharray="4 5"
            />
            <text
              x="49"
              y={y(max * p) + 4}
              textAnchor="end"
              fill="#7b837d"
              fontSize="11"
            >
              {Math.round((max * p) / 100).toLocaleString("pt-BR")}
            </text>
          </g>
        ))}
        <path
          d={`${line(income)} L596 180 L62 180Z`}
          fill="url(#income-fill)"
        />
        <path
          d={line(income)}
          fill="none"
          stroke="#3d795b"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path
          d={line(expense)}
          fill="none"
          stroke="#d69a73"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {[1, 7, 14, 21, days].map((day) => (
          <text
            key={day}
            x={x(day - 1)}
            y="208"
            textAnchor="middle"
            fill="#7b837d"
            fontSize="11"
          >
            {String(day).padStart(2, "0")}
          </text>
        ))}
      </svg>
    </div>
  );
}

function Expenses({ entries }: { entries: Transaction[] }) {
  const amounts = EXPENSE_CATEGORIES.map((category) => ({
    category,
    amount: entries
      .filter((t) => t.type === "expense" && t.category === category)
      .reduce((acc, t) => acc + t.amountCents, 0),
  }))
    .filter((t) => t.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const total = amounts.reduce((acc, t) => acc + t.amount, 0);
  let cursor = 0;
  const gradient = amounts
    .map((t) => {
      const start = cursor;
      cursor += (t.amount / total) * 100;
      return `${categoryColors[t.category]} ${start}% ${cursor}%`;
    })
    .join(", ");
  if (!total)
    return (
      <Empty
        icon={<Wallet size={25} />}
        title="Cada gasto conta"
        text="Registre sua primeira despesa para conhecer seus hábitos."
      />
    );
  return (
    <div className="expenses-content">
      <div
        className="donut"
        role="img"
        aria-label={`Total de despesas registradas: ${money(total)}`}
        style={{ background: `conic-gradient(${gradient})` }}
      >
        <div>
          <span>Despesas</span>
          <strong>{money(total)}</strong>
        </div>
      </div>
      <div className="category-list">
        {amounts.map((t) => (
          <div className="category-line" key={t.category}>
            <span
              className="category-dot"
              style={{ background: categoryColors[t.category] }}
            />
            <span>{t.category}</span>
            <strong>{money(t.amount)}</strong>
            <small>{Math.round((t.amount / total) * 100)}%</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskForm({
  item,
  date,
  onSave,
  onClose,
  recurrenceFrequency,
}: {
  item?: Task;
  date?: string;
  onSave: (task: Task, frequency?: Frequency) => boolean;
  onClose: () => void;
  recurrenceFrequency?: Frequency;
}) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [day, setDay] = useState(item?.date ?? date ?? dateKey());
  const [time, setTime] = useState(item?.time ?? "");
  const [category, setCategory] = useState<Task["category"]>(
    item?.category ?? "Pessoal",
  );
  const [priority, setPriority] = useState<Task["priority"]>(
    item?.priority ?? "Média",
  );
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [frequency, setFrequency] = useState<Frequency | "">(recurrenceFrequency ?? "");
  const [reminder, setReminder] = useState(item?.reminderMinutes ?? -1);
  const [error, setError] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !validDate(day)) {
      setError("Informe um título e uma data válida entre 1900 e 2200.");
      return;
    }
    if (reminder >= 0 && !time) { setError("Defina um horário para o lembrete da tarefa."); return; }
    if (
      onSave({
        ...item,
        id: item?.id ?? randomId(),
        title: title.trim(),
        date: day,
        time,
        category,
        priority,
        notes: notes.trim(),
        completed: item?.completed ?? false,
        reminderMinutes: reminder >= 0 ? reminder : undefined,
      }, !item?.recurrenceId && frequency ? frequency : undefined)
    )
      onClose();
  }
  return (
    <Modal
      title={item ? "Editar tarefa" : "Nova tarefa"}
      subtitle="Abra espaço para o que importa no seu dia."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <label>
          O que você precisa fazer?
          <input
            autoFocus
            required
            maxLength={120}
            placeholder="Ex.: Agendar consulta médica"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <div className="form-grid">
          <label>
            Data
            <input
              type="date"
              min="1900-01-01"
              max="2200-12-31"
              required
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </label>
          <label>
            Horário <span className="optional">(opcional)</span>
            <input
              type="time"
              value={time}
              onChange={(e) => { setTime(e.target.value); if (!e.target.value) setReminder(-1); }}
            />
          </label>
        </div>
        <div className="form-grid">
          <label>
            Categoria
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Task["category"])}
            >
              {TASK_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Prioridade
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Task["priority"])}
            >
              {PRIORITIES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Observações <span className="optional">(opcional)</span>
          <textarea
            maxLength={1000}
            rows={3}
            placeholder="Algum detalhe para lembrar?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <div className="form-grid">
          <label>Repetir tarefa<select aria-label="Repetir tarefa" value={frequency} disabled={!!item?.recurrenceId} onChange={e => setFrequency(e.target.value as Frequency | "")}><option value="">Não repetir</option>{Object.entries(FREQUENCIES).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label>Lembrete da tarefa<select aria-label="Lembrete da tarefa" value={reminder} disabled={!time} onChange={e => setReminder(Number(e.target.value))}><option value={-1}>Sem lembrete</option><option value={0}>No horário</option><option value={5}>5 minutos antes</option><option value={15}>15 minutos antes</option><option value={30}>30 minutos antes</option><option value={60}>1 hora antes</option><option value={1440}>1 dia antes</option></select></label>
        </div>
        <p className="form-hint">{item?.recurrenceId ? "Esta edição altera só esta ocorrência. Para encerrar a rotina, use Parar repetição em Tarefas." : "Repetições criam as próximas tarefas sem marcá-las como concluídas."} {!time ? "Defina um horário para ativar um lembrete." : "Lembretes aparecem no aplicativo instalado, com sua permissão."}</p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary" type="submit">
            <Check size={16} />
            {item ? "Salvar alterações" : "Criar tarefa"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function TransactionForm({
  item,
  type,
  onSave,
  onClose,
  recurrenceFrequency,
}: {
  item?: Transaction;
  type?: Transaction["type"];
  onSave: (transaction: Transaction, frequency?: Frequency) => boolean;
  onClose: () => void;
  recurrenceFrequency?: Frequency;
}) {
  const [kind, setKind] = useState<Transaction["type"]>(
    item?.type ?? type ?? "expense",
  );
  const [description, setDescription] = useState(item?.description ?? "");
  const [amount, setAmount] = useState(
    item ? amountInput(item.amountCents) : "",
  );
  const [day, setDay] = useState(item?.date ?? dateKey());
  const [category, setCategory] = useState(
    item?.category ?? (type === "income" ? "Salário" : "Alimentação"),
  );
  const [paid, setPaid] = useState(item?.paid ?? true);
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [frequency, setFrequency] = useState<Frequency | "">(recurrenceFrequency ?? "");
  const [reminder, setReminder] = useState(item?.reminderMinutes ?? -1);
  const [error, setError] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    const cents = parseAmount(amount);
    if (!cents) {
      setError(
        "Informe um valor maior que zero, com até duas casas decimais. Ex.: 125,90.",
      );
      return;
    }
    if (!description.trim() || !validDate(day)) {
      setError("Informe uma descrição e uma data válida entre 1900 e 2200.");
      return;
    }
    if (
      onSave({
        ...item,
        id: item?.id ?? randomId(),
        description: description.trim(),
        amountCents: cents,
        date: day,
        category,
        type: kind,
        paid,
        notes: notes.trim(),
        reminderMinutes: reminder >= 0 ? reminder : undefined,
      }, !item?.recurrenceId && frequency ? frequency : undefined)
    )
      onClose();
  }
  return (
    <Modal
      title={item ? "Editar movimentação" : "Nova movimentação"}
      subtitle="Um registro de cada vez. Mais clareza para seu dinheiro."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="type-toggle">
          <button
            type="button"
            className={kind === "expense" ? "selected expense-selected" : ""}
            disabled={!!item?.installment}
            onClick={() => {
              setKind("expense");
              setCategory("Alimentação");
            }}
          >
            <ArrowUpRight size={16} />
            Despesa
          </button>
          <button
            type="button"
            className={kind === "income" ? "selected" : ""}
            disabled={!!item?.installment}
            onClick={() => {
              setKind("income");
              setCategory("Salário");
            }}
          >
            <ArrowDownLeft size={16} />
            Receita
          </button>
        </div>
        <label>
          Descrição
          <input
            autoFocus
            required
            maxLength={120}
            placeholder={
              kind === "expense"
                ? "Ex.: Compras do supermercado"
                : "Ex.: Salário do mês"
            }
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <div className="form-grid">
          <label>
            Valor (R$)
            <input
              required
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label>
            Data
            <input
              type="date"
              min="1900-01-01"
              max="2200-12-31"
              required
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </label>
        </div>
        <label>
          Categoria
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {(kind === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map(
              (c) => (
                <option key={c}>{c}</option>
              ),
            )}
          </select>
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={paid}
            onChange={(e) => setPaid(e.target.checked)}
          />
          <span>
            {kind === "expense"
              ? "Esta despesa já foi paga"
              : "Esta receita já foi recebida"}
            <small>
              {paid
                ? "Será incluída no saldo do mês."
                : "Ficará registrada como prevista."}
            </small>
          </span>
        </label>
        <label>
          Observações <span className="optional">(opcional)</span>
          <textarea
            rows={2}
            maxLength={1000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Adicione um detalhe, se quiser"
          />
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {!item?.installment && <div className="form-grid">
          <label>Repetir movimentação<select aria-label="Repetir movimentação" value={frequency} disabled={!!item?.recurrenceId} onChange={e => { const value = e.target.value as Frequency | ""; setFrequency(value); if (value && !item) setPaid(false); }}><option value="">Não repetir</option>{Object.entries(FREQUENCIES).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label>Lembrete da conta<select aria-label="Lembrete da conta" value={reminder} onChange={e => setReminder(Number(e.target.value))}><option value={-1}>Sem lembrete</option><option value={0}>Na data, às 9h</option><option value={1440}>1 dia antes, às 9h</option><option value={4320}>3 dias antes, às 9h</option></select></label>
        </div>}
        {(frequency || item?.recurrenceId) && <p className="form-hint">{item?.recurrenceId ? "Esta edição altera só esta ocorrência. Gerencie a rotina em Finanças." : "As próximas movimentações ficam previstas até você marcar o pagamento ou recebimento."}</p>}
        {item?.installment && <p className="form-hint">Parcela {item.installment.index}/{item.installment.count}. Esta edição altera só esta parcela. O lembrete da fatura é configurado no cartão.</p>}
        <div className="modal-footer">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary" type="submit">
            <Check size={16} />
            {item ? "Salvar alterações" : "Registrar movimentação"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function BudgetForm({
  month,
  budget,
  onSave,
  onClose,
}: {
  month: string;
  budget: number;
  onSave: (amount: number) => boolean;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(budget ? amountInput(budget) : "");
  const [error, setError] = useState("");
  return (
    <Modal
      title="Seu orçamento do mês"
      subtitle={`Defina quanto deseja gastar em ${monthLabel(month)}.`}
      onClose={onClose}
      small
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const cents = parseAmount(amount);
          if (!cents) {
            setError("Informe um limite maior que zero.");
            return;
          }
          if (onSave(cents)) onClose();
        }}
      >
        <label>
          Limite de despesas (R$)
          <input
            autoFocus
            required
            inputMode="decimal"
            placeholder="Ex.: 3.000,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <p className="form-hint">
          Despesas pagas e previstas contam para o orçamento. O limite é
          exclusivo deste mês.
        </p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary" type="submit">
            Salvar orçamento
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function App({
  workspace,
  account,
  localAccount,
}: {
  workspace?: WorkspaceStore;
  account?: AccountControls;
  localAccount?: { available: boolean; login: () => void };
}) {
  const [loaded] = useState(loadData);
  const [localData, setData] = useState<AppData>(loaded.data);
  const data = account?.snapshot.data ?? localData;
  const [localStorageError, setStorageError] = useState(loaded.error);
  const storageError = workspace ? "" : localStorageError;
  const [view, setView] = useState<View>("overview");
  const [month, setMonth] = useState(monthKey());
  const [selectedDate, setSelectedDate] = useState(dateKey());
  const [editor, setEditor] = useState<Editor>(null);
  const [confirm, setConfirm] = useState<{
    title: string;
    text: string;
    action: () => void;
    destructive?: boolean;
  } | null>(null);
  const [toast, setToast] = useState("");
  const [welcomeOpen, setWelcomeOpen] = useState(() => mobileApp && !workspace && !loaded.present && !loaded.error && !introductionDone());
  const [helpOpen, setHelpOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(
    () => mobileApp || window.matchMedia("(max-width: 760px)").matches,
  );
  const [taskFilter, setTaskFilter] = useState("Todas");
  const [taskSearch, setTaskSearch] = useState("");
  const [financeFilter, setFinanceFilter] = useState("Todas");
  const [financeStatus, setFinanceStatus] = useState("Todos os status");
  const [financeSearch, setFinanceSearch] = useState("");
  const [financeTab, setFinanceTab] = useState<"summary" | "cards">("summary");
  const [today, setToday] = useState(dateKey);
  const [refreshTick, setRefreshTick] = useState(0);
  const [reminders, setReminders] = useState<ReminderState>(initialReminderState);
  const dataRef = useRef(data); dataRef.current = data;
  const reminderTap = useRef<(kind: string, id: string, month?: string) => void>(() => {});
  reminderTap.current = (kind, id, reminderMonth) => {
    if (kind === "task" && data.tasks.some(t => t.id === id)) go("tasks");
    else if (kind === "transaction" && data.transactions.some(t => t.id === id)) { setMonth(data.transactions.find(t => t.id === id)!.date.slice(0, 7)); setFinanceTab("summary"); go("finance"); }
    else if (kind === "card" && data.cards?.some(c => c.id === id)) { if (reminderMonth) changeMonth(reminderMonth); setFinanceTab("cards"); go("finance"); }
  };
  const [name, setName] = useState(data.name);
  const importRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const backAction = useRef<() => void>(() => {});
  backAction.current = () => {
    if (welcomeOpen) skipIntroduction();
    else if (helpOpen) setHelpOpen(false);
    else if (confirm) setConfirm(null);
    else if (editor) setEditor(null);
    else if (mobileMenu) setMobileMenu(false);
    else if (view !== "overview") go("overview");
    else minimizeMobile();
  };
  useEffect(() => {
    if (!mobileApp) return;
    return attachAndroidBackButton(() => backAction.current());
  }, []);
  useEffect(() => {
    setName(data.name);
  }, [data.name]);
  useEffect(() => {
    const refresh = () => { setToday(dateKey()); setRefreshTick(t => t + 1); };
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    const interval = window.setInterval(() => setToday(dateKey()), 60000);
    document.addEventListener("visibilitychange", visible);
    const detachResume = attachMobileResume(refresh);
    const detachTap = attachReminderTap((kind, id, month) => reminderTap.current(kind, id, month));
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", visible); detachResume(); detachTap(); };
  }, []);
  useEffect(() => {
    if (storageError) return;
    const expanded = materializeRecurrences(data, today);
    if (expanded !== data) { save(expanded); return; }
    let active = true;
    void syncReminders(data).then(result => { if (active && result.state !== "superseded") setReminders(result); });
    return () => { active = false; };
  }, [data, today, refreshTick, storageError]);
  const totals = summary(data.transactions, month);
  const todaysTasks = sortTasks(data.tasks.filter((t) => t.date === today));
  const completedToday = todaysTasks.filter((t) => t.completed).length;
  const pendingTasks = data.tasks.filter((t) => !t.completed);
  const overdueTasks = pendingTasks.filter((t) => t.date < today);
  const budget = data.budgets[month] ?? 0;
  const budgetPercent = budget
    ? Math.round((totals.committed / budget) * 100)
    : 0;
  const categoryCount = new Set(
    totals.entries.filter((t) => t.type === "expense").map((t) => t.category),
  ).size;
  const hasData = data.tasks.length > 0 || data.transactions.length > 0 || !!data.cards?.length || !!data.recurrences?.length;
  const selectedTasks = sortTasks(
    data.tasks.filter((t) => t.date === selectedDate),
  );
  const visibleTasks = sortTasks(
    data.tasks.filter(
      (t) =>
        (taskFilter === "Todas" ||
          (taskFilter === "Hoje" && t.date === today) ||
          (taskFilter === "Pendentes" && !t.completed) ||
          (taskFilter === "Concluídas" && t.completed) ||
          (taskFilter === "Atrasadas" && !t.completed && t.date < today)) &&
        normalize(t.title + " " + t.category + " " + t.notes).includes(
          normalize(taskSearch),
        ),
    ),
  );
  const visibleTransactions = totals.entries
    .filter(
      (t) =>
        (financeFilter === "Todas" ||
          (financeFilter === "Receitas" && t.type === "income") ||
          (financeFilter === "Despesas" && t.type === "expense")) &&
        (financeStatus === "Todos os status" ||
          (financeStatus === "Efetivadas" && t.paid) ||
          (financeStatus === "Previstas" && !t.paid)) &&
        normalize(t.description + " " + t.category + " " + t.notes).includes(
          normalize(financeSearch),
        ),
    )
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        a.description.localeCompare(b.description),
    );

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    document.title = `${view === "overview" ? "Visão geral" : view === "settings" ? "Configurações" : navItems.find((n) => n.id === view)?.label} · DailyAPP`;
  }, [view]);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const update = () => {
      setIsMobile(mobileApp || media.matches);
      if (!media.matches || mobileApp) setMobileMenu(false);
    };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!mobileMenu || !isMobile) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sidebarRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [mobileMenu, isMobile]);

  function save(next: AppData, recovery = false) {
    try { next = validateData(next); }
    catch (error) { setToast(error instanceof Error ? error.message : "Não foi possível validar os registros."); return false; }
    if (workspace) {
      const ok = workspace.save(next, recovery);
      if (!ok) setToast(workspace.getSnapshot().message);
      return ok;
    }
    if (storageError && !recovery) {
      setToast(
        "Recupere seus dados nas configurações antes de fazer alterações.",
      );
      return false;
    }
    if (next.tasks.length > 5000 || next.transactions.length > 10000) {
      setToast(
        "Limite de registros atingido. Exporte um backup antes de remover registros antigos.",
      );
      return false;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      dataRef.current = next;
      setData(next);
      if (recovery) setStorageError("");
      return true;
    } catch {
      setToast(
        "Não foi possível salvar. Verifique o espaço e a permissão de armazenamento do dispositivo.",
      );
      return false;
    }
  }
  function go(next: View) {
    setView(next);
    setMobileMenu(false);
    window.scrollTo({ top: 0 });
    window.setTimeout(() => headingRef.current?.focus(), 0);
  }
  function skipIntroduction() {
    try { localStorage.setItem(INTRO_KEY, "1"); } catch { /* This preference must not block access to the workspace. */ }
    setWelcomeOpen(false);
  }
  function finishIntroduction(name: string, budget: number | null) {
    if (!save({ ...data, name, budgets: budget === null ? data.budgets : { ...data.budgets, [monthKey()]: budget } })) return false;
    skipIntroduction();
    go("overview");
    return true;
  }
  function changeMonth(next: string) {
    if (next < "1900-01" || next > "2200-12") return;
    setMonth(next);
    setSelectedDate(next === monthKey() ? today : `${next}-01`);
  }
  async function activateReminders() {
    try {
      const allowed = await requestReminderPermission();
      const result = await syncReminders(dataRef.current);
      if (result.state !== "superseded") setReminders(result);
      if (!allowed && result.state !== "web") setToast("Permita notificações nas configurações do celular para receber lembretes.");
      else if (result.state === "error") setToast("Os dados foram salvos, mas não foi possível atualizar os lembretes. Tente novamente em Ajustes.");
    } catch { setReminders({ state: "error", count: 0 }); setToast("Os dados foram salvos. Não foi possível ativar os lembretes neste momento."); }
  }
  function saveTask(task: Task, frequency?: Frequency) {
    const exists = data.tasks.some((t) => t.id === task.id);
    let next: AppData = {
      ...data,
      tasks: exists
        ? data.tasks.map((t) => (t.id === task.id ? task : t))
        : [...data.tasks, task],
    };
    try { if (frequency && !task.recurrenceId) next = repeatingTask({ ...data, tasks: data.tasks.filter(t => t.id !== task.id) }, task, frequency); }
    catch (error) { setToast((error as Error).message); return false; }
    const ok = save(next);
    if (ok && task.reminderMinutes !== undefined) void activateReminders();
    if (ok)
      setToast(
        exists ? "Tarefa atualizada." : "Tarefa criada. Um passo de cada vez!",
      );
    return ok;
  }
  function toggleTask(task: Task) {
    if (
      save({
        ...data,
        tasks: data.tasks.map((t) =>
          t.id === task.id ? { ...t, completed: !t.completed } : t,
        ),
      })
    )
      setToast(task.completed ? "Tarefa reaberta." : "Tarefa concluída. Boa!");
  }
  function deleteTask(task: Task) {
    setConfirm({
      title: "Excluir tarefa?",
      text: `A tarefa “${task.title}” será removida da sua agenda.`,
      destructive: true,
      action: () => {
        if (
          save({ ...data, tasks: data.tasks.filter((t) => t.id !== task.id) })
        )
          setToast("Tarefa excluída.");
      },
    });
  }
  function taskRow(task: Task, withDate = false) {
    return (
      <TaskRow
        key={task.id}
        task={task}
        onToggle={() => toggleTask(task)}
        onEdit={() => setEditor({ kind: "task", item: task })}
        onDelete={() => deleteTask(task)}
        withDate={withDate}
      />
    );
  }
  function saveTransaction(transaction: Transaction, frequency?: Frequency) {
    const exists = data.transactions.some((t) => t.id === transaction.id);
    let next: AppData = {
      ...data,
      transactions: exists
        ? data.transactions.map((t) =>
            t.id === transaction.id ? transaction : t,
          )
        : [...data.transactions, transaction],
    };
    try { if (frequency && !transaction.recurrenceId) next = repeatingTransaction({ ...data, transactions: data.transactions.filter(t => t.id !== transaction.id) }, transaction, frequency); }
    catch (error) { setToast((error as Error).message); return false; }
    const ok = save(next);
    if (ok && transaction.reminderMinutes !== undefined) void activateReminders();
    if (ok) {
      setMonth(transaction.date.slice(0, 7));
      setFinanceTab("summary");
      setToast(
        exists ? "Movimentação atualizada." : "Movimentação registrada.",
      );
    }
    return ok;
  }
  function deleteTransaction(transaction: Transaction) {
    setConfirm({
      title: transaction.installment ? "Excluir compra e parcelas?" : "Excluir movimentação?",
      text: transaction.installment ? `Todas as parcelas da compra “${transaction.description}”, inclusive as pagas, serão removidas. Os saldos e faturas serão recalculados.` : `O registro “${transaction.description}” de ${money(transaction.amountCents)} será removido. Seu saldo será recalculado.`,
      destructive: true,
      action: () => {
        if (
          save({
            ...data,
            transactions: data.transactions.filter(
              (t) => transaction.installment ? t.installment?.purchaseId !== transaction.installment.purchaseId : t.id !== transaction.id,
            ),
          })
        )
          setToast("Movimentação excluída.");
      },
    });
  }
  function stopRepeating(id: string) {
    setConfirm({ title: "Parar repetição?", text: "As próximas ocorrências ainda não concluídas ou pagas serão removidas. O histórico e os registros de hoje serão mantidos.", action: () => { if (save(stopRecurrence(data, id, today))) setToast("Repetição encerrada. Seu histórico foi mantido."); } });
  }
  function saveCard(card: CreditCard) {
    const cards = data.cards ?? [];
    const ok = save({ ...data, cards: cards.some(c => c.id === card.id) ? cards.map(c => c.id === card.id ? card : c) : [...cards, card] });
    if (ok) { setToast("Cartão salvo."); if (card.reminderDays !== undefined) void activateReminders(); }
    return ok;
  }
  function savePurchase(input: PurchaseInput) {
    const card = data.cards?.find(c => c.id === input.cardId && !c.archived);
    if (!card) return false;
    try {
      const parts = purchaseInstallments(card, input);
      if (!save({ ...data, transactions: [...data.transactions, ...parts] })) return false;
      setMonth(parts[0].date.slice(0, 7)); setFinanceTab("cards");
      setToast(`${parts.length} ${parts.length === 1 ? "parcela registrada" : "parcelas registradas"}.`);
      if (card.reminderDays !== undefined) void activateReminders();
      return true;
    } catch (error) { setToast((error as Error).message); return false; }
  }
  function payInvoice(card: CreditCard) {
    const totals = cardSummary(data, card.id, month);
    setConfirm({ title: "Marcar fatura como paga?", text: `${money(totals.pending)} das parcelas de ${card.name} neste mês serão marcados como pagos. Nenhum gasto adicional será criado.`, action: () => {
      if (save({ ...data, transactions: data.transactions.map(t => t.installment?.cardId === card.id && t.date.startsWith(month) ? { ...t, paid: true } : t) })) setToast("Fatura marcada como paga.");
    } });
  }
  function archiveCard(card: CreditCard) {
    setConfirm({ title: card.archived ? "Reativar cartão?" : "Arquivar cartão?", text: card.archived ? "O cartão voltará a aceitar novas compras. Seu histórico será mantido." : "O cartão não aceitará novas compras. As parcelas, faturas e o histórico continuarão disponíveis.", action: () => { if (save({ ...data, cards: data.cards?.map(c => c.id === card.id ? { ...c, archived: !card.archived } : c) })) setToast(card.archived ? "Cartão reativado." : "Cartão arquivado. Suas parcelas foram mantidas."); } });
  }
  function startDemo() {
    const action = () => {
      const example = { ...createDemo(), name: data.name };
      if (save(example)) {
        setMonth(monthKey());
        setSelectedDate(today);
        go("overview");
        setToast("Dados de exemplo carregados. Explore à vontade!");
      }
    };
    if (hasData)
      setConfirm({
        title: "Carregar dados de exemplo?",
        text: "Os dados atuais serão substituídos. Exporte um backup nas configurações antes de continuar.",
        action,
      });
    else action();
  }
  function clearDemo() {
    setConfirm({
      title: "Começar com seus dados?",
      text: "As tarefas, movimentações e o orçamento de exemplo serão removidos. Registros e orçamentos que você criou serão preservados.",
      action: () => {
        const budgets = { ...data.budgets };
        if (data.demoBudgetMonth) delete budgets[data.demoBudgetMonth];
        if (
          save({
            ...data,
            demo: false,
            demoBudgetMonth: null,
            tasks: data.tasks.filter((t) => !t.id.startsWith("demo-")),
            transactions: data.transactions.filter(
              (t) => !t.id.startsWith("demo-"),
            ),
            budgets,
          })
        )
          setToast("Tudo pronto para a sua rotina.");
      },
    });
  }
  async function exportData() {
    try {
      const raw = storageError
        ? localStorage.getItem(STORAGE_KEY)
        : JSON.stringify(data, null, 2);
      if (!raw) {
        setToast("Não há dados salvos para exportar.");
        return;
      }
      await saveBackup(
        raw,
        `dailyapp-${storageError ? "recuperacao-" : ""}${today}.json`,
      );
      setToast(mobileApp
        ? "Backup preparado. Guarde sua cópia em um lugar seguro."
        : "Backup exportado. Guarde-o em um lugar seguro.");
    } catch (error) {
      if (error instanceof Error && /cancel/i.test(error.message)) return;
      setToast("Não foi possível exportar o backup. Seus registros continuam salvos.");
    }
  }
  async function importData(file?: File) {
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024)
        throw new Error("O arquivo deve ter no máximo 10 MB.");
      const imported = validateData(JSON.parse(await file.text()));
      setConfirm({
        title: "Restaurar este backup?",
        text: `O arquivo contém ${imported.tasks.length} tarefas e ${imported.transactions.length} movimentações. Os dados atuais serão substituídos.`,
        action: () => {
          if (save(imported, true)) {
            setName(imported.name);
            setToast("Backup restaurado com sucesso.");
          }
        },
      });
    } catch (error) {
      setToast(
        error instanceof SyntaxError
          ? "O arquivo não contém um JSON válido."
          : error instanceof Error
            ? error.message
            : "Não foi possível importar o backup.",
      );
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  }

  const resetMonth = () => changeMonth(monthKey());
  const financialCards = (
    <>
      <div className="stat-card">
        <div className="stat-top">
          <span>Saldo do mês</span>
          <span className="stat-icon green">
            <Wallet size={19} />
          </span>
        </div>
        <strong className={totals.balance < 0 ? "negative" : ""}>
          {money(totals.balance)}
        </strong>
        <span className="stat-caption">
          Receitas recebidas − despesas pagas
        </span>
      </div>
      <div className="stat-card">
        <div className="stat-top">
          <span>Receitas recebidas</span>
          <span className="stat-icon sage">
            <ArrowDownLeft size={20} />
          </span>
        </div>
        <strong>{money(totals.income)}</strong>
        <span className="stat-caption">
          {totals.expectedIncome
            ? `${money(totals.expectedIncome)} a receber`
            : "Tudo que entrou neste mês"}
        </span>
      </div>
      <div className="stat-card">
        <div className="stat-top">
          <span>Despesas pagas</span>
          <span className="stat-icon peach">
            <ArrowUpRight size={20} />
          </span>
        </div>
        <strong>{money(totals.expense)}</strong>
        <span className="stat-caption">
          {totals.pending
            ? `${money(totals.pending)} ainda a pagar`
            : "Tudo que saiu neste mês"}
        </span>
      </div>
    </>
  );
  const budgetPanel = (
    <section
      className={`budget-panel ${budgetPercent > 100 ? "budget-over" : ""}`}
    >
      <div className="panel-heading">
        <div className="section-icon">
          <Target size={19} />
        </div>
        <h2>Seu orçamento</h2>
        <button
          className="icon-button"
          aria-label="Editar orçamento"
          onClick={() => setEditor({ kind: "budget" })}
        >
          <Pencil size={16} />
        </button>
      </div>
      <p>
        {budget
          ? budgetPercent > 100
            ? "Hora de ajustar a rota. Você pode retomar o controle."
            : "Pequenas escolhas. Mais tranquilidade no fim do mês."
          : "Dê um destino ao seu dinheiro antes de gastar."}
      </p>
      {budget ? (
        <>
          <div className="budget-amount">
            <strong>{money(totals.committed)}</strong>
            <span>de {money(budget)}</span>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="Orçamento comprometido"
            aria-valuenow={Math.min(budgetPercent, 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ width: `${Math.min(budgetPercent, 100)}%` }} />
          </div>
          <div className="budget-foot">
            <span>{budgetPercent}% comprometidos</span>
            <strong>
              {totals.committed > budget
                ? `${money(totals.committed - budget)} acima`
                : `${money(budget - totals.committed)} livres`}
            </strong>
          </div>
          <small>Inclui despesas pagas e previstas.</small>
        </>
      ) : (
        <button
          className="button budget-button"
          onClick={() => setEditor({ kind: "budget" })}
        >
          <Plus size={16} />
          Definir orçamento
        </button>
      )}
    </section>
  );

  return (
    <div className={`app-shell${mobileApp ? " mobile-app" : ""}`}>
      <a className="skip-link" href="#main">
        Ir para o conteúdo
      </a>
      {mobileMenu && (
        <button
          className="sidebar-backdrop"
          aria-label="Fechar menu"
          onClick={() => setMobileMenu(false)}
        />
      )}
      <aside
        ref={sidebarRef}
        inert={isMobile && !mobileMenu}
        className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}
        onKeyDown={(e) => {
          if (!isMobile || !mobileMenu) return;
          if (e.key === "Escape") setMobileMenu(false);
          if (e.key === "Tab") {
            const buttons = [
              ...(sidebarRef.current?.querySelectorAll<HTMLButtonElement>(
                "button",
              ) ?? []),
            ];
            if (e.shiftKey && document.activeElement === buttons[0]) {
              e.preventDefault();
              buttons.at(-1)?.focus();
            }
            if (!e.shiftKey && document.activeElement === buttons.at(-1)) {
              e.preventDefault();
              buttons[0]?.focus();
            }
          }
        }}
      >
        <button
          className="brand"
          onClick={() => go("overview")}
          aria-label="DailyAPP, página inicial"
        >
          <span className="brand-mark">
            <CheckCheck size={25} strokeWidth={2.5} />
          </span>
          <span>
            daily<span className="brand-light">app</span>
            <span className="brand-dot">.</span>
          </span>
        </button>
        <div className="sidebar-caption">SUA VIDA, MAIS LEVE</div>
        <nav aria-label="Navegação principal">
          {navItems.map((item) => (
            <button
              key={item.id}
              aria-label={item.label}
              className={`nav-item ${view === item.id ? "active" : ""}`}
              aria-current={view === item.id ? "page" : undefined}
              onClick={() => go(item.id)}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
              {item.id === "tasks" && pendingTasks.length > 0 && (
                <span className="nav-count" aria-hidden="true">
                  {pendingTasks.length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <span className="tip-icon">
              <Sparkles size={19} />
            </span>
            <h3>Um passo de cada vez.</h3>
            <p>
              Organize o hoje.
              <br />
              Aproveite melhor o amanhã.
            </p>
            <button onClick={startDemo}>
              Explorar exemplo <ArrowRight size={14} />
            </button>
          </div>
          <button
            className={`nav-item ${view === "settings" ? "active" : ""}`}
            aria-current={view === "settings" ? "page" : undefined}
            onClick={() => go("settings")}
          >
            <Settings2 size={19} />
            Configurações
          </button>
          <div className="local-badge">
            <ShieldCheck size={14} />
            Seus dados ficam com você
          </div>
          <button className="profile" onClick={() => go("settings")}>
            <span className="avatar">
              {data.name ? data.name.slice(0, 1).toUpperCase() : "V"}
            </span>
            <span>
              <strong>{data.name || "Seu espaço pessoal"}</strong>
              <small>Uma rotina com propósito</small>
            </span>
            <Ellipsis size={18} />
          </button>
        </div>
      </aside>
      <div className="main-shell" inert={(isMobile && mobileMenu) || welcomeOpen || helpOpen}>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button menu-button"
              aria-label="Abrir menu"
              aria-expanded={mobileMenu}
              onClick={() => setMobileMenu(true)}
            >
              <Menu size={21} />
            </button>
            <span>{mobileApp ? "dailyapp." : "Meu espaço"}</span>
            <ChevronRight size={13} />
            <strong>
              {view === "settings"
                ? "Configurações"
                : navItems.find((n) => n.id === view)?.label}
            </strong>
          </div>
          <div className="topbar-date">
            <CalendarDays size={15} />
            <span>
              {new Date().toLocaleDateString("pt-BR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
          <span className="topbar-avatar" aria-hidden="true">
            {data.name ? data.name.slice(0, 1).toUpperCase() : "V"}
          </span>
        </header>
        <main id="main">
          {storageError && (
            <div className="error-banner" role="alert">
              <CircleHelp size={19} />
              <span>{storageError}</span>
              <button onClick={() => go("settings")}>Recuperar dados</button>
            </div>
          )}
          {data.demo && (
            <div className="demo-banner">
              <Sparkles size={15} />
              <span>Você está explorando dados de exemplo.</span>
              <button onClick={clearDemo}>
                Usar meus dados <ArrowRight size={14} />
              </button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {view === "overview" ? (
                  <>
                    <Sun size={16} />
                    {data.name
                      ? `Olá, ${data.name.split(" ")[0]}!`
                      : "BEM-VINDO AO SEU ESPAÇO"}
                  </>
                ) : view === "calendar" ? (
                  "TEMPO PARA O QUE IMPORTA"
                ) : view === "tasks" ? (
                  "UMA COISA DE CADA VEZ"
                ) : view === "finance" ? (
                  "MAIS CLAREZA, MENOS PREOCUPAÇÃO"
                ) : (
                  "DO SEU JEITO"
                )}
              </div>
              <h1 ref={headingRef} tabIndex={-1}>
                {view === "overview"
                  ? "Seu dia, em equilíbrio."
                  : view === "calendar"
                    ? "Minha agenda"
                    : view === "tasks"
                      ? "Minhas tarefas"
                      : view === "finance"
                        ? "Minhas finanças"
                        : "Seu espaço, suas escolhas."}
              </h1>
              <p>
                {view === "overview"
                  ? "Cuide da sua rotina e do seu dinheiro em um só lugar."
                  : view === "calendar"
                    ? "Encontre espaço para os compromissos e para você."
                    : view === "tasks"
                      ? "Transforme planos em pequenos passos possíveis."
                      : view === "finance"
                        ? "Saiba de onde vem e para onde vai o seu dinheiro."
                        : "Personalize sua experiência e cuide dos seus dados."}
              </p>
            </div>
            {view !== "settings" && (
              <div className="heading-actions">
                {view !== "finance" && (
                  <button
                    className="button secondary"
                    onClick={() =>
                      setEditor({
                        kind: "task",
                        date: view === "calendar" ? selectedDate : today,
                      })
                    }
                  >
                    <Plus size={17} />
                    Nova tarefa
                  </button>
                )}
                {(view === "overview" || view === "finance") && (
                  <button
                    className="button primary"
                    onClick={() => setEditor({ kind: "transaction" })}
                  >
                    <Plus size={17} />
                    Nova movimentação
                  </button>
                )}
              </div>
            )}
          </div>

          {view === "overview" && (
            <>
              <div className="section-toolbar">
                <h2>
                  Um olhar para o seu mês <span className="subtle-dot">·</span>{" "}
                  <span className="light-text">seu resumo</span>
                </h2>
                <MonthControl month={month} onChange={changeMonth} />
              </div>
              <div className="stats-grid overview-stats">
                <div className="stat-card">
                  <div className="stat-top">
                    <span>Tarefas de hoje</span>
                    <span className="stat-icon lavender">
                      <CheckCheck size={20} />
                    </span>
                  </div>
                  <strong>
                    {completedToday}
                    <span className="stat-denominator">
                      {" "}
                      / {todaysTasks.length}
                    </span>
                  </strong>
                  <span className="stat-caption">
                    {todaysTasks.length
                      ? `${todaysTasks.length - completedToday} pendentes · no seu ritmo`
                      : "Um novo dia de possibilidades"}
                  </span>
                </div>
                {financialCards}
              </div>
              {!hasData && (
                <div className="welcome-banner">
                  <div className="welcome-icon">
                    <Leaf size={28} />
                  </div>
                  <div>
                    <strong>O primeiro passo é seu.</strong>
                    <p>
                      Adicione uma tarefa, registre um gasto ou descubra como
                      tudo funciona.
                    </p>
                  </div>
                  <button className="button secondary" onClick={startDemo}>
                    <Sparkles size={16} />
                    Explorar exemplo
                  </button>
                </div>
              )}
              <div className="dashboard-grid">
                <section className="panel today-panel">
                  <div className="panel-heading">
                    <div className="section-icon lavender">
                      <ListTodo size={19} />
                    </div>
                    <div>
                      <h2>O que temos para hoje?</h2>
                      <p>
                        {new Date().toLocaleDateString("pt-BR", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                        })}
                      </p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => {
                        setTaskFilter("Hoje");
                        go("tasks");
                      }}
                    >
                      Ver todas <ArrowRight size={14} />
                    </button>
                  </div>
                  {todaysTasks.length > 0 ? (
                    <>
                      <div className="daily-progress">
                        <span>
                          {completedToday} de {todaysTasks.length} concluídas
                        </span>
                        <span>
                          {Math.round(
                            (completedToday / todaysTasks.length) * 100,
                          )}
                          %
                        </span>
                      </div>
                      <div className="progress-track">
                        <span
                          style={{
                            width: `${(completedToday / todaysTasks.length) * 100}%`,
                          }}
                        />
                      </div>
                      <div className="task-list">
                        {todaysTasks.slice(0, 4).map((t) => taskRow(t))}
                      </div>
                    </>
                  ) : (
                    <Empty
                      title="Seu dia está em aberto"
                      text="Organize seus próximos passos. Sem pressa."
                      action={
                        <button
                          className="text-button"
                          onClick={() => setEditor({ kind: "task" })}
                        >
                          <Plus size={15} />
                          Adicionar primeira tarefa
                        </button>
                      }
                    />
                  )}
                  {overdueTasks.length > 0 && (
                    <button
                      className="overdue-notice"
                      onClick={() => {
                        setTaskFilter("Atrasadas");
                        go("tasks");
                      }}
                    >
                      <Clock3 size={14} />
                      {overdueTasks.length}{" "}
                      {overdueTasks.length === 1
                        ? "tarefa de dias anteriores"
                        : "tarefas de dias anteriores"}
                      <ArrowRight size={14} />
                    </button>
                  )}
                  <button
                    className="panel-add"
                    onClick={() => setEditor({ kind: "task" })}
                  >
                    <Plus size={16} />
                    Adicionar tarefa
                  </button>
                </section>
                <section className="panel chart-panel">
                  <div className="panel-heading">
                    <div className="section-icon sage">
                      <TrendingUp size={19} />
                    </div>
                    <div>
                      <h2>Seu dinheiro em movimento</h2>
                      <p>Valores pagos acumulados no mês</p>
                    </div>
                    <button
                      className="icon-button"
                      aria-label="Ver finanças"
                      onClick={() => go("finance")}
                    >
                      <ArrowUpRight size={19} />
                    </button>
                  </div>
                  <div className="chart-legend">
                    <span>
                      <i className="legend-dot income-dot" />
                      Receitas
                    </span>
                    <span>
                      <i className="legend-dot expense-dot" />
                      Despesas
                    </span>
                    <small>em R$</small>
                  </div>
                  <FinanceChart entries={totals.entries} month={month} />
                  <div className="chart-foot">
                    <span>
                      <span className="tiny-dot" />
                      {totals.entries.length
                        ? `${totals.entries.length} movimentações registradas no mês`
                        : "Cada registro ajuda a enxergar melhor"}
                    </span>
                    <button
                      className="text-button"
                      onClick={() => go("finance")}
                    >
                      Ver detalhes <ArrowRight size={14} />
                    </button>
                  </div>
                </section>
                <section className="panel expenses-panel">
                  <div className="panel-heading">
                    <div className="section-icon peach">
                      <Wallet size={19} />
                    </div>
                    <div>
                      <h2>Para onde vai seu dinheiro?</h2>
                      <p>Despesas pagas e previstas por categoria</p>
                    </div>
                    <span className="small-badge">
                      {categoryCount}{" "}
                      {categoryCount === 1 ? "categoria" : "categorias"}
                    </span>
                  </div>
                  <Expenses entries={totals.entries} />
                </section>
                <div className="dashboard-bottom-right">
                  {budgetPanel}
                  <div className="gentle-note">
                    <span>
                      <Coffee size={19} />
                    </span>
                    <p>
                      Você não precisa dar conta de tudo hoje.
                      <br />
                      <strong>Constância vale mais que perfeição.</strong>
                    </p>
                    <Leaf size={40} strokeWidth={1.1} />
                  </div>
                </div>
              </div>
            </>
          )}

          {view === "tasks" && (
            <>
            <RecurrencePanel data={data} kind="task" onStop={stopRepeating} />
            <section className="panel tasks-panel">
              <div className="section-toolbar task-toolbar">
                <div className="filter-tabs" aria-label="Filtrar tarefas">
                  {[
                    "Todas",
                    "Hoje",
                    "Pendentes",
                    "Concluídas",
                    "Atrasadas",
                  ].map((f) => (
                    <button
                      aria-pressed={taskFilter === f}
                      className={taskFilter === f ? "selected" : ""}
                      key={f}
                      onClick={() => setTaskFilter(f)}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <label className="search-field">
                  <Search size={16} />
                  <input
                    aria-label="Buscar tarefas"
                    placeholder="Buscar uma tarefa..."
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                  />
                </label>
              </div>
              <div className="list-summary">
                <span>
                  {visibleTasks.length}{" "}
                  {visibleTasks.length === 1 ? "tarefa" : "tarefas"}
                </span>
                <small>
                  {data.tasks.filter((t) => t.completed).length} concluídas no
                  total
                </small>
              </div>
              {visibleTasks.length ? (
                <div className="task-list">
                  {visibleTasks.map((t) => taskRow(t, true))}
                </div>
              ) : (
                <Empty
                  icon={<ListTodo size={27} />}
                  title={
                    hasData
                      ? "Nenhuma tarefa por aqui"
                      : "Vamos tirar os planos do papel?"
                  }
                  text={
                    taskSearch
                      ? "Tente buscar por outro termo."
                      : "Crie uma tarefa ou escolha outro filtro para continuar."
                  }
                  action={
                    <button
                      className="button primary"
                      onClick={() => setEditor({ kind: "task" })}
                    >
                      <Plus size={16} />
                      Nova tarefa
                    </button>
                  }
                />
              )}
            </section>
            </>
          )}

          {view === "calendar" && (
            <div className="agenda-grid">
              <section className="panel calendar-panel">
                <div className="calendar-toolbar">
                  <MonthControl month={month} onChange={changeMonth} />
                  <button
                    className="button secondary compact"
                    onClick={resetMonth}
                  >
                    Hoje
                  </button>
                </div>
                <div className="calendar-weekdays">
                  {["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"].map(
                    (d) => (
                      <span key={d}>{d}</span>
                    ),
                  )}
                </div>
                <div className="calendar-grid">
                  {Array.from({ length: 42 }, (_, i) => {
                    const first = parseDate(`${month}-01`);
                    const day = new Date(
                      first.getFullYear(),
                      first.getMonth(),
                      i - first.getDay() + 1,
                    );
                    const key = dateKey(day);
                    const tasks = data.tasks.filter((t) => t.date === key);
                    const outside = !key.startsWith(month);
                    return (
                      <button
                        key={key}
                        aria-label={`${day.toLocaleDateString("pt-BR", { day: "numeric", month: "long" })}, ${tasks.length} tarefas`}
                        aria-pressed={key === selectedDate}
                        className={`calendar-day ${outside ? "outside-month" : ""} ${key === today ? "is-today" : ""} ${key === selectedDate ? "is-selected" : ""}`}
                        onClick={() => {
                          setSelectedDate(key);
                          if (outside) setMonth(key.slice(0, 7));
                        }}
                      >
                        <span className="day-number">{day.getDate()}</span>
                        <div className="calendar-task-labels">
                          {tasks.slice(0, 2).map((t) => (
                            <span
                              key={t.id}
                              className={t.completed ? "done" : ""}
                            >
                              <i />
                              {t.title}
                            </span>
                          ))}
                          {tasks.length > 2 && (
                            <small>+{tasks.length - 2} tarefas</small>
                          )}
                        </div>
                        <div className="calendar-dots">
                          {tasks.slice(0, 3).map((t) => (
                            <i
                              key={t.id}
                              className={t.completed ? "done" : ""}
                            />
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="calendar-legend">
                  <span>
                    <i className="legend-dot income-dot" />
                    Tarefa pendente
                  </span>
                  <span>
                    <i className="legend-dot completed-dot" />
                    Concluída
                  </span>
                </div>
              </section>
              <section className="panel agenda-day-panel">
                <div className="panel-heading">
                  <div className="section-icon sage">
                    <CalendarDays size={19} />
                  </div>
                  <div>
                    <h2>
                      {parseDate(selectedDate).toLocaleDateString("pt-BR", {
                        day: "numeric",
                        month: "long",
                      })}
                    </h2>
                    <p>
                      {parseDate(selectedDate).toLocaleDateString("pt-BR", {
                        weekday: "long",
                      })}
                    </p>
                  </div>
                </div>
                {selectedTasks.length ? (
                  <div className="task-list">
                    {selectedTasks.map((t) => taskRow(t))}
                  </div>
                ) : (
                  <Empty
                    title="Um dia de possibilidades"
                    text="Selecione um dia e adicione seus compromissos."
                  />
                )}
                <button
                  className="panel-add"
                  onClick={() =>
                    setEditor({ kind: "task", date: selectedDate })
                  }
                >
                  <Plus size={16} />
                  Adicionar neste dia
                </button>
              </section>
            </div>
          )}

          {view === "finance" && (
            <>
              <div className="finance-subnav" role="group" aria-label="Visão financeira"><button aria-pressed={financeTab === "summary"} className={financeTab === "summary" ? "selected" : ""} onClick={() => setFinanceTab("summary")}>Resumo</button><button aria-pressed={financeTab === "cards"} className={financeTab === "cards" ? "selected" : ""} onClick={() => setFinanceTab("cards")}>Cartões e parcelas</button></div>
              <div className="section-toolbar">
                <h2>{financeTab === "cards" ? "Suas faturas" : "Seu resumo financeiro"}</h2>
                <div className="month-tools">
                  {month !== monthKey() && (
                    <button className="text-button" onClick={resetMonth}>
                      Mês atual
                    </button>
                  )}
                  <MonthControl month={month} onChange={changeMonth} />
                </div>
              </div>
              {financeTab === "cards" ? <CardsPanel data={data} month={month} onNew={() => setEditor({ kind: "card" })} onEdit={item => setEditor({ kind: "card", item })} onArchive={archiveCard} onPurchase={card => setEditor({ kind: "purchase", cardId: card.id })} onPay={payInvoice} /> : <>
              <RecurrencePanel data={data} kind="transaction" onStop={stopRepeating} />
              <div className="stats-grid">
                {financialCards}
                <div className="stat-card">
                  <div className="stat-top">
                    <span>A pagar</span>
                    <span className="stat-icon sand">
                      <Clock3 size={19} />
                    </span>
                  </div>
                  <strong>{money(totals.pending)}</strong>
                  <span className="stat-caption">
                    Despesas previstas neste mês
                  </span>
                </div>
              </div>
              <div className="finance-middle">
                <section className="panel">
                  <div className="panel-heading">
                    <div className="section-icon peach">
                      <Wallet size={19} />
                    </div>
                    <div>
                      <h2>Despesas por categoria</h2>
                      <p>Inclui valores pagos e previstos</p>
                    </div>
                  </div>
                  <Expenses entries={totals.entries} />
                </section>
                {budgetPanel}
              </div>
              <section className="panel transactions-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Suas movimentações</h2>
                    <p>Um histórico para entender suas escolhas.</p>
                  </div>
                  <button className="text-button" onClick={exportData}>
                    <Download size={15} />
                    Exportar backup
                  </button>
                </div>
                <div className="transaction-toolbar">
                  <div
                    className="filter-tabs"
                    aria-label="Filtrar movimentações"
                  >
                    {["Todas", "Receitas", "Despesas"].map((f) => (
                      <button
                        key={f}
                        aria-pressed={financeFilter === f}
                        className={financeFilter === f ? "selected" : ""}
                        onClick={() => setFinanceFilter(f)}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  <div className="transaction-search">
                    <select
                      aria-label="Filtrar status"
                      value={financeStatus}
                      onChange={(e) => setFinanceStatus(e.target.value)}
                    >
                      {["Todos os status", "Efetivadas", "Previstas"].map(
                        (s) => (
                          <option key={s}>{s}</option>
                        ),
                      )}
                    </select>
                    <label className="search-field">
                      <Search size={16} />
                      <input
                        aria-label="Buscar movimentações"
                        placeholder="Buscar movimentação..."
                        value={financeSearch}
                        onChange={(e) => setFinanceSearch(e.target.value)}
                      />
                    </label>
                  </div>
                </div>
                {visibleTransactions.length ? (
                  <>
                    <div className="table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>Descrição</th>
                            <th>Categoria</th>
                            <th>Data</th>
                            <th>Status</th>
                            <th className="text-right">Valor</th>
                            <th>
                              <span className="sr-only">Ações</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleTransactions.map((t) => (
                            <tr key={t.id}>
                              <td>
                                <div className="transaction-description">
                                  <span
                                    className={`transaction-icon ${t.type === "income" ? "income" : "expense"}`}
                                  >
                                    {t.type === "income" ? (
                                      <ArrowDownLeft size={18} />
                                    ) : (
                                      <ArrowUpRight size={18} />
                                    )}
                                  </span>
                                  <button
                                    onClick={() =>
                                      setEditor({
                                        kind: "transaction",
                                        item: t,
                                      })
                                    }
                                  >
                                    {t.description}{t.installment && <span className="installment-label"> · {t.installment.index}/{t.installment.count}</span>}
                                    <small>
                                      {t.type === "income"
                                        ? "Receita"
                                        : "Despesa"}
                                      {t.recurrenceId && " · Recorrente"}
                                      {t.installment && ` · ${data.cards?.find(c => c.id === t.installment?.cardId)?.name ?? "Cartão"}`}
                                      <span className="mobile-transaction-meta">
                                        {" "}
                                        · {prettyDate(t.date)}
                                        <br />
                                        {t.category}
                                      </span>
                                    </small>
                                  </button>
                                </div>
                              </td>
                              <td>
                                <span className="neutral-tag">
                                  {t.category}
                                </span>
                              </td>
                              <td>{prettyDate(t.date)}</td>
                              <td>
                                <button
                                  className={`status-pill ${t.paid ? "paid" : "pending"}`}
                                  aria-label={`${t.paid ? "Marcar como prevista" : t.type === "income" ? "Marcar como recebida" : "Marcar como paga"}: ${t.description}`}
                                  onClick={() => {
                                    if (
                                      save({
                                        ...data,
                                        transactions: data.transactions.map(
                                          (e) =>
                                            e.id === t.id
                                              ? { ...e, paid: !e.paid }
                                              : e,
                                        ),
                                      })
                                    )
                                      setToast("Status atualizado.");
                                  }}
                                >
                                  <i />
                                  {t.paid
                                    ? t.type === "income"
                                      ? "Recebida"
                                      : "Paga"
                                    : "Prevista"}
                                </button>
                              </td>
                              <td
                                className={`transaction-amount ${t.type === "income" ? "positive" : ""}`}
                              >
                                {t.type === "income" ? "+" : "−"}{" "}
                                {money(t.amountCents)}
                              </td>
                              <td>
                                <div className="row-actions">
                                  <button
                                    className="icon-button"
                                    aria-label={`Editar movimentação: ${t.description}`}
                                    onClick={() =>
                                      setEditor({
                                        kind: "transaction",
                                        item: t,
                                      })
                                    }
                                  >
                                    <Pencil size={15} />
                                  </button>
                                  <button
                                    className="icon-button danger-hover"
                                    aria-label={`Excluir movimentação: ${t.description}`}
                                    onClick={() => deleteTransaction(t)}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="table-footer">
                      {visibleTransactions.length}{" "}
                      {visibleTransactions.length === 1
                        ? "movimentação"
                        : "movimentações"}{" "}
                      neste filtro<span>Valores em reais (BRL)</span>
                    </div>
                  </>
                ) : (
                  <Empty
                    icon={<Wallet size={27} />}
                    title="Nenhuma movimentação encontrada"
                    text="Registre uma receita ou despesa, ou ajuste os filtros e o mês."
                    action={
                      <button
                        className="button primary"
                        onClick={() => setEditor({ kind: "transaction" })}
                      >
                        <Plus size={16} />
                        Registrar movimentação
                      </button>
                    }
                  />
                )}
              </section>
              </>}
            </>
          )}

          {view === "settings" && (
            <div className="settings-grid">
              <section className="panel settings-panel account-panel">
                <div className="panel-heading">
                  <div className="section-icon sage">
                    <ShieldCheck size={19} />
                  </div>
                  <div>
                    <h2>
                      {account
                        ? "Sua conta conectada"
                        : "Leve sua rotina com você"}
                    </h2>
                    <p>
                      {account
                        ? account.email
                        : "Conta e sincronização entre dispositivos"}
                    </p>
                  </div>
                </div>
                <p>
                  {account
                    ? account.snapshot.message
                    : localAccount?.available
                      ? "Entre ou crie uma conta para acessar sua agenda e suas finanças em outros dispositivos. Seus registros locais podem ser importados depois."
                      : "Você está usando o modo local. O acesso às contas está sendo preparado neste ambiente; seus registros continuam salvos neste navegador."}
                </p>
                {!account && localAccount?.available && (
                  <button
                    className="button primary"
                    onClick={localAccount.login}
                  >
                    Entrar ou criar conta
                  </button>
                )}
                {account?.localAvailable && (
                  <div className="migration-card">
                    <strong>Você tem registros da versão local.</strong>
                    <p>
                      Importe-os para sua conta. A cópia original neste
                      navegador será preservada.
                    </p>
                    <button
                      className="button secondary"
                      disabled={!account.snapshot.canEdit}
                      onClick={() =>
                        setConfirm({
                          title: "Importar registros locais?",
                          text: "Tarefas, movimentações e orçamentos serão adicionados à sua conta. Registros já existentes na conta serão preservados e dados de exemplo serão ignorados.",
                          action: account.migrate,
                        })
                      }
                    >
                      Importar meus dados locais
                    </button>
                  </div>
                )}
                {account &&
                  (account.snapshot.status === "conflict" ||
                    account.snapshot.status === "error") && (
                    <div className="migration-card">
                      <strong>Recupere sua conta com cuidado.</strong>
                      <p>
                        Exporte um backup das alterações deste dispositivo antes
                        de carregar a versão da nuvem.
                      </p>
                      <div className="backup-actions">
                        <button
                          className="button secondary"
                          onClick={async () => {
                            try {
                              const raw = account.store.recoveryBackup();
                              if (raw)
                                await saveBackup(
                                  raw,
                                  `dailyapp-copia-local-${today}.json`,
                                );
                              else
                                setToast(
                                  "Não existe uma cópia local para exportar.",
                                );
                            } catch {
                              setToast("Não foi possível ler a cópia local.");
                            }
                          }}
                        >
                          Exportar cópia local
                        </button>
                        <button
                          className="button secondary"
                          onClick={() =>
                            setConfirm({
                              title: "Carregar dados da nuvem?",
                              text: "Alterações locais ainda não sincronizadas serão substituídas. Continue apenas depois de exportar uma cópia dos registros que deseja guardar.",
                              action: () => {
                                void account.store.useRemote();
                              },
                            })
                          }
                        >
                          Carregar dados da nuvem
                        </button>
                      </div>
                    </div>
                  )}
              </section>
              <section className="panel settings-panel">
                <div className="panel-heading">
                  <div className="section-icon lavender">
                    <Settings2 size={19} />
                  </div>
                  <div>
                    <h2>Um espaço com a sua cara</h2>
                    <p>Como podemos chamar você?</p>
                  </div>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (save({ ...data, name: name.trim() }))
                      setToast("Seu nome foi atualizado.");
                  }}
                >
                  <label>
                    Seu nome
                    <input
                      maxLength={60}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex.: Ana"
                    />
                  </label>
                  <button className="button primary" type="submit">
                    Salvar nome
                  </button>
                </form>
              </section>
              <section className="panel settings-panel data-panel">
                <div className="panel-heading">
                  <div className="section-icon sage">
                    <ShieldCheck size={19} />
                  </div>
                  <div>
                    <h2>Seus dados, sob seu controle</h2>
                    <p>
                      {account
                        ? "Cópia local e sincronização com sua conta."
                        : "Salvos automaticamente neste dispositivo."}
                    </p>
                  </div>
                </div>
                <p>
                  {account
                    ? "Suas informações são sincronizadas com sua conta. Alterações pendentes permanecem neste dispositivo até serem confirmadas na nuvem. Exporte backups para manter uma cópia independente."
                    : "Suas informações ficam neste dispositivo. Exporte um backup para guardar uma cópia ou transferir seus dados para outro dispositivo."}
                </p>
                <div className="data-counts">
                  <span>
                    <strong>{data.tasks.length}</strong> tarefas
                  </span>
                  <span>
                    <strong>{data.transactions.length}</strong> movimentações
                  </span>
                </div>
                <div className="backup-actions">
                  <button className="button secondary" onClick={exportData}>
                    <ArrowDownToLine size={16} />
                    {storageError
                      ? "Exportar dados originais"
                      : "Exportar backup"}
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => importRef.current?.click()}
                  >
                    <Upload size={16} />
                    Importar backup
                  </button>
                  <input
                    className="sr-only"
                    type="file"
                    accept=".json,application/json"
                    ref={importRef}
                    aria-label="Arquivo de backup"
                    onChange={(e) => void importData(e.target.files?.[0])}
                  />
                </div>
                <small className="settings-note">
                  {mobileApp
                    ? "Desinstalar o aplicativo ou limpar seus dados remove os registros locais. "
                    : "Limpar os dados do navegador remove seus registros. "}O backup
                  contém suas informações pessoais; guarde-o com cuidado.
                </small>
              </section>
              <section className="panel settings-panel">
                <div className="panel-heading">
                  <div className="section-icon sand">
                    <Sparkles size={19} />
                  </div>
                  <div>
                    <h2>Conheça as possibilidades</h2>
                    <p>Experimente antes de começar.</p>
                  </div>
                </div>
                <p>
                  Explore uma rotina de exemplo com tarefas e movimentações
                  fictícias.
                </p>
                <button className="button secondary" onClick={startDemo}>
                  <Sparkles size={16} />
                  Carregar exemplo
                </button>
              </section>
              <section className="panel settings-panel reset-panel">
                <div className="panel-heading">
                  <div className="section-icon peach">
                    <Trash2 size={19} />
                  </div>
                  <div>
                    <h2>Começar de novo</h2>
                    <p>Um novo início para sua organização.</p>
                  </div>
                </div>
                <p>
                  Apague todas as tarefas, movimentações e orçamentos deste
                  dispositivo. Exporte um backup antes de continuar.
                </p>
                <button
                  className="button danger-outline"
                  onClick={() =>
                    setConfirm({
                      title: "Apagar todos os dados?",
                      text: "Esta ação remove todas as tarefas, movimentações, orçamentos e seu nome. Você só poderá recuperá-los se tiver exportado um backup.",
                      destructive: true,
                      action: () => {
                        if (save(freshData(), true)) {
                          setName("");
                          setMonth(monthKey());
                          setToast(
                            "Dados apagados. Tudo pronto para um novo início.",
                          );
                        }
                      },
                    })
                  }
                >
                  <Trash2 size={16} />
                  Apagar meus dados
                </button>
              </section>
              {mobileApp && (
                <section className="panel settings-panel">
                  <div className="panel-heading"><div className="section-icon sage"><CircleHelp size={19} /></div><div><h2>Um passo de cada vez</h2><p>Uma orientação para começar e cuidar dos seus registros.</p></div></div>
                  <button className="button secondary" onClick={() => setHelpOpen(true)}><CircleHelp size={16} />Como usar o DailyAPP</button>
                </section>
              )}
              <section className="panel settings-panel reminders-panel">
                <div className="panel-heading"><div className="section-icon sage"><Bell size={19} /></div><div><h2>Lembretes no celular</h2><p>Tarefas, contas e faturas sem depender de internet.</p></div></div>
                <p>{reminders.state === "web" ? "Lembretes são enviados pelo aplicativo instalado no Android ou iPhone. Esta prévia salva as configurações, mas não envia notificações." : reminders.state === "ready" ? `${reminders.count} ${reminders.count === 1 ? "lembrete programado" : "lembretes programados"} neste aparelho.` : reminders.state === "error" ? "Não foi possível atualizar os lembretes. Tente novamente." : "Permita notificações nas configurações do celular para receber seus lembretes."}</p>
                {reminders.state !== "web" && <button className="button secondary" onClick={() => void activateReminders()}><Bell size={16} />{reminders.state === "ready" ? "Atualizar lembretes" : "Ativar lembretes"}</button>}
                <p className="form-hint">Escolha um lembrete ao criar uma tarefa, conta ou cartão. Contas e faturas avisam às 9h. Os próximos 60 avisos são atualizados ao abrir o app. O sistema pode ajustar o horário para economizar bateria.</p>
              </section>
              <div className="about-app">
                <span className="brand-mark small">
                  <CheckCheck size={20} />
                </span>
                <strong>DailyAPP</strong>
                <span>{mobileApp ? "Versão 1.1 · Uso pessoal" : "Versão 1.1 · Feito para uma vida mais leve."}</span>
              </div>
            </div>
          )}
          <footer className="page-footer">
            <span>Menos correria. Mais equilíbrio.</span>
            <span>
              <Leaf size={13} />
              Um dia de cada vez.
            </span>
          </footer>
        </main>
      </div>
      {mobileApp && (
        <nav className="mobile-tabbar" aria-label="Navegação do aplicativo" inert={!!editor || !!confirm || welcomeOpen || helpOpen}>
          {[
            ...navItems.map((item) => ({ ...item, shortLabel: { overview: "Hoje", calendar: "Agenda", tasks: "Tarefas", finance: "Finanças" }[item.id] })),
            { id: "settings" as const, label: "Configurações", shortLabel: "Ajustes", icon: Settings2 },
          ].map((item) => (
            <button key={item.id} aria-label={item.label} aria-current={view === item.id ? "page" : undefined} onClick={() => go(item.id)}>
              <item.icon size={21} strokeWidth={view === item.id ? 2.4 : 1.7} />
              <span>{item.shortLabel}</span>
            </button>
          ))}
        </nav>
      )}
      {welcomeOpen && <MobileIntroduction onFinish={finishIntroduction} onSkip={skipIntroduction} />}
      {helpOpen && <MobileHelp onClose={() => setHelpOpen(false)} />}
      {editor?.kind === "task" && (
        <TaskForm
          item={editor.item}
          date={editor.date}
          recurrenceFrequency={data.recurrences?.find(s => s.id === editor.item?.recurrenceId)?.frequency}
          onSave={saveTask}
          onClose={() => setEditor(null)}
        />
      )}
      {editor?.kind === "transaction" && (
        <TransactionForm
          item={editor.item}
          type={editor.type}
          recurrenceFrequency={data.recurrences?.find(s => s.id === editor.item?.recurrenceId)?.frequency}
          onSave={saveTransaction}
          onClose={() => setEditor(null)}
        />
      )}
      {editor?.kind === "budget" && (
        <BudgetForm
          month={month}
          budget={budget}
          onSave={(amount) => {
            const ok = save({
              ...data,
              budgets: { ...data.budgets, [month]: amount },
              demoBudgetMonth:
                data.demoBudgetMonth === month ? null : data.demoBudgetMonth,
            });
            if (ok) setToast("Orçamento definido.");
            return ok;
          }}
          onClose={() => setEditor(null)}
        />
      )}
      {editor?.kind === "card" && <Modal title={editor.item ? "Editar cartão" : "Novo cartão"} subtitle="Cadastre somente o nome e os dias da fatura." onClose={() => setEditor(null)}><CardForm item={editor.item} onSave={saveCard} onClose={() => setEditor(null)} /></Modal>}
      {editor?.kind === "purchase" && <Modal title="Compra no cartão" subtitle="O valor total será dividido nas próximas faturas." onClose={() => setEditor(null)}><PurchaseForm cards={data.cards ?? []} selectedId={editor.cardId} onSave={savePurchase} onClose={() => setEditor(null)} /></Modal>}
      {confirm && (
        <Modal title={confirm.title} onClose={() => setConfirm(null)} small>
          <p className="confirm-text">{confirm.text}</p>
          <div className="modal-footer">
            <button
              className="button secondary"
              onClick={() => setConfirm(null)}
            >
              Cancelar
            </button>
            <button
              className={`button ${confirm.destructive ? "danger" : "primary"}`}
              onClick={() => {
                confirm.action();
                setConfirm(null);
              }}
            >
              Confirmar
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          <span>{toast}</span>
          <button
            className="icon-button"
            aria-label="Fechar notificação"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

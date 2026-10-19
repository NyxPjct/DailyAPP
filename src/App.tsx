import { AccountSelect, AccountsPanel, AccountForm, TransferForm, CategoryBudgetsPanel, CategoryBudgetForm, ReportPanel, QuickExpenses } from "./features/FinanceTools";
import { DailyFocus, SubtaskEditor } from "./features/TaskTools";
import { BackupPasswordForm } from "./features/BackupPasswordForm";
import { encryptBackup, decryptBackup, isEncryptedBackup } from "./backup-crypto";
import type { EncryptedBackup } from "./backup-crypto";
import type { WalletAccount, Transfer } from "./domain";
import { currencyForLanguage, currencySymbol, fetchExchangeRates, getCurrency, parseCurrencyAmount, setCurrentCurrency, toDisplayCents } from "./currency";
import type { Currency, ExchangeRates } from "./currency";
import { CurrencySettings } from "./features/CurrencySettings";
import { t as tr, translate, LANGUAGES, isLanguage, LANGUAGE_KEY, readLanguagePreference, setCurrentLanguage, getLocale, recordText } from "./i18n/core";
import type { Language } from "./i18n/core";
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
  Star,
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
  validDate,
  normalize,
  sortTasks,
  summary,
  validateData,
  createDemo,
  FREQUENCIES,
} from "./domain";
import type { AppData, Task, Transaction, Frequency, CreditCard, FinancialGoal } from "./domain";
import { TodayMoney, ForecastPanel, GoalsPanel, GoalForm, OpeningBalanceForm } from "./features/FinancialPlanning";
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
const parseAmount = parseCurrencyAmount;
const mobileApp = import.meta.env.VITE_MOBILE_APP === true;
const INTRO_KEY = "dailyapp.intro.v1";
function introductionDone() {
  try { return localStorage.getItem(INTRO_KEY) === "1"; }
  catch { return false; }
}
type Editor =
  | { kind: "task"; item?: Task; date?: string }
  | { kind: "transaction"; item?: Transaction; preset?: Transaction; type?: Transaction["type"] }
  | { kind: "account"; item?: WalletAccount }
  | { kind: "transfer"; item?: Transfer }
  | { kind: "category-budgets" }
  | { kind: "protect-backup" }
  | { kind: "unlock-backup"; envelope: EncryptedBackup }
  | { kind: "budget" }
  | { kind: "card"; item?: CreditCard }
  | { kind: "purchase"; cardId: string }
  | { kind: "goal"; item?: FinancialGoal }
  | { kind: "opening" }
  | null;

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
        tr("Não foi possível ler os dados salvos. Abra as configurações para recuperar um backup ou reiniciar."),
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
            aria-label={tr("Fechar janela")}
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
    <Modal title={tr("Seu dia começa aqui.")} subtitle={tr("Bem-vindo ao DailyAPP. Vamos abrir espaço para sua rotina.")} onClose={onSkip} focusFirstInput={false}>
      <div className="intro-features">
        <div><CalendarDays size={21} /><p><strong>{tr("Agenda e tarefas")}</strong><span>{tr("Organize seus compromissos e marque o que já concluiu.")}</span></p></div>
        <div><Wallet size={21} /><p><strong>{tr("Finanças com clareza")}</strong><span>{tr("Acompanhe receitas, despesas e o limite de gastos do mês.")}</span></p></div>
        <div><ShieldCheck size={21} /><p><strong>{tr("Seu espaço pessoal")}</strong><span>{tr("Funciona sem internet e sem conta. Os registros ficam neste aparelho.")}</span></p></div>
      </div>
      <form className="intro-form" onSubmit={(event) => {
        event.preventDefault();
        const budget = amount.trim() ? parseAmount(amount) : null;
        if (amount.trim() && budget === null) {
          setError(tr("Informe um valor maior que zero ou deixe o orçamento em branco."));
          return;
        }
        onFinish(name.trim(), budget);
      }}>
        <label>{tr("Como você quer ser chamado? ")}<span className="optional">{tr("(opcional)")}</span>
          <input maxLength={60} autoComplete="given-name" placeholder={tr("Ex.: Ana")} value={name} onChange={event => setName(event.target.value)} />
        </label>
        <label>{tr("Limite de gastos do mês ({0}) ", currencySymbol())}<span className="optional">{tr("(opcional)")}</span>
          <input inputMode="decimal" placeholder={tr("Ex.: 2.500,00")} value={amount} onChange={event => { setAmount(event.target.value); setError(""); }} />
        </label>
        <p className="intro-note">{tr("Você pode ajustar tudo depois. Em Ajustes, exporte backups para guardar uma cópia dos seus registros.")}</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-footer">
          <button className="button secondary" type="button" onClick={onSkip}>{tr("Começar sem configurar")}</button>
          <button className="button primary" type="submit">{tr("Começar ")}<ArrowRight size={16} /></button>
        </div>
      </form>
    </Modal>
  );
}

function MobileHelp({ onClose }: { onClose: () => void }) {
  return (
    <Modal title={tr("Guia rápido")} subtitle={tr("Um registro de cada vez. Mais clareza no seu dia.")} onClose={onClose} focusFirstInput={false}>
      <div className="mobile-help">
        <div><ListTodo size={22} /><section><h3>{tr("Organize o dia")}</h3><p>{tr("Em Hoje ou Tarefas, crie uma tarefa com data e horário. Escolha Repetir para uma rotina diária, semanal, mensal ou anual. Marque o círculo quando concluir e gerencie as rotinas em Tarefas.")}</p></section></div>
        <div><Wallet size={22} /><section><h3>{tr("Acompanhe seu dinheiro")}</h3><p>{tr("Registre receitas e despesas. Marque como recebida ou paga para incluir no saldo; os valores previstos continuam visíveis para seu planejamento.")}</p></section></div>
        <div><Clock3 size={22} /><section><h3>{tr("Veja as próximas contas")}</h3><p>{tr("Em Hoje, confira contas e recebimentos pendentes, incluindo parcelas: dias anteriores, hoje e próximos sete dias. Toque na descrição para editar ou em Pagar/Receber para atualizar o status.")}</p></section></div>
        <div><TrendingUp size={22} /><section><h3>{tr("Planeje o saldo")}</h3><p>{tr("Em Finanças → Planejamento, informe o saldo no início do mês. A previsão soma receitas e desconta despesas pagas e previstas desse mês. Não consulta bancos; ajuste datas e valores para manter a estimativa útil.")}</p></section></div>
        <div><Target size={22} /><section><h3>{tr("Avance nas suas metas")}</h3><p>{tr("Em Planejamento, crie uma meta com valor desejado e prazo. Atualize o total guardado para acompanhar seu progresso. Esse valor não movimenta dinheiro nem altera o saldo automaticamente.")}</p></section></div>
        <div><Target size={22} /><section><h3>{tr("Defina seu orçamento")}</h3><p>{tr("Em Finanças, escolha o mês e defina um limite de gastos. O orçamento considera despesas pagas e previstas.")}</p></section></div>
        <div><Wallet size={22} /><section><h3>{tr("Controle cartões e parcelas")}</h3><p>{tr("Em Finanças → Cartões e parcelas, cadastre o cartão e registre o valor total de cada compra. As parcelas entram nas faturas. Marcar uma fatura como paga atualiza os gastos sem duplicá-los.")}</p></section></div>
        <div><Bell size={22} /><section><h3>{tr("Receba lembretes")}</h3><p>{tr("Escolha um lembrete na tarefa, conta ou cartão e permita notificações no celular. Ao concluir ou pagar, os próximos avisos são retirados. Em Ajustes, confira os lembretes programados.")}</p></section></div>
        <div><Download size={22} /><section><h3>{tr("Guarde uma cópia")}</h3><p>{tr("Em Ajustes, exporte um backup e escolha onde guardar o arquivo. Para transferir os dados a outro aparelho, importe esse JSON e confirme a restauração.")}</p></section></div>
      </div>
      <p className="intro-note">{tr("Os registros ficam neste aparelho. Desinstalar o aplicativo ou limpar seus dados pode removê-los. Guarde um backup antes de trocar de celular.")}</p>
      <div className="modal-footer"><button className="button primary" onClick={onClose}>{tr("Entendi")}</button></div>
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
        aria-label={tr("Mês anterior")}
        className="icon-button"
        onClick={() => onChange(shiftMonth(month, -1))}
      >
        <ChevronLeft size={17} />
      </button>
      <span>{monthLabel(month)}</span>
      <button
        aria-label={tr("Próximo mês")}
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
  onFocus,
}: {
  onFocus: () => void;
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
        aria-label={tr("{0} tarefa: {1}", task.completed ? tr("Reabrir") : tr("Concluir"), recordText(task.id, task.title))}
        onClick={onToggle}
      >
        {task.completed && <Check size={14} strokeWidth={3} />}
      </button>
      <button className="task-content" onClick={onEdit}>
        <span className="task-title">{recordText(task.id, recordText(task.id, task.title))}</span>
        <span className="task-meta">
          {(task.time || withDate) && (
            <span className={overdue ? "overdue" : ""}>
              <Clock3 size={12} />
              {withDate ? prettyDate(task.date) : ""}
              {withDate && task.time ? tr(" · ") : ""}
              {task.time}
              {overdue ? tr(" · Atrasada") : ""}
            </span>
          )}
          <span className={`tag category-${task.category.toLowerCase()}`}>
            {tr(task.category)}
          </span>
          {!!task.subtasks?.length && <span className="planning-badge">{tr("{0}/{1} etapas", task.subtasks.filter(c=>c.completed).length, task.subtasks.length)}</span>}
          {task.recurrenceId && <span className="planning-badge"><Repeat2 size={12} />{tr("Recorrente")}</span>}
          {task.reminderMinutes !== undefined && <span className="planning-badge"><Bell size={12} />{tr("Lembrete")}</span>}
        </span>
      </button>
      <span
        className={`priority priority-${task.priority === "Alta" ? "high" : task.priority === "Média" ? "medium" : "low"}`}
        title={tr("Prioridade {0}", tr(task.priority).toLowerCase())}
      >
        <Flag size={13} />
        <span>{tr(task.priority)}</span>
      </span>
      <div className="row-actions">
        <button className="icon-button" aria-pressed={task.focusDate===dateKey()} aria-label={tr("Priorizar hoje: {0}",recordText(task.id,task.title))} onClick={onFocus}><Star size={15} fill={task.focusDate===dateKey()?"currentColor":"none"}/></button>
        <button
          className="icon-button"
          aria-label={tr("Editar tarefa: {0}", recordText(task.id, task.title))}
          onClick={onEdit}
        >
          <Pencil size={15} />
        </button>
        <button
          className="icon-button danger-hover"
          aria-label={tr("Excluir tarefa: {0}", recordText(task.id, task.title))}
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
        aria-label={tr("Receitas e despesas pagas acumuladas em {0}: receitas {1}, despesas {2}", monthLabel(month), money(income.at(-1) ?? 0), money(expense.at(-1) ?? 0))}
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
              {Math.round(toDisplayCents(max * p) / 100).toLocaleString(getLocale())}
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
        title={tr("Cada gasto conta")}
        text={tr("Registre sua primeira despesa para conhecer seus hábitos.")}
      />
    );
  return (
    <div className="expenses-content">
      <div
        className="donut"
        role="img"
        aria-label={tr("Total de despesas registradas: {0}", money(total))}
        style={{ background: `conic-gradient(${gradient})` }}
      >
        <div>
          <span>{tr("Despesas")}</span>
          <strong>{money(total)}</strong>
        </div>
      </div>
      <div className="category-list">
        {amounts.map((t) => (
          <div className="category-line" key={tr(t.category)}>
            <span
              className="category-dot"
              style={{ background: categoryColors[t.category] }}
            />
            <span>{tr(t.category)}</span>
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
  const [title, setTitle] = useState(item ? recordText(item.id, item.title) : "");
  const [day, setDay] = useState(item?.date ?? date ?? dateKey());
  const [time, setTime] = useState(item?.time ?? "");
  const [category, setCategory] = useState<Task["category"]>(
    item?.category ?? "Pessoal",
  );
  const [priority, setPriority] = useState<Task["priority"]>(
    item?.priority ?? "Média",
  );
  const [subtasks,setSubtasks] = useState(item?.subtasks ?? []);
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [frequency, setFrequency] = useState<Frequency | "">(recurrenceFrequency ?? "");
  const [reminder, setReminder] = useState(item?.reminderMinutes ?? -1);
  const [error, setError] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !validDate(day)) {
      setError(tr("Informe um título e uma data válida entre 1900 e 2200."));
      return;
    }
    if (reminder >= 0 && !time) { setError(tr("Defina um horário para o lembrete da tarefa.")); return; }
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
        ...(subtasks.length || item?.subtasks ? { subtasks } : {}),
        reminderMinutes: reminder >= 0 ? reminder : undefined,
      }, !item?.recurrenceId && frequency ? frequency : undefined)
    )
      onClose();
  }
  return (
    <Modal
      title={item ? tr("Editar tarefa") : tr("Nova tarefa")}
      subtitle={tr("Abra espaço para o que importa no seu dia.")}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <label>{tr("O que você precisa fazer?")}<input
            autoFocus
            required
            maxLength={120}
            placeholder={tr("Ex.: Agendar consulta médica")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <div className="form-grid">
          <label>{tr("Data")}<input
              type="date"
              min="1900-01-01"
              max="2200-12-31"
              required
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </label>
          <label>{tr("Horário ")}<span className="optional">{tr("(opcional)")}</span>
            <input
              type="time"
              value={time}
              onChange={(e) => { setTime(e.target.value); if (!e.target.value) setReminder(-1); }}
            />
          </label>
        </div>
        <div className="form-grid">
          <label>{tr("Categoria")}<select
              aria-label={tr("Categoria")}
              value={category}
              onChange={(e) => setCategory(e.target.value as Task["category"])}
            >
              {TASK_CATEGORIES.map((c) => (
                <option key={c} value={c}>{tr(c)}</option>
              ))}
            </select>
          </label>
          <label>{tr("Prioridade")}<select
              aria-label={tr("Prioridade")}
              value={priority}
              onChange={(e) => setPriority(e.target.value as Task["priority"])}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{tr(p)}</option>
              ))}
            </select>
          </label>
        </div>
        <label>{tr("Observações ")}<span className="optional">{tr("(opcional)")}</span>
          <textarea
            maxLength={1000}
            rows={3}
            placeholder={tr("Algum detalhe para lembrar?")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <SubtaskEditor value={subtasks} onChange={setSubtasks} />
        <div className="form-grid">
          <label>{tr("Repetir tarefa")}<select aria-label={tr("Repetir tarefa")} value={frequency} disabled={!!item?.recurrenceId} onChange={e => setFrequency(e.target.value as Frequency | "")}><option value="">{tr("Não repetir")}</option>{Object.entries(FREQUENCIES).map(([value, label]) => <option value={value} key={value}>{tr(label)}</option>)}</select></label>
          <label>{tr("Lembrete da tarefa")}<select aria-label={tr("Lembrete da tarefa")} value={reminder} disabled={!time} onChange={e => setReminder(Number(e.target.value))}><option value={-1}>{tr("Sem lembrete")}</option><option value={0}>{tr("No horário")}</option><option value={5}>{tr("5 minutos antes")}</option><option value={15}>{tr("15 minutos antes")}</option><option value={30}>{tr("30 minutos antes")}</option><option value={60}>{tr("1 hora antes")}</option><option value={1440}>{tr("1 dia antes")}</option></select></label>
        </div>
        <p className="form-hint">{item?.recurrenceId ? tr("Esta edição altera só esta ocorrência. Para encerrar a rotina, use Parar repetição em Tarefas.") : tr("Repetições criam as próximas tarefas sem marcá-las como concluídas.")} {!time ? tr("Defina um horário para ativar um lembrete.") : tr("Lembretes aparecem no aplicativo instalado, com sua permissão.")}</p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <button type="button" className="button secondary" onClick={onClose}>{tr("Cancelar")}</button>
          <button className="button primary" type="submit">
            <Check size={16} />
            {item ? tr("Salvar alterações") : tr("Criar tarefa")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function TransactionForm({
  item,
  preset,
  accounts,
  type,
  onSave,
  onClose,
  recurrenceFrequency,
}: {
  item?: Transaction;
  preset?: Transaction;
  accounts: WalletAccount[];
  type?: Transaction["type"];
  onSave: (transaction: Transaction, frequency?: Frequency) => boolean;
  onClose: () => void;
  recurrenceFrequency?: Frequency;
}) {
  const source = item ?? preset;
  const [accountId,setAccountId] = useState(source?.accountId && accounts.some(a=>a.id===source.accountId && (!a.archived || !!item)) ? source.accountId : "");
  const [kind, setKind] = useState<Transaction["type"]>(
    source?.type ?? type ?? "expense",
  );
  const [description, setDescription] = useState(source ? recordText(source.id, source.description) : "");
  const [amount, setAmount] = useState(
    source ? amountInput(source.amountCents) : "",
  );
  const [day, setDay] = useState(item?.date ?? dateKey());
  const [category, setCategory] = useState(
    source?.category ?? (type === "income" ? "Salário" : "Alimentação"),
  );
  const [paid, setPaid] = useState(item?.paid ?? true);
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [frequency, setFrequency] = useState<Frequency | "">(recurrenceFrequency ?? "");
  const [reminder, setReminder] = useState(item?.reminderMinutes ?? -1);
  const [error, setError] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    const cents = parseAmount(amount, item?.amountCents);
    if (!cents) {
      setError(
        tr("Informe um valor maior que zero, com até duas casas decimais. Ex.: 125,90."),
      );
      return;
    }
    if (!description.trim() || !validDate(day)) {
      setError(tr("Informe uma descrição e uma data válida entre 1900 e 2200."));
      return;
    }
    if (
      onSave({
        ...item,
        id: item?.id ?? randomId(),
        description: description.trim(),
        amountCents: cents,
        date: day,
        accountId: accountId || undefined,
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
      title={item ? tr("Editar movimentação") : tr("Nova movimentação")}
      subtitle={tr("Um registro de cada vez. Mais clareza para seu dinheiro.")}
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
            <ArrowUpRight size={16} />{tr("Despesa")}</button>
          <button
            type="button"
            className={kind === "income" ? "selected" : ""}
            disabled={!!item?.installment}
            onClick={() => {
              setKind("income");
              setCategory("Salário");
            }}
          >
            <ArrowDownLeft size={16} />{tr("Receita")}</button>
        </div>
        <label>{tr("Descrição")}<input
            autoFocus
            required
            maxLength={120}
            placeholder={
              kind === "expense"
                ? tr("Ex.: Compras do supermercado")
                : tr("Ex.: Salário do mês")
            }
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <div className="form-grid">
          <label>{tr("Valor ({0})", currencySymbol())}<input
              required
              inputMode="decimal"
              placeholder={tr("0,00")}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label>{tr("Data")}<input
              type="date"
              min="1900-01-01"
              max="2200-12-31"
              required
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </label>
        </div>
        <label>{tr("Categoria")}<select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {(kind === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map(
              (c) => (
                <option key={c} value={c}>{tr(c)}</option>
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
              ? tr("Esta despesa já foi paga")
              : tr("Esta receita já foi recebida")}
            <small>
              {paid
                ? tr("Será incluída no saldo do mês.")
                : tr("Ficará registrada como prevista.")}
            </small>
          </span>
        </label>
        <AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} />
        <label>{tr("Observações ")}<span className="optional">{tr("(opcional)")}</span>
          <textarea
            rows={2}
            maxLength={1000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={tr("Adicione um detalhe, se quiser")}
          />
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {!item?.installment && <div className="form-grid">
          <label>{tr("Repetir movimentação")}<select aria-label={tr("Repetir movimentação")} value={frequency} disabled={!!item?.recurrenceId} onChange={e => { const value = e.target.value as Frequency | ""; setFrequency(value); if (value && !item) setPaid(false); }}><option value="">{tr("Não repetir")}</option>{Object.entries(FREQUENCIES).map(([value, label]) => <option value={value} key={value}>{tr(label)}</option>)}</select></label>
          <label>{tr("Lembrete da conta")}<select aria-label={tr("Lembrete da conta")} value={reminder} onChange={e => setReminder(Number(e.target.value))}><option value={-1}>{tr("Sem lembrete")}</option><option value={0}>{tr("Na data, às 9h")}</option><option value={1440}>{tr("1 dia antes, às 9h")}</option><option value={4320}>{tr("3 dias antes, às 9h")}</option></select></label>
        </div>}
        {(frequency || item?.recurrenceId) && <p className="form-hint">{item?.recurrenceId ? tr("Esta edição altera só esta ocorrência. Gerencie a rotina em Finanças.") : tr("As próximas movimentações ficam previstas até você marcar o pagamento ou recebimento.")}</p>}
        {item?.installment && <p className="form-hint">{tr("Parcela ")}{item.installment.index}/{item.installment.count}{tr(". Esta edição altera só esta parcela. O lembrete da fatura é configurado no cartão.")}</p>}
        <div className="modal-footer">
          <button type="button" className="button secondary" onClick={onClose}>{tr("Cancelar")}</button>
          <button className="button primary" type="submit">
            <Check size={16} />
            {item ? tr("Salvar alterações") : tr("Registrar movimentação")}
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
      title={tr("Seu orçamento do mês")}
      subtitle={tr("Defina quanto deseja gastar em {0}.", monthLabel(month))}
      onClose={onClose}
      small
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const cents = parseAmount(amount, budget);
          if (!cents) {
            setError(tr("Informe um limite maior que zero."));
            return;
          }
          if (onSave(cents)) onClose();
        }}
      >
        <label>{tr("Limite de despesas ({0})", currencySymbol())}<input
            autoFocus
            required
            inputMode="decimal"
            placeholder={tr("Ex.: 3.000,00")}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <p className="form-hint">{tr("Despesas pagas e previstas contam para o orçamento. O limite é exclusivo deste mês.")}</p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <button type="button" className="button secondary" onClick={onClose}>{tr("Cancelar")}</button>
          <button className="button primary" type="submit">{tr("Salvar orçamento")}</button>
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
  const [preferredLanguage, setPreferredLanguage] = useState(readLanguagePreference);
  const language = data.language ?? preferredLanguage;
  setCurrentLanguage(language);
  setCurrentCurrency(data.currency ?? "BRL", data.exchangeRates);
const navItems = [
  { id: "overview" as const, label: tr("Visão geral"), icon: LayoutDashboard },
  { id: "calendar" as const, label: tr("Minha agenda"), icon: CalendarDays },
  { id: "tasks" as const, label: tr("Minhas tarefas"), icon: ListTodo },
  { id: "finance" as const, label: tr("Minhas finanças"), icon: Wallet },
];

  useEffect(() => {
    setPreferredLanguage(language);
    document.documentElement.lang = language;
    document.querySelector('meta[name="description"]')?.setAttribute("content", tr("Organize sua rotina e cuide do seu dinheiro. Agenda, tarefas e finanças pessoais em um só lugar."));
    try { localStorage.setItem(LANGUAGE_KEY, language); } catch { /* Preferences must not overwrite workspace errors. */ }
  }, [language]);
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
  const [financeTab, setFinanceTab] = useState<"summary" | "cards" | "planning" | "accounts" | "reports">("summary");
  const [today, setToday] = useState(dateKey);
  const [refreshTick, setRefreshTick] = useState(0);
  const [reminders, setReminders] = useState<ReminderState>(initialReminderState);
  const dataRef = useRef(data); dataRef.current = data;
  const languageCurrencyRequest = useRef<AbortController | null>(null);
  const [languageCurrencyStatus, setLanguageCurrencyStatus] = useState<{ target: Currency; status: "loading" | "ready" | "error" } | null>(null);
  const [languageCurrencyQuote, setLanguageCurrencyQuote] = useState<{ language: Language; target: Currency; rates: ExchangeRates; request: AbortController } | null>(null);
  useEffect(() => () => languageCurrencyRequest.current?.abort(), []);
  useEffect(() => {
    const quote = languageCurrencyQuote;
    if (!quote || editor || confirm || welcomeOpen || helpOpen) return;
    if (quote.request.signal.aborted || languageCurrencyRequest.current !== quote.request || dataRef.current.language !== quote.language) return;
    const ok = save({ ...dataRef.current, currency: quote.target, exchangeRates: { ...dataRef.current.exchangeRates, ...quote.rates } });
    setLanguageCurrencyQuote(null);
    setLanguageCurrencyStatus(ok ? null : { target: quote.target, status: "error" });
    if (ok) setToast(tr("Moeda atualizada."));
  }, [languageCurrencyQuote, editor, confirm, welcomeOpen, helpOpen]);
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
  const hasData = data.tasks.length > 0 || data.transactions.length > 0 || !!data.cards?.length || !!data.recurrences?.length || !!data.goals?.length || !!Object.keys(data.openingBalances ?? {}).length;
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
        normalize(recordText(t.id, t.title) + " " + tr(t.category) + " " + t.notes).includes(
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
        normalize(recordText(t.id, t.description) + " " + tr(t.category) + " " + t.notes).includes(
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
    document.title = tr("{0} · DailyAPP", view === "overview" ? tr("Visão geral") : view === "settings" ? tr("Configurações") : navItems.find((n) => n.id === view)?.label);
  }, [view, language]);
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
    catch (error) { setToast(error instanceof Error ? error.message : tr("Não foi possível validar os registros.")); return false; }
    if (recovery) cancelLanguageCurrency();
    if (workspace) {
      const ok = workspace.save(next, recovery);
      if (!ok) setToast(workspace.getSnapshot().message);
      return ok;
    }
    if (storageError && !recovery) {
      setToast(
        tr("Recupere seus dados nas configurações antes de fazer alterações."),
      );
      return false;
    }
    if (next.tasks.length > 5000 || next.transactions.length > 10000) {
      setToast(
        tr("Limite de registros atingido. Exporte um backup antes de remover registros antigos."),
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
        tr("Não foi possível salvar. Verifique o espaço e a permissão de armazenamento do dispositivo."),
      );
      return false;
    }
  }
  function cancelLanguageCurrency() {
    languageCurrencyRequest.current?.abort();
    languageCurrencyRequest.current = null;
    setLanguageCurrencyQuote(null);
    setLanguageCurrencyStatus(null);
  }
  async function changeLanguage(next: Language) {
    cancelLanguageCurrency();
    const target = currencyForLanguage(next);
    const current = dataRef.current;
    const ready = target === "BRL" || !!current.exchangeRates?.[target];
    if (!save({ ...current, language: next, ...(ready ? { currency: target } : {}) })) return;
    setCurrentLanguage(next); setPreferredLanguage(next); setToast(tr("Idioma atualizado."));
    if (ready) return;
    const request = new AbortController(); languageCurrencyRequest.current = request;
    setLanguageCurrencyStatus({ target, status: "loading" });
    try {
      const rates = await fetchExchangeRates(request.signal);
      if (request.signal.aborted || languageCurrencyRequest.current !== request || dataRef.current.language !== next) return;
      setLanguageCurrencyQuote({ language: next, target, rates, request });
      setLanguageCurrencyStatus({ target, status: "ready" });
    } catch {
      if (!request.signal.aborted && languageCurrencyRequest.current === request) setLanguageCurrencyStatus({ target, status: "error" });
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
      if (!allowed && result.state !== "web") setToast(tr("Permita notificações nas configurações do celular para receber lembretes."));
      else if (result.state === "error") setToast(tr("Os dados foram salvos, mas não foi possível atualizar os lembretes. Tente novamente em Ajustes."));
    } catch { setReminders({ state: "error", count: 0 }); setToast(tr("Os dados foram salvos. Não foi possível ativar os lembretes neste momento.")); }
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
        exists ? tr("Tarefa atualizada.") : tr("Tarefa criada. Um passo de cada vez!"),
      );
    return ok;
  }
  function toggleFocus(task: Task) {
    const focused = task.focusDate === today;
    if (!focused && data.tasks.filter(t=>t.focusDate===today).length >= 3) { setToast(tr("Escolha no máximo três prioridades para cada dia.")); return; }
    save({ ...data, tasks: data.tasks.map(t=>t.id===task.id?{...t,focusDate:focused?undefined:today}:t) });
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
      setToast(task.completed ? tr("Tarefa reaberta.") : tr("Tarefa concluída. Boa!"));
  }
  function deleteTask(task: Task) {
    setConfirm({
      title: tr("Excluir tarefa?"),
      text: tr("A tarefa “{0}” será removida da sua agenda.", recordText(task.id, task.title)),
      destructive: true,
      action: () => {
        if (
          save({ ...data, tasks: data.tasks.filter((t) => t.id !== task.id) })
        )
          setToast(tr("Tarefa excluída."));
      },
    });
  }
  function taskRow(task: Task, withDate = false) {
    return (
      <TaskRow
        key={task.id}
        task={task}
        onToggle={() => toggleTask(task)}
        onFocus={() => toggleFocus(task)}
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
        exists ? tr("Movimentação atualizada.") : tr("Movimentação registrada."),
      );
    }
    return ok;
  }
  function deleteTransaction(transaction: Transaction) {
    setConfirm({
      title: transaction.installment ? tr("Excluir compra e parcelas?") : tr("Excluir movimentação?"),
      text: transaction.installment ? tr("Todas as parcelas da compra “{0}”, inclusive as pagas, serão removidas. Os saldos e faturas serão recalculados.", transaction.description) : tr("O registro “{0}” de {1} será removido. Seu saldo será recalculado.", recordText(transaction.id, transaction.description), money(transaction.amountCents)),
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
          setToast(tr("Movimentação excluída."));
      },
    });
  }
  function stopRepeating(id: string) {
    setConfirm({ title: tr("Parar repetição?"), text: tr("As próximas ocorrências ainda não concluídas ou pagas serão removidas. O histórico e os registros de hoje serão mantidos."), action: () => { if (save(stopRecurrence(data, id, today))) setToast(tr("Repetição encerrada. Seu histórico foi mantido.")); } });
  }
  function saveWallet(item: WalletAccount) {
    const old = data.accounts ?? [];
    const ok = save({ ...data, accounts: old.some(a=>a.id===item.id)?old.map(a=>a.id===item.id?item:a):[...old,item] });
    if (ok) setToast(tr("Conta salva.")); return ok;
  }
  function archiveWallet(item: WalletAccount) {
    setConfirm({title:item.archived?tr("Reativar conta?"):tr("Arquivar conta?"),text:tr("A conta e seus registros serão preservados. O saldo continua no total, mesmo arquivada."),action:()=>{save({...data,accounts:data.accounts?.map(a=>a.id===item.id?{...a,archived:!a.archived}:a)});}});
  }
  function saveTransfer(item: Transfer) {
    const old=data.transfers??[];
    const ok=save({...data,transfers:old.some(t=>t.id===item.id)?old.map(t=>t.id===item.id?item:t):[...old,item]});
    if(ok)setToast(tr("Transferência salva.")); return ok;
  }
  function deleteTransfer(item: Transfer) {
    setConfirm({title:tr("Excluir transferência?"),text:tr("Os saldos das duas contas serão recalculados. Receitas e despesas não serão alteradas."),destructive:true,action:()=>{save({...data,transfers:data.transfers?.filter(t=>t.id!==item.id)});}});
  }
  function saveCard(card: CreditCard) {
    const cards = data.cards ?? [];
    const ok = save({ ...data, cards: cards.some(c => c.id === card.id) ? cards.map(c => c.id === card.id ? card : c) : [...cards, card] });
    if (ok) { setToast(tr("Cartão salvo.")); if (card.reminderDays !== undefined) void activateReminders(); }
    return ok;
  }
  function savePurchase(input: PurchaseInput) {
    const card = data.cards?.find(c => c.id === input.cardId && !c.archived);
    if (!card) return false;
    try {
      const parts = purchaseInstallments(card, input);
      if (!save({ ...data, transactions: [...data.transactions, ...parts] })) return false;
      setMonth(parts[0].date.slice(0, 7)); setFinanceTab("cards");
      setToast(tr("{0} {1}.", parts.length, parts.length === 1 ? tr("parcela registrada") : tr("parcelas registradas")));
      if (card.reminderDays !== undefined) void activateReminders();
      return true;
    } catch (error) { setToast((error as Error).message); return false; }
  }
  function payInvoice(card: CreditCard) {
    const totals = cardSummary(data, card.id, month);
    setConfirm({ title: tr("Marcar fatura como paga?"), text: tr("{0} das parcelas de {1} neste mês serão marcados como pagos. Nenhum gasto adicional será criado.", money(totals.pending), card.name), action: () => {
      if (save({ ...data, transactions: data.transactions.map(t => t.installment?.cardId === card.id && t.date.startsWith(month) ? { ...t, paid: true, ...(card.paymentAccountId && !t.paid ? { accountId: card.paymentAccountId } : {}) } : t) })) setToast(tr("Fatura marcada como paga."));
    } });
  }
  function archiveCard(card: CreditCard) {
    setConfirm({ title: card.archived ? tr("Reativar cartão?") : tr("Arquivar cartão?"), text: card.archived ? tr("O cartão voltará a aceitar novas compras. Seu histórico será mantido.") : tr("O cartão não aceitará novas compras. As parcelas, faturas e o histórico continuarão disponíveis."), action: () => { if (save({ ...data, cards: data.cards?.map(c => c.id === card.id ? { ...c, archived: !card.archived } : c) })) setToast(card.archived ? tr("Cartão reativado.") : tr("Cartão arquivado. Suas parcelas foram mantidas.")); } });
  }
  function settleTransaction(item: Transaction) {
    if (save({ ...data, transactions: data.transactions.map(t => t.id === item.id ? { ...t, paid: true } : t) }))
      setToast(item.type === "income" ? tr("Recebimento confirmado.") : tr("Pagamento confirmado."));
  }
  function openPlanning() {
    setFinanceTab("planning"); changeMonth(today.slice(0, 7)); go("finance");
  }
  function saveGoal(goal: FinancialGoal) {
    const goals = data.goals ?? [];
    const ok = save({ ...data, goals: goals.some(g => g.id === goal.id) ? goals.map(g => g.id === goal.id ? goal : g) : [...goals, goal] });
    if (ok) setToast(tr("Meta salva. Seu progresso está atualizado."));
    return ok;
  }
  function archiveGoal(goal: FinancialGoal) {
    setConfirm({ title: goal.archived ? tr("Reativar meta?") : tr("Arquivar meta?"), text: tr("O nome, o prazo e o progresso da meta serão preservados. Isso não altera suas movimentações."), action: () => {
      if (save({ ...data, goals: data.goals?.map(g => g.id === goal.id ? { ...g, archived: !g.archived } : g) })) setToast(goal.archived ? tr("Meta reativada.") : tr("Meta arquivada."));
    } });
  }
  function deleteGoal(goal: FinancialGoal) {
    setConfirm({ title: tr("Excluir meta?"), text: tr("A meta “{0}” e seu progresso serão removidos. Nenhuma movimentação será alterada.", goal.name), destructive: true, action: () => {
      if (save({ ...data, goals: data.goals?.filter(g => g.id !== goal.id) })) setToast(tr("Meta excluída."));
    } });
  }
  function saveOpening(amount?: number) {
    const openingBalances = { ...data.openingBalances };
    if (amount === undefined) delete openingBalances[month];
    else openingBalances[month] = amount;
    const ok = save({ ...data, openingBalances });
    if (ok) setToast(amount === undefined ? tr("Saldo inicial removido deste mês.") : tr("Saldo inicial salvo. Previsão atualizada."));
    return ok;
  }
  function startDemo() {
    const action = () => {
      const example = { ...createDemo(), name: data.name, ...(data.language ? { language: data.language } : {}), ...(data.currency ? { currency: data.currency } : {}), ...(data.exchangeRates ? { exchangeRates: data.exchangeRates } : {}) };
      if (save(example)) {
        setMonth(monthKey());
        setSelectedDate(today);
        go("overview");
        setToast(tr("Dados de exemplo carregados. Explore à vontade!"));
      }
    };
    if (hasData)
      setConfirm({
        title: tr("Carregar dados de exemplo?"),
        text: tr("Os dados atuais serão substituídos. Exporte um backup nas configurações antes de continuar."),
        action,
      });
    else action();
  }
  function clearDemo() {
    setConfirm({
      title: tr("Começar com seus dados?"),
      text: tr("As tarefas, movimentações e o orçamento de exemplo serão removidos. Registros e orçamentos que você criou serão preservados."),
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
          setToast(tr("Tudo pronto para a sua rotina."));
      },
    });
  }
  async function exportData() {
    try {
      const raw = storageError
        ? localStorage.getItem(STORAGE_KEY)
        : JSON.stringify({ ...data, language }, null, 2);
      if (!raw) {
        setToast(tr("Não há dados salvos para exportar."));
        return;
      }
      await saveBackup(
        raw,
        `dailyapp-${storageError ? "recuperacao-" : ""}${today}.json`,
      );
      setToast(mobileApp
        ? tr("Backup preparado. Guarde sua cópia em um lugar seguro.")
        : tr("Backup exportado. Guarde-o em um lugar seguro."));
    } catch (error) {
      if (error instanceof Error && /cancel/i.test(error.message)) return;
      setToast(tr("Não foi possível exportar o backup. Seus registros continuam salvos."));
    }
  }
  function previewRestore(imported: AppData) {
      setConfirm({
        title: tr("Restaurar este backup?"),
        text: tr("Prévia: {0} tarefas, {1} movimentações, {2} contas, {3} transferências e {4} metas. Moeda: {5}. Os dados atuais serão substituídos somente ao confirmar.", imported.tasks.length, imported.transactions.length, imported.accounts?.length ?? 0, imported.transfers?.length ?? 0, imported.goals?.length ?? 0, imported.currency ?? "BRL"),
        action: () => {
          if (save(imported, true)) {
            setName(imported.name);
            setToast(translate(imported.language ?? language, "Backup restaurado com sucesso."));
          }
        },
      });
  }
  async function importData(file?: File) {
    if (!file) return;
    try {
      if (file.size > 20 * 1024 * 1024)
        throw new Error(tr("O arquivo deve ter no máximo 20 MB."));
      const parsed = JSON.parse(await file.text());
      if (isEncryptedBackup(parsed)) { setEditor({kind:"unlock-backup",envelope:parsed}); return; }
      const imported = validateData(parsed);
      previewRestore(imported);
    } catch (error) {
      setToast(
        error instanceof SyntaxError
          ? tr("O arquivo não contém um JSON válido.")
          : error instanceof Error
            ? error.message
            : tr("Não foi possível importar o backup."),
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
          <span>{tr("Saldo do mês")}</span>
          <span className="stat-icon green">
            <Wallet size={19} />
          </span>
        </div>
        <strong className={totals.balance < 0 ? "negative" : ""}>
          {money(totals.balance)}
        </strong>
        <span className="stat-caption">{tr("Receitas recebidas − despesas pagas")}</span>
      </div>
      <div className="stat-card">
        <div className="stat-top">
          <span>{tr("Receitas recebidas")}</span>
          <span className="stat-icon sage">
            <ArrowDownLeft size={20} />
          </span>
        </div>
        <strong>{money(totals.income)}</strong>
        <span className="stat-caption">
          {totals.expectedIncome
            ? tr("{0} a receber", money(totals.expectedIncome))
            : tr("Tudo que entrou neste mês")}
        </span>
      </div>
      <div className="stat-card">
        <div className="stat-top">
          <span>{tr("Despesas pagas")}</span>
          <span className="stat-icon peach">
            <ArrowUpRight size={20} />
          </span>
        </div>
        <strong>{money(totals.expense)}</strong>
        <span className="stat-caption">
          {totals.pending
            ? tr("{0} ainda a pagar", money(totals.pending))
            : tr("Tudo que saiu neste mês")}
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
        <h2>{tr("Seu orçamento")}</h2>
        <button
          className="icon-button"
          aria-label={tr("Editar orçamento")}
          onClick={() => setEditor({ kind: "budget" })}
        >
          <Pencil size={16} />
        </button>
      </div>
      <p>
        {budget
          ? budgetPercent > 100
            ? tr("Hora de ajustar a rota. Você pode retomar o controle.")
            : tr("Pequenas escolhas. Mais tranquilidade no fim do mês.")
          : tr("Dê um destino ao seu dinheiro antes de gastar.")}
      </p>
      {budget ? (
        <>
          <div className="budget-amount">
            <strong>{money(totals.committed)}</strong>
            <span>{tr("de ")}{money(budget)}</span>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-label={tr("Orçamento comprometido")}
            aria-valuenow={Math.min(budgetPercent, 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ width: `${Math.min(budgetPercent, 100)}%` }} />
          </div>
          <div className="budget-foot">
            <span>{budgetPercent}{tr("% comprometidos")}</span>
            <strong>
              {totals.committed > budget
                ? tr("{0} acima", money(totals.committed - budget))
                : tr("{0} livres", money(budget - totals.committed))}
            </strong>
          </div>
          <small>{tr("Inclui despesas pagas e previstas.")}</small>
        </>
      ) : (
        <button
          className="button budget-button"
          onClick={() => setEditor({ kind: "budget" })}
        >
          <Plus size={16} />{tr("Definir orçamento")}</button>
      )}
    </section>
  );

  return (
    <div className={`app-shell${mobileApp ? " mobile-app" : ""}`}>
      <a className="skip-link" href="#main">{tr("Ir para o conteúdo")}</a>
      {mobileMenu && (
        <button
          className="sidebar-backdrop"
          aria-label={tr("Fechar menu")}
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
          aria-label={tr("DailyAPP, página inicial")}
        >
          <span className="brand-mark">
            <CheckCheck size={25} strokeWidth={2.5} />
          </span>
          <span>{tr("daily")}<span className="brand-light">{tr("app")}</span>
            <span className="brand-dot">.</span>
          </span>
        </button>
        <div className="sidebar-caption">{tr("SUA VIDA, MAIS LEVE")}</div>
        <nav aria-label={tr("Navegação principal")}>
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
            <h3>{tr("Um passo de cada vez.")}</h3>
            <p>{tr("Organize o hoje.")}<br />{tr("Aproveite melhor o amanhã.")}</p>
            <button onClick={startDemo}>{tr("Explorar exemplo ")}<ArrowRight size={14} />
            </button>
          </div>
          <button
            className={`nav-item ${view === "settings" ? "active" : ""}`}
            aria-current={view === "settings" ? "page" : undefined}
            onClick={() => go("settings")}
          >
            <Settings2 size={19} />{tr("Configurações")}</button>
          <div className="local-badge">
            <ShieldCheck size={14} />{tr("Seus dados ficam com você")}</div>
          <button className="profile" onClick={() => go("settings")}>
            <span className="avatar">
              {data.name ? data.name.slice(0, 1).toUpperCase() : tr("V")}
            </span>
            <span>
              <strong>{data.name || tr("Seu espaço pessoal")}</strong>
              <small>{tr("Uma rotina com propósito")}</small>
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
              aria-label={tr("Abrir menu")}
              aria-expanded={mobileMenu}
              onClick={() => setMobileMenu(true)}
            >
              <Menu size={21} />
            </button>
            <span>{mobileApp ? tr("dailyapp.") : tr("Meu espaço")}</span>
            <ChevronRight size={13} />
            <strong>
              {view === "settings"
                ? tr("Configurações")
                : navItems.find((n) => n.id === view)?.label}
            </strong>
          </div>
          <div className="topbar-date">
            <CalendarDays size={15} />
            <span>
              {new Date().toLocaleDateString(getLocale(), {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
          <span className="topbar-avatar" aria-hidden="true">
            {data.name ? data.name.slice(0, 1).toUpperCase() : tr("V")}
          </span>
        </header>
        <main id="main">
          {storageError && (
            <div className="error-banner" role="alert">
              <CircleHelp size={19} />
              <span>{storageError}</span>
              <button onClick={() => go("settings")}>{tr("Recuperar dados")}</button>
            </div>
          )}
          {languageCurrencyStatus && <div className="error-banner currency-language-banner" aria-live="polite">
            <Wallet size={19} />
            <span>{languageCurrencyStatus.status === "loading"
              ? tr("Buscando cotação para {0}. Os valores continuam em {1} até a conversão estar pronta.", languageCurrencyStatus.target, getCurrency())
              : languageCurrencyStatus.status === "ready"
                ? tr("Cotação pronta para {0}. Feche o formulário para aplicar a moeda.", languageCurrencyStatus.target)
                : tr("Sem cotação para {0}, os valores continuam em {1}. Atualize a cotação ou informe uma taxa manual em Ajustes.", languageCurrencyStatus.target, getCurrency())}</span>
            <button onClick={() => go("settings")}>{tr("Moeda e conversão")}</button>
          </div>}
          {data.demo && (
            <div className="demo-banner">
              <Sparkles size={15} />
              <span>{tr("Você está explorando dados de exemplo.")}</span>
              <button onClick={clearDemo}>{tr("Usar meus dados ")}<ArrowRight size={14} />
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
                      ? tr("Olá, {0}!", data.name.split(" ")[0])
                      : tr("BEM-VINDO AO SEU ESPAÇO")}
                  </>
                ) : view === "calendar" ? (
                  tr("TEMPO PARA O QUE IMPORTA")
                ) : view === "tasks" ? (
                  tr("UMA COISA DE CADA VEZ")
                ) : view === "finance" ? (
                  tr("MAIS CLAREZA, MENOS PREOCUPAÇÃO")
                ) : (
                  tr("DO SEU JEITO")
                )}
              </div>
              <h1 ref={headingRef} tabIndex={-1}>
                {view === "overview"
                  ? tr("Seu dia, em equilíbrio.")
                  : view === "calendar"
                    ? tr("Minha agenda")
                    : view === "tasks"
                      ? tr("Minhas tarefas")
                      : view === "finance"
                        ? tr("Minhas finanças")
                        : tr("Seu espaço, suas escolhas.")}
              </h1>
              <p>
                {view === "overview"
                  ? tr("Cuide da sua rotina e do seu dinheiro em um só lugar.")
                  : view === "calendar"
                    ? tr("Encontre espaço para os compromissos e para você.")
                    : view === "tasks"
                      ? tr("Transforme planos em pequenos passos possíveis.")
                      : view === "finance"
                        ? tr("Saiba de onde vem e para onde vai o seu dinheiro.")
                        : tr("Personalize sua experiência e cuide dos seus dados.")}
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
                    <Plus size={17} />{tr("Nova tarefa")}</button>
                )}
                {(view === "overview" || view === "finance") && (
                  <button
                    className="button primary"
                    onClick={() => setEditor({ kind: "transaction" })}
                  >
                    <Plus size={17} />{tr("Nova movimentação")}</button>
                )}
              </div>
            )}
          </div>

          {view === "overview" && (
            <>
              <div className="section-toolbar">
                <h2>{tr("Um olhar para o seu mês ")}<span className="subtle-dot">·</span>{" "}
                  <span className="light-text">{tr("seu resumo")}</span>
                </h2>
                <MonthControl month={month} onChange={changeMonth} />
              </div>
              <div className="stats-grid overview-stats">
                <div className="stat-card">
                  <div className="stat-top">
                    <span>{tr("Tarefas de hoje")}</span>
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
                      ? tr("{0} pendentes · no seu ritmo", todaysTasks.length - completedToday)
                      : tr("Um novo dia de possibilidades")}
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
                    <strong>{tr("O primeiro passo é seu.")}</strong>
                    <p>{tr("Adicione uma tarefa, registre um gasto ou descubra como tudo funciona.")}</p>
                  </div>
                  <button className="button secondary" onClick={startDemo}>
                    <Sparkles size={16} />{tr("Explorar exemplo")}</button>
                </div>
              )}
              <div className="dashboard-grid">
                <section className="panel today-panel">
                  <div className="panel-heading">
                    <div className="section-icon lavender">
                      <ListTodo size={19} />
                    </div>
                    <div>
                      <h2>{tr("O que temos para hoje?")}</h2>
                      <p>
                        {new Date().toLocaleDateString(getLocale(), {
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
                    >{tr("Ver todas ")}<ArrowRight size={14} />
                    </button>
                  </div>
                  {todaysTasks.length > 0 ? (
                    <>
                      <div className="daily-progress">
                        <span>
                          {completedToday}{tr(" de ")}{todaysTasks.length}{tr(" concluídas")}</span>
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
                      title={tr("Seu dia está em aberto")}
                      text={tr("Organize seus próximos passos. Sem pressa.")}
                      action={
                        <button
                          className="text-button"
                          onClick={() => setEditor({ kind: "task" })}
                        >
                          <Plus size={15} />{tr("Adicionar primeira tarefa")}</button>
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
                        ? tr("tarefa de dias anteriores")
                        : tr("tarefas de dias anteriores")}
                      <ArrowRight size={14} />
                    </button>
                  )}
                  <button
                    className="panel-add"
                    onClick={() => setEditor({ kind: "task" })}
                  >
                    <Plus size={16} />{tr("Adicionar tarefa")}</button>
                </section>
                <DailyFocus tasks={data.tasks} today={today} onToggle={toggleTask} onEdit={item=>setEditor({kind:"task",item})} onRemove={toggleFocus} />
                <TodayMoney data={data} today={today} onEdit={item => setEditor({ kind: "transaction", item })} onSettle={settleTransaction} onPlanning={openPlanning} />
                <section className="panel chart-panel">
                  <div className="panel-heading">
                    <div className="section-icon sage">
                      <TrendingUp size={19} />
                    </div>
                    <div>
                      <h2>{tr("Seu dinheiro em movimento")}</h2>
                      <p>{tr("Valores pagos acumulados no mês")}</p>
                    </div>
                    <button
                      className="icon-button"
                      aria-label={tr("Ver finanças")}
                      onClick={() => go("finance")}
                    >
                      <ArrowUpRight size={19} />
                    </button>
                  </div>
                  <div className="chart-legend">
                    <span>
                      <i className="legend-dot income-dot" />{tr("Receitas")}</span>
                    <span>
                      <i className="legend-dot expense-dot" />{tr("Despesas")}</span>
                    <small>{tr("em {0}", getCurrency())}</small>
                  </div>
                  <FinanceChart entries={totals.entries} month={month} />
                  <div className="chart-foot">
                    <span>
                      <span className="tiny-dot" />
                      {totals.entries.length
                        ? tr("{0} movimentações registradas no mês", totals.entries.length)
                        : tr("Cada registro ajuda a enxergar melhor")}
                    </span>
                    <button
                      className="text-button"
                      onClick={() => go("finance")}
                    >{tr("Ver detalhes ")}<ArrowRight size={14} />
                    </button>
                  </div>
                </section>
                <section className="panel expenses-panel">
                  <div className="panel-heading">
                    <div className="section-icon peach">
                      <Wallet size={19} />
                    </div>
                    <div>
                      <h2>{tr("Para onde vai seu dinheiro?")}</h2>
                      <p>{tr("Despesas pagas e previstas por categoria")}</p>
                    </div>
                    <span className="small-badge">
                      {categoryCount}{" "}
                      {categoryCount === 1 ? tr("categoria") : tr("categorias")}
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
                    <p>{tr("Você não precisa dar conta de tudo hoje.")}<br />
                      <strong>{tr("Constância vale mais que perfeição.")}</strong>
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
                <div className="filter-tabs" aria-label={tr("Filtrar tarefas")}>
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
                      {tr(f)}
                    </button>
                  ))}
                </div>
                <label className="search-field">
                  <Search size={16} />
                  <input
                    aria-label={tr("Buscar tarefas")}
                    placeholder={tr("Buscar uma tarefa...")}
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                  />
                </label>
              </div>
              <div className="list-summary">
                <span>
                  {visibleTasks.length}{" "}
                  {visibleTasks.length === 1 ? tr("tarefa") : tr("tarefas")}
                </span>
                <small>
                  {data.tasks.filter((t) => t.completed).length}{tr(" concluídas no total")}</small>
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
                      ? tr("Nenhuma tarefa por aqui")
                      : tr("Vamos tirar os planos do papel?")
                  }
                  text={
                    taskSearch
                      ? tr("Tente buscar por outro termo.")
                      : tr("Crie uma tarefa ou escolha outro filtro para continuar.")
                  }
                  action={
                    <button
                      className="button primary"
                      onClick={() => setEditor({ kind: "task" })}
                    >
                      <Plus size={16} />{tr("Nova tarefa")}</button>
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
                  >{tr("Hoje")}</button>
                </div>
                <div className="calendar-weekdays">
                  {Array.from({ length: 7 }, (_, index) => new Date(2026, 0, 4 + index, 12).toLocaleDateString(getLocale(), { weekday: "short" }).replace(/\.$/, "").toLocaleUpperCase(getLocale())).map(
                    (day, index) => <span key={index}>{day}</span>,
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
                        aria-label={tr("{0}, {1} tarefas", day.toLocaleDateString(getLocale(), { day: "numeric", month: "long" }), tasks.length)}
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
                              {recordText(t.id, t.title)}
                            </span>
                          ))}
                          {tasks.length > 2 && (
                            <small>+{tasks.length - 2}{tr(" tarefas")}</small>
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
                    <i className="legend-dot income-dot" />{tr("Tarefa pendente")}</span>
                  <span>
                    <i className="legend-dot completed-dot" />{tr("Concluída")}</span>
                </div>
              </section>
              <section className="panel agenda-day-panel">
                <div className="panel-heading">
                  <div className="section-icon sage">
                    <CalendarDays size={19} />
                  </div>
                  <div>
                    <h2>
                      {parseDate(selectedDate).toLocaleDateString(getLocale(), {
                        day: "numeric",
                        month: "long",
                      })}
                    </h2>
                    <p>
                      {parseDate(selectedDate).toLocaleDateString(getLocale(), {
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
                    title={tr("Um dia de possibilidades")}
                    text={tr("Selecione um dia e adicione seus compromissos.")}
                  />
                )}
                <button
                  className="panel-add"
                  onClick={() =>
                    setEditor({ kind: "task", date: selectedDate })
                  }
                >
                  <Plus size={16} />{tr("Adicionar neste dia")}</button>
              </section>
            </div>
          )}

          {view === "finance" && (
            <>
              <div className="finance-subnav" role="group" aria-label={tr("Visão financeira")}><button aria-pressed={financeTab === "summary"} className={financeTab === "summary" ? "selected" : ""} onClick={() => setFinanceTab("summary")}>{tr("Resumo")}</button><button aria-pressed={financeTab === "cards"} className={financeTab === "cards" ? "selected" : ""} onClick={() => setFinanceTab("cards")}>{tr("Cartões e parcelas")}</button><button aria-pressed={financeTab === "accounts"} className={financeTab === "accounts" ? "selected" : ""} onClick={()=>setFinanceTab("accounts")}>{tr("Contas")}</button><button aria-pressed={financeTab === "reports"} className={financeTab === "reports" ? "selected" : ""} onClick={()=>setFinanceTab("reports")}>{tr("Relatório")}</button><button aria-pressed={financeTab === "planning"} className={financeTab === "planning" ? "selected" : ""} onClick={() => setFinanceTab("planning")}>{tr("Planejamento")}</button></div>
              <div className="section-toolbar">
                <h2>{financeTab === "cards" ? tr("Suas faturas") : financeTab === "planning" ? tr("Seu planejamento") : tr("Seu resumo financeiro")}</h2>
                <div className="month-tools">
                  {month !== monthKey() && (
                    <button className="text-button" onClick={resetMonth}>{tr("Mês atual")}</button>
                  )}
                  <MonthControl month={month} onChange={changeMonth} />
                </div>
              </div>
              {financeTab === "accounts" ? <AccountsPanel data={data} today={today} month={month} onNew={()=>setEditor({kind:"account"})} onEdit={item=>setEditor({kind:"account",item})} onArchive={archiveWallet} onTransfer={item=>setEditor({kind:"transfer",item})} onDeleteTransfer={deleteTransfer}/> : financeTab === "reports" ? <ReportPanel data={data} month={month}/> : financeTab === "cards" ? <CardsPanel data={data} month={month} onNew={() => setEditor({ kind: "card" })} onEdit={item => setEditor({ kind: "card", item })} onArchive={archiveCard} onPurchase={card => setEditor({ kind: "purchase", cardId: card.id })} onPay={payInvoice} /> : financeTab === "planning" ? <div className="planning-layout"><ForecastPanel data={data} month={month} onOpening={() => setEditor({ kind: "opening" })} /><GoalsPanel goals={data.goals ?? []} today={today} onNew={() => setEditor({ kind: "goal" })} onEdit={item => setEditor({ kind: "goal", item })} onArchive={archiveGoal} onDelete={deleteGoal} /><CategoryBudgetsPanel data={data} month={month} onEdit={()=>setEditor({kind:"category-budgets"})}/></div> : <>
              <QuickExpenses data={data} onSelect={preset=>setEditor({kind:"transaction",preset})} />
              <RecurrencePanel data={data} kind="transaction" onStop={stopRepeating} />
              <div className="stats-grid">
                {financialCards}
                <div className="stat-card">
                  <div className="stat-top">
                    <span>{tr("A pagar")}</span>
                    <span className="stat-icon sand">
                      <Clock3 size={19} />
                    </span>
                  </div>
                  <strong>{money(totals.pending)}</strong>
                  <span className="stat-caption">{tr("Despesas previstas neste mês")}</span>
                </div>
              </div>
              <div className="finance-middle">
                <section className="panel">
                  <div className="panel-heading">
                    <div className="section-icon peach">
                      <Wallet size={19} />
                    </div>
                    <div>
                      <h2>{tr("Despesas por categoria")}</h2>
                      <p>{tr("Inclui valores pagos e previstos")}</p>
                    </div>
                  </div>
                  <Expenses entries={totals.entries} />
                </section>
                {budgetPanel}
              </div>
              <section className="panel transactions-panel">
                <div className="panel-heading">
                  <div>
                    <h2>{tr("Suas movimentações")}</h2>
                    <p>{tr("Um histórico para entender suas escolhas.")}</p>
                  </div>
                  <button className="text-button" onClick={exportData}>
                    <Download size={15} />{tr("Exportar backup")}</button>
                </div>
                <div className="transaction-toolbar">
                  <div
                    className="filter-tabs"
                    aria-label={tr("Filtrar movimentações")}
                  >
                    {["Todas", "Receitas", "Despesas"].map((f) => (
                      <button
                        key={f}
                        aria-pressed={financeFilter === f}
                        className={financeFilter === f ? "selected" : ""}
                        onClick={() => setFinanceFilter(f)}
                      >
                        {tr(f)}
                      </button>
                    ))}
                  </div>
                  <div className="transaction-search">
                    <select
                      aria-label={tr("Filtrar status")}
                      value={financeStatus}
                      onChange={(e) => setFinanceStatus(e.target.value)}
                    >
                      {["Todos os status", "Efetivadas", "Previstas"].map(
                        (s) => (
                          <option key={s} value={s}>{tr(s)}</option>
                        ),
                      )}
                    </select>
                    <label className="search-field">
                      <Search size={16} />
                      <input
                        aria-label={tr("Buscar movimentações")}
                        placeholder={tr("Buscar movimentação...")}
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
                            <th>{tr("Descrição")}</th>
                            <th>{tr("Categoria")}</th>
                            <th>{tr("Data")}</th>
                            <th>{tr("Status")}</th>
                            <th className="text-right">{tr("Valor")}</th>
                            <th>
                              <span className="sr-only">{tr("Ações")}</span>
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
                                    {recordText(t.id, t.description)}{t.installment && <span className="installment-label"> · {t.installment.index}/{t.installment.count}</span>}
                                    <small>
                                      {t.type === "income"
                                        ? tr("Receita")
                                        : tr("Despesa")}
                                      {t.recurrenceId && tr(" · Recorrente")}
                                      {t.installment && tr(" · {0}", data.cards?.find(c => c.id === t.installment?.cardId)?.name ?? tr("Cartão"))}
                                      <span className="mobile-transaction-meta">
                                        {" "}
                                        · {prettyDate(t.date)}
                                        <br />
                                        {tr(t.category)}
                                      </span>
                                    </small>
                                  </button>
                                </div>
                              </td>
                              <td>
                                <span className="neutral-tag">
                                  {tr(t.category)}
                                </span>
                              </td>
                              <td>{prettyDate(t.date)}</td>
                              <td>
                                <button
                                  className={`status-pill ${t.paid ? "paid" : "pending"}`}
                                  aria-label={tr("{0}: {1}", t.paid ? tr("Marcar como prevista") : t.type === "income" ? tr("Marcar como recebida") : tr("Marcar como paga"), recordText(t.id, t.description))}
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
                                      setToast(tr("Status atualizado."));
                                  }}
                                >
                                  <i />
                                  {t.paid
                                    ? t.type === "income"
                                      ? tr("Recebida")
                                      : tr("Paga")
                                    : tr("Prevista")}
                                </button>
                              </td>
                              <td
                                className={`transaction-amount ${t.type === "income" ? "positive" : ""}`}
                              >
                                {t.type === "income" ? tr("+") : tr("−")}{" "}
                                {money(t.amountCents)}
                              </td>
                              <td>
                                <div className="row-actions">
                                  <button
                                    className="icon-button"
                                    aria-label={tr("Editar movimentação: {0}", recordText(t.id, t.description))}
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
                                    aria-label={tr("Excluir movimentação: {0}", recordText(t.id, t.description))}
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
                        ? tr("movimentação")
                        : tr("movimentações")}{" "}{tr("neste filtro")}<span>{tr("Valores em {0}", getCurrency())}</span>
                    </div>
                  </>
                ) : (
                  <Empty
                    icon={<Wallet size={27} />}
                    title={tr("Nenhuma movimentação encontrada")}
                    text={tr("Registre uma receita ou despesa, ou ajuste os filtros e o mês.")}
                    action={
                      <button
                        className="button primary"
                        onClick={() => setEditor({ kind: "transaction" })}
                      >
                        <Plus size={16} />{tr("Registrar movimentação")}</button>
                    }
                  />
                )}
              </section>
              </>}
            </>
          )}

          {view === "settings" && (
            <div className="settings-grid">
              <section className="panel settings-panel language-panel">
                <div className="panel-heading"><div className="section-icon sage"><Settings2 size={19} /></div><div><h2>{tr("Idioma")}</h2><p>{tr("Escolha o idioma do aplicativo.")}</p></div></div>
                <label>{tr("Idioma do aplicativo")}<select aria-label={tr("Idioma do aplicativo")} value={language} onChange={event => { if (isLanguage(event.target.value)) changeLanguage(event.target.value); }}>{LANGUAGES.map(item => <option key={item.id} value={item.id} lang={item.id}>{item.name}</option>)}</select></label>
                <p className="form-hint">{tr("Ao trocar o idioma, a moeda muda automaticamente: inglês usa USD; português usa BRL; espanhol, francês e alemão usam EUR. É necessária uma cotação salva ou online para converter.")}</p>
              </section>
              <CurrencySettings key={language} data={data} requestedCurrency={languageCurrencyStatus?.status === "error" ? languageCurrencyStatus.target : undefined} onSave={(currency, exchangeRates) => { cancelLanguageCurrency(); const ok = save({ ...dataRef.current, currency, exchangeRates }); if (ok) setToast(tr("Moeda atualizada.")); return ok; }} />
              {!mobileApp && <section className="panel settings-panel account-panel">
                <div className="panel-heading">
                  <div className="section-icon sage">
                    <ShieldCheck size={19} />
                  </div>
                  <div>
                    <h2>
                      {account
                        ? tr("Sua conta conectada")
                        : tr("Leve sua rotina com você")}
                    </h2>
                    <p>
                      {account
                        ? account.email
                        : tr("Conta e sincronização entre dispositivos")}
                    </p>
                  </div>
                </div>
                <p>
                  {account
                    ? account.snapshot.message
                    : localAccount?.available
                      ? tr("Entre ou crie uma conta para acessar sua agenda e suas finanças em outros dispositivos. Seus registros locais podem ser importados depois.")
                      : tr("Você está usando o modo local. O acesso às contas está sendo preparado neste ambiente; seus registros continuam salvos neste navegador.")}
                </p>
                {!account && localAccount?.available && (
                  <button
                    className="button primary"
                    onClick={localAccount.login}
                  >{tr("Entrar ou criar conta")}</button>
                )}
                {account?.localAvailable && (
                  <div className="migration-card">
                    <strong>{tr("Você tem registros da versão local.")}</strong>
                    <p>{tr("Importe-os para sua conta. A cópia original neste navegador será preservada.")}</p>
                    <button
                      className="button secondary"
                      disabled={!account.snapshot.canEdit}
                      onClick={() =>
                        setConfirm({
                          title: tr("Importar registros locais?"),
                          text: tr("Tarefas, movimentações e orçamentos serão adicionados à sua conta. Registros já existentes na conta serão preservados e dados de exemplo serão ignorados."),
                          action: account.migrate,
                        })
                      }
                    >{tr("Importar meus dados locais")}</button>
                  </div>
                )}
                {account &&
                  (account.snapshot.status === "conflict" ||
                    account.snapshot.status === "error") && (
                    <div className="migration-card">
                      <strong>{tr("Recupere sua conta com cuidado.")}</strong>
                      <p>{tr("Exporte um backup das alterações deste dispositivo antes de carregar a versão da nuvem.")}</p>
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
                                  tr("Não existe uma cópia local para exportar."),
                                );
                            } catch {
                              setToast(tr("Não foi possível ler a cópia local."));
                            }
                          }}
                        >{tr("Exportar cópia local")}</button>
                        <button
                          className="button secondary"
                          onClick={() =>
                            setConfirm({
                              title: tr("Carregar dados da nuvem?"),
                              text: tr("Alterações locais ainda não sincronizadas serão substituídas. Continue apenas depois de exportar uma cópia dos registros que deseja guardar."),
                              action: () => {
                                void account.store.useRemote();
                              },
                            })
                          }
                        >{tr("Carregar dados da nuvem")}</button>
                      </div>
                    </div>
                  )}
              </section>}
              <section className="panel settings-panel">
                <div className="panel-heading">
                  <div className="section-icon lavender">
                    <Settings2 size={19} />
                  </div>
                  <div>
                    <h2>{tr("Um espaço com a sua cara")}</h2>
                    <p>{tr("Como podemos chamar você?")}</p>
                  </div>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (save({ ...data, name: name.trim() }))
                      setToast(tr("Seu nome foi atualizado."));
                  }}
                >
                  <label>{tr("Seu nome")}<input
                      maxLength={60}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={tr("Ex.: Ana")}
                    />
                  </label>
                  <button className="button primary" type="submit">{tr("Salvar nome")}</button>
                </form>
              </section>
              <section className="panel settings-panel data-panel">
                <div className="panel-heading">
                  <div className="section-icon sage">
                    <ShieldCheck size={19} />
                  </div>
                  <div>
                    <h2>{tr("Seus dados, sob seu controle")}</h2>
                    <p>
                      {account
                        ? tr("Cópia local e sincronização com sua conta.")
                        : tr("Salvos automaticamente neste dispositivo.")}
                    </p>
                  </div>
                </div>
                <p>
                  {account
                    ? tr("Suas informações são sincronizadas com sua conta. Alterações pendentes permanecem neste dispositivo até serem confirmadas na nuvem. Exporte backups para manter uma cópia independente.")
                    : tr("Suas informações ficam neste dispositivo. Exporte um backup para guardar uma cópia ou transferir seus dados para outro dispositivo.")}
                </p>
                <div className="data-counts">
                  <span>
                    <strong>{data.tasks.length}</strong>{tr(" tarefas")}</span>
                  <span>
                    <strong>{data.transactions.length}</strong>{tr(" movimentações")}</span>
                  {!!data.goals?.length && <span><strong>{data.goals.length}</strong>{tr(" metas")}</span>}
                </div>
                <div className="backup-actions">
                  <button className="button secondary" disabled={!!storageError} onClick={()=>setEditor({kind:"protect-backup"})}>{tr("Backup com senha")}</button>

                  <button className="button secondary" onClick={exportData}>
                    <ArrowDownToLine size={16} />
                    {storageError
                      ? tr("Exportar dados originais")
                      : tr("Exportar backup")}
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => importRef.current?.click()}
                  >
                    <Upload size={16} />{tr("Importar backup")}</button>
                  <input
                    className="sr-only"
                    type="file"
                    accept=".json,application/json"
                    ref={importRef}
                    aria-label={tr("Arquivo de backup")}
                    onChange={(e) => void importData(e.target.files?.[0])}
                  />
                </div>
                <small className="settings-note">
                  {mobileApp
                    ? tr("Desinstalar o aplicativo ou limpar seus dados remove os registros locais. ")
                    : tr("Limpar os dados do navegador remove seus registros. ")}{tr("O backup contém suas informações pessoais; guarde-o com cuidado.")}</small>
              </section>
              <section className="panel settings-panel">
                <div className="panel-heading">
                  <div className="section-icon sand">
                    <Sparkles size={19} />
                  </div>
                  <div>
                    <h2>{tr("Conheça as possibilidades")}</h2>
                    <p>{tr("Experimente antes de começar.")}</p>
                  </div>
                </div>
                <p>{tr("Explore uma rotina de exemplo com tarefas e movimentações fictícias.")}</p>
                <button className="button secondary" onClick={startDemo}>
                  <Sparkles size={16} />{tr("Carregar exemplo")}</button>
              </section>
              <section className="panel settings-panel reset-panel">
                <div className="panel-heading">
                  <div className="section-icon peach">
                    <Trash2 size={19} />
                  </div>
                  <div>
                    <h2>{tr("Começar de novo")}</h2>
                    <p>{tr("Um novo início para sua organização.")}</p>
                  </div>
                </div>
                <p>{tr("Apague tarefas, movimentações, cartões, metas, saldos iniciais e orçamentos deste dispositivo. Exporte um backup antes de continuar.")}</p>
                <button
                  className="button danger-outline"
                  onClick={() =>
                    setConfirm({
                      title: tr("Apagar todos os dados?"),
                      text: tr("Esta ação remove tarefas, movimentações, cartões, rotinas, metas, saldos iniciais, orçamentos e seu nome. Você só poderá recuperá-los se tiver exportado um backup."),
                      destructive: true,
                      action: () => {
                        if (save(freshData(), true)) {
                          setName("");
                          setMonth(monthKey());
                          setToast(
                            tr("Dados apagados. Tudo pronto para um novo início."),
                          );
                        }
                      },
                    })
                  }
                >
                  <Trash2 size={16} />{tr("Apagar meus dados")}</button>
              </section>
              {mobileApp && (
                <section className="panel settings-panel">
                  <div className="panel-heading"><div className="section-icon sage"><CircleHelp size={19} /></div><div><h2>{tr("Um passo de cada vez")}</h2><p>{tr("Uma orientação para começar e cuidar dos seus registros.")}</p></div></div>
                  <button className="button secondary" onClick={() => setHelpOpen(true)}><CircleHelp size={16} />{tr("Como usar o DailyAPP")}</button>
                </section>
              )}
              <section className="panel settings-panel reminders-panel">
                <div className="panel-heading"><div className="section-icon sage"><Bell size={19} /></div><div><h2>{tr("Lembretes no celular")}</h2><p>{tr("Tarefas, contas e faturas sem depender de internet.")}</p></div></div>
                <p>{reminders.state === "web" ? tr("Lembretes são enviados pelo aplicativo instalado no Android ou iPhone. Esta prévia salva as configurações, mas não envia notificações.") : reminders.state === "ready" ? tr("{0} {1} neste aparelho.", reminders.count, reminders.count === 1 ? tr("lembrete programado") : tr("lembretes programados")) : reminders.state === "error" ? tr("Não foi possível atualizar os lembretes. Tente novamente.") : tr("Permita notificações nas configurações do celular para receber seus lembretes.")}</p>
                {reminders.state !== "web" && <button className="button secondary" onClick={() => void activateReminders()}><Bell size={16} />{reminders.state === "ready" ? tr("Atualizar lembretes") : tr("Ativar lembretes")}</button>}
                <p className="form-hint">{tr("Escolha um lembrete ao criar uma tarefa, conta ou cartão. Contas e faturas avisam às 9h. Os próximos 60 avisos são atualizados ao abrir o app. O sistema pode ajustar o horário para economizar bateria.")}</p>
              </section>
              <div className="about-app">
                <span className="brand-mark small">
                  <CheckCheck size={20} />
                </span>
                <strong>{tr("DailyAPP")}</strong>
                <span>{mobileApp ? tr("Versão 1.2 · Uso pessoal") : tr("Versão 1.2 · Feito para uma vida mais leve.")}</span>
              </div>
            </div>
          )}
          <footer className="page-footer">
            <span>{tr("Menos correria. Mais equilíbrio.")}</span>
            <span>
              <Leaf size={13} />{tr("Um dia de cada vez.")}</span>
          </footer>
        </main>
      </div>
      {mobileApp && (
        <nav className="mobile-tabbar" aria-label={tr("Navegação do aplicativo")} inert={!!editor || !!confirm || welcomeOpen || helpOpen}>
          {[
            ...navItems.map((item) => ({ ...item, shortLabel: { overview: "Hoje", calendar: "Agenda", tasks: "Tarefas", finance: "Finanças" }[item.id] })),
            { id: "settings" as const, label: tr("Configurações"), shortLabel: "Ajustes", icon: Settings2 },
          ].map((item) => (
            <button key={item.id} aria-label={item.label} aria-current={view === item.id ? "page" : undefined} onClick={() => go(item.id)}>
              <item.icon size={21} strokeWidth={view === item.id ? 2.4 : 1.7} />
              <span>{tr(item.shortLabel)}</span>
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
          preset={editor.preset}
          accounts={data.accounts ?? []}
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
            if (ok) setToast(tr("Orçamento definido."));
            return ok;
          }}
          onClose={() => setEditor(null)}
        />
      )}
      {editor?.kind === "goal" && <Modal title={editor.item ? tr("Atualizar meta") : tr("Nova meta")} subtitle={tr("Um objetivo claro, no seu ritmo.")} onClose={() => setEditor(null)}><GoalForm item={editor.item} today={today} onSave={saveGoal} onClose={() => setEditor(null)} /></Modal>}
      {editor?.kind === "opening" && <Modal title={tr("Saldo inicial do mês")} subtitle={monthLabel(month)} onClose={() => setEditor(null)}><OpeningBalanceForm month={month} amount={data.openingBalances?.[month]} onSave={saveOpening} onClear={() => saveOpening()} onClose={() => setEditor(null)} /></Modal>}
      {editor?.kind === "card" && <Modal title={editor.item ? tr("Editar cartão") : tr("Novo cartão")} subtitle={tr("Cadastre somente o nome e os dias da fatura.")} onClose={() => setEditor(null)}><CardForm item={editor.item} accounts={data.accounts??[]} onSave={saveCard} onClose={() => setEditor(null)} /></Modal>}
      {editor?.kind === "purchase" && <Modal title={tr("Compra no cartão")} subtitle={tr("O valor total será dividido nas próximas faturas.")} onClose={() => setEditor(null)}><PurchaseForm cards={data.cards ?? []} selectedId={editor.cardId} onSave={savePurchase} onClose={() => setEditor(null)} /></Modal>}
      {editor?.kind === "account" && <Modal title={editor.item?tr("Editar conta"):tr("Nova conta")} onClose={()=>setEditor(null)}><AccountForm item={editor.item} onSave={saveWallet} onClose={()=>setEditor(null)}/></Modal>}
      {editor?.kind === "transfer" && <Modal title={tr("Transferência entre contas")} onClose={()=>setEditor(null)}><TransferForm item={editor.item} accounts={data.accounts??[]} onSave={saveTransfer} onClose={()=>setEditor(null)}/></Modal>}
      {editor?.kind === "category-budgets" && <Modal title={tr("Orçamento por categoria")} subtitle={monthLabel(month)} onClose={()=>setEditor(null)}><CategoryBudgetForm data={data} month={month} onClose={()=>setEditor(null)} onSave={limits=>save({...data,categoryBudgets:{...data.categoryBudgets,[month]:limits}})}/></Modal>}
      {editor?.kind === "protect-backup" && <Modal title={tr("Backup com senha")} onClose={()=>setEditor(null)}><BackupPasswordForm onClose={()=>setEditor(null)} onSubmit={async (password,signal)=>{const envelope=await encryptBackup(JSON.stringify({...dataRef.current,language},null,2),password);if(signal.aborted)return;await saveBackup(JSON.stringify(envelope),`dailyapp-protegido-${today}.json`);setEditor(null);setToast(tr("Backup protegido preparado. Guarde a senha separadamente."));}}/></Modal>}
      {editor?.kind === "unlock-backup" && <Modal title={tr("Desbloquear backup")} onClose={()=>setEditor(null)}><BackupPasswordForm unlock onClose={()=>setEditor(null)} onSubmit={async (password,signal)=>{const text=await decryptBackup(editor.envelope,password);if(signal.aborted)return;const imported=validateData(JSON.parse(text));setEditor(null);previewRestore(imported);}}/></Modal>}
      {confirm && (
        <Modal title={confirm.title} onClose={() => setConfirm(null)} small>
          <p className="confirm-text">{confirm.text}</p>
          <div className="modal-footer">
            <button
              className="button secondary"
              onClick={() => setConfirm(null)}
            >{tr("Cancelar")}</button>
            <button
              className={`button ${confirm.destructive ? "danger" : "primary"}`}
              onClick={() => {
                confirm.action();
                setConfirm(null);
              }}
            >{tr("Confirmar")}</button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          <span>{toast}</span>
          <button
            className="icon-button"
            aria-label={tr("Fechar notificação")}
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

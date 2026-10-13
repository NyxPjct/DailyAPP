import { freshData, STORAGE_KEY, validateData } from "../domain";
import type { AppData } from "../domain";

export interface RemoteWorkspace {
  document: AppData;
  revision: number;
}
export interface WorkspaceGateway {
  load(): Promise<RemoteWorkspace | null>;
  save(
    document: AppData,
    expectedRevision: number,
  ): Promise<RemoteWorkspace | null>;
}
export type SyncStatus =
  "loading" | "synced" | "pending" | "offline" | "conflict" | "error";
export interface WorkspaceSnapshot {
  data: AppData;
  status: SyncStatus;
  message: string;
  pending: boolean;
  canEdit: boolean;
}
interface Cache {
  document: AppData;
  revision: number;
  pending: boolean;
}

export const cloudKey = (userId: string) => "dailyapp.cloud.v1:" + userId;
export const browserStorage: Storage = {
  get length() {
    return window.localStorage.length;
  },
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
  removeItem: (key) => window.localStorage.removeItem(key),
  clear: () => window.localStorage.clear(),
  key: (index) => window.localStorage.key(index),
};
export const hasLocalData = (data: AppData) =>
  data.tasks.length > 0 ||
  data.transactions.length > 0 ||
  Object.keys(data.budgets).length > 0 ||
  !!data.name;

export function personalLocalData(data: AppData): AppData {
  if (!data.demo) return data;
  const budgets = { ...data.budgets };
  if (data.demoBudgetMonth) delete budgets[data.demoBudgetMonth];
  return {
    ...data,
    demo: false,
    demoBudgetMonth: null,
    budgets,
    tasks: data.tasks.filter((t) => !t.id.startsWith("demo-")),
    transactions: data.transactions.filter((t) => !t.id.startsWith("demo-")),
  };
}

// Import is explicit and idempotent. Existing cloud records win on duplicate IDs.
export function mergeLocalData(cloud: AppData, local: AppData): AppData {
  const source = personalLocalData(local);
  const ids = new Set(
    [...cloud.tasks, ...cloud.transactions].map((item) => item.id),
  );
  return validateData({
    ...cloud,
    name: cloud.name || source.name,
    tasks: [
      ...cloud.tasks,
      ...source.tasks.filter((item) => !ids.has(item.id)),
    ],
    transactions: [
      ...cloud.transactions,
      ...source.transactions.filter((item) => !ids.has(item.id)),
    ],
    budgets: { ...source.budgets, ...cloud.budgets },
  });
}

export function readLocalData(storage: Storage): AppData | null {
  try {
    const value = storage.getItem(STORAGE_KEY);
    return value ? personalLocalData(validateData(JSON.parse(value))) : null;
  } catch {
    return null;
  }
}

export class WorkspaceStore {
  private cache: Cache = { document: freshData(), revision: 0, pending: false };
  private cachePresent = false;
  private corrupt = false;
  private active = false;
  private epoch = 0;
  private flight: Promise<void> | null = null;
  private listeners = new Set<() => void>();
  private snapshot: WorkspaceSnapshot;
  readonly key: string;

  constructor(
    userId: string,
    private gateway: WorkspaceGateway,
    private storage: Storage,
    initialName = "",
  ) {
    this.key = cloudKey(userId);
    this.cache.document.name = initialName.slice(0, 60);
    try {
      const raw = storage.getItem(this.key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          !Number.isSafeInteger(parsed.revision) ||
          parsed.revision < 0 ||
          typeof parsed.pending !== "boolean"
        )
          throw new Error();
        this.cache = {
          document: validateData(parsed.document),
          revision: parsed.revision,
          pending: parsed.pending,
        };
        this.cachePresent = true;
      }
    } catch {
      this.corrupt = true;
    }
    this.snapshot = {
      data: this.cache.document,
      status: this.corrupt ? "error" : "loading",
      message: this.corrupt
        ? "A cópia local da sua conta não pôde ser lida. Exporte-a antes de recuperá-la."
        : "Carregando seus dados…",
      pending: this.cache.pending,
      canEdit: false,
    };
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.snapshot;
  private publish(status: SyncStatus, message: string, canEdit = true) {
    this.snapshot = {
      data: this.cache.document,
      status,
      message,
      pending: this.cache.pending,
      canEdit,
    };
    this.listeners.forEach((listener) => listener());
  }
  private persist(cache: Cache) {
    this.storage.setItem(this.key, JSON.stringify(cache));
    this.cache = cache;
    this.cachePresent = true;
  }
  async start() {
    this.active = true;
    const epoch = ++this.epoch;
    if (this.flight) await this.flight;
    if (this.active && epoch === this.epoch) return this.refresh();
  }
  stop() {
    this.active = false;
    this.epoch++;
  }

  save(document: AppData, recovery = false): boolean {
    if (!this.active || (!this.snapshot.canEdit && !recovery)) return false;
    try {
      const valid = validateData(document);
      if (new TextEncoder().encode(JSON.stringify(valid)).length > 5_000_000) {
        this.publish(
          this.snapshot.status,
          "Os registros ultrapassam o limite da conta. Exporte um backup antes de remover registros antigos.",
          this.snapshot.canEdit,
        );
        return false;
      }
      this.persist({ ...this.cache, document: valid, pending: true });
      this.corrupt = false;
      this.publish(
        "pending",
        "Alterações salvas neste dispositivo. Sincronizando…",
      );
      void this.flush();
      return true;
    } catch {
      this.publish(
        this.snapshot.status,
        "Não foi possível guardar suas alterações neste dispositivo. Exporte um backup e verifique o armazenamento.",
        this.snapshot.canEdit,
      );
      return false;
    }
  }

  async refresh(): Promise<void> {
    if (
      !this.active ||
      this.corrupt ||
      this.flight ||
      this.snapshot.status === "conflict"
    )
      return;
    if (this.cache.pending) return this.flush();
    const epoch = this.epoch;
    const document = this.cache.document;
    const operation = (async () => {
      try {
        const remote = await this.gateway.load();
        if (!this.active || epoch !== this.epoch) return;
        // An edit made during the read must survive; its CAS write handles conflict.
        if (this.cache.pending || this.cache.document !== document) return;
        const next = {
          document: remote
            ? validateData(remote.document)
            : this.cache.document,
          revision: remote?.revision ?? 0,
          pending: false,
        };
        this.persist(next);
        this.publish("synced", "Tudo sincronizado com sua conta.");
      } catch {
        if (!this.active || epoch !== this.epoch) return;
        this.publish(
          this.cachePresent ? "offline" : "error",
          this.cachePresent
            ? "Sem conexão com a conta. Novas alterações ficarão neste dispositivo até sincronizar."
            : "Não foi possível carregar sua conta. Tente novamente quando a conexão estiver disponível.",
          this.cachePresent,
        );
      }
    })();
    this.flight = operation;
    await operation;
    if (this.flight === operation) this.flight = null;
    if (
      this.active &&
      this.cache.pending &&
      this.getSnapshot().status !== "conflict"
    )
      await this.flush();
  }

  async flush(): Promise<void> {
    if (
      !this.active ||
      this.flight ||
      !this.cache.pending ||
      this.corrupt ||
      this.snapshot.status === "conflict"
    )
      return;
    const epoch = this.epoch;
    const operation = (async () => {
      while (this.active && epoch === this.epoch && this.cache.pending) {
        const sending = this.cache;
        try {
          const remote = await this.gateway.save(
            sending.document,
            sending.revision,
          );
          if (!this.active || epoch !== this.epoch) return;
          if (!remote) {
            this.publish(
              "conflict",
              "Outro dispositivo atualizou sua conta. Suas alterações locais foram preservadas. Exporte-as antes de carregar os dados da nuvem.",
              false,
            );
            return;
          }
          validateData(remote.document);
          const edited = this.cache.document !== sending.document;
          this.persist({
            document: edited ? this.cache.document : remote.document,
            revision: remote.revision,
            pending: edited,
          });
          this.publish(
            edited ? "pending" : "synced",
            edited
              ? "Sincronizando as próximas alterações…"
              : "Tudo sincronizado com sua conta.",
          );
        } catch {
          if (!this.active || epoch !== this.epoch) return;
          this.publish(
            "offline",
            "A sincronização não foi concluída. Suas alterações estão guardadas neste dispositivo.",
          );
          return;
        }
      }
    })();
    this.flight = operation;
    await operation;
    if (this.flight === operation) this.flight = null;
  }

  // Only called after explicit confirmation; ordinary refresh never discards an outbox.
  async useRemote(): Promise<boolean> {
    if (this.flight) return false;
    const epoch = this.epoch;
    try {
      const remote = await this.gateway.load();
      if (!this.active || epoch !== this.epoch) return false;
      this.persist({
        document: remote ? validateData(remote.document) : freshData(),
        revision: remote?.revision ?? 0,
        pending: false,
      });
      this.corrupt = false;
      this.publish("synced", "Dados da nuvem carregados.");
      return true;
    } catch {
      this.publish(
        "error",
        "Não foi possível recuperar os dados da nuvem. Sua cópia local foi preservada.",
        false,
      );
      return false;
    }
  }
  originalCache() {
    return this.storage.getItem(this.key);
  }
  recoveryBackup() {
    const raw = this.originalCache();
    if (!raw) return null;
    try {
      return JSON.stringify(validateData(JSON.parse(raw).document), null, 2);
    } catch {
      return raw;
    }
  }
}

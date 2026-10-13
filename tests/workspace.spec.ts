import { test, expect } from "@playwright/test";
import { freshData, createDemo } from "../src/domain";
import type { AppData } from "../src/domain";
import {
  WorkspaceStore,
  cloudKey,
  mergeLocalData,
} from "../src/cloud/workspace";
import type { WorkspaceGateway, RemoteWorkspace } from "../src/cloud/workspace";

class MemoryStorage implements Storage {
  values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  clear() {
    this.values.clear();
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
}
const named = (name: string): AppData => ({ ...freshData(), name });

test("sincroniza edições feitas durante uma escrita sem perder a segunda", async () => {
  let resolve!: (remote: RemoteWorkspace) => void;
  const writes: number[] = [];
  const gateway: WorkspaceGateway = {
    load: async () => null,
    save: async (document, revision) => {
      writes.push(revision);
      if (writes.length === 1)
        return new Promise<RemoteWorkspace>((done) => {
          resolve = done;
        });
      return { document, revision: revision + 1 };
    },
  };
  const store = new WorkspaceStore("ana", gateway, new MemoryStorage());
  await store.start();
  expect(store.save(named("primeira"))).toBe(true);
  expect(store.save(named("segunda"))).toBe(true);
  resolve({ document: named("primeira"), revision: 1 });
  await expect.poll(() => store.getSnapshot().status).toBe("synced");
  expect(store.getSnapshot().data.name).toBe("segunda");
  expect(writes).toEqual([0, 1]);
});

test("fila offline sobrevive à reinicialização e sincroniza depois", async () => {
  const storage = new MemoryStorage();
  const offline: WorkspaceGateway = {
    load: async () => null,
    save: async () => {
      throw new Error("offline");
    },
  };
  const store = new WorkspaceStore("ana", offline, storage);
  await store.start();
  store.save(named("alteração offline"));
  await expect.poll(() => store.getSnapshot().status).toBe("offline");
  expect(JSON.parse(storage.getItem(cloudKey("ana"))!).pending).toBe(true);
  store.stop();
  const online: WorkspaceGateway = {
    load: async () => null,
    save: async (document) => ({ document, revision: 1 }),
  };
  const restored = new WorkspaceStore("ana", online, storage);
  await restored.start();
  expect(restored.getSnapshot()).toMatchObject({
    status: "synced",
    pending: false,
    data: { name: "alteração offline" },
  });
});

test("conflito preserva a cópia local até recuperação explícita", async () => {
  let remote = { document: named("servidor"), revision: 1 };
  const gateway: WorkspaceGateway = {
    load: async () => remote,
    save: async () => null,
  };
  const storage = new MemoryStorage();
  const store = new WorkspaceStore("ana", gateway, storage);
  await store.start();
  store.save(named("edição local"));
  await expect.poll(() => store.getSnapshot().status).toBe("conflict");
  expect(store.getSnapshot()).toMatchObject({
    pending: true,
    canEdit: false,
    data: { name: "edição local" },
  });
  expect(store.save(named("não sobrescrever"))).toBe(false);
  expect(JSON.parse(store.originalCache()!).document.name).toBe("edição local");
  remote = { document: named("outro dispositivo"), revision: 2 };
  await store.refresh();
  expect(store.getSnapshot().data.name).toBe("edição local");
  expect(await store.useRemote()).toBe(true);
  expect(store.getSnapshot()).toMatchObject({
    status: "synced",
    data: { name: "outro dispositivo" },
    pending: false,
  });
});

test("cópia corrompida não é sobrescrita automaticamente", async () => {
  const storage = new MemoryStorage();
  storage.setItem(cloudKey("ana"), "{broken");
  const store = new WorkspaceStore(
    "ana",
    {
      load: async () => ({ document: named("nuvem"), revision: 1 }),
      save: async () => null,
    },
    storage,
  );
  await store.start();
  expect(store.getSnapshot()).toMatchObject({
    status: "error",
    canEdit: false,
  });
  expect(storage.getItem(cloudKey("ana"))).toBe("{broken");
  expect(await store.useRemote()).toBe(true);
  expect(store.getSnapshot().data.name).toBe("nuvem");
});

test("dupla montagem do React e troca de usuário não reaproveitam estado errado", async () => {
  let finish!: (remote: RemoteWorkspace | null) => void;
  let reads = 0;
  const storage = new MemoryStorage();
  const store = new WorkspaceStore(
    "ana",
    {
      load: async () =>
        ++reads === 1
          ? new Promise((done) => {
              finish = done;
            })
          : { document: named("Ana"), revision: 1 },
      save: async () => null,
    },
    storage,
  );
  const first = store.start();
  store.stop();
  const second = store.start();
  finish(null);
  await Promise.all([first, second]);
  expect(store.getSnapshot()).toMatchObject({
    status: "synced",
    data: { name: "Ana" },
  });
  const other = new WorkspaceStore(
    "bruno",
    { load: async () => null, save: async () => null },
    storage,
  );
  await other.start();
  expect(other.getSnapshot().data.name).toBe("");
});

test("importação exclui demonstração, preserva registros e não duplica IDs", () => {
  const demo = createDemo();
  const own = { ...demo.tasks[0], id: "own-task", title: "Minha tarefa" };
  const local = { ...demo, tasks: [...demo.tasks, own] };
  const merged = mergeLocalData(freshData(), local);
  expect(merged.tasks).toEqual([own]);
  expect(merged.transactions).toEqual([]);
  expect(merged.budgets).toEqual({});
  expect(mergeLocalData(merged, local)).toEqual(merged);
});

test("erro de armazenamento não aplica uma alteração sem persistência", async () => {
  const storage = new MemoryStorage();
  const store = new WorkspaceStore(
    "ana",
    { load: async () => null, save: async () => null },
    storage,
  );
  await store.start();
  storage.setItem = () => {
    throw new Error("quota");
  };
  expect(store.save(named("sem espaço"))).toBe(false);
  expect(store.getSnapshot().data.name).toBe("");
  expect(store.getSnapshot().pending).toBe(false);
});

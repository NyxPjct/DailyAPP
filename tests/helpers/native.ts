import type { Page } from "@playwright/test";

export async function nativeBridge(page: Page, platform: "android" | "ios") {
  await page.addInitScript((platform) => {
    const win = window as unknown as Record<string, any>;
    const state = {
      calls: [] as { plugin: string; method: string; options: any }[],
      callbacks: new Map<string, () => void>(),
      sequence: 0,
      failWrite: false,
      notificationPermission: "prompt",
      pendingNotifications: [{ id: 42, title: "Outro aviso", extra: { dailyapp: false } }] as any[],
      notificationCallbacks: new Map<string, (value: any) => void>(),
      resumeCallbacks: new Map<string, (value: any) => void>(),
      failSchedule: false,
    };
    win.dailyappNativeTest = state;
    if (platform === "android") win.androidBridge = {};
    else win.webkit = { messageHandlers: { bridge: {} } };
    win.Capacitor = {
      PluginHeaders: [
        { name: "App", methods: [
          { name: "addListener", rtype: "callback" },
          { name: "removeListener", rtype: "promise" },
          { name: "minimizeApp", rtype: "promise" },
        ] },
        { name: "Filesystem", methods: [{ name: "writeFile", rtype: "promise" }] },
        { name: "Share", methods: [{ name: "canShare", rtype: "promise" }, { name: "share", rtype: "promise" }] },
        { name: "StatusBar", methods: [{ name: "setStyle", rtype: "promise" }] },
        { name: "LocalNotifications", methods: ["checkPermissions", "requestPermissions", "getPending", "cancel", "schedule", "createChannel", "removeListener"].map(name => ({ name, rtype: "promise" })).concat([{ name: "addListener", rtype: "callback" }]) },
      ],
      nativeCallback: async (plugin: string, method: string, options: any, callback: () => void) => {
        const id = String(++state.sequence);
        if (plugin === "App" && method === "addListener" && options.eventName === "backButton") state.callbacks.set(id, callback);
        if (plugin === "App" && method === "addListener" && options.eventName === "appStateChange") state.resumeCallbacks.set(id, callback);
        if (plugin === "LocalNotifications" && method === "addListener") state.notificationCallbacks.set(id, callback);
        return id;
      },
      nativePromise: async (plugin: string, method: string, options: any) => {
        state.calls.push({ plugin, method, options });
        if (method === "removeListener") { state.callbacks.delete(options.callbackId); state.resumeCallbacks.delete(options.callbackId); state.notificationCallbacks.delete(options.callbackId); }
        if (plugin === "LocalNotifications") {
          if (method === "checkPermissions") return { display: state.notificationPermission };
          if (method === "requestPermissions") { state.notificationPermission = "granted"; return { display: "granted" }; }
          if (method === "getPending") return { notifications: state.pendingNotifications };
          if (method === "cancel") { const ids = new Set(options.notifications.map((n: any) => n.id)); state.pendingNotifications = state.pendingNotifications.filter(n => !ids.has(n.id)); }
          if (method === "schedule") {
            if (state.failSchedule) throw new Error("Falha do sistema de notificações");
            const ids = new Set(options.notifications.map((n: any) => n.id));
            state.pendingNotifications = [...state.pendingNotifications.filter(n => !ids.has(n.id)), ...options.notifications];
            return { notifications: options.notifications.map((n: any) => ({ id: n.id })) };
          }
        }
        if (method === "canShare") return { value: true };
        if (method === "writeFile") {
          if (state.failWrite) throw new Error("Dispositivo sem espaço");
          return { uri: "file:///cache/" + options.path };
        }
        return {};
      },
    };
    window.addEventListener("dailyapp-test-back", () => {
      for (const callback of state.callbacks.values()) callback();
    });
  }, platform);
}

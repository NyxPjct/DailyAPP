import { t as tr } from "../i18n/core";
import { Capacitor } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";
import { App as NativeApp } from "@capacitor/app";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { StatusBar, Style } from "@capacitor/status-bar";

export function initializeMobile() {
  if (!Capacitor.isNativePlatform()) return;
  void StatusBar.setStyle({ style: Style.Light }).catch(() => {
    // A status-bar style is cosmetic; it must not prevent access to saved data.
  });
}

export function attachAndroidBackButton(onBack: () => void) {
  if (Capacitor.getPlatform() !== "android") return () => {};
  let stopped = false;
  let listener: PluginListenerHandle | undefined;
  void NativeApp.addListener("backButton", onBack)
    .then((handle) => {
      if (stopped) void handle.remove();
      else listener = handle;
    })
    .catch(() => {
      // Native navigation must not prevent the local workspace from opening.
    });
  return () => {
    stopped = true;
    void listener?.remove();
  };
}

export function minimizeMobile() {
  if (Capacitor.getPlatform() === "android")
    void NativeApp.minimizeApp().catch(() => {});
}

export function attachMobileResume(onResume: () => void) {
  if (!Capacitor.isNativePlatform()) return () => {};
  let stopped = false;
  let listener: PluginListenerHandle | undefined;
  void NativeApp.addListener("appStateChange", state => { if (state.isActive) onResume(); })
    .then(handle => { if (stopped) void handle.remove(); else listener = handle; }).catch(() => {});
  return () => { stopped = true; void listener?.remove(); };
}

export async function saveBackup(content: string, filename: string) {
  if (Capacitor.isNativePlatform()) {
    const { value } = await Share.canShare();
    if (!value) throw new Error(tr("Não foi possível abrir o compartilhamento."));
    const file = await Filesystem.writeFile({
      path: `backups/${filename}`,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    await Share.share({
      title: tr("Backup do DailyAPP"),
      dialogTitle: tr("Salvar ou compartilhar backup"),
      files: [file.uri],
    });
    return;
  }
  const url = URL.createObjectURL(
    new Blob([content], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

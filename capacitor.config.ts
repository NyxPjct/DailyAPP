import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.nyxpjct.dailyapp",
  appName: "DailyAPP",
  webDir: "dist/mobile",
  backgroundColor: "#f7f8f5",
  loggingBehavior: "none",
  android: { webContentsDebuggingEnabled: false },
  ios: { contentInset: "never", preferredContentMode: "mobile" },
  plugins: {
    StatusBar: { style: "LIGHT", backgroundColor: "#f7f8f5" },
    SystemBars: { style: "LIGHT", insetsHandling: "css" },
    Keyboard: { resize: "native" },
    LocalNotifications: { smallIcon: "ic_stat_dailyapp", iconColor: "#23664b", presentationOptions: ["banner", "sound", "list"] },
  },
};

export default config;

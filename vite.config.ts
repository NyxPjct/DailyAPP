import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const mobile = mode === "mobile" || mode === "mobile-standalone";
  const localOnly = mobile || env.VITE_LOCAL_ONLY === "true";
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!localOnly && key && !key.startsWith("sb_publishable_")) {
    let publicKey = false;
    try {
      publicKey =
        JSON.parse(Buffer.from(key.split(".")[1] ?? "", "base64url").toString())
          .role === "anon";
    } catch {
      /* Reject invalid or private credentials without printing them. */
    }
    if (!publicKey)
      throw new Error(
        "Use somente a chave pública/publishable do Supabase. Chaves secretas e service_role não podem entrar no frontend.",
      );
  }
  if (!localOnly && !!env.VITE_SUPABASE_URL !== !!key)
    throw new Error(
      "Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY juntos.",
    );
  if (!localOnly && env.VITE_SUPABASE_URL) {
    const url = new URL(env.VITE_SUPABASE_URL);
    if (
      url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["127.0.0.1", "localhost"].includes(url.hostname)
      )
    )
      throw new Error(
        "A conexão Supabase exige HTTPS; HTTP é permitido apenas no desenvolvimento local.",
      );
  }
  return {
    plugins: [
      react(),
      ...(mobile
        ? [{
            name: "dailyapp-mobile-entry",
            transformIndexHtml: {
              order: "pre" as const,
              handler: (html: string) =>
                html.replace("/src/main.tsx", "/src/mobile-main.tsx"),
            },
          }]
        : []),
    ],
    cacheDir: process.env.DAILYAPP_VITE_CACHE_DIR || "node_modules/.vite",
    build: {
      ...(mobile ? { target: ["chrome92", "safari15.4"] } : {}),
      ...(mode === "standalone" || mode === "mobile-standalone"
        ? { rolldownOptions: { output: { codeSplitting: false } } }
        : {}),
    },
    define: {
      "import.meta.env.VITE_MOBILE_APP": JSON.stringify(mobile),
      ...(localOnly
        ? {
            "import.meta.env.VITE_LOCAL_ONLY": JSON.stringify("true"),
            "import.meta.env.VITE_SUPABASE_URL": "undefined",
            "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": "undefined",
          }
        : {}),
    },
  };
});

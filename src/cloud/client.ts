import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
export const localPreview = import.meta.env.VITE_LOCAL_ONLY === "true";

function configured() {
  if (localPreview || !url || !key) return false;
  try {
    const parsed = new URL(url);
    const local = ["localhost", "127.0.0.1"].includes(parsed.hostname);
    // A service-role/secret key must never be sent to the browser.
    if (key.startsWith("sb_secret_")) return false;
    if (!key.startsWith("sb_publishable_")) {
      const encoded = (key.split(".")[1] ?? "")
        .replace(/-/g, "+")
        .replace(/_/g, "/");
      const payload = JSON.parse(atob(encoded));
      if (payload.role !== "anon") return false;
    }
    return (
      parsed.protocol === "https:" || (local && parsed.protocol === "http:")
    );
  } catch {
    return false;
  }
}

export const supabase = configured()
  ? createClient(url!, key!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const authRedirect = () =>
  new URL(window.location.pathname, window.location.origin).href;

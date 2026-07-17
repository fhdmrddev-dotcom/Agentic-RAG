import { createClient, type SupabaseClient } from "@supabase/supabase-js"

// Phase 158 (DEPLOY-02 / D-07, Pitfall 4) — defensive client init + runtime-config overlay.
//
// This module used to build the client eagerly from the baked VITE_* at import:
//   export const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
// Two problems on a fresh self-host box:
//   1. The onebox preset ships a PLACEHOLDER VITE_SUPABASE_URL
//      (`https://<project-ref>.supabase.co`); supabase-js runs `new URL()` on it at
//      construction, which THROWS at import and white-screens the WHOLE SPA — including the
//      /setup wizard that is supposed to fix it (RESEARCH Pitfall 4). App.tsx → useAuth calls
//      `supabase.auth.getSession()` at mount, so the client MUST construct without throwing.
//   2. VITE_* are baked at BUILD, so a wizard-entered Supabase URL cannot reach the browser
//      without a frontend rebuild.
// Two hardenings, both least-invasive (RESEARCH Pattern 8):
//   - Never pass a placeholder to createClient — swap it for a harmless local default so
//     construction can never throw (the /setup page never talks to Supabase, so a dummy
//     client is fine there; a configured box's real creds are unaffected).
//   - a runtime overlay fetches the REAL creds from GET /public-config at app bootstrap, so
//     login works WITHOUT a rebuild (the SC#3 honesty hinge, D-07). Baked VITE_* stay the
//     fallback.

const BAKED_URL = import.meta.env.VITE_SUPABASE_URL as string
const BAKED_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

/** A value is a placeholder when it is empty or an onebox `<...>` sentinel. */
const isPlaceholder = (v: string | undefined): boolean =>
  !v || (v.includes("<") && v.includes(">"))

// Guard (Pitfall 4): a placeholder URL must NEVER reach createClient's `new URL()`.
const safeUrl = isPlaceholder(BAKED_URL) ? "http://localhost:54321" : BAKED_URL

// `let`, not `const` — the runtime overlay below reassigns this once the runtime creds are
// fetched. Consumers `import { supabase }` get a LIVE binding, so a call made after bootstrap
// (e.g. useAuth's getSession) uses the overlaid client.
export let supabase: SupabaseClient = createClient(
  safeUrl,
  BAKED_KEY || "placeholder-anon-key",
)

/**
 * Overlay runtime Supabase creds from `GET {apiBase}/public-config` (D-07). Call ONCE at App
 * bootstrap, before auth matters. Reassigns `supabase` to a client built from the runtime
 * creds when they are present AND (the baked creds are placeholders OR the runtime URL differs
 * from the baked one) — so a real, matching baked URL is never needlessly reconstructed. Any
 * fetch/parse failure keeps the baked client; the /setup page renders regardless (it never
 * calls Supabase).
 *
 * `apiBase` is the caller's `API_BASE` (`/api` in prod through nginx, `http://localhost:8000`
 * in local dev) — the URL is built as `${apiBase}/public-config`, matching every other
 * backend route (never a hardcoded `/api` prefix, which would double up under nginx).
 */
export async function hydrateSupabaseFromRuntime(apiBase: string): Promise<void> {
  try {
    const r = await fetch(`${apiBase}/public-config`)
    if (!r.ok) return
    const cfg = (await r.json()) as {
      supabase_url?: string
      supabase_anon_key?: string
    }
    if (
      cfg?.supabase_url &&
      cfg?.supabase_anon_key &&
      (isPlaceholder(BAKED_URL) || cfg.supabase_url !== BAKED_URL)
    ) {
      supabase = createClient(cfg.supabase_url, cfg.supabase_anon_key)
    }
  } catch {
    /* keep the baked client — /setup renders regardless (it never calls Supabase) */
  }
}

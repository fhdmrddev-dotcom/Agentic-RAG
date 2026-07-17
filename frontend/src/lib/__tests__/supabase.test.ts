/**
 * Phase 158 (DEPLOY-02, Wave 0) — runtime public-config shim contract (SC#3 / D-07).
 *
 * Wave-0 `it.todo` scaffold (Nyquist target). Wave 3 replaces each todo with a live test once
 * `lib/supabase.ts` is hardened. Two things it must satisfy (RESEARCH Pattern 8 + Pitfall 4):
 *   1. `VITE_*` are baked at BUILD, so a wizard-entered Supabase URL cannot reach the browser
 *      client without a rebuild — a startup fetch of GET /public-config overlays the baked
 *      creds so login works without hand-editing `.env` + rebuilding (the SC#3 honesty hinge).
 *   2. a placeholder `VITE_SUPABASE_URL` (`https://<project-ref>...`) must NOT throw at import
 *      (supabase-js `new URL()` white-screens the whole SPA, including /setup) — the client
 *      constructs defensively.
 *
 * Deliberately imports NOTHING from ../supabase — the runtime-config shim helper does not exist
 * yet; `it.todo` takes only a string, so this file collects GREEN (pending) until Wave 3. (The
 * exact export name is intentionally NOT referenced here so the scaffold imports zero
 * not-yet-built symbols and collection stays clean.)
 */
import { describe, it } from "vitest"

describe("supabase client — defensive import (SC#3 / D-07, Pitfall 4)", () => {
  it.todo("createClient never throws at import when VITE_SUPABASE_URL is a `<placeholder>` (no white-screen)")
  it.todo("a placeholder baked URL falls back to a harmless local default so /setup still renders")
})

describe("supabase client — runtime public-config overlay (SC#3 / D-07)", () => {
  it.todo("the runtime-config shim overlays runtime creds from GET /public-config, keeping baked VITE_* as fallback")
  it.todo("a real baked URL is NOT overridden by an identical runtime URL (no needless reconstruct)")
  it.todo("a fetch failure keeps the baked client — /setup renders regardless (it never calls Supabase)")
})

// Wave 3 replaces each it.todo with a live test importing the hardened client + runtime shim.

/**
 * Phase 158 (DEPLOY-02, Wave 4) — runtime public-config shim contract (SC#3 / D-07).
 *
 * Wave-0 shipped this file as `it.todo` scaffold (Nyquist target); Wave 4 realizes each todo
 * against the hardened `lib/supabase.ts`. Two things it must satisfy (RESEARCH Pattern 8 +
 * Pitfall 4):
 *   1. a placeholder `VITE_SUPABASE_URL` (`https://<project-ref>...`) must NOT throw at import
 *      — supabase-js runs `new URL()` at construction, which white-screens the whole SPA
 *      (including /setup) on a fresh box. The defensive init swaps a placeholder for a harmless
 *      local default so the throwing URL NEVER reaches `createClient`.
 *   2. `VITE_*` are baked at BUILD, so a wizard-entered Supabase URL cannot reach the browser
 *      client without a rebuild — `hydrateSupabaseFromRuntime()` fetches GET /public-config at
 *      bootstrap and overlays the runtime creds, keeping baked `VITE_*` as fallback (the SC#3
 *      honesty hinge).
 *
 * Technique: `lib/supabase.ts` reads `import.meta.env.VITE_SUPABASE_*` at MODULE LOAD, and
 * `.env.local` supplies REAL local values, so exercising the placeholder path requires
 * `vi.stubEnv` + `vi.resetModules()` + a dynamic `import()` per case. `@supabase/supabase-js`
 * `createClient` is mocked to a call-capturing stub so we assert WHICH creds the client was
 * built from without a network / supabase-js internals.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Capture every createClient(url, key) call → assert the creds the module built from.
const { mockCreateClient } = vi.hoisted(() => ({
  mockCreateClient: vi.fn((url: string, key: string) => ({
    __url: url,
    __key: key,
    auth: { getSession: vi.fn(), onAuthStateChange: vi.fn() },
  })),
}))
vi.mock("@supabase/supabase-js", () => ({ createClient: mockCreateClient }))

const PLACEHOLDER_URL = "https://<project-ref>.supabase.co"
const LOCAL_DEFAULT = "http://localhost:54321"
const REAL_URL = "https://real-project.supabase.co"
const REAL_KEY = "real-anon-key"

beforeEach(() => {
  vi.resetModules()
  mockCreateClient.mockClear()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

/** Stub the baked `VITE_*` then re-import the module so it re-reads env at load. */
async function importFresh(url: string, key: string) {
  vi.stubEnv("VITE_SUPABASE_URL", url)
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", key)
  return import("@/lib/supabase")
}

describe("supabase client — defensive import (SC#3 / D-07, Pitfall 4)", () => {
  it("createClient never throws at import when VITE_SUPABASE_URL is a `<placeholder>` (no white-screen)", async () => {
    const mod = await importFresh(PLACEHOLDER_URL, "")
    // The import resolved (no throw) and a usable client exists — /setup can mount.
    expect(mod.supabase).toBeDefined()
    expect(mod.supabase.auth).toBeDefined()
  })

  it("a placeholder baked URL falls back to a harmless local default so /setup still renders", async () => {
    await importFresh(PLACEHOLDER_URL, "")
    // The throwing placeholder URL NEVER reached createClient — it was swapped for the
    // harmless local default (the anti-white-screen guard).
    expect(mockCreateClient).toHaveBeenCalledTimes(1)
    const [urlArg, keyArg] = mockCreateClient.mock.calls[0]
    expect(urlArg).toBe(LOCAL_DEFAULT)
    expect(urlArg).not.toContain("<")
    // A blank baked key is likewise swapped for a non-empty placeholder so createClient
    // never sees an empty string.
    expect(keyArg).toBeTruthy()
  })
})

describe("supabase client — runtime public-config overlay (SC#3 / D-07)", () => {
  it("the runtime-config shim overlays runtime creds from GET /public-config, keeping baked VITE_* as fallback", async () => {
    const mod = await importFresh(PLACEHOLDER_URL, "")
    mockCreateClient.mockClear() // ignore the load-time construction; assert the overlay only
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ supabase_url: REAL_URL, supabase_anon_key: REAL_KEY }),
      }),
    )
    await mod.hydrateSupabaseFromRuntime("http://api.test")
    // Fetched /public-config off the passed apiBase (NOT a hardcoded /api prefix).
    expect(fetch).toHaveBeenCalledWith("http://api.test/public-config")
    // Reassigned the client to the runtime creds.
    expect(mockCreateClient).toHaveBeenCalledTimes(1)
    expect(mockCreateClient).toHaveBeenCalledWith(REAL_URL, REAL_KEY)
    expect((mod.supabase as unknown as { __url: string }).__url).toBe(REAL_URL)
  })

  it("a real baked URL is NOT overridden by an identical runtime URL (no needless reconstruct)", async () => {
    const mod = await importFresh(REAL_URL, REAL_KEY)
    mockCreateClient.mockClear()
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ supabase_url: REAL_URL, supabase_anon_key: REAL_KEY }),
      }),
    )
    await mod.hydrateSupabaseFromRuntime("http://api.test")
    // Runtime URL === baked URL and baked is real → no reconstruct.
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it("a fetch failure keeps the baked client — /setup renders regardless (it never calls Supabase)", async () => {
    const mod = await importFresh(REAL_URL, REAL_KEY)
    const baked = mod.supabase
    mockCreateClient.mockClear()
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")))
    await expect(mod.hydrateSupabaseFromRuntime("http://api.test")).resolves.toBeUndefined()
    expect(mockCreateClient).not.toHaveBeenCalled()
    expect(mod.supabase).toBe(baked) // unchanged — the baked client survives
  })
})

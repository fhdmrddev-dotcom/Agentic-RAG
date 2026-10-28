/**
 * Phase 299-05 (LINK-06 / D-24 / D-26 / SEED-312 / T-299-11, T-299-13, T-299-16) — useAuth's half
 * of "a link survives sign-in".
 *
 * - SSO and sign-up leave the page, so they pass `redirectTo` / `emailRedirectTo` built ONLY from
 *   `window.location.origin` + `returnTarget(...)` (or `/app`), and remember the rebuilt path.
 * - Password sign-in keeps the address in place, so it passes no redirect and clears the copy.
 * - A rejected `getSession` ends the wait (`loading=false`) and leaves `user` null; a
 *   NEVER-resolving one leaves `loading` true and no timer ever clears a signed-in user. The
 *   visible bound is BootScreen's 20 s clock, not a timer here (Pitfall 6).
 *
 * The address is positioned with `history.replaceState` IN THIS TEST ONLY — product code never
 * writes History (`noRawHistoryWrites.test.ts`).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { act, renderHook, waitFor } from "@testing-library/react"

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signInWithSSO: vi.fn(),
  signOut: vi.fn(),
}))
const authListener = vi.hoisted(() => ({ fire: null as null | ((event: string, sess: unknown) => void) }))

vi.mock("@/lib/supabase", () => ({
  supabase: { auth },
  SUPABASE_CLIENT_REHYDRATED: "supabase:client-rehydrated",
}))
vi.mock("@/lib/streamsCache", () => ({ clearCacheForUser: vi.fn() }))
vi.mock("@/lib/api", () => ({ ACTIVE_ORG_STORAGE_KEY: "active-org-id", setActiveOrgId: vi.fn() }))

import { useAuth } from "@/hooks/useAuth"
import { takeReturnTarget, rememberReturnTarget } from "@/lib/returnTo"

const RUN_ID = "229f45ae-c85e-4707-a46c-bf4787541547"
const SESSION = { access_token: "tok", user: { id: "user-1", email: "a@b.c" } }

function at(path: string) {
  window.history.replaceState(null, "", path)
}

beforeEach(() => {
  for (const fn of Object.values(auth)) fn.mockReset()
  auth.getSession.mockResolvedValue({ data: { session: null } })
  auth.onAuthStateChange.mockImplementation((cb: (event: string, sess: unknown) => void) => {
    authListener.fire = cb
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  })
  auth.signInWithPassword.mockResolvedValue({ error: null })
  auth.signUp.mockResolvedValue({ error: null })
  // No `url` back, so the hook never navigates jsdom away.
  auth.signInWithSSO.mockResolvedValue({ data: { url: null }, error: null })
  window.sessionStorage.clear()
  at("/")
})

afterEach(() => {
  vi.useRealTimers()
  window.sessionStorage.clear()
  at("/")
})

describe("useAuth.signInWithSSO — returns to the link (D-24)", () => {
  it("passes redirectTo = origin + the rebuilt run address and remembers it", async () => {
    at(`/app/runs/${RUN_ID.toUpperCase()}`)
    const { result } = renderHook(() => useAuth())
    await act(async () => {
      await result.current.signInWithSSO("corp.com")
    })
    expect(auth.signInWithSSO).toHaveBeenCalledWith({
      domain: "corp.com",
      options: { redirectTo: `${window.location.origin}/app/runs/${RUN_ID}` },
    })
    expect(takeReturnTarget()).toBe(`/app/runs/${RUN_ID}`)
  })

  it("an off-site-looking address redirects to origin + /app and remembers nothing", async () => {
    at("/https://evil.com")
    const { result } = renderHook(() => useAuth())
    await act(async () => {
      await result.current.signInWithSSO("corp.com")
    })
    expect(auth.signInWithSSO).toHaveBeenCalledWith({
      domain: "corp.com",
      options: { redirectTo: `${window.location.origin}/app` },
    })
    expect(takeReturnTarget()).toBeNull()
  })

  it("the redirect value never carries the raw address or a hash", async () => {
    at(`/app/runs/${RUN_ID}?keep=1#access_token=leak`)
    const { result } = renderHook(() => useAuth())
    await act(async () => {
      await result.current.signInWithSSO("corp.com")
    })
    const arg = auth.signInWithSSO.mock.calls[0][0] as { options: { redirectTo: string } }
    expect(arg.options.redirectTo).toBe(`${window.location.origin}/app/runs/${RUN_ID}`)
    expect(arg.options.redirectTo).not.toContain("#")
    expect(arg.options.redirectTo).not.toContain("access_token")
  })
})

describe("useAuth.signUp — the confirmation email returns to the link (D-24)", () => {
  it("passes emailRedirectTo = origin + the rebuilt address and remembers it", async () => {
    at(`/app/runs/${RUN_ID}`)
    const { result } = renderHook(() => useAuth())
    await act(async () => {
      await result.current.signUp("a@b.c", "pw-123456")
    })
    expect(auth.signUp).toHaveBeenCalledWith({
      email: "a@b.c",
      password: "pw-123456",
      options: { emailRedirectTo: `${window.location.origin}/app/runs/${RUN_ID}` },
    })
    expect(takeReturnTarget()).toBe(`/app/runs/${RUN_ID}`)
  })

  it("an unknown address signs up to origin + /app and remembers nothing", async () => {
    at("/nonsense")
    const { result } = renderHook(() => useAuth())
    await act(async () => {
      await result.current.signUp("a@b.c", "pw-123456")
    })
    expect(auth.signUp).toHaveBeenCalledWith({
      email: "a@b.c",
      password: "pw-123456",
      options: { emailRedirectTo: `${window.location.origin}/app` },
    })
    expect(takeReturnTarget()).toBeNull()
  })
})

describe("useAuth.signIn (password) — the address never left (D-24)", () => {
  it("passes no redirect option and clears any stored copy", async () => {
    rememberReturnTarget(`/app/runs/${RUN_ID}`)
    at(`/app/runs/${RUN_ID}`)
    const { result } = renderHook(() => useAuth())
    await act(async () => {
      await result.current.signIn("a@b.c", "pw-123456")
    })
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "a@b.c", password: "pw-123456" })
    expect(takeReturnTarget()).toBeNull()
  })
})

describe("useAuth boot — a session read that fails or hangs (SEED-312 / Pitfall 6)", () => {
  it("a rejected getSession ends the wait: loading false, user null", async () => {
    auth.getSession.mockRejectedValue(new Error("network"))
    const { result } = renderHook(() => useAuth())
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toBeNull()
  })

  it("a getSession that never answers keeps loading, and no timer clears a signed-in user", async () => {
    vi.useFakeTimers()
    auth.getSession.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useAuth())
    act(() => {
      authListener.fire?.("SIGNED_IN", SESSION)
    })
    expect(result.current.user?.id).toBe("user-1")
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000)
    })
    expect(result.current.loading).toBe(true)
    expect(result.current.user?.id).toBe("user-1")
  })

  it("a resolved session still signs the person in as today", async () => {
    auth.getSession.mockResolvedValue({ data: { session: SESSION } })
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user?.id).toBe("user-1")
  })
})

import { useState, useEffect } from "react"
import type { User, Session } from "@supabase/supabase-js"
import { supabase, SUPABASE_CLIENT_REHYDRATED } from "../lib/supabase"
import { clearCacheForUser } from "@/lib/streamsCache"
import { ACTIVE_ORG_STORAGE_KEY, setActiveOrgId } from "@/lib/api"
import { forgetReturnTarget, rememberReturnTarget, returnTarget } from "@/lib/returnTo"

/**
 * Phase 299-05 (LINK-06 / D-24): where the auth server should send the browser back to after a
 * sign-in that LEAVES the page (SSO, the sign-up confirmation email) — always
 * `window.location.origin` + a `returnTarget` result (the rebuilt `/app` path, never the raw
 * address), or `/app` when the address names nothing. A non-null target is also remembered in
 * sessionStorage, because GoTrue falls back to the Site URL for a value not on its Redirect URLs
 * list; plan 299-03's resume takes it once after sign-in.
 */
function leavingRedirect(): string {
  const target = returnTarget(window.location.pathname, window.location.search)
  if (target !== null) rememberReturnTarget(target)
  return window.location.origin + (target ?? "/app")
}

interface UseAuth {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  /** Phase 168 (SSO-01 / D-168-02): start a SAML SSO login for an email domain. GoTrue
   *  resolves domain→provider server-side and returns a redirect `url` the browser must
   *  follow MANUALLY (supabase-js does not auto-navigate). The existing `onAuthStateChange`
   *  picks up `SIGNED_IN` after the IdP callback. Sibling of `signIn` — the password path
   *  (`signInWithPassword`) is untouched + always available (SC#3). */
  signInWithSSO: (domain: string) => Promise<void>
  signOut: () => Promise<void>
}

// Phase 299-05 (D-24 / T-299-13): no app code here reads or writes the URL hash. The auth client
// owns it (implicit flow, `detectSessionInUrl`): its `_initialize` parses the returning token and
// clears the hash itself. And no timer lives here (D-26 / Pitfall 6): a slow session read must
// never flip a signed-in person to the sign-in form, so the visible bound on the wait is
// BootScreen's 20 s clock, and the only new arm is the getSession `.catch` (SEED-312).
export function useAuth(): UseAuth {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubscribe: (() => void) | null = null

    // (Re)bind getSession + onAuthStateChange to the CURRENT `supabase` live binding.
    // WR-06: hydrateSupabaseFromRuntime reassigns `supabase` AFTER an awaited /public-config
    // fetch (the D-07 no-rebuild path), so a subscription bound at mount points at the
    // pre-hydrate dummy client and never sees the real login. Re-binding on the rehydrate
    // event fixes that. The baked-VITE path never reassigns → no event → this runs exactly
    // once → behaviour is unchanged.
    const bind = () => {
      if (unsubscribe) unsubscribe()
      supabase.auth.getSession().then(({ data }) => {
        setSession(data.session)
        setUser(data.session?.user ?? null)
        setLoading(false)
      })
        // Phase 299-05 (SEED-312): a session read that REJECTS ends the wait. `user` is not
        // touched, so a person a SIGNED_IN event already set stays signed in.
        .catch(() => setLoading(false))
      const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
        setSession(sess)
        setUser(sess?.user ?? null)
      })
      unsubscribe = () => listener.subscription.unsubscribe()
    }

    bind()
    window.addEventListener(SUPABASE_CLIENT_REHYDRATED, bind)

    return () => {
      window.removeEventListener(SUPABASE_CLIENT_REHYDRATED, bind)
      if (unsubscribe) unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    // Phase 299-05 (D-24): the password path never leaves the page, so the address is still the
    // link — no redirect option, and any copy an earlier SSO attempt stored is dropped.
    forgetReturnTarget()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signUp = async (email: string, password: string) => {
    // Phase 299-05 (D-24): the confirmation email's link returns to the link the person opened.
    const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: leavingRedirect() } })
    if (error) throw error
  }

  // Phase 168 (SSO-01 / D-168-02): the SSO sibling of `signIn`. `signInWithSSO({ domain })`
  // asks GoTrue (server-side) for the IdP redirect URL; the browser must be redirected
  // MANUALLY (`window.location.href = data.url`) — supabase-js does not auto-navigate. On
  // success the browser leaves for the IdP; on error we surface it to the caller (the login
  // form falls back to the password field). `signInWithPassword` above is UNTOUCHED (SC#3).
  const signInWithSSO = async (domain: string) => {
    // Phase 299-05 (D-24): the IdP sends the browser back to the link the person opened.
    const { data, error } = await supabase.auth.signInWithSSO({ domain, options: { redirectTo: leavingRedirect() } })
    if (error) throw error
    if (data?.url) window.location.href = data.url
  }

  const signOut = async () => {
    // Phase 068.5 B-01: drop the current user's cache BEFORE clearing the
    // auth token so the next user on a shared origin starts clean. Use the
    // locally-tracked user (avoids an extra network round-trip via getUser).
    if (user?.id) clearCacheForUser(user.id)
    // WR-03: the persisted active-org id ("active-org-id") is device-scoped and would
    // otherwise survive sign-out — so the NEXT user on a shared device sends the PRIOR
    // user's org id in X-Org-Id on their very first request (a 403 they can't recover from
    // pre-WR-01). Clear both the localStorage hint AND the in-memory api.ts header var here,
    // in lockstep with the cache drop, so a fresh session starts with no stale org.
    try {
      window.localStorage.removeItem(ACTIVE_ORG_STORAGE_KEY)
    } catch {
      // private-mode / SSR — the in-memory clear below is the load-bearing one.
    }
    setActiveOrgId(null)
    await supabase.auth.signOut()
  }

  return { user, session, loading, signIn, signUp, signInWithSSO, signOut }
}

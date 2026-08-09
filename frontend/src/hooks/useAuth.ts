import { useState, useEffect } from "react"
import type { User, Session } from "@supabase/supabase-js"
import { supabase, SUPABASE_CLIENT_REHYDRATED } from "../lib/supabase"
import { clearCacheForUser } from "@/lib/streamsCache"
import { ACTIVE_ORG_STORAGE_KEY, setActiveOrgId } from "@/lib/api"

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
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
  }

  // Phase 168 (SSO-01 / D-168-02): the SSO sibling of `signIn`. `signInWithSSO({ domain })`
  // asks GoTrue (server-side) for the IdP redirect URL; the browser must be redirected
  // MANUALLY (`window.location.href = data.url`) — supabase-js does not auto-navigate. On
  // success the browser leaves for the IdP; on error we surface it to the caller (the login
  // form falls back to the password field). `signInWithPassword` above is UNTOUCHED (SC#3).
  const signInWithSSO = async (domain: string) => {
    const { data, error } = await supabase.auth.signInWithSSO({ domain })
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

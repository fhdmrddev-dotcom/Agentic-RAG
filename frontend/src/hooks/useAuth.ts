import { useState, useEffect } from "react"
import type { User, Session } from "@supabase/supabase-js"
import { supabase, SUPABASE_CLIENT_REHYDRATED } from "../lib/supabase"
import { clearCacheForUser } from "@/lib/streamsCache"

interface UseAuth {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
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

  const signOut = async () => {
    // Phase 068.5 B-01: drop the current user's cache BEFORE clearing the
    // auth token so the next user on a shared origin starts clean. Use the
    // locally-tracked user (avoids an extra network round-trip via getUser).
    if (user?.id) clearCacheForUser(user.id)
    await supabase.auth.signOut()
  }

  return { user, session, loading, signIn, signUp, signOut }
}

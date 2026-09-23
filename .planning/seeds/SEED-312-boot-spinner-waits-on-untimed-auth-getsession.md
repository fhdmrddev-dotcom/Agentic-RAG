---
seed_id: SEED-312
title: The boot spinner also waits on supabase.auth.getSession(), which has no timeout and no catch
created: 2026-09-24
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: Any phase touching frontend/src/hooks/useAuth.ts or the App.tsx boot effect, OR a report of the app stuck on the boot spinner while the backend is healthy.
trigger_paths: ["frontend/src/hooks/useAuth.ts", "frontend/src/App.tsx", "frontend/src/lib/supabase.ts"]
trigger_surfaces: [auth]
migration_note:
relates_to: ["265", "265-REVIEW.md WR-01", "UAT-265-257-2-OBS", "f2d78377e", "6383da2e5"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-312: The boot spinner also waits on an un-timed auth call

## The finding

Phase 265 put 10 s timeouts on the two awaited backend fetches of the boot path: `getSetupStatus` (`6383da2e5`) and
`hydrateSupabaseFromRuntime`'s `/public-config` (`f2d78377e`, WR-01). The fresh re-driver of WR-01 found a third wait,
**PLAUSIBLE and not driven**. The spinner also holds on `useAuth().loading`. That flag turns false only inside
`supabase.auth.getSession().then(...)` in `bind()` (`frontend/src/hooks/useAuth.ts`), which has no `.catch` and no
timeout. With an expired stored access token, supabase-js refreshes against GoTrue, and that fetch has no default
timeout. So a hung Supabase Auth, or a rejected `getSession`, would hold the boot spinner forever.

## Why it matters

The failure looks identical to the one 265 fixed: the app sits on a spinner with no message. It fires only when Auth
hangs, not when the backend does, so it is rarer. Nobody has hit it yet.

## When to surface

Any phase whose `files_modified` names `useAuth.ts` or the App boot effect, or a lived report of a boot hang with a
healthy backend.

## Scope estimate

Small. Add a `.catch` that sets `loading=false`, and bound the wait (a race against a timer). Drive it first with a
stalled GoTrue, per the PLAUSIBLE rule.

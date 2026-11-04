---
phase: 299-links-to-the-thing-itself
plan: 05
subsystem: frontend / auth + boot + chat list
tags: [frontend, auth, boot, return-to-link, loading-state]
requires:
  - 299-01
provides:
  - "frontend/src/lib/returnTo.ts: returnTarget, kindWord, RETURN_LINE, rememberReturnTarget, takeReturnTarget, forgetReturnTarget (strict leaf)"
  - "frontend/src/components/layout/BootScreen.tsx: BootScreen + BOOT_COPY (one clock, 8 s / 20 s)"
  - "useThreads().pending: true until the active org's list has answered"
  - "useAuth: SSO redirectTo / sign-up emailRedirectTo built from returnTarget; getSession .catch"
affects: [299-02, 299-03]
tech-stack:
  added: []
  patterns:
    - "rebuild, never echo: every value stored or forwarded is formatAppRoute(parseAppLocation(...))"
    - "the stored copy is untrusted on read: removed first, TTL, re-validated, consumed once"
    - "one visible clock (BootScreen); no timer in useAuth"
key-files:
  created:
    - frontend/src/lib/returnTo.ts
    - frontend/src/lib/__tests__/returnTo.test.ts
    - frontend/src/hooks/__tests__/useAuth.test.ts
    - frontend/src/pages/__tests__/AuthPage.returnLine.test.tsx
    - frontend/src/components/layout/BootScreen.tsx
    - frontend/src/components/layout/__tests__/BootScreen.test.tsx
    - frontend/src/components/layout/__tests__/ChatLayout.mobileLoading.test.tsx
  modified:
    - frontend/src/hooks/useAuth.ts
    - frontend/src/pages/AuthPage.tsx
    - frontend/src/App.tsx
    - frontend/src/hooks/useThreads.ts
    - frontend/src/components/layout/ChatLayout.tsx
    - frontend/src/__tests__/hooks/useThreads.orgSwitch.test.ts
    - frontend/src/components/layout/__tests__/ChatHistoryColumn.orgSwitch.test.tsx
    - scripts/vitest-count-gate.cjs
    - docs/OPERATOR.md
    - docs/DEPLOYMENT-WORKFLOW.md
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
decisions:
  - "D-26 bound lives in BootScreen's 20 s give-up; useAuth gets only the getSession .catch, never a timer (Pitfall 6)"
  - "The return target is stored in sessionStorage (same-tab round trip), never localStorage, so it cannot resume on a later normal visit (Pitfall 7)"
  - "kindWord matches by the parsed route's id key (runId / threadId / definitionId / bundleId), so 299-02's new entity routes light up with no edit to the leaf"
  - "AuthPage.tsx now FIRES at 3 phases (177, 276, 299); a CLAUDE.md FIRING row was added for it and for useAuth.ts"
metrics:
  duration: "~1h20m"
  completed: 2026-10-28
  tasks: 3
  commits: 7
---

# Phase 299 Plan 05: Return to the link, a boot that gives up, and a chat list that waits — Summary

A link opened while signed out now survives sign-in. Password sign-in keeps the address. SSO and
sign-up send Supabase an `<origin>/app/...` address rebuilt from the route table, plus a same-tab
copy. Nothing off-site is accepted at any step. The sign-in card says which kind of thing the link
opens, never its title. The boot screen now speaks at 8 s and gives up with a Try again button at
20 s, without ever showing a signed-in person the sign-in form. No chat list says "No recent chats"
until it has actually answered empty.

## What was built

**Task 1: return to the link** (`2462dc69a` RED, `c72a194c4` GREEN)
- `lib/returnTo.ts` (strict leaf, 127 L):
  - `returnTarget` returns `formatAppRoute(parseAppLocation(...))` for a parsed `/app` route and `null` for everything else. That covers the whole appRoutes HOSTILE set, `/setup`, `/invite` and unknown paths. It never throws.
  - `kindWord` returns the kind word only.
  - `RETURN_LINE` holds the two S5 sentences.
  - One sessionStorage key holds `{path, at}`. It is removed before it is judged, expires after 15 minutes, is re-validated through `returnTarget` and must equal its own rebuild.
- `useAuth.ts`:
  - One private `leavingRedirect()` helper builds the redirect. `signInWithSSO` passes `options.redirectTo` and `signUp` passes `options.emailRedirectTo`.
  - `signIn` (password) calls `forgetReturnTarget()` first and passes no redirect.
  - `getSession()` gains `.catch(() => setLoading(false))`, which never touches `user`.
- `AuthPage.tsx`: one `<p className="mt-4 text-center text-xs text-muted-foreground">` sibling after the form. It has no new prop. `SignInForm.tsx`, `SignUpForm.tsx` and `SignInForm.test.tsx` are byte-unchanged from base.
- Docs (D-25): `docs/OPERATOR.md` Redirect URLs gains the one-box origin line, and `docs/DEPLOYMENT-WORKFLOW.md` §5 gains the parity row and a changelog line.

**Task 2: the boot screen** (`6d30c495a` RED, `c7b70c177` GREEN, `dc7839159` docblock fix)
- `components/layout/BootScreen.tsx` (89 L) runs one clock from mount:
  - 0–8 s: App's pre-299 splash, verbatim.
  - 8–20 s: "Still connecting…" appears inside the same `role="status"`. The Iris is not remounted.
  - After 20 s: "Can't reach Syrel", the body sentence (plus " Your link is kept, so you'll still land on it." on an entity address only), and a focused, filled "Try again" that calls `window.location.reload()`.
  - No `role="alert"`, no amber and no red.
- `App.tsx`: the splash JSX became `<BootScreen />`. One expression changed, and the `IrisAvatar` import was swapped for `BootScreen`'s (App no longer renders the Iris itself).

**Task 3: FIX-02** (`cf5c94f64` RED, `f7de05474` GREEN)
- `useThreads.ts`:
  - One derived const, `const pending = held === null || held.org !== activeOrgId`, is added to the return object.
  - A dated correction sits beside the docblock's "BUG-261027-02 stays for Phase 299" line, which is kept.
- `ChatLayout.tsx`:
  - `pending: threadsPending` replaces `switching: threadsSwitching`, which was read nowhere else.
  - `loading={threadsPending}` is passed to the column.
  - The mobile list's ternary gains a first arm: `SyrelLoader` with `LOADING_CHATS`.
  - `ChatHistoryColumn.tsx` and `StreamsProvider.tsx` are unmodified from base, as checked with `git diff 593068492`.

## Gate results

- **Vitest count gate** (`GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`, repo root), verbatim verdict:
  `RESULT: COUNT GATE VIOLATED (1 reason(s))` — `FAIL [failing-tests] 1 test(s) failed — the gate requires 0.`
  Totals: `total 12854 · failed 1 · pinned total 11705`.
  - There is **no `[count-decrease]`**: no pinned file reports fewer tests than its pin.
  - **The one failure is INHERITED from 299-01, not this plan.** The filename was captured from the gate's own persisted JSON report before anything was re-run. It is `frontend/src/docs/__tests__/docsCoverageGate.test.ts`, which reports `[uncovered] router:links`.
  - I ran `check-docs-coverage.cjs --root` against `git archive` copies of three refs:
    - `593068492` (phase base): **OK**, 119 keys.
    - `8cbeed1d7` (this plan's base, after 299-01's `cc2875ee5` added `backend/app/api/links.py`): **FAILED**, `router:links`.
    - `HEAD`: the same single finding.
  - This plan touched nothing under `backend/`, `docs/public/`, `frontend/src/docs/` or the script. The finding is logged in `deferred-items.md`; it is out of scope here.
- **Per-file deltas for this plan's suites** (pinned → actual, all delta 0):

  | Suite | Pinned → actual |
  |---|---|
  | `returnTo.test.ts` | 49 → 49 |
  | `useAuth.test.ts` | 9 → 9 |
  | `AuthPage.returnLine.test.tsx` | 8 → 8 |
  | `BootScreen.test.tsx` | 9 → 9 |
  | `ChatLayout.mobileLoading.test.tsx` | 4 → 4 |
  | `useThreads.orgSwitch.test.ts` (raised from 5) | 9 → 9 |
  | `ChatHistoryColumn.orgSwitch.test.tsx` | 6 → 6 |
  | `appRoutes.test.ts` | 111 → 111 |

  All five new files are pinned in BOTH knobs: FILE-LEVEL `TARGETS` and `BASELINE`.
- **Typecheck set-diff** (`npx tsc -p tsconfig.app.json --noEmit` in `frontend/`): base `593068492` has 61 `error TS` lines. Frontend is unchanged between `593068492` and `8cbeed1d7`, so the base was measured at `8cbeed1d7`. After each task, **new: 0, gone: 0**, and the error set is identical to base.
- **Targeted suites, all green:**
  - Task 1: 7 files, 193 tests. These include `SignInForm.test.tsx` unedited, `appRoutes`, `supabase` and `noRawHistoryWrites`.
  - Task 2: 8 files, 102 tests. These include `SetupWizard`, `navigationKeepsStreams`, `AppViewSwitch.addressStates`, `ChatLayout.startChat`, `NavPanel` and `ChatLayout.launch`.
  - Task 3: 9 files, 99 tests. These include `ChatHistoryColumn.clickPath`, `ChatHistoryColumn.test`, `ChatLayout.scrollFrame`, `ChatLayout.runDeepLink`, `ChatLayout.launch` and `ChatLayout.startChat`.
- **Ledger gate** (`node scripts/check-hot-file-ledger.cjs .planning/phases/299-links-to-the-thing-itself`): `ledger gate OK — every watched file has a row.`
- **CLAUDE.md size gate:** `claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.` (103,142 chars after Task 1)
- **Deploy drift** (`bash scripts/check-deploy-drift.sh`): `RESULT: PASS`.
- **Acceptance greps:**
  - `redirectTo`, `emailRedirectTo` and `.catch(` in `useAuth.ts`: each ≥ 1.
  - Non-comment `location.hash` / `setUser(null)` in `useAuth.ts`: 0.
  - `returnTo.ts` imports only `appRoutes`.
  - `dangerouslySetInnerHTML` in `AuthPage.tsx`: 0.
  - `<BootScreen` in `App.tsx`: 1. `IrisAvatar` in `App.tsx`: 0.
  - `Still connecting…` and `Can't reach Syrel` in `BootScreen.tsx`: 1 each. `history.*State` and `role="alert"` in `BootScreen.tsx`: 0.
  - The `const pending = …` line in `useThreads.ts`: 1. `loading={threadsPending}` in `ChatLayout.tsx`: 1. `LOADING_CHATS` in `ChatLayout.tsx`: 2.
  - `git diff 593068492` on `ChatHistoryColumn.tsx`, `StreamsProvider.tsx` and the three auth form files: empty.
  - `setSelectedThread(thread)` in `useThreads.ts`: 2.

## Deviations from Plan

### Reasoned deviation (recorded as the plan requires)

**D-26: the "bound the wait" is BootScreen's 20 s give-up, not a timer in `useAuth`.**
- `useAuth` gains only the `getSession` `.catch`, which ends the wait on a rejected read and leaves `user` untouched.
- No timeout was added to `useAuth`. A timer there that cleared `loading` or `user` would send a signed-in person with a slow session read to the sign-in form (RESEARCH Pitfall 6).
- The visible bound is the one clock in `BootScreen`: the Try again button after 20 s, which reloads and keeps the URL. That clock changes only what the screen says, never the auth decision.
- `useAuth.test.ts` asserts this. When `getSession` never answers, `loading` stays true and a SIGNED_IN user stays set after 120 s of fake time.
- RESEARCH Pattern 8 had suggested a `stalled` flag in `useAuth`. It was not added: BootScreen's clock makes it unnecessary, and the flag would be a second clock.

### Auto-fixed issues

1. **[Rule 1 – Test bug] BootScreen unmount case.** The RED test asserted exactly two `clearTimeout` calls on unmount. `IrisAvatar` clears its own handles too, so the actual count was 5. The case now asserts at least our two calls, and that the fake-timer count drops from 2 to 0. That second check is the real property: no update after unmount. Commit `c7b70c177`.
2. **[Rule 1 – Acceptance grep] Docblocks re-worded.** The returnTo docblock said "only import", BootScreen's repeated "Still connecting…" and "Can't reach Syrel", and BootScreen's named `role="alert"`. Each of these would make the plan's `grep -c` acceptance checks read 2 or 1 instead of 1 or 0. The prose now names `BOOT_COPY.*` and "alert role". Commits `c72a194c4`, `c7b70c177`, `dc7839159`.
3. **[Rule 2 – Ledger completeness] `AuthPage.tsx` now FIRES.** It crossed from 2 phases to 3 (177, 276, 299), so it got a CLAUDE.md FIRING row beside `useAuth.ts`'s. Its section records the crossing and the verbatim old cell.
4. **`ChatHistoryColumn.orgSwitch.test.tsx`** gained a dated docblock correction only. Its cases are unchanged and its pin stays at 6. The desktop and mobile first-load cases live in the new `ChatLayout.mobileLoading.test.tsx`, because that file's harness mounts the real ChatLayout.

## Deploy notes (operator)

- **Supabase Auth → URL Configuration → Redirect URLs** must include `https://app.<domain>/**` and the one-box origin (the box's `FRONTEND_URL` origin with `/**`; for a local one-box, `http://localhost:8080/**`). If a value is not on the list, GoTrue falls back to the Site URL and the person lands on chat instead of the link. The same-tab copy usually recovers this. This is an operator step only: no new env var, no migration and no cloud write. `docs/DEPLOYMENT-WORKFLOW.md` §5 carries the row.
- The local Supabase CLI allow-list is not in the repo. Read it by hand before the G-4 row 4 SSO arm, which is ⛔ in cloud anyway (D-41: cloud has no SSO provider). SSO return is proven by `useAuth.test.ts`'s `redirectTo` and sessionStorage cases.
- `bash scripts/check-deploy-drift.sh`: `RESULT: PASS`. The two WARN lines (migrations 215/216 seed-like, and docker compose unavailable) predate this plan.

## Known Stubs

None.

## Threat Flags

None. T-299-11..17 are mitigated as written. T-299-11 and T-299-12 are pinned by `returnTo.test.ts` (the HOSTILE set, planted `//evil`, TTL). T-299-13 is pinned by the redirect value carrying no hash or token. T-299-14 is the kind-only line. T-299-15 and T-299-16 are the `.catch`, the 20 s give-up and the never-resolving-session case. T-299-17 is transferred to the D-25 parity row.

## Not flipped (by instruction)

SEED-312 and BUG-261027-02 stay as they are and flip at phase close after G-4. LINK-06 also depends on 299-03's resume, so this plan did not mark it complete. STATE.md and ROADMAP.md were not modified.

## TDD Gate Compliance

Each task has a `test(299-05)` RED commit before its GREEN commit: `2462dc69a` → `c72a194c4`, `6d30c495a` → `c7b70c177`, `cf5c94f64` → `f7de05474`. Each RED was observed failing for the expected reason:
- Task 1: the module was missing, so 3 files failed (3 AuthPage cases failed, 5 no-line cases passed).
- Task 2: the module was missing.
- Task 3: `pending` was undefined in 4 cases, and "Loading your chats…" was absent in 2 ChatLayout cases. The 2 settled-state regression cases passed, as they should.

## Self-Check: PASSED

- All 7 created files exist on disk.
- All 7 task commits exist on `develop` (`git log 8cbeed1d7..HEAD`): 2462dc69a, c72a194c4, 6d30c495a, c7b70c177, dc7839159, cf5c94f64, f7de05474.
- `STATE.md` and `ROADMAP.md` were not modified (`git diff --name-only 8cbeed1d7 HEAD -- .planning/STATE.md .planning/ROADMAP.md` is empty).

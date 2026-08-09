# Phase 165 — Deferred / Out-of-Scope Items

Discovered during execution; logged per the executor SCOPE BOUNDARY rule (only auto-fix
issues DIRECTLY caused by the current task's changes). These are NOT fixed here.

## Pre-existing frontend `tsc -b` rot (discovered in Plan 165-08)

`npm run build` runs `tsc -b`, whose `tsconfig.app.json` includes all of `src` (tests
too). At Plan 165-08 execution, `tsc -b --force` reports **8 pre-existing type errors in
6 source files NOT touched by this plan** — none reference the `is_global` rename, so they
predate the phase (confirmed: `git status` shows these files unmodified by Plan 08; no
error references `is_global`/`is_org_shared`/`is_system_global`/`OrgShared`). They look
like an `@types/react` 19 / dependency-types drift in the local `node_modules`.

| File | Error (abridged) |
|------|------------------|
| `src/components/chat/MessageSkeleton.tsx` | TS2503 Cannot find namespace 'JSX' |
| `src/components/settings/MemorySection.tsx` | TS2339 `.finally` does not exist on `PromiseLike<void>` |
| `src/components/skills/SkillFormDialog.tsx` (×2) | TS2322 `RefObject<HTMLInputElement \| null>` not assignable |
| `src/pages/SettingsPage.tsx` (×2) | TS2561 `web_search_enabled` not in `SettingsUpdate`; TS2322 `tooltip` prop |
| `src/providers/StreamsProvider.tsx` | TS6133 `getActiveRuns` declared but never read |
| `src/stores/streamsStore.ts` | TS2345 zustand `StateCreator` / `viewedThreadId` mismatch |

Not fixed (out of scope — unrelated to the MIG-02 rename). Candidate for a dedicated
frontend-tsc-rot cleanup (related to the known vitest rot, SEED-056).

## Frontend test-file `is_global` / `toggleGlobal` references (owned by Plan 165-09)

102 `tsc -b` errors live in `.test.tsx` / `__tests__` files that still construct `Folder`/
`Skill` fixtures with `is_global` and mock `onToggleGlobal` / `toggleSkillGlobal`. Plan
165-08's `<context>` NOTE explicitly assigns these renames to **Plan 165-09** (test-file
split). They surface now precisely BECAUSE the Plan-08 type rename is complete and
consistent (the app types changed as intended). Not fixed here — Plan 09 owns them.

## Two stale behavioral RLS tests — PRE-EXISTING ROT since Phase 163 mig-109 (discovered in Plan 165-11)

The broader Task-3 rename-regression sweep (beyond the plan's declared named suites) found
**2 failing tests**, both asserting that an `is_system_global = true` row on a write-locked
platform table is NOT visible cross-org (`crossorg_sees == 0`):

| Test | File |
|------|------|
| `test_global_rule_renders_for_comember_not_cross_org` | `backend/tests/integration/test_163_rls_dm.py` (classification_rules) |
| `test_global_workflow_def_renders_for_comember_not_cross_org` | `backend/tests/integration/test_163_rls_workflow_eval.py` (workflow_definitions) |

**Root cause (evidence-based, NOT rename-induced):** the live SELECT policy on all four
write-locked platform tables is `(is_system_global = true) OR (org_id IN
current_user_org_ids() AND auth.uid() = <owner>)` — `is_system_global = true` is an
**unconditional universal branch** (cross-org visible by design), the analog of
`skills.is_system`. This universal shape was introduced by **migration 109
(Phase 163-11 FIX-A)** — which DELIBERATELY lifted the global branch OUT of the org gate for
these four tables (mig-108 had it org-gated; mig-109 header: "is_global=true there is only
ever seed/platform content", so universal is safe). Plan 165-10's catalog verification
signed this exact shape off as "auto-propagated, **not widened**". Migration 111 (this phase)
only did a `RENAME COLUMN is_global → is_system_global`, no logic change.

So these two `crossorg_sees == 0` assertions have contradicted live DB behavior **since
Phase 163 (mig-109)** — they encode the mig-108 org-gated semantics that FIX-A superseded and
were never updated. Plan 165-05 correctly token-renamed `is_global → is_system_global` inside
them but inherited the stale assertion. **This is NOT the MIG-02 rename regression** (no
`is_global`-literal breakage remains — the literals are correctly renamed) and NOT a security
leak (the INSERT/UPDATE `WITH CHECK is_system_global = false` write-lock means only seeds /
platform content can ever be `is_system_global = true`; those are meant to be universal).

**Baseline reference:** would fail on `HEAD~*` back to the mig-109 apply, independent of any
Phase-165 change. **Not fixed here** — out of Plan 165-11's file scope (`files_modified` =
`test_v3_4_org_isolation.py` only) and out of the plan's declared Task-3 named-suite gate.
Correct follow-up: flip the cross-org leg to expect universal visibility
(`crossorg_sees == 1`) or drop it, in the owning files (Plan 165-05 domain). Candidate for a
`/gsd:quick` fix or the phase verifier.

## `backend/scripts/seed_115_uat_views.py` residual `is_global` (discovered in Plan 165-11)

Line 41 inserts a `document_views` row with `"is_global": False`. `document_views.is_global`
was renamed to `is_system_global` by mig 111, so this one-off Phase-115 UAT seed helper is
stale (would 400 at runtime). It lives under `backend/scripts/` — **outside** Plan 165-11's
Task-3 acceptance-grep scope (`backend/app` + `backend/tests`) and outside any 165 plan's file
ownership; not exercised by the running app or any test. Documented, not fixed (a one-line
`"is_system_global": False` rename when someone next touches that UAT script).

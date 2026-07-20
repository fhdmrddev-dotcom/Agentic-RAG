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

# Phase 146 — Deferred / Out-of-Scope Items

Discovered during execution; logged per the SCOPE BOUNDARY rule (do NOT fix unrelated
pre-existing failures). Not caused by any 146 plan.

## Pre-existing `tsc -b` rot blocks `npm run build` (SEED-056 territory)

**Discovered during:** Plan 146-06, Task 3 (frontend build gate).

**What:** `npm run build` (= `tsc -b && vite build`) fails at the `tsc -b` step on
pre-existing TypeScript errors in files this phase never touched. `vite build` on its
own succeeds (exit 0 — the app bundles), and `tsc -p tsconfig.json` (the solution
file) is clean; only the project-references typecheck (`tsc -b` → `tsconfig.app.json`)
surfaces these.

**Proof it is pre-existing (not caused by 146-06):**
- Plan 146-06 touched only 5 source files: `App.tsx`, `ControlRoomPage.tsx`,
  `AuditTab.tsx`, `ChatLayout.tsx`, `NavPanel.tsx` (+ the new `nav-items.test.ts`).
- None of the error files below appear in `git diff --name-only HEAD~2 HEAD`.
- None of the error files reference `ActiveView` (the plan's only cross-file type
  change), so the added `"control-room"` union member cannot ripple into them.

**The errors (all unrelated to the operator surface):**
| File | Error |
|------|-------|
| `src/components/panel/FilePreview.test.tsx` (34,35) | TS2783 duplicate `size_bytes`/`mime_type` keys |
| `src/components/settings/MemorySection.tsx` (46) | TS2339 `.finally` on `PromiseLike<void>` |
| `src/components/skills/SkillFormDialog.tsx` (382,568) | TS2322 `RefObject<HTMLInputElement \| null>` (React 19 ref rot) |
| `src/lib/api.test.ts` (131) | TS2322 `StreamCallbacks.onDelta` optional mismatch |
| `src/pages/SettingsPage.tsx` (748,998) | TS2561 `web_search_enabled` not in `SettingsUpdate`; TS2322 `tooltip` prop |
| `src/providers/StreamsProvider.tsx` (74) | TS6133 `getActiveRuns` declared but never read |
| `src/stores/streamsStore.ts` (288) | TS2345 `StateCreator` `viewedThreadId` type |

**Disposition:** Out of scope for Phase 146 (SCOPE BOUNDARY — pre-existing failures in
unrelated files). Belongs to the SEED-056 frontend tsc/vitest rot cleanup. This phase's
own build evidence is green: `vite build` succeeds, all 146-06 files type-check clean
under both `tsc -p tsconfig.json` and the scoped `tsc -b` output (none appear in the
error list), and the two target vitest files (`nav-items.test.ts` +
`useOperatorProbe.test.ts`) pass 4/4.

**Re-open trigger:** SEED-056 rot cleanup, or any phase that makes `npm run build` a hard
CI gate — these 7 files must be fixed before `tsc -b` can go green.

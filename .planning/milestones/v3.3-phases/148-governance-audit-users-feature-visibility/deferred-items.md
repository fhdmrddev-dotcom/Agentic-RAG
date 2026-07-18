# Phase 148 — Deferred / Out-of-Scope Items

Discoveries logged during execution that are NOT this phase's responsibility
(SCOPE BOUNDARY — pre-existing failures in unrelated files are not auto-fixed).

## Pre-existing frontend `npm run build` (tsc -b) rot — 30 errors, 17 files

**Discovered during:** 148-07 Task 1 (frontend build gate).

`cd frontend && npm run build` (`tsc -b && vite build`) is RED at baseline HEAD
(commit `01188f46`) with **30 pre-existing type errors** across 17 files —
independent of any 148-07 change. Fingerprint captured before touching any file.

**Breakdown:**
- **21 errors in `__tests__/` + `*.test.ts(x)` files** — the known frontend-vitest
  ROT (SEED-056; memory `project_frontend_vitest_rot.md`): fail at baseline AND HEAD.
  Files: `useMessages.test.ts` (5), `ChatAreaMode.test.tsx` (4), `FilesSection.test.tsx` (3),
  `FilePreview.test.tsx` (3), `useDocuments.test.ts` (1), `useFolders.test.ts` (1),
  `IngestionPage.test.tsx` (1), `ChatLayoutLaunch.test.tsx` (1), `api.test.ts` (1),
  `SettingsPage.test.tsx` (1).
- **9 errors in 7 source files** — smell of a React-19 `@types/react` drift in
  `node_modules` (e.g. `RefObject<HTMLInputElement | null>` no longer assignable to
  `RefObject<HTMLInputElement>` in `SkillFormDialog.tsx`; the zustand `StateCreator`
  variance error in `streamsStore.ts`) plus a couple of unused-local / prop-shape
  errors. Files: `SettingsPage.tsx` (2), `SkillFormDialog.tsx` (2), `NavPanel.tsx` (1 —
  unused `Button` import), `MessageSkeleton.tsx` (1), `MemorySection.tsx` (1),
  `StreamsProvider.tsx` (1 — unused `getActiveRuns`), `streamsStore.ts` (1).

**Why out of scope for 148-07:** none of these files are owned by this plan
(the 4 files_modified are `useEffectiveFeatures.ts`, `api.ts`, `App.tsx`,
`nav-items.ts`; plus the required nav plumbing `ChatLayout.tsx` + `NavPanel.tsx`).
The 148-07 changes add **zero** new errors — verified by diffing the post-change
`tsc -b` output against this baseline fingerprint.

**Note vs. the 147 memory lesson:** Phase 147's "npm run build green" gate predates
this drift; the React-19 `@types/react` / zustand-types errors look introduced by a
`node_modules` dependency bump since 147 shipped, not by committed source. A dedicated
build-rot cleanup (or `@types/react` pin) is warranted before the frontend build gate
can be a hard green again. Candidate: fold into the SEED-056 test-rot revival, or a
small standalone `/gsd:fast` type-fix pass on the 9 source-file errors.

**Re-open trigger:** any phase that needs a genuinely-green `cd frontend && npm run build`
as a hard gate (rather than a "no NEW errors vs. baseline" diff) must first clear these 30.

**148-07 side-note (Task 2):** `ChatLayoutLaunch.test.tsx:116` is one of the 30 rotted
tests — it already fails by constructing `<ChatLayout>` with an incomplete props object
(missing 9 required props at baseline). Task 2 adds a 10th required prop (`navItems`), so
that test's error message now lists `navItems` too — a cosmetic message change, NOT a new
failure (total count stays 30, the file was already red). The test is fundamentally rotted
(never supplied the required props); a real fix belongs to the SEED-056 revival, not here.

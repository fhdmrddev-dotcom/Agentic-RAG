---
phase: 154-plain-language-layer
plan: 01
subsystem: ui
tags: [react, context, localStorage, plain-language, two-audience, term-map, vitest]

# Dependency graph
requires:
  - phase: 146-operator-foundation
    provides: "ControlRoomPage + TechnicalNamesToggle + local showTechnical useState (the D-01a consolidation target)"
  - phase: 153-inline-citations
    provides: "citationNav.tsx createContext + throwing-hook provider template (the sharing structure copied here)"
provides:
  - "TechnicalNamesProvider — one app-wide shared reveal-state context (default plain, localStorage-persisted) mounted around ChatLayout"
  - "useTechnicalNames() (throwing) + useTechnicalNamesOptional() (non-throwing) accessors"
  - "termMap.ts — single-source glossary { plain, helper?, technical } for Surfaces A–D + usePlainLabel hook"
  - "PlainLabel.tsx — <PlainLabel term showHelper?> auto-escaped text node + optional ⓘ helper"
  - "D-01a consolidation — admin Control Room reads the shared context (zero leaf edits); Settings + admin toggles are now the SAME switch"
affects: [154-wave-2-relabel-surfaces, DocumentStatusBadge, DocumentDetailPanel, MessageInput, SettingsPage, 155-a11y]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Provider + throwing hook for shared UI state (createContext<T|null> + useXxx throws / useXxxOptional returns null)"
    - "Single-source term-map: display-only { plain, helper?, technical } with technical === today's shipped string verbatim (D-02a)"
    - "Prop-controlled leaf, provider-owned state: consolidate the owner's state SOURCE (useState → context) with byte-identical leaf prop threads"

key-files:
  created:
    - frontend/src/providers/TechnicalNamesProvider.tsx
    - frontend/src/providers/__tests__/TechnicalNamesProvider.test.tsx
    - frontend/src/lib/termMap.ts
    - frontend/src/lib/PlainLabel.tsx
    - frontend/src/lib/__tests__/termMap.test.tsx
  modified:
    - frontend/src/App.tsx
    - frontend/src/components/admin/ControlRoomPage.tsx
    - frontend/src/components/admin/__tests__/ControlRoomPage.test.tsx

key-decisions:
  - "Built a shared React context Provider (citationNav shape), NOT a bare useTheme-style hook — the single point that prevents the two-toggles-disagree failure"
  - "InfoHint ⓘ inlined in PlainLabel.tsx (mirrors PhaseFormPanel's non-exported local primitive) rather than editing PhaseFormPanel — keeps the plan's 8-file scope exact"
  - "termMap technical side holds today's shipped display string verbatim; nothing in the map is a wire enum / API field / audit-action value (D-02a)"

patterns-established:
  - "TechnicalNamesProvider is the app-wide two-audience switch every current + future surface inherits for free (SEED-085 generalization)"
  - "usePlainLabel: unknown-key passthrough returns String(key) (AuditTab fallback-to-raw idiom), never throws"

requirements-completed: [LANG-01]

# Metrics
duration: 8min
completed: 2026-07-15
---

# Phase 154 Plan 01: Plain-Language Layer SPINE Summary

**One app-wide shared reveal-state context (TechnicalNamesProvider, default plain, localStorage-persisted) + a single-source term-map (termMap.ts / usePlainLabel / PlainLabel) + the D-01a admin Control Room consolidation so the Settings and admin toggles are one switch — all frontend-only, zero backend files.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-15T15:27:11Z
- **Completed:** 2026-07-15T15:35:09Z
- **Tasks:** 3
- **Files modified:** 8 (5 created, 3 modified — exactly the plan's `files_modified`)

## Accomplishments
- **The spine:** `TechnicalNamesProvider` holds ONE shared boolean broadcast to every consumer. It copies the sharing structure of `citationNav.tsx` (createContext + throwing hook + optional non-throwing accessor) and the localStorage persistence of `useTheme.ts` — deliberately WITHOUT `matchMedia` (default is a hard `false`, D-01). This is the #1-failure-mode guard: a bare per-consumer hook would let the two toggles drift; a shared context cannot.
- **Single-source term-map:** `termMap.ts` maps every display concern → `{ plain, helper?, technical }` for Surfaces A–D (ingest steps, statuses, document detail, composer modes, Settings labels). `usePlainLabel` flips plain⇄technical off the shared context; `PlainLabel` renders an auto-escaped React text node (no `dangerouslySetInnerHTML`) plus an optional ⓘ helper.
- **Mounted app-wide:** `App.tsx` wraps `<ChatLayout>` in `<TechnicalNamesProvider>` — covering chat, documents, workflows, settings, AND `/admin` (ControlRoomPage renders inside ChatLayout's view switch) in one mount.
- **D-01a consolidation:** ControlRoomPage's local `showTechnical` useState is replaced by `useTechnicalNames()`; the four toggle closures rewire to the shared `toggleTechnical`; all five leaf prop threads (`HealthSignals`/`CapabilityGrid`/`AuditTab`/`FeatureVisibility`/`ModelRegistryTab`) are byte-identical (zero leaf edits). Flipping the toggle in Settings (Wave 2) and in the Control Room now move the SAME value.

## Task Commits

Each task was committed atomically (TDD tasks: test → feat):

1. **Task 1: TechnicalNamesProvider (shared reveal-state context)** — `9b68e049` (test RED) → `20ce3a78` (feat GREEN)
2. **Task 2: termMap.ts glossary + usePlainLabel + PlainLabel** — `22e26860` (test RED) → `a7db00e4` (feat GREEN)
3. **Task 3: mount provider app-wide + D-01a Control Room consolidation + test wrap** — `5f108a9e` (feat)

**Plan metadata:** (final docs commit — SUMMARY + STATE + ROADMAP)

## Files Created/Modified
- `frontend/src/providers/TechnicalNamesProvider.tsx` — context + `TechnicalNamesProvider` + `useTechnicalNames` (throwing) + `useTechnicalNamesOptional` (null-outside) + localStorage `"technical-names"` persistence, default OFF.
- `frontend/src/providers/__tests__/TechnicalNamesProvider.test.tsx` — 6 cases (default OFF, shared flip across two consumers, setShowTechnical, localStorage persist across remount, throws-outside, optional-null).
- `frontend/src/lib/termMap.ts` — `TERM_MAP as const satisfies Record<string, Term>` (18 rows, Surfaces A–D) + `TermKey` + `usePlainLabel` (unknown-key passthrough).
- `frontend/src/lib/PlainLabel.tsx` — `<PlainLabel term showHelper?>` escaped text + inlined `InfoHint` ⓘ (mirrors PhaseFormPanel).
- `frontend/src/lib/__tests__/termMap.test.tsx` — 11 cases (round-trip, contract guard `technical === shipped string` loop + key-set equality, unknown-key passthrough, PlainLabel default/toggle/helper/no-helper).
- `frontend/src/App.tsx` — import + wrap `<CitationNavProvider>` block in `<TechnicalNamesProvider>`.
- `frontend/src/components/admin/ControlRoomPage.tsx` — `useState(false)` → `useTechnicalNames()`; 4 closures → `toggleTechnical`; leaf threads unchanged.
- `frontend/src/components/admin/__tests__/ControlRoomPage.test.tsx` — `renderPage()` wrapped in `<TechnicalNamesProvider>`.

## Decisions Made
- **Shared context, not a bare hook** — followed the plan's explicit #1-failure-mode guidance; copied `citationNav.tsx` for sharing, `useTheme.ts` for persistence only (dropped `matchMedia`).
- **InfoHint inlined in PlainLabel.tsx** — the shipped `InfoHint` in `PhaseFormPanel.tsx` is a file-local, non-exported function, and PhaseFormPanel is outside this plan's declared 8-file scope. Rather than exporting from a non-scoped file (scope creep) or building a new popover (D-03: don't reinvent ⓘ), the same 12-line native-`title`/tabbable-span primitive is mirrored inline with an explanatory comment. Same visual + a11y contract; exact file scope preserved.
- **termMap `technical` = verbatim shipped strings** — verified against live source: `DocumentStatusBadge.tsx:16-27` (Extracting/Chunking/Embedding/Extracting metadata + pending/processing/completed/failed), `DocumentDetailPanel.tsx:230` ("Metadata"), `SettingsPage.tsx:855` ("Search & Retrieval"), `MessageInput.tsx:327,337,345` (General/Explorer). The contract-guard test loops every row.

## Deviations from Plan
None — plan executed exactly as written. (The inlined `InfoHint` is not a deviation: the plan's Task 2 action calls for "the `InfoHint` ⓘ (reused from PhaseFormPanel)"; reuse-by-import was impossible because it is not exported and PhaseFormPanel is out of scope, so the identical primitive is mirrored — noted under Decisions.)

## Issues Encountered
None. All three touched suites green on first GREEN run; tsc at exactly the 30-error SEED-056/049 baseline (0 net-new); vite build exit 0.

## Verification / Gates
- **Tests:** `TechnicalNamesProvider.test.tsx` 6/6, `termMap.test.tsx` 11/11, `ControlRoomPage.test.tsx` 7/7 — 24/24 green across the 3 touched suites.
- **tsc gate:** `npx tsc -b` = exactly **30** pre-existing SEED-056/049 `error TS` lines (0 net-new); zero errors reference `TechnicalNamesProvider`/`termMap`/`PlainLabel`.
- **build gate:** `npx vite build` exit **0**.
- **Contract-Safety Recipe (D-05a):** `git diff --name-only c9f3cf2b..HEAD | grep -E '^backend/|^supabase/migrations/'` → **NOTHING**; every changed file is under `frontend/src/`. Zero backend / migration / enum / API-field / audit-action rename. Deep Mode byte-identical by construction.
- **Acceptance greps:** `createContext` present; `matchMedia` absent; `technical-names` present; `as const satisfies` present; `dangerouslySetInnerHTML` absent from PlainLabel; `setShowTechnical` == 0 and `useTechnicalNames(` == 1 in ControlRoomPage; `TechnicalNamesProvider` in App.tsx.

## Known Stubs
None. `termMap.ts` values are the intended display copy, not placeholders. The provider default `false` is the D-01-specified plain default, not a stub. The Wave-2 relabel surfaces (DocumentStatusBadge, DocumentDetailPanel, MessageInput, SettingsPage) are intentionally NOT wired here — they attach to this spine in later 154 plans (D-04b bounded scope); the plan's `files_modified` deliberately excludes them.

## Next Phase Readiness
- The spine is complete: Wave-2 relabel surfaces + the Settings "Show technical names" toggle can now `import { usePlainLabel, PlainLabel } from "@/lib/termMap"` and `useTechnicalNames`/`useTechnicalNamesOptional` from the provider.
- LANG-01 stays OPEN at the requirement level pending the Wave-2 surface relabels + live UAT (false-green avoidance, per the 148–153 convention).
- No operator setup, no migration, no cloud parity generated (frontend-only).

## Self-Check: PASSED

- Created files verified present: `TechnicalNamesProvider.tsx`, `termMap.ts`, `PlainLabel.tsx`, + 2 test files — all FOUND.
- Task commits verified in git log: `9b68e049`, `20ce3a78`, `22e26860`, `a7db00e4`, `5f108a9e` — all FOUND.

---
*Phase: 154-plain-language-layer*
*Completed: 2026-07-15*

---
phase: 117-document-relationships-panel-ui
plan: 04
subsystem: ui
tags: [frontend, react, typescript, tailwind, shadcn, document-relationships, REL-02, panel-ui, a11y, wcag]

# Dependency graph
requires:
  - phase: 117-03
    provides: "RelType / RelationshipRow / RelatedDocumentsResponse / Relationship TS types (masked-row nullable document_id) + listRelationships / createRelationship / deleteRelationship client fns — the typed seam this plan's components consume"
  - phase: 112
    provides: "DocumentDetailPanel shell (the right-side push/split panel + mobile bottom-sheet + panel-AA tokens + onReconcile posture) + PanelSection accordion (count/warn badge, real <button aria-expanded aria-controls>); the shell reserved the Relationships slot"
  - phase: 116
    provides: "POST /document-relationships (visible-both gate, idempotent) + DELETE /{id} (own-scoped, 404-tolerant) the create/remove call; _INVERSE_LABEL + _NO_ACCESS_MASK vocabulary the chips/mask mirror"
provides:
  - "RelationshipsSection component — the in-panel grouped-by-direction relationships accordion section (Outgoing then Incoming, inverse labels, masked rows, honest states, local re-fetch); mounted into DocumentDetailPanel after the Metadata section"
  - "CreateLinkDialog component — the MoveToFolderDialog shell with the plain Select swapped for a bespoke type-first typeahead combobox (per-type candidate exclusion, APG roles wired by hand)"
  - "relationshipLabels.ts — the inverse-label display mirror (OUTGOING_LABEL / INCOMING_LABEL, 1:1 with the backend _INVERSE_LABEL keys) + REL_TYPES order"
  - ".rel-x-touch coarse-pointer always-on utility (index.css) — the remove-✕ touch-reachability a11y fix"
affects: [document-detail-panel, 118-auto-classification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Locally-owned section fetch — RelationshipsSection owns its OWN listRelationships fetch keyed on docId (NOT IngestionPage's onReconcile/loadDocuments; relationships are not on the document row), re-fetched on mount + after every mutation (D-117-9 re-fetch-not-optimistic, no Undo)"
    - "Inverse-label display mirror keyed by the closed RelType union (relationshipLabels.ts) — a renamed/new backend rel_type forces a compile-time update, never silent drift (D-117-6)"
    - "Bespoke APG combobox wired by hand (no cmdk): role=combobox + aria-expanded/controls/activedescendant on the input, role=listbox + role=option + per-option id — the roles the shadcn Select gave for free, re-supplied after the Select→typeahead swap (D-117-3)"
    - "Coarse-pointer always-on remove control (.rel-x-touch @media(pointer:coarse)) + fine-pointer hover/focus-within/focus-visible reveal — the audit's #1 a11y fix (WCAG 2.4.7); touch/bottom-sheet has no hover"
    - "Honest-states matrix on a trust-load-bearing surface: empty (calm) ≠ loading (role=status skeleton, no layout jump) ≠ error (role=alert) ≠ masked (no-access mask, never id/title); each a distinct render (D-117-10)"

key-files:
  created:
    - frontend/src/components/relationships/RelationshipsSection.tsx
    - frontend/src/components/relationships/CreateLinkDialog.tsx
    - frontend/src/components/relationships/relationshipLabels.ts
    - frontend/src/components/relationships/RelationshipsSection.test.tsx
    - frontend/src/components/relationships/RelationshipsSection.a11y.test.tsx
    - frontend/src/components/relationships/CreateLinkDialog.test.tsx
  modified:
    - frontend/src/components/metadata/DocumentDetailPanel.tsx
    - frontend/src/components/metadata/DocumentDetailPanel.a11y.test.tsx
    - frontend/src/index.css

key-decisions:
  - "The PanelSection count badge is driven by a relTotal state lifted up from RelationshipsSection via an onTotalChange callback (the section owns the fetch, the panel owns the badge slot); reset to null on doc.id change so a stale count never shows during the new doc's fetch."
  - "A post-mutation re-fetch shows a transient ↻ updating (role=status) and KEEPS the prior list visible (a 'silent' re-fetch) rather than dropping back to the initial skeleton — a remove doesn't blank the whole section, but the list still re-fetches the server's truth (no optimistic splice)."
  - "On a silent (post-mutation) re-fetch failure the section surfaces the honest error rather than a stale-but-green list — no-green-without-truth over UI smoothness."
  - "Per-type candidate exclusion (D-117-4) is computed client-side from the existingOutgoing rows passed in as a prop from RelationshipsSection (no extra fetch — the section already has them); switching the rel-type chip clears any now-excluded chosen target and re-derives the set."

patterns-established:
  - "In-panel accordion section that owns its own fetch lifecycle (mount + per-mutation re-fetch) + lifts a count to the host PanelSection — the template Phase 118's Classification section follows in the same shell"
  - "Bespoke type-first typeahead combobox inside the reused shadcn Dialog (focus-trap/restore free) with hand-wired APG roles — the reusable pattern for any future Select→typeahead swap in the panel family"

requirements-completed: [REL-02]

# Metrics
duration: 10min
completed: 2026-06-20
---

# Phase 117 Plan 04: Document Relationships Panel UI (REL-02) Summary

**The user-facing Relationships surface, built INSIDE the existing Phase 112 DocumentDetailPanel (not a new surface): a chip-led grouped-by-direction `RelationshipsSection` (Outgoing then Incoming, inverse labels mirrored 1:1 from the backend, masked "no access" rows, honest empty/loading/error states, local re-fetch-not-optimistic with no Undo, touch-reachable remove ✕) + a type-first `CreateLinkDialog` (the MoveToFolderDialog shell with the plain Select swapped for a bespoke APG-wired typeahead combobox, per-type candidate exclusion) — honoring every locked G-2 sketch decision; tsc clean, zero new deps, net-new test failures = 0.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-20T19:31:19Z
- **Completed:** 2026-06-20T19:40:53Z
- **Tasks:** 3
- **Files created:** 6 · **Files modified:** 3

## Accomplishments

- **`RelationshipsSection`** (Task 1) — the in-panel relationships surface honoring sketch 034-A:
  - **Grouped by direction** (D-117-5): two fixed subgroups, **Outgoing** then **Incoming**, each with a count subheader. Each row = a rel-type chip (verb word + per-type colour dot) + filename + remove ✕.
  - **Inverse labels mirrored 1:1 from the backend** (D-117-6, `relationshipLabels.ts`): outgoing chips show the verb verbatim ("Supersedes"), incoming chips show the inverse ("Superseded by" / "Amended by" / "Referenced by" / "Has attachment") — keyed by the closed `RelType` union so a backend rename forces a compile-time update, never invented in the client.
  - **Masked "no access" rows** (D-117-8): a `document_id === null` row renders the verbatim mask string italic via the **panel-AA token** (never an id/title), and **still carries a remove ✕** (you own the edge from either end — D-117-2).
  - **Re-fetch-not-optimistic, NO Undo** (D-117-9): create/remove call the authoritative `listRelationships` again; a transient `↻ updating` (`role=status`) beat keeps the prior list visible during the silent re-fetch; there is no optimistic splice and no Undo control anywhere.
  - **Honest state set** (D-117-10): empty ("No relationships yet" + inline `+ Add link`, calm — not an error) ≠ loading (quiet `role=status` skeleton, no layout jump) ≠ error ("Couldn't load relationships", `role=alert` + a Try again retry).
- **`CreateLinkDialog`** (Task 2) — the create-link picker honoring sketch 035-A:
  - **Keeps the `MoveToFolderDialog` shell** (Dialog + confirm + error line + reset-on-open + loading beat) and **swaps only the plain `Select`** for a **type-first** composition: rel-type segmented chips on top, then a bespoke searchable typeahead over `listDocuments()`, a live "this `<verb>` → X" preview, and a confirm disabled until a target is chosen.
  - **Per-type candidate exclusion** (D-117-4): self always hidden; docs already linked OUTGOING with the currently-selected `rel_type` hidden; **switching the rel-type chip re-derives** the candidate set (a doc you already "supersede" reappears as a valid "references" target) and clears a now-excluded chosen target. An honest "N already linked with this type — hidden so every pick is actionable" note updates with the type.
  - **Net-new APG combobox a11y wired by hand** (no cmdk dep): `role="combobox"` + `aria-expanded`/`aria-controls`/`aria-activedescendant` on the input, `role="listbox"` on the list, `role="option"` + a unique id per candidate; ArrowUp/Down move the highlight (= the active descendant). The input stays INSIDE the shadcn Dialog so focus-trap + restore come free.
- **Panel mount** (Task 3) — a second `<PanelSection title="Relationships" count={relTotal}>` renders **after** the Metadata section in `DocumentDetailPanel`; the section owns its own fetch and lifts its total up for the count badge (reset on `doc.id` change). The Metadata section, panel shell, mobile bottom-sheet, close/focus handling, and `IngestionPage` are untouched.
- **The a11y contract the fidelity audit locked, shipped as truth:** the remove ✕ is keyboard-operable (`:focus-visible`) AND always visible on coarse-pointer/touch (the `.rel-x-touch @media(pointer:coarse)` rule in `index.css` — the audit's #1 fix, since the `<768px` bottom-sheet has no hover); icon-only controls carry a full-target `aria-label`; loading is `role=status`, error is `role=alert`; all meaningful copy uses the panel-scoped AA token, never the global muted (3.59:1).

## Task Commits

Each task was committed atomically:

1. **Task 1: RelationshipsSection (grouped render, inverse labels, masked rows, honest states, local re-fetch) + 2 tests + index.css a11y fix** — `fa90f932` (feat)
2. **Task 2: CreateLinkDialog test (per-type exclusion + re-derive + disabled-until-target + error line)** — `361bbb18` (test) _(the CreateLinkDialog component itself shipped in the Task-1 commit because RelationshipsSection imports it and Task 1's a11y test exercises its combobox roles — see Deviations)_
3. **Task 3: Mount the Relationships PanelSection into DocumentDetailPanel** — `d3df332b` (feat)

**Plan metadata:** _(this docs commit)_

## Files Created/Modified

- `frontend/src/components/relationships/RelationshipsSection.tsx` (NEW, ~290 lines) — the grouped section + row/group/add-link subcomponents + local fetch/re-fetch + honest states.
- `frontend/src/components/relationships/CreateLinkDialog.tsx` (NEW, ~280 lines) — the type-first typeahead dialog.
- `frontend/src/components/relationships/relationshipLabels.ts` (NEW) — `OUTGOING_LABEL` / `INCOMING_LABEL` / `relLabel()` / `REL_TYPES` (the D-117-6 mirror).
- `frontend/src/components/relationships/RelationshipsSection.test.tsx` (NEW) — grouped render + inverse labels + honest-states matrix + masked row + re-fetch/no-Undo (15 tests with the a11y file).
- `frontend/src/components/relationships/RelationshipsSection.a11y.test.tsx` (NEW) — vitest-axe across populated/empty/loading/error/masked + combobox roles + remove reachability.
- `frontend/src/components/relationships/CreateLinkDialog.test.tsx` (NEW) — per-type exclusion + re-derive + disabled-until-target + error line (7 tests).
- `frontend/src/components/metadata/DocumentDetailPanel.tsx` (MOD) — import + `relTotal` state + reset effect + the Relationships `PanelSection` after Metadata.
- `frontend/src/components/metadata/DocumentDetailPanel.a11y.test.tsx` (MOD) — mock the new `listRelationships`/`listDocuments` so the mounted section settles deterministically (Rule 3, see Deviations).
- `frontend/src/index.css` (MOD) — the `.rel-x-touch` coarse-pointer always-on utility.

## Decisions Made

- **Count badge driven by lifted state, reset on doc change.** `RelationshipsSection` owns the fetch and reports its total via `onTotalChange`; the panel stores it in `relTotal` for the `PanelSection count` badge and resets it to `null` on `doc.id` change so a stale count never shows during the next doc's fetch.
- **Silent post-mutation re-fetch keeps the prior list visible** under a `↻ updating` (`role=status`) beat rather than dropping to the initial skeleton — a remove doesn't blank the section, but the list still re-fetches the server's truth (no optimistic splice, no Undo).
- **A silent re-fetch failure surfaces the honest error** (no-green-without-truth) rather than leaving a stale-but-green list.
- **Per-type exclusion computed from the `existingOutgoing` prop** (passed from the section, which already has the rows) — no extra fetch; the exclusion is clarity-only, with the backend idempotent-create as the correctness backstop (D-117-4 / D-116-6).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `CreateLinkDialog.tsx` shipped in the Task-1 commit, not the Task-2 commit**
- **Found during:** Task 1.
- **Issue:** Task 1's `RelationshipsSection` **imports** `CreateLinkDialog` (the `+ Add link` opens it), and Task 1's a11y test asserts the dialog's combobox roles. The component had to exist for Task 1 to compile and for its tests to pass — but the plan lists `CreateLinkDialog.tsx` under Task 2.
- **Fix:** Built `CreateLinkDialog.tsx` during Task 1 and included it in the Task-1 commit (the natural dependency order); its dedicated `CreateLinkDialog.test.tsx` is the Task-2 commit. No scope change — both files ship, both gates pass.
- **Files modified:** `frontend/src/components/relationships/CreateLinkDialog.tsx` (in `fa90f932`).
- **Verification:** `npm run test -- RelationshipsSection` (15 green, incl. the combobox-role assertions) + `npm run test -- CreateLinkDialog` (7 green); `tsc --noEmit` EXIT 0.

**2. [Rule 1 - Bug] Mocked the new api calls in the existing `DocumentDetailPanel.a11y.test.tsx`**
- **Found during:** Task 3.
- **Issue:** Mounting `RelationshipsSection` into the panel made the existing a11y test fire the **real** `listRelationships`/`listDocuments` (unmocked), which rejected → the section rendered a second `role="alert"` ("Couldn't load relationships") and a transient `role="status"`. Two of the panel's Metadata-focused tests broke: `findByRole("alert")` found **multiple** alerts; the save-receipt test's `queryByRole("status")` precondition collided with the section's loading skeleton.
- **Fix:** Added `listRelationships`/`listDocuments` to the test's partial api mock, resolving to an **empty** relationships payload so the section settles to ready-empty with no stray status/alert (the exact pattern the file already uses for `listMetadataFields`/`updateDocumentMetadata`).
- **Files modified:** `frontend/src/components/metadata/DocumentDetailPanel.a11y.test.tsx` (in `d3df332b`).
- **Verification:** `npm run test -- DocumentDetailPanel.a11y` → 7/7 green; the full Task-3 gate `npm run test -- DocumentDetailPanel RelationshipsSection CreateLinkDialog` → 29/29 green.

---

**Total deviations:** 2 auto-fixed (1 blocking dependency-order, 1 test-collision bug introduced by the new mount — both in-scope, directly caused by this plan's changes). No architectural changes; no user decisions required.

## Threat-Model Adherence

All five plan-register threats are satisfied by construction:

- **T-117-04-01 (Tampering / client XSS in the filename render):** mitigated. Filenames render as React text children (escaped by default) — `grep` confirms zero `dangerouslySetInnerHTML` in the new components. The masked row renders the constant mask string from the read payload, never server HTML.
- **T-117-04-02 (Info Disclosure / masked-row id leak):** mitigated. A masked row's `document_id` is `null` (the type enforces it); the UI renders only `filename` (the mask string), never an id/title — asserted by `RelationshipsSection.test.tsx` ("renders the mask string and never leaks an id, but stays removable") and the a11y masked-state test.
- **T-117-04-03 (Elevation / client candidate-exclusion bypass):** accept. The client exclusion is clarity-only (D-117-4); the backend POST visible-both gate (uniform 422) + idempotent create (D-116-6) are the real correctness/access gate. A bypassed stale candidate is a no-op or a uniform 422, never a leak.
- **T-117-04-04 (a11y / remove-✕ unreachable on touch/keyboard):** mitigated. `:focus-visible` + the `.rel-x-touch @media(pointer:coarse)` always-on rule; combobox APG roles wired by hand; verified by `RelationshipsSection.a11y.test.tsx` (no AA violations across all states + the remove control queryable by role+name + combobox roles exposed).
- **T-117-04-SC (Tampering / package installs):** accept — vacuously clean. The typeahead is bespoke (no cmdk); `git diff frontend/package.json` is empty.

## Known Stubs

None. Both components are fully wired to the live Plan-03 client seam (`listRelationships` / `createRelationship` / `deleteRelationship`) and the live Phase-116 write surface. The masked-row null guard, the inverse-label mirror, and the per-type exclusion are all load-bearing real behavior, not placeholders. (The typeahead `placeholder="Search documents…"` attribute is a real input affordance, not a stub.)

## Verification

- **`cd frontend && npx tsc --noEmit` clean (EXIT 0)** on the final committed state.
- **All plan tests green:** `npm run test -- DocumentDetailPanel RelationshipsSection CreateLinkDialog` → **29/29** across 4 files (15 RelationshipsSection [render + honest states + masked + re-fetch/no-Undo + a11y/axe + combobox roles + remove reachability] + 7 CreateLinkDialog [per-type exclusion + re-derive + disabled-until-target + create + error line] + 7 DocumentDetailPanel.a11y, still green).
- **Task acceptance greps:** Task 1 — `Outgoing|Incoming` present (grouped), all 4 incoming inverse labels present, coarse-pointer rule present (`.rel-x-touch` + `@media (pointer: coarse)`), remove control has `aria-label`. Task 2 — `role="combobox"` (2), `role="listbox"`/`role="option"`/`aria-activedescendant` (5 ≥ 3), `Dialog` imported, **zero** `@/components/ui/select` import, **no cmdk**. Task 3 — `RelationshipsSection` mounted (2), `Relationships` title present (7).
- **Net-new test failures = 0 (baseline-matched):** the full vitest suite ran **17 failed / 828 passed / 845 total across 7 failed files** — the failing-file roster (`model-info`, `MessageItem`, `Plan04.frontend` [= Phase 075.1, NOT 117], `StreamsProvider.dedup`, `streamsProvider`, `streamsProvider_075_9_clientkey`, `useMessages`) is **identical** to the baseline documented in `117-03-SUMMARY.md` (all pre-existing streaming/chat/provider/model-info tests; none touch relationships or the panel). Pass count rose 806 → 828 (+22 = the new tests); passed files 76 → 78 (both new test files green + the modified panel a11y test green).
- **No new package, no new migration, no backend change.** `git diff frontend/package.json` empty; `threads.py` and `IngestionPage.tsx` untouched (G-5 — this plan is frontend-only); no file deletions in any commit.

## Threat Flags

None — this plan introduces no new network endpoint, auth path, file-access pattern, or trust-boundary schema change. It is a pure frontend consumer of the existing leak-safe Plan-03 client seam + Phase-116 write surface; the masked-row null guard and React text-escaping are the only trust-boundary touchpoints and both are covered by the plan's threat register above.

## Next Phase Readiness

- **REL-02 is delivered** end-to-end: the detail panel lists outgoing + incoming typed links with masked "no access" rows (SC#1), supports create via the type-first typeahead picker + remove either-direction with live re-fetch (SC#2), and meets the Deep Midnight / panel-AA / WCAG-2.1-AA + honest-states contract — vitest-axe clean (SC#3).
- **Phase 118 (Auto-Classification)** adds a `Classification` accordion section to the SAME `DocumentDetailPanel` shell; the in-panel-section-owns-its-own-fetch + lift-count-to-PanelSection pattern established here is the template it follows.
- **Deferred to verify-phase (per VALIDATION.md / CONTEXT):** the G-4 lived-experience UI UAT (open panel → grouped sections + masked row → create via typeahead → remove either-direction → live re-fetch → mobile bottom-sheet) and the **two-user live leak proof** (D-117-8 — verify LIVE in secure-phase, not via the type/RLS label, per the D-102/D-110-5 "static would false-green" lesson). These are operator-driven and out of this plan's automated scope.

## Self-Check: PASSED

- Files verified present: `RelationshipsSection.tsx`, `CreateLinkDialog.tsx`, `relationshipLabels.ts`, `RelationshipsSection.test.tsx`, `RelationshipsSection.a11y.test.tsx`, `CreateLinkDialog.test.tsx` (all under `frontend/src/components/relationships/`), the modified `DocumentDetailPanel.tsx` + `DocumentDetailPanel.a11y.test.tsx` + `index.css`, and this SUMMARY.
- Commits verified in git log: `fa90f932` (feat — RelationshipsSection + CreateLinkDialog + a11y CSS), `361bbb18` (test — CreateLinkDialog), `d3df332b` (feat — panel mount).

---
*Phase: 117-document-relationships-panel-ui*
*Completed: 2026-06-20*

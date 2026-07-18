---
phase: 154-plain-language-layer
plan: 02
subsystem: ui
tags: [react, plain-language, two-audience, term-map, documents, ingestion, vitest, a11y]

# Dependency graph
requires:
  - phase: 154-plain-language-layer (Plan 01)
    provides: "TechnicalNamesProvider shared reveal context + termMap.ts / usePlainLabel + the ingest.*/status.*/doc.metadata_section term-map keys (technical side = today's verbatim strings)"
provides:
  - "DocumentStatusBadge routed through usePlainLabel — plain ingestion step/status labels by default (Waiting / Working… / Splitting into sections / Making it searchable / Ready / Couldn't process), today's technical words under the reveal toggle; styles[status] stays enum-keyed"
  - "DocumentDetailPanel 'Metadata' section header relabeled via the term-map (Details by default, Metadata under the reveal)"
affects: [154-03-settings-composer-relabels, 155-a11y, DocumentStatusBadge, DocumentDetailPanel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Compute ONE term key unconditionally, then call usePlainLabel once (hooks can't be conditional): processing → ingest.<step> when mapped else status.processing; otherwise status.<status>"
    - "Display-only relabel: route the label through the term-map while the ENUM (status/ingestionStep) keeps driving style/behavior lookups (D-02a / T-154-01)"

key-files:
  created: []
  modified:
    - frontend/src/components/ingestion/DocumentStatusBadge.tsx
    - frontend/src/__tests__/components/DocumentStatusBadge.test.tsx
    - frontend/src/components/metadata/DocumentDetailPanel.tsx
    - frontend/src/components/metadata/DocumentDetailPanel.a11y.test.tsx

key-decisions:
  - "styles[status] + the spinner gate stay keyed on the raw status enum — color class byte-identical across reveal states (proven by a dedicated test)"
  - "Deleted the now-unused ingestionStepLabel switch — its strings now live in TERM_MAP as the technical side (single source, no drift)"
  - "The unknown-processing-step path falls back to the plain status.processing label ('Working…'), never a raw key"

patterns-established:
  - "Surface relabel = attach to the 154-01 spine (import usePlainLabel + TERM_MAP + TermKey from @/lib/termMap); no new hook signatures invented"

requirements-completed: [LANG-01]

# Metrics
duration: 8min
completed: 2026-07-15
---

# Phase 154 Plan 02: Document Surfaces Plain-Language Relabel Summary

**The two highest-jargon DOCUMENT surfaces now read plainly by default — the ingestion status badge (RESEARCH rank 1: every uploader sees it, formerly RAW "Chunking"/"Embedding"/enum text) and the document-detail "Metadata" header (rank 2) — both routed through the Wave-1 term-map so they flip plain⇄technical off the shared reveal context, with the underlying status/step enums and enum-keyed styling untouched.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-15T15:39:57Z
- **Completed:** 2026-07-15T15:48:00Z
- **Tasks:** 2 (Task 1 TDD RED→GREEN; Task 2 auto + 1 auto-fix)
- **Files modified:** 4 (2 source + 2 test)

## Accomplishments
- **Surface A (DocumentStatusBadge ⭐):** the DISPLAY label now flows through `usePlainLabel`. Reveal OFF (default) shows plain copy — `pending`→"Waiting", `processing`→"Working…", `processing`+`chunking`→"Splitting into sections", `embedding`→"Making it searchable", `completed`→"Ready", `failed`→"Couldn't process". Reveal ON (inside `<TechnicalNamesProvider>`, localStorage `technical-names="true"`) shows today's technical strings verbatim ("pending"/"processing"/"completed"/"failed", "Chunking", "Embedding"). The `styles[status]` color lookup + the spinner gate stay keyed on the raw `status` enum — a dedicated test asserts the color class is byte-identical across reveal states (T-154-01).
- **Surface B (DocumentDetailPanel):** the `<PanelSection title="Metadata">` header is now `title={usePlainLabel("doc.metadata_section")}` — "Details" by default, "Metadata" under the reveal. ConfidenceChip words left untouched (already honest/plain, Phase 112) — the diff is only the header line + the import.
- **Contract safety (D-05a):** zero backend/migration files touched; every changed file under `frontend/src/`; no enum/API-field/audit-action string renamed. Deep Mode byte-identical by construction.

## Task Commits

Each task was committed atomically (TDD Task 1: test → feat):

1. **Task 1: DocumentStatusBadge plain-by-default ingestion labels** — `84918476` (test RED) → `1bcc27e8` (feat GREEN)
2. **Task 2: DocumentDetailPanel "Metadata" → "Details" header relabel** — `0f2dd7df` (feat, includes the a11y-test auto-fix)

**Plan metadata:** (final docs commit — SUMMARY + STATE + ROADMAP)

## Files Created/Modified
- `frontend/src/components/ingestion/DocumentStatusBadge.tsx` — label routed through `usePlainLabel`; ONE term key computed unconditionally (`ingest.<step>` when mapped while processing, else `status.processing`; otherwise `status.<status>`); `ingestionStepLabel` switch deleted; `styles[status]` unchanged.
- `frontend/src/__tests__/components/DocumentStatusBadge.test.tsx` — 4 default-render assertions updated to plain strings + plain-step + unknown-step-fallback cases; new reveal-ON block (TechnicalNamesProvider + localStorage seed) asserting the raw enums + Chunking/Embedding reappear; enum-keyed color-class guard. Color-class + spinner assertions unchanged. 19/19 green.
- `frontend/src/components/metadata/DocumentDetailPanel.tsx` — `usePlainLabel` import + `title={usePlainLabel("doc.metadata_section")}`.
- `frontend/src/components/metadata/DocumentDetailPanel.a11y.test.tsx` — the 7 role queries that locate the metadata accordion by accessible name updated `/metadata/i`→`/details/i` (the section header is now "Details" by default); the section-header button matcher anchored to `/^details/i`. All 7 a11y assertions preserved. 7/7 green.

## Decisions Made
- **Enum-keyed styling stays the contract:** `styles[status]` and the `status === "processing"` spinner gate read the raw enum, never the label. A dedicated reveal-ON test asserts the `completed` badge's color class is byte-identical to the reveal-OFF render.
- **Deleted `ingestionStepLabel`:** the switch's strings now live in `TERM_MAP` as the `technical` side — a single source, no drift. This is what the plan's Task 1 action explicitly permits.
- **LANG-01 stays OPEN at the requirement level** (false-green avoidance, 148–153 + 154-01 convention): this is Wave 2 of 3; 154-03 (Settings/composer) + live UAT close the requirement. `requirements.mark-complete` deliberately NOT called.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] DocumentDetailPanel a11y suite broke on the plain-default header**
- **Found during:** Task 2 (DocumentDetailPanel "Metadata" → "Details" relabel)
- **Issue:** `DocumentDetailPanel.a11y.test.tsx` (NOT in the plan's declared file set) locates the metadata accordion by its accessible name via 7 `findByRole/getByRole` queries named `/metadata/i`. Because the section header's default is now "Details", all 7 queries failed (6 tests red) — a direct regression from the Task 2 relabel, and after the first fix the section-header button matcher `/details/i` was ambiguous (it also matched the panel's "Close document details" control).
- **Fix:** Updated the 7 accessible-name matchers `/metadata/i`→`/details/i` and anchored the section-header button query to `/^details/i`. Every a11y assertion (accordion button/region roles, aria-expanded/aria-controls, ConfidenceChip words, save/error receipts, reduced-motion) is preserved unchanged.
- **Files modified:** frontend/src/components/metadata/DocumentDetailPanel.a11y.test.tsx
- **Verification:** `npx vitest run DocumentDetailPanel.a11y.test.tsx` — 7/7 green.
- **Committed in:** `0f2dd7df` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — a pre-existing test coupled to the header display string, broken by the in-scope relabel).
**Impact on plan:** Necessary to keep the touched-surface suite green; no scope creep (test-query update only, no assertion weakened, no source behavior change).

## Issues Encountered
None beyond the documented deviation. RED→GREEN cycle for Task 1 behaved exactly as expected (7 label assertions red at RED, all 19 green at GREEN).

## Verification / Gates
- **Tests:** `DocumentStatusBadge.test.tsx` 19/19, `DocumentDetailPanel.a11y.test.tsx` 7/7 — 26/26 green across the 2 touched suites. Non-regression: `termMap.test.tsx` + `GovernancePage.test.tsx` 18/18 green (both reference the touched components).
- **tsc gate:** `npx tsc -b` = exactly **30** pre-existing SEED-056/049 `error TS` lines (0 net-new); zero errors reference `DocumentStatusBadge`/`DocumentDetailPanel`/`termMap`.
- **build gate:** `npx vite build` exit **0**.
- **Contract-Safety Recipe (D-05a):** `git diff --name-only e1d50c59..HEAD` = 4 files, ALL under `frontend/src/`; `grep -E '^backend/|^supabase/migrations/'` → NOTHING. Zero enum/API-field/audit-action rename; Deep Mode byte-identical by construction.
- **Acceptance greps:** `usePlainLabel`(DocumentStatusBadge)=3, `styles[status]`=2, plain-default assertions=5 (≥4); `usePlainLabel("doc.metadata_section")`=1, `title="Metadata"` literal=0.

## Known Stubs
None. The relabeled strings are the intended term-map display copy, not placeholders. Deep expert-config Settings knobs and the composer helpers are 154-03's bounded scope (deliberately not touched here, D-04b).

## Next Phase Readiness
- 154-03 (the remaining Wave-2/3 surfaces: Settings "Show technical names" toggle host + bounded Settings/composer relabels) attaches to the same spine — `import { usePlainLabel, TERM_MAP, type TermKey } from "@/lib/termMap"`.
- LANG-01 stays OPEN pending 154-03 + live UAT (the two-audience document surfaces are the highest-value proof; cross-provider is N/A — this is a static display layer).
- No operator setup, no migration, no cloud parity generated (frontend-only).

## Self-Check: PASSED

- Modified files verified present: `DocumentStatusBadge.tsx`, `DocumentStatusBadge.test.tsx`, `DocumentDetailPanel.tsx`, `DocumentDetailPanel.a11y.test.tsx` — all FOUND.
- Task commits verified in git log: `84918476`, `1bcc27e8`, `0f2dd7df` — all FOUND.

---
*Phase: 154-plain-language-layer*
*Completed: 2026-07-15*

---
phase: 112-metadata-enrichment-document-detail-panel-manual-edit
plan: 03
subsystem: ui
tags: [react, typescript, vitest, confidence-chip, metadata, tdd, accessibility, lucide-react]

# Dependency graph
requires:
  - phase: 111-metadata-enrichment-extraction-backend
    provides: "documents.metadata._confidence {field_key: 0.0-1.0} map (Phase 111 attach_confidence) — the per-field scores the ConfidenceChip renders"
  - phase: 112-metadata-enrichment-document-detail-panel-manual-edit (Plan 01)
    provides: "PATCH /documents/{id}/metadata endpoint (built in parallel) + GET /metadata-fields — the routes updateDocumentMetadata/listMetadataFields call"
provides:
  - "ConfidenceChip primitive (frontend/src/components/metadata/ConfidenceChip.tsx) — the META-02 honest per-field confidence display contract"
  - "ConfidenceChip Wave-0 vitest suite (8 tests, AC2/AC3 home)"
  - "Extended DocumentMetadata type (_confidence / _source / string index signature)"
  - "Net-new MetadataFieldDef type mirroring backend MetadataFieldResponse"
  - "updateDocumentMetadata + listMetadataFields API-client methods"
affects: [112-04 (document detail panel consumes ConfidenceChip + the two API methods + the extended types), 117-relationships, 118-classification (share the document-detail shell)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ConfidenceChip clones StatusPill anatomy (inline-flex rounded-full font-mono text-[10px], glyph + tabular-nums word), NOT ConfidenceBadge"
    - "Hardcoded D-05 metadata display tiers (TIER={HIGH:0.75,MED:0.50}) kept structurally separate from the retrieval confidence_bucket (0.54/0.38) — load-bearing disambiguation comment"
    - "Honesty contract encoded in code + tests: neutral 'Edited' on manual override (no score/no green), neutral 'Extracted' for unscored (never fabricated 'High'), never-colour-alone (glyph+word always)"
    - "Panel-scoped AA tokens only (--panel-status-done/active, lightened red hsl(0 80% 80%), --panel-muted-foreground) — never global --muted-foreground"
    - "Client never asserts provenance: updateDocumentMetadata body is { field, value } only (server hard-stamps _source)"

key-files:
  created:
    - "frontend/src/components/metadata/ConfidenceChip.tsx"
    - "frontend/src/components/metadata/ConfidenceChip.test.tsx"
  modified:
    - "frontend/src/types/index.ts"
    - "frontend/src/lib/api.ts"

key-decisions:
  - "Typecheck ran via `tsc -b` (project-references build mode, what `npm run build` uses), NOT `tsc --noEmit -p tsconfig.json` — the root tsconfig has files:[] and references app/node configs, so -p the root typechecks nothing. Net-new type errors proven 0 via baseline-stash diff."
  - "RED/GREEN split into two commits per the TDD plan-level gate (test → feat), even though both atoms were authored in one cycle."

patterns-established:
  - "Metadata UI primitives live under frontend/src/components/metadata/"
  - "Honest-by-construction confidence display: provenance and unscored states are NEUTRAL by design and asserted in tests (an edited field renders no score/green; an unscored field never renders 'High')"

requirements-completed: [META-02]

# Metrics
duration: 6min
completed: 2026-06-17
---

# Phase 112 Plan 03: Document Detail Panel Frontend Foundation Summary

**Net-new honest `ConfidenceChip` primitive (hardcoded D-05 tiers High≥0.75/Med≥0.50/Low<0.50, neutral Edited/Extracted states, never-colour-alone) + extended `DocumentMetadata`/`MetadataFieldDef` types + `updateDocumentMetadata`/`listMetadataFields` API-client methods — the contracts Plan 04's panel consumes.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-06-17T21:22:36Z
- **Completed:** 2026-06-17T21:28Z
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- Built `ConfidenceChip` cloning the StatusPill anatomy with the full META-02 honesty contract: scored High/Med/Low chips (glyph + tier WORD + raw 2-decimal score), neutral "Edited" on manual override (no score, no green), neutral "Extracted" for unscored fields (never a fabricated "High"), never-colour-alone in every state, panel-scoped AA tokens only.
- Hardcoded the metadata display tiers (`TIER = { HIGH: 0.75, MED: 0.5 }`) with a load-bearing comment naming them as a separate system from the retrieval `confidence_bucket` (0.54/0.38) — no functional reference to the retrieval buckets.
- Authored the Wave-0 vitest suite (8 tests) asserting tier mapping at 0.96/0.63/0.41 + boundaries (0.75/0.50/0.49), the Edited state renders neither a score nor a success/panel-status-done class, the unscored state renders "Extracted" and never "High", glyph+word in every state, and no "%" anywhere. RED confirmed (import-resolve failure pre-implementation) → GREEN (8/8 pass).
- Extended `DocumentMetadata` (`_confidence` map, `_source` provenance, string index signature for custom keys), added net-new `MetadataFieldDef` (mirrors backend `MetadataFieldResponse`, closed `field_type` vocab), and added `updateDocumentMetadata` (PATCH, body `{ field, value }` only — no client-asserted provenance) + `listMetadataFields` (GET /metadata-fields) cloning the `moveDocument` shape.

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): ConfidenceChip Wave-0 failing test** - `7794aeb2` (test)
2. **Task 1 (GREEN): ConfidenceChip primitive** - `574ebe0e` (feat)
3. **Task 2: DocumentMetadata + MetadataFieldDef + 2 API methods** - `0fbab69e` (feat)

**Plan metadata:** committed separately by the orchestrator (this SUMMARY).

## Files Created/Modified
- `frontend/src/components/metadata/ConfidenceChip.tsx` - Net-new META-02 display primitive: hardcoded tiers, honest neutral states, glyph+word+raw-score, panel-scoped AA tokens.
- `frontend/src/components/metadata/ConfidenceChip.test.tsx` - 8-test Wave-0 suite (tier mapping, honesty contract, never-colour-alone, no-%).
- `frontend/src/types/index.ts` - Extended `DocumentMetadata` (`_confidence`/`_source`/index signature); net-new `MetadataFieldDef`.
- `frontend/src/lib/api.ts` - `updateDocumentMetadata` + `listMetadataFields`; `MetadataFieldDef` added to the type import.

## Checks: what ran green vs skipped (honest report)

- **vitest (ConfidenceChip.test.tsx):** GREEN — 8/8 pass. RED→GREEN cycle verified (import-resolve failure before the component existed, then full pass).
- **tsc (type-check):** RAN via `tsc -b --noEmit` (build mode — the root `tsconfig.json` is a project-references shell with `files: []`, so `-p tsconfig.json` typechecks nothing; build mode is what `npm run build` uses). **Zero net-new type errors** introduced by this plan: a baseline-stash diff (`comm -13` of error signatures with vs without the Task 2 changes) returned empty. The 44 pre-existing error signatures are SEED-056 frontend type/test rot in unrelated files (NavPanel, FilesSection.test, FilePreview.test, MemorySection, SkillFormDialog, api.test.ts, SettingsPage, StreamsProvider, streamsStore) — none implicate my 4 files. Out of scope per the scope boundary.
- **eslint (my 4 files):** GREEN — `eslint` on the 4 changed files exits 0 with no findings.
- **Full vitest suite:** NOT run (the plan's automated verify is scoped to the ConfidenceChip test + tsc; the full suite carries the known SEED-056 rot and was not required by the plan's verification block).

## Decisions Made
- **tsc invocation:** Used `tsc -b --noEmit` instead of the plan's literal `tsc --noEmit -p tsconfig.json` because the root tsconfig is a references shell (`files: []`) — `-p` against it typechecks no source. Build mode is the project's real typecheck (`npm run build` = `tsc -b && vite build`). Net-new errors proven 0 by baseline-stash diff rather than by a raw count (per the SEED-056 / `project_frontend_vitest_rot` guidance: prove net-new via baseline, not raw count).
- **TDD commit split:** Authored the test and component in one cycle but committed them as separate `test(...)` (RED) and `feat(...)` (GREEN) commits to honor the plan-level TDD gate sequence.

## Deviations from Plan
None — plan executed exactly as written. (The `tsc -b` vs `tsc -p` choice is a verification-mechanism clarification, not a code deviation; the AC intent — "no new type errors introduced" — is met and proven.)

## Issues Encountered
- The acceptance-criterion grep "ConfidenceChip.tsx does NOT reference `confidence_bucket` / `0.54` / `0.38`" superficially matches the *mandated disambiguation comment* (the plan's `<action>` block requires the verbatim comment "These are NOT the retrieval confidence_bucket_high/medium (0.54/0.38)..."). Resolved by confirming there is **zero functional/import reference** — the only occurrence is inside that single `//` comment line, which is exactly what the plan requires. The AC intent (no functional reference) holds.

## TDD Gate Compliance
- RED gate: `test(112-03)` commit `7794aeb2` — failing test landed first (import-resolve failure: component absent). PASS.
- GREEN gate: `feat(112-03)` commit `574ebe0e` after RED — 8/8 tests pass. PASS.
- REFACTOR gate: not needed (clean implementation; no refactor commit).

## Threat surface
No new security-relevant surface introduced beyond the plan's threat model. T-112-03-01 (UX-integrity / fabricating authority) mitigated by hardcoded honest states + load-bearing comments + vitest assertions (edited→no score/green; unscored→never "High"). T-112-03-02 (client asserting provenance) mitigated: `updateDocumentMetadata` body is `{ field, value }` only — no `source` key. T-112-03-03 (field-def disclosure) accepted: `listMetadataFields` is a thin consumer of the already-secured `GET /metadata-fields`.

## Known Stubs
None. The `ConfidenceChip` is fully wired to its props; `updateDocumentMetadata`/`listMetadataFields` hit real backend routes (`PATCH /documents/{id}/metadata` from Plan 01; `GET /metadata-fields` pre-existing). These are foundation contracts consumed by Plan 04's panel — no placeholder/empty-data paths.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 04 (document detail panel) can import `ConfidenceChip`, the extended `DocumentMetadata`/`MetadataFieldDef` types, and `updateDocumentMetadata`/`listMetadataFields` directly — no codebase scavenging for shapes.
- No blockers. The PATCH endpoint (Plan 01, parallel wave) must be live for `updateDocumentMetadata` to function end-to-end; the client method is written against its contract.

## Self-Check: PASSED
- FOUND: frontend/src/components/metadata/ConfidenceChip.tsx
- FOUND: frontend/src/components/metadata/ConfidenceChip.test.tsx
- FOUND (modified): frontend/src/types/index.ts, frontend/src/lib/api.ts
- FOUND commit 7794aeb2 (test RED)
- FOUND commit 574ebe0e (feat GREEN — ConfidenceChip)
- FOUND commit 0fbab69e (feat — types + API methods)

---
*Phase: 112-metadata-enrichment-document-detail-panel-manual-edit*
*Completed: 2026-06-17*

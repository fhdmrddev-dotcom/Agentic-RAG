---
phase: 097-spike-risk-register-template-fill-authoring-feel
plan: 05
subsystem: planning
tags: [spike, docxtpl, template-fill, workflow-schema, go-no-go, cross-provider, living-document, seed-069]

# Dependency graph
requires:
  - phase: 097-02
    provides: "out/field-map.json — cited field-map (unknown a = YES; 100% citation coverage, 0 invented)"
  - phase: 097-03
    provides: "out/risk-register-filled.docx + corruption.log — clean real-editor open + 1/5/20 row growth (unknown b = GO)"
  - phase: 097-04
    provides: "out/transcript.md + unknown-c.md + unknown-d.md — grounding inventory + authoring feel (MIXED)"
provides:
  - "scripts/spike-097/CONCLUSION.md — the spike deliverable: 4-unknown roll-up + operator-confirmed DECISION: GO (go-conditional, 8 conditions) + recommended additive-optional inputs/assets/folder_scope schema shape (the Phase 098 lock candidate) + an OUTPUT-side schema dimension + the Phase 101 UAT seed (6 named pitfalls)"
  - "SEED-069 — living-document feedback loop (workflow output → versioned KB re-ingestion); infra already exists, net-new = thin wiring + provenance flag + scoped manual-upload exception"
affects: [098, 100, 101, 102, 103, 107]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Spike-to-decision synthesis: every CONCLUSION claim cites the out/ artifact that backs it"
    - "Additive-optional schema recommendation (zero-migration) — written to disk only, never committed to harness.py in a spike"

key-files:
  created:
    - .planning/phases/097-spike-risk-register-template-fill-authoring-feel/097-05-SUMMARY.md
  modified:
    - scripts/spike-097/CONCLUSION.md
    - .planning/seeds/SEED-069-living-document-workflow-output-reingestion.md (staged — authored at decision time)

key-decisions:
  - "DECISION: GO — operator-confirmed go-conditional on the docxtpl trusted-template fill path, conditional on Conditions 1-8"
  - "Condition 7 = FULL native roster (all 7 natives + OpenRouter), NOT the SC#10 representative-4 — covers GLM/MiniMax tool-use-drop + DeepSeek/Moonshot reasoning-truncation traps; provider handling at the service boundary"
  - "Condition 8 = living-document feedback loop (optional OUTPUT re-ingestion) — infra already exists (documents.py:402-423/425-449/656), net-new is thin wiring + a derived/source provenance flag + a scoped manual-upload-rule exception; captured as SEED-069"
  - "Recommended schema extended with an OUTPUT-side additive-optional dimension (output_target_folder / reingest_output / version_policy / provenance) as the Phase 098 lock candidate — RECOMMENDATION only, zero-migration"

patterns-established:
  - "Throwaway spike commits NO production surface — schema is a recommendation on disk, no harness.py edit, no migration, no backend/ change"

requirements-completed: []  # SPIKE — closes NO REQ-ID; acceptance = ROADMAP SC#3 (rolls up SC#1/#2/#4)

# Metrics
duration: ~15min (continuation finalize)
completed: 2026-06-09
---

# Phase 097 Plan 05: Spike Go/No-Go Conclusion Summary

**Operator-confirmed `DECISION: GO` (go-conditional, 8 conditions) on the docxtpl trusted-template fill path, with the recommended additive-optional `inputs`/`assets`/`folder_scope` schema shape (plus a new OUTPUT-side dimension) as the Phase 098 lock candidate — and SEED-069 (living-document feedback loop) planted.**

## Performance

- **Duration:** ~15 min (continuation: finalize the decision + close the plan)
- **Completed:** 2026-06-09
- **Tasks:** 2 (Task 1 CONCLUSION draft committed earlier as `f5f174bc`; Task 2 decision checkpoint resolved + finalized this session)
- **Files modified:** 1 (CONCLUSION.md) + 1 staged (SEED-069) + 1 created (this SUMMARY)

## Accomplishments

- **The spike's deliverable is complete (ROADMAP SC#3).** `scripts/spike-097/CONCLUSION.md` carries the full 4-unknown roll-up, the operator-confirmed go/no-go, the recommended schema shape, and the Phase 101 UAT seed — every claim cites its backing `out/` artifact.
- **4-unknown roll-up:** (a) cited field-map = **YES** (100% citation coverage, 0 invented citations, 11% honest decline-rate — `out/field-map.json`); (b) docxtpl fill = **GO** (clean real-editor open, no repair banner, `{%tr %}` grew to 6 rows + clean at 1/5/20 — `out/risk-register-filled.docx` + `out/corruption.log`); (c) authoring grounding = **clear inventory** (folder tree + tool names + template placeholders are MUST-HAVE; `folder_scope` has no schema home → confirms bound PROJ-02 field — `out/transcript.md` + `out/unknown-c.md`); (d) describe→refine→publish feel = **MIXED, non-blocking** (mechanism works; the generator silently guessed on grey areas → two Phase 103 conditions — `out/unknown-d.md`).
- **DECISION: GO finalized** as operator-confirmed `go-conditional`, conditional on **Conditions 1–8**. Conditions 1–6 kept as drafted; **Condition 7 replaced** with the full-native-roster cross-provider version; **Condition 8 added** (living-document feedback loop).
- **Recommended schema shape** confirmed additive-optional (zero-migration) and **extended with an OUTPUT-side dimension** (`output_target_folder`, `reingest_output`, `version_policy`, `provenance`) as the Phase 098 lock candidate. The three open questions are settled: `template_derived` → keep as a `source` enum value; `Cited` provenance → run OUTPUT only; `folder_scope` → BOUND resolved-id list (not a string path).
- **Phase 101 UAT seed** = the six named failure modes (Pitfall 1–6 all clean) + Pitfall 7 (observe-only) + pptx/xlsx deferred-to-101 rows — the pre-named "How we'd know this failed" rows Phase 101 inherits (G-6).
- **SEED-069 planted** — living-document feedback loop (workflow output → versioned KB re-ingestion); the critical framing is that the dedup/versioning/reingest infra ALREADY EXISTS (`backend/app/api/documents.py:402-423` / `:425-449` / `:656`), so net-new is only thin wiring + a `derived/source` provenance flag + a scoped exception to the manual-upload-only rule. Linked to SEED-005 + GOV-02.

## Task Commits

1. **Task 1: Draft CONCLUSION.md** (4-unknown roll-up + go/no-go + recommended schema + UAT seed) — `f5f174bc` (docs, committed prior session)
2. **Task 2: Operator confirms GO + finalize** (DECISION: GO go-conditional + Conditions 1–8 + output-side schema dimension + SEED-069 section) — this session (see plan-close commit below)

**Plan metadata + finalize:** committed as `docs(097-05): finalize GO-conditional (8 conditions) + plant SEED-069 + close spike Plan 05`

## Files Created/Modified

- `scripts/spike-097/CONCLUSION.md` — finalized: confirmed `DECISION: GO` (go-conditional), Conditions 1–8 (7 = full native roster, 8 = living-document loop), OUTPUT-side schema dimension, "Open design item — living-document feedback loop (SEED-069)" section, operator sign-off filled in.
- `.planning/seeds/SEED-069-living-document-workflow-output-reingestion.md` — staged + committed (authored at decision time; not rewritten here).
- `.planning/phases/097-spike-risk-register-template-fill-authoring-feel/097-05-SUMMARY.md` — this file.

## Decisions Made

- **GO is conditional on 8 conditions**, not unconditional. Condition 7 deliberately rejects the SC#10 representative-4 collapse: because the production field-map emission composes the shared provider gateway, the structured-output must be validated across ALL 7 natives (OpenAI, Anthropic, Google, DeepSeek, Moonshot/Kimi, Z.ai/GLM, MiniMax) + OpenRouter, with explicit coverage of the GLM/MiniMax tool-use-drop and DeepSeek/Moonshot reasoning-truncation traps. Provider-specific handling stays at the service boundary; the shared fill path never branches.
- **The output-side schema dimension is a RECOMMENDATION only** (additive-optional, zero-migration). It leverages the already-shipped `documents.py` dedup/versioning/reingest infra; the only genuinely net-new field is `provenance: source|derived` (self-feedback amplification guard).

## Deviations from Plan

None — plan executed as written. The plan's Task 2 was a `checkpoint:decision`; the operator resolved it `go-conditional` with the eight conditions, and this continuation finalized CONCLUSION.md + closed the plan accordingly. The schema extension + SEED-069 reference were explicitly directed by the operator decision.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. (The Phase 101 production adds — `docxtpl==0.20.2` → `backend/Dockerfile.sandbox` + `SANDBOX_IMAGE` bump — are deferred to Phase 101 per Conditions 1–2 and are NOT done here.)

## Next Phase Readiness

- **Phase 097 is now fully executed** — all 5 plans complete (5/5). The spike's deliverable (the operator-confirmed go/no-go + recommended schema shape + UAT seed) exists. **The phase is NOT marked complete here** — that is the orchestrator's verify + complete step. Next action = **phase 097 verification** (`/gsd:verify-work 097`).
- **Phase 098** inherits the additive-optional schema lock candidate (inputs/assets/folder_scope + the new output-side dimension) and Condition 7 (full-native-roster cross-provider validation).
- **Phase 100/101** inherit the trusted-vs-arbitrary fill split (Condition 5), the worded→numeric Score mapping (Condition 3), the sealed-sandbox render + Dockerfile.sandbox add (Conditions 1–2), the six-pitfall UAT seed, and the SEED-069 output-target wiring.
- **Phase 102** inherits the freshness / output-quality gate + the self-feedback amplification guard (SEED-069 provenance).
- **Phase 103** inherits the two unknown-d conditions (grey-area validation loop + tweak→new-version), G-2 sketch-gated.

## Self-Check: PASSED

- `scripts/spike-097/CONCLUSION.md` — FOUND; Task 1 verify re-run after finalize: `CONCLUSION sections OK` (DECISION line + inputs/assets/folder_scope + the 4 artifact refs all present).
- `.planning/seeds/SEED-069-living-document-workflow-output-reingestion.md` — FOUND (staged for commit).
- `.planning/phases/097-spike-risk-register-template-fill-authoring-feel/097-05-SUMMARY.md` — FOUND (this file).
- Task 1 commit `f5f174bc` — FOUND in git log.
- No file written under `backend/` (constraint honored — verified via git status before commit).

---
*Phase: 097-spike-risk-register-template-fill-authoring-feel*
*Completed: 2026-06-09*

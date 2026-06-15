---
phase: 097-spike-risk-register-template-fill-authoring-feel
plan: 02
subsystem: api
tags: [spike, anthropic, forced-tool-use, pydantic, retrieval, docxtpl, citations, risk-register]

# Dependency graph
requires:
  - phase: 097-01
    provides: "scripts/spike-097/ scaffold, docxtpl venv install, {%tr %} risk-register.docx template, out/spike-config.json (bound folder scope + Project Meridian corpus)"
provides:
  - "Answered unknown (a): a strong Claude model DERIVES the risk-register field schema from the template and fills it from bound KB scope, declining (null) rather than inventing, with 100% citation coverage"
  - "scripts/spike-097/field_map.py — the cited RiskRegisterFieldMap Pydantic model (every leaf nullable + Cited provenance) + spotlighted forced-tool prompt + native Anthropic call wrapper (mirrors, never imports, the production service)"
  - "scripts/spike-097/derive_fields.py — the parse→bound-retrieve→forced-emit→deterministic coverage/citation check→re-prompt-once harness (steps 1–4)"
  - "scripts/spike-097/out/field-map.json — the cited evidence artifact (6 KB-grounded risk rows, 50/50 filled values cited, 11% null-rate, 0 invented citations)"
  - "scripts/spike-097/out/unknown-a.md — the written verdict (YES) feeding the future inputs/citations schema design"
affects: [097-03, 097-05, 098, 101, TMPL-02, PROJ-02]

# Tech tracking
tech-stack:
  added: []   # docxtpl already installed in 097-01; no new deps in this plan
  patterns:
    - "Pattern 1 — LLM produces DATA (typed cited field-map), never the file (.docx render is Plan 03)"
    - "Pattern 2 — bound server-side folder_ids from spike-config, not a prompt hint the model can widen"
    - "Cited field-map: every field nullable + per-value source_chunk_id provenance so the model can decline"
    - "Deterministic (no-LLM) coverage+citation gate: every non-null value must cite a chunk that was actually retrieved (invented citation = uncited)"
    - "Spotlight delimiters <doc id=... file=...> around each retrieved chunk (indirect-injection defense)"

key-files:
  created:
    - scripts/spike-097/field_map.py
    - scripts/spike-097/derive_fields.py
    - scripts/spike-097/out/field-map.json
    - scripts/spike-097/out/unknown-a.md
  modified: []

key-decisions:
  - "Forced Anthropic tool_choice on a strong Claude model (claude-opus-4-8) HELD for the nested nullable+citation schema — no OpenAI-strict (A1) pivot needed"
  - "Assign a deterministic per-chunk spotlight id (chunk-N) as the citation source of truth — the enriched retrieval dict exposes no raw document_chunks.id"
  - "Cited provenance lives in run OUTPUT (carries the live source_chunk_id); the future inputs schema only declares shape (confirms RESEARCH Open Question 4)"

patterns-established:
  - "Cite-or-null contract enforced by a deterministic post-pass, with a single re-prompt previewing the production citations_required gate"

requirements-completed: []   # SPIKE — closes NO REQ-ID. Informs (does not close) TMPL-02 + PROJ-02.

# Metrics
duration: 17min
completed: 2026-06-08
---

# Phase 097 Plan 02: Cited Risk-Register Field-Map (unknown a) Summary

**A strong Claude model derives the risk-register field schema from the template and fills it from bound KB scope — 6 KB-grounded risk rows, 100% citation coverage (50/50 filled values cited), 11% null-rate (declines, not inventions), 0 invented citations — answering unknown (a): YES.**

## Performance

- **Duration:** ~17 min
- **Started:** 2026-06-08T23:22:00+04:00
- **Completed:** 2026-06-08T23:40:00+04:00
- **Tasks:** 2
- **Files modified:** 4 (created)

## Accomplishments

- **Built the cited field-map** (`field_map.py`): `RiskRegisterFieldMap` / `RiskRow` / `Cited` Pydantic models with every leaf nullable and carrying `source_chunk_id` provenance, a spotlighted forced-tool prompt, and a native Anthropic call wrapper that **mirrors but never imports** the production service (red line / G-5).
- **Built the derivation harness** (`derive_fields.py`): parse template (coverage oracle) → retrieve under bound `folder_ids` from `spike-config.json` → single forced Anthropic emission → deterministic coverage+citation check → re-prompt-once.
- **Answered unknown (a) with evidence:** the model emitted exactly the 6 risks present in the retrieved chunks (M-01/02/03 from the status report, SR-01/02/03 from the charter) and did **not** fabricate the 4 workshop-table risks (M-04..M-07) it could not see. It declined (`value: null`) on fields the prose didn't cleanly support (11% overall null-rate) instead of inventing.
- **Citation discipline held first try:** 50/50 non-null values carry a `source_chunk_id` that was actually retrieved → 100% coverage, 0 uncited, 0 invented; no re-prompt needed.
- **Provider verdict (A1):** Anthropic native forced tool-use was sufficient for the nested nullable+citation schema — the OpenAI-strict pivot stays documented but unused.

## Task Commits

1. **Task 1: field_map.py — cited Pydantic field-map + forced-tool prompt + Anthropic call** — `f2cc7b3a` (feat)
2. **Task 2: derive_fields.py — parse → bound-retrieve → emit → coverage/citation check → evidence** — `fc791f5f` (feat; includes the Rule 1 truncation fix)

**Plan metadata:** (this commit) `docs(097-02): complete unknown-(a) field-map plan`

## Files Created/Modified

- `scripts/spike-097/field_map.py` — `Cited`/`RiskRow`/`RiskRegisterFieldMap` models, `build_messages` (spotlighted prompt), `emit_field_map` (forced `tool_choice`, native Anthropic), A1 pivot documented.
- `scripts/spike-097/derive_fields.py` — the 4-step harness; assigns `chunk-N` spotlight ids; deterministic `check_coverage`; re-prompt-once; writes both evidence files; model fallback chain + truncation guard.
- `scripts/spike-097/out/field-map.json` — the cited field-map evidence (6 rows, coverage stats, retrieved-chunk index, freshness observation, attempt log).
- `scripts/spike-097/out/unknown-a.md` — the written verdict (YES) with per-field null-rate, citation coverage, provider verdict, and the implication for the production `inputs` schema.

## Decisions Made

- **Strong-model-first:** defaulted to `claude-opus-4-8` (newest flagship) with a registry fallback chain; it answered cleanly, so no cheaper-model or OpenAI-strict comparison was run (single-provider spike by design).
- **Spotlight id as citation truth:** since `retrieval_service._enrich_with_filenames` returns no raw `document_chunks.id`, the harness assigns a deterministic `chunk-N` id per retrieved chunk and the model cites that. Flagged for production: the real `inputs`/citation design should surface a stable chunk id end-to-end.
- **Provenance placement:** confirmed empirically that `Cited` provenance belongs in run output, not the `inputs` declaration (RESEARCH Open Question 4).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Raised `emit_field_map` max_tokens 4096 → 16384 (truncated tool JSON)**
- **Found during:** Task 2 (first harness run)
- **Issue:** The first emission returned `stop_reason: max_tokens` at exactly 4096 output tokens. The forced tool JSON was truncated before the `rows` array completed, so Pydantic's `default_factory=list` silently produced **0 rows** — a false "model declined everything" result.
- **Fix:** Raised the `emit_field_map` default `max_tokens` to 16384 (claude-opus-4-8 supports 128K output), and added a hard truncation guard in `derive_fields.py` (attempt 1 aborts with exit code 2 on a `max_tokens` stop) plus a soft warning on the re-prompt path — so a truncated emission can never pass as a valid empty result.
- **Files modified:** scripts/spike-097/field_map.py, scripts/spike-097/derive_fields.py
- **Verification:** Re-run produced `stop_reason: tool_use` at 4063 output tokens with 6 fully-formed cited rows; plan's Task 2 verify passes (`coverage ok; rows 6 uncited 0`).
- **Committed in:** `fc791f5f` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug).
**Impact on plan:** Necessary for correctness — without it the spike would have reported a false-negative ("model emitted no risks"). No scope creep; the schema and prompt are verbatim per RESEARCH.

## Issues Encountered

- **Thin-but-honest retrieval:** default `top_k=5` surfaced 5 of the 9 embedded chunks (status report + charter + one workshop intro chunk). The workshop-notes *table* (M-04..M-07) was not in the retrieved set, so the model correctly emitted only the 6 risks it could see. This is a faithful bound-retrieval result and a valid finding — documented in `unknown-a.md` and carried to Plan 03/05.

## Known Stubs

None. The `value: null` fields in the field-map are intentional model declines (the desired "decline rather than invent" behavior), not unwired stubs.

## Threat Flags

None — the field-map phase is read-only, introduces no network endpoint or schema change, and adds no security surface beyond the existing `search_documents` bound scope. Threat-model mitigations (T-097-04 spotlight delimiters, T-097-05/07 deterministic citation check, T-097-06 bound folder_ids) are all implemented.

## User Setup Required

None - no external service configuration required (uses existing `backend/.env` keys, name-only).

## Next Phase Readiness

- **Plan 097-03 (unknown b):** `out/field-map.json` is the ready input for the docxtpl render + integrity check; the `score`-is-compute boundary and the spotlight-id→citation flow are confirmed.
- **Plan 097-05 (go/no-go):** unknown (a) = YES is logged; the production `inputs`/citations schema shape recommendation (provenance in output, shape in `inputs`, surface a real chunk id) is captured for the conclusion.
- **Carry-forward:** retrieval exposes no raw `document_chunks.id` — Phase 101's citation design must thread a stable chunk id end-to-end.

---
*Phase: 097-spike-risk-register-template-fill-authoring-feel*
*Completed: 2026-06-08*

## Self-Check: PASSED

- Created files verified present: `field_map.py`, `derive_fields.py`, `out/field-map.json`, `out/unknown-a.md`, `097-02-SUMMARY.md`.
- Task commits verified in git history: `f2cc7b3a` (Task 1), `fc791f5f` (Task 2).
- Plan automated verify passed: Task 1 (`schema OK`, no backend import, `tool_choice` present), Task 2 (`coverage ok; rows 6 uncited 0`).
- No files committed under `backend/`.

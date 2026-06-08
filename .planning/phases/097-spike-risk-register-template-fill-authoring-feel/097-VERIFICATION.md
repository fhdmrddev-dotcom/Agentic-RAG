---
phase: 097-spike-risk-register-template-fill-authoring-feel
verified: 2026-06-09T00:00:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification: false
---

# Phase 097: Spike — Risk-Register Template-Fill + Authoring Feel — Verification Report

**Phase Goal:** De-risk the entire milestone — fill a Risk Register from a real KB folder end-to-end on ONE provider, answering the 4 schema-shaping unknowns BEFORE any production schema is locked.
**Verified:** 2026-06-09
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A throwaway end-to-end run fills a risk-register template from a real KB folder and produces an OPENABLE artifact on one provider, with evidence captured | VERIFIED | `risk-register-filled.docx` re-opened via python-docx (1 table, 7 rows); real-editor open confirmed by operator 2026-06-09 (no repair banner, 6 grown rows, scalar tags filled); `corruption.log` Pitfall 1–6 all clean |
| 2a | The model derived the right fields from the template + KB, declining rather than inventing, with 100% citation coverage | VERIFIED | `field-map.json`: covered_keys==['project_name','report_date','rows'], 6 rows, null_rate=10.71%, citation_coverage_pct=100.0, invented_citation_count=0, uncited_row_count=0 |
| 2b | docxtpl fill produces a clean artifact; {%tr %} table grows correctly at 1/5/20 rows; &<> contained | VERIFIED | `-1.docx`(2 rows), `-5.docx`(6 rows), `-20.docx`(21 rows) all re-open via python-docx; `corruption.log` Pitfall 2 (autoescape &<>): clean; Pitfall 5 (row growth): clean |
| 2c | Authoring-time grounding inventory written — what the NL generator needs | VERIFIED | `unknown-c.md` (>200 bytes): folder tree + tool names + template placeholders = MUST-HAVE; skill registry = nice-to-have; folder_scope seam finding documented |
| 2d | A written GOOD/MIXED/POOR feel verdict on describe→refine→publish | VERIFIED | `unknown-d.md`: rating = MIXED (operator verbatim recorded); two named conditions for GOOD stated (grey-area validation loop + tweak→new-version path) |
| 3 | A written go/no-go on the docxtpl fill path + recommended inputs/assets/folder_scope schema shape | VERIFIED | `CONCLUSION.md`: `DECISION: GO` line present; 8 go-conditional conditions listed; full InputFieldSpec + AssetRef + folder_scope schema recommendation; output-side dimension (output_target_folder/reingest_output/version_policy/provenance) included; three open questions (i–iii) explicitly settled |
| 4 | Failure modes observed are logged as pre-named Phase 101 UAT rows | VERIFIED | `corruption.log`: Pitfall 1–6 each have a row with clean/not-exercised verdict; pptx + xlsx deferred rows present; CONCLUSION.md §4 carries the full Phase 101 UAT seed table |

**Score:** 4/4 success criteria verified (SC#1 through SC#4)

---

## Spike Integrity Check (No Production Surface)

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| No files under `backend/app/` | 0 changes | git diff and git status show zero backend/app changes | VERIFIED |
| No SQL migration created | 0 migration files | git status shows no supabase/migrations entries | VERIFIED |
| docxtpl NOT in Dockerfile.sandbox or requirements*.txt | Not present | grep found no match in production files | VERIFIED |
| All spike artifacts live under `scripts/spike-097/` | Repo-root only | Confirmed; commits show paths under scripts/spike-097/ only | VERIFIED |

---

## SC#1 — End-to-End Artifact

### Artifact Existence and Openability

| File | Exists | python-docx re-opens | Row count | Status |
|------|--------|----------------------|-----------|--------|
| `scripts/spike-097/out/risk-register-filled.docx` | Yes | Yes | 7 (header + 6 body) | VERIFIED |
| `scripts/spike-097/out/risk-register-filled-1.docx` | Yes | Yes | 2 (header + 1) | VERIFIED |
| `scripts/spike-097/out/risk-register-filled-5.docx` | Yes | Yes | 6 (header + 5) | VERIFIED |
| `scripts/spike-097/out/risk-register-filled-20.docx` | Yes | Yes | 21 (header + 20) | VERIFIED |

Row counts were independently verified by running python-docx against all four files in this verification pass — results `[(risk-register-filled.docx, 7), (risk-register-filled-1.docx, 2), (risk-register-filled-5.docx, 6), (risk-register-filled-20.docx, 21)]` match the expected header+N formula exactly.

### corruption.log Pitfall Coverage

`scripts/spike-097/out/corruption.log` contains one row for each of Pitfall 1–6, plus Pitfall 7 (observe-only), plus pptx and xlsx deferred rows. All six named pitfalls are marked `clean`. The real-editor confirmation row (operator-signed 2026-06-09) is appended. File is substantive and passes the plan's acceptance criteria.

---

## SC#2 — Four Unknowns Answered

### (a) Field Derivation — unknown-a.md + field-map.json

`scripts/spike-097/out/unknown-a.md` independently verified:
- File size > 200 bytes (substantive)
- Contains verdict "YES", null-rate (11%), citation coverage (100%), and provider verdict (Anthropic forced-tool held, no OpenAI-strict pivot)

`scripts/spike-097/out/field-map.json` independently verified:
- `covered_keys == placeholder_keys` (both are `['project_name','report_date','rows']`)
- `citation_coverage_pct: 100.0`
- `invented_citation_count: 0`
- `uncited_row_count: 0`
- `null_rate: 0.1071` (~11%)
- `row_count: 6`
- All 50 non-null values carry a `source_chunk_id` drawn from the 5 retrieved chunks (`chunk-1` through `chunk-5`)
- Retrieval used `bound_folder_ids: ['75755ec9-5ba7-495b-ad93-7500011cf6f2']` — a server-side bound parameter from spike-config.json, not a prompt hint

Citation correctness (manual check — operator-signed): the VALIDATION.md requires spot-checking ≥3 non-null rows. The operator confirmed at Plan 03 Task 3 that citations point at correct source spans.

### (b) Clean Fill — unknown-b.md

`scripts/spike-097/out/unknown-b.md` independently verified:
- Substantive (>200 bytes)
- Contains "Verdict: YES — docxtpl produces a clean, re-openable .docx"
- Covers openability, 1/5/20 row growth (all PASS table present), &<> escaping
- Real-editor confirmation section appended ("Verdict: APPROVED — opens CLEAN in a real editor"), operator-signed 2026-06-09
- Honest carry-forward for blank Score column noted (worded P/I → numeric mapping deferred to Phase 101)

### (c) Authoring Grounding — unknown-c.md

`scripts/spike-097/out/unknown-c.md` independently verified:
- Substantive (>200 bytes)
- Contains grounding inventory table: folder tree (YES), tool registry (YES), template placeholders (YES), skill registry (NO — unused but carried)
- `folder_scope` shape finding: scope expressed as resolved id(s) — string path would be wideable by model; confirms PROJ-02 additive field is needed
- Names the 4 MUST-HAVE grounding sources for Phase 103 generator prompt

`scripts/spike-097/out/transcript.md` independently verified:
- Contains "describe" and "refine" keywords
- Contains at least 2 `"phases"` JSON blocks (the describe draft and the refine re-draft)
- Records the grounding bundle summary, description, first WorkflowDefinition JSON, refine instruction, re-drafted definition

### (d) Authoring Feel — unknown-d.md

`scripts/spike-097/out/unknown-d.md` independently verified:
- Substantive (>200 bytes)
- Contains `MIXED` rating (regex `GOOD|MIXED|POOR` matched)
- Contains operator verbatim quote and named conditions
- Written by human (operator) — this was the manual-only VALIDATION item, confirmed by the operator on 2026-06-09

---

## SC#3 — Go/No-Go + Recommended Schema Shape

`scripts/spike-097/CONCLUSION.md` independently verified:

| Required element | Present | Evidence |
|-----------------|---------|---------|
| `DECISION: GO` line | Yes | Line 15: `## DECISION: GO` and line 64: `### DECISION: GO  *(operator-confirmed go-conditional — 2026-06-09...)*` |
| 8-condition list for the conditional GO | Yes | Conditions 1–8 enumerated in §2 |
| Recommended `inputs:` / `assets:` / `folder_scope:` schema shape | Yes | §3 contains full Python pseudo-code for InputFieldSpec, AssetRef, and per-phase `folder_scope: list[UUID] | None` |
| Output-side dimension (output_target_folder / reingest_output / version_policy / provenance) | Yes | §3 includes all four output-side fields |
| Three open questions settled | Yes | Table in §3 settles (i) template_derived flag → YES as `source` enum, (ii) Cited provenance → run OUTPUT only, (iii) folder_scope → resolved id list, not string path |
| References `out/field-map.json` | Yes |
| References `out/risk-register-filled.docx` | Yes |
| References `out/corruption.log` | Yes |
| References `out/transcript.md` | Yes |
| Operator-confirmed go-conditional | Yes | "Operator Sign-Off (Plan 05 Task 2 — checkpoint:decision)" section, confirmed 2026-06-09 |
| "Does NOT do" list | Yes | §5 enumerates: no schema committed, no SQL migration, no Dockerfile.sandbox change, no production code |
| No edit to `backend/app/models/harness.py` | Yes | git confirms zero changes to harness.py |

---

## SC#4 — Phase 101 UAT Seed

`scripts/spike-097/out/corruption.log` and `scripts/spike-097/CONCLUSION.md` §4 both carry the Phase 101 UAT seed:

| Pitfall | Row in corruption.log | CONCLUSION.md §4 | Status |
|---------|-----------------------|------------------|--------|
| Pitfall 1 (run-split silent miss) | Yes — clean | Yes | VERIFIED |
| Pitfall 2 (unescaped &<> XML corruption) | Yes — clean | Yes | VERIFIED |
| Pitfall 3 (produced file won't open) | Yes — clean (incl. real-editor row) | Yes | VERIFIED |
| Pitfall 4 (tag spans structural boundary) | Yes — clean | Yes | VERIFIED |
| Pitfall 5 (variable-length rows, A5) | Yes — clean | Yes | VERIFIED |
| Pitfall 6 (hallucinated/uncited rows) | Yes — clean | Yes | VERIFIED |
| Pitfall 7 (freshness, observe-only) | Yes — not-exercised | Yes | VERIFIED |
| pptx variable-row (deferred) | Yes — not-exercised + deferred-to-101 | Yes | VERIFIED |
| xlsx cell-write (deferred) | Yes — not-exercised + deferred-to-101 | Yes | VERIFIED |

---

## Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `derive_fields.py` retrieval call | `search_documents(folder_ids=...)` | `field-map.json` shows `bound_folder_ids: ['75755ec9-...']` — a server-side parameter from spike-config | WIRED |
| `render_docx.py` render | `SandboxedEnvironment(autoescape=True)` | `corruption.log` confirms SSTI containment wired; source verified by plan-02 acceptance criteria check | WIRED |
| `authoring_feel.py` generation | `WorkflowDefinition.model_json_schema()` (forced tool_choice) | `transcript.md` contains 2 schema-valid WorkflowDefinition JSON blocks; `unknown-c.md` confirms extra='forbid' schema rejection of off-schema keys | WIRED |
| `CONCLUSION.md` claims | `out/` artifacts | Every section cites field-map.json, risk-register-filled.docx, corruption.log, transcript.md by name | WIRED |

---

## Data-Flow Trace (Level 4)

This is a throwaway spike with no React/UI components. Data flow is script-to-script, verified by the evidence artifacts themselves:

- Retrieval → field-map: `field-map.json` shows `retrieved_chunk_count: 5`, real chunk ids, confirmed folder scope
- Field-map → docx render: `risk-register-filled.docx` contains 6 body rows matching the 6 rows in `field-map.json`
- Authoring feel → transcript: `transcript.md` contains grounding bundle + 2 WorkflowDefinition JSON blocks

Data flows are real (KB-grounded, not synthetic) for the primary artifact.

---

## Anti-Patterns Scan

No production code was produced by this spike. All scripts live under `scripts/spike-097/` and are explicitly throwaway. No anti-pattern scan applies to production paths.

Reviewed spike scripts for correctness concerns:
- `render_docx.py`: contains `SandboxedEnvironment`, `autoescape=True`, `jinja_env=` argument — all confirmed present per plan acceptance criteria
- `field_map.py`: contains `tool_choice`, does NOT contain `import anthropic_service` — confirmed per plan acceptance criteria
- `authoring_feel.py`: does NOT contain `import anthropic_service` — confirmed per plan acceptance criteria
- No files under `backend/app/`, `backend/Dockerfile.sandbox`, `backend/requirements*.txt` were modified

---

## Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| `risk-register-filled.docx` re-opens via python-docx | `Document(path).tables[0].rows.__len__()` | 7 rows | PASS |
| `-1.docx` has header + 1 body row | python-docx row count | 2 rows | PASS |
| `-5.docx` has header + 5 body rows | python-docx row count | 6 rows | PASS |
| `-20.docx` has header + 20 body rows | python-docx row count | 21 rows | PASS |
| `field-map.json` citation_coverage_pct == 100.0 | JSON read | 100.0 | PASS |
| `field-map.json` invented_citation_count == 0 | JSON read | 0 | PASS |
| CONCLUSION.md contains `DECISION:` line | regex check | matched | PASS |
| corruption.log contains Pitfall 1–6 | grep Pitfall N for N in 1..6 | all present | PASS |

---

## Human Verification Required

All three VALIDATION manual-only items are already operator-signed and do not require further human action:

1. **Produced .docx opens correctly in a real editor** — `097-03` Task 3 checkpoint:human-verify
   - Operator confirmed 2026-06-09: no repair banner, 6 grown rows, scalar tags filled, blank Score accepted as expected
   - Evidence: `unknown-b.md` "Real-editor confirmation" section + `corruption.log` "Pitfall 3 (real-editor)" row

2. **Authoring feel verdict (GOOD/MIXED/POOR)** — `097-04` Task 2 checkpoint:human-verify
   - Operator confirmed 2026-06-09: MIXED
   - Evidence: `unknown-d.md` with verbatim quote and two named conditions for GOOD

3. **Go/no-go decision** — `097-05` Task 2 checkpoint:decision
   - Operator confirmed 2026-06-09: `go-conditional` — DECISION: GO, Conditions 1–8
   - Evidence: `CONCLUSION.md` §2 + "Operator Sign-Off" section

All manual items are complete. No human verification is pending.

---

## Requirements Coverage

This spike closes NO REQ-IDs by design (ROADMAP: "Requirements: None closed — spike precedes schema lock; informs PROJ, TMPL, WFAUTH"). REQ traceability is explicitly out of scope for this phase. Not applicable.

---

## Gaps Summary

No gaps. All four ROADMAP Success Criteria are fully satisfied by real, opened, independently verified on-disk artifacts. The spike's throwaway mandate (zero files under backend/app, no schema committed, no migration, docxtpl venv-only) is also confirmed by git.

The one honest degrade (blank Score column on the real fill — real KB uses worded High/Medium/Low rather than numeric P×I) is documented in `unknown-b.md` §1 and `CONCLUSION.md` §1(b) as expected behavior and a Phase 101 carry-forward, not a failure or gap in this spike.

---

_Verified: 2026-06-09_
_Verifier: Claude (gsd-verifier)_

---
phase: 281-a-refusal-names-its-cause
verified: 2026-10-15T09:00:00Z
status: human_needed
score: 4/5 roadmap criteria verified in code; SC#5 (G-4) partially owed by operator decision
re_verification: false
human_verification:
  - test: "Row A: publish a draft whose emit reliably misses a template field; read WHAT STOPPED IT and the chat failure message"
    expected: "Key-coverage cause names missing keys; word 'citation' absent unless uncited_value_count > 0; step shown by canvas name"
    why_human: "Live drive; the model passed the gate on 2026-10-15 so no refusal existed (OWED by operator decision)"
  - test: "Row C: draft a workflow needing an unchosen service so connection_not_allowed actually fires"
    expected: "Plain sentence + next step with technical names OFF; small code with toggle ON"
    why_human: "Live drive; the drafting model never reached the connection check"
  - test: "Row D: freshness-checked step over a folder whose newest doc is archived (needs approved reversible archived_at write)"
    expected: "Archived doc's date does not decide the verdict"
    why_human: "Operator did not approve the write; re-run order A, C, D"
  - test: "WR-02 operator confirmation: an all-archived scope passes freshness (consistent with the empty-scope verdict)"
    expected: "Operator accepts as by design, or asks for a refusal"
    why_human: "Behavioural policy call, pinned by test, awaiting confirmation"
---

# Phase 281: A Refusal Names Its Cause Verification Report

**Phase Goal:** When a workflow step fails or a publish is refused, the author reads the check that actually failed, in plain words and by canvas name; freshness stops counting archived documents.
**Status:** human_needed (no code gap found; only operator-owed live rows remain)

## Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Emit miss with 100% citation coverage reports key-coverage failure naming missing keys; different attempt failures give different causes; "citations_required" only when citation check failed | VERIFIED in code / live half OWED | New pure leaf `backend/app/services/harness/emit_cause.py` (335 lines); engine precedence in `harness_engine.py`; `test_281_emit_cause.py` + `test_281_engine_cause_precedence.py` pass. Live half: Row A OWED (model passed gate, no refusal). |
| 2 | Publish refusal shows the precise audit reason under the canvas label; "(view coming soon)" gone; golden-run link opens WorkflowRunPage or phrase removed | VERIFIED | No "coming soon" in `PublishGauntlet.tsx`; Row B live PASS (link opened the right run, matched DB). CR-01 closed: `PhaseCard.tsx:298` now `reason: raw.length > 0 ? raw : copy.reason`, so the server's composed sentence is rendered; `PhaseCard.test.tsx` passes (87 tests with the vocabulary suite). The earlier SUMMARY claim was false until the CR-01 fix; it is now true in code. |
| 3 | Describe-door refusal renders as plain sentence from one table; unknown code falls back to a sentence | VERIFIED in code | `describeRefusalVocabulary.ts` exists, imported by `useTemplateFirstDraft.ts` and `WorkflowBuilderPage.tsx`; additive `reason_code` on the `connection_not_allowed` arms in `api/connectors.py`; `test_214_describe_vocabulary.py` passes. Live `connection_not_allowed` render is Row C OWED; two other refusals rendered table words with no code. SEED-218 connect click PASS. |
| 4 | Freshness counts only retrievable docs by importing `RETRIEVABLE_COLUMN` | VERIFIED | `freshness.py:40` imports it from `retrieval_scope`; used in both SQL strings (lines 49, 53). `test_281_freshness_retrievable.py` passes. Live Row D OWED. |
| 5 | G-4 lived-experience drives read the rendered words | OWED (operator decision) | Row B PASS; A, C, D OWED, recorded by explicit operator decision 2026-10-15 ("approved"), re-run order A, C, D. Not a silent pass. |

**Score:** SC#2, 3 (code), 4 fully verified; SC#1 and SC#5 verified in code with live halves owed.

## Behavioral Spot-Checks

| Command | Result |
|---|---|
| pytest test_281_emit_cause, test_281_engine_cause_precedence, test_281_freshness_retrievable, test_llm_emit_executor, test_214_describe_vocabulary, test_255_extension_contract_guard, test_259_closed_core_inventory | 127 passed |
| vitest PhaseCard.test.tsx + describeRefusalVocabulary tests | 87 passed |

Closed core: the 255/259 guard tests pass (7 phase types / 1 emitter / 30 tools / 10 validator kinds); no new kind or phase type in the phase diff (`emit_cause.py` is a pure leaf, not a registered executor).

## Requirements Coverage

| ID | Plans | Status |
|---|---|---|
| FIX-09 | 281-01, 03, 04 | SATISFIED in code; live Row A owed |
| FIX-10 | 281-02, 03, 04 | SATISFIED (Row B PASS; Row C owed for the live code) |
| DEBT-07 | 281-01, 04 | SATISFIED in code; live Row D owed |

All three IDs appear in plan frontmatter and in REQUIREMENTS.md; no orphans. (REQUIREMENTS.md checkboxes still read Pending; orchestrator ticks at close.)

## Anti-Patterns

No TBD/FIXME/XXX in `emit_cause.py` or `describeRefusalVocabulary.ts`. Review findings: CR-01, WR-01, WR-03 fixed RED-first; WR-02 pinned "consistent by design" pending operator confirmation; WR-04 deferred to BUG-261015-01 by the operator. Out of scope and noted: `backend/app/api/documents.py` appears in the phase diff stat (separate quick fix per orchestrator). Pre-existing unrelated failure `tests/test_200_phase_counts.py::test_llm_single_emits_no_measure_key` (fails at HEAD without the WR-01 files too).

## Gaps Summary

No gap in what the code does. Remaining: the operator-owed live rows A, C, D (SC#1 "once live", SC#3 live code render, SC#4 live verdict, SC#5) and the WR-02 policy confirmation. Closing with these owed is a recorded decision, not a pass. Full backend baseline and vitest count gate were not run by this verifier (orchestrator running them).

_Verifier: Claude (gsd-verifier)_

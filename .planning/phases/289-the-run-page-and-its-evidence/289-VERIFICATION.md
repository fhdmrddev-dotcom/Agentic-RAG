---
phase: 289-the-run-page-and-its-evidence
verified: 2026-10-20T00:30:00Z
verification_mode: self-verified   # ⛔ OV-SOLO-01 — NEVER "reviewed". No independent §6.3 reviewer exists.
status: human_needed
score: 5/5 roadmap success criteria verified in code; post-review fixes re-driven live 2026-10-20 (CR-01, CR-02, S5, WR-02, WR-05 PASS; WR-06 and WR-01 blocked, needing fault injection); G-4 sign-off and the Anthropic row still owed
overrides_applied: 0
gaps: []
deferred: []
human_verification:
  - test: "CR-01 live re-drive: as a same-org colleague who cannot read a cited private document, open a finished run whose step cites it"
    expected: "That step shows the withheld sentence instead of output_text; the private document's title appears nowhere in the colleague's JSON or page; the owner still sees the full text"
    why_human: "Privacy rule changed after the S4 live drive (S4 observed the leak that CR-01 fixed). Only unit tests cover the fix. Residual known: a later non-citing step that builds on a withheld step still ships its text."
    result: "PASS (2026-10-20, runs a052667d and b464d95d). Colleague step 1 = the withheld sentence; 0 title hits in the colleague's raw JSON and in the page's full outerHTML; the owner's JSON and page name the documents. Residual SEEN LIVE: the non-citing step 2 ships the private documents' substance (no titles) to the colleague."
    evidence: "289-VALIDATION.md R1; evidence/cr01_colleague_runA.png, cr01_colleague_runE.png, cr01_owner_runA.png"
  - test: "CR-02: paused run whose ask card already counted down to expired on the client clock"
    expected: "When the run turns paused, the card returns to the live-answer layout with Send Answer; a server-driven 404/409 expiry stays terminal"
    why_human: "State/timing behaviour; jsdom only. S5 was driven before this fix."
    result: "PASS (2026-10-20, run b464d95d watched continuously). 'EXPIRED … agent stopped' at 20:38:03.759Z; poll read paused at 20:38:06.424Z; answer layout with Send Answer back at 20:38:06.478Z. The server-driven expiry arm was not driven live (unit-pinned)."
    evidence: "289-VALIDATION.md R2; evidence/cr02_runE_clock_expired.png, cr02_runE_recovered.png"
  - test: "WR-01/WR-02/WR-06 redrive paths: answer a paused run while (a) Stop lands first, (b) the workflow definition cannot load, (c) context build raises"
    expected: "Run ends failed or cancelled once, with one run_failed audit and emit, no stranded streaming shell, never flips to active; the normal answer-then-resume path (S5) still completes"
    why_human: "Concurrency and shell-ordering in harness_engine.py/runs.py; unit tests with stubs only. S5 predates the fixes, so the happy path should be re-driven once."
    result: "S5 PASS x2 (b464d95d, a052667d: completed, 0 re-drive failed/raised/skipped lines). (a) PASS: cancel-then-answer (4af6909f) and concurrent answer+cancel (d6f9c254) both end cancelled with 0 run_failed and no stranded shell. (b) BLOCKED: needs fault injection (FK ON DELETE RESTRICT + published-immutability trigger); covered by test_an_unloadable_definition_ends_the_answered_run_failed_with_words. (c) BLOCKED: needs fault injection (org_id NOT NULL; other steps caught); covered by the WR-01 tests in test_289_redrive_failure.py. NEW FINDING F-1 (pre-existing): the human answer never reaches the next step's prompt."
    evidence: "289-VALIDATION.md R3, R4"
  - test: "WR-05 deep link: open /app?run=<id> for a live run, click Back to Workflows"
    expected: "?run= is cleared from the address bar and other query params are kept"
    why_human: "Browser address-bar behaviour"
    result: "PASS (2026-10-20). Header back control on run d6f9c254 (active) and 4af6909f (paused): /app?run=<id>&keep=1 -> /app?keep=1; reload lands on Chats, not the run."
    evidence: "289-VALIDATION.md R5; evidence/wr05_runD_active_header_*.png, wr05_runC_header_*.png"
  - test: "G-4 lived-experience sign-off on the finished-run report (print layout, Download JSON, confidence line under KB step only)"
    expected: "Operator recognises the sketch-B report; print preview shows all four sections"
    why_human: "Visual and print; G-4 is an operator gate"
  - test: "Anthropic roster row (blocked by billing)"
    expected: "Run a KB workflow on an Anthropic model and see the same confidence line"
    why_human: "External billing; recorded as blocked, not omitted"
---

# Phase 289: The Run Page and Its Evidence - Verification Report

**Phase Goal:** Anyone with access can open one read-only page for a finished run that shows what it did and on what evidence, and can see how sure each knowledge-based answer was.
**Verified:** 2026-10-20 (HEAD of develop, including the `fix(289-REVIEW)` commits)
**Status:** human_needed
**Re-verification:** No, initial.

## Goal Achievement

### Observable Truths (ROADMAP SC)

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Finished run opens one read-only page: definition version it ran, phase log, verdicts, cited sources | VERIFIED | `backend/app/api/workflow_run_evidence.py` returns `RunEvidenceRead` with `definition`, `definition_changed`, `phase_log`, `verdicts`, `sources`. The definition comes from `workflow_runs.definition_snapshot` via `ev.compose_definition` (not the live row). The router is GET-only. `WorkflowRunPage.tsx:1146` renders `RunEvidenceReport` when the run is terminal. 72 backend tests passed (`test_289_phase_confidence`, `test_289_run_evidence`) and 72 frontend tests passed (evidenceView, RunEvidenceReport, StepEvidenceLine), run here. Live S1/S2 recorded the v1 snapshot shown after v2 was published. |
| 2 | Export contains the same four sections, matching the page | VERIFIED | `RunEvidenceReport.tsx:195` Download JSON writes `exportPayload(payload)` (the fetched payload unchanged). Print uses `window.print()` with a print-root. Tests assert sections by content against the same view-model. Live S3 compared parsed JSON with the page, member by member. |
| 3 | A user without org access cannot open page or export (second user) | VERIFIED | `_ACCESS_SQL` joins id, terminal status and (owner OR `org_members`) in one query. Any miss raises the same 404 "Run not found". The route is registered in `CANVAS_GATED_PATHS`. Live S4: outsider got a byte-identical 404 for the real run and a random uuid; the colleague got a read-only report. |
| 4 | KB-derived phase outputs carry confidence on the run surface and in the receipt; non-KB phase shows none | VERIFIED | `phase_types.py:938` and `:1078` call `phase_confidence(...)`, which returns `None` when no search ran. `confidence_for_wire` allow-lists the stored dict. `StepEvidenceLine` is mounted in `RunSpine.tsx:416` (run surface) and `RunEvidenceReport.tsx:314` (the report). Live S1: KB row showed "Medium 0.50", non-KB rows had no line (DB `confidence = null`). Note: `RunReceipt.tsx` itself carries no confidence; the plans treat the evidence report as the receipt (CONTEXT D-10: "evidence view or receipt"). |
| 5 | Confidence is chat's existing value, carried onto the run; no new model call | VERIFIED | `phase_confidence.py` imports `_compute_confidence` and `_deduplicate_citations` from `agent_loop` and does arithmetic only. The module docstring says no model or provider is called, and an AST fence (T-289-11) is in the test file. |

**Score:** 5/5 verified in code.

### "How we'd know this failed" conditions

| Condition | Result |
|---|---|
| Page shows current definition not the run's version | Not present: snapshot used, `definition_changed` is a separate flag (S2 live). |
| Export omits cited sources | Not present: the export is the full payload, `sources` included. |
| Phase with no KB use shows "high" | Not present: `None` returned, and no line is rendered. |
| Confidence recomputed with a model call | Not present: pure function. |
| Page is writable | Not present: GET only, "PURE READ" docstring, no write calls in the module. |
| Member of another org reads it | Not present: S4 outsider got 404. |

### Requirements Coverage

| Requirement | Plans | Status | Evidence |
|---|---|---|---|
| VIS-03 | 289-03, 289-04 | SATISFIED | SC#1-3 above; marked Complete in REQUIREMENTS.md. |
| TRUST-01 | 289-02 | SATISFIED | SC#4-5 above; marked Complete. |

No orphaned requirement IDs: REQUIREMENTS.md maps only VIS-03 and TRUST-01 to Phase 289. Plan 01 (SEED-360 re-drive) is a folded bug fix and claims no requirement ID.

### Post-review fixes ~~(not live re-driven)~~ (live re-drive 2026-10-20)

CR-01 (output withholding for a colleague), CR-02 (expired card on pause), WR-01 (producer shell minted last), WR-02/WR-06 (`_fail_redrive` conditional UPDATE), WR-03 (timeout/check counting), WR-04 (refused searches not counted) and WR-05 (`?run=` cleared) all have RED-then-GREEN unit tests per 289-REVIEW-FIX.md. I confirmed that the code for CR-01 (`compose_phase_log` with `readable_ids`, `WITHHELD_OUTPUT_SENTENCE`) and WR-01 (HEAD `3ed3357f9`) exists. ~~None was driven live. See human_verification.~~

**Live re-drive, 2026-10-20** (full record in `289-VALIDATION.md` § "Post-review live re-drive"):

| Item | Verdict |
|---|---|
| CR-01 | PASS. Residual seen live: a non-citing step 2 ships the private documents' substance (not titles) to the colleague. |
| CR-02 | PASS (card spent 2.7 s in "EXPIRED … agent stopped", then returned to Send Answer on the first `paused` poll) |
| S5 re-run | PASS on two runs, 0 re-drive failure lines |
| WR-02 stop-first | PASS (sequential and concurrent; both `cancelled`, 0 `run_failed`) |
| WR-06 / WR-01 | ⛔ blocked: needs fault injection; not reachable through data (FK `ON DELETE RESTRICT` + immutability trigger; `org_id NOT NULL`). Unit-covered. |
| WR-05 | PASS (active and paused runs, the header back control) |

WR-03 and WR-04 were not in the re-drive list. They change counting, and the colleague report on run `a052667d` read `CHECKS 1 of 1 passed`.

**New finding F-1 (pre-existing, outside 289's fixes, not an SC failure):** a human step's answer is never fed to the next LLM step. `_prior_output_text` reads `text`, and `llm_human_input` returns `text = <the question>` on all three paths. Live, one run's final step said no approval decision was provided after the person answered Yes. Should be filed as a bug or seed.

Status stays `human_needed` for the two operator-owned items: G-4 sign-off and the Anthropic row.

### Scope fact: harness_engine.py ledger

Plans 02/05 recorded `harness_engine.py` as NOT EDITED. WR-01 edited it (`3ed3357f9`, +9 lines). The CLAUDE.md row now reads `62 / 25 / 3396 (was 61 / 24 / 3387)`. This matches `git log --oneline` (62 commits) and `wc -l` (3396). `docs/HOT-FILE-LEDGER.md` has a new "289-REVIEW WR-01" section with the old CLAUDE.md cell preserved. One stale item: the older section is still headed "Phase 289 - NOT EDITED, and that is the record" with `61 / 24 / 3387 (unchanged)`. The WR-01 section follows it, so the record is correct but the earlier heading is superseded. This is cosmetic (Info), not a gap.

### Classification of known items (none is an unmet SC)

- SEED-361..364, F3 (run-level confidence on default buckets, a one-argument fix in `_finalize_run_grounding`), F-A..F-E follow-ups: accepted or open, outside SC#1-5. F3 concerns run-level confidence, and SC#4 is per-phase.
- Anthropic roster row: blocked by billing (recorded with request id, not omitted). Human item.
- CR-01 residual (a later non-citing step building on a withheld step still ships text), and the `claim_run` False arm re-drive (only the boot sweep recovers it): recorded by the fixer as open. Warnings, not SC failures.
- SEED-362: a resumed segment runs on the owner's default model while `workflow_runs.model` names the per-request model. This is a pre-existing resume behaviour recorded in the roster, not introduced here.

### Behavioral spot-checks

| Behavior | Command | Result |
|---|---|---|
| Backend evidence and confidence units | `pytest tests/unit/test_289_phase_confidence.py tests/unit/test_289_run_evidence.py` | 72 passed |
| Frontend evidence view, report, step line | `vitest run` the three suites with `GSD_VITEST_MAX_WORKERS=2` | 72 passed |
| Full backend baseline and vitest count gate | not run by me (orchestrator-owned) | per orchestrator |

### Anti-patterns

None found in the key files (no stubbed returns, no write routes). I did not run a debt-marker scan across every modified file.

## Gaps Summary

No success criterion is unmet. All five SCs and all six failure conditions check out in code, with unit evidence re-run here and live evidence S1-S5 recorded by plan 05. The status is `human_needed` rather than `passed` because ~~the post-review privacy and concurrency fixes changed behaviour after the live drive and only unit tests cover them, plus~~ the G-4 operator sign-off and the blocked Anthropic row remain. (Updated 2026-10-20: the post-review fixes were re-driven live; the drivable ones passed and WR-06 / WR-01 are blocked, needing fault injection. See "Post-review fixes" above.)

---

_Verified: 2026-10-20_
_Verifier: Claude (gsd-verifier)_

## Post-review-fix full gates (orchestrator, 2026-10-20)

Run after the 16 `test/fix(289-REVIEW)` commits, at HEAD of develop, because those fixes came after plan 05's gate runs.

| Gate | Verdict |
|---|---|
| Backend `pytest tests/unit -q --continue-on-collection-errors` (local-DB lock, `-p no_run_sweeps`) | **79 failed, 7871 passed**, 1 skipped, 2 xfailed, 2 xpassed |
| Failing-test SET vs phase base `dcf6ba649` (plan 05's `drive/gate_base.txt`, 78 ids; trailing-warning artifacts normalised) | only-HEAD: **1**, `test_email_ingestion.py::test_ingest_email_populates_metadata_and_attachments`; only-base: 0 |
| That one id | **classified flaky, not a phase regression.** It passes in isolation at HEAD. The phase diff touches no email or ingestion file. It failed the same way in 289-03's full run (before the review fixes) and passed in both of plan 05's full runs on the same code paths. It reads as an order- or timing-dependent title-extraction leak. |
| 71 ceiling | Not raised (operator-only). The excess (78) is inherited, as plan 05 established. |
| Vitest count gate | **count gate OK**: 471/471 pinned files present, no per-file decrease, 0 failing (10,743 tests) |
| Frontend typecheck (`tsc -p tsconfig.app.json`) | 63 errors, the same set as base (per 289-REVIEW-FIX) |

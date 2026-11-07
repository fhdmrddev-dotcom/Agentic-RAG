---
phase: 303-word-template-bare-tokens
verified: 2026-11-06T00:00:00Z
status: passed
score: 4/4 roadmap truths verified; live rows U-1 + U-2 PASSED 2026-11-06
overrides_applied: 0
human_verification:
  - test: "U-1 - bare-token library template run through the app (SC#1/SC#2 live)"
    expected: "Value in body, header and nested table, no 'source_chunk_id' text; a whole-record field map reports reason residual_tokens and is not delivered. Keep the run id."
    why_human: "Backend not running and Docker unavailable here; needs a real run with a run id."
  - test: "U-2 - live golden run of one published template workflow (SC#3 live)"
    expected: "Output text identical to the last pre-303 run of the same workflow."
    why_human: "Needs the live app; the offline golden is ALL IDENTICAL."
---

# Phase 303: Word Template Bare Tokens - Verification Report

**Goal:** A bare `{{ name }}` against a cited record fills in the value, or the run stops at the integrity check with a reason; `{{ name.value }}` keeps working.
**Status:** human_needed (all automatable evidence passes; no gaps)
**Re-verification:** No

## Observable Truths

| # | Truth (ROADMAP SC) | Status | Evidence |
|---|---|---|---|
| 1 | Defect reproduced through the REAL driver before the fix, evidence kept | VERIFIED | `evidence/red-base/repro-output-base.txt` (BASE_COMMIT.txt a5ad48e4c) shows docxtpl_bare body/header/footer/cell/nested/loop rows containing `{'value': 'Ann', 'source_chunk_id': ...}` with `residual_clean: true`. The RED test commit 44ae07a4b precedes fix commit af4b57ac. The repro is the driver script run as a file. The in-app run id is owed (U-1). |
| 2 | After the fix, body/header/footer/nested tables show the value, or the run stops with a worded reason | VERIFIED | `evidence/green/repro-output-green.txt` shows `Ann` / `Late vendor` everywhere. 200 targeted tests pass, including test_303_bare_tokens.py, which covers the record-text residual scan and the handler `residual_tokens` message. The reviewed fixes (CR-01 oracle, WR-02 one-pass, WR-03 refused file removed) landed in commits 1b2233402, 7c6c9ce13, da008d678. |
| 3 | `.value`, `|default`, `score` output unchanged vs golden | VERIFIED | I re-ran `compare.py base after` and `compare.py base after-review`. Both print `RESULT: ALL IDENTICAL`. The live re-run is owed (U-2). |
| 4 | Driver and service copies pinned together by one test | VERIFIED | test_303_driver_service_parity.py (execs `_RENDER_DRIVER_SRC` beside the service import) passes. |

## Behavioral Spot-Checks / Tests

| Suite | Result |
|---|---|
| test_303_bare_tokens, test_303_driver_service_parity, test_template_render, test_296_render_template, test_291_pdf_fill_driver, test_291_acroform_reader_parity, test_278_pure_move, test_190_ssti_fence | 200 passed, 0 failed (I ran them) |
| Full backend baseline | Not run by me; the orchestrator is running it |

## Scope Fence

`git diff 8226f8703 HEAD --name-only` outside `.planning` lists CLAUDE.md, docs/HOT-FILE-LEDGER.md, the two new tests, and in `backend/app` only `render_template.py` and `template_render_service.py`. No Dockerfile.sandbox, supabase or frontend changes. Same-commit ledger rows exist: the CLAUDE.md FIRING table has rows for both files (lines 423-424).

## Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|---|---|---|---|
| FIX-15 | 303-01 | SATISFIED (live rows owed) | REQUIREMENTS.md line 66 and traceability line 129; truths 1-4 above. No orphaned requirements. |

## Anti-Patterns

None blocking. REVIEW fix status shows 6 fixed and WR-01 accepted by ruling D-20. The CR-01 fix is marked "requires human verification (logic)", but it is pinned by tests and the shipped templates' parse is unchanged.

## Human Verification Required

1. **U-1** (run first): upload a bare-token docxtpl library template, run its fill workflow once, and keep the run id. Expect the value in body, header and nested table, and no record text. A whole-record field map must give `residual_tokens`.
2. **U-2**: re-run one published pm-pack template workflow. Expect output text identical to the pre-303 run.

## Gaps Summary

No gaps. All four roadmap success criteria are met by evidence I re-derived: the targeted tests, the golden compare, and the RED-then-GREEN commit order. Only the live-app rows U-1 and U-2 remain, and the phase cannot be marked `passed` until they are driven or consciously recorded as owed.

_Verifier: Claude (gsd-verifier)_

## Live verification (2026-11-06) — both owed rows PASSED

- **U-1** (SC#1/SC#2 live): run `826d3eaf` filled bare tokens in header, body and nested table (0 record text, 0 leftover tokens). A record-printing template was refused with 0 files delivered, but the FIRST refusal (`ca440cc9`) showed the generic integrity sentence; fixed in `emit_cause` (RED `d024a6892`, fix `ee367fcf9`), re-verified live in run `6bc7da96`. Evidence: `evidence/uat/U-1-RESULT.md`.
- **U-2** (SC#3 live): two real pre-303 runs (`9854abae`, `397432ff`) replayed through today's driver: 19/19 text lines and 8/8 XML parts identical. Live run `f125d3e5` of the published Weekly Status Report: same layout, 8/8 fields filled, clean. Evidence: `evidence/uat/U-2-RESULT.md`.
- Not observable from this shell: the in-container `/sandbox/output` delete (Docker denied). Covered by unit test; 0 files reached `workspace_files` on every refusal.
- Status flipped `human_needed` → `passed`. Not deployed.

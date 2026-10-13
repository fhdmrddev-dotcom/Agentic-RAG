---
phase: 279-the-expert-scope-seam
verified: 2026-10-14T00:45:00Z
verification_mode: self-verified   # ⛔ OV-SOLO-01 — NEVER "reviewed". No independent §6.3 reviewer exists.
status: passed
status_history: "human_needed (verifier, 2026-10-14T00:45Z: bookkeeping only, 4/4 SC met) -> passed (orchestrator, 2026-10-14: the human_verification item below was RESOLVED by recording, not by new verification)"
score: 4/4 roadmap success criteria verified
overrides_applied: 0
head: 0181a0645
phase_base: a5a94ba67
independent_review: self
human_verification:
  - test: "Record the 279 code review's 6 INFO findings (IN-01..IN-06) and the two REVIEW-FIX follow-up residuals as owed rows in STATE.md (or accept them explicitly)"
    expected: "STATE.md 'Owed from Phase 279' names each: IN-01 stale workflow-lock-error-banner testid on every send 409; IN-02 folder-arm 409 says 'The folder changed' when the Expert moved; IN-03 check-test-retarget-only.py --exclude-prefix '' vacuous CLEAR; IN-04 WR-06 alert outlives a later successful load; IN-05 transient org-validation failure refuses with the org sentence; IN-06 WR-08 note can list Expert folders while ls defaults to the excluded thread folder; plus the WR-02 legacy NULL-org continuation residual and the catalog subtitle 'Every Expert shown here is one you can actually use' no longer literally true for managers"
    why_human: "They are recorded only in 279-REVIEW-FIX.md ('recorded, not fixed'), not in STATE.md or 279-VALIDATION.md. Whether they are owed work or accepted is an operator decision; none of them unmeets a success criterion"
---

# Phase 279: The Expert Scope Seam — Verification Report

**Phase Goal:** `expert_scope.py` is split along its named seam. The pure scope composition stays apart from the async statement and transcript-event wording, and every item the Phase 267 independent review deferred is fixed or carries a written reason.
**Verified:** 2026-10-14 (HEAD `0181a0645`, branch `develop`)
**Status:** human_needed (all 4 success criteria verified; one bookkeeping decision owed)
**Re-verification:** No (initial)

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|---|---|---|
| SC#1 | `expert_scope.py` extracted along its seam; `compose_expert_scope` pure; moved functions AST-identical to base; 267/268 fixtures byte-equal | ✓ VERIFIED | `expert_scope.py` is 159 lines with only `from __future__`/`dataclasses` imports, no `async def`, no `app.` import. Imports run one way: `expert_scope_events.py:26` → statement; `expert_scope_statement.py:41` → pure; statement never imports events. **Independent AST check:** I compared all 26 top-level bindings of `a5a94ba67:expert_scope.py` with their homes at the move commit `fa164ef3e`: 0 missing, 0 non-identical, exactly one home each (3 pure / 9 statement / 14 events). `RETIRED` was `{}` at `fa164ef3e`. Its 3 later entries are the deliberate D-07 and WR-08 edits. No re-export shim. The only importers of `app.services.expert_scope` are of `compose_expert_scope`, `ExpertScope` and `folder_path`. `git diff --stat a5a94ba67 HEAD -- backend/tests/fixtures/ test_267_expert_scope.py` shows only 2 NEW `phase279/` fixtures; the 267/268 fixtures and the 11-case file are byte-equal. `test_279_pure_move.py` is green (run below). |
| SC#2 | Every SEED-328 item has a row reading fixed (with test or drive) or not fixed (with reason); SEED-328 `status` changed | ✓ VERIFIED | `279-SEED-328-RECORD.md` has 20 rows, none dropped: CR-03(b), WR-01..08, IN-01, IN-02, IN-03, IN-04 in two halves, IN-05, the 3 drive notes, and 267-FIX notes #4 and #5. 15 are fixed, each with a commit plus a test id or UAT-LOG row. 5 are not fixed, each with a reason and a home (SEED-303, SEED-327, or a re-open trigger / still owed). `SEED-328` frontmatter reads `status: answered` with a status_note. WR-05 is recorded as "mitigation against TRUST-03, not enforcement", and only after Chrome row 2a plus DB row 2a-DB (row `5a547220…`). |
| SC#3 | CR-03(b) fixed as ONE shared org-equality helper used by PATCH, handoff, preview (closes IN-01); a two-org send with the wrong org is refused before any run row, driven live | ✓ VERIFIED | `threads.py:782` defines `_require_thread_org`, called once at each door: preview `:875`, PATCH `:1281`, handoff `:1414`, send `:1683`. The send call sits before `preflight_workflow_kickoff` and the user-message INSERT, so the send path gets no second inline compare. Live drive: UAT-LOG row 5, as `fhdmrd.dev@gmail.com` with org B active, proven on screen as "Member". The 409 "Switch to this chat's organization to keep chatting with its Expert." was read off the DOM. Messages 4→4 and runs 1→1 across two sends; the Expert was not cleared. |
| SC#4 | Backend unit ≤ 71 failed, 0 collection errors; frontend count gate no per-file decrease | ✓ VERIFIED (as recorded + targeted re-run) | 279-REVIEW-FIX final gates at `16e355582`: 71 failed / 7293 passed / 0 collection errors, failing set equal to `279-base-failed.txt` (71 = 71). Count gate OK: 434/434 pinned, no per-file decrease, 0 failing. Every commit after `16e355582` touches docs only (`git show --stat`). My targeted re-run is consistent: 1 backend failure, `test_forced_emit_judge_verdict_unmocked`, which is listed at `279-base-failed.txt:29` (inherited). |

**Score:** 4/4 success criteria verified.

### Required Artifacts

| Artifact | Status | Details |
|---|---|---|
| `backend/app/services/expert_scope.py` | ✓ VERIFIED | Pure; 3 bindings; post-move WR-08 `scoped_folder_paths` (still pure) |
| `backend/app/services/expert_scope_statement.py` | ✓ VERIFIED | 315 lines; async reads; imports pure only |
| `backend/app/services/expert_scope_events.py` | ✓ VERIFIED | 237 lines; wording + the one writer; WR-03 overlap arithmetic in `build_expert_changed_event` |
| `backend/tests/unit/test_279_pure_move.py` | ✓ VERIFIED | Green; `RETIRED` entries are named, with reasons (D-07, WR-08) |
| `279-SEED-328-RECORD.md` | ✓ VERIFIED (⚠ partly stale, see Anti-Patterns) | 20 rows, G-5 table, D-18 struck-through record |

### Key Link Verification (security-bearing spot checks)

| From | To | Via | Status | Details |
|---|---|---|---|---|
| send / PATCH / handoff / preview | `_require_thread_org` | 1 call per door | ✓ WIRED | `threads.py:875, :1281, :1414, :1683`; the old inline compares were replaced |
| `run_producer._resolve_thread_scoping` | `ExpertThreadOrgMismatch` (WR-02) | re-read compare before any resolve/clear | ✓ WIRED (narrowed by ruling) | `run_producer.py:510-511`; the outer `except` re-raises (`:648-654`). The narrowing ("only when the thread row carries `org_id`") is an operator ruling recorded in REVIEW-FIX's follow-up |
| folder PATCH / `GET /scope-effect` | thread's org (WR-01) | `_describe_thread_scope_change(thread_org_id=…)` + `_caller_role_in_org` | ✓ WIRED | `threads.py:1107-1127`; callers `:1149`, `:1220` pass `row.get("org_id")` |
| handoff marker INSERT | `handoff_content` (WR-05 + WR-04 fence) | `thread_handoff.py:250` | ✓ WIRED | `:139` collapses title whitespace and neutralises ```` ``` ````; `:140` neutralises item fences |
| handoff door | `_thread_has_active_run` (WR-01) | 409 before read/write | ✓ WIRED | `threads.py:1418-1422` |
| `forced_emit` | `_COERCE_DIRECTIVE_SCHEMA` (IN-03) | IfExp on `schema_model` | ✓ WIRED | `forced_emit.py:306`; `provider_gateway/` diff since base is empty |
| `StreamsProvider` 409 arm | lock prefix only (D-15) | `startsWith(WORKFLOW_LOCK_DETAIL_PREFIX)` | ✓ WIRED | `StreamsProvider.tsx:199, :3033` |
| `ChatArea` hydration | chip clear (WR-06) / handoff hidden while streaming (WR-01) | functional setter + `!isStreaming` | ✓ WIRED | `ChatArea.tsx:328, :339, :814` |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Backend 279/267/268 suites | `pytest test_279_pure_move test_279_org_helper test_279_scope_fixes test_267_handoff test_268_scope_patch test_268_scope_effect test_267_expert_scope test_267_expert_changed_event test_267_scope_preview test_267_cr03_server_side_expert_clear test_forced_emit test_262_expert_list_grants_api test_267_cr02_empty_biased_scope_searches test_268_send_path_stamp -q -p no:cacheprovider` | 253 passed, 1 failed (`test_forced_emit_judge_verdict_unmocked`, in the base failing set) | ✓ PASS |
| Frontend Expert suites | `GSD_VITEST_MAX_WORKERS=2 npx vitest run src/components/experts …InviteExpertDialog …ChatArea.expertThread …expertEventCopy …ExpertSpotlightCard …ExpertEventCard …StreamsProvider.stopping …streamsProvider_state01b_403` | 16 files, 319 passed | ✓ PASS |
| AST pure-move, independent | scratch script: `ast.dump` of 26 base bindings vs `fa164ef3e` homes | 0 missing, 0 non-identical | ✓ PASS |
| Ledger gate | `node scripts/check-hot-file-ledger.cjs 279` | ledger gate OK | ✓ PASS |
| G-7 | `node scripts/check-gap-closure-rounds.cjs 279` | G-7 clear (0 gap-closure plans) | ✓ PASS |
| CLAUDE.md size | `node scripts/check-claude-md-size.cjs` | OK | ✓ PASS |

Not re-run, by instruction: the full backend unit suite and the full vitest count gate. Both are cited from REVIEW-FIX at `16e355582`. No DB writes. No Supabase MCP calls.

### Probe Execution

None declared. Step 7c does not apply.

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|---|---|---|---|
| SEAM-01 | 279-01..04 | ✓ SATISFIED | SC#1-SC#4 above |

### G-4 / D-13 drive coverage

UAT-LOG rows 1a, 1b, 2a, 2a-DB, 2b, 3, 4 and 5 each quote on-screen words, and row 2a-DB quotes the DB row. REVIEW-FIX's follow-up adds the WR-05 (disabled-Expert card) live row. It quotes "Disabled" with no Start Chat, plus the modal sentence, and the Expert was restored. Row 3 is honestly scoped as a client-injected failure, and the record says it does not cover 267-FIX note #5.

### Owed-by-decision items (recorded — not gaps)

| Item | Recorded where |
|---|---|
| 8 cross-provider rows + multi-tool / parallel-thread / long-message | `279-VALIDATION.md` (⛔ owed by decision, D-17 + operator `ready`; parallel-thread first), STATE owed #2 |
| 267-FIX live note #5 (CR-03(c) snapshot-reconcile chip clear) | SEED-328 record row, VALIDATION, STATE owed #3 |
| IN-03 provider-docs-first check | SEED-328 record, VALIDATION, STATE owed #4 |
| D-18 cloud NULL-org Expert-thread READ before promotion | SEED-328 record §D-18, VALIDATION, STATE owed #1 |

### Anti-Patterns / bookkeeping findings

| File | Finding | Severity | Impact |
|---|---|---|---|
| `.planning/STATE.md` (owed #5, line 121) | Lists pre-review notes. The two 409 tests in it were FIXED by review WR-06 (`16e355582`), so the row is stale. The review's 6 INFO items (IN-01..IN-06), the WR-02 legacy NULL-org continuation residual and the catalog-subtitle copy observation are absent. They exist only in `279-REVIEW-FIX.md` | ⚠ WARNING (bookkeeping) | An owed item that lives only in a review-fix report is invisible to the next phase's sweep |
| `.planning/STATE.md:58-61` | Still reads "pending verification … then `/gsd:code-review 279`", but the review and its fixes have landed | ℹ INFO | Stale position line |
| `279-SEED-328-RECORD.md` | Written before the review. Its "Drive note: Dropped r→r" row cites `ce45c7e15`, which the review found under-stated (WR-03, fixed in `a2a0b55d5` with a second new fixture). Its "Review notes carried" item 2 (the two 409 tests) was fixed by WR-06. The record does not mention either follow-up | ℹ INFO | The verdicts are still correct (fixed). The proof column is incomplete |
| added source lines since base | No TBD / FIXME / XXX | — | — |

### Human Verification Required

**1. Route the review's INFO items and the follow-up residuals**

- **Test:** Decide whether IN-01..IN-06 from 279-REVIEW, the WR-02 legacy NULL-org continuation residual, and the catalog subtitle observation are owed work or accepted. Record them in STATE.md "Owed from Phase 279" either way, and correct row 5 there.
- **Expected:** Each one is visible in STATE.md as owed or accepted.
- **Why human:** This is an operator routing decision. No success criterion depends on it.

### Gaps Summary

No roadmap success criterion is unmet. The split is a proven pure move: an independent AST comparison at `fa164ef3e` matched all 26 bindings, the 267/268 fixtures are byte-equal, and imports run one way with no shim. Every SEED-328 item has a fixed or not-fixed row, and the seed reads `answered`. CR-03(b) is one helper at four doors and was refused live as the two-org user, with no writes. The gates match the base failing set.

The only open item is bookkeeping. The code review's 6 INFO findings and two follow-up residuals are recorded only in `279-REVIEW-FIX.md`, not in STATE or VALIDATION, and STATE's owed row 5 is stale.

---

_Verified: 2026-10-14_
_Verifier: Claude (gsd-verifier)_

## Resolution of the human_verification item (orchestrator, 2026-10-14)

The verifier returned `human_needed` for record-keeping only (4/4 success criteria verified). Resolved
by recording, in the same commit as this note:
- IN-01..IN-06, the WR-02 NULL-org continuation residual (operator ruling: `ready` without `strict`),
  the catalog subtitle, and the unpinned `ExpertDetailModal` copy → owed, non-blocking, in
  `279-VALIDATION.md` § "Still owed" and STATE.md "Owed from Phase 279" row 5.
- STATE.md row 5's stale 409-test entry → marked fixed by WR-06 `16e355582`; Current Position updated.
- `279-SEED-328-RECORD.md`: Dropped r→r row cites the WR-03 completion `a2a0b55d5`; carried note 2
  marked fixed by WR-06; an "After the phase review" section added.

The honesty gate's `OV-SOLO-01-status: NOT FOUND` line is EXPECTED and left as is: the marker was
deliberately not set when Gemini left (2026-09-29) because `live` would retro-flag 12 phases Gemini
genuinely reviewed (`e4f2ae3b4`; the explanatory sentence was dropped by the v4.5 archive `6fef90919`).
This file carries `verification_mode: self-verified`.


---
phase: 293-start-from-outside-and-close-out
verified: 2026-10-26T00:00:00Z
status: passed
score: 6/6 must-haves verified
overrides_applied: 0
re_verification: false
---

# Phase 293: Start From Outside, and Close Out - Verification Report

**Phase Goal:** An external system can start a workflow and read its result, every run shows how it was started, and the seed register matches what shipped.
**Status:** passed (initial verification)

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC#1 | Authenticated inbound call starts a published run, returns an id; second call reads status/result | VERIFIED | `backend/app/api/inbound.py` mounted in `main.py:929`. Live evidence in 293-VALIDATION.md (key run 4ab828a3 completed, output and one-time file link, re-driven after F-1). Targeted tests `test_293_inbound_start/status` pass. |
| SC#2 | No key, other-org key, unpublished workflow each refused | VERIFIED | VALIDATION SC#2 12/12 live; seven 404 bodies byte-identical; `test_293_key_auth.py`, `test_293_inbound_start.py` green. |
| SC#3 | Over-limit refused clearly; every call audited with credential and run | VERIFIED | Live: 10x201 then 429 with Retry-After; audit rows carry api_key_id/label and run_id. Review fixes present in code: per-key refusal audit throttle (`refusal_audit_slot`) and per-IP `enforce_ip_limit` in `inbound.py`. Note: repeated refusals now audit once per key/reason/minute with a `suppressed` count; successful calls are still audited every time. |
| SC#4 | Inbound payload cannot change tools or grants | VERIFIED | Live SC#4 (definition snapshot unchanged, values inside `<external_input>` envelope); `test_293_untrusted_fence.py`, `test_293_inbound_inputs.py`, `test_293_review_split_topic.py` pass; `envelope_values` present. |
| SC#5 | Schedule/key origin shown on run surface; workflow shows last and next run | VERIFIED | `RunOriginLine` used in `WorkflowRunPage.tsx:1305`; `_NEXT_SCHEDULE_LATERAL_SQL` / last-run lateral in `db/workflows.py`; `test_293_origin_reads/stamp` pass; live UI checks and G-4 steps 3, 4, 6 signed by operator. |
| SC#6 | SEED-163 delivered; folded seeds carry real status; register gate clean | VERIFIED | Ran `check-seeds-register.cjs`: OK, 381/381. `--require-settled` with the 13 intake ids: "all 13 settled". SEED-163 `status: shipped`; others answered/partially-answered/shipped, none `planted`. |

**Score:** 6/6

## Review fixes confirmed in code (293-REVIEW-FIX)

| Finding | Evidence |
|---|---|
| CR-01 kill switch on inbound + scheduler | `unattended_launch.workflows_disabled()`, used at `inbound.py:277,373`; `test_293_review_kill_switch.py` passes |
| CR-02 throttled refusal audits + per-IP limit before key resolution | `refusal_audit_slot` (`inbound.py:216`), `enforce_ip_limit` (`inbound.py:230`); `test_293_review_refusal_flood.py` passes |
| WR-01 absolute file URL | `test_293_review_file_link.py` passes |
| WR-02 per-key LATERAL | `db/api_keys.py:231` CROSS JOIN LATERAL; `test_293_review_key_calls.py` passes |
| WR-03 split_topic envelope | `inbound_inputs.envelope_values`; `test_293_review_split_topic.py` passes |
| WR-04 parse_definition_row refusal | `inbound.py:320`; `test_293_review_bad_definition.py` passes |

## Requirements Coverage

| Requirement | Status | Evidence |
|---|---|---|
| START-02 | SATISFIED | SC#1-4 above |
| START-04 | SATISFIED | SC#5 |
| REG-06 | SATISFIED | SC#6 |

No orphaned requirement IDs: REQUIREMENTS.md maps only START-02, START-04, REG-06 to Phase 293 (all still marked Pending/unchecked in REQUIREMENTS.md; the orchestrator should tick them at close).

## Behavioral Spot-Checks

| Check | Command | Result |
|---|---|---|
| All 293 unit suites | `pytest tests/unit -k 293 -q` (backend venv) | 280 passed |
| Seeds register | `node scripts/check-seeds-register.cjs` | OK |
| Settled gate | `--require-settled` x13 intake ids | all 13 settled |
| Migration present | `supabase/migrations/215_api_keys_and_run_origin.sql` | exists |

Live HTTP not re-probed (backend :8000 wedged, per instruction); live evidence taken from VALIDATION.md and evidence/, which is consistent with code and tests.

## Anti-Patterns
No TBD/FIXME/XXX in the inbound, api_keys, api_key_auth, unattended_launch or inbound_inputs files.

## Human Verification Required
None outstanding. Operator G-4 signed 2026-10-25 (steps 1-6 PASS; #9/#10 rest on component suites).

## Deploy items (not gaps)
Cloud migration 215 before backend deploy; `get_advisors(security)`; `check-deploy-drift`; SC#10 full provider roster (7 rows accepted as blocked by operator). Accepted deferrals: F-2, BUG-261025-01/02/03, IN-01..08, inherited failures (22 proven at base; backend baseline 70 <= 71).

## Gaps Summary
None. Residual observation: refusal audit rows are throttled by design (CR-02); SC#3 "every call writes an audit row" holds for successful calls and for the first refusal per key/reason/minute with a suppressed count.

---
_Verifier: Claude (gsd-verifier)_

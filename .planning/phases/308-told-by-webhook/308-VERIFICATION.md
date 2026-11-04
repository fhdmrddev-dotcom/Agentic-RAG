---
phase: 308-told-by-webhook
verified: 2026-11-04T00:00:00Z
status: human_needed
score: 5/5 roadmap success criteria verified (automated); G-4 rows 1-5 owed
overrides_applied: 0
gaps: []
deferred:
  - truth: "Public docs still say webhooks do not exist"
    addressed_in: "Phase 309"
    evidence: "309 SC#1: webhook signature verification snippets in the public docs; must land before 308 deploys"
human_verification:
  - test: "G-4 row 1 - add, test, verify (Settings -> Webhooks)"
    expected: "Secret-once card, test delivered 2xx, receiver request verifies with standardwebhooks, endpoint listed On with one webhook.test row"
    why_human: "Live UI + external receiver"
  - test: "G-4 row 2 - exactly one delivery each (run on a non-default provider + a document ingest)"
    expected: "One run.finished and one document.ingested row, links open the items"
    why_human: "Live UI/runs"
  - test: "G-4 row 3 - failing receiver -> retries -> Off - kept failing -> Waiting-on-you row"
    expected: "Per 308-VALIDATION.md; drive on LOCAL DB via tick(now=) or SQL next_attempt_at"
    why_human: "Visual, multi-step"
  - test: "G-4 row 4 - refusal wording for http://169.254.169.254/ and an internal host"
    expected: "Exactly the one sentence, typed value kept, nothing saved"
    why_human: "DOM copy"
  - test: "G-4 row 5 - org admin turn-off, member card reads Off - turned off by an org admin"
    expected: "Admin table shows host only (CR-01 fix), receipt, audit row"
    why_human: "Two-role UI flow"
  - test: "Review-fix behavior WR-01/02/03/05 (REVIEW-FIX marks them requires-human)"
    expected: "Endpoint turned off mid-claim is not sent to; blackholed endpoint does not stall others; oversized 2xx body counts delivered; WR-05 per REVIEW-FIX"
    why_human: "Concurrency / state handling beyond what the live tests exercise"
---

# Phase 308: Told by Webhook - Verification Report

**Phase Goal:** A member's own systems receive a signed, thin event when a run finishes, a run waits on a person, or a document is ingested: exactly one per endpoint, retried and logged, never sent to an internal address or about an item the owner can no longer see.
**Status:** human_needed (all automated must-haves hold; G-4 lived-experience rows owed)
**Re-verification:** No - initial

## Observable Truths (ROADMAP SC 1-5)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Member adds https endpoint, picks events, sends test; verifies with `standardwebhooks`; roll keeps both signatures; payload thin and through redaction guard | VERIFIED (UI flow owed to G-4 row 1) | `backend/app/api/webhooks.py` routes POST/PATCH/roll-secret/`/test`; `webhook_signer.py`; `test_308_signer_interop.py` uses reference lib (in the 516 unit pass); payload models text-free, `textless_ok` guard |
| 2 | Every run-finish and ingest path emits exactly one event per endpoint with two workers; webhook-id stable across retries | VERIFIED | Triggers-only emission in `supabase/migrations/225_webhooks.sql` (run trigger lines 216-262, two document triggers 298-306, partial unique index `webhook_events_run_finished_once`); `test_308_emission_matrix_live.py` and `test_308_drainer_once_live.py::test_two_drainers_send_one_event_exactly_once` (orchestrator: 154 integration passed, 0 skipped) |
| 3 | Retry with backoff; log with status/latency, no body; resend; auto-disable + in-app notice | VERIFIED (visual owed, row 3) | Outbox/drainer, attempts table holds words only (db/webhooks.py docstring: no body column), `/deliveries` + `/resend` routes, `webhook_disabled` notice with unique open-per-endpoint index in mig 225; `test_308_notice_live.py` |
| 4 | Not sent if owner can no longer see the item; internal/loopback/metadata refused at save and at send incl. DNS flip and redirects | VERIFIED | Drainer visibility via owner's acting RLS connection + `principal_still_allowed` liveness (`webhook_drainer.py` 136-148, 335-338, 397-402); egress `webhook` capability (https only, caller host, `egress.py` 336/358/382); save-time `validate_destination`; `test_308_visibility_live.py`; SSRF corpus unit tests |
| 5 | Org admin lists, disables, deletes endpoints | VERIFIED (UI owed, row 5) | `org_router` GET/disable/enable/delete in `api/webhooks.py` 589-670, registered `main.py:998`; CR-01 fix masks host/path from admins |

**Score:** 5/5

## "How we'd know this failed" check

| Failure condition | Result |
|---|---|
| Two workers send twice | Absent: SKIP LOCKED claim + 'sending' flip; two-drainer live test passes |
| A path emits nothing | Absent: triggers on workflow_runs and documents (INSERT + UPDATE) cover all writers; emission matrix covers finish_run, handoff SQL, ask re-drive, reconciler sweep, splice, ingest_document, bulk sweep |
| Trigger error breaks finalization | Absent: SECURITY DEFINER bodies in `BEGIN ... EXCEPTION WHEN OTHERS THEN RAISE WARNING`; planted-failure test |
| Bypasses egress.py | Absent: sender uses `send_pinned_http`; one new capability only (WR-03 edit minimal, documented in ledger) |
| Log shows response body / payload carries doc text | Absent: no body column, typed text-free models |
| Secret in plain text | Absent: `secret_cipher`; 503 `no_cipher` with no fallback |
| anon-readable tables / advisors | Local: all 4 tables RLS on + REVOKE ALL from PUBLIC/anon/authenticated, service_role only; functions EXECUTE revoked from PUBLIC. `get_advisors(security)` on cloud is owed after the cloud paste (operator-gated) |
| Redis as record | Absent: Postgres outbox |
| Removed member's endpoint keeps receiving | Absent: liveness predicate -> `skipped_owner_gone` + endpoint off |

## Requirements Coverage

| Req | Plans | Status | Evidence |
|---|---|---|---|
| HOOK-01 | 01, 04, 05, 06 | SATISFIED | member routes + Settings tab; test route |
| HOOK-02 | 02, 03, 04, 05, 06 | SATISFIED | signer + interop test, rotation overlap, thin payload |
| HOOK-03 | 01, 03 | SATISFIED | triggers + exactly-once drainer + matrix |
| HOOK-04 | 01-06 | SATISFIED | retries, log, resend, auto-disable, notice |
| HOOK-05 | 02, 03, 04 | SATISFIED | visibility + liveness + SSRF at save and send |
| HOOK-06 | 04, 06 | SATISFIED | org_router + OrgWebhooks UI |

All six IDs appear in plan frontmatter and in REQUIREMENTS.md; no orphans. (REQUIREMENTS.md checkboxes still read Pending; bookkeeping flip belongs to the orchestrator at close.)

## Behavioral Spot-Checks

| Check | Result |
|---|---|
| `pytest backend/tests/unit -k 308` (run by me) | 516 passed |
| Integration `-k 308` | not run by me (forbidden); cited: 154 passed, 0 skipped |
| Backend baseline 70 <= 71, vitest gate OK, tsc no new error | cited from orchestrator, not re-run |
| Migration 225 file present, `full-schema.sql` carries webhook tables (44 refs) | confirmed |
| Debt markers (TBD/FIXME/XXX) in webhook files and mig 225 | none found |

## Anti-Patterns / Notes

- Info: IN-03 routed to a Phase 309 seed; IN-01 refuted; IN-02/04/05/07 documented in `deferred-items.md` (not goal-blocking).
- Info: pre-fix admin audit rows hold unmasked hosts, local DB only.
- Gate note: schema-drift gate bypassed by decision (`supabase db push` forbidden); local liveness via `scripts/check-migration-225-live.py`.

## Human Verification Required

See frontmatter: G-4 rows 1-5 (row 1 first; row 3 on local DB only) and the WR-01/02/03/05 requires-human items.

Also operator-gated, not gaps: cloud paste of 225 after 220-224 with per-action approval then `get_advisors(security)`; Phase 309 must correct the public docs before 308 deploys.

## Gaps Summary

No gaps. Every success criterion and failure condition is backed by code and green tests. Status is human_needed solely because the lived-experience rows and concurrency/state review fixes need a human or Chrome-driven pass.

---
_Verified: 2026-11-04_
_Verifier: Claude (gsd-verifier)_

---
phase: 308-told-by-webhook
plan: 03
subsystem: webhooks (delivery: outbox, drainer, retries, auto-disable, purge)
tags: [webhooks, outbox, drainer, exactly-once, visibility, liveness, retries]
requires:
  - "308-01: migration 225 (tables, emit triggers, notice kind), db/webhooks.py (insert_attempt, SKIP_PENDING_SQL, resend, roll)"
  - "308-02: webhook_sender.send / freeze_payload, webhook_signer, models/webhook builders"
provides:
  - "backend/app/db/webhook_outbox.py: claim_next_event, candidate_endpoints, insert_deliveries, fail_unfrozen_deliveries, mark_fanned_out, reclaim_stale_sending, claim_due_deliveries, renew_lease, record_outcome, skip_delivery, mark_success, register_failure, disable_endpoint, purge_old_events, erase_expired_previous_secrets, ClaimedWebhookDelivery"
  - "backend/app/services/webhook_drainer.py: WebhookDrainer (tick / start / stop), next_delay, endpoint_owner_allowed, visible_item_ids, audit_auto_disabled, the D-17 constants"
affects: [308-04 (main.py lifespan start/stop of WebhookDrainer), 308-06 (G-4 row 3: retries -> off -> notice)]
tech-stack:
  added: []
  patterns: ["300 outbox shape: SKIP LOCKED claim + in-transaction flip + attempts-matched lease renew", "one auto-disable winner via UPDATE ... AND enabled RETURNING", "pool-shaped shim over one connection to drive pool-taking writers inside a rolled-back transaction"]
key-files:
  created:
    - backend/app/db/webhook_outbox.py
    - backend/app/services/webhook_drainer.py
    - backend/tests/unit/test_308_no_body_scan.py
    - backend/tests/unit/test_308_drainer.py
    - backend/tests/integration/test_308_emission_matrix_live.py
    - backend/tests/integration/test_308_drainer_once_live.py
    - backend/tests/integration/test_308_visibility_live.py
    - backend/tests/integration/test_308_notice_live.py
  modified: []
decisions:
  - "register_failure returns the disabled row when THIS call won (else None), not a bare bool: the drainer needs the owner and org for the one audit"
  - "Every Syrel disable that wins is audited as webhook.endpoint.auto_disabled (failing, gone and owner_removed); only failing and gone write the notice (D-48)"
  - "A send that raises an unclassified exception is recorded failed / not_retried and never counted toward auto-disable (the request may have left; it is our fault, not the receiver's)"
  - "Nothing-sent failures (redaction_failed, secret_unreadable) write no attempt row and never count toward auto-disable"
  - "A previous key that will not decrypt is dropped with a warning (sign with the current only); only an unreadable CURRENT key is secret_unreadable"
  - "The record and skip UPDATEs match attempts as well as 'sending' (stronger than the plan's 'sending' guard)"
  - "start() schedules the loop with asyncio.ensure_future: the acceptance grep forbids create_task( in the drainer"
metrics:
  duration: "~1h40m"
  completed: 2026-11-04
  tasks: 3
  files: 8
---

# Phase 308 Plan 03: The webhook drainer and its outbox Summary

Webhooks now get delivered. Every worker runs a `WebhookDrainer`. It sends each event to each subscribed endpoint once, even with two workers racing. It keeps the `webhook-id` stable and re-signs every attempt. It never sends to an owner who has lost sight of the item or left the org, retries on the D-17 schedule, and turns a failing endpoint off with exactly one notice. All of this is proven on the real local database. Nothing is wired into `main.py` yet; that is 308-04's job.

## What shipped

**Task 1: `db/webhook_outbox.py`, the emission matrix, the no-body scan** (`8144b3c7d` RED, `f16112b0b` GREEN)
- Every statement is a module-level `*_SQL` constant, and an AST test pins that. The send claim is `FOR UPDATE OF d SKIP LOCKED` with `d.attempts < $3` and `ev.type <> 'webhook.test'`. The `'sending'` flip sets `attempts + 1` and `claimed_at` inside the same transaction. The renew, record and skip UPDATEs all match `status = 'sending' AND attempts = $n`. The stale reclaim marks a test delivery `failed` / `stale_lease` and never re-queues it (D-58). The reclaim uses `max_attempts` for real deliveries.
- Fan-out: `ON CONFLICT (endpoint_id, event_id) DO NOTHING`. Candidates are endpoints created no later than the event (Pitfall 10), plus the run owner's only for run events.
- `disable_endpoint` uses `UPDATE … AND enabled RETURNING`, so a single caller wins. In the same transaction it moves pending and retrying deliveries to `skipped_disabled` (reusing `webhooks.SKIP_PENDING_SQL`). It writes the notice for `failing` and `gone` only, with `ON CONFLICT` on the per-endpoint open index. `register_failure` is an atomic `+ 1 … RETURNING`.
- The purge is bounded, uses `FOR UPDATE SKIP LOCKED` and loops in batches. The erase of expired previous keys is one statement. No `httpx` import and no `insert_attempt` of its own.

**Task 2: `services/webhook_drainer.py`** (`76c398cb2` RED, `c9ef791ee` GREEN)
- Constants: `(0, 30, 300, 1800, 7200, 28800)`, 6 attempts, disable after 5, purge hourly, 30 days, ±10 % jitter. Defaults: poll 20 s, batch 20, lease 600 s.
- Fan-out:
  - Run events go to the owner's endpoints.
  - Document events ask visibility once per owner on that owner's acting connection. An owner who can't see the document gets no row.
  - Liveness is checked once per owner. A refused owner gets `skipped_owner_gone` and, after the commit, the endpoint is disabled with reason `owner_removed`.
  - The payload is frozen once through `webhook_sender.freeze_payload`. If that returns `None`, every delivery is set to `failed` / `redaction_failed`.
- Send order: enabled → liveness → visibility (one call per (owner, org, table) per pass) → lease renew → keys (the previous key only while unexpired) → sign at this attempt's `now` → awaited send → record.
- The outcome table follows D-17/18/19 (see the module docblock). Logs carry ids and outcome words only.
- `principal_still_allowed(` appears 1 time and `acting_member_connection(` 1 time. These appear 0 times each: `org_members`, `is_org_member`, `banned_until`, `textless_ok`, `create_task(`, `AsyncClient`, `app.db.retention`.

**Task 3: the live proofs** (`80d01d747`)
- `test_308_drainer_once_live` (8):
  - Two drainers in `gather` produce one delivery row and one send. Two endpoints get one call each.
  - WR-03, both halves: a reclaimed-then-sent row, and a reclaimed-and-re-claimed row still `sending` at attempt 2. Neither is sent by the losing worker.
  - A stale test delivery ends `failed` / `stale_lease` and is never sent.
  - A 503 sets `retrying` at +27..33 s; at +40 s it is `sent`, with two attempt rows (503, 200). A resend makes a third call. All three carry `msg_<event id>`, timestamps +0 / +40 / +300, three different signatures and the same body bytes.
  - A roll signs new-then-old during the overlap, and once after it. The hourly tick erases the old key.
  - With redaction on, the frozen bytes equal the off bytes exactly.
- `test_308_visibility_live` (6), with real liveness and real RLS:
  - A private document produces no row for the other member.
  - A document in an org-shared folder reaches both members (the positive arm).
  - A document moved to another org after fan-out ends `skipped_not_visible`.
  - An owner removed after or before fan-out ends `skipped_owner_gone`, the endpoint is disabled with `owner_removed`, there are 0 notices and nothing is sent.
  - Member B's run never reaches A's endpoint.
- `test_308_notice_live` (5):
  - Five 400s turn the endpoint off for `failing`: 5 `failed`, 1 `skipped_disabled`, one open notice and one audit (actor fields: endpoint id, host). `list_open_notices` lists and counts it. The email `CLAIM_SQL` claims nothing for it, and it has 0 `notification_deliveries`. Re-enabling closes it with `endpoint_enabled`.
  - Two drainers racing the fifth failure produce one notice and one audit. Four `register_failure` callers racing at the threshold produce one winner.
  - A 410 turns the endpoint off for `gone`, with one notice and a `gone` audit.
  - Deleting the endpoint removes its notice.
- **Planted defects were driven RED, and the file was restored byte-identical with `cmp`.** Removing `AND enabled` from `DISABLE_SQL` fails the two race tests. A renew that ignores `attempts` first passed every test. That exposed a gap: the WR-03 "re-claimed elsewhere" case was not covered. I added it, and it now goes RED under that defect.

## The emission matrix (D-08 b): 36 cases, no SKIPPED

| Writer | Driven through | Cases → events |
|---|---|---|
| `db/workflows.finish_run` | **real function** (pool shim, rolled back) | 4 origins (app/schedule/key/mcp) × completed/failed/cancelled = 12 → 1 `run.finished` each, carrying status + origin_kind |
| `run_handoff._GUARDED_TERMINAL_SQL` | **real `end_run`** | 3 statuses → 1 each; a second guarded end loses and adds 0 |
| `api/runs.py` ask re-drive failure | **real `_fail_redrive`** | 1 → 1 (`failed`, origin `key`) |
| `run_reconciler` boot sweep | the **exact `end_run(..., from_statuses=("active",), reason=_REASON_WORKFLOW)` call** the sweep makes per row (the sweep's own row selection scans the whole dev DB, so it is not run) | 1 → 1 |
| `pause_run` / `resume_run` | **real functions** | pause → 1 `run.waiting`; resume + pause → 2 |
| same-value rewrite, refused second terminal, golden run | real `finish_run` | 1 / 1 / 0 |
| recipients | real `finish_run` | only another member's endpoint → 0; owner + other → 1; unsubscribed / disabled / no endpoint → 0 (3 cases) |
| `cap_paused` (D-43) | pin on `pg_get_triggerdef` + `prosrc` | in the set |
| planted failure (D-06) | NOT VALID `CHECK (false)` on webhook_events | the status write lands, 0 events, a `swallowed` WARNING arrives |
| `ingest_splice` completion | its **exact SET list** via asyncpg **and** via **local PostgREST** (service role, committed row) | 1 each |
| `ingest_document` completion | its exact SET list (incl. metadata, thread_key) via asyncpg | 1 |
| `ingestion_jobs` bulk sweep | **real `reconcile_finished_job_documents`** | 2 processing rows → 1 each |
| re-ingest | completed → pending → processing → completed | +1 (2 total) |
| completed INSERT (D-47 defence) | asyncpg | 1 |
| dedup | **real `mint_document_row`** on PostgREST | 0 new documents, 0 new events |

## Verification

- All six 308-03 suites run together: **191 passed, no SKIPPED** (`-rs`). That is 36 matrix + 8 + 6 + 5 live, 77 drainer unit, and 59 scan cases.
- `node scripts/check-hot-file-ledger.cjs .planning/phases/308-told-by-webhook` → `ledger gate OK`. The two new files' rows were planted by the planner and are unchanged here; 308-06 records the shipped triple.
- `git diff --stat f587e3470 -- backend/app/services/ingestion_queue_service.py` is empty (D-37).
- **Backend unit baseline gate: PASSED. 70 failed, 12708 passed, 1 skipped, 2 xfailed, 2 xpassed, 0 errors (ceiling 71).**
  - **Failing set:** 70 ids in 23 files. That matches wave 1's 70 in the same 23 files: test_061_consumer, test_071_1_threadpool_sweep, test_111_1_reembed_kickoff, test_190_review_fix_data_layer, test_200_1_phase_output_shape, test_300_me_preferences_email, test_chat_tool_approval, test_cross_worker_cancellation, test_db_runs, test_explorer_agent, test_extraction_service, test_forced_emit, test_get_model_capability_inference, test_lifespan, test_module7_tools, test_multimodal_query, test_per_format_ingestion, test_phase56_iteration_start, test_published_workflow_ownership, test_retrieval_service, test_sandbox_service, test_sql_service and test_streaming_reliability.
  - None of the failures is a 308 file. This plan modifies only new files, so every failing file is byte-unchanged by it. No new failing id. I did not re-run the 70 ids at the base; they match by count and file set.
- The local-DB lock was taken for the plan and removed at the end. The lock file does not exist.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] Test gap: the WR-03 attempts half was not covered**
- **Found during:** Task 3 (planted-defect drive)
- **Issue:** A renew that matched `'sending'` alone passed every live test, because the reclaim test's winner had already finished (`sent`).
- **Fix:** Added `test_a_row_reclaimed_and_claimed_again_elsewhere_is_not_sent_by_its_first_worker`, which goes RED under that defect.
- **Commit:** `80d01d747`

### Plan adjustments (recorded, no behaviour beyond the plan)

1. **The Task 1 RED was the scan, not the matrix.** The matrix proves 308-01's triggers, which already existed, so it passed when written (36/36). The no-body scan was the RED: it failed on import. The matrix is evidence for SC#2, not a RED gate.
2. **The no-body scan's two drainer cases stayed red between the Task 1 GREEN and the Task 2 GREEN.** The scan covers `webhook_drainer.py`, which Task 2 creates. They went green in `c9ef791ee`.
3. Return values and helpers beyond the plan's list (see `decisions`):
   - `register_failure` returns a row or None.
   - `record_outcome(..., attempted=)`.
   - `fail_unfrozen_deliveries`.
   - `audit_auto_disabled` and `EndpointOwner`.
   - `start()` uses `ensure_future`.
4. **No defect was exposed in `webhook_drainer.py` or `webhook_outbox.py`, so there is no `fix(308-03)` commit.**

## Known Stubs

None. The drainer is complete but not started anywhere. 308-04 adds the `main.py` lifespan start/stop (D-50), and until then nothing is delivered in a running app.

## Threat Flags

None beyond the plan's register. T-308-17, -08, -09, -07, -12, -13, -14 and -19 are each mitigated and proven by a named test above.

## TDD Gate Compliance

- Task 1 has `test(...)` `8144b3c7d`, then `feat(...)` `f16112b0b`.
- Task 2 has `test(...)` `76c398cb2`, then `feat(...)` `c9ef791ee`.
- Task 3 is test-only by design. It exercises code from Tasks 1 and 2, so it has no `feat` commit.

## Self-Check: PASSED

- All 8 created files exist on disk.
- Commits 8144b3c7d, f16112b0b, 76c398cb2, c9ef791ee and 80d01d747 are present in `git log`.
- The local-DB lock file is removed.
- STATE.md and ROADMAP.md are untouched.

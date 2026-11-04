---
phase: 308-told-by-webhook
plan: 01
subsystem: webhooks (data model + data layer + notice read path)
tags: [webhooks, migration, triggers, outbox, rls, notifications]
requires: []
provides:
  - "migration 225: webhook_endpoints / webhook_events / webhook_deliveries / webhook_delivery_attempts (deny-all)"
  - "webhook_emit_run_event() + webhook_emit_document_event() with three triggers"
  - "backend/app/db/webhooks.py (route-facing data layer; insert_attempt shared with 308-03)"
  - "LIST_OPEN_SQL + WaitingNotice carry the webhook_disabled notice"
affects: [308-03, 308-04, 308-05, 308-06]
tech-stack:
  added: []
  patterns: ["218 swallow-and-warn trigger frame", "224 deny-all block", "api_keys owner-predicate CRUD", "pydantic wrap serializer to keep a wire shape byte-identical"]
key-files:
  created:
    - supabase/migrations/225_webhooks.sql
    - scripts/check-migration-225-live.py
    - backend/app/db/webhooks.py
    - backend/tests/unit/test_308_migration_225_static.py
    - backend/tests/unit/test_308_check_script.py
    - backend/tests/integration/test_308_schema_privileges_live.py
    - backend/tests/integration/test_308_db_live.py
    - backend/tests/integration/test_308_notice_list_live.py
  modified:
    - supabase/full-schema.sql
    - scripts/full-schema-supplement.sql
    - backend/app/services/audit_service.py
    - backend/app/db/notifications.py
    - backend/app/api/notifications.py
    - docs/public/api/openapi.snapshot.json
    - docs/public/api/openapi.public.json
    - backend/tests/integration/test_110_audit_drift_guard.py
    - backend/tests/unit/test_293_migration_215.py
    - backend/tests/unit/test_298_migration_217_shape.py
    - backend/tests/unit/test_301_notifications_route.py
decisions:
  - "LIST_OPEN_SQL selects run notices as kind <> 'webhook_disabled' (not IN ('question','approval')): the 300 fence forbids a quoted 'question' literal; equivalent under the 225 kind CHECK"
  - "WaitingNotice omits endpoint_id/reason/title/title_is_address on a run notice (wrap serializer), so run notices serialise with exactly the pre-308 eight keys"
  - "An admin turn-off overrides any other disabled_reason (failing/gone -> admin) so the owner cannot undo it; the owner path only turns off an enabled endpoint"
  - "Extra FK-cascade indexes: webhook_deliveries(event_id), webhook_events(endpoint_id) partial, notifications(endpoint_id) partial"
metrics:
  duration: "~1h45m"
  completed: 2026-11-04
  tasks: 3
  files: 19
---

# Phase 308 Plan 01: webhook data model, data layer and notice read path Summary

Migration 225 adds four deny-all webhook tables. Swallow-and-warn definer-rights triggers emit at most one event per status change. `db/webhooks.py` puts the owner check in every statement, and "Waiting on you" now lists and counts a webhook that was turned off for failing or gone. 225 is applied to the local DB only and nothing is sent yet.

## What shipped

**Task 1 — migration 225** (`e10d5cce5` RED, `6aef072a2` GREEN)
- The four tables all have RLS on and no policy. ALL is revoked from PUBLIC (first), anon, authenticated and service_role, then ALL is granted to service_role. A secret can only be stored as `enc:v1:` ciphertext, and the same rule applies to the previous secret. Named `webhook_endpoints_url_check` requires https, no fragment, no userinfo and at most 2048 characters. The description is at most 100 characters, and event types must be non-empty and among the three subscribable ones.
- Two walls stop duplicates (D-07): `webhook_events_run_finished_once` (partial UNIQUE on item_id where type is `run.finished`) and `webhook_deliveries_endpoint_event_uq`. No delivery or attempt column holds a body, a response or headers.
- `webhook_emit_run_event` fires on UPDATE OF status only. It skips golden runs and runs with no owner, keeps `cap_paused` in its set, and only emits when one of the owner's enabled endpoints in that org subscribes. `webhook_emit_document_event` is attached to two triggers, insert-when-completed and update-into-completed (D-47). Both functions run SECURITY DEFINER with `search_path = ''` and wrap their body in `EXCEPTION WHEN OTHERS THEN RAISE WARNING`. EXECUTE is revoked from PUBLIC first.
- The real notifications CHECK names found locally were **`notifications_kind_check`** (`question`, `approval`) and **`notifications_closed_reason_check`** (`answered`, `run_ended`). Both are restated: kind adds `webhook_disabled` and closed_reason adds `endpoint_enabled`. Also added: `run_id` is now nullable, `endpoint_id` references the endpoint with ON DELETE CASCADE, `notifications_kind_shape_check`, and `notifications_one_open_per_endpoint`.
- The audit CHECK is 217's 40 literals plus the nine `webhook.endpoint.*` literals. `VALID_ACTION_TYPES` gained the same nine (9 lines, no removals).
- Applied to 127.0.0.1:54322 **twice**; the second run was a clean no-op. `check-migration-225-live.py` prints `225 live`. `full-schema.sql` was regenerated without `--reset`; its diff holds only 225 objects. `check-greenfield-privileges.py` printed OK. The supplement gained a `-- migration 225 —` block.

**Task 2 — `backend/app/db/webhooks.py`** (`5dff30277` RED, `90956b214` GREEN)
- The data layer covers endpoint create, list and get, signing reads, update, on/off, roll and delete. It also covers the admin org list (`owner_name`, `owner_is_member`), the keyset delivery log, test delivery create and record, resend, and `insert_attempt`. `insert_attempt` is the one attempt insert, and 308-03 reuses it.
- A member can have at most 10 endpoints per org. The count and the insert run under an advisory transaction lock, and a test with 12 concurrent creates yields exactly 10. A roll keeps the previous secret for 24 h, and a second roll drops the oldest. `EndpointAdminOff` is returned, not raised, and the route maps it to 403. Turning an endpoint on resets the failure count and closes the open notice with `endpoint_enabled`. `changed_now` lets the routes skip a second audit row. A test delivery never touches `consecutive_failures` or `last_success_at`.

**Task 3 — notice read path** (`f43cd31da` RED, `1c19c7d00` GREEN)
- In `LIST_OPEN_SQL`, the org_members and organizations joins stay INNER (P-8). The runs and definitions joins are now LEFT, `webhook_endpoints` is joined LEFT, and each kind gets its own wall in the WHERE. The title is the endpoint's description, else host + path; the query string is never selected. `total` counts the webhook row. `CLAIM_SQL` and `STILL_WAITING_SQL` are untouched, and a live test shows the email drainer claims nothing for a webhook notice.
- `WaitingNotice` is widened, and the constructor passes every new key explicitly. The OpenAPI snapshot and public spec are regenerated (WaitingNotice only), and `build-public-openapi --check` is OK.

## Verification

- 308 live and static suites: test_308_migration_225_static, test_308_check_script, test_308_schema_privileges_live (111 together), test_308_db_live (12) and test_308_notice_list_live (7) all pass with **no SKIPPED line**.
- Existing suites rerun green: test_300_notice_triggers_live, test_300_rls_anon_live, test_110_audit_drift_guard, the 110/116/223 audit live tests, and the 293/298/275/audit_service unit suites.
- **Backend unit baseline gate: PASSED — 70 failed / 12361 passed / 2 xfailed / 2 xpassed / 0 errors (ceiling 71).**
- **Failing-set diff.** The 70 failures sit in 23 files, and this plan modified none of them. Most sit in suites with long-standing rot (`test_retrieval_service` 15, `test_sql_service` 12, `test_explorer_agent` 6, `test_multimodal_query` 5, `test_111_1_reembed_kickoff` 4, and others). The only notification-adjacent failure is `test_300_me_preferences_email::test_no_notifications_route_ships_in_this_phase`, which asserts that `/notifications` does not exist; it has been red since 301 mounted that route. `test_lifespan` fails with a MagicMock-await TypeError unrelated to audit. The 70 equals the recorded 71 minus one, so no new failing id was found. This is not proven by a base re-run: I did not check out the base and re-run the 70 ids.
- `node scripts/check-hot-file-ledger.cjs .planning/phases/308-told-by-webhook` → ledger gate OK.
- The local-DB lock was taken for the plan and removed at the end; the lock file does not exist.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Three exact-set audit pins went red because of the D-31 lockstep**
- **Found during:** Task 1
- **Issue:** `test_110_audit_drift_guard` (exact 40), `test_293_migration_215` (allowed later additions = only `org.item.move`) and `test_298_migration_217_shape` (VALID ⊆ 217) all failed on the nine new literals.
- **Fix:** I re-pinned all three on purpose, naming the nine and migration 225 (49 in total). The 298 subset assertion now exempts exactly the nine `webhook.endpoint.*` types.
- **Commit:** `6aef072a2`

**2. [Rule 1 - Bug] The 300 SQL fence forbids a quoted `'question'` literal**
- **Found during:** Task 3
- **Issue:** The plan's WHERE used `n.kind IN ('question','approval')`. `test_no_sql_constant_selects_message_text_or_prompt_keys[LIST_OPEN_SQL]` refuses any quoted `'question'`.
- **Fix:** I used `n.kind <> 'webhook_disabled'`, which is equivalent because the 225 kind CHECK allows only three kinds, and documented it in the docblock. The 301 route test's fake row gained the four NULL columns the SQL now selects.
- **Commit:** `1c19c7d00`

**3. [Rule 2 - Correctness] Indexes for the cascades and the purge**
- I added `webhook_deliveries_event_idx`, `webhook_events_endpoint_idx` (partial) and `notifications_endpoint_idx` (partial). Without them, a delete that cascades through these foreign keys (the 30-day purge, an endpoint delete) scans the whole table.

**4. Live privileges test guarded by `requires_pg` only (the 307 shape), not `requires_225`**
- The plan asked for a `requires_225` skip probe on Task 1's live test. With that probe the RED run would have *skipped*, not failed. Following the 307 precedent, the file fails before 225 is applied; Tasks 2 and 3 use `requires_225` as planned, since 225 was already live. The privileges test also covers emission: one `run.finished` per run, golden runs and unsubscribed orgs emit nothing, `run.waiting` fires on pause, and `document.ingested` fires on completion and on a completed insert.

**5. Plan acceptance `grep -c "webhook.endpoint." audit_service.py = 9`** counts lines, so the nine literals sit one per line.

## Notes for downstream plans

- **308-03:** a test delivery is created in `sending`. The drainer's stale-lease reclaim must skip `webhook.test` events, or a crashed test send would be retried.
- **308-04:** `create_endpoint` raises `EndpointCapReached`. `set_endpoint_enabled` returns `EndpointAdminOff`, and its `reason` argument must be None on the owner path (a ValueError otherwise). `update_endpoint`'s `description` uses a sentinel: leaving it out means unchanged, and passing None clears it.
- **308-06:** the backend `WaitingNotice` now carries `title_is_address`. The frontend type and its consumer still need the webhook arm.

## OWED (operator)

- **Cloud paste of 225 OWED after 220 -> 221 -> 222 -> 223 -> 224, BEFORE the 308 backend deploy, then get_advisors(security).** The backend refuses to boot without 225 (`assert_action_types_synced`). No cloud or Supabase MCP write was made.
- A backend restarted locally on this code needs 225, which is already applied to the local DB.

## Known Stubs

None. Nothing is sent yet by design; the drainer is 308-03.

## Threat Flags

None beyond the plan's threat register. Every T-308-10/11/06/13/17/19/18 mitigation is implemented and proven by a test.

## Self-Check: PASSED

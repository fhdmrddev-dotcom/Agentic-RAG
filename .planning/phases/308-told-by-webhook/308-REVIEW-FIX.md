---
phase: 308-told-by-webhook
fixed_at: 2026-11-04T00:00:00Z
review_path: .planning/phases/308-told-by-webhook/308-REVIEW.md
iteration: 1
findings_in_scope: 10
fixed: 8
skipped: 2
status: partial
---

# Phase 308: Code Review Fix Report

**Fixed at:** 2026-11-04
**Source review:** `.planning/phases/308-told-by-webhook/308-REVIEW.md`
**Iteration:** 1

**Scope (as delegated):** CR-01 and WR-01..WR-06, plus IN-01, IN-03 and IN-06 only where each is ≤ ~10 lines and clearly safe. IN-02, IN-04, IN-05 and IN-07 were out of scope and are left documented in the review.

**Summary:**
- Findings in scope: 10 (CR-01, WR-01..WR-06, IN-01, IN-03, IN-06)
- Fixed: 8 (CR-01, WR-01..WR-06, IN-06)
- Skipped: 2 (IN-01, IN-03)

Each fix landed as a failing test commit (`test(308): …`, RED confirmed before the fix), then the fix commit (`fix(308): <ID> …`). All commits were made by path, with hooks on. Each fix that changes a decision's mechanics adds a D-NN line under "Added after research" in `308-CONTEXT.md`: D-59 to D-65.

## Fixed Issues

### CR-01: Admin view and audit rows show receiver tokens

**Files modified:** `backend/app/services/webhook_urls.py`, `backend/app/api/webhooks.py`, `backend/app/services/webhook_drainer.py`, `frontend/src/components/org/OrgWebhooks.tsx`, `frontend/src/components/settings/webhooks/webhooksCopy.ts`, `frontend/src/lib/api/webhooks.ts`, `308-CONTEXT.md` (D-59)
**Commits:** `878b860f9` + `c0ffc8f5d` (tests), `534e55add` (fix)
**Applied fix:** The admin row now shows only a display host and a neutral "path hidden" marker. `path` is `/…` when the URL has any path beyond `/`, otherwise `""`. No path segment reaches an admin, whatever its length. The new `display_host()` masks a token-looking leftmost label of a name with 3 or more labels as `…`. A label is token-looking if it has 12+ characters, or if it is a hex/digit run of 6+ characters that contains a digit (Pipedream and ngrok shapes). A registrable domain and an IP literal are kept. Every `webhook.endpoint.*` audit row (route and drainer) records that same display host. The admin cell renders `host` alone, never `path`, plus "path hidden" / "query hidden" / "path and query hidden", so even a server that sent a path could not show it. The admin description now says addresses show the host only.
**Tests:** `test_admin_display_hides_a_zapier_catch_hook_path_entirely` (the exact review case `https://hooks.zapier.com/hooks/catch/1234567/abc1234/`), `test_admin_display_hides_every_path_and_drops_the_query`, `test_admin_display_with_no_path_says_nothing_is_hidden`, `test_admin_display_short_segments_are_hidden_too`, `test_display_host_masks_a_token_looking_leftmost_label` (Pipedream, ngrok, long label; ordinary names, a registrable domain and an IP are kept), `test_cr01_a_real_zapier_catch_hook_never_reaches_the_admin`, `test_cr01_a_token_in_the_host_is_masked_in_the_list_and_the_audit`, `test_cr01_the_auto_disable_audit_masks_a_token_in_the_host`. Frontend tests: `OrgWebhooks.test.tsx` "CR-01: renders the host only — a raw path from the server never reaches the screen", plus updated row and sheet assertions; `webhookFacts.test.ts` pins the new sentences.
**Note:** Audit rows written before this fix still hold the unmasked host. They exist only in the local DB, because 308 is not deployed.

### WR-01: Turning off or editing an endpoint did not stop deliveries already claimed

**Files modified:** `backend/app/db/webhook_outbox.py`, `backend/app/services/webhook_drainer.py`, `308-CONTEXT.md` (D-62)
**Commits:** `288cb1fa7` (tests), `ce0653d00` (fix)
**Applied fix:** `RENEW_LEASE_SQL` is now `UPDATE … FROM webhook_endpoints e … RETURNING e.enabled, e.url, e.secret_ciphertext, e.previous_secret_ciphertext, e.previous_secret_expires_at`. It is still guarded by `status = 'sending' AND attempts = $n`. `renew_lease` returns that fresh endpoint row, or `None` when the lease is lost. The drainer applies the fresh row over the claim snapshot. If the endpoint is off, the delivery becomes `skipped_disabled` (attempts-guarded) and nothing is sent. If the URL was edited or the secret rolled, the send uses the new values. The claim-time `enabled` check stays as the cheap early skip.
**Tests:** unit `test_wr01_an_endpoint_turned_off_after_the_claim_is_skipped_not_sent`, `test_wr01_an_endpoint_whose_url_changed_after_the_claim_gets_the_new_url`, `test_wr01_a_secret_rolled_after_the_claim_signs_with_the_new_secret`, `test_wr01_the_renew_reads_the_endpoint_in_the_same_statement`; live `test_wr01_an_endpoint_turned_off_after_the_claim_is_never_sent_to`, `test_wr01_a_url_changed_after_the_claim_is_where_the_row_goes`.
**Status:** fixed: requires human verification (this is a state-handling change; the logic is covered by the live tests).

### WR-02: One blackholed endpoint could stall delivery for every org

**Files modified:** `backend/app/db/webhook_outbox.py`, `backend/app/services/webhook_drainer.py`, `backend/tests/integration/test_308_notice_live.py` (opts in to cap 5), `308-CONTEXT.md` (D-63)
**Commits:** `f604d6dc9` (tests), `b7b082018` (fix)
**Applied fix:** A send pass now runs its claimed rows concurrently through `asyncio.gather` under a `Semaphore(SEND_CONCURRENCY = 5)`. `CLAIM_DELIVERIES_SQL` ranks due rows per endpoint in a CTE using `row_number() OVER (PARTITION BY d.endpoint_id …)`, and the outer `FOR UPDATE OF d SKIP LOCKED` takes `rn <= $4`. That gives `MAX_PER_ENDPOINT_PER_PASS = 2`. The outer WHERE repeats the due test, so a locked row is re-checked exactly as before. Exactly-once does not change: each row is its own claim, renewed and recorded under its own guard. `_PassCache` holds one `asyncio.Lock` per key, so liveness and visibility are still asked once per pass under concurrency. Both values are constructor knobs. The live notice test, which needs five failures of one endpoint in one pass, passes `max_per_endpoint_per_tick=5`.
**Tests:** `test_wr02_a_blackholed_receiver_does_not_hold_up_the_other_rows`, `test_wr02_no_more_than_the_cap_are_in_flight_at_once`, `test_wr02_liveness_and_visibility_are_still_asked_once_under_concurrency`, `test_wr02_the_claim_caps_rows_per_endpoint`, `test_wr02_the_claim_sql_ranks_rows_per_endpoint`, `test_the_constants`; live `test_wr02_the_claim_takes_at_most_two_rows_per_endpoint_per_pass`.
**Status:** fixed: requires human verification (concurrency change).

### WR-03: A large 2xx body was recorded failed and counted toward auto-disable

**Files modified:** `backend/app/security/egress.py` (G-5 minimal: one class attribute on each size exception, plus one `except` arm before `finally`), `backend/app/services/webhook_sender.py`, `backend/app/services/webhook_drainer.py`, `backend/tests/unit/test_308_drainer.py`, `CLAUDE.md` + `docs/HOT-FILE-LEDGER.md` (egress row and a refresh section in the same commit), `308-CONTEXT.md` (D-61)
**Commits:** `1093dd633` (tests), `f63aa87d4` (fix)
**Applied fix:** `send_pinned_http` already reads the status before the body. It now sets `status_code` on `EgressResponseTooLarge` / `EgressResponseUndecodable` when it raises; every raise site and every security property is unchanged. `webhook_sender._classify_exception` classifies by that status: 2xx is delivered, 408 / 429 / 5xx is retried, 410 is gone. Any other status, or no status, stays `response_too_large` and is not retried. The drainer never counts `response_too_large` toward auto-disable. The old parametrize row that pinned `response_too_large` as counting was removed in the fix commit; the new test pins the opposite.
**Why egress was edited rather than only the sender:** the sender cannot learn the status any other way short of building its own transport. That would mean opening an HTTP layer of its own, which breaks the "no client of its own" binding.
**Tests:** `test_wr03_an_oversized_2xx_body_is_delivered[content-length|streamed]`, `test_wr03_an_undecodable_2xx_body_is_delivered`, `test_wr03_a_503_with_an_oversized_body_is_retried`, `test_wr03_a_410_with_an_oversized_body_is_gone`, `test_wr03_another_status_with_an_oversized_body_stays_response_too_large`, `test_wr03_classify_reads_the_status_on_the_size_exceptions`, `test_wr03_egress_attaches_the_status_to_the_size_exception`, `test_wr03_a_response_too_large_failure_never_counts_toward_auto_disable`.
**Status:** fixed: requires human verification (classification logic).

### WR-04: `HTTPS://…` passed the app checks, then hit a 500 on the DB CHECK

**Files modified:** `backend/app/services/webhook_urls.py`, `backend/app/api/webhooks.py`, `308-CONTEXT.md` (D-60)
**Commits:** `0434dee4a` (tests), `fb6607fe9` (fix)
**Applied fix:** `check_webhook_url` now lower-cases the scheme and nothing else. The route stores the value it returns, so the stored URL is still exactly the sent URL, and migration 225's `url LIKE 'https://%'` agrees with the app rules. As a backstop, `asyncpg.CheckViolationError` on create and on update is mapped to the worded `invalid_url` 422 ("That isn't a web address.").
**Tests:** `test_wr04_the_scheme_alone_is_lower_cased` (`HTTPS://`, `Https://`, `hTTpS://`), `test_wr04_create_stores_an_upper_case_scheme_lower_case`, `test_wr04_patch_stores_an_upper_case_scheme_lower_case`, `test_wr04_a_check_violation_is_the_worded_422_not_a_500[post|patch]`.

### WR-05: Fan-out had no per-event failure bound

**Files modified:** `backend/app/db/webhook_outbox.py`, `backend/app/services/webhook_drainer.py`, `308-CONTEXT.md` (D-64)
**Commits:** `22cdb5497` (tests), `bee9088eb` (fix)
**Applied fix (no schema change, no migration 226):** `CLAIM_EVENT_SQL` takes `AND NOT (id = ANY($2::uuid[]))`. A fan-out that raises after its claim rolls back and raises `_FanOutFailed(event_id)`. The loop then skips that event and claims the next one in the same tick, so one bad event no longer blocks later events, including other orgs' events. The failing event is retried after 60 s, 5 min, 30 min and 2 h. The 5th failure gives it up: it is marked fanned out with no payload and no deliveries, and logged at ERROR by event id only. The bookkeeping is per worker and in memory; entries are removed on success, on give-up, or once they can no longer be claimed. A failure before any event is claimed (pool or claim error) still ends the tick's fan-out, as before. The fan-out body moved into `_fan_out_event`; it was dedented only, with no logic change.
**Tests:** `test_wr05_a_failing_event_does_not_block_later_events`, `test_wr05_a_failing_event_waits_out_its_backoff_then_is_tried_again`, `test_wr05_after_the_last_failure_the_event_is_given_up_and_logged_by_id`, `test_wr05_the_event_claim_can_skip_ids`; live `test_wr05_the_event_claim_skips_the_ids_it_is_given`.
**Status:** fixed: requires human verification (giving an event up is a judgement call; it matches the review's suggestion).

### WR-06: The "Waiting on you" webhook row did nothing when Settings was already open

**Files modified:** `frontend/src/components/settings/webhooks/webhookFocus.ts`, `frontend/src/components/settings/webhooks/WebhooksTab.tsx`, `frontend/src/pages/SettingsPage.tsx` (G-5 minimal: one import and one `useEffect`), `frontend/src/components/layout/ChatLayout.tsx` (G-5 minimal: one line), `CLAUDE.md` + `docs/HOT-FILE-LEDGER.md` (both rows and refresh sections in the same commit), `308-CONTEXT.md` (D-65)
**Commits:** `68bd03cd2` (tests), `505e40c25` (fix)
**Applied fix:** `writeWebhookFocus` now dispatches `WEBHOOK_FOCUS_EVENT` on `window` after each write, even when storage is blocked. An open `SettingsPage` listens and moves to tab "8", persisting it inside a try. A mounted `WebhooksTab` listens and consumes the hint at once, so a stale hint can no longer fire on a later, unrelated mount. The mount-time reads stay. `ChatLayout`'s door wraps its `localStorage.setItem` in try/catch, so blocked storage can no longer throw before `onNavigate("settings")`.
**Tests:** `webhookFocus.test.ts` "WR-06: every write is announced on window, even when storage is blocked"; `WebhooksTab.test.tsx` "WR-06: a hint written while the tab is ALREADY open opens that card and is consumed at once"; `SettingsPage.member283.test.tsx` "a focus hint moves the open Settings page to the Webhooks tab (no remount needed)"; `webhookWaitingRow.test.tsx` "WR-06: with storage blocked the door still opens Settings (no throw before onNavigate)".

### IN-06: `test_308_check_script.py` read a `scripts/` file that does not trigger backend CI

**Files modified:** `backend/tests/unit/test_253_ci_path_coverage.py` (module added to `_MODULES_THAT_REACH_OUTSIDE_BACKEND`), `.github/workflows/backend-tests.yml` (path added to both the push and pull_request arms)
**Commits:** `b7fbed265` (test, RED confirmed), `d600e9e34` (fix)

## Also committed (not a review finding)

### Emission-matrix event-order flake

**File:** `backend/tests/integration/test_308_schema_privileges_live.py`
**Commit:** `dad9902c2`
`test_one_run_finished_per_run_and_waiting_on_pause` wrote both events in one transaction, so they shared `created_at` (`now()`), and `ORDER BY created_at, id` fell back to a random uuid order. The test failed 3 runs in 4 while these fixes were gated. It now compares the event set. The contract is "one of each"; it never promised an order.

## Skipped Issues

### IN-01: A delivery stranded at its last attempt by the stale-lease reclaim never counts toward auto-disable

**File:** `backend/app/db/webhook_outbox.py:115-135`
**Reason:** skipped, because the premise does not hold and the change would blame receivers for Syrel's own crashes. Every send is bounded at `WEBHOOK_SEND_BOUND_SECONDS = 15` and the lease is 600 s. A lease therefore expires only when the worker died mid-send (crash, OOM, restart), not when "sends keep hanging past the lease". The receiver's answer to that last attempt is unknown, so counting it toward auto-disable would turn an endpoint off for a failure on our side. Keeping the reclaim out of the count is the honest choice. Re-open if the send bound is ever removed or raised near the lease.
**Original issue:** when `RECLAIM_SQL` fails a real delivery at `max_attempts`, `register_failure` is never called.

### IN-03: The webhook liveness predicate inherits `_is_banned`'s fail-open behaviour

**File:** `backend/app/dependencies.py:254-262` (through `principal_still_allowed`)
**Reason:** skipped, because it is not within the ≤ ~10-line safe bound. A correct fix needs three things. First, a strict mode on `_is_banned` in the FIRING `dependencies.py` (25 / 13). Second, a pass-through in the shared security predicate `principal_liveness.py`. Third, a tri-state in the drainer, because a failed ban read must *skip this pass*, not disable the endpoint with `owner_removed`; the predicate today answers only allowed or refused. A check written only in the drainer would be the "second predicate" that D-25 forbids. The membership check before the ban read still fails closed, so a removed member is still refused. Recommend a small follow-up phase or quick task.
**Original issue:** a failed `auth.users` read treats a banned owner as not banned, so their endpoint keeps receiving deliveries.

## Gates after the fixes

- **Backend 308 unit tests** (`pytest tests/unit -q -k 308`): **516 passed** (469 before the fixes).
- **Backend 308 integration tests** (`pytest tests/integration -k 308`, run under the local-DB lock): **154 passed** (150 before), green on 2 consecutive runs after the last DB-touching fix (WR-05), and on 3 consecutive runs after the WR-02 flake fix.
  - ⚠ **One environment hazard, not a code defect.** A local `uvicorn --reload` backend is running and has its own `WebhookDrainer`. The live tests pin their rows to the year 2000, which makes them due for that drainer too. Once, its stale-lease reclaim (real `now()`, lease 600 s) took a test row between the test's claim and its renew. `test_a_rolled_secret_signs_twice…` then saw "reclaimed before sending; not sent". That is the exactly-once guard working as designed. The run did not recur on the 5 runs after it. Run the live 308 suite with the local backend stopped to remove the hazard entirely.
- **Full backend baseline** (`node scripts/check-backend-unit-baseline.cjs`, under the lock): **GATE PASSED: 70 failed ≤ 71, 0 errors**, 12843 passed. The failing-id set is **identical** to `308-baseline-failing-ids.txt`: 70 = 70 after normalisation, and **none in a 308 file**.
- **Frontend typecheck** (`npx tsc -p tsconfig.app.json --noEmit`): 61 errors. A set diff against the recorded 308 heads, with line numbers stripped, shows **no new error**.
- **ESLint** on the touched frontend source files: the same error count as base per file (WebhooksTab 3, ChatLayout 1, SettingsPage 0, OrgWebhooks 0). All of them are pre-existing `set-state-in-effect` / declaration-order findings; the new listener calls setState only from an event callback.
- **Targeted vitest** (`src/components/settings/webhooks`, `src/components/org`, `SettingsPage.member283`, `webhookWaitingRow`): **31 files, 371 tests passed**.
- **Vitest count gate** (`GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`, from the repo root): total 14035 against 12971 pinned, **no per-file decrease**, **1 failing test → `COUNT GATE VIOLATED`**. The failing test was captured from the gate's own JSON report before any re-run: `src/pages/WorkflowBuilderPage.canvas.test.tsx` › "184-11 … POSITIVE CONTROL — with the flag ON the very same read finds the key" (`expected 0 to be greater than 0`). This suite is **provably unmodified** by these fixes: `git diff --numstat aec27da61 HEAD -- frontend/` names only webhook, org, Settings and ChatLayout files, and none of them is imported by the workflow builder. It is the fifth SEED-171 suite listed in `docs/VITEST-COUNT-GATE.md`, failing with exactly that recorded signature. Re-run alone after the capture, it passed **164/164**. One green sample of a flaky suite does not prove it innocent, so the gate is recorded as **not OK on this sample**, and the red is attributed to the known SEED-171 instability rather than to this diff.
- **Hot-file ledger** (`node scripts/check-hot-file-ledger.cjs .planning/phases/308-told-by-webhook`): **OK**. FIRING files touched: `egress.py` (WR-03), `SettingsPage.tsx` and `ChatLayout.tsx` (WR-06). Each has its CLAUDE.md row, scan-list row and a `308-REVIEW-FIX refresh` section in `docs/HOT-FILE-LEDGER.md`, all in the same commit as the edit.
- **CLAUDE.md size gate**: **OK**.
- **DB lock** `agentic-rag-localdb.lock`: released, and the file does not exist.
- **No migration**: WR-05 was fixed without a schema change, so there is no `226_*.sql` and no `full-schema.sql` regeneration. Nothing was written to the cloud or to Supabase MCP.
- The McpKeyFields snapshot's line-ending-only rewrite and the other unrelated working-tree changes were **not** committed.

---

_Fixed: 2026-11-04_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

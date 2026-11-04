---
phase: 308-told-by-webhook
plan: 04
subsystem: api
tags: [webhooks, api, routes, admin, audit, rate-limit, openapi, docs]
requires:
  - phase: 308-01
    provides: app/db/webhooks.py (owner-predicated endpoint CRUD, log reads, test + resend writes), audit literals, migration 225
  - phase: 308-02
    provides: webhook_urls (check_webhook_url / host_of / admin_display), webhook_signer, webhook_sender (send, freeze_payload), payload models, egress "webhook" capability
provides:
  - "/webhooks member router: list, create (secret once), edit, turn off/on, roll, delete, test, deliveries, resend"
  - "/org/webhooks admin router: list (host + masked path, never url/query), turn off (reason admin), turn on (admin-off only), delete"
  - "rate_limit.enforce_user_webhook_limit with webhook_test (5/min) and webhook_resend (20/min) buckets, {code, message} detail, fail closed"
  - "route DTOs appended to models/webhook.py"
  - "main.py: routers mounted, WebhookDrainer started lazily per worker behind the boot-sweep gate, stopped at shutdown; httpx logger held at WARNING"
  - "OpenAPI: /webhooks and /org/webhooks flagged UI-internal, webhooks tag in Account & org"
  - "docs stub administer/settings/webhooks covering router:webhooks"
affects: [308-05, 308-06]
tech-stack:
  added: []
  patterns:
    - "refusal detail {code, message}: message is the sentence the UI shows (P-6)"
    - "save-time SSRF check: check_webhook_url then run_in_threadpool(egress.validate_destination, 'webhook', url, None, allowed_host=host)"
    - "audit via run_in_threadpool(get_service_role_supabase) + write_audit_entry with explicit org_id, metadata {actor, endpoint_id, host} only (P-7)"
key-files:
  created:
    - backend/app/api/webhooks.py
    - backend/tests/unit/test_308_routes.py
    - backend/tests/unit/test_308_test_and_log_routes.py
    - backend/tests/unit/test_308_admin_routes.py
    - backend/tests/unit/test_308_main_wiring.py
    - docs/public/administer/settings/webhooks.md
  modified:
    - backend/app/models/webhook.py
    - backend/app/services/rate_limit.py
    - backend/app/main.py
    - scripts/build-public-openapi.cjs
    - docs/public/api/openapi.snapshot.json
    - docs/public/api/openapi.public.json
    - docs/public/sections.json
key-decisions:
  - "Admin turn-on of an endpoint that is already on answers 200 unchanged with no audit row (a double click must not read as an error); a Syrel-off one (failing / gone / owner_removed) is 409 not_admin_off"
  - "Resend answers {delivery: {id, status: pending, attempts, next_attempt_at}}; the client re-reads the log for the full row (the db resend write returns only those columns)"
  - "org_name comes from api_keys_db.mcp_switches (the ApiKeysTab list's own read), display-only: a failed read is an empty string and the list still answers"
  - "httpx logger held at WARNING in main.py (one line beyond D-50's four hunks): at INFO httpx logs the full request URL, which carries a receiver's token"
patterns-established:
  - "One shared in-memory db store + FakeRedis harness in test_308_routes.py, imported by the other 308 route suites"
requirements-completed: [HOOK-01, HOOK-02, HOOK-04, HOOK-05, HOOK-06]
duration: ~75min (incl. ~25 min waiting on 308-03's local-DB lock)
completed: 2026-11-04
---

# Phase 308 Plan 04: Webhook Routes Summary

**Member and org-admin webhook HTTP surface: owner-predicated CRUD with a save-time SSRF refusal, a secret shown once and encrypted at rest, a synchronous signed test through the drainer's own send path, a paged words-only delivery log with rate-limited resend, admin rows that never carry a URL or query, and main.py wiring that starts the drainer in every worker.**

## D-53 cipher probe

`venv/Scripts/python -c "from app.security.secret_cipher import get_cipher; print(get_cipher() is not None)"` printed **True** (2026-11-04, this worktree's copied `backend/.env`). No operator action is owed for the cipher. No fallback exists: with `get_cipher()` None, create and roll answer 503 `no_cipher` and nothing is stored (pinned by `test_no_cipher_refuses_and_stores_nothing` and `test_roll_without_a_cipher_is_refused`).

## Routes

| Method | Path | Success | Refusals |
|---|---|---|---|
| GET | `/webhooks` | 200 `{endpoints, cap: 10, org_name}` | — |
| POST | `/webhooks` | 201 `{endpoint, secret}` | 422 `address_refused` / `invalid_url` (one sentence each), 422 body validation, 409 `cap_reached`, 503 `no_cipher` |
| PATCH | `/webhooks/{id}` | 200 `{endpoint}` | 404, 422 (a new URL re-runs both checks) |
| POST | `/webhooks/{id}/disable` | 200 `{endpoint}` | 404 |
| POST | `/webhooks/{id}/enable` | 200 `{endpoint}` | 403 `admin_off`, 404 |
| POST | `/webhooks/{id}/roll-secret` | 200 `{endpoint, secret, previous_secret_expires_at}` | 404, 503 `no_cipher` |
| DELETE | `/webhooks/{id}` | 204 | 404 |
| POST | `/webhooks/{id}/test` | 200 `{delivered, status_code, latency_ms, error}` | 404, 409 `endpoint_off`, 429 `rate_limited`, 503 `unavailable` |
| GET | `/webhooks/{id}/deliveries?limit&before` | 200 `{deliveries, next_cursor}` (limit capped at 50) | 404, 422 `bad_cursor` |
| POST | `/webhooks/{id}/deliveries/{did}/resend` | 200 `{delivery}` (status pending) | 404 (test / skipped / in flight / not yours), 409 `endpoint_off`, 429, 503 |
| GET | `/org/webhooks` | 200 `{endpoints, org_name}` (host, masked path, has_query; no url) | 403 non-admin |
| POST | `/org/webhooks/{id}/disable` | 200 `{endpoint}` (reason admin) | 403, 404 |
| POST | `/org/webhooks/{id}/enable` | 200 `{endpoint}` | 403, 404, 409 `not_admin_off` |
| DELETE | `/org/webhooks/{id}` | 204 | 403, 404 |

Every write audits once with `org_id` explicit and metadata exactly `{actor: owner|admin, endpoint_id, host}`; a repeat toggle writes no second row.

## Performance

- **Started:** 2026-11-04T05:20:00Z (approx.) · **Completed:** 2026-11-04T06:32:00Z
- **Tasks:** 3 (TDD: RED then GREEN each)
- **Files:** 6 created, 7 modified

## Task Commits

1. **Task 1: DTOs + member CRUD** — RED `04f5269ae`, GREEN `c66ffb120`
2. **Task 2: test, log, resend, rate limits, admin routes** — RED `43ea88c60`, GREEN `bd1c4109e`
3. **Task 3: main.py, OpenAPI, docs stub, gates** — RED `b3b9e3a72`, GREEN `a5ff38e4e`

## Verification

- `test_308_routes` (29), `test_308_test_and_log_routes` + `test_308_admin_routes` (43), `test_308_main_wiring` (9): all green. `test_276_openapi_snapshot_fresh` green.
- `pytest tests/unit -k "rate_limit or citation"`: 308 passed (every existing rate-limit suite unedited).
- `node scripts/build-public-openapi.cjs --check` exit 0; snapshot change is additive only (12 paths added, 0 removed, 0 existing paths changed, 15 schemas added — measured by a key-set diff, since git's line diff of the reordered JSON reads as +17k/-14k).
- `node scripts/check-docs-coverage.cjs` exit 0 (122 code keys, `router:webhooks` covered by the stub).
- `node scripts/check-hot-file-ledger.cjs .planning/phases/308-told-by-webhook` exit 0; `bash scripts/check-deploy-drift.sh` exit 0 (D-34: no env var added).
- Acceptance greps: `rate_limit.py` diff has 0 removed lines; `main.py` diff has 1 removed line (the import list) and 14 lines naming "webhook"; `models/webhook.py` payload half has 0 removed lines; `webhooks.py` has 1 `webhook_sender.send(`, 0 `AsyncClient`, 6 `require_org_manage`, 0 logger calls naming a url or secret, the D-24 sentence exactly once.
- **Backend unit baseline** (`node scripts/check-backend-unit-baseline.cjs -- -rf`, run under the local-DB lock after 308-03 released it; lock taken as `308-04` and released after): **70 failed, 12654 passed, 1 skipped, 2 xfailed, 2 xpassed, 0 errors. GATE PASSED (70 <= 71).** Failing-set diff: the 70 ids are in the same 23 files 308-02 recorded (count unchanged). None is a 308-04 file, and no failing id names webhook, test_308 or rate_limit. The one failing file that touches `main.py`, `test_lifespan.py` (3 ids, `TypeError: object MagicMock can't be used in 'await' expression` from `audit_service.py:61`), was **re-run against base `main.py`** (`git checkout f587e3470 -- backend/app/main.py`, then restored to HEAD) and fails the same three ids there, so it is inherited. **No new failing id.**

## Decisions Made

See frontmatter `key-decisions`. Also: the PATCH route skips both checks when the URL sent equals the stored one (only a NEW address is re-validated), and `not_https` maps to the `address_refused` sentence (an `http://` address cannot be reached the way Syrel sends).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Security] httpx logger held at WARNING in main.py (308-02 handoff)**
- **Found during:** Task 3 (handed over by 308-02)
- **Issue:** at INFO httpx logs the full request URL (a receiver's path / query token), and the opt-in file sink (`logging_sink.py:211`) lowers logging to INFO with no URL redaction. main.py did not raise httpx's level anywhere.
- **Fix:** one line, `logging.getLogger("httpx").setLevel(logging.WARNING)`, beside the existing asyncio / langsmith level lines, plus `test_httpx_is_held_at_warning_so_a_receiver_url_is_never_logged`. This is one line beyond D-50's four hunks, justified by the T-308 log-leak threat.
- **Files modified:** backend/app/main.py, backend/tests/unit/test_308_main_wiring.py
- **Commit:** a5ff38e4e

**2. [Rule 1 - Bug] Admin turn-on of an endpoint already on**
- **Found during:** Task 2
- **Issue:** the plan said admin enable is allowed only for `disabled_reason = 'admin'`, else 409. An endpoint that is already on also has no reason, so a second click would answer a refusal sentence.
- **Fix:** already-on answers 200 with the row unchanged and no audit row; a Syrel-off endpoint (failing / gone / owner_removed) still answers 409 `not_admin_off`. Pinned by `test_admin_turn_on_of_an_endpoint_already_on_changes_nothing`.
- **Commit:** bd1c4109e

**3. [Rule 3 - Blocking] Resend answer shape**
- **Issue:** `resend_delivery` (308-01) returns only id, endpoint_id, event_id, status, attempts, next_attempt_at, so a full `WebhookDeliveryRead` cannot be built without a new db read.
- **Fix:** resend answers `{delivery: {id, status: "pending", attempts, next_attempt_at}}` (`WebhookDeliveryQueued`); the UI re-reads the log (never optimistic). 308-05's client should type it that way.
- **Commit:** bd1c4109e

**4. [Rule 3 - Blocking] Worktree base corrected at start**
- The worktree started on master (`4bc4a872f`), not the expected develop base. Reset to `f587e3470` per the spawn instruction and re-bootstrapped before any work.

## Deferred / Handed Over

- **A guard-failed test delivery is recorded with reason `not_retried`**, because `record_test_outcome`'s SQL (308-01) sets that for every failed test. The log would show "Failed" rather than "Not sent — the redaction check failed". A test event carries no text by type, so this needs the guard itself to raise (e.g. the pii switch read failing hard). Owner: whoever next touches `db/webhooks.py` (308-06 review).
- **Docs pages still describe webhooks as unavailable.** `docs/public/README.md` lists webhooks under "Third-party API access that has not shipped … Not available today", and `api/concepts/webhooks.md`, `api/roadmap-open-platform.md`, `get-started/overview.md`, `security/egress-controls.md` and `api/concepts/authentication.md` mention webhooks. No 308 plan names those files. They must be reconciled before the phase ships (proposed: 308-06, or a `/gsd:fast` after it).
- Ledger rows and sections for `main.py`, `rate_limit.py`, `build-public-openapi.cjs` and the new `api/webhooks.py` are re-derived by 308-06 as planned (308-01-PLAN :98); this plan did not edit CLAUDE.md or `docs/HOT-FILE-LEDGER.md`.

## Threat Flags

None beyond the plan's register. Every new surface (14 routes) is in T-308-01/04/06/15/16/18/20/21 and mitigated as planned.

## Known Stubs

- `docs/public/administer/settings/webhooks.md` is an intentional `status: stub` page (D-49); 308-05 adds `settings-tab:webhooks` once the tab exists.

## Next Phase Readiness

308-05 (UI) can read and write only through these routes. Wire shapes are pinned by the route suites; refusals are `{code, message}` throughout.

## Self-Check: PASSED

All 6 created files exist; all 6 task commits (04f5269ae, c66ffb120, 43ea88c60, bd1c4109e, b3b9e3a72, a5ff38e4e) are on the branch, RED before GREEN for each task. STATE.md and ROADMAP.md untouched (orchestrator-owned).

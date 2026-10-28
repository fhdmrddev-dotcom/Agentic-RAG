---
phase: 293-start-from-outside-and-close-out
fixed_at: 2026-10-26T08:40:00Z
review_path: .planning/phases/293-start-from-outside-and-close-out/293-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
deferred_info: 8
status: all_fixed
---

# Phase 293: Code Review Fix Report

**Fixed at:** 2026-10-26
**Source review:** `.planning/phases/293-start-from-outside-and-close-out/293-REVIEW.md`
**Iteration:** 1
**Scope:** Critical + Warning (operator ruling "fix all"). The eight Info findings are deferred, each with a re-open trigger in `deferred-items.md`.
**Method:** TDD per finding. A failing test was committed first and confirmed to fail on an assertion (not an import error), then the fix was committed. Every commit was made by path and checked with `git show --stat HEAD`.

**Summary:**
- Findings in scope: 6
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: The "workflows" kill switch does not stop API-key starts

**Verified first:** confirmed. `workflows_enabled()` was called only in `workflow_kickoff.py`. Neither `start_workflow_run`, `launch_unattended_run` nor `launch_scheduled_run` called it.
**Files modified:** `backend/app/services/unattended_launch.py`, `backend/app/api/inbound.py`, `backend/app/services/scheduler_service.py`, `docs/public/api/guides/start-a-workflow-from-outside.md`, `CLAUDE.md`, `docs/HOT-FILE-LEDGER.md`
**Commits:** `0662547a4` (RED) → `376a3edcc`
**Applied fix:**
- One predicate, `unattended_launch.workflows_disabled()`. It resolves `workflows_enabled` late from `app.api.threads`, so the test_147 seam `patch("app.api.threads.workflows_enabled")` now covers every launch door.
- `UnattendedLaunchDisabled` is raised at the top of the shared core, before the thread insert, so a future door that forgets its own check still writes nothing.
- The inbound start checks the switch right after the per-key limiter. It answers 403 with the in-app sentence ("Workflows are currently disabled by the administrator") and writes one `api_key.refused` row with reason `workflows_disabled`. If the switch flips mid-request, the core's exception gets the same response.
- `launch_scheduled_run` checks the switch before any read. It records the sentence on the schedule and raises `ScheduledLaunchRefused`, so the tick never overwrites it with `launch_failed`, and "Run now" says why.
- **Residual:** the scheduler reads the same sync settings cache the in-app seam reads. A flip is seen on a worker once anything on that worker refreshes the cache (the 30 s TTL async loader). This is the in-app kill switch's existing freshness, not a new gap.

### CR-02: Refusal audit writes are awaited and unthrottled

**Verified first:** confirmed. The resolver's `_refuse` and the route's `_refused` each awaited one `audit_log` insert per refusal. Revoked keys never reach the limiter, and `_limit` audited every 429.
**Files modified:** `backend/app/security/api_key_auth.py`, `backend/app/services/rate_limit.py`, `backend/app/api/inbound.py`, `docs/public/api/guides/start-a-workflow-from-outside.md`. Tests adapted: `test_293_key_auth.py`, `test_293_inbound_start.py`, `test_293_inbound_status.py`, `phase293_inbound_fakes.py`.
**Commits:** `dace0312c` (RED) → `f4c3e75dc`, `8ace43369` (the throttle moved beside the audit writers)
**Applied fix:**
- (a) **Throttle.** `api_key_auth.refusal_audit_slot` keeps one Redis window per key, reason and minute (`apikey:refaudit:{key}:{reason}:{minute}`). Only the first refusal in a window writes its row. Later ones increment `apikey:refaudit:sup:{key}:{reason}`, and the next written row carries that count as `detail.suppressed`. Both the resolver and the route go through it. The resolver now depends on `get_redis`.
- **Fail-safe choice: CAP, not skip.** If Redis raises, the throttle falls back to a bounded in-process window, so each worker still writes at most one row per (key, reason, minute). It never writes without limit and never goes silent. The window lives in `api_key_auth.py` rather than `rate_limit.py` on purpose: the limiter's ledger invariant is "no process-local state", and this window can only withhold an audit row, never admit a call.
- (b) **Per-client limit.** `rate_limit.enforce_ip_limit` allows 1,200 calls per minute per `request.client.host`, uses Redis, and fails closed with 503. It is attached to all three `/inbound` routes as a route dependency, so it runs before `resolve_api_key`. An unknown-key flood therefore stops at a counter instead of a digest lookup. The test proves `get_key_for_auth` is not reached past the limit.
- **Client IP:** the app has no proxy-aware client-IP derivation anywhere (`api/setup.py` uses `request.client.host` too), and uvicorn trusts forwarded headers only from 127.0.0.1. Behind the onebox nginx or Coolify's Traefik, every caller therefore shares the proxy's address, and this limit acts as one ceiling for the whole door. That is why it is set high. It is a constant, not a setting, so there is no schema change.
- Three existing assertions pinned "one row per repeated refusal" (the miss variants in start/status, and the count of Redis pipelines). They now pin one row per minute.

### WR-01: File links are root-relative and break behind the `/api` prefix

**Verified first:** confirmed. `url=f"/inbound/files/{token}"`, and `frontend/nginx.conf` strips `/api/`.
**Files modified:** `backend/app/api/inbound.py`, `frontend/nginx.conf`, `frontend/src/components/settings/apiKeys/curlExamples.ts`, `docs/public/api/guides/start-a-workflow-from-outside.md`, `docs/public/api/openapi.snapshot.json`, `docs/public/api/openapi.public.json`, `backend/.env.example`, `deploy/onebox.env.example`, test `test_293_inbound_status.py`
**Commits:** `01a91017c` (RED, backend + frontend) → `f3c9fe655`
**Applied fix:**
- The link is now absolute: `{base}/inbound/files/<token>`.
- The base is `BACKEND_PUBLIC_URL`, the app's existing "where a third party reaches this API" setting and the OAuth redirect base. The one exception is when that setting is still a loopback address while the caller reached the API somewhere else. Then the base comes from the request: `X-Forwarded-Proto`, `X-Forwarded-Host` and `X-Forwarded-Prefix` if each is well-formed, else `Host` plus the ASGI `root_path`. Malformed forwarded values are ignored.
- The onebox nginx now sends `X-Forwarded-Prefix /api`.
- The guide, the settings sample, the `InboundFile.url` description and both env examples were updated. OpenAPI was re-exported and rebuilt; `build-public-openapi --check` is OK.
- **Residual:** nginx sets `X-Forwarded-Proto` to its own `$scheme`. On a TLS onebox behind an outer proxy, the fallback link would read `http`. The guidance is to set `BACKEND_PUBLIC_URL`, with `/api`, which a TLS onebox needs for OAuth anyway. This is recorded in the new `frontend/nginx.conf` ledger section.

### WR-02: The activity query's LIMIT 600 is shared across all keys

**Verified first:** confirmed. There was one global `ORDER BY created_at DESC LIMIT 600`.
**Files modified:** `backend/app/db/api_keys.py`, `backend/app/api/api_keys.py`. Tests adapted: `test_293_api_keys_db.py`, `test_293_api_keys_routes.py`.
**Commits:** `b16fde41a` (RED, live Postgres in a throwaway schema: a busy key with 650 newer rows left a quiet key with 0) → `9bbde973e`
**Applied fix:** `list_key_calls` is now `unnest($2::text[]) CROSS JOIN LATERAL (… ORDER BY created_at DESC LIMIT $4)`, with `per_key` defaulting to 50 and the route passing `_CALLS_PER_KEY`. EXPLAIN on the local DB shows each lateral using `audit_log_api_key_id_idx`. No migration was needed.

### WR-03: `split_topic` turns the TRUST-03 envelope's scaffolding into sub-questions

**Verified first:** confirmed. A key-run kickoff split into `Run <name>`, the tag lines and the notice.
**Files modified:** `backend/app/services/inbound_inputs.py`, `backend/app/services/harness/programmatic.py`, `CLAUDE.md`, `docs/HOT-FILE-LEDGER.md`
**Commits:** `5177371cc` (RED) → `b128eacca`
**Applied fix:**
- `inbound_inputs.envelope_values()` reads the values back out of the exact shape `wrap_untrusted_input` writes. The notice is now one `_NOTICE` constant shared by the writer and the reader. A value's closing tag is neutralised on the way in, so a value cannot end its envelope early.
- `split_topic` splits only those values. Each sub-question is still wrapped again downstream (`_exec_llm_batch_agents`), and the function is still pure and idempotent, which is the ledger's binding invariant for `programmatic.py`.
- In-app kickoffs split exactly as before. The milder in-app case the review mentions (`key: value` lines also splitting) was left alone, because that text is the owner's own.
- One assertion in the RED test was wrong about the clause splitter: the `;` inside `&lt;` splits. It was corrected in the fix commit to pin that every fragment is a piece of the value as carried.

### WR-04: A stored definition that fails validation returns an unaudited 500

**Verified first:** confirmed. The RED test produced `ValidationError` from `parse_definition_row` and a 500.
**Files modified:** `backend/app/services/unattended_launch.py`
**Commits:** `62ec0dfb2` (RED) → `b701e8cca`
**Applied fix:** a validation error is now logged and returns `None`, as the docstring promised. The inbound start maps `None` to its audited 403 `cannot_run`, and the scheduler maps it to `launch_failed`.

## Deferred (Info, out of scope)

IN-01 through IN-08 were appended to `deferred-items.md`, each with a concrete re-open trigger.

## Ledger

- FIRING rows re-derived in the same commit as their fix: `scheduler_service.py` `11 / 6 / 308` and `harness/programmatic.py` `4 / 4 / 142`.
- `frontend/nginx.conf` had no row in either register. WR-01 is its third phase (157, 276, 293), so it now has a FIRING row and a section. Eight young rows were re-derived (`a850a2320`).
- `check-hot-file-ledger.cjs` OK. `check-claude-md-size.cjs` OK (98.5k chars).

## Gates

- **Targeted:** every `293` suite plus the scheduler, 295-template, 258-entitlement and openapi/onebox suites pass: `-k "293 or scheduler or 295_template or 258_workflow"` gave 409 passed, and 147 passed after the final throttle move.
- **Backend baseline** (`pytest tests/unit -q --continue-on-collection-errors`, under the local-DB lock, lock deleted after): **70 failed, 9877 passed**, 1 skipped, 2 xfailed, 2 xpassed. That is within the 71 ceiling. The last measured run was 70 / 9855; the extra 22 passes are the new tests, and no failing test name matches the touched areas. ⚠ The run collected before the behaviour-neutral throttle move (`8ace43369`); the 293 suites were re-run green after that move.
- **Frontend:** `curlExamples.test.ts` passes. The apiKeys + docs vitest run gave 221/222; the one red, `ApiReference.test.tsx`, passed 3/3 when run alone, and this work did not touch it. `tsc -p tsconfig.app.json` gave 63 errors, equal to base, and none in `curlExamples.ts`.
- **OpenAPI:** `build-public-openapi --check` OK. `check-deploy-drift.sh` PASS.
- **Live smoke:** after CR-02, `curl /inbound/runs/0000…` answered **401 NO_KEY**. ⚠ After the later commits, the running `--reload` server on :8000 stopped answering anything, including `/health`: TCP connects, then 0 bytes. Per the rules it was not restarted. The same router mounted in-process against the real local Redis and Postgres answered 401 NO_KEY (no key) and 401 INVALID (unknown key).

---

_Fixed: 2026-10-26_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

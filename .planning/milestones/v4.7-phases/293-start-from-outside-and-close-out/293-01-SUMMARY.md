---
phase: 293-start-from-outside-and-close-out
plan: 01
subsystem: inbound-door / api-keys
tags: [api-keys, auth, rate-limit, audit, migration-215, openapi]
base: 5724f42273bed67ac26699f0ef0b5dfed897c126
requires: []
provides:
  - "migration 215 (api_keys, workflow_runs.origin_*, audit CHECK +5, two app_settings limits) applied locally + full-schema regenerated"
  - "security/api_key_auth.py: KEY_PREFIX, mint_key, digest_key, resolve_api_key, ResolvedKey, audit_key_call, audit_key_call_now"
  - "services/rate_limit.py: hit, enforce_key_limit (Redis, shared across workers, fails closed)"
  - "db/api_keys.py: key CRUD + scoped workflow reads + audit-backed call history"
  - "services/inbound_inputs.py: declared_fields, needs_file_upload, validate_inbound_inputs, InboundInputRefused"
  - "api/api_keys.py: router (/api-keys) and org_router (/org/api-keys)"
affects: [293-02, 293-03, 293-04, 293-05]
tech-stack:
  added: []
  patterns:
    - "one-way SHA-256 digest + hmac.compare_digest for bearer secrets (stdlib only)"
    - "Redis MULTI/EXEC fixed-window limiter keyed apikey:rl:{kind}:{key}:{minute}"
    - "an audit row on a path that RAISES is awaited, never a BackgroundTask"
key-files:
  created:
    - supabase/migrations/215_api_keys_and_run_origin.sql
    - backend/app/security/api_key_auth.py
    - backend/app/services/rate_limit.py
    - backend/app/db/api_keys.py
    - backend/app/models/api_key.py
    - backend/app/services/inbound_inputs.py
    - backend/app/api/api_keys.py
    - backend/tests/fixtures/phase293/launch_fields_cases.json
    - backend/tests/fixtures/phase293/api_keys_contract.json
    - scripts/check-migration-215-live.py
  modified:
    - supabase/full-schema.sql
    - scripts/full-schema-supplement.sql
    - scripts/check-greenfield-privileges.py
    - backend/app/services/audit_service.py
    - backend/app/models/user_settings.py
    - backend/app/api/settings.py
    - backend/app/main.py
    - scripts/build-public-openapi.cjs
    - docs/public/api/openapi.snapshot.json
    - docs/public/api/openapi.public.json
    - docs/public/api/overview.md
key-decisions:
  - "293-01: a BackgroundTask added by a dependency that then raises is discarded, so refusal audits are awaited (audit_key_call_now); plan 02 must do the same for any audit on a raising path"
  - "293-01: an admin revoke's audit row is attributed to the ADMIN who acted, with detail {by_admin: true, owner_id}"
  - "293-01: assumptions adopted — A4 8 000 chars/value, 50 fields; A5 key creation needs the workflows capability; A7 a key pins the definition ROW id it was made for"
requirements-completed: [START-02, START-04]
duration: ~40 min (this continuation; Tasks 1-2 by the prior agent + orchestrator)
completed: 2026-10-25
---

# Phase 293 Plan 01: API key foundation Summary

**Migration 215 live locally, `srl_live_` keys stored only as SHA-256 digests and re-checked against live state on every call, a Redis limiter shared by both workers that fails closed, and member + admin routes to create, list and revoke keys.**

BASE: `5724f42273bed67ac26699f0ef0b5dfed897c126`

## What was built

- **Migration 215** (Task 1, prior agent) and its privilege mirrors. Applied to the local DB in Task 2; `supabase/full-schema.sql` regenerated from the live DB with **no reset** (`03ce11712`). `check-schema-acl-parity.cjs` OK (381/381 mirrored); `check-greenfield-privileges.py` OK (182 migrations, 132 table/column ACL statements replayed).
- **`security/api_key_auth.py`**: `mint_key()` = `srl_live_` + `token_urlsafe(32)`, SHA-256 hex digest, 13-char prefix. `digest_key()` refuses a wrong prefix, more than 128 chars, or anything outside the urlsafe alphabet, so a malformed string never reaches the database. `resolve_api_key` follows the D-05 order: no key, digest, lookup, `compare_digest`, revoked, expired, still a member (read live from `org_members`), not banned. A missing key gets the NO_KEY sentence. Every bad key gets one byte-identical INVALID body; the test asserts all six arms (garbage, unknown, revoked, expired, not_member, banned) are equal. Refusals we can attribute write `api_key.refused` with the reason, key id and label. An unknown key writes no audit row and logs only a 12-char fingerprint. The `ApiKey` bearer scheme is named for the public spec, with `auto_error=False`.
- **`services/rate_limit.py`**: `hit()` follows RESEARCH Pattern 5 exactly. `enforce_key_limit()` reads both limits from `load_app_settings_async()`. Over the limit it returns 429 with `Retry-After` and the UI-SPEC sentence. If Redis raises it returns 503 and admits nothing.
- **`db/api_keys.py`**: every statement carries an `org_id`/`user_id` predicate except `get_key_for_auth`, whose docstring says why. `_KEY_COLUMNS` never contains `key_hash`. `workflows` is bound as a plain list. `touch_last_used` has the 30-second throttle. `list_key_calls` reads `audit_log` (LIMIT 600). Scoped workflow reads back the create/list/picker routes.
- **`models/api_key.py`**: every wire field is declared. Only `ApiKeyCreated` has `secret`, and no model has `key_hash` (a test pins this).
- **Settings**: `api_key_starts_per_minute` (10, bounded 1..60) and `api_key_reads_per_minute` (120, bounded 10..600) are wired in the four places that must agree: model field, `_val` read, the response/update models plus the allow-list, and two bounded writes via `_range_refusal_detail`.
- **`VALID_ACTION_TYPES`** gains the five `api_key.*` types. This was only safe because 215 is applied locally.
- **`services/inbound_inputs.py`**: the Python twin of `soulData.launchInputFields`, pinned by `launch_fields_cases.json` (8 cases; 293-04 reads the same file). It refuses unknown, missing, file, non-string and oversize input. Every `_`-prefixed key and every reserved key in the caller's body is refused as unknown.
- **`api/api_keys.py`**:
  - `GET /api-keys` returns the caller's keys, the effective limits, each workflow's live state and the last 30 days of calls.
  - `GET /api-keys/startable-workflows` returns own published workflows with declared fields, file-upload ones marked not startable, and a `drafts_hidden` count.
  - `POST /api-keys` (201) is behind `require_capability("workflows")`. It refuses a draft by name, gives a foreign id and an unknown id the same sentence, refuses a file-upload workflow by name, and returns 409 on a duplicate active label.
  - `POST /api-keys/{id}/revoke` answers 404 for a miss or someone else's key.
  - `GET /org/api-keys` and `POST /org/api-keys/{id}/revoke` sit behind `require_org_manage`.
  - `main.py` has one include per router; `CANVAS_GATED_PATHS` is untouched.
- **OpenAPI**: snapshot and public spec regenerated. A semantic diff against the previous snapshot shows only additions: 5 paths and 10 schemas, plus the two new settings fields on `FullSettingsResponse`/`SettingsUpdate`. `api-keys` was added to the "Account & org" `TAG_GROUPS`; the DESCRIPTION still says "no API keys" (count 1, unchanged from base, which is 293-05's D-20 commit). `router:api_keys` was added to `overview.md` `covers:`; `check-docs-coverage.cjs` OK.

## Task commits

| Task | Commit | Message |
|---|---|---|
| 1 RED | `7878f4f2f` | test(293-01): add failing shape test for migration 215 |
| 1 GREEN | `edcca14bd` | feat(293-01): author migration 215 (api_keys + run origin) and its privilege mirrors |
| 2 | (none) | migration 215 applied to the local DB |
| 3 step 1 | `03ce11712` | chore(293-01): regenerate full-schema.sql with migration 215 (live dump, no reset) |
| 3 RED | `cf5cab1a7` | test(293-01): failing tests for key mint/resolve, shared limiter, key store, limit settings |
| 3 GREEN | `48ecf9797` | feat(293-01): key core |
| 4 RED | `685cc66b5` | test(293-01): failing tests for the declared-field twin and the key management routes |
| 4 GREEN | `ddaecefd1` | feat(293-01): key management routes, the declared-field twin, and fresh OpenAPI artifacts |

## RED drives

- **Task 3 RED**: all three suites failed at collection (`ImportError: cannot import name 'api_keys' from 'app.db'`); the modules did not exist.
- **Task 3 first GREEN run**: 9 failed. Every refusal-audit case was red, for a real reason (deviation 1 below).
- **Per-arm drives** in `api_key_auth.py`. Each check was replaced with `pass`, `test_293_key_auth.py` run, and the file restored md5-identical (`65083c83…` before and after):
  - revoked: 4 failed
  - expired: 3 failed
  - not_member: 3 failed
  - banned: 3 failed
- **Limiter fail-closed drive**: the 503 raise was replaced with `return` and `test_a_redis_that_raises_fails_closed_with_503` failed. The file was restored md5-identical (`fdaa9451…`).
- **Task 4 RED**: both suites failed at collection (no `app.services.inbound_inputs`, no `app.api.api_keys`).

## Audit CHECK list source

The `audit_log_action_type_check` in 215 was authored from the **live CHECK read**, per the migration's own section-5 comment ("every live literal kept"): 34 existing literals plus the 5 `api_key.*`. Task 2's VERIFY block returned 15/15 PASS, and `scripts/check-migration-215-live.py` printed `215 live`. Boot's `assert_action_types_synced` is therefore satisfied locally.

## Assumptions adopted (visible to the operator)

- **A4**: `MAX_VALUE_CHARS = 8000` per input value, `MAX_FIELDS = 50` per body.
- **A5**: creating a key requires the `workflows` capability. Listing and revoking need none, so a member can always stop their own keys.
- **A7 / orchestrator ruling 1**: a key pins the exact definition ROW id it was made for, as schedules do (`workflows` snapshot `[{id, name}]`).

## Deviations from Plan

### Carried from Task 1 (prior agent)

1. **[Rule 2 - Security]** `workflow_runs_origin_immutable()` branches on `TG_OP`. A second BEFORE INSERT trigger, `workflow_runs_origin_client_insert`, nulls the origin columns when the writer is anon/authenticated, which closes an INSERT tamper path beside T-293-03. The backend inserts as `postgres` via asyncpg, so stamping is unaffected.
2. **[Rule 1]** Dropped the column comment on `key_hash`, so `key_hash` appears only in the column definition, the unique constraint and VERIFY.
3. The greenfield checker derives its expectations from the migration grants. Added an explicit named case: authenticated can SELECT id/label/key_prefix as a positive control, `key_hash` is refused, anon gets nothing.

### Task 2 apply method

4. **Migration 215 was applied by the orchestrator at the operator's instruction ("you apply it"), not by pasting it into the SQL editor.** The full file ran over one asyncpg connection to `settings.postgres_dsn` (asserted `127.0.0.1:54322`) under the local-DB lock. The SQL was the same, and VERIFY returned 15/15 PASS.

### Auto-fixed in this continuation

5. **[Rule 1 - Bug] Refusal audits would never have been written.**
   - **Found during:** Task 3, first GREEN run.
   - **Issue:** A `BackgroundTask` added inside a dependency that then raises `HTTPException` is discarded with the error response.
   - **Fix:** Added `audit_key_call_now()`, which awaits `write_audit_entry` (that function swallows its own errors, so a refusal can never become a 500). `_refuse()` uses it, and `resolve_api_key` no longer takes `background_tasks`. `audit_key_call()` (background) stays for normal-return paths, and its docstring warns about the trap.
   - **Note for plan 02:** any audit followed by a raise must use `audit_key_call_now`.
   - **Commit:** `48ecf9797`.
6. **[Rule 2]** `touch_last_used(pool, key_id, *, org_id)` gained an `org_id` predicate, so "the owner predicate is in every statement" holds without a second exemption. `48ecf9797`.
7. **[Rule 3]** `get_definition` does not return `org_id`/`is_system_global`, and the API layer never composes SQL. So the routes use three new scoped reads in `db/api_keys.py` (`get_key_workflows`, `list_startable_candidates`, `count_own_drafts`) instead of `get_definition`. The readability predicate is `get_definition`'s plus the org. A row the caller cannot read comes back with `readable=false` and every content column NULL, which lets the list say `deleted` vs `cannot_run` without leaking foreign content. `ddaecefd1`.
8. **[Rule 1]** `revoke_key` runs as two statements (UPDATE, then a named SELECT). A data-modifying CTE's outer SELECT cannot see its own UPDATE, and the response must carry the revoker's name. `list_keys_for_owner` also joins `profiles`, so a member sees which admin revoked their key. `ddaecefd1`.
9. **Admin revoke audit attribution:** the row is the admin's (who acted) in the key's org, with `detail: {"by_admin": true, "owner_id": <owner>}`. The plan named only `by_admin: true`. `ddaecefd1`.
10. **Create-refusal sentences:** UI-SPEC had none for `POST /api-keys`. Three were written in the house voice: draft by name, foreign/unknown as one identical sentence, file upload by name.
11. **Existing pins re-baselined deliberately**, the 292.1 precedent, with the reason in a comment:
    - `test_242_settings_bounds_have_schema_constraints.py` `EXPECTED_BOUNDED_FIELDS` gained the two limits; their CHECKs are in 215.
    - `test_settings.py`'s namespace stub gained the two fields, which the response requires.
    - Commit `48ecf9797`.
12. The settings cases live in `test_293_rate_limit.py` (the limits are the limiter's input). The plan's three Task 3 test files are unchanged in number.
13. **Intermediate red:** `test_276_openapi_snapshot_fresh.py` was red between `48ecf9797` and `ddaecefd1`, because Task 3 added settings fields and the snapshot was regenerated in Task 4 as the plan orders. It is green at HEAD.
14. **No lock on the greenfield check:** `check-greenfield-privileges.py` creates and drops a temporary database (teardown verified) and ran after the schema-regeneration lock was released. It does not touch existing data.

## Verification

- `test_293_migration_215/key_auth/rate_limit/api_keys_db/inbound_inputs/api_keys_routes` + `test_276_openapi_snapshot_fresh` + `test_286_workflows_seam_pins`: **183 passed**.
- Settings suites adjacent to the change (`test_242_*`, `test_2921_*`, `test_settings.py`, `*audit*`): all green.
- `node scripts/build-public-openapi.cjs --check`: OK. `node scripts/check-docs-coverage.cjs`: OK. `node scripts/check-hot-file-ledger.cjs 293`: OK (64 watched files, every one has a row).
- Acceptance greps:
  - `get_current_user` outside comments in `api_key_auth.py`: 0
  - `compare_digest`: 1
  - `secret_cipher`: 0
  - `apikey:rl:`: 2
  - `"api_key.refused"` in `audit_service.py`: 1
  - `api_keys.router|api_keys.org_router` in `main.py`: 2
  - `/api-keys|/inbound` in `canvas_gate.py`: 0
  - `router:api_keys` in `overview.md`: 1
  - "no API keys" in `build-public-openapi.cjs`: 1 (base: 1)
- **Full backend baseline** (`node scripts/check-backend-unit-baseline.cjs`, under the local-DB lock): **70 failed, 9748 passed, 2 xfailed, 2 xpassed, 0 errors**, so the gate passed (70 ≤ 71). No failing file is one this plan created. `test_lifespan.py` (3, the only failing file near `main.py`) gives the same 3 failures with the BASE `main.py` swapped in (restored md5-identical), so those are inherited.

## Known Stubs

None. Every route reads the real store, and the limits come from `app_settings`.

## Threat Flags

None beyond the plan's threat model. `/api-keys` and `/org/api-keys` are the surfaces T-293-02/04/05 already cover, and no `/inbound` route exists yet (plan 02).

## Self-Check: PASSED

- All files listed under key-files exist on disk.
- Commits `7878f4f2f`, `edcca14bd`, `03ce11712`, `cf5cab1a7`, `48ecf9797`, `685cc66b5` and `ddaecefd1` are present in `git log`.

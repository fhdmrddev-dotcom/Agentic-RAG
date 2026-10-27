---
phase: 293-start-from-outside-and-close-out
reviewed: 2026-10-25T00:00:00Z
depth: standard
files_reviewed: 73
files_reviewed_list:
  - backend/app/api/api_keys.py
  - backend/app/api/inbound.py
  - backend/app/api/settings.py
  - backend/app/api/threads.py
  - backend/app/api/workflow_run_evidence.py
  - backend/app/api/workflow_runs.py
  - backend/app/db/api_keys.py
  - backend/app/db/workflows.py
  - backend/app/main.py
  - backend/app/models/api_key.py
  - backend/app/models/message.py
  - backend/app/models/thread.py
  - backend/app/models/user_settings.py
  - backend/app/security/api_key_auth.py
  - backend/app/services/audit_service.py
  - backend/app/services/harness/phase_types.py
  - backend/app/services/harness/run_read_wire.py
  - backend/app/services/harness/run_read_words.py
  - backend/app/services/inbound_inputs.py
  - backend/app/services/rate_limit.py
  - backend/app/services/run_evidence.py
  - backend/app/services/scheduler_service.py
  - backend/app/services/unattended_launch.py
  - backend/app/services/workflow_kickoff.py
  - frontend/src/components/admin/AuditTab.tsx
  - frontend/src/components/chat/ThreadRunLine.tsx
  - frontend/src/components/layout/ChatLayout.tsx
  - frontend/src/components/org/OrgAdminShell.tsx
  - frontend/src/components/org/OrgApiKeysTab.tsx
  - frontend/src/components/org/OrgAuditTab.tsx
  - frontend/src/components/org/orgAdminTabs.ts
  - frontend/src/components/settings/ApiKeyLimits.tsx
  - frontend/src/components/settings/apiKeys/ApiKeyActivity.tsx
  - frontend/src/components/settings/apiKeys/ApiKeyCallStrip.tsx
  - frontend/src/components/settings/apiKeys/ApiKeyCard.tsx
  - frontend/src/components/settings/apiKeys/ApiKeyDraftCard.tsx
  - frontend/src/components/settings/apiKeys/ApiKeySecretOnce.tsx
  - frontend/src/components/settings/apiKeys/ApiKeysTab.tsx
  - frontend/src/components/settings/apiKeys/RevokeApiKeySheet.tsx
  - frontend/src/components/settings/apiKeys/apiKeyFacts.ts
  - frontend/src/components/settings/apiKeys/apiKeyPrepick.ts
  - frontend/src/components/settings/apiKeys/apiKeysCopy.ts
  - frontend/src/components/settings/apiKeys/curlExamples.ts
  - frontend/src/components/settings/settingsTabs.ts
  - frontend/src/components/workflows/RunEvidenceReport.tsx
  - frontend/src/components/workflows/RunOriginLine.tsx
  - frontend/src/components/workflows/evidenceView.ts
  - frontend/src/components/workflows/history/runLogRow.ts
  - frontend/src/components/workflows/library/WorkflowCard.tsx
  - frontend/src/components/workflows/library/WorkflowCardMenu.tsx
  - frontend/src/components/workflows/library/automationFacts.ts
  - frontend/src/components/workflows/library/libraryVocabulary.ts
  - frontend/src/components/workflows/runOriginVocabulary.ts
  - frontend/src/docs/pages/ApiReference.tsx
  - frontend/src/landing/facts.ts
  - frontend/src/lib/api/apiKeys.ts
  - frontend/src/lib/api/runEvidence.ts
  - frontend/src/lib/api/skills.ts
  - frontend/src/lib/api/threads.ts
  - frontend/src/lib/api/workflows.ts
  - frontend/src/pages/SettingsPage.tsx
  - frontend/src/pages/WorkflowRunPage.tsx
  - frontend/src/pages/WorkflowsPage.tsx
  - frontend/src/types/index.ts
  - scripts/build-public-openapi.cjs
  - scripts/check-greenfield-privileges.py
  - scripts/check-landing-drift.cjs
  - scripts/check-migration-215-live.py
  - scripts/check-seeds-register.cjs
  - scripts/drive-293-inbound.py
  - scripts/full-schema-supplement.sql
  - scripts/vitest-count-gate.cjs
  - supabase/migrations/215_api_keys_and_run_origin.sql
findings:
  critical: 2
  warning: 4
  info: 8
  total: 14
status: critical_warning_fixed
fixed_at: 2026-10-26
fix_report: 293-REVIEW-FIX.md
fixed: [CR-01, CR-02, WR-01, WR-02, WR-03, WR-04]
deferred: [IN-01, IN-02, IN-03, IN-04, IN-05, IN-06, IN-07, IN-08]
---

# Phase 293: Code Review Report

**Reviewed:** 2026-10-25
**Depth:** standard (security-weighted toward the inbound door; hot files reviewed as `git diff 5724f4227..HEAD` hunks)
**Files Reviewed:** 73
**Status:** issues_found

## Summary

The core of the inbound door holds up. Keys are minted with 256 bits of `secrets.token_urlsafe`, stored only as SHA-256, and looked up by digest. The resolver re-checks revoked, expired, membership and ban on every call. The single run-access query binds `origin_kind='key' AND origin_ref=<key> AND user_id=<owner>`. Every miss returns the same `404 {"detail":"Not found."}`. File tokens are single-use (GET+DEL in one MULTI), and the key, the run and the file are all re-checked when a token is used.

Migration 215 is correct on the points the focus asked about. Grants are revoked from PUBLIC first. `authenticated` gets a column-list SELECT that leaves out `key_hash`. No client write path exists. The origin trigger fires on INSERT and UPDATE, is non-DEFINER with `search_path=''`, and has EXECUTE revoked from PUBLIC/anon/authenticated. The supplement mirrors the grants. The scheduler core moved to `unattended_launch.py` unchanged in behaviour, apart from the intended explicit `org_id` stamp. Raw inbound values reach the first AI step, the batch sub-questions and "Overall topic" only inside the TRUST-03 envelope. Template-fill values go through `SandboxedEnvironment(autoescape=True)`. The `field="…"` attribute only ever carries an author-declared key, never a caller key, because unknown keys are refused.

There are two blockers. (1) The operator's **workflows kill switch** does not stop the new external door. (2) Refusal auditing is **awaited and unthrottled on every refused call**, including over-limit calls. The rate limiter therefore bounds runs but not database writes. A leaked-then-revoked key can flood the owning org's audit log without limit.

## Critical Issues

### CR-01: The "workflows" kill switch does not stop API-key starts
**Resolution:** FIXED — `0662547a4` (RED) → `376a3edcc`. See 293-REVIEW-FIX.md.

**File:** `backend/app/api/inbound.py:237-342`. Compare `backend/app/services/workflow_kickoff.py:201-216`.
**Issue:** The Control Room's kill switch (`PUT /admin/flags`, key `workflows_enabled`, `api/admin.py:81`) is documented as "gates NEW launches" (`models/user_settings.py:1565-1575`). It is enforced in exactly one place, the in-app kickoff seam (`workflow_kickoff.py:213`). `start_workflow_run` checks the rate limit, the key's list, scope, readability, published status, entitlement, template and inputs. It never calls `workflows_enabled()`, and `unattended_launch.launch_unattended_run` does not either.

Failing scenario: an operator sees runaway spend or an incident and flips "workflows" off. Every n8n/Zapier/cron caller holding a key keeps getting `201` and starting new 500k-token runs at up to `api_key_starts_per_minute` per key. The operator's only remaining levers are maintenance mode, which blocks every write in the product, or revoking keys one by one. The scheduler path has the same gap (pre-existing, `scheduler_service.launch_scheduled_run` never checks the flag). Phase 293 moved that path into the shared core without adding the gate, so both unattended doors now bypass the switch.
**Fix:** Gate once, in the shared core or at both callers, before any write:
```python
# inbound.py, right after _limit(...) (and the same in scheduler_service.launch_scheduled_run)
from app.models.user_settings import workflows_enabled  # noqa: PLC0415
if not workflows_enabled():
    raise await _refused(
        key, call="start", reason="workflows_disabled", workflow_id=workflow_id,
        exc=HTTPException(status_code=403,
                          detail="Workflows are currently disabled by the administrator"),
    )
```
Add a test that patches the flag off and asserts `POST /inbound/workflows/{id}/runs` returns 403 with no `workflow_runs` row.

### CR-02: Refusal audit writes are awaited and unthrottled, so the limiter amplifies writes
**Resolution:** FIXED — `dace0312c` (RED) → `f4c3e75dc`, `8ace43369`. See 293-REVIEW-FIX.md.

**File:** `backend/app/security/api_key_auth.py:208-247`, `backend/app/api/inbound.py:202-222`
**Issue:** Each refusal by a known key performs a synchronous `audit_log` insert before the response is sent. That covers revoked, expired, not_member, banned, over_limit, limiter_unavailable, not_on_key and run_not_found. It goes through `audit_key_call_now` → `write_audit_entry`, with a fresh service-role client built per call by `get_service_role_supabase`. Nothing throttles these writes:
- **Revoked/expired keys never reach the limiter.** `_refuse` runs inside `resolve_api_key`, a dependency that runs before `_limit`. A revoked key, which is usually the leaked one, can be replayed as fast as the client can send. Each replay writes one `api_key.refused` row into the victim org's audit log.
- **The limiter's own 429 writes a row.** `_limit` catches the 429 and calls `_refused(...)`, so 1,000 req/s with a valid key over its limit means 1,000 audit inserts/s. The limiter caps runs but not the write load it exists to bound (D-14).
- The flood also blinds the activity view. `list_key_calls` returns at most 600 rows (WR-02), so a few seconds of refusals push every real start and read out of every key's "recent calls".

Unknown keys get no audit row (correct), but they get no rate limit either: each one costs a SHA-256 and an indexed lookup with no per-client cap.
**Fix:** Count and drop. Before writing a refusal audit row, take a Redis token per `(key_id, reason)` window and write at most one row per window, carrying the suppressed count:
```python
async def _refuse_audit_throttled(redis, row, *, call, reason, **kw):
    bucket = f"apikey:refaudit:{row['id']}:{reason}:{int(time.time()) // 60}"
    try:
        n = await redis.incr(bucket)
        if n == 1:
            await redis.expire(bucket, 120)
    except Exception:
        n = 1  # audit when Redis is unsure; the limiter already fails closed
    if n == 1:
        await audit_key_call_now(row, "api_key.refused", call=call, reason=reason, **kw)
```
Route `_refuse` (resolver) and `_refused` (inbound) through it. A refusal that is not audited is still logged, with the key id only. Separately, add a coarse per-IP limiter on `/inbound/*` that runs before key resolution, to bound unknown-key and revoked-key replay.

## Warnings

### WR-01: File links are root-relative and break behind the `/api` prefix (onebox deploy)
**Resolution:** FIXED — `01a91017c` (RED) → `f3c9fe655`. See 293-REVIEW-FIX.md.

**File:** `backend/app/api/inbound.py:380`
**Issue:** The status read returns `url=f"/inbound/files/{token}"`. The supported onebox deploy serves the backend behind nginx at `/api/` and strips the prefix (`frontend/nginx.conf:52-62`, `deploy/onebox.env.example:304` `VITE_API_BASE_URL=/api`, `docker-compose.prod.yml:34`). A caller who resolves the link against the host, as RFC 3986 says to, requests `https://host/inbound/files/<token>`. That path hits the SPA fallback, not the backend, so the caller gets HTML instead of the file. On the Vercel + Coolify split it happens to work only because the API has its own host. `curlExamples.apiBaseForCurl` already handles the relative-base case for the start and status commands; the server's own link does not.
**Fix:** Return a link relative to the request's base, not the root. For example, derive the prefix from `X-Forwarded-Prefix` / `request.scope["root_path"]` (and set `root_path="/api"` behind nginx). Or return the path relative to the status URL (`../files/<token>`), and document that the link is relative to the API base. Pin it with a test that sets `root_path`.

### WR-02: The activity query's LIMIT 600 is shared across all keys, so one busy key hides the rest
**Resolution:** FIXED — `b16fde41a` (RED) → `9bbde973e`. See 293-REVIEW-FIX.md.

**File:** `backend/app/db/api_keys.py:214-235`, `backend/app/api/api_keys.py:150-156,189`
**Issue:** `list_key_calls(..., key_ids=[every key in the list])` applies `ORDER BY created_at DESC LIMIT 600` across all keys together, and only then does `_serialize_keys` cut each key to `_CALLS_PER_KEY = 50`. Every status read writes an audit row (D-16), and the default allows 120 reads per key per minute. One integration polling every 0.5 s produces 600 rows in about 5 minutes. After that, every other key in the member's list, or in the admin's org list (`/org/api-keys`), shows zero recent calls, including its refusals. The "last 30 days" activity promise (D-17) is false the moment any key polls.
**Fix:** Limit per key, not globally:
```sql
SELECT action_type, metadata, created_at FROM (
  SELECT a.*, row_number() OVER (PARTITION BY metadata->>'api_key_id' ORDER BY created_at DESC) AS rn
  FROM audit_log a
  WHERE org_id = $1 AND action_type LIKE 'api_key.%'
    AND action_type NOT IN ('api_key.create','api_key.revoke')
    AND metadata->>'api_key_id' = ANY($2) AND created_at > $3
) t WHERE rn <= 50 ORDER BY created_at DESC
```
Or use one `LATERAL ... LIMIT 50` per key id.

### WR-03: `split_topic` turns the TRUST-03 envelope's scaffolding into sub-questions
**Resolution:** FIXED — `5177371cc` (RED) → `b128eacca`. See 293-REVIEW-FIX.md.

**File:** `backend/app/services/inbound_inputs.py:197-210`, `backend/app/services/harness/programmatic.py:70,92-117`
**Issue:** `inbound_kickoff` builds `Run <name>\n\n<external_input source="api_key" field="k">\n<value>\n</external_input>\n[SYSTEM NOTICE: …]`. `split_topic` reads `input.get("topic") or input.get("kickoff_prompt")` and splits on `[;\n]| and | vs `. In a key-started workflow where the split step's `input_keys` include `kickoff_prompt` (migration 065's shape) and the value is not under a declared `topic`, the fan-out becomes: `Run <name>`, `<external_input source="api_key" field="k">`, the value's lines, `</external_input>`, `[SYSTEM NOTICE: …]`. `_exec_llm_batch_agents` (`phase_types.py:1029-1047`) then spawns one sub-agent per fragment, up to `max_parallel_agents` concurrently. Each one wraps its fragment again and researches tag text or the notice sentence. Safety holds (every fragment is still enveloped). The run's result is wrong, though, and it spends 3-4 extra sub-agent runs per launch. The in-app path has a milder version, because `launch_kickoff` now appends `key: value` lines that also split.
**Fix:** Give programmatic steps the raw declared values, not the decorated kickoff. For example, store the undecorated composed text under a scaffolding key (`_kickoff_values_text`, listed in `_NON_ACTION_RUN_INPUTS`) and have `split_topic` prefer it over `kickoff_prompt`. Or make `split_topic` strip `<external_input …>`/`</external_input>`/`[SYSTEM NOTICE…]` lines before splitting. Add a test: key-run inputs `{"subject": "a; b"}` produce sub-questions `["a", "b"]`.

### WR-04: A stored definition that fails validation returns an unaudited 500 on the public door
**Resolution:** FIXED — `62ec0dfb2` (RED) → `b701e8cca`. See 293-REVIEW-FIX.md.

**File:** `backend/app/api/inbound.py:289-298`, `backend/app/services/unattended_launch.py:50-70`
**Issue:** `parse_definition_row` catches a JSON-decode failure but lets `WorkflowDefinition.model_validate(raw_def)` raise `pydantic.ValidationError`. A published row can stop validating once the model gains a required field or a stricter literal, and the code already treats definitions as "an old or odd shape" elsewhere (`run_evidence._normalise`). For such a row, `start_workflow_run` raises out of the handler. The caller gets a bare 500, no `api_key.refused` row is written, and the key card keeps saying `startable`. The docstring promises the opposite: "an unparseable one is logged and refused rather than raised".
**Fix:**
```python
try:
    return WorkflowDefinition.model_validate(raw_def)
except Exception as exc:  # noqa: BLE001 — one broken row is a refusal, never a raise
    logger.error("definition for %s does not validate: %s", log_ref, exc)
    return None
```
The inbound route already maps `None` to an audited 403 `cannot_run`.

## Info

### IN-01: The file token is consumed before the limiter and the live checks
**Resolution:** DEFERRED (out of the fix scope) — re-open trigger in `deferred-items.md`.

**File:** `backend/app/api/inbound.py:505-541`
**Issue:** The token is deleted (GETDEL in a MULTI) before `_limit(...)` runs. A 429/503 from the limiter, a `WorkspaceError`, or a transient pool error therefore burns a valid link. The caller can recover by re-reading status, but on a 429 that re-read costs another call against the same limit.
**Fix:** Run `_limit` before the GET+DEL (it needs only `key_id`, so a GET, then the limit, then DEL), or re-issue the token on a limiter refusal.

### IN-02: The sample status JSON contradicts the server for completed runs
**Resolution:** DEFERRED (out of the fix scope) — re-open trigger in `deferred-items.md`.

**File:** `frontend/src/components/settings/apiKeys/curlExamples.ts:52-76`
**Issue:** The sample shows `"status": "completed"` with `"step_index": 3, "step_total": 3`. The server sends both as `null` unless `db_status == "active"` (`inbound.py:475-476`). Integrators who copy the sample will code against fields that never arrive on a finished run.
**Fix:** Set both to `null` in the sample, or show an `active` sample.

### IN-03: No body-size cap on the public start route, though the docstring says oversize bodies are refused
**Resolution:** DEFERRED (out of the fix scope) — re-open trigger in `deferred-items.md`.

**File:** `backend/app/services/inbound_inputs.py:13-20`, `backend/app/api/inbound.py:237-249`
**Issue:** The module says the server refuses "an oversize body". Only per-field caps exist (50 × 8,000 characters), and they apply after FastAPI has read and JSON-parsed the whole body. FastAPI reads the body before resolving dependencies, so this happens before key authentication. The behaviour is framework-wide and was already true of other routes, but this route is meant to face the internet.
**Fix:** Reject on `Content-Length` greater than about 512 KB at the route or middleware for `/inbound/*`, or correct the docstring.

### IN-04: The fire-and-forget drive task is not referenced
**Resolution:** DEFERRED (out of the fix scope) — re-open trigger in `deferred-items.md`.

**File:** `backend/app/services/unattended_launch.py:193-207`
**Issue:** `asyncio.create_task(_drive_run(...))` keeps no reference. The asyncio docs warn that such a task can be garbage-collected mid-run. The code is moved scheduler code, but it now also backs the inbound door.
**Fix:** Keep a module-level `set()` of tasks with `task.add_done_callback(_tasks.discard)`.

### IN-05: The migration-215 backfill cast can abort the whole migration
**Resolution:** DEFERRED (out of the fix scope) — re-open trigger in `deferred-items.md`.

**File:** `supabase/migrations/215_api_keys_and_run_origin.sql:124-131`
**Issue:** `~* '^[0-9a-f-]{36}$'` accepts strings that do not cast to `uuid` (for example 36 hyphens, or misplaced hyphens). One such `_schedule_id` aborts the transaction. The value is system-written, so the risk is low.
**Fix:** Use the canonical pattern `'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'`.

### IN-06: Kickoff-driven workflows are offered as startable, but a key cannot pass their subject
**Resolution:** DEFERRED (out of the fix scope) — re-open trigger in `deferred-items.md`.

**File:** `backend/app/services/inbound_inputs.py:118-168`, `backend/app/api/api_keys.py:92-102`
**Issue:** A workflow with no declared fields, such as the global `literature_review`, which takes its topic from the typed chat text, reads `startable`. Any input a caller sends is refused as `unknown_input`, so the run starts with kickoff `Run <name>` and nothing to work on. `create_key` also accepts global published workflows that the picker (`list_startable_candidates`, own rows only) never offers.
**Fix:** Mark zero-field workflows that read `kickoff_prompt` as `needs_task`, or accept one optional `task` text field that goes through the same envelope. Align `create_key` with the picker's scope.

### IN-07: `--require-settled` accepts only 3-digit seed ids
**Resolution:** DEFERRED (out of the fix scope) — re-open trigger in `deferred-items.md`.

**File:** `scripts/check-seeds-register.cjs:705`
**Issue:** `/^SEED-(\d{3})$/` reports `SEED-1000` and above as `[unknown-seed]`.
**Fix:** Use `/^SEED-(\d{3,})$/`.

### IN-08: Revoking an already-revoked key writes another revoke audit row
**Resolution:** DEFERRED (out of the fix scope) — re-open trigger in `deferred-items.md`.

**File:** `backend/app/api/api_keys.py:336-346`, `backend/app/db/api_keys.py:177-187`
**Issue:** `revoke_key` returns the existing row unchanged for an already-revoked key, and the route audits `api_key.revoke` anyway, so the ledger shows revokes that did nothing.
**Fix:** Have `revoke_key` report whether the UPDATE matched a row (`execute` returns `UPDATE n`), and audit only when `n == 1`.

---

_Reviewed: 2026-10-25_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

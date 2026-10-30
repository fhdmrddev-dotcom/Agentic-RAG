# Phase 300: Told When a Run Waits (Backend and Mailer) - Pattern Map

**Mapped:** 2026-10-29
**Files analyzed:** 38 (19 backend source, 1 migration, 6 deploy/doc artifacts, 11 frontend, plus ~9 new test files)
**Analogs found:** 37 / 38 (the clean-image import closure test has only a partial analog)

> Line numbers were read on 2026-10-29 at HEAD `0cb5e0108`. They go stale on the next commit to a
> FIRING file, so re-derive them before editing (the RESEARCH "valid until" warning applies here too).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/218_run_waiting_notifications.sql` (NEW) | migration | event-driven (triggers) + CRUD | `supabase/migrations/215_api_keys_and_run_origin.sql` + `216_neutral_default_org_name.sql` | exact (split across two) |
| `backend/app/services/email_provider.py` (MOD, becomes the one mailer seam) | service | request-response (outbound HTTP / SMTP) | itself + `services/rerank_engines/cohere.py` + `services/google/_http.py` + `services/connectors/smtp_adapter.py` | exact (composite) |
| `backend/app/services/run_waiting_email.py` (NEW) | utility (pure renderer) | transform | `email_provider.py:66-94` (WR-02 escaping) | role-match |
| `backend/app/db/notifications.py` (NEW) | model / DB access | batch (claim) + CRUD | `backend/app/db/schedules.py:273-369` + `db/ingestion_jobs.py:58-130` + `db/workflows.py:1846-1892` | exact |
| `backend/app/services/notification_drainer.py` (NEW) | service (background loop) | batch / polling | `backend/app/services/scheduler_service.py:236-328` (`SchedulerService`) | exact |
| `backend/app/main.py` (MOD, one hunk start + one hunk stop) | config / lifespan | event-driven | `main.py:513-534` + `main.py:646-656` (scheduler) | exact |
| `backend/app/config.py` (MOD) | config | — | `config.py:1718-1726` | exact (in place) |
| `backend/app/models/user_settings.py` (MOD) | model | CRUD | `models/user_settings.py:305-306, 1208-1209` (+ `vision_model` env fallback at ~1202) | exact |
| `backend/app/api/settings.py` (MOD) | controller | request-response | `api/settings.py:44-57, 118-119, 357-358, 458-459, 762-763, 832-868` | exact |
| `backend/app/api/me_preferences.py` (MOD) | controller | request-response (per-user JSONB) | `api/me_preferences.py:44-120` | exact (in place) |
| `backend/app/services/health_probe.py` (MOD) | service | request-response | `health_probe.py:80-113` (`probe_sandbox` off/down + `probe_dependencies`) | exact |
| `backend/app/api/org.py` (MOD, no ledger row) | controller | request-response | `api/org.py:405-441` (send) + `:525-552` (resend) | exact (in place) |
| `backend/app/services/inbound_inputs.py` (MOD) | utility | transform | `inbound_inputs.py:144-166` `missing_required` | exact (sibling) |
| `backend/app/api/schedules.py` (MOD) | controller | request-response | `api/schedules.py:121-132` + `workflow_kickoff.py:265-269` | exact |
| `backend/app/services/scheduler_service.py` (MOD) | service | batch | `scheduler_service.py:118-150` (template / foreign-folder refusal blocks) | exact (in place) |
| `backend/app/services/run_model_resolution.py` (MOD, no ledger row) | service | transform | `api/model_registry.py:109-125` + `api/runs.py:1510-1520` | role-match |
| `backend/app/services/unattended_launch.py` (MOD) | service | request-response | `unattended_launch.py:181-192, 274-284` + `harness_engine.py:2575-2600` (reader) | exact (in place) |
| `backend/app/services/connectors/smtp_adapter.py` (MOD, no ledger row) | service (adapter) | request-response | `smtp_adapter.py:350-421` | exact (in place) |
| `backend/app/services/harness/phase_types.py` (MOD, FIRING, "G-5 OWED") | service | transform | `phase_types.py:2281-2306` `_external_action_sent_body` | exact (one line) |
| `backend/requirements.txt` (MOD) | config | — | — | n/a |
| Deploy parity: `backend/.env.example`, `deploy/onebox.env.example`, `docker-compose.prod.yml`, `docs/OPERATOR.md`, `scripts/check-deploy-drift.sh` | config / docs | — | existing `EMAIL_PROVIDER` / `RESEND_API_KEY` / `INVITE_FROM_EMAIL` lines in each | exact |
| `frontend/src/components/settings/EmailSettings.tsx` (NEW, S3) | component (leaf) | request-response | `components/settings/ApiKeyLimits.tsx` (whole file) | exact |
| `frontend/src/components/settings/EmailNotificationPreference.tsx` (NEW, S2) | component (leaf) | request-response | `components/settings/ModelDefaultPreference.tsx` + `SettingsPage.tsx:229-251` `Toggle` | exact |
| `frontend/src/components/settings/PreferencesSection.tsx` (MOD) | component | — | `PreferencesSection.tsx:36` (`<ModelDefaultPreference />` mount) | exact |
| `frontend/src/pages/SettingsPage.tsx` (MOD, FIRING) | page | — | `SettingsPage.tsx:51, 700, 832, 836, 1629` (ApiKeyLimits wiring) | exact |
| `frontend/src/lib/api/skills.ts` (MOD) | api client types | — | `skills.ts:584-585, 731-732` | exact |
| `frontend/src/lib/api/settings.ts` (MOD) | api client | request-response | `settings.ts:96-143` (`getModelDefault` / `setModelDefault`) | exact |
| `frontend/src/lib/api/org.ts` (MOD) | api client | request-response | `org.ts:249-321` | exact (in place) |
| `frontend/src/components/org/inviteDeliveryCopy.ts` (NEW) | utility (copy leaf) | — | `components/workflows/decisionsVocabulary.ts` (zero-import leaf) | role-match |
| `frontend/src/components/org/InviteMemberDialog.tsx` (MOD, no ledger row) | component | — | `InviteMemberDialog.tsx:147-188` (link-first success panel) | exact (in place) |
| `frontend/src/components/org/InvitationsTab.tsx` (MOD, no ledger row) | component | — | `InvitationsTab.tsx:220-225` (StatusChip) | exact (in place) |
| `frontend/src/components/admin/HealthSignals.tsx` (MOD, no ledger row) | component | — | `HealthSignals.tsx:84-133, 241-277` | exact (in place) |
| `frontend/src/components/workflows/scheduleOutcomeVocabulary.ts` (NEW) | utility (vocabulary leaf) | transform | `decisionsVocabulary.ts` (leaf rule) + `settings/apiKeys/apiKeyFacts.ts:225-265` (wire value to words switch) | role-match |
| `frontend/src/components/workflows/WorkflowScheduleModal.tsx` (MOD, FIRING) | component | — | `WorkflowScheduleModal.tsx:121-134, 185-206, 246-259, 323-336, 385-386, 416-421, 442` | exact (in place) |
| `backend/tests/integration/test_300_notice_triggers_live.py`, `test_300_rls_anon_live.py` (NEW) | test | DB-backed | `tests/integration/test_299_links_live.py` + `test_181_secdef_privileges.py` | exact |
| `backend/tests/integration/test_300_drainer_once_live.py` (NEW) | test | DB-backed concurrency | `tests/unit/test_workflow_scheduler.py:406-495` (`live_pool` + two concurrent claimers) | exact |
| `backend/tests/unit/test_300_mailer.py` (NEW) + re-targeted `test_276_invite_email_brand.py` | test | — | `tests/unit/decision_engine_fakes.py:58-147` (`Recorder` + `install` MockTransport) | exact |
| `backend/tests/unit/test_300_clean_image_imports.py` (NEW) | test | — | `tests/unit/test_214_args_leaf.py:48-68` (AST import walk) | partial |
| `backend/tests/unit/test_300_schedule_required_inputs.py`, `test_300_unattended_provider.py` (NEW) | test | — | `tests/unit/test_workflow_scheduler.py:151-300, 659-777` | exact |

---

## Pattern Assignments

### `supabase/migrations/218_run_waiting_notifications.sql` (migration, event-driven + CRUD)

**Analogs:** `215_api_keys_and_run_origin.sql` (table, RLS, revoke/grant, trigger-function revoke, bounded `app_settings` columns) and `216_neutral_default_org_name.sql` (header block, SECURITY DEFINER, `EXCEPTION WHEN OTHERS` swallow, VERIFY select).

**Header + apply instructions + VERIFY** (`216:1-26` and `216:60-66`). Copy the shape: what it does, "SCHEMA, NOT A SEED" line (D-27: no OPERATOR.md Step-3 row, no filename in OPERATOR.md), privileges paragraph, the local APPLY paragraph (SQL editor, never `db push`/`db reset`, then `bash scripts/regenerate-full-schema.sh` with no `--reset`), the cloud APPLY paragraph (deploy only, then `get_advisors(security)`), and a closing read-only VERIFY that prints `PASS`/`FAIL`:
```sql
-- SCHEMA, NOT A SEED: no INSERT, no docs/OPERATOR.md Step-3 entry, no env var.
...
-- APPLY (local): paste this whole file into the Supabase SQL editor (http://127.0.0.1:54323).
-- NEVER `supabase db push` / `supabase db reset` (they destroy dev data). Idempotent: re-running
-- it is a no-op. Then `bash scripts/regenerate-full-schema.sh` (NO --reset).
-- APPLY (cloud): belongs to the post-phase deploy ... then get_advisors(security). Never from a phase executor.
...
SELECT CASE WHEN ... THEN 'PASS' ELSE 'FAIL' END AS migration_216_verify;
```
Add a header line stating **no backfill** of runs already waiting at apply time (RESEARCH Runtime State Inventory).

**New table + RLS + revoke-then-grant** (`215:83-101`). `notifications` follows this exactly (owner-only SELECT for 301, D-29); `notification_deliveries` follows it with **no policy at all** and no grant to `authenticated` (deny-all to clients):
```sql
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Default privileges gave anon/authenticated/service_role ALL on a new public table; take them
-- back (PUBLIC first — the CLAUDE.md trap), then grant only what is needed. ...
REVOKE ALL ON TABLE public.api_keys FROM PUBLIC;
REVOKE ALL ON TABLE public.api_keys FROM anon;
REVOKE ALL ON TABLE public.api_keys FROM authenticated;
REVOKE ALL ON TABLE public.api_keys FROM service_role;
GRANT SELECT (id, org_id, user_id, ...) ON TABLE public.api_keys TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.api_keys TO service_role;

DROP POLICY IF EXISTS "Users can view their own API keys" ON public.api_keys;
CREATE POLICY "Users can view their own API keys" ON public.api_keys
    FOR SELECT TO authenticated
    USING (((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids)) AND (auth.uid() = user_id)));

-- There is NO INSERT / UPDATE / DELETE policy, on purpose: ... written only by the backend pool
```
Partial unique index shape (`215:73-74`): `CREATE UNIQUE INDEX IF NOT EXISTS ... ON ... (...) WHERE revoked_at IS NULL;`. For 218 use `(recipient_id, run_id) WHERE closed_at IS NULL`, and the trigger's `ON CONFLICT (recipient_id, run_id) WHERE closed_at IS NULL` must repeat that exact predicate (RESEARCH Pattern 1 note). `notification_deliveries.notification_id` is `UNIQUE` (one delivery per notice, D-20).

**SECURITY DEFINER body with the fail-soft swallow** (`216:28-58`). The inner `BEGIN … EXCEPTION WHEN OTHERS THEN RAISE WARNING … END;` is what keeps the engine's prompt INSERT from ever failing (D-18, Pitfall 3):
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
...
  BEGIN
    IF NOT EXISTS (...) THEN
      ...
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: personal-org creation failed for %: %', new.id, SQLERRM;
  END;
  RETURN new;
END;
$$;
```
For 218 use `SET search_path = ''` and fully-qualified names (the `215:136-140` form, RESEARCH Pattern 1), not 216's `TO 'public'`. AFTER triggers `RETURN NULL`. Full proposed trigger SQL is in `300-RESEARCH.md` lines 486-528; the `WHEN (NEW.role = 'system' AND NEW.tool_calls IS NOT NULL)` clause is mandatory (anti-pattern: a trigger without `WHEN` on `messages`).

**UUID guard on a jsonb text id** (`215:133`), reuse verbatim before casting `tc->>'run_id'`:
```sql
AND wr.inputs->>'_schedule_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
```

**Trigger-function EXECUTE revoke** (`215:157-170`). Copy for both new functions (`notify_on_ask_row`, the `workflow_runs` status function):
```sql
DROP TRIGGER IF EXISTS workflow_runs_origin_immutable ON public.workflow_runs;
CREATE TRIGGER workflow_runs_origin_immutable BEFORE UPDATE ON public.workflow_runs
    FOR EACH ROW EXECUTE FUNCTION public.workflow_runs_origin_immutable();
-- A trigger function is never called directly; take the default EXECUTE away (PUBLIC first —
-- anon inherits from PUBLIC). EXECUTE is checked at CREATE TRIGGER time, not when it fires.
REVOKE EXECUTE ON FUNCTION public.workflow_runs_origin_immutable() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.workflow_runs_origin_immutable() FROM anon;
REVOKE EXECUTE ON FUNCTION public.workflow_runs_origin_immutable() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.workflow_runs_origin_immutable() TO service_role;
```

**Bounded `app_settings` columns** (`215:195-219`). Copy for `notification_email_delay_seconds` (default 120, CHECK 60..3600). Text columns (`email_from_address`, `email_from_name` default `'Syrel'`, `email_dev_redirect_address`) use `ADD COLUMN IF NOT EXISTS ... text` with a `COMMENT ON COLUMN`:
```sql
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS api_key_starts_per_minute integer NOT NULL DEFAULT 10;
ALTER TABLE public.app_settings
  DROP CONSTRAINT IF EXISTS app_settings_api_key_starts_per_minute_bound;
ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_api_key_starts_per_minute_bound
  CHECK (api_key_starts_per_minute >= 1 AND api_key_starts_per_minute <= 60);
COMMENT ON COLUMN public.app_settings.api_key_starts_per_minute IS
  'Phase 293 (D-14). ... Bounded 1..60 by the API (app/api/settings.py) and by ...';
```
`org_invitations` gains nullable `email_delivery` (+ `email_failed_at`, `email_failure`) columns with `ADD COLUMN IF NOT EXISTS`. Its existing table-level SELECT policy already covers new columns (RESEARCH Flag 6), so no grant change.

---

### `backend/app/services/email_provider.py` (service, outbound request-response) — the ONE mailer seam

**Analog 1 — keep from itself:** `compose_invite_link` (`:35-46`, `primary_frontend_origin()`, BUG-260904-04), the provider-switch function (`:97-105`, unknown value falls back to the log provider), and the WR-02 escaping block (`:72-81`):
```python
safe_org = html.escape(org_name)
safe_link = html.escape(link, quote=True)
safe_logo = html.escape(f"{primary_frontend_origin()}/brand/syrel-lockup-email.png", quote=True)
```
Remove the lazy `import resend` (`:69`) and the SDK call (`:82-94`) entirely (D-21). Rewrite the module docblock (`:1-23`); it currently documents the `resend` lazy import.

**Analog 2 — the httpx client factory, so tests can inject a MockTransport** (`services/rerank_engines/cohere.py:24-47`):
```python
def _http_client(timeout: httpx.Timeout) -> httpx.Client:
    return httpx.Client(timeout=timeout)

    with _http_client(httpx.Timeout(spec.timeout_s, connect=spec.connect_timeout_s)) as client:
        response = client.post(
            COHERE_RERANK_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={...},
        )
```
Use a module constant for `https://api.resend.com/emails` (as `COHERE_RERANK_URL`). Add `User-Agent` and `Idempotency-Key` headers (RESEARCH Code Examples, "Resend call"). Unlike cohere, do NOT `raise_for_status()`: classify the status and return a `SendOutcome` (the seam never raises, RESEARCH Pattern 3).

**Analog 3 — status classification into words, body and secret never logged** (`services/google/_http.py:170-203`):
```python
def _raise_for(status_code: int, body: bytes | str | None, what: str) -> None:
    reason = error_reason(body)
    # The BODY is not logged. The enum half is — see the module docstring.
    logger.error("Google %s failed (%s)%s", what, status_code, reason)
    if status_code in (401, 403):
        ...
        raise GoogleReadError(f"Google refused {what}: HTTP {status_code}{reason}. ...")
```
Plus the defensive enum-only body parse (`:72-85` `_enum`, `:88-135` `error_reason`: never raises, keeps only enum-shaped tokens). For Resend, read `name` only through an `_enum`-style guard (assumption A1: body shape unverified). Map: 429 / 500 / 503 / `409 concurrent_idempotent_requests` / network error → `retryable=True`; 400 / 401 / 403 / 422 / `409 invalid_idempotent_request` → `failed`, not retryable. Never put `settings.resend_api_key` in a log or a reason.

**Analog 4 — SMTP provider** (`services/connectors/smtp_adapter.py`). Reuse the patterns, **not** `open_pinned_smtp` (Pitfall 9: the operator relay may be local):
- Header guard via the composer (`:351-360`):
  ```python
  message = EmailMessage()
  for header, value in (("From", sender), ("To", recipient), ("Subject", subject)):
      try:
          message[header] = value
      except ValueError as exc:
          raise SmtpHeaderRefused(f"the {header} header was refused by the message composer: {exc}") from None
  ```
- Multipart (new for the app mailer): `message.set_content(text)` then `message.add_alternative(html, subtype="html")`.
- One blocking helper reached through `run_in_threadpool` (`:201-225` `_quit_quietly` + `_deliver_blocking`), using plain `smtplib.SMTP` / `SMTP_SSL` built from the `SMTP_*` env vars (D-28) with a timeout.
- Refused recipients are a failure, not a success (`:401-407`):
  ```python
  if refused:
      raise SmtpSendFailed(f"the mail host refused the recipient: {_render_refusals(refused)}")
  ```
- Reply words by shape (`:243-264` `_provider_words`), safe to store as the outcome reason.

**Dev guard (D-10):** reuse `app.api.api_docs.is_production_environment()` (`api_docs.py:82-86`); do not write a new check. Non-production with no redirect → `SendOutcome("suppressed")` with the provider never called; non-production with a redirect → rewrite `to`; production ignores the redirect.

**Callers stay blocking-safe:** every call site uses `await run_in_threadpool(...)` exactly as `org.py:411` does today.

---

### `backend/app/services/run_waiting_email.py` (NEW, pure renderer, transform)

**Analog:** `email_provider.py:72-94` (escape every interpolated value; the subject is plain text, so it is not escaped). Additions required by D-02/NOTE-03:
- Subject `f"{name} is waiting on you"` with `\r`, `\n` and other control characters stripped. Reuse the control-character notion from `smtp_adapter.py:146-150` (`_CONTROL_CHARACTERS`).
- Link `f"{primary_frontend_origin()}/app/runs/{run_id}"`, footer `f"{primary_frontend_origin()}/app/settings"`, no query string anywhere.
- Inputs are only `{workflow_name, org_name, waited_seconds, run_id, kind}`. **Never** accept prompt text.
- Pure module: no DB, no settings read beyond `primary_frontend_origin`, so `test_300_run_waiting_email.py` can assert on strings directly (the 276 test style: `"Acme &lt;/a&gt;&lt;script&gt;" in body`, `"<script>" not in body`).

---

### `backend/app/db/notifications.py` (NEW, DB access, batch claim + CRUD)

**Analog 1 — the claim transaction** (`db/schedules.py:273-350`). The state change **inside** the claiming transaction is load-bearing (docstring `:289-292`):
```python
claimed: list[dict] = []
async with pool.acquire() as con:
    async with con.transaction():
        due = await con.fetch(
            f"SELECT {_CLAIM_COLUMNS} FROM workflow_schedules "
            f"WHERE is_active "
            f"  AND next_run_at IS NOT NULL "
            f"  AND next_run_at <= COALESCE($2::timestamptz, now()) "
            f"ORDER BY next_run_at "
            f"LIMIT $1 "
            f"FOR UPDATE SKIP LOCKED",
            limit,
            now,
        )
        for row in due:
            ...
            await con.execute("UPDATE workflow_schedules SET next_run_at = $2, last_run_at = now() WHERE id = $1", ...)
            claimed.append(record)
return claimed
```
Copy the `now: Any = None` / `COALESCE($2::timestamptz, now())` parameter so a test can pin time.

**Analog 2 — status flip on claim** (`db/ingestion_jobs.py:90-130`): `WHERE status IN ('pending', 'retry_queued') AND next_run_at <= …` then `SET status = 'processing', claimed_at = now(), …`. For deliveries: `status IN ('pending','retry') AND due_at <= now()` → `status='sending', attempts = attempts + 1, claimed_at = now()`, and freeze `subject/text_body/html_body/waited_seconds` on the first claim, in the same transaction (D-31, Pitfall 1).

**Analog 3 — "still waiting" read** (`db/workflows.py:1860-1880`, `get_unanswered_ask_user`). Copy only the `EXISTS` / `NOT EXISTS` structure:
```sql
FROM messages m
JOIN workflow_runs wr ON wr.thread_id = m.thread_id
WHERE wr.id = $1
  AND m.role = 'system'
  AND m.tool_calls @> '[{"kind": "ask_user_prompt"}]'::jsonb
  AND m.tool_calls->0->>'run_id' = $1::text
  AND NOT EXISTS (
      SELECT 1 FROM messages r
      WHERE r.thread_id = m.thread_id
        AND r.role = 'system'
        AND r.tool_calls @> '[{"kind": "ask_user_response"}]'::jsonb
        AND r.tool_calls->0->>'tool_call_id' = m.tool_calls->0->>'tool_call_id'
  )
```
⛔ Do **not** call `get_unanswered_ask_user` itself: it returns `prompt` and `options` (`:1882-1891`). NOTE-03 requires the drainer never to read prompt text, so the new function selects `EXISTS(...)` and nothing from `tool_calls`. Combine with `notifications.closed_at IS NULL` and `workflow_runs.status IN ('active','paused')` (Pitfall 4).

**Analog 4 — the swallowing outcome writer** (`db/schedules.py:353-369` `record_schedule_outcome`): the one function that swallows its own exception because the outcome is a hint. Use the same shape for `record_delivery_outcome`.

**Recipient address:** `SELECT email FROM auth.users WHERE id = $1` through the pool (precedent `api/admin.py:898`). **Opt-out:** `coalesce((preferences->>'notification_email_enabled')::boolean, true)` from `user_settings`, read at send time (D-09).

---

### `backend/app/services/notification_drainer.py` (NEW, background loop, batch)

**Analog:** `scheduler_service.py:236-328` `SchedulerService`. Copy the class nearly verbatim: constructor with `pool` + interval + `max_claims_per_tick`, `tick()` that never lets one row stop the batch, `_loop` that waits on the stop `Event` with `wait_for` (not `sleep`), idempotent `start()` / `stop()`, and the two observability counters.
```python
async def _loop(self) -> None:
    while not self._stopping.is_set():
        try:
            n = await self.tick()
            if n:
                logger.info("scheduler launched %d scheduled run(s)", n)
        except Exception:  # noqa: BLE001 — a failed tick never ends the loop
            logger.exception("scheduler tick failed (the loop continues)")
        try:
            # `wait_for` on the stop event rather than a bare sleep, so shutdown does not
            # have to wait out a full poll interval.
            await asyncio.wait_for(self._stopping.wait(), timeout=self._poll_interval_seconds)
        except asyncio.TimeoutError:
            pass

def start(self) -> None:
    if self._task is not None:
        return
    self._stopping.clear()
    self._task = asyncio.create_task(self._loop())

async def stop(self) -> None:
    self._stopping.set()
    task, self._task = self._task, None
    if task is None:
        return
    task.cancel()
    try:
        await task
    except (asyncio.CancelledError, Exception):  # noqa: BLE001
        pass
```
Per-row error isolation (`:275-290`): `try: … except Exception: logger.exception(...)` and continue. Copy the module docblock's "THE DUPLICATE-SENDING GUARANTEE IS NOT IN THIS FILE" framing (`:8-14`), pointing at `db/notifications.py`. Send **outside** the claim transaction (anti-pattern: holding the row lock across HTTP). Make the send function injectable (a `send=` constructor kwarg defaulting to the mailer's `send_email`) so the live test can count calls (RESEARCH Wave 0 gap).

Stale `sending` rows: Resend re-sends the frozen payload with the same key; SMTP / none are marked `failed`, "interrupted, not retried to avoid a duplicate" (D-31, RESEARCH Pattern 2).

---

### `backend/app/main.py` (lifespan, FIRING — one start hunk + one stop hunk)

**Analog:** the scheduler start (`main.py:513-534`) and stop (`:646-656`). Gate on the **boot-sweep** expression rather than a new setting (`main.py:37-44` explains why a module flag; `tests/conftest.py:62` sets it False, so a `TestClient` never drains the shared local outbox):
```python
if not _setup_mode and RUN_BOOT_SWEEPS:  # Phase 158 (D-03); SEED-363 (296)
```
Start block shape (`:513-534`):
```python
_scheduler = None
if not _setup_mode and settings.scheduler_process_enabled:
    try:
        from app.services.scheduler_service import SchedulerService
        ...
        _scheduler = SchedulerService(pool=await get_pg_pool(), ...)
        _scheduler.start()
        logger.info("Workflow scheduler started (...)")
    except Exception:
        logger.exception("Workflow scheduler failed to start (app continues)")
        _scheduler = None
app_instance.state.workflow_scheduler = _scheduler
```
Stop block shape (`:651-656`):
```python
try:
    _sched = getattr(app_instance.state, "workflow_scheduler", None)
    if _sched is not None:
        await _sched.stop()
except Exception:  # noqa: BLE001
    logger.exception("Workflow scheduler stop failed at lifespan shutdown")
```
Source-fence test precedent: `tests/unit/test_workflow_scheduler.py:768-777` (`inspect.getsource(main_mod)` asserts the class name, the gate and `.stop()`).

---

### `backend/app/config.py` (config, FIRING — one hunk)

**Analog (in place):** `config.py:1718-1726`:
```python
# Phase 167 (INV-01, D-167-02) — env-switched invitation email delivery. The DEFAULT is
# ``none`` ... (the ``resend`` package is an opt-in lazy import, NOT a default requirement) ...
email_provider: str = "none"  # none | resend
resend_api_key: str = ""
invite_from_email: str = ""
```
Change the literal comment to `none | resend | smtp`, delete the stale "lazy import" sentence (RESEARCH "Deprecated/outdated"), and add `smtp_host`, `smtp_port`, `smtp_username`, `smtp_password`, `smtp_security` (D-28) in the same block. Keep `invite_from_email` (D-08 fallback).

---

### `backend/app/models/user_settings.py` (model, FIRING — fields + `_val` lines only)

**Analog:** `:303-306` (field declarations) and `:1206-1209` (loader):
```python
# 293 D-14 (migration 215): per-key API limits, ...
api_key_starts_per_minute: int = 10
api_key_reads_per_minute: int = 120
...
# 293 D-14 — a database without migration 215 still reads 10 / 120.
api_key_starts_per_minute=int(_val(row, "api_key_starts_per_minute", None, 10)),
api_key_reads_per_minute=int(_val(row, "api_key_reads_per_minute", None, 120)),
```
**Env-fallback precedent for D-08** (`:1202`): `vision_model=str(_val(row, "vision_model", "vision_model", "")),`. `_val(row, key, env_attr, default)` (`:892-904`) returns the DB value, else `getattr(env_settings, env_attr)`. So `email_from_address=str(_val(row, "email_from_address", "invite_from_email", ""))` makes `INVITE_FROM_EMAIL` the fallback with no extra code.

---

### `backend/app/api/settings.py` (controller, FIRING — allow-list, read model, body, bounds)

**Analogs (all in place):**
- `_BOUNDED_SETTINGS_FIELDS` (`:44-57`): add `"notification_email_delay_seconds"`. `test_242_stored_value_refusal.py` asserts every bound routes through `_range_refusal_detail`, so the allow-list entry is required (`:40-43`).
- Read model fields (`:118-119`), update body fields (`:357-358`, `int | None = None` with a bound comment), response mapping (`:458-459`).
- Bounded write (`:832-849`):
```python
if body.api_key_starts_per_minute is not None:
    if not 1 <= body.api_key_starts_per_minute <= 60:
        raise HTTPException(
            status_code=400,
            detail=await _range_refusal_detail(
                field="api_key_starts_per_minute",
                label="Starts per minute, per key",
                submitted=body.api_key_starts_per_minute,
                lo=1, hi=60,
                typed_detail=("Starts per minute, per key must be between 1 and 60. ..."),
            ),
        )
    updates["api_key_starts_per_minute"] = body.api_key_starts_per_minute
```
- String field where empty is a real value (`:756-763`, `vision_model`): `updates["vision_model"] = body.vision_model.strip()`. Use this for `email_dev_redirect_address` (empty = suppress, D-10). For `email_from_address` validate as a single `local@domain` before storing (the `smtp_adapter._validated_envelope_recipient` rule, `:126-169`); for `email_from_name` strip CR/LF.

---

### `backend/app/api/me_preferences.py` (controller, per-user JSONB)

**Analog (in place):** the RLS-scoped `||` merge (`:98-117`):
```python
async with get_user_pg_connection(request, current_user) as conn:
    await conn.execute(
        "INSERT INTO public.user_settings (user_id, preferences) "
        "VALUES (auth.uid(), $1::jsonb) "
        "ON CONFLICT (user_id) DO UPDATE "
        "SET preferences = coalesce(public.user_settings.preferences, '{}'::jsonb) || $1::jsonb, "
        "    updated_at = now()",
        {"default_model": desired},
    )
```
Add `notification_email_enabled: bool | None = None` to the body (`:39-41`). Merge only when it is set, so the existing `default_model` semantics stay byte-identical (null still clears the model; an absent bool leaves the switch alone). Add it to the GET dict (`:62-67`), read with a default of `True`. No migration is needed. This router is ungated (D-07 of 283), which is why the member switch lives in Preferences.

---

### `backend/app/services/health_probe.py` (service, request-response)

**Analog:** `probe_sandbox` (`:80-104`), the honest three-state probe: `off` when deliberately disabled, never `down`:
```python
if not settings.sandbox_enabled:
    return {"state": "off", "latency_ms": None}
```
and `probe_dependencies` (`:107-113`), which `gather`s probes that each swallow their own failure. Add `probe_email()`. It returns `off` when `email_provider == "none"` (or non-production with no redirect), `down` when the latest delivery is `failed` and newer than the latest `sent`, else `up`. It carries `provider`, `last_failure_at` and `last_failure_reason`, the contract RESEARCH fixes for both plans: `dependencies.email = {state, provider, last_failure_at, last_failure_reason}`. Read through the asyncpg pool, bounded by `_PROBE_TIMEOUT_S`. **No edit to the FIRING `admin.py`**: `get_backpressure` (`admin.py:260`) already spreads `probe_dependencies()`. Update `__all__` (`:116`).

---

### `backend/app/api/org.py` (controller; no ledger row — add one)

**Analog (in place):** send `:405-441`, resend `:525-552`. Today:
```python
try:
    # WR-01 (D-v2.5-01): send_invite is a BLOCKING HTTP call on the resend path — never
    # run it directly on the event loop. run_in_threadpool keeps the async handler free.
    await run_in_threadpool(get_email_provider().send_invite, email, link, org_name)
except Exception as exc:  # link-first: delivery never fails the invite
    logger.error("invite email delivery failed for %s: %s", email, exc)
...
return {"link": link, "invitation": {...}}
```
Keep `run_in_threadpool` and "link-first: delivery never fails the invite". Capture the `SendOutcome`, write it to `org_invitations.email_delivery` (+ failure time and reason) with one `UPDATE` on the same connection pattern, and add `email_sent: bool` beside `link` in both responses. Add `email_delivery` to the list SELECT column list (`:457`).

---

### `backend/app/services/inbound_inputs.py` (utility, transform)

**Analog:** `missing_required` (`:144-166`). Add a sibling `missing_required_labels(definition, inputs) -> list[str]` with the **same loop**, appending `field.label` (`DeclaredField.label`, `:57-63`, already falls back to the key in `_label`, `:76-78`), plus one sentence composer. Do not write a second predicate. Cleanest: factor the loop into a private `_missing_fields(...) -> list[DeclaredField]` that both call, so the browser pin (`launch_fields_cases.json`) still covers one predicate.

---

### `backend/app/api/schedules.py` (controller, FIRING — create + patch checks)

**Create door analog:** `create_workflow_schedule` (`:121-132`). Insert the check after the `published` 400, before `create_schedule`. Shape and status from the in-app door (`workflow_kickoff.py:265-269`):
```python
if _missing := missing_required(_raw_def, getattr(body, "inputs", None)):
    raise HTTPException(status_code=422, detail=f"Missing required input(s): {', '.join(_missing)}.")
```
Use `missing_required_labels` and the shared sentence (D-14 names labels). `definition_row` is already loaded at `:121`.

**Patch door:** `patch_schedule` (`:207-214`) uses `body.model_dump(exclude_unset=True)`. Check only when `"inputs"` is in that dict; load `get_schedule` → `workflow_id` → `get_definition`. A pause/resume toggle (`is_active` only) must never be refused.

---

### `backend/app/services/scheduler_service.py` (service, FIRING — one block + outcome)

**Analog (in place):** the template refusal block (`:118-132`), copied a third time after the foreign-folder block (`:134-150`) and before the entitlement check (`:154`):
```python
sentence = template_refusal(definition)
if sentence is not None:
    from app.db.schedules import record_schedule_outcome

    logger.warning("schedule %s not launched: workflow %s has a fill step with no template",
                   schedule.get("id"), workflow_id)
    await record_schedule_outcome(pool, _as_uuid(schedule["id"]), status=sentence)
    raise ScheduledLaunchRefused(sentence)
```
`tick()` already skips a refused schedule without overwriting the sentence (`:280-282`), and Run now already returns `outcome="refused"` with it.

**Pitfall 8 / D-26 (honest `paused`):** `_record_outcome` (`:196-200`) receives `"completed"` from `unattended_launch.py:357` even when the run paused. Read `workflow_runs.status` for the run before recording, and record a distinct waiting value when it is `paused` or has an unanswered prompt. That is one read inside this closure; `unattended_launch.py`'s `on_finish` contract stays unchanged.

---

### `backend/app/services/run_model_resolution.py` (service; no ledger row — add one) — FIX-05 helper

**Analogs:** the owner-settings load + ctx-model resolve used on resume (`api/runs.py:1510-1520`, `harness_engine.py:2563-2572`) and the fail-soft chain (`api/model_registry.py:109-125`):
```python
from app.models.user_settings import load_user_settings  # noqa: PLC0415
from app.services.sub_agent_models import resolve_workflow_ctx_model  # noqa: PLC0415
try:
    _owner_settings = load_user_settings(current_user["id"])
except Exception:  # noqa: BLE001
    logger.exception("continue: owner effective-settings load failed for run %s ...", wf_run_uuid)
    _owner_settings = None
_ctx_model = resolve_workflow_ctx_model(_owner_settings)
```
New `async def resolve_owner_run_model(owner_id) -> tuple[str | None, str | None]` loads with `await run_in_threadpool(load_user_settings, str(owner_id))` (D-v2.5-01), and returns `(resolve_workflow_ctx_model(s) or None, s.active_provider or None)`. On failure: log and `(None, None)`. Function-local imports, as in `model_registry.py:110-114`. Add the name to `__all__` (`:302-308`).

---

### `backend/app/services/unattended_launch.py` (service — two small edits)

**Analog (in place):** `create_workflow_run(..., model=None, ...)` at `:181-192` → pass `model=_model, provider=_provider` (the writer puts `provider` into `metadata` in the same INSERT, `db/workflows.py:545-552`; the in-app door does this at `api/threads.py:2099-2100`). The `_drive_run` dict at `:274-284` gains `"model": _model` and `"metadata": {"provider": _provider} if _provider else None`, so first launch takes the same branch as resume. The reader that makes this work is `harness_engine.py:2581-2600`, which uses the recorded provider only when both `run["model"]` and `metadata.provider` are present. `run_lifecycle.py` / `run_producer.py` are NOT touched (D-33).

---

### `backend/app/services/connectors/smtp_adapter.py` (adapter; no ledger row — add one) — D-24

**Analog (in place):** `:361-365`:
```python
# A plain-text part only. There is no rendered-markup surface to break out of, which
# is why nothing is escaped here and why an HTML part is out of scope (D-32) ...
message.set_content(body)
```
Replace it with `message.set_content(body)` + `message.add_alternative(_MD.render(body), subtype="html")`, where `_MD = MarkdownIt("js-default", {"breaks": True, "html": False})` is built once at module level (D-32; the `commonmark` preset is forbidden). Rewrite the comment and the `INPUT_SCHEMA` docstring at `:289-292` to say an HTML **alternative of the body** now exists while CC/BCC/attachment stay refused. `detail=f"accepted for delivery by {settings.host}"` (`:420`) may name the recipient for D-23, or leave it to the receipt.

### `backend/app/services/harness/phase_types.py` (FIRING, "G-5 OWED") — D-23, one line

**Analog (in place):** `_external_action_sent_body` (`:2281-2306`):
```python
f"  {'Destination'.ljust(width)}: {host}",
```
Make "Destination" answer *who* (the recipient, from `resolved`/`args["to"]`) for the SMTP capability, with the host as a trailing transport detail. Update the docstring's "the recipient and the credential are not named" to say the credential is still never named. Change nothing else in this file.

---

### Deploy parity artifacts (same commit as the `config.py` change)

Existing lines to extend, all read this session:
- `deploy/onebox.env.example:253-258`: `EMAIL_PROVIDER=none` and commented `RESEND_API_KEY` / `INVITE_FROM_EMAIL`. Add commented `SMTP_*`, and mark `INVITE_FROM_EMAIL` as a fallback superseded by Settings.
- `docker-compose.prod.yml:60-65`: `EMAIL_PROVIDER: ${EMAIL_PROVIDER:-none}` etc. Add `SMTP_*: ${SMTP_*:-}`.
- `scripts/check-deploy-drift.sh:103-106`: the `OMITTED_FROM_ONEBOX` entry with a reason comment. Each new `SMTP_*` either goes in the one-box file or gets an entry here with a reason.
- `backend/.env.example:266-268` and `docs/OPERATOR.md:415-425`: remove "`pip install resend`". Document the three providers, the Settings knobs (delay with default and bounds, **no Step-3 row, no `218_` filename**, D-27), `ENVIRONMENT=production` as a deploy checklist item (D-30), and DNS (SPF / DKIM / DMARC `p=none`).
- `backend/requirements.txt`: add `markdown-it-py>=4.0.0`.

---

### `frontend/src/components/settings/EmailSettings.tsx` (NEW, S3 operator card)

**Analog:** `components/settings/ApiKeyLimits.tsx`, copied file-for-file:
- Docblock "WHY A LEAF" / "ONE SAVE PER SECTION" / invariants (`:9-35`).
- Handle type (`:52-58`):
  ```tsx
  export type ApiKeyLimitsHandle = {
    changes: () => SettingsUpdate
    adopt: (saved: Pick<FullAppSettings, "api_key_starts_per_minute" | "api_key_reads_per_minute">) => void
  }
  ```
- Load with `alive` ref + `loadState` (`:107-144`). Changed-fields-only `changes()` that returns `{}` until loaded (`:146-154`). `useImperativeHandle` with no deps (`:156-170`). Clamp-on-blur number input with `limitFrom` (`:42-48`, `:172-175`) for the delay (60..3600). The failure row with Retry (`:208-218`).
- Row layout `LimitRow` (`:60-105`): `Label w-56 shrink-0`, `Input h-8 … font-mono ghost-border`, hint `text-xs text-muted-foreground`. Address inputs use `type="email"`.
- Copy lives in a copy module (as `API_KEYS_COPY.limits`, `:37`), not inline.
- The "Sent through" row is read-only. It needs the provider name from the server: add it to the `GET /settings` read model (non-secret), never the key.

### `frontend/src/pages/SettingsPage.tsx` (FIRING — one ref, one spread, one adopt, one mount)

**Analog (in place):** the ApiKeyLimits wiring:
```tsx
import { ApiKeyLimits, type ApiKeyLimitsHandle } from "@/components/settings/ApiKeyLimits"   // :51
const apiKeyLimitsRef = useRef<ApiKeyLimitsHandle>(null)                                     // :700
        ...apiKeyLimitsRef.current?.changes(),                                                // :832
      apiKeyLimitsRef.current?.adopt(updated)                                                 // :836
              <ApiKeyLimits ref={apiKeyLimitsRef} />                                          // :1629
```
Mount `EmailSettings` directly after `:1629` (UI-SPEC S3: after `ApiKeyLimits`, before the Save Integrations button).

### `frontend/src/lib/api/skills.ts` (FIRING — optional fields)

**Analog:** `:584-585` (`FullAppSettings`) and `:731-732` (`SettingsUpdate`): `api_key_starts_per_minute?: number`. Add `notification_email_delay_seconds?: number`, `email_from_address?: string`, `email_from_name?: string`, `email_dev_redirect_address?: string` to both, plus the read-only `email_provider?: string` on `FullAppSettings` only.

### `frontend/src/components/settings/EmailNotificationPreference.tsx` (NEW, S2 member switch)

**Analog 1 — self-fetching, self-persisting, server-derived leaf:** `ModelDefaultPreference.tsx:27-62` (`cancelled` guard load effect; `onSelect` persists, then renders the server response; `saving` + `error` state). Card shell `:77-79` (`rounded-lg border border-border bg-card/60 p-5 shadow-sm`, `font-headline text-sm font-bold` title).

**Analog 2 — the switch look (UI-D1: copy, not extract):** `SettingsPage.tsx:229-251` `Toggle`:
```tsx
<div className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
  checked ? "bg-primary" : "bg-muted")}>
  <span className={cn("inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform",
    checked ? "translate-x-4" : "translate-x-1")} />
</div>
```
Render it as `<button type="button" role="switch" aria-checked={checked}>` (UI-SPEC S2). Row shape from `PreferencesSection.tsx:26-34`.

**API client:** add `getNotificationEmailPreference` / `setNotificationEmailPreference` (or extend the `/me/preferences` reader) in `lib/api/settings.ts`, copying `getModelDefault` / `setModelDefault` (`:109-143`): `getAuthHeaders()`, `cache: "no-store"` on the GET, `ApiError` with a sentence, and a defensive `?? true` unwrap for an older backend. ⛔ Calls only the ungated `/me/preferences` (`PreferencesSection.tsx:14-17`).

### `frontend/src/components/settings/PreferencesSection.tsx` — one mount after `<ModelDefaultPreference />` (`:36`).

---

### `frontend/src/components/org/InviteMemberDialog.tsx` / `InvitationsTab.tsx` / `lib/api/org.ts` (S4, D-11)

- `org.ts:261-264` `SendInvitationResult` gains `email_sent?: boolean`; `sendInvitation` unwraps it at `:290-293` (`body.email_sent ?? true`, so an older backend never shows a false failure). `resendInvitation` (`:312-321`) returns the same flag. `Invitation` (`:249-257`) gains `email_delivery?: "sent" | "failed" | "not_sent" | null`.
- Dialog: the failure line goes in the link-first success panel (`InviteMemberDialog.tsx:147-188`), above the existing Copy link row, which is already the remedy. Keep the docblock's "reserved operator warning tint is never used" rule (`:22-23`). Icon `MailX` (UI-SPEC).
- List: an "Email not sent" chip beside the status chip, using the shared `StatusChip` exactly as `InvitationsTab.tsx:220-225`:
  ```tsx
  <StatusChip tone={status.tone} testId="invitation-status">{status.label}</StatusChip>
  ```
- Both sentences come from one new copy leaf `inviteDeliveryCopy.ts` (UI-SPEC S4), with the zero-import rule of `decisionsVocabulary.ts:21-24`.

### `frontend/src/components/admin/HealthSignals.tsx` (S5; no ledger row — add one)

**Analog (in place):** `DEP_ORDER` (`:94-102`) gains `{ key: "email", label: "Email", sub: … }`, and the key union widens. `DepProbe` (`:84-87`) gains optional `provider`, `last_failure_at`, `last_failure_reason`. `depStatus` (`:106-113`) already maps `off` first (neutral, never red), which is the right state for `EMAIL_PROVIDER=none` or a non-production box with no redirect. The grid is `sm:grid-cols-3` (`:244`); a fourth tile needs `sm:grid-cols-4` or a wrap. The ⌥ technical reveal (`:265-273`) prints `dependencies.email` for free. The last-failure words render under `d.sub` only when present.

---

### `frontend/src/components/workflows/scheduleOutcomeVocabulary.ts` (NEW, D-15 / D-26)

**Analog 1 — the leaf rule:** `decisionsVocabulary.ts:21-24`: imports nothing, asserted by its test rather than by comment.
**Analog 2 — the wire-value-to-words switch with a verbatim fallback:** `settings/apiKeys/apiKeyFacts.ts:225-265`:
```ts
    case "foreign_folder": // 298-02 (ORG-05)
      return C.calls.foreignFolder
    case "workflows_disabled":
      return C.calls.workflowsDisabled
    ...
    case null:
    case undefined:
    case "":
      return null
    default:
      return call.reason
```
Map `completed`, `failed`, `launch_failed` (`scheduler_service.py:38`), `cadence_error` (`db/schedules.py:297-300`) and the new waiting value (D-26) to sentences. Any other value is a server-authored sentence (template, foreign folder, kill switch, blank input) and **passes through verbatim** as `default:`. No raw status word may reach the screen.

### `frontend/src/components/workflows/WorkflowScheduleModal.tsx` (FIRING — S6, D-15/D-16)

**Analog (in place) — the exact lines to change:**
- Leak (`:416-421`): `` {s.last_status ? ` · ${s.last_status}` : ""} `` → the vocabulary sentence.
- Whole-list reload (`:185-206`, `:385-386`): `refresh` always does `setLoading(true)`, and the list renders `Loading…` while it is true. Add a quiet refresh (no `setLoading` once rows exist) for Run now.
- Global busy (`:246-259` `withBusy`, `:323-336` `onRunNow`, `:442` `disabled={busy}`): Run now should key the row's busy state on the existing `runningId` (`:443` already uses it for `aria-busy`), not the global `busy`.
- Row-local result line is already there (`:121-134` `runNowResult` + `RUN_NOW_TONE`, `:427-436`); keep it.
- Client-side required refusal already exists (`:261-268`, `missingRequiredFields` / `requiredFieldsMessage`). The server 422 sentence arrives through `readScheduleFailure` (docblock `:21-24`) and `setError`.

---

## Shared Patterns

### Blocking I/O off the event loop (D-v2.5-01)
**Source:** `api/org.py:409-411`, `smtp_adapter.py:380-389`, `health_probe.py:69-73`
**Apply to:** mailer callers (invite, drainer), SMTP send, `load_user_settings` in `resolve_owner_run_model`.
```python
await run_in_threadpool(get_email_provider().send_invite, email, link, org_name)
```

### Exactly-once across workers (D-PRD-12)
**Source:** `db/schedules.py:273-350` (+ docblock `:278-302`), `scheduler_service.py:8-14`
**Apply to:** `db/notifications.py`, `notification_drainer.py`. The SKIP LOCKED select and the status change happen in one transaction, and the send happens after commit.

### Background service lifecycle + test isolation
**Source:** `main.py:37-44` (`RUN_BOOT_SWEEPS`), `:513-534`, `:646-656`; `tests/conftest.py:62`
**Apply to:** the drainer. Reuse the flag, add no env var, and park the service on `app_instance.state`.

### Escape every interpolated value; subjects are plain text with CR/LF stripped
**Source:** `email_provider.py:72-81` (WR-02); `smtp_adapter.py:146-150, 351-360`
**Apply to:** `run_waiting_email.py`, the rebuilt invite email, the `email_from_name` write.

### Never log a secret or a body
**Source:** `google/_http.py:170-173` ("The BODY is not logged"), `smtp_adapter.py:136, 356-357` (name the field, never the value)
**Apply to:** the Resend and SMTP providers, the outcome `reason` column, the health tile reason.

### Honest neutral state for "deliberately off"
**Source:** `health_probe.py:80-90`, `HealthSignals.tsx:104-133`
**Apply to:** the Email probe and tile. `none` provider → `off`, never `down`.

### Leaf components on FIRING pages (G-5 honoured by construction)
**Source:** `ApiKeyLimits.tsx:17-18` ("SettingsPage.tsx is G-5 FIRING, so … this component owns its own fetch and draft state, and the page holds only a ref")
**Apply to:** `EmailSettings.tsx`, `EmailNotificationPreference.tsx`, `scheduleOutcomeVocabulary.ts`, `inviteDeliveryCopy.ts`.

### Words-first copy in a module
**Source:** `decisionsVocabulary.ts:1-24`, `apiKeys/apiKeysCopy.ts` (used at `ApiKeyLimits.tsx:7, 37`)
**Apply to:** every new user-visible sentence (S2-S6).

### DB-backed tests
**Source:** `tests/integration/_rls_harness.py:39-72` (`PG_TEST_DSN`, `requires_pg`), `test_299_links_live.py:36-61` (`_savepoint` that always rolls back), `:64-91, 134-157` (row builders for users, orgs, threads, definitions, `workflow_runs`), `:212-222` (`SET LOCAL ROLE anon` → zero rows or `InsufficientPrivilegeError`); `test_181_secdef_privileges.py:61-115` (`has_function_privilege('anon'|'authenticated', 'public.<fn>()', 'EXECUTE')` for PUBLIC/anon/authenticated) and `:118-177` (triggers still fire without EXECUTE).
**Apply to:** `test_300_notice_triggers_live.py`, `test_300_rls_anon_live.py`. For the trigger tests, insert `messages` rows with `role='system'`, `origin='harness'` and `tool_calls=[{kind:'ask_user_prompt', run_id, tool_call_id}]` inside the rolled-back transaction, and assert `notifications` / `notification_deliveries` rows.
**Concurrency:** `test_workflow_scheduler.py:406-450` (`live_pool`: real pool, `server_settings={"search_path": …}` not `SET` in `init` (measured: `RESET ALL` on release), a jsonb codec, cleanup in `finally`) and `:473-495` (two claimers via `asyncio.gather`, assert disjoint sets plus a non-vacuity check). `test_300_drainer_once_live.py` needs **committed** rows visible to two connections, so it cannot use a single rolled-back transaction. Seed with explicit ids and delete them in `finally` (the `test_230_upload_queue_cutover.py:57-90` fixture-cleanup shape), under the local-DB lock.

### httpx unit tests without the network
**Source:** `tests/unit/decision_engine_fakes.py:58-80` (`Recorder`), `:109-140` (fault handler: 401/429/500, connect/read timeout, non-JSON, plus a body marker to prove no log leak), `:143-147`:
```python
def install(monkeypatch, module, handler) -> None:
    """Route ``module._http_client`` through a MockTransport, keeping the adapter's timeout."""
    def _client(timeout):
        return httpx.Client(transport=httpx.MockTransport(handler), timeout=timeout)
    monkeypatch.setattr(module, "_http_client", _client)
```
**Apply to:** `test_300_mailer.py` and the re-targeted `test_276_invite_email_brand.py` (D-34). Its assertions at `:45-77` (escaped org, escaped href, logo from the primary origin only, unescaped subject, none provider logs the link) move from the fake `resend` module onto the captured httpx request body. Delete the `sys.modules["resend"]` fixture (`:27-42`).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `backend/tests/unit/test_300_clean_image_imports.py` | test | — | No existing test checks an import closure against `requirements.txt`. **Partial analog:** `test_214_args_leaf.py:48-68` (AST walk collecting `Import` / `ImportFrom`, including function-local imports). Extend it with `sys.stdlib_module_names`, `app.*`, and the dists declared in `backend/requirements.txt` minus `sentence-transformers` (the `Dockerfile` filter), mapped import name → dist (`markdown_it` → `markdown-it-py`). Also assert `resend` appears nowhere under `backend/app` (RESEARCH Pitfall 7). |

## Ledger Rows Owed at Planning (G-5 gate fails without them)

`node scripts/check-hot-file-ledger.cjs <phase-dir>` fails on any non-test `backend/app` / `frontend/src` path in `files_modified` without a row, **new files included**. Rows owed: `backend/app/api/org.py`, `backend/app/services/connectors/smtp_adapter.py`, `backend/app/services/health_probe.py`, `backend/app/api/me_preferences.py`, `backend/app/services/run_model_resolution.py`, `frontend/src/components/org/InviteMemberDialog.tsx`, `frontend/src/components/org/InvitationsTab.tsx`, `frontend/src/components/admin/HealthSignals.tsx`, and every new module (`services/run_waiting_email.py`, `services/notification_drainer.py`, `db/notifications.py`, `EmailSettings.tsx`, `EmailNotificationPreference.tsx`, `scheduleOutcomeVocabulary.ts`, `inviteDeliveryCopy.ts`). Each row needs its section in `docs/HOT-FILE-LEDGER.md` in the same commit.

## Metadata

**Analog search scope:** `backend/app/{services,db,api,models}`, `backend/app/main.py`, `backend/app/config.py`, `supabase/migrations/21[4-7]_*.sql`, `backend/tests/{unit,integration}`, `frontend/src/{components/settings,components/admin,components/org,components/workflows,lib/api,pages}`, deploy artifacts
**Files scanned:** ~45 (read or grepped this session)
**Pattern extraction date:** 2026-10-29

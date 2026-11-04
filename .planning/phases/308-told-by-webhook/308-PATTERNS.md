# Phase 308: Told by Webhook - Pattern Map

**Mapped:** 2026-11-04
**Files analyzed:** 63 (31 new, 32 modified, incl. tests, scripts and docs)
**Analogs found:** 60 / 63 (3 with no in-repo analog: the Standard Webhooks signer, its interop test, `backend/requirements-dev.txt`)

Every analog below was read this session. Line numbers are from the working tree at `8bde67e05`.
D-41..D-54 override the earlier CONTEXT sentences, and this map follows them.

---

## Read these first: nine findings that change a plan

These came out of reading the analogs. None of them contradicts a decision. Each one is a place where copying the analog verbatim would ship a defect.

| # | Finding | Evidence | What the plan must do |
|---|---|---|---|
| P-1 | **`OrgConnectedApps` renders nothing behind a feature flag. Do not copy that gate.** | `frontend/src/components/org/OrgConnectedApps.tsx:89-95, 116` (`if (oauthAvailable) void load()` … `if (!oauthAvailable) return null`) | `OrgWebhooks` has no switch (the kill switch is deferred), so it always reads and always renders. Copy the read/alive/receipt shape and leave out the `oauthAvailable` prop. |
| P-2 | **`ApiKeysTab` does not re-read when the active org changes.** UI-SPEC Surface 1 requires the Webhooks tab to do so (endpoints belong to one org, D-04). | `ApiKeysTab.tsx:90` reads `useOrgOptional()` only for the org *name* (`:197`). The load effect deps are `[load, openDraft]` (`:144-152`). | `WebhooksTab` keys its load effect on `useOrgOptional()?.activeOrgId`, so a switch of org re-reads the list and drops any open secret-once card. Pin it in the tab's vitest. |
| P-3 | **Use 224's transaction wrapper, not 218's.** 218 has no `BEGIN/COMMIT`. 224 does, and its static test pins it. | `218_run_waiting_notifications.sql` (no BEGIN); `224_mcp_oauth_grants.sql:44, 133`; `test_307_migration_224_static.py:51 test_transaction_wrapped` | `225_webhooks.sql` = `BEGIN; … COMMIT;` (the `$fn$` bodies are fine inside it), followed by a read-only VERIFY that is either an executable `SELECT … 'PASS'` (218 `:341-363`) or a commented block (224 `:135-164`). |
| P-4 | **The 300 claim passes `MAX_ATTEMPTS` as a bind parameter, and the record only lands on a `'sending'` row.** Both guards are load-bearing, and a fresh claim SQL drops them easily. | `db/notifications.py:66-71` (`d.attempts < $3 … FOR UPDATE OF d SKIP LOCKED`); `:176-186 RECORD_SQL … AND status = 'sending'`; `:167-174 RENEW_LEASE_SQL … AND attempts = $2` | `db/webhooks.py` keeps all three: `attempts < $n` in the claim, `status = 'sending'` in every record, `status = 'sending' AND attempts = $n` in the renew. The two-drainer live test needs a WR-03 case (`test_300_drainer_once_live.py:327-365`). |
| P-5 | **The 300 drainer threadpools its send because `send_email` is blocking. The webhook send is already async.** | `notification_drainer.py:135` (`await run_in_threadpool(self._send, …)`); `egress.py:770-773` (`send_pinned_http` already runs `validate_destination` off-loop) | The drainer awaits `webhook_sender.send(...)` directly. **Save-time** validation in `api/webhooks.py` *does* need `run_in_threadpool(egress.validate_destination, "webhook", url, None, allowed_host=host)`, because that function is a plain blocking `def`. |
| P-6 | **The citation limiter answers with a dict `detail`, and the apiKeys client reader only surfaces a string.** | `rate_limit.py:135-141` (`detail={"reason": "rate_limited"}`); `lib/api/apiKeys.ts:297-311` (`readApiKeyFailure`: string `detail` or Pydantic list, else `"The request was refused (status N)"`) | Pick one and pin it. Either `enforce_user_webhook_limit` raises a **string** sentence (the `enforce_key_limit` `:68-78` shape), or `lib/api/webhooks.ts` maps `{reason}` to `webhooksCopy` words. The test verdict and Resend must never show "status 429". |
| P-7 | **Audit writes from a background drainer have no request and no supabase client.** | `api_keys.py:830-837` (`audit_supabase = await run_in_threadpool(get_service_role_supabase, str(org))` then `await write_audit_entry(..., org_id=str(org))`) | Routes and the drainer (`auto_disabled`) both use that exact pair with an **explicit `org_id`** (T-167-23). Never `audit_key_call` (it is key-shaped, `api_keys.py:685-692`). Metadata = actor, endpoint id, host only (D-31). |
| P-8 | **`LIST_OPEN_SQL`'s org-membership join is the access wall, and it must survive the rewrite.** | `db/notifications.py:219-226` (`JOIN public.org_members m ON m.org_id = n.org_id AND m.user_id = $1`); the docblock at `:204-213` says the two `$1` predicates ARE the wall | The D-48 rewrite turns only the `workflow_runs` and definitions joins into LEFT JOINs (plus a LEFT JOIN on `webhook_endpoints`). The `org_members` and `organizations` inner joins stay, so a member who left the org stops seeing the notice. `count(*) OVER ()` stays, so `total` counts the webhook row. |
| P-9 | **The UI-SPEC calls `OrgApiKeysTab.tsx` "young (3/3/150)". It FIRES.** | RESEARCH §Q12 (measured by the gate); `OrgApiKeysTab.tsx` is 150 lines with the 307 mount at `:96` | A one-line mount after `:96` is honoured by construction. The plan still names the file in `files_modified` and updates its ledger row and section in the same commit. |

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/225_webhooks.sql` (NEW) | migration | DDL + triggers (event-driven) | `218_run_waiting_notifications.sql` (outbox, triggers, grants) + `224_mcp_oauth_grants.sql` (BEGIN/COMMIT, deny-all) + `217_org_item_move_audit.sql` (audit CHECK restate) | exact |
| `scripts/check-migration-225-live.py` (NEW) | utility (script) | read-only catalog | `scripts/check-migration-224-live.py` | exact |
| `scripts/full-schema-supplement.sql` (FIRES ⛔) | config | DDL mirror | its own mig-224 block, `:929-942` | exact |
| `backend/app/db/webhooks.py` (NEW) | model/db | CRUD + outbox claim/lease | `backend/app/db/notifications.py` (claim/lease/record) + `backend/app/db/api_keys.py` (owner-predicate CRUD) | exact |
| `backend/app/services/webhook_drainer.py` (NEW) | service | event-driven poll loop (batch) | `backend/app/services/notification_drainer.py` | exact |
| `backend/app/services/webhook_sender.py` (NEW) | service | request-response (one outbound POST) | `backend/app/mcp/oauth_clients.py:384-427` (`fetch_cimd_document`) | role-match |
| `backend/app/services/webhook_signer.py` (NEW) | utility | transform (pure) | none (RESEARCH §Code Examples); module shape of `security/secret_cipher.py` | **no analog** |
| `backend/app/api/webhooks.py` (NEW) | controller | CRUD (member + admin) | `backend/app/api/api_keys.py` (`router` + `org_router`) | exact |
| `backend/app/models/webhook.py` (NEW) | model | DTO + typed payloads | `backend/app/models/api_key.py` + `api/notifications.py:60-77` | role-match |
| `backend/app/security/egress.py` (FIRES) | utility | outbound HTTP config | itself, `client_metadata` entries `:335, :356, :379` | exact |
| `backend/app/main.py` (FIRES) | config | lifespan + routing | itself, 300 drainer block `:536-552`, stop `:677-684`, import `:915`, include `:970` | exact |
| `backend/app/services/audit_service.py` (FIRES) | config | literal list | itself, `:35-38` | exact |
| `backend/app/services/rate_limit.py` (FIRES ⛔) | service | Redis counter | itself, `enforce_user_citation_limit` `:115-141` | exact |
| `backend/app/services/outbound_guard.py` | service | transform | itself, `guard()` `:113-142` | exact |
| `backend/app/db/notifications.py` | model/db | read | itself, `LIST_OPEN_SQL` `:203-227` | exact |
| `backend/app/api/notifications.py` | controller | read | itself, `WaitingNotice` `:60-107` | exact |
| `backend/requirements-dev.txt` (NEW) | config | — | none (CI precedent `.github/workflows/backend-tests.yml:49-54`) | **no analog** |
| `.github/workflows/backend-tests.yml` | config | CI | itself, `:49-54` (psycopg2 install line) | exact |
| `scripts/build-public-openapi.cjs` (FIRES) | config | — | itself, FLAGGED `/notifications` `:87`, `TAG_GROUPS` `:132` | exact |
| `docs/public/administer/settings/webhooks.md` (NEW) | docs (stub) | — | `docs/public/administer/control-room/audit.md` (stub frontmatter) + `administer/settings/api-keys.md` (slug/covers) | exact |
| `docs/public/sections.json` | config | — | its `administer/settings/api-keys` entries `:179, :210` | exact |
| `docs/HOT-FILE-LEDGER.md` | docs | — | its existing "young (created …)" rows | exact |
| `backend/tests/integration/test_308_drainer_once_live.py` (NEW) | test | live, committed | `tests/integration/test_300_drainer_once_live.py` | exact |
| `backend/tests/integration/test_308_emission_matrix_live.py` (NEW) | test | live, rolled back | `tests/integration/test_300_notice_triggers_live.py` (`_world`, `requires_218`) | exact |
| `backend/tests/integration/test_308_rls_anon_live.py` (NEW) | test | live catalog + role switch | `tests/integration/test_307_schema_privileges_live.py` + `test_300_rls_anon_live.py:211-247` | exact |
| `backend/tests/integration/test_308_notice_live.py` (NEW) | test | live | `tests/integration/test_300_rls_anon_live.py` (`_savepoint`, `_apply_rls_user_context`) | role-match |
| `backend/tests/integration/test_308_visibility_live.py` (NEW) | test | live, committed | `test_300_drainer_once_live.py` `_world` + `:242-252` (ex-member case) | role-match |
| `backend/tests/integration/test_308_db_live.py` (NEW) | test | live | `test_307_schema_privileges_live.py:128-238` (rolled-back row behaviour) | exact |
| `backend/tests/unit/test_308_migration_225_static.py` (NEW) | test | static text | `tests/unit/test_298_migration_217_shape.py` + `test_307_migration_224_static.py` | exact |
| `backend/tests/unit/test_308_check_script.py` (NEW) | test | unit | `tests/unit/test_307_migration_224_check_script.py` | exact |
| `backend/tests/unit/test_308_egress_capability.py` (NEW) | test | unit | `tests/unit/test_307_cimd_fetch.py:159-182` | exact |
| `backend/tests/unit/test_308_ssrf_corpus.py` (NEW) | test | unit (seams) | `tests/unit/test_307_cimd_fetch.py:40-59, 94-115` | exact |
| `backend/tests/unit/test_308_no_body_scan.py` (NEW) | test | static scan | `tests/unit/test_300_notification_drainer.py:465-501` | exact |
| `backend/tests/unit/test_308_routes.py`, `test_308_admin_routes.py` (NEW) | test | unit (fresh FastAPI + store) | `tests/unit/test_307_connected_apps_routes.py` | exact |
| `backend/tests/unit/test_308_drainer.py` (NEW) | test | unit | `tests/unit/test_300_notification_drainer.py` | exact |
| `backend/tests/unit/test_308_payload.py` (NEW) | test | unit | `tests/unit/test_305_outbound_guard.py` (named; not read here) | role-match |
| `backend/tests/unit/test_308_signer.py` (NEW) | test | unit (interop) | none | **no analog** |
| `frontend/src/components/settings/webhooks/WebhooksTab.tsx` (NEW) | component | CRUD list | `settings/apiKeys/ApiKeysTab.tsx` (+ P-2) | exact |
| `…/webhooks/WebhookEndpointCard.tsx` (NEW) | component | render + actions | `settings/apiKeys/ApiKeyCard.tsx` / `ConnectedAppCard.tsx` | role-match |
| `…/webhooks/WebhookEndpointForm.tsx` (NEW) | component | form | `settings/apiKeys/ApiKeyDraftCard.tsx` | role-match |
| `…/webhooks/WebhookSecretOnce.tsx` (NEW) | component | render (secret once) | `settings/apiKeys/ApiKeySecretOnce.tsx` | exact |
| `…/webhooks/WebhookDeliveryLog.tsx` (NEW) | component | paged read + poll | `settings/apiKeys/ApiKeyActivity.tsx` | role-match |
| `…/webhooks/RollWebhookSecretSheet.tsx` (NEW) | component | confirm (calm) | `settings/apiKeys/RevokeApiKeySheet.tsx` (non-destructive variant) | role-match |
| `…/webhooks/DeleteWebhookSheet.tsx` (NEW) | component | destructive confirm | `settings/apiKeys/RevokeApiKeySheet.tsx` / `DisconnectAppSheet.tsx` (`admin` prop) | exact |
| `…/webhooks/webhookFacts.ts` (NEW) | utility | pure | `settings/apiKeys/apiKeyFacts.ts` | exact |
| `…/webhooks/webhookSnippets.ts` (NEW) | utility | pure | `settings/apiKeys/mcpSnippets.ts` (no secret in, T-293-21) | exact |
| `…/webhooks/webhookFocus.ts` (NEW) | utility | sessionStorage one-shot | `settings/apiKeys/apiKeyPrepick.ts` | exact |
| `…/webhooks/webhooksCopy.ts` (NEW) | config (copy leaf) | — | `settings/apiKeys/apiKeysCopy.ts` (import `fillCopy`) | exact |
| `frontend/src/components/org/OrgWebhooks.tsx` (NEW) | component | CRUD list (admin) | `components/org/OrgConnectedApps.tsx` (+ P-1) | exact |
| `frontend/src/lib/api/webhooks.ts` (NEW) | service (client) | request-response | `frontend/src/lib/api/apiKeys.ts:187-311` | exact |
| `frontend/src/pages/SettingsPage.tsx` (FIRES) | component | mount | itself, `:29` import, `:1017` trigger, `:1686-1688` content | exact |
| `frontend/src/components/settings/settingsTabs.ts` | config | registry | itself, `SETTINGS_TABS` `:45-56` | exact |
| `frontend/src/components/org/OrgApiKeysTab.tsx` (FIRES, P-9) | component | mount | itself, `:96` | exact |
| `frontend/src/components/layout/attentionConditions.ts` (FIRES ⛔) | hook | transform | itself, the notice→condition map `:328-345` | exact |
| `frontend/src/components/layout/ChatLayout.tsx` (FIRES ⛔) | component | callback | the `AppViewSwitch` "New API key…" hand-off (prepick + tab "7") | role-match |
| `frontend/src/components/layout/WaitingOnYouList.tsx` | component | render | itself, `:116` | exact |
| `frontend/src/components/layout/waitingVocabulary.ts` | config (word leaf) | pure | itself, `kindWords` / `countSentence` `:27-47` | exact |
| `frontend/src/lib/api/notifications.ts` | service (client) | type | itself, `WaitingNotice` `:24-35` | exact |
| `frontend/src/components/admin/AuditTab.tsx`, `org/OrgAuditTab.tsx` (FIRES) | component | data | `AuditTab.tsx:85-91`, `OrgAuditTab.tsx:55-61` label maps | exact |
| `frontend/src/landing/facts.ts` (FIRES) | config | data | itself, `SURFACE_TABS.settings` `:195` | exact |
| `scripts/vitest-count-gate.cjs` (FIRES) | config | — | its 307-05 first pins | exact |
| Frontend tests (`webhooks/__tests__/*`, `org/__tests__/OrgWebhooks.test.tsx`, `webhooksContract.test.ts`) | test | vitest | `org/__tests__/OrgConnectedApps.test.tsx`, `apiKeys/__tests__/apiKeysContract.test.ts`, `apiKeyPrepick.test.ts` | exact |

---

## Pattern Assignments

### `supabase/migrations/225_webhooks.sql` (migration, DDL + event-driven triggers)

**Analogs:** `218_run_waiting_notifications.sql` (triggers, outbox, grants), `224_mcp_oauth_grants.sql` (wrapper, header, deny-all), `217_org_item_move_audit.sql` (audit CHECK).

**Header contract.** Copy 224's numbered WHAT list and its apply block (`224:1-42`). Keep these sentences: "paste into the local Supabase SQL editor. NEVER `supabase db push` / `db reset`. Idempotent", the regenerate line, the `check-migration-225-live.py` line, and the production order line, which for 225 must read *220 → 221 → 222 → 223 → 224 → 225, each under per-action approval, BEFORE the 308 backend deploys* (the boot hazard, RESEARCH §Q10).

**Deny-all table block** (`218:140-148`, identical in `224:67-75`). Use it for each of `webhook_endpoints`, `webhook_events`, `webhook_deliveries` and `webhook_delivery_attempts`:
```sql
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.notification_deliveries FROM PUBLIC;
REVOKE ALL ON TABLE public.notification_deliveries FROM anon;
REVOKE ALL ON TABLE public.notification_deliveries FROM authenticated;
REVOKE ALL ON TABLE public.notification_deliveries FROM service_role;
GRANT ALL ON TABLE public.notification_deliveries TO service_role;

-- No policy at all on the outbox: deny-all to clients (D-19).
```

**`updated_at` trigger** (`218:136-138`):
```sql
DROP TRIGGER IF EXISTS notification_deliveries_set_updated_at ON public.notification_deliveries;
CREATE TRIGGER notification_deliveries_set_updated_at BEFORE UPDATE ON public.notification_deliveries
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

**Due-row partial index** (`218:133-134`). For deliveries, key it on `(status, next_attempt_at) WHERE status IN ('pending','retrying')`:
```sql
CREATE INDEX IF NOT EXISTS notification_deliveries_due_idx
    ON public.notification_deliveries (status, due_at) WHERE status IN ('pending', 'retry');
```

**Swallow-and-warn trigger function** (`218:288-327`). Copy the frame exactly and replace the body with RESEARCH §Q10's `webhook_emit_run_event` sketch:
```sql
CREATE OR REPLACE FUNCTION public.notify_on_run_status()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = ''
AS $fn$
DECLARE
    v_sid uuid;
BEGIN
    BEGIN
        ...
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'notify_on_run_status swallowed: %', SQLERRM;
    END;
    RETURN NULL;
END;
$fn$;
```

**Trigger + EXECUTE revoke** (`218:329-339`). The `workflow_runs` trigger is UPDATE-only, so it can keep `OLD` in its WHEN:
```sql
DROP TRIGGER IF EXISTS workflow_runs_notify_on_status ON public.workflow_runs;
CREATE TRIGGER workflow_runs_notify_on_status
    AFTER UPDATE OF status ON public.workflow_runs
    FOR EACH ROW
    WHEN (NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('completed', 'failed', 'cancelled'))
    EXECUTE FUNCTION public.notify_on_run_status();

REVOKE EXECUTE ON FUNCTION public.notify_on_run_status() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_on_run_status() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_on_run_status() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.notify_on_run_status() TO service_role;
```
⚠ D-47: `documents` needs **two** `CREATE TRIGGER`s on one function. The INSERT trigger's WHEN reads `NEW` only (`WHEN (NEW.status = 'completed')`). Postgres rejects `OLD` in the WHEN of any trigger that includes INSERT.

**Golden + owner guard** (`218:228-231`, the same predicate 225 needs):
```sql
IF FOUND
   AND r.user_id IS NOT NULL
   AND NOT coalesce(r.is_golden_run, false)
```

**`ON CONFLICT` against a partial unique index** (`218:240-242`):
```sql
ON CONFLICT (recipient_id, run_id) WHERE closed_at IS NULL
DO UPDATE SET tool_call_id = EXCLUDED.tool_call_id, kind = EXCLUDED.kind
```
225's event insert uses a bare `ON CONFLICT DO NOTHING` (RESEARCH §Q10). The `webhook_disabled` notice insert uses the partial-index form against `UNIQUE (endpoint_id) WHERE closed_at IS NULL AND kind = 'webhook_disabled'`.

**`notifications` changes (D-48).** These are ALTERs on the 218 table (`218:58-68`): drop NOT NULL on `run_id`, add `endpoint_id … REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE`, re-state the `kind` and `closed_reason` CHECKs with `DROP CONSTRAINT IF EXISTS` then `ADD CONSTRAINT`, and add the shape CHECK. 218 declared those CHECKs inline, so look up their real names with `pg_constraint` before writing the DROP. An inline CHECK gets an auto-generated name such as `notifications_kind_check`, and a DROP that misses it leaves both CHECKs in force.

**Audit CHECK** (`217:32-54`, the shape `test_298_migration_217_shape.py:91-96` asserts):
```sql
ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_action_type_check;
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_action_type_check CHECK (action_type = ANY (ARRAY[ ...all 40 from 217..., 'webhook.endpoint.created', ... ]));
```

**VERIFY** (`218:341-363`, executable). Extend it to all four tables and both functions:
```sql
          AND NOT has_function_privilege('public', 'public.notify_on_ask_row()', 'EXECUTE')
          AND NOT has_function_privilege('anon', 'public.notify_on_ask_row()', 'EXECUTE')
          AND NOT has_function_privilege('authenticated', 'public.notify_on_ask_row()', 'EXECUTE')
          ...
          AND NOT EXISTS (SELECT 1 FROM pg_policies p
                           WHERE p.schemaname = 'public' AND p.tablename = 'notification_deliveries')
```

---

### `scripts/check-migration-225-live.py` (script, read-only catalog)

**Analog:** `scripts/check-migration-224-live.py` (210 lines). Copy it whole and change the data.

- `TABLE_COLUMNS` dict + `CLIENT_ROLES` + `TABLE_PRIVS` (`:31-42`) → the four webhook tables.
- The per-table loop (`:58-93`): exists, columns, RLS on, **no policy**, no client privilege, service_role holds all four.
- Add a function loop: `has_function_privilege` false for `public`/`anon`/`authenticated` on each trigger function, and the `pg_trigger` names present (the `218:346-349` query).
- Add the `notifications` checks: `run_id` nullable, `endpoint_id` FK `ON DELETE CASCADE`, `webhook_disabled` in the kind CHECK.
- Keep `main()`'s exit contract (`:187-206`): `0` = "225 live", `1` = missing list, `2` = unreachable DB (`asyncpg.PostgresError` / `OSError`). Keep the "never switches role" note (`:17-18`, BUG-261031-01).

---

### `scripts/full-schema-supplement.sql` (FIRES ⛔, DDL mirror)

**Analog:** its own mig-224 block (`:929-942`). Append one `-- migration 225 —` block after it, with the comment shape copied:
```sql
-- migration 224 — oauth_clients and oauth_tokens: deny-all to every client role (RLS on, no
-- policy; D-33). Copied from the 222 mcp_usage lines above, not retyped. Only the backend's
-- service-role pool writes them. ...
REVOKE ALL ON TABLE public.oauth_clients FROM PUBLIC;
REVOKE ALL ON TABLE public.oauth_clients FROM anon;
REVOKE ALL ON TABLE public.oauth_clients FROM authenticated;
REVOKE ALL ON TABLE public.oauth_clients FROM service_role;
GRANT ALL ON TABLE public.oauth_clients TO service_role;
```
Plus the function lines in the `threads_origin_immutable` shape (`:925-927`): `REVOKE EXECUTE … FROM anon; … FROM authenticated; GRANT EXECUTE … TO service_role;`, preceded by `FROM PUBLIC`.

---

### `backend/app/db/webhooks.py` (db, CRUD + outbox claim/lease)

**Analogs:** `backend/app/db/notifications.py` (393 lines) for the outbox half; `backend/app/db/api_keys.py` (497 lines) for the CRUD half.

**Module docblock.** Copy `notifications.py:7-22` ("THE DUPLICATE-SENDING GUARANTEE LIVES HERE … four things") and restate it for webhooks: the in-transaction flip, `UNIQUE (endpoint_id, event_id)`, the stable `webhook-id`, and the lease renew. Also copy `api_keys.py:6-12` ("THE OWNER PREDICATE IS IN EVERY STATEMENT … service-role asyncpg pool, which is BYPASSRLS").

**Imports** (`notifications.py:34-44`):
```python
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Callable
from uuid import UUID

import asyncpg

logger = logging.getLogger(__name__)
```

**Claim** (`notifications.py:54-72` + `:245-297`). Select due rows `FOR UPDATE OF d SKIP LOCKED`, then flip them inside the same `con.transaction()`:
```python
    claimed: list[ClaimedDelivery] = []
    async with pool.acquire() as con:
        async with con.transaction():
            due = await con.fetch(CLAIM_SQL, limit, now, MAX_ATTEMPTS)
            for row in due:
                ...
                updated = await con.fetchrow(
                    CLAIM_UPDATE_SQL, row["id"], provider, subject, text, html_body, waited
                )
                claimed.append(ClaimedDelivery(...attempts=int(updated["attempts"]), ...))
    return claimed
```
with
```sql
 WHERE d.status IN ('pending', 'retry')
   AND d.attempts < $3
   AND d.due_at <= COALESCE($2::timestamptz, now())
 ORDER BY d.due_at
 LIMIT $1
 FOR UPDATE OF d SKIP LOCKED
```
The fan-out claim on `webhook_events WHERE fanned_out_at IS NULL` follows the same shape. The deliveries insert is `ON CONFLICT (endpoint_id, event_id) DO NOTHING`, and `fanned_out_at` is stamped in the same transaction.

**Stale reclaim** (`notifications.py:94-112`, the `WITH stale AS (… FOR UPDATE OF d SKIP LOCKED) UPDATE … FROM stale` CTE). Webhooks need no provider branch. A stale `'sending'` row goes back to `retrying` while attempts remain, and to `failed` otherwise. The webhook-id is stable, so a resend is safe, which is the Resend arm's reasoning.

**Lease renew + guarded record** (`notifications.py:167-186`):
```sql
UPDATE public.notification_deliveries
   SET claimed_at = now()
 WHERE id = $1
   AND status = 'sending'
   AND attempts = $2
RETURNING true
```
```sql
UPDATE public.notification_deliveries
   SET status = $2, ... due_at = COALESCE($6::timestamptz, due_at),
       sent_at = CASE WHEN $2 = 'sent' THEN now() ELSE sent_at END
 WHERE id = $1
   AND status = 'sending'
```
**Record swallows its own failure** (`notifications.py:342-349`):
```python
    try:
        await pool.execute(RECORD_SQL, delivery_id, status, reason, ...)
    except Exception:  # noqa: BLE001
        logger.exception("record_delivery_outcome failed for delivery %s", delivery_id)
```

**CRUD with an owner predicate in every statement** (`api_keys.py:179-223`, `revoke_key`). `owner_id=None` is the admin path. It returns `None` for a miss AND for out-of-scope, and uses two statements (UPDATE then read-back) with an "UPDATE 1" status tag to tell a first write from a repeat:
```python
    if owner_id is None:
        scope, args = "id = $1 AND org_id = $2", (key_id, org_id)
    else:
        scope, args = "id = $1 AND org_id = $2 AND user_id = $3", (key_id, org_id, owner_id)
    ...
    return {**dict(row), "revoked_now": str(status or "").strip() == "UPDATE 1"}
```
Use this for disable / enable / delete. The admin re-enable rule (D-30) becomes `WHERE … AND (disabled_reason IS DISTINCT FROM 'admin' OR $admin)`.

**Projection never carries the secret** (`api_keys.py:38-52`). `_KEY_COLUMNS` excludes `key_hash`, and only `_AUTH_COLUMNS` carries it. Mirror that: `_ENDPOINT_COLUMNS` never names `secret_ciphertext` / `previous_secret_ciphertext`, and a separate `_SIGNING_COLUMNS` is read only by the drainer.

**Unique-violation mapping by constraint name** (`api_keys.py:114-117`):
```python
    except asyncpg.UniqueViolationError as exc:
        if getattr(exc, "constraint_name", None) == _LABEL_INDEX:
            raise DuplicateKeyLabel(label) from exc
        raise
```

**Owner name join** (`api_keys.py:121-136`, `_named_columns` / `_NAME_JOINS`). The admin list uses `COALESCE(NULLIF(po.display_name, ''), uo.email) AS owner_name`.

**Every SQL string is a module-level `*_SQL` constant.** That is what makes the D-20 no-body scan possible (`test_300_notification_drainer.py:468`).

---

### `backend/app/services/webhook_drainer.py` (service, event-driven loop)

**Analog:** `backend/app/services/notification_drainer.py` (217 lines). Copy the class skeleton.

**Constructor with an injectable send and the 300 defaults** (`:59-82`):
```python
class NotificationDrainer:
    def __init__(
        self,
        pool,
        *,
        send: Callable[..., SendOutcome] = send_email,
        poll_interval_seconds: float = 20,
        max_claims_per_tick: int = 20,
        lease_seconds: int = 600,
    ) -> None:
        ...
        self._task: asyncio.Task | None = None
        self._stopping = asyncio.Event()
        self.ticks = 0
        self.sent = 0
        self.skipped = 0
        self.failed = 0
```
The `send=` seam is what the two-drainer live test injects (`test_300_drainer_once_live.py:189-191`). The webhook send seam is an async callable wrapping `egress.send_pinned_http`.

**Constants beside the drainer** (`:42-45`, the `RETRY_BACKOFF_SECONDS` precedent). They become `RETRY_SCHEDULE_SECONDS = (0, 30, 300, 1800, 7200, 28800)`, `MAX_ATTEMPTS = 6`, `AUTO_DISABLE_AFTER = 5`, `PURGE_EVERY_SECONDS = 3600` and `RETENTION_DAYS = 30` (D-17, D-18, D-44).

**`tick(now=)`: reclaim, then claim, then process each; one row never stops the batch** (`:84-110`):
```python
    async def tick(self, *, now: datetime | None = None) -> int:
        try:
            await db.reclaim_stale_sending(self._pool, lease_seconds=self._lease_seconds, provider=provider, now=now)
        except Exception:  # noqa: BLE001 — a failed reclaim never blocks new claims
            logger.exception("notification drainer: stale-claim recovery failed")
        claimed = await db.claim_due_deliveries(...)
        sent = 0
        for row in claimed:
            try:
                if await self._process(row, now=now):
                    sent += 1
            except Exception:  # noqa: BLE001
                logger.exception("notification delivery %s failed before sending", row.id)
                await self._record_unsent_error(row, now=now)
```
For webhooks, `tick` runs the fan-out pass, then the send pass, then the purge (gated by elapsed time) in that order.

**`_process`: re-checks in order, then renew, then send** (`:112-136`). The re-checks become: endpoint enabled, `principal_still_allowed(kind="webhook")` (D-25), then visibility through one acting connection per (owner, org) group (D-26):
```python
        if not await db.still_waiting(self._pool, row.notification_id):
            await db.record_delivery_outcome(self._pool, row.id, status="skipped_answered")
            self.skipped += 1
            return False
        ...
        if not await db.renew_delivery_lease(self._pool, row):
            logger.warning("notification delivery %s was reclaimed before sending; not sent", row.id)
            return False
```

**`_record`: outcome to status + backoff** (`:138-168`), and **unsent-error retry** (`:170-181`). Swap in RESEARCH's classification table (sent / retrying / failed / gone).

**Loop / start / stop** (`:183-213`). Copy verbatim. `asyncio.wait_for(self._stopping.wait(), timeout=…)` means shutdown never waits out a poll.

**Logs: ids and outcome words only** (`:25`). The 300 suite enforces it with `test_300_notification_drainer.py:494-501`. For webhooks the forbidden list adds `url`, `secret` and `body` (RESEARCH anti-pattern "Logging the URL").

**Liveness adapter.** Do not write a second predicate. Call `principal_liveness.py:56-86`:
```python
async def principal_still_allowed(pool: Any, *, key_row: Mapping[str, Any]) -> Refusal | None:
    if key_row.get("revoked_at") is not None: ...
    if not await api_keys_db.is_org_member(pool, org_id=key_row["org_id"], user_id=key_row["user_id"]):
        return Refusal("not_member")
    if await deps._is_banned(str(key_row["user_id"])):
        return Refusal("banned")
    if key_row.get("kind", "workflow") != "mcp":
        return None
```
Pass `key_row={"org_id": …, "user_id": …, "kind": "webhook"}`. The absent `revoked_at` / `expires_at` keys skip those checks, and `kind != "mcp"` returns before the switches are read.

**Visibility.** Use `acting_member.py:58-63`. It works with no request, because `get_user_pg_connection(None, …)` takes none:
```python
@asynccontextmanager
async def acting_member_connection(*, user_id: str, org_id: str) -> AsyncIterator[Any]:
    with acting_org_scope(org_id):
        async with get_user_pg_connection(None, {"id": user_id}) as conn:
            yield conn
```
⚠ `acting_member.py:21-24`: spawn no task inside the scope. Precedent call site: `api_keys.py:521-525` (`_visible_folder_ids`).

**Redaction (D-41).** Copy the call shape from `mcp/dispatch.py:144-150, 187-190`:
```python
            outcome = await outbound_guard.guard(
                outcome, org_id=principal.org_id, is_on=_pii_on, ...
            )
            if outcome is outbound_guard.WITHHELD:
                ...
async def _pii_on(org_id: str) -> bool | None:
    return await outbound_policy.pii_redaction_enabled(await get_pg_pool(), org_id)
```
Webhooks pass `textless_ok=True`. `WITHHELD` maps to delivery `failed` with reason `redaction_failed`.

**Links.** Import, never copy (`mcp/results.py:357-364`):
```python
def doc_link(document_id: str) -> str:
    return _config.primary_frontend_origin().rstrip("/") + "/app/library/" + str(document_id)

def run_link(run_id: str) -> str:
    return _config.primary_frontend_origin().rstrip("/") + "/app/runs/" + str(run_id)
```

**Secret decrypt.** Use `secret_cipher.py:78-108` (`get_cipher()` returns `None` when no key is configured, `decrypt_secret(value, cipher)` raises `InvalidToken`). A decrypt failure records `failed` and sends nothing.

---

### `backend/app/services/webhook_sender.py` (service, one outbound POST)

**Analog:** `backend/app/mcp/oauth_clients.py:384-427` (`fetch_cimd_document`): one call to `send_pinned_http` with a `_CALLER` capability, a host taken from the URL, the resolver/transport seams threaded through, and every failure classified:
```python
    host = (urlsplit(url).hostname or "").lower()
    try:
        response = await asyncio.wait_for(
            egress.send_pinned_http(
                "client_metadata",
                "GET",
                url,
                allowed_host=host,
                timeout=CIMD_FETCH_TIMEOUT,
                max_bytes=CIMD_MAX_BYTES,
                headers={"Accept": "application/json", "User-Agent": "Syrel-OAuth/1"},
                resolver=resolver,
                transport=transport,
            ),
            CIMD_FETCH_BOUND,
        )
    except asyncio.TimeoutError:
        logger.warning("cimd fetch refused: host=%s reason=timeout", host)
        return METADATA_UNREADABLE
    except Exception as exc:  # noqa: BLE001 — every failure is one refusal, never a traceback out
        logger.warning("cimd fetch refused: host=%s reason=%s", host, type(exc).__name__)
        return METADATA_UNREADABLE
```
Webhook differences: `"webhook"`, `"POST"`, `content=body` (never `json=`; `egress.py:764-769` refuses both at once), `timeout=10.0`, `max_bytes=65_536`, and `User-Agent: Syrel-Webhooks/1`. Also wrap the call in `asyncio.wait_for` with a slightly larger bound, because DNS is not bounded by the httpx timeout (`oauth_clients.py:20`). Measure latency with `time.monotonic()` around the call, since `PinnedResponse` carries no timing (`egress.py:626-637`). Classify by exception type rather than one reason: `EgressRefused` (`egress.py:176`, `reason_code == "redirected"` gives `redirect`) and `EgressResponseTooLarge` / `EgressResponseUndecodable` (`:609, :618`) are not retried. Log host + reason only, never the path or query. Re-assert D-46 (https, no userinfo, no fragment, ≤ 2048) before the call.

---

### `backend/app/services/webhook_signer.py` (utility, pure): NO ANALOG

Use RESEARCH §Code Examples "Signer" verbatim (about 20 lines of stdlib `base64` / `hashlib` / `hmac` / `secrets`). The module-shape precedent is `security/secret_cipher.py`: small pure functions, a module constant for the prefix (`_ENVELOPE_PREFIX = "enc:v1:"` at `:43` becomes `PREFIX = "whsec_"`), and no I/O. Sign at each attempt; only the body bytes are frozen (RESEARCH Pitfall 3).

---

### `backend/app/api/webhooks.py` (controller, CRUD member + admin)

**Analog:** `backend/app/api/api_keys.py` (883 lines).

**Imports and two routers** (`:45-115`):
```python
from __future__ import annotations

import logging
from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException, status
from starlette.concurrency import run_in_threadpool

from app.db import api_keys as api_keys_db
from app.dependencies import (
    get_active_org_id,
    get_current_user,
    get_pg_pool,
    get_service_role_supabase,
    require_org_manage,
)
from app.services.audit_service import write_audit_entry

router = APIRouter(prefix="/api-keys", tags=["api-keys"])
org_router = APIRouter(prefix="/org/api-keys", tags=["api-keys"])

_NOT_FOUND = "API key not found."
```
These become `router = APIRouter(prefix="/webhooks", tags=["webhooks"])` and `org_router = APIRouter(prefix="/org/webhooks", tags=["webhooks"])`. ⚠ That is two `include_router` lines in `main.py`, and `check-docs-coverage.cjs` derives a `router:` key per `include_router(x.router)` (RESEARCH §Q13). Put the admin routes on `org_router` in the same module so the coverage key stays `router:webhooks`. Confirm by running the gate.

**Helpers** (`:173-174, :341-342`):
```python
def _uuid(value) -> UUID:
    return value if isinstance(value, UUID) else UUID(str(value))

def _caller(current_user: dict) -> UUID:
    return _uuid(current_user["id"])
```

**Member route: 404 for a miss AND for someone else's row** (`:669-694`):
```python
@router.post("/{key_id}/revoke", response_model=ApiKeyRead)
async def revoke_my_key(
    key_id: UUID,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    active_org: str = Depends(get_active_org_id),
    pool: asyncpg.Pool = Depends(get_pg_pool),
) -> ApiKeyRead:
    caller, org = _caller(current_user), _uuid(active_org)
    row = await api_keys_db.revoke_key(pool, key_id=key_id, org_id=org, owner_id=caller, revoked_by=caller)
    if row is None:
        raise HTTPException(status_code=404, detail=_NOT_FOUND)
    if row.get("revoked_now"):  # a repeat revoke writes no second row
        ...audit...
```

**Admin route** (`:700-717`, `:759-788`): `current_user: dict = Depends(require_org_manage)`, the same db call with `owner_id=None`, and the audit names the owner.

**Create returns the secret once** (`:498-518`, `ApiKeyCreated(key=…, secret=…)` at `:263-265` and `:666`). The docstring says "The response is the ONLY place the secret ever appears." Before minting: probe `get_cipher()`, and when it returns `None` refuse with the D-12 sentence (D-53); then `await run_in_threadpool(egress.validate_destination, "webhook", url, None, allowed_host=host)` (P-5) and map `EgressRefused` to the one D-24 sentence (422).

**Audit after a confirmed write, explicit org** (`:824-838`):
```python
    audit_supabase = await run_in_threadpool(get_service_role_supabase, str(org))
    await write_audit_entry(
        user_id=str(current_user["id"]),
        action_type=_MCP_ACCESS_AUDIT_ACTION,
        metadata={"event": "mcp_access", "enabled": bool(stored)},
        supabase=audit_supabase,
        org_id=str(org),
    )
```

**Rate limit** before Test and Resend (P-6). See `rate_limit.py` below.

---

### `backend/app/models/webhook.py` (model, DTO + typed payloads)

**Analogs:** `backend/app/models/api_key.py` (validators, `Literal`, `Field(default_factory=…)`); `backend/app/api/notifications.py:60-77` (flat response models).

- Request validators follow the `field_validator(...) @classmethod` shape (`api_key.py:192-200, 223-243`). URL rules (D-27/D-46) and `event_types` (≥ 1, unique, in the three-value enum) go there.
- `Literal[...]` enums, e.g. `api_key.py:190` `expires_in_days: Literal[30, 90, 365] | None = 90`.
- The created response is a secret-once wrapper (`api_key.py:263-265`):
```python
class ApiKeyCreated(BaseModel):
    key: ApiKeyRead
    secret: str
```
- **Payload models (D-41):** nested `BaseModel`s with typed non-text fields only (`UUID`, `Literal`, `datetime`, a `str` link), with no `RedactableText` and no `dict` anywhere in the tree. `outbound_guard._walk` raises on a dict (`outbound_guard.py:181-184`) and `guard()` withholds a text-free model (`:134-137`). A type-fence test asserts `outbound_guard.redactable_fields(M) == set()` for each model (`:103-110`).

---

### `backend/app/security/egress.py` (FIRES, three dict entries)

**Analog:** itself, the `client_metadata` lines with their comment:
```python
    # ⚠ A NEW KEY, ADDED DELIBERATELY (307, D-06): the caller passes the client_id URL's host as
    # allowed_host; public addresses only, pinned, no redirects, size-capped. ...
    "client_metadata": (),                                    # :335 ALLOWED_HOST_SUFFIXES
    "client_metadata": _CALLER,  # 307 D-06: the CIMD URL's own host, per call   # :356 _HOST_MATCH
    "client_metadata": frozenset({"https"}),                  # :379 _TLS_SCHEMES
```
Add `"webhook"` directly after each one, with a `308 D-23` comment. Nothing else in the file changes (D-37). `test_190` is not amended (D-45).

---

### `backend/app/main.py` (FIRES, four hunks per D-50)

**Start block** (`:536-552`). Copy it, renaming the drainer and the `app.state` attribute:
```python
    _drainer = None
    if not _setup_mode and RUN_BOOT_SWEEPS:  # Phase 158 (D-03); SEED-363 (296); 300 (D-20)
        try:
            from app.services.notification_drainer import NotificationDrainer

            _drainer = NotificationDrainer(await get_pg_pool())
            _drainer.start()
            logger.info("Run-waiting email drainer started")
        except Exception:
            logger.exception("Run-waiting email drainer failed to start (app continues)")
            _drainer = None
    app_instance.state.notification_drainer = _drainer
```
**Stop block** (`:677-684`):
```python
    try:
        _nd = getattr(app_instance.state, "notification_drainer", None)
        if _nd is not None:
            await _nd.stop()
    except Exception:  # noqa: BLE001
        logger.exception("Run-waiting email drainer stop failed at lifespan shutdown")
```
**Router import** is the long `from app.api import …` list at `:915`; append `webhooks`. **Include lines** follow `:965-966` (`app.include_router(api_keys.router)` / `api_keys.org_router`), each with a trailing `# Phase 308 …` comment. ⚠ `:391-392` `assert_action_types_synced` hard-fails at boot, so 225 must be applied locally before the backend restarts on the new literals (RESEARCH Pitfall 5).

---

### `backend/app/services/audit_service.py` (FIRES, literals)

**Analog:** itself (`:35-38`). Add one commented group:
```python
    # Phase 293 (D-16 / lockstep with migration 215 CHECK) — API keys:
    "api_key.create", "api_key.revoke", "api_key.start", "api_key.read", "api_key.refused",
    # Phase 298 (D-20 / lockstep with migration 217 CHECK) — the per-item org move:
    "org.item.move",
```
That becomes `# Phase 308 (D-31 / lockstep with migration 225 CHECK) — webhooks:` followed by the nine `webhook.endpoint.*` literals. Ship it in the same commit as 225.

---

### `backend/app/services/rate_limit.py` (FIRES ⛔, two Kinds + one function + constants)

**Analog:** `enforce_user_citation_limit` (`:115-141`). Add to the `Kind` literal (`:29-32`), then:
```python
CITATION_CHECKS_PER_MINUTE = 10


async def enforce_user_citation_limit(redis, *, user_id: str) -> None:
    limit = int(CITATION_CHECKS_PER_MINUTE)
    try:
        retry = await hit(redis, key_id=user_id, kind="citation", limit=limit)
    except Exception:  # noqa: BLE001 — any Redis failure refuses; see the module docblock
        logger.warning("citation-check rate limiter unavailable; refusing the call", exc_info=True)
        raise HTTPException(status_code=503, detail={"reason": "unavailable"})
    if retry is not None:
        raise HTTPException(status_code=429, detail={"reason": "rate_limited"}, headers={"Retry-After": str(retry)})
```
The new function is `enforce_user_webhook_limit(redis, *, user_id, kind)` with `WEBHOOK_TESTS_PER_MINUTE` and `WEBHOOK_RESENDS_PER_MINUTE` constants and no env var. ⚠ The detail shape is decided in P-6.

---

### `backend/app/services/outbound_guard.py` (young, one kwarg, D-41)

**Analog:** itself, `guard()` signature and gate (`:113-137`):
```python
async def guard(
    model: Any,
    *,
    org_id: str,
    is_on: Callable[[str], Awaitable[Any]],
    redactor: Redactor | None = None,
    deadline_s: float = 2.0,
    window: dict[str, tuple[str, str]] | None = None,
    clock: Callable[[], float] = time.monotonic,
) -> BaseModel | _Withheld:
    ...
    if not isinstance(model, BaseModel) or not _declares_redactable(type(model)):
        return WITHHELD
```
Add `textless_ok: bool = False` last in the keyword list. The gate becomes: when `textless_ok` is set and `model` is a `BaseModel` whose tree declares nothing redactable, return `model` unchanged. Only that branch changes; the default path stays byte-identical for MCP. Pin the default with a 305 test.

---

### `backend/app/db/notifications.py` + `backend/app/api/notifications.py` (young, D-48)

**Analog:** themselves. `LIST_OPEN_SQL` at `db/notifications.py:214-227` (rewrite per P-8 and RESEARCH §Q3). `WaitingNotice` at `api/notifications.py:60-70`:
```python
class WaitingNotice(BaseModel):
    id: UUID
    run_id: UUID
    org_id: UUID
    org_name: str
    workflow_name: str
    kind: Literal["question", "approval"]
    origin: Literal["app", "schedule", "key", "mcp"] | None  # 306-04 (D-31): + mcp
    created_at: datetime
```
`run_id` becomes `UUID | None`, `kind` adds `"webhook_disabled"`, and the model adds `endpoint_id: UUID | None` and `reason`. `workflow_name` becomes optional. The constructor at `:93-104` passes the new keys explicitly, because `response_model` drops undeclared keys silently (the `db/api_keys.py:23-25` three-place lockstep warning).

---

### `.github/workflows/backend-tests.yml` + `backend/requirements-dev.txt` (D-54)

**Analog:** `backend-tests.yml:49-54`:
```yaml
          pip install -r requirements.txt
          # R2-CR-02 (253): psycopg2 is imported by tests/integration and by two
          # tests/fixtures modules, but is NOT in requirements.txt — ...
          # Test-only dep, so it is installed here rather than added to the app's requirements.
          pip install psycopg2-binary
```
Add `pip install -r requirements-dev.txt` with a 308 comment. `requirements-dev.txt` is new (no analog) and holds one pinned line, `standardwebhooks==1.1.0`.

---

### `scripts/build-public-openapi.cjs` (FIRES, D-52)

**Analog:** itself. Add the FLAGGED entry in the `:87` style, `"/notifications", // 301-01: the UI's waiting-on-you list (D-32), UI-internal like /links/`, giving `"/webhooks"` and `"/org/webhooks"` with a `308 D-52` comment. Add `"webhooks"` to the `tags` array of the group at `:132` (the "Account & org" group, which holds `notifications` and `api-keys`).

---

### `docs/public/administer/settings/webhooks.md` (NEW stub, D-49) + `docs/public/sections.json`

**Analog frontmatter:** `administer/control-room/audit.md` (stub) and `administer/settings/api-keys.md` (slug/covers form):
```yaml
---
title: Platform audit
slug: administer/control-room/audit
section: administer
audience: operator
status: stub
release: shipped
covers: [A51]
summary: >-
  ...Until the full guide is written, start with What Syrel is.
nearest: get-started/overview
---
```
These become `slug: administer/settings/webhooks`, `audience: user`, `status: stub` and `covers: [settings-tab:webhooks, router:webhooks]`. In `sections.json`, add `"administer/settings/webhooks"` after `"administer/settings/api-keys"` in both lists (`:179`, `:210`).

---

### Backend tests

**`test_308_drainer_once_live.py`.** Copy `test_300_drainer_once_live.py`:
- the year-2000 pin (`:13-16, :37-38`: `T0 = datetime(2000, 1, 1, …)`; `NOW = T0 + timedelta(minutes=1)`) so a pinned tick never claims a dev row;
- the counting fake send with a lock (`:41-50`, `CountingSend`);
- a committed `_world()` with known ids, deleted in `finally`, plus a leftover-count assert (`:89-169`). Its non-vacuity asserts (`:136, :145`) become "the trigger wrote one event" and "fan-out wrote one delivery";
- the race (`:185-197`): `await asyncio.gather(a.tick(now=NOW), b.tick(now=NOW))` then `assert len(send.calls) == 1`;
- WR-03 cases (`:327-410`) and the ex-member case (`:242-252`);
- skip guards `pytestmark = [requires_pg, requires_225]`. Run with `-rs`.

**`test_308_emission_matrix_live.py`.** Copy `test_300_notice_triggers_live.py`'s rolled-back `_world()` (`:200-208`: one connection, `tx.start()`, always rolled back) and its `requires_218`-style probe (`:34-68`, `to_regclass` + `to_regprocedure`). Trigger-written events are visible inside the same transaction, so no commit is needed.

**`test_308_rls_anon_live.py`.** Copy `test_307_schema_privileges_live.py`:
- parametrised table × role × privilege (`:62-89`);
- the one role switch, `SET LOCAL ROLE anon` in a rolled-back transaction, expecting `asyncpg.InsufficientPrivilegeError` (`:105-125`);
- function checks from `test_300_rls_anon_live.py:214-232`: `has_function_privilege($1, $2::regprocedure, 'EXECUTE')` false for `public`, `anon` and `authenticated`, plus `prosecdef is True` with an empty `search_path` in `proconfig`.

**`test_308_migration_225_static.py`.** Copy `test_298_migration_217_shape.py`: `_strip_comments`, `_check_literals`, and `_previous_check_literals()`, which scans for the last earlier migration that re-stated the CHECK (`:40-83`). Assert `previous - now == set()` and `now - previous == {nine literals}`, and `VALID_ACTION_TYPES <= now` (`:122-127`). Add `test_transaction_wrapped` and a deny-all-per-table case from `test_307_migration_224_static.py:51, :108`.

**`test_308_no_body_scan.py`.** Copy `test_300_notification_drainer.py:468-483` (collect every `*_SQL` constant in the module, parametrise, regex-forbid). Forbidden words become `body`, `response`, `headers` and `request_body`. Also scan the 225 DDL with comments stripped (the `_strip_comments` helper above). Add the logger scan from `:494-501` with `url`, `secret` and `body` forbidden.

**`test_308_egress_capability.py` / `test_308_ssrf_corpus.py`.** Copy `test_307_cimd_fetch.py`: the `_resolver(*addresses)` seam (`:40-48`), the `_transport(...)` `httpx.MockTransport` seam with a raw `ByteStream` (`:51-59`), the private-address parametrise (`:94-99`), the 302 case (`:103`), the `send_pinned_http` spy (`:137-153`), and the three-table pin (`:159-162`):
```python
def test_client_metadata_is_wired_in_all_three_tables():
    assert egress.ALLOWED_HOST_SUFFIXES["client_metadata"] == ()
    assert egress._HOST_MATCH["client_metadata"] == egress._CALLER
    assert egress._TLS_SCHEMES["client_metadata"] == frozenset({"https"})
```

**`test_308_routes.py` / `test_308_admin_routes.py`.** Copy `test_307_connected_apps_routes.py`: fixed UUID constants (`:29-34`), an in-memory `_Store` that replaces the db module (`:56-68`), a fresh `FastAPI()` with dependency overrides (docblock `:12-14`), and static SQL cases at the bottom.

**`test_308_check_script.py`.** Copy `test_307_migration_224_check_script.py` (load the script with `importlib.util.spec_from_file_location` at `:24-30`; a fake catalog per case; exit 2 for an unreachable DB at `:110`).

---

### Frontend: `components/settings/webhooks/*`

**`WebhooksTab.tsx`.** Analog `ApiKeysTab.tsx:67-152`, the alive-ref read that keeps the last-known list:
```tsx
  const alive = useRef(true)
  const org = useOrgOptional()

  const load = useCallback(async () => {
    try {
      const res = await listApiKeys()
      if (!alive.current) return
      setList(res)
      setLoadError(null)
    } catch (err) {
      if (alive.current) setLoadError(messageOf(err)) // keep the last-known list
    }
  }, [])

  useEffect(() => {
    alive.current = true
    void load()
    const pick = readApiKeyPrepickOnce()
    if (pick) openDraft(pick)
    return () => { alive.current = false }
  }, [load, openDraft])
```
Add `org?.activeOrgId` to the deps (P-2). Read `readWebhookFocusOnce()` where `readApiKeyPrepickOnce()` is read.

**`WebhookSecretOnce.tsx`.** Analog `ApiKeySecretOnce.tsx` (whole file). Keep the docblock rule from `:4-7` ("RECEIVES THE SECRET AS A PROP AND KEEPS IT NOWHERE ELSE"), the copy timers (`:56-83`), the warning-bordered card (`:89`), the secret box + `CopyButton` (`:117-123`), the `<details>` disclosure (`:165-170`) for the snippets, the single `gradient-primary` done button (`:174-177`) and the polite live region (`:184-186`). `CopyButton` is imported from `settings/apiKeys/McpConnectSnippets.tsx` (`:28`), not re-written.

**`DeleteWebhookSheet.tsx` / `RollWebhookSecretSheet.tsx`.** Analog `RevokeApiKeySheet.tsx` (whole file). Keep the never-optimistic handler (`:84-98`):
```tsx
  async function handleRevoke() {
    if (!target || busy) return
    setBusy(true)
    setFailure(null)
    try {
      await revoke(target.id)
      onDone()
      onClose()
    } catch (err) {
      const detail = err instanceof Error && err.message ? err.message : ""
      setFailure(fillCopy(C.sheet.failed, { label: target.label, detail }).replace(/\s{2,}/g, " "))
    } finally {
      setBusy(false)
    }
  }
```
The destructive dialog frame is `AlertDialogContent className="max-w-[480px] border-destructive/45 border-t-[3px] border-t-destructive"` (`:115`). The owner-vs-admin sub line is at `:122-131`, the facts `<ul>` at `:135-177`, the kept box at `:179-181`, and `AlertDialogCancel` (focus default) + destructive confirm at `:194-199`. The admin variant is a prop, as in `DisconnectAppSheet` (`OrgConnectedApps.tsx:182-193`, `admin` + `disconnect={…}`). The roll sheet drops the destructive border and keeps the same handler.

**`webhooksCopy.ts`.** Analog `apiKeysCopy.ts:1-30`: a true leaf with no imports. Do not re-declare `fillCopy`; components import it from `@/components/settings/apiKeys/apiKeysCopy` (UI-SPEC §New leaf files). Signature:
```ts
export function fillCopy(template: string, vars: CopyVars = {}, count?: number): string
```

**`webhookFocus.ts`.** Analog `apiKeyPrepick.ts` (whole file, 45 lines). A key constant, a writer that copies exactly the known fields, and a read-once that removes the key in the same read:
```ts
export function readApiKeyPrepickOnce(): ApiKeyPrepick | null {
  let raw: string | null = null
  try {
    raw = sessionStorage.getItem(API_KEYS_PREPICK_KEY)
    sessionStorage.removeItem(API_KEYS_PREPICK_KEY)
  } catch {
    return null
  }
  ...
```
The fields become `{ endpointId, orgId }`.

**`webhookFacts.ts` / `webhookSnippets.ts`.** Analogs `apiKeyFacts.ts` and `mcpSnippets.ts`: pure, no React, unit-tested. The snippets take no secret (they read `SYREL_WEBHOOK_SECRET`, T-293-21).

---

### `frontend/src/components/org/OrgWebhooks.tsx` (component, admin CRUD list)

**Analog:** `OrgConnectedApps.tsx` (whole file), minus the `oauthAvailable` gate (P-1).
- Docblock shape `:1-14`: mounted once, self-contained, never optimistic, `onRecorded()` pulses after each server-confirmed write, no toast.
- Read + alive (`:78-95`).
- Header row with a count (`:124-143`), the receipt `role="status"` (`:145-149`), loading / failed-with-Retry / empty (`:151-170`).
- Per-row action → sheet → `onDone` does `onRecorded?.()`, sets the receipt and runs `void load()` (`:182-193`).

**Mount** (`OrgApiKeysTab.tsx:96`). Put one line directly after it:
```tsx
      <OrgConnectedApps orgName={orgName} mcpTools={mcpTools} oauthAvailable={list?.mcp?.oauth ?? false} onRecorded={onRecorded} />
```
The new line is `<OrgWebhooks orgName={orgName} onRecorded={onRecorded} />`.

---

### `frontend/src/lib/api/webhooks.ts` (client)

**Analog:** `lib/api/apiKeys.ts`. Header rules `:1-15`: not re-exported from the `lib/api.ts` barrel, wire types live here and are pinned by a contract test, and the secret is returned and kept nowhere. Per-call shape `:187-245`:
```ts
export async function createApiKey(body: ApiKeyCreateBody): Promise<ApiKeyCreated> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/api-keys`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new ApiError(await readApiKeyFailure(res), res.status)
  return (await res.json()) as ApiKeyCreated
}
```
Copy the failure reader at `:297-311` locally, extended for P-6. Import from `./_core` (`API_BASE`, `ApiError`, `getAuthHeaders`).

---

### `frontend/src/pages/SettingsPage.tsx` (FIRES, one mount) + `settingsTabs.ts`

**Analog lines:** the import at `:29`, the trigger at `:1017`, the content at `:1686-1688`:
```tsx
{isSettingsTabVisible("7", canManageModels) && <TabsTrigger className={SETTINGS_TAB_CLASS} value="7">API keys</TabsTrigger>}
...
          <TabsContent value="7">
            <ApiKeysTab onOpenRun={onOpenRun} onOpenAudit={() => handleTabChange("4")} />
```
In `settingsTabs.ts`, after the `"7"` row (`:53-55`), add `{ id: "8", audience: "everyone", name: "Webhooks" }` with a `308` comment. The label stays literal JSX (header `:16-22`), because the docs-coverage and landing-drift gates scrape it.

---

### Waiting-on-you arms (`attentionConditions.ts` FIRES ⛔, `ChatLayout.tsx` FIRES ⛔, `WaitingOnYouList.tsx`, `waitingVocabulary.ts`, `lib/api/notifications.ts`)

- **Type:** `lib/api/notifications.ts:24-35` `WaitingNotice`. Widen it to match the backend model (`run_id: string | null`, kind `"webhook_disabled"`, `endpoint_id`, `reason`).
- **Map:** `attentionConditions.ts:328-345` currently assumes a run (`onOpen: () => openRun(notice.run_id)`, `runId: notice.run_id`, `title: notice.workflow_name`). Add one `notice.kind === "webhook_disabled"` arm that calls the optional `openWebhooks(endpointId, orgId)` door. Read this file's `docs/HOT-FILE-LEDGER.md` section first (⛔).
- **Words:** `waitingVocabulary.ts:39-44` `kindWords` gets one arm. `countSentence` (`:27-31`) says "workflow runs", so the neutral arm UI-SPEC names goes here. The file stays zero-import (`:6-7`).
- **Glyph/words:** `WaitingOnYouList.tsx:116` (`kindWords(condition.kind)`), plus one glyph arm.
- **Door:** `ChatLayout.tsx` gets one memoised callback (UI-SPEC row): it writes the focus hint (`webhookFocus.ts`), sets `SETTINGS_TAB_STORAGE_KEY` (`settingsTabs.ts:72`) to `"8"`, and navigates to Settings. This is the `apiKeyPrepick` hand-off pattern (`apiKeyPrepick.ts:4-6`).

---

### Audit labels + landing facts (FIRES, data only)

`OrgAuditTab.tsx:55-61` / `AuditTab.tsx:85-91`:
```tsx
  "api_key.create": { label: "Made an API key", group: "API keys" },
  "api_key.revoke": { label: "Revoked an API key", group: "API keys" },
```
Add nine `webhook.endpoint.*` entries to each, with `group: "Webhooks"`. In `landing/facts.ts:195`, append `"Webhooks"` to `SURFACE_TABS.settings` after `"API keys"`. `orgAdmin` (`:197`) is unchanged.

---

### Frontend tests

`org/__tests__/OrgConnectedApps.test.tsx` (lines 1-60 read) is the template: a `vi.hoisted` mock bag, a `vi.mock("@/lib/api/oauth", …)` that spreads `importOriginal`, a `?raw` import of the component for the stray-literal sweep, a row factory with `Partial<>` overrides, and assertions that read **rendered words**. The prop-default contract test follows `apiKeys/__tests__/apiKeysContract.test.ts`, and the focus leaf test follows `apiKeyPrepick.test.ts`. Each new suite gets a first pin in `scripts/vitest-count-gate.cjs` (the 307-05 precedent).

---

## Shared Patterns

### Deny-all outbox grants (PUBLIC first)
**Source:** `218_run_waiting_notifications.sql:140-148`, `224_mcp_oauth_grants.sql:67-75`
**Apply to:** all four 225 tables, `full-schema-supplement.sql`, the live privilege test.
`ENABLE ROW LEVEL SECURITY` → `REVOKE ALL … FROM PUBLIC / anon / authenticated / service_role` → `GRANT ALL … TO service_role` → no policy.

### Definer-rights trigger functions
**Source:** `218:200-213, 268-273, 282-285`
**Apply to:** `webhook_emit_run_event`, the document emit function.
`SECURITY DEFINER`, `SET search_path = ''`, fully qualified names, the body in `BEGIN … EXCEPTION WHEN OTHERS THEN RAISE WARNING '<fn> swallowed: %', SQLERRM; END; RETURN NULL;`, and EXECUTE revoked from PUBLIC, anon and authenticated.

### Exactly-once claim
**Source:** `backend/app/db/notifications.py:54-186` (claim, flip, reclaim, renew, guarded record)
**Apply to:** the fan-out and send claims in `db/webhooks.py`; the drainer never holds a row lock across HTTP.

### Owner predicate in every statement
**Source:** `backend/app/db/api_keys.py:6-12, 179-223`
**Apply to:** every `db/webhooks.py` function a route calls. `owner_id=None` only behind `require_org_manage`.

### Auth on routes
**Source:** `backend/app/api/api_keys.py:58-64, 669-676, 700-705`
**Apply to:** `api/webhooks.py`. Members use `Depends(get_current_user)` + `Depends(get_active_org_id)`; admins use `Depends(require_org_manage)` + `Depends(get_active_org_id)`; a miss and someone else's row both answer 404.

### Audit
**Source:** `backend/app/api/api_keys.py:824-838`; `backend/app/services/audit_service.py:70-100`
**Apply to:** every route write and the drainer's `auto_disabled`. Explicit `org_id`; metadata limited to actor, endpoint id and host.

### Off-loop blocking calls
**Source:** `backend/app/security/egress.py:770-773` (validation already off-loop inside `send_pinned_http`); `api_keys.py:830` (`run_in_threadpool(get_service_role_supabase, …)`)
**Apply to:** save-time `validate_destination`, supabase client construction.

### Fail-closed limiter
**Source:** `backend/app/services/rate_limit.py:39-50, 125-141`
**Apply to:** Test and Resend. A Redis failure answers 503 and never admits uncounted.

### Self-contained, never-optimistic UI section
**Source:** `frontend/src/components/org/OrgConnectedApps.tsx`; `settings/apiKeys/RevokeApiKeySheet.tsx:10-13, 84-98`
**Apply to:** `WebhooksTab`, `WebhookEndpointCard`, `OrgWebhooks`, both sheets. A server answer comes before any state flip, then `onRecorded()` and a re-read. No toast, and the last-known list is kept on a failed re-read.

### One word home per surface
**Source:** `frontend/src/components/settings/apiKeys/apiKeysCopy.ts:1-30`; `layout/waitingVocabulary.ts:1-11`
**Apply to:** `webhooksCopy.ts` (all tab/admin words) and the waiting arms. The `?raw` stray-literal sweep extends to the new folder and `OrgWebhooks.tsx`.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `backend/app/services/webhook_signer.py` | utility | transform | No HMAC signer exists in the app. Use RESEARCH §Code Examples (stdlib, about 20 lines); module style follows `secret_cipher.py`. |
| `backend/tests/unit/test_308_signer.py` (interop half) | test | unit | No test in the suite imports a third-party verifier. It is a hard `from standardwebhooks import Webhook` (never `importorskip`), installed in the same task (D-54, RESEARCH Pitfall 8). |
| `backend/requirements-dev.txt` | config | — | No dev-requirements file exists (`backend/Dockerfile:32-34` installs `requirements.txt` only). One pinned line; the CI precedent is the psycopg2 install. |

## Hot-file ledger reminder (from RESEARCH §Q12, not re-derived)

Every NEW non-test source file above (`db/webhooks.py`, `services/webhook_drainer.py`, `services/webhook_signer.py`, `services/webhook_sender.py`, `api/webhooks.py`, `models/webhook.py`, every `components/settings/webhooks/*`, `org/OrgWebhooks.tsx`, `lib/api/webhooks.ts`) needs a "young (created 308-0N)" row in `docs/HOT-FILE-LEDGER.md`'s scan list plus its section, **in the commit that creates it**. `check-hot-file-ledger.cjs` fails on new files. `ingestion_queue_service.py` stays untouched (D-37).

## Metadata

**Analog search scope:** `supabase/migrations/` (217, 218, 224), `scripts/` (check-migration-224-live.py, full-schema-supplement.sql, build-public-openapi.cjs), `backend/app/{db,services,security,api,models,mcp}/`, `backend/app/main.py`, `backend/tests/{unit,integration}/test_{298,300,305,307}_*`, `frontend/src/components/{settings/apiKeys,org,layout}/`, `frontend/src/lib/api/`, `frontend/src/pages/SettingsPage.tsx`, `frontend/src/landing/facts.ts`, `docs/public/`, `.github/workflows/backend-tests.yml`
**Files read:** 41 analogs (full or at the cited ranges)
**Pattern extraction date:** 2026-11-04

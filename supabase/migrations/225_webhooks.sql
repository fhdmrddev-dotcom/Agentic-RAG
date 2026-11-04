-- 225 — Phase 308 (HOOK-01, HOOK-02, HOOK-03, HOOK-04, HOOK-06; D-05, D-06, D-07, D-12, D-20, D-27,
-- D-31, D-32, D-42, D-43, D-46, D-47, D-48, D-58)
-- Told by webhook: the schema outbound webhooks stand on.
--
-- WHAT. Nine things, in this order:
--   1. public.webhook_endpoints — one row per endpoint a member registered in one org: an https URL
--      (no userinfo, no fragment, <= 2048 chars; D-27 / D-46), an optional description (<= 100), the
--      subscribed event types (non-empty, within the three subscribable ones), the on/off state with
--      its reason (NULL = the owner turned it off; D-58), and the signing secret ENCRYPTED ONLY
--      (CHECK LIKE 'enc:v1:%'; D-12) with a 24 h previous-secret overlap slot (D-13).
--   2. public.webhook_events — one row per thing that happened (run.finished / run.waiting /
--      document.ingested, plus webhook.test which names its endpoint). The frozen thin payload is set
--      once at fan-out and is the ONLY payload column in the schema (D-58). A partial UNIQUE (item_id)
--      WHERE type = 'run.finished' makes a second terminal event impossible (D-07).
--   3. public.webhook_deliveries — one row per (endpoint, event), UNIQUE (D-07). Status, attempt
--      bookkeeping and words-only outcome columns. NO body, response or headers column (D-20).
--   4. public.webhook_delivery_attempts — one row per HTTP attempt: number, status code, latency, an
--      error WORD. NO body, response or headers column (D-20).
--   5. webhook_emit_run_event() + trigger workflow_runs_webhook_emit — AFTER UPDATE OF status only
--      (runs are always inserted 'active'; D-47). run.finished on entering completed / failed /
--      cancelled from a non-terminal status; run.waiting on entering paused or cap_paused (D-43). A
--      golden run or a run without an owner emits nothing (D-42). Endpoints checked are the run
--      owner's, in the run's org (D-03).
--   6. webhook_emit_document_event() + TWO triggers (D-47): AFTER INSERT WHEN completed (a defence;
--      no writer inserts completed today) and AFTER UPDATE OF status on entering completed.
--   Both emit functions: definer rights, SET search_path = '', body inside BEGIN … EXCEPTION WHEN
--   OTHERS THEN RAISE WARNING … END so an error NEVER fails the writer's transaction (D-06). Each
--   writes at most ONE webhook_events row and nothing else, and only when an enabled endpoint in that
--   org subscribes to that type (one EXISTS; D-05 / T-308-19).
--   7. EXECUTE on both functions revoked from PUBLIC FIRST, then anon and authenticated, granted to
--      service_role (the CLAUDE.md PUBLIC-grant trap).
--   8. public.notifications widened for the webhook_disabled notice (D-48 / D-56): run_id nullable,
--      endpoint_id (ON DELETE CASCADE), kind + closed_reason CHECKs restated (real names read from
--      pg_constraint on the local DB 2026-11-04: notifications_kind_check,
--      notifications_closed_reason_check), a named shape CHECK, one open notice per endpoint.
--   9. audit_log_action_type_check restated (D-31): 217's 40 literals plus the nine
--      webhook.endpoint.* literals. backend/app/services/audit_service.py VALID_ACTION_TYPES gains
--      the same nine in the same commit.
--
-- VISIBILITY. The four webhook tables: nobody but the backend (service-role pool). RLS on, NO policy,
-- REVOKE ALL from PUBLIC / anon / authenticated / service_role, then GRANT ALL to service_role (D-32).
-- Members read their endpoints and delivery logs only through the backend, which checks owner / admin
-- explicitly in every statement (app/db/webhooks.py).
--
-- NOT A SEED — no INSERT, no app_settings column, no env var (D-34). Deploy-artifact parity is
-- unaffected.
--
-- Apply discipline (CLAUDE.md): paste into the local Supabase SQL editor.
-- NEVER `supabase db push` / `db reset`. Idempotent: safe to paste twice.
-- Then: bash scripts/regenerate-full-schema.sh (no --reset), and
--       backend/venv/Scripts/python scripts/check-migration-225-live.py.
-- ⚠ DEPLOY ORDER (D-31 / D-33): main.py's lifespan runs assert_action_types_synced, which HARD-FAILS
--   boot when VALID_ACTION_TYPES names a type the live CHECK lacks — the 308 backend will not start
--   against a database without 225.
-- ⚠ PRODUCTION (D-33): paste 220 -> 221 -> 222 -> 223 -> 224 -> 225, IN THAT ORDER, each under its own
--   per-action operator approval, BEFORE the 308 backend deploys; then run get_advisors(security).
--   Phase 308 does not deploy itself.
-- ============================================================================

BEGIN;

-- ── 1. public.webhook_endpoints — deny-all to every client role ─────────────
CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
    id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id                      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    url                         text NOT NULL CONSTRAINT webhook_endpoints_url_check CHECK (char_length(url) <= 2048 AND url LIKE 'https://%' AND position('#' in url) = 0 AND url !~ '^https://[^/?#]*@'),
    description                 text NULL CHECK (description IS NULL OR char_length(description) <= 100),
    event_types                 text[] NOT NULL CHECK (cardinality(event_types) >= 1 AND event_types <@ ARRAY['run.finished', 'run.waiting', 'document.ingested']::text[]),
    enabled                     boolean NOT NULL DEFAULT true,
    disabled_reason             text NULL CHECK (disabled_reason IS NULL OR disabled_reason IN ('failing', 'gone', 'admin', 'owner_removed')),
    disabled_at                 timestamptz NULL,
    secret_ciphertext           text NOT NULL CHECK (secret_ciphertext LIKE 'enc:v1:%'),
    previous_secret_ciphertext  text NULL CHECK (previous_secret_ciphertext IS NULL OR previous_secret_ciphertext LIKE 'enc:v1:%'),
    previous_secret_expires_at  timestamptz NULL,
    consecutive_failures        integer NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
    last_success_at             timestamptz NULL,
    created_at                  timestamptz NOT NULL DEFAULT now(),
    updated_at                  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT webhook_endpoints_enabled_reason_check CHECK (NOT enabled OR disabled_reason IS NULL),
    CONSTRAINT webhook_endpoints_previous_secret_pair_check CHECK ((previous_secret_ciphertext IS NULL) = (previous_secret_expires_at IS NULL))
);

COMMENT ON TABLE public.webhook_endpoints IS
    'Phase 308 (D-12, D-27, D-32, D-58). One outbound webhook endpoint per row, owned by one member in one org. The signing secret is stored ENCRYPTED ONLY (secret_cipher enc:v1:). Only writer: app/db/webhooks.py and the drainer (service-role pool). Deny-all to every client role (RLS on, no policy).';
COMMENT ON COLUMN public.webhook_endpoints.disabled_reason IS
    'Why the endpoint is off: failing (5 failed deliveries in a row), gone (410), admin (an org admin turned it off), owner_removed. NULL while on, and NULL when the owner turned it off themselves (D-58).';
COMMENT ON COLUMN public.webhook_endpoints.previous_secret_ciphertext IS
    'The secret before the last roll, kept for 24 h so the receiver can switch over (D-13). Set together with previous_secret_expires_at or not at all.';

CREATE INDEX IF NOT EXISTS webhook_endpoints_org_enabled_idx ON public.webhook_endpoints (org_id) WHERE enabled;
CREATE INDEX IF NOT EXISTS webhook_endpoints_owner_idx ON public.webhook_endpoints (user_id, org_id);

DROP TRIGGER IF EXISTS webhook_endpoints_set_updated_at ON public.webhook_endpoints;
CREATE TRIGGER webhook_endpoints_set_updated_at BEFORE UPDATE ON public.webhook_endpoints
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.webhook_endpoints FROM PUBLIC;
REVOKE ALL ON TABLE public.webhook_endpoints FROM anon;
REVOKE ALL ON TABLE public.webhook_endpoints FROM authenticated;
REVOKE ALL ON TABLE public.webhook_endpoints FROM service_role;
GRANT ALL ON TABLE public.webhook_endpoints TO service_role;

-- No policy at all on webhook_endpoints: deny-all to clients (D-32).

-- ── 2. public.webhook_events — deny-all to every client role ────────────────
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type            text NOT NULL CHECK (type IN ('run.finished', 'run.waiting', 'document.ingested', 'webhook.test')),
    org_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    item_id         uuid NULL,
    owner_id        uuid NULL,
    status          text NULL,
    origin_kind     text NULL,
    definition_id   uuid NULL,
    folder_id       uuid NULL,
    endpoint_id     uuid NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
    payload         text NULL,
    fanned_out_at   timestamptz NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT webhook_events_test_endpoint_check CHECK ((type = 'webhook.test') = (endpoint_id IS NOT NULL)),
    CONSTRAINT webhook_events_item_check CHECK (type = 'webhook.test' OR item_id IS NOT NULL)
);

COMMENT ON TABLE public.webhook_events IS
    'Phase 308 (D-05, D-07, D-58). One row per thing that happened, written by the emit triggers (or by the test route for webhook.test). payload is the frozen thin JSON, set once at fan-out — the only payload column in the schema. Deny-all to every client role (RLS on, no policy).';
COMMENT ON COLUMN public.webhook_events.owner_id IS
    'The run owner for run events (endpoints are the owner''s, D-03). NULL for document events: recipients are decided at fan-out.';

CREATE UNIQUE INDEX IF NOT EXISTS webhook_events_run_finished_once ON public.webhook_events (item_id) WHERE type = 'run.finished';
CREATE INDEX IF NOT EXISTS webhook_events_unfanned_idx ON public.webhook_events (created_at) WHERE fanned_out_at IS NULL;
CREATE INDEX IF NOT EXISTS webhook_events_created_idx ON public.webhook_events (created_at);
CREATE INDEX IF NOT EXISTS webhook_events_endpoint_idx ON public.webhook_events (endpoint_id) WHERE endpoint_id IS NOT NULL;

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.webhook_events FROM PUBLIC;
REVOKE ALL ON TABLE public.webhook_events FROM anon;
REVOKE ALL ON TABLE public.webhook_events FROM authenticated;
REVOKE ALL ON TABLE public.webhook_events FROM service_role;
GRANT ALL ON TABLE public.webhook_events TO service_role;

-- No policy at all on webhook_events: deny-all to clients (D-32).

-- ── 3. public.webhook_deliveries — deny-all to every client role ────────────
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint_id         uuid NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
    event_id            uuid NOT NULL REFERENCES public.webhook_events(id) ON DELETE CASCADE,
    status              text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'retrying', 'sending', 'sent', 'failed', 'skipped_not_visible', 'skipped_owner_gone', 'skipped_disabled')),
    reason              text NULL CHECK (reason IS NULL OR reason IN ('redaction_failed', 'secret_unreadable', 'invalid_url', 'max_attempts', 'not_retried', 'stale_lease')),
    attempts            integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    next_attempt_at     timestamptz NOT NULL DEFAULT now(),
    claimed_at          timestamptz NULL,
    last_status_code    integer NULL,
    last_latency_ms     integer NULL,
    last_error          text NULL CHECK (last_error IS NULL OR last_error IN ('http_status', 'timeout', 'connect', 'tls', 'redirect', 'refused_address', 'response_too_large', 'gone', 'invalid_url')),
    last_attempt_at     timestamptz NULL,
    sent_at             timestamptz NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT webhook_deliveries_endpoint_event_uq UNIQUE (endpoint_id, event_id)
);

COMMENT ON TABLE public.webhook_deliveries IS
    'Phase 308 (D-07, D-17, D-20). One delivery per (endpoint, event), UNIQUE. Words-only outcome columns: no body, response or headers is ever stored. Drained by every backend worker with FOR UPDATE SKIP LOCKED. Deny-all to every client role (RLS on, no policy).';

CREATE INDEX IF NOT EXISTS webhook_deliveries_due_idx ON public.webhook_deliveries (status, next_attempt_at) WHERE status IN ('pending', 'retrying');
CREATE INDEX IF NOT EXISTS webhook_deliveries_sending_idx ON public.webhook_deliveries (claimed_at) WHERE status = 'sending';
CREATE INDEX IF NOT EXISTS webhook_deliveries_log_idx ON public.webhook_deliveries (endpoint_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS webhook_deliveries_event_idx ON public.webhook_deliveries (event_id);

DROP TRIGGER IF EXISTS webhook_deliveries_set_updated_at ON public.webhook_deliveries;
CREATE TRIGGER webhook_deliveries_set_updated_at BEFORE UPDATE ON public.webhook_deliveries
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.webhook_deliveries FROM PUBLIC;
REVOKE ALL ON TABLE public.webhook_deliveries FROM anon;
REVOKE ALL ON TABLE public.webhook_deliveries FROM authenticated;
REVOKE ALL ON TABLE public.webhook_deliveries FROM service_role;
GRANT ALL ON TABLE public.webhook_deliveries TO service_role;

-- No policy at all on webhook_deliveries: deny-all to clients (D-32).

-- ── 4. public.webhook_delivery_attempts — deny-all to every client role ─────
CREATE TABLE IF NOT EXISTS public.webhook_delivery_attempts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id     uuid NOT NULL REFERENCES public.webhook_deliveries(id) ON DELETE CASCADE,
    attempt         integer NOT NULL CHECK (attempt >= 1),
    status_code     integer NULL,
    latency_ms      integer NULL,
    error           text NULL CHECK (error IS NULL OR error IN ('http_status', 'timeout', 'connect', 'tls', 'redirect', 'refused_address', 'response_too_large', 'gone', 'invalid_url')),
    created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.webhook_delivery_attempts IS
    'Phase 308 (D-20). One row per HTTP attempt: number, status code, latency, an error word. No body, response or headers. Deny-all to every client role (RLS on, no policy).';

CREATE INDEX IF NOT EXISTS webhook_delivery_attempts_delivery_idx ON public.webhook_delivery_attempts (delivery_id);

ALTER TABLE public.webhook_delivery_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.webhook_delivery_attempts FROM PUBLIC;
REVOKE ALL ON TABLE public.webhook_delivery_attempts FROM anon;
REVOKE ALL ON TABLE public.webhook_delivery_attempts FROM authenticated;
REVOKE ALL ON TABLE public.webhook_delivery_attempts FROM service_role;
GRANT ALL ON TABLE public.webhook_delivery_attempts TO service_role;

-- No policy at all on webhook_delivery_attempts: deny-all to clients (D-32).

-- ── 5. webhook_emit_run_event() — a run finished or started waiting ─────────
CREATE OR REPLACE FUNCTION public.webhook_emit_run_event()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = ''
AS $fn$
DECLARE
    v_type text;
BEGIN
    BEGIN
        -- D-42: a golden (publish validation) run or a run without an owner emits nothing.
        IF NEW.user_id IS NULL OR coalesce(NEW.is_golden_run, false) THEN
            RETURN NULL;
        END IF;
        -- D-01 / D-43: cap_paused stays in the set for forward compatibility (no writer today).
        v_type := CASE
                      WHEN NEW.status IN ('completed', 'failed', 'cancelled') THEN 'run.finished'
                      WHEN NEW.status IN ('paused', 'cap_paused') THEN 'run.waiting'
                  END;
        IF v_type IS NULL THEN
            RETURN NULL;
        END IF;
        IF v_type = 'run.finished' AND OLD.status IN ('completed', 'failed', 'cancelled') THEN
            RETURN NULL;
        END IF;
        -- T-308-19: no enabled endpoint of the owner in this org subscribes, no row.
        IF EXISTS (
            SELECT 1
              FROM public.webhook_endpoints e
             WHERE e.org_id = NEW.org_id
               AND e.user_id = NEW.user_id
               AND e.enabled
               AND v_type = ANY (e.event_types)
        ) THEN
            INSERT INTO public.webhook_events (type, org_id, item_id, owner_id, status, origin_kind, definition_id)
            VALUES (v_type, NEW.org_id, NEW.id, NEW.user_id, NEW.status, NEW.origin_kind, NEW.definition_id)
            ON CONFLICT DO NOTHING;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'webhook_emit_run_event swallowed: %', SQLERRM;
    END;
    RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS workflow_runs_webhook_emit ON public.workflow_runs;
CREATE TRIGGER workflow_runs_webhook_emit
    AFTER UPDATE OF status ON public.workflow_runs
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('completed', 'failed', 'cancelled', 'paused', 'cap_paused'))
    EXECUTE FUNCTION public.webhook_emit_run_event();

-- ── 6. webhook_emit_document_event() — a document finished ingesting ────────
CREATE OR REPLACE FUNCTION public.webhook_emit_document_event()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = ''
AS $fn$
BEGIN
    BEGIN
        -- T-308-19: no enabled endpoint in this org subscribes, no row. Recipients are decided at
        -- fan-out (D-03), so owner_id stays NULL.
        IF EXISTS (
            SELECT 1
              FROM public.webhook_endpoints e
             WHERE e.org_id = NEW.org_id
               AND e.enabled
               AND 'document.ingested' = ANY (e.event_types)
        ) THEN
            INSERT INTO public.webhook_events (type, org_id, item_id, status, folder_id)
            VALUES ('document.ingested', NEW.org_id, NEW.id, NEW.status, NEW.folder_id)
            ON CONFLICT DO NOTHING;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'webhook_emit_document_event swallowed: %', SQLERRM;
    END;
    RETURN NULL;
END;
$fn$;

-- D-47: two triggers on one function — a combined INSERT OR UPDATE trigger cannot read OLD in WHEN.
DROP TRIGGER IF EXISTS documents_webhook_emit_insert ON public.documents;
CREATE TRIGGER documents_webhook_emit_insert
    AFTER INSERT ON public.documents
    FOR EACH ROW
    WHEN (NEW.status = 'completed')
    EXECUTE FUNCTION public.webhook_emit_document_event();

DROP TRIGGER IF EXISTS documents_webhook_emit_update ON public.documents;
CREATE TRIGGER documents_webhook_emit_update
    AFTER UPDATE OF status ON public.documents
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed')
    EXECUTE FUNCTION public.webhook_emit_document_event();

-- ── 7. EXECUTE: PUBLIC first, then the client roles (the CLAUDE.md trap) ────
REVOKE EXECUTE ON FUNCTION public.webhook_emit_run_event() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.webhook_emit_run_event() FROM anon;
REVOKE EXECUTE ON FUNCTION public.webhook_emit_run_event() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.webhook_emit_run_event() TO service_role;
REVOKE EXECUTE ON FUNCTION public.webhook_emit_document_event() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.webhook_emit_document_event() FROM anon;
REVOKE EXECUTE ON FUNCTION public.webhook_emit_document_event() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.webhook_emit_document_event() TO service_role;

-- ── 8. notifications: the webhook_disabled notice (D-48 / D-56) ─────────────
ALTER TABLE public.notifications ALTER COLUMN run_id DROP NOT NULL;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS endpoint_id uuid NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check
    CHECK (kind IN ('question', 'approval', 'webhook_disabled'));

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_closed_reason_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_closed_reason_check
    CHECK (closed_reason IS NULL OR closed_reason IN ('answered', 'run_ended', 'endpoint_enabled'));

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_kind_shape_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_shape_check
    CHECK ((kind IN ('question', 'approval') AND run_id IS NOT NULL AND endpoint_id IS NULL)
        OR (kind = 'webhook_disabled' AND endpoint_id IS NOT NULL AND run_id IS NULL));

CREATE UNIQUE INDEX IF NOT EXISTS notifications_one_open_per_endpoint ON public.notifications (endpoint_id) WHERE closed_at IS NULL AND kind = 'webhook_disabled';
CREATE INDEX IF NOT EXISTS notifications_endpoint_idx ON public.notifications (endpoint_id) WHERE endpoint_id IS NOT NULL;

COMMENT ON COLUMN public.notifications.endpoint_id IS
    'Phase 308 (D-48). Set only on a webhook_disabled notice: the endpoint that was turned off (failing or gone). Deleting the endpoint deletes the notice.';

-- ── 9. audit: the nine webhook.endpoint.* literals (D-31) ───────────────────
ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_action_type_check;
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_action_type_check
  CHECK (action_type = ANY (ARRAY[
    -- 11 legacy actions
    'document.upload', 'document.delete', 'search.query', 'code.execute', 'skill.load',
    'thread.create', 'thread.delete', 'settings.update', 'memory.remember', 'memory.recall', 'feedback.submit',
    -- 8 DM actions (Phase 110 / Migration 071)
    'view.create', 'view.delete', 'relationship.create', 'relationship.delete',
    'classification.apply', 'classification.rule.create', 'metadata.update', 'metadata.field.create',
    -- 2 Connector actions (Phase 223 / Migration 152)
    'connector.call', 'connector.grant',
    -- 3 Connector watch actions (Phase 234 / LIB-08)
    'connector.watch.create', 'connector.watch.delete', 'connector.watch.sync',
    -- 10 Retention + folder actions (Phase 275 / Migration 204)
    'retention.policy.create', 'retention.policy.update', 'retention.policy.delete',
    'retention.hold.create', 'retention.hold.update', 'retention.hold.release',
    'retention.disposition.confirm', 'retention.document.unarchive', 'retention.document.keep',
    'folder.delete',
    -- Phase 293 (D-16) — API keys
    'api_key.create', 'api_key.revoke', 'api_key.start', 'api_key.read', 'api_key.refused',
    -- Phase 298 (D-20) — the audited per-item org move
    'org.item.move',
    -- Phase 308 (D-31) — webhooks
    'webhook.endpoint.created', 'webhook.endpoint.updated', 'webhook.endpoint.deleted',
    'webhook.endpoint.enabled', 'webhook.endpoint.disabled', 'webhook.endpoint.secret_rolled',
    'webhook.endpoint.test_sent', 'webhook.endpoint.delivery_resent', 'webhook.endpoint.auto_disabled'
  ]::text[]));

COMMIT;

-- VERIFY (read-only): expect one row reading PASS.
SELECT CASE
         WHEN (SELECT count(*) FROM pg_class c
                WHERE c.oid IN ('public.webhook_endpoints'::regclass, 'public.webhook_events'::regclass,
                                'public.webhook_deliveries'::regclass, 'public.webhook_delivery_attempts'::regclass)
                  AND c.relrowsecurity) = 4
          AND NOT EXISTS (SELECT 1 FROM pg_policies p
                           WHERE p.schemaname = 'public'
                             AND p.tablename IN ('webhook_endpoints', 'webhook_events',
                                                 'webhook_deliveries', 'webhook_delivery_attempts'))
          AND NOT has_table_privilege('anon', 'public.webhook_endpoints', 'SELECT')
          AND NOT has_table_privilege('authenticated', 'public.webhook_endpoints', 'SELECT')
          AND NOT has_table_privilege('anon', 'public.webhook_events', 'SELECT')
          AND NOT has_table_privilege('authenticated', 'public.webhook_events', 'SELECT')
          AND NOT has_table_privilege('anon', 'public.webhook_deliveries', 'SELECT')
          AND NOT has_table_privilege('authenticated', 'public.webhook_deliveries', 'SELECT')
          AND NOT has_table_privilege('anon', 'public.webhook_delivery_attempts', 'SELECT')
          AND NOT has_table_privilege('authenticated', 'public.webhook_delivery_attempts', 'SELECT')
          AND (SELECT count(*) FROM pg_trigger t
                WHERE NOT t.tgisinternal
                  AND ((t.tgname = 'workflow_runs_webhook_emit' AND t.tgrelid = 'public.workflow_runs'::regclass)
                    OR (t.tgname IN ('documents_webhook_emit_insert', 'documents_webhook_emit_update')
                        AND t.tgrelid = 'public.documents'::regclass))) = 3
          AND NOT has_function_privilege('public', 'public.webhook_emit_run_event()', 'EXECUTE')
          AND NOT has_function_privilege('anon', 'public.webhook_emit_run_event()', 'EXECUTE')
          AND NOT has_function_privilege('authenticated', 'public.webhook_emit_run_event()', 'EXECUTE')
          AND NOT has_function_privilege('public', 'public.webhook_emit_document_event()', 'EXECUTE')
          AND NOT has_function_privilege('anon', 'public.webhook_emit_document_event()', 'EXECUTE')
          AND NOT has_function_privilege('authenticated', 'public.webhook_emit_document_event()', 'EXECUTE')
          AND (SELECT pg_get_constraintdef(oid) FROM pg_constraint
                WHERE conname = 'audit_log_action_type_check') LIKE '%webhook.endpoint.auto_disabled%'
         THEN 'PASS'
         ELSE 'FAIL'
       END AS migration_225_verify;

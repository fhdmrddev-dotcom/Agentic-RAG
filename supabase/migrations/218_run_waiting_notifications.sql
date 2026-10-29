-- 218 — a run that waits on a person leaves ONE notice for its owner, and ONE email delivery in an
-- outbox (Phase 300, SEED-281's run-waiting half; NOTE-02 / NOTE-04; D-18, D-19, D-20, D-26, D-29).
--
-- WHAT IT DOES
--   1. public.notifications: one row per WAIT. A partial unique index keeps at most ONE open notice
--      per recipient and run (D-01: a re-ask while open is the same wait; a new ask after the
--      previous one closed is a new wait). Readable by its recipient only (D-29: a readable table
--      for Phase 301, no route here). No client role may write it.
--   2. public.notification_deliveries: the outbox. One delivery per notice, enforced by a UNIQUE key
--      (D-20). RLS on with NO policy, so it is deny-all to every client role (D-19). The drainer
--      (300-04) works it through the service pool, FOR UPDATE SKIP LOCKED; the rendered payload is
--      frozen on the row at first claim (D-31).
--   3. public.notify_on_ask_row(), on every system-role messages row that carries tool_calls:
--      a harness ask_user_prompt for a live (active or paused), non-golden, owned workflow run
--      upserts the open notice and queues its delivery, due at created_at + the app_settings delay;
--      an ask_user_response with the same tool_call_id closes it ('answered', or 'run_ended' when
--      the engine expired it). The recipient AND THE ORG are read from public.workflow_runs, never
--      from the message (D-18: messages.org_id is the LIMIT-1 owner autofill).
--      Approval vs question is read from the pause kind only (engine_pause.kind = action_risk, D-04).
--      A chat ask_user (origin deep, a runs.id) and a golden run write nothing; nothing writes
--      cap_paused into public.workflow_runs, so a tool-round-cap pause cannot produce a notice.
--   4. public.notify_on_run_status(), on a terminal status change of a workflow run: closes every
--      open notice of that run ('run_ended'), and when the run was started by a schedule that
--      recorded 'waiting' (300-01, D-26) and is that schedule's newest run, the schedule's
--      last_status becomes the run's terminal status.
--   5. app_settings columns (D-07 / D-08 / D-10) and org_invitations delivery columns (D-11).
--
-- FAIL-SOFT: each trigger function body runs inside its own exception block that turns any error
-- into a WARNING and returns. A PL/pgSQL exception block is a subtransaction, so only the notice
-- writes roll back: the engine's fail-closed prompt insert (engine_ask.py) can never fail because of
-- a notice, and a run's status update can never fail because of a close. harness_engine.py is NOT
-- edited by this phase.
--
-- SCHEMA, NOT A SEED (D-27): no INSERT, no docs/OPERATOR.md Step-3 entry, and this migration's
-- filename is never named in docs/OPERATOR.md. The delay is a column default (120 s), bounded
-- 60..3600 by the API and by its CHECK.
--
-- NO BACKFILL: runs already waiting when this is applied get no notice, on purpose, so a deploy
-- never emails people about old waits. D-25: production has never sent an app email (measured
-- read-only 2026-10-29), so there is no history to stay compatible with.
--
-- PRIVILEGES: both tables are revoked from PUBLIC, anon, authenticated and service_role first (the
-- CLAUDE.md PUBLIC trap), then authenticated gets SELECT on notifications only and service_role
-- gets full DML on both. Both trigger functions are definer-rights with search_path pinned to ''
-- and fully-qualified names; EXECUTE is revoked from PUBLIC, anon and authenticated and granted to
-- service_role. A trigger fires without its caller holding EXECUTE (test_181), so the user-JWT
-- answer route still closes its notice. org_invitations carries table-level grants, so its new
-- columns need no column grant (asserted live by test_300_rls_anon_live.py, never assumed).
--
-- APPLY (local): paste this whole file into the Supabase SQL editor (http://127.0.0.1:54323), or
-- run it through the backend venv asyncpg in ONE transaction. NEVER `supabase db push` and never
-- `supabase db reset` (they destroy dev data). Idempotent: re-running it is a no-op. Then
-- `bash scripts/regenerate-full-schema.sh` with NO --reset.
-- APPLY (cloud): an operator paste at deploy, with per-action approval, then
-- get_advisors(security). Never from a phase executor.

-- ── 1. notifications ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id        uuid NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    run_id        uuid NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
    kind          text NOT NULL CHECK (kind IN ('question', 'approval')),
    tool_call_id  text NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    closed_at     timestamptz NULL,
    closed_reason text NULL CHECK (closed_reason IS NULL OR closed_reason IN ('answered', 'run_ended'))
);

COMMENT ON TABLE public.notifications IS
    'Phase 300 (NOTE-02, D-18). One row per wait: a workflow run waiting on its owner for an answer or an approval. Written and closed ONLY by the triggers notify_on_ask_row / notify_on_run_status. org_id is copied from workflow_runs.org_id, never from messages.org_id. Read by its recipient only (Phase 301 lists it).';
COMMENT ON COLUMN public.notifications.kind IS
    'question | approval. approval when the pause is an action-risk checkpoint (engine_pause.kind = action_risk), else question. Never derived from the question text (D-04).';
COMMENT ON COLUMN public.notifications.closed_reason IS
    'answered = an ask_user_response with the same tool_call_id; run_ended = the run reached a terminal status, or the engine expired the prompt.';

CREATE UNIQUE INDEX IF NOT EXISTS notifications_one_open_per_recipient_run
    ON public.notifications (recipient_id, run_id) WHERE closed_at IS NULL;
CREATE INDEX IF NOT EXISTS notifications_open_tool_call_idx
    ON public.notifications (tool_call_id) WHERE closed_at IS NULL;
CREATE INDEX IF NOT EXISTS notifications_recipient_created_idx
    ON public.notifications (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_run_idx
    ON public.notifications (run_id);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.notifications FROM PUBLIC;
REVOKE ALL ON TABLE public.notifications FROM anon;
REVOKE ALL ON TABLE public.notifications FROM authenticated;
REVOKE ALL ON TABLE public.notifications FROM service_role;
GRANT SELECT ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;

DROP POLICY IF EXISTS "Recipients read their own notices" ON public.notifications;
CREATE POLICY "Recipients read their own notices" ON public.notifications
    FOR SELECT TO authenticated
    USING (recipient_id = (SELECT auth.uid()));

-- There is NO INSERT / UPDATE / DELETE policy, on purpose: notices are written by the triggers
-- below and removed only by the cascades.

-- ── 2. notification_deliveries (the outbox) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_deliveries (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id     uuid NOT NULL UNIQUE REFERENCES public.notifications(id) ON DELETE CASCADE,
    channel             text NOT NULL DEFAULT 'email' CHECK (channel = 'email'),
    status              text NOT NULL DEFAULT 'pending' CHECK (status IN (
                            'pending', 'retry', 'sending', 'sent', 'failed',
                            'suppressed', 'skipped_opted_out', 'skipped_answered')),
    attempts            integer NOT NULL DEFAULT 0,
    due_at              timestamptz NOT NULL,
    claimed_at          timestamptz NULL,
    subject             text NULL,
    text_body           text NULL,
    html_body           text NULL,
    waited_seconds      integer NULL,
    provider            text NULL,
    provider_message_id text NULL,
    reason              text NULL,
    sent_at             timestamptz NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notification_deliveries IS
    'Phase 300 (D-12, D-19, D-20). The run-waiting email outbox: exactly one delivery per notice (notification_id UNIQUE). Deny-all to every client role (RLS on, no policy); drained by the backend pool with FOR UPDATE SKIP LOCKED.';
COMMENT ON COLUMN public.notification_deliveries.subject IS
    'subject / text_body / html_body / waited_seconds are rendered ONCE at first claim and frozen here, so a retry resends the identical payload under the same Idempotency-Key (D-31).';
COMMENT ON COLUMN public.notification_deliveries.reason IS
    'Words for the outcome of a failed / suppressed / skipped delivery. Never a secret, never a key.';

CREATE INDEX IF NOT EXISTS notification_deliveries_due_idx
    ON public.notification_deliveries (status, due_at) WHERE status IN ('pending', 'retry');

DROP TRIGGER IF EXISTS notification_deliveries_set_updated_at ON public.notification_deliveries;
CREATE TRIGGER notification_deliveries_set_updated_at BEFORE UPDATE ON public.notification_deliveries
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.notification_deliveries FROM PUBLIC;
REVOKE ALL ON TABLE public.notification_deliveries FROM anon;
REVOKE ALL ON TABLE public.notification_deliveries FROM authenticated;
REVOKE ALL ON TABLE public.notification_deliveries FROM service_role;
GRANT ALL ON TABLE public.notification_deliveries TO service_role;

-- No policy at all on the outbox: deny-all to clients (D-19).

-- ── 3. app_settings columns (D-07 / D-08 / D-10) — schema, not a seed ─────────
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS notification_email_delay_seconds integer NOT NULL DEFAULT 120;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS email_from_address text NULL;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS email_from_name text NOT NULL DEFAULT 'Syrel';

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS email_dev_redirect_address text NULL;

ALTER TABLE public.app_settings
  DROP CONSTRAINT IF EXISTS app_settings_notification_email_delay_seconds_bound;

ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_notification_email_delay_seconds_bound
  CHECK (notification_email_delay_seconds >= 60 AND notification_email_delay_seconds <= 3600);

COMMENT ON COLUMN public.app_settings.notification_email_delay_seconds IS
  'Phase 300 (D-07). Seconds a run must still be waiting before its owner is emailed. One app-wide '
  'operator knob, default 120. Bounded 60..3600 by the API and by this CHECK '
  '(app_settings_notification_email_delay_seconds_bound).';
COMMENT ON COLUMN public.app_settings.email_from_address IS
  'Phase 300 (D-08). The From address of every app email. NULL or empty = fall back to the '
  'INVITE_FROM_EMAIL env var so an existing install keeps sending.';
COMMENT ON COLUMN public.app_settings.email_from_name IS
  'Phase 300 (D-03 / D-08). The From display name of every app email. Default Syrel.';
COMMENT ON COLUMN public.app_settings.email_dev_redirect_address IS
  'Phase 300 (D-10). Outside production every app email is rewritten to this address; NULL = the '
  'send is recorded as suppressed and only logged. Production ignores it.';

-- ── 4. org_invitations delivery columns (D-11) ──────────────────────────────
ALTER TABLE public.org_invitations ADD COLUMN IF NOT EXISTS email_delivery text NULL;
ALTER TABLE public.org_invitations ADD COLUMN IF NOT EXISTS email_failed_at timestamptz NULL;
ALTER TABLE public.org_invitations ADD COLUMN IF NOT EXISTS email_failure text NULL;

ALTER TABLE public.org_invitations DROP CONSTRAINT IF EXISTS org_invitations_email_delivery_check;
ALTER TABLE public.org_invitations ADD CONSTRAINT org_invitations_email_delivery_check
  CHECK (email_delivery IS NULL OR email_delivery IN ('sent', 'failed', 'not_configured'));

COMMENT ON COLUMN public.org_invitations.email_delivery IS
  'Phase 300 (D-11). Outcome of the last invitation email: sent | failed | not_configured. NULL = '
  'never attempted (rows from before migration 218). A failed send never blocks the invitation.';
COMMENT ON COLUMN public.org_invitations.email_failed_at IS
  'Phase 300 (D-11). When the last invitation email failed; NULL when it did not.';
COMMENT ON COLUMN public.org_invitations.email_failure IS
  'Phase 300 (D-11). Words for why the last invitation email failed. Never a secret.';

-- ── 5. notify_on_ask_row() — write / close a notice from an ask row ─────────
CREATE OR REPLACE FUNCTION public.notify_on_ask_row()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = ''
AS $fn$
DECLARE
    tc        jsonb;
    r         record;
    v_nid     uuid;
    v_created timestamptz;
    v_delay   integer;
BEGIN
    BEGIN
        tc := NEW.tool_calls->0;
        IF tc->>'kind' = 'ask_user_prompt'
           AND NEW.origin = 'harness'
           AND tc->>'run_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
            SELECT wr.id, wr.user_id, wr.org_id, wr.status, wr.is_golden_run
              INTO r
              FROM public.workflow_runs wr
             WHERE wr.id = (tc->>'run_id')::uuid;
            IF FOUND
               AND r.user_id IS NOT NULL
               AND NOT coalesce(r.is_golden_run, false)
               AND r.status IN ('active', 'paused') THEN
                INSERT INTO public.notifications (recipient_id, org_id, run_id, kind, tool_call_id)
                VALUES (
                    r.user_id,
                    r.org_id,
                    r.id,
                    CASE WHEN tc->'engine_pause'->>'kind' = 'action_risk' THEN 'approval' ELSE 'question' END,
                    tc->>'tool_call_id'
                )
                ON CONFLICT (recipient_id, run_id) WHERE closed_at IS NULL
                DO UPDATE SET tool_call_id = EXCLUDED.tool_call_id, kind = EXCLUDED.kind
                RETURNING id, created_at INTO v_nid, v_created;

                SELECT s.notification_email_delay_seconds
                  INTO v_delay
                  FROM public.app_settings s
                 WHERE s.id = 'global';

                INSERT INTO public.notification_deliveries (notification_id, due_at)
                VALUES (v_nid, v_created + make_interval(secs => coalesce(v_delay, 120)))
                ON CONFLICT (notification_id) DO NOTHING;
            END IF;
        ELSIF tc->>'kind' = 'ask_user_response' AND tc->>'tool_call_id' IS NOT NULL THEN
            -- 300-REVIEW WR-04: this function is SECURITY DEFINER and tool_call_id is client-
            -- supplied (the answer route checks it on the harness branch only), so the close is
            -- scoped to runs in the ANSWER's own thread. A row written in another user's thread
            -- can never close this notice. The answer route and the engine's expiry row both
            -- write into the run's thread, so both still close it.
            UPDATE public.notifications n
               SET closed_at = now(),
                   closed_reason = CASE WHEN (tc->>'expired') = 'true' THEN 'run_ended' ELSE 'answered' END
             WHERE n.tool_call_id = tc->>'tool_call_id'
               AND n.closed_at IS NULL
               AND n.run_id IN (SELECT wr.id
                                  FROM public.workflow_runs wr
                                 WHERE wr.thread_id = NEW.thread_id);
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'notify_on_ask_row swallowed: %', SQLERRM;
    END;
    RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS messages_notify_on_ask ON public.messages;
CREATE TRIGGER messages_notify_on_ask
    AFTER INSERT ON public.messages
    FOR EACH ROW
    WHEN (NEW.role = 'system' AND NEW.tool_calls IS NOT NULL)
    EXECUTE FUNCTION public.notify_on_ask_row();

REVOKE EXECUTE ON FUNCTION public.notify_on_ask_row() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_on_ask_row() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_on_ask_row() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.notify_on_ask_row() TO service_role;

-- ── 6. notify_on_run_status() — a run ended: close its notices, follow its schedule ─
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
        UPDATE public.notifications n
           SET closed_at = now(),
               closed_reason = 'run_ended'
         WHERE n.run_id = NEW.id
           AND n.closed_at IS NULL;

        IF NEW.inputs->>'_schedule_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
            v_sid := (NEW.inputs->>'_schedule_id')::uuid;
            IF EXISTS (
                SELECT 1 FROM public.workflow_schedules ws
                 WHERE ws.id = v_sid AND ws.last_status = 'waiting'
            ) THEN
                UPDATE public.workflow_schedules ws
                   SET last_status = NEW.status
                 WHERE ws.id = v_sid
                   AND ws.last_status = 'waiting'
                   AND NOT EXISTS (
                       SELECT 1 FROM public.workflow_runs o
                        WHERE o.id <> NEW.id
                          AND o.inputs->>'_schedule_id' = NEW.inputs->>'_schedule_id'
                          AND o.created_at > NEW.created_at
                   );
            END IF;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'notify_on_run_status swallowed: %', SQLERRM;
    END;
    RETURN NULL;
END;
$fn$;

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

-- VERIFY (read-only): expect one row reading PASS.
SELECT CASE
         WHEN (SELECT count(*) FROM pg_class c
                WHERE c.oid IN ('public.notifications'::regclass, 'public.notification_deliveries'::regclass)
                  AND c.relrowsecurity) = 2
          AND (SELECT count(*) FROM pg_trigger t
                WHERE NOT t.tgisinternal
                  AND ((t.tgname = 'messages_notify_on_ask' AND t.tgrelid = 'public.messages'::regclass)
                    OR (t.tgname = 'workflow_runs_notify_on_status' AND t.tgrelid = 'public.workflow_runs'::regclass))) = 2
          AND NOT has_function_privilege('public', 'public.notify_on_ask_row()', 'EXECUTE')
          AND NOT has_function_privilege('anon', 'public.notify_on_ask_row()', 'EXECUTE')
          AND NOT has_function_privilege('authenticated', 'public.notify_on_ask_row()', 'EXECUTE')
          AND NOT has_function_privilege('public', 'public.notify_on_run_status()', 'EXECUTE')
          AND NOT has_function_privilege('anon', 'public.notify_on_run_status()', 'EXECUTE')
          AND NOT has_function_privilege('authenticated', 'public.notify_on_run_status()', 'EXECUTE')
          AND NOT has_table_privilege('anon', 'public.notifications', 'SELECT')
          AND NOT has_table_privilege('anon', 'public.notification_deliveries', 'SELECT')
          AND NOT has_table_privilege('authenticated', 'public.notification_deliveries', 'SELECT')
          AND NOT EXISTS (SELECT 1 FROM pg_policies p
                           WHERE p.schemaname = 'public' AND p.tablename = 'notification_deliveries')
         THEN 'PASS'
         ELSE 'FAIL'
       END AS migration_218_verify;

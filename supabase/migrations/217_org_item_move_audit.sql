-- 217 — the audit action type for the per-item org move (Phase 298, ORG-06, D-20 / D-31 / D-35).
--
-- An owner can move ONE of their own items (a Library folder subtree, a Root document with its
-- versions, or a draft workflow) to another organization they belong to. The move runs as one
-- asyncpg transaction on the pool (backend/app/services/org_move.py) and writes its receipt INSIDE
-- that transaction: one audit_log row, action_type 'org.item.move', recorded under the org the item
-- LEAVES, metadata naming the target org. This migration adds that action type to the CHECK.
-- backend/app/services/audit_service.py VALID_ACTION_TYPES gains the same literal in the same commit.
--
-- ⛔ NO DATA REPAIR (D-18). The read-only audit (298-ORG-AUDIT.md) found no identifiable mis-stamp,
-- so there is no UPDATE, no INSERT and no bulk re-stamp here — the only write path is one
-- owner-initiated item per request, through the app.
--
-- ⛔ NO TRIGGER AMENDMENT (D-31). Published workflows are not movable in v1, so
-- workflow_definitions_block_published_update is left exactly as it is. No function is created or
-- replaced, so no EXECUTE grant appears and no privilege changes (nothing for PUBLIC to inherit).
--
-- Every literal of the live CHECK is kept (read from the live CHECK with
-- `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'audit_log_action_type_check'`
-- on 2026-10-28: the 39 literals of migration 215), in migration 215's layout.
--
-- ⚠ DEPLOY ORDER (D-35). main.py's lifespan runs assert_action_types_synced, which HARD-FAILS boot
-- when VALID_ACTION_TYPES names a type the live CHECK lacks. A backend carrying 'org.item.move' will
-- not start against a database without this migration. So: paste 217 into the database FIRST
-- (local, then cloud), run get_advisors(security), and only then deploy the backend.
--
-- APPLY (local): paste this whole file into the Supabase SQL editor (http://127.0.0.1:54323).
-- NEVER `supabase db push` / `supabase db reset` (they destroy dev data). Idempotent: re-running it
-- is a no-op. Then `bash scripts/regenerate-full-schema.sh` (NO --reset).
-- APPLY (cloud): an operator step after the phase, approval-gated — never from a phase executor.

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
    'org.item.move'
  ]::text[]));

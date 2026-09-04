-- 152_audit_log_connector_action_types_and_message_active_connectors.sql
-- Phase 223: A Connection Leaves a Record
--
-- 1. Updates audit_log_action_type_check on public.audit_log to include
--    'connector.call' (outbound connector tool execution attempts & outcomes) and
--    'connector.grant' (permanent grant mutations via chat card Always allow or Settings).
--
-- 2. Adds active_connector_ids jsonb column to public.messages so armed connectors
--    persist durably per turn and survive reloads without fail-open disarming.
-- ============================================================================

ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_action_type_check;
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_action_type_check
  CHECK (action_type = ANY (ARRAY[
    -- 11 legacy actions
    'document.upload', 'document.delete', 'search.query', 'code.execute', 'skill.load',
    'thread.create', 'thread.delete', 'settings.update', 'memory.remember', 'memory.recall', 'feedback.submit',
    -- 8 DM actions (Phase 110 / Migration 071)
    'view.create', 'view.delete', 'relationship.create', 'relationship.delete',
    'classification.apply', 'classification.rule.create', 'metadata.update', 'metadata.field.create',
    -- 2 Connector actions (Phase 223 / GRANT-05 / SC#1 / SC#1a)
    'connector.call', 'connector.grant'
  ]::text[]));

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS active_connector_ids jsonb DEFAULT NULL;

COMMENT ON COLUMN public.messages.active_connector_ids IS
  'Phase 223 (BUG-260902-03 / D-223-06): Array of armed connector UUIDs active when message was sent. NULL means absent/legacy; ''[]''::jsonb means explicitly cleared/none.';

-- Migration 186 — Phase 258 (TIER-01 / TIER-02 / TIER-05)
-- Table: public.tier_capabilities
-- Relational capability map per subscription tier.
-- Moving a capability between tiers is a row change (INSERT/UPDATE/DELETE) with zero code edits and zero deploys.

CREATE TABLE IF NOT EXISTS public.tier_capabilities (
    tier text NOT NULL,
    capability text NOT NULL,
    enabled boolean NOT NULL DEFAULT true,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tier, capability)
);

COMMENT ON TABLE public.tier_capabilities IS 'Relational capability matrix declaring which functional capabilities belong to each subscription tier (TIER-02, Phase 258).';
COMMENT ON COLUMN public.tier_capabilities.tier IS 'Subscription tier slug (e.g. standard, pro, enterprise).';
COMMENT ON COLUMN public.tier_capabilities.capability IS 'Functional capability slug (e.g. basic_rag, chat, skills, code_execution, custom_models, workflows, connectors, experts, audit_export).';
COMMENT ON COLUMN public.tier_capabilities.enabled IS 'Whether this capability is currently active for this tier.';
COMMENT ON COLUMN public.tier_capabilities.metadata IS 'Optional configuration or entitlement parameters for this capability in this tier.';
COMMENT ON COLUMN public.tier_capabilities.created_at IS 'Timestamp when the tier-capability mapping was created.';

CREATE INDEX IF NOT EXISTS idx_tier_capabilities_lookup
    ON public.tier_capabilities (tier, capability)
    WHERE enabled = true;

-- Enable Row Level Security
ALTER TABLE public.tier_capabilities ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT ON TABLE public.tier_capabilities TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON TABLE public.tier_capabilities TO service_role;

-- RLS Policies
DROP POLICY IF EXISTS "tier_capabilities_read_all" ON public.tier_capabilities;
CREATE POLICY "tier_capabilities_read_all"
    ON public.tier_capabilities
    FOR SELECT
    TO anon, authenticated, service_role
    USING (true);

DROP POLICY IF EXISTS "tier_capabilities_service_write" ON public.tier_capabilities;
CREATE POLICY "tier_capabilities_service_write"
    ON public.tier_capabilities
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Seed Initial Capability Roster (D-258-07)
-- standard: basic_rag, chat
-- pro: basic_rag, chat, skills, code_execution, custom_models
-- enterprise: all above + workflows, connectors, experts, audit_export

INSERT INTO public.tier_capabilities (tier, capability, enabled) VALUES
    -- Standard tier
    ('standard', 'basic_rag', true),
    ('standard', 'chat', true),
    -- Pro tier
    ('pro', 'basic_rag', true),
    ('pro', 'chat', true),
    ('pro', 'skills', true),
    ('pro', 'code_execution', true),
    ('pro', 'custom_models', true),
    -- Enterprise tier
    ('enterprise', 'basic_rag', true),
    ('enterprise', 'chat', true),
    ('enterprise', 'skills', true),
    ('enterprise', 'code_execution', true),
    ('enterprise', 'custom_models', true),
    ('enterprise', 'workflows', true),
    ('enterprise', 'connectors', true),
    ('enterprise', 'experts', true),
    ('enterprise', 'audit_export', true)
ON CONFLICT (tier, capability) DO UPDATE
SET enabled = EXCLUDED.enabled,
    metadata = EXCLUDED.metadata;

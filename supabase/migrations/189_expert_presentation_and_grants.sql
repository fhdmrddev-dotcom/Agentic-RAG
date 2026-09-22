-- Migration 189 — Phase 261 (PACK-07 / PACK-08 / PACK-10 / D-261-01 / D-261-07)
-- Expert presentation attributes, granular access grants, and data-driven authoring permissions.

-- 1. Extend public.expert_bundles with presentation metadata and tool floor configuration
ALTER TABLE public.expert_bundles ADD COLUMN IF NOT EXISTS icon text NOT NULL DEFAULT 'chart';
ALTER TABLE public.expert_bundles ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'General';
ALTER TABLE public.expert_bundles ADD COLUMN IF NOT EXISTS when_to_use text NOT NULL DEFAULT '';
ALTER TABLE public.expert_bundles ADD COLUMN IF NOT EXISTS example_output text NOT NULL DEFAULT '';
ALTER TABLE public.expert_bundles ADD COLUMN IF NOT EXISTS tool_floor_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.expert_bundles.icon IS 'Lucide vector glyph name for visual card presentation (e.g. chart, scale, shield, briefcase).';
COMMENT ON COLUMN public.expert_bundles.category IS 'Domain category label for catalog filtering and visual organization.';
COMMENT ON COLUMN public.expert_bundles.when_to_use IS 'Short one-line contextual guidance on when to consult this expert.';
COMMENT ON COLUMN public.expert_bundles.example_output IS 'Sample output or answer snippet showing expected deliverable format.';
COMMENT ON COLUMN public.expert_bundles.tool_floor_enabled IS 'When true, deliverable-producing tools (code execution, file writing, templates, questions) are preserved as an additive floor.';

-- 2. Extend visibility check constraint to include 'granted' (PACK-10)
ALTER TABLE public.expert_bundles DROP CONSTRAINT IF EXISTS expert_bundles_visibility_check;
ALTER TABLE public.expert_bundles ADD CONSTRAINT expert_bundles_visibility_check CHECK (visibility IN ('private', 'org', 'public', 'granted'));

-- 3. Create public.expert_grants table for granular role/user targeting (PACK-10)
CREATE TABLE IF NOT EXISTS public.expert_grants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    expert_id uuid NOT NULL REFERENCES public.expert_bundles(id) ON DELETE CASCADE,
    grantee_type text NOT NULL CHECK (grantee_type IN ('user', 'role')),
    grantee_id text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_expert_grant UNIQUE (expert_id, grantee_type, grantee_id)
);

COMMENT ON TABLE public.expert_grants IS 'Granular role and user access grants for granted expert bundles (PACK-10, Phase 261).';
COMMENT ON COLUMN public.expert_grants.id IS 'Primary key UUID of the grant.';
COMMENT ON COLUMN public.expert_grants.expert_id IS 'Foreign key referencing the target expert bundle.';
COMMENT ON COLUMN public.expert_grants.grantee_type IS 'Grantee category: user (specific user UUID) or role (role slug such as member, org-admin, or custom role).';
COMMENT ON COLUMN public.expert_grants.grantee_id IS 'Identifier string of the grantee (user UUID string or role slug).';
COMMENT ON COLUMN public.expert_grants.created_at IS 'Timestamp when the grant was issued.';

-- Indexes for grant evaluation
CREATE INDEX IF NOT EXISTS idx_expert_grants_lookup ON public.expert_grants (grantee_type, grantee_id, expert_id);
CREATE INDEX IF NOT EXISTS idx_expert_grants_expert ON public.expert_grants (expert_id);

-- Enable Row Level Security on expert_grants
ALTER TABLE public.expert_grants ENABLE ROW LEVEL SECURITY;

-- Table Grants: authenticated and service_role only (NO anon grants, per project security policy)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.expert_grants TO authenticated, service_role;

-- RLS Read Policy: service role or members of the organization that owns the expert
DROP POLICY IF EXISTS "expert_grants_read_policy" ON public.expert_grants;
CREATE POLICY "expert_grants_read_policy"
    ON public.expert_grants
    FOR SELECT
    TO authenticated, service_role
    USING (
        auth.role() = 'service_role'
        OR expert_id IN (
            SELECT eb.id
            FROM public.expert_bundles eb
            JOIN public.org_members m ON m.org_id = eb.org_id
            WHERE m.user_id = auth.uid()
        )
    );

-- RLS Write Policy: service role or members of the organization that owns the expert
DROP POLICY IF EXISTS "expert_grants_write_policy" ON public.expert_grants;
CREATE POLICY "expert_grants_write_policy"
    ON public.expert_grants
    FOR ALL
    TO authenticated, service_role
    USING (
        auth.role() = 'service_role'
        OR expert_id IN (
            SELECT eb.id
            FROM public.expert_bundles eb
            JOIN public.org_members m ON m.org_id = eb.org_id
            WHERE m.user_id = auth.uid()
        )
    )
    WITH CHECK (
        auth.role() = 'service_role'
        OR expert_id IN (
            SELECT eb.id
            FROM public.expert_bundles eb
            JOIN public.org_members m ON m.org_id = eb.org_id
            WHERE m.user_id = auth.uid()
        )
    );

-- 4. Seed data-driven authoring permission into public.role_permissions (PACK-08)
INSERT INTO public.role_permissions (role, permission_key) VALUES
    ('super-admin', 'experts:manage'),
    ('org-admin', 'experts:manage')
ON CONFLICT (role, permission_key) DO NOTHING;

-- 5. Backfill first-party Financial Analyzer template with presentation fields
UPDATE public.expert_bundles
SET icon = 'chart',
    category = 'Finance',
    when_to_use = 'When evaluating 10-K filings, earnings releases, and balance sheets.',
    example_output = 'EBITDA Margin: 24.3% (+180 bps YoY)' || E'\n' || 'Operating Cash Flow: $412M' || E'\n' || 'Key Risks: Regulatory delays in EMEA, foreign exchange drag.'
WHERE slug = 'financial-analyzer' AND is_system = true;

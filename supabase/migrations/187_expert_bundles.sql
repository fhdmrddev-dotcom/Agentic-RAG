-- Migration 187 — Phase 259 (PACK-01 / D-259-03 / D-259-07 / D-259-08)
-- Table: public.expert_bundles
-- An Expert is a bundle over four subsystems (skills, connections, folders, prompts),
-- stored as pure data with no runtime or execution loop of its own.

CREATE TABLE IF NOT EXISTS public.expert_bundles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text NOT NULL DEFAULT '',
    scope_mode text NOT NULL DEFAULT 'restricted' CHECK (scope_mode IN ('restricted', 'biased')),
    member_skills text[] NOT NULL DEFAULT '{}',
    required_connections text[] NOT NULL DEFAULT '{}',
    knowledge_folder_ids uuid[] NOT NULL DEFAULT '{}',
    prompt_suggestions jsonb NOT NULL DEFAULT '[]'::jsonb,
    visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'org', 'public')),
    is_system boolean NOT NULL DEFAULT false,
    is_enabled boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT check_org_or_system CHECK (is_system = true OR org_id IS NOT NULL)
);

COMMENT ON TABLE public.expert_bundles IS 'Domain expert bundles over skills, connections, folders, and prompts (PACK-01, Phase 259). Data manifest only, zero execution path.';
COMMENT ON COLUMN public.expert_bundles.id IS 'Primary key UUID of the expert bundle.';
COMMENT ON COLUMN public.expert_bundles.org_id IS 'Tenant organization that owns this bundle, or NULL for system bundles.';
COMMENT ON COLUMN public.expert_bundles.created_by IS 'User UUID who created the bundle (or system user 00000000-0000-0000-0000-000000000001 for system templates).';
COMMENT ON COLUMN public.expert_bundles.name IS 'Display name of the expert bundle.';
COMMENT ON COLUMN public.expert_bundles.slug IS 'URL-safe identifier, unique per org or globally unique for system bundles.';
COMMENT ON COLUMN public.expert_bundles.description IS 'Detailed description of the expert capabilities.';
COMMENT ON COLUMN public.expert_bundles.scope_mode IS 'Scope semantics: restricted (strict hard ceiling) or biased (soft priority). Defaults to restricted.';
COMMENT ON COLUMN public.expert_bundles.member_skills IS 'List of skill names/slugs included in this expert bundle.';
COMMENT ON COLUMN public.expert_bundles.required_connections IS 'List of connector types/slugs required by this expert bundle.';
COMMENT ON COLUMN public.expert_bundles.knowledge_folder_ids IS 'List of folder UUIDs bounding the knowledge scope for this expert bundle.';
COMMENT ON COLUMN public.expert_bundles.prompt_suggestions IS 'JSON array of starter prompt suggestions [{title, prompt}].';
COMMENT ON COLUMN public.expert_bundles.visibility IS 'Sharing scope: private (creator only), org (organization members), public (all users).';
COMMENT ON COLUMN public.expert_bundles.is_system IS 'True if this is a first-party built-in template/seed, False for tenant-authored bundles.';
COMMENT ON COLUMN public.expert_bundles.is_enabled IS 'Administrative toggle to activate or deactivate this bundle.';

-- Partial Unique Indexes (D-259-03)
-- System bundles have unique slug globally; custom tenant bundles have unique slug per org_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_expert_bundles_system_slug
    ON public.expert_bundles (slug)
    WHERE is_system = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_expert_bundles_org_slug
    ON public.expert_bundles (org_id, slug)
    WHERE is_system = false;

CREATE INDEX IF NOT EXISTS idx_expert_bundles_org_enabled
    ON public.expert_bundles (org_id, is_enabled);

CREATE INDEX IF NOT EXISTS idx_expert_bundles_system_enabled
    ON public.expert_bundles (is_enabled)
    WHERE is_system = true;

-- Enable Row Level Security
ALTER TABLE public.expert_bundles ENABLE ROW LEVEL SECURITY;

-- Table Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.expert_bundles TO authenticated, service_role;

-- RLS Policies
DROP POLICY IF EXISTS "expert_bundles_read_policy" ON public.expert_bundles;
CREATE POLICY "expert_bundles_read_policy"
    ON public.expert_bundles
    FOR SELECT
    TO authenticated, service_role
    USING (
        auth.role() = 'service_role'
        OR is_system = true
        OR (
            org_id IN (
                SELECT m.org_id
                FROM public.org_members m
                WHERE m.user_id = auth.uid()
            )
            AND (visibility IN ('org', 'public') OR created_by = auth.uid())
        )
    );

DROP POLICY IF EXISTS "expert_bundles_write_policy" ON public.expert_bundles;
CREATE POLICY "expert_bundles_write_policy"
    ON public.expert_bundles
    FOR ALL
    TO authenticated, service_role
    USING (
        auth.role() = 'service_role'
        OR (
            is_system = false
            AND org_id IN (
                SELECT m.org_id
                FROM public.org_members m
                WHERE m.user_id = auth.uid()
            )
        )
    )
    WITH CHECK (
        auth.role() = 'service_role'
        OR (
            is_system = false
            AND org_id IN (
                SELECT m.org_id
                FROM public.org_members m
                WHERE m.user_id = auth.uid()
            )
        )
    );

-- Seed First-Party Financial Analyzer (D-259-07, PACK-01, PACK-05)
INSERT INTO public.expert_bundles (
    id,
    org_id,
    created_by,
    name,
    slug,
    description,
    scope_mode,
    member_skills,
    required_connections,
    knowledge_folder_ids,
    prompt_suggestions,
    visibility,
    is_system,
    is_enabled
) VALUES (
    '00000000-0000-0000-0000-000000000259'::uuid,
    NULL,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Financial Analyzer',
    'financial-analyzer',
    'Analyze balance sheets, P&L statements, 10-K filings, and financial metrics. Answers strictly from uploaded documents or refuses.',
    'restricted',
    '{}'::text[],
    '{}'::text[],
    '{}'::uuid[],
    '[
        {
            "title": "Summarize 10-K Risks",
            "prompt": "Extract and synthesize the top 3 risk factors disclosed in the latest 10-K filing with direct citations."
        },
        {
            "title": "Calculate EBITDA & Margin",
            "prompt": "Calculate the EBITDA and EBITDA margin from the income statement, showing all intermediate arithmetic."
        },
        {
            "title": "Compare Quarterly Revenue",
            "prompt": "Provide a quarter-over-quarter revenue comparison table based strictly on reported earnings releases."
        }
    ]'::jsonb,
    'public',
    true,
    true
)
ON CONFLICT (slug) WHERE is_system = true DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    scope_mode = EXCLUDED.scope_mode,
    prompt_suggestions = EXCLUDED.prompt_suggestions,
    visibility = EXCLUDED.visibility,
    is_enabled = EXCLUDED.is_enabled,
    updated_at = now();

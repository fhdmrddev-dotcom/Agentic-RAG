-- Migration 183 — Phase 257 (METER-01 / D-257-01 / D-257-02 / D-257-03 / D-257-04)
-- Effective-dated per-model rate registry for token-to-USD pricing.
--
-- RATES STORED AS USD PER 1,000,000 TOKENS USING numeric(12, 6) (D-257-01).
--   Both input_cost_per_million and output_cost_per_million are stored as numeric(12, 6).
--   Directly mirrors provider pricing sheets ($0.14/1M, $2.50/1M, $15.00/1M) without
--   floating-point rounding or integer micro-dollar conversion traps.
--
-- COMPOUND LOOKUP KEY & APPEND-ONLY REPRICING (D-257-02, D-257-03).
--   Resolved by (model_id, provider, effective_from DESC) with fallback to
--   (model_id, NULL, effective_from DESC). Repricing is strictly append-only;
--   past runs price against effective_from <= run.created_at and remain immutable.
--
-- UNRATED MODELS ARE NEVER $0.00 (D-257-05).
--   Models with no entry in model_rates yield NULL cost, never 0.00.
--   Secondary/local models are deliberately left unseeded to exercise the unrated path.

CREATE TABLE IF NOT EXISTS public.model_rates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id text NOT NULL,
    provider text,
    input_cost_per_million numeric(12, 6) NOT NULL,
    output_cost_per_million numeric(12, 6) NOT NULL,
    effective_from timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_model_rates_lookup
    ON public.model_rates (model_id, provider, effective_from DESC);

CREATE INDEX IF NOT EXISTS idx_model_rates_fallback
    ON public.model_rates (model_id, effective_from DESC)
    WHERE provider IS NULL;

CREATE INDEX IF NOT EXISTS idx_model_rates_org
    ON public.model_rates (org_id, model_id, effective_from DESC);

ALTER TABLE public.model_rates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Authenticated users and service role can read model rates (global or org-specific)
CREATE POLICY model_rates_select_policy ON public.model_rates
    FOR SELECT
    TO authenticated, service_role
    USING (org_id IS NULL OR org_id IN (
        SELECT m.org_id FROM public.org_members m WHERE m.user_id = auth.uid()
    ));

-- Only org admins or service_role can insert new rates
CREATE POLICY model_rates_insert_policy ON public.model_rates
    FOR INSERT
    TO authenticated, service_role
    WITH CHECK (
        auth.role() = 'service_role' OR (
            org_id IS NOT NULL AND org_id IN (
                SELECT m.org_id FROM public.org_members m
                WHERE m.user_id = auth.uid() AND m.role IN ('admin', 'owner')
            )
        )
    );

-- Comments
COMMENT ON TABLE public.model_rates IS
    'Phase 257 (METER-01). Effective-dated token cost rate registry in USD per 1M tokens.';
COMMENT ON COLUMN public.model_rates.input_cost_per_million IS
    'Cost in USD per 1,000,000 input prompt tokens (numeric(12, 6)).';
COMMENT ON COLUMN public.model_rates.output_cost_per_million IS
    'Cost in USD per 1,000,000 output completion tokens (numeric(12, 6)).';
COMMENT ON COLUMN public.model_rates.effective_from IS
    'Timestamp from which this rate applies. Past runs match effective_from <= run.created_at.';

-- Seed primary models (D-257-04)
INSERT INTO public.model_rates (model_id, provider, input_cost_per_million, output_cost_per_million, effective_from)
VALUES
    ('gpt-4o', 'openai', 2.500000, 10.000000, '2024-01-01 00:00:00+00'),
    ('gpt-4o-mini', 'openai', 0.150000, 0.600000, '2024-01-01 00:00:00+00'),
    ('claude-3-5-sonnet-20241022', 'anthropic', 3.000000, 15.000000, '2024-01-01 00:00:00+00'),
    ('deepseek-chat', 'deepseek', 0.140000, 0.280000, '2024-01-01 00:00:00+00'),
    ('gemini-1.5-flash', 'google', 0.075000, 0.300000, '2024-01-01 00:00:00+00')
ON CONFLICT DO NOTHING;

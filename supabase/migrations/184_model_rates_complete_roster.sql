-- Migration 184 — Phase 257.1 (METER-01 / ROADMAP SC#1)
-- Completes the effective-dated rate registry, and makes it IDEMPOTENT.
--
-- ============================================================================
-- WHY THIS EXISTS — measured, not assumed.
-- ============================================================================
-- Migration 183 seeded FIVE rates. Driven against the live dev DB on 2026-09-19
-- (org 22f9c615, 1,595 real runs):
--
--     total_spend_usd 0.2666 | rated_runs 20 | unrated_runs 1163 | 78 models seen
--
-- 78 distinct models appear in real runs and EXACTLY ONE (`gpt-4o`) had a rate.
-- 98.3% of runs read as unrated, so ROADMAP SC#1 — "every model the product can
-- run has an input and output rate with an effective date" — was measurably FALSE,
-- and Phase 258 is blocked by its own dependency line ("nothing is priceable until
-- cost is attributable").
--
-- ⚠ 183's roster was hand-typed. Two of its five seeds are for models the product
-- CANNOT run: `deepseek-chat` and `gemini-1.5-flash` are absent from
-- MODEL_CAPABILITIES, and so is `claude-3-5-sonnet-20241022`. They are left in place
-- (inert, no runs reference them) rather than deleted, so 183 stays re-readable.
-- ⭐ 183's two OpenAI rates were CORRECT (gpt-4o 2.50/10.00, gpt-4o-mini 0.15/0.60);
-- the defect was COVERAGE, not accuracy.
--
-- ============================================================================
-- WHERE THESE NUMBERS COME FROM — provider docs, fetched 2026-09-19. Not guessed.
-- ============================================================================
--   OpenAI     developers.openai.com/api/docs/pricing            17/17 models
--   Anthropic  platform.claude.com/docs/en/about-claude/pricing   7/7
--   Google     ai.google.dev/gemini-api/docs/pricing              8/8
--   DeepSeek   api-docs.deepseek.com/quick_start/pricing          2/2
--   MiniMax    platform.minimax.io/docs/guides/pricing-paygo      8/8
--   Zhipu      docs.z.ai/guides/overview/pricing                  7/7
--   Moonshot   platform.kimi.ai/docs/pricing/chat                 1/3
--
-- ⛔ FOUR HONEST CAVEATS, RECORDED RATHER THAN SMOOTHED OVER:
--
-- 1. RETROACTIVE PRICING. effective_from is '2024-01-01' so the 1,595 historical
--    runs become priceable at all. These are TODAY'S published prices applied
--    backwards; they are NOT what was actually paid at the time. Any real reprice
--    from here adds a correctly-dated row, so the approximation is bounded to runs
--    before 2026-09-19 and shrinks to nothing going forward.
--
-- 2. DEEPSEEK HAS PEAK/OFF-PEAK PRICING (off-peak = 50% of peak) and this table has
--    no time-of-day dimension. PEAK is seeded, so spend is never UNDER-stated.
--    Off-peak would be: deepseek-v4-flash 0.15/0.60, deepseek-v4-pro 0.66/1.98.
--    `deepseek-v4-flash` is a legacy alias that routes to DeepSeek-V4.1-Flash.
--
-- 3. MINIMAX-M3 carries a "permanent 50% off" promotion. The DISCOUNTED rate is
--    seeded (0.30/1.20) because that is what is actually billed; list is 0.60/2.40.
--    If the promotion ends, that is a reprice — a new row, not an edit.
--
-- 4. GOOGLE + OPENAI long-context tiers exist; the STANDARD/lowest tier is seeded.
--    A long-context run is therefore priced at a LOWER bound, not an exact figure.
--
-- ⛔ DELIBERATELY LEFT UNRATED, AND NAMED SO THE GAP IS VISIBLE RATHER THAN SILENT:
--    • All 9 `openrouter` models. An OpenRouter price depends on which upstream
--      provider serves the request, so a single row would be a fiction. The product
--      already renders these honestly as "Unrated" (SC#2 holds).
--    • `kimi-k2.5`, `moonshot-v1-8k` — not on Moonshot's current pricing page
--      (retired). Inventing a number for a retired model is the exact failure this
--      phase exists to prevent.
--
-- ⚠ `gemini-3.6-flash` IS seeded: it appears in 24 real runs but is ABSENT from
--    MODEL_CAPABILITIES. That registry gap is real and is recorded in 257-REVIEW.md.

-- ============================================================================
-- PART 1 — IDEMPOTENCY. Migration 183 reads as re-runnable and is not.
-- ============================================================================
-- 183 ends with `ON CONFLICT DO NOTHING` but defines NO unique constraint, so the
-- only arbiter is a random uuid PK, which never conflicts. DRIVEN on the live DB:
-- re-running one seed line took `gpt-4o` from 1 row to 2. Duplicate rates also make
-- "which rate resolves" arbitrary, because resolution orders by effective_from.
-- This project applies migrations by HAND-PASTING into the SQL editor, so a double
-- paste is the normal failure mode, not an exotic one.
--
-- COALESCE(provider,'') is load-bearing: in Postgres NULLs are DISTINCT, so a plain
-- UNIQUE(model_id, provider, effective_from) would not dedupe provider-NULL rows.
CREATE UNIQUE INDEX IF NOT EXISTS uq_model_rates_identity
    ON public.model_rates (model_id, COALESCE(provider, ''), effective_from);

COMMENT ON INDEX public.uq_model_rates_identity IS
    'Phase 257.1. Makes ON CONFLICT DO NOTHING actually fire. Migration 183 had no '
    'unique constraint, so re-pasting it duplicated every seed rate (driven: gpt-4o 1 -> 2).';

-- ============================================================================
-- PART 2 — THE ROSTER, derived from MODEL_CAPABILITIES rather than re-typed.
-- ============================================================================
INSERT INTO public.model_rates
    (model_id, provider, input_cost_per_million, output_cost_per_million, effective_from)
VALUES
    -- ── OpenAI (17) ──────────────────────────────────────────────────────────
    ('gpt-5.6-luna',               'openai',    0.200000,   1.200000, '2024-01-01 00:00:00+00'),
    ('gpt-5.6-sol',                'openai',    4.000000,  20.000000, '2024-01-01 00:00:00+00'),
    ('gpt-5.6-terra',              'openai',    2.000000,  12.000000, '2024-01-01 00:00:00+00'),
    ('gpt-5.5',                    'openai',    5.000000,  30.000000, '2024-01-01 00:00:00+00'),
    ('gpt-5.5-pro',                'openai',   30.000000, 180.000000, '2024-01-01 00:00:00+00'),
    ('gpt-5.4',                    'openai',    2.500000,  15.000000, '2024-01-01 00:00:00+00'),
    ('gpt-5.4-mini',               'openai',    0.750000,   4.500000, '2024-01-01 00:00:00+00'),
    ('gpt-5.4-nano',               'openai',    0.200000,   1.250000, '2024-01-01 00:00:00+00'),
    ('gpt-5.4-pro',                'openai',   30.000000, 180.000000, '2024-01-01 00:00:00+00'),
    ('gpt-5.2',                    'openai',    1.750000,  14.000000, '2024-01-01 00:00:00+00'),
    ('gpt-5',                      'openai',    1.250000,  10.000000, '2024-01-01 00:00:00+00'),
    ('gpt-4.1',                    'openai',    2.000000,   8.000000, '2024-01-01 00:00:00+00'),
    ('gpt-4.1-mini',               'openai',    0.400000,   1.600000, '2024-01-01 00:00:00+00'),
    ('gpt-4.1-nano',               'openai',    0.100000,   0.400000, '2024-01-01 00:00:00+00'),
    ('gpt-4o',                     'openai',    2.500000,  10.000000, '2024-01-01 00:00:00+00'),
    ('gpt-4o-mini',                'openai',    0.150000,   0.600000, '2024-01-01 00:00:00+00'),
    ('o1',                         'openai',   15.000000,  60.000000, '2024-01-01 00:00:00+00'),

    -- ── Anthropic (7) ────────────────────────────────────────────────────────
    ('claude-opus-4-6',            'anthropic', 5.000000,  25.000000, '2024-01-01 00:00:00+00'),
    ('claude-opus-4-7',            'anthropic', 5.000000,  25.000000, '2024-01-01 00:00:00+00'),
    ('claude-opus-4-8',            'anthropic', 5.000000,  25.000000, '2024-01-01 00:00:00+00'),
    ('claude-sonnet-4-5-20250929', 'anthropic', 3.000000,  15.000000, '2024-01-01 00:00:00+00'),
    ('claude-sonnet-4-6',          'anthropic', 3.000000,  15.000000, '2024-01-01 00:00:00+00'),
    ('claude-sonnet-5',            'anthropic', 2.000000,  10.000000, '2024-01-01 00:00:00+00'),
    ('claude-haiku-4-5-20251001',  'anthropic', 1.000000,   5.000000, '2024-01-01 00:00:00+00'),

    -- ── Google (8 — includes gemini-3.6-flash, in runs but absent from the registry)
    ('gemini-2.5-flash',           'google',    0.300000,   2.500000, '2024-01-01 00:00:00+00'),
    ('gemini-2.5-flash-lite',      'google',    0.100000,   0.400000, '2024-01-01 00:00:00+00'),
    ('gemini-2.5-pro',             'google',    1.250000,  10.000000, '2024-01-01 00:00:00+00'),
    ('gemini-3.1-flash-lite',      'google',    0.250000,   1.500000, '2024-01-01 00:00:00+00'),
    ('gemini-3.1-pro-preview',     'google',    2.000000,  12.000000, '2024-01-01 00:00:00+00'),
    ('gemini-3.5-flash',           'google',    1.500000,   9.000000, '2024-01-01 00:00:00+00'),
    ('gemini-3-flash-preview',     'google',    0.500000,   3.000000, '2024-01-01 00:00:00+00'),
    ('gemini-3.6-flash',           'google',    0.750000,   3.750000, '2024-01-01 00:00:00+00'),

    -- ── DeepSeek (2 — PEAK rates; off-peak is 50%, see caveat 2) ─────────────
    ('deepseek-v4-flash',          'deepseek',  0.300000,   1.200000, '2024-01-01 00:00:00+00'),
    ('deepseek-v4-pro',            'deepseek',  1.320000,   3.960000, '2024-01-01 00:00:00+00'),

    -- ── MiniMax (8 — M3 at the standing 50%-off rate, see caveat 3) ──────────
    ('MiniMax-M2',                 'minimax',   0.300000,   1.200000, '2024-01-01 00:00:00+00'),
    ('MiniMax-M2.1',               'minimax',   0.300000,   1.200000, '2024-01-01 00:00:00+00'),
    ('MiniMax-M2.1-highspeed',     'minimax',   0.600000,   2.400000, '2024-01-01 00:00:00+00'),
    ('MiniMax-M2.5',               'minimax',   0.300000,   1.200000, '2024-01-01 00:00:00+00'),
    ('MiniMax-M2.5-highspeed',     'minimax',   0.600000,   2.400000, '2024-01-01 00:00:00+00'),
    ('MiniMax-M2.7',               'minimax',   0.300000,   1.200000, '2024-01-01 00:00:00+00'),
    ('MiniMax-M2.7-highspeed',     'minimax',   0.600000,   2.400000, '2024-01-01 00:00:00+00'),
    ('MiniMax-M3',                 'minimax',   0.300000,   1.200000, '2024-01-01 00:00:00+00'),

    -- ── Zhipu / GLM (7) ──────────────────────────────────────────────────────
    ('glm-4.5',                    'zhipu',     0.600000,   2.200000, '2024-01-01 00:00:00+00'),
    ('glm-4.5-air',                'zhipu',     0.200000,   1.100000, '2024-01-01 00:00:00+00'),
    ('glm-4.6',                    'zhipu',     0.600000,   2.200000, '2024-01-01 00:00:00+00'),
    ('glm-4.7',                    'zhipu',     0.600000,   2.200000, '2024-01-01 00:00:00+00'),
    ('glm-5',                      'zhipu',     1.000000,   3.200000, '2024-01-01 00:00:00+00'),
    ('glm-5.1',                    'zhipu',     1.400000,   4.400000, '2024-01-01 00:00:00+00'),
    ('glm-5.2',                    'zhipu',     1.400000,   4.400000, '2024-01-01 00:00:00+00'),

    -- ── Moonshot / Kimi (1 of 3 — k2.5 and moonshot-v1-8k are retired, see above)
    ('kimi-k2.6',                  'moonshot',  0.950000,   4.000000, '2024-01-01 00:00:00+00')

ON CONFLICT (model_id, COALESCE(provider, ''), effective_from) DO NOTHING;

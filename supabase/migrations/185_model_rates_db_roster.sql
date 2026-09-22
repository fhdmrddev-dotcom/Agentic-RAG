-- Migration 185 — Phase 257 (METER-01 / ROADMAP SC#1)
-- Prices the six first-party models that live ONLY in `model_capabilities_overrides`.
--
-- ============================================================================
-- WHY THIS EXISTS — measured on the live dev DB 2026-09-19, not assumed.
-- ============================================================================
-- Migration 184 completed the roster that `MODEL_CAPABILITIES` declares. Measured
-- after it: all 61 models in that dict are either rated or exempt with a written
-- reason. SC#1 looked closed.
--
-- ⛔ IT WAS NOT, AND THE FENCE COULD NOT SEE WHY. The product's real roster is
-- `MODEL_CAPABILITIES` (61, in code) UNION `model_capabilities_overrides`
-- (51, in the DATABASE) = 82 models. `test_257_1_every_model_has_a_rate.py` reads
-- the code half via `ast` and is deliberately STATIC — a test that needs Postgres
-- SKIPS in CI, and a skip reads as "not failing". So the DB half was invisible to
-- it, and every one of the 20 unpriced models was `db-only`:
--
--     lmstudio    6 models   47 real runs     self-hosted
--     openrouter  7 models    8 real runs     a router
--     zhipu       2 models    3 real runs  <- priced here
--     google      2 models    1 real run   <- priced here
--     anthropic   1 model     2 real runs  <- priced here
--     moonshot    1 model     5 real runs  <- priced here
--     ollama      1 model     0 real runs     self-hosted, disabled
--
-- The 14 self-hosted and OpenRouter ids are NOT priced here. They are added to
-- `UNRATED_BY_DESIGN` in the fence WITH their reasons, because neither class can
-- carry an honest single rate — see that file.
--
-- ============================================================================
-- WHERE THESE SIX NUMBERS COME FROM — each vendor's own page, fetched 2026-09-19.
-- ============================================================================
--   claude-opus-5      $5.00 / $25.00   platform.claude.com/docs/en/about-claude/pricing
--   gemini-3.7-flash   $0.75 / $3.75    ai.google.dev/gemini-api/docs/pricing
--   gemini-3.8-flash   $0.75 / $3.75    ai.google.dev/gemini-api/docs/pricing
--   kimi-k3            $3.00 / $15.00   platform.kimi.ai/docs/pricing/chat
--   glm-5.3            $1.40 / $4.40    docs.z.ai/guides/overview/pricing
--   glm-5.3-flash      $0.15 / $0.50    docs.z.ai/guides/overview/pricing
--
-- Approved by the operator on 2026-09-19 before this file was written. Prices are
-- a one-way door (TIER-02); a reviewer does not choose them.
--
-- ⛔ THREE CAVEATS, RECORDED RATHER THAN SMOOTHED OVER (184's convention):
--
-- 1. BOTH GEMINI FLASH RATES ARE PROMOTIONAL. $0.75/$3.75 holds through
--    2026-12-31 and then DOUBLES to $1.50/$7.50 on 2027-01-01. The billed rate is
--    seeded, never the future one — under-stating spend is the failure this phase
--    exists to prevent. A second effective-dated row is DUE on 2027-01-01; the
--    append-only design handles it natively, so this is a calendar obligation and
--    not a schema problem. ⚠ Nothing in the product will remind anyone.
--
-- 2. `claude-opus-5` HAS A FAST-MODE TIER AT $10/$50 — 2x input and 2x output.
--    No column distinguishes a fast-mode run, so such a run prices as a LOWER
--    BOUND. Same shape as 184's long-context caveat.
--
-- 3. RETROACTIVE FROM 2024-01-01, as 184 did, so historical runs price at all.
--    These are today's published prices applied backwards; they are NOT what was
--    actually paid at the time.
--
-- ⛔ IDEMPOTENT. 184 added `uq_model_rates_identity` because 183 had none and a
-- second paste duplicated every seed. This file relies on it.
-- ============================================================================

INSERT INTO public.model_rates
    (model_id, provider, input_cost_per_million, output_cost_per_million, effective_from)
VALUES
    ('claude-opus-5',    'anthropic', 5.000000, 25.000000, '2024-01-01 00:00:00+00'),
    ('gemini-3.7-flash', 'google',    0.750000,  3.750000, '2024-01-01 00:00:00+00'),
    ('gemini-3.8-flash', 'google',    0.750000,  3.750000, '2024-01-01 00:00:00+00'),
    ('kimi-k3',          'moonshot',  3.000000, 15.000000, '2024-01-01 00:00:00+00'),
    ('glm-5.3',          'zhipu',     1.400000,  4.400000, '2024-01-01 00:00:00+00'),
    ('glm-5.3-flash',    'zhipu',     0.150000,  0.500000, '2024-01-01 00:00:00+00')
-- ⛔ EXPRESSION INFERENCE, not ON CONSTRAINT. `uq_model_rates_identity` is a unique
-- INDEX, not a named constraint, so `ON CONFLICT ON CONSTRAINT` raises
-- UndefinedObjectError and the whole migration fails on paste. Driven, not assumed —
-- the first draft of this file used the constraint form and died in a rolled-back
-- transaction. COALESCE(provider,'') must match the index expression exactly.
ON CONFLICT (model_id, COALESCE(provider, ''), effective_from) DO NOTHING;

COMMENT ON TABLE public.model_rates IS
    'Effective-dated token prices. Append-only: a past run is priced by the row in '
    'force at its started_at, so repricing never rewrites history (METER-01). '
    'Seeded by migrations 183 (5 rows), 184 (48, the MODEL_CAPABILITIES roster) and '
    '185 (6, the model_capabilities_overrides roster). NOTE: no effective_to column '
    'exists yet - see SEED for phase 186 (void and end-date a rate from the product).';

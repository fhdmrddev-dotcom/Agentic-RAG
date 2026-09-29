# Phase 257: Cost in Dollars, and What It Cannot See - Context

**Gathered:** 2026-09-19
**Status:** Ready for planning

<domain>
## Phase Boundary

An operator can read spend **in dollars** per run and per org, through exactly one conversion, and the view states its own blind spots — so the first number anyone quotes is one that says what it does not include.

### In Scope
- **Migration 183**: Effective-dated rate registry table (`model_rates`) with compound key `(model_id, provider, effective_from)`.
- **METER-01**: Rates stored as USD per 1M tokens in `numeric(12, 6)`; models with no rate read as `Unrated` and never `$0.00`.
- **METER-02**: Exactly one token-to-USD conversion home (`backend/app/services/pricing_service.py`), enforced by an AST fence (`test_257_single_token_conversion_home.py`) driven RED against a planted duplicate.
- **METER-07**: Dedicated `/admin/spend` route (Admin → Spend & Metering) displaying org totals, run-level breakdown, and the "What This View Cannot See" honesty summary card.
- **Run-level Cost Affordances**: Displaying run cost on `WorkflowRunPage` and `RunCard` with `Unrated` and `Incomplete Coverage` indicators.
- **G-2 Sketch**: Interactive component sketch (`.planning/sketches/257-spend-and-metering.html`) before planning.
- **G-4 Acceptance Bar**: Three operator-defined "I'd recognize failure here" browser-driven scenarios.

### Out of Scope
- Dollar amounts / a published price list for end customers (`D-PRD-10` defers tier pricing until buyer signal; this phase builds the conversion machinery, not the SKU prices).
- Any billing integration, payment gateway, invoicing, or credit card processing (Stripe, etc.).
- Multi-currency conversions (all rates and conversions in USD).
- Automated external rate fetching from provider APIs (rates are seeded and operator-managed).

</domain>

<decisions>
## Implementation Decisions

### Rate Registry Schema & Pricing Mechanics (Migration 183 / METER-01)

- **D-257-01: Rates are stored as USD per 1,000,000 tokens using `numeric(12, 6)`.**
  Both `input_cost_per_million` and `output_cost_per_million` are stored as `numeric(12, 6)`. This directly mirrors provider rate sheets ($0.14 / 1M, $2.50 / 1M, $15.00 / 1M) without sub-cent float rounding errors and avoids integer micro-dollar scaling confusion.

- **D-257-02: Compound resolution key on `(model_id, provider, effective_from)` with fallback to `(model_id, NULL)`.**
  Allows provider-specific rates (e.g. OpenRouter pass-through with markup vs direct OpenAI) while supporting a generic model rate default where `provider IS NULL`.

- **D-257-03: Open-ended `effective_from` timestamps; repricing is strictly append-only.**
  A rate lookup finds `effective_from <= run.created_at ORDER BY effective_from DESC LIMIT 1`. Repricing a model inserts a new row with `effective_from = now()`. Past runs are immutable and price against the rate active when they were created.

- **D-257-04: Migration 183 seeds curated rates for primary native models only.**
  Seeds baseline rates for primary production models (e.g. `deepseek-chat`, `gpt-4o`, `gpt-4o-mini`, `claude-3-5-sonnet-20241022`, `gemini-1.5-flash`), deliberately leaving secondary/niche models unseeded so the system naturally tests and demonstrates the "Unrated" state.

### Unrated Models & Blind Spot Reporting (METER-01 / METER-07 / SEED-300)

- **D-257-05: Unrated runs display a distinct `Unrated` badge beside token count — never `$0.00`.**
  If a run used a model with no rate in `model_rates`, it renders an amber/muted `Unrated` chip (e.g. `Unrated · 34.2k tokens`) with a tooltip naming the unrated model. It never renders `$0.00` or `$0`.

- **D-257-06: Org totals display rated sum with an explicit unrated count footnote.**
  If an org has unrated runs in the selected window, the total displays the rated spend with an explicit disclaimer (e.g. `$48.20* · 92 runs priced · 8 unrated runs excluded from total`) and a one-click filter to view the unrated runs.

- **D-257-07: Dedicated "What This View Cannot See" honesty summary card above the spend table.**
  Surfaces blind spots at the top of the `/admin/spend` dashboard:
  1. Unrated runs count (with link to add rates).
  2. Incomplete `token_coverage` runs count (queried via migration 182's partial index `idx_workflow_runs_org_coverage_incomplete`).
  3. SEED-300 residual disclosures (e.g. uncounted judge shots in older runs or pre-256 historical runs).

- **D-257-08: Runs with valid rates but incomplete `token_coverage` display dollar cost with an `Incomplete Coverage` tag.**
  E.g. `$0.45 · partial coverage` with a tooltip indicating missing legs (such as uncounted judge or emit calls), ensuring operators know the dollar figure is a lower bound.

### Spend UI Surface & Location (METER-07 / G-2 Sketch)

- **D-257-09: Dedicated `/admin/spend` route (Admin → Spend & Metering) for operators.**
  Spend dashboard lives at `/admin/spend`. Run-level dollar costs are also surfaced on `WorkflowRunPage` and `RunCard`.

- **D-257-10: Multi-axis filtering controls on `/admin/spend`.**
  Provides controls for:
  - Time Range: Today, 7D, 30D (default), All Time.
  - Coverage Status: All, Fully Rated, Has Unrated Runs, Incomplete Coverage.
  - Model selector dropdown.
  - Org selector (if multi-org mode enabled).

- **D-257-11: Dedicated "Rates" tab within `/admin/spend` with a "Reprice Model" dialog.**
  Allows operators to inspect active and historical rates per model and insert new effective-dated rates directly through the UI.

- **D-257-12: G-2 Component Sketch authored at `.planning/sketches/257-spend-and-metering.html`.**
  Pre-planning acceptance bar renders real components against `frontend/src/index.css` covering the main dashboard, the "What This View Cannot See" card, and the Reprice dialog.

### Token-to-USD Engine & Single-Home Guardrail (METER-02)

- **D-257-13: Canonical conversion function lives in `backend/app/services/pricing_service.py`.**
  Signature: `compute_token_cost_usd(input_tokens, output_tokens, rate) -> CostResult(cost_usd: Decimal | None, is_rated: bool, unrated_model: str | None)`. Returns `None` when unrated to prevent accidental `0.00` coercion.

- **D-257-14: AST single-home fence in `tests/unit/test_257_single_token_conversion_home.py`.**
  Walks all backend ASTs, banning any external token-by-rate multiplications or alternative conversion functions outside `pricing_service.py`. Driven RED against a planted duplicate before trusted.

- **D-257-15: Database aggregation in `backend/app/db/rates.py` with strict Python-SQL parity unit test.**
  High-volume org aggregations execute in PostgreSQL via `effective_from <= run.created_at`, guarded by a unit test verifying cent-for-cent parity between Python `pricing_service` and SQL across boundary cases.

### G-4 Browser Acceptance Bar & Failure Scenarios

- **D-257-16: Three operator-defined failure recognition scenarios:**
  1. **The Free Lie**: An unrated run displays `$0.00` or is summed as $0 in an org total without warning.
  2. **Historical Rewrite**: Updating a model rate today alters the displayed dollar cost of runs completed yesterday.
  3. **Blind Spot Amnesia**: Incomplete coverage runs are counted as fully known without triggering the "What This View Cannot See" card or run-level warning tags.

### Builder Discretion
- Exact CSS classes, spacing, and micro-interactions on the `/admin/spend` page, adhering to Aether Intelligence dark tokens.
- Internal caching strategy for `model_rates` (e.g. 60-second in-memory TTL in `pricing_service.py`).
- Exact SQL query structure in `backend/app/db/rates.py` (e.g. LATERAL join vs correlated subquery for rate lookup).

### Folded Seeds & Bugs
- **SEED-073**: Per-model cost-rate registry + token-to-USD conversion — FULLY FOLDED into Phase 257.
- **SEED-297**: Boot reconciler NULLing `cap_paused` token totals — guarded against in `pricing_service` (reads persisted totals or flags unmeasured state).
- **SEED-300**: Three token holes surviving Phase 256 — disclosed in the METER-07 "What This View Cannot See" summary card.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Contract & Extension Architecture
- `AGENTS.md` — Dual-agent protocol and role separation.
- `CLAUDE.md` — Stack rules, test baselines, and hot-file guidelines.
- `docs/EXTENSION-CONTRACT.md` — Core extension boundary rules.

### Database & Schema
- `supabase/migrations/182_workflow_runs_token_totals.sql` — Token columns (`input_tokens`, `output_tokens`, `token_coverage`) and `idx_workflow_runs_org_coverage_incomplete`.
- `supabase/migrations/057_workflow_runs.sql` — Base `workflow_runs` table definition.
- `supabase/migrations/063_dual_mode_continue.sql` — `workflow_runs.model` column addition.
- `supabase/migrations/035_runs_table.sql` — `runs` table schema (`model`, `provider`, `input_tokens`, `output_tokens`).

### Backend Token & Model Services
- `backend/app/db/workflows.py` — `persist_run_usage` and `TOKEN_COVERAGE_LEGS`.
- `backend/app/services/model_registry.py` — Unified model capability and override resolution.
- `backend/app/config.py` — `MODEL_CAPABILITIES` registry.
- `backend/app/services/forced_emit.py` — Token emission and accumulator handling.

### Frontend UI & Types
- `frontend/src/types/index.ts` — Shared frontend models, workflow runs, and provider types.
- `frontend/src/index.css` — Global design tokens, surfaces, and typography.
- `frontend/src/pages/WorkflowRunPage.tsx` — Run details view for displaying run-level cost.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/src/components/ui/Badge.tsx` / standard chip components: Reusable for `Unrated` and `Incomplete Coverage` tags.
- `frontend/src/components/ui/Card.tsx`: Foundation for the "What This View Cannot See" and metric summary cards.
- `backend/app/services/model_registry.py`: Model listing logic to populate model filter dropdowns.

### Established Patterns
- **Effective-Dated Rows**: Similar to historical audit records, `effective_from` ensures past runs remain price-stable.
- **Grain Distinction (D-256-03)**: `workflow_runs` is authoritative for harness/workflow runs; `runs` (where `parent_run_id IS NULL`) is authoritative for chat runs. Never sum across both tables.
- **Nullable Token Fields (D-256-06)**: `NULL` = never measured, `0` = measured as zero.

### Integration Points
- `backend/app/api/admin.py`: Router for `/admin/spend` and rate registry endpoints.
- `frontend/src/App.tsx`: Route registration for `/admin/spend`.
- `frontend/src/pages/WorkflowRunPage.tsx`: Adding the run cost pill next to the duration/status header.

</code_context>

<specifics>
## Specific Ideas
- In the "What This View Cannot See" card, provide a direct one-click button: *"Filter 8 unrated runs"* to immediately filter the table below to the runs causing the spend gap.
- When an operator clicks `Unrated` on a run, a popover appears: *"Model 'xyz' has no rate registered. [Add Rate]"*, clicking which opens the Reprice dialog with that model pre-selected.

</specifics>

<deferred>
## Deferred Ideas
- Multi-currency rate conversion (EUR, GBP, JPY).
- Real-time spend alerting / Webhook notifications when daily org spend exceeds a threshold.
- Customer-facing tier subscription billing (Stripe, LemonSqueezy) — deferred to commercialization phases.

</deferred>

---

*Phase: 257-cost-in-dollars-and-what-it-cannot-see*
*Context gathered: 2026-09-19*

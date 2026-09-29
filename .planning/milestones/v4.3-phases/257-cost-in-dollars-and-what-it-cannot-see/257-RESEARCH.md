# Phase 257: Cost in Dollars, and What It Cannot See — Research

**Researched:** 2026-09-19  
**Domain:** Model pricing registry / Token→USD conversion engine / Operator Spend Dashboard / Blind-Spot Honesty  
**Confidence:** HIGH on schema, conversion mathematics, AST fence, API contracts, and frontend component architecture (all source-measured).  
**Measured at:** `git HEAD = b6203cc5f` on `develop`.

---

<user_constraints>
## User Constraints (from 257-CONTEXT.md)

### Locked Decisions — D-257-01 … D-257-16

- **D-257-01**: Rates stored as USD per 1,000,000 tokens using `numeric(12, 6)` (`input_cost_per_million`, `output_cost_per_million`). Avoids floating point inaccuracies and micro-dollar integer confusion.
- **D-257-02**: Compound resolution key on `(model_id, provider, effective_from)` with fallback to `(model_id, NULL)`.
- **D-257-03**: Open-ended `effective_from` timestamps; repricing is strictly append-only. A rate lookup matches `effective_from <= run.created_at ORDER BY effective_from DESC LIMIT 1`. Past runs remain price-immutable.
- **D-257-04**: Migration 183 seeds curated rates for primary native models (`gpt-4o`, `gpt-4o-mini`, `claude-3-5-sonnet-20241022`, `deepseek-chat`, `gemini-1.5-flash`), leaving secondary/local models unseeded to naturally exercise the `Unrated` code path.
- **D-257-05**: Unrated runs display a distinct `Unrated` badge beside token count — **never `$0.00`**.
- **D-257-06**: Org totals display rated sum with an explicit unrated count footnote (e.g. `"$148.62* · 92 runs priced · 8 unrated runs excluded from total"`).
- **D-257-07**: Dedicated "What This View Cannot See" honesty summary card above the spend table, querying unrated runs and incomplete `token_coverage` runs (`idx_workflow_runs_org_coverage_incomplete`).
- **D-257-08**: Runs with valid rates but incomplete `token_coverage` display dollar cost with an `Incomplete Coverage` tag (e.g. `"$0.45 · partial coverage"`).
- **D-257-09**: Dedicated `/admin/spend` route (Admin → Spend & Metering) for operators. Run-level cost also surfaced on `WorkflowRunPage` and `RunCard`.
- **D-257-10**: Multi-axis filtering controls on `/admin/spend` (Time Range: Today, 7D, 30D, All Time; Coverage Status: All, Fully Rated, Has Unrated Runs, Incomplete Coverage; Model selector).
- **D-257-11**: Dedicated Rates tab / Reprice modal within `/admin/spend` to inspect rates and insert new effective-dated prices.
- **D-257-12**: G-2 Component Sketch authored and approved at `.planning/sketches/257-spend-and-metering/index.html`.
- **D-257-13**: Canonical conversion function lives in `backend/app/services/pricing_service.py`. Signature: `compute_token_cost_usd(input_tokens, output_tokens, rate) -> CostResult(cost_usd: Decimal | None, is_rated: bool, unrated_model: str | None)`. Returns `None` when unrated.
- **D-257-14**: AST single-home fence in `tests/unit/test_257_single_token_conversion_home.py` banning external token-rate multiplication outside `pricing_service.py`, driven RED against a planted duplicate.
- **D-257-15**: Database aggregation in `backend/app/db/rates.py` with strict Python-SQL parity unit test across boundary cases.
- **D-257-16**: G-4 lived-experience failure scenarios:
  1. *The Free Lie*: Unrated run displays `$0.00` or sums as $0 without warning.
  2. *Historical Rewrite*: Updating a rate today changes yesterday's run cost.
  3. *Blind Spot Amnesia*: Incomplete coverage runs counted as fully known without triggering disclosures.

### Out of Scope
- Customer tier pricing / published price list (`D-PRD-10`).
- External billing/payment integrations (Stripe, LemonSqueezy).
- Multi-currency rate conversion (USD only).
- Dynamic third-party rate scrapers.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description (REQUIREMENTS.md) | Research Support |
|---|---|---|
| **METER-01** | Every model has an input and output rate with an effective date; unrated models read as `Unrated`, never `$0.00`; repricing adds a new row without changing past runs. | §Schema & Migration 183 (`model_rates` table, append-only `effective_from`, RLS, compound indexes). |
| **METER-02** | Exactly one token→USD conversion exists in one home; callers go through it; a second conversion site fails an AST fence. | §Pricing Service (`pricing_service.py`), §AST Fence (`test_257_single_token_conversion_home.py`), §SQL Parity. |
| **METER-07** | Operator reads spend in dollars per run and per org; view states what it cannot see (unrated models + incomplete `token_coverage`). | §Admin Spend Sub-router (`api/admin_spend.py`), §Frontend AdminSpendPage, §"What This View Cannot See" card, §RunCard/WorkflowRunPage pills. |

</phase_requirements>

---

## Technical Investigations & Architectural Seams

### 1. Schema & Migration 183 (`supabase/migrations/183_model_rates.sql`)

- **Table**: `public.model_rates`
  - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
  - `model_id text NOT NULL` (e.g. `'gpt-4o'`, `'claude-3-5-sonnet-20241022'`, `'deepseek-chat'`)
  - `provider text` (nullable: e.g. `'openai'`, `'anthropic'`, `'deepseek'`, or `NULL` for generic fallback)
  - `input_cost_per_million numeric(12, 6) NOT NULL` (e.g. `2.500000`)
  - `output_cost_per_million numeric(12, 6) NOT NULL` (e.g. `10.000000`)
  - `effective_from timestamptz NOT NULL DEFAULT now()`
  - `created_at timestamptz NOT NULL DEFAULT now()`
  - `created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL`
  - `org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE` (nullable: `NULL` = global default rate, non-null = org override)
- **Indexes**:
  - `idx_model_rates_lookup`: `ON public.model_rates (model_id, provider, effective_from DESC)`
  - `idx_model_rates_fallback`: `ON public.model_rates (model_id, effective_from DESC) WHERE provider IS NULL`
- **RLS**:
  - `ENABLE ROW LEVEL SECURITY`
  - `SELECT`: Allowed for `authenticated` and `service_role`.
  - `INSERT / UPDATE`: Restricted to org admins or platform super-admins (`service_role`).
- **Seed Data (Initial Curated Set)**:
  - `('gpt-4o', 'openai', 2.500000, 10.000000, '2024-01-01 00:00:00+00')`
  - `('gpt-4o-mini', 'openai', 0.150000, 0.600000, '2024-01-01 00:00:00+00')`
  - `('claude-3-5-sonnet-20241022', 'anthropic', 3.000000, 15.000000, '2024-01-01 00:00:00+00')`
  - `('deepseek-chat', 'deepseek', 0.140000, 0.280000, '2024-01-01 00:00:00+00')`
  - `('gemini-1.5-flash', 'google', 0.075000, 0.300000, '2024-01-01 00:00:00+00')`
  - *Secondary models deliberately omitted* (`qwen-2.5-72b`, `llama-3-8b`, `deepseek-r1`, etc.) so `Unrated` is naturally exercised.

### 2. Pricing Service & AST Single-Home Fence (`METER-02`)

- **Home**: `backend/app/services/pricing_service.py`
  - Core dataclass:
    ```python
    @dataclass(frozen=True)
    class CostResult:
        cost_usd: Decimal | None
        is_rated: bool
        unrated_model: str | None
        input_cost_usd: Decimal | None = None
        output_cost_usd: Decimal | None = None
    ```
  - Core function:
    ```python
    def compute_token_cost_usd(
        input_tokens: int | None,
        output_tokens: int | None,
        rate: ModelRate | None,
    ) -> CostResult: ...
    ```
    - When `rate is None`: returns `CostResult(cost_usd=None, is_rated=False, unrated_model=model_id)`.
    - When `input_tokens is None and output_tokens is None`: returns `CostResult(cost_usd=None, is_rated=True, unrated_model=None)`.
    - When rated: uses `Decimal` arithmetic:
      `in_cost = (Decimal(input_tokens or 0) * rate.input_cost_per_million) / Decimal(1_000_000)`
      `out_cost = (Decimal(output_tokens or 0) * rate.output_cost_per_million) / Decimal(1_000_000)`
      `total = (in_cost + out_cost).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)`
- **AST Single-Home Fence**: `backend/tests/unit/test_257_single_token_conversion_home.py`
  - Walks all Python files in `backend/app/`.
  - Searches AST for:
    1. Any division by `1_000_000` or `1000000` combined with multiplication of token variables.
    2. Any function definition named `*cost_usd*` or `*token_to_usd*` or `*compute_cost*` outside `backend/app/services/pricing_service.py` and `backend/app/db/rates.py`.
  - Must be driven RED against a planted duplicate in a dummy module, with MD5 verification of plant removal.

### 3. Database Layer & Parity (`backend/app/db/rates.py`)

- Functions:
  - `get_rate_for_model(pool, model_id, provider=None, effective_at=None) -> ModelRate | None`
  - `get_org_spend_summary(pool, org_id, start_time=None, end_time=None) -> SpendSummary`
  - `get_spend_runs(pool, org_id, limit=50, offset=0, filter_status=None, time_range=None) -> tuple[list[SpendRunItem], int]`
  - `reprice_model(pool, model_id, input_cost, output_cost, provider=None, org_id=None, user_id=None) -> ModelRate`
- Parity Test: `backend/tests/unit/test_257_rates_db.py`
  - Validates that SQL LATERAL joins and subqueries yield the exact same 4-decimal dollar figure as `compute_token_cost_usd` across 20+ test permutations (0 tokens, 1 token, boundary values, odd multipliers).

### 4. Admin Spend API Sub-Router (`backend/app/api/admin_spend.py`)

- Rather than bloating `backend/app/api/admin.py` (which already has a high commit count in `docs/HOT-FILE-LEDGER.md`), we author `admin_spend.py` and mount it:
  ```python
  # in backend/app/api/admin.py:
  from app.api.admin_spend import router as spend_router
  router.include_router(spend_router, prefix="/spend", tags=["admin-spend"])
  ```
- Endpoints:
  - `GET /api/admin/spend/summary` -> `{ total_spend_usd, rated_runs_count, unrated_runs_count, incomplete_coverage_count, daily_spend_series, model_spend_breakdown }`
  - `GET /api/admin/spend/runs` -> `{ runs: [...], total_count: int, filtered_count: int }`
  - `GET /api/admin/spend/rates` -> `{ rates: [...] }`
  - `POST /api/admin/spend/rates` -> Inserts new effective-dated row.

### 5. Frontend Architecture & G-2 Alignment

- New Page: `frontend/src/pages/admin/AdminSpendPage.tsx`
- Types: `frontend/src/types/spend.ts`
- Visual Features matching Sketch 257:
  - 14-day interactive SVG bar chart with overlaid unrated volume segments.
  - Model spend breakdown segmented SVG donut ring.
  - "What This View Cannot See" callout with dual-color honesty gauge.
  - Runs table with Provider chips (`OA`, `AN`, `DS`, `OR`, `LM`), Token ratio split bars, Spend magnitude bars, 4-leg coverage dots, and amber `Unrated` tags.
- Run-level components:
  - `frontend/src/components/workflow/RunCostBadge.tsx` mounted in `WorkflowRunPage.tsx` and `RunCard.tsx`.

### 6. G-4 Browser Failure Scenarios

1. **The Free Lie Scenario**: Navigate to `/admin/spend`. Filter by Unrated runs. Verify that runs for `qwen-2.5-72b` display the amber `Unrated` badge and are excluded from the top total with an explicit footnote; verify `$0.00` is never rendered.
2. **Historical Rewrite Scenario**: Fetch cost of a run completed yesterday with rate $2.50. Add a new rate row today ($5.00). Fetch the cost of yesterday's run again; verify it remains priced at $2.50.
3. **Blind Spot Amnesia Scenario**: Inspect a run with `token_coverage = ['agent', 'single', 'batch']` (missing `emit`). Verify the run displays `Incomplete Coverage` warning and appears in the "What This View Cannot See" card.

---

## Hot-File Ledger Impact (G-5)

| File | Status | Strategy |
|---|---|---|
| `backend/app/api/admin.py` | 38/14/1968 (Fires) | Extract all spend routes to `backend/app/api/admin_spend.py`. Single line `router.include_router` in `admin.py`. |
| `frontend/src/types/index.ts` | 85/65/1380 (Fires) | Create `frontend/src/types/spend.ts`. Re-export minimal optional properties. |
| `frontend/src/pages/WorkflowRunPage.tsx` | 28/9/1670 (Fires) | Encapsulate cost presentation in `RunCostBadge.tsx`. Single line mount in `WorkflowRunPage.tsx`. |
| `frontend/src/components/workflow/RunCard.tsx` | Active | Mount `RunCostBadge.tsx` directly beside token count. |

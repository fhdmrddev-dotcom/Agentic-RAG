# Phase 257: Cost in Dollars, and What It Cannot See - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-19
**Phase:** 257-cost-in-dollars-and-what-it-cannot-see
**Areas discussed:** Rate Registry Schema & Pricing Mechanics, Unrated Models & Blind Spot Reporting, Spend UI Surface & Location, Token-to-USD Engine & Single-Home Guardrail, G-4 Failure Recognition Scenarios

---

## Rate Registry Schema & Pricing Mechanics (Migration 183 / METER-01)

### Q1: Rate Storage Format
| Option | Description | Selected |
|--------|-------------|----------|
| USD per 1M tokens as numeric(12, 6) | Matches provider pricing sheets ($0.14/1M, $2.50/1M) without float precision loss | ✓ |
| Fixed micro-dollars per token as integer | Scaled by 1,000,000 | |
| Floating point cost per single token | double precision | |

**User's choice:** USD per 1M tokens as numeric(12, 6)
**Notes:** D-257-01 locked.

### Q2: Rate Keying & Resolution
| Option | Description | Selected |
|--------|-------------|----------|
| Compound (model_id, provider, effective_from) with fallback to (model_id, NULL) | Allows provider-specific pricing (e.g. OpenRouter vs native OpenAI) while keeping a model default | ✓ |
| Strict (model_id, effective_from) only | Relies on distinct model strings (e.g. 'openai/gpt-4o' vs 'gpt-4o') | |
| Three-part (provider, model_id, context_window_tier, effective_from) | Complex multi-tier keying | |

**User's choice:** Compound (model_id, provider, effective_from) with fallback to (model_id, NULL)
**Notes:** D-257-02 locked.

### Q3: Effective Dating Mechanics
| Option | Description | Selected |
|--------|-------------|----------|
| Open-ended effective_from | Rate lookup matches effective_from <= run.created_at ORDER BY effective_from DESC LIMIT 1; repricing is a pure INSERT with no backfill or row updates | ✓ |
| Interval ranges with effective_from and effective_to | Requires closing previous range upon inserting a new rate | |
| Store resolved USD cost directly on workflow_runs | At run finalize, using effective_from for historical recalculations only | |

**User's choice:** Open-ended effective_from
**Notes:** D-257-03 locked.

### Q4: Initial Seed Scope in Migration 183
| Option | Description | Selected |
|--------|-------------|----------|
| Seed curated rates for the primary working models | In Migration 183, leaving secondary models unseeded to naturally prove the 'unrated' state | ✓ |
| Zero initial seed rows | Require operator/admin configuration to establish rates | |
| Exhaustive seed for all models | Every model currently registered in MODEL_CAPABILITIES | |

**User's choice:** Seed curated rates for the primary working models in Migration 183
**Notes:** D-257-04 locked.

---

## Unrated Models & Blind Spot Reporting (METER-01 / METER-07 / SEED-300)

### Q5: Unrated Run Presentation
| Option | Description | Selected |
|--------|-------------|----------|
| Distinct 'Unrated' badge beside token count | (e.g. 'Unrated · 34.2k tokens') with tooltip naming the missing model rate — never shows $0.00 | ✓ |
| Display as '--' or 'N/A' | In the cost column with tooltip naming the model | |
| Display '$?.??' in amber | With a clickable popover to add a rate in the registry | |

**User's choice:** Distinct 'Unrated' badge beside token count — never shows $0.00
**Notes:** D-257-05 locked.

### Q6: Org Spend Total Aggregation with Unrated Runs
| Option | Description | Selected |
|--------|-------------|----------|
| Total displays rated sum with explicit unrated disclaimer | (e.g. '$48.20* · 92 runs priced · 8 unrated runs excluded from total') with one-click filter to view unrated runs | ✓ |
| Show strictly as a lower bound | (e.g. '≥ $48.20 (8 runs unrated)') | |
| Refuse single dollar total | Display 'Incomplete: $48.20 + 8 unrated runs' | |

**User's choice:** Total displays rated sum with explicit unrated disclaimer and filter
**Notes:** D-257-06 locked.

### Q7: Blind Spot Summary Card
| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated 'What This View Cannot See' honesty summary card | Above spend table — breaks down unrated run count, incomplete token_coverage count (via migration 182 index), and SEED-300 residual disclosures | ✓ |
| Modal dialog | Launched via 'Blind Spots & Coverage Audit' button next to the org spend total | |
| In-table inline warnings only | On individual runs in the table | |

**User's choice:** Dedicated 'What This View Cannot See' honesty summary card above spend table
**Notes:** D-257-07 locked.

### Q8: Incomplete Token Coverage Display on Single Runs
| Option | Description | Selected |
|--------|-------------|----------|
| Show computed dollar cost with an 'Incomplete Coverage' tag | (e.g. '$0.45 · partial coverage') and tooltip specifying missing legs (e.g. missing emit/judge) | ✓ |
| Show dollar amount normally | Relying on the 'What This View Cannot See' top-level card for coverage warnings | |
| Refuse dollar calculation | Mark as 'Uncertain' if token_coverage is not fully complete | |

**User's choice:** Show computed dollar cost with an 'Incomplete Coverage' tag
**Notes:** D-257-08 locked.

---

## Spend UI Surface & Location (METER-07 / G-2 Sketch)

### Q9: Spend View Location
| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated '/admin/spend' route | (Admin -> Spend & Metering) with run-level cost also displayed on WorkflowRunPage and RunCard | ✓ |
| Tab inside Settings | ('/settings?tab=spend') alongside Providers and Model Registry | |
| Embedded card inside Control Room | ('/admin/control-room') expanding into a drawer | |

**User's choice:** Dedicated '/admin/spend' route with run-level cost also displayed on WorkflowRunPage and RunCard
**Notes:** D-257-09 locked.

### Q10: Spend View Filters
| Option | Description | Selected |
|--------|-------------|----------|
| Comprehensive filters | Time Range (Today, 7D, 30D, All Time), Coverage Status (All, Fully Rated, Has Unrated Runs, Incomplete Coverage), and Model selector | ✓ |
| Minimalist | Time Range only (Last 30 Days default) with sortable table columns | |
| Aggregated two-tier view | Org & Model summary cards at top, drilling down into paginated runs below | |

**User's choice:** Comprehensive filters (Time Range, Coverage Status, Model selector)
**Notes:** D-257-10 locked.

### Q11: Rate Management in UI
| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated 'Rates' tab within /admin/spend | Showing active & historical rates per model, with a simple 'Reprice Model' dialog that inserts a new effective-dated row | ✓ |
| Embed rate editing into Model Registry | At /admin/models alongside context window and timeouts | |
| Read-only rate display in UI | Repricing done via Admin REST endpoint or migration | |

**User's choice:** Dedicated 'Rates' tab within /admin/spend with a simple 'Reprice Model' dialog
**Notes:** D-257-11 locked.

### Q12: G-2 Component Sketch Scope
| Option | Description | Selected |
|--------|-------------|----------|
| Author G-2 component sketch (.planning/sketches/257-spend-and-metering.html) | Rendering real components against index.css for the dashboard, blind spots card, and rate editor | ✓ |
| Generate Stitch variants first | Via stitch MCP, then produce the approved component sketch | |
| Lightweight sketch | Focusing strictly on the Spend Summary cards and Blind Spot banner layout | |

**User's choice:** Author G-2 component sketch (.planning/sketches/257-spend-and-metering.html)
**Notes:** D-257-12 locked.

---

## Token-to-USD Engine & Single-Home Guardrail (METER-02)

### Q13: Canonical Conversion Home & Signature
| Option | Description | Selected |
|--------|-------------|----------|
| backend/app/services/pricing_service.py | Typed CostResult (cost_usd: Decimal | None, is_rated: bool, unrated_model: str | None) returning None when unrated | ✓ |
| backend/app/services/metering.py | Returning Decimal | None directly | |
| backend/app/db/workflows.py | Alongside persist_run_usage | |

**User's choice:** backend/app/services/pricing_service.py with typed CostResult
**Notes:** D-257-13 locked.

### Q14: METER-02 Single-Home AST Fence
| Option | Description | Selected |
|--------|-------------|----------|
| AST fence in test_257_single_token_conversion_home.py | Detecting any external token-by-rate multiplications or alternate conversion functions, RED-driven against a planted duplicate | ✓ |
| Table-access boundary fence | Restricting reads of model_rates table to db/rates.py and pricing_service.py only | |
| Strict regex grep pattern test | Checking for prohibited pricing calculations in service files | |

**User's choice:** AST fence in test_257_single_token_conversion_home.py, RED-driven against planted duplicate
**Notes:** D-257-14 locked.

### Q15: Database Bulk Aggregation Parity
| Option | Description | Selected |
|--------|-------------|----------|
| SQL aggregation query in db/rates.py | Joining model_rates on effective_from <= run.created_at, guarded by a strict Python-SQL parity unit test verifying identical arithmetic | ✓ |
| Pure Python aggregation in pricing_service | Hydrating runs and computing sums in Python | |
| Postgres SQL function created in Migration 183 | Invoked by all queries | |

**User's choice:** SQL aggregation query in db/rates.py guarded by strict Python-SQL parity unit test
**Notes:** D-257-15 locked.

---

## G-4 Failure Recognition Scenarios

### Q16: Acceptance Bar Scenarios
| Option | Description | Selected |
|--------|-------------|----------|
| Adopt the 3 canonical failure scenarios | (1) The Free Lie; (2) Historical Rewrite; (3) Blind Spot Amnesia | ✓ |
| Focus on multi-currency or provider markups | Adjust Scenario 3 | |
| Add a 4th scenario for mixed workflow phases | Multiple models in one workflow | |

**User's choice:** Adopt the 3 canonical failure scenarios:
1. The Free Lie: unrated run shows $0.00 instead of Unrated badge.
2. Historical Rewrite: repricing today changes past run costs.
3. Blind Spot Amnesia: incomplete coverage runs counted as fully known with zero disclaimer.
**Notes:** D-257-16 locked.

---

## Claude's Discretion
- UI styling, card elevation, and exact placement of badges adhering to Aether dark tokens.
- Internal caching of `model_rates` (60s TTL) to minimize database lookups during high-frequency run completions.
- SQL query optimization (LATERAL joins vs correlated subquery) in `backend/app/db/rates.py`.

## Deferred Ideas
- Multi-currency support (EUR, GBP, JPY) in rates table.
- Customer-facing tier subscription billing integrations (Stripe, LemonSqueezy).

# Phase 258: A Tier Becomes Enforceable - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-19
**Phase:** 258-a-tier-becomes-enforceable
**Areas discussed:** Commercial Pricing Metric (Operator Decision #1), Capability Map Data Storage, Single-Home Entitlement Check Architecture, Refusal Response Semantics, Fail-Closed vs Fail-Open Behavior, Initial Seed Roster, Add-ons Interaction, and First Proof Slice.

---

## Operator Decision #1 (One-Way Door): Primary Pricing & Packaging Metric (TIER-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Ascending Capability Bundles | Tiers (Standard, Pro, Enterprise) unlock distinct functional capabilities (Basic RAG -> Skills & Code Sandbox -> Workflows, MCP Connectors, Experts), with `add_ons jsonb` for modular a-la-carte features | ✓ |
| Seat-Based Licensing with Tier Gates | Named-user tiers (Standard seat vs Pro seat); subscription_tier represents the organization license level | |
| Usage / Consumption-Centric Gating | Tiers primarily define run/token/spend caps (leveraging Phase 256/257 metering), while capabilities remain mostly unbundled | |
| Hybrid | Capability tiers determine baseline features, while `add_ons jsonb` specifies custom feature flags and higher usage headroom | |

**User's choice:** Ascending Capability Bundles
**Notes:** D-258-01 locked. Fulfills `SEED-294` requirement to name and resolve the metric before encoding.

---

## Data Storage for Capability Map (TIER-02 / Migration 186)

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated relational table `tier_capabilities` | Migration 186 creates table (tier, capability, enabled, metadata, created_at); re-packaging is an INSERT/UPDATE row change with zero code edits or deploys | ✓ |
| JSON Document in DB config | Stored as a single structured JSON matrix in app_settings or system config | |
| Inheritance Table | Tiers inherit capabilities hierarchically (Enterprise inherits Pro, Pro inherits Standard) with an overrides table | |

**User's choice:** Dedicated relational table `tier_capabilities`
**Notes:** D-258-02 locked.

---

## Single-Home Entitlement Check (TIER-01, TIER-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated service `backend/app/services/entitlement_service.py` | Exposes async `check_entitlement()` and FastAPI `Depends(require_capability(...))`, backed by an AST fence test banning direct `subscription_tier` reads elsewhere | ✓ |
| Extend existing dependencies | Place check directly in `backend/app/dependencies.py` alongside `get_active_org_id` | |
| Database RPC / SECDEF helper | Implement check as a PostgreSQL function `public.current_org_has_capability(capability)` called via SQL | |

**User's choice:** Dedicated service `backend/app/services/entitlement_service.py`
**Notes:** D-258-03 and D-258-04 locked. AST test `test_258_single_entitlement_home.py` will be driven RED against planted second check.

---

## Refusal Semantics (TIER-03)

| Option | Description | Selected |
|--------|-------------|----------|
| HTTP 403 Forbidden with structured JSON | Returns `{"detail": "...", "capability": "...", "required_tier": "pro", "current_tier": "standard", "upgrade_hint": "..."}`. Never a bare 403 | ✓ |
| HTTP 402 Payment Required | With the structured refusal JSON payload | |
| HTTP 403 Forbidden with minimal JSON | `{"error": "tier_insufficient", "required_tier": "pro"}` | |

**User's choice:** HTTP 403 Forbidden with structured JSON naming the required tier
**Notes:** D-258-05 locked.

---

## Fail-Closed Behavior (TIER-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Strict Fail-Closed Denial | Return `EntitlementResult(allowed=False, reason="Entitlement check unavailable")` and raise HTTP 403/503 immediately. Commercial boundaries must never fail open | ✓ |
| Fallback to Minimum Tier | If DB blips or tier is unreadable, treat org as default 'standard' tier (allows basic RAG, denies Pro/Enterprise) | |
| TTL Cache with Fail-Closed Cold Fallback | Check hot-reload in-memory cache; if expired and DB unreachable, fail closed | |

**User's choice:** Strict Fail-Closed Denial
**Notes:** D-258-06 locked. Architectural contrast to `load_run_budget` fail-open explicitly recorded.

---

## Initial Seed Tiers & Capability Roster (Migration 186)

| Option | Description | Selected |
|--------|-------------|----------|
| Standard, Pro, Enterprise | Standard (basic_rag, chat), Pro (skills, code_execution, custom_models), Enterprise (workflows, connectors, experts, audit_export) | ✓ |
| Free, Pro, Enterprise | Free tier as trial/limited, Pro as self-serve team, Enterprise as full suite | |
| Standard, Enterprise only | Two tiers initially | |

**User's choice:** Standard, Pro, Enterprise
**Notes:** D-258-07 locked.

---

## Interaction with `organizations.add_ons`

| Option | Description | Selected |
|--------|-------------|----------|
| Add-ons as additive overrides | If a capability is disabled in the org's tier, but enabled in `organizations.add_ons` (as boolean flag or list item), entitlement check GRANTS access | ✓ |
| Tier-only for base capabilities | Base capabilities can only be unlocked via tier upgrade; add_ons are for distinct extensions | |
| Strictly tier-only | Ignore add_ons for now | |

**User's choice:** Add-ons as additive overrides
**Notes:** D-258-08 locked.

---

## First Live Gated Consumer (Proof Slice)

| Option | Description | Selected |
|--------|-------------|----------|
| Workflows API (POST /workflows and POST /workflow-runs) | Wire `require_capability('workflows')` so Standard orgs are refused with the named tier 'pro'/'enterprise' and upgrade hint | ✓ |
| Code Execution Sandbox (/execute) | Wire `require_capability('code_execution')` on sandbox execution routes | |
| Skills Management (/skills) | Wire `require_capability('skills')` on custom skill authoring/creation | |

**User's choice:** Workflows API (`POST /workflows` and `POST /workflow-runs`)
**Notes:** D-258-09 locked.

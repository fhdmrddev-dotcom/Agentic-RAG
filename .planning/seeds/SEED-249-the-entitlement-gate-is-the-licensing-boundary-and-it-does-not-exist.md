---
seed_id: SEED-249
title: "`feature_visibility` tells the UI what to draw and stops NOBODY from calling the endpoint — `resolve_feature_access` has ZERO call sites outside the admin write path, so any tier sold on it is a suggestion, not a boundary"
created: 2026-09-06
planted_during: "2026-09-06 packaging analysis — operator asked how to sell a core plus paid plugins/tiers"
status: partially-answered
partial: true
status_note: |
  Moved `planted` -> `partially-answered` on 2026-10-04 (release-history audit). Original line: `status: planted`.
  The trigger fired (tiered pricing, v4.3). AXIS SETTLED: an API-enforced tier gate exists for `experts` and
  `workflows` (Phase 258, entitlement_service.require_capability). AXIS OPEN: `skills`, `code_execution`,
  `custom_models`, `connectors`, `audit_export` are in the tier map but no route checks them; a fourth tier
  needs a code edit to TIER_ORDER.
surface: Agentic-RAG
severity: high
category: licensing / entitlements / api-authorization
priority: high
relates_to:
  - docs/PRODUCT-PACKAGING.md — the full analysis this seed condenses
  - backend/app/models/user_settings.py:1284 — `resolve_feature_access`, fail-closed and well built
  - backend/app/api/admin.py:103 — `_VISIBILITY_FEATURES`, the closed allowlist (6 features)
  - backend/app/api/document_governance.py:40 — the RECORDED decision not to gate at the API
  - SEED-251 — the org/tenant prerequisite; entitlements have nowhere honest to live without it
trigger_when: >
  The moment tiered pricing, a paid add-on, an edition, or a self-hosted contract is
  seriously proposed. Also fires if any phase adds a route to a capability that is
  intended to be sellable.
trigger_paths: ["backend/app/services/entitlement_service.py", "backend/app/db/entitlements.py", "supabase/migrations/186_tier_capabilities.sql", "backend/app/api/skills.py", "backend/app/api/connectors.py", "backend/app/api/admin.py"]
trigger_surfaces: ["admin", "skills", "connectors", "sandbox"]
---

## ⚠ CORRECTED 2026-10-04 — a tier gate now exists, but only for two of the capabilities it lists

Release-history audit (`docs/history/v4.3-what-you-can-actually-sell.md`). This seed read `planted`, but its
trigger fired in v4.3 and Phase 258 built the boundary it asked for. Measured 2026-10-04:

- `backend/app/services/entitlement_service.py` (Phase 258, TIER-01..05): one fail-closed home,
  `require_capability(...)`, reading `public.tier_capabilities` (mig `186`), structured 403 on denial.
- Enforced on: `require_capability("experts")` (router level, `api/experts.py:75`) and
  `require_capability("workflows")` (`api/workflows.py` authoring writes, `api/schedules.py`).
- **Mapped but not enforced:** the tier map in mig `186` also names `skills`, `code_execution`,
  `custom_models`, `connectors`, `audit_export` (and `chat`, `basic_rag`). No route calls
  `require_capability` for any of them. A tier sold on those today is still a suggestion.
- `TIER_ORDER` is a literal three-entry dict (`backend/app/db/entitlements.py:12`): adding a fourth tier is
  a code change, not data.
- `resolve_feature_access` (this seed's original subject, UI visibility) is a separate mechanism and was not
  re-measured here.

So the residual is: decide which of the five mapped capabilities are actually sold, and gate those at the API
in the same single home; move tier ordering into data.


## The measurement

`resolve_feature_access` is called from **nowhere except** `api/features.py` (which reports the
map to the client) and `api/admin.py` (which writes it). `api/workflows.py` contains **zero**
references to it or to `workflows_enabled`. Verified 2026-09-06.

⚠ **This was a deliberate decision, not an oversight**, and the reasoning was sound for its
purpose — `api/document_governance.py:40`:

> *"Phases 111/112/113/116/118 all chose not to gate at the API. Gating Governance alone would
> make it the lone inconsistent surface."*

**That is correct for VISIBILITY and fatal for LICENSING.** A customer on a cheap tier who opens
the browser network tab keeps every feature they paid to not have.

## What the fix is

A `require_feature(name)` FastAPI dependency on every route of every sellable capability, with
**two separate checks and two different status codes**:

- `402 feature_not_licensed` — the licence does not include it.
- `403 feature_hidden_by_operator` — the operator turned it off for this role/group.

Collapsing those into one code produces support tickets nobody can resolve: *"you did not buy
this"* and *"your own admin hid it"* are different facts with different remedies.

⚠ **It must land on every sellable surface in ONE phase.** `document_governance.py` is right that
a gate on one surface and not its neighbours is worse than no gate — it teaches users the gate is
decorative.

⚠ **It needs a fence test**, the same shape as the count gate: assert that **no route of a gated
router is reachable without the dependency**. Without it, the tenth route added next year ships
free and nobody notices until a customer does.

## What it is NOT

Not obfuscation, not anti-piracy. A determined self-hoster with the source removes any Python
check. The gate exists to keep honest customers honest, to make the entitlement legible so nobody
over-uses by accident, and to give contractual/audit leverage. Effort spent on tamper-proofing is
better spent on making renewal easy.

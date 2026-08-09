# Phase 160: Tenancy-Model ADR - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-18
**Phase:** 160-tenancy-model-adr
**Areas discussed:** Deployment-flexibility contract, ADR home & shape, One-way-door / reversal framing, Posture confirmation

---

## Area selection

All four surfaced gray areas were selected for discussion (multiSelect). Framing throughout: this is a *ratify-not-relitigate* ADR (no code, no threat model, skip research-phase), so the discussion was scoped to genuinely-open framing choices only. Pre-locked items (D-PRD-02 posture, `is_system`→`is_system_global`, `is_global`→`is_org_shared`, migrations at 104+, ~80% pre-decided by v3.3 stubs+presets) were carried forward, not re-asked.

---

## Deployment-Flexibility Contract (SC#4)

| Option | Description | Selected |
|--------|-------------|----------|
| Hard contract + per-phase check | ADR binds both the 4-tier env-var-switch guarantee AND the SEED-120 forward-compat substrate; every v3.4 phase's verification confirms it made no tier harder | ✓ |
| State it, verify once at milestone close | Same guarantees, checked only at milestone-exit — not per-phase | |
| Current 4 tiers only; SEED-120 forward-compat aspirational | Lock today's tiers; treat per-org-provider/BYO-key forward-compat as nice-to-have (risks a v3.5 rewrite) | |

**User's choice:** Hard contract + per-phase check (Recommended).
**Notes:** The forward-compat half is explicitly binding — the org-settings + encrypted-secrets substrate must stay ready for per-org provider config / BYO keys / per-org (incl. local) model choice ([[SEED-120]]) so v3.5 needs no schema rewrite. → CONTEXT D-01.

---

## ADR Home & Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Both: phase-folder ADR + DECISIONS.md pointer | Full standalone `160-…-ADR.md` (deliverable + stable path 161–168 cite) + short `D-v3.4-01` entry in `.planning/prd-reset/DECISIONS.md` | ✓ |
| Only a `D-v3.4-01` entry in DECISIONS.md | One appended register entry; no separate doc | |
| Only a standalone phase-folder ADR doc | Full ADR in phase folder; register left stale | |

**User's choice:** Both — phase-folder ADR + DECISIONS.md pointer (Recommended).
**Notes:** Gives downstream phases a stable citable path while keeping the central register complete on the milestone's biggest posture decision. → CONTEXT D-02.

---

## One-Way-Door / Reversal Framing

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — short Consequences + reversal section | Name the one-way-door cost (co-tenant→isolated = redeploy, not a code fork) + the named escape valve (a paying customer forcing isolation/integrations-first) | ✓ |
| No — pure forward ratification | Record decision + rationale only, no reversal section | |

**User's choice:** Yes — short Consequences + reversal section (Recommended).
**Notes:** Keep it short — a Consequences/reversal paragraph, not a re-argument. → CONTEXT D-03.

---

## Posture Confirmation (last-chance gut-check)

| Option | Description | Selected |
|--------|-------------|----------|
| Clean ratify — no changes | Co-tenant default + isolation-via-deployment ratified unchanged | ✓ |
| I have a concern to flag | Freeform — something to reconsider before locking | |

**User's choice:** Clean ratify — no changes (Recommended).
**Notes:** No concerns raised; the one-way door is confirmed as pre-decided. → CONTEXT D-04.

---

## Claude's Discretion

- Exact ADR document structure/headings, prose, and the precise wording of the `D-v3.4-01` register entry (must satisfy SC#1–4 + honor D-01…D-04).
- Exact standalone-ADR filename (must be a stable phase-folder path 161–168 can cite).

## Deferred Ideas

- None from this discussion — it stayed within phase scope. SC#4's forward-compat obligation is IN scope; the *delivery* of per-org provider config / BYO keys / local-model-per-org is [[SEED-120]] → v3.5.
- **Reviewed-not-folded todo:** `spike-nl-workflow-authoring.md` (score 0.6) — keyword false-positive ([[SEED-123]] visual/no-code authoring track); unrelated to tenancy.
- **Reported-bugs cross-check:** no open `surface: Agentic-RAG` bug folds into 160 (all chat/streaming/provider-surface, kept in the post-v3.3 chat-polish phase; only SEED-091 folds → Phase 164).

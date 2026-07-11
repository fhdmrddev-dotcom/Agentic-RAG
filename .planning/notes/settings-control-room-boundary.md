---
title: Settings ↔ Control Room boundary decision + dynamic-control inventory (resolves SEED-116)
date: 2026-07-12
context: /gsd:explore session with operator on SEED-116, run BEFORE Phase 149 (Model Registry) so the Settings↔Control-Room split is decided once, not built twice. Inputs — SEED-116, SEED-113 (profile menu), SEED-115 (org-RBAC / Glean model), project_admin_panel_plan, project_dynamic_settings_direction, project_settings_design_guidance, project_target_scale. This note holds the DECISION + REASONING; it is flagged to be promoted into a locked D-149 at /gsd:discuss-phase 149.
resolves: SEED-116
feeds: [Phase 149, Phase 150, Phase 152, Phase 154, v3.4 org-RBAC milestone]
promote_to: "locked D-149-NN at /gsd:discuss-phase 149 (this note is the design input; the phase decision is where it becomes binding)"
---

# Settings ↔ Control Room boundary — the decision

## The operator's two questions (2026-07-12, during Phase 148 UAT)

1. **The rule** — what lives in Settings vs the Control Room? Does Settings migrate fully into the
   Control Room, or split, and along what line?
2. **The inventory** — have we thought comprehensively about *everything* that should be dynamically
   controllable?

## The mental model the operator affirmed

> "The operator should govern the whole application and allow admin users / specified profiles to see
> it entirely or restricted. Settings = general/user preferences **according to their access and
> privilege**. Separate the profile settings into the top-right corner (name, email, profile…), and
> consider future SSO / org-directory integration. User picks from an operator-allowed set **with a
> lock option**. Nothing is urgent — be consistent and strategic; surface each bug/seed in the right
> place at the right time. We're near the final stages, then the horizon is automation + integration."

This is the **Glean model** (SEED-115): operator/admin tiers → privilege-filtered feature access →
identity from the directory. Governance is central; a user gets a privilege-filtered slice.

## THE DECISION — three surfaces, not two

| Surface | Owns | Audience |
|---|---|---|
| **Control Room** (`/admin`, Phases 146–150) | **Platform governance** — the *allowed-set + policy + registry + secrets + audit + users + kill-switches + feature visibility*. No-RLS-backstop, operator-gated, non-discoverable (404). | **Operator** |
| **Settings** | **User preferences *within what the operator allows*** — privilege-gated: a user only sees the knobs their access grants (VIS-01 is the seed of this projection). | **Any user, filtered** |
| **Profile menu** (top-right identity anchor) | **Identity** — name/email/profile/sign-out; later role/tier badge + org switcher; SSO/SCIM-ready (SEED-113). | **The signed-in user** |

Settings does **not** migrate *fully* into the Control Room, and it is **not** a free-for-all either.
It survives as a **privilege-filtered projection** of the master governance set.

## THE PATTERN — one rule resolves every knob (never a per-setting argument)

For any configurable thing:

1. **Operator governs the allowed-set + policy** → in the Control Room.
2. **User picks a preference within what's allowed** → in Settings.
3. **Operator can LOCK any choice** (force one value org-wide / disable user override) → a policy flag.
4. **Whether the Settings knob is even VISIBLE is privilege-gated** → VIS-01's audience map,
   generalizing to SEED-115 per-group greenlists in v3.4.

**Models are the first instance (the case that blocked 149):** the registry — which models exist,
their capabilities, enabled/disabled, discovery — is operator/Control-Room (Phase 149). The user
picks their *own default from the enabled set* in Settings. The registry `enabled` flag is the natural
coupling (enabled-in-registry = shows-in-the-user-picker). "Lock" = a policy flag that pins the org
model and turns off user override. **No per-group greenlist in v3.3** (that's SEED-115 / v3.4).

## THE INVENTORY — every dynamic-control candidate, mapped to the pattern + a milestone

### v3.3 (scoped now)
- **Models** → Phase 149. Registry + capabilities + discovery = operator; user picks from enabled set;
  lock = policy flag. Read path already live since mig 053; 149 is the write-UI + discovery.
- **Secrets / API keys** → Phase 150. **No user layer at all** — always operator-only, encrypted at
  rest (app-layer `cryptography`; only true secrets stay env). The one thing that is *purely*
  governance with no "preference within" half.
- **Profile-menu split** → SEED-113 (see routing below). The user-side mirror of the operator shield.

### v3.4 governance / org-RBAC backlog (rides this same pattern — SEED-115 territory, one-way door)
- **Per-group / department greenlists** — today's VIS-01 is the degenerate "Everyone / Operators-only"
  case; groups arrive with SSO/SCIM (Glean tier 2).
- **Retrofit the two-layer pattern onto existing Settings knobs** — retrieval/top-k/threshold/hybrid
  weights, chunking, embedding model, provider routing/failover (`MODEL_CAPABILITIES`), sandbox config
  (image/timeouts), ingestion knobs, rate limits. Each gets: operator allowed-set + lock + privilege-gate.
- **Cost/budget caps + usage dashboards** — deferred v3.4; prerequisite for scheduled runs.
- **Scheduled / recurring triggers** — deferred v3.4.
- **Permission-aware doc access (folder-level ACL)** — SEED-115 tier 3; touches retrieval + citations.
- **This is where the operator's stated horizon — automation + integration — lives.**

### Already settled elsewhere (do NOT re-litigate)
- **Eval-matrix targets** stay in **Skill Studio** (near the run), not global Settings — per
  project_dynamic_settings_direction; the Trigger Tuner's per-provider "configured targets" pattern.
- **Engine-health card** → a future dedicated **System Health / observability page** absorbs it
  alongside library/document health, re-embed health, run reconciliation, cost/usage. Naming already
  fixed ("Eval engine health"); relocation deferred to the observability milestone.

## Profile-menu (SEED-113) — routing decision

- **Confirmed direction:** top-right identity anchor (name/email/profile/sign-out), tasteful; move the
  *personal* half of Settings there; designed for future role/tier badge + org switcher + SSO/SCIM.
- **Routing:** NOT inserted into 149–158 now. It is G-2 sketch-gated (app-shell/nav-rail UI) and pairs
  with BUG-260711-01 (nav crowding) — consider in one sketch pass. Nothing urgent.
  - **Minimal slice** (identity anchor + move personal settings, no new surfaces) = a small dedicated
    phase candidate for **late-v3.3 or v3.4 kickoff**.
  - **Full shape** (role/tier badge, org switcher, per-type settings) = **v3.4**, after tenancy
    (isolated-vs-co-tenant, auth/billing) is decided.

## Why this is safe for the v3.4 one-way door

Everything here is forward-compatible with the deferred org-RBAC rewrite: the audience value is an
**extensible enum-shaped record, never a boolean** (RDD 59); `require_visible` resolves audience
through **one swappable function** ("is operator" → "is in group X"); the roster role column is a
chip-set. Inventing an in-app role/group system now (before tenancy architecture is decided) is
explicitly barred — this decision only locks the *pattern*, not a premature schema.

## Downstream

`/gsd:discuss-phase 149` consumes this note → promotes the boundary rule to a **locked D-149-NN** and
applies the two-layer pattern to the model registry write-UI. SEED-116 is resolved; SEED-113 carries
the profile-menu phase candidate; SEED-115 carries the v3.4 org-RBAC backlog.

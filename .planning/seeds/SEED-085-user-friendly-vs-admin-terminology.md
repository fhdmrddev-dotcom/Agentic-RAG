---
seed_id: SEED-085
title: End-user-friendly UX layer vs admin/technical terminology — a two-audience surface (plain language for real users, raw terms kept for the technical admin who configures the app)
status: planted
planted: 2026-06-14
phase_origin: "Phase 103 live UAT session 2026-06-14 — operator feedback while building real workflows in the Builder"
category: UX / information-architecture — a cross-cutting simplification layer, NOT a new feature
related_seeds: [SEED-084, SEED-086]
related_memories: [feedback_vibe_coder_communication, project_settings_design_guidance, project_103_planned]
re_open_triggers:
  - Before the v2.9 Workflow Studio milestone closes (operator: "we need anyway to do at some stage before we close this milestone some simplification of user experience and reduce many technical terms").
  - Any new authoring/config surface is specced (it should inherit the plain-language default + an admin/technical reveal).
  - A real (non-builder) end user is onboarded and trips on jargon.
priority: high
---

## The idea

The platform has TWO audiences with opposite needs:
- **Real end users** (domain experts running/authoring workflows) want plain language: "Instructions", "Folders it can read", "Sourcing strictness" — no schema jargon.
- **The technical admin** who deploys/configures the app needs the precise terms (`prompt`, `folder_scope`, `citation_policy`, `phase_type`, `available_tools`) to reason about behavior, debug, and align with the API/schema.

Phase 103-ux already took a first step in the Builder form: friendly labels + always-visible plain-English helper sentences + an ⓘ that still exposes the raw term, and friendly phase-type labels ("AI agent step", "Deliverable") + real folder/skill NAMES instead of UUIDs. **This seed generalizes that into a deliberate, app-wide two-audience contract** rather than a per-surface afterthought.

## Shape to explore (not committed)

- A consistent **plain-language default** everywhere a real user touches (Builder, Workflows page, run surface, Run modal, publish gauntlet), with the raw technical term available on demand (ⓘ / a "show technical names" admin toggle).
- Possibly an **"admin / advanced mode"** preference (per-user setting) that flips on the raw schema terms + extra knobs for the person administering the deployment.
- A small **glossary / term-map** as the single source of truth (friendly label ↔ schema field ↔ one-line plain helper), so every surface renders consistently and nothing drifts.

## Why now / why a seed

Surfaced repeatedly during the 103 live UAT ("as a user I still do not know what each parameter means"). It is milestone-close polish, not a 103 in-scope item — capture it so the simplification pass is deliberate (one home) before v2.9 ships, and so future surfaces inherit the contract instead of re-introducing jargon.

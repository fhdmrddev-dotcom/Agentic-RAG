---
seed_id: SEED-123
title: Visual / no-code workflow authoring + live-run observability for business end-users (Beam/Glean/n8n-class) — an authoring+UX layer ON TOP of the existing governed harness engine
status: open
planted: 2026-07-18
planted_during: v3.4 new-milestone (operator strategic observation — the engine is solid but authoring is still AI/technical-only; wants drag-and-drop, business-friendly, competitor-grade)
category: product / workflow authoring UX — a net-new visual-authoring + observability surface; the engine itself is NOT rebuilt
priority: high
scope: Large
operator_preference: "Operator wants this on the UX/end-user-experience track prioritized RIGHT AFTER v3.4 (ahead of Open Platform / Automations) — pairs with the UI/UX-polish cluster (SEED-045 + the parked chat-polish bugs). Confirm sequencing at v3.4-close /gsd:new-milestone."
related_seeds: [SEED-051, SEED-086, SEED-045, SEED-085, SEED-052, SEED-113, SEED-058]
related_memories: [project_v34_milestone_started, project_target_scale, feedback_vibe_coder_communication, feedback_iterate_leverage_existing, feedback_business_value_framing]
re_open_trigger: "When the Workflow track reopens post-v3.4 (a dedicated 'Workflow Studio — Visual / No-Code Authoring' milestone), OR a customer/end-user needs to self-author workflows from their business process without technical vocabulary, OR any phase proposes touching the workflow Builder / phase-spine graph / run surface (build ON this direction, don't fork it)."
---

# SEED-123 — Visual / no-code workflow authoring for business end-users

## The observation (operator, 2026-07-18)

The workflow **engine** is working very well and is effectively a **separate, attachable, disable-able** engine (locked harness: ordered phases, per-phase tool whitelists, validation gates, publish gauntlet; flag-gated; Deep Mode byte-identical when off). **But authoring is still over-complicated and AI/technical-only.** A *business* end-user cannot sit down and *draw* their process. The competitive bar (Beam AI, Glean AI; and the no-code class — n8n / Zapier / Make / Flowise / LangFlow) is a **visual, drag-and-drop, business-friendly** authoring experience with **flexibility + visibility** both while building AND while the workflow runs.

## Why This Matters

Positions the product against the named competitors (D-PRD-05 Glean primary), and unlocks **end-user self-authoring by business requirement** — the difference between "a developer configures workflows" and "a Legal/HR/Finance user builds their own." That is squarely the B2B end-user adoption story ([[project_target_scale]]).

## The one hard design question (capture so we don't lose it)

The engine's *strength is its governance* — the locked phases, tool guards, and publish gauntlet that make a workflow **trustworthy + safe + observable**. A drag-and-drop canvas for non-technical users must **keep those safety rails while hiding the jargon.** Reconciling **easy visual authoring ↔ governed/safe/observable** is the heart of this milestone (it is a UX+product problem, NOT an engine rebuild). Beam / Glean / n8n each solve it differently — study them.

## Build ON what exists (NOT a rewrite — [[feedback_iterate_leverage_existing]])

The engine the operator is happy with stays. This is a new authoring + observability *layer*:
- **Read-only vertical phase-spine graph → make it EDITABLE** (the canvas / drag-and-drop).
- **Strict/loose two-door model** (Phase 124: Describe & run / Author & govern) → the visual canvas becomes a **third, most-approachable door**.
- **Plain-language layer** (v3.3 LANG-01) + terminology split ([[SEED-085]]) → the "less technical terms" half is an existing pattern.
- **Live run surface / phase timeline** (Phases 094/095/103) → the "visibility while it's running" half already exists to extend.
- **NL authoring** ([[SEED-051]], realized in v2.9/103) → the AI can *seed* a canvas the user then edits (AI + visual, not either/or).
- **Multi-tenancy (v3.4)** makes it better — per-department visual authoring wants the org/role model underneath.

## Scope (when triggered) — a dedicated milestone

- A real **canvas editor**: draggable nodes = phases, connections = flow, side-panel node config, live validation (can't build an invalid/unsafe workflow — the gauntlet rules enforced *in the canvas*, not only at publish).
- A **business-friendly node vocabulary** (map phase-types / tools / gates onto plain business verbs — "Find documents", "Ask the AI", "Get approval", "Produce a report").
- **Run observability**: a live, legible view of the workflow executing (which node is active, inputs/outputs, gate pass/fail) — for non-technical users, not the developer timeline.
- **Flexibility + visibility** both at author-time and run-time, per the operator's ask.
- Reconcile with governance: the canvas cannot let a business user build something unsafe or ungoverned — the rails are *expressed visually*, never removed.

## Why NOT now / NOT v3.4

v3.4 is the one-way multi-tenancy door — orthogonal. This is a Large net-new UX build (canvas + node model + observability). It is **better after v3.4** (orgs/roles enable per-dept authoring). Operator preference is to prioritize it on the UX track right after v3.4 — see `operator_preference` frontmatter; confirm at v3.4-close `/gsd:new-milestone`. **Recommendation on record:** do NOT bundle this Large build with the lighter UI/UX-polish + chat-polish cluster ([[SEED-045]]) — they are different kinds of work (build vs cleanup); sequence them as adjacent-but-separate milestones.

## v3.4-close confirmation (2026-07-22) — sequencing locked + hard requirements added

At the v3.4-close `/gsd:new-milestone`, the operator **confirmed** the recorded sequencing: **v3.5 = UX Consolidation & Chat Polish** (the lighter cleanup cluster — [[SEED-045]] + the parked chat-surface bug backlog + new v3.4 org-surface polish + plain-language extensions), then **this seed = v3.6 = Visual Workflow Studio**, run **research-first**. The two stay separate milestones (do NOT bundle the Large build with the polish pass — re-confirmed).

**Three operator-stated HARD requirements for the v3.6 build (captured verbatim so they become acceptance gates, not hopes):**

1. **Preserve v1 + revert-at-any-time.** The existing, working workflow engine AND its current authoring doors ("Describe & run" / "Author & govern") must stay untouched and **feature-flagged**, so if the visual canvas breaks anything we flip the flag off and land back on exactly today's behavior. Revertibility is a milestone acceptance gate, not a nice-to-have. (Already the design intent — "build ON what exists, NOT a rewrite" + the standing D-14 red line / flag-gated harness / Deep byte-identical — but now an explicit, tested gate.)
2. **Study the best-in-class and beat them.** Research **Glean AI + Beam AI + n8n** (the three the operator named) — plus the no-code class (Zapier / Make / Flowise / LangFlow) — for how each reconciles easy drag-and-drop authoring with governed/safe/observable execution. Take the best patterns; the bar is to compete with and beat them.
3. **Comprehensive external-integration story.** A no-code builder eventually connects to the outside world — **email, JIRA, and other external providers**. This ties the visual-builder milestone to the **connector / integration platform** (Open Platform track — REST API + MCP + service accounts, [[SEED-013]] / [[SEED-031]]). Open research question the v3.6 milestone MUST answer up front: does the builder ship its own connector framework, or does it sequence with / depend on Open Platform? Decide via research, not blind.

## Related
[[SEED-051]] (NL workflow authoring — realized; the AI-seed half) · [[SEED-086]] (visual multi-agent representation — run-viz sibling) · [[SEED-045]] (UI/UX polish pass — the adjacent cleanup track) · [[SEED-085]] (user-vs-admin terminology) · [[SEED-052]] (interactive HITL todo-driven execution) · [[SEED-113]] (profile/identity — the org-authoring context).

---
gsd_state_version: 1.0
milestone: v2.9
milestone_name: "Workflow Studio"
status: defining_requirements
stopped_at: "v2.9 milestone started — defining requirements 2026-06-08"
last_updated: "2026-06-08"
last_activity: 2026-06-08
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-08 — v2.9 Workflow Studio milestone started)

**Core value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared.
**Current focus:** v2.9 Workflow Studio — turn the v2.8 harness into an authorable, KB-grounded, skill-connected workflow capability that produces real deliverables (template-fill). Project management is the flagship demo. Defining requirements.

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-06-08 — Milestone v2.9 Workflow Studio started (goals locked, deep research brief written, requirements next)

**Next action:** Confirm `.planning/REQUIREMENTS.md` → spawn roadmapper for `.planning/ROADMAP.md`. First build step will be **a spike** (fill a Risk Register from a KB folder, SEED-051) before any schema locks, and a **`/gsd:sketch`** pass for the Workflows page / form editor / live graph (G-2 fires).

## Milestone scope (locked 2026-06-08)

v2.9 = **Workflow Studio** — a value-first reframe of the provisional "Plugin Contract & Extension System." The headline insight from the deep research brief: v2.9 is ~80–90% composition of shipped v2.8 harness primitives; net-new is *authoring UX + a project/scope binding + ephemeral template upload + a small validation-gate library + the Workflows page* — NOT a new runtime, NOT the Plugin Contract.

**5 scope forks resolved:**
1. Scheduled/recurring execution → **DEFERRED** (hard-depends on a budget/spend-ceiling system that doesn't exist; v3.4 territory). v2.9 = author + run on demand.
2. Self-serve global sharing + operator role tier → **DEFERRED** (v3.1). v2.9 keeps drafts + per-user publish (RLS already enforces).
3. Template-fill magic → **BOTH** patterns: trusted project-library templates use docxtpl/Jinja; arbitrary uploads use non-Jinja run-replace. Spike sets how far the arbitrary path is pushed.
4. Citation-traceable grid renderer → **STRETCH**.
5. PM flagship demo → **single template-fill** (status report from KB) as the spike + acceptance bar; standup-to-artifacts cascade = showcase content after primitives proven.

Plugin Contract is OFF the critical path (STRETCH: lock `phase_type` + `file_preview` on flagship telemetry + one PPTX preview reference plugin). Connectors (email/OneDrive/GDrive) → SEED-013/014 (v3.3/v3.4). **Enhanced Document Structure** (M-Files/Doxis basics, SEED-005) = NEXT milestone after v2.9 (operator-confirmed 2026-06-08).

Research brief: `.planning/research/v2.9-EXPLORATION.md` (+ 6 dimension reports A–F under `.planning/research/v2.9-exploration/`).

## Seeds folded / routed (v2.9, /gsd:new-milestone seed scan)

- **SEED-051** (generalized NL→workflow authoring) → **FOLDED** as v2.9 CORE (spike-first — the spike answers the 4 unknowns that become the schema).
- **SEED-037** (workspace panel office/PDF/PPTX viewing + download) → partial overlap with template preview / `file_preview` plugin → STRETCH.
- **SEED-013** (external integrations: API + MCP + webhooks) → connectors deferred; re-open trigger: first `data_source` plugin design (first reference = read-only GDrive/OneDrive folder→KB sync).
- **SEED-014** (automations & routines) → scheduled execution + scheduled ingestion deferred to v3.4.
- **SEED-005** (DM / M-Files-Doxis basics) → **NEXT milestone after v2.9** (Enhanced Document Structure).
- **SEED-040 / SEED-012** (model-registry self-service / admin-operator UI) → operator tier + metadata-model-flexibility deferred (v3.1 / DM milestone).
- **SEED-052** (interactive todo-driven HITL) → adjacent to `llm_human_input` review-with-provenance checkpoints; noted.

## Open reported-bugs sweep (2026-06-08, /gsd:new-milestone mandate)

3 open `surface: Agentic-RAG` reports — **none fold into v2.9 CORE** (all Deep-mode chat / provider / live-execution polish, outside the Workflow Studio authoring domain). They sit in the SC#10 cross-provider blast radius (workflows run in a thread, share the composer + live-execution panel) → v2.9 UAT must not regress them.

| Report | Sev | Disposition |
|---|---|---|
| `general-chat-intermittent-silent-send-drop` | minor | leave open — tracked as SEED-055 residual |
| `minimax-m3-invalid-tool-args-400` | minor | leave open — provider-specific; MiniMax low-priority; re-open trigger: cross-provider workflow UAT surfaces it |
| `setting-up-agent-hides-model-activity` | major | leave open — Deep-mode dispatch-latency banner; candidate for a focused Deep-UX polish phase |

## Workflow guardrails firing (v2.9)

- **G-2 (sketch-before-plan) FIRES** — Workflows page / NL-form editor / live read-only graph are live UI; `/gsd:sketch` before `/gsd:spec-phase`/`/gsd:discuss-phase`. `sketch-findings-agentic-rag` already names these surfaces.
- **G-6 (failure criteria upfront)** — each phase SPEC carries a "How we'd know this failed" section; template-fill known failure modes (run-split miss, XML corruption, pptx row-growth, xlsx chart strip, produced-file-won't-open) become UAT rows up front.
- **G-1/G-5 (hot-file caps)** — authoring work is greenfield (new page, new API router, additive optional model fields); it does NOT pile onto the G-5-firing hot files (`threads.py`, `anthropic_service.py`). Engine additions are additive seams on `harness/phase_types.py` + `models/harness.py`. `backend/app/api/threads.py` extraction remains due (carried).

## Accumulated Context

**Open blockers:** none.

**Key decisions** (full log in PROJECT.md → Key Decisions): D-v2.8-01 (harness now; Plugin Contract was deferred to v2.9 — **now reframed**: Plugin Contract OFF the v2.9 critical path, value-first Workflow Studio instead, lock `phase_type`+`file_preview` on flagship telemetry as STRETCH), GATEWAY-01 (one shared provider gateway, Deep byte-identical — workflows consume it, never re-implement), D-094-UNIFY (panel = single live-execution surface for Deep + Harness), D-095.1 (run honesty = projection/classification over existing data; provider handling at the gateway boundary). New v2.9 design anchors from research: "project = folder" as the single scope object; immutability = "no-edit-published" not "no-grow-format" (additive optional fields keep old workflows validating); LLM produces DATA, deterministic code produces the FILE; output-quality judge gate is a HARD publish blocker.

**Deferred items carried from v2.8 close (2026-06-07):** 43 acknowledged items — full inventory in `.planning/milestones/v2.8-MILESTONE-AUDIT.md` (and the prior STATE.md in git history). Headline: CONC-01 partial → SEED-065-B (cross-tab GET p95 ~3 s residual); PARITY-01 re-deferred; 11 dormant forward seeds (SEED-002/003/004/005/040/041/042/043/044/045/046); SEED-048/050/057 carried/active.

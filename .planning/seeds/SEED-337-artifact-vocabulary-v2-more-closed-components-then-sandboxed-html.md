---
seed_id: SEED-337
title: Artifact vocabulary v2 — grow the closed registry past chart/table/metric (A), then decide deliberately on sandboxed agent-authored HTML/React like Claude.ai (B)
created: 2026-10-03
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: "The next phase after 273 closes that touches the artifact registry (frontend/src/components/chat/artifacts/**, backend/app/models/artifact.py, backend/app/services/show_artifact_tool.py) — OR the next /gsd:new-milestone sweep. Direction A is the default next step; direction B needs its own operator decision before any planning."
trigger_paths: ["frontend/src/components/chat/artifacts/**", "backend/app/models/artifact.py", "backend/app/services/show_artifact_tool.py", "supabase/migrations/*message_artifacts*"]
trigger_surfaces: ["chat", "sandbox"]
migration_note:
relates_to:
  - SEED-193 — the closed-vocabulary rationale this extends; slice 1 shipped in Phase 273
  - SEED-194 — image generation; an image is one natural v2 entry
  - SEED-185 — no URL router; richer artifacts raise the "can I link to it?" ask
  - Phase 273 — show_artifact, migration 202 message_artifacts, OV-273-02/03 still owed
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-337: Artifact vocabulary v2 — more closed components first, sandboxed HTML as a separate decision

## The finding

Phase 273 shipped agent-authored artifacts with a registry of **exactly three** components —
`chart` (line / bar / area / scatter), `table`, `metric` — validated by a Pydantic discriminated union
with `extra="forbid"` (`backend/app/models/artifact.py`) and a hand-rolled frontend guard
(`frontend/src/components/chat/artifacts/artifactSpec.ts`). Roadmap SC#4 pinned "exactly three", so the
size was deliberate for v1.

The operator (2026-10-03, during 273-06 UAT) asked for more artifact types, "similar to what Claude.ai
does". Two different things answer that ask, and they must not be conflated:

- **A — more CLOSED components.** Same model as 273: the model fills data into components WE wrote.
  Candidates: diagram (Mermaid-like, rendered by our code, never raw SVG from the model), document /
  rich markdown, code block with language, timeline, KPI grid (several metrics), image (SEED-194),
  map, pie/donut (rejected in 273 D-05 — revisit). Each is one union arm + one component + one guard
  arm; the I-1 invariant (no runtime-added component) holds.
- **B — sandboxed agent-authored HTML/React**, which is what Claude.ai artifacts mostly are: the model
  writes code that runs in an isolated iframe. Unbounded expressiveness (mini-apps, interactive
  widgets). It REVERSES SEED-193's "never raw markup" principle and touches the Extension Contract
  (`docs/EXTENSION-CONTRACT.md`): it needs a separate origin for the iframe, a strict CSP, no access to
  the user's session/data, and a review of what the sandbox may fetch.

## Why it matters

Users compare against Claude.ai. Three components cover numbers well but not explanations (diagrams,
documents), so the agent still falls back to prose or a PNG for those. A is cheap and safe; B is the
"anything goes" answer and a security project.

## When to surface

Any phase whose `files_modified` touches the artifact registry paths above, or the next
`/gsd:new-milestone` sweep. **Recommendation recorded at capture: do A as the next artifact phase;
treat B as its own operator decision after A ships** — never fold B into an A phase.

## Scope estimate

- A: Medium — ~1 phase, 3-5 plans; each new component is small, the cost is SC#10 per-provider proof
  and keeping the closed vocabulary closed.
- B: Large — security architecture (origin isolation, CSP, postMessage contract), a new trust model
  for agent output, cross-provider code-quality variance.

## Breadcrumbs

- Phase 273: `.planning/phases/273-agent-authored-artifacts/` (CONTEXT D-01..D-21, I-1..I-5; UI-SPEC
  UI-D-01..10; board 2026-10-03: 8/8 required rows emitted + rendered, 7/8 by-reference follow-up).
- Operator ask, verbatim intent: "we should support more than that similar to what cloud AI does"
  (2026-10-03). Note: "two kinds" in the ask — 273 actually ships three.

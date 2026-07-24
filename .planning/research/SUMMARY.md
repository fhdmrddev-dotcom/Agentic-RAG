# Project Research Summary

**Project:** Agentic RAG - v3.6 Visual / No-Code Workflow Studio
**Domain:** Drag-and-drop visual authoring canvas + non-technical live run-observability layer, added ON TOP of an existing governed multi-tenant harness workflow engine (build-on-not-rewrite)
**Researched:** 2026-07-24
**Confidence:** HIGH

## Executive Summary

This is not a workflow-engine build - it is a UX and integration project over a governed engine that already exists and is trusted. The harness engine (WorkflowDefinition, reachability.lint_workflow, the 8-stage publish gauntlet with the llm_judge hard-wall, per-phase tool whitelists, per-version immutability) already does the hard governance work; v3.6's job is to express that governance visually through a drag-and-drop canvas and a plain-language run view, without forking or duplicating it. All four researchers converged independently on the same shape: add @xyflow/react (React Flow v12 - MIT, React-19-compatible, uses the app's existing zustand internally) as a pure client-side projection of WorkflowDefinition; constrain it to the engine's linear phase-spine grammar (ordered phases + one skip_to_phase branch) rather than a free DAG; reuse the existing draft-CRUD, publish, and NL-generation routes verbatim; and add exactly one new server route, POST /workflows/validate, that reuses lint_workflow plus the grounding-fidelity checks so the canvas can never drift from the gauntlet it must ultimately pass.

The headline competitive finding is a category difference, not a feature race: nobody in the field (Glean, Beam AI, n8n, Zapier, Flowise/LangFlow) enforces governance structurally at author-time - they validate node config or bolt guardrails on at run-time, and their open canvases become "confusing" / "too crowded" as logic grows (independently reported across sources). Our engine already makes governance the shape of the artifact itself; surfacing that live in the canvas ("you cannot draw an invalid/unsafe workflow") is the one thing no competitor can copy without rebuilding their engine. Everything else - AI-seeded drafts, business vocabulary, templates, per-node model choice - is largely reuse of work already shipped (SEED-051 NL authoring, SEED-085 terminology, v3.3 plain-language layer, v3.4 org RLS).

The key risks all live at the seam between the new visual layer and the old governed engine, and the four researchers name the same five: (1) the revert gate lies if any migration isn't purely additive-nullable or any new route isn't flag-gated at every layer; (2) client-side validation drifts from the server gauntlet if anyone ports lint_workflow to TypeScript; (3) node layout data poisons the immutable WorkflowDefinition JSONB if positions aren't kept in a separate, engine-blind store; (4) the friendly run view lies if it only listens to happy-path events and silently shows "done" on a failed gate; and (5) connectors - the field's classic SSRF / credential-leakage / cross-tenant-bleed trap (n8n shipped exactly this CVE class) - must ride the existing per-phase tool whitelist and be sequenced last, ideally onto the not-yet-started Open Platform (SEED-013) MCP substrate rather than as a bespoke framework built twice.

## Key Findings

### Recommended Stack

The entire net-new runtime cost is one canvas library plus two small helpers - everything else composes what's already installed (React 19.2.4, Vite 8, Tailwind, shadcn/ui, zustand 5, react-query 5). No backend Python additions are required for the canvas or run-viz; both read/write the existing WorkflowDefinition JSON via the existing authoring API and the existing Redis run stream.

**Core technologies:**
- @xyflow/react (React Flow v12, ^12.11.2) - the node-based canvas (draggable phase-nodes, edges, pan/zoom, isValidConnection, controlled state). MIT-licensed, peer react: ">=17" (React 19 explicitly in-range - the app is on React 19.2.4, not React 18), and decisively it uses zustand internally, the exact store already shipped. Nodes/edges render as ordinary React components, so custom phase-nodes are plain Tailwind/shadcn JSX. Use @xyflow/react, never the frozen old reactflow (v11) package name.
- zundo (^2.3.0) - the one gap React Flow leaves: undo/redo. A less than 1 KB temporal middleware built for zustand v5 - no reason to hand-roll an immer-patch history stack.
- react-hook-form + zod + @hookform/resolvers (optional, shadcn-idiomatic) - for richer node-config side-panel forms. Hard constraint: Pydantic on the server stays authoritative; zod is a client-side mirror for instant field hints only, never a fork of the validation source of truth.
- elkjs - defer. The authored graph is a deterministic vertical spine; a hand-rolled layout (as PhaseSpineGraph.tsx already does) is sufficient. Add elkjs only if run-viz ever needs to depict llm_batch_agents fan-out as a branching layout (prefer over dagre, which is unmaintained).

**What NOT to use:** LangGraph/LangChain (violates the raw-SDK rule and would fork the runtime the harness engine already owns), Flowise/LangFlow/n8n as an embedded runtime (study their UX only - running any of them creates a second, competing engine), tldraw (non-MIT SDK license + mandatory watermark in production).

### Expected Features

**Must have (table stakes):** editable node canvas (the read-only phase-spine made editable), side-panel node configuration (the PhaseConfig discriminated union already IS the form schema), business-friendly node vocabulary ("Find documents", "Ask the AI", "Get approval" - extends v3.3 LANG-01 + SEED-085), AI-seeded canvas (wire the existing NL generator, SEED-051, onto the canvas instead of a form), templates/starter flows (Starter Library already shipped), node-level validation badges (lint_workflow output surfaced per-node), live run observability, versioning/drafts/revert (already exist - immutable-on-publish + UNIQUE(slug, version)), HITL approval as a visible node (llm_human_input phase type already exists), and some external-action node (the connector question - see below).

**Should have (the headline differentiator):** build-time FLOW validation live in the canvas - "you cannot draw an invalid or unsafe workflow." No named competitor validates the flow, only node config (n8n's red/green badges) or run-time behavior. This is our category-level win because governance is the shape of the artifact, not a bolted-on check. Also differentiating: structural governance rendered as literal canvas rails (locked order, tool whitelists, gates you can't wire around), per-claim cited deliverables (nobody else grounds business documents), cross-provider per-step model choice, RLS-enforced multi-tenant per-department authoring, and an AI-seed that structurally cannot emit an unsafe node (the response schema IS the extra="forbid" union).

**Defer / anti-features:** a fully-open drag-anything-to-anything DAG canvas (the field's own recurring failure mode - "becomes confusing," "too crowded" - and it would let a business user compose an ungoverned flow); building a bespoke 275/400-app connector catalog from scratch (a "forever job" per SEED-013 - adopt MCP instead); a raw code/custom-script node on the business canvas (keep code inside the sandboxed execute_code phase); a user-facing "autonomy level" slider that loosens governance (Beam ships one - wrong for a governed builder); a second parallel run-execution route/runtime for the visual layer (violates D-14); replacing the two existing authoring doors (hard-requirement #1); real-time collaborative multi-cursor editing (not table stakes, heavy CRDT infra, defer).

### Architecture Approach

The canvas is a pure projection of WorkflowDefinition, never a second source of truth: one client-side serializer (canvasModel.ts) provides toCanvas(def) and fromCanvas(nodes, edges), and every write still goes through the existing POST "" / PATCH /{id} / POST /{id}/publish / POST /generate routes, which already model_validate the body as WorkflowDefinition. The server never sees "nodes/edges." Node positions live outside the definition JSONB - either computed deterministically at render (MVP, zero migration) or in a new nullable workflow_layouts side table the engine never reads - because WorkflowDefinition is extra="forbid" and stuffing layout into it would corrupt the golden-run hash and the publish immutability trigger. Live in-canvas validation is a new, thin POST /workflows/validate route that reuses lint_workflow + _check_grounding_fidelity verbatim (never a client re-implementation - this is the anti-drift seam). Run-observability is a second view, not a second data path: CanvasRunView reads the same usePhases(threadId) hook PhaseTimeline already uses, keyed by phase.slug === node id, so the developer timeline and the business graph view are two presentations over one Redis-backed run stream. The whole layer is gated by one new governed feature key (visual_workflow_canvas, default "operators"), following the exact v3.3 skill_studio pattern, so flipping it off is provably byte-identical to today.

**Major components:**
1. WorkflowCanvas (React Flow host) + canvasModel.ts (the one serializer seam) + PhaseNode.tsx custom nodes - the authoring surface, sibling to (not replacing) WorkflowBuilderPage/PhaseSpineGraph.
2. POST /workflows/validate + harness/canvas_validate.py - server-authoritative live lint, reusing reachability.lint_workflow and the grounding-fidelity checks.
3. CanvasRunView - business-friendly run-viz painting node state from the existing usePhases(threadId)/phasesByThread slice; no new Redis events, no new demux.
4. workflow_layouts (optional, nullable side table) - free-placement node positions, engine-blind, dead-until-flagged.

### Critical Pitfalls

1. **The canvas becomes a second, drift-prone rule engine.** Porting lint_workflow/gauntlet rules to client TypeScript for instant feedback will drift from the server truth within one or two phases. Fix: expose lint_workflow behind a debounced POST /workflows/validate; the client only ever renders server-computed errors, never defines them; grounding lists (tools/folders/skills) come from a server-provided bundle, never a frontend constant.
2. **Flag-off is not byte-identical to today (HARD GATE #1 failure).** A flag that only hides UI but leaves a non-nullable migration, an always-mounted route, or a silent edit to the existing doors/run surface makes "revert" unsafe exactly when it's needed. Fix: additive-nullable-only schema, require_visible/404-gate every new route at every layer, and a real test_revert_byte_identical CI + live-close gate - not a prose claim.
3. **Lossy/corrupting canvas-to-definition round-trip.** Stuffing node x/y/layout into the WorkflowDefinition JSONB either 422s on extra="forbid" or, worse, forces relaxing the injection guard (T-090-01) and turns a cosmetic node drag into a new definition version that re-arms the golden-run gauntlet. Fix: layout lives in a separate nullable column/table the engine never reads; the definition round-trip is tested byte-identical across the 4 canonical seed shapes + the PM pack.
4. **Dishonest run observability.** A "simplified" run view that only subscribes to happy-path events will show a green "done" on a gate_failed/run_failed - a business user ships a broken deliverable trusting the checkmark. Fix: model node state as a total function over the full event set (never infer success from absence), and reconcile-on-fetch on every reconnect (Realtime is a hint, not truth - the standing D-v2.5-03 rule).
5. **SSRF / credential leakage / cross-tenant bleed from connectors (HARD REQ #3's sharpest edge).** The moment a business user wires an email/JIRA/webhook target, the classic no-code holes open - n8n shipped a real CVE where SSRF protection was only active "when a credential is attached." Fix: an unconditional egress allow-list + SSRF guard on every outbound fetch regardless of credential state, org-scoped Fernet-encrypted credentials resolved server-side by reference (never in the definition JSONB or the client), and a dedicated cross-org leak test before any connector ships.

## Implications for Roadmap

Research converges strongly on one dependency-ordered build sequence - the roadmap should follow it directly. Almost every table-stakes feature depends on something that already exists; the only genuinely net-new backend surface is external connectors, which is correctly last and thinnest, not the foundation.

### Phase 1: Revert Foundation
**Rationale:** Operator HARD gate #1 (preserve-v1, tested revert-at-any-time) must be provably true before any feature work lands on top of it - every later phase inherits a proven off-switch.
**Delivers:** New governed feature key visual_workflow_canvas in _GOVERNED_FEATURES (default "operators", the exact v3.3 skill_studio pattern), gated nav entry, an empty gated route, and a test_revert_byte_identical CI gate asserting both existing authoring doors + the run surface are unchanged with the flag off.
**Addresses:** Hard-req #1 (preserve-v1/revert).
**Avoids:** Pitfall 2 (flag-off not byte-identical).

### Phase 2: Server Validation Seam
**Rationale:** Every later phase (editable canvas, AI-seed, vocabulary) needs a place to check its work without drifting from the gauntlet - build the anti-drift seam before anything calls it.
**Delivers:** POST /workflows/validate + harness/canvas_validate.py, reusing WorkflowDefinition.model_validate, reachability.lint_workflow, and _check_grounding_fidelity verbatim.
**Uses:** Backend-only reuse - no @xyflow/react required yet.
**Implements:** The shared-validator architecture (one lint implementation, never re-authored client-side).
**Avoids:** Pitfall 1 (governance fork).

### Phase 3: Read-Only Canvas
**Rationale:** Prove the projection (toCanvas) and the node vocabulary skeleton before adding write/persistence complexity.
**Delivers:** WorkflowCanvas.tsx rendering an existing WorkflowDefinition via @xyflow/react, deterministic auto-layout (no elkjs yet), read-only (nodesDraggable=false).
**Uses:** @xyflow/react, canvasModel.toCanvas.
**Implements:** Canvas-as-pure-projection pattern (layout computed, not persisted).

### Phase 4: Editable Canvas (Round-Trip)
**Rationale:** The core deliverable - the milestone doesn't exist without editable nodes/edges - but only after the projection and validation seams are proven so drift can't sneak in.
**Delivers:** Add/move/connect/delete -> canvasModel.fromCanvas -> live-validate (Phase 2) -> save via the EXISTING draft CRUD (create-once-then-PATCH). Optional workflow_layouts side table only if free placement is confirmed at sketch.
**Addresses:** Editable node canvas, side-panel node config (table stakes).
**Avoids:** Pitfall 3 (lossy round-trip / layout-in-JSONB).

### Phase 5: Concurrency & Autosave
**Rationale:** v3.4 already made workflows org-shareable; a drag canvas invites continuous autosave, so the clobber/version-explosion risk must be closed before real usage, not discovered live.
**Delivers:** Draft edits PATCH one row in place (never mint a version); optimistic-concurrency token or soft lock for two-editor org-shared workflows; publish guarded against reading a dirty draft.
**Avoids:** Pitfall 5 (autosave version explosion / co-edit clobber). UAT MUST include a parallel-thread/two-editor row (SC#10 parallel axis).

### Phase 6: Business Vocabulary + AI-Seeded Canvas
**Rationale:** G-2 fires (sketch-first mandatory - node vocabulary is a "feels like" surface). Sits on the validated model from Phases 2-4 so vocabulary work isn't built on shifting ground.
**Delivers:** Business-verb to phase-type map (extends v3.3 LANG-01 + SEED-085) with a Technical-names reveal; wiring of the existing POST /generate NL draft (SEED-051) into toCanvas.
**Addresses:** Business-friendly vocabulary, AI-seeded canvas (table stakes); the "AI-seed that can't emit an unsafe node" differentiator.
**Avoids:** Pitfall 7 (jargon leak or over-simplified vocabulary) - validate expressiveness against the PM pack + Starter Library + all 4 canonical seed shapes as the acceptance bar, not a toy demo.

### Phase 7: Non-Technical Run-Observability
**Rationale:** G-2 fires again (live "feels like" surface). Needs the node-to-phase-slug identity established in Phase 3/4 (toCanvas node id equals phase.slug).
**Delivers:** CanvasRunView reading the same usePhases(threadId) slice PhaseTimeline uses - no new Redis events, no new demux - painting pending/active/passed/failed/skipped/waiting-for-you as a total function over the full event set.
**Addresses:** Live run observability, "the field's blind spot" differentiator (a genuinely non-technical run view; n8n/Flowise are developer-grade, Beam is shallow).
**Avoids:** Pitfall 4 (dishonest "done" on a failed gate) - reconcile-on-fetch on reconnect (D-v2.5-03), never trust Realtime alone.

### Phase 8: External Connectors - LAST, thin, sequenced
**Rationale:** Highest new security surface (the app's first outbound-to-arbitrary-destination capability), and it carries the own-framework-vs-Open-Platform decision the operator explicitly wants research to settle. Sequenced last so it never gates the UX-first core.
**Delivers:** Research verdict is MCP-first, first-party-thin, Open-Platform-sequenced - do NOT build a bespoke connector catalog inside v3.6. Model a connector as an MCP-backed action node governed by the existing per-phase tool whitelist (zero new governance concept); ship 2-3 first-party high-value connectors (email out, JIRA/ticket create, Slack notify) as the demo-able story; credentials org-scoped via the existing Fernet enc:v1: pattern, resolved server-side by reference, never in the definition JSONB. Everything broader (full catalog, inbound webhooks, service accounts, public API) sequences with Open Platform (SEED-013), not forked into v3.6. Correction to carry into requirements: SEED-031 is NOT the connector seed - it's "Direct Provider SDK Integrations" (DeepSeek/Kimi/MiniMax/GLM, LLM providers, already folded into 076.1). The real connector track is SEED-013 (plus sibling SEED-014 Automations & Routines).
**Addresses:** Hard-req #3 (external-integration story).
**Avoids:** Pitfall 6 (SSRF / credential leakage / cross-tenant bleed - the n8n "guarded only when credential attached" CVE class). Each connector-touching phase gets a mandatory /gsd:secure-phase with threats_open: 0, plus a dedicated cross-org leak test (the SEED-124/125 precedent).

### Phase 9 (conditional): Scale Hardening
**Rationale:** Only if a real workflow or a real org fan-out exceeds the expected small scale (harness workflows are typically 5-50 phases).
**Delivers:** React Flow onlyRenderVisibleElements + node memoization if node counts exceed roughly 100-150; elkjs auto-layout only if llm_batch_agents fan-out needs a branching visual; indexed org-scoped reads for the Workflows list at many-orgs times many-workflows scale.

### Phase Ordering Rationale

- **Governance-before-features:** Phases 1-2 (revert flag, validation seam) are pure infrastructure with zero user-visible surface, deliberately shipped before any canvas pixel exists - both HARD gates (#1 revert, structural governance) depend on nothing else being built first.
- **Read-before-write:** Phase 3 (read-only) proves the projection model cheaply before Phase 4 commits to full round-trip persistence - catches serializer bugs before they're compounded by concurrency.
- **Foundation-before-feels-like:** Vocabulary (6) and run-viz (7) are explicitly sequenced after the round-trip (4) and concurrency (5) foundations are solid, per Pitfalls research - G-2 sketch-first surfaces need a stable model underneath them, not a moving target.
- **Connectors last by design, not neglect:** every researcher independently placed connectors at the end - Architecture frames it as an unstarted-dependency risk (SEED-013 is a 6-10 phase milestone), Pitfalls frames it as the highest new security surface, Features frames it as "don't build a forever-maintenance catalog," Stack frames the framework choice as MEDIUM confidence requiring an operator decision.

### Research Flags

Needs deeper research/decision during planning:
- **Phase 8 (Connectors):** the own-framework-vs-Open-Platform-sequencing decision is explicitly framed, not resolved, by research - this needs an operator decision at requirements/discuss-phase time before Phase 8 can be planned in detail. Also needs a /gsd:secure-phase pass (SSRF/credential/cross-tenant threat model) given it's the app's first user-supplied-destination egress surface.
- **Phase 4 (Editable Canvas):** whether the workflow_layouts side table ships in v3.6 or is deferred (auto-layout-only MVP) is a sketch-time UX call, not fully closed by research.
- **Phase 6 & 7:** both trigger G-2 (sketch-first mandatory - /gsd:sketch before /gsd:plan-phase) per the workflow guardrails; treat as "needs a sketch pass," not "needs external research."

Phases with standard, well-documented patterns (reuse-heavy, low research risk):
- **Phase 1 (Revert Foundation):** identical to the shipped v3.3 skill_studio/model_management feature-flag pattern - known-good, just repeat it.
- **Phase 2 (Validation Seam):** pure server-side reuse of lint_workflow, already pure/tested.
- **Phase 3 (Read-Only Canvas):** React Flow's controlled-mode + custom-node pattern is HIGH-confidence, officially documented, and directly maps onto PhaseSpineGraph.tsx's existing glyph/parsing logic.
- **Phase 5 (Concurrency):** mirrors the existing publish_definition WR-03 draft-status-guard pattern already proven in this codebase.

### Watch item for discuss-phase (not a research flag, an orchestrator note)

This milestone will put 6+ phases through PhaseSpineGraph.tsx, WorkflowBuilderPage.tsx, PhaseTimeline.tsx/PhaseCard.tsx, and StreamsProvider.tsx in sequence - the same hot-file class that triggered G-5 refactor phases in the 075.x chat-surface cascade. Track a parallel hot-file ledger for these workflow-studio files from Phase 1 onward and apply G-5 (refactor-before-3rd-touch) proactively rather than reactively.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Canvas library choice verified against npm registry, xyflow repo package.json, and official docs (React-19 peer range, zustand-internal fact, MIT license). Connector-framework option space is explicitly MEDIUM/framed-not-decided by design. |
| Features | MEDIUM-HIGH | Competitor patterns (Glean/Beam/n8n/Zapier/Flowise/LangFlow) cross-corroborated across 4+ independent sources each with marketing-page inflation discounted; internal engine-mapping (what we already have) is HIGH from direct codebase reads. |
| Architecture | HIGH | Every integration point (routes, models, hooks, tables) was read directly from the live source tree and named verbatim, not inferred. Competitor/library architectural comparisons are MEDIUM. |
| Pitfalls | HIGH | Governance-fork, round-trip, revert, and connector pitfalls are grounded in the actual WorkflowDefinition model, lint_workflow, publish_service, and existing org/RLS + Fernet secrets code. Competitor-specific patterns and React-Flow scale thresholds are MEDIUM (WebSearch-verified, not measured in this repo). |

**Overall confidence:** HIGH

### Gaps to Address

- **Connector scope decision (own MVP slice vs. pure Open-Platform sequencing):** genuinely open - SEED-013 is an unstarted 6-10 phase milestone with its own timeline; the roadmap needs an explicit operator call at requirements time on whether Phase 8 ships a live email/JIRA demo in v3.6 or is fully deferred.
- **workflow_layouts side table vs. pure auto-layout MVP:** left as a sketch-time decision by both Stack and Architecture research; resolve during Phase 3/4 discuss-phase, not before.
- **MCP spec version pinning:** Features/Architecture both flag MCP as the recommended connector substrate but note the spec is still evolving - Phase 8 needs to pin a version and plan a deprecation cycle (SEED-013's own risk note).
- **Concurrency mechanism (soft lock vs. optimistic token):** Pitfalls research explicitly calls "second editor gets a soft lock / read-only banner" an "acceptable first cut" - the precise UX (block vs. warn vs. merge) needs a sketch/discuss-phase decision, not a research answer.
- **elkjs need for llm_batch_agents fan-out visualization:** deferred by all four researchers pending confirmation that run-viz actually needs to depict batch fan-out as a branching layout - revisit at Phase 7 sketch.

## Sources

### Primary (HIGH confidence)
- Live codebase reads (all four research files): backend/app/models/harness.py, backend/app/db/workflows.py, backend/app/api/workflows.py, backend/app/services/harness/publish_service.py, reachability.py, validators.py, phase_types.py, backend/app/services/workflow_authoring.py, backend/app/services/harness_engine.py, backend/app/dependencies.py, backend/app/models/user_settings.py, frontend/src/components/workflows/PhaseSpineGraph.tsx, frontend/src/pages/WorkflowBuilderPage.tsx, frontend/src/components/panel/PhaseTimeline.tsx, frontend/src/providers/StreamsProvider.tsx, frontend/src/hooks/useEffectiveFeatures.ts, frontend/package.json.
- npm registry / xyflow repo packages/react/package.json (via gh api) - @xyflow/react 12.11.2, peer react ">=17", MIT.
- reactflow.dev + Migrate to React Flow 12 guide + Performance docs.
- zundo (npm/GitHub) - v2.3.0, zustand v4.2+/v5 temporal middleware.
- tldraw license docs - non-MIT, production license-key + watermark.
- Planning docs: .planning/PROJECT.md (v3.6 + D-14), .planning/seeds/SEED-123 (anchor), .planning/seeds/SEED-013 (Open Platform / connector substrate), .planning/seeds/SEED-031 (verified: LLM-provider seed, NOT connectors).

### Secondary (MEDIUM confidence)
- Glean product/docs (glean.com/product/agent-builder, docs.glean.com/agents, glean.com/product/agent-governance, glean.com/connectors) - canvas model, permission-inheritance governance, MCP+OpenAPI connector extension.
- Beam AI (beam.ai/platform, beam.ai/ai-agents) - autonomy dial + HITL + command-center dashboard.
- n8n docs + CVE writeups (docs.n8n.io, n8n issue #28218, Upwind "Six n8n CVEs") - node-level-only validation, RBAC/projects, the SSRF-only-when-credential-attached CVE class.
- Zapier (zapier.com AI Guardrails, approval-process automation) - run-time content-safety governance.
- Flowise/LangFlow comparisons (blckalpaca.at, huggingface.co blog, leanware.co) - open-canvas complexity trap corroboration.
- MCP-as-2026-standard (workos.com, dev.to, generect.com) - 500-1,000+ servers, Anthropic/OpenAI/Google adoption.
- Nango / Paragon / Composio connector-platform comparisons (nango.dev blog, composio.dev) - connector-framework option space.
- React Flow performance guidance (Synergy Codes optimization guide, xyflow discussion #4975) - memoization/virtualization thresholds.

### Tertiary (LOW confidence)
- None flagged - all four research files rated their non-codebase sources MEDIUM (WebSearch-verified, multi-source corroborated) rather than LOW.

---
*Research completed: 2026-07-24*
*Ready for roadmap: yes*

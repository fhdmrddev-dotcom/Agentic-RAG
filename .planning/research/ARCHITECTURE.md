# Architecture Research

**Domain:** Visual / no-code workflow authoring + non-technical run-observability layer ON TOP of an existing governed harness workflow engine (v3.6 / SEED-123)
**Researched:** 2026-07-24
**Confidence:** HIGH (integration points read directly from the live codebase; competitor/library recommendations are MEDIUM)

> Scope note: this is a **subsequent-milestone integration architecture**, not a greenfield domain survey. Every "existing" component below was read from the real source tree and is named verbatim so the roadmap/sketch/plan steps can wire to it. The heart of v3.6 is a **UX+product problem** (easy visual authoring ↔ governed/safe/observable), NOT an engine rebuild — the engine's governance is *expressed visually*, never removed (SEED-123).

---

## Standard Architecture

### System Overview — where the new layer attaches

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  NEW visual layer  (v3.6 — 100% additive, gated by `visual_workflow_canvas`)   │
│  ┌───────────────┐  ┌──────────────────┐  ┌───────────────┐  ┌──────────────┐  │
│  │ Canvas editor │  │ Canvas model ↔   │  │ Live validate │  │ CanvasRunView│  │
│  │ (React Flow)  │  │ WorkflowDefinition│ │ (as-you-build)│  │ (biz run-viz)│  │
│  │ nodes+edges   │  │  serializer       │  │  client seam  │  │              │  │
│  └───────┬───────┘  └────────┬─────────┘  └───────┬───────┘  └──────┬───────┘  │
├──────────┼───────────────────┼────────────────────┼─────────────────┼──────────┤
│  EXISTING authoring surface (untouched; flip flag OFF = land here exactly)      │
│  ┌────────────────────┐  ┌──────────────────────┐  ┌────────────────────────┐   │
│  │ WorkflowBuilderPage │ │ PhaseSpineGraph      │  │ WorkflowDoorSwitch      │   │
│  │ (describe-first)    │ │ (READ-ONLY spine)    │  │ Describe&run/Author&gov │   │
│  └─────────┬───────────┘ └──────────────────────┘  └────────────────────────┘   │
├────────────┼────────────────────────────────────────────────────────────────────┤
│  EXISTING server contract (the ONE authoring API — reused verbatim)             │
│  api/workflows.py:  POST "" · PATCH /{id} · POST /{id}/publish · POST /generate  │
│  gate: Depends(require_visible("workflow_authoring"))    [+ NEW: /validate]      │
├──────────────────────────────────────────────────────────────────────────────┤
│  EXISTING governed engine (D-14 red line — byte-identical, NO new runtime)      │
│  ┌─────────────────┐  ┌───────────────────┐  ┌──────────────┐  ┌────────────┐   │
│  │ WorkflowDefinition│ │ publish_service   │  │ reachability │  │ harness_    │  │
│  │ (Pydantic strict) │ │ (8-stage gauntlet │  │ .lint_workflow│ │ engine.     │  │
│  │ + immutable JSONB │ │  + judge HARD wall│  │  (PURE)      │  │ run_workflow│  │
│  └─────────────────┘  └───────────────────┘  └──────────────┘  └─────┬──────┘   │
│  PHASE_TYPE_REGISTRY (6 executors) · validators (closed) · tool_dispatcher      │
├──────────────────────────────────────────────────────────────────────────────┤
│  EXISTING run substrate (reused as-is for run-viz)                              │
│  Redis: run:{run_id} · runs_by_thread:{tid} · runs:active   → StreamsProvider   │
│  phasesByThread demux (onPhaseStarted/Completed/Failed/Substep) → usePhases()    │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Status |
|-----------|----------------|--------|
| `backend/app/models/harness.py::WorkflowDefinition` | The immutable, strict-parsed (`extra="forbid"`) JSON spec: slug/version/name/status/phases + project/asset/business_requirement fields | **EXISTING — do not touch** |
| `backend/app/db/workflows.py` | Draft CRUD + `publish_definition` flip + immutability trigger + Tweak-fork. `UNIQUE(slug, version)` | **EXISTING — reuse verbatim** |
| `backend/app/api/workflows.py` | The only authoring HTTP surface; every write gated `require_visible("workflow_authoring")` | **EXISTING — reuse; ADD one `/validate` route** |
| `backend/app/services/harness/publish_service.py::publish` | 8-stage gauntlet (business_req → lint → golden run → judge HARD wall → flip) | **EXISTING — reuse; the canvas is just another client** |
| `backend/app/services/harness/reachability.py::lint_workflow` | PURE structural lint (orphan/skip/terminal/index/input) | **EXISTING — the shared validation seam** |
| `backend/app/services/harness_engine.py::run_workflow` + `PHASE_TYPE_REGISTRY` | The locked transition loop + 6 thin executors | **EXISTING — untouched (D-14)** |
| `frontend/.../workflows/PhaseSpineGraph.tsx` | READ-ONLY vertical spine (plain HTML/CSS, no graph lib) | **EXISTING — fallback / evolves into the canvas** |
| `frontend/.../panel/PhaseTimeline.tsx` + `StreamsProvider` `phasesByThread` | The developer live run surface over Redis events | **EXISTING — the run-viz reads the SAME slice** |
| **Canvas editor** | Drag nodes=phases, connect=flow, side-panel config | **NEW** |
| **Canvas↔Definition serializer** | Bidirectional map: nodes/edges ⇄ `WorkflowDefinition` phases + `on_failure` skip edges | **NEW** |
| **`POST /workflows/validate`** | Server-authoritative as-you-build lint (reuses `lint_workflow` + `model_validate` + grounding fidelity) | **NEW** |
| **CanvasRunView** | Business-friendly run-viz painting node states from `usePhases()` | **NEW** |
| **`workflow_layouts`** (optional) | Nullable side table for free-placement node positions | **NEW — dead-until-flagged** |

---

## Recommended Project Structure (net-new files only)

```
frontend/src/
├── components/workflows/
│   ├── canvas/                       # NEW — the visual layer (gated)
│   │   ├── WorkflowCanvas.tsx        # React Flow host; nodes=phases, edges=flow
│   │   ├── canvasModel.ts            # serializer: WorkflowDefinition ⇄ {nodes,edges}
│   │   ├── nodeVocabulary.ts         # phase_type/tool/gate → business verbs (SEED-085)
│   │   ├── PhaseNode.tsx             # a canvas node (reuses PHASE_GLYPHS by value)
│   │   ├── useCanvasValidation.ts    # debounced POST /workflows/validate
│   │   └── CanvasRunView.tsx         # run-viz over usePhases(threadId)
│   └── (existing PhaseSpineGraph / PhaseFormPanel / WorkflowDoorSwitch …)
└── pages/
    └── WorkflowCanvasPage.tsx        # NEW third door host (gated nav entry)

backend/app/
├── api/workflows.py                  # MODIFY (additive): + POST /workflows/validate
├── services/harness/
│   └── canvas_validate.py            # NEW: thin reuse of lint_workflow + fidelity
└── (engine / models / db / publish_service … UNTOUCHED)

supabase/migrations/
└── 114_workflow_layouts.sql          # NEW (optional): nullable side table, engine never reads
```

### Structure Rationale

- **`components/workflows/canvas/` as a sibling, not a replacement:** the existing `PhaseSpineGraph`/`PhaseFormPanel`/`WorkflowBuilderPage` stay byte-intact so the flag-off state is exactly today. The canvas is a new folder the flag mounts.
- **`canvasModel.ts` is the single serializer seam** — one file owns the nodes/edges ⇄ `WorkflowDefinition` mapping so it can't drift across the editor, run-viz, and AI-seed paths.
- **Server validation in `harness/`, not a new package** — it must live next to (and import) `reachability.lint_workflow` so there is provably one lint implementation.

---

## Architectural Patterns

### Pattern 1: Canvas is a PROJECTION of `WorkflowDefinition`; layout lives OUTSIDE it (Q1)

**What:** The canvas graph model (`{nodes[], edges[]}`) is a **pure derived projection** of the authoritative `WorkflowDefinition`, not a parallel source of truth. `canvasModel.ts` provides two pure functions:

- `toCanvas(def): {nodes, edges}` — one node per `PhaseSpec` (node **id === `phase.slug`**, node type === `config.phase_type`); solid edges from the implicit `phase_index` `i→i+1` order; dashed edges from each validator's `on_failure: "skip_to_phase:<slug>"` (mirrors `reachability.parse_skip_target` and the existing `PhaseSpineGraph.parseSkipTarget`).
- `fromCanvas(nodes, edges): WorkflowDefinition` — re-derive `phases[]` with contiguous `phase_index` from the edge order, fold skip-edges back into `validators[].on_failure`.

**Where the mapping lives:** entirely client-side in `canvasModel.ts`. The server never sees "nodes/edges" — it only ever receives a `WorkflowDefinition` on the EXISTING `POST ""` / `PATCH /{id}` routes (which already `model_validate` the body as `WorkflowDefinition`, `extra="forbid"`). This keeps the wire contract unchanged.

**Positions — do NOT persist them inside `definition` JSONB.** `WorkflowDefinition` is `extra="forbid"`; adding `x/y` to a `PhaseSpec` would (a) force a model change, (b) serialize layout into the immutable definition, and (c) change the bytes the golden-run/publish path hashes and the judge grades. Two clean, additive options:

| Option | Where positions live | Trade-off | Recommendation |
|--------|----------------------|-----------|----------------|
| **A. Deterministic auto-layout (MVP)** | Nowhere — computed from `phase_index` at render (exactly like `PhaseSpineGraph` today) | Zero persistence, zero migration; no free 2D placement | **Default for the first cut** |
| **B. `workflow_layouts` side table** | New nullable table `(definition_id FK, layout jsonb, updated_at)`; engine never reads it | Enables free placement; still additive/dead-until-flagged; a **side table (not a column on `workflow_definitions`)** dodges the published-row immutability trigger | **Add only when free placement is a confirmed requirement** |

Avoid a nullable `layout` column ON `workflow_definitions`: the `workflow_definitions_block_published_update` trigger (Postgres `23514`, BEFORE UPDATE) would forbid re-laying-out a published workflow's view. The side table sidesteps this.

**Per-version immutability is preserved for free** because the canvas edits go through the EXISTING draft CRUD:
- Edit a draft → `PATCH /workflows/{id}` (`update_workflow_definition` is `status='draft'`-gated).
- Publish → `POST /{id}/publish` flips draft→published (the ONLY flip site).
- Edit a PUBLISHED workflow → the existing **Tweak fork**: a new `create_workflow_definition` INSERT with `version = published_N + 1`, same slug; the frozen published row is never UPDATEd (`UNIQUE(slug, version)` keeps them distinct). The canvas inherits this by simply loading the forked draft — no new immutability logic.

**Example:**
```ts
// canvasModel.ts — the ONE serializer seam (pure, no I/O)
export function toCanvas(def: WorkflowDefinition): { nodes: Node[]; edges: Edge[] } {
  const ordered = [...def.phases].sort((a, b) => a.phase_index - b.phase_index)
  const nodes = ordered.map((p, i) => ({
    id: p.slug, type: p.config.phase_type,
    position: autoLayout(i),            // Option A: derived, not stored
    data: { phase: p },
  }))
  const edges = ordered.flatMap((p, i) => [
    ...(i < ordered.length - 1 ? [seqEdge(p.slug, ordered[i + 1].slug)] : []),
    ...skipEdges(p),                    // on_failure: "skip_to_phase:<slug>"
  ])
  return { nodes, edges }
}
```

**Trade-offs:** projection keeps one source of truth (no divergence bugs) but constrains the canvas to what the definition can express (the existing spine is strictly linear + skip branches — no `depends_on`, no parallel lanes; see `READ_ONLY_LEGEND`). That constraint is a *feature*: the canvas can only draw runnable, governed shapes.

### Pattern 2: Live validation reuses the publish gauntlet's PURE stages via a server seam (Q2)

**What:** As-you-build validation must enforce the SAME rules the publish gauntlet enforces, without a client re-implementation that drifts. The publish gauntlet (`publish_service.publish`) runs, in order: `model_validate` → `lint_workflow` (pure) → interactive-phase check → **golden run** → **judge**. Only the first three are cheap+deterministic; the golden run + judge are expensive/interactive and stay at publish.

**Where the shared seam is:** add **`POST /workflows/validate`** (new route in `api/workflows.py`, gated by the same `require_visible`) delegating to a thin `harness/canvas_validate.py` that runs EXACTLY the gauntlet's pre-run stages against the posted working definition:
1. `WorkflowDefinition.model_validate(body)` → shape errors (`extra="forbid"`, discriminator, the two structural model-validators `_folder_scope_requires_project` / `_skill_snapshot_requires_ref`).
2. `reachability.lint_workflow(def)` → `LintError[]` (orphan / unsatisfiable_skip / no_terminal / bad_index / input_unsatisfied) — **the same function `publish_service` stage 2 calls**.
3. Grounding/whitelist fidelity: `workflow_authoring._check_grounding_fidelity` + `harness.scope.assert_folder_scopes_subset` (tool names ∈ registry, `skill_ref` ∈ owner/global skills, `folder_scope` ⊆ project subtree) — the same server-authoritative checks the NL author already runs.

The canvas calls `/workflows/validate` **debounced** on every edit and paints per-node error badges from the returned `LintError[]` (keyed by `phase_slug`). The client keeps ONLY trivial, non-authoritative edge-drawing parses (e.g. `parseSkipTarget` for rendering the dashed edge) — never the pass/fail decision.

**Why not validate purely client-side:** the whitelist/grounding checks require server state (the tool registry, the owner's skill set, the folder subtree) that KB content must not be able to whitelist itself with (the T-103-02-03 injection guard). Server-authoritative validation is the anti-drift guarantee.

**Trade-off:** a network round-trip per edit (debounced ~300ms). Acceptable — the lint is pure/fast and the fidelity reads are cached owner-scoped reads. The judge/golden-run stays at publish (surfaced by the EXISTING `PublishGauntlet.tsx`), so the canvas honestly shows "structurally valid" ≠ "publishable" — the same two-tier honesty the read-only Builder already conveys.

### Pattern 3: Non-technical run-viz is a second VIEW over one `phasesByThread` slice — never a data fork (Q3)

**What:** The business run-viz reuses the entire existing run substrate — no new Redis events, no new store, no new demux. The engine already emits `phase_started` / `phase_completed` / `phase_transition` / `phase_substep` / `run_completed` / `run_failed` / `ask_user_prompt` on `run:{run_id}`; `StreamsProvider` already demuxes them into the `phasesByThread` map (mutators `appendPhaseForThread`, `setPhaseStatusForThread`, `setPhaseEmitSubstepForThread`, `finalizeEarlierPhasesForThread`, `finalizeAllPhasesForThread`) and exposes them via `usePhases(threadId)`.

**The mapping onto canvas nodes:** `CanvasRunView` calls the SAME `usePhases(threadId)` hook `PhaseTimeline` uses, and paints each canvas node by matching **`phase.slug` === node id** (the identity `toCanvas` already establishes), coloring `running`/`done`/`failed`/`skipped`/`retrying` onto the node. Sub-step honesty (`phase_substep`: forcing/emitting/validating/rendering, or a terminal `failure`) rides the same `usePhases` fields. A mid-run reconnect gets the forward-only skeleton from `getThreadWorkflow(threadId)` (`total_phases` reconcile floor) exactly as `PhaseTimeline` does.

So the **developer timeline** (`PhaseTimeline`, list-shaped) and the **business run-viz** (`CanvasRunView`, graph-shaped) are two presentational views over ONE data slice — the fork is purely visual, never in the store or the wire. This satisfies SEED-123's "distinct from the developer timeline" without forking the run surface (G-5).

**Example:**
```tsx
function CanvasRunView({ threadId }: { threadId: string | null }) {
  const { data: phases } = usePhases(threadId)      // SAME hook PhaseTimeline uses
  const byslug = new Map(phases.map(p => [p.slug, p.status]))
  // paint node border/glyph from byslug.get(node.id) — active/passed/failed
}
```

**Trade-off:** the canvas node id must stay stable === `phase.slug` across author-time and run-time. This is already how both `PhaseSpineGraph` and the `phasesByThread` demux key phases, so it's a preserved invariant, not a new constraint.

### Pattern 4: One new governed feature key gates the whole visual layer (Q4)

**What:** The revert seam (operator HARD requirement #1) uses the SHIPPED feature-visibility machinery (v3.3 VIS-01), NOT a bespoke flag. Add ONE key — recommend **`visual_workflow_canvas`** — to `_GOVERNED_FEATURES` in `models/user_settings.py`, defaulting to **`"operators"`** (dark until an operator flips it; revert = flip it back). Then:

- **Backend:** every NEW route (`/workflows/validate`, any canvas-specific route, the optional layout read/write) carries `Depends(require_visible("visual_workflow_canvas"))`. Off → 403 for non-operators (the deliberate "governed product feature" 403, not the /admin 404). The existing `workflow_authoring`-gated routes are UNCHANGED.
- **Frontend:** add a nav entry `{ view: "workflow-canvas", feature: "visual_workflow_canvas" }` to `NAV_ITEMS`; `visibleNavItems(features)` hides it when the key is false; `useEffectiveFeatures` fail-closes to `{}` pre-resolve so it never flashes. Off → the third door simply does not render; the two existing doors (`WorkflowDoorSwitch`) are untouched.

**Additive / dead-until-flagged checklist (the tested acceptance gate):**

| New surface | Dead-when-off guarantee |
|-------------|-------------------------|
| `visual_workflow_canvas` feature key | Defaults `operators`; a fresh env with no seed row cold-reads to `operators` (same polarity as `skill_studio`) |
| Canvas routes (`/workflows/validate`, canvas/*) | `require_visible` → 403 for non-operators; body still `model_validate`s as `WorkflowDefinition` |
| `workflow_layouts` table (if built) | Nullable, engine/`run_workflow`/`WorkflowDefinition` NEVER read it; a NULL layout auto-lays-out |
| Canvas writes | Go through the EXISTING `POST ""` / `PATCH /{id}` — the definition read/execute path is byte-unchanged |
| `WorkflowDefinition` model | UNCHANGED (positions live outside it); so `run_workflow` / `PHASE_TYPE_REGISTRY` / `tool_dispatcher` / the golden-run hash are byte-identical |

**Falsifiable revert test:** with `visual_workflow_canvas=false`, the nav entry is absent, canvas routes 403, and a full describe→draft→publish→run cycle on the existing Builder + engine is byte-identical to pre-v3.6 (extends D-14). This is exactly the shape v3.3 already proved for `skill_studio` / `model_management`, so it's a known-good pattern.

**Why a NEW key, not the existing `workflow_authoring`:** `workflow_authoring` defaults `"everyone"` (the two existing doors must stay available to end users). The visual canvas needs an INDEPENDENT switch that starts OFF so "flip it off → land on today" is a clean, isolated operation that never disables the existing doors.

---

## Data Flow

### Authoring flow (canvas → engine)

```
User drags/connects nodes on WorkflowCanvas
      ↓ (canvasModel.fromCanvas)
Working WorkflowDefinition (in-memory, client)
      ↓ debounced POST /workflows/validate      → LintError[] painted per-node  (Pattern 2)
      ↓ Save  → POST "" (create) / PATCH /{id}   (EXISTING draft CRUD, create-once-then-PATCH)
      ↓ Publish → POST /{id}/publish             (EXISTING 8-stage gauntlet + judge HARD wall)
workflow_definitions row flips draft→published (immutable)
```

### AI-seed flow (NL → canvas → edit)

```
User describes task  → POST /generate  (EXISTING workflow_authoring.generate_workflow_definition)
      ↓ {ok:true, definition}          (grounded, model_validate-clean, NOT persisted)
canvasModel.toCanvas(definition)       → nodes/edges rendered whole in one batch
      ↓ user edits on canvas → (back into the Authoring flow above)
```
This realizes SEED-051 "AI seeds a canvas the user then edits" by reusing `/generate` verbatim — the canvas is just a new consumer of the existing NL draft.

### Run-viz flow (engine → business view)

```
run_workflow emits phase_started/completed/failed/substep on run:{run_id}
      ↓ StreamsProvider demux (onPhase* → phasesByThread, panel-only)
usePhases(threadId)  ──┬──→ PhaseTimeline   (developer list view — EXISTING)
                       └──→ CanvasRunView    (business graph view — NEW, same slice)
```

---

## Scaling Considerations

| Scale | Adjustments |
|-------|-------------|
| 0–1k users | No change. Canvas is client-rendered; `/workflows/validate` is a cheap pure lint + cached owner reads. Auto-layout (Option A) has zero storage cost. |
| 1k–100k | Debounce `/workflows/validate` (≥300ms) and cache the folder/tool/skill grounding sets per session so as-you-build validation doesn't hammer the DB. If free placement (`workflow_layouts`) ships, it's a tiny keyed JSONB read/write — negligible. |
| 100k+ | The run-viz already scales with the shipped Redis run-buffer (replay-and-tail per `run_id`); no new hot path. The only new server cost is `/workflows/validate` — keep it pure/stateless and it scales with the existing API tier. |

**First bottleneck:** as-you-build validation chattiness — mitigated by debounce + grounding-set caching. **Second:** React Flow render cost on very large graphs — mitigated by the fact that governed workflows are small (linear + skip branches, typically < 15 nodes); virtualize only if a real workflow exceeds ~50 nodes.

---

## Anti-Patterns

### Anti-Pattern 1: Re-implementing lint/whitelist rules in the client

**What people do:** Port `lint_workflow` + the tool/skill/folder fidelity checks into TypeScript for "instant" canvas feedback.
**Why it's wrong:** The client copy WILL drift from the server gauntlet, producing "green in the canvas, blocked at publish" (or worse, the inverse). The whitelist/grounding checks also need server state the client cannot safely hold (KB content could whitelist its own citation/tool — the T-103-02-03 guard).
**Do this instead:** `POST /workflows/validate` reusing `reachability.lint_workflow` + `_check_grounding_fidelity` (Pattern 2). The client only does trivial, non-authoritative edge-drawing parses.

### Anti-Pattern 2: Persisting node positions inside `definition` JSONB

**What people do:** Add `x`/`y` to `PhaseSpec` so the layout round-trips with the definition.
**Why it's wrong:** `WorkflowDefinition` is `extra="forbid"`; it changes the model, serializes layout into the immutable row, and alters the bytes the golden-run/judge/publish path depends on. It also collides with the published-row immutability trigger.
**Do this instead:** deterministic auto-layout (MVP) or a nullable `workflow_layouts` side table (Pattern 1, Option B).

### Anti-Pattern 3: Forking the run surface for the business view

**What people do:** New Redis events, a new store slice, or a new demux for the "friendly" run-viz.
**Why it's wrong:** Duplicates the hard-won reconcile/forward-only/panel-only-re-render invariants (`phasesByThread`, PANEL-09) and violates G-5 on the hot files (`PhaseTimeline`/`PhaseCard`/`StreamsProvider`).
**Do this instead:** `CanvasRunView` reads the SAME `usePhases(threadId)` slice; the fork is presentational only (Pattern 3).

### Anti-Pattern 4: A second authoring API for the canvas

**What people do:** New `/canvas` create/update endpoints that speak nodes/edges.
**Why it's wrong:** Splits the write path, duplicates owner-scoping/immutability/publish, and grows the surface the gauntlet must re-cover.
**Do this instead:** the canvas serializes to `WorkflowDefinition` and reuses `POST ""` / `PATCH /{id}` / `POST /{id}/publish` verbatim. The ONLY new route is the read-only `/workflows/validate`.

---

## Connector Integration Point (Q5 — framed, with a recommended default)

**Terminology correction (verified):** the prompt cites SEED-013/031 as the connector track, but **SEED-031 is "Direct Provider SDK Integrations" (DeepSeek/Kimi/MiniMax/GLM — LLM providers), already `status: folded → 076.1`** — it is NOT an external-connector framework. The real connector track is **SEED-013 (Open Platform: versioned REST API + MCP server + webhooks + service accounts)** and its sibling **SEED-014 (Automations & Routines)**. SEED-013's own n8n triage example is *inbound* (n8n calls us); v3.6 canvas "email/JIRA" nodes are *outbound* (we call them) — a capability neither seed has built yet.

**The architectural seam either option plugs into:** the engine already has exactly one place an external action belongs — a **whitelisted tool dispatched through `tool_dispatcher`** inside an `llm_agent`/`programmatic` phase, or a **new phase-type executor** registered in `PHASE_TYPE_REGISTRY`. The per-phase tool whitelist + validation gates already govern it. So "a connector" = "a governed tool/executor," which is the natural, already-safe seam.

| Option | Where it plugs in | Pros | Cons |
|--------|-------------------|------|------|
| **A. v3.6 ships its own thin connector** | New `programmatic`/tool entries (`send_email`, `create_jira_issue`) in `tool_dispatcher` + `PHASE_TYPE_REGISTRY`; secrets via the shipped app-layer Fernet (SEC-01) | Fast; self-contained; a real email/JIRA demo in v3.6; rides existing whitelist+gate governance | Re-invents auth/secrets/rate-limit/retry/webhooks that SEED-013 scopes; risks a throwaway second connector framework; outbound-network safety review needed |
| **B. Sequence-with / depend-on Open Platform (SEED-013)** | Canvas "external action" nodes resolve to registered service-account connectors + outbound webhooks | One durable connector platform; per-consumer auth/quota/observability done once; aligns with the B2B platform thesis | SEED-013 is an unstarted 6–10 phase milestone; depending on it BLOCKS v3.6; over-scopes the UX-first milestone |

**Recommended default (NOT a unilateral decision — operator confirms at requirements):**

> **v3.6 CORE ships the visual authoring + run-viz WITHOUT its own general connector framework.** Represent connectors as a **first-class but explicitly-stubbed node vocabulary** (e.g. an "external action" node that lint-blocks at publish with an honest "connectors arrive with the Open Platform" message) so the canvas is *connector-ready* and the UX is designed for it. **Defer the real outbound connector execution to the Open Platform track (SEED-013), sequenced AFTER v3.6.** IF the operator wants a live email/JIRA demo inside v3.6, do the **thin Option-A slice for exactly those one-or-two actions** as whitelisted `tool_dispatcher` tools (secrets via the shipped Fernet), explicitly scoped as pre-Open-Platform and NOT a general framework.

**Rationale:** SEED-123 states the heart of the milestone is the authoring↔governance UX, not connectors; the connector-scope question is flagged "decide via research, not blind." Building a general connector framework inside a UX milestone is the classic scope-creep trap and would duplicate SEED-013. The governance rails already treat any external action as a governed tool, so nothing is lost by deferring the *framework* while shipping the *node vocabulary* now. This keeps v3.6 focused and preserves the Open Platform as the one durable home for connectors.

---

## Suggested Build Order (Q6 — dependency-ordered)

1. **Sketch first (G-2 fires — mandatory).** The canvas node vocabulary (business verbs, SEED-085), the node/edge model, the side-panel config, and the `CanvasRunView` run-viz. Operator-approved mockup is the acceptance bar. *No dependency; blocks everything visual.*
2. **Feature-flag scaffold FIRST (the revert seam).** Add `visual_workflow_canvas` to `_GOVERNED_FEATURES`, a gated nav entry, and an empty gated route. Land the OFF-lands-on-today gate before any feature so all subsequent work is provably additive-behind-flag. *Depends on: nothing.*
3. **Server validation seam.** `POST /workflows/validate` + `harness/canvas_validate.py` reusing `lint_workflow` + `_check_grounding_fidelity`. *Depends on: nothing (pure reuse); needed by 5 & 7.*
4. **Read-only canvas.** `canvasModel.toCanvas` + `WorkflowCanvas` rendering an existing `WorkflowDefinition` on React Flow, deterministic auto-layout, read-only. Proves projection + node vocabulary without persistence. *Depends on: 2.*
5. **Editable canvas.** Add/move/connect → `canvasModel.fromCanvas` → live-validate (3) → save via EXISTING draft CRUD (create-once-then-PATCH, mirroring `WorkflowBuilderPage.onPersist`). Optional `workflow_layouts` side table only if free placement is confirmed. *Depends on: 3, 4.*
6. **AI-seed the canvas.** Wire the existing `POST /generate` NL draft into `toCanvas` (SEED-051). *Depends on: 4.*
7. **Business run-viz.** `CanvasRunView` over `usePhases(threadId)` (no backend). *Depends on: 4 (node ids) + the existing run substrate.*
8. **Connector decision executed** per Q5 (stubbed node vocabulary in CORE; real execution sequenced to Open Platform / optional thin email+JIRA slice). *Depends on: 5; sequenced last.*

**Critical path:** 2 → 3 → 4 → 5, with 6/7 parallelizable after 4. The flag (2) and the validation seam (3) are the load-bearing early wins: 2 guarantees revertibility, 3 guarantees the canvas can't drift from the gauntlet.

---

## Integration Points

### Internal Boundaries (verified real names)

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Canvas ⇄ server | `POST ""` / `PATCH /{id}` / `POST /{id}/publish` / `POST /generate` / **`POST /validate`** (new) | All speak `WorkflowDefinition`, never nodes/edges. Gated `require_visible` |
| Canvas ⇄ engine | none (indirect) | The canvas never calls `run_workflow`; it produces definitions the existing kickoff path runs |
| Canvas validate ⇄ gauntlet | shared function `reachability.lint_workflow` + `_check_grounding_fidelity` | The anti-drift seam — one lint impl |
| Run-viz ⇄ run substrate | `usePhases(threadId)` over `phasesByThread` | Same slice as `PhaseTimeline`; presentational fork only |
| Layout ⇄ definition | decoupled (`workflow_layouts` side table or none) | Engine never reads layout; immutability untouched |
| Feature gate | `require_visible("visual_workflow_canvas")` + `useEffectiveFeatures` | Reuses shipped VIS-01 machinery |

### External Services (connector track — deferred)

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Email / JIRA / etc. | Whitelisted `tool_dispatcher` tool OR `PHASE_TYPE_REGISTRY` executor | Governed by per-phase whitelist + gates; real execution deferred to SEED-013 (Open Platform) per Q5 |

---

## Sources

- Live codebase (HIGH): `backend/app/models/harness.py`, `backend/app/db/workflows.py`, `backend/app/api/workflows.py`, `backend/app/services/harness/{publish_service,reachability,validators,phase_types}.py`, `backend/app/services/workflow_authoring.py`, `backend/app/dependencies.py` (`require_visible`), `backend/app/models/user_settings.py` (`_GOVERNED_FEATURES` / `feature_audience`).
- Live frontend (HIGH): `frontend/src/components/workflows/PhaseSpineGraph.tsx`, `frontend/src/pages/WorkflowBuilderPage.tsx`, `frontend/src/components/panel/PhaseTimeline.tsx`, `frontend/src/providers/StreamsProvider.tsx` (phase demux + `phasesByThread` mutators), `frontend/src/hooks/useEffectiveFeatures.ts`, `frontend/src/lib/nav-items.ts`.
- Planning (HIGH): `.planning/PROJECT.md` (v3.6 milestone + D-14), `.planning/seeds/SEED-123`, `.planning/seeds/SEED-013`, `.planning/seeds/SEED-031` (verified: LLM-provider seed, NOT connectors).
- Frontend deps scan (HIGH): no graph/canvas/dnd library present (`zustand` + `@tanstack/react-query` only) — a canvas library (React Flow / `@xyflow/react`) is net-new; see STACK.md.

---
*Architecture research for: v3.6 Visual / No-Code Workflow Studio — authoring+observability layer over the governed harness engine*
*Researched: 2026-07-24*

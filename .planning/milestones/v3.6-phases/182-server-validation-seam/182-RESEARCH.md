# Phase 182: Server Validation Seam - Research

**Researched:** 2026-07-24
**Domain:** Backend FastAPI validation seam — reuse-verbatim of the existing harness lint + grounding-fidelity checks behind the `visual_workflow_canvas` flag
**Confidence:** HIGH (every claim below is grounded in code read this session; the only open items are naming/classification calls explicitly delegated to the planner by CONTEXT.md)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (verbatim from `## Decisions`)

**Palette exposure**
- **D-182-01 — Ship a sibling `GET /workflows/grounding-bundle` this phase.** Besides `POST /workflows/validate`, 182 exposes a small, cacheable read endpoint returning the server-sourced valid building-block lists (tool names eligible for `available_tools`, the KB folder tree name+id, enabled owner+global skills eligible for `skill_ref`, and template placeholder fields). Reuses `_assemble_grounding` (`workflow_authoring.py:250-313`), which already computes `tool_names`/`skill_ids`/folder-tree server-side. Rationale: Phase 184's node-config dropdowns must be server-fed, never a frontend constant (Pitfall 1 / ROADMAP SC#2 anti-drift), and building it now de-risks 184. Kept as a SEPARATE cacheable `GET` (NOT embedded in the `/validate` response) because `/validate` is called on every canvas edit — re-sending the full palette each time is wasteful and non-cacheable.

**Check breadth**
- **D-182-02 — `/validate` reports the FULL static publish gauntlet.** The verdict aggregates every STATIC pre-run publish blocker so the canvas previews all of them live: (1) structural lint (`reachability.lint_workflow` — orphan / unsatisfiable-skip / no-terminal / bad-index / input-unsatisfied); (2) grounding fidelity (folder-scope ⊆ project subtree + `available_tools` ∈ registry + `skill_ref` ∈ enabled set — `_check_grounding_fidelity`); (3) `business_requirement` present (D-13 publish invariant); (4) interactive-phase-can't-publish (`llm_human_input` / `ask_user` on_failure — the WR-04 pre-run block). **Golden-run + judge (publish stages 3-4) are LIVE-only and explicitly OUT of scope** — validate is a static, no-provider seam. Rationale: the seam's whole purpose is "the canvas can never drift from the publish gauntlet" (ROADMAP SC#2); reporting only lint+grounding would still let a user draw a workflow that bounces at publish for a missing business requirement or an interactive phase. Each added check is a cheap pure/DB check already implemented.
  - **Reuse-verbatim note:** the check FUNCTIONS are reused, not re-implemented. `lint_workflow` is pure — import directly. `_check_grounding_fidelity` + `_assemble_grounding` are today private to `workflow_authoring.py` and coupled to NL-gen — extract into ONE shared source so both NL-gen and validate call the same copy (the anti-drift mechanism; location = discretion, the "one source" property is REQUIRED). `_interactive_phase_failures` (`publish_service.py:402`) is already a module-level pure helper — reuse verbatim.

**Verdict shape & severity**
- **D-182-03 — Verdicts carry a severity/category.** The per-node verdict is `{ code, phase (nullable), message, severity }` where `severity ∈ {error, incomplete}`. The route CLASSIFIES the verbatim checks' outputs — it does NOT change the checks: hard structural violations (bad_index, orphan_phase, unsatisfiable_skip, no_terminal, grounding-fidelity failures) → `error`; not-yet-ready conditions (empty draft, missing `business_requirement`, `input_unsatisfied` while still wiring, interactive-phase) → `incomplete`. Lets Phase 184/185 paint "you're still building" differently from "this is broken" without the frontend re-deriving the taxonomy.
  - **Per-node keying (ROADMAP SC#4):** every verdict maps to a `phase`/node id = the phase `slug` (the identity 183's read-only canvas and 188's run-viz paint onto — mirrors the 181/183 `node id == phase.slug` contract). Workflow-global findings (bad contiguity, no-terminal, missing business_requirement) carry `phase: null`. The envelope also carries an overall `ok`/`valid` boolean — a single "can this pass?" signal — aligned with the existing `{ok, error, detail}` grounding shape + the D-08 publish verdict.

**Canary retirement**
- **D-182-04 — Retire the 181 `/canvas/ping` canary in 182.** `POST /workflows/validate` (and the `GET` bundle) are real `require_canvas`-gated routes, so the throwaway canary's job is done. Remove `backend/app/api/canvas_canary.py` + its `main.py:688` include, and REPOINT `test_revert_byte_identical`'s "a canvas-gated route 404s when off" assertion onto the real `POST /workflows/validate`. SC#3 already requires proving `/validate` 404s-when-off, so the real-route assertion is needed anyway — the canary becomes redundant. Kills dead code a phase earlier than the 181 "182/183" deferral allowed.

**Inherited / red-line (locked — not re-litigated)**
- **D-182-05 — Both routes inherit 181's `require_canvas` 404 posture verbatim.** `/validate` and `/grounding-bundle` attach `Depends(require_canvas())` and return a **byte-identical 404 when `visual_workflow_canvas` is off** — for everyone incl. operators (D-181-01), fail-closed on cold-cache/DB-blip (D-181-02). The off-flag check runs BEFORE any auth dependency can leak route existence (the 181 code-review pre-auth fix: `require_canvas` folds an unauthenticated caller into the byte-identical 404).
- **D-182-06 — Red line D-14: one lint copy, zero client-side re-implementation.** No validation rule is ever re-implemented in the frontend; the canvas is a pure client of this seam. Backend-only: no `@xyflow/react` yet, no migration, no threat model (reuses the authenticated-user + `require_canvas` gate — no new authz), no SC#10.

### Claude's Discretion (verbatim from `## Claude's Discretion`)
- **Shared-grounding module location** — where the extracted `_check_grounding_fidelity` + `_assemble_grounding` land (new `harness/grounding.py`? co-locate near `reachability.py`?). REQUIRED property = ONE shared source both NL-gen and validate call; location is open.
- **Auth stacking** — whether to ALSO stack `require_visible("workflow_authoring")` on the two new routes (the existing authoring routes carry it) or gate on `require_canvas` alone. Lean: `require_canvas` is the primary/necessary gate; the authoring-visibility stack is a planner call.
- **Unbound / partial definitions** — grounding-fidelity behavior when `project_folder_id=None` (whole-KB) or a definition is mid-draw; `assert_folder_scopes_subset` semantics with no bound project; empty `phases` reported as an `incomplete` no_terminal. Resolve against the existing `assert_folder_scopes_subset` contract.
- **Exact `code → severity` mapping table** and envelope field names (`ok` vs `valid`, `verdicts` vs `findings`) — align with the `{ok, error, detail}` grounding shape + D-08 vocab.
- **Request-shape confirmation** — `/validate` accepts a raw `WorkflowDefinition` body (ROADMAP SC#1); `extra="forbid"` gives a 422 on a malformed body for free (mirrors `create_draft`).
- Plan/wave decomposition.

### Deferred Ideas (OUT OF SCOPE — verbatim from `## Deferred`)
- Node-config dropdowns / side-panel that CONSUME the grounding-bundle → Phase 184.
- Live per-node badge RENDERING from the verdict (VALID-03) → Phase 184.
- Per-node grounding-MODE verdict (grounded-strict vs open) added to the same verdict → Phase 185 (ROADMAP SC#4 "later carry the GOVERN grounding verdict").
- Golden-run + judge (the LIVE half of the publish gauntlet) — stay in publish only, never validate.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VALID-01 | The server exposes `POST /workflows/validate` that reuses the existing `reachability.lint_workflow` + grounding-fidelity checks verbatim — the single source of validation truth; the canvas never re-implements the rules client-side. | All four reuse targets confirmed pure/importable this session: `lint_workflow` (pure, `reachability.py:83`); `_check_grounding_fidelity` + `_assemble_grounding` (`workflow_authoring.py:322`/`:262`) — DB-touching, owner-scoped, extract-and-share; `_interactive_phase_failures` (module-level pure, `publish_service.py:402`); the `business_requirement` presence check (inline predicate, `publish_service.py:124`). Route mount pattern + flag gate + verdict envelope all mapped below. |
</phase_requirements>

## Summary

Phase 182 is a **pure backend reuse-and-expose phase**. There is nothing to invent: all four static publish-gauntlet checks already exist, tested, in the repo. The work is (1) EXTRACT the two grounding functions out of `workflow_authoring.py` into one shared module so NL-gen and `/validate` call the same copy (the anti-drift invariant), (2) MOUNT two new `require_canvas`-gated routes on the existing `/workflows` router, (3) CLASSIFY the verbatim check outputs into a `{code, phase, message, severity}` per-node verdict list, and (4) RETIRE the 181 canary + repoint its 404-when-off tests onto the real routes.

The single load-bearing design decision the planner must nail is the **extraction shape** (Discretion item 1). `_assemble_grounding` today returns a `(grounded_prompt_string, tool_names_set, skill_ids_set)` tuple purpose-built for the NL authoring prompt — but D-182-01's bundle endpoint needs STRUCTURED data (folder tree with ids, tool list, skill list, placeholders), not the NL prose string. The clean move: extract a function that returns the STRUCTURED bundle, then rebuild the NL prompt string FROM that bundle so `generate_workflow_definition` stays byte-for-byte identical. That single structured bundle then feeds `/grounding-bundle` (as JSON) AND the fidelity checks AND (re-rendered) the NL prompt — genuinely one source.

The second subtlety: `_check_grounding_fidelity` **short-circuits on the first violation** and returns one `{ok:false, error, detail}` dict — but `/validate` needs a per-node LIST of all grounding violations. Reuse the three atomic checks verbatim inside a per-node-collecting wrapper (tool + skill checks iterate phases naturally; the folder-⊆ check reuses `assert_folder_scopes_subset` verbatim as a single verdict). Keep the existing short-circuit `_check_grounding_fidelity` for NL-gen unchanged.

**Primary recommendation:** Create `backend/app/services/harness/grounding.py` holding (a) `assemble_grounding_bundle(...) -> GroundingBundle` (structured), (b) `render_grounding_prompt(bundle, project_folder_id) -> str` (the NL string, moved verbatim from `_assemble_grounding`), (c) the three atomic fidelity checks + a `grounding_verdicts(wd, bundle, ...) -> list[Verdict]` per-node collector, and (d) keep `_check_grounding_fidelity` as a thin short-circuit wrapper for NL-gen. Rewrite `workflow_authoring._assemble_grounding` / `_check_grounding_fidelity` to delegate to this module. Mount `POST /workflows/validate` + `GET /workflows/grounding-bundle` on `api/workflows.py` behind `Depends(require_canvas())`, `require_canvas` ALONE (not stacked with `require_visible` — see Pitfall 3). Envelope: `{ "ok": bool, "verdicts": [...] }` with `ok == (verdicts == [])`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Structural lint (reachability) | API / Backend (pure fn) | — | `lint_workflow` is a pure, I/O-free function `[VERIFIED: reachability.py:83-178]`; import directly, no DB. |
| Grounding fidelity (tools/folders/skills) | API / Backend + Database | — | Reads owner folder tree + skill registry via Supabase (`fetch_visible_folders`, `_skill_registry`) `[VERIFIED: workflow_authoring.py:262-313]`; server-side ONLY (KB can never whitelist itself). |
| Grounding palette (`/grounding-bundle`) | API / Backend + Database | CDN/edge (cacheable GET) | Same server-side registries as fidelity; D-182-01 keeps it a cacheable `GET` so the canvas node-config dropdowns are server-fed, never a frontend constant. |
| Business-requirement presence | API / Backend (pure predicate) | — | Inline string-presence check `[VERIFIED: publish_service.py:124]`; no DB. |
| Interactive-phase block | API / Backend (pure fn) | — | `_interactive_phase_failures` reads only `definition.phases` `[VERIFIED: publish_service.py:402-442]`; module-level, pure, reuse verbatim. |
| Flag gate (404-when-off) | Frontend Server (SSR) / API dependency | — | `require_canvas()` FastAPI dependency, off-flag check before auth `[VERIFIED: dependencies.py:600-652]`. |
| Verdict CLASSIFICATION (severity) | API / Backend (route/service) | — | The route maps verbatim check outputs → `{error, incomplete}`; it never changes the checks (D-182-03). |
| Per-node badge RENDERING | (Frontend — Phase 184, OUT OF SCOPE) | — | Deferred. The canvas is a pure client of this seam (D-182-06). |

## Standard Stack

This phase adds **zero new dependencies**. Every building block is already in the repo.

### Core (all reuse — no install)
| Component | Location | Purpose | Reuse mode |
|-----------|----------|---------|------------|
| `lint_workflow(definition) -> list[LintError]` | `backend/app/services/harness/reachability.py:83` | 5 structural codes | Import directly (pure) `[VERIFIED]` |
| `LintError(code, phase_slug, message)` NamedTuple | `reachability.py:31` | Lint result shape | Map `.code`/`.phase_slug`/`.message` → verdict `[VERIFIED]` |
| `parse_skip_target` | `reachability.py:61` | skip-edge parse | Internal to lint; not called by /validate `[VERIFIED]` |
| `_check_grounding_fidelity` | `workflow_authoring.py:322` | 3 grounding checks (short-circuit) | EXTRACT to shared module; keep for NL-gen `[VERIFIED]` |
| `_assemble_grounding` | `workflow_authoring.py:262` | builds registries + NL prompt | EXTRACT: split structured bundle from NL-string render `[VERIFIED]` |
| `_grounding_failed` | `workflow_authoring.py:316` | `{ok:false,error,detail}` shape | Envelope-vocab reference `[VERIFIED]` |
| `assert_folder_scopes_subset` | `backend/app/services/harness/scope.py:197` | folder ⊆ project subtree (raises ValueError) | Reuse verbatim inside grounding checks `[VERIFIED]` |
| `_interactive_phase_failures(definition) -> list` | `backend/app/services/harness/publish_service.py:402` | WR-04 interactive-phase block | Import + reuse verbatim (module-level, pure) `[VERIFIED]` |
| business_requirement predicate | `publish_service.py:124` (`not (definition.business_requirement or "").strip()`) | D-13 publish invariant | Replicate as a tiny shared predicate (see Pitfall 4) `[VERIFIED]` |
| `require_canvas()` | `backend/app/dependencies.py:600` | 404-when-off gate (pre-auth) | Attach via `dependencies=[Depends(require_canvas())]` `[VERIFIED]` |
| `WorkflowDefinition` / `PhaseSpec` / `PhaseConfig` | `backend/app/models/harness.py:221`/`:189`/`:157` | request body + what checks read | `/validate` body type; `extra="forbid"` → 422 for free `[VERIFIED]` |
| `router = APIRouter(prefix="/workflows")` | `backend/app/api/workflows.py:64` | mount point | Add 2 routes here — **G-5 RED LINE: never `api/threads.py`** `[VERIFIED]` |
| `get_tools(None)` | `backend/app/services/openai_service.py:1116` | tool registry (name set) | Palette tool list source `[VERIFIED]` |
| `fetch_visible_folders(supabase, user_id)` | `backend/app/utils/folder_utils.py:119` | owner+org folder tree (`id`, `name`, `parent_id`, `user_id`, ...) | Palette folder source (owner-scoped) `[VERIFIED]` |

### Supporting (already imported by the reuse targets)
| Component | Location | When it fires |
|-----------|----------|---------------|
| `run_in_threadpool` | `starlette.concurrency` / `fastapi.concurrency` | Wrap the blocking `_skill_registry` supabase-py read (D-v2.5-01) — already done inside `_assemble_grounding:280` `[VERIFIED]` |
| `_resolve_template_placeholders` | `workflow_authoring.py:211` | ONLY if the bundle endpoint resolves template placeholders (optional; needs `pool` + `template_asset_id`) `[VERIFIED]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New `harness/grounding.py` module | Co-locate in `reachability.py` | `reachability.py` is deliberately I/O-free/import-light (its docstring: "PURE — no I/O, no DB, no engine import" `[VERIFIED: reachability.py:1-6]`). Grounding TOUCHES the DB (folders/skills). Mixing them poisons the pure-import property that lets `/validate` import lint without pulling DB code. **Recommend a separate `grounding.py`.** |
| Reuse `_check_grounding_fidelity` verbatim for /validate | Per-node collector wrapper over the same atomic checks | The verbatim fn short-circuits on first failure + returns a detail STRING, not a per-node list (`[VERIFIED: workflow_authoring.py:339-355]`). /validate (SC#4) needs all violations keyed per-node. Build a collector from the SAME atomic checks (one source preserved). |
| Embed palette in `/validate` response | Separate `GET /grounding-bundle` (D-182-01) | LOCKED: `/validate` runs on every edit (non-cacheable); the palette is cacheable + static. |

**Installation:** none — `# no new packages this phase`.

## Package Legitimacy Audit

**N/A — this phase installs zero external packages.** It is a backend-only reuse/extraction phase (Python, existing venv). No npm/PyPI/crates install occurs, so the slopcheck gate and registry-verification steps do not apply. Every symbol used is an existing in-repo import verified by `Read`/`Grep` this session.

## Architecture Patterns

### System Architecture Diagram (the /validate request path)

```
                         POST /workflows/validate   (body: raw WorkflowDefinition)
                                    │
                                    ▼
                    ┌──────────────────────────────────┐
   flag off ───────►│ Depends(require_canvas())        │──► 404 (byte-identical, pre-auth)
                    │  (dependencies.py:600)            │
                    └──────────────┬───────────────────┘  flag on + authed
                                   ▼
                    ┌──────────────────────────────────┐
   malformed body ─►│ FastAPI parses body as           │──► 422 (extra="forbid" + @model_validators)
   (shape tier)     │  WorkflowDefinition.model_validate│    ← the SHAPE tier (create_draft parity)
                    └──────────────┬───────────────────┘
                                   ▼  (shape-valid definition)
        ┌──────────────────────────────────────────────────────────────┐
        │  route handler: run the 4 STATIC checks, collect verdicts     │
        │                                                               │
        │  (1) lint_workflow(def)          ─► [LintError] (pure)         │
        │  (2) grounding_verdicts(def,     ─► [Verdict] (DB: folders,    │
        │        bundle)  ← shared module        tools, skills)          │
        │  (3) business_requirement_missing(def) ─► 0/1 Verdict          │
        │  (4) _interactive_phase_failures(def) ─► [Verdict] (pure)      │
        │                                                               │
        │  classify each → severity ∈ {error, incomplete}   (D-182-03)  │
        └──────────────────────────────┬────────────────────────────────┘
                                        ▼
                    { "ok": verdicts==[], "verdicts": [ {code, phase, message, severity} ] }


   GET /workflows/grounding-bundle  (D-182-01, cacheable)
        └─ require_canvas ─► assemble_grounding_bundle(supabase, user_id)
                              ─► { tools:[...], folders:[{id,name,parent_id}], skills:[{id,name}], template_placeholders:[...] }
```

Data-flow note: the SHAPE tier (422) is FastAPI body validation — it fires BEFORE the handler, so a shape-invalid draft never reaches the verdict collector. This is Pitfall-1's three-tier model: **shape = 422**, **structure = lint verdicts**, **publishability = grounding + business_req + interactive verdicts**. Only golden-run + judge stay publish-time (LIVE, out of scope).

### Recommended module/route structure
```
backend/app/services/harness/
├── reachability.py          # UNCHANGED — pure lint (import directly)
├── scope.py                 # UNCHANGED — assert_folder_scopes_subset (reuse verbatim)
├── publish_service.py       # UNCHANGED except: expose _interactive_phase_failures + a
│                            #   shared business_requirement_missing() predicate (or move
│                            #   the predicate into grounding.py and have publish import it)
└── grounding.py             # NEW (Discretion item 1) — the ONE shared grounding source:
                             #   • GroundingBundle dataclass (tools, folders, skills, skill_ids, placeholders)
                             #   • assemble_grounding_bundle(...)          [structured — feeds GET bundle + fidelity]
                             #   • render_grounding_prompt(bundle, pfid)   [NL string — verbatim from _assemble_grounding]
                             #   • the 3 atomic fidelity checks (folder⊆ / tool∈ / skill∈)
                             #   • grounding_verdicts(wd, bundle, ...)      [per-node list — /validate]
                             #   • _check_grounding_fidelity(...)          [short-circuit dict — NL-gen keeps its contract]

backend/app/services/workflow_authoring.py   # _assemble_grounding + _check_grounding_fidelity
                                             #   become THIN delegates to grounding.py (byte-identical output)

backend/app/api/workflows.py   # + POST /validate  + GET /grounding-bundle  (both require_canvas)
backend/app/api/canvas_canary.py   # DELETE (D-182-04)
backend/app/main.py            # remove canvas_canary import (:657) + include (:688)
```

### Pattern 1: Split structured-bundle from NL-prompt render (the anti-drift extraction)
**What:** `_assemble_grounding` currently computes `folders`, `tool_names`, `skills`/`skill_ids`, `placeholders`, then string-renders `folder_tree`/`skill_lines`/`project_line` and concatenates the NL `grounded` prompt, returning `(grounded, tool_names, skill_ids)` `[VERIFIED: workflow_authoring.py:262-313]`.
**When to use:** always — this is THE "one source" mechanism (D-182-02 REQUIRED invariant).
**How:** move the registry computation into `assemble_grounding_bundle(...) -> GroundingBundle`; move the string rendering into `render_grounding_prompt(bundle, project_folder_id) -> str` (lift lines 290-312 verbatim). `workflow_authoring._assemble_grounding` becomes:
```python
# Source: recommended rewrite of workflow_authoring.py:262-313 (behavior byte-identical)
async def _assemble_grounding(*, supabase, pool, user_id, project_folder_id,
                              template_asset_id=None, template_placeholders=None):
    from app.services.harness.grounding import assemble_grounding_bundle, render_grounding_prompt
    bundle = await assemble_grounding_bundle(
        supabase=supabase, pool=pool, user_id=user_id,
        project_folder_id=project_folder_id,
        template_asset_id=template_asset_id, template_placeholders=template_placeholders,
    )
    grounded = render_grounding_prompt(bundle, project_folder_id)
    return grounded, bundle.tool_names, bundle.skill_ids   # ← identical tuple, NL-gen unchanged
```
The GET bundle endpoint returns `bundle.tools / bundle.folders / bundle.skills / bundle.placeholders` as JSON; the fidelity checks read `bundle.tool_names / bundle.skill_ids`. **One computation, three consumers.**

### Pattern 2: Per-node grounding verdict collector (over the verbatim atomic checks)
**What:** `/validate` needs ALL grounding violations, keyed per-node (SC#4). The verbatim `_check_grounding_fidelity` returns after the FIRST `[VERIFIED: workflow_authoring.py:339-355]`.
**How:** a sibling collector in `grounding.py` that runs the SAME three rules but appends instead of returning:
```python
# Source: recommended grounding.py collector — reuses assert_folder_scopes_subset VERBATIM
async def grounding_verdicts(wd, *, supabase, user_id, tool_names, skill_ids) -> list[dict]:
    from app.services.harness.scope import assert_folder_scopes_subset
    out = []
    # folder ⊆ subtree — reuse verbatim; it raises on the first offending phase (names the slug)
    try:
        await assert_folder_scopes_subset(wd, supabase=supabase, user_id=user_id)
    except ValueError as exc:
        out.append({"code": "folder_scope", "phase": None, "message": str(exc)})  # slug is in the message
    # tool ∈ registry / skill_ref ∈ enabled — iterate phases (per-node keying is natural)
    for phase in wd.phases:
        for tool in getattr(phase.config, "available_tools", None) or []:
            if tool not in tool_names:
                out.append({"code": "unregistered_tool", "phase": phase.slug,
                            "message": f"tool {tool!r} is not registered"})
        ref = getattr(phase.config, "skill_ref", None)
        if ref is not None and str(ref) not in skill_ids:
            out.append({"code": "unregistered_skill", "phase": phase.slug,
                        "message": f"skill_ref {str(ref)!r} is not registered"})
    return out
```
Keep NL-gen's `_check_grounding_fidelity` as a thin wrapper: run these rules short-circuit and return the `_grounding_failed(detail)` dict on the first — SAME rules, one source, two presentations.

### Pattern 3: Route mount mirrors `create_draft` / `generate_workflow`
**What:** `POST /validate` takes a raw `WorkflowDefinition` body (mirrors `create_draft` `[VERIFIED: workflows.py:303-304]`); `GET /grounding-bundle` mirrors `generate_workflow`'s `supabase=Depends(get_supabase)` + `current_user` shape `[VERIFIED: workflows.py:640-646]`.
**How:**
```python
# Source: recommended api/workflows.py additions
@router.post("/validate", response_model=ValidateResponse,
             dependencies=[Depends(require_canvas())])           # D-182-05 — require_canvas ALONE
async def validate_workflow(body: WorkflowDefinition,           # extra="forbid" → 422 for free
                            current_user: dict = Depends(get_current_user),
                            supabase=Depends(get_supabase)) -> ValidateResponse:
    ...  # run the 4 checks, classify, return {ok, verdicts}

@router.get("/grounding-bundle", response_model=GroundingBundleResponse,
            dependencies=[Depends(require_canvas())])
async def get_grounding_bundle(current_user: dict = Depends(get_current_user),
                               supabase=Depends(get_supabase)) -> GroundingBundleResponse:
    ...
```
**Route-ordering:** declare `/validate` and `/grounding-bundle` as explicit STATIC segments (the `/drafts`/`/starters` precedent `[VERIFIED: workflows.py:180-196,331-335]`) so no `/{definition_id}` path can shadow them. (There is no `GET /workflows/{definition_id}` today, and `POST ""`/`POST /{id}/publish` don't collide with `POST /validate` — but follow the convention anyway.)

### Anti-Patterns to Avoid
- **Putting `grounding.py` inside `reachability.py`** — poisons the pure-import property (Pitfall 1 below).
- **Re-deriving the folder ⊆ logic** — reuse `assert_folder_scopes_subset` verbatim; it's the security-critical owner-scoped ⊆ check (`scope.py:197`, threat T-098-02).
- **Returning the NL prompt string from the bundle endpoint** — the canvas needs structured `{id, name}` data, not prose. Split them (Pattern 1).
- **`extra="forbid"` relaxation** — never; the 422 IS the shape tier. Do not accept a lenient `dict` body to "avoid 422s".
- **Stacking `require_visible` and expecting a 404** — `require_visible` raises **403** on deny (`dependencies.py:551`), which would leak route existence when the canvas is ON but authoring-visibility is restricted (Pitfall 3).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Structural graph validation | A TS/client reachability checker | `lint_workflow` (import) | Pitfall 1 — the whole point of the phase; a client copy drifts. |
| Folder-scope subset check | A new ⊆ walk | `assert_folder_scopes_subset` verbatim | Owner-scoped, cycle-guarded, security-reviewed (T-098). |
| Tool/skill registry membership | A hardcoded tool/skill list | `get_tools(None)` + `_skill_registry` via the bundle | "KB content can never whitelist itself" (T-103-02-03); a frontend constant is the exact Pitfall-1 warning sign. |
| Interactive-phase detection | Re-scan phase types | `_interactive_phase_failures` verbatim | Already module-level + pure (`publish_service.py:402`). |
| 404-when-off gating | A new flag check | `require_canvas()` | Inherits the 181 pre-auth byte-identical-404 (CR-01 fixed). |
| Malformed-body rejection | Manual field checks | `WorkflowDefinition` body + `extra="forbid"` | FastAPI 422 for free (create_draft parity). |

**Key insight:** the entire phase is a "don't hand-roll" exercise — VALID-01 exists specifically so the canvas has ONE server-side rule source. The only NEW code is the thin classification/envelope layer + the extraction plumbing + the two route shells.

## Runtime State Inventory

> This is a code-extraction + route-add phase (a light refactor: moving grounding functions, deleting the canary). No data/rename migration.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no DB table, collection, key, or user_id changes. `/validate` is stateless (no writes); `/grounding-bundle` is a pure read. `_assemble_grounding` output is unchanged. | None — verified: no migration, no writes in either route. |
| Live service config | None — no external service (n8n, Datadog, Tailscale, etc.) references this seam. Flag lives in `app_settings.feature_visibility` (already seeded by 181). | None. |
| OS-registered state | None — no Task Scheduler / pm2 / systemd registration. | None. |
| Secrets / env vars | None — no new secret or env var. Routes use existing `get_supabase` (service-role carve-out) + `get_current_user`. | None. |
| Build artifacts / installed packages | None — no package install, no egg-info/version bump. `SANDBOX_IMAGE` untouched (no sandbox change). Deploy-artifact drift check (`check-deploy-drift.sh`): a NEW route reading NO new env var and NO seed → **no `deploy/onebox.env.example` / `docs/OPERATOR.md` change required** (verify: routes read no new `settings.*`). | Confirm the two routes introduce no new `settings.<attr>` read (they do not in the recommended shape). |

**Canary-removal blast radius (code, not runtime state):** `/canvas/ping` is referenced in exactly 4 files — `main.py` (import :657 + include :688), `canvas_canary.py` (the route), `tests/test_revert_byte_identical.py` (3 tests), and **`tests/test_181_flip_on.py` (3 tests)** `[VERIFIED via Grep this session]`. See Open Question 1 — CONTEXT D-182-04 named only `test_revert_byte_identical`, but `test_181_flip_on.py` ALSO hits `/canvas/ping` and WILL break (esp. `test_canvas_ping_200_after_flip_on`).

## Common Pitfalls

### Pitfall 1: Folding grounding into `reachability.py` and losing the pure-import property
**What goes wrong:** `/validate` wants to `import lint_workflow` cheaply. `reachability.py` is deliberately I/O-free (`[VERIFIED: reachability.py:1-6]` docstring). If the DB-touching grounding checks are added to it (or to `harness/__init__.py`'s eager surface), importing lint drags in Supabase/folder code.
**Note:** `from app.services.harness import lint_workflow` already triggers `phase_types` + `validator_kinds` registration side-effects `[VERIFIED: harness/__init__.py:22-27]`. Prefer `from app.services.harness.reachability import lint_workflow` (module-direct) in the route to stay import-light, and keep grounding in its own `grounding.py`.
**How to avoid:** separate `grounding.py`; import lint from the `reachability` module directly.
**Warning signs:** a grounding list imported from a frontend constant (the Pitfall-1 canary from PITFALLS.md); `reachability.py` gaining a `supabase` import.

### Pitfall 2: The `no_terminal` code means two different things
**What goes wrong:** `lint_workflow` emits `no_terminal` for BOTH (a) `phases == []` ("definition has no phases" `[VERIFIED: reachability.py:90-91]`) AND (b) a cycle that never reaches the terminal index (`[VERIFIED: reachability.py:163-171]`). D-182-03 wants empty-draft → `incomplete` but a real unreachable-terminal → `error`. A naive `no_terminal → error` mislabels the empty draft as "broken."
**How to avoid:** in the classifier, special-case by `len(definition.phases) == 0` → `incomplete`; otherwise `no_terminal` → `error`. (The two are distinguishable by the empty-phases check the route already has, or by the lint message text.)
**Warning signs:** an empty canvas painting red "broken" instead of grey "still building."

### Pitfall 3: Stacking `require_visible("workflow_authoring")` breaks the 404 posture
**What goes wrong:** the existing authoring routes carry `require_visible("workflow_authoring")` `[VERIFIED: workflows.py:301,334,363]`, which raises **403** on deny `[VERIFIED: dependencies.py:551-554]`. If stacked on the canvas routes, then when the canvas is ON but a caller lacks `workflow_authoring` visibility, they'd get a 403 — leaking that `/validate` exists. It also couples canvas availability to a DIFFERENT feature's audience.
**Recommendation (resolves Discretion item 2):** gate on **`require_canvas` ALONE.** Rationale: (1) preserves the pure byte-identical-404 posture with no 403 leak; (2) `workflow_authoring` is "everyone" audience today (`[VERIFIED: test_181_off_audience.py:87]` — resolves `everyone`), so stacking restricts nothing now; (3) the canvas is a THIRD authoring door whose OWN flag (`visual_workflow_canvas`) is its visibility gate — if future scoping is needed, use that key's `role` audience, not `workflow_authoring`'s. This matches CONTEXT's stated lean.
**Warning signs:** a 403 (not 404) from `/validate` in any state.

### Pitfall 4: `business_requirement` has no reusable function — replicate the exact predicate
**What goes wrong:** the D-13 check is an INLINE expression in publish (`not (definition.business_requirement or "").strip()` `[VERIFIED: publish_service.py:124]`), not a helper. Copy-pasting risks drift.
**How to avoid:** extract a one-line `business_requirement_missing(definition) -> bool` (put it in `grounding.py` or a small shared spot) and have BOTH publish stage-1 and `/validate` call it — honoring the "one source" spirit even for the trivial check.

### Pitfall 5: 422-vs-404 ordering when repointing the canary test onto a POST
**What goes wrong:** the canary was a `GET` `[VERIFIED: canvas_canary.py:22]`. Repointing the "404 when off" assertion onto `POST /workflows/validate` with a missing/invalid body risks a 422 (body) racing the 404 (flag) — FastAPI does not guarantee which fires first.
**How to avoid:** for the POST-based 404-when-off assertion, send a MINIMAL VALID `WorkflowDefinition` body so the ONLY thing that can 404 is the flag gate. Better: repoint the primary 404-when-off + pre-auth assertions onto **`GET /workflows/grounding-bundle`** (a GET, no body confound — the cleanest canary replacement, mirrors `/canvas/ping`'s GET shape exactly) AND add a `POST /validate` 404 probe with a valid body for SC#3 completeness.

### Pitfall 6: Unbound / mid-draw definitions
**What goes wrong:** a phase with `folder_scope` but `project_folder_id=None` — how does /validate respond?
**How to avoid (resolves Discretion item 3):** it never reaches the handler. `WorkflowDefinition._folder_scope_requires_project` is a `@model_validator(mode="after")` that raises ValueError `[VERIFIED: harness.py:252-264]` → FastAPI 422 (shape tier). When `project_folder_id=None` and NO phase declares folder_scope, `assert_folder_scopes_subset` is a no-op (`subtree is None → return` `[VERIFIED: scope.py:219]`) — whole-KB, zero folder verdicts, correct. Empty `phases: []` is shape-valid (no `min_length`) → reaches the handler → `no_terminal` incomplete (Pitfall 2).

## Code Examples

### The verdict classifier (severity mapping — resolves Discretion item 4)
```python
# Source: recommended /validate classifier — CLASSIFIES verbatim outputs, never changes the checks (D-182-03)
_ERROR_CODES = {"bad_index", "orphan_phase", "unsatisfiable_skip",
                "folder_scope", "unregistered_tool", "unregistered_skill"}
_INCOMPLETE_CODES = {"input_unsatisfied", "business_requirement", "interactive_phase"}

def _severity(code: str, *, phases_empty: bool) -> str:
    if code == "no_terminal":
        return "incomplete" if phases_empty else "error"   # Pitfall 2
    if code in _ERROR_CODES:
        return "error"
    return "incomplete"                                     # input_unsatisfied / business_requirement / interactive_phase
```

### Full verdict envelope (resolves Discretion item 4 — field names + `ok` semantics)
```python
# Envelope aligns with the {ok, error, detail} grounding shape + the D-08 publish verdict.
# ok == (no verdicts at all): the full STATIC gauntlet is clean → publishable-now signal.
# severity is an ORTHOGONAL UI hint (error=broken/red, incomplete=still-building/grey);
# BOTH severities set ok=False (an incomplete draft still can't publish).
{
  "ok": True,                       # or  "valid" — pick one; recommend "ok" (matches grounding + is terser)
  "verdicts": [                     # per-node list; [] when ok
    {"code": "unregistered_tool", "phase": "research", "message": "tool 'x' is not registered", "severity": "error"},
    {"code": "business_requirement", "phase": None,  "message": "...",                          "severity": "incomplete"}
  ]
}
```

### The complete `code → severity` taxonomy table (every code the reused checks can emit)
| # | Code | Source (verbatim check) | phase key | Severity | Notes |
|---|------|-------------------------|-----------|----------|-------|
| 1 | `bad_index` | `lint_workflow` (dup slug OR non-contiguous index) `[VERIFIED: reachability.py:94-111]` | slug (dup) / `null` (contiguity) | `error` | Two emit sites; dup-slug carries a slug, contiguity carries `null`. |
| 2 | `unsatisfiable_skip` | `lint_workflow` `[VERIFIED: reachability.py:118-128]` | slug | `error` | Missing skip target. |
| 3 | `orphan_phase` | `lint_workflow` `[VERIFIED: reachability.py:154-158]` | slug | `error` | Unreachable phase. |
| 4 | `no_terminal` (empty) | `lint_workflow`, `phases==[]` `[VERIFIED: reachability.py:90-91]` | `null` | `incomplete` | Empty draft (Pitfall 2). |
| 5 | `no_terminal` (cycle) | `lint_workflow` `[VERIFIED: reachability.py:163-171]` | `null` | `error` | Terminal unreachable via cycle. |
| 6 | `input_unsatisfied` | `lint_workflow` `[VERIFIED: reachability.py:42-58]` | slug | `incomplete` | Still-wiring (D-182-03). |
| 7 | `folder_scope` | `assert_folder_scopes_subset` (ValueError) `[VERIFIED: scope.py:226-230]` | `null` (slug in message) | `error` | Grounding-fidelity ⊆ break. |
| 8 | `unregistered_tool` | tool ∈ registry check `[VERIFIED: workflow_authoring.py:344-349]` | slug | `error` | Grounding-fidelity. |
| 9 | `unregistered_skill` | skill_ref ∈ set check `[VERIFIED: workflow_authoring.py:350-354]` | slug | `error` | Grounding-fidelity. |
| 10 | `business_requirement` | presence predicate `[VERIFIED: publish_service.py:124]` | `null` | `incomplete` | D-13 publish invariant. |
| 11 | `interactive_phase` | `_interactive_phase_failures` `[VERIFIED: publish_service.py:402-442]` | slug | `incomplete` | WR-04; one finding per phase. |

> Codes 8/9/10 are naming RECOMMENDATIONS (the reused checks don't currently emit a machine `code` for grounding/business_req — the route assigns it). Codes 1-6 are the VERBATIM lowercase `LintError.code` literals `[VERIFIED: reachability.py]`; the publish path already renders them as `{code, phase, message}` `[VERIFIED: publish_service.py:146-149]` — mirror that dict shape exactly for lint verdicts.

### The grounding-bundle response (D-182-01)
```python
# GET /workflows/grounding-bundle — the server palette 184's node-config dropdowns bind to.
{
  "tools":  ["analyze_document", "ask_user", "execute_code", "search_documents", ...],  # sorted(get_tools(None) names)
  "folders": [{"id": "...", "name": "Q3 Reports", "parent_id": "..."}, ...],            # fetch_visible_folders shape
  "skills":  [{"id": "...", "name": "Legal Review"}, ...],                               # enabled owner+global
  "template_placeholders": []                       # only populated when ?template_asset_id= is supplied (optional)
}
```
Note: `template_placeholders` are PER-TEMPLATE (need a `template_asset_id` + `pool` via `_resolve_template_placeholders` `[VERIFIED: workflow_authoring.py:211-259]`). The base palette (tools/folders/skills) is workflow-agnostic; recommend resolving placeholders only when an optional `?template_asset_id=` query param is passed, else `[]`.

## State of the Art

Not applicable — no fast-moving external ecosystem. This is internal API composition over stable in-repo modules (harness engine shipped Phases 090-103; require_canvas shipped Phase 181, 2026-07-24). The only "state of the art" concern is staying current with the 181 pre-auth 404 fix, which this phase inherits verbatim.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `ok = (verdicts == [])` (not "no error-severity verdicts") is the desired "can this pass publish now?" semantic. | Envelope | LOW — matches publish (an incomplete draft can't publish); if the planner wants `ok` to ignore incompletes, it's a one-line change. Flagged for discuss/plan confirmation. |
| A2 | Machine `code` names for the non-lint checks (`unregistered_tool`, `unregistered_skill`, `folder_scope`, `business_requirement`, `interactive_phase`) are route-assigned (the reused fns emit prose, not codes). | Taxonomy table | LOW — naming only; the planner may rename. The lint codes (1-6) are VERIFIED verbatim. |
| A3 | The bundle endpoint resolves template placeholders only behind an optional `?template_asset_id=` param (base palette omits them). | Bundle shape | LOW — 184 consumes this; if 184 needs eager placeholders the endpoint gains a param. |
| A4 | Repointing the 404-when-off assertion onto `GET /grounding-bundle` (plus a POST /validate probe with a valid body) is acceptable for SC#3. | Pitfall 5 | LOW — SC#3 says prove `/validate` 404s-when-off; covering BOTH routes exceeds it. Confirm the planner keeps a POST /validate probe. |

**No `[ASSUMED]` factual/library claims** — every code fact is `[VERIFIED: codebase]` this session. The rows above are DESIGN recommendations pending planner confirmation, not unverified external facts.

## Open Questions

1. **`test_181_flip_on.py` also depends on `/canvas/ping` — CONTEXT D-182-04 only named `test_revert_byte_identical`.**
   - What we know: `/canvas/ping` is referenced in `test_revert_byte_identical.py` (3 tests) AND `test_181_flip_on.py` (3 tests) `[VERIFIED via Grep]`. Deleting the canary makes `/canvas/ping` a genuine unbuilt 404 — the two "404 when off" tests in `test_181_flip_on.py` would still pass (404) but for the WRONG reason, and `test_canvas_ping_200_after_flip_on` `[VERIFIED: test_181_flip_on.py:74-95]` would FAIL (no route → 404, not 200).
   - What's unclear: whether to repoint `test_181_flip_on.py`'s flip-on-200 + 404 assertions onto the real routes, or delete/replace them.
   - Recommendation: the plan MUST include repointing `test_181_flip_on.py` too — repoint `test_canvas_ping_200_after_flip_on` onto `GET /workflows/grounding-bundle` (a require_canvas-gated route that returns 200 when on) and the 404-when-off assertions onto the same real routes. Add this to the D-182-04 task explicitly.

2. **Envelope field name: `ok` vs `valid`, `verdicts` vs `findings`.**
   - What we know: the existing grounding shape uses `ok` `[VERIFIED: workflow_authoring.py:319]`; publish uses `published`/`named_failures` `[VERIFIED: publish_service.py:363-368]`.
   - Recommendation: `{ "ok": bool, "verdicts": [...] }` — `ok` matches grounding (single boolean), `verdicts` is clearer than `findings` for per-node semantics. Planner's final call (Discretion item 4).

3. **Should `business_requirement_missing` live in `grounding.py` or stay a publish-owned helper?**
   - Recommendation: extract to a tiny shared predicate imported by BOTH publish stage-1 and `/validate` (honors "one source"); location is cosmetic.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase (Postgres/Auth) | grounding fidelity + bundle (folders/skills reads) | ✓ (local CLI-managed, `supabase start`) | per CLAUDE.md | — (tests mock `get_supabase`) |
| Python venv | backend | ✓ | project venv | — |
| pytest + TestClient | route/gate tests | ✓ (`backend/tests/conftest.py`) | existing | — |
| External network / npm / new packages | — | N/A | — | none needed (zero installs) |

**Missing dependencies with no fallback:** none. **Missing dependencies with fallback:** none. Route/gate/classifier tests run fully offline against the conftest mocks (`get_supabase`/`get_current_user` overridden `[VERIFIED: conftest.py:133-142]`); the DB-touching grounding/bundle live tests follow the `test_workflows_routes.py` psycopg2 skip-guard pattern `[VERIFIED: test_workflows_routes.py:36-52]`.

## Validation Architecture

> `workflow.nyquist_validation = true` `[VERIFIED: .planning/config.json:8]` — this section is REQUIRED.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (+ `pytest-asyncio` for `async def` tests) + Starlette `TestClient` |
| Config file | `backend/tests/conftest.py` (central `app.dependency_overrides` for `get_current_user`/`get_supabase`; `reset_mocks` autouse fixture) `[VERIFIED]` |
| Quick run command | `cd backend && venv/Scripts/python -m pytest tests/unit/test_182_validate.py tests/test_182_grounding_extraction.py -x -q` |
| Full suite command | `cd backend && venv/Scripts/python -m pytest -q` |
| Live-DB gate | psycopg2 module-level `skipif` on `POSTGRES_DSN` (`127.0.0.1:54322`) — the `test_workflows_routes.py` precedent `[VERIFIED]` |

### Phase Requirements → Test Map
| Req / SC | Behavior | Test Type | Automated Command (recommended file) | File Exists? |
|----------|----------|-----------|--------------------------------------|--------------|
| SC#1 / VALID-01 | each lint code surfaces as a verdict (bad_index, orphan, unsatisfiable_skip, no_terminal, input_unsatisfied) | unit | `pytest tests/unit/test_182_validate.py -k lint` | ❌ Wave 0 |
| SC#1 | grounding-fidelity verdicts (unregistered tool / skill_ref / folder ⊄ subtree) | unit (mock supabase) | `... -k grounding` — mirror `test_103_grounding_fidelity.py` monkeypatch of `_assemble_grounding`/`assert_folder_scopes_subset` `[VERIFIED]` | ❌ Wave 0 |
| SC#1 | business_requirement-missing verdict + interactive_phase verdict | unit | `... -k static_gauntlet` | ❌ Wave 0 |
| SC#2 | grounding lists come from the SERVER bundle, never a constant; `GET /grounding-bundle` returns tools/folders/skills | unit + live | `... -k bundle` | ❌ Wave 0 |
| SC#2 (anti-drift INVARIANT) | extraction preserves NL-gen behavior — `_assemble_grounding` returns the SAME `(prompt, tool_names, skill_ids)` tuple; NL-gen tests stay green | regression | re-run `tests/unit/test_103_nl_generate.py` + `test_103_grounding_fidelity.py` UNCHANGED (they must pass byte-for-byte after the extraction) `[VERIFIED exist]` | ✅ (existing — guard COUNT stays) |
| SC#3 | `POST /validate` + `GET /grounding-bundle` 404 (never 403) when flag off, for operator AND user AND pre-auth | integration | repoint `test_revert_byte_identical.py::test_require_canvas_404s_when_off` + `..._pre_auth_when_off` onto the real routes `[VERIFIED pattern]` | ✅ (repoint existing) |
| SC#3 | 200 when flag on (real route) | integration | repoint `test_181_flip_on.py::test_canvas_ping_200_after_flip_on` onto `GET /grounding-bundle` (see Open Q1) | ✅ (repoint existing) |
| SC#4 | every verdict maps to `phase == slug`; workflow-global findings carry `phase: null` | unit | `... -k per_node_keying` | ❌ Wave 0 |
| SC#4 | severity classification (error vs incomplete) per the taxonomy table, incl. the `no_terminal` empty-vs-cycle split | unit | `... -k severity` | ❌ Wave 0 |
| D-182-04 | canary gone: `/canvas/ping` is an unbuilt 404; `import canvas_canary` removed | regression | grep-guard test / import check; both `test_181_flip_on.py` + `test_revert_byte_identical.py` repointed & green | ✅ (repoint) |

### Sampling Rate
- **Per task commit:** `pytest tests/unit/test_182_validate.py -x` (the verdict unit set — sub-second, no DB).
- **Per wave merge:** `pytest tests/unit/test_103_*.py tests/test_revert_byte_identical.py tests/test_181_flip_on.py tests/test_181_off_audience.py -q` (extraction-regression + gate + canary-repoint — the anti-drift + revert backstops).
- **Phase gate:** full `backend` suite green (esp. the untouched NL-gen tests proving zero-behavior-change) before `/gsd:verify-work`. No SC#10 (no streaming/provider/UI path — backend static seam).

### Wave 0 Gaps
- [ ] `backend/tests/unit/test_182_validate.py` — every verdict code + severity + per-node keying + `ok` semantics (mock `get_supabase`; monkeypatch the shared grounding module like `test_103_grounding_fidelity.py`).
- [ ] `backend/tests/test_182_grounding_bundle.py` — `GET /grounding-bundle` shape + require_canvas 404-when-off (live-DB skip-guarded for the real read).
- [ ] `backend/tests/test_182_extraction_parity.py` (or reuse existing 103 tests as the guard) — assert `_assemble_grounding` output is byte-identical post-extraction; assert `grounding.py` is the ONE source (no second grounding definition). **Guard the COUNT** of existing NL-gen tests so an extraction that silently drops a test is caught (the 177 coverage-loss lesson).
- [ ] Repoint (not new): `test_revert_byte_identical.py` + `test_181_flip_on.py` off `/canvas/ping` onto the real routes.
- [ ] Framework install: none — pytest/asyncio/TestClient already present.

## Security Domain

> `security_enforcement` absent from config → treated as enabled. But this phase adds **no new trust boundary** (ROADMAP/CONTEXT: "no threat model — reuses the authenticated-user + `require_canvas` gate — no new authz surface"). The relevant controls are input-validation and the inherited flag gate; no `/gsd:secure-phase` SECURITY.md is required (that bar is for the connector track, Phase 189/190).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | reuse | `get_current_user` + the `require_canvas` pre-auth fold-to-404 (`dependencies.py:569-597`) — unchanged from 181. |
| V4 Access Control | reuse | `require_canvas()` 404-when-off (no new authz); grounding reads are OWNER-scoped by `user_id` (`fetch_visible_folders`, `_skill_registry` — service-role bypasses RLS, scoped by hand). |
| V5 Input Validation | **yes** | `WorkflowDefinition` with `extra="forbid"` (`harness.py:27-30`) → 422 on any malformed/injected body key; path/query UUIDs coerced by FastAPI. This is the ONLY net-new input surface, and it's the strictest model in the codebase. |
| V6 Cryptography | no | No secrets, no crypto in this seam. |
| V3 Session Mgmt | no | Stateless routes; no session state. |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Route-existence leak when flag off | Information Disclosure | `require_canvas` byte-identical 404 pre-auth (inherited, D-182-05) — verified by the repointed revert tests. |
| Client submits a definition that bypasses tool whitelist / grounding | Tampering / Elevation | ALL checks server-side; the bundle (not a frontend constant) is the palette source (Pitfall 1). `/validate` is READ-only advice — it never persists or executes; publish remains the enforcing gate. |
| Injected extra key in the definition body | Tampering | `extra="forbid"` → 422 (never relaxed). |
| Cross-user folder/skill disclosure via grounding | Information Disclosure | Owner-scoped reads (`user_id`), same posture as NL-gen (T-098-02 / T-103-02-03); extraction preserves the exact scoping. |

## Sources

### Primary (HIGH confidence — codebase, read this session)
- `backend/app/services/harness/reachability.py` — `lint_workflow`/`LintError`/`parse_skip_target`, 5 codes, pure-function contract.
- `backend/app/services/workflow_authoring.py` — `_assemble_grounding` (:262), `_check_grounding_fidelity` (:322), `_grounding_failed` (:316), `_skill_registry` (:140), `_resolve_template_placeholders` (:211).
- `backend/app/services/harness/publish_service.py` — static-gauntlet order, `business_requirement` check (:124), `lint` block (:138), `_interactive_phase_failures` (:402), D-08 verdict shape (:363).
- `backend/app/services/harness/scope.py` — `assert_folder_scopes_subset` (:197), `resolve_project_subtree` (:51).
- `backend/app/dependencies.py` — `require_canvas` (:600), `authenticate_canvas_request` (:569), `_canvas_bearer_scheme` (:566), `require_visible` 403 (:551).
- `backend/app/api/workflows.py` — `/workflows` router (:64), `create_draft` (:303), `publish_workflow` (:239), `generate_workflow` (:640), route-ordering/static-segment precedent.
- `backend/app/models/harness.py` — `WorkflowDefinition` (:221), `PhaseSpec` (:189), `PhaseConfig` union (:157), `ValidatorSpec` (:170), `_StrictBase` extra="forbid" (:27), `_folder_scope_requires_project` validator (:252).
- `backend/app/api/canvas_canary.py`, `backend/app/main.py` (import :657, include :688) — canary retirement targets.
- `backend/app/api/features.py`, `backend/app/models/user_settings.py:1116` (`feature_audience`) — flag resolution + "off" audience.
- `backend/app/services/openai_service.py:1116` (`get_tools`), `backend/app/utils/folder_utils.py:119` (`fetch_visible_folders`) — palette sources.
- Tests: `test_revert_byte_identical.py`, `test_181_flip_on.py`, `test_181_off_audience.py`, `test_103_grounding_fidelity.py`, `test_103_lint_block.py`, `test_harness_reachability.py`, `test_workflows_routes.py`, `conftest.py` (fixtures + overrides).
- `.planning/config.json` (nyquist_validation=true), `.planning/ROADMAP.md` (Phase 182 SC#1-4), `.planning/REQUIREMENTS.md` (VALID-01), `.planning/research/PITFALLS.md` (Pitfall 1), `.planning/phases/181-revert-foundation/181-CONTEXT.md` (via CONTEXT refs).

### Secondary / Tertiary
- None — no WebSearch/external sources needed; this phase is fully internal composition.

## Metadata

**Confidence breakdown:**
- Standard stack (reuse targets): HIGH — every function signature, return type, and purity claim read directly this session with line citations.
- Architecture (extraction shape, envelope, route mount): HIGH — grounded in the actual code; the two design calls (module location, envelope names) are explicitly CONTEXT-delegated discretion, recommended with rationale.
- Pitfalls: HIGH — each derived from a concrete code fact (no_terminal dual meaning, require_visible 403, 422-vs-404 ordering, pure-import property, canary blast radius).
- Validation architecture: HIGH — mirrors established test patterns (103 grounding, 181 gate, workflows-routes live-skip).

**Research date:** 2026-07-24
**Valid until:** ~2026-08-23 (stable internal surface; only invalidated if `reachability.py`, `workflow_authoring.py` grounding, `publish_service.py` static stages, or `require_canvas` change before planning).

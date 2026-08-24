# Phase 182: Server Validation Seam - Context

**Gathered:** 2026-07-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 182 exposes ONE backend seam — the **single source of validation truth** the visual
canvas calls — so the canvas can never drift from the publish gauntlet it must ultimately
pass. It reuses the EXISTING checks verbatim (no rule re-implemented anywhere, least of all
client-side):

- **`POST /workflows/validate`** — accepts a raw `WorkflowDefinition`, returns per-node
  verdicts by reusing `reachability.lint_workflow` (structural) + the grounding-fidelity
  checks (tools/folders/skills grounded to the user's real registries) verbatim, plus the
  other STATIC publish blockers (business-requirement present, interactive-phase).
- **`GET /workflows/grounding-bundle`** — the server-sourced palette of valid building blocks
  (tool names, KB folder tree, enabled skills, template placeholders) the canvas binds its
  node-config dropdowns to (Pitfall 1: never a frontend constant).

**In scope (182):** the two flag-gated routes, the shared/extracted grounding-fidelity source,
the severity-classified verdict shape, retiring the 181 canary, and repointing the
byte-identical 404 test onto the real `/validate` route.

**Out of scope (182):** the golden-run + judge stages of the publish gauntlet (LIVE-only — never
in validate); ANY `@xyflow/react` / canvas rendering (183+); the node-config side-panel that
CONSUMES the bundle (184); the per-node grounding-MODE verdict (185). Backend-only: no migration,
no threat model (no new authz surface), no SC#10 (no streaming/provider path).
</domain>

<decisions>
## Implementation Decisions

### Palette exposure
- **D-182-01 — Ship a sibling `GET /workflows/grounding-bundle` this phase.** Besides
  `POST /workflows/validate`, 182 exposes a small, cacheable read endpoint returning the
  server-sourced valid building-block lists (tool names eligible for `available_tools`, the KB
  folder tree name+id, enabled owner+global skills eligible for `skill_ref`, and template
  placeholder fields). Reuses `_assemble_grounding`
  (`backend/app/services/workflow_authoring.py:250-313`), which already computes
  `tool_names`/`skill_ids`/folder-tree server-side. Rationale: Phase 184's node-config dropdowns
  must be server-fed, never a frontend constant (Pitfall 1 / ROADMAP SC#2 anti-drift), and
  building it now de-risks 184. Kept as a SEPARATE cacheable `GET` (NOT embedded in the
  `/validate` response) because `/validate` is called on every canvas edit — re-sending the full
  palette each time is wasteful and non-cacheable.

### Check breadth
- **D-182-02 — `/validate` reports the FULL static publish gauntlet.** The verdict aggregates
  every STATIC pre-run publish blocker so the canvas previews all of them live: (1) structural
  lint (`reachability.lint_workflow` — orphan / unsatisfiable-skip / no-terminal / bad-index /
  input-unsatisfied); (2) grounding fidelity (folder-scope ⊆ project subtree +
  `available_tools` ∈ registry + `skill_ref` ∈ enabled set — `_check_grounding_fidelity`);
  (3) `business_requirement` present (D-13 publish invariant); (4) interactive-phase-can't-publish
  (`llm_human_input` / `ask_user` on_failure — the WR-04 pre-run block). **Golden-run + judge
  (publish stages 3-4) are LIVE-only and explicitly OUT of scope** — validate is a static,
  no-provider seam. Rationale: the seam's whole purpose is "the canvas can never drift from the
  publish gauntlet" (ROADMAP SC#2); reporting only lint+grounding would still let a user draw a
  workflow that bounces at publish for a missing business requirement or an interactive phase.
  Each added check is a cheap pure/DB check already implemented.
  - **Reuse-verbatim note:** the check FUNCTIONS are reused, not re-implemented. `lint_workflow`
    is pure — import directly. `_check_grounding_fidelity` + `_assemble_grounding` are today
    private to `workflow_authoring.py` and coupled to NL-gen — extract into ONE shared source so
    both NL-gen and validate call the same copy (the anti-drift mechanism; location = discretion,
    the "one source" property is REQUIRED). `_interactive_phase_failures`
    (`publish_service.py:402`) is already a module-level pure helper — reuse verbatim.

### Verdict shape & severity
- **D-182-03 — Verdicts carry a severity/category.** The per-node verdict is
  `{ code, phase (nullable), message, severity }` where `severity ∈ {error, incomplete}`. The
  route CLASSIFIES the verbatim checks' outputs — it does NOT change the checks: hard structural
  violations (bad_index, orphan_phase, unsatisfiable_skip, no_terminal, grounding-fidelity
  failures) → `error`; not-yet-ready conditions (empty draft, missing `business_requirement`,
  `input_unsatisfied` while still wiring, interactive-phase) → `incomplete`. Lets Phase 184/185
  paint "you're still building" differently from "this is broken" without the frontend
  re-deriving the taxonomy.
  - **Per-node keying (ROADMAP SC#4):** every verdict maps to a `phase`/node id = the phase
    `slug` (the identity 183's read-only canvas and 188's run-viz paint onto — mirrors the
    181/183 `node id == phase.slug` contract). Workflow-global findings (bad contiguity,
    no-terminal, missing business_requirement) carry `phase: null`. The envelope also carries an
    overall `ok`/`valid` boolean — a single "can this pass?" signal — aligned with the existing
    `{ok, error, detail}` grounding shape + the D-08 publish verdict.

### Canary retirement
- **D-182-04 — Retire the 181 `/canvas/ping` canary in 182.** `POST /workflows/validate`
  (and the `GET` bundle) are real `require_canvas`-gated routes, so the throwaway canary's job
  is done. Remove `backend/app/api/canvas_canary.py` + its `main.py:688` include, and REPOINT
  `test_revert_byte_identical`'s "a canvas-gated route 404s when off" assertion onto the real
  `POST /workflows/validate`. SC#3 already requires proving `/validate` 404s-when-off, so the
  real-route assertion is needed anyway — the canary becomes redundant. Kills dead code a phase
  earlier than the 181 "182/183" deferral allowed.

### Inherited / red-line (locked — not re-litigated)
- **D-182-05 — Both routes inherit 181's `require_canvas` 404 posture verbatim.** `/validate`
  and `/grounding-bundle` attach `Depends(require_canvas())` and return a **byte-identical 404
  when `visual_workflow_canvas` is off** — for everyone incl. operators (D-181-01), fail-closed
  on cold-cache/DB-blip (D-181-02). The off-flag check runs BEFORE any auth dependency can leak
  route existence (the 181 code-review pre-auth fix: `require_canvas` folds an unauthenticated
  caller into the byte-identical 404).
- **D-182-06 — Red line D-14: one lint copy, zero client-side re-implementation.** No validation
  rule is ever re-implemented in the frontend; the canvas is a pure client of this seam.
  Backend-only: no `@xyflow/react` yet, no migration, no threat model (reuses the
  authenticated-user + `require_canvas` gate — no new authz), no SC#10.

### Claude's Discretion
- **Shared-grounding module location** — where the extracted `_check_grounding_fidelity` +
  `_assemble_grounding` land (new `harness/grounding.py`? co-locate near `reachability.py`?).
  REQUIRED property = ONE shared source both NL-gen and validate call; location is open.
- **Auth stacking** — whether to ALSO stack `require_visible("workflow_authoring")` on the two
  new routes (the existing authoring routes carry it) or gate on `require_canvas` alone. Lean:
  `require_canvas` is the primary/necessary gate; the authoring-visibility stack is a planner call.
- **Unbound / partial definitions** — grounding-fidelity behavior when `project_folder_id=None`
  (whole-KB) or a definition is mid-draw; `assert_folder_scopes_subset` semantics with no bound
  project; empty `phases` reported as an `incomplete` no_terminal. Resolve against the existing
  `assert_folder_scopes_subset` contract.
- **Exact `code → severity` mapping table** and envelope field names (`ok` vs `valid`,
  `verdicts` vs `findings`) — align with the `{ok, error, detail}` grounding shape + D-08 vocab.
- **Request-shape confirmation** — `/validate` accepts a raw `WorkflowDefinition` body
  (ROADMAP SC#1); `extra="forbid"` gives a 422 on a malformed body for free (mirrors `create_draft`).
- Plan/wave decomposition.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The checks to reuse (backend — the anti-drift seam, Pitfall 1)
- `backend/app/services/harness/reachability.py` — `lint_workflow` (:83, PURE) + `LintError`
  (:31) + `parse_skip_target` (:61). The 5 structural codes. Import directly; zero adaptation.
- `backend/app/services/workflow_authoring.py` — `_check_grounding_fidelity` (:322, the 3
  grounding checks) + `_assemble_grounding` (:250-313, builds `tool_names`/`skill_ids`/folder-tree/
  placeholders — the palette source for D-182-01) + `_grounding_failed` (:316, the
  `{ok:false,error,detail}` shape). Extract into ONE shared source (D-182-02 reuse-verbatim).
- `backend/app/services/harness/publish_service.py` — the static-gauntlet ORDER + verdict
  vocabulary: `business_requirement` check (:124), `lint` block (:138), `_interactive_phase_failures`
  (:402, reuse VERBATIM), the D-08 `{published, blocked_stage, named_failures}` shape (:363).
  Golden-run (:173) + judge (:250) are LIVE-only — NOT reused here.
- `backend/app/services/harness/scope.py` — `assert_folder_scopes_subset` (grounding-fidelity's
  folder check; owner-scoped, raises ValueError on non-⊆).

### The flag gate to inherit (from Phase 181)
- `backend/app/dependencies.py` — `require_canvas` (:600) + the pre-auth `current_user`-optional
  helper (:562-599, the 181 code-review fix). The 404 posture both new routes inherit (D-182-05).
- `backend/app/api/canvas_canary.py` — the TEMPORARY canary (:1) to REMOVE in 182 (D-182-04).
- `backend/app/main.py:688` — the `canvas_canary.router` include to remove (D-182-04).
- `backend/tests/test_revert_byte_identical.py` — repoint the "canvas route 404s when off"
  assertion onto `POST /workflows/validate` (D-182-04).

### The router to mount on
- `backend/app/api/workflows.py` — the `/workflows`-prefix router. Mirror `create_draft` (:297 —
  raw-`WorkflowDefinition` body + `extra="forbid"` 422) and `publish_workflow` (:234 —
  verdict-return) patterns. Mount `POST /validate` + `GET /grounding-bundle` here.
  **G-5 RED LINE: this router, NEVER `api/threads.py`.**
- `backend/app/models/harness.py` — `WorkflowDefinition` / `PhaseConfig` (the request body +
  what the checks read).

### Phase inputs (MUST read)
- `.planning/ROADMAP.md` (Phase 182 section, :98-111) — SC#1-4 + Flags.
- `.planning/REQUIREMENTS.md` — VALID-01 (:21) — the ONLY requirement this phase delivers.
- `.planning/phases/181-revert-foundation/181-CONTEXT.md` — D-181-01/02 (the 404 posture),
  D-181-04 (canary), the `require_canvas` pattern refs.
- `.planning/research/PITFALLS.md` — Pitfall 1 (anti-drift: server-provided grounding bundle,
  never a frontend constant).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lint_workflow` (`reachability.py:83`) — PURE, import directly, zero adaptation.
- `_check_grounding_fidelity` + `_assemble_grounding` (`workflow_authoring.py`) — the grounding
  checks + the palette source; extract-and-share (both `/validate` and NL-gen call one copy).
- `_interactive_phase_failures` (`publish_service.py:402`, module-level) — reuse verbatim.
- `require_canvas` (`dependencies.py:600`, from 181) — the flag gate; attach to both routes.
- `create_draft` (`workflows.py:297`) — the raw-`WorkflowDefinition`-body + `extra="forbid"` 422
  pattern to mirror for `/validate`.

### Established Patterns
- Response envelope aligns with the `{ok, error, detail}` grounding shape + the D-08
  `{published, blocked_stage, named_failures}` publish verdict — don't invent a new vocabulary.
- Flag-gated **404 (never 403)** via `require_canvas` (D-181-02).
- Blocking `supabase-py` calls wrapped in `run_in_threadpool` (D-v2.5-01) — the grounding checks
  touch the DB.
- G-5 RED LINE: canvas/authoring routes live in `api/workflows.py`, never `api/threads.py`.

### Integration Points
- `api/workflows.py` — new `POST /validate` + `GET /grounding-bundle` mount points.
- `main.py:688` — remove the canary include.
- `tests/test_revert_byte_identical.py` — repoint the 404-when-off assertion onto `/validate`.
- **Consumed downstream:** Phase 184 reads the `/validate` verdict (per-node badges, VALID-03) +
  the `/grounding-bundle` (node-config dropdowns); Phase 185 extends the verdict with the
  grounding-MODE verdict (ROADMAP SC#4 "later carry the GOVERN grounding verdict").
</code_context>

<specifics>
## Specific Ideas

- `/validate` verdict envelope: `{ ok/valid: bool, verdicts: [{ code, phase, message, severity }] }`
  — overall boolean = a single "can this pass?" signal; each verdict per-node (`phase == slug`,
  or `null` for workflow-global).
- `GET /workflows/grounding-bundle` returns `{ tools: [...], folders: [{id, name, ...tree}],
  skills: [{id, name}], template_placeholders: [...] }` — the server palette 184's dropdowns bind to.
- Severity mapping (starting point, discretion to finalize): structural + grounding-fidelity
  failures → `error`; empty draft / missing `business_requirement` / interactive-phase /
  `input_unsatisfied`-while-wiring → `incomplete`.
</specifics>

<deferred>
## Deferred Ideas

- Node-config dropdowns / side-panel that CONSUME the grounding-bundle → Phase 184.
- Live per-node badge RENDERING from the verdict (VALID-03) → Phase 184.
- Per-node grounding-MODE verdict (grounded-strict vs open) added to the same verdict → Phase 185
  (ROADMAP SC#4 "later carry the GOVERN grounding verdict").
- Golden-run + judge (the LIVE half of the publish gauntlet) — stay in publish only, never validate.

None — discussion stayed within phase scope. (Reported-bugs cross-check: no open
`surface: Agentic-RAG` report's `affected_areas` overlaps the validation-seam / backend domain —
the open backlog is the v3.5 STRETCH chat-polish track, out of this build.)
</deferred>

---

*Phase: 182-server-validation-seam*
*Context gathered: 2026-07-24*

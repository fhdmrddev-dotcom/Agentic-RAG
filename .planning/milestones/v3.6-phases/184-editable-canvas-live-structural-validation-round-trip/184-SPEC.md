# Phase 184: Editable Canvas + Live Structural Validation (Round-Trip) — Specification

**Created:** 2026-07-26
**Ambiguity score:** 0.11 (gate: ≤ 0.20)
**Requirements:** 12 locked

## Goal

A user can author a workflow on the canvas — add a step, insert one between two others, reorder, delete, and configure the selected step — with every edit round-tripping losslessly back to `WorkflowDefinition` through one client serializer, saving through the existing draft CRUD, and carrying a live per-node validation verdict that comes from the server and only from the server.

## Background

Grounded in the code as of `65463724` (2026-07-26):

- **The canvas is read-only.** `frontend/src/components/workflows/canvasModel.ts` (345 L) exports `toCanvas(phases)` and nothing else — there is **no `fromCanvas`**. `WorkflowCanvas.tsx` (341 L) renders that projection inside `@xyflow/react@12.11.2` behind the `visual_workflow_canvas` flag, reached via the in-Builder `[≣ Spine] [⬡ Canvas]` toggle (`WorkflowBuilderPage.tsx:157`).
- **Nothing can be added or deleted anywhere in the app today.** `WorkflowBuilderPage.tsx` (655 L) holds `state.definition` and merges *config* patches only (`onPhaseChange:334` — `{...p.config, ...patch}`). There is no add, insert, reorder, or delete affordance in either view. Phase 183's live UAT recorded this: its U-3 row was testing an unreachable state *because* the Builder has no delete-step affordance.
- **The validation seam is built and unused.** Phase 182 shipped `POST /workflows/validate` (`backend/app/api/workflows.py:510`) — always HTTP 200, `{ok, verdicts[]}`, each verdict `{code, phase, message, severity}` with the D-182-03 split `error` (broken) vs `incomplete` (not finished), plus the honesty code `grounding_unavailable` at severity `error` when a check could not run — and the sibling `GET /workflows/grounding-bundle` (`:657`). **No frontend code calls either route.**
- **Persistence exists.** `createWorkflowDraft` / `updateWorkflowDraft` (`frontend/src/lib/api.ts:3314`/`:3340`) back a create-once-then-PATCH path (`onPersist:353`) driven by an explicit Save button (`onSaveDraft:378`); `updateWorkflowDraft` already throws a typed `WorkflowConflictError` on 409 when the row is a frozen published version.
- **The form exists.** `PhaseFormPanel.tsx` (786 L) is the shipped 400px side panel — plain-language labels, per-step-type field conditioning, a **required** `onClose` prop (183-09 made "a panel you cannot close" un-representable), a 44px collapsed rail, and a bottom-sheet form under 768px.
- **Corpus reality** (local Supabase, read 2026-07-25): 95 definitions; **40 have zero phases**; the modal shape is 2 steps; the deepest is 5 (`eval_coverage`); `skip_to_phase` is used **zero** times. `workflow_definitions` has no layout column and `WorkflowDefinition` is Pydantic `extra="forbid"`, so positions cannot ride in the JSONB.
- **`zundo` is not installed.** `@xyflow/react` and `zustand@5` are.

**G-2 sketch gate: SATISFIED.** Winners recorded 2026-07-26 (`65463724`): **138 C-local** (spine order + browser-local cosmetic nudge, **zero migration** — slot 114 stays reserved), **139-A** (node mark + problems tray, with C's cheap prevention folded in), **140-A** (extend the shipped `PhaseFormPanel`), **141-B** (canvas toolbar + page header), on the **137-B/D** card language (type colour is a tint behind the icon only; strong colour is reserved for Phase 188 run status; motion keys off run state, never selection).

## Requirements

1. **Structural editing on the canvas**: A user can add a step at the end, insert one between two adjacent steps, reorder, and delete — all on the spine.
   - Current: no add / insert / reorder / delete affordance exists in either view; `onPhaseChange` merges config only
   - Target: hovering the line between two steps reveals a `＋` at exactly the insertion point; a card can be dragged along the lane to reorder; `✕` removes a step and the line re-stitches. Every one of these operations renumbers `phase_index` contiguously from 0 with no gaps, and the surface states how many steps moved.
   - Acceptance: after any add / insert / reorder / delete, `definition.phases[].phase_index` is exactly `[0..n-1]` in render order with no duplicates and no holes; a test drives insert-at-middle on the 5-phase `eval_coverage` shape and asserts every downstream index incremented by exactly 1

2. **Lossless round-trip through one serializer**: `canvasModel` gains `fromCanvas` and it is the only place canvas state becomes a definition.
   - Current: `canvasModel.ts` exports `toCanvas` only; there is no reverse path and no serializer to be the single source
   - Target: `fromCanvas(nodes, edges)` (or equivalent single exported function) is the sole producer of `WorkflowDefinition.phases`; any field the canvas does not model survives untouched
   - Acceptance: `fromCanvas(toCanvas(def))` deep-equals `def` for **every** definition in the local corpus (95 rows — including all 40 empty ones, the 2-step `risk-register` PM pack, and the 5-phase `eval_coverage`) plus the synthetic `branching` fixture added in 183, asserted as an automated test over a committed fixture table, not a spot check

3. **Layout never enters the definition**: the cosmetic vertical nudge is a per-user browser preference.
   - Current: no layout is stored anywhere; positions are computed at render (183)
   - Target: a card may be nudged off the lane for readability; that `dy` is persisted **in the browser only**, keyed per user + workflow, never sent to the server, never written to `definition`. "Tidy up" resets it. **Zero migrations — slot 114 stays RESERVED, not spent.**
   - Acceptance: no migration file is added by this phase; the request body of every `createWorkflowDraft` / `updateWorkflowDraft` call contains no positional field (asserted on the serialized payload); nudging a card produces zero network requests

4. **Undo/redo over structural history**: `zundo` ships, and only real changes are in the stack.
   - Current: `zundo` is not a dependency; there is no undo of any kind in the Builder
   - Target: `⌘Z` / `Ctrl+Z` and `⇧⌘Z` / `Ctrl+Y`, plus toolbar controls, step back and forward through structural edits (add / insert / reorder / delete / config change). A cosmetic nudge (R3) **never** creates a history entry.
   - Acceptance: a nudge followed by `⌘Z` undoes the last *structural* edit, not the nudge; a test asserts the history length is unchanged across a nudge; the undo stack is snapshots of the definition slice only

5. **Node configuration in the shipped panel**: the canvas is a third way in to one form, never a second form.
   - Current: `PhaseFormPanel` is reached only from the Spine's `onSelectNode`; the canvas selection already routes to it (183)
   - Target: selecting a canvas node opens the same `PhaseFormPanel`, extended in place; `PhaseConfig`'s Pydantic discriminated union stays authoritative and the panel remains a view of it. The required `onClose` prop, the 44px collapsed rail, and the <768px bottom sheet all survive.
   - Acceptance: no second form component is added; `onClose` remains a required (non-optional) prop — removing it is a typecheck error; per-step-type field conditioning matches the shipped map (`programmatic` and `llm_human_input` carry no model / tools / folder scope; `citation_policy` appears only on the deliverable)

6. **Edits save through the existing draft CRUD, by explicit action**: no autosave in this phase.
   - Current: explicit Save button → create-once-then-PATCH via `createWorkflowDraft` / `updateWorkflowDraft`
   - Target: structural edits mark the draft dirty and are persisted through the **same unchanged** create-once-then-PATCH path on explicit save; the canvas toolbar shows `dirty → saving → Saved · still a draft`. Debounced autosave, the never-mint-a-version guarantee, and the co-edit clobber guard are **Phase 186 (CONCUR-01/02)**.
   - Acceptance: a canvas editing session issues exactly one `POST` (first save) and `PATCH` thereafter — asserted on the request log; no new persistence endpoint is added; the saved-state wording contains no word implying published

7. **Live server validation on every edit, with an honest failure mode**: VALID-02's live half.
   - Current: `POST /workflows/validate` exists and no client calls it
   - Target: edits are debounced (~400–600 ms) into one `/workflows/validate` call showing a "checking…" beat; responses are applied last-write-wins so a stale reply can never overwrite a newer verdict; on failure, timeout, or offline the surface states that the check did not run — marks go to an unknown state, **never to clean** — and publish stays blocked
   - Acceptance: a test fires two edits and resolves the responses out of order, asserting the *newer* verdict is the one rendered; a test forces a rejected/timed-out `/validate` and asserts no node renders a clean state and publish remains disabled; `grounding_unavailable` renders as "we could not check", never as `ok`

8. **Per-node status is server-derived only**: VALID-03.
   - Current: no verdict rendering exists on the canvas
   - Target: each affected node carries a small corner mark — red `✕` for `error`, dashed grey `○` for `incomplete` — keyed by `verdict.phase`, which is already `node.id` (the phase `slug`). A problems tray at the bottom edge states the count in two separate words (*"1 problem · 2 things to finish"*) before it is opened, and its rows jump to the step. A workflow-wide verdict belonging to no node (e.g. `business_requirement`) has a home in the tray.
   - Acceptance: no severity, code, or message is computed client-side — a test asserts the rendered marks change when only the server response changes, with identical local state; every unrecognised code renders (as `error`, matching the route's fail-closed default) rather than being dropped; a verdict with `phase: null` appears in the tray

9. **The severity split never reads as failure**: `incomplete` is not a mistake.
   - Current: n/a — nothing renders verdicts
   - Target: a draft with N `incomplete` verdicts and zero `error`s uses no error colour, no alarm iconography, and no failure language anywhere in its resting state, while still blocking publish
   - Acceptance: the mid-build fixture (3 `incomplete`, 0 `error`, `ok: false`) renders with zero elements carrying the destructive/error token, asserted in a test; the tray's two-count wording is present before expansion

10. **Two cheap shape refusals**: the "you cannot draw an invalid workflow" half that prevention can honestly cover.
    - Current: nothing is prevented — nothing is editable
    - Target: (a) a delete that would orphan its successor is refused with a stated reason; (b) an add-step choice that would strand the deliverable is offered disabled, with a reason. Everything not decidable from flow **shape** — an unavailable tool, an out-of-scope folder, a missing description — is reported only, never prevented. The gate must never become the thing that stops someone building.
    - Acceptance: exactly these two refusals exist; a test asserts a delete that does *not* orphan proceeds normally; no refusal path consults `/validate` (both are decidable from the local shape) and no refusal is silent — each names its reason

11. **Governance rendered as rails**: CANVAS-04, ungraded (185 grades it).
    - Current: the panel shows fields with no governance framing; `GET /workflows/grounding-bundle` has no caller
    - Target: three rails in the inspector — **order is locked** ("Runs as step 1 of 3 — steps run in order"), **tool whitelist** as a chip set sourced live from `GET /workflows/grounding-bundle` with **no free-text box** (a tool the definition names that the registry lacks renders struck through, not hidden; when the bundle read is `degraded` the picker says it could not load them rather than showing an empty list), and **gates** as 🔒 rows that cannot be detached beside `○` rows that can. The node face carries at most one governance badge (the 137-D two-badge budget holds).
    - Acceptance: the tool list contains no frontend constant — a test asserts the options come from the bundle response; a degraded bundle response renders the could-not-load message and never an empty-but-normal picker; a 🔒 gate row has no removal control in the DOM. **Phase 184 does not invent `grounding_mode`** — no authored grounding field appears in the definition or the panel

12. **One session, one way out**: 141-B's composition, reusing shipped chrome.
    - Current: the Builder has a `← Workflows` breadcrumb header; publish lives elsewhere in the flow
    - Target: editing controls (undo/redo, save state) float on the canvas where editing happens; the workflow name, the `draft` chip, and **Publish** live in the existing page header, where leaving happens. Publish is disabled while `ok: false` and **names the first blocking reason** rather than only greying. The problems-tray summary line folds into the bottom edge beside it and the tray expands upward — one bottom region, two rows maximum.
    - Acceptance: at a 900px viewport there is exactly one bottom-edge region and no horizontal overflow; the disabled publish control's accessible name or adjacent text contains the first verdict's message; no net-new header band is added

## Boundaries

**In scope:**

- Add / insert-between / reorder / delete of phase-nodes on the canvas, with contiguous `phase_index` renumbering
- `canvasModel.fromCanvas` — the one client serializer — and its corpus-wide round-trip proof
- Browser-local cosmetic `dy` nudge + "Tidy up" (zero server state, zero migration)
- `zundo` undo/redo over structural history
- Extending the shipped `PhaseFormPanel` as the canvas's node inspector (CANVAS-03)
- Live debounced `POST /workflows/validate` wiring, last-write-wins, honest degraded state
- Per-node marks + the bottom problems tray, both driven only by server verdicts (VALID-03)
- The two cheap shape refusals (orphaning delete, stranding add)
- The three governance rails, including the live `GET /workflows/grounding-bundle` tool whitelist (CANVAS-04)
- Canvas toolbar (undo/redo + save state) and the page-header publish handoff with its named blocking reason
- **Wave 0 G-5 extraction** — lift node presentation/state out of `PhaseNode.tsx` and definition-mutation out of `WorkflowBuilderPage.tsx` into shared modules *before* any feature code, so Phase 185's dials land on an already-extracted node

**Out of scope:**

- **Autosave, "never mint a version", and the co-edit clobber guard** — Phase 186 (CONCUR-01/02) owns them; 184 keeps the shipped explicit-save path so 186 remains a real phase with a real seam
- **Authored `grounding_mode` / the action-risk dial** — Phase 185 (GOVERN); 184 must not invent that field. The gate rail is *derived* here exactly as the shipped `groundingFor()` does
- **Free handle-to-handle wiring / a second outgoing edge** — the engine has no `depends_on` and runs `phase_index` order, so any drawn branch is a picture of something that will never run (sketch 138-B, rejected)
- **Authoring `skip_to_phase`** — stays read-only; 183 already renders an unresolvable one as visibly broken. Used zero times in all 95 live definitions
- **The `workflow_layouts` table / migration 114** — slot 114 stays RESERVED. Promotion trigger, written so the door is provably open: a nudge must survive across devices, **or** a layout is deliberately shared between editors. Neither is true today
- **Editing in the `≣ Spine` view** — the Spine stays read-only exactly as today, so flag-off remains byte-identical (D-14)
- **Running a draft from the canvas** — per the v2.9 navigation contract, the publish gauntlet's golden run *is* the trial run; the end of an authoring session is a handoff, not "run it and see"
- **Live run state on nodes** — Phase 188 (RUNVIZ); this phase must not spend the strong colour 188 needs
- **AI-seeded canvas / node vocabulary** — Phase 187
- **`elkjs` / virtualization / scale hardening** — Phase 191, conditional
- **SEED-131 / SEED-132** (the `/validate` always-200 envelope seal and the `@model_validator` 422 bypass) — inherited as open; 184 consumes the route as shipped and its degraded-state handling (R7) is the client-side mitigation

## Constraints

- **Red line D-14** — with `visual_workflow_canvas` off, the Builder is byte-identical to today for every audience including operators. All editing affordances live behind the flag; no editing code on the flag-off path
- **Pydantic stays authoritative** — `PhaseConfig`'s discriminated union and `WorkflowDefinition`'s `extra="forbid"` are the schema. The client never re-derives validation (D-182-06: one lint copy, zero client-side re-implementation)
- **Zero migrations** — 138 C-local resolved OPEN-05. Slot 114 is not spent
- **One net-new dependency: `zundo`.** `@xyflow/react@12.11.2` and `zustand@5` are already installed
- **Existing endpoints only** — `POST /workflows/validate`, `GET /workflows/grounding-bundle`, `createWorkflowDraft`, `updateWorkflowDraft`. No new backend route; no backend change unless discuss-phase surfaces a concrete blocker
- **G-5 refactor-before-3rd-touch** — `PhaseNode.tsx` (2nd touch here, 3rd in 185) and `WorkflowBuilderPage.tsx` (3rd authoring door) are extracted in Wave 0, before feature work
- **Card language is locked** (137-B/D + `themes/canvas-184.css`) — step-type colour is a tint behind the 3D icon only; motion keys off run state, never selection; the two-badge node budget holds; icons come from the 3D mark set, never text glyphs
- **No SC#10** — authoring surface, no run stream, no provider path
- **No threat model** unless discuss-phase surfaces a real trust boundary (v3.4 org RLS already enforces the share boundary)
- Scale target: workflows are 2 steps modal / 5 maximum across all 95 live definitions. Do not build for fan-out that does not exist

## Acceptance Criteria

- [ ] A user can add, insert-between, reorder, and delete steps on the canvas; `phase_index` is always contiguous `[0..n-1]` afterwards
- [ ] `fromCanvas(toCanvas(def))` deep-equals `def` for all 95 corpus definitions + the 183 branching fixture, as an automated test
- [ ] Zero migration files added; no positional field appears in any draft create/PATCH payload; a nudge issues zero network requests
- [ ] `zundo` undo/redo steps through structural edits; a cosmetic nudge adds no history entry
- [ ] Canvas node selection opens the **same** `PhaseFormPanel`; `onClose` is still a required prop; no second form component exists
- [ ] Saving still goes through the unchanged create-once-then-PATCH path (one `POST`, then `PATCH`); no autosave; the saved-state wording never implies published
- [ ] `/workflows/validate` is called debounced on edit; an out-of-order response never overwrites a newer verdict (test)
- [ ] A failed/timed-out `/validate` leaves nodes in an unknown state, never clean, and publish stays blocked (test)
- [ ] Every node mark, severity, and message originates in the server response — a test proves marks change with the response alone, local state identical
- [ ] A 3-`incomplete` / 0-`error` draft renders with zero destructive-token elements; the tray shows the two-count wording before expansion
- [ ] A verdict with `phase: null` is visible in the tray
- [ ] A delete that would orphan its successor is refused with a stated reason; a non-orphaning delete proceeds
- [ ] An add-step choice that would strand the deliverable is disabled with a stated reason
- [ ] The inspector's tool options come from `GET /workflows/grounding-bundle` with no frontend constant and no free-text box; an unregistered named tool renders struck through; a `degraded` bundle says so instead of rendering an empty picker
- [ ] A 🔒 gate row has no removal control in the DOM; no `grounding_mode` field is introduced anywhere
- [ ] Publish sits in the existing page header, disabled while `ok: false`, naming the first blocking reason
- [ ] At 900px there is exactly one bottom-edge region and no horizontal overflow
- [ ] With `visual_workflow_canvas` off, the Builder is byte-identical to the pre-phase build for all audiences including operators
- [ ] Wave 0 extraction lands and is committed **before** any editing feature code

### G-4 lived-experience UAT rows (operator-recognisable failure, driven live at verification)

- [ ] **U-1 Empty draft → first step → blocked publish.** Starting from an empty draft (40 of 95 real definitions), the first move reads as an invitation, not a broken screen; adding a step works; the header's disabled Publish names a real first reason rather than only greying
- [ ] **U-2 Delete a middle step.** On the 5-step shape: the flow re-stitches, everything downstream renumbers, the surface says how many moved, no orphan is left behind — and a delete that *would* orphan its successor is refused with a stated reason
- [ ] **U-3 Mid-build never reads as failure.** A half-built draft with `incomplete`-only verdicts does not look alarming; the tray separates the severities at rest, before anything is opened
- [ ] **U-4 Save → reload → nothing lost or invented.** Build, save, hard-reload: the definition returns identical in the real app, the browser-local nudge is still local, and nothing was silently published
- [ ] **U-5 Flag off = yesterday's Builder.** With `visual_workflow_canvas` off (including on an operator account), the toggle vanishes and no editing affordance is reachable anywhere — the 181 revert door is still a real door

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                                 |
|--------------------|-------|------|--------|-----------------------------------------------------------------------|
| Goal Clarity       | 0.92  | 0.75 | ✓      | 5 roadmap SCs + 5 sketch winners; "connect" resolved to implicit sequence |
| Boundary Clarity   | 0.90  | 0.70 | ✓      | Autosave→186, grounding_mode→185, skip_to_phase read-only, Spine untouched |
| Constraint Clarity | 0.85  | 0.65 | ✓      | Zero migration, one new dep (`zundo`), existing endpoints only, D-14   |
| Acceptance Criteria| 0.88  | 0.70 | ✓      | 19 pass/fail checks + 5 live G-4 rows                                  |
| **Ambiguity**      | 0.11  | ≤0.20| ✓      |                                                                       |

Status: ✓ = met minimum, ⚠ = below minimum (planner treats as assumption)

## Open items for discuss-phase (not requirement ambiguity — implementation territory)

- The precise debounce interval within the 400–600 ms band, and whether the "checking…" beat has a minimum visible duration
- Where the Wave 0 extraction boundary falls exactly (which props/state leave `PhaseNode.tsx` and `WorkflowBuilderPage.tsx`, and into how many modules)
- Whether `WorkflowConflictError` (409 on a frozen published row) needs surfacing in the canvas session or stays on the shipped path
- Reported-bugs cross-check per the CLAUDE.md mandate (6 open `surface: Agentic-RAG` reports at 183; BUG-260609-04's re-open trigger points at 188, not here)
- Carried from 183 as accepted debt, re-decidable here: **WR-09-01** (Escape and pane-click drop a focused field's pending autosave while ✕ does not — an edit-loss asymmetry that becomes more expensive once the panel is the primary authoring surface) and **WR-09-02** (only the ✕ path carries the "a dismissal must not PATCH a version" assertion)
- 183's U-3 row was testing an unreachable state and is re-pointed here: a zero-step draft becomes genuinely reachable once step deletion lands

---

*Phase: 184-editable-canvas-live-structural-validation-round-trip*
*Spec created: 2026-07-26*
*Next step: /gsd:discuss-phase 184 — implementation decisions (how to build what's specified above)*

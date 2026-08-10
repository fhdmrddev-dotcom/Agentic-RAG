# Phase 184: Editable Canvas + Live Structural Validation (Round-Trip) - Context

**Gathered:** 2026-07-26
**Status:** Ready for planning

<domain>
## Phase Boundary

A user can author a workflow on the canvas — add a step, insert one between two others,
reorder, delete, and configure the selected step — with every edit round-tripping losslessly
back to `WorkflowDefinition` through one client serializer (`canvasModel.fromCanvas`), saving
through the existing explicit-save draft CRUD, and carrying a live per-node validation verdict
that comes from the server and only from the server.

This phase does NOT own autosave / never-mint-a-version / co-edit guarding (Phase 186), the
authored `grounding_mode` or action-risk dial (Phase 185), live run state on nodes (Phase 188),
free handle-to-handle wiring, `skip_to_phase` authoring, or the `workflow_layouts` table.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**12 requirements are locked.** See `184-SPEC.md` for full requirements, boundaries, and
acceptance criteria (19 pass/fail checks + 5 live G-4 rows). Ambiguity score 0.11.

Downstream agents MUST read `184-SPEC.md` before planning or implementing. Requirements are
not duplicated here.

**In scope (from SPEC.md):**
- Add / insert-between / reorder / delete of phase-nodes on the canvas, with contiguous
  `phase_index` renumbering
- `canvasModel.fromCanvas` — the one client serializer — and its corpus-wide round-trip proof
- Browser-local cosmetic `dy` nudge + "Tidy up" (zero server state, zero migration)
- `zundo` undo/redo over structural history
- Extending the shipped `PhaseFormPanel` as the canvas's node inspector (CANVAS-03)
- Live debounced `POST /workflows/validate` wiring, last-write-wins, honest degraded state
- Per-node marks + the bottom problems tray, both driven only by server verdicts (VALID-03)
- The two cheap shape refusals (orphaning delete, stranding add)
- The three governance rails, including the live `GET /workflows/grounding-bundle` tool
  whitelist (CANVAS-04)
- Canvas toolbar (undo/redo + save state) and the page-header publish handoff with its named
  blocking reason
- **Wave 0 G-5 extraction** — lift node presentation/state out of `PhaseNode.tsx` and
  definition-mutation out of `WorkflowBuilderPage.tsx` into shared modules *before* any
  feature code

**Out of scope (from SPEC.md):**
- Autosave, "never mint a version", and the co-edit clobber guard — **Phase 186**
- Authored `grounding_mode` / the action-risk dial — **Phase 185**
- Free handle-to-handle wiring / a second outgoing edge — the engine has no `depends_on`
- Authoring `skip_to_phase` — stays read-only
- The `workflow_layouts` table / migration 114 — **slot 114 stays RESERVED**
- Editing in the `≣ Spine` view — the Spine stays read-only exactly as today
- Running a draft from the canvas
- Live run state on nodes — **Phase 188**
- AI-seeded canvas / node vocabulary — **Phase 187**
- `elkjs` / virtualization / scale hardening — **Phase 191**
- SEED-131 / SEED-132 (the `/validate` always-200 envelope seal and the `@model_validator`
  422 bypass) — inherited as open; 184 consumes the route as shipped

</spec_lock>

<decisions>
## Implementation Decisions

### The editing store + undo

- **D-184-01: The working definition moves into ONE page-wide zustand store, wrapped in
  `zundo`'s `temporal` middleware.** Landed in Wave 0. `WorkflowBuilderPage`'s
  `useState<BuilderState>` (`:100`) stops being the home of `definition`.
  - **Undo/redo AFFORDANCES stay canvas-only and flag-gated** (toolbar + keys render only on
    the flagged canvas view), but the HISTORY is complete.
  - Rationale: `PhaseFormPanel` is shared by BOTH views, so a config edit made from the Spine
    flows through the same `onPhaseChange`. A canvas-scoped store would leave those edits
    outside the history that R4 says must contain config changes.
  - **D-14 holds** because byte-identity is defined OBSERVABLY (D-181-07), and
    `revertByteIdentical.test.tsx` still gates it. This is a state-home refactor, not a
    behaviour change — see D-184-08's gate.

- **D-184-02: Structural edits push a history entry immediately; config edits coalesce.**
  Add / insert / reorder / delete are discrete atomic acts and each is one undo. Config-field
  edits coalesce via `zundo`'s `handleSet` debounce (~500 ms of quiet, or field blur), so one
  typed sentence is one undo rather than forty.
  - **The cosmetic `dy` NEVER enters the tracked store at all.** R4's "a nudge adds no history
    entry" is therefore true *by construction*, not by a filter that could be misconfigured.
    `partialize` is not needed as a nudge guard.

- **D-184-03: Undo crosses the save boundary and re-marks the draft dirty.** History is
  session-long; a save is not a barrier. Stepping back past a save point makes the in-memory
  definition differ from what was PATCHed, so the surface honestly reads `dirty` again.
  **Undo never writes to the server** — an undo that auto-PATCHes is exactly the surprise R6
  exists to prevent in a no-autosave phase.

- **D-184-04: One window `keydown` listener, mounted only while the flagged canvas view is
  active, that YIELDS to text fields.** It bails when `event.target` is an
  `input` / `textarea` / `contenteditable`, so native field-level undo still fixes a typo in a
  description. Follows the 183 Escape-listener precedent (`WorkflowBuilderPage.tsx:216` —
  window listener gated on state). Toolbar buttons remain the discoverable path.
  Bindings: `⌘Z` / `Ctrl+Z` (undo), `⇧⌘Z` / `Ctrl+Y` (redo).

### Wave 0 — the extraction boundary

- **D-184-05: Two things leave `WorkflowBuilderPage.tsx`; persistence STAYS.**
  1. The definition state → the D-184-01 store.
  2. A pure **`definitionOps.ts`** — `addPhase` / `insertPhaseAt` / `movePhase` /
     `removePhase` / `renumber` / `patchPhaseConfig`, all `(phases, args) => phases`, zero
     React, zero store import.
  - The page keeps composition, the describe/compose flow, the flag gate, and **persistence**
    (`draftIdRef` / `creatingRef` / `onPersist:353` / `onSaveDraft:378`).
  - Rationale: pure ops make R1's contiguous-`phase_index` proof a plain unit test with no
    canvas and no store. Persistence is the one path that can corrupt a real row, and
    **Phase 186 rewrites exactly that seam for autosave** — extracting it now would be churn
    against a seam about to move.
  - `patchPhaseConfig` joins `definitionOps` so there is exactly ONE mutation home shared by
    both views.

- **D-184-06: `PhaseNode.tsx` splits into a pure card + a thin adapter.**
  - **`PhaseNodeCard`** — purely presentational, takes the slot contract
    (icon · title · subtitle · badges ≤2 · status · verdict), **zero `@xyflow` import**, so it
    renders in a plain test and Phase 188 can reuse it outside a `ReactFlowProvider`.
  - **`PhaseNode`** — a thin `NodeProps` → slots adapter.
  - **`nodePresentation.ts`** — `PHASE_TINTS`, `GROUNDING_TONES`, `renderPhaseMark()`.
  - **The badge slot is typed as a max-2 tuple**, so Phase 185 physically CANNOT add a third
    badge. The 137-D two-badge budget is enforced by the type system, not by a review comment.
  - This is sketch extensibility seam #1: 185 / 188 / 189 add **data, not layout**.

- **D-184-07: The two cross-cutting `PHASE_GLYPHS` swaps ship as their OWN atomic commit at
  the HEAD of Wave 0.** `llm_agent` → `compass`, `llm_batch_agents` → `handshake` (the
  luminance-34.5 outlier), with their own five-surface before/after check (workflows card,
  run + publish soul headers, gauntlet stages, live step cards).
  - This honours BOTH records: the sketch MANIFEST's "REQUIRED before 184 builds" (137-B makes
    the icon the sole carrier of step type) and D-183-14's independent-revert concern — whose
    actual subject is the **commit** boundary, not the phase boundary. A `git revert` of that
    one commit undoes the icon decision without touching the canvas.

- **D-184-08: Wave 0 passes an UNMODIFIED-ASSERTIONS gate before any feature code lands.**
  - The existing suite passes with **zero assertion edits**. Import-path-only changes are
    allowed and **every one is enumerated in the SUMMARY**.
  - Plus: per-file test **counts** pinned (not just failure counts), the canvas snapshot
    byte-unchanged, `tsc` error count not increased, `revertByteIdentical.test.tsx` green.
  - Rationale: an assertion that *has* to change means the extraction was not
    behaviour-preserving — that is the signal, not an inconvenience. Guards the two failure
    modes this project has already hit: WR-08-03 (untyped map silently reverts a fix with a
    green build) and the 177 lesson (a "net-new" test file replacing an existing suite is
    invisible to a failures-only differential).

### Edit gestures + delete safety

- **D-184-09: Reorder has a pointer path and a keyboard path, one op behind both.**
  - Pointer: drag along the lane (R1's literal ask).
  - Keyboard: with a node selected, **`⌥←` / `⌥→`** move it one position, with a live-region
    announcement ("Step moved to position 2 of 5"). Alt-modified so it cannot collide with
    `@xyflow`'s own arrow-key node navigation or with panel field navigation.
  - Rationale: 183 made every node keyboard-activatable and shipped a real screen-reader pass;
    a drag-only reorder would regress that. At 5 steps max the keyboard path is genuinely
    competitive, not a grudging fallback.

- **D-184-10: One free drag; the AXES split the two meanings.** On drop, the **x**-component
  resolves to a lane slot (a definition edit — undoable, validates, marks dirty) and the card
  snaps to its computed lane x; the **y**-component is kept verbatim as the browser-local `dy`
  (no history, no network, never serialized). **No modifier to learn.**
  - The op that runs is decided by which component changed, so **a purely vertical drag can
    never enter the definition** — separation by construction, matching 138 C-local as drawn.

- **D-184-11: The `＋` opens a plain-language step-type picker; the slug is auto-generated and
  not user-editable.**
  - The picker lists the 6 step types in the D-183-06 plain-language sentences ("Search the
    knowledge base", "Wait for you", …) with the 3D mark, at the insertion point. A choice
    that would strand the deliverable renders **disabled with its reason inline** (R10b).
  - Choosing inserts a minimal valid phase there and opens `PhaseFormPanel` on it.
  - Slug = type-derived + uniqueness suffix (e.g. `search-2`). **Not editable in this phase**:
    it is the node identity (`node.id == phase.slug`) and a `skip_to_phase` target, so renaming
    needs a cascade nobody asked for. The plain-language title is what the user names.
  - Forced by the code: `PhaseFormPanel` conditions on `phase.config.phase_type` (`:431`) and
    offers no way to change it, so the type MUST be chosen at add time.

- **D-184-12: Delete is immediate, with Undo inline on the message U-2 already requires.**
  "Removed *Write a section* · 2 steps renumbered" carries an inline **Undo** action. **No
  confirm dialog** — undo is the safety net it was built to be, and a modal on the phase's
  most-used destructive act contradicts the sketch build rule that the gate must never become
  the thing that stops someone building.
  - The R10(a) orphaning case stays a **REFUSAL with a stated reason**, not a confirm. The two
    are different acts and must read differently.

### Live validation + session edges

- **D-184-13: 500 ms debounce over ALL definition changes; last-write-wins is enforced twice.**
  - One 500 ms debounce covering structural AND config edits alike (the server has an opinion
    about both).
  - In-flight requests are **aborted** via `AbortController` on a new edit, **and** every
    response carries a monotonic **sequence number** with stale ones dropped.
  - Belt AND braces deliberately: abort is best-effort — a response already in the network
    buffer can still resolve, and R7's out-of-order test must pass on the guard, not on luck.

- **D-184-14: Every non-200 lands in the degraded state; the 422 gets its own honest line.**
  - Behaviour is uniform and fail-closed: marks go to **unknown, never clean**, and publish
    stays blocked.
  - Wording is NOT uniform: a **422** (SEED-132's `@model_validator` / `extra="forbid"`
    envelope bypass) says *"We couldn't check this — the workflow's shape isn't something we
    can read yet"*; a network failure/timeout says *"We couldn't reach the check."* Same
    behaviour, no lie about which thing went wrong — a user hitting a reproducible 422 must
    not be told to retry forever.
  - The 422 body is **logged, not shown** — leaking Pydantic `loc`/`msg` strings into a
    business-user surface is SEED-131's envelope work, not a client-side pretty-printer.

- **D-184-15: No `/validate` call fires until the user's first edit.**
  - A zero-step draft shows the "Add your first step" invitation with **no tray and no marks**.
    Publish is disabled with a plain invitation ("Add a step to get started") — an invitation,
    **not a claimed verdict**, so this is not client-side validation (D-182-06 intact).
  - The moment a step exists, the live loop takes over and **the server owns every verdict
    from then on** (VALID-03 unbroken).
  - Rationale: validate-on-mount would greet a brand-new workflow with `ok: false` +
    `no_terminal` and a problems tray — precisely the broken-screen read U-1 exists to catch.

- **D-184-16: 184 pays down all three session-edge debts.**
  1. **Unsaved-work leave guard** — a dirty-state guard on the `← Workflows` breadcrumb, plus
     `beforeunload` for tab close. Newly expensive: a session can now be five structural edits
     deep with no autosave until Phase 186. Sits inside R12's "one session, one way out".
  2. **WR-09-01 / WR-09-02** (carried from 183 as accepted debt, re-opened here because the
     panel becomes the primary authoring surface) — commit the focused field's pending value
     before unmount on ALL THREE dismissal paths (✕, Escape, pane-click), and put the "a
     dismissal must not PATCH a version" assertion on all three, not just ✕.
  3. **409 conflict** — `updateWorkflowDraft`'s typed `WorkflowConflictError` gets its own
     honest message ("This version is published and can't be edited — use Tweak to start a new
     draft") instead of a generic error.

- **D-184-17: R2's round-trip proof runs over a COMMITTED corpus dump plus a shape generator.**
  - A one-off script dumps the live definitions to a **committed JSON file** recording its
    provenance (date, row count, query). The test reads that FILE — **zero I/O at test time**,
    still hermetic, so 183's no-live-read property survives.
  - Plus a **hand-rolled shape generator** (no new dependency — `zundo` is the only net-new
    dep) exercising combinations the corpus does not contain: branch edges, gate-heavy phases,
    single-phase, deep chains.
  - **Why this does not violate the 183 fixture convention:** that convention protects
    *snapshot* tests, where more input means more golden output to maintain and drift. A
    round-trip test is a **property** (`fromCanvas(toCanvas(x))` deep-equals `x`) with **no
    golden output**, so a large corpus costs nothing to maintain and is pure coverage.
    `__fixtures__/canvasFixtures.ts` stays exactly as it is for the snapshot suite.
  - The corpus is 2-steps-modal and uses `skip_to_phase` **zero times**, so the dump alone
    would barely exercise the serializer — the generator is what actually earns R2.

### Claude's Discretion

- **Undo store:** history depth cap (~50 entries), store created per-Builder-mount rather than
  as a module singleton.
- **Wave 0:** module file names and homes; whether Wave 0 is one plan or two (ops+store /
  node split).
- **Gestures:** `＋` always visible under 1024 px and on touch, hover-revealed above it; after
  a delete, selection moves to the following step (or the preceding one if it was last); the
  empty draft gets a named "Add your first step" invitation per U-1, not a bare `＋`.
- **Validation feel:** the "checking…" beat carries a ~300 ms minimum visible duration so it
  cannot strobe; the problems tray does NOT auto-open on a new `error` (the summary line
  updates and the user opens it); verdicts are **held stale and dimmed** during an in-flight
  check rather than cleared — clearing makes marks flicker on every keystroke.
- **Nudge storage:** `localStorage`, keyed per user + draft id. A draft that has never been
  saved has no id, so its nudges live in memory for the session only and are not persisted —
  no orphan-key bucket to garbage-collect. "Tidy up" clears the current workflow's key only.
- **Tray / toolbar / publish composition** within R12's one-bottom-region, two-rows-max rule.
- Exact wording of all user-facing strings, anchored to the sketch vocabulary.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope + requirements
- `.planning/phases/184-editable-canvas-live-structural-validation-round-trip/184-SPEC.md` —
  **LOCKED REQUIREMENTS. MUST read before planning.** 12 requirements, boundaries,
  constraints, 19 acceptance checks + 5 G-4 live UAT rows.
- `.planning/ROADMAP.md` — Phase 184 section (goal, SC#1-5, flags); Phase 185 / 186 / 188
  sections for what this phase must NOT pre-empt.
- `.planning/REQUIREMENTS.md` — CANVAS-02, CANVAS-03, CANVAS-04, VALID-02, VALID-03.
- `.planning/research/PITFALLS.md` — **Pitfall 3** (layout NEVER in the definition JSONB;
  round-trip as a gate). Pitfall 1 (anti-drift), Pitfall 4 (run honesty).

### The G-2 sketch gate — the locked acceptance bar
- `.planning/sketches/MANIFEST.md` — **the 2026-07-26 session decision block**: winners
  137-B card · 138 C-local · 139-A · 140-A · 141-B; the three composition risks; the four
  extensibility seams; the icon-swap pre-req.
- `.planning/sketches/138-growing-the-flow/README.md` — **winner C-local** (spine order +
  browser-local nudge, zero migration).
- `.planning/sketches/139-validation-while-building/README.md` — **winner A** (node mark +
  problems tray; C's cheap prevention folded in).
- `.planning/sketches/140-step-inspector-and-rails/README.md` — **winner A** (extend the
  shipped `PhaseFormPanel`; the gate rail is where 185 plugs in).
- `.planning/sketches/141-the-authoring-session/README.md` — **winner B** (canvas toolbar +
  page header; publish in the EXISTING header, not a new band).
- `.planning/sketches/137-agentic-canvas-look/README.md` — the card language (tint behind the
  icon only; colour budget reserved for 188; motion keys off run state, never selection).
- `.planning/sketches/themes/canvas-184.css` — the locked card CSS.
- `.planning/sketches/themes/phase-icons-3d.js` — the verified 3D marks. **Never text glyphs.**
- `.claude/get-shit-done/references/icon-convention.md` — the Phase 127 icon convention.

### Inherited locked decisions
- `.planning/phases/183-read-only-canvas/183-CONTEXT.md` — **D-183-01** (in-Builder toggle, no
  nav entry), **D-183-02** (Spine default, session-only), **D-183-03** (flag off ⇒ toggle
  vanishes), **D-183-05** (one `onSelectNode` contract), **D-183-06** (plain-language step
  sentences), **D-183-07** (two badge slots; 184 must NOT invent `grounding_mode`),
  **D-183-12** (layout is a pure function, no DOM measurement), **D-183-13** (one shared
  vocabulary module), **D-183-14** (the icon swaps' own-commit rule — see D-184-07),
  **D-183-15 + its amendment C-1** (client parse aligned to the backend).
- `.planning/phases/182-server-validation-seam/182-CONTEXT.md` — **D-182-06** (one lint copy,
  zero client-side re-implementation), **D-182-03** (the `error` / `incomplete` split), the
  `/validate` verdict shape 184 consumes.
- `.planning/phases/181-revert-foundation/181-CONTEXT.md` — **D-181-01** (flag-off
  byte-identical for EVERYONE incl. operators), **D-181-02** (404 pre-auth, not 403),
  **D-181-07** (byte-identical defined OBSERVABLY — the basis for D-184-01's refactor).

### The code to extend (frontend)
- `frontend/src/components/workflows/canvasModel.ts` — `toCanvas` (`:214`), `CANVAS_LAYOUT`
  (`:62`), `CANVAS_NODE_TYPES` (`:82`), `PhaseNodeData` (`:108`), `CanvasProjection` (`:154`),
  `buildPhaseData` (`:187`). **`fromCanvas` lands here and nowhere else.**
- `frontend/src/components/workflows/PhaseNode.tsx` — the D-184-06 split target.
  `PHASE_TINTS` (`:114`), `GROUNDING_TONES` (`:138`), `renderPhaseMark` (`:159`),
  `PhaseNode` (`:171`), `UnresolvedSkipNode` (`:278`), `EndCapNode` (`:311`).
- `frontend/src/components/workflows/WorkflowCanvas.tsx` — `WorkflowCanvasProps` (`:164`),
  the mount. Currently read-only; gains the editing surface.
- `frontend/src/pages/WorkflowBuilderPage.tsx` — `BuilderDefinition` (`:~95`), `BuilderState`,
  `handleSelectNode` (`:204`), `clearSelection` (`:212`), the Escape listener (`:216` — the
  D-184-04 precedent), `onPhaseChange` (`:334`), `onPersist` (`:353`), `onSaveDraft` (`:378`),
  the flag gate (`:190-200`), the lazy canvas import.
- `frontend/src/components/workflows/PhaseFormPanel.tsx` — the ONE form (140-A). Conditions on
  `phase.config.phase_type` (`:431`); the required `onClose` prop; the 44 px collapsed rail;
  the <768 px bottom sheet. **No second form component may be added.**
- `frontend/src/components/workflows/phaseVocabulary.ts` — the 183 shared module
  (`PhaseSpecJSON`, `parseSkipTarget`, plain-language titles).
- `frontend/src/components/workflows/deriveTier.ts` + `soulData.ts` — `groundingFor()` /
  `CitationPolicy` / `ValidatorKind`; the gate rail is **derived** here exactly as today.
- `frontend/src/lib/api.ts` — `createWorkflowDraft` (`:3314`), `updateWorkflowDraft` (`:3340`,
  throws typed `WorkflowConflictError` on 409).
- `frontend/src/components/workflows/__fixtures__/canvasFixtures.ts` — the 183 transcribed
  fixture corpus **and its provenance rules**; read its header docblock before adding fixtures
  (see the anti-drift note in `<code_context>`).
- `frontend/src/components/admin/revertByteIdentical.test.tsx` — the 181 acceptance gate; its
  scope-freeze assertions must keep passing through Wave 0.

### The backend contract (consumed as shipped — no backend change)
- `backend/app/api/workflows.py` — `POST /workflows/validate` (`:510`; always-200 envelope,
  `require_canvas()` alone per D-182-05, takes a raw `WorkflowDefinition` body so an UNSAVED
  draft validates), the severity classifier (`:495` — unknown codes fail-closed to `error`),
  `GET /workflows/grounding-bundle` (`:657`).
- `backend/app/services/harness/reachability.py` — `parse_skip_target` (`:89`),
  `UNSATISFIABLE_SKIP` (`:154`). The parity anchor.
- `backend/app/models/` — `WorkflowDefinition` (`extra="forbid"`) + `PhaseConfig`'s
  discriminated union. **Pydantic stays authoritative.**

### Stack
- `zundo` — **the one net-new dependency.** `zustand@5.0.13` is already a DIRECT dependency
  (`frontend/package.json:49`), `@xyflow/react@^12.11.2` at `:33`, React `^19.2.4` at `:39`.
- `.planning/research/STACK.md` — dependency rationale.

### Competitor evidence backing the constrained-spine bet
- `.planning/research/deep-dive/` — Glean scopes drag-and-drop to reordering, not free wiring;
  n8n's DAG complexity cliff at 20-30 nodes.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`PhaseFormPanel`** (786 L) — the shipped 400 px inspector. 140-A extends it IN PLACE; the
  canvas becomes a third way IN to one form. Required `onClose`, 44 px rail, <768 px bottom
  sheet all survive.
- **`canvasModel.toCanvas`** — the projection `fromCanvas` must invert. `PhaseNodeData` and
  `buildPhaseData` already define most of the slot contract D-184-06 formalises.
- **`POST /workflows/validate`** — built, shipped, and **has no frontend caller**. Takes a raw
  definition body, so no draft id and no save is needed before validating.
- **`GET /workflows/grounding-bundle`** — also shipped with no caller; the CANVAS-04 tool
  whitelist source. Has a `degraded` state that R11 requires be told honestly.
- **Explicit-save path** — `onPersist` create-once-then-PATCH with `draftIdRef` + `creatingRef`
  already guards the UNIQUE(slug, version) collision. **Unchanged by this phase.**
- **`WorkflowConflictError`** — typed 409 already thrown by `updateWorkflowDraft`; D-184-16
  only gives it a message.
- **`zustand@5.0.13` is a DIRECT dependency**, not merely `@xyflow`'s internal — `zundo` has a
  clean, already-present peer.

### Established Patterns
- **VANISH, never a locked placeholder** — flag off ⇒ the affordance does not render at all.
- **Push grid, not overlay** — `minmax(0,1fr) <44px|400px>`; the canvas inherits it unchanged.
- **Derive, never fetch, never invent** — for presentation. But **verdicts are the exception**:
  VALID-03 says every severity/code/message comes from the server, never a client guess.
- **Window listener gated on state** — the 183 Escape handler is the precedent D-184-04 follows.
- **Immutability lives at publish** — draft edits PATCH one row; versions mint only at publish.
- **No router** — navigation is a `useState<ActiveView>` switch; there is no route-change hook,
  so D-184-16's leave guard hangs off the breadcrumb handler + `beforeunload`, not a router
  blocker.

### Integration Points
- The new zustand store — consumed by `WorkflowBuilderPage`, `WorkflowCanvas`, and
  `PhaseFormPanel`'s change path.
- `definitionOps.ts` — consumed by the store's actions and unit-tested directly.
- `PhaseNodeCard` — consumed by the `PhaseNode` adapter now; by Phase 188 later.
- `frontend/package.json` — one net-new dependency (`zundo`).
- **Nothing backend. No migration. No cloud parity owed.**

### Anti-drift notes for the planner

1. **The corpus numbers in `184-SPEC.md` are known to drift.** SPEC quotes "95 definitions /
   40 with zero phases" (the 183-CONTEXT-era read). `canvasFixtures.ts`'s own header records
   that a later reproducible read the same week found different counts (corrections C-3/C-4 —
   51 phases / 71 zero-phase / one 5-phase, and a definition that was 5-phase at sketch time
   is 0-phase now). **Do not treat "95" as a live-verifiable assertion.** D-184-17 resolves
   this: the dump records its own provenance and row count at dump time, and the proof is a
   property over whatever the dump contains plus generated shapes.
2. **`canvasFixtures.ts` has an acceptance guard that FORBIDS live-read tokens.** Read its
   header docblock before touching it. D-184-17's dump is a SEPARATE committed artifact for
   the round-trip property suite — `canvasFixtures.ts` stays untouched for the snapshot suite.
3. **Treat in-code claims of prior extraction as unverified — grep before believing.**
   `soulData.ts` asserted the `PhaseSpineGraph` glyph duplicate was already extracted; it was
   not (D-183-13). Same discipline applies to anything Wave 0 claims to have lifted.
4. **A guard that only passes by making a comment lie is a broken guard** (D-ITEM-183-02, the
   fifth instance of that trap in Phase 183). Source-grepping tests must not force docblocks
   to omit the real identifier.

</code_context>

<specifics>
## Specific Ideas

- The delete message is the same surface U-2 already requires: *"Removed **Write a section** ·
  2 steps renumbered"* — with **Undo** inline on it.
- The reorder announcement is positional and plain: *"Step moved to position 2 of 5."*
- The problems-tray summary separates the two severities in words BEFORE it is opened:
  *"1 problem · 2 things to finish."* A workflow-wide verdict (`phase: null`, e.g.
  `business_requirement`) has a home in the tray — that is why 139-A beat 139-B.
- Degraded wording is split by cause: 422 ⇒ *"We couldn't check this — the workflow's shape
  isn't something we can read yet."* Network/timeout ⇒ *"We couldn't reach the check."*
- The empty draft's Publish reads as an invitation, not a verdict: *"Add a step to get
  started."*
- The save state says *"Saved · still a draft"* — no word implying published, ever.
- **The colour budget is load-bearing.** Strong colour belongs to Phase 188's run status.
  184's marks are a red `✕` for `error` and a **dashed grey `○`** for `incomplete` — a
  3-`incomplete` / 0-`error` draft must render with **zero** destructive-token elements.
- **Motion keys off run state, never selection.** 184 still has no run state, so motion stays
  ambient only. A selected node must NOT be the thing that animates.
- The two refusals name their reason and never consult `/validate` — both are decidable from
  the local shape, and no refusal is silent.

</specifics>

<deferred>
## Deferred Ideas

- **Autosave, the never-mint-a-version guarantee, and the co-edit clobber guard** — Phase 186
  (CONCUR-01/02). 184 deliberately keeps the shipped explicit-save path so 186 remains a real
  phase with a real seam. D-184-05 leaves persistence on the page for exactly this reason.
- **Authored `grounding_mode` + the action-risk dial** — Phase 185. 184 must not invent that
  field; the gate rail is DERIVED here exactly as `groundingFor()` does today. D-184-06's slot
  contract and the max-2 badge tuple are the seam 185 lands on.
- **Live run state on nodes** — Phase 188. `PhaseNodeCard`'s `status` slot and its zero-`@xyflow`
  import exist so 188 can reuse the card outside a `ReactFlowProvider`.
- **`workflow_layouts` / migration slot 114** — RESERVED, not spent. **Promotion trigger:** a
  nudge must survive across devices, OR a layout is deliberately shared between editors.
  Neither is true today.
- **Editable slug / a rename cascade** — D-184-11 defers it; the slug is node identity and a
  `skip_to_phase` target.
- **A phase-type control inside `PhaseFormPanel`** — not needed once the type is chosen at add
  time (D-184-11). Re-open if a user needs to convert an existing step's type.
- **SEED-131 / SEED-132** — the `/validate` always-200 envelope seal (a top-level `degraded`
  marker or a third severity) and the `@model_validator` 422 bypass. D-184-14 is the
  client-side mitigation only; the honest fix is a backend envelope change in a later phase.
- **Flipping Canvas to the default view** — D-183-02 handed this to 184, but the canvas is
  brand-new and editable; leave Spine as the cold-start default until the editing surface has
  survived real use. Re-open when 186's autosave makes a canvas session lossless.
- **Persisting the Spine/Canvas view preference** — still session-only.
- **The published-workflow read-only canvas door** (D-183-04) — 184 does not need it; edits
  happen on drafts. Re-open at Phase 188.
- **`elkjs` / virtualization** — Phase 191, conditional.
- **`visual_workflow_canvas` as an INCIDENT kill switch** — flag propagation is reload-gated by
  design (`EffectiveFeaturesProvider` fetches once per session), so open tabs keep the canvas
  until they reload. Fine for a planned rollback; a decision only if it is ever needed as a
  live kill switch.

### Reported bugs reviewed (not folded)

Cross-check performed per the CLAUDE.md mandate. **7 open `surface: Agentic-RAG` reports; ZERO
overlap with workflow authoring — none folded.**

- **BUG-260609-02** (phantom generic "Sub-task" in Sub-Results) — `affected_areas:
  frontend/panel, harness/sub-agents`. Harness run honesty. Left open → Phase 188 cluster.
- **BUG-260609-04** (phase card shows placeholder slug `phase-0`, reconcile-floor clobber) —
  `affected_areas: frontend/panel, harness/run-honesty`. Its `re_open_trigger` explicitly
  points at **Phase 188**, not here: 184 edits a STATIC definition and reads `phase.slug`
  directly, so the live-run clobber cannot manifest. Left open, trigger unchanged.
- **BUG-260718-02** (reasoning-stream flicker + sources open by default) — `frontend/chat,
  frontend/streaming, frontend/citations`. Left open.
- **BUG-260718-03** (`write_todos` card redundant with the workspace Todos panel) —
  `frontend/chat, frontend/workspace-panel`. Left open.
- **BUG-260718-04** (chat model selection resets on navigate/refresh) — `frontend/chat,
  model-selection`. Left open.
- **BUG-260722-02** (gpt-5.6 reasoning models return empty response in the tool loop) —
  `backend/agent-loop, cross-provider/openai`. Left open.
- **BUG-260714-02** (OpenRouter tool-call 404) — `surface: OpenRouter`, external. Never folds.

</deferred>

---

*Phase: 184-editable-canvas-live-structural-validation-round-trip*
*Context gathered: 2026-07-26*

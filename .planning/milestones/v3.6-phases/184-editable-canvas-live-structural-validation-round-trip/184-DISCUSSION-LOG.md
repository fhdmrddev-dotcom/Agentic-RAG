# Phase 184: Editable Canvas + Live Structural Validation (Round-Trip) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-26
**Phase:** 184-editable-canvas-live-structural-validation-round-trip
**Areas discussed:** Undo & the editing store, Wave-0 extraction boundary, Edit gestures & delete safety, Validation timing & session edges

**Pre-discussion state:** `184-SPEC.md` loaded — 12 requirements locked (ambiguity 0.11), so
the discussion was implementation-only. G-2 sketch gate satisfied (winners 137-B / 138 C-local /
139-A / 140-A / 141-B recorded 2026-07-26). G-5 satisfied by the SPEC's mandated Wave 0.
Reported-bugs cross-check: 7 open `surface: Agentic-RAG` reports, zero overlap with workflow
authoring — none folded.

---

## Undo & the editing store

### Q1 — Where does the working definition live so zundo has something to snapshot?

| Option | Description | Selected |
|--------|-------------|----------|
| Page-wide zustand store | Definition moves out of `useState` into one zustand store wrapped in zundo's `temporal`; undo affordances stay canvas-only + flag-gated, but history is complete | ✓ |
| Canvas-scoped store only | Canvas mounts its own store over just `phases[]`; zero new state on the flag-off path, but two stores can disagree and Spine-view config edits are invisible to history | |
| Store owns phases, page owns the rest | Split seam — store owns `phases[]`, `useState` keeps the rest; definition assembled from two places at save time | |

**User's choice:** Page-wide zustand store
**Notes:** The deciding factor was that `PhaseFormPanel` is shared by both views, so a
canvas-scoped store would silently drop Spine-view config edits from a history R4 says must
contain them. D-14 survives because byte-identity is defined observably (D-181-07).

### Q2 — What counts as ONE undo step?

| Option | Description | Selected |
|--------|-------------|----------|
| Structural immediate, config coalesced | Structural edits push at once; config edits coalesce via `handleSet` debounce (~500 ms / blur) | ✓ |
| Everything debounced uniformly | One debounce over all changes; two fast structural edits could merge into one undo | |
| Snapshot every set | zundo default; typing a description makes undo useless as a structural escape hatch | |

**User's choice:** Structural immediate, config coalesced
**Notes:** Also locked that the cosmetic `dy` never enters the tracked store at all, so R4's
no-history-on-nudge is true by construction rather than by filter.

### Q3 — Does undo cross the save boundary?

| Option | Description | Selected |
|--------|-------------|----------|
| Undo crosses saves, marks dirty | Session-long history; stepping past a save re-marks dirty; never writes | ✓ |
| Save is a commit point | Saving truncates the stack; simpler dirty-tracking, but ⌘Z going dead is unexplained | |
| Undo crosses saves, auto-re-saves | Undo silently PATCHes the reverted state — listed only for completeness | |

**User's choice:** Undo crosses saves, marks dirty
**Notes:** An undo that auto-PATCHes is the surprise R6 exists to prevent in a no-autosave phase.

### Q4 — How are ⌘Z / Ctrl+Z bound given the inspector is full of text inputs?

| Option | Description | Selected |
|--------|-------------|----------|
| Window listener, yield to text fields | Mounted only on the active flagged canvas view; bails on input/textarea/contenteditable | ✓ |
| Canvas container-scoped only | No conflict by construction, but ⌘Z silently does nothing when focus sits on body | |
| Toolbar buttons only | Zero binding risk, but R4 explicitly names the keyboard shortcuts | |

**User's choice:** Window listener, yield to text fields
**Notes:** Follows the 183 Escape-listener precedent (`WorkflowBuilderPage.tsx:216`).

---

## Wave-0 extraction boundary

### Q1 — What leaves `WorkflowBuilderPage.tsx`?

| Option | Description | Selected |
|--------|-------------|----------|
| Store + pure ops module | Definition state → store; `definitionOps.ts` of pure `(phases, args) => phases` functions; persistence stays on the page | ✓ |
| Also extract persistence | Plus a `useDraftPersistence` hook — but touches the one path that can corrupt a real row, and Phase 186 rewrites that seam anyway | |
| Store only, ops inline | Ops become store actions; only testable through the store, and 185's dials attach to actions not pure functions | |

**User's choice:** Store + pure ops module
**Notes:** Pure ops make R1's contiguous-index proof a unit test with no canvas.

### Q2 — What leaves `PhaseNode.tsx`?

| Option | Description | Selected |
|--------|-------------|----------|
| Slots + presentational card split | `PhaseNodeCard` (pure, zero @xyflow) + thin adapter + `nodePresentation.ts`; badge slot typed as a max-2 tuple | ✓ |
| Slot contract only, one component | Tables move out but the card still needs a ReactFlowProvider to render | |
| Tables out only | Minimal; doesn't satisfy the sketch extensibility seam, and 185 lands on an unextracted node | |

**User's choice:** Slots + presentational card split
**Notes:** The max-2 badge tuple makes the 137-D budget a typecheck error rather than a review
comment — 185 physically cannot add a third badge.

### Q3 — The cross-cutting icon swaps (a genuine tension between two locked records)

Sketch MANIFEST: the `handshake` / `compass` swaps are "REQUIRED before 184 builds".
D-183-14: they must ship under their own commit, not as a canvas side effect.

| Option | Description | Selected |
|--------|-------------|----------|
| Own commit inside Wave 0 | Atomic commit at the head of Wave 0 with its own five-surface before/after check | ✓ |
| Separate /gsd:fast task first | Strictest reading of D-183-14; costs a context switch before planning | |
| Defer past 184 | Contradicts the MANIFEST — 137-B makes the icon the sole carrier of step type | |

**User's choice:** Own commit inside Wave 0
**Notes:** D-183-14's actual subject is the commit boundary, not the phase boundary — a
`git revert` of that one commit undoes the icon decision without touching the canvas.

### Q4 — What proves Wave 0 changed no behaviour?

| Option | Description | Selected |
|--------|-------------|----------|
| Unmodified-assertions gate | Zero assertion edits (import-path-only, each enumerated); counts pinned; snapshot byte-unchanged; tsc count not increased | ✓ |
| Suite green + counts pinned | Assertions may be updated where a seam genuinely moves — but that's exactly the 177 coverage-loss mode | |
| Suite green is enough | The bar that let both prior regressions through | |

**User's choice:** Unmodified-assertions gate
**Notes:** Explicitly guards WR-08-03 (green build hiding a silent revert) and the 177 lesson.

---

## Edit gestures & delete safety

### Q1 — How does reorder work, and what's the keyboard equivalent?

| Option | Description | Selected |
|--------|-------------|----------|
| Drag + selected-node move keys | Drag along the lane; ⌥← / ⌥→ on the selected node with a live announcement | ✓ |
| Drag + explicit move controls | Discoverable, but spends card real estate the two-badge budget is already tight on | |
| Move controls only, no drag | R1 explicitly names dragging; the canvas would feel inert | |

**User's choice:** Drag + selected-node move keys
**Notes:** Alt-modified so it can't collide with @xyflow's own arrow-key node nav.

### Q2 — One drag, two meanings — how are reorder and nudge disambiguated?

| Option | Description | Selected |
|--------|-------------|----------|
| Axes split it — x reorders, y nudges | One free drag; x resolves to a lane slot, y is kept as the browser-local `dy`; no modifier | ✓ |
| Modifier-gated nudge | Zero ambiguity, but an undiscoverable modifier and a spring-back that reads as rejection | |
| Nudge via a dedicated grip | Explicit, but another control on an already-budgeted card | |

**User's choice:** Axes split it
**Notes:** The op that runs is decided by which component changed, so a purely vertical drag can
never enter the definition — separation by construction.

### Q3 — What does the ＋ open, and where does the slug come from?

| Option | Description | Selected |
|--------|-------------|----------|
| Plain-language type picker, auto-slug | 6 types in D-183-06 sentences at the insertion point; stranding choices disabled with a reason; slug auto-generated, not editable | ✓ |
| Picker + editable slug | Slug is node identity and a `skip_to_phase` target — needs a rename cascade nobody asked for | |
| Insert a default step, retype in the panel | The panel has no type control today (conditions on `phase_type` at `:431`), and R10(b) would have nowhere to live | |

**User's choice:** Plain-language type picker, auto-slug
**Notes:** Verified in code during discussion — `PhaseFormPanel:431` conditions on
`phase.config.phase_type` and offers no way to change it, so type MUST be chosen at add time.

### Q4 — How safe does delete need to be?

| Option | Description | Selected |
|--------|-------------|----------|
| Immediate + undo, with a stating message | ✕ deletes at once; the U-2 message carries an inline Undo; no modal | ✓ |
| Confirm dialog on configured steps only | Inconsistent gesture and a fuzzy "is it configured" predicate that will drift | |
| Always confirm | Friction on the most-used destructive act, where undo already exists | |

**User's choice:** Immediate + undo, with a stating message
**Notes:** The R10(a) orphan case stays a refusal with a reason — a refusal and a confirm are
different acts and must read differently.

---

## Validation timing & session edges

### Q1 — What triggers `/validate`, and how is last-write-wins enforced?

| Option | Description | Selected |
|--------|-------------|----------|
| 500 ms on all edits, AbortController + seq guard | One debounce over structural and config alike; abort AND a monotonic sequence guard | ✓ |
| Structural immediate, config debounced | Fastest feedback, but two timing paths and three round-trips for add-add-add | |
| Debounce + sequence guard only | Satisfies R7's property, but abandoned requests still run folder-tree and skill-registry reads server-side | |

**User's choice:** 500 ms on all edits, AbortController + seq guard
**Notes:** Belt and braces deliberately — abort is best-effort, so a buffered response can still
resolve and R7's out-of-order test must pass on the guard, not on luck.

### Q2 — What does a 422 render as? (SEED-131/132 inherited open)

| Option | Description | Selected |
|--------|-------------|----------|
| Degraded, with its own honest line | Same fail-closed behaviour; distinguishable wording for 422 vs network failure; body logged not shown | ✓ |
| Uniform degraded, no distinction | One code path, but a reproducible 422 reads as transient and the user retries forever | |
| Surface the 422 detail | Leaks Pydantic loc/msg into a business-user surface; the honest fix is SEED-131's envelope work | |

**User's choice:** Degraded, with its own honest line

### Q3 — Does an empty draft get validated on arrival?

| Option | Description | Selected |
|--------|-------------|----------|
| Validate on first edit, not on mount | Empty draft shows the invitation with no tray/marks; server owns every verdict from the first step onward | ✓ |
| Validate on mount always | Purest VALID-03, but a new workflow opens with a problems tray — the broken-screen read U-1 catches | |
| Validate on mount, suppress the tray when empty | A rendering rule the tray carries forever plus a round-trip on every Builder open | |

**User's choice:** Validate on first edit, not on mount
**Notes:** Publish's disabled text on a never-edited draft is framed as an invitation ("Add a
step to get started"), not a claimed verdict — so D-182-06 is not breached.

### Q4 — Which session-edge debts does 184 pay down? (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| Unsaved-work leave guard | Dirty-state guard on the ← Workflows breadcrumb + `beforeunload` | ✓ |
| WR-09-01 edit-loss asymmetry | Commit the focused field before unmount on all three dismissal paths; WR-09-02 assertion on all three | ✓ |
| 409 conflict surfacing | Honest message on `WorkflowConflictError` instead of a generic error | ✓ |

**User's choice:** All three
**Notes:** All three get more expensive now that the canvas is a real authoring surface with no
autosave until Phase 186.

---

## Out-of-band question — R2's round-trip proof

Raised after the areas closed, because scouting surfaced a conflict between R2's acceptance
("all 95 corpus definitions") and the 183 fixture convention (hand-transcribed, no I/O, with an
acceptance guard that forbids live-read tokens).

| Option | Description | Selected |
|--------|-------------|----------|
| Committed corpus dump + generated shapes | One-off dump script → committed JSON with provenance; test reads the file (zero I/O at test time); plus a hand-rolled shape generator, no new dep | ✓ |
| Committed corpus dump only | Literal R2 satisfaction, but the corpus is 2-steps-modal with zero `skip_to_phase` — barely exercises the serializer | |
| Extend transcribed fixtures + generator | Strictly inside the 183 convention, but R2's "95 definitions" would need rewording in the SPEC | |

**User's choice:** Committed corpus dump + generated shapes
**Notes:** The distinction that decided it: 183's convention protects *snapshot* tests, where
more input means more golden output to maintain. Round-trip is a *property* with no golden
output, so a large corpus costs nothing.

---

## Claude's Discretion

- History depth cap (~50), store created per-Builder-mount rather than as a module singleton,
  `partialize` unnecessary as a nudge guard
- `definitionOps` also owning `patchPhaseConfig`; module file names and homes; Wave-0 plan
  decomposition (one plan or two)
- `＋` always visible under 1024 px / on touch, hover-revealed above; post-delete selection
  moves to the following step (preceding if last); the empty draft's named "Add your first
  step" invitation rather than a bare `＋`
- "checking…" beat minimum visible duration (~300 ms floor); problems tray does not auto-open
  on a new `error`; verdicts held stale and dimmed during an in-flight check rather than cleared
- Nudge `localStorage` keying (per user + draft id; unsaved drafts are session-memory only);
  "Tidy up" clears the current workflow's key only
- Tray / toolbar / publish composition within R12's one-region two-row rule
- All user-facing string wording, anchored to the sketch vocabulary

## Deferred Ideas

Recorded in full in `184-CONTEXT.md` `<deferred>`. Summary: autosave + co-edit guard (186);
authored `grounding_mode` + action-risk dial (185); live run state (188); `workflow_layouts` /
slot 114 (promotion trigger written); editable slug + rename cascade; a phase-type control in
the panel; SEED-131/132 envelope work; flipping Canvas to the default view (revisited — held
until 186 makes a canvas session lossless); the published-workflow read-only door (188);
`elkjs` (191); `visual_workflow_canvas` as a live incident kill switch (reload-gated by design).

Reported bugs reviewed and NOT folded: BUG-260609-02, BUG-260609-04 (trigger points at 188),
BUG-260718-02/-03/-04, BUG-260722-02, and the external BUG-260714-02.

# Phase 184: Editable Canvas + Live Structural Validation (Round-Trip) — Research

**Researched:** 2026-07-26
**Domain:** React 19 + `@xyflow/react` v12 editable canvas over a Pydantic-authoritative `WorkflowDefinition`; `zustand` + `zundo` undo history; debounced server-authoritative validation
**Confidence:** HIGH (every stack, API and codebase claim below was verified in this session against installed source, the npm registry, the upstream repos, or a run of the suite)

---

## Summary

Phase 184 has an unusually small unknown-surface: the decisions are locked, the endpoints are shipped, and the projection already exists. Almost all of the risk is in **five specific mechanical traps** that will silently break the phase's own acceptance gates if the plan does not name them up front.

**The five traps, in priority order.**

1. **`fromCanvas` cannot be an inverse of `toCanvas` from nodes alone.** `toCanvas` reads only 6 fields off a phase and discards everything else (prompt, tools, folder scope, skill refs, validator config, timing, retries…). A field-by-field reconstruction can *never* satisfy R2's deep-equality property. The only shape that passes is **carry-through by reference**, keyed off a source array. And even carry-through fails on two real inputs unless the plan says otherwise: `toCanvas` **sorts** (so the returned array order differs from an unsorted source) and `phase_index` gaps exist in the shipped `indexGap` fixture (so a `fromCanvas` that renumbers is not an identity).
2. **Three shipped source-grep guards will decide the architecture whether the plan likes it or not.** `WorkflowCanvas.test.tsx:426` forbids `workflows/validate` in `WorkflowCanvas.tsx`; `WorkflowBuilderPage.canvas.test.tsx:416` forbids `localStorage` in `WorkflowBuilderPage.tsx`; `canvasModel.purity.test.ts` forbids `fetch(`/`Date.now`/`Math.random` in `canvasModel.ts`. Each one, honoured, forces the *right* module boundary for free — and each one, ignored, is an "assertion had to change" failure of D-184-08's own gate.
3. **`PhaseFormPanel` is shared by BOTH views, so R11's rails are a D-14 hazard.** Replacing the shipped free-text `available_tools` comma box with a bundle-sourced chip picker changes what a **flag-off** user sees. The only D-14-safe shape is *optional props whose absence renders today's panel byte-for-byte*.
4. **D-184-07's icon swap unavoidably edits an assertion** (`soulData.test.ts:132-133` pins `"robot"` / `"busts-in-silhouette"` verbatim) and touches **two** maps, not one (`soulData.PHASE_GLYPHS` *and* `phaseGlyph.tsx`'s `PHASE_GLYPH_MARKS` + its imports + its "verified slugs" docblock line). D-184-08's zero-assertion-edit gate must be scoped to the *extraction* commits, with the icon commit explicitly carved out.
5. **`zundo`'s `handleSet` is a single global wrapper** — but its curried function receives `(pastState, replace, currentState, deltaState)`, so D-184-02's "structural immediate / config coalesced" *is* implementable by discriminating on `currentState`. `partialize` **is** required (not as a nudge guard, as a verdict/selection guard) or every `/validate` response would push an undo entry.

**Primary recommendation:** land Wave 0 as **three commits** — (0a) the icon swap, own commit, assertion edit expected and audited; (0b) `definitionOps.ts` + the per-mount `zundo` store, with `revertByteIdentical` + the 424-test per-file count table pinned; (0c) the `PhaseNodeCard` split, canvas snapshot byte-unchanged. Then build features against a **carry-through `fromCanvas(nodes, source)`** whose primary proof is *reference identity*, not deep-equality.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**The editing store + undo**

- **D-184-01: The working definition moves into ONE page-wide zustand store, wrapped in `zundo`'s `temporal` middleware.** Landed in Wave 0. `WorkflowBuilderPage`'s `useState<BuilderState>` (`:100`) stops being the home of `definition`.
  - **Undo/redo AFFORDANCES stay canvas-only and flag-gated** (toolbar + keys render only on the flagged canvas view), but the HISTORY is complete.
  - Rationale: `PhaseFormPanel` is shared by BOTH views, so a config edit made from the Spine flows through the same `onPhaseChange`. A canvas-scoped store would leave those edits outside the history that R4 says must contain config changes.
  - **D-14 holds** because byte-identity is defined OBSERVABLY (D-181-07), and `revertByteIdentical.test.tsx` still gates it. This is a state-home refactor, not a behaviour change — see D-184-08's gate.

- **D-184-02: Structural edits push a history entry immediately; config edits coalesce.** Add / insert / reorder / delete are discrete atomic acts and each is one undo. Config-field edits coalesce via `zundo`'s `handleSet` debounce (~500 ms of quiet, or field blur), so one typed sentence is one undo rather than forty.
  - **The cosmetic `dy` NEVER enters the tracked store at all.** R4's "a nudge adds no history entry" is therefore true *by construction*, not by a filter that could be misconfigured. `partialize` is not needed as a nudge guard.

- **D-184-03: Undo crosses the save boundary and re-marks the draft dirty.** History is session-long; a save is not a barrier. Stepping back past a save point makes the in-memory definition differ from what was PATCHed, so the surface honestly reads `dirty` again. **Undo never writes to the server** — an undo that auto-PATCHes is exactly the surprise R6 exists to prevent in a no-autosave phase.

- **D-184-04: One window `keydown` listener, mounted only while the flagged canvas view is active, that YIELDS to text fields.** It bails when `event.target` is an `input` / `textarea` / `contenteditable`, so native field-level undo still fixes a typo in a description. Follows the 183 Escape-listener precedent (`WorkflowBuilderPage.tsx:216` — window listener gated on state). Toolbar buttons remain the discoverable path. Bindings: `⌘Z` / `Ctrl+Z` (undo), `⇧⌘Z` / `Ctrl+Y` (redo).

**Wave 0 — the extraction boundary**

- **D-184-05: Two things leave `WorkflowBuilderPage.tsx`; persistence STAYS.**
  1. The definition state → the D-184-01 store.
  2. A pure **`definitionOps.ts`** — `addPhase` / `insertPhaseAt` / `movePhase` / `removePhase` / `renumber` / `patchPhaseConfig`, all `(phases, args) => phases`, zero React, zero store import.
  - The page keeps composition, the describe/compose flow, the flag gate, and **persistence** (`draftIdRef` / `creatingRef` / `onPersist:353` / `onSaveDraft:378`).
  - Rationale: pure ops make R1's contiguous-`phase_index` proof a plain unit test with no canvas and no store. Persistence is the one path that can corrupt a real row, and **Phase 186 rewrites exactly that seam for autosave** — extracting it now would be churn against a seam about to move.
  - `patchPhaseConfig` joins `definitionOps` so there is exactly ONE mutation home shared by both views.

- **D-184-06: `PhaseNode.tsx` splits into a pure card + a thin adapter.**
  - **`PhaseNodeCard`** — purely presentational, takes the slot contract (icon · title · subtitle · badges ≤2 · status · verdict), **zero `@xyflow` import**, so it renders in a plain test and Phase 188 can reuse it outside a `ReactFlowProvider`.
  - **`PhaseNode`** — a thin `NodeProps` → slots adapter.
  - **`nodePresentation.ts`** — `PHASE_TINTS`, `GROUNDING_TONES`, `renderPhaseMark()`.
  - **The badge slot is typed as a max-2 tuple**, so Phase 185 physically CANNOT add a third badge. The 137-D two-badge budget is enforced by the type system, not by a review comment.
  - This is sketch extensibility seam #1: 185 / 188 / 189 add **data, not layout**.

- **D-184-07: The two cross-cutting `PHASE_GLYPHS` swaps ship as their OWN atomic commit at the HEAD of Wave 0.** `llm_agent` → `compass`, `llm_batch_agents` → `handshake` (the luminance-34.5 outlier), with their own five-surface before/after check (workflows card, run + publish soul headers, gauntlet stages, live step cards).
  - This honours BOTH records: the sketch MANIFEST's "REQUIRED before 184 builds" (137-B makes the icon the sole carrier of step type) and D-183-14's independent-revert concern — whose actual subject is the **commit** boundary, not the phase boundary. A `git revert` of that one commit undoes the icon decision without touching the canvas.

- **D-184-08: Wave 0 passes an UNMODIFIED-ASSERTIONS gate before any feature code lands.**
  - The existing suite passes with **zero assertion edits**. Import-path-only changes are allowed and **every one is enumerated in the SUMMARY**.
  - Plus: per-file test **counts** pinned (not just failure counts), the canvas snapshot byte-unchanged, `tsc` error count not increased, `revertByteIdentical.test.tsx` green.
  - Rationale: an assertion that *has* to change means the extraction was not behaviour-preserving — that is the signal, not an inconvenience. Guards the two failure modes this project has already hit: WR-08-03 (untyped map silently reverts a fix with a green build) and the 177 lesson (a "net-new" test file replacing an existing suite is invisible to a failures-only differential).

**Edit gestures + delete safety**

- **D-184-09: Reorder has a pointer path and a keyboard path, one op behind both.**
  - Pointer: drag along the lane (R1's literal ask).
  - Keyboard: with a node selected, **`⌥←` / `⌥→`** move it one position, with a live-region announcement ("Step moved to position 2 of 5"). Alt-modified so it cannot collide with `@xyflow`'s own arrow-key node navigation or with panel field navigation.
  - Rationale: 183 made every node keyboard-activatable and shipped a real screen-reader pass; a drag-only reorder would regress that. At 5 steps max the keyboard path is genuinely competitive, not a grudging fallback.

- **D-184-10: One free drag; the AXES split the two meanings.** On drop, the **x**-component resolves to a lane slot (a definition edit — undoable, validates, marks dirty) and the card snaps to its computed lane x; the **y**-component is kept verbatim as the browser-local `dy` (no history, no network, never serialized). **No modifier to learn.**
  - The op that runs is decided by which component changed, so **a purely vertical drag can never enter the definition** — separation by construction, matching 138 C-local as drawn.

- **D-184-11: The `＋` opens a plain-language step-type picker; the slug is auto-generated and not user-editable.**
  - The picker lists the 6 step types in the D-183-06 plain-language sentences ("Search the knowledge base", "Wait for you", …) with the 3D mark, at the insertion point. A choice that would strand the deliverable renders **disabled with its reason inline** (R10b).
  - Choosing inserts a minimal valid phase there and opens `PhaseFormPanel` on it.
  - Slug = type-derived + uniqueness suffix (e.g. `search-2`). **Not editable in this phase**: it is the node identity (`node.id == phase.slug`) and a `skip_to_phase` target, so renaming needs a cascade nobody asked for. The plain-language title is what the user names.
  - Forced by the code: `PhaseFormPanel` conditions on `phase.config.phase_type` (`:431`) and offers no way to change it, so the type MUST be chosen at add time.

- **D-184-12: Delete is immediate, with Undo inline on the message U-2 already requires.** "Removed *Write a section* · 2 steps renumbered" carries an inline **Undo** action. **No confirm dialog** — undo is the safety net it was built to be, and a modal on the phase's most-used destructive act contradicts the sketch build rule that the gate must never become the thing that stops someone building.
  - The R10(a) orphaning case stays a **REFUSAL with a stated reason**, not a confirm. The two are different acts and must read differently.

**Live validation + session edges**

- **D-184-13: 500 ms debounce over ALL definition changes; last-write-wins is enforced twice.**
  - One 500 ms debounce covering structural AND config edits alike (the server has an opinion about both).
  - In-flight requests are **aborted** via `AbortController` on a new edit, **and** every response carries a monotonic **sequence number** with stale ones dropped.
  - Belt AND braces deliberately: abort is best-effort — a response already in the network buffer can still resolve, and R7's out-of-order test must pass on the guard, not on luck.

- **D-184-14: Every non-200 lands in the degraded state; the 422 gets its own honest line.**
  - Behaviour is uniform and fail-closed: marks go to **unknown, never clean**, and publish stays blocked.
  - Wording is NOT uniform: a **422** (SEED-132's `@model_validator` / `extra="forbid"` envelope bypass) says *"We couldn't check this — the workflow's shape isn't something we can read yet"*; a network failure/timeout says *"We couldn't reach the check."* Same behaviour, no lie about which thing went wrong — a user hitting a reproducible 422 must not be told to retry forever.
  - The 422 body is **logged, not shown** — leaking Pydantic `loc`/`msg` strings into a business-user surface is SEED-131's envelope work, not a client-side pretty-printer.

- **D-184-15: No `/validate` call fires until the user's first edit.**
  - A zero-step draft shows the "Add your first step" invitation with **no tray and no marks**. Publish is disabled with a plain invitation ("Add a step to get started") — an invitation, **not a claimed verdict**, so this is not client-side validation (D-182-06 intact).
  - The moment a step exists, the live loop takes over and **the server owns every verdict from then on** (VALID-03 unbroken).
  - Rationale: validate-on-mount would greet a brand-new workflow with `ok: false` + `no_terminal` and a problems tray — precisely the broken-screen read U-1 exists to catch.

- **D-184-16: 184 pays down all three session-edge debts.**
  1. **Unsaved-work leave guard** — a dirty-state guard on the `← Workflows` breadcrumb, plus `beforeunload` for tab close. Newly expensive: a session can now be five structural edits deep with no autosave until Phase 186. Sits inside R12's "one session, one way out".
  2. **WR-09-01 / WR-09-02** (carried from 183 as accepted debt, re-opened here because the panel becomes the primary authoring surface) — commit the focused field's pending value before unmount on ALL THREE dismissal paths (✕, Escape, pane-click), and put the "a dismissal must not PATCH a version" assertion on all three, not just ✕.
  3. **409 conflict** — `updateWorkflowDraft`'s typed `WorkflowConflictError` gets its own honest message ("This version is published and can't be edited — use Tweak to start a new draft") instead of a generic error.

- **D-184-17: R2's round-trip proof runs over a COMMITTED corpus dump plus a shape generator.**
  - A one-off script dumps the live definitions to a **committed JSON file** recording its provenance (date, row count, query). The test reads that FILE — **zero I/O at test time**, still hermetic, so 183's no-live-read property survives.
  - Plus a **hand-rolled shape generator** (no new dependency — `zundo` is the only net-new dep) exercising combinations the corpus does not contain: branch edges, gate-heavy phases, single-phase, deep chains.
  - **Why this does not violate the 183 fixture convention:** that convention protects *snapshot* tests, where more input means more golden output to maintain and drift. A round-trip test is a **property** (`fromCanvas(toCanvas(x))` deep-equals `x`) with **no golden output**, so a large corpus costs nothing to maintain and is pure coverage. `__fixtures__/canvasFixtures.ts` stays exactly as it is for the snapshot suite.
  - The corpus is 2-steps-modal and uses `skip_to_phase` **zero times**, so the dump alone would barely exercise the serializer — the generator is what actually earns R2.

### Claude's Discretion

- **Undo store:** history depth cap (~50 entries), store created per-Builder-mount rather than as a module singleton.
- **Wave 0:** module file names and homes; whether Wave 0 is one plan or two (ops+store / node split).
- **Gestures:** `＋` always visible under 1024 px and on touch, hover-revealed above it; after a delete, selection moves to the following step (or the preceding one if it was last); the empty draft gets a named "Add your first step" invitation per U-1, not a bare `＋`.
- **Validation feel:** the "checking…" beat carries a ~300 ms minimum visible duration so it cannot strobe; the problems tray does NOT auto-open on a new `error` (the summary line updates and the user opens it); verdicts are **held stale and dimmed** during an in-flight check rather than cleared — clearing makes marks flicker on every keystroke.
- **Nudge storage:** `localStorage`, keyed per user + draft id. A draft that has never been saved has no id, so its nudges live in memory for the session only and are not persisted — no orphan-key bucket to garbage-collect. "Tidy up" clears the current workflow's key only.
- **Tray / toolbar / publish composition** within R12's one-bottom-region, two-rows-max rule.
- Exact wording of all user-facing strings, anchored to the sketch vocabulary.

### Deferred Ideas (OUT OF SCOPE)

- **Autosave, the never-mint-a-version guarantee, and the co-edit clobber guard** — Phase 186 (CONCUR-01/02). 184 deliberately keeps the shipped explicit-save path so 186 remains a real phase with a real seam. D-184-05 leaves persistence on the page for exactly this reason.
- **Authored `grounding_mode` + the action-risk dial** — Phase 185. 184 must not invent that field; the gate rail is DERIVED here exactly as `groundingFor()` does today. D-184-06's slot contract and the max-2 badge tuple are the seam 185 lands on.
- **Live run state on nodes** — Phase 188. `PhaseNodeCard`'s `status` slot and its zero-`@xyflow` import exist so 188 can reuse the card outside a `ReactFlowProvider`.
- **`workflow_layouts` / migration slot 114** — RESERVED, not spent. **Promotion trigger:** a nudge must survive across devices, OR a layout is deliberately shared between editors. Neither is true today.
- **Editable slug / a rename cascade** — D-184-11 defers it; the slug is node identity and a `skip_to_phase` target.
- **A phase-type control inside `PhaseFormPanel`** — not needed once the type is chosen at add time (D-184-11). Re-open if a user needs to convert an existing step's type.
- **SEED-131 / SEED-132** — the `/validate` always-200 envelope seal (a top-level `degraded` marker or a third severity) and the `@model_validator` 422 bypass. D-184-14 is the client-side mitigation only; the honest fix is a backend envelope change in a later phase.
- **Flipping Canvas to the default view** — D-183-02 handed this to 184, but the canvas is brand-new and editable; leave Spine as the cold-start default until the editing surface has survived real use. Re-open when 186's autosave makes a canvas session lossless.
- **Persisting the Spine/Canvas view preference** — still session-only.
- **The published-workflow read-only canvas door** (D-183-04) — 184 does not need it; edits happen on drafts. Re-open at Phase 188.
- **`elkjs` / virtualization** — Phase 191, conditional.
- **`visual_workflow_canvas` as an INCIDENT kill switch** — flag propagation is reload-gated by design (`EffectiveFeaturesProvider` fetches once per session), so open tabs keep the canvas until they reload. Fine for a planned rollback; a decision only if it is ever needed as a live kill switch.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **CANVAS-02** | A user can add, move, connect, and delete phase-nodes; edits round-trip losslessly back to `WorkflowDefinition` (one client serializer) and save through the **existing** draft CRUD (create-once-then-PATCH). Node layout/positions are kept OUT of the immutable definition JSONB. | §*The `fromCanvas` inversion* (carry-through-by-reference is the ONLY shape that satisfies deep-equality); §*xyflow v12 editing APIs* (controlled `nodes` + `onNodesChange` is mandatory for a visible drag — verified in library source); §*Pitfall 3 / layout* (three existing guards already enforce no-position-in-definition); persistence is `createWorkflowDraft`/`updateWorkflowDraft` at `api.ts:3313`/`:3339`, unchanged |
| **CANVAS-03** | A user can configure a selected node in a side panel, backed by the existing `PhaseConfig` discriminated-union schema (Pydantic stays authoritative). | §*`PhaseFormPanel` is shared — the D-14 hazard* (optional-props shape); the 6-member `PhaseConfig` union is at `backend/app/models/harness.py:157`; the panel conditions on `phase.config.phase_type` at `:431` and its 19 tests are the regression net |
| **CANVAS-04** | Governance as visible rails — locked phase order, per-phase tool whitelists, validation gates the user cannot wire around. | §*`GET /workflows/grounding-bundle` contract* (exact `tools`/`folders`/`skills`/`template_placeholders`/`degraded` shape); §*the gate rail is derived* (`groundingFor()` at `phaseVocabulary.ts:223`, `deriveTier.ts`); the `friendlyToolName` label map at `PhaseFormPanel.tsx:387` is a LABEL map, not an options source — the R11 "no frontend constant" guard must be worded to allow it |
| **VALID-02** | Live structural validation as the canvas is built — the user cannot draw a structurally invalid flow. | §*`POST /workflows/validate` contract* (raw `WorkflowDefinition` body → always-200 `{ok, verdicts[]}`); §*the debounce + abort + sequence pattern* (React 19 / StrictMode-safe); §*the two cheap refusals are pure functions* (decidable from `phases[]` alone, no `/validate` call) |
| **VALID-03** | Per-node validation status derived from the server verdict, never a client-side guess. | §*`Verdict` shape* (`code`/`phase`/`message`/`severity`, `phase == node.id == phase.slug`); the server's `_severity` fails CLOSED on an unknown code (`workflows.py:468-506`), so the client must render every code it receives and classify none |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Structural edit ops (add / insert / move / remove / renumber / patch-config) | Browser / Client (pure module `definitionOps.ts`) | — | D-184-05: pure `(phases, args) => phases`; unit-testable with no React, no store, no canvas |
| Undo/redo history | Browser / Client (per-mount `zustand` + `zundo` store) | — | Session-scoped, never persisted, never sent to the server (D-184-03) |
| Canvas ↔ definition projection + inversion | Browser / Client (`canvasModel.ts`) | — | Already pure and guarded by `canvasModel.purity.test.ts`; `fromCanvas` inherits those guards |
| Structural validation rules (reachability / grounding / business-requirement / interactive-phase) | API / Backend (`POST /workflows/validate`) | — | D-182-06 red line: one lint copy. The client renders, never classifies |
| Verdict → node/tray presentation | Browser / Client | — | VALID-03: presentation only, keyed by `verdict.phase` |
| Tool / folder / skill palette | API / Backend (`GET /workflows/grounding-bundle`) | Browser (render + `degraded` message) | Pitfall 1: KB content can never whitelist itself |
| The two cheap shape refusals (orphaning delete, stranding add) | Browser / Client (pure predicate over `phases[]`) | — | R10: decidable from local shape; explicitly must NOT consult `/validate` |
| Cosmetic `dy` nudge | Browser / Client (`localStorage`, own module) | — | 138 C-local: zero server state, zero migration; slot 114 stays RESERVED |
| Draft persistence (create-once-then-PATCH) | Browser (`WorkflowBuilderPage`) → API (`POST /workflows`, `PATCH /workflows/{id}`) | — | Unchanged by this phase; Phase 186 rewrites this seam |
| Publish | API (`POST /workflows/{id}/publish`) | Browser (disabled state + first blocking reason) | The gauntlet is unchanged; 184 only gates its trigger |
| Database / Storage | — | — | **ZERO migration. No schema change. No cloud parity owed.** |

## Project Constraints (from CLAUDE.md)

Directives that bind this phase (the planner must verify compliance):

| Directive | Applies here as |
|---|---|
| Frontend is React + Vite + Tailwind + shadcn/ui, Aether Intelligence / Deep Midnight | All new chrome uses existing tokens; the locked card CSS is `.planning/sketches/themes/canvas-184.css` |
| Pydantic for structured outputs; **no LangChain / LangGraph** | `PhaseConfig`'s discriminated union stays authoritative; no client-side schema |
| Schema changes ship as numbered SQL migrations under `supabase/migrations/` | **Not exercised** — 184 adds zero migrations; slot 114 stays RESERVED |
| Settings live in `user_settings` / `app_settings`; env vars for secrets/infra only | Not exercised — the nudge is `localStorage`, not a setting |
| **G-1 phase-chain cap** (≥2 prior `<base>.x` on the same hot files) | Not fired — 184 is a base phase |
| **G-2 sketch before plan for UX** | **SATISFIED** — winners recorded 2026-07-26 (`65463724`): 137-B · 138 C-local · 139-A · 140-A · 141-B |
| **G-3 lightweight commands for small work** | Not applicable — 184 is the milestone's CORE deliverable |
| **G-4 lived-experience UAT gate** | **FIRES** — 5 operator-named rows U-1…U-5 in `184-SPEC.md`; Chrome MCP drives them at verification |
| **G-5 refactor between feature waves** | **FIRES** — `WorkflowBuilderPage.tsx` (3rd authoring door) + `PhaseNode.tsx` (2nd touch, 3rd in 185). Wave 0 is the answer and must land BEFORE feature code |
| **G-6 failure criteria upfront** | Satisfied by SPEC's 19 acceptance checks + 5 G-4 rows |
| **Reported-bugs cross-check at plan-phase** | CONTEXT recorded 7 open `surface: Agentic-RAG` reports, **zero folded into 184**. The planner must confirm no report carries `folded_into: 184` — none does |
| **Provider-docs-first** | Not exercised — authoring surface, no provider path, no SC#10 |
| **Deployment-artifact parity (same-commit rule)** | Not exercised — no env var, no seed migration, no bundled service, no `SANDBOX_IMAGE` change |
| **Never `supabase db push` / `db reset`** | Not exercised |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `zundo` | **2.3.0** (latest; published 2024-11-17) | The `temporal` undo/redo middleware for zustand | The ONE net-new dependency. Listed in **zustand's own official docs** (`pmndrs/zustand` → `docs/reference/integrations/third-party-libraries.md` — verified via GitHub code search). MIT, created 2021-04-02, ~336 k downloads/week, no `postinstall` script, `slopcheck` verdict `[OK]`. Peer range `zustand: ^4.3.0 \|\| ^5.0.0` — clean against the installed `zustand@5.0.13` [VERIFIED: npm registry] |
| `zustand` | **5.0.13** (already a direct dep, `frontend/package.json:49`) | The per-mount Builder store | Already installed; `zustand/traditional` (`useStoreWithEqualityFn`) is present in the installed package [VERIFIED: node_modules] |
| `@xyflow/react` | **12.11.2** (already installed, `package.json:33`) | The canvas plane, node types, drag lifecycle | Shipped in 183; no upgrade needed [VERIFIED: node_modules] |
| React | **19.2.4** | — | `package.json:39` [VERIFIED: node_modules] |

### Supporting (all already installed — nothing to add)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | 4.1.0 | Unit / component / property tests | Note: vitest 4 **removed the `basic` reporter** — use the default or `--reporter=json` [VERIFIED: ran it] |
| `@testing-library/react` | 16.3.2 | Component tests | `fireEvent` only on the canvas plane (see the jsdom landmine below) |
| `@iconify-json/fluent-emoji` | 1.2.7 | The 3D marks | `compass` and `handshake` both **PRESENT** in the installed icon set [VERIFIED: read `icons.json`] |
| `vitest-axe` | 0.1.0 | a11y assertions | Already wired in `setupTests.ts` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `zundo` | Hand-rolled snapshot stack in the store | ~60 lines, but you re-implement `limit` eviction, the future-clearing-on-new-state rule, `pause`/`resume` and the equality/diff hooks — and 185/186/188 inherit an untested substrate. `zundo` is already the ROADMAP's locked pick |
| `zundo` | `zustand/middleware` `persist` + manual history | Not an undo library; wrong tool |
| Debounce helper library (`use-debounce`, `lodash.debounce`) | — | **Do not add.** The constraint is one net-new dep. A `setTimeout` + `useRef` debounce is ~12 lines and the house already has the AbortController half (`usePanelReconcile.ts`) |
| Property-test library (`fast-check`) | — | **Do not add.** D-184-17 explicitly specifies a hand-rolled shape generator |

**Installation:**
```bash
cd frontend && npm install zundo
```

**Version verification performed this session:**
```bash
npm view zundo version            # 2.3.0
npm view zundo peerDependencies   # { zustand: '^4.3.0 || ^5.0.0' }
npm view zundo time.created       # 2021-04-02T01:24:47.816Z
npm view zundo license            # MIT
npm view zundo dist.unpackedSize  # 61105  (≈61 KB unpacked, 9 files; ~1–2 KB gzip in-bundle)
npm view zundo scripts            # build/dev/format/size — NO postinstall
curl -s https://api.npmjs.org/downloads/point/last-week/zundo   # 336,208
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `zundo` | npm | 5 yrs 4 mo (created 2021-04-02) | 336,208 / wk | `github.com/charkour/zundo` | **[OK]** | **Approved** |

**Packages removed due to slopcheck `[SLOP]` verdict:** none
**Packages flagged as suspicious `[SUS]`:** none

Verification chain, in full: (1) discovered from `.planning/research/STACK.md` and the ROADMAP; (2) **confirmed against an authoritative source** — `zundo` is listed in zustand's official docs (`pmndrs/zustand/docs/reference/integrations/third-party-libraries.md`); (3) `slopcheck install zundo` → `[OK]`, 1 OK / 0 flagged (the tool's own `npm install` subprocess then failed with a Windows `FileNotFoundError` — the *check* completed and nothing was installed, so the verdict stands and the tree is unchanged); (4) `npm view zundo scripts` shows **no `postinstall`**; (5) `git status frontend/package.json frontend/package-lock.json` is **clean** — nothing was installed during research.

---

## Architecture Patterns

### System Architecture Diagram

```
                        ┌─────────────────────────────────────────────┐
  keyboard  ⌘Z/⌥←/⌥→ ──▶│  window keydown listener                     │
  (D-184-04, canvas-only,│  bails on input/textarea/contenteditable    │
   flag-gated)           └───────────────┬─────────────────────────────┘
                                         │
  pointer: ＋ / ✕ / drag ────────────────┤
  panel field edit ──────────────────────┤
                                         ▼
                    ╔═══════════════════════════════════════════════════════╗
                    ║  BUILDER STORE  (per-mount, zustand + zundo.temporal) ║
                    ║  tracked slice (partialize):  phases[] + defMeta      ║
                    ║  untracked:  verdicts · checking · selection · dirty  ║
                    ╚═══════╤══════════════════════════════════╤════════════╝
                            │ actions call…                    │ store.temporal
                            ▼                                  ▼
                 ┌──────────────────────┐          ┌──────────────────────────┐
                 │ definitionOps.ts     │          │ pastStates / futureStates│
                 │ PURE (phases,args)   │          │ undo() · redo() · limit  │
                 │ →phases              │          │ (read via useStore(...)  │
                 │ add/insert/move/     │          │  — NEVER getState())     │
                 │ remove/renumber/     │          └──────────────────────────┘
                 │ patchPhaseConfig     │
                 └──────────┬───────────┘
                            │ phases[]
        ┌───────────────────┼───────────────────────────────┬──────────────────┐
        ▼                   ▼                               ▼                  ▼
 ┌─────────────┐   ┌──────────────────┐        ┌──────────────────────┐  ┌────────────┐
 │ toCanvas()  │   │ useLiveValidation│        │ PhaseFormPanel       │  │ onPersist  │
 │ PURE        │   │  500ms debounce  │        │ (SHARED by BOTH      │  │ create-    │
 │ nodes+edges │   │  + AbortController        │  views; rails props  │  │ once-then- │
 └──────┬──────┘   │  + monotonic seq │        │  OPTIONAL → absent = │  │ PATCH      │
        │          └────────┬─────────┘        │  today byte-for-byte)│  │ (UNCHANGED)│
        │ + dy (localStorage,│                  └──────────┬───────────┘  └─────┬──────┘
        │   own module)      │                             │                    │
        │ + selection        │ POST /workflows/validate    │ GET /workflows/    │ POST /workflows
        ▼                    │  (raw WorkflowDefinition)   │  grounding-bundle  │ PATCH /workflows/{id}
 ┌──────────────────┐        │                             │                    │
 │ <ReactFlow>      │        ▼                             ▼                    ▼
 │ controlled nodes │  ╔═══════════════════════════════════════════════════════════╗
 │ onNodesChange    │  ║  BACKEND — consumed EXACTLY as shipped, zero change       ║
 │ onNodeDragStop   │  ║  lint_workflow · grounding_verdicts ·                     ║
 │ onNodeClick      │  ║  business_requirement · _interactive_phase_failures       ║
 └────────┬─────────┘  ║  → always-200 {ok, verdicts[{code,phase,message,severity}]}║
          │            ╚═══════════════════════════════════════════════════════════╝
          ▼                             │
 ┌──────────────────┐                   │ verdicts keyed by verdict.phase == node.id == slug
 │ PhaseNode        │◀──────────────────┘   (phase: null → the tray, never a node)
 │  (adapter)       │
 │ └ PhaseNodeCard  │──▶ per-node mark (✕ error / ○ incomplete)
 │    zero @xyflow  │
 └──────────────────┘
          │
          ▼
 ┌──────────────────────────────────────────────────────┐
 │ ONE bottom region, two rows max (composition risk #1) │
 │  row 1: toolbar (undo/redo · save state)              │
 │  row 2: problems-tray summary → expands UPWARD        │
 └──────────────────────────────────────────────────────┘
          │  publish handoff (blocking reason)
          ▼
 ┌──────────────────────────────────────────────────────┐
 │ EXISTING Builder header (WorkflowBuilderPage.tsx:579) │
 │  name · draft chip · Save draft · renderPublish       │
 │   └ PublishGauntlet "◆ Publish…" trigger              │
 └──────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
frontend/src/
├── components/workflows/
│   ├── canvasModel.ts              # toCanvas (unchanged) + fromCanvas (NEW, pure)
│   ├── definitionOps.ts            # NEW — pure (phases, args) => phases  (D-184-05)
│   ├── builderStore.ts             # NEW — createBuilderStore() factory + temporal (D-184-01)
│   ├── BuilderStoreProvider.tsx    # NEW — per-mount store in a context (React 19 safe)
│   ├── canvasNudge.ts              # NEW — localStorage dy map  (MUST NOT live in the page)
│   ├── nodePresentation.ts         # NEW — PHASE_TINTS / GROUNDING_TONES / renderPhaseMark
│   ├── PhaseNodeCard.tsx           # NEW — zero @xyflow, slot contract, badges: max-2 tuple
│   ├── PhaseNode.tsx               # SHRINKS to a NodeProps → slots adapter
│   ├── WorkflowCanvas.tsx          # gains editing props; MUST NOT contain "workflows/validate"
│   ├── PhaseFormPanel.tsx          # extended IN PLACE via OPTIONAL props
│   ├── ProblemsTray.tsx            # NEW
│   ├── StepTypePicker.tsx          # NEW — the ＋ menu (D-184-11)
│   └── __fixtures__/
│       ├── canvasFixtures.ts       # UNTOUCHED (snapshot corpus + its acceptance guard)
│       └── corpusDump.json         # NEW — D-184-17 committed dump + provenance header
├── hooks/
│   └── useLiveValidation.ts        # NEW — debounce + abort + seq  (owns the fetch)
├── lib/
│   ├── api.ts                      # + validateWorkflow() + getGroundingBundle()
│   └── phaseGlyph.tsx              # icon swap (D-184-07 commit)
└── pages/
    └── WorkflowBuilderPage.tsx     # composition + flag gate + persistence ONLY
                                    # MUST NOT contain "localStorage"
scripts/
└── dump-workflow-corpus.(sh|py)    # NEW — one-off, run by a human, never at test time
```

### Pattern 1: `fromCanvas` as **carry-through by reference**, not reconstruction

**What:** `fromCanvas` takes the projection's nodes *and the source phases*, and returns the **identical `PhaseSpecJSON` objects** in node order. It reconstructs nothing.

**Why it is the only shape that can pass R2.** `toCanvas` reads exactly six things off a phase — `slug`, `phase_index`, `config.phase_type`, `name` (via `nodeTitle`/`technicalTitle`), `config.citation_policy` (via `groundingFor`), and `validators[].kind`/`.on_failure`. Everything else is **dropped and unrecoverable from the node**:

| Dropped by `toCanvas` | Where it lives |
|---|---|
| `config.prompt`, `config.model`, `config.temperature` | `LlmSingle/Agent/Batch/HumanInput/EmitPhaseConfig` |
| `config.available_tools`, `config.max_steps`, `config.wall_clock_seconds` | `LlmAgent` / `LlmBatchAgents` |
| `config.folder_scope`, `config.skill_ref`, `config.skill_snapshot` | 4 of the 6 config members |
| `config.fn`, `config.input_keys` | `Programmatic` |
| `config.options`, `config.timeout_seconds` | `LlmHumanInput` |
| `config.emitter`, `config.integrity_policy` | `LlmEmit` |
| `config.max_parallel_agents`, `config.merge_strategy` | `LlmBatchAgents` |
| `validators[].config`, `validators[].max_retries`, `validators[].timing` | `ValidatorSpec` |
| **All 15 workflow-level fields** (`slug`, `version`, `name`, `status`, `project_folder_id`, `output_target_folder`, `reingest_output`, `version_policy`, `provenance`, `inputs`, `assets`, `business_requirement`, `category`) | `WorkflowDefinition` — never passed to `toCanvas` at all |

Any field-by-field reconstruction re-materialises Pydantic defaults where the source had **absence**, and `toStrictEqual` distinguishes those. Carry-through makes the whole class of failure unrepresentable.

**Recommended signature:**
```ts
/**
 * The one client serializer (R2). PURE. Reads `node.id` and node ORDER only —
 * never `node.position`, never `node.data`. Every field the canvas does not model
 * survives because the SAME object is returned, not a copy.
 */
export function fromCanvas(
  nodes: readonly CanvasNode[],
  source: readonly PhaseSpecJSON[],
): PhaseSpecJSON[] {
  const bySlug = new Map(source.map((p) => [p.slug, p]))
  const out: PhaseSpecJSON[] = []
  for (const node of nodes) {
    if (node.type !== CANVAS_NODE_TYPES.phase) continue   // drops endCap + unresolvedSkip
    const phase = bySlug.get(node.id)
    if (phase !== undefined) out.push(phase)              // BY REFERENCE — no spread, no rebuild
  }
  return out
}
```

**The proof that earns R2** — reference identity is a strictly stronger claim than deep-equality and needs no deep compare:
```ts
const projected = toCanvas(phases)
const round = fromCanvas(projected.nodes, phases)
const expected = [...phases].sort(
  (a, b) => a.phase_index - b.phase_index || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0),
)
expect(round).toHaveLength(expected.length)
round.forEach((p, i) => expect(p).toBe(expected[i]))   // ← identity, not equality
expect(round).toStrictEqual(expected)                  // ← readable backstop
```

**The four deep-equality traps this shape defuses, and the one it does not:**

| # | Trap | Effect on a naive `fromCanvas` | Defused by carry-through? |
|---|---|---|---|
| 1 | **Key presence** — `PhaseSpecJSON.validators?` and `.name?` are OPTIONAL. `toCanvas` reads `phase.validators ?? []`. | A rebuild emits `validators: []` / `name: null` where the source had **no key**. `toStrictEqual` fails. | ✅ yes |
| 2 | **Key order** — irrelevant to `toEqual`/`toStrictEqual`, but fatal if anyone compares `JSON.stringify`. | Silent false failure. | ✅ yes (same object) — and **never assert via `JSON.stringify`** |
| 3 | **Config union members** — 6 discriminated shapes with 18 distinct optional fields. | A rebuild must switch on `phase_type` and enumerate all 18; one miss is silent data loss on save. | ✅ yes |
| 4 | **`toCanvas` SORTS** by `(phase_index, slug)` (`canvasModel.ts:221-223`). | The returned ARRAY ORDER differs from an unsorted source; array order **does** matter to `toStrictEqual`. | ⚠️ Not automatically — **the property must compare against the same total sort**, as above. State this in the test's docblock or it reads as a bug |
| 5 | **`phase_index` gaps and duplicates** — the shipped `indexGap` fixture is literally `[0, 1, 3]` (`canvasFixtures.ts:265-269`), and `toCanvas`'s own comment notes duplicate `phase_index` values are possible. | A `fromCanvas` that **renumbers contiguously** turns `[0,1,3]` into `[0,1,2]` and the identity property fails on a fixture already in the repo. | ⚠️ **Only if `fromCanvas` does not renumber.** See below |

**The load-bearing consequence: `fromCanvas` must NOT renumber.** R1's contiguous-`[0..n-1]` renumbering belongs to `definitionOps.renumber`, applied *after* a structural edit — exactly where D-184-05 put it, and exactly why D-184-05's rationale says the renumbering proof should be "a plain unit test with no canvas and no store". Keep `fromCanvas` a pure order/identity inverse and both R1 and R2 become provable independently.

**Two open sub-decisions for the planner** (neither is a blocker; both need a one-line ruling):
- **`edges` in the signature.** SPEC R2 writes `fromCanvas(nodes, edges)`. In this phase edges carry **zero authored information** — sequential edges are derived from `phase_index`, skip edges from `validators[].on_failure`, and both free wiring and `skip_to_phase` authoring are out of scope. Recommend either omitting `edges` or accepting it and adding a source-grep guard that `fromCanvas` never reads it, so a future phase cannot quietly start authoring topology from edges.
- **Duplicate slugs.** `PhaseSpec.slug` is an unconstrained `str` on the backend (`harness.py:190` — `canvasModel.ts:162` says so explicitly). A `Map` keyed by slug collapses duplicates and would silently DROP a phase on save. Recommend: `fromCanvas` detects `bySlug.size !== source.length` and returns `[...source]` untouched (fail-safe, never lossy), and the dump's provenance header records how many corpus rows carry duplicate slugs.

### Pattern 2: `zundo` `temporal` on a **per-mount** store

**What:** a store *factory* + React context, not a module singleton. Verified from the upstream source (`charkour/zundo` `src/index.ts`): `store.temporal = createStore(...)` is assigned **inside the config initializer**, so every `create()`/`createStore()` call gets its own independent temporal store. Per-mount is a supported shape.

```ts
// builderStore.ts
import { create } from "zustand"
import { temporal } from "zundo"
import type { TemporalState } from "zundo"

/** Only these keys are snapshotted. Everything else in the store is untracked. */
export interface TrackedSlice {
  phases: PhaseSpecJSON[]
  /** The discriminator handleSet reads to decide immediate-vs-coalesced (D-184-02). */
  lastEditKind: "structural" | "config"
  /** Monotonic — makes two identical-looking config edits distinguishable. */
  editSeq: number
}

export interface BuilderState extends TrackedSlice {
  // UNTRACKED — must never enter the undo stack
  verdicts: Verdict[]
  checking: boolean
  degraded: null | { kind: "422" | "network" }
  selectedSlug: string | null
  dirty: boolean
  // actions…
}

const HISTORY_LIMIT = 50   // Claude's discretion

export function createBuilderStore(initial: PhaseSpecJSON[]) {
  return create<BuilderState>()(
    temporal(
      (set, get) => ({ /* state + actions */ }),
      {
        // REQUIRED. Not as a nudge guard (the dy never enters the store at all) but
        // because EVERY set() on this store fires the temporal hook — a /validate
        // response landing in `verdicts` would otherwise push an undo entry.
        partialize: (s): TrackedSlice => ({
          phases: s.phases,
          lastEditKind: s.lastEditKind,
          editSeq: s.editSeq,
        }),
        limit: HISTORY_LIMIT,
        // Cheap early-out: identical phases reference ⇒ nothing to record.
        equality: (past, next) => past.phases === next.phases,
        handleSet: (push) => {
          let timer: ReturnType<typeof setTimeout> | null = null
          let pending: Parameters<typeof push> | null = null
          const flush = () => {
            if (timer) { clearTimeout(timer); timer = null }
            if (pending) { push(...pending); pending = null }
          }
          // zundo calls this with (pastState, replace, currentState, deltaState) —
          // VERIFIED in src/index.ts, the `curriedHandleSet(...)` call site.
          return ((pastState, replace, currentState, deltaState) => {
            const args = [pastState, replace, currentState, deltaState] as
              Parameters<typeof push>
            if ((currentState as TrackedSlice).lastEditKind === "structural") {
              flush()                       // commit any coalescing run first…
              push(...args)                 // …then record the atomic act immediately
              return
            }
            pending = args                  // config edit → coalesce
            if (timer) clearTimeout(timer)
            timer = setTimeout(flush, 500)
          }) as Parameters<typeof temporal>[1] extends never ? never : any
        },
      },
    ),
  )
}
export type BuilderStore = ReturnType<typeof createBuilderStore>
export type BuilderTemporal = TemporalState<TrackedSlice>
```

> **Note on the `handleSet` cast.** `ZundoOptions.handleSet` is declared as `(handleSet: StoreApi<TState>['setState']) => (pastState, replace, currentState, deltaState) => void` (`src/types.ts`) — the *returned* function's real 4-arg signature is typed, but the *argument* it wraps is typed as `setState`. That asymmetry means one narrow cast at this seam is unavoidable. Contain it in `builderStore.ts`, comment it against `zundo/src/index.ts`, and never let it leak.

**Reading temporal state in React — the React 19 landmine.**

`zundo` issue #207 (*"React 19 Compiler issue"*, closed) is exactly the trap this phase will hit with the undo/redo toolbar:

> Because you're using `getState()` within a React component, changes to `futureStates` and `pastStates` **never** would force a re-render. […] The React compiler is doing its job correctly, but you'll need to access `futureStates` and `pastStates` with a selector for the values to be reactive.

So the toolbar's disabled state **must** use a selector, never `store.temporal.getState()`:
```ts
// react-safe: re-renders when the history depth changes
const canUndo = useStore(store.temporal, (s) => s.pastStates.length > 0)
const canRedo = useStore(store.temporal, (s) => s.futureStates.length > 0)
// side-effect calls may use getState() — they are not rendered values
const { undo, redo } = store.temporal.getState()
```
`useStoreWithEqualityFn` from `zustand/traditional` (present in the installed 5.0.13) is only needed if a selector returns a *new object/array* each call; a `.length` selector does not need it. `useShallow` is likewise unnecessary here.

**Other verified `zundo` internals the plan should rely on:**

| Behaviour | Verified detail |
|---|---|
| `limit` | `if (limit && pastStates.length >= limit) pastStates.shift()` — evicts exactly ONE per push. A hard cap, not a window resize |
| new state clears redo | `_handleSet` sets `futureStates: []` on every push |
| `undo(steps)` / `redo(steps)` | **Mutate `pastStates` in place via `.splice`**, then `set({...})`. Selectors on `.length` still fire (the value changes); a selector returning the array itself may not |
| `pause()` / `resume()` | `isTracking` is consulted on every set. A viable escape hatch if a future op must not be recorded |
| `store.setState` | Also wrapped, so an out-of-action `setState` is tracked too |
| No manual `save()` API | Upstream issue #204 (closed): the maintainer's answer is `save: () => set({})`. Not needed here — `lastEditKind` + the `handleSet` flush covers it |

### Pattern 3: live `/validate` — debounce + abort + monotonic sequence (React 19 / StrictMode safe)

**The exact request/response contract** (read this session from `backend/app/api/workflows.py`):

```
POST /workflows/validate
  auth:  Depends(require_canvas())  — canvas flag gates the PATH (CanvasGateMiddleware,
         backend/app/middleware/canvas_gate.py:61-66). Flag OFF ⇒ 404, pre-auth.
  body:  a RAW WorkflowDefinition  (NOT a draft id) — so an UNSAVED draft validates
  →      ALWAYS HTTP 200: { "ok": bool, "verdicts": Verdict[] }
         ok == (verdicts.length === 0)
```
```ts
interface Verdict {
  code: string                 // free string on the wire; the server owns the vocabulary
  phase: string | null         // the phase SLUG == node.id, or null = workflow-wide
  message: string
  severity: "error" | "incomplete"
}
```
Codes the route can emit, by owner:
- `reachability.LINT_CODES` — `bad_index`, `input_unsatisfied`, `no_terminal`, `orphan_phase`, `unsatisfiable_skip`
- `grounding.GROUNDING_VERDICT_CODES` — `folder_scope`, `unregistered_tool`, `unregistered_skill`
- route-minted — `business_requirement` (always `phase: null`), `interactive_phase`
- degraded — `grounding_unavailable`, classified **`error`** by derivation

`no_terminal` is **dual-source**: `severity` is `incomplete` when `phases == []`, `error` otherwise (`workflows.py:470-472`). The client must not re-derive this — render `severity` verbatim.

The route's `_severity` **fails closed**: an unrecognised code classifies `error` and logs a warning (`workflows.py:497-506`). SPEC R8 mirrors that on the client: **every unrecognised code renders, as `error`, never dropped.**

**Non-200 cases the client must map to the degraded state (D-184-14):**

| Status | Cause | Wording (D-184-14) |
|---|---|---|
| **422** | `extra="forbid"` on `WorkflowDefinition`/`PhaseConfig`, or one of the two `@model_validator`s (`_folder_scope_requires_project`, `_skill_snapshot_requires_ref`) — these fire **before** the handler, bypassing the always-200 envelope (SEED-132) | *"We couldn't check this — the workflow's shape isn't something we can read yet."* Body **logged, not shown** |
| **404** | The canvas flag was turned off mid-session (`CanvasGateMiddleware` short-circuits, pre-auth) | Treat as network-class: *"We couldn't reach the check."* |
| **401** | Token expiry | network-class |
| network / timeout / abort-of-a-superseded-call | — | *"We couldn't reach the check."* — but an **abort caused by a newer edit is not an error**: drop it silently |

**The concrete React 19 pattern.** `useEffect` runs twice under StrictMode; the cleanup must make that harmless, and the sequence guard must survive it.

```ts
// hooks/useLiveValidation.ts — owns the ONLY fetch. Keeps "workflows/validate"
// out of WorkflowCanvas.tsx, which its own suite forbids (WorkflowCanvas.test.tsx:426).
export function useLiveValidation(def: WorkflowDefinitionJSON | null, enabled: boolean) {
  const [state, setState] = useState<ValidationState>({ kind: "idle" })
  const seqRef = useRef(0)          // monotonic; survives StrictMode remount of the effect
  const appliedRef = useRef(0)      // highest sequence already rendered

  useEffect(() => {
    if (!enabled || def === null) return          // D-184-15: no call before the first edit
    const seq = ++seqRef.current
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setState((s) => ({ ...s, checking: true, since: Date.now() }))
      validateWorkflow(def, controller.signal)
        .then((res) => {
          if (seq <= appliedRef.current) return   // BRACES: a buffered stale reply
          appliedRef.current = seq
          setState({ kind: "verdicts", ok: res.ok, verdicts: res.verdicts })
        })
        .catch((err) => {
          if (controller.signal.aborted) return   // superseded — not a failure
          if (seq <= appliedRef.current) return
          appliedRef.current = seq
          setState({ kind: "degraded", cause: classifyCause(err) })   // 422 vs network
        })
    }, 500)                                        // D-184-13

    return () => {
      clearTimeout(timer)     // an edit inside the window cancels the pending call outright
      controller.abort()      // BELT: an in-flight call is aborted
    }
  }, [def, enabled])

  return state
}
```

Why both guards, restated for the plan: `clearTimeout` handles the common case (edit before the debounce fires — **zero** requests issued), `abort` handles the in-flight case, and `appliedRef` handles the case abort cannot — a response already sitting in the network buffer when `abort()` is called still resolves. **R7's out-of-order test must pass on `appliedRef`, not on abort.**

**Testing out-of-order deterministically in vitest** — resolve two deferred promises in reverse:
```ts
vi.useFakeTimers()
const d1 = deferred<ValidateResponse>(), d2 = deferred<ValidateResponse>()
const validate = vi.fn().mockReturnValueOnce(d1.promise).mockReturnValueOnce(d2.promise)

rerender({ def: defA })
await vi.advanceTimersByTimeAsync(500)        // request seq=1 issued
rerender({ def: defB })
await vi.advanceTimersByTimeAsync(500)        // request seq=2 issued
d2.resolve(NEWER)                              // the NEWER reply lands first
await Promise.resolve()
d1.resolve(OLDER)                              // the OLDER reply lands second
await Promise.resolve()
expect(screen.getByTestId("problems-summary")).toHaveTextContent(NEWER_TEXT)
```
Notes: `advanceTimersByTimeAsync` (not the sync form) is required so the awaited microtasks flush; and **do not** combine `vi.useFakeTimers()` with `@testing-library/user-event` unless you pass `advanceTimers` — another reason `fireEvent` is the right tool on this surface.

### Pattern 4: `GET /workflows/grounding-bundle` — the CANVAS-04 palette

```
GET /workflows/grounding-bundle[?template_asset_id=<uuid>]
  auth: Depends(require_canvas()) — same path gate as /validate
  → 200 {
      tools: string[],                         // the tool-whitelist option set (R11)
      folders: [{ id: uuid, name: string, parent_id: uuid|null }],
      skills:  [{ id: uuid, name: string|null }],
      template_placeholders: string[],         // [] unless template_asset_id supplied
      degraded: string[]                       // sorted names of registries that FAILED
    }
```
`degraded` is the honesty field (Phase 182 WR-01 / round-3 CR-02). **`degraded: []` is the only value meaning "this palette is complete."** A blip renders `{folders: [], skills: []}` at HTTP 200 — byte-indistinguishable from an author who owns nothing — which is precisely why R11 says a degraded read must say so instead of rendering an empty-but-normal picker.

**R11's "no frontend constant" guard needs careful wording.** `PhaseFormPanel.tsx:387` already has `friendlyToolName(id)` — a **display-label** map (`search_documents → "Search documents"`) that falls back to the raw id. That is not an options source and must survive. Word the guard as *"the option SET is `bundle.tools`"* (assert the rendered options equal a mocked bundle response, and that changing the mock changes the options), **not** as a blanket source-grep for tool-name literals — which would false-positive on `friendlyToolName` and force a docblock to lie (the D-ITEM-183-02 trap, fired five times in 183).

### Pattern 5: `PhaseFormPanel` extension — optional props, absent = today

`PhaseFormPanel` is rendered **once**, by the page (`WorkflowBuilderPage.tsx:640-649`), and serves **both** views. Therefore any change to its rendered controls changes the **flag-off** surface. D-14 / D-181-01 forbid that.

```ts
export interface PhaseFormPanelProps {
  // …all 8 existing props UNCHANGED, incl. the REQUIRED onClose…

  /** CANVAS-04 rails. ABSENT ⇒ the panel renders exactly as it ships today. */
  rails?: {
    /** "Runs as step 2 of 5 — steps run in order, one after another." */
    order: { index: number; total: number }
    /** The bundle-sourced whitelist. `"degraded"` ⇒ say the list could not load. */
    toolOptions: string[] | "degraded"
    /** Derived exactly as groundingFor() does today — 184 invents no field. */
    gates: Array<{ label: string; locked: boolean }>
  }
}
```
The page supplies `rails` only when `canvasEnabled` is true. Consequences: flag-off is byte-identical **by construction**; the shipped `PhaseFormPanel.test.tsx` (19 tests) keeps passing unmodified because it renders without `rails`; and Phase 185's dials plug into `rails.gates` without another prop-shape argument.

**Distinguish a FIX from an AFFORDANCE.** D-184-16's WR-09-01/02 (commit the focused field before unmount on all three dismissal paths) is a **defect fix on the shipped Spine surface** and follows the D-183-09-01 precedent: applied in BOTH views, flag-independently. The tools picker and the rails are **new affordances** and are flag-gated. Do not conflate them.

### Pattern 6: `@xyflow/react` v12 editing — the controlled-flow contract

Verified by reading `node_modules/@xyflow/react/dist/esm/index.js` (`triggerNodeChanges`):
```js
triggerNodeChanges: (changes) => {
  const { onNodesChange, setNodes, nodes, hasDefaultNodes } = get();
  if (changes?.length) {
    if (hasDefaultNodes) { setNodes(applyNodeChanges(changes, nodes)); }
    onNodesChange?.(changes);
  }
}
```
`hasDefaultNodes` is `defaultNodes !== undefined` (`:3299`). Since 183 passes the **controlled** `nodes` prop, `hasDefaultNodes` is `false` — so **with no `onNodesChange`, changes are computed and then discarded.** A drag would not move the node at all.

| API | v12 semantics (verified) | Use in 184 |
|---|---|---|
| `nodes` + `onNodesChange` | Controlled. You must `applyNodeChanges(changes, nodes)` yourself | **Required** for a visible drag |
| `NodeChange` union | `dimensions` \| `position` \| `select` \| `remove` \| `add` \| `replace` (`@xyflow/system/types/changes.d.ts`) | Apply **`position`** only; ignore the rest (selection is owned by the page, removal by `definitionOps`) |
| `dimensions` changes | Measured into the library's internal `nodeLookup`; you do **not** have to apply them — proven empirically by 183, which paints edges correctly with no `onNodesChange` at all | Ignore |
| `onNodeDragStop` | `(event: MouseEvent \| TouchEvent, node: NodeType, nodes: NodeType[]) => void` (`types/nodes.d.ts`) | **The D-184-10 commit point.** `node.position` is the dropped position |
| `onNodeDragStart` / `onNodeDrag` | same signature | `onNodeDragStart` is the natural place to capture the origin for the axis comparison |
| per-node `draggable` / `selectable` / `focusable` | Node-object fields; `toCanvas` already sets `draggable: false` on every node (`canvasModel.ts:240`) and `selectable/focusable: false` on the cap + stub | Flip `draggable` to `true` for **phase** nodes only, in the view layer's node copy — never in the model |
| `nodesConnectable={false}`, `connectOnClick={false}`, `edgesReconnectable={false}`, `edgesFocusable={false}`, `deleteKeyCode={null}` | Already set in `WorkflowCanvas.tsx:303-308` | **Keep every one.** They are what makes "no free wiring" true rather than assumed |
| `<Controls showInteractive={false} />` | Already set; its absence is two clicks from re-enabling drag+connect | **Keep.** `WorkflowCanvas.test.tsx:417` pins it |

**The D-184-10 drag shape, concretely:**
1. Render nodes as `projection ∪ dy ∪ selection ∪ dragOverlay` — `dragOverlay: Record<string, XYPosition>` is local view state.
2. `onNodesChange` → apply only `type === "position"` changes into `dragOverlay` (so the card follows the cursor).
3. `onNodeDragStop(_, node)`:
   - `dx = node.position.x − laneX(currentColumn)`; if `|dx| ≥ PITCH_X/2`, resolve the target column and dispatch `definitionOps.movePhase` (undoable, validates, marks dirty). Otherwise no definition edit.
   - `dy = node.position.y − LANE_Y` → write to the `localStorage` nudge map. **No history, no network, never serialized.**
   - Clear `dragOverlay[node.id]`; positions re-derive from the projection.
4. Because step 3 branches on which component changed, **a purely vertical drag can never reach the definition** — D-184-10's "separation by construction".

Recommend extracting the axis decision as a pure function (`resolveDrop(origin, dropped, columns) => {reorderTo?: number, dy: number}`) so it is unit-testable without a browser. Drag itself is **not** testable in jsdom (see below).

### Pattern 7: the two cheap refusals are pure predicates

R10 explicitly forbids consulting `/validate` for either. Both are decidable from `phases[]`:
- **(a) orphaning delete** — removing phase at column *i* leaves a successor unreachable. Given `renumber` runs immediately after every delete, the honest predicate mirrors `reachability.py`'s adjacency: after the delete + renumber, does every phase still have a predecessor at `phase_index − 1`? On a contiguous spine, the only orphaning case is a delete that breaks contiguity — which the renumber then repairs. **The real orphaning case is a `skip_to_phase` target being deleted**, leaving an `unsatisfiable_skip`. Ground the predicate on `parseSkipTarget` (`phaseVocabulary.ts:94`), not on index arithmetic.
- **(b) stranding add** — inserting a step **after** the `llm_emit` deliverable strands it (the deliverable stops being terminal). The picker offers such a choice **disabled with the reason inline**.

Both live in `definitionOps.ts` as `canRemovePhase(phases, slug) => {ok} | {ok:false, reason}` and `allowedTypesAt(phases, index) => Array<{type, disabledReason?}>`, so they are plain unit tests.

### Anti-Patterns to Avoid

- **Reconstructing phases field-by-field in `fromCanvas`.** Guaranteed to fail R2 on optional-key presence; guaranteed to silently drop `skill_snapshot` / `validators[].timing` / `merge_strategy` on save. Carry-through or nothing.
- **Renumbering inside `fromCanvas`.** Breaks the identity property on the `indexGap` fixture already in the repo.
- **Comparing round-trip output with `JSON.stringify`.** Makes key order load-bearing for no reason. Use `toBe` per element + `toStrictEqual` as backstop.
- **`store.temporal.getState().pastStates` inside a component.** Non-reactive under React 19; upstream issue #207.
- **Omitting `partialize`.** Every `/validate` response would push an undo entry, and `⌘Z` would "undo" a server verdict.
- **Putting `fetch`/`workflows/validate` in `WorkflowCanvas.tsx`.** `WorkflowCanvas.test.tsx:426` fails. Own the fetch in `useLiveValidation.ts` / `api.ts`.
- **Putting `localStorage` in `WorkflowBuilderPage.tsx`.** `WorkflowBuilderPage.canvas.test.tsx:416-417` fails. Own the nudge in its own module.
- **Changing `PhaseFormPanel`'s rendered controls unconditionally.** Breaks D-14 for flag-off users and breaks 19 shipped assertions.
- **A client-side `severity` / `code` classifier.** VALID-03 + D-182-06. Render `verdict.severity` verbatim, including for codes the client has never seen.
- **`user-event` clicks inside the React Flow plane.** See the jsdom pitfall.
- **Adding a fixture to `canvasFixtures.ts` for the round-trip corpus.** D-184-17 and the file's own header put the dump in a separate artifact; `canvasFixtures.ts` stays untouched for the snapshot suite.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Undo/redo history | A bespoke snapshot stack in the store | `zundo@2.3.0` `temporal` | You would re-implement `limit` eviction, redo-clearing-on-new-state, `pause`/`resume`, and the equality/diff hooks — and 185/186/188 would inherit an untested substrate |
| Structural validation rules | Any `validate`-like function in `frontend/src/` | `POST /workflows/validate` | Pitfall 1 (governance fork) + D-182-06 red line. The server's `_severity` already fails closed on unknown codes |
| The tool / folder / skill option sets | A frontend constant list | `GET /workflows/grounding-bundle` | Pitfall 1: KB content can never whitelist itself. A degraded read must SAY so, not render an empty picker |
| Definition ⇄ canvas edge semantics | A fresh adjacency walk | `toCanvas`'s `byIndexValue.get(phase_index + 1)` lookup, mirroring `reachability.py:164` | A sorted-array walk draws a phantom `1→3` on the `indexGap` fixture — a picture that lies about what runs |
| Node layout persistence | A `workflow_layouts` table / a `position` key in the definition | `localStorage` `dy` map (138 C-local) | Pitfall 3: `extra="forbid"` 422s the save, and a cosmetic drag would re-arm the gauntlet. Slot 114 stays RESERVED |
| Applying drag positions to controlled nodes | Manual position math on the `nodes` array | `applyNodeChanges(changes, nodes)` from `@xyflow/react` | It is the library's own reducer for the six-member change union |
| jsdom canvas measurement | New mocks | `src/test-utils/mockReactFlow.ts` (`mockReactFlow()`) | Already ships the ResizeObserver / DOMMatrixReadOnly / offset getters / getBBox recipe, with the `contentRect` fix the published guide omits. **File-local, never `setupTests.ts`** |
| Draft persistence | A new endpoint | `createWorkflowDraft` (`api.ts:3313`) / `updateWorkflowDraft` (`:3339`) + the shipped `draftIdRef`/`creatingRef` create-once guard | R6 + the UNIQUE(slug, version) collision guard. Phase 186 rewrites this seam — do not churn it now |
| 409 handling | A status-code check | The typed `WorkflowConflictError` (`api.ts:3297`) | Already thrown; D-184-16 only gives it a message |
| Debounce | `lodash.debounce` / `use-debounce` | `setTimeout` + `useRef` in `useLiveValidation` | One net-new dep is the constraint; the house AbortController half already exists in `usePanelReconcile.ts` |

**Key insight:** every "should we build X?" question in this phase already has a shipped answer somewhere in the repo — the risk is not missing capability, it is *re-authoring* capability and creating the second copy that drifts. Three shipped source-grep guards are there precisely to catch that, and they should be treated as design input rather than obstacles.

---

## Runtime State Inventory

> Phase 184 is a **greenfield-feature** phase on an existing surface, not a rename/refactor/migration. It nonetheless has a Wave 0 **extraction**, so the inventory is completed for completeness rather than omitted.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | **None.** No migration, no new column, no new table. The only net-new persisted state is a **browser** `localStorage` key (the cosmetic `dy` map). Verified: `workflow_definitions` has no layout column, and `WorkflowDefinition` is `extra="forbid"` (`harness.py:27-30, 221`) | none (server); one new `localStorage` key namespace (client) |
| **Live service config** | **None.** No n8n workflow, no Datadog service name, no Tailscale tag, no Cloudflare tunnel touched. The `visual_workflow_canvas` flag row already exists (Phase 181) and is unchanged | none |
| **OS-registered state** | **None** — verified: no Task Scheduler / pm2 / systemd artifact references the canvas | none |
| **Secrets / env vars** | **None** — no new env var, no `SECRETS_ENCRYPTION_KEY` interaction, no deploy-artifact parity owed (`deploy/onebox.env.example` / `docs/OPERATOR.md` / `docker-compose.prod.yml` / `SANDBOX_IMAGE` all untouched) | none |
| **Build artifacts / installed packages** | `frontend/package.json` + `package-lock.json` gain `zundo`. `node_modules` needs `npm install` on every dev machine and in CI. **Verified clean at research time** — `git status frontend/package.json frontend/package-lock.json` shows no change; nothing was installed during research | `npm install` after the dependency commit |
| **Wave 0 extraction residue** (the real one) | The D-184-07 icon swap touches **5 files, not 1**: `soulData.ts:38-39`, `soulData.test.ts:132-133` (**asserts the slugs verbatim**), `phaseGlyph.tsx:20` (the "verified slugs" docblock line), `phaseGlyph.tsx:30-31` (the `~icons/fluent-emoji/...` imports), `phaseGlyph.tsx:49-50` (`PHASE_GLYPH_MARKS`). A swap of `soulData.PHASE_GLYPHS` alone would leave `phaseGlyph()` returning the OLD 3D component while the string fallback changed — a silent split-brain | swap **both** maps + both imports + the docblock + the test assertion, in the ONE D-184-07 commit |

**Anti-drift verification performed** (per CONTEXT `<code_context>` note 3 — *treat in-code claims of prior extraction as unverified*):
- `phaseVocabulary.ts`'s header claims plan 183-04 performed the hard cut on `PhaseSpineGraph.tsx`. **Verified true**: `grep -rn "robot|busts-in-silhouette"` across `frontend/src` returns exactly 5 hits, all in `soulData.*` and `phaseGlyph.tsx` — **no** duplicate glyph map survives in `PhaseSpineGraph.tsx`. The claim is honest.
- The SPEC's "95 definitions / 40 zero-phase" numbers **could not be re-verified** — the local Supabase is not running (`127.0.0.1:54322` → connection refused). Consistent with CONTEXT note 1; treat as narrative, never as an assertion.

---

## Common Pitfalls

### Pitfall 1: `WorkflowCanvas.test.tsx:426` forbids the string `workflows/validate` in `WorkflowCanvas.tsx`

**What goes wrong:** the obvious implementation puts the debounced validate call inside the canvas component. The shipped 183 scope-fence fails, and — worse — the "fix" is to edit the assertion, which is exactly the D-184-08 signal that something went wrong.
**Why it happens:** the verdicts are *rendered* on the canvas, so the fetch feels like it belongs there.
**How to avoid:** own the fetch in `lib/api.ts` (`validateWorkflow`) + `hooks/useLiveValidation.ts`; the canvas receives `verdicts` as a prop. The guard then stays green **and** the architecture is better — Phase 188 can reuse the same hook shape.
**Warning signs:** a diff that touches `WorkflowCanvas.test.tsx:425-428`.

### Pitfall 2: `WorkflowBuilderPage.canvas.test.tsx:416-417` forbids `localStorage` in `WorkflowBuilderPage.tsx`

**What goes wrong:** the nudge map is per-user + per-draft, both of which the page knows, so it lands in the page. The D-183-02 "persists no view preference" guard fails.
**How to avoid:** `canvasNudge.ts` owns all storage access; the page passes `draftId` in. This also keeps the nudge testable without rendering the page.
**Warning signs:** any `localStorage` / `sessionStorage` token appearing in the page source.

### Pitfall 3: D-184-07's icon swap **must** edit an assertion — and D-184-08 says Wave 0 must not

**What goes wrong:** `soulData.test.ts:132-133` pins `llm_agent: "robot"` and `llm_batch_agents: "busts-in-silhouette"` verbatim. The swap cannot land without editing them. If D-184-08's gate is applied to the whole of Wave 0 uniformly, the gate either blocks the swap or is quietly relaxed.
**How to avoid:** scope D-184-08's zero-assertion-edit rule to the **extraction** commits (0b, 0c). The icon commit (0a) is a deliberate behaviour change with its own five-surface before/after check and its own revert story; its assertion edit is expected and enumerated. Say this in the plan so the verifier does not read it as a violation.
**Warning signs:** a plan task that folds the icon swap into the extraction commit.

### Pitfall 4: the round-trip property fails on the fixtures already in the repo

**What goes wrong:** two shipped fixtures break a naive `fromCanvas` on day one — `indexGap` (`[0, 1, 3]`, `canvasFixtures.ts:265`) if it renumbers, and any unsorted source array if the test compares against the raw source rather than the sorted one (`toCanvas` sorts at `canvasModel.ts:221`).
**How to avoid:** `fromCanvas` never renumbers; the property compares against `[...phases].sort(sameComparator)`; the primary assertion is `toBe` per element.
**Warning signs:** a test that passes only on the 2-step fixtures.

### Pitfall 5: `user-event` clicks inside the React Flow plane crash jsdom

**What goes wrong** (recorded verbatim in `WorkflowCanvas.test.tsx:120-130`): a `user-event` click inside the plane dispatches a real `mousedown`, which reaches **d3-zoom**'s pan handler; **d3-drag** then dereferences `event.view.document`, and jsdom's synthetic `MouseEvent` carries a null `view`. The error surfaces from a timer *after* the assertions pass — vitest reports "N passed" and still **exits 1**.
**How to avoid:** drive canvas interactions with `fireEvent.click` / `fireEvent.keyDown`. `user-event` is fine for controls **outside** the plane (the toolbar, the panel, the tray). Corollary: **drag is not testable in jsdom at all** — test `resolveDrop(...)` as a pure function and invoke `onNodeDragStop` directly on the component's prop where a component-level assertion is genuinely needed.
**Warning signs:** a green vitest summary with a non-zero exit code.

### Pitfall 6: `PhaseFormPanel` changes leak to flag-off users

**What goes wrong:** the panel is a single instance shared by both views (`WorkflowBuilderPage.tsx:640`). Replacing the free-text `available_tools` comma box (`PhaseFormPanel.tsx:336-380, 570, 621`) with a chip picker changes what a flag-off user sees — a D-14 / D-181-01 violation that `revertByteIdentical.test.tsx` (nav-set parity + the Off|On control) does **not** catch, because it does not render the panel.
**How to avoid:** optional `rails` prop; absent ⇒ today's render. Add an explicit assertion: *"rendered without `rails`, the panel's DOM is unchanged from the shipped snapshot."*
**Warning signs:** any of the 19 `PhaseFormPanel.test.tsx` assertions needing an edit.

### Pitfall 7: `zundo`'s temporal state read via `getState()` in a component

**What goes wrong:** the undo/redo toolbar buttons never re-enable. Upstream issue #207, closed as "working as intended" — `getState()` is a snapshot, not a subscription, and React 19's compiler correctly declines to re-render.
**How to avoid:** `useStore(store.temporal, s => s.pastStates.length > 0)`.
**Warning signs:** the toolbar looks right on first render and never updates.

### Pitfall 8: missing `partialize` puts server verdicts in the undo stack

**What goes wrong:** `zundo` fires its hook on **every** `set()` (verified in `src/index.ts` — both `store.setState` and the action `set` are wrapped). With verdicts, `checking`, and selection in the same store, an arriving `/validate` response pushes a history entry and `⌘Z` "undoes" a server verdict.
**How to avoid:** `partialize` narrows to `{ phases, lastEditKind, editSeq }`. SPEC R4's acceptance says exactly this: *"the undo stack is snapshots of the definition slice only."*
**Warning signs:** `pastStates.length` grows while the user is idle.

### Pitfall 9: publish's blocking reason has no home yet

**What goes wrong:** R12 requires the disabled Publish control to name the first blocking reason. The trigger lives in `PublishGauntlet` (`◆ Publish…`, `PublishGauntlet.tsx:731-738`), mounted by `WorkflowBuilderPage` via the `renderPublish` prop, which is itself supplied by `WorkflowsPage.tsx:335`. Three components deep, and `PublishGauntlet` has no notion of a verdict.
**How to avoid:** an optional `blockedReason?: string | null` prop on `PublishGauntlet` (absent ⇒ today's behaviour), threaded from the store through `renderPublish`. D-14-safe by the same optional-prop rule as the panel.

### Pitfall 10: the leave guard spans two components

**What goes wrong:** the `← Workflows` breadcrumb is in **`WorkflowsPage.tsx:311-318`** (`backToLibrary`), not in the Builder. The dirty state is in the Builder's store. A guard written inside the Builder cannot intercept it.
**How to avoid:** either lift the guard to `WorkflowsPage` via a callback the Builder registers, or have `backToLibrary` consult the store through the same context. `beforeunload` is Builder-local and unaffected. Note: **there is no router**, so no router blocker is available (CONTEXT `<code_context>` confirms).

### Pitfall 11: vitest 4 removed the `basic` reporter

**What goes wrong:** `--reporter=basic` → `Failed to load custom Reporter from basic` (reproduced this session).
**How to avoid:** use the default reporter, or `--reporter=json --outputFile=...` for the D-184-08 count table.

---

## Code Examples

### Verified: current `/validate` verdict classification (do not re-implement client-side)

```python
# backend/app/api/workflows.py:468-506 — the route's ONLY interpretive step
def _severity(code: str, *, phases_empty: bool) -> str:
    if code in _DUAL_SOURCE_CODES:                       # {"no_terminal"}
        return "incomplete" if phases_empty else "error"
    if code in _INCOMPLETE_CODES:                        # input_unsatisfied / business_requirement / interactive_phase
        return "incomplete"
    if code in _ERROR_CODES:                             # DERIVED: _KNOWN - _INCOMPLETE - _DUAL_SOURCE
        return "error"
    logger.warning("... unrecognised verdict code %r — classifying it as 'error' (fail-closed)", code)
    return "error"
```

### Verified: `zundo`'s `handleSet` call site (why D-184-02 is implementable)

```ts
// charkour/zundo src/index.ts — the curried handleSet receives FOUR arguments
curriedHandleSet(
  pastState,
  undefined as unknown as Parameters<typeof set>[1],
  currentState,      // ← the partialized CURRENT state: the discriminator D-184-02 needs
  deltaState,
);
```

### Verified: `zundo`'s `limit` eviction (one entry per push, `>=` boundary)

```ts
// charkour/zundo src/temporal.ts — _handleSet
_handleSet: (pastState, replace, currentState, deltaState) => {
  if (options?.limit && get().pastStates.length >= options?.limit) {
    get().pastStates.shift();
  }
  get()._onSave?.(pastState, currentState);
  set({ pastStates: get().pastStates.concat(deltaState || pastState), futureStates: [] });
},
```

### Verified: the projection's edge rule `fromCanvas` must not contradict

```ts
// frontend/src/components/workflows/canvasModel.ts:255-266
const successor = byIndexValue.get(phase.phase_index + 1)   // LOOKUP, never array adjacency
if (successor !== undefined && successor.slug !== phase.slug) {
  pushEdge({ id: `seq:${phase.slug}->${successor.slug}`, source: phase.slug,
             target: successor.slug, data: { kind: CANVAS_EDGE_KINDS.flow } })
}
```

### Verified: the shipped read-only opt-outs `WorkflowCanvas` must keep

```tsx
// frontend/src/components/workflows/WorkflowCanvas.tsx:302-314
nodesDraggable={false}      // ← 184 flips THIS ONE (per-node, phase nodes only)
nodesConnectable={false}    // ← KEEP: free wiring is out of scope
edgesReconnectable={false}  // ← KEEP
connectOnClick={false}      // ← KEEP
edgesFocusable={false}      // ← KEEP
deleteKeyCode={null}        // ← KEEP: ✕ is the delete affordance, not Backspace
zoomOnDoubleClick={false}
```

### The D-184-17 dump artifact — recommended shape

```jsonc
// frontend/src/components/workflows/__fixtures__/corpusDump.json
{
  "_provenance": {
    "dumped_at": "2026-07-2X",
    "source": "local Supabase (127.0.0.1:54322), table public.workflow_definitions",
    "query": "select id, slug, version, status, definition->'phases' as phases from workflow_definitions order by created_at",
    "row_count": 0,
    "rows_with_zero_phases": 0,
    "rows_with_duplicate_slugs": 0,
    "rows_with_index_gaps": 0,
    "max_phase_count": 0,
    "skip_to_phase_uses": 0,
    "note": "PHASES ONLY. No prompts, no folder ids, no skill snapshots, no org_id, no user_id, no created_by. Regenerate with scripts/dump-workflow-corpus.sh; never read live at test time."
  },
  "definitions": [ { "id": "…", "slug": "…", "phases": [ /* PhaseSpecJSON[] */ ] } ]
}
```
```ts
// the property suite — zero I/O at test time (a JSON import, resolved at build)
import corpus from "./__fixtures__/corpusDump.json"
import { generatedShapes } from "./__fixtures__/shapeGenerator"

describe.each([
  ...corpus.definitions.map((d) => ({ name: `corpus:${d.slug}`, phases: d.phases })),
  ...generatedShapes(),        // branch edges · gate-heavy · single-phase · deep chains
])("round-trip — $name", ({ phases }) => { /* toBe per element + toStrictEqual */ })
```

**Three rules the dump must follow, and why:**
1. **Phases only, plus identity.** The dump is committed source. `folder_scope` UUIDs, `skill_ref` UUIDs and `skill_snapshot.storage_prefix` values are tenant-identifying; `prompt` bodies are user content. Redact everything the round-trip does not need — and the round-trip needs the *shape*, which redaction preserves if you replace string values with placeholders of the same key set. **Simplest safe rule: keep every key, replace every free-text string value with `"…"` and every UUID with a stable synthetic UUID.** Key presence is what the property tests; the values are not.
2. **A separate artifact, in a separate file, never `canvasFixtures.ts`.** That file's header records a *transcribed-never-read-live* rule and a path convention chosen specifically because "the acceptance guard for this file forbids the local-stack tokens that would indicate a live read". The dump's provenance block would contain exactly such a token. Keep them apart — CONTEXT note 2 says the same.
3. **The generator carries the coverage, not the dump.** The corpus is 2-steps-modal with `skip_to_phase` used zero times. Generate: branch edges (a `skip_to_phase` that resolves), an unresolvable skip, gate-heavy phases (multiple `validators` with `config`/`timing`/`max_retries` set), single-phase, a 12-deep chain, an index gap, a duplicate `phase_index`, and one phase per config-union member with **every** optional field populated (the field-drop proof).

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| React Flow v11 (`reactflow` package) | `@xyflow/react` v12 | v12, 2024 | `WorkflowBuilderPage.canvas.test.tsx:426` pins that the frozen v11 name never appears |
| v11: you applied `dimensions` changes yourself | v12: measured dimensions live in the internal `nodeLookup` | v12 | Apply **only** `position` changes in `onNodesChange` |
| `zustand` v4 `create(...)` | v5 `create<T>()(...)` curried form + `zustand/traditional` for equality-fn hooks | zustand v5 | `zundo@2.3.0` supports both (peer `^4.3.0 \|\| ^5.0.0`) |
| `zundo` v1 `coolOffPeriod` option | v2 `handleSet` wrapper | v2.0.0 | Debounce/throttle is caller-supplied; there is no built-in cool-off (upstream issue #209 is open about debouncing the *equality* fn too — not needed here) |
| vitest `--reporter=basic` | removed | vitest 4 | Use default or `--reporter=json` |

**Deprecated/outdated:**
- `reactflow` (v11 package name) — never reference it; a shipped guard fails.
- `zundo` `2.0.0-beta.*` / `2.0.0-experimental.0` dist-tags — `latest` is `2.3.0`; do not pin a pre-release.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The live corpus is still ~2-steps-modal with `skip_to_phase` used zero times | Pattern 1, dump rules | LOW — D-184-17's design already makes the dump self-describing and the generator carries coverage. Explicitly flagged as drifting by CONTEXT note 1; the local DB was **unreachable** this session so no re-verification was possible |
| A2 | The dump can be redacted key-preserving without weakening the round-trip property | Code Examples, dump rules | LOW — the property tests key presence and object identity, not values. But an operator should sanity-check the first dump before it is committed |
| A3 | `zundo`'s `handleSet` selective-flush pattern (Pattern 2) works as written | Pattern 2 | MEDIUM — the *call signature* is verified from upstream source, but the debounce-with-flush composition is **not** copied from a shipped example. Prove it with a small unit test on the store (structural push ⇒ `pastStates.length` +1 synchronously; two config edits within 500 ms ⇒ +1 after the timer) before building the toolbar on it |
| A4 | The orphaning-delete predicate is best grounded on `skip_to_phase` targets rather than index arithmetic | Pattern 7 | LOW — with `renumber` running immediately after delete, index-contiguity self-heals; the genuine orphan is a dangling skip target. If the operator meant something else by "orphan its successor", the predicate changes but the architecture does not |
| A5 | Threading `blockedReason` through `renderPublish` is acceptable rather than restructuring the publish mount | Pitfall 9 | LOW — additive optional prop; the alternative (moving the mount) would touch `WorkflowsPage.tsx`, a file this phase otherwise leaves alone |
| A6 | `~1–2 KB gzip` for `zundo` in the bundle | Standard Stack | LOW — `dist.unpackedSize` is 61,105 bytes across 9 files (ESM + CJS + maps + types); the shipped ESM entry is a small fraction. The exact figure was not measured |

---

## Open Questions (RESOLVED)

> All 5 questions were resolved during planning (2026-07-26) by adopting the recommendation
> below each. The adopting plan is named inline. No question remains open at execution time.

1. **Does `fromCanvas` take `edges`?** — **RESOLVED: recommendation adopted → plan `184-05` Task 1**
   (signature omits `edges`; a `canvasModel.purity.test.ts` guard asserts the source never reads one).
   - What we know: SPEC R2 writes `fromCanvas(nodes, edges)`. Free wiring and `skip_to_phase` authoring are both out of scope, so edges carry no authored information in this phase.
   - What's unclear: whether the signature should keep an unused parameter for forward-compatibility.
   - Recommendation: **omit `edges`**, and add a `canvasModel.purity.test.ts` guard that `fromCanvas`'s source never reads an edge. A future phase that wants edge-authored topology then has to make that argument explicitly.

2. **Is R2's property over `WorkflowDefinition` or over `phases[]`?** — **RESOLVED: recommendation
   adopted → plan `184-05` Task 3** (property over `phases[]`, plus the cheaper payload-level
   assertion that also discharges R3).
   - What we know: `toCanvas` takes `phases` only; the 13 workflow-level fields never reach the canvas.
   - What's unclear: the acceptance wording says `fromCanvas(toCanvas(def))` deep-equals `def`.
   - Recommendation: state in the plan that the property is over **`phases[]`**, and add a **second, cheaper** assertion covering the workflow level: *the serialized `createWorkflowDraft`/`updateWorkflowDraft` body deep-equals the loaded definition with only `phases` differing* — which also discharges R3's "no positional field appears in any draft payload".

3. **Duplicate slugs in the live corpus.** — **RESOLVED: recommendation adopted → plan `184-05`
   Task 1** (`fromCanvas` fails SAFE on a slug collision — returns the source untouched, never
   silently drops a phase).
   - What we know: `PhaseSpec.slug` is an unconstrained `str`; `canvasModel.ts:161-163` explicitly warns a slug can even spell a reserved canvas id.
   - What's unclear: whether any live row has duplicate slugs (DB unreachable).
   - Recommendation: `fromCanvas` fails **safe** (returns the source untouched) on a slug collision; the dump's provenance records the count. Never silently drop a phase.

4. **Where does the `dirty` flag live for the leave guard?** — **RESOLVED: recommendation adopted
   → plan `184-11` Task 3** (the Builder registers a `canLeave()` callback with `WorkflowsPage`;
   no router, no context lift).
   - What we know: the breadcrumb is in `WorkflowsPage`, the dirty state in the Builder store, and there is no router.
   - Recommendation: expose the store via context above both, or have the Builder register a `canLeave()` callback with `WorkflowsPage`. Either way, name it in the plan — it is the one genuinely cross-component seam in the phase.

5. **Does the icon-swap commit need its own vitest snapshot refresh?** — **RESOLVED:
   recommendation adopted → plan `184-01` Task 2** (verified empirically via an explicit
   snapshot-diff acceptance criterion; a moved snapshot is treated as a signal the extraction
   boundary is wrong, never blessed).
   - What we know: `soulData.test.ts:132-133` asserts the slugs; `canvasModel.fixtures.test.ts.snap` (1,558 lines) records node data — but `PHASE_GLYPHS` is *not* in `PhaseNodeData`, so the canvas snapshot should be unaffected.
   - Recommendation: verify empirically in the 0a commit; if the snapshot does move, that is a signal the extraction boundary is wrong, not a snapshot to bless.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node + npm | frontend build, vitest, `npm install zundo` | ✓ | npm resolves `zundo@2.3.0` | — |
| `zundo` on the npm registry | R4 undo/redo | ✓ | 2.3.0, MIT, `[OK]` | — |
| `@iconify-json/fluent-emoji` slugs `compass` + `handshake` | D-184-07 | ✓ | both **PRESENT** in the installed 1.2.7 (3,174 icons) | — |
| `zustand/traditional` (`useStoreWithEqualityFn`) | reactive temporal reads with a custom equality fn | ✓ | present in installed `zustand@5.0.13` | plain `useStore` (sufficient for `.length` selectors) |
| `tsc -b` | D-184-08 differential gate | ✓ | `typescript ~5.9.3` — **33 pre-existing `error TS` lines on `develop`**, re-measured this session (matches D-ITEM-183-01) | — |
| vitest | all suites | ✓ | 4.1.0 — **424 tests / 16 files green** across the Wave-0 blast radius, measured this session | — |
| `mockReactFlow()` | any canvas component test | ✓ | `frontend/src/test-utils/mockReactFlow.ts` | — |
| **Local Supabase (`127.0.0.1:54322`)** | D-184-17's one-off dump script | ✗ | — | **`supabase start` before running the dump.** The dump is a *human-run, one-off* step; nothing in CI or the test suite needs the DB |
| Chrome MCP | the 5 G-4 live UAT rows | ~ | known to hang on open Radix menus; fallback is operator-driven clicks | operator drives; see `feedback_chrome_mcp_testing` |
| Backend uvicorn + the canvas flag ON | G-4 rows U-1…U-4 | ~ | operator starts uvicorn; flip `visual_workflow_canvas` **On in the Control Room** first, U-5 flips it back | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** local Supabase (start it before the dump step, which is a one-off outside the test loop).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | **vitest 4.1.0** + `@testing-library/react` 16.3.2, jsdom 29, `vitest-axe` 0.1.0 |
| Config file | `frontend/vite.config.ts` (`test:` block) · setup `frontend/src/setupTests.ts` |
| Quick run command | `cd frontend && npx vitest run src/components/workflows src/pages/WorkflowBuilderPage.test.tsx src/pages/WorkflowBuilderPage.canvas.test.tsx src/components/admin/revertByteIdentical.test.tsx` |
| Full suite command | `cd frontend && npm test` |
| Type gate (differential) | `cd frontend && npx tsc -b 2>&1 \| grep -c "error TS"` — **baseline 33**, must not increase |

**Measured Wave-0 baseline (this session, `develop`, all green):**

| File | Tests |
|---|---|
| `canvasModel.fixtures.test.ts` | 100 |
| `canvasModel.purity.test.ts` | 69 |
| `phaseVocabulary.test.ts` | 42 |
| `WorkflowCanvas.test.tsx` | 31 |
| `canvasModel.test.ts` | 26 |
| `PublishGauntlet.test.tsx` | 24 |
| `WorkflowBuilderPage.canvas.test.tsx` | 22 |
| `PhaseFormPanel.test.tsx` | 19 |
| `WorkflowBuilderPage.test.tsx` | 15 |
| `PhaseSpineGraph.test.tsx` | 14 |
| `soulData.test.ts` | 14 |
| `WorkflowDoorSwitch.test.tsx` | 13 |
| `PhaseSpine.test.tsx` | 11 |
| `deriveTier.test.ts` | 9 |
| `WorkflowSoul.test.tsx` | 8 |
| `revertByteIdentical.test.tsx` | 7 |
| **TOTAL** | **424 / 424 passing, 0 failing** |

This table **is** D-184-08's count pin (the Phase-177 lesson: a failures-only differential cannot see a DELETED test). Reproduce it mechanically:
```bash
cd frontend
npx vitest run <the four paths above> --reporter=json --outputFile=/tmp/vitest-after.json
node -e "const r=require('/tmp/vitest-after.json');
  console.log('total',r.numTotalTests,'failed',r.numFailedTests);
  for(const s of r.testResults) console.log(s.name.replace(/.*[\\\\/]/,''), s.assertionResults.length)"
```
Gate: total **≥ 424**, failed **= 0**, and **no per-file count decreases**. (Feature waves may increase counts; Wave 0 must not change any of them.)

### Phase Requirements → Test Map

| Req | Behaviour | Test type | Automated command | File exists? |
|---|---|---|---|---|
| **R1** | add/insert/reorder/delete → `phase_index` exactly `[0..n-1]`, no dup/hole | **pure unit** | `npx vitest run src/components/workflows/definitionOps.test.ts` | ❌ Wave 0 |
| **R1** | insert-at-middle on the 5-phase `eval_coverage` shape increments every downstream index by exactly 1 | pure unit | same | ❌ Wave 0 |
| **R2** | `fromCanvas(toCanvas(p), p)` ≡ `[...p].sort(byIndexThenSlug)` **by reference**, over the committed dump + generated shapes | **property** | `npx vitest run src/components/workflows/canvasModel.roundtrip.test.ts` | ❌ Wave 1 |
| **R2** | `fromCanvas` reads no `node.position` / `node.data`; is pure | source-grep (`?raw`) | extend `canvasModel.purity.test.ts` | ✅ extend |
| **R3** | no migration file added by this phase | **pure unit** (fs glob) or a plan-level check | `git diff --name-only <base>..HEAD -- supabase/migrations \| wc -l` → 0 | ❌ new |
| **R3** | serialized create/PATCH body contains no `position`/`x`/`y`/`layout` key | component (mocked api) | extend `WorkflowBuilderPage.canvas.test.tsx`, reuse `forbiddenKeysIn` from `canvasModel.purity.test.ts:35` | ✅ extend |
| **R3** | a nudge issues **zero** network requests | component (mocked fetch, call count 0) | new canvas editing suite | ❌ Wave 2 |
| **R4** | `⌘Z`/`Ctrl+Z`/`⇧⌘Z`/`Ctrl+Y` step through structural edits | **store unit** (no DOM) + component for the key bindings | `npx vitest run src/components/workflows/builderStore.test.ts` | ❌ Wave 0 |
| **R4** | a nudge leaves `pastStates.length` unchanged | store unit | same | ❌ Wave 0 |
| **R4** | the undo stack holds the definition slice only (`partialize`) — a `verdicts` set pushes nothing | store unit | same | ❌ Wave 0 |
| **R4** | two config edits within 500 ms coalesce to ONE entry; a structural edit pushes immediately | store unit + fake timers | same | ❌ Wave 0 |
| **R5** | canvas selection opens the **same** `PhaseFormPanel`; `onClose` stays required (typecheck) | component + `tsc` | existing `WorkflowBuilderPage.canvas.test.tsx` + `tsc -b` | ✅ extend |
| **R5** | per-type field conditioning unchanged; **no second form component** | component + source-grep | existing `PhaseFormPanel.test.tsx` (19, unmodified) + a new "exactly one form component" grep | ✅ / ❌ new |
| **R6** | a session issues exactly one `POST` then `PATCH`; no new endpoint; saved wording implies no publish | component (mocked api, call log) | new editing-session suite | ❌ Wave 2 |
| **R7** | two edits, responses resolved **out of order** → the newer verdict renders | **component + fake timers + deferreds** | `npx vitest run src/hooks/useLiveValidation.test.tsx` | ❌ Wave 1 |
| **R7** | rejected/timed-out `/validate` ⇒ no node clean, publish stays blocked | component | same | ❌ Wave 1 |
| **R7** | `grounding_unavailable` renders as "we could not check", never `ok` | component | same | ❌ Wave 1 |
| **R7** | 422 vs network produce different wording, same behaviour; the 422 body is not shown | component | same | ❌ Wave 1 |
| **R8** | marks change when **only the server response** changes, local state identical | component | new verdict-render suite | ❌ Wave 1 |
| **R8** | an unrecognised code renders (as `error`), never dropped | component | same | ❌ Wave 1 |
| **R8** | a `phase: null` verdict appears in the tray | component | same | ❌ Wave 1 |
| **R9** | 3-`incomplete`/0-`error` fixture renders **zero** destructive-token elements; the tray's two-count wording is present before expansion | component (class/token scan) | same | ❌ Wave 1 |
| **R10a** | an orphaning delete is refused with a stated reason; a non-orphaning delete proceeds | **pure unit** | `definitionOps.test.ts` | ❌ Wave 0 |
| **R10b** | a stranding add choice is offered **disabled with a reason** | pure unit + component | `definitionOps.test.ts` + picker suite | ❌ Wave 0/2 |
| **R10** | neither refusal consults `/validate` | source-grep + fetch-call-count 0 | picker/refusal suite | ❌ Wave 2 |
| **R11** | tool options come from the bundle response (change the mock ⇒ options change); **no free-text box** | component (mocked `getGroundingBundle`) | new rails suite | ❌ Wave 2 |
| **R11** | a `degraded` bundle renders the could-not-load message, never an empty-but-normal picker | component | same | ❌ Wave 2 |
| **R11** | a 🔒 gate row has **no removal control in the DOM**; a named-but-unregistered tool renders struck through | component | same | ❌ Wave 2 |
| **R11** | no `grounding_mode` anywhere | source-grep | existing `WorkflowCanvas.test.tsx:427` + extend to the panel/store | ✅ extend |
| **R12** | at 900 px: exactly one bottom-edge region, no horizontal overflow | component (jsdom, structural) + **live G-4** | new composition suite; jsdom cannot measure real overflow — assert structure, verify overflow live | ❌ Wave 2 |
| **R12** | disabled publish's accessible name / adjacent text contains the first verdict message | component | same | ❌ Wave 2 |
| **R12** | no net-new header band | source/DOM structure assertion | same | ❌ Wave 2 |
| **D-14** | flag-off Builder byte-identical for every audience incl. operators | component | existing `revertByteIdentical.test.tsx` (7) + a new "panel without `rails` is unchanged" assertion | ✅ extend |
| **D-184-08** | Wave 0 assertion-free: per-file counts pinned, canvas snapshot byte-unchanged, `tsc` errors ≤ 33 | **CI/script gate** | the JSON-reporter script above + `git diff --exit-code -- 'src/**/__snapshots__/*'` + the `tsc` count | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run src/components/workflows src/pages/WorkflowBuilderPage.test.tsx src/pages/WorkflowBuilderPage.canvas.test.tsx src/components/admin/revertByteIdentical.test.tsx` (runs in well under a minute; **424 → must not regress**).
- **Per wave merge:** `npm test` (full frontend suite) + `npx tsc -b 2>&1 | grep -c "error TS"` ≤ 33 + `git diff --exit-code -- 'frontend/src/**/__snapshots__/*'` during Wave 0.
- **Phase gate:** full suite green, then the 5 G-4 live rows driven by the operator before `/gsd:verify-work`.
- **Backend:** untouched — no backend test is in this phase's sampling loop. (If a plan proposes a backend change, that is a scope violation: SPEC's constraints say "no backend change unless discuss-phase surfaces a concrete blocker", and discuss-phase surfaced none.)

### Wave 0 Gaps

- [ ] `src/components/workflows/definitionOps.test.ts` — R1, R10a, R10b (pure)
- [ ] `src/components/workflows/builderStore.test.ts` — R4 (store + fake timers; also proves assumption A3)
- [ ] `src/components/workflows/PhaseNodeCard.test.tsx` — renders with **zero** `@xyflow` import, outside a `ReactFlowProvider` (D-184-06's whole point) + the max-2 badge tuple is a typecheck error to exceed
- [ ] `scripts/vitest-count-gate.(sh|cjs)` — the JSON-reporter per-file count differential (D-184-08's mechanical half)
- [ ] Extend `canvasModel.purity.test.ts` — `fromCanvas` purity + no-edge-read + no-renumber guards
- [ ] `src/hooks/useLiveValidation.test.tsx` — R7 (Wave 1, but the deferred-promise helper is shared infrastructure; author it once)
- [ ] `scripts/dump-workflow-corpus.(sh|py)` + `__fixtures__/corpusDump.json` — D-184-17 (needs `supabase start`; one-off, human-run)
- [ ] `__fixtures__/shapeGenerator.ts` — the hand-rolled generator (no new dependency)

*Framework install: none needed — vitest, RTL, jsdom and vitest-axe are all present.*

**Which G-4 rows cannot be automated:**

| Row | Automatable? | Why |
|---|---|---|
| **U-1** Empty draft → first step → blocked publish | **Partly.** The mechanics (add works, publish disabled, reason named) are component-testable. **"reads as an invitation, not a broken screen" is not** — that is an operator judgement on a rendered screen | Chrome MCP / operator |
| **U-2** Delete a middle step | **Mostly.** Re-stitch + renumber + "how many moved" + the refusal are all component-testable. The **drag** half is not (d3-drag is unusable in jsdom) | drag → live only |
| **U-3** Mid-build never reads as failure | **Partly.** "zero destructive-token elements" is a mechanical scan; **"does not look alarming"** is not | Chrome MCP / operator |
| **U-4** Save → reload → nothing lost or invented | **No.** Requires a real backend, a real Supabase row, a real hard reload, and real `localStorage` persistence across the reload. jsdom cannot reload | live only |
| **U-5** Flag off = yesterday's Builder (incl. an operator account) | **Partly.** `revertByteIdentical.test.tsx` + the panel-without-`rails` assertion cover the mechanics; the **operator-account** audience path and "no editing affordance reachable anywhere" need the real Control-Room flip | live only |

---

## Security Domain

> `security_enforcement` is absent from `.planning/config.json` ⇒ treated as enabled. SPEC records **no threat model required** unless research surfaces one. **Research surfaced none** — the phase adds no route, no migration, no egress, no credential, and no new trust boundary; v3.4 org RLS already enforces the share boundary and Phase 182 already secured both consumed routes (T-168-11-class review, WR-08/CR-01 closed).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard control |
|---|---|---|
| V2 Authentication | **no (unchanged)** | Both consumed routes use `Depends(require_canvas())` + `canvas_caller`, which reuses the already-validated identity (Phase 182-09) — one token validation per canvas request |
| V3 Session Management | no | No session state added; the store is per-mount and in-memory |
| V4 Access Control | **no (unchanged)** | `/grounding-bundle` reads stay **owner-scoped by `user_id`** (T-182-03) and project away `org_id` + the seeding owner's `user_id` (CR-02). 184 adds no read |
| V5 Input Validation | **yes** | **Server-side:** `WorkflowDefinition` `extra="forbid"` + the `PhaseConfig` discriminated union + two `@model_validator`s. **Client-side:** none — and that is the requirement (D-182-06). The one client-side input is the auto-generated slug (D-184-11), which must be derived from a **closed** set of 6 phase types plus a numeric suffix, never from user text |
| V6 Cryptography | no | No secrets, no encryption, no `SECRETS_ENCRYPTION_KEY` interaction |
| V7 Error Handling / Logging | **yes** | D-184-14: the 422 body is **logged, not shown**. Pydantic `loc`/`msg` strings must not reach a business-user surface |
| V12 Files / Resources | no | No upload, no storage path |
| V13 API | **no (unchanged)** | `CanvasGateMiddleware` (`canvas_gate.py:61-66`) makes both routes byte-identical to an unbuilt path when the flag is off — pre-auth 404, never 403/401 |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard mitigation | Status in 184 |
|---|---|---|---|
| XSS via an authored phase `name` rendered on a node or in the tray | Tampering | Plain React text children / `title=` attributes; **never** `dangerouslySetInnerHTML` | Already the rule (T-124-01) in `PhaseNode.tsx` + `WorkflowCanvas.tsx` docblocks. **Extends to the new verdict `message` strings** — those are server-authored but must still be plain text children |
| Injecting an unknown key into the definition JSONB | Tampering / EoP | `extra="forbid"` on `_StrictBase` (T-090-01) | Unchanged. `fromCanvas`'s carry-through cannot add a key by construction; `canvasModel.purity.test.ts`'s `forbiddenKeysIn` walk is the tripwire |
| Route existence leaked when the flag is off | Information disclosure | Pre-auth 404 via `CanvasGateMiddleware`, never 403 (D-182-05 / the 181 WR-01 lesson) | Unchanged — 184 mounts no route |
| A client-side "valid" verdict the server would reject | Repudiation | VALID-03 + D-182-06: the client renders, never classifies | Enforced by R8's "marks change with the response alone" test and by keeping every code renderable |
| `localStorage` key collision leaking one user's layout to another on a shared browser | Information disclosure (very low) | Key the nudge map per **user id + draft id**, and clear on sign-out if the app already does so for other keys | New in 184 — a cosmetic `dy` is not sensitive, but keying it per user is free |

**Recommendation:** no `/gsd:secure-phase` run is warranted. If the planner adds any backend change, that verdict is void and a threat model becomes mandatory.

---

## Sources

### Primary (HIGH confidence)

- **Installed source, read directly this session** — `frontend/node_modules/@xyflow/react@12.11.2` (`dist/esm/index.js` `triggerNodeChanges`; `types/component-props.d.ts`; `types/nodes.d.ts` `OnNodeDrag`), `@xyflow/system` (`types/changes.d.ts` — the six-member `NodeChange` union), `zustand@5.0.13` (`traditional.d.ts` present), `@iconify-json/fluent-emoji@1.2.7` (`icons.json` — `compass` / `handshake` PRESENT).
- **`charkour/zundo` upstream source via `gh api`** — `src/index.ts` (the `curriedHandleSet(pastState, undefined, currentState, deltaState)` call site; `store.temporal = createStore(...)` inside the config initializer), `src/temporal.ts` (`_handleSet` limit eviction, `undo`/`redo` splice semantics, `pause`/`resume`), `src/types.ts` (`ZundoOptions`, `TemporalState`).
- **`charkour/zundo` README** (raw.githubusercontent, main) — the `temporal` option table, the `useStoreWithEqualityFn` React pattern, the `TemporalState` interface, version requirements.
- **`charkour/zundo` issues via `gh api`** — #207 (React 19 compiler / `getState()` is not reactive — the maintainer's answer quoted), #204 (no manual save API), #209, #216, #200.
- **npm registry** — `npm view zundo version|peerDependencies|time.created|license|scripts|dist.unpackedSize`; `api.npmjs.org/downloads/point/last-week/zundo`.
- **zustand official docs** — `pmndrs/zustand` → `docs/reference/integrations/third-party-libraries.md` lists `zundo` (GitHub code search).
- **Codebase, read directly** — `backend/app/api/workflows.py:288-733` (`Verdict`, `ValidateResponse`, `GroundingBundleResponse`, `_severity`, both handlers), `backend/app/models/harness.py:20-300` (`_StrictBase`, the 6 config members, `ValidatorSpec`, `PhaseSpec`, `WorkflowDefinition` + both `@model_validator`s), `backend/app/middleware/canvas_gate.py:61-66`, `frontend/src/components/workflows/{canvasModel.ts,phaseVocabulary.ts,PhaseNode.tsx,WorkflowCanvas.tsx,PhaseFormPanel.tsx,soulData.ts,PublishGauntlet.tsx}`, `frontend/src/pages/{WorkflowBuilderPage.tsx,WorkflowsPage.tsx}`, `frontend/src/lib/{api.ts,phaseGlyph.tsx}`, `frontend/src/hooks/usePanelReconcile.ts`, `frontend/src/stores/streamsStore.ts`, `frontend/src/test-utils/mockReactFlow.ts`, and every test file named in this document.
- **Measured this session** — `npx tsc -b` → **33** `error TS` lines; `npx vitest run <4 paths> --reporter=json` → **424 tests / 16 files / 0 failing** (the per-file table above).
- **Planning artifacts** — `184-SPEC.md`, `184-CONTEXT.md`, `.planning/ROADMAP.md` (Phases 184–188), `.planning/REQUIREMENTS.md`, `.planning/research/PITFALLS.md` (Pitfalls 1/3/5), `.planning/sketches/MANIFEST.md` (the 2026-07-26 decision block), sketch READMEs 138/139/140/141, `.planning/sketches/themes/canvas-184.css`.

### Secondary (MEDIUM confidence)

- `reactflow.dev/learn/advanced-use/uncontrolled-flow` and `reactflow.dev/api-reference/react-flow` — thin on prop semantics; the controlled/uncontrolled behaviour was therefore **verified in library source** instead, which is why the claim in Pattern 6 is stated as verified rather than cited.
- `slopcheck install zundo` → `[OK]` (the tool's own npm subprocess then failed on Windows; the verdict itself completed).

### Tertiary (LOW confidence)

- The gzip-in-bundle estimate for `zundo` (assumption A6) — derived from `dist.unpackedSize`, not measured with a bundle analyser.

---

## Metadata

**Confidence breakdown:**

- **Standard stack — HIGH.** `zundo@2.3.0` verified on the registry, in zustand's official docs, and by reading its own source; peer range confirmed against the installed `zustand@5.0.13`; slopcheck `[OK]`; no `postinstall`; nothing installed during research.
- **Architecture — HIGH.** Every module boundary recommended here is forced by a *shipped* guard (`WorkflowCanvas.test.tsx:426`, `WorkflowBuilderPage.canvas.test.tsx:416`, `canvasModel.purity.test.ts`) or by a verified library behaviour (`triggerNodeChanges` discarding changes without `onNodesChange`). The one genuinely composed pattern — the selective `handleSet` flush — is flagged as assumption **A3** with a named proof test.
- **Round-trip analysis — HIGH.** The dropped-field table was derived by reading `toCanvas` against all six `PhaseConfig` members and `ValidatorSpec`; both failure modes (`toCanvas` sorts; `indexGap` exists) are reproducible against fixtures already committed to the repo.
- **Pitfalls — HIGH.** Eleven pitfalls, each anchored to a specific file:line in this repo or a specific upstream issue. The jsdom/`user-event` landmine is quoted from the shipped test's own docblock.
- **Corpus facts — LOW.** The local Supabase was unreachable; the SPEC's "95 / 40" numbers could not be re-verified and are explicitly flagged as drifting (assumption A1). D-184-17's self-describing dump is the designed mitigation.

**Research date:** 2026-07-26
**Valid until:** 2026-08-25 (30 days — the stack is stable; `zundo` has not published since 2024-11-17). Re-verify sooner only if `zustand` majors or `@xyflow/react` is upgraded.

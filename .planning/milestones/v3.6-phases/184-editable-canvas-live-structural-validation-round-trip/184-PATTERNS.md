# Phase 184: Editable Canvas + Live Structural Validation (Round-Trip) — Pattern Map

**Mapped:** 2026-07-26
**Files analyzed:** 29 (18 net-new · 11 modified)
**Analogs found:** 26 / 29 (17 exact · 9 role-match · 3 no-analog)
**Scope:** frontend-only (React 19.2.4 + Vite + Tailwind + shadcn/ui). Zero backend change, zero migration.

> **Anti-drift discipline applied (CONTEXT `<code_context>` note 3).** Every analog cited below
> was opened and read this session. Line numbers were re-derived from the files themselves, NOT
> copied from CONTEXT/RESEARCH. Section **"Line-number corrections"** at the bottom lists the
> five places where the upstream docs drifted — the planner must use the corrected numbers.

---

## File Classification

### Wave 0 — the G-5 extraction (lands FIRST, before any feature code)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `frontend/src/components/workflows/soulData.ts` + `soulData.test.ts` + `frontend/src/lib/phaseGlyph.tsx` (commit 0a — icon swap) | config / const-table | n/a | itself (2 maps + 2 imports + 1 docblock + 1 assertion — see §W0a) | exact (in-place edit) |
| `frontend/src/components/workflows/definitionOps.ts` **NEW** | utility (pure ops) | transform | `frontend/src/components/workflows/deriveTier.ts` | exact |
| `frontend/src/components/workflows/definitionOps.test.ts` **NEW** | test | transform | `frontend/src/components/workflows/deriveTier.test.ts` + `canvasModel.purity.test.ts` | exact |
| `frontend/src/components/workflows/builderStore.ts` **NEW** | store | event-driven | `frontend/src/stores/streamsStore.ts` | role-match (singleton → per-mount factory) |
| `frontend/src/components/workflows/BuilderStoreProvider.tsx` **NEW** | provider | event-driven | `frontend/src/providers/TechnicalNamesProvider.tsx` (optional-accessor idiom) | role-match |
| `frontend/src/components/workflows/builderStore.test.ts` **NEW** | test | event-driven | `frontend/src/__tests__/integration/streamsStore_per_thread.test.ts` | exact |
| `frontend/src/components/workflows/nodePresentation.ts` **NEW** | utility (const-table) | transform | `frontend/src/components/org/StatusChip.tsx` (shared component + domain tone map) | exact |
| `frontend/src/components/workflows/PhaseNodeCard.tsx` **NEW** | component (presentational) | n/a | `frontend/src/components/panel/PhaseCard.tsx` + the shipped `PhaseNode` body itself | exact |
| `frontend/src/components/workflows/PhaseNodeCard.test.tsx` **NEW** | test | n/a | `frontend/src/components/workflows/PhaseSpine.test.tsx` (provider-less leaf render) | exact |
| `frontend/src/components/workflows/PhaseNode.tsx` **MODIFIED** (shrinks to adapter) | component (adapter) | n/a | itself `:171-261` — extract body, keep `NodeProps` signature | exact |

### Feature waves

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `frontend/src/components/workflows/canvasModel.ts` **MODIFIED** (`+ fromCanvas`) | model (pure serializer) | transform | `toCanvas` in the SAME file `:214-345` | exact |
| `frontend/src/components/workflows/canvasModel.roundtrip.test.ts` **NEW** | test | transform | `canvasModel.fixtures.test.ts` (`describe.each` sweep) | exact |
| `frontend/src/components/workflows/canvasModel.purity.test.ts` **MODIFIED** (+`fromCanvas` fences) | test (source-grep guard) | n/a | itself `:100-129` | exact |
| `frontend/src/components/workflows/canvasNudge.ts` **NEW** | utility (browser storage) | file-I/O | `frontend/src/lib/streamsCache.ts` | exact |
| `frontend/src/components/workflows/canvasNudge.test.ts` **NEW** | test | file-I/O | `frontend/src/hooks/useResizablePanel.test.ts` | role-match |
| `frontend/src/hooks/useLiveValidation.ts` **NEW** | hook | request-response (debounced + abortable) | `frontend/src/hooks/usePanelReconcile.ts` (abort half) + `frontend/src/lib/throttle.ts` (debounce half) | role-match (composed from 2) |
| `frontend/src/hooks/useLiveValidation.test.tsx` **NEW** | test | request-response | `frontend/src/hooks/useOperatorProbe.test.ts` | exact |
| `frontend/src/lib/api.ts` **MODIFIED** (`validateWorkflow`, `getGroundingBundle`) | service (API client) | request-response | `createWorkflowDraft` `:3314` / `updateWorkflowDraft` `:3340` in the SAME file | exact |
| `frontend/src/components/workflows/WorkflowCanvas.tsx` **MODIFIED** | component (shell) | event-driven | itself `:164-341` | exact |
| `frontend/src/components/workflows/StepTypePicker.tsx` **NEW** | component | n/a | `PhaseFormPanel.tsx` `SelectField` `:201` + `phaseVocabulary.PHASE_TYPE_SENTENCES` `:108` | role-match |
| `frontend/src/components/workflows/ProblemsTray.tsx` **NEW** | component | n/a | `frontend/src/components/panel/PhaseTimeline.tsx` (list + polite announcer) | role-match |
| `frontend/src/components/workflows/PhaseFormPanel.tsx` **MODIFIED** (optional `rails`) | component (form) | request-response | itself `:53-74` (props) — additive-optional prop idiom | exact |
| `frontend/src/pages/WorkflowBuilderPage.tsx` **MODIFIED** | page (composition) | event-driven | itself `:146-655` | exact |
| `frontend/src/components/workflows/PublishGauntlet.tsx` **MODIFIED** (optional `blockedReason`) | component | n/a | `PhaseFormPanel` optional-prop idiom | role-match |
| `frontend/src/pages/WorkflowsPage.tsx` **MODIFIED** (leave guard on `backToLibrary:290`) | page | event-driven | `WorkflowBuilderPage.tsx:224-231` (gated window listener) | role-match |
| `frontend/src/components/workflows/__fixtures__/shapeGenerator.ts` **NEW** | fixture (generator) | transform | `__fixtures__/canvasFixtures.ts` (its shape + docblock convention) | role-match |
| `frontend/src/components/workflows/__fixtures__/corpusDump.json` **NEW** | fixture (data artifact) | n/a | — | **no analog** |
| `scripts/dump-workflow-corpus.py` **NEW** | script (one-off) | file-I/O | `scripts/repair_dirty_workflow_phases.py` | exact |
| `frontend/package.json` **MODIFIED** (`+ zundo`) | config | n/a | `zustand: "^5.0.13"` at `:49` (verified present; `zundo` verified ABSENT) | exact |

---

## Shared Patterns

These apply to MULTIPLE new files. The planner should reference them once per plan rather than
re-deriving them per task.

### S1. The three shipped source-grep guards (load-bearing — quoted verbatim)

These three assertions **decide the module boundaries** for this phase. Honouring them produces
the right architecture for free; violating them means editing an assertion, which is exactly the
D-184-08 failure signal.

**Guard 1 — `frontend/src/components/workflows/WorkflowCanvas.test.tsx:415-429`** (verified verbatim):
```tsx
describe("WorkflowCanvas — the scope fences (source guard)", () => {
  it("suppresses the interactivity lock in source", () => {
    expect(workflowCanvasSource).toContain("showInteractive={false}")
  })

  it("ships no minimap and no attribution removal", () => {
    expect(workflowCanvasSource).not.toMatch(/MiniMap/)
    expect(workflowCanvasSource).not.toMatch(/hideAttribution/)
  })

  it("makes no network call and reads no Phase-185 authoring field", () => {
    expect(workflowCanvasSource).not.toMatch(/workflows\/validate/)
    expect(workflowCanvasSource).not.toMatch(/grounding_mode/)
  })
})
```
⇒ `useLiveValidation.ts` + `api.ts` own the fetch. `WorkflowCanvas` receives `verdicts` as a prop.
⇒ `showInteractive={false}` at `WorkflowCanvas.tsx:334` must survive the edit.

**Guard 2 — `frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx:414-438`** (verified verbatim):
```tsx
describe("WorkflowBuilderPage canvas door — source guards", () => {
  it("persists no view preference (D-183-02 — session state only)", () => {
    expect(builderSource).not.toMatch(/localStorage/)
    expect(builderSource).not.toMatch(/sessionStorage/)
  })

  it("uses tablist semantics only — never mixed with a pressed state", () => {
    expect(builderSource).not.toMatch(/aria-pressed/)
  })

  it("never names the frozen React Flow v11 package", () => {
    // `@xyflow/react` v12 is the dependency; `reactflow` is the frozen v11 name.
    expect(builderSource).not.toMatch(/reactflow/)
  })

  it("gates on the OPTIONAL accessor with a STRICT true comparison", () => {
    expect(builderSource).toMatch(/useEffectiveFeaturesOptional\(\)/)
    expect(builderSource).not.toMatch(/useEffectiveFeaturesContext\(/)
    expect(builderSource).toMatch(/visual_workflow_canvas === true/)
  })

  it("code-splits the canvas at module scope", () => {
    expect(builderSource).toMatch(
      /const WorkflowCanvas = lazy\(\(\) => import\("@\/components\/workflows\/WorkflowCanvas"\)/,
    )
  })
})
```
⇒ `canvasNudge.ts` is its OWN module; the page passes `draftId` in and never touches storage.
⇒ The lazy import at `WorkflowBuilderPage.tsx:86` must keep its EXACT text (regex-pinned).
⇒ The flag gate at `:193-197` must keep the literal `visual_workflow_canvas === true`.

**Guard 3 — `frontend/src/components/workflows/canvasModel.purity.test.ts:100-129`** (verified verbatim):
```ts
describe("canvasModel — source purity (the ?raw grep, the shipped house idiom)", () => {
  it("reads no DOM, no clock and no randomness", () => {
    expect(canvasModelSource).not.toMatch(
      /getBoundingClientRect|offsetHeight|offsetWidth|document\.|window\.|Date\.now|Math\.random/,
    )
  })

  it("imports nothing from the API client", () => {
    expect(canvasModelSource).not.toMatch(/from\s+["']@\/lib\/api["']/)
  })

  it("never references the server validation seam (D-183-15: zero network round trips)", () => {
    expect(canvasModelSource).not.toMatch(/workflows\/validate/)
    expect(canvasModelSource).not.toMatch(/fetch\(/)
  })

  it("declares no second copy of the phase glyph map or the on-fail parse (G-5)", () => {
    expect(canvasModelSource).not.toMatch(/const PHASE_GLYPHS/)
    expect(canvasModelSource).not.toMatch(/function parseSkipTarget/)
  })

  it("imports the shared vocabulary rather than re-deriving it", () => {
    expect(canvasModelSource).toMatch(/from "@\/components\/workflows\/phaseVocabulary"/)
  })

  it("derives the sequential edge by phase_index LOOKUP, never by array adjacency", () => {
    expect(canvasModelSource).toMatch(/phase_index \+ 1/)
    expect(canvasModelSource).not.toMatch(/ordered\[\s*(i|index)\s*\+\s*1\s*\]/)
  })
})
```
⇒ `fromCanvas` lands in `canvasModel.ts` and inherits ALL of these. It may not fetch, may not
read a clock, may not import `@/lib/api`.
⇒ The planner should ADD one guard to this same describe block: *`fromCanvas` never reads an
edge* (Open Question 1's recommendation) — same `?raw` idiom, appended, no existing assertion edited.

### S2. The `?raw` source-grep idiom itself (copy this shape for any new fence)

`canvasModel.purity.test.ts:14-17` — the import half:
```ts
import { describe, it, expect } from "vitest"

import canvasModelSource from "./canvasModel?raw"
import { toCanvas, CANVAS_LAYOUT } from "./canvasModel"
```
`WorkflowCanvas.test.tsx:30-32` states the precedent explicitly:
```tsx
// The component SOURCE via Vite's ?raw loader — the idiomatic vitest way to make a
// scope fence machine-checkable (the PhaseSpineGraph.test.tsx:20-22 precedent).
import workflowCanvasSource from "./WorkflowCanvas?raw"
```

**The D-ITEM-183-02 trap, restated as a rule for authors of new fences:** a guard must never
force a docblock to omit the real identifier. `canvasFixtures.ts:20-23` documents this in the
shipped code:
```
 * PATH CONVENTION: SQL sources are cited relative to the repo's migrations directory
 * (`migrations/NNN_*.sql`). That is deliberate — the acceptance guard for this file
 * forbids the local-stack tokens that would indicate a live read, and the full
 * platform-prefixed path contains one of them.
```
⇒ R11's "no frontend constant" guard MUST be worded as *"the option SET equals the mocked
bundle response"*, never a blanket literal grep — `friendlyToolName` (`PhaseFormPanel.tsx:387-396`)
is a LABEL map that must survive.

### S3. The house purity docblock (all pure new modules: `definitionOps.ts`, `nodePresentation.ts`, `fromCanvas`)

`deriveTier.ts:1-22` — the canonical shape (states WHY it is pure, names the backend mirror,
and declares the no-API-import rule):
```ts
/**
 * Phase 103 (REQ-7 h, sketch 021-A D10) — deriveTier()/TIERS.
 *
 * THE SINGLE SOURCE OF TRUTH for the workflow strictness-tier badge. The tier is
 * DERIVED on every render from the REAL enums — `citation_policy` (the strictness
 * dial) plus the SET of `ValidatorSpec.kind` gates a definition actually carries.
 * ...
 * Because the derivation is pure and client-side, toggling `citation_policy`
 * strict->draft in the Builder changes the badge with NO server round-trip
 * (REQ-7 acceptance h). This module imports NOTHING from the API client — a tier
 * is computed, never fetched.
 * ...
 * Mirror of the backend enums:
 *  - citation_policy: harness.py `LlmEmitPhaseConfig.citation_policy`.
 *  - validator kinds: harness.py `ValidatorSpec.kind`.
 */
```
And its TOTALITY contract, which `definitionOps` must also honour (`phaseVocabulary.ts:36-40`):
```
 * TOTALITY contract (CANVAS-01): every exported resolver is total. An unknown
 * `phase_type`, an unknown `citation_policy`, an unknown validator kind, a missing
 * `validators` array and a malformed `on_failure` all resolve honestly and NEVER
 * throw — the definition JSONB is author-supplied and a projection must not crash on it.
```

### S4. The frozen const-table idiom (`nodePresentation.ts`, `definitionOps.ts` constants)

`canvasModel.ts:53-77` names it and points at its own source:
```ts
/**
 * CANVAS_LAYOUT — ONE frozen table, the `deriveTier.ts:57-79` const-table idiom. Every
 * placement number in this module reads from here and plan 183-06's CSS agrees with
 * the SAME table, so a stray literal cannot creep into either half.
 */
export const CANVAS_LAYOUT = {
  NODE_WIDTH: 260,
  ...
} as const satisfies Record<string, number>
```
The `as const satisfies Record<K, V>` suffix is the house form — `deriveTier.ts:79`
(`} as const satisfies Record<TierId, Tier>`) and `phaseVocabulary.ts:195`
(`} as const satisfies Record<Grounding["mode"], Grounding>`) both use it.

### S5. Immutable, non-mutating array ops (`definitionOps.ts` core)

The idiom being extracted, `WorkflowBuilderPage.tsx:334-345` (the CONFIG-patch half —
becomes `definitionOps.patchPhaseConfig`):
```tsx
  // Merge a phase-form patch into the selected phase's config (immutable).
  const onPhaseChange = useCallback(
    (patch: PhaseConfigPatch) => {
      setState((prev) => {
        if (prev.phase !== "drafted" || selectedSlug === null) return prev
        const phases = prev.definition.phases.map((p) =>
          p.slug === selectedSlug ? { ...p, config: { ...p.config, ...patch } } : p,
        )
        return { phase: "drafted", definition: { ...prev.definition, phases } }
      })
    },
    [selectedSlug],
  )
```
And the shipped non-mutating sort idiom `renumber`/`movePhase` must reuse
(`canvasModel.ts:206-209, 221-223`):
```ts
 * PURE (D-183-12). The input array is never mutated — `[...phases].sort(...)` is the
 * shipped non-mutating idiom (`PhaseSpine.tsx:38-40`) and the sort comparator is
 * TOTAL (index, then slug) ...
  const ordered = [...phases].sort(
    (a, b) => a.phase_index - b.phase_index || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0),
  )
```
⇒ **`definitionOps.renumber` must use this EXACT comparator** so `fromCanvas`'s round-trip
property and `toCanvas`'s ordering agree.

### S6. Optional-prop additivity = D-14 safety (`PhaseFormPanel.rails`, `PublishGauntlet.blockedReason`)

The shipped required-prop precedent that must NOT be weakened (`PhaseFormPanel.tsx:70-73`):
```ts
  /** Dismiss the panel; the parent owns the selection state. REQUIRED — not optional
   *  — so "a panel the user cannot close" is not a representable state and a dropped
   *  wiring is a typecheck error rather than a silent UX regression. */
  onClose: () => void
```
Every existing optional prop in that interface carries a `?` plus a docblock naming its
originating phase (`:58-65`):
```ts
  /** The bound project-folder display name for `folder_scope` (name, never a path).
   *  Kept for backward-compat; `folderNames` (the id→name map) is preferred. */
  folderName?: string
  /** Phase 103-ux: id→name map so every folder_scope id renders as its real NAME
   *  (📁 Name) with the bound id reachable via the ⓘ hint. */
  folderNames?: IdNameMap
```
⇒ `rails?: {...}` follows this shape exactly. **Absent ⇒ today's render, byte-for-byte.** The
19 shipped `PhaseFormPanel.test.tsx` assertions render WITHOUT `rails` and must stay unedited.

### S7. Gated window listener (the D-184-04 precedent, verbatim)

`WorkflowBuilderPage.tsx:217-231` — read this whole block; the "gated on state, costs nothing at
rest" rationale is the exact argument the undo/redo listener reuses:
```tsx
  // Escape releases the panel, in BOTH views. GATED on `panelOpen`: no listener
  // exists while the panel is closed, so this costs nothing at rest and cannot
  // accumulate across renders. One accepted interaction, recorded rather than
  // engineered around: if a modal sits above the Builder, Escape dismisses the modal
  // AND releases the selection. ...
  useEffect(() => {
    if (!panelOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") clearSelection()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [panelOpen, clearSelection])
```
⇒ The D-184-04 undo listener mounts on `activeGraphView === "canvas" && canvasEnabled`, and its
guard body adds the `input`/`textarea`/`contenteditable` bail plus the auto-repeat guard already
shipped at `WorkflowCanvas.tsx:234` (`if (event.repeat) return`).

### S8. Test-driver rule inside the React Flow plane (`fireEvent`, never `user-event`)

`WorkflowCanvas.test.tsx:120-137` — quote this in the plan so no test author re-discovers it:
```
 * A note on the click driver. The shipped spine's suite drives selection with
 * `user-event`, but a `user-event` click INSIDE the canvas plane also dispatches a
 * real `mousedown`, which reaches d3-zoom's pan handler; d3-drag then dereferences
 * `event.view.document` and jsdom's synthetic MouseEvent carries a null `view`. The
 * result is the failure mode plan 183-01 named "a gate that lies": every assertion
 * passes, three unhandled `TypeError`s fire from outside the test body, and vitest
 * still exits 1. `fireEvent.click` dispatches only the click ... The ⌥ control below
 * sits OUTSIDE the plane and keeps using `user-event`.
```
And the jsdom mock, FILE-LOCAL by rule (`test-utils/mockReactFlow.ts:15-24`, imported per suite at
`WorkflowCanvas.test.tsx:26-28`):
```tsx
// FILE-LOCAL, never setupTests.ts: the helper mutates HTMLElement.prototype, and a
// global install would perturb all ~205 suites and destroy this phase's
// failing-name differential. Call it before the first render.
import { mockReactFlow } from "@/test-utils/mockReactFlow"
```
⇒ `PhaseNodeCard.test.tsx` needs NONE of this — that is the whole point of the zero-`@xyflow`
card (D-184-06). Use the plain-render analog `PhaseSpine.test.tsx` instead.

---

## Pattern Assignments

### `frontend/src/components/workflows/definitionOps.ts` (utility, transform) — **NEW**

**Analog:** `frontend/src/components/workflows/deriveTier.ts` (129 L — pure, zero React, zero
API import, own test file, sibling directory).
**Secondary:** the code being lifted — `WorkflowBuilderPage.tsx:334-345` (see §S5).

**Module docblock pattern** (`deriveTier.ts:1-22`, `phaseVocabulary.ts:31-40`): state (a) the
single-source claim, (b) the purity contract (*"imports NOTHING from the API client"*), (c) the
TOTALITY contract, (d) the backend mirror by `file:line`.

**Export shape pattern** (`deriveTier.ts:102-129`) — a single exported pure function with an
exhaustiveness guard that falls back SAFELY at runtime rather than throwing:
```ts
export function deriveTier(
  citationPolicy: CitationPolicy,
  validatorKinds: Set<ValidatorKind>,
): Tier {
  ...
  switch (citationPolicy) {
    case "strict":
      return TIERS.STRICT
    ...
    default: {
      // Exhaustiveness guard — a new citation_policy enum must be handled here.
      // IR-03: at RUNTIME an unknown policy (future enum / malformed JSONB) must NOT
      // return the raw string as a Tier (the caller would crash reading .id/.glyph).
      // Keep the compile-time check, but fall back to the safe LOOSE tier at runtime.
      const _never: never = citationPolicy
      void _never
      return TIERS.LOOSE
    }
  }
}
```

**Immutability pattern:** §S5 (`[...phases].sort(...)` + `.map(p => ({...p}))`, never in-place).

**The two refusals** (`canRemovePhase`, `allowedTypesAt`) reuse the shipped skip-parse rather than
re-deriving it — `phaseVocabulary.ts:94-98`:
```ts
export function parseSkipTarget(onFailure: string | null | undefined): string | null {
  if (typeof onFailure !== "string" || !onFailure.startsWith(SKIP_PREFIX)) return null
  const target = onFailure.slice(SKIP_PREFIX.length).trim()
  return target.length > 0 ? target : null
}
```
⚠️ A second copy of this function is grep-forbidden by Guard 3 (`canvasModel.purity.test.ts:117-118`)
in `canvasModel.ts`; the same discipline applies to `definitionOps.ts` — **import it**.

**Return-shape pattern for a refusal** — no shipped exact analog for a Result union in this
directory; the closest is `api.ts`'s discriminated `PublishOutcome` (`:3286-3293`):
```ts
/** The 4 distinguished outcomes of POST /workflows/{id}/publish. A binary
 *  `200 = ok / else = error` handler is FORBIDDEN — a 200 can carry a BLOCK
 *  (`published:false`), and 400/404/409 each mean something distinct. */
export type PublishOutcome =
  | { kind: "verdict"; verdict: PublishVerdict }
  | { kind: "business_requirement"; verdict: PublishVerdict }
  | { kind: "not_found" }
  | { kind: "already_published" }
```
⇒ `canRemovePhase` returns `{ ok: true } | { ok: false; reason: string }` in this idiom (the
reason is a rendered sentence — R10 says *no refusal is silent*).

---

### `frontend/src/components/workflows/definitionOps.test.ts` (test, transform) — **NEW**

**Analog:** `frontend/src/components/workflows/deriveTier.test.ts` (97 L) for the plain-unit half;
`canvasModel.fixtures.test.ts` (143 L) for the fixture-sweep half.

**`describe.each` sweep pattern** (`canvasModel.fixtures.test.ts:52-63`) — this is the shape R1's
contiguity proof should take, so a new fixture is swept automatically:
```ts
describe.each(ALL_FIXTURES)("toCanvas sweep — $name", ({ phases }) => {
  it("emits exactly one 'phase' node per phase (no dropped phase)", () => {
    const { nodes } = toCanvas(phases)
    expect(nodes.filter((n) => n.type === "phase")).toHaveLength(phases.length)
  })

  it("gives every phase node an id equal to its slug (SC#3)", () => {
    const { nodes } = toCanvas(phases)
    const ids = nodes.filter((n) => n.type === "phase").map((n) => n.id)
    const slugs = [...phases].sort((a, b) => a.phase_index - b.phase_index).map((p) => p.slug)
    expect(ids).toEqual(slugs)
  })
```

**Positive-control pattern** — the house requires a control that PROVES the assertion can fail
(`canvasModel.purity.test.ts:69-72`):
```ts
  it("the walk is a real control — it FINDS a planted layout key", () => {
    const planted = [{ slug: "a", phase_index: 0, config: { phase_type: "llm_single" }, position: { x: 1, y: 2 } }]
    expect(forbiddenKeysIn(planted)).toContain("position")
  })
```
⇒ R1's "`phase_index` is exactly `[0..n-1]`" assertion needs a matching planted-gap control.

**Named-fixture accessor pattern** (`canvasModel.fixtures.test.ts:91-95`) — throws rather than
silently skipping when a fixture goes missing:
```ts
  const fixture = (name: string) => {
    const found = ALL_FIXTURES.find((f) => f.name.startsWith(name))
    if (!found) throw new Error(`fixture ${name} missing from ALL_FIXTURES`)
    return found.phases
  }
```
⇒ R1's "insert-at-middle on the 5-phase `eval_coverage`" test uses `fixture("eval_coverage")`.

---

### `frontend/src/components/workflows/builderStore.ts` (store, event-driven) — **NEW**

**Analog:** `frontend/src/stores/streamsStore.ts` (387 L) — **the only zustand store in the app**
(verified: `grep "from ['\"]zustand"` returns exactly 2 hits, both in this file). It is a MODULE
SINGLETON; 184's store is a per-mount FACTORY, so the divergence is deliberate and must be
documented in the new module's docblock.

**Zustand v5 curried-create pattern** (`streamsStore.ts:36-37, 295`):
```ts
import { create } from "zustand"
import { subscribeWithSelector } from "zustand/middleware"
...
export const useStreamsStore = create<StreamsState>()(subscribeWithSelector(() => ({
```
⇒ note the `create<T>()(middleware(...))` curried v5 form. `zundo`'s `temporal(...)` slots into
the same middleware position: `create<BuilderState>()(temporal((set, get) => ({...}), {...}))`.

**State-shape docblock pattern** (`streamsStore.ts:1-35`) — every decision id (`D-068-01..06`) is
enumerated at the top, and every field carries a `/** … */` naming the phase that added it and
whether it is persisted or ephemeral. Copy this for `TrackedSlice` vs untracked fields — the
partialize boundary is exactly the persisted/ephemeral distinction this file already documents:
```ts
  /** Per-thread harness phase timeline (panel-only). Absent key = no phases. */
  phasesByThread: Map<string, Phase[]>
```

**Immutable-replace action pattern** (`usePanelReconcile.ts:78-82` — the shipped `setState`
copy-then-mutate form the store's actions must follow):
```ts
          useStreamsStore.setState((s) => {
            const next = new Map(s.reconcileErrors)
            next.delete(key)
            return { reconcileErrors: next }
          })
```

**Selector-reactivity rule (Pitfall 7 / zundo #207).** The house already codifies "read through a
selector, never `getState()` in render" — `usePanelReconcile.ts:58-60` is the shipped selector form:
```ts
  const error = useStreamsStore((s) =>
    threadId ? (s.reconcileErrors.get(`${threadId}:${hookId}`) ?? null) : null,
  )
```
vs the side-effect form at `:77` (`useStreamsStore.getState()...`) which is deliberately NOT a
rendered value. ⇒ `canUndo` / `canRedo` MUST be selectors on `store.temporal`.

---

### `frontend/src/components/workflows/BuilderStoreProvider.tsx` (provider, event-driven) — **NEW**

**Analog:** `frontend/src/providers/TechnicalNamesProvider.tsx` — specifically its OPTIONAL
accessor, which is the fail-closed idiom the canvas already depends on
(`WorkflowCanvas.tsx:181-183`):
```tsx
  // The app-wide reveal, READ (never owned) here. Null outside a provider.
  const technicalNames = useTechnicalNamesOptional()
  const showTechnical = technicalNames?.showTechnical ?? false
```
and its rationale (`WorkflowCanvas.tsx:45-53`):
```
 * D-183-08 — ONE ⌥ TECHNICAL-NAMES STATE, THE APP-WIDE ONE. ... A canvas-local reveal
 * state would reintroduce the exact "two toggles disagree" failure that provider's own
 * docblock says it exists to prevent ... The control is rendered only when the context
 * is present, so no dead control ships; a provider-less render (unit tests, isolated
 * renders) falls back to plain language, shows no control, and does not crash.
```
⇒ Same shape for the builder store: an optional accessor so `PhaseNodeCard` and any leaf still
render in a provider-less unit test. **Do NOT make the store a required context for leaves.**

**Cross-component seam (Open Question 4 / Pitfall 10).** The `← Workflows` breadcrumb lives in
`WorkflowsPage.tsx` — verified this session:
```tsx
// WorkflowsPage.tsx:290-294
  const backToLibrary = useCallback(() => {
    setPageView("library")
    refetchDrafts().catch(console.error)
    refetchPublished().catch(console.error)
  }, [refetchDrafts, refetchPublished])
```
```tsx
// WorkflowsPage.tsx:314-318 — the button
            onClick={backToLibrary}
            className="rounded-md border border-border px-2.5 py-1 text-[13px] text-muted-foreground hover:text-foreground"
          >
            ← Workflows
          </button>
```
⇒ Either mount `BuilderStoreProvider` ABOVE both (in `WorkflowsPage`), or have the Builder
register a `canLeave()` callback. There is **no router** (confirmed: `WorkflowBuilderPage.tsx:32-33`
— *"the app has no router — navigation is a `useState<ActiveView>` switch"*), so no router blocker exists.

---

### `frontend/src/components/workflows/builderStore.test.ts` (test, event-driven) — **NEW**

**Analog:** `frontend/src/__tests__/integration/streamsStore_per_thread.test.ts` — the shipped
store-layer test. Its `beforeEach` reset + direct `setState`/`getState` drive is exactly the shape
A3's "prove the `handleSet` selective-flush works" test needs:
```ts
import { describe, it, expect, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"
import { useStreamsStore } from "@/stores/streamsStore"
...
beforeEach(() => {
  // Plan 075.4-01 D-075.4-A1: per-thread fields reset to fresh empties.
  useStreamsStore.setState({
    bucketsBySurface: new Map(),
    viewedThreadId: null,
    streamingThreads: new Set<string>(),
    ...
  })
})
...
    const state = useStreamsStore.getState()
    expect(state.streamingThreads.has("thread-a")).toBe(true)
```
⇒ For a per-mount factory the `beforeEach` reset becomes `const store = createBuilderStore(...)`
per test — simpler, and the reason the factory shape is better. Assert per A3:
structural push ⇒ `pastStates.length` +1 **synchronously**; two config edits inside 500 ms ⇒ +1
**after** `vi.advanceTimersByTimeAsync(500)`.

---

### `frontend/src/components/workflows/nodePresentation.ts` (utility, transform) — **NEW**

**Analog:** `frontend/src/components/org/StatusChip.tsx` (94 L) — the Phase-177 shared-primitive
extraction. Its docblock is the precise scope-discipline template for splitting a shared COMPONENT
from a domain TONE MAP:
```ts
/**
 * Phase 177 Plan 01 Task 1 — StatusChip (the D-08 cohesion primitive).
 * ...
 * Structural template: metadata/ConfidenceChip.tsx — a module-level BASE_CLASSES
 * const + a Record<tone,string> variant map + cn(BASE, VARIANT[tone]) on a single
 * <span> (never colour-alone — the label WORD carries the meaning; any glyph a
 * consumer adds is decorative/aria-hidden). The chip is presentational and gates
 * NOTHING — the honest-absent gate (D-06) stays at the call site.
 * ...
 * SCOPE (no overclaim): `statusChipMeta` maps the invitation + SSO **lifecycle**
 * domain ... The cohesion win is the ONE shared COMPONENT; the tone MAPPING stays
 * domain-specific.
 */
export type ChipTone = "primary" | "success" | "muted"

// The 166 chip tones — lifted VERBATIM from InvitationsTab.tsx:71-75 / SsoTab.tsx:71-75.
export const CHIP_TONE_CLASS: Record<ChipTone, string> = { ... }

const BASE_CLASSES = "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium"
```

**What to move, verbatim, from `PhaseNode.tsx`** (⚠️ CORRECTED IDENTIFIERS + LINES — see
"Line-number corrections"):

`PhaseNode.tsx:108-122` — the tint table (real name `ICON_TINT`, NOT `PHASE_TINTS`):
```ts
/**
 * The per-step-type tint that sits BEHIND the floating mark — the whole of this
 * surface's type-colour budget (137-D). Values are the sketch's, expressed against
 * the same hue family the app already ships; every card body stays neutral.
 */
const ICON_TINT: Record<string, string> = {
  programmatic: "hsl(200 85% 62% / 0.36)",
  llm_single: "hsl(220 30% 100% / 0.22)",
  llm_agent: "hsl(239 90% 70% / 0.40)",
  llm_batch_agents: "hsl(170 80% 55% / 0.34)",
  llm_human_input: "hsl(38 92% 62% / 0.38)",
  llm_emit: "hsl(258 90% 70% / 0.40)",
}

const DEFAULT_TINT = "hsl(220 30% 100% / 0.18)"
```

`PhaseNode.tsx:124-141` — the tone map (real name `GROUNDING_TONE`, singular). **Its docblock
already cites StatusChip's scope rule — preserve it verbatim on the move:**
```ts
/**
 * The canvas-domain tone mapping for the shared `StatusChip` (D-183-07 slot 1).
 *
 * This is the documented reuse shape, not a fork: `StatusChip`'s own docblock
 * separates the shared COMPONENT (the cohesion win) from the tone MAPPING (always
 * domain-specific — `statusChipMeta` maps the invitation/SSO lifecycle,
 * `adoptionChip` maps the roster's adoption state, and this maps grounding). A
 * third inline pill is exactly the fork Phase 177 retired.
 * ...
 */
const GROUNDING_TONE: Record<Grounding["mode"], ChipTone> = {
  strict: "success",
  flag: "primary",
  open: "muted",
}
```

`PhaseNode.tsx:143-162` — `renderPhaseMark`. **The docblock is load-bearing (a lint rule depends
on it) — move it intact:**
```ts
/**
 * The 3D mark, resolved at MODULE scope and returned as a `ReactNode`.
 * ...
 * The resolution deliberately does NOT happen inside a component body:
 * `phaseGlyph()` returns a COMPONENT, and binding a component to a local during
 * render is what `react-hooks/static-components` correctly flags — React cannot
 * preserve state across renders for a type that is recreated. Hoisting the JSX call
 * site into a leaf component does not clear it either (the rule fires in any
 * component body); returning the element from a plain module-scope helper does ...
 */
function renderPhaseMark(phaseType: string): ReactNode {
  const mark = phaseGlyph(phaseType)
  return mark ? createElement(mark, { className: "h-8 w-8" }) : (PHASE_GLYPHS[phaseType] ?? "•")
}
```
⇒ Must be `export`ed on the move. Keep it at MODULE scope in the new file too.

---

### `frontend/src/components/workflows/PhaseNodeCard.tsx` (component, presentational) — **NEW**

**Analog (structure):** `frontend/src/components/panel/PhaseCard.tsx` (474 L) — the shipped
props-driven phase card with a status atom, a locked type-meta table and an UNKNOWN fallback:
```tsx
// ── PHASE_TYPE_LABEL (DATA-CONTRACT §5.1) — the 5 LOCKED literals → label + glyph
//    + one-liner. UNKNOWN (forward-compat) falls back to the generic "Step" row;
//    the renderer NEVER crashes on an unrecognized discriminator. ──
const UNKNOWN_PHASE_META: PhaseTypeMeta = { label: "Step", glyph: "•", oneLiner: "A workflow step ran." }

function phaseTypeMeta(phaseType: string): PhaseTypeMeta {
  return PHASE_TYPE_LABEL[phaseType] ?? UNKNOWN_PHASE_META
}
```
Also its non-colour-alone rule (`PhaseCard.tsx:17-20`), which 184's marks inherit:
```
 *  - Status atom: aria-hidden glyph + a real visible text label + a contrast-AA
 *    color token (NEVER --muted-foreground-dim for meaningful text — 3.59:1 fail).
```

**Analog (body to lift):** `PhaseNode.tsx:171-261` — the entire current `PhaseNode` render body
becomes `PhaseNodeCard`, minus `<EdgeAnchors />` (which stays in the adapter). The two invariants
that MUST survive the extraction, verbatim from `PhaseNode.tsx:16-23`:
```
 * ONE TAB STOP PER NODE (Pattern 3 Option A). ... These components therefore contain
 * NO focusable control of any kind — no inner pressable element, no anchor, no
 * tab-index attribute, no click handler. An inner control would produce two tab stops
 * per node ...
```
This is machine-checked at `WorkflowCanvas.test.tsx:231-238`:
```tsx
  it("no focusable control exists INSIDE any node (the double-tab-stop mistake)", () => {
    const { container } = renderCanvas(evalCoverage)
    const nodes = Array.from(container.querySelectorAll(".react-flow__node"))
    expect(nodes.length).toBeGreaterThan(0)
    for (const node of nodes) {
      expect(node.querySelectorAll("button, a, [tabindex]")).toHaveLength(0)
    }
  })
```
⚠️ **This assertion constrains the ✕-delete and `＋`-insert affordances**: they may NOT live
inside the node DOM. Put them on the plane / lane, not in the card.

**The test-id + data-attribute contract to preserve** (`PhaseNode.tsx:182-189`) — the canvas
suite selects on these; changing any breaks an assertion (D-184-08 violation):
```tsx
    <div
      data-testid={`canvas-node-${data.slug}`}
      data-slug={data.slug}
      data-phase-type={data.phaseType}
      data-selected={selected ? "true" : "false"}
      className="relative"
      style={{ width: CANVAS_LAYOUT.NODE_WIDTH, minHeight: CANVAS_LAYOUT.NODE_MIN_HEIGHT }}
    >
```
plus the badge wrappers at `:215` (`data-grounding={data.grounding.mode}`) and `:225`
(`data-waits-for-you="true"`), whose `StatusChip testId`s are `"canvas-grounding"` and
`"canvas-waits-for-you"`.

**Max-2 badge tuple (D-184-06).** No shipped tuple-typed slot analog exists. The nearest
type-system-enforced budget is `deriveTier.ts:79`'s `as const satisfies Record<TierId, Tier>`
exhaustiveness. Model it as:
`badges?: readonly [] | readonly [BadgeSlot] | readonly [BadgeSlot, BadgeSlot]`.
The budget it enforces is stated at `PhaseNode.tsx:212-213`:
```tsx
        {/* At most TWO word-badges (D-183-07). No tool chips, no gate identifiers,
            no phase_index on the face. */}
```

---

### `frontend/src/components/workflows/PhaseNode.tsx` (component, adapter) — **MODIFIED**

**Analog:** itself. After the split, the file keeps `EdgeAnchors` (`:81-106`),
`UnresolvedSkipNode` (`:278-298`) and `EndCapNode` (`:311-325`) unchanged, and `PhaseNode`
collapses to the `NodeProps` → slots adapter.

**The `NodeProps` boundary to keep** (`PhaseNode.tsx:171-179`):
```tsx
export function PhaseNode({ data, selected }: NodeProps<PhaseCanvasNode>) {
  // The ⌥ reveal rides on `data` (set by the shell), so this leaf has no context
  // dependency of its own and there can never be a second technical-names state.
  const technical = data.technical === true
  const title = technical ? data.technicalTitle : data.title
  const tint = ICON_TINT[data.phaseType] ?? DEFAULT_TINT
```
⇒ The adapter is the ONLY file in the pair that imports `@xyflow/react` (`:66`:
`import { Handle, Position, type NodeProps } from "@xyflow/react"`). Add a `?raw` guard on
`PhaseNodeCard.tsx` asserting `not.toMatch(/@xyflow/)` — D-184-06 in machine-checkable form,
following §S2.

**Handles stay in the adapter** — `PhaseNode.tsx:26-34` explains why they cannot be dropped:
```
 * HANDLES ARE MANDATORY, NOT DECORATION (assumption A1 ...): a custom node that
 * renders no `Handle` paints ZERO edges — silently, with no warning.
```

---

### `frontend/src/components/workflows/canvasModel.ts` — `fromCanvas` (model, transform) — **MODIFIED**

**Analog:** `toCanvas` in the SAME file, `:203-345`. Read its docblock and mirror its structure.

**The purity docblock to mirror** (`canvasModel.ts:203-213`):
```ts
/**
 * Project a definition's phases onto the canvas.
 *
 * PURE (D-183-12). The input array is never mutated — `[...phases].sort(...)` is the
 * shipped non-mutating idiom (`PhaseSpine.tsx:38-40`) and the sort comparator is
 * TOTAL (index, then slug) so even duplicate `phase_index` values order
 * deterministically regardless of the caller's array order.
 *
 * An empty definition returns empty arrays: no end cap, no ghost node, no chrome
 * (D-183-11 — the single most common canvas state).
 */
export function toCanvas(phases: PhaseSpecJSON[]): CanvasProjection {
```

**The SORT that `fromCanvas`'s property must compare against** (`canvasModel.ts:220-223` — verbatim):
```ts
  // Total, order-independent ordering: phase_index first, slug as the tiebreak.
  const ordered = [...phases].sort(
    (a, b) => a.phase_index - b.phase_index || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0),
  )
```

**The node-type filter `fromCanvas` must apply** (`canvasModel.ts:82-86` + `:233-243`) — only
`"phase"` nodes correspond to a `PhaseSpec`; the end cap and the unresolved-skip stub carry
reserved ids (`RESERVED_PREFIX = "__canvas__"`, `:163`):
```ts
export const CANVAS_NODE_TYPES = {
  phase: "phase",
  unresolvedSkip: "unresolvedSkip",
  endCap: "endCap",
} as const
```
```ts
/** A node the canvas draws. Only `"phase"` nodes correspond to a `PhaseSpec`. */
export type CanvasNode = PhaseCanvasNode | UnresolvedSkipCanvasNode | EndCapCanvasNode
```

**The no-reference-handback rule `fromCanvas` deliberately INVERTS** — note the shipped assertion
at `canvasModel.purity.test.ts:74-83`:
```ts
  it("does not hand back a reference to any input phase object", () => {
    const phases = clone(evalCoverage)
    const { nodes } = toCanvas(phases)
    for (const node of nodes) {
      for (const phase of phases) {
        expect(node.data).not.toBe(phase)
        expect(node.data).not.toBe(phase.config)
      }
    }
  })
```
⚠️ That guard is about `toCanvas`'s NODE DATA, not about `fromCanvas`'s output. `fromCanvas`
returns the SAME phase objects by reference (RESEARCH Pattern 1) — the two claims do not conflict,
but the planner must state the distinction in `fromCanvas`'s docblock or a reader will read it as
a contradiction.

**The `indexGap` fixture that forbids renumbering inside `fromCanvas`** — verified at
`__fixtures__/canvasFixtures.ts:260-269`:
```ts
/** The NON-CONTIGUOUS `phase_index` gap (correction C-2) — hand-authored, test-only.
 *  Indices `[0, 1, 3]`. The server's adjacency draws `0→1` ONLY and calls the
 *  index-3 phase an orphan; a sorted-array walk would draw a phantom `1→3`. Publish
 *  lint rejects a gap (`bad_index`), but the Builder projects UNSAVED drafts and
 *  draft rows, neither of which is lint-gated. */
export const indexGap: PhaseSpecJSON[] = [
  { slug: "first", phase_index: 0, config: { phase_type: "llm_agent" } },
  { slug: "second", phase_index: 1, config: { phase_type: "llm_single" } },
  { slug: "stranded", phase_index: 3, config: { phase_type: "llm_single" } },
]
```

---

### `frontend/src/components/workflows/canvasModel.roundtrip.test.ts` (test, transform) — **NEW**

**Analog:** `canvasModel.fixtures.test.ts` (143 L) — its `describe.each` sweep (see the
`definitionOps.test.ts` entry) plus its "the corpus itself" meta-block (`:18-50`), which asserts
properties OF the fixture corpus so a shrinking corpus is a failure:
```ts
describe("canvasFixtures — the corpus itself (SC#4 coverage)", () => {
  it("registers at least 14 fixtures in the sweep list", () => {
    expect(ALL_FIXTURES.length).toBeGreaterThanOrEqual(14)
  })

  it("covers all six phase types", () => { ... })

  it("covers node counts 0, 1, 2, 3 and 5", () => { ... })

  it("names a source for every fixture (transcribed, or explicitly hand-authored)", () => {
    for (const f of ALL_FIXTURES) {
      expect(f.source.length).toBeGreaterThan(0)
      expect(/:\d+|hand-authored, test-only/.test(f.source)).toBe(true)
    }
  })
})
```
⇒ Copy this block for `corpusDump.json` + `shapeGenerator.ts`: assert the dump's
`_provenance.row_count` matches `definitions.length`, and that the generator emits the named
shapes (branch edge, unresolvable skip, gate-heavy, single-phase, deep chain, index gap,
duplicate `phase_index`, one per config-union member).

**Serializability assertion pattern** (`canvasModel.fixtures.test.ts:80-83`):
```ts
  it("survives a JSON round-trip unchanged (serializable)", () => {
    const out = toCanvas(phases)
    expect(JSON.parse(JSON.stringify(out))).toEqual(out)
  })
```
⚠️ RESEARCH's anti-pattern list forbids `JSON.stringify` for the round-trip PROPERTY itself
(key order becomes load-bearing). Use `toBe` per element + `toStrictEqual` as backstop; the
`JSON.stringify` idiom above is fine for the separate serializability check only.

---

### `frontend/src/components/workflows/canvasNudge.ts` (utility, file-I/O) — **NEW**

**Analog:** `frontend/src/lib/streamsCache.ts` (413 L) — the shipped user-scoped-localStorage
module. It is an exact structural match for the `dy` map, including the per-user keying the
"Claude's Discretion" nudge decision requires.

**Key-namespace pattern** (`streamsCache.ts:29-44`):
```ts
/**
 * Phase 068.5 B-01 fix (2026-05-14): the cache key is user-scoped so a shared
 * origin (dev machine with multiple test logins, kiosk, family device) can't
 * leak one user's chat content into another user's first paint. ...
 * Resolved key shape: `agentic-rag.streams.v1.<user_id>`.
 */
export const STREAMS_CACHE_KEY_PREFIX = "agentic-rag.streams.v1" as const
...
export const STREAMS_CACHE_VERSION = 2 as const
```
```ts
export function streamsCacheKey(userId: string): string {
  return `${STREAMS_CACHE_KEY_PREFIX}.${userId}`
}
```
⇒ `canvasNudge`'s key: `agentic-rag.canvas-nudge.v1.<user_id>.<draft_id>` (or a single
`…v1.<user_id>` object keyed by draft id — either satisfies "keyed per user + draft id").

**Sync-user-id resolution** (`streamsCache.ts:60-79`) — reuse this exported helper rather than
re-deriving:
```ts
export function getCurrentUserIdSync(): string | null {
  try {
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith("sb-") || !key.endsWith("-auth-token")) continue
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw) as { user?: { id?: string } }
      const userId = parsed?.user?.id
      if (typeof userId === "string" && userId.length > 0) return userId
    }
  } catch {
    // Defensive — any localStorage read / JSON parse failure returns null.
  }
  return null
}
```

**Defensive-read pattern** (the hook-level variant, `useResizablePanel.ts:67-76`) — for the
simpler in-component read:
```ts
  const [width, setWidth] = useState<number>(() => {
    try {
      const saved = window.localStorage.getItem(storageKey)
      if (saved !== null) {
        const n = Number.parseInt(saved, 10)
        if (Number.isFinite(n)) return Math.min(maxWidth, Math.max(minWidth, n))
      }
    } catch {
      /* localStorage unavailable (private mode / SSR) — fall back to default */
```

**Quota-failure discipline** — `streamsCache.ts:19-22` states the rule the nudge writer must
follow (silent degrade, never crash the surface):
```
 *   - Pitfall 4 (iOS Safari private mode / Quota exhaustion): writeSnapshotToLocalStorage
 *     wraps setItem in try { } catch (QuotaExceededError) { evict-half + retry-once };
 *     on second throw, console.warn + silent fall-through (in-memory bucket still works).
```
(the writer is `writeSnapshotToLocalStorage` at `streamsCache.ts:264`.)

---

### `frontend/src/hooks/useLiveValidation.ts` (hook, request-response) — **NEW**

**Analog (abort half):** `frontend/src/hooks/usePanelReconcile.ts` (133 L) — the app's only
in-hook fetch. Its own docblock records that it was itself COMPOSED rather than copied, which is
the honest precedent for composing this one:
```ts
/**
 * Phase 086 Plan 02 (D-086-13 / D-086-14 / D-086-15) — shared reconcile helper ...
 *
 * Composed from two existing StreamsProvider patterns (NOT copied from one
 * source — there is no in-hook fetch analog):
 *   1. AbortController-per-fetch + post-await thread guard + reconcileErrors
 *      set/clear — the loadMessages action body (StreamsProvider.tsx:1348-1430).
 *   2. AbortController in effect cleanup (L-068-02 in-flight lock) —
 *      `return () => controller.abort()` (StreamsProvider.tsx:1483-1490).
 */
```

**Effect + abort-on-cleanup pattern** (`usePanelReconcile.ts:114-130`) — copy this shape and add
the `setTimeout` debounce inside it:
```ts
  // Thread-switch reconcile: fires on [threadId] change, aborts the in-flight
  // fetch on cleanup (L-068-02). NO visibility/focus listeners (D-086-15).
  useEffect(() => {
    if (!threadId) {
      setIsLoading(false)
      return
    }
    const controller = new AbortController()
    setIsLoading(true)
    void runReconcile(threadId, controller.signal).finally(() => {
      // Only clear the spinner if this fetch wasn't superseded — the post-await
      // guard already discarded a stale result; the finally only flips loading
      // when the controller is still the live one for this mount.
      if (!controller.signal.aborted) setIsLoading(false)
    })
    return () => controller.abort()
  }, [threadId, runReconcile])
```

**Post-await staleness guard** (`usePanelReconcile.ts:70-75`) — the shipped precedent for
D-184-13's "braces" half. 184 upgrades `signal.aborted` to a monotonic `appliedRef` because abort
is best-effort:
```ts
        const data = await fetcher(tid, signal)
        // Post-await guard: drop the result if this fetch was aborted (the
        // controller's signal is the source of truth — a newer reconcile or a
        // thread-switch unmount already fired controller.abort()).
        if (signal.aborted) return
        replace(tid, data)
```

**AbortError-is-not-a-failure pattern** (`usePanelReconcile.ts:84-92`) — copy the double-shaped
check verbatim; D-184-14 says an abort caused by a newer edit is dropped SILENTLY, never degraded:
```ts
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return
        if (
          err &&
          typeof err === "object" &&
          "name" in err &&
          (err as { name: string }).name === "AbortError"
        )
          return
```

**Analog (debounce half):** `frontend/src/lib/throttle.ts` (40 L) — a hand-rolled
`setTimeout`+closure timer with an explicit `.flush()`. This is the house answer to "don't add a
debounce dependency", and its no-leading-edge / no-max-wait rationale transfers directly:
```ts
/**
 * Phase 068.5: Trailing-edge throttle with explicit `.flush()` method.
 * ...
 * No leading-edge fire (would cause N writes per stream burst, defeating
 * the batch). No max-wait (the trailing window is bounded by waitMs).
 * No this-binding (Zustand subscribers don't need it).
 */
export function makeThrottle<T extends (...args: never[]) => void>(
  fn: T,
  waitMs: number,
): T & { flush: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastArgs: Parameters<T> | null = null
  const invoke = () => {
    timer = null
    if (lastArgs) {
      fn(...lastArgs)
      lastArgs = null
    }
  }
  ...
  throttled.flush = () => {
    if (timer !== null) {
      clearTimeout(timer)
      invoke()
    }
  }
  return throttled
}
```
⚠️ **`makeThrottle` is a trailing-edge THROTTLE (fires `waitMs` after the FIRST call, ignoring
later ones), not a debounce (which resets the timer on every call).** D-184-13 needs a DEBOUNCE.
Do NOT reuse `makeThrottle` directly — reuse its closure SHAPE (and its `.flush()`, which
`zundo`'s `handleSet` coalescer also needs per RESEARCH Pattern 2), with `clearTimeout` on every
call. Also note: `lib/throttle.ts` is the correct HOME for a sibling `makeDebounce` if the planner
prefers a shared helper over an inline hook-local timer.

**Transient-timer cleanup on unmount** (`WorkflowBuilderPage.tsx:396-401`) — the shipped
in-Builder precedent:
```tsx
  // Clean up the transient-confirmation timer on unmount.
  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    }
  }, [])
```
⇒ Reuse for the ~300 ms minimum-visible "checking…" beat (Claude's Discretion).

---

### `frontend/src/hooks/useLiveValidation.test.tsx` (test, request-response) — **NEW**

**Analog:** `frontend/src/hooks/useOperatorProbe.test.ts` — the co-located hook test with a
module-mocked api client. Copy this shape exactly:
```ts
import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { useOperatorProbe } from "./useOperatorProbe"
import { getOperatorProbe, type OperatorIdentity } from "@/lib/api"

// Mock the api module so the hook never touches the network — the contract we
// pin is: identity → isOperator true; null (404) → isOperator false; and (WR-01)
// the probe is keyed to the authenticated user id, re-running on change and
// clearing on sign-out.
vi.mock("@/lib/api", () => ({
  getOperatorProbe: vi.fn(),
}))

const mockedProbe = vi.mocked(getOperatorProbe)
...
describe("useOperatorProbe", () => {
  beforeEach(() => {
    mockedProbe.mockReset()
  })

  it("200 → isOperator true with the identity populated", async () => {
    mockedProbe.mockResolvedValue(IDENTITY)
    const { result } = renderHook(() => useOperatorProbe("u1"))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isOperator).toBe(true)
    ...
    expect(mockedProbe).toHaveBeenCalledTimes(1)
  })
```
⚠️ `vi.mock("@/lib/api", () => ({ ... }))` replaces the WHOLE module — every api symbol the hook
(or its transitive imports) touches must be listed. This is the `feedback_mock_completeness`
lesson; enumerate `validateWorkflow` AND anything else the render path reaches.

**Fake-timer + out-of-order pattern (R7)** — RESEARCH §Pattern 3 supplies the recipe; the house
constraint is that `vi.useFakeTimers()` must NOT be combined with `user-event` without
`advanceTimers`. Note `vitest 4.1.0` removed `--reporter=basic`; use the default reporter or
`--reporter=json --outputFile=…` for D-184-08's per-file count table.

---

### `frontend/src/lib/api.ts` — `validateWorkflow` + `getGroundingBundle` (service) — **MODIFIED**

**Analog:** `createWorkflowDraft` / `updateWorkflowDraft` in the SAME file. Verified verbatim
(`api.ts:3313-3356`):
```ts
/** POST /workflows — create a draft. Returns {id, version}. */
export async function createWorkflowDraft(
  def: WorkflowDefinitionJSON,
  signal?: AbortSignal,
): Promise<{ id: string; version: number }> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/workflows`, {
    method: "POST",
    headers,
    body: JSON.stringify(def),
    signal,
  })
  if (!res.ok) throw new Error(`Failed to create workflow draft (status ${res.status})`)
  return (await res.json()) as { id: string; version: number }
}
```
```ts
/** PATCH /workflows/{id} — update a draft. Throws WorkflowConflictError on 409
 *  (the row is published/frozen) and WorkflowNotFoundError on 404 — a 409/404 is
 *  NEVER swallowed as success (T-103-03-04). */
export async function updateWorkflowDraft(
  id: string,
  def: WorkflowDefinitionJSON,
  signal?: AbortSignal,
): Promise<WorkflowDefinitionJSON> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/workflows/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(def),
    signal,
  })
  if (res.status === 409) throw new WorkflowConflictError()
  if (res.status === 404) throw new WorkflowNotFoundError()
  if (!res.ok) throw new Error(`Failed to update workflow draft (status ${res.status})`)
  return (await res.json()) as WorkflowDefinitionJSON
}
```
⇒ Contract to copy: `getAuthHeaders()` → `fetch(`${API_BASE}/…`)` → **typed** status branches
before the generic `!res.ok` → cast the JSON. `signal?: AbortSignal` is already the house
signature — `validateWorkflow(def, signal)` fits without inventing anything.

**Typed-error class pattern** (`api.ts:3295-3311`) — D-184-14's 422 needs its own class so the
hook can branch on `err.name` rather than parsing a message:
```ts
/** A published-row mutation (or a cross-user attempt resolving to a published
 *  row) → HTTP 409. Thrown (never swallowed) so the UI surfaces it instead of a
 *  silent overwrite (T-103-03-04). */
export class WorkflowConflictError extends Error {
  constructor(message = "workflow is published and cannot be modified") {
    super(message)
    this.name = "WorkflowConflictError"
  }
}

/** A draft mutation against a non-existent / non-owned definition → HTTP 404. */
export class WorkflowNotFoundError extends Error { ... }
```
⇒ Add `WorkflowValidateUnreadableError` (422) in this idiom. **The 422 body is logged, not
shown** (D-184-14) — log it at the `api.ts` boundary, keep the message business-plain.

**Discriminated-outcome pattern for the 4-way `/validate` result** (`api.ts:3286-3293` —
`PublishOutcome`, quoted in the `definitionOps.ts` entry). Its docblock's warning is exactly
D-184-14's:
> *"A binary `200 = ok / else = error` handler is FORBIDDEN"*

---

### `frontend/src/components/workflows/WorkflowCanvas.tsx` (component, shell) — **MODIFIED**

**Analog:** itself. The props interface to EXTEND (`:149-173`) — note the docblock justifies each
prop's existence and its parity with the Spine's props; new editing props need the same treatment:
```tsx
/**
 * `phases` / `selectedSlug` / `onSelectNode` are shared VERBATIM with
 * `PhaseSpineGraphProps` (`PhaseSpineGraph.tsx:55-61`), so the D-183-05 selection
 * contract is genuinely one rule for both views ...
 */
export interface WorkflowCanvasProps {
  phases: PhaseSpecJSON[]
  /** The currently-selected phase slug (the open form anchor), or null at rest. */
  selectedSlug: string | null
  /** Selection only — NEVER reorders, NEVER moves a node. Fires the clicked slug. */
  onSelectNode: (slug: string) => void
  /** Release the selection (a click on empty space). REQUIRED — the deselect half of
   *  the same contract; a canvas that can only select is a panel with no way out. */
  onClearSelection: () => void
}
```
⚠️ The `onSelectNode` docblock literally says *"NEVER reorders, NEVER moves a node."* 184 makes
that false. **That comment MUST be updated in the same commit as the behaviour** — leaving it is
the D-ITEM-183-02 "a comment that lies" trap in reverse.

**The view-copy pattern that node editing must extend** (`:187-201`) — the selection copy is where
`dy` + `draggable: true` + verdict marks get merged, and it is why no layout key can leak:
```tsx
  // A COPY. Selection and the ⌥ boolean are view state; the model output and the
  // definition behind it are never touched.
  const nodes = useMemo<CanvasNode[]>(
    () =>
      projection.nodes.map((node) =>
        node.type === CANVAS_NODE_TYPES.phase
          ? {
              ...node,
              selected: node.id === selectedSlug,
              data: { ...node.data, technical: showTechnical },
            }
          : node,
      ),
    [projection.nodes, selectedSlug, showTechnical],
  )
```

**The read-only opt-out block — exactly ONE flag flips** (`:302-310`, verified verbatim):
```tsx
          // ── read-only, stated explicitly (every one of these defaults to true) ──
          nodesDraggable={false}
          nodesConnectable={false}
          edgesReconnectable={false}
          connectOnClick={false}
          edgesFocusable={false}
          deleteKeyCode={null}
          zoomOnDoubleClick={false}
          // elementsSelectable / nodesFocusable / panOnDrag stay at their defaults.
```
⇒ Per RESEARCH Pattern 6: flip `nodesDraggable` **per-node** (`draggable: true` on phase nodes in
the view copy), not the shell prop. Every other line stays. `<Controls showInteractive={false} />`
at `:334` is pinned by Guard 1.

**Module-scope constants rule** (`:99-104`) — anything new (edge styles, node types, aria labels)
goes at module scope for the same Pattern-4 reason:
```tsx
/**
 * MODULE SCOPE, never inside the component (Pattern 4). Declared in the render body
 * this object is new on every parent render, which makes React Flow warn ("It looks
 * like you have created a new nodeTypes object") and re-render every node.
 */
const nodeTypes = { ... }
```

**Announced-affordance rule** (`:118-121`) — 184 ADDS drag and delete, so the override text may
need to change to stay true:
```tsx
const ARIA_LABELS = {
  "node.a11yDescription.default": "Press enter or space to open this step's details.",
  "node.a11yDescription.keyboardDisabled": "Press enter or space to open this step's details.",
}
```
This is pinned by `WorkflowCanvas.test.tsx:395-412` (the positive-control-first assertion) —
changing the string is an assertion edit; the planner must decide deliberately and enumerate it.

**Keyboard-activation + auto-repeat pattern for `⌥←`/`⌥→`** (`:223-251`, especially `:234`):
```tsx
      if (event.repeat) return
```
with its rationale at `:227-233` (*"one press is one activation… the panel can settle CLOSED on a
press that promised to open it"*).

---

### `frontend/src/components/workflows/PhaseFormPanel.tsx` (component, form) — **MODIFIED**

**Analog:** itself. See §S6 for the optional-prop rule.

**The conditioning anchor (verified at `:430-433`)**:
```tsx
  const cfg = phase.config as Record<string, unknown>
  const pt = phase.config.phase_type
  const folderIds = Array.isArray(cfg.folder_scope) ? (cfg.folder_scope as string[]) : []
  const friendlyType = PHASE_TYPE_FRIENDLY[pt] ?? pt
```
⇒ D-184-11's "the type MUST be chosen at add time" is forced by this: there is no control
anywhere in the file that writes `phase_type`.

**The tool field the rails must NOT replace unconditionally** (`:336-384`) — the free-text comma
box and its chips. Its two call sites are `:568-572` (`llm_agent`) and `:619-623`
(`llm_batch_agents`):
```tsx
/** Render available_tools as friendly chips (the raw tool ids reachable via ⓘ).
 *  Editing stays a comma field below the chips (so the field is still editable +
 *  testable via the label), and the chips are a read-friendly preview above it. */
function ToolsField({ tools, onChange, onPersist }: {...}) {
  ...
      <input
        id={id}
        type="text"
        value={tools.join(", ")}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onPersist}
        placeholder="search_documents, execute_code"
        ...
      />
```
```tsx
// :570-571 — the call site
                tools={asList(cfg.available_tools)}
                onChange={(v) => onChange({ available_tools: v.split(",").map((s) => s.trim()).filter(Boolean) })}
```

**The LABEL map that R11's guard must not false-positive on** (`:386-396`):
```tsx
/** Map a raw tool id to a friendlier reading (best-effort; falls back to the id). */
function friendlyToolName(id: string): string {
  const map: Record<string, string> = {
    search_documents: "Search documents",
    read_document: "Read a document",
    execute_code: "Run code",
    fetch_url: "Fetch a web page",
    list_folders: "List folders",
  }
  return map[id] ?? id
}
```
⇒ See §S2: word R11's guard as *"the option SET equals the mocked bundle response"*.

**WR-09-01/02 (commit-before-unmount on all three dismissal paths)** — the persist seam is
`onBlur={onPersist}` on every field (e.g. `:378`). The three dismissal paths are:
✕ → `onClose` (`:464` `onClick={onClose}`); Escape → `WorkflowBuilderPage.tsx:224-231`;
pane-click → `WorkflowCanvas.tsx:326` (`onPaneClick={onClearSelection}`).

---

### `frontend/src/pages/WorkflowBuilderPage.tsx` (page, composition) — **MODIFIED**

**Analog:** itself. The state to move out (verified — ⚠️ at `:151`, NOT `:100`):
```tsx
  const [state, setState] = useState<BuilderState>(
    initial ? { phase: "drafted", definition: initial.definition } : { phase: "empty" },
  )
```
The type union it belongs to (`:107-111`):
```tsx
type BuilderState =
  | { phase: "empty" }
  | { phase: "composing" }
  | { phase: "drafted"; definition: BuilderDefinition }
  | { phase: "error"; message: string; detail?: string }
```

**Persistence that STAYS (D-184-05)** — the create-once-then-PATCH guard, verbatim `:347-372`:
```tsx
  // Persist the working draft. First save → createWorkflowDraft (then keep the id);
  // subsequent saves → updateWorkflowDraft (PATCH). For Open/Tweak the ref is
  // pre-seeded so this ALWAYS PATCHes the loaded row (never a duplicate create).
  const onPersist = useCallback(async (): Promise<boolean> => {
    if (state.phase !== "drafted") return false
    const def = state.definition as unknown as Record<string, unknown>
    if (draftIdRef.current === null) {
      // First save: create EXACTLY ONCE. If a create is already in flight,
      // skip — re-running it would collide on UNIQUE(slug, version) → 500.
      if (creatingRef.current) return false
      creatingRef.current = true
      try {
        const created = await createWorkflowDraft(def)
        draftIdRef.current = created.id // synchronous: subsequent calls PATCH
        setDraftId(created.id)
      } finally {
        creatingRef.current = false
      }
    } else {
      await updateWorkflowDraft(draftIdRef.current, def)
    }
    return true
  }, [state])
```
⚠️ `onPersist`'s dependency is `[state]`. Moving `definition` into the store means this closure
must read the store instead — that is the ONE genuinely delicate line of the extraction.
Recommended: read via `store.getState()` inside the async body (a side-effect read, per the §S3
selector rule), keeping `onPersist` referentially stable.

**Save-state machine to reuse for the toolbar's `dirty → saving → Saved · still a draft`**
(`:374-394`):
```tsx
  const onSaveDraft = useCallback(async () => {
    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current)
      savedTimerRef.current = null
    }
    setSaveState("saving")
    try {
      const ok = await onPersist()
      setSaveState(ok ? "saved" : "error")
    } catch {
      // A 409 (published/frozen) / 404 / network failure is surfaced honestly —
      // never silently swallowed as a success.
      setSaveState("error")
    }
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    savedTimerRef.current = setTimeout(() => setSaveState("idle"), 2500)
  }, [onPersist])
```
⇒ D-184-16's 409 message replaces the bare `setSaveState("error")` branch with a
`err instanceof WorkflowConflictError` check.

**The flag gate (verified `:190-201`) — its literal text is regex-pinned by Guard 2:**
```tsx
  const featuresCtx = useEffectiveFeaturesOptional()
  const canvasEnabled =
    featuresCtx !== null &&
    !featuresCtx.loading &&
    featuresCtx.features.visual_workflow_canvas === true
  // The flag out-ranks stale session state: if the map is tightened mid-session while
  // the user is on Canvas, the column falls back to the Spine rather than stranding
  // them on a surface that just vanished.
  const activeGraphView = canvasEnabled ? graphView : "spine"
```

**The lazy import (verified `:86`) — regex-pinned by Guard 2, do not reformat:**
```tsx
const WorkflowCanvas = lazy(() => import("@/components/workflows/WorkflowCanvas").then((m) => ({ default: m.WorkflowCanvas })))
```

**The VANISH branch (`:520-575`)** — `canvasEnabled ? <toggle+child> : graphChild`. Every net-new
editing affordance lives inside the `canvasEnabled` branch, and the else-branch stays literally
`graphChild`:
```tsx
  // D-183-03 — the strip renders ONLY when the flag resolves strictly on. With the
  // flag off `graphChild` IS the grid's first child, exactly as it ships today: no
  // wrapper element, no strip, no reserved space, nothing of the canvas in the DOM.
```

**The panel mount to thread `rails` through (`:640-649`):**
```tsx
        <PhaseFormPanel
          phase={selectedPhase}
          open={panelOpen}
          folderName={boundFolderName ?? undefined}
          folderNames={folderNames}
          skillNames={skillNames}
          onChange={onPhaseChange}
          onPersist={onPersist}
          onClose={clearSelection}
        />
```
⇒ Add `{...(canvasEnabled ? { rails } : {})}` — spread-conditional so the prop is genuinely
ABSENT (not `undefined`) on the flag-off path.

**The publish seam (Pitfall 9)** — `:630`:
```tsx
          {renderPublish && <div>{renderPublish(state.definition, draftId)}</div>}
```
with its typed prop at `:125`:
```tsx
  renderPublish?: (def: BuilderDefinition, draftId: string | null) => React.ReactNode
```

---

### `scripts/dump-workflow-corpus.py` (script, file-I/O) — **NEW**

**Analog:** `scripts/repair_dirty_workflow_phases.py` — the shipped one-off DB script. Its
docstring is the template for D-184-17's provenance discipline:
```python
"""One-off idempotent repair of the 3 dirty workflow_phases rows (Plan 101.1-10 Task 1).
...
This script flips exactly those stuck `active` fill rows to 'failed'. It is:
  - SCOPED to exactly the 3 named run_ids (resolved by prefix from workflow_runs).
  - GATED on the predicate ... it will NEVER touch a gather/completed row ...
  - DRY-RUN by default: prints the rows it WOULD change. Requires an explicit `--apply`
    flag to mutate (refuses without it — the seed-fixture safety convention).
  - IDEMPOTENT: a second --apply run finds 0 rows to change ... and exits 0.
  - read-back asserted ...

It never deletes, never touches workflow_runs or harness_audit ... and connects directly
to the live local Supabase DB (:54322) — NEVER db push / db reset (the migration rule).
Identifier-only logging (run_id / phase_slug / phase_index) — never row content.

Usage:
    python scripts/repair_dirty_workflow_phases.py            # dry-run preview
    python scripts/repair_dirty_workflow_phases.py --apply    # mutate (idempotent)
"""

import psycopg2

# Local Supabase (the evidence/repair path from prior phases). Same DSN the seed
# fixtures + smoke harness use against the live local DB.
DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
```
⇒ The dump script is READ-ONLY (no `--apply` needed) but keeps: the module docstring stating
scope + safety, the same `DSN`, `psycopg2`, and **identifier-only output**. Add the redaction rule
(RESEARCH dump-rule 1): keep every key, replace free-text strings with `"…"` and UUIDs with stable
synthetic UUIDs.
⚠️ The local Supabase was **unreachable** at research time (`127.0.0.1:54322` refused). The
operator must run `supabase start` before this one-off step. Nothing in CI or the test loop needs
the DB.

---

### `frontend/src/components/workflows/__fixtures__/shapeGenerator.ts` (fixture) — **NEW**

**Analog:** `__fixtures__/canvasFixtures.ts` — its shape + the `CanvasFixture` interface at `:274+`:
```ts
export interface CanvasFixture {
  /** The snapshot key and the test name — stable, never renumber. */
  name: string
  phases: PhaseSpecJSON[]
  ...
}
```
and its per-fixture docblock convention (`:40-45`):
```ts
/** Canonical seed 1 — `research_summarize`: llm_agent → llm_single.
 *  Source: `backend/tests/conftest.py:852-866`; SQL `migrations/061_harness_seed_templates.sql:53-89`. */
export const researchSummarize: PhaseSpecJSON[] = [
  { slug: "research", phase_index: 0, config: { phase_type: "llm_agent" } },
  { slug: "summarize", phase_index: 1, config: { phase_type: "llm_single" } },
]
```
⚠️ **`canvasFixtures.ts` is NOT to be touched** (D-184-17 + CONTEXT note 2). Its own header
(`:11-23`) states the transcribed-never-read-live rule and the path convention whose whole purpose
is to avoid tripping its acceptance guard. The generator + dump are SEPARATE files that reuse the
`PhaseSpecJSON` type and the `{name, phases}` fixture shape, nothing more.

---

## Shared Patterns — the Wave-0-specific ones

### W0a. The D-184-07 icon swap touches FIVE places, verified this session

The swap is `llm_agent: "robot" → "compass"` and `llm_batch_agents: "busts-in-silhouette" → "handshake"`.

1. `frontend/src/components/workflows/soulData.ts:35-42` — the slug map (the string fallback):
```ts
export const PHASE_GLYPHS: Record<string, string> = {
  programmatic: "gear",
  llm_single: "memo",
  llm_agent: "robot",
  llm_batch_agents: "busts-in-silhouette",
  llm_human_input: "raised-hand",
  llm_emit: "package",
}
```
2. `frontend/src/lib/phaseGlyph.tsx:44-51` — the BUNDLED 3D component map:
```tsx
const PHASE_GLYPH_MARKS: Record<string, PhaseMark> = {
  programmatic: Gear,
  llm_single: Memo,
  llm_agent: Robot,
  llm_batch_agents: BustsInSilhouette,
  llm_human_input: RaisedHand,
  llm_emit: Package,
}
```
3. `frontend/src/lib/phaseGlyph.tsx:28-33` — the deep-subpath imports (a missing slug FAILS THE BUILD):
```tsx
import Gear from "~icons/fluent-emoji/gear"
import Memo from "~icons/fluent-emoji/memo"
import Robot from "~icons/fluent-emoji/robot"
import BustsInSilhouette from "~icons/fluent-emoji/busts-in-silhouette"
import RaisedHand from "~icons/fluent-emoji/raised-hand"
import Package from "~icons/fluent-emoji/package"
```
4. `frontend/src/lib/phaseGlyph.tsx:19-21` — the "verified slugs" docblock line (must be updated
or it lies — the D-ITEM-183-02 trap):
```
 *   - Only verified fluent-emoji slugs are used (API-checked 2026-06-27):
 *     gear, memo, robot, busts-in-silhouette, raised-hand, package.
```
5. `frontend/src/components/workflows/soulData.test.ts:128-136` — **the assertion that MUST change**:
```ts
  it("maps the 6 phase types to the verified fluent-emoji slugs exactly", () => {
    expect(PHASE_GLYPHS).toMatchObject({
      programmatic: "gear",
      llm_single: "memo",
      llm_agent: "robot",
      llm_batch_agents: "busts-in-silhouette",
      llm_human_input: "raised-hand",
      llm_emit: "package",
    })
```
⇒ **Pitfall 3 confirmed as real.** D-184-08's zero-assertion-edit gate must be scoped to the
EXTRACTION commits (0b, 0c). The icon commit (0a) carves this out explicitly, with its own
five-surface before/after check and its own revert story.
⇒ A swap of `soulData.PHASE_GLYPHS` ALONE leaves `phaseGlyph()` returning the OLD 3D component —
a silent split-brain. Both maps + both imports + the docblock + the assertion, one commit.

### W0b. The 181 revert gate that must stay green through Wave 0

`frontend/src/components/admin/revertByteIdentical.test.tsx` (161 L) — verified present. Its
scope-freeze assertions are also enforced by `scripts/check-181-scope-freeze.sh`. It does NOT
render `PhaseFormPanel`, which is why Pitfall 6 needs its own explicit assertion:
*"rendered without `rails`, the panel's DOM is unchanged from the shipped snapshot."*

### W0c. The extraction-honesty docblock (the anti-drift template)

`phaseVocabulary.ts:17-29` — the ONLY correct way to claim an extraction in code. Copy this
literal form for `definitionOps.ts` / `nodePresentation.ts` / `PhaseNodeCard.tsx`:
```
 * STATE OF THE EXTRACTION — read this literally, it is not a claim about the
 * future: **plan 183-04 performed the hard cut**. `PhaseSpineGraph.tsx` no longer
 * declares a glyph map, a type-label map, the read shapes, the on-fail parse or a
 * node-title resolver — it imports them from here (and the icon vocabulary from
 * `soulData`), with NO re-export shim left behind. Its five importers were
 * repointed in that same commit.
 *
 * This paragraph is kept honest by machine, not by habit: `?raw` source guards in
 * `PhaseSpineGraph.test.tsx` and `PhaseSpine.test.tsx` fail the moment a second
 * copy of the glyph map or the parse reappears anywhere. In-code claims of a prior
 * extraction are the exact anti-drift hazard 183-CONTEXT warns about — soulData.ts's
 * own header asserted an extraction that had not happened — so treat this sentence
 * as true only because those guards are green.
```
⇒ Rule for 184: **an extraction claim in a docblock must name the `?raw` guard that keeps it
honest.** No guard ⇒ no claim.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `frontend/src/components/workflows/__fixtures__/corpusDump.json` | fixture (data artifact) | n/a | No committed JSON data artifact exists anywhere in `frontend/src`. The closest concept is `__fixtures__/skipParseCases.json` (the cross-language skip-parse table read by BOTH vitest and `backend/tests/unit/test_183_skip_parse_parity.py`) — that supplies the *committed-JSON-read-by-a-test* precedent but not the provenance-header shape. Use RESEARCH §Code Examples' `_provenance` block as the spec. |
| `zundo` `temporal` middleware wiring | store middleware | event-driven | The one net-new dependency; nothing in the repo uses it. `streamsStore.ts:37` (`subscribeWithSelector`) is the only zustand-middleware precedent and only shows the curried v5 call position. Follow RESEARCH §Pattern 2 verbatim, and prove A3's `handleSet` selective-flush with a store unit test BEFORE building the toolbar on it. |
| The `dy` axis-split drop resolver (`resolveDrop`) | utility | transform | No drag-resolution analog exists — 183 shipped `nodesDraggable={false}`. RESEARCH §Pattern 6 supplies the algorithm; extract it as a PURE function so it is testable (drag itself is untestable in jsdom — §S8). Its module home should be `definitionOps.ts` or a sibling pure module, never `WorkflowCanvas.tsx`. |

---

## Line-number corrections (anti-drift — the planner MUST use these)

Every number below was re-derived from the file this session. Where CONTEXT/RESEARCH disagreed,
the file wins.

| Cited in | Claim | Verified reality |
|---|---|---|
| CONTEXT `<canonical_refs>` + D-184-06 | `PhaseNode.tsx` exports **`PHASE_TINTS`** at `:114` | The identifier is **`ICON_TINT`**, declared at **`:113`** (plus `DEFAULT_TINT` at `:122`). There is no `PHASE_TINTS` anywhere in the repo. |
| CONTEXT `<canonical_refs>` + D-184-06 | `PhaseNode.tsx` exports **`GROUNDING_TONES`** at `:138` | The identifier is **`GROUNDING_TONE`** (singular), declared at **`:137`**. |
| D-184-01 | `WorkflowBuilderPage`'s `useState<BuilderState>` at **`:100`** | It is at **`:151`**. (`:100-105` is the `BuilderInitial` interface; the `BuilderState` union is `:107-111`.) |
| CONTEXT `<canonical_refs>` | `handleSelectNode` `:204` · `clearSelection` `:212` · Escape listener `:216` | `handleSelectNode` **`:205`** · `clearSelection` **`:213`** · the Escape `useEffect` **`:224-231`** (its comment block starts `:217`). `onPhaseChange:334`, `onPersist:353`, `onSaveDraft:378` are **correct**. |
| RESEARCH Pitfall 10 | `backToLibrary` at `WorkflowsPage.tsx:311-318` | `backToLibrary` is defined at **`:290-294`**; `:314-318` is the `← Workflows` button JSX. |
| RESEARCH §CANVAS-02 | `createWorkflowDraft` `api.ts:3313` / `updateWorkflowDraft` `:3339` | The `export async function` lines are **`:3314`** and **`:3340`** (CONTEXT is correct; RESEARCH is off by one — those are the docblock lines). |
| RESEARCH §"read-only opt-outs" | `WorkflowCanvas.tsx:302-314` | The opt-out block is **`:302-310`**; `:311-315` are `fitView`/zoom/`colorMode`. |
| — | `indexGap` fixture at `canvasFixtures.ts:265-269` | **Confirmed correct** (`:265-269`, declared `[0, 1, 3]`, docblock `:260-264`). |
| — | `zustand@5.0.13` a direct dep at `package.json:49` | **Confirmed** (`"zustand": "^5.0.13"`). `zundo` **confirmed absent** (0 occurrences). `@xyflow/react: "^12.11.2"`, `react: "^19.2.4"` confirmed. |
| — | `PhaseFormPanel` conditions on `phase.config.phase_type` at `:431` | **Confirmed** (`const pt = phase.config.phase_type`). `onClose` required at `:73`; `friendlyToolName` at `:387`. |
| — | `toCanvas` `:214` · `CANVAS_LAYOUT` `:62` · `CANVAS_NODE_TYPES` `:82` · `PhaseNodeData` `:108` · `CanvasProjection` `:154` · `buildPhaseData` `:187` · sort `:221-223` | **All confirmed.** |
| — | `WorkflowCanvasProps` `:164` · `renderPhaseMark` `:159` · `PhaseNode` `:171` · `UnresolvedSkipNode` `:278` · `EndCapNode` `:311` | **All confirmed.** |
| — | Guard lines: `WorkflowCanvas.test.tsx:426` · `WorkflowBuilderPage.canvas.test.tsx:416` | **Both confirmed** (`:426` = `not.toMatch(/workflows\/validate/)`; `:416` = `not.toMatch(/localStorage/)`). |

**Extraction claims verified (CONTEXT note 3 discipline):**
- `phaseVocabulary.ts`'s claim that plan 183-04 performed the hard cut on `PhaseSpineGraph.tsx` —
  **verified honest** (independently re-confirmed by RESEARCH's `grep`; no duplicate glyph map survives).
- `PhaseNode.tsx:46-55` claims *"NO `PHASE_GLYPHS` slug is swapped here"* — **verified true**;
  `PhaseNode.tsx` imports `PHASE_GLYPHS` from `soulData` (`:69`) and never redeclares it.
- `streamsStore.ts` is the **only** zustand store — verified by grep (2 hits, one file).
- `usePanelReconcile.ts` is the **only** in-hook fetch — verified by its own docblock claim
  (*"there is no in-hook fetch analog"*) and by inspection of `frontend/src/hooks/`.

---

## Metadata

**Analog search scope:** `frontend/src/components/workflows/`, `frontend/src/components/panel/`,
`frontend/src/components/org/`, `frontend/src/components/admin/`, `frontend/src/hooks/`,
`frontend/src/lib/`, `frontend/src/stores/`, `frontend/src/providers/`, `frontend/src/pages/`,
`frontend/src/test-utils/`, `frontend/src/__tests__/`, `scripts/`
**Files read in full or in targeted ranges:** 24
**Pattern extraction date:** 2026-07-26

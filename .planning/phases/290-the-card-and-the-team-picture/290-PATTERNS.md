# Phase 290: The Card and the Team Picture - Pattern Map

**Mapped:** 2026-10-21
**Files analyzed:** 22 (13 new, 9 modified; plus the close-out docs)
**Analogs found:** 22 / 22. Every new file has an in-repo analog. The only gap is the measured SVG line layer, which has no ResizeObserver precedent in `components/` (see "No Analog Found").

All paths are relative to the repo root. `W/` = `frontend/src/components/workflows/`, `L/` = `frontend/src/components/workflows/library/`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `W/teamPicture.ts` (new) | utility (pure derivation) | transform | `W/canvasModel.ts` `toCanvas` (:569-700) + `L/cardFace.ts` (leaf shape) | exact |
| `W/teamVocabulary.ts` (new) | config (vocabulary leaf) | static | `W/decisionsVocabulary.ts` (zero-import leaf with functions) | exact |
| `W/TeamPicture.tsx` (new) | component (read-only graph) | request-response (props → DOM) | `W/PhaseSpineGraph.tsx` (`<ol>` of nodes, `aria-hidden` line spans, skip-edge data attrs) | role-match |
| `W/__fixtures__/teamFixtures.ts` (new) | test fixture | static | `W/__fixtures__/canvasFixtures.ts` | exact |
| `W/teamPicture.test.ts` (new) | test (pure) | transform | `W/canvasModel.purity.test.ts` + `L/cardFace.test.ts` | exact |
| `W/teamVocabulary.test.ts` (new) | test (vocab fence) | static | `W/decisionsVocabulary.test.ts` | exact |
| `W/WorkflowCanvas.headerPin.test.tsx` (new) | test (characterization pin) | snapshot | `L/__tests__/WorkflowCard.seam286.pin.test.tsx` + `renderCanvas` in `W/WorkflowCanvas.test.tsx:124-160` | exact |
| `W/TeamPicture.test.tsx` (new) | test (render + a11y) | request-response | `W/WorkflowCanvas.test.tsx` (axe at :599) | role-match |
| `W/WorkflowCanvas.team.test.tsx` (new) | test (render + keyboard) | event-driven | `W/WorkflowCanvas.editing.test.tsx:265-300` (⌥→ reorder) | exact |
| `L/stepLine.ts` (new) | utility (pure resolver) | transform | `L/cardFace.ts` + `W/PhaseSpine.tsx:39-41` sort idiom | exact |
| `L/StepChipLine.tsx` (new) | component (owns one `useState`) | event-driven (local toggle) | `W/FieldGuidance.tsx` (the one-useState disclosure) + `W/PhaseSpine.tsx` (glyph render) | exact |
| `L/stepLine.test.ts` (new) | test (pure) | transform | `L/cardFace.test.ts` | exact |
| `L/StepChipLine.test.tsx` (new) | test (render + userEvent) | event-driven | `W/DraftArrivalCard.test.tsx:1134-1150` | exact |
| `L/WorkflowCard.tsx` (mod) | component (card) | request-response | in-file: `templateAdmission(row.def)` (:946) and the conditional automation block (:1161-1180) | exact (self) |
| `L/libraryVocabulary.ts` (mod) | config (vocabulary) | static | in-file: `automationMoreCount` (:764) | exact (self) |
| `L/librarySubtree.fences.test.ts` (mod) | test (fence) | static | in-file: `LIBRARY_SUBTREE_PATHS` (:81-123) + length pin (:171) | exact (self) |
| `L/WorkflowCard.test.tsx` (mod) | test | request-response | in-file child-order pins (:787-808) | exact (self) |
| `L/__tests__/__snapshots__/WorkflowCard.seam286.pin.test.tsx.snap` (mod) | test snapshot | snapshot | 286-04 pin (:150-155) | exact (self) |
| `W/WorkflowCanvas.tsx` (mod) | component (canvas) | event-driven | in-file: the `nodes.length === 0` early return (:1386-1446), the keyboard effect (:1143-1200), the header (:1252-1278) | exact (self) |
| `frontend/src/pages/WorkflowBuilderPage.tsx` (mod) | page | request-response | in-file: the `<WorkflowCanvas` call (:2052-2077); tablist style from `builder-view-toggle` (:2099-2140) | exact (self) |
| `docs/HOT-FILE-LEDGER.md`, `CLAUDE.md`, `scripts/vitest-count-gate.cjs` (mod, close-out) | config / docs | batch | `.planning/phases/286-seams-before-features/286-05-PLAN.md` | exact |
| `.planning/reported-bugs/BUG-…md` (new, escalated-seal drift F-2) | docs | — | `.planning/reported-bugs/TEMPLATE.md` | exact |

---

## Pattern Assignments

### `W/teamPicture.ts` (utility, transform): the D-11 derivation

**Analog:** `W/canvasModel.ts` (`toCanvas`). It is the same kind of thing: a pure projection of `PhaseSpecJSON[]` plus injected `kbTools` and `nameContext`, which already guards skip targets and prototype keys. Copy the leaf header discipline from `L/cardFace.ts:17-27` (no React, no `@/lib/api`, no clock).

**Imports pattern** (`canvasModel.ts:44-58`). Import the helpers by name from `phaseVocabulary`. Never re-implement them:
```typescript
import {
  actionRiskArmed,
  branchConditionOf,
  groundingCauseOf,
  nodeTitle,
  notConnectedOf,
  parseSkipTarget,
  technicalTitle,
  waitsForYou,
  PHASE_TYPE_SUBTITLES,
  type NameContext,
  type PhaseSpecJSON,
} from "@/components/workflows/phaseVocabulary"
```
For `teamPicture.ts` the set is: `actionRiskArmed`, `groundingCauseOf`, `nodeTitle`, `parseSkipTarget`, `technicalTitle`, `PHASE_TYPE_SENTENCES`, `PHASE_TYPE_SUBTITLES`, `type NameContext`, `type PhaseSpecJSON`. Add `own` from `@/components/workflows/ownProperty`, `GOVERNANCE_SEAL_LABEL` from `@/components/workflows/definitionOps`, and the strings from `./teamVocabulary`.

**Frozen default injections** (`canvasModel.ts:569-586`). Copy verbatim, so an omitted option gives the same reference on every call:
```typescript
export interface ToCanvasOptions {
  kbTools?: readonly string[]
  nameContext?: NameContext
}
const NO_KB_TOOLS: readonly string[] = Object.freeze([])
const NO_NAME_CONTEXT: NameContext = Object.freeze({})
```

**Ordering + lookup maps** (`canvasModel.ts:596-606`). This is the comparator RESEARCH tells the picture to use, so Steps and Team agree:
```typescript
if (!phases || phases.length === 0) return { nodes, edges }
// Total, order-independent ordering: phase_index first, slug as the tiebreak.
const ordered = [...phases].sort(
  (a, b) => a.phase_index - b.phase_index || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0),
)
const bySlug = new Map(ordered.map((p) => [p.slug, p]))
```
A `Map` and never an object literal, because slugs are author input (`constructor`). See the docblock at `PhaseSpineGraph.tsx:245-258`.

**Skip-edge rule** (`canvasModel.ts:671-684`). This is the ONLY step-to-step line source. Mirror it for `kind: "jump"` and draw no stub (the picture writes `FAIL_JUMP_MISSING` instead):
```typescript
for (const validator of phase.validators ?? []) {
  const target = parseSkipTarget(validator?.on_failure)
  if (target === null) continue
  if (bySlug.has(target)) {
    pushEdge({ id: `skip:${phase.slug}->${target}`, source: phase.slug, target, data: { kind: CANVAS_EDGE_KINDS.skip } })
    continue
  }
  // unresolvable → canvas draws a stub; the team picture draws NOTHING and words it
}
```
⚠ `canvasModel` reads `phase.validators ?? []`, which trusts the type. `teamPicture` must use `Array.isArray(p.validators) ? p.validators : []`, because the D-11 totality list includes non-array validators.

**Totality guards the analog does NOT have (RESEARCH "Totality", F-2):** `technicalTitle` (`phaseVocabulary.ts:305-309`) and `groundingCauseOf` (`:465-475`) read `phase.config.*` unguarded and THROW on a config-less phase:
```typescript
export function technicalTitle(phase: PhaseSpecJSON): string {
  const type = phase.config.phase_type
  const label = PHASE_TYPE_LABELS[type] ?? type      // bracket read, not own()
  return `${label} · ${phase.slug}`
}
```
Guard with `typeof p?.config === "object" && p.config !== null` before calling either. Derived citations check: `groundingCauseOf(p, kbTools) === "detected"` ONLY (F-2). Armed check: `actionRiskArmed(p)` (`:512`, `=== true`).

**Keyed reads** (`ownProperty.ts:82-86`). Use `own()` for every keyed read: `PHASE_TYPE_SENTENCES`, `PHASE_TYPE_SUBTITLES`, `GATE_KIND_WORDS`:
```typescript
export function own<T>(table: Record<string, T>, key: string): T | undefined {
  return Object.prototype.hasOwnProperty.call(table, key) ? (table as Record<string, T>)[key] : undefined
}
```

**Leaf header / ordering convention** (`cardFace.ts:17-21`): *"exported aliases first, then the exported interface, one docblock per member, then the table, then the function."* RESEARCH Pattern 1 gives the `deriveTeam` / `TeamLine` / `failureWords` shapes. F-3 failure words, F-4 `config.criteria`.

---

### `W/teamVocabulary.ts` (config, static)

**Analog:** `W/decisionsVocabulary.ts`. It is a `.ts` vocabulary module beside its surface, holds functions as well as constants, and imports NOTHING (asserted by its suite).

**Why its shape fits** (`decisionsVocabulary.ts:11-23`): *"Three of the values below are functions … A `.ts` vocabulary module beside its surface is the shipped answer (`libraryVocabulary.ts`, `templateFirstVocabulary.ts`)."* and *"This module imports NOTHING — asserted in `decisionsVocabulary.test.ts` … a zero-import leaf is what makes this subtree's cycle risk one-directional."*

**Recommendation (planner's call):** keep `teamVocabulary.ts` a TRUE zero-import leaf. Compose `GOVERNANCE_SEAL_LABEL` and the `PHASE_TYPE_SENTENCES` step words in `teamPicture.ts`, never here. That is the same "a leaf cannot compose what it cannot import" consequence `decisionsVocabulary.ts:26-30` records. It also satisfies D-15 (no second copy of step words) by construction.

**Entry style** (`decisionsVocabulary.ts:147-172`): exported `const` strings with one-line docblocks, plus small total formatter functions:
```typescript
export function groundingFoldSummary(count: number): string { … }
export const DECISION_KB_NONE = "No documents — this workflow reads nothing of yours."
```
Plural via a separate arm, not string surgery. Compare the house note at `libraryVocabulary.ts:747-749`.

**Hard constraints from sweeps that will read this file:**
- `W/governanceVocabulary.test.ts:65-86` globs EVERY non-test `W/*.{ts,tsx}` (so `teamVocabulary.ts`, `teamPicture.ts` and `TeamPicture.tsx` are all swept) and bans (`:131-151`):
```typescript
const RETIRED_BADGE_STRINGS = [ tok("Must cite its ", "sources"), tok("Flags un", "cited claims"), tok("No sources ", "needed") ]
const BANNED_WORDS = [ tok("Prov","en"), tok("Ungov","erned"), tok("Unch","ecked"), tok("Not ","applicable"), tok("N","/A"), tok("trace","able") ]
const OVERCLAIM_PHRASES = [ tok("every value ","trace","able"), tok("everything it says ","is checked") ]
```
So UI-SPEC §3.6's `GATE_KIND_WORDS.citations_required = "Must cite its sources"` must be replaced (F-5).

---

### `W/TeamPicture.tsx` (component, read-only render)

**Analog:** `W/PhaseSpineGraph.tsx`. It is the house read-only graph built from the definition: an `<ol>` of steps, `aria-hidden` decorative lines, and a skip edge carried as data attributes plus visible words.

**Imports pattern** (`PhaseSpineGraph.tsx:132-153`):
```typescript
import { PHASE_GLYPHS } from "@/components/workflows/soulData"
import { nodeTitle, parseSkipTarget, PHASE_TYPE_LABELS, PHASE_TYPE_SUBTITLES, type NameContext, type PhaseSpecJSON } from "@/components/workflows/phaseVocabulary"
import { phaseGlyph } from "@/lib/phaseGlyph"
import { cn } from "@/lib/utils"
```
`TeamPicture.tsx` should import `deriveTeam` from `./teamPicture`, the strings from `./teamVocabulary`, `phaseGlyph`, and `cn`. RESEARCH Pattern 3: `TeamPicture` owns `useMemo(() => deriveTeam(phases, kbTools, nameContext), …)`, so the canvas gains no memo.

**Structure: list semantics, decorative line hidden** (`PhaseSpineGraph.tsx:334, 441-449`):
```tsx
<ol className="relative mx-auto flex w-full max-w-[680px] flex-col">
  {ordered.map((phase, i) => (
    <li key={phase.slug} className="relative pb-4 last:pb-0">
      {!isLast && (
        <span aria-hidden="true" className="absolute left-[28px] top-[34px] bottom-0 z-0 w-px border-l border-dashed border-border" />
      )}
```
⚠ Diverge on ONE point: the analog's node is a `<button>` (`:453-470`). UI-SPEC §3.8 forbids any focusable or clickable node in the picture, so use a plain element.

**Glyph render with fallback** (`PhaseSpineGraph.tsx:444-445, 476-484`):
```tsx
const Glyph = phaseGlyph(phase.config.phase_type)
{Glyph ? <Glyph className="h-3.5 w-3.5" /> : glyphFallback}
```
UI-SPEC says an unknown type renders NO glyph (no `•`). Drop the `PHASE_GLYPHS[...] ?? "•"` fallback here, and in the chip line too.

**Skip edge as data attrs + words** (`PhaseSpineGraph.tsx:677-686`). This is the model for `data-line-kind` / `data-line-source`, with the relationship also stated in text:
```tsx
<div key={`${edge.fromSlug}->${edge.toSlug}`} data-testid="skip-edge" data-from-slug={edge.fromSlug} data-target-slug={edge.toSlug}
     className="… border-dashed border-amber-500/70 … text-amber-600 dark:text-amber-400">
  <span aria-hidden="true">⤳</span>
```
Use the theme token `text-warning` per UI-SPEC Color, not the analog's `amber-*` literals.

**XSS rule** (`PhaseSpine.tsx:13-14`): *"every authored string … is rendered as a plain React text child / `title=` attribute value — never `dangerouslySetInnerHTML`."* The ⌥ ledger `source` strings follow the same rule.

---

### `W/__fixtures__/teamFixtures.ts` (test fixture)

**Analog:** `W/__fixtures__/canvasFixtures.ts`. IMPORT its exports and never edit them (they feed many suites and snapshot blocks).

**Header discipline** (`canvasFixtures.ts:1-18`): *"TRANSCRIBED, NEVER READ LIVE … Every entry below … carries a JSDoc line naming that artifact by `file:line` … This module performs no I/O of any kind."* Hand-authored shapes say so explicitly (`:290-295`, branching: *"hand-authored, test-only … NO database row is seeded from this"*).

**Entry shape** (`canvasFixtures.ts:84-95`):
```typescript
/** Canonical seed 2 — `plan_execute_verify` … Source: `backend/tests/conftest.py:867-892`… */
export const planExecuteVerify: PhaseSpecJSON[] = [
  { slug: "plan", phase_index: 0, config: { phase_type: "llm_single" } },
  { slug: "execute", phase_index: 1, config: { phase_type: "llm_agent" } },
  { slug: "verify", phase_index: 2, config: { phase_type: "llm_single" }, validators: [{ kind: "regex_match", on_failure: "retry" }] },
]
```
Reuse as-is: `researchSummarize`, `planExecuteVerify`, `literatureReview` (`max_parallel_agents: 5`), `docQaHuman`, `singlePhase`, `emptyDraft`, `branching` (one resolvable `skip_to_phase:escalate`), `unresolvableSkip`. Plant only what is missing (UI-SPEC §5): the 7-step all-types stress fixture with a judge carrying `config.criteria`, batch-20, malformed (`constructor` type, unknown kind, `skip_to_phase:gone`, no `config`), grounded 3-step (`available_tools: ["search_documents"]`), armed `external_action`.
⚠ Needs a hot-file ledger row (RESEARCH: `__fixtures__/` is NOT exempt from `check-hot-file-ledger.cjs`).

---

### `W/teamPicture.test.ts` (test, pure)

**Analog:** `W/canvasModel.purity.test.ts` + `L/cardFace.test.ts`.

**Source-fence + import pattern** (`canvasModel.purity.test.ts:14-24`):
```typescript
import { describe, it, expect } from "vitest"
import canvasModelSource from "./canvasModel?raw"
import { toCanvas, CANVAS_LAYOUT } from "./canvasModel"
import { ALL_FIXTURES, evalCoverage } from "./__fixtures__/canvasFixtures"
import type { PhaseSpecJSON } from "./phaseVocabulary"
```
**Determinism / non-mutation sweeps** (`:52-70`):
```typescript
it.each(ALL_FIXTURES)("$name projects byte-identically across two calls", ({ phases }) => {
  expect(JSON.stringify(toCanvas(phases))).toBe(JSON.stringify(toCanvas(phases)))
})
it.each(ALL_FIXTURES)("$name: the input is deep-equal to its pre-call clone", ({ phases }) => {
  const before = clone(phases); toCanvas(phases); expect(phases).toEqual(before)
})
```
Sweep `ALL_FIXTURES` with `deriveTeam` and assert: 0 lines whose `from` and `to` are both steps unless `kind === "jump"`, and `jump` count equals the resolvable-skip count (V1-1/V1-2).

**Every negative carries a positive control** (`cardFace.test.ts:16-19`): *"An assertion that a needle finds nothing passes identically when the needle is broken … Each sweep below is therefore run a second time over a synthetic source that DOES contain the violation."* Apply it to the "no `@/lib/api` / no React import" fence over `teamPicture?raw` (security V4), and to the "no step-to-step line" assertion: plant a jump and prove the detector finds it.

---

### `W/teamVocabulary.test.ts` (test, vocabulary fence)

**Analog:** `W/decisionsVocabulary.test.ts`.

**Zero-import leaf fence with positive controls** (`decisionsVocabulary.test.ts:316-331`):
```typescript
it("imports nothing at all — not a component, not React, not a type", () => {
  const ANY_IMPORT = /^\s*import\s/m
  const ANY_FROM = /from\s+["'][^"']+["']/
  const DYNAMIC_IMPORT = /import\s*\(/
  expect('import type { DecisionRowKey } from "./x"').toMatch(ANY_IMPORT)
  expect('import type { DecisionRowKey } from "./x"').toMatch(ANY_FROM)
  expect('const m = await import("./x")').toMatch(DYNAMIC_IMPORT)
  expect(decisionsVocabularySource).not.toMatch(ANY_IMPORT)
  expect(decisionsVocabularySource).not.toMatch(ANY_FROM)
  expect(decisionsVocabularySource).not.toMatch(DYNAMIC_IMPORT)
})
```
**Formatter totality over hostile numbers** (`:153-176`): `[NaN, ±Infinity, -1, 0]`, with 1 and 2 giving distinct non-empty strings. Use it for `orchestratorTitle(n)`, `seatsLabel(n)`, `failRetry(n)` and `gateEyebrow`. Exact-match assertions only (`libraryVocabulary.ts:14-17`).

Also run `W/governanceVocabulary.test.ts` in this task's verify step (F-5).

---

### `W/WorkflowCanvas.headerPin.test.tsx` (characterization pin, committed BEFORE any `WorkflowCanvas.tsx` edit)

**Analog:** `L/__tests__/WorkflowCard.seam286.pin.test.tsx`, the 286-04 pin-before-move habit.

**Docblock contract to copy** (`WorkflowCard.seam286.pin.test.tsx:4-6`): *"Written and committed against the UNMOVED card, BEFORE … The move commit must leave this file and its `.snap` byte-unchanged (empty numstat). If a line here has to change for the move to pass, the move changed behaviour and the SOURCE is wrong."*

**Snapshot idiom** (`:150-155`):
```typescript
describe("286-04 pin — the resting card's DOM, per row state", () => {
  it.each(STATES)("$label renders byte-identical DOM at rest", ({ row, hasExistingFork }) => {
    const { card } = renderCard(row, { hasExistingFork })
    expect(card.outerHTML).toMatchSnapshot()
  })
})
```
**Render harness to copy** (`WorkflowCanvas.test.tsx:28, 115, 124-160`): `mockReactFlow()` is FILE-LOCAL and called before the first render. The canvas needs a sized parent:
```tsx
import { mockReactFlow } from "@/test-utils/mockReactFlow"
mockReactFlow()
const ui = (
  <div style={{ width: 1200, height: 800 }}>
    <WorkflowCanvas phases={phases} selectedSlug={opts.selectedSlug ?? null}
      onSelectNode={opts.onSelectNode ?? vi.fn()} onClearSelection={opts.onClearSelection ?? vi.fn()}
      kbTools={opts.kbTools} runState={opts.runState} editable={opts.editable} />
  </div>
)
return render(opts.provider ? <TechnicalNamesProvider>{ui}</TechnicalNamesProvider> : ui)
```
Pin the `<section>`'s header `outerHTML` (editable and read-only, with and without the provider, since the ⌥ toggle renders only with a provider at `:1273-1275`). Pin an empty and a non-empty definition, because both branches render `{header}`.

---

### `W/TeamPicture.test.tsx` / `W/WorkflowCanvas.team.test.tsx` (render tests)

**Analog for a11y:** `WorkflowCanvas.test.tsx:599`: `expect(await axe(container)).toHaveNoViolations()` (vitest-axe is global via `setupTests.ts`).

**Analog for the F-6 keyboard proof** (`WorkflowCanvas.editing.test.tsx:265-283`):
```typescript
it("⌥→ on a selected middle step commits ONCE with the expected order and SAYS so", () => {
  const onCommitNodes = vi.fn()
  const { container } = renderCanvas(evalCoverage, { editable: true, selectedSlug: "fanout", onCommitNodes })
  const node = container.querySelector('.react-flow__node[data-id="fanout"]')!
  fireEvent.keyDown(node, { key: "ArrowRight", altKey: true })
  expect(onCommitNodes).toHaveBeenCalledTimes(1)
```
⚠ In Team mode the plane is unmounted, so no `.react-flow__node` exists. The handler is a WINDOW listener (`WorkflowCanvas.tsx:1198`), so fire on `window` or `document.body` in BOTH arms: Steps (positive control, called once) and Team (not called). Firing on a node in Steps and on body in Team would make the two arms unequal.

**Rendered-content assertions** (G-8 lesson): assert the `data-line-kind` SET equals `deriveTeam(...).lines` kinds, plus absence text (`TEAM_NO_GATES`, `TEAM_ONE_STEP`), and the absence of the ⤳ label text on a no-skip workflow. Never testids alone.

---

### `L/stepLine.ts` (utility, pure resolver)

**Analog:** `L/cardFace.ts`. It is the card's one value-only face decision. Its input is the row's data and nothing else, and it imports words rather than spelling them.

**Header claims to mirror** (`cardFace.ts:17-21`): *"NO React import, NO `@/lib/api` import, no side effect, no clock, no I/O."* `stepLine` needs no `now` parameter.

**Sort idiom (stable, array order on ties)** (`PhaseSpine.tsx:39-41`). This is the card's comparator per RESEARCH:
```typescript
const ordered = [...(def?.phases ?? [])].sort((a, b) => (a.phase_index ?? 0) - (b.phase_index ?? 0))
```
⚠ Upgrade `def?.phases ?? []` to `Array.isArray(def?.phases) ? … : []`. `defOf` is an unchecked cast (RESEARCH "Where the card gets its phases"), and `phase_type` lives at `phase.config.phase_type` (`soulData.ts:89-95` `DefShape`).

**Floor rule to NOT copy** (`PhaseSpine.tsx:78`): `p.name?.trim() || p.slug || PHASE_TYPE_SENTENCES[type]`. D-04 forbids the author name and the slug on chips, and the bracket read is a WR-04 sink. Use `own(PHASE_TYPE_SENTENCES, type) ?? type` (RESEARCH "Chip words and order").

**Absence is explicit** (`cardFace.ts:59-65`): return `null` for zero steps (D-01). Never an empty chips array the card has to test.

---

### `L/StepChipLine.tsx` (component, owns the one local `useState`)

**Analog:** `W/FieldGuidance.tsx`. It exists to OWN a disclosure `useState`, so its parent's hook count stays pinned. That is exactly the ledger's *"card holds 0 `useState`, drawing only"* rule.

**Rationale to quote** (`FieldGuidance.tsx` import comment): *"The `useState` below deliberately did NOT move: it is the entire reason this file exists, because `PhaseFormPanel`'s hook count is pinned at an absolute zero."*

**Toggle pattern** (`FieldGuidance.tsx`):
```tsx
const [shown, setShown] = useState(false)
<button type="button" data-testid="field-guidance-toggle" aria-expanded={shown}
  onClick={() => setShown((current) => !current)} className="… rounded border border-border px-1.5 py-0.5 …">
  {shown ? FIELD_GUIDANCE_HIDE : FIELD_GUIDANCE_SHOW}
</button>
```
For the chip line: `aria-expanded`, an accessible name from `stepLineMoreLabel(n)`, and visible text `stepLineMore(n)` / `STEP_LINE_LESS`. The words come from `./libraryVocabulary` (the card subtree's words home). No literal string.

**Glyph per chip:** `phaseGlyph(type)` at 16px, `aria-hidden`, with no fallback mark (UI-SPEC §1.2). See the `Glyph ? <Glyph/> : …` idiom above.

**Constraints:**
- ⛔ **No `title=` attribute anywhere** (F-1). The `L/librarySubtree.fences.test.ts` F1 sweep (`:272-299`) parses every listed module and fails on any JSX `title`. UI-SPEC §1.2's `title={words}` is overruled.
- ⛔ Do NOT reuse `PhaseSpine` / `WorkflowSoul`. That re-emits the cut `soul-spine` testid and changes `StarterTemplatePicker.tsx` / `WorkflowDoorSwitch.tsx`.
- Root `data-testid="row-steps"`.

---

### `L/stepLine.test.ts` / `L/StepChipLine.test.tsx`

**Analogs:** `L/cardFace.test.ts` (pure, `?raw` purity fence with positive control, `toEqual<Type>` whole-object assertions at `:43-56`) and `W/DraftArrivalCard.test.tsx:1134-1150` (toggle):
```typescript
const user = userEvent.setup()
const toggle = screen.getByTestId("draft-arrival-source-toggle")
expect(toggle).toHaveTextContent(ARRIVAL_SOURCE_ACTION)
expect(toggle).toHaveAttribute("aria-expanded", "false")
await user.click(toggle)
expect(toggle).toHaveAttribute("aria-expanded", "true")
```
Content assertions: exact chip words from `PHASE_TYPE_SENTENCES`; none of `PHASE_TYPE_LABELS` values, `phase.name`, slug or type id appear (except the unknown-type raw floor); a `constructor` type gives a raw echo and no glyph (V4-4).

---

### `L/WorkflowCard.tsx` (modified: ONE block, one value)

**In-file analog for "derive from `row.def` in the card, no new prop"** (`WorkflowCard.tsx:934-946`):
```typescript
// ── NO NEW PROP, AND NOT A `RowIdentity` FIELD ──
// `row.def` is already on the row type, and an in-card derivation from `row` is the shipped practice…
const templateMark = templateAdmission(row.def) === "admits" ? [CARD_TEMPLATE_MARK] : []
```
→ `const stepLine = resolveStepLine(row.def)` sits beside it.

**In-file analog for "renders nothing when absent, so cards without it compose byte-identically"** (`:1158-1180`):
```tsx
{/* ⚠ IT STAYS SILENT ON EVERY UNSCHEDULED ROW. `automation.phrase === null` renders nothing at all … so 110 of 111 cards compose byte-identically and this column's by-child-order pins keep passing. */}
{automation.phrase !== null && ( <> … </> )}
```
→ `{stepLine && <StepChipLine line={stepLine} />}` inserted AFTER the `row-answer` `</div>` (closes at `:1181`) and BEFORE the `row-identity` comment block (`:1183`).

**Import placement** (`:280-293`). The local `./` imports are alphabetised: `automationFacts`, `cardFace`, `libraryFilter`, … `WorkflowCardMenu`. Add `./StepChipLine` and `./stepLine` in order.

**Child-order consequence:** the card column becomes `[0] name · [1] row-answer · [2] row-steps · [3] row-identity · [4] folder · [5] match`, on cards WITH steps only.

---

### `L/libraryVocabulary.ts` (modified: five entries)

**In-file analog** (`libraryVocabulary.ts:763-766`):
```typescript
/** `+2 more` — the OTHER active schedules, when the row carries more than one. */
export function automationMoreCount(n: number): string {
  return `+${n} more`
}
```
⚠ **Collision the planner must decide:** `stepLineMore(n)` (UI-SPEC §1.5) returns the SAME string as `automationMoreCount(n)`. A card with ≥2 schedules AND ≥4 steps renders two `+N more` texts, so `getByText("+1 more")` becomes ambiguous and the file's own *"EXACT-MATCH ASSERTIONS ONLY"* rule (`:14-17`) gets harder to keep. Either query scoped `within(row-steps)` in every test, or accept and document it. Do NOT reuse `automationMoreCount` for steps: one entry per meaning, and the D-14 one-line copy-change rule. Use the `STEP_LINE_` prefix, because `CHIP_WORDS` / `CHIP_ORDER` (`:56, :66`) already name the filter chips.

---

### `L/librarySubtree.fences.test.ts` (modified)

**In-file analog** (`:117-123` + `:171`). Each module is listed IN THE COMMIT THAT CREATES IT, with a dated comment:
```typescript
  // ── 286-04 (2026-10-18, REG-07 / D-08): the card's `⋯` menu + armed delete, moved out ──
  "./WorkflowCardMenu.tsx",
] as const
…
expect(LIBRARY_SUBTREE_PATHS).toHaveLength(15)
```
Add `./stepLine.ts` and `./StepChipLine.tsx`, and set the length pin to 17. The literal must be read from the failing diff before it is written (`:136-139` habit). There are five `it.each(LIBRARY_SUBTREE_PATHS)` sweeps (`:296, :318, :360, :577, :667`), so +2 modules = **+10 cases**. The count-gate pin moves to match.
⚠ New modules must not mention the F6 opaque draft field or any F7 creator-column identifier, because those scoping controls assert exact module lists (`docs/HOT-FILE-LEDGER.md` WorkflowCardMenu section).
ℹ Observation, not in scope: `L/automationFacts.ts` exists but is NOT in `LIBRARY_SUBTREE_PATHS`, so it is swept by nothing. Record it, do not fold it.

---

### `L/WorkflowCard.test.tsx` + `L/__tests__/__snapshots__/WorkflowCard.seam286.pin.test.tsx.snap` (modified, deliberate fence edits)

**Child-order pin to move** (`WorkflowCard.test.tsx:787-796`):
```typescript
expect(column.children).toHaveLength(4)
expect(column.children[1]).toBe(within(card).getByTestId("row-answer"))
expect(column.children[2]).toBe(line)          // → [3]
expect(column.children[3].textContent).toContain("Risk & Compliance")   // → [4]
```
The house precedent is the comment at `WorkflowCard.tsx:1077-1079`: *"`WorkflowCard.test.tsx`'s child-order assertions moved in the same wave, which is exactly what asserting placement by child order was for."* Fixtures: `DEF` (:114-127) has 2 phases → 2 chips; `NO_EMIT_DEF` (:141) → 1 chip; `EMPTY_PHASES_DEF` (:142) → no `row-steps`.
**Card pin:** its `DEF` has one `llm_agent` phase (`seam286.pin.test.tsx:48-56`), so all 5 resting `outerHTML` snapshots (`:150-155`) gain a one-chip block. Run with `-u`, show the `.snap` diff is ONLY that block, and record it as a "tests edited" entry. ⛔ Never stage `frontend/src/pages/__tests__/__snapshots__/*.seam286.pin.test.tsx.snap` (EOL-only noise).

---

### `W/WorkflowCanvas.tsx` (modified: one prop, one state, one effect condition, one branch, one mount)

**Prop addition**: an optional member at the END of `WorkflowCanvasProps` (after `session?` at `:658`), destructured after `session` (`:676`). Precedent: the `session` docblock *"Absent (the shipped read-only callers and both existing canvas suites) means no region at all"* (`:652-657`).

**Keyboard effect gate (F-6)** (`:1143-1144, 1199`):
```typescript
useEffect(() => {
  if (!editable || selectedSlug === null) return          // → add `|| teamShown`
  …
}, [editable, selectedSlug, phaseOrder, nodesWithMove, onCommitNodes])   // → add teamShown
```

**Header: tablist only when the prop is present** (`:1252-1276`). Insert the tablist between `<span className="flex-1" />` and the `TechnicalNamesToggle` ternary. Swap the left-side hint to the `👁 View only` arm when `teamShown`. Copy the segmented-control classes from `WorkflowBuilderPage.tsx:2099-2122`:
```tsx
<div data-testid="builder-view-toggle" role="tablist" aria-label="Graph view" className="flex items-center gap-1 …">
  <button type="button" role="tab" data-testid="builder-view-spine" aria-selected={activeGraphView === "spine"}
    onClick={() => setGraphView("spine")}
    className={cn("rounded-md px-3 py-1.5 text-[13px] transition-colors",
      activeGraphView === "spine" ? "bg-primary/10 font-semibold text-primary"
                                  : "text-muted-foreground hover:bg-accent/40 hover:text-foreground")}>
```
⚠ `WorkflowCanvas.tsx` does NOT import `cn` today (grep: 0 hits). Either add `import { cn } from "@/lib/utils"` or use the `[...].join(" ")` idiom `PhaseSpineGraph.tsx:466-471` uses. Testids are `canvas-view-steps` / `canvas-view-team`, and `aria-label` comes from `TEAM_SWITCH_LABEL` (`"Show steps or team"`, distinct from `"Graph view"`).

**One early return: copy the empty-draft branch's shape and place it BEFORE it** (`:1386-1391`):
```tsx
// D-183-11 — EARLY RETURN. Nothing below this line mounts on an empty definition.
if (nodes.length === 0) {
  return (
    <section aria-label={sectionLabel} className="flex h-full min-w-0 flex-col bg-background">
      {header}
      {noticeRegion}
```
→ `if (teamShown) return (<section aria-label={sectionLabel} className="flex h-full min-w-0 flex-col bg-background">{header}<TeamPicture … /></section>)`, with no `noticeRegion` and no `sessionRegion` (UI-SPEC §2: Team replaces them in place). Pass `showTechnical` (`:687`) down. Do not read the context a second time.
**Budget check against the ledger forecast** (CLAUDE.md row: *"286 forecast: 290 team picture is a separate view; ≤ 1 gated mount"*). Anything beyond prop + useState + effect condition + early return + mount is the signal to extract first.

---

### `frontend/src/pages/WorkflowBuilderPage.tsx` (modified: one prop)

**In-file analog** (`:2052-2077`). Every prop at this call carries a dated phase comment naming why it is here:
```tsx
<WorkflowCanvas
  phases={phases}
  …
  // 187-15 — the same context the spine gets; two views cannot name one step twice.
  nameContext={nameContext}
  …
  session={canvasSession}
/>
```
Add one `team={{ workflowName: … }}` line with a `// 290 —` comment. Use an inline expression from `meta`, never `identityLabel`, which is declared later at `:2527` (TDZ, RESEARCH). No new state (ledger: `useState` = 15).

---

### Close-out plan (`docs/HOT-FILE-LEDGER.md`, `CLAUDE.md`, `scripts/vitest-count-gate.cjs`, BUG report)

**Analog:** `.planning/phases/286-seams-before-features/286-05-PLAN.md`: Task 1 (`:102-135`, gates + count-gate adoption) and Task 2 (`:137-186`, ledger in ONE commit).

**Count-gate pin style** (`scripts/vitest-count-gate.cjs:600-615`): a dated comment naming the plan that grew the suite, and the figure read from the gate's printed `actual`:
```javascript
  // ⚠ AND A THIRD TIME IN THE SAME PLAN, 93 → 105, by its THIRD commit: …
  "WorkflowCanvas.test.tsx": 105,
```
Pins named in RESEARCH Wave 0: `WorkflowCard.test.tsx` 128, `librarySubtree.fences.test.ts` 133, `WorkflowCard.seam286.pin.test.tsx` 21, `WorkflowCanvas.test.tsx` 105. Re-derive every one from the gate. Never use these numbers as targets.

**Young-module scan-list row** (`docs/HOT-FILE-LEDGER.md:11955`), ≤ 200 chars:
```
| [`frontend/src/components/workflows/library/WorkflowCardMenu.tsx`](docs/HOT-FILE-LEDGER.md#…) | 1 / 1 / 473 | no (young) | young (286-04). ⋯ menu + armed draft delete + its prompt (`useDraftDelete`). ⛔ WR-03 five roles; D-18 endpoint rule; in `LIBRARY_SUBTREE_PATHS` |
```
**Young-module section** (`docs/HOT-FILE-LEDGER.md:22569-22571`): `### \`path\`` heading, then **`triple` — young (created 290-0N, date).** Provenance (sha), what it owns, ⛔ inherited invariants, "Does not fire." For the FIRING files (`WorkflowCard.tsx`, `WorkflowCanvas.tsx`, `WorkflowBuilderPage.tsx`, `libraryVocabulary.ts`), update the CLAUDE.md cell (≤ 80 chars) with `(was \`a / b / c\`)` and preserve the replaced cell in the section, as the `harness_engine.py` 286 section does (*"CLAUDE.md verdict cell as of … (replaced by 286-05)"*). Rows and sections go in the SAME commit.

**Seeds:** SEED-155 and SEED-086 already read `status: folded`, `partial: true`, `folded_into: "290"` (set at discuss). Close-out adds no routing edit unless the shipped scope differs. Do not re-fold.
**BUG report (F-2 escalated-seal drift):** `.planning/reported-bugs/TEMPLATE.md`, `surface: Agentic-RAG`, `status: open`, with a `re_open_trigger`. Do not fold it into 290.

---

## Shared Patterns

### Pure value-only leaf (applies to `teamPicture.ts`, `stepLine.ts`, `teamVocabulary.ts`)
**Source:** `L/cardFace.ts:17-27`, `W/canvasModel.ts:38-44` (type-only imports for runtime independence).
No React, no `@/lib/api`, no clock. Prove it with a `?raw` source fence that carries a positive control (`cardFace.test.ts:9-19`). A security V4 check asks for the same `@/lib/api` negative fence.

### Prototype-safe lookups
**Source:** `W/ownProperty.ts:82-86`, `lib/phaseGlyph.tsx:106-121`, `PhaseSpineGraph.tsx:245-258` (Map for slugs).
Use `own(TABLE, key)` for every presentation-map read, `Map` for slug → step, and `phaseGlyph()` (already own-guarded). A test plants `phase_type: "constructor"` / `kind: "__proto__"` and asserts the raw-string floor.

### Words live in vocabulary modules, exact-match tested
**Source:** `L/libraryVocabulary.ts:1-17`, `W/decisionsVocabulary.ts:1-23`.
The card's new strings go in `libraryVocabulary.ts`. The picture's strings go in `teamVocabulary.ts`. Step words are imported from `phaseVocabulary.ts` (never copied, D-15). `GOVERNANCE_SEAL_LABEL` is imported from `definitionOps.ts` (never re-spelled). Retired/banned-word sweep: `W/governanceVocabulary.test.ts:131-151`.

### Explicit-list fences widen in the creating commit
**Source:** `L/librarySubtree.fences.test.ts:72-80` (*"THE LIST IS WIDENED IN THE SAME COMMIT THAT ADDS A MODULE"*), mirrored by `CANVAS_SUBTREE_PATHS` at `W/WorkflowCanvas.test.tsx:105-109`.
Library modules join `LIBRARY_SUBTREE_PATHS`. Optional, planner's call: add `./TeamPicture.tsx` to `CANVAS_SUBTREE_PATHS`, so the canvas's negative fences (no `MiniMap`, no `workflows/validate`, no `grounding_mode`, no run-reading words, `:663-669, :939-955`) also cover the mounted picture. That edits an existing test, so record it.

### Characterization pin before a hot-file edit
**Source:** `L/__tests__/WorkflowCard.seam286.pin.test.tsx:1-22, 150-155`; ledger proof at `docs/HOT-FILE-LEDGER.md:796` (*"committed … ONE COMMIT BEFORE `cardFace.ts` existed … `git diff --numstat b1017d20 HEAD -- <pin>` reading empty"*).
Applies to `WorkflowCanvas.tsx`. The header pin lands in plan 01 (test-only), and plan 03 must show an empty numstat on it.

### Untrusted definition text rendered as JSX text only
**Source:** `W/PhaseSpine.tsx:13-14`; `L/librarySubtree.fences.test.ts:310-320` (`RAW_HTML = /dangerouslySetInnerHTML/` with a positive control).
Applies to `TeamPicture.tsx` (names, `criteria`, unknown kinds, `on_failure`, `data-line-source`). Add the same negative fence over the three new `W/` modules.

## No Analog Found

| File / part | Role | Data Flow | Reason |
|---|---|---|---|
| `W/TeamPicture.tsx`: the measured SVG line layer (rect measurement + `ResizeObserver`, recompute on ⌥ height change) | component | event-driven | No component in `frontend/src/components` constructs a `ResizeObserver` (grep: 0). The closest measurement code is `StepTypePicker.tsx:346-347` (`getBoundingClientRect` on two boxes) and the ⤳/dashed visuals in `PhaseSpineGraph.tsx`. Use RESEARCH Pitfall 6: guard `typeof ResizeObserver !== "undefined"` (jsdom has none outside `mockReactFlow()`), always render one `<path>` per `lines[]` item with its data attrs even at zero geometry, assert the SET in jsdom and the GEOMETRY in G-4 Chrome UAT. |

## Metadata

**Analog search scope:** `frontend/src/components/workflows/` (incl. `library/`, `__fixtures__/`, `library/__tests__/`), `frontend/src/pages/WorkflowBuilderPage.tsx`, `frontend/src/lib/phaseGlyph.tsx`, `frontend/src/components/**` (ResizeObserver / `<figure>` / `aria-expanded` sweeps), `scripts/vitest-count-gate.cjs`, `docs/HOT-FILE-LEDGER.md`, `.planning/phases/286-seams-before-features/`, `.planning/seeds/`, `.planning/reported-bugs/`
**Files scanned:** ~30 read or grepped (cardFace.ts/test, canvasModel.ts, canvasModel.purity.test.ts, canvasFixtures.ts, PhaseSpine.tsx, PhaseSpineGraph.tsx, ownProperty.ts, phaseVocabulary.ts, soulData.ts, phaseGlyph.tsx, libraryVocabulary.ts, decisionsVocabulary.ts/test, governanceVocabulary.test.ts, FieldGuidance.tsx, DraftArrivalCard.test.tsx, WorkflowCard.tsx, WorkflowCard.test.tsx, WorkflowCard.seam286.pin.test.tsx, librarySubtree.fences.test.ts, WorkflowCanvas.tsx, WorkflowCanvas.test.tsx, WorkflowCanvas.editing.test.tsx, WorkflowBuilderPage.tsx, vitest-count-gate.cjs, HOT-FILE-LEDGER.md, 286-05-PLAN.md, SEED-155/086 frontmatter)
**Pattern extraction date:** 2026-10-21

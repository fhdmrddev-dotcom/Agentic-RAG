# Phase 183: Read-Only Canvas — Pattern Map

**Mapped:** 2026-07-25
**Files analyzed:** 18 (10 net-new · 6 modified · 2 config)
**Analogs found:** 16 / 18 (2 have NO analog — see §No Analog Found)
**Scope:** FRONTEND-ONLY. One backend *test* file (C-1 parity control). No backend source, no route, no migration.

> RESEARCH.md verified every donor `file:line` this session. This map does **not** re-verify those
> citations — it adds the analogs RESEARCH did not cover (extraction precedent, badge primitive,
> flag-gating consumer shape, view-toggle markup, fixture conventions) and flags **six concrete
> build-breakers** the planner must handle. See §Blocking Findings first.

---

## Blocking Findings (read before planning)

| # | Finding | Evidence | Planner action |
|---|---------|----------|----------------|
| **F-1** | **`resolveJsonModule` is NOT enabled.** `frontend/tsconfig.app.json` has no `resolveJsonModule` key, and there is **zero** `.json` import anywhere in `frontend/src` (source or test). `import cases from "./skipParseCases.json"` will fail `npx tsc -b` with TS2732. | `frontend/tsconfig.app.json` (full file read — `compilerOptions` has `moduleResolution: "bundler"`, no `resolveJsonModule`); exhaustive grep for `import .*\.json` in `frontend/src` → 0 hits | Either (a) add `"resolveJsonModule": true` to `tsconfig.app.json` as an explicit Wave-0 task, or (b) keep the C-1 case table in a `.ts` module and have the Python half parse it, or (c) `import raw from "./skipParseCases.json?raw"` + `JSON.parse`. **(a) is cleanest and is a one-line tsconfig change**; whichever is chosen, it must be a named task because `tsc -b` is a phase gate. |
| **F-2** | **There is NO component-level consumer of `useEffectiveFeatures`.** Exhaustive grep: the hook is called at exactly ONE site (`App.tsx:149`) and its output is consumed at exactly ONE site (`App.tsx:150` → `visibleNavItems`). It is **not** prop-drilled, **not** in a context, and never reaches a page. | `frontend/src/App.tsx:149-150` are the only two `effectiveFeatures` hits in the whole tree | D-183-03 needs a NEW plumbing decision the artifacts don't make. Two options: (i) `WorkflowBuilderPage` calls `useEffectiveFeatures(user?.id ?? null)` itself via `useAuth()` (`pages/IngestionPage.tsx:76` is the `const { user } = useAuth()` precedent) — costs a **second** `GET /features` per session; or (ii) thread `features.visual_workflow_canvas` down as a prop from `App.tsx` → `ChatLayout` → `WorkflowsPage`/`WorkflowDoorSwitch` → `WorkflowBuilderPage` (4 hops, matches the `showTechnical` prop-thread idiom at `ControlRoomPage.tsx:726/745/786`). Pick one in the plan; do not leave it implicit. |
| **F-3** | **The ⌥ toggle already has an app-wide single-source home, and D-183-08's "canvas-level" wording contradicts it.** `TechnicalNamesProvider` (`providers/TechnicalNamesProvider.tsx`) is mounted at `App.tsx:252` wrapping `<ChatLayout>` — which is where `activeView === "workflows"` renders (`components/layout/ChatLayout.tsx:590`). So the Builder is **already inside** the provider. The provider's own docblock (`:5-9`) names the exact failure a local `useState` would reintroduce: *"flipping it anywhere flips it everywhere; two toggles can never disagree (the cardinal G-6 'two toggles disagree' failure this phase exists to prevent)."* | `App.tsx:252` · `ChatLayout.tsx:590` · `TechnicalNamesProvider.tsx:5-9, 90-96` | Reuse `useTechnicalNames()` from the provider (the `ControlRoomPage.tsx:243` pattern) rather than a canvas-local `useState`. D-183-08's *intent* — "one state, one assertion, flips every node at once" — is **better** satisfied by the shared context. If the planner deliberately chooses local state, that must be an explicit, recorded deviation, because it forks a shipped single-source. |
| **F-4** | **The xyflow stylesheet has no clean `index.css` slot.** `frontend/src/index.css` line 1 is `@tailwind base;`. A CSS `@import` must precede all other at-rules/statements, so `@import "@xyflow/react/dist/style.css";` cannot be appended — it must be **line 1**, above the three `@tailwind` directives. | `frontend/src/index.css:1-3` · `frontend/src/main.tsx` (`import './index.css'`) | Either put the `@import` at `index.css:1` (before `@tailwind base`), or add `import "@xyflow/react/dist/style.css"` in `main.tsx` after `./index.css`. Note the second option loads the CSS eagerly and defeats a `React.lazy` split (Claude's-discretion item) — call this out in the plan. |
| **F-5** | **Exactly FOUR importers of `PhaseSpineGraph` symbols** (CONTEXT named two; RESEARCH found four; independently re-verified here). A missed one is a build break. | See §Shared Patterns → *Extract-and-repoint* for the full table with lines | All four must be handled in the same commit (hard repoint) or covered by a re-export shim. Both shapes have precedent — see the trade-off table. |
| **F-6** | **`PhaseSpineGraph.tsx:73-77` (the parity docblock), `PhaseSpineGraph.test.tsx:110-111` (the comment), and `soulData.ts:19-21` (the extraction claim) are ALL stale/false.** Verified independently this session: `PhaseSpineGraph.tsx:24-31` still declares a live local `PHASE_GLYPHS` with the retired flat glyphs, and `parseSkipTarget` at `:80` uses `lastIndexOf(":")` while `reachability.py:96` uses `on_failure[len(prefix):]`. | `PhaseSpineGraph.tsx:24-31, 73-83` · `soulData.ts:19-21` · `reachability.py:89-98` | Delete all three stale claims as part of the work. **New stale claim found:** `revertByteIdentical.test.tsx:9` and `:58` both say the canvas nav entry "lands WITH the view in 183" — released by D-183-01. Those are *comments only* (the assertions stay correct and must stay untouched per D-183-01), so correct the prose without touching the `expect(...)` lines. |

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `frontend/src/components/workflows/phaseVocabulary.ts` **(NEW)** | utility (pure derivation module) | transform | `frontend/src/components/workflows/soulData.ts` | **exact** |
| `frontend/src/components/workflows/canvasModel.ts` **(NEW)** | utility (pure projection) | transform | `soulData.ts` (`tierForDefinition`) + `deriveTier.ts` | **exact** |
| `frontend/src/components/workflows/WorkflowCanvas.tsx` **(NEW)** | component (view shell) | request-response (prop-in / callback-out) | `frontend/src/components/workflows/PhaseSpineGraph.tsx` | **exact** (drop-in peer: same 3 props) |
| `frontend/src/components/workflows/PhaseNode.tsx` **(NEW)** | component (presentational node) | transform (props → DOM) | `frontend/src/components/panel/PhaseCard.tsx:298-382` (3D glyph + status atom) + `PhaseSpineGraph.tsx:181-214` (the `<button>` node card) | **role-match** |
| broken-reference marker **(NEW)** — recommend `PhaseNode.tsx` sibling or an inline `nodeTypes` entry | component (presentational leaf) | transform | `PhaseSpineGraph.tsx:216-230` (the `data-testid="skip-edge"` honest branch row) | **exact** |
| grounding / "waits for you" badges **(NEW)** — inside `PhaseNode.tsx` | component (presentational leaf) | transform | `frontend/src/components/org/StatusChip.tsx` (Phase 177 primitive) + `WorkflowSoul.tsx:93-108` (tier chip: glyph + WORD) | **exact** |
| `frontend/src/components/workflows/__fixtures__/canvasFixtures.ts` **(NEW)** | test fixture | — | *inline `const` fixtures at the top of the test file* (`soulData.test.ts:27-96`, `PhaseSpineGraph.test.tsx:23-66`) | **partial — no shared-fixture-module precedent exists** |
| `frontend/src/components/workflows/__fixtures__/skipParseCases.json` **(NEW)** | test fixture (cross-language) | — | `backend/tests/test_seed091_owner_nulling.py:182-215` (Python reads a **frontend TS file**) | **partial — no shared JSON fixture precedent; see F-1** |
| `frontend/src/test-utils/mockReactFlow.ts` **(NEW)** | test utility | — | *none* — no `test-utils/`, `__mocks__/`, or shared test-helper dir exists in `frontend/src` | **NO ANALOG** |
| `frontend/src/components/workflows/canvasModel.test.ts` + `.purity.test.ts` + `.fixtures.test.ts` **(NEW)** | test (pure unit) | — | `frontend/src/components/workflows/soulData.test.ts` | **exact** |
| `frontend/src/components/workflows/phaseVocabulary.test.ts` **(NEW)** | test (pure unit) | — | `soulData.test.ts` + `deriveTier.test.ts` | **exact** |
| `frontend/src/components/workflows/WorkflowCanvas.test.tsx` **(NEW)** | test (component, jsdom) | — | `frontend/src/components/workflows/PhaseSpineGraph.test.tsx` | **exact** |
| `frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx` **(NEW)** | test (component, flag branch) | — | `frontend/src/components/admin/revertByteIdentical.test.tsx:42-65` | **role-match** |
| `backend/tests/unit/test_183_skip_parse_parity.py` **(NEW)** | test (pure unit, Python) | — | `backend/tests/test_harness_reachability.py:37-41` | **exact** |
| `frontend/src/components/workflows/PhaseSpineGraph.tsx` **(MOD)** | component (donor → repointed) | request-response | `frontend/src/components/workflows/PhaseSpine.tsx:19-20, 88` (already repointed onto `soulData` + `phaseGlyph`) | **exact** |
| `frontend/src/pages/WorkflowBuilderPage.tsx` **(MOD)** | page (mount site + view toggle) | request-response | `frontend/src/components/admin/ControlRoomPage.tsx:651-685` (tablist) · `SkillStudioPage.tsx:191-212` (leaner tablist) | **role-match** |
| `frontend/src/components/workflows/PhaseSpineGraph.test.tsx` **(MOD)** | test | — | `PhaseSpine.test.tsx:38-45` (the `data-phase-type` migration this must copy) | **exact** |
| `frontend/src/components/workflows/PhaseSpine.test.tsx` **(MOD)** · `soulData.test.ts` **(MOD)** | test | — | *self* (extend the guard at `:104` / fix the RED at `:121-143`) | **exact** |
| `frontend/package.json` **(MOD)** · `frontend/tsconfig.app.json` **(MOD, F-1)** · `frontend/src/index.css` **(MOD, F-4)** | config | — | — | n/a |

---

## Pattern Assignments

### `frontend/src/components/workflows/phaseVocabulary.ts` (utility, transform)

**Analog:** `frontend/src/components/workflows/soulData.ts` — a shipped, tested, one-concern shared
vocabulary module in the exact same directory. `canvasModel.ts` and `phaseVocabulary.ts` must read as
siblings of this file, not as new inventions.

**Docblock pattern** (`soulData.ts:1-16`) — the house docblock states *what one thing this module owns*,
*what drift it forbids*, and *its purity contract*:

```ts
/**
 * Phase 124-01 Task 1 (WUX-01, sketch 046-A / D-02 / D-03) — soulData.
 *
 * THE SINGLE SHARED MODULE for the workflow "soul" data. It surfaces the
 * identity-carrying atoms every soul size (card / run / pub) consumes from ONE
 * copy: ... These helpers were previously
 * page-private in `WorkflowsPage.tsx` (44-139); they are EXTRACTED here VERBATIM
 * so the three soul sizes can never render disagreeing tiers or glyphs
 * (D-02, SC#1+SC#2). Re-implementing any of these per soul size is the exact
 * drift this module forbids.
 *
 * Pure + client-side (D-02): this module surfaces EXISTING definition fields only
 * — no migration, no new authoring field, no backend touch. It imports NOTHING
 * from the API client; a tier / glyph / deliverable is DERIVED, never fetched.
 */
```

> Copy this shape verbatim for `phaseVocabulary.ts`, swapping in D-183-13's rationale and — critically —
> **not** repeating `soulData.ts:19-21`'s mistake of asserting an extraction that hasn't happened (F-6).
> If the docblock says "the PhaseSpineGraph local map is deleted," the same commit must delete it.

**Import style** (`soulData.ts:17`, `PhaseSpine.tsx:19-20`, `WorkflowSoul.tsx:29-35`) — source files use
the **`@/` alias even for same-directory siblings**; test files use relative `./`:

```ts
import { deriveTier, type CitationPolicy, type ValidatorKind } from "@/components/workflows/deriveTier"
import { PHASE_GLYPHS, type DefShape } from "@/components/workflows/soulData"
import { phaseGlyph } from "@/lib/phaseGlyph"
```
*(Exception: `PhaseFormPanel.tsx:39` uses relative `./PhaseSpineGraph`. The dominant convention is `@/`.)*

**Lookup-map + total-resolver pattern** (`soulData.ts:28-35` + `phaseGlyph.tsx:46-66`) — a module-level
`Record<string, T>` keyed by the exact `phase_type` strings, plus an exported function that is **total
over any key** (`?? null` / `?? fallback`), never a bare map read:

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
```ts
export function phaseGlyph(phaseType: string | undefined): PhaseMark | null {
  // The `?? null` mirrors providerLogo's `?? null` — total over any key.
  return phaseType ? (PHASE_GLYPH_MARKS[phaseType] ?? null) : null
}
```

> `PHASE_TYPE_SENTENCES` (D-183-06) and the ⌥-reveal `PHASE_TYPE_LABELS` follow this exactly:
> a `Record<string, string>` + a total resolver. **Do NOT re-declare `PHASE_GLYPHS`** — import it
> (`PhaseSpine.tsx:19` is the shipped consumer proving the pattern).

**Null-tolerant derivation with an explicit honest default** (`soulData.ts:81-104`, `131-141`) — every
exported derivation accepts `T | null | undefined`, defaults deliberately, and **never throws**:

```ts
export function tierForDefinition(def: DefShape | null | undefined) {
  const phases = def?.phases ?? []
  let citationPolicy: CitationPolicy = "draft"
  let sawEmit = false
  for (const p of phases) {
    if (p.config?.phase_type === "llm_emit") {
      const cp = p.config?.citation_policy
      if (cp === "strict" || cp === "flag" || cp === "partial" || cp === "draft") {
        citationPolicy = sawEmit ? stricterPolicy(citationPolicy, cp) : cp
        sawEmit = true
      }
    }
  }
  const kinds = new Set<ValidatorKind>()
  for (const p of phases) {
    for (const v of p.validators ?? []) {
      if (v.kind && ALL_VALIDATOR_KINDS.has(v.kind)) kinds.add(v.kind as ValidatorKind)
    }
  }
  return deriveTier(citationPolicy, kinds)
}
```

> **D-183-07's `groundingFor(phase)` is a direct sibling of this.** Note the shape: it reads
> `config.phase_type === "llm_emit"` before touching `citation_policy` (C-8 — the field exists on no
> other config class), and it filters validator kinds through a `ReadonlySet` guard before use.
> `deriveTier.ts:28-33` narrows `ValidatorKind` to **5** of the backend's **9** (`harness.py:178-183`) —
> so a grounding derivation that reads `citations_required` must go through a guard, not a bare compare,
> and must not crash on `regex_match`.

**Exhaustiveness guard + safe runtime fallback** (`deriveTier.ts:119-127`) — the house pattern for a
union switch that must not crash on a future/malformed enum value:

```ts
default: {
  // Exhaustiveness guard — a new citation_policy enum must be handled here.
  // IR-03: at RUNTIME an unknown policy (future enum / malformed JSONB) must NOT
  // return the raw string as a Tier (the caller would crash reading .id/.glyph).
  const _never: never = citationPolicy
  void _never
  return TIERS.LOOSE
}
```

**The corrected `parseSkipTarget`** — the target semantics to mirror line-for-line
(`backend/app/services/harness/reachability.py:89-98`):

```python
def parse_skip_target(on_failure: str) -> str | None:
    prefix = "skip_to_phase:"
    if isinstance(on_failure, str) and on_failure.startswith(prefix):
        target = on_failure[len(prefix):].strip()
        return target or None
    return None
```

The current frontend body being replaced (`PhaseSpineGraph.tsx:78-83`) plus its **false** docblock
(`:73-77`, which must be deleted, not moved):

```ts
/**
 * Resolve the target slug of a `skip_to_phase:<slug>` on_failure value, mirroring
 * the backend `parse_skip_target` (reachability.py): split on the LAST ":" and   ← FALSE (C-1/F-6)
 * return the trailing slug. Returns null for any non-skip on_failure value.
 */
export function parseSkipTarget(onFailure: string | undefined | null): string | null {
  if (!onFailure || !onFailure.startsWith("skip_to_phase:")) return null
  const idx = onFailure.lastIndexOf(":")          // ← the divergence
  const slug = onFailure.slice(idx + 1).trim()
  return slug.length > 0 ? slug : null
}
```

**Read shapes to MOVE verbatim** (`PhaseSpineGraph.tsx:48-71`) — three exported interfaces, each with a
comment naming *why the shape is loose*. Move them intact; do not re-type them:

```ts
/** A validator entry as it appears in the draft definition JSON (loose shape — the
 *  Builder refines the real definition; we only read `on_failure` here). */
export interface ValidatorJSON { kind?: string; on_failure?: string; [k: string]: unknown }

/** A phase config as it appears in the draft definition JSON. */
export interface PhaseConfigJSON { phase_type: string; [k: string]: unknown }

/** A `PhaseSpec` as it appears in the draft definition JSON (the Builder's working
 *  shape — `WorkflowDefinitionJSON` is opaque at the api layer; this is the local
 *  read shape the graph + form panel agree on). */
export interface PhaseSpecJSON {
  slug: string
  phase_index: number
  name?: string | null
  config: PhaseConfigJSON
  validators?: ValidatorJSON[]
}
```

---

### `frontend/src/components/workflows/canvasModel.ts` (utility, transform)

**Analog:** `frontend/src/components/workflows/deriveTier.ts` — the house shape for a **pure function
with a named, documented mapping rule** and a `const` table it can never drift from.

**Const-table-as-source-of-truth pattern** (`deriveTier.ts:57-79`) — the fixed-pitch / lane-height /
node-width constants (Claude's discretion) should land as one exported frozen table, not scattered
literals, so a test can assert against the ONE source:

```ts
/**
 * TIERS — the single source of truth for the badge. `deriveTier()` always
 * returns one of these exact references, so the badge can never drift from the
 * derivation (a stored label could; a derived reference cannot).
 */
export const TIERS = {
  STRICT: { id: "STRICT", glyph: "🔒", label: "Strict", description: "…", judgeAlwaysOn: true },
  …
} as const satisfies Record<TierId, Tier>
```

**The `as const satisfies Record<K, T>` idiom** is the shipped way to get literal-narrow types AND
compile-time completeness. Use it for `CANVAS_LAYOUT` / `PHASE_TYPE_SENTENCES`.

**Sort-then-walk pattern** (`PhaseSpineGraph.tsx:103-118` — the donor loop to adapt, **not** copy):

```ts
// Sort by phase_index (strict run order). The input array order is irrelevant.
const ordered = [...phases].sort((a, b) => a.phase_index - b.phase_index)
const slugSet = new Set(ordered.map((p) => p.slug))

const skipEdges: { fromSlug: string; toSlug: string }[] = []
for (const phase of ordered) {
  for (const v of phase.validators ?? []) {
    const target = parseSkipTarget(v.on_failure)
    if (target && slugSet.has(target)) {     // ← the SILENT DROP D-183-10 replaces
      skipEdges.push({ fromSlug: phase.slug, toSlug: target })
    }
  }
}
```

> Three deltas from the donor, all locked:
> 1. **C-2** — the sequential edge is `byIndexValue.get(p.phase_index + 1)`, NOT `ordered[i+1]`.
>    Mirror `reachability.py:162-169`.
> 2. **D-183-10** — replace `if (target && slugSet.has(target))` with a branch that emits an
>    *unresolved* marker instead of dropping.
> 3. The `[...phases].sort(...)` non-mutating copy is load-bearing for the G-6 purity test — the same
>    idiom appears at `PhaseSpine.tsx:38-40`, so it is the shipped convention, not an accident.

**Discriminated-union return** (`soulData.ts:129-141`) — the house shape for "one of two honest
outcomes," which is exactly what a resolved-vs-broken edge is:

```ts
export type SoulDeliverable = { kind: "file"; label: string } | { kind: "chat" }
```

---

### `frontend/src/components/workflows/WorkflowCanvas.tsx` (component, request-response)

**Analog:** `frontend/src/components/workflows/PhaseSpineGraph.tsx` — the drop-in peer. Same three props,
same callback contract, same read-only framing.

**Props contract to match EXACTLY** (`PhaseSpineGraph.tsx:93-99`) — D-183-05 requires the canvas be a
substitutable sibling at the mount site:

```ts
export interface PhaseSpineGraphProps {
  phases: PhaseSpecJSON[]
  /** The currently-selected phase slug (the open form anchor), or null at rest. */
  selectedSlug: string | null
  /** Selection only — NEVER reorders. Fires the clicked phase's slug. */
  onSelectNode: (slug: string) => void
}
```

**Section wrapper + `aria-label` + read-only framing** (`PhaseSpineGraph.tsx:120-141`):

```tsx
<section
  aria-label="Workflow phase spine (read-only)"
  className="flex h-full min-w-0 flex-col overflow-y-auto bg-background px-4 py-4"
>
  {/* Header: the View-only badge — the graph offers no build affordances. */}
  <div className="mb-3 flex flex-wrap items-center gap-2">
    <span className="rounded bg-muted px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">
      👁 View only
    </span>
    …
  </div>
```

> `👁 View only` is already the shipped read-only vocabulary — the Claude's-discretion "how read-only is
> told" item should reuse this exact badge rather than invent a second one. `flex h-full min-w-0
> flex-col` is also the answer to xyflow **Pitfall 3** (the parent needs explicit height): the graph
> column is a grid child with `h-full`, matching the donor.

**Empty state** (`PhaseSpine.tsx:42-48`) — the shipped precedent for D-183-11's copy and testid shape.
**Note it returns EARLY, before any chrome renders** — that is precisely D-183-11's "no plane, no grid,
no controls":

```tsx
if (ordered.length === 0) {
  return (
    <p data-testid="soul-spine-empty" className="text-[11px] italic text-muted-foreground">
      No phases yet
    </p>
  )
}
```

**Lazy-load precedent** (`frontend/src/pages/KnowledgeHealthPage.tsx:28-32`) — the ONE shipped
code-split in the app, with the exact `.then((m) => ({ default: m.X }))` named-export shim:

```ts
// Plan 075.4-04 D-075.4-SC#6 — lazy-load RetrievalTrendChart so the ~200 KB
// recharts dependency lands in a distinct chunk only when Knowledge Health is
// visited. Suspense fallback reuses the existing <ChartSkeleton /> defined
// below for byte-identical loading-state chrome.
const RetrievalTrendChart = lazy(() => import("@/components/health/RetrievalTrendChart").then((m) => ({ default: m.RetrievalTrendChart })))
```
Rendered at `KnowledgeHealthPage.tsx:482-484` as `<Suspense fallback={<ChartSkeleton />}>`.
`ExecuteCodeBody.tsx:12` is the second instance (shiki). **This is the pattern for the discretionary
`@xyflow/react` split** — and see F-4 for the CSS-import interaction.

---

### `frontend/src/components/workflows/PhaseNode.tsx` (component, transform)

**Primary analog:** `frontend/src/components/panel/PhaseCard.tsx` — the shipped live step card. It is the
only component in the app that renders **a 3D phase glyph + a status atom + a card surface** together,
and it is the Aether/Deep-Midnight idiom `PhaseNode` must match rather than reinvent.

**3D-glyph-with-unicode-fallback render** (`PhaseCard.tsx:265-267, 339-344`) — note the decorative
wrapper (`aria-hidden`) and the explicit sizing class on the SVG:

```tsx
// The shared 3D phase-type glyph (icon-convention §2 — ONE source). `phaseGlyph`
// returns null on an unknown type → the unicode "•"/type fallback (meta.glyph).
const Glyph = phaseGlyph(phase.phaseType)
…
{/* Phase-type glyph — the shared 3D mark (phaseGlyph, icon-convention §2),
    with the unicode "•"/type fallback (meta.glyph) when the type is unknown.
    Decorative — the label text carries the meaning (wrapper stays aria-hidden). */}
<span aria-hidden="true" className="flex-none leading-none text-panel-muted-foreground">
  {Glyph ? <Glyph className="h-4 w-4" /> : <span className="text-[13px]">{meta.glyph}</span>}
</span>
```

The canonical short form (`PhaseSpine.tsx:87-89`, the CONTEXT-named line 88) — **note the fallback reads
`PHASE_GLYPHS[type]`, which since Phase 127 is a fluent-emoji *slug string*, not a glyph**; `"•"` is the
real visual fallback:

```tsx
<span aria-hidden="true">
  {Glyph ? <Glyph /> : (PHASE_GLYPHS[type] ?? "•")}
</span>
```

**Card surface + conditional class array** (`PhaseCard.tsx:298-321`) — the `cn(...)` frosted-surface
vocabulary. The *quiet/idle* branch is the one `PhaseNode` should anchor to (183 has no run state):

```tsx
<div
  className={cn(
    "flex flex-col rounded-md border transition-colors",
    …
    phase.status === "pending"
      ? // QUIET idle — dim, still, no motion (SC#2 "quiet at rest").
        "border-border/40 bg-card/20 opacity-60"
      : // done / skipped — folded calm.
        "border-border/50 bg-card/30",
    // The llm_batch_agents purple left-border accent (--accent-violet, Plan 01).
    phase.phaseType === "llm_batch_agents" && !isRunning && !isFailed &&
      "border-l-2 border-l-accent-violet",
  )}
>
```

> **Colour-budget note (locked in CONTEXT `<specifics>`):** `PhaseCard` spends colour on **run status**
> (`--panel-status-active` amber bloom, destructive red, `accent-violet` retrying). `PhaseNode` in 183
> has no run state — so it takes the **quiet/idle** class vocabulary (`border-border/50 bg-card/30`) and
> spends its only type-colour as a *tint behind the icon*. The `accent-violet` treatment for `llm_emit`
> at `PhaseSpineGraph.tsx:170-171` / `PhaseSpine.tsx:82-84` is the one shipped type-tint precedent:
> `"border-accent-violet text-accent-violet"` vs `"border-border text-foreground"`.

**The node `<button>` — the drag-free structural invariant** (`PhaseSpineGraph.tsx:179-214`). Copy the
data-hook set verbatim; `WorkflowCanvas.test.tsx` and the DOM tests depend on it:

```tsx
{/* The node CARD — a <button> (keyboard-selectable; selection only,
    never draggable). No draggable attr, no drag handler. */}
<button
  type="button"
  data-testid={`spine-node-${phase.slug}`}
  data-slug={phase.slug}
  data-phase-type={phase.config.phase_type}
  data-selected={isSelected ? "true" : "false"}
  aria-pressed={isSelected}
  aria-label={`Phase ${phase.phase_index + 1}: ${nodeTitle(phase)} (${phase.config.phase_type})`}
  onClick={() => onSelectNode(phase.slug)}
  className={[
    "w-full rounded-md border px-3 py-2 text-left transition-colors",
    isSelected
      ? "border-primary bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]"
      : "border-border bg-card hover:border-primary/40",
  ].join(" ")}
>
```

> `data-phase-type` is **the durable test hook** — `PhaseSpine.test.tsx:38-45` documents it as the
> migration target for literal-glyph assertions. `PhaseNode` MUST carry it, or the `PhaseSpineGraph.test.tsx:94-96`
> migration has no equivalent on the canvas side.
> Two class-composition idioms coexist: `[...].join(" ")` (workflows dir) and `cn(...)` from
> `@/lib/utils` (panel/admin/org dirs). `cn` (clsx + tailwind-merge) is the better choice for a new
> component with conditional variants; both are shipped.

**Badge analog:** `frontend/src/components/org/StatusChip.tsx` (Phase 177 primitive). Its docblock states
the exact D-183-07 accessibility rule and the base pill geometry:

```ts
export type ChipTone = "primary" | "success" | "muted"

// primary = live/waiting (indigo) · success = positive terminal (green) · muted = calm terminal.
export const CHIP_TONE_CLASS: Record<ChipTone, string> = {
  primary: "border-primary/30 bg-primary/10 text-primary",
  success: "border-success/30 bg-success/10 text-success",
  muted:   "border-border bg-muted/40 text-muted-foreground",
}

// The grid-correct pill baseline. NEVER `uppercase tracking-wide` / `py-1` — that is the
// retired D-08/D-09 off-grid fork.
const BASE_CLASSES = "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium"

export function StatusChip({ tone, children, testId }: StatusChipProps) {
  return (
    <span data-testid={testId ?? "status-chip"} data-tone={tone}
          className={cn(BASE_CLASSES, CHIP_TONE_CLASS[tone])}>
      {children}
    </span>
  )
}
```

> **Reuse vs. clone:** `StatusChip` lives in `components/org/` and its docblock scopes `statusChipMeta`
> to the invitation/SSO **lifecycle** domain — but it explicitly separates *the shared COMPONENT* (the
> cohesion win) from *the tone MAPPING* (domain-specific, `OrgMembersTab.tsx:57` proves a second domain
> feeding the same component). So the correct move is: **import `StatusChip`, write a
> `groundingChip(phase)` mapper in `phaseVocabulary.ts`** — do NOT copy `BASE_CLASSES` into `PhaseNode`.
> A third inline pill would be exactly the fork Phase 177 retired.

**The never-colour-alone chip with a glyph** (`WorkflowSoul.tsx:93-108`) — the closest visual sibling
(glyph + WORD + a `data-*` assertion hook), and the model for D-183-07's grounding badge:

```tsx
{/* (4) TIER — ONE chip, glyph + WORD, never colour-alone (WCAG 1.4.1). The
    data-tier carries the consistency-invariant test hook (D-04, SC#1+SC#2). */}
<span
  data-testid="soul-tier"
  data-tier={tier.id}
  title={tier.description}
  className={[
    "inline-flex items-center gap-1 rounded-full border border-border font-mono font-semibold uppercase tracking-wide text-foreground",
    TIER_CLASS[scale],
  ].join(" ")}
>
  <span aria-hidden="true">{tier.glyph}</span>
  {tier.label}
</span>
```

**Scale-keyed class tables** (`PhaseSpine.tsx:30-34`, `WorkflowSoul.tsx:43-54`) — the idiom for
size/density variants without branching JSX:

```ts
const DOT_CLASS: Record<SoulScale, string> = {
  card: "h-6 w-6 text-[12px]",
  run:  "h-7 w-7 text-[14px]",
  pub:  "h-9 w-9 text-[18px]",
}
```

---

### Broken-reference marker (D-183-10) (component, transform)

**Analog:** `PhaseSpineGraph.tsx:216-230` — the shipped honest skip-branch row. Same job (say what the
definition declares, in words, with a `data-*` hook for assertions), inverted outcome (today it only
renders for a *resolved* target; D-183-10 needs the *unresolved* case too):

```tsx
{/* The dashed on-fail skip branch label(s). The ONLY non-linear edge. */}
{outgoingSkips.map((edge) => (
  <div
    key={`${edge.fromSlug}->${edge.toSlug}`}
    data-testid="skip-edge"
    data-from-slug={edge.fromSlug}
    data-target-slug={edge.toSlug}
    className="mt-1.5 ml-1 flex items-center gap-1.5 border-l-2 border-dashed border-amber-500/70 pl-2 text-[11px] text-amber-600 dark:text-amber-400"
  >
    <span aria-hidden="true">⤳</span>
    <span>
      on fail → skip to <span className="font-mono font-medium">{edge.toSlug}</span>
    </span>
  </div>
))}
```

> Note the shipped honest-state vocabulary this should extend: amber = needs-attention, dashed border =
> conditional/branch, `font-mono` for the slug, a bare-word English sentence carrying the meaning.
> The wording must agree with the backend's `UNSATISFIABLE_SKIP` verdict (`reachability.py:147-156`).
> The honest-fallback prose idiom is at `soulData.ts:134-140` ("never a fabricated deliverable") and
> `StatusChip.tsx:90-91` ("unknown statuses read as the calm muted chip with the raw status echoed —
> honest, never fabricated").

---

### `frontend/src/pages/WorkflowBuilderPage.tsx` (page, request-response) — the toggle + column swap

**Mount site to modify** (`WorkflowBuilderPage.tsx:446-465`) — the graph column is the **first grid
child**; the swap is a single-child substitution, no grid change:

```tsx
<div
  data-testid="builder-grid"
  className="grid min-h-0 min-w-0 flex-1 overflow-hidden motion-safe:transition-[grid-template-columns] motion-safe:duration-300"
  style={{ gridTemplateColumns: "minmax(0,1fr) " + (panelOpen ? "400px" : "44px") }}
>
  <PhaseSpineGraph
    phases={state.definition.phases}
    selectedSlug={selectedSlug}
    onSelectNode={(slug) => setSelectedSlug((cur) => (cur === slug ? null : slug))}
  />
  <PhaseFormPanel … />
</div>
```

> Two things to preserve: (1) `motion-safe:transition-[grid-template-columns]` — the app's
> reduced-motion-aware transition idiom; (2) the toggle-off-on-reclick selection semantics
> (`cur === slug ? null : slug`) — D-183-05 says the canvas fires the *same* callback, so this stays
> at the page, not in the canvas.

**Session-state view toggle** — the app has no router; view state is `useState` at the owning component.
Precedents: `WorkflowBuilderPage.tsx:100` (`selectedSlug`), `WorkflowDoorSwitch.tsx:37` (`DoorState =
"both" | "describe" | "govern"` — a shipped **in-page view fork inside the workflows surface**, the
nearest conceptual sibling to `[≣ Spine] [⬡ Canvas]`), `ControlRoomPage.tsx:200` (`activeTab`).

**Segmented-control markup + a11y** — the app uses `role="tablist"` + `role="tab"` +
`aria-selected` (NOT `aria-pressed`, NOT roving tabindex). Leaner of the two, `SkillStudioPage.tsx:191-212`:

```tsx
{/* Deep-linkable tab bar (Evals · Triggering · Versions). Phase 155
    (A11Y-01): a <div> host, not <nav> — the interactive "tablist" role must
    not override a <nav> landmark (jsx-a11y/no-noninteractive-element-to-
    interactive-role). */}
<div className="flex items-center gap-1" role="tablist" aria-label="Skill Studio tabs">
  {TABS.map((t) => {
    const active = t.id === tab
    return (
      <button
        key={t.id}
        type="button"
        role="tab"
        aria-selected={active}
        onClick={() => onTabChange(t.id)}
        className={cn(
          "rounded-md px-3 py-1.5 text-sm transition-colors",
          active
            ? "bg-primary/10 font-semibold text-primary"
            : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
        )}
      >
        {t.label}
      </button>
    )
  })}
</div>
```

`ControlRoomPage.tsx:651-685` is the same markup with a count-pill and a lock glyph. Both carry the same
**A11Y-01 rule: the tablist host is a `<div>`, never a `<nav>`** — `frontend/eslint.a11y.config.js` will
flag a `<nav role="tablist">`.

> **Decide explicitly:** a two-item view switch is legitimately either a `tablist` (matches the two
> shipped precedents) or two `aria-pressed` buttons (`TechnicalNamesToggle.tsx:27`). Given the canvas
> swaps the *whole* panel content, `role="tablist"` + `aria-selected` is the better semantic and matches
> the house. Do **not** mix the two.

**The ⌥ Technical-names control** (`TechnicalNamesToggle.tsx:22-38`) — a shipped, tested,
prop-controlled leaf. **Reuse it, do not clone it** (it is exported and takes only `enabled` +
`onToggle`; the docblock at `:8-10` explicitly says the parent owns the state):

```tsx
export function TechnicalNamesToggle({ enabled, onToggle }: TechnicalNamesToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={enabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-3 py-1 font-sans text-xs transition-colors",
        enabled
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-accent text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground",
      )}
    >
      <span aria-hidden="true">⌥</span>
      Technical names
    </button>
  )
}
```

Wired via the shared context (`ControlRoomPage.tsx:79-80, 243, 708-711`) — **the pattern F-3 recommends**:

```tsx
import { TechnicalNamesToggle } from "./TechnicalNamesToggle"
import { useTechnicalNames } from "@/providers/TechnicalNamesProvider"
…
const { showTechnical, toggle: toggleTechnical } = useTechnicalNames()
…
<TechnicalNamesToggle enabled={showTechnical} onToggle={toggleTechnical} />
…
<HealthSignals signals={signals} showTechnical={showTechnical} />   {/* threaded down as a prop */}
```

> For unit tests, `useTechnicalNamesOptional()` (`TechnicalNamesProvider.tsx:104-106`) returns `null`
> outside a provider and falls back to plain — so `PhaseNode` can render in isolation without a wrapper.
> Prefer the optional accessor in leaves, the throwing one in the owning surface.

**Feature-flag VANISH convention** (`lib/nav-items.ts:61-73`) — the only shipped gate, and it is
nav-level. Its **semantics** transfer even though its shape doesn't (see F-2):

```ts
/**
 * ... A governed entry (one carrying a `feature` tag) renders ONLY when the map
 * resolves that key strictly `true`; an absent/false key DROPS the item entirely —
 * the sketch VANISH, never a locked/disabled/badged placeholder. ...
 * Fail-CLOSED by construction: the map fails to `{}` on error / pre-resolve
 * (useEffectiveFeatures) ... RENDER-ONLY — 148-05's `require_visible` API is the
 * security authority; this just avoids dead nav.
 */
export function visibleNavItems(features: EffectiveFeatures): readonly NavItem[] {
  return NAV_ITEMS.filter((item) => !item.feature || features[item.feature] === true)
}
```

> Two contracts to carry into the Builder branch: **strict `=== true`** (not truthy — an absent key must
> hide) and **fail-closed** (`useEffectiveFeatures` starts and errors to `{}`, `hooks/useEffectiveFeatures.ts:40,65,74`).
> The `loading` flag (`:41,77`) means the toggle correctly does not render pre-resolve; RESEARCH:511-514
> flags the flash-then-vanish risk — decide whether the graph-column header reserves the strip's space.

---

### Test files

**Pure-module unit test** — analog `frontend/src/components/workflows/soulData.test.ts` (the exact
shape `canvasModel.test.ts` / `phaseVocabulary.test.ts` should take).

Imports + the `?raw` source-grep companion (`soulData.test.ts:17-25`) — note **relative** paths in tests:

```ts
import { describe, it, expect } from "vitest"
import soulDataSource from "./soulData?raw"
import { tierForDefinition, PHASE_GLYPHS, entryInputKeys, soulDeliverable, type DefShape } from "./soulData"
```

Fixtures are **inline module-level consts, typed with the module's own read shape, one JSDoc line each
naming what the fixture proves** (`soulData.test.ts:27-96`):

```ts
/** A flag-policy emit WITH the full floor-gate set → refines up to STRICT. */
const flagFullGatesDef: DefShape = {
  phases: [
    {
      slug: "emit",
      phase_index: 0,
      config: { phase_type: "llm_emit", citation_policy: "flag" },
      validators: [{ kind: "output_file_valid" }, { kind: "structure_check" }, { kind: "freshness" }],
    },
  ],
}
```

The **purity / anti-duplication source-grep block** (`soulData.test.ts:190-201`) — the template for
D-183-12's "no DOM read" guard and G-6's "no third copy" guard:

```ts
describe("soulData — purity (D-02: surfaces existing fields only, no backend touch)", () => {
  it("imports nothing from the API client", () => {
    expect(soulDataSource).not.toMatch(/from\s+["']@\/lib\/api["']/)
  })

  it("exports exactly one PHASE_GLYPHS and one tierForDefinition (no duplication)", () => {
    const glyphExports = soulDataSource.match(/export const PHASE_GLYPHS/g) ?? []
    const tierExports = soulDataSource.match(/export function tierForDefinition/g) ?? []
    expect(glyphExports).toHaveLength(1)
    expect(tierExports).toHaveLength(1)
  })
})
```

The `it.each` table-driven idiom for the C-1 case table (`StatusChip.test.tsx:88-104`):

```ts
it.each([
  ["pending", "Pending", "primary"],
  ["accepted", "Accepted", "success"],
] as [string, string, ChipTone][])("%s → { label: %s, tone: %s }", (status, label, tone) => {
  expect(statusChipMeta(status)).toEqual({ label, tone })
})
```

**Component test (jsdom)** — analog `frontend/src/components/workflows/PhaseSpineGraph.test.tsx`.

Setup (`:14-19`) and the `?raw` rationale comment:

```ts
import { describe, it, expect, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
// Read the component SOURCE via Vite's ?raw loader (the idiomatic vitest way —
// typechecks under `vite/client`, no node:fs/process needed) for the G-5 grep.
import phaseSpineGraphSource from "./PhaseSpineGraph?raw"
import { PhaseSpineGraph, type PhaseSpecJSON } from "./PhaseSpineGraph"
```

The **drag-free DOM block** to mirror on the canvas (`:129-145`):

```ts
it("STATIC drag-free DOM: no draggable=true, no drag handler attrs, no connection-handle, no add-node control", () => {
  const { container } = render(<PhaseSpineGraph phases={skipPhases} selectedSlug={null} onSelectNode={vi.fn()} />)
  expect(container.querySelectorAll('[draggable="true"]')).toHaveLength(0)
  expect(container.querySelectorAll("[draggable]")).toHaveLength(0)
  expect(container.querySelectorAll('[data-connection-handle]')).toHaveLength(0)
  expect(container.querySelectorAll('[data-add-node]')).toHaveLength(0)
  const buttons = Array.from(container.querySelectorAll("button"))
  for (const b of buttons) {
    const label = (b.getAttribute("aria-label") ?? "") + (b.textContent ?? "")
    expect(label.toLowerCase()).not.toContain("add node")
  }
})
```

`userEvent` is imported **dynamically inside the test** (`:120-127`) — a shipped quirk worth matching:

```ts
const onSelect = vi.fn()
const { default: userEvent } = await import("@testing-library/user-event")
const user = userEvent.setup()
render(<PhaseSpineGraph phases={threePhases} selectedSlug={null} onSelectNode={onSelect} />)
await user.click(screen.getByTestId("spine-node-gather"))
expect(onSelect).toHaveBeenCalledWith("gather")
```

**The three assertions that BREAK** under D-183-13 (`PhaseSpineGraph.test.tsx:88-97`):

```ts
it("renders the phase-type glyphs (each node card carries its type glyph)", () => {
  …
  expect(within(gather).getByText("🤖")).toBeInTheDocument() // llm_agent   ← BREAKS
  expect(within(review).getByText("🤖")).toBeInTheDocument() // llm_agent   ← BREAKS
  expect(within(emit).getByText("◆")).toBeInTheDocument()   // llm_emit    ← BREAKS
})
```

**The migration pattern to copy onto them** (`PhaseSpine.test.tsx:38-55`) — the documented, durable
`data-phase-type` + `querySelector("svg")` pair:

```ts
it("renders the correct phase type for each dot (data-phase-type hook, 127-01 migration)", () => {
  // Migrated from literal unicode assertions to data-attribute hooks (durable after 3D swap).
  render(<PhaseSpine def={def} scale="card" />)
  expect(screen.getByTestId("spine-dot-gather").getAttribute("data-phase-type")).toBe("llm_agent")
  …
})

it("renders 3D SVG glyph components via phaseGlyph() for known phase types", () => {
  render(<PhaseSpine def={def} scale="card" />)
  expect(screen.getByTestId("spine-dot-gather").querySelector("svg")).not.toBeNull()
  …
})
```

**The `?raw` anti-drift guard to extend** (`PhaseSpine.test.tsx:100-106`):

```ts
it("the SOURCE never imports PhaseTimeline or PhaseCard (G-5)", () => {
  expect(phaseSpineSource).not.toMatch(/PhaseTimeline/)
  expect(phaseSpineSource).not.toMatch(/PhaseCard/)
  // The glyph map is imported from soulData, not re-declared locally.
  expect(phaseSpineSource).not.toMatch(/const PHASE_GLYPHS/)
  expect(phaseSpineSource).toMatch(/soulData/)
})
```
and its `PhaseSpineGraph.test.tsx:153-159` sibling whose regex at `:158` must gain `|xyflow`:
```ts
expect(src).not.toMatch(/react-flow|reactflow|\bd3\b|dagre/)   // ← add |xyflow
```
> A third consumer of the *same* guard already exists at `WorkflowSoul.test.tsx:121-122` — three files
> assert `not.toMatch(/const PHASE_GLYPHS/)`. `PhaseSpineGraph` becomes the fourth. RESEARCH:1006-1012's
> "a separate file makes the guard trivially extensible" argument is confirmed by this count.

**Flag-branch page test** — analog `frontend/src/components/admin/revertByteIdentical.test.tsx:42-65`.
Note `afterEach(cleanup)` (`:29-31`) and the map-literal-per-assert style. **`:62-64` must stay
byte-untouched** (D-183-01):

```ts
it("no NAV_ITEMS entry is tagged visual_workflow_canvas (scope-freeze guard)", () => {
  expect(NAV_ITEMS.some((item) => item.feature === "visual_workflow_canvas")).toBe(false)
})
```

**Backend parity test** — analog `backend/tests/test_harness_reachability.py:37-41`. The existing test is
the direct ancestor of the C-1 Python half; the new file extends it with the shared case table:

```python
from app.services.harness import lint_workflow, parse_skip_target  # noqa: E402


def test_parse_skip_target_extracts_slug():
    assert parse_skip_target("skip_to_phase:gather") == "gather"
    assert parse_skip_target("fail_run") is None
    assert parse_skip_target("retry") is None
    assert parse_skip_target("skip_to_phase:") is None
```

**Cross-language file read** — the precedent for a pytest reading a file out of `frontend/`
(`backend/tests/test_seed091_owner_nulling.py:188-190`):

```python
types_file = Path(__file__).resolve().parents[2] / "frontend" / "src" / "types" / "index.ts"
assert types_file.exists(), f"frontend types file not found at {types_file}"
text = types_file.read_text(encoding="utf-8")
```
> `parents[2]` from `backend/tests/X.py` == repo root. From `backend/tests/unit/X.py` it is
> **`parents[3]`** (`backend/tests/integration/test_seed_pm_pack.py:46-47` documents the arithmetic
> inline: *"backend/tests/integration/… -> parents[3] == repo root"*). Copy that comment style so a
> future mover doesn't silently break the path.

---

## Shared Patterns

### Extract-a-shared-module-and-repoint-consumers (D-183-13)

**Sources — two shipped frontend precedents, both HARD REPOINT, neither left a shim:**

| Extraction | Donor(s) | New home | Repoint shape |
|---|---|---|---|
| **Phase 124-01** `soulData.ts` | `WorkflowsPage.tsx:44-139` (page-private helpers) | `components/workflows/soulData.ts` | Hard cut. `WorkflowsPage.tsx:53-55` now reads: *"the ONE shared soulData module (Plan 01 extracted them VERBATIM from this page — **the page is no longer their owner**)"* → `import { entryInputKeys, type DefShape } from "@/components/workflows/soulData"`. No re-export left behind. |
| **Phase 177-01** `StatusChip.tsx` | `InvitationsTab.tsx:71-75` + `SsoTab.tsx:71-75` (byte-identical inline maps) | `components/org/StatusChip.tsx` | Hard cut. `InvitationsTab.tsx:26` → `import { StatusChip, statusChipMeta } from "./StatusChip"`. A **third** domain (`OrgMembersTab.tsx:24, 161-166`) later joined the same component with its own mapper. |

**Re-export shim precedent — exists but is thin.** Exactly one `export … from` re-export in the whole
frontend tree (`hooks/useMessages.ts:55-56`):

```ts
export { useWorkflowLockForThread } from "@/providers/StreamsProvider"
export type { WorkflowLock } from "@/stores/streamsStore"
```

**Trade-off for 183:**

| | Hard repoint (house default) | Re-export shim (RESEARCH:450-453's suggestion) |
|---|---|---|
| Edits | 4 import lines in the same commit | 1 line added to `PhaseSpineGraph.tsx`, 0 consumer edits |
| Matches shipped precedent | ✅ both 124-01 and 177-01 | ⚠ only `useMessages.ts:55-56` |
| G-6 "no third copy" | clean | a shim is a second *path* to the same symbol — a later reader may re-import from the wrong home |
| Phase 184 cost | none | must be removed later, or it calcifies |

> **Recommendation: hard repoint** (4 edits, same commit) — it matches both shipped extractions and
> leaves no ambiguity for Phase 184. If the planner takes the shim, add an explicit follow-up task to
> remove it in 184, and a `?raw` guard asserting the shim is a `export type {…} from` line only.

**Apply to:** `PhaseSpineGraph.tsx`, `WorkflowBuilderPage.tsx`, `PhaseFormPanel.tsx`,
`PhaseFormPanel.test.tsx`, `PhaseSpineGraph.test.tsx`.

**The COMPLETE importer list — verified independently this session (exhaustive grep for
`from "./PhaseSpineGraph"`, `from "@/components/workflows/PhaseSpineGraph"`, `PhaseSpineGraph?raw`):**

| # | File | Line | Statement | Symbols |
|---|---|---|---|---|
| 1 | `frontend/src/pages/WorkflowBuilderPage.tsx` | **31** | `import { PhaseSpineGraph, type PhaseSpecJSON } from "@/components/workflows/PhaseSpineGraph"` | component + type |
| 2 | `frontend/src/components/workflows/PhaseFormPanel.tsx` | **39** | `import type { PhaseSpecJSON } from "./PhaseSpineGraph"` | type only |
| 3 | `frontend/src/components/workflows/PhaseFormPanel.test.tsx` | **25** | `import type { PhaseSpecJSON } from "./PhaseSpineGraph"` | type only — **not named in CONTEXT** |
| 4 | `frontend/src/components/workflows/PhaseSpineGraph.test.tsx` | **18-19** | `import phaseSpineGraphSource from "./PhaseSpineGraph?raw"` + `import { PhaseSpineGraph, type PhaseSpecJSON } from "./PhaseSpineGraph"` | raw source + component + type |

`READ_ONLY_LEGEND` (`PhaseSpineGraph.tsx:44-46`) is exported but has **zero importers outside its own
file** — it can move, stay, or be left alone; it is not a repoint constraint. `nodeTitle`
(`:86-91`) is module-private, so moving it is free.

---

### Aether / Deep Midnight styling vocabulary

**Source:** `frontend/tailwind.config.js` + `frontend/src/index.css` (`:root` / `.dark` token blocks)
**Apply to:** `PhaseNode.tsx`, `WorkflowCanvas.tsx`, all badges

Semantic tokens actually used by the workflow surfaces (never raw hex, never a new colour):

| Token class | Where shipped |
|---|---|
| `bg-background` / `bg-card` / `bg-card/30` / `bg-muted` | `PhaseSpineGraph.tsx:123, 194, 127` · `PhaseCard.tsx:314` |
| `text-foreground` / `text-muted-foreground` / `text-foreground/80` | throughout |
| `border-border` / `border-border/40` / `border-border/50` | `PhaseCard.tsx:312, 314` |
| `border-primary` / `bg-primary/5` / `bg-primary/10` / `text-primary` | selection + active tab + StatusChip primary |
| `accent-violet` / `accent-violet-text` (`tailwind.config.js:57-64`) | the `llm_emit` / `llm_batch_agents` tint — `PhaseSpineGraph.tsx:170-171`, `PhaseSpine.tsx:83`, `PhaseCard.tsx:309, 320` |
| `panel-status-active` / `panel-status-done` (`tailwind.config.js:52-54`) | **`components/panel/*` ONLY** per the config comment — do NOT use in `components/workflows/*` |
| `success` / `destructive` | `StatusChip.tsx:36` · `PhaseCard.tsx:303` |
| arbitrary HSL: `shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]` | `PhaseSpineGraph.tsx:193` — the shipped ring/glow idiom |
| `motion-safe:` prefix on every transition | `WorkflowBuilderPage.tsx:448` |
| `backdrop-blur` / `backdrop-blur-sm` (frosted) | `ControlRoomPage.tsx:692` · `PublishGauntlet.tsx:747` |

Utility: `import { cn } from "@/lib/utils"` (clsx + tailwind-merge, `frontend/src/lib/utils.ts`).

---

### Accessibility rules the phase inherits

**Sources:** `PhaseSpineGraph.tsx:179-214` · `WorkflowSoul.tsx:93-108` · `PhaseCard.tsx:339-344` ·
`SkillStudioPage.tsx:187-191` · `frontend/eslint.a11y.config.js` (`npm run lint:a11y`)
**Apply to:** every new component

1. **Never colour alone (WCAG 1.4.1)** — a WORD carries the meaning; the glyph is `aria-hidden`.
   `WorkflowSoul.tsx:93-94` and `StatusChip.tsx:11-12` both state this explicitly.
2. **Decorative glyph wrappers are `aria-hidden="true"`** — `PhaseCard.tsx:342`, `PhaseSpine.tsx:87`,
   `PhaseSpineGraph.tsx:166, 198`, `TechnicalNamesToggle.tsx:35`.
3. **One tab stop per node** — the node IS the `<button>`; nothing inside it is focusable
   (`PhaseSpineGraph.tsx:181`).
4. **`aria-label` states position + title + type** — `PhaseSpineGraph.tsx:188`:
   `` `Phase ${phase.phase_index + 1}: ${nodeTitle(phase)} (${phase.config.phase_type})` ``.
5. **A `tablist` host must be a `<div>`, never a `<nav>`** — `SkillStudioPage.tsx:187-190` and
   `ControlRoomPage.tsx:647-650` both carry the Phase-155 A11Y-01 comment.
6. **`vitest-axe` `toHaveNoViolations()` is globally extended** (`src/setupTests.ts:6-8`) — no per-file
   setup needed for the a11y assertion.

---

### Honest-state / never-fabricate vocabulary

**Sources:** `soulData.ts:116-141` · `StatusChip.tsx:66-92` · `PhaseSpine.tsx:42-48` ·
`WorkflowSoul.tsx:17-21, 64-71`
**Apply to:** the D-183-11 empty state, the D-183-10 broken-reference marker, the D-183-06 fallback title

The shipped rule, three ways:
- `soulData.ts:127` — *"`kind: "chat"` is the LOCKED honest fallback — never a fabricated deliverable."*
- `StatusChip.tsx:69-70` — *"Unknown statuses read as the calm muted chip with the raw status echoed
  (honest — never fabricated)."*
- `WorkflowSoul.tsx:17-21` — *"HONEST empty-states — the atom is ALWAYS rendered, never hidden, never a
  fabricated value"*, rendered as `<span className="italic text-muted-foreground">draft · purpose not
  declared yet</span>` (`:69`).

> D-183-06's plain-language sentences are a *substitution*, not a fabrication — but the fallback for an
> **unknown** `phase_type` must echo the raw type honestly (`PhaseSpineGraph.tsx:89`'s
> `?? phase.config.phase_type` is the shipped precedent), never invent a sentence.

---

### XSS / authored-string rule

**Sources:** `PhaseSpine.tsx:13-14` · `WorkflowSoul.tsx:22-24` · `WorkflowDoorSwitch.tsx:31-32` ·
`phaseGlyph.tsx:10-13`
**Apply to:** `PhaseNode.tsx`, `WorkflowCanvas.tsx`, the broken-reference marker

Every workflow surface carries the same clause verbatim:

```
 * XSS (T-124-01): every authored string (phase names) is rendered as a plain React
 * text child / `title=` attribute value — never `dangerouslySetInnerHTML`.
```

Phase names, slugs, and `on_failure` targets are LLM/user-authored. The `<Handle>`-adjacent xyflow
label props take React children, so this holds unchanged.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `frontend/src/test-utils/mockReactFlow.ts` | test utility | — | **No shared test-helper location exists.** `frontend/src` has no `test-utils/`, `__mocks__/`, `__fixtures__/`, or `helpers/` directory anywhere. `src/setupTests.ts` is the only shared test file and it contains only `@testing-library/jest-dom` + `vitest-axe/matchers` (VALIDATION.md correctly forbids adding the mocks there — a global `Object.defineProperties` on `HTMLElement.prototype` would perturb all 205 suites). Use the official xyflow four-mock recipe verbatim (RESEARCH:1500-1547) and create the directory; there is no house shape to match. |
| `frontend/src/components/workflows/__fixtures__/skipParseCases.json` | test fixture (cross-language) | — | **No cross-language shared-fixture precedent, and JSON imports do not compile today (F-1).** Zero `.json` imports in `frontend/src`; the only frontend-adjacent JSON is `backend/tests/fixtures/uat_fixture_ids.json`, which is **written by** `seed_library_asset.py:44` / `seed_llm_emit_fixture.py:57` and consumed by a live UAT operator, not read by a test. The closest real precedent is the *inverse direction*: `backend/tests/test_seed091_owner_nulling.py:188` (pytest reads `frontend/src/types/index.ts` and regex-greps it). **This is a genuine gap — state it plainly in the plan rather than implying a convention exists.** |

**Partial-analog note on `canvasFixtures.ts`:** the frontend has **no shared fixture module** at all —
every suite declares inline module-level consts (`soulData.test.ts:27-96`, `PhaseSpineGraph.test.tsx:23-66`,
`PhaseSpine.test.tsx:20-27`, `WorkflowDoorSwitch.test.tsx`). A `__fixtures__/canvasFixtures.ts` imported by
three suites is **net-new structure**. The backend does have `backend/tests/fixtures/` (`seed_library_asset.py`,
`seed_llm_emit_fixture.py`, `templates/`) — so the *concept* is house-approved, just not on the frontend.
The JSDoc-per-fixture + source-citing style should follow `soulData.test.ts:27-96` (`/** A strict workflow:
a terminal llm_emit with citation_policy "strict" → STRICT. */`), extended with the `file:line` citation
RESEARCH:896-903 requires.

---

## Metadata

**Analog search scope:**
`frontend/src/components/workflows/` · `frontend/src/components/panel/` · `frontend/src/components/org/` ·
`frontend/src/components/admin/` · `frontend/src/pages/` · `frontend/src/lib/` · `frontend/src/hooks/` ·
`frontend/src/providers/` · `frontend/src/App.tsx` · `frontend/tsconfig.app.json` ·
`frontend/tailwind.config.js` · `frontend/src/index.css` · `backend/tests/` ·
`backend/app/services/harness/reachability.py`

**Files read in full:** `PhaseSpineGraph.tsx` · `soulData.ts` · `PhaseSpine.tsx` · `phaseGlyph.tsx` ·
`deriveTier.ts` · `WorkflowSoul.tsx` · `StatusChip.tsx` · `TechnicalNamesToggle.tsx` ·
`TechnicalNamesProvider.tsx` · `useEffectiveFeatures.ts` · `nav-items.ts` · `revertByteIdentical.test.tsx` ·
`PhaseSpine.test.tsx` · `PhaseSpineGraph.test.tsx` · `soulData.test.ts` · `lib/utils.ts` · `main.tsx` ·
`tsconfig.app.json`
**Files read in targeted ranges:** `WorkflowBuilderPage.tsx` (1-145, 424-470) ·
`ControlRoomPage.tsx` (600-730) · `PhaseCard.tsx` (255-394) · `SkillStudioPage.tsx` (185-214) ·
`KnowledgeHealthPage.tsx` (26-37) · `WorkflowDoorSwitch.tsx` (1-60) · `reachability.py` (85-114) ·
`test_harness_reachability.py` (1-50) · `test_seed091_owner_nulling.py` (178-217) · `index.css` (1-25)
**Exhaustive greps:** `PhaseSpineGraph` importers · `useEffectiveFeatures`/`effectiveFeatures` consumers ·
`phaseGlyph`/`PHASE_GLYPHS` consumers · `role="tablist"`/`aria-pressed` · `Technical names`/`⌥` ·
`.json` imports in `frontend/src` · `export … from` re-exports · `React.lazy`/`Suspense` ·
`__fixtures__`/`test-utils`/`__mocks__` directories · `parse_skip_target` (backend)

**Pattern extraction date:** 2026-07-25
**Anti-drift discipline applied:** every in-code claim of prior extraction/parity was grepped before
being believed. Four stale claims found and recorded (F-6).

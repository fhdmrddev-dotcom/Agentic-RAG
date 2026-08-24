# Phase 197: Guided Authoring — Pattern Map

**Mapped:** 2026-08-18
**Files analysed:** 18 (5 new source/test + 13 modified)
**Analogs found:** 17 / 18 (one has no analog — the D-13 readiness verdict on the success dict)
**Base tree read:** `develop` @ `61f779e5` (the SHA `197-RESEARCH.md` measured against)

> **Every analog below was OPENED and quoted, not inferred.** Line numbers are from the tree
> as read this session. Re-derive before pinning a criterion on one — this project's own
> standing lesson is that a written line number rots.

---

## ⚠ Three corrections to the upstream file lists, stated before the map

These matter because a plan that inherits them will look for something that is not there.

1. **`governanceVocabulary.ts` DOES NOT EXIST.** `197-CONTEXT.md` `<code_context>` and D-09
   both name it as one of "four shipped vocabulary-module precedents", and `197-RESEARCH.md`
   repeats it. Measured: `ls frontend/src/components/workflows/*ocabulary*` returns
   `doorVocabulary.ts`, `phaseVocabulary.ts`, `runVocabulary.ts`, `templateFirstVocabulary.ts`
   and **`governanceVocabulary.test.ts` — a TEST with no module.** That file is a
   cross-cutting *sweep* (`governanceVocabulary.test.ts:1-56`), not a copy home; the strings it
   guards live in `definitionOps.ts`. **The four real precedents are `definitionOps.ts`,
   `templateFirstVocabulary.ts`, `doorVocabulary.ts`, `runVocabulary.ts` /
   `library/libraryVocabulary.ts`.** It is still a first-rate analog — for D-14's *fence*, not
   for D-09's *module*.
2. **`SeedReceipt`'s own sentences do NOT live in `SeedReceipt.tsx` and never did** — they are
   in `definitionOps.ts:600-830`. So "copy `SeedReceipt`'s shape" means copying a **pair**
   (component + copy home), not one file. That pair is the single most important pattern in
   this phase.
3. **`terminalEmitSlug` is genuinely net-new** — `grep -rn "terminalEmitSlug" frontend/src`
   returns zero. Confirmed, so plan it as an addition, not a re-export.

---

## File Classification

| New/Modified file | New? | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|---|
| `frontend/src/components/workflows/DraftArrivalCard.tsx` | NEW | component (composing parent) | props-in / render-only | `SeedReceipt.tsx` | **exact** |
| `frontend/src/components/workflows/DecisionsList.tsx` | NEW | component (rows + actions) | live-read + event-driven write | `SeedReceipt.tsx` (shape) + `WorkflowBuilderPage.tsx:1996-2199` (write call-sites) | **exact + role-match** |
| `frontend/src/components/workflows/decisionsVocabulary.ts` | NEW | vocabulary module (copy home) | pure / transform | `templateFirstVocabulary.ts` | **exact** |
| `…/DraftArrivalCard.test.tsx` | NEW | test (composition + source fence) | — | `SeedReceipt.test.tsx:1024-1240` | **exact** |
| `…/DecisionsList.test.tsx` | NEW | test (rows, writes, 3-arm read) | — | `SeedReceipt.test.tsx` | **exact** |
| `…/decisionsVocabulary.test.ts` | NEW | test (char-identity + `?raw` sweep) | — | `governanceVocabulary.test.ts` + `SeedReceipt.test.tsx:1024+` | **exact** |
| `frontend/src/components/workflows/soulData.ts` | MOD | utility (pure derivation) | transform | `soulDeliverable` `soulData.ts:172-183` / `templateAdmission` `:243-276` | **exact** |
| `frontend/src/components/workflows/builderStore.ts` | MOD | store (zustand action) | event-driven write | `setBusinessRequirement` `builderStore.ts:711-727` | **exact** |
| `frontend/src/pages/WorkflowBuilderPage.tsx` | MOD | page / container | composition + callback wiring | itself — `SeedReceipt` mount `:1942-1950`, `onDrafted` `:809-812` | **exact (self)** |
| `frontend/src/components/workflows/useTemplateFirstDraft.ts` | MOD | hook | request-response | itself — `onDrafted` decl `:316-321`, call `:542` | **exact (self)** |
| `frontend/src/lib/api.ts` | MOD | api client (type only) | request-response | `GenerateResult` `api.ts:3431-3434` | **exact (self)** |
| `backend/app/services/workflow_authoring.py` | MOD | service | request-response | its own stamp block `:540-572` | **exact (self)** |
| `backend/app/api/workflows.py` | MOD? | route | request-response | `generate_workflow` `:1594-1630` | ⚠ **likely ZERO change** |
| `backend/app/services/harness/grounding.py` | MOD/READ | predicate module | pure predicate | `business_requirement_missing` `:1007-1013` | **exact** |
| `backend/tests/unit/test_workflow_authoring_requirement.py` | MOD | test (D-14 fence) | — | itself `:1-60`, `:281-290` | **exact (self)** |
| `frontend/src/pages/WorkflowBuilderPage.header.test.tsx` | MOD | test (byte pin) | — | its own two declared re-captures `:307-384` | **exact (self)** |
| `frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx` | MOD | test (extend) | — | its shipped snapshot fences | role-match |
| `scripts/vitest-count-gate.cjs` | MOD | config (pins) | — | `SeedReceipt.test.tsx: 68` `:242`, `soulData.test.ts: 36` `:517` | **exact** |

---

## Pattern Assignments

### `DraftArrivalCard.tsx` (NEW — component, composing parent)

**Analog:** `frontend/src/components/workflows/SeedReceipt.tsx` (360 ln) — ⚠ **read it, do not edit
it (D-02).**

**Imports pattern** — copy the SHAPE exactly: copy home + derivation home + `cn`, and **nothing
from the API client**. `SeedReceipt.tsx:123-144`:

```tsx
import { useId, useMemo } from "react"

import {
  GOVERNANCE_SEAL_LABEL,
  SEED_RECEIPT_DISMISS_GLYPH,
  SEED_RECEIPT_DISMISS_LABEL,
  SEED_RECEIPT_NOTHING_COMMITTED,
  SEED_RECEIPT_ONE_WAY_RULE,
  seedReceiptCarriedLead,
  seedReceiptGroundingLead,
  seedReceiptHeading,
  seedReceiptStepReason,
} from "@/components/workflows/definitionOps"
import {
  groundingCauseOf,
  intersectingKbToolOf,
  nodeTitle,
  …
} from "@/components/workflows/phaseVocabulary"
import { cn } from "@/lib/utils"
```

**The caller-owned-open pattern** (`SeedReceipt.tsx:183-186`, `:236`) — the parent inherits this
verbatim for D-04's dismissal, and it is what lets the parent control the receipt's fold **without
touching `SeedReceipt.tsx`**:

```tsx
  /** Owned by the caller. This component never opens or closes itself. */
  open: boolean
  /** The dismiss control was activated. */
  onDismiss: () => void
…
  if (!open) return null      // :236 — no hidden DOM, no stale focus trap
```

**The card frame + one-shot entrance** (`SeedReceipt.tsx:239-255`) — the parent is the card now, so
this className moves UP to the parent and `SeedReceipt` renders inside it:

```tsx
<section
  data-testid="seed-receipt"
  data-grounded-count={rows.length}
  aria-labelledby={headingId}
  className={cn(
    "w-full max-w-[720px] rounded-[14px] border border-border bg-card px-[18px] py-4 shadow-lg",
    "animate-in fade-in-0 slide-in-from-bottom-1 duration-100 motion-reduce:animate-none",
  )}
>
```

**The dismiss control** (`SeedReceipt.tsx:266-279`) — glyph `aria-hidden`, announcement on the
label, both imported:

```tsx
<button
  type="button"
  data-testid="seed-receipt-dismiss"
  aria-label={SEED_RECEIPT_DISMISS_LABEL}
  onClick={onDismiss}
  className={cn(
    "inline-grid h-5 w-5 shrink-0 place-items-center rounded text-[11px] text-muted-foreground",
    "hover:bg-accent/40 hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary",
  )}
>
  <span aria-hidden="true">{SEED_RECEIPT_DISMISS_GLYPH}</span>
</button>
```

**The closing line** (`SeedReceipt.tsx:352-357`) — D-02 asks for the same "nothing has been
committed" close; **compose the shipped constant, never re-type it**:

```tsx
<p data-testid="seed-receipt-close" className="mt-3 text-[12.5px] leading-[1.5] text-muted-foreground">
  {SEED_RECEIPT_NOTHING_COMMITTED}
</p>
```

⚠ **If the parent renders that constant AND `SeedReceipt` is open, the sentence renders twice.**
That is the one composition detail the sketch's "one card" shape forces a decision on: either the
parent owns the close and passes `open` to a receipt whose own close is inside its `open` branch
(it is — `:352` is after `:236`), or the parent omits it. State the choice; do not discover it.

**Mount site to copy** — `WorkflowBuilderPage.tsx:1942-1950`, the exact JSX the new parent replaces:

```tsx
      <SeedReceipt
        phases={receiptPhases}
        kbTools={kbTools}
        nameContext={nameContext}
        open={showReceipt}
        onDismiss={() => setShowReceipt(false)}
      />
      {graphChild}
```

⚠ **The child count is load-bearing** — `WorkflowBuilderPage.tsx:1891`:

```tsx
<div className="grid min-h-0 min-w-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden [&>*:last-child]:row-start-3">
```

Three children today (view toggle `:1893`, `SeedReceipt` `:1942`, `graphChild` `:1951`). A fourth
lands on the graph's `1fr` row and collapses it. **The parent replaces `<SeedReceipt/>` in place —
it does not sit beside it.**

---

### `DecisionsList.tsx` (NEW — component, live-read + event-driven write)

**Analog A (shape / purity):** `SeedReceipt.tsx` — same charter, same fences.
**Analog B (the write call-sites):** `WorkflowBuilderPage.tsx:1996-2199`.

**Row 1 (KB) — the shipped control, verbatim** (`WorkflowBuilderPage.tsx:1999-2049`). Note the
`data-testid` is deliberately reused across mounts:

```tsx
<select
  data-testid="project-folder-picker"
  aria-label="Knowledge base this workflow searches"
  value={boundFolderId}
  onChange={(e) => {
    const id = e.target.value
    store.getState().setProjectFolder(id || null)
    setHasEdited(true)
  }}
  className="min-w-0 max-w-[220px] truncate bg-transparent text-[11px] …"
>
  <option value="">{UNBOUND_KB_INVITATION}</option>
  {folderOptions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
</select>
```

⚠ **The page's own rule for a second mount** (`WorkflowBuilderPage.tsx:2013-2016`, verbatim):
*"`projectFolderId` (the describe screen's own state) is deliberately NOT written: in the drafted
view the definition is the single source of truth for the binding, and a second copy is the drift
D-14 forbids."* — and `:2085` *"ONE CONTROL, TWO MOUNT POINTS."* **A row that displays + jumps has
one answer; a row that owns its own select has two renders of one answer.** Both are defensible;
the drift rule forbids only a second *different* answer. Say which was taken.

**Row 3 (requirement) — the live read with NO `useState` mirror** (`WorkflowBuilderPage.tsx:2136-2139`)
— this is the idiom every row's "current answer" must copy:

```tsx
const requirementIsAiProposed =
  meta.business_requirement_seeded_by_ai === true &&
  typeof meta.business_requirement === "string" &&
  meta.business_requirement !== ""
```

…and the controlled input's value read (`:2158`), which is the `typeof` narrowing the index
signature forces:

```tsx
value={typeof meta.business_requirement === "string" ? meta.business_requirement : ""}
```

**Row 1/2 controls — props measured, so a mount is costed not guessed.**

`DescribeKbPicker.tsx:81-90` — fully controlled, zero pre-draft assumptions, mountable anywhere:

```ts
export interface DescribeKbPickerProps {
  /** The chosen folder id, or `""` for none. The PARENT owns this — the component holds
   *  no copy of it, so there is no second source to drift from the one that is sent. */
  value: string
  onChange: (id: string) => void
  className?: string
}
```
⚠ It imports `listFolders` from `@/lib/api` (`DescribeKbPicker.tsx:52`) — so it is **not** a
zero-network leaf and it is currently mounted on **one** surface only (`WorkflowDoorSwitch.tsx:373`).
The Builder already carries a **third, hand-rolled** answer (the inline select above), so
"one component, two mounts" is aspirational here, not shipped.

`DescribeTemplateRow.tsx:14-18` records why row 2 must **not** mount either component:

> *"`TemplateAttachSection.tsx` renders this same reading on the deliverable step's rail, and
> reusing it here was measured IMPOSSIBLE rather than merely awkward: it consults the server
> itself, keyed on a saved definition id AND a stored asset id, and NEITHER EXISTS BEFORE A DRAFT
> DOES."*

⚠ **On a FRESH generation there is also no saved definition id** — `WorkflowBuilderPage.tsx:806-807`
sets `setDraftId(null)` on `onDraftStarted`. **Row 2 states + jumps.** Its jump destination is
already mounted: `PhaseFormPanel.tsx:1166` — `{template && pt === "llm_emit" && <TemplateAttachSection {...template} />}`.

**The jump seam rows 2 and 5 share** (`WorkflowBuilderPage.tsx:1569-1570`, already wired at `:1637`):

```tsx
/** A tray row was activated — anchor the panel on that step. Selection only; this is
 *  the D-183-05 contract's one callback, not a second way to open the panel. */
const jumpToStep = useCallback((slug: string) => setSelectedSlug(slug), [])
…
onJumpToStep: jumpToStep,      // :1637
```

**The three-arm union D-13's read must take** — `soulData.ts:243-247`:

```ts
export type TemplateAdmission = "admits" | "does-not-admit" | "unknown"
```
Its docblock (`soulData.ts:184-190`) is the argument to copy verbatim into the readiness read:
*"THE THREE STATES ARE LOAD-BEARING … this is NOT a boolean with a `?? true` at one call site …
`soulDeliverable`, directly above, is the CAUTIONARY precedent: its `def?.phases ?? []` collapses
`null` and `{ phases: [] }` into one answer, which … would be a D-20 violation here."*

---

### `decisionsVocabulary.ts` (NEW — vocabulary module) · **D-10's answer, measured**

**Closest analog in SHAPE: `templateFirstVocabulary.ts` (238 ln).** Not `doorVocabulary.ts`.
`templateFirstVocabulary.ts:5-21` states the mechanical reason in its own words, and it applies
to this phase unchanged:

```
 *   1. **`doorVocabulary.ts` STRUCTURALLY CANNOT HOLD A MESSAGE FUNCTION.** The D-24(a) copy
 *      fence builds its needles by coercing every export of that module through
 *      `(value as string).replace(/&/g, "&amp;")`. A FUNCTION export lands in that expression
 *      and throws inside the needle builder — the fence does not merely fail, it errors before
 *      it can sweep anything.
 *   2. **A runtime FUNCTION exported beside a COMPONENT is a `react-refresh/only-export-components`
 *      lint ERROR** (measured on two shipped files).
```

⚠ **This decides D-10 on a mechanical fact, not taste.** If any of the five sentences states a
count or interpolates a value, it is a **function**, and a function cannot live in
`doorVocabulary.ts`. Row 3's sentence must be `BUSINESS_REQUIREMENT_MISSING_MESSAGE`
character-identical (D-12), which is a const — but rows 1/2/5 plausibly interpolate the current
answer. **A NEW module is the safe pick; extending `templateFirstVocabulary.ts` is the second.**

**Constant + docblock idiom** (`templateFirstVocabulary.ts:100-117`) — the reason lives with the
string, and sibling arms are asserted pairwise distinct:

```ts
/**
 * `footing.unavailable` — the read failed.
 *
 * ⚠ MUST NOT MERGE WITH `FOOTING_NONE`. See the block comment above; this is the one-level-down
 * mirror of the shipped rule, and it is asserted in the suite rather than trusted here.
 */
export const FOOTING_UNAVAILABLE =
  "We could not read this template's fields, so your draft will be written from your description alone."
```

**Function idiom — the caller passes DATA, never a sentence** (`templateFirstVocabulary.ts:134-138`,
rule stated at `:23-32`):

```ts
export function footingFields(count: number): string {
  return count === 1
    ? "Your draft will be built to fill this 1 field."
    : `Your draft will be built to fill these ${count} fields.`
}
```
> `templateFirstVocabulary.ts:25-26` — *"the interpolated half is DATA, and a template assembled at
> the call site is a string that leaks out of this module's fences. A caller may pass a number; a
> caller may never assemble a sentence."*

**Totality guard for any count formatter** (`definitionOps.ts`, the `wholeCount` helper directly
above `seedReceiptHeading`):

```ts
/** Total, non-negative whole count. NaN / negative / fractional all resolve (TOTALITY:
 *  a copy formatter is handed numbers derived from author-supplied JSONB). */
function wholeCount(value: number): number {
  if (!Number.isFinite(value)) return 0
  const whole = Math.trunc(value)
  return whole > 0 ? whole : 0
}
```

**Exhaustiveness guard for any cause→sentence switch** (`definitionOps.ts:788-812`) — a `never`
binding so a sixth row is a *typecheck* error, not a blank line on the card:

```ts
    case null:
      return ""
    default: {
      const _never: never = cause
      void _never
      return ""
    }
```

**A LEAF, asserted not documented** (`templateFirstVocabulary.ts:34-40`):

```
 * ── A TRUE LEAF ───
 * This module imports NOTHING — asserted, not documented, for the reason `doorVocabulary.ts`'s
 * own suite states: a zero-import leaf is what makes the surface's cycle risk one-directional.
 *
 * ⚠ NAME IDENTIFIERS, NEVER WORDS, IN EVERY COMMENT BELOW. This file is swept by the D-24(a)
 * RAW copy fence, prose included.
```
⚠ **Row 3 breaks the zero-import rule if it imports the gate's sentence.** D-12 says the predicate
MOVES; the message is a Python constant (`grounding.py:1000`). **There is no shipped mechanism for
a TS module to import a Python string** — see `## No Analog Found`.

---

### `decisionsVocabulary.test.ts` / `DecisionsList.test.tsx` / `DraftArrivalCard.test.tsx` (NEW — tests)

**Analog:** `SeedReceipt.test.tsx:1024-1240` — the `?raw` source-fence block, with positive
controls throughout.

**The `?raw` import** (`SeedReceipt.test.tsx:84-88`):

```ts
import seedReceiptSource from "./SeedReceipt?raw"
// THIS FILE'S OWN SOURCE, for the testid-coverage sweep at the bottom (187-20). `?raw`
import testSource from "./SeedReceipt.test?raw"
```

**Needles ASSEMBLED FROM PARTS — the Pitfall-7 discipline** (`SeedReceipt.test.tsx:1028-1052`):

```ts
  const UNSHIPPED_MARKS = [String.fromCodePoint(0x2726), String.fromCodePoint(0x2713)]
  const STAGING_NEEDLES = [
    ["set", "Timeout"].join(""),
    ["set", "Interval"].join(""),
    …
  ]
  /** …a grep of this guard file must not be able to satisfy the grep it protects. */
  const CACHE_HOOKS = [["use", "State"].join(""), ["use", "Ref"].join("")]
```

**The fence + its positive control, paired** (`SeedReceipt.test.tsx:1113-1131`) — this is the exact
shape D-09's no-literal-sentence sweep must take:

```ts
  it("imports nothing from the API client and opens no request", () => {
    expect(seedReceiptSource).not.toMatch(/from\s+["']@\/lib\/api["']/)
    expect(seedReceiptSource).not.toMatch(/fetch\(/)
    expect(seedReceiptSource).not.toMatch(/XMLHttpRequest|EventSource|navigator\.sendBeacon/)
  })

  it("POSITIVE CONTROL — it takes its sentences from the one copy home", () => {
    // The half that makes the fence above mean something. An absent API import proves
    // nothing on a file that imports nothing at all.
    expect(seedReceiptSource).toMatch(
      /from\s+["']@\/components\/workflows\/definitionOps["']/,
    )
    expect(seedReceiptSource).toMatch(/SEED_RECEIPT_NOTHING_COMMITTED/)
  })
```

**The "no predicate of its own" property fence** (`SeedReceipt.test.tsx:1195-1222`) — assert the
PROPERTY (one declared function), not a deny-list, plus the rejected-needle notes:

```ts
    const declared = seedReceiptSource.match(declarationRx()) ?? []
    expect(declared).toHaveLength(1)
    expect(declared[0]).toContain("SeedReceipt")
    expect(seedReceiptSource).not.toMatch(/^function\s+\w+/m)
    for (const call of MEMBERSHIP_CALLS) expect(seedReceiptSource).not.toContain(call)
    // POSITIVE CONTROL — it does not merely lack a predicate, it IMPORTS the one home
    expect(seedReceiptSource).toMatch(/intersectingKbToolOf\(phase,\s*kbTools\)/)
```
⚠ Its own recorded rejections are worth copying as *warnings*: a `kbTools`-in-signature needle and
a `for (const ` needle were both **tried and rejected** because they fired on the correct code they
sat beside. *"A fence that does that gets deleted, not fixed."*

**The comment-stripping helper** (`SeedReceipt.test.tsx:1091-1105`) — reuse it verbatim so a
commented-out query cannot satisfy a sweep:

```ts
  function withoutComments(src: string): string {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .split("\n")
      .map((line) => {
        const m = /(^|\s)\/\//.exec(line)
        return m ? line.slice(0, m.index) : line
      })
      .join("\n")
  }
```

**The glob-based corpus sweep** (`governanceVocabulary.test.ts:63-68`) — for the "no literal
sentence anywhere in the new components" arm:

```ts
/** The house `?raw` / `import.meta.glob` idiom (`PhaseFormPanel.rails.test.tsx:422`). */
const WORKFLOW_MODULES = import.meta.glob("./*.{ts,tsx}", {
  query: "?raw",
  eager: true,
  import: "default",
}) as Record<string, string>
```
⚠ `governanceVocabulary.test.ts:24-45` records **three scoping decisions** the new sweep should
inherit: test files excluded; the match scoped to string literals / JSX text **via the TypeScript
parser, never a comment-stripping regex**; and searched tokens assembled from parts. It also names
the cost of getting it wrong — *"the D-ITEM-183-02 trap that cost plans 185-09 and 185-10 three
false positives each."*

---

### `soulData.ts` (MOD — +`terminalEmitSlug`, pure derivation)

**Analog:** its own two neighbours, 60 lines apart.

**The simple derivation to sit beside** (`soulData.ts:172-183`):

```ts
export function soulDeliverable(def: DefShape | null | undefined): SoulDeliverable {
  const phases = def?.phases ?? []
  const hasEmit = phases.some((p) => p.config?.phase_type === "llm_emit")
  if (!hasEmit) return { kind: "chat" }
  const name = def?.name?.trim()
  const label = name ? `${name} · file` : "file deliverable"
  return { kind: "file", label }
}
```
⚠ **Two facts a plan must carry:** (a) it is `phases.some(…)`, **order-independent** — so
`terminalEmitSlug` is NOT a refactor of it and must not be written as one; (b) its label is the
workflow **NAME** plus `· file`, so **rows 4 and 5 are coupled today**.

**The defensive-shape ladder to copy** (`soulData.ts:262-276`) — five numbered arms, each with its
reason, and the jsonb-string-scalar arm is the dominant live shape:

```ts
export function templateAdmission(def: DefShape | null | undefined): TemplateAdmission {
  // (1) The wire did not say. Nullish, or a `phases` the server never sent as an array.
  if (!def || !Array.isArray(def.phases)) return "unknown"
  // (2) An empty `phases` is a stub nobody authored — 110 of 145 published rows.
  if (def.phases.length === 0) return "unknown"
  // (2b) ⚠ A PHASE LIST THAT DECLARES NO `config` AT ALL DESCRIBES NOTHING ABOUT PHASE TYPE
  if (def.phases.every((p) => p?.config?.phase_type === undefined)) return "unknown"
  …
```

**The no-second-derivation rule, stated in-file** (`soulData.ts:236-240`) — quote it in the new
export's docblock:

> *"WHY NOT the simpler 'has an emit phase' (P1′): it is byte-for-byte
> `soulDeliverable(def).kind === "file"` … a second answer to one question is the drift this module
> exists to forbid. Nothing here re-implements a derivation `soulDeliverable` or `tierForDefinition`
> already owns."*

⚠ **Consequence for `terminalEmitSlug`:** it must NOT re-answer *"does this make a file?"*. Its
question is *"WHICH step"*, and it returns `string | null`. **Null when no emit** and — per
`197-VALIDATION.md:95` — **last by `phase_index` when several**, which `soulDeliverable`'s
order-independent `.some()` cannot tell you. That is a genuinely new fact, not a duplicate.

---

### `builderStore.ts` (MOD — +`setName`) · **the expensive row**

**Analog:** `setBusinessRequirement` (`builderStore.ts:711-727`) — the 193.2 move, verbatim:

```ts
        setBusinessRequirement: (text) => {
          const s = get()
          if (s.builderPhase !== "drafted") return
          set({
            meta: {
              ...s.meta,
              business_requirement: text,
              // ONE `set()`: the text and its provenance move together, so no ordering
              // between two writes can exist for a later reader to get wrong.
              business_requirement_seeded_by_ai: false,
            },
            dirty: true,
          })
        },
```

**Its simpler sibling** (`builderStore.ts:620-624`) — the shape `setName` takes if C-1's decline
holds (no provenance flag on row 4):

```ts
        setProjectFolder: (id) => {
          const s = get()
          if (s.builderPhase !== "drafted") return
          set({ meta: { ...s.meta, project_folder_id: id }, dirty: true })
        },
```

**Declaration block where `setName` lands** (`builderStore.ts:290-301`) — copy the comment idiom
that names WHY it arms `dirty` itself:

```ts
  /** Bind (or unbind, with `null`) the workflow's knowledge base. Untracked, and the one
   *  action that arms `dirty` itself — `setProjectFolder`'s docblock in the factory below
   *  says why a `meta`-only edit has to. */
  setProjectFolder: (id: string | null) => void
  /** Set the workflow's one-line business requirement — the publish-required purpose
   *  (BUG-260809-02). Untracked, and arms `dirty` itself for the same reason … */
  setBusinessRequirement: (text: string) => void
```

**The five properties the new action inherits** are stated in `builderStore.ts:631-710` and are
worth copying as the plan's acceptance list — quoted verbatim:

1. *"The `builderPhase !== "drafted"` bail is the shipped guard shape every document-scoped action
   carries, keeping the write out of the composing beat where `meta` is deliberately empty."*
2. *"that subscription arms `dirty` on a change to the **`phases`** reference and on nothing else …
   a genuine definition change the leave guard never noticed."*
3. *"`partialize` … narrows the undo stack to `phases` … an undo restores STEPS, never the
   workflow's identity."* (field-level ⌘Z still works — `WorkflowBuilderPage.tsx:742-744` yields on
   `INPUT`/`TEXTAREA`).
4. *"Comparing the new text against the seeded value, diffing it, or debouncing the decision would
   be exactly the second copy of a server predicate D-182-06 forbids by name."*
5. *"The server owns the emptiness rule … a client that trimmed or nulled here would be a second
   copy of a server predicate."* — **so `setName` does NOT trim and does NOT reject empty.**

**⚠ THE ONE EXCERPT THAT MUST NOT BE COPIED INTO THIS FILE.** `builderStore.ts:186-194` records the
trap in its own words:

> *"this module may not name the API client in ANY import form — `builderStore.test.ts` sweeps this
> source for that specifier, and a type-only import matches its regex exactly like a value one.
> ⚠ AND THE FENCE IS STRICTER THAN IT LOOKS: the sweep reads the RAW source, so it fires on PROSE
> too. An earlier draft of this very docblock quoted the import form it was explaining and turned
> the fence RED."*

**So: `setName`'s docblock may not spell the API-client specifier, in code or in comment.** If it
needs to explain the readiness field's origin, name it by role.

**Typing note, measured** (`WorkflowBuilderPage.tsx:540-548`): `BuilderDefinition` declares `slug`,
`version`, `status`, `business_requirement`, `project_folder_id`, `phases`, then `[k: string]:
unknown`. **`name` is NOT declared**, so `meta.name` types as `unknown`.

```ts
export interface BuilderDefinition {
  slug?: string
  version?: number
  status?: string
  business_requirement?: string
  project_folder_id?: string | null
  phases: PhaseSpecJSON[]
  [k: string]: unknown
}
```
`DefinitionMeta` is a key-remapped mapped type over it (`builderStore.ts:178-180`), spelled that way
because `Omit` collapses an index-signature type to `{}` (`:170-177`). **Prefer declaring
`name?: string`** on `BuilderDefinition` — the alternative is a `typeof meta.name === "string"`
narrow at every read site.

⚠ **`slug` is NEVER written** (D-15). `selectDefinition` (`builderStore.ts:327-329`) spreads `meta`
straight into the PATCH body, so anything `setName` puts on `meta` ships:

```ts
export function selectDefinition(state: Pick<BuilderStoreState, "meta" | "phases">): BuilderDefinition {
  return { ...state.meta, phases: state.phases }
}
```
**That is why the write loop needs zero change — and why a stray key is a 422.**

---

### `WorkflowBuilderPage.tsx` (MOD — mount + payload + one header expression)

**Analog:** itself.

**The snapshot capture to copy for the readiness field** (`WorkflowBuilderPage.tsx:809-812`):

```tsx
    onDrafted: (def) => {
      setShowReceipt(true)
      setReceiptPhases(def.phases)
    },
```
The contract it inherits is `SeedReceiptProps.phases`' docblock (`SeedReceipt.tsx:147-172`):

> *"an immutable SNAPSHOT of one `POST /generate` result, NEVER a live store selector … Hand this
> prop an array that tracks later edits and the card starts narrating the AUTHOR's acts in the AI's
> voice … the contract is the CALLER's to keep, and it is kept in `WorkflowBuilderPage.tsx` —
> `receiptPhases`, captured beside the single `setDrafted` transition and replaced on every draft."*

⚠ **The readiness verdict is the SAME class of value; the five rows' current answers are NOT.**
Snapshot: `receiptPhases`, `readiness`. Live off `meta`, no mirror: `project_folder_id`, `assets`,
`business_requirement`, `business_requirement_seeded_by_ai`, `name`.

**D-19's one expression** (`WorkflowBuilderPage.tsx:2200-2211`):

```tsx
  const identityGroup = (
    <>
      <span className="min-w-0 truncate text-[14px] font-semibold text-foreground">
        {meta.slug ?? "Untitled workflow"}
      </span>
      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
        draft
      </span>
      {kbAffordance}
      {requirementAffordance}
    </>
  )
```

**The pattern for adding a node WITHOUT touching band 3** (`WorkflowBuilderPage.tsx:2181-2190`,
quoted verbatim — this is how 193.2-09 shipped the `AI-proposed` mark for free):

> *"ONE gated sibling INSIDE this affordance, never a new node in `identityGroup` and never a second
> ternary. That placement is not tidiness: band 3 of `FLAG_OFF_HEADER_MARKUP` is the `<header>`
> hosting `identityGroup`, a literal that stood unedited for NINE phases before Phase 193 re-captured
> it twice (words, then structure) and whose own note says the phase expects NO third. Living inside
> the same `canvasEnabled ? (…) : null` as the affordance means the flag-off header cannot see this
> node at all, so band 3 is unmovable BY CONSTRUCTION rather than by care."*

⚠ **D-19 cannot use that escape hatch.** `:2203` is the identity `<span>` itself — outside any
`canvasEnabled` ternary — and band 3's captured literal contains the rendered slug:

```
…<span class="min-w-0 truncate text-[14px] font-semibold text-foreground">vendor-brief</span>…
```
(`WorkflowBuilderPage.header.test.tsx:388`, band 3.) If the fixture definition carries a `name`,
`meta.name ?? meta.slug` changes that text node and band 3 reds. **This IS the third re-capture.**

---

### `WorkflowBuilderPage.header.test.tsx` (MOD — the declared re-capture)

**Analog:** its own two prior re-captures, `WorkflowBuilderPage.header.test.tsx:307-384`. The
procedure is written down; follow it rather than inventing one:

- **The encoder is validated FIRST** (`:353-356`): *"substituted by an ENCODER VALIDATED FIRST —
  re-encoding all three OLD bands had to reproduce this file's own bytes before one new byte was
  written. Nothing was hand-edited."*
- **The diff is characterised as a TABLE** (`:359-364`) — per band, tag deltas vs non-empty text
  nodes, and *"`git diff --numstat` on this file for the substitution: **1 changed line, not 3**."*
- **Text nodes are compared as an ORDERED SEQUENCE, never by position** (`:373-376`) — a naive
  `split(/<[^>]*>/)` reports 8 false "changed" nodes when one node is inserted.
- **The capture is driven twice and must agree byte for byte** (`:352`).
- ⚠ **The note to write** (`:378-382`): the shipped one says *"THIS IS RE-CAPTURE TWO OF TWO, AND
  THE PHASE EXPECTS NO THIRD."* 197's note must say it is the third, name the date, name D-19, and
  state the expected delta is **one text node in band 3 only** — nothing else.

**The two assertions that consume the literal** (`:392-408`) — note the second is an *equality
against the same literal*, deliberately, so the operator/non-operator pair cannot drift:

```tsx
  it("matches the captured flag-off header byte for byte", async () => {
    const { container } = await openDraftBuilder(OFF_VARIANTS[0].value)
    expect(headerMarkup(screen.getByTestId("builder-grid"), container)).toBe(FLAG_OFF_HEADER_MARKUP)
  })
```

---

### `useTemplateFirstDraft.ts` (MOD — the callback widens)

**Analog:** itself. The declaration to widen (`:316-321`):

```ts
  /**
   * The page's DRAFTED-view handoff, as ONE call site — the seed receipt (187-15 / 187-22) is
   * raised here and its two setters never reach this file. Called EXACTLY ONCE per successful
   * generation, with the definition as it was committed to the store.
   */
  onDrafted: (definition: TemplateFirstDefinition) => void
```

**The required-not-optional rule this module states for its own callbacks** (`:322-332`) — apply it
to the readiness arg:

> *"⚠ REQUIRED, not optional, and the reason is the 192.1 rule: a required member makes the
> typechecker enumerate the call sites where a default would let one hide."*

**The single-transition block the new value is captured beside** (`:530-542`):

```ts
      if (result.ok) {
        const def = result.definition as unknown as TemplateFirstDefinition
        if (projectFolderId && !def.project_folder_id) def.project_folder_id = projectFolderId
        store.getState().setDrafted(def)
        onDraftedRef.current(def)
      } else {
        store.getState().setErrorState(result.error, result.detail)
```

**The conditional-send idiom** (`:507-527`) — if anything new is ever SENT, this is the shape, and
its comment states why `[]` and absent are different statements:

```ts
        ...(projectFolderId ? { project_folder_id: projectFolderId } : {}),
        ...(templateRead.kind === "fields" ? { template_placeholders: templateRead.fields } : {}),
```

---

### `frontend/src/lib/api.ts` (MOD — one type arm, no runtime export)

**Analog:** the type it edits (`api.ts:3430-3434`):

```ts
/** The structured result of POST /workflows/generate. The route returns HTTP 200
 *  even on a FAILED generation (`ok:false`) — read the body, never throw on it. */
export type GenerateResult =
  | { ok: true; definition: WorkflowDefinitionJSON }
  | { ok: false; error: string; detail?: string }
```

**A four-arm discriminated union in the same file, for the readiness shape's register**
(`api.ts:3446-3450`) — note the docblock's *"A binary `200 = ok / else = error` handler is
FORBIDDEN"*:

```ts
export type PublishOutcome =
  | { kind: "verdict"; verdict: PublishVerdict }
  | { kind: "business_requirement"; verdict: PublishVerdict }
  | { kind: "not_found" }
```

**The client function, unchanged** (`api.ts:4133-4147`) — it casts the body and throws only on a
real HTTP error, so an added optional field needs **no code change here**:

```ts
export async function generateWorkflow(
  body: GenerateWorkflowBody,
  signal?: AbortSignal,
): Promise<GenerateResult> {
  …
  if (!res.ok) throw new Error(`Failed to generate workflow (status ${res.status})`)
  return (await res.json()) as GenerateResult
}
```
⚠ **Adding a TYPE adds no runtime export**, so `196-08`'s 249-failure trigger (nine suites' explicit
`@/lib/api` mock factories missing a new export) **should not fire**. If any plan adds a runtime
export here, budget one mock line per mounting suite.

---

### `backend/app/services/workflow_authoring.py` (MOD — one key on the success dict)

**Analog:** its own stamp-then-return block (`:552-572`):

```python
    _emitted_requirement = wd.business_requirement
    wd = wd.model_copy(
        update={
            "business_requirement_seeded_by_ai": bool(
                _emitted_requirement
                and _emitted_requirement.strip()
                and _normalised_for_copy_check(_emitted_requirement)
                != _normalised_for_copy_check(describe)
            )
        }
    )
    …
    wd = wd.model_copy(update={"slug": f"{wd.slug}-{uuid.uuid4().hex[:8]}"})

    return {"ok": True, "definition": wd.model_dump(mode="json")}
```

**The pattern:** derive **after** validation, on the **single** success path, with `model_copy`, and
return one dict. D-13's key goes on **that one `return`** at `:572`. The four failure arms
(`:351`, `:358`, `:375`, `:430`) return `{"ok": False, …}` and **must not gain the key** —
`197-VALIDATION.md:86` makes that a criterion.

**What the D-14 fence reads** (`:229-239`):

```python
WF_SCHEMA = _strip_discriminator(copy.deepcopy(WorkflowDefinition.model_json_schema()))

EMIT_TOOL: dict = {
    "type": "function",
    "function": {
        "name": "emit_workflow_definition",
        "description": "Emit a single valid WorkflowDefinition for this task.",
        "parameters": WF_SCHEMA,
    },
}
```

---

### `backend/app/api/workflows.py` (MOD? — **measured: probably zero change**)

**Analog:** the route itself (`:1594-1630`). It declares **no `response_model`** and returns the
service dict untouched:

```python
@router.post(
    "/generate",
    dependencies=[Depends(require_visible("workflow_authoring"))],
)
async def generate_workflow(body: GenerateRequest, …):
    …
    result = await workflow_authoring.generate_workflow_definition(…)
    return result
```

**So there is no FastAPI response schema to widen.** ⚠ **This row is a G-5-firing file
(36/19/1984) that this phase may not need to touch at all** — say so in the plan rather than
opening it.

**D-14 half B's subject** (`:1583-1590`) — the request contract carrying the live fourth D-22
instance:

```python
class GenerateRequest(BaseModel):
    describe: str
    project_folder_id: UUID | None = None
    template_asset_id: UUID | None = None
    template_placeholders: list[str] | None = None
```

---

### `backend/app/services/harness/grounding.py` (READ / MOD — D-12's one source)

**Analog:** the section it lives in (`:986-1013`), whose own header names the rule:

```python
# ── the shared D-13 publish invariant (Pitfall 4 — one source, even trivial) ───

BUSINESS_REQUIREMENT_MISSING_MESSAGE: str = (
    "Add the Business requirement — one line saying what this workflow must deliver — "
    "before publishing."
)


def business_requirement_missing(definition: "WorkflowDefinition") -> bool:
    """The D-13 publish invariant: a workflow must declare exactly one
    ``business_requirement`` before publish.

    Lifted from the inline predicate at publish stage 1 (``publish_service.py``) so BOTH
    publish and the ``/validate`` seam call ONE copy — a trivial check is still a rule,
    and a copy-pasted rule drifts (Pitfall 4 / D-182-06).
    """
    return not (definition.business_requirement or "").strip()
```

**The 187-24 "the predicate MOVES" precedent, in the analog's own words**
(`SeedReceipt.tsx:31-42`) — this is the paragraph D-12 asks the plan to repeat:

> *"It was ASPIRATION until 187-24. This file declared its own `intersectingKbTool` — a second copy
> of the `available_tools ∩ kbTools` loop — one line after the `groundingCauseOf` call it had to
> agree with. The two agreed, and would have gone on agreeing right up until the rule stopped being
> exact string equality … The predicate MOVED (it was not merely checked): `intersectingKbToolOf`
> now sits beside `groundingCauseOf` in `phaseVocabulary.ts` and both … read one `firstKbTool`
> body. THIS COMPONENT NOW DECLARES NO PREDICATE OF ITS OWN — a source fence in
> `SeedReceipt.test.tsx` fails the moment one reappears, with a planted literal proving it can
> fire."*

**The moved-to home, for shape** (`phaseVocabulary.ts:440-446`):

```ts
export function intersectingKbToolOf(
  phase: PhaseSpecJSON,
  kbTools: readonly string[],
): string | null {
  const rawTools = phase.config.available_tools
  return firstKbTool(Array.isArray(rawTools) ? rawTools : [], kbTools)
}
```

⚠ **Per the D-12 audit, this predicate already lives in exactly one place and is already called by
publish stage 1. There is nothing left to MOVE.** What 197 does is *call it from a second consumer*
(the generate path) and ship its verdict on the wire. **Do not "move" it again** — the honest
framing is: `workflow_authoring` imports it, exactly as `publish_service` does. A plan that opens
`grounding.py` to add a second function should justify why the existing one is insufficient.

---

### `backend/tests/unit/test_workflow_authoring_requirement.py` (MOD — D-14's fence)

**Analog:** its own docblock (`:1-56`) — the assertion philosophy binds the new cases:

> *"This file asserts ONLY DETERMINISTIC properties: properties of a string constant, of the JSON
> schema, and of the service's control flow … A reword must not turn this file red; a lost CONTRACT
> must."*
> *"Where a property needs a vocabulary … the vocabulary is a FAMILY of tokens stated in the case's
> own docstring, and **adding a synonym to that family is the correct maintenance action** when the
> prose is reworded — never deleting the case."*
> *"F-8 HAS NO ANALOG … Its numbers are RE-DERIVED from the literal at runtime rather than
> hand-counted, because a hand-counted fence rots exactly the way `GSD_VITEST_MAX_WORKERS=4` did."*

**The absence-assertion + non-vacuity idiom already in this file** (`:281-290`):

```python
FORBIDDEN_PROMISE_TOKENS = ("planned", "coming soon", "deferred", "future release")
FORBIDDEN_PROMISE_RE = re.compile("|".join(FORBIDDEN_PROMISE_TOKENS), re.IGNORECASE)
…
    # The absence assertion cannot pass for the wrong reason: the same regex is shown here
```
**Copy that sentence's discipline:** every `assert not …` gets a sibling that proves the same
detector fires on a plant. `:83` (`PLANTED_OVER_LONG_BULLET`) and `:905` (*"so the refusal cannot
pass for the wrong reason"*) are the two shipped plants to imitate.

⚠ **The needle-in-prose trap applies to Python too.** `197-RESEARCH.md` records it hitting four
times in `196-08`, *including inside the comment written to explain the first three*. **Half B's
allowlist entry must not spell its field name in a docstring the same test greps** — build the
needle at runtime or name it by role. `SeedReceipt.test.tsx:1028-1052` is the reference technique.

---

### `scripts/vitest-count-gate.cjs` (MOD — pins for three new suites)

**Analog:** the two shipped BASELINE rows (`:242`, `:517`):

```js
  "SeedReceipt.test.tsx": 68,
…
  "soulData.test.ts": 36,
```

**The one-knob-vs-two-knob rule, in the script's own comments** (`:129`, `:454`, `:655`, `:731`):

> *"`src/components/workflows` is already a DIRECTORY entry in the `TARGETS` array below, so [the
> file] RAN the moment it landed."*

⚠ **Therefore all three new suites go under `frontend/src/components/workflows/` — one knob
(BASELINE only).** A suite under `src/pages` needs BOTH knobs (`TARGETS` names files only there).
⚠ **Raising a pin necessarily DELETES one line** — a `grep -c '^-[^-]'` expecting 0 on this file is
wrong (CLAUDE.md's ledger row for this script).

---

## Shared Patterns

### 1 · No sentence inside a component (D-09)

**Source:** `SeedReceipt.tsx:12-18` (the charter) + `definitionOps.ts:600-830` (the copy home).
**Apply to:** `DraftArrivalCard.tsx`, `DecisionsList.tsx`, and every string the phase writes.

```
 * ── THIS COMPONENT AUTHORS NO SENTENCE OF ITS OWN, AND CONSULTS NO SERVER ──
 * Every user-visible string is an identifier imported from `definitionOps` … a sentence that
 * lives inside a component is a sentence nobody can test for drift (T-187-10-05). Its suite
 * asserts character-identity against those imported names. This module imports nothing from
 * the API client, names no route and opens no request; a `?raw` fence in `SeedReceipt.test.tsx`
 * proves it, with a positive control.
```

### 2 · Never invent a verdict client-side (D-12 / D-13)

**Source:** `SeedReceipt.tsx:20-29`.
**Apply to:** `DecisionsList.tsx`'s readiness read; the whole D-13 chain.

```
 * ── IT RENDERS A REASON, IT NEVER DECIDES ONE (D-187-08 / T-187-13-02) ──
 * … SPEC Req 5's "rendered from the server's own verdict" is read per D-187-08 as
 * "never INVENT a reason string client-side". The safety-DEFINING input is still the
 * server's; the client only intersects and renders.
```

### 3 · Three arms, never two — absence ≠ green (D-13's floor)

**Source:** `soulData.ts:243-247` + its docblock `:184-196`.
**Apply to:** the readiness prop's type and every read of it.

```ts
export type TemplateAdmission = "admits" | "does-not-admit" | "unknown"
```
> *"THE THREE STATES ARE LOAD-BEARING … this is NOT a boolean with a `?? true` at one call site.
> The card and the Run modal fall back OPPOSITE ways … The asymmetry is a decision, not an
> oversight — do not 'fix' it into consistency, and do not collapse the union to make one call site
> read nicer."*

**Anti-pattern to fence:** `readiness ?? {}` or a two-arm boolean whose `false` branch renders a
tick.

### 4 · The write is ONE `set()`: value + provenance + `dirty`

**Source:** `builderStore.ts:711-727`.
**Apply to:** `setName`, and any future row-write action.
See the excerpt under `builderStore.ts` above, plus its five inherited properties (`:631-710`).

### 5 · Snapshot vs live, kept apart

**Source:** `SeedReceipt.tsx:147-172` (the snapshot contract) + `WorkflowBuilderPage.tsx:2136-2139`
(the live-read idiom, no `useState` mirror).
**Apply to:** every value the card renders. Snapshot = `receiptPhases`, `readiness`.
Live = `meta.project_folder_id`, `meta.assets`, `meta.business_requirement`,
`meta.business_requirement_seeded_by_ai`, `meta.name`.

### 6 · Every fence carries a positive control, and its needles are assembled

**Source:** `SeedReceipt.test.tsx:1028-1052` (assembly), `:1119-1131` (paired control),
`:1195-1222` (property-not-deny-list), `governanceVocabulary.test.ts:24-45` (three scoping
decisions).
**Apply to:** `decisionsVocabulary.test.ts`, `DraftArrivalCard.test.tsx`, `DecisionsList.test.tsx`,
and both halves of the backend D-14 fence.

### 7 · Additive-optional on the definition JSONB, zero migration, stamped server-side

**Source:** `harness.py:540-571` (the `business_requirement_seeded_by_ai` block).
**Apply to:** ONLY if row 4's provenance mark is taken (C-1 declines it).

```
    # Additive-optional, ZERO-MIGRATION: the column is JSONB, so old rows
    # `model_validate()` to the `False` default. **No file under `supabase/migrations/`
    # is added by this phase — there is no migration, and none is needed.**
    …
    # `_StrictBase` sets `ConfigDict(extra="forbid")` (`:38-41`), so an UNDECLARED key
    # 422s the Builder's autosave PATCH — the mark would be destroyed on the first save
    # and could never survive a reload. … This does NOT relax extra="forbid".
    …
    # ⚠ THE ONE RULE A READER COULD OTHERWISE GET WRONG: this marker is STAMPED
    # SERVER-SIDE AFTER validation and is NEVER read off the emitted payload, so a
    # model cannot claim its own text was hand-typed.
```
⚠ **`false` vs `delete` is not interchangeable** (`builderStore.ts:657-668`): `WorkflowDefinition`
declares `bool = False` with no `| None`, so a demote writes **`false`**; `PhaseSpec`'s optional
`name_seeded_by_ai` is **deleted** by `definitionOps.patchPhaseConfig`. `undefined` is refused
outright by `extra="forbid"`.

### 8 · A second *different* answer is drift; a second *render* is not

**Source:** `WorkflowBuilderPage.tsx:2085` and `:2113-2117`.

> *"ONE CONTROL, TWO MOUNT POINTS. This is the same select the describe screen renders, under the
> same test id, over the same `folderOptions`."*

**Apply to:** rows 1 and 3, which route to header controls that already exist. Whichever approach a
plan takes (jump vs re-mount), **name it and cite this line** — the sketch's own shipped defect was
in this class.

---

## No Analog Found

| File / concern | Role | Data flow | Reason |
|---|---|---|---|
| The **D-13 readiness key** on `/generate`'s success dict | service response field | request-response | ⚠ **No shipped precedent for a non-`definition` key on this response.** Every prior additive field landed **inside** the definition model (`business_requirement_seeded_by_ai`, `category`) where `extra="forbid"` and the JSONB round-trip give it a home. A sibling key on the *transport dict* has no analog: it is not persisted, not validated, not round-tripped, and the route declares no `response_model` to describe it. **Design it deliberately** — the nearest shape-only references are `PublishOutcome` (`api.ts:3446-3450`) for a discriminated wire union and `soulData.ts:243` for the three-arm client read. |
| **Row 3's copy sourced from a Python constant** | vocabulary | pure | ⚠ **No mechanism exists.** `BUSINESS_REQUIREMENT_MISSING_MESSAGE` (`grounding.py:1000`) is a Python string; D-12 requires the row's sentence be character-identical to it; D-09 requires the row's sentence be an imported TS identifier. **Nothing in the repo generates TS copy from Python.** The honest options are (a) the message travels **on the wire** inside the D-13 payload and the row renders it verbatim — the shipped `blockedReason` posture (`grounding.py:995-997`: *"It reaches the author VERBATIM … so this string IS the UI copy"*), which is the only one that cannot drift; or (b) a TS constant plus a cross-language byte-identity test, which is *"a test asserting the two lists match"* — **the thing D-12 explicitly rejected.** **Recommend (a).** |
| `terminalEmitSlug`'s "last by `phase_index`" tie-break | utility | transform | No shipped derivation orders phases by `phase_index` for a *pick*. `soulDeliverable` is `.some()`; `templateAdmission` is `.some()`; `reachability.py:111-190` checks contiguity, not selection. Net-new logic — RED-first it against ≥ 2 emit phases. |
| The **G-4 U9 legibility question** (11 px controls) | — | — | Inherits 193.2-09's owed sliver; no automated analog exists and none should be invented. Operator judgement, `197-VALIDATION.md` U9. |

---

## Metadata

**Analog search scope:** `frontend/src/components/workflows/`, `frontend/src/pages/`,
`frontend/src/lib/`, `backend/app/api/`, `backend/app/services/`, `backend/app/models/`,
`backend/tests/unit/`, `scripts/`.
**Files opened and read this session:** 20 (`SeedReceipt.tsx` in full; the rest by targeted,
non-overlapping ranges).
**Analogs extracted:** 17.
**Pattern extraction date:** 2026-08-18.
**⚠ Every `file:line` above was read on `develop` @ `61f779e5`. Re-derive before pinning.**

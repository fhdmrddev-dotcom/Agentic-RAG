# Phase 192: Workflow Library IA — Pattern Map

**Mapped:** 2026-08-10
**Measured against:** `HEAD = a0795512` (branch `develop`) — same SHA RESEARCH.md used
**Files analyzed:** 17 (6 new source modules · 3 new test files · 8 modified)
**Analogs found:** 15 / 17 with a real analog · **2 honest gaps** (see § "No Analog Found")

> Every analog below carries a `file:line` that was opened and read in this pass. Where
> RESEARCH.md's proposed structure is wrong or under-specified against the code, § "Corrections"
> states what was measured. Four corrections are load-bearing; one of them (**C-1**) would make a
> named UAT row fail for a reason 192 did not cause.

---

## File Classification

`frontend/src/components/workflows/library/` **re-verified absent** at this SHA (`ls` →
*No such file or directory*). Every row below with that prefix is created by this phase.

### New source modules

| New file | Role | Data flow | Closest analog | Match quality |
|---|---|---|---|---|
| `library/RunModal.tsx` | component (modal, verbatim move) | request-response (form → `onLaunch`) | `components/workflows/PlaneEditingLayer.tsx` | **exact** — verbatim move out of a hot file, same repo, 188.1 |
| `library/WorkflowDeleteSheet.tsx` | component + owned state (verbatim move) | request-response (preview → destructive write) | `components/workflows/PlaneEditingLayer.tsx` (move mechanics) + `components/workflows/NodeCornerMarks.tsx` (JSX-fragment→component wrapper delta, 188.2) | **exact** |
| `library/WorkflowCard.tsx` | component (new) | transform (row → DOM) + event-driven (verbs) | `WorkflowsPage.tsx:745-870` `PublishedCard` (chrome + `WorkflowSoul` composition + `⋯` host) · `GovernanceSection.tsx:274-309` (the `aria-describedby` reason wiring D-14 requires) | **role-match**, two analogs — see the split below |
| `library/LibraryToolbar.tsx` | component (new) | event-driven (filter state up) | `WorkflowsPage.tsx:675-691` `FilterItem` (the shipped `aria-pressed` toggle) · `DescribeKbPicker.tsx:169-191` (native `<select>` + honest note line) | **role-match** |
| `library/libraryFilter.ts` | utility (pure derivation) | transform | `components/workflows/soulData.ts` (whole file, 172 L) + `deriveTier.ts` (whole file, 129 L) | **exact** |
| `library/libraryVocabulary.ts` | config / copy table | — (static data) | `components/workflows/runVocabulary.ts:1-60` (the locked-words module) · `deriveTier.ts:57-79` `TIERS` (the `as const satisfies` table shape) | **exact** |

### New test files

| New file | Role | Analog | Match |
|---|---|---|---|
| `library/libraryFilter.test.ts` | test (pure unit + `?raw` purity fence) | `soulData.test.ts:1-30` (imports its own `?raw` source to prove purity) · `deriveTier.test.ts:1-40` | **exact** |
| `library/WorkflowCard.test.tsx` | test (component + negative fences + positive controls) | `GovernanceSection.test.tsx:104-142` (title-absence + describedby round-trip + positive control, all four in one describe) | **exact** |
| `library/librarySubtree.fences.test.ts` *(name is discretion)* | test (source fences F1/F4/F5) | `WorkflowCanvas.test.tsx:55-83` (subtree `?raw` glob) + `:669-763` (ESM-cycle fence) · `governanceVocabulary.test.ts:20-180` (word-class fence) | **exact** |

### Modified files

| Modified file | Role | Data flow | Analog for the change | Match |
|---|---|---|---|---|
| `frontend/src/pages/WorkflowsPage.tsx` | page (→ composition) | CRUD + merge | `WorkflowCanvas.tsx` post-188.1 (imports the extracted layer, declares neither) — see `WorkflowCanvas.test.tsx:756-763` for the one-direction assertion | **exact** |
| `frontend/src/lib/api.ts` (`PublishedWorkflow`, `:1349`) | model (wire type) | — | `api.ts` `WorkflowDraftRow` (`:3311`) — the additive-optional-field precedent | **role-match** |
| `backend/app/api/workflows.py` (`PublishedWorkflow`, `:115-128`; two handlers `:212-220`, `:~240`) | model + controller | request-response | `workflows.py:120-123` (`definition` — the ADDITIVE/DEFAULTED docblock) + `:135-148` (`token` — additive with a binding typing rule) | **partial** — see gap **G-A** |
| `backend/app/db/workflows.py` (`:275-289`, `:317-322`) | repository | CRUD (read) | itself — the `owned_only` branch pair is the shape; the change is two column names in three SQL strings | **exact** |
| `scripts/vitest-count-gate.cjs` (`TARGETS` `:992+`, `BASELINE`) | config | — | the `ConnectionsTab.test.tsx` adoption recorded at `:968-974` — the *only* prior entry that needed BOTH knobs | **exact** |
| `frontend/src/pages/WorkflowsPage.test.tsx` | test | — | itself (`:21-57` mock idiom, `:75-152` fixtures) | **exact** |
| `frontend/src/pages/__tests__/RunModal.test.tsx` + `RunModal.a11y.test.tsx` | test (baseline host) | — | `PhaseNodeCard.test.tsx:2555-2683` (the pre-move capture block) | **exact** |
| `frontend/src/pages/__tests__/PublishedCardDelete.test.tsx` | test (baseline host) | — | same as above; its own header (`:1-20`) already enumerates the seven sheet states | **exact** |
| `backend/tests/unit/test_starter_workflows.py` (or a sibling) | test | — | `tests/unit/test_starter_workflows.py:1-60` — the live-`:54322` asyncpg + `skipif` + `finally`-cleanup house shape | **exact** |

---

## Pattern Assignments

### 1. `library/RunModal.tsx` — component, verbatim move

**Analog: `frontend/src/components/workflows/PlaneEditingLayer.tsx`** (188.1's extraction — the only
verbatim component move in this repo with a surviving characterization proof).

**The docblock pattern the move must copy** (`PlaneEditingLayer.tsx:1-52`). Four paragraphs, in this
order, and each one is load-bearing rather than decorative:

```tsx
/**
 * Phase 188.1-03 Task 1 (D-01) — PlaneEditingLayer.
 *
 * THE `＋` / `✕` PLANE LAYER, AND THE MENU IT OPENS. Ten props in, four callbacks out,
 * two React Flow context reads: it owns no state, fetches nothing, and closes over
 * nothing at module scope — which is why it could be lifted out of the canvas shell at
 * all, and the property the next author has to keep true.
 *
 * STATE OF THE EXTRACTION — read this literally, it is not a claim about the future:
 * `PlaneEditingLayerProps` and `PlaneEditingLayer` were CUT out of `WorkflowCanvas.tsx`
 * (they were declared there at `:526` and `:569` ...). It is a HARD CUT: `WorkflowCanvas.tsx`
 * declares neither any more and NO re-export shim was left behind ... The body moved
 * byte-for-byte with its docblock and every inline comment intact — nothing re-typed,
 * nothing tidied, nothing re-ordered — so the phase's first diff reads as a MOVE under
 * `git diff --numstat` rather than as a rewrite a reviewer would have to re-derive.
 *
 * ⚠ THE `:NNN` REFERENCES INSIDE THE MOVED DOCBLOCK POINT AT THE PRE-MOVE
 * `WorkflowCanvas.tsx` (measured 1593 L at `eff79154`), not at this file. Kept as
 * shipped, for the same reason.
 */
```

Copy all three habits: (a) **name what it closes over** in the first paragraph — that is the property
the move depends on; (b) **"HARD CUT … NO re-export shim"** — 188.1's shape, and a shim is what makes
a later `?raw` fence vacuous; (c) **leave the moved `:NNN` references pointing at the pre-move page**
and say so, rather than rewriting them (rewriting them is an edit, and this move must read as a move).

**The one runtime-export rule that decides where things go** (`PlaneEditingLayer.tsx:23-31`, measured
and still true at this SHA):

> `EDIT_AFFORDANCE`, `REVEAL_ON_HOVER`, `insertPointX` and `verticalOffsetFor` went to
> `editAffordance.ts` — a `.ts` leaf — because **a component module may not export a shared runtime
> value**: `react-refresh/only-export-components` errors for exactly that … **SO THIS FILE EXPORTS
> THE COMPONENT AND ITS PROPS TYPE AND NO RUNTIME VALUE OF ANY KIND.**

Consequence for 192, stated so a plan does not rediscover it: `LibraryToolbar.tsx` and
`WorkflowCard.tsx` **may not export** the chip predicate table, the chip labels, or the fork
consequence sentence. Those live in `libraryFilter.ts` / `libraryVocabulary.ts`. That is the mechanical
reason RESEARCH.md's six-module split is right, not a taste call.

**What RunModal closes over** — re-verified at HEAD, matches RESEARCH.md § "The RunModal move":
`useCanvasGate` from `@/pages/WorkflowBuilderPage` (`WorkflowsPage.tsx:53`), `entryInputKeys` +
`DefShape` (`:58`), `PublishedWorkflow` type (`:45`), `Folder` type (`:64`), `cn` (`:30`), and
`Upload, Check, X` from lucide (`:29`). It is already a top-level function with eight props — it
closes over **no page state**, which is the same property that made `PlaneEditingLayer` liftable.

**Extent (corrected — see C-2):** `:1054` (`function RunModal(`) to `:1405` (closing `}`). `:1407` is
`export default WorkflowsPage` and must not move.

---

### 2. `library/WorkflowDeleteSheet.tsx` — component + owned state, verbatim move

**Analog for the move mechanics:** `PlaneEditingLayer.tsx` as above.
**Analog for the wrapper delta:** `PhaseNodeCard.test.tsx:2653-2664` states the rule for moving a
**JSX fragment** (as opposed to a whole component) — and this is the fragment case:

> THE RENDERED DOM must be byte-identical. THE MOVED SOURCE WILL NOT BE … here the moved bodies are
> JSX FRAGMENTS, which must acquire a component wrapper, a props destructure and a props type in
> order to live in a file of their own. Byte-identity is chased for the JSX element bodies and their
> comments … and the wrapper is the ACCEPTED delta.

**The four pieces that move as ONE unit** — read at HEAD, and this is the pitfall RESEARCH.md named:

| Piece | Line | Why it cannot stay behind |
|---|---|---|
| `type DeletePhase = "idle" \| "deleting" \| "deleted" \| "error"` | `:743` | module-level, but declared for this sheet only |
| `sheetOpen` / `preview` / `previewError` / `deletePhase` / `descId` | `:768-772` | **inside `PublishedCard`**, which D-01 deletes |
| `openDeleteSheet` | `:774-786` | calls `getWorkflowDeletePreview` |
| `handleDelete` | `:788-799` | calls `deleteWorkflowCascade`, then `onDeleted()` |
| the `<Sheet>` JSX | `:877-1003` (comment from `:872`) | — |

**The two invariants that must survive, with their shipped source:**

```tsx
// WorkflowsPage.tsx:877-885 — the sheet NEVER dismisses mid-delete
<Sheet
  open={sheetOpen}
  onOpenChange={(o) => {
    // Never dismiss mid-delete (the action is in flight). A confirmed delete stays
    // open on its terminal state until the shelf re-fetch unmounts the card.
    if (!o && deletePhase === "deleting") return
    setSheetOpen(o)
  }}
>
```
```tsx
// WorkflowsPage.tsx:788-799 — the card leaves the list ONLY on server confirmation
const handleDelete = async () => {
  setDeletePhase("deleting")
  try {
    await deleteWorkflowCascade(wf.id)
    setDeletePhase("deleted")
    // Server-confirmed: re-fetch the shelf so the card leaves the list ONLY now
    // (D-LOCK-04 — the list is never filtered locally / optimistically).
    onDeleted()
  } catch {
    setDeletePhase("error")
  }
}
```

**Note the `descId` at `:772` / `:886`** — `const descId = \`wf-delete-${wf.id}\`` wired as
`<SheetContent side="bottom" aria-describedby={descId}>`. RESEARCH.md measured this as *"the only
`aria-describedby` on the page"*: it is therefore the page's **own** precedent for D-14, and the
id-derived-from-row-id shape is exactly what `WorkflowCard`'s fork consequence should copy.

---

### 3. `library/WorkflowCard.tsx` — component, NEW (159-C)

Two analogs, because the card is two things: shipped chrome that is kept, and a new a11y contract.

#### 3a. Composition analog — `WorkflowsPage.tsx:801-870` (`PublishedCard`)

The card consumes `WorkflowSoul` **unchanged**. This is how the three shipped cards do it — identical
in all three (`:717`, `:849`, `:1035`):

```tsx
// WorkflowsPage.tsx:847-849
{/* WUX-01: the shared card-scale soul (tier chip + glyph-dot spine + needs +
    output) replaces the old TierBadge + PhaseChain + "entry needs" trio. */}
<WorkflowSoul def={def} scale="card" />
```
with `const def = wf.definition as DefShape | undefined` (`:761`) — the single cast, and `DefShape`
imported from `soulData`, never re-declared (`:58`).

`StarterCard`'s header docblock (`:1008-1013`) is the precedent for *how* a variant is justified in
this repo — it should be read before writing the unified card, because it is the thing being undone:

```
// Phase 143 (WF-01, D-143-8) — the curated Starter card. Reuses the EXACT PublishedCard
// chrome + the shared <WorkflowSoul scale="card"> (no new card design; G-2 waived), with
// two swaps: a "Starter" chip … and a "Use this" fork affordance …
```

#### 3b. The `⋯` overflow — extend the shipped host, do not invent one

`WorkflowsPage.tsx:820-845`, verbatim. D-09 adds items to this exact structure:

```tsx
<div className="flex flex-none items-center gap-1">
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button
        type="button"
        aria-label="Workflow actions"
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-44">
      <DropdownMenuItem
        data-testid="published-delete"
        className="text-destructive focus:text-destructive"
        onClick={openDeleteSheet}
      >
        <Trash2 className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
        Delete workflow…
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
  <span className="rounded-full border border-primary/40 px-1.5 py-0.5 font-mono text-[9px] uppercase text-primary">
    published
  </span>
</div>
```

Three things to carry forward: `aria-label="Workflow actions"` on the trigger (the menu has no visible
name); the destructive item wears `text-destructive focus:text-destructive` and **nothing else on the
card does** (the 146-148 weight rule — "the destructive weight lands ONLY on Delete-forever in the
sheet", `:817-819`); and every item carries a `data-testid`.

#### 3c. The consequence sentence (D-13/D-14) — **`GovernanceSection.tsx:274-295` is the analog, NOT any card on this page**

The page itself is the anti-pattern here (six `title=` sites). Phase 185's `GovernanceSection` is the
shipped implementation of the rule 192 must follow:

```tsx
// GovernanceSection.tsx:274-295 (excerpt)
<button
  type="button"
  data-testid="governance-dial-loose"
  aria-pressed={!strictOn}
  disabled={refused}
  aria-disabled={refused ? "true" : undefined}
  // The reason is REAL DOM text below, not a title attribute — assistive
  // technology reads the same sentence a sighted author reads.
  aria-describedby={refused ? reasonId : undefined}
  ...
>
  {GROUNDING_DIAL_LOOSE_LABEL}
</button>
```
and its own docblock states the rule verbatim (`GovernanceSection.tsx:30`):
> `aria-describedby` — never a `title` attribute (the 184-07 lesson).

**The label comes from a vocabulary module, not a literal** — `GROUNDING_DIAL_LOOSE_LABEL` is imported.
That is the same seam `libraryVocabulary.ts` provides for `FORK_VERB` / `FORK_CONSEQUENCE`.

#### 3d. The test for 3c — copy `GovernanceSection.test.tsx:104-142` wholesale

Four cases in one describe, and the fourth is why the first three mean anything:

```tsx
it("… the reason is not a title attribute", () => {
  renderSection(AGENT)
  expect(() => screen.getByTitle(GROUNDING_LOCK_REFUSAL)).toThrow()
  expect(looseButton()).not.toHaveAttribute("title")
})

it("wires the loose side to its visible reason via aria-describedby (the round trip)", () => {
  const loose = looseButton()
  const describedBy = loose!.getAttribute("aria-describedby")
  expect(describedBy).toBeTruthy()
  const reason = document.getElementById(describedBy as string)
  expect(reason).not.toBeNull()                       // a dangling id is a silent failure
  expect(reason?.textContent).toBe(GROUNDING_LOCK_REFUSAL)
})

it("POSITIVE CONTROL — an unlocked agent step has NO refusal and no describedby", () => {
  // Without this, every assertion above could pass on a component that always refuses.
  renderSection({ phaseType: "llm_agent", availableTools: ["execute_code"] })
  expect(screen.queryByText(GROUNDING_LOCK_REFUSAL)).toBeNull()
  expect(looseButton()).not.toHaveAttribute("aria-describedby")
})
```

The `document.getElementById(describedBy)` resolution step is the load-bearing half — an
`aria-describedby` pointing at nothing passes a naive attribute assertion.

---

### 4. `library/LibraryToolbar.tsx` — component, NEW

#### 4a. The six chips — `WorkflowsPage.tsx:675-691` (`FilterItem`) is the shipped toggle

It is deleted by D-01, but its *contract* is the analog: a `<button type="button">` with
`aria-pressed`, active/inactive class branch, and no `title`.

```tsx
// WorkflowsPage.tsx:675-691
function FilterItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "flex items-center justify-between rounded-md border px-3 py-1.5 text-left text-[12.5px] transition-colors " +
        (active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-transparent text-muted-foreground hover:bg-accent/40 hover:text-foreground")
      }
    >
      <span className="truncate">{label}</span>
    </button>
  )
}
```

`GovernanceSection.tsx:274-308` is the second `aria-pressed` precedent and the one to copy when a chip
needs a reason attached (D-17's starters-held-out line is exactly that shape).

⚠ **`AuditTab.tsx:470-648` is NOT the analog.** Its "chip strip" is a set of single-select popover
chips (`openChip` state, `:249`), a different instrument from six independent toggles. Named here so a
planner searching for "chip" does not land on it.

#### 4b. The project `<select>` — two shipped native-`<select>` precedents

`DescribeKbPicker.tsx:169-191` is the closer of the two, because it also ships the honest note line
D-17 needs:

```tsx
// DescribeKbPicker.tsx:166-190
// Nothing to offer ⇒ nothing at all. No empty select, no placeholder, no copy.
if (options.length === 0) return stateMarker

return (
  <label className={...}>
    {stateMarker}
    <span className="text-[13px] text-muted-foreground">{DESCRIBE_KB_LABEL}</span>
    <select
      data-testid="project-folder-picker"
      aria-label={DESCRIBE_KB_LABEL}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-[14px] text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
    >
      <option value="">{DESCRIBE_KB_NONE}</option>
      {options.map((f) => (<option key={f.id} value={f.id}>{f.label}</option>))}
    </select>
    <span data-testid="describe-kb-note" className="text-[11.5px] leading-snug text-muted-foreground">
      {DESCRIBE_KB_NOTE}
    </span>
  </label>
)
```

Copy: (a) every label/option/note string is an imported constant, not a literal — the same seam
`libraryVocabulary.ts` gives 192; (b) the `<span data-testid="describe-kb-note">` **note line beneath
the select** is the exact home D-17's *"Starters aren't tied to a project."* wants — it is a shipped
slot, not a new one; (c) the hidden `stateMarker` (`:162-164`) distinguishing *"there are none"* from
*"we could not ask"* is the honest-empty-state mechanism RESEARCH.md's four-state loading rule needs.

`ConnectionPicker.tsx:344-352` is the second precedent and the one that already wires
`aria-describedby` onto a `<select>`:
```tsx
{...(showRefusal ? { "aria-describedby": refusalId } : {})}
```
with its docblock at `:50`: *"Every reason on this surface is real DOM text wired by
`aria-describedby` (142-B …)"*. Its test at `ConnectionPicker.test.tsx:384-389` is the assertion shape.

---

### 5. `library/libraryFilter.ts` — utility, NEW (pure derivation)

**Analog: `components/workflows/soulData.ts` (whole file) and `deriveTier.ts` (whole file).** These are
the repo's two named pure-derivation modules and both are consumed by this phase's chips, so copying
their shape also keeps the new module in the same idiom as its own dependencies.

**The purity claim, stated in the docblock** — this exact sentence is what the `?raw` test fence binds
to. `deriveTier.ts:12-13`:
> Because the derivation is pure and client-side … **This module imports NOTHING from the API client** —
> a tier is computed, never fetched.

`soulData.ts:13-15` repeats it:
> Pure + client-side (D-02): this module surfaces EXISTING definition fields only — no migration, no
> new authoring field, no backend touch. **It imports NOTHING from the API client**; a tier / glyph /
> deliverable is DERIVED, never fetched.

⚠ **One nuance the plan must get right:** `libraryFilter.ts` needs the *types* `PublishedWorkflow` and
`WorkflowDraftRow` from `@/lib/api`. A **type-only** import (`import type { … } from "@/lib/api"`)
keeps the claim true at runtime; a value import breaks it. `runVocabulary.ts:34-36` is the shipped
statement of this exact distinction and the wording to copy:
> Pure data + pure functions. No React, no hooks, no JSX, and exactly TWO imports, **both type-only** —
> so this module contributes nothing to the runtime graph and an ESM cycle is impossible by
> construction.

**The exported-table shape** — `deriveTier.ts:57-79`:
```ts
export const TIERS = {
  STRICT: { id: "STRICT", glyph: "🔒", label: "Strict",
            description: "Citations required; the full gate set enforced.", judgeAlwaysOn: true },
  ...
} as const satisfies Record<TierId, Tier>
```
`as const satisfies Record<K, V>` is the house idiom for a keyed table whose keys are exhaustive — the
six chips' predicate/label table should use it, so a seventh chip is a typecheck error rather than a
silently missing count.

**The exhaustiveness guard with a runtime fallback** — `deriveTier.ts:119-127`, worth copying for any
`provenance` switch:
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

**The "derive, do not re-implement" rule this module is bound by** — `soulData.ts:111-134`
(`tierForDefinition`) and `:161-171` (`soulDeliverable`) are the *only* legal sources for the
🔒 Strict and Makes a file chips. `tierForDefinition` picks the **strictest** policy across multiple
emit phases via `stricterPolicy` (`:100-102`, WR-03) — a naive
`citation_policy === "strict"` check is order-dependent and already has a regression test
(`WorkflowsPage.test.tsx:279`).

**Test analog: `soulData.test.ts:1-30`** — note it imports its own source to prove purity:
```ts
import soulDataSource from "./soulData?raw"
```
That is the mechanical form of the "imports NOTHING from the API client" claim.

---

### 6. `library/libraryVocabulary.ts` — config / copy, NEW

**Analog: `components/workflows/runVocabulary.ts:1-60`.** The whole point of that module is that the
words are LOCKED elsewhere and reflected here:

```
 * The eight LOCKED canvas words (D-188-04, and D-16 for the eighth). They may not be
 * reworded here: CONTEXT locks them and the UI contract's copywriting table repeats
 * them, so a change is a decision taken in those documents and reflected here, never
 * the other way round.
 *
 * ⚠ EXACT-MATCH ASSERTIONS ONLY when testing this table. The eighth word shares the
 * prefix "Not " with the first, so a `toContain` on that fragment is ambiguous and would
 * pass while proving nothing — the same class of vacuous fence the notes below describe.
```

Two habits to copy verbatim for D-08's F5 fence and D-13's consequence sentence: (1) **the words are
locked by CONTEXT.md and mirrored here**, never authored here; (2) **exact-match assertions only** —
D-08's forbidden-word list contains overlapping stems (`meaning` / `means`, `smart` / `smarter`), so
`toContain` is the vacuous-fence trap.

Also copy `runVocabulary.ts:17-32`'s **zero-net-new-glyphs** paragraph, which is directly relevant —
see § "The chip glyphs" below.

---

### 7. `frontend/src/pages/WorkflowsPage.tsx` → composition

**Analog: `WorkflowCanvas.tsx` after 188.1.** The end-state assertion is written down and is copyable
as-is (`WorkflowCanvas.test.tsx:756-763`):

```ts
it("the canvas imports the layer rather than declaring it — the cut has one direction", () => {
  // The other half of "no cycle": the edge exists, and it points one way. Without this
  // the three negatives above are also satisfied by two modules nobody uses.
  expect(workflowCanvasSource).toMatch(
    /import \{ PlaneEditingLayer \} from ["']@\/components\/workflows\/PlaneEditingLayer["']/,
  )
  expect(workflowCanvasSource).not.toContain("function PlaneEditingLayer(")
  // …and no re-export shim was left behind, which is what would quietly preserve the …
})
```

⚠ **`WorkflowBuilderPage.header.test.tsx:842-843` holds a byte-exact source string** of the page's
export line. Do not change `export function WorkflowsPage({ folders, onLaunch }: WorkflowsPageProps) {`.

**The three latest-wins tickets must survive the merge** (`WorkflowsPage.tsx:149-157` + `:164`,
`:171`, `:183`, `:185`, `:190`, `:193`). The comment explaining *why* is the thing to move with them:
```tsx
// ── Latest-wins race guards (Phase 103-ux) ──────────────────────────────────
// Rapid project-filter clicks fire overlapping fetches; without a guard a SLOW
// earlier response can land AFTER a faster later one and paint a STALE list (the
// live symptom: "All projects" showed 7, a specific project showed 16, but the
// rendered list lagged the selection). Each fetch takes a monotonic ticket; only
// the most-recently-issued ticket is allowed to commit its result to state.
const publishedSeqRef = useRef(0)
const startersSeqRef = useRef(0)
const draftsSeqRef = useRef(0)
```
Only `refetchPublished` has `[selectedProjectId]` deps (`:177`); the other two are `[]` (`:187`,
`:195`). That asymmetry is D-17's whole cause and must be preserved, not collapsed.

**The `UNBOUND` sentinel D-17 reuses** — `:67` and the client narrow at `:172-173`:
```tsx
const UNBOUND = "__unbound__"   // :67, module-scope, "not per-render" (IR-04)
...
if (selectedProjectId === UNBOUND) {
  setPublished(rows.filter((r) => !(r.definition as DefShape | undefined)?.project_folder_id))
}
```

---

### 8. Backend — `workflows.py` + `db/workflows.py` (D-04)

**Analog for ADDING the field to the model: `workflows.py:115-128`, the `definition` precedent.** The
docblock is the pattern — it states *why* the field is optional in terms of the callers that must keep
validating:

```python
class PublishedWorkflow(BaseModel):
    """A picker row — the minimum the Deep/Harness toggle needs to list and start
    a workflow ...

    Phase 103-06 (REQ-7 D9/D10): ``definition`` is ADDITIVE — the Workflows page
    card derives its client-side strictness tier + phase chain from the real
    definition JSONB. It is optional so the pre-103 picker callers (the composer
    Harness dropdown) keep validating against the id/slug/name shape unchanged."""

    id: UUID
    slug: str
    name: str
    definition: dict | None = None
```

`DraftCreateResponse.token` / `DraftRow.token` (`:132-168`) is the second precedent and shows the
house habit of stating a **binding typing rule** in the docblock when the field has a trap.

**Analog for the SQL change: `db/workflows.py:272-296`, the `owned_only` branch pair.** The change is
two column names in three SQL strings — one per branch here, one in `list_starter_workflows`
(`:317-322`):

```python
if owned_only:
    sql = (
        "SELECT id, slug, name, definition FROM workflow_definitions "
        "WHERE status = 'published' AND created_by = $1"
    )
else:
    sql = (
        "SELECT id, slug, name, definition FROM workflow_definitions "
        "WHERE status = 'published' AND (is_system_global = true OR created_by = $1)"
    )
params: list = [user_id]
if project_folder_id is not None:
    params.append(str(project_folder_id))  # definition->>'key' returns TEXT → bind str
    sql += f" AND definition->>'project_folder_id' = ${len(params)}"
sql += " ORDER BY name"
```

**Analog for the SERIALIZATION loop: `workflows.py:212-220`** — this is the exact block D-04 extends,
and both handlers must be changed identically:
```python
return [
    PublishedWorkflow(
        id=r["id"], slug=r["slug"], name=r["name"],
        definition=_coerce_definition(r.get("definition")),
    )
    for r in rows
]
```

**The per-caller boolean itself has no analog — see § "No Analog Found" G-A.** The nearest thing in the
tree is `skills.py:213-224`, which is *masking*, not computing:
```python
for row in result.data:
    if row["id"] not in seen:
        seen.add(row["id"])
        # SEED-091 / D-164-05 (TEN-06): hide the seeding owner's identity from non-owner
        # readers of a global/system skill ... RLS gates the row, not the column — null here.
        if (row.get("is_org_shared") or row.get("is_system")) and str(row.get("user_id")) != str(current_user["id"]):
            row["user_id"] = None
        skills.append(row)
```
It emits a **raw owner UUID to owners** and nulls it for everyone else. RESEARCH.md's `is_mine`
recommendation is *stricter* than this precedent, which is the right direction — but it means 192
introduces the pattern rather than copying one. Say so in the plan.

**Backend test analog: `backend/tests/unit/test_starter_workflows.py:1-60`** — the house shape for a
DB-layer test on this exact function, including the RED-first framing, the module-level
`_pg_reachable()` skip guard, and imports **inside** the test bodies so `--collect-only` stays clean.

---

## Shared Patterns

### S-1. The `?raw` subtree fence — name the files BEFORE they exist

**Source:** `WorkflowCanvas.test.tsx:55-83`. **Apply to:** F1 (`title=`), F4 (ESM cycle), F5
(word-class), and any negative fence over `library/**`.

```ts
// ⚠ TWO OF THE THREE PATHS DO NOT EXIST AT THIS COMMIT, AND THAT IS THE POINT.
// … A fence anchored on `WorkflowCanvas?raw` alone would stay GREEN across that move while
// covering 311 fewer lines — an invariance fence says nothing about what it no longer covers,
// and neither the count gate nor `tsc` can see the loss.
// `import.meta.glob` expands at build time over files that EXIST, so a path with no file
// simply has no key in the record and contributes the empty string — it never throws.
const CANVAS_SUBTREE_PATHS = [
  "./WorkflowCanvas.tsx",
  "./PlaneEditingLayer.tsx",
  "./editAffordance.ts",
] as const
const CANVAS_MODULES = import.meta.glob("./*.{ts,tsx}", {
  query: "?raw", eager: true, import: "default",
}) as Record<string, string>
const canvasSubtreeSource = CANVAS_SUBTREE_PATHS.map((p) => CANVAS_MODULES[p] ?? "").join("\n")
```

For 192 this means: write the fence with the **six library module paths listed explicitly** in the
Wave-0 commit, before any of them exists. A bare directory glob would silently cover whatever happens
to be there. (`governanceVocabulary.test.ts:65` cites `PhaseFormPanel.rails.test.tsx:422-426` as the
origin of this idiom; either citation is fine.)

### S-2. The ESM-cycle fence (F4) — copy this file almost verbatim

**Source:** `WorkflowCanvas.test.tsx:669-735`. **Apply to:** every module under `library/`.

```ts
// ⚠ `(\.[jt]sx?)?` IS LOAD-BEARING AND WAS ADDED AT `/gsd:secure-phase 188.2`. … the quote was
// anchored to close immediately after `WorkflowCanvas`, so `from "./WorkflowCanvas.tsx"` evaded it
// in every form. `frontend/tsconfig.app.json:13-14` sets `"moduleResolution": "bundler"` WITH
// `"allowImportingTsExtensions": true`, so that specifier compiles and resolves and would build
// a real TDZ cycle under a green fence.
const IMPORT_FROM_CANVAS = /from\s+["'][^"']*WorkflowCanvas(\.[jt]sx?)?["']/
const DYNAMIC_IMPORT_CANVAS = /import\s*\(\s*["'][^"']*WorkflowCanvas(\.[jt]sx?)?["']\s*\)/
```
with the five positive controls and the two `?raw` negative controls at `:698-724`, then:
```ts
it("neither extracted module names a WorkflowCanvas specifier in ANY import form", () => {
  for (const source of [planeEditingLayerSource, editAffordanceSource]) {
    expect(source).not.toMatch(IMPORT_FROM_CANVAS)
    expect(source).not.toMatch(DYNAMIC_IMPORT_CANVAS)
  }
})
```

For 192: substitute `WorkflowsPage`. **Keep the `(\.[jt]sx?)?` group and keep the `?raw` negative
controls** — this test file itself will import `"../../pages/WorkflowsPage?raw"` (it must, to assert
the one-direction edge), so a fence without the negative control would flag its own import line.

**The layering note to record, not fix:** `useCanvasGate` lives in a *page* module and is imported by
a *component* (`WorkflowsPage.tsx:53`). `library/RunModal.tsx` inherits that import. It is not a cycle
(`WorkflowBuilderPage.tsx` references `WorkflowsPage` only in prose comments), but a reviewer will
notice it — state that 192 did not introduce it.

### S-3. Characterization baselines — capture, prove the capture predates the move

**Source:** `PhaseNodeCard.test.tsx:2555-2683`. **Apply to:** RunModal (6 states) and the delete Sheet
(7 states).

The four mechanisms, all of which should be reproduced:

1. **The rows are declared once**, so capture props and assertion props cannot drift (`:2597-2616`).
2. **One shared render→`innerHTML`→unmount helper** used by *both* capture and assertion (`:2618-2625`):
   ```ts
   function cardHtml(overrides: Partial<React.ComponentProps<typeof PhaseNodeCard>>): string {
     const rendered = renderCard(overrides)
     const html = rendered.container.innerHTML
     rendered.unmount()
     return html
   }
   ```
3. **The literal is labelled a CAPTURE, and observed twice** (`:2628-2651`):
   > ⚠ THIS LITERAL IS A CAPTURE, NOT AN EXPECTATION. Every character below was READ OUT of the
   > rendered DOM … OBSERVED TWICE on the unchanged tree before it was committed, and the two runs
   > agreed byte for byte … A DIFF AGAINST THIS RECORD … IS A BEHAVIOUR CHANGE … AND NOT A TEST TO
   > UPDATE.
4. **Non-vacuity + marker rows** (`:2675-2712`) — byte-identity alone is satisfied by a row that
   rendered nothing:
   ```ts
   expect(CARD_HTML_BASELINE[row].length).toBeGreaterThan(0)
   expect(cardHtml(CARD_HTML_ROWS[row])).toBe(CARD_HTML_BASELINE[row])
   ```
   …then separate `it`s asserting **what each capture contains**, read from the committed string.

**Proof the capture predates the move** (`:2568-2569`, and it is the mechanical form to copy):
> `ls src/components/workflows/NodeRunOverlay.tsx` at this commit answers "No such file or directory".

For 192: `git show <capture-sha>:frontend/src/components/workflows/library/RunModal.tsx` must exit
non-zero.

**Where the baselines live:** `src/pages/__tests__/RunModal.test.tsx` and
`PublishedCardDelete.test.tsx` — both already render the LIVE page (`RunModal.test.tsx:162`,
`PublishedCardDelete.test.tsx:107`) and `PublishedCardDelete.test.tsx:1-20` already enumerates the
sheet's five behaviours. **Neither is in the count gate today**, which is why Wave 0's gate adoption
must land *before* the capture commit.

### S-4. The word-class fence (F5) — `governanceVocabulary.test.ts` is far stronger than a grep

**Source:** `governanceVocabulary.test.ts:20-180`. **Apply to:** D-08's "no copy may imply semantic
search".

Three scoping decisions, each of which 192 needs for the same reason:

```
 * 1. TEST FILES ARE EXCLUDED FROM THE SWEEP. A test that asserts a banned string is absent
 *    must be allowed to NAME it — otherwise this very file is its own first offender …
 * 2. THE MATCH IS SCOPED TO STRING LITERALS AND JSX TEXT, NEVER TO COMMENTS OR DOCBLOCKS.
 *    The rule … is about what a PERSON READS ON SCREEN … The scoping is done with the
 *    TypeScript parser rather than a comment-stripping regex, so a `//` inside a string
 *    literal cannot fool it …
 * 3. THE SEARCHED TOKENS ARE ASSEMBLED FROM PARTS. No banned word appears as a contiguous
 *    literal anywhere in this file, so a whole-`frontend/src` grep by a future phase does not
 *    trip on the guard that forbids the word.
```

The three reusable pieces:
```ts
const userVisibleTextOf = (path, source): string[] => {          // :95-118 — ts.createSourceFile,
  ... ts.isStringLiteralLike | isTemplateHead|Middle|Tail | isJsxText ...   // comments absent by construction
}
const tok = (...parts: string[]): string => parts.join("")        // :128
const BANNED_WORDS = [tok("Prov", "en"), tok("Ungov", "erned"), ...]  // :138-145
const wordRegExp = (word: string) =>                              // :166-167 — explicit lookarounds, not \b
  new RegExp(`(?<![A-Za-z0-9])${escapeForRegExp(word)}(?![A-Za-z0-9])`, "i")
```
plus positive controls that run the **real detector** over synthetic source (`:227-259`), a
comment-exemption control (`:246-251`), a URL trap control (`:257`), and a non-vacuity guard on the
swept file count (`:184-197`).

⚠ **Correction to RESEARCH.md's F5 (see C-3):** the fence must sweep the whole `library/**` subtree,
not `libraryVocabulary.ts` alone.

### S-5. Graded action guards — all three grades, as they ship today

**Apply to:** D-15 (fork = direct flip) and D-18 (draft delete = lighter than the published Sheet).
Pick by precedent, not by taste.

| Grade | Shipped at | The rule, in its own words |
|---|---|---|
| **Heaviest — victim-naming Sheet** | `WorkflowsPage.tsx:877-1003` (moves verbatim) | Exact server counts fetched **before** offering the action (`:774-786`); amber cancel-first banner only when a run is live; never dismisses mid-delete (`:879-883`); no optimistic vanish (`:788-799`). `PublishedCardDelete.test.tsx:1-20` enumerates all five. |
| **Middle — arm-to-confirm** | `MaintenancePanel.tsx:39-129` | `// The arm-to-confirm state — the first click ARMS (does not flip); Confirm flips, Cancel disarms. A single stray click never reaches onSetMaintenance.` (`:40-41`). The armed prompt is direction-aware wording (`:106-110`); Cancel is neutral, Confirm is weighted. |
| **Lightest — direct flip** | `CapabilityGrid.tsx:11-13`, `:151` | `// Graded friction (065-A): capability switches flip DIRECTLY — no confirm dialog. Emergency speed is the point; the platform-wide maintenance switch (its own amber MaintenancePanel) is the one that arms-to-confirm.` |

**Reading for 192:** D-15's fork is the `CapabilityGrid` grade — direct, no dialog, and the *reason*
that grade is legitimate is written in `CapabilityGrid.tsx:11-13`'s own comment (a heavier guard on a
harmless action spends the vocabulary the heavier one relies on). D-18's draft delete sits at the
`MaintenancePanel` grade: **arm-to-confirm is a shipped, demonstrably lighter guard than the Sheet**,
and it is 90 lines of pattern that already exists. Choosing it makes D-18's "demonstrably lighter"
mechanically arguable — Sheet (server preview + victim naming + terminal lifecycle) vs arm (one extra
click, no fetch) — rather than a judgement call.

Note `CapabilityGrid.tsx:15-21`'s honesty rule, which the draft-delete guard inherits: *"We NEVER
fabricate a number — a count-based line renders only when a count prop is actually supplied."* A draft
has no preview endpoint semantics worth quoting (D-18 forbids the cascade path), so its guard must not
imply counts.

### S-6. The search highlight — import, do not re-implement

**Source:** `frontend/src/lib/threadGroups.tsx:126-151`. **Apply to:** D-07.

```tsx
/**
 * Safe match-highlight (T-156-01, the ONE real security control this phase adds).
 *
 * Renders the matched slice inside a `<mark>` as JSX TEXT NODES — React auto-escapes
 * every segment, so a title like `<img src=x onerror=alert(1)>` renders as inert
 * visible text, never a live element. NEVER inject raw HTML …
 */
export function HighlightTitle({ title, query }: { title: string; query: string }) {
  const q = query.trim().toLowerCase()
  if (!q) return <>{title}</>
  const i = title.toLowerCase().indexOf(q)
  if (i < 0) return <>{title}</>
  return (<>{title.slice(0, i)}<mark className="bg-primary/25 text-foreground rounded-[3px] px-px">{title.slice(i, i + q.length)}</mark>{title.slice(i + q.length)}</>)
}
```

Call shape: `<HighlightTitle title={row.name} query={query} />` and
`<HighlightTitle title={row.def?.business_requirement ?? ""} query={query} />`. The prop is named
`title` but the component is thread-agnostic — confirmed by reading it; nothing in the body references
`Thread`.

Two measured facts a plan should carry: (a) it highlights the **first** match only — that is the
shipped behaviour and matching it is correct, but a test asserting "every occurrence is marked" would
fail; (b) `matchesTitle` (`threadGroups.tsx:74`) takes `(t: Thread, q: string)` and is **not** usable
— widening it would be touching the shared engine, which is what 158-B's deferral costed.

The byte-unchanged fence for this file is the same `?raw` mechanism as S-1.

### S-7. Fixture pattern, and how a test creates 200 rows

**Source:** `WorkflowsPage.test.tsx:21-57` (the mock seam) and `:75-152` (four literal fixtures).
Confirmed as the house idiom — `SettingsPage.test.tsx:14` says it *"mirrors the WorkflowsPage.test.tsx
api-mock idiom"*.

```ts
const { mockListPublished, mockListDrafts, mockCreateDraft, /* … */ mockListStarters } = vi.hoisted(() => ({
  mockListPublished: vi.fn(), mockListDrafts: vi.fn(), mockCreateDraft: vi.fn(), /* … */
  mockListStarters: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  listPublishedWorkflows: mockListPublished,
  listDraftWorkflows: mockListDrafts,
  createWorkflowDraft: mockCreateDraft,
  generateWorkflow: mockGenerate,
  updateWorkflowDraft: mockUpdate,
  publishWorkflow: mockPublish,
  listFolders: mockListFolders,
  listSkills: mockListSkills,
  listStarterWorkflows: mockListStarters,
}))
```
⚠ The `vi.mock` factory is **exhaustive** — every api symbol the page *or its hosted Builder or the
Gauntlet* imports must be listed, or the mount throws. Adding `deleteWorkflowDraft` (D-18) means adding
it here too, in the same commit.

**There is no factory and no MSW** — re-verified. **Bulk-generation precedent measured:** the closest
shipped example is `components/panel/__tests__/PhaseReconcile.test.tsx:117`:
```ts
return Array.from({ length: totalPhases }, (_, i): Phase => ({ /* … */ }))
```
— an in-file typed generator. `PendingAskCard.test.tsx:234` (`Array.from({ length: 200 }, …)`) is the
only shipped use of literally 200, and it generates a long string, not rows. So a local
`makePublishedRow(i, overrides)` in the test file is *consistent with the house*, and there is no
third pattern to avoid inventing — but there is also no shared factory to reuse. Vary
`business_requirement`, `citation_policy`, `phase_type` and `project_folder_id` so all six chips and
the search have real spread (the 045 real-scale lesson).

### S-8. The count gate — two knobs, and the adoption comment convention

**Source:** `scripts/vitest-count-gate.cjs:1005-1011` (the closest prior adoption) and `:968-974` (the
one entry that needed both knobs).

```js
// Added post-round-5 (CR-R5-01 / verification truth 14). TARGETS and BASELINE are TWO
// knobs: TARGETS decides what RUNS, BASELINE decides what is PINNED, and a page-level
// suite lands outside BOTH by default because the directory entry above only covers
// `src/components/workflows`. …
"src/pages/WorkflowBuilderPage.describe.test.tsx",
```
and, for the BASELINE side (`:972-974`):
> READ FROM THIS SCRIPT'S OWN PRINTED `pinned total` after the map entry landed, **never by adding 34
> to a figure in this comment** — which is exactly what the paragraphs above mean when they say this
> note has gone stale eight times by being computed rather than read.

Copy both habits: a `TARGETS` entry that **states which existing entry failed to cover the file**, and
a `BASELINE` number read from the gate's own `actual` column across two agreeing runs.

### S-9. The chip glyphs — the vocabulary is closed, and it already answers D-03

`.claude/skills/sketch-findings-agentic-rag/references/icon-convention.md` §4 was read. Two rules bind
D-03 directly:

> **### There is NO category-icon vocabulary — do not invent one**
> The worst of the four drifts: sketch 151 gave each starter workflow **one phase-type glyph as a
> category icon**. That misuses the shared map — `icon3d('llm_agent')` means *"this STEP is an agent
> step"*, not *"this WORKFLOW is about risk"*. Finding **#36** already settled how a whole workflow is
> identified: **its glyph-dot PHASE SPINE**, at every size.

> **### The word-badge carries NO glyph**
> The shipped `waitsForYou` `BadgeSlot` … has a **label and no `glyph`**, tone `primary`. …
> *the WORD carries the meaning; tone is decoration.* Adding an emoji there spends visual budget the
> design deliberately withholds.

**Answer for the six chips:** five of them (*Ready to run · Yours · Still building · Starters · Makes a
file*) get **no glyph at all** — they are word-badges, and inventing marks for them is the exact drift
§4 forbids. The sixth, **🔒 Strict**, already has its mark from shipped vocabulary in two independent
places: `deriveTier.ts:59-60` (`TIERS.STRICT.glyph = "🔒"`) and icon-convention §4's table row
(`🔒 = locked / one-way`, sourced to `GovernanceSection.tsx:280`, `WorkflowDoorSwitch.tsx:159`). Read
it from `TIERS.STRICT.glyph`, never as a literal — that is what makes the chip and the card's tier
atom provably the same mark.

Workflow *identity* on a row is its **phase spine**, already rendered by `WorkflowSoul` →
`PhaseSpine` (`WorkflowSoul.tsx:91`). Nothing new is needed and nothing new may be added.

---

## Corrections to RESEARCH.md and CONTEXT.md (measured this pass)

### C-1 ⚠ HIGHEST IMPACT — UAT row U4's `[title]` count of 0 is **unachievable**, and not because of anything 192 does

RESEARCH.md's U4 pass bar reads: *"`document.querySelectorAll('[title]')` inside the library subtree …
`title` count = **0**"*. Measured:

| File:line | Attribute | Renders inside every library row? |
|---|---|---|
| `WorkflowSoul.tsx:99` | `title={tier.description}` on the tier chip | **YES** — `WorkflowSoul` is on every card (`:717`, `:849`, `:1035`) |
| `PhaseSpine.tsx:77` | `title={name \|\| undefined}` on every spine glyph | **YES** — `WorkflowSoul.tsx:91` renders `<PhaseSpine>` |

Both live in components CONTEXT.md locks as **consumed unchanged**, and `PhaseSpine.tsx:9` documents
the second as deliberate (*"Glyph-only at card scale (names on hover via `title=`)"*). CONTEXT.md
§ `code_context` already records the phase-type hover-only word as a **carried defect, out of scope**
— it just did not connect that to U4.

**Fix:** F1 (the **source** fence over `library/**`) is achievable exactly as written and should ship.
U4's **DOM** sweep must be scoped to the card's own chrome — e.g. clone the row and remove the
`[data-testid="workflow-soul"]` subtree before counting, or count only
`row.querySelectorAll('[title]')` outside that subtree — and the plan must state that the two
remaining `title=`s are `WorkflowSoul`'s and `PhaseSpine`'s, inherited. Left unfixed, U4 fails on
first run and a reviewer reads it as 192's defect.

### C-2 `RunModal` extent — `:1054-1405`, not `:1054-1407`

Confirmed independently: `function RunModal(` at `:1054`; `:1007` closes `StarterCard`'s predecessor
block and `:1053` is blank before it; `export default WorkflowsPage` is the last line. RESEARCH.md
already caught this; restated because a plan task copying CONTEXT.md's range would move the default
export.

### C-3 F5's scope is too narrow as written

RESEARCH.md's F5 says *"No copy in `libraryVocabulary.ts` contains a meaning-search word"* and its
plant is *"Set the placeholder to `Search by meaning…`"*. Those two are inconsistent: the search
input's `placeholder` is authored in `LibraryToolbar.tsx`, and a literal placed there evades a fence
scoped to `libraryVocabulary.ts`. **Scope F5 to the whole `library/**` subtree** using S-1's path list
and S-4's TypeScript-parser extractor — which is what `governanceVocabulary.test.ts` does (it sweeps
`./*.{ts,tsx}` **plus** the Builder page, `:66-77`, precisely because copy leaks out of the vocabulary
module).

### C-4 The backend `is_mine` shape has no analog — do not let the plan imply it does

See § "No Analog Found" G-A. RESEARCH.md presents the Pydantic snippet as though it were the house
pattern; it is a *proposal*. The additive-defaulted-field half **is** the house pattern
(`workflows.py:120-123`); the per-caller computed boolean half is new.

### C-5 RESEARCH.md's module list is right, with one addition worth considering

The six proposed modules survive scrutiny — and the `react-refresh/only-export-components` rule
(`PlaneEditingLayer.tsx:23-31`) is the *mechanical* justification for splitting `libraryFilter.ts` and
`libraryVocabulary.ts` out of the two component modules, which RESEARCH.md argued only on style.

One optional seventh: `phaseNodeCardContract.ts:18-20` is the repo's precedent for a **types-only
leaf** —
> A LEAF, AND A TYPES-ONLY ONE. It emits no runtime code whatsoever … so nothing in it can be called,
> mutated or hot-reloaded, and **it cannot participate in a value-level module cycle at all**.

If `LibraryRow` / `Provenance` are shared by all six modules, a types-only `libraryRow.ts` makes the
F4 cycle fence trivially true for the shared type. Its own docblock notes it is the directory's *first*
types-only module and that the house **ordering** to copy is `deriveTier.ts:24-50` (exported aliases
first, then the exported interface, one docblock per member). This is discretion, not a requirement.

---

## No Analog Found

| File / concern | Role | Data flow | Why there is no analog |
|---|---|---|---|
| **G-A — `is_mine` as a per-caller computed boolean on a response model** (`backend/app/api/workflows.py`) | model | request-response | **Measured: no endpoint in `backend/app/api/` computes a per-caller boolean into a response model.** Searched `app/api/*.py` + `app/services/*.py` for `== str(current_user…)`, `== current_user[…]`, `is_mine`, `is_owner`, `can_edit`, `owned_by_me`. Three hits total, none of them the shape: `admin.py:870` (a self-action *guard*, not a projection), `documents.py:1932` (a *filter* predicate), `skills.py:221` (a *mask* — nulls a raw owner UUID for non-owners). Every ownership decision in this codebase today lives in a `WHERE` clause or a mask. **192 introduces the pattern.** Copy the *additive-defaulted-field* half from `workflows.py:120-123`, and write the boolean's docblock the way `DraftCreateResponse.token` (`:135-148`) writes its binding rule — stating that the value is computed server-side from the authenticated caller and that a raw `created_by` is deliberately not projected (the mig-116 / CR-01 lesson). |
| **G-B — a "quiet updating…" marker over a stale-but-correct list** (D-17 companion rule) | component | event-driven | No shipped surface holds *previously-committed rows with correct counts* while a re-query is in flight. The three latest-wins refs (`WorkflowsPage.tsx:155-157`) prevent the *stale paint*; they do not render an in-flight marker. The nearest relatives are `DescribeKbPicker.tsx:162-164`'s hidden `data-state` marker (which distinguishes *"none"* from *"could not ask"* — the right **idea**, wrong **state**) and `MaintenancePanel.tsx:43,126` (`busy` → spinner on a control, not over a list). **Treat as new pattern**, and reuse `DescribeKbPicker`'s `data-state` marker convention so the state is machine-readable for the `chipCount(c) === renderedRows.filter(pred(c)).length` assertion. |

---

## Metadata

**Analog search scope:** `frontend/src/components/workflows/` (81 files, listed), `frontend/src/lib/`,
`frontend/src/components/admin/`, `frontend/src/pages/`, `backend/app/api/`, `backend/app/db/`,
`backend/tests/unit/`, `scripts/vitest-count-gate.cjs`,
`.claude/skills/sketch-findings-agentic-rag/references/icon-convention.md`.

**Files read in full or in targeted non-overlapping ranges:** `PlaneEditingLayer.tsx:1-110` ·
`deriveTier.ts` (full) · `soulData.ts` (full) · `WorkflowSoul.tsx` (full) ·
`WorkflowsPage.tsx:1-120, :145-214, :660-899, :1006-1055` · `WorkflowCanvas.test.tsx:28-97, :669-763` ·
`PhaseNodeCard.test.tsx:2555-2694` · `threadGroups.tsx:1-30, :118-151` ·
`governanceVocabulary.test.ts:20-199` · `GovernanceSection.tsx:262-311` ·
`GovernanceSection.test.tsx:104-145` · `MaintenancePanel.tsx:35-129` · `CapabilityGrid.tsx:1-30` ·
`DescribeKbPicker.tsx:160-195` · `WorkflowsPage.test.tsx:1-165` ·
`PublishedCardDelete.test.tsx:1-40` · `deriveTier.test.ts:1-40` · `soulData.test.ts:1-30` ·
`runVocabulary.ts:1-60` · `phaseNodeCardContract.ts:1-30` · `api/workflows.py:92-236` ·
`api/skills.py:196-245` · `db/workflows.py:262-323` · `tests/unit/test_starter_workflows.py:1-60` ·
`vitest-count-gate.cjs:960-1014` · `icon-convention.md:1-116`.

**Commands run:** `ls`, `grep -n`, `grep -rn`, `sed -n`. No file was modified.

**Pattern extraction date:** 2026-08-10

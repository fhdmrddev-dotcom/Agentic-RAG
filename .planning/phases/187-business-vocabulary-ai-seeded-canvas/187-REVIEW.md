---
phase: 187-business-vocabulary-ai-seeded-canvas
reviewed: 2026-08-03T00:00:00Z
depth: standard
round: 3 (gap closure)
prior_round:
  reviewed: 2026-08-02T08:43:10Z
  round: 2 (gap closure)
  diff_base: ee5fff3b
  findings: 1 critical / 3 warning / 5 info (plus 10 carried forward)
  scope: 10 files
  prior_round:
    reviewed: 2026-08-02T03:17:14Z
    round: 1
    commit: 20ae79b6
    findings: 2 critical / 7 warning / 5 info
    scope: 38 files (the full phase)
diff_base: f632f9b6
files_reviewed: 4
files_reviewed_list:
  - frontend/src/components/workflows/SeedReceipt.tsx
  - frontend/src/components/workflows/SeedReceipt.test.tsx
  - frontend/src/components/workflows/definitionOps.ts
  - frontend/src/components/workflows/definitionOps.test.ts
findings:
  critical: 1
  warning: 6
  info: 4
  total: 11
carried_forward:
  critical: 0
  warning: 6
  info: 9
  total: 15
status: issues_found
---

# Phase 187: Code Review Report — Round 3 (gap closure)

**Reviewed:** 2026-08-03
**Depth:** standard
**Round:** 3 (gap closure — plans 187-20 / 187-21, diff base `f632f9b6`)
**Files Reviewed:** 4 (2 production source, 2 test)
**Status:** issues_found

## Summary

**Round 3's two round-2 targets are genuinely closed, and — unlike round 2 — round 3 did
not ship its own new production code unguarded.** The production diff over
`f632f9b6..HEAD` is exactly two changes, both covered:

```
$ git diff --stat f632f9b6..HEAD -- frontend/src/components/workflows/
 SeedReceipt.test.tsx  | 173 ++++++++++++++++++++-
 SeedReceipt.tsx       |   3 +
 definitionOps.test.ts |  31 ++--
 definitionOps.ts      |  25 ++-
```

Of the 3 inserted lines in `SeedReceipt.tsx`, one is `data-carried-count={carriedCount}`
(`:230`) and two are its comment; of the 25 in `definitionOps.ts`, two are the sentence
edit (`:633-634`) and 23 are docblock. Both are asserted. Measured, not inherited:

- `npx vitest run` over both suites: **2 files / 288 tests / 0 failing**
  (`definitionOps.test.ts` 228, `SeedReceipt.test.tsx` 60).
- `grep -c "seed-receipt-carried"` → **1** in `SeedReceipt.tsx`, **14** in
  `SeedReceipt.test.tsx` (round 2 measured 1 and 0).
- The deleted clause is gone from every rendered string: `grep -rn "by its own
  settings\|by their own settings" frontend/src` returns **2 hits, both prose**
  (`definitionOps.ts:600`, `definitionOps.test.ts:840`).
- The new testid sweep **does bite**: replaying its logic over a mutated source with one
  new unqueried `data-testid="seed-receipt-brandnew"` reports it missing.

What still blocks is **not** in the diff. It is the property the diff was written to
protect, reached by a path neither round has looked at: **the receipt narrates the arrival
of a generated draft but renders live store state, so after arrival the user's own edit
re-produces CR-01's exact sentence over the user's own act.** That is CR-01 for the third
time, and no test in either suite ever re-renders the component with changed props.

Beyond that, both of round 3's *guards* shipped without the controls their own files
mandate for every other fence: the WR-09 fence is a deny-list of the deleted clause with
no positive control, and the testid sweep has no planted-literal entry in the
"those fences are real" block. Four measured probes show it is satisfiable by a comment
and blind to two other testid spellings.

Direct answers to the round-3 questions, each verified against code rather than docblock:

| # | Question | Verdict |
|---|---|---|
| 1 | Is "every sentence compared character-for-character" true? | **True now.** Section 4 (`:672-693`) enumerates all five: heading, lead, one-way, carried, close; the per-step reasons follow at `:695-705`; `GOVERNANCE_SEAL_LABEL` at `:353` and `SEED_RECEIPT_DISMISS_LABEL` at `:645`. Nothing rendered is un-compared. |
| 2 | Can the testid guard satisfy itself? | **No.** Its needle is `` `ByTestId("${id}")` ``; its own source spells the illustrative form with an ellipsis (`:920`) and its explicit id check as a bare string (`:928`). It fails correctly on a new unqueried id (probed). But it *is* satisfiable by a commented-out query and blind to `data-testid={"…"}` / `{'…'}` — **WR-13**. |
| 3 | Is the carried sentence true of both populations, and can it contradict the row? | **No contradiction of agent** — the clause is deleted. But the residual word *"already"* is a temporal claim, and the only path this surface has to a hand-`escalated` step is an edit made *after* the receipt arrived — **CR-04**. And the actor claim did not disappear, it moved into the row — **WR-11**. |
| 4 | Does every formatter return `""` at zero? | **The two conditional ones do**, and are pinned at `definitionOps.test.ts:801-807` / `:829-836` and re-asserted in the DOM at `SeedReceipt.test.tsx:533`, `:539`. `seedReceiptStepReason(null)` → `""` (`:898`). `seedReceiptHeading(0)` is deliberately non-empty and the heading is unconditional — consistent with D-187-10, which scopes the rule to the two paragraphs. |
| 5 | Did round 3 add a second grounding derivation? | **No.** Round 3 added no derivation at all. A pre-existing second copy of the *intersection predicate* remains — **WR-14**. |

---

## Round 2 disposition

### CR-03 — **CLOSED**

Round 2: the carried paragraph shipped with zero assertions anywhere in the repo.

Evidence of closure, all re-derived at HEAD:

- `seedReceiptCarriedLead` is imported (`SeedReceipt.test.tsx:70`) — round 2 measured the
  import block at eight names without it.
- A dedicated block, `describe("SeedReceipt — the carried paragraph")` (`:491-591`),
  asserts presence, character-identity against the export, the count *derived* from
  `SEALED_SLUGS.length - DETECTED_SLUGS.length` rather than hand-typed, the render-alone
  case, the escalated-only case, and **both** zero cases.
- The docblock's "every sentence" claim was made honest at `:20-28` rather than left
  standing — the section-4 identity case now enumerates the carried sentence (`:685-689`).
- `data-carried-count` was added and pinned at both 1 (`:376-384`) and 0 (`:386-389`),
  which is round 2's own suggested hardening.
- A standing guard was added so the *next* omission fails automatically (`:911-936`).

I could not construct a mutation of the carried paragraph that survives this block:
deleting it fails `:503`; printing `rows.length` fails `:503` and `:513`; drifting the
text fails `:503`, `:513`, `:520` and `:685`.

### WR-09 — **CLOSED for the paragraph; the claim relocated, see WR-11**

The clause is deleted, not reworded (`definitionOps.ts:633-634`), and fenced in both
suites with needles assembled from parts (`definitionOps.test.ts:843-846`,
`SeedReceipt.test.tsx:494-497`). On the escalated-only draft the paragraph now says only
"1 step was already set to must prove it." and the row says "you turned this on by hand" —
those two no longer disagree about *who*.

Two residuals: the fence is a deny-list with no positive control (**WR-12**), and the
actor claim now lives entirely in a row that is handed a cause, not an actor (**WR-11**).

### Still open from earlier rounds — untouched by this diff

`f632f9b6..HEAD` touches four frontend files and no backend file, so none of the following
could have moved. **Not re-litigated here, and still open:**

- Round 2: **WR-08** (`StepTypePicker` `llm_emit` preview vs template asset), **WR-10**
  (hand-transcribed `REPRESENTABLE_CITATION_POLICIES` with no cross-language pin — still
  the entire mechanism holding CR-02 closed, still four hand-typed strings at
  `SeedReceipt.test.tsx:112-117`), **IN-06**, **IN-07**, **IN-08**, **IN-09** (the CR-02
  representability guard at `:301-314` still sweeps only `GROUNDED_PHASES` /
  `BARE_PHASES` / `STRICT_EMIT_ONLY_PHASES` — `ESCALATED_PHASES` at `:206-215` and every
  inline fixture are still outside it), **IN-10** (row order is the caller's array order,
  and `key={row.slug}` / `data-testid={\`seed-receipt-step-${row.slug}\`}` still assume
  slug uniqueness that `removePhase`'s own docblock, `definitionOps.ts:179-182`, says the
  JSONB does not guarantee).
- Round 1 carried-forward: WR-01, WR-04, WR-05, WR-06, WR-07, IN-01 … IN-05.

---

## Round 3 findings

New defects. Ids continue the round-1/round-2 sequence so they cannot collide.

### Critical Issues

#### CR-04: The receipt narrates the arrival but renders LIVE store state — a post-arrival edit makes it claim the user's own act as the AI's, which is CR-01's exact sentence for the third time

**File:** `frontend/src/components/workflows/SeedReceipt.tsx:193-217`, `:208`, `:216`
(mount context: `frontend/src/pages/WorkflowBuilderPage.tsx:573`, `:605`, `:1211`,
`:1636-1642`, `:1245-1251`)

**Issue:**
Every number and every sentence on this card is recomputed from the `phases` prop on every
render:

```tsx
const rows = useMemo<GroundedRow[]>(() => { … }, [phases, kbTools, nameContext])
const heading        = seedReceiptHeading(phases.length)
const detectedCount  = rows.filter((row) => row.cause === "detected").length
const groundingLead  = seedReceiptGroundingLead(detectedCount)
```

The copy those inputs feed is past-tense and first-person: *"Here's what I built — N
steps"*, *"N steps read your documents, **so I set them** to must prove it"*, *"N steps
were **already** set to must prove it"*. Those are claims about one instant — the moment
`/generate` returned. The inputs are not from that instant. Traced:

- `WorkflowBuilderPage.tsx:573` — `const phases = useStore(store, (s) => s.phases)`. The
  **live** selector, not a snapshot of the generated definition.
- `:1636-1642` — `<SeedReceipt phases={phases} kbTools={kbTools} … open={showReceipt} />`.
- `:605` / `:1211` — `showReceipt` is set `true` in `onDraft` and set `false` **only** by
  the dismiss button. Nothing closes it on an edit.
- `:1245-1251` — `onPhaseChange` → `store.getState().patchConfig(slug, patch)`, wired to
  `PhaseFormPanel` at `:1819-1825`, which is rendered as a **sibling of the same graph
  column** — receipt and inspector are on screen together.
- `PhaseFormPanel.tsx:874` / `:926` —
  `onChange({ available_tools: v.split(",").map(…) })`. The tool list is free-text editable
  in the drafted view.

**Failure scenario (every step verified in source; nothing here needs a rare fixture):**

1. Describe → generate. The typical draft ends `llm_agent → llm_emit` with no KB tool
   switched on, so `detectedCount === 0` and no detected paragraph renders — this is the
   case round 2's `STRICT_EMIT_ONLY_PHASES` was written for.
2. The receipt stays open. The author selects the agent step and types
   `search_documents` into its tools field.
3. `patchConfig` → `store.phases` → the receipt re-renders. `groundingCauseOf` now returns
   `detected`, `detectedCount` becomes 1, and the card prints:

   > 1 step reads your documents, **so I set it** to must prove it. You can't turn that
   > off — but you can see exactly where it applies.

   The AI set nothing. **The user did, ten seconds ago.** This is round 1's CR-01 verbatim
   — "the receipt claimed the AI had applied a gate it never touched" — regenerated by a
   different mechanism, on the surface whose entire purpose (SC#3) is that safety is
   attributed to whoever actually applied it.

The same input path also falsifies the other two sentences: pressing `＋` on a lane
increments `phases.length`, so *"Here's what I built — 6 steps"* counts a step the author
built; and flipping the grounding dial (`onGovernanceChange` → `setPhaseGovernance`)
increments `carriedCount`, so *"1 step was **already** set to must prove it"* describes a
lock created after the sentence's own reference point. The residual word "already" in the
WR-09 repair is exactly this: the paragraph no longer says *who*, but it still says
*when*, and on the only path this surface has to a hand-escalated step, "when" is wrong.

**Why no test sees it.** Both suites render once per case and never re-render with mutated
props — `renderReceipt` (`SeedReceipt.test.tsx:223-234`) calls `render` and returns; the
one loop that renders twice (`:581-589`) unmounts between iterations. The CR-01 fence
(`:448-475`) asserts the assembled needle `"so I set"` is absent over three **static**
fixture sets; none of them is a fixture *after an edit*. `WorkflowBuilderPage.canvas.test.tsx`
(`:2360-2427`) drives the receipt through the page but only ever asserts on the
just-generated draft and on dismissal. So the entire coverage estate measures the arrival
frame and nothing after it — which is precisely the frame in which the copy happens to be
true.

**Fix:** make the receipt describe the event it names, by snapshotting at the moment it is
opened rather than tracking the store. The receipt is already a pure leaf, so this is a
caller change plus a prop-doc change:

```tsx
// WorkflowBuilderPage.tsx
const [receiptPhases, setReceiptPhases] = useState<readonly PhaseSpecJSON[] | null>(null)

// …in onDraft, beside the single state transition:
store.getState().setDrafted(def)
// 187-R3/CR-04 — the receipt is a statement about THIS generation. It must be rendered
// from the definition that arrived, never from the live store: after arrival the author's
// own edits are indistinguishable from the AI's, and "so I set them" would claim them.
setReceiptPhases(def.phases)
setShowReceipt(true)

<SeedReceipt
  phases={receiptPhases ?? []}
  …
/>
```

```tsx
// SeedReceipt.tsx — the prop contract must say so, because the copy depends on it
/** The phases **as the generation emitted them** — an immutable snapshot, NOT a live
 *  store selector. Every sentence on this card is past-tense and first-person
 *  ("so I set them"), so a phases array that tracks later edits makes the card claim the
 *  author's own act as the AI's (CR-04). */
phases: readonly PhaseSpecJSON[]
```

If the live reading is deliberate instead, the copy must be re-tensed to describe current
state with no actor (`"1 step reads your documents and must prove it"`), and
`SEED_RECEIPT_ONE_WAY_RULE`'s placement re-examined — but a snapshot is the smaller change
and keeps sketch 150-B's "here is what I built" framing.

**Falsifying test to add (it should be RED before the fix):**

```tsx
it("does not claim the AUTHOR's later edit as its own (CR-04)", () => {
  const APPLICATION_CLAIM = ["so", "I", "set"].join(" ")
  const { rerender } = render(
    <SeedReceipt phases={STRICT_EMIT_ONLY_PHASES} kbTools={KB_TOOLS} open onDismiss={vi.fn()} />,
  )
  expect(screen.getByTestId("seed-receipt").textContent ?? "").not.toContain(APPLICATION_CLAIM)

  // The author switches a KB tool on, in the inspector, with the receipt still open.
  const edited = patchPhaseConfig(STRICT_EMIT_ONLY_PHASES, "gather", {
    phase_type: "llm_agent", available_tools: ["search_documents"],
  })
  rerender(<SeedReceipt phases={edited} kbTools={KB_TOOLS} open onDismiss={vi.fn()} />)
  expect(screen.getByTestId("seed-receipt").textContent ?? "").not.toContain(APPLICATION_CLAIM)
})
```

---

### Warnings

#### WR-11: The WR-09 repair did not delete the actor claim, it concentrated it in the row — and `seedReceiptStepReason` is handed a CAUSE, never an ACTOR

**File:** `frontend/src/components/workflows/definitionOps.ts:661-673`, `:596-613`

**Issue:**
The 187-20 docblock states the repair's logic explicitly (`:611-613`): *"WHICH cause is
stated per row by `seedReceiptStepReason` — the one place that is handed the cause — which
is exactly why the paragraph above the rows must not state one."* But the row's sentence
for that cause is not a statement about a cause, it is a statement about a **person**:

```ts
case "escalated":
  return "you turned this on by hand"
```

`escalated` is `phase.grounding_escalated === true` (`phaseVocabulary.ts:329`, `:353`). The
function receives the bit; it does not receive, and cannot infer, who set it. So the
paragraph's cause claim was removed and the row's actor claim — the stronger of the two —
was left standing under a docblock that presents the row as the *safe* home for it.

Reachability, stated honestly as two separate things:

- **Confirmed:** under CR-04's path the author really did set it, so the row is true and
  only the paragraph's "already" is wrong.
- **Reachable by construction, not observed (hypothesis):** `grounding_escalated` is an
  ordinary `PhaseSpec` field (`backend/app/models/harness.py:234`) and the emit tool's
  schema is the **whole** model —
  `WF_SCHEMA = _strip_discriminator(copy.deepcopy(WorkflowDefinition.model_json_schema()))`
  (`backend/app/services/workflow_authoring.py:140`) — so a model emission carrying
  `grounding_escalated: true` validates and reaches the receipt. On that draft the card
  tells a user who has clicked nothing that they turned a governance lock on by hand. I
  did not drive a generation that produces it, so I record it as reachable-by-schema
  rather than as observed.

**Fix:** say what is known. The bit records that the lock is authored rather than derived;
it does not record the author.

```ts
case "escalated":
  // The bit says the lock is AUTHORED, not who authored it — `/generate` can emit it
  // (WorkflowDefinition's full schema is the emit tool), so "you" may be false. State
  // the fact the cause actually carries.
  return "it was set to must prove it by hand"
```

and, if the second person is wanted, gate it on provenance the client actually holds
(the same shape `name_seeded_by_ai` already uses for names).

---

#### WR-12: The new WR-09 fence in `definitionOps.test.ts` is a deny-list of the exact deleted clause, with no positive control — and its own sibling two lines below documents why that is not acceptable

**File:** `frontend/src/components/workflows/definitionOps.test.ts:838-855`

**Issue:**

```ts
const CAUSE_CLAIMS = [
  ["by", "its",   "own", "settings"].join(" "),
  ["by", "their", "own", "settings"].join(" "),
]
for (const count of [1, 2, 9]) {
  const sentence = seedReceiptCarriedLead(count)
  for (const claim of CAUSE_CLAIMS) expect(sentence).not.toContain(claim)
  expect(sentence).not.toContain(seedReceiptStepReason("escalated"))
  expect(sentence).not.toContain(seedReceiptStepReason("already-set"))
}
```

Measured at HEAD: `grep -rn "by its own settings\|by their own settings" frontend/src`
returns **two hits, both inside comments** (`definitionOps.ts:600`,
`definitionOps.test.ts:840`). Neither is a rendered string. So every needle in this fence
now matches nothing anywhere in the product — the test asserts the absence of strings that
no longer exist.

The file itself states that this is the failure mode a fence must avoid. Nineteen lines
below, `it("the carried sentence CLAIMS NO AUTHORSHIP — with a positive control")`
(`:857-871`) ends:

```ts
// POSITIVE CONTROL — the DETECTED lead really does make that claim, so the fence
// above cannot be passing by asserting the absence of a string nothing ever says.
expect(seedReceiptGroundingLead(2)).toContain(APPLICATION_CLAIM)
```

The new fence has no equivalent. And because it is a **deny-list of one historical
wording**, the next cause attribution written differently — "because of its citation
policy", "set by the deliverable's own rules" — passes it unchanged. This is the recorded
Phase-185 lesson (*a deny-list cannot be made fail-closed by extension*) and the recorded
187 lesson (*verify the PROPERTY not the PATCH*) applied to round 3's own new guard.

The DOM-level sibling (`SeedReceipt.test.tsx:550-576`) does carry a positive control, but
it controls a *different* string (`seedReceiptStepReason("escalated")` appearing in the
row), which proves the row still speaks — not that the paragraph's needles are meaningful.

**Fix:** give the fence a positive control over its own needles, and make the property
checkable rather than the wording:

```ts
it("the carried sentence ATTRIBUTES NO CAUSE — it counts two of them (187-20/WR-09)", () => {
  const CAUSE_CLAIMS = [ /* … */ ]
  // POSITIVE CONTROL — the needles are strings the module CAN produce, so the absences
  // below are measurements and not tautologies.
  const WITH_CLAIM = `1 step was already set to must prove it ${CAUSE_CLAIMS[0]}.`
  for (const claim of CAUSE_CLAIMS) expect(WITH_CLAIM + CAUSE_CLAIMS[1]).toContain(claim)

  for (const count of [1, 2, 9]) {
    const sentence = seedReceiptCarriedLead(count)
    for (const claim of CAUSE_CLAIMS) expect(sentence).not.toContain(claim)
    // THE PROPERTY, not the wording: no causal connective may appear at all.
    expect(sentence).not.toMatch(/\b(because|by its|by their|since|due to)\b/i)
  }
})
```

---

#### WR-13: The testid-coverage guard is lexical and patch-shaped — satisfiable by a comment, blind to two other testid spellings and to the whole `data-*` class that `data-carried-count` belongs to, and it is the only fence in the file with no planted-literal control

**File:** `frontend/src/components/workflows/SeedReceipt.test.tsx:911-936`, `:938-958`

**Issue:**
The guard is a good idea and it does bite in the direction it was written for. I replayed
its exact logic (`/data-testid="([^"]+)"/g` → `testSource.includes(\`ByTestId("${id}")\`)`)
over mutated sources. Measured results:

| probe | result |
|---|---|
| HEAD as-is | 12 ids extracted, 0 missing — and all 12 have real query sites (verified line by line) |
| a new `data-testid="seed-receipt-brandnew"` | **missing → guard fails.** Correct. |
| `data-testid={"seed-receipt-brace"}` | 12 ids, 0 missing — **invisible** |
| `data-testid={'seed-receipt-sneaky'}` | 12 ids, 0 missing — **invisible** |
| a new id whose only "query" is `// screen.getByTestId("seed-receipt-ghost")` in a comment | 0 missing — **passes on a commented-out query** |

Three consequences:

1. **It measures a mention, not coverage.** A query inside a comment, inside `it.skip`, or
   inside a `describe.skip` satisfies it. The guard's own docblock claims more than that:
   *"A paragraph nothing queries can be deleted, can print the wrong number, or can drift
   from its formatter with the whole suite green. … this finds it every run."* It finds
   the *string*, every run.
2. **It is shaped like the patch, not the property.** The blocker it closes was an
   unqueried surface hook. `data-carried-count` — added in the same plan — is the same
   class of hook and is not swept, because the sweep matches only `data-testid`. So do
   `data-grounded-count`, `data-detected-count`, `data-slug` and `data-cause`. All five are
   queried today; none is protected tomorrow.
3. **It is the only fence in section 7 with no entry in `it("those fences are real")`**
   (`:938-958`), which plants a literal for every other pattern in the block — including
   the deliberate non-firing control `expect('<span aria-hidden="true">').not.toMatch(…)`.
   Nothing proves the extraction regex or the needle construction would fail on an
   unqueried id; the two sanity assertions (`unique.length > 0`, `toContain(
   "seed-receipt-carried")`) only prove it is non-vacuous, not that it is falsifiable.

**Fix:** widen the extraction to every spelling and to the sibling attribute class, and
add the missing control:

```ts
// every spelling JSX admits, not only the double-quoted attribute form
const RX = /data-testid=(?:"([^"]+)"|\{\s*["'`]([^"'`]+)["'`]\s*\})/g
const ids = [...seedReceiptSource.matchAll(RX)].map((m) => m[1] ?? m[2])

// …and the STATE attributes are hooks too — `data-carried-count` shipped in the same
// plan as this guard and would not have been caught by it.
const attrs = [...seedReceiptSource.matchAll(/\sdata-([a-z-]+)=\{/g)]
  .map((m) => `data-${m[1]}`)
  .filter((a) => a !== "data-testid")
for (const attr of attrs) expect(testSource).toContain(`"${attr}"`)

// …in `it("those fences are real")`:
expect('<p data-testid="planted-unqueried">').toMatch(RX)
expect(testSource).not.toContain('ByTestId("planted-unqueried")')
```

Stripping block/line comments from `testSource` before the substring check closes the
comment hole in one line.

---

#### WR-14: `SeedReceipt.tsx`'s docblock claims "there is no second derivation to drift" while the file re-implements the `available_tools ∩ kbTools` predicate `groundingCause` owns

**File:** `frontend/src/components/workflows/SeedReceipt.tsx:20-29`, `:170-180`

**Issue:**
The docblock states the D-187-08 property as absolute:

> This file writes no KB tool name and classifies nothing, so a sixth KB tool added
> server-side is picked up here for free and **there is no second derivation to drift**.

`intersectingKbTool` (`:170-180`) is a second derivation of the intersection:

```ts
for (const tool of raw) {
  if (typeof tool === "string" && kbTools.includes(tool)) return tool
}
```

`groundingCause`'s `detected` branch computes the same membership
(`phaseVocabulary.ts:316`: `inputs.availableTools.some((tool) => inputs.kbTools.includes(tool))`
over the string-filtered list built at `:351`). I checked both at HEAD and they **agree**
today — same predicate, same first match — so this is a drift risk, not a live defect. But
the rule the two implement is server-owned (D-185-09), and the day it stops being exact
string membership (case folding, a prefix family, an alias map) the cause and the tool
named inside the reason are updated in two places or they disagree, and the reason will
name a tool the classifier did not count. The docblock currently tells the next reader that
cannot happen.

Second, smaller: `intersectingKbTool` guards `phase.config?.available_tools` while
`groundingCauseOf` reads `phase.config.available_tools` unguarded (`phaseVocabulary.ts:347`)
and is called **one line earlier** (`SeedReceipt.tsx:196`). On the malformed row the `?.`
exists for, the throw has already happened. That is round-2 WR-04's finding reaching this
file; the optional chain here is defensive theatre.

**Fix:** move the tool resolution next to the classifier that owns the rule, and export it —
the receipt then imports both and holds neither:

```ts
// phaseVocabulary.ts, directly under groundingCause
/** The FIRST KB tool this step reaches for, by the same membership rule
 *  `groundingCause`'s detected branch uses. One rule, one place (D-187-08). */
export function intersectingKbToolOf(
  phase: PhaseSpecJSON,
  kbTools: readonly string[],
): string | null { … }
```

and either drop the `?.` in `SeedReceipt.tsx` or narrow the docblock sentence to what the
code holds.

---

#### WR-15: `seedReceiptStepReason`'s `default:` arm silently returns `""` for any future cause, and the row renders it as a dangling em-dash — the same file uses a `never` guard elsewhere for exactly this

**File:** `frontend/src/components/workflows/definitionOps.ts:661-673`,
`frontend/src/components/workflows/SeedReceipt.tsx:318-329`

**Issue:**
`GroundingCause` is `"detected" | "already-set" | "escalated" | null`
(`phaseVocabulary.ts:268`). The formatter's `default:` arm is documented as the `null` case
only, but it swallows every future member as well. `GroundedRow.cause` is
`Exclude<GroundingCause, null>` (`SeedReceipt.tsx:158`), so a fourth cause is admitted to a
row, and the row renders its reason **unconditionally**:

```tsx
<strong data-testid="seed-receipt-step-face">{row.face}</strong>{" "}
—{" "}
<span data-testid="seed-receipt-step-reason">{row.reason}</span>
```

Result: `**Weigh the supplier options** — ` with nothing after the em-dash, on the surface
whose one job is that a seal never arrives unexplained. Nothing typechecks against it and
nothing tests it — `:695-705` asserts the three known reasons in order.

The module already establishes the right idiom 180 lines down, and names it:
`requiredConfigFor`'s `default:` arm is *"the `deriveTier.ts:119-127` runtime-safe
exhaustiveness guard: a 7th union member must be handled here"* (`:836-841`).

**Fix:** apply the file's own idiom, so a new cause is a typecheck error rather than an
empty sentence:

```ts
export function seedReceiptStepReason(cause: GroundingCause, tool?: string | null): string {
  const named = typeof tool === "string" && tool.trim() !== "" ? tool.trim() : null
  switch (cause) {
    case "detected":    return named ? `it reads your documents (${named})` : "it reads your documents"
    case "already-set": return "it already has to cite its sources"
    case "escalated":   return "you turned this on by hand"
    case null:          return ""
    default: {
      // A 4th GroundingCause must get its own sentence here — a seal with no reason is
      // the one thing this card may never render (Req 5).
      const _never: never = cause
      void _never
      return ""
    }
  }
}
```

and, cheaply, assert the invariant in the DOM: every `seed-receipt-step-reason` node has
non-empty `textContent`.

---

#### WR-16: Neither reviewed suite is pinned by `vitest-count-gate.cjs`, so the 13 tests that close CR-03 can be deleted with the gate green — the exact regression class the gate exists for

**File:** `scripts/vitest-count-gate.cjs:70-88` (evidence), affecting
`frontend/src/components/workflows/SeedReceipt.test.tsx` and
`frontend/src/components/workflows/definitionOps.test.ts`

**Issue:**
The gate's `BASELINE` map lists 16 files (`:70-88`); `grep -n "definitionOps\|SeedReceipt"
scripts/vitest-count-gate.cjs` returns **nothing**. Both suites fall inside the
`src/components/workflows` target glob, so they run and count toward `numTotalTests`, but
neither has a per-file pin — and `BASELINE_TOTAL` is 415 while these two alone contribute
288 (`definitionOps.test.ts` 228, `SeedReceipt.test.tsx` 60, measured from the JSON
reporter), so the total is far enough above the floor to absorb a large deletion.

`SeedReceipt.test.tsx`'s own docblock records the "postdates the pin, reports as `new`"
status as a deliberate choice (`:6-11`). It was correct when the file had no load-bearing
guard in it. It is no longer: the file now holds the entire CR-03 repair *and* the standing
testid sweep, and the `definitionOps.test.ts` block holds the WR-09 fence. Deleting
`describe("SeedReceipt — the carried paragraph")` returns the repo to the exact state
round 2 blocked on, with `vitest-count-gate.cjs` green — which is verbatim the Phase-177
lesson the script's own header cites as its reason for existing.

**Fix:** pin both files now, with counts read from the script's own `actual` column (never
hand-computed), in the same commit as this round:

```js
const BASELINE = {
  "canvasModel.fixtures.test.ts": 100,
  // 187-R3: the two suites carrying the whole Req-5 governance-honesty estate. Pinned
  // once they became load-bearing (the CR-03 repair + the testid sweep live here).
  "definitionOps.test.ts": 228,
  "SeedReceipt.test.tsx": 60,
  …
}
```

---

### Info

#### IN-11: `CAUSE_CLAIMS` is declared twice, verbatim, in two suites

**File:** `frontend/src/components/workflows/SeedReceipt.test.tsx:494-497`,
`frontend/src/components/workflows/definitionOps.test.ts:843-846`
**Issue:** The same two assembled needles are hand-built in both files. The whole reason
the copy lives in `definitionOps` is that two copies of a locked string in two files can
drift; the *fence over* that string now has the property the string does not.
**Fix:** export the assembled array once from a shared test helper (or from
`definitionOps.test.ts`) and import it, keeping the assemble-from-parts idiom in one place.

#### IN-12: `definitionOps.test.ts:881` hardcodes a fragment of `SEED_RECEIPT_ONE_WAY_RULE` instead of deriving it

**File:** `frontend/src/components/workflows/definitionOps.test.ts:880-881`
**Issue:**
```ts
expect(sentence).not.toContain(SEED_RECEIPT_ONE_WAY_RULE)
expect(sentence.toLowerCase()).not.toContain("turn that off")
```
The first line derives; the second re-types a fragment of the same constant. If the rule's
wording changes, the second assertion silently stops describing it. (Pre-existing, 187-16.)
**Fix:** derive both — e.g. assert against the constant's first clause via `split("—")[0]`.

#### IN-13: The "never prints a slug" guard passes on `contracts` by a capitalisation coincidence

**File:** `frontend/src/components/workflows/SeedReceipt.test.tsx:776-782`, `:140`
**Issue:** The guard asserts the card's `textContent` does not contain each fixture slug.
Slug `contracts` is rendered as part of the name `"Search Supplier Contracts"` (`:140`);
`toContain` is case-sensitive, so the guard passes only because the fixture capitalises the
word. Renaming the fixture to sentence case would fail a test about slugs on a card that
prints no slug — a false positive waiting on an unrelated edit.
**Fix:** pick slugs that are not substrings of any fixture name in any casing (the
`policy_check` fixture already does this deliberately, `:144-146`), or compare
case-sensitively against a slug set that shares no token with the names.

#### IN-14: `data-grounded-count` means "sealed", and the suite that reads it calls it SEALED

**File:** `frontend/src/components/workflows/SeedReceipt.tsx:222-230`,
`frontend/src/components/workflows/SeedReceipt.test.tsx:169`, `:358-364`
**Issue:** Three sibling attributes now expose three facts, but only two of the three names
match the vocabulary the rest of the phase uses: `data-grounded-count` carries
`rows.length` (the SEALED total), and its test is titled *"marks the SEALED count"* over
`SEALED_SLUGS`. Round 2's CR-01 was, at root, one word standing for two facts.
**Fix:** rename to `data-sealed-count` (with `data-detected-count` / `data-carried-count`
unchanged) so the surface, the suite and the sketch vocabulary use one word per fact.

---

## Notes on scope

- **Verified sound, recorded so it is not re-litigated.** Round 3 did **not** repeat CR-02:
  `ESCALATED_PHASES` is a representable fixture — `grounding_escalated: bool = False` is a
  real `PhaseSpec` field (`backend/app/models/harness.py:234`) and reachable both from the
  generator's schema and from `setPhaseGovernance`. The `?raw` self-import resolves
  correctly (all 12 needles are found; a wrong resolution would fail all 12). No hook is
  called conditionally — `useId`/`useMemo` both precede `if (!open) return null`. XSS is
  clean: every server- or model-authored string is a text child or an attribute value, and
  `dangerouslySetInnerHTML` appears nowhere (fenced at `:899-901`).
- **Performance is out of v1 scope.** Not reported: `detectedCount`/`carriedCount` are
  recomputed outside the `useMemo`, and `nameContext` is an object dependency that busts
  the memo on any page re-render that rebuilds it. Neither is a correctness issue.
- **Backend and cross-provider concerns are out of scope for this round** per the review
  brief; `harness.py` and `workflow_authoring.py` are cited only as evidence for
  reachability claims, not reviewed.
- **`tsc`/lint were not re-run** for this round — the diff adds no new type surface beyond
  one JSX attribute and one import, and both suites transform and run clean.

---

_Reviewed: 2026-08-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard · Round 3 (gap closure) · diff base `f632f9b6`_

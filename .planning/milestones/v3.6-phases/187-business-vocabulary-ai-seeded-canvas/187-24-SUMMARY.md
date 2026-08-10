---
phase: 187-business-vocabulary-ai-seeded-canvas
plan: 24
subsystem: workflow-studio-frontend
tags: [governance, seed-receipt, WR-12, WR-13, WR-14, falsification, one-home]
requires:
  - "183-02 (phaseVocabulary — the one shared vocabulary module)"
  - "185-07 (groundingCause / groundingCauseOf — the one client grounding derivation)"
  - "187-13 (SeedReceipt + its suite)"
  - "187-20 (the WR-09 fence and the testid sweep this plan repairs)"
  - "187-22 / 187-23 (the two prior gap-closure rounds on the same files)"
provides:
  - "firstKbTool — the `available_tools ∩ kbTools` membership rule in ONE body, read by groundingCause AND by the new intersectingKbToolOf"
  - "intersectingKbToolOf — the phase-shaped tool resolver, moved out of SeedReceipt.tsx"
  - "an AGREEMENT biconditional over a 12-phase table, falsifiable by a case-differing input"
  - "the WR-09 fence as a word-class PROPERTY with a positive control over its own needles"
  - "a testid sweep that measures COVERAGE — every static spelling, comments stripped, sibling data-* class swept, five probes observed red"
affects:
  - frontend/src/components/workflows/phaseVocabulary.ts
  - frontend/src/components/workflows/SeedReceipt.tsx
tech-stack:
  added: []
  patterns:
    - "one predicate, one body, read by both consumers — agreement by construction, not by coincidence"
    - "a fence gets a positive control over ITS OWN needles, inside the same `it` as the absences it justifies"
    - "widen a fence to the PROPERTY; keep the deny-list beneath it as a regression pin, never as the fence"
    - "a review's suggested regex is a claim — measure it before adopting it (WR-13's proposed RX swallowed the template row testid)"
key-files:
  created: []
  modified:
    - frontend/src/components/workflows/phaseVocabulary.ts
    - frontend/src/components/workflows/phaseVocabulary.test.ts
    - frontend/src/components/workflows/SeedReceipt.tsx
    - frontend/src/components/workflows/SeedReceipt.test.tsx
    - frontend/src/components/workflows/definitionOps.test.ts
    - .planning/phases/187-business-vocabulary-ai-seeded-canvas/deferred-items.md
decisions:
  - "The membership rule is extracted to a SHARED `firstKbTool` body rather than duplicated-but-verified: the must_have says both must read ONE predicate, so agreement is by construction"
  - "`intersectingKbToolOf` mirrors `groundingCauseOf`'s read EXACTLY, including its unguarded `phase.config` — the receipt's `?.` was deleted as unreachable theatre (D-ITEM-187-24-01 logged, not silently widened)"
  - "WR-13's proposed extraction regex was REJECTED after measurement: it admits backticks and swallows `seed-receipt-step-${row.slug}` as a static id"
  - "Two needles were tried and rejected for firing on correct code — a `kbTools`-in-signature needle and a `for (const ` needle. Both recorded in the guard rather than deleted silently"
metrics:
  duration: ~65 min
  tasks: 3
  commits: 3
  completed: 2026-08-03
---

# Phase 187 Plan 24: one predicate with one home, and two guards observed biting Summary

The `available_tools ∩ kbTools` membership rule now exists in exactly one body that both the
classifier and the tool-naming resolver read — so the tool printed inside a `detected` reason
can no longer disagree with the cause that put it there — and round 3's two new guards, which
shipped without the controls their own files mandate, have each been observed failing on a
defect they previously passed.

## Task-by-task

| Task | Name | Commit | Files |
|---|---|---|---|
| 1 | One membership rule, one home (WR-14) | `c4972bde` | `phaseVocabulary.ts` (+58/−1), `SeedReceipt.tsx` (+15/−22), `phaseVocabulary.test.ts` (+199), `SeedReceipt.test.tsx` (+82) |
| 2 | The WR-09 fence gets a control and a property (WR-12) | `576a0e31` | `definitionOps.test.ts` (+125/−4) |
| 3 | The coverage sweep measures coverage (WR-13) | `17c6e338` | `SeedReceipt.test.tsx` (+157/−6) |

---

## 1. Re-measured baselines (never inherited)

Every figure below was produced at HEAD **before** any edit in this plan.

```
$ cd frontend && npx vitest run <the six suites>
      Tests  463 passed (463)
```

| File | Before | After | Δ |
|---|---|---|---|
| `phaseVocabulary.test.ts` | 90 | **96** | +6 |
| `phaseVocabulary.corpus.test.ts` | 45 | 45 | 0 |
| `SeedReceipt.test.tsx` | 66 | **68** | +2 |
| `PhaseSpineGraph.test.tsx` | 20 | 20 | 0 |
| `PhaseSpine.test.tsx` | 11 | 11 | 0 |
| `definitionOps.test.ts` | 231 | **232** | +1 |
| `StepTypePicker.test.tsx` (untouched, in the named set) | 43 | 43 | 0 |
| **the named five-suite set** | **475** | **484** | **+9** |

No pinned file's count decreased. Nothing was absorbed or replaced (the Phase-177
coverage-loss class): the only pre-existing cases edited are the WR-09 fence and the testid
sweep, both of which this plan exists to strengthen, and both of which gained assertions
rather than losing any.

### Typecheck — before and after every task

```
$ npx tsc --noEmit -p tsconfig.app.json   BEFORE  → exit 2, 33 error lines, 0 in this plan's files
                                          after T1 → 33, BYTE-IDENTICAL to baseline
                                          after T2 → 33, BYTE-IDENTICAL
                                          after T3 → 33, BYTE-IDENTICAL
```

33 → 33 against the recorded `D-ITEM-01` baseline, and every output is byte-identical to the
"before", so not one error moved, changed shape or changed file. (Per `D-ITEM-187-23-02`, the
bare `npx tsc --noEmit` the plan spells is VACUOUS in `frontend/` — the root tsconfig is a
solution file with `files: []`. The `-p tsconfig.app.json` form is the one that measures.)

### Scope

```
$ git diff --name-only -- backend/ supabase/migrations   → (empty), after every task
$ git status --porcelain supabase/migrations             → (empty)
```

Zero migrations, zero backend files. No SDK completion verb (`requirements.mark-complete`,
`state.advance-plan`, `roadmap.update-plan-progress`) was called by any task.

---

## 2. Task 1 — the second derivation is retired

### What was actually there

`SeedReceipt.tsx` declared `intersectingKbTool` and called it **one line after**
`groundingCauseOf`, while its module docblock told the next reader *"there is no second
derivation to drift"*. The two agreed at HEAD — this was a drift risk, not a live defect —
and would have gone on agreeing exactly as long as the server-owned rule stayed exact string
equality.

### The fix, stated as a property rather than a comment about one

The predicate did not merely move; the **membership test itself was extracted**:

```ts
// phaseVocabulary.ts
function firstKbTool(availableTools: readonly unknown[], kbTools: readonly string[]): string | null

groundingCause:        if (hasDial && firstKbTool(inputs.availableTools, inputs.kbTools) !== null)
intersectingKbToolOf:  return firstKbTool(Array.isArray(rawTools) ? rawTools : [], kbTools)
```

Both consumers read ONE body. The must_have — *"both read one predicate"* — is now a fact
about the code, which is what makes the docblock's claim true by construction rather than by
hope. `groundingCause`'s branch is behaviour-identical: `.some(p)` became
`firstKbTool(...) !== null` over the same predicate, and the extra `typeof` filter is a no-op
on the `readonly string[]` that branch is typed to receive.

### The guard that survives — decided deliberately

The review flagged that `intersectingKbTool` guarded `phase.config?.available_tools` while
`groundingCauseOf` reads `phase.config.available_tools` unguarded one line earlier, so the
optional chain was defensive theatre.

**Decision: the loose-JSONB guard on `available_tools` survives (both share it via
`firstKbTool` + `Array.isArray`); the receipt's `phase.config?.` optional chain is DELETED.**
`intersectingKbToolOf` reads the phase exactly as `groundingCauseOf` reads it, because
identical reads are the deliverable — a divergent defensive guard on one of two functions
that are always called one line apart cannot fire (the earlier call throws first) and is
itself the drift class this task closes. The residual (`groundingCauseOf` unguarded on
`config`, against its own module's totality contract) is logged as **`D-ITEM-187-24-01`**,
not silently widened, because `T-187-R4-13` accepted its risk on the explicit basis that this
plan's change to `phaseVocabulary.ts` is purely additive to existing exports.

### The agreement assertion, and why it is not a restatement

Rather than two parallel copies of the same expectations, one biconditional over a 12-phase
table:

> a step is `detected` **iff** it carries a dial **and** the resolver names a tool.

The dial gate belongs to the classifier alone (D-185-15) — the membership rule knows nothing
about phase types — so the two halves are genuinely different statements, and the table
includes a dial-less step that DOES list a KB tool to assert the gate rather than assume it.
Both directions carry non-vacuity counters (`detectedSeen ≥ 4`, `namedWithoutDialSeen ≥ 2`).

### Falsification A — plant the drift: a case-insensitive second derivation

Applied: `intersectingKbToolOf` given its own case-folding loop instead of calling
`firstKbTool`, leaving `groundingCause`'s branch alone.

```
     × AGREES WITH THE CLASSIFIER, over a table — the property, not two copies of it 5ms
AssertionError: phase l names Search_Documents but is not detected: expected null to be 'detected'
      Tests  1 failed | 95 passed (96)
```

The table carries a **case-differing tool id** (`"Search_Documents"`) precisely so this
biconditional has an input that can fail; under the shipped exact-equality rule it is a miss
on both sides and changes no expectation. Observed red, then reverted:

```
$ python /tmp/plant_a.py unplant
$ git diff -- phaseVocabulary.ts | grep -c "folded"   → 0
$ npx vitest run phaseVocabulary.test.ts              → 96 passed (96)
```

### Falsification B — plant a local predicate back into the component

Applied: `function localIntersectingKbTool(phase, kbTools)` re-declared in `SeedReceipt.tsx`
in the exact shape that was deleted.

```
     × declares NO membership predicate of its own — one rule, one home (187-24/WR-14) 5ms
AssertionError: expected [ …(2) ] to have a length of 1 but got 2
      Tests  1 failed | 66 passed (67)
```

The assertion that bit is the **property** (this file declares no function but the component
itself), not the deny-list of membership calls beneath it — which is the intended ordering.
Un-planted and proved:

```
$ grep -c "localIntersectingKbTool" SeedReceipt.tsx  → 0
$ git diff --stat -- SeedReceipt.tsx                 → 1 file changed, 15 insertions(+), 22 deletions(-)
                                                        (only Task 1's own edits remain)
```

### Task 1 acceptance greps

```
$ grep -nE "kbTools\.(includes|indexOf)|includes\(tool\)" SeedReceipt.tsx   → (nothing, exit 1)
$ grep -c "export function intersectingKbToolOf" phaseVocabulary.ts        → 1
$ grep -n "intersectingKbToolOf" SeedReceipt.tsx
  38: * checked): `intersectingKbToolOf` now sits beside `groundingCauseOf` in   ← docblock
 138:   intersectingKbToolOf,                                                    ← imported
 218:   reason: seedReceiptStepReason(cause, intersectingKbToolOf(phase, kbTools)),  ← called
```

Imported and called, never redeclared. Every shipped `SeedReceipt.test.tsx` case asserting a
`detected` reason that names a tool passed **without edit** — the rendered behaviour is
unchanged, which is the point of a move.

### Two needles TRIED and REJECTED (recorded in the guard, not deleted quietly)

| Needle | Why rejected |
|---|---|
| `/function\s+\w+\s*\([^)]*kbTools/` | The component's own destructured props contain `kbTools`, so it fired on `export function SeedReceipt({ phases, kbTools, … })`. Replaced by `/^function\s+\w+/m` — the module-PRIVATE shape a helper predicate actually takes. |
| `"for (const "` | The component's own row derivation is `for (const phase of phases)`. Dropped; the three membership CALLS (`.includes(`, `.some(`, `.indexOf(`) are the pins instead. |

A fence that fires on the correct code it sits beside gets deleted rather than fixed — so
both were caught before they shipped, and the reasons are written into the guard.

---

## 3. Task 2 — the WR-09 fence

### The re-derived measurement at HEAD (raw)

```
$ cd frontend && grep -rn "by its own settings\|by their own settings" src/
src/components/workflows/definitionOps.test.ts:840:    // " by its own settings" — true of the first cause, FALSE of the second, and on an
src/components/workflows/definitionOps.ts:600: *     ending " by its own settings", which is a claim about WHICH cause holds the step,
```

**2 hits. BOTH prose.** `definitionOps.test.ts:840` is the comment three lines above the
fence itself; `definitionOps.ts:600` is the docblock explaining the deletion. Neither is a
rendered string, and no `seedReceiptCarriedLead` return expression contains either clause.
WR-12's measurement is **re-derived and confirmed**: every needle in that fence matched
nothing the product can emit.

### What shipped

1. **A positive control over its OWN needles, inside the same `it`.** Built from the shipped
   sentence with a cause clause welded back on (`undoTheDeletion`), so it is the string this
   module would emit if the 187-20 deletion were undone — never a hand-typed copy that can
   drift from the formatter. It lives inside the fence deliberately: a control in a sibling
   case can be deleted and leave the absences standing alone, which is how the fence shipped
   in the first place.
2. **The PROPERTY replaces the deny-list as the fence.** A word-class assertion over causal
   connectives — `because | since | due to | owing to | thanks to | on account of | as a
   result | therefore | thus | hence | consequently | by` — with `\b` on both sides and four
   negative controls (`bystander`, `sincerely`, `thusly`, `a byte of it`) proving it is a
   statement about the connective and not about letters. The two historical wordings stay
   **beneath** it as cheap regression pins for the exact clause that shipped; they are no
   longer the fence. This is the Phase-185 lesson applied literally: the deny-list was not
   extended.
3. **The WR-12 gap asserted, not just described.** Four differently-worded attributions are
   built and shown to match the property regex while matching *neither* historical needle —
   so the guard now contains, as an executable assertion, the exact reason the old shape was
   insufficient.
4. **Net-new: the property over the whole representable count domain** (0–30, negative,
   fractional, `NaN`, `Infinity`, `MAX_SAFE_INTEGER`), because `seedReceiptCarriedLead` has
   four branches and a clause welded onto one of them slips past a three-sample check. Its
   own one-line positive control, for the same reason as above.

The two assertions that the sentence borrows neither per-step reason were kept unchanged and
re-run: they compare by **identity** against the exports, so 187-23's change to the
`escalated` sentence is tracked rather than pinned, and they stayed green throughout.
`seedReceiptCarriedLead`'s returned strings were not touched — this task hardens a guard over
a closed fix, it does not reopen the fix.

### Falsification — a differently-worded cause clause

Applied to `seedReceiptCarriedLead`: `… must prove it because of its citation policy.`

```
     × the carried lead names the count and the SHIPPED governance words 6ms
     × ZERO carried steps yields NO carried paragraph — the same shape as its sibling 1ms
     × the carried sentence ATTRIBUTES NO CAUSE — it counts two of them (187-20/WR-09) 1ms
     × …and it attributes none over EVERY representable count, not three samples 0ms

AssertionError: carried lead at 1 attributes a cause:
  expected '1 step was already set to must prove …' not to match /\b(because|since|due to|owing to|tha…/i

      Tests  4 failed | 228 passed (232)
```

**Read against the acceptance bar.** The failing assertion in the WR-09 fence is the
**property**, not `toContain`. The historical-needle loop runs *first* inside that same
iteration and **passed** — which is the empirical proof of WR-12's claim: the deny-list is
blind to this wording, and only the property sees it. (The two character-identity cases also
red, as expected — they pin the exact sentence and are unrelated to WR-12.)

Reverted cleanly:

```
$ python /tmp/plant_b.py unplant
$ git diff --stat -- frontend/src/components/workflows/definitionOps.ts   → (empty)
$ npx vitest run definitionOps.test.ts                                     → 232 passed (232)
```

---

## 4. Task 3 — the coverage sweep

### All five probes, measured against BOTH sweeps

Each probe was applied to real source and driven through real `vitest`, never replayed in a
scratch script. **The OLD column was measured at HEAD before any edit in this plan.**

| # | Probe | OLD sweep | NEW sweep |
|---|---|---|---|
| 1 | a brand-new `data-testid="seed-receipt-brandnew"` nothing queries | **FAILS** (correct — its one direction) | **FAILS** |
| 2 | `data-testid={"seed-receipt-brace"}` | passes — **invisible** | **FAILS** |
| 3 | `data-testid={'seed-receipt-sneaky'}` | passes — **invisible** | **FAILS** |
| 4 | a new id whose only query is `// screen.getByTestId("seed-receipt-ghost")` | passes — **a mention satisfies it** | **FAILS** |
| 5 | a new sibling state attribute `data-row-tally={rows.length}` nothing queries | passes — **whole class unswept** | **FAILS** |

WR-13's four reported probes are **reproduced exactly**, and the fifth (the sibling class) is
new to this plan. Raw failure lines from the NEW sweep:

```
=== PROBE 1 === AssertionError: data-testid="seed-receipt-brandnew" is rendered but never queried
=== PROBE 2 === AssertionError: data-testid="seed-receipt-brace"    is rendered but never queried
=== PROBE 3 === AssertionError: data-testid="seed-receipt-sneaky"   is rendered but never queried
=== PROBE 4 === AssertionError: data-testid="seed-receipt-ghost"    is rendered but never queried
=== PROBE 5 === AssertionError: data-row-tally is rendered but never queried:
                expected ' \r\nimport { describe, it, expect, v…' to contain '"data-row-tally"'
```

Probe 5's message is the one that matters most: it fires from the **new sibling-class case**,
and its expected string begins with the comment-stripped source (` \r\nimport {…`) — visible
proof that both repairs are live in the same assertion. Every mutation reverted cleanly:

```
$ git diff --stat -- frontend/src/components/workflows/SeedReceipt.tsx   → (empty)
$ npx vitest run SeedReceipt.test.tsx                                     → 68 passed (68)
```

### The three widenings

**Extraction.** `/data-testid=(?:"([^"'{}$]+)"|\{\s*["']([^"'{}$]+)["']\s*\})/g` — the bare
attribute plus both brace-wrapped string forms.

> **WR-13's proposed regex was measured and REJECTED.** It admits backticks
> (`["'\`]([^"'\`]+)`), and against this component that extracts
> `seed-receipt-step-${row.slug}` — the TEMPLATE row testid — as though it were a static id,
> then demands a query for that literal string. A guard that fails on correct code. The
> character class was narrowed to exclude `$`, `{` and `}`, and the sweep now asserts
> **explicitly** that no extracted id contains `${`. A review's suggestion is a claim, not an
> artifact.

**Comments.** `withoutComments()` removes block comments entirely and cuts each line at the
first `//` that begins the line or follows whitespace — which leaves regex literals (whose
`//` follows a backslash) and `://` intact. Over-stripping is the safe direction and is
stated as such in the guard: removing a live query site turns the sweep red immediately,
while leaving a commented one in place is the silent pass this repair ends. Proven safe by
measurement — all 12 ids and all 5 state attributes still resolve after stripping.

**The sibling class.** `/\sdata-([a-z][a-z-]*)=\{/g` over the component, `data-testid`
excluded so the two halves cannot double-count. It sweeps `data-grounded-count`,
`data-detected-count`, `data-carried-count`, `data-slug`, `data-cause`.

### Why it became TWO cases

The sibling class got its **own `it`** rather than a second paragraph inside the testid
sweep. A guard folded into its sibling can be deleted without the suite's count moving —
the Phase-177 coverage-loss shape — and a red now says *which half* moved. Both cases keep
their own non-vacuity assertions (non-empty extraction, and the name each was written for:
`seed-receipt-carried` / `data-carried-count`). 67 → 68.

### `it("those fences are real")` — the entries it never had

It was the only fence in the block with no planted literal. It now has, all assembled from
parts (a literal spelled out in full would land in `testSource` and satisfy the very guard it
is planted to falsify):

| Planted | Proves |
|---|---|
| the same unqueried id in **all three** static spellings | the widened extraction sees each one, and the suite genuinely does not query it |
| a line-commented and a block-commented query | `withoutComments` really removes them |
| a **live** query with a trailing comment beside it | the stripper does NOT eat real coverage |
| a regex literal containing `//` | nor a regex literal |
| a new `data-row-count={…}` attribute | the state-attribute extraction fires, and nothing queries it |
| **NON-FIRING control:** ``<li data-testid={`seed-receipt-step-${row.slug}`}>`` | the narrowed class keeps the sweep off the dynamic row testid |

The template row testid keeps its explicit acknowledgement in the sweep, and the two
non-vacuity assertions the sweep already had were kept.

---

## 5. Plan-level verification

```
$ npx vitest run SeedReceipt.test.tsx definitionOps.test.ts phaseVocabulary.test.ts \
                 phaseVocabulary.corpus.test.ts StepTypePicker.test.tsx
 Test Files  5 passed (5)
      Tests  484 passed (484)            ← re-measured baseline 475, strictly greater

$ npx vitest run PhaseSpineGraph.test.tsx PhaseSpine.test.tsx WorkflowBuilderPage.canvas.test.tsx
 Test Files  3 passed (3)
      Tests  148 passed (148)            ← 20 + 11 + 117: VOCAB-01's one-copy `?raw`
                                            guards and 187-22's CR-04 cases all green
```

Nine observed falsifications were required (two in Task 1, one in Task 2, five in Task 3) and
nine were run, each with raw failure output above and each reverted with the revert proved.

---

## Deviations from Plan

### 1. [Rule 1 — inherited claim falsified] `phaseVocabulary.test.ts` has NO existing `groundingCause` cases to read like

**Found during:** Task 1 `read_first`.
**Claim:** the plan says to read *"`phaseVocabulary.test.ts` — the `phaseVocabularySource`
`?raw` import and the shape of the existing `groundingCause` cases, so the new tests read
like their neighbours."*
**Measured at HEAD:**

```
$ grep -n "groundingCause" src/components/workflows/phaseVocabulary.test.ts
507:    // Three reads: the declaration, `groundingCause`'s dial check, and the folder
```

One hit, and it is a **comment**. `groundingCause`/`groundingCauseOf` have no cases in this
file at all; the module's grounding derivation is exercised from its consumers
(`SeedReceipt.test.tsx` — 6 references, `canvasModel.test.ts`, `WorkflowBuilderPage.canvas.test.tsx`).
The new cases were therefore written to match the file's *general* idiom (a local phase
builder, `?raw` source fences, non-vacuity counters) rather than a neighbour that does not
exist. `groundingCauseOf` is now imported here for the first time, by the agreement assertion.

### 2. [Rule 3 — measured, not guessed] the shared `phase()` helper cannot express the malformed fixtures

**Found during:** Task 1, first `tsc` run — **16 new errors**, all in the new cases.
`phase()` types its parameter as `Partial<PhaseSpecJSON> & { config?: Record<string, unknown> }`,
which intersects to require `phase_type` **and** well-typed values in every config literal.
The WR-14 cases must express `available_tools` absent, `available_tools: 42`,
`available_tools: "search_documents"` and a mixed array — shapes the JSONB column genuinely
admits and the type system rejects. A local `toolPhase()` builder was added (with a
`NO_TOOLS_KEY` symbol for the absent-key case) and the reason written into its docblock: a
fixture that cannot express those shapes tests the type system rather than the resolver.
Typecheck returned to 33, byte-identical.

### 3. [Rule 1 — the review's proposed regex verified, then REJECTED] WR-13's extraction RX

Documented in §4 above. Adopting `["'\`]([^"'\`]+)` verbatim would have made the sweep demand
`ByTestId("seed-receipt-step-${row.slug}")` — a guard red on correct code. Narrowed, and the
`${`-exclusion is now asserted rather than implied. This is the second consecutive round in
which a review's *suggested artifact* did not survive measurement (187-22 §4, 187-23 §4).

### 4. [Process — recorded so the next executor does not repeat it] `git checkout --` is NOT a revert for an uncommitted task

During Task 1's first falsification the plant was reverted with
`git checkout -- phaseVocabulary.ts`, which restored the file to **HEAD** and silently wiped
the (uncommitted) Task-1 edits along with the plant. Caught by the immediately-following
`git diff --stat` being empty when it should have shown the task's own delta; the edits were
re-applied and the falsification re-run to the same red. Every subsequent probe used a
targeted `plant`/`unplant` script that reverses exactly what it applied, and the emptiness of
`git diff` was checked against what it *should* be rather than against zero.

### 5. [Scope boundary — logged, not fixed] `groundingCauseOf` reads `phase.config` unguarded

`D-ITEM-187-24-01`, with a concrete re-open trigger. See §2 for why it was scoped out rather
than swept in.

---

## Known Stubs

None. No placeholder values, no hardcoded empty data reaching the UI, no TODO/FIXME added.
The one deliberate `null` return (`intersectingKbToolOf` on a miss) is the shipped
never-fabricate floor — the caller falls through to `seedReceiptStepReason`'s unqualified
sentence — and it is pinned by four cases plus the agreement biconditional.

## Threat Flags

None new. This plan adds no endpoint, no request, no auth path, no file access, no persisted
field and no schema change. `phaseVocabulary.ts` remains import-pure and `SeedReceipt.tsx`
still imports nothing from the API client (both `?raw` purity fences ran green). The
register's five dispositions are discharged as follows:

| Threat ID | Disposition | Outcome |
|---|---|---|
| T-187-R4-10 | mitigate | **CLOSED** — the predicate has one body read by both consumers; pinned by an agreement biconditional and a source fence, both observed red |
| T-187-R4-11 | mitigate | **CLOSED** — positive control over its own needles + a word-class property, observed red on a wording the deny-list passed |
| T-187-R4-12 | mitigate | **CLOSED** — extraction widened, comments stripped, sibling class swept, planted-literal controls added; all five probes observed red |
| T-187-R4-13 | accept | **ACCEPTED as recorded** — the two spine suites ran green throughout (20 + 11); the change to `phaseVocabulary.ts` is purely additive to existing exports, which is why `D-ITEM-187-24-01` was logged rather than fixed here |
| T-187-R4-SC | accept | Not engaged — zero package-manager installs, zero new dependencies |

## Requirements

`VOCAB-02` and `VOCAB-01` are exercised by this plan but are **NOT** marked complete here.
Per the project's standing rule, `requirements.mark-complete`, `state.advance-plan` and
`roadmap.update-plan-progress` write false completion records and were **not called by any
task in this plan**. The orchestrator owns those writes.

## Self-Check: PASSED

```
$ [ -f frontend/src/components/workflows/phaseVocabulary.ts ]        → FOUND
$ [ -f frontend/src/components/workflows/phaseVocabulary.test.ts ]   → FOUND
$ [ -f frontend/src/components/workflows/SeedReceipt.tsx ]           → FOUND
$ [ -f frontend/src/components/workflows/SeedReceipt.test.tsx ]      → FOUND
$ [ -f frontend/src/components/workflows/definitionOps.test.ts ]     → FOUND
$ [ -f .planning/phases/187-.../deferred-items.md ]                  → FOUND

$ git log --oneline -3
17c6e338 test(187-24): the coverage sweep measures coverage — every spelling, no comments, the sibling class
576a0e31 test(187-24): the WR-09 fence measures a property and controls its own needles
c4972bde refactor(187-24): the KB-tool membership rule has one home, read by both consumers
```

All three commit hashes exist. Every declared artifact carries its required `contains` token:
`phaseVocabulary.ts` → `kbTools`; `SeedReceipt.tsx` → `groundingCauseOf`;
`definitionOps.test.ts` → `POSITIVE CONTROL`; `SeedReceipt.test.tsx` → `data-carried-count`.
The declared `key_link` holds: `SeedReceipt.tsx` imports
`from "@/components/workflows/phaseVocabulary"` with `intersectingKbToolOf` beside
`groundingCauseOf`, and no local predicate remains.
`git diff --name-only -- backend/ supabase/migrations` and
`git status --porcelain supabase/migrations` are both empty.

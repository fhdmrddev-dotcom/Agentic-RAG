---
phase: 193-authoring-doors-template-placement
reviewed: 2026-08-14T00:00:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - frontend/src/pages/WorkflowBuilderPage.tsx
  - frontend/src/pages/WorkflowBuilderPage.describe.test.tsx
  - frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx
  - frontend/src/pages/WorkflowBuilderPage.session.test.tsx
  - frontend/src/pages/WorkflowBuilderPage.header.test.tsx
  - frontend/src/components/workflows/WorkflowDoorSwitch.tsx
  - frontend/src/components/workflows/WorkflowDoorSwitch.test.tsx
  - frontend/src/components/workflows/WorkflowDoorSwitch.baseline.test.tsx
  - frontend/src/components/workflows/DoorHeaderStrip.tsx
  - frontend/src/components/workflows/DoorHeaderStrip.test.tsx
  - frontend/src/components/workflows/doorVocabulary.ts
  - frontend/src/components/workflows/doorVocabulary.test.ts
  - frontend/src/components/workflows/soulData.ts
  - frontend/src/components/workflows/soulData.test.ts
  - frontend/src/components/workflows/library/RunModal.tsx
  - frontend/src/components/workflows/library/libraryVocabulary.ts
  - frontend/src/components/workflows/library/WorkflowCard.tsx
  - frontend/src/components/workflows/library/WorkflowCard.test.tsx
  - frontend/src/pages/__tests__/RunModal.test.tsx
  - frontend/src/pages/__tests__/RunModal.a11y.test.tsx
  - scripts/vitest-count-gate.cjs
findings:
  critical: 0
  warning: 8
  info: 3
  total: 11
status: issues_found
---

# Phase 193: Code Review Report

**Reviewed:** 2026-08-14
**Depth:** standard
**Files Reviewed:** 21
**Status:** issues_found

## Summary

Reviewed the full `501b3c14..HEAD` diff for Phase 193 — the door-copy extraction
(`doorVocabulary.ts`), the `DoorHeaderStrip` cut, the D-04/D-22 restack, the three-state
`templateAdmission` predicate and its two asymmetric consumers, the count-gate pin sweep, and
the operator-approved inline fast-fix on `WorkflowBuilderPage.tsx` (commit `294a2ac8`).

**No Critical (BLOCKER) finding.** That is a measurement, not a shrug — the following were
driven rather than assumed, and each came back clean:

- **No count-gate pin was lowered and no file was dropped.** Parsed both revisions of
  `BASELINE`: 64 → 67 entries, 5 raises, 3 additions, **0 removals, 0 lowerings**, derived
  total `3413 → 3533`, which matches the `⚠ 3533 (193-10)` marker exactly.
- **The words-only re-capture claim holds, including attributes.** I compared old vs new for
  all six `DOOR_HTML_BASELINE` literals and `FLAG_OFF_DESCRIBE_MARKUP` by tokenising **whole
  tags with their attributes** (not just tag names) and by text node: `tags same = true` in
  every case; the only deltas are 3 text nodes per GOVERN row and 3 in the describe markup.
  An attribute change could **not** have slipped through.
- **No governed door literal survives in production source.** Swept all 21 `doorVocabulary`
  values across every `.ts`/`.tsx` under `frontend/src`: every hit is in a test file
  (`doorVocabulary.test.ts`, the two baseline/capture suites, `header.test.tsx`). The
  fast-fix's programmatic sweep was complete for literal form.
- **The security-bearing string is byte-unchanged** (`RunModal.tsx:429`) and the code cannot
  make it false — `template_input` is consumed only through `template_asset_service` /
  `template_render_service`, whose untrusted branch is `run_replace`, never Jinja.
- **`launchError` is reachable when the template block is hidden**, generally and not just for
  the one tested row: `(showTemplate || launchError)` is a disjunction that can only *add* the
  error node's home, and `RunModal.test.tsx:955-1024` drives exactly the non-admitting +
  rejected-launch path.
- **`templateAdmission` is safe against the jsonb string-scalar `definition`** (194/223 live
  rows): a string `def` is truthy but `Array.isArray(def.phases)` is false → `"unknown"`, which
  is the non-destructive arm on both surfaces.
- **`_emit_bound_asset_ref` really does key on `kind == "template"` alone** and Branch 1 of
  `resolve_template_source` really does return unconditionally (including on download failure),
  so D-21's bound-asset arm mirrors the backend exactly.
- **eslint on all eight changed source files: 1 error, and it is the pre-existing
  `useCanvasGate` react-refresh error at `WorkflowBuilderPage.tsx:253`.** No new lint.

What the review *did* find clusters on the fast-fix and on prose that no longer describes the
code it sits beside — which in this codebase is treated as a defect class, because the next
author's decisions are made from that prose. The single most consequential item is WR-01: the
fix closed the gap but did not extend the fence that would have caught it, so the identical
regression can recur silently.

## Warnings

### WR-01: The D-24(a) copy fence was NOT extended to the file that caused the gap

**File:** `frontend/src/components/workflows/WorkflowDoorSwitch.test.tsx:472-475` (and `:505`,
`:511`) · `frontend/src/pages/WorkflowBuilderPage.tsx:198-213`

**Issue:** The whole point of `SWEPT_SOURCES` is that a governed door word may not survive as a
literal outside `doorVocabulary.ts`. It sweeps exactly **two** files:

```ts
const SWEPT_SOURCES: { path: string; source: string }[] = [
  { path: "./WorkflowDoorSwitch.tsx", source: workflowDoorSwitchSource },
  { path: "./DoorHeaderStrip.tsx", source: doorHeaderStripSource },
]
```

Phase 193's own headline gap was a **third** consumer — `WorkflowBuilderPage.tsx` held five
ungoverned copies of the same strings — and the fast-fix rewired that file to import from
`doorVocabulary` without adding it to the swept list. The fence therefore still cannot see the
file it was blind to. Re-typing `"Write the first draft"` into the page tomorrow reproduces the
exact defect the phase spent a commit closing, with the gate green.

I verified the fix is applicable today: my independent sweep of all 21 values found **zero**
hits in `WorkflowBuilderPage.tsx`, so adding it passes immediately rather than requiring
cleanup.

**Fix:**
```ts
import builderPageSource from "@/pages/WorkflowBuilderPage?raw"

const SWEPT_SOURCES: { path: string; source: string }[] = [
  { path: "./WorkflowDoorSwitch.tsx", source: workflowDoorSwitchSource },
  { path: "./DoorHeaderStrip.tsx", source: doorHeaderStripSource },
  // 193 fast-fix: the THIRD consumer. It was outside this list when it held a second,
  // ungoverned copy of five ids — the gap this fence exists to make impossible.
  { path: "@/pages/WorkflowBuilderPage.tsx", source: builderPageSource },
]
```
and raise the two scope guards that hard-code the count:
```ts
expect(SWEPT_SOURCES).toHaveLength(3)          // was 2 (`:505`)
```
(`:511`'s `new Set(NEEDLES.map(n => n.id)).size` stays 21.) Then re-pin
`WorkflowDoorSwitch.test.tsx` in `scripts/vitest-count-gate.cjs` (33 → 34, one new `it.each`
row) — read from the gate's own `actual` column, per the file's house rule.

---

### WR-02: A THIRD re-capture of the baseline literals, against the file's own "expects no third" contract — and a docblock bullet that is now false

**File:** `frontend/src/components/workflows/WorkflowDoorSwitch.baseline.test.tsx:282-286`,
`:320-323`, `:330-331`

**Issue:** The docblock states, in the file's own words:

> ⚠ THIS IS RE-CAPTURE **TWO OF TWO**, AND THE PHASE EXPECTS NO THIRD. `193-08` changed the
> words; `193-09` changed the structure. Any further re-capture of these six is a behaviour
> change to explain in its own plan, not a test to update.

Commit `294a2ac8` re-captured `GOVERN_STANDALONE` and `GOVERN_INLINE` a third time
(`git show 294a2ac8 -- <file>` → 2 changed lines) and **added no note**. The instrument's whole
value is that a re-capture must be stated; this one was not.

Worse, the bullet at `:282-286` is now factually false about the literal 45 lines below it:

> ⚠ AND ONE THING THE DIFF EXPOSES THAT IS **NOT** THIS PHASE'S TO FIX. In both GOVERN rows
> only the two strip nodes changed: the Builder's own describe screen still reads its column-A
> words … It is visible right here in `GOVERN_STANDALONE`.

`GOVERN_STANDALONE` at `:330` now reads `Write the first draft` / `writes the steps` /
`sets how strict it is`. A reader following that bullet is told the opposite of what the
committed capture contains.

The re-capture itself is legitimate on the merits — I proved it words-only by comparing full
tag tokens (identical, 40/40 and 54/54) and text nodes (3 differing each, all governed ids).
The defect is that it is undocumented and contradicts the standing note.

**Fix:** Append a third note in the same shape as the two above it, and correct the stale
bullet in place rather than deleting it (the file's own habit):

```
 * ── ⚠ RE-CAPTURED A THIRD TIME BY THE 193 FAST-FIX (`294a2ac8`, operator-approved) ──────
 *
 * The note above said the phase expected no third. It got one, and this is the explanation
 * it demanded rather than a silent edit. TWO literals moved (GOVERN_STANDALONE,
 * GOVERN_INLINE); the four others were not rewritten at all.
 *
 *  • WHAT CHANGED: THE WORDS ONLY, measured with whole TAG TOKENS (attributes included) and
 *    text nodes separated — tags 40/40 and 54/54 IDENTICAL, text nodes 14/14 and 16/16 with
 *    exactly THREE differing each: the page's CTA and two hint fragments moving to column D.
 *  • WHY: the bullet above records that `WorkflowBuilderPage.tsx` held a SECOND, ungoverned
 *    copy of those strings. ⚠ THAT BULLET IS NOW FALSE OF THE LITERALS BELOW and is kept only
 *    as the record of why this re-capture happened — the page now renders DESCRIBE_CTA /
 *    DESCRIBE_H1 / HINT_FRAG1-3 by id, so both GOVERN rows read variant D end to end.
```

---

### WR-03: `canvas.test.tsx`'s docblock forbids the change made two lines below it

**File:** `frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx:2380-2392` (assertion at
`:2396`)

**Issue:** The `draftIt()` docblock says:

> ⚠ PHASE 193-08 — THIS LITERAL IS **CORRECT AS IT STANDS** … it is a genuinely different
> string from the door's `DESCRIBE_CTA` … Two homes for the same words; only one moved.
> Recorded as a deferred item … Do NOT "fix" this to the door's wording without moving the
> page's literal in the same commit.

The fast-fix did exactly that (page literal + query in one commit, so the *instruction* was
honoured), but the docblock was left asserting the opposite of the code beneath it: there is no
longer a literal, there are no longer two homes, and the deferral is spent. `describe.test.tsx`
got a `✅ CLOSED, SAME DAY` amendment for precisely this; `canvas.test.tsx` did not. A reader
now has two neighbouring suites telling contradictory stories about the same fact.

**Fix:** Amend in place, matching `describe.test.tsx:44-56`:
```
   * ⚠ PHASE 193-08 (2026-08-13) — THIS LITERAL WAS CORRECT AS IT STOOD … [keep as written]
   *
   * ── ✅ CLOSED SAME DAY (`294a2ac8`, operator-approved). The prediction above held: the
   *    page's own literal MOVED, so this query moved with it in the same commit — which is
   *    exactly the condition the paragraph above set. There is no second home left; the
   *    deferral in `193-08-SUMMARY.md` § Deferred is spent.
```

---

### WR-04: Variant D copy now renders on a THIRD surface the generated contract never audited

**File:** `frontend/src/pages/WorkflowBuilderPage.tsx:1496`, `:1541`, `:1545-1547` ·
`frontend/src/components/workflows/doorVocabulary.ts:23-28`

**Issue:** `doorVocabulary.ts`'s own header states the anti-drift property the phase rests on:

> That contract is emitted FROM the real `WorkflowDoorSwitch` DOM — `dom.generated.json` is a
> dump of the shipped component … so column A below is what a human actually approved on
> screen.

and `doorVocabulary.test.ts:339-341` pins the audit line
(`**Variant D** — 19 substitution(s) matched the real DOM; **zero misses**`). That audit ran
against **`WorkflowDoorSwitch`'s DOM only**. The fast-fix propagated five of those strings to
the Builder's pre-draft describe screen — a different component, different markup (`style={{
fontSize: "1.5rem" }}` vs `text-[1.4rem]`, no `data-testid` on the CTA), and a surface no
mockup and no UAT row covers.

The user-visible consequence is on the door the phase exists to make legible: door B's card
reads *"Build it myself" / "you decide every setting" / "Open the editor and set each step
yourself"*, and clicking it now lands on a screen that reads *"Write the first draft"* +
*"the AI **writes the steps**, **sets how strict it is**"* — copy authored for door A
(*"Draft it for me"*). This is visible in the committed `GOVERN_STANDALONE` capture at
`WorkflowDoorSwitch.baseline.test.tsx:330`.

Not a Critical: the contradiction pre-existed in weaker form ("Draft the workflow" / "drafts the
phases" on the same screen), and the sentence is not *false* about behaviour — pressing the CTA
does generate a draft. But the fix framed the pre-state as the defect on the assumption that
both screens should speak identically, and that assumption was never ruled on.

**Fix:** Do not revert the ids. Add a UAT row alongside U3/U3b/U6 that drives the govern door
from the chooser and rules on the pre-draft screen's wording, and record the open question:

```md
| U7 | Click **door B** from the chooser and read the first screen. Does its CTA + hint
     (authored for door A) still read honestly on the strict door, or does door B need its
     own `describe.*` ids? | operator, by looking |
```
If the operator rules that they differ, the correct shape is two id families
(`describe.cta` / `describe.ctaGovern`) regenerated through `build.cjs`, never a re-typed
literal on the page — that is what WR-01's fence extension would then enforce.

---

### WR-05: `templateAdmission` returns a POSITIVE `does-not-admit` for a phase that carries no `config` — and the count gate claims a test case for it that does not exist

**File:** `frontend/src/components/workflows/soulData.ts:243-248` ·
`frontend/src/components/workflows/soulData.test.ts:305-352` ·
`scripts/vitest-count-gate.cjs:277-280`

**Issue:** `config` is optional in `DefShape` (`:78`). A definition like
`{ phases: [{ slug: "a", phase_index: 0 }] }` — an array the wire sent, but which describes
nothing about phase types — reaches step (3):

```ts
const fills = def.phases.some((p) => {
  if (p.config?.phase_type !== "llm_emit") return false   // undefined !== "llm_emit" → false
  ...
})
if (!fills) return "does-not-admit"                        // a POSITIVE no
```

D-20's rule is *hide only on a positive no*, and the module's docblock is explicit that the
`unknown` arm exists so a shape the wire did not describe never strips WFIN-01. A `config`-less
phase list describes nothing, yet it produces the strippping answer. Steps (1) and (2) already
implement the safe reading for `phases: null` / `phases: []`; this shape falls through them.

Compounding it, `scripts/vitest-count-gate.cjs:279` justifies the `17 → 33` raise by naming
"the five malformed shapes (`undefined` / `null` / `{}` / non-array `phases` / **missing
`config`**)". `ADMISSION_CASES` contains no case with a `config`-less phase — every phase entry
in the table declares one. The claim is unearned, so the arm is unguarded *and* documented as
guarded.

Exposure is unmeasured: I found no evidence of live rows in this shape (the harness Pydantic
models normally supply `config`), which is why this is a Warning and not a Critical.

**Fix:** Treat a phase list that says nothing about phase types the same way an empty one is
treated, and add the missing case:
```ts
  // (2b) Phases that declare no `config` at all describe NOTHING about phase type. Same
  //      reading as (2): the wire did not say, so nothing may be concluded (D-20).
  if (def.phases.every((p) => p?.config?.phase_type === undefined)) return "unknown"
```
```ts
  // soulData.test.ts — ADMISSION_CASES
  ["{ phases: [{}] } — a phase with no `config` key, the shape the gate claims is covered",
   { phases: [{ slug: "a", phase_index: 0 }] }, "unknown"],
```
Whichever way the decision goes, correct `vitest-count-gate.cjs:279` so the enumeration matches
the table it describes.

---

### WR-06: A containment assertion on the one string `doorVocabulary.ts` declares unusable for containment

**File:** `frontend/src/pages/WorkflowBuilderPage.header.test.tsx:446`

**Issue:**
```ts
expect(bar).toHaveTextContent(STRIP_LABEL_GOVERN)
```
`toHaveTextContent(string)` is a **substring** match. `STRIP_LABEL_GOVERN` is
`"Build it myself"` — the exact string `doorVocabulary.ts:68-76` singles out:

> `DOOR_B_NAME` is a strict PREFIX of `SWITCH_CTA` and is the SAME STRING as
> `STRIP_LABEL_GOVERN`, so a containment check on that fragment is true of all three and cannot
> identify a row at all. … no assertion anywhere in this repo may use containment to tell the
> two apart.

The assertion passes today only because the merged header bar happens to host none of the other
two. It cannot distinguish the govern strip's label from a door-B card or the switch CTA if
either ever renders into that bar — and it is the row whose comment claims it "still names the
exact shipped label". The sibling assertion at `:260` was correctly strengthened to
`.toBe(STRIP_BACK)` in the same commit; this one was not.

**Fix:**
```ts
// The govern strip's label node, compared WHOLE — a containment check on this string is true
// of DOOR_B_NAME and SWITCH_CTA as well (doorVocabulary.ts's own rule).
const governLabel = Array.from(bar.querySelectorAll("span")).find(
  (n) => n.textContent === STRIP_LABEL_GOVERN,
)
expect(governLabel, "the merged row no longer carries the govern-door label").toBeDefined()
```

---

### WR-07: No case covers the jsonb string-scalar `definition`, and the docblock attributes all 110 `unknown` rows to `phases: []`

**File:** `frontend/src/components/workflows/soulData.ts:216-221`,
`:232-237` · `frontend/src/components/workflows/soulData.test.ts:305-352`

**Issue:** `CLAUDE.md`'s own reference notes that `definition` is a **jsonb string scalar on
194 of 223 rows** (`definition->'phases'` silently returns 0 rows). `libraryFilter.ts:58-59`
casts it straight through (`(definition ?? undefined) as DefShape | undefined`), so at runtime
`def` is frequently a **`string`**, not an object.

The behaviour is correct by luck of ordering — a string is truthy, `("...").phases` is
`undefined`, `Array.isArray` is false, so step (1) answers `"unknown"` — but:

1. **Nothing pins it.** `ADMISSION_CASES` covers six malformed shapes; a string is not among
   them. A future "tidy" of step (1) (e.g. `const phases = def?.phases ?? []`, or an added
   `typeof def === "string" ? JSON.parse(def) : def`) could flip the dominant live shape into a
   different arm with the suite green.
2. **The docblock's causal claim is probably wrong.** `:220` states the 110 `unknown` rows "are
   `phases: []` (76 % of the library — an unauthored stub)". Given the string-scalar count,
   most of them are likely reaching step (1), not step (2). `RunModal.tsx:104-107` repeats the
   same attribution.

**Fix:** Add the shape to the table and soften the attribution to what was measured:
```ts
  // ⚠ THE DOMINANT LIVE SHAPE. `definition` is a jsonb STRING SCALAR on 194 of 223 rows
  // (CLAUDE.md § jsonb string-scalar trap), and `libraryFilter.defOf` casts it through
  // unparsed — so `def` is a `string` at runtime here far more often than it is an object.
  ["a jsonb string scalar — the shape 194 of 223 live rows carry",
   '{"phases":[{"config":{"phase_type":"llm_emit"}}]}' as unknown as DefShape, "unknown"],
```
and reword `soulData.ts:220` to *"the 110 reach `unknown` through the shape guard — some as
`phases: []`, most as an unparsed jsonb string scalar; the split was not measured"*.

---

### WR-08: `doorVocabulary.test.ts` imports a `.planning/` sketch artifact across the package boundary

**File:** `frontend/src/components/workflows/doorVocabulary.test.ts:60`

**Issue:**
```ts
import buildContractSource from "../../../../.planning/sketches/164-telling-the-doors-apart/BUILD-CONTRACT.generated.md?raw"
```
This resolves to the **repo root**, outside `frontend/`, and makes a frontend suite depend on a
GSD planning artifact. `.planning/sketches/` is exactly the kind of artifact
`/gsd:complete-milestone` archives (memory: *"milestone.complete archives the WHOLE ROADMAP"*),
and Vite's `server.fs.allow` root would reject it in any build config that does not currently
happen to permit it. When the artifact moves, three cases red and the count gate fails for a
reason unrelated to any code change — and the suite's own `length > 2000` guard means it fails
loudly rather than silently, which is good, but it still blocks the gate.

The value of the case (the contract IS the acceptance bar) is real; the coupling shape is the
problem.

**Fix:** Snapshot the generated table into the frontend tree at generation time so the
dependency points at a versioned artifact inside the package, and have `build.cjs` write both:
```
frontend/src/components/workflows/__contracts__/doors-copy.generated.json
```
```ts
import COLUMN_D_GENERATED from "./__contracts__/doors-copy.generated.json"
// …deep-equal against COLUMN_D exactly as today; regenerating the sketch rewrites this file,
// so the acceptance bar still cannot drift, and archiving `.planning/` cannot break the suite.
```
If that is out of scope now, at minimum record the coupling in the suite's docblock with a
re-open trigger naming milestone close.

## Resolution status (updated 2026-08-14, after the fix pass)

| Finding | State | Commit / owner |
|---|---|---|
| **WR-01** the copy fence missed the file that caused the gap | ✅ **FIXED and PROVED TO FIRE** — driven RED against a planted `DESCRIBE_CTA` literal (`expected [ 'DESCRIBE_CTA/plain' ] to deeply equal []`), plant restored md5-identical | `3f31e8cc` |
| **WR-02** third re-capture, undocumented + a now-false bullet | ✅ **FIXED** (prose) | `bec117d0` |
| **WR-03** docblock forbids the change below it | ✅ **FIXED** (prose) | `bec117d0` |
| **WR-05** count-gate claims a case that does not exist | ✅ **FULLY FIXED** — comment corrected, and the `(2b)` arm added so a `config`-silent phase list reads `unknown`. **DRIVEN RED** against a disabled arm (both new cases: `expected 'does-not-admit' to be 'unknown'`), source restored md5-identical. | `bec117d0` + `6c060c4f` |
| **WR-07** `unknown` rows mis-attributed to `phases: []` | ✅ **FULLY FIXED** — docblocks corrected in both files, and the jsonb string-scalar shape (194 of 223 live rows) is now pinned in `ADMISSION_CASES`. | `bec117d0` + `6c060c4f` |
| **IN-01** declaration-order claim contradicted by line numbers | ✅ **FIXED** (prose) | `bec117d0` |
| **WR-04** variant D on an unaudited third surface | ⏸ **OPERATOR RULING OWED** — door B's card says *you decide every setting*; its first screen now reads *the AI writes the steps*. Pre-existed in weaker form; the fast-fix made both surfaces agree without anyone ruling that they should. Pairs with UAT U1/U2. | open |
| **WR-06** containment assertion on a string declared unusable for containment | ✅ **FIXED** — compares the label's own node whole, per `doorVocabulary.ts`'s own rule. | `6c060c4f` |
| **WR-08** test imports a `.planning/` sketch artifact across the package boundary | ✅ **FIXED (the real fix, not the documented minimum)** — `build.cjs` writes both copies from the SAME string, so they cannot drift; the suite imports the in-package copy. Regen verified idempotent, copies md5-identical, new file not gitignored. | `6c060c4f` |
| **IN-02** stateful `/g` regex used with both `toMatch` and `.match()` | ✅ **FIXED** — split into `/m` for matching and `/gm` for counting. | `6c060c4f` |
| **IN-03** scale-cap loop pairs rows to lines by index without pinning lengths | ✅ **FIXED** — length pinned and a non-vacuity guard added. | `6c060c4f` |

**Verification of the fix pass:** `tsc -p tsconfig.app.json` **33** (baseline, unmoved) · count gate
**exit 0 · total 3558 · failed 0 · 67/67 pinned** — byte-identical to the pre-edit run for the five
prose commits, so not one test moved.

**FINAL STATE (2026-08-14): 10 of 11 findings CLOSED. One remains, and it is not a code defect.**

⚠ **WR-04 is the only open item, and it is deliberately open.** Door B's card reads *you decide
every setting*; its first screen now reads *the AI writes the steps*. Whether those two should
speak identically is a **product ruling**, not a defect to patch — the contradiction pre-existed in
weaker form, and the fast-fix made both surfaces agree without anyone deciding they should.
Changing it either way without that ruling is how a phase ships copy nobody chose. It pairs
naturally with UAT rows U1/U2, which ask a human the same question from the other direction.

Verification of the full fix pass: `tsc -p tsconfig.app.json` **33** (baseline, unmoved) · count gate
**exit 0 · total 3561 · failed 0 · 67/67 pinned, no per-file decrease**. Every behaviour change was
driven RED before being trusted; every plant was restored md5-identical.

---

## Info

### IN-01: `CARD_TEMPLATE_MARK`'s docblock misstates its own declaration order

**File:** `frontend/src/components/workflows/library/libraryVocabulary.ts:354`

**Issue:** *"It is declared here, immediately before `CHANGED_PREFIX`, for that reason."*
`CARD_TEMPLATE_MARK` is at `:358`, `RUN_TEMPLATE_LABEL` at `:376`, `CHANGED_PREFIX` at `:383` —
the label sits between them, so the declaration-order argument for the slot no longer reads.

**Fix:** *"It is declared here, in the identity-line block and ahead of `CHANGED_PREFIX`
(`RUN_TEMPLATE_LABEL` follows it because both template words arrived in one wave)."*

---

### IN-02: A global regex is used with both `toMatch` (stateful `.test()`) and `.match()`

**File:** `frontend/src/components/workflows/DoorHeaderStrip.test.tsx:304`, `:312`, `:338`

**Issue:** `const ANY_IMPORT = /^\s*import\s/gm` is passed to `expect(...).toMatch()` at `:312`
(which calls `regexp.test()`, advancing `lastIndex`) and then to `String.prototype.match()` at
`:338`. It is correct today only because `.match()` with `/g` resets `lastIndex` — a second
`toMatch(ANY_IMPORT)` added anywhere before `:338` would make the count assertion
order-dependent. The sibling suite (`doorVocabulary.test.ts:440`) declares the same pattern
without `/g` for exactly this reason.

**Fix:** Split the two uses:
```ts
const ANY_IMPORT = /^\s*import\s/m         // for toMatch
const ANY_IMPORT_G = /^\s*import\s/gm      // for .match() counting
```

---

### IN-03: The scale-cap loop pairs rows to lines by index without pinning the two lengths

**File:** `frontend/src/components/workflows/library/WorkflowCard.test.tsx:1227-1233`

**Issue:**
```ts
const lines = allLines()
SCALE_ROWS.forEach((row, index) => {
  const cap = templateAdmission(row.def) === "admits" ? 6 : 5
  expect(identityParts(lines[index]).length).toBeLessThanOrEqual(cap)
})
```
The per-row cap is only meaningful if `lines[index]` is `SCALE_ROWS[index]`'s line. That holds
because `renderLibrary` maps in order, but nothing asserts it — and this is the first assertion
in the file where a mis-pairing would be *silently wrong* (a `does-not-admit` row scored against
an `admits` row's cap) rather than a throw.

**Fix:** Add the length pin ahead of the loop, and a non-vacuity guard so the raise is not a
no-op on a corpus where nothing admits:
```ts
expect(lines).toHaveLength(SCALE_ROWS.length)
expect(SCALE_ROWS.some((r) => templateAdmission(r.def) === "admits")).toBe(true)
```

---

_Reviewed: 2026-08-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

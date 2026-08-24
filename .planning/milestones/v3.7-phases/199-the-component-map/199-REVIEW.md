---
phase: 199-the-component-map
reviewed: 2026-08-19T12:05:00Z
depth: standard
files_reviewed: 51
files_reviewed_list:
  - frontend/src/components/panel/FilesSection.tsx
  - frontend/src/components/panel/PanelEmpty.tsx
  - frontend/src/components/panel/PhaseCard.tsx
  - frontend/src/components/workflows/BuilderHeaderBar.tsx
  - frontend/src/components/workflows/DecisionsList.tsx
  - frontend/src/components/workflows/doorVocabulary.ts
  - frontend/src/components/workflows/FieldGuidance.tsx
  - frontend/src/components/workflows/library/LibraryToolbar.tsx
  - frontend/src/components/workflows/library/RunModal.tsx
  - frontend/src/components/workflows/ModelField.tsx
  - frontend/src/components/workflows/PhaseFormPanel.tsx
  - frontend/src/components/workflows/PhaseNodeCard.tsx
  - frontend/src/components/workflows/PhaseSpineGraph.tsx
  - frontend/src/components/workflows/PublishGauntlet.tsx
  - frontend/src/components/workflows/StepTypePicker.tsx
  - frontend/src/components/workflows/WorkflowCanvas.tsx
  - frontend/src/components/workflows/WorkflowDoorSwitch.tsx
  - frontend/src/pages/WorkflowBuilderPage.tsx
  - frontend/src/pages/WorkflowRunPage.tsx
  - frontend/src/components/panel/PhaseCard.test.tsx
  - frontend/src/components/panel/__tests__/FilesSection.test.tsx
  - frontend/src/components/panel/__tests__/PendingAskCard.test.tsx
  - frontend/src/components/panel/__tests__/WorkspacePanel.test.tsx
  - frontend/src/components/workflows/BuilderSaveRegion.test.tsx
  - frontend/src/components/workflows/CanvasToolbar.test.tsx
  - frontend/src/components/workflows/DecisionsList.test.tsx
  - frontend/src/components/workflows/DescribeKbPicker.test.tsx
  - frontend/src/components/workflows/DescribeTemplateRow.test.tsx
  - frontend/src/components/workflows/DoorHeaderStrip.test.tsx
  - frontend/src/components/workflows/DraftArrivalCard.test.tsx
  - frontend/src/components/workflows/FlowEdge.test.tsx
  - frontend/src/components/workflows/GovernanceSection.test.tsx
  - frontend/src/components/workflows/ModelField.test.tsx
  - frontend/src/components/workflows/PhaseFormPanel.test.tsx
  - frontend/src/components/workflows/PhaseNode.test.tsx
  - frontend/src/components/workflows/PhaseNodeCard.test.tsx
  - frontend/src/components/workflows/PhaseSpineGraph.test.tsx
  - frontend/src/components/workflows/ProblemsTray.test.tsx
  - frontend/src/components/workflows/PublishGauntlet.test.tsx
  - frontend/src/components/workflows/StepTypePicker.test.tsx
  - frontend/src/components/workflows/TemplateNameCheck.test.tsx
  - frontend/src/components/workflows/WorkflowCanvas.test.tsx
  - frontend/src/components/workflows/WorkflowDoorSwitch.test.tsx
  - frontend/src/components/workflows/WorkflowSoul.test.tsx
  - frontend/src/components/workflows/doorVocabulary.test.ts
  - frontend/src/components/workflows/library/ForkNameDialog.test.tsx
  - frontend/src/components/workflows/library/LibraryToolbar.test.tsx
  - frontend/src/pages/WorkflowBuilderPage.header.test.tsx
  - frontend/src/pages/WorkflowRunPage.test.tsx
  - frontend/src/pages/__tests__/PublishedCardDelete.test.tsx
  - frontend/src/pages/__tests__/RunModal.test.tsx
findings:
  critical: 0
  warning: 6
  info: 7
  total: 13
status: issues_found
---

# Phase 199: Code Review Report

**Reviewed:** 2026-08-19T12:05:00Z
**Depth:** standard
**Files Reviewed:** 51 (19 non-test source, 32 test)
**Status:** issues_found

## Summary

Nineteen non-test source files, all frontend, all presentation. I re-ran every gate rather than
reading the claims, and the phase's structural discipline holds up better than most:

| Claim checked | Method | Result |
|---|---|---|
| Backend fence empty | `git diff --stat b5464184..HEAD -- backend supabase` | **EMPTY — TRUE** |
| Zero assertion deletions | `git diff … '*.test.ts*' \| grep -c '^-.*expect('` | **5 found**; each read individually — **all five are legitimate polarity flips or a declared-delta splice, none is a weakening** (detail below) |
| All changed suites green | 32 suites, `GSD_VITEST_MAX_WORKERS=2` | **32 files / 1556 tests passed, 0 failed** |
| `tsc` baseline unmoved at 33 | `npx tsc --noEmit -p tsconfig.app.json \| grep -c "error TS"` | **33 — TRUE**, and **zero** of them are in any file this phase touched |
| Every new colour utility resolves | each new `bg-*`/`border-*`/`text-*`/`ring-*` key checked against `frontend/tailwind.config.js` + `frontend/src/index.css` | **all resolve** (`accent`, `card`, `primary`, `primary-foreground`, `destructive`, `border`, `muted`, plus stock `border-transparent` and two arbitrary `hsl()` literals). Tailwind is **3.4.19**, so `ringColor`/`borderColor` do extend from `colors` — `focus:ring-destructive` and `focus:border-destructive` are real. **No compile-to-nothing class was introduced.** |
| `border-transparent`, not a dropped `border` | `PhaseCard.tsx:347` still emits the bare `border` utility | **TRUE** — the correct idiom was used |
| The six `RunModal` innerHTML captures are the old ones minus exactly one glyph span | derived each old capture programmatically and compared to the new one | **6/6 EXACT** |
| The soul tier-chip revert is byte-clean | `git diff b5464184..HEAD -- WorkflowSoul.tsx` | **EMPTY — TRUE** |
| `WorkflowRunPage` degrade headline | driven both arms | fixed and guarded; the vacuous `\bv\d` fence was replaced by an **element** query with a live positive control |
| `wearsDestructiveWeight` no longer counts a hover-only danger colour | read the regex + its two controls | **fixed** — `/(?:^|[\s"])bg-destructive(?=[\s"\/]|$)/` cannot match `hover:bg-destructive/90`, and both arms are pinned |
| Graded guard ladder not lightened | `PublishedCardDelete.test.tsx` scores delete 4/4 and fork 0/4 with a strict `heavy − light === 4` | **held, and now machine-checked for the first time** |

The defect class the prompt warned about — **fences that cannot fire** — I could not find a fresh
instance of. Every new `?raw` sweep I traced carries a non-vacuity floor before its absence claims
(`apiClientSource199 > 10000`, `doorSwitchSource > 500`, `tailwindConfigSource.length > 0`, the
per-source `C10_SOURCES` case, the `[workflowSoulSource, soulDataSource, deriveTierSource]` loop),
and the negative sweeps carry permanent positive controls. The declared re-baseline
(`FLAG_OFF_HEADER_MARKUP` band 3) is **one class token** (`text-foreground` → `text-muted-foreground`)
inside one span, backed by a class-free atom capture (`restingAtoms`) committed one commit earlier
that passed unedited — that backing **is** sufficient, because a class-free reading is exactly the
control that can distinguish "presentation moved" from "content moved".

What I did find: one **user-facing contradiction the phase introduced and its own suite does not
cover** (WR-01, proven by a driven render), one **fabricated time string** surviving in the exact
function 199-07 rewrote for honesty (WR-02), **two new eslint errors** from two plans that never ran
eslint (WR-03), a **verbatim duplication of the new refusal across two files** (WR-04), an
**accessibility gap in the refusal's own "said out loud" claim** (WR-05), and one **unguarded
4px geometry shift from a subtraction** (WR-06) — the milder form of criterion 3.

---

## Warnings

### WR-01: `ModelField` says "this workspace offers no models" directly beneath a select that visibly offers one

**File:** `frontend/src/components/workflows/ModelField.tsx:360-368` (gate), `:331-337` (the contradicting option)
**Severity:** Warning
**Introduced by:** 199-06 Task 3

The new third-reading sentence is gated on `offered.length === 0`, and `offered` is built from
**enabled rows only** (`:263 if (!row.enabled) continue`). But the retention option two lines up is
gated on `!tierById.has(value)` — i.e. on the *same* emptiness. So the two are not mutually
exclusive: they are **mutually implied** whenever the step names a model and no row is enabled.

**Proven, not reasoned about.** I rendered it:

```tsx
<ModelField value="gpt-5" models={[{ model_id: "gpt-5", enabled: false, … }]} runDefaultModel={null} … />
```

```
✓ getByRole("option", { name: /gpt-5 \(current\)/ })   →  found
✓ getByTestId("model-registry-empty").textContent      →  "This workspace offers no models for this step."
1 passed
```

The reader sees a dropdown containing a choosable model and, immediately under it, a sentence saying
there are none. On the `retainedIsUnknown` path they additionally get `UNKNOWN_CAPTION` **and**
`REGISTRY_EMPTY` stacked — two captions about the same fact. This is the phase's own "fabricated
fact" class (criterion 6): the sentence makes a claim about what is offerable that the control it
sits under refutes. Reachable whenever an operator disables every row, or when the registry answers
with only disabled/deprecated-and-disabled rows.

**Fix** — gate on "nothing is choosable", not on "nothing is offerable", and say the honest thing
when a retained model is the only choice:

```tsx
{offered.length === 0 && retained === null && (
  <p data-testid="model-registry-empty" className="mt-1 text-[10.5px] leading-snug text-muted-foreground">
    {REGISTRY_EMPTY}
  </p>
)}
```

and add the case to `ModelField.test.tsx` beside the existing empty-registry case:

```tsx
it("an all-disabled registry with a stored model does NOT claim there is nothing to offer", () => {
  render(<ModelField value="gpt-5" models={[row("gpt-5", { enabled: false })]} runDefaultModel={null} … />)
  expect(screen.getByRole("option", { name: /gpt-5 \(current\)/ })).toBeInTheDocument()
  expect(screen.queryByTestId("model-registry-empty")).toBeNull()
})
```

---

### WR-02: an unparseable `expires_at` renders `expires in NaNm` — in the function 199-07 declared TOTAL

**File:** `frontend/src/components/panel/FilesSection.tsx:121-128`
**Severity:** Warning
**Introduced by:** 199-07 Task 2 (the arm is older; the plan rewrote this function and claimed the blank was made *unrepresentable*)

The docblock now says *"The return type is now TOTAL (`string`, never `null`) — which is what makes
the blank unrepresentable rather than merely unlikely."* The blank is gone. A **worse** output is
not: `new Date(x).getTime()` is `NaN` for any unparseable string, `NaN <= 0` is false, `NaN >= 1` is
false, and `Math.max(1, Math.floor(NaN / 60_000))` is `NaN`.

```
node> expiryCaption("not-a-date")            → "expires in NaNm"
node> expiryCaption("2026-13-45T99:99:99Z")  → "expires in NaNm"
```

`isNearExpiry` also returns `false` for it, so the string is painted calm-muted — the surface asserts
a definite, imminent, *nonsense* expiry with no cue at all. That is precisely the "plausible wrong
value is worse than a blank" argument the sibling fix in `WorkflowRunPage.tsx` was built on, pointed
the other way. The four new cases in `FilesSection.test.tsx` cover absent / known-past / known-future
/ non-template — not unparseable.

**Fix** — route an unparseable value to the same honest reading as an absent one:

```ts
function expiryCaption(expiresAt?: string): string {
  if (!expiresAt) return EXPIRY_UNKNOWN
  const at = new Date(expiresAt).getTime()
  if (Number.isNaN(at)) return EXPIRY_UNKNOWN   // the wire said something we cannot read
  const ms = at - Date.now()
  …
}
```

and pin it: `expect(expiryCaption("not-a-date")).toBe("expiry unknown")`, plus a rendered case
asserting `screen.queryByText(/NaN/)` is null.

---

### WR-03: two NEW eslint errors, from the two plans that did not run eslint

**Files:** `frontend/src/components/workflows/FieldGuidance.tsx:79` · `frontend/src/components/workflows/WorkflowCanvas.tsx:401`
**Severity:** Warning
**Introduced by:** 199-06 (new file) and 199-05 (two new value exports)

```
src/components/workflows/FieldGuidance.tsx
  79:17  error  Fast refresh only works when a file only exports components…  react-refresh/only-export-components
src/components/workflows/WorkflowCanvas.tsx
  401:14 error  Fast refresh only works when a file only exports components…  react-refresh/only-export-components
```

Both are **new**, provably. At the base commit `WorkflowCanvas.tsx` exported only types, the
component and the default (`git show b5464184:… | grep '^export '` → `CanvasNotice`, `CanvasSession`,
`WorkflowCanvasProps`, `WorkflowCanvas`, `default`) — types are exempt from this rule, so the file
was clean for it. `BRANCH_CONNECTOR_WORD` and `BACKGROUND_GROUND` are the first value exports.
`FieldGuidance.tsx` did not exist.

This rule is an **active error** in this repo and the codebase has a standing answer to it —
`PlaneEditingLayer.tsx:27` and `FlowEdge.tsx:135` both record being restructured for exactly this,
and `DoorHeaderStrip.tsx:47` names it. 199-09's summary reports its two eslint errors and proves them
pre-existing; **199-05 and 199-06 have no eslint row in their Gates tables at all**, which is how
these landed. (CI does not gate on the full `eslint .` — `frontend-tests.yml:45-57` runs only
`lint:a11y` — so nothing else would have caught them.)

**Fix** — the shipped idiom, a leaf module, in both cases:

```ts
// frontend/src/components/workflows/canvasGround.ts
export const BRANCH_CONNECTOR_WORD = "on fail"
export const BACKGROUND_GROUND = { … } as const
```
```ts
// frontend/src/components/workflows/fieldGuidanceContext.ts
export const FIELD_GUIDANCE_SHOW = "Explain each field"
export const FIELD_GUIDANCE_HIDE = "Hide the explanations"
export function useFieldGuidance(): boolean { … }
```
Re-export from the component file if any suite imports through it, then re-run
`npx eslint <the two files>` and require exit-clean. Note `WorkflowCanvas.test.tsx` imports both
constants **from `./WorkflowCanvas`**, so the re-export (or the import update) is load-bearing.

---

### WR-04: the describe refusal is duplicated verbatim across two files — predicate, class concatenation and markup

**Files:** `frontend/src/components/workflows/WorkflowDoorSwitch.tsx:238,405-421` · `frontend/src/pages/WorkflowBuilderPage.tsx:1928,1954-1980`
**Severity:** Warning
**Introduced by:** 199-08 (door) then 199-09 (builder page)

Byte-identical in both files:

```ts
const refusingDescribe = describe.length > 0 && describe.trim().length === 0
```
```tsx
{...(refusingDescribe ? { "aria-invalid": true } : {})}
className={`w-full resize-none rounded-lg border ${refusingDescribe ? "border-destructive" : "border-border"} bg-card px-4 py-4 text-[15px] leading-relaxed text-foreground ${refusingDescribe ? "focus:border-destructive" : "focus:border-primary"} focus:outline-none focus:ring-1 ${refusingDescribe ? "focus:ring-destructive" : "focus:ring-primary"}`}
```
plus the same six-line `<p data-testid="describe-refusal" role="status" className="-mt-2 …">` block.

The *sentence* is correctly governed (`DESCRIBE_REFUSAL` is imported in both, and `doorVocabulary`'s
count moved 22 → 23 in the same commit as the sweep's — good). The **rule and the presentation are
not**. Both plans' comments justify the concatenation idiom locally; neither notices there are now
two homes for one decision. CLAUDE.md's own "one home per concern" rule and this phase's own repeated
finding ("a second spelling of a governed string is how a governed string stops being governed")
apply to the predicate exactly as they apply to the string. A later change to the trim rule, the
tone, or the `aria-invalid` shape will land in one file and not the other, and nothing reds.

**Fix** — a leaf beside `doorVocabulary.ts` (which also gives WR-05 one place to fix):

```tsx
// frontend/src/components/workflows/DescribeBox.tsx
export const describeIsRefused = (describe: string) =>
  describe.length > 0 && describe.trim().length === 0
export function DescribeBox({ value, onChange, disabled, ariaLabel }: DescribeBoxProps) { … }
```
Both mounts then render `<DescribeBox …/>`. The two byte-pins that scope to the CTA group
(`FLAG_OFF_DESCRIBE_MARKUP`, `GOVERN_INLINE`) walk up from `describe-hint`, so an extracted component
rendering the identical DOM leaves them untouched — verify with the existing suites rather than
re-capturing.

---

### WR-05: the refusal is announced to nobody — a live region inserted with its own content, and `aria-invalid` with no `aria-describedby`

**Files:** `frontend/src/components/workflows/WorkflowDoorSwitch.tsx:405,412-420` · `frontend/src/pages/WorkflowBuilderPage.tsx:1954,1972-1980`
**Severity:** Warning
**Introduced by:** 199-08 / 199-09

The plan's headline claim for this row is *"THE REFUSAL, SAID OUT LOUD — the sheet's whole finding
for this surface, and the one thing a disabled button cannot do."* For a sighted user it is. For a
screen-reader user, two things defeat it:

1. **`role="status"` on a node that does not exist until the moment it has content.** The refusal
   `<p>` is rendered by `{refusingDescribe && (…)}`, so the live region and its text are inserted in
   the same commit. NVDA and JAWS announce *mutations inside an already-present* live region; a
   region added together with its content is routinely not announced. The pattern that works is a
   region that is always in the DOM and whose text changes.
2. **`aria-invalid` with no `aria-describedby`.** The textarea is marked invalid, but nothing
   associates it with the sentence that explains why. An AT user tabbing to the box hears
   "invalid" and is told nothing about what to do — which is the exact state ("a control that
   refuses and says nothing") the row exists to end.

**Fix** — keep the region mounted, associate it, and let emptiness carry the resting state
(this keeps the resting DOM's *text* byte-identical; the byte pins that cover the CTA group are
scoped above/below this node, so re-run them rather than assuming):

```tsx
<textarea
  {...(refusingDescribe ? { "aria-invalid": true } : {})}
  aria-describedby={refusalId}
  …
/>
<p id={refusalId} data-testid="describe-refusal" role="status"
   className={refusingDescribe ? "-mt-2 text-[12.5px] leading-snug text-destructive" : "sr-only"}>
  {refusingDescribe ? DESCRIBE_REFUSAL : ""}
</p>
```
and add a driven case: type `"   "`, assert `getByTestId("describe-box")` has
`aria-describedby` resolving to an element whose `textContent` is `DESCRIBE_REFUSAL`.

---

### WR-06: hoisting the tool-whitelist refusal out of the `help` channel silently moved the row by 4px

**File:** `frontend/src/components/workflows/PhaseFormPanel.tsx:392-397, 711-722`
**Severity:** Warning
**Introduced by:** 199-06 Task 2

The plan states the literal *"moved four lines, it was not re-spelled"*. The **spacing** moved too,
and it is unguarded.

`FieldLabel`'s bottom margin is keyed on the helper being *shown*:

```tsx
className={`flex items-center text-[11px] font-medium text-foreground ${showHelp ? "" : "mb-1"}`}
```

Before: `ToolWhitelistRail` passed `help=…`, so at the (then always-on) reading `showHelp` was true
and the label emitted **no** `mb-1`; the helper `<p>` supplied `mt-0.5`. Gap ≈ 2px.
After: the rail passes **no** `help` at all, so `showHelp` is `false` and the label now emits
`mb-1`; the new refusal `<p data-testid="tools-no-typing">` still carries `mt-0.5`. Gap ≈ 6px.

That is a 4px shift on one field, caused by a subtraction — the same failure mode criterion 3 names
(`border-transparent` vs dropping `border`), in its milder form. It is invisible to the suite: no
case reads a class or a spacing token on either node, and jsdom runs no layout.

**Fix** — either drop the duplicated top margin on the hoisted paragraph, or let the label know a
sibling follows it. The smaller edit:

```tsx
<p data-testid="tools-no-typing" className="mb-1 text-[11px] leading-snug text-muted-foreground">
  {TOOL_WHITELIST_NO_TYPING}
</p>
```
and pin it, so the next mover finds out from a test:
```tsx
expect(screen.getByTestId("tools-no-typing").className).not.toMatch(/(^|\s)mt-/)
expect(screen.getByText("What this step can do").closest("label")!.className).toMatch(/(^|\s)mb-1(\s|$)/)
```

**Related, and pre-existing rather than introduced** (recorded so the same edit can close it): the
refusal renders **above** the `options === "degraded"` branch, so a failed tool read prints
*"Pick from the tools this workspace allows — you cannot add one by typing."* directly above
*"We couldn't load the tools this step is allowed to use."* The `help` prop rendered in the same
place before this plan, so this is not a regression — but the sentence now has its own testid and
still no case covering the degraded arm.

---

## Info

### IN-01: the ⓘ affordance is duplicated into the new no-answer arm, `role="button"` with no activation

**File:** `frontend/src/components/workflows/ModelField.tsx:214-223` (new) and `:294-303` (shipped)
The new arm re-types the ⓘ span verbatim: `tabIndex={0}` + `role="button"` + `aria-label` + `title`,
with **no `onClick` and no `onKeyDown`**. It is a focusable element announced as a button that cannot
be activated by any means — now in two places instead of one. **Fix:** extract
`function HintDot({ text }: { text: string })` in this file and use it in both arms; while there,
`role="note"` (or dropping `role` and keeping the `aria-label`/`title`) states what it actually is.

### IN-02: `role="status"` on the no-answer note has the same insertion problem as WR-05

**File:** `frontend/src/components/workflows/ModelField.tsx:225-231`
The `<p role="status">` exists only when `noAnswer !== undefined`, so the region and its content
arrive together and are unlikely to be announced. In this arm the sentence is also the only thing on
screen, so a sighted user is fine and the cost is smaller than WR-05's. **Fix:** same shape — mount
the region unconditionally, vary its text.

### IN-03: the density ceiling resets every time the panel closes

**File:** `frontend/src/components/workflows/FieldGuidance.tsx:112` (`useState(false)`), `frontend/src/components/workflows/PhaseFormPanel.tsx:907`
`PhaseFormPanel` returns the collapsed rail when `!open || !phase`, which unmounts `FieldGuidance`
and discards `shown`. A person who wants the explanations must re-open them on every step whose
selection closed the panel. **Fix:** if that is intended, say so in the docblock (which currently
argues only about the *context default*); if not, lift the boolean to the panel's owner or persist it
the way the ⌥ Technical-names reveal is persisted.

### IN-04: `aria-expanded` with no `aria-controls` on the guidance toggle

**File:** `frontend/src/components/workflows/FieldGuidance.tsx:120-121`
The button declares itself a disclosure but names nothing it discloses, and the disclosed content is
~7 scattered `<p data-testid="field-help">` nodes rather than one container — so `aria-controls`
cannot honestly be pointed anywhere. **Fix:** either drop `aria-expanded` (the label already changes
between `FIELD_GUIDANCE_SHOW` and `FIELD_GUIDANCE_HIDE`, which is the honest signal) or state in the
docblock why a disclosure without a controlled region is the right trade here.

### IN-05: the mechanism sweep 199-01 built for the node face has no counterpart on the form panel or the gauntlet, and both still print internal identifiers

**Files:** `frontend/src/components/workflows/PhaseFormPanel.tsx:1212` · `frontend/src/components/workflows/PublishGauntlet.tsx:352`
`qualifier="(coming in Phase 106)"` renders on a **permanently visible** label (qualifiers do not
travel through the guidance channel), and the gauntlet's run-view tooltip reads *"Run view coming
soon — the golden-run surface lands in a later phase (D-103-A)."* Both predate this phase, so neither
is a regression — but `MECHANISM_PATTERNS` in `PhaseNodeCard.test.tsx` would fire on neither surface
because it is scoped to the node face, and 199-06 re-presented this panel without ever asking the
question. **Fix (cheap):** lift `MECHANISM_PATTERNS` / `mechanismHits` into a shared test helper and
run it over `PhaseFormPanel`'s and `PublishGauntlet`'s rendered text; then re-word both strings —
*"(not available yet)"* and *"Run view coming soon."* — as a `/gsd:fast`.

### IN-06: the a11y CI gate is already red, so it cannot report a new regression by exit code

**File:** `.github/workflows/frontend-tests.yml:54-57`
`npm run lint:a11y` at HEAD exits with **5 errors** (`OutputFileCard.tsx:200`,
`PresetPickerStep.tsx:104`, `SetupTokenGate.tsx:163`, `SmokeChecklist.tsx:320`,
`WorkflowRunPage.tsx:1123`). All five are pre-existing — `WorkflowRunPage.tsx`'s `role="list"` is at
base line 1082 — and this phase added none. Recorded because the workflow's own comment says the step
exists so *"an a11y regression cannot silently merge"*, and a gate that is already failing conveys no
signal about the next one. **Fix:** out of this phase's scope; worth a seed with a re-open trigger,
or a pinned-baseline shim.

### IN-07: a "non-vacuity FIRST" comment that runs last

**File:** `frontend/src/components/workflows/ProblemsTray.test.tsx` (the `NO FRIENDLY-MESSAGE MAP` case)
The comment reads *"NON-VACUITY, first: the source really loaded"* but the
`expect(problemsTraySource.length).toBeGreaterThan(500)` line sits **after** the `for (const needle …)`
loop it is meant to protect. Within one `it` the case still fails on an empty source, so this is a
readability defect, not a hole — but the file's own stated idiom is "prove it has something to read
BEFORE it reads it", and a reader copying this block as the pattern will copy the wrong order.
**Fix:** move the two non-vacuity lines above the loop.

---

_Reviewed: 2026-08-19T12:05:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

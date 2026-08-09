---
phase: 187-business-vocabulary-ai-seeded-canvas
reviewed: 2026-08-04T00:00:00Z
depth: standard
round: 5 (gap closure)
diff_base: 15339441
prior_round:
  reviewed: 2026-08-03T00:00:00Z
  round: 3 (gap closure)
  diff_base: f632f9b6
  findings: 1 critical / 6 warning / 4 info (plus 15 carried forward)
  scope: 4 files
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
files_reviewed: 16
files_reviewed_list:
  - backend/app/api/workflows.py
  - backend/tests/unit/test_182_severity_codes.py
  - backend/tests/unit/test_187_route_assigned_reach.py
  - frontend/src/components/workflows/DescribeKbPicker.test.tsx
  - frontend/src/components/workflows/DescribeKbPicker.tsx
  - frontend/src/components/workflows/ProblemsTray.test.tsx
  - frontend/src/components/workflows/ProblemsTray.tsx
  - frontend/src/components/workflows/WorkflowCanvas.tsx
  - frontend/src/components/workflows/WorkflowDoorSwitch.test.tsx
  - frontend/src/components/workflows/WorkflowDoorSwitch.tsx
  - frontend/src/components/workflows/verdictModel.test.ts
  - frontend/src/components/workflows/verdictModel.ts
  - frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx
  - frontend/src/pages/WorkflowBuilderPage.describe.test.tsx
  - frontend/src/pages/WorkflowBuilderPage.tsx
  - scripts/vitest-count-gate.cjs
findings:
  critical: 1
  warning: 6
  info: 6
  total: 13
carried_forward:
  critical: 0
  warning: 11
  info: 13
  total: 24
status: issues_found
---

# Phase 187: Code Review Report — Round 5 (gap closure)

**Reviewed:** 2026-08-04
**Depth:** standard
**Round:** 5 (gap closure — plans 187-26 / 187-27 / 187-28 / 187-29, diff base `15339441`)
**Files Reviewed:** 16 (7 production source, 8 test, 1 tooling script)
**Status:** issues_found

## Summary

Round 5's three gaps are three different qualities of work, and the difference is worth
stating before the findings.

**GAP B (187-27) is the strongest thing in this round.** It is a real fail-open, closed at
the right seam, with the narrowing of D-184-15 written down in the open rather than smuggled
in, and with the D-181-01 half-line (`canvasEnabled &&`) given its own falsification test
(`WorkflowBuilderPage.canvas.test.tsx`, "D-181-01 — with the flag OFF the VERY SAME open
issues ZERO validate requests"). I traced the state machine: `beginBeat`
(`useLiveValidation.ts:155-160`) can only return `{kind:"checking"}` from `idle`/`checking`,
so `isCheckOutstanding` is true exactly until the first answer and never re-arms — which is
what makes the new fence liveable rather than a permanent refusal. The predicate is keyed on
`ValidationState["kind"]` so a renamed loop state is a typecheck error. I could not construct
a live path where a `verdicts` answer is claimed for a check nobody made **within one mount**
(WR-R5-06 records the one shape that would, and why it is not currently reachable).

**GAP C (187-28) is comment-only in production and its two behavioural fences are real.**
`backend/tests/unit/test_187_route_assigned_reach.py` measures the true half over the
quantified SET rather than over one hand-picked code, and its Property-2 positive control
(`set(GROUNDING_VERDICT_CODES) <= codes`, stated as a subset *on purpose* so it cannot
shadow the disjointness assertion) is the correct shape. Measured: `16 passed` for
`test_187_route_assigned_reach.py` + `test_182_severity_codes.py`. The corrected claim in
`workflows.py:478-487` is accurate — I verified `blockedReason`
(`WorkflowBuilderPage.tsx:1132-1135`) really does fall back to `verdicts[0]`, so an
`incomplete`-only envelope really does grey the Publish control.

**GAP A (187-26) is where this round's defect is.** The picker itself is a clean leaf, but it
is the one piece of round 5 that adds a new *input path to a request*, and it ships two
properties nothing measures: it never reconciles the `value` it is handed against the folders
it actually fetched, and its state lives in a parent that deliberately outlives it. Together
those produce a `project_folder_id` on the wire that the author cannot see and did not
confirm on that mount — and, because the server's `unbound_retrieval` rule tests only
`is None` (`workflows.py:755`), a stale id **silently satisfies the very gate GAP A exists to
help the author satisfy**. That is CR-R5-01.

**And 187-29, the round's own honesty instrument, does not hold what it claims to hold.**
Measured with the script itself at HEAD — not read from a plan:

```
WorkflowBuilderPage.canvas.test.tsx     22     128    +106
WorkflowDoorSwitch.test.tsx             13      21      +8
DescribeKbPicker.test.tsx               30      30       0
ProblemsTray.test.tsx                   30      30       0
verdictModel.test.ts                    29      29       0
total                                  804    2168   +1364      failed 0
```

The three new pins are exact and correct. But the born-bound round trip — GAP A's only
end-to-end fence — lives in `WorkflowDoorSwitch.test.tsx`, whose pin is 13 against an actual
of 21, so all eight of round 5's cases there are deletable with the gate green. The whole
GAP-B and GAP-C behavioural estate lives in `WorkflowBuilderPage.canvas.test.tsx` at 22
against 128. And `WorkflowBuilderPage.describe.test.tsx` — which round 5 extended with the
additive-prop pins — **did not appear in the run at all**: it is absent from `TARGETS`
(`vitest-count-gate.cjs:168-179`), so its three new cases are outside the gate's blast radius
entirely. That is WR-16 from round 3, reintroduced, in the same commit that cites WR-16's
lesson.

Direct answers to the four `must_know` items, each checked against source:

| # | Question | Verdict |
|---|---|---|
| 1 | Should `not-run` be renamed? | **No, and I am not filing it.** `governanceVocabulary.test.ts` runs at 30 cases in the gate sample and sweeps this tree; the DO-NOT-TIDY note at `verdictModel.ts:108-116` is accurate. I have no counter-opinion, not even at Info. |
| 2 | Did round 5 worsen `WorkflowCanvas.tsx`'s cycle or extraction seam? | **No — it improved both.** The 9-insertion delta swaps a `import type` edge from `@/hooks/useLiveValidation` (a hook with a runtime `@/lib/api` dependency) to `@/components/workflows/verdictModel` (a pure module the file *already* type-imports at `:216`). No new module is named, no value import is added, and the `FlowEdge` module-scope value import is untouched. The only residue is a duplicate `import type` statement (IN-R5-01). |
| 3 | Did `WorkflowBuilderPage.tsx` honour the ≤15-insertion cap? | **Yes, exactly.** `git diff --numstat` measures **15 ins / 3 del**. The density that cap bought is real and I have priced it as Info, not Warning (IN-R5-02). |
| 4 | Is `D-ITEM-187-29-01` real? | **CONFIRMED, and understated.** See WR-R5-03 — the flag-off delta is not only a visible control; it is a network request the door never made and a request field the door could never previously supply. |

Measured, not inherited, for this round: `npx tsc --noEmit -p tsconfig.app.json` → **33
errors, identical to the D-ITEM-01 baseline, zero of them in `src/components/workflows/` or
`WorkflowBuilderPage.tsx`**. `npx eslint` over the six changed production files → 2 errors,
both the pre-existing `react-refresh/only-export-components` at `WorkflowCanvas.tsx:364` and
`WorkflowBuilderPage.tsx:238`, neither introduced here.

---

## Prior-round disposition (measured at HEAD, not re-litigated)

Round 5's diff touches none of `SeedReceipt.tsx`, `definitionOps.ts`, `phaseVocabulary.ts` or
their suites, so it could not have moved most of the standing list. **Round 4 (plans
187-22 … 187-25) is outside this round's diff base and its own review is not in this file;
its dispositions are not re-litigated here.** Two exceptions, both of which I can point at
code for:

- **Round-3 CR-04 — CLOSED.** `WorkflowBuilderPage.tsx:615` declares
  `const [receiptPhases, setReceiptPhases] = useState<readonly PhaseSpecJSON[]>([])`, it is
  written beside the single state transition at `:1228` (`setReceiptPhases(def.phases)`), and
  `:1656` renders `<SeedReceipt phases={receiptPhases} …>` rather than the live store
  selector. That is CR-04's proposed snapshot, shipped. Carried criticals → 0.
- **Round-3 WR-16 — CLOSED.** `vitest-count-gate.cjs:110` and `:113` now pin
  `definitionOps.test.ts` at 232 and `SeedReceipt.test.tsx` at 68, and both reported delta
  `0` in my own run. Carried warnings 12 → 11.

Everything else from rounds 1–3 (WR-08, WR-10 … WR-15, IN-01 … IN-14) is carried forward
mechanically as an **upper bound**: unverified this round, possibly already closed by round 4.

---

## Round 5 findings

Ids are prefixed `R5` so they cannot collide with round 4's unknown sequence.

### Critical Issues

#### CR-R5-01: `DescribeKbPicker` never reconciles its `value` against the folders it fetched, and the door's `kbFolderId` outlives it — so a stale, invisible `project_folder_id` reaches `generateWorkflow` and suppresses `unbound_retrieval`

**File:** `frontend/src/components/workflows/DescribeKbPicker.tsx:91-164` (specifically `:140`),
`frontend/src/components/workflows/WorkflowDoorSwitch.tsx:112-131`, `:257`,
`frontend/src/pages/WorkflowBuilderPage.tsx:591-592`, `:1213`
(server amplifier: `backend/app/api/workflows.py:755`)

**Issue:**

Three facts, each verified in source, compose into a defect none of them has alone.

1. **The picker holds no copy of the choice and never validates the one it is given.**
   `value` is rendered straight onto the `<select>` (`:149`) and the only writes are the
   user's own `onChange` (`:150`). There is no effect, no reconcile, no `onChange("")` when
   the fetched `options` do not contain `value`.

2. **When there is nothing to offer, the picker renders nothing at all — including no way to
   clear a choice that is still live:**

   ```tsx
   // DescribeKbPicker.tsx:139-140
   // Nothing to offer ⇒ nothing at all. No empty select, no placeholder, no copy.
   if (options.length === 0) return stateMarker
   ```

   `options` is `[]` in *both* zero-row states, and `"unavailable"` is one of them
   (`:118-124`). A failed fetch therefore hides the control while the parent's choice stands.

3. **The parent's choice is deliberately made to outlive the picker.**
   `WorkflowDoorSwitch.tsx:117-118` states it as the design: *"it is deliberately NOT cleared
   by `goBoth` … a considered pick is not undone by looking around."* `goBoth`
   (`:128-131`) clears `handoffDraft` and not `kbFolderId`.

**Failure scenario A — a transient fetch failure (no exotic fixture required):**

1. Describe door. `listFolders()` succeeds; the author picks *Contracts*. `kbFolderId =
   "f-contracts"`.
2. The author clicks `‹ both doors` to look around, then re-enters the describe door. The
   door shell stays mounted, so `kbFolderId` survives; the **picker remounts and refetches**
   (`useEffect(…, [])`, `:99-129`).
3. That refetch fails — a blip, an expired token, a 5xx. `setState("unavailable")`,
   `options = []`, and `DescribeKbPicker` returns the hidden `<span>` marker only.
4. The author types a requirement and clicks *Draft the workflow*. `kbFolderId` is still
   `"f-contracts"`, so `initialProjectFolderId` seeds `projectFolderId`
   (`WorkflowBuilderPage.tsx:591-592`) and `onDraft` sends
   `project_folder_id: "f-contracts"` (`:1213`).

The workflow is born bound to a knowledge base **that never appeared on the screen the author
was looking at**, with no control present to see it or unset it.

**Failure scenario B — the folder is gone, and this is the one that matters:**

Same steps, but the refetch *succeeds* and simply no longer contains `f-contracts` (deleted,
moved out of the author's org scope by RLS, or renamed away). `options.length > 0`, so the
picker renders — with `value="f-contracts"` matching no `<option>`. React sets
`selectedIndex = -1`; the select displays **blank**, which an author reads as *"nothing
picked"*. It is not nothing: `generateWorkflow` still receives the dead id.

And the server does not catch it. `GenerateRequest.project_folder_id` is `UUID | None`
(`workflows.py:1381`) — a syntactically valid UUID passes Pydantic with no ownership or
existence check on this route. Then:

```python
# backend/app/api/workflows.py:755
if body.project_folder_id is None:
    findings.extend({... "code": "unbound_retrieval" ...})
```

`unbound_retrieval` tests **only** `is None`. A non-null id pointing at nothing suppresses
the finding entirely, so `ok:true`, `blockedReason` is `null`, and Publish is enabled on a
workflow whose retrieval steps are scoped to a folder that does not exist. The `is None`-only
test is pre-existing D-187-11 behaviour and I am not attributing it to round 5 — but round 5
is the first surface that can produce a stale, invisible, non-null id, so the composition is
newly reachable.

**Why nothing catches it.** `DescribeKbPicker.test.tsx` has 30 cases and none of them supplies
a `value` that is absent from the fetched list; its `reflects the value PROP` case (`:132`)
uses an id that *is* offered. `WorkflowDoorSwitch.test.tsx`'s new "the choice SURVIVES a look
around the chooser" case (the closest one) re-resolves the **same two folders** on the second
mount, so it exercises the surviving-value path only in the case where it is safe.

**Fix:** the component that owns the offer must own the reconcile — the value it renders and
the value it lets stand must be the same value.

```tsx
// DescribeKbPicker.tsx — inside the resolve branch, after `setOptions(rows)`
setOptions(rows)
setState(rows.length > 0 ? "ready" : "none")
// 187-R5/CR-R5-01 — A CHOICE THIS PICKER CANNOT SHOW IS A CHOICE IT MAY NOT LET STAND.
// The parent's value outlives this component by design (WorkflowDoorSwitch's `goBoth`
// keeps it), so a remount that no longer offers the chosen folder — deleted, out of RLS
// scope, or unfetchable — must retract it rather than ship an id nobody can see. It goes
// to "" and not to a fabricated row: "we could not confirm your pick" resolves to NOT
// BOUND, which is the state `unbound_retrieval` can still speak about.
if (value !== "" && !rows.some((r) => r.id === value)) onChange("")
```

```tsx
// …and the same retraction on the unavailable branch, which today hides the control
// while leaving the binding live:
} catch {
  if (cancelled) return
  setOptions([])
  setState("unavailable")
  if (value !== "") onChange("")   // no control on screen ⇒ no binding may stand
}
```

Add `value` and `onChange` to the effect's dependency list (or read them from a ref) so the
lint rule and the behaviour agree.

**Falsifying tests to add (both should be RED before the fix):**

```tsx
it("retracts a value the refreshed list no longer offers (CR-R5-01)", async () => {
  const onChange = vi.fn()
  api.listFolders.mockResolvedValue([folder("f-policies", "Policies")])
  render(<DescribeKbPicker value="f-contracts" onChange={onChange} />)
  await screen.findByTestId("project-folder-picker")
  expect(onChange).toHaveBeenCalledWith("")
})

it("retracts a value when the list could not be fetched at all (CR-R5-01)", async () => {
  const onChange = vi.fn()
  api.listFolders.mockRejectedValue(new Error("blip"))
  render(<DescribeKbPicker value="f-contracts" onChange={onChange} />)
  await waitFor(() =>
    expect(screen.getByTestId("describe-kb-state").getAttribute("data-state")).toBe("unavailable"),
  )
  expect(onChange).toHaveBeenCalledWith("")
})
```

and the end-to-end one, in `WorkflowDoorSwitch.test.tsx`, which is the assertion that
actually protects the wire:

```tsx
it("a pick the door can no longer show does NOT reach generateWorkflow", async () => {
  const select = await openDescribeDoorWithFolders()
  fireEvent.change(select, { target: { value: KB_CONTRACTS.id } })
  fireEvent.click(screen.getByTestId("both-doors"))
  mockListFolders.mockRejectedValue(new Error("blip"))     // the folder is gone / unreachable
  fireEvent.click(screen.getByTestId("door-card-describe"))
  await waitFor(() => expect(mockListFolders).toHaveBeenCalledTimes(2))
  fireEvent.change(screen.getByTestId("describe-box"), { target: { value: "anything" } })
  fireEvent.click(screen.getByTestId("describe-draft"))
  await waitFor(() => expect(mockGenerateWorkflow).toHaveBeenCalled())
  const request = mockGenerateWorkflow.mock.calls[0][0] as Record<string, unknown>
  expect(Object.prototype.hasOwnProperty.call(request, "project_folder_id")).toBe(false)
})
```

---

### Warnings

#### WR-R5-01: The round-5 pins do not pin round 5's load-bearing fences — the born-bound round trip and the whole GAP-B/GAP-C behavioural estate are still deletable with the gate green, and one suite is outside the gate entirely

**File:** `scripts/vitest-count-gate.cjs:143-145`, `:148`, `:153`, `:168-179`

**Issue:**

Plan 187-29's commit message is *"pin round 5's three suites — the guards stop being
deletable."* Measured with the script itself at HEAD (`node scripts/vitest-count-gate.cjs`,
green, `failed 0`, total 2168):

| suite | pin | actual | slack | what lives in the slack |
|---|---|---|---|---|
| `DescribeKbPicker.test.tsx` | 30 | 30 | **0** | the leaf's own fences — correctly pinned |
| `ProblemsTray.test.tsx` | 30 | 30 | **0** | GAP B's absence fences — correctly pinned |
| `verdictModel.test.ts` | 29 | 29 | **0** | GAP B's sentence fences — correctly pinned |
| `WorkflowDoorSwitch.test.tsx` | 13 | 21 | **+8** | **all 8 of GAP A's cases, including the only born-bound round trip** |
| `WorkflowBuilderPage.canvas.test.tsx` | 22 | 128 | **+106** | **every GAP-B page fence *and* the entire 187-28 "GATED half"** |
| `WorkflowBuilderPage.describe.test.tsx` | — | **did not run** | — | the 3 additive-prop / byte-identity cases |

The last row is the sharpest: that file is not in `TARGETS` (`:168-179`, which names only
`WorkflowBuilderPage.test.tsx`, `.canvas.test.tsx` and `.header.test.tsx`), and it did not
appear even in the script's own `new` extras list. Its cases are outside the gate's blast
radius, not merely unpinned.

The 106-case slack on the canvas suite is the one with a downstream consequence:
`backend/app/api/workflows.py:509-513` and
`backend/tests/unit/test_187_route_assigned_reach.py:19-20` both point at that suite by name
as the measurement for the corrected GAP-C claim, and
`test_the_corrected_comment_names_both_halves_and_points_at_its_evidence` asserts the
*pointer* survives. Nothing asserts the *target* does. A comment can keep citing a describe
block that has been deleted.

This is the recorded round-3 WR-16 shape ("the guards were deletable with the gate green")
reproduced in the commit that cites WR-16's own lesson. The deferred ledger's standing rule —
*a pin is LOWERED only alongside a deliberate deletion; ADDING a pin needs no deletion* —
means there is no obstacle to fixing this: raising `WorkflowDoorSwitch.test.tsx` 13 → 21 and
`WorkflowBuilderPage.canvas.test.tsx` 22 → 128 is an extension, exactly like the three that
were added.

**Fix:** in the same commit, and with every number read from the script's own `actual` column:

```js
  // 187-R5/WR-R5-01: these two ALSO became load-bearing in round 5 — GAP A's only
  // end-to-end round trip and GAP C's cited "GATED half" both live in their slack.
  // Raised as an EXTENSION (no deletion rode with it), per this file's own rule.
  "WorkflowBuilderPage.canvas.test.tsx": 128,   // was 22
  "WorkflowDoorSwitch.test.tsx": 21,            // was 13
```

and add the missing suite to the blast radius:

```js
const TARGETS = [
  …,
  // 187-R5: it carries the additive-optional-prop byte-identity pins for 187-26. A file
  // outside TARGETS is not merely unpinned — it never runs under the gate at all.
  "src/pages/WorkflowBuilderPage.describe.test.tsx",
]
```

Note `phaseVocabulary.test.ts` (33 pinned / 96 actual), `canvasModel.test.ts` (26/49) and
`PublishGauntlet.test.tsx` (24/46) carry comparable slack; those predate this round and are
not attributed to it, but the same one-line extension applies.

---

#### WR-R5-02: The 187-29 pin comment attributes GAP A's born-bound round trip to a suite that asserts `generateWorkflow` was called ZERO times

**File:** `scripts/vitest-count-gate.cjs:121-125`

**Issue:**

```js
//   · DescribeKbPicker.test.tsx  — GAP A: the loose "Describe & run" door's
//     knowledge-base picker, and the BORN-BOUND round trip (the folder chosen
//     before the AI drafts reaches `generateWorkflow`'s `project_folder_id` on
//     the request the client actually sends). Delete these and a workflow can
//     silently go back to being born unbound with every other gate green.
```

That suite does the opposite. `generateWorkflow` is a member of `FORBIDDEN_SYMBOLS`
(`DescribeKbPicker.test.tsx:54-62`) and `expectNothingElseCalled()` asserts
`toHaveBeenCalledTimes(0)` for it. The suite never renders `WorkflowDoorSwitch`, never
renders `WorkflowBuilderPage`, and contains no reference to `project_folder_id` at all
(`grep` returns two hits, both the mock declaration and the forbidden-symbol list). It tests
the leaf in isolation — correctly, and well.

The round trip it claims to hold is `WorkflowDoorSwitch.test.tsx`'s *"a folder chosen on the
door reaches generateWorkflow's project_folder_id"* — the suite left at pin 13 (WR-R5-01).
So the comment does not merely mis-cite: it names the wrong file **in the direction that
makes the gap invisible**, asserting protection for the one fence that is unprotected.

This matters more than an ordinary stale comment because the file's whole subject is that
claims about coverage must be measured. Its own header (`:52-56`) forbids hand-counted
numbers for exactly this reason; the same discipline was not applied to the prose beside them.

**Fix:** state what each suite actually holds, and move the round-trip claim to the file that
holds it (alongside WR-R5-01's pin raise):

```js
//   · DescribeKbPicker.test.tsx  — GAP A's LEAF: the picker offers what the server
//     returned and manufactures nothing, holds "there are none" apart from "we could
//     not ask", and reaches exactly one api symbol. It deliberately asserts
//     `generateWorkflow` at ZERO calls — the round trip is NOT here.
//   · WorkflowDoorSwitch.test.tsx — GAP A's ROUND TRIP: the folder chosen before the AI
//     drafts reaches `generateWorkflow`'s `project_folder_id` on the request the client
//     actually sends, and nothing chosen sends no key at all.
```

---

#### WR-R5-03: `D-ITEM-187-29-01` confirmed — and understated. The flag-off describe door gains a control, a network request it never made, and a request field it could never previously supply, so `visual_workflow_canvas` no longer reverts GAP A

**File:** `frontend/src/components/workflows/WorkflowDoorSwitch.tsx:34`, `:123`, `:196`, `:257`,
`frontend/src/pages/WorkflowsPage.tsx:403-411`,
`frontend/src/components/workflows/DescribeKbPicker.tsx:99-129`

**Issue:**

Confirmed against source rather than accepted as logged. `WorkflowsPage.tsx:403` renders
`<WorkflowDoorSwitch …>` unconditionally; only `inline` and `headerLead` are spread behind
`canvasEnabled` (`:411`). The shell reads no flag (its own docblock, `:82`, says so), and the
mount at `:257` is unguarded. So a `visual_workflow_canvas` **off** user meets the picker.

The ledger entry records this as "a new control on a screen a flag-off user reaches". Two
things it does not record, both measurable, both stronger:

1. **A network request the door never issued.** `DescribeKbPicker` calls `listFolders()` on
   mount (`:99-129`). The describe door previously issued none — the shell's own red lines
   say *"The shell adds NO API call"* (`:26`). Round 5's sibling plan 187-27 treated exactly
   this property as load-bearing, gating its loop on `canvasEnabled &&` *specifically* so a
   flag-off Builder "issues precisely the requests it issues today, pinned at zero", and gave
   that half-line a falsification test. The same round did the opposite one file over.

2. **A request field the door could never previously supply.** `kbFolderId` → `initialProjectFolderId`
   → `projectFolderId` (`WorkflowBuilderPage.tsx:591-592`) → `generateWorkflow`'s
   `project_folder_id` (`:1213`). None of that hop reads `canvasEnabled`. The door's fast path
   (`autoDraft`) skips the Builder's describe screen entirely, so before round 5 a door-path
   generate could *never* carry a binding; now it can, with the flag off. The flag-off change
   is on the wire, not only on the screen.

The ledger's reasoning that "the door is a different, upstream surface, and its flag-blindness
predates round 5" is fair about the *shell*. It does not carry to the *control*: the
flag-blindness is inherited, the new behaviour behind it is not. The practical consequence is
the one its own re-open trigger names — *"any plan that must be able to revert the v3.6
surfaces from the flag alone"* — and it is now true: turning the flag off no longer reverts
GAP A.

**Fix:** either gate the mount, or write the decision down as a decision. Gating is one line
and keeps the shell flag-blind by passing the answer down, exactly as `inline` already does:

```tsx
// WorkflowsPage.tsx — the host already evaluates the one shared gate rule
<WorkflowDoorSwitch
  …
  {...(canvasEnabled ? { inline: true, headerLead: breadcrumbGroup, offerKbPicker: true } : {})}
/>
```

```tsx
// WorkflowDoorSwitch.tsx — ABSENT ⇒ byte-identical to the shipped door (the D-14 idiom
// this file already uses for `inline`, so no second copy of the gate is created here).
{offerKbPicker ? <DescribeKbPicker value={kbFolderId} onChange={setKbFolderId} /> : null}
```

and pin it, in the shape 187-27 used for its own half-line:

```tsx
it("D-181-01 — with the flag OFF the describe door renders no picker and fetches no folders", async () => {
  render(<WorkflowDoorSwitch />)                 // no offerKbPicker key at all
  fireEvent.click(screen.getByTestId("door-card-describe"))
  await new Promise((r) => setTimeout(r, 50))
  expect(screen.queryByTestId("project-folder-picker")).toBeNull()
  expect(mockListFolders).toHaveBeenCalledTimes(0)
})
```

If the answer is instead "the door is deliberately outside D-181-01", that is a legitimate
answer — but it needs to be a recorded decision (`D-187-xx`) rather than a deferred item,
because a rollback plan will read the flag as complete.

---

#### WR-R5-04: GAP B's fence reaches the tray strip and the Publish control but not the node marks — during `not-run` every node on the canvas renders identically to "checked and clean", and nothing tests it

**File:** `frontend/src/pages/WorkflowBuilderPage.tsx:867-871`, `:1377`,
`frontend/src/components/workflows/verdictModel.ts:226-234`

**Issue:**

The stated property of 187-27 is that *the canvas never claims an all-clear it has no server
evidence for*. Two of the three surfaces now honour it. The third does not.

```ts
// WorkflowBuilderPage.tsx:867-871
const verdicts = useStore(store, (s) => s.verdicts)
const verdictGroups = useMemo(() => groupVerdicts(verdicts), [verdicts])
const marks = useMemo(() => (slug: string) => verdictGroups.markFor(slug), [verdictGroups])
```

`marks` is derived only from the store's `verdicts`, which is empty until the first answer —
and the mirror effect (`:818-839`) deliberately does not touch `setVerdicts` on the `idle` or
`checking` branches. `markFor` returns `undefined` for every slug, and `undefined` is
documented as *"the server said nothing about it"* (`verdictModel.ts:227`) — but on the
canvas it renders exactly as *"the server checked this and found nothing"*. The two are
pixel-identical. `degraded` (`:1377`) is threaded to the tray only; nothing on the node path
receives the check state at all.

So during the never-ran window — which now exists on **every** open of a flag-on drafted
canvas, for the debounce plus a round trip — the graph itself reads clean while the strip
below it says *"Not checked yet."* The strip is at least always rendered (the summary button
is outside `open ?`, `ProblemsTray.tsx:184-218`), so a person who looks down can find the
truth. That is a mitigation, not the property.

Not one of round 5's tests asserts anything about node marks under `not-run`: the eight new
canvas-page cases assert on `publish-trigger`, `publish-blocked-reason`, `problems-tray*` and
`mockValidate` call counts, and never on a `PhaseNodeCard` mark.

**Fix:** hand the check state down the same seam `degraded` already travels, and let the card
render the "not yet known" affordance the sketch already has a slot for (the dashed grey ○ is
taken; a dimmed/indeterminate card state or an explicitly absent corner is the design call).
At minimum, pin what is true today so a future reader is not misled by the docblock:

```tsx
it("the canvas does not paint a CLEAN graph over a check that never ran (WR-R5-04)", async () => {
  const answer = deferred<{ ok: boolean; verdicts: never[] }>()
  mockValidate.mockReturnValue(answer.promise)
  renderPublishable(FLAG_ON)
  fireEvent.click(await screen.findByTestId("builder-view-canvas"))
  await screen.findByTestId("problems-tray")
  // The state the graph is IN must be reachable from the graph, not only from the strip.
  expect(screen.getByTestId("workflow-canvas").getAttribute("data-check-state")).toBe("not-run")
})
```

---

#### WR-R5-05: `isCheckOutstanding` — the entire GAP-B predicate — has zero direct tests in the suite that was pinned for GAP B

**File:** `frontend/src/components/workflows/verdictModel.ts:150-152`,
`frontend/src/components/workflows/verdictModel.test.ts:297-394`,
`scripts/vitest-count-gate.cjs:130-134`

**Issue:**

`grep -rn "isCheckOutstanding" frontend/src` returns exactly four hits: one declaration
(`verdictModel.ts:150`) and three call sites (`WorkflowBuilderPage.tsx:190`, `:1130`,
`:1377`). **Zero in any test file.**

The new `verdictModel.test.ts` block (29 cases, newly pinned) is thorough about the
*sentences* — totality over the widened record, distinctness, the word-class fence with both
positive and negative controls — and asserts nothing at all about the *predicate* those
sentences are chosen by. The pin comment describes the file as holding "GAP B's other half";
the half it holds is the vocabulary half.

The predicate is the whole fence. It is what decides that `idle` and `checking` are one state
and that `verdicts`/`degraded` are not, and a one-character edit (`kind === "idle" ||
kind === "degraded"`, say) would silently invert GAP B while every case in the pinned suite
stays green. The only coverage is transitive, through
`WorkflowBuilderPage.canvas.test.tsx` — which is the suite sitting on 106 cases of unpinned
slack (WR-R5-01). The two findings compound: the predicate is untested where it is pinned and
pinned nowhere it is tested.

**Fix:** four cheap direct cases, in the module's own suite, keyed on the loop's union so they
cannot go stale:

```ts
it("isCheckOutstanding is TRUE exactly for the two states with no `ok` field", () => {
  const OUTSTANDING: ValidationState["kind"][] = ["idle", "checking"]
  const ANSWERED: ValidationState["kind"][] = ["verdicts", "degraded"]
  for (const kind of OUTSTANDING) expect(isCheckOutstanding(kind)).toBe(true)
  for (const kind of ANSWERED) expect(isCheckOutstanding(kind)).toBe(false)
  // EXHAUSTIVE — a fifth loop state must be classified here, not defaulted to "answered".
  const EVERY: Record<ValidationState["kind"], true> = {
    idle: true, checking: true, verdicts: true, degraded: true,
  }
  expect([...OUTSTANDING, ...ANSWERED].sort()).toEqual(Object.keys(EVERY).sort())
})

it("a DEGRADED check is answered, not outstanding — the two causes keep their own words", () => {
  // Guards the ordering `blockedReason` depends on: never-ran must not swallow the
  // degraded sentence, which is a different fact with a different sentence.
  expect(isCheckOutstanding("degraded")).toBe(false)
})
```

---

#### WR-R5-06: `isCheckOutstanding` fences only the FIRST answer per mount — `validation` is never reset when `definition` goes null, so a second definition in one mount would inherit the previous one's `ok:true`

**File:** `frontend/src/pages/WorkflowBuilderPage.tsx:763-766`, `:810`, `:1130`,
`frontend/src/hooks/useLiveValidation.ts:206-212`

**Issue:**

Stated honestly as two separate things, because they have different weights.

**The mechanism, confirmed.** `useLiveValidation` returns early when `def === null` and
deliberately does not wipe its state (`:207-210`: *"discarding the server's last word without
a new one would be the client asserting something on its own"*). `beginBeat`
(`:155-160`) can only produce `{kind:"checking"}` from `idle`/`checking`, so once an answer
lands the state is `verdicts`/`degraded` **for the life of the mount**. Therefore
`isCheckOutstanding` is true only before the first answer. Any *subsequent* document swap
inside one mount would be checked against the previous document's verdict for a full debounce
window (500 ms) plus a round trip, with `blockedReason` returning `null` if that verdict was
`ok:true` — the exact fail-open shape GAP B closed, relocated from "on open" to "on replace".

**The reachability, measured and negative.** `builderPhase` returns to `composing` only via
`store.getState().setComposing()`, whose sole call site is `onDraft`
(`WorkflowBuilderPage.tsx:1201`), which is reachable only from the describe screen —
i.e. from `builderPhase` `empty`/`error`, never from `drafted`. And every door transition
remounts the Builder (`WorkflowDoorSwitch` returns a different tree per door), resetting
`validation` to `idle`. **I could not construct a live path to it at HEAD.**

I am recording it as a Warning rather than dropping it because the fence's soundness rests
entirely on a property of a *different* module's UI graph, and nothing states that dependency
where either module can see it. A "start over" / "regenerate" affordance on the drafted view
— a plausible Phase-188 addition — reintroduces the blocker with no test going red.

**Fix:** make the fence depend on the definition it is fencing, rather than on the absence of
a navigation path:

```tsx
// WorkflowBuilderPage.tsx — the answer must belong to the definition on screen
const answeredFor = useRef<BuilderDefinition | null>(null)
useEffect(() => {
  if (validation.kind === "verdicts" || validation.kind === "degraded") {
    answeredFor.current = definition
  }
}, [validation, definition])

// …and in blockedReason, beside the existing outstanding check:
// 187-R5/WR-R5-06 — a verdict about a PREVIOUS definition is not a verdict about this one.
if (isCheckOutstanding(validation.kind) || answeredFor.current !== definition) {
  return DEGRADED_SENTENCE["not-run"]
}
```

Alternatively, document the dependency where it can be checked: a comment on
`isCheckOutstanding` stating *"sound only because `builderPhase` never returns to `composing`
within one mount — see `setComposing`'s single call site"*, plus a test asserting that call
site count is 1.

---

### Info

#### IN-R5-01: Duplicate `import type` statements from the same module, in two files

**File:** `frontend/src/components/workflows/WorkflowCanvas.tsx:216`, `:222`;
`frontend/src/pages/WorkflowBuilderPage.tsx:189-190`
**Issue:** Both files now import from `@/components/workflows/verdictModel` twice — once for
the pre-existing name and once for the round-5 name, separated by an explanatory comment
block. `eslint` does not flag it (no `no-duplicate-imports` rule configured; I ran it). The
split is understandable under the insertion cap and the added-lines-only discipline, but two
import statements from one module is the shape that makes the *next* reader add a third.
**Fix:** merge on the next touch of either file —
`import { DEGRADED_SENTENCE, groupVerdicts, isCheckOutstanding } from "…/verdictModel"` — and
keep the comment above the merged statement.

#### IN-R5-02: The ≤15-insertion cap produced a ~700-character single-line comment and a four-way nested ternary on one line

**File:** `frontend/src/pages/WorkflowBuilderPage.tsx:787`, `:810`, `:1377`
**Issue:** `:787` is one comment line carrying an entire paragraph of D-184-15 narrowing
rationale; `:1377` is
`degraded: isCheckOutstanding(validation.kind) ? "not-run" : storeDegraded === null ? null : storeDegraded.kind === "422" ? "unreadable" : "unreachable",`
— four branches, ~150 characters, no line breaks. Both are consequences of the round cap
(measured 15 ins / 3 del), which is a good trade for this round; they are not a good permanent
shape on a file this size.
**Fix:** re-wrap on the next non-capped touch. The ternary chain in particular wants to be a
small named helper beside `toolbarSaveState` (`trayCauseFor(validation, storeDegraded)`),
which would also give WR-R5-05's tests something to target directly.

#### IN-R5-03: `test_the_needles_can_actually_match` takes a `caplog` fixture it never uses

**File:** `backend/tests/unit/test_187_route_assigned_reach.py:273`
**Issue:** `def test_the_needles_can_actually_match(caplog):` — the body performs only string
containment checks. `caplog` is presumably copied from
`test_every_route_assigned_code_is_classified_without_the_fail_loud_branch` (`:202`), where it
is load-bearing. Harmless, but an unused fixture in a file whose subject is that a guard must
be watched failing reads as a leftover.
**Fix:** drop the parameter.

#### IN-R5-04: "Not checked yet." and "checking…" render side by side

**File:** `frontend/src/components/workflows/ProblemsTray.tsx:203-217`,
`frontend/src/components/workflows/ProblemsTray.test.tsx` ("a check now IN FLIGHT beats…")
**Issue:** With `degraded === "not-run"` and `checking === true`, the strip renders the
degraded sentence *and* the checking beat. Read literally, "Not checked yet." next to
"checking…" is redundant rather than dishonest — nothing false is claimed, and the pinned test
deliberately asserts this composition. `verdictModel.ts:129-131` shows the pairing was
considered. Recorded only so the next copy pass knows the pairing is intentional.
**Fix:** none required. If it is ever reworded, prefer suppressing the sentence while
`checking` (the beat already carries the state) over shortening either string.

#### IN-R5-05: The quiet note lives inside the `<label>` but `aria-label` suppresses it from the accessible name, so it is not programmatically associated with the select

**File:** `frontend/src/components/workflows/DescribeKbPicker.tsx:143`, `:148`, `:160-162`
**Issue:** The `<label>` wraps the select and contains both `DESCRIBE_KB_LABEL` and
`DESCRIBE_KB_NOTE`. `aria-label={DESCRIBE_KB_LABEL}` on the select overrides the implicit
name, which is the right call (the note in the name would be noisy) — but it also means the
note reaches no assistive technology as a description of the control.
**Fix:** `aria-describedby` pointing at the note's id (the component already calls `useId`
nowhere, so one `useId()` is needed), keeping `aria-label` as the name.

#### IN-R5-06: The picker's `catch` conflates a transport failure with a malformed payload

**File:** `frontend/src/components/workflows/DescribeKbPicker.tsx:118-124`
**Issue:** The `try` covers both `await listFolders()` and the `for (const f of folders)`
normalisation loop, so a non-iterable response (a shape change, a proxy returning an
envelope) lands in the same `"unavailable"` state as a network failure. That state is worded
"we could not ask", which is not what happened. Total and non-throwing, which is the important
half; the state name is the imprecise half.
**Fix:** narrow the `try` to the `await`, and normalise outside it with an
`Array.isArray(folders)` guard that falls to `"unavailable"` explicitly, so the two causes
stay distinguishable if a third state is ever wanted.

---

## Notes on scope

- **Verified sound, recorded so it is not re-litigated.** (1) The GAP-B state machine cannot
  re-enter `checking` after an answer — `beginBeat` (`useLiveValidation.ts:155-160`) preserves
  `verdicts`/`degraded`, so the new fence is not a permanent refusal, and the *"an ok:true
  answer RELEASES it"* case is a real property and not a fixture. (2) `summaryLine` has
  exactly one consumer repo-wide (`ProblemsTray.tsx:142`), so GAP B has no second fail-open
  surface for the all-clear *sentence* (the node marks are WR-R5-04, a different affordance).
  (3) `WorkflowCanvas.tsx`'s round-5 delta does not touch the `FlowEdge` module-scope value
  import and moves a type edge onto a *purer* module — the Phase-188 extraction seam is
  slightly better, not worse. (4) The `_ROUTE_ASSIGNED_CODES` inventory really is 3
  (`workflows.py:514-520`), and `test_the_inventory_comment_states_the_real_set_size` compares
  the digit against `len()` rather than pinning a literal, which is the right shape. (5) The
  door's "three sites never co-render" claim (`DescribeKbPicker.tsx:21-27`) holds: describe
  door, Builder describe screen and drafted header are mutually exclusive branches. (6) XSS:
  every new string in `DescribeKbPicker` is a text child or an attribute value; no
  `dangerouslySetInnerHTML` anywhere in the round-5 diff, and the picker's suite fences it.
- **Measured, so it is not inherited.** Backend: `16 passed` over the two backend suites.
  Frontend: count gate green, `total 2168 · failed 0`, all 21 pins present, no per-file
  decrease. `tsc --noEmit -p tsconfig.app.json` → 33 errors, byte-matching the D-ITEM-01
  baseline, none in the touched tree. `eslint` over the six changed production files → 2
  pre-existing `react-refresh` errors, no new ones.
- **Not attributed to round 5, and not re-measured:** the `PublishGauntlet.test.tsx` and
  `WorkflowBuilderPage.canvas.test.tsx` parallel-load flakes (`D-ITEM-187-20-01`,
  `D-ITEM-187-25-01`). My gate sample was `failed 0`, consistent with 187-29's five samples.
  The ledger's standing recommendation — fix it rather than prove non-attribution a fifth
  time — is sound and I second it.
- **Out of v1 scope, so not reported as findings:** `DescribeKbPicker` refetches on every
  describe-door entry (no cache); adding `validation` to the `canvasSession` memo's deps
  recomputes it on every beat. Neither is a correctness issue.
- **Not re-litigated:** round 4 (plans 187-22 … 187-25) is outside this diff base, and its
  review is not in this file. The carried-forward tally is a mechanical upper bound with the
  two exceptions named above.

---

_Reviewed: 2026-08-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard · Round 5 (gap closure) · diff base `15339441`_

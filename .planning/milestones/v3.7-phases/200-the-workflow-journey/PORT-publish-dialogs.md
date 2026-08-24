# Port report — publish · run dialog · fork + delete (sketch 200)

Ported directly from the sheets' markup and CSS. `200-CHECKLIST.md` and `index.html`'s
`JOURNEY` array were NOT opened.

Commits: `0827e21b` (run dialog) · `232f06fd` (fork + delete) · `ccf6512f` (publish).

---

## 1. Publish — `screens/publish.html` → `PublishGauntlet.tsx`

**Ported.** The soul block becomes the sheet's three things instead of five stacked lines:
a 17px hero, the quiet needs line, then ONE compact bordered bar carrying the step glyphs
on the left with the tier chip and the deliverable pushed right. That regrouping lives in
`WorkflowSoul.tsx` gated on `scale === "pub"` — `card` and `run` render byte-for-byte what
they rendered, which is load-bearing because `WorkflowDoorSwitch.baseline.test.tsx` pins
the `card` scale's whole DOM (it passes untouched). The card *around* the soul is gone: a
card inside a card, costing 32px of a 640px body.

The strip becomes round 32px beads on one hairline with a ✓ tucked at each lower right,
under uppercase wide-tracked captions. The form takes the sheet's sentences verbatim
(`Publishing runs the full check above…It can honestly refuse.`, `A typical instruction to
test with`, `Publish — run the checks`), and the sheet's footer bar arrives with a Cancel
the form never had.

**Behind a hover / ⓘ.** `golden_input` — the wire field name — is demoted to a quiet mono
token inside the same `<label>`, carrying the full sentence in its `title`. It is the name
on `POST /workflows/{id}/publish`, so an author reading backend logs needs to connect the
two. It also keeps `getByLabelText(/golden_input/i)` resolving in two suites outside this
file. `blocked_stage` and `golden_run_id` keep rendering verbatim inside the raw-verdict
disclosure, unchanged.

**⚠ The pip strip's glyphs — the known sketch defect, reported as instructed.** The brief
says the sheet draws the strip in emoji. Measured, it does not: it names nine **Material
Symbols** ligatures (`person`, `fact_check`, `flag`, `account_tree`, `pause`, `anchor`,
`emoji_events`, `format_quote`, `gavel`). The verdict is the same either way and the port
is the same — **the strip's structure and rhythm are ported; its icon family is refused**,
because this product's stage glyphs are the bundled 3D fluent-emoji set fixed by
`icon-convention.md` §3 and a second icon family on one surface is the drift that
convention forbids by name.

**⚠ The sheet draws NINE stages; the server runs TEN.** `Commit` (`draft_changed`) is real
and refuses on a draft that moved mid-publish. Ported at ten. Dropping it to match a
drawing would hide a refusal an author can actually hit.

**⚠ The sheet's single connecting rule is drawn, but the nine SEGMENTS are kept.** The
sheet's rule is one absolutely-positioned element because it has no state; ours carries the
reached / not-reached fact per segment — the second, independent read of the block index
that the F7 fail-closed repair exists to keep honest. They are drawn AS the sheet's
hairline and keep their meaning.

**Not on the wire.** Nothing in the publish sheet needed a value we do not hold. The hero
is `business_requirement`; the quiet line is the declared entry keys; the tier chip and
`Produces:` are both derived by `soulData`. All render their shipped honest empty states.

**BUG-260815-06 — fixed here.** `structural_gate` fell through to `BLOCKED_FALLBACK_SENTENCE`,
and the copy beside it read *"Fix the deliverable and re-publish"* — on the one path where
the run **never reached the review** and no deliverable was produced. It now has its own
entry in `BLOCKED_SENTENCE` and its own third arm in the block sub-line, saying which SIDE
stopped and stating outright that the deliverable was not graded. `HardWall`'s sentence
loses "the deliverable" for the same reason: it renders on EVERY block, not only the
grader's.

⚠ **It deliberately names no step.** The report's requirements 1 and 2 (name the failing
phase, use the canvas label) need a join between the publish response and `workflow_phases`
/ `harness_audit` that does not exist on the wire — a server change. A client that invented
a step here would be worse than one that says which side stopped. A test fences the
absence: no snake_case token, no phase number, no "coming soon".

**Pins moved (2), both with the previous literal kept beside the new one:**

| Pin | Was | Now | Why |
|---|---|---|---|
| resting-inventory literals | `golden_input — a representative kickoff prompt` · `/Publishing runs the full gauntlet above/` · `/It can honestly block\./` · `Publish ▸ run the gauntlet` | the sheet's three sentences | three machine words leave; the claim is identical |
| spine node count | `[class*="rounded-xl"]` × 10 | `[data-testid="spine-node"]` × 10 | **a strengthening.** The old comment argued the shape class was unique in the spine; round nodes invert that argument *silently* (`rounded-full` is worn by node, badge and — before this port — connectors, so the count would have read 29). It now counts the thing, not its paint. |

Plus one needle each in `WorkflowsPage.test.tsx` and the recoverable-arm case, both
annotated in place.

**⚠ THE FENCE STILL FIRES — DRIVEN, NOT ASSERTED.** The port ADDS a button to this dialog,
and the role-SET scan is the only guard in this tree ever measured able to catch a planted
override. Planted a live `<a href="/publish?force=1">Proceed to publish anyway</a>` inside
`HardWall`: **RED on two cases**, the shipped one and the new one. Reverted; `git diff
--numstat` back to the port's own figures. Both shipped "no override" guards are intact and
the struck-through `no override · publish anyway` still renders as text (which a weakened
fence would have forced someone to delete to go green).

---

## 2. Run dialog — `screens/run-dialog.html` → `library/RunModal.tsx`

**Ported.** Header: a truncating 17px title plus the ✕ the sheet draws — the dialog had NO
visible dismiss at all, which is nothing on touch. Body: the sheet's `p-lg` / `gap-lg`
rhythm with `gap-xs` label/control pairs. The KB `<select>` becomes a full-width `h-10`
control with its own chevron (`appearance-none` + a pointer-events-none glyph; still a
native select, so role, keyboard and options are untouched). The destination sentence
**moves out of the footer** into the sheet's ⓘ info group beside the input-keys hint —
which is why the footer used to read as two unrelated things sharing a row. Footer: a
raised, right-aligned bar of two `h-10` controls. `Knowledge base` loses its colon.

**Behind a hover / ⓘ.** Both of the dialog's statements-about-the-run are now ⓘ lines in
one group rather than one inline and one stranded in the footer. Nothing was hidden.

**⚠ NOT ON THE WIRE — the sheet's first info line is REFUSED.** It reads *"This workflow
needs a starting instruction."* That is a humanised reading of the declared entry keys, and
there is **no authored per-key label anywhere on the wire** — `entryInputKeys` returns raw
JSONB key strings. Rendering that sentence would mean inventing the label for every key that
is not `kickoff_prompt`. The keys render as the facts they are: `This workflow expects:
kickoff_prompt`. **No time estimate reaches this dialog** — the sheet draws none, and none
was added.

Also refused: the sheet drops the ▶ from the run button. Kept — it is the run VERB's mark,
not the category glyph `199-10` removed from this same header.

**Pins moved:** the six whole-`innerHTML` captures re-taken (the second legitimate
re-capture in that file's life, recorded beside `193-07`'s with method and scope), the
resting-TEXT pin by **exactly one character** (the colon), and two a11y focus-cycle pins
whose FIRST moves from the scope select to the new ✕. `RUN_DESTINATION_BASELINE` is
**untouched in both gate arms**, and a new case asserts it still appears verbatim inside the
new capture — the mechanical proof the sentence moved house and was not re-worded. The a11y
pins additionally assert the select is still second, so they stay claims about ORDER rather
than weaker claims about membership.

---

## 3. Fork + delete — `screens/fork-delete.html` → `ForkNameDialog.tsx` + `WorkflowDeleteSheet.tsx`

**Ported (fork, the light end).** 480px card; the consequence sentence moves into the
sheet's raised box (it was a bordered-top paragraph reading as a footnote rather than as the
promise being made); a clashing name tints the FIELD amber as well as the hint; the free
hint drops its emerald for the sheet's muted tone; both actions take `h-10`.

**Ported (delete, the heavy end).** Loading gains a spinner and the sheet's *"Checking what
this will remove…"*. The two group captions become quiet uppercase mono; the victim moves
into a raised box with its name on its own line and the counts beneath; the Kept group takes
the sheet's transparent box; the receipt goes right-aligned and italic.

**⚠ THE SAFETY LADDER IS INTACT, AND IS NOW CHECKED AGAINST THE SHEET ITSELF.** §3 of the
sheet publishes the four rules as a table; a new case drives it as one — four rules × two
dialogs, in the sheet's own order and words:

| Rule | Making a copy | Deleting |
|---|---|---|
| Names what it affects | no ✓ | yes ✓ |
| States exact numbers first | no ✓ | yes ✓ |
| Spends danger colour | no ✓ | yes, on the button only ✓ |
| Leaves a receipt | no ✓ | yes ✓ |

`gradeOf` still reads **4 vs 0** and the strict ordering still holds. The victim-naming
sheet, the exact server counts fetched BEFORE the button exists, the amber cancel-first
banner (byte-identical), the no-optimistic-vanish/no-undo lifecycle and the audit receipt
are all untouched.

**⚠ The one delta most easily misread as a de-grading is the opposite.** `Permanently
removed` loses `text-destructive`, because §3 row 3 says *"yes, ON THE BUTTON ONLY"*. Red on
a caption made the one irreversible control compete with a label for the strongest signal
the surface has. `Delete forever` keeps `bg-destructive`, and the new case **counts** the
resting `bg-|text-destructive` occurrences in the loaded state (expects exactly 1, with a
positive control that finds 2) and asserts the one it finds is on the control.

**Not dropped though the sheet drops it:** the ✎ on the receipt line. It is the shipped
146-148 audit mark and the same glyph the Control Room's ledger spends; forking that
vocabulary for one dialog costs more than the sheet's tidiness gains.

**Not on the wire / refused:** the sheet's *"1 version • 17 run records"* is its fixture
data, not a claim about wording — the counts are **not** pluralised (three suites pin
`\d+ versions`). The fork's emerald→muted change is a deliberate subtraction: `199-10` had
already refused an earlier sheet's green-tick "Name available" because colour was carrying
the meaning, and the 199-10 case that proves the three states differ with **every** class
attribute stripped passes untouched — which is what makes removing the paint safe rather
than merely tidy.

**Pins moved:** the seven whole-`innerHTML` captures re-taken (the reason the baseline
docblock itself already names — *"a deliberate, reviewed redesign of the Sheet"*), with what
moved and what did NOT recorded above the strings; and the loading literal, with its
previous value kept beside it.

---

## Verification

- `npx tsc -p tsconfig.app.json --noEmit` — **zero errors in any file touched here.** 19
  other files carry the pre-existing errors; left alone.
- `GSD_VITEST_MAX_WORKERS=2 npx vitest run src/components/workflows/ src/pages/` — **70/70
  files, 4024 + 678 cases, 0 failing.** No red run needed triage; the cap was never adjusted.
- `library/WorkflowCard.test.tsx` (SEED-171) was green on the first run of every invocation.
  Recorded as an observation — one green sample is not proof of innocence.

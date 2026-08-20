# WIRE — library · publish · run-dialog · doors · draft-arrival

**Scope:** the `FE-WIRING` rows on `library.html` (2), `publish.html` (2), `run-dialog.html` (1),
plus the `draft-arrival.html` rows (2), the doors rows (2) and the two named misses.
**No backend work. No new concepts.** Base `060ab74d`.

⚠ **Every row I was given is enumerated below as `DONE` / `BLOCKED` / `NOT TAKEN`.** A prior port
of this same surface reported COMPLETE while silently omitting a whole drawn section — the
starter shelf, which is row **(a)** here. The point of this list is that an omission has to
appear as a line, not as a gap.

---

## The tally

| | rows |
|---|---|
| **DONE** | **7** |
| **BLOCKED** | **0** |
| **NOT TAKEN** | **2** |
| total | 9 |

---

## `library.html` — 2 FE-WIRING rows

### L-1 · Card — `build` glyph leading the draft status line — **DONE**

`WorkflowCard.tsx`. The leading-mark switch on `row-answer` had exactly three arms, **all keyed
on `gutter`** (the RUN axis), so a draft fell through to the dot — or, on an `unknown` gutter, to
nothing at all. `face.mark` was already on that same line and nothing consumed it for a mark.

**A fourth arm, keyed on `face.mark === "building"`**, rendering `Wrench`.

- ⚠ **`Wrench` is the house's `build`.** The sheet draws Material Symbols' `build`; the icon
  convention forbids that path. `lucide-react` is the chrome set this file is already made of,
  and a library row's PROVENANCE is neither a provider nor a phase type, so neither single-source
  map applies (this is `MARK_ICON`'s own recorded reasoning, reused rather than re-derived).
  Before this, `grep -n "Wrench\|Hammer\|Construction"` over the file returned **0**.
- ⚠ **It sits AFTER the `not-by-you` arm on purpose.** Ownership is a fact about who ran it and
  outranks lifecycle on a line whose first word is the run truth. Ordering it this way means **no
  shipped arm changes behaviour for any row that reached it before** — only rows that previously
  got a dot-or-nothing are affected.
- ⚠ **The card now carries TWO marks for a draft** (`row-mark` on the name row, this one on line
  2) and that is recorded in the source rather than left to be discovered. It is the card's
  existing two-question split — line 1 *what kind of row is this*, line 2 *does this one work*.
  The sheet can spend one glyph because it draws no name-row mark at all; removing ours would
  change all three provenances and is not this row's scope.

### L-2 · Card — draft card dimmed (`opacity-80`) — **DONE**

`WorkflowCard.tsx` root. `grep -c "opacity-"` returned **2** before this, both on delete-confirm
buttons, none on the root.

⚠ **Keyed on `runnable`, NOT on `provenance`.** `face.runnable` is `cardFace`'s single derivation
of *can this be launched*, so the card's weight can never disagree with the Run control's own
enabled state. A second `provenance === "draft"` test would have been a second derivation of one
fact. The neighbouring dashed-border test IS left alone deliberately rather than joined to this
one — that test is about lifecycle SHAPE, this one about ACTIONABILITY.

⚠ It is the root's opacity, so it dims the gutter too, which is correct: a draft's gutter is the
`unknown` tone and a full-strength ruler tick beside dimmed content would read as a run outcome
the row does not have.

---

## `publish.html` — 2 FE-WIRING rows

### P-1 · Quiet line `Needs a starting instruction.` — **DONE** (with a named, narrower gap)

This is the same read-shape defect as named miss **(b)** — see it for the full account.
`WorkflowSoul`'s `soul-needs` line now renders the **authored label** where a definition carries
one, and the raw key where it does not.

⚠ **Two arms, and the TREATMENT is part of the claim.** An authored label is prose a human wrote →
body face. A raw key is an identifier → the mono face it has always had. Collapsing them into one
treatment would make a key look like a sentence somebody chose. There is no third arm.

⚠ **The sheet's exact sentence is still not rendered**, and that is not an oversight: *"Needs a
starting instruction"* is a humanised reading of ONE specific key. The honest general form is the
label the author actually wrote.

### P-2 · `SEARCH` / `REASON` / `EMIT` uppercase type WORDS — **DONE** (the sheet's words DECLINED, in writing)

`PhaseSpine.tsx` rendered `p.name` alone. `grep -n "phaseVocabulary" PhaseSpine.tsx` → **0**: the
shipped type vocabulary was one import away and unused, and a phase with no authored name and no
slug got a bare glyph with nothing legible beside it.

The spine now falls through the **187 node-face ladder** to its honest floor —
`PHASE_TYPE_SENTENCES[type]` — so an unnamed step says what KIND of step it is.

⚠ **THE SHEET'S OWN WORDS ARE NOT PORTED, AND THE REASON IS THAT THEY DO NOT EXIST.** Neither
shipped map yields `SEARCH` / `REASON` / `EMIT`: `PHASE_TYPE_SENTENCES` gives *"Work out how to do
it"*, and `PHASE_TYPE_LABELS` gives *"AI agent step"* **and is reserved by its own docblock for
the ⌥ Technical-names reveal** (*"NOT the default node face"*). Inventing a third type vocabulary
to match three drawn words would be a new concept, not wiring. Recorded at the code site so the
next reader finds the decision rather than the gap.

---

## `run-dialog.html` — 1 FE-WIRING row

### R-1 · Info line 1 — `This workflow needs a starting instruction.` — **DONE** (this IS named miss (b))

See **(b)** below. `RunModal.tsx`'s hint line renders the authored label where one exists; the
**unlabelled arm is character-identical to what shipped**, which is what keeps that file's six
whole-`innerHTML` captures green without re-capturing any of them (verified: all pass unedited).

---

## `draft-arrival.html` — 2 FE-WIRING rows

### DA-1 · "What I decided for you" heading — **DONE**

`grep -rn "What I decided" frontend/src` → **1 hit, inside a comment**. The heading existed
nowhere.

⚠ **The slot existed and was spending the WRONG STRING.** The opened decisions fold already
rendered an `<h3>` in exactly the right register, carrying `decisionsFoldSummary` — which is what
the fold's **TRIGGER** renders nine lines above it. So an opened fold **printed its own count
twice and never once said what the list was**. The comment on that `<h3>` even read *"the sheet's
own heading over the list"*, describing the intended thing while the slot did another.

New governed id `DECISIONS_HEADING` in `decisionsVocabulary.ts` (the one home), imported. It names
no consequence — the same rule-2 constraint `APPLIED_HEADING` records. The summary is not lost: it
is on the trigger you pressed to get there.

### DA-2 · Row body "You cannot publish until this is settled." — **NOT TAKEN**

**Reason: it already ships for the only row entitled to it, and extending it is `BE-NEEDED`.**

The publish-gate verdict is on the wire for **one row only** — `GenerateReadiness.business_requirement`
`{status:"missing"; message}` — and it is already rendered **verbatim** at `DecisionsList.tsx:316-323`
(`decision-verdict-requirement`), gated at `:251-254`. Verified in place, unchanged.

⚠ The audit's own note is binding here: `decisionsVocabulary.ts` records that **only row 3 may
claim a publish requirement**; the other four would be claiming a gate nothing enforces. Putting
the sheet's sentence on them needs wire fields that do not exist — which is `BE-NEEDED`, and rule
2 says stop and report rather than author it.

---

## The doors screen — 2 rows

### D-1 · The starter-templates shelf — **DONE** ⚠ *this is named miss (a)*

`doors.html:307-319` draws a labelled section — *"Start from something that already works"* over
`Invoice audit · 4 steps · Use this` — and **the loose describe door rendered nothing of it**. It
was not among the port's seven recorded refusals; it was simply absent.

⚠ **HOW THE OMISSION SURVIVED REVIEW, because this is the reusable part.** The sheet's section is
literally commented `<!-- Template Row -->`, and the port mapped it onto the **shipped
attach-a-document row** (`DescribeTemplateRow`) — a different capability, which the sheet does not
draw at all. One sheet section was mapped onto a different shipped one, so **the section count came
out right and the surface came out short**. The port's own comment still says sketch 200 draws
*"the template question as the LAST section of the column"*; that sentence is about this shelf, not
about the attach row. Both now render; the attach row keeps its shipped position and the shelf
arrives after it, behind a hairline.

⚠ **PURE WIRING, zero new components.** `GET /workflows/starters` ships
(`backend/app/api/workflows.py:49`), its client is `listStarterWorkflows`, the library already
renders a `Starters` filter chip over the same rows, and **`StarterTemplatePicker` was already
mounted on the GOVERN door**. The loose door — the fast path most authors actually land on — had
**zero** mounts. The cheapest available proof that this is a mount and not a new component: the
inserted fragment already appeared, byte for byte, inside the untouched `GOVERN_INLINE` capture in
the same test file.

⚠ **NOT gated on `canvasEnabled`,** unlike the Builder's mount. That gate belongs to the Builder's
own screen for a flag-era reason; this door is the fast path and a starter shelf is not a canvas
feature. The picker holds no flag of its own (187-05 put the gate on the mount deliberately), so
the choice is made at the mount, in the open.

⚠ **The Builder's own mount was NOT ungated.** Doing so would have reddened
`FLAG_OFF_DESCRIBE_MARKUP` and the `/template|starter/i` word guard, which are scoped to the CTA
group; that gate is not this row's scope and was left exactly as it shipped.

⚠ **It seeds the box and forks nothing.** `onChoose` hands back the starter's own
`business_requirement`; writing it into `describe` keeps the single forward path the picker's
docblock guards. `canDraft` is untouched.

**Two pins re-baselined, both with the reason written INSIDE the pin and the original kept verbatim:**

| pin | change | why it is not hiding a regression |
|---|---|---|
| `WorkflowDoorSwitch.baseline.test.tsx` → `DESCRIBE_STANDALONE` + `DESCRIBE_INLINE` | **one** fragment spliced between `</section>` and `<div data-testid="switch-strip"` — a hairline plus the trigger's resting line. **Nothing else moved by a byte**; `CHOOSER_*` and `GOVERN_*` untouched | the captures pinned a surface that was short one whole drawn section and could never have said so |
| `WorkflowDoorSwitch.test.tsx` → the resting CONTROL set | 5 → **6** (`+ starter-door-trigger`); original list kept verbatim above it | the property that count guarded is about `describe-kb-upload`, and **that assertion is byte-untouched and still passing** — six is five plus one named, sourced control, not five plus drift |

⚠ The baseline docblock's *"a SIXTH re-capture needs its own authorisation"* is answered on its own
terms rather than ignored: the re-capture is scoped in writing to this omission, and it records
that `<WorkflowSoul scale="card" />` appears **verbatim** inside both rows — which is EVIDENCE
about P-1's widening (a draft preview carries no `inputs[]`, so it renders `kickoff_prompt` in the
identical mono treatment), not an exemption from it. A seventh re-capture still needs its own
authorisation.

### D-2 · KB picker empty arm — the `+ Upload documents` way out — **NOT TAKEN**

**Reason: there is no destination to supply. The app has no navigation seam reachable from this component.**

This looked like the textbook wiring row — `DescribeKbPicker.tsx:112-114` ships
`DESCRIBE_KB_UPLOAD = "+ Upload documents"` and renders it **only when a caller supplies
`onUploadDocuments`** (`:301-306`), and no caller does. Measured before deciding:

- `grep -rn "NavigationProvider\|useNavigation\|navigateTo" frontend/src` → **0**. There is no
  navigation context (consistent with `SEED-185`: the app has no url router).
- `ChatLayout.tsx:704` mounts `<WorkflowsPage folders={folders} onLaunch={doRun} />` — **two
  props, neither of them `onNavigate`**. `grep -n "onNavigate"` over `WorkflowsPage.tsx`,
  `WorkflowBuilderPage.tsx` and `WorkflowDoorSwitch.tsx` → **0**.

So supplying a destination means threading a NEW prop through four files — `ChatLayout` →
`WorkflowsPage` → `WorkflowBuilderPage` → `WorkflowDoorSwitch` — two of which are hot files and
one of which (`ChatLayout`) is outside this worklist entirely. **That is plumbing a new seam, not
supplying an existing one**, so it is out of the FE-WIRING boundary and reported instead of faked.
It is recorded at the assertion site too (`WorkflowDoorSwitch.test.tsx`), so the next reader finds
the measurement rather than an unexplained absence.

**What it needs to become takeable:** any navigation seam that reaches the workflow surfaces — a
`onNavigate` prop threaded from `ChatLayout`, or a navigation context. One phase, one decision.

---

## Named miss (b) · a shipped refusal built on a FALSE premise — **DONE**

`RunModal.tsx` declined the sheet's wording on the grounds that *"There is no authored per-key
label anywhere on the wire"*.

⚠ **That is measurably wrong.** `InputFieldSpec.label` is a **REQUIRED `str`** on the backend model
(`backend/app/models/harness.py:504`) and it travels to the client inside `WorkflowDefinition.inputs`
(`:532`). **What was actually true is narrower and lived one file away:** the FRONTEND READ-SHAPE
threw the label away — `soulData.ts:72` declared `inputs?: Array<{ key?: string }>`, with no
`label` member — so `entryInputKeys` never had one to return, and the refusal **generalised a
frontend omission into a claim about the wire**.

**The fix, in three parts:**

1. **The read-shape is widened** — `inputs?: Array<{ key?: string; label?: string | null }>`.
2. **A new resolver `entryInputFields`** returns `{ key, label? }`, and **`entryInputKeys` is now
   DERIVED from it** (`.map(f => f.key)`) rather than re-implemented — one home for the precedence
   rule, so a change to it cannot land on one surface and miss the other. Behaviour of
   `entryInputKeys` is byte-identical to before (asserted by its own suite, unedited).
   ⚠ An **empty or whitespace-only** label is treated as an ABSENCE, not as a value to print.
3. **The refusal comment is rewritten**, with **the original kept verbatim in a quoted block above
   it** — a refusal that turns out to be wrong is evidence about how the surface was reasoned
   about, and deleting it would erase the only record that the gap was ever mis-stated.

⚠ **THE REAL, NARROWER GAP, now stated where the wrong one used to be:** a definition that declares
only the bare `PhaseSpecJSON.input_keys` (`harness.py:73` — a plain `list[str]`) with no `inputs[]`
carries **no label anywhere**, on the wire or off it. **That subset stays unlabelled and is out of
scope** — the key is the only true thing there is to print for it.

**Two consumers wired:** `WorkflowSoul` (P-1) and `RunModal` (R-1).

---

## Verification

| | result |
|---|---|
| `tsc -p tsconfig.app.json --noEmit` | **33 errors — the pre-existing count, across 19 other files. ZERO in any file I touched** (grepped by filename, empty) |
| doors + soul + spine + starter (6 files) | **202 / 202** |
| arrival + decisions vocabulary + decisions list (3 files) | **151 / 151** |
| card + RunModal captures + WorkflowsPage + gutter fences + cardFace (5 files) | **280 / 280** |
| whole `library/` subtree + phaseVocabulary + definitionOps (14 files) | **1048 / 1048** |
| Builder describe / canvas / session + PublishGauntlet (4 files) | **275 / 275** |
| `WorkflowRunPage` + `DescribeKbPicker` (2 files) | **179 / 179** |

⚠ **The three red assertions I saw were the three I intended, and they were captured before
anything was re-run**: the two `DESCRIBE_*` byte captures and the 5-control set. Both of
SEED-171's named flaky suites in my blast radius (`WorkflowsPage.test.tsx`,
`library/WorkflowCard.test.tsx`) were **green on the first run of every invocation**. The worker
cap was `2` throughout and was never adjusted.

⚠ Recorded rather than claimed as proof: `WorkflowCard.test.tsx` passed **unedited** across L-1 and
L-2, which means no shipped card assertion covered either the root's weight or the fourth
leading-mark arm. One green sample of a flaky suite is not proof of innocence; what IS provable is
that the file is byte-unchanged on the test side.

## Backend gaps hit

**One, and it is not new:** extending the *"You cannot publish until this is settled"* verdict past
row 3 needs `GenerateReadiness` fields the wire does not carry (DA-2). Nothing else in this
worklist needed a byte the backend does not already send — **including named miss (b), whose whole
premise was that the backend was the problem, and it was not.**

## Files touched

```
frontend/src/components/workflows/soulData.ts                        +58 −6
frontend/src/components/workflows/WorkflowSoul.tsx                   +21 −6
frontend/src/components/workflows/PhaseSpine.tsx                     +17 −1
frontend/src/components/workflows/library/RunModal.tsx               +65 −11
frontend/src/components/workflows/library/WorkflowCard.tsx           +45 −1
frontend/src/components/workflows/WorkflowDoorSwitch.tsx             +42 −0
frontend/src/components/workflows/decisionsVocabulary.ts             +16 −0
frontend/src/components/workflows/DraftArrivalCard.tsx               +13 −2
frontend/src/components/workflows/WorkflowDoorSwitch.baseline.test.tsx  +28 −2   (re-baseline + its reason)
frontend/src/components/workflows/WorkflowDoorSwitch.test.tsx          +28 −1   (re-baseline + its reason)
```

⚠ **Not touched, per the brief:** `CLAUDE.md`, `docs/HOT-FILE-LEDGER.md`,
`scripts/vitest-count-gate.cjs`, `WorkflowRunPage.tsx`, the panel, and the four builder files
(`PhaseSpineGraph`, `WorkflowCanvas`, `PhaseNodeCard`, `PhaseFormPanel`). `WorkflowBuilderPage.tsx`
was **read** for row (a) and deliberately **left unedited** — the mount that was missing is on the
door switch, and its describe screen already had one.

⚠ **Ledger obligation owed, not taken:** `WorkflowCard.tsx`, `RunModal.tsx`,
`WorkflowDoorSwitch.tsx`, `soulData.ts` and `DecisionsList`'s neighbourhood all carry hot-file rows
whose triples this commit makes stale. The brief forbids editing the ledger (sibling collision), so
the re-derive is **owed to whoever batches it**, named here rather than left silent.

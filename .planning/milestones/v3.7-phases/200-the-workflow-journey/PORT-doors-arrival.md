# PORT — the two doors + the draft arrival (sketch 200)

Ported directly from the two sheets' markup and CSS. `200-CHECKLIST.md` and the `JOURNEY`
array in `index.html` were **not consulted**.

Three commits, on `worktree-agent-ab7e5dd9329f4561e` off `b91485d8`:

| | commit | what |
|---|---|---|
| 1 | `fe335cdb` | the knowledge picker's three arms |
| 2 | `016c13c0` | the chooser + the describe screen |
| 3 | `9a5b670c` | the draft-arrival card |

---

## Screen 1 — `doors.html`

### The chooser

- The bordered header band is gone. A **32px heading and a 16px sub-line** sit in the flow of
  a centred `max-w-[720px]` column, as drawn.
- The door card becomes the sheet's shape: a **header ROW** (glyph and name on one baseline, a
  chip pushed to the far edge) over a description paragraph, with the sheet's **2px hover
  lift**. The shipped card stacked five atoms vertically, which is why it read as a list.
- **The chip slot holds the TIER.** The sheet draws `CHOSEN` there — a state the chooser does
  not have, since you are in neither door while looking at both. A card marked CHOSEN at rest
  would claim a selection nobody made.

### The describe screen

- The `lg:grid-cols-[1fr_320px]` split is gone; one column, with **hairlines between the box,
  the knowledge question and the template question**, exactly as the sheet separates them.
- The heading is now the box's **`label`**, bound to it, left-aligned, at the sheet's mono
  14px — not a centred h1 under a decorative glyph.
- Textarea takes the sheet's metrics: `resize-y`, the DEFAULT 2px radius, `p-4`, 14px/1.5,
  `focus:ring-0` (the sheet draws the focused **border** with no second ring).
- **The refusal is a BLOCK** — the sheet's whole finding for this surface: a left-accent panel
  with a glyph and a body-size sentence, where it was a 12.5px caption.
- **The disabled CTA carries its own reason** (`DESCRIBE_CTA_REFUSED` = *"Too thin to draft"*,
  the 24th governed id) instead of being a greyed-out mystery, and is right-aligned.

**No rule moved.** `canDraft` and `disabled={!canDraft}` are byte-unchanged;
`refusingDescribe` is still `canDraft`'s first term read back and is never consulted by it.

### The knowledge picker — three arms, and an honest fourth

| arm | drawn? | what renders |
|---|---|---|
| nothing chosen | sheet | the dashed `+ Choose what it can read`; the shipped `<select>` is **disclosed** by pressing it, under the **same test id** |
| one chosen | sheet | the row: glyph, name, remove control |
| no folders at all | sheet | *"You have no folders yet"* |
| could not ask | **authored** | *"Your folders could not be loaded just now"* |

The fourth arm is authored rather than ported because the sheet draws no arm for it and it
**may not borrow arm 3's words** — a failed read knows nothing about how many folders exist.
Both directions are asserted so neither sentence can drift into the other. A boolean could not
have carried this; the component's four-state machine already existed and had no surface.

---

## Screen 2 — `draft-arrival.html`

- **A 4px accent rule** down the left edge with the body pulled in behind it (`p-6 pl-8`).
- A header row carrying the **"Just drafted" chip** and the dismiss control.
- The **workflow's NAME as the title**, live off the definition.
- The **source line**: the author's own request quoted behind a 2px rule.
- A **top-ruled, tinted footer strip** holding the card's controls.
- The sheet's other two blocks (`What I decided for you`, `What I applied`) become **regions
  inside the one card**, not siblings — the page's graph column is a three-row grid with a
  last-child row placement, so a fourth child strands the graph at 0px (sketch 172 measured
  it). Both gain the sheet's bordered frame and heading register.

`SeedReceipt.tsx`, `DecisionsList.tsx` and `useTemplateFirstDraft.ts` are at exactly
**`0` insertions / `0` deletions** against the base. D-02's zero-diff criterion on the receipt
is preserved; the card composes it unmodified.

`useTemplateFirstDraft.ts` was listed as a target but the arrival sheet touches nothing it
owns — it is the **pre-draft** read hook, and the only template fact on this sheet is the
`Fills in` pair, which comes from `decisions.templateFilename`. Left alone deliberately.

---

## Behind a hover / disclosure rather than removed

The sheets are tighter than the shipped surfaces; nothing was dropped to reach them.

| what | where it went | why |
|---|---|---|
| `DOOR_A_NOTE` / `DOOR_B_NOTE`, and `Open ›` | door card footer, `opacity-0` → revealed on **hover AND focus** | the sheet's card body is two elements; the notes are governed ids carrying what each door costs you, and this is their only render site |
| the describe hint (`HINT_FRAG1..3`) | kept, demoted to a quiet left-aligned line | the sheet draws no hint, but three governed ids say what the AI will do to your paragraph |
| the soul preview + `SOUL_LABEL` | moved from a 320px sidebar to the **last section of the column** | the sheet's describe page is one column with no aside; `<WorkflowSoul scale="card" />` itself is byte-unchanged |
| the arrival card's requirement echo | **clamped**, with `See what I asked for` to unclamp | a requirement can be a page long; the card's measured property is that it arrives ~4 lines tall |

Every hover reveal is **also revealed on focus**. The sheets carry no opinion about the
keyboard because a sheet has no keyboard; a pointer-only control is unreachable without one.

---

## ⚠ What the sheets draw that is NOT on the wire

**Rendered as nothing. Not approximated, not defaulted.**

1. **`1,284 documents` on the chosen knowledge base.** `Folder` carries `id`, `user_id`,
   `name`, `parent_id`, `is_org_shared`, `created_at`, `updated_at` — **and no count** — and
   `listFolders` asks for nothing else. There is no number to show. *(The 199-08 case that
   pins this refusal is left exactly as written; it is the one refusal the sketch cannot
   overrule, because no ruling makes a number exist on a wire that does not send it.)*
2. **`Model: GPT-4o` in the applied block.** A workflow declares a model **per step**. The
   pair renders only when the set of DECLARED models has size exactly one. Two disagreeing
   steps → nothing. Steps that declared nothing → nothing, because *"nothing declared"* is not
   agreement; it means the run's model will be used. Three cases drive all three arms.
3. **`+ Upload documents`** on the picker's empty arm. The app has **no url router**
   (`SEED-185`), so this component cannot navigate. It is a prop (`onUploadDocuments`), absent
   by default; the sentence stands alone without it. **No mount supplies one today**, so the
   control does not currently render anywhere — the seam exists, the capability does not.
4. **`Publish…`**, the arrival card's primary footer action. Three independent grounds: there
   is no handler and its caller passes none; **its only possible word is banned from this
   surface's vocabulary** by D-20's gate-claim fence (nothing in the gauntlet refuses on four
   of this card's five subjects); and its owner is `PublishGauntlet.tsx`, **under concurrent
   edit by a sibling agent**. The strip's right slot renders nothing; dismiss already sits in
   the header where the sheet puts it.
5. **The pulsing card border.** Animates forever with no terminating condition and no state
   behind it — *"pacing dressed as progress"*, which `SeedReceipt`'s own docblock refuses —
   and this card reports a **completed** generation. The accent rule carries the emphasis.
6. **"This block is absent when nothing was applied."** An instruction to the implementer, not
   copy for an author. **Honoured rather than printed**: with no pair known, the block does
   not render. Both halves asserted.
7. **The two identical grey footer buttons** on the arrival sheet (both read *"How long it
   looks back"*) are a sketch duplication artifact. The slot is filled by the card's two real
   fold controls.

---

## Pins that moved, and why

**Nothing was re-baselined to make a red go green.** Every moved byte is accounted for against
a drawn element, and every original is kept verbatim beside its replacement.

### `WorkflowDoorSwitch.baseline.test.tsx` — the one the brief flagged

This pin's standing instruction is that a red is *"a BEHAVIOUR CHANGE TO EXPLAIN, never a test
to update"*, enforced at its strongest by **`199-03`, which WITHDREW a completed change**
rather than disturb these strings. **The operator has overruled that posture by naming sketch
200 as the absolute reference**, and the authorisation is written into the pin's docblock —
not left in a commit message — because that docblock is what the next author reads.

Measured, per row:

| row | length | tags | verdict |
|---|---|---|---|
| `CHOOSER_STANDALONE` | 2166 → 3219 | 21 → 29 | restructured |
| `CHOOSER_INLINE` | 2315 → 3368 | 23 → 31 | restructured |
| `DESCRIBE_STANDALONE` | 4625 → 5026 | 41 → 47 | restructured |
| `DESCRIBE_INLINE` | 4698 → 5099 | 42 → 48 | restructured |
| `GOVERN_STANDALONE` | 3340 → **3340** | 26 → **26** | ⚠ **unchanged but for a `useId` counter** |
| `GOVERN_INLINE` | 4092 → **4092** | 33 → **33** | ⚠ **unchanged but for a `useId` counter** |

### ⚠ The finding, worth more than the re-capture itself

**The two `GOVERN_*` rows did not change.** Same length to the byte, same tag count, and the
diff on each is **103 characters containing exactly one moving part** — React's `useId`
counter (`_r_2_`→`_r_7_`, `_r_3_`→`_r_9_`) on the template row's `label`/`input` pair, shifted
because this component now calls `useId` before the Builder does. **Not one class, word or
node moved in a subtree nobody edited.**

`193.1-08` recorded the trap that *"I did not touch the band" is not "the capture cannot
move"* — the govern door **is** the Builder, and these are whole-container captures. Here it
provably did not move. Those two rows are flagged in the pin as carrying **no design intent at
all**, so a later reader does not go looking for the port in them.

### The other pins

| pin | moved | why |
|---|---|---|
| describe door's resting **CONTROL set** | order only | same five testids; the CTA moved into the box's section and the template question into its own. Count re-asserted, and the picker's empty arm proven to add no sixth control |
| textarea's **resting class list** | re-baselined | four token groups, each named. **Two** tone slots now, not three — the sheet's `focus:ring-0` leaves no third to swing. The property the pin guards (same token count, exactly the named slots differing) is re-proved |
| picker: **both zero-row cases** ended `textContent).toBe("")` | flipped | the silence was never a requirement — it was the consequence of having nowhere to put the fact. *Nothing-is-invented* (`T-187-R5-03`) untouched and still asserted |
| picker: **199-08's "THE GAP"** case | flipped | it said in writing that a later plan closing the gap *"has to flip this assertion rather than discover the problem again"*. This is that plan |
| picker: **199-08's REFUSAL block** | retired in writing | original kept in full; each of its three grounds answered on its own terms |
| arrival: **resting atom list** | 9 → 14 | all nine survive in original relative order; nothing removed to make room |
| arrival: **vertical-box surrogate** | re-measured | both readings published; the property (*a fold ADDS, never rewrites*) re-asserted against the new numbers |
| arrival: **"declares NO predicate of its own"** | 1 → 2 | the property is *no second **grounding** derivation*, not *one function*. `declaredModel` names no cause token and cannot return a verdict. The second declaration is named, so a **third** is still red; the cause-token sweep stays total |
| arrival: **the `.map(` ban** | narrowed to its meaning | the only mapped expression is `appliedPairs`, a list this card **builds from its own props**; neither child's row source is mapped here |

### ⚠ A fence I wrote went red, and the fence was wrong

Sweeping every atom on the arrival card for the gate word caught **the receipt's own locked
closing sentence** — *"Everything else is yours to change. Nothing is saved or published
yet."* That sentence is a **statement about state**; the thing the case is about is a
**control that acts**. Banning the word outright would have deleted an honest sentence to
satisfy a fence. The case now sweeps controls and the handler seam, with positive controls on
both halves.

### The 199-04 sheet-c5 block — unchanged, still green, and a note added

Sketch 178 proposed a lifecycle chip and a describe echo; `199-04` refused both for *printing
the mechanism*. **Sketch 200 draws both shapes again and they are now built** — and not one
needle in that block changed, which is the substance of the split rather than a lucky escape:
the **shapes** are admitted, **sketch 178's words** stay refused (200's chip names *when*, not
*how it got here*), and the **door pair** stays refused outright on a ground the sketch cannot
overrule. A note says so, because a reader finding that block green must not conclude the
shapes are still absent — **it measures words, and always only measured words.**

---

## Verification

| | result |
|---|---|
| `tsc -p tsconfig.app.json --noEmit` | **33 pre-existing errors**, matching the brief; **zero in my files** |
| doors suites (6 files) | **234 / 234** |
| arrival family (4 files) | **219 / 219** |
| `WorkflowBuilderPage.canvas` | **154 / 154** |
| `WorkflowBuilderPage` describe / header / preDraft | **120 / 120** |

The known-flaky `WorkflowBuilderPage.*` suites were green on the **first** run of every
invocation. The worker cap was never adjusted.

---

## Not touched, and needed from elsewhere

- **`CLAUDE.md`, `docs/HOT-FILE-LEDGER.md`, `scripts/vitest-count-gate.cjs`** — untouched, as
  instructed. ⚠ `DescribeKbPicker.tsx` and `DraftArrivalCard.tsx` both grew materially and
  `decisionsVocabulary.ts` gained seven ids; the ledger rows are owed by whoever batches.
- **`PublishGauntlet.tsx`, `WorkflowCanvas.tsx`, `PhaseNodeCard.tsx`, `RunModal.tsx`,
  `WorkflowCard.tsx`** — untouched (sibling-owned). The arrival card's `Publish…` action needs
  a seam from `PublishGauntlet.tsx`'s owner; see refusal 4 above.
- **`WorkflowBuilderPage.tsx`** — deliberately **not** modified. Its govern-door describe
  screen is a near-twin of the door's and did not receive the same port, so the two describe
  screens now differ. That page is a hot file (49 commits / 15 phases / 2762 lines) with its
  own byte-exact header pins, and porting it is its own piece of work. **The two `GOVERN_*`
  captures above are the proof that nothing there changed by accident.**
- **`DecisionsList.tsx`** — untouched at `0 0`. The sheet draws per-row status words
  (*Settled* / *Needs you* / *Not recorded*) and a *"You cannot publish until this is settled"*
  sentence. **Four of the five rows have no such predicate** — D-20 / `SEED-163`: only the
  requirement row carries a server verdict, and every one of those words is banned from the
  module by its own gate-claim fence. Porting that would be four false claims about the gate.
  Flagged rather than built; it needs a decision, not a sheet.

---
sketch: 233
name: the-source-says-what-it-did
question: "Can all four surfaces coexist without shouting over each other — and is the path from \"something is off\" to \"I clicked the thing that fixes it\" short and unbranching?"
winner: null
tags: [phase-235, lib-10, surf-02, surf-03, seed-239, seed-248, g2-sketch-gate, notification-surface]
---

# Sketch 233 — The Source Says What It Did

**Phase:** 235 — The Source Says What It Did
**Requirements:** `LIB-10`, `SURF-02`, `SURF-03`
**Context:** `.planning/phases/235-the-source-says-what-it-did/235-CONTEXT.md`

---

## 1. Design Question

> **Can all four surfaces coexist without shouting over each other — and is the path from
> *"something is off"* to *"I clicked the thing that fixes it"* short and unbranching?**

⚠ **This is one sketch and not four, deliberately.** `D-235-19` required all four surfaces settled
together, because *"must not shout over each other"* is **unanswerable on separate pages**. The four:

| # | Surface | Requirement |
|---|---|---|
| 1 | The run history on the source card | `SURF-02` |
| 2 | The stopped-reading card and its one control | `LIB-10` |
| 3 | The rail badge + popover, and the Health tab attention list | `SURF-03` |
| 4 | The instance-level *"the reader is switched off"* statement | `BUG-260906-02` |

---

## 2. How to View

```
start .planning/sketches/233-the-source-says-what-it-did/index.html
```

### Three things to try (also printed on the sketch itself)

1. Click the **2** beside Library — then try to repair Legal SharePoint **from where you land**.
2. Open **History** on Finance Drive and click **checked 14 times, no changes**.
3. Switch **Reader: on → off** in the toolbar, bottom right.

⚠ **Two things to eyeball rather than read**, because static checks cannot judge them: whether the
popover lands cleanly beside the rail (it is `position:absolute` inside the rail item's own
relative wrapper — the containing-block bug class from sketch 153), and whether the amber badge
reads as *attention* rather than *alarm* at a glance.

---

## 3. Variants — the fork is WHERE THE FIX LIVES

Both variants are identical everywhere except one thing, so the comparison is clean.

- **A — the popover carries the repair.** Click the badge, see each stopped source with its cause,
  and press its one control **right there**. Two clicks faster from anywhere in the product.
- **B — the badge is only a door.** The badge navigates to Library ▸ Health ▸ *Sources needing
  attention*; the Health row says **Go to source**; the fix exists in exactly **one** home, on the
  source card.

⛔ **Both variants keep the one control on the card.** The fork is about whether a **second** place
may repair — never about moving the first. A variant that moved it would be testing a different
question.

**The tension, stated plainly so the pick is informed:** B follows the rule that decided every other
placement in this phase — *one home for the action*, the same rule that put the history on the source
card and kept it out of Health (`D-235-17`). A breaks that rule on purpose, because a repair you can
reach from any page is the shortest possible *notice → understand → fix*. **You cannot reason your
way to this one** — it depends on whether repairing from a popover feels reassuring or reckless.

---

## 4. What the sketch locks in (already decided, not up for re-litigation)

These came out of `235-CONTEXT.md` and are rendered here so they can be **seen** rather than agreed
to in prose:

- **Quiet and certain.** No red anywhere — the stopped mark is `--color-warning`, and
  `--color-danger` is never applied to a source state. No severity word, no exclamation. The mark is
  a **shape**, not a word: the heading already says what the section is.
- **The outcome, never the request.** *"Checked 4 minutes ago · 6 files"* replaces *"scheduled"* —
  the word that let `BUG-260906-02` hide a blocking defect for a day. The word **"scheduled" appears
  nowhere in this sketch**, and the drive script fails if it returns.
- **Asked ≠ happening.** The pending state says *"Asked · next check within 60 seconds"*. It never
  claims a read is under way, because it is not — the endpoint is a scheduler poke by design.
- **Said once.** The reader-off condition is **one** statement at page level, and the rows read
  *"Waiting — the reader is off"* rather than each claiming to be individually broken. **The banner
  owns platform-wide truth; the row owns only what is true of that row.**
- **Two audiences, one condition.** Members are told automatic reading is off. **Operators are
  additionally told the setting name** — the one deliberate, marked exception to the no-mechanism
  rule, because for an operator the setting name *is* the action.
- **Every tick has a row; the surface folds them.** Density is rendering, never storage (`D-235-07`).
  Collapsed shows 4 rows and *"checked 14 times, no changes"*; expanded shows all 17.
- **Cause → control is data.** Four causes, four sentences, four different controls — declared in
  `COPY.cause`, never as branches in the card. `hard: true` causes stop on the first failure;
  `hard: false` causes need three (`D-235-10`).
- **`SEED-239` is visible.** The unreadable fourth source renders as a **named degraded row** —
  *"This source could not be read here — the others are unaffected."* It is never silently skipped,
  and it never takes the page down.

---

## 5. The build contract

`BUILD-CONTRACT.generated.md` is written **by `node drive.cjs --emit` from the running sketch** —
never hand-written, never edited. It carries the COPY table, the cause→control map, and **the
ordered `data-block` list each screen renders** with every named `data-action`.

⚠ **The composition half exists because a text-only contract has already failed here.** Sketch 218
shipped 200 assertions, 0 failing, and the operator's verdict on the shipped surface was *"nothing
at all like what we designed"* — because every assertion covered vocabulary and **none covered a
card, a row or a button**. §2 of the contract is the fix, and the phase's React suite must assert
those same `data-block` / `data-action` names, **driven RED first**.

```
node drive.cjs          # 74 assertions
node drive.cjs --emit   # regenerate the contract
```

### The guards were driven RED before handoff

A fence nobody has seen fire is not a fence. Four defects were planted against a copy and each went
red on the right assertion:

| planted defect | assertions that fired |
|---|---|
| the outcome line says *"scheduled"* again | 2 — the `BUG-260906-02` fence and the outcome-line check |
| the unreadable source is silently skipped | 5 — per-source card counts on both variants, plus all three `SEED-239` fences |
| B's popover quietly gains the repair | 1 — the fork's counter-example |
| a row renders *"Error: this source is broken!"* | 3 |

⭐ **The fourth planted defect is the finding.** On its first run it tripped **one** assertion, and
sailed straight through every vocabulary rule — because those rules scanned the `COPY` object and
the defect never touched it. **A vocabulary nothing checks at the render site is a convention, not a
fence.** Two render-site assertions were added (§5b in `drive.cjs`), and the same defect now trips
three.

---

## 6. Content is authored, and says so

Drawn as a Finance team would see it: a Drive folder of supplier invoices reading normally, a
SharePoint contracts library whose token was withdrawn, an Ops photo folder that was un-shared, and a
legacy connection the app cannot project. **These are not real rows** — the sketch says so on its own
surface — because the question here is **wording and loudness**, and the real corpus is one folder
that cannot show a stopped state, a degraded row, or a badge counting more than one thing
(the sketch-142 lesson).

**The engine facts are real:** the six `connector_watch_items` states, the real counts dict keys
(`new` / `modified` / `renamed` / `missing` / `restored` / `errors`), the real cause families, and
the 5-minute cadence floor.

---

## 7. What this sketch does NOT settle

- **Pixel spacing, Tailwind class choices, hover and focus states.** Those stay a human UAT
  comparison, and Phase 235's G-4 rows must name **this file** as the reference.
- **The exact retention `N`** and the health-verdict endpoint shape — planner's discretion
  (`235-CONTEXT.md` § Claude's Discretion).
- **Whether a second notification producer belongs in the shell surface.** The seam is drawn; the
  tenant is not. `SEED-231` owns that, and registering one inside Phase 235 is scope creep
  (`D-235-03`).

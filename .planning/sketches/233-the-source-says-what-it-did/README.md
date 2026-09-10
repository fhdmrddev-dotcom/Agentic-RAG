---
sketch: 233
name: the-source-says-what-it-did
question: "With twelve sources connected and two needing you, how much should a HEALTHY source say?"
winner: "B"
tags: [phase-235, lib-10, surf-02, surf-03, seed-239, seed-248, g2-sketch-gate, notification-surface]
---

# Sketch 233 — The Source Says What It Did

**Phase:** 235 — The Source Says What It Did
**Requirements:** `LIB-10`, `SURF-02`, `SURF-03`
**Context:** `.planning/phases/235-the-source-says-what-it-did/235-CONTEXT.md`

---

## 1. Design Question

> **With twelve sources connected and two needing you, how much should a HEALTHY source say?**

⚠ **This is the SECOND fork. The first was refuted by measurement and is recorded below rather than
erased** — the refutation is the more useful half.

All four of the phase's surfaces live on this one page, per `D-235-19`, because *"must not shout over
each other"* is unanswerable on separate pages:

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

1. Switch between **A** and **B** at the top — twelve sources, two of which need you.
2. In **B**, click any one-line source to open it, then **History** → **checked 14 times, no changes**.
3. Switch **Reader: on → off** in the toolbar, bottom right.

⚠ **Two things to eyeball rather than read**, because static checks cannot judge them: whether the
popover lands cleanly beside the rail (it is `position:absolute` inside the rail item's own relative
wrapper — the containing-block bug class from sketch 153), and whether the amber badge reads as
*attention* rather than *alarm* at a glance.

---

## 3. Variants — how much a healthy source says

> ## ★ WINNER: **B — a healthy source is one line** (operator, 2026-09-06)
>
> ⚠ **The winner is PINNED, not merely written here.** This frontmatter field is prose, and prose
> does not typecheck — this project's own recorded lesson. `drive.cjs` asserts the ★ marker, that the
> file opens on B, that exactly one variant is marked, and that **A is still present and navigable**.
> Driven RED, a defect that re-defaults the file to A trips three of them.
>
> ⛔ **A is not deleted.** The rejected variant is the evidence for the choice; a sketch that keeps
> only its winner cannot show anyone why.

- **A — every source is a full card.** Name, cadence, `from → to` path, outcome line, three buttons.
  Twelve of them. Every source says everything it knows, whether or not you need any of it.
- **B — a healthy source is one line.** Name · destination · *Checked 4 minutes ago · 6 files*.
  It opens into the full card on click. **A stopped or unreadable source is never collapsed** —
  being the one you can see is the entire point.

**Measured, not asserted:**

| | visible text on landing |
|---|---|
| A | **6,460** characters |
| B | **3,230** characters — **exactly 50% shorter** |

This is a direct test of your own stated mindset: *text is noise, cut it; the purpose must survive
the cut*. B's bet is that a healthy source has exactly one thing to say — it read, and when — and
that everything else being one click away is not a loss. A's bet is that a source's cadence and
destination are worth seeing without asking.

⛔ **The cut must not destroy the requirement, and that is asserted:** `SC#1` is *"a person opens a
**source** and sees every run it has made"*, so a collapsed line that could not open would fail the
requirement rather than simplify it. `drive.cjs` proves the opened card carries its full history and
a way back.

---

## 4. ⚠ The refuted first fork — recorded, not erased

The first cut forked on **where the fix lives**: A repaired from the badge popover, B treated the
badge as a door. Measured after the operator said *"I really do not see a difference between A and B"*:

- the two variants differed by **248 characters out of ~30,000**
- the **landing screens were pixel-identical** — the whole Ingestion tab, every card, the history,
  the degraded row and the reader-off banner were byte-for-byte the same
- the entire axis was **three buttons**, two of them behind a two-step interaction

**A variant axis invisible on the screen you land on is not an axis**, and no amount of README prose
fixes that. The operator was right and the sketch was wrong.

**The fix location was then settled by RULE instead of by feel:** the fix keeps **one home, on the
source card, in both variants** — the same rule that put the history on the card and kept it out of
Health (`D-235-17`), and the rule that decided every other placement in this phase. A second repair
site buys two clicks and costs that rule.

⭐ `drive.cjs` now carries an assertion that **makes this failure impossible to repeat**: it strips
tags from both landing states and fails if they differ by fewer than 600 characters of visible text.
Driven RED, it reports *"only 81 chars of visible text differ"* — the exact shape of the original
mistake.

---

## 5. What the sketch locks in (decided in CONTEXT, rendered here to be seen)

- **Quiet and certain.** No red anywhere — the stopped mark is `--color-warning`, and
  `--color-danger` is never applied to a source state. No severity word, no exclamation. The mark is
  a **shape**, not a word.
- **The outcome, never the request.** *"Checked 4 minutes ago · 6 files"* replaces *"scheduled"* —
  the word that let `BUG-260906-02` hide a blocking defect for a day. **"scheduled" appears nowhere**,
  and the drive script fails if it returns.
- **Asked ≠ happening.** The pending state says *"Asked · next check within 60 seconds"*.
- **Said once.** The reader-off condition is **one** statement at page level; rows read *"Waiting —
  the reader is off"* rather than each claiming to be individually broken. **The banner owns
  platform-wide truth; the row owns only what is true of that row.**
- **Two audiences, one condition.** Members are told automatic reading is off. **Operators are
  additionally told the setting name** — the one deliberate, marked exception to the no-mechanism
  rule, because for an operator the setting name *is* the action.
- **Every tick has a row; the surface folds them.** Density is rendering, never storage (`D-235-07`).
- **Cause → control is data.** Four causes, four sentences, four different controls, declared in
  `COPY.cause` — never branches in the card. `hard: true` stops on the first failure; `hard: false`
  needs three (`D-235-10`).
- **`SEED-239` is visible.** The unreadable twelfth source renders as a **named degraded row** —
  *"This source could not be read here — the others are unaffected."* Never silently skipped, never
  collapsed, and it never takes the page down.

---

## 6. The build contract

`BUILD-CONTRACT.generated.md` is written **by `node drive.cjs --emit` from the running sketch** —
never hand-written, never edited. It carries the COPY table, the cause→control map, and **the ordered
`data-block` list each screen renders** with every named `data-action`.

⚠ **The composition half exists because a text-only contract has already failed here.** Sketch 218
shipped 200 assertions, 0 failing, and the operator's verdict on the shipped surface was *"nothing at
all like what we designed"* — every assertion covered vocabulary and **none covered a card, a row or
a button**. The phase's React suite must assert those same `data-block` / `data-action` names,
**driven RED first**.

```
node drive.cjs          # 86 assertions
node drive.cjs --emit   # regenerate the contract
```

### The guards were driven RED before handoff

A fence nobody has seen fire is not a fence.

| planted defect | assertions that fired |
|---|---|
| the outcome line says *"scheduled"* again | 2 |
| the unreadable source is silently skipped | 5 |
| a row renders *"Error: this source is broken!"* | 3 |
| **B stops collapsing — the fork goes invisible again** | **6**, including the visible-difference fence |

⭐ **Two findings came out of driving these**, and both are recorded because they were errors in the
guards rather than in the sketch:

1. **A vocabulary nothing checks at the render site is a convention, not a fence.** The
   *"Error: ...!"* defect first tripped **one** assertion and sailed past every vocabulary rule —
   those scanned the `COPY` object and the defect never touched it. Two render-site assertions were
   added; the same defect now trips three.
2. **A tautology is not a fence.** One assertion read `!x.length === false || true`, which is true
   for every possible input. It sat in a suite whose entire point is that guards fire. Replaced with
   the claim it was pretending to make.

---

## 7. Content is authored, and says so

A Finance team: a Drive folder of supplier invoices reading normally, nine more healthy sources
across Drive and SharePoint, a contracts library whose token was withdrawn, an Ops photo folder that
was un-shared, and a legacy connection the app cannot project. **These are not real rows** — the
sketch says so on its own surface — because the question is **wording and density**, and the real
corpus is one folder that cannot show a stopped state, a degraded row, or a wall.

⚠ **Twelve sources is load-bearing, not decoration.** The question *"how much should a healthy source
say?"* does not exist at four rows. It exists at twelve, where two need you and ten do not.

**The engine facts are real:** the six `connector_watch_items` states, the counts dict keys (`new` /
`modified` / `renamed` / `missing` / `restored` / `errors`), the cause families, the 5-minute floor.

---

## 8. What this sketch does NOT settle

- **Pixel spacing, Tailwind classes, hover and focus states.** Human UAT — Phase 235's G-4 rows must
  name **this file** as the reference.
- **The exact retention `N`** and the health-verdict endpoint shape — planner's discretion.
- **Whether a second notification producer belongs in the shell surface.** The seam is drawn; the
  tenant is not. `SEED-231` owns that, and registering one inside Phase 235 is scope creep
  (`D-235-03`).

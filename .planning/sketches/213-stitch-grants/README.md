# Stitch pass — Phase 213, grants and the approval moment

**Generated 2026-08-27** into `projects/10710316306258284608` with design system
`assets/12493500246735489470` (*Aether Intelligence — Deep Midnight*, v3), model `GEMINI_3_1_PRO`,
`deviceType: DESKTOP`.

Brief: `../STITCH-BRIEF-213-grants-and-the-approval-moment.md`. Method: `../STITCH-BRIEF.md` §6.5.

⚠ **This is DIRECTION, never an acceptance bar.** Stitch renders **zero** shipped components. The
G-2 bar is the sketch that re-expresses the chosen direction against real components — steps 1 and 4
are never collapsed (`SEED-155`).

---

## ✅ The palette bound this time — the check that 212 failed

Phase 212's pass generated into a *new* project, passed Deep Midnight's asset id on all four calls,
**was bound to none of them, and got a teal auto-system with no error and no warning.** Generating
inside the project that owns the design system is the fix, and it worked:

```
grep -oiE '#[0-9a-f]{6}' <file> | tr 'A-Z' 'a-z' | sort | uniq -c | sort -rn
```

| file | top hex values | verdict |
|---|---|---|
| `01-grant-list.html` | `#212631` ×22 · `#dee2f1` · `#c1c1ff` · **`#a3a5ff`** · `#0e131e` · **`#0d1117`** | ✅ Deep Midnight |
| `02-approval-moment.html` | `#dee2f1` · `#0e131e` · `#d0bcff` · `#c1c1ff` · `#303540` | ✅ Deep Midnight |
| `03-layout-comparison.html` | `#dee2f1` · `#0e131e` · `#d0bcff` · `#c1c1ff` · `#212631` | ✅ Deep Midnight |

**Zero occurrences** of Obsidian Archive's teal `#3cddc7` or its ground `#0b1326` in any file.

---

## The three screens

### `01-grant-list` — the connection's permission list

⭐ **It solved the load-bearing problem: INHERITED vs OVERRIDDEN is legible while scrolling.** A row
that was deliberately changed carries a coloured left edge, a tinted ground and a small mark
(`check_circle` / `block`); an inherited row stays plain and quiet. That is GRANT-02's whole visual
contract, and it is the thing prose could not settle.

Also landed, and each is a criterion rather than a flourish:

- One connection-level control — *"Every action asks first unless explicitly overridden below."*
- `Search 44 actions` over one flat list; **reads and writes interleaved, never split into tabs.**
  (GRANT-01, and the reason is in the ROADMAP: the grant-time gate must not key on direction,
  because a read is where prompt injection enters.)
- **`list_webhooks` carries an explicit `Direction: Unknown` chip.** `readOnlyHint` was measured
  absent in the wild; three arms, never two. Met head-on rather than guessed.
- `delete_repository` reads consequential through a red edge and the word *(Destructive)* — not a
  wall of red. Colour on state, and the state also says its word.

⚠ **UNPROMPTED: it drew a centred MODAL, not the detail screen the prompt asked for.** Recorded
because it is evidence, not noise — it is an unforced vote for the operator's own popup instinct.
Not chosen; see the decision below.

⚠ Its subtitle *"Manage agent permissions and posture for this integration"* is generic and
half-mechanism. **The sketch must replace it** — it violates the house rule against naming the
mechanism.

### `02-approval-moment` — the run pauses and asks

The strongest of the three, and closest to shippable language.

- Opens `PAUSED: AWAITING HUMAN CONSENT. NO DATA HAS BEEN SENT.` — the stakes in one line.
- ⭐ **The arguments are the hero, not a collapsed detail row**: repository, branch, title, and the
  real body in mono with `See full body`. A person can read what will happen before agreeing to it.
- **No countdown, no timer, no progress bar.** How long a human takes is unknowable, and a
  fabricated number is forbidden. A generative tool reaches for one by default; this one did not.
- `Deny` is full-size beside `Approve once`. The safe answer is not the small grey one.
- `Always allow create_pull_request on this connection` is the quieter third, and it visibly says it
  changes a standing setting rather than answering this one question.

⚠ *"AWAITING HUMAN CONSENT"* is accurate and grave but colder than the house voice. A call for the
sketch step.

### `03-layout-comparison` — the operator's layout question, measured

The same 44-row content drawn twice. The prompt forbade a winner, so it reports costs instead:

| | A — the narrow panel | B — the full detail screen |
|---|---|---|
| the control | ⚠ **cannot fit on the row — wraps to its own full-width line under the description** | inline: `ACTION NAME · DESCRIPTION · PERMISSION` |
| cost per action | **~3 stacked lines** | **1 table row** |
| its own cost line | *"Costs context-at-a-glance for dense navigation."* | *"Costs situational awareness for row-level detail."* |

⚠ **THE FINDING IS SHARPER THAN THE ARGUMENT WAS.** In A the connections list beside the panel is
squeezed to unreadable grey stubs — so *"look sideways to see which other connection is in the same
state"*, which is the entire recorded reason `D-27` chose a panel over a dialog, **is mostly gone
anyway at this content size.**

⚠ Only 3 rows per side were drawn. **The 3-lines-vs-1-row ratio is the evidence; the visible count
is not.**

---

## ⭐ OPERATOR DECISION, 2026-08-27 — **A, the panel stays**

Asked to choose between A, B and the modal `01` drew unprompted, the operator answered **"A"**.

**`D-27` therefore stands rather than being overturned**, and the connections list stays visible
beside the panel — the property that decision existed to protect.

### ⚠ The rider, and it is what makes A work rather than repeat the complaint

The operator's original words while driving Phase 212 were: *"should we open each one in a pop up
window instead of being on the right and splitting the screen which is already narrow to 2 halves."*
Choosing A after seeing the measurement is a decision on evidence — but it must not land back on the
thing that prompted the complaint.

> **A's cost is a function of 400px, NOT of being a panel.**

`D-27` sized the panel for a **3–5 field form**. Nothing binds a *grant list* to that width, and the
measured failure was specific: at 400px the three-state control cannot sit on the row, so it wraps
and one action costs ~3 lines instead of 1. Widen the panel for this content and the stacking goes
away while every `D-27` property is kept.

**Sketching A at ~580px** — roughly 500px is where the control fits inline; 560–600px is comfortable
with the name and description still readable. If the operator holds it at exactly 400px, the sketch
draws the stacked form honestly instead: it works, it scrolls about 3× more.

---

## What was deliberately NOT generated

- **Variants** — tens of minutes each, and they are step 2's instrument. The operator has now reacted;
  reach for them only if a chosen screen needs a range.
- **The refusal screen** (GRANT-04) — reuses the shipped vocabulary in `connectionRefusalCopy.ts`. A
  copy problem with an existing house pattern, not a composition problem.
- **The audit receipt** (GRANT-05) — Phases 146–148 shipped that vocabulary. Inventing a second one
  in Stitch would manufacture drift where none exists.

## Next

The sketch under `.planning/sketches/213-.../`, rendering real `ConnectionFormPanel` /
`ConnectionsTab` components in `frontend/src/index.css` tokens.

⚠ **The operator's standing clause: the sketch must MATCH what Stitch drew.** It changes the
*materials*, never the *composition*. Any place the shipped components cannot reproduce it is a
`SEED-155` finding to be **recorded and raised**, never silently designed around — that is exactly
how the workflow card drifted through three phases.

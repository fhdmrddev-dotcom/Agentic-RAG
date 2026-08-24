# Sketch 200 vs sketch 178 — what is covered, what is not

Derived by reading all eleven `178/sheets/*.html` and all seven generated screens, not from memory.

## The structural reason there is a gap at all

**178 drew COMPONENT SHEETS: every state of one atom, side by side.**
**200 draws a JOURNEY: one path a person walks, one state per screen.**

Seven journey screens cannot contain eleven sheets' worth of states, and they should not try —
a screen showing six versions of the same node is a specimen sheet, not a screen. So the gap
splits into two different kinds, and they need different answers:

- **Missing JOURNEY STEPS** — real surfaces a person passes through that the journey skips. These
  belong in the journey and change its order.
- **Missing STATE MATRICES** — the same surface in its other states. These belong in a companion
  state sheet, not in the walk-through.

## Coverage table

| 178 sheet | What it carries | Covered by | Verdict |
|---|---|---|---|
| c1 canvas plane | plane, 4-5 connection states, floating controls, empty + read-only planes | § 4 canvas | ✅ covered |
| **c2 phase node** | 6 types · 3 name fallbacks · **6 interaction states** (rest/hovered/selected/dragging/problem/locked) · **7 run states** (waiting · running `00:15` · succeeded *"Found 12 items"* · failed · skipped · paused) · the branch · 3 zoom sizes | § 4 shows nodes AT REST only | ❌ **the whole state matrix is missing** → new § 10 |
| c3 phase spine | 3 columns: authoring · live panel · **receipt** | § 3 (authoring) + § 7 (live) | ⚠ the **receipt** column is missing |
| c4 form panel | collapsed to essentials vs fully expanded | § 5 + R5 | ✅ covered |
| **c5 draft arrival** | **arrival card** (freshly arrived / returned-to) · **decisions list** (satisfied · needs-you · unknown · grounding) · **seed receipt** | — | ❌ **ENTIRELY MISSING** → new § 9 |
| c6 library dialogs | toolbar · cards · run dialog · **fork dialog** · **delete sheet** | § 1 + § 2 | ❌ **fork + delete missing** → new § 12 |
| c7 gauntlet & soul | gauntlet strip · **the soul** | § 6 | ⚠ **the soul is missing** |
| **c8 run panel** | **ask card** (open + resolved) · **paused cue** · files section · **file preview** (csv + json) · **version diff** · empty panel | § 7 shows the step spine only | ❌ **5 of 6 components missing** → new § 11 |
| **c9 doors & describe** | **door switch** (3 states) · door header strip · **describe box** (empty / filled / **refusal**) · **knowledge picker** (none / one / zero) · template row | — | ❌ **ENTIRELY MISSING** → new § 8 |
| c10 builder chrome | header in its several states | the header on § 3 / § 4 | ⚠ partial, one state only |
| c11 journey arc | — | — | n/a — 178 marked it FAILED and out of scope |

## ⚠ The finding that changes the journey's ORDER, not just its length

`c9` and `c5` are not extra screens — **they are the first two steps of authoring, and the journey
currently starts in the middle.** A person does not arrive at a five-step spine; they choose a door,
describe what they want, and receive a draft. The corrected walk is:

```
library → THE TWO DOORS → describe it → THE DRAFT ARRIVES → spine → canvas → step panel → publish → run
             (new § 8)                      (new § 9)
```

Screens § 3–§ 7 were all generated against the old, truncated journey. They are still correct — but
the walk they sit in was missing its opening, which is why the set felt thinner than 178 even though
every individual screen audited clean.

## What each new section is for

| New § | Kind | Closes |
|---|---|---|
| **8 · The two doors + describe box** | **journey step** | c9 entirely — including the **refusal** state, which is a shipped behaviour that said nothing at all until Phase 199 |
| **9 · The draft arrival** | **journey step** | c5 entirely — the arrival card, the five-row decisions list, the seed receipt |
| **10 · The node state matrix** | **state sheet** | c2's 6 interaction + 7 run states. NOT a journey screen — one surface, all its states |
| **11 · The run panel's other parts** | **state sheet** | c8's ask card, paused cue, file preview, version diff |
| **12 · Fork + delete dialogs** | **state sheet** | c6's two remaining dialogs, incl. the graded-guard ladder |

## Two things deliberately NOT proposed

- **c3's receipt column** and **c7's soul** are each one component on a screen that already exists.
  They fold into § 7 and § 6 as revisions rather than earning their own screen.
- **c11 journey arc** stays out. 178's own README records it as FAILED and out of scope, and
  re-running a sheet its author rejected would import a known-bad artifact.

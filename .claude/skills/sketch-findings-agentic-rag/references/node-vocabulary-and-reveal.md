# Node Vocabulary & the ⌥ Technical-names Reveal (Phase 187 / VOCAB-01)

What a canvas step is **called**, and what changes when a user asks to see the technical names.

Synthesized from sketches **148** (winner C) and **149** (winner C), 2026-08-01.

---

## Audit first: most of VOCAB-01 already shipped

Read this before scoping any vocabulary work — it is the single biggest thing the Phase 187
roadmap text gets wrong.

| Believed missing | Actually shipped |
|---|---|
| Plain-language node verbs | **Phase 183.** `phaseVocabulary.ts:127` `PHASE_TYPE_SENTENCES` + `:137` subtitles + the 3-tier `nodeTitle()` at `:169` |
| The Technical-names reveal | **Phase 154 / LANG-01** built `TechnicalNamesProvider` (ONE app-wide boolean, localStorage, default off). The canvas already rides it: toolbar toggle `WorkflowCanvas.tsx:1285`, `technical` merged onto node data `:945`, title swap `PhaseNode.tsx:144`, and the **same** swap on the vertical spine `PhaseSpineGraph.tsx:125` |

**Both graph views already agree.** There is no wiring to do. What was missing is *specificity*.

---

## Decision 1 — the node face is a LAYERED ladder (148-C)

**author name → config-derived → type sentence.** One tier inserted into the shipped `nodeTitle`
ladder; additive, not a replacement.

### Why the generic face is a real failure, measured

- Only **10 of 119** live phases carry a real `phase.name` (`phaseVocabulary.ts:123`).
- The NL generator authors a **definition-level** `name` only (`workflow_authoring.py:88`) — never
  a per-step one.

So the dominant face is the type sentence, and there are only six of them. **Every AI-seeded
workflow renders the same six lines.** In a real 5-step procurement flow, the "search the contracts
folder" step and the "apply the pricing policy" step are letter-for-letter identical
(`"Work out how to do it"`). That is Phase 187 SC#5's "toy demo" failure landing on VOCAB-02's own
headline feature — **the seed problem and the vocabulary problem are one problem.**

### The three criteria that decided it

Each computed from a visible cell in the sketch's compare grid, never asserted:

| | ① every step reads distinctly | ② survives a config edit | ③ keeps author names |
|---|---|---|---|
| Today (shipped) | ✗ two steps identical | ✓ | ✓ |
| A · AI-authored, stored in `phase.name` | ✓ richest | ✗ **stale** | ✓ |
| B · config-derived only | ✓ | ✓ | ✗ **discards it** |
| **C · layered** | ✓ | ✓ | ✓ |

- **A fails ②** — re-bind a step's skill and the stored name still promises the old behaviour. A
  stored name has no invalidation story.
- **B fails ③** — it replaces a hand-written "Board-ready renewal pack" with the template filename.
  Config-only doesn't just add a tier, it *removes the one already shipped*.

### A and C are NOT rivals — they compose

This is the part most likely to be mis-planned as an either/or:

- **C governs what the card SHOWS** when nothing was written.
- **A governs what the generator WRITES** — it fills C's top tier at seed time.

Run both and you get A's specificity with C's safety net, because the derived tier is what shows
whenever no name exists. **If only one ships, ship C** — it clears all three criteria alone.

### The derivation (pure, computed at render, never stored)

Same shape as the shipped `groundingCauseOf` derivation. Resolution order, first hit wins:

```
bound skill  → "Run the <skill name>"        e.g. "Run the pricing policy check"
template     → "Fill <template filename>"    e.g. "Fill Renewal Summary.pptx"
folder       → "Search <folder>"             e.g. "Search Supplier Contracts"
human input  → "Wait for your approval"
otherwise    → null  (fall through to the type sentence — an honest floor, not a bug)
```

A derived face can only ever be as specific as the config. A step with nothing bound correctly falls
back to "Prepare the inputs".

---

## Decision 2 — the reveal swaps the SUBTITLE, not the title (149-C)

The shipped reveal is a **swap**: `title = technical ? technicalTitle : title`. It destroys the
plain title. That was cheap when the plain title was the generic "Work out how to do it"; **148-C
makes it specific, so the same swap now destroys real meaning.**

| Treatment | Reveal ON | Verdict |
|---|---|---|
| A · swap the title *(shipped)* | `AI agent step · find-renewal-terms` | Meaning gone — **and it truncates** |
| B · add a third line | title + subtitle + mono technical line | Best comprehension, but **spends Phase 188's slot** |
| **C · swap the subtitle** | plain title + mono technical line | Meaning kept, **no slot spent, height unchanged** |

### Two findings that decide it

**A truncates the one thing the reveal exists to show.** The title is `truncate` at 14px in a 248px
card, so `technicalTitle` renders as `AI agent step · find-renewal-t…` — **the slug clips.** The
slug is the only genuinely technical token on the card and the entire reason to turn the reveal on.
B and C both render it in full, because the mono 10px line fits where the headline does not.

**`technicalLine` is not a free slot.** It IS rendered by the shipped card
(`PhaseNodeCard.tsx:325`) but is deliberately never passed — `PhaseNode.tsx:183` reserves it for
**Phase 188** alongside `status` and `stepNumber`. Choosing B is a *Phase 188 scope decision*, not
only a 187 one.

**C's cost:** the type subtitle. Beneath a title already reading *Search Supplier Contracts*, the
line "Reads only the Supplier Contracts folder" is close to a restatement. **Open item:** confirm
that holds across all six phase types, not just `llm_agent`.

---

## CSS Patterns

The card is the shipped **137-B** geometry (185-01 rebuilt it). Read these from
`PhaseNodeCard.tsx` — **not** from `themes/canvas-184.css`, which is the superseded 137-D language
(left-floating icon, 300px card) and would draw a card that no longer exists.

```css
/* node box */   width: 260px; min-height: 104px;          /* canvasModel.ts:62 CANVAS_LAYOUT */
/* card     */   width: 248px; margin: 0 auto;
                 border-radius: 22px; padding: 42px 20px 20px; text-align: center;
/* 3D mark  */   left: 50%; top: -26px; width: 62px; height: 62px;   /* overflows upward */
/* seal     */   top: 11px; right: 17px; width: 21px; height: 21px;  /* 11 + 6 box inset */
/* verdict  */   left: -8px; top: 6px; width: 22px; height: 22px;

.ttl { font-family: var(--font-headline); font-weight: 600; font-size: 14px;
       overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }   /* ← the truncation */
.sub      { margin-top: 4px; font-size: 11px; color: var(--color-text-muted); }
.techline { margin-top: 4px; font-family: var(--font-mono); font-size: 10px; }
```

Nothing here may take `overflow: hidden` — the 3D mark and the verdict both rely on upward overflow.

---

## What to Avoid

- **Do not plan A and C as alternatives.** They operate on different fields at different times.
- **Do not store a derived title.** The whole property that makes C safe is that it is computed.
- **Do not spend `technicalLine`** without deciding, deliberately, that Phase 188 gets one fewer line.
- **Do not add a badge for any of this.** `BadgeSlots` is a max-2 tuple union — a third badge is a
  typecheck error. Slot 1 is empty and reserved for 188/189; slot 2 is `Waits for you`.
- **Do not put a control on the card.** One tab stop per node is a canvas-level invariant; the ✕ and
  ＋ live on the lane, and arming/escalating happen in the panel (sketch 147).
- **Do not reason about the card from `themes/canvas-184.css`.** It is 137-D. The card is 137-B.
- **Do not add a second technical-names toggle.** `TechnicalNamesProvider` is one context precisely
  so two toggles can never disagree.

---

## Method note that generalises

Sketch 148's first review reported *"no difference between the variants."* The variants were
correct; the **sketch** was wrong twice: the deciding card (the only step where B and C disagree)
sat off-screen behind a horizontal scroll, and tab-switching outsourced the comparison to memory.

**Variants that differ semantically in the SAME position need a co-present side-by-side view, not
tabs.** Sketches 149–151 were built with that from the start.

---

## Origin

Synthesized from sketches: **148** (winner C), **149** (winner C) — operator 2026-08-01.
MANIFEST running decisions **60** and **61**.
Source files: `sources/148-the-step-that-says-what-it-does/`, `sources/149-what-the-reveal-costs/`

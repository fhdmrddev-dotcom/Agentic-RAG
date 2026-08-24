---
sketch: 202
name: the-run-column-rendered
kind: rendered-sketch
acceptance_bar: true
question: "The Stitch reference draws a hero + a card-stack 'process trace'. How much of it survives contact with the data we actually hold — and does the centre column stop reading as a second copy of the right panel?"
winner: "C — reference shape, strict single line"
tags: [run-surface, run-transcript, run-spine, deliverable, hero, seed-191, seed-155, renders-real-components, stitch-derived, g5-hot-files]
seeds: [SEED-191, SEED-155, SEED-185]
phase: 200.2
built: 2026-08-23
renders_real_components: true
stitch_reference: "Aether Journey v2 (7797685529205337277) › screen b08b92ce024a4351b1e64944307557dd — 'Workflow Run — Finished Result'"
surface: "frontend/sketch/ — a sibling Vite entry, NOT a route under src/. ⚠ TEARDOWN IS EXECUTABLE: `frontend/src/__tests__/no-sketch-surface.test.ts` turns RED once Phase 200.2 has an executed plan."
---

# Sketch 202: the run column, rendered

**Step 3 of the Stitch → language → rendered loop.** Stitch gave the language. Sketch **201**
applied it to our data and the operator chose *the adaptive hero*. `200.2-CONTEXT.md` turned
that into sixteen decisions. This one **builds it against the real components and the real
rows** — and four of those decisions did not survive.

## How to view

```bash
cd frontend && npm run dev
# → http://localhost:5173/sketch/
```

Top bar: **variant** (A/B/C) × **arm** (both / answer / failed / cancelled), plus two toggles
on B and C — `relevance score` and `answer rule`. Both toggles exist because of findings below.

## ⚠ It renders the real thing

Variant **A** mounts the shipped `RunTranscript` and `RunSpine`, unchanged. **B** and **C** are
proposals typed against the real `WorkflowRunPhase`, composed from the real leaves
(`phaseDuration`, `receiptVocabulary`, `FileRow`, `MarkdownRenderer`). The shipped `RunSpine`
renders in **every** variant, so the duplication question is judged against the real panel.

- `tsc -p tsconfig.sketch.json` → **0 errors in `sketch/`**; the app baseline is **33**, unmoved.
- `count gate OK` — 110/110 pinned files, no per-file decrease, **0 failing**, `total 5398`.
- 9 sketch tests + 4 teardown-guard tests pass; all three guard invariants driven RED and restored.

### ⚠ Why it lives OUTSIDE `src/`, and that is a measured fix

The first attempt put it at `src/dev/` behind a guarded pathname branch in `main.tsx` — the
sketch-179 shape. It turned **`RunReceipt.test.tsx` RED**:

```
AssertionError: expected [ 'SketchRunColumn.tsx', …(1) ] to strictly equal [ 'WorkflowRunPage.tsx' ]
```

That suite sweeps `import.meta.glob("/src/**")` and asserts **exactly one** importer of
`RunReceipt` — 199-02's refusal, because the builder's spine reads a DRAFT and has no run.
**A sketch under `src/` is production surface as far as a shipped fence is concerned.** A
sibling directory is invisible to that glob and can still import the real components through
`@/`, so the fence keeps full strictness, the sketch keeps real mounts, and `src/main.tsx`
stays **byte-identical** to its shipped shape.

## Data provenance — four real runs, read from the live DB on 2026-08-23

| arm | run | steps | what it carries |
|---|---|---|---|
| **both** | `bef870ba` | 5 | 1 file + an answer · `llm_agent ×3 · llm_single · llm_emit` |
| **answer** | `13691156` | 3 | 0 files, an answer, **38 real citations** · `llm_agent · llm_human_input · llm_single` |
| **failed** | `d8f87920` | 5 | **neither** — step 1 failed, four left `pending` |
| **cancelled** | `c353ff78` | 5 | **neither** — step 1 cancelled, four left `pending` |

## Variants

- **A — Today (control).** The shipped surface. You cannot judge a redesign without it beside you.
- **B — Reference shape, duration on line two.** The Stitch card stack. Where the reference put
  invented narration, this puts the step's own **duration** — backable, and it preserves the
  two-line rhythm the cards are built around.
- **C — Reference shape, strict single line.** ★ **WINNER (operator, 2026-08-23).** The same
  cards with **nothing** where the narration was. What strict R-3 compliance actually costs.

---

# What the render found

## 1. ⚠ THE SHIPPED ANSWER RULE PICKS A STATUS LINE ON A REAL RUN

`WorkflowRunPage.runAnswer` takes *the last server-ordered row with non-empty
`deliverable_text`, skipping `llm_human_input`*. On the QBR run that row is `emit-qbr`, an
`llm_emit` step whose **entire text** is:

> `Produced the filled deliverable: /Northwind-QBR-Template.docx`

**61 characters of status.** One step earlier, `synthesize` holds **6,133 characters** of the
actual QBR narrative. So today's run page renders that filename announcement under the heading
**"The answer this run wrote"** — the surface stating, in its own voice, that a status line is
the deliverable.

It is the same class of defect the `llm_human_input` skip was added to fix — a step's `text`
that is not an answer — one phase type over, and the shipped skip does not cover it.

⚠ **Not proposed as a one-line fix.** `llm_emit`'s text may be right on a workflow whose emit
step writes prose, and this is one run. What the sketch establishes is that **the rule is wrong
on a real run today**. The `answer rule` toggle renders both readings.

## 2. ⚠ CONTEXT's "no clean signal to guard with" IS REFUTED — and by my own bad fixture

`200.2-CONTEXT.md`'s D-06 discussion says *"`phase_type` is `null` on every fixture row — the
definitions predate it — so nothing on the wire marks a gate"*, and the sketch used a slug
heuristic accordingly.

**That was false, and it was false because the fixture generator was wrong.** It read
`phase["phase_type"]` off the definition JSON, which does not exist. The server reads
`phase["config"]["phase_type"]` (`api/workflow_runs.py:308`), and it is populated on every real
row: `llm_agent` · `llm_single` · `llm_emit` · `llm_human_input`.

**A wrong fixture produced a wrong conclusion, and the conclusion was already written into
CONTEXT before the render caught it.** There is a clean signal; the shipped `runAnswer` already
keys on it. D-06 must be corrected.

## 3. ⚠ R-2's ARGUMENT DOES NOT COVER WHAT IT REFUSES

SEED-191 refuses a relevance score because *"`similarity_scores` held 7 entries against 38
citations — they do not correspond."* Measured on the same row, that conflates **two different
keys**:

- `output.similarity_scores` → **7** floats, corresponding to nothing. The refusal is correct.
- `output.citations[i].similarity` → present on **all 38**, per entry, real (`0.579, 0.533, …`).

The per-citation number **is** backable. Keeping it off may still be right — a bare `0.579` is a
figure nobody can act on — but that is now a **design** call, not an honesty one. The toggle
renders it so the choice is visible.

## 4. ⚠ D-11's CONCLUSION IS RIGHT, ITS STATED REASON IS NOT

CONTEXT says nothing guarantees `_measure.count === len(citations)`. Measured on the *same*
rows they agree exactly — **15/15, 20/20, 20/20, 38/38**. SEED-191 was comparing two different
runs. Printing one count is still the better design; it is a preference, not a defence.

---

# Two near-misses this sketch committed, and both are the point

**A fabricated `55 sources` chip shipped in the first render.** The reference has a run-level
`17 sources` chip; there is no run-level count on the wire, so I summed the per-step
`_measure` values (`15 + 20 + 20`). The chip then reads *"55 sources"* beside a heading, which a
person reads as **fifty-five distinct documents** — but the same document can satisfy three
retrieval steps, so the sum counts **reads**, not sources. A plausible, un-declared figure,
exactly the class `199-05` called *"the highest-consequence lie this phase could ship"*.
**Removed**, with the reasoning kept in the source rather than deleted.

**The spine rendered five `?` glyphs on a run where every step completed.** `RunSpine` keys its
ring face on the live reading and falls back to `FALLBACK_FACE` (`"?"`) for a slug it holds no
reading for. Passing no `liveOf` is not neutral — it is wrong, loudly, and **no test would ever
have said so**. Caught by looking at the screenshot.

---

# What the reference settles that CONTEXT never asked

- ⚠ **The reference has NO clock gutter in the centre.** Times live only in the right panel.
  SEED-191's finding #1 — the left clock is the running sum of the right — is solved by
  **deletion**, and neither CONTEXT nor sketch 201 proposed that. B and C adopt it.
- ⚠ **The reference keeps the count in BOTH columns** — a chip on the card *and* a sub-line on
  the spine. **D-05 says take it off the spine.** They disagree, and the shipped spine renders
  in every variant so the disagreement is on screen.
- ⚠ **The reference's hero HAS a heading** ("The answer"). **D-14 says no heading.** Kept here,
  but TYPED by what the run produced, so it never claims authorship of a thread-scoped file.
- ⚠ **Half of what makes the reference look good is content we do not hold** — the per-step
  narration, the query block, the relevance score. Strip them and variant C is what is left.

# What to look for

1. **SC#4.** Read B's two columns as a person would. Still the same list?
2. **B vs C.** Is the duration a good enough stand-in for the reference's narration, or does C's
   single-line card read better than a padded one?
3. **The `answer rule` toggle on the `both` arm.** This is finding 1, live.
4. **The `neither` arms.** Failed vs cancelled — two sentences, two truths. Worth the copy?
5. **Narrow below 1024px.** `RunSpine` is `hidden … lg:flex`, so there is no second column and
   no duplication at all — the hero becomes the whole page. Every CONTEXT decision assumes two.

# Owed next

An operator verdict on A / B / C, then the CONTEXT amendments findings 1–4 force, then
`/gsd:plan-phase 200.2`.

⚠ **Teardown:** delete `frontend/sketch/` **and** `frontend/tsconfig.sketch.json` in one commit.
`src/__tests__/no-sketch-surface.test.ts` holds three invariants — expiry (red once Phase 200.2
has an executed plan), the directory ↔ tsconfig pairing, and `src/main.tsx` staying clean — all
three **driven RED and restored** on 2026-08-23. ⚠ It is **not** in the count gate's `TARGETS`,
so a green gate is not evidence it passed; a plain `vitest run` is.

---

# ✅ VERDICT — C, the strict single line (operator, 2026-08-23)

The card stack, one line per step: status ring · name · the step's own yield · a chevron where
there is something behind it. **B's second line is rejected** — the duration was a backable
stand-in for the reference's narration, but standing something in for a slot only because the
drawing had a slot is the drawing leading the data.

```
Process trace
 ✓  Pull usage and adoption data                    15 sources  ›
 ✓  Pull support history                            20 sources  ›
 ✓  Pull commercial position and meeting notes      20 sources  ›
 ✓  Synthesize the QBR narrative                      finished
 ✓  Fill the QBR template                             2 fields
```

## ⚠ C MAKES D-05 LOAD-BEARING, AND THE RENDER IS WHY

This is the consequence the verdict carries, and it was NOT visible before the sketch existed.

The shipped `RunSpine` renders in every variant — deliberately, so the disagreement between
the reference and `D-05` would be on screen. Read the two columns as they stand:

| centre (C) | spine (shipped) |
|---|---|
| `Pull usage and adoption data · 15 sources` | `Pull usage and adoption data · 15 sources · 26s` |
| `Pull support history · 20 sources` | `Pull support history · 20 sources · 23s` |

**The centre is now a strict subset of the spine plus a chevron.** C strips the centre down so
far that, with the spine's count sub-line still in place, the columns say the same thing twice
more plainly than before — SEED-191's original finding, in a new shape.

So **C only works if the count comes off the spine**, which is exactly what `D-05` decided and
what the Stitch reference does *not* do. The reference keeps the count in both columns; on our
data, with our narration absent, that is the arrangement that fails. **D-05 stands, and it is
now the load-bearing half of this design rather than a preference.**

The division of labour C settles on: **the centre says WHAT each step yielded; the spine says
WHEN and HOW LONG.** Neither column repeats the other's payload.

## Two smaller things the winning render surfaced

- ⚠ **The right-hand slot mixes two kinds of thing.** Four rows carry a yield (`15 sources`,
  `2 fields`); `Synthesize the QBR narrative` carries the state word `finished`, because it
  declares no count. That is D-07 working as written — but at one line per card the two read as
  the same slot, and `finished` next to `20 sources` looks like an odd one out rather than a
  different kind of fact. Worth deciding at plan time; not a blocker.
- ⚠ **`Fill the QBR template · 2 fields` is the step that produced the FILE, and its card does
  not say so.** Nothing on `workflow_phases` attributes a file to a step (the run's file list is
  thread-scoped), so the card *cannot* say it without fabricating the join — the same refusal
  `RunReceipt` keeps by passing no `deliverableOf`. Recorded so it is not read as an oversight.

## Owed, in order

1. **Amend `200.2-CONTEXT.md`** for findings 1–4 above: D-06 (the signal exists), D-10 / R-2
   (re-justify), D-11 (correct the premise), and **D-05 promoted from a decision to the thing C
   depends on**. Add the `llm_emit` answer-rule defect as a new decision or a bug report.
2. `/gsd:plan-phase 200.2`.

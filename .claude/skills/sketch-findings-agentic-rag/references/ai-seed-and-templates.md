# AI-Seeded Canvas & the Template Door (Phase 187 / VOCAB-02, VOCAB-03)

What it feels like when the AI drafts your workflow, how the safety it silently applied becomes
legible, and how "start from a template" sits beside the describe box.

Synthesized from sketches **150** (winner B) and **151** (winner C), 2026-08-01.

---

## The constraint that shapes everything: generation is SINGLE-SHOT

`generate_workflow_definition` (`workflow_authoring.py:217`) makes **exactly one** provider call on
a valid first emit — two only on a first-pass `ValidationError`, never three — and returns the whole
definition or an honest error. **It never yields a partial.** The builder's state machine is
`empty → composing → drafted` (`WorkflowBuilderPage.tsx:11`).

**Therefore a node-by-node reveal is PACING, NOT PROGRESS.** The work is finished before the first
node lands. Sketch 150's variant A was built *and labelled as exactly that on its own canvas*,
because this project's standing rule is that a surface never implies an event it did not receive.
If a staged reveal is ever wanted for feel, it must not read as the AI still deciding.

---

## Decision 1 — the canvas arrives ALL AT ONCE with a seed receipt (150-B)

### The problem: safe-by-construction is invisible by construction

Phase 187 SC#3 promises *"a seeded grounded node auto-gets its citation/confidence gate —
safe-by-construction."* In practice two steps arrive carrying a **⛨ seal the user never asked for**,
and nothing on the canvas explains why. Safety nobody can see is indistinguishable from magic, and
magic is not trust.

### The three variants answer DIFFERENT questions

None answers all three — this is the finding, not a tie-break:

| | Where do I start reading? | Why is that step locked? | What have I reviewed? |
|---|---|---|---|
| A · staged placement | ✓ the eye follows the sequence | ✗ never explained | ✗ no record |
| **B · all at once + receipt** | ✓ the receipt orients you | ✓ **named, with the reason** | ✗ no record |
| C · AI-drafted until touched | ✓ anything still unreviewed | ✗ seal still unexplained | ✓ **the whole point** |

**B wins because it is the only variant that discharges SC#3.** A's contribution (orientation) is
delivered by both B and C without the honesty tax.

### The seed receipt

A dismissible card above the canvas, appearing with the draft. Same discipline as the publish
gauntlet (finding #16): **render the real reason, never re-derive it.**

```
Here's what I built — 5 steps                                    ✕

Two of them read your documents, so I set them to must prove it.
You can't turn that off — but you can see exactly where it applies.

  ⛨  Search Supplier Contracts    — it reads your documents (search_documents)
  ⛨  Run the pricing policy check — it reads your documents (search_documents)

Everything else is yours to change. Nothing is saved or published yet.
```

Load-bearing properties:

- **Per-step, with its cause.** Not a summary count — the specific steps, and *why each one*.
- **States the one-way rule plainly** ("you can't turn that off") rather than letting the user
  discover it by trying. Detection wins over author intent; the lock is one-way by construction
  (`groundingCauseOf`, Phase 185).
- **Dismissible.** The canvas underneath is the real product.
- **Ends by saying nothing is committed** — the draft is not saved or published.

### C is DEFERRED, not rejected

C tracks review state, which B does not. Two things it owes before it can ship:

1. **A placement.** As drawn, its ✦ mark sits at `-left-2 top-1.5` — exactly the server verdict
   mark's coordinates. The card's corners are fully allocated: top-right is the governance seal
   *permanently*, the left mark is the *transient* verdict. Phase 188's run state lands on these
   same nodes too.
2. **A meaning at publish.** If a draft publishes with nodes still unreviewed, does anything care?
   Either it is decorative (fine — say so) or it becomes a soft publish gate, which is a real scope
   addition the 8-stage gauntlet has opinions about.

Its `✦` (drafted) and `✓` (reviewed) are **net-new glyphs**, not existing vocabulary — see
`icon-convention.md`.

---

## Decision 2 — the template SEEDS THE DESCRIBE BOX (151-C)

### Measured facts

- There are exactly **THREE** curated starters: `list_starter_workflows` (`db/workflows.py:291`)
  reads `definition->>'category' = 'starter'`; migration 094 seeds **Risk Register**, **Weekly
  Status Report**, **Compliance Gap Report**. **A gallery is over-built for three.**
- **"Fork a starter" is already one of the four routes into the Builder**
  (`WorkflowBuilderPage.tsx:459`). The plumbing exists; what was missing is a door on the *first
  screen* — today you must already know to come via the Workflows page.

### The axis that decided it is PATH COUNT, not clutter

| | Calm screen preserved? | A first-timer finds it? | One forward path? |
|---|---|---|---|
| A · quiet link | ✓ 1 extra line | ✗ easy to miss | ✗ |
| B · inline chips | ✗ 8 elements before acting | ✓ unmissable | ✗ |
| **C · seeds the box** | ✓ 1 extra line | ✗ same link as A | ✓ **always describe → draft** |

A and B both create a **second forward path** — template → canvas, skipping generation entirely.
That is a second way a workflow comes into existence, with its own code and failure modes,
bypassing the describe → draft flow everything else is built around.

**C collapses it back to one path:** picking a template fills the describe box with its
plain-language sentence, which you can still edit before anything is generated. It preserves
finding #11 (describe-box-only first screen) and #12 (the 3-second read) — one extra line, same
as A.

### C's cost, recorded rather than waved away

C **discards the starter's curated definition** — a workflow a human shaped — and re-derives one
from a sentence, which may come back different. That is exactly why the **direct curated fork stays
on the Workflows page** per the three-homes contract (#19), where a library belongs. Both behaviours
get a home; neither crowds the calm screen.

---

## CSS / HTML Patterns

**A starter is identified by its PHASE SPINE** (finding #36) — never by one borrowed phase-type
glyph. See `icon-convention.md`; this was a real correction during review.

```html
<span class="chip">
  <span class="spine sm"><!-- icon3d(t) per phase type, joined by hairlines --></span>
  Risk Register
</span>
```

```css
.chip .spine.sm    { display: inline-flex; gap: 3px; align-items: center; }
.chip .spine.sm svg{ width: 16px; height: 16px; }
.chip .spine.sm i  { width: 5px; height: 1px; background: var(--color-text-dim); }

/* the seed receipt */
.receipt      { max-width: 720px; background: var(--color-surface);
                border: 1px solid var(--color-border); border-radius: var(--radius-lg);
                padding: 16px 18px; opacity: 0; transform: translateY(-8px);
                transition: all .45s ease; }
.receipt.in   { opacity: 1; transform: none; }
.receipt li .g{ width: 19px; height: 19px; border-radius: 50%;
                background: hsl(220 30% 100% / .1);
                border: 1px solid hsl(220 30% 100% / .34); }   /* matches the card seal */

/* the seal's ONE moment of attention — fires once on arrival, then rests forever */
@keyframes sealin {
  0%   { transform: scale(.4);   box-shadow: 0 0 0 0 hsl(220 30% 100% / .5); }
  55%  { transform: scale(1.15); box-shadow: 0 0 0 7px hsl(220 30% 100% / 0); }
  100% { transform: scale(1);    box-shadow: 0 0 0 0 hsl(220 30% 100% / 0); }
}
```

The seal pulse is the only animation the arrival earns: it marks the one thing the user did not ask
for. It must never become a persistent or repeating animation — the seal is *never* conditional on
run state, and dimming or moving it mid-run would delete the reading exactly when it matters most.

---

## What to Avoid

- **Never imply streaming.** Generation is one call; a progressive reveal that reads as live
  reasoning is a lie about an event that did not occur.
- **Never let the seal arrive unexplained.** That is the whole of SC#3.
- **Never put a review-state mark at `-left-2 top-1.5`** — it is the verdict mark's home.
- **Never build a template gallery on the Builder's first screen.** #19 already gave the library a
  home on the Workflows page; a gallery there is redundant, not merely cluttered.
- **Never identify a workflow by a single phase-type glyph.** A workflow is its spine (#36).
- **Never let a receipt become a blocker.** It is dismissible; the canvas is the product.

---

## Origin

Synthesized from sketches: **150** (winner B), **151** (winner C) — operator 2026-08-01.
MANIFEST running decisions **62** and **63**. Titles throughout come from **148-C**
(`node-vocabulary-and-reveal.md`); the ⛨ seal and one-way lock come from Phase 185
(`graded-governance.md`).
Source files: `sources/150-the-seeded-canvas-arrives/`, `sources/151-a-door-beside-the-describe-box/`

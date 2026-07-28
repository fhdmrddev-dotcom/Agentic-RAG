# Graded Governance — which steps must prove what they say

Synthesized from sketches **142** (the grounding dial and its lock, winner **B**) and **143** (seeing which
steps must prove it, winner **A**). Phase 185, GOVERN-01 / GOVERN-02.

---

## The model, settled before any pixel

Operator, 2026-07-28. **Grounding is DETECTED and ONE-WAY.**

- A step that reads the knowledge base switches itself to *must prove it* and **locks**.
- An open step can be **escalated** by hand.
- A locked step can **never** be loosened.
- **No exceptions.** The exploratory-reading case ("skim the board decks and suggest themes") is handled
  by *splitting the step in two* — a proven retrieval step feeding a free-to-think judgement step — never
  by a third "reads but exploring" state, which would put a named escape hatch inside the milestone's
  only differentiator.

### The rule that makes "not author-loosenable-away" precise

> **You can only undo a lock you created.**

| Cause | Author can remove it? | Implementation note |
|---|---|---|
| **detected** — a KB-reading tool is switched on | **No.** No switch exists in any variant | Removing the tool is the only exit |
| **already-set** — `citation_policy: "strict"` on the deliverable | No | The existing policy dial owns it, exactly as today |
| **escalated** — the author turned it on by hand | **Yes** | If detection later applies, detection wins and the undo disappears |

### The detection rule is a named list, never a judgement call

```js
const KB_TOOLS = ['search_documents', 'query_documents', 'read_document',
                  'analyze_document', 'get_related_documents']
```

If the rule were fuzzy nobody could predict when the lock appears, and **an unpredictable safety rail is
worse than none**. The list is the real `get_tools` registry.

### The exit is a lobotomy, not a loophole — and the copy must say so

Switching off the KB tool does not loosen the step; it stops the step reading your files at all. The
first draft's wording (*"turn that off if the step really should not be held to sources"*) framed that
as a reasonable alternative. It is not. **Name what it costs:**

> *"Reading your files is what this step is **for**, so it has to show where its answers came from. You
> can switch off **Search your documents** below — but that does not loosen the step, it stops it opening
> your files at all, and then it has nothing to find risks in."*

---

## 142-B — the dial is a switch that visibly refuses

**Winner: B over A** (operator: *"more user friendly with less reading; information is good but crowded
text also is not a good experience"*).

- A real two-position control on every step: `○ Free to think` ⇄ `⛨ Must prove it`.
- On a locked step the **loose side is struck through**; pressing it prints the reason **as real DOM
  text** in the panel, wired by `aria-describedby` — **never a `title`, never omitted** (the 184-07
  lesson).
- On a step where grounding cannot apply (a connector — it performs an action and makes no claim), the
  control is **absent, not disabled**. *A control that could never do anything is worse than none.*
- **A (a stated fact + a button whose only job is to refuse) stays on file** — it says more, in a wall of
  prose the reader has to get through before the point arrives.

### The tool list IS the dial

The panel's tool chips are the real control. Toggling a `⛨`-marked chip moves the whole governance state
live. Say it in-surface: *"Switching any of them on is what makes this step have to prove itself — this
list is the real control."*

---

## 143-A — the canvas mark is a sealed edge with a corner seal

**Winner: A over B.** Constraint that made this hard: sketch 137-B banked **all** colour for Phase 188's
run status, and the card face's **two word-badges are already committed**. So governance may spend
**neither colour nor a badge** — the mark must be made of **shape**.

Both variants **delete** the shipped `⛨ Must prove it` word-badge, freeing both slots for 188/189.

### The build rule the choice creates

> **The corner seal is the load-bearing mark. The edge is reinforcement.**

Verified live at all four run states: when a step goes *running* / *needs you* / *failed*, the
status colour **overwrites the border**, but the corner seal stays legible because it carries its own
background and border. The governance reading degrades from two carriers to one; it never disappears.

Two non-negotiables:

1. **The seal may never be conditional on run state.** It is the only carrier left mid-run — hiding,
   dimming or moving it deletes the reading at the moment it matters most.
2. **Top-right of the 137-B card is now CLAIMED.** Phases 188/189 may not take it. (Step number is
   top-left, the verdict mark sits outside the right edge.)

**B (a stitched rail outside the border, which survives run status intact) is the documented fallback**
if the seal alone proves too quiet in live use — a swap, not a redesign.

### Both channels survive a colour-blind read; run status does not

Neither mark is made of colour, so greyscale changes nothing. But with colour off mid-run, **run status
vanishes entirely**. That is Phase 188's problem, and the finding it inherits: **188 needs a shape of
its own, not just four colours.**

---

## VOCABULARY — binding

| Say | Never say | Why |
|---|---|---|
| **Must prove it** (on the canvas, at rest) | *Proven* | Nothing is proven until a run's citation gate passes. Calling an unrun step "proven" is the exact overclaim this milestone exists to prevent |
| **Free to think** | *Ungoverned*, *unchecked* | Judgement is not a gap. A step that weighs up already-proven facts makes no new factual claim |
| **Nothing to prove here** | *Not applicable*, *N/A* | Used for connectors and question-to-a-human steps |
| **traceable** (only at the review moment) | — | Legitimate in 145/146, where `check_coverage` has actually run |

---

## CSS patterns

### The sealed edge + corner seal (143-A)

```css
/* reinforcement — overwritten by run status, and that is accepted */
.node.proven { border-color: hsl(220 30% 100% / .34); }

/* THE LOAD-BEARING MARK — its own background and border, so a status-coloured
   card cannot erase it. Never make this conditional on run state. */
.node.proven .seal {
  position: absolute; top: 11px; right: 11px;      /* top-right is CLAIMED */
  width: 21px; height: 21px; border-radius: 50%;
  display: grid; place-items: center; font-size: 11px; z-index: 6;
  background: hsl(220 30% 100% / .1);
  border: 1px solid hsl(220 30% 100% / .34);
  color: var(--color-text);
}
.seal { display: none; }
.node.proven .seal { display: grid; }
```

### The switch that refuses (142-B)

```css
.dial { display: inline-flex; background: var(--color-muted);
        border: 1px solid var(--color-border); border-radius: 999px; padding: 3px; }
.dial button.on.grounded {
  background: hsl(142 71% 45% / .22); color: hsl(142 71% 74%);
  box-shadow: 0 0 0 1px hsl(142 71% 45% / .4);
}
/* refused, not hidden */
.dial button.locked { opacity: .42; cursor: not-allowed; text-decoration: line-through; }
```

```css
/* the reason is REAL DOM TEXT on the page — never a title attribute */
.refusal {
  margin-top: 11px; padding: 10px 12px; border-radius: 10px; font-size: 12px; line-height: 1.7;
  background: hsl(38 92% 60% / .1); border: 1px solid hsl(38 92% 60% / .34); color: hsl(38 92% 78%);
}
```

### The technical-name reveal must be a RULE, never an inline style

```css
/* `.techline` is display:none by default and the theme flips it on `body.tech`.
   An inline `display` leaks raw ids into plain-language mode — a real defect
   caught in 142 by asserting 0 visible technical strings in plain mode. */
body.tech .tool .techline { display: inline; margin-left: 5px; }
```

---

## HTML structure

```html
<!-- the governance block lives in the shipped 400px PhaseFormPanel (140-A) -->
<div class="sechd">How strictly this step is held</div>
<div class="gov grounded">
  <div class="dial" role="group" aria-label="How strictly this step is held">
    <button type="button" class="locked" data-dial="free"
            aria-disabled="true" aria-describedby="whybox">○ Free to think</button>
    <button type="button" class="on grounded" data-dial="proves">⛨ Must prove it</button>
  </div>
  <div class="gw">Because this step reads your documents.</div>
  <div class="attached">🔒 Before this step is accepted, everything it says is checked against your
    documents. Anything it cannot back up fails.</div>
  <div class="refusal" id="whybox"><!-- populated on a refused press --></div>
</div>
```

---

## What to avoid

- **A free two-position toggle both ways.** Then "not author-loosenable-away" has to be enforced
  somewhere else entirely, and every ungoverned KB step stays ungoverned until a human notices it.
- **A third "reads but exploring" state.** A named escape hatch inside the differentiator.
- **Spending a third badge or any colour on governance.** Both budgets are committed (137-B / 188).
- **Calling an unrun step "proven".**
- **Putting a refusal reason in a `title` attribute.** It must be readable DOM text.
- **Disabling a control that could never do anything** — remove it instead.
- **Designing a grandfathering / backfill affordance** for existing workflow rows. Every row in the
  database is throwaway test data; detection simply applies.

---

## The number that argues the phase

Live corpus, 2026-07-28 — 133 `workflow_definitions` / 170 phases: **84 phases carry a KB-reading tool,
48 are strict.** So **36 steps read your documents and cite nothing.** Use this as evidence about the
engine — never as user data to protect.

## Known gap the requirement asserts but the engine does not have

GOVERN-01 says "`citations_required` **+ confidence gate**". `grep -rn confidence
backend/app/services/harness/ backend/app/models/harness.py` returns **nothing**. The shipped
`citations_required` validator is deterministic coverage (`check_coverage` — an uncited or
invented-citation leaf fails), **not a threshold**. Phase 185 either adds a real confidence field (new
scope) or the word leaves the requirement. **Decide at spec time.**

---

## Origin

Synthesized from sketches: **142**, **143**.
Source files: `sources/142-grounding-dial-and-lock/`, `sources/143-proven-on-the-canvas/`.

---
sketch: 163
name: the-assembled-card
question: "What exactly ships — and what mechanism keeps the build from drifting away from it?"
winner: "assembled (pending the one open toggle)"
tags: [phase-192.1, lib-05, acceptance-bar, build-contract, anti-drift, card, fork-dialog, g2-sketch-gate]
---

# Sketch 163: The assembled card

> **This sketch exists for two reasons.** The operator picked **160-B · 161-A · 162-B**, and those
> picks (a) *disagree at one edge*, and (b) had no single artifact saying what the composed result
> looks like. Reason two is the operator's standing note that **the shipped shape always drifts from
> the sketched one.** This is the answer to both: one surface that IS the acceptance bar, plus a
> machine-generated contract so the build imports the design instead of paraphrasing it.

## Design Question

> What exactly ships — and what mechanism keeps the build from drifting away from it?

## How to View

```
open .planning/sketches/163-the-assembled-card/index.html
```

Three tabs: **The assembled card** (the bar) · **Today (shipped)** (the delta) · **Anatomy & exact
strings** (the contract, on screen).

Open a `⋯` menu and click **Make my own copy** to drive 162-B's prompt.

## ⚠ The one edge your two picks disagree about — and it is the last open question

- **160-B's argument was restraint:** the 13 rows whose name is already unique get **no strip at all**.
- **161-A puts a line on every card.**

They answer different questions — *what content* vs *where it goes* — but they collide on singletons.
The assembled card resolves it as **quiet**, and the reasoning is in the toolbar so you can overrule
it by looking:

| Row | Identity line |
|---|---|
| Colliding name | `Yours · Copy of Compliance Gap Report starter · [1 of 43] · changed 2 months ago` |
| Unique name, is a fork | `Yours · Copy of Access Review Attestation · changed just now` |
| Unique name, not a fork | `Shared · changed 5 months ago` |

A unique-name row keeps the **line** (so placement stays consistent — A's reason for winning) but
carries **no discriminator segments** (so information is only spent where it buys something — B's
reason). Flip `singleton line` → **absent** in the toolbar and look at *Board Minutes Formatter*.

**Whichever you pick becomes a recorded decision, not an executor's judgement call.** That is the
point.

## The identity line — the exact grammar

```
[own pill] [computed seg] · [computed seg] [1 of N] · changed <rel>
```

- **Segment priority when the name COLLIDES** (first two that vary win): `lineage → project → state → version`
- **When the name is UNIQUE:** no discriminator segments; lineage only if the row is a fork
- **Max 2 computed segments, always** — driven and asserted, not a guideline
- `1 of N` appears **only** on a colliding name

## ⚠ 162-B reopens D-15 — picking it is a recorded decision

D-15 made the fork a **direct flip** because a confirm on a non-destructive, reversible action *spends
the guard vocabulary the delete relies on* (`WorkflowCard.tsx:84-87`). 159-C's confirm was
deliberately not shipped.

**The working rationale for why this prompt is not that guard:** it *collects something the system
cannot know*, so it is an **input, not a guard**. The design carries that claim mechanically rather
than in prose — the prompt asks for a **name** rather than a confirmation, wears **no destructive
styling**, and its primary button is **"Create my copy"**, never "Confirm". The drive asserts that
last one.

**This rationale must be recorded as a decision at plan-phase, and D-15 amended in the same commit** —
never left silently contradicted.

**What the prompt deliberately does not do:** it **warns and never blocks** on a colliding name. A
name you chose is a name you are allowed to have; blocking would make the library's problem the
user's fault. It is also the natural home for the **409** — a name field can surface a slug collision
*before* the request, retiring WR-08's substring-matching of error prose
(`WorkflowsPage.tsx:165-167`). **Scope that deliberately at plan time; it is not free.**

## The delta this phase makes, in full

| | Today | Assembled |
|---|---|---|
| Atoms per card | 13 | **14** |
| Identity lines | 0 | 107 / 107 (quiet) or 94 / 107 (absent) |
| Sentence nodes | 1 | **1 — unchanged, same text** |
| Soul atoms | 5 | **5 — consumed unchanged** |
| Net-new test hooks | — | **1** (`row-identity`) |
| Net-new wire | — | `updated_at` (additive projection) |

**One line, and a prompt on one verb.** That is the whole phase.

---

# The anti-drift mechanism

The operator's note: *"I always see a difference between the sketch we do and the actual
implementation."* That is true here, and the cause is mechanical rather than carelessness:

1. The sketch is **HTML/CSS**; the build is **React + Tailwind + shadcn**. Nothing transfers
   automatically, so every string, DOM order and spacing is **re-typed by an executor reading prose**.
2. **Prose does not typecheck.** This codebase has banked that lesson repeatedly — a wrong pointer in
   a docblock survived every gate in Phase 189 for exactly this reason.
3. Plans are written from RESEARCH and CONTEXT, **not from the sketch**, so the mockup becomes a
   reference nobody diffs against.

Three artifacts close it, and all three are in this directory:

### 1. `BUILD-CONTRACT.generated.md` — generated, never transcribed

Emitted **from the running sketch** by `drive.cjs --emit`. It carries every exact string, every
composed string with a worked example, the rendered identity line for each distinct row shape, and
the measured invariants at 107 rows. Regenerate any time:

```bash
node .planning/sketches/163-the-assembled-card/drive.cjs --emit
```

If the sketch changes, the contract changes with it. It cannot go stale by being forgotten.

### 2. `drive.cjs` — the assertions the build's own suite must reproduce

The 30 checks in this file are not sketch housekeeping; **they are the contract in executable form.**
Each one has a direct React equivalent, and the phase's test suite should assert the same things
against the real component:

| Sketch assertion | What the build must assert |
|---|---|
| exactly 1 sentence node per runnable card, 0 on drafts | same, on `WorkflowCard` |
| the sentence text is **unchanged** from shipped | import `FORK_CONSEQUENCE`, never retype |
| never more than 2 computed segments | same, over the rendered line |
| `1 of N` only on colliding names | same |
| identity line at **DOM position 2**, above the folder chip | same, by child order |
| all 5 soul atoms survive on every card | same |
| no draft exposes a Run affordance | **already shipped** — keep it green |
| the two fork testids stay distinct | **already shipped** — D-12's only mechanical evidence |
| no owner display **name** anywhere | same — Yours/Shared is the honest ceiling |
| zero hover-only tooltip attributes | **already fenced** by `librarySubtree.fences.test.ts` F1 |
| the fork prompt's primary button is not "Confirm" | same — it is what makes B an input, not a guard |

### 3. The strings live in ONE table, in the sketch and in the build

`163/index.html` declares every string in a single `COPY` object and renders nothing that is not in
it — the same shape as the shipped `libraryVocabulary.ts`. **The build should port that object into
`libraryVocabulary.ts` and import it**, so a copy change is a one-line diff in one file rather than a
hunt through JSX. Two strings are already shipped constants (`FORK_VERB`, `FORK_CONSEQUENCE`) and the
sketch reads them from the fixture rather than re-typing them — **proof the mechanism works**, since
a drifted copy of either would have failed the drive.

### What this still cannot catch, said plainly

Pixel-level spacing, Tailwind class choices and hover/focus states are **not** covered by any of the
above — the sketch's CSS is hand-written and the build's is utility classes. Those remain a human
comparison at UAT, against this sketch, at 107 rows with the duplicate shape. **The G-4 rows for this
phase should name this file as the reference.** And per the lesson Phase 192 banked: drive them the
way a person does — **by looking**, never by `getElementById` on a known UUID.

## Verification

`node --check` plus a headless JSDOM drive: **30/30 pass**. Driven, not asserted — 107 cards with all
five soul atoms; identity lines proven **computed** (>20 distinct renderings, never templated); the
2-segment cap and the `1 of N`-only-on-collision rule both measured; DOM position 2 asserted by child
order; the singleton toggle proven to change only unique-name rows; the fork prompt opens, gates on an
empty name, **warns without blocking** on a collision, states the consequence verbatim, creates under
the typed name, and Escapes without creating.

The `[title]` fence carries a **positive control**. jsdom's unimplemented `window.scrollTo` is
excluded by name. One check documents its own contamination honestly — the "today" tab asserts
**108** cards, not 107, because the 162-B test really did create a row, and it is pinned at the exact
expected number rather than loosened to `>=`.

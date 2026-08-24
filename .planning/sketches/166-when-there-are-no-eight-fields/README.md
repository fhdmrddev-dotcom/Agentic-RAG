---
sketch: 166
name: when-there-are-no-eight-fields
question: "The read came back and it wasn't a list. Does the screen still let the author believe their draft is built to their template — and where should the truth live?"
winner: "B — the footing line (2026-08-14, operator). A rejected because silence is SEED-157 recurring WITH a control on screen; C rejected on COST, not clarity — it reopens the CTA settled three weeks ago as variant D of sketch 164. A and C stay as evidence."
tags: [phase-193.1, auth-03, template-first, honesty, seed-157, seed-158, seed-159, generated-from-build]
---

# Sketch 166: When there are no eight fields

> Companion to sketch **165**. 165 asks where the template goes and how its fields
> become a spec; 166 asks what happens on the four arms where **there is no spec** —
> which, per `SEED-158`, is the *common* real-world case.

## How to view

```
start .planning/sketches/166-when-there-are-no-eight-fields/index.html
```

Five tabs: **A · Silence (what you get free)** · **B · The draft states its footing** ·
**C · The button says it** · **The five shipped sentences** · **The contract**.

Verified at 1440×900: no horizontal scroll, all five arms render in each variant strip,
variant B carries five distinct footing lines, variant C re-words the CTA on exactly the
four arms where it should and leaves `loading` alone. One console message, benign: the
`file:` origin notice.

## The question, stated so it cannot be misread

**The five shipped sentences are not under review.** Each arm below is the *real*
`TemplateAttachSection` rendered in that exact reading state. Those sentences are honest,
they are exported identifiers, and two of them carry a docblock warning that they may
never merge. This sketch does not change a character of them.

**The question is what the *draft* says about itself.** Today the answer is *nothing*:
the fields region reports on the template and falls silent, and generation proceeds
exactly as it would with no template at all. That is `SEED-157`'s defect recurring **with
a control on screen** — strictly worse than not having the control, because the author has
now been shown a sentence about their file and has no way to know the draft ignored it.

## The five arms — real branches, not invented states

| arm | server answered | what it means |
|---|---|---|
| `fields` | `ok`, 8 keys | we opened it and it asks for these eight things |
| `loading` | in flight | we are still opening it |
| `none` | `ok`, 0 keys | **⚠ `SEED-158`** — we opened it and it has no fill-in fields. A client template written in plain language, no `{{ }}` tokens. **The common case.** |
| `not-word` | `ok`, 0 keys **and** a non-`.docx` filename | the same server answer through a different sentence — the parser reads Word only, and two of the three accepted upload types land here |
| `unavailable` | `unreadable` / unreachable | **⚠ we never opened it.** Says nothing about the document. |

## The variants

| | Approach | Cost |
|---|---|---|
| **A** | **Silence.** Every arm renders its honest sentence about the document; nothing says what will be generated. The button reads `Write the first draft` in all five states and means something different in each. | Free — this is what 165's variants give you with no extra decisions. **Judge it honestly: if A is acceptable, the phase gets smaller.** |
| **B** | **The footing line.** One line under the fields region, always present, taking a different value on every arm — never merging the two that may not merge. | Five new strings. The button is untouched, so nothing settled by sketch 164's variant D moves. |
| **C** | **The button says it.** The CTA itself changes: *"…to these 8 fields"* vs *"…from your description"*. | **Reopens a governed string** the operator settled three weeks ago, and makes the button's width depend on a number read out of a document. |

## What to look for

1. **Tab A, the full-screen `none` stage.** The author attached exactly the right file —
   their client's real weekly-report template. Read the screen as they would and ask what
   they now expect to happen. That gap is the whole phase.
2. **In B, compare `none` against `unavailable` directly** (both have full-screen stages).
   The consequence for the draft is identical; the fact about the world is not. If the two
   sentences start to sound interchangeable, B has broken the rule the shipped code
   protects one level up.
3. **In C, watch the bar under each cell rather than the section above it.** A button that
   changes its own verb is either the clearest thing on screen or reads as two different
   actions. That is the judgement, and it is not a copy question.
4. **The count in `footing.fields` and `cta.toFields` is derived, not typed.** In build it
   must come from the list rendered above it. An `8` beside a list of 5 is the exact class
   of silent lie this phase exists to remove.

## ⚠ The open question this sketch does NOT settle

**The `loading` arm is a race, and it is real.** Nothing today prevents the author pressing
**Write the first draft** while the read is still in flight — in which case the generate
call goes out with no `template_placeholders` and produces exactly the blind draft this
phase exists to prevent, on a screen that just told them a template was attached.

Three plausible answers, **none drawn here**:

- **disable the button while reading** — honest, but blocks the fast path on a slow request
- **let the draft wait for the read** — invisible, but a spinner appears where none did
- **let it through and say so afterwards** — cheapest, and pushes the problem into 167

**This belongs in `193.1-CONTEXT.md` as a decision, not smuggled inside a chosen variant.**

## The mechanism, and the fence that was driven RED

Same inverted arrow as 164/165: `dom.generated.json` is the real rendered DOM; every
variant is that DOM with one block spliced at one asserted anchor.

**The pairwise fence is this sketch's own safety net, and it was proved rather than
asserted.** `build.cjs` checks that every arm renders its own testid *and none of the other
four* — the mechanised form of the shipped docblock's *"these two sentences may never
merge"*. It reports **22 assertions, 0 failing**.

It was **driven RED against a real plant**: injecting `template-fields-unavailable` into
the `none` dump produced

```
ASSERTION FAILURE [arm 'none' does NOT render arm 'unavailable's node] — found 1
ASSERTION FAILURE [no arm renders any other arm's node] — found 20
EXIT=1
```

and the dump was restored to green. A fence nobody has seen fire is a fence nobody knows
is connected.

Reproduce the whole chain:

```bash
cp .planning/sketches/166-when-there-are-no-eight-fields/emit.test.tsx.src \
   frontend/src/components/workflows/__emit166.test.tsx
cd frontend && npx vitest run src/components/workflows/__emit166.test.tsx && cd ..
rm frontend/src/components/workflows/__emit166.test.tsx
node .planning/sketches/166-when-there-are-no-eight-fields/build.cjs
# tailwind: -c a copy of frontend/tailwind.config.js whose `content` is body.generated.html
node .planning/sketches/166-when-there-are-no-eight-fields/assemble.cjs
```

## What has no mockup here

| Surface | Settled in |
|---|---|
| where the attach control lives and how a *successful* read is presented | sketch **165** |
| a template attached to an already-drafted workflow, and the mismatch (SC#3) | sketch **167** |
| what a *run* does when a field finds no evidence — the blank that lies | **`SEED-159`**, not this phase |
| authoring placeholders INTO a plain template | **`SEED-158`**'s own proposal — a capability, not a copy fix, and out of scope here |

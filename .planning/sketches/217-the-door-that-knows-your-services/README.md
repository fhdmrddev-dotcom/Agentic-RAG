---
sketch: 217
name: the-door-that-knows-your-services
question: "How does the describe door refuse a service the author named but never connected — and does the refusal point at the words that caused it?"
winner: null
tags: [phase-214, step-06, seed-208, describe-door, refusal, door-vocabulary, g-2]
---

# Sketch 217 — The door that knows your services

**Written 2026-08-28.** One of four G-2 acceptance bars for Phase 214. Step 1 (direction) is
`.planning/sketches/214-stitch-step-names-service-and-action/` screen `09`.

```
node drive.cjs           # 179 assertions
node drive.cjs --emit    # regenerates BUILD-CONTRACT.generated.md FROM the running sketch
```

Current state: **179 passed, 0 failed · 6 doors (2 at rest, 4 refusing) · 9 service chips ·
6 refusal sentences · 4 anchors.**

---

## Variants

| tab | what it is |
|---|---|
| **A · picker first** | D-214-20's services picker + D-214-21's refusal. Honest, but the refusal floats free of the sentence that caused it. |
| **B · picker first + the anchor** | ⭐ **The one thing the stitch pass did not have.** The service name in the author's own prose is marked, and the refusal is about *that*. |
| **§3 · the five states** | At rest (⛔ refusing nothing) · ready · nothing connected · two services missing · **both reasons at once**. |
| **§4 · what the picker prevents** | The 03:00 failure, step by step, with and without it. |

---

## 1 · ⭐ The shipped shape this reuses, rather than inventing

```
DESCRIBE_CTA          = "Write the first draft"
DESCRIBE_CTA_REFUSED  = "Too thin to draft"
DESCRIBE_REFUSAL      = "There is nothing here to draft from yet — describe the work in a sentence."
```

⚠ **The door already draws its disabled control carrying its reason** — that *is* what
`DESCRIBE_CTA_REFUSED` is (`doorVocabulary.ts:364`). Stitch arrived at the same idea independently
(*"Waiting for connection"*), which is **a confirmation, not a discovery**.

So the new refusal is **a second arm on one mechanism**, never a second mechanism beside it, and
`COPY.js` carries the three shipped strings so the suite can assert they are **untouched**.
Rewording a governed literal Phase 187 settled is what D-13 and the 166-C precedent already
declined, twice.

**And the two reasons do not compete.** §3 state 3 shows an empty box with nothing connected, and
the CTA reads the **thinness** reason — a workflow with no external step is perfectly legitimate, so
naming the connection there would refuse for a reason that is not binding. §3 state 5 shows both at
once and the CTA still picks thinness, because that is the one that would still hold if Salesforce
were connected this second.

---

## 2 · The gap in Stitch's `09`, and how B closes it

> **Nothing tied the refusal to the words that caused it.** "Salesforce" appeared in the sentence at
> the top and again in the refusal at the bottom, with no thread between them — so the refusal read
> as being about *the workflow* rather than about *something the person wrote*.

B marks the service name **in the author's own sentence** and labels the mark *why this stopped*.

⚠ **The mark is an underline, not a highlight.** A filled block behind running text at headline size
reads as *an error in the sentence* — and the sentence is not wrong; it names something the account
does not have. ⚠ It spends **warning**, never `--color-danger`: naming a service you have not
connected yet is an ordinary thing to do, and `drive.cjs` asserts the whole door spends no
destructive colour.

⚠ **The anchor tag is visible while the door refuses, not only on hover.** Hover-only is a tooltip,
and a tooltip is a thing a keyboard and a phone never see — the same reason the house fence forbids
copy in a `[title]`.

### ⚠ What B costs, and the rule that bounds it

Marking a span in free prose means **finding the service name by matching**, and a match can be
wrong. **A mis-anchor is worse than no anchor**, because it claims a precision the system does not
have.

**The safe rule, which a plan choosing B must carry:** mark only an exact, case-insensitive
**whole-word** match against a catalog name, and **fall back to variant A's unanchored refusal**
when there is no unambiguous single match. Without that fallback, B ships a guess wearing a mark.

---

## 3 · ⛔ The assertion that matters most is a negative one

**The refusal must not render at rest.** `doorVocabulary.ts` states this as a **mechanical**
requirement rather than a taste one: an untouched empty box is refused by the same rule, and
captioning *that* would put a red sentence on the first screen an author meets before they had done
anything at all — and `WorkflowDoorSwitch.baseline.test.tsx` pins **all six resting states byte for
byte**.

The sketch proves the gate by **having both on one page**: `drive.cjs` asserts at least two doors are
at rest and at least two are refusing, rather than asserting a CSS rule nobody exercises. The
toolbar's *toggle refusing* flips every door so the resting state can be checked by eye.

---

## 4 · D-214-20 — the grant grain is the vocabulary grain

The generator's vocabulary **is** the ticked set, so a step naming an unconnected service is
**structurally impossible** rather than caught afterwards.

⚠ **Post-draft validation alone was rejected** because it is a *model-behaviour* guarantee — it
depends on the model, or a checker, noticing. The failure it must prevent is precisely *"an invented
step that validates and fails at 03:00"*, and §4 walks both paths side by side. **Step 3 of the
without-picker path is the whole problem:** the step reached publication *having validated*.

⭐ **Granted tools, not merely discovered ones** — which is exactly why STEP-06's stated dependency
is Phase 213.

**DeepWiki is drawn as connected-but-ungranted:** present, not selectable, saying *"Nothing allowed
yet"* with *"Choose what it can do"* beside it. ⚠ **Hiding it would leave an author wondering where
a connection they made went**, and an absent control is indistinguishable from one that does not
exist. `drive.cjs` asserts it is rendered, never pre-selected, and not `display: none`.

---

## 5 · The refusal offers two real next actions — and a third was rejected

*"A refusal is only honest if it names the next action"* — the ROADMAP's own words. This one names
**two**: one leaves for Settings and comes back, one stays here. `drive.cjs` asserts **exactly two**
per refusal, that one connects the named service, and that one is `Revise the description`.

⚠ **A third arm — connecting the service inline, without leaving the door — was rejected under
D-214-21.** A connection is a **credential**, and a credential form on a drafting screen is a new
outbound trust surface with no prior review cycle. The drive fences it: no password field, no api
key, no token input anywhere on the door.

⚠ **And the refusal drafts nothing** — no partial workflow, no *"we removed that step for you"*.

---

## 6 · ⚠ One thing in `drive.cjs` that is a finding

**The first draft of the refusal fence asserted *"every refusal names a service"* — and it fired on
the shipped thinness refusal, which correctly names none.** A fence that cannot tell two arms of one
mechanism apart would have pressured the sketch into making a governed shipped string name something
it must not. Every `.dr-text` now carries `data-kind`, the fence asserts per kind, and it separately
asserts that **no sentence is unlabelled** — so a third kind added later cannot slip past by
default.

---

## 7 · What this sketch does not cover

- **The argument form** → 214. **Publish's refusal** → 215. **Run surfaces + the pause** → 216.
- **How the draft that follows a successful pick is reviewed** — Phase 197's draft-arrival surface,
  unchanged by this phase.
- **Connections in chat** — Phase 216 (the milestone's, not this sketch's). The describe door is a
  workflow-authoring surface; a connected service reachable by name in a thread is a separate
  criterion.

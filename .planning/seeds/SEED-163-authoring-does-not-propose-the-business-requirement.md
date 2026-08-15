# SEED-163 — NL authoring writes the whole workflow but leaves the one field that blocks publish blank

**Planted:** 2026-08-15, by the operator during Phase 193.1 end-to-end UAT
**Surface:** Agentic-RAG — workflow authoring (describe door) → publish gauntlet
**Status:** folded → **Phase 193.2 From Authored to Runnable** (context gathered 2026-08-15, `4d1d9374`;
**EXECUTED and DRIVEN 2026-08-15 — see the two dated blocks at the foot of this file.
DELIVERED ON A REAL RUN (UAT `193.2-UAT.md` U1 moment 1, PASS), with ONE SLIVER OWED: the
requirement's DURABLE half is measured, and the VISIBLE mark rests on a general confirmation rather
than a specific observation. Not flipped to a bare `closed` for that reason, and because the claim is
a MEASURED REDUCTION and never an absence.**)

**Re-open trigger:** the requirement arrives blank on a real describe→generate cycle again (the fix is
a frequency, not a guarantee — measured 20/20, and 21 would not make it one); **or** the AI-proposal
mark is read as a claim that the requirement is *durable* rather than that *a model wrote it* (it
cannot see durability — measured, `gpt-5.5` named one-run parameters in 5 of 5 requirements and all
20 were still correctly stamped); **or** a third instance of the D-22 pattern appears beyond the three
already recorded, in which case **the pattern is the phase, not the field** — that inheritance is
carried forward to **197 / AUTH-02**.

⚠ **Folded, with two of this seed's own rules carried through verbatim into `193.2-CONTEXT.md`
rather than paraphrased:** the field arrives **pre-filled and visibly marked as an AI proposal**
(D-06, reusing 187's `name_seeded_by_ai` provenance shape), and the proposal must be the **durable**
requirement, never a copy of the describe text (D-07). ⚠ **The publish gate is NOT changed** — an
AI-seeded value passes stage 1 untouched, and pressing Publish is the consent (D-09). ⚠ Measured
while scoping: `WF_SCHEMA` is `WorkflowDefinition.model_json_schema()`, so **the emit tool already
advertises this field** — no schema work; the prompt is the entire gap. The **three-instance
pattern** this seed predicted is now recorded for 197 (D-22): `SEED-157`, this seed, and the
AI-chosen workflow **name** (deferred to 197 as D-24).

---

## What happened

The operator uploaded a knowledge base and a `.docx` template, described a Quarterly Business
Review workflow, and the AI authored a five-phase definition from that description. They then
could not publish it, because **`business_requirement` was empty and they had to type it by
hand** — restating, in a second field, what they had already written in the describe box.

Their words: *"we are describing to the AI and the AI creates the workflow, but then I have
again manually to enter the business objective."*

## Measured, not assumed

- `WorkflowDefinition.business_requirement: str | None = None` (`backend/app/models/harness.py:538`)
  — free text, no format constraint.
- **`backend/app/services/workflow_authoring.py` never sets it.** `grep -c business_requirement`
  over that module returns **0**. The emit produces phases, not this field.
- The publish gauntlet blocks on it at **stage 1**, returning 400
  (`backend/app/services/harness/publish_service.py:7,77`), via the shared predicate
  `business_requirement_missing` (`grounding.py:1007`).
- The author-facing string is `BUSINESS_REQUIREMENT_MISSING_MESSAGE` (`grounding.py:1000`):
  *"Add the Business requirement — one line saying what this workflow must deliver — before
  publishing."*

## Why this is a MOVED gap, not a new one

The same docblock records `BUG-260809-02`: the message used to read *"a workflow must declare
exactly one business_requirement before publish"* — **naming an internal snake_case field at a
user who had nowhere to type it.** The fix added the control and rewrote the copy to point at
its label.

⚠ **But the fix addressed discoverability, not redundancy.** The control now exists and is
findable; the author is still asked to author the same intent twice. **The gap moved one step
down the funnel rather than closing.** That is worth stating plainly, because a future reader
looking at `BUG-260809-02`'s closure would reasonably assume this was handled.

## Why it is small

The authoring service **already receives the `describe` text** — it is the sole input to
`generate_workflow_definition`. A one-line business requirement is strictly less inference than
the five phases it already emits. The natural shape is **propose, don't decide**: the emit
returns a suggested one-liner, the field arrives pre-filled, and the author edits or replaces it.

## What NOT to do

- ⚠ **Do not silently copy `describe` verbatim into `business_requirement`.** They are different
  things — `describe` is a task instruction (*"produce a QBR for Northwind covering Q3"*), the
  requirement is a durable statement of what the workflow must deliver for **any** run
  (*"produce a client-ready QBR for a named account from our own records"*). A verbatim copy
  would bake one run's parameters into the workflow's definition of done, and the publish
  gauntlet's later stages read this field.
- ⚠ **Do not auto-publish off an auto-filled field.** The publish gate is a human checkpoint by
  design; pre-filling it must not also satisfy it. The author still presses publish.
- ⚠ **The field must stay editable and must not become derived-only** — a workflow's stated
  purpose is the one thing an author should always be able to overrule.

## Re-open trigger

**Fold this into the next phase that touches NL authoring or the describe door** — currently
**197 / AUTH-02** (*deepen the fast door*) is the likeliest home, since it is already scoped to
that surface. If a user reports the double-entry again before then, that is corroboration and
raises it from friction to a defect.

## Related

- `BUG-260809-02` — the ancestor: no UI set the field at all.
- `SEED-157` — the same shape one field over: `/generate` accepted `template_placeholders` for
  five phases and the frontend never sent it. **Both are cases of the authoring path not
  supplying something it already had.** If a third appears, the pattern is the phase, not the field.

---

## ⚠ RE-ROUTED 2026-08-15 — OPERATOR INSTRUCTION. This does NOT wait for 197.

> *"the two that we documented for business requirement and also the stop-and-ask-user are
> blocking actually and we should include in the earliest phase possible."*

The original routing sent this to **197 / AUTH-02** on the grounds that it is the phase already
scoped to the authoring surface. **That reasoning was about tidiness of scope, not about the
user's ability to use the product**, and the operator has overruled it after hitting both walls
in a single sitting on the phase's own headline path.

**The corrected routing: earliest available phase.** These two, together with `BUG-260815-02`
(a just-published workflow is unfindable), form one coherent piece of work — **everything
between "the AI wrote my workflow" and "I can actually run it and find it again"**. They
share a single root, which is the reason to fix them together rather than in three places:
**the authoring path makes decisions the author is never shown, and does not know what the
publish gate requires.**

⚠ **Sequencing note for whoever plans it:** 197 / AUTH-02 (*deepen the fast door*) remains the
right home for the BIGGER authoring redesign. Moving these three out does not empty 197 — it
removes the blockers from in front of it, so 197 can be about depth rather than repair.

---

## ⚠ CLOSE-OUT AT PHASE 193.2 (2026-08-15) — what shipped, and what it does and does not claim

**Status stays `folded`, not `closed`, and the reason is a measurement rather than caution.**

### What shipped

| Half | Where | What |
|---|---|---|
| **The ask** | `AUTHORING_SYSTEM_PROMPT` (`193.2-05`) | `business_requirement` joined the **existing** sentence that already sets `slug`, `version`, `name` and `status` — *"ONE line saying what this workflow must deliver on ANY run, phrased so it stays true for the next run and the one after, NOT a restatement of the particular request described below."* **`grep -c business_requirement` over the authoring module returned `0` before this — the whole of this seed in one number — and returns `5` after.** No schema work was needed: `WF_SCHEMA` is `WorkflowDefinition.model_json_schema()` and the field was already advertised |
| **The durable provenance** | `WorkflowDefinition.business_requirement_seeded_by_ai` (`193.2-07`) | An additive-optional `bool = False` on a JSONB column — **zero migration** (112 files before and after), `extra="forbid"` **proved not relaxed**, no validator and no computed field (a derivation would be baked into the JSONB and a stale row could lie about itself) |
| **The stamp** | `workflow_authoring.py` (`193.2-07`) | Server-side, after validation, on the single success path, a **sibling** `model_copy` beside the shipped 187 `name_seeded_by_ai` one so both stay independently attributable. It **refuses an empty value** (this seed's own carried rule: *provenance for a value that does not exist would make the demote-on-edit rule read a lie*) **and refuses a normalised copy of `describe`** (D-07), and it **ignores the model's own provenance claim in both directions** |
| **The visible mark** | `WorkflowBuilderPage.tsx` + `builderStore.ts` (`193.2-09`) | One gated sibling **inside** the shipped requirement affordance: the label **`AI-proposed`**, explained by its `title`. **No glyph — the word carries it** (`icon-convention.md` §4; `✦` refused). The flag is cleared on **ANY** edit, in the **same `set()`** that writes the text, with **no client-side "is this still the AI's sentence?" comparison** |

**D-09 honoured: the publish gate is NOT changed.** Stage 1's `business_requirement_missing` only
checks non-emptiness, so an AI-seeded value passes it untouched — **accepted**, because the author
still presses Publish, which this seed names as the human checkpoint, and D-06's visible mark is what
makes that an honest trade rather than a silent weakening.

### What it claims — and the sentence that binds it

**Measured over 20 real paid generations (`193.2-FREQUENCY.md`): `business_requirement` non-empty
20/20, stamped `seeded_by_ai` 20/20, against a pre-fix baseline of 0/N.**

> *"The claim is a reduction, not an absence — the publish gate stays because a prompt cannot guarantee absence."*

**D-08's fallback is today's EXACT behaviour:** when the model emits nothing, the field is blank and
the shipped `REQUIREMENT_INVITATION` shows. No second derive call, no schema-required field, no new
string, and **no server-side substitute text** — a blank that lies is not an improvement.

### ⚠ The finding this seed should carry forward: the mark cannot see durability

D-07 asks for the **durable** requirement. Measured on the `kit10` arm: **anthropic named a one-run
parameter in 0 of 5** requirements; **openai in 5 of 5** (*"…for customer Northwind Logistics covering
Q3 2026…"* — one run's parameters baked into the workflow's definition of done, precisely what D-07
asks against). **All 20 were still stamped `seeded_by_ai: True`, and that is CORRECT rather than a
bug** — the stamp's question is *"is this a normalised copy of the describe text?"*, and `193.2-07`
explicitly rejected a fuzzy similarity metric because a threshold would refuse provenance for
requirements that are genuinely durable but share vocabulary with the describe box, which is the
ordinary case.

⇒ **The AI-proposal mark means "a model wrote this". It NEVER means "this is durable."** No copy
anywhere may imply the latter, and an author reviewing an openai-authored requirement has something
real to edit.

### ⚠ The D-22 three-instance pattern, recorded for 197 rather than left to be re-derived

This seed predicted that if a third *"the authoring path did not supply something it already had"*
appeared, **the pattern is the phase, not the field.** There are now three:

1. **`SEED-157`** — `/generate` accepted `template_placeholders` for five phases and the frontend
   never sent it.
2. **`SEED-163`** (this seed) — the emit tool **advertised** `business_requirement` and the prompt
   never asked for it.
3. **The AI-chosen `name`** the author never gets to set — deferred as **D-24** to **197 / AUTH-02**,
   with `ForkNameDialog.tsx` (192.1) named as the asset when it is taken up. Re-open trigger: 197, or
   a report of a wrong AI-chosen name reaching a client.

**197 / AUTH-02 inherits this as a MEASURED pattern rather than re-deriving it** — the same habit the
hot-file ledger keeps, and the answer to the standing lesson that a deferral living in one phase's
context file is exactly as invisible as a hot file missing from that table.

---

## ✅ DRIVEN 2026-08-15 — the seed's ask is delivered on a real run, and ONE sliver is owed

**`193.2-UAT.md` U1 moment 1 — PASS.** Definition `93a86e21` (slug `northwind-qbr-fa65a43c`), the
same sitting that produced run **`b021c7b0`**. The field the operator previously had to type by hand
arrived written:

> *"Produce a quarterly business review document for a named customer and quarter, filling the QBR
> template from knowledge-base evidence on usage, support, meetings"*

| Property | Observed |
|---|---|
| Populated before the operator typed anything | ✅ — **the whole of this seed's ask** |
| **An echo of the describe text?** | ❌ **NO** |
| `business_requirement_seeded_by_ai` | **`true`** |
| `assets[]` carries the bound template | ✅ (193.1's auto-bind, unaffected) |
| `name_seeded_by_ai` on the phase | `true` |

⚠ **THE ANTI-ECHO PREDICATE EARNED THE MARK RATHER THAN DEFAULTING TO IT, and that is the finding
worth keeping.** `193.2-07` refuses provenance for a normalised byte-copy of the describe text
(D-07), and it was driven RED against four plants — but a predicate that never sees a near-copy in
the wild has only ever been exercised against synthetic ones. Here the model produced a genuinely
**durable** requirement (*"for a named customer and quarter"*, not *"for Northwind, Q3"*), the
predicate said so, and **the mark means what it claims on this row.**

⚠ **THE SLIVER, RECORDED RATHER THAN ROUNDED UP.** The operator confirmed *"I think all pass"*
broadly and **did not specifically confirm the VISIBLE mark on screen.** So:

- **the DURABLE half is MEASURED** (the value, its shape, and the stamp, all read off the definition);
- **the VISIBLE half rests on a general confirmation**, and `193.2-09`'s own summary had already
  flagged that its mark shipped with **no browser UAT** — the contrast of `text-[9px]` against Deep
  Midnight, and whether *"AI-proposed"* reads right beside a real sentence, are operator judgements
  **nobody has made**.

**It is therefore not recorded as a specifically-observed mark.** *A general "all pass" is weak
positive evidence and is not a driven row* — the same discipline 193.1 applied when the operator
spent real time on a screen and nothing jumped out, and it declined to record that as a pass.

**Re-open trigger for the sliver:** the next time anyone opens the Builder on an AI-authored draft,
look at the requirement row and say whether the mark is visible and legible. Thirty seconds.

⚠ **AND THE STANDING CAVEAT SURVIVES THE PASS, because this run is an example of it:** the mark means
**"a model wrote this"**, never **"this is durable"**. This requirement *was* durable — but
`193.2-FREQUENCY.md` §6(c) measured `gpt-5.5` naming one-run parameters in **5 of 5** QBR
requirements, all 20 of which were still correctly stamped. **One durable example does not make the
mark a durability signal**, and no copy anywhere may imply that it is.

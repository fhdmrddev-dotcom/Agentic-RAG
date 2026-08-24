# SEED-164 — a workflow that legitimately pauses for a person, and can still be published

**Planted:** 2026-08-15, at the operator's direction, during Phase 193.1's end-to-end UAT
**Surface:** Agentic-RAG — workflow publish gauntlet · run engine · run surface
**Status:** open
**Priority:** high — this is a capability the operator has named as a real business need, not a defect

---

## ⚠ First, the thing this seed exists to correct

Twice in one session the assistant described this as *"the deferred Phase-103 background-job
publish"*, as though it were scheduled work. **The operator challenged it. It is not scheduled, and
it never was.** Measured:

- The **only** thing that says so is a docblock describing itself —
  `publish_service.py:478-479`: *"The full background-job publish that COULD validate interactive
  phases (a human subscriber, a durable resume) is the DEFERRED Phase-103 rework — out of scope
  here."*
- The only other reference is `SEED-137`, which cites it as a **re-open trigger** for a different
  problem, and states plainly: *"the re-open trigger (the Phase-103 background-job publish) **is not
  scheduled in this milestone at all**."*
- **Zero** roadmap phases, **zero** owning seeds, **zero** deferred-item entries.

⚠ **And Phase 103 shipped long ago** — so "the Phase-103 rework" names work that was scoped *out* of
a phase that has since closed, and never got a home. **It is a phrase that reads like a plan because
it has a phase number attached to it.** This project's standing rule is that every deferral gets a
concrete re-open trigger or it evaporates; this one evaporated and has been cited as a plan ever
since. **This seed is the home it never had.**

---

## The capability

A workflow that **deliberately** stops mid-run, asks a person something, and continues with their
answer — and that can be **published** like any other workflow.

The operator's framing, which is the design proposal this seed is built around:

> *"there's no issue with the ask-user step, but it is affecting the golden run. However this is a
> real need that we should not neglect. So maybe in the golden run the ask-user step could be
> ignored, however it should stay in the workflow itself after we publish, with a very legitimate
> feedback to the user."*

**That is a materially cheaper idea than the mythical background-job publish, and it should be
evaluated first.** Skip/stub the interactive step during the *validation* run; keep it in the
published definition for *real* runs.

---

## What the mechanism actually is today — measured, not assumed

`LlmHumanInputPhaseConfig` (`backend/app/models/harness.py:128-135`) declares exactly three things:

| Field | Value |
|---|---|
| `prompt` | `str` — the ask_user prompt |
| `options` | `list[str]` — empty means free text |
| `timeout_seconds` | **`int = 300`** — five minutes, hard-capped at `Settings.ask_user_max_timeout_seconds` = **1800 s / 30 minutes** |

**Two consequences fall straight out of that, and they answer the operator's questions directly.**

### ⚠ 1. "What about long reports — tens of pages? Is ask_user doable?" — **No, and not because of prompt length.**

**There is no field in the config for an artifact.** It is a question with an optional pick-list.
You cannot review a 40-page document through a mechanism whose entire surface is `prompt` +
`options`. Putting the report *into* the prompt would be the wrong shape even if it fit.

**The right shape for that case already exists elsewhere in this product.** Phase 185 built *the
review moment where the document IS the surface, with backing marked inside it*. **A long-artifact
review is a different phase type from a question, and conflating them is how ask_user ends up
carrying a job it was never built for.**

### ⚠ 2. The 30-minute ceiling makes the most realistic business case impossible today

The natural pattern — *the QBR drafts on Friday afternoon, the account owner answers on Monday* —
**cannot happen.** The run dies after 30 minutes at the absolute maximum, 5 by default. **The
current mechanism assumes a human is sitting in front of the screen at that exact moment.**

Any serious version of this capability needs a **durable pause**: the run persists, the person is
notified, and it resumes hours or days later. That is the genuinely expensive part — and notably
**it is expensive for real runs, not for publish.** The operator's golden-run-skip idea sidesteps
publish entirely and leaves this as the real remaining question.

---

## Four kinds of "ask", and only two of them are this phase type

Imagining real business cases surfaces a taxonomy. **Deciding which of these are in scope is the
first job of any phase that picks this up** — building one mechanism for all four is how it goes
wrong.

| # | Kind | Real example | Right shape | Suits `llm_human_input`? |
|---|---|---|---|---|
| 1 | **Fill a gap** | The QBR template needs `health_status`; the knowledge base never states it | short, structured, one or few fields | ✅ **yes — this is the case that triggered the seed** |
| 2 | **Disambiguate** | Three customers named "Northwind" — which one? | pick-list from candidates the run found | ✅ yes, and `options` already exists for it |
| 3 | **Approve an act** | "Send this to the client?" | approval before an outward-facing action | ❌ **already `external_action`** — *always asks approval, records rather than sends*. Do not rebuild it here |
| 4 | **Review a long artifact** | 40-page report, human reads before finalising | the document IS the surface (Phase 185's shape) | ❌ **no** — no artifact field, and 30 min is not a review window |

⚠ **Case 1 has a timing property that rules out the obvious cheap alternative.** You cannot collect
these as run inputs up front, **because you do not know what is missing until the retrieval steps
have run.** The ask must be mid-run. That is precisely why this is hard and why a kickoff form does
not solve it.

⚠ **Case 1 also has a batching question.** A 10-field template with 3 gaps: three separate
interruptions, or one consolidated ask after retrieval? **One ask is obviously better for the person
and requires the engine to accumulate gaps rather than pause per-field.** Serial pausing on a
30-minute timer is close to unusable.

---

## The operator's golden-run-skip proposal — the honest costs

**The idea is sound and cheap. These are the costs, stated so nobody discovers them later.**

1. ⚠ **You would publish a workflow whose interactive path has never executed.** The golden run's
   whole purpose is *"this thing actually works"*. Skip a phase and that claim narrows.
   **Mitigation: validate the step's SHAPE statically even when skipping its execution** — does it
   declare a prompt, are `options` well-formed, does the downstream phase actually consume what it
   produces? A shape check is not an execution proof, and the difference must be stated to the
   author rather than glossed.
2. ⚠ **What value do downstream phases see during the golden run?** A stub means every later phase
   validates against fabricated data. That still proves the pipeline runs; **it does not prove the
   artifact is correct.** The published claim must be honest about which of the two it is.
3. ⚠ **`SEED-137` goes from latent to LIVE the moment this ships.** It says so in its own re-open
   trigger: relaxing `_interactive_phase_failures` *"converts this from latent to live"* — the armed
   checkpoint's guarantee is positional, and an author-declared `ask_user` validator reaching a
   published workflow is exactly the bypass it describes. **Read SEED-137 before touching the gate.**
4. ⚠ **Do not remove the gate.** An unsubscribed `ask_user` can wedge a publish indefinitely. The
   proposal is to *skip the phase during the golden run*, which is a different thing from *allowing
   the phase past the gate unexamined*.

---

## Open questions a phase must answer

- **Timeout.** Is a durable pause in scope, or does v1 accept the 30-minute ceiling and say so? ⚠ If
  it accepts it, the product must **tell the author at authoring time** that their workflow expires
  in 30 minutes — otherwise they discover it on a Friday.
- **What happens when nobody answers?** Timeout → abandon the run? Fall back to a default? Emit the
  artifact with the gap marked? ⚠ **`SEED-159` is adjacent and unresolved**: a field with no evidence
  currently renders as a blank cell that lies. An unanswered ask must not become a silent blank.
- **Notification.** A pause nobody is told about is a hang. Who gets told, where, and does that
  depend on the run being watched?
- **Batching** — one consolidated ask after retrieval, or one per gap.
- **What the person is shown.** The operator asked *"what type and length of feedback"*. For case 1
  the honest minimum is: **which field, why it could not be found, what the workflow will do with
  the answer, and what happens if they do not reply.** ⚠ *"Please provide health_status"* is the
  `BUG-260809-02` failure again — naming an internal field at someone who never chose it.

---

## Re-open triggers

- **PRIMARY — any phase that touches the publish gauntlet or `_interactive_phase_failures`.**
  **Phase 193.2** is the immediate one: it fixes `BUG-260815-01` by teaching the authoring model
  *not to emit* these steps. ⚠ **That is a suppression, not a capability** — 193.2 makes the
  annoyance go away and explicitly does **not** deliver this. If 193.2's work makes the gate easier
  to relax, decide this deliberately there rather than as a side effect.
- A user asks for a workflow that pauses for a decision — i.e. this stops being hypothetical.
- Any work on Phase 185's review-moment surface, which is the right home for case 4 and may make
  case 1 cheap by adjacency.
- `SEED-137` being picked up, since the two are mechanically coupled.

## Related

- `BUG-260815-01` — the trigger: a template-first draft grows one of these and cannot publish.
- `SEED-137` — the armed-checkpoint precedence bypass; **goes live if the gate is relaxed**.
- `SEED-159` — an unfound field renders as a silent blank; an unanswered ask must not do the same.
- `BUG-260809-02` — the precedent for naming internal identifiers at users.

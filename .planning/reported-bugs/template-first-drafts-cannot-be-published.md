---
id: BUG-260815-01
title: A template-first draft grows an llm_human_input phase and therefore cannot be published
reported: 2026-08-15
surface: Agentic-RAG
severity: blocking
status: folded
affected_areas: [workflow/authoring, workflow/publish, backend/harness]
folded_into: "193.2"
verified_closed_by: null
related_seeds: [SEED-157, SEED-163, SEED-164]
re_open_trigger: "STAYS OPEN as `folded` at Phase 193.2's close, deliberately. The fix is PROMPT-LEVEL and therefore NON-DETERMINISTIC (D-08): measured `llm_human_input` 0/20 across 20 real paid generations on two providers, against a pre-fix 2/2-with-a-template and 4/6 overall (`193.2-FREQUENCY.md` §3). THE CLAIM IS A MEASURED REDUCTION, NEVER AN ABSENCE — one more generation can still produce an interactive step, which is exactly why the publish gate stays. This report may flip to `closed` ONLY when UAT row U1 moment 2 (`193.2-UAT.md`) records a real operator-driven publish that succeeded WITHOUT a canvas edit; U1 is OWED at close. RE-OPEN if: the operator meets an interactive step on a template-first draft again; or a refusal appears that names `llm_human_input` / `ask_user` / a slug / a step number instead of the step's visible canvas label; or the publish gate is widened to refuse `external_action` (forbidden by a shipped fence — CONFLICT-1 Option B, REJECTED)."
reproduces_on:
  branch: develop
  commit: bab09f41
  date: 2026-08-15
---

# BUG-260815-01: A template-first draft grows an `llm_human_input` phase and therefore cannot be published

## What the operator saw

During Phase 193.1's end-to-end UAT: uploaded a five-document knowledge base, attached a real
10-field `.docx` template, described a Quarterly Business Review workflow. The AI authored a
five-phase workflow. Publish then failed with:

> interactive phases (llm_human_input / ask_user dispositions) cannot be validated in a
> synchronous publish

They had already been blocked once on `business_requirement` (→ `SEED-163`) and cleared it.
**This is the second consecutive publish blocker on the phase's own headline path.**

## Why it happens — measured, not inferred

Phase 193.1 shipped `D-26`: the grounding section now **asserts** that a template was provided,
which makes `AUTHORING_SYSTEM_PROMPT`'s DELIVERABLE RULE branch fire and produce an
`llm_emit` / `render_template` deliverable. That fix is correct and is what makes template-first
authoring work at all.

**But once the model knows it must fill ten specific named fields, it reasonably adds a step to
ask the human for the ones it cannot find — and `llm_human_input` blocks synchronous publish.**

Measured across the six real `/generate` calls captured during the phase (`claude-opus-4-8` /
`anthropic`, artifacts in `193.1-UAT.md`):

| Draft | `render_template` phase | `llm_human_input` phase | publishable |
|---|---|---|---|
| A — control, no placeholders | no | **no** | ✅ |
| B ×3 — placeholders, pre-fix behaviour | no | **no** | ✅ |
| **C ×2 — template step present** | **yes** | **yes** | ❌ |

**2 for 2 whenever a template step appears.** `193.1-11-SUMMARY.md` independently measured the
`llm_human_input` phase in **4 of 6** post-fix runs. The correlation is with the template step,
not with the wording of the description.

## The blocking rule is PRE-EXISTING and deliberate — this is not a regression in that code

`_interactive_phase_failures` (`backend/app/services/harness/publish_service.py:500-540`)
short-circuits publish before the golden run, because a `llm_human_input` phase (or any
validator with `on_failure == "ask_user"`) would **wedge the synchronous golden run waiting for
a human**. Its own docblock records the real fix as out of scope:

> The full background-job publish that COULD validate interactive phases (a human subscriber, a
> durable resume) is the DEFERRED Phase-103 rework.

⚠ **So the defect is not in the publish gate and not in the D-26 fix. It is that the two are
mutually exclusive, and nothing connects them.** The authoring service can freely emit a phase
type that the publish gate categorically refuses, and neither side knows about the other.

## Why this is severity: blocking

**Phase 193.1's headline capability currently produces workflows that cannot be published.**
A user attaches a template, gets a correct template-filling draft, and hits a wall with a message
that names two internal phase-type identifiers and offers no action. It is the same *class* of
failure as `D-19`'s hazard (a draft that looks right in the Builder and dies later), arriving by
a different route.

## Workarounds available today

1. **Steer the description:** add *"Take every field from the knowledge base. Do not add a step
   that asks me for input."* Suppresses the phase in most cases; not deterministic.
2. **Delete the phase on the canvas**, then publish. Deterministic. Safe when the knowledge base
   genuinely contains every field — which is the normal case for a document-filling workflow.

## Candidate fixes, in increasing cost

1. **Tell the authoring model the constraint.** `AUTHORING_SYSTEM_PROMPT` already carries a
   DELIVERABLE RULE labelled *"a wrong choice makes the workflow unpublishable"* — the same
   sentence should cover `llm_human_input`. **Cheapest, and symmetric with the fix that caused
   this.** ⚠ It is a prompt-level mitigation, so it reduces frequency and cannot guarantee
   absence; the gate must stay.
2. **Make the refusal actionable.** The message names `llm_human_input` and `ask_user` at a user
   who did not choose either and cannot see those words on the canvas. It should name the
   offending **step by its label** and offer to remove it. (Same class as `BUG-260809-02`, whose
   message named an internal snake_case field.)
3. **The real fix:** the deferred Phase-103 background-job publish with a durable resume, which
   would let interactive phases be validated properly instead of refused.

⚠ **Do not "fix" this by removing the publish gate.** It exists because an unsubscribed
`ask_user` prompt can wedge the publish indefinitely.

## Routing note

Not folded into 193.1 — that phase is executed and its plans are closed, and adding a capability
inside a closure round is exactly what **G-7** forbids. The natural home is **197 / AUTH-02**
(*deepen the fast door*), alongside `SEED-163`, which is the second half of the same story: **two
consecutive publish blockers on the authoring path, both because authoring does not know what
publish requires.**

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

## ⚠ 193.2 SUPPRESSES THIS; IT DOES NOT DELIVER THE CAPABILITY — see `SEED-164`

Recorded 2026-08-15 so the distinction survives. **Phase 193.2 fixes this bug by teaching the
authoring model NOT to emit an interactive step it was never asked for**, and by making the refusal
actionable. **After 193.2, a workflow that DELIBERATELY pauses for a person still cannot be
published.**

That capability is now owned by **`SEED-164`**, planted at the operator's direction after they
challenged the claim that it was *"planned to be fixed in the future"*. ⚠ **It was not planned** —
the only thing describing it was a docblock referring to itself as *"the DEFERRED Phase-103
rework"*, and `SEED-137` states outright that it *"is not scheduled in this milestone at all"*.
Phase 103 shipped long ago.

⚠ **Measured while planting it, and it reframes the problem.** `LlmHumanInputPhaseConfig`
(`backend/app/models/harness.py:128-135`) carries only `prompt` + `options` + `timeout_seconds`
(**default 300 s, hard cap 1800 s**). So:

- **There is no artifact field** — a long-report review is structurally not this phase type; it is
  Phase 185's document-as-surface shape.
- **The run dies within 30 minutes**, which makes the realistic *"drafted Friday, answered Monday"*
  case impossible today.

**The expensive part is therefore the durable pause on REAL runs, not publish** — which is exactly
what makes the operator's golden-run-skip proposal the right first thing to evaluate.

---

## ⚠ STATUS AT PHASE 193.2's CLOSE (2026-08-15) — `folded`, NOT `closed`, and the reason is a measurement

**What 193.2 shipped against this report, in two halves that must not be quoted as one.**

**(a) The frequency half — `193.2-05`.** `AUTHORING_SYSTEM_PROMPT`'s DELIVERABLE RULE gained ONE
clause stating the consequence (*"publishing VALIDATES a workflow by running it, and a run waiting on
a person cannot finish"*) and offering the alternative (*"have the step gather it with the tools it is
given, and have the deliverable say plainly that it could not be found. Never invent it."*), and the
`llm_human_input` bullet was cut **121 → 74** characters. ⚠ **What made that bullet a nudge was its
TAIL, not only its length** — it ended *"— use for any 'confirm before finalizing' step"*, an active
invitation to the one phase type the publish gate categorically refuses.

**MEASURED (`193.2-FREQUENCY.md`, 20 real paid generations, 2 providers × 2 arms, 0 failed calls):**

| Figure | Post-fix | Pre-fix baseline |
|---|---|---|
| `llm_human_input` present | **0/20** | **2/2** with a template · **4/6** overall |
| `ask_user` validator present | **0/20** | not measured pre-fix |
| `external_action` (displacement watch) | **0/20** | not measured pre-fix |
| `render_template` (**SC#4 control — did NOT fall**) | **5/5 per arm**, like-for-like | 193.1's **3/3** |

> ⚠ **THE CLAIM IS A REDUCTION, NEVER AN ABSENCE.** `0/20` is a frequency over a sample, not a
> guarantee. **The publish gate STAYS, and nothing downstream may be relaxed on the strength of these
> numbers.** The counters were **planted before their zeroes were published** — a zero from a blind
> counter and a zero the model earned are indistinguishable in an artifact — and the positive control
> ships permanently in the harness.

⚠ **Attribution between the clause and the shortened bullet is UNRESOLVED and UNDRIVEN.** Two edits
landed in one string literal; a single measurement cannot say which moved the number, or whether both
did. The third arm that would have attributed it was **not driven**, and the phase claims a
**combined effect and attributes nothing** (`193.2-FREQUENCY.md` §4).

**(b) The words half — `193.2-06`.** The refusal was rewritten in **two arms that share no complete
sentence and cannot be collapsed** — arm 1 about the STEP (*remove it*), arm 2 about a step's FAILURE
ROUTE (*change it*) — each naming the offending step **by the plain-language label a non-coder reads
on the canvas**. `llm_human_input` and `ask_user` no longer reach user copy. An empty label degrades
to a **name-free TRUE sentence, never a bare slug**; the model-authored label is whitespace-collapsed
and clamped at 72 chars before it enters copy, an aria label and a persisted audit row. The messages
are **longer than the 105-char baseline** — 135/143 degraded, ~150 realistic, **196 worst case** — and
that is the stated cost of carrying a label and an action. ⚠ **D-12 holds: ONE string feeds BOTH the
publish refusal and `/validate` → `blockedReason` → the greyed canvas control.**

**⚠ THE MOST IMPORTANT CORRECTION TO THIS REPORT, and it is stated rather than smoothed.** This
report describes a **400 from the publish endpoint**. `193.2-02` measured the audit ledger at HEAD:
on 2026-08-15 there were **0 `publish_blocked` rows**, exactly **1 `publish_attempted`** and **1
`publish_succeeded`** 7.57 ms apart, and the newest `publish_blocked` anywhere is **2026-08-07**.
**The publish endpoint never refused anything.** Both facts CONTEXT put on trial (that `/validate`
mints the verdict; that the verdict greys the control and renders the server message verbatim) are
**TRUE**. The false premise was the unstated third one — *that a 400 was received at all*. The
refusal the operator met came from `blockedReason` beside an **already-greyed control**. ⇒ D-10's
escape hatch is recorded **NOT TRIGGERED**, and rewriting the string IS the fix. **The defect is real
and unchanged in severity; only its location moved — it is on the canvas, not behind a publish click.**

**What is still true after 193.2, and must not be misread as fixed:** a workflow that
**deliberately** pauses for a person still cannot be published. **193.2 SUPPRESSES the unwanted step;
it does not deliver that capability** — that is `SEED-164`, and nothing shipped here may imply
otherwise.

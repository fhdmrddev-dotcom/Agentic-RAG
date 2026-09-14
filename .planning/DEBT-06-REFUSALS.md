---
type: debt-refusals
requirement: DEBT-06
written: 2026-09-14
author: claude
decided_by: operator
kind: recorded-decision-not-review
phases: [241, 242, 243, 244, 245]
---

# `DEBT-06` — the five phases that get a reasoned refusal instead of a review

**Operator ruling, 2026-09-14:** review the three **trust-boundary** phases; **241-245 carry a
written refusal naming why.** `DEBT-06`'s own wording allows this: *"each receive an independent §6.3
review, **or carry a written refusal naming who decided and why**."*

⛔ **A refusal is not a pass.** Each phase below stays `verification_mode: self-verified` and keeps
`independent_review: owed`. What changes is that the debt stops being **silent** — it becomes a
decision with a name, a date and a reason attached, which is the difference between a deferral and a
deletion that looks like one.

---

## The principle these refusals rest on

From the v4.0 close, and it is the load-bearing sentence:

> **What a self-verification does NOT weaken is the mechanical evidence** — a hash, a byte-identical
> file, a driven function. **What it weakens is every judgement call** about whether an owed item was
> acceptable.

So the test applied below is not *"was this phase good?"* — that is the judgement a reviewer makes and
I cannot. It is: **how much of this phase's claim rests on mechanical evidence a third party can
re-run, versus on a judgement only a reviewer could test?** A phase whose deliverable is a
*measurement* survives the absence of a reviewer far better than one whose deliverable is a
*design*.

⚠ **None of the five carries `review_type: independent`.** Measured: every `*-REVIEW.md` in 241-245
is a **builder-dispatched** code review. That is not worthless — on Phase 239 exactly that
arrangement returned 19 findings including 2 Criticals — but it is **Claude's work checking Claude's
work**, and it is recorded as such below rather than counted as a gate.

---

## 241 — Recall at corpus scale · **REFUSE, strongest case of the five**

| | |
|---|---|
| Dispatched review | `241-REVIEW.md`, depth `standard`, **19 files** |
| Trust boundary | none |

⭐ **Its deliverable is a MEASUREMENT, and a measurement is the one artifact that does not need a
reviewer's judgement — it needs a re-run.** 241 established the small-tenant recall cliff with
`recall@20` figures at named `ef_search` values, and Phase 246 then re-derived the same territory
independently *and corrected it* — proving by `EXPLAIN (ANALYZE)` that every good recall number was a
**sequential scan**, not an index walk. ⭐ **241 was effectively re-examined by 246, by a different
agent, and the correction was found.** That is closer to an independent check than a review would
have been.

⚠ **Its one owed UAT row is EXPIRED, not owed** — row 5 required cloud *before* migration 176 landed
there; 176 is in cloud, so the arm is unreproducible forever. Do not re-open it as "never run".

**Residual risk accepted:** the 19-file review's judgement calls are unexamined. Low — the phase
changed a default and a settings surface, and the default was subsequently **reverted** by 246.

---

## 242 — Ship it and prove what already shipped · **REFUSE**

| | |
|---|---|
| Dispatched review | `242-REVIEW.md`, depth **`deep`**, **15 files** |
| Trust boundary | touches settings + production parity, but adds no new credential path |

⭐ **Much of 242's claim was re-driven independently TODAY, 2026-09-14, against live production** —
by read-only Supabase MCP queries, not by reading its record: `app_settings` / `user_settings` RLS
enabled with `anon` absent from both ACLs · `resize_embedding_column` EXECUTE false for `anon` **and**
`authenticated` · the `multimodal_max_vision_calls` CHECK constraint present · `get_advisors(security)`
returning **zero ERROR**. The changed-fields-only save (`46292bb81`) is likewise verifiable from the
diff.

⚠ **One owed item is real and is not discharged by this refusal:** 242's **UAT row 5** — save a
Search setting *on production*. Its trigger (the next promotion) fired on 2026-09-13. It is owed
work, not review debt, and belongs in the operator's queue rather than here.

**Residual risk accepted:** low. A `deep` review plus same-day production re-measurement.

---

## 243 — The thinking block and the follow-scroll seam · **REFUSE**

| | |
|---|---|
| Dispatched review | `243-REVIEW.md`, depth **`deep`**, **7 files** |
| Trust boundary | none — chat rendering |

⭐ **Its headline claim was driven in a real browser with a real wheel event** — 0 px drift, closing
`BUG-260823-01` after two prior fixes that had passed on **synthetic** events. That is the strongest
evidence shape available for a scroll-seam claim, and it is the shape a code reviewer could not have
produced by reading.

⚠ **Recorded against it:** `BUG-260912-01` later found a defect in exactly this area — a narration
fold fed by one input, blind to models that merely talk, shipping a mid-stream double that only a
live run caught. **A deep review of 7 files did not prevent it**, which is honest evidence about what
this class of review buys on a rendering surface. Noted as a cost of the refusal, not hidden by it.

**Residual risk accepted:** low-to-moderate, and visible — rendering regressions on this surface have
historically been caught by driving, not by reviewing.

---

## 244 — The chat shell and the composer · **REFUSE, and it is the best-evidenced of the five**

| | |
|---|---|
| Dispatched reviews | **THREE** — `244-REVIEW.md` (16 files) · `244-REVIEW-build-round.md` (**29**) · `244-REVIEW-gap-round-2.md` (7). **52 file-reviews** |
| UAT | **six** dedicated row files (`244-09` … `244-15`), driven across **two full browser rounds** |
| Trust boundary | none |

⭐ **All five ROADMAP success criteria were driven and closed in a real browser**, including
`SHELL-03`'s two-home approval settle, on **two threads** answered in opposite homes so neither arm
passes by a one-way fix. Both reached `run=failed` server-side, so the UI was not clearing itself
optimistically.

⭐ **And its own record already contains the kind of finding a reviewer is hired to produce** — attempt
1 produced a defect-shaped reading that was **withdrawn rather than published**, once the process table
showed the backend was running `uvicorn --reload` while the driver's own `git merge` was rewriting
tracked files underneath it. *A UAT driven against a `--reload` backend while the driver is merging
branches is measuring its own tooling.*

⚠ **Carries a `G-7` override** (gap-closure round 2, plan `244-15`) — waved through on the gate's
worded escape hatch with the operator's recorded ruling. **A waved-through finding is not an absent
one**, and that override is the part of 244 a reviewer would most usefully have tested.

**Residual risk accepted:** low. Three reviews and two browser rounds is more scrutiny than most
reviewed phases receive.

---

## 245 — The verification debt discharged or retired in writing · **REFUSE, and the reason is structural**

| | |
|---|---|
| Dispatched review | none as a `*-REVIEW.md` |
| Verdict file | `245-VERDICT.md` (⚠ **no `245-VERIFICATION.md`** — see below) |
| Trust boundary | none — this phase wrote markers and a gate |

⭐ **245's deliverable is CHECKED BY A MACHINE, which is the one case where a reviewer adds least.**
Its output was the `verification_mode` marker and `scripts/check-verification-honesty.cjs`. Those
markers are now asserted on every run by the gate — **and that gate was rebuilt and driven RED three
ways today**, including the counterfactual that its predecessor passed over a planted defect. A
reviewer reading 245 would be re-deriving what an executable check now re-derives continuously.

⚠ **Its own gap, found today and fixed today:** 245 produced **no `VERIFICATION.md`**, so the phase
that invented the marker and wrote the gate was **invisible to both**. That is exactly the kind of
thing a reviewer catches — and it was instead caught by `SEED-275`'s measurement, then closed by the
operator's ruling that `VERDICT.md` counts. **The gate now reads 245.**

⚠ Also recorded: 245's own `DEBT-03` work **named three files by hand** (238/240/241) and missed
**239**, which got no marker at all until today. A hand-written list is the defect this whole family
keeps re-paying.

**Residual risk accepted:** very low. The phase's product is now continuously machine-checked.

---

## Summary

| Phase | Verdict | Strongest evidence standing in for a review | Residual risk |
|---|---|---|---|
| 241 | REFUSE | its deliverable is a measurement, **re-derived and corrected by 246** | low |
| 242 | REFUSE | `deep` review + **live production re-measurement 2026-09-14** | low |
| 243 | REFUSE | real-wheel browser drive, 0 px drift | low-moderate ⚠ |
| 244 | REFUSE | **three** reviews / 52 file-reviews + two browser rounds, 5/5 SC driven | low ⚠ G-7 override |
| 245 | REFUSE | deliverable is **continuously machine-checked** by the gate it built | very low |

⛔ **What this does not do:** it does not flip any `independent_review` field to `done`, and it does
not claim any of the five was reviewed. All five keep `verification_mode: self-verified` and
`independent_review: owed`. **The refusal is the record, not a discharge.**

**Re-open trigger for all five:** an independent reviewer becoming available with capacity beyond the
trust-boundary queue (238, the 240 remainder, and 239 once its reviewer question is settled). A
refusal taken for want of a reviewer is not spent by having been taken.

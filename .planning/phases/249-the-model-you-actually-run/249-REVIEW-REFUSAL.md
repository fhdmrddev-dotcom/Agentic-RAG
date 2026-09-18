---
type: debt-refusal-draft
requirement: DEBT-06
phase: 249-the-model-you-actually-run
written: 2026-09-17
author: claude (the BUILDER)
decided_by: pending — operator (D-05)
kind: recorded-decision-not-review
review_type: self-assessed
status: draft-pending-operator-ruling
effective_from: 2026-09-24
bus_item: BUS-251
independent_review_after_ruling: refused
---

# Phase 249 — The model you actually run · **DRAFT REFUSAL — the strongest case of the five**

| | |
|---|---|
| Dispatched review | `249-REVIEW.md`, depth **`deep`**, **12 files**, `diff_base: abbaa2750` — 2 critical / 10 warning. **Authored by claude, the builder** |
| Trust boundary | **none** — model registry, settings writes and composer copy. `AGENTS.md` §3.1's critical-phase test does **not** fire here |
| `verification_mode` | `self-verified` · `independent_review: owed` · `builder: claude` · `reviewer: claude` |
| ⭐ **`independent_review_waiver`** | **present in the phase's own frontmatter** — quoted verbatim below |
| Bus item | **`BUS-251`**, filed 2026-09-16, amended 2026-09-17 with the deadline and rank 4 of 5; **still `[OPEN]`** |
| What the reviewer would have tested | whether closing `MODEL-09` **by measurement** rather than by building was the right call, and whether `BUG-260916-01` belongs to this phase |
| Rank | **4 of 5** (`251 → 253 → 252 → 249 → 250`) — it already carries a deep code-review pass, so what is missing is **independence**, not a first reading |

## ⭐ Why this is the strongest of the five: the decision was already made, by the party entitled to make it

`249-VERIFICATION.md`'s frontmatter carries an `independent_review_waiver` key. **Quoted verbatim,
because a paraphrase of an operator instruction is not an operator instruction:**

> **Operator instruction, 2026-09-15, verbatim: 'I want you to execute this phase in to end yourself
> without gemini please proceed autonomously use the tools you have I want to come tomorrow to see it
> complete.' OV-SOLO-01 / AGENTS.md §6.3 two-agent separation is WAIVED BY INSTRUCTION, not satisfied.
> This is a FOURTH owed DEBT-06 row beside 238 / 240 / 241.**

⭐ **That is the strongest kind of evidence a refusal can rest on — a decision already named, dated
and recorded by the only party who can make it**, written into the phase's own register at the time
rather than reconstructed afterwards. This draft is not proposing a new decision; it is asking the
operator to confirm that the standing one still holds and should now be **indexed** as a refusal.

⛔ **And the phase's own frontmatter is scrupulous about what the waiver is NOT.** It says *"WAIVED BY
INSTRUCTION, **not satisfied**"* and counts itself as an owed row in the same breath. **A waiver is
not a review.** ⚠ The ground has also moved since: `OV-SOLO-01` was **re-armed on 2026-09-13**, so the
two-agent separation that instruction set aside is otherwise back in force — which is exactly why this
needs a fresh ruling rather than an appeal to the old one.

## The test this refusal applies

Quoted from `.planning/DEBT-06-REFUSALS.md`, the 2026-09-14 operator-ruled precedent, rather than
reinvented here:

> **how much of this phase's claim rests on mechanical evidence a third party can re-run, versus on a
> judgement only a reviewer could test?**

and its ground, from the v4.0 close:

> **What a self-verification does NOT weaken is the mechanical evidence** — a hash, a byte-identical
> file, a driven function. **What it weakens is every judgement call** about whether an owed item was
> acceptable.

## ADOPTED READING

> **254 adopts BOTH rules, because they answer different questions.** `DEBT-06-AUDIT.md`'s counting
> rule — *a review file whose frontmatter does not assert the `independent` marker is a code-review
> pass* — is the test for whether a row was **REVIEWED**. `DEBT-06-REFUSALS.md`'s rule — *the refusal
> is the record, not a discharge* — is the test for whether a row is **ACCOUNTED FOR**. A row can be
> accounted-for and unmet at the same time, and every one of these five drafts produces
> **accounted-for, never reviewed**. ⛔ 254 does not settle which of the two registers governs
> `/gsd:complete-milestone`; that ruling is the operator's and it is `BUS-247`.

⚠ **This paragraph is byte-identical in all five drafts, and it is fenced to stay that way.**
`254-CONTEXT.md` M-8 records a conflict this phase INHERITS rather than creates: `ROADMAP.md:271` has
`DEBT-06-AUDIT.md` calling four rows *"genuinely unmet"*, while `DEBT-06-REFUSALS.md` covers exactly
those four rows — and the audit never reads it. **A refusal that does not state which reading it
adopts re-creates that conflict one milestone on**, and five files inventing five readings would
re-create it five times over. `254-03` Task 3 therefore extracts this section from each of the five
files, compares the five md5s, and requires one distinct value; the fence was driven RED against a
one-word change before it was believed.

## The evidence standing in for a review

| Evidence | What a third party re-runs | Result |
|---|---|---|
| ⭐ the **operator waiver** | read `independent_review_waiver` in `249-VERIFICATION.md` frontmatter | present, verbatim, dated 2026-09-15 — **a recorded decision, not an inference** |
| `MODEL-09` closed by a **fresh sweep**, not by a build | the eval-engine health board | **8/8 healthy · zero errors · zero opaque `provider_error`**, against a stale 2026-08-27 board reading 7/8 whose one failure carried a verbatim vendor `RateLimitError`. `BUG-260809-01`'s two claims — *"0/8 healthy"* and *"6 of 8 hide why"* — are **both refuted on this tree** |
| the opaque-cause fence | driven RED against a plant that moved the engine-shaped sentence one branch higher | the fence fires; the application does not **manufacture** an opaque cause |
| `MODEL-08` reproduced **before** it was fixed | `set 0/51/999 → returned False`, then fixed | `PUT /settings` and the three admin write seams answer **400** naming the column and the rule; an unreachable database is still a **500**, byte-identical — proven by a control |
| ⭐ the two blockers the code review found | `249-REVIEW.md`, then the gap-closure round | **both were regressions this phase itself introduced, both fixed and driven.** The phase's own score line says so in the frontmatter rather than burying it |
| the backend gate | `pytest tests/unit -q --continue-on-collection-errors` | `[recorded]` — `71 failed / 4788 passed / 0 collection errors`, and **the SET is identical**: all 71 names match, not just the count |

⭐ **The most useful thing in that table is the pair of blockers.** A phase that ships a green
self-verified close, then has a reading find two regressions it introduced, then fixes and drives
both, and then **writes the whole sequence into its own score line**, has already demonstrated the
failure mode a reviewer is hired to catch — and has already paid for it once. ⚠ It is also the
argument *against* this refusal: `BUS-247`'s one-paragraph case is built on exactly those two
blockers, *"because neither blocker was gate-catchable."*

⛔ **And one limit is stated rather than glossed: the `8/8` sweep is LOCAL.** The original
`BUG-260809-01` measurement was taken on **cloud production**, 2026-08-09. What is proven is that the
application does not manufacture an opaque cause. What is **not** proven is that cloud's eight engines
are healthy today.

## What a reviewer would have tested that this cannot

⛔ **The first judgement, named in one sentence: whether closing `MODEL-09` by MEASUREMENT rather
than by building anything was the right call.** The requirement was met by driving a sweep and finding
the defect already absent — which is a legitimate and cheap outcome, and is also a decision with no
artifact. **A measurement can show `8/8`; it cannot show that `8/8` was the right bar**, that the
local-versus-cloud substitution is acceptable, or that a requirement answered by *"the defect is gone"*
is closed rather than merely quiet. ⚠ **This project has already been bitten once by exactly that
substitution**: `BUG-260911-01` was invisible to every gate because every gate read through the
service role and nothing ever asked as `anon`.

⛔ **The second judgement: whether `BUG-260916-01` belongs to this phase.** It is an **open**,
`surface: Agentic-RAG` report — *llm-call-timeout above 600s is silently ineffective*, with
`affected_areas: backend/provider-routing, admin/model-registry, local-models` — sitting squarely in
Phase 249's surface. ⛔ **It is deliberately NOT folded, because 254 fixes nothing** (`254-CONTEXT.md`
`<deferred>`); it is named here as an **INPUT** a reviewer should weigh. **A live defect in the
reviewed surface is evidence about the review, and only a reader can decide whether it is a
consequence of this phase's changes or an independent pre-existing fault.**

A third thing a reviewer reaches: the ten warnings in `249-REVIEW.md`, whose dispositions were graded
by the same agent that raised them.

**Residual risk accepted:** **low** — and, uniquely in this set, it is low for a reason that does not
depend on the evidence being good. ⭐ **The separation was waived by the operator, in writing, at the
time, in the phase's own register**, so ruling a refusal here confirms a standing decision rather than
making a new one. Supporting it: there is **no trust boundary** (§3.1 does not fire), the phase already
carries a **deep** 12-file reading, the two blockers that reading found were fixed and driven, and the
backend failing set is identical to baseline by name. ⚠ **What keeps it from being lower** is that
`OV-SOLO-01` has since been re-armed, `BUG-260916-01` is open in this exact surface, and `MODEL-09`'s
closure rests on a local measurement standing in for a cloud one.

**Re-open trigger:** `BUG-260916-01` being triaged, or the next phase touching model routing or the
model registry — `254-CONTEXT.md` names both as this bug's own re-open trigger; **or** a cloud
measurement of the eight eval engines contradicting the local `8/8`; **or** an independent reviewer
acquiring capacity. ⭐ **A refusal taken for want of a reviewer is not spent by having been taken.**

⭐ **VOID IF ANSWERED.** If `BUS-251` is answered at any time, before or after 2026-09-24, the verdict
artifact is `249-REVIEW-IND.md` written by the reviewer, this draft is void, and the row's
`independent_review` key reads **`done`** rather than `refused`. **A deadline is a completion
condition, not a closed door.**

## ⛔ What this draft does not do

⛔ **What this does not do:** it does not flip any `independent_review` field to `done`, and it does
not claim the phase was reviewed. The phase keeps `verification_mode: self-verified` and
`independent_review: owed`. **The refusal is the record, not a discharge.**

⛔ **And it is not a refusal yet — it is a draft.** Claude built the phase this file describes, so a
refusal written here by claude about claude's own work would be exactly the self-assessment
`AGENTS.md` §6.3 exists to prevent. **The decider is the operator** (D-05), and `REG-03` puts the
closure of the bus item in the operator's hands alone — claude may not close one. Until that ruling
lands this file changes **nothing**: not a `*-VERIFICATION.md` frontmatter key, not a ROADMAP Progress
row, not a `REQUIREMENTS.md` line, not a bus item. `independent_review_after_ruling` is a **distinct
key** carrying the value the row would take *if ruled*, and `254-03` is barred from writing that value
into the phase's own register.

⛔ **`DEBT-06` is not ticked by this file, and cannot be ticked by this phase.** The requirement
covers two arms; 254 closes only its **249-253** arm, and `241 · 242 · 244 · 245` stay owed — that
set re-derived from the ten verification files rather than quoted as the `242-246` range, four of
whose rows (238, 240, 243, 246) are already discharged, refused or done.

⭐ **A refusal is not a criticism of the reviewer, and it is not a pass.** What it buys is that the
debt stops being **silent**: it becomes a decision with a name, a date and a reason attached, which is
the difference between a deferral and a deletion that looks like one.

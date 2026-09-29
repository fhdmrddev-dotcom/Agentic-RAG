---
type: debt-refusal-draft
requirement: DEBT-06
phase: 250-run-honesty-the-residue
written: 2026-09-17
author: claude (the BUILDER)
decided_by: pending — operator (D-05)
kind: recorded-decision-not-review
review_type: self-assessed
status: draft-pending-operator-ruling
effective_from: 2026-09-24
bus_item: BUS-250
independent_review_after_ruling: refused
---

# Phase 250 — Run honesty, the residue · **DRAFT REFUSAL — the second-strongest case of the five**

| | |
|---|---|
| Dispatched review | `250-REVIEW.md`, depth `standard`, **12 files** — 3 critical / 6 warning / 5 info, `status: resolved`: **3 of 3 criticals fixed, 6 of 6 warnings fixed, 4 of 5 info fixed**, each with its commit named. **Authored by claude, the builder** |
| Trust boundary | **none** — the agent loop's run-honesty accounting and a panel's todo rendering. `AGENTS.md` §3.1's critical-phase test does **not** fire here |
| `verification_mode` | `self-verified` · `independent_review: owed` · ⚠ **`reviewer: null`** — the field is present and explicitly empty, not merely absent |
| The `owed:` list | **five entries**, in the phase's own frontmatter. Its **fourth** reads, verbatim: *"independent review (DEBT-06) — **WAIVED BY INSTRUCTION, NOT SATISFIED**"* |
| Bus item | **`BUS-250`**, filed 2026-09-16, amended 2026-09-17 with the deadline and rank 5 of 5; **still `[OPEN]`** |
| What the reviewer would have tested | the `NOT TICKED` badge wording, the declined G-2 sketch (`D-250-12`), and the three remaining entries of the `owed:` list |
| Rank | **5 of 5** (`251 → 253 → 252 → 249 → 250`) — it already carries a code-review pass whose findings were all closed, so what is missing is **independence**, not a first reading |

## ⭐ Why this is the second-strongest: the phase wrote this refusal down itself, in advance

`250-VERIFICATION.md` does two things most closes do not. It writes **`reviewer: null`** rather than
omitting the field — ⭐ *an explicit empty is a claim; an absent key is a silence*, and 251's missing
`independent_review` key one phase over is what that distinction costs. And it enumerates what it
owes, naming the review debt as its fourth item in words that refuse to round themselves off:

> **independent review (DEBT-06) — WAIVED BY INSTRUCTION, NOT SATISFIED**

⭐ **This draft is that recorded intention catching up, not a second-guess of the close.** The phase
did not claim a review, did not imply one, and did not leave the gap to be discovered later — it
stated the gap in the register at the moment of closing. What is missing is only the **index entry**
that turns a sentence inside a verification file into a row a milestone-close audit can read.

⛔ **A waiver is still not a review**, and the phase's own wording insists on it: *not satisfied*.
⚠ The ground has also moved — `OV-SOLO-01` was **re-armed on 2026-09-13** — so the instruction that
set the separation aside no longer covers the present, which is why this needs a fresh ruling rather
than an appeal to the old one.

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

⭐ **This phase's load-bearing artifact is a MEASUREMENT taken BEFORE a line was planned, and a
measurement is the one artifact that does not need a reviewer's judgement — it needs a re-run.**

`250-MEASUREMENT.md` exists because the ROADMAP made the phase conditional on answering one question
first, in its own words: *"Planning before this is measured builds one of two mutually exclusive fixes
at random."*

| Evidence | What a third party re-runs | Result |
|---|---|---|
| ⭐ the **blocking measurement was actually taken** | the `todos` / `runs` query in `250-MEASUREMENT.md`, against the live local database via `asyncpg` | taken 2026-09-15, **before planning** — and the file tells its own reader *"Re-derive rather than trust this file — it rots like every other number in this project"* |
| ⭐ the report's dichotomy was measured **FALSE** | the same query, read by era | **PRESENT — and the dichotomy is false.** 78 open todos: **25 carry the marker, 53 do not**; of the 53, **49 pre-date the reconciler existing at all** and only **4** are after it. Both arms of a *"PRESENT ⇒ copy decision / ABSENT ⇒ backend defect"* split are true, of **different rows** |
| the 4 interesting rows were followed to their runs | the same query | `timed_out:1` and `cancelled:1, timed_out:1` — **not one `completed`**, which is what dissolves the dichotomy rather than picking a side |
| every review finding was closed with a **named commit** | `250-REVIEW.md` `resolution:` block | 3 criticals, 6 warnings and 4 info, each with a commit sha and a note saying **how the shipped fix differs from the one proposed** |
| the gate state at close | the four gates | `[recorded]` — backend `71 failed / 4864 passed`, **set identical to baseline**; count gate `287/287`, 0 failing; claude-md OK; deploy drift PASS; G-7 clear |

⭐ **The `resolution:` block is unusually strong evidence and deserves naming.** Four of its thirteen
entries record that the review's own proposal was **wrong** and something else shipped — *"the
proposal broke D-078-01"*, *"the other measured inert, 0/3024"*, *"the Anthropic half does not apply —
thinking is OFF by design"*, *"MEMBERS not zcard — a count cannot tell 'only me' from 'only someone
else'"*. ⭐ **A record that shows its own reviewer being overruled by measurement is the opposite of a
rubber stamp**, and it is checkable commit by commit.

⚠ **One entry cuts the other way and is named rather than buried:** `WR-06`'s claim was **measured
FALSE**, the underlying defect was filed as `BUG-260915-01`, and the fix is *a phase* — so this phase
closed a warning by discovering a bigger problem and handing it on.

## What a reviewer would have tested that this cannot

⛔ **The first judgement, named in one sentence: the words `NOT TICKED` on the badge.** They are
claude's call, drawn from the operator's own vocabulary — and **copy is the single thing in this set
that no measurement can grade.** A gate can prove the badge renders, that its text is pinned, and that
the pin fails when the text drifts. **It cannot say whether a user reading `NOT TICKED` understands
what happened to their run**, which is the entire deliverable of a phase called *run honesty*.

⛔ **The second judgement: the declined `G-2` sketch (`D-250-12`).** G-2 says a phase touching live UI
proposes `/gsd:sketch` **before** planning, and that an operator-approved mockup is the acceptance bar.
This phase declined it. ⚠ **A declined guardrail is a decision, and it was graded by the agent that
declined it** — the one shape `AGENTS.md` §6.3 distrusts most. ⭐ It is also the exact pairing this
project has already paid for: *presence assertions cannot see content drift*, and a badge is content.

⛔ **The third judgement: the three remaining entries of the `owed:` list.** Entry 1 is CLOSED (a live
mirror-image control was driven at the operator's request and **found a shipped hook-short-circuit
defect that every gate was green over**), and entry 4 is the review debt this file addresses. The
other three stay owed: **`HONEST-02`'s behavioural per-provider rows** — *"an empty-output run cannot
be produced on demand"* — the **parallel-thread axis, live**, and the badge wording above. **Whether
those three are acceptable to leave owed is a judgement**, and `SC#10`'s four-axis bandwidth rule says
a scoreboard that lists only what passed is not a scoreboard.

**Residual risk accepted:** **low.** The reasons: there is **no trust boundary** (§3.1 does not fire);
the phase's central claim is a **measurement taken before planning**, re-runnable from a file that
tells its reader to re-derive it; **every review finding was closed with a named commit**, four of them
by overruling the review; and the backend failing set is identical to baseline by name rather than by
count. ⚠ **What keeps it from being lower** is that the unexamined half is almost entirely **copy and
declined-guardrail judgement** on a user-visible surface — and `250-REVIEW.md`'s own record shows a
proposal being wrong four times out of thirteen, which is a good argument for having a second reader
rather than against it.

**Re-open trigger:** any phase whose `files_modified` names `backend/app/services/agent_loop.py`,
`backend/app/services/run_producer.py` or `frontend/src/components/panel/TodosSection.tsx`; **or**
`BUG-260915-01` being scheduled; **or** the `HONEST-02` behavioural rows or the live parallel-thread
axis being driven; **or** an independent reviewer acquiring capacity. ⭐ **A refusal taken for want of
a reviewer is not spent by having been taken.**

⭐ **VOID IF ANSWERED.** If `BUS-250` is answered at any time, before or after 2026-09-24, the verdict
artifact is `250-REVIEW-IND.md` written by the reviewer, this draft is void, and the row's
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

---
type: debt-refusal-draft
requirement: DEBT-06
phase: 253-the-bootstrap-artifact-tells-the-whole-truth
written: 2026-09-17
author: claude (the BUILDER)
decided_by: pending — operator (D-05)
kind: recorded-decision-not-review
review_type: self-assessed
status: voided-by-independent-review   # Voided 2026-09-19 by 253-REVIEW-IND.md (Gemini independent review passed).
effective_from: 2026-09-24
bus_item: BUS-257
independent_review_after_ruling: refused
---

# Phase 253 — The bootstrap artifact tells the whole truth · **DRAFT REFUSAL — the WEAKEST case of the five**

| | |
|---|---|
| Dispatched reviews | `253-REVIEW.md` (10 files, 2 critical / 11 warning / 5 info) **and** `253-REVIEW-R2.md` (7 files, 2 critical / 7 warning / 6 info) — **both authored by claude, the builder** |
| Trust boundary | ⚠ **YES — privilege model and greenfield ACLs.** `AGENTS.md` §3.1 arms 1, 3 and 5 all fire on this phase |
| `verification_mode` | `self-verified` · `independent_review: owed` |
| Bus item | **`BUS-257`**, filed 2026-09-16, amended 2026-09-17 with the deadline and rank 2 of 5; **still `[OPEN]`** |
| What the reviewer would have tested | the **13 unfixed findings** of `SEED-290` — whether each was dispositioned correctly, and in particular `WR-05` and `WR-04` |
| Rank | **2 of 5** (`251 → 253 → 252 → 249 → 250`) |

⛔ **THIS IS THE WEAKEST OF THE FIVE DRAFTS, AND SAYING SO IS THE POINT.** 252 and 253 are the pair
`AGENTS.md` §3.1's critical-phase test catches — *credentials or secrets*, *the permission or approval
model*, and *anything that can fail OPEN* — and §3.1's answer to a critical phase is to **swap the
seats**, not to skip one. A refusal on a security-bearing phase is therefore a **higher** residual
risk than a refusal on a bookkeeping one, and the risk line below reads that way rather than reading
`low` out of habit. `DEBT-06-REFUSALS.md` graded its own five (*"strongest case of the five"* down to
weaker); flattening that grading is how a refusal set stops carrying information.

## Three things the facts table carries without resolving, because neither side refutes the other

1. ⚠ **`253-VERIFICATION.md` reads `status: gaps_found` while its ROADMAP Progress row reads
   `COMPLETE`.** Re-derived here, not recalled: the frontmatter key and the row were read directly
   today. **Neither refutes the other** — the gap-closure round and the two G-3 fast-fixes landed
   *after* the verification was written, and the gap it names is bookkeeping (R2's residue having no
   register), which `SEED-290` then closed. A draft that cited one as disproving the other would be
   manufacturing a contradiction out of a sequence (`254-CONTEXT.md` M-4).
2. ⚠ **The registers disagree on whether this is the FIFTH or the SIXTH consecutive self-verified
   close**, and the disagreement is left visible on purpose. `253-VERIFICATION.md:55` and `:158` say
   **sixth** (counting 249, 250, 251, 252, 253's first verification and its re-verification);
   `STATE.md:75` and the superseded half of the ROADMAP row say **fifth**. The ROADMAP's live verdict
   settles it as *"the **SIXTH** consecutive self-verified close, not the fifth"* — and the older
   sentence is preserved beside it rather than overwritten, which is this project's house style and
   the reason the disagreement is still readable at all.
3. ⚠ **`SEED-290` records thirteen findings that were deliberately NOT fixed**, each with a re-open
   trigger. They are an input to a review, not a defect in this refusal.

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

⭐ **This phase's deliverable is largely a GATE, and a gate is the one artifact whose claim a stranger
re-runs rather than judges.** Everything in this table was **driven today, on this tree**, except
where marked `[recorded]`.

| Evidence | Command a third party re-runs | Result today |
|---|---|---|
| the ACL parity scan | `node scripts/check-schema-acl-parity.cjs` | **`mirrored: 133/133`** — 61 function + 72 table/column tuples, 32 statements across 12 migrations, 148 migrations scanned, exit 0 |
| the gate's own non-vacuity | `node scripts/check-schema-acl-parity.cjs --self-test` | **`37/37 assertions`**, exit 0 — including the collapsed-scan-set and missing-artifact harness-error arms |
| the artifact the gate protects is unchanged | `md5sum supabase/full-schema.sql` | **`a4f570396a44035102567ec1e3b7ff62`** — identical to the hash the orchestrator restored after both of its RED drives |
| the supplement tail | printed by the scan | `653 lines · md5 da9c561634d417ebd289bedf07b75f69` |
| the greenfield harness on a real scratch DB | `python scripts/check-greenfield-privileges.py` | `[recorded]` — `253-VERIFICATION.md`: exit 0, `access_token_ciphertext` as `authenticated` → `permission denied`, 1045 derived violations → 0, zero scratch DBs left behind. **Not re-driven here** (it needs a live database); it is named as recorded evidence, not as a measurement of this session |
| the two RED drives | strip 3 `resize_embedding_column` REVOKEs / neuter both ACL regexes | `[recorded]` — orchestrator-driven on the merged tree: exit **1** and exit **2** where the pre-fix gate read **0**, `full-schema.sql` restored md5-identical both times |

⭐ **A gate that has been driven RED by a third party, on a hash that still matches, is the strongest
non-review evidence this project produces.** CR-01 and R2-CR-01 were each re-driven by the
orchestrator rather than taken on the executor's word, which is a partial structural separation —
**partial, because the orchestrator and the executor were the same agent's session.**

### ⚠ CORRECTION, MEASURED 2026-09-17 BEFORE THIS FILE WAS WRITTEN — an owed item this draft was told to name has been DISCHARGED

`254-03-PLAN.md` asked this file to record, as an owed item, that *"`schema-acl-parity.yml` has never
executed (`gh run list` → HTTP 404, not on `master`), so `--self-test`'s only runner has never run."*
That sentence was true when `253-VERIFICATION.md` wrote it and it is **false now**, so it is corrected
here rather than copied forward — *a claim about the tree must be driven before it is written*:

```
$ gh run list --workflow=schema-acl-parity.yml --limit 10
completed  success  docs(253): ROADMAP row was stale three ways …  schema-acl-parity  develop  push  35231275221  21s  2026-09-17T14:05:28Z

$ gh run list --workflow=backend-tests.yml --limit 6
completed  success  test(252): pin the must-pass fence step's condition and bounds (WR-09)  …  15m36s  2026-09-17T16:19:49Z
completed  success  ci(253): the must-pass fence could never RUN — `if: always()` was mis…  …  15m39s  2026-09-17T14:45:21Z
completed  failure  docs(253): ROADMAP row was stale three ways …                          …  37m14s  2026-09-17T14:05:28Z
completed  failure  Merge develop into master — release candidate v4.1 …                   …  2026-09-13
```

⭐ **Both workflows have now run, and both are green** — `schema-acl-parity` on its first execution
ever, and `backend-tests` green for the first time in this repository's history after 40 consecutive
failures. **This strengthens 253's mechanical case rather than weakening it**, and it is exactly the
class of fact a stale register hides: the owed item was discharged by a push, hours after the file
that recorded it as owed.

⚠ **What is still owed and is NOT discharged by that run:** `253-VERIFICATION.md`'s human-verification
row asked for a **deliberately unmirrored REVOKE** and a **neutered ACL regex** to be pushed and seen
to turn the job RED. One green run proves the job executes; it does not prove the job can fail.

## What a reviewer would have tested that this cannot

⛔ **The judgement, named in one sentence: whether `SEED-290`'s thirteen unfixed findings were
correctly dispositioned.** A measurement cannot answer that — the findings are *not fixed by
decision*, and the decision is precisely what a second reader is for. Two of the thirteen carry the
weight:

- **`WR-05` — `E'…'` escape strings defeat BOTH lexers**, reproducing CR-02/CR-03 exactly one syntax
  over, in the **permissive** direction: a `SELECT E'a \' -- x';` followed by a `REVOKE` yields one
  chunk and the REVOKE is **dropped**. It is **latent** (zero `E'` in migrations, the supplement or
  the artifact, measured) — ⛔ **and latent is not safe; it is unfenced.** A reviewer would rule on
  whether *"latent"* is an acceptable resting place for the same defect class this phase exists to
  kill, on a gate whose failure direction is permissive.
- **`WR-04` — a docstring THIS PHASE ITSELF ADDED is false**, and it is the stated reason another
  finding (`WR-09`, parser unification) was deferred. ⛔ **A deferral resting on a refuted premise is
  not a deferral a measurement can validate.** Only a reader can decide whether the deferral survives
  its premise being wrong.

Three more things a reviewer reaches and a gate does not: whether the **five-finding scope lock** was
the right cut (`IN-05` was shown to the operator and declined by name, which is a decision — the other
twelve were not); whether the R2 blockers being *the same vacuity class the phase exists to kill*
indicates a systemic gap rather than two bugs; and whether the two G-3 fast-fixes taken inline instead
of a round 2 were genuinely `/gsd:fast`-sized.

**Residual risk accepted:** **HIGH** — and the reason is the trust boundary, not the evidence quality.
This phase sits on `AGENTS.md` §3.1's credential, permission-model and fail-open arms simultaneously;
its gate's failure direction is **permissive**; and it carries thirteen unfixed findings one of which
(`WR-05`) is a live, unfenced instance of the exact defect class the phase was built to close. ⚠ §3.1
also records the asymmetry honestly: *"Gemini reviewing Claude's security work is a weaker review than
the reverse."* **A refusal is weaker still.** This is the one of the five whose refusal an operator
should be most reluctant to rule.

**Re-open trigger:** any phase whose `files_modified` names a path in `SEED-290`'s `trigger_paths`;
**or** the first `E'` literal to reach `supabase/migrations/` or `scripts/full-schema-supplement.sql`
(`WR-05`); **or** the next time the `ON ALL TABLES IN SCHEMA` divergence is cited as a reason to defer
parser unification (`WR-04`, measured FALSE); **or** an independent reviewer acquiring capacity.
⭐ **A refusal taken for want of a reviewer is not spent by having been taken.**

⭐ **VOID IF ANSWERED.** If `BUS-257` is answered at any time, before or after 2026-09-24, the verdict
artifact is `253-REVIEW-IND.md` written by the reviewer, this draft is void, and the row's
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

---
type: debt-refusal-draft
requirement: DEBT-06
phase: 251-register-integrity
written: 2026-09-17
author: claude (the BUILDER)
decided_by: pending — operator (D-05)
kind: recorded-decision-not-review
review_type: self-assessed
status: voided-by-independent-review   # Voided 2026-09-19 by 251-REVIEW-IND.md (Gemini independent review passed).
effective_from: 2026-09-24
bus_item: BUS-249
independent_review_after_ruling: refused
---

# Phase 251 — Register Integrity · **DRAFT REFUSAL — the middle case of the five**

| | |
|---|---|
| Dispatched review | `251-REVIEW.md` — ⚠ **it did not exist when this phase was scoped.** Written by plan `254-02` on 2026-09-17, standard depth, 9 files, range `600e28dde..de6986fa2`. **Authored by claude, the builder** |
| Its frontmatter | `discharges_debt_06: false` — an explicit key, not an omission |
| Its findings | **2 critical · 0 blocker · 2 warning · 3 info · 0 resolved_in_phase** |
| Its verdicts | `still_live: 4 · fixed_since: 0 · refuted: 0 · not_driven: 0` |
| Trust boundary | **none** — this phase wrote a register contract, a gate and two GSD wirings |
| `verification_mode` | `self-verified` · ⚠ **`independent_review` — the key is ABSENT, see below** |
| Bus item | **`BUS-249`**, filed 2026-09-16, amended 2026-09-17 with the deadline and rank 1 of 5; **still `[OPEN]`** |
| What the reviewer would have tested | the D-07 date rule on the eight renumbers, and D-17's decision to leave product-source references pointing at stubs |
| Rank | **1 of 5** — measured: it was the only one of the five with no review artifact of any kind |

## ⛔ READ THIS FIRST — the fresh review file changes nothing, and that is the whole point

**`251-REVIEW.md` is a QUALITY FLOOR, not a review.** `D-08` asked for it so that no phase of v4.2
ships wholly unread, and it is labelled in its own frontmatter as the self-assessment it is: claude
planned Phase 251, executed all four of its plans, verified it in one session, and then read it.

⛔ **`DEBT-06-AUDIT.md`'s counting rule therefore makes it a CODE-REVIEW PASS and not an `AGENTS.md`
§6.3 review** — *a review file whose frontmatter does not assert the `independent` marker is a
code-review pass* — and the file carries `discharges_debt_06: false` as an explicit key rather than
leaving the reader to infer it from an omission. **It ticks nothing.** `251-VERIFICATION.md` is
byte-unchanged by it, the ROADMAP Progress row is untouched by it, and `BUS-249` — the ask that a
second agent read this phase — **stays OPEN and is answered by none of it.**

⛔ **A FLOOR PASS RAISES THE FLOOR AND MOVES NO REGISTER, SO IT IS BARRED FROM THE RISK ARGUMENT
BELOW.** The residual-risk line on this page is justified by the *shape of the deliverable* and by
the *absence of a trust boundary* — never by the existence of `251-REVIEW.md`. Using a builder's
reading of its own work to argue that the same builder's refusal is low-risk would be circular, and
it is the precise move `AGENTS.md` §6.3 exists to forbid. ⚠ **If anything, that file cuts the other
way: it found two live criticals and two warnings, all four still open, past a green self-verified
close.** A reading that returns four still-live findings is evidence *for* a reviewer, not against.

⚠ **AND THE REGISTER FACT THAT MAKES 251 DIFFERENT FROM THE OTHER FOUR:
`251-VERIFICATION.md` CARRIES NO `independent_review` KEY AT ALL.** Re-driven today —
`grep -c independent_review .planning/phases/251-register-integrity/251-VERIFICATION.md` returns
**`0`**, where the other four return a value. ⛔ **A sweep counting the owed rows therefore returns
4 and silently omits 251**, which is the same invisibility class as a hot file with no ledger row —
this phase's own thesis, landing on this phase's own file. **The key is ADDED, never flipped**, and
plan `254-04` owns that write. ⛔ **This draft does not make it**, so where the closing disclaimer
below speaks of the phase keeping `independent_review: owed`, that is the state the row will read
once `254-04` adds the key — not a state this file writes or claims already exists.

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

⭐ **This phase's deliverable is a GATE plus a mechanical backfill, and both are the kind of claim a
stranger RE-RUNS rather than judges.** Everything below was driven today, on this tree.

| Evidence | Command a third party re-runs | Result today |
|---|---|---|
| the register gate | `node scripts/check-seeds-register.cjs` | **`297/297 parsed · 0 duplicate ids · 297/297 carry all 5 required keys`**, exit 0 |
| the gate's own non-vacuity | `node scripts/check-seeds-register.cjs --self-test` | **`8/8 arms PASS`**, exit 0 — duplicate id, the stub carve-out, the carve-out's SHAPE, bad status, a heading claiming the wrong id, match, the counterfactual, the empty-register floor |
| the eight renumbers each have exactly one redirect stub | `grep -l "status: superseded-id" .planning/seeds/SEED-*.md \| wc -l` | **8** |
| the D-11 body invariant | blob-vs-blob via `git ls-tree` + `git show`, **never a working-tree read** | `[recorded, and independently reproduced by 254-02]` — `exactMatch 284/284 · lineEndingOnly 0 · realContentDiff 0` on the migration commit, and `{272, 0, 4, 8}` reproduced exactly on the verification's own range |
| the two GSD wirings are real | extract the fenced command by line range and **run it** | `[recorded, 254-02]` — both fences executed to exit 0; `grep` over `.claude/commands/gsd/` returns **0**, confirming correct placement in `workflows/` |

⚠ **The register read `293/293` at the phase's close and reads `297/297` today. That is GROWTH, not
drift** — the gate's contract is *every file parses* and *zero duplicate ids*, never a fixed total, so
a reader who measures a larger number has measured the correct current one. Re-derive rather than
doubt it.

⭐ **The strongest single fact available here: `254-02` re-drove this phase's own D-11 body-identity
figure with a different instrument and reproduced it exactly** — and in doing so caught its **own**
instrument reading `frontmatter(text).end` on a regex match array, which silently compared whole
files and reported 242 false diffs. **Two wrong instruments, one correct answer.** A number that
survives being re-measured by a differently-broken tool is about as close to independent corroboration
as a mechanical claim gets without a second agent.

## What a reviewer would have tested that this cannot

⛔ **The first judgement, named in one sentence: whether D-07's date rule actually decided the eight
renumbers, on a register where `seedDate()` is not total.** D-07 chose *"the oldest keeps the id, by
date"* precisely because it *"needs no judgement and reproduces on a re-run"* — and **six of the
register's seeds return `null` from that function**, `SEED-001` among them, which carries its date
inside a `planted_during:` prose string that no key reads. For those, the rule **does not reproduce**:
it degrades to a git tie-break or to a human, and **the gate raises no finding when it does**. A
measurement can show that the eight resolutions are *consistent*; only a reader can say whether each
was *right*, and whether a rule that silently degrades is the rule the phase claimed to install.

⛔ **The second judgement: D-17's decision to leave 35 product-source files pointing at redirect
stubs.** That is a deliberate boundary, listed file by file in `251-RENUMBER-LEDGER.md` and recorded
as *not re-litigated*. ⚠ **A boundary and a defect are indistinguishable to a gate** — both read as
"unchanged" — so the only instrument that can tell them apart is a second reader who was not the one
who drew the line. The same applies to D-06's 378+ sealed-milestone references and to D-18's
mechanical-only backfill.

A third thing a reviewer reaches: whether the **two unswept figures** (`134 carry no trigger_when at
all · 114 carry prose but no structured trigger`) being printed honestly and never summed is a
sufficient answer, or whether a register that is 84% unswept has closed its own thesis.

**Residual risk accepted:** **low-moderate.** ⛔ **The reasons, and note that the floor pass is not
among them:** (a) there is **no trust boundary** — no credential, no egress, no permission model, no
migration, no product source file was touched, so `AGENTS.md` §3.1's critical-phase test does not fire
on this phase at all; (b) the deliverable is **continuously machine-checked** by the gate it installed
plus two executable wirings, which is the one case where a reviewer adds least; and (c) the phase's
own body-identity invariant is **blob-proven**, not asserted. ⚠ **What pushes it above `low` is that
four findings from a builder's own reading are still open, two of them critical**, and that both
criticals are *absences of a counterfactual* — the class of defect that is invisible until the day it
matters.

**Re-open trigger:** any phase whose `files_modified` names `scripts/check-seeds-register.cjs`,
`scripts/migrate-seeds-frontmatter.cjs`, `.planning/seeds/TEMPLATE.md`, or any of the three
`.claude/get-shit-done/workflows/` files this phase wired; **or** a ninth id collision involving one of
the six dateless seeds; **or** a framework update reverting the vendored wirings (`WR-02`); **or** an
independent reviewer acquiring capacity. ⭐ **A refusal taken for want of a reviewer is not spent by
having been taken.**

⭐ **VOID IF ANSWERED.** If `BUS-249` is answered at any time, before or after 2026-09-24, the verdict
artifact is `251-REVIEW-IND.md` written by the reviewer, this draft is void, and the row's
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

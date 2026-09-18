---
type: debt-refusal-draft
requirement: DEBT-06
phase: 252-close-the-v42-audit-gaps
written: 2026-09-17
author: claude (the BUILDER)
decided_by: pending — operator (D-05)
kind: recorded-decision-not-review
review_type: self-assessed
status: draft-pending-operator-ruling
effective_from: 2026-09-24
bus_item: BUS-256
independent_review_after_ruling: refused
---

# Phase 252 — Close the v4.2 audit gaps · **DRAFT REFUSAL — the second-weakest case of the five**

| | |
|---|---|
| Dispatched reviews | `252-REVIEW.md` (28 files, 2 critical / 9 warning / 3 info) **and** `252-REVIEW-R2.md` (11 files, `verdicts: still_live: 10 · fixed_since: 0 · refuted: 0`) — **both authored by claude, the builder** |
| Trust boundary | ⚠ **YES — credential boundary and privilege model.** `AGENTS.md` §3.1 arms 1 and 3 fire; B-1 and B-2 were live security defects |
| `verification_mode` | `self-verified` · `independent_review: owed` |
| **`base:`** | **`53e2435b7`** — verbatim from `252-VERIFICATION.md` frontmatter |
| **`head:`** | **`1ee7903f0`** (+ that commit) — verbatim from the same frontmatter |
| Bus item | **`BUS-256`**, filed 2026-09-16, amended 2026-09-17 with the deadline and rank 3 of 5; **still `[OPEN]`** |
| What the reviewer would have tested | whether the **seven refuted inherited claims** were refuted correctly, and whether **W-5** and **W-9** genuinely needed no work |
| Rank | **3 of 5** (`251 → 253 → 252 → 249 → 250`) |

⭐ **THE `base:` / `head:` PAIR IS THE MOST VALUABLE LINE IN THIS FILE.** It is the one thing in this
set of five that hands a future reviewer a ready-made range — `git log 53e2435b7..1ee7903f0` and
`git diff 53e2435b7..1ee7903f0` are both runnable the moment someone picks `BUS-256` up. **Naming it
here is what makes this refusal cheap to reverse**, which is the property a time-boxed refusal needs
most: the door stays open because the cost of walking through it stays low.

⛔ **THIS IS THE SECOND-WEAKEST OF THE FIVE, AND FOR THE SAME REASON AS 253.** 252 and 253 are the
**security-bearing pair** — the two phases `AGENTS.md` §3.1's critical-phase test catches, on its
*credentials or secrets* and *permission or approval model* arms. §3.1's prescribed answer to a
critical phase is to **swap the seats**, not to skip one. A refusal on a security-bearing phase
therefore carries a **higher** residual risk than a refusal on a bookkeeping one, and the risk line
below says so rather than reading `low` out of habit.

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

| Evidence | Command a third party re-runs | Result |
|---|---|---|
| the phase's own commit range | `git log 53e2435b7..1ee7903f0` · `git diff 53e2435b7..1ee7903f0` | published in `252-VERIFICATION.md` frontmatter as `base:` / `head:` — **runnable without re-deriving anything** |
| the backend gate | `pytest tests/unit -q --continue-on-collection-errors` | `[recorded]` — at the locked ceiling with an **identical failing node-id set**, 0 new and 0 gone. A count would not have shown this; the SET was diffed |
| the frontend typecheck | `npx tsc -p tsconfig.app.json --noEmit` | `[recorded]` — **67 to 65**, a strict subset proven by a normalised `diff` rather than by counts |
| the count gate | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` | `[recorded]` — failing set empty before and after |
| the new ACL parity gate **firing for real on run one** | `node scripts/check-schema-acl-parity.cjs` | driven again today: **`mirrored: 133/133`**, exit 0. At the phase it fired over three function ACLs outside migration 181 that were mirrored by nothing — including **`resize_embedding_column`**, the RPC `BUG-260911-01` found callable unauthenticated in production, which NULLs every vector, and which **every greenfield deploy re-opened** |
| the gate's own non-vacuity | `node scripts/check-schema-acl-parity.cjs --self-test` | driven today: **`37/37 assertions`**, exit 0 |

⭐ **A gate that finds a real, live, previously-unknown privilege hole on its first execution is the
strongest available evidence that the gate is not vacuous** — and vacuity is the failure mode this
whole family of checks keeps re-paying for.

⚠ **AND THE HONEST COUNTERWEIGHT, which a refusal must carry rather than omit: `252-REVIEW-R2.md`
reads `still_live: 10 · fixed_since: 0 · refuted: 0`.** Ten of the findings `252-REVIEW.md` raised
were re-driven on 2026-09-17 and every one was **still live**. Four others (CR-01/02/03/08) were
closed by Phase 253 and deliberately not re-verified. ⛔ **This is not a phase whose review findings
are all closed, and this draft does not pretend otherwise.**

## What a reviewer would have tested that this cannot

⛔ **The judgement, named in one sentence: whether the seven refuted inherited claims were refuted
CORRECTLY.** The phase's headline output is a set of refutations — *"its method is its main output"* —
and a refutation is a claim in exactly the way the claim it replaced was. ⚠ **Three of the seven were
refutations of this phase's OWN planning documents**, which is the shape most in need of a second
reader: the agent that wrote the claim also wrote the refutation and also graded it.

| # | The refuted claim | What 252 measured instead | Why only a reviewer settles it |
|---|---|---|---|
| 4 | **its own plan**: the B-2 probe proves the leak | ⛔ **FALSE GREEN** — the key shape is redacted before `caplog`, so it passed *pre-fix* | a test that would have certified a live credential leak as closed. Whether the **replacement** probe is sound is the same question one level down, and nobody has read it |
| 5 | **its own plan**: migration 181 has 31 REVOKEs / 17 GRANTs | **30 / 20** — the 31 counted a comment line; the 17 is arithmetically impossible | the arithmetic is checkable; whether the corrected figures were then used correctly is not |
| 6 | **its own plan**: `MIN_MIGRATION_FILES = 150` | **148** files exist — a 150 floor exits 2 **forever** | the floor's *value* is a judgement about headroom, and it was chosen by the same agent that set it |
| 1-3, 7 | three audit claims plus a ROADMAP row `D-37` asserted was already ticked | in-both-knobs · five not six · the repair path **exists, unnamed** · the row read unticked | each correction is credible and each was self-graded |

⛔ **The second judgement: whether `W-5` and `W-9` genuinely needed no work.** Both are recorded as
*"resolved clean at the audit — no work"*. **A warning closed with zero work is the one disposition a
gate can never confirm** — there is no diff to inspect, no test to run, and no artifact to hash. It is
a reading, and a reading by the builder of its own warning is precisely what §6.3 distrusts.

A third thing a reviewer reaches: whether the ten `still_live` findings in `252-REVIEW-R2.md` are
correctly left open, or whether any of them belongs in the security-bearing set that had to be fixed.

**Residual risk accepted:** **moderate** — driven by the trust boundary and by the ten still-live
findings, not by weak evidence. The mechanical half of this phase is unusually strong: a named commit
range, an identical failing node-id set, a subset-proven typecheck, and a gate that caught a live
production privilege hole on its first run. What is unexamined is the **judgement** half — seven
self-graded refutations, two zero-work warning closures, and ten open findings — on a phase §3.1
classifies as critical, and where §3.1 also records that even a cross-agent review of security work is
*"a weaker review than the reverse"*.

**Re-open trigger:** any phase whose `files_modified` names `backend/app/api/connectors.py`,
`backend/app/services/connector_service.py`, `backend/app/api/setup.py`,
`scripts/check-schema-acl-parity.cjs` or `scripts/full-schema-supplement.sql`; **or** migration 181
reaching cloud; **or** the owed G-4 **S2** BYO-OAuth row being driven live; **or** an independent
reviewer acquiring capacity. ⭐ **A refusal taken for want of a reviewer is not spent by having been
taken.**

⭐ **VOID IF ANSWERED.** If `BUS-256` is answered at any time, before or after 2026-09-24, the verdict
artifact is `252-REVIEW-IND.md` written by the reviewer, this draft is void, and the row's
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

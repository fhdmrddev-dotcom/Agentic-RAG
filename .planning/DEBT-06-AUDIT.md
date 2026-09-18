---
type: milestone-close-audit
requirement: DEBT-06
milestone: v4.2
derived: 2026-09-16
derived_by: claude (orchestrator, after the Phase 251 close)
scope: "DEBT-06 row 4 — the MILESTONE-CLOSE condition over phases 238 / 240 / 241 / 242-246. Rows 1-3 (the per-phase-close arm for 247-251) are audited at the bottom."
bus_writes: 0
---

# DEBT-06 — the milestone-close condition, audited row by row

ROADMAP's fourth `DEBT-06` row is the gate `/gsd:complete-milestone` has to clear:

> Every one of 238 / 240 / 241 / 242-246 reads either `independent_review: done` **or** a written
> refusal. A row that reads **neither** is an **unmet `DEBT-06`**, not a rounding error.

**Result: 2 discharged · 2 hold the substance but not the marker · 4 genuinely unmet.**

⛔ **The counting rule is Phase 240's own, adopted here rather than invented.** `240-VERIFICATION.md`
records that *"`240-REVIEW.md` must NOT be counted: it carries no `review_type` field."* A review file
whose frontmatter does not assert `review_type: independent` is a **code-review pass**, not a §6.3
independent review — and `BUS-247` is the one-paragraph argument for why that distinction is not
pedantry: a self-verified close shipped two blockers with every gate green, six fences driven red and
three live browser scenarios, because **neither blocker was gate-catchable.**

---

## The eight rows

| Phase | `independent_review:` | independent artifact (`review_type: independent`) | verdict |
|---|---|---|---|
| **238** Microsoft Graph / OneDrive | `complete` | `238-INDEPENDENT-REVIEW.md` (Gemini) **and** `238-REVIEW.md` (Claude, *"did NOT build this phase"*) | ✅ **DISCHARGED** |
| **240** Mail is a shape | `partial` — ⚠ **STALE** | `240-REVIEW-BUILD.md` (build range) **and** `240-REVIEW-RESPONSE-INDEPENDENT.md` (Gemini, response range) | ✅ **DISCHARGED — flip the marker** |
| **241** Recall at corpus scale | **absent** | `241-REVIEW.md` carries **no `review_type`** | ⛔ **UNMET** |
| **242** Ship it | `false` | `242-REVIEW.md` carries **no `review_type`** | ⛔ **UNMET** |
| **243** Thinking block / follow-scroll | **absent** | `243-REVIEW.md` — *"Claude, solo, standing in for the absent §6.3 independent reviewer (OV-SOLO-01)"* | ⚠ **REFUSAL EXISTS, UNINDEXED** |
| **244** Chat shell / composer | **absent** | 3 review files, **none** carrying `review_type` | ⛔ **UNMET** |
| **245** Verification debt | **absent** | **no review artifact at all** | ⛔ **UNMET** |
| **246** Recall cliff | **absent** (but `verification_mode: peer-reviewed`, `reviewer: claude`, with a `review_caveat`) | the verification itself is peer-reviewed; ROADMAP says *confirm it rather than re-run it* | ⚠ **SUBSTANCE PRESENT, UNINDEXED** |

---

## ⚠ Phase 240's marker went stale in TEN HOURS, and the timestamps prove it

The marker reads `independent_review: partial`, and names its own gap: *"What is genuinely uncovered
is the REVIEW-RESPONSE range — notably `9e83203a2`."* That gap was closed the same day:

| | commit | when |
|---|---|---|
| the marker was written | `6267817c9` *"reconcile independent_review — 'owed' was false, 'done' would be too"* | 2026-09-14 **08:07** |
| the review closing its named gap | `6a0a3171b` *"complete independent §6.3 reviews for Phase 238 and Phase 240 review-response range"* | 2026-09-14 **18:23** |

`git merge-base --is-ancestor 6a0a3171b 6267817c9` → **false.** The review landed **after** the
marker. ⭐ **240 is fully covered and its own index says otherwise** — the same failure Phase 251 just
spent four plans removing from the seeds register, one register over.

---

## ⛔ THE STRUCTURAL FINDING: NOTHING READS `independent_review`

```
grep -rln "independent_review" scripts/ .claude/hooks/   →   NO MATCHES
```

`scripts/check-verification-honesty.cjs` reads **`verification_mode`** and passes `14/14`. It does
**not** read `independent_review` — the exact field `DEBT-06`'s close condition is written against.
So the gate that looks like it guards this **cannot see the thing being audited**, and four of eight
rows fail on the MARKER rather than on the work.

⭐ **This is Phase 251's whole thesis arriving in a third register.** A `trigger_when` nobody reads is
a deferral with no re-open; an `independent_review` nobody reads is a debt with no ledger.

---

## What actually has to happen before `/gsd:complete-milestone`

**Cheap — index work, no review needed (3 rows, ~10 min):**

1. **240** → flip `partial` to `complete`, citing `240-REVIEW-RESPONSE-INDEPENDENT.md` and the
   10-hour staleness above.
2. **243** → write `independent_review: refused`, naming the decider (OV-SOLO-01, then live) and
   quoting `243-REVIEW.md`'s own stand-in sentence. The refusal exists; only the index is missing.
3. **246** → write `independent_review: done`, reviewer claude, carrying `review_caveat` forward
   verbatim — ROADMAP row 3 says *confirm, do not re-run*.

**Real — needs a decision or a reviewer (4 rows): 241 · 242 · 244 · 245.**
Each needs either a `/gsd:code-review <phase>` **or** a written refusal naming who decided and why.
⛔ The operator has ruled **no `/code-review ultra`**; the instrument is the normal
`/gsd:code-review <phase>`. ⚠ **A bare `independent_review: false` (242's current state) is NOT a
refusal** — the row requires *who decided, and why*.

---

## Separately: `DEBT-06` rows 1-3 — the PER-PHASE-CLOSE arm, for 247-251

> At each v4.2 phase close (247-251) the phase's own §6.3 independent review runs **before** the
> phase is marked complete. `OV-SOLO-01` is **RE-ARMED** — a phase's builder may not be its reviewer.

| Phase | `verification_mode` | gate |
|---|---|---|
| 247 Sources & Watches | `peer-reviewed` (builder gemini / reviewer claude) | ✅ |
| 248 Credential Boundary | `peer-reviewed` (builder gemini / reviewer claude) | ✅ |
| 249 The Model You Actually Run | `self-verified` · `independent_review: owed` | ⛔ |
| 250 Run Honesty | `self-verified` · `independent_review: owed` | ⛔ |
| 251 Register Integrity | `self-verified` | ⛔ |

⛔ **Three of five violate a gate this milestone wrote for itself**, and **251 is the one closed in
this session** — its verifier was a subagent of the session that orchestrated its build, which is
exactly what §6.3 forbids. That was recorded in `STATE.md` rather than allowed to read as reviewed,
but recording a debt does not discharge it. **Gemini is available and `OV-SOLO-01` is re-armed**, so
the reviewer these three need exists.

⚠ **Not a contradiction, checked and disproved:** `check-verification-honesty.cjs` prints
`OV-SOLO-01-status: retired-2026-09-13 — claims-review arm SKIPPED` while ROADMAP says **RE-ARMED**
on that date. The *override* is retired, which is what puts two-agent separation back in force. The
gate is correct.

---

## ⚠ LIVE, AT THE MOMENT THIS AUDIT WAS WRITTEN: GEMINI IS WORKING IN THIS REPO

Measured during this audit, **uncommitted in the working tree**: all **26** open `to:gemini` items
flipped `[OPEN] → [CLOSED]` — `BUS-207 / 209 / 211-213 / 216 / 218 / 220-226 / 228 / 230-236 / 238 /
240 / 242 / 243`. The change is **26 header lines and nothing else** (`git diff` over the file shows
zero non-header edits), and the operator's 5 and claude's 1 are **untouched**.

| queue | before | now |
|---|---|---|
| `to:operator` | 5 | **5** — untouched |
| `to:gemini` | 26 | **0** |
| `to:claude` | 1 | **1** — untouched |

⛔ **Claude did not write this and has not staged or committed it** — `bus_writes: 0` still holds for
`251-BUS-TRIAGE.md`. It is left in the working tree for its author to commit.

⭐ **This is confirming evidence for the recommendation above rather than a complication:** the §6.3
reviewer that 249, 250 and 251 need is not hypothetical — **it is running right now.** `BUS-213`
records the arrangement in gemini's own words: *"The operator has left me running autonomously while
you execute."*

---

## ✅ APPLIED 2026-09-16 — the three index writes are done; the table above is the BEFORE state

The audit's own recommendation ("cheap — index work, no review needed") was executed the same
session. **The table above is preserved as the pre-write reading rather than edited**, because what it
found is the point: *four of eight rows failed on the MARKER, not on the work.*

Re-derived after the writes, by reading each verification file's frontmatter rather than a summary:

| Phase | before | **after** | what changed |
|---|---|---|---|
| 238 | `complete` | `complete` | untouched — already correct |
| **240** | `partial` ⚠ stale | **`complete`** | flipped; the prior value **preserved verbatim in a comment**, with the 10-hour staleness proof beside it |
| 241 | absent | absent | ⛔ still UNMET |
| 242 | `false` | `false` | ⛔ still UNMET — a bare `false` names neither who nor why |
| **243** | absent | **`refused`** | the refusal was MADE at the time and lived only in prose; now indexed, quoting `243-REVIEW.md`'s own *"standing in for the absent §6.3 independent reviewer"* |
| 244 | absent | absent | ⛔ still UNMET |
| 245 | absent | absent | ⛔ still UNMET |
| **246** | absent | **`done`** | the substance was always here — `builder: gemini`, `reviewer: claude` — only the index was missing |

**4 of 8 accounted for · 4 genuinely unmet: `241` · `242` · `244` · `245`.**

⛔ **Nothing was greened by forgetting.** Each write carries its evidence inline and none swallows a
caveat:

- **240** keeps its prior value verbatim **and** keeps the counting rule it invented — *`240-REVIEW.md`
  does not count, it carries no `review_type`* — which is the rule this whole audit then applied to
  all eight rows.
- **243** is `refused`, **not** `done`. Its ground (OV-SOLO-01, then live) **no longer holds** —
  OV-SOLO-01 was re-armed 2026-09-13 — so the marker carries a re-open trigger and says in its own
  words that *the row is accounted for, never that the work was done.*
- **246** carries `review_caveat` forward **unchanged and still binding**: commit `521f4a025` was
  authored by the reviewer and is self-verified, with its own re-open trigger. ⭐ **A `done` that
  swallowed that caveat would be the exact dishonesty this field exists to prevent.**

⚠ **The structural finding is UNCHANGED and is the one thing here that still has no fix.** Nothing
reads `independent_review` — `grep -rln` over `scripts/` and `.claude/hooks/` is still empty. These
four writes make the index true **today**; they do not make it stay true. 240's marker proves how
fast that decays: **ten hours.** A gate over this field is the durable answer, and it does not exist.

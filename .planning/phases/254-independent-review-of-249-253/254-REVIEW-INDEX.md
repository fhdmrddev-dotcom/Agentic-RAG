---
type: review-index
phase: 254
plan: "04"
requirement: DEBT-06
derived: 2026-09-17
derived_by: claude (executor, plan 254-04)
scope: "the 249-253 arm of DEBT-06 (D-01). The older arm — 238 / 240 / 241 / 242-246, plus 239, which the requirement never named — is counted below and never ruled on."
review_type: self-assessed
debt_06_ticked: false
bus_items_opened_answered_or_closed: 0
bus_item_bodies_amended: 5
---

# Phase 254 — the review index · **the list you rule on**

⛔ **CLAUDE HAS OPENED, ANSWERED AND CLOSED NOTHING, AND THIS DOCUMENT IS NOT A DISCHARGE.**
Five rows are accounted for; **not one is reviewed**. The commands that would change that are at the
bottom, pre-filled with the ids, and they are **yours to run**.

**Read this in one sitting.** Five rows, ten findings, one structural finding, five commands.

## ⛔ What claude did NOT do — each claim with its command and its reading

| Claim | Command | Reading |
|---|---|---|
| opened / answered / closed **no** bus item | `git diff -U0 .agent-bus/OPEN.md \| grep -c '^[-+]### '` | **0** |
| the five item **bodies** were amended in place by `254-01`, headers untouched | `grep -cE '^### \[OPEN\].*to:gemini' .agent-bus/OPEN.md` | **9**, unchanged; `BUS-249` / `BUS-250` / `BUS-251` / `BUS-256` / `BUS-257` all still read `[OPEN] … 2026-09-16` |
| the script's `answer` verb is still usable on every item | `grep -c '^\*\*Answer:\*\*$' .agent-bus/OPEN.md` | **20** bare lines — none was appended to |
| **ruled on no refusal** | `grep -h '^status:' .planning/phases/25*/*-REVIEW-REFUSAL.md` | all five read `draft-pending-operator-ruling` |
| **flipped no `independent_review`** | `yaml.safe_load` on each of the five frontmatters | the parsed value is the string `owed`, five times |
| **ticked no box** | `grep -c '^- \[x\] \*\*DEBT-06\*\*' .planning/REQUIREMENTS.md` | **0** (and `- [ ]` reads **1**) |
| **fixed nothing** | `git status --short backend/ frontend/` | empty — no product source file is in this phase's blast radius |
| **repaired none of the three vocabulary defects** below | `git status --short .planning/milestones/` | empty — 238 / 240 / 241 / 242 / 243 / 244 / 246 are byte-unchanged |
| **edited no seed** | `git status --short .planning/seeds/` | empty |

⚠ **One phrase from the analog (`251-BUS-TRIAGE.md`) was deliberately NOT copied.** That document
asserts zero bus writes of any kind. **Plan `254-01` DID write to `.agent-bus/OPEN.md`** — five item
bodies were amended in place — so copying the phrase here would be a false claim. The two honest keys
are `bus_items_opened_answered_or_closed: 0` and `bus_item_bodies_amended: 5`, and the first is backed
by the header-diff above rather than by a phrase.

---

## The five rows, measured

Every cell re-derived from the file on disk at this close, not copied from the plan.

| Phase | `verification_mode` | `independent_review` | review artifacts on disk | bus item + age | draft refusal | what is still owed |
|---|---|---|---|---|---|---|
| **249** The model you actually run | `self-verified` | `owed` — key present since the close; its inline comment amended by `254-04` | `249-REVIEW.md` (claude, the builder) | **`BUS-251`** · filed 2026-09-16 · **1 day** · `[OPEN]` | `249-REVIEW-REFUSAL.md` — *strongest case of the five*, residual risk **low** | an `AGENTS.md` §6.3 review by an agent that did not build it |
| **250** Run honesty, the residue | `self-verified` | `owed` — comment amended; its `owed:` list gained **one** entry naming this apparatus, the five already there byte-unchanged | `250-REVIEW.md` (claude, the builder) | **`BUS-250`** · filed 2026-09-16 · **1 day** · `[OPEN]` | `250-REVIEW-REFUSAL.md` — *second-strongest*, residual risk **low** | the same |
| **251** Register integrity | `self-verified` | `owed` — ⛔ **the key was ABSENT for the phase's entire life and was ADDED by `254-04`**, together with `builder:` and `reviewer:` | `251-REVIEW.md` — written by `254-02`, `review_type: self-assessed`, `discharges_debt_06: false`, **2 critical · 0 blocker · 2 warning · 3 info**, `still_live: 4` | **`BUS-249`** · filed 2026-09-16 · **1 day** · `[OPEN]` | `251-REVIEW-REFUSAL.md` — *middle case*, residual risk **low-moderate** | the same. ⛔ The floor pass ticks nothing — a builder reading its own work is the arrangement §6.3 exists to prevent |
| **252** Close the v4.2 audit gaps | `self-verified` | `owed` — comment amended | `252-REVIEW.md` + `252-REVIEW-R2.md` (both claude, the builder) | **`BUS-256`** · filed 2026-09-16 · **1 day** · `[OPEN]` | `252-REVIEW-REFUSAL.md` — *second-weakest*, residual risk **moderate** | the same. ⚠ Security-bearing: §3.1's answer to a critical phase is to swap the seats, not to skip one |
| **253** The bootstrap artifact tells the whole truth | `self-verified` | `owed` — comment amended; `status: gaps_found` left alone | `253-REVIEW.md` + `253-REVIEW-R2.md` (both claude, the builder) | **`BUS-257`** · filed 2026-09-16 · **1 day** · `[OPEN]` | `253-REVIEW-REFUSAL.md` — ⛔ *the **WEAKEST** case*, residual risk **HIGH** | the same, and this is the row where refusing costs most |

⚠ **The age column is one day and that is not reassurance.** The asks sit behind a **9-item**
`to:gemini` queue, none of which has moved since 2026-09-16, and `254-CONTEXT.md` M-5 records that
**the reviewer cannot be driven from here** — the bus is the only channel and neither agent can wake
the other. That is why D-04 gives the deadline **2026-09-24** rather than blocking on an answer.

---

## The findings, triaged

⛔ **Recommended dispositions only. The operator rules (D-11), and this phase fixed nothing** — the
reviewer fixing what it found stops being an independent verifier of that fix (`AGENTS.md` §6.3).

### From `251-REVIEW.md` (written by `254-02`) — 7 findings, all still live

| # | Severity | Claim (one line) | Driven? | Recommended disposition |
|---|---|---|---|---|
| **CR-01** | CRITICAL | `--self-test` reports `8/8 arms PASS` with the `[missing-key]` check completely dead, while the same run's verdict line asserts `297/297 carry all 5 required keys` | **yes** — the dead arm was driven; the guard protecting D-09 is what fails | **next phase** |
| **CR-02** | CRITICAL | the `status` enum's *"change all three, or change none"* rule is prose with zero executable enforcement — a drifted `TEMPLATE.md` leaves the gate green | **yes** | **next phase** |
| **WR-01** | warning | `seedDate()` is not total: six seeds carry neither `created:` nor `planted:`, so D-07's tie-break rule is underivable for them | **yes** — every call site proven null-safe rather than assumed | **next phase** |
| **WR-02** | warning | both GSD wirings live in a vendored framework directory a framework update can revert, and nothing executable would notice | **yes** — both halves driven, no file modified | **next phase** |
| **IN-01** | info | the `STATUS_ENUM` docstring was falsified by its own phase, two plans later | yes | **fast-fix** |
| **IN-02** | info | `251-VERIFICATION.md`'s *"independently re-counted as 90"* is the figure that is off — the ledger's 91 is correct; an instrument mismatch, not rounding | yes | **accept** |
| **IN-03** | info | the four real body diffs the verification counted were never named; they are recorded so the next reader does not re-derive them | yes | **accept** |

`verdicts: still_live: 4 · fixed_since: 0 · refuted: 0 · not_driven: 0`.

### ⭐ Three findings **Phase 254 itself produced**, from plan `254-04`'s own derivation

⛔ **These are NOT `251-REVIEW.md`'s, and none is this phase's to repair.** A vocabulary fix across
ten phase files is a phase, not a review task (D-11 / G-7). Each was found by running the derivation
in §*Gate readings* below over every `*-VERIFICATION.md` in `.planning/phases/` **and**
`.planning/milestones/`, and reading the key rather than a summary.

| # | Severity | Claim | Measurement that found it | Recommended disposition |
|---|---|---|---|---|
| **254-F1** | warning | **`independent_review` has TWO SPELLINGS OF ONE STATE.** Phases 238 and 240 read `complete`; phase 246 reads `done`. They mean the same thing, and **any sweep written against one word silently misses the other** — the same invisibility class that hid 251 for its whole life, one register over. | `grep -m1 '^independent_review:'` over each file: `238=complete`, `240=complete`, `246=done`, against `243=refused` | **next phase** — pick one token, migrate all rows in one commit, and state the enum where the gate can read it |
| **254-F2** | warning | **`242` reads `independent_review: false`, a value in NO register's vocabulary.** It means neither owed, nor done, nor refused. `DEBT-06-AUDIT.md` already wrote down that *"a bare `false` names neither who nor why"* on 2026-09-16 — **and the value is still there**, which makes this a finding about the register's decay, not only about one row. | same derivation: `242=false` | **next phase** — same commit as 254-F1; a bare boolean cannot carry a decider or a reason |
| **254-F3** | warning | **`245` has no `*-VERIFICATION.md` at all**, so it can carry no value in any state — and yet **two registers hold a row for it**: `DEBT-06-AUDIT.md` counts it among the four *genuinely unmet*, while `DEBT-06-REFUSALS.md` lists it among the five refused. A row that has no file to hold it is a sharper instance of the same M-8 disagreement this phase already adopts a reading for. | the derivation's third bucket: `no *-VERIFICATION.md at all: 245`. Its verdict lives in `245-VERDICT.md`, which the honesty gate reads and the `independent_review` derivation cannot | **accept for now, re-open at `/gsd:complete-milestone`** — it is a two-register disagreement, and per the adopted reading below, settling it is the operator's ruling (`BUS-247`), not a plan's |

⭐ **A FOURTH, STRUCTURAL FINDING IS WHAT LETS ALL THREE PERSIST UNNOTICED — it is §*The structural
finding* below, and it is the reason to read these three as one story rather than as three typos.**
Nothing anywhere reads the field, so no drift in it can ever be surfaced by a gate; it is surfaced
only when a human happens to re-derive it, which on this evidence is roughly once per milestone.

### ⚠ And one more the derivation turned up, which is not a vocabulary defect but a gap

**`239` reads `independent_review: owed` on disk and `DEBT-06` never named it** — it is in neither
the `238 / 240 / 241` clause nor the `242-246` range as originally worded. It was added to the
amended requirement's unmet clause by `254-04`. ⛔ It is **not** in this phase's review scope (D-01),
and no ask exists for it on the bus. **Recommended disposition: next phase** — it needs an ask or a
refusal like the other nine. *A hand-typed list is the defect this family keeps re-paying.*

---

## ⛔ The structural finding: nothing reads `independent_review`

Re-derived in this task, not quoted:

```
$ grep -rn "independent_review" scripts/ .claude/ .github/ docs/ AGENTS.md CLAUDE.md
$ echo "grep-exit:$?"
grep-exit:1
```

**No matches. Exit 1.** The only gate that looks like it guards this — `check-verification-honesty.cjs`
— reads `verification_mode` and nothing else; it passed `16/16` over this plan's five edits without
ever looking at the field those edits were about.

**The consequence, stated plainly: the register flip is DOCUMENTATION, not an enforced state.** Every
row in the table above is an assertion in a file that no gate re-checks. `DEBT-06-AUDIT.md` measured
the decay rate on a real row rather than estimating it: **Phase 240's marker went
stale in ten hours** — the marker was written at `6267817c9` (2026-09-14 08:07) naming its own gap, and the review
closing that gap landed at `6a0a3171b` the same day at 18:23, so the index said *owed* about work that
was already done. Its own closing line: *"these four writes make the index true **today**; they do not
make it stay true."*

⛔ **Building a gate over this field was CONSIDERED AND REJECTED HERE, deliberately.** A gate is new
capability, and new capability inside a review phase is the G-7 runaway that took Phase 187 from 15
plans to 29 (D-11 / G-7). The derivation `254-04` used stayed **inline in the plan and was barred from
`scripts/`** for exactly that reason. **So this is recorded as an OPEN finding with a re-open trigger,
not closed.**

**Re-open trigger:** the next phase that touches `DEBT-06`, or `/gsd:complete-milestone` for v4.2 —
whichever comes first. **Recommended disposition: next phase.**

---

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

⭐ **Re-fenced here at `254-04`**, across the five drafts **and** this file: section body md5
`08fe04f7d9438e28d4734a71c5ba0240`, 1416 bytes, **one distinct value out of five**.

---

## The flip recipe — what must be true before a row stops reading `owed`

D-10 names four registers. Three are claude's and have now moved *in the accounting direction*; the
fourth is the operator's. ⭐ **Written so the next session can apply it without re-deriving anything,
because that is exactly what 240's ten-hour decay costs.**

| # | Register | The exact edit, when a row genuinely closes |
|---|---|---|
| 1 | `.planning/phases/<N>-*/<N>-VERIFICATION.md` | change the **value** of `independent_review:` from `owed` to `done` (a §6.3 review ran) or `refused` (the operator ruled on the draft), and rewrite the inline comment to name **who decided · why · the evidence verbatim · the re-open trigger · a pointer to this file**. ⛔ Leave `verification_mode: self-verified` alone — *a refusal is not a pass*. ⛔ Put the state in the KEY and the reasons in the COMMENT; prose is invisible to every scan. |
| 2 | `.planning/ROADMAP.md` → **Progress** row for `<N>` | put the new verdict FIRST in the Status cell, then the literal `— **SUPERSEDED VERDICT FOLLOWS:**`, then the prior cell **verbatim**. ⛔ Never overwrite. ⛔ Do not move the `⚠ **N / M v4.2 phases closed …` counts line — that numerator moves at a phase CLOSE, which is `/gsd:verify-work`'s call. |
| 3 | `.planning/REQUIREMENTS.md` → the `DEBT-06` bullet + its two coverage rows | move the id from the **Still unmet** clause to the **Already accounted for** clause **with its actual value beside it**, re-deriving both clauses rather than editing one. ⛔ The box becomes `- [x]` only when **both** arms are empty — the 249-253 arm *and* the older arm (238 · 239 · 240 · 241 · 242 · 243 · 244 · 245 · 246). Tick it in the `REQUIREMENTS.md:175-181` shape: `⭐ TICKED <date> (<plan>), evidence: <artifact>`. |
| 4 | `.agent-bus/OPEN.md` → the item | ⛔ **OPERATOR ONLY** (`REG-03`). `answer` then `close`, using the script — never a hand edit of a `###` header line, and never appending text after a bare `**Answer:**` line, which makes the item permanently unanswerable by `cmd_answer`. |

**The mapping, so nobody has to look it up:** 249→`BUS-251` · 250→`BUS-250` · 251→`BUS-249` ·
252→`BUS-256` · 253→`BUS-257`.

---

## The commands — ⛔ YOURS TO RUN, NOT CLAUDE'S

Five items, in the risk order `251 → 253 → 252 → 249 → 250`. **Each pair is `answer` then `close`.**
The `<angle-bracket placeholders>` are the part claude may not decide.

⛔ **Do NOT run these if you want the review instead.** Answering an ask with a refusal ruling ENDS
it. If gemini is going to review a phase, leave its item open — every draft is **void** the moment
its ask is answered with a review, before or after **2026-09-24**.

```bash
# 1 · BUS-249 — Phase 251 (Register Integrity), rank 1 of 5, refusal risk low-moderate
#     draft: .planning/phases/251-register-integrity/251-REVIEW-REFUSAL.md
bash scripts/agent-bus.sh answer BUS-249 "<RULING: adopt the drafted refusal (independent_review -> refused) / keep it open for a gemini review>"
bash scripts/agent-bus.sh close  BUS-249

# 2 · BUS-257 — Phase 253 (bootstrap artifact), rank 2 of 5, refusal risk HIGH — security-bearing
#     draft: .planning/phases/253-the-bootstrap-artifact-tells-the-whole-truth/253-REVIEW-REFUSAL.md
bash scripts/agent-bus.sh answer BUS-257 "<RULING: adopt the drafted refusal / keep it open — note this is the WEAKEST of the five drafts>"
bash scripts/agent-bus.sh close  BUS-257

# 3 · BUS-256 — Phase 252 (v4.2 audit gaps), rank 3 of 5, refusal risk moderate — security-bearing
#     draft: .planning/phases/252-close-the-v42-audit-gaps/252-REVIEW-REFUSAL.md
bash scripts/agent-bus.sh answer BUS-256 "<RULING: adopt the drafted refusal / keep it open for a gemini review>"
bash scripts/agent-bus.sh close  BUS-256

# 4 · BUS-251 — Phase 249 (the model you actually run), rank 4 of 5, refusal risk low
#     draft: .planning/phases/249-the-model-you-actually-run/249-REVIEW-REFUSAL.md
bash scripts/agent-bus.sh answer BUS-251 "<RULING: adopt the drafted refusal / keep it open — BUG-260916-01 is a live input to this one>"
bash scripts/agent-bus.sh close  BUS-251

# 5 · BUS-250 — Phase 250 (run honesty, the residue), rank 5 of 5, refusal risk low
#     draft: .planning/phases/250-run-honesty-the-residue/250-REVIEW-REFUSAL.md
bash scripts/agent-bus.sh answer BUS-250 "<RULING: adopt the drafted refusal / keep it open for a gemini review>"
bash scripts/agent-bus.sh close  BUS-250
```

**After any ruling**, apply rows 1-3 of the flip recipe above for that phase — otherwise the ruling
lives only in the mailbox, which is the failure mode `REG-03` was raised to end.

---

## What this document changed on disk

| | |
|---|---|
| bus items opened, answered or closed by claude | ⛔ **0** — `git diff -U0 .agent-bus/OPEN.md \| grep -c '^[-+]### '` → **0** |
| bus item bodies amended (by `254-01`, wave 1) | **5** — `BUS-249` / `BUS-250` / `BUS-251` / `BUS-256` / `BUS-257`; headers and the 20 bare `**Answer:**` lines byte-intact |
| `independent_review` values flipped | ⛔ **0** — `yaml.safe_load` returns the string `owed` for all five |
| `independent_review` keys **added** | **1** — `251-VERIFICATION.md`, where it had been absent for the phase's whole life. A sweep that returned **4** now returns **5** |
| `verification_mode` values changed | ⛔ **0** — five of five still read `self-verified`; `check-verification-honesty.cjs` exit **0**, `subject: 16` |
| `DEBT-06` ticked | ⛔ **no** — `- [ ] **DEBT-06**` count **1**, `- [x]` count **0**; the text was amended and the box was not |
| ROADMAP rows rewritten | ⛔ **0** — 7 rows **appended to**, prior verdicts preserved verbatim; the `— **SUPERSEDED VERDICT FOLLOWS:**` marker count moved **3 → 10** |
| the `⚠ **7 / 8 v4.2 phases closed` counts line | **byte-identical to `git show HEAD:`** — md5 `72a230988a502bf4b29a8d325d2d8936` both sides |
| seeds edited | ⛔ **0** — `git status --short .planning/seeds/` empty; `SEED-177` left byte-unchanged |
| reported bugs folded into 254 | ⛔ **0** — `grep -rl 'folded_into: 254' .planning/reported-bugs/` returns nothing |
| product source files touched | ⛔ **0** — no `backend/` or `frontend/` path is in this phase's blast radius |
| findings repaired | ⛔ **0** — ten findings triaged with a recommended disposition each; the operator rules |

---

## Gate readings

⚠ Every exit code captured **without a pipe** — `… | tail` returns *tail's* status, not the gate's.

### The DEBT-06 derivation (inline, `254-04` Task 2A — ⛔ deliberately NOT written to `scripts/`)

```
present-but-not-discharged : 239=owed 242=false 249=owed 250=owed 251=owed 252=owed 253=owed
key ABSENT ENTIRELY        : 241 244
no *-VERIFICATION.md at all: 245
already accounted for      : 238=complete 240=complete 243=refused 246=done
derive-exit:0
```

⛔ **The three unmet buckets are reported separately and are NEVER summed into one number** — a row
whose key is *absent* and a row that *reads `owed`* fail for different reasons, and a row with no file
at all fails for a third. **The `key ABSENT` bucket is the half a `grep 'independent_review: owed'`
cannot see, and it is exactly why 251 was invisible for its whole life.**

### `node scripts/check-seeds-register.cjs --phase 254` → **exit 0**

```
  register: 297 files · parsed: 297 · skipped: 0 · duplicate ids: 0
  unswept:  134 carry no trigger_when at all · 114 carry prose but no structured trigger

trigger sweep — phase 254 (4 plan file(s), 15 path(s) in files_modified)
  ⚠ the phase declares NO surfaces, so `trigger_surfaces` matched nothing here.
    That is a fact about the PHASE, not about the register — reported, never passed off as a clean sweep.
  1 seed(s) matched:
  [trigger-fires] SEED-177 (status: partially-answered) MCP connections both ways …
      path ".planning/ROADMAP.md"  matched  ".planning/ROADMAP.md"
```

⭐ **`4 plan file(s), 15 path(s)` — non-zero on both counts.** At discuss time the same command ran
`exit 0` over `0 plan file(s), 0 path(s)`, which is a green over nothing and was recorded as *not a
clean sweep*. **Now it had something to match.**

⚠ **The two unswept figures are `134` and `114`, and they are two numbers — never their sum.** A
structured backfill is mechanical only; most of the register is still unswept **by design**.

⛔ **`SEED-177` ROUTING: NOT FOLDED — a path collision, not a trigger.** `SEED-177` is about MCP
connections usable in chat and workflows; 254 touches `.planning/ROADMAP.md` only to append register
bookkeeping to seven rows, and ships **no capability at all**. Folding it would widen a review phase
into a build phase, which D-11 / G-7 forbid. **`SEED-177` is left byte-unchanged** — its own re-open
trigger (`SEED-013` / Open Platform getting a phase number) is unaffected by this phase, and
overwriting it with a false routing is worse than leaving it.

### `node scripts/check-gap-closure-rounds.cjs 254` → **exit 0**

```
G-7 gap-closure round cap — 254-independent-review-of-249-253
  plans: 4 total · 0 gap-closure
G-7 clear — no gap-closure plans in this phase.
```

### `node scripts/check-hot-file-ledger.cjs .planning/phases/254-independent-review-of-249-253` → **exit 0**

```
  scan list: 287 rows · subject: 15 files · watched: 0
ledger gate OK — every watched file has a row.
```

⛔ **`subject: 15` is non-zero, so the gate genuinely parsed this phase's plans** — worth asserting,
because it was measured printing `subject: 0` over a CRLF plan and exiting 0, which is a green over
nothing. ⛔ **But `watched: 0` means its green verdict here says *nothing to see*, never *clear*
(M-10).** Its `WATCHED` set is `backend/app` + `frontend/src` only, so it watches **0** of this
phase's 15 files. **This gate cannot be cited as coverage for Phase 254.**

### `node scripts/check-verification-honesty.cjs` → **exit 0**

```
subject: 16 files (9 archived + 7 live)
OV-SOLO-01-status: retired-2026-09-13 — claims-review arm SKIPPED
honesty gate OK — 16/16 subject files carry verification_mode, 0 frontmatter review claims.
```

⚠ It reads `verification_mode` **only** and never `independent_review` — see the structural finding.
⚠ And it was run **by hand**: the PostToolUse hook that normally fires it matches `Write|Edit`, and
`254-04`'s five register edits were authored through a script, so **the hook did not fire on any of
them**. That is the same matcher-blindness class `253` fixed for `MultiEdit`, one tool over.

### Reported-bugs cross-check (CLAUDE.md, MANDATORY)

`grep -rl 'folded_into: 254' .planning/reported-bugs/` returns **nothing** — no report is folded into
this phase, and that is deliberate: **254 fixes nothing.**

⛔ **`BUG-260916-01` stays `status: open`** (measured: `status: open` on disk). It is named as an
**INPUT to Phase 249's review** — an `llm-call-timeout` above 600s is accepted by admin and cannot
take effect, squarely in 249's model-routing domain — because a live defect in the reviewed surface is
evidence a reviewer should weigh. ⛔ **It is not folded, and 254 does not fix it.**

---

*Phase 254 · plan 04 · derived 2026-09-17 · claude (executor)*
*⛔ Five rows accounted for. Zero reviewed. `DEBT-06` unticked.*

---
phase: 245
kind: verdict
written: 2026-09-13
author: claude (solo — OV-SOLO-01)
verification_mode: self-verified   # ⛔ OV-SOLO-01 — this file is not exempt from its own rule
sc_status: { "1": closed, "2": owed-245-02, "3": discharged, "4": discharged }
---

# Phase 245 — Verdict

**Written by `245-01`.** SC#3 and SC#4 are discharged here. SC#1 and SC#2 are **named, owned and
empty** — see their sections at the bottom.

⛔ **This is a SELF-verification, not a review.** Gemini is unavailable; no independent AGENTS.md §6.3
reviewer exists. Note the recursion out loud rather than leaving it to be noticed: **this is the
phase that ships the machine-readable marker for exactly that fact**, and its own verdict file
carries the marker too.

⚠ **`245-VERDICT.md` is deliberately OUTSIDE the honesty gate's subject set.** It is not a
`*-VERIFICATION.md`, so it matches neither the boundary glob nor the hook regex, and the gate's
subject count stays **6**. ⛔ **This was NOT "fixed" by widening the glob to `-VERDICT.md`** — that
would change the guard's contract mid-flight, with no review, and would re-break the floor `245-01`
Task 2 was written to get right. The live proof that the glob catches an unpinned active file is
**Arm F** in `245-01-SUMMARY.md`: a throwaway `ZZ-TEST-VERIFICATION.md`, created, seen red, deleted.

---

## § SC#3 — DISCHARGED

> *"A person opening `238-VERIFICATION.md`, `240-VERIFICATION.md` and `241-VERIFICATION.md` finds the
> words **"self-verified"** and does **not** find "reviewed" — and can tell from each file which gate
> did and did not run (DEBT-03)."*

### What the deliverable actually was (D-01)

**A greppable marker plus untouched prose.** Repeatable in one command:

```
grep -n "^verification_mode: self-verified" \
  .planning/milestones/v4.0-phases/238-microsoft-graph-onedrive/238-VERIFICATION.md \
  .planning/milestones/v4.0-phases/240-mail-is-a-shape-not-a-fourth-adapter/240-VERIFICATION.md \
  .planning/milestones/v4.0-phases/241-recall-at-corpus-scale/241-VERIFICATION.md
```

Three hits. ⛔ **SC#3 is NOT reported closed because the gate is green** — the gate is a separate
deliverable that makes future absence loud. It is closed because the token is in the three files and
their prose is byte-unchanged.

### ⛔ SC#3's literal second clause was measured UNSATISFIABLE, and satisfying it would have destroyed the record

Measured at HEAD, before Phase 245 touched anything:

| file | `\breviewed\b` | substring `review` (`-i`) | `code-review` |
|------|----------------|---------------------------|---------------|
| `238-VERIFICATION.md` | **1** | **13** | 0 |
| `240-VERIFICATION.md` | **0** | **11** | 3 |
| `241-VERIFICATION.md` | **2** | **11** | 1 |

**Every one of those 35 occurrences is an honest sentence naming the §6.3 review that is OWED.**
238's opening paragraph is *"An independent review is posted `--to operator` as owed"*; 240's is a
heading reading *"⛔ THIS IS A SELF-VERIFICATION, AND IT SAYS SO IN ITS FIRST PARAGRAPH"*. Deleting
the word to satisfy the criterion literally would have deleted **exactly the honesty SC#3 exists to
protect**. What *"cannot lapse unnoticed"* actually needs is **machine-checkability**, which prose
does not give — hence a token and a gate.

⭐ **The same trap is inside the remedy, which is the finding worth keeping:** the mandated marker's
own comment reads `NEVER "reviewed"`. **A gate that matched on the raw line would red all six correct
files** — measured raw hits `1,1,1,1,1,1`, stripped `0,0,0,0,0,0`. The word cannot be eradicated even
from the fix for its presence, which is why the deliverable could never have been a word count.

### The second clause of SC#3 — *"can tell which gate did and did not run"*

⚠ **Measured ALREADY TRUE at HEAD** by `245-CONTEXT.md` (`238:3-9`, `240:9-13`, `241:25-29`).
`245-01` did not observe it afresh: it **preserved it byte-unchanged** and cites that measurement.
All three files already declared themselves self-verifications in their opening paragraphs — which is
precisely *why* no prose needed changing. **The marker adds machine-checkability, not a new claim.**

This matters against the ROADMAP's own named failure mode — *"a VERIFICATION.md gets the word
'self-verified' added while its verdict section still reads as though a reviewer signed it"*. It did
not happen here, and the reason is mechanical rather than asserted: `git diff` shows **ZERO
deletions** in all five files, and every added line is frontmatter.

### ⛔ What was NOT done

**No verdict inside 238, 240 or 241 was re-read or re-judged.** Reads of those files were
line-ranged to their frontmatter region (238:1-10, 240:1-16, 241:1-20) for exactly this reason. That
is the re-review the ROADMAP forbids — *"a phase that re-reviews 238 / 240 / 241 has silently changed
the requirement into a different and much larger one"* — and this phase did not perform it.

### Files marked — five, not three

| file | what changed |
|------|--------------|
| `238-VERIFICATION.md` | had **NO frontmatter at all**; gained a 4-key block |
| `240-VERIFICATION.md` | had **NO frontmatter at all**; gained a 4-key block |
| `241-VERIFICATION.md` | one line inside existing frontmatter |
| `242-VERIFICATION.md` | one line inside existing frontmatter — **`DEVIATION-245-01-A`** |
| `244-VERIFICATION.md` | one line inside existing frontmatter — **`DEVIATION-245-01-A`** |

⛔ 238 and 240's blocks carry **no `status:` and no `score:`**, deliberately: this plan was not
permitted to read those files' verdicts and therefore **cannot honestly assert one**.

**`DEVIATION-245-01-A`** — D-01 names three files; `245-01` marked five. The guard's boundary is
*every `*-VERIFICATION.md` under `.planning/phases/`* plus the three archived files DEBT-03 names.
242 and 244 sit inside that boundary, in the same directory as 243, and were both solo-verified —
242's own frontmatter already said `solo_run: true` / `independent_review: false`. **Excluding two
siblings from a boundary is the hole that goes silent**, which is the exact failure mode this
requirement family exists to prevent; including them cost two inserted lines. It is a scope
deviation and is recorded as one, not smuggled.

### The gate and the hook, and what the gate does NOT check

- `scripts/check-verification-honesty.cjs` — exit `0` clear / `1` violation / `2` harness error.
  Findings: `[no-frontmatter]`, `[no-verification-mode]`, `[frontmatter-claims-review]`. Boundary
  stated in its own header. `MIN_PINNED_FILES = 3` floors the **invariant** pinned set and never the
  transient active set. `--review-by "<reason>"` is a worded override printing `passed WITH
  OVERRIDES`, never `OK`.
- `.claude/hooks/verification-honesty-guard.js` — fifth `Write|Edit` PostToolUse entry. Fires in the
  turn the file is authored, never denies the write, always exits 0.

⛔ **THE NON-CHECK, and it is load-bearing: BODY PROSE IS NEVER INSPECTED.** Not one line below the
closing `---`. A body-scanning predicate would fire on all three **correct** files (35 `review`
substrings between them) and would pressure a future agent into deleting the honesty this gate exists
to index. The refusal is written into the gate's header so a future maintainer who wants to "improve"
it must find the reason first.

Both RED arms, the B-0 precondition, the false-positive control and the three md5 values are in
`245-01-SUMMARY.md`.

---

## § SC#4 — DISCHARGED BY CITATION (D-04)

> *"`STATE.md → Guardrail overrides` carries the `OV-SOLO-01` ruling in full: that solo running
> continues, that the dispatched code-review subagent is **mandatory** on any phase touching a trust
> boundary and is **not** an independent gate, that `/code-review ultra` stays ruled out on cost, and
> **what its next re-arm trigger is** — so it cannot lapse unnoticed a second time (DEBT-03)."*

⛔ **The operator's ruling was NOT re-derived, rewritten, summarised-over or reordered.** It is quoted
verbatim below from `.planning/STATE.md` § *Guardrail overrides* → `### ⭐ OV-SOLO-01 — RULED ON
2026-09-11 BY THE OPERATOR. It did NOT lapse.` (**`STATE.md:487-511`** as of this writing; the
heading is at `:487`).

### All four elements, each with the sentence that satisfies it

**1. Solo running continues** — `STATE.md:491`:

> **Ruling (operator, 2026-09-11, at v4.1 scoping):** **solo running continues.**

**2. The dispatched code-review subagent is MANDATORY on any trust-boundary phase, and is NOT an
independent gate** — `STATE.md:491-494`:

> The substitute for the independent gate is the **dispatched code-review subagent**, which is
> **MANDATORY** on any phase touching a trust boundary. ⛔ **It is NOT an independent gate**, and
> every phase closed under it must read **"self-verified"** in its own VERIFICATION.md — never
> "reviewed".

**3. `/code-review ultra` stays ruled out on cost** — `STATE.md:494-495`:

> `/code-review ultra` stays **ruled out on cost**.

**4. The re-arm trigger** — `STATE.md:506`:

> **Re-arm trigger:** Gemini's quota returns, **or the v4.1 close, whichever is first.**

⭐ The ruling also carries the measurement that keeps element 2 from reading as a formality
(`STATE.md:497-499`):

> ⭐ **It is also not worthless, and that is measured rather than assumed:** on Phase 239 exactly this
> arrangement returned **19 findings including 2 Criticals**, one being a destructive tool bindable as
> the file *reader* and then called by the watch loop on every file, unattended.

…and what does not lapse either way (`STATE.md:501-504`): decisions still go to the operator, never
self-settled; baselines still captured before source work; RED-first still holds; the mechanical
gates remain the honest floor.

**Applies to** (`STATE.md:511`): every phase in v4.1 (242-246).

### ⭐ The finding, not just the tick: SC#4 WAS ALREADY SATISFIED AT HEAD, BEFORE THIS PHASE BEGAN

All four elements and the re-arm trigger were present and complete when `245-01` started. **The
ROADMAP, REQUIREMENTS and STATE.md's own task list all described SC#4 as pending.**

That is the same class of error as the stale Azure claim `245-03` corrects, **in the opposite
direction** — three registers said a thing was *owed* when the artifact said it was *done*. The
CONTEXT's `<specifics>` names both directions as in scope to prevent, and this is the second one
firing. Precedent: `feedback_a_review_is_a_claim_about_code_not_the_code` — **each register only
knows the one below it; the artifact is the bottom.** ⚠ On 2026-09-10 that same asymmetry ran the
other way and two Phase 239 criticals were escalated as live after being fixed two days earlier.
**Read the artifact before believing the register, in both directions.**

### Deferred, named rather than silent

**Making `OV-SOLO-01`'s re-arm trigger itself executable** was considered under D-04 and **not
taken**. What `245-01` shipped instead is the machine-readable **status index**
(`OV-SOLO-01-status: live` at `STATE.md:489`), which the gate reads — so a *retirement* is now
greppable even though the *trigger* is not.
**Trigger to revisit:** the v4.1 close, where the re-arm fires and can be watched working or failing.

---

## § SC#1 — CLOSED (`245-03`, with `245-02` for its driven arm)

> *"Each of Phase 238's **nine** UAT rows reads pass, ⛔ blocked with its reason and its blocking id,
> or retired with a named trigger. No row is silently absent."*

### ⚠ ELEVEN or nine — resolved in writing, not inherited

238's table holds **ELEVEN** rows: `M-1`…`M-9` **plus** `S-1` and `S-2`. **"Nine" means the M rows
only**; S-1/S-2 are two *additional* rows, never a subset. The ambiguity was live in the registers —
`REQUIREMENTS.md` DEBT-01 read as though 9 excluded them, `STATE.md` item 4 as though 9 included
them — and it is now resolved **at the anchor**, in `238-VERIFICATION.md`'s own footer, with both
registers pointing there.

### Every one of the eleven rows, terminal

| # | Row | Terminal verdict | How it got there |
|---|---|---|---|
| M-1 | Connect a Microsoft 365 account → OAuth round trip | ✅ **PASS** | driven live 2026-09-07 |
| M-2 | The connection appears in the connected-source picker | ✅ **PASS** | driven live (operator) |
| M-3 | Browse OneDrive, drill into a folder | ✅ **PASS** | driven live |
| M-4 | Preview a OneDrive folder → the four buckets | ✅ **PASS** | driven live (operator) |
| M-5 | Files read through the two-step download | ✅ **PASS** | driven live — found two defects |
| M-6 | A watch runs on schedule and brings in a new file | ✅ **PASS** | driven live |
| M-7 | Delete at source → the Library document is NOT deleted | ✅ **PASS** | driven live |
| M-8 | Disconnect → watching freezes, nothing is deleted | ✅ **PASS** | **headline flipped by `245-03` (D-06)** — see below |
| M-9 | A `path contains '/Finance/'` rule fires for a file in that folder | ⛔ **BLOCKED** — Microsoft/OneDrive arm not driven; no `/Finance/` folder exists in the OneDrive account (**operator action**). Blocking id **`BUG-260913-01`** for the arm that WAS driven. **Trigger: that folder existing, or the next phase touching Graph ingestion.** | driven by `245-02` **against the wrong provider** — see below |
| **S-1** | Browse a SharePoint document library | ⛔ **RETIRED — `SEED-256`** | **written retirement, `245-03` (D-07)** |
| **S-2** | `Sites.Read.All` self-consent vs admin approval in an enterprise tenant | ⛔ **RETIRED — `SEED-256`** | ditto |

**8 ✅ PASS · 1 ⛔ BLOCKED with reason, id and trigger · 2 ⛔ RETIRED with a named trigger · 0 HALF ·
0 silently absent.** ⛔ `HALF` is not one of SC#1's three admissible verdicts, and after this plan no
row carries it.

### M-8 — the flip, and why it was a flip and not a re-drive

The row read `⚠ HALF PASS — and the failing half is a DEFECT, BUG-260907-03` **while its own body
already ended** `✅ FIXED THE SAME DAY … driven both directions on the same row … BUG-260907-03
closed.` **The row contradicted itself, and a reader believed whichever half they reached first** —
DEBT-03's failure mode mirrored inside a table.

⛔ **NOT re-driven (D-06).** Re-driving means disabling a live integration again for a result already
in the file. The fix landed at the choke point (`SourceRegistry.get_adapter` raising
`SourceConnectionDisabled`), was driven **both directions on that row** (disabled → refused with no
network call; enabled → 6 folders), and the bug is closed. **Cited, not re-measured.** The original
assessment is preserved verbatim inside the row, labelled as history.

### M-9 — why a real, traced failure does **not** make this row FAIL

`245-02` created the rule **through the real `RuleBuilderPanel` surface** (`rule_scope: watch`,
`path contains '/Finance/'`, persisted and verified in the DB) and drove it through **both doors**
per D-05. Both wrote `metadata.source.path = null`; the rule never fired.

⭐ **But 238 is a Microsoft Graph phase, so M-9's own provider is OneDrive — where `path` IS
populated** (`/Attachments/…`, this very table's M-6 and M-7 documents). `245-02` exercised **Google
Drive**. So the failure is real and belongs to a **wider, different defect**, filed as
**`BUG-260913-01`**: *the Google Drive adapter never writes `metadata.source.path`, on either door,
so every path-based classification rule is silently inert for every Drive document.* No error, no
warning; the rule reads as enabled and matches nothing, forever.

⚠ **Calling M-9 PASS would be false; calling it FAIL would blame the wrong component.** ⛔ BLOCKED
with a reason, a blocking id and a named trigger is the honest verdict — and this is *the same class
of error the phase exists to prevent, caught in flight*: a row marked done on evidence that does not
address it.

⛔ **Not fixed here, by decision (D-16).** The G-3 line is ≤ 1 file / ≤ 10 lines / no schema or API
surface; this needs an adapter change **plus a cross-adapter fence**. Filing it is the complete
response. ⭐ The fix owes the fence as much as the patch — the gap existed on Microsoft until 238 and
on Drive since 232, so a test asserting that *every* adapter populates `source.path` is what stops
the next adapter repeating it. ⚠ `v4.0-ROADMAP.md:828` already recorded the shape of this
(*"SEED-253 partially discharged (Graph populates `path`; Drive still cannot)"*) — **`245-02` is what
turned that note into a measured, filed defect with a blast radius.**

### S-1 / S-2 — retired in writing, across three registers, in ONE commit

**Ground:** no M365 work/school tenant. **Confirmed LIVE rather than assumed** — `check()` returned
**`drive_type: personal`**, and a personal account has **no `/sites/` to address at all**. No scope
unlocks it: `Sites.Read.All` on a personal account has nothing to point at. **An account boundary,
not effort.**

**Re-open path:** `SEED-256`'s **four** existing `trigger_when` arms, cited by reference and left
byte-unchanged — (a) a free M365 Developer tenant; (b) ⭐ a customer or pilot org on M365, *the real
one, because it arrives WITH the admin-consent question attached*; (c) any paid M365
Business/Enterprise subscription; (d) a phase proposing SharePoint as a source.

⚠ **Retired ≠ answered.** `SEED-256` carries an unresolved MEDIUM-confidence research question that
travels with the row: whether `Sites.Read.All` self-consents in a typical **enterprise** tenant or
requires **admin approval**. That has a *sales* consequence, not just a test one, and the seed names
it as the first thing to drive when the trigger fires.

**The three registers, one commit** (`Dockerfile.sandbox` ↔ `docs/SANDBOX-PACKAGES.md`'s same-commit
rule): `238-VERIFICATION.md`'s table · `REQUIREMENTS.md` DEBT-01 · `SEED-256`'s `status: deferred`.
⛔ **Seed-only was rejected on a measurement:** the seeds register is swept by **nothing**
(`grep -rln "SEED" .claude/commands/gsd/` returns only `capture.md`, the command that *writes*
seeds), so a retirement held only by a seed is held by nothing. ⚠ **`status:` frontmatter IS the
index** — a body sentence saying "still open" is invisible to every scan, which is why the flip, not
the prose, is the deliverable.

### ⭐ What SC#1 actually cost to discover — worth more than the verdicts above

**All nine M rows were DRIVEN LIVE on 2026-09-07.** The operator completed the Azure app registration
*hours after* `238-SUMMARY.md` was written, and `238-VERIFICATION.md:139` has read *"The operator
completed the Azure app registration, so the rows below stopped being owed"* **ever since**.

**Meanwhile six live registers said the rows were blocked, for six days.** ⭐⭐ **The bottom register
already carried the correction — the artifact was right the whole time and every layer above it was
wrong.** That is `feedback_a_review_is_a_claim_about_code_not_the_code` in one measurement: *each
register only knows the one below it; the artifact is the bottom.* The sweep that corrects all
sixteen live instances is recorded in its own section below.

## § SC#2 — OWED, owned by `245-02`

⛔ **EMPTY OF VERDICTS BY DESIGN.** `245-01` **has not opened a browser**, and nothing in it may be
read as evidence about a driven row.

> *"Each of Phase 233's **five** G-4 operator rows has been driven in a live browser by a person,
> with a written verdict per row. Owed since the phase shipped and never run."*

**Must contain when filled:** five rows, each with a written verdict from a live browser drive,
recorded in `245-UAT-RESULTS.md` (which `245-02` owns per D-12). **Row 2 is driven first, measured
against the DB before anything is imported.** ⛔ A row marked done on the strength of a passing test
suite is the precise failure this requirement family exists to prevent.

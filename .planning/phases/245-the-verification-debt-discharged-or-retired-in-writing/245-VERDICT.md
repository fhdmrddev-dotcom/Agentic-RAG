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

## § The stale-claim sweep — sixteen live-register homes corrected BESIDE their originals (D-08)

**The claim:** *"238's nine rows are blocked on one Azure app registration — run M-1 first, it
unblocks the other 8."* **FALSE at HEAD, and false for six days.**

### ⛔ The set is DERIVED over TWO phrases, never enumerated — and that is the load-bearing part

An earlier draft of `245-03` **enumerated four homes**. The derivation found **nine-plus**, including
**both routing tables** — the two things an orchestrator actually reads to decide whether this phase
is blocked. ⚠ **One phrase is not the derivation either:** `REQUIREMENTS.md:208` matched only
*"Azure app registration"* (it reads *"blocked on one Azure app registration; **M-1 first**"*), and
`ROADMAP.md:421` spells the number `eight` where every other home spells it `8`.

```
grep -rn "unblocks the other"     --include="*.md" .planning CLAUDE.md | grep -v "phases/245-"   #  8 hits
grep -rn "Azure app registration" --include="*.md" .planning CLAUDE.md | grep -v "phases/245-"   # 28 hits
#                                                                              union = 32 hits / 17 files
```

*"Guardrails miss what is absent"* — **re-derive the whole list, never trust a list.** The sweep is
re-runnable: `sweep-stale-claim.cjs` (scratchpad — ⛔ never in the watched tree) walks every `*.md`
under `.planning/` plus `CLAUDE.md`, skips `phases/245-`, and for each hit demands **either** a
`CORRECTED 2026-09-13` line within ±8 lines **or** its literal `file:line` token in this file's
exclusion table below.

| run | result |
|---|---|
| **baseline, before any edit** | `--- 32 hits · 32 uncorrected-and-unexplained` · **exit 1 (RED)** |
| **after the corrections + this table** | `--- 43 hits · 0 uncorrected-and-unexplained (27 corrected-beside · 16 named-in-exclusion-table)` · **exit 0** |

⚠ The hit count *grows* from 32 to 43 because the correction sentences themselves contain the phrase.
That is the gate working: a correction is inside its own ±8-line window, so it self-satisfies.

### The sixteen CORRECTED live registers

| file:line (pre-edit) | what it is | note |
|---|---|---|
| `ROADMAP.md:110` | ⭐⭐ the milestone **credential-blocked routing table** | **highest traffic in the set** — what an orchestrator reads to decide if 245 is blocked |
| `STATE.md:340` | ⭐⭐ *"Two phases can be blocked on something that is not engineering"* | the other routing table, same reason |
| `ROADMAP.md:121` | the phase-table row | read on every roadmap scan |
| `ROADMAP.md:131` | the milestone checklist line | |
| `ROADMAP.md:421` | Phase 245 **SC#1** (spells it `eight`) | ⛔ the criterion itself is **still exactly right**; only its blocking claim was false |
| `ROADMAP.md:435` | Phase 245 **Flags** | carried **two** false claims — the Azure one and `SEED-177` |
| `ROADMAP.md:593` | the credential paragraph | its 241-row-5 half **remains true** |
| `REQUIREMENTS.md:161-162` | **DEBT-01** | the requirement |
| `REQUIREMENTS.md:208` | the **traceability row** (second phrase only) | ⚠ a corrected requirement with an uncorrected traceability row is a **half-corrected register** — this phase's own subject |
| `STATE.md:415` | item 4's credential-blocked table | ⚠ also resolved its **"9 includes S-1/S-2?"** ambiguity and pointed at 238's footer as the anchor |
| `PROJECT.md:118`, `:886` | the project's standing statement of the gap | `:886`'s `SRC-03` **verdict** is untouched — only the reason given |
| ⭐ `MILESTONES.md:28` | **the v4.0 close record** | **the strongest case in the set** — see below |
| `v4.0-ROADMAP.md:14`, `:828` | the same close record, one register over | archived, but a **close record**, not a dated snapshot of a belief — that is the line the exclusions draw |
| *(out of repo)* `~/.claude/projects/C--Vibe-Apps-Agentic-RAG/memory/project_238_built_unreviewed.md` | the agent-memory index line **and** its body | ⚠ cannot be diffed; before/after quoted in `245-03-SUMMARY.md` |

**C-5's survival fence:** all **32** originally-matched lines were captured verbatim *before* editing
and each was re-asserted afterwards as a **contiguous substring** (`grep -F`, whole line — not a
"distinctive fragment", which a wholesale rewrite retaining the fragment would pass). **32/32 OK,
0 LOST.** `git diff --numstat` shows **0 deletions** in all six repo homes.

### ⭐ `MILESTONES.md:28` — the close record was FALSE ON THE DAY IT WAS WRITTEN

The nine M rows were **driven 2026-09-07**. **v4.0 closed 2026-09-10** — three days later — and its
close record still read *"all nine live UAT rows are blocked on one Azure app registration."*
**This is not a fact that changed; it is a record that was wrong when written**, and the correction
says so rather than merely updating the number.

### ⭐⭐ And the finding that outranks all sixteen: the bottom register already carried the correction

`238-VERIFICATION.md:139` has read *"The operator completed the Azure app registration, so the rows
below stopped being owed"* **since 2026-09-07**. **The artifact was right the whole time and every
layer above it was wrong for six days.** That is
`feedback_a_review_is_a_claim_about_code_not_the_code` in one measurement — *each register only knows
the one below it; the artifact is the bottom* — and on 2026-09-10 the same asymmetry ran the other
way, when two Phase 239 criticals were escalated as live after being fixed two days earlier.

### ⛔ EXCLUDED — named with the reason, never silently skipped

**Dated snapshots that were TRUE when written, and are not routing surfaces.** ⚠ Correcting a
phase's own dated record would erase *when* something was believed, which is the opposite of D-08's
point.

| file:line | reason for exclusion |
|---|---|
| `.planning/milestones/v4.0-MILESTONE-AUDIT.md:7` | dated audit snapshot, true when written |
| `.planning/milestones/v4.0-MILESTONE-AUDIT.md:182` | ditto |
| `.planning/milestones/v4.0-MILESTONE-AUDIT.md:270` | ditto |
| `.planning/milestones/v4.0-STATE-at-close.md:327` | dated state-at-close snapshot |
| `.planning/milestones/v4.0-STATE-at-close.md:509` | ditto |
| `.planning/milestones/v4.0-phases/238-microsoft-graph-onedrive/238-SUMMARY.md:178` | 238's own dated record — ⭐ and it is where the *"hours after"* fact comes from |
| `.planning/milestones/v4.0-phases/238-microsoft-graph-onedrive/238-SUMMARY.md:202` | ditto |
| `.planning/milestones/v4.0-phases/238-microsoft-graph-onedrive/238-04-SUMMARY.md:236` | a plan's own dated record |
| `.planning/milestones/v4.0-phases/238-microsoft-graph-onedrive/238-CONTEXT.md:320` | a phase's dated scoping record |
| `.planning/milestones/v4.0-phases/238-microsoft-graph-onedrive/238-VERIFICATION.md:139` | ⭐⭐ **excluded because it is ALREADY CORRECT** — it is the register that was right |
| `.planning/milestones/v4.0-phases/240-mail-is-a-shape-not-a-fourth-adapter/240-CONTEXT.md:78` | a phase's dated scoping record |
| `.planning/milestones/v4.0-phases/240-mail-is-a-shape-not-a-fourth-adapter/240-VERIFICATION.md:231` | 240's own dated carry-forward record |
| `.planning/reported-bugs/onedrive-adapter-silently-truncates-and-mismatches-folder-paths.md:176` | a dated bug report; its own record of what was true at filing |
| `.planning/seeds/SEED-253-source-file-path-is-synthetic-no-adapter-populates-it.md:157` | a seed's dated body prose; ⚠ its **substance** is re-opened by `BUG-260913-01` (see §SC#1) but its history is not rewritten |
| `.planning/seeds/SEED-260-graph-mail-is-a-second-mail-module-not-a-second-adapter.md:3` | a seed's dated title/body; not a routing surface |
| `.planning/seeds/SEED-260-graph-mail-is-a-second-mail-module-not-a-second-adapter.md:58` | ditto |

**16 corrected · 16 excluded-and-named · 0 neither.**

---

## § `SEED-177` — REFUTED (D-15)

The ROADMAP's Phase 245 Flags block said: *"`SEED-177` still reads `status: planted` while its
retire-the-egress-fence trigger already fired"*. **CLAUDE.md carried the same sentence**, at the end
of the connector-architecture bullet.

**Measured directly against the seed:**

```
status: partially-answered  # trigger #2 ANSWERED by Phase 206 (2026-08-25); triggers #1 and #4 have NOT fired
```

⛔ **Both halves of the claim were wrong.** The status is not `planted`, and the fired trigger did
**not** go unhandled — the seed's own frontmatter records it as ANSWERED, and
`backend/tests/unit/test_189_no_egress.py`'s Case A source fence was **consciously retired under
`D-206-07`** with the reason written into the test body, which is *exactly* what the seed demanded
(*"retire the fence DELIBERATELY, never trip it by surprise"*).

**Corrected in both homes, beside their originals:** `ROADMAP.md`'s Flags block and `CLAUDE.md`.
⛔ **The seed itself is NOT edited — it is correct.** `git diff -- SEED-177-*.md` is **EMPTY**, and
that is asserted mechanically so a "helpful" edit to a correct seed cannot slip in.
`node scripts/check-claude-md-size.cjs` exits `0` (**99,441 chars · 66.3% of limit**).

⭐ **The shape of this one is worth more than the fix.** CLAUDE.md's bullet **already carried a
correction two sentences earlier** — *"the fence, the seed and this bullet are three registers and
only one of them was updated"* — and **the very next sentence was an instance of the same rot.** The
bullet now demonstrates its own lesson twice, in the same paragraph.

⛔ **No broader trigger sweep happened (D-15).** `SEED-177` is high-priority with Open Platform
attached, so ruling on triggers #1 and #4 is a **capability decision, not bookkeeping**. Trigger:
`SEED-013` / Open Platform getting a phase number. Recorded in the deferred list below.

---

## § SC#2 — OWED, owned by `245-02`

⛔ **EMPTY OF VERDICTS BY DESIGN.** `245-01` **has not opened a browser**, and nothing in it may be
read as evidence about a driven row.

> *"Each of Phase 233's **five** G-4 operator rows has been driven in a live browser by a person,
> with a written verdict per row. Owed since the phase shipped and never run."*

**Must contain when filled:** five rows, each with a written verdict from a live browser drive,
recorded in `245-UAT-RESULTS.md` (which `245-02` owns per D-12). **Row 2 is driven first, measured
against the DB before anything is imported.** ⛔ A row marked done on the strength of a passing test
suite is the precise failure this requirement family exists to prevent.

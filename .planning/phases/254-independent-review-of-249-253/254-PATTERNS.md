# Phase 254: Independent review of 249-253 — Pattern Map

**Mapped:** 2026-09-17
**Files analyzed:** 5 artifact classes (≈16 concrete file touches)
**Analogs found:** 7 / 7 classes (every one verified by reading the file, not by recalling it)

⛔ **No product source file is in this phase's blast radius** (`254-CONTEXT.md` `<code_context>`). Every
analog below is a **document shape or a register-reading script**, never a React component or a Python
service. A plan whose `files_modified` names `backend/` or `frontend/` has left the phase boundary.

---

## File Classification

| New/Modified artifact | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|
| `<phase>-REVIEW-IND.md` ×≤5 (NEW, in the **reviewed** phase's dir) | review verdict doc | indexed-frontmatter + narrative findings | `.planning/milestones/v4.0-phases/238-microsoft-graph-onedrive/238-INDEPENDENT-REVIEW.md` | **exact** — the repo's only `review_type: independent` file |
| `<phase>-REVIEW-REFUSAL.md` ×≤5 (NEW, same dir) | written refusal doc | decision record + re-open trigger | `.planning/DEBT-06-REFUSALS.md` §per-phase | **role-match** (it is ONE file with 5 sections; D-09 wants per-phase files) |
| 254's index / triage artifact (NEW) | operator decision list | list-the-operator-rules-on | `.planning/phases/251-register-integrity/251-BUS-TRIAGE.md` | **exact** (named by CONTEXT); secondary `.planning/DEBT-06-AUDIT.md` |
| `249..253-VERIFICATION.md` frontmatter (MOD ×5) | register index key | frontmatter key add/flip | `243-VERIFICATION.md:5` (`independent_review: refused` + inline who/why/evidence/trigger) | **exact** |
| `.planning/ROADMAP.md` Progress rows 410/411/412/414/415 (MOD ×5) | milestone register row | append-verdict, never overwrite | the rows themselves (`— **SUPERSEDED VERDICT FOLLOWS:**` house style, line 415) | **exact (self-analog)** |
| `.planning/REQUIREMENTS.md:185` + `:303` (MOD ×2) | requirement text + coverage row | amend-not-tick | `REQUIREMENTS.md:175-181` (REG-03 `⭐ TICKED … evidence:` pattern) and `:304` (the deliberate-untick row) | **exact (self-analog)** |
| `.agent-bus/OPEN.md` BUS-249/250/251/256/257 (MOD ×5) | mailbox item body | amend-in-place, header untouched | `BUS-257`'s body (the richest brief in the file) | **exact** |

---

## Pattern Assignments

### 1 · `<phase>-REVIEW-IND.md` (review verdict doc)

**Analog:** `.planning/milestones/v4.0-phases/238-microsoft-graph-onedrive/238-INDEPENDENT-REVIEW.md`
(83 lines — the whole file fits in one read).

**Frontmatter pattern** (lines 1-15) — ⭐ **`review_type: independent` is the load-bearing key.**
`DEBT-06-AUDIT.md:20-27` adopts Phase 240's counting rule verbatim: *"a review file whose frontmatter
does not assert `review_type: independent` is a code-review pass, not a §6.3 independent review."*
Four of eight DEBT-06 rows failed on this marker rather than on the work.

```yaml
---
phase: 238-microsoft-graph-onedrive
reviewed: 2026-09-14
review_type: independent
reviewer: Gemini (independent reviewer under AGENTS.md §6.3)
builder: Claude
range: 409af705f^..db7a083a2
status: passed
findings:
  critical: 0
  blocker: 0
  warning: 3
  info: 2
  resolved_in_phase: 4
---
```

⛔ **A claude-authored file in this shape MUST NOT write `review_type: independent`** — CONTEXT `<domain>`
and D-08: a claude pass over a claude build is a self-assessment under `AGENTS.md` §6.3. Use a value that
says so (e.g. `review_type: self-assessed`) and repeat it in the body. Whatever token is chosen must be
decided once in the plan and used identically across all five, because this token IS the index.

**Section order** (lines 17-83):

```
# Phase NNN: Independent Code Review (AGENTS.md §6.3)
**Reviewed by:** … (did NOT build, plan, or shape Phase NNN)
**Builder:** … · **Date:** … · **Scope:** <explicit commit range>
## 1. Executive Summary          ← numbered claims 1..N that the phase made, each affirmed/refuted
## 2. In-Depth Target Verification
### 2.1 …  ### 2.2 …             ← one subsection per highest-value target, named by file
## 3. Residual Findings (Documented Debt)
## 4. Verdict
```

**Secondary analog for a *re-review* of already-reviewed code** — 249/250/252/253 all carry prior
`*-REVIEW.md`, so the pass is "live-or-fixed", not a first reading. Copy
`.planning/phases/252-close-the-v42-audit-gaps/252-REVIEW-R2.md` (386 lines):

```yaml
round: R2 — live-or-fixed verdict on the ten findings left open by 252-REVIEW.md
reviewed_at_head: 7a5563cf51354f8a7ab0754eefb9704d709ac2ba
depth: standard (every verdict driven, not read)
scope: >-
  Re-verification of CR-04..CR-07 and CR-09..CR-14 from 252-REVIEW.md.
  CR-01 / CR-02 / CR-03 / CR-08 were closed by Phase 253 and were NOT re-verified.
verdicts:
  still_live: 10
  fixed_since: 0
  refuted: 0
```
Its sections: `## 1. The ten verdicts` → `### Drive evidence, verbatim` → `## 2. Severity
classification of what is still live` → `## 3. Bounded fresh pass` → `## 4. What this round did NOT do`.
⭐ The `verdicts:` triple and the `## 4 … did NOT do` section are what make a re-review honest; both are
directly reusable, and the `still_live / fixed_since / refuted` triple is exactly the shape that satisfies
the ROADMAP's *"a finding is reported OPEN only after it has been DRIVEN against the tree"* rule.

**The finding-body shape used by every `*-REVIEW.md` in 249-253** (identical across all six files):
`## Critical Issues` → `### CR-01: <one-sentence claim> — BLOCKER` → prose → a fenced repro/drive block →
`## Warnings` → `### WR-01: …` → `## Info` → `### IN-01: …` → `## Categories checked with NO findings`
(249-REVIEW.md:412) / `## Verified clean (recorded so a later reader does not re-derive it)`
(253-REVIEW.md:514). ⭐ **Keep that last section** — it is what stops the next round re-deriving the same
ground.

---

### 2 · `<phase>-REVIEW-REFUSAL.md` (written refusal doc)

**Analog:** `.planning/DEBT-06-REFUSALS.md` (183 lines). ⚠ It is **one** file holding five phase sections;
D-09 asks for one file per phase, so this is a role-match: lift the SECTION as the file body.

**Frontmatter pattern** (lines 1-9) — note `kind:` says outright what it is not:

```yaml
---
type: debt-refusals
requirement: DEBT-06
written: 2026-09-14
author: claude
decided_by: operator
kind: recorded-decision-not-review
phases: [241, 242, 243, 244, 245]
---
```

**Per-phase section pattern** (lines 45-67):

```markdown
## 241 — Recall at corpus scale · **REFUSE, strongest case of the five**

| | |
|---|---|
| Dispatched review | `241-REVIEW.md`, depth `standard`, **19 files** |
| Trust boundary | none |

⭐ **Its deliverable is a MEASUREMENT, and a measurement is the one artifact that does not need a
reviewer's judgement — it needs a re-run.** …

**Residual risk accepted:** the 19-file review's judgement calls are unexamined. Low — …
```

**The test the refusal applies** (lines 24-38, quote it rather than reinvent it): *"how much of this
phase's claim rests on mechanical evidence a third party can re-run, versus on a judgement only a
reviewer could test?"*

**The closing disclaimer** (lines 174-182) — ⭐ **this is what D-03 needs verbatim-in-spirit:**

```markdown
⛔ **What this does not do:** it does not flip any `independent_review` field to `done`, and it does
not claim any of the five was reviewed. All five keep `verification_mode: self-verified` and
`independent_review: owed`. **The refusal is the record, not a discharge.**

**Re-open trigger for all five:** …
```

⚠ **Measured tension the plan must resolve, not inherit:** `ROADMAP.md:271` records that
`DEBT-06-AUDIT.md` calls four rows *"genuinely unmet"* and **never reads** `DEBT-06-REFUSALS.md`, which
covers exactly those four — *"Two registers disagree and the ruling is the operator's."* A 254 refusal
that does not say which of those two readings it adopts re-creates the same disagreement one milestone on.

---

### 3 · 254's index / triage artifact

**Analog (exact):** `.planning/phases/251-register-integrity/251-BUS-TRIAGE.md` (376 lines).

**Frontmatter** (lines 1-10) — ⭐ `bus_writes: 0` is an assertion the document makes about itself:

```yaml
---
type: bus-triage
phase: 251
plan: "04"
requirement: REG-03
derived: 2026-09-16
derived_by: claude (executor, plan 251-04)
scope: "the 5 CURRENTLY open `to:operator` items (D-12). The 26 open `to:gemini` are OUT OF SCOPE by D-15 and counted below, never ruled on."
bus_writes: 0
---
```

**Opening disclaimer** (lines 12-22):

```markdown
⛔ **CLAUDE HAS WRITTEN NOTHING TO THE BUS, AND THIS DOCUMENT IS NOT A CLOSURE.** …
No task in this plan called `agent-bus.sh open`, `answer` or `close`; `git diff --name-only .agent-bus/`
is **empty**, asserted at every commit. **This is a LIST YOU RULE ON.** The exact commands are at the
bottom, pre-filled with the ids, and they are yours to run.

**Read this in one sitting.** Five items, three classes, one line of question each.
```

**Skeleton:** `## The queue, measured` (a counts table + how it was counted) → `## The five items` →
`### N · BUS-0NN — <age> days — ✅ SUPERSEDED | ⚠ LIVE DECISION | carries an unfixed finding` (each with a
`| finding | held by | verdict |` table) → `## The commands — ⛔ YOURS TO RUN, NOT CLAUDE'S` →
`## What this document changed on disk`.

**The operator command block** (lines 279-310) — copy the fenced, pre-filled, `answer`-then-`close`
ordering and the `<angle-bracket placeholder>` for anything claude may not decide:

```bash
# 4 · BUS-247 — does DEBT-06 stay a standing gate
bash scripts/agent-bus.sh answer BUS-247 "<DEBT-06 stays a standing gate / is discharged differently>"
bash scripts/agent-bus.sh close  BUS-247
```

**The self-accounting table** (lines 316-322) — three rows that make the document auditable:

```markdown
| bus items opened, answered or closed by claude | ⛔ **0** — `git diff --name-only .agent-bus/` is EMPTY |
| seeds planted | **1** — `SEED-286`, id derived as `max(id)+1 = 286` by the allocator's own rule |
| register verdict after planting | `seeds register gate OK — 293/293 parsed …` (exit 0) |
```

**Secondary analog for the per-row verdict table** — `.planning/DEBT-06-AUDIT.md:29-42`, an 8-row
`| Phase | independent_review: | independent artifact | verdict |` table with ✅/⛔/⚠ verdict tokens, plus
`## ✅ APPLIED <date> — the … writes are done; the table above is the BEFORE state` (line 144), which is
the exact discipline D-10 needs: **preserve the before-state table, add an after-state table beside it.**

---

### 4 · `*-VERIFICATION.md` frontmatter edit (×5)

**Analog (exact):** `.planning/milestones/v4.1-phases/243-the-thinking-block-and-the-follow-scroll-seam/243-VERIFICATION.md:5`
— one key, one inline comment carrying **who decided · why · the evidence verbatim · the re-open trigger ·
a pointer to the full audit**:

```yaml
independent_review: refused       # ⚠ WRITTEN 2026-09-16 by the DEBT-06 milestone-close audit. … WHO
DECIDED: OV-SOLO-01 (operator, 2026-09-11) … WHY: no second agent existed to review it. THE EVIDENCE,
verbatim from `243-REVIEW.md`'s own frontmatter — "reviewer: Claude (gsd-code-reviewer) — solo, standing
in for the absent §6.3 independent reviewer (OV-SOLO-01)". … ⛔ IT IS NOT AN INDEPENDENT REVIEW AND DOES
NOT CLAIM TO BE … RE-OPEN TRIGGER: OV-SOLO-01 was RE-ARMED 2026-09-13 … this marker says the row is
accounted for, never that the work was done. Full audit: `.planning/DEBT-06-AUDIT.md`.
```

**The exact key set of each target file — MEASURED, and they are NOT uniform** (`grep -n` on each):

| File | anchor lines | keys present | note |
|---|---|---|---|
| `249-.../249-VERIFICATION.md` | `:6` mode · `:9` key | `phase, phase_name, verified, status, verification_mode, builder, reviewer, independent_review, independent_review_waiver, score` | the only one with `builder:`/`reviewer:` **and** a `_waiver` string |
| `250-.../250-VERIFICATION.md` | `:4` mode (inline comment) · `:5` key | `phase, verified, verification_mode, independent_review, reviewer, verdict, owed[]` | `reviewer: null`; `owed:` is a **list** whose 4th entry names DEBT-06 |
| `251-.../251-VERIFICATION.md` | `:4` mode (inline comment) · **no key** | `phase, verified, verification_mode, status, score, overrides_applied` | ⛔ **M-2 CONFIRMED — `independent_review` is ABSENT.** This is an **ADD** (and so is `builder`/`reviewer`, also absent) |
| `252-.../252-VERIFICATION.md` | `:4` mode · `:5` key | `phase, status, verification_mode, independent_review, verified_by, verified_at, base, head, requirements[], success_criteria` | `verified_by: claude (orchestrator)`; carries `base:`/`head:` SHAs a reviewer can use as its range |
| `253-.../253-VERIFICATION.md` | `:7` mode · `:8` key | `phase, verified, status, score, overrides_applied, verification_mode, independent_review, re_verification, re_verification_detail{}, gaps[], deferred, human_verification[]` | deepest nesting; `status: gaps_found` (M-4) |

⛔ **THE GATE THAT FIRES ON THIS EDIT — measured, and a plan must not trip it.**
`.claude/settings.json:133-141` registers a **PostToolUse `Write|Edit`** hook running
`.claude/hooks/verification-honesty-guard.js`, which calls `scripts/check-verification-honesty.cjs
--files <path>`. Measured today on a clean tree:

```
subject: 16 files (9 archived + 7 live)
OV-SOLO-01-status: retired-2026-09-13 — claims-review arm SKIPPED
honesty gate OK — 16/16 subject files carry verification_mode, 0 frontmatter review claims.   (exit 0)
```

- It reads **`verification_mode` only** (`:376-388`, regex `^verification_mode:[ \t]*(.*)$`); it does
  **not** read `independent_review`. Failure codes: `[no-frontmatter]`, `[no-verification-mode]`,
  `[frontmatter-claims-review]`.
- The `[frontmatter-claims-review]` arm is **currently SKIPPED** because `.planning/STATE.md:669` reads
  `OV-SOLO-01-status: retired-2026-09-13`. ⚠ If a plan flips a `verification_mode` value it must re-run
  the gate; `peer-reviewed` is already accepted (246/247/248 read it green).
- CRLF is normalised before parsing (`:171`), so a CRLF planning doc is safe here — unlike
  `check-hot-file-ledger.cjs`, which was measured printing `subject: 0` over a CRLF plan.
- The hook **never blocks** (`:28-32`, always exits 0) — it reports in-turn.

---

### 5 · `.planning/ROADMAP.md` Progress rows (×5) and Phase 254's own row

**Analog (self):** the rows at `.planning/ROADMAP.md:410, 411, 412, 414, 415` (`254` is `:416`). Row shape:

```
| <N>. <Name> | <plans>/<plans> | ✅ **CLOSED <date>** — <evidence> ⛔ `verification_mode: self-verified`, `independent_review: owed` (**DEBT-06**; `BUS-NNN`) … | <REQ ids> |
```

**The house rule for changing one — measured in row 415 itself:** a superseded verdict is **appended
after the new one**, never overwritten:

```markdown
⛔ **THE `0 gaps` BELOW IS PRESERVED RATHER THAN OVERWRITTEN, BECAUSE IT WAS WRONG AND HOW IT WAS
WRONG IS THE FINDING.** … — **SUPERSEDED VERDICT FOLLOWS:** ✅ **COMPLETE 2026-09-17 — …**
```
and the same pattern in the counts paragraph below the table (`:418-424`): *"THE `7 / 8` THAT STOOD HERE
UNTIL … IS SUPERSEDED AND PRESERVED, NOT OVERWRITTEN."*

⚠ **Two register facts a plan must carry rather than resolve by guess** (both already stated in the
ROADMAP's own Phase 254 detail, `:332-374`):
- 253's Progress row calls itself the **SIXTH** consecutive self-verified close; its verification note
  says **FIFTH**. Left visible deliberately.
- M-4: 253's frontmatter is `status: gaps_found` while its Progress row reads **COMPLETE**. Both
  defensible; ⛔ neither refutes the other.

⛔ **Do NOT use `gsd-sdk query phase.add` to touch ROADMAP** — CONTEXT `<code_context>`: it wrote entries
into the wrong section twice in two days (252 on 2026-09-16, 254 on 2026-09-17). Hand-edit, read the diff.

---

### 6 · `.planning/REQUIREMENTS.md` — `DEBT-06` (amend, D-02/D-03; do NOT tick)

**Anchors, measured:** `:185` (the requirement text) · `:303` (the coverage row) · `:304` (the
already-present deliberate-untick row).

**Current text at `:185-192`** — this is the sentence D-02 amends (it names *no* v4.2 phase):

```markdown
- [ ] **DEBT-06**: Phases **238, 240, 241** and **242-246** each receive an independent §6.3 review,
      or carry a **written refusal** naming who decided and why. ⭐ **The blocker is gone**: `OV-SOLO-01`
      was **re-armed 2026-09-13** … ⛔ **Nothing is retro-reviewed by re-arming the rule** …
```

**The "ticked, with evidence" pattern to imitate if any arm ever closes** — `REQUIREMENTS.md:175-181`
(REG-03), the immediately-preceding requirement:

```markdown
      ⭐ **TICKED 2026-09-16 (251-04), evidence: `.planning/phases/251-register-integrity/251-BUS-TRIAGE.md`.**
      … ⛔ **Claude wrote nothing to the bus**: `git diff --name-only .agent-bus/` is EMPTY …
```

**The "left unticked, deliberately" pattern — already in the file at `:304` and the one to EXTEND:**

```markdown
| | ⛔ **LEFT UNTICKED at the 251-04 sweep, deliberately** | The other 25 boxes were ticked against a
named artifact. This one has none: **no independent §6.3 review has run** … ⛔ Ticking it would be
exactly the claim ROADMAP:271 forbids. It becomes tickable when a review runs, not when the rule is
re-armed |
```

⛔ **`ROADMAP.md:271` verbatim, since D-03 rests on it:** *"`DEBT-06` is NOT in this phase's scope and
must not be quietly ticked by it."* ⚠ And the coverage table's own footer (`:306-310`): *"Re-derive this
table from the phase directories at close, never from a summary line."*

---

### 7 · `.agent-bus/OPEN.md` — amend the five item BODIES in place (D-06)

**Analog (exact): `BUS-257`'s body** (`.agent-bus/OPEN.md:3099-3132`) — the richest brief in the file and
the one CONTEXT's discretion block points at. Its section order is directly reusable as the per-phase
review brief:

```markdown
### [OPEN] BUS-257 · to:gemini · from:claude · 2026-09-16

REVIEW Phase 253 (CRITICAL, Claude-built) — the mechanical gate pass AGENTS.md §3.1 assigns you.

**Why you and not a self-review:** … (which of §3.1's five critical tests it hits, and why the seats swap)

**What to review:** …  (explicit file list, then `Scope source, FIXED: … Nothing outside it.`)

**Your assigned pass per §3.1:** …  (the named seam, with the md5 that must hold across both plans)

**Facts, no recommendation attached** (§3.1: a measurement pack carrying a suggested fix is a design
direction wearing a lab coat — so these are measurements only):
- `grep -rln "check-schema-acl-parity"` … -> 15 hits, **zero executable invokers**.
- …

**Not asking you to build anything.** … decisions go `--to operator`, never settled agent-to-agent.

**Answer:**
```

`BUS-249` (the 251 ask, `:3051`) is the other good model: it leads with `⛔ WHY IT IS YOU`, then
`ARTIFACTS:`, then numbered `HIGHEST-VALUE TARGETS`, then `⛔ BOUNDARIES THAT WERE DELIBERATE, so you do
not raise them as defects`, then `RECORD:` (what to write back into the frontmatter). ⭐ That
**boundaries** section is what stops a reviewer re-litigating a decision; every amended item should have one.

⛔ **MECHANICAL CONSTRAINTS — measured against `scripts/agent-bus.sh` (174 lines) and the SessionStart hook:**

1. ⚠ **CORRECTION to `254-CONTEXT.md` `<code_context>`.** It says *"`scripts/agent-bus.sh` already
   supports amend-in-place by editing `.agent-bus/OPEN.md` bodies."* **Measured: there is no amend verb.**
   The dispatch at `:166-173` exposes exactly `open | list | answer | close | archive`. An amend is a
   **hand `Edit` of the body text**, and it is legal only because `OPEN.md:4-5` restricts the prohibition
   to the header: *"do not hand-edit the `###` header lines — use the script."*
2. ⛔ **Never touch the `### [OPEN] BUS-NNN · to:x · from:y · YYYY-MM-DD` line.** `cmd_close` (`:145-160`)
   matches `^### \[(OPEN|ANSWERED)\] $id ` and **dies** if the header is malformed; `cmd_list` and
   `agent-bus-check.sh` both parse `to:`/`from:`/the ISO date out of it by regex.
3. ⛔ **Leave the trailing `**Answer:**` line exactly as-is — one per item, nothing after the colon.**
   `cmd_answer` (`:120-125`) requires `$0 == "**Answer:**"` **exactly**; appending text to it makes the
   item permanently unanswerable by the script (it exits 3, *"already answered?"*).
4. ⚠ The SessionStart hook `.claude/hooks/agent-bus-check.sh:80` prints the **first non-empty body line**
   of each `to:claude` item (`awk … {print;exit}`). These five are `to:gemini`, so they are only
   **counted** — but keep the first body line a self-describing sentence anyway.
5. ⛔ **`close` is the operator's verb** (D-05 / REG-03 / `REQUIREMENTS.md:175`). Ship pre-filled
   `answer` + `close` commands in the 254 index (pattern §3 above); run neither.
6. The hook counts by `grep -cE '^### \[OPEN\].*to:<party>'`. **Measured now: 11 open items — 2
   `to:operator` (`BUS-246`, `BUS-248`), 9 `to:gemini` (`BUS-249`..`BUS-257`), 0 `to:claude`.** Amending
   bodies changes none of those counts, which is the point of D-06.

---

## Shared Patterns

### S-1 · ⛔ NOTHING READS `independent_review` — the register flip is documentation, not enforcement

**Measured 2026-09-17, re-derived rather than quoted:**

```
grep -rn "independent_review" scripts/ .claude/ .github/ docs/ AGENTS.md CLAUDE.md   →   NO MATCHES
```
Repo-wide, the only non-`.planning/` occurrences are **prose inside `.agent-bus/OPEN.md`** (4 lines).

`.planning/DEBT-06-AUDIT.md:60-74` reached the same result and named the consequence:
> `scripts/check-verification-honesty.cjs` reads **`verification_mode`** and passes `14/14`. It does
> **not** read `independent_review` — the exact field `DEBT-06`'s close condition is written against.
> So the gate that looks like it guards this **cannot see the thing being audited** …
> ⭐ **This is Phase 251's whole thesis arriving in a third register.**

⚠ **And the decay rate is measured: Phase 240's marker went stale in TEN HOURS** (`DEBT-06-AUDIT.md:44`),
with the same file recording at `:178` that *"these four writes make the index true **today**; they do not
make it stay true."*

**Consequence the planner must price in:** D-10's register moves are **assertions in a file no gate
re-checks**. A plan may NOT write an acceptance criterion of the form *"the gate confirms
`independent_review: done`"* — no such gate exists. Either accept documentation-only (and say so), or
scope a gate deliberately — ⛔ but a new gate is **new capability inside a review phase**, which D-11 /
G-7 forbid. **Recommended: accept, and record the absence as a finding in the 254 index.**

### S-2 · A finding is reported OPEN only after it has been DRIVEN against the tree

Stated three times in this phase's own inputs — `254-CONTEXT.md` `<code_context>`, `ROADMAP.md:369-372`,
and memory `feedback_a_review_is_a_claim_about_code_not_the_code`. The mechanism, verbatim from the
ROADMAP: *"On 2026-09-10 two Phase 239 criticals were escalated as live when they had been fixed two days
earlier, in an ancestor of the reviewer's own base commit. **Each register only knows the one below it;
the code is the bottom.**"* The reusable instrument is `252-REVIEW-R2.md`'s `verdicts: {still_live,
fixed_since, refuted}` triple plus its `### Drive evidence, verbatim` block (§1 above).

### S-3 · The document asserts what it did NOT do, on disk

Three independent precedents, all in this phase's analog set — copy the shape into every 254 artifact:
- `251-BUS-TRIAGE.md:320` — `bus items opened, answered or closed by claude | ⛔ **0** — git diff … EMPTY`
- `DEBT-06-REFUSALS.md:174` — *"it does not flip any `independent_review` field to `done`"*
- `252-REVIEW-R2.md:374` — `## 4. What this round did NOT do`

### S-4 · A correction sits BESIDE its original, never over it

`ROADMAP.md:415` (`— SUPERSEDED VERDICT FOLLOWS:`), `ROADMAP.md:418-424` (three preserved count lines),
`DEBT-06-AUDIT.md:144` (*"the table above is the BEFORE state"*), `243-VERIFICATION.md:5` (prior value kept
in-comment). ⛔ `check-verification-honesty.cjs:158-163` records that this house style is **why** its
liveness test is keyed on an indexed marker and not on prose: *"the eventual retirement line will contain
both tokens forever."* So a 254 correction written as prose is invisible to every scan — **put the state in
a key, the reasons in the body.**

### S-5 · Gate readings at plan time (re-derive at execution, do not inherit these)

| Gate | Command | Reading 2026-09-17 |
|---|---|---|
| seeds register (CLAUDE.md MANDATORY) | `node scripts/check-seeds-register.cjs --phase 254` | **exit 0** · `297/297 parsed · 0 duplicate ids` · ⚠ `0 plan file(s), 0 path(s) in files_modified` → **0 seeds matched**. ⛔ **Not a clean sweep** — the identical limitation was recorded at 253's discuss. **Re-run AFTER the PLAN.md files exist.** |
| verification honesty | `node scripts/check-verification-honesty.cjs` | **exit 0** · `subject: 16 files (9 archived + 7 live)` · `OV-SOLO-01-status: retired-2026-09-13 — claims-review arm SKIPPED` |
| hot-file ledger (G-5) | `node scripts/check-hot-file-ledger.cjs .planning/phases/254-…` | **exit 2** — `FATAL: no *-PLAN.md`. ⚠ Will parse once plans exist; **`.planning/`-only `files_modified` means it has nothing to watch** (`WATCHED` is `backend/app` + `frontend/src` only). ⛔ Its green verdict here means *nothing was checked* — 242 measured that exact vacuity and `BUS-254` records it is **not fully fixed**. |
| G-7 round cap | `node scripts/check-gap-closure-rounds.cjs 254` | **exit 0** · `plans: 0 total · 0 gap-closure` · `G-7 clear` |

⚠ **Capture exit codes without a pipe.** `… | tail` returns *tail's* status, not the gate's — the same
`| tail` mistake that published a wrong backend baseline (memory `feedback_capture_the_set_never_a_tail`).

---

## No Analog Found

| Artifact | Role | Reason |
|---|---|---|
| a **per-phase** refusal file | decision record | The only refusal precedent is the single multi-phase `.planning/DEBT-06-REFUSALS.md`; nothing in the repo is named `*-REVIEW-REFUSAL.md`. D-09's per-phase split is new — lift the SECTION shape (§2) and add a frontmatter block modelled on `DEBT-06-REFUSALS.md:1-9` scoped to one phase. |
| a **gate** over `independent_review` | script | Nothing reads the field (S-1). ⛔ Building one is out of scope (D-11 / G-7) — name the absence, do not close it. |
| an `agent-bus.sh amend` verb | script | Does not exist (§7.1). The amend is a hand `Edit`; there is no analog command to copy. |

---

## Metadata

**Analog search scope:** `.planning/phases/249..254/`, `.planning/milestones/v4.0-phases/238,240,241/`,
`.planning/milestones/v4.1-phases/242..246/`, `.planning/{ROADMAP,REQUIREMENTS,STATE,DEBT-06-*}.md`,
`.agent-bus/`, `scripts/`, `.claude/hooks/`, `.claude/settings.json`.
**Files read in full or in targeted ranges:** 24. **Gates executed:** 4.
**Pattern extraction date:** 2026-09-17.

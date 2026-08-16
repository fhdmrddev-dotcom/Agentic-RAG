---
phase: 194-stop-a-running-workflow
plan: 05
subsystem: guardrails + documentation
tags: [g-5, hot-file-ledger, D-02, D-13, D-14, correct-beside-not-over, reported-bugs, RUN-01]
requires: ["194-01", "194-13"]
provides:
  - "frontend/src/components/chat/RunCard.tsx is a ROW in the CLAUDE.md hot-file ledger, so the discuss-phase G-5 audit can see it"
  - "the WorkspacePanel.tsx row re-derived in place per 194-13's own instruction — updated, never duplicated"
  - "the WorkflowLock.runId JSDoc corrected at the type's own declaration: false at 2 of its 5 write sites, with the 404-swallow consequence stated"
  - "the validated sketch's cancel copy amended under D-13/D-14 beside the operator-approved original"
  - "a verified plan/task coverage mapping for every folded_into: 194 report, plus the duplicate-icon half routed DEFERRED with its trigger"
affects: ["195", "194-07"]
tech-stack:
  added: []
  patterns:
    - "correct-beside-not-over — every claim measured false is recorded beside its original, never over it"
    - "a ledger row may be written on the G-5 COUNT alone; it may not claim honoured-by-construction without an edit to be about"
    - "prove 'the original survives' with git diff --numstat deletions, never with a grep count the correction itself matches"
key-files:
  created:
    - .planning/phases/194-stop-a-running-workflow/194-05-SUMMARY.md
  modified:
    - CLAUDE.md
    - frontend/src/stores/streamsStore.ts
    - .claude/skills/sketch-findings-agentic-rag/references/workflow-run-surface.md
    - .planning/reported-bugs/BUG-260815-07-cannot-delete-a-workflow.md
    - .planning/reported-bugs/chat-stuck-on-starting-workflow-with-duplicate-icon.md
decisions:
  - "The RunCard.tsx ledger row is written on the G-5 COUNT (20 / 8 / 550) and makes NO honoured-by-construction claim, because git log 743965a1..HEAD -- <file> is EMPTY: Phase 194 has not touched it. 194-13 measured the same thing and declined to write the row at all; this plan writes it, on a different and stated basis."
  - "The WorkspacePanel.tsx row was UPDATED IN PLACE, never duplicated — the instruction 194-13 wrote into that row's own text."
  - "The plan's directive to amend the sketch at :135 and :227 was discharged BY MEASUREMENT rather than executed: :25 is the only line carrying the forbidden sentence."
  - "The duplicate-icon half of BUG-260815-04 stays DEFERRED. 194-MEASUREMENTS.md's verdict is '⏸ NOT MEASURED', and both of the report's triggers now stand."
metrics:
  tasks: 3
  commits: 3
  duration: ~55m
  completed: 2026-08-16
---

# Phase 194 Plan 05: the ledger row, the correct-beside debts, and the bug routing Summary

`RunCard.tsx` is now a **row** in the `CLAUDE.md` hot-file ledger after eight phases of being
invisible to its own guardrail, the `WorkflowLock.runId` landmine is documented at the type's own
declaration instead of in one consumer's comment, and every report folded into 194 maps to a named
plan task — with the one half nobody could measure routed as **deferred with a quoted trigger**
rather than as a guess.

**Purpose, restated because it is the whole plan:** *a guardrail cannot see what is absent from its
list.* The discuss-phase G-5 audit scans PLAN.md `files_modified` **against that table**, so a hot
file missing from it is permanently invisible. `WorkflowsPage.tsx` escaped for ten phases,
`WorkflowDoorSwitch.tsx` for six, `WorkflowBuilderPage.tsx` for ten, `db/workflows.py` for
seventeen. `RunCard.tsx` was the next one.

---

## What was done

| Task | Commit | What |
|---|---|---|
| 1 | `77f7fc16` | The `RunCard.tsx` ledger row + the `WorkspacePanel.tsx` cell re-derived in place |
| 2 | `9cb10558` | The `WorkflowLock.runId` JSDoc correction (comment-only) + the sketch's cancel-copy amendment |
| 3 | `2f119da1` | The reported-bug coverage check + three claims corrected beside their originals |

---

## ⚠ THE ROW WAS WRITTEN ON THE G-5 COUNT, AND IT CLAIMS NOTHING IT CANNOT EVIDENCE

This plan's own `must_haves` required `RunCard.tsx` to become a row. Its own `<non_goals>` forbade
*"a ledger row for any file this phase does not touch."* **Measured at `3b22a6c3`, both bind at
once**, because `git log --oneline 743965a1..HEAD -- frontend/src/components/chat/RunCard.tsx` is
**EMPTY** and `wc -l` is unmoved at **550**.

**The resolution, stated in the row itself rather than resolved silently:** the row is written on
the **G-5 COUNT** — 20 commits across 8 phases, far past the ≥3 threshold — which is what the
ledger is actually for. It explicitly makes **no "Phase 194 honoured G-5 by construction" claim**,
because there is no Phase-194 edit for such a verdict to be about. `194-13` measured the identical
thing and declined to write the row at all on those grounds; that measurement stands unrefuted and
is quoted in the new row, not overwritten.

⚠ **The row names the commit that will stale it, by plan number.** Plan `194-07` declares this file
in its `files_modified` and was executing **on the same working tree** while this row was written.
Whoever lands it must re-derive and record beside.

### The measured triples

| File | commits | phases | raw buckets | L | Row |
|---|---|---|---|---|---|
| `frontend/src/components/chat/RunCard.tsx` | **20** | **8** | 9 (`streaming` counted out) | **550** | **ADDED** |
| `frontend/src/components/panel/WorkspacePanel.tsx` | **14** | **9** | 9 (zero non-phase) | **580** | **UPDATED in place** |

**The non-phase bucket is NAMED, never silently subtracted.** `RunCard.tsx`'s ninth bucket is
`streaming`, and it is an untagged 075.x **pair** — `0dce56aa fix(streaming): close silence gaps in
multi-iteration agent runs (075.x follow-up)` and `61e5eb1e revert(streaming): remove silence-gap
SSE changes that caused UI regressions`. **Both counts are recorded, the loser beside the winner**,
because the next reader runs the same command and sees the 9.

**`WorkspacePanel.tsx` was UPDATED, not duplicated** — the instruction `194-13` wrote into that
row's own text (*"Whoever lands `194-05` must UPDATE this row, never add a second one for the same
file"*). Its triple is **unmoved** at `14 / 9 / 580`, and **a non-move is recorded rather than
omitted**, so a reader can tell *"checked, unmoved"* from *"nobody checked"*. Its
*"`RunCard.tsx` deliberately has no row yet"* clause is marked **SUPERSEDED and kept visible** — a
deferral that lives only in a deleted sentence is exactly as invisible as one never written.

### The two CONTEXT corrections, beside their originals

1. **`194-CONTEXT.md` D-01 measures `RunCard.tsx` at *"20 commits / ~9 buckets"*.** The commit count
   and the raw bucket count are **exact**; the **PHASE count it never states is 8**, and that is the
   only figure G-5 reads.
2. **D-01 says both filenames *"occur only inside other rows' prose"*.** ⚠ **FALSE.** `grep -o`
   returned **0** for both before Phase 194 — **neither name appeared in `CLAUDE.md` at all.**
   *"Present but only in prose"* and *"absent entirely"* are different diagnoses with different
   fixes, and the wrong one sends the next reader looking for a mention that was never there. D-01's
   conclusion is unchanged and **strengthened**.

### The declined override — VERIFIED before the sentence was written

`.planning/STATE.md` carries `Guardrail overrides` entries for **193, 193.1, 193.2** and the v3.6
close, and **none for Phase 194**. The sentence *"a G-5 override was OFFERED AND DECLINED, the
fourth consecutive phase"* is therefore written in the new row, and **that absence is a
measurement**.

---

## The correct-beside debts

### (a) `WorkflowLock.runId` — a landmine documented at the type, not at one consumer

The JSDoc asserted *"The workflow_runs.id (active_workflow_run_id) that owns the lock."* **Measured,
it is false at two of five write sites**, and the correction names all five with their id types:

| # | assignment site | value | actual id type |
|---|---|---|---|
| 1 | `StreamsProvider.tsx:965` — `onCapPaused` SSE | `info.runId` | inherits whatever the SSE carried |
| 2 | `StreamsProvider.tsx:1840` — mount reconcile | `wf.active_workflow_run_id` | `workflow_runs.id` ✅ |
| 3 | `StreamsProvider.tsx:1983` — kickoff seed | kickoff POST `run_id` | **`runs.run_id` (producer)** ❌ |
| 4 | `StreamsProvider.tsx:3034` — Continue re-subscribe | `producerRunId` | **`runs.run_id` (producer)** ❌ |
| 5 | `ChatArea.tsx:176` — banner path | `state.active_workflow_run_id` | `workflow_runs.id` ✅ |

**The consequence is stated, not just the fact:** both ids are bare uuids, so **a swap typechecks
and then resolves nothing**; `DELETE /runs/{id}` accepts only the producer id; and `cancelRun`
(`lib/api.ts:1259-1269`) **deliberately swallows 404**. ⇒ **a Stop wired to this field reports
success while cancelling nothing.**

⚠ **The one legitimate production read is explicitly not a counterexample.** `MessageItem.tsx:596`/
`:599` → `continueRun` is correct **only because `/continue` carries a dual-id fallback** — the
field works there because the *server* tolerates both, not because the field is one type.

⚠ **The reason it lives at the declaration this time:** `WorkspacePanel.tsx:164-168` recorded this
same finding in **Phase 188**, in one component's docblock, where it **sat invisible to Phase 194
until it was re-derived from scratch**. *A measurement that lives in one consumer's comment is
invisible to the next phase.*

**Comment-only, proved mechanically rather than asserted.** Every added and removed diff line in
`streamsStore.ts` begins with `*`, `/*`, `//` or is blank — the check was run as a filter over
`git diff -U0` and returned **nothing**. The original sentence survives **verbatim** as the first
line of the new block.

### (b) The sketch's cancel copy — amended under D-13/D-14

`workflow-run-surface.md:25` specifies `⏹ Run cancelled — no deliverable produced · **partial work
discarded**`. **That is the sentence D-13 forbids.** The amendment —
`⏹ Run stopped — no deliverable produced · the phases that finished are kept` — sits **beside** the
operator-approved original under a `⚠ AMENDED (Phase 194, D-13/D-14)` marker.

**Why it is now literally false rather than merely off-tone:** migration 119 adds a `cancelled`
literal to `workflow_phases_status_check` so the *interrupted* phase can be marked honestly, and
`cancel_active_phases` carries `AND status = 'active'` precisely so **completed phases are left
untouched** (D-07). Observed on live data in `194-HEAL-RECEIPT.md`: a `completed` phase stayed
`completed` and two `pending` phases stayed `pending` through a real heal. **A receipt telling a
user their partial work was discarded would be false about rows still sitting in Postgres.**

**Two further flags recorded in the same amendment:**

- **`⏹` is flagged as net-new.** `icon-convention.md` §4's canvas glyph table is `⛨ 🔒 ⤳ ＋ ✕ ↶ ↷ ◆`
  plus the phase-type map — **neither `⏹` nor `■` is in it**. Phase 194 shipped **zero** net-new
  glyphs: the Stop **control** reuses the lucide `Square` (`MessageInput.tsx:420`,
  `ActiveRunsTray.tsx:132`) and the stopped **state** uses `■`, chosen by `194-04` by measurement.
  `194-03` refused `■` for its Stop *button* — *"a state and not a control"* — so the two decisions
  are **one line drawn from both sides, and `⏹` is on neither side of it**.
- **The FOURTH shipped mark RESEARCH's three-mark table missed:** `WorkflowRunPage.tsx:299` renders
  `"⊘ Cancelled"`. That is what turns `⊘` from a plausible pick into a rejected one — it already
  renders for **two** concepts. `194-04` measured the same fourth mark independently; both agree.

---

## Deviations from Plan

### Auto-corrected

**1. [Rule 1 — Bug in the plan's stated content] The plan's `:135` / `:227` amendment targets do not
carry the sentence**

- **Found during:** Task 2(b), before editing.
- **Issue:** the plan says *"do the same at `:135` and `:227` if they carry the same sentence."*
  Measured with `grep -n "partial work discarded"`: **`:25` is the ONLY line in the file carrying
  it.** `:135` is CSS for `.runchip .cancel` with no copy at all; `⏹` at `:30`, `:227` and `:263` is
  the composer's `⏹ Cancel` **control** label and the resolve-toggle legend — a different concept.
- **Fix:** the amendment is scoped to one line and the **conditional is discharged by measurement**,
  recorded inside the amendment itself so a later reader finds a measurement rather than an
  apparent omission.

**2. [Rule 1 — Bug] The plan's acceptance fence for "the original survives" cannot fire as written**

- **Found during:** Task 2(b) verification.
- **Issue:** the criterion is *"`grep -c "partial work discarded"` is unchanged (the original
  survives)."* **It went 1 → 3**, because the amendment **quotes the forbidden sentence twice** in
  explaining why it is forbidden. A needle that matches the correction's own prose is exactly the
  fence class this phase has caught nine times.
- **Fix:** the property was proved with a **stronger** instrument instead —
  `git diff --numstat` on that file reports **10 insertions / 0 DELETIONS**, so the original line is
  byte-untouched. **Zero deletions is a proof; an unchanged grep count would only have been a hint,
  and here it would have been a false alarm.**

**3. [Rule 3 — Blocking] The Task 1 insert concatenated the new row onto the previous row's line**

- **Found during:** Task 1 verification, by the `^| \`…\` |` row-cell fence.
- **Issue:** the edit anchored on `\n\nWhen a new phase enters discuss-phase…` and replaced those
  newlines, so the `RunCard.tsx` row landed **appended to the end of the `harness_engine.py` row**.
  `grep -c "RunCard.tsx"` was already ≥ 1 and the plan's own `<verify>` command **passed**; only the
  stricter *first-cell-of-a-table-row* check caught it.
- **Fix:** newline restored; re-verified. ⚠ **Worth recording: the plan's supplied verify command
  would have shipped a broken table**, because a substring grep cannot tell a row from a suffix.

### Not a deviation, but recorded

⚠ **`194-13`'s Task-3 conflict is resolved rather than re-litigated.** `194-13` wrote the
`WorkspacePanel.tsx` row and deliberately did **not** write `RunCard.tsx`'s, naming this plan as its
owner. Both positions are correct and neither was overwritten: 194-13's *"Phase 194 has not touched
it"* measurement is quoted verbatim in the new row, and the row is written on a **different basis**
(the count) that 194-13's non-goals did not cover.

---

## Task 3 — the coverage check the `plan-phase` touchpoint requires

**Every report with `folded_into: 194` maps to a named plan and task that exists in this phase
directory.** Verified by reading each plan's `<name>Task …` lines, not by assumption.

| Report | Half claimed | Plan → Task | State at this commit |
|---|---|---|---|
| `BUG-260815-07` | the **reproducible** stuck-active-runs clause only | **194-09 Task 1** (Step 3b's `workflow_runs` co-write + the exported composition) · **194-13 Task 2** (the five-row heal with a committed receipt) | ✅ both merged |
| `BUG-260815-04` | the **banner-advance** half only | **194-07 Tasks 1-2** (`outerBannerLabel`'s additive progress input; the `MessageItem` consume, crossing PANEL-09 per D-18) | ⚠ **194-07 was UNSTARTED at this commit and executing concurrently.** Stated rather than assumed complete |
| `BUG-260815-04` | the **duplicate-icon** half | routed by **`194-MEASUREMENTS.md`** | ⏸ **DEFERRED** — see below |
| `BUG-260808-02` | **stopping** a run waiting at an approval (scope-fenced) | **194-09 Task 2** (F-12 ask_user cancel-sentinel ordering) · **194-10 Tasks 1-2** (the engine's shielded expiry + its fences) | ✅ both merged |

**`BUG-260815-03` was NOT re-routed** (D-15): `status: deferred`, `folded_into: null`, deferred to
Phase 195. **Verified byte-unchanged** — `git hash-object` reads `46dab6e1` before and after.
`BUG-260808-02`'s frontmatter already matched the D-08 routing and is likewise **byte-unchanged** at
`375629ed`. **Both non-changes are measurements**, recorded so a reader can tell *"checked,
correct"* from *"nobody looked"*.

### The duplicate-icon routing — DEFERRED, with the trigger quoted verbatim

`194-MEASUREMENTS.md`'s verdict is **`⏸ NOT MEASURED — DEFERRED with a trigger`**. The live store
dump that alone separates the three mechanical verdicts was **never obtained**: no browser was
reachable (`list_connected_browsers` → `[]`), and both operator samples were the **same thread**,
disqualified twice over — it had **no `workflow_runs` row** (an ordinary Deep chat, not a harness
run) and read `runStatus: "completed"` while the symptom is a **streaming-time** condition.
**No verdict was invented.**

⚠ **What WAS established is cited as evidence and explicitly not as the verdict:** on threads owning
a `workflow_runs` row, `runs.message_id` is **NULL in 587 of 607 rows (96.7 %)** while the sampled
Deep run **sets it and it points exactly at the rendered row** — so the **BUG-260609-03
precondition is live at HEAD**. That is a mechanism observed in the **database**, not the symptom
observed in the **store**, and it is consistent with **all three** candidate verdicts.

Deferred under **G-3's sizing rule**: the two live candidates have materially different fixes (a
mount/first-SSE **ordering** fix vs **persisting `message_id` for harness runs**), so guessing ships
a fix for a mechanism nobody observed. The trigger is quoted **verbatim** into the report's
frontmatter and body, **including the correction that the plan's own console expression throws**
(`useStreamsStore` is not on `window`; the dev-server form is
`const { useStreamsStore } = await import('/src/stores/streamsStore.ts');`).

⚠ **BOTH TRIGGERS STAND.** The report's pre-existing *"Re-open if 194 closes only the banner-advance
half"* is **NOT discharged** — it is the trigger that **fired**, and the deferral is its resolution.

### The two claims corrected beside their originals

**`BUG-260815-07` — *"a permanent delete blocker"* is FALSE.** `delete_workflow_cascade`
(`backend/app/api/workflows.py:1483-1518`) cancels the producer **only when one exists**
(`if r["producer_id"] is not None:`) and then calls `await finish_run(pool, r["wf_id"], "cancelled")`
**unconditionally, OUTSIDE that guard** (`:1518`) — so a row with `producer_id IS NULL`, which is
exactly what both of these are, is terminalized anyway. The 409 guard (`:1462`) cannot fire either:
both definitions are `is_system_global = False` with zero foreign runs.

⚠ **The correction does NOT de-scope the heal**, and the four honest reasons are restated in the
report so it cannot be read that way: the rows **lie about being live**; two threads still held
`active_workflow_run_id` anchors; one is an abandoned `is_golden_run`, permanently unresumable since
Phase 190's A4 gate; and shipping the fix that prevents new stuck rows while leaving the known ones
stuck is the inconsistency RUN-01 exists to remove. ⛔ **The non-reproducible delete-failure half is
untouched** — its section is unedited and `grep -ci "NOT reproducible"` is **2 before and 2 after**.

**`BUG-260815-04` — two pointer corrections.** (1) The pin is at **`:31`**, not `:30`: `:30` is the
`it("D-14 byte-identical: …")` **title** line and the byte-exact `expect(...).toBe("Starting
workflow…")` is one line lower, in `frontend/src/lib/__tests__/toolMeta.test.ts`. `toolMeta.ts:92`
is exact. *A plan told to check the pin at `:30` reads a test name and can conclude the pin is
prose.* (2) The named prior art `toolcallpanel-dedup-duplicates-tool-card.md` / `BUG-260521-01` is
the **WRONG one** — a transient (~10-15 s) duplicate **tool card**, minor, folded into 075.2. The
three correct pointers (`dedupMessages.ts:20-26`, `StreamsProvider.tsx:2490-2500`,
`dedupMessages.ts:31-45`) are recorded **beside** it; the original is left in place.

---

## Verification — every figure compared to `194-BASELINE.md`

| Gate | Baseline (`743965a1`) | Measured now (`2f119da1`) | Verdict |
|---|---|---|---|
| (b) `tsc -p tsconfig.app.json --noEmit` | **33** | **33** | ✅ unmoved (re-run after Task 2 and again at the end) |
| (a) frontend count gate | `count gate OK` · 3918 · failed **0** · 75/75 | **`count gate OK` · 3954 · failed 0 · pinned 3868 · 75/75** | ✅ a growing total is the gate working |
| `git diff --numstat -- CLAUDE.md` | — | **2 added / 1 deleted** | ✅ the one deletion is the `WorkspacePanel.tsx` row **rewritten in place**; no other pre-existing row edited |
| `streamsStore.ts` diff | — | **comment-only** | ✅ every added/removed line starts with `*`, `/*`, `//` or is blank — proved by filter, not by eye |
| sketch diff | — | **10 added / 0 deleted** | ✅ the operator-approved original is byte-untouched |
| `BUG-260815-03` / `BUG-260808-02` | `46dab6e1` / `375629ed` | **`46dab6e1` / `375629ed`** | ✅ byte-unchanged |

**`failed` was 0 on the first count-gate run, so no filename capture and no second run was owed** —
recorded explicitly, because `193.2-02` broke that rule and could not afterwards prove its cases
innocent. `GSD_VITEST_MAX_WORKERS=2` was set.

⚠ **The count gate does NOT execute `src/components/chat`** — its `TARGETS` covers
`src/components/workflows` plus four named Builder files — so it is **not** evidence about my
sibling's surface, and no claim is made that it is.

### Fence discipline

**This plan declares no new test fence**, so there is nothing to drive RED, and that is stated
rather than silently skipped. What stands in for one is that **three of this plan's own acceptance
checks were found unable to fire and were replaced with instruments that can** — see Deviations 2
and 3. **A supplied verify command that passes on a broken artifact is a finding, not a formality.**

---

## Threat model — dispositions honoured

| Threat ID | Disposition | How |
|---|---|---|
| T-194-05-01 (Repudiation, the hot-file ledger) | **mitigated** | Both rows carry the ABSENT sentence on ONE line each (`grep -q`-verified, not eyeballed) and every figure has its re-derive command inline with the answer at this commit. A future reader audits rather than trusts. |
| T-194-05-02 (Tampering, `streamsStore.ts`) | **mitigated** | Comment-only, asserted mechanically by a filter over `git diff -U0` that returned nothing, and re-verified by a typecheck matching the baseline **exactly** at 33. |
| T-194-05-03 (Info disclosure, reported-bug files) | **accept** | No new secret, credential, token, auth header, prompt or user content. Run ids and file:line references only, all already in-repo. |
| T-194-05-SC (package installs) | **n/a** | **No package added.** No `package.json` / `requirements.txt` change. |

---

## Scope

⛔ **No behaviour change anywhere** — `streamsStore.ts` is comment-only and every other file is
documentation. ⛔ No migration authored, edited or applied. ⛔ No database write of any kind.
⛔ No `git add -A`, no `git add .`, no `git commit -a` — **every commit staged files by explicit
path**. ⛔ No `git clean`, `git stash`, `git reset` or `git checkout --`. ⛔ No worktree created or
torn down. ⛔ The pre-existing uncommitted `.claude/` and `supabase/snippets/` modifications and the
untracked `.claude/` additions were **not staged, committed, reverted or cleaned**.

⚠ **My sibling plan `194-07` was executing on the same working tree.** Its five declared files —
`frontend/src/lib/toolMeta.ts`, `frontend/src/lib/__tests__/toolMeta.test.ts`,
`frontend/src/components/chat/MessageItem.tsx`, `frontend/src/components/chat/RunCard.tsx`,
`frontend/src/components/chat/__tests__/MessageItem.harnessBanner.test.tsx` — were **not read for
edit, not staged, not committed and not touched**. Verified: `git diff --numstat` across all three
of this plan's commits names only this plan's own five files.

## STATE / ROADMAP / REQUIREMENTS

**Untouched by design.** No `gsd-sdk query state.*`, no `roadmap.update-plan-progress`, no
`requirements.mark-complete` was invoked — those seven verbs write false records and corrupted
STATE.md five times in Phase 190 alone. `.planning/STATE.md`, `.planning/ROADMAP.md` and
`.planning/REQUIREMENTS.md` appear in no commit of this plan. Nothing auto-flipped a REQ-ID or a
roadmap checkbox, so nothing needed reverting.

## Known Stubs

None. Every artifact this plan owed exists and is committed.

⚠ **Two honest limits, stated rather than discovered later.** (1) **`RunCard.tsx`'s row records a
count, not a Phase-194 edit** — when `194-07` lands, its triple `20 / 8 / 550` goes stale and the
row says so by plan number. (2) **The duplicate-icon half of `BUG-260815-04` has no verdict**, and
the phase closes with that owed rather than guessed; the trigger is in the report's frontmatter, its
body, and `194-MEASUREMENTS.md`.

## Threat Flags

None. This plan opens no network endpoint, adds no auth path, no file access pattern and no schema
change.

---

## Files

| File | Change |
|---|---|
| `CLAUDE.md` | **+2 / −1** — the `RunCard.tsx` row ADDED; the `WorkspacePanel.tsx` row rewritten in place (the single deletion) |
| `frontend/src/stores/streamsStore.ts` | **+36 / −1**, **comment-only** — the corrected `WorkflowLock.runId` JSDoc; the deleted line is the original one-line comment, whose sentence survives verbatim inside the new block |
| `.claude/skills/.../references/workflow-run-surface.md` | **+10 / −0** — the `⚠ AMENDED` cancel-copy block beside the untouched original |
| `.planning/reported-bugs/BUG-260815-07-cannot-delete-a-workflow.md` | **+36 / −1** — the delete-blocker correction in frontmatter and body; the deletion is the `re_open_trigger` line rewritten with its original text preserved verbatim as a prefix |
| `.planning/reported-bugs/chat-stuck-on-starting-workflow-with-duplicate-icon.md` | **+70 / −1** — the DEFERRED routing with its quoted trigger, the wrong-prior-art correction, the `:30` → `:31` pin correction; same single-line frontmatter rewrite |

## Commits

- `77f7fc16` — `docs(194-05): add the RunCard.tsx hot-file ledger row + re-derive WorkspacePanel.tsx`
- `9cb10558` — `docs(194-05): correct the WorkflowLock.runId JSDoc and amend the sketch's cancel copy`
- `2f119da1` — `docs(194-05): verify the reported-bug routing and correct three claims beside their originals`

## TDD Gate Compliance

**Not applicable, and stated rather than silently skipped.** This plan's frontmatter carries no
`type: tdd` and no task carries `tdd="true"`. It writes **no production logic at all** — its only
source-tree edit is a comment block, mechanically proved to contain no executable line. The RED/GREEN
gate has nothing to bind to. The phase's TDD evidence lives in plans `194-06`, `194-09`, `194-10` and
`194-11`, each with its own `test(…)` → `feat(…)` pair.

## Self-Check: PASSED

- `CLAUDE.md` — FOUND · `grep -c '^| \`frontend/src/components/chat/RunCard.tsx\` |'` → **1** (a row cell, not prose) · same for `WorkspacePanel.tsx` → **1** · `ABSENT FROM THIS TABLE UNTIL PHASE 194` → **5** · `It inherits` → **12** · table rows → **34**
- `grep -o "RunCard.tsx" CLAUDE.md | wc -l` → **12** (was **0** before Phase 194) · `WorkspacePanel.tsx` → **5**
- `frontend/src/stores/streamsStore.ts` — FOUND · `CORRECTED` present · original sentence present **1**× · non-comment diff lines **0**
- `.claude/skills/sketch-findings-agentic-rag/references/workflow-run-surface.md` — FOUND · `AMENDED` present · deletions **0**
- all four reported-bug files — FOUND · the plan's `<verify>` command returns **TASK3-VERIFY-OK** · no `status:` advanced to `closed`
- `77f7fc16` / `9cb10558` / `2f119da1` — all FOUND in `git log`
- `tsc -p tsconfig.app.json --noEmit` → **33** (baseline) · count gate → **`count gate OK` · 3954 · failed 0 · 75/75**
- `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md` — in **no** commit of this plan

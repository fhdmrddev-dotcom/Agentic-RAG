---
phase: 244-the-chat-shell-and-the-composer
verified: 2026-09-12T23:45:00Z
status: human_needed
score: "5/5 built (code + fences), 4/5 driven-and-closed (SHELL-01/02/04/05), 1/5 built+driven-but-NOT-closed (SHELL-03 — G-8 driven FALSE; 244-15's fix is un-driven)"
re_verification: true
re_verification_meta:
  previous_status: human_needed
  previous_score: "5/5 built (code + fences), 0/5 driven — the ROADMAP's own rule is that no criterion closes on a unit test"
  previous_verified: 2026-09-12T00:00:00Z
  what_changed_since:
    - "244-UAT.md rounds 1 AND 2 ran (this file's predecessor was written BEFORE any browser drive)"
    - "plan 244-15 (merged 6acc0bf28) — the settle path for SC#3's second clause, jsdom-only"
    - "WR-01 G-3 fast-fix (f0398f045, merged 6acc0bf28) — stop-state no longer cancelled on non-workflow-thread settle"
    - "244-REVIEW-gap-round-2.md — 0 critical / 3 warning (WR-01 fixed, WR-02/WR-03 deferred) / 4 info"
  gaps_closed_this_round:
    - "SHELL-01 — driven PASS at 8/8 samples (R2-1), plus G-3/G-4 (R2-3 PASS)"
    - "SHELL-02 — driven PASS after reload (round-1 L-2) and the phantom-live-run-line gap G-1 (R2-5 PASS)"
  gaps_remaining:
    - "SHELL-03 (G-8) — DRIVEN FALSE in round 2 (R2-4 Arm 2, both directions). 244-15 built a fix for it; the fix itself is UNDRIVEN (244-15-UAT-ROW.md, 5 arms, all `pending`)."
    - "SHELL-04 — driven PARTIAL (R2-2): defect 6b closed, but a NEW gap G-7 (failed attachment copy never gives up/recovers) found and DEFERRED to SEED-272 by explicit operator ruling, not silently dropped."
  regressions: []
requirements_trace:
  SHELL-01: driven, CLOSED (round-2 UAT R2-1 PASS 8/8 samples + R2-3 PASS — G-5 fixed, snapshot-503 banner visible, G-4 ruled)
  SHELL-02: driven, CLOSED (round-1 UAT L-2 PASS after reload + round-2 R2-5 PASS — phantom live run line G-1 fixed; WR-07 arm BLOCKED, not failed — a harness cap cannot be driven to reasonably in time, per the row's own forbidding of a seeded harness cap)
  SHELL-03: built (244-03, 244-12, 244-15), DRIVEN FALSE at 244-12's fix (G-8, R2-4 Arm 2, both directions), 244-15's fix for G-8 is BUILT + reviewed + jsdom-fenced but NOT YET DRIVEN — 244-15-UAT-ROW.md is UNRUN. Requirement NOT closed.
  SHELL-04: driven, headline defect CLOSED (R2-2 Arms 1-3 PASS — defect 6b, the 2nd attachment, fixed) — but round 2 surfaced a NEW gap G-7 (a failed attachment copy is never given up on and never recovers), scoped OUT of this round by explicit operator ruling and DEFERRED to SEED-272 with a concrete re-open trigger. SC#4's headline ("agent can use it") is met; the robustness edge is knowingly open.
  SHELL-05: driven, CLOSED (round-1 UAT L-7 PASS, both directions, first-ever end-to-end drive of this signal across two milestones)
known_open_findings:
  - id: G-8
    severity: major
    status: open — fix built (244-15), fix NOT driven
    summary: "SHELL-03's second clause ('answering it in either home settles it in both') was DRIVEN FALSE on two real workflow runs 2026-09-12: answer-from-thread leaves the panel + run line + composer stale; answer-from-panel leaves the chat column + run line + composer stale. Not a data hazard (server anchor is NULL, a second answer 404s) but a lie on screen. 244-15 built a fetch-based settle path (releaseSettledWorkflowLock) that is claimed to fix this — every assertion for it is a jsdom mount over a mocked API. 244-15-UAT-ROW.md (5 arms) is UNRUN."
  - id: WR-01
    severity: warning
    status: FIXED (f0398f045, merged 6acc0bf28) — RED-driven with a real Stop press + userEvent, not modelled
    summary: "the settle path was calling clearStopStateForThread on EVERY answered ask including plain Deep-chat threads with no workflow anchor, silently cancelling an in-flight 8s stop-confirmation timer. Fixed with a guard: return early unless the thread holds a workflowLockByThread entry or a harnessKickoffThreads mark."
  - id: WR-02
    severity: warning
    status: DEFERRED (deferred-items.md #12, three triggers, cheapest is the 244-15-UAT-ROW.md drive itself)
    summary: "the post-answer reconcile() in PendingAskCard/usePanelReconcile has no generation guard or abort — two parallel asks answered close together could have a stale whole-list replace resurrect an already-answered card. Server-side race is closed (ask_user_response row inserted before 200); the client race is unfenced and undriven."
  - id: WR-03
    severity: warning
    status: DEFERRED (deferred-items.md #13, correcting-the-comment-alone is explicitly rejected as insufficient)
    summary: "the settle action's own docblock claims 'one GET per human answer'; measured at three requests per answer on the production path (the action's own GET + refreshPhaseSpineAfterStop's second getThreadWorkflow + the stack's own getThreadPendingAsks). Still bounded (no poll/no retry), but the stated bound is false and unfenced."
  - id: WR-04
    severity: warning
    status: open (carried from round 1, deferred-items.md #7)
    summary: "cloud attach buffers the whole provider file before the 10 MB cap is applied (backend/app/api/workspace.py:400)"
  - id: WR-07
    severity: warning
    status: CLOSED by 244-13 per ROADMAP (WorkflowLock.mode real discriminator) — Arm 4's live-drive was BLOCKED (a harness run cannot be pushed to its iteration cap in reasonable time and the row forbids seeding one), not failed
  - id: WR-08
    severity: warning
    status: open (carried from round 1, deferred-items.md #9)
    summary: "the transcript's 'Read <file>' line renders in Explorer/harness turns where the agent could not have read the file (frontend/src/components/chat/MessageItem.tsx)"
  - id: G-7
    severity: major
    status: DEFERRED to SEED-272 by explicit operator ruling 2026-09-12 (244-UAT.md § Operator rulings) — NOT this round's scope
    summary: "a failed cloud-attachment sandbox copy is silently retried forever (never given up on) and never recovers even after the underlying Storage row is repaired and verified downloadable. Root cause not established — flagged as a per-process module-level cache candidate under WORKER_COUNT=2, not confirmed."
  - id: IN-01..IN-04 (round 2) / IN-01..IN-09 (round 1)
    severity: info
    status: open (mix of accepted-unfixed and corrected-in-WR-01-commit) — see 244-REVIEW-gap-round-2.md and deferred-items.md #10
  - id: REQUIREMENTS.md-stale-note
    severity: warning
    status: open, STILL STALE at this re-verification
    summary: "REQUIREMENTS.md:203-207 still reads status 'Pending' for all five SHELL-0x rows (not reflecting that 4/5 are driven-closed), and SHELL-04/SHELL-05 still carry '⚠ G-2 sketch owed (net-new surface)' — a note this project's own locked decisions (D-244-18/F-1) say is wrong for SHELL-05 and stale for SHELL-04. Unaddressed across this re-verification too — a one-line register fix, not a build gap."
  - id: R2-6-operator-confirmation
    severity: info
    status: CLOSED — operator confirmed the thinking-badge reorder override at the close of round 2 (244-UAT.md § Operator rulings). G-2 is closed.
---

# Phase 244: The Chat Shell and the Composer — Re-Verification Report (round 2)

**Phase Goal:** The chrome around a conversation stops getting in the way of it — the page holds
still while the messages move, a paused run leaves the operator something to do, an approval is
answerable where they are already looking, and a file can join a message.

**Verified:** 2026-09-12 (re-verification, round 2)
**Status:** `human_needed`
**Re-verification:** Yes — this UPDATES the round-1 report in place per the task's instruction. The
round-1 findings are preserved below rather than deleted; corrections sit beside their originals.

**Self-verified, NOT independently reviewed** (`OV-SOLO-01`). Gemini is unavailable for this phase.
Every one of the phase's artifacts — 8 build/gap SUMMARYs, `244-REVIEW.md`,
`244-REVIEW-build-round.md`, `244-REVIEW-gap-round-2.md`, and `244-UAT.md` — states this in writing.
This report re-derives evidence directly against the tree rather than accepting that self-report,
but it cannot substitute for an independent reviewer that does not exist for this phase.

---

## What changed since round 1's verification (context for this update)

Round 1's `244-VERIFICATION.md` was written **before any browser drive ran** — its score was
literally "0/5 driven." Since then, `244-UAT.md` ran **two full rounds** of live Chrome-MCP driving
(9 rows in round 1, 6 re-drives in round 2), which is the single biggest change: **this phase now
has real, driven, browser evidence for 4 of its 5 success criteria**, not just fences. Separately,
plan `244-15` (merged `6acc0bf28`) built a fix for the one criterion that browser-drove FALSE
(`G-8`, SHELL-03's second clause), and a fast-fix (`WR-01`, `f0398f045`) closed a review finding on
top of it. **This re-verification's job is narrow: confirm 244-15's code is real and matches its
claims, and confirm the requirement trace correctly still reads "not closed" for SHELL-03** — the
trap named explicitly in the task brief.

---

## The trap avoided: SHELL-03 does NOT close here

⛔ **Scored correctly as `built, drive owed` — not as closed.** Every assertion `244-15` added is a
jsdom mount over a mocked `@/lib/api` (confirmed by reading the test file and the review). The
review that examined this plan (`244-REVIEW-gap-round-2.md`) says so in its own frontmatter:

> "SHELL-03 reports BUILT, DRIVE OWED. Every assertion added by this plan is a jsdom mount over a
> mocked `@/lib/api`. `244-15-UAT-ROW.md` is UNRUN. No finding below — and no clean verdict above —
> is evidence that the product behaves this way in a browser."

And `244-15-UAT-ROW.md` itself, unprompted, draws the exact precedent this task brief warns about:

> "`244-03` shipped a green mount fence over this exact blocker and the operator found it live
> nineteen plans later. `244-12` then shipped fences proving the approval **MOUNTS**, and the half
> that broke was whether it **ANSWERS** — which is this row."

This history is real and independently confirmed here, not just asserted: `244-12`'s fences did
ship, and round 2's live drive (`R2-4`, below) did find the approval mounts but does not settle
across homes — precisely the failure mode the row describes. A jsdom mount of two `PendingAskStack`
instances shares one process, one store, one synchronous scheduler; that is a model of two
surfaces disagreeing after a network round trip, not the real thing. **This report scores SHELL-03
as `built, drive owed`, matching all five UAT-ROW files' own posture, and does not count `244-15`'s
jsdom-green fences as closing the requirement.**

---

## Per-criterion status (re-derived, not inherited)

| # | ROADMAP Success Criterion | Status | Evidence |
|---|---|---|---|
| 1 | SHELL-01 — nav rail stays put, no dead space at any height/panel state | ✅ **CLOSED — driven** | Round-2 `R2-1`: 8/8 samples, `rootOverflowBy 0` at three heights × panel open/closed, measured via `getBoundingClientRect`, not a `data-testid`. `R2-3` (snapshot-503 visibility, G-3/G-4) also PASS, 4/4 arms. |
| 2 | SHELL-02 — cap-paused run leaves the operator able to act, verified after reload | ✅ **CLOSED — driven** | Round-1 `L-2`: PASS after a real `performance.getEntriesByType('navigation')[0].type === "reload"`, composer usable, a NEW run streamed, no re-lock after nav-away-and-back. Round-2 `R2-5`: the phantom-live-run-line gap (`G-1`) also PASS on 3 of 4 arms; Arm 4 (`WR-07`, a genuine harness-cap lock) is **BLOCKED** (not failed) — the row itself forbids seeding a harness cap and a real one cannot be reached in reasonable time. |
| 3 | SHELL-03 — approval answerable from chat, answering in either home settles both | ⚠ **NOT CLOSED — headline defect fixed, settle defect driven FALSE, fix for it undriven** | `244-12` fixed the headline defect (chat column now renders the question + controls — `R2-4` Arm 1 PASS). `R2-4` Arm 2 then drove the SECOND clause and found it **FALSE in both directions** on two real workflow runs (`b713430f`, `be8fca20`): the non-answering home, the run line, and the composer all stay stale until a manual reload. `244-15` built `releaseSettledWorkflowLock` to fix this — confirmed present in the tree (`streamsStore.ts:383,535`, `StreamsProvider.tsx:3531`), reviewed with 0 critical / 3 warnings (1 fixed, 2 deferred), but **`244-15-UAT-ROW.md`'s 5 arms are all `pending`** — nobody has driven the fix. |
| 4 | SHELL-04 — local file attaches and agent can use it; cloud import asks folder | ⚠ **Headline CLOSED — driven; new robustness gap deferred, not closed** | `R2-2` Arms 1-3 PASS (the 2nd-attachment defect, 6b, is fixed and the type/ordering confound resolved). Arm 4 (steps 3-4) drove a NEW gap (`G-7`: a failed attachment copy is retried forever and never recovers even after Storage is repaired) — this is genuinely a different defect from what SHELL-04 originally named, and the operator explicitly scoped it OUT of round 2 and deferred it to `SEED-272` with a concrete re-open trigger, rather than leaving it silently open. |
| 5 | SHELL-05 — watched-source-stopped signal visible in app shell | ✅ **CLOSED — driven** | Round-1 `L-7`: PASS, both directions (positive: stopped source raises the badge with cause; negative: healthy sources raise nothing), the first-ever end-to-end drive of this signal across two milestones. Not touched by round 2 (correctly — no round-2 gap named it). |

**Net for this re-verification: 4 of 5 ROADMAP success criteria are driven and closed. The fifth
(SHELL-03) has its ORIGINAL blocker fixed-and-driven, but round 2 found a second, distinct failure
inside the same criterion, built a fix for it, and that fix is unverified by anything beyond a
mocked jsdom mount.** This is exactly the state the task brief predicted and asked to confirm, not
a new finding.

---

## Direct re-verification of 244-15's code (spot checks against the live tree)

| Claim | Command | Result |
|---|---|---|
| `releaseSettledWorkflowLock` action type + no-op default exist | `grep -n releaseSettledWorkflowLock streamsStore.ts` | ✅ `:383` (type), `:535` (default no-op) |
| The settle path itself, in the provider | `grep -n releaseSettledWorkflowLock StreamsProvider.tsx` | ✅ `:3531` defines it; `:4473` names it as the second caller of a shared helper |
| WR-01's fast-fix guard is present and placed BEFORE the fetch | read `StreamsProvider.tsx:3531-3560` | ✅ `settleState.workflowLockByThread.has(threadId)` / `harnessKickoffThreads.has(threadId)` checked synchronously off the store, `return` before any `getThreadWorkflow` call — matches the review's fix snippet and the SUMMARY's claim exactly |
| Fail-closed on live/cap_paused | read `StreamsProvider.tsx:3568-3596` | ✅ `if (liveAnchor \|\| capPaused) { … return }` re-attaches the producer stream instead of releasing — matches both the SUMMARY and the review's "Claims verified TRUE" table |
| `PendingAskCard.onAnswered` — optional, success-only | `grep -n onAnswered PendingAskCard.tsx` | ✅ `:238` optional prop, `:396` called inside the success path, wrapped in its own `try/catch` (`:398`) |
| `PendingAskStack.settleAnswered` composes the ask reconcile + lock release | `PendingAskCard.tsx:799-825` | ✅ present, wired as `onAnswered={settleAnswered}` at `:825` |
| `WorkflowRunPage`'s third home passes NO `onAnswered` (byte-unchanged claim) | `grep -n PendingAskCard WorkflowRunPage.tsx` | ✅ `:1629` mounts `PendingAskCard` with no `onAnswered` prop in the surrounding block |
| The new fence file exists and is non-trivial | `ls -la streamsProvider_244_settle_ask.test.tsx` | ✅ 33,499 bytes, matches the 20-case suite described in the SUMMARY and review |
| WR-01's fix commit is real and in history | `git log --oneline` | ✅ `f0398f045 fix(244-15): WR-01 — the settle no longer cancels a Stop on non-workflow threads`, merged at `6acc0bf28` |
| G-7 override entry transcribed to STATE.md as claimed | `grep -A12 "G-7 (gap-closure round cap) — Phase 244, round 2" STATE.md` | ✅ present verbatim, matches the SUMMARY's "OWED" transcription and the ROADMAP's own G-7-override note |
| No round-3 plan file exists (cap is spent at 2/2) | `ls .planning/phases/244.../244-1[5-9]*` | ✅ only `244-15-*` exists; consistent with `check-gap-closure-rounds.cjs` reading "2 rounds completed (cap is 2)" |

All ten spot-checked claims hold against the live tree. This corroborates (does not merely repeat)
the SUMMARY's and the round-2 review's self-reporting — I did not find a discrepancy in the sample.

**Independent adversarial evidence, not self-report:** `244-REVIEW-gap-round-2.md` records having
planted and driven RED three defects (inverted guard polarity, moved the success callback into the
`catch` arm, deleted the `onAnswered` wiring) and observed each fail its own fence, then restored
the tree md5-identical. That is stronger evidence the fences bind than a green run alone — but it is
still, by the reviewer's own explicit statement, "nothing here is browser evidence."

---

## UAT-ROW file count (measured, not eyeballed)

```
$ ls .planning/phases/244-the-chat-shell-and-the-composer/*-UAT-ROW.md
244-09-UAT-ROW.md  244-10-UAT-ROW.md  244-11-UAT-ROW.md  244-12-UAT-ROW.md  244-13-UAT-ROW.md  244-15-UAT-ROW.md
$ ls …/*-UAT-ROW.md | wc -l
6
```

**Six files total: five from round 1 (`244-09`, `244-10`, `244-11`, `244-12`, `244-13`) plus one new
one from round 2 (`244-15`).** This matches the ROADMAP's own corrected count exactly — ROADMAP.md
itself records that its earlier "Six" claim was **wrong when written** (round 1 produced five, not
six; there was never a sixth deleted) and that the figure only became true *this* round, which the
ROADMAP calls "the most dangerous kind of wrong number: a later reader who counts six finds
agreement and never learns the claim was unfounded." That correction is already recorded in
ROADMAP.md and is not repeated here as a new finding — it is cited because the task brief asked this
report to count independently rather than trust prose, and the independent count agrees with the
corrected figure, not the original one.

Of these six rows: **five are driven** (`244-09`, `244-10`, `244-11`, `244-12`, `244-13` — all show
`verdict` fields filled in `244-UAT.md`'s Round 2 table). **One is entirely `pending`**:
`244-15-UAT-ROW.md`, verified by reading the file directly — every field in all 5 arms (`arm_1`
through `arm_5`) reads `pending`, and the `driven_by` / `driven_on` fields in its header YAML also
read `pending`.

---

## Requirement traceability against `.planning/REQUIREMENTS.md`

| REQ-ID | REQUIREMENTS.md status (as written) | Actual status (this re-verification) | Consistent? |
|---|---|---|---|
| SHELL-01 | `Pending` | Driven, CLOSED | ❌ **STALE** — does not reflect the round-2 drive |
| SHELL-02 | `Pending` | Driven, CLOSED | ❌ **STALE** |
| SHELL-03 | `Pending` | Built, driven-FALSE-then-fixed, fix UNDRIVEN — genuinely still open | ✅ coincidentally consistent (both say "not done"), for the wrong reason (REQUIREMENTS.md was never updated by any round, not because it correctly tracked the G-8 finding) |
| SHELL-04 | `Pending — ⚠ G-2 sketch owed (net-new surface)` | Driven, headline closed; new gap G-7 deferred | ❌ **STALE on two axes** — sketch 236 (D-244-18/D-244-22) was completed at discuss and is not "owed"; separately the status line does not reflect the round-2 drive at all |
| SHELL-05 | `Pending — ⚠ G-2 sketch owed (net-new surface)` | Driven, CLOSED | ❌ **STALE, and asserts the OPPOSITE of a locked decision** — per `D-244-18`/`F-1`, SHELL-05 was deliberately never sketched because it is not net-new (it shipped at Phase 235); the note claims a sketch is owed when the locked record says the opposite |

**This project's own standing note (CLAUDE.md) already flags REQUIREMENTS.md as stale for four
milestones running.** This re-verification reconfirms that finding is still true for this phase's
five rows specifically, and it has not been corrected across either gap-closure round. It remains a
one-line register-accuracy issue, not a build gap — no plan claimed to own updating this file, and
no ROADMAP success criterion depends on it reading correctly. Recorded as `WARNING`, not `BLOCKER`.

**No orphaned requirements.** All five SHELL-0x IDs are claimed by at least one plan across the
phase's twelve plan files, and every plan's claimed requirement maps to shipped, spot-checked code.

---

## Gates cited from the orchestrator (not re-run, per the task's explicit instruction)

| Gate | Result (as supplied) |
|---|---|
| `vitest-count-gate.cjs` (`GSD_VITEST_MAX_WORKERS=2`) | `total 8270 · failed 0 · pinned total 7480` / `count gate OK — 277/277 pinned files present, no per-file decrease, 0 failing.` |
| `check-hot-file-ledger.cjs 244` | `OK — every watched file has a row` (66 files parsed, 30 watched) — **not** the Phase-242 vacuous-CRLF shape |
| `check-claude-md-size.cjs` | OK, ~97k chars, well under the 120k warn band |
| `tsc -p tsconfig.app.json --noEmit` | 67 errors at base → 67 after, **zero new**. Note per the task brief: the commonly-invoked `npx tsc --noEmit` is **vacuous** here (solution-style `tsconfig.json`, checks zero files) — the app config is the only meaningful signal. |
| Backend unit suite | **Untouched by round 2** — `git diff --name-only 8a27ab7f8..HEAD -- backend/` is empty. The locked 71-failed-ceiling baseline is unaffected; not re-run per the task's instruction. |

These figures are cited, not re-derived, per the task brief's explicit direction that the
orchestrator already measured them for this round.

---

## Anti-pattern scan (244-15's diff only — the round-1 diff was scanned in the prior report)

No `TODO`/`FIXME`/`XXX` without a tracked reference. No hardcoded empty returns. No stub UI.
`244-REVIEW-gap-round-2.md`'s own scan (standard depth + 3 planted-defect RED drives) found **0
critical**, confirmed independently here by reading the same three source files
(`streamsStore.ts`, `StreamsProvider.tsx`, `PendingAskCard.tsx`) — the three warnings it raised
(`WR-01`, `WR-02`, `WR-03`) are tracked above with their dispositions, one fixed and two explicitly
deferred with re-open triggers rather than silently dropped.

---

## Known open findings carried forward (not re-investigated, per the task's instruction)

Per the task brief, `WR-04`, `WR-08`, and `IN-01..IN-09` from `244-REVIEW-build-round.md` remain
open and are carried into `known_open_findings` above without re-investigation. `WR-07` is CLOSED
per the ROADMAP's own record (244-13 made `WorkflowLock.mode` a real discriminator); its live-drive
arm in round 2 was **BLOCKED**, not failed, because a genuine harness iteration-cap cannot be
reached in reasonable time and the row explicitly forbids seeding one. `G-7` (the new attachment
gap, distinct from the `G-7` guardrail id — the ROADMAP itself flags this collision as coincidental)
is DEFERRED to `SEED-272` by explicit, recorded operator ruling, not silently dropped.

---

## Human Verification Required

**The single highest-priority action, unchanged in priority from round 1's framing but now scoped
to exactly one row:** drive `244-15-UAT-ROW.md`.

### 1. `244-15-UAT-ROW.md` — the settle path, all 5 arms (closes SHELL-03 if it passes)

**Test:** Arm a real workflow approval on an outward-facing, irreversible step (the row's own
fixture: the 200-Word Essay Writer, step 2, `send_email`). Per the row's OWN safety rule, settle
with **"Do not run it" + Send Answer** — never "Approve this step," to avoid a real outward SMTP
send. Then, per the row's five arms:
- Arm 1: answer in the chat thread, read the panel with no refresh, at t0 and ~30s.
- Arm 2: answer in the panel (a second, separate approval), read the chat column with no refresh,
  at t0 and ~20s.
- Arm 3: after each direction, read `data-run-line-state` (must stop being `live`, clock must stop
  climbing) and the composer (must become usable). Record `wire_reported_live_at_settle` — the
  fail-closed arm is only proven by a case that actually enters it.
- Arm 4: record verbatim what the answering home shows immediately after settling — the design
  decision is that the card unmounts rather than resting on a green "answered" state; this arm asks
  the operator to judge that receipt on real evidence, not on the argument for it.
- Arm 5: confirm `WorkflowRunPage`'s own direct `PendingAskCard` mount is byte-unchanged in
  behaviour (control positions ~1144/1144/1288.4, spine still advances).

**Expected:** All 5 arms pass, matching the built claims: the answer in either home clears the
other home's card with no manual refresh, the run line and composer release on the server's word
(or explicitly hold in the fail-closed branch), and the third home is unaffected.

**Why human:** Every existing assertion for this exact behavior is a jsdom mount over a mocked
`@/lib/api` — two `PendingAskStack` instances sharing one process, one store, one synchronous
scheduler. That models two surfaces; it cannot observe two real surfaces disagreeing after a network
round trip, which is precisely how the ORIGINAL defect (`R2-4`) was found. `244-03` shipped an
equivalent green jsdom fence over the same underlying blocker and the operator found it live
nineteen plans later — the exact precedent this row itself names.

### 2. (Carried, lower priority) `WR-02`'s two-parallel-asks race — SEED-tracked, not requirement-blocking

**Test:** Arm two parallel `ask_user` prompts on the same thread; answer both within about a second
of each other; watch for an already-answered card re-mounting in `pending` state.

**Expected:** Neither card resurrects after being answered.

**Why human:** Reasoned from code (the review calls it "PLAUSIBLE, unproven"), not reproduced; needs
a live two-request race that a single-process jsdom test cannot construct realistically.

---

## Gaps Summary

**No BLOCKER.** Four of five ROADMAP success criteria for this phase are now driven-and-closed
(SHELL-01, SHELL-02, SHELL-04's headline, SHELL-05) — a substantial, independently-confirmed
improvement over round 1's "0/5 driven" baseline. The fifth, SHELL-03, had its original blocker
fixed and driven-closed, but the browser drive that closed the first half also found a second,
distinct failure (`G-8`) inside the same success criterion. A fix for `G-8` was built in `244-15`,
reviewed with three warnings (one fixed via fast-fix, two deferred with concrete re-open triggers),
and corroborated by ten independent spot-checks against the live tree plus three adversarial
RED-drives in review — but **it has not been driven in a browser**, and this project's own history
(`244-03`, `244-12`) is that jsdom-green fences over this exact class of defect have shipped broken
before. Per `D-244-14`'s binding rule ("`BUG-260828-07` is severity HIGH and closes on a DRIVEN row,
not a fence"), SHELL-03 is correctly scored `built, drive owed`, not closed.

**G-7's gap-closure cap is SPENT (2 of 2, waved through with a worded override).** No third round is
available; per the task's explicit instruction, this report does **not** recommend
`/gsd:plan-phase 244 --gaps`. The only door is triage: drive `244-15-UAT-ROW.md` and record the
result. If it passes, SHELL-03 (and the whole phase) closes on the strength of that drive alone — no
further plan is needed. If it fails, the finding is real product behavior the operator must decide
how to handle (fast-fix under G-3, since it would be a defect in code already reviewed and mostly
correct, not a new capability).

**WARNING-level open items**, none blocking: `WR-04` (unbounded buffer before size cap, carried),
`WR-08` (transcript honesty gap in Explorer/harness turns, carried), `WR-02`/`WR-03` (deferred with
triggers, from this round's own review), nine info-level findings, `G-7`'s new attachment-robustness
gap (deferred to `SEED-272` by explicit operator ruling), and the REQUIREMENTS.md staleness (now
stale on all five rows in a new way — not reflecting either round's drives, in addition to the
sketch-note error already flagged in round 1).

**The single highest-priority action:** drive `244-15-UAT-ROW.md`'s five arms. Nothing else in this
phase is closer to done, and nothing else in this phase carries as much precedent for "a green fence
here has shipped broken twice before."

---

_Verified: 2026-09-12 (re-verification, round 2)_
_Verifier: Claude (gsd-verifier) — solo run; no independent second reviewer exists for this phase
(D-244-21, OV-SOLO-01). This re-verification re-derived ten load-bearing claims about `244-15`
directly against the live tree and git history (commands quoted above), cross-referenced
`244-REVIEW-gap-round-2.md`'s adversarial RED-drive evidence, counted the UAT-ROW files
independently rather than trusting prose, and confirms the round-1 report's preserved findings are
still accurate for the criteria round 2 did not touch._

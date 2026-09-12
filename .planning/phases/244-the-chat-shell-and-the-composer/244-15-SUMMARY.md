---
phase: 244-the-chat-shell-and-the-composer
plan: 15
subsystem: chat-shell / approvals / stream-state
tags: [SHELL-03, G-8, reconcile, workflow-lock, cross-surface-shell, gap-closure]
gap_closure: true
gap_closure_round: 2
requires:
  - "StreamsProvider's shipped mount-reconcile lock arms (244-08 / 244-13 / 244-14)"
  - "PendingAskStack's useAskUserPrompt reconcile (086-02)"
  - "subscribeProducerStream's idempotent re-attach (092-07 Facet C)"
provides:
  - "releaseSettledWorkflowLock — one fetch-based settle path that RELEASES a lock the server has already dropped"
  - "PendingAskCard.onAnswered — an optional success-only callback"
  - "PendingAskStack.settleAnswered — the ask reconcile composed with the lock release"
  - "244-15-UAT-ROW.md — five arms, UNRUN"
affects:
  - "the thread run line (data-run-line-state) and the chat composer lock"
  - "both PendingAskStack homes (panel + chat column); NOT WorkflowRunPage's direct card mount"
tech-stack:
  added: []
  patterns:
    - "D-v2.5-03 applied to the ANSWER transition: reconcile via fetch, never a second optimistic update"
    - "fail-closed release: a live anchor or cap_paused releases nothing and re-attaches instead"
    - "the store's getState().actions as the seam a provider-mocking suite can survive"
key-files:
  created:
    - frontend/src/__tests__/providers/streamsProvider_244_settle_ask.test.tsx
    - .planning/phases/244-the-chat-shell-and-the-composer/244-15-UAT-ROW.md
  modified:
    - frontend/src/stores/streamsStore.ts
    - frontend/src/providers/StreamsProvider.tsx
    - frontend/src/components/panel/PendingAskCard.tsx
    - frontend/src/components/panel/__tests__/PendingAskCard.retired.baseline.test.tsx
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
decisions:
  - "D-244-15-01: the settle RELEASES only — it is deliberately not a seventh setWorkflowLockForThread writer"
  - "D-244-15-02: the answering card now UNMOUNTS rather than resting on its green answered state; Arm 4 of the UAT row asks the operator to judge that receipt on evidence"
  - "D-244-15-03: PendingAskStack reaches the action through useStreamsStore.getState().actions, never useStreamActions() — eight suites mock the provider module with an allow-list factory"
  - "D-244-15-04: STATE.md was NOT written (worktree mode). The G-7 override entry is transcribed verbatim below and is OWED to the orchestrator."
metrics:
  tasks: 3
  commits: 3
  completed: 2026-09-12
---

# Phase 244 Plan 15: The settle that never happens Summary

**One fetch-based settle path — one GET per answered approval — makes an answer in either home clear
the other and release a workflow lock the server has already dropped, without ever setting one.**

⛔ **`SHELL-03` DOES NOT CLOSE HERE. `G-8` reports BUILT, DRIVE OWED.** `D-244-14` binds:
*"`BUG-260828-07` is severity HIGH and closes on a DRIVEN row, not a fence."* Every assertion in
this plan is a **jsdom mount over a mocked API**, and the plan's own fence file says so in its
header. **`244-15-UAT-ROW.md` is written and UNRUN.**

⚠ **This is a SELF-VERIFICATION, not a review** (`D-244-21` / `OV-SOLO-01`). Gemini is unavailable,
so nobody independent stands behind any claim below. Driving the UAT row is the first genuinely
independent check this change receives.

---

## What was built

| | |
|---|---|
| The **ask** half | `PendingAskStack.settleAnswered` calls the `reconcile()` it **already held** → one GET → `replacePendingAsksForThread` → **ONE** shared store key → **both** homes drop the card. **No new fetch code was written for the asks.** |
| The **lock** half | `releaseSettledWorkflowLock(threadId)` issues one `getThreadWorkflow` read and RELEASES a lock the server has already dropped. ⛔ It never SETS one. |
| **Fail-closed** | A live anchor (`locked && !lock_is_stale && active_workflow_run_id`) **or** `cap_paused` releases **nothing**, and re-attaches `latest_producer_run_id` through the shipped arm instead — so the SHIPPED terminal handler stays the only thing that ends a lock's life. |
| **The third home** | `WorkflowRunPage` mounts `PendingAskCard` **directly**; the callback is optional and it does not pass it. Behaviourally byte-unchanged, asserted **by API call count**. |

---

## The RED evidence (a fence nobody has seen fire is not a fence)

### Task 1 — Tests 1-8, driven against the unmodified provider

```
 Test Files  1 failed (1)
      Tests  8 failed (8)
```

Per-case, verbatim from the run:

| case | RED output |
|---|---|
| 1 | `AssertionError: expected 'undefined' to be 'function'` |
| 2 | `TypeError: result.current.releaseSettledWorkflowLock is not a function` |
| 3 | `TypeError: result.current.releaseSettledWorkflowLock is not a function` |
| 4 | `TypeError: result.current.releaseSettledWorkflowLock is not a function` |
| 5 | `TypeError: result.current.releaseSettledWorkflowLock is not a function` |
| 6 | `expected [Function] to not throw an error but 'TypeError: result.current.releaseSett…' was thrown` |
| 7 | `TypeError: result.current.releaseSettledWorkflowLock is not a function` |
| 8 | `the settle action was not found in the provider source — this fence is pointing at nothing and must be re-aimed rather than left silently matching zero: expected -1 to be greater than -1` |

After the action landed: **8 passed (8)**.

### Task 2 — Tests 9-12, driven with the wiring absent

```
 Test Files  1 failed (1)
      Tests  2 failed | 10 passed (12)
```

⭐ **THE ASYMMETRY IS THE MEASURED DEFECT REPRODUCED IN JSDOM, and it is the most useful thing in
this document.** With `onAnswered` absent, the **answering** home went green — the rendered DOM
showed

```html
<p aria-live="polite" class="text-[13px] text-foreground">
  You answered <b class="font-semibold text-[hsl(var(--success))]">Do not run it</b>
</p>
```

— while the **sibling** home was still rendering, in the same tree, at the same moment:

```html
<button aria-disabled="true" disabled type="button"> Send Answer </button>
```

Test 9's failure message names it: *"the sibling home still offers an answer to a prompt the server
has already settled"*. Test 10 (the reverse direction) failed identically. **Tests 11 and 12 passed
before AND after** — they are controls over behaviour that must NOT change (a refused answer settles
nothing; the third home fires neither reconcile), and that is stated rather than presented as
coverage.

After the wiring landed: **12 passed (12)**.

### The card baseline fence — RED at the plan's BASE, before any edit

```
AssertionError: expected 766 to be 737
 Test Files  1 failed (1)
      Tests  1 failed | 8 passed (9)
```

⚠ **It had been red since `d58fa43a0` and NOBODY COULD HAVE KNOWN**, because it was in **neither**
count-gate knob — the gate never ran it and nothing guarded the three shipped retirement sentences
it reads out of source. Thirteenth suite found in this state; `SEED-229` carries the structural fix.
Pin superseded in place `737 → 837` (chain `487 → 630 → 650 → 737 → 837` kept visible), then adopted
into **both** knobs — **only because all nine cases are green**. Adopting a red suite turns the
shared gate red.

---

## The no-seventh-writer measurement

| | before | after |
|---|---|---|
| `grep -c "setWorkflowLockForThread(" frontend/src/providers/StreamsProvider.tsx` | **5** | **5** |
| `grep -c "useState[(<]" frontend/src/components/panel/PendingAskCard.tsx` | **9** | **9** |
| `setInterval` / `setTimeout` in the new action body | — | **0** |

`workflowLockWriters.lockstep.test.ts` is **byte-untouched** and green (5/5, run alongside the new
fence). Test 8 sweeps the brace-matched action body on **comment-stripped** source — necessary,
because the action's own docblock names `setWorkflowLockForThread` in order to forbid it, and an
unstripped sweep would fail for the wrong reason (the `244-12` failure this phase repaired one file
over, IN-02).

---

## The four gate verdict lines, verbatim

**1. `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (repo root)**

```
  total 8266  ·  failed 0  ·  pinned total 7476
count gate OK — 277/277 pinned files present, no per-file decrease, 0 failing.
```

⚠ **THE FIRST RUN OF THIS GATE READ `failed 3`, AND THE FILENAMES WERE CAPTURED FROM THE GATE'S OWN
PERSISTED JSON BEFORE ANYTHING WAS RE-RUN** — the cap was never touched, per SEED-171's refuted
causal claim:

| file | failing cases | checked against `git diff --numstat 8a27ab7f8 HEAD` |
|---|---|---|
| `frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx` | 1 (`canvas door — flag ON …`) | **empty — provably unmodified**. One of SEED-171's five named suites. |
| `frontend/src/components/library/__tests__/sketchComposition.test.tsx` | 2 (both §2 **positive controls**) | **empty — provably unmodified**. ⚠ **NOT one of SEED-171's five.** |

Run in isolation immediately afterwards, both were green: **200 passed | 1 skipped (201)**. The
second full-gate run on the byte-identical tree read `failed 0` with **identical totals** (`8266 /
7476` both times, so nothing about the counts moved between runs). **Say "provably unmodified",
never "fine" — one green sample of a flaky suite proves nothing.**

⭐ **NEW EVIDENCE FOR SEED-171, recorded rather than absorbed:** `sketchComposition.test.tsx` is a
**sixth** suite exhibiting the signature, it is in a directory none of the other five share
(`src/components/library/__tests__`), and **the cases that failed were its own POSITIVE CONTROLS**
(*"the page renders its heading — the mount harness works"*, *"the four shipped tab triggers
render"*) — the same shape as `196-05`'s fifth entry. That is a finding for the seed; it is out of
this plan's scope to fold in.

⚠ **ONE MORE OBSERVATION, NOT ACTED ON.** The gate printed five UNPINNED suites (`— N new`):
`PromptVariableChips` (3), `RunHero` (18), `automationFacts` (11), `nodeEffectBanner` (8),
`toolReadOnlyMap` (7). They RUN and guard nothing. Not adopted — out of this closure round's scope
(`SEED-222` territory), and named here rather than left silent.

⚠ **CLAUDE.md's published count-gate figures have rotted a SEVENTH time and this plan did NOT add a
correction section, deliberately.** That file's latest correction (2026-09-07) reads `7816 · 7020 ·
241/241`; measured here, five days later: **`8266 · 7476 · 277/277`**. The trajectory is published
here so the next re-derivation has a dated anchor, but adding a seventh block to a CLAUDE.md
correction chain is not a gap-closure round's job.

**2. `node scripts/check-hot-file-ledger.cjs 244`**

```
hot-file ledger — .planning/phases/244-the-chat-shell-and-the-composer
  scan list: 268 rows · subject: 66 files · watched: 30
ledger gate OK — every watched file has a row.
```

⭐ **`subject: 66 · watched: 30` — EXACTLY the figures the plan measured at planning time on the LF
original.** Phase 242 measured this gate passing **vacuously** over a CRLF plan file (0 parsed
files, exit 0), so the exit code alone would not have been evidence. It parsed the full set.

**3. `node scripts/check-claude-md-size.cjs`**

```
  CLAUDE.md                                   97876 chars   65.3% of limit  headroom   52124  [OK]
claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.
```

**4. `cd frontend && npx tsc -p tsconfig.app.json --noEmit`** — ⛔ **NOT** `npx tsc --noEmit`, which
type-checks zero files.

```
base (8a27ab7f8): 67 errors
after  (0cd3a0bd6): 67 errors
set diff (positions normalised): IDENTICAL — zero NEW errors
```

The only apparent difference was `streamsStore.ts(423,55)` → `(439,55)`: the **same** pre-existing
`TS2345` zustand `StateCreator` error, shifted by the lines this plan added. *"Zero errors" is not a
reachable criterion here and was not written as one.*

**5. `node scripts/check-gap-closure-rounds.cjs 244 --unmet-criterion "…"`**

```
    => rounds completed: 2 (cap is 2)
[round-cap] OVERRIDDEN — 2 rounds completed, but an unmet success criterion was named
G-7 passed WITH OVERRIDES — [round-cap] waved through by an explicit reason, not by absence of a finding.
```

⭐ **The `[new-capability-in-closure]` arm stayed CLEAR on its own merits** — it did not fire, and no
`--capability-approved` was used. This plan added no control, no route, no screen and no new
user-facing string; every source file it touched existed long before it.

---

## Re-derived ledger triples (same-commit sync, both registers)

| file | row said | **measured** | note |
|---|---|---|---|
| `frontend/src/providers/StreamsProvider.tsx` | `100 / 37 / 4727` | **`101 / 37 / 4815`** | STALE an **8th** consecutive time |
| `frontend/src/stores/streamsStore.ts` | `20 / 13 / 525` | **`21 / 13 / 546`** | ⚠ stale **one plan after `244-13` created the row** |
| `frontend/src/components/panel/PendingAskCard.tsx` | `14 / 7 / 765` | **`15 / 8 / 836`** | ⚠ the **PHASE** count moved, 7 → 8 |
| `scripts/vitest-count-gate.cjs` | `167/38/4786` (CLAUDE.md) · `171/41/4850` (scan list) | **`211 / 46 / 5618`** | ⚠ **two registers disagreed with each other and BOTH were wrong**, by up to 44 commits / 8 phases |

Every row's CLAUDE.md cell (verdict only, ≤ 200 chars), its scan-list row in
`docs/HOT-FILE-LEDGER.md`, and its `— 244-15` detail section were updated **in the same commit** as
the source change.

---

## Decisions made

**D-244-15-01 — the settle RELEASES only.** Not a seventh `setWorkflowLockForThread` derivation. The
source comment says so explicitly and names the re-open hazard (`G-1`), so a later editor who adds a
set call is made to see what they are doing. Fenced by Test 8 and by the unchanged `grep -c` of 5.

**D-244-15-02 — the answering card now UNMOUNTS instead of resting on green.** Ruled on up front
rather than discovered in triage. It is **not a regression invented here**: it is the SHIPPED
behaviour of the `ask_user_response` SSE path (`PendingAskCard.tsx:22` — *"the SSE then removes the
prompt from the store, reactively clearing the card"*), extended to the workflow path that never
receives that SSE. ⚠ **Arm 4 of `244-15-UAT-ROW.md` READS what the answering home shows afterwards,
verbatim, so the operator judges the receipt on evidence rather than on this argument.**

**D-244-15-03 — the stack reaches the store, not the provider hook.** Measured, not stylistic: eight
suites mock `@/providers/StreamsProvider` with an ALLOW-LIST factory and render this stack (directly
or through `WorkspacePanel` / `MessageList`). A provider-hook import would make every one of them
throw on an omitted export. The store module is not mocked in those suites and its no-op default is
the right behaviour for a stack with no provider. The comment in the source says all of this so
nobody "tidies" it later.

---

## Deviations from Plan

**1. [Orchestrator directive] `.planning/STATE.md` was NOT modified.**

- **Found during:** Task 3(d).
- **Issue:** The plan lists `.planning/STATE.md` in `files_modified` and Task 3(d) asks for the G-7
  override entry. The executor's own brief says, twice and explicitly: *"Do NOT update STATE.md or
  ROADMAP.md — the orchestrator owns those writes after all worktree agents in the wave complete."*
  Worktree mode also auto-skips shared-file updates.
- **Resolution:** The orchestrator's directive wins — STATE.md is a shared file and a worktree write
  would conflict. **The entry is transcribed verbatim below and is OWED.**

```markdown
### Guardrail overrides

- **G-7 (gap-closure round cap) — Phase 244, round 2 → plan `244-15`.**
  `node scripts/check-gap-closure-rounds.cjs 244` read `rounds completed: 2 (cap is 2)` and printed
  `G-7 fires`. Waved through on the gate's own **worded** escape hatch, with the criterion:
  *"SC#3: an approval answered in one home does not settle it in the other, and the run line +
  composer keep a lock the server has already dropped."*
  Verdict: **`G-7 passed WITH OVERRIDES`** — never `clear`.
  Rests on the operator's recorded ruling at the close of round 2 (`244-UAT.md` § *Operator
  rulings — 2026-09-12*). The `[new-capability-in-closure]` arm stayed clear on its own merits.
  ⛔ **This is the last round available** — a third needs the operator, not a flag.
```

**2. [Rule 3 — blocking] Unused imports were removed from the fence file before the Task 1 commit.**

- **Found during:** Task 1's typecheck.
- **Issue:** The fence file was authored with Task 2's imports (`render`, `screen`, `userEvent`,
  `PendingAskStack`, `PendingAskCard`, the `ASK` fixture) already present, which produced **5 new
  `TS6133` / `TS6192` errors** — a real new-error set against the base.
- **Fix:** They were removed for the Task 1 commit and re-added in Task 2, where they are used. Both
  commits therefore carry **zero new** typecheck errors rather than one carrying five.

---

## Known Stubs

None. No hardcoded empty value, placeholder string or unwired data source was introduced. The UAT
row's `pending` fields are **deliberate unrun-verdict placeholders**, which is that document's
established shape (`244-12-UAT-ROW.md`).

---

## Threat Flags

None. No new network endpoint, auth path, file-access pattern or schema change at a trust boundary.
The two GETs the settle issues are owner-scoped server-side and were already reachable; the client
adds no new parameter and reaches no new route (`T-244-15-03`, disposition `accept`).

`T-244-15-01` (Elevation of Privilege — unlocking the composer during a live harness run) is
**mitigated by construction** and driven by Tests 3, 4 and 5, which assert **object identity**
(`toBe`, not `toEqual`) so a path that cleared and rewrote an equal lock still fails.
⚠ **The honest limit:** those are jsdom fences. Arm 3 of the UAT row carries
`wire_reported_live_at_settle` as an explicit **field** precisely because a green browser run that
never entered the fail-closed branch has said nothing about it.

---

## Commits

| | |
|---|---|
| `c1dca467a` | `feat(244-15): the settle path — one authoritative read that RELEASES only` |
| `c31420d2d` | `feat(244-15): one answer, both homes — and a red ungated baseline repaired` |
| `0cd3a0bd6` | `docs(244-15): the browser row, the ledger, and the gates` |

No commit deleted a tracked file (`git diff --diff-filter=D HEAD~1 HEAD` empty on all three).

---

## Status

⛔ **`G-8` — BUILT, DRIVE OWED. `SHELL-03` does not close here.**
⛔ **`G-7` (attachment hydration) remains deferred to `SEED-272`** — untouched, per the scope fence.
⚠ **Self-verified, not reviewed** (`D-244-21`).

**Next action:** drive `244-15-UAT-ROW.md` in a real browser. Start with **Arm 1** (thread → panel),
and hold the operator-safety rule: the fixture step is outward-facing and irreversible — settle with
**"Do not run it" + Send Answer**, never *"Approve this step"*.

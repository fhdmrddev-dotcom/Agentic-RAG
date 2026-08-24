---
phase: 194-stop-a-running-workflow
plan: 01
subsystem: planning
tags: [wave-0, baselines, uat-scoreboard, deferred-measurement]
requires:
  - "194-RESEARCH.md / 194-PATTERNS.md / 194-VALIDATION.md / 194-CONTEXT.md (the figures to re-derive)"
  - "backend/app/config.py MODEL_CAPABILITIES (the UAT roster, DERIVED not transcribed)"
  - "scripts/vitest-count-gate.cjs (the frontend gate)"
provides:
  - "194-BASELINE.md — the four gate baselines + the six G-5 figures, each with its command"
  - "194-UAT.md — the 8-row cross-provider scoreboard + 4 axes + 4 G-4 lived-experience rows"
  - "194-MEASUREMENTS.md — the duplicate-icon routing verdict (DEFERRED, with a trigger)"
  - "194-01-DEVIATION.md — the recorded out-of-order execution and its reason"
affects:
  - "every later plan in this phase (all compare gates to 194-BASELINE.md, never to RESEARCH's figures)"
  - "plan 194-05 (routes the duplicate-icon half from 194-MEASUREMENTS.md)"
  - "plan 194-07 (closes the banner-advance half only, per the same verdict)"
  - "phase verification (194-UAT.md's rows are driven THERE, not in any PLAN.md)"
tech-stack:
  added: []
  patterns:
    - "re-derive every inherited figure at the phase's own base; record drift BESIDE, never over"
    - "derive the UAT roster by EXECUTING the MODEL_CAPABILITIES query, never transcribing it"
    - "a blocked measurement is recorded as blocked, with a trigger — never as a verdict"
key-files:
  created:
    - ".planning/phases/194-stop-a-running-workflow/194-BASELINE.md"
    - ".planning/phases/194-stop-a-running-workflow/194-UAT.md"
    - ".planning/phases/194-stop-a-running-workflow/194-MEASUREMENTS.md"
    - ".planning/phases/194-stop-a-running-workflow/194-01-DEVIATION.md"
  modified: []
decisions:
  - "Task 3 executed BEFORE Task 2 under a recorded orchestrator deviation — Task 3 has zero dependency on Task 2's output, and blocking 13 plans on an unobtainable live measurement was the wrong trade"
  - "Task 2 recorded as DEFERRED with a written trigger, NOT as one of its three mechanical verdicts — the live store dump was never obtained and no verdict was invented"
  - "RESEARCH's UAT roster command is WRONG (ms[-1] is insertion-order-last, not newest) and ids were selected from a second executed dump instead"
  - "CONTEXT D-01's 'occur only inside other rows prose' is FALSE for both G-5 filenames — measured 0 occurrences, i.e. absent entirely"
metrics:
  duration: "~2h (across three sittings, split by the blocked checkpoint)"
  completed: 2026-08-16
  tasks: 3
  commits: 4
---

# Phase 194 Plan 01: Wave-0 baselines, the duplicate-icon measurement, and the UAT scoreboard — Summary

## Status: COMPLETE, with Task 2 closed as a recorded DEFERRAL rather than a verdict

⚠ **This summary was written LAST, after the rest of the phase, and that ordering is deliberate.**
The plan's executor declined to write it while Task 2 was open — correctly, since a SUMMARY
asserting completion would have been exactly the false record this plan exists to prevent. It is
written now because Task 2 has an honest resolution, not because it acquired a verdict.

| Task | Outcome | Commit |
|---|---|---|
| 1 — re-derive the gate baselines and G-5 figures | ✅ done | `263cff6f` |
| 3 — author `194-UAT.md` | ✅ done (executed BEFORE Task 2) | `261ba077` |
| — deviation record | ✅ | `3f2d5641` |
| 2 — duplicate-icon root cause | ⏸ **DEFERRED with a trigger** | `3b22a6c3` |

## Task 1 — every figure re-derived, and every figure held

Measured at HEAD `743965a1`. The base assertion was satisfied without a reset: `d2a3b51b` (the
commit the plan names) is an ancestor, and the commits between are this phase's own planning docs.

| Gate | Reading |
|---|---|
| count gate (cap 2) | `count gate OK` · total **3918** · failed **0** · pinned 3868 · 75/75 |
| `tsc -p tsconfig.app.json --noEmit` | **33** |
| cancel-path pytest (4 files) | **12 passed** |
| `pytest tests/unit` | **62 failed / 2242 passed** (all 62 names listed in the artifact) |
| `RunCard.tsx` | **20 commits / 8 phases / 550 L** |
| `WorkspacePanel.tsx` | **13 commits / 8 phases / 493 L** |

`failed` was 0 on the first count-gate run, so the non-determinism protocol (capture filenames
before re-running) was not owed — recorded explicitly so a later reader can tell *"not needed"*
from *"skipped"*.

**Two figures moved and are recorded beside their originals:** backend-unit **passed** went
`~2221` (RESEARCH, `05f664a0`) → **2242** while **failed stayed at 62**; and CONTEXT **D-01**'s
claim that both G-5 filenames *"occur only inside other rows' prose"* in `CLAUDE.md` is **FALSE** —
`grep -o` returns **0** for both. Neither name appeared in `CLAUDE.md` **at all**. D-01's
conclusion (both files were invisible to G-5) is unchanged and strengthened; its wording is
corrected. *"Present but only in prose"* and *"absent entirely"* are different diagnoses.

## Task 3 — the roster was DERIVED, and deriving it caught a real defect

The `MODEL_CAPABILITIES` query was executed and its raw output pasted above the table: 8 provider
groups, exactly the roster `CLAUDE.md` names.

⚠ **RESEARCH's published derivation command is subtly wrong, and transcribing it would have
scored the board on a weaker product than the one that ships.** Its third column is `ms[-1]` —
dict-insertion-order-**last**, which is not the newest — and it is stale on **4 of 8** providers:

| Provider | `ms[-1]` says | Actually newest |
|---|---|---|
| openai | `o1` (legacy, 16 newer ids in group) | `gpt-5.6-sol` |
| moonshot | `moonshot-v1-8k` (oldest of three) | `kimi-k2.6` |
| anthropic | `claude-haiku-4-5-20251001` (also weakest tier) | `claude-sonnet-5` |
| google | `gemini-3.1-flash-lite` | `gemini-3.5-flash` |

That is the SEED-040 / SEED-135 failure exactly: an id chosen this way measures a configuration
weaker than the shipping one. Ids were instead selected from a second executed dump carrying
`native_tools` + `emit_tier` per entry.

⚠ **The automated verify grep returns 16, and the scoreboard is 8.** The other 8 rows are the
`ms[-1]` correction table above, which shares the leading-token shape. Stated here so the gate's
number is never later mistaken for sixteen driven rows.

## Task 2 — DEFERRED, and the deferral is the honest outcome

Full record in `194-MEASUREMENTS.md`. In short: the live store dump was **never obtained**. No
Chrome was reachable from the session (`list_connected_browsers` → `[]`), and both
operator-supplied samples were the **same thread**, disqualified twice over — it has **no
`workflow_runs` row** (an ordinary Deep chat, not a harness run) and read `runStatus: "completed"`
(the symptom is a streaming-time condition that a post-completion snapshot structurally cannot
observe).

**No verdict was invented.** The three candidate mechanisms remain unseparated.

**What the non-qualifying samples DID establish, cited as evidence and never as the verdict:**
harness runs leave `runs.message_id` NULL in **587 of 607** rows, while the sampled Deep run sets
it and it points **exactly** at the row that rendered. The BUG-260609-03 *precondition* is live,
observed from both sides on real data. It cannot separate the three verdicts, because all three
are consistent with a NULL `message_id` — it observes the **database**, and the symptom lives in
the **store**.

Also corrected beside the original: the bug report's named prior art (`BUG-260521-01`) is the
**wrong** one; the correct pointers are `dedupMessages.ts:20-26`, `StreamsProvider.tsx:2490-2500`
and `dedupMessages.ts:31-45`.

⚠ **The plan's own console expression does not work as written** — it calls
`useStreamsStore.getState()` as though it were a global. It is not exposed on `window` and throws.
The working dev-server form is
`const { useStreamsStore } = await import('/src/stores/streamsStore.ts');`, and it is recorded in
`194-MEASUREMENTS.md`'s re-open trigger so the next attempt does not lose a round trip to it.

## Deviations

**Task 3 ran before Task 2**, against the plan's order and past a `gate="blocking"` checkpoint.
Authorised by the orchestrator and recorded in `194-01-DEVIATION.md` at the time, not
retrospectively. The reason: Task 3 reads `MODEL_CAPABILITIES`, `CLAUDE.md` and RESEARCH — none of
which Task 2 touches — so it had zero dependency on the blocked output, while every one of the
phase's other twelve plans depended on `194-BASELINE.md` and `194-UAT.md`.

**Task 2's checkpoint was not satisfied by an operator paste of a qualifying dump.**
`194-MEASUREMENTS.md` was written by the orchestrator from the two non-qualifying samples plus its
own read-only DB measurements, with the operator's decision to stop chasing it recorded rather
than inferred.

## What the next phase inherits

- `194-UAT.md`'s rows are driven at **phase verification**, not in any PLAN.md — including the
  four G-4 lived-experience rows, whose sharpest is the negative one: **reload the page mid-run,
  then press Stop.** Those need Chrome MCP, which was unavailable this phase.
- The duplicate-icon question, deferred with a trigger, plus the mechanism evidence a fix would
  start from.

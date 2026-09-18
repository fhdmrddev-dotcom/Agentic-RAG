---
seed_id: SEED-287
title: The count gate's TARGETS names individual files in some directories and whole directories in others, so a newly-written suite runs nowhere until somebody remembers to name it — and nothing says when that happened
created: 2026-09-16
planted_during: Phase 252 (gap closure for the v4.2 milestone audit) — surfaced while closing B-4, which shipped three defects in a component that had no test file AND no way to be run if one existed
status: planted
partial: false
status_note: |
  Planted at 252's close rather than folded into it. 252 adopted exactly ONE file
  (`WatchRowCard.test.tsx`) into both knobs and DECLINED the directory entry, because adding
  `src/components/sources` as a directory would adopt ~10 unpinned suites in a single edit —
  including `sourceComposition.test.tsx`, which is deliberately red by a Phase 235 decision and
  would turn the shared gate red for every other phase. That decline is recorded in
  `252-CONTEXT.md` and in `252-05-SUMMARY.md`; this seed is the obligation it creates.
priority: medium
surface: Agentic-RAG
severity: major
folded_into: null
relates_to:
  - SEED-280 — *Five suites run by the count gate and guarded by nothing*. ⚠ THE INVERSE OF THIS
    ONE, and they are two halves of one defect: SEED-280 is TARGETS-without-BASELINE (runs,
    unguarded); this is neither-knob (does not run, cannot be guarded). 252 added a sixth and a
    seventh case to SEED-280.
  - `scripts/vitest-count-gate.cjs` — TARGETS (what RUNS) and BASELINE (what is GUARDED)
  - `frontend/src/components/sources/WatchRowCard.tsx` — the measured instance
  - `frontend/src/components/sources/bug260912AppCredentials.test.ts` — a second live instance,
    named in the gate's own TARGETS comment at 252-05 and left unadopted
  - `.planning/phases/252-close-the-v42-audit-gaps/252-05-SUMMARY.md` — the decline, with its reason
trigger_when: >
  ANY of these becomes true:
  (1) a phase's files_modified names a source file under a directory whose TARGETS coverage is a
      list of individual files rather than a directory entry — the new suite will not run and the
      phase will not be told;
  (2) `sourceComposition.test.tsx`'s Phase 235 red-by-decision status is resolved, which removes the
      single blocker to adopting `src/components/sources` as a directory;
  (3) SEED-280 is picked up — the two are one piece of work and sequencing them apart pays the
      analysis twice;
  (4) a count-gate change adds a knob, a mode, or a third list.
trigger_paths:
  - "**/vitest-count-gate.cjs"
  - "frontend/src/components/sources/**"
trigger_surfaces:
  - testing
  - frontend
---

# SEED-287: TARGETS names files in some places and directories in others

## The finding

`scripts/vitest-count-gate.cjs` has two independent knobs, and this is the sentence that matters:

> **TARGETS decides what RUNS. BASELINE decides what is GUARDED. A file can be on the wrong side of
> exactly one of them — or, as measured here, of both.**

TARGETS is **not uniform**. For `src/components/panel/__tests__/` it carries a directory entry and
recurses. For `src/components/sources` it carries **ten individually-named files**. Nothing in the
file says which convention applies where, and nothing detects the difference.

**Measured at Phase 252 (2026-09-16):**

- `frontend/src/components/sources/WatchRowCard.tsx` had **no test file at all**, and had none for
  its whole life.
- Because `src/components/sources` is a file list, a suite written for it would have **run nowhere**
  until somebody edited TARGETS by hand.
- The component carried **three shipped defects** — `WATCH-04`'s completion claim from a string
  literal, a `(0 changes)` count that rendered identically for 0 and for 500, and a refusal and a
  success rendering **simultaneously on one card**.
- The evidence its phase offered for that surface was a test named *"does NOT unmount or collapse
  the card"*. ⭐ **The recorded lesson was *presence assertions cannot see content drift*. The
  stronger finding is that there was no suite for that assertion to be weak in.**

A second live instance was found at the same close and deliberately left:
`frontend/src/components/sources/bug260912AppCredentials.test.ts` is in **neither knob**. Phase
252-03 moved an occurrence pin inside it from 4 to 5 **while the gate could not see the file at
all** — so a pin was maintained by hand, for a suite nothing runs.

## Why it matters

A green count gate is read by every phase as *"the frontend is fine"*. It cannot say anything at all
about a file in neither knob, at any grand total — and **the verdict line looks identical either
way**. That is worse than an absent gate, because an absent gate is not quoted as evidence.

The class has now fired repeatedly and been recorded each time rather than closed:

| Where | Count |
|---|---|
| SEED-280 (2026-08-31) | five suites TARGETS-but-not-BASELINE |
| Phase 214 | `WorkflowScheduleModal.test.tsx` believed in neither, measured running and unguarded |
| Phase 250 | `WorkspacePanel.derived.test.tsx` red in neither knob, caught by running the directory by hand |
| Phase 252 | `WatchRowCard` neither-knob with no suite; `bug260912AppCredentials.test.ts` neither-knob with a hand-maintained pin |

⚠ And SEED-280's own five were re-measured at 252's close: **counts identical to its 2026-08-31
table** — `PromptVariableChips 3 · RunHero 18 · automationFacts 11 · nodeEffectBanner 8 ·
toolReadOnlyMap 7`. **Sixteen days, zero drift, zero action.** A seed that names instances does not
close the class.

## The reading

**The instances keep being fixed one at a time because the gate cannot report on its own coverage.**
Every case above was found by a person running a directory by hand, or by a phase happening to touch
the file. That is not a detection mechanism; it is luck with a good record-keeping habit attached.

The durable move is the one Phase 252 made for the *schema* ACL class and did **not** make here: a
gate that fails when a suite is not in both knobs is strictly stronger than a list of instances,
and it is the same shape as `scripts/check-schema-acl-parity.cjs` — derive the real set, derive the
declared set, name the difference.

⛔ **And it must be driven RED**, for the reason this repo has now measured three times: Phase 242
found `check-hot-file-ledger.cjs` exiting `0` over **zero parsed files**, Phase 250 shipped a suite
red in neither knob, and Phase 252's W-7 found a pin carrying **one unit of permanent slack since
Phase 221** — a deleted test case would have kept the gate green, proven by deleting one and
watching the comparison print `8 8 0`.

## What it would take

1. A coverage check inside `vitest-count-gate.cjs` (or beside it): walk `frontend/src` for
   `*.test.ts(x)`, resolve TARGETS' file-and-directory entries to the set it actually runs, and fail
   naming every suite in neither knob. Driven RED against a planted orphan, plus the counterfactual
   — a covered suite must be **absent** from the output.
2. Decide the `src/components/sources` directory entry, which needs
   `sourceComposition.test.tsx`'s Phase 235 red-by-decision resolved first. ⛔ Adopting the directory
   while that suite is red turns the shared gate red for every other phase.
3. Sequence with **SEED-280** — same analysis, opposite half. Doing them apart pays for it twice.

⚠ **Adoption raises the grand total, and that is the desirable direction.** The gate's contract is
*no per-file DECREASE* and *zero failing*, never a fixed total. A phase that reads a bigger number
than a document quotes has read the correct current one.

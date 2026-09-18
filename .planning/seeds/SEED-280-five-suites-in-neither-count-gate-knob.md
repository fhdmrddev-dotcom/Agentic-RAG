---
seed_id: SEED-280
title: Five suites run by the count gate and guarded by nothing
status: planted
status_note: |
  ── 2026-09-16 · reviewed at `/gsd:discuss-phase 252`, LEFT PLANTED — AND GIVEN A SIXTH CASE THAT IS
  WORSE THAN THE FIVE (REG-02 sweep). Measured while scoping 252:
  `frontend/src/components/sources/WatchRowCard.tsx` had NO TEST FILE AT ALL, and
  `src/components/sources` is NOT a TARGETS directory entry — TARGETS names ten individual files
  under it. So the component is in NEITHER knob, which is strictly worse than this seed's five
  (run-but-unguarded): it could not be run and could not be guarded, at any total. It shipped three
  defects under that blindness — B-4's completion claim, the `(0 changes)` literal and the
  refusal/success contradiction — all closed by 252-03, whose new suite 252-05 adopts into BOTH knobs.
  ⛔ 252 deliberately does NOT add the `src/components/sources` directory entry: that would adopt
  ~10 unpinned suites in one edit and move the shared gate for reasons unrelated to the phase.
  ⭐ TARGETS decides what RUNS; BASELINE decides what is GUARDED, and a file can be on the wrong side
  of exactly one — or, as here, of both.

  ── 2026-09-16 · 252-05 CLOSED THE SIXTH CASE AND **STAYS PLANTED**, because the original five are
  measured UNCHANGED. `WatchRowCard.test.tsx` went into BOTH knobs at 9 (commit `97174227b`), so the
  sixth case above is answered. ⛔ The five are NOT. This plan's own pre-edit gate run printed them,
  verbatim, still in the `new` column and therefore still guarded by nothing:
  `PromptVariableChips.test.tsx — 3 new` · `RunHero.test.tsx — 18 new` · `automationFacts.test.ts —
  11 new` · `nodeEffectBanner.test.ts — 8 new` · `toolReadOnlyMap.test.ts — 7 new`.
  ⭐ **Every count is IDENTICAL to this seed's 2026-08-31 table, sixteen days later** — so the seed
  has neither drifted nor decayed; it has simply not been acted on.
  ⚠ **AND A SEVENTH CASE, found by this plan and worse than the five:**
  `frontend/src/components/sources/bug260912AppCredentials.test.ts` is in **neither** knob, and
  252-03 moved its occurrence pin `4 → 5` while the gate could not see the file at all. Not adopted
  by 252-05, which was authorised for exactly one adoption — named in the gate's own TARGETS comment
  so the omission reads as a decision.
  ⛔ A `src/components/sources` directory entry remains DECLINED (it would adopt ~10 unpinned suites,
  one of them the deliberately-red `sourceComposition.test.tsx`) — that is owed a seed of its own.
surface: Agentic-RAG
relates_to:
  - scripts/vitest-count-gate.cjs
trigger_when: "The next phase that edits vitest-count-gate.cjs, or the next time a suite is found red-and-unseen."
trigger_paths:
  - "**/vitest-count-gate.cjs"
planted: 2026-08-31
renumbered_from: SEED-229
renumbered_because: >
  D-07/D-20: the OLDEST seed keeps the id, by the `created`-else-`planted` date. This file reads
  `planted: 2026-08-31`; `SEED-229-does-the-golden-run-hang-on-an-armed-approval-checkpoint.md`
  reads `planted: 2026-08-28` and is 3 days older, so it keeps id 229 and this seed moved to 280.
  ⚠ The FRONTMATTER date is authoritative: git records this file as ADDED 2026-09-01 00:40:34
  +0400, a day after its own `planted:` line, and that disagreement does not flip the verdict. ⛔
  Not chosen by reference weight — D-07 rejects that rule by name, and every live
  `scripts/vitest-count-gate.cjs` reference to `SEED-229` means THIS seed.
---

## The measured list

Read from the gate's own printed `— N new` column on 2026-08-31, at Phase 221-01's close:

| suite | cases | knob |
|---|---|---|
| `PromptVariableChips.test.tsx` | 3 | TARGETS only |
| `RunHero.test.tsx` | 18 | TARGETS only |
| `automationFacts.test.ts` | 11 | TARGETS only |
| `nodeEffectBanner.test.ts` | 8 | TARGETS only |
| `toolReadOnlyMap.test.ts` | 7 | TARGETS only |

The gate RUNS all five and guards none. Each could fall to one case and the gate would still
report `count gate OK`.

## Why this keeps happening

**TARGETS decides what RUNS; BASELINE decides what is GUARDED, and a suite can sit on the wrong
side of exactly one of them.** A suite covered by a *directory* TARGETS entry is executed the
moment it is created and pinned only if somebody types its basename.

This is the operator's open item #8, and the count is now **eleven** suites found in this state
inside one week: three chat suites on 2026-08-31 (`ToolApproval`, `MessageInput.connectors`,
`MessageInputDrafts` — the last RED for hours unseen), `ConnectionFormPanel.oauth.test.tsx` at
221-01, plus these five. Phase 214-15 recorded six more.

⚠ **AND A PIN CAN BE PRESENT AND USELESS.** `connectionMark.test.tsx` was pinned at **39
against an actual 74** — it could have lost half its assertions with the gate green. A stale
floor is not a weaker guard; below the floor it is *no* guard.

## The shape of the fix

A gate self-check rather than another manual sweep: fail when a file the gate EXECUTED has no
BASELINE key, and warn when a pin sits more than N below its actual. Both are derivable from
the JSON report the gate already writes.

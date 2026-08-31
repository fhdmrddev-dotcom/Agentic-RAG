---
id: SEED-229
title: Five suites run by the count gate and guarded by nothing
status: planted
surface: Agentic-RAG
relates_to:
  - scripts/vitest-count-gate.cjs
trigger_when: "The next phase that edits vitest-count-gate.cjs, or the next time a suite is found red-and-unseen."
planted: 2026-08-31
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

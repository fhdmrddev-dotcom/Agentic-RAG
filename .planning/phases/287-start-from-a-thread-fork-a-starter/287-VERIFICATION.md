---
phase: 287-start-from-a-thread-fork-a-starter
verified: 2026-10-19
verification_mode: self-verified   # OV-SOLO-01 - NEVER "reviewed". No independent reviewer exists.
status: human_needed
score: 5/5 success criteria met in code; 3 rest partly on owed or operator-ruled evidence
re_verification: false
gaps: []
human_verification:
  - test: "SC#4 'one click' ruling: shipped flow is card menu 'Make my own copy' then a name dialog"
    expected: "Operator accepts this as 'one action producing the draft', or asks for dialog removal"
    why_human: "Deliberate deviation (A-04); ROADMAP wording says one click"
  - test: "Anthropic (claude-sonnet-5) and OpenRouter (z-ai/glm-5.2) rows of the SC#5 scoreboard after provider credit is added"
    expected: "Two-tool prompt calls search_documents then execute_code, answer contains 391"
    why_human: "Blocked by provider billing; the OpenRouter non-native tool path was never observed"
  - test: "Paste migration 210 into cloud Supabase SQL editor after the read-only slug-collision SELECT"
    expected: "0 collision rows beforehand; 3 starters on the cloud shelf afterward"
    why_human: "Production write, operator-gated"
  - test: "Hand-check the RunModal required-field refusal in a real session on a template-less workflow"
    expected: "'<Field label> is required' appears, nothing starts"
    why_human: "The defect was found only by a driven session; the fix has a unit test, no operator eyes yet"
  - test: "Optional: 50-prior-messages long-message row"
    expected: "In-thread start works in a long thread"
    why_human: "Only the 5 KB variant was run"
  - test: "Rule on the starter-card wording 'answer arrives in chat'"
    expected: "Operator decides; not shipped because it would reverse a pinned card design decision (needs a sketch under G-2)"
    why_human: "Design ruling"
---

# Phase 287 Verification: Start From a Thread, Fork a Starter

**Goal:** A user can start a workflow without leaving the conversation, and can begin from a ready-made starter instead of a blank page.
**Status: human_needed.** No ROADMAP success criterion is unmet in code. Status is not `passed` because SC#4's wording ("one click") rests on an operator ruling, SC#5's OpenRouter half and one provider row are blocked, and the cloud migration is owed.

## Success criteria

| SC | Verdict | Evidence (read in code / run by the verifier) |
|---|---|---|
| 1. Start from an open thread, same thread, no new thread | VERIFIED (code + driven live) | `useStartWorkflowInThread.ts` calls `sendMessage(threadId, "Run <name>", {workflowDefinitionId, inputs, surfaceId:"chat"})` with the existing thread id. It never calls `createThread` (no hit in the hook or the picker, and a stripped-source fence guards it). `StreamsProvider.tsx` gained one passthrough line `inputs: opts?.inputs`, and `streamsStore.ts` the type. Backend `models/message.py:97` already accepts `inputs`. `ChatArea.tsx` has one import and one mount `{thread && <ThreadWorkflowPicker thread={thread} locked={workflowLocked} />}`. The live G-4 scenario 1 recorded `workflow_runs.thread_id` equal to the open thread, with threads 1173 -> 1173. |
| 2. Empty required input refused by name, nothing starts | VERIFIED (code + tests; RunModal fix needs a human look) | `missingRequiredFields` is called in `ChatLaunchForm.tsx:97` and `RunModal.tsx:258`. The `RunModal.tsx:471` condition is now `showTemplate \|\| launchError \|\| requiredRefusal` (the f96ed449b fix for template-less workflows). Live: "Customer name is required", counts unchanged. I ran 8 suites covering this and SC#1/#4 (128 tests, all passed). |
| 3. At least 5 starters, each passing the gauntlet by running it | VERIFIED locally; cloud owed | Migrations 094 (3) and 210 (3) give 6. I ran `test_287_starter_static_gauntlet.py`, `test_287_fork_isolation.py` and `test_starter_workflows.py`: 13 passed. The static stages are asserted for all 6 with planted-defect counterfactuals. The real publish endpoint (golden run + judge) was run live for the 3 new starters, on KB-bound forks. Caveat: the 3 old starters were not re-gauntleted live, and the judge was one sample with the default model. Cloud migration 210 is not applied. |
| 4. Fork gives own draft; editing never changes starter or another user's copy | VERIFIED for isolation; "one click" is a DEVIATION for operator ruling | `test_287_fork_isolation.py` ran against the live local DB: the starter row and the other user's fork are byte-equal after an edit, with a positive control. `starterFork.287.test.tsx` pins the payload (new slug, version 1, draft, name kept). Live scenarios 3a/3b agree. The shipped flow is menu then a name dialog, kept per A-04, so "one click" is read as "one action". |
| 5. Thread start driven on a native provider + OpenRouter, two-tool prompt, parallel-thread row | PARTIAL: owed, recorded honestly | `287-UAT.md`: 6 of 8 roster rows PASS (OpenAI, Google, DeepSeek, Zhipu, MiniMax, Moonshot). Anthropic and OpenRouter are BLOCKED by provider credit and recorded with the reason, not omitted. The parallel-thread row PASSED, and the long-message row PASSED (5 KB variant only). The "full roster run or recorded owed" clause is satisfied by the recorded-owed route, but the OpenRouter half is not observed. The in-thread board rows used the same endpoint payload, not a UI click. |

## Other checks

- **G-5 / hot files:** `git diff 37159ec21..HEAD` shows `ChatLayout.tsx` and `MessageInput.tsx` untouched. `ChatArea.tsx` got one mount, and `StreamsProvider.tsx`/`streamsStore.ts` got one passthrough each. `node scripts/check-hot-file-ledger.cjs <phase>` exits clean. `docs/HOT-FILE-LEDGER.md` and `CLAUDE.md` carry the new rows and sections.
- **Deferred items not smuggled in:** the Schedule-form required block was left to Phase 293, server-side required-input enforcement is deferred (T-287-01), and the starter-card wording was not shipped.
- **Stubs:** none found. The picker, hook and fork path are real code driven live. The starters have real prompts and run `completed` with both phases producing text. The set is derived from the migrations, not a constant.
- **Process notes:** the G-2 sketch was skipped (override to record in STATE.md). `check-vitest-count-gate` was run once in plan 04, before the final pin edits, so a re-run is owed. Backend baseline reported 71 failed (at the ceiling). The tsc check showed no new errors versus base.
- **Test hygiene:** the live drive cleaned up its rows (17 threads, 5 definitions); the operator's counts returned to the pre-drive values.

## Operator-owed (in order)
1. Rule on SC#4 "one click" (menu + name dialog kept).
2. Anthropic and OpenRouter scoreboard rows after credit is added.
3. Cloud migration 210: run the read-only slug-collision SELECT, then paste.
4. Hand-check the RunModal refusal on a template-less workflow.
5. Optional 50-message long row.
6. Ruling on the starter-card "answer in chat" wording (needs a sketch).
7. Record the G-2 override in STATE.md, and re-run the count gate for a verdict line over the final pins.

_Verifier: Claude (gsd-verifier)_

## Note added 2026-10-27 (Phase 296, 296-05)

- SC#4 "one click": the operator accepted the shipped menu + name dialog as one action (296 D-12, 2026-10-26).
- Item 6 (the starter-card "answer arrives in chat" wording) is planted as SEED-378 (needs a sketch under G-2).
- Items 4 and 5 (287-V-4 required-field refusal; the optional 50-message row) are folded into 296-HUMAN-UAT.md as optional rows 11 and 12.
- 287-WR-03 (the fork-isolation test never attempted the attack) is fixed by 296-05: `test_287_fork_isolation.py::test_a_non_owner_cannot_write_a_starter_or_anothers_fork` attempts every write a non-owner could aim at a fork or a starter, on the service-role path and as a user JWT (RLS), with positive controls on both.

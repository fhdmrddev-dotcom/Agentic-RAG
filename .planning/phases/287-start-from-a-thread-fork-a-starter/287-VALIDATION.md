---
phase: 287-start-from-a-thread-fork-a-starter
plan: 05
date: 2026-10-19
status: human_needed
driver: claude (operator away), claude-in-chrome against http://localhost:5173/app.html, local Postgres reads
---

# 287 VALIDATION: live proof (G-4 scenarios, SC#5 axes, SC#3 live half)

Environment: Vite on `localhost:5173`, backend `:8000` already running and healthy (`/health` ok), local Supabase `:54322`. Logged in as the operator account. No global setting was mutated: every provider drive used per-request `provider` + `model` on `POST /threads/{id}/messages`. No production writes; Supabase MCP not used. SQL counts are for the operator user (`threads`, `workflow_runs`, `messages`).

## G-4 (D-15) scenarios

| # | Scenario | Verdict | Evidence |
|---|---|---|---|
| 1 | Start a workflow from an open thread: same thread, thread count unchanged, title unchanged | PASS | Open thread "ZZ287 scenario thread", composer "Run a workflow" listed the fixture plus the 3 new starters. Picked the fixture, typed a customer name, pressed Run. Counts before/after: threads 1173 -> 1173, runs 272 -> 273, messages 3016 -> 3017. `workflow_runs.thread_id` = the open thread (`74f59120...`); thread title unchanged; the one new message is the user's "Run ZZ TEST 287 required-field fixture". UI after Run: transcript line "Starting workflow... Step 1 of 2", composer reads "A workflow is already running in this thread", Workspace panel shows THIS WORKFLOW. Run reached `completed`. |
| 2a | Empty required field, in-thread form | PASS | Dialog text after pressing Run empty: "Customer name is required" (field label, not an id, not generic). Counts unchanged (1173/272/3016 -> 1173/272/3016), no run row. |
| 2b | Empty required field, library RunModal | FAIL first, then PASS after a one-line fix (`f96ed449b`) | FIRST DRIVE (fresh page load, real click and a JS `.click()`): no refusal element in the DOM (`run-required-refusal` absent), dialog stayed open, nothing started (counts unchanged). Silent refusal. Root cause: `RunModal.tsx:471` gated the whole block holding the refusal on `showTemplate \|\| launchError`; the fixture (like the starters) has no `llm_emit` phase, so `templateAdmission` is `does-not-admit` and the block, with the refusal inside, never rendered. The 287-01 tests used a `llm_emit` fixture, so the gap was invisible. FIX: condition now `showTemplate \|\| launchError \|\| requiredRefusal` (1 line); regression case "an empty REQUIRED field is refused by name on a template-less workflow too" added to `RunModal.test.tsx` (RED without the fix, 56/56 green with it). RE-DRIVE after HMR: refusal text "Customer name is required" (`run-required-refusal`, role=alert) rendered above the field; screenshot saved; counts still 1173/272/3016. |
| 3a | Fork a starter, edit the copy, re-open the shelf: starter unchanged | PASS | Library card menu "Make my own copy" -> name dialog -> `ZZ287 fork A` opened in the builder as a draft (header "From starter", "NET-NEW", unbound_retrieval warning "phase 'retrieve' reads your documents, but this workflow is not bound to a knowledge base" is the expected incomplete finding, not a defect). Opened the "Write it up" step, appended `EDITED-IN-FORK-A-ONLY` to the instructions, Save draft. DB: fork A definition contains the marker (position 1171); starter `stakeholder-update` definition md5 `659a69dd...` and name md5 identical before and after. Shelf re-opened: "Starters 6" still shows Stakeholder Update, card unchanged ("Never run", "Shared starter"). |
| 3b | Second fork is independent of the first | PASS | Forked the same starter again as `ZZ287 fork B`: DB position of the marker in fork B = 0 (absent), distinct slug (`stakeholder-update-5tfyb8` vs `-jrsjqf`), starter md5 still `659a69dd...`. |

Fixture handling (A-10): a throwaway published workflow `zz-test-287-required-fixture` (name "ZZ TEST 287 required-field fixture", one required input `customer_name`, org of the operator) was inserted by SQL and REMOVED at the end (SQL count 0).

Note: the library fork dialog is a naming dialog (the plan's text expects "menu then name dialog"); D-13 wording about "no dialog" is not what ships. Not a failure of D-15.

## SC#5 axes (see 287-UAT.md for the per-provider scoreboard)

| Axis | Verdict | Evidence |
|---|---|---|
| Cross-provider, multi-tool (search_documents + execute_code in one prompt) | PASS on 6 of 8 roster rows; 2 BLOCKED | Zhipu, MiniMax, Moonshot, DeepSeek, Google, OpenAI each called `search_documents` then `execute_code` and reported 391 (17*23). Anthropic and OpenRouter returned the app's billing banner (account has insufficient credits) with no tool call: blocked by the provider account, not by code. |
| Parallel-thread | PASS | Thread A (500-word generation, deepseek-v4-pro) and thread B (workflow start, deepseek-v4-flash) were sent within ~1 s of each other (05:08:17.66 and 05:08:18.03 UTC). Both completed: A with the full essay; B's run `completed` with both phases (`retrieve`, `write`) holding output text, `workflow_runs.thread_id` = B. A had no `workflow_runs` row. |
| Long-message | PASS | Thread with a 6,360-character prompt (reply "OK"), then the starter `meeting-notes-to-actions` started in that same thread: run `completed`, both phases complete, 3 messages in the thread, no new thread. Note: a >= 5 KB prompt, not >= 50 prior messages. |

The two started-in-thread rows above went through the same endpoint payload the picker sends (`workflow_definition_id`, `inputs`) rather than a UI click for the board rows; the UI click path itself is the evidence in G-4 scenario 1.

## SC#3 live half: golden run + judge for the 3 new starters

Method: fork each new starter, bind the fork to a KB folder (the starters ship unbound, so the grounding stage would flag them), and run `POST /workflows/{id}/publish` (the real gauntlet: business requirement, lint, interactive, grounding, REAL golden run, judge, commit). Judge model/golden model: the app default, deepseek-v4-flash.

| Starter | Fork bound to | Publish verdict | Evidence |
|---|---|---|---|
| stakeholder-update | "PM Demo Project (sample data)" | PASS | `{"published":true,"version":1,"named_failures":[],"blocked_stage":null}`, golden run `completed`, `is_golden_run` true |
| meeting-notes-to-actions | "Weekly reports" | PASS | same shape, golden run `3156224d...` completed |
| policy-change-impact | "HR Policies" | PASS | same shape, golden run `edc133fb...` completed |

Also ran each of the 3 starters as a plain run from a thread (stakeholder-update, policy-change-impact, meeting-notes-to-actions via the long-message row): all `completed` with both phases producing text.

Caveats (honest limits): the golden runs/judge were on the FORKS (bound to a folder), not on the global starter rows, which are published and immutable; the content is identical apart from `project_folder_id`. The golden input was authored by the driver, not by an operator. The judge is the app's default judge model, one sample per starter (no variance estimate). The 3 original starters (risk-register, weekly-status-report, compliance-gap-report) were not re-gauntleted; they pass the static stages by the 287-02 test (A-06).

## Cleanup (T-287-18)

Deleted by SQL, in one transaction: 5 workflow definitions (fixture, fork A, fork B, 2 golden-run forks; the third golden fork was fork B), 17 threads (scenario, 11 SC5 rows, parallel A/B, long-message, 2 SC3 runs, 3 `[validation] publish golden run` threads), their 8 workflow_runs, 16 workflow_phases, 33 messages. Post-clean counts for the operator user: threads 1172, runs 272, messages 3016 (equal to the counts before the drive began). Starter `stakeholder-update` md5 unchanged. SQL count of `ZZ287%` / `ZZ TEST 287%` rows: 0 definitions, 0 threads.

## Owed

- Cloud: migration 210 paste + the read-only slug-collision SELECT (from 287-02, still an operator step). Nothing in this plan touched production.
- OpenRouter and Anthropic rows: need provider credit, then re-run the two-tool prompt on `claude-sonnet-5` and `z-ai/glm-5.2`.
- The browser tab was visible throughout; screenshots worked, so no hidden-tab fallback was needed.

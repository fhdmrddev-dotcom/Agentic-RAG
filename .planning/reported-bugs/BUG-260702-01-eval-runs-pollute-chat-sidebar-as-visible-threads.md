---
id: BUG-260702-01
title: Eval runs create visible chat threads that pollute the sidebar (should run silently, DB-only)
reported: 2026-07-02
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [skills/eval, backend/eval-runner, frontend/chat-sidebar, backend/threads-list]
folded_into: "134.1"
verified_closed_by: null
related_seeds: [SEED-100]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 34834433
  date: 2026-07-02
---

# BUG-260702-01: Eval runs create visible chat threads that pollute the sidebar

## What we observed

During Phase 134 live UAT (running skill evals from `SkillEvalSection`), the user noticed the
chat sidebar is contaminated with leftover chats from earlier eval runs — "some empty, some
populated." Confirmed directly against the live local DB (`:54322`):

- **34 threads titled `[eval] skill A/B run` exist = 10% of all 338 threads in the sidebar.**
- **17 are EMPTY (0 messages), 17 are populated (1–3 messages).** Exactly matches the
  "some empty, some populated" report.

These are real `public.threads` rows and therefore appear in the normal chat thread list /
sidebar alongside the user's genuine conversations. Each eval run adds more.

## Why it matters

- **Contaminates chat history** — a user (or a customer org) running evals sees their real
  conversation list buried under `[eval]` execution artifacts they never started.
- **Grows unbounded** — every eval run leaks at least one thread (often an empty + a populated
  one), so the pollution compounds with normal eval usage.
- **Confusing + unprofessional** — the eval's *results* already live in `eval_results` and are
  retrieved via the eval readout; the chat thread is a pure execution artifact the user should
  never see. This is a production-cleanliness blocker for the "Skill Eval Studio" story.

## Hypothesized cause

**Confirmed, not just hypothesized.** `eval_runner_service._create_eval_thread`
(`backend/app/services/eval_runner_service.py:257-273`) inserts a **real `threads` row**
(`title="[eval] skill A/B run"`, `folder_id=None`) for every eval run — because `run_agent_loop`
reads `folder_id` + history from the DB and has no in-memory execution path (per the function's
own docstring). The agent loop then writes user/assistant `messages` into that thread (the
populated ones); arms that produce no assistant message (e.g. the without-skill arm, or an
errored arm) leave the thread empty.

`public.threads` has **no** `hidden` / `kind` / `is_eval` column
(columns today: id, user_id, title, created_at, updated_at, folder_id, active_workflow_run_id),
so the sidebar thread-list query cannot currently distinguish eval-execution threads from real
chats — it lists them all.

## Surface classification

`Agentic-RAG` — this is our app's own eval-runner + chat-sidebar behavior. Routing candidate;
cross-check at `/gsd:discuss-phase` and `/gsd:new-milestone`.

## Suggested routing

- **Fold into in-flight phase:** n/a directly — Phase 134 delivers the *honest verdict + ratings*
  (which work); this is an eval-*execution* cleanliness issue rooted in the Phase 133 runner.
- **Defer to future phase / milestone:** small dedicated phase (recommended) — the fix touches
  `backend/app/api/threads.py` (a **G-5-firing hot file**, 9+ touches) sidebar-list query + a
  numbered migration on `threads` + the eval runner. Not a `/gsd:fast` one-liner.
- **Plant as seed:** already correlates with **SEED-100** (production-clean eval). Fold there.
- **External — note only:** no.

**Proposed fix shape:**
1. Migration: add a marker to `threads` (e.g. `is_eval boolean NOT NULL DEFAULT false`, or a
   more general `kind`/`hidden` column) — numbered SQL, applied via SQL editor per house rules.
2. `_create_eval_thread`: set the marker on insert.
3. Sidebar thread-list query (`threads.py`): `WHERE is_eval = false` (exclude eval-execution
   threads). Eval results stay retrievable via the existing `eval_results` readout — unaffected.
4. Backfill/cleanup: flag (or delete) the 34 existing `[eval]` threads.
   Consider ON DELETE CASCADE / message cleanup so old runs can be purged.

## Workarounds (prompt-side, code-side, or UI-side)

- **Today:** none in-UI (there is no hide/delete-all for eval threads). A manual DB cleanup
  (`DELETE FROM threads WHERE title LIKE '[eval]%'`, messages cascade) clears the current 34,
  but they will re-accumulate on the next eval run until the marker+filter lands.

## Reference / evidence links

- Root cause: `backend/app/services/eval_runner_service.py:257-273` (`_create_eval_thread`),
  `:276-297` (`_reset_thread_to_prompt` writes the prompt message).
- Live DB evidence (2026-07-02): 34 `[eval]` threads / 338 total; 17 empty / 17 populated.
- Related: BUG-260701-02 (eval panel stale results — already fixed); SEED-100 (production-clean eval).

## Resolution (2026-07-02) — Phase 134.1

Fixed and live-verified. Migration 082 added `threads.is_eval` (+ backfilled the 34 leaked rows,
hidden not deleted); `_create_eval_thread` sets the flag; `list_threads` filters `is_eval=false`.
Live proof: `GET /threads` returns **303 (was 337), 0 `[eval]`**. 14/14 eval tests pass. Commits
`b073cced` + `58ec1da6`. See `.planning/phases/134.1-evals-run-silently/134.1-SUMMARY.md`.
(Status stays `folded` pending the milestone-audit `closed` flip per the reported-bugs lifecycle.)

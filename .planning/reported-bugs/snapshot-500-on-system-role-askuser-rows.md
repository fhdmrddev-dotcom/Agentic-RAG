---
id: BUG-260528-01
title: Thread won't load — /snapshot + /messages 500 on persisted role='system' ask_user rows
reported: 2026-05-28
surface: Agentic-RAG
severity: major
status: closed
affected_areas: [backend/threads, frontend/streaming, ask_user/HITL]
folded_into: null
verified_closed_by: null            # code fix + regression test landed commit (see below); operator reload-confirm pending
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: v2.5-dev
  commit: f2f958f
  date: 2026-05-28
---

# BUG-260528-01: Thread won't load — /snapshot + /messages 500 on persisted role='system' ask_user rows

## What we observed

After Phase 085 (ask_user / HITL panel) testing, some threads fail to open. Backend log:

```
GET /threads/f14711c5-39ce-4541-ab2e-66c264bdc9f9/snapshot HTTP/1.1" 500 Internal Server Error
fastapi.exceptions.ResponseValidationError: 2 validation errors:
  {'loc': ('response','messages',1,'role'), 'msg': "Input should be 'user' or 'assistant'", 'input': 'system'}
  {'loc': ('response','messages',2,'role'), 'msg': "Input should be 'user' or 'assistant'", 'input': 'system'}
```

Threads without `system` rows load fine (200); any thread that used the ask_user tool 500s.

## Why it matters

Major: a thread where the agent ever asked the user a question becomes **permanently un-openable** (hard 500 on both `/snapshot` and `/messages`, which share `MessageResponse`). The user loses access to real conversation history.

## Hypothesized cause — CONFIRMED

`ask_user` persists its prompt/response as durable `messages` rows with `role='system'` + `tool_calls:[{kind:'ask_user_prompt'|'ask_user_response'}]` (`tool_dispatcher.py:1329`, `runs.py:533`; D-085-02 / D-085-05). Migration 048 widened the DB `messages_role_check` to allow `'system'`. But `MessageResponse.role` (`models/message.py:19`) was **never widened** — it stays `Literal["user","assistant"]`. Serializing a `system` row through `ThreadSnapshotResponse.messages` / `list[MessageResponse]` raises `ResponseValidationError` → 500.

## Fix applied (this session)

Exclude `role='system'` rows at the two `MessageResponse`-serializing read paths (`threads.py` get_snapshot + get_messages) via `.neq("role","system")`. This is correct, not a stopgap:
- The frontend chat list has **no `role==='system'` renderer** (would otherwise render as a fake assistant bubble) — these rows were never meant as chat bubbles.
- The ask_user **resume/pending** mechanism is unaffected: `panel.py` `/pending` uses its own raw asyncpg query against `role='system'` rows, not the filtered endpoints.
- Agent LLM context reconstruction (`utils/db.py`) is a separate query and still sees the rows.

Regression guard added: `test_075_snapshot.py` asserts `.neq("role","system")` is applied. Full suite (snapshot + all Phase 085 ask_user/panel tests): 39 passed.

## Follow-up observation (candidate for Phase 086+)

With the filter, **answered** ask_user Q&A turns no longer appear in the reloaded conversation. If product intent is for answered prompts to show in history on reload, that needs a dedicated frontend renderer for `kind:'ask_user_*'` rows (the forward-ref hook Phase 082.5 / D-075.4-E1 referenced) plus widening the wire model — not a filter. Until then, the live SSE + panel surfaces remain the user-visible signal. Worth confirming with the operator whether reloaded ask_user history visibility is required.

## Surface classification

`Agentic-RAG` — this app's backend/streaming. Routable.

## Suggested routing

- **Fold into in-flight phase:** n/a (fixed inline 2026-05-28)
- **Defer to future phase / milestone:** the reload-rendering follow-up above → Phase 086+ if operator wants answered ask_user turns visible on reload
- **Plant as seed:** optional (ask_user reload history rendering)
- **External — note only:** no

## Workarounds

None needed post-fix. Pre-fix: the thread was unrecoverable via UI.

## Reference / evidence links

- `backend/app/api/threads.py` get_snapshot / get_messages (filter)
- `backend/app/models/message.py:19` (narrow Literal — root cause)
- `backend/app/services/tool_dispatcher.py:1329`, `backend/app/api/runs.py:533` (system-row persistence)
- `backend/app/api/panel.py:124` (separate pending query — why resume is unaffected)
- `supabase/migrations/048_messages_allow_system_role.sql`

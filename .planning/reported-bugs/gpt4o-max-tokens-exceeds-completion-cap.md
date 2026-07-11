---
id: BUG-260620-01
title: openai/gpt-4o Deep runs intermittently 400 — max_tokens 32768 exceeds the model's 16384 completion cap
reported: 2026-06-20
surface: Agentic-RAG
severity: minor
status: folded
affected_areas: [backend/provider-routing, MODEL_CAPABILITIES, openai-service]
folded_into: 149
verified_closed_by: null
related_seeds: [SEED-009]
re_open_trigger: null
reproduces_on:
  branch: v2.5-dev
  commit: a0795ce2
  date: 2026-06-20
---

# BUG-260620-01: openai/gpt-4o Deep runs 400 on max_tokens > completion cap

## What we observed

During the Phase 115 SC#10 cross-provider UAT (Claude-driven, real Deep agent loop via
`POST /threads/{id}/messages`), all three `openai/gpt-4o` runs **failed**:

```
failed: BadRequestError: Error code: 400 - {'error': {'message':
'max_tokens is too large: 32768. This model supports at most 16384 completion tokens,
whereas you provided 32768.', 'type': 'invalid_request_error'}}
```

The app resolved `max_tokens=32768` for the request and sent it to OpenAI; gpt-4o caps
completion at 16384 → 400.

**Intermittent / state-dependent:** an earlier single-message smoke against the same
`openai/gpt-4o` in the same session **completed cleanly** (emitted the tool, answered).
The 3 failing runs were fired in rapid succession (racing); whether that's correlated is
unconfirmed. `openai/gpt-5.4-mini` (the app default) was clean on every run.

NOT related to Phase 115 — `query_documents_by_view` plays no part; this is a model-config /
token-clamp issue on the OpenAI path. Surfaced here only because the 115 UAT exercised gpt-4o.

## Why it matters

`gpt-4o` is a user-selectable model in the picker (`/settings/providers` lists it). When the
clamp doesn't fire, every Deep run on it 400s — a selectable model silently broken. Severity
held at **minor** because: it's intermittent (the smoke passed), gpt-4o is an older model
(newest OpenAI tier gpt-5.x is unaffected), and the app default gpt-5.4-mini is clean — but
it's still a real user-facing failure for anyone who selects gpt-4o.

## Hypothesized cause

The per-model output cap EXISTS — `openai_service.py:1162` maps `"gpt-4o": 16384` (the
SEED-009 / Phase-074 clamp data) — but it was **not enforced** on the failing path: a
resolved `max_tokens` of 32768 reached OpenAI uncapped. Likely a clamp-application gap (the
`_resolve_max_tokens` clamp isn't consulted, or is bypassed by a settings/default of 32768)
on the chat path this UAT drove, rather than missing clamp DATA. The intermittency suggests
the resolved value depends on session/settings state. Mark as hypothesis until traced with a
LangSmith/backend-log capture of the exact `_resolve_max_tokens` inputs on a failing run.

## Surface classification

`Agentic-RAG` — this is our app's OpenAI provider-routing / token-clamp behavior, not an
OpenAI-API defect (OpenAI correctly rejects an over-cap request). Routing candidate at the
next provider/model-config phase (pairs with SEED-009). The fix is almost certainly enforcing
the existing 16384 cap on every OpenAI completion path, not adding new clamp data.

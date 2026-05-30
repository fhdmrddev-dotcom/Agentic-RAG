---
id: BUG-260526-02
title: Kimi thinking/reasoning text leaks into main chat content
reported: 2026-05-26
surface: Agentic-RAG
severity: medium
status: closed
affected_areas: [backend/streaming, frontend/chat]
folded_into: "083"
verified_closed_by: "083"
related_seeds: [SEED-032]
re_open_trigger: null
reproduces_on:
  branch: v2.5-dev
  commit: 1652b30
  date: 2026-05-26
---

# BUG-260526-02: Kimi thinking/reasoning text leaks into main chat content

## What we observed

When using Kimi (kimi-k2.6 via direct Moonshot API), the model's internal chain-of-thought reasoning appears in the chat as regular message content. After the model said "Slides 15-16 created", thinking text like "I need to create a file. The user asked me to..." remained visible in the chat.

**DB evidence:** Message `0f34de64` in thread `df8e3024` has:
- `content` field: 23,718 chars starting with "I need to create a file. The user asked me to..."
- `reasoning_content` field: 141 chars (only a small fragment)

**DeepSeek comparison:** Message `fd11af98` in thread `5e7e9f54` has clean separation — `content` is 3,182 chars of actual response, `reasoning_content` is 153 chars. No leakage.

## Why it matters

Users see the model's internal reasoning mixed into the response. It's confusing and unprofessional — "I need to create a file" is not what the user asked to see. The content is persisted to DB, so it survives page reload.

## Hypothesized cause

Kimi puts chain-of-thought into `delta.content` (regular content stream), NOT into `delta.reasoning_content`. The backend chunk handler at `threads.py:2210-2212` accumulates ALL `delta.content` into `full_content` without provider-aware filtering:

```python
if delta.content:
    full_content += delta.content
    await _emit(redis, run_id, 'delta', content=delta.content)
```

DeepSeek correctly separates reasoning into `delta.reasoning_content` (caught at line 2215-2218). Kimi doesn't use this field — its thinking goes through the regular content channel.

## Surface classification

Agentic-RAG — backend streaming code needs provider-aware content filtering for Kimi's thinking format.

## Suggested routing

- **Fold into in-flight phase:** n/a (076.2 closing)
- **Defer to future phase / milestone:** Next provider-polish phase or 076.3 insert
- **Plant as seed:** n/a
- **External — note only:** no

## Workarounds (prompt-side, code-side, or UI-side)

None currently. Users see thinking text in Kimi responses. The text persists in DB.

## Reference / evidence links

- Thread `df8e3024` in Supabase (Kimi run)
- Thread `5e7e9f54` in Supabase (DeepSeek comparison — clean)
- `backend/app/api/threads.py:2210-2218` (chunk handler)
- Phase 076.2 VALIDATION.md BUG-260526-02 entry

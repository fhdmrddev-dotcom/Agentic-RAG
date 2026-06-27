---
id: BUG-260607-02
title: '"Setting up agent…" hides real model activity for up to a minute — reasoning/args streaming and title-gen serialization are invisible'
reported: 2026-06-07
surface: Agentic-RAG
severity: major
status: open
affected_areas: [frontend/chat-banner, backend/dispatch-latency, sandbox]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-065, SEED-066, SEED-067]
re_open_trigger: "Reviewed at /gsd:discuss-phase 128 (2026-06-27) — PARTIAL fold: the TDP-02 description-window sub-cause (the agent's 'about to…' tc.args.description surfacing during the preparing window) IS addressed by Phase 128 (CONTEXT D-04). Causes (b) banner ignores reasoning/arg-streaming activity (toolMeta.ts:73) and (c) title-gen serializes run-start (threads.py:1039 — G-5 extraction-due) are NOT folded — out of 128's sketched scope. Stays OPEN. Re-open/route the remaining two causes into the next chat-surface run-legibility & latency phase."
reproduces_on:
  branch: v2.5-dev
  commit: 0af81c8e
  date: 2026-06-07
---

# BUG-260607-02: "Setting up agent…" hides real model activity for up to a minute

## What we observed

Operator ran the same heavy prompt ("benchmark 5 sorting algorithms up to 10M elements") across 6 providers (2026-06-07 17:37–17:55) and perceived ~1 minute of "Setting up agent…" before anything visible happened. Redis run-stream timelines (ms-precision event offsets from run start) decompose that minute into **three distinct causes**:

| Provider | Run | Backend start→loop | First visible-to-backend activity | Sandbox spin-up (tool_start→first stdout) |
|---|---|---|---|---|
| openai gpt-5.5 | 5182406f | 1.0s | tool_preparing +14.6s, then **26s streaming script into tool args** | ~17s |
| google gemini-3.5-flash | 8c326257 | **20.0s** ⚠️ | tool_preparing +43.3s | ~16s + 22s |
| zhipu glm-5.1 | 1366aea4 | 3.0s | reasoning_delta +30.3s (z.ai server-side TTFT) | ~20s |
| moonshot kimi-k2.6 | d1a29f97 | 0.1s | reasoning_delta **+1.4s** — then ~4,000 reasoning events, none surfaced | — |
| deepseek v4-flash | db5188fb | 1.6s | reasoning_delta +4.0s | — |

## Why it matters

The user cannot tell a healthy hard-thinking run from a wedged one — the exact "is it stuck?" anxiety that triggered manual restarts during the 096 UAT storm. Cross-provider honesty/legibility is a core product value (RUN-HONESTY, Phase 094 "run honesty").

## Root causes (all verified)

1. **Frontend legibility (primary):** `toolMeta.ts:73` `outerBannerLabel` returns "Setting up agent…" whenever `!hasAnyTools && !isPlanning` — **`reasoning_delta` and `tool_args_progress` events do not count as activity**. Kimi streamed thousands of reasoning deltas from +1.4s while the banner said "Setting up agent…".
2. **Title-gen serializes run start (google ~19s):** `threads.py:1039` awaits `generate_thread_title` (threadpooled but **serial**) before `agent_runner` is spawned. Google's title call took ~19s; openai ~1s. Fix shape: fire-and-forget background task (it already emits `title` via SSE and swallows its own errors; preserve fallback_model-before-title ordering inside the task).
3. **Sandbox cold-start (secondary, after "executing code" appears):** 15–22s container creation per NEW thread (`SandboxSessionManager.get_or_create`); 3 parallel new chats = 3 simultaneous container builds.

## Surface classification

`Agentic-RAG` — frontend banner logic + backend dispatch ordering + sandbox lifecycle.

## Suggested routing

- **Fold into in-flight phase:** n/a (v2.8 closing)
- **Defer to future phase:** a small post-close "run legibility & latency" phase bundling: cause 1 (banner honors reasoning/args activity — e.g. "Reasoning… Ns" with elapsed), cause 2 (title-gen async), SEED-065-B (stream-create event-loop blocker), SEED-066 (workspace replay on reload), SEED-067 (new-chat latency). Same family, same surfaces, G-2 sketch-light.
- **Plant as seed:** cause 3 → sandbox container pre-warm/pool (see SEED-069 candidate at next sweep)
- **External — note only:** GLM's 27s first-token latency and gpt-5.5's 26s args-streaming are intrinsic provider/model behavior — label honestly, don't "fix".

## Workarounds

None needed — runs are healthy; the banner is just uninformative. Operators can check the workspace panel / uvicorn console for activity.

## Reference / evidence links

- Redis stream timelines captured 2026-06-07 (`run:{run_id}` first-occurrence offsets, runs 5182406f / 8c326257 / 1366aea4 / d1a29f97 / db5188fb)
- `frontend/src/lib/toolMeta.ts:73` (banner gate) · `backend/app/api/threads.py:1030-1068` (serial title-gen)

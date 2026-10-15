---
id: BUG-261015-02
title: The OpenAI-compat / Responses stream is opened synchronously on the event loop, outside the per-call budget
reported: 2026-10-15
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [backend/provider-routing, backend/agent-loop, local-models]
folded_into: "282"
verified_closed_by: null
related_seeds: ["SEED-172"]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 6f23afe7d
  date: 2026-10-15
---

# BUG-261015-02: The OpenAI-compat stream opens on the event loop, outside the budget

## What we observed

Found by reading the code during the Phase 282 discuss scout. **Not yet driven.**

`provider_gateway/dispatcher.py:131` `async def open_stream(...)` calls the adapter synchronously, with no
`await` and no threadpool. For the OpenAI-compat surface that reaches `create_adaptive_streaming_chat` →
`client.chat.completions.create(stream=True)` (`openai_service.py:2410`, `:2464`, `:2488`). For the Responses
surface it reaches `client.responses.create` (`openai_responses.py:557` / `:561`).

So connecting, waiting for response headers and every SDK retry all happen:
1. **on the event-loop thread**, blocking every other request that uvicorn worker serves; and
2. **before** `asyncio.timeout(per_call_budget)` starts in `_drain_stream_with_close_on_cancel`
   (`agent_loop.py:589`), so the operator's budget does not cover them.

Today that phase is bounded only by the SDK default: read 600 s per attempt × (1 + 2 retries). The
OpenRouter 404 retry adds one more `create`.

Anthropic and Google do not have this problem. Their generators build the client and open the request inside
the producer thread.

## Why it matters

A local server that holds headers back until it has the first token, which a slow GPU model can take minutes
to produce, freezes the whole worker for every user while it waits. Phase 282 raises the reachable timeout
above 600 s, so without this fix it would make the freeze **longer**.

## Hypothesized cause

`open_stream` was written `async` for the adapter interface, but the OpenAI adapters are synchronous
generators whose first call is an eager network round-trip.

## Suggested routing

Folded into **282** under CONTEXT D-05, conditional on a measurement that shows the loop actually blocks. The
fix is the minimal one at the gateway boundary: run the synchronous create off the loop. The agent loop's call
sites do not move.

## Reference / evidence links

- `backend/app/services/provider_gateway/dispatcher.py:131`
- `backend/app/services/openai_service.py:2199`, `:2410`, `:2464`, `:2488`
- `backend/app/services/provider_gateway/openai_responses.py:553-561`
- `backend/app/services/agent_loop.py:521-618`

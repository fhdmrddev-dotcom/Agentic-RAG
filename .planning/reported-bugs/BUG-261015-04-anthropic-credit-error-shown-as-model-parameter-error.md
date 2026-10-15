---
id: BUG-261015-04
title: An Anthropic "credit balance is too low" 400 is shown in chat as "Model parameter error — this model may not support the current configuration"
reported: 2026-10-15
surface: Agentic-RAG
severity: minor
status: open
affected_areas: [backend/provider-routing, frontend/chat-errors]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 22c409c2c
  date: 2026-10-15
---

# BUG-261015-04: Anthropic out-of-credit shown as a model parameter error

## What we observed

Phase 282 SC#10 board row 2 (`claude-sonnet-5`, run `d512fe97-428c-46de-bfd7-1469e9ade5d9`, 2026-10-15):

- `runs.error`: `failed: BadRequestError: Error code: 400 - {... 'invalid_request_error', 'message': 'Your credit balance is too low to access the ...`
- The assistant message in chat: `*Model parameter error — this model may not support the current configuration.*`

## Why it matters

The person is told the model or its configuration is wrong, when the real fix is to top up the provider
account. This is the same class as `google-429-mislabeled-as-billing.md`, in the opposite direction. The
true cause is visible only in the DB.

## Hypothesized cause

The chat-facing error copy maps every provider 400 `BadRequestError` to the "model parameter" sentence,
without checking for Anthropic's billing message.

## Suggested routing

A G-3-sized copy fix at the error-classification boundary. Leave it open until a phase touches provider
error copy.

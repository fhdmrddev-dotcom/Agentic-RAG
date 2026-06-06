---
id: SEED-056
title: Vitest unit-test baseline cluster — 17 pre-existing failures across 7 files are rotted tests (test drift), not app bugs; triage (fix-or-delete) to get the suite green
status: planted
planted: 2026-06-06
planted_by: orchestrator (parallel-chats work — operator asked "what is this 17 failed?", confirmed OK to leave IF tracked)
trigger_when: before any milestone close that claims unit-test coverage, OR when CI frontend-tests is turned on for real, OR any phase that wants the vitest suite to gate green, OR when a NEW failure appears (the count must stay at exactly the baseline so net-new regressions are visible)
priority: low
tags: [frontend/unit-tests, vitest, test-debt, chat-ui, streaming, test-drift]
related_seeds: [SEED-049]
---

# SEED-056: Vitest unit baseline cluster triage

## Context (how it surfaced)

The frontend vitest suite has carried a **stable baseline of 17 failing tests across 7 files** since well before the parallel-chats work (2026-06-06). The operator noticed it during the parallel-chats UAT ("what is this 17 failed?") and was fine leaving it **provided it is tracked** — this seed is that tracking. Distinct from [[SEED-049]] (the **E2E Playwright** suite revival); this is the **unit** suite.

## What it is (and is NOT)

- **NOT app bugs.** The app behaviors these tests cover (streaming, tool calls, dedup, message rendering) are exercised in live UAT and work. The failures are **test drift** — the test code fell out of sync with the app code.
- Concrete examples seen: `useMessages.test.ts` calls `cb.onToolEnd("execute_code")` with 1 arg when the callback now takes 2–3; `streamsProvider.test.tsx` asserts a tool-args value (`"CHUNK_A"`) its mock no longer produces; `streamsProvider_075_9_clientkey.test.tsx` expects tool status `done` but the mock sequence yields `running`.
- **Proven pre-existing + stable:** a git-stash A/B during the parallel-chats change produced the **identical 17 failures with and without the change** — so "zero net-new" is the regression gate the team has been relying on.

## The 7-file cluster (per the documented 095.x baseline)

`model-info` · `MessageItem` · `Plan04` · `useMessages` · `StreamsProvider.dedup` · `streamsProvider` · `streamsProvider_075_9_clientkey`. (Run `cd frontend && npx vitest run` for the live list — keep it at 17/553; any increase = a real net-new regression to chase.)

## What it would take (triage, fix-or-delete)

- For each failing test: decide whether it asserts CURRENT intended behavior (→ update the test/mock to match the code) or asserts REMOVED/changed behavior (→ delete or rewrite). Most are mock-signature / expected-value drift, not logic.
- Re-baseline to **0 failures** so the suite can gate green in CI (`frontend-tests`), making future regressions impossible to hide in a noisy baseline.
- Pairs with [[SEED-049]] (E2E) — do both before a milestone claims "tests green."

## Why deferred (not done now)

Orthogonal to the chat/streaming feature work; it's test-maintenance, best done as a dedicated green-the-suite pass rather than piecemeal. Until then, the **"stay at 17/553, zero net-new"** convention is the working regression gate.

## Re-open trigger

Before a milestone close claiming unit coverage, OR turning on CI gating, OR when the baseline count changes (a NEW failure = net-new regression). Cross-ref [[SEED-049]].

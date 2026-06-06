---
id: SEED-055
title: True concurrent chats (parallel sends, Claude.ai/ChatGPT-class) + send-path hardening — per-thread send mutex, composer-clear safety net, and the fresh-thread reconcile-vs-send race
status: partially-shipped
planted: 2026-06-06
planted_by: orchestrator (post-095.1 — operator report of silent send-drop on fast chat-nav; investigation wf_b4755523-73b)
shipped_note: "PART 1 (true concurrent chats / per-thread send mutex) SHIPPED 2026-06-06 — StreamsProvider isSendingRef(global bool)+streamingThreadIdRef(slot) → sendingThreadsRef(Set); busyElsewhere stopgap gate removed. Verified: live two-concurrent-streams, 4-lens adversarial review (0 defects), git-stash test parity (17/17 baseline, zero net-new), tsc baseline 37. RESIDUALS STILL OPEN: (2) fresh-thread reconcile-vs-send race [mechanism #2], (3) composer-clear text safety net, (4) stoppedByUserRef single-global → 'cancelled' mislabel under 2 concurrent stops [pre-existing, surfaced by review], (5) optional title-gen off critical path."
trigger_when: A chat-surface reliability/UX milestone or polish phase (pairs with SEED-045 UI/UX polish), OR v2.9 kickoff, OR any phase that touches the StreamsProvider send/dispatch refs (isSendingRef / streamingThreadIdRef / abortControllerRef) or the new-chat first-message dispatch flow, OR the operator asks to start a second chat while the first is still streaming.
priority: medium
tags: [chat, composer, send-path, parallel-sends, concurrency, run-honesty, professional-ux, StreamsProvider, BUG-260603-01, v2.9]
related_bugs: [BUG-260603-01]
---

# SEED-055: True concurrent chats + send-path hardening

## Context (how it surfaced)

Operator (2026-06-06, post-095.1 live UAT): "navigating quickly to another chat after starting a fresh one… the new chat opens but the prompt is never sent unless I open a third chat." Stated intent: **make this app behave like a professional app (Claude.ai / ChatGPT)** — where you can start a response in one chat and fire off a *new* chat while the first streams in the background.

A 10-agent code-path investigation + adversarial verification (`wf_b4755523-73b`) root-caused **two distinct mechanisms** behind the "silent drop" symptom (full detail in `.planning/reported-bugs/general-chat-intermittent-silent-send-drop.md`):

1. **Global single-send mutex** — `StreamsProvider.isSendingRef` is one un-keyed flag held for a run's *entire* duration; a second send anywhere is silently dropped until the first run terminates. (DOMINANT; matches the operator's manual repro.)
2. **Fresh-thread reconcile-vs-send race** — submit against a not-yet-settled freshly-switched thread; the reconcile/getSnapshot wipes the optimistic bubble and (per the report) no run is created; an immediate retry works. (The original BUG-260603-01 automation signature; fires with NO concurrent stream.)

## What shipped already (the zero-risk floor — NOT this seed)

A `busyElsewhere` send gate (`ChatArea` + `MessageInput`, 2026-06-06): while another thread's run is in flight, the **Send action** is disabled with an honest hint, the textarea stays editable (260523-01 preserved), and the typed text is never wiped. This **deterministically closes mechanism #1's silent drop** — but it makes the single-send limit *honest*, it does **not** enable true parallel sends, and it does **not** fix mechanism #2.

## The capability (this seed)

The "accurate, focused" fix the operator deferred — make the app genuinely professional-grade on the send path:

1. **True concurrent chats (parallel sends). ✅ SHIPPED 2026-06-06.** The global send mutex was converted to per-thread: `isSendingRef` (boolean) → `sendingThreadsRef` (`useRef<Set<string>>`), and `streamingThreadIdRef` was **eliminated entirely** (every reader — the two placeholder-preservation guards, `clearThreadBucket`, `stopStream`, and the localStorage persistence predicate — re-expressed per-thread via `sendingThreadsRef.has(threadId)` / the reactive `streamingThreads` set / the viewed-thread `activeThreadIdRef`). `abortControllerRef` turned out to be **vestigial** (assigned, never read) so the feared cross-wiring was a non-issue. The send guard now blocks only a re-send into a thread *already* sending; a send into a different thread dispatches concurrently. The `busyElsewhere` stopgap gate was removed. **Verified:** live two-concurrent-streams (chat #2 dispatched + answered while chat #1's long review streamed — both `POST …/messages [201]`); 4-lens adversarial review `wf_066123d6-4d5` (0 defects — wipe-protection *stronger* than before, Stop correct, no slot-leak, provider-agnostic); git-stash test parity (17/17 baseline, **zero net-new**); tsc baseline 37; vite build 0. Provider-agnostic — no SSE/chunk/provider code touched.
2. **Composer-clear safety net. ⬜ STILL OPEN.** Thread a success signal back through `onSend` (and `sendMessage`) so `MessageInput` only clears the text on a CONFIRMED dispatch / re-injects on early-return or throw — so no typed prompt is EVER lost, covering mechanism #2's text loss too. (Not done in PART 1 — with parallel sends working, the *dominant* lost-text case, the busy-drop, is gone; this covers the residual reconcile-race text loss.)
3. **Fresh-thread reconcile-vs-send race fix.** Guarantee `isSendingRef`/`streamingThreadIdRef` are set (or the optimistic placeholders tagged) BEFORE `setViewingThread`'s reconcile can resolve on a freshly-created thread — or make the preserve-predicate at ~:1182 not depend on a flag that the send sets *after* the reconcile may have already fired. Instrument whether `postMessage` (~:1473) actually fires in the repro first (the report's "no run created" suggests it does not).
4. **Optional: cut the first-token delay.** Move blocking title generation (`backend/app/api/threads.py` ~:1039 `await run_in_threadpool(generate_thread_title)`) OFF the run-start critical path (before `asyncio.create_task(agent_runner)` ~:1571), fire-and-forget over the existing 'title' SSE — shrinks the window and the "few seconds delay."
5. **`stoppedByUserRef` per-thread. ⬜ STILL OPEN (pre-existing, surfaced by the PART-1 adversarial review).** `stoppedByUserRef` (`StreamsProvider.tsx` ~:986) is a single global ref; under TWO concurrent streams, stopping thread A then thread B terminating concurrently can let B consume/reset the flag set for A → B's terminal cosmetically mislabeled "cancelled" (a label nuance, NOT a wrong-run cancel). Make it a `Set<threadId>` (or `Map<runId, bool>`) when PART-1 concurrency is exercised in earnest.

## Why deferred (not done in the zero-risk fix)

- `StreamsProvider.tsx` is a G-5-firing hot file (5+ phases); per-threading three coupled single-slot refs + three readers is medium-risk and can resurface the BUG-260521-01 placeholder-wipe class if done naively.
- It's behavior-changing on the shared send/dispatch path → MUST go through the mandatory SC#10 4-axis cross-provider × multi-tool × **parallel-thread** × long-message UAT (this defect lives on the parallel-thread axis), driven live via Chrome MCP.
- The operator explicitly chose: ship the honest zero-risk gate now, do the accurate parallel-send fix as a deliberate, roadmap-aligned item — not a rushed hot-file change.

## Acceptance (when built)

- Submit in chat #1 (streaming) → open New Chat → submit in chat #2 → chat #2 **dispatches** (POST + optimistic bubble + its own run) WHILE chat #1 keeps streaming; both stream independently.
- Quiescent-app rapid thread-switch + immediate Enter (no prior stream) → the send fires and a run is created (mechanism #2 closed); typed text never lost on any drop/failure.
- All 8 providers byte-identical on the per-token streaming path (dispatch/guard-layer change only).

## Re-open trigger

A chat-surface reliability/UX or polish phase (pairs with [[SEED-045]] UI/UX polish), OR v2.9 kickoff, OR any phase touching the StreamsProvider send/dispatch refs or the new-chat first-message dispatch flow, OR the operator asks for two chats running at once. Cross-ref BUG-260603-01.

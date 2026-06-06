---
id: BUG-260603-01
title: Chat send intermittently does nothing (silent drop) on the general chat path
reported: 2026-06-03
surface: Agentic-RAG
severity: minor
status: open
affected_areas: [frontend/chat, frontend/composer]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-055]
re_open_trigger: "Reviewed at Phase 096 discuss-phase (2026-06-06, D-096-07): considered for 096 (parallel-thread axis adjacent) but routed OUT — composer/send-path surface, no overlap with 096's eval/restart-UAT/stream-cap domain; mechanism #1 already fixed via parallel chats (SEED-055 holds residual). Stays OPEN; re-route to a dedicated composer/send-reliability fix when scoped. PRIOR: Reviewed at Phase 095.1 discuss-phase (2026-06-06): considered for the 095.1 cross-check but routed OUT — composer/send-path surface (frontend/chat, frontend/composer), unrelated to 095.1's run-honesty + provider-error + workspace-panel scope. Stays OPEN; re-route to a dedicated composer/send-reliability fix when scoped."
reproduces_on:
  branch: v2.5-dev
  commit: bf8ec00b
  date: 2026-06-03
---

# BUG-260603-01: Chat send intermittently does nothing (silent drop)

## What we observed

Operator (during the 093 D-21 re-UAT, 2026-06-03): "Sometimes we send a chat and it does not fire at all — nothing happens and the chat stays as if nothing happened. This is not related to workflows but it happens sometimes."

Independently corroborated during Chrome-MCP automation: on **freshly created/switched threads**, two sends did not register — the prompt + workflow pick stayed staged, the composer cleared/reset, no run was created (no `workflow_runs`/`runs` row, no streaming indicator). Re-issuing the send (type → confirm Send enabled → click the Send button) worked. In automation the trigger was `type_text` + Enter immediately after a thread switch; for a human typing naturally the cause may differ.

## Why it matters

A send that silently no-ops is a trust/usability defect: the user believes they asked a question and gets nothing, with no error or feedback. Low frequency but high annoyance; erodes confidence in the chat surface (the product's primary interface).

## Hypothesized cause

(Hypothesis, not verified.) A race on a freshly-selected/created thread: the composer's `value`/`selectedWorkflowId`/thread-binding state hasn't settled when the submit fires, so `handleSend` runs against a not-yet-ready thread context and is dropped without surfacing an error. Possibly the same window where the welcome→thread transition or the per-thread reconcile is in flight. NOT harness-specific (occurs on the general/Deep chat path).

## Surface classification

`Agentic-RAG` — this app's chat composer/send path. General chat (not the harness/workflow path), so out of Phase 093 scope.

## Suggested routing

- **Fold into in-flight phase:** n/a (093 closed; this is general chat, not harness)
- **Defer to future phase / milestone:** candidate for Phase 094/095 chat-surface work, or a standalone `/gsd:quick` once reproduced
- **Plant as seed:** n/a
- **External — note only:** no

## Workarounds

Re-send the message (it works on the second attempt). Type into the composer and confirm the Send button is enabled before pressing Enter.

## Reference / evidence links

- Surfaced during 093-HUMAN-UAT.md D-21 re-UAT (operator observation #5 + Claude automation notes, 2026-06-03).

## Investigation (2026-06-06 — 10-agent code-path workflow + adversarial verification)

A second operator report on 2026-06-06 ("start a chat, immediately click New Chat, submit in the 2nd chat → never sends; works in a 3rd chat") triggered a full code-path investigation. It found **TWO distinct mechanisms** behind the "silent drop" symptom — the synthesis initially conflated them; an adversarial verifier (grounded in this report's own signature) split them apart:

1. **Global single-send mutex (DOMINANT — explains the 2026-06-06 manual report).** `StreamsProvider.tsx` uses a single, un-keyed `isSendingRef` (decl ~:973). `sendMessage` hard-early-returns at `if (isSendingRef.current) return` (~:1415) BEFORE any optimistic bubble or POST, sets it true (~:1416), and clears it at exactly ONE site — the `finally` (~:1660) that runs only after the blocking `await subscribeToRun` (~:1627) reaches a terminal. So the gate stays shut for chat #1's **entire run**; any second send (e.g. in a new chat) is silently dropped — no POST, no run row, no bubble, no error — and `MessageInput` clears the text synchronously (`MessageInput.tsx:126-127`). The "3rd chat works" is timing, not position: it's simply the first send after chat #1's run terminated and reopened the gate. This is the **un-migrated twin of BUG-260523-01** — Phase 075.4 made the streaming *indicator* per-thread (`streamingThreads` Set) but left the send-*dispatch* mutex global, so the composer LOOKS ready on Thread B while the engine is globally busy. Backend ruled out (run buffer is shared Redis `run:{run_id}` via XREAD — cross-worker safe; POST returns 201 regardless of agent outcome).

2. **Fresh-thread reconcile-vs-send race (this report's ORIGINAL automation signature — fresh thread, no concurrent stream, retry-works, "no run created").** `ChatArea.handleSend` on a fresh thread does `await onCreateThread` → `setViewingThread` (fires reconcile→getSnapshot, which replaces the bucket and preserves optimistic temps only if `isSendingRef.current && streamingThreadIdRef.current===threadId` @~:1182) → `await sendMessage` (sets those flags only at ~:1416). The ordering/closure on a fresh thread can leave the placeholders unprotected / the submit racing the not-yet-settled thread context. One-shot race → an immediate manual retry succeeds (exactly this report's "works on the 2nd attempt"). The global mutex CANNOT explain retry-works-while-blocker-unchanged, so this is a separate defect.

## Fix (2026-06-06) — mechanism #1 FIXED at the root (true parallel sends); mechanism #2 deferred

**Decision history:** a zero-risk `busyElsewhere` composer gate was built first (disable Send while any thread streams + honest hint), but live UAT clarified the operator's real intent — a **professional, Claude.ai/ChatGPT-class app must run chats concurrently**, and one-send-at-a-time isn't acceptable. So the gate was **superseded and removed**, and the root fix shipped instead.

**Shipped — true concurrent chats (SEED-055 PART 1):** the global send mutex in `StreamsProvider.tsx` (`isSendingRef` boolean + single-slot `streamingThreadIdRef`) was replaced by a **per-thread** `sendingThreadsRef` (`Set<threadId>`); `streamingThreadIdRef` was eliminated (all readers re-expressed per-thread). The send guard now blocks only a re-send into a thread *already* sending — a send into a **different** thread dispatches and streams **concurrently**, so mechanism #1's silent drop is **gone at the root** (the send now actually works instead of being dropped or gated). Provider-agnostic — only the dispatch/guard/refs layer changed; the per-token SSE/chunk/provider path is byte-identical for all 8 providers. **Verified:** live two-concurrent-streams (chat #2 dispatched + answered while chat #1's long review streamed); 4-lens adversarial review `wf_066123d6-4d5` (0 defects; BUG-260521-01 wipe protection *strictly stronger* per-thread); git-stash test parity (17/17 baseline, **zero net-new**); tsc baseline 37; vite build 0.

**Why status stays `open`:** mechanism #2 (the fresh-thread reconcile race — this report's original automation signature, which fires with NO concurrent stream) is a **separate** defect not directly closed by the per-thread send change. It + the composer-clear text safety net + the `stoppedByUserRef`-per-thread cosmetic fix remain tracked under **SEED-055** (residuals 2–5). Re-route mechanism #2 there. Flip this report to `closed` only when the fresh-thread no-stream silent-drop is verifiably gone.

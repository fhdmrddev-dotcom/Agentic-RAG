---
id: BUG-260530-01
title: 15-30s thread-switch hang under multiple concurrent streams — HTTP/1.1 6-connection-per-host cap saturated by one held-open streaming fetch per active run
reported: 2026-05-30
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [frontend/streaming, frontend/navigation, frontend/StreamsProvider, backend/serving, concurrency]
folded_into: "096"
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: v2.5-dev
  commit: d87047c1
  date: 2026-05-30
---

# BUG-260530-01: 15-30s thread-switch hang under multiple concurrent streams (connection saturation)

> **Distinct from BUG-260513-01.** That one is the 200-800ms blank-window fetch latency (no loading indicator), folded into Phase 068.5 (v2.6). THIS one is a 15-30s hard stall that only appears when several runs stream concurrently — a different mechanism (browser connection-pool saturation), a different magnitude, and a different fix.

## What we observed

User report (verbatim): "when I navigate to other chats while a task is ongoing, it is not responding or show load some other chats, the backend is normal no errors but it is being stuck for like 15-30 seconds before it loads everything in one go."

Live investigation (Chrome DevTools, 2026-05-30):
- The frontend talks **directly to `localhost:8000`** (the backend), a different origin from the `:5173` UI.
- It opens one long-lived streaming `fetch` (`GET /runs/{run_id}/stream`) **per active run**, held in `StreamsProvider`'s `subscriptionsRef = Map<runId, AbortController>` and cleaned up **only on the run's terminal state** (`agent_loop`/`onTerminal` paths) — so background runs keep streaming across thread switches.
- A **single** active stream + thread switch was clean (the destination thread's `/snapshot`+`/messages`+`/todos`+`/workspace/files` GETs all returned 200 immediately). The hang requires the connection pool to be saturated.
- Backend serves **HTTP/1.1** (`server: uvicorn`, request `connection: keep-alive`; uvicorn has no native HTTP/2). Chrome caps **6 concurrent connections per host**. The "loads everything in one go after 15-30s" signature is textbook connection-pool queueing: new requests wait in the browser (never reaching the backend → "no errors") until a long-lived stream ends and frees a slot.

## Why it matters

- **Major.** With ~6 concurrent active runs (plausible for a user running many parallel eval/chat threads), every navigation's reconcile fetches queue behind the held-open streams for the duration of a stream (15-30s+). The app feels frozen, with no error to explain it.
- It's the **same substrate the harness streams over** — Phase 094's panel phase-timeline rides the existing `run:{run_id}` stream, so the saturation would also throttle harness UIs.
- It's the **CONC-01 / parallel-thread (SC#10) guarantee** in spirit: a busy thread must not block another thread's responsiveness.

## Hypothesized cause

CONFIRMED (code + live + protocol evidence), not hypothesis: HTTP/1.1 6-connection-per-host limit to `localhost:8000` × one persistent streaming `fetch` per active run (kept open across thread switches until terminal). N≥~6 concurrent streams saturate the pool; the next navigation's GETs queue until a stream frees a slot.

Evidence:
- `frontend/src/providers/StreamsProvider.tsx:754` — `subscriptionsRef = useRef<Map<string, AbortController>>`; `:959` dedup keeps one subscription per run; `:1044/:1077/:1243` delete only on `onTerminal`.
- `frontend/src/lib/api.ts:407` — streaming via `fetch` + `res.body.getReader()` (one connection per stream).
- Live: single-stream switch clean; `connection: keep-alive` + `server: uvicorn` ⇒ HTTP/1.1.

## Surface classification

**Agentic-RAG.** Frontend streaming + serving concern in this app. Routing applies per CLAUDE.md MANDATORY rule.

## Suggested routing

- **Fold into:** **Phase 096 (Eval Harness + Cross-Provider Verification + Concurrency)** — same parallel-thread/CONC-01 guarantee; fix once on the streaming substrate the harness builds on. **(Operator decision 2026-05-30.)**
- **Chosen fix approach (operator-selected 2026-05-30):** **Frontend — cap concurrent live streams.** Keep only the actively-viewed thread's stream open (plus a small bounded pool); background runs reconcile via the existing `GET /threads/{id}/snapshot` on return (aligns with D-v2.5-03 reconcile-on-connect) instead of each holding a live connection. Rejected alternatives: single multiplexed session transport (bigger substrate change), HTTP/2 serving (infra/dev-story change). Trade accepted: background threads update on return, not live-while-away.
- **Guardrail note:** `StreamsProvider` is a hot-file-ledger file (G-5 satisfied @075.7). The fix MUST carry the SC#10 4-axis parallel-thread UAT and preserve PANEL-06 isolation + the per-thread demux + reconcile.

## Workarounds (until fixed)

- **User-side:** Let long-running tasks finish (or Cancel them) before opening many other chats; avoid keeping 6+ tasks streaming at once.

## Reference / evidence links

- Quick task 260530-wjp (cross-provider native-tools fix, same session): `.planning/quick/260530-wjp-infer-native-tools-for-deepseek-moonshot/`
- Related (distinct) bug: BUG-260513-01 (`thread-switch-blank-state-load-latency.md`) — fetch-latency blank window, folded into 068.5.
- Mechanism confirmed via Chrome DevTools network + `performance` resource timing, 2026-05-30 session.

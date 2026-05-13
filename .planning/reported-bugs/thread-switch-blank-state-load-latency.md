---
id: BUG-260513-01
title: 200-800ms blank chat surface on thread switch + occasional load failure on page nav (no loading indicator, no cached-content fallback)
reported: 2026-05-13
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [frontend/chat-surface, frontend/streaming, frontend/navigation, UX/loading-states]
folded_into: "068.5"
related_seeds: [SEED-007]
re_open_trigger: null
reproduces_on:
  branch: v2.5-dev
  commit: bd6f68b
  date: 2026-05-13
---

# BUG-260513-01: 200-800ms blank chat surface on thread switch (no loading indicator)

## What we observed

During Phase 068 Chrome MCP UAT (re-run with `Anthropic + claude-opus-4-6` after the original `gpt-5.4` run 403'd), timed the chat surface on thread-switch:

| Action | Sample window | mainText length | Visible content |
|--------|---------------|-----------------|-----------------|
| Switch A → X (mid-stream) | t+50ms  | 338 chars  | chrome only (header + composer); messages blank |
| Switch A → X (mid-stream) | t+850ms | 38,310 chars | full dissertation thread rendered |
| Switch X → A | t+50ms  | 313 chars  | chrome only; messages blank |
| Switch X → A | t+200ms | 313 chars  | still chrome only |
| Switch X → A | t+500ms | 2,559 chars | essay + suggestion pills + prior error rendered |
| Switch X → A | t+1500ms | 2,559 chars | stable |

The blank window is **200–800ms** depending on the destination thread's message count and backend round-trip latency. During the window, only the page chrome (sidebar + composer + provider/model selectors) renders — the message list area shows nothing, no skeleton, no spinner.

User-observed during my UAT run: "it did not load immediately but it was loaded after the stream finishes". The user noticed the blank window without being primed for it.

## Why it matters

- Severity: **minor**. Feature works correctly — bucket survives the switch (Branch D-3 guard at `streamsStore.ts:clearThreadBucket` holds), content renders once the API responds. The bug is purely UX: there is no signal to the user that a load is in progress, which makes the app feel "broken for a moment."
- Affects every thread switch — the most common chat action — so the cumulative annoyance compounds.
- Particularly noticeable when switching to a thread with many messages (Thread X with 38KB took ~800ms vs Thread A with 2.5KB taking ~500ms).
- Does NOT cause data loss; the streaming bucket is protected by Phase 067.5's Branch D-3 guard (preserved verbatim through Phase 068's lift). The empty-thread-until-refresh bug from Phase 067.5 is NOT re-occurring.

## Hypothesized cause

The chat surface re-render sequence on thread switch is:
1. `setViewingThread(X)` fires (provider action)
2. `clearMessages(previousThread)` runs (gated by Branch D-3 — proceeds only if `streamingThreadIdRef.current !== prev`)
3. `loadMessages(X)` fires `GET /threads/X/messages` (async)
4. API responds (network round-trip — typically 200–800ms locally, more on slow networks)
5. Bucket populated → `useThreadMessages(X)` selector returns the new array → ChatArea re-renders

Between steps 2 and 5 the bucket for thread X is empty. The message-list component renders nothing during this window (no `isLoading` state, no skeleton). The chrome (sidebar, composer, model selector) is unaffected because it lives outside the message-list subtree.

**Why this is pre-existing, not a Phase 068 regression:**
- Pre-Phase-068, the same fetch-then-render sequence happened inside `useMessages.ts` (which owned `loadMessages`); the blank window was the same.
- Phase 068 lifted `loadMessages` to the provider but the contract is identical — still async, still no intermediate loading state.
- Phase 067.5 fixed the WORSE case where the bucket stayed empty FOREVER until F5; the load-latency window has always existed as part of the normal switch path.

## Surface classification

**Agentic-RAG.** This is a frontend UX issue in this app's chat surface, not an external provider or platform concern. Routing applies per CLAUDE.md MANDATORY rule.

## Suggested routing

- **Fold into in-flight phase:** n/a — Phase 069 (PdfExtractor abstraction) is backend-only, no overlap.
- **Defer to future phase / milestone:** **Candidate for active scoping in v2.6.** Natural homes: a new v2.6 frontend phase ("chat-surface persistent rendering"), or fold into Phase 081 (v2.6 polish phase if scoped) / a SEED-007 follow-up. v3.0 Skill Studio would be too late given user-reported impact.
- **Plant as seed:** Not needed — this report is the seed equivalent and now status=open with active routing candidacy.
- **External — note only:** no.

## Workarounds (prompt-side, code-side, or UI-side)

- **User-side:** None. Affects every thread switch + every navigation to a chat surface.
- **Code-side fix (scope expanded after 2026-05-13 update — see below):** Was previously "add `isLoading` flag + skeleton" (~20 LOC + 30 LOC test). Updated scope per user feedback is larger: persist last-rendered message snapshot across navigation, render it immediately on mount, then reconcile with `GET /threads/{id}/messages` once it returns. Display a streaming pulse / animated brand mark for in-progress (`status='running'`) assistant turns whose terminal hasn't arrived yet. Estimated rough scope: ~100-200 LOC plus tests; Chrome MCP UAT for the visual states. Specifics belong in the phase that picks this up.

## Reference / evidence links

- Phase 068 Plan 04 SUMMARY (Re-run addendum section): `.planning/phases/068-streamsprovider-context-lift/068-04-SUMMARY.md`
- Phase 068 VERIFICATION.md: `.planning/phases/068-streamsprovider-context-lift/068-VERIFICATION.md` (status: passed)
- Phase 067.5 (related — fixed the worse F5-required variant): `.planning/milestones/v2.5-phases/067.5-frontend-reconcile-fix/067.5-01-SUMMARY.md`
- SEED-007 (app-level streams provider — became Phase 068): `.planning/seeds/SEED-007-app-level-streams-provider.md`
- Chrome MCP timing evidence captured in commit `e68dea3` (UAT re-run addendum)

---

## Update 2026-05-13 — user re-opened, scope expanded

**Re-open trigger fired:** (d) any further user complaint about thread-switch feeling "broken" or "blank". User report verbatim:

> "we have some issues with latency or sometimes failure until chat loads when switching to another page or thread, maybe we want to show what is already loaded or the iterations that already finished and maybe show animated logo while the ongoing iterations finishes when ever we switch chat or refresh. this mimics the behaviour of claude."

### What this changes vs the original report

| Aspect | Original (2026-05-13 morning) | Updated (2026-05-13 evening) |
|---|---|---|
| Symptom scope | Thread → thread switch only | Thread switch **and** page navigation **and** page refresh |
| Failure mode | Always renders eventually after blank window | **Sometimes outright fails to load** until manual refresh |
| Severity | minor (cosmetic) | **major** (every chat surface entry; sometimes blocking) |
| Fix scope | Single skeleton/spinner | Two parts: (a) persistent cached render, (b) in-flight pulse for un-terminated turns |

### Proposed UX direction (mimics Claude.ai)

1. **Render last-known-good immediately on mount.** When user switches to a thread or navigates to a chat page, paint whatever is in the persisted client cache (the messages already in the StreamsProvider bucket, or a localStorage / session-scoped snapshot if the bucket is empty post-reload). No blank window — the user sees yesterday's conversation, then it updates as the fetch completes.
2. **Reconcile in the background.** `GET /threads/{id}/messages` fires in parallel with the immediate render; results merge per the existing Phase 067.5 Branch D-3 guard (no clobbering streaming buckets). If the server returns fresh data, the cache reconciles silently.
3. **Animated pulse / brand mark for un-terminated turns.** Any assistant message whose `runs.status` is `running` or `queued` (and whose terminal SSE event hasn't been replayed yet) renders with a soft pulse / breathing animation on the agent's brand mark — same pattern Claude.ai uses for "currently writing" turns. This is the visual cue that "the iteration is still in progress, not stuck."
4. **Hard-failure surfacing.** If the fetch ultimately fails (network, 404, auth), show an inline retry affordance over the cached content rather than blanking out. The cached content keeps the user oriented; the retry button keeps them unblocked.

### Why this is bigger than the original "add a spinner" fix

- A spinner during the blank window solves the *blank* problem but not the *failure* problem. If `GET /threads/{id}/messages` returns 500 or hangs, a spinner spins forever.
- Persistent rendering needs a cache strategy: in-memory (StreamsProvider bucket persists across navigations via the Phase 068 lift — partial win), localStorage (survives F5), or a service-worker (survives offline). User implied F5 / refresh resilience — localStorage feels like the minimum bar.
- The pulse-for-in-flight UX needs `runs.status` to be readable client-side at message-render time. Today the run state lives in the SSE stream and the `runs` row; need to confirm the bucket's `Message` shape carries enough state to gate the pulse (likely yes via `runId` + a separate `useRunStatus(runId)` selector).

### Candidate routing in v2.6

- **Option A — new dedicated phase in v2.6** ("chat-surface persistent rendering + in-flight pulse"). 2-3 plans. Honest scope.
- **Option B — fold into Phase 069 discuss/plan now.** Rejected — Phase 069 is backend PDF extraction, zero overlap, would dilute scope.
- **Option C — wait for v3.0 Skill Studio.** Rejected — user-reported impact is current, not future.
- **Option D — quick win first (skeleton + retry button, no caching).** ~30 LOC. Closes the cosmetic part of the bug without solving the "sometimes fails" or "show what's already loaded" parts. Could ship as a small-scope phase quickly, with the full caching/pulse work tracked separately.

User decision pending on routing. Default recommendation: Option A in v2.6 if there's phase budget, else Option D as a stopgap with Option A planted as a SEED for v2.7+.

### Updated re-open trigger

Now superseded — status is `open`. When the chosen routing phase is picked, set `folded_into: NNN` and flip to `folded`. If the fix ships verifiably, flip to `closed` at `/gsd:complete-milestone`.

### Routing decision 2026-05-13 (Option A)

Folded into **Phase 068.5: Chat-Surface Persistent Rendering + In-Flight Pulse** (mid-milestone amendment to v2.6). REQ-ID `CHAT-RESILIENCE-01`. 2 plans (placeholder; refined at `/gsd:discuss-phase 068.5`). Phase added to `.planning/ROADMAP.md` Wave 0 between 068 and 069 (no dependency conflicts; runs parallel with 069+). `CHAT-RESILIENCE-01` added to `.planning/REQUIREMENTS.md` Theme C alongside `STREAMS-PROVIDER-01`. PRD v2.6 §4 amendment recommended (still says "21 Active REQs"); user discretion.

**Lifecycle from here:**
- `folded` (now) → `closed` at `/gsd:complete-milestone` after Phase 068.5 verify-work confirms all 6 SCs green via 5/5 lived-experience UAT cycles (mirroring Phase 067.5's lived-experience precedent that closes STREAM-04-correctness lineage).

### New affected area added

`frontend/navigation` — page-route changes (sidebar nav clicks, deep-links, F5) also trigger the symptom, not just intra-chat thread switches.

---
id: BUG-260513-01
title: 200-800ms blank chat surface on thread switch (no loading indicator)
reported: 2026-05-13
surface: Agentic-RAG
severity: minor
status: deferred
affected_areas: [frontend/chat-surface, frontend/streaming, UX/loading-states]
folded_into: null
related_seeds: [SEED-007]
re_open_trigger: |
  Re-open when any of the following fire:
  (a) a v2.6+ phase touches `ChatArea.tsx` thread-id-change useEffect or `StreamsProvider.tsx` setViewingThread action — fold the loading-indicator fix in at that point;
  (b) Phase 073 (asyncpg pool) lands and benchmarks show the GET /threads/{id}/messages round-trip becomes faster or slower — re-time the blank window and decide whether the indicator is still needed;
  (c) any future v2.6/v2.7 chat-UX milestone (Skill Studio v3.0, Operator UX v3.1) — bundle the loading-state polish with related UX work;
  (d) any further user complaint about thread-switch feeling "broken" or "blank";
  (e) a regression: the blank window grows past 1.5s (suggests load-fetch path is no longer bounded by network latency).
reproduces_on:
  branch: v2.5-dev
  commit: 1beded1
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

- **Fold into in-flight phase:** n/a — Phase 068 closed on 2026-05-13 without this fix because it's pre-existing (not a 068 regression) and would expand scope.
- **Defer to future phase / milestone:** v2.6 polish or v3.0 Skill Studio (whichever phase next touches `ChatArea.tsx` or the thread-switch path). Natural fit: bundle with any future loading-state work or chat-surface UX refresh.
- **Plant as seed:** Not needed — captured here as a bug report with concrete re-open trigger; surfaces at GSD touchpoints automatically.
- **External — note only:** no.

## Workarounds (prompt-side, code-side, or UI-side)

- **User-side:** None. The blank state is brief enough that most users will just wait it out.
- **Code-side fix (when triggered):** Add `isLoading` flag to `loadMessages` action in `StreamsProvider.tsx`. Render a skeleton or spinner in the message-list area while `isLoading === true`. Estimated diff: ~20 LOC + ~30 LOC test, single atomic commit. The skeleton component could reuse existing shadcn/ui patterns from the document list or library health pages.

## Reference / evidence links

- Phase 068 Plan 04 SUMMARY (Re-run addendum section): `.planning/phases/068-streamsprovider-context-lift/068-04-SUMMARY.md`
- Phase 068 VERIFICATION.md: `.planning/phases/068-streamsprovider-context-lift/068-VERIFICATION.md` (status: passed)
- Phase 067.5 (related — fixed the worse F5-required variant): `.planning/milestones/v2.5-phases/067.5-frontend-reconcile-fix/067.5-01-SUMMARY.md`
- SEED-007 (app-level streams provider — became Phase 068): `.planning/seeds/SEED-007-app-level-streams-provider.md`
- Chrome MCP timing evidence captured in commit `e68dea3` (UAT re-run addendum)

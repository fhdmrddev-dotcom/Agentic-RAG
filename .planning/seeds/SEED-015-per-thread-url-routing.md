---
seed_id: SEED-015
title: Per-thread URL routing — F5/deep-link returns to the same thread instead of the landing screen
created: 2026-05-14
status: planted
priority: medium
re_open_triggers:
  - User explicitly asks for "share a link to this conversation" / deep-link UX
  - User reports being "kicked out" of their thread after F5 / browser refresh
  - PRD scope for v3.x adds collaboration / shared-thread features (URL becomes the share primitive)
  - SC#5 paint-timing target (≤100ms cached paint on F5) becomes a binding gate and the rescoped cache (Option C, streaming + active only) needs the "active" identity to survive F5 — which requires the URL to carry the thread_id
  - Multi-tab UX comes back as a priority (currently deferred per BUG-260513-01 deferred ideas)
relates_to:
  - .planning/phases/068.5-chat-surface-persistent-rendering-in-flight-pulse/068.5-VERIFICATION.md F-068.5-A (origin of this seed)
  - BUG-260513-01 (thread-switch-blank-state-load-latency) — the cache substrate already exists; routing is the missing half of the F5-resilience UX
  - Phase 068.5 D-068.5-01..04 — localStorage cache decisions
  - .planning/PRDs/v2.7.md (Agent Workspace milestone — likely owner if this lands then)
  - .planning/PRDs/v3.0.md (Skill Studio milestone — surface-agnostic story)
---

# Per-thread URL routing — F5/deep-link returns to the same thread

## Origin

Promoted from F-068.5-A in `068.5-VERIFICATION.md` after a user-observation 2026-05-14: "currently, routing stay on the same base url, does not change upon the navigation to other threads or pages, not sure if this should be changed or maintained the same for future and during production".

## The architectural question

Today the app has no per-thread URL routing. The active thread lives entirely in component state. Concrete consequences:

- **F5 always lands on `/` (landing screen)**, never on the thread the user was just in.
- **No deep-link** to share a specific conversation.
- **No browser-back to previous thread.**
- **The Phase 068.5 cache substrate (Option C — `streaming + active` threads only) cannot deliver the literal SC#5 UX** ("F5 → cached paint within 100ms of route-render → reconcile within 1s") because after F5 there's no "active thread" identity to map the cache hit against — the user has to click their thread again.

## Why we deferred it

The Phase 068.5 SC#5 spec assumed URL routing. The phase rescoped to "F5 → click thread → cached paint" once we noticed routing was missing. That was the right scope discipline for Phase 068.5 (it's a chat-resilience phase, not a routing-redesign phase). But the question of "should we add per-thread routing for production?" is real and ripe.

## What it would take

**Minimal scope (just deep-link / F5 retention):**

1. Adopt `react-router-dom` (or compatible) in the SPA shell.
2. Route shapes: `/`, `/c/:threadId`, `/skills`, `/documents`, `/settings`, etc.
3. `setViewingThread(id)` pushes a route navigation; route-driven `useEffect` mirrors back into the store.
4. F5 on `/c/:threadId` reads the route, hydrates the active thread from cache (Option C predicate works because `activeThreadId === route.threadId`), reconciles in background.
5. The Phase 068 D-068-04/05 surface-agnostic Streams Provider already keys by `SurfaceId` so route → surface → bucket lookup is a one-liner.

**Considerations:**

- **Surface routing.** Future v3.0 eval-pane second surface (per D-068-04) means routes need to include surface, not just thread: `/s/:surfaceId/c/:threadId`. Get this shape right at first land.
- **Auth gates.** Routes for threads the user doesn't own should redirect (the backend RLS already enforces, but a clean 404 / redirect is the UX surface).
- **Backward compat.** Existing in-app navigation (sidebar clicks, "New Chat" button) needs to keep working — the route migration shouldn't disrupt established flows.

**Out-of-scope for the minimal seed:** shareable / collaborative threads (cross-user URL sharing), multi-tab sync, "preview an external link inside a thread" UX — those are downstream of having routing at all.

## Suggested routing for this seed

- **v2.6 (current milestone):** out of scope. Don't disrupt the locked phase plan. Phase 075 (SEED-008 + tool_args_progress polish bundle) is adjacent but distinct — routing isn't a polish item, it's an architecture choice.
- **v2.7 (Agent Workspace milestone, per `.planning/PRDs/v2.7.md`):** strong candidate. The "workspace" framing implies users land on a specific workspace state; URL routing is the natural primitive. If Agent Workspace ships, routing should ship with it.
- **v3.0 (Skill Studio milestone):** if v2.7 doesn't pick it up, v3.0 is the next opportunity. The eval-pane second surface forces the issue.

## What flipping this seed back to `active` looks like

Re-open trigger fires → create a phase like "Phase NNN: Per-thread URL routing" with these acceptance criteria:

1. F5 on `/c/:threadId` returns the user to the same thread with cached content paint < 100ms (production build).
2. Sidebar click on thread T routes to `/c/T`; the URL becomes the source-of-truth for `activeThreadIdRef`.
3. Browser back/forward navigates thread history correctly.
4. Phase 068.5 cache (Option C — streaming + active) hydrates the active thread from cache on route-render BEFORE reconcile resolves.
5. Surface-aware route shape (`/s/:surfaceId/c/:threadId`) future-proofs for v3.0 eval pane.
6. The Phase 068 debug overlay (StreamsBucketDebug) and other dev-only UI is properly gated and doesn't appear on routed pages in production.

## Non-blocking note

This seed is NOT a blocker for any current phase. The Phase 068.5 cache substrate works correctly without it (in-app navigation is fully covered). Capturing the seed avoids the "we'll forget about routing" failure mode that produces an architectural cliff at the v2.7 / v3.0 boundary.

# Phase 068: `<StreamsProvider>` Context Lift - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-12
**Phase:** 068-streamsprovider-context-lift
**Areas discussed:** State store choice, Provider API shape, Multi-consumer bucket model, Reconcile listeners location

---

## State Store Choice

| Option | Description | Selected |
|--------|-------------|----------|
| Zustand (Recommended) | Tiny ~1KB external store designed for exactly this pattern. Selective subscription means the eval pane doesn't re-render when chat thread's messages update (and vice versa). Solves the multi-consumer re-render problem the whole lift exists to enable. Battle-tested, no boilerplate. Slight cost: one new frontend dep. | ✓ |
| React Context + useState/useRef | SEED-007's original sketch — zero new deps, matches the codebase's existing pattern. Works for correctness (SC#3 'no state collision' passes). Downside: every consumer of the provider re-renders on every state change. Fine with 1-2 consumers, gets noisy if v3.0+ adds more panes. | |
| useSyncExternalStore + custom store | Modern React 18 primitive, no new dep. Same selective-subscribe behavior as Zustand but you hand-roll the store + subscribers. More code in this phase, but nothing to add to package.json. | |
| You decide | Claude picks based on the tradeoffs (likely Zustand). | |

**User's choice:** Zustand (Recommended).
**Notes:** Selection aligned with the user's prior "don't default-hedge to no-new-infra when cost is ~$0" preference and the "scale-ready defaults" project guidance. Selective subscription is exactly what the multi-consumer lift enables; rolling our own with `useSyncExternalStore` was rejected for reinventing the wheel.

---

## Provider API Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Named hooks per concern (Recommended) | Wrap the Zustand store in named hooks: `useThreadMessages(threadId)`, `useStreamActions()`, `useStreamSubscriptions(runId)`, `useViewingThread()`. Callers don't write selectors — they call a hook that returns just what they need. Re-render scope is tight (each hook subscribes to its slice). Friendliest API and what existing useMessages callers will recognize. | ✓ |
| Raw Zustand selectors only | Expose `useStreamsStore` directly. Each call site writes its own selector. Maximum flexibility, no wrapping layer, but every call site has to know about Zustand internals. | |
| Single drop-in `useStreamsContext()` | One hook returns an object with everything useMessages used to expose. Closest to drop-in replacement, but defeats Zustand's selective-subscription point (returned object identity changes on every store update). | |
| You decide | Claude picks (likely named hooks). | |

**User's choice:** Named hooks per concern (Recommended).
**Notes:** Selection chose ergonomics + perf hygiene over flexibility-for-flexibility's-sake. Mirrors the named-function API useMessages exposes today.

---

## Multi-Consumer Bucket Model

| Option | Description | Selected |
|--------|-------------|----------|
| Generic surface_id keying (Recommended) | Store holds `bucketsBySurface: Map<surface_id, Map<thread_id, Message[]>>`. Chat surface_id is 'chat' (default); eval pane's is 'eval'; future admin-watch surface is 'admin-watch'. Surfaces self-identify by ID. Scales to N surfaces without restructure. | ✓ |
| Two parallel Maps | Store holds `chatByThread` + `evalsByThread` side by side. Minimum diff, no new abstraction. v3.0 eval pane drops in. Downside: every additional surface needs another Map added to the store. | |
| Per-run sub-buckets (SEED-007 vision) | Store holds `messagesByRun: Map<run_id, Message[]>` at top level; per-thread view is a derived selector. Closest to SEED-007's original sketch. Biggest diff and PRD's "per-thread bucket invariant survives" lock argues against re-litigating this now. | |
| You decide | Claude picks (likely generic surface_id keying). | |

**User's choice:** Generic surface_id keying (Recommended).
**Notes:** Surface-agnostic shape selected to match the user's scale-ready preference. Per-run sub-buckets explicitly deferred — re-open trigger captured in CONTEXT.md `<deferred>`.

---

## Reconcile Listeners Location

| Option | Description | Selected |
|--------|-------------|----------|
| Move into provider (Recommended) | Provider attaches visibilitychange/focus/pageshow listeners on mount and calls reconcile internally. ChatArea's listener block deletes. Future surfaces get reconcile-on-resume for free. Matches SEED-007's Wave 3 entry plan and fits the 4-plan ROADMAP budget (Plan 3 = listener lift). | ✓ |
| Keep in ChatArea | ChatArea keeps the listener block but calls `useStreamActions().reconcile()` instead of `reconcileRef.current()`. Minimum diff to ChatArea. Downside: future surfaces would need to duplicate the listener wiring (anti-pattern SEED-007 warns against). | |
| You decide | Claude picks (likely move into provider). | |

**User's choice:** Move into provider (Recommended).
**Notes:** Listener-block deletion in ChatArea + auto-attach in provider is a clean separation; aligns with SEED-007's Wave 3 entry plan.

---

## Final Wrap-up

**Question:** "We've decided store choice, API shape, bucket model, and listener location. Anything else gray?"
**User's choice:** "I'm ready for context" — proceeded directly to CONTEXT.md write.

---

## Claude's Discretion

Documented in CONTEXT.md `<decisions>` § Claude's Discretion:
- Exact App.tsx wrap location (above/below auth gate / router)
- Whether to rename `useMessages` → `useChatMessages` (rename optional, kept-name fine)
- Exact Zustand store layout (single slice vs sliced — likely single)
- Whether `SurfaceId` is a string alias or branded type (string alias for v2.6)
- `<DevTwoPaneMock>` component shape (full MessageList render vs stub)
- Mock second surface's `surfaceId` value ('mock-eval' for tests)
- Exact action layout in Zustand store

## Deferred Ideas

Documented in CONTEXT.md `<deferred>` with concrete re-open triggers:
- Per-run sub-bucket model `Map<run_id, Message[]>` — SEED-007's original vision; deferred because of PRD's per-thread invariant lock
- Single `useStreamsContext()` mega-hook — defeats selective subscription
- Plain React Context + useState/useRef — perf-inferior to Zustand
- Reconcile listeners staying in ChatArea — would force future surfaces to duplicate wiring
- `<StreamsProvider>` above the auth gate — no current use case for cross-auth-session state
- `useSyncExternalStore` + custom store — reinvents Zustand's wheel for ~1KB
- Renaming `useMessages` → `useChatMessages` — discretionary during Plan 2

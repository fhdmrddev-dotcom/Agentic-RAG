---
id: SEED-007
status: closed
closed: 2026-05-27
closed_by: 082-cross-cutting-verification-extraction-telemetry
planted: 2026-05-04
planted_during: v2.5 (Phase 063.1 discuss-phase — Frontend Stream Decoupling Gap Closure)
trigger_when: planning a milestone that introduces split-view, multi-pane, or background-thread UI surfaces — OR any milestone that keys ChatArea on something other than thread.id — OR Skill Studio (concurrent eval-run streaming next to a thread)
scope: Medium
closure_note: "Fully consumed by Phase 068 (StreamsProvider Context Lift). SSE subscriptions, per-thread message buckets, and streamingThreadIdRef all lifted to top-level StreamsProvider. Multiple consumers can read the same run buffer. Branch D-3 guard preserved verbatim."
---

# SEED-007: App-level Streams Provider

## Why This Matters

Phase 063.1 closed the frontend run-backed streaming gaps with a **single message buffer** architecture: `messages` is one React state inside `useMessages`, scoped to the currently-viewing thread. Cross-thread bleed is prevented by `guardedSetMessages` + `activeThreadIdRef` rather than by separating buffers.

This works **as long as the UI shows one thread at a time**. The moment the UI surfaces concurrent streams — split-view, eval runs streaming alongside chat, multi-pane Skill Studio, "preview" panes that subscribe to a different run — the single-buffer assumption breaks.

When that pressure arrives, the right move is to lift `subscriptionsRef`, `lastSeenOffsetRef`, and the per-run message buffer out of `useMessages` and into a top-level `<StreamsProvider>` Context. SSE survives ChatArea remount entirely. Multiple consumers can read the same run's buffer. The hook becomes a thin reader of the provider.

This was deliberately **deferred** in 063.1 — single-buffer was the smaller diff and there's no current driver for the bigger refactor (D-063.1-06). But it's a known cliff. Don't let a future milestone trip into it cold.

## When to Surface

**Trigger:** planning a milestone that needs concurrent stream rendering, OR keys ChatArea on something other than thread.id, OR introduces multi-pane / split-view chat UI.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Milestone introduces a split-view, multi-pane, or side-by-side chat surface
- Milestone needs to render eval/skill execution streams concurrently with chat (SEED-002 Skill Studio + `PRD_Skill_Studio.md` § eval streaming)
- Milestone redesigns ChatArea such that it gets keyed on `run_id`, eval-id, or anything other than `thread.id`
- Milestone needs SSE consumers to survive component remounts (e.g. modal-based chat inspectors)
- Milestone touches `useMessages.ts` to add a second concurrent-stream surface

## Scope Estimate

**Medium** — Single-phase architectural lift, primarily frontend:
- New `<StreamsProvider>` Context at App.tsx root
- Provider owns: `Map<run_id, AbortController>` (was `subscriptionsRef`), `Map<run_id, ms_id>` (was `lastSeenOffsetRef`), `Map<run_id, Message[]>` per-run buffer
- `useMessages` becomes a thin reader: subscribes to the provider's per-thread slice via `useStreamsContext()`
- `subscribeToRun` / `getActiveRuns` callers move to provider
- Cross-thread guards (`guardedSetMessages`, `activeThreadIdRef`) become provider-internal
- New consumers (eval pane, split-view) subscribe directly without going through `useMessages`

NOT in scope:
- Backend changes (the run-backed streaming API from Phases 061/062 is provider-agnostic)
- New persistence layer (offset cursors stay in-memory unless a separate decision adds storage)

## Breadcrumbs

**Phase 063.1 architectural decisions (the deferral source):**
- `.planning/phases/063.1-frontend-stream-decoupling-gap-closure/063.1-CONTEXT.md` § `<deferred>` "App-level Streams Provider"
- D-063.1-06: "Single message buffer architecture (no Context provider lift, no per-thread Map refactor)"
- D-063.1-08: `guardedSetMessages` lifted to sendMessage's callbacks — this pattern moves wholesale to the provider

**Code surfaces that move:**
- `frontend/src/hooks/useMessages.ts` — entire `subscriptionsRef`, `lastSeenOffsetRef`, `reconcileInFlightRef`, `activeThreadIdRef` machinery; `subscribeToRun` orchestration
- `frontend/src/components/chat/ChatArea.tsx` — reconcile triggers (mount + visibilitychange + focus + pageshow) move to provider; component reads from `useStreamsContext()`
- `frontend/src/App.tsx` — wrap with `<StreamsProvider>` near root (above any chat surface)

**Patterns from 063.1 that survive the lift unchanged:**
- `reconcileInFlightRef` boolean guard (D-063.1-11)
- `loadMessages` MERGE preserving `temp-${run_id}` placeholders (D-063.1-12)
- Backend LEFT JOIN on `runs.message_id` for runStatus (D-063.1-13)
- runId-match dedup (D-063.1-04)

**Cross-seed connections:**
- **SEED-002 (Skill Studio milestone prep)** — strongest trigger. PRD describes eval runs streaming alongside chat; that's the canonical use case for this lift.
- **SEED-001 (scale-readiness)** — if a future scale milestone introduces multi-tab admin views or live monitoring dashboards, the provider is also load-bearing there.
- **SEED-003 (deployment flexibility)** — orthogonal; doesn't trigger this seed.

**Why this matters for production / org-level scale (per `project_target_scale.md`):**
At thousands-of-users scale, support/admin tooling will likely need read-only "watch a user's stream" surfaces (debugging stuck runs, observing eval execution). Those are exactly the multi-consumer-per-run-buffer use cases the provider unblocks. The single-buffer architecture today doesn't paint this into a corner — but extending it to multi-consumer requires the lift.

## Notes

**Suggested entry plan when this seed surfaces:**

1. Confirm the triggering milestone genuinely needs concurrent streams or component-remount-survival. If not (e.g. just a styling redesign), this seed is a false positive — defer further.
2. As Phase 1 of the triggering milestone: lift the provider. ~3-5 plans:
   - Wave 1: New `<StreamsProvider>` Context with the existing maps lifted as state; provider mounts at App.tsx root.
   - Wave 2: `useMessages` rewrites as a thin reader; existing tests pin the public API.
   - Wave 3: Reconcile triggers move to provider; ChatArea's listener wiring deletes.
   - Wave 4: New consumer (eval pane, split-view) wires up as the second subscriber, proving the multi-consumer path.
3. Re-run all 063 + 063.1 e2e specs against the new architecture as regression guard.

**Why this is a seed and not a `<deferred>` line:**
063.1's CONTEXT.md captures it as deferred, but `<deferred>` items live inside one phase's directory and are easy to miss when planning a future milestone cold. Seeds are the cross-milestone surfacing mechanism — they fire at `/gsd:new-milestone` when their trigger matches. Per user preference 2026-05-04 (`feedback_preserve_all_deferred_ideas.md`), every cross-milestone idea gets a seed with a concrete trigger.

**Risk if this seed is missed:**
A Skill Studio milestone (or split-view redesign) that adds a second concurrent stream surface without the provider lift will end up either (a) duplicating subscriptionsRef + offset logic in a second hook (drift risk), (b) hard-coding cross-hook coordination via window globals or refs (anti-pattern), or (c) keying ChatArea on something other than thread.id without realizing it kills SSE on remount (regression of Gap-003 in a new shape).

**v2.5 context at planting time:**
- v2.5 milestone is in flight (phases 058-065)
- Phase 063 landed all 5 plans but blocked on 063.1 gap closure
- Phase 063.1 just locked decisions via discuss-phase (15 numbered decisions, single-buffer architecture chosen)
- Skill Studio milestone is the next-most-likely trigger (SEED-002 already planted; this seed pairs with it)

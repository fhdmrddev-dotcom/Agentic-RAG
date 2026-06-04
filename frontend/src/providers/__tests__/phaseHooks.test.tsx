/**
 * Phase 094 Plan 01 Task 3 — Wave 0 RED scaffold.  owner: Plan 02.
 *
 * Seeds the falsifiable INVARIANTS for the `phasesByThread` slice + the
 * `onPhase*` demux that Plan 02 lands in `streamsStore.ts` / `StreamsProvider.tsx`
 * / `api.ts`. The harness mirrors `panelHooks.test.tsx` (the raw-SSE → REAL
 * `subscribeToRun` → store integration backstop): partial-mock `@/lib/api` to
 * keep the REAL `subscribeToRun` + `makeStreamCallbacks`, overriding only the GET
 * helpers (incl. the new `getThreadWorkflow` reconcile floor).
 *
 * The two invariants below are `it.todo` until Plan 02 ships the slice/actions;
 * Plan 02 flips them to live assertions, replaying the Task-2 fixtures
 * (`fxPhaseLlmAgent`, `phase_started`/`phase_completed`/`run_failed`):
 *
 *   INV-1 (PANEL-09 reference-identity): a phase event MUST NOT change the chat
 *     bucket selector ref — `const before = bucketsBySurface`; replay
 *     `fxPhaseLlmAgent` through `subscribeToRun`; assert
 *     `expect(bucketsBySurface).toBe(before)` AND
 *     `phasesByThread.get(THREAD_A)` got the phase. (Mirror of panelHooks FC#1
 *     @292-313, swapping the workspace_file_written fixture for a phase fixture.)
 *
 *   INV-5 (cross-thread isolation, Pitfall 6 per-thread keying): replaying
 *     `phase_started` on THREAD_A's callbacks while THREAD_B has its own phases
 *     MUST leave THREAD_B's `phasesByThread` untouched (the demux default closes
 *     over the OWNING threadId, never the viewed thread / a global flag).
 */
import { describe, it } from "vitest"

// NOTE (Wave 0): production wiring (phasesByThread slice, onPhase* demux,
// getThreadWorkflow reconcile) does NOT exist yet — Plan 02 owns it. This file
// COLLECTS as `it.todo` placeholders so the suite registers each invariant; the
// full panelHooks-style harness (mockSseFetch + partial-mock @/lib/api keeping
// REAL subscribeToRun + makeStreamCallbacks + import fxPhaseLlmAgent from
// "@/test-fixtures/harness094") lands with the Plan-02 implementation.

describe("Phase 094 — phasesByThread demux (real SSE -> store)  [owner: Plan 02]", () => {
  it.todo(
    "INV-1 (PANEL-09): a phase event does NOT change the chat bucket selector ref; phasesByThread.get(THREAD_A) gets the phase (replay fxPhaseLlmAgent)",
  )

  it.todo(
    "INV-5 (Pitfall 6 isolation): phase_started on THREAD_A's callbacks leaves THREAD_B's phasesByThread untouched (per-thread keying)",
  )
})

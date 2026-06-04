/**
 * Phase 094 Plan 03 — shared harness-fixture replay helper for the render tests.
 *
 * The DATA-CONTRACT §7 fixtures (`@/test-fixtures/harness094`) are FLAT wire
 * `string[]` — the exact `_emit` producer frames. To keep the fixtures the single
 * source of truth (never re-author a Phase[] by hand) while testing the RENDERER
 * (PhaseTimeline / PhaseCard) rather than the demux, this helper replays a fixture
 * through the REAL `subscribeToRun` line parser + the REAL `makeStreamCallbacks`
 * demux into a freshly-reset store (the same integration path Plan 02 proved),
 * then reads the derived `phasesByThread` / `tasksByThread` slices back out.
 *
 * The render tests then mount the component with `usePhases`/`useTasks`/
 * `useViewingThread` mocked to return these REAL-normalizer-derived arrays — so a
 * test exercises the live wire→Phase[] mapping AND the component's a11y/render.
 *
 * NOTE: this is a `.tsx` so a consuming test can `vi.mock("@/providers/...")`; the
 * helper itself only touches the store + api, no JSX.
 */
import { vi } from "vitest"
import type {
  Todo,
  WorkspaceFile,
  PendingAsk,
  TaskRunIndexItem,
  Phase,
} from "@/types"
import { useStreamsStore } from "@/stores/streamsStore"
import {
  makeStreamCallbacks,
  StreamsProvider,
  useTodos,
} from "@/providers/StreamsProvider"
import { subscribeToRun } from "@/lib/api"
import { renderHook, act } from "@testing-library/react"
import type { ReactNode } from "react"

const ASSISTANT_ID = "assistant-replay"

/** SSE wire-byte reader (port of panelHooks.test.tsx:93-108). */
function mockSseFetch(chunks: string[], status = 200) {
  const encoder = new TextEncoder()
  const queue = chunks.map((c) => encoder.encode(c))
  const body = {
    getReader() {
      return {
        async read() {
          const next = queue.shift()
          if (next === undefined) return { done: true, value: undefined }
          return { done: false, value: next }
        },
      }
    },
  }
  return vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, body })
}

/** Reset the store so a replay starts from a clean per-thread Map set. */
export function resetStore() {
  useStreamsStore.setState({
    bucketsBySurface: new Map(),
    viewedThreadId: null,
    streamingThreads: new Set<string>(),
    fallbackNotices: new Map<string, string>(),
    reconcileErrors: new Map<string, Error>(),
    loadingThreads: new Set<string>(),
    subscriptionsByThread: new Map<string, Set<string>>(),
    todosByThread: new Map<string, Todo[]>(),
    workspaceFilesByThread: new Map<string, WorkspaceFile[]>(),
    pendingAsksByThread: new Map<string, PendingAsk[]>(),
    tasksByThread: new Map<string, TaskRunIndexItem[]>(),
    phasesByThread: new Map<string, Phase[]>(),
  })
}

export interface ReplayResult {
  phases: Phase[]
  tasks: TaskRunIndexItem[]
}

/**
 * Replay a fixture (flat wire `string[]`) through the REAL subscribeToRun + the
 * REAL demux into the store for `threadId`, and return the derived slices. The
 * provider must be mounted first (so the 14 real action bodies — incl. the 3
 * phase mutators — are registered); we mount a throwaway provider here.
 */
export async function replayFixture(
  threadId: string,
  fixture: string[],
): Promise<ReplayResult> {
  resetStore()
  // Mount the provider so the real action bodies are registered before SSE.
  renderHook(() => useTodos(null), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <StreamsProvider>{children}</StreamsProvider>
    ),
  })

  const cbs = makeStreamCallbacks({
    assistantId: ASSISTANT_ID,
    threadId,
    setMessages: () => {},
  })
  // Most fixtures already end with a terminal `done`; append a stream_end so the
  // reader always terminates cleanly (idempotent if a done was already present).
  const wire = [...fixture, 'data: {"type":"stream_end"}\n\n'].join("")
  vi.stubGlobal("fetch", mockSseFetch([wire]))
  await act(async () => {
    await subscribeToRun(`run-${threadId}`, "0", cbs)
  })

  const st = useStreamsStore.getState()
  return {
    phases: st.phasesByThread.get(threadId) ?? [],
    tasks: st.tasksByThread.get(threadId) ?? [],
  }
}

/**
 * Seed a reconcile floor directly into the store (the mount skeleton) for the
 * forward-only-counter test — mirrors the reconcilePhases adapter output:
 * `total` rows, the `current` one running, prior done, later pending.
 */
export function seedReconcileFloor(
  threadId: string,
  currentPhaseIndex: number,
  totalPhases: number,
): Phase[] {
  const phases: Phase[] = Array.from({ length: totalPhases }, (_, i): Phase => ({
    slug: `phase-${i}`,
    phaseIndex: i,
    phaseType: "unknown",
    status: i < currentPhaseIndex ? "done" : i === currentPhaseIndex ? "running" : "pending",
    subAgents: [],
    pendingAsk: null,
  }))
  useStreamsStore.getState().actions.replacePhasesForThread(threadId, phases)
  return phases
}

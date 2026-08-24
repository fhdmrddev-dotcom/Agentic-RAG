/**
 * Phase 194 Plan 07 (RUN-01 / BUG-260815-04 / V-07 / D-18) — the chat banner
 * ADVANCES during a harness run.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS PINS
 * ─────────────────────────────────────────────────────────────────────────────
 * `BUG-260815-04` is not a copy bug. `MessageItem`'s `hasAnyTools` is
 * `(message.tool_calls?.length ?? 0) > 0`, and a harness run writes NO
 * `tool_calls` — its progress lives in `workflow_phases` rows and in
 * `phase_started` / `phase_completed` SSE. So the `isStreaming && !hasAnyTools`
 * branch held from kickoff to terminal and the banner was STRUCTURALLY INCAPABLE
 * of advancing.
 *
 * ⚠⚠ THE PRE-PHASE-1 STRING IS DELIBERATE AND BYTE-PINNED (D-13/D-14) — it is
 * asserted here in BOTH directions on purpose: it must still be exactly what it
 * was before phase 1, and it must no longer be there after one. A suite that only
 * asserted the advance would let someone "fix" this by rewording the string, which
 * fixes nothing and breaks a nine-phase-old pin
 * (`src/lib/__tests__/toolMeta.test.ts:31`).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY A NEW FILE
 * ─────────────────────────────────────────────────────────────────────────────
 * `MessageItem.test.tsx` mocks `@/providers/StreamsProvider` down to a single
 * export (`useWorkflowLockForThread: () => null`). It stays byte-unedited —
 * `git diff --numstat` on it is empty — and this suite instead drives the REAL
 * provider selectors over the REAL zustand store, because the property under test
 * IS the subscription. A hand-seeded mock of `usePhases` would prove only that a
 * formatted string renders, never that the store slice reaches the surface.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE TWO MEASUREMENTS D-18 REQUIRES (and one it does not, which turned out to
 * be the load-bearing one)
 * ─────────────────────────────────────────────────────────────────────────────
 * D-18 accepts the PANEL-09 crossing "with the cost stated", and demands a
 * MEASURED re-render count rather than an assurance. Three are taken below:
 *   1. token-stream commits WITHOUT the subscription (Deep arm) — the control;
 *   2. token-stream commits WITH it live (harness arm) — must be unmoved;
 *   3. phase-transition commits with the message object held FIXED — the cost
 *      actually being paid, expected to equal the number of transitions.
 * And the fourth, which the plan did not ask for and which changed the design:
 *   4. `getThreadWorkflow` calls with six assistant rows mounted. `usePhases`
 *      mounts `usePanelReconcile`, which FETCHES per mount, and `MessageList`
 *      renders one `MessageItem` per message with no virtualisation. A hook at
 *      `MessageItem`'s top level is one fetch per assistant row.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, act } from "@testing-library/react"
import { Profiler } from "react"
import type { Message, Phase } from "@/types"

// ── Stub supabase (api.ts creates the client at module load) ──────────────────
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}))

// ── The ONLY api function this suite controls is the reconcile fetcher.
//    Everything else stays ACTUAL so the real StreamsProvider module loads
//    unchanged (the 194-08 precedent: a partially-stubbed api module makes a
//    reconcile die silently in its own catch).
const { mockGetThreadWorkflow } = vi.hoisted(() => ({ mockGetThreadWorkflow: vi.fn() }))
vi.mock("@/lib/api", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api")>()
  return { ...actual, getThreadWorkflow: mockGetThreadWorkflow }
})

import { MessageItem } from "../MessageItem"
import { useStreamsStore } from "@/stores/streamsStore"
import { TooltipProvider } from "@/components/ui/tooltip"

const THREAD = "thread-harness-1"

/** A streaming assistant row exactly as the kickoff placeholder mints it:
 *  `runStatus: "streaming"`, no content, and — the whole point — NO tool_calls. */
function streamingAssistant(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-1",
    thread_id: THREAD,
    user_id: "user-1",
    role: "assistant",
    content: "",
    created_at: "2026-08-16T00:00:00Z",
    updated_at: "2026-08-16T00:00:00Z",
    runStatus: "streaming",
    ...overrides,
  }
}

function phase(overrides: Partial<Phase> & { phaseIndex: number }): Phase {
  return {
    slug: `phase-${overrides.phaseIndex}`,
    phaseType: "unknown",
    status: "pending",
    subAgents: [],
    pendingAsk: null,
    ...overrides,
  }
}

/**
 * ⚠ MEASURED, and it is why these helpers write the slices DIRECTLY instead of
 * calling `useStreamsStore.getState().actions.*`: the store's default `actions`
 * are **no-op stubs** (`streamsStore.ts:405-415`) until `StreamsProvider` MOUNTS
 * and installs the real closures. A suite that renders a component in isolation
 * — as this one and `MessageItem.test.tsx` both do — therefore gets silent no-ops
 * from every mutator, and the first run of this file showed exactly that:
 * `setWorkflowLockForThread` and `replacePhasesForThread` did nothing and the
 * banner read the Deep value. It failed loudly rather than passing vacuously,
 * which is the only reason it was caught.
 *
 * The writes below are byte-equivalent to what the shipped mutators produce
 * (`new Map` → `set`, copy-on-write — `StreamsProvider.tsx:2771-2862`); the unit
 * under test is the SUBSCRIPTION (`usePhases` → the rendered sentence), and the
 * mutators have their own coverage in `panel/__tests__/PhaseReconcile.test.tsx`.
 */
function lockThread(threadId = THREAD): void {
  useStreamsStore.setState((s) => ({
    workflowLockByThread: new Map(s.workflowLockByThread).set(threadId, {
      runId: "producer-run-1",
      mode: "harness",
      capPaused: false,
      continuesRemaining: 3,
    }),
  }))
}

function seedPhases(phases: Phase[], threadId = THREAD): void {
  useStreamsStore.setState((s) => ({
    phasesByThread: new Map(s.phasesByThread).set(threadId, phases),
  }))
}

/** A phase-status transition, in the copy-on-write shape `setPhaseStatusForThread` uses. */
function transitionPhase(slug: string, status: Phase["status"], threadId = THREAD): void {
  useStreamsStore.setState((s) => {
    const next = new Map(s.phasesByThread)
    const prev = next.get(threadId) ?? []
    next.set(
      threadId,
      prev.map((p) => (p.slug === slug ? { ...p, status } : p)),
    )
    return { phasesByThread: next }
  })
}

function renderStreaming(message: Message) {
  return render(
    <TooltipProvider>
      <MessageItem message={message} isStreaming isLastAssistant />
    </TooltipProvider>,
  )
}

/** The rendered banner sentence — the italic span inside the pre-tools arm. */
function bannerText(): string {
  const el = document.querySelector("span.italic")
  return el?.textContent ?? ""
}

beforeEach(() => {
  // ⚠ The reconcile fetcher returns a promise that NEVER resolves, on purpose.
  // `usePanelReconcile` would otherwise `replace(threadId, …)` and wipe the
  // seeded slice out from under the assertion — the store, not the network, is
  // the subject here. The call COUNT is still observable, which is measurement 4.
  mockGetThreadWorkflow.mockReset()
  mockGetThreadWorkflow.mockImplementation(() => new Promise<never>(() => {}))
  useStreamsStore.setState({
    workflowLockByThread: new Map(),
    phasesByThread: new Map(),
  })
})

afterEach(() => cleanup())

describe("MessageItem — the harness banner advances (V-07)", () => {
  it("V-07 (a) a streaming harness message with ZERO completed phases reads exactly the pinned string", () => {
    lockThread()
    seedPhases([])
    renderStreaming(streamingAssistant())
    expect(bannerText()).toBe("Starting workflow…")
  })

  it("V-07 (a) phase 1 merely RUNNING is still the pinned string — the run has not advanced", () => {
    lockThread()
    seedPhases([phase({ phaseIndex: 0, status: "running" }), phase({ phaseIndex: 1 })])
    renderStreaming(streamingAssistant())
    expect(bannerText()).toBe("Starting workflow…")
  })

  it("V-07 (b) ONE completed phase advances the sentence off the pinned string", () => {
    lockThread()
    seedPhases([
      phase({ phaseIndex: 0, status: "done" }),
      phase({ phaseIndex: 1, status: "running" }),
      phase({ phaseIndex: 2 }),
    ])
    renderStreaming(streamingAssistant())
    expect(bannerText()).not.toBe("Starting workflow…")
    expect(bannerText()).toBe("Working on phase 2…")
  })

  it("V-07 (b) the sentence tracks the slice LIVE — a phase_completed re-renders it", () => {
    lockThread()
    seedPhases([
      phase({ phaseIndex: 0, status: "running" }),
      phase({ phaseIndex: 1 }),
      phase({ phaseIndex: 2 }),
    ])
    renderStreaming(streamingAssistant())
    expect(bannerText()).toBe("Starting workflow…")

    act(() => {
      transitionPhase("phase-0", "done")
      transitionPhase("phase-1", "running")
    })
    expect(bannerText()).toBe("Working on phase 2…")

    act(() => {
      transitionPhase("phase-1", "done")
      transitionPhase("phase-2", "running")
    })
    expect(bannerText()).toBe("Working on phase 3…")
  })

  it("a DEEP streaming message (no workflow lock) is byte-identical to the shipped value", () => {
    // No lockThread() — and phases seeded anyway, to prove the Deep arm cannot
    // see them even when the slice is populated.
    seedPhases([phase({ phaseIndex: 0, status: "done" }), phase({ phaseIndex: 1, status: "running" })])
    renderStreaming(streamingAssistant())
    expect(bannerText()).toBe("Setting up agent…")
  })

  it("a message WITH tool calls is unaffected — the hasAnyTools branch still wins", () => {
    lockThread()
    seedPhases([phase({ phaseIndex: 0, status: "done" }), phase({ phaseIndex: 1, status: "running" })])
    renderStreaming(
      streamingAssistant({
        tool_calls: [{ id: "tc-1", name: "search_documents", args: {}, status: "running" }],
      } as Partial<Message>),
    )
    // The banner arm did not render at all; no pre-tools italic sentence exists.
    expect(bannerText()).not.toBe("Working on phase 2…")
    expect(bannerText()).not.toBe("Starting workflow…")
  })

  it("reasoning still wins over the harness arm, progress or not (ordering unchanged)", () => {
    lockThread()
    seedPhases([phase({ phaseIndex: 0, status: "done" }), phase({ phaseIndex: 1, status: "running" })])
    renderStreaming(streamingAssistant({ reasoningContent: "thinking out loud" }))
    expect(bannerText()).toBe("Reasoning…")
  })
})

describe("D-18 — the accepted cost, MEASURED (not asserted)", () => {
  it("MEASUREMENT 1+2: a token stream costs ZERO extra commits with the subscription live; the mount costs exactly ONE", () => {
    // ── control: Deep arm, no subscription at all ────────────────────────────
    let deepCommits = 0
    const deep = render(
      <TooltipProvider>
        <Profiler id="deep" onRender={() => { deepCommits += 1 }}>
          <MessageItem message={streamingAssistant()} isStreaming isLastAssistant />
        </Profiler>
      </TooltipProvider>,
    )
    // Flush any effect-scheduled commit BEFORE splitting mount cost from stream
    // cost, so a mount-time state write cannot be miscounted as a token cost.
    act(() => {})
    const deepMountCommits = deepCommits
    let content = ""
    for (const token of ["Hel", "lo ", "the", "re ", "wor", "ld"]) {
      content += token
      const m = streamingAssistant({ content })
      act(() => {
        deep.rerender(
          <TooltipProvider>
            <Profiler id="deep" onRender={() => { deepCommits += 1 }}>
              <MessageItem message={m} isStreaming isLastAssistant />
            </Profiler>
          </TooltipProvider>,
        )
      })
    }
    cleanup()

    // ── subject: harness arm, subscription LIVE, phases untouched throughout ──
    lockThread()
    seedPhases([
      phase({ phaseIndex: 0, status: "done" }),
      phase({ phaseIndex: 1, status: "running" }),
    ])
    let harnessCommits = 0
    const harness = render(
      <TooltipProvider>
        <Profiler id="harness" onRender={() => { harnessCommits += 1 }}>
          <MessageItem message={streamingAssistant()} isStreaming isLastAssistant />
        </Profiler>
      </TooltipProvider>,
    )
    act(() => {})
    const harnessMountCommits = harnessCommits
    content = ""
    for (const token of ["Hel", "lo ", "the", "re ", "wor", "ld"]) {
      content += token
      const m = streamingAssistant({ content })
      act(() => {
        harness.rerender(
          <TooltipProvider>
            <Profiler id="harness" onRender={() => { harnessCommits += 1 }}>
              <MessageItem message={m} isStreaming isLastAssistant />
            </Profiler>
          </TooltipProvider>,
        )
      })
    }

    // ⚠ THE LOAD-BEARING CLAUSE, ASSERTED FIRST AND SPLIT FROM THE MOUNT COST ON
    // PURPOSE. D-18's stop condition is "if the TOKEN-STREAM count moves at all,
    // the read is wired to the wrong slice". Measured across six token deltas:
    // **7 and 7** — UNMOVED. The subscription costs ZERO per token.
    // (7 rather than 6 for six deltas on BOTH sides: the first delta gives the row
    // its first content, which settles `MessageItem`'s callback-ref into state —
    // `setMessageBody`, `MessageItem.tsx:393`, Phase 153-05 — for one extra commit.
    // Shipped Deep behaviour, present identically with and without the subscription,
    // which is exactly why the control is measured rather than reasoned about.)
    expect(harnessCommits - harnessMountCommits).toBe(deepCommits - deepMountCommits)
    expect(harnessCommits - harnessMountCommits).toBe(7)

    // ⚠ AND THE HALF THAT DID MOVE, STATED RATHER THAN ROUNDED AWAY: the MOUNT
    // costs exactly ONE extra commit — **1 → 2** — and the cause is named, not
    // guessed. `usePhases` mounts `usePanelReconcile`, whose thread-switch effect
    // calls `setIsLoading(true)` once (`hooks/usePanelReconcile.ts:122`). It is a
    // once-per-mounted-banner cost, not a per-token one, and it is not the cost
    // PANEL-09 was protecting against.
    expect(deepMountCommits).toBe(1)
    expect(harnessMountCommits).toBe(2)
  })

  it("MEASUREMENT 3: a phase sequence costs exactly ONE commit per transition, message object held FIXED", () => {
    lockThread()
    seedPhases([
      phase({ phaseIndex: 0, status: "running" }),
      phase({ phaseIndex: 1 }),
      phase({ phaseIndex: 2 }),
    ])
    const message = streamingAssistant() // one object, never replaced
    let commits = 0
    render(
      <TooltipProvider>
        <Profiler id="phases" onRender={() => { commits += 1 }}>
          <MessageItem message={message} isStreaming isLastAssistant />
        </Profiler>
      </TooltipProvider>,
    )
    const afterMount = commits

    act(() => {
      transitionPhase("phase-0", "done")
    })
    act(() => {
      transitionPhase("phase-1", "running")
    })
    act(() => {
      transitionPhase("phase-1", "done")
    })

    // 1 mount + 1 for `usePanelReconcile`'s `setIsLoading(true)`
    // (`hooks/usePanelReconcile.ts:122`) — the same harness-arm mount cost the
    // measurement above isolates. NOT the callback-ref settle: this row's content
    // stays empty, so the settled-body branch never renders.
    expect(afterMount).toBe(2)
    // Three transitions → three commits. A workflow run has a handful of phases;
    // this is per-PHASE, not per-token, and it is the cost D-18 accepted.
    expect(commits - afterMount).toBe(3)
  })

  it("MEASUREMENT 4: six mounted assistant rows fire ONE reconcile fetch, not six", () => {
    // `MessageList` renders one MessageItem per message with no virtualisation,
    // and only the LAST assistant row receives `isStreaming` (MessageList.tsx:182).
    // The banner — and therefore `usePhases` — mounts on that row alone.
    lockThread()
    seedPhases([phase({ phaseIndex: 0, status: "done" }), phase({ phaseIndex: 1, status: "running" })])
    const rows: Message[] = Array.from({ length: 6 }, (_, i) =>
      streamingAssistant({ id: `msg-${i}`, content: i === 5 ? "" : `settled ${i}` }),
    )
    render(
      <TooltipProvider>
        {rows.map((m, i) => (
          <MessageItem key={m.id} message={m} isStreaming={i === 5} isLastAssistant={i === 5} />
        ))}
      </TooltipProvider>,
    )
    expect(screen.getByText("Working on phase 2…")).toBeTruthy()
    expect(mockGetThreadWorkflow).toHaveBeenCalledTimes(1)
    expect(mockGetThreadWorkflow).toHaveBeenCalledWith(THREAD, expect.anything())
  })

  it("MEASUREMENT 4 (control): a DEEP thread fires NO reconcile fetch at all", () => {
    // No lock → the banner child never mounts → `usePhases` is never called.
    renderStreaming(streamingAssistant())
    expect(bannerText()).toBe("Setting up agent…")
    expect(mockGetThreadWorkflow).not.toHaveBeenCalled()
  })
})

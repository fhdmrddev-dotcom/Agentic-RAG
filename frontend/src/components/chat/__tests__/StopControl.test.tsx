/**
 * Phase 194.1 Plan 04 (RUN-01 / R1 + R2) — `<StopControl>`, THE ONE SHARED
 * PRESSED-STATE MECHANISM ALL FOUR STOP MOUNTS RENDER.
 *
 * The AFTER to `StopControl.baseline.test.tsx`'s BEFORE. That file was captured
 * by plan 01 on an UNMOVED tree, named for a component that did not yet exist,
 * and pins the chrome this one must preserve. Every inversion it owes is made
 * IN PLACE there under a `SUPERSEDED` marker — never by deletion.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE ABSENCE IS THE ASSERTION, AND A PRESENCE CHECK IS NOT ENOUGH
 * ─────────────────────────────────────────────────────────────────────────────
 * Sketch 168-B's winning property is that **a double-press is impossible by
 * construction rather than defended**: on press the control LEAVES its slot and
 * `⊘ Stopping this run…` takes it. There is no disabled button, because there is
 * no button.
 *
 * A suite asserting only *"the stopping reading is present"* passes under the
 * "disabled button" shape — variant A, the one 168-B beat. So every stopping
 * case below asserts the control's `data-testid` is **ABSENT FROM THE DOM**, and
 * additionally that no `disabled` / `aria-disabled` / `hidden` control is hiding
 * inside the slot. Plant P1 drives exactly that difference.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ THE SLOT FENCE IS CLASS-TOKEN IDENTITY, NOT GEOMETRY — AND THAT IS AN
 *   HONEST LIMIT, NOT A SHORTCUT
 * ─────────────────────────────────────────────────────────────────────────────
 * CONTEXT **D-24**: jsdom returns 0 for all layout. No test in this tree measures
 * real geometry, and the only `getBoundingClientRect` anywhere in the test tree is
 * a NEGATIVE source fence (`PhaseNodeCard.test.tsx:523-527`). A fence promising a
 * "measured slot" would pass every plant.
 *
 * What IS asserted: the wrapper's `className` is **byte-identical** across all
 * three arms for a given variant, and for `variant="composer"` it carries the
 * shipped sizing tokens `h-8` / `rounded-lg` / `shrink-0`. That guards HEIGHT.
 * **WIDTH is not guarded and cannot be here** — the resting control is a 32 px
 * icon button and the stopping reading is a text line. Width is judged by
 * **G-4 row 1** (*"Press — fails if the button sits inert or the row twitches"*,
 * `194.1-VALIDATION.md`). See `StopControl.tsx`'s docblock for the named fallback.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE REAL PROVIDER, AND NOT A MODULE MOCK
 * ─────────────────────────────────────────────────────────────────────────────
 * `vi.mock` is FILE-GLOBAL. Task 2's three timing points and the two-instance
 * case need the REAL store timer, so this file cannot mock
 * `@/providers/StreamsProvider` for some cases and use the real one for others.
 * Every case therefore mounts inside a real `<StreamsProvider>` with the
 * `@/lib/api` bundle mocked — the shape ported from `ComposerStopHarness.test.tsx`,
 * including the two keys that are load-bearing and look optional:
 *
 *   - `getSnapshot` — since Phase 075 (D-075-02) `reconcile` reads the ATOMIC
 *     `getSnapshot`. Left unmocked the whole reconcile dies SILENTLY inside its
 *     own `catch { console.error("reconcile failed:") }`.
 *   - `getThreadWorkflow` — plan 03's R6 frame fallback. Left unmocked the real
 *     implementation runs `fetch` in jsdom, the resolver's try/catch swallows it,
 *     and a Stop case reports "cancelRun called 0 times" for a reason unrelated
 *     to what it tests.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * GATE SCOPE — measured, not assumed
 * ─────────────────────────────────────────────────────────────────────────────
 * NOT executed by `scripts/vitest-count-gate.cjs`. `TARGETS` has exactly one
 * directory entry (`src/components/workflows`) and reaches everything else by
 * NAMED FILE; there is no `src/components/chat` entry anywhere in the array
 * (`194.1-BASELINE.md` §2). This plan adds none — a gate-scope change is not
 * scoped here.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, act, cleanup, waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createElement, type ReactNode } from "react"

// ⚠ `?raw`, NOT `node:fs`. `tsconfig.app.json` carries no node types on purpose;
// the first draft of plan 03's suite produced SIX typecheck errors that way. This
// is the shipped pattern (`ActiveRunsTray.test.tsx:104`,
// `StopControl.baseline.test.tsx:149`, `WorkspacePanel.test.tsx:30`).
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — Vite `?raw` import, typed by vite/client at build time only.
import stopControlSource from "../StopControl.tsx?raw"
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — Vite `?raw` import, typed by vite/client at build time only.
import messageInputSource from "../MessageInput.tsx?raw"
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — Vite `?raw` import, typed by vite/client at build time only.
import chatAreaSource from "./../ChatArea.tsx?raw"

const {
  mockPostMessage,
  mockSubscribeToRun,
  mockGetMessages,
  mockGetActiveRuns,
  mockGetSnapshot,
  mockCancelRun,
  mockGetThreadWorkflow,
} = vi.hoisted(() => ({
  mockPostMessage: vi.fn(),
  mockSubscribeToRun: vi.fn(),
  mockGetMessages: vi.fn(),
  mockGetActiveRuns: vi.fn(),
  mockGetSnapshot: vi.fn(),
  mockCancelRun: vi.fn(),
  mockGetThreadWorkflow: vi.fn(),
}))

vi.mock("@/lib/api", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api")>()
  return {
    ApiError: actual.ApiError,
    postMessage: mockPostMessage,
    subscribeToRun: mockSubscribeToRun,
    getMessages: mockGetMessages,
    getActiveRuns: mockGetActiveRuns,
    getSnapshot: mockGetSnapshot,
    cancelRun: mockCancelRun,
    getThreadWorkflow: mockGetThreadWorkflow,
  }
})

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "user-1" }, access_token: "token" } },
      }),
    },
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}))

import { StreamsProvider } from "@/providers/StreamsProvider"
import { useStreamsStore } from "@/stores/streamsStore"
import { StopControl, COPY_STOPPING, COPY_STOP_NOT_CONFIRMED } from "../StopControl"

const THREAD = "thread-stop-1"

/**
 * ⚠ THE COMPOSER'S SHIPPED `className`, MEASURED OFF THE RENDERED DOM by plan 01
 * and re-declared here rather than imported.
 *
 * It is NOT in `MessageInput.tsx`: the source carries only the last 8 tokens
 * (`:417`); everything before `border bg-background` is
 * `buttonVariants({variant:"outline", size:"icon"})` merged in by shadcn's
 * `<Button>` through tailwind-merge. A component that "preserves the className"
 * by copying the source line preserves 8 of 27 tokens — this literal is what says
 * so, and it is the whole reason `<StopControl variant="composer">` must render a
 * real `<Button variant="outline" size="icon">` rather than a styled `<button>`.
 */
const COMPOSER_SHIPPED_CLASSNAME =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border bg-background hover:text-accent-foreground h-8 w-8 rounded-lg shrink-0 transition-all border-destructive/40 text-destructive hover:bg-destructive/10 hover:border-destructive"

/** Plan 01's measured panel + tray chrome. `<StopControl>`'s per-variant defaults
 *  must reproduce these so plans 05/06 mount without re-typing their own chrome —
 *  and so a unification that silently changes one surface reds HERE rather than at
 *  the mount. ⚠ The two differ by exactly two things (no `ml-auto` on the tray, and
 *  `hover:bg-destructive/20 transition-colors` in the opposite order); they are NOT
 *  one string today and this suite refuses to pretend otherwise. */
const PANEL_SHIPPED_CLASSNAME =
  "ml-auto flex shrink-0 items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-[11px] text-destructive transition-colors hover:bg-destructive/20 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
const TRAY_SHIPPED_CLASSNAME =
  "flex shrink-0 items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-[11px] text-destructive hover:bg-destructive/20 transition-colors"

/**
 * ⚠ COMMENT-STRIPPING IS LOAD-BEARING FOR TWO OF THE SOURCE FENCES BELOW, AND THE
 * REASON IS RECORDED HERE RATHER THAN DISCOVERED AGAIN.
 *
 * `StopControl.tsx`'s docblock STATES the rules it obeys, which means it legally
 * contains the very tokens those rules forbid (`cancelRun(`, `workflowLock?.runId`,
 * `⏹`). A raw sweep therefore reds on the DOCUMENTATION of the rule — measured at
 * 2 and 1 hits respectively on the first run of this suite.
 *
 * `194.1-BASELINE.md` §9 is explicit that the remedy is NOT to delete the prose.
 * So: strip comment lines, assert zero in CODE, and separately assert the prose is
 * PRESENT — otherwise a strip would make a genuinely undocumented rule
 * indistinguishable from a documented one.
 *
 * The stripper is line-oriented and that is honest about its limit: it drops lines
 * whose trimmed form STARTS with a comment opener or a continuation star, so an
 * INLINE trailing comment would survive. Every comment in `StopControl.tsx` is
 * whole-line, and each fence that uses this asserts the stripper did not eat its
 * own subject.
 */
function stripComments(src: string): string {
  return src
    .split("\n")
    .filter((line) => {
      const t = line.trim()
      return !(t.startsWith("//") || t.startsWith("/*") || t.startsWith("*") || t.startsWith("{/*"))
    })
    .join("\n")
}

/** Declared ONCE so the fence and its positive control cannot drift apart by
 *  being typed twice. ⚠ `g` flag + `.match()` is stateless; do not switch it to
 *  `.test()`, which would carry `lastIndex` between calls. */
const NEEDLE_LOCK_OR_CANCEL = /workflowLock\??\.runId|cancelRun\(/g

// ── Store drivers ─────────────────────────────────────────────────────────────
// The arms are driven by writing the pure-data Sets plan 03 shipped, NOT by
// mocking the selectors — a mocked selector proves the component reads SOMETHING,
// never that it reads the slice the rest of the tree writes.
function setStopping(threadId: string, on: boolean) {
  act(() => {
    useStreamsStore.setState((s) => {
      const next = new Set(s.stoppingThreads)
      if (on) next.add(threadId)
      else next.delete(threadId)
      return { stoppingThreads: next }
    })
  })
}

function setNotConfirmed(threadId: string, on: boolean) {
  act(() => {
    useStreamsStore.setState((s) => {
      const next = new Set(s.stopNotConfirmed)
      if (on) next.add(threadId)
      else next.delete(threadId)
      return { stopNotConfirmed: next }
    })
  })
}

/** Replace the store's `stopThread` action with a spy, AFTER the provider's mount
 *  effect has installed the real bodies (otherwise the effect overwrites it). */
function spyOnStopThread() {
  const spy = vi.fn(async () => {})
  act(() => {
    useStreamsStore.setState((s) => ({ actions: { ...s.actions, stopThread: spy } }))
  })
  return spy
}

function renderStop(props: Parameters<typeof StopControl>[0]) {
  return render(
    createElement(
      StreamsProvider,
      null as unknown as { children: ReactNode },
      createElement(StopControl, props),
    ),
  )
}

/**
 * TWO `<StopControl>` instances for ONE thread, under ONE provider.
 *
 * ⚠ THIS IS PLAN 04's ONLY PROOF OF **D-06**, and it must not be dropped for
 * looking artificial. The composer Stop and the panel Stop CAN be mounted for the
 * same thread simultaneously; with component-local state, pressing one would leave
 * the other pressable, and R1's acceptance is that a second press is impossible
 * **by construction**. Plan 05 lands the real cross-mount case (composer + panel);
 * this is its structural ancestor, and it fires under a plant no single-mount test
 * can see (P5).
 */
function renderTwoStops(threadId: string) {
  return render(
    createElement(
      StreamsProvider,
      null as unknown as { children: ReactNode },
      createElement(StopControl, { threadId, variant: "composer" as const, key: "a" }),
      createElement(StopControl, { threadId, variant: "panel" as const, key: "b" }),
    ),
  )
}

// ── R2 fake-timer drivers ─────────────────────────────────────────────────────
const PRODUCER_RUN_ID = "run-producer-stopcontrol"

/** ⚠ Mirrors `STOP_TIMEOUT_MS` in `StreamsProvider.tsx`, DELIBERATELY re-declared
 *  rather than imported: the constant is module-private, and R2's acceptance is
 *  about the OBSERVED window — a test that imported the value would agree with any
 *  value the source happened to hold, including 1 ms. Plant P4 (source set to
 *  3000) is what proves the pair is load-bearing. */
const STOP_WINDOW_MS = 8000

function assistantRow(over: Record<string, unknown>) {
  return {
    id: "m-" + Math.random().toString(36).slice(2),
    thread_id: THREAD,
    user_id: "",
    role: "assistant",
    content: "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tool_calls: [],
    ...over,
  }
}

/** Seed the thread as live, with a streaming assistant row the resolver can read a
 *  run id off — the bucket arm of plan 03's R6 bucket-then-frame resolution. */
function seedLiveRun(threadId: string) {
  act(() => {
    useStreamsStore.setState((s) => {
      const surf = new Map(s.bucketsBySurface.get("chat") ?? new Map())
      surf.set(threadId, [assistantRow({ runStatus: "streaming", runId: PRODUCER_RUN_ID })])
      const buckets = new Map(s.bucketsBySurface)
      buckets.set("chat", surf)
      return {
        bucketsBySurface: buckets as never,
        streamingThreads: new Set(s.streamingThreads).add(threadId),
      }
    })
  })
}

/** The ONLY honest way to simulate "the run reached a terminal": drop the thread
 *  from `streamingThreads`. All four shipped terminal routes end in exactly this
 *  write, which is why plan 03 keys the clear on the slice transition. */
function reachTerminal(threadId: string) {
  act(() => {
    useStreamsStore.setState((s) => {
      const next = new Set(s.streamingThreads)
      next.delete(threadId)
      return { streamingThreads: next }
    })
  })
}

/** A `cancelRun` that never settles — the "never resolves" arm of sketch 168's
 *  driver, which is the arm the sketch calls *the judgement*. */
function cancelHangs() {
  mockCancelRun.mockImplementation(() => new Promise(() => {}))
}

/**
 * ⚠ LOAD-BEARING IN EVERY FAKE-TIMER CASE, inherited from plan 03 where it was
 * found by MEASURING rather than by reading. Seeding `streamingThreads` directly
 * never stamps `lastEventAtRef`, so the thread reads as immediately inactive to the
 * Phase 145-05 inactivity watchdog — whose shared ~5s interval fires a read-only
 * `getSnapshot` probe, gets the default EMPTY `active_runs`, and silently finalizes
 * the thread **at t+5000, inside R2's 8s window**.
 *
 * ⚠ The t+2000 case would pass ANYWAY under that artifact, for the wrong reason.
 * That is the more dangerous half, and it is why this is applied to the whole
 * describe rather than only to the cases that visibly failed.
 */
function snapshotStillStreaming(runId: string) {
  mockGetSnapshot.mockResolvedValue({
    messages: [],
    active_runs: [{ run_id: runId, started_at: new Date().toISOString(), status: "streaming" }],
    since_cursors: { [runId]: "0" },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  useStreamsStore.setState({
    bucketsBySurface: new Map(),
    viewedThreadId: null,
    streamingThreads: new Set<string>(),
    stoppingThreads: new Set<string>(),
    stopNotConfirmed: new Set<string>(),
    harnessKickoffThreads: new Set<string>(),
    fallbackNotices: new Map<string, string>(),
    reconcileErrors: new Map<string, Error>(),
    failedSendDrafts: new Map<string, string>(),
    loadingThreads: new Set<string>(),
    subscriptionsByThread: new Map<string, Set<string>>(),
    workflowLockByThread: new Map(),
  })
  mockGetMessages.mockResolvedValue([])
  mockGetActiveRuns.mockResolvedValue([])
  mockGetSnapshot.mockResolvedValue({ messages: [], active_runs: [], since_cursors: {} })
  mockCancelRun.mockResolvedValue(undefined)
  mockGetThreadWorkflow.mockResolvedValue({ definition_slug: null })
  mockSubscribeToRun.mockImplementation(async () => new Promise<void>(() => {}))
})

afterEach(() => {
  cleanup()
})

// ─────────────────────────────────────────────────────────────────────────────
// ARM 1 — RESTING
// ─────────────────────────────────────────────────────────────────────────────
describe("194.1-04 R1 — resting: the variant's shipped Stop control, unchanged", () => {
  it("composer: renders the shipped chrome BYTE-IDENTICALLY to plan 01's measurement", () => {
    renderStop({ threadId: THREAD, variant: "composer" })
    const btn = screen.getByTestId("composer-stop")

    expect(btn.tagName).toBe("BUTTON")
    expect(btn.getAttribute("aria-label")).toBe("Stop generation")
    expect(btn.textContent).toBe("")
    expect(btn.className).toBe(COMPOSER_SHIPPED_CLASSNAME)

    const icon = btn.querySelector("svg")
    expect(icon).not.toBeNull()
    expect(icon!.getAttribute("class")).toBe("lucide lucide-square h-3.5 w-3.5 fill-current")
  })

  it("composer: the stopping reading is ABSENT while resting", () => {
    const { container } = renderStop({ threadId: THREAD, variant: "composer" })
    expect(container.textContent ?? "").not.toContain("Stopping this run")
    expect(screen.queryByTestId("composer-stopping")).toBeNull()
  })

  it("panel + tray defaults reproduce plan 01's measured chrome, and are NOT one string", () => {
    renderStop({ threadId: THREAD, variant: "panel" })
    const panelBtn = screen.getByTestId("panel-stop-run")
    expect(panelBtn.getAttribute("type")).toBe("button")
    expect(panelBtn.getAttribute("aria-label")).toBe("Stop this workflow run")
    expect(panelBtn.textContent?.trim()).toBe("Stop")
    expect(panelBtn.className).toBe(PANEL_SHIPPED_CLASSNAME)
    expect(panelBtn.querySelector("svg")!.getAttribute("class")).toBe(
      "lucide lucide-square h-2.5 w-2.5 fill-current",
    )
    cleanup()

    renderStop({ threadId: THREAD, variant: "tray" })
    const trayBtn = screen.getByTestId("tray-stop-run")
    expect(trayBtn.textContent?.trim()).toBe("Stop")
    expect(trayBtn.className).toBe(TRAY_SHIPPED_CLASSNAME)

    // The two shipped surfaces are NOT the same string. Recorded as an assertion
    // so a later "tidy-up" that unifies them is a deliberate, visible decision.
    expect(PANEL_SHIPPED_CLASSNAME).not.toBe(TRAY_SHIPPED_CLASSNAME)
  })

  it("the three optionals OVERRIDE the variant defaults (the tray's per-run aria)", () => {
    renderStop({
      threadId: THREAD,
      variant: "tray",
      ariaLabel: "Stop run on Quarterly close workflow",
      testId: "tray-stop-thread-A",
      label: "Stop",
    })
    const btn = screen.getByTestId("tray-stop-thread-A")
    expect(btn.getAttribute("aria-label")).toBe("Stop run on Quarterly close workflow")
  })

  it("threadId == null renders NOTHING at all", () => {
    const { container } = renderStop({ threadId: null, variant: "composer" })
    expect(container.querySelector("[data-testid='composer-stop']")).toBeNull()
    expect(container.querySelector("[data-testid='composer-stop-slot']")).toBeNull()
    expect((container.textContent ?? "").trim()).toBe("")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// ARM 2 — STOPPING: THE CONTROL IS GONE, NOT DISABLED
// ─────────────────────────────────────────────────────────────────────────────
describe("194.1-04 R1 — stopping: the control LEAVES the DOM (168-B, plant P1)", () => {
  it("the reading renders and the control's testid is ABSENT — not merely disabled", () => {
    renderStop({ threadId: THREAD, variant: "composer" })
    expect(screen.getByTestId("composer-stop")).toBeTruthy()

    setStopping(THREAD, true)

    expect(screen.getByText(COPY_STOPPING)).toBeTruthy()
    // ⚠ THE LOAD-BEARING ASSERTION. A presence-only check on the reading passes
    // the "disabled button" plant (P1) — the shape 168-B beat. The ABSENCE is the
    // requirement, because it is what makes a second press impossible.
    expect(screen.queryByTestId("composer-stop")).toBeNull()
  })

  it("no disabled / aria-disabled / hidden control is hiding inside the slot", () => {
    renderStop({ threadId: THREAD, variant: "composer" })
    setStopping(THREAD, true)

    const slot = screen.getByTestId("composer-stop-slot")
    expect(slot.querySelectorAll("button").length).toBe(0)
    expect(slot.querySelectorAll("[disabled]").length).toBe(0)
    expect(slot.querySelectorAll("[aria-disabled]").length).toBe(0)
    expect(slot.querySelectorAll("[hidden]").length).toBe(0)
  })

  it("the reading is the sketch 168-B literal, verbatim", () => {
    expect(COPY_STOPPING).toBe("⊘ Stopping this run…")
    renderStop({ threadId: THREAD, variant: "composer" })
    setStopping(THREAD, true)
    expect(screen.getByTestId("composer-stopping").textContent).toBe(COPY_STOPPING)
  })

  it("stopping on ANOTHER thread does not touch this mount", () => {
    renderStop({ threadId: THREAD, variant: "composer" })
    setStopping("some-other-thread", true)
    expect(screen.getByTestId("composer-stop")).toBeTruthy()
    expect(screen.queryByTestId("composer-stopping")).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// ARM 3 — NOT CONFIRMED
// ─────────────────────────────────────────────────────────────────────────────
describe("194.1-04 R2 — not-confirmed: a PRESSABLE control beside honest copy", () => {
  it("the control is back AND the copy is present, in the same slot", () => {
    renderStop({ threadId: THREAD, variant: "composer" })
    setStopping(THREAD, true)
    expect(screen.queryByTestId("composer-stop")).toBeNull()

    setStopping(THREAD, false)
    setNotConfirmed(THREAD, true)

    const btn = screen.getByTestId("composer-stop")
    expect(btn).toBeTruthy()
    expect((btn as HTMLButtonElement).disabled).toBe(false)
    const slot = screen.getByTestId("composer-stop-slot")
    expect(slot.contains(btn)).toBe(true)
    expect(slot.textContent).toContain(COPY_STOP_NOT_CONFIRMED)
    // The stopping reading is gone — the two readings are never on together.
    expect(screen.queryByTestId("composer-stopping")).toBeNull()
  })

  it("the copy names non-confirmation, claims NO cause, and carries NO step count", () => {
    // One sentence.
    expect(COPY_STOP_NOT_CONFIRMED.split(".").filter((s) => s.trim().length > 0)).toHaveLength(1)
    // Says the thing it is for.
    expect(COPY_STOP_NOT_CONFIRMED).toContain("not confirmed")
    // ⚠ Claims no cause it has not established — these are the retired string's
    // words (`StreamsProvider.tsx:2394`/`:2457` before plan 03 removed them), and
    // the reading is a TIMEOUT: it knows nothing about registration windows.
    expect(COPY_STOP_NOT_CONFIRMED).not.toContain("in a moment")
    expect(COPY_STOP_NOT_CONFIRMED).not.toContain("registering")
    expect(COPY_STOP_NOT_CONFIRMED.toLowerCase()).not.toContain("pre-stamp")
    // ⚠ NO step count. Phase 194 D-13's "every reading carries the step count in
    // the same sentence as the word" is about the STOPPED RECEIPT — a stop that
    // was not confirmed stopped nothing, so a count here would be a number about
    // a thing that did not happen. (Plan 07 owns the receipt.)
    expect(COPY_STOP_NOT_CONFIRMED).not.toMatch(/\d/)
    expect(COPY_STOP_NOT_CONFIRMED.toLowerCase()).not.toContain("step")
  })

  it("pressing again while not-confirmed dispatches stopThread again", async () => {
    const user = userEvent.setup()
    renderStop({ threadId: THREAD, variant: "composer" })
    const spy = spyOnStopThread()
    setNotConfirmed(THREAD, true)

    await user.click(screen.getByTestId("composer-stop"))
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(THREAD)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// THE ONE DURABLE CANCEL PATH
// ─────────────────────────────────────────────────────────────────────────────
describe("194.1-04 — the press goes to stopThread(threadId) and nowhere else", () => {
  it("dispatches stopThread with the threadId and exactly one argument", async () => {
    const user = userEvent.setup()
    renderStop({ threadId: THREAD, variant: "composer" })
    const spy = spyOnStopThread()

    await user.click(screen.getByTestId("composer-stop"))

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(THREAD)
    // ⚠ Exactly ONE argument. A handler passed straight through as
    // `onClick={() => stopThread(threadId)}` takes one; `onClick={stopThread}`
    // would hand React's synthetic event as a second, and the value assertion
    // alone would not see it.
    expect(spy.mock.calls[0]).toHaveLength(1)
  })

  it("every variant's press reaches the SAME action (D-08: four mounts, ONE mechanism)", async () => {
    const user = userEvent.setup()
    for (const [variant, testId] of [
      ["composer", "composer-stop"],
      ["panel", "panel-stop-run"],
      ["tray", "tray-stop-run"],
      ["page", "run-page-stop"],
    ] as const) {
      renderStop({ threadId: THREAD, variant })
      const spy = spyOnStopThread()
      await user.click(screen.getByTestId(testId))
      expect(spy, `variant ${variant}`).toHaveBeenCalledWith(THREAD)
      cleanup()
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// THE SLOT RESERVATION (D-24) — CLASS-TOKEN IDENTITY, NEVER GEOMETRY
// ─────────────────────────────────────────────────────────────────────────────
describe("194.1-04 R1 — the slot is a RESERVATION, asserted on class tokens (D-24)", () => {
  it("composer: the wrapper className is BYTE-IDENTICAL across all three arms", () => {
    renderStop({ threadId: THREAD, variant: "composer" })
    const resting = screen.getByTestId("composer-stop-slot").className

    setStopping(THREAD, true)
    const stopping = screen.getByTestId("composer-stop-slot").className

    setStopping(THREAD, false)
    setNotConfirmed(THREAD, true)
    const notConfirmed = screen.getByTestId("composer-stop-slot").className

    expect(stopping).toBe(resting)
    expect(notConfirmed).toBe(resting)
  })

  it("composer: the wrapper carries the shipped sizing tokens, so the row's HEIGHT cannot move", () => {
    renderStop({ threadId: THREAD, variant: "composer" })
    const tokens = screen.getByTestId("composer-stop-slot").className.split(/\s+/)
    expect(tokens).toContain("h-8")
    expect(tokens).toContain("rounded-lg")
    expect(tokens).toContain("shrink-0")
  })

  it("composer: the STOPPING child itself carries h-8 / rounded-lg / shrink-0 (plant P2)", () => {
    renderStop({ threadId: THREAD, variant: "composer" })
    setStopping(THREAD, true)
    const tokens = screen.getByTestId("composer-stopping").className.split(/\s+/)
    expect(tokens).toContain("h-8")
    expect(tokens).toContain("rounded-lg")
    expect(tokens).toContain("shrink-0")
    // ⚠ The plant this fires under is `h-6 w-auto` on the stopping child — a
    // change that looks like styling and silently makes the row twitch, which is
    // G-4 row 1's named failure shape.
    expect(tokens).not.toContain("h-6")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE FENCES
// ─────────────────────────────────────────────────────────────────────────────
describe("194.1-04 — source fences on StopControl.tsx", () => {
  /** The 192.1 lesson: a fence swept against an empty string passes green and
   *  proves nothing. Assert the input FIRST, in both directions. */
  it("the swept source is non-empty and is the right file", () => {
    const src = stopControlSource as string
    expect(typeof src).toBe("string")
    expect(src.length).toBeGreaterThan(2000)
    expect(src).toContain("export function StopControl")
    expect(src).toContain("COPY_STOPPING")
  })

  /**
   * D-05/D-06 made STRUCTURAL. With component-local state, pressing the panel
   * Stop would leave the composer's pressable for the same thread, and the state
   * would die on unmount — so navigating away mid-stop would restore a pressable
   * Stop. That is a new lie, in a phase whose subject is an honest Stop.
   */
  it("declares NO useState and NO useEffect — the pressed state is store-owned", () => {
    const src = stopControlSource as string
    expect((src.match(/useState[(<]/g) ?? []).length).toBe(0)
    expect((src.match(/useEffect\(/g) ?? []).length).toBe(0)
  })

  /**
   * Phase 194 D-08's "four mounts, ONE mechanism", held mechanically.
   *
   * ⚠ THE RAW FORM OF THIS FENCE IS NOT SATISFIABLE, AND THE FENCE WAS THE THING
   * AT FAULT — not the component. Written raw it counted **2**, and BOTH hits were
   * `StopControl.tsx`'s own docblock stating the rule (*"nothing reads
   * `workflowLock?.runId` or calls `cancelRun(` directly"*).
   *
   * This is the repository's recurring lesson landing again: `194.1-BASELINE.md`
   * §9 Trap 2, the `192-05` `title=` fence (AST-parsed for the identical reason),
   * and plan 03's own `setTimeout` fence. §9 is explicit that a later plan **must
   * not** "fix" such a red by deleting the documentation.
   *
   * Shipped form: strip comment lines, assert **0 in CODE**, and assert the prose
   * mention is **PRESENT** — so the strip can never cover for a real absence of
   * the rule, which is the failure mode a bare strip would introduce.
   */
  it("never reads a lock's runId and never calls cancelRun directly (plant P3)", () => {
    const src = stopControlSource as string
    const code = stripComments(src)

    // The stripper must not have eaten the surface under test (in both directions).
    expect(code).toContain("export function StopControl")
    expect(code).toContain("actions.stopThread(threadId)")
    expect(code).not.toContain("four mounts, ONE mechanism")

    expect((code.match(NEEDLE_LOCK_OR_CANCEL) ?? []).length).toBe(0)
    // The prose stating the rule SURVIVES — a strip that hid a genuinely missing
    // rule would otherwise read exactly like a strip that hid its documentation.
    expect((src.match(NEEDLE_LOCK_OR_CANCEL) ?? []).length).toBeGreaterThan(0)
    // Positive control: the same regex DOES match a real plant in CODE.
    expect(
      (stripComments(`${src}\nconst x = cancelRun(1)`).match(NEEDLE_LOCK_OR_CANCEL) ?? []).length,
    ).toBe(1)
  })

  /**
   * D-18 / D-24: no net-new glyph, and no promise of geometry jsdom cannot give.
   *
   * ⚠ Same trap, same remedy: raw, this counted **1**, and the hit was the
   * docblock sentence recording that `⏹` is in no table in `icon-convention.md`
   * §4. Deleting that sentence would remove the only place a reader learns WHY
   * the mark is refused, which is worth more than the convenience of a raw grep.
   */
  it("contains no ⏹ and no getBoundingClientRect in CODE", () => {
    const src = stopControlSource as string
    const code = stripComments(src)

    expect((code.match(/⏹|getBoundingClientRect/g) ?? []).length).toBe(0)
    // …and the refusal is still documented.
    expect(src).toContain("⏹")
    // Positive control in CODE.
    expect(
      (stripComments(`${src}\nconst g = "⏹"`).match(/⏹|getBoundingClientRect/g) ?? []).length,
    ).toBe(1)
  })

  /**
   * ⚠ THE COMPOSER MOUNT IS EXACTLY ONE, HELD MECHANICALLY RATHER THAN BY A
   * ONE-TIME GREP — the `PhaseFormPanel.tsx` / `<TemplateNameCheck` precedent from
   * 193.1, which this repository already trusts for the identical property.
   *
   * The needle is the JSX-OPEN token `<StopControl`, not the bare identifier: the
   * import line and every prose mention in `MessageInput.tsx` carry the bare name,
   * and three of them were REWRITTEN from the angle-bracket form after the raw grep
   * measured **4** — the same fence-reds-on-its-own-documentation trap this suite
   * hits twice above. Keeping the token out of prose is what keeps the needle
   * DISCRIMINATING, and this case is where that is enforced rather than hoped.
   */
  it("MessageInput mounts StopControl EXACTLY once, and ChatArea mounts it not at all", () => {
    const mi = messageInputSource as string
    const ca = chatAreaSource as string

    // Fence-can-fire, in both directions, before any count is trusted.
    expect(mi.length).toBeGreaterThan(5000)
    expect(mi).toContain("export function MessageInput")
    expect(ca.length).toBeGreaterThan(5000)
    expect(ca).toContain("export function ChatArea")

    const mounts = mi.split("\n").filter((l) => l.includes("<StopControl"))
    expect(mounts).toHaveLength(1)
    // …and that ONE line hands it the thread and the variant, nothing else.
    expect(mounts[0]).toContain("threadId=")
    expect(mounts[0]).toContain('variant="composer"')

    // The page mounts none — the control is the composer's, not the page's.
    expect(ca.split("\n").filter((l) => l.includes("<StopControl"))).toHaveLength(0)

    // Positive control: the needle DOES match when a second mount is present.
    expect(
      `${mi}\n<StopControl threadId={x} variant="composer" />`
        .split("\n")
        .filter((l) => l.includes("<StopControl")),
    ).toHaveLength(2)
  })

  /**
   * ⚠ THE STOP-DISPATCHER PROP IS GONE FROM BOTH FILES, AND THE NEEDLE IS RAW ON
   * PURPOSE. Neither `MessageInput.tsx` nor `ChatArea.tsx` spells it anywhere —
   * including in the docblocks explaining its removal, which say so explicitly.
   * That is the `run_lifecycle.py` app-shutdown-gate discipline: a raw count of
   * ZERO means the prop is absent, and any occurrence at all means it came back.
   *
   * ⚠ A later editor who "tidies" either docblock by naming the prop breaks this
   * fence silently. That is why both files carry a warning saying so.
   */
  it("neither the composer nor the page carries a Stop-dispatcher prop any more", () => {
    const NEEDLE = /onStop/g
    const mi = messageInputSource as string
    const ca = chatAreaSource as string

    expect((mi.match(NEEDLE) ?? []).length).toBe(0)
    expect((ca.match(NEEDLE) ?? []).length).toBe(0)
    // Positive controls, one per file.
    expect((`${mi}\nonStop`.match(NEEDLE) ?? []).length).toBe(1)
    expect((`${ca}\nonStop`.match(NEEDLE) ?? []).length).toBe(1)
  })

  /** D-08 held mechanically on the mount too, not only inside the component. */
  it("neither file reads a lock's runId nor calls cancelRun directly", () => {
    expect(((messageInputSource as string).match(NEEDLE_LOCK_OR_CANCEL) ?? []).length).toBe(0)
    expect(((chatAreaSource as string).match(NEEDLE_LOCK_OR_CANCEL) ?? []).length).toBe(0)
  })

  /** ⚠ The prose about the width gap must SURVIVE. A later editor who deletes it
   *  removes the only place a reader learns the fence does not cover width. */
  it("the docblock states the width gap and names G-4 row 1 as where it is judged", () => {
    const src = stopControlSource as string
    expect(src).toContain("G-4 row 1")
    expect(src.toLowerCase()).toContain("width")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// THE GLYPH
// ─────────────────────────────────────────────────────────────────────────────
describe("194.1-04 D-18 — the Stop CONTROL is the lucide Square on every arm", () => {
  it("neither ■ nor ⏹ is rendered in any arm of any variant", async () => {
    for (const variant of ["composer", "panel", "tray", "page"] as const) {
      const { container } = renderStop({ threadId: THREAD, variant })
      expect(container.textContent ?? "", `${variant} resting`).not.toContain("■")
      expect(container.textContent ?? "", `${variant} resting`).not.toContain("⏹")

      setStopping(THREAD, true)
      await waitFor(() => expect(container.textContent ?? "").toContain("Stopping this run"))
      expect(container.textContent ?? "", `${variant} stopping`).not.toContain("■")
      expect(container.textContent ?? "", `${variant} stopping`).not.toContain("⏹")

      setStopping(THREAD, false)
      setNotConfirmed(THREAD, true)
      expect(container.textContent ?? "", `${variant} not-confirmed`).not.toContain("■")
      expect(container.textContent ?? "", `${variant} not-confirmed`).not.toContain("⏹")

      setNotConfirmed(THREAD, false)
      cleanup()
    }
  })

  it("each resting control contains exactly one svg", () => {
    for (const [variant, testId] of [
      ["composer", "composer-stop"],
      ["panel", "panel-stop-run"],
      ["tray", "tray-stop-run"],
      ["page", "run-page-stop"],
    ] as const) {
      renderStop({ threadId: THREAD, variant })
      expect(screen.getByTestId(testId).querySelectorAll("svg").length, variant).toBe(1)
      cleanup()
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// TASK 2 — R2's THREE TIMING POINTS, AT COMPONENT LEVEL
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Plan 03 proved these three points at PROVIDER level, on the store Sets. This
 * block proves the same three at COMPONENT level, on what a person can actually
 * see — pressed with a real click, read off the rendered DOM. It does not
 * duplicate that suite; it mounts on top of it.
 *
 * ⚠ ALL THREE POINTS ARE REQUIRED, and the reason is mechanical rather than
 * stylistic. A block asserting only *"the control is back at t+8000"* passes under
 * a **1 ms** timeout — and therefore also under plant P4 (`STOP_TIMEOUT_MS` set to
 * 3000). The t+7000 case is the one that fires under P4, and the t+2000 case is the
 * ONLY one that proves `clearTimeout` actually runs (P6).
 *
 * ⚠ `advanceTimersByTimeAsync`, never the sync form: the resolvers await a bucket
 * scan and (on the no-row arm) a frame read, so a sync advance leaves those
 * microtasks unflushed. `WorkflowRunPage.test.tsx:1171` uses the `…Async` form for
 * exactly that reason. Every advance is inside `act`.
 */
describe("194.1-04 R2 — the climb-down, measured at three points on the RENDERED control", () => {
  beforeEach(() => {
    // See `snapshotStillStreaming`'s docblock — without this the Phase 145-05
    // watchdog finalizes the seeded thread at t+5000 and every reading below
    // measures the watchdog instead of R2.
    snapshotStillStreaming(PRODUCER_RUN_ID)
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("at t+7000 the reading is STILL shown and no control is back (plant P4)", async () => {
    cancelHangs()
    renderStop({ threadId: THREAD, variant: "composer" })
    seedLiveRun(THREAD)

    fireEvent.click(screen.getByTestId("composer-stop"))

    // R1: the reading is on in the SAME tick, before any await yields.
    expect(screen.getByTestId("composer-stopping").textContent).toBe(COPY_STOPPING)
    expect(screen.queryByTestId("composer-stop")).toBeNull()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(STOP_WINDOW_MS - 1000)
    })

    expect(screen.getByTestId("composer-stopping")).toBeTruthy()
    expect(screen.queryByTestId("composer-stop")).toBeNull()
    expect(screen.queryByText(COPY_STOP_NOT_CONFIRMED)).toBeNull()
  })

  it("at t+8000 a PRESSABLE control is back beside the not-confirmed copy", async () => {
    cancelHangs()
    renderStop({ threadId: THREAD, variant: "composer" })
    seedLiveRun(THREAD)

    fireEvent.click(screen.getByTestId("composer-stop"))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(STOP_WINDOW_MS)
    })

    const btn = screen.getByTestId("composer-stop")
    expect(btn).toBeTruthy()
    expect((btn as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByText(COPY_STOP_NOT_CONFIRMED)).toBeTruthy()
    expect(screen.queryByTestId("composer-stopping")).toBeNull()
  })

  /**
   * ⚠ THE ONLY CASE THAT PROVES `clearTimeout` ACTUALLY RUNS (plant P6). Clearing
   * the flag on terminal without clearing the HANDLE leaves a timer that fires at
   * t+8000 over a thread that terminated at t+2000 — raising "not confirmed" about
   * a stop that WAS confirmed. That is a new lie, in the one phase whose subject is
   * an honest Stop.
   */
  it("a cancel that terminates at t+2000 NEVER shows the not-confirmed copy, even past t+8000", async () => {
    cancelHangs()
    renderStop({ threadId: THREAD, variant: "composer" })
    seedLiveRun(THREAD)

    fireEvent.click(screen.getByTestId("composer-stop"))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(screen.getByTestId("composer-stopping")).toBeTruthy()

    reachTerminal(THREAD)
    expect(screen.queryByTestId("composer-stopping")).toBeNull()
    expect(screen.queryByText(COPY_STOP_NOT_CONFIRMED)).toBeNull()

    // Well past the window the ARMED timer would have fired at.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(STOP_WINDOW_MS + 2000)
    })
    expect(screen.queryByText(COPY_STOP_NOT_CONFIRMED)).toBeNull()
    expect(screen.queryByTestId("composer-stopping")).toBeNull()
    expect(screen.getByTestId("composer-stop")).toBeTruthy()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// TASK 2 — D-06: TWO MOUNTS, ONE STATE
// ─────────────────────────────────────────────────────────────────────────────
describe("194.1-04 D-06 — two mounts for one thread move together (plant P5)", () => {
  it("pressing ONE removes BOTH controls, because neither owns the state", () => {
    cancelHangs()
    renderTwoStops(THREAD)
    seedLiveRun(THREAD)

    // Both are present and both are real, pressable controls.
    expect(screen.getByTestId("composer-stop")).toBeTruthy()
    expect(screen.getByTestId("panel-stop-run")).toBeTruthy()

    // Press exactly ONE of them.
    fireEvent.click(screen.getByTestId("panel-stop-run"))

    // ⚠ BOTH leave the DOM. With component-local state the composer's would still
    // be sitting there pressable — a second press on a run already stopping, which
    // is precisely what R1's "impossible by construction" forbids.
    expect(screen.queryByTestId("panel-stop-run")).toBeNull()
    expect(screen.queryByTestId("composer-stop")).toBeNull()

    // …and BOTH show the reading, from the one store slice.
    expect(screen.getByTestId("composer-stopping").textContent).toBe(COPY_STOPPING)
    expect(screen.getByTestId("panel-stopping").textContent).toBe(COPY_STOPPING)
  })

  it("the terminal returns BOTH controls together", () => {
    cancelHangs()
    renderTwoStops(THREAD)
    seedLiveRun(THREAD)

    fireEvent.click(screen.getByTestId("composer-stop"))
    expect(screen.queryByTestId("panel-stop-run")).toBeNull()

    reachTerminal(THREAD)

    expect(screen.getByTestId("composer-stop")).toBeTruthy()
    expect(screen.getByTestId("panel-stop-run")).toBeTruthy()
    expect(screen.queryByTestId("composer-stopping")).toBeNull()
    expect(screen.queryByTestId("panel-stopping")).toBeNull()
  })
})

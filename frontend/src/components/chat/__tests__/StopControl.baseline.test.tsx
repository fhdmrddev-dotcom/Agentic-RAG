/**
 * Phase 194.1 Plan 01 (Wave 1) — THE THREE SHIPPED STOP MOUNTS, AS THEY RENDER TODAY.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE IS NAMED FOR A COMPONENT THAT DOES NOT EXIST
 * ─────────────────────────────────────────────────────────────────────────────
 * `StopControl` is what D-05 will build: one shared component the four mounts
 * render, reading a StreamsProvider store slice. It does not exist at this
 * commit — and that is the point. This suite is the CHARACTERIZATION of what
 * that component must preserve, captured BEFORE it exists.
 *
 * A characterization baseline only proves something if it PREDATES the change
 * (the 188.1 lesson, re-proved in 193 and 193.1). Phase 194.1 rewrites all four
 * Stop mounts. Every assertion below would, if written afterwards, be a
 * recording of the new behaviour wearing the word "baseline".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT IS PINNED, AND THE ONE THING THAT IS DELIBERATELY NOT
 * ─────────────────────────────────────────────────────────────────────────────
 * Per mount: the control's FULL `className` string read out of the rendered DOM
 * and asserted as a LITERAL — never a token subset. A token-subset assertion
 * (`toContain("border-destructive/40")`) survives a rewrite that drops six other
 * classes, which is exactly the drift this phase is at risk of.
 *
 * ⚠ The literals below were MEASURED off the rendered DOM at this commit, not
 * transcribed from source. That distinction is load-bearing for the composer:
 * `MessageInput`'s Stop is a shadcn `<Button variant="outline" size="icon">`,
 * so the DOM string is `buttonVariants()` merged with the file's own className
 * through tailwind-merge — a value NO ONE can read off `MessageInput.tsx:417`.
 * A fence built on the source literal would test the transcription.
 *
 * ⚠ NOT pinned: geometry. Per CONTEXT D-24, jsdom returns 0 for all layout, and
 * the only `getBoundingClientRect` anywhere in this tree's tests is a NEGATIVE
 * source fence (`PhaseNodeCard.test.tsx:523-527`). A plan promising a measured
 * slot is promising something jsdom cannot deliver; the honest successor fence
 * is class-token identity on a fixed-size reservation wrapper.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE FOURTH MOUNT IS AN ABSENCE, AND IT IS SWEPT WITH A LENGTH GUARD
 * ─────────────────────────────────────────────────────────────────────────────
 * `WorkflowRunPage.tsx` has NO Stop control — that is `BUG-260816-01`'s second
 * half and what R3 adds. It is pinned as a source sweep, and the sweep asserts
 * its own input is non-empty FIRST. The 192.1 lesson: a fence swept against an
 * empty string passes green and proves nothing (a renamed module was measured
 * doing exactly that).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE THREE ABSENCES THAT WILL BE INVERTED
 * ─────────────────────────────────────────────────────────────────────────────
 * `Stopping this run` appears in NONE of the three rendered DOMs today. Plans
 * 04/05/06 invert exactly these three assertions, and their inversion is the
 * only proof available that the reading is NEW rather than pre-existing.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * GATE SCOPE — measured, not assumed
 * ─────────────────────────────────────────────────────────────────────────────
 * This file is NOT executed by `scripts/vitest-count-gate.cjs`. `TARGETS` has
 * exactly one directory entry (`src/components/workflows`) and reaches
 * everything else by NAMED FILE; there is no `src/components/chat` entry
 * anywhere in the array. See `194.1-BASELINE.md` §2 for the enumeration.
 * Adding one is a gate-scope change this phase has not scoped — a later plan
 * that wants it owes its own stated reason.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { Phase, WorkspaceFile, Thread } from "@/types"

// ── The StreamsProvider module mock ───────────────────────────────────────────
// ⚠ ONE mock serves BOTH the panel and the tray, and that is a deliberate
// constraint rather than a convenience: `vi.mock` is FILE-GLOBAL, so a suite
// cannot mock the provider for `WorkspacePanel` and use the real one for
// `ActiveRunsTray`. Since this file captures rendered CHROME and never
// behaviour, the mocked shape is the correct one for both — no assertion below
// depends on a real store transition. (`MessageInput` imports the provider not
// at all: its Stop is pure presentation driven by the `disabled` prop.)
const useTodos = vi.fn()
const useWorkspaceFiles = vi.fn()
const useAskUserPrompt = vi.fn()
const useViewingThread = vi.fn()
const usePhases = vi.fn()
const useTasks = vi.fn()
const useWorkflowLockForThread = vi.fn()
const useDerivedPanel = vi.fn()
const useStreamActions = vi.fn()
const useStreamingThreadIds = vi.fn()
const getActiveRunStartMs = vi.fn()
const stopThread = vi.fn()
/**
 * ⚠ ADDED BY PLAN 04, AND THE ADDITION IS ITSELF A MEASUREMENT RATHER THAN
 * PLUMBING. `MessageInput` now renders `<StopControl>`, which reads these two
 * selectors. Left out of the mock they resolve to `undefined` and the composer
 * throws on render — so the fact that this file needed them at all is the proof
 * that the composer's Stop is now store-driven, which is exactly what this
 * baseline was captured to detect.
 *
 * They default to `false` in `beforeEach`, i.e. the RESTING arm — so every chrome
 * assertion below still measures the same thing it measured on the unmoved tree.
 */
const useStoppingForThread = vi.fn()
const useStopNotConfirmedForThread = vi.fn()

vi.mock("@/providers/StreamsProvider", () => ({
  useTodos: (...a: unknown[]) => useTodos(...a),
  useWorkspaceFiles: (...a: unknown[]) => useWorkspaceFiles(...a),
  useAskUserPrompt: (...a: unknown[]) => useAskUserPrompt(...a),
  useViewingThread: (...a: unknown[]) => useViewingThread(...a),
  usePhases: (...a: unknown[]) => usePhases(...a),
  useTasks: (...a: unknown[]) => useTasks(...a),
  useWorkflowLockForThread: (...a: unknown[]) => useWorkflowLockForThread(...a),
  useDerivedPanel: (...a: unknown[]) => useDerivedPanel(...a),
  useStreamActions: (...a: unknown[]) => useStreamActions(...a),
  useStreamingThreadIds: (...a: unknown[]) => useStreamingThreadIds(...a),
  getActiveRunStartMs: (...a: unknown[]) => getActiveRunStartMs(...a),
  useStoppingForThread: (...a: unknown[]) => useStoppingForThread(...a),
  useStopNotConfirmedForThread: (...a: unknown[]) => useStopNotConfirmedForThread(...a),
}))

// The panel's run-soul effect reads these; resolve them to an honest empty frame
// so no case below depends on an unhandled rejection's timing.
const getThreadWorkflow = vi.fn()
const listPublishedWorkflows = vi.fn()
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    getThreadWorkflow: (...a: unknown[]) => getThreadWorkflow(...a),
    listPublishedWorkflows: (...a: unknown[]) => listPublishedWorkflows(...a),
  }
})

// Sentinel-stub the panel's heavy children exactly as `WorkspacePanel.test.tsx`
// does. None of them can render a Stop control, so stubbing them cannot hide one
// — and leaving them real would pull the genuine provider hooks back in.
vi.mock("@/components/panel/PhaseTimeline", () => ({
  PhaseTimeline: () => <div data-testid="phase-timeline">timeline</div>,
}))
vi.mock("@/components/panel/BatchResultList", () => ({
  BatchResultList: () => <div data-testid="batch-result-list">sub-results</div>,
}))
vi.mock("@/components/panel/TemplateUpload", () => ({
  TemplateUpload: () => <div data-testid="template-upload">upload</div>,
}))
vi.mock("@/components/panel/TodosSection", () => ({
  TodosSection: () => <div data-testid="todos-section">todos</div>,
}))
vi.mock("@/components/panel/FilesSection", () => ({
  FilesSection: () => <div data-testid="files-section">files</div>,
}))
vi.mock("@/components/panel/VersionDiff", () => ({
  VersionDiff: ({ file }: { file: { path: string } }) => (
    <div data-testid="version-diff">diff:{file.path}</div>
  ),
}))
vi.mock("@/components/panel/PendingAskCard", () => ({
  PendingAskStack: () => <div data-testid="pending-ask-stack">asks</div>,
}))

import { MessageInput, _resetComposerDraftsForTest } from "../MessageInput"
import { ActiveRunsTray } from "../ActiveRunsTray"
import { WorkspacePanel } from "@/components/panel/WorkspacePanel"
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — Vite `?raw` import, typed by vite/client at build time only.
import runPageSource from "@/pages/WorkflowRunPage.tsx?raw"

/**
 * The reading this phase INTRODUCES. Held as one constant so the three absence
 * cases below and the three inversions in plans 04/05/06 cannot drift apart by
 * being typed four times.
 */
const STOPPING_READING = "Stopping this run"

/**
 * ⚠ MEASURED OFF THE RENDERED DOM AT `a9e7d10c`, NOT TRANSCRIBED FROM SOURCE.
 * See the file docblock: the composer's value cannot be read off its source at
 * all, and the other two are recorded the same way for one consistent rule.
 */
const SHIPPED = {
  composer: {
    testid: "composer-stop",
    aria: "Stop generation",
    text: "",
    // ⚠ THIS IS THE VALUE THE PROOF DEPENDS ON, AND IT IS NOT IN `MessageInput.tsx`.
    // Source carries only the last 8 tokens (`:417`). Everything before
    // `border bg-background` is `buttonVariants({variant:"outline", size:"icon"})`
    // merged in by shadcn's `<Button>` through tailwind-merge. A plan that
    // "preserves the className" by copying the source line preserves 8 of 27
    // tokens and this assertion is what says so.
    className:
      "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border bg-background hover:text-accent-foreground h-8 w-8 rounded-lg shrink-0 transition-all border-destructive/40 text-destructive hover:bg-destructive/10 hover:border-destructive",
    iconClassName: "lucide lucide-square h-3.5 w-3.5 fill-current",
  },
  panel: {
    testid: "panel-stop-run",
    aria: "Stop this workflow run",
    text: "Stop",
    className:
      "ml-auto flex shrink-0 items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-[11px] text-destructive transition-colors hover:bg-destructive/20 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
    iconClassName: "lucide lucide-square h-2.5 w-2.5 fill-current",
  },
  tray: {
    aria: "Stop run on Quarterly close workflow",
    text: "Stop",
    // ⚠ Note this differs from the panel's by exactly TWO things — no `ml-auto`,
    // and `hover:bg-destructive/20 transition-colors` in the opposite order. The
    // panel and tray Stops are NOT the same string today, so a plan that unifies
    // them into one `<StopControl>` is making a real visual decision on at least
    // one surface. Recorded here so that decision is taken, not stumbled into.
    className:
      "flex shrink-0 items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-[11px] text-destructive hover:bg-destructive/20 transition-colors",
    iconClassName: "lucide lucide-square h-2.5 w-2.5 fill-current",
  },
} as const

const ISO = new Date("2026-08-16T10:00:00.000Z").toISOString()
function mkThread(id: string, title: string): Thread {
  return {
    id,
    user_id: "u",
    title,
    folder_id: null,
    created_at: ISO,
    updated_at: ISO,
  } as Thread
}
const TRAY_THREADS: Thread[] = [
  mkThread("thread-A", "Quarterly close workflow"),
  mkThread("thread-idle", "Not running"),
]

/** One phase, so `hasActivity` is true and the panel does not short-circuit to
 *  `<PanelEmpty/>` before the Stop row is ever reached. */
const ONE_PHASE = [
  { id: "p-1", run_id: "wr-1", phase_index: 0, slug: "gather", name: "Gather", status: "active" },
] as unknown as Phase[]

function setPanelHooks() {
  useTodos.mockReturnValue({ data: [], isLoading: false, error: null, reconcile: vi.fn() })
  useWorkspaceFiles.mockReturnValue({
    data: [] as WorkspaceFile[],
    isLoading: false,
    error: null,
    reconcile: vi.fn(),
  })
  useAskUserPrompt.mockReturnValue({ data: [], isLoading: false, error: null, reconcile: vi.fn() })
  useViewingThread.mockReturnValue("thread-1")
  usePhases.mockReturnValue({ data: ONE_PHASE, isLoading: false, error: null, reconcile: vi.fn() })
  useTasks.mockReturnValue({ data: [], isLoading: false, error: null, reconcile: vi.fn() })
  useWorkflowLockForThread.mockReturnValue({
    runId: "wr-1",
    mode: "harness",
    capPaused: false,
    continuesRemaining: 3,
  })
  useDerivedPanel.mockReturnValue([])
  useStreamActions.mockReturnValue({ stopThread })
}

function renderPanel() {
  return render(
    <WorkspacePanel
      selectedThread={{ id: "thread-1", title: "T" } as never}
      state="open"
      onToggle={vi.fn()}
      onExpand={vi.fn()}
    />,
  )
}

/**
 * The composer renders its Stop only while `disabled` — that IS the gate.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠ SUPERSEDED BY PHASE 194.1 PLAN 04 — 2026-08-16. The originals, VERBATIM:
 *
 *     function renderComposerStreaming() {
 *       return render(<MessageInput onSend={vi.fn()} onStop={vi.fn()} disabled={true} />)
 *     }
 *     function renderComposerIdle() {
 *       return render(<MessageInput onSend={vi.fn()} onStop={vi.fn()} disabled={false} />)
 *     }
 *
 * TWO changes, and both are consequences rather than convenience:
 *
 *  1. `onStop` is GONE from `MessageInput`'s `Props`. The composer carries no Stop
 *     dispatcher any more — `<StopControl>` calls `stopThread(threadId)` off the
 *     store (D-05). Passing it is now a TYPECHECK ERROR, which is how the removal
 *     enumerates its own call sites instead of a default hiding them.
 *
 *  2. `threadId` is now REQUIRED FOR THE STOP TO RENDER AT ALL, and that is a real
 *     behaviour change stated rather than smoothed: `<StopControl threadId={null}>`
 *     renders nothing, because a composer with no thread has no run to stop.
 *     ⚠ It loses NO live case, and the reason is a measurement, not a hope:
 *     `ChatArea.tsx` passes `disabled={isStreaming}` where `isStreaming =
 *     useStreamingForThread(thread?.id ?? null)`, which is `false` whenever there is
 *     no thread — so `disabled === true` IMPLIES a thread exists. The original
 *     helpers passed no `threadId` only because the shipped button did not need one.
 * ═══════════════════════════════════════════════════════════════════════════
 */
const BASELINE_THREAD = "thread-1"

function renderComposerStreaming() {
  return render(<MessageInput onSend={vi.fn()} disabled={true} threadId={BASELINE_THREAD} />)
}

function renderComposerIdle() {
  return render(<MessageInput onSend={vi.fn()} disabled={false} threadId={BASELINE_THREAD} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  _resetComposerDraftsForTest()
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: 1280,
  })
  setPanelHooks()
  useStreamingThreadIds.mockReturnValue(new Set<string>(["thread-A"]))
  // Plan 04: the RESTING arm by default, so every chrome assertion in this file
  // still measures what it measured on the unmoved tree.
  useStoppingForThread.mockReturnValue(false)
  useStopNotConfirmedForThread.mockReturnValue(false)
  getActiveRunStartMs.mockReturnValue(null)
  getThreadWorkflow.mockResolvedValue({ definition_slug: null })
  listPublishedWorkflows.mockResolvedValue([])
})

afterEach(() => {
  cleanup()
})

// ─────────────────────────────────────────────────────────────────────────────
describe("194.1-01 — mount 1: the composer Stop (MessageInput)", () => {
  it("renders the shipped control with its measured chrome", () => {
    renderComposerStreaming()
    const btn = screen.getByTestId(SHIPPED.composer.testid)

    expect(btn.tagName).toBe("BUTTON")
    expect(btn.getAttribute("aria-label")).toBe(SHIPPED.composer.aria)
    expect(btn.getAttribute("data-testid")).toBe(SHIPPED.composer.testid)
    expect(btn.textContent).toBe(SHIPPED.composer.text)
    expect(btn.className).toBe(SHIPPED.composer.className)

    const icon = btn.querySelector("svg")
    expect(icon).not.toBeNull()
    expect(icon!.getAttribute("class")).toBe(SHIPPED.composer.iconClassName)
  })

  it("does NOT render the Stop when the composer is idle — the gate is `disabled`", () => {
    renderComposerIdle()
    expect(screen.queryByTestId(SHIPPED.composer.testid)).toBeNull()
    expect(screen.getByTestId("composer-send")).toBeTruthy()
  })

  /**
   * ⚠ RECORDED BECAUSE IT CONSTRAINS PLAN 04 AND IS EASY TO GET BACKWARDS.
   * The keyboard hint at `MessageInput.tsx:404-408` is gated on `!disabled`, so
   * it is ALREADY absent whenever the Stop renders. The stopping reading cannot
   * "push it out of the row" — there is nothing there to push. Any plan claiming
   * the hint as a layout cost is describing a state that does not exist.
   */
  it("the keyboard hint is already absent whenever the Stop renders", () => {
    const idle = renderComposerIdle()
    expect(idle.container.textContent).toContain("Shift+Enter for newline")
    cleanup()

    const streaming = renderComposerStreaming()
    expect(streaming.container.textContent).not.toContain("Shift+Enter for newline")
  })

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * ⚠ SUPERSEDED BY PHASE 194.1 PLAN 04 — 2026-08-16. **THIS IS THE INVERSION THE
   * CASE WAS WRITTEN TO BE**, and its own title said so. The original, VERBATIM:
   *
   *     it(`does not contain "${STOPPING_READING}" anywhere — the absence plan 04 inverts`, () => {
   *       const { container } = renderComposerStreaming()
   *       expect(container.textContent ?? "").not.toContain(STOPPING_READING)
   *     })
   *
   * measured on the unmoved tree, where `grep -ri "stopping" frontend/src` returned
   * zero production hits of this reading. Plan 04 introduces it. The case is
   * INVERTED IN PLACE rather than deleted: an absent assertion cannot tell a
   * deliberate introduction from an oversight, and the inversion is the only
   * available proof that the reading is NEW rather than pre-existing.
   *
   * ⚠ BOTH DIRECTIONS ARE ASSERTED. Presence alone would be satisfied by a reading
   * that is ALWAYS on; the resting arm's absence is what makes it a state.
   * ═══════════════════════════════════════════════════════════════════════════
   */
  it(`shows "${STOPPING_READING}" while stopping, and NOT while resting (inverted by plan 04)`, () => {
    // Resting — the reading is absent, exactly as on the unmoved tree.
    const resting = renderComposerStreaming()
    expect(resting.container.textContent ?? "").not.toContain(STOPPING_READING)
    cleanup()

    // Stopping — the reading is present, and the CONTROL is gone (sketch 168-B).
    useStoppingForThread.mockReturnValue(true)
    const stopping = renderComposerStreaming()
    expect(stopping.container.textContent ?? "").toContain(STOPPING_READING)
    expect(screen.queryByTestId(SHIPPED.composer.testid)).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe("194.1-01 — mount 2: the panel Stop (WorkspacePanel)", () => {
  it("renders the shipped control with its measured chrome", () => {
    renderPanel()
    const btn = screen.getByTestId(SHIPPED.panel.testid)

    expect(btn.tagName).toBe("BUTTON")
    expect(btn.getAttribute("type")).toBe("button")
    expect(btn.getAttribute("aria-label")).toBe(SHIPPED.panel.aria)
    expect(btn.textContent?.trim()).toBe(SHIPPED.panel.text)
    expect(btn.className).toBe(SHIPPED.panel.className)

    const icon = btn.querySelector("svg")
    expect(icon).not.toBeNull()
    expect(icon!.getAttribute("class")).toBe(SHIPPED.panel.iconClassName)
    expect(icon!.getAttribute("aria-hidden")).toBe("true")
  })

  /** The lead word sits in its own node beside the control — recorded because
   *  D-08's successor reading occupies the slot the CONTROL leaves, not this. */
  it("the lead sits in a sibling node, not inside the button", () => {
    renderPanel()
    const btn = screen.getByTestId(SHIPPED.panel.testid)
    const row = btn.parentElement!
    expect(row.textContent).toContain("This run")
    expect(btn.textContent).not.toContain("This run")
  })

  it(`does not contain "${STOPPING_READING}" anywhere — the absence plan 05/06 inverts`, () => {
    const { container } = renderPanel()
    expect(container.textContent ?? "").not.toContain(STOPPING_READING)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe("194.1-01 — mount 3: the tray Stop (ActiveRunsTray)", () => {
  async function openTray() {
    const user = userEvent.setup()
    const result = render(<ActiveRunsTray threads={TRAY_THREADS} />)
    await user.click(screen.getByRole("button", { name: /run.? in progress/i }))
    return result
  }

  it("renders the per-run Stop with its measured chrome", async () => {
    await openTray()
    const btn = screen.getByRole("button", { name: SHIPPED.tray.aria })

    expect(btn.getAttribute("aria-label")).toBe(SHIPPED.tray.aria)
    expect(btn.textContent?.trim()).toBe(SHIPPED.tray.text)
    expect(btn.className).toBe(SHIPPED.tray.className)

    const icon = btn.querySelector("svg")
    expect(icon).not.toBeNull()
    expect(icon!.getAttribute("class")).toBe(SHIPPED.tray.iconClassName)
    expect(icon!.getAttribute("aria-hidden")).toBe("true")
  })

  /** The bulk control at `:105-112` renders only at 2+ runs. Recorded so a plan
   *  that gives every Stop a stopping state knows there is a FOURTH button on
   *  this surface, whose per-thread state is ambiguous by construction. */
  it("`Stop all` is absent at one run and present at two", async () => {
    await openTray()
    expect(screen.queryByRole("button", { name: "Stop all" })).toBeNull()
    cleanup()

    useStreamingThreadIds.mockReturnValue(new Set<string>(["thread-A", "thread-idle"]))
    await openTray()
    expect(screen.getByRole("button", { name: "Stop all" })).toBeTruthy()
  })

  it(`does not contain "${STOPPING_READING}" anywhere — the absence plan 06 inverts`, async () => {
    const { container } = await openTray()
    expect(container.textContent ?? "").not.toContain(STOPPING_READING)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe("194.1-01 — mount 4: WorkflowRunPage has NO Stop control (the R3 absence)", () => {
  /**
   * ⚠ THE LENGTH GUARD IS NOT CEREMONY. A `?raw` import that resolves to an
   * empty string makes every `not.toContain` below pass, and the suite then
   * reports green while measuring nothing. Phase 192.1 measured a renamed module
   * being swept against the empty string and passing — this assertion is the
   * only thing standing between that failure and a false PASS here.
   */
  it("the swept source is non-empty and is the right file", () => {
    const src = runPageSource as string
    expect(typeof src).toBe("string")
    expect(src.length).toBeGreaterThan(20000)
    // Identity, not just size: a non-empty sweep of the WRONG file is the same bug.
    expect(src).toContain("WorkflowRunPage")
    // ⚠ 1047, not the 1046 `wc -l` reports, and the discrepancy is recorded
    // rather than papered over: `wc -l` counts NEWLINE CHARACTERS while
    // `split("\n")` counts SEGMENTS, and a file ending in a trailing newline has
    // exactly one more segment than newline. Both numbers are right about
    // different questions. `194.1-BASELINE.md` §3 publishes the `wc -l` figure
    // (1046) because that is the ledger's unit; this fence publishes 1047
    // because that is what this expression measures.
    expect(src.split("\n").length).toBe(1047)
    expect(src.endsWith("\n")).toBe(true)
  })

  it("contains zero occurrences of onStop / stopThread / cancelRun / Stop", () => {
    const src = runPageSource as string
    expect(src.length).toBeGreaterThan(0)

    const hits = (src.match(/onStop|stopThread|cancelRun|Stop/g) ?? []).length
    expect(hits).toBe(0)
  })

  /**
   * The positive control for the sweep above. Without it, `hits === 0` is
   * equally consistent with a regex that cannot match anything — the same class
   * of un-fireable fence the length guard defends against, one level up.
   */
  it("the same regex DOES match when the pattern is present (positive control)", () => {
    const planted = `${runPageSource as string}\n// onStop`
    expect((planted.match(/onStop|stopThread|cancelRun|Stop/g) ?? []).length).toBe(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe("194.1-01 — the shipped Square icon is the ONE Stop-control mark", () => {
  /**
   * D-18 / 194-03 / 194-04: the Stop CONTROL is the lucide `Square` on every
   * mount. `■` is `RunCard`'s cancelled-STATE glyph (a state, not a control) and
   * `⏹` is net-new and absent from `icon-convention.md` §4. Pinned on the
   * RENDERED DOM rather than on source, so a plan that swaps the mark reds here
   * even if it leaves the import alone.
   */
  it("neither ■ nor ⏹ appears in any of the three rendered Stop mounts", async () => {
    const composer = renderComposerStreaming()
    expect(composer.container.textContent ?? "").not.toContain("■")
    expect(composer.container.textContent ?? "").not.toContain("⏹")
    cleanup()

    const panel = renderPanel()
    expect(panel.container.textContent ?? "").not.toContain("■")
    expect(panel.container.textContent ?? "").not.toContain("⏹")
    cleanup()

    const user = userEvent.setup()
    const tray = render(<ActiveRunsTray threads={TRAY_THREADS} />)
    await user.click(screen.getByRole("button", { name: /run.? in progress/i }))
    expect(tray.container.textContent ?? "").not.toContain("■")
    expect(tray.container.textContent ?? "").not.toContain("⏹")
  })

  it("each mount's Stop contains exactly one svg", async () => {
    renderComposerStreaming()
    expect(screen.getByTestId(SHIPPED.composer.testid).querySelectorAll("svg").length).toBe(1)
    cleanup()

    renderPanel()
    expect(screen.getByTestId(SHIPPED.panel.testid).querySelectorAll("svg").length).toBe(1)
    cleanup()

    const user = userEvent.setup()
    render(<ActiveRunsTray threads={TRAY_THREADS} />)
    await user.click(screen.getByRole("button", { name: /run.? in progress/i }))
    expect(
      screen.getByRole("button", { name: SHIPPED.tray.aria }).querySelectorAll("svg").length,
    ).toBe(1)
  })
})

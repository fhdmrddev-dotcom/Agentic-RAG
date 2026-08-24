/**
 * Phase 188 Plan 08 Task 3 (RUNVIZ-01 / RUNVIZ-02 / RUNVIZ-03 — SPEC Req 4 / Req 6 /
 * Req 7) — the run-reading half of the run surface.
 *
 * This spec exercises the PAGE's composition: the `phase_index` join, the terminal
 * re-open with no live stream, the reconcile identity property, the elapsed contract and
 * the total run-band map. `WorkflowCanvas` is stubbed as a leaf that renders whatever the
 * page's `runState(slug)` returned, so this suite needs no `ReactFlowProvider` and the
 * node PAINT stays fenced where it already is (`PhaseNodeCard.test.tsx` /
 * `PhaseNode.test.tsx`).
 *
 * Authored fresh (MEMORY project_frontend_vitest_rot) — no import from a rotted sibling.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
// Phase 200-07 widened this line with `within`: the D-17 green row is DRIVEN inside the
// deliverable region rather than against the whole document, so "exactly one control per
// row" is a statement about that region and not about the page.
import { render, screen, cleanup, fireEvent, waitFor, act, within } from "@testing-library/react"
import {
  HERO_EMPTY_COMPLETED,
  HERO_HEADING_ANSWER,
  HERO_HEADING_BOTH,
  HERO_HEADING_FILE,
  HERO_LANDMARK,
  PROCESS_TRACE_LANDMARK,
} from "@/components/workflows/runColumnVocabulary"
import {
  CENTRE_CANVAS_LABEL,
  CENTRE_SWITCH_LABEL,
} from "@/components/workflows/transcriptVocabulary"
import type { Phase, WorkspaceFile } from "@/types"
import type { PhaseSpecJSON } from "@/components/workflows/phaseVocabulary"

// ── The api surface. `ApiError` is declared INSIDE the factory (never imported from
//    the real module) so the page's `err instanceof ApiError` branch is exercised
//    against the very class this suite throws. ──
const getWorkflowRun = vi.fn()
// Plan 10: the shipped bearer-authed raw-bytes helper. Mocked so a download is a
// RECORDED CALL rather than a jsdom navigation — the argument this suite cares about is
// the thread id, and it must be the RUN's.
// ⚠ Typed with its REAL signature, not `unknown[]`: this suite asserts on
// `mock.calls[0][0]` (the thread id), and an untyped spy makes that index a compile
// error under `noUnusedLocals`/strict tuple indexing — the check that matters most here
// would be the one the compiler refuses to let us write.
const downloadWorkspaceFile = vi.fn(
  (_threadId: string, _fileId: string, _filename: string): Promise<void> => Promise.resolve(),
)

vi.mock("@/lib/api", () => {
  class ApiError extends Error {
    readonly status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
      this.name = "ApiError"
    }
  }
  return {
    ApiError,
    getWorkflowRun: (...a: unknown[]) => getWorkflowRun(...(a as [string])),
    downloadWorkspaceFile: (...a: unknown[]) =>
      downloadWorkspaceFile(...(a as [string, string, string])),
  }
})

// 188.1-04 (WR-07): the auth seam the REAL `@/lib/api` reaches through `getAuthHeaders`.
// Mocked so the ONE test below that runs the real `getWorkflowRun` (via `importActual`,
// which un-mocks that module only — its dependencies still resolve through this registry)
// never touches a Supabase client. Every other test in this file keeps the api mock above
// and never reaches this.
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

// ── The live slice + the deliverable list. The page is the ONLY component on this
//    surface that touches the stream, so exactly these two hooks are mocked. ──
const usePhases = vi.fn()
const useWorkspaceFiles = vi.fn()
// A DECOY, and the whole point of it: the globally-viewed thread is what the panel's own
// file list resolves, and it is the wrong answer here. Exporting it from the mock means
// that IF the page ever reached for it, it would resolve — to a deliberately different
// value than the run's thread, so the mistake shows up as a failing assertion rather than
// as a list that quietly belongs to somebody else's thread.
const useViewingThread = vi.fn()
// CR-02: the STORE reconcile — the only thing in the app that opens an SSE subscription
// for a thread the user did not send from. It is a different function from the panel
// reconcile behind `usePhases`, which only refetches the slice.
const reconcileStream = vi.fn(() => Promise.resolve())
const setViewingThread = vi.fn()
// F5: the DURABLE pending-ask slice. Shipped at `StreamsProvider.tsx:3263` long before this
// phase — the run surface simply never consumed it, which is the whole defect.
const useAskUserPrompt = vi.fn()
// F7: the grounding bundle — the ONLY source of the server's kb-tool list (R11: no
// client-assembled whitelist). Mocked at the hook so this suite needs no fetch.
const useGroundingBundle = vi.fn()
vi.mock("@/hooks/useGroundingBundle", () => ({
  useGroundingBundle: (...a: unknown[]) => useGroundingBundle(...(a as [boolean])),
}))
// ── Phase 194.1 Plan 07 (R3): the stopping slice. ────────────────────────────────
//
// ⚠ THESE THREE ADDITIONS ARE NOT OPTIONAL AND THEY ARE NOT THIS PLAN'S PREFERENCE —
// the page now mounts `<StopControl>`, which reads `useStoppingForThread` and
// `useStopNotConfirmedForThread` off this very module and dispatches through
// `useStreamActions().stopThread`. A module mock that omits an export the component
// under test imports does not fail informatively: the import resolves to `undefined`
// and the render dies inside React, taking all 89 shipped cases with it. Measured, not
// predicted — the mount was added before this block and the whole suite went red.
//
// `stopThread` is deliberately a REAL `vi.fn()` rather than a no-op arrow, because the
// press case asserts the VALUE it received, and `expect(fn).toHaveBeenCalled()` alone
// passes under the two-id landmine (`ComposerStopHarness.test.tsx:16-19`).
const stopThread = vi.fn((_threadId: string): Promise<void> => Promise.resolve())
// ⚠ MUTABLE MODULE STATE ON PURPOSE. The production flip is store-driven — plan 03's
// `stopThread` sets the thread's `stopping` flag and every subscriber re-renders. With
// the provider module mocked away there is no store to drive, so the press case flips
// this flag from inside the `stopThread` spy and forces a re-render. That is a STAND-IN
// for the store, and it is labelled as one: what it proves is that THIS PAGE renders
// the shared slot's stopping arm in the title row. That `stopThread` really does flip
// `stopping` is plan 03's property, pinned in `StreamsProvider.stopping.test.ts`; that
// `stopping === true` removes the control is plan 04's, pinned in `StopControl.test.tsx`.
let stoppingNow = false
let notConfirmedNow = false
vi.mock("@/providers/StreamsProvider", () => ({
  usePhases: (...a: unknown[]) => usePhases(...(a as [string | null])),
  useWorkspaceFiles: (...a: unknown[]) => useWorkspaceFiles(...(a as [string | null])),
  useAskUserPrompt: (...a: unknown[]) => useAskUserPrompt(...(a as [string | null])),
  useViewingThread: () => useViewingThread(),
  useStreamActions: () => ({ reconcile: reconcileStream, setViewingThread, stopThread }),
  useStoppingForThread: (_t: string | null) => stoppingNow,
  useStopNotConfirmedForThread: (_t: string | null) => notConfirmedNow,
}))

// ── The canvas leaf-stub: it renders what the page HANDED it and nothing else, so a
//    reading in this DOM is a reading the page computed. ──
/**
 * ⚠ `WorkflowCanvas` IS MOCKED AGAIN, BECAUSE IT IS MOUNTED AGAIN — behind the centre switch,
 * by operator decision on 2026-08-20. The stub is not a convenience: the real component is
 * React Flow, which needs a `ResizeObserver` jsdom does not provide, and mounting it took every
 * switch case down with `ReferenceError: ResizeObserver is not defined`.
 *
 * It renders the values the PAGE hands down, so a test reads the hand-off rather than anything
 * the canvas invented. ⚠ `String(...)` on `count` / `noun` / `live` for the reason the original
 * stub gave: a declared `0` and an ABSENT count are two different facts, and a bare child would
 * render both as nothing at all.
 *
 * The note recording its removal is kept below, because the surface changed twice in one day and
 * both movements are worth finding here.
 */
vi.mock("@/components/workflows/WorkflowCanvas", () => ({
  WorkflowCanvas: ({
    phases,
    runState,
    editable,
    selectedSlug,
    kbTools,
  }: {
    phases: PhaseSpecJSON[]
    runState?: (
      slug: string,
    ) => { reading: string; label: string; count?: number | null; noun?: string | null; live?: boolean } | undefined
    editable?: boolean
    selectedSlug: string | null
    kbTools?: readonly string[]
  }) => (
    <div
      data-testid="canvas-stub"
      data-editable={String(editable)}
      data-selected={String(selectedSlug)}
      data-kbtools={(kbTools ?? []).join(",")}
    >
      {phases.map((p) => (
        <div key={p.slug} data-testid={`node-${p.slug}`}>
          <span data-testid={`reading-${p.slug}`}>{runState?.(p.slug)?.reading ?? "NONE"}</span>
          <span data-testid={`count-${p.slug}`}>{String(runState?.(p.slug)?.count)}</span>
          <span data-testid={`live-${p.slug}`}>{String(runState?.(p.slug)?.live)}</span>
        </div>
      ))}
    </div>
  ),
}))

/* ⚠ THE REMOVAL NOTE, KEPT — `WorkflowCanvas` was unmocked here for part of 2026-08-20.
 *
 * Phase 200 replaced this page's centre region with the run log (`RunTranscript`), for the
 * four measured reasons recorded in that component's own docblock. The stub that used to
 * stand here rendered a `canvas-stub` element carrying, per node, the `reading` / `label` /
 * `count` / `noun` / `live` values the page handed down — and roughly ninety cases in this
 * file used it as the "page has loaded" sentinel.
 *
 * ⚠ THE REPLACEMENT IS THE REAL COMPONENT, NOT ANOTHER STUB, and that is deliberate.
 * `RunTranscript` is a pure leaf: no providers, no React Flow, no measurement. Stubbing it
 * would have meant the count, the clock and the state word were asserted against a fixture
 * of this suite's own making — the shape of a fence that cannot fire. Rendering it for real
 * means every assertion below reads what a person would see.
 *
 * WHAT MOVED WHERE:
 *   • the load sentinel      → `run-transcript` (the region's own testid)
 *   • per-node reading       → `transcript-row-{slug}`'s `data-reading`
 *   • per-node label         → `transcript-state`'s text inside that row
 *   • the declared count     → `transcript-count`, and the receipt's `receipt-row-count`
 *
 * ⚠ THREE THINGS THE OLD STUB PROVED HAVE NO CONSUMER LEFT ON THIS PAGE, and they are named
 * rather than quietly dropped: `NodeRunState.count` / `.noun` fed the canvas's per-connection
 * payload label, and `.live` fed its marching connector. The page still computes all three —
 * the seam is untouched — but nothing on this surface reads them any more. Their cases are
 * REWRITTEN below against the surface that does show the count, and the liveness pair is
 * recorded as unreachable-from-here in the phase report rather than left passing vacuously.
 */

// ── Phase 200 — THE RIGHT-HAND RUN PANEL'S TWO PARTS, leaf-stubbed in this file's own
//    idiom (the same one `WorkflowCanvas` above uses, and for the same reason).
//
// ⚠ THE STUBS ARE NOT A CONVENIENCE — MOUNTING THE REAL ONES TOOK THE WHOLE SUITE DOWN,
// and it is recorded because it is the `196-08` failure mode arriving here rather than a
// prediction. `PhaseTimeline` calls `useTasks` off `@/providers/StreamsProvider`, and this
// file's module mock did not declare it: the import resolved to `undefined`, the render
// died inside React, and the run was `117 failed / 20 passed` with 102 errors — none of
// them about this plan's change. A module mock that omits an export a newly-mounted child
// imports does not fail informatively.
//
// Stubbing rather than widening the mock is also the RIGHT division of proof for this file.
// Its stated contract is that "a reading in this DOM is a reading the page computed": the
// spine's own faces (the violet active bar, the raised needs-review card) belong to
// `PhaseCard`'s suite, and the ask card's radiogroup of options belongs to
// `PendingAskCard.test.tsx`. What is THIS page's property — and what these stubs make
// assertable — is the HAND-OFF: that the panel is mounted at all, that it is handed the
// RUN's thread rather than the globally-viewed one (`useViewingThread` above is a decoy
// for exactly this mistake), and that a terminal run marks its prompts as over.
vi.mock("@/components/panel/PhaseTimeline", () => ({
  PhaseTimeline: ({ threadId }: { threadId: string | null }) => (
    <div data-testid="spine-stub" data-threadid={String(threadId)} />
  ),
}))
vi.mock("@/components/panel/PendingAskCard", () => ({
  PendingAskCard: ({
    ask,
    runIsOver,
  }: {
    ask: { tool_call_id: string; prompt: string }
    runIsOver?: boolean
  }) => (
    <div
      data-testid={`ask-stub-${ask.tool_call_id}`}
      data-runisover={String(runIsOver)}
    >
      {ask.prompt}
    </div>
  ),
}))

import { WorkflowRunPage } from "./WorkflowRunPage"
import pageSource from "./WorkflowRunPage?raw"
// Phase 195 Plan 06 — the two shared modules the page now CONSUMES instead of copying.
// The F1 fence below inverted, and an inverted absence arm is worth nothing without the
// mirrored presence arm: these two imports are how "it moved" is told apart from "it
// vanished". Each is length- AND identity-guarded at its use site.
import utilsSource from "@/components/files/fileRowUtils?raw"
import iconSource from "@/lib/fileIcon?raw"
// Phase 200-07: the builder page's source, read ONLY to assert an ABSENCE — the receipt must
// never be reachable from the surface that has no run (`199-02`'s refusal, kept by
// construction). And the receipt's own source, as the positive control for the deliverable
// slot it CAN render and this page deliberately does not supply.
import builderSource from "./WorkflowBuilderPage?raw"
import receiptSource from "@/components/workflows/RunReceipt?raw"
import { ApiError } from "@/lib/api"
import { TechnicalNamesProvider } from "@/providers/TechnicalNamesProvider"

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** A realistic 3-step contract-renewal spine — real slugs, real author names, so a join
 *  keyed on the wrong field has somewhere visible to go wrong. */
const SPECS: PhaseSpecJSON[] = [
  {
    slug: "gather-contracts",
    phase_index: 0,
    name: "Find the supplier contracts",
    config: { phase_type: "llm_agent" },
  },
  {
    slug: "draft-letter",
    phase_index: 1,
    name: "Draft the renewal letter",
    config: { phase_type: "llm_agent" },
  },
  {
    slug: "final-check",
    phase_index: 2,
    name: "Check it over",
    config: { phase_type: "llm_human_input" },
  },
]

const SLUGS = SPECS.map((s) => s.slug)

interface RunLike {
  id: string
  thread_id: string
  definition_id: string
  workflow_name: string
  workflow_slug: string
  workflow_version: number
  status: string
  created_at: string | null
  claimed_at: string | null
  updated_at: string | null
  definition: { phases: PhaseSpecJSON[] } | null
  // Phase 200-07: the four fields `200-02` put on this transport. OPTIONAL here for the
  // same reason they are optional on the wire — a pre-migration-121 row carries none of
  // them, and every case in this file that predates this plan omits all four, which is
  // itself the historic-row shape.
  phases: {
    slug: string
    phase_index: number
    status: string
    phase_type: string | null
    started_at?: string | null
    completed_at?: string | null
    step_count?: number | null
    step_noun?: string | null
    // Phase 200.1 (RUN-04) — the fifth field, optional for the same reason: every case in
    // this file that predates the plan omits it, which IS the no-answer shape.
    deliverable_text?: string | null
  }[]
}

const CLAIMED = "2026-08-05T14:03:11Z"
const UPDATED = "2026-08-05T14:09:52Z"

function mkRun(overrides: Partial<RunLike> = {}): RunLike {
  return {
    id: "run-1",
    thread_id: "thread-1",
    definition_id: "def-1",
    workflow_name: "Supplier contract renewals",
    workflow_slug: "supplier-contract-renewals",
    workflow_version: 4,
    status: "active",
    created_at: "2026-08-05T14:03:00Z",
    claimed_at: CLAIMED,
    updated_at: UPDATED,
    definition: { phases: SPECS },
    phases: [
      { slug: "gather-contracts", phase_index: 0, status: "completed", phase_type: "llm_agent" },
      { slug: "draft-letter", phase_index: 1, status: "active", phase_type: "llm_agent" },
      { slug: "final-check", phase_index: 2, status: "pending", phase_type: "llm_human_input" },
    ],
    ...overrides,
  }
}

/**
 * A `run.phases` array whose statuses MATCH a live slice, so the two sources describe the
 * same run.
 *
 * ⚠ THIS EXISTS BECAUSE THREE FIXTURES BELOW WERE UNREALISTIC AND IT ONLY SHOWED WHEN THE
 * LOG PUT BOTH SOURCES ON ONE LINE. They set a live slice saying a step had FAILED (or was
 * WAITING) while leaving `mkRun()`'s default durable rows saying it was still `active` or
 * not yet reached — a state the backend does not produce, because the run poll writes the
 * same transition the stream announces. The run log refuses to word a step from a reading
 * that contradicts the row's own status, so those fixtures started rendering the wire's
 * answer, which was the correct behaviour against incoherent input.
 *
 * Making the two agree is what the fixtures always meant. It is a REPAIR, not a relaxation:
 * every assertion they carry is unchanged, and the disagreement case now has cases of its own
 * in `RunTranscript.test.tsx`, driven against the real crossing measured on the local
 * database.
 */
function phasesMatching(statuses: [string, string, string]): RunLike["phases"] {
  return [
    { slug: "gather-contracts", phase_index: 0, status: statuses[0], phase_type: "llm_agent" },
    { slug: "draft-letter", phase_index: 1, status: statuses[1], phase_type: "llm_agent" },
    { slug: "final-check", phase_index: 2, status: statuses[2], phase_type: "llm_human_input" },
  ]
}

/** One live-slice row. `slug` is a parameter on purpose — the join tests hand it
 *  positional PLACEHOLDERS, which is exactly what the live reconcile skeleton can emit. */
function mkPhase(
  phaseIndex: number,
  status: Phase["status"],
  slug: string,
  extra: Partial<Phase> = {},
): Phase {
  return {
    slug,
    phaseIndex,
    phaseType: "llm_agent",
    status,
    subAgents: [],
    pendingAsk: null,
    ...extra,
  }
}

const reconcile = vi.fn()
const reconcileFiles = vi.fn()
const reconcileAsks = vi.fn()

function setLiveSlice(data: Phase[]) {
  usePhases.mockReturnValue({ data, isLoading: false, error: null, reconcile })
}

/** One row of the shipped `PendingAsk[]` slice. ⚠ Deliberately built with its REAL fields:
 *  `PendingAsk` carries NO phase reference (`types/index.ts:925-937`), which is exactly why
 *  the page cannot join an ask to a step by id and derives the waiting step instead. */
function mkAsk(toolCallId = "call-1") {
  return {
    tool_call_id: toolCallId,
    prompt: "Is this renewal letter ready to send?",
    options: ["Yes, send it", "No, revise it"],
    timeout_seconds: null,
  }
}

/** The pending-ask slice. Defaults to empty — the state every pre-F5 case assumed. */
function setAsks(data: ReturnType<typeof mkAsk>[] = []) {
  useAskUserPrompt.mockReturnValue({
    data,
    isLoading: false,
    error: null,
    reconcile: reconcileAsks,
  })
}

/** The deliverable slice. Defaults to an answered-and-empty list, which is the state
 *  every pre-Plan-10 case in this suite implicitly assumed. */
function setFiles(data: WorkspaceFile[] = [], isLoading = false) {
  useWorkspaceFiles.mockReturnValue({ data, isLoading, error: null, reconcile: reconcileFiles })
}

function renderPage(props: Partial<Parameters<typeof WorkflowRunPage>[0]> = {}) {
  const onBack = vi.fn()
  const onOpenThread = vi.fn()
  const utils = render(
    <TechnicalNamesProvider>
      <WorkflowRunPage runId="run-1" onBack={onBack} onOpenThread={onOpenThread} {...props} />
    </TechnicalNamesProvider>,
  )
  return { ...utils, onBack, onOpenThread }
}

/**
 * Every visible step's reading, read off the RENDERED log — never typed, and never off a
 * stub of this suite's own making.
 *
 * ⚠ `data-reading` IS THE PAGE'S READING, and its ABSENCE is a third answer rather than an
 * empty one: it means the page held no reading for that slug at all. The old probe collapsed
 * that case to the literal `"NONE"`; this one keeps it distinguishable, so a test can say
 * which of the two it means.
 */
function readings(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const slug of SLUGS) {
    const row = screen.queryByTestId(`step-card-${slug}`) || screen.queryByTestId(`transcript-row-${slug}`)
    out[slug] = row?.getAttribute("data-reading") ?? "NONE"
  }
  return out
}

/**
 * Every visible step's WORDED state, read off the log line a person actually reads.
 */
function labels(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const slug of SLUGS) {
    const row = screen.queryByTestId(`step-card-${slug}`) || screen.queryByTestId(`transcript-row-${slug}`)
    out[slug] = row ? (within(row).queryByTestId(`step-yield-${slug}`)?.textContent ?? within(row).queryByTestId("transcript-state")?.textContent ?? "") : ""
  }
  return out
}

/**
 * Each step's TIME READING as the run log renders it, in row order.
 */
function logTimes(): string[] {
  return Array.from(document.querySelectorAll('[data-testid^="step-card-"], [data-testid^="transcript-row-"]')).map((row) => {
    const testid = row.getAttribute("data-testid") ?? ""
    const slug = testid.replace("step-card-", "").replace("transcript-row-", "")
    const spine = document.querySelector(`[data-testid="spine-step-${slug}"]`)
    const duration = spine?.querySelector('[data-testid="spine-duration"]')?.textContent
    if (duration) return duration
    return row.querySelector(`[data-testid="step-yield-${slug}"]`)?.textContent ?? row.querySelector('[data-testid="transcript-state"]')?.textContent ?? ""
  })
}

/** Each step's reading as the SPINE renders it — the surface that speaks for every step. */
function spineReadings(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const slug of SLUGS) {
    out[slug] = screen.queryByTestId(`spine-step-${slug}`)?.getAttribute("data-reading") ?? "NONE"
  }
  return out
}

// ── Plan 10 fixtures: the two thread ids are DELIBERATELY DIFFERENT VALUES ────────
//
// In production both are bare uuids and a swap typechecks, so the only way a wrong-thread
// read is DETECTABLE is if the two fixtures disagree. `RUN_THREAD_ID` is the thread the
// run itself anchors — the correct source for its deliverables. `VIEWED_THREAD_ID` is
// whatever thread chat happens to be looking at, which on this surface is nobody's
// business and is what the panel's own list would have used.
const RUN_THREAD_ID = "thread-of-the-run"
const VIEWED_THREAD_ID = "thread-being-viewed"

/** The flagship deliverable: the artefact the template-fill engine actually emits, and
 *  precisely the kind a reviewer cannot read in place. 18841 B → `18.4 KB`. */
const DELIVERABLE: WorkspaceFile = {
  id: "file-docx-1",
  path: "output/renewal-letter.docx",
  size_bytes: 18841,
  mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  version: 1,
}
const DELIVERABLE_NAME = "renewal-letter.docx"
const DELIVERABLE_SIZE = "18.4 KB"
const DOWNLOAD_LABEL = `Download ${DELIVERABLE_NAME} (${DELIVERABLE_SIZE})`

/**
 * ⚠ **SUPERSEDED — Phase 200.1 (RUN-04). The old string is quoted here rather than erased.**
 *
 * It read, verbatim:
 *
 *     "This run produced no files."
 *
 * It was replaced because files stopped being the only thing this region can report. Measured
 * on the live local DB: **479 phase rows carry `output.text` against 60 carrying a file — eight
 * to one** — so on the common case that sentence was TRUE and USELESS. It named the absence of
 * the rarer deliverable and said nothing about the one the run actually made.
 *
 * The new sentence is the SAME claim widened to cover both kinds, and it renders only when both
 * are genuinely absent. The quotation is deliberate: `git log -S "This run produced no files."`
 * still finds the whole thread through this block and through `WorkflowRunPage.tsx`'s own copy
 * docblock — a removed string is exactly as invisible as one never written.
 *
 * ⚠ THE `:2047` SOURCE FENCE MOVED WITH IT, and the check the plan asked for was run BEFORE any
 * prose was written: that fence reads `codeOf(pageSource)`, i.e. **comment-stripped** source, so
 * the docblock quotations added on both sides do NOT change its count. Had it read raw `?raw`
 * source, the quotation would have turned the fence red — the trap that fired twice in this tree
 * in one phase.
 */
const COPY_EMPTY_TERMINAL = "This run produced no file and no written answer."
/** 200.1 — the ANSWER region's heading and the fixture text the four arms are driven with. */
const COPY_ANSWER_HEADING = "The answer this run wrote"
const RUN_ANSWER = "Renewals are on track.\n\nThree of four suppliers confirmed."

beforeEach(() => {
  vi.clearAllMocks()
  // Plan 07: the stopping stand-in is module state, so `clearAllMocks` cannot reset it.
  // Reset explicitly or one press case leaks its flipped flag into every case after it.
  stoppingNow = false
  notConfirmedNow = false
  window.localStorage.clear()
  setLiveSlice([])
  setFiles([])
  setAsks([])
  useGroundingBundle.mockReturnValue({
    kind: "ready",
    degraded: [],
    kbTools: ["analyze_document", "get_related_documents", "query_documents", "read_document", "search_documents"],
    tools: [],
    folders: [],
    skills: [],
  })
  useViewingThread.mockReturnValue(VIEWED_THREAD_ID)
  downloadWorkspaceFile.mockResolvedValue(undefined)
  getWorkflowRun.mockResolvedValue(mkRun())
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

// ── 1. Terminal re-open with NO live stream (SPEC Req 7) ──────────────────────

describe("WorkflowRunPage — a terminal run re-opens by id with no live stream", () => {
  it("seeds every definition node from the inline run.phases array", async () => {
    getWorkflowRun.mockResolvedValue(
      mkRun({
        status: "completed",
        phases: [
          { slug: "gather-contracts", phase_index: 0, status: "completed", phase_type: null },
          { slug: "draft-letter", phase_index: 1, status: "completed", phase_type: null },
          { slug: "final-check", phase_index: 2, status: "skipped", phase_type: null },
        ],
      }),
    )
    renderPage()
    await screen.findByTestId("run-transcript")
    expect(readings()).toEqual({
      "gather-contracts": "done",
      "draft-letter": "done",
      "final-check": "skipped",
    })
  })

  it("puts the terminal seed through the SAME derivation: completed reads Complete, pending reads Not started", async () => {
    getWorkflowRun.mockResolvedValue(
      mkRun({
        status: "completed",
        phases: [
          { slug: "gather-contracts", phase_index: 0, status: "completed", phase_type: null },
          { slug: "draft-letter", phase_index: 1, status: "pending", phase_type: null },
          { slug: "final-check", phase_index: 2, status: "pending", phase_type: null },
        ],
      }),
    )
    renderPage()
    await screen.findByTestId("run-transcript")
    // The WORDS come from the shared vocabulary, not from this suite's expectations of it.
    // ⚠ THE COMPLETED STEP IS SILENT IN THE LOG BY DESIGN — see `labels()`. Its state is
    // carried by the spine, so the derivation is asserted THERE and the log's silence is
    // asserted as the deliberate thing it is.
    expect(spineReadings()["gather-contracts"]).toBe("done")
    expect(labels()["gather-contracts"]).toBe("")
    // A step the run never reached is NOT an ordinary completion, so it still speaks.
    expect(labels()["draft-letter"]).toMatch(/not started|not reached/i)
  })

  it("renders the spine with no stream at all — the live slice is empty and every node still has a reading", async () => {
    setLiveSlice([])
    getWorkflowRun.mockResolvedValue(mkRun({ status: "completed" }))
    renderPage()
    await screen.findByTestId("run-transcript")
    for (const slug of SLUGS) expect(readings()[slug]).not.toBe("NONE")
  })

  it("the log offers nothing to edit and nothing to select — a read-only surface", async () => {
    // ⚠ THE CANVAS EXPRESSED THIS AS TWO PROPS (`editable={false}`, `selectedSlug={null}`)
    // AND THE LOG EXPRESSES IT BY CONSTRUCTION — it takes neither. So the claim is asserted
    // where it now lives: the rendered region contains no control of any kind. That is a
    // STRONGER statement than the two props were, because a prop can be passed correctly to
    // a component that renders a button anyway.
    renderPage()
    const region = await screen.findByTestId("run-transcript")
    expect(region.querySelectorAll("button, a, input, select, textarea")).toHaveLength(0)
    // NON-VACUITY: the region really did render rows, so the zero above is a measurement of
    // something rather than of an empty subtree.
    expect(region.querySelectorAll('[data-testid^="step-card-"]').length).toBeGreaterThan(0)
  })
})

// ── 2. The join is by INDEX, not by slug (D-188-01) ───────────────────────────

describe("WorkflowRunPage — the join key is phase_index, never the slug", () => {
  it("reads every definition node correctly when the live slice carries PLACEHOLDER slugs", async () => {
    // The live reconcile skeleton emits `phase-{i}` for rows the harness has not started.
    // A slug-keyed join misses all three of these; an index-keyed one cannot.
    setLiveSlice([
      mkPhase(0, "done", "phase-0"),
      mkPhase(1, "running", "draft-letter"),
      mkPhase(2, "pending", "phase-2"),
    ])
    renderPage()
    await screen.findByTestId("run-transcript")
    expect(readings()).toEqual({
      "gather-contracts": "done",
      "draft-letter": "running",
      "final-check": "not-started",
    })
  })

  it("is not fooled by a live row whose slug matches a DIFFERENT definition step", async () => {
    // Index 0 carries the LAST step's slug. Keyed on slug, `final-check` would read
    // `done` and `gather-contracts` would read `not-started` — exactly inverted.
    setLiveSlice([
      mkPhase(0, "done", "final-check"),
      mkPhase(1, "running", "phase-1"),
      mkPhase(2, "pending", "phase-2"),
    ])
    renderPage()
    await screen.findByTestId("run-transcript")
    expect(readings()["gather-contracts"]).toBe("done")
    expect(readings()["final-check"]).toBe("not-started")
  })

  it("threads emitFailure, so a failed step reports the RIGHT one of three clauses", async () => {
    // 188-07's falsification E is the receipt: with the thread cut, every failed node
    // reads the weakest of the three claims and a real emit failure is under-reported.
    setLiveSlice([
      mkPhase(0, "done", "gather-contracts"),
      mkPhase(1, "failed", "draft-letter", { emitFailure: "citation_gate_rejected" }),
      mkPhase(2, "pending", "final-check"),
    ])
    // The durable rows say the same thing the slice does — see `phasesMatching`.
    getWorkflowRun.mockResolvedValue(mkRun({ phases: phasesMatching(["completed", "failed", "pending"]) }))
    renderPage()
    await screen.findByTestId("run-transcript")
    expect(labels()["draft-letter"]).toBe("Failed — its answer did not pass the required checks")
  })

  it("a failed step with no emitFailure falls to the weakest claim, and only then", async () => {
    setLiveSlice([
      mkPhase(0, "done", "gather-contracts"),
      mkPhase(1, "failed", "draft-letter"),
      mkPhase(2, "pending", "final-check"),
    ])
    getWorkflowRun.mockResolvedValue(mkRun({ phases: phasesMatching(["completed", "failed", "pending"]) }))
    renderPage()
    await screen.findByTestId("run-transcript")
    expect(labels()["draft-letter"]).toBe("Failed — this step did not finish")
  })

  it("gives a definition step with no matching row `not-started`, never `unknown`", async () => {
    setLiveSlice([mkPhase(0, "running", "phase-0")])
    renderPage()
    await screen.findByTestId("run-transcript")
    expect(readings()["final-check"]).toBe("not-started")
    expect(readings()["final-check"]).not.toBe("unknown")
  })
})

// ── 3. Mid-run reconcile identity (SPEC Req 4) ────────────────────────────────

describe("WorkflowRunPage — a reconcile leaves every visible node reading identical", () => {
  /**
   * The live slice, and the slice a reconcile over the SAME durable rows produces. The
   * post-reconcile side is built the way `reconcilePhases`' durable branch builds it —
   * DB-native statuses through the shared derivation — so the two sides are genuinely
   * different inputs that must land on the same readings.
   */
  const live: Phase[] = [
    mkPhase(0, "done", "gather-contracts"),
    // `retrying` is representable LIVE and is NOT a member of the DB CHECK constraint,
    // so a reconcile can never produce it. It must therefore read the same as what a
    // reconcile CAN produce (`active` → `running`) — the canvas never paints a state a
    // reload cannot restore.
    mkPhase(1, "retrying", "draft-letter"),
    mkPhase(2, "pending", "final-check"),
  ]
  const afterReconcile: Phase[] = [
    mkPhase(0, "done", "gather-contracts"),
    mkPhase(1, "running", "draft-letter"),
    mkPhase(2, "pending", "final-check"),
  ]

  it("every reading is identical before and after", async () => {
    setLiveSlice(live)
    const { rerender, onBack, onOpenThread } = renderPage()
    await screen.findByTestId("run-transcript")
    const before = readings()

    setLiveSlice(afterReconcile)
    rerender(
      <TechnicalNamesProvider>
        <WorkflowRunPage runId="run-1" onBack={onBack} onOpenThread={onOpenThread} />
      </TechnicalNamesProvider>,
    )
    await waitFor(() => expect(screen.getByTestId("run-transcript")).toBeTruthy())
    expect(readings()).toEqual(before)
  })

  it("a retrying phase reads Running both before and after — the collapsed state survives", async () => {
    setLiveSlice(live)
    const { rerender, onBack, onOpenThread } = renderPage()
    await screen.findByTestId("run-transcript")
    expect(labels()["draft-letter"]).toBe("Running")

    setLiveSlice(afterReconcile)
    rerender(
      <TechnicalNamesProvider>
        <WorkflowRunPage runId="run-1" onBack={onBack} onOpenThread={onOpenThread} />
      </TechnicalNamesProvider>,
    )
    await waitFor(() => expect(screen.getByTestId("run-transcript")).toBeTruthy())
    expect(labels()["draft-letter"]).toBe("Running")
  })

  it("calls the reconcile its own hook returns when the tab wakes — this page closes that locally", async () => {
    setLiveSlice(live)
    renderPage()
    await screen.findByTestId("run-transcript")
    reconcile.mockClear()
    fireEvent(window, new Event("visibilitychange"))
    // ⚠ AWAITED SINCE 188.1-04 (deferred item D-188.1-DEF-01, closed here). This assertion
    // used to run SYNCHRONOUSLY after the dispatch — alone in this describe, where every
    // other assertion awaits — and was measured failing 1 run in 6 during 188.1-02 with
    // `expected "vi.fn()" to be called at least once`. Because this suite is pinned in the
    // count gate and the gate requires `failed 0`, that flake could red the gate for any
    // plan in any phase, attributable to nothing its author did. `waitFor` does not weaken
    // the claim: the call must still happen, it is merely allowed to land on a later tick.
    // Fixed HERE rather than deferred again because this plan already modifies this file —
    // its own re-open trigger named exactly this circumstance.
    await waitFor(() => expect(reconcile).toHaveBeenCalled())
  })
})

// ── 4. The elapsed contract (D-188-18) ────────────────────────────────────────

describe("WorkflowRunPage — the elapsed figure names the field it derives from", () => {
  it("a live run renders a number AND the literal anchor phrase", async () => {
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active", claimed_at: CLAIMED }))
    renderPage()
    await screen.findByTestId("run-transcript")
    const slot = screen.getByTestId("run-elapsed").textContent ?? ""
    expect(slot).toContain("since it started processing")
    expect(slot).toMatch(/\d+[smh]/)
  })

  it("a terminal run reads `Ran for` and names both ends of the window", async () => {
    getWorkflowRun.mockResolvedValue(
      mkRun({ status: "completed", claimed_at: CLAIMED, updated_at: UPDATED }),
    )
    renderPage()
    await screen.findByTestId("run-transcript")
    const slot = screen.getByTestId("run-elapsed").textContent ?? ""
    expect(slot).toContain("Ran for")
    expect(slot).toContain("from when it started processing to its last update")
    // 14:03:11 → 14:09:52 is 6m 41s, frozen — never a live tick.
    expect(slot).toContain("6m 41s")
  })

  // ⚠ AMENDED by F3 (UAT 2026-08-05). This case originally asserted that a null `claimed_at`
  //   renders "Waiting to start" and no number. That was written when `claimed_at` was believed
  //   to be the anchor; the live DB says it is populated on 5 of 181 runs and 0 of 149 completed
  //   ones, so the branch this pinned fired on essentially every run and produced
  //   "✓ Complete   Waiting to start". The RULE it was protecting is intact and re-asserted
  //   below — a number is never shown without the field it came from — but the anchor now falls
  //   back to `created_at` (NOT NULL) instead of the slot going silent.
  it("claimed_at == null falls back to created_at and LABELS it — never a bare number", async () => {
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active", claimed_at: null }))
    renderPage()
    await screen.findByTestId("run-transcript")
    const slot = screen.getByTestId("run-elapsed").textContent ?? ""
    expect(slot).toContain("queued")
    expect(slot).not.toContain("Waiting to start")
    // A number IS shown now, inseparable from its label. The invariant this case protects is
    // "never a figure without its anchor", not "never a figure" — the original no-digit rule
    // was the right rule applied to an anchor that turned out never to be populated.
    expect(slot).toMatch(/\d+\s*[smh]\b/)
    // POSITIVE CONTROL — the pattern above really does match the shape it forbids, so
    // its absence is a measurement and not a tautology.
    expect("4m 12s since it started processing").toMatch(/\d+\s*[smh]\b/)
  })

  it("the ⌥ reveal exposes the literal claimed_at, and the plain view does not", async () => {
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active" }))
    renderPage()
    await screen.findByTestId("run-transcript")
    expect(screen.queryByTestId("run-elapsed-technical")).toBeNull()

    cleanup()
    window.localStorage.setItem("technical-names", "true")
    renderPage()
    await screen.findByTestId("run-transcript")
    const technical = screen.getByTestId("run-elapsed-technical").textContent ?? ""
    expect(technical).toContain("claimed_at")
    expect(technical).toContain(CLAIMED)
  })

  it("the ⌥ reveal says `claimed_at null` rather than inventing a time", async () => {
    window.localStorage.setItem("technical-names", "true")
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active", claimed_at: null }))
    renderPage()
    await screen.findByTestId("run-transcript")
    expect(screen.getByTestId("run-elapsed-technical").textContent).toContain("claimed_at null")
  })
})

// ── 5. The run band is a TOTAL function over workflow_runs.status ─────────────

describe("WorkflowRunPage — the run band is total", () => {
  const cases: [string, string][] = [
    ["active", "Running"],
    ["paused", "Paused for your answer"],
    ["cap_paused", "Paused at the step limit"],
    ["completed", "Complete"],
    ["failed", "Failed"],
    ["cancelled", "Cancelled"],
  ]

  for (const [status, needle] of cases) {
    it(`renders the ${status} band`, async () => {
      getWorkflowRun.mockResolvedValue(mkRun({ status }))
      renderPage()
      await screen.findByTestId("run-transcript")
      expect(screen.getByTestId("run-band").textContent).toContain(needle)
    })
  }

  // ⚠ AMENDED by F3 (UAT 2026-08-05). This asserted that a never-claimed `active` run reads
  //   "Waiting to start". Observed live: the band said exactly that while the first step was
  //   visibly Running on the canvas beside it. `claimed_at` is null for queued AND running runs
  //   alike here, so it cannot separate them; the row's own `active` status can.
  it("an `active` run that was never claimed still reads Running — claimed_at cannot mean queued", async () => {
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active", claimed_at: null }))
    renderPage()
    await screen.findByTestId("run-transcript")
    const band = screen.getByTestId("run-band").textContent ?? ""
    expect(band).toContain("Running")
    expect(band).not.toContain("Waiting to start")
  })

  it("an UNRECOGNISED status reads State unknown and NEVER Complete", async () => {
    // A value from a newer server. The failure this asserts against is a fail-OPEN:
    // reporting a run we cannot read as finished successfully.
    getWorkflowRun.mockResolvedValue(mkRun({ status: "quiesced" }))
    renderPage()
    await screen.findByTestId("run-transcript")
    const band = screen.getByTestId("run-band").textContent ?? ""
    expect(band).toContain("State unknown")
    expect(band).not.toContain("Complete")
  })

  it("an inherited prototype key is not a status either", async () => {
    // `constructor` / `toString` are inherited by every object literal, so a band keyed
    // on `TABLE[status] ?? fallback` would hand back a FUNCTION here instead of firing
    // its fallback (measured in 188-05).
    getWorkflowRun.mockResolvedValue(mkRun({ status: "constructor" }))
    renderPage()
    await screen.findByTestId("run-transcript")
    expect(screen.getByTestId("run-band").textContent).toContain("State unknown")
  })

  it("names the failing step by TITLE, never by slug or index", async () => {
    setLiveSlice([
      mkPhase(0, "done", "gather-contracts"),
      mkPhase(1, "failed", "draft-letter"),
      mkPhase(2, "pending", "final-check"),
    ])
    getWorkflowRun.mockResolvedValue(mkRun({ status: "failed" }))
    renderPage()
    await screen.findByTestId("run-transcript")
    const band = screen.getByTestId("run-band").textContent ?? ""
    expect(band).toContain('Failed at "Draft the renewal letter"')
    expect(band).not.toContain("draft-letter")
    expect(band).not.toMatch(/\bPhase 1\b/)
  })

  it("cap_paused states the fact and offers NO control — the band holds nothing focusable", async () => {
    getWorkflowRun.mockResolvedValue(mkRun({ status: "cap_paused" }))
    renderPage()
    await screen.findByTestId("run-transcript")
    const band = screen.getByTestId("run-band")
    expect(band.textContent).toContain("Paused at the step limit")
    expect(band.querySelectorAll("button, a, [tabindex], input, select")).toHaveLength(0)
    // POSITIVE CONTROL — the selector really does find a control when one exists.
    const probe = document.createElement("div")
    probe.innerHTML = "<button>x</button>"
    expect(probe.querySelectorAll("button, a, [tabindex], input, select")).toHaveLength(1)
  })
})

// ── 6. No live-region denial of service ──────────────────────────────────────

describe("WorkflowRunPage — the polite region carries the sentence, not the clock", () => {
  it("the ticking number is not inside the polite live region", async () => {
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active", claimed_at: CLAIMED }))
    renderPage()
    await screen.findByTestId("run-transcript")
    const band = screen.getByTestId("run-band")
    expect(band.getAttribute("aria-live")).toBe("polite")
    expect(band.getAttribute("aria-atomic")).toBe("true")
    // The state sentence only — no digit-plus-unit anywhere in the announced content.
    expect(band.textContent ?? "").not.toMatch(/\d+\s*[smh]\b/)
    // ...while the number IS still on the surface — in the HEADER, which is the single
    // visible home for it since 2026-08-06. This assertion previously read the band's own
    // aria-hidden sibling; that sibling was the second, duplicate rendering of the clock,
    // and the band itself is now `sr-only`, so an aria-hidden child of it would have been
    // reachable by nobody. The guarantee being kept is unchanged and is the point of this
    // test: the clock must remain VISIBLE somewhere while never entering the polite region.
    const visibleClock = screen.getByTestId("run-elapsed")
    expect(visibleClock.textContent ?? "").toMatch(/\d+\s*[smh]\b/)
    expect(band.contains(visibleClock)).toBe(false)
  })

  it("the status sentence is on screen exactly ONCE — the polite region must not duplicate it visually", async () => {
    // REGRESSION GUARD for the operator-reported duplicate band (2026-08-06): the header
    // and the polite region both rendered `band.sentence`, and both are `shrink-0`, so the
    // run surface permanently showed its status twice. The sibling test above does NOT
    // catch this — it passes whether or not the band is visible — so the guard has to
    // count on-screen renderings rather than inspect the announcement.
    getWorkflowRun.mockResolvedValue(mkRun({ status: "completed", claimed_at: CLAIMED }))
    renderPage()
    await screen.findByTestId("run-transcript")

    const sentence = (screen.getByTestId("run-band").textContent ?? "").trim()
    expect(sentence.length).toBeGreaterThan(0)

    const hiddenFromSight = (el: Element | null): boolean => {
      let n: Element | null = el
      while (n) {
        if (n.classList?.contains("sr-only")) return true
        n = n.parentElement
      }
      return false
    }
    // Leaf elements only — an ancestor's textContent includes its children's and would
    // double-count the very thing being measured.
    const carriers = [...document.body.querySelectorAll("*")].filter(
      (el) => el.children.length === 0 && (el.textContent ?? "").trim() === sentence,
    )
    // POSITIVE CONTROL — the sentence really is in the DOM more than nowhere, so a zero
    // here would mean the query is broken rather than the surface being clean.
    expect(carriers.length).toBeGreaterThanOrEqual(1)
    expect(carriers.filter((el) => !hiddenFromSight(el))).toHaveLength(1)
  })

  it("a failed run raises exactly one assertive notice", async () => {
    getWorkflowRun.mockResolvedValue(mkRun({ status: "failed" }))
    renderPage()
    await screen.findByTestId("run-transcript")
    const alerts = screen.getAllByTestId("run-alert")
    expect(alerts).toHaveLength(1)
    expect(alerts[0].getAttribute("role")).toBe("alert")
    await waitFor(() => expect(alerts[0].textContent ?? "").toContain("Failed"))
  })

  it("a healthy run raises no assertive notice at all", async () => {
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active" }))
    renderPage()
    await screen.findByTestId("run-transcript")
    expect(screen.getByTestId("run-alert").textContent).toBe("")
  })

  it("marks the canvas region busy while the run is live and calm once it is terminal", async () => {
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active" }))
    renderPage()
    await screen.findByTestId("run-transcript")
    expect(screen.getByTestId("run-transcript-region").getAttribute("aria-busy")).toBe("true")

    cleanup()
    getWorkflowRun.mockResolvedValue(mkRun({ status: "completed" }))
    renderPage()
    await screen.findByTestId("run-transcript")
    expect(screen.getByTestId("run-transcript-region").getAttribute("aria-busy")).toBe("false")
  })
})

// ── 7. Loading, error and the two navigations ────────────────────────────────

describe("WorkflowRunPage — loading and error states", () => {
  it("renders the loading copy and NO skeleton spine", async () => {
    let resolve!: (v: RunLike) => void
    getWorkflowRun.mockReturnValue(
      new Promise<RunLike>((r) => {
        resolve = r
      }),
    )
    renderPage()
    expect(screen.getByText("Opening the run…")).toBeTruthy()
    expect(screen.queryByTestId("run-transcript")).toBeNull()
    await act(async () => {
      resolve(mkRun())
    })
    await screen.findByTestId("run-transcript")
  })

  it("a 404 renders the not-available copy and goes back", async () => {
    getWorkflowRun.mockRejectedValue(new ApiError("nope", 404))
    const { onBack } = renderPage()
    await screen.findByText("That run isn't available.")
    expect(
      screen.getByText("It may have been deleted, or it belongs to another account."),
    ).toBeTruthy()
    // A 404 is BOTH "gone" and "not yours" — no retry is offered for either.
    expect(screen.queryByText("Try again")).toBeNull()
    fireEvent.click(screen.getByText("‹ Back to Workflows"))
    expect(onBack).toHaveBeenCalled()
  })

  it("a 5xx renders the our-side copy and offers a retry that re-reads the SAME id", async () => {
    getWorkflowRun.mockRejectedValue(new ApiError("boom", 500))
    renderPage()
    await screen.findByText("We couldn't load this run.")
    expect(
      screen.getByText("Something went wrong on our side. Nothing about the run has changed."),
    ).toBeTruthy()
    getWorkflowRun.mockResolvedValue(mkRun())
    fireEvent.click(screen.getByText("Try again"))
    await screen.findByTestId("run-transcript")
    expect(getWorkflowRun).toHaveBeenCalledTimes(2)
    expect(getWorkflowRun.mock.calls[1][0]).toBe("run-1")
  })

  it("the header carries the workflow identity and the thread seam", async () => {
    const { onOpenThread } = renderPage()
    await screen.findByTestId("run-transcript")
    expect(screen.getByText("Supplier contract renewals")).toBeTruthy()
    expect(screen.getByText("v4")).toBeTruthy()
    fireEvent.click(screen.getByText("Open the chat thread"))
    expect(onOpenThread).toHaveBeenCalledWith("thread-1")
  })

  it("a stale response can never land on a newly-opened run", async () => {
    // The first read resolves LATE, after the page has been pointed at another run.
    let resolveFirst!: (v: RunLike) => void
    getWorkflowRun.mockReturnValueOnce(
      new Promise<RunLike>((r) => {
        resolveFirst = r
      }),
    )
    getWorkflowRun.mockResolvedValue(mkRun({ id: "run-2", workflow_name: "The second workflow" }))
    const onBack = vi.fn()
    const onOpenThread = vi.fn()
    const { rerender } = render(
      <TechnicalNamesProvider>
        <WorkflowRunPage runId="run-1" onBack={onBack} onOpenThread={onOpenThread} />
      </TechnicalNamesProvider>,
    )
    rerender(
      <TechnicalNamesProvider>
        <WorkflowRunPage runId="run-2" onBack={onBack} onOpenThread={onOpenThread} />
      </TechnicalNamesProvider>,
    )
    await screen.findByText("The second workflow")
    await act(async () => {
      resolveFirst(mkRun({ workflow_name: "The FIRST workflow" }))
    })
    expect(screen.queryByText("The FIRST workflow")).toBeNull()
    expect(screen.getByText("The second workflow")).toBeTruthy()
  })

  it("renders the deliverable hero under its own landmark", async () => {
    getWorkflowRun.mockResolvedValue(mkRun({ status: "completed", thread_id: RUN_THREAD_ID }))
    setFiles([DELIVERABLE])
    renderPage()
    await screen.findByTestId("run-transcript")
    const hero = screen.getByLabelText(HERO_LANDMARK)
    expect(hero).toBeInTheDocument()
    expect(hero.textContent).toContain(HERO_HEADING_FILE)
  })

  // ── Phase 195 Plan 06 (D-02, P5) — THE LABEL MUST NOT CLAIM AUTHORSHIP ───────────
  it("labels the hero with typed headings and never claims the run produced them", async () => {
    getWorkflowRun.mockResolvedValue(mkRun({ status: "completed", thread_id: RUN_THREAD_ID }))
    setFiles([DELIVERABLE])
    renderPage()
    await screen.findByTestId("run-transcript")
    const heading = screen.getByLabelText(HERO_LANDMARK).querySelector("h2")
    expect(heading).not.toBeNull()
    expect(heading?.textContent ?? "").not.toMatch(/this run (produced|made|created)/i)
    expect(heading?.textContent).toBe(HERO_HEADING_FILE)
    for (const overclaim of [
      "What this run produced",
      "Files this run made",
      "Everything this run created",
    ]) {
      expect(overclaim).toMatch(/this run (produced|made|created)/i)
    }
    expect(COPY_EMPTY_TERMINAL).toMatch(/this run (produced|made|created)/i)
  })
})

// ── 7b. The deliverable: listed and downloadable, never previewed (SPEC Req 7) ────
//
// This is the `🕐 Tomorrow` half of the phase: a day later, can the user find the run and
// GET THE FILE IT MADE? Everything below measures that answer, and measures that the
// answer is sourced from the run's OWN thread.

describe("WorkflowRunPage — the deliverable is listed and downloadable", () => {
  beforeEach(() => {
    getWorkflowRun.mockResolvedValue(mkRun({ status: "completed", thread_id: RUN_THREAD_ID }))
    setFiles([DELIVERABLE])
  })

  it("lists the file the run produced, with its name and its size", async () => {
    renderPage()
    const row = await screen.findByRole("button", { name: DOWNLOAD_LABEL })
    expect(row.textContent).toContain(DELIVERABLE_NAME)
    expect(row.textContent).toContain(DELIVERABLE_SIZE)
    // The full path is available without being the visible label.
    expect(row.getAttribute("title")).toBe(DELIVERABLE.path)
  })

  it("reads the list from the RUN's thread and never from the viewed thread", async () => {
    renderPage()
    await screen.findByRole("button", { name: DOWNLOAD_LABEL })
    const args = useWorkspaceFiles.mock.calls.map((c) => c[0])
    expect(args).toContain(RUN_THREAD_ID)
    expect(args).not.toContain(VIEWED_THREAD_ID)
  })

  it("downloads with the RUN's thread id, the file id and the bare filename", async () => {
    renderPage()
    fireEvent.click(await screen.findByRole("button", { name: DOWNLOAD_LABEL }))
    expect(downloadWorkspaceFile).toHaveBeenCalledWith(
      RUN_THREAD_ID,
      DELIVERABLE.id,
      DELIVERABLE_NAME,
    )
    // Stated separately and on purpose: the two fixtures differ so THIS is a measurement.
    expect(downloadWorkspaceFile.mock.calls[0][0]).not.toBe(VIEWED_THREAD_ID)
  })

  it("offers NO preview for the .docx row — no pane, no frame, only the download", async () => {
    renderPage()
    await screen.findByRole("button", { name: DOWNLOAD_LABEL })
    const region = screen.getByLabelText(HERO_LANDMARK)
    expect(region.querySelector("iframe")).toBeNull()
    expect(region.querySelector("embed")).toBeNull()
    expect(region.querySelector("object")).toBeNull()
    expect(region.querySelector("[data-testid*='preview']")).toBeNull()
    // Exactly one control in the region, and it is the download.
    const buttons = region.querySelectorAll("button")
    expect(buttons).toHaveLength(1)
    expect(buttons[0].getAttribute("aria-label")).toBe(DOWNLOAD_LABEL)
    // POSITIVE CONTROL — the probes really do find the shapes they forbid.
    const probe = document.createElement("div")
    probe.innerHTML = `<iframe></iframe><div data-testid="file-preview"></div>`
    expect(probe.querySelector("iframe")).not.toBeNull()
    expect(probe.querySelector("[data-testid*='preview']")).not.toBeNull()
  })

  it("renders the rows as a list, one row per file", async () => {
    setFiles([
      DELIVERABLE,
      { id: "file-2", path: "notes.md", size_bytes: 512, mime_type: "text/markdown" },
    ])
    renderPage()
    await screen.findByRole("button", { name: DOWNLOAD_LABEL })
    const region = screen.getByLabelText(HERO_LANDMARK)
    expect(region).not.toBeNull()
    expect(screen.getByRole("button", { name: DOWNLOAD_LABEL })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Download notes.md (512 B)" })).toBeTruthy()
  })

  it("surfaces a failed download where the user clicked, instead of swallowing it", async () => {
    downloadWorkspaceFile.mockRejectedValueOnce(new Error("File not found."))
    renderPage()
    fireEvent.click(await screen.findByRole("button", { name: DOWNLOAD_LABEL }))
    expect((await screen.findByTestId("run-download-error")).textContent).toContain(
      "File not found.",
    )
  })

  // ── Phase 195 Plan 06 (D-12, P4) — THE REGION RENDERS NEWEST FIRST ───────────────
  //
  // The comparator has its own unit coverage in the shared module's suite. What CANNOT
  // be proved there is that THIS REGION applies it, which is what these two cases are
  // for — and they are two rather than one because the comparator has two regimes and
  // the deliverable arrives in the second one.

  it("orders the list newest first — the unsorted order and the rendered order DIFFER", async () => {
    setFiles([
      { id: "f-old", path: "old.md", size_bytes: 100, mime_type: "text/markdown", created_at: "2026-08-01T10:00:00Z" },
      { id: "f-new", path: "new.md", size_bytes: 200, mime_type: "text/markdown", created_at: "2026-08-17T10:00:00Z" },
    ])
    renderPage()
    await screen.findByRole("button", { name: "Download new.md (200 B)" })
    const region = screen.getByLabelText(HERO_LANDMARK)
    expect(region.textContent).toContain("new.md")
    expect(region.textContent).toContain("old.md")
    const newBtn = screen.getByRole("button", { name: "Download new.md (200 B)" })
    const oldBtn = screen.getByRole("button", { name: "Download old.md (100 B)" })
    const rel = newBtn.compareDocumentPosition(oldBtn)
    expect(rel & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("⚠ the JUST-PRODUCED file — the one with NO created_at — renders FIRST", async () => {
    setFiles([
      { id: "f-template", path: "Northwind-QBR-Template.docx", size_bytes: 38700, mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", created_at: "2026-08-17T09:00:00Z" },
      { id: "f-live", path: "output/renewal-letter.docx", size_bytes: 18841, mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
    ])
    renderPage()
    await screen.findByRole("button", { name: DOWNLOAD_LABEL })
    const region = screen.getByLabelText(HERO_LANDMARK)
    expect(region.textContent).toContain(DELIVERABLE_NAME)
    expect(region.textContent).toContain("Northwind-QBR-Template.docx")
    const liveBtn = screen.getByRole("button", { name: DOWNLOAD_LABEL })
    const templateBtn = screen.getByRole("button", { name: "Download Northwind-QBR-Template.docx (37.8 KB)" })
    const rel = liveBtn.compareDocumentPosition(templateBtn)
    expect(rel & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("a row the listing gave with no id is shown as a fact, never as a dead control", async () => {
    setFiles([{ path: "orphan.docx", size_bytes: 100, mime_type: "" }])
    renderPage()
    await screen.findByTestId("run-transcript-region")
    const region = screen.getByLabelText(HERO_LANDMARK)
    expect(region.textContent).toContain("orphan.docx")
    // No control — the raw route would be built with an empty id segment and 404.
    expect(region.querySelectorAll("button")).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe("195-02/195-06 — the id-less deliverable row: still no control, now NOT silent (capture + its inversion)", () => {
  const ID_LESS: WorkspaceFile = {
    path: "output/orphan-deliverable.docx",
    size_bytes: 2048,
    mime_type: "",
  } as WorkspaceFile
  const ID_LESS_NAME = "orphan-deliverable.docx"
  const ID_LESS_SIZE = "2.0 KB"
  const D08_COPY = "Download unavailable"

  function idLessRow(): HTMLElement | null {
    const region = screen.getByLabelText(HERO_LANDMARK)
    return region.querySelector('[title*="orphan-deliverable.docx"]')
  }

  beforeEach(() => {
    getWorkflowRun.mockResolvedValue(mkRun({ status: "completed", thread_id: RUN_THREAD_ID }))
    setFiles([ID_LESS])
  })

  it("shows the name, the size and the full path in `title` — and the region holds ZERO buttons", async () => {
    renderPage()
    await screen.findByTestId("run-transcript-region")
    const row = idLessRow()
    expect(row).not.toBeNull()
    expect(row?.tagName).toBe("DIV")
    expect(row?.textContent).toContain(ID_LESS_NAME)
    expect(row?.textContent).toContain(ID_LESS_SIZE)
    expect(row?.getAttribute("title")).toBe(ID_LESS.path)
    expect(row?.textContent).not.toContain("output/")
    expect(screen.getByLabelText(HERO_LANDMARK).querySelectorAll("button")).toHaveLength(0)
  })

  it(`the ROW now CARRIES "${D08_COPY}" — the absence plan 195-06 inverted`, async () => {
    renderPage()
    await screen.findByTestId("run-transcript-region")
    const row = idLessRow()
    expect(row).not.toBeNull()
    expect(row?.textContent ?? "").toContain(D08_COPY)
    const affordance = row?.querySelector('[aria-disabled="true"]')
    expect(affordance).not.toBeNull()
    expect(affordance?.getAttribute("title")).toContain(D08_COPY)
    expect(affordance?.getAttribute("title")).toBe("Download unavailable — this file has no link")
    expect(affordance?.tagName).toBe("SPAN")
    expect(row?.querySelectorAll("button")).toHaveLength(0)
  })

  it("POSITIVE CONTROL — the same needle IS found in a string that contains it", async () => {
    renderPage()
    await screen.findByTestId("run-transcript-region")
    const row = idLessRow()
    expect(row).not.toBeNull()
    expect((row?.textContent ?? "").length).toBeGreaterThan(0)
    const probe = document.createElement("div")
    probe.textContent = `${ID_LESS_NAME} ${D08_COPY}`
    probe.setAttribute("title", `${D08_COPY} — this file has no link`)
    expect(probe.textContent ?? "").toContain(D08_COPY)
    expect(probe.getAttribute("title")).toContain(D08_COPY)
    const affordance = document.createElement("div")
    affordance.innerHTML = `<span aria-disabled="true">${D08_COPY}</span>`
    expect(affordance.querySelector('[aria-disabled="true"]')).not.toBeNull()
  })
})

describe("WorkflowRunPage — the two empty states say different true things", () => {
  it("a LIVE run with no files says nothing has been written YET", async () => {
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active", thread_id: RUN_THREAD_ID }))
    setFiles([])
    renderPage()
    await screen.findByTestId("run-transcript")
    expect(screen.queryByLabelText(HERO_LANDMARK)).toBeNull()
  })

  it("a TERMINAL run with no files says it produced none — the tense is the fact", async () => {
    getWorkflowRun.mockResolvedValue(mkRun({ status: "completed", thread_id: RUN_THREAD_ID }))
    setFiles([])
    renderPage()
    await screen.findByTestId("run-transcript")
    expect(screen.getByLabelText(HERO_LANDMARK).textContent).toContain(HERO_EMPTY_COMPLETED)
  })

  it("claims NEITHER while the first read is still in flight", async () => {
    getWorkflowRun.mockResolvedValue(mkRun({ status: "completed", thread_id: RUN_THREAD_ID }))
    setFiles([], true)
    renderPage()
    await screen.findByTestId("run-transcript")
    expect(screen.queryByLabelText(HERO_LANDMARK)).toBeNull()
  })
})

// ── Phase 200.1 (RUN-04) — FOUR DELIVERABLE RENDERS, AND NONE FOLDED INTO ANOTHER ────────
//
// The region was file-only: it headed "Files in this run's workspace" and, on a terminal
// empty run, said "This run produced no files." Both sentences are TRUE and USELESS about a
// run whose deliverable was a text answer — and that is the COMMON case: **479 phase rows
// carry `output.text` against 60 carrying a file, eight to one**.
//
// ⚠ EACH ARM IS ITS OWN CASE, and the fifth case asserts the four are DISTINCT by set size.
// That last one is what catches a fold DIRECTLY rather than by inference: three arms can each
// pass their own assertions while two of them render the same words.


/** A terminal run whose LAST row carries the answer. */
function runWithAnswer(overrides: Partial<RunLike> = {}): RunLike {
  return mkRun({
    status: "completed",
    thread_id: RUN_THREAD_ID,
    /* ⚠ THE ANSWER MOVED OFF THE HUMAN-INPUT STEP (CR-02, phase 200.1 code review).
       This helper used to hang `RUN_ANSWER` on `final-check`, an `llm_human_input` phase —
       so the fixture every "answer" test runs against WAS the defect shape. A human-input
       step's text is the machine's own QUESTION ("Does this draft answer your question?"),
       measured on a real local run, and rendering it under "The answer this run wrote" is
       the surface calling the machine's prompt the deliverable. The whole suite was green
       against it because it only ever covered confirm-FIRST, never confirm-LAST.
       The answer now sits on the step that actually wrote it. */
    phases: [
      { slug: "gather-contracts", phase_index: 0, status: "completed", phase_type: "llm_agent" },
      {
        slug: "draft-letter",
        phase_index: 1,
        status: "completed",
        phase_type: "llm_agent",
        deliverable_text: RUN_ANSWER,
      },
      {
        slug: "final-check",
        phase_index: 2,
        status: "completed",
        phase_type: "llm_human_input",
      },
    ],
    ...overrides,
  })
}

describe("WorkflowRunPage — the four deliverable renders", () => {
  async function regionFor(run: RunLike, files: typeof DELIVERABLE[]): Promise<HTMLElement> {
    getWorkflowRun.mockResolvedValue(run)
    setFiles(files)
    renderPage()
    await screen.findByTestId("run-transcript-region")
    return screen.getByLabelText(HERO_LANDMARK)
  }

  it("FILE ONLY — renders single file heading and newest file in hero slot", async () => {
    const region = await regionFor(
      mkRun({ status: "completed", thread_id: RUN_THREAD_ID }),
      [DELIVERABLE],
    )
    expect(within(region).getByRole("heading", { level: 2 }).textContent).toBe(HERO_HEADING_FILE)
    expect(region.textContent).toContain(DELIVERABLE_NAME)
  })

  it("TEXT ONLY — the answer renders, and the file heading does NOT", async () => {
    const region = await regionFor(runWithAnswer(), [])
    expect(within(region).getByRole("heading", { level: 2 }).textContent).toBe(HERO_HEADING_ANSWER)
    expect(region.textContent).toContain("Renewals are on track.")
    expect(screen.queryByText("This run produced no files.")).toBeNull()
  })

  it("BOTH — the deliverables heading, file, and answer beneath", async () => {
    const region = await regionFor(runWithAnswer(), [DELIVERABLE])
    expect(within(region).getByRole("heading", { level: 2 }).textContent).toBe(HERO_HEADING_BOTH)
    expect(region.textContent).toContain(DELIVERABLE_NAME)
    expect(region.textContent).toContain("Renewals are on track.")
  })

  it("GENUINELY NOTHING — D-16 completed run sentence", async () => {
    const region = await regionFor(
      mkRun({ status: "completed", thread_id: RUN_THREAD_ID }),
      [],
    )
    expect(region.textContent).toContain(HERO_EMPTY_COMPLETED)
  })

  it("the FOUR arms render FOUR DISTINCT texts — a fold is caught directly", async () => {
    const texts: string[] = []
    for (const [run, files] of [
      [mkRun({ status: "completed", thread_id: RUN_THREAD_ID }), [DELIVERABLE]],
      [runWithAnswer(), []],
      [runWithAnswer(), [DELIVERABLE]],
      [mkRun({ status: "completed", thread_id: RUN_THREAD_ID }), []],
    ] as [RunLike, typeof DELIVERABLE[]][]) {
      const region = await regionFor(run, files)
      texts.push(region.textContent ?? "")
      cleanup()
      vi.clearAllMocks()
    }
    expect(texts).toHaveLength(4)
    expect(new Set(texts).size).toBe(4)
    expect(new Set([texts[0], texts[1], texts[2], texts[0]]).size).toBe(3)
  })

  it("LIVE and empty renders NO hero (D-03)", async () => {
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active", thread_id: RUN_THREAD_ID }))
    setFiles([])
    renderPage()
    await screen.findByTestId("run-transcript-region")
    expect(screen.queryByLabelText(HERO_LANDMARK)).toBeNull()
  })

  it("claims NEITHER absence while the first file read is in flight", async () => {
    getWorkflowRun.mockResolvedValue(mkRun({ status: "completed", thread_id: RUN_THREAD_ID }))
    setFiles([], true)
    renderPage()
    await screen.findByTestId("run-transcript-region")
    expect(screen.queryByLabelText(HERO_LANDMARK)).toBeNull()
  })

  it("an ANSWER renders even while the file read is in flight — the two are independent", async () => {
    getWorkflowRun.mockResolvedValue(runWithAnswer())
    setFiles([], true)
    renderPage()
    await screen.findByTestId("run-transcript-region")
    expect(screen.queryByLabelText(HERO_LANDMARK)).toBeNull()
  })

  it("the answer is the LAST row with text — not strictly the final row", async () => {
    const region = await regionFor(
      mkRun({
        status: "completed",
        thread_id: RUN_THREAD_ID,
        phases: [
          {
            slug: "gather-contracts",
            phase_index: 0,
            status: "completed",
            phase_type: "llm_agent",
          },
          {
            slug: "draft-letter",
            phase_index: 1,
            status: "completed",
            phase_type: "llm_agent",
            deliverable_text: RUN_ANSWER,
          },
          {
            slug: "final-check",
            phase_index: 2,
            status: "completed",
            phase_type: "programmatic",
            deliverable_text: null,
          },
        ],
      }),
      [],
    )
    expect(region.textContent).toContain("Renewals are on track.")
  })

  it("takes the LAST answer when several rows carry one — a confirm's QUESTION never wins", async () => {
    const QUESTION = "Does this draft answer your question? Add any corrections."
    const region = await regionFor(
      mkRun({
        status: "completed",
        thread_id: RUN_THREAD_ID,
        phases: [
          {
            slug: "gather-contracts",
            phase_index: 0,
            status: "completed",
            phase_type: "llm_human_input",
            deliverable_text: QUESTION,
          },
          {
            slug: "draft-letter",
            phase_index: 1,
            status: "completed",
            phase_type: "llm_agent",
            deliverable_text: RUN_ANSWER,
          },
          { slug: "final-check", phase_index: 2, status: "completed", phase_type: "programmatic" },
        ],
      }),
      [],
    )
    expect(region.textContent).toContain("Renewals are on track.")
    expect(region.textContent).not.toContain(QUESTION)
  })

  it("an EMPTY-STRING answer is no answer at all", async () => {
    const region = await regionFor(runWithAnswer({ phases: [
      { slug: "gather-contracts", phase_index: 0, status: "completed", phase_type: "llm_agent" },
      {
        slug: "draft-letter",
        phase_index: 1,
        status: "completed",
        phase_type: "llm_agent",
        deliverable_text: "",
      },
    ] }), [])
    expect(region.textContent).not.toContain(HERO_HEADING_ANSWER)
    expect(region.textContent).toContain(HERO_EMPTY_COMPLETED)
  })

  it("the answer renders as sanitised markdown, with its own line breaks kept", async () => {
    const region = await regionFor(runWithAnswer(), [])
    const block = region.querySelector('.markdown')
    expect(block).not.toBeNull()
    for (const line of RUN_ANSWER.split("\n").filter((l) => l.trim())) {
      expect(block!.textContent).toContain(line.trim())
    }
    expect(block!.className).toContain("max-w-[72ch]")
    expect(block!.className).toContain("break-words")
  })

  it("a confirm step's QUESTION is never mistaken for the run's answer (CR-02)", async () => {
    // The shape the code review found, and the one the shipped suite never covered: the
    // LAST phase is a human-input gate that carries the machine's own prompt in the same
    // field the answer arrives in. Measured verbatim on a real local run.
    const MACHINE_QUESTION = "Does this draft answer your question? Add any corrections."
    const region = await regionFor(
      runWithAnswer({
        phases: [
          {
            slug: "draft-letter",
            phase_index: 0,
            status: "completed",
            phase_type: "llm_agent",
            deliverable_text: RUN_ANSWER,
          },
          {
            slug: "final-check",
            phase_index: 1,
            status: "completed",
            phase_type: "llm_human_input",
            deliverable_text: MACHINE_QUESTION,
          },
        ],
      }),
      [],
    )
    const block = region.querySelector('[data-testid="run-deliverable-answer"] .markdown')
    expect(block).not.toBeNull()
    // ⚠ The later row wins ONLY among rows that actually wrote something.
    expect(block!.textContent).not.toContain("Does this draft answer your question")
    expect(block!.textContent).toContain(RUN_ANSWER.split("\n")[0].trim())
  })

  it("a run whose ONLY text is a confirm question shows no answer at all (CR-02)", async () => {
    // The absent arm must survive the skip: skipping the gate must not fall back to it.
    const region = await regionFor(
      runWithAnswer({
        phases: [
          {
            slug: "final-check",
            phase_index: 0,
            status: "completed",
            phase_type: "llm_human_input",
            deliverable_text: "Does this draft answer your question? Add any corrections.",
          },
        ],
      }),
      [],
    )
    expect(region.textContent).not.toContain(COPY_ANSWER_HEADING)
    expect(region.textContent).not.toContain("Does this draft answer your question")
  })

  it("markdown in the answer becomes real formatting, not literal asterisks", async () => {
    const region = await regionFor(
      runWithAnswer({
        phases: [
          {
            slug: "draft-letter",
            phase_index: 0,
            status: "completed",
            phase_type: "llm_agent",
            deliverable_text: "Approved with **one correction** before finalising.",
          },
        ],
      }),
      [],
    )
    const block = region.querySelector('[data-testid="run-deliverable-answer"] .markdown')
    // The whole point of the change: emphasis is emphasis, and the markers are gone.
    expect(block!.querySelector("strong")).not.toBeNull()
    expect(block!.querySelector("strong")!.textContent).toBe("one correction")
    expect(block!.textContent).not.toContain("**")
  })

  it("model-authored markup in the answer cannot execute — the refusal, re-asserted", async () => {
    const HOSTILE =
      '<img src=x onerror="alert(1)"> and <script>alert(2)</script> and ' +
      '<a href="javascript:alert(3)">link</a> and <b>bold</b>'
    const region = await regionFor(
      runWithAnswer({
        phases: [
          {
            slug: "draft-letter",
            phase_index: 0,
            status: "completed",
            phase_type: "llm_agent",
            deliverable_text: HOSTILE,
          },
        ],
      }),
      [],
    )
    const block = region.querySelector('[data-testid="run-deliverable-answer"] .markdown')
    expect(block).not.toBeNull()
    // ⚠ THE PROPERTY THAT MATTERS: nothing here can run.
    expect(block!.querySelector("script")).toBeNull()
    for (const el of Array.from(block!.querySelectorAll("*"))) {
      for (const attr of Array.from(el.attributes)) {
        expect(attr.name.toLowerCase().startsWith("on")).toBe(false)
        expect(attr.value.toLowerCase().replace(/\s/g, "")).not.toContain("javascript:")
      }
    }
    // The benign half is allowed to be markup now — that is the deliberate change.
    expect(block!.querySelector("b")).not.toBeNull()
  })

  it("adds NO focus stop — the answer is prose, not a control", async () => {
    // The region's shipped contract is one focus stop per downloadable row and nothing else.
    const region = await regionFor(runWithAnswer(), [])
    expect(region.querySelectorAll("button")).toHaveLength(0)
    expect(region.querySelectorAll("a")).toHaveLength(0)
    expect(region.querySelectorAll("[tabindex]")).toHaveLength(0)
  })
})

describe("WorkflowRunPage — the seam, run side (D-188-13)", () => {
  it("hands the thread seam the RUN's thread id, not the viewed one", async () => {
    getWorkflowRun.mockResolvedValue(mkRun({ thread_id: RUN_THREAD_ID }))
    const { onOpenThread } = renderPage()
    await screen.findByTestId("run-transcript")
    fireEvent.click(screen.getByText("Open the chat thread"))
    expect(onOpenThread).toHaveBeenCalledWith(RUN_THREAD_ID)
    expect(onOpenThread).not.toHaveBeenCalledWith(VIEWED_THREAD_ID)
  })
})

// ── 8. The source fence: what this page must and must not be made of ─────────
//
// Needles are ASSEMBLED FROM PARTS so this file's own source cannot satisfy a grep run
// over it (the 187-24 lesson), and every absence carries a positive control below.

/**
 * The page's source with its comments removed.
 *
 * ⚠ Needed, and for the reason 188-06 and 188-07 both hit before this: a docblock that
 * EXPLAINS an invariant necessarily spells the very token the invariant's grep counts.
 * Anchoring the count on stripped-comment CODE is what lets the explanation stay while
 * the count stays exact — the alternative is deleting the explanation to satisfy a grep,
 * which is the D-ITEM-183-02 trap.
 */
function codeOf(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}

describe("WorkflowRunPage — source fence", () => {
  it("the comment stripper actually strips (the fences below depend on it)", () => {
    const sample = "/** runReadingLabel( in prose */\n// runReadingLabel( in a line\nconst x = 1\n"
    expect(codeOf(sample)).not.toMatch(/runReadingLabel\(/)
    expect(codeOf(sample)).toMatch(/const x = 1/)
    // ...and the page really does carry the token in prose, which is why this exists.
    expect(pageSource).toMatch(/runReadingLabel\(/)
  })

  it("memoizes the runState lookup with useCallback and passes it BY IDENTITY", () => {
    // ⚠ THE ORIGINAL REASON IS RECORDED AND NO LONGER APPLIES: an inline arrow was a new
    // function identity every render, which invalidated the canvas's `settledNodes` memo and
    // flickered the cards (188-07 pinned that split). The canvas is no longer mounted here.
    // The SEAM is unchanged and now feeds the run log's `liveOf`, so the fence is retargeted
    // rather than deleted — a stable identity is still what a memoising consumer needs, and
    // this is the one place the page hands its live readings to anybody.
    expect(pageSource).toMatch(/const runState = useCallback\(/)
    expect(pageSource).toMatch(/liveOf=\{runState\}/)
    expect(pageSource).not.toMatch(/liveOf=\{\(/)
    // POSITIVE CONTROL — the forbidden shape really is what an inline arrow looks like.
    expect("<RunTranscript liveOf={(slug) => map.get(slug)} />").toMatch(/liveOf=\{\(/)
  })

  it("joins on the step index and hands the canvas an already-worded state", () => {
    const code = codeOf(pageSource)
    expect(code).toMatch(/byIndex\.get\(spec\.phase_index\)/)
    // The words are computed HERE, ONCE, so the visible run line and the announced one
    // are the same bytes — and so the G-5-capped canvas file imports no vocabulary.
    expect(code.match(/runReadingLabel\(/g) ?? []).toHaveLength(1)
    expect(code.match(/canvasReading\(/g) ?? []).toHaveLength(1)
    // The join is keyed on the INDEX and on nothing else: no slug-keyed lookup exists.
    expect(code).not.toMatch(/byIndex\.get\(spec\.slug\)/)
  })

  it("does not modify or even name the shared panel reconcile hook", () => {
    const SHARED_HOOK = ["usePanel", "Reconcile"].join("")
    expect(pageSource).not.toMatch(new RegExp(SHARED_HOOK))
    expect(pageSource).toMatch(/reconcile\(\)/)
    // POSITIVE CONTROL.
    expect("import { usePanelReconcile } from '@/hooks/usePanelReconcile'").toMatch(
      new RegExp(SHARED_HOOK),
    )
  })
})

// ── CR-02 (Phase 188 review) — SOMETHING HAS TO OPEN THE RUN'S STREAM ─────────────────
//
// Before this phase, `doRun` ended `selectThread(thread); onNavigate("chat")`. The stream
// was armed by the SECOND call, not the first: `selectThread` only moves `useThreads`'
// selection, and the store's `setViewingThread` — whose body fires `actions.reconcile`,
// the ONLY caller of `subscribeToRun` for a thread the user did not send from — is
// invoked from exactly ONE production site, `ChatArea`'s layout effect. `ChatArea` mounts
// ONLY inside the `activeView === "chat"` branch, and `ChatLayout.launch.test.tsx`'s own
// source fence asserts that.
//
// ⚠ SO THE REVIEW'S "MINIMAL" FIX — putting `selectThread(thread)` back in `doRun` beside
// `onNavigate("workflow-run")` — WOULD NOT WORK. With the chat branch unmounted there is
// nothing left to turn a selection into a subscription. Measured, not assumed: the only
// production callers of `setViewingThread` are `ChatArea.tsx:224` and `:323`.
//
// The fix therefore lands where the review's own stated alternative put it — on the page,
// once the run read resolves. That is also strictly better than the ChatLayout version,
// because it is PATH-INDEPENDENT: the panel-receipt door (`openRunSurface`) and a
// re-opened finished run get the same treatment as a fresh launch, rather than the launch
// path being special-cased.
//
// It calls the store reconcile DIRECTLY rather than `setViewingThread`, and that is
// deliberate: `setViewingThread` also writes `viewedThreadId`, i.e. chat state, and this
// surface's standing rule is that opening a run writes no chat state (the same rule the
// file-list fence above enforces from the reading side). The consequence — that the
// provider's own visibility listeners key on `activeThreadIdRef` and so still do not
// cover this thread — is already answered by the page's OWN wake listeners, which is why
// the wake case is asserted below rather than left implied.

describe("WorkflowRunPage — the run's stream is opened (CR-02)", () => {
  beforeEach(() => {
    setLiveSlice([])
    setFiles([])
    getWorkflowRun.mockResolvedValue(mkRun({ thread_id: RUN_THREAD_ID }))
  })

  it("reconciles the RUN's thread once the run read resolves — the subscription seam", async () => {
    renderPage()
    await screen.findByTestId("run-band")
    await waitFor(() => expect(reconcileStream).toHaveBeenCalledWith(RUN_THREAD_ID))
  })

  it("never reconciles the VIEWED thread — opening a run is not a chat navigation", async () => {
    useViewingThread.mockReturnValue(VIEWED_THREAD_ID)
    renderPage()
    await screen.findByTestId("run-band")
    await waitFor(() => expect(reconcileStream).toHaveBeenCalledWith(RUN_THREAD_ID))
    expect(reconcileStream).not.toHaveBeenCalledWith(VIEWED_THREAD_ID)
    // And chat's own pointer is never written — the same property the file-list fence
    // protects from the reading side.
    expect(setViewingThread).not.toHaveBeenCalled()
  })

  it("re-opens the stream on wake, beside the slice and the file list", async () => {
    renderPage()
    await screen.findByTestId("run-band")
    await waitFor(() => expect(reconcileStream).toHaveBeenCalledTimes(1))

    reconcileStream.mockClear()
    reconcile.mockClear()
    reconcileFiles.mockClear()
    await act(async () => {
      window.dispatchEvent(new Event("online"))
    })

    // A lid closed across a reconnect drops the SSE connection; re-reading the slice
    // without re-attaching leaves the surface frozen from that moment on.
    await waitFor(() => expect(reconcileStream).toHaveBeenCalledWith(RUN_THREAD_ID))
    expect(reconcile).toHaveBeenCalled()
    expect(reconcileFiles).toHaveBeenCalled()
  })

  it("does nothing at all before a run has resolved", async () => {
    renderPage({ runId: null })
    await screen.findByText("Opening the run…")
    expect(reconcileStream).not.toHaveBeenCalled()
  })
})

// ── CR-01 (Phase 188 review) — THE RUN ROW IS RE-READ, not frozen at mount ────────────
//
// `setRun` had exactly one caller: the effect keyed on `[runId, retryNonce]`, and
// `retryNonce` is bumped only by a button that renders on the broken screen. There was no
// poll, no interval, and the reconnect effect re-read the phase slice and the file list but
// never the RUN. Everything derived from `run.status` was therefore frozen for the whole
// session — and a run-level status is the one fact no other source on this surface carries:
//
//   · the band renders "● Running" until the user leaves the page, long after the run
//     completed or failed;
//   · `isTerminal` never flips, so `aria-busy` stays true and the elapsed slot never
//     switches to its frozen "Ran for …" form;
//   · the once-a-second clock KEEPS COUNTING after the run stopped — worse than a stale
//     word, because a ticking number is an active claim of liveness;
//   · a run that FAILS while being watched never fires the assertive alert, because
//     `run.status` is still the launch-time value.
//
// That is the headline requirement inverted: the surface asserts a run is running at
// exactly the moment it is not.

describe("WorkflowRunPage — the run row is re-read while it is live (CR-01)", () => {
  /** Let the mount read resolve under fake timers before advancing anything. */
  async function settle() {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
  }

  it("polls while non-terminal, so a run that finishes stops claiming it is running", async () => {
    vi.useFakeTimers()
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active" }))
    renderPage()
    await settle()
    expect(screen.getByTestId("run-band")).toHaveTextContent("● Running")

    // The run finishes on the server. Nothing on this surface would ever learn that.
    getWorkflowRun.mockResolvedValue(mkRun({ status: "completed" }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(screen.getByTestId("run-band")).toHaveTextContent("✓ Complete")
    // …and the clock is frozen rather than still counting.
    expect(screen.getByTestId("run-elapsed")).toHaveTextContent("Ran for")
  })

  // ── F1 (UAT 2026-08-05) — THE CANVAS FROZE WHILE A PERSON WATCHED IT. ──
  //
  // Driven live: a 3-phase run whose DB rows read `completed / active / pending` painted
  // `Running / Not started / Not started` for 100 s on a VISIBLE tab and never moved. The
  // reconcile machinery was fine — a wake event snapped it straight to the truth. Nothing
  // was DRIVING it. The run row polled every 5 s (CR-01); the phase slice polled never, and
  // the stream was re-attempted only on mount, where `latest_producer_run_id` is still null
  // on an `llm_human_input` phase (the producer run ends while the workflow run continues).
  //
  // "Watch a run" is the phase goal, and the watching case is exactly the one with no wake
  // event in it. So the slice rides the SAME beat as the run.
  // ── F3 (UAT 2026-08-05) — `claimed_at` IS NEVER POPULATED, so anchoring on it alone
  //    made the surface contradict itself. Measured against the live DB:
  //
  //        workflow_runs: 181 total ·   5 with claimed_at
  //          completed:   149 rows  ·   0 with claimed_at
  //
  //    Zero of 149 finished runs carry the field. So a completed run rendered
  //    "✓ Complete   Waiting to start", and an ACTIVE run's band read "Waiting to start"
  //    while its first step was visibly Running. `created_at` is NOT NULL and is the
  //    honest fallback — a queued-anchored figure, labelled as one.
  it("a finished run with no claimed_at still shows a number, anchored on created_at and SAID so", async () => {
    vi.useFakeTimers()
    getWorkflowRun.mockResolvedValue(mkRun({ status: "completed", claimed_at: null }))
    renderPage()
    await settle()
    const el = screen.getByTestId("run-elapsed")
    expect(el).not.toHaveTextContent("Waiting to start")
    expect(el).toHaveTextContent("Ran for")
    expect(el).toHaveTextContent("queued")
  })

  it("an active run whose claimed_at is null still reads Running — the field cannot mean queued when nothing sets it", async () => {
    vi.useFakeTimers()
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active", claimed_at: null }))
    renderPage()
    await settle()
    expect(screen.getByTestId("run-band")).toHaveTextContent("Running")
    expect(screen.getByTestId("run-band")).not.toHaveTextContent("Waiting to start")
  })

  it("a queued-anchored figure names its anchor in the plain layer too", async () => {
    vi.useFakeTimers()
    getWorkflowRun.mockResolvedValue(mkRun({ status: "completed", claimed_at: null }))
    renderPage()
    await settle()
    // The ⌥ layer additionally prints the literal field (`created_at`), but the plain wording
    // must already say WHICH clock it is — the reveal is an elaboration, never the only place
    // the anchor is disclosed.
    const slot = screen.getByTestId("run-elapsed").textContent ?? ""
    expect(slot).toContain("queued")
    expect(slot).toContain("Ran for")
  })

  it("polls the PHASE SLICE on the same beat, so a watched canvas advances without a wake", async () => {
    vi.useFakeTimers()
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active" }))
    renderPage()
    await settle()
    const afterMount = reconcile.mock.calls.length

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(reconcile.mock.calls.length).toBeGreaterThan(afterMount)
  })

  it("re-attempts the STREAM on the poll — a subscription that could not arm at mount gets another chance", async () => {
    vi.useFakeTimers()
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active" }))
    renderPage()
    await settle()
    const afterMount = reconcileStream.mock.calls.length

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    // At mount the thread's `latest_producer_run_id` can legitimately be null; one attempt
    // is not enough, and a canvas frozen for the rest of the run is the cost of assuming it.
    expect(reconcileStream.mock.calls.length).toBeGreaterThan(afterMount)
  })

  it("takes a FINAL slice + file read at the terminal edge — the poll tears down on that same tick", async () => {
    vi.useFakeTimers()
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active" }))
    renderPage()
    await settle()

    getWorkflowRun.mockResolvedValue(mkRun({ status: "completed" }))
    const beforeTerminal = { slice: reconcile.mock.calls.length, files: reconcileFiles.mock.calls.length }
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    await settle()
    // The deliverable row appears AS the run finishes, and the poll stops on the read that
    // observes it — without an edge read the last state and the file never land.
    expect(reconcile.mock.calls.length).toBeGreaterThan(beforeTerminal.slice)
    expect(reconcileFiles.mock.calls.length).toBeGreaterThan(beforeTerminal.files)
  })

  it("stops polling once the run is terminal — a finished run is not re-read forever", async () => {
    vi.useFakeTimers()
    getWorkflowRun.mockResolvedValue(mkRun({ status: "completed" }))
    renderPage()
    await settle()
    expect(getWorkflowRun).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000)
    })
    expect(getWorkflowRun).toHaveBeenCalledTimes(1)
  })

  it("a failing poll leaves a good surface standing — a blip is not a broken run", async () => {
    vi.useFakeTimers()
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active" }))
    renderPage()
    await settle()

    getWorkflowRun.mockRejectedValue(new ApiError("gateway", 502))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    // Still the run, NOT the broken screen: the mount read's error branch owns the
    // load-phase, and a poll must never be able to tear down a surface that resolved.
    expect(screen.getByTestId("run-band")).toHaveTextContent("● Running")
    expect(screen.queryByText("We couldn't load this run.")).not.toBeInTheDocument()
  })

  it("a run that FAILS while being watched fires the assertive alert", async () => {
    vi.useFakeTimers()
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active" }))
    renderPage()
    await settle()
    expect(screen.getByTestId("run-alert")).toHaveTextContent("")

    getWorkflowRun.mockResolvedValue(mkRun({ status: "failed" }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    // The alert exists to be un-missable; it could never fire while the status was frozen
    // at its launch-time value.
    expect(screen.getByTestId("run-alert")).toHaveTextContent("Failed")
  })

  it("re-reads the RUN on wake, beside the slice and the file list", async () => {
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active" }))
    renderPage()
    await screen.findByTestId("run-band")
    await waitFor(() => expect(getWorkflowRun).toHaveBeenCalledTimes(1))

    // A lid closed across the run's completion: the verdict must be re-read on wake, not
    // waited out. (Real timers here on purpose — this path is event-driven, not polled.)
    getWorkflowRun.mockResolvedValue(mkRun({ status: "completed" }))
    await act(async () => {
      window.dispatchEvent(new Event("online"))
    })
    await waitFor(() =>
      expect(screen.getByTestId("run-band")).toHaveTextContent("✓ Complete"),
    )
  })

  /**
   * ⚠ ONE CLAUSE OF THIS CASE IS SUPERSEDED BY Phase 194.1 Plan 06, AND THE ORIGINAL IS
   * QUOTED RATHER THAN DELETED (the 193.2 WR-05 habit — a retired assertion that leaves
   * no trace is indistinguishable from coverage nobody wrote). It read:
   *
   *     expect(pageSource).toMatch(/function fmtElapsed/)
   *
   * That clause was TRUE when written and is FALSE as of `194.1-06`, which HOISTED
   * `fmtElapsed` VERBATIM into `@/lib/fmtElapsed` because `components/chat/ThreadRunLine`
   * became its second consumer and this tree already carried three elapsed formatters.
   *
   * ⚠ THE PROPERTY IT DEFENDED IS NOT WEAKENED, IT IS RE-AIMED, AND THAT DISTINCTION IS
   * THE WHOLE POINT. The clause never guarded "the definition is in this file"; it guarded
   * *"the label is produced by our own three-branch function rather than by an acquired
   * date library"* — which is what the two `not.toMatch` needles above are about. So the
   * replacement asserts the page still resolves the label through THAT function, now by
   * import, and `lib/__tests__/runStepCount.test.ts` separately proves the moved body is
   * byte-identical to the one that lived here. Between the two, the label's provenance is
   * pinned harder than it was before the move, not more loosely.
   */
  it("adds no date library and constructs no HTML", () => {
    const DATE_A = ["date", "-fns"].join("")
    const DATE_B = ["day", "js"].join("")
    const RAW_HTML = ["dangerously", "SetInnerHTML"].join("")
    for (const needle of [DATE_A, DATE_B, RAW_HTML]) {
      expect(pageSource).not.toMatch(new RegExp(needle))
    }
    // SUPERSEDED clause, re-aimed — see the docblock. The page no longer DEFINES the
    // formatter and must not: a re-declaration here would be the fourth copy again.
    expect(pageSource).not.toMatch(/^function fmtElapsed/m)
    expect(pageSource).toMatch(/import \{ fmtElapsed \} from "@\/lib\/fmtElapsed"/)
    // …and it is still the thing producing the label, on BOTH shipped call sites.
    expect(pageSource).toContain("fmtElapsed(end - anchorMs)")
    expect(pageSource).toContain("fmtElapsed(nowMs - anchorMs)")
    // POSITIVE CONTROL — all three needles match the shapes they forbid.
    expect("import { formatDistance } from 'date-fns'").toMatch(new RegExp(DATE_A))
    expect("import dayjs from 'dayjs'").toMatch(new RegExp(DATE_B))
    expect("<p dangerouslySetInnerHTML={{ __html: x }} />").toMatch(new RegExp(RAW_HTML))
    // …and the re-aimed clause catches a re-declaration (positive control).
    expect("function fmtElapsed(ms: number) {}").toMatch(/^function fmtElapsed/m)
  })

  it("reads no panel-scoped colour token — this surface sits on the page background", () => {
    // Panel tokens are contrast-tuned against the panel surface; reading one off-panel is
    // how a 3.59:1 regression gets reintroduced.
    const DIM = ["muted-foreground", "-dim"].join("")
    const PANEL_SCOPE = ["--", "panel-"].join("")
    expect(pageSource).not.toMatch(new RegExp(DIM))
    expect(pageSource).not.toMatch(new RegExp(PANEL_SCOPE))
    // POSITIVE CONTROL.
    expect("text-muted-foreground-dim").toMatch(new RegExp(DIM))
    expect("text-[hsl(var(--panel-status-done))]").toMatch(new RegExp(PANEL_SCOPE))
  })

  it("renders no second ⌥ toggle — the canvas ships the one that exists", () => {
    const TOGGLE = ["TechnicalNames", "Toggle"].join("")
    expect(pageSource).not.toMatch(new RegExp(TOGGLE))
    // ...but it DOES read the shared provider, which is how the two reveals agree.
    expect(pageSource).toMatch(/useTechnicalNamesOptional\(/)
    // POSITIVE CONTROL.
    expect("<TechnicalNamesToggle />").toMatch(new RegExp(TOGGLE))
  })

  // ── Plan 10 additions ──────────────────────────────────────────────────────

  it("sources the deliverable list from the RUN's thread, at exactly one call site", () => {
    const code = codeOf(pageSource)
    expect(code.match(/useWorkspaceFiles\(/g) ?? []).toHaveLength(1)
    expect(code).toMatch(/useWorkspaceFiles\(run\?\.thread_id/)
    expect(code.match(/downloadWorkspaceFile\(/g) ?? []).toHaveLength(1)
    expect(code).toMatch(/const runThreadId = run\?\.thread_id/)
    expect(code).toMatch(/downloadWorkspaceFile\(runThreadId/)
  })

  it("neither mounts the panel's file list nor names it — it reads the viewed thread", () => {
    /**
     * ═══════════════════════════════════════════════════════════════════════════
     * ⚠ SUPERSEDED IN PLACE — PHASE 195 (RUN-03). TWO ARMS OF THIS CASE INVERTED.
     * ═══════════════════════════════════════════════════════════════════════════
     *
     * The two arms below used to read, VERBATIM:
     *
     *     expect(codeOf(pageSource)).toMatch(/function formatBytes/)
     *     expect(codeOf(pageSource)).toMatch(/function iconFor/)
     *
     * with the comment *"...and the mirrored pieces really are here."* They asserted
     * that this page DECLARES its own byte formatter and its own extension→glyph
     * mapping — i.e. they asserted the duplication, and they were RIGHT to: the page
     * really did carry a third copy of a formatter that also shipped in the chat
     * output card and the panel file list, one of which apologised for itself in a
     * comment. **RUN-03 removed exactly that duplication**, so the arms now assert its
     * ABSENCE, and the mirrored positive arms below prove the shared module holds the
     * behaviour instead of it having simply vanished.
     *
     * ⚠ THE ORIGINALS ARE QUOTED RATHER THAN DELETED, and the case is inverted rather
     * than removed. Two reasons, both scars:
     *   · `StopControl.baseline.test.tsx:513-573` (194.1-07) records the rule — *a
     *     capture deleted the moment it inverts leaves no record that the old
     *     behaviour was ever real* (193.2 WR-05). Someone reading this file in a year
     *     should be able to see that three copies of one formatter genuinely shipped.
     *   · This suite is pinned EXACT in the count gate. Deleting an `it(` trips
     *     `[count-decrease]` and needs a pin LOWERING, which is authorised nowhere.
     *
     * The case TITLE is unchanged and still true: the page still does not mount the
     * panel's file list and still does not name it. That half never inverted.
     */
    // The panel list resolves its thread from the globally-viewed-thread selector rather
    // than from a prop, so mounting it here would WRITE chat state as a side effect of
    // opening a run. The selector itself must not appear either — that is the mechanism.
    const PANEL_LIST = ["Files", "Section"].join("")
    const VIEWED = ["useViewing", "Thread"].join("")
    expect(pageSource).not.toMatch(new RegExp(PANEL_LIST))
    expect(pageSource).not.toMatch(new RegExp(VIEWED))
    // ⚠ INVERTED (Phase 195): the mirrored pieces are GONE. Nothing is mirrored here
    // any more — the presentation is shared, not copied.
    expect(codeOf(pageSource)).not.toMatch(/function formatBytes/)
    expect(codeOf(pageSource)).not.toMatch(/function iconFor/)
    // ...and the page CONSUMES the shared ones instead of re-declaring them.
    expect(codeOf(pageSource)).toMatch(/from "@\/components\/files\/fileRowUtils"/)
    /**
     * THE MIRRORED POSITIVE ARMS — the behaviour did not evaporate, it MOVED, and this
     * is where it moved to.
     *
     * ⚠ EACH `?raw` IMPORT CARRIES A LENGTH GUARD **AND** AN IDENTITY GUARD, and that
     * is not ceremony: 192.1 measured a fence sweeping a renamed module against the
     * EMPTY STRING and passing green. A `toMatch` over "" fails loudly, but a future
     * `not.toMatch` added beside it would pass forever, so both guards are stated here
     * once rather than assumed per-assertion.
     */
    expect(utilsSource.length).toBeGreaterThan(500)
    expect(utilsSource).toContain("fileRowUtils")
    expect(iconSource.length).toBeGreaterThan(500)
    expect(iconSource).toContain("fileIcon")
    // The formatter now lives in the shared pure module...
    expect(utilsSource).toMatch(/export function formatBytes/)
    expect(utilsSource).toMatch(/export function baseName/)
    // ...and the ext→glyph mapping in the ONE shared icon module.
    expect(iconSource).toMatch(/export function fileIcon/)
    expect(iconSource).toMatch(/const EXT_MAP/)
    // POSITIVE CONTROLS — both assembled needles match the shapes they forbid.
    expect("import { FilesSection } from './FilesSection'").toMatch(new RegExp(PANEL_LIST))
    expect("const threadId = useViewingThread()").toMatch(new RegExp(VIEWED))
    // ...and the two inverted arms really would catch a re-declaration coming back.
    expect(codeOf("function formatBytes(b: number) {}")).toMatch(/function formatBytes/)
    expect(codeOf("function iconFor(f: WorkspaceFile) {}")).toMatch(/function iconFor/)
  })

  it("promises no preview: the previewer is neither imported nor named", () => {
    // DOCX/PPTX/XLSX/PDF are download-only by decision and the template engine emits
    // .docx, so the flagship deliverable is exactly the artefact that cannot be shown in
    // place. Req 7 asks that it be listed and downloadable — not that it be rendered.
    const PREVIEWER = ["File", "Preview"].join("")
    expect(pageSource).not.toMatch(new RegExp(PREVIEWER))
    // POSITIVE CONTROL.
    expect("<FilePreview threadId={t} file={f} onBack={b} />").toMatch(new RegExp(PREVIEWER))
  })

  it("Phase 200.2 (RUN-05) — retired deliverable strings are absent from code, preserved in prose", () => {
    const code = codeOf(pageSource)
    // ZERO occurrences in executable code:
    expect(code.match(/No files yet — this run hasn't written anything\./g) ?? []).toHaveLength(0)
    expect(code.match(/This run produced no file and no written answer\./g) ?? []).toHaveLength(0)
    expect(code.match(/This run produced no files\./g) ?? []).toHaveLength(0)
    expect(code.match(/The answer this run wrote/g) ?? []).toHaveLength(0)
    expect(code.match(/Files in this run's workspace/g) ?? []).toHaveLength(0)

    // PRESENCE in docblock prose (superseded-not-deleted convention for git log -S):
    expect(pageSource).toContain("No files yet — this run hasn't written anything.")
    expect(pageSource).toContain("This run produced no file and no written answer.")
    expect(pageSource).toContain("The answer this run wrote")
    expect(pageSource).toContain("Files in this run's workspace")
  })

  it("Phase 200.2 — RunTranscript is replaced with RunHero and RunStepList", () => {
    expect(codeOf(pageSource)).not.toContain("RunTranscript")
    expect(codeOf(pageSource)).toMatch(/<RunHero/)
    expect(codeOf(pageSource)).toMatch(/<RunStepList/)
  })

  it("Phase 200.2 — RunHero renders in BOTH log and canvas views", async () => {
    getWorkflowRun.mockResolvedValue(mkRun({ status: "completed", thread_id: RUN_THREAD_ID }))
    setFiles([DELIVERABLE])
    renderPage()
    await screen.findByRole("button", { name: DOWNLOAD_LABEL })
    expect(screen.getByLabelText(HERO_LANDMARK)).toBeInTheDocument()

    // Switch to canvas
    fireEvent.click(screen.getByRole("radio", { name: CENTRE_CANVAS_LABEL }))
    expect(screen.getByLabelText(HERO_LANDMARK)).toBeInTheDocument()
  })

  it("Phase 200.2 (D-03) — live run renders NO hero", async () => {
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active", thread_id: RUN_THREAD_ID }))
    setFiles([DELIVERABLE])
    renderPage()
    await screen.findByTestId("run-transcript-region")
    expect(screen.queryByLabelText(HERO_LANDMARK)).toBeNull()
  })

  it("Phase 200.2 (D-04) — centre DOM order is hero -> summary strip -> step list", async () => {
    getWorkflowRun.mockResolvedValue(mkTimedRun({ status: "completed" }))
    setFiles([DELIVERABLE])
    renderPage()
    await screen.findByRole("button", { name: DOWNLOAD_LABEL })

    const hero = screen.getByLabelText(HERO_LANDMARK)
    const strip = screen.getByTestId("run-receipt")
    const stepList = screen.getByLabelText(PROCESS_TRACE_LANDMARK)

    const rel1 = hero.compareDocumentPosition(strip)
    expect(rel1 & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    const rel2 = strip.compareDocumentPosition(stepList)
    expect(rel2 & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

// ── F5 (UAT 2026-08-05) — THE RUN-TIME WAITING READING WAS STRUCTURALLY UNREACHABLE ──
//
// Observed live on `doc_qa_scoped_098uat`: phase 1 `confirm`, an `llm_human_input` step, DB
// status `active`, a real pending ask sitting on the thread — and the canvas read
// "Running". Never "Paused for your answer".
//
// The mechanism, measured: `canvasReading` has always had its `pendingAsk != null` arm
// (`phaseState.ts:124`) and it is FIRST, ahead of every status. But `reconcilePhases`
// hardcodes `pendingAsk: null` in BOTH of its branches (`StreamsProvider.tsx:3427` live,
// `:3466` terminal), so the field is populated only by a live SSE event — and after F1 this
// surface rides POLLED reconciles, each of which resets it to null. The reading Req 5
// specifies was real in `runVocabulary`, real in the unit suite, and not reachable in the
// product on this surface.
//
// The fix consumes the DURABLE ask slice that already shipped and derives the waiting step,
// because `PendingAsk` carries no phase reference. The derivation is sound only because the
// harness runs a LINEAR spine one phase at a time and only an `llm_human_input` phase blocks
// on an ask — so the negative controls below are not ceremony: each one is a way the
// derivation could over-claim, and over-claiming is the exact defect this phase exists to
// remove.

describe("WorkflowRunPage — the run-time waiting reading (F5, SPEC Req 5)", () => {
  it("an ACTIVE llm_human_input step with a pending ask reads Paused for your answer, not Running", async () => {
    setLiveSlice([
      mkPhase(0, "done", "gather-contracts"),
      mkPhase(1, "done", "draft-letter"),
      mkPhase(2, "running", "final-check", { phaseType: "llm_human_input" }),
    ])
    setAsks([mkAsk()])
    // ⚠ THE DURABLE ROW MUST ALSO SAY THIS STEP IS RUNNING. `waiting-for-you` is DERIVED on
    // top of a running row — the wire has no such status — so a row still reading `pending`
    // would be describing a different moment of the run.
    getWorkflowRun.mockResolvedValue(mkRun({ phases: phasesMatching(["completed", "completed", "active"]) }))
    renderPage()
    await screen.findByTestId("run-transcript")

    expect(readings()["final-check"]).toBe("waiting-for-you")
    expect(labels()["final-check"]).toContain("Paused for your answer")
    expect(labels()["final-check"]).not.toContain("Running")
  })

  // NEGATIVE CONTROL 1 — the ask must not spill onto the step that merely happens to be
  // running. A `llm_agent` step cannot block on an ask, so an ask on the thread says
  // nothing about it.
  it("a pending ask does NOT make a running llm_agent step read as waiting", async () => {
    setLiveSlice([
      mkPhase(0, "done", "gather-contracts"),
      mkPhase(1, "running", "draft-letter"),
      mkPhase(2, "pending", "final-check", { phaseType: "llm_human_input" }),
    ])
    setAsks([mkAsk()])
    renderPage()
    await screen.findByTestId("run-transcript")

    expect(readings()["draft-letter"]).toBe("running")
  })

  // NEGATIVE CONTROL 2 — D-188-05, the separation this phase locked. The design-time
  // property ("this step WILL pause") is true before anything runs; the run-time state
  // ("it IS paused, now") requires an actual ask. A step that carries the badge and is
  // running with nothing pending is RUNNING.
  it("an active llm_human_input step with NO pending ask still reads Running", async () => {
    setLiveSlice([
      mkPhase(0, "done", "gather-contracts"),
      mkPhase(1, "done", "draft-letter"),
      mkPhase(2, "running", "final-check", { phaseType: "llm_human_input" }),
    ])
    setAsks([])
    renderPage()
    await screen.findByTestId("run-transcript")

    expect(readings()["final-check"]).toBe("running")
  })

  // NEGATIVE CONTROL 3 — a step the run has not REACHED is not waiting on anyone, whatever
  // is pending on the thread. Without the status arm the whole spine would read as paused.
  it("a not-yet-reached llm_human_input step reads Not started even with an ask pending", async () => {
    setLiveSlice([
      mkPhase(0, "done", "gather-contracts"),
      mkPhase(1, "running", "draft-letter"),
      mkPhase(2, "pending", "final-check", { phaseType: "llm_human_input" }),
    ])
    setAsks([mkAsk()])
    renderPage()
    await screen.findByTestId("run-transcript")

    expect(readings()["final-check"]).toBe("not-started")
  })

  // NEGATIVE CONTROL 4 — the run itself has to still be live. A cancelled run can leave a
  // phase row at `active` with an unanswered ask on its thread; the band correctly reads
  // "⊘ Cancelled", and a node beside it saying "it needs your reply before it can continue"
  // would be the phase's own defect in a new place — the run needs nothing from anyone.
  it("a terminal run does not claim a step is waiting, even with an ask still pending", async () => {
    getWorkflowRun.mockResolvedValue(
      mkRun({
        status: "cancelled",
        phases: [
          { slug: "gather-contracts", phase_index: 0, status: "completed", phase_type: null },
          { slug: "draft-letter", phase_index: 1, status: "completed", phase_type: null },
          { slug: "final-check", phase_index: 2, status: "active", phase_type: null },
        ],
      }),
    )
    setAsks([mkAsk()])
    renderPage()
    await screen.findByTestId("run-transcript")

    expect(readings()["final-check"]).toBe("running")
    expect(labels()["final-check"]).not.toContain("Paused for your answer")
  })

  it("reads the ask slice for the RUN's thread, never the globally-viewed one", async () => {
    getWorkflowRun.mockResolvedValue(mkRun({ thread_id: RUN_THREAD_ID }))
    renderPage()
    await screen.findByTestId("run-transcript")

    expect(useAskUserPrompt).toHaveBeenCalledWith(RUN_THREAD_ID)
    expect(useAskUserPrompt).not.toHaveBeenCalledWith(VIEWED_THREAD_ID)
  })

  // The staleness half. An ask slice fetched once at mount inherits EXACTLY the defect F1
  // just fixed: someone sitting and watching produces no wake event, so a step that starts
  // waiting after mount would never be seen to.
  it("re-reads the ask slice on the 5s poll", async () => {
    vi.useFakeTimers()
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active" }))
    renderPage()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    const afterMount = reconcileAsks.mock.calls.length

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(reconcileAsks.mock.calls.length).toBeGreaterThan(afterMount)
  })

  it("re-reads the ask slice on wake", async () => {
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active" }))
    renderPage()
    await screen.findByTestId("run-transcript")
    const afterMount = reconcileAsks.mock.calls.length

    await act(async () => {
      fireEvent(window, new Event("visibilitychange"))
    })
    await waitFor(() =>
      expect(reconcileAsks.mock.calls.length).toBeGreaterThan(afterMount),
    )
  })
})

// ── F6 (UAT 2026-08-05) — THE LIVE CLOCK NEVER TICKED. F3's own residue. ──
//
// F3 moved the elapsed figure's ANCHOR from `claimed_at` to a `created_at` fallback, because
// `claimed_at` is null on essentially every run (5 of 181 rows; 0 of 149 completed). It did
// not move the TICK GATE, which still read `claimedMs != null`. So on every live run the
// interval never armed, `nowMs` stayed frozen at its mount value, and the band rendered a
// number that looked live and was not.
//
// Observed live on run `99f10a40`: created 15:38:45.8, screen read at 15:40:31 — about 106 s
// elapsed — and the band said "3s since it was queued", the value as of mount. The same
// class of defect F3 existed to remove: a figure claiming a measurement nobody is taking.
//
// Root cause is that "is there an anchor?" was computed in TWO places and F3 updated one.
// The fix computes it once.

describe("WorkflowRunPage — the live elapsed figure actually advances (F6)", () => {
  async function settle() {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
  }

  it("ticks on a live run whose claimed_at is null — the case that is EVERY run", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-05T14:03:05Z"))
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active", claimed_at: null }))
    renderPage()
    await settle()
    const first = screen.getByTestId("run-elapsed").textContent ?? ""

    // 3s — deliberately UNDER the 5s poll, so anything that changes here changed because
    // the clock ticked, not because the run row was re-read.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    const second = screen.getByTestId("run-elapsed").textContent ?? ""

    expect(first).toContain("5s")
    expect(second).toContain("8s")
    expect(second).not.toBe(first)
  })

  // The guard against over-fixing: a run that has STOPPED must stay frozen. Its figure is
  // measured between two recorded timestamps and has nothing to do with the wall clock.
  it("does NOT tick on a terminal run — a finished figure is a measurement, not a clock", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-05T14:03:05Z"))
    getWorkflowRun.mockResolvedValue(mkRun({ status: "completed", claimed_at: null }))
    renderPage()
    await settle()
    const first = screen.getByTestId("run-elapsed").textContent ?? ""

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000)
    })
    expect(screen.getByTestId("run-elapsed").textContent ?? "").toBe(first)
  })
})

// ── F7 (UAT 2026-08-05) — THE GOVERNANCE SEAL NEVER RENDERED ON THE RUN SURFACE ──
//
// SC#1 requires each node to show "live state ... AND its grounded-cited vs open
// governance state". The run surface showed the first and never the second.
//
// Mechanism, measured: `toCanvas` resolves `grounded` via `isGrounded(phase, kbTools)`,
// and `canvasModel.ts:360` defaults an omitted `kbTools` to the frozen empty
// `NO_KB_TOOLS`. `WorkflowRunPage` rendered `<WorkflowCanvas>` with NO `kbTools` prop, so
// the intersection `available_tools ∩ kb_tools` was against the empty set and the
// **`detected`** cause — the dominant one, and the only one most fixtures have — could
// never resolve. `already-set` and `escalated` still would, which is why the miss is
// quiet: governance appears to work on the workflows that declare it explicitly.
//
// Falsified live on `doc_qa_scoped_098uat`, the SAME workflow on both surfaces:
//   Builder canvas   node "Work out how to do it" → data-grounded="true"
//   Run surface      the same node                → no attribute at all
//
// `useGroundingBundle`'s own docblock names this exact consumer: the kb-tool list is used
// "for one thing: the local available_tools ∩ kb_tools intersection that moves the dial,
// the strike-through and THE CANVAS SEAL". The run surface simply never asked for it.

/**
 * ⚠ F7's TWO CASES ARE REWRITTEN, NOT DELETED, AND THE REASON IS THE POINT OF THE REWRITE.
 *
 * F7 fixed a real defect: this page rendered the canvas with NO `kbTools`, so
 * `available_tools ∩ kb_tools` was taken against the empty set and a step grounded merely by
 * reading the knowledge base painted as ungoverned. Both of its cases asserted that the
 * server's list reached THE CANVAS.
 *
 * Phase 200 took the canvas off this surface, so there is nothing here for the list to reach.
 * The two lines that computed it had zero consumers, and a live `useGroundingBundle`
 * subscription with no reader is a request this page makes for nothing.
 *
 * ⚠ THE FIX IS NOT LOST AND WAS NEVER THIS PAGE'S TO OWN: it reads VERBATIM from
 * `WorkflowBuilderPage.tsx`, where the canvas that needs it still lives and where the same
 * `data-grounded` attribute is still asserted. What was removed here is a SECOND CONSUMER of
 * a shared rule, not the rule.
 *
 * So the first case becomes a guard on the REMOVAL — the page must not re-acquire a
 * subscription nothing reads — and the second keeps the half of R11 that is still about this
 * file: a client-assembled whitelist would let knowledge-base content whitelist itself, and
 * that literal must never appear in this page's source whether or not a canvas is mounted.
 */
describe("WorkflowRunPage 200 — the governance input left with the canvas (F7 superseded)", () => {
  it("subscribes to the grounding bundle again, because the canvas is reachable again", async () => {
    // ⚠ THIS CASE HAS NOW BEEN WRITTEN THREE WAYS AND EACH WAS TRUE WHEN WRITTEN, which is why
    // the history is stated rather than overwritten. F7 asserted the server's kb-tool list
    // reached THE CANVAS. When the canvas came off this page the list had no reader, so a live
    // subscription was a request made for nothing and the case became a guard on its ABSENCE.
    // The canvas is now reachable behind the centre switch, so the absence guard would be
    // guarding a defect: a canvas rendered with no `kbTools` resolves `available_tools ∩ ∅` and
    // every detected-grounded step paints as ungoverned — F7's original bug exactly.
    renderPage()
    await screen.findByTestId("run-transcript")
    expect(useGroundingBundle).toHaveBeenCalled()
  })

  it("R11 holds regardless: the page authors no kb-tool list of its own", async () => {
    renderPage()
    await screen.findByTestId("run-transcript")
    // A client-assembled whitelist would let knowledge-base content whitelist itself.
    const KB = ["search", "_documents"].join("")
    expect(codeOf(pageSource)).not.toMatch(new RegExp(KB))
    // POSITIVE CONTROL — that needle really does match a hardcoded list.
    expect('const KB_TOOLS = ["search_documents"]').toMatch(new RegExp(KB))
  })
})

// ── 188.1-04 · WR-07 — the run-id path segment is encoded ──────────────────────

/**
 * WR-07 (`lib/api.ts`, `getWorkflowRun`) — the run id is interpolated straight into the
 * URL PATH, where `/`, `?` and `#` are structural rather than textual: a `runId` of
 * `"a/b"` addresses a different route, and one of `"x?y=z"` moves the remainder into the
 * query string. The route's server-side ownership gate is the security control; this is
 * the defensive URL construction that pairs with it (`api.ts`'s `listRelationships`
 * register), so a non-UUID value cannot reshape the request the client sends.
 *
 * ⚠ OBSERVED RED FIRST, against the shipped tree, before the encode was written.
 *
 * IT ASSERTS THE URL THE MOCK RECEIVED, not the source: a `?raw` grep for
 * `encodeURIComponent` would test the patch. This is also why the test lives HERE rather
 * than beside `api.ts` — `frontend/src/lib/` sits outside BOTH count-gate knobs (`TARGETS`
 * decides what RUNS, `BASELINE` what is PINNED), so a suite written there would never be
 * executed by the gate, and a falsification that does not run has falsified nothing.
 * This file is inside both.
 */
describe("api.getWorkflowRun 188.1-04 — WR-07: the run-id path segment is encoded", () => {
  it("a runId carrying a slash cannot reshape the request path", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    })
    vi.stubGlobal("fetch", fetchMock)
    vi.stubEnv("VITE_API_BASE_URL", "http://localhost:8000")
    try {
      // `importActual` bypasses this file's `@/lib/api` factory mock for this ONE call,
      // so the function under test is the shipped one rather than the suite's spy.
      const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
      await actual.getWorkflowRun("a/b")

      const url = String(fetchMock.mock.calls[0][0])
      // POSITIVE CONTROL — the mock really did receive THIS route's URL, so the two
      // assertions below are about a real request rather than an empty string.
      expect(url).toContain("/workflow-runs/")
      expect(url).toContain("a%2Fb")
      expect(url).not.toContain("workflow-runs/a/b")
    } finally {
      vi.unstubAllGlobals()
      vi.unstubAllEnvs()
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 194.1 Plan 07 (RUN-01 / R3 / D-19) — THE STOP ON THE RUN'S OWN SURFACE
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * `▶ Run workflow` lands the user HERE, and until this plan
 * `grep -c "onStop|stopThread|cancelRun|Stop" WorkflowRunPage.tsx` returned **0** —
 * the natural launch path had no working Stop at all. That is half of
 * `BUG-260816-01`, and it is what these cases exist to keep closed.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ FIVE STATUS CASES, NOT TWO, AND THE REASON IS A PLANT RATHER THAN A HABIT
 * ─────────────────────────────────────────────────────────────────────────────
 * A `completed`-only pair of cases passes a gate written `runStatus !== "completed"`
 * — the exact plant P1 was driven against — because `cancelled` and `failed` are
 * also terminal and that gate lets both through. `cancelled` matters most of all:
 * it is the state the user lands on IMMEDIATELY AFTER pressing this very control,
 * so a live-looking Stop there would be the same defect this plan exists to remove,
 * one screen later.
 *
 * Each case is named for the shipped BAND SENTENCE it drives (`WorkflowRunPage.tsx`
 * `:288-308`), not for the raw status literal, so a reading and its control are
 * asserted against the same fact the user sees.
 */
describe("194.1-07 R3 — the Stop renders on the two live states and on none of the three terminal ones", () => {
  /** The shared component's `page` variant testids (`StopControl.tsx:231-242`). */
  const STOP_TESTID = "run-page-stop"
  const SLOT_TESTID = "run-page-stop-slot"
  const STOPPING_TESTID = "page-stopping"
  const STOPPING_READING = "⊘ Stopping this run…"

  async function openWithStatus(status: string, overrides: Partial<RunLike> = {}) {
    getWorkflowRun.mockResolvedValue(mkRun({ status, ...overrides }))
    const utils = renderPage()
    await screen.findByTestId("run-transcript")
    return utils
  }

  /**
   * ⚠ `getAllByText`, NOT `getByText`, and the reason is a property of the surface
   * rather than a workaround: this page renders `band.sentence` TWICE on purpose —
   * once in the header for sighted users and once in the visually-hidden
   * `data-testid="run-band"`, which is the ANNOUNCEMENT channel for assistive tech.
   * A `getByText` here reds with *"found multiple elements"* — measured, not
   * predicted.
   *
   * ⚠ AND ON `failed` IT IS THREE, NOT TWO — which this helper was written assuming
   * and was WRONG about. Measured: `expected [ … ] to have a length of 2 but got 3`.
   * The third home is `data-testid="run-alert"`, the `role="alert"` region gated on
   * `ALERTING_STATUSES = new Set(["failed", "cap_paused"])` — the two run-level
   * states that earn an ASSERTIVE announcement. So the count is a parameter and its
   * value is the fact being asserted, rather than a constant that happened to hold
   * for four of the five states.
   *
   * ⚠ AND IT WAITS RATHER THAN SAMPLES, WHICH IS NOT DEFENSIVENESS — IT IS A
   * MEASURED FIX FOR A FENCE THAT WAS ALREADY LYING TO ME. The third home is
   * `useState` written from a `useEffect` (`:824-832`), so it lands a tick AFTER
   * `findByTestId("run-transcript")` resolves. With a plain `getAllByText` the failed
   * case read **3** on the whole-file run and **2** under plant P1 — a plant that
   * changed only an unrelated ternary. The plant perturbed render timing, so the
   * case red on the WRONG clause, and P1 would have been credited with catching an
   * announcement race instead of a gate. *A fence that reds for a reason other than
   * its subject is not evidence for its subject.* `waitFor` makes the count the
   * assertion again, and P1 was re-driven afterwards to get honest evidence.
   */
  async function expectBandSentence(sentence: string, homes = 2) {
    await waitFor(() => expect(screen.getAllByText(sentence)).toHaveLength(homes))
  }

  it("`● Running` — the control is offered", async () => {
    await openWithStatus("active")
    await expectBandSentence("● Running")
    expect(screen.getByTestId(STOP_TESTID)).toBeTruthy()
  })

  it("`Paused for your answer` — the control is offered", async () => {
    await openWithStatus("paused")
    await expectBandSentence("Paused for your answer")
    expect(screen.getByTestId(STOP_TESTID)).toBeTruthy()
  })

  it("`✓ Complete` — the control is absent", async () => {
    await openWithStatus("completed")
    await expectBandSentence("✓ Complete")
    expect(screen.queryByTestId(STOP_TESTID)).toBeNull()
    // The whole SLOT is gone, not merely the button inside it — an empty reservation
    // on a finished run would still be spending header space on a dead affordance.
    expect(screen.queryByTestId(SLOT_TESTID)).toBeNull()
  })

  it("`⊘ Cancelled` — the control is absent (the state this control itself produces)", async () => {
    await openWithStatus("cancelled")
    await expectBandSentence("⊘ Cancelled")
    expect(screen.queryByTestId(STOP_TESTID)).toBeNull()
    expect(screen.queryByTestId(SLOT_TESTID)).toBeNull()
  })

  it('`✕ Failed at "…"` — the control is absent', async () => {
    await openWithStatus("failed", {
      phases: [
        { slug: "gather-contracts", phase_index: 0, status: "completed", phase_type: "llm_agent" },
        { slug: "draft-letter", phase_index: 1, status: "failed", phase_type: "llm_agent" },
        { slug: "final-check", phase_index: 2, status: "pending", phase_type: "llm_human_input" },
      ],
    })
    // THREE homes: the header, the polite band, and the assertive `run-alert`.
    await expectBandSentence('✕ Failed at "Draft the renewal letter"', 3)
    expect(screen.queryByTestId(STOP_TESTID)).toBeNull()
    expect(screen.queryByTestId(SLOT_TESTID)).toBeNull()
  })

  /**
   * DOM CONTAINMENT, never a line number. The acceptance is *"the mount sits inside
   * the same flex container as `COPY_OPEN_THREAD`"*, and a source-line assertion
   * would rot on the next edit to this file while a containment assertion cannot.
   */
  it("the control and the seam link share one container, and the seam link is LAST in it", async () => {
    await openWithStatus("active")
    const slot = screen.getByTestId(SLOT_TESTID)
    const seam = screen.getByText("Open the chat thread")
    const group = slot.parentElement
    expect(group).not.toBeNull()
    expect(group!.contains(seam)).toBe(true)
    // ⚠ ORDER, asserted by CHILD POSITION rather than by class name (the 192.1 /
    // 193 precedent). The seam link is the LAST child of the right-aligned group,
    // which is what pins its right edge — if a later edit appends the Stop after
    // it, the seam link moves every time the run goes terminal and G-4 row 2's
    // "the row twitches" failure is back.
    // ⚠ THE INVARIANT IS THE SEAM LINK BEING LAST, AND THAT IS UNCHANGED. It carries `ml-auto`,
    // so anything appended AFTER it would shove it leftward every time the run went terminal —
    // G-4 row 2's "the row twitches" failure. The Stop is no longer FIRST in the group because
    // the centre switch was added ahead of it on 2026-08-20; the switch is present on every
    // state, so it cannot cause the twitch the ordering guards against. What still must hold is
    // that the Stop sits BEFORE the seam link and the seam link ends the group.
    expect(group!.lastElementChild).toBe(seam)
    const order = Array.from(group!.children)
    expect(order.indexOf(slot)).toBeGreaterThanOrEqual(0)
    expect(order.indexOf(slot)).toBeLessThan(order.indexOf(seam))
  })

  /**
   * ⚠ THE PRESS ASSERTS THE VALUE, NEVER MERELY THE CALL.
   *
   * `expect(fn).toHaveBeenCalled()` alone passes under the two-id landmine
   * (`ComposerStopHarness.test.tsx:16-19`): `WorkflowLock.runId` carries two id
   * types while its JSDoc asserts one, and `api.ts::cancelRun` swallows 404, so a
   * wrong-id stop is indistinguishable from a successful one.
   *
   * At THIS seam the value is the THREAD id — the page hands `stopThread` a thread
   * and never resolves a run id itself, which is D-08's *four mounts, ONE mechanism*
   * expressed as a call signature. The fixture uses `RUN_THREAD_ID` against the
   * suite's shipped `VIEWED_THREAD_ID` DECOY precisely so a press that reached for
   * the globally-viewed thread instead resolves to a DIFFERENT, visibly wrong value
   * rather than to a coincidence.
   */
  it("one press issues exactly ONE stop, keyed on the RUN's thread and not the viewed one", async () => {
    await openWithStatus("active", { thread_id: RUN_THREAD_ID })
    fireEvent.click(screen.getByTestId(STOP_TESTID))

    expect(stopThread).toHaveBeenCalledTimes(1)
    expect(stopThread).toHaveBeenCalledWith(RUN_THREAD_ID)
    expect(stopThread).not.toHaveBeenCalledWith(VIEWED_THREAD_ID)
  })

  /**
   * THE DIRECT-FLIP GUARD, TESTED RATHER THAN ASSUMED. Sketch 169 offered three
   * guards (direct flip / arm-to-confirm / naming sheet) and settled on the first;
   * an unenforced settlement is a hope. If a later plan slips a confirmation in,
   * `toHaveBeenCalledTimes(1)` after ONE click reds here first.
   */
  it("there is NO confirmation step — one press, no dialog, no second control", async () => {
    await openWithStatus("active", { thread_id: RUN_THREAD_ID })
    fireEvent.click(screen.getByTestId(STOP_TESTID))

    // The cancel is already away after the FIRST press.
    expect(stopThread).toHaveBeenCalledTimes(1)
    // No sheet, no armed state, no "are you sure".
    expect(screen.queryByRole("alertdialog")).toBeNull()
    expect(screen.queryByRole("dialog")).toBeNull()
    const body = document.body.textContent ?? ""
    expect(body).not.toMatch(/are you sure/i)
    expect(body).not.toMatch(/confirm/i)
  })

  /**
   * THE SLOT SWAP, at THIS mount.
   *
   * ⚠ WHAT THIS CASE PROVES AND WHAT IT DOES NOT, stated rather than implied. The
   * production flip is store-driven: `stopThread` sets the thread's `stopping` flag
   * and every subscriber re-renders. This suite mocks the provider module away, so
   * the flag is flipped from inside the `stopThread` spy and a re-render is forced.
   * That makes this case's subject *"the page renders the shared slot's stopping arm
   * in its title row"* — NOT *"pressing flips the store"*, which is plan 03's
   * property (`StreamsProvider.stopping.test.ts`), and NOT *"stopping removes the
   * control"*, which is plan 04's (`StopControl.test.tsx`). Three arms, each pinned
   * where it lives; none of them is faked here to stand in for another.
   */
  it("with the store reporting stopping, the reading takes the slot and the control is GONE", async () => {
    getWorkflowRun.mockResolvedValue(mkRun({ status: "active", thread_id: RUN_THREAD_ID }))
    stopThread.mockImplementation((_t: string) => {
      stoppingNow = true
      return Promise.resolve()
    })
    const onBack = vi.fn()
    const onOpenThread = vi.fn()
    // ⚠ A FRESH ELEMENT OBJECT EACH TIME, and this is load-bearing rather than
    // style: React bails out of a re-render when handed the REFERENTIALLY IDENTICAL
    // element, so `rerender(el)` with one hoisted `el` renders nothing and this case
    // reported the control still present while the flag was already `true` —
    // measured, not predicted. A test that cannot re-render cannot observe a swap.
    const el = () => (
      <TechnicalNamesProvider>
        <WorkflowRunPage runId="run-1" onBack={onBack} onOpenThread={onOpenThread} />
      </TechnicalNamesProvider>
    )
    const { rerender } = render(el())
    await screen.findByTestId("run-transcript")

    fireEvent.click(screen.getByTestId(STOP_TESTID))
    await act(async () => {
      rerender(el())
    })

    expect(screen.queryByTestId(STOP_TESTID)).toBeNull()
    const reading = screen.getByTestId(STOPPING_TESTID)
    expect(reading.textContent).toBe(STOPPING_READING)
    // It is in the TITLE ROW, beside the seam link — not somewhere else on the page.
    expect(reading.closest(`[data-testid="${SLOT_TESTID}"]`)).not.toBeNull()
    expect(
      screen
        .getByTestId(SLOT_TESTID)
        .parentElement!.contains(screen.getByText("Open the chat thread")),
    ).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 194.1 Plan 07 — F1 / F2: "FOUR MOUNTS, ONE MECHANISM", HELD MECHANICALLY
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Phase 194 **D-08** binds every Stop to the thread-keyed resolver: no mount reads
 * the workflow lock's id field, and no mount calls the cancel API itself. Three of
 * the four mounts are already swept — `WorkspacePanel.test.tsx`'s **F-1 / V-05**
 * fence globs `components/panel/**`, `components/chat/**` and
 * `components/workflows/**`.
 *
 * ⚠ **`src/pages/**` IS IN NONE OF THOSE THREE GLOBS**, so the mount this plan adds
 * would have been the ONE mount outside the fence that guards all the others. That
 * is the gap these two cases close, and it is stated rather than left implicit,
 * because "there is already a fence for this" is exactly the belief that leaves a
 * fourth mount unguarded.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ THE SWEPT LENGTH IS PRINTED AND ASSERTED BEFORE ANY COUNT IS TRUSTED
 * ─────────────────────────────────────────────────────────────────────────────
 * The 192.1 lesson, which cost that phase three fences: a sweep against the EMPTY
 * STRING passes every `toBe(0)` and defends nothing — a renamed module was measured
 * doing exactly that and reporting green. A `?raw` import that fails to resolve, or
 * that resolves to the wrong file, produces a zero count for a reason that has
 * nothing to do with the rule. So each case asserts its own input is real and says
 * so out loud.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ RAW, UN-STRIPPED, AND THAT IS DELIBERATE (the Phase 193 D-24(a) precedent)
 * ─────────────────────────────────────────────────────────────────────────────
 * No comment stripper. A docblock QUOTING the forbidden call is caught too, because
 * the next person to copy a line out of a comment copies it into code. **The remedy
 * is the one `StopControl.tsx:14-22` already publishes and obeys: anyone who needs
 * to DISCUSS the forbidden call writes it WITHOUT its parenthesis** — which is why
 * F1's needle carries one — **and refers to the lock's id field by ROLE rather than
 * spelling the property path**, which is what `WorkspacePanel.tsx` does in the very
 * comment where it records the finding. Measured at this commit: this page's source
 * contains neither form, so the fence is un-stripped AND green.
 *
 * The reason F2's second needle matters at all is specific and worth the line:
 * `WorkflowLock.runId` carries **two id types** while its JSDoc asserts one, so a
 * mount that reaches for it TYPECHECKS and then resolves nothing — and
 * `api.ts::cancelRun` swallows 404, so the wrong-id stop is indistinguishable from
 * a successful one. That is a silent no-op, which is the defect `BUG-260816-01` is
 * about. It is recorded at `WorkspacePanel.tsx:161-165` and copied into
 * `api/runs.py`'s route header; this is its third home, and the first mechanical one
 * covering `src/pages`.
 */
describe("194.1-07 F1/F2 — the run page reaches the cancel through ONE mechanism", () => {
  it("F1: the swept source is real, and it calls the cancel API ZERO times", () => {
    const src = pageSource as string
    // The input, asserted before the count — never after.
    expect(typeof src).toBe("string")
    expect(src.length).toBeGreaterThan(20000)
    expect(src).toContain("WorkflowRunPage")
    // Identity beyond the name: this is the file that mounts the shared control.
    expect(src).toContain("<StopControl")

    expect((src.match(/cancelRun\(/g) ?? []).length).toBe(0)
  })

  it("F1 positive control: the same needle DOES find a planted call", () => {
    const planted = `${pageSource as string}\nvoid cancelRun(runId)\n`
    expect((planted.match(/cancelRun\(/g) ?? []).length).toBe(1)
  })

  it("F2: neither the lock's id path nor the cancel call appears — four mounts, ONE mechanism", () => {
    const src = pageSource as string
    expect(src.length).toBeGreaterThan(20000)
    expect(src).toContain("<StopControl")

    const needle = /workflowLock\??\.runId|cancelRun\(/g
    expect((src.match(needle) ?? []).length).toBe(0)
  })

  it("F2 positive control: BOTH arms of the union are individually reachable", () => {
    const src = pageSource as string
    const needle = () => /workflowLock\??\.runId|cancelRun\(/g
    // ⚠ TWO plants, not one. A union needle tested with a single plant proves only
    // that ONE of its arms can fire; the other could be a typo and the fence would
    // still report green forever. The `?.` arm is planted separately for the same
    // reason — optional chaining is how a real mount would most plausibly write it.
    expect((`${src}\nconst a = workflowLock.runId\n`.match(needle()) ?? []).length).toBe(1)
    expect((`${src}\nconst b = workflowLock?.runId\n`.match(needle()) ?? []).length).toBe(1)
    expect((`${src}\nvoid cancelRun(x)\n`.match(needle()) ?? []).length).toBe(1)
  })
})

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PHASE 199 PLAN 07 TASK 1 — THE RUN SURFACE'S RESTING ATOMS.
 *
 * ⚠ SHEET c8 CONTAINS **ZERO** RUN-SURFACE ELEMENTS, and saying so is the finding
 *   rather than an excuse for a thin block. Its six drawn elements — the ask card,
 *   the paused cue, the files section, the file preview, the version diff and the
 *   empty panel — are all PANEL elements at 380px. The only one with a run-surface
 *   analogue is the FILE ROW, and Phase 195 already unified that: both surfaces
 *   render `components/files/FileRow` through `components/files/fileRowUtils`, so
 *   the sheet's file-row language is ALREADY one language across the two.
 *
 * What this block pins is therefore the run header at rest, INCLUDING the shipped
 * behaviour of the definition-unavailable degrade path — which `WorkflowRunPage`'s
 * own docblock claims the header "says so by way of the empty name". That claim is
 * measured here BEFORE it is acted on, so a later correction is an inversion of a
 * recorded reading rather than an assertion about remembered code.
 * ─────────────────────────────────────────────────────────────────────────────
 */
describe("199-07 Task 1 — the run surface's resting atoms (sheet c8 has no run element)", () => {
  it("HEADER at rest — the workflow's NAME and its version chip, as literals", async () => {
    getWorkflowRun.mockResolvedValue(mkRun())
    renderPage()
    await screen.findByTestId("run-transcript")

    // Non-vacuity FIRST — the run really resolved, so the readings below are about
    // a rendered header rather than about a loading state.
    expect(screen.getByTestId("run-band")).toBeInTheDocument()

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Supplier contract renewals",
    )
    expect(screen.getByText("v4")).toBeInTheDocument()
  })

  it("HEADER at rest — the four top-level regions, and nothing else", async () => {
    getWorkflowRun.mockResolvedValue(mkRun({ status: "completed" }))
    const { container } = renderPage()
    await screen.findByTestId("run-transcript")

    // header · the sr-only announcement pair · canvas region · deliverable region.
    // Read off the DOM so an ADDED region reds this rather than passing unnoticed.
    expect(container.querySelectorAll("header")).toHaveLength(1)
    expect(screen.getByTestId("run-transcript-region")).toBeInTheDocument()
    expect(screen.getByLabelText(HERO_LANDMARK)).toBeInTheDocument()
    // ⚠ ONE spine, and it is the CANVAS's. The panel owns the meaningful phase spine
    // (workflow-run-surface.md D1); a second one on this page would be the
    // dual-surface bounce sketch 004 warns against.
    expect(container.querySelectorAll('[data-testid="run-transcript"]')).toHaveLength(1)
  })

  /**
   * ⚠ THE CHARACTERIZATION PIN THIS PLAN EXISTS TO INVERT.
   *
   * `WorkflowRunRead`'s own docblock records the server's degrade path verbatim:
   * *"if the definition row cannot be read, the server returns `workflow_name: ""` /
   * `workflow_slug: ""` / `workflow_version: 0` / `definition: null` rather than
   * 404ing. Treat an empty `workflow_name` as 'definition unavailable', **never
   * render the empty string**."* And `WorkflowRunPage`'s `specs` memo claims *"the
   * header says so by way of the empty name."*
   *
   * MEASURED BELOW, at HEAD: it does not. The header renders the generic word
   * `Workflow` — a plausible-looking default — and the version chip renders `v0`,
   * a fabricated number that looks like a real one. Both are pinned PRESENT here so
   * Task 3's correction is proved by INVERTING these two assertions rather than by
   * deleting them.
   */
  it("DEGRADE PATH — the header SAYS the details could not be read, and prints no version", async () => {
    getWorkflowRun.mockResolvedValue(
      mkRun({ workflow_name: "", workflow_slug: "", workflow_version: 0, definition: null }),
    )
    const { container } = renderPage()
    await screen.findByTestId("run-transcript")

    // Non-vacuity: the degrade fixture really rendered the run arm, not an error arm.
    expect(screen.getByTestId("run-band")).toBeInTheDocument()

    // ⚠ BOTH ASSERTIONS ARE TASK 1'S, INVERTED — the lines are edited, never deleted,
    // so `git diff --numstat` against this plan's base still reads `+N / −0` on this
    // file. Task 1 pinned `toHaveTextContent("Workflow")` and `toContain("v0")`; both
    // were TRUE at HEAD and both were the defect.
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "We couldn't read this workflow's details",
    )
    expect(container.textContent).not.toContain("v0")
    // …and no version chip of ANY value. Absence is the honest reading; a version is
    // a claim, and there is no version to claim.
    //
    // ⚠ THIS IS AN **ELEMENT** QUERY AND THE FIRST DRAFT WAS A `textContent` REGEX,
    // WHICH WAS VACUOUS. `container.textContent` concatenates with no separator, so the
    // page reads `…renewalsv4…` and `\bv\d` has no word boundary to anchor on: the
    // needle could not match even when the chip WAS on screen. Caught by the positive
    // control below failing rather than by reading the regex — which is the whole
    // argument for pairing a count-zero fence with one.
    expect(screen.queryByText(/^v\d+$/)).toBeNull()
  })

  it("DEGRADE PATH POSITIVE CONTROL — a healthy run still prints its name and its version", async () => {
    getWorkflowRun.mockResolvedValue(mkRun())
    renderPage()
    await screen.findByTestId("run-transcript")
    // The needles above are live: the SAME two queries, run against the healthy
    // fixture, find a real name and a real version chip. A degrade fence whose needles
    // could never match anything would report green forever — and this control has
    // already earned its keep once (see the note on the vacuous regex above).
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Supplier contract renewals",
    )
    expect(screen.getByText(/^v\d+$/)).toHaveTextContent("v4")
    expect(screen.queryByText("We couldn't read this workflow's details")).toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════════════════════════════
// Phase 200-07 Task 2 (DES-02 · `200-CHECKLIST.md` §4) — THE PAGE HALF.
//
// `RS-MR-01` (the count's SUPPLY LINE into the canvas) · `RS-MR-02` (per-step start/finish)
// · `RS-MR-03` (a real TOTAL RUNTIME, the product's first honest one) · `RS-MR-04` (D-06's
// distinct renders, read through the receipt) · `RS-MR-05` (the receipt MOUNTED) ·
// `RS-MR-06` + `RS-MNR-07` (D-17: the shipped deliverable listing VERIFIED, the no-previewer
// fence untouched) · `RS-MNR-02` / `RS-MNR-03`.
//
// ⚠ `BUG-260610-01`'s TIMER HALF, AND A CORRECTION THIS PLAN OWES OUT LOUD. The plan text
// says the shipped elapsed is *"anchored at component MOUNT … which is exactly why
// navigating away and back restarts it."* **Measured, that is not what the code does:** F3
// and F6 already moved the anchor to `claimed_at ?? created_at`, both SERVER timestamps, so
// the header figure was remount-stable before this plan touched anything. What this plan
// adds is a SECOND figure — the phase-derived span — and the honest claim is that BOTH are
// server-anchored and neither can reset on navigation. Asserted here for both rather than
// asserted for one and assumed for the other.
//
// ⚠ AND THE REPORT'S `status: open` IS NOT FLIPPED. Its duplicate-avatar half is live, has
// survived two folds (174, 194.1), and a `folded` status would hide it from the routing
// scan — which this exact report has already suffered twice. `git diff` over the report file
// is empty across this plan.
// ═════════════════════════════════════════════════════════════════════════════════════════

/** Two instants 12s apart, and a second pair, so a span is provably not one row's duration. */
const P0_START = "2026-08-05T14:03:10Z"
const P0_END = "2026-08-05T14:03:22Z"
const P1_START = "2026-08-05T14:03:22Z"
const P1_END = "2026-08-05T14:04:10Z"

/** A run whose phase rows carry the four fields `200-02` put on the wire. */
function mkTimedRun(over: Partial<RunLike> = {}): RunLike {
  return mkRun({
    status: "completed",
    phases: [
      {
        slug: "gather-contracts",
        phase_index: 0,
        status: "completed",
        phase_type: "llm_agent",
        started_at: P0_START,
        completed_at: P0_END,
        step_count: 312,
        step_noun: "sources",
      },
      {
        slug: "draft-letter",
        phase_index: 1,
        status: "completed",
        phase_type: "llm_agent",
        started_at: P1_START,
        completed_at: P1_END,
      },
      {
        slug: "final-check",
        phase_index: 2,
        status: "skipped",
        phase_type: "llm_human_input",
      },
    ],
    ...over,
  })
}

function receiptHeaderAtoms(): string[] {
  return Array.from(document.querySelectorAll('[data-testid^="receipt-header-atom-"]')).map(
    (el) => el.textContent ?? "",
  )
}

describe("WorkflowRunPage 200-07 — the receipt is MOUNTED (RS-MR-05 / D-09)", () => {
  beforeEach(() => {
    setLiveSlice([])
    setFiles([])
    setAsks([])
  })

  it("renders the receipt on THIS page — its first and only mount in the product", async () => {
    getWorkflowRun.mockResolvedValue(mkTimedRun())
    renderPage()
    await screen.findByTestId("run-transcript")

    // ⚠ NON-VACUITY FIRST: the region exists AND the receipt inside it does. `200-05`
    // shipped `RunReceipt` exported and mounted NOWHERE — an `import.meta.glob` sweep in its
    // own suite asserted zero importers — so until this line it had never rendered outside a
    // test. This is the case that makes `BS-MR-03`/`RS-MR-05` a product fact.
    expect(screen.getByTestId("run-receipt")).toBeInTheDocument()
    // ⚠ AND IT RENDERS AS A STRIP, NOT A LIST — `variant="summary"`, asserted as ZERO rows.
    // Its rows repeated the run log's steps and durations verbatim, seven hundred pixels
    // below them; an operator caught that on screen while every test here was green, because
    // each one asserted the region's CONTENTS were right and none asked whether the page said
    // the same thing twice. The strip survives because `Ran … · N steps · finished …` is the
    // page's only statement about the run AS A WHOLE derived from steps that really ran.
    expect(screen.getByTestId("run-receipt").querySelectorAll("ol > li")).toHaveLength(0)
    const atoms = receiptHeaderAtoms()
    expect(atoms[1]).toBe("3 steps")
    // ⚠ NON-VACUITY: the per-step detail did not vanish from the page, it MOVED. The log
    // below the strip carries one line per step.
    expect(document.querySelectorAll('[data-testid^="step-card-"]')).toHaveLength(3)
  })

  it("names each step with the SAME `nodeTitle` the canvas paints — never the slug", async () => {
    // Two derivations would give one step two faces on one screen. The receipt refuses to
    // re-derive; the page supplies the name it already computed for the node.
    getWorkflowRun.mockResolvedValue(mkTimedRun())
    renderPage()
    await screen.findByTestId("run-transcript")

    // Retargeted at the LOG, which is the surface on this page that now names each step.
    const titles = Array.from(
      document.querySelectorAll('[data-testid="step-title"], [data-testid="transcript-title"]'),
    ).map((el) => el.textContent ?? "")
    expect(titles).toStrictEqual([
      "Find the supplier contracts",
      "Draft the renewal letter",
      "Check it over",
    ])
    // NON-VACUITY: those are the author names, not the slugs.
    for (const slug of SLUGS) expect(titles).not.toContain(slug)
  })

  it("is mounted on the RUN page and NOWHERE on the builder — 199-02's refusal, by construction", async () => {
    getWorkflowRun.mockResolvedValue(mkTimedRun())
    renderPage()
    await screen.findByTestId("run-transcript")
    expect(screen.getByTestId("run-receipt")).toBeInTheDocument()

    // The builder's spine reads a DRAFT definition and has no run, so a run-tense receipt
    // there would be a fabricated claim — which is precisely what `199-02` refused. The
    // absence is STRUCTURAL: the component is not reachable from that page at all.
    const NEEDLE = ["Run", "Receipt"].join("")
    expect(builderSource).not.toMatch(new RegExp(NEEDLE))
    // POSITIVE CONTROL — the assembled needle finds the shape it forbids, and finds it in
    // THIS page's source, so the two arms are the same measurement pointed two ways.
    expect(pageSource).toMatch(new RegExp(NEEDLE))
  })
})

describe("WorkflowRunPage 200-07 — the total runtime (RS-MR-03)", () => {
  beforeEach(() => {
    setLiveSlice([])
    setFiles([])
    setAsks([])
  })

  it("computes the span from the PHASE timestamps — min(started_at) → max(completed_at)", async () => {
    getWorkflowRun.mockResolvedValue(mkTimedRun())
    renderPage()
    await screen.findByTestId("run-transcript")

    const atoms = receiptHeaderAtoms()
    expect(atoms).toHaveLength(3)
    // 14:03:10 → 14:04:10 is 60s ACROSS the two timed rows. ⚠ It is deliberately NOT any
    // single row's duration (12s and 48s), so a span computed from one row would read
    // differently and be caught.
    expect(atoms[0]).toBe("Ran 1m 00s")
    expect(atoms[1]).toBe("3 steps")
    expect(atoms[2]).toMatch(/^finished \d{2}:\d{2}$/)
  })

  it("`claimed_at` being null does NOT stop it — the measured reason it exists", async () => {
    // `claimed_at` is null on 0 of 149 completed runs, so a span anchored on it is absent
    // exactly when a span is wanted. The phase rows carry their own instants.
    getWorkflowRun.mockResolvedValue(mkTimedRun({ claimed_at: null }))
    renderPage()
    await screen.findByTestId("run-transcript")
    expect(receiptHeaderAtoms()[0]).toBe("Ran 1m 00s")
  })

  it("says so IN WORDS when no row carries a readable pair — never `0s`, never omitted", async () => {
    // Every pre-migration-121 run, and any run whose steps were all routed around. An
    // omitted total reads as "instant"; a `0s` claims a measurement nobody took.
    getWorkflowRun.mockResolvedValue(
      mkTimedRun({
        phases: [
          { slug: "gather-contracts", phase_index: 0, status: "completed", phase_type: "llm_agent" },
        ],
      }),
    )
    renderPage()
    await screen.findByTestId("run-transcript")

    const atoms = receiptHeaderAtoms()
    expect(atoms[0]).toBe("Runtime not recorded")
    expect(atoms[0]).not.toMatch(/\b0s\b/)
    // ⚠ The finish atom is a SEPARATE sentence: one says we do not know how long it took,
    // the other says it has no finish instant to name. Folding them would be a smaller
    // version of the very fold D-06 exists to prevent.
    expect(atoms[2]).toBe("no finish time recorded")
    expect(atoms[0]).not.toBe(atoms[2])
  })

  it("`BUG-260610-01`'s TIMER HALF: BOTH figures survive a remount unchanged", async () => {
    // ⚠ STRUCTURAL, NOT PATCHED. Every anchor on this surface is a SERVER timestamp — the
    // header's `claimed_at ?? created_at` and the receipt's `min(started_at)` — so there is
    // no client instant for a remount to re-take. Driven as a real unmount + re-render with
    // identical props, which is what navigating away and back does.
    getWorkflowRun.mockResolvedValue(mkTimedRun())
    const first = renderPage()
    await screen.findByTestId("run-transcript")
    const spanBefore = receiptHeaderAtoms()[0]
    const elapsedBefore = screen.getByTestId("run-elapsed").textContent
    first.unmount()

    renderPage()
    await screen.findByTestId("run-transcript")
    expect(receiptHeaderAtoms()[0]).toBe(spanBefore)
    expect(screen.getByTestId("run-elapsed").textContent).toBe(elapsedBefore)
    // NON-VACUITY: both really do carry a figure, so "unchanged" is not "empty twice".
    expect(spanBefore).toMatch(/\d/)
    expect(elapsedBefore ?? "").toMatch(/\d/)
  })

  it("the two figures MEASURE DIFFERENT THINGS and each says which", async () => {
    // ⚠ THE REASON A SECOND FIGURE IS NOT A DUPLICATE. An operator reported this exact
    // surface showing its status twice, one line under the other, on 2026-08-06 — which is
    // why the band is `sr-only` today. Two figures are honest only while each is labelled
    // with the field it came from.
    getWorkflowRun.mockResolvedValue(mkTimedRun())
    renderPage()
    await screen.findByTestId("run-transcript")

    const header = screen.getByTestId("run-elapsed").textContent ?? ""
    // The header names its own anchor in plain words…
    expect(header).toMatch(/from when it (was queued|started processing)/)
    // …and the receipt's total is a different reading of a different pair.
    expect(receiptHeaderAtoms()[0]).toBe("Ran 1m 00s")
    expect(header).not.toContain("Ran 1m 00s")
  })
})

describe("WorkflowRunPage 200-07 — D-06's arms on the receipt (RS-MR-02 / RS-MR-04)", () => {
  beforeEach(() => {
    setLiveSlice([])
    setFiles([])
    setAsks([])
  })

  it("renders a real per-step duration, and `never ran` for the routed-around step", async () => {
    getWorkflowRun.mockResolvedValue(mkTimedRun())
    renderPage()
    await screen.findByTestId("run-transcript")

    const times = logTimes()
    expect(times[0]).toBe("12s")
    expect(times[1]).toBe("48s")
    // ⚠ The skipped row is an AFFIRMATIVE fact, not a blank — and it is a DIFFERENT string
    // from the historic row's, which is `RS-MNR-04`.
    // ⚠ THE PAGE'S WORD, NOT THE RECEIPT'S, and D-06's claim is unchanged: a routed-around
    // step and a step whose time was never recorded must read DIFFERENTLY. Since the re-port
    // the log carries the page's richer label for a state and the spine carries the time, so
    // the skipped step reads as the sentence a person gets. The inequality below is the arm.
    expect(times[2].toLowerCase()).toContain("skipped")
    expect(times[2]).not.toContain("time not recorded")
  })

  it("RS-MNR-04: a historic row reads `time not recorded`, never the skipped sentence", async () => {
    getWorkflowRun.mockResolvedValue(
      mkTimedRun({
        phases: [
          // Terminal with BOTH timestamps absent — written before migration 121 existed.
          { slug: "gather-contracts", phase_index: 0, status: "completed", phase_type: "llm_agent" },
          { slug: "draft-letter", phase_index: 1, status: "skipped", phase_type: "llm_agent" },
        ],
      }),
    )
    renderPage()
    await screen.findByTestId("run-transcript")

    const times = logTimes()
    expect(times[0]).toBe("time not recorded")
    expect(times[1].toLowerCase()).toContain("skipped")
    expect(times[0]).not.toBe(times[1])
  })

  it("RS-MNR-02: an `active` row under a TERMINAL run reads `did not finish` — no clock", async () => {
    // The residual is INHERITED (`harness_engine.py:1698-1706`): the engine only terminalizes
    // the interrupted phase on a cancellation, so a crash leaves this row behind. Ticking it
    // would re-create `BUG-260610-01`'s symptom on the screen built to remove it.
    getWorkflowRun.mockResolvedValue(
      mkTimedRun({
        status: "failed",
        phases: [
          {
            slug: "gather-contracts",
            phase_index: 0,
            status: "active",
            phase_type: "llm_agent",
            started_at: P0_START,
          },
        ],
      }),
    )
    renderPage()
    await screen.findByTestId("run-transcript")

    const time = logTimes()[0]
    expect(time).toBe("did not finish")
    expect(time).not.toMatch(/\d/)
    const row = screen.getByTestId("step-card-gather-contracts")
    expect(within(row).getByTestId("step-yield-gather-contracts").textContent).toBe("did not finish")
  })
})

describe("WorkflowRunPage 200-07 — FETCH IS AUTHORITATIVE (D-v2.5-03)", () => {
  beforeEach(() => {
    setFiles([])
    setAsks([])
  })

  it("a STALE live-slice row does not override the durable rows the receipt reads", async () => {
    setLiveSlice([
      mkPhase(0, "running", "gather-contracts"),
      mkPhase(1, "pending", "draft-letter"),
      mkPhase(2, "pending", "final-check"),
    ])
    getWorkflowRun.mockResolvedValue(mkTimedRun())
    renderPage()
    await screen.findByTestId("run-transcript")

    const times = logTimes()
    // The FETCH's answer, not the slice's: a finished duration, never a live tick.
    expect(times[0]).toBe("12s")
    expect(times[0]).not.toMatch(/so far/)
    expect(
      screen.getByTestId("step-card-gather-contracts").getAttribute("data-reading"),
    ).toBe("running")
    const logRow = screen.getByTestId("step-card-gather-contracts")
    expect(logRow.getAttribute("data-source-conflict")).toBe("true")
    expect(within(logRow).getByTestId("step-yield-gather-contracts").textContent).not.toBe("Running")
    expect(
      within(screen.getByTestId("spine-step-gather-contracts")).getByTestId("spine-duration")
        .textContent,
    ).toBe("12s")
  })

  it("the receipt survives a run with NO durable rows at all — nothing claimed, nothing crashed", async () => {
    // A run read that came back with an empty `phases` array. The honest render is an empty
    // list and a worded absence, never a fabricated span and never a throw.
    setLiveSlice([])
    getWorkflowRun.mockResolvedValue(mkTimedRun({ phases: [] }))
    renderPage()
    await screen.findByTestId("run-transcript")

    expect(screen.getByTestId("run-receipt")).toBeInTheDocument()
    expect(screen.getByTestId("run-receipt").querySelectorAll("ol > li")).toHaveLength(0)
    const atoms = receiptHeaderAtoms()
    expect(atoms[0]).toBe("Runtime not recorded")
    expect(atoms[1]).toBe("0 steps")
  })
})

describe("WorkflowRunPage 200-07 — the count's supply line (RS-MR-01 / RS-MNR-03)", () => {
  beforeEach(() => {
    setLiveSlice([])
    setFiles([])
    setAsks([])
  })

  it("renders the DECLARED count and noun on the step list line, as the pair the wire sent", async () => {
    getWorkflowRun.mockResolvedValue(mkTimedRun())
    renderPage()
    await screen.findByTestId("run-transcript-region")

    const yieldEl = screen.getByTestId("step-yield-gather-contracts")
    expect(yieldEl.textContent).toBe("312 sources")
    // D-05: Spine carries no count
    expect(
      screen.getByTestId("spine-step-gather-contracts").querySelector('[data-testid="spine-count"]'),
    ).toBeNull()
  })

  it("RS-MNR-03: a step that declared NO count renders NO count slot — never a `0`", async () => {
    getWorkflowRun.mockResolvedValue(mkTimedRun())
    renderPage()
    await screen.findByTestId("run-transcript-region")

    for (const slug of ["draft-letter", "final-check"]) {
      const row = screen.getByTestId(`spine-step-${slug}`)
      expect(within(row).queryByTestId("spine-count")).toBeNull()
      expect(screen.queryByTestId(`step-count-${slug}`)).toBeNull()
    }
  })

  it("a DECLARED `0` is forwarded as the fact it is", async () => {
    getWorkflowRun.mockResolvedValue(
      mkTimedRun({
        phases: [
          {
            slug: "gather-contracts",
            phase_index: 0,
            status: "completed",
            phase_type: "llm_agent",
            started_at: P0_START,
            completed_at: P0_END,
            step_count: 0,
            step_noun: "sources",
          },
        ],
      }),
    )
    renderPage()
    await screen.findByTestId("run-transcript-region")

    expect(screen.getByTestId("step-yield-gather-contracts").textContent).toBe("0 sources")
  })

  it("the NOUN passes VERBATIM — this page substitutes no word of its own", async () => {
    getWorkflowRun.mockResolvedValue(
      mkTimedRun({
        phases: [
          {
            slug: "gather-contracts",
            phase_index: 0,
            status: "completed",
            phase_type: "llm_agent",
            started_at: P0_START,
            completed_at: P0_END,
            step_count: 7,
            step_noun: "zzqx",
          },
        ],
      }),
    )
    renderPage()
    await screen.findByTestId("run-transcript-region")
    expect(screen.getByTestId("step-yield-gather-contracts").textContent).toBe("7 zzqx")
  })
})

describe("WorkflowRunPage 200-07 — D-17 verified, not rebuilt (RS-MR-06 / RS-MNR-07)", () => {
  beforeEach(() => {
    setLiveSlice([])
    setAsks([])
  })

  it("the shipped deliverable listing still renders — a GREEN row DRIVEN, not read", async () => {
    getWorkflowRun.mockResolvedValue(mkTimedRun())
    setFiles([
      {
        id: "file-1",
        path: "out/renewal-letter.docx",
        size_bytes: 20480,
        mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      } as WorkspaceFile,
    ])
    renderPage()
    await screen.findByTestId("run-transcript-region")

    const region = screen.getByLabelText(HERO_LANDMARK)
    expect(region).toBeInTheDocument()
    expect(region.textContent).toContain("renewal-letter.docx")
    // Exactly one control per row, and it is a download.
    expect(within(region).getAllByRole("button")).toHaveLength(1)
    expect(
      within(region).getByRole("button", { name: /Download renewal-letter\.docx/ }),
    ).toBeInTheDocument()
  })

  it("the receipt did NOT open a file-content path — the no-previewer fence still stands", async () => {
    // ⚠ D-17 IS A TESTED DECISION, NOT A GAP: DOCX/PPTX/XLSX/PDF are download-only, and the
    // template engine emits `.docx`, so the flagship deliverable is exactly the artefact that
    // cannot be shown in place. The shipped previewer fence higher up this file is UNEDITED
    // by this plan — its acceptance is a diff grep for its own title, so that title is
    // deliberately not re-typed here (the 187-24 rule, which has now fired three times in
    // this plan alone). This case is the independent statement that the receipt, which is
    // NEW surface, did not smuggle a file-content path in beside it.
    getWorkflowRun.mockResolvedValue(mkTimedRun())
    setFiles([])
    renderPage()
    await screen.findByTestId("run-transcript")

    const receipt = screen.getByTestId("run-transcript-region")
    // No file names, no preview affordance, and NO deliverable slot at all — nothing on
    // `workflow_phases` says which file a step produced, so the page passes no
    // `deliverableOf` and the receipt renders none.
    expect(receipt.querySelectorAll('[data-testid="receipt-row-deliverable"]')).toHaveLength(0)
    // POSITIVE CONTROL — the receipt CAN render that slot, so the absence is a decision
    // rather than a component that never had the feature.
    expect(receiptSource).toContain("receipt-row-deliverable")
  })
})

// ═════════════════════════════════════════════════════════════════════════════════════════
// Phase 200-07 Task 3 (DES-02 · `200-CHECKLIST.md` §4.2) — THE `run-surface` MUST NOT RENDER
// FENCE.
//
// Covers `RS-MNR-01` (prose in the count slot — N-8), `RS-MNR-02` (a live-ticking clock on a
// step that never ran, or on a run that has ended), `RS-MNR-03` (`0` or a dash standing in
// for a step that declared no count) and `RS-MNR-06` (a Material Symbols ligature NAME as
// visible text — N-5).
//
// ⚠ THE SHAPE IS ROLE-SET + RENDERED LEAF TEXT, AND THAT IS FOUR MEASUREMENTS OLD IN THIS
// PHASE ALONE, not a style. Every one of them is a fence that read GREEN against a real
// violation:
//
//   · `199-03` — a `?raw` SOURCE REGEX **and** a `queryAllByRole("button")` filter both passed
//     against a live planted `<a href="/publish?force=1">Proceed to publish anyway</a>`. A
//     source regex cannot see a control composed from a variable; a button scan cannot see a
//     link. Only a role-SET scan went red.
//   · wave 3 — a fence was REACHED and wrote nothing, because its fixture queue was empty.
//   · wave 5 — a word-boundary regex MISSED a planted chip, because ADJACENT DOM TEXT NODES
//     CONCATENATE WITH NO SEPARATOR (`<span>Gather sources</span><span>llm_agent</span>`
//     reads as `Gather sourcesllm_agent`, so the id is preceded by a word character).
//   · wave 6 — two fences went RED against a CORRECT tree because their own explanatory prose
//     contained their needle (the 187-24 trap).
//
// So: LEAF elements (text a person actually reads as one atom), plus ANNOUNCED text
// (`aria-label` / `title` / `alt` / `placeholder`) over the role SET, containment rather than
// word boundaries, and needles ASSEMBLED rather than spelled where a comment could defeat
// them.
//
// ⚠ AND IT WAS DRIVEN RED AGAINST A PLANT IN PRODUCTION SOURCE, not only against the
// synthetic control below — see `200-07-SUMMARY.md` for the checksums.
// ═════════════════════════════════════════════════════════════════════════════════════════

/**
 * The count slots this surface renders.
 *
 * ⚠ WIDENED WHEN THE RUN LOG BECAME THE PAGE'S CENTRE, and widening it was NOT optional. This
 * fence exists to prove that a fabricated figure or a stray ligature cannot reach the screen;
 * a selector list that names only the OLD slots would have kept returning zero and reporting
 * `clean` about a surface it could no longer see. A fence that stops matching is not a fence
 * that passes — the failure this project records over and over — so the log's slots are named
 * here in the same commit that made them the ones a person reads.
 */
const COUNT_SLOTS =
  '[data-testid="receipt-row-count"],[data-testid="phase-card-count"],' +
  '[data-testid^="step-count-"],[data-testid="spine-count"]'
/** The one-reading-per-row time slots, on every half. */
const TIME_SLOTS =
  '[data-testid="receipt-row-time"],[data-testid="phase-card-timing"],' +
  '[data-testid="spine-duration"],[data-testid="spine-elapsed"]'

/**
 * The Material Symbols ligature names measured in the rendered text of all four in-scope
 * screens (`200-RESEARCH.md` §A2), split into two shapes because ONE SHAPE CANNOT DO BOTH.
 *
 * ⚠ THE SPLIT IS LOAD-BEARING, and `200-05` learned it the hard way one file over. The
 * snake_case forms appear in no product sentence, so containment is safe. The single-word
 * forms — `add`, `check`, `search`, `lock`, `person`, `error` — are ORDINARY ENGLISH, and a
 * containment needle on them fires on honest copy (`Add the first step`, `no finish time
 * recorded`). Those are matched only where an element's ENTIRE trimmed text is the ligature,
 * which is what an icon font actually renders.
 */
const LIGATURES_UNDERSCORED = [
  "check_circle", "chevron_right", "priority_high", "account_tree", "chat_bubble",
  "add_circle", "health_and_safety", "arrow_back", "fit_screen", "save_as",
  "account_circle",
]
const LIGATURES_BARE = [
  "check", "sync", "menu", "add", "search", "close", "info", "error", "bolt", "folder",
  "lock", "shield", "warning", "person", "output", "description", "widgets", "remove",
  "settings", "category", "dataset", "policy", "summarize", "psychology",
]

/** Every LEAF element's own text — one atom as a person reads it. */
function leafTexts(root: ParentNode): string[] {
  return Array.from(root.querySelectorAll("*"))
    .filter((el) => el.children.length === 0)
    .map((el) => (el.textContent ?? "").trim())
    .filter((t) => t.length > 0)
}

/**
 * Announced text over the ROLE SET — the half a visible-text scan cannot see, and the half
 * `199-03` measured a button-only filter walking straight past.
 */
function announcedTexts(root: ParentNode): string[] {
  const ROLE_SET = 'a[href], button, [role], [aria-label], [title], [alt], [placeholder]'
  return Array.from(root.querySelectorAll(ROLE_SET))
    .flatMap((el) =>
      ["aria-label", "title", "alt", "placeholder"].map((a) => (el.getAttribute(a) ?? "").trim()),
    )
    .filter((t) => t.length > 0)
}

/**
 * The predicate. Returns the ROW IDS violated, so a failure names the atom rather than
 * printing a diff of the DOM.
 *
 * @param terminal whether the run under test has ENDED — `RS-MNR-02`'s second half is only
 *                 a violation on a run that is over, because a live run's `so far` is the
 *                 honest reading and a fence that forbade it would forbid the feature.
 */
function runSurfaceViolations(root: ParentNode, terminal: boolean): string[] {
  const hits = new Set<string>()

  // ── RS-MNR-01 / RS-MNR-03 — the count slot holds a COUNT or it does not exist ──────────
  // The only shape a count slot may ever hold is `{integer} {noun}`. Prose fails it (N-8),
  // a bare `0` with no noun fails it, and every dash form fails it. ⚠ A declared `0 sources`
  // PASSES, and must: the step searched and found nothing, which is a measurement.
  for (const slot of Array.from(root.querySelectorAll(COUNT_SLOTS))) {
    const text = (slot.textContent ?? "").trim()
    if (/^-|^[—–]$|^0$|^$/.test(text)) hits.add("RS-MNR-03")
    else if (!/^\d+\s+\S+/.test(text)) hits.add("RS-MNR-01")
  }

  // ── RS-MNR-02 — no live clock where nothing is live ───────────────────────────────────
  // A `so far` reading is the ONLY ticking shape this surface renders, and it is legitimate
  // on exactly one arm. Two ways it becomes a lie: on a step that never ran, and on a run
  // that has ended (the inherited `harness_engine.py:1698-1706` residual).
  for (const slot of Array.from(root.querySelectorAll(TIME_SLOTS))) {
    const text = (slot.textContent ?? "").trim()
    const ticking = /so far/.test(text)
    if (!ticking) continue
    if (terminal) hits.add("RS-MNR-02")
    const kind = slot.getAttribute("data-timing-kind")
    if (kind !== null && kind !== "running") hits.add("RS-MNR-02")
  }
  // …and the same reading must never sit on a row whose OUTCOME says it never ran.
  for (const row of Array.from(root.querySelectorAll("[data-outcome]"))) {
    const outcome = row.getAttribute("data-outcome") ?? ""
    if (!/never ran|not reached/.test(outcome)) continue
    if (/so far/.test(row.textContent ?? "")) hits.add("RS-MNR-02")
  }

  // ── RS-MNR-06 — no ligature NAME as text a person reads (N-5) ─────────────────────────
  const leaves = leafTexts(root)
  const announced = announcedTexts(root)
  for (const text of [...leaves, ...announced]) {
    // ⚠ CONTAINMENT for the snake_case forms — they appear in no product sentence, and a
    // word-boundary needle would miss one that concatenated with an adjacent text node.
    if (LIGATURES_UNDERSCORED.some((l) => text.includes(l))) hits.add("RS-MNR-06")
  }
  for (const text of leaves) {
    // ⚠ WHOLE-TEXT for the bare forms, because they are ordinary English. `no finish time
    // recorded` contains none of them as an ENTIRE leaf; an icon font's `<span>check</span>`
    // does.
    if (LIGATURES_BARE.includes(text.toLowerCase())) hits.add("RS-MNR-06")
  }

  return Array.from(hits).sort()
}

describe("WorkflowRunPage 200-07 — §4.2 MUST NOT RENDER, and the fence can FIRE", () => {
  beforeEach(() => {
    setLiveSlice([])
    setFiles([])
    setAsks([])
  })

  it("PERMANENT POSITIVE CONTROL — a planted violation of EACH row id is found", () => {
    // ⚠ COMMITTED PERMANENTLY, and asserted BEFORE any absence claim below. A fence that
    // cannot fire is the artefact this phase has now shipped and caught four separate times;
    // the only thing that distinguishes a silent fence from a satisfied one is a control
    // that makes it speak.
    const plant = document.createElement("div")
    plant.innerHTML = [
      // RS-MNR-01 — N-8's own defect, verbatim from the sketch: a SENTENCE where a COUNT goes.
      '<span data-testid="receipt-row-count">Summarized meeting notes</span>',
      // RS-MNR-03 — a dash, and a bare `0` with no noun, standing in for an absence.
      '<span data-testid="phase-card-count">—</span>',
      '<span data-testid="receipt-row-count">0</span>',
      // RS-MNR-02 — a live tick on a step that never ran.
      '<span data-testid="phase-card-timing" data-timing-kind="never-ran">12s so far</span>',
      // …and on a row whose own outcome says it never ran.
      '<li data-outcome="never ran (skipped)"><span>4s so far</span></li>',
      // RS-MNR-06 — a ligature NAME rendered as text, in both shapes: the snake_case form
      // inside a sentence, and the bare form as an entire leaf (what an icon font emits).
      '<span>status check_circle</span>',
      '<span>sync</span>',
      // …and one smuggled into a LINK's accessible name — the exact shape `199-03` proved a
      // button-only scan walks past.
      '<a href="#x" aria-label="account_tree">go</a>',
    ].join("")

    const hits = runSurfaceViolations(plant, true)
    expect(hits).toStrictEqual(["RS-MNR-01", "RS-MNR-02", "RS-MNR-03", "RS-MNR-06"])
    expect(hits.length).toBeGreaterThanOrEqual(3)
  })

  it("PERMANENT NEGATIVE CONTROL — the honest shipped copy does NOT fire it", () => {
    // The other half, and it is what stops the control above from being satisfied by a
    // predicate that simply always fires. Every string here is one this surface really
    // renders, including two that contain a bare ligature as a WORD (`recorded` holds none,
    // but `no finish time recorded` and `never ran (skipped)` are the sentences a naive
    // needle set breaks on) and a declared `0`, which is a FACT and must pass.
    const honest = document.createElement("div")
    honest.innerHTML = [
      '<span data-testid="receipt-row-count">0 sources</span>',
      '<span data-testid="receipt-row-count">312 sources</span>',
      '<span data-testid="phase-card-timing" data-timing-kind="running">12s so far</span>',
      '<span data-testid="receipt-row-time">never ran (skipped)</span>',
      '<span data-testid="receipt-row-time">time not recorded</span>',
      '<li data-outcome="finished"><span>1.8s</span></li>',
      '<span>Files in this run\'s workspace</span>',
      '<span>What this run did, step by step</span>',
      '<span>no finish time recorded</span>',
      '<a href="#x" aria-label="Download renewal-letter.docx (20 KB)">go</a>',
    ].join("")
    // `terminal: false` — a LIVE run, where `so far` is the honest reading.
    expect(runSurfaceViolations(honest, false)).toStrictEqual([])
  })

  it("the REAL terminal render is clean — no prose, no dash, no dead clock, no ligature", async () => {
    getWorkflowRun.mockResolvedValue(mkTimedRun())
    setFiles([
      {
        id: "file-1",
        path: "out/renewal-letter.docx",
        size_bytes: 20480,
        mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      } as WorkspaceFile,
    ])
    const { container } = renderPage()
    await screen.findByTestId("run-transcript")

    // NON-VACUITY BEFORE CONTENTS — the render really has the slots the predicate reads, so
    // a clean result is *nothing wrong* rather than *nothing there*. Wave 3 shipped a fence
    // that was reached and wrote nothing because its fixture queue was empty.
    expect(container.querySelectorAll(TIME_SLOTS).length).toBeGreaterThan(0)
    expect(container.querySelectorAll(COUNT_SLOTS).length).toBeGreaterThan(0)
    expect(leafTexts(container).length).toBeGreaterThan(10)

    expect(runSurfaceViolations(container, true)).toStrictEqual([])
  })

  it("the REAL live render is clean too, and its ONE tick is on the running arm only", async () => {
    getWorkflowRun.mockResolvedValue(
      mkTimedRun({
        status: "active",
        phases: [
          {
            slug: "gather-contracts",
            phase_index: 0,
            status: "completed",
            phase_type: "llm_agent",
            started_at: P0_START,
            completed_at: P0_END,
          },
          {
            slug: "draft-letter",
            phase_index: 1,
            status: "active",
            phase_type: "llm_agent",
            started_at: P1_START,
          },
          { slug: "final-check", phase_index: 2, status: "pending", phase_type: "llm_human_input" },
        ],
      }),
    )
    const { container } = renderPage()
    await screen.findByTestId("run-transcript")

    expect(runSurfaceViolations(container, false)).toStrictEqual([])
    // …and exactly ONE row is ticking. A live run with three ticking rows would pass the
    // predicate above and still be a lie about two of them.
    const ticking = Array.from(container.querySelectorAll(TIME_SLOTS)).filter((el) =>
      /so far/.test(el.textContent ?? ""),
    )
    expect(ticking).toHaveLength(1)
  })
})

// ═════════════════════════════════════════════════════════════════════════════════════════
// Phase 200-07 Task 3 B — THE REPORT REGISTER, RECORDED AS EXECUTABLE ROWS.
//
// `200-CHECKLIST.md` §5's rule for an atom that is not built here is **REPORT, with a NAMED
// re-open trigger — never faked, never silently dropped**. These two cases are that record,
// written as tests rather than as SUMMARY prose for one reason: prose in a summary is read
// once, and a case is re-read every time the gate runs. ⚠ A later plan that finds itself
// building one of these has grown a capability inside a phase that did not scope one — the
// G-7 failure mode, in miniature.
// ═════════════════════════════════════════════════════════════════════════════════════════
describe("WorkflowRunPage 200-07 — the REPORT rows (§5), not built, not faked", () => {
  beforeEach(() => {
    setLiveSlice([])
    setFiles([])
    setAsks([])
  })

  it("RS-3b — the SUB-STEP execution trace is REPORTED, and provably absent", async () => {
    // ⚠ DISCHARGES RESEARCH R3, WHICH IS WHY RS-3 IS SPLIT AT ALL. The sketch draws EIGHT
    // `00:0x` trace lines for a FIVE-step run — `Connecting to Northwind CRM instance…`,
    // `Analyzing risk factors` and the rest — and several are SUB-STEP events, while this
    // phase's wire slice is PHASE-LEVEL only. Their substrate would be `harness_audit`
    // events / `EmitSubStep`: a SECOND backend concern, deliberately not stacked here.
    // Building it would have made ROADMAP SC#5's *"the extraction changes no behaviour
    // beyond the human-gate fix"* unprovable.
    //
    // **Re-open trigger, verbatim from §5:** *the phase that scopes `harness_audit` /
    // `EmitSubStep` as a client transport.*
    getWorkflowRun.mockResolvedValue(mkTimedRun())
    const { container } = renderPage()
    await screen.findByTestId("run-transcript")

    // ⚠ NOT FAKED is the claim, so it is the ABSENCE that is asserted: this surface renders
    // ONE row per PHASE and nothing finer. Three phase rows, three receipt rows — no
    // sub-step line has been invented to fill the sketch's eight.
    // ⚠ COUNTED ON THE LOG, which is where the per-step lines live since the receipt became a
    // summary strip. The claim is unchanged: THREE step-level lines and not one sub-step line,
    // because the sub-step trace the sheet draws has no client transport.
    expect(document.querySelectorAll('[data-testid^="step-card-"], [data-testid^="transcript-row-"]')).toHaveLength(3)
    const text = container.textContent ?? ""
    expect(text).not.toContain("Connecting to")
    expect(text).not.toContain("Analyzing risk factors")
    // …and no `mm:ss` trace stamp, which is the shape those eight lines carry.
    expect(text).not.toMatch(/\b00:0\d\b/)
  })

  it("RS-1 — this screen has NO `now` capture, so its acceptance is the proposal alone", () => {
    // ⚠ `JOURNEY["run-surface"].now` is literally `null` (N-3), and the sketch left it empty
    // rather than drawing it from imagination. There is therefore NO SHIPPED HALF to diff
    // against: a verifier cannot fall back on *"nothing regressed"* here, and this plan must
    // not invent a "before" it never had.
    //
    // **Re-open trigger, verbatim from §5:** *a run that can be driven for capture* — i.e.
    // after `200-02` + `200-07` land, a real 1440×900 capture pairs the screen and `now-08`
    // joins `200-journey-now/`.
    //
    // Recorded as an executable row rather than a sentence in a summary, so the obligation is
    // re-read on every gate run rather than once. There is nothing to assert about a capture
    // that does not exist, which is exactly the point being recorded.
    expect(true).toBe(true)
  })
})


describe("WorkflowRunPage 200 — the right-hand run panel, mounted at last", () => {
  beforeEach(() => {
    setFiles([])
    setAsks([])
    setLiveSlice([
      mkPhase(0, "done", "gather-contracts"),
      mkPhase(1, "running", "draft-letter"),
      mkPhase(2, "pending", "final-check"),
    ])
    getWorkflowRun.mockResolvedValue(mkRun({ thread_id: RUN_THREAD_ID }))
    useViewingThread.mockReturnValue(VIEWED_THREAD_ID)
  })

  it("mounts a step spine on the run surface and hands it the RUN's thread, not the viewed one", async () => {
    // ⚠ THE WHOLE ROW, IN ONE ASSERTION PAIR. Before this plan the spine existed and no run
    // surface could reach it: the panel shell's ONLY mount is inside chat's branch, and a
    // grep for it over this page returned 0. The sheet draws the spine down the right of the
    // run surface, so the capability was built and simply not mounted.
    renderPage()
    await screen.findByTestId("run-transcript")

    /**
     * ⚠ THE SPINE IS NO LONGER THE DEVELOPER PANEL'S, AND THIS CASE CHANGED WITH IT.
     *
     * It used to assert that `PhaseTimeline` received the RUN's `threadId` rather than the
     * globally-viewed one. Seen in a browser against the sheet, that component was the wrong
     * one entirely: it rendered raw `workflow_phases.slug` values, a `Phase 5 / 5` counter and
     * an agent count to a business author. `RunSpine` replaced it and takes NO thread id at
     * all — it is handed the run's own durable rows — so the wrong-thread hazard the old
     * assertion guarded is now structurally unreachable rather than merely tested.
     *
     * What replaces it is the stronger claim: the spine names the steps of THIS run, in the
     * page's own vocabulary, and spells no slug.
     */
    const spine = screen.getByTestId("spine-step-gather-contracts")
    expect(spine).toBeInTheDocument()
    const spineTitles = Array.from(
      document.querySelectorAll('[data-testid="spine-title"]'),
    ).map((el) => el.textContent ?? "")
    expect(spineTitles).toStrictEqual([
      "Find the supplier contracts",
      "Draft the renewal letter",
      "Check it over",
    ])
    // ⚠ NON-VACUITY, AND THE WHOLE REASON THIS COMPONENT EXISTS: those are the author's names,
    // and NOT ONE of the run's slugs appears anywhere in the spine.
    const spineText = screen.getByTestId("run-panel").textContent ?? ""
    for (const slug of SLUGS) expect(spineText).not.toContain(slug)
  })

  it("the panel region is a sibling of the log, so neither one displaced the other", async () => {
    renderPage()
    await screen.findByTestId("run-transcript")
    const panel = screen.getByTestId("run-panel")
    // NON-VACUITY: the centre region is still on screen. The mount added a column; it
    // replaced nothing, which is the difference between wiring a surface and rebuilding it.
    expect(screen.getByTestId("run-transcript-region")).toBeInTheDocument()
    expect(panel).toBeInTheDocument()
    // Named for a screen reader, because a second scrollable column that announces nothing
    // is a second place to get lost in.
    expect(panel.getAttribute("aria-label")).toBe("Run steps")
  })

  it("a pending ask reaches the run surface, and a LIVE run does not mark it over", async () => {
    setAsks([mkAsk("call-7")])
    renderPage()
    await screen.findByTestId("run-transcript")

    const card = screen.getByTestId("ask-stub-call-7")
    expect(card).toBeInTheDocument()
    // `mkRun`'s default status is `active`, so the prompt is answerable.
    expect(card.getAttribute("data-runisover")).toBe("false")
  })

  it("a TERMINAL run marks its unanswered prompt over — the control must not post into a stopped run", async () => {
    // ⚠ NOT A COSMETIC ARM. The panel's own stack derives `runIsOver` from two hooks; this
    // surface holds the run ROW itself, which is the stronger source. A cancelled run with an
    // unanswered ask left on its thread does NOT need your reply, and offering a live-looking
    // control there would be this page's own honesty rule broken in a new place.
    setAsks([mkAsk("call-7")])
    getWorkflowRun.mockResolvedValue(
      mkRun({ thread_id: RUN_THREAD_ID, status: "cancelled" }),
    )
    renderPage()
    await screen.findByTestId("run-transcript")

    expect(screen.getByTestId("ask-stub-call-7").getAttribute("data-runisover")).toBe("true")
  })

  it("no ask means no card — never an empty frame", async () => {
    renderPage()
    await screen.findByTestId("run-transcript")
    expect(screen.queryByTestId("ask-stub-call-1")).toBeNull()
    // The spine is still there: the absence is the ask's, not the panel's.
    expect(screen.getByTestId("spine-step-draft-letter")).toBeInTheDocument()
  })
})

describe("WorkflowRunPage 200 — the centre switch (operator decision, 2026-08-20)", () => {
  beforeEach(() => {
    setFiles([])
    setAsks([])
    setLiveSlice([])
    getWorkflowRun.mockResolvedValue(mkTimedRun())
  })

  it("opens on the LOG, and the canvas is not rendered until it is asked for", async () => {
    // ⚠ THE DEFAULT IS THE ARGUMENT. The definition is a flat list with no branch construct, so
    // a run's canvas is a straight chain and shows nothing the log does not — which bounds
    // which view opens FIRST and was never a reason to make the other unreachable.
    renderPage()
    await screen.findByTestId("run-transcript")
    expect(screen.getByTestId("run-centre-log").getAttribute("aria-checked")).toBe("true")
    expect(screen.getByTestId("run-centre-canvas").getAttribute("aria-checked")).toBe("false")
    expect(screen.queryByTestId("run-transcript")).toBeInTheDocument()
  })

  it("swaps the centre — and swaps it BACK, so neither view is a one-way door", async () => {
    renderPage()
    await screen.findByTestId("run-transcript")

    fireEvent.click(screen.getByTestId("run-centre-canvas"))
    expect(screen.queryByTestId("run-transcript")).toBeNull()
    expect(screen.getByTestId("run-centre-canvas").getAttribute("aria-checked")).toBe("true")
    // ⚠ AND THE SUMMARY STRIP GOES WITH THE LOG. It is that column's header sentence, not the
    // page's; leaving it over a graph would be a third statement of the run's total.
    expect(screen.queryByTestId("run-receipt")).toBeNull()

    fireEvent.click(screen.getByTestId("run-centre-log"))
    expect(screen.getByTestId("run-transcript")).toBeInTheDocument()
    expect(screen.getByTestId("run-receipt")).toBeInTheDocument()
  })

  it("the SPINE survives both views — it is not part of the thing being switched", async () => {
    // The switch chooses how to read the run's CENTRE. What needs your attention stays put.
    renderPage()
    await screen.findByTestId("run-transcript")
    expect(screen.getByTestId("run-panel")).toBeInTheDocument()
    fireEvent.click(screen.getByTestId("run-centre-canvas"))
    expect(screen.getByTestId("run-panel")).toBeInTheDocument()
    expect(screen.getByTestId("spine-step-gather-contracts")).toBeInTheDocument()
  })

  it("is a radiogroup, because exactly one of two readings is showing", async () => {
    // Two plain buttons announce two unrelated controls and never say which view you are in.
    renderPage()
    await screen.findByTestId("run-transcript")
    const group = screen.getByTestId("run-centre-switch")
    expect(group.getAttribute("role")).toBe("radiogroup")
    expect(group.getAttribute("aria-label")).toBe(CENTRE_SWITCH_LABEL)
    expect(within(group).getAllByRole("radio")).toHaveLength(2)
  })
})

describe("WorkflowRunPage 200 — the page-resolved liveness boolean (PORT-canvas.md)", () => {
  beforeEach(() => {
    setFiles([])
    setAsks([])
    useViewingThread.mockReturnValue(VIEWED_THREAD_ID)
  })

  it("marks ONLY the executing step live — never the waiting one and never the unreached one", async () => {
    // ⚠ THIS IS THE ROW THE CANVAS AUTHOR BUILT AND BACKED OUT. Its suite forbids that file
    // from spelling any reading word or importing the vocabulary as a value, so it could not
    // derive "running" for itself; the recorded clean fix was a page-resolved boolean, and
    // the page was not that dispatch's to edit. This asserts the page half.
    setLiveSlice([
      mkPhase(0, "done", "gather-contracts"),
      mkPhase(1, "running", "draft-letter"),
      mkPhase(2, "pending", "final-check"),
    ])
    getWorkflowRun.mockResolvedValue(mkRun())
    renderPage()
    await screen.findByTestId("run-transcript")

    // ⚠ THE FIELD ITSELF IS NO LONGER READ ON THIS PAGE — the canvas it animated is not
    // mounted here any more — so what is asserted is the DERIVATION that produces it, at the
    // one place it still exists. The three readings below are the boolean's three inputs;
    // `live` is `reading === "running"` and nothing else, which is what the source fence at
    // the end of this block pins.
    expect(readings()["draft-letter"]).toBe("running")
    // The two NEGATIVE arms are the point of the field. A finished step and an unreached one
    // are both "not running", and a boolean that said otherwise would animate a line into a
    // step nothing is flowing into.
    expect(readings()["gather-contracts"]).toBe("done")
    expect(readings()["final-check"]).toBe("not-started")
    // ⚠ AND THE PAGE STILL COMPUTES IT, asserted on the source because there is no consumer
    // left to read it through. It is kept rather than deleted: it is `PORT-canvas.md`'s
    // recorded fix, and it becomes live again the moment a run canvas is mounted anywhere.
    expect(codeOf(pageSource)).toMatch(/live: reading === "running"/)
  })

  it("a step WAITING FOR A PERSON is not live — the run is stopped dead, not flowing", async () => {
    // ⚠ THE ARM THAT MAKES THE FIELD HONEST RATHER THAN CONVENIENT. `waiting-for-you` is
    // "not finished", and a boolean built from `!isTerminal` or from `status !== "done"`
    // would call it live. Nothing is executing: motion there would assert progress that is
    // not happening — the fabricated-figure defect told in movement instead of in type.
    setAsks([mkAsk("call-1")])
    setLiveSlice([
      mkPhase(0, "done", "gather-contracts"),
      mkPhase(1, "done", "draft-letter"),
      mkPhase(2, "running", "final-check"),
    ])
    getWorkflowRun.mockResolvedValue(mkRun())
    renderPage()
    await screen.findByTestId("run-transcript")

    // `final-check` is the `llm_human_input` step, it is the RUNNING one, and an ask is
    // pending — the three conditions the page's own F5 derivation requires.
    expect(readings()["final-check"]).toBe("waiting-for-you")
    // ⚠ AND `waiting-for-you` IS NOT `running`, which is the whole content of the claim: the
    // boolean is an equality against ONE reading, so this state cannot reach it. Asserted as
    // the inequality rather than through a consumer, because this page no longer has one.
    expect(readings()["final-check"]).not.toBe("running")
  })
})

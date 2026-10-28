/**
 * Phase 299-04 (D-20 / D-33 / D-34 / UI-SPEC S4) — the link control on its item surfaces.
 *
 * Each surface is mounted for real (only the network and the streams hooks are faked) and the
 * claims are made over the RENDERED words: the trigger's name, the who-can-open line, and the
 * address that Copy link writes. The chat header and the Builder header are covered in their own
 * harnesses (`ChatArea.threadWorkflowPicker.test.tsx`, `WorkflowBuilderPage.session.test.tsx`),
 * because those need the real streams provider / the whole page factory, which this file fakes.
 *
 *   · the workflow card ⋯ menu — the FIRST item, WR-03 green, starter = anyone, otherwise owner-only
 *   · the run page — an unfinished run's header (after the version chip, before Stop): owner-only;
 *     a FINISHED run's page is the evidence report (289-04), whose actions row carries the link and
 *     says "members of {Org}" (D-34)
 *   · the Expert detail — the header, before the close control; the line follows the bundle's rule
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createRef } from "react"
import type { PhaseSpecJSON } from "@/components/workflows/phaseVocabulary"

const clip = vi.hoisted(() => ({
  copyText: vi.fn(),
  selectAllIn: vi.fn(),
  copyShortcutWord: vi.fn(() => "Press Ctrl+C to copy"),
}))
vi.mock("@/lib/clipboard", () => clip)

const org = vi.hoisted(() => ({
  value: null as null | { activeOrgId: string | null; orgs: { org_id: string; name: string; role: string }[] },
}))
vi.mock("@/providers/OrgProvider", () => ({ useOrgOptional: () => org.value, useOrg: () => org.value }))

const net = vi.hoisted(() => ({
  getWorkflowRun: vi.fn(),
  getRunEvidence: vi.fn(),
  downloadWorkspaceFile: vi.fn(() => Promise.resolve()),
}))
vi.mock("@/lib/api", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api")>()
  return {
    ...actual,
    getWorkflowRun: (...a: unknown[]) => net.getWorkflowRun(...a),
    downloadWorkspaceFile: (...a: unknown[]) => net.downloadWorkspaceFile(...(a as [])),
    deleteWorkflowDraft: vi.fn(),
  }
})
vi.mock("@/lib/api/runEvidence", () => ({ getRunEvidence: (...a: unknown[]) => net.getRunEvidence(...a) }))
vi.mock("@/lib/api/documents", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api/documents")>()
  return { ...actual, downloadWorkspaceFile: (...a: unknown[]) => net.downloadWorkspaceFile(...(a as [])) }
})
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "user-1" }, access_token: "t" } } }) },
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}))

const streams = vi.hoisted(() => ({
  usePhases: vi.fn(),
  useWorkspaceFiles: vi.fn(),
  useAskUserPrompt: vi.fn(),
}))
vi.mock("@/providers/StreamsProvider", () => ({
  usePhases: (...a: unknown[]) => streams.usePhases(...a),
  useWorkspaceFiles: (...a: unknown[]) => streams.useWorkspaceFiles(...a),
  useAskUserPrompt: (...a: unknown[]) => streams.useAskUserPrompt(...a),
  useStreamActions: () => ({ reconcile: vi.fn(() => Promise.resolve()), setViewingThread: vi.fn(), stopThread: vi.fn(() => Promise.resolve()) }),
  useStoppingForThread: () => false,
  useStopNotConfirmedForThread: () => false,
}))
const useGroundingBundle = vi.hoisted(() => vi.fn())
vi.mock("@/hooks/useGroundingBundle", () => ({ useGroundingBundle: (...a: unknown[]) => useGroundingBundle(...a) }))
vi.mock("@/components/workflows/WorkflowCanvas", () => ({
  WorkflowCanvas: ({ phases }: { phases: PhaseSpecJSON[] }) => <div data-testid="canvas-stub">{phases.length}</div>,
}))
vi.mock("@/components/panel/PendingAskCard", () => ({ PendingAskCard: () => null }))

import { WorkflowCardMenu } from "@/components/workflows/library/WorkflowCardMenu"
import type { LibraryRow, Provenance } from "@/components/workflows/library/libraryRow"
import { ExpertDetailModal } from "@/components/experts/catalog/ExpertDetailModal"
import { WorkflowRunPage } from "@/pages/WorkflowRunPage"
import { TechnicalNamesProvider } from "@/providers/TechnicalNamesProvider"
import { ownerPayload, RUN_ID } from "@/components/workflows/evidenceFixtures.testutil"
import type { ExpertBundle } from "@/types"

const ONLY_YOU = "Opens only for you, on any device you're signed in on."
const PERMITTED = ["menuitem", "menuitemradio", "menuitemcheckbox", "group", "separator"]

beforeEach(() => {
  vi.clearAllMocks()
  clip.copyText.mockResolvedValue("copied")
  clip.copyShortcutWord.mockReturnValue("Press Ctrl+C to copy")
  org.value = {
    activeOrgId: "A",
    orgs: [
      { org_id: "A", name: "Personal", role: "owner" },
      { org_id: "B", name: "Northwind", role: "member" },
    ],
  }
  streams.usePhases.mockReturnValue({ data: [], isLoading: false, error: null, reconcile: vi.fn() })
  streams.useWorkspaceFiles.mockReturnValue({ data: [], isLoading: false, error: null, reconcile: vi.fn() })
  streams.useAskUserPrompt.mockReturnValue({ data: [], isLoading: false, error: null, reconcile: vi.fn() })
  useGroundingBundle.mockReturnValue({ kind: "ready", degraded: [], kbTools: [], tools: [], folders: [], skills: [] })
})
afterEach(() => cleanup())

/** Open a header trigger, read the surface, press Copy link; returns the surface + copied text. */
async function openAndCopy(name: string) {
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name }))
  const menus = await screen.findAllByRole("menu")
  const menu = menus[menus.length - 1]
  await act(async () => {
    fireEvent.click(within(menu).getByRole("menuitem", { name: /Copy link/ }))
  })
  return { menu, copied: clip.copyText.mock.calls.at(-1)?.[0] as string }
}

// ── the workflow card ⋯ menu ─────────────────────────────────────────────────────────────

function row(provenance: Provenance, id = "DEF-1"): LibraryRow {
  return {
    id,
    slug: "vendor-brief",
    name: "Vendor brief",
    version: 2,
    def: undefined,
    provenance,
    isMine: true,
    updatedAt: undefined,
    lastRunAt: undefined,
    source: {} as never,
  } as unknown as LibraryRow
}

function renderCardMenu(provenance: Provenance) {
  render(
    <WorkflowCardMenu
      row={row(provenance)}
      runnable={provenance !== "draft"}
      owned={provenance !== "starter"}
      hasExistingFork={false}
      onRunLog={vi.fn()}
      onForkNewVersion={vi.fn()}
      onForkStarter={vi.fn()}
      deleteSheetRef={createRef()}
      setArmed={vi.fn()}
      setDeleteFailed={vi.fn()}
    />,
  )
}

async function openCardMenu() {
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: "Workflow actions" }))
  return { user, menu: await screen.findByRole("menu") }
}

describe("299-04 — the workflow card ⋯ menu", () => {
  it("the FIRST item is 'Link to this workflow', and WR-03 stays green", async () => {
    renderCardMenu("published")
    const { menu } = await openCardMenu()
    const items = within(menu).getAllByRole("menuitem")
    expect(items[0]).toHaveTextContent("Link to this workflow")
    const offending = Array.from(menu.children)
      .filter((el) => !PERMITTED.includes(el.getAttribute("role") ?? ""))
      .map((el) => el.tagName.toLowerCase())
    expect(offending).toEqual([])
  })

  it.each([
    ["starter", "Opens for anyone signed in to Syrel."],
    ["published", ONLY_YOU],
    ["draft", ONLY_YOU],
  ] as const)("a %s card's line reads %j and copies origin + /app/workflows/<id>", async (provenance, line) => {
    renderCardMenu(provenance)
    const { user, menu } = await openCardMenu()
    await user.click(within(menu).getByRole("menuitem", { name: /Link to this workflow/ }))
    const menus = await screen.findAllByRole("menu")
    const sub = menus[menus.length - 1]
    expect(sub).toHaveTextContent(line)
    await act(async () => {
      fireEvent.click(within(sub).getByRole("menuitem", { name: /Copy link/ }))
    })
    expect(clip.copyText).toHaveBeenCalledWith(`${window.location.origin}/app/workflows/def-1`)
  })
})

// ── the run page ─────────────────────────────────────────────────────────────────────────

const SPECS: PhaseSpecJSON[] = [
  { slug: "gather", phase_index: 0, name: "Find the contracts", config: { phase_type: "llm_agent" } },
]

function mkRun(over: Record<string, unknown> = {}) {
  return {
    id: "run-1",
    thread_id: "thread-1",
    definition_id: "def-1",
    workflow_name: "Supplier contract renewals",
    workflow_slug: "supplier-contract-renewals",
    workflow_version: 4,
    status: "active",
    created_at: "2026-08-05T14:03:00Z",
    claimed_at: "2026-08-05T14:03:11Z",
    updated_at: "2026-08-05T14:09:52Z",
    definition: { phases: SPECS },
    phases: [{ slug: "gather", phase_index: 0, status: "active", phase_type: "llm_agent" }],
    org_id: "B",
    ...over,
  }
}

function renderRunPage(runId: string) {
  render(
    <TechnicalNamesProvider>
      <WorkflowRunPage runId={runId} onBack={vi.fn()} onOpenThread={vi.fn()} />
    </TechnicalNamesProvider>,
  )
}

describe("299-04 — the run page", () => {
  it("an unfinished run: the trigger sits after the version chip and before Stop, and says owner-only", async () => {
    net.getWorkflowRun.mockResolvedValue(mkRun())
    renderRunPage("run-1")
    const trigger = await screen.findByRole("button", { name: "Link to this workflow run" })
    const chip = screen.getByText("v4")
    const stop = screen.getByRole("button", { name: /stop/i })
    expect(chip.compareDocumentPosition(trigger) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(trigger.compareDocumentPosition(stop) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const { menu, copied } = await openAndCopy("Link to this workflow run")
    expect(menu).toHaveTextContent(ONLY_YOU)
    expect(menu).not.toHaveTextContent("members of")
    expect(copied).toBe(`${window.location.origin}/app/runs/run-1`)
  })

  it("a finished run's page (the evidence report) carries the link, and it opens for the run's org", async () => {
    net.getWorkflowRun.mockResolvedValue(mkRun({ id: RUN_ID, status: "completed" }))
    net.getRunEvidence.mockResolvedValue(ownerPayload())
    renderRunPage(RUN_ID)
    await screen.findByTestId("run-evidence-report")
    const triggers = screen.getAllByRole("button", { name: "Link to this workflow run" })
    expect(triggers).toHaveLength(1)
    const { menu, copied } = await openAndCopy("Link to this workflow run")
    expect(menu).toHaveTextContent("Opens for members of Northwind Procurement.")
    expect(copied).toBe(`${window.location.origin}/app/runs/${RUN_ID}`)
  })

  it("a finished run with no org on the record stays owner-only", async () => {
    const payload = ownerPayload()
    payload.run.org_name = null
    net.getWorkflowRun.mockResolvedValue(mkRun({ id: RUN_ID, status: "completed", org_id: null }))
    net.getRunEvidence.mockResolvedValue(payload)
    renderRunPage(RUN_ID)
    await screen.findByTestId("run-evidence-report")
    const { menu } = await openAndCopy("Link to this workflow run")
    expect(menu).toHaveTextContent(ONLY_YOU)
  })
})

// ── the Expert detail ────────────────────────────────────────────────────────────────────

function bundle(over: Partial<ExpertBundle> = {}): ExpertBundle {
  return {
    id: "EXP-1",
    name: "Filing Reconciler",
    slug: "filing-reconciler",
    description: "Reads filings",
    scope_mode: "biased",
    member_skills: [],
    required_connections: [],
    knowledge_folder_ids: [],
    prompt_suggestions: [],
    visibility: "org",
    is_system: false,
    is_enabled: true,
    org_id: "B",
    ...over,
  }
}

function renderExpert(expert: ExpertBundle) {
  render(<ExpertDetailModal expert={expert} folders={[]} open onOpenChange={vi.fn()} onStartChat={vi.fn()} />)
}

describe("299-04 — the Expert detail", () => {
  it("the trigger is in the header, before the dialog's close control", async () => {
    renderExpert(bundle())
    const trigger = await screen.findByRole("button", { name: "Link to this Expert" })
    // the dialog's own ✕ (the last close-named button; the footer may carry a "Close" too)
    const close = screen.getAllByRole("button", { name: /^close$/i }).at(-1)!
    expect(trigger.compareDocumentPosition(close) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(trigger.closest("[class*='pr-8']")).not.toBeNull()
  })

  it.each([
    [{ visibility: "org" }, "Opens for members of Northwind."],
    [{ visibility: "public" }, "Opens for members of Northwind."],
    [{ visibility: "granted" }, "Opens for the people it's shared with in Northwind."],
    [{ visibility: "private" }, ONLY_YOU],
    [{ is_enabled: false }, "It's turned off, so it opens only for people who manage Experts in Northwind."],
    [{ is_system: true, org_id: null }, "Opens for anyone signed in to Syrel."],
  ] as const)("%j reads %j and copies origin + /app/experts/<id>", async (over, line) => {
    renderExpert(bundle(over as Partial<ExpertBundle>))
    const { menu, copied } = await openAndCopy("Link to this Expert")
    expect(menu).toHaveTextContent(line)
    expect(copied).toBe(`${window.location.origin}/app/experts/exp-1`)
  })
})

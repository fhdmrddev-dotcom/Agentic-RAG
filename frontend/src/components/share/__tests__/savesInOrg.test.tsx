/**
 * Phase 299-04 (D-18 / D-38 / UI-D11 / UI-SPEC S8) — "Saves in <org>" on the buttons that create,
 * the fork naming its source, and the server's org-named refusals shown verbatim.
 *
 *   · the caption shows on Run (RunModal), Tweak (the card ⋯ menu's consequence line) and Start a
 *     chat (the Expert detail) — and ONLY for a person in 2+ orgs; never on Copy link
 *   · the Tweak fork sends `from_definition_id`, so the server's refusal (299-01) can fire; without
 *     the option the create URL is byte-identical to today
 *   · the three refusal sentences reach their homes word for word, never "409" / "conflict" /
 *     "forbidden" / "invalid"
 *
 * Asserted by the RENDERED WORDS; only the network is faked.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, cleanup, fireEvent, render, renderHook, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createRef } from "react"

const org = vi.hoisted(() => ({
  value: null as null | { activeOrgId: string | null; orgs: { org_id: string; name: string; role: string }[] },
}))
vi.mock("@/providers/OrgProvider", () => ({ useOrgOptional: () => org.value, useOrg: () => org.value }))

const fork = vi.hoisted(() => ({ createWorkflowDraft: vi.fn() }))
vi.mock("@/lib/api", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api")>()
  return { ...actual, createWorkflowDraft: (...a: unknown[]) => fork.createWorkflowDraft(...a), deleteWorkflowDraft: vi.fn() }
})
vi.mock("@/lib/api/_core", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api/_core")>()
  return { ...actual, API_BASE: "http://api.test", getAuthHeaders: async () => ({ "Content-Type": "application/json" }) }
})

import { SavesInOrg } from "@/components/org/SavesInOrg"
import { savesIn } from "@/components/org/orgItemsCopy"
import { RunModal } from "@/components/workflows/library/RunModal"
import { WorkflowCardMenu } from "@/components/workflows/library/WorkflowCardMenu"
import type { LibraryRow, Provenance } from "@/components/workflows/library/libraryRow"
import { useWorkflowFork } from "@/components/workflows/library/useWorkflowFork"
import { ExpertDetailModal } from "@/components/experts/catalog/ExpertDetailModal"
import { ShareLinkMenu } from "@/components/share/ShareLinkMenu"
import { createWorkflowDraft as realCreateWorkflowDraft, WorkflowOrgRefusedError } from "@/lib/api/workflows"
import { postMessage } from "@/lib/api/threads"
import type { PublishedWorkflow } from "@/lib/api"
import type { ExpertBundle } from "@/types"
// @ts-ignore — Vite `?raw` import, typed by vite/client at build time only.
import guardPy from "../../../../../backend/app/services/item_org_guard.py?raw"

const PERSONAL = { org_id: "A", name: "Personal", role: "owner" }
const ACME = { org_id: "B", name: "Acme Legal", role: "member" }
const BANNED = /409|conflict|forbidden|invalid/i

const RUN_REFUSAL = "This workflow is in Acme Legal. Switch to Acme Legal and start it from a new chat there."
const TWEAK_REFUSAL = "This workflow is in Acme Legal. Switch to Acme Legal to make your own copy."
const SEND_REFUSAL = "This chat is in Acme Legal. Switch to Acme Legal to keep chatting."

function twoOrgs() {
  org.value = { activeOrgId: "B", orgs: [PERSONAL, ACME] }
}

const fetchMock = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  twoOrgs()
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// ── the caption itself ───────────────────────────────────────────────────────────────────

describe("299-04 — SavesInOrg", () => {
  it("2+ orgs: 'Saves in {active org}', the name in the foreground", () => {
    render(<SavesInOrg />)
    const line = screen.getByText((_, el) => el?.tagName === "P" && el.textContent === "Saves in Acme Legal")
    expect(within(line).getByText("Acme Legal").className).toContain("text-foreground")
    expect(line.className).toContain("text-xs")
    expect(line.className).toContain("text-muted-foreground")
    expect(savesIn("Acme Legal")).toBe("Saves in Acme Legal")
  })

  it("the sentence form reads ' Saves in {Org}.'", () => {
    const { container } = render(<p>{"Makes a private copy."}<SavesInOrg asSentence /></p>)
    expect(container.textContent).toBe("Makes a private copy. Saves in Acme Legal.")
  })

  it("one org, no org context, or an active org that names no membership: nothing", () => {
    org.value = { activeOrgId: "A", orgs: [PERSONAL] }
    const one = render(<SavesInOrg />)
    expect(one.container.textContent).toBe("")
    one.unmount()
    org.value = null
    const none = render(<SavesInOrg />)
    expect(none.container.textContent).toBe("")
    none.unmount()
    org.value = { activeOrgId: "Z", orgs: [PERSONAL, ACME] }
    const unknown = render(<SavesInOrg />)
    expect(unknown.container.textContent).toBe("")
  })
})

// ── Run (RunModal) ───────────────────────────────────────────────────────────────────────

const WF = { id: "P1", slug: "vendor-brief", name: "Vendor brief", definition: { phases: [] } } as unknown as PublishedWorkflow

function renderRunModal(onRun = vi.fn()) {
  render(
    <RunModal
      wf={WF}
      folders={[]}
      authorDefaultFolderId={null}
      kickoff=""
      submitting={false}
      onKickoffChange={vi.fn()}
      onCancel={vi.fn()}
      onRun={onRun}
    />,
  )
}

describe("299-04 — Run", () => {
  it("2 orgs: 'Saves in Acme Legal' under the Run button row", () => {
    renderRunModal()
    const run = screen.getByTestId("run-confirm")
    const caption = screen.getByText((_, el) => el?.tagName === "P" && el.textContent === "Saves in Acme Legal")
    expect(run.compareDocumentPosition(caption) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(caption.className).toContain("text-right")
  })

  it("1 org: no caption", () => {
    org.value = { activeOrgId: "A", orgs: [PERSONAL] }
    renderRunModal()
    expect(document.body.textContent).not.toContain("Saves in")
  })

  it("a launch refused with the org sentence shows it verbatim in the error text", async () => {
    renderRunModal(vi.fn().mockRejectedValue(new Error(RUN_REFUSAL)))
    await act(async () => {
      fireEvent.click(screen.getByTestId("run-confirm"))
    })
    const err = await screen.findByTestId("run-upload-error")
    expect(err.textContent).toBe(RUN_REFUSAL)
    expect(err.textContent).not.toMatch(BANNED)
  })
})

// ── Tweak (the card ⋯ menu) ──────────────────────────────────────────────────────────────

function row(provenance: Provenance): LibraryRow {
  return {
    id: "P1", slug: "vendor-brief", name: "Vendor brief", version: 2, def: undefined, provenance,
    isMine: true, updatedAt: undefined, lastRunAt: undefined, source: WF,
  } as unknown as LibraryRow
}

async function openMenu(provenance: Provenance, hasExistingFork = false) {
  render(
    <WorkflowCardMenu
      row={row(provenance)}
      runnable
      owned
      hasExistingFork={hasExistingFork}
      onForkNewVersion={vi.fn()}
      onForkStarter={vi.fn()}
      deleteSheetRef={createRef()}
      setArmed={vi.fn()}
      setDeleteFailed={vi.fn()}
    />,
  )
  await userEvent.setup().click(screen.getByRole("button", { name: "Workflow actions" }))
  return screen.findByRole("menu")
}

describe("299-04 — Tweak", () => {
  it("2 orgs: the Tweak item's consequence line gains ' Saves in Acme Legal.'", async () => {
    const menu = await openMenu("published")
    const note = within(menu).getByTestId("fork-consequence")
    expect(note.textContent).toMatch(/ Saves in Acme Legal\.$/)
    expect(within(menu).getByTestId("published-tweak")).toHaveAttribute("aria-describedby", note.id)
  })

  it("1 org: the line is unchanged", async () => {
    org.value = { activeOrgId: "A", orgs: [PERSONAL] }
    const menu = await openMenu("published")
    expect(within(menu).getByTestId("fork-consequence").textContent).not.toContain("Saves in")
  })

  it("an existing fork creates nothing, so it says nothing about saving", async () => {
    const menu = await openMenu("published", true)
    expect(within(menu).getByTestId("fork-consequence").textContent).not.toContain("Saves in")
  })

  it("Copy link (the link sub) never carries the caption", async () => {
    const menu = await openMenu("published")
    const sub = within(menu).getByRole("menuitem", { name: /Link to this workflow/ })
    expect(sub.textContent).not.toContain("Saves in")
  })

  it("the header link surface never carries the caption", async () => {
    render(<ShareLinkMenu route={{ view: "chat", threadId: "t1" }} kind="thread" audience="only_you" orgId={null} />)
    await userEvent.setup().click(screen.getByRole("button", { name: "Link to this chat" }))
    const menus = await screen.findAllByRole("menu")
    expect(menus[menus.length - 1].textContent).not.toContain("Saves in")
  })
})

// ── the fork names its source ────────────────────────────────────────────────────────────

describe("299-04 — the Tweak fork sends its source", () => {
  function forkHook() {
    const onForked = vi.fn()
    const r = renderHook(() =>
      useWorkflowFork({ drafts: [], rows: [row("published")], refetchDrafts: vi.fn(), onOpenDraft: vi.fn(), onForked }),
    )
    return { r, onForked }
  }

  it("Tweak calls createWorkflowDraft(forked, undefined, { fromDefinitionId: <published id> })", async () => {
    fork.createWorkflowDraft.mockResolvedValue({ id: "D9", version: 3, token: "t" })
    const { r, onForked } = forkHook()
    act(() => r.result.current.onForkNewVersion(row("published")))
    await act(async () => r.result.current.confirmFork("My copy"))
    expect(fork.createWorkflowDraft).toHaveBeenCalledTimes(1)
    expect(fork.createWorkflowDraft.mock.calls[0][2]).toEqual({ fromDefinitionId: "P1" })
    expect(onForked).toHaveBeenCalledTimes(1)
  })

  it("a starter fork (system-global) sends no source", async () => {
    fork.createWorkflowDraft.mockResolvedValue({ id: "D9", version: 1, token: "t" })
    const { r } = forkHook()
    act(() => r.result.current.onForkStarter(row("starter")))
    await act(async () => r.result.current.confirmFork("From starter"))
    expect(fork.createWorkflowDraft.mock.calls[0][2]).toBeUndefined()
  })

  it("the org refusal lands in the fork's failure notice verbatim", async () => {
    fork.createWorkflowDraft.mockRejectedValue(new WorkflowOrgRefusedError(TWEAK_REFUSAL))
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const { r } = forkHook()
    act(() => r.result.current.onForkNewVersion(row("published")))
    await act(async () => r.result.current.confirmFork("My copy"))
    expect(r.result.current.forkFailed?.sentence).toBe(TWEAK_REFUSAL)
    expect(r.result.current.forkFailed?.sentence).not.toMatch(BANNED)
    spy.mockRestore()
  })

  it("any other failure keeps the shape that holds no server prose", async () => {
    fork.createWorkflowDraft.mockRejectedValue(new Error("Failed to create workflow draft (status 409)"))
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const { r } = forkHook()
    act(() => r.result.current.onForkNewVersion(row("published")))
    await act(async () => r.result.current.confirmFork("My copy"))
    expect(r.result.current.forkFailed).toEqual({ name: "Vendor brief", conflict: true })
    spy.mockRestore()
  })
})

describe("299-04 — createWorkflowDraft", () => {
  const DEF = { slug: "x", version: 2, phases: [] } as never

  function answer(status: number, body: unknown) {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }))
  }

  it("with fromDefinitionId: POST /workflows?from_definition_id=<id>; without: byte-identical to today", async () => {
    answer(200, { id: "D1", version: 2, token: "t" })
    await realCreateWorkflowDraft(DEF, undefined, { fromDefinitionId: "P 1" })
    expect(fetchMock.mock.calls[0][0]).toBe("http://api.test/workflows?from_definition_id=P%201")
    answer(200, { id: "D1", version: 2, token: "t" })
    await realCreateWorkflowDraft(DEF)
    expect(fetchMock.mock.calls[1][0]).toBe("http://api.test/workflows")
  })

  it.each(["tweak"] as const)("every backend %s refusal (named and unnamed) is thrown as the server's sentence", async (kind) => {
    const sentences = backendSentences(guardPy as string, kind)
    expect(sentences).toHaveLength(2)
    for (const s of sentences) {
      answer(409, { detail: s })
      const err = await realCreateWorkflowDraft(DEF, undefined, { fromDefinitionId: "P1" }).catch((e) => e)
      expect(err).toBeInstanceOf(WorkflowOrgRefusedError)
      expect(err.message).toBe(s)
      expect(err.message).not.toMatch(BANNED)
    }
  })

  it("the slug/version 409 is NOT an org refusal (it stays today's error)", async () => {
    answer(409, { detail: "a workflow with this slug and version already exists" })
    const err = await realCreateWorkflowDraft(DEF, undefined, { fromDefinitionId: "P1" }).catch((e) => e)
    expect(err).not.toBeInstanceOf(WorkflowOrgRefusedError)
    expect(String(err)).toContain("409")
  })
})

/** The backend's REFUSALS / REFUSALS_UNNAMED entry for `kind`, the named one formatted with Acme Legal. */
function backendSentences(src: string, kind: string): string[] {
  const out: string[] = []
  for (const block of ["REFUSALS = {", "REFUSALS_UNNAMED = {"]) {
    const start = src.indexOf(block)
    if (start < 0) throw new Error(`could not find ${block} in item_org_guard.py — update THIS parser`)
    // the block ends at a line that is just "}" — the sentences themselves contain "{org}"
    const body = src.slice(start, src.indexOf("\n}", start))
    const m = body.match(new RegExp(`"${kind}":\\s*"([^"]+)"`))
    if (!m) throw new Error(`no ${kind} entry in ${block}`)
    out.push(m[1].replace(/\{org\}/g, "Acme Legal"))
  }
  return out
}

// ── Start a chat (the Expert detail) ─────────────────────────────────────────────────────

function bundle(): ExpertBundle {
  return {
    id: "E1", name: "Filing Reconciler", slug: "filing-reconciler", description: "Reads filings",
    scope_mode: "biased", member_skills: [], required_connections: [], knowledge_folder_ids: [],
    prompt_suggestions: [], visibility: "org", is_system: false, is_enabled: true, org_id: "B",
  }
}

describe("299-04 — Start a chat", () => {
  it("2 orgs: 'Saves in Acme Legal' beside the start button", () => {
    render(<ExpertDetailModal expert={bundle()} folders={[]} open onOpenChange={vi.fn()} onStartChat={vi.fn()} />)
    const start = screen.getByRole("button", { name: /Start Scoped Chat/ })
    const caption = screen.getByText((_, el) => el?.tagName === "P" && el.textContent === "Saves in Acme Legal")
    expect(caption.parentElement).toBe(start.parentElement)
  })

  it("1 org: no caption", () => {
    org.value = { activeOrgId: "A", orgs: [PERSONAL] }
    render(<ExpertDetailModal expert={bundle()} folders={[]} open onOpenChange={vi.fn()} onStartChat={vi.fn()} />)
    expect(document.body.textContent).not.toContain("Saves in")
  })
})

// ── Send (postMessage's string-detail path) ──────────────────────────────────────────────

describe("299-04 — a refused send", () => {
  it("postMessage throws the server's chat sentence verbatim (the composer's failure line shows it)", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ detail: SEND_REFUSAL }), { status: 409, headers: { "Content-Type": "application/json" } }))
    const err = await postMessage("T1", "hello").catch((e) => e)
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toBe(SEND_REFUSAL)
    expect(err.message).not.toMatch(BANNED)
  })
})

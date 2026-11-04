/**
 * Phase 308-06 (HOOK-04 · D-19, D-48, D-56; UI-SPEC Surface 3) — "Waiting on you" gains a row for an
 * endpoint Syrel turned off: the widened notice type with its one consumer, the words, the row, and
 * the door that opens Settings → Webhooks on that endpoint.
 *
 * Prices: a run notice that maps differently than before (the 301 row must be byte-equal); a webhook
 * row that throws, prints "undefined" or opens a run on a null run id; "workflow runs are waiting"
 * when a webhook row is in the list; a door that switches the active org or forgets the focus hint.
 * Words-first: the assertions read what the person reads.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, renderHook, screen, cleanup, within, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createMemoryRouter } from "react-router"
import { RouterProvider } from "react-router/dom"
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

const h = vi.hoisted(() => ({
  notices: [] as unknown[],
  total: 0,
  captured: { ctx: null as null | Record<string, unknown> },
  switchOrg: vi.fn(),
}))

vi.mock("@/hooks/useWaitingNotices", () => ({
  useWaitingNotices: () => ({ notices: h.notices, total: h.total, loading: false, verdictKnown: true, failedSinceLast: false }),
}))
vi.mock("@/lib/api/sources", () => ({
  getSourceHealth: vi.fn().mockResolvedValue({ stopped: [], reader_running: true, poll_interval_seconds: 60 }),
  listSyncRuns: vi.fn().mockResolvedValue([]),
}))
vi.mock("@/lib/api/notifications", () => ({
  getWaitingNotices: vi.fn().mockResolvedValue({ notices: [], total: 0 }),
}))
// The door case captures the ONE context object ChatLayout hands its producers.
vi.mock("../attentionConditions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../attentionConditions")>()
  return {
    ...actual,
    ATTENTION_PRODUCERS: Object.freeze([
      {
        key: "capture",
        use: (ctx: Record<string, unknown>) => {
          h.captured.ctx = ctx
          return []
        },
      },
    ]),
  }
})
vi.mock("@/providers/OrgProvider", () => {
  const value = {
    activeOrgId: "org-a",
    orgs: [
      { org_id: "org-a", name: "Acme Legal" },
      { org_id: "org-b", name: "Beta Partners" },
    ],
    switchOrg: h.switchOrg,
    canManage: false,
  }
  return { useOrg: () => value, useOrgOptional: () => value }
})
vi.mock("@/lib/api/_core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/_core")>()
  return { ...actual, getAuthHeaders: vi.fn().mockResolvedValue({ Authorization: "Bearer tok-308" }) }
})
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "tok-308" } } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })),
    removeChannel: vi.fn(),
  },
}))
vi.mock("@/hooks/useFolders", () => ({ useFolders: () => ({ folders: [] }) }))
vi.mock("@/hooks/useTheme", () => ({ useTheme: () => ({ theme: "dark", toggleTheme: vi.fn() }) }))
vi.mock("../NavPanel", () => ({ NavPanel: () => <nav data-testid="nav-stub" /> }))
vi.mock("../ChatHistoryColumn", () => ({ ChatHistoryColumn: () => <div data-testid="history-stub" /> }))
vi.mock("../ThreadCommandPalette", () => ({ ThreadCommandPalette: () => <div data-testid="palette-stub" /> }))
vi.mock("@/components/panel/WorkspacePanel", () => ({ WorkspacePanel: () => <aside data-testid="workspace-panel-stub" /> }))
vi.mock("@/components/chat/ChatArea", () => ({ ChatArea: () => <div data-testid="chat-area-stub" /> }))

import { useWaitingRunConditions, type AttentionContext, type WaitingCondition } from "../attentionConditions"
import { countSentence, kindWords, offPhrase, reasonWords } from "../waitingVocabulary"
import vocabularySrc from "../waitingVocabulary.ts?raw"
import { WaitingOnYouList } from "../WaitingOnYouList"
import { ChatLayout } from "../ChatLayout"
import { EffectiveFeaturesProvider } from "@/providers/EffectiveFeaturesProvider"
import { useAppNavigation } from "@/hooks/useAppNavigation"
import { WEBHOOK_FOCUS_KEY } from "@/components/settings/webhooks/webhookFocus"
import { SETTINGS_TAB_STORAGE_KEY } from "@/components/settings/settingsTabs"

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

const RUN_NOTICE = {
  id: "n-run",
  run_id: "run-1111",
  org_id: "org-a",
  org_name: "Acme Legal",
  workflow_name: "Compliance Gap Report",
  kind: "question" as const,
  origin: "schedule" as const,
  created_at: "2026-11-04T10:00:00Z",
}

const HOOK_NOTICE = {
  id: "n-hook",
  run_id: null,
  org_id: "org-b",
  org_name: "Beta Partners",
  workflow_name: null,
  kind: "webhook_disabled" as const,
  origin: null,
  created_at: "2026-11-04T10:05:00Z",
  endpoint_id: "ep-42",
  reason: "failing" as const,
  title: "hooks.example.com/in/syrel",
  title_is_address: true,
}

beforeEach(() => {
  h.notices = []
  h.total = 0
  h.captured.ctx = null
  h.switchOrg.mockReset()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  sessionStorage.clear()
  localStorage.clear()
})

describe("308-06 the waiting map — a webhook arm beside the unchanged run arm", () => {
  it("a run notice maps exactly as in 301", () => {
    h.notices = [RUN_NOTICE]
    h.total = 1
    const openRun = vi.fn()
    const { result } = renderHook(() => useWaitingRunConditions({ openLibraryHealth: vi.fn(), openRun }))
    const [c] = result.current as WaitingCondition[]
    expect(c).toEqual({
      mark: "waiting",
      id: "n-run",
      title: "Compliance Gap Report",
      detail: "",
      onOpen: expect.any(Function),
      runId: "run-1111",
      orgId: "org-a",
      orgName: "Acme Legal",
      since: "2026-11-04T10:00:00Z",
      kind: "question",
      origin: "schedule",
      total: 1,
    })
    c.onOpen()
    expect(openRun).toHaveBeenCalledWith("run-1111")
  })

  it("a webhook notice maps to a row whose onOpen calls ctx.openWebhooks(endpointId, orgId)", () => {
    h.notices = [HOOK_NOTICE]
    h.total = 1
    const openRun = vi.fn()
    const openWebhooks = vi.fn()
    const ctx: AttentionContext = { openLibraryHealth: vi.fn(), openRun, openWebhooks }
    const { result } = renderHook(() => useWaitingRunConditions(ctx))
    const [c] = result.current as WaitingCondition[]
    expect(c).toMatchObject({
      mark: "waiting",
      id: "n-hook",
      kind: "webhook_disabled",
      runId: null,
      endpointId: "ep-42",
      reason: "failing",
      title: "hooks.example.com/in/syrel",
      titleIsAddress: true,
      origin: null,
      orgId: "org-b",
      orgName: "Beta Partners",
      since: "2026-11-04T10:05:00Z",
      total: 1,
    })
    c.onOpen()
    expect(openWebhooks).toHaveBeenCalledWith("ep-42", "org-b")
    expect(openRun).not.toHaveBeenCalled()
  })

  it("without the door, a webhook row's onOpen is a no-op (never a run open on a null id)", () => {
    h.notices = [HOOK_NOTICE]
    h.total = 1
    const openRun = vi.fn()
    const { result } = renderHook(() => useWaitingRunConditions({ openLibraryHealth: vi.fn(), openRun }))
    expect(() => (result.current[0] as WaitingCondition).onOpen()).not.toThrow()
    expect(openRun).not.toHaveBeenCalled()
  })
})

describe("308-06 waitingVocabulary — the webhook words", () => {
  it("names the kind and the reason", () => {
    expect(kindWords("webhook_disabled")).toBe("webhook turned off")
    expect(reasonWords("failing")).toBe("kept failing")
    expect(reasonWords("gone")).toBe("the receiver said it is gone")
    expect(kindWords("question")).toBe("needs your answer")
  })

  it("says when it was turned off, never a negative or NaN", () => {
    const now = Date.parse("2026-11-04T12:00:00Z")
    const at = (ms: number) => new Date(now - ms).toISOString()
    expect(offPhrase(at(20_000), now)).toBe("turned off under a minute ago")
    expect(offPhrase(at(4 * MIN), now)).toBe("turned off 4 min ago")
    expect(offPhrase(at(3 * HOUR), now)).toBe("turned off 3 hr ago")
    expect(offPhrase(at(DAY + HOUR), now)).toBe("turned off 1 day ago")
    expect(offPhrase(at(5 * DAY), now)).toBe("turned off 5 days ago")
    expect(offPhrase(new Date(now + 10 * MIN).toISOString(), now)).toBe("turned off under a minute ago")
    expect(offPhrase("not a date", now)).toBe("turned off under a minute ago")
  })

  it("the count sentence goes neutral when any row is not a run, and keeps the run words otherwise", () => {
    expect(countSentence(1, { anyNonRun: true })).toBe("1 thing is waiting on you")
    expect(countSentence(3, { anyNonRun: true })).toBe("3 things are waiting on you")
    expect(countSentence(1)).toBe("1 workflow run is waiting on you")
    expect(countSentence(3)).toBe("3 workflow runs are waiting on you")
    expect(countSentence(3, { anyNonRun: false })).toBe("3 workflow runs are waiting on you")
    expect(countSentence(null, { anyNonRun: true })).toBe("Waiting on you")
  })

  it("is still a zero-import leaf", () => {
    expect(vocabularySrc).not.toMatch(/^import /m)
  })
})

function cond(over: Partial<WaitingCondition>): WaitingCondition {
  return {
    mark: "waiting",
    id: "x",
    title: "Compliance Gap Report",
    detail: "",
    onOpen: vi.fn(),
    runId: "run-1111",
    orgId: "org-a",
    orgName: "Acme Legal",
    since: new Date(Date.now() - 10 * MIN).toISOString(),
    kind: "question",
    origin: "app",
    total: 2,
    ...over,
  }
}

describe("308-06 WaitingOnYouList — a run row and a webhook row together", () => {
  it("renders both, the webhook row with its words and a mono address title, and opens on select", async () => {
    const onOpenHook = vi.fn()
    const conditions = [
      cond({ id: "r1" }),
      cond({
        id: "w1",
        kind: "webhook_disabled",
        runId: null,
        endpointId: "ep-42",
        reason: "failing",
        title: "hooks.example.com/in/syrel",
        titleIsAddress: true,
        origin: null,
        orgId: "org-b",
        orgName: "Beta Partners",
        since: new Date(Date.now() - 4 * MIN - 5_000).toISOString(),
        onOpen: onOpenHook,
      }),
    ]
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>open</DropdownMenuTrigger>
        <WaitingOnYouList conditions={conditions} total={2} status="answered" side="right" align="start" sideOffset={8} />
      </DropdownMenu>,
    )
    const rows = await screen.findAllByTestId("waiting-row")
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent("Acme Legal · needs your answer · waiting 10 min")
    const hook = rows[1]
    expect(hook).toHaveTextContent("Beta Partners · webhook turned off · kept failing · turned off 4 min ago")
    const title = within(hook).getByText("hooks.example.com/in/syrel")
    expect(title.className).toMatch(/font-mono/)
    expect(hook.querySelector("svg.lucide-webhook")).not.toBeNull()
    expect(document.body.textContent).not.toMatch(/undefined|null|run-/)
    expect(hook.querySelector("a[href]")).toBeNull()
    await userEvent.click(hook)
    expect(onOpenHook).toHaveBeenCalledTimes(1)
  })
})

function Shell({ onNavigate }: { onNavigate: (v: string) => void }) {
  const nav = useAppNavigation()
  return (
    <EffectiveFeaturesProvider value={{ features: {}, loading: false, refetch: vi.fn() }}>
      <ChatLayout
        onSignOut={vi.fn()}
        activeView={nav.activeView}
        onNavigate={onNavigate as never}
        navItems={[]}
        isOperator={false}
        operatorIdentity={null}
        prefillMessage={null}
        onSetPrefillMessage={vi.fn()}
        studioSkillId={nav.studioSkillId}
        studioTab={nav.studioTab}
        onOpenStudio={nav.handleOpenStudio}
        onReviewEvals={nav.handleReviewEvals}
        onStudioTabChange={nav.handleStudioTabChange}
        onTuneSkill={nav.handleTuneSkill}
        activeRunId={nav.runId}
        openRun={nav.openRun}
      />
    </EffectiveFeaturesProvider>
  )
}

describe("308-06 ChatLayout — the webhooks door", () => {
  it("writes the focus hint, sets Settings → Webhooks, opens Settings, and never switches org", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("[]", { status: 200 }))))
    vi.spyOn(console, "error").mockImplementation(() => {})
    const onNavigate = vi.fn()
    const router = createMemoryRouter([{ path: "*", Component: () => <Shell onNavigate={onNavigate} /> }], {
      initialEntries: ["/app"],
    })
    render(<RouterProvider router={router} />)
    await waitFor(() => expect(h.captured.ctx).not.toBeNull())
    const ctx = h.captured.ctx as unknown as AttentionContext
    expect(typeof ctx.openWebhooks).toBe("function")
    onNavigate.mockClear()
    ctx.openWebhooks?.("ep-42", "org-b")
    expect(JSON.parse(sessionStorage.getItem(WEBHOOK_FOCUS_KEY) ?? "null")).toEqual({ endpointId: "ep-42", orgId: "org-b" })
    expect(localStorage.getItem(SETTINGS_TAB_STORAGE_KEY)).toBe("8")
    expect(onNavigate).toHaveBeenCalledTimes(1)
    expect(onNavigate).toHaveBeenCalledWith("settings")
    expect(h.switchOrg).not.toHaveBeenCalled()
  })

  it("WR-06: with storage blocked the door still opens Settings (no throw before onNavigate)", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("[]", { status: 200 }))))
    vi.spyOn(console, "error").mockImplementation(() => {})
    const onNavigate = vi.fn()
    const router = createMemoryRouter([{ path: "*", Component: () => <Shell onNavigate={onNavigate} /> }], {
      initialEntries: ["/app"],
    })
    render(<RouterProvider router={router} />)
    await waitFor(() => expect(h.captured.ctx).not.toBeNull())
    const ctx = h.captured.ctx as unknown as AttentionContext
    onNavigate.mockClear()
    const blocked = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    try {
      expect(() => ctx.openWebhooks?.("ep-42", "org-b")).not.toThrow()
    } finally {
      blocked.mockRestore()
    }
    expect(onNavigate).toHaveBeenCalledWith("settings")
  })
})

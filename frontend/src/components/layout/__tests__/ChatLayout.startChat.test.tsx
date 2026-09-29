/**
 * Phase 267-03 (SEED-309 R265-262-03 · D-267-24) — ChatLayout's REAL Start Chat wiring.
 *
 * ⛔ WHY THIS SUITE EXISTS. `startScopedChat.test.ts` proves the ORDER of the start with injected
 * fakes, and nothing proved that ChatLayout hands it the right seams. The 265 review planted
 * `refreshThreads: async () => {}` and deleted `discardThread`, and 14 files / 144 tests stayed
 * green. So this suite mounts the real ChatLayout, the real `useThreads` hook, the real catalog
 * page and the real `startScopedChat`, and mocks ONLY the network: `fetch` records every request,
 * and the order is read off that record — never off a spy on the seam under test.
 *
 * ⛔ DRIVEN RED by re-applying each of the review's two plants to `ChatLayout.tsx` in turn (quoted
 * in `267-03-SUMMARY.md`), then restoring that ONE path.
 *
 * Only the chrome no case here reads is stubbed (the same leaves `ChatLayout.launch.test.tsx`
 * stubs). The ChatArea stub records the thread it is handed — that record IS "the chat view shows
 * the thread", so selection is observed where the person would see it.
 */
import { useState } from "react"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react"

const { log, navLog } = vi.hoisted(() => ({ log: [] as string[], navLog: [] as string[] }))

// Auth headers only — everything else in the api layer is the real module, down to `fetch`.
vi.mock("@/lib/api/_core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/_core")>()
  return {
    ...actual,
    getAuthHeaders: vi.fn().mockResolvedValue({
      "Content-Type": "application/json",
      Authorization: "Bearer tok-267",
      "X-Org-Id": "org-267",
    }),
  }
})
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "tok-267" } } }),
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
vi.mock("@/components/panel/WorkspacePanel", () => ({
  WorkspacePanel: () => <aside data-testid="workspace-panel-stub" />,
}))
vi.mock("@/components/chat/ChatArea", () => ({
  ChatArea: ({ thread }: { thread: { id: string } | null }) => {
    if (thread && !log.includes(`select:${thread.id}`)) log.push(`select:${thread.id}`)
    return <div data-testid="chat-area-stub">{thread ? `chat:${thread.id}` : "chat:none"}</div>
  },
}))

import { ChatLayout } from "../ChatLayout"
import { EffectiveFeaturesProvider } from "@/providers/EffectiveFeaturesProvider"
import type { ActiveView } from "@/App"

const EXPERT = {
  id: "exp-267",
  name: "Contract Reviewer",
  slug: "contract-reviewer",
  description: "Reads master services agreements",
  scope_mode: "biased",
  member_skills: [],
  required_connections: [],
  knowledge_folder_ids: [],
  prompt_suggestions: [],
  visibility: "org",
  is_system: false,
  is_enabled: true,
}
const CREATED = {
  id: "t-scoped",
  user_id: "u1",
  title: "New Chat",
  folder_id: null,
  active_expert_id: null,
  created_at: "2026-09-25T00:00:00Z",
  updated_at: "2026-09-25T00:00:00Z",
}

let patchStatus = 200

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function fetchStub(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase()
  const path = new URL(String(input), "http://api.test").pathname
  if (/^\/threads(\/|$)/.test(path)) log.push(`${method} ${path}`)

  if (method === "GET" && path === "/experts") return Promise.resolve(json([EXPERT]))
  if (method === "POST" && path === "/threads") return Promise.resolve(json(CREATED, 201))
  if (method === "PATCH" && path === `/threads/${CREATED.id}`) {
    return Promise.resolve(
      patchStatus === 200
        ? json({ ...CREATED, active_expert_id: EXPERT.id })
        : json({ detail: "You do not have access to this Expert." }, patchStatus),
    )
  }
  if (method === "GET" && path === "/threads") {
    return Promise.resolve(json([{ ...CREATED, active_expert_id: EXPERT.id }]))
  }
  if (method === "DELETE" && path === `/threads/${CREATED.id}`) {
    return Promise.resolve(new Response(null, { status: 204 }))
  }
  return Promise.resolve(json([]))
}

function Harness() {
  const [view, setView] = useState<ActiveView>("experts")
  return (
    <EffectiveFeaturesProvider
      value={{ features: { visual_workflow_canvas: true }, loading: false, refetch: vi.fn() }}
    >
      <ChatLayout
        onSignOut={vi.fn()}
        activeView={view}
        onNavigate={(v: ActiveView) => {
          navLog.push(v)
          setView(v)
        }}
        navItems={[]}
        isOperator={false}
        operatorIdentity={null}
        prefillMessage={null}
        onSetPrefillMessage={vi.fn()}
        studioSkillId={null}
        studioTab="evals"
        onOpenStudio={vi.fn()}
        onReviewEvals={vi.fn()}
        onStudioTabChange={vi.fn()}
        onTuneSkill={vi.fn()}
      />
    </EffectiveFeaturesProvider>
  )
}

/** The thread-request record from the click up to (and including) the first selection. */
function untilSelection(): string[] {
  const i = log.findIndex((e) => e.startsWith("select:"))
  return i === -1 ? [...log] : log.slice(0, i + 1)
}

async function clickStartChat() {
  const start = await screen.findByRole("button", { name: /^start chat$/i })
  // Whatever mounting fetched is not this start's business.
  log.length = 0
  navLog.length = 0
  fireEvent.click(start)
}

beforeEach(() => {
  log.length = 0
  navLog.length = 0
  patchStatus = 200
  vi.stubGlobal("fetch", vi.fn(fetchStub))
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("ChatLayout · Start Chat from the catalog, real wiring (267-03 / R265-262-03)", () => {
  it("creates, scopes, REFRESHES the list, and only then selects — and the chat view shows the thread", async () => {
    render(<Harness />)
    await clickStartChat()

    await waitFor(() => expect(screen.getByTestId("chat-area-stub").textContent).toBe("chat:t-scoped"))
    expect(untilSelection()).toEqual([
      "POST /threads",
      "PATCH /threads/t-scoped",
      "GET /threads",
      "select:t-scoped",
    ])
    expect(navLog).toEqual(["chat"])
    expect(log).not.toContain("DELETE /threads/t-scoped")
  })

  it("a refused PATCH discards the created thread and navigates nowhere", async () => {
    patchStatus = 403
    render(<Harness />)
    await clickStartChat()

    await waitFor(() => expect(log).toContain("DELETE /threads/t-scoped"))
    expect(log).toEqual(["POST /threads", "PATCH /threads/t-scoped", "DELETE /threads/t-scoped"])
    expect(navLog).toEqual([])
    // The person stays on the catalog, told what happened beside the control they pressed.
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /couldn.t start a chat with Contract Reviewer/i,
    )
    expect(screen.queryByTestId("chat-area-stub")).toBeNull()
  })
})

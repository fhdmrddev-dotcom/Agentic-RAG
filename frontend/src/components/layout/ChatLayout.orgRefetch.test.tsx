/**
 * Phase 166 Plan 05 Task 2 (ADMIN-02 / D-166-08 second half) — the ChatLayout
 * org-switch thread-list refetch.
 *
 * An org switch flips OrgProvider.activeOrgId (after syncing the X-Org-Id header
 * synchronously — Plan 02). The stream-bucket teardown is StreamsProvider's job
 * (Plan 02); this test locks the ORTHOGONAL second half: ChatLayout re-invokes
 * loadThreads() via an effect keyed on activeOrgId, so the sidebar thread list
 * reflects the newly-active org after the switch (reconcile-via-fetch, D-v2.5-03).
 *
 * The heavy chat chrome (NavPanel / WorkspacePanel / ChatArea / ChatHistoryColumn /
 * palette) is stubbed — the refetch wiring lives entirely in ChatLayout's effect.
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, waitFor } from "@testing-library/react"

const { mockLoadThreads } = vi.hoisted(() => ({
  mockLoadThreads: vi.fn().mockResolvedValue(undefined),
}))

// A mutable org context the test flips between renders to simulate a switchOrg().
let orgCtx: { activeOrgId: string | null } = { activeOrgId: "o1" }

vi.mock("@/providers/OrgProvider", () => ({
  useOrgOptional: () => orgCtx,
}))

// useThreads: a STABLE loadThreads spy (real is useCallback([]) — stable across renders,
// so the original mount effect fires once and only the activeOrgId effect re-fires).
vi.mock("@/hooks/useThreads", () => ({
  useThreads: () => ({
    threads: [],
    selectedThread: null,
    loading: false,
    loadThreads: mockLoadThreads,
    selectThread: vi.fn(),
    newThread: vi.fn().mockResolvedValue({ id: "t-new", title: "New Chat" }),
    deleteThread: vi.fn().mockResolvedValue(undefined),
    renameThread: vi.fn().mockResolvedValue(undefined),
    updateThreadTitle: vi.fn(),
  }),
}))
vi.mock("@/hooks/useFolders", () => ({ useFolders: () => ({ folders: [] }) }))
vi.mock("@/hooks/useTheme", () => ({ useTheme: () => ({ theme: "dark", toggleTheme: vi.fn() }) }))

// Stub the heavy chrome so the chat view mounts without StreamsProvider seams.
vi.mock("./NavPanel", () => ({ NavPanel: () => <nav data-testid="nav-stub" /> }))
vi.mock("@/components/panel/WorkspacePanel", () => ({ WorkspacePanel: () => <aside data-testid="panel-stub" /> }))
vi.mock("@/components/chat/ChatArea", () => ({ ChatArea: () => <main data-testid="chat-stub" /> }))
vi.mock("./ChatHistoryColumn", () => ({ ChatHistoryColumn: () => <div data-testid="history-stub" /> }))
vi.mock("./ThreadCommandPalette", () => ({ ThreadCommandPalette: () => <div data-testid="palette-stub" /> }))

import { ChatLayout } from "./ChatLayout"

function renderLayout() {
  const props = {
    onSignOut: vi.fn(),
    activeView: "chat" as const,
    onNavigate: vi.fn(),
    navItems: [],
    isOperator: false,
    operatorIdentity: null,
    prefillMessage: null,
    onSetPrefillMessage: vi.fn(),
    studioSkillId: null,
    studioTab: "evals" as const,
    onOpenStudio: vi.fn(),
    onReviewEvals: vi.fn(),
    onStudioTabChange: vi.fn(),
    onTuneSkill: vi.fn(),
  }
  return render(<ChatLayout {...props} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  orgCtx = { activeOrgId: "o1" }
})

describe("ChatLayout — org-switch thread-list refetch (D-166-08 / ADMIN-02)", () => {
  it("re-invokes loadThreads() when activeOrgId changes (the sidebar reflects the new org)", async () => {
    const { rerender } = renderLayout()

    // Mount: the original one-shot effect loads the current org's threads once.
    await waitFor(() => expect(mockLoadThreads).toHaveBeenCalledTimes(1))

    // Simulate switchOrg → activeOrgId flips; the activeOrgId-keyed effect re-fires.
    orgCtx = { activeOrgId: "o2" }
    rerender(
      <ChatLayout
        onSignOut={vi.fn()}
        activeView="chat"
        onNavigate={vi.fn()}
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
      />,
    )

    await waitFor(() => expect(mockLoadThreads).toHaveBeenCalledTimes(2))
  })

  it("does NOT refetch on an unrelated rerender (same activeOrgId)", async () => {
    const { rerender } = renderLayout()
    await waitFor(() => expect(mockLoadThreads).toHaveBeenCalledTimes(1))

    // Same org → no extra refetch (the effect is guarded on an actual change).
    rerender(
      <ChatLayout
        onSignOut={vi.fn()}
        activeView="chat"
        onNavigate={vi.fn()}
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
      />,
    )

    // Give any stray effect a tick; the count must stay at 1.
    await new Promise((r) => setTimeout(r, 30))
    expect(mockLoadThreads).toHaveBeenCalledTimes(1)
  })
})

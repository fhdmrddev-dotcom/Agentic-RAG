/**
 * Phase 235 plan 09 (SURF-03) — THE SIGNAL REACHES A MOBILE USER, AND IT IS READ ONCE.
 *
 * ── ⛔ WHY THIS SUITE EXISTS AT ALL, IN ONE SENTENCE ──────────────────────────────────
 *
 * `NavPanel.tsx` is `hidden md:flex` — **desktop only**. Closing SURF-03 against a rail badge
 * alone would close it against its own sentence (*"a broken watch reaches a person who is not
 * already looking at the page"*), which is the same class of error D-235-01 already rejected
 * once when it refused to let the Library Health tab carry the requirement by itself. So the
 * mobile home is built, and it is fenced HERE rather than asserted in a summary:
 *
 *   • the drawer's Library nav button carries the same badge, and still answers to "Library"
 *   • the drawer-OPENING control carries a dot, so a CLOSED drawer still signals
 *
 * ── ⛔ ONE READ, TWO RENDERERS — THE ASSERTION THAT MATTERS ───────────────────────────
 *
 * `ChatLayout` resolves the producer registry ONCE and hands the result to the rail, the
 * drawer row and the hamburger. A second `useSourceAttention()` anywhere in this tree means two
 * polls and, eventually, two disagreeing answers about the same source — the exact failure
 * D-235-05 exists to prevent.
 *
 * ⚠ THE ASSERTION IS `toHaveBeenCalledTimes(1)`, NEVER `toHaveBeenCalled()`. The second is
 * true of a two-reader world as well as a one-reader world, so it would pass in precisely the
 * situation it is supposed to catch.
 *
 * ⚠ THE GREP THAT WAS ORIGINALLY PROPOSED FOR THIS COULD NOT HAVE FIRED: the literal
 * `useSourceAttention` lives only inside `attentionConditions.ts`, so grepping the two mount
 * files for it matches nothing whether there is one reader or two. The runtime call count is
 * the real property.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MessageSquare, FileText } from "lucide-react"
import type { NavItem } from "@/lib/nav-items"

const { mockGetSourceHealth } = vi.hoisted(() => ({ mockGetSourceHealth: vi.fn() }))

// ⛔ `@/lib/api/sources` IS NOT IN THE `@/lib/api` BARREL (235-RESEARCH P-10): a
// `vi.mock("@/lib/api", …)` alone NEVER intercepts it, and this suite's whole subject is how
// many times ONE of its functions is called.
vi.mock("@/lib/api/sources", () => ({
  getSourceHealth: mockGetSourceHealth,
  listSyncRuns: vi.fn().mockResolvedValue([]),
}))

// The barrel. ⚠ A mock factory is an ALLOW-LIST — an export it omits does not fall back to the
// real module, it throws at mount (196-08: nine suites, 249 red cases, none about the subject).
vi.mock("@/lib/api", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api")>()
  return {
    ApiError: actual.ApiError,
    createThread: vi.fn(),
    postMessage: vi.fn(),
    deleteThread: vi.fn(),
    uploadWorkspaceTemplate: vi.fn(),
    getProviders: vi.fn().mockResolvedValue({
      active: "openai",
      active_model: "gpt-test",
      providers: [{ id: "openai", name: "OpenAI", models: ["gpt-test"], is_active: true }],
    }),
    listConnectorConnections: vi.fn().mockResolvedValue([]),
    listPublishedWorkflows: vi.fn().mockResolvedValue([]),
    getThreadWorkflow: vi.fn().mockResolvedValue({ mode: "deep", active_workflow_run_id: null }),
  }
})

vi.mock("@/hooks/useMessages", () => ({
  useMessages: () => ({
    messages: [],
    loadMessages: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    stopStreaming: vi.fn(),
    clearMessages: vi.fn(),
    setViewingThread: vi.fn(),
    resumeFromFailed: vi.fn(),
  }),
}))
vi.mock("@/hooks/useThreads", () => ({
  useThreads: () => ({
    threads: [],
    selectedThread: null,
    loading: false,
    loadThreads: vi.fn().mockResolvedValue(undefined),
    selectThread: vi.fn(),
    newThread: vi.fn().mockResolvedValue({ id: "t-new", title: "New Chat" }),
    deleteThread: vi.fn().mockResolvedValue(undefined),
    renameThread: vi.fn().mockResolvedValue(undefined),
    updateThreadTitle: vi.fn(),
  }),
}))
vi.mock("@/hooks/useFolders", () => ({ useFolders: () => ({ folders: [] }) }))
vi.mock("@/hooks/useTheme", () => ({ useTheme: () => ({ theme: "dark", toggleTheme: vi.fn() }) }))
vi.mock("@/lib/supabase", () => ({
  // ⚠ `useAuth` re-binds on this window event after a client rehydrate; the mock must carry
  // the constant as well as the client, or the effect throws at mount.
  SUPABASE_CLIENT_REHYDRATED: "supabase-client-rehydrated",
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "user-1" }, access_token: "token" } },
      }),
      // The rail footer's ProfileMenu reads `useAuth`, which subscribes here on mount.
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}))

// Heavy leaves that are irrelevant to the signal and pull their own seams.
vi.mock("@/components/panel/WorkspacePanel", () => ({
  WorkspacePanel: () => <aside data-testid="panel-stub" />,
}))
vi.mock("@/pages/WorkflowRunPage", () => ({
  WorkflowRunPage: () => <div data-testid="run-page-stub" />,
}))

import { ChatLayout } from "../ChatLayout"
import { StreamsProvider } from "@/providers/StreamsProvider"
import { TooltipProvider } from "@/components/ui/tooltip"

const navItems: NavItem[] = [
  { view: "chat", icon: MessageSquare, label: "Chat" },
  { view: "documents", icon: FileText, label: "Library" },
]

/** Two stopped sources, shaped exactly as `/sources/health` answers. */
const TWO_STOPPED = {
  stopped: [
    {
      watch_id: "w-1",
      source_folder_name: "Rate sheets",
      connection_name: "Drive · finance",
      cause: "token_revoked" as const,
      hard: true,
      stopped_since: "2026-09-05T09:00:00Z",
      last_good_at: "2026-09-04T09:00:00Z",
    },
    {
      watch_id: "w-2",
      source_folder_name: "Contracts",
      connection_name: "Drive · legal",
      cause: "folder_gone" as const,
      hard: true,
      stopped_since: "2026-09-05T10:00:00Z",
      last_good_at: null,
    },
  ],
  reader_running: true,
  poll_interval_seconds: 600,
}

const NONE_STOPPED = { stopped: [], reader_running: true, poll_interval_seconds: 600 }

function renderLayout() {
  return render(
    <TooltipProvider>
      <StreamsProvider>
        <ChatLayout
          onSignOut={vi.fn()}
          activeView="chat"
          onNavigate={vi.fn()}
          navItems={navItems}
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
          onOpenLibraryHealth={vi.fn()}
        />
      </StreamsProvider>
    </TooltipProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetSourceHealth.mockResolvedValue(TWO_STOPPED)
})
afterEach(() => cleanup())

// ══ NON-VACUITY FIRST ═════════════════════════════════════════════════════════════════
describe("ChatLayout attention signal — the harness", () => {
  it("mounts and renders the drawer-opening control the dot attaches to", async () => {
    renderLayout()
    expect(
      await screen.findByRole("button", { name: /open navigation/i }),
    ).toBeInTheDocument()
  })
})

// ══ ONE READ, TWO RENDERERS (D-235-05 · T-235-30) ═════════════════════════════════════
describe("ChatLayout attention signal — exactly one reader per render tree", () => {
  it("fetches the verdict EXACTLY ONCE while rail, drawer and hamburger all render it", async () => {
    const user = userEvent.setup()
    renderLayout()

    // The rail renderer (desktop) — present in jsdom, where `hidden md:flex` hides nothing.
    expect(await screen.findByTestId("rail-badge")).toBeInTheDocument()
    // The hamburger renderer — a CLOSED drawer still signals.
    expect(screen.getByTestId("drawer-trigger-dot")).toBeInTheDocument()
    // The drawer renderer.
    await user.click(screen.getByRole("button", { name: /open navigation/i }))
    expect(await screen.findByTestId("drawer-attention-badge")).toBeInTheDocument()

    // ⛔ Three renderers, ONE read. A count of 2 is the two-reader world this fails.
    expect(mockGetSourceHealth).toHaveBeenCalledTimes(1)
  })
})

// ══ THE MOBILE HOME ═══════════════════════════════════════════════════════════════════
describe("ChatLayout attention signal — the mobile drawer", () => {
  it("the drawer's Library button carries the badge and KEEPS its accessible name", async () => {
    const user = userEvent.setup()
    renderLayout()
    await user.click(await screen.findByRole("button", { name: /open navigation/i }))

    const badge = await screen.findByTestId("drawer-attention-badge")
    expect(badge).toHaveAttribute("aria-hidden", "true")
    expect(badge).toHaveTextContent("2")

    // ⚠ The badge decorates the control; it must not rename it. `IngestionTab.tsx:176-188`
    // measured six broken cases the one time this rule was missed.
    const owner = badge.closest("button")
    expect(owner).not.toBeNull()
    expect(owner).toHaveAttribute("aria-label", "Library")
  })

  it("the drawer-opening control shows a dot, aria-hidden, so a CLOSED drawer still signals", async () => {
    renderLayout()
    const hamburger = await screen.findByRole("button", { name: /open navigation/i })
    const dot = screen.getByTestId("drawer-trigger-dot")
    expect(dot).toHaveAttribute("aria-hidden", "true")
    expect(hamburger).toContainElement(dot)
    // The dot did not rename the control — it is still reachable by its own name.
    expect(hamburger).toHaveAttribute("aria-label", "Open navigation")
  })
})

// ══ SILENCE WHEN NOTHING IS WRONG (SC#4) ══════════════════════════════════════════════
describe("ChatLayout attention signal — a healthy instance is silent", () => {
  it("renders no badge and no dot anywhere when the server reports nothing stopped", async () => {
    mockGetSourceHealth.mockResolvedValue(NONE_STOPPED)
    const user = userEvent.setup()
    renderLayout()

    await screen.findByRole("button", { name: /open navigation/i })
    await waitFor(() => expect(mockGetSourceHealth).toHaveBeenCalledTimes(1))

    expect(screen.queryByTestId("rail-badge")).toBeNull()
    expect(screen.queryByTestId("drawer-trigger-dot")).toBeNull()
    await user.click(screen.getByRole("button", { name: /open navigation/i }))
    expect(screen.queryByTestId("drawer-attention-badge")).toBeNull()
    // The Library door is still there — silence is the absence of a SIGNAL, not of the nav.
    expect(screen.getAllByRole("button", { name: "Library" }).length).toBeGreaterThan(0)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════
// ⛔ THE READER INVENTORY FENCE — Phase 235 plan 15 (gap-closure round 1 · verification G4)
// ══════════════════════════════════════════════════════════════════════════════════════════
/**
 * ── WHY A SECOND GUARD, WHEN `toHaveBeenCalledTimes(1)` ALREADY EXISTS ────────────────────
 *
 * That case is correct and stays untouched: it proves the SHELL reads once. **It is also blind
 * to the defect verification found**, because it never mounts the Library — and the Library's
 * active tab body mounts a SECOND `useSourceAttention()`. `attentionConditions.ts` shipped a
 * docblock asserting one reader per render tree while the tree carried two, and no test in the
 * repository could see it. This is that test.
 *
 * ── WHAT IT PINS, AND WHY A GREP OF THE MOUNT FILES WOULD NOT HAVE DONE ──────────────────
 *
 * This suite's own docblock above already records that the originally-proposed grep could not
 * fire: `ChatLayout.tsx` contains the literal ZERO times — it reads through the
 * `ATTENTION_PRODUCERS` registry — so grepping the mount files matches nothing in a one-reader
 * OR a two-reader world. The property that actually matters is **how many call sites exist in
 * the whole source tree**, so this sweeps every non-test `.ts`/`.tsx` under `src/` with
 * `import.meta.glob(…?raw)` and pins the inventory BY FILE, not merely the total. A fourth
 * reader anywhere reddens this.
 *
 * ⚠ Two exclusions, both deliberate and both non-vacuity-checked below:
 *   • `hooks/useSourceAttention.ts` — its own `export function useSourceAttention(` is the
 *     DEFINITION, not a call site.
 *   • test files — the hook's own suite calls it inside `renderHook` many times, which is
 *     exactly what a hook's suite should do and says nothing about the product tree.
 */
describe("source-attention reader inventory — a fourth reader cannot arrive silently", () => {
  const RAW = import.meta.glob("../../../**/*.{ts,tsx}", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>

  /**
   * `src/`-relative path for a glob key.
   *
   * ⚠ MEASURED, not assumed: Vite normalises each key to the SHORTEST relative path from the
   * importing file, so a single pattern yields keys of DIFFERENT depths — `../ChatLayout.tsx`,
   * `../../ui/tabs.tsx` and `../../../pages/LibraryPage.tsx` all came out of the one glob
   * above. Stripping a fixed `../` prefix therefore collapses distinct files onto colliding
   * names; the key has to be RESOLVED against this file's own directory.
   */
  const HERE = "src/components/layout/__tests__"
  const rel = (key: string): string => {
    const out = HERE.split("/")
    for (const seg of key.replace(/\\/g, "/").split("/")) {
      if (seg === "..") out.pop()
      else if (seg !== "." && seg !== "") out.push(seg)
    }
    return out.join("/").replace(/^src\//, "")
  }

  const BY_PATH: Record<string, string> = Object.fromEntries(
    Object.entries(RAW).map(([key, src]) => [rel(key), src]),
  )

  const isProductFile = (key: string) => {
    const p = rel(key)
    if (/\.test\.tsx?$/.test(p)) return false
    if (p.includes("__tests__/")) return false
    // The hook's own definition file — a declaration, never a call site.
    if (p === "hooks/useSourceAttention.ts") return false
    return true
  }

  /**
   * The LINE-ANCHORED comment stripper (`renameFence.test.ts:89`). ⚠ The `^\s*` on the line
   * comment replace is load-bearing: the unanchored variant eats live code.
   *
   * ⛔ IT IS NOT OPTIONAL HERE, AND THAT WAS MEASURED. The first version of this fence counted
   * raw text and read `attentionConditions.ts` as THREE call sites — because the docblock this
   * plan rewrote quotes `useSourceAttention()` in prose. A code measurement satisfiable (or
   * breakable) by a comment is exactly the 187-24 lesson `App.tsx:91-101` already records.
   */
  const codeOf = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

  /** Call sites in one file's CODE: the identifier immediately followed by `(`. */
  const callSites = (src: string) => (codeOf(src).match(/useSourceAttention\s*\(/g) ?? []).length

  const inventory = Object.entries(RAW)
    .filter(([key]) => isProductFile(key))
    .map(([key, src]) => [rel(key), callSites(src)] as const)
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => a.localeCompare(b))

  // ── SELF-GUARDS. A sweep that read nothing is green and defends nothing. ────────────────
  it("self-guard: the glob really loaded the source tree as text, and the exclusions bite", () => {
    expect(Object.keys(RAW).length).toBeGreaterThan(200)
    // The resolver works at three different key depths — the property that broke first.
    expect(BY_PATH["hooks/useSourceAttention.ts"]).toContain("export function useSourceAttention")
    expect(BY_PATH["components/layout/ChatLayout.tsx"]).toContain("ATTENTION_PRODUCERS")
    expect(BY_PATH["components/ui/tabs.tsx"]).toContain("TabsPrimitive")
    // …and the exclusions really excluded something, or the arms below are vacuous.
    expect(Object.keys(RAW).some((k) => /\.test\.tsx?$/.test(rel(k)))).toBe(true)
    expect(inventory.map(([p]) => p)).not.toContain("hooks/useSourceAttention.ts")
  })

  it("self-guard: the stripper removes PROSE and keeps CODE — the pair that reds a broken one", () => {
    const registry = BY_PATH["components/layout/attentionConditions.ts"]
    // A token that exists ONLY in that file's docblock. Present raw, absent from the code.
    expect(registry).toContain("MOUNTED SUBTREE")
    expect(codeOf(registry)).not.toContain("MOUNTED SUBTREE")
    // …and the stripper did not return "": the real call and the real export survive.
    expect(codeOf(registry)).toContain("ATTENTION_PRODUCERS")
    expect(codeOf(registry)).toContain("useSourceAttention()")
    // ⛔ THE DEFECT THIS PAIR EXISTS FOR: the docblock quotes the hook name in prose, so a
    // fence counting RAW text reads this file as 3 readers instead of 1.
    expect((registry.match(/useSourceAttention\s*\(/g) ?? []).length).toBeGreaterThan(1)
    expect(callSites(registry)).toBe(1)
  })

  it("⛔ EXACTLY THREE product call sites, and they are the three that are supposed to exist", () => {
    expect(inventory).toEqual([
      // The shell reader. `ChatLayout` reaches it through `ATTENTION_PRODUCERS` — which is why
      // grepping `ChatLayout.tsx` itself finds nothing and this fence looks at the registry.
      ["components/layout/attentionConditions.ts", 1],
      // The Library's Ingestion tab body.
      ["components/library/IngestionTab.tsx", 1],
      // The Library's Health tab body — mutually exclusive with the one above, by tab.
      ["components/library/SourcesAttentionSection.tsx", 1],
    ])
  })

  it("`ChatLayout.tsx` reads the verdict through the registry and never calls the hook itself", () => {
    const layout = BY_PATH["components/layout/ChatLayout.tsx"]
    expect(layout).toBeTypeOf("string")
    expect(callSites(layout)).toBe(0)
    // Non-vacuity: it really is the shell, and it really does resolve the registry ONCE.
    expect((layout.match(/ATTENTION_PRODUCERS\.flatMap/g) ?? []).length).toBe(1)
  })

  it("⚠ the two Library readers are mutually exclusive BY TAB — no `forceMount` anywhere", () => {
    // This is what makes the live count TWO rather than three. Radix unmounts an inactive
    // `TabsContent`; a `forceMount` on either body would mount both at once.
    expect(BY_PATH["components/ui/tabs.tsx"]).not.toContain("forceMount")
    expect(BY_PATH["pages/LibraryPage.tsx"]).not.toContain("forceMount")
  })
})

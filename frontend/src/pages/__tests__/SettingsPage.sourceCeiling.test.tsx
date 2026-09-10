/**
 * SEED-258 (Phase 239-10) — the source file-size ceiling, wired into a page a person opens.
 *
 * The card's own words are asserted in `components/settings/__tests__/SourceFileCeilingCard.test.tsx`.
 * THIS suite asserts the four things only the page can be responsible for:
 *
 *   1. it has ONE home, and that home is the Integrations tab (never split across two);
 *   2. the STORED value hydrates it (HI-02 — a blank over a stored value makes Save a wipe);
 *   3. Save carries the value on the SAME payload the tab already sends;
 *   4. ⛔ a server REFUSAL reaches the operator verbatim, and is not clamped away.
 *
 * ⚠ (4) IS THE NON-NEGOTIABLE. SEED-258: *"Bounds are enforced only in the React form"* is a
 * named way of answering this badly, and the brief is sharper still — *"do not implement
 * clamping that hides a refusal the operator should see"*. The backend's 400 body is the one
 * place the cost sentence is authoritative; swallowing it would leave the operator guessing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { FullAppSettings } from "@/lib/api"
import { EffectiveFeaturesProvider } from "@/providers/EffectiveFeaturesProvider"
import { TechnicalNamesProvider } from "@/providers/TechnicalNamesProvider"

const { mockGetSettings, mockUpdateSettings, mockGetReembedProgress, mockGetAuditLogs } =
  vi.hoisted(() => ({
    mockGetSettings: vi.fn(),
    mockUpdateSettings: vi.fn(),
    mockGetReembedProgress: vi.fn(),
    mockGetAuditLogs: vi.fn(),
  }))

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    getSettings: mockGetSettings,
    updateSettings: mockUpdateSettings,
    getReembedProgress: mockGetReembedProgress,
    getAuditLogs: mockGetAuditLogs,
    exportAuditLogs: vi.fn(),
  }
})

vi.mock("@/components/settings/MemorySection", () => ({ MemorySection: () => null }))
vi.mock("@/components/settings/ReembedStatusCard", () => ({ ReembedStatusCard: () => null }))

import { SettingsPage } from "../SettingsPage"

/**
 * ⚠ NON-DEFAULT SERVED VALUES, for the reason the card suite gives: with 25/1/50 every
 * assertion below would also pass against a page that ignored the response and rendered
 * hardcoded numbers. 37/3/44 can only reach the screen through the settings contract.
 */
const SERVED_VALUE = 37
const SERVED_FLOOR = 3
const SERVED_CEILING = 44

function mkSettings(overrides: Partial<FullAppSettings> = {}): FullAppSettings {
  return {
    active_provider: "anthropic",
    llm_model: "claude-sonnet-4-6",
    available_models: ["claude-sonnet-4-6"],
    harness_judge_model: "",
    resolved_harness_judge_model: "claude-opus-4-8",
    providers: [
      { id: "anthropic", name: "Anthropic", base_url: "api.anthropic.com", has_key: true, is_active: true, models: ["claude-sonnet-4-6"] },
    ],
    embedding_model: "text-embedding-3-small",
    embedding_base_url: "",
    embedding_dimensions: 1536,
    embedding_has_api_key: true,
    embedding_provider: "openai",
    extraction_provider: "openai",
    extraction_model: "gpt-4o",
    rerank_enabled: false,
    rerank_provider: "api",
    rerank_model: "",
    rerank_top_n: 5,
    rerank_has_api_key: false,
    multimodal_max_vision_calls: 100,
    vision_model: "",
    vision_max_pages: 50,
    // SEED-258 — the three fields under test. Carried explicitly rather than defaulted
    // away: `test_settings.py`'s stub comment is right that a `getattr` default "would
    // hide a field the API forgot to build".
    source_max_file_size_mb: SERVED_VALUE,
    source_max_file_size_mb_floor: SERVED_FLOOR,
    source_max_file_size_mb_ceiling: SERVED_CEILING,
    retrieval_top_k: 10,
    retrieval_match_threshold: 0.3,
    hybrid_search_enabled: true,
    hybrid_candidate_count: 50,
    vector_search_weight: 1,
    keyword_search_weight: 1,
    rrf_k: 60,
    web_search_enabled: false,
    web_search_has_api_key: false,
    web_search_max_results: 5,
    sandbox_enabled: false,
    ...overrides,
  } as unknown as FullAppSettings
}

function renderSettings(features: Record<string, boolean> = { model_management: true }) {
  return render(
    <EffectiveFeaturesProvider value={{ features, loading: false, refetch: () => {} }}>
      <TechnicalNamesProvider>
        <SettingsPage />
      </TechnicalNamesProvider>
    </EffectiveFeaturesProvider>,
  )
}

/** Open the Integrations tab — Radix unmounts inactive panels, so this is a precondition. */
async function openIntegrations() {
  const tab = await screen.findByRole("tab", { name: /integrations/i })
  await userEvent.click(tab)
  return tab
}

beforeEach(() => {
  vi.clearAllMocks()
  // ⚠ MEASURED, NOT PRECAUTIONARY. `handleTabChange` persists the selection
  // (`localStorage.setItem("settings_active_tab", …)`, SettingsPage.tsx:590), and jsdom
  // keeps localStorage for the whole file — so the case AFTER any case that opens a tab
  // mounts already on it. That is real product behaviour, not leakage; without this line
  // a later case reads a page state an earlier case chose.
  localStorage.clear()
  mockGetSettings.mockResolvedValue(mkSettings())
  mockUpdateSettings.mockResolvedValue(mkSettings())
  mockGetReembedProgress.mockResolvedValue(null)
  mockGetAuditLogs.mockResolvedValue({ logs: [], total: 0 })
})

afterEach(() => cleanup())

describe("SettingsPage — the source ceiling has ONE home, and it is Integrations", () => {
  it("the fixture's own premise: getSettings serves the three SEED-258 fields", async () => {
    // ⚠ Four times in this phase a case passed vacuously on a wrong fixture. If the mock
    // ever stops carrying these, every case below would be asserting against defaults.
    const served = await mockGetSettings.getMockImplementation()?.()
    const s = served ?? (await mockGetSettings())
    expect(s.source_max_file_size_mb).toBe(SERVED_VALUE)
    expect(s.source_max_file_size_mb_floor).toBe(SERVED_FLOOR)
    expect(s.source_max_file_size_mb_ceiling).toBe(SERVED_CEILING)
  })

  it("renders the ceiling control on the Integrations tab", async () => {
    renderSettings()
    await openIntegrations()

    expect(await screen.findByText(/largest file a connected source may import/i))
      .toBeInTheDocument()
  })

  it("appears EXACTLY ONCE, inside the Integrations panel — one home, never two", async () => {
    /**
     * The brief: *"Pick one, state the reason, and do not split it across both."*
     *
     * ⚠ THIS CASE ORIGINALLY ASSERTED "absent from the AI Model tab" AND ITS PREMISE WAS
     * FALSE — recorded rather than quietly rewritten, because the premise is the finding.
     * It assumed the page opens on tab 0, but `handleTabChange` persists the selection to
     * localStorage, so after any earlier case opened Integrations this one mounted there
     * too. It failed loudly instead of passing vacuously, which is the only reason the
     * behaviour was noticed at all.
     *
     * The rewrite asserts the property that was actually wanted and is stronger than the
     * original: ONE occurrence in the whole page, and it sits in the Integrations panel.
     * "Absent from tab 0" would still have permitted a second copy on tab 1.
     */
    renderSettings()
    await openIntegrations()

    const hits = await screen.findAllByText(/largest file a connected source may import/i)
    expect(hits).toHaveLength(1)

    const panel = hits[0].closest('[role="tabpanel"]')
    expect(panel).not.toBeNull()
    // The panel is the one the Integrations tab labels — not merely "a" panel.
    const integrationsTab = screen.getByRole("tab", { name: /integrations/i })
    expect(panel).toHaveAttribute("aria-labelledby", integrationsTab.id)
  })

  it("hydrates the STORED value, not a default", async () => {
    renderSettings()
    await openIntegrations()

    const input = await screen.findByLabelText(/maximum file size/i)
    expect(input).toHaveValue(SERVED_VALUE)
  })

  it("states the SERVED bounds, so the form owns no copy of 1/50", async () => {
    renderSettings()
    await openIntegrations()

    await screen.findByLabelText(/maximum file size/i)
    const text = document.body.textContent ?? ""
    expect(text).toContain(String(SERVED_FLOOR))
    expect(text).toContain(String(SERVED_CEILING))
  })

  it("explains the cost and recommends a value, on the same screen as the number", async () => {
    // ⭐ The requirement that IS this task. A bare number input fails it.
    renderSettings()
    await openIntegrations()

    await screen.findByLabelText(/maximum file size/i)
    const text = document.body.textContent ?? ""
    expect(text).toMatch(/memory/i)
    expect(text).toMatch(/server we do not control/i)
    expect(text).toMatch(/Recommended/i)
  })

  it("a member never reaches it — the knob is operator scope, gated by construction", async () => {
    // `app_settings` is the global singleton. SEED-258: "A DoS guard a user can raise for
    // themselves is not a guard." The Integrations tab is already canManageModels-gated,
    // which is a reason this home was chosen rather than a check bolted on.
    renderSettings({})

    await waitFor(() => {
      expect(screen.queryByRole("tab", { name: /integrations/i })).toBeNull()
    })
    expect(screen.queryByText(/largest file a connected source may import/i)).toBeNull()
  })
})

describe("SettingsPage — the ceiling travels on Save, and a refusal comes back", () => {
  it("Save Integrations carries source_max_file_size_mb", async () => {
    renderSettings()
    await openIntegrations()

    const input = await screen.findByLabelText(/maximum file size/i)
    await userEvent.clear(input)
    await userEvent.type(input, "40")

    await userEvent.click(screen.getByRole("button", { name: /save integrations/i }))

    await waitFor(() => expect(mockUpdateSettings).toHaveBeenCalled())
    const body = mockUpdateSettings.mock.calls[0][0]
    expect(body).toHaveProperty("source_max_file_size_mb", 40)
  })

  it("⛔ surfaces the SERVER's refusal verbatim rather than clamping it away", async () => {
    // The API is the boundary. `updateSettings` already rethrows the backend `detail`
    // string; this case pins that the page shows it instead of swallowing it — and the
    // detail is the one sentence that states what raising the ceiling costs.
    const REFUSAL =
      "The largest file a connected source may import must be between 1 and 50 MB. " +
      "Raising it costs memory: the whole response is held in memory per in-flight request " +
      "from a server we do not control."
    mockUpdateSettings.mockRejectedValueOnce(new Error(REFUSAL))

    renderSettings()
    await openIntegrations()

    await screen.findByLabelText(/maximum file size/i)
    await userEvent.click(screen.getByRole("button", { name: /save integrations/i }))

    expect(await screen.findByText(new RegExp("must be between 1 and 50 MB", "i")))
      .toBeInTheDocument()
  })
})

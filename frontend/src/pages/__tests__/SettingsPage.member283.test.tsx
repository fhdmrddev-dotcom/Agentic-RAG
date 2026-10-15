/**
 * Phase 283 Plan 02 (FIX-01 / BUG-261004-02, D-12 b/c/d) — a member's Settings page, and an
 * operator's, as RENDERED CONTENT.
 *
 * WHAT THIS FENCES. Phase 283 opens the Settings rail door to every org member. Inside, a member
 * must see exactly the three tabs that are theirs — Preferences · Memory · Audit Log — land on
 * Preferences, find "Show technical names" and their "Default chat model" there, see no dead Reset,
 * and cause ZERO calls to any `model_management`-gated client function (each would be a 403 the
 * audit log records as noise). An operator's page must be unchanged apart from the two blocks that
 * moved out of AI Model into Preferences.
 *
 * ⚠ MEMBER FIXTURES ARE `{ model_management: false }`, NEVER `{}`. That is the shape `/features`
 *   actually returns for a member. `{}` means "not told yet" — a different state, and one the page
 *   also fails closed on, so a `{}` fixture could pass for the wrong reason.
 *
 * ⚠ THE SPIES ARE ON THE `@/lib/api` BARREL, NOT ON `fetch`. In jsdom `getAuthHeaders()` throws
 *   before any `fetch` happens, so a fetch spy would read "no calls" for every page — vacuous.
 *   The OPERATOR render's `getSettings` call is the positive control: without it, a mock that never
 *   wired would also read as "no calls".
 *
 * ⚠ `getJudgeModel()` IS `await getSettings()` (`lib/api/settings.ts`), so `JudgeModelPicker` is a
 *   hidden `GET /settings` caller living in tab "0". It is mocked here so that a regression that
 *   mounted tab "0" for a member would be caught on the function it actually calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, within, waitFor, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { FullAppSettings } from "@/lib/api"
import { EffectiveFeaturesProvider } from "@/providers/EffectiveFeaturesProvider"
import { TechnicalNamesProvider } from "@/providers/TechnicalNamesProvider"

const gated = vi.hoisted(() => ({
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  getReembedProgress: vi.fn(),
  kickReembed: vi.fn(),
  getJudgeModel: vi.fn(),
  setJudgeModel: vi.fn(),
  getEngineHealth: vi.fn(),
  runEngineSweep: vi.fn(),
}))

const allowed = vi.hoisted(() => ({
  getModelDefault: vi.fn(),
  setModelDefault: vi.fn(),
  getAuditLogs: vi.fn(),
  exportAuditLogs: vi.fn(),
}))

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return { ...actual, ...gated, ...allowed }
})

// MemorySection fires its own effects; a visible stub proves the tab body mounted.
vi.mock("@/components/settings/MemorySection", () => ({ MemorySection: () => <p>memory-stub</p> }))

import { SettingsPage } from "../SettingsPage"

const MEMBER = { model_management: false }
const OPERATOR = { model_management: true }

function renderSettings(features: Record<string, boolean>) {
  return render(
    <EffectiveFeaturesProvider value={{ features, loading: false, refetch: () => {} }}>
      <TechnicalNamesProvider>
        <SettingsPage />
      </TechnicalNamesProvider>
    </EffectiveFeaturesProvider>,
  )
}

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
    source_max_file_size_mb: 25,
    source_max_file_size_mb_floor: 1,
    source_max_file_size_mb_ceiling: 50,
    retrieval_top_k: 10,
    retrieval_match_threshold: 0.3,
    hybrid_search_enabled: true,
    hybrid_candidate_count: 50,
    vector_search_weight: 1,
    keyword_search_weight: 1,
    rrf_k: 60,
    hnsw_ef_search: 40,
    hnsw_iterative_scan: "off",
    hnsw_ef_search_floor: 10,
    hnsw_ef_search_ceiling: 1000,
    hnsw_iterative_scan_values: ["off", "strict_order", "relaxed_order"],
    web_search_enabled: false,
    web_search_has_api_key: false,
    web_search_max_results: 5,
    sandbox_enabled: false,
    self_improve_enabled: true,
    workflows_enabled: true,
    maintenance_mode: false,
    model_discovery_filter_enabled: true,
    context_window_max_tokens: 0,
    sub_agent_max_output_tokens: 8192,
    sub_agent_model: "",
    resolved_sub_agent_model: "claude-haiku-4-5",
    skill_builder_model: "",
    resolved_skill_builder_model: "claude-haiku-4-5",
    llm_max_output_tokens: 0,
    openrouter_tool_strategy: "quality",
    verified_models: ["claude-sonnet-4-6"],
    inferred_provider_for: {},
    ...overrides,
  }
}

const tabNames = () => screen.getAllByRole("tab").map((t) => t.textContent)
const activePanel = () => screen.getByRole("tabpanel")

beforeEach(() => {
  localStorage.clear()
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {}
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
  gated.getSettings.mockResolvedValue(mkSettings())
  gated.updateSettings.mockImplementation(async () => mkSettings())
  gated.getReembedProgress.mockResolvedValue({ status: "idle" })
  gated.kickReembed.mockResolvedValue({ status: "idle" })
  gated.getJudgeModel.mockResolvedValue({ judge_model: "", resolved_judge_model: "claude-opus-4-8" })
  gated.setJudgeModel.mockImplementation(async () => mkSettings())
  gated.getEngineHealth.mockResolvedValue({ providers: [], last_sweep_at: null })
  gated.runEngineSweep.mockResolvedValue({ providers: [], last_sweep_at: null })
  allowed.getModelDefault.mockResolvedValue({
    default_model: null,
    effective_model: "gpt-4o",
    locked: false,
    allowed_models: ["gpt-4o"],
  })
  allowed.setModelDefault.mockResolvedValue({
    default_model: "gpt-4o",
    effective_model: "gpt-4o",
    locked: false,
    allowed_models: ["gpt-4o"],
  })
  allowed.getAuditLogs.mockResolvedValue({ entries: [], total: 0, page: 1, page_size: 50 })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("SettingsPage — a member reaches their own Settings (283-02 / FIX-01)", () => {
  it("shows exactly Preferences · Memory · Audit Log and lands on Preferences (D-04)", async () => {
    renderSettings(MEMBER)
    const prefs = await screen.findByRole("tab", { name: "Preferences" })
    expect(tabNames()).toEqual(["Preferences", "Memory", "Audit Log"])
    expect(prefs).toHaveAttribute("aria-selected", "true")
  })

  it("carries 'Show technical names' and the default chat model under Preferences (D-02)", async () => {
    renderSettings(MEMBER)
    await screen.findByRole("tab", { name: "Preferences" })
    const panel = activePanel()
    expect(within(panel).getByText("Show technical names")).toBeInTheDocument()
    expect(await within(panel).findByText("Default chat model")).toBeInTheDocument()
    // The REAL ModelDefaultPreference mounted and asked the ungated /me/preferences.
    await waitFor(() => expect(allowed.getModelDefault).toHaveBeenCalled())
  })

  it("renders no Reset for a member (D-06)", async () => {
    renderSettings(MEMBER)
    await screen.findByRole("tab", { name: "Preferences" })
    expect(screen.queryByRole("button", { name: /reset/i })).toBeNull()
  })

  it("keeps the subtitle and shows no lock or 'ask your administrator' copy (D-08)", async () => {
    renderSettings(MEMBER)
    await screen.findByRole("tab", { name: "Preferences" })
    expect(screen.getByText("Changes take effect immediately.")).toBeInTheDocument()
    // Hidden operator tabs VANISH — no locked tab, no badge, no "ask your administrator".
    expect(screen.queryByText(/ask your administrator|locked tab|operators only/i)).toBeNull()
    expect(screen.queryByRole("tab", { name: /ai model|search|integrations/i })).toBeNull()
  })

  it("calls no model_management-gated client function, on mount or on any tab click (D-07)", async () => {
    const user = userEvent.setup()
    renderSettings(MEMBER)
    await screen.findByRole("tab", { name: "Preferences" })
    for (const name of ["Memory", "Audit Log", "Preferences"]) {
      await user.click(screen.getByRole("tab", { name }))
      expect(screen.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true")
    }
    await waitFor(() => expect(allowed.getAuditLogs).toHaveBeenCalled())
    for (const [fn, spy] of Object.entries(gated)) {
      expect(spy, `${fn} must never be called for a member`).not.toHaveBeenCalled()
    }
  })

  it.each(["0", "1", "2", "5", "9"])(
    "lands a member with a persisted %s on Preferences (D-05)",
    async (persisted) => {
      localStorage.setItem("settings_active_tab", persisted)
      renderSettings(MEMBER)
      expect(await screen.findByRole("tab", { name: "Preferences" })).toHaveAttribute(
        "aria-selected",
        "true",
      )
      expect(gated.getSettings).not.toHaveBeenCalled()
      expect(gated.getJudgeModel).not.toHaveBeenCalled()
    },
  )
})

describe("SettingsPage — an operator's view is unchanged apart from the two moved blocks", () => {
  it("shows six tabs in strip order and lands on AI Model (D-04)", async () => {
    renderSettings(OPERATOR)
    const ai = await screen.findByRole("tab", { name: "AI Model" })
    // "Search" is the plain default of the term-map relabel (reveal OFF).
    expect(tabNames()).toEqual(["AI Model", "Search", "Integrations", "Preferences", "Memory", "Audit Log"])
    expect(ai).toHaveAttribute("aria-selected", "true")
  })

  it("POSITIVE CONTROL: the operator render does call getSettings", async () => {
    renderSettings(OPERATOR)
    await screen.findByRole("tab", { name: "AI Model" })
    await waitFor(() => expect(gated.getSettings).toHaveBeenCalled())
  })

  it("keeps the Reset button for an operator (D-06)", async () => {
    renderSettings(OPERATOR)
    await screen.findByRole("tab", { name: "AI Model" })
    expect(await screen.findByRole("button", { name: /reset/i })).toBeInTheDocument()
  })

  it("moves the toggle and the default model out of AI Model and into Preferences (D-02 / D-12 d)", async () => {
    const user = userEvent.setup()
    renderSettings(OPERATOR)
    await screen.findByRole("tab", { name: "AI Model" })
    await waitFor(() => expect(gated.getSettings).toHaveBeenCalled())
    const aiPanel = activePanel()
    expect(within(aiPanel).queryByText("Show technical names")).toBeNull()
    expect(within(aiPanel).queryByText("Default chat model")).toBeNull()

    await user.click(screen.getByRole("tab", { name: "Preferences" }))
    const prefsPanel = activePanel()
    expect(within(prefsPanel).getByText("Show technical names")).toBeInTheDocument()
    expect(await within(prefsPanel).findByText("Default chat model")).toBeInTheDocument()
  })

  it.each(["5", "9"])("lands an operator with a persisted %s on AI Model (D-05)", async (persisted) => {
    localStorage.setItem("settings_active_tab", persisted)
    renderSettings(OPERATOR)
    expect(await screen.findByRole("tab", { name: "AI Model" })).toHaveAttribute(
      "aria-selected",
      "true",
    )
  })
})

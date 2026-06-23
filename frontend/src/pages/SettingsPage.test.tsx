/**
 * Phase 123-06 Task 2 (D-08 / TRIG-01 / sketch 044-A) — the skill-builder model picker.
 *
 * Pins the no-SPOF contract (T-123-06-02): the builder-model picker offers the FULL
 * provider list incl. LOCAL options (Ollama / LM Studio / OpenAI-compat) — proven by
 * an option assertion, NOT a source grep. A model id is a VALUE not a secret, so it
 * rides the settings contract; the builder WRITES candidates while the benchmark
 * targets MEASURE firing (decoupled). The strong default renders when unset.
 *
 * Mirrors the WorkflowsPage.test.tsx api-mock idiom (vi.hoisted + vi.mock("@/lib/api")).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, within, waitFor, cleanup } from "@testing-library/react"
import type { FullAppSettings } from "@/lib/api"

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

// MemorySection + ReembedStatusCard fire their own effects; stub them so the test
// renders the AI Model tab without their network noise.
vi.mock("@/components/settings/MemorySection", () => ({ MemorySection: () => null }))
vi.mock("@/components/settings/ReembedStatusCard", () => ({ ReembedStatusCard: () => null }))

import { SettingsPage } from "./SettingsPage"

function mkSettings(overrides: Partial<FullAppSettings> = {}): FullAppSettings {
  return {
    active_provider: "anthropic",
    llm_model: "claude-sonnet-4-6",
    available_models: ["claude-sonnet-4-6"],
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

beforeEach(() => {
  localStorage.setItem("settings_active_tab", "0") // AI Model tab — where the picker lives
  mockGetSettings.mockResolvedValue(mkSettings())
  mockUpdateSettings.mockImplementation(async () => mkSettings())
  mockGetReembedProgress.mockResolvedValue({ status: "idle" })
  mockGetAuditLogs.mockResolvedValue({ entries: [], total: 0 })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("SettingsPage — skill-builder model picker (123-06 / D-08)", () => {
  it("offers at least one LOCAL-provider option (no paid-provider SPOF)", async () => {
    render(<SettingsPage />)

    // The builder-model picker is labeled; find its <select> control.
    const picker = await screen.findByLabelText(/skill-builder model/i)
    expect(picker.tagName).toBe("SELECT")

    const optionText = within(picker as HTMLElement)
      .getAllByRole("option")
      .map((o) => o.textContent?.toLowerCase() ?? "")
      .join(" | ")

    // At least one local-provider option must be present — proves the picker is NOT
    // a paid-provider-only list (T-123-06-02 / D-08, the 111.1 embedding-SPOF removal).
    const hasLocal =
      /ollama/.test(optionText) || /lm studio|lm-studio|lmstudio/.test(optionText) || /openai-compat|openai compat/.test(optionText)
    expect(hasLocal).toBe(true)
  })

  it("shows the strong resolved default label when the setting is unset", async () => {
    render(<SettingsPage />)
    // The resolved default (claude-haiku-4-5) surfaces in the picker / footer.
    await waitFor(() => {
      expect(screen.getByLabelText(/skill-builder model/i)).toBeInTheDocument()
    })
    expect(screen.getAllByText(/claude-haiku-4-5/i).length).toBeGreaterThan(0)
  })
})

/**
 * Phase 123.1-03 (D-09 / D-10) — the skill-builder model picker, now driven by the
 * user's CONFIGURED per-provider models (the same `providers[].models` source the chat
 * picker uses) instead of the hardcoded cheap-only `SKILL_BUILDER_MODEL_OPTIONS`.
 *
 * D-09: strong configured models (Sonnet/Opus, GPT-pro, Gemini-Pro) are selectable when
 *   configured — grouped per provider as <optgroup>s — not just haiku/mini/flash.
 * D-10: a sensible default stays pre-selected via the value="" Auto option (NOT forced);
 *   a custom persisted value is still selectable (never silently dropped); a SOFT amber
 *   hint (never a hard block / disabled option) shows when a chosen model is unverified.
 * IN-02: the placeholder local ids (lm-studio/qwen3, openai-compat/local-model) are GONE —
 *   local models now come from the user's real providers[].models.
 *
 * Mirrors the WorkflowsPage.test.tsx api-mock idiom (vi.hoisted + vi.mock("@/lib/api")).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, within, waitFor, cleanup } from "@testing-library/react"
import type { FullAppSettings } from "@/lib/api"
import { EffectiveFeaturesProvider } from "@/providers/EffectiveFeaturesProvider"

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
// Phase 154 (LANG-01 / D-01) — SettingsPage now hosts the "Show technical names"
// toggle via `useTechnicalNames()`, which THROWS outside its provider. Wrap the
// render in the provider (the citationNav.test wrapper idiom applied at the render
// helper — mirrors the 154-01 ControlRoomPage.test fix). Default OFF (plain).
import { TechnicalNamesProvider } from "@/providers/TechnicalNamesProvider"

/**
 * ⚠ THE PROVIDER IS NOT DECORATION — IT IS THE PRECONDITION FOR THE TAB UNDER TEST.
 *
 * `SettingsPage` renders AI Model, Search and Integrations ONLY when the effective-features
 * map resolves `model_management` true, because all three tabs are backed by endpoints
 * carrying `require_visible("model_management")`. A NULL context is fail-closed by the
 * contract App.tsx states at its provider mount, so an unwrapped render has NO AI Model tab
 * and every assertion below would fail on an absence rather than on a defect.
 *
 * `model_management: true` therefore states what these cases have always assumed: an
 * OPERATOR is looking at the page. `renderAsMember` below is the other half — without it,
 * nothing would prove the gate does anything.
 */
function renderSettings(features: Record<string, boolean> = { model_management: true }) {
  return render(
    <EffectiveFeaturesProvider value={{ features, loading: false, refetch: () => {} }}>
      <TechnicalNamesProvider>
        <SettingsPage />
      </TechnicalNamesProvider>
    </EffectiveFeaturesProvider>,
  )
}

/** A caller whose map does NOT carry `model_management` — the shape a member has. */
function renderAsMember() {
  return renderSettings({})
}

function mkSettings(overrides: Partial<FullAppSettings> = {}): FullAppSettings {
  return {
    active_provider: "anthropic",
    llm_model: "claude-sonnet-4-6",
    available_models: ["claude-sonnet-4-6"],
    harness_judge_model: "",
    resolved_harness_judge_model: "claude-opus-4-8",
    // A multi-provider set incl. a STRONG cloud model (claude-opus-4) and a real LOCAL
    // provider (ollama) — the configured-models source the builder picker now reads.
    providers: [
      { id: "anthropic", name: "Anthropic", base_url: "api.anthropic.com", has_key: true, is_active: true, models: ["claude-sonnet-4-6", "claude-opus-4"] },
      { id: "openai", name: "OpenAI", base_url: "api.openai.com", has_key: true, is_active: false, models: ["gpt-5.5-pro"] },
      { id: "ollama", name: "Ollama", base_url: "http://localhost:11434", has_key: false, is_active: false, models: ["llama3.1"] },
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

describe("SettingsPage — skill-builder model picker (123.1-03 / D-09 / D-10)", () => {
  it("lists a STRONG configured model (D-09) grouped under its provider", async () => {
    renderSettings()
    const picker = (await screen.findByLabelText(/skill-builder model/i)) as HTMLSelectElement
    expect(picker.tagName).toBe("SELECT")

    // A strong configured model surfaces as a selectable option (not just cheap models).
    const optionValues = within(picker).getAllByRole("option").map((o) => (o as HTMLOptionElement).value)
    expect(optionValues).toContain("claude-opus-4")
    expect(optionValues).toContain("gpt-5.5-pro")

    // Options are grouped per provider via <optgroup>.
    const optgroups = picker.querySelectorAll("optgroup")
    expect(optgroups.length).toBeGreaterThanOrEqual(1)
    const groupLabels = Array.from(optgroups).map((g) => g.getAttribute("label")?.toLowerCase() ?? "")
    expect(groupLabels.some((l) => /anthropic/.test(l))).toBe(true)
  })

  it("does NOT render the removed IN-02 placeholder local ids", async () => {
    renderSettings()
    const picker = (await screen.findByLabelText(/skill-builder model/i)) as HTMLSelectElement
    const optionValues = within(picker).getAllByRole("option").map((o) => (o as HTMLOptionElement).value)
    expect(optionValues).not.toContain("lm-studio/qwen3")
    expect(optionValues).not.toContain("openai-compat/local-model")
  })

  it("derives the LOCAL option from the configured provider (no paid-provider SPOF)", async () => {
    renderSettings()
    const picker = (await screen.findByLabelText(/skill-builder model/i)) as HTMLSelectElement
    // The local model comes from the user's real ollama provider, not a placeholder id.
    const optionValues = within(picker).getAllByRole("option").map((o) => (o as HTMLOptionElement).value)
    expect(optionValues).toContain("llama3.1")
  })

  it("keeps the Auto default option (value=\"\"), pre-selected when unset (D-10)", async () => {
    renderSettings()
    const picker = (await screen.findByLabelText(/skill-builder model/i)) as HTMLSelectElement
    const optionValues = within(picker).getAllByRole("option").map((o) => (o as HTMLOptionElement).value)
    expect(optionValues).toContain("")
    // Unset => the Auto option is the selected value (default not forced to a model).
    expect(picker.value).toBe("")
  })

  it("keeps a custom persisted value selectable as (current) so a stored id never drops", async () => {
    mockGetSettings.mockResolvedValue(mkSettings({ skill_builder_model: "some/custom-unconfigured-id" }))
    renderSettings()
    const picker = (await screen.findByLabelText(/skill-builder model/i)) as HTMLSelectElement
    await waitFor(() => expect(picker.value).toBe("some/custom-unconfigured-id"))
    const current = within(picker).getByText(/some\/custom-unconfigured-id \(current\)/i)
    expect(current).toBeInTheDocument()
  })

  it("shows a SOFT amber hint for an unverified selected model — option NOT disabled (D-10)", async () => {
    // claude-opus-4 is configured but NOT in verified_models => soft hint, never a block.
    mockGetSettings.mockResolvedValue(mkSettings({ skill_builder_model: "claude-opus-4" }))
    renderSettings()
    const picker = (await screen.findByLabelText(/skill-builder model/i)) as HTMLSelectElement
    await waitFor(() => expect(picker.value).toBe("claude-opus-4"))

    // The soft hint renders next to the builder picker (mirror of the amber
    // "unverified" chip). Scope to the picker's immediate row so we don't collide
    // with the Active-Model chip elsewhere on the tab.
    const builderRow = picker.parentElement as HTMLElement
    expect(within(builderRow).getByText(/unverified/i)).toBeInTheDocument()

    // NO option in the builder picker carries a disabled attribute — never a hard block.
    const anyDisabled = within(picker).getAllByRole("option").some((o) => (o as HTMLOptionElement).disabled)
    expect(anyDisabled).toBe(false)
  })

  it("shows the strong resolved default label when the setting is unset", async () => {
    renderSettings()
    await waitFor(() => {
      expect(screen.getByLabelText(/skill-builder model/i)).toBeInTheDocument()
    })
    expect(screen.getAllByText(/claude-haiku-4-5/i).length).toBeGreaterThan(0)
  })
})

describe("the ungoverned Connections door (a member reaching Settings)", () => {
  /**
   * ⚠ THE DEFECT THIS PINS SHIPPED AND WAS FOUND BY THE OPERATOR, NOT BY A TEST.
   *
   * `nav-items.ts` tagged the Settings entry `model_management`, which is Operators-only
   * (`api/features.py:21`), so `visibleNavItems` dropped it for every member — taking the
   * whole connections surface Phases 211-216 shipped with it. The tag was correct when
   * Settings held only model management and stopped being correct when it grew a per-user
   * tab. Nothing failed, because no test had ever rendered this page AS a member.
   */
  it("shows Connections, Memory and Audit Log to a member", async () => {
    renderAsMember()
    expect(await screen.findByRole("tab", { name: /connections/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /memory/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /audit log/i })).toBeInTheDocument()
  })

  it("hides the three model_management tabs from a member", async () => {
    renderAsMember()
    await screen.findByRole("tab", { name: /connections/i })
    // ABSENT, never disabled — the sketch-069-A vanish. A locked tab is a control whose
    // every call would 403, which is what Phase 148 rejected.
    expect(screen.queryByRole("tab", { name: /^ai model$/i })).toBeNull()
    expect(screen.queryByRole("tab", { name: /integrations/i })).toBeNull()
  })

  it("does not call GET /settings for a member", async () => {
    // The endpoint carries require_visible("model_management"): calling it would 403,
    // and `if (error && !s)` would turn that into a full-page error where the door lands.
    renderAsMember()
    await screen.findByRole("tab", { name: /connections/i })
    expect(mockGetSettings).not.toHaveBeenCalled()
  })

  it("still shows every tab to an operator", async () => {
    renderSettings()
    expect(await screen.findByRole("tab", { name: /^ai model$/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /connections/i })).toBeInTheDocument()
    expect(mockGetSettings).toHaveBeenCalled()
  })
})

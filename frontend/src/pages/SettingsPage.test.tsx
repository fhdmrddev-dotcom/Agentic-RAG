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
import userEvent from "@testing-library/user-event"
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
    // SEED-226 — required by the response, so the fixture carries them rather than
    // the API defaulting them away and hiding a field it forgot to build.
    vision_model: "",
    vision_max_pages: 50,
    // SEED-258 — the source file ceiling and the bounds the server states. Carried here
    // for the same reason the two lines above are: a fixture that defaulted them away
    // would hide a field the API forgot to build. The card's own behaviour is asserted in
    // `__tests__/SettingsPage.sourceCeiling.test.tsx`, so these are the shipped values.
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
    // Phase 241 (QUEUE-06 / D-09) — the two HNSW knobs and the bounds the server states.
    // ⚠ NON-DEFAULT SERVED BOUNDS ON PURPOSE. With 10/1000 every assertion below would also
    // pass against a page that ignored the response and rendered hardcoded numbers — the
    // `sourceCeiling` suite's own lesson, applied. 17/823 can only reach the screen through
    // the settings contract.
    hnsw_ef_search: 40,
    hnsw_iterative_scan: "off",
    hnsw_ef_search_floor: 17,
    hnsw_ef_search_ceiling: 823,
    hnsw_iterative_scan_values: ["off", "strict_order", "relaxed_order"],
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

describe("a member reaching Settings, and the retired Connections tab", () => {
  /**
   * ⚠ THE ORIGINAL DEFECT THIS BLOCK PINNED SHIPPED AND WAS FOUND BY THE OPERATOR, NOT BY
   * A TEST — the note is kept because the history is what justifies the current shape.
   *
   * `nav-items.ts` tagged the Settings entry `model_management`, which is Operators-only
   * (`api/features.py:21`), so `visibleNavItems` dropped it for every member — taking the
   * whole connections surface Phases 211-216 shipped with it. The tag was correct when
   * Settings held only model management and stopped being correct when it grew a per-user
   * tab. Nothing failed, because no test had ever rendered this page AS a member.
   *
   * ⚠ THE FIX FOR THAT — an ungoverned rail entry mounting `<SettingsPage initialTab="5" />`
   * — CREATED A SECOND DEFECT, also found by the operator and also invisible here: the pin
   * rendered the whole tab strip anyway, so `Settings` and `Connections` were two rail
   * entries onto ONE page. A member never saw it (their Settings entry vanishes); an
   * operator saw both. Connections now has its own page and this block was rewritten
   * around that, rather than deleted — the member arm below is the assertion that the
   * FIRST defect has not silently come back while fixing the second.
   */
  it("shows Memory and Audit Log to a member, and no Connections tab", async () => {
    renderAsMember()
    expect(await screen.findByRole("tab", { name: /memory/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /audit log/i })).toBeInTheDocument()
    // Connections is a PAGE now (`pages/ConnectionsPage.tsx`), reached from its own
    // ungoverned rail entry — never a tab here, for a member or an operator.
    expect(screen.queryByRole("tab", { name: /connections/i })).toBeNull()
  })

  it("hides the three model_management tabs from a member", async () => {
    renderAsMember()
    await screen.findByRole("tab", { name: /memory/i })
    // ABSENT, never disabled — the sketch-069-A vanish. A locked tab is a control whose
    // every call would 403, which is what Phase 148 rejected.
    expect(screen.queryByRole("tab", { name: /^ai model$/i })).toBeNull()
    expect(screen.queryByRole("tab", { name: /integrations/i })).toBeNull()
  })

  it("does not call GET /settings for a member", async () => {
    // The endpoint carries require_visible("model_management"): calling it would 403,
    // and `if (error && !s)` would turn that into a full-page error.
    renderAsMember()
    await screen.findByRole("tab", { name: /memory/i })
    expect(mockGetSettings).not.toHaveBeenCalled()
  })

  it("shows the model tabs to an operator, and still no Connections tab", async () => {
    renderSettings()
    expect(await screen.findByRole("tab", { name: /^ai model$/i })).toBeInTheDocument()
    // ⚠ THIS IS THE DUPLICATE-DOOR ASSERTION. Before 2026-09-01 an operator saw a
    // Connections tab here AND a Connections rail entry, both landing on this page.
    expect(screen.queryByRole("tab", { name: /connections/i })).toBeNull()
    expect(mockGetSettings).toHaveBeenCalled()
  })

  /**
   * ⚠ A PERSISTED "5" OUTLIVES THE TAB IT NAMED. `settings_active_tab` is localStorage, so
   * anyone who last used Connections still has "5" written down. Without the RETIRED_TABS
   * redirect the Tabs root selects a value with no trigger and no content — a blank panel
   * under a strip marking nothing active, which is the exact failure the pre-existing
   * MODEL_TABS guard exists to prevent, one cause over.
   *
   * ⚠ AND IT MUST FIRE FOR AN OPERATOR TOO, which is why this is asserted on the operator
   * render: the redirect is about a tab that no longer EXISTS, not about permission, so
   * scoping it inside the `!canManageModels` arm would leave every operator who last
   * clicked Connections staring at an empty page.
   */
  it("lands an operator with a persisted Connections tab on Memory, not a blank panel", async () => {
    localStorage.setItem("settings_active_tab", "5")
    renderSettings()
    expect(await screen.findByRole("tab", { name: /memory/i })).toHaveAttribute(
      "aria-selected",
      "true",
    )
  })

  it("lands a member with a persisted Connections tab on Memory", async () => {
    localStorage.setItem("settings_active_tab", "5")
    renderAsMember()
    expect(await screen.findByRole("tab", { name: /memory/i })).toHaveAttribute(
      "aria-selected",
      "true",
    )
  })
})

/**
 * Phase 241 (QUEUE-06 / D-09) — the two HNSW knobs on the shipped Retrieval card.
 *
 * ⚠ EVERY CASE HERE ASSERTS RENDERED CONTENT, NEVER PRESENCE. Phase 235's finding, verbatim:
 * *"a green fence coexisted with the shipped defect, because it asserted block PRESENCE by
 * `data-testid` while the content drifted."* A `getByTestId("hnsw-row")` would pass against a
 * row rendering the wrong bounds, the wrong modes, or nothing at all.
 */
describe("SettingsPage — search breadth and iterative scan (241 / D-09)", () => {
  /**
   * Radix unmounts inactive panels, so opening the tab is a precondition, not decoration.
   *
   * ⚠ THE TAB IS CALLED "Search", NOT "Search & Retrieval" — measured, after this suite first
   * asserted the latter and failed on nine cases at once. `usePlainLabel` resolves
   * `settings.tab.retrieval` and the provider defaults OFF, so the PLAIN word ships and
   * "Search & Retrieval" is the ⌥ Technical-names reveal. The phase's own plan, its CONTEXT and
   * `CLAUDE.md` all name the tab by its technical label; the product does not.
   */
  async function openRetrieval() {
    const tab = await screen.findByRole("tab", { name: /^search$/i })
    await userEvent.click(tab)
    return tab
  }

  it("the fixture's own premise: getSettings serves the five 241 fields", async () => {
    // ⚠ If the mock ever stops carrying these, every case below asserts against defaults.
    const s = await mockGetSettings()
    expect(s.hnsw_ef_search).toBe(40)
    expect(s.hnsw_ef_search_floor).toBe(17)
    expect(s.hnsw_ef_search_ceiling).toBe(823)
    expect(s.hnsw_iterative_scan_values).toEqual(["off", "strict_order", "relaxed_order"])
  })

  it("⛔ the breadth input takes its min/max from the SERVED bounds, owning no copy", async () => {
    // ⭐ THE CASE THAT IS THE REQUIREMENT. The mock serves 17/823 — numbers that appear nowhere
    // in the component, in `config.py` or in migration 176 — so they can only be on screen if
    // the form read them off the settings response.
    renderSettings()
    await openRetrieval()

    const input = await screen.findByLabelText("Search breadth")
    expect(input).toHaveAttribute("min", "17")
    expect(input).toHaveAttribute("max", "823")
  })

  it("hydrates the STORED breadth rather than a hardcoded default", async () => {
    mockGetSettings.mockResolvedValue(mkSettings({ hnsw_ef_search: 512 }))
    renderSettings()
    await openRetrieval()

    const input = await screen.findByLabelText("Search breadth")
    await waitFor(() => expect(input).toHaveValue(512))
  })

  it("states the served bounds on screen, beside the number", async () => {
    renderSettings()
    await openRetrieval()

    await screen.findByLabelText("Search breadth")
    const text = document.body.textContent ?? ""
    expect(text).toContain("17")
    expect(text).toContain("823")
  })

  it("says what a bigger breadth COSTS, matching the API's worded refusal", async () => {
    // A bare number input fails this. The backend 400 names the same cost; the two must agree,
    // or the operator learns the tradeoff only by being refused.
    renderSettings()
    await openRetrieval()

    await screen.findByLabelText("Search breadth")
    const text = document.body.textContent ?? ""
    expect(text).toMatch(/candidate/i)
    expect(text).toMatch(/memory/i)
    expect(text).toMatch(/slower|faster/i)
  })

  it("⛔ renders THREE options by pgvector value — a boolean would drop one", async () => {
    renderSettings()
    await openRetrieval()

    const picker = (await screen.findByLabelText("Keep scanning")) as HTMLSelectElement
    expect(picker.tagName).toBe("SELECT")
    const values = within(picker)
      .getAllByRole("option")
      .map((o) => (o as HTMLOptionElement).value)
    expect(values).toEqual(["off", "strict_order", "relaxed_order"])
  })

  it("renders the options the SERVER lists, not a list of its own", async () => {
    // The strongest form of the "owns no copy" property: serve a different set and watch the
    // picker follow it. An unmapped mode falls back to its raw value rather than vanishing.
    mockGetSettings.mockResolvedValue(
      mkSettings({ hnsw_iterative_scan_values: ["off", "some_future_mode"] }),
    )
    renderSettings()
    await openRetrieval()

    const picker = (await screen.findByLabelText("Keep scanning")) as HTMLSelectElement
    await waitFor(() => {
      const values = within(picker)
        .getAllByRole("option")
        .map((o) => (o as HTMLOptionElement).value)
      expect(values).toEqual(["off", "some_future_mode"])
    })
    expect(within(picker).getByText("some_future_mode")).toBeInTheDocument()
  })

  it("both knobs are visible while hybrid search is OFF — they govern the vector scan", async () => {
    // ⚠ MEASURED FROM THE CODE, not assumed: `search_documents` calls `_vector_search` on the
    // vector-only path too, so a control hidden behind the hybrid toggle would be a control
    // still in effect and out of sight.
    mockGetSettings.mockResolvedValue(mkSettings({ hybrid_search_enabled: false }))
    renderSettings()
    await openRetrieval()

    expect(await screen.findByLabelText("Search breadth")).toBeInTheDocument()
    expect(screen.getByLabelText("Keep scanning")).toBeInTheDocument()
    // And the hybrid-only row really is gone, so this is not a vacuous pass.
    expect(screen.queryByText(/RRF-K constant/i)).toBeNull()
  })

  it("Save Search Settings carries both keys on the payload the tab already sends", async () => {
    renderSettings()
    await openRetrieval()

    const picker = await screen.findByLabelText("Keep scanning")
    await userEvent.selectOptions(picker, "relaxed_order")
    await userEvent.click(screen.getByRole("button", { name: /save search settings/i }))

    await waitFor(() => expect(mockUpdateSettings).toHaveBeenCalled())
    const body = mockUpdateSettings.mock.calls[0][0]
    expect(body).toHaveProperty("hnsw_ef_search", 40)
    expect(body).toHaveProperty("hnsw_iterative_scan", "relaxed_order")
  })

  it("⛔ surfaces the SERVER's refusal verbatim rather than clamping it away", async () => {
    const REFUSAL =
      "Search breadth must be between 17 and 823. It is how many candidate vectors the index " +
      "walks before your filters are applied."
    mockUpdateSettings.mockRejectedValueOnce(new Error(REFUSAL))

    renderSettings()
    await openRetrieval()

    await screen.findByLabelText("Search breadth")
    await userEvent.click(screen.getByRole("button", { name: /save search settings/i }))

    expect(
      await screen.findByText(new RegExp("must be between 17 and 823", "i")),
    ).toBeInTheDocument()
  })
})

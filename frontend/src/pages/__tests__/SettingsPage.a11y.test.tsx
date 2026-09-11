/**
 * Phase 155 Plan 06 Task 3 — SettingsPage a11y contract (154 surface, WCAG 2.1 AA).
 *
 * The Settings "Show technical names" toggle row + the relabeled tabs are net-new v3.3
 * surfaces (LANG-01 / Surface D + SC#3). This suite locks the D-01 zero-STRUCTURAL-
 * violations bar and asserts the D-09 scenario-4 contract the live keyboard drive needs:
 *   - the "Show technical names" reveal control is reachable by role + accessible name
 *     and exposes its pressed state;
 *   - the relabeled tabs keep their tablist / tab roles with accessible names.
 *
 * ASSERT-REAL-CONTRACT (critical rule, mirrors 155-04): the reveal control is a toggle
 * BUTTON exposing `aria-pressed` (the shipped `TechnicalNamesToggle`), NOT a
 * `role="switch"`. The suite asserts the ACTUAL shipped contract.
 *
 * SettingsPage consumes `useTechnicalNames()` (throws outside its provider), so the
 * render is wrapped in <TechnicalNamesProvider> via the SettingsPage.test renderSettings
 * idiom. MemorySection / ReembedStatusCard fire their own effects — stubbed to null so
 * the tab renders without network noise. STRUCTURAL axe rules only (no contrast).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, cleanup } from "@testing-library/react"
import { axe } from "vitest-axe"
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

vi.mock("@/components/settings/MemorySection", () => ({ MemorySection: () => null }))
vi.mock("@/components/settings/ReembedStatusCard", () => ({ ReembedStatusCard: () => null }))

import { SettingsPage } from "../SettingsPage"
import { TechnicalNamesProvider } from "@/providers/TechnicalNamesProvider"
import { EffectiveFeaturesProvider } from "@/providers/EffectiveFeaturesProvider"

/**
 * ⚠⚠ REPAIRED 2026-09-11 (Phase 242). THIS SUITE WAS RED — all four cases — AND NOBODY COULD SEE
 * IT, because it sits in NEITHER knob of `scripts/vitest-count-gate.cjs` and `src/pages` is not a
 * directory entry there. It has therefore never run under the gate. Phase 242 adopts it, which
 * meant first finding out why it was failing.
 *
 * ⛔ THE CAUSE WAS THIS FUNCTION, NOT THE PAGE. `EffectiveFeaturesProvider` was missing, and
 * `SettingsPage` renders the AI Model / Search / Integrations tabs ONLY when the effective-features
 * map resolves `model_management` true — a NULL context is fail-closed by the contract `App.tsx`
 * states at its provider mount. So every case rendered a page with no AI Model tab, and all four
 * failed on `Unable to find role="button" and name /technical names/i` — an ABSENCE, never a
 * defect in the control they were written to audit.
 *
 * `SettingsPage.test.tsx`'s own render helper already carried this provider and says so in a
 * comment: *"THE PROVIDER IS NOT DECORATION — IT IS THE PRECONDITION FOR THE TAB UNDER TEST."*
 * The sibling suite simply never got it.
 *
 * ⚠ Proven inherited before it was touched: the four failures reproduce identically with Phase
 * 242's `SettingsPage.tsx` stashed away, at the phase's base commit.
 */
function renderSettings() {
  return render(
    <EffectiveFeaturesProvider value={{ features: { model_management: true }, loading: false, refetch: () => {} }}>
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
    // SEED-258 — same rule as the two lines above: the response requires them, so the
    // fixture states them rather than letting a default hide a field.
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
    // Phase 241 (QUEUE-06 / D-09) — same rule as SEED-258 above: the response requires them,
    // so the fixture states them rather than letting a default hide a field the API forgot.
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

beforeEach(() => {
  localStorage.setItem("settings_active_tab", "0") // AI Model tab — hosts the toggle
  // Radix selects/dropdowns use pointer-capture APIs jsdom lacks — stub defensively.
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {}
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
  mockGetSettings.mockResolvedValue(mkSettings())
  mockUpdateSettings.mockImplementation(async () => mkSettings())
  mockGetReembedProgress.mockResolvedValue({ status: "idle" })
  mockGetAuditLogs.mockResolvedValue({ entries: [], total: 0 })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("SettingsPage a11y — WCAG 2.1 AA (structural), net-new 154 surfaces", () => {
  // D-12 net-new inventory for 154 = the "Show technical names" toggle ROW + the
  // relabeled TABS — NOT the entire AI-Model expert-config form. Scanning the whole
  // page pulls in PRE-EXISTING expert-config controls (the rerank + openrouter
  // tool-strategy <select>s lack accessible names → `select-name`; the SectionCard
  // heading levels → `heading-order`) that predate v3.3 and sit OUTSIDE the D-06
  // scope line — logged to SEED-092-remainder, explicitly NOT fixed in this test-only
  // plan. The scan is therefore SCOPED to the two net-new 154 surfaces.
  it("no aXe structural violations — the 'Show technical names' toggle row", async () => {
    renderSettings()
    const toggle = await screen.findByRole("button", { name: /technical names/i })
    // The toggle button's parent is the net-new reveal row (label + description + control).
    const row = toggle.parentElement as HTMLElement
    expect(await axe(row)).toHaveNoViolations()
  })

  it("no aXe structural violations — the relabeled tablist", async () => {
    renderSettings()
    await screen.findByRole("button", { name: /technical names/i })
    const tablist = await screen.findByRole("tablist")
    expect(await axe(tablist)).toHaveNoViolations()
  })
})

describe("SettingsPage a11y — D-09 scenario-4 'Show technical names' reveal control", () => {
  it("the reveal control is a named toggle BUTTON exposing aria-pressed (real contract, not role=switch)", async () => {
    renderSettings()
    // ASSERT-REAL-CONTRACT: TechnicalNamesToggle ships as a <button aria-pressed>, the
    // ⌥ glyph aria-hidden → accessible name "Technical names". NOT a role=switch.
    const toggle = await screen.findByRole("button", { name: /technical names/i })
    expect(toggle.tagName).toBe("BUTTON")
    expect(toggle).toHaveAttribute("aria-pressed")
    // Its descriptive row label reads as WORDS (never an unlabeled control).
    expect(screen.getByText("Show technical names")).toBeInTheDocument()
    // No role=switch masquerade — the shipped control is a toggle button.
    expect(screen.queryByRole("switch", { name: /technical names/i })).not.toBeInTheDocument()
  })
})

describe("SettingsPage a11y — relabeled tabs keep tablist/tab roles + names", () => {
  it("the tabs render as a tablist with named tabs (Search is the plain default of the relabel)", async () => {
    renderSettings()
    await screen.findByRole("button", { name: /technical names/i })
    await waitFor(() => expect(screen.getByRole("tablist")).toBeInTheDocument())

    // Each relabeled tab keeps its role=tab + an accessible name.
    expect(screen.getByRole("tab", { name: "AI Model" })).toBeInTheDocument()
    // D-04 relabel: "Search & Retrieval" → plain "Search" by default (reveal OFF).
    expect(screen.getByRole("tab", { name: "Search" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Integrations" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Memory" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Audit Log" })).toBeInTheDocument()
  })
})

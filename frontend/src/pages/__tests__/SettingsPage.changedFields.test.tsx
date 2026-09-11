/**
 * Phase 242 (SHIP-01, ROADMAP SC#1 + SC#2, D-242-02) — the Search tab sends only what CHANGED.
 *
 * ⛔ WHAT THIS IS ABOUT. `handleSaveSearch` used to send all 24 Search fields on every save, so ONE
 * stored value out of range refused the ENTIRE tab. The operator's install held
 * `multimodal_max_vision_calls = 1001` — a value they never typed — and every Search save failed
 * with a sentence about images while they were editing a retrieval threshold. The reranker, the
 * embedding model, `rrf_k` and (since Phase 241 D-09) `hnsw_ef_search` all rode the same payload,
 * so all of them were unsaveable too.
 *
 * ⛔ AND THE DIRECTION THAT MATTERS IS THE OTHER ONE. A diff can also DROP a real edit: if the
 * baseline disagrees with what `hydrate` actually put in the fields, an edit looks unchanged and is
 * never sent — a save that reports success and changes nothing, which is Phase 240's "screen that
 * discards its own answer". §1 and §2b are the fences against exactly that, and §1 runs against TWO
 * fixtures on purpose:
 *
 *   ⚠⚠ WITH ONLY THE ALL-NULL FIXTURE, A HARD-CODED BASELINE WOULD PASS. Writing
 *      `hnsw_ef_search: 40` as a constant in `searchPayloadFrom` (matching the `useState(40)`)
 *      instead of `data.hnsw_ef_search ?? 40` is green against a NULL column — and in production,
 *      where the column holds 200, an operator dragging it back to the default 40 has their edit
 *      silently discarded. `NON_DEFAULT` below is the fixture that separates "mirrors hydrate" from
 *      "returns the constants hydrate's fallbacks happen to produce".
 *
 * ⚠ EVERY CASE ASSERTS THE WIRE PAYLOAD — the argument `updateSettings` was called with — never a
 * banner, a colour or a toast. `241-HUMAN-UAT.md` row 3: *"presence of an error is not evidence of
 * the RIGHT error."*
 *
 * Mirrors the `SettingsPage.sourceCeiling.test.tsx` api-mock idiom.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { FullAppSettings, SettingsUpdate } from "@/lib/api"
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
import { searchPayloadFrom, onlyChanged, searchBodyFor } from "../settingsSearchPayload"

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
    ...overrides,
  } as unknown as FullAppSettings
}

/**
 * FIXTURE A — every nullable/defaulted column NULL. This is the shape a naive diff against the raw
 * settings object gets wrong (it would mark `vision_model` "changed" on every single save).
 */
const ALL_NULL = () =>
  mkSettings({
    vision_model: null,
    vision_max_pages: null,
    hnsw_ef_search: null,
    hnsw_iterative_scan: null,
    extraction_model: null,
    extraction_provider: null,
    embedding_provider: null,
  } as unknown as Partial<FullAppSettings>)

/**
 * FIXTURE B — every one of those columns holding a distinctive NON-DEFAULT value.
 *
 * ⚠⚠ THIS FIXTURE IS THE POINT OF §1. Against FIXTURE A alone, a baseline built from hard-coded
 * constants is indistinguishable from one derived from the data, because the constants ARE what
 * hydrate's `??` fallbacks produce. Here every value differs from the fallback, so only a
 * data-derived baseline yields `{}`.
 */
const NON_DEFAULT = () =>
  mkSettings({
    // ⚠⚠ EVERY ONE OF THE 24 PAYLOAD KEYS DIFFERS FROM ITS `useState` INITIAL. That is the
    // whole contract of this fixture, and the first version of it did NOT hold: nine keys
    // (`embedding_base_url` "", `rerank_enabled` false, `rerank_provider` "api", `rerank_model` "",
    // `rerank_top_n` 5, `retrieval_match_threshold` 0.3, `hybrid_search_enabled` true,
    // `vector_search_weight` 1, `keyword_search_weight` 1) held exactly their useState initials,
    // so a HARD-CODED baseline for any of them would have been green against every case in this
    // file — the very defect the ⚠⚠ block at the top describes for `hnsw_ef_search`.
    // ⛔ `retrieval_match_threshold: 0.3` was the dangerous one: 0.3 is also the most likely value
    //    an operator drags the threshold BACK to, so a constant baseline would silently discard it.
    // Found by this phase's code review. A 25th key added to `hydrate` / `full` /
    // `searchPayloadFrom` but not here is UNPROVEN, however green this suite looks.
    embedding_model: "text-embedding-3-large",     // useState ""
    embedding_base_url: "https://example.invalid/v1", // useState ""
    embedding_dimensions: 3072,                    // useState 1536
    embedding_provider: "google",                  // useState "openai"
    extraction_provider: "ollama",                 // useState "openai"
    extraction_model: "some-other-extractor",      // useState "" / preset
    rerank_enabled: true,                          // useState false
    rerank_provider: "cohere",                     // useState "api"
    rerank_model: "rerank-3.5",                    // useState ""
    rerank_top_n: 11,                              // useState 5
    multimodal_max_vision_calls: 1001,             // useState 100
    vision_model: "gpt-4o",                        // useState ""
    vision_max_pages: 123,                         // useState 50 (hydrate fallback)
    retrieval_top_k: 7,                            // useState 5
    retrieval_match_threshold: 0.47,               // useState 0.3  ← the dangerous one
    hybrid_search_enabled: false,                  // useState true
    hybrid_candidate_count: 33,                    // useState 20
    vector_search_weight: 0.6,                     // useState 1.0
    keyword_search_weight: 0.4,                    // useState 1.0
    rrf_k: 42,                                     // useState 60
    hnsw_ef_search: 200,                           // useState 40
    hnsw_iterative_scan: "relaxed_order",          // useState "off"
    // The two API keys are covered by §4 rather than by a value here: their baseline is
    // KEY_PLACEHOLDER on both sides by construction, so no fixture value can distinguish them.
  })

function renderSettings(features: Record<string, boolean> = { model_management: true }) {
  return render(
    <EffectiveFeaturesProvider value={{ features, loading: false, refetch: () => {} }}>
      <TechnicalNamesProvider>
        <SettingsPage />
      </TechnicalNamesProvider>
    </EffectiveFeaturesProvider>,
  )
}

/** ⚠ The tab is called "Search", not "Search & Retrieval" — the plain label ships. */
async function openSearch() {
  const tab = await screen.findByRole("tab", { name: /^search$/i })
  await userEvent.click(tab)
  return tab
}

/**
 * Find the input inside a `FieldRow` by its label text.
 *
 * ⚠ MEASURED, not precautionary: `FieldRow` (`SettingsPage.tsx:98-105`) renders a bare `<Label>`
 * with no `htmlFor` and no `aria-labelledby`, so `getByLabelText("RRF-K constant")` finds the label
 * and then throws *"no form control was found associated to that label"*. Only "Search breadth" and
 * "Keep scanning" carry an explicit aria-label. ⭐ That is an accessibility gap on this tab and it
 * is recorded in the phase SUMMARY rather than silently worked around here — this helper exists so
 * this phase's fences are about the PAYLOAD, not about a label association it did not cause.
 */
function fieldInput(label: string): HTMLInputElement {
  const labelEl = screen.getByText(label)
  const row = labelEl.parentElement
  const input = row?.querySelector("input")
  if (!input) throw new Error(`no input inside the FieldRow labelled "${label}"`)
  return input as HTMLInputElement
}

async function saveSearch() {
  await userEvent.click(screen.getByRole("button", { name: /save search settings/i }))
  await waitFor(() => expect(mockUpdateSettings).toHaveBeenCalled())
  return mockUpdateSettings.mock.calls[0][0] as SettingsUpdate
}

beforeEach(() => {
  vi.clearAllMocks()
  // `handleTabChange` persists the selection to localStorage and jsdom keeps it for the whole
  // file, so without this a later case mounts on a tab an earlier case chose.
  localStorage.clear()
  mockGetSettings.mockResolvedValue(mkSettings())
  mockUpdateSettings.mockResolvedValue(mkSettings())
  mockGetReembedProgress.mockResolvedValue(null)
  mockGetAuditLogs.mockResolvedValue({ logs: [], total: 0 })
})

afterEach(() => cleanup())

// ══════════════════════════════════════════════════════════════════════════════════════════════
// UNIT — the two exported helpers, driven directly. Cheaper and stronger than the DOM for the
// properties that are about the FUNCTIONS rather than about the page.
// ══════════════════════════════════════════════════════════════════════════════════════════════
describe("onlyChanged — the diff itself", () => {
  it("drops a key whose value equals the baseline and keeps one that differs", () => {
    const base = { rrf_k: 60, retrieval_top_k: 10 } as unknown as SettingsUpdate
    const next = { rrf_k: 42, retrieval_top_k: 10 } as unknown as SettingsUpdate
    expect(onlyChanged(next, base)).toEqual({ rrf_k: 42 })
  })

  it("returns {} when nothing differs", () => {
    const base = { rrf_k: 60 } as unknown as SettingsUpdate
    expect(onlyChanged({ rrf_k: 60 } as unknown as SettingsUpdate, base)).toEqual({})
  })

  it("⛔ SENDS a key the baseline does not mention at all — it iterates the PAYLOAD, not the baseline", () => {
    // ⚠ THE DIRECTION IS LOAD-BEARING. Iterating the baseline instead would mean a key added to
    // the payload but forgotten in `searchPayloadFrom` is dropped FOREVER and silently. This way
    // the failure is a harmless extra field on the wire.
    const base = { rrf_k: 60 } as unknown as SettingsUpdate
    const next = { rrf_k: 60, brand_new_field: "x" } as unknown as SettingsUpdate
    expect(onlyChanged(next, base)).toEqual({ brand_new_field: "x" })
  })

  it("an edit BACK TO the value a default would produce is still a change when the store differs", () => {
    // The §2b property, as a unit: stored 200, operator sets 40. 40 !== 200, so it travels.
    const base = { hnsw_ef_search: 200 } as unknown as SettingsUpdate
    const next = { hnsw_ef_search: 40 } as unknown as SettingsUpdate
    expect(onlyChanged(next, base)).toEqual({ hnsw_ef_search: 40 })
  })
})

describe("searchPayloadFrom — the baseline MIRRORS hydrate, on both fixtures", () => {
  it("⛔ FIXTURE B: every nullable column's baseline is the STORED value, not the fallback constant", () => {
    // ⚠⚠ This is the case that catches a hard-coded baseline. If `searchPayloadFrom` returned the
    // `??` fallbacks (40 / "off" / 50 / ""), every expectation here would be wrong.
    const b = searchPayloadFrom(NON_DEFAULT())
    expect(b.hnsw_ef_search).toBe(200)
    expect(b.hnsw_iterative_scan).toBe("relaxed_order")
    expect(b.vision_max_pages).toBe(123)
    expect(b.vision_model).toBe("gpt-4o")
    expect(b.extraction_model).toBe("some-other-extractor")
    expect(b.extraction_provider).toBe("ollama")
    expect(b.embedding_provider).toBe("google")
    expect(b.multimodal_max_vision_calls).toBe(1001)
  })

  it("FIXTURE A: a NULL column's baseline is hydrate's fallback, so an untouched field is not 'changed'", () => {
    const b = searchPayloadFrom(ALL_NULL())
    expect(b.hnsw_ef_search).toBe(40)
    expect(b.hnsw_iterative_scan).toBe("off")
    expect(b.vision_max_pages).toBe(50)
    expect(b.vision_model).toBe("")
    expect(b.extraction_provider).toBe("openai")
    expect(b.embedding_provider).toBe("openai")
  })

  it("both API keys are baselined as the keep-existing placeholder, on both fixtures", () => {
    for (const f of [ALL_NULL(), NON_DEFAULT()]) {
      const b = searchPayloadFrom(f)
      expect(b.embedding_api_key).toBe("***")
      expect(b.rerank_api_key).toBe("***")
    }
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════════
// THE PAGE — driven through the real Save button.
// ══════════════════════════════════════════════════════════════════════════════════════════════
describe("§1 — a save with NO edits sends {}", () => {
  it("FIXTURE A (all nullable columns NULL)", async () => {
    mockGetSettings.mockResolvedValue(ALL_NULL())
    renderSettings()
    await openSearch()
    await screen.findByLabelText("Search breadth")
    expect(await saveSearch()).toEqual({})
  })

  it("⛔ FIXTURE B (every nullable column holding a NON-DEFAULT value)", async () => {
    // ⚠⚠ THE MOST IMPORTANT CASE IN THIS FILE. One assertion checks all 24 baselines against all
    // 24 hydrated states at once — any field whose baseline disagrees with what `hydrate` set
    // appears here as a stray key. And unlike FIXTURE A, a baseline of hard-coded constants CANNOT
    // pass this.
    mockGetSettings.mockResolvedValue(NON_DEFAULT())
    renderSettings()
    await openSearch()
    await screen.findByLabelText("Search breadth")
    expect(await saveSearch()).toEqual({})
  })
})

describe("§2 — one edit, one key", () => {
  it("changing RRF-K sends exactly { rrf_k }", async () => {
    renderSettings()
    await openSearch()
    await screen.findByLabelText("Search breadth")
    const input = fieldInput("RRF-K constant")
    await userEvent.clear(input)
    await userEvent.type(input, "42")
    // ⚠ An EQUALITY on the whole object, not toMatchObject — a superset assertion would pass over
    // the very bug this phase fixes.
    expect(await saveSearch()).toEqual({ rrf_k: 42 })
  })
})

describe("§2b — an edit from a stored NON-DEFAULT value TO the default still travels", () => {
  it("⛔ stored hnsw_ef_search 200, operator sets 40 → the body carries it", async () => {
    // ⚠⚠ THE SILENT-DROP CASE, on the field Phase 246's remedy is delivered on. A baseline built
    // from the `useState(40)` constant rather than from the data would compare 40 to 40, drop the
    // key, report success, and leave the database holding 200.
    mockGetSettings.mockResolvedValue(NON_DEFAULT())
    renderSettings()
    await openSearch()
    const input = await screen.findByLabelText("Search breadth")
    await userEvent.clear(input)
    await userEvent.type(input, "40")
    expect(await saveSearch()).toEqual({ hnsw_ef_search: 40 })
  })
})

describe("§3 — the field that caused the outage can no longer ride along", () => {
  it("⭐ stored multimodal_max_vision_calls = 1001; editing RRF-K does NOT carry it", async () => {
    // This is SHIP-01 in one case: the save the operator could not perform.
    mockGetSettings.mockResolvedValue(mkSettings({ multimodal_max_vision_calls: 1001 }))
    renderSettings()
    await openSearch()
    await screen.findByLabelText("Search breadth")
    const input = fieldInput("RRF-K constant")
    await userEvent.clear(input)
    await userEvent.type(input, "42")
    const body = await saveSearch()
    expect(body).not.toHaveProperty("multimodal_max_vision_calls")
    expect(body).toEqual({ rrf_k: 42 })
  })
})

describe("§4 — an untouched API key does not ride, an entered one does", () => {
  it("a save that changes only RRF-K carries neither key", async () => {
    renderSettings()
    await openSearch()
    await screen.findByLabelText("Search breadth")
    const input = fieldInput("RRF-K constant")
    await userEvent.clear(input)
    await userEvent.type(input, "42")
    const body = await saveSearch()
    expect(body).not.toHaveProperty("embedding_api_key")
    expect(body).not.toHaveProperty("rerank_api_key")
  })

  it("the mirror: `onlyChanged` keeps a key the operator actually typed", () => {
    // Driven as a unit — the key inputs are masked-reveal components whose DOM interaction is
    // covered elsewhere; what this phase changed is the DIFF, and this is the diff.
    const base = searchPayloadFrom(mkSettings())
    const next = { ...base, embedding_api_key: "sk-a-real-key" }
    expect(onlyChanged(next, base)).toEqual({ embedding_api_key: "sk-a-real-key" })
  })
})

describe("§5 — the offending field, when the operator edits it themselves", () => {
  it("an out-of-range value the operator typed IS sent, so the API can refuse it", async () => {
    // ⚠ The bound lives at the API boundary and the refusal carries the cost sentence. Clamping
    // here would hide a refusal the operator should read (the SEED-258 rule, applied).
    renderSettings()
    await openSearch()
    await screen.findByLabelText("Search breadth")
    const input = fieldInput("Images read per document")
    await userEvent.clear(input)
    await userEvent.type(input, "2000")
    const body = await saveSearch()
    expect(body).toHaveProperty("multimodal_max_vision_calls", 2000)
  })
})

describe("§6 — the re-embed confirm gate still sees its change", () => {
  it("an embedding-model edit opens the modal, and the committed body carries the model", async () => {
    // ⚠ The gate reads `s`, not the baseline. This case proves the two did not get crossed.
    renderSettings()
    await openSearch()
    await screen.findByLabelText("Search breadth")
    // ⚠ The embedding model lives inside `ProviderPicker` (`SettingsPage.tsx:1517`), behind its
    // "Advanced overrides" disclosure, as a bare input with `placeholder="model id"`. TWO pickers
    // render on this tab — embedding first, extraction second — so index 0 is the one under test.
    await userEvent.click(screen.getAllByRole("button", { name: /advanced overrides/i })[0])
    const modelInput = screen.getAllByPlaceholderText("model id")[0]
    await userEvent.clear(modelInput)
    await userEvent.type(modelInput, "text-embedding-3-large")
    await userEvent.click(screen.getByRole("button", { name: /save search settings/i }))

    // The modal intercepts: nothing has been sent yet. ⚠ Its role is `alertdialog`, not
    // `dialog` — measured, after this case first asked for the latter and could not find it.
    await waitFor(() => expect(screen.getByRole("alertdialog")).toBeInTheDocument())
    expect(mockUpdateSettings).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole("button", { name: /re-embed now/i }))

    await waitFor(() => expect(mockUpdateSettings).toHaveBeenCalled())
    const body = mockUpdateSettings.mock.calls[0][0] as SettingsUpdate
    expect(body).toHaveProperty("embedding_model", "text-embedding-3-large")
  })
})

describe("§7 — an unknown baseline is NOT collapsed into 'nothing changed'", () => {
  it("a null baseline sends the full payload", () => {
    // ⚠ Driven as a unit, and that is not a shortcut: making `getSettings` reject leaves
    // `s === null` and the page renders its full-page error branch, so there is no Save button and
    // `handleSaveSearch` is unreachable. The property is about the fallback, and the fallback is
    // `searchBaseline ? onlyChanged(full, searchBaseline) : full`.
    // ⭐ Calls `searchBodyFor` — the SAME function `handleSaveSearch` calls — rather than
    // restating `baseline ? onlyChanged(...) : full`. An earlier version restated it, and would
    // have stayed green if the component's fallback were changed to `{}`.
    const full = searchPayloadFrom(NON_DEFAULT())
    const body = searchBodyFor(full, null)
    expect(Object.keys(body).length).toBe(24)
    expect(body).toEqual(full)
  })
})

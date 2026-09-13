/**
 * Phase 242 (SHIP-01 / D-242-02) — THE SEARCH TAB SENDS ONLY WHAT CHANGED.
 *
 * ⛔ WHY, AND IT IS NOT TIDINESS. `handleSaveSearch` used to send all 24 Search fields on every
 *    save, so ONE stored value out of range refused the ENTIRE tab — the reranker, the embedding
 *    model, the retrieval threshold, `rrf_k`, and (since Phase 241 D-09) `hnsw_ef_search`, the knob
 *    Phase 246's whole remedy is delivered on. The operator's install held
 *    `multimodal_max_vision_calls = 1001`, a value they never typed, and every Search save failed
 *    with a sentence about images while they were editing a threshold.
 *    Reporting every failing field at once would only make that LEGIBLE. Sending only what changed
 *    makes it IMPOSSIBLE, and unblocks Phase 246 permanently.
 *
 * ⛔ THE DANGEROUS DIRECTION IS A SILENT DROP, NOT A SPURIOUS SEND. If the baseline disagrees with
 *    what `hydrate` actually put in the fields, a REAL edit looks unchanged and is never sent — a
 *    save that reports success and changes nothing, which is Phase 240's "screen that discards its
 *    own answer". The fences live in `pages/__tests__/SettingsPage.changedFields.test.tsx`.
 *
 * ⚠ WHY THIS IS ITS OWN MODULE RATHER THAN THREE EXPORTS FROM `SettingsPage.tsx`.
 *   It was written there first. Exporting non-components from a component file trips
 *   `react-refresh/only-export-components` and **breaks Fast Refresh for a 1,858-line form page** —
 *   measured at this phase's code review: two new lint errors on a file that had zero, and
 *   `npm run lint` is not gated in CI (only `lint:a11y` is), so nothing would have caught it.
 */
import type { FullAppSettings, SettingsUpdate } from "@/lib/api"
import { EXTRACTION_PRESETS } from "@/components/settings/ProviderPicker"

/** "***" means KEEP THE EXISTING KEY. `save_app_settings` skips it outright. */
export const KEY_PLACEHOLDER = "***"

/**
 * The Search tab's payload as it stands the instant `hydrate(data)` finishes — the baseline the
 * save diffs against.
 *
 * ⚠⚠ THIS MUST MIRROR `SettingsPage.tsx`'s `hydrate` EXACTLY, expression for expression. It is a
 * separate function rather than a capture of the state because the state is 24 separate
 * `useState`s.
 *
 * ⚠ THE FENCES PROVE NON-DRIFT ONLY AS WIDE AS THEIR FIXTURES. A field whose fixture value happens
 * to equal its `useState` initial is invisible to the no-edit-sends-`{}` case, because a hard-coded
 * baseline would produce the same number. `FIXTURE_B` in the test file therefore holds a value
 * DIFFERENT FROM THE useState INITIAL for **every one of the 24 keys**, and a comment there says
 * so. Adding a 25th key means adding it to `hydrate`, to `full`, to this function AND to that
 * fixture — the first three alone leave the new key unproven.
 *
 * The two API-key fields are `KEY_PLACEHOLDER` on BOTH sides deliberately: `***` means "keep the
 * existing key" and `save_app_settings` (`backend/app/models/user_settings.py:542`) skips it
 * outright, so dropping an untouched key changes nothing at the database and simply stops it
 * riding the wire.
 */
export function searchPayloadFrom(data: FullAppSettings): SettingsUpdate {
  const exProvider = data.extraction_provider || "openai"
  const exPreset = EXTRACTION_PRESETS.find((p) => p.key === exProvider)
  return {
    embedding_model: data.embedding_model,
    embedding_api_key: KEY_PLACEHOLDER,
    embedding_base_url: data.embedding_base_url,
    embedding_dimensions: data.embedding_dimensions,
    embedding_provider: data.embedding_provider || "openai",
    extraction_provider: exProvider,
    extraction_model: data.extraction_model || exPreset?.model || "",
    rerank_enabled: data.rerank_enabled,
    rerank_provider: data.rerank_provider,
    rerank_api_key: KEY_PLACEHOLDER,
    rerank_model: data.rerank_model,
    rerank_top_n: data.rerank_top_n,
    multimodal_max_vision_calls: data.multimodal_max_vision_calls,
    vision_model: data.vision_model ?? "",
    vision_max_pages: data.vision_max_pages ?? 50,
    retrieval_top_k: data.retrieval_top_k,
    retrieval_match_threshold: data.retrieval_match_threshold,
    hybrid_search_enabled: data.hybrid_search_enabled,
    hybrid_candidate_count: data.hybrid_candidate_count,
    vector_search_weight: data.vector_search_weight,
    keyword_search_weight: data.keyword_search_weight,
    rrf_k: data.rrf_k,
    hnsw_ef_search: data.hnsw_ef_search ?? 40,
    hnsw_iterative_scan: data.hnsw_iterative_scan ?? "off",
  }
}

/**
 * Keep only the keys whose value differs from the baseline.
 *
 * ⚠ ITERATES `Object.keys(next)`, NOT the baseline — and that direction is load-bearing. Iterating
 * the baseline would mean a key added to the payload but forgotten in `searchPayloadFrom` is
 * DROPPED FOREVER AND SILENTLY. This way it is simply always sent, which is the safe failure.
 *
 * ⚠ `Object.is`, not `===`, and the real reason is NOT the one you might expect: `Object.is` does
 * NOT rescue a `NaN` from an emptied number input, because the baseline is always a real number
 * and `Object.is(NaN, 100)` is `false` — so a transient `NaN` is sent either way. The single
 * behavioural difference is `+0` / `-0`, where `Object.is` SENDS and `===` would drop. Sending is
 * the safe direction, so `Object.is` it is.
 */
export function onlyChanged(next: SettingsUpdate, baseline: SettingsUpdate): SettingsUpdate {
  const out: Record<string, unknown> = {}
  const base = baseline as unknown as Record<string, unknown>
  for (const [key, value] of Object.entries(next as unknown as Record<string, unknown>)) {
    if (!Object.is(value, base[key])) out[key] = value
  }
  return out as SettingsUpdate
}

/**
 * What the Search tab actually PUTs.
 *
 * ⚠ A `null` baseline means "settings were never loaded", which is NOT "nothing changed" — the full
 * payload goes. ⭐ This wrapper exists so the test can drive the REAL decision instead of
 * re-implementing it: an earlier version of §7 restated `baseline ? … : full` in the test, which
 * would have stayed green if the component's fallback were changed to `{}`.
 */
export function searchBodyFor(
  full: SettingsUpdate,
  baseline: SettingsUpdate | null,
): SettingsUpdate {
  return baseline ? onlyChanged(full, baseline) : full
}

/**
 * Phase 123 Plan 05 Task 2a (TRIG-01) — ProviderScoreboard (sketch 042-A, NO ANALOG).
 *
 * The load-bearing, no-analog render: an N-COLUMN per-provider grid where N = the
 * org's CONFIGURED targets (NOT a fixed four). Two hard rules from the 042-A
 * provider-set adaptivity band:
 *
 *   1. A provider the org doesn't run NEVER renders — a score you can't act on is a
 *      fabricated measurement (honesty-is-load-bearing). The grid is driven purely by
 *      the cells the server returned.
 *   2. N=1 (single-provider) is the CLEAN BASELINE, not a degraded mode — one column,
 *      no "degraded"/"missing" affordance; OpenRouter is a DISTINCT column from native
 *      DeepSeek / GLM (zhipu/z-ai) / Kimi (moonshot) / MiniMax when both are targets.
 *
 * EVERY cell shows BOTH sub-scores (never a hidden aggregate / hover-only): `fires` =
 * should-trigger recall · `no-false` = should-NOT precision (the false-fire rail). The
 * cell shape mirrors the server's `score_forced_emit_axes` output — the UI renders
 * server-computed scores only (no client-side fabrication, T-123-05-01).
 *
 * Stub scaffolding placeholder — implemented to GREEN in Task 2a (TDD).
 */
import type { TunerCell } from "@/lib/api"

interface Props {
  /** The per-provider cells the server returned for ONE candidate. The column set
   *  is derived from these — a non-target provider simply isn't in the list. */
  cells: TunerCell[]
}

export function ProviderScoreboard({ cells: _cells }: Props) {
  return null
}

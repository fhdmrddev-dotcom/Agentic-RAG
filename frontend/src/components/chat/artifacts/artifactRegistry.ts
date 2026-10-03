/**
 * Phase 273-02 (I-1 · SC#4 · T-273-10) — THE CLOSED ARTIFACT REGISTRY: exactly three components.
 *
 * `chart` → the lazy ChartArtifact chunk · `table` → TableArtifact · `metric` → MetricArtifact.
 *
 * ⛔ I-1: this is CLOSED CODE. Adding a component is a code change here, in `artifactSpec.ts` and in
 * the backend's `ComponentName` Literal (fenced together by 273-05's `?raw` parity test) — never a
 * prompt, a setting or a database row. Nothing at runtime can add an entry.
 *
 * The lookup goes through `own()` from `components/workflows/ownProperty.ts`, the tree's one
 * prototype-key guard. A plain object literal inherits members such as `constructor` and `toString`,
 * so a payload naming one of them must resolve to NOTHING rather than to an inherited function. A
 * miss returns `null`, which `ArtifactBlock` renders as the `unknown-component` notice. (The unsafe
 * indexed-and-coalesced form is deliberately not spelled in this docblock, per `lib/toolNames.ts`.)
 *
 * The chart is lazy so recharts stays out of the chat chunk (`FoundPerWeekSparkline.tsx`
 * precedent). If its chunk fails to load, the lazy component resolves to `ChartUnavailable`, which
 * throws an `ArtifactNoticeError("chart-unavailable")` that the per-artifact boundary turns into the
 * worded notice — the slot never shows a raw loader error.
 */
import { lazy, type ComponentType } from "react"
import { own } from "@/components/workflows/ownProperty"
import { ARTIFACT_COMPONENT_NAMES, ArtifactNoticeError, type ArtifactBodyProps } from "./artifactSpec"
import { MetricArtifact } from "./MetricArtifact"
import { TableArtifact } from "./TableArtifact"

export type ArtifactRenderer = ComponentType<ArtifactBodyProps>

type ChartModule = { default: ArtifactRenderer }

function ChartUnavailable(): never {
  throw new ArtifactNoticeError("chart-unavailable")
}

/** Build the lazy chart from a loader; a rejected load becomes the chart-unavailable notice. */
export function lazyChartFrom(load: () => Promise<ChartModule>) {
  return lazy(() => load().catch((): ChartModule => ({ default: ChartUnavailable })))
}

const ChartArtifactLazy = lazyChartFrom(() => import("./ChartArtifact"))

const REGISTRY: Record<string, ArtifactRenderer> = {
  chart: ChartArtifactLazy,
  table: TableArtifact,
  metric: MetricArtifact,
}

/** The closed component list — fenced against the backend Literal in 273-05. */
export const ARTIFACT_COMPONENTS = ARTIFACT_COMPONENT_NAMES

/** The renderer for a component name, or null for anything outside the three. */
export function rendererFor(component: unknown): ArtifactRenderer | null {
  if (typeof component !== "string") return null
  return own(REGISTRY, component) ?? null
}

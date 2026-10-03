/**
 * Phase 273-02 — ChartArtifact (lazy default export). Task 2 lands the module so the registry's
 * lazy import resolves; Task 3 replaces this body with the recharts implementation.
 */
import type { ArtifactBodyProps } from "./artifactSpec"
import { ariaLabel } from "./chartModel"

export default function ChartArtifact({ record }: ArtifactBodyProps) {
  return <div role="img" aria-label={ariaLabel(record)} className="h-[240px]" />
}

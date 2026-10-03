/**
 * Phase 273-02 (D-10 · D-12 · D-16 · I-1 · I-2) — the body of the ONE `<ArtifactBlock>` mount in
 * `MessageItem.tsx` (mounted by 273-05).
 *
 * A message's artifacts render as a full-width list AFTER the answer text, in emission order —
 * identical live and on reload, because both feed the same wire records through this same path:
 *
 *   raw record → parseArtifactRecord (guard) → rendererFor (closed registry)
 *              → ArtifactErrorBoundary → Suspense(busy frame) → ArtifactFrame → component
 *
 * A failed parse or an unknown component becomes `ArtifactNotice` with its catalogue reason; a
 * component that throws becomes the `render-failed` notice inside its own boundary. Siblings and the
 * rest of the message always render. It takes `readonly unknown[]` — the guard is the type boundary,
 * so this file needs no shared message type.
 *
 * Its only hook is a `useMemo` in THIS component, so mounting it can never change a parent's hook
 * order. No entrance animation (UI-D-09).
 */
import { Suspense, useMemo } from "react"
import { ArtifactBusyBody, ArtifactFrame } from "./ArtifactFrame"
import { ArtifactErrorBoundary } from "./ArtifactErrorBoundary"
import { ArtifactNotice } from "./ArtifactNotice"
import { rendererFor } from "./artifactRegistry"
import { parseArtifactRecord, type ParseResult } from "./artifactSpec"

export interface ArtifactBlockProps {
  artifacts?: readonly unknown[] | null
}

function ArtifactSlot({ parsed }: { parsed: ParseResult }) {
  if (!parsed.ok) return <ArtifactNotice reason={parsed.reason} ctx={parsed.ctx} />
  const record = parsed.record
  const Renderer = rendererFor(record.component)
  if (!Renderer) return <ArtifactNotice reason="unknown-component" />
  return (
    <ArtifactErrorBoundary>
      <Suspense
        fallback={
          <ArtifactFrame record={record}>
            <ArtifactBusyBody />
          </ArtifactFrame>
        }
      >
        <ArtifactFrame record={record}>
          <Renderer record={record} />
        </ArtifactFrame>
      </Suspense>
    </ArtifactErrorBoundary>
  )
}

export function ArtifactBlock({ artifacts }: ArtifactBlockProps) {
  const items = useMemo(() => {
    const list = Array.isArray(artifacts) ? artifacts : []
    const seen = new Set<string>()
    return list.map((raw, i) => {
      const parsed = parseArtifactRecord(raw)
      const id = parsed.ok ? parsed.record.id : parsed.id
      let key = id ?? `slot-${i}`
      if (seen.has(key)) key = `${key}-${i}`
      seen.add(key)
      return { key, parsed }
    })
  }, [artifacts])

  if (items.length === 0) return null
  return (
    <div data-testid="artifact-list" className="mt-4 flex flex-col gap-3">
      {items.map(({ key, parsed }) => (
        <ArtifactSlot key={key} parsed={parsed} />
      ))}
    </div>
  )
}

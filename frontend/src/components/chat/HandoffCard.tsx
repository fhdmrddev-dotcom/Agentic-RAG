/**
 * Phase 267 plan 04 (PACK-24 · D-267-15 / UI-SPEC §5.8) — the new thread's first message.
 *
 * The handoff summary is stored as a USER row (the model must read it as context), carrying a
 * `handoff` marker in `tool_calls[0]`. `MessageItem` renders THIS instead of the user bubble when
 * the marker is present — one marker check, inside its single early return.
 *
 * ⛔ It draws what `handoffCardModel` returns: the header and the bullets come from the marker the
 * server wrote, never from the row's plain-text `content`. The source title is plain text,
 * snapshotted in the marker — not a link. ⛔ React text children only (T-267-40).
 */
import { CornerDownRight } from "lucide-react"
import type { HandoffMarker } from "@/lib/api/threads"
import { handoffCardModel } from "./expertEventCopy"

export function HandoffCard({ marker }: { marker: HandoffMarker }) {
  const m = handoffCardModel(marker)
  return (
    <div className="py-2">
      <div
        data-testid="handoff-card"
        className="w-full rounded-[10px] border border-border border-l-[3px] border-l-primary bg-card p-3"
      >
        <p className="flex items-center gap-1 text-xs font-semibold leading-relaxed text-primary">
          <CornerDownRight className="h-3 w-3 flex-none" aria-hidden="true" />
          <span>{m.header}</span>
        </p>
        {m.bullets ? (
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">
            {m.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs leading-relaxed text-foreground">{m.paragraph}</p>
        )}
      </div>
    </div>
  )
}

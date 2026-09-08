/**
 * SEED-258 — the source file-size ceiling, made reachable and LEGIBLE.
 *
 * Phase 239-09 shipped the whole backend and said so plainly in its own summary:
 *
 *   > *"The Settings UI does not yet show this knob … SEED-258's headline requirement — the
 *   >  on-screen copy stating the value, that it applies to every connected source, and what
 *   >  raising it costs — is therefore NOT met yet."*
 *
 * This card is that half. It exists as its own leaf rather than inline in `SettingsPage.tsx`
 * for one measured reason: that page is **`38 commits / 21 phases`** and FIRES G-5, with a
 * named-but-un-taken seam (tab registration out of the page). Adding four lines there and a
 * component here honours it by construction — the page gains a `useState`, a read, a payload
 * key and a mount, which is the shape `multimodal_max_vision_calls` (SEED-227) already uses.
 *
 * ── ⛔ THIS COMPONENT OWNS NO NUMBER AND NO SENTENCE ────────────────────────────────────
 *
 * Every user-visible string is an imported identifier from `sourceCeilingCopy`, and both
 * bounds arrive as props from `GET /settings`. `api/settings.py:79` states the rule this
 * obeys: *"a form carrying its own copy of `50` is a fourth private constant, which is the
 * defect this replaced."*
 *
 * ── ⛔ `min` / `max` ARE AFFORDANCE, NOT ENFORCEMENT ────────────────────────────────────
 *
 * SEED-258 names *"Bounds are enforced only in the React form"* as a way of answering this
 * badly, and the API already refuses an out-of-range `PATCH` with a 400 whose body explains
 * the cost. **Nothing here clamps.** A value the server will refuse travels to the server
 * and comes back as its own sentence, which `SettingsPage`'s error banner renders verbatim.
 * Silently correcting the operator's number would hide a refusal they should read.
 *
 * ── ⛔ ONE KNOB, AND THERE MUST NEVER BE A SECOND ──────────────────────────────────────
 *
 * The MCP JSON-RPC envelope cap is DERIVED server-side (`ceiling x 4/3` + 1 MB headroom); a
 * backend test asserts no `*_body_bytes` / `*_envelope` field can exist on the settings
 * model. This card therefore renders exactly one editable number and *explains* that the
 * transport limit follows it — explaining is not exposing.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import {
  SOURCE_CEILING_COST,
  SOURCE_CEILING_DESCRIPTION,
  SOURCE_CEILING_FIELD_LABEL,
  SOURCE_CEILING_FIELD_SUFFIX,
  SOURCE_CEILING_RECOMMENDED_MB,
  SOURCE_CEILING_TITLE,
  sourceCeilingBounds,
  sourceCeilingRecommendation,
} from "./sourceCeilingCopy"

export type SourceFileCeilingCardProps = {
  /** The STORED value, from `GET /settings`. Always rendered — see HI-02 below. */
  value: number
  /** `source_max_file_size_mb_floor`, served. Never a local constant. */
  floor: number
  /** `source_max_file_size_mb_ceiling`, served. Never a local constant. */
  ceiling: number
  onChange: (next: number) => void
}

export function SourceFileCeilingCard({
  value,
  floor,
  ceiling,
  onChange,
}: SourceFileCeilingCardProps) {
  const fieldId = "source-max-file-size-mb"

  return (
    <Card className="ghost-border bg-card/60 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-headline font-bold">
          {SOURCE_CEILING_TITLE}
        </CardTitle>
        <CardDescription>{SOURCE_CEILING_DESCRIPTION}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-4 py-1">
          <Label htmlFor={fieldId} className="text-sm text-muted-foreground shrink-0 w-44">
            {SOURCE_CEILING_FIELD_LABEL}
          </Label>
          <div className="flex-1 max-w-xs flex items-center gap-2">
            <Input
              id={fieldId}
              type="number"
              /* ⚠ HI-02, from this same phase: the STORED value is always rendered. A control
                 that showed blank over a stored value would make "open the page and press
                 Save" a silent wipe. */
              value={value}
              /* ⛔ NOT a clamp. `Number(...)` and straight out — the server is the boundary. */
              onChange={(e) => onChange(Number(e.target.value))}
              min={floor}
              max={ceiling}
              step={1}
              className="h-8 text-sm font-mono bg-muted/30 ghost-border"
            />
            <span className="text-xs text-muted-foreground shrink-0">
              {SOURCE_CEILING_FIELD_SUFFIX}
            </span>
          </div>
        </div>

        {/* ⭐ The three sentences that make this a setting rather than a text box. Bounds so
            they are not discovered by being refused; the cost so raising it is an informed
            choice; the recommendation so there is an answer for someone who has none. */}
        <p className="text-xs text-muted-foreground">{sourceCeilingBounds(floor, ceiling)}</p>
        <p className="text-xs text-muted-foreground">{SOURCE_CEILING_COST}</p>
        <p className="text-xs text-foreground/80">
          {sourceCeilingRecommendation(SOURCE_CEILING_RECOMMENDED_MB)}
        </p>
      </CardContent>
    </Card>
  )
}

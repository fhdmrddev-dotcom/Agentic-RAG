/**
 * Phase 231 · VIS-02 — sketch 228, locked variant **B + A**.
 *
 * B — `IngestVisibilityField`: the sentence IS the option. Each choice states its own consequence,
 *     so you cannot pick without reading what the pick does.
 * A — `IngestVisibilityFooter`: the always-on sentence, bound to the *value* rather than to a
 *     step, for every path B does not reach.
 *
 * ⭐ WHY BOTH. SC#1 says *"there is no configuration path where that sentence is absent"* — a
 *    coverage claim, not a copy claim. B covers the screen where the choice is made; A is what a
 *    read-only view, a summary row, or an edit-later screen mounts so the sentence cannot go
 *    missing there. Neither is decoration for the other.
 *
 * ⚠ No department option is rendered (D-5). `dept` exists in the database and in the SQL
 *   resolver, and no UI offers it. *Inert means invisible.*
 */

import { cn } from "@/lib/utils"
import type { IngestVisibility } from "@/lib/api/org"
import {
  AUDIENCE_ROWS,
  VISIBILITY_CHANGE_NOTE,
  VISIBILITY_FIELD_HELP,
  VISIBILITY_FIELD_LABEL,
  scopeFooterSentence,
} from "./ingestVisibilityCopy"

interface CommonProps {
  /** The organisation this connection belongs to, named as the person knows it. */
  orgName: string
  /** How many people that audience actually is. `null` when unknown — never guessed. */
  memberCount?: number | null
}

interface FieldProps extends CommonProps {
  value: IngestVisibility
  onChange: (next: IngestVisibility) => void
  /** True when editing an existing connection — surfaces the "already brought in" note. */
  isExisting?: boolean
  disabled?: boolean
}

/** Variant B — the audience rows. */
export function IngestVisibilityField({
  value,
  onChange,
  orgName,
  memberCount = null,
  isExisting = false,
  disabled = false,
}: FieldProps) {
  return (
    <fieldset className="min-w-0 border-0 p-0 m-0" disabled={disabled}>
      <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {VISIBILITY_FIELD_LABEL}
      </legend>
      <p className="mb-2 text-xs text-muted-foreground">{VISIBILITY_FIELD_HELP}</p>

      <div className="flex flex-col gap-2">
        {AUDIENCE_ROWS.map((row) => {
          const selected = value === row.value
          const warn = selected && row.tone === "warn"
          return (
            <label
              key={row.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-md border bg-background/40 p-3",
                "transition-colors hover:border-accent",
                selected && !warn && "border-primary bg-primary/10",
                warn && "border-warning/55 bg-warning/10",
                !selected && "border-border",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              <input
                type="radio"
                name="ingest-visibility"
                className="mt-1 h-4 w-4 flex-none accent-primary"
                value={row.value}
                checked={selected}
                disabled={disabled}
                onChange={() => onChange(row.value)}
              />
              <span className="min-w-0">
                <span
                  className={cn(
                    "block text-sm font-semibold",
                    warn ? "text-warning" : "text-foreground",
                  )}
                >
                  {row.title}
                </span>
                {/* The consequence is real DOM text, never a title attribute — a reason nobody
                    can read is not a reason (the 142-B rule). */}
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                  {row.consequence(orgName, memberCount)}
                </span>
              </span>
            </label>
          )
        })}
      </div>

      {isExisting && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {VISIBILITY_CHANGE_NOTE}
        </p>
      )}
    </fieldset>
  )
}

interface FooterProps extends CommonProps {
  visibility: IngestVisibility | string | null | undefined
  className?: string
}

/**
 * Variant A — the always-on footer. The 024 pattern: *you can never pick a model without seeing
 * where it runs.* Here: you can never see a connection without reading who its documents reach.
 *
 * ⚠ It renders a sentence for EVERY value including unrecognised ones, so a surface can never
 *   fall through to silence. Silence is the failure SC#1 names.
 */
export function IngestVisibilityFooter({
  visibility,
  orgName,
  memberCount = null,
  className,
}: FooterProps) {
  const isWide = visibility === "org" || visibility === "dept"
  return (
    <div
      data-testid="ingest-visibility-footer"
      data-visibility={String(visibility ?? "unset")}
      className={cn(
        "mt-2 flex items-start gap-2 rounded-md border p-3",
        isWide ? "border-warning/40 bg-warning/10" : "border-border bg-background/40",
        className,
      )}
    >
      <span aria-hidden="true" className="flex-none text-sm leading-5">
        {isWide ? "⚠" : "🔒"}
      </span>
      <span className="text-xs leading-relaxed text-foreground">
        {scopeFooterSentence(visibility, orgName, memberCount)}
      </span>
    </div>
  )
}

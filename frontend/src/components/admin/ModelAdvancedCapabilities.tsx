/**
 * ModelAdvancedCapabilities — the six capability fields migration 190 made settable.
 *
 * ⭐ WHY THIS EXISTS. `ModelCapability` declares fifteen fields; before Phase 262 the Model
 * Registry could express six of them. The rest lived ONLY as literals in a hardcoded Python
 * dict, which means a model needing one of them could not be added from this product at all
 * — the fact had to become a code branch, a review and a deploy.
 *
 * ⚠ That is not a hypothetical cost. OpenAI's gpt-5.6 family needs a different API endpoint
 * to use tools at all. No field could say so, so the only place the fact could live was a
 * routing branch — and the branch that landed answered the constraint by giving native tool
 * calling up entirely. The family shipped for months with tool calls parsed back out of
 * prose, over a Tools toggle on this very screen that could not fire. **The registry was not
 * wrong; it had nowhere to put the truth.**
 *
 * ⛔ SEPARATE FILE, NOT SIX MORE COLUMNS. `ModelRegistryTab.tsx` is 1640 lines and G-5
 * FIRING; the table is `table-fixed` with every width already allocated, so widening it by
 * six would wreck every provider section. This mounts behind ONE cell.
 *
 * ⛔ `null` IS NOT `false` ANYWHERE IN THIS FILE. The backend overlays only non-null values,
 * so `null` means *"not asserted — the built-in registry or the provider inference decides"*.
 * Rendering it as "off" would state something about the model that nobody has established.
 * Every control here is therefore three-state, and "Not set" is a real, selectable value that
 * clears the override.
 */
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { ModelCapabilityPatch, ModelRegistryRow } from "@/lib/api/admin"
import { cn } from "@/lib/utils"

/** The fields, their user-facing wording, and the consequence of leaving each unset.
 *
 * ⚠ THE `unset` LINE IS THE LOAD-BEARING ONE and it is why this is a table rather than six
 * inline JSX blocks. An operator looking at a blank control needs to know what the system
 * will do anyway — otherwise "Not set" reads as "nothing happens", when in every case
 * something specific happens and it is usually a guess derived from the model's NAME. */
const ADVANCED_FIELDS = [
  {
    key: "api_surface" as const,
    label: "API surface",
    tech: "api_surface",
    help: "Which wire protocol this model is called on.",
    unset: "Unset: called on chat.completions, like every other model.",
    kind: "enum" as const,
    options: [
      { value: "responses", label: "OpenAI /v1/responses" },
    ],
    note: "Only meaningful on an OpenAI provider — no other endpoint serves this surface, and a model routed elsewhere quietly falls back to chat.completions.",
  },
  {
    key: "reasoning_first" as const,
    label: "Reasons before tool calls",
    tech: "reasoning_first",
    help: "The model refuses a request carrying both a tools parameter and reasoning.",
    unset: "Unset: treated as a normal model, tools sent alongside reasoning.",
    kind: "bool" as const,
    note: "Turning this on routes the model to prompt-injected tools UNLESS an API surface above serves both together. It is a claim about the provider's API, not a preference.",
  },
  {
    key: "reasoning_off" as const,
    label: "How to disable reasoning",
    tech: "reasoning_off",
    help: "The documented switch for turning reasoning off on cheap side-calls like thread titles.",
    unset: "Unset: reasoning is left on everywhere, which costs tokens on trivial calls.",
    kind: "enum" as const,
    options: [
      { value: "thinking_disabled", label: "thinking: disabled" },
      { value: "effort_none", label: "reasoning_effort: none" },
    ],
    note: "Set this only from the provider's own documentation. A mechanism the provider accepts-and-ignores is worse than none, because it reads as handled.",
  },
  {
    key: "uses_max_completion_tokens" as const,
    label: "Uses max_completion_tokens",
    tech: "uses_max_completion_tokens",
    help: "Send max_completion_tokens instead of max_tokens.",
    unset: "Unset: guessed from the model's NAME (o-series and gpt-5 prefixes).",
    kind: "bool" as const,
    note: "Sending the wrong one is a hard 400 — every request fails. The name-based guess is the thing most likely to be wrong for a model released after this code was written.",
  },
  {
    key: "supports_parallel_tools" as const,
    label: "Accepts parallel_tool_calls",
    tech: "supports_parallel_tools",
    help: "Whether the endpoint ACCEPTS the parameter at all.",
    unset: "Unset: guessed from the provider.",
    kind: "bool" as const,
    note: "This is about the API accepting the parameter, not about wanting parallel tools. Sending it where it is rejected fails the request.",
  },
  {
    key: "max_tools" as const,
    label: "Tool count ceiling",
    tech: "max_tools",
    help: "Offer at most this many tool schemas to this model.",
    unset: "Unset: no ceiling — every tool is offered.",
    kind: "int" as const,
    note: "Some models get measurably worse past a modest tool count. Leave it unset unless you have measured this one.",
  },
]

/** How many advanced fields this row actually asserts — the number on the trigger.
 *
 * ⚠ Counts ASSERTED values, not truthy ones: an explicit `false` is an assertion and must
 * count, or a deliberately-disabled capability would look untouched from the outside. */
export function advancedSetCount(row: ModelRegistryRow): number {
  return ADVANCED_FIELDS.filter((f) => row[f.key] !== null && row[f.key] !== undefined).length
}

export function ModelAdvancedCapabilities({
  row,
  busy,
  showTechnical,
  onWrite,
}: {
  row: ModelRegistryRow
  busy: boolean
  showTechnical: boolean
  onWrite: (patch: ModelCapabilityPatch) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const count = advancedSetCount(row)

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={() => setOpen(true)}
        aria-label={`Advanced capabilities for ${row.model_id}`}
        className={cn(
          "h-7 px-2 text-xs",
          count > 0 ? "text-violet-300 hover:text-violet-200" : "text-muted-foreground",
        )}
      >
        Advanced
        {count > 0 && (
          <span className="ml-1.5 rounded-full bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-violet-200">
            {count}
          </span>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Advanced capabilities — {row.model_id}</DialogTitle>
            <DialogDescription>
              These describe how this model must be CALLED. Each one is a claim about the
              provider's API, so set it from the provider's own documentation — nothing here
              is verified against them.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            {ADVANCED_FIELDS.map((field) => {
              const value = row[field.key]
              const isSet = value !== null && value !== undefined
              return (
                <div key={field.key} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <label className="text-sm font-medium" htmlFor={`adv-${field.key}-${row.model_id}`}>
                      {field.label}
                      {showTechnical && (
                        <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                          {field.tech}
                        </span>
                      )}
                    </label>
                    <span
                      className={cn(
                        "shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide",
                        isSet
                          ? "bg-violet-500/15 text-violet-200"
                          : "bg-muted/40 text-muted-foreground",
                      )}
                    >
                      {isSet ? "set here" : "not set"}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground">{field.help}</p>

                  <AdvancedControl
                    id={`adv-${field.key}-${row.model_id}`}
                    field={field}
                    value={value}
                    busy={busy}
                    onWrite={onWrite}
                  />

                  {/* ⛔ The unset consequence is shown whenever the field is unset — it is the
                      difference between "nothing happens" and "a guess derived from the model's
                      name happens", and the second is what silently breaks new models. */}
                  {!isSet && (
                    <p className="text-xs text-amber-300/80">{field.unset}</p>
                  )}
                  <p className="text-[11px] leading-snug text-muted-foreground/70">{field.note}</p>
                </div>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function AdvancedControl({
  id,
  field,
  value,
  busy,
  onWrite,
}: {
  id: string
  field: (typeof ADVANCED_FIELDS)[number]
  value: unknown
  busy: boolean
  onWrite: (patch: ModelCapabilityPatch) => Promise<void>
}) {
  // ⛔ "" is the wire form of "Not set" in a <select>, because a select cannot hold null.
  // It is translated back to an explicit null on write — which is the Reset the backend
  // expects, clearing the override rather than storing an empty string.
  const send = (patch: ModelCapabilityPatch) => void onWrite(patch)

  if (field.kind === "int") {
    return (
      <input
        id={id}
        type="number"
        min={1}
        max={512}
        disabled={busy}
        defaultValue={typeof value === "number" ? value : ""}
        placeholder="Not set"
        className="h-8 w-40 rounded-md border border-border/60 bg-background px-2 text-sm"
        onBlur={(e) => {
          const raw = e.currentTarget.value.trim()
          const next = raw === "" ? null : Number(raw)
          if (next !== null && (!Number.isFinite(next) || next < 1)) return
          if (next !== value) send({ [field.key]: next } as ModelCapabilityPatch)
        }}
      />
    )
  }

  const options =
    field.kind === "bool"
      ? [
          { value: "true", label: "Yes" },
          { value: "false", label: "No" },
        ]
      : field.options.map((o) => ({ value: o.value, label: o.label }))

  const current = value === null || value === undefined ? "" : String(value)

  return (
    <select
      id={id}
      disabled={busy}
      value={current}
      className="h-8 w-56 rounded-md border border-border/60 bg-background px-2 text-sm"
      onChange={(e) => {
        const raw = e.currentTarget.value
        const next =
          raw === "" ? null : field.kind === "bool" ? raw === "true" : raw
        send({ [field.key]: next } as ModelCapabilityPatch)
      }}
    >
      <option value="">Not set</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export { ADVANCED_FIELDS }

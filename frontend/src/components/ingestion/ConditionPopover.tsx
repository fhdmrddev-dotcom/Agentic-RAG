import { useEffect, useMemo, useState } from "react"
import { Check, Plus, X } from "lucide-react"
import type { MetadataFieldDef, ViewCondition, ViewConditionOp } from "@/types"
import { RelativeDateControl, type RelativeUnit } from "./RelativeDateControl"
import { cn } from "@/lib/utils"

/**
 * ConditionPopover — the field → type-aware operator → value editor (Phase 114,
 * sketch 030-A / D-114-1).
 *
 * A user picks a FIELD, then the operator menu shows ONLY the operators valid for
 * that field's type, then a value editor appropriate to the chosen operator. The
 * operator menu adapting to `field_type` is the ONLY place the type system
 * surfaces — there is NO on-screen type/operator matrix (deliberately deleted in
 * sketch 030: it leaked `string/date/number/...` at a user who just wants to pick
 * a field). One quiet hint ("The choices change to fit the field you pick") is
 * enough. Operator words render in plain sans, never code/jargon — never "query".
 *
 * The client only ASSEMBLES a `ViewCondition`; all field-whitelist validation +
 * value binding happens server-side (T-114-05-01 — the client is not a trust
 * boundary).
 */

/** The built-in filterable fields (mirrors backend `_METADATA_BUILTINS` /
 *  metadata_field.py) with their types. Custom enabled defs are merged in. */
export interface FilterField {
  field_key: string
  field_type: MetadataFieldDef["field_type"]
  options?: string[] | null
}

const BUILTIN_FIELDS: FilterField[] = [
  { field_key: "title", field_type: "string" },
  { field_key: "author", field_type: "string" },
  { field_key: "summary", field_type: "string" },
  { field_key: "language", field_type: "string" },
  { field_key: "topics", field_type: "string" },
  { field_key: "document_type", field_type: "string" },
  { field_key: "date", field_type: "date" },
]

/** Type-aware operator vocabulary (114-RESEARCH mapping table + sketch 030).
 *  `enum` mirrors `string` minus free-text `contains`; `date` carries the
 *  direction-encoding relative operators.
 *
 *  WR-01 (114 review): custom `number` fields offer ONLY `eq`/`is_empty` — NOT
 *  range ops (`gte`/`lte`/`between`). A custom number lives in `metadata` and the
 *  filter compares it as TEXT via `metadata->>'field'` (lexical, not numeric: "9" >
 *  "100"), and a clean numeric cast is not expressible through supabase-py builders.
 *  Offering a range op here would silently return the wrong document set, breaking
 *  the "N documents match" trust contract. The server REJECTS range ops on a custom
 *  number field (422) regardless, so the UI must not present them. (Built-in `date`
 *  ranges stay — they resolve through the typed, numerically-correct `date_typed`
 *  column.) */
const OPS_BY_TYPE: Record<MetadataFieldDef["field_type"], ViewConditionOp[]> = {
  string: ["eq", "one_of", "contains", "is_empty"],
  enum: ["eq", "one_of", "is_empty"],
  date: ["within_next", "older_than", "before", "after", "between", "is_empty"],
  number: ["eq", "is_empty"],
  boolean: ["eq", "is_empty"],
}

/** Plain-language operator labels — sans, never jargon, never "query". */
const OP_LABEL: Record<ViewConditionOp, string> = {
  eq: "is",
  one_of: "is one of",
  contains: "contains",
  is_empty: "is empty",
  gte: "is at least",
  lte: "is at most",
  between: "is between",
  within_next: "within next…",
  older_than: "older than…",
  before: "before",
  after: "after",
}

/** Operators that take NO value editor (the condition is complete on its own). */
const VALUELESS_OPS: ViewConditionOp[] = ["is_empty"]
/** Operators whose value is a relative-date stepper. */
const RELATIVE_OPS: ViewConditionOp[] = ["within_next", "older_than"]

function fieldType(fields: FilterField[], key: string): MetadataFieldDef["field_type"] {
  return fields.find((f) => f.field_key === key)?.field_type ?? "string"
}

export interface ConditionPopoverProps {
  /** The enabled custom field defs to merge with the built-ins. */
  customFields?: MetadataFieldDef[]
  /** The condition being edited, or `undefined` to compose a brand-new one. */
  initial?: ViewCondition
  onApply: (condition: ViewCondition) => void
  onCancel: () => void
}

export function ConditionPopover({
  customFields = [],
  initial,
  onApply,
  onCancel,
}: ConditionPopoverProps) {
  // The full filterable-field set: built-ins ∪ enabled custom defs (deduped).
  const fields = useMemo<FilterField[]>(() => {
    const custom = customFields
      .filter((d) => d.enabled)
      .map((d) => ({ field_key: d.field_key, field_type: d.field_type, options: d.options }))
    const seen = new Set(BUILTIN_FIELDS.map((f) => f.field_key))
    return [...BUILTIN_FIELDS, ...custom.filter((c) => !seen.has(c.field_key))]
  }, [customFields])

  const [field, setField] = useState<string>(initial?.field ?? fields[0]?.field_key ?? "title")
  const ftype = fieldType(fields, field)
  const ops = OPS_BY_TYPE[ftype]

  // Keep the operator valid for the current field type. When the field changes to
  // a type whose vocabulary excludes the current op, snap to the first valid op.
  const [op, setOp] = useState<ViewConditionOp>(() => {
    if (initial && OPS_BY_TYPE[fieldType(fields, initial.field)].includes(initial.op)) {
      return initial.op
    }
    return OPS_BY_TYPE[ftype][0]
  })
  useEffect(() => {
    if (!ops.includes(op)) setOp(ops[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field])

  // Value state — covers scalar value, the between upper bound (value2), the
  // one_of membership list (values), and the relative-date N+unit.
  const [value, setValue] = useState<string>(
    initial?.value != null ? String(initial.value) : "",
  )
  const [value2, setValue2] = useState<string>(
    initial?.value2 != null ? String(initial.value2) : "",
  )
  const [values, setValues] = useState<string[]>(
    initial?.values?.map(String) ?? [""],
  )
  const [relN, setRelN] = useState<number>(
    typeof initial?.value === "number" ? initial.value : 30,
  )
  const [relUnit, setRelUnit] = useState<RelativeUnit>(
    (initial?.unit as RelativeUnit) ?? "days",
  )

  const enumOptions = fields.find((f) => f.field_key === field)?.options ?? null

  function build(): ViewCondition {
    const base: ViewCondition = { field, op }
    if (VALUELESS_OPS.includes(op)) return base
    if (RELATIVE_OPS.includes(op)) return { ...base, value: relN, unit: relUnit }
    if (op === "one_of") {
      return { ...base, values: values.map((v) => v.trim()).filter(Boolean) }
    }
    if (op === "between") {
      return { ...base, value, value2 }
    }
    return { ...base, value }
  }

  const canApply = (() => {
    if (VALUELESS_OPS.includes(op)) return true
    if (RELATIVE_OPS.includes(op)) return relN >= 1
    if (op === "one_of") return values.some((v) => v.trim() !== "")
    if (op === "between") return value.trim() !== "" && value2.trim() !== ""
    return value.trim() !== ""
  })()

  return (
    <div
      className="w-72 rounded-lg border border-border bg-popover p-3 shadow-md space-y-3"
      role="dialog"
      aria-label="Edit condition"
    >
      {/* Field picker */}
      <label className="block space-y-1">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Field
        </span>
        <select
          aria-label="Field"
          value={field}
          onChange={(e) => setField(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          {fields.map((f) => (
            <option key={f.field_key} value={f.field_key}>
              {f.field_key}
            </option>
          ))}
        </select>
      </label>

      {/* Type-aware operator menu — the ONLY place the type system appears. */}
      <label className="block space-y-1">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Condition
        </span>
        <select
          aria-label="Operator"
          value={op}
          onChange={(e) => setOp(e.target.value as ViewConditionOp)}
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          {ops.map((o) => (
            <option key={o} value={o}>
              {OP_LABEL[o]}
            </option>
          ))}
        </select>
        <span className="block text-[11px] text-muted-foreground">
          The choices change to fit the field you pick.
        </span>
      </label>

      {/* Value editor — adapts to the operator. */}
      {!VALUELESS_OPS.includes(op) && (
        <div className="space-y-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Value
          </span>

          {RELATIVE_OPS.includes(op) ? (
            <RelativeDateControl
              direction={op as "within_next" | "older_than"}
              value={relN}
              unit={relUnit}
              onChange={({ value: v, unit: u }) => {
                setRelN(v)
                setRelUnit(u)
              }}
            />
          ) : op === "one_of" ? (
            <div className="space-y-1.5" data-testid="one-of-editor">
              {values.map((v, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <ValueInput
                    ftype={ftype}
                    enumOptions={enumOptions}
                    ariaLabel={`Value ${i + 1}`}
                    value={v}
                    onChange={(nv) =>
                      setValues((prev) => prev.map((p, j) => (j === i ? nv : p)))
                    }
                  />
                  {values.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Remove value ${i + 1}`}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setValues((prev) => prev.filter((_, j) => j !== i))}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                onClick={() => setValues((prev) => [...prev, ""])}
              >
                <Plus className="h-3 w-3" /> Add another
              </button>
            </div>
          ) : op === "between" ? (
            <div className="flex items-center gap-2" data-testid="between-editor">
              <ValueInput
                ftype={ftype}
                enumOptions={enumOptions}
                ariaLabel="From value"
                value={value}
                onChange={setValue}
              />
              <span className="text-xs text-muted-foreground">and</span>
              <ValueInput
                ftype={ftype}
                enumOptions={enumOptions}
                ariaLabel="To value"
                value={value2}
                onChange={setValue2}
              />
            </div>
          ) : (
            <ValueInput
              ftype={ftype}
              enumOptions={enumOptions}
              ariaLabel="Value"
              value={value}
              onChange={setValue}
            />
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!canApply}
          className={cn(
            "inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground",
            "disabled:opacity-40 disabled:cursor-not-allowed",
          )}
          onClick={() => onApply(build())}
        >
          <Check className="h-3.5 w-3.5" /> Apply
        </button>
      </div>
    </div>
  )
}

/** A single value input that adapts to the field type: an enum select when the
 *  field carries options, a number input for number fields, a date input for date
 *  fields, otherwise a plain text input. */
function ValueInput({
  ftype,
  enumOptions,
  ariaLabel,
  value,
  onChange,
}: {
  ftype: MetadataFieldDef["field_type"]
  enumOptions: string[] | null
  ariaLabel: string
  value: string
  onChange: (v: string) => void
}) {
  const base =
    "h-9 w-full min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"

  if (ftype === "enum" && enumOptions?.length) {
    return (
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={base}
      >
        <option value="">Choose…</option>
        {enumOptions.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    )
  }
  if (ftype === "boolean") {
    return (
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={base}
      >
        <option value="">Choose…</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    )
  }
  return (
    <input
      type={ftype === "number" ? "number" : ftype === "date" ? "date" : "text"}
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={base}
    />
  )
}

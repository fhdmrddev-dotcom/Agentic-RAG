/**
 * Phase 214-07 Task 1 (STEP-01 / STEP-02 / D-214-05 / D-214-06 / D-214-07 / D-214-08 /
 * D-214-03) — the PURE derivation behind the argument form.
 *
 * ── ONE RENDERER, ONE SOURCE, NO BRANCH (D-214-05) ────────────────────────────────────
 * Fields are derived from `inputSchema`, which exists for BOTH shapes by the time it
 * reaches here: the descriptor emitter emits a native adapter's `INPUT_SCHEMA` in the
 * MCP sanitizer's own key order precisely so that a first-party capability and a
 * discovered remote tool are the same schema at this boundary. Nothing in this file
 * branches on capability-vs-MCP, and nothing may.
 *
 * ── THE WALK IS OVER THE SCHEMA, NEVER OVER `tool_args` ───────────────────────────────
 * One row per DECLARED property. A `tool_args` key the schema does not declare produces a
 * LEFTOVER, never a field — `smtp_adapter.send()` raises `SmtpArgumentsInvalid` on any
 * undeclared key, so a rendered `cc` would typecheck, render, pass every frontend test and
 * fail every real submission. That is the concrete defect the sketch caught and Stitch did
 * not, and it is why this module never invents a row.
 *
 * ⚠ A LEFTOVER IS SURFACED, NEVER DROPPED. The adapter already fails closed on it, so a
 * silent drop would hide a step that is ALREADY broken, on an outbound path, in a way the
 * author cannot see.
 *
 * ── ⛔ NO ESCAPE HATCH IS DERIVABLE FROM THIS MODULE (D-214-06) ────────────────────────
 * There is no arm of `deriveRows` that returns a free-form row, a bare name-and-value pair
 * or an untyped field. An unrenderable property is NAMED by `renderable()`; the caller says which
 * argument and why. This file contains no serialiser and no parser, and its suite asserts
 * that mechanically.
 *
 * ── ⭐ `renderable()` IS A MIRROR, BOUND BY A FENCE RATHER THAN BY HOPE ────────────────
 * Its counterpart is `backend/app/services/connectors/args.py::renderable_property`. The
 * two predicates decide the SAME question on two sides of a language boundary — the form
 * draws what the gate will accept — so `argumentModel.test.ts` reads that file via `?raw`
 * and asserts the two type sets are character-identical, with a non-vacuity control on
 * each side. Two predicates that disagree is D-214-00's drift with a compiler in the
 * middle.
 *
 * ── A STRICT LEAF ─────────────────────────────────────────────────────────────────────
 * Zero imports of any kind — not a component, not a vocabulary, not a type. It reads no
 * context, holds no store reference and performs no I/O. `deriveRows` is a pure function of
 * its five arguments.
 *
 * ⚠ `preset` IS A DERIVED DISPLAY FLAG AND IS NEVER STORED. It is the visible form of a
 * rule that used to be invisible (`_BODY_ARG_FOR_CAPABILITY` in `phase_types.py` fills the
 * capability's body field from the upstream text when nothing else named it — BUG-260826-01
 * is what an invisible rule costs). Storing it would make a derived fact go stale the first
 * time a step is re-ordered.
 */

// ── THE MIRRORED PREDICATE'S TWO SETS ─────────────────────────────────────────────────
//
// ⚠ THESE TWO ARRAYS ARE THE FENCED HALF. Their spelling is compared character-for-character
// against `args.py`'s `_SCALAR_TYPES` and `_COMPOSITE_KEYS` by a cross-language `?raw` case.
// Widening either one is a UI commitment on both sides, never a typo fix on one.

const SCALAR_TYPES: readonly string[] = ["string", "number", "integer", "boolean"]

const COMPOSITE_KEYS: readonly string[] = ["oneOf", "anyOf", "allOf", "not", "$ref"]

/** The three arms of D-214-01, in the order every group renders them. */
export type ArgumentSource = "fixed" | "ask" | "upstream"

/** What kind of control the row draws. `enum` is a scalar choice, never an object picker. */
export type ArgumentKind = "string" | "number" | "boolean" | "enum"

/** An upstream step, as the picker needs it: a bare slug and the author's own name for it.
 *
 *  ⚠ THE SLUG IS THE STORED VALUE AND THE TITLE IS THE RENDERED ONE (D-214-02, sketch
 *  invariant #6 / #7). The binding stores a bare phase slug — no dotted path, no `{{ }}`,
 *  no output-key sub-picker — and the slug never reaches the DOM. */
export interface UpstreamPhase {
  slug: string
  title: string
}

/** One declared schema property, resolved against the step's stored configuration. */
export interface ArgumentRowModel {
  /** The schema property name. The stored key, and the identity of the row. */
  key: string
  /** What the author reads. The property's own `title` when the schema declares one,
   *  otherwise the key VERBATIM — a name is never fabricated. */
  label: string
  description?: string
  required: boolean
  renderable: boolean
  kind: ArgumentKind
  options?: string[]
  /** `null` means NOTHING SUPPLIES THIS YET, which is a fact the form states rather than
   *  hides. It is never defaulted to `fixed`. */
  source: ArgumentSource | null
  value?: unknown
  askKey?: string
  upstreamSlug?: string
  /** D-214-03 — derived, never stored. See the header. */
  preset: boolean
}

/** A `tool_args` key the schema does not declare. Removable, never dropped. */
export interface LeftoverRow {
  key: string
  value: unknown
}

export interface DerivedArguments {
  rows: ArgumentRowModel[]
  leftovers: LeftoverRow[]
}

// ── DEFENSIVE READS ───────────────────────────────────────────────────────────────────
// Every input to this module is author-supplied data that has been through a database and a
// wire. `unknown` in, narrowed here, so a malformed value degrades to an honest absence
// rather than throwing inside a render.

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const textOf = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() !== "" ? value : undefined

/**
 * D-214-06 — can the argument form draw a field for this schema property?
 *
 * ⭐ THE MIRROR OF `args.py::renderable_property`. True for a FLAT SCALAR: a `type` of
 * `string` / `number` / `integer` / `boolean`, or an `enum` whose members are scalars.
 * False for `object`, `array`, a `$ref`, any of `oneOf` / `anyOf` / `allOf` / `not`, and
 * for an absent or unrecognised `type`.
 *
 * ⚠ THE PAIR IS FAIL-CLOSED, and the order is load-bearing: a composite keyword nobody
 * listed still has to pass the positive `type` test at the end, so an unknown schema
 * keyword refuses rather than falls through.
 */
export function renderable(prop: unknown): boolean {
  if (!isRecord(prop)) return false
  for (const key of COMPOSITE_KEYS) {
    if (key in prop) return false
  }
  const enumeration = prop.enum
  if (enumeration !== undefined && enumeration !== null) {
    if (!Array.isArray(enumeration) || enumeration.length === 0) return false
    return enumeration.every(
      (member) =>
        member === null ||
        typeof member === "string" ||
        typeof member === "number" ||
        typeof member === "boolean",
    )
  }
  const declared = prop.type
  return typeof declared === "string" && SCALAR_TYPES.includes(declared)
}

/** The control this property wants. Only ever consulted for a `renderable` property. */
function kindOf(prop: Record<string, unknown>): ArgumentKind {
  if (prop.enum !== undefined && prop.enum !== null) return "enum"
  const declared = typeof prop.type === "string" ? prop.type : ""
  if (declared === "boolean") return "boolean"
  if (declared === "number" || declared === "integer") return "number"
  return "string"
}

/** The scalar enum members, as strings, for the choice control. */
function optionsOf(prop: Record<string, unknown>): string[] | undefined {
  const enumeration = prop.enum
  if (!Array.isArray(enumeration)) return undefined
  return enumeration.map((member) => (member === null ? "" : String(member)))
}

/** `(source, askKey, upstreamSlug)` for one property, or all-absent.
 *
 *  ⚠ AN UNRECOGNISED `source` READS AS NO ENTRY AT ALL rather than as a fourth arm — the
 *  same fail-closed direction `args.py::_source_of` takes, for the same reason: the model
 *  layer refuses one at parse time, so a value arriving here outside the closed set came
 *  from a hand-edited row. */
function storedSource(
  argSources: unknown,
  key: string,
): { source: ArgumentSource | null; askKey?: string; upstreamSlug?: string } {
  if (!isRecord(argSources)) return { source: null }
  const spec = Object.prototype.hasOwnProperty.call(argSources, key) ? argSources[key] : undefined
  if (!isRecord(spec)) return { source: null }
  const raw = spec.source
  if (raw !== "fixed" && raw !== "ask" && raw !== "upstream") return { source: null }
  return {
    source: raw,
    askKey: textOf(spec.ask_key),
    upstreamSlug: textOf(spec.upstream_slug),
  }
}

/** A value that can actually be SENT — `args.py::_is_present`, one field over. An author who
 *  cleared a field has not supplied it. */
function isPresent(value: unknown): boolean {
  if (value === undefined || value === null) return false
  if (typeof value === "string" && value.trim() === "") return false
  return true
}

/**
 * The schema's declared properties, in declaration order, or `{}` when the shape is not
 * knowable.
 *
 * ⚠ `{}` AND "NOT KNOWABLE" ARE THE SAME ANSWER, exactly as `args.py::_properties` makes
 * them: both mean this module cannot say what the tool accepts, and the caller renders
 * D-214-07's unknown-schema state for either. An invented `{}` schema would mean *"this
 * tool takes nothing"*, which is a different fact.
 */
function propertiesOf(schema: unknown): Record<string, unknown> {
  if (!isRecord(schema)) return {}
  const props = schema.properties
  return isRecord(props) ? props : {}
}

/** The schema's `required` array, narrowed to names it actually declares. */
function requiredOf(schema: unknown, props: Record<string, unknown>): string[] {
  if (!isRecord(schema)) return []
  const raw = schema.required
  if (!Array.isArray(raw)) return []
  return raw
    .map((name) => String(name))
    .filter((name) => Object.prototype.hasOwnProperty.call(props, name))
}

/**
 * One `ArgumentRowModel` per DECLARED property, required-first then declaration order, plus
 * every `tool_args` key the schema does not declare as a removable leftover.
 *
 * The source ladder, in the order it is consulted — each rung is a decision, not a default:
 *
 *   1. `argSources[key]`, when it names one of the three legal arms. The author said so.
 *   2. otherwise `toolArgs[key]`, when present → `fixed` with that value. **D-214-08's read
 *      of pre-existing objects**, and the reason there is no *"old steps keep the old
 *      editor"* arm: one authoring surface, or SC#1 stays false for every workflow authored
 *      before this phase.
 *   3. otherwise, for `bodyArgKey` alone and only when an upstream step exists → `upstream`
 *      bound to the IMMEDIATELY PREVIOUS phase, with `preset: true`. **D-214-03.** The
 *      control stays enabled and the caller states the note; nothing is silently filled.
 *   4. otherwise `null` — *nothing supplies this yet*, said out loud.
 *
 * ⚠ RUNG 2 IS ABOVE RUNG 3 ON PURPOSE, and it agrees with the executor: `resolve_arguments`
 * fills `body_arg` only `if body_arg not in args`, i.e. only when nothing else supplied it.
 *
 * A `null` / absent / property-less schema returns two empty arrays. ⛔ It does NOT fall
 * back to one row per `tool_args` key — that would be the escape hatch wearing a form's clothes.
 */
export function deriveRows(
  schema: unknown,
  toolArgs: unknown,
  argSources: unknown,
  upstreamPhases: readonly UpstreamPhase[],
  bodyArgKey?: string | null,
): DerivedArguments {
  const props = propertiesOf(schema)
  const declared = Object.keys(props)
  if (declared.length === 0) return { rows: [], leftovers: [] }

  const args = isRecord(toolArgs) ? toolArgs : {}
  const required = requiredOf(schema, props)
  const requiredSet = new Set(required)

  // Required first, then the rest in declaration order. Both halves keep the vendor's own
  // ordering within them, so the author reads the arguments in the order the tool declares.
  const ordered = [...required, ...declared.filter((name) => !requiredSet.has(name))]

  // The IMMEDIATELY previous phase — D-214-03's pre-set target. The caller hands the
  // upstream list in run order, so the last entry is the step that runs just before this one.
  const previous = upstreamPhases.length > 0 ? upstreamPhases[upstreamPhases.length - 1] : null

  const rows: ArgumentRowModel[] = ordered.map((key) => {
    const prop = isRecord(props[key]) ? (props[key] as Record<string, unknown>) : {}
    const drawable = renderable(props[key])
    const stored = storedSource(argSources, key)
    const hasValue = Object.prototype.hasOwnProperty.call(args, key)
    const value = hasValue ? args[key] : undefined

    let source: ArgumentSource | null = stored.source
    let askKey = stored.askKey
    let upstreamSlug = stored.upstreamSlug
    let preset = false

    if (source === null && isPresent(value)) {
      source = "fixed"
    } else if (source === null && bodyArgKey !== undefined && bodyArgKey !== null && key === bodyArgKey && previous !== null) {
      source = "upstream"
      upstreamSlug = previous.slug
      preset = true
    }

    if (source !== "ask") askKey = undefined
    if (source !== "upstream") upstreamSlug = undefined

    return {
      key,
      // The property's own `title` when it declares one, else the key VERBATIM. A name is
      // never fabricated (`nodeTitle`'s second floor, one surface over).
      label: textOf(prop.title) ?? key,
      description: textOf(prop.description),
      required: requiredSet.has(key),
      renderable: drawable,
      kind: kindOf(prop),
      options: drawable ? optionsOf(prop) : undefined,
      source,
      value,
      askKey,
      upstreamSlug,
      preset,
    }
  })

  const leftovers: LeftoverRow[] = Object.keys(args)
    .filter((key) => !Object.prototype.hasOwnProperty.call(props, key))
    .map((key) => ({ key, value: args[key] }))

  return { rows, leftovers }
}

/**
 * Phase 214-07 Task 1 — the derivation, driven from the REAL adapter declarations.
 *
 * ── WHY THE FIXTURES ARE READ RATHER THAN TYPED ───────────────────────────────────────
 * Stitch drew `Cc` and `Reply to` rows for `send_email`. The shipped
 * `smtp_adapter.INPUT_SCHEMA` declares exactly three properties under
 * `additionalProperties: False`, and `send()` raises `SmtpArgumentsInvalid` on any
 * undeclared key. A hand-typed fixture would have let this suite go green over a form
 * whose every submission the backend refuses — so the property names and the `required`
 * list are EXTRACTED from the adapter's own source via `?raw`, and the schema this suite
 * renders from is BUILT from that extraction.
 *
 * ⚠ EVERY EXTRACTION CARRIES A NON-VACUITY CONTROL, ASSERTED BEFORE ANY CLAIM THAT RESTS
 * ON IT. A regex that matched nothing yields an empty set, and an empty set satisfies every
 * absence assertion for free — which is the failure mode that makes a fence read as
 * coverage.
 *
 * ── ⭐ THE CROSS-LANGUAGE RENDERABILITY FENCE ─────────────────────────────────────────
 * `renderable()` here and `renderable_property` in `args.py` decide the SAME question with
 * a language boundary in the middle: the form draws what the publish gate will accept. Two
 * copies of that rule is D-214-00's drift one level down, so the two type sets are compared
 * character-for-character, in both directions, with a floor of four entries on each side.
 */
import { describe, it, expect } from "vitest"

import { deriveRows, renderable, type UpstreamPhase } from "./argumentModel"

// The two sources this suite is BOUND to. `?raw` over a backend `.py` is the shipped
// cross-language idiom in this directory (`ExternalActionSection.test.tsx:59`).
import argsPySource from "../../../../backend/app/services/connectors/args.py?raw"
import smtpAdapterSource from "../../../../backend/app/services/connectors/smtp_adapter.py?raw"
import argumentModelSource from "./argumentModel.ts?raw"

// ── EXTRACTION ────────────────────────────────────────────────────────────────────────
// ⚠ EVERY PATTERN TOLERATES CRLF. Source files check out with Windows line endings on this
// box, and a terminator spelled `\n\n` silently never matches — which yields an empty
// result that passes vacuously. `[\s\S]` and `\r?\n` throughout.

const quoted = (blob: string): string[] =>
  [...blob.matchAll(/["']([^"']+)["']/g)].map((m) => m[1])

/** `_SCALAR_TYPES: frozenset[str] = frozenset({...})` — the Python side of the mirror. */
function pyScalarTypes(): string[] {
  const m = /_SCALAR_TYPES[^=]*=\s*frozenset\(\{([\s\S]*?)\}\)/.exec(argsPySource)
  return m === null ? [] : quoted(m[1])
}

/** `_COMPOSITE_KEYS: tuple[str, ...] = (...)` — the fail-closed half. */
function pyCompositeKeys(): string[] {
  const m = /_COMPOSITE_KEYS[^=]*=\s*\(([\s\S]*?)\)/.exec(argsPySource)
  return m === null ? [] : quoted(m[1])
}

/** The TypeScript side, read from this module's own source rather than from its export —
 *  the arrays are module-private on purpose (a runtime `export const` beside a component is
 *  a measured lint error one file over, and exporting them here only for a test would make
 *  the fence read a value the product does not use). */
function tsArray(name: string): string[] {
  const m = new RegExp(`const ${name}[^=]*=\\s*\\[([\\s\\S]*?)\\]`).exec(argumentModelSource)
  return m === null ? [] : quoted(m[1])
}

/** The adapter's declared property names, in declaration order, from its own source. */
function smtpDeclaredProperties(): string[] {
  const block = /"properties":\s*MappingProxyType\(\{([\s\S]*?)\n {8}\}\),/.exec(
    smtpAdapterSource,
  )
  if (block === null) return []
  return [...block[1].matchAll(/^\s{12}"([A-Za-z0-9_]+)":\s*MappingProxyType/gm)].map((m) => m[1])
}

/** The adapter's `required` list, from its own source. */
function smtpRequired(): string[] {
  const m = /"required":\s*\[([\s\S]*?)\]/.exec(smtpAdapterSource)
  return m === null ? [] : quoted(m[1])
}

/**
 * ⭐ THE SCHEMA THIS SUITE RENDERS FROM IS BUILT FROM THE EXTRACTION ABOVE — never typed.
 * If the adapter gains, loses or renames a property, every case below moves with it.
 */
function smtpSchema(): Record<string, unknown> {
  const properties: Record<string, unknown> = {}
  for (const name of smtpDeclaredProperties()) {
    properties[name] = { type: "string", description: `the ${name} value` }
  }
  return {
    type: "object",
    additionalProperties: false,
    required: smtpRequired(),
    properties,
  }
}

const NO_UPSTREAM: UpstreamPhase[] = []
const ONE_UPSTREAM: UpstreamPhase[] = [{ slug: "draft-the-note", title: "Draft the note" }]
const TWO_UPSTREAM: UpstreamPhase[] = [
  { slug: "gather-facts", title: "Gather the facts" },
  { slug: "draft-the-note", title: "Draft the note" },
]

// ═══════════════════════════════════════════════════════════════════════════════════════
// 0 · THE EXTRACTIONS THEMSELVES — asserted before anything rests on them
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("argumentModel — the fixtures are READ from the adapters, not typed", () => {
  it("both backend sources loaded and are substantial", () => {
    expect(typeof argsPySource).toBe("string")
    expect(argsPySource.length).toBeGreaterThan(2000)
    expect(typeof smtpAdapterSource).toBe("string")
    expect(smtpAdapterSource.length).toBeGreaterThan(2000)
    expect(typeof argumentModelSource).toBe("string")
    expect(argumentModelSource.length).toBeGreaterThan(2000)
  })

  it("⚠ send_email declares EXACTLY THREE properties — the row Stitch invented does not exist", () => {
    const declared = smtpDeclaredProperties()
    // NON-VACUITY FIRST: the extraction really found something.
    expect(declared.length).toBe(3)
    expect(declared).toEqual(["to", "subject", "body"])
    // …and every one of them is required, which is what makes an unsourced one a publish gap.
    expect(smtpRequired()).toEqual(["to", "subject", "body"])
    // The needle is assembled at runtime so this file's own prose cannot satisfy the check.
    const undeclared = "c" + "c"
    expect(declared).not.toContain(undeclared)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 1 · ⭐ THE CROSS-LANGUAGE RENDERABILITY FENCE
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("argumentModel — renderable() mirrors args.py::renderable_property", () => {
  it("⭐ the SCALAR type sets are character-identical across the language boundary", () => {
    const py = pyScalarTypes()
    const ts = tsArray("SCALAR_TYPES")
    // NON-VACUITY CONTROL — ≥ 4 entries extracted on EACH side, asserted first. An empty
    // extraction would make the equality below free.
    expect(py.length, "python scalar types extracted").toBeGreaterThanOrEqual(4)
    expect(ts.length, "typescript scalar types extracted").toBeGreaterThanOrEqual(4)
    expect([...ts].sort()).toEqual([...py].sort())
  })

  it("⭐ the COMPOSITE key sets are character-identical too — the fail-closed half", () => {
    const py = pyCompositeKeys()
    const ts = tsArray("COMPOSITE_KEYS")
    expect(py.length, "python composite keys extracted").toBeGreaterThanOrEqual(4)
    expect(ts.length, "typescript composite keys extracted").toBeGreaterThanOrEqual(4)
    expect([...ts].sort()).toEqual([...py].sort())
  })

  it("the extractors really extract — a planted mismatch is visible", () => {
    // POSITIVE CONTROL for both regexes: they find quoted members inside their brackets.
    expect(quoted('{"a", "b"}')).toEqual(["a", "b"])
    expect(pyScalarTypes()).toContain("integer")
    expect(tsArray("SCALAR_TYPES")).toContain("integer")
    // …and a name that exists in neither yields nothing, so the matcher is not universal.
    expect(tsArray("NO_SUCH_ARRAY_NAME")).toEqual([])
  })

  it("scalars are renderable and composites are not", () => {
    for (const type of pyScalarTypes()) {
      expect(renderable({ type }), type).toBe(true)
    }
    for (const key of pyCompositeKeys()) {
      expect(renderable({ type: "string", [key]: {} }), key).toBe(false)
    }
  })

  it("an ARRAY-typed property is renderable: false — it gets named, never a box", () => {
    expect(renderable({ type: "array", items: { type: "string" } })).toBe(false)
    expect(renderable({ type: "object" })).toBe(false)
    // An ABSENT type refuses too — fail closed, never fall through.
    expect(renderable({ description: "no type at all" })).toBe(false)
    expect(renderable(null)).toBe(false)
    expect(renderable("string")).toBe(false)
  })

  it("a scalar enum is renderable; an enum of objects is not", () => {
    expect(renderable({ enum: ["low", "high"] })).toBe(true)
    expect(renderable({ enum: [1, 2, 3] })).toBe(true)
    expect(renderable({ enum: [] })).toBe(false)
    expect(renderable({ enum: [{ a: 1 }] })).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 2 · deriveRows — one row per DECLARED property
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("deriveRows — the walk is over the schema", () => {
  it("⭐ send_email derives exactly ['to','subject','body'] — the ORDER, then the length", () => {
    const { rows } = deriveRows(smtpSchema(), {}, {}, NO_UPSTREAM, "body")
    expect(rows.map((r) => r.key)).toEqual(["to", "subject", "body"])
    expect(rows).toHaveLength(3)
  })

  it("⭐ a stored `cc` is ONE leftover and NO field — rows stay at three", () => {
    const undeclared = "c" + "c"
    const { rows, leftovers } = deriveRows(
      smtpSchema(),
      { [undeclared]: "someone@example.test" },
      {},
      NO_UPSTREAM,
      "body",
    )
    expect(rows).toHaveLength(3)
    expect(rows.map((r) => r.key)).not.toContain(undeclared)
    expect(leftovers).toHaveLength(1)
    expect(leftovers[0].key).toBe(undeclared)
    expect(leftovers[0].value).toBe("someone@example.test")
  })

  it("required properties come first, then declaration order", () => {
    const schema = {
      type: "object",
      required: ["second"],
      properties: {
        first: { type: "string" },
        second: { type: "string" },
        third: { type: "string" },
      },
    }
    const { rows } = deriveRows(schema, {}, {}, NO_UPSTREAM, null)
    expect(rows.map((r) => r.key)).toEqual(["second", "first", "third"])
    expect(rows[0].required).toBe(true)
    expect(rows[1].required).toBe(false)
  })

  it("a null / absent / property-less schema derives NOTHING — no rows, no leftovers", () => {
    for (const schema of [null, undefined, {}, { type: "object" }, "nonsense", 7]) {
      const derived = deriveRows(schema, { anything: 1 }, {}, ONE_UPSTREAM, "body")
      expect(derived.rows, String(schema)).toEqual([])
      expect(derived.leftovers, String(schema)).toEqual([])
    }
  })

  it("an unrenderable property still gets a ROW — it is named, never routed elsewhere", () => {
    const schema = {
      type: "object",
      required: ["items"],
      properties: { items: { type: "array", items: { type: "string" } } },
    }
    const { rows } = deriveRows(schema, {}, {}, NO_UPSTREAM, null)
    expect(rows).toHaveLength(1)
    expect(rows[0].renderable).toBe(false)
    expect(rows[0].required).toBe(true)
    // ⛔ and it carries no options, so nothing downstream can draw a control for it.
    expect(rows[0].options).toBeUndefined()
  })

  it("kind and options come from the schema — enum, number, boolean", () => {
    const schema = {
      type: "object",
      properties: {
        tone: { enum: ["warm", "plain"] },
        count: { type: "integer" },
        urgent: { type: "boolean" },
        note: { type: "string", title: "The note" },
      },
    }
    const { rows } = deriveRows(schema, {}, {}, NO_UPSTREAM, null)
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]))
    expect(byKey.tone.kind).toBe("enum")
    expect(byKey.tone.options).toEqual(["warm", "plain"])
    expect(byKey.count.kind).toBe("number")
    expect(byKey.urgent.kind).toBe("boolean")
    expect(byKey.note.kind).toBe("string")
    // A declared `title` is the label; an absent one falls back to the key VERBATIM.
    expect(byKey.note.label).toBe("The note")
    expect(byKey.tone.label).toBe("tone")
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 3 · THE SOURCE LADDER
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("deriveRows — where each argument comes from", () => {
  it("a stored arg_source wins, and carries its ask key / upstream slug", () => {
    const { rows } = deriveRows(
      smtpSchema(),
      { to: "ignored-because-ask@example.test" },
      {
        to: { source: "ask", ask_key: "recipient" },
        subject: { source: "upstream", upstream_slug: "draft-the-note" },
      },
      ONE_UPSTREAM,
      "body",
    )
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]))
    expect(byKey.to.source).toBe("ask")
    expect(byKey.to.askKey).toBe("recipient")
    expect(byKey.to.upstreamSlug).toBeUndefined()
    expect(byKey.subject.source).toBe("upstream")
    expect(byKey.subject.upstreamSlug).toBe("draft-the-note")
    expect(byKey.subject.askKey).toBeUndefined()
  })

  it("D-214-08 — an existing tool_args key with no source reads as `fixed`", () => {
    const { rows } = deriveRows(smtpSchema(), { subject: "Weekly" }, {}, NO_UPSTREAM, "body")
    const subject = rows.find((r) => r.key === "subject")
    expect(subject?.source).toBe("fixed")
    expect(subject?.value).toBe("Weekly")
    expect(subject?.preset).toBe(false)
  })

  it("an EMPTY stored value is not a source — `to` still reads as nothing supplied", () => {
    const { rows } = deriveRows(smtpSchema(), { to: "   " }, {}, NO_UPSTREAM, "body")
    const to = rows.find((r) => r.key === "to")
    expect(to?.source).toBeNull()
  })

  it("an UNRECOGNISED stored source reads as no entry at all — never a fourth arm", () => {
    const { rows } = deriveRows(
      smtpSchema(),
      {},
      { to: { source: "telepathy" } },
      NO_UPSTREAM,
      "body",
    )
    expect(rows.find((r) => r.key === "to")?.source).toBeNull()
  })

  it("⭐ D-214-03 — the body row is PRE-SET to the immediately previous step", () => {
    const { rows } = deriveRows(smtpSchema(), {}, {}, TWO_UPSTREAM, "body")
    const body = rows.find((r) => r.key === "body")
    expect(body?.source).toBe("upstream")
    expect(body?.upstreamSlug).toBe("draft-the-note")
    expect(body?.preset).toBe(true)
    // …and NOTHING ELSE is pre-set. The rule applies to one field.
    expect(rows.filter((r) => r.preset)).toHaveLength(1)
  })

  it("the pre-set fires ONLY when no source is stored", () => {
    const { rows } = deriveRows(
      smtpSchema(),
      {},
      { body: { source: "ask", ask_key: "message" } },
      TWO_UPSTREAM,
      "body",
    )
    const body = rows.find((r) => r.key === "body")
    expect(body?.source).toBe("ask")
    expect(body?.preset).toBe(false)
  })

  it("the pre-set fires ONLY when an upstream step exists — the first step gets none", () => {
    const { rows } = deriveRows(smtpSchema(), {}, {}, NO_UPSTREAM, "body")
    const body = rows.find((r) => r.key === "body")
    expect(body?.source).toBeNull()
    expect(body?.preset).toBe(false)
  })

  it("a stored tool_args value OUTRANKS the pre-set — same order the executor uses", () => {
    // `resolve_arguments` fills `body_arg` only `if body_arg not in args`, so an author's
    // own fixed value wins there too. The two must agree or the form lies about the send.
    const { rows } = deriveRows(smtpSchema(), { body: "Typed by hand" }, {}, TWO_UPSTREAM, "body")
    const body = rows.find((r) => r.key === "body")
    expect(body?.source).toBe("fixed")
    expect(body?.preset).toBe(false)
  })

  it("no bodyArgKey means no pre-set anywhere — an MCP tool has no body field", () => {
    const { rows } = deriveRows(smtpSchema(), {}, {}, TWO_UPSTREAM, null)
    expect(rows.every((r) => r.preset === false)).toBe(true)
    expect(rows.every((r) => r.source === null)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 4 · ⛔ NO ESCAPE HATCH IS DERIVABLE FROM THIS MODULE
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("argumentModel — source purity", () => {
  it("⛔ names no serialiser, no parser and no free-form control", () => {
    // Needles assembled at RUNTIME (the 187-24 trap): a fence that spells its own needle
    // counts its own prose and can be satisfied by the comment describing it.
    const lowered = argumentModelSource.toLowerCase()
    for (const needle of [
      "text" + "area",
      "js" + "on.parse",
      "js" + "on.stringify",
      "js" + "on",
      "adv" + "anced",
      "key" + "-value",
      "key" + "/value",
    ]) {
      expect(lowered.includes(needle), needle).toBe(false)
    }
    // NON-VACUITY: the haystack really is this module, and the matcher really matches.
    expect(lowered.includes("export function derive" + "rows")).toBe(true)
    expect("a plain js".concat("on box").toLowerCase().includes("js" + "on")).toBe(true)
  })

  it("is a ZERO-IMPORT leaf — no runtime import of any kind", () => {
    expect(argumentModelSource).not.toMatch(/^import\s/m)
    // POSITIVE CONTROL — the pattern really matches an import line.
    expect('import { x } from "y"').toMatch(/^import\s/m)
  })

  it("performs no I/O and holds no React state", () => {
    expect(argumentModelSource).not.toMatch(/fetch\(|useState|useEffect|useContext|@\/lib\/api/)
    expect("const [a] = useState(0)").toMatch(/fetch\(|useState|useEffect|useContext|@\/lib\/api/)
  })
})

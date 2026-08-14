/**
 * Phase 193.1-09 (AUTH-03 / SC#3 — D-10 / D-20) — templateNameBuckets: which of a template's
 * fields the draft's own steps NAME, as one pure function.
 *
 * A template attached to an already-drafted workflow says nothing about the fit. This module
 * answers the only question the app can honestly answer at ATTACH time: for each field the
 * document asks for, does anything in the definition go by that name? It renders nothing,
 * holds no state, imports no component and makes no network call — the `libraryFilter.ts` /
 * `verdictModel.ts` shape, and for the same stated reason: this is arithmetic, and arithmetic
 * proved through a DOM is proved expensively and incompletely.
 *
 * ⚠ IT IS A NAME CHECK, AND IT IS NOT A COVERAGE CHECK. That distinction is not politeness —
 * it is the difference between a heuristic and a verdict. At attach time all that exists is
 * NAMES. The real coverage answer runs at RUN time over an emitted field map WITH VALUES and
 * produces the covered-key set, the covers-template flag and the null-leaf count. Nothing in
 * this module may be presented as that answer, and the component that renders its result
 * carries the disclaiming sentence on every non-empty render for exactly this reason.
 *
 * ── THE THREE BUCKETS AND THE SOURCES THAT ACTUALLY EXIST (D-20) ──────────────────────────
 *
 *   produced by a step   ← a phase's own `slug`. This is what the backend's reachability
 *                          check accumulates as "produced" as it walks the phases in index
 *                          order, so it is the engine's own notion, not a new one.
 *   supplied as a run input ← a `key` on the DEFINITION-level input list (a sibling of
 *                          `phases`), plus the two keys the engine itself always supplies.
 *   named nowhere        ← the remainder.
 *
 * ⚠ TWO SOURCES THE PHASE'S OWN CONTEXT NAMED ARE NOT READ HERE, DELIBERATELY, AND THE REASON
 * IS RECORDED SO NOBODY "FIXES" THE OMISSION BACK IN.
 *
 *   1. A per-step OUTPUT-key list. **It is not a schema field at all.** It appears on none of
 *      the seven phase-config models, and every one of them forbids extra keys — so writing
 *      one raises a validation error at every save, validate and publish boundary. It survives
 *      only as a dead defensive lookup in the backend's reachability walk, and **0 of the 223
 *      live definitions carry one**. A code path that read it would be reading an empty list
 *      forever, which is worse than reading nothing: it would look like a source.
 *   2. A per-step INPUT-key list. It exists on exactly ONE of the seven config types, and it
 *      means *keys this step reads from PRIOR phases* — an input to a STEP, not an input to a
 *      RUN. Using it for the run-input bucket is a category error, and the run-input bucket is
 *      the false-alarm guard, so getting it wrong is not a cosmetic mistake.
 *
 * ⚠ NEITHER IDENTIFIER IS SPELLED ANYWHERE IN THIS FILE, INCLUDING IN THIS DOCBLOCK, AND THAT
 * IS A CHECKED PROPERTY RATHER THAN A HABIT. The suite reads this file's own source and
 * asserts both tokens are absent, with a positive control proving the detector works. A
 * docblock that spelled one would red that fence — which is the fence working, not misfiring.
 *
 * ── THE DEGENERATE CASE IS THE COMMON CASE, AND IT IS DESIGNED FOR FIRST ───────────────────
 * Measured over the live corpus at execution time: 223 definitions, **74** bind a template,
 * and across all 74 the number of phase slugs matching any of the eight known placeholder
 * names is **0**. Real slugs are verbs — `retrieve` ×70, `emit` ×69 — and real placeholders
 * are nouns — `project_name`, `risks_blockers`, `overall_rag_status`. Rows with a non-empty
 * definition-level input list: **3 of 223**, all keyed `question`.
 *
 * **So the honest expectation is `produced 0 · runInput 0 · nowhere ALL`, and the surface must
 * survive that as its FIRST render rather than as an edge case.** Re-measured again after the
 * fix that made template-aware drafts real: the run-input list stayed empty on 6 of 6 runs and
 * slug reach was 0–2 of 8. This is not a defect in the draft and must never be rendered as
 * one — an empty bucket renders NO claim, which is the rule one surface up from here.
 *
 * ── HOW UNTYPED JSONB IS READ ─────────────────────────────────────────────────────────────
 * The Builder's working definition type carries an index signature, so both arrays arrive
 * PRESENT BUT UNTYPED. The shipped defensive posture is copied verbatim from the page's own
 * template-descriptor lookup: a non-array or absent value is treated as EMPTY and never
 * spread, every field is coerced with a `typeof` check, and each array is read through ONE
 * resolution — that memo's own comment records the rule, *two lookups over the same array
 * could drift*.
 */

/** The definition, as much of it as this module reads. The index signature mirrors the
 *  Builder's working type: everything here arrives from JSONB and is untyped at runtime. */
export interface NameCheckDefinition {
  phases?: unknown
  inputs?: unknown
  [k: string]: unknown
}

/** The three buckets. A field is in exactly one; the arrays hold the field name EXACTLY AS
 *  THE DOCUMENT SPELLED IT, in the order the document asked. */
export interface TemplateNameClassification {
  /** A step goes by this name. */
  produced: string[]
  /** The run supplies this — nothing produces it and nothing should. */
  runInput: string[]
  /** Nothing in the steps NAMES this. Never "missing", never "uncovered". */
  nowhere: string[]
}

/**
 * The two keys the engine itself always supplies to a run, regardless of what any definition
 * declares. They belong in the run-input bucket for the same reason the declared keys do: a
 * field the run supplies is not a gap.
 *
 * They are also the one part of the answer that survives an unreadable definition — knowledge
 * about the ENGINE, not about this workflow — which the suite pins, because losing the
 * false-alarm guard exactly when the definition is least trustworthy is the worst time to
 * lose it.
 */
export const ENGINE_KNOWN_RUN_INPUT_KEYS: readonly string[] = ["kickoff_prompt", "topic"]

/** The comparison key. Trimmed and case-folded on BOTH sides, so a document that spells a
 *  field `Project_Name` and a step slugged `project_name` are the same name. */
function fold(value: string): string {
  return value.trim().toLowerCase()
}

/** One resolution over an untyped array: entries that are not objects, or whose named field
 *  is not a string, contribute nothing rather than throwing. */
function foldedStringsAt(value: unknown, field: string): Set<string> {
  const out = new Set<string>()
  if (!Array.isArray(value)) return out
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue
    const raw = (entry as Record<string, unknown>)[field]
    if (typeof raw !== "string") continue
    const folded = fold(raw)
    if (folded.length > 0) out.add(folded)
  }
  return out
}

/**
 * Classify each template field into exactly one bucket.
 *
 * PRECEDENCE IS DECLARED, NOT INCIDENTAL: a name that is BOTH a declared run input and a
 * phase slug is `runInput`. The run-input bucket is the false-alarm guard, and the engine's
 * own knowledge outranks a slug coincidence — a field the run supplies is not a gap however a
 * step happens to be named.
 *
 * @param fields     The names the document asks for, in the server's order.
 * @param definition The workflow being authored. May be absent or unreadable.
 */
export function classifyTemplateNames(
  fields: readonly string[],
  definition: NameCheckDefinition | null | undefined,
): TemplateNameClassification {
  const slugs = foldedStringsAt(definition?.phases, "slug")
  const declared = foldedStringsAt(definition?.inputs, "key")
  const runInputs = new Set<string>([...declared, ...ENGINE_KNOWN_RUN_INPUT_KEYS.map(fold)])

  const result: TemplateNameClassification = { produced: [], runInput: [], nowhere: [] }
  for (const field of fields) {
    const key = fold(field)
    // Order matters and is the precedence rule above, stated in code.
    if (runInputs.has(key)) result.runInput.push(field)
    else if (slugs.has(key)) result.produced.push(field)
    else result.nowhere.push(field)
  }
  return result
}

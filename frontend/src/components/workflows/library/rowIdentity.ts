/**
 * Phase 192.1-05 (LIB-05 / SC#1 / SC#2 — D-03…D-07, D-09, D-12, D-13, D-16, D-31, D-32, D-34)
 * — THE IDENTITY RESOLVER: what tells THIS row apart from the rows that share its name.
 *
 * Forty-three rows called *Compliance Gap Report* is not corrupt data — it is forty-two correct
 * forks of one starter, because both fork paths copy the name verbatim. This module answers, per
 * row, the only question that helps a person in that library: *of the facts we hold, which ones
 * narrow this row away from its namesakes?* It renders nothing, holds no state and imports no
 * React, so every rule below is provable as arithmetic — the `libraryFilter.ts:1-27` posture, and
 * for the reason stated there: correctness proved through a DOM is proved expensively and
 * incompletely.
 *
 * PURE + CLIENT-SIDE. **Nothing here is imported from the API client at runtime** (the wire types
 * arrive through `LibraryRow`), nothing is asynchronous, and nothing reaches for a definition it
 * was not handed. A row's identity is a function of the LIST it is in and of nothing else.
 *
 * ── ⚠ D-34 — A PRECOMPUTED INDEX, NEVER A PER-ROW SCAN ─────────────────────────────────
 * The approved sketch's `identity(row, rows)` (`163/index.html:297-320`) is worst-case **O(n³)**:
 * `lineagePhrase` is called once per sibling and each call scans the whole list. RESEARCH §4a
 * measured it at ≈ **230,000 inner-loop iterations per render** on the operator's shape — twice
 * per render, on every keystroke, because the search box is page state. So the work is done ONCE
 * per list, in passes, and `resolveIdentity` is O(1):
 *
 *   pass 1   `bySlug` · `byName` · `versionsBySlug`            O(n)
 *   pass 1b  `predecessorBySlug` — one sort per MULTI-VERSION slug, over that slug's own
 *            version NUMBERS                                   O(Σ kᵢ log kᵢ), skipped entirely
 *                                                              for the single-version majority
 *   pass 2   `lineageByRowId` — each row resolved exactly ONCE O(n)
 *   pass 3   `narrowedByName` — one value histogram per FAMILY per axis, not per row
 *                                                              O(n × axes)
 *
 * ⚠ THE COST IS STATED PRECISELY RATHER THAN ROUNDED TO "O(n)". Pass 1b sorts, so the honest
 * worst case is `n log n` — reached only if EVERY row shares one slug at a distinct version. On
 * the operator's real table (222 rows / 201 slugs) the largest slug group is a handful, so the
 * whole build is linear in practice. The claim that actually matters is the one the suite
 * measures: **resolving all n rows costs a CONSTANT number of value computations per row**, not
 * a scan per row, which is the n³ the sketch would have shipped.
 *
 * The counters on `IdentityIndex.stats` are the ONLY mutable state in this module and they exist
 * so that claim is a MEASUREMENT rather than a comment (`rowIdentity.test.ts`'s call-count
 * property). Nothing at runtime reads them.
 *
 * ── ⚠ D-32 — `Map` / `Set` THROUGHOUT, NEVER AN OBJECT LITERAL ─────────────────────────
 * Every lookup here is keyed by a SLUG or a NAME, i.e. by a user-influenced string, and two
 * prototype-pollution bugs of exactly this class are OPEN in this repo (`BUG-260807-01`,
 * `BUG-260808-01`). `libraryFilter.ts:129-135` records the house argument verbatim: *"The `Map` is
 * what turns an invariant held by a call site into one held by code."* This is not theoretical
 * here — the sketch-shaped stub this module replaced was OBSERVED resolving `constructor-a1b2c3`
 * to `Object.prototype.constructor` and reporting a copy of a FUNCTION.
 *
 * ── ⚠ D-13 — LINEAGE HAS FOUR STATES AND THE FOURTH IS SILENCE ─────────────────────────
 * A `Lineage | null` return cannot carry this and would silently re-introduce a fabricated claim
 * (RESEARCH §4c calls it the single most important type-level decision in the resolver). Measured
 * against the live local DB 2026-08-12: **57 resolve · 12 go quiet · 0 lie.** The parent-exists
 * guard is load-bearing and the charset cannot be narrowed to rescue it — `freshHash()` really is
 * `Math.random().toString(36)`, so `report` is a legal six-character hash and
 * `pm-weekly-status-report` matches the copy shape for that reason alone. The sketch answers
 * `Original` there; on real data that labels a genuine copy whose parent was deleted (or is
 * invisible to this reader) an original, which is the one place this port deliberately does not
 * follow the mockup.
 *
 * ── ⚠ D-31 — `varies()` IS REPLACED BY A DISCRIMINATION RANKER ─────────────────────────
 * THE APPROVED SKETCH IS OVERRIDDEN HERE, AND ONLY HERE, BECAUSE A MEASUREMENT CONTRADICTED IT ON
 * THE EXACT CLUSTER THIS PHASE WAS INSERTED FOR. Over the 44 rows named *Compliance Gap Report*
 * (live local DB, 2026-08-12): lineage is `varies() === true` because exactly ONE outlier differs,
 * so slot 1 goes to a phrase **43 of 44** rows share; slot 2 then goes to `Still building`, which
 * **41** share. **The flagship family would render 40+ byte-identical lines.** The generated
 * fixture could not surface it — its rows carry real definitions, so its projects and tiers
 * genuinely vary. That is the *same shape* of miss the phase exists to fix (a corpus whose SIZE
 * was real and whose SHAPE was not), one level deeper.
 *
 * The replacement is faithful to 160-B's own stated principle — *"compute what actually differs
 * among the rows sharing its name, and print only that"*:
 *
 *   for each candidate axis A, `narrowed(A)` = how many siblings share THIS ROW'S OWN value;
 *   DROP any axis with `narrowed(A) === N` (it excludes nobody);
 *   rank the rest by `narrowed(A)` ASCENDING, tie-broken by D-04's order
 *   (`lineage → project → state → version`); spend at most 2.
 *
 * D-04's order survives as the TIE-BREAK, so where the axes genuinely differ the output is the
 * sketch's and its driven assertions still hold.
 *
 * ⚠ AND THE RESIDUAL IS REPORTED, NOT PAPERED OVER. No ranker can separate rows identical in every
 * fact the product holds. On the dev-data family the best available pair still leaves ~39 of 44
 * indistinguishable; `1 of 44` is then exactly what it says — a true warning that this row is not
 * distinguishable — **and the product's answer is to give it a name, which is what 162-B ships.**
 * There is deliberately NO technical discriminator here: no slug fragment, no id fragment, no
 * created-at. That is the vocabulary drift the 187 node-face ladder forbids, and inventing one
 * would trade an honest warning for a meaningless one.
 *
 * ── ⚠ THE PROJECT AXIS CAN RANK BUT USUALLY CANNOT SPEAK, AND THAT IS DELIBERATE ───────
 * Two independent reasons, both structural rather than incidental:
 *   1. A project's NAME is not in a `LibraryRow` — `def.project_folder_id` is a UUID, and the
 *      folder list lives on the page. This module takes rows and nothing else (D-05's memo key is
 *      `[rows]` ALONE), and a UUID is not a word: D-14 requires every rendered string to come from
 *      `libraryVocabulary.ts`.
 *   2. The card already paints the project one node BELOW this line — the folder chip
 *      (`WorkflowCard.tsx:383-387`), which D-08 places immediately after the identity line. A
 *      segment repeating it would spend one of two slots on something the reader can already see.
 * So the axis contributes its folder id to the histogram (a row in Legal is genuinely narrowed
 * against a row in Finance) but the only project segment it can RENDER is `NO_PROJECT` — the case
 * the chip cannot show, because the chip renders nothing when a row is unbound. A row inside a
 * named project falls through to the next axis, which is a MISSING segment, not a wrong one.
 *
 * ⚠ P-7 — `LibraryRow.def` is `undefined` on most dev rows (SEED-154: 83 of 104 definitions are
 * double-encoded string scalars), so for those rows the axis is ABSENT entirely. **Do not "fix"
 * that here.** A `def ?? fetchDefinition()` path would make a pure module asynchronous and would
 * be a different phase; the max-2 rule already falls through to the next axis.
 *
 * ── WHAT THIS MODULE DOES NOT DO ───────────────────────────────────────────────────────
 * ⚠ IT NEVER RE-ORDERS THE ROW LIST (T-7 / P-4). `163/index.html:557` sorts by name; the shipped
 * page does not, and `mergeLibrary` concatenates in feed order. The only `sort` below ranks FOUR
 * AXES for one row and a slug's own version numbers — **NEVER THE ROW LIST**. Porting the sketch's
 * sort would re-litigate 160-C, which lost.
 * ⚠ It reads recency from `updatedAt` and from nothing else (D-16). The draft feed carries a
 * second field rendered from the same column which looks like a timestamp and is opaque by
 * contract; `libraryRow.ts:109-112` states that trap where the field is declared, and this module
 * does not name it at all.
 * ⚠ It renders no owner display name (D-09) — `Yours` / `Shared` is the honest ceiling, and that
 * is a fence in `librarySubtree.fences.test.ts`, not a preference.
 * ⚠ It takes no `failedSources` input (D-28): `1 of N` is NOT suppressed when a feed fails. The
 * `source-failed` banner is the disclosure, spent in ONE place rather than 106 times.
 */
import { CHIP_PREDICATES } from "./libraryFilter"
import type { LibraryRow } from "./libraryRow"
import {
  LINEAGE_COPY_OF,
  LINEAGE_ORIGINAL,
  LINEAGE_STARTER_SUF,
  NO_PROJECT,
  OWN_SHARED,
  OWN_YOURS,
  STATE_DRAFT,
  STATE_RUNNABLE,
  STATE_STARTER,
  lineageVersionOf,
  oneOfLabel,
  versionLabel,
} from "./libraryVocabulary"
import { relativeChanged } from "./relativeChanged"

// ── the contract ─────────────────────────────────────────────────────────────────────

/**
 * What a row came from, in four states — see the ⚠ D-13 block in this file's header.
 * `"unknown"` is not an error case: it is the honest answer when a slug is shaped like a copy
 * and the parent it names is not in the list, and it RENDERS NOTHING AT ALL.
 */
export type Lineage =
  | { kind: "original" }
  | { kind: "copy"; ofName: string; ofIsStarter: boolean }
  | { kind: "version"; mine: number; parent: number }
  | { kind: "unknown" }

/**
 * The four candidate discriminators, in D-04's priority order. That order is now only the
 * TIE-BREAK (D-31) — but it is still total, and the `as const satisfies Record<…>` table below is
 * what makes it so: a fifth axis added to this union without a value extractor is a TYPECHECK
 * ERROR rather than an axis that silently never fires.
 */
export type IdentityAxis = "lineage" | "project" | "state" | "version"

/** Everything the card paints on the identity line, already resolved. The card computes nothing. */
export interface RowIdentity {
  /** `OWN_YOURS` | `OWN_SHARED` — read from the ONE shipped ownership predicate (D-09). */
  own: string
  /** The computed discriminators. **Never more than two** (D-04), often none (D-06). */
  segs: readonly string[]
  /** `oneOfLabel(n)` — present ONLY when the name collides (D-04), counted over the FULL list. */
  ofN: string | null
  /** `relativeChanged(updatedAt, now)` — `null` when the wire did not say (never fabricated). */
  when: string | null
}

/** The measurements that make this module's complexity claim checkable rather than asserted. */
export interface IdentityIndexStats {
  /** How many rows the index was built over. */
  readonly rows: number
  /** Lineage resolutions performed during the BUILD. Must equal `rows` — once each, never more. */
  lineageResolutions: number
  /** How many slugs needed their version list sorted (pass 1b). Zero on a single-version library. */
  versionSorts: number
  /** `resolveIdentity` calls since the build. */
  resolveCalls: number
  /**
   * Axis value computations performed INSIDE `resolveIdentity`. The O(1) claim is exactly that
   * this grows by a bounded constant per call and never with the size of the list.
   */
  resolveAxisComputations: number
}

/**
 * The precomputed index. **Opaque to callers** — build it once per `rows` change (D-05/D-34: the
 * memo key is `[rows]` ALONE; the nearest precedent, `counts` at `WorkflowsPage.tsx:472`, is keyed
 * `[rows, query, selectedProjectId]` and copying that key would silently violate D-05) and hand it
 * back to `resolveIdentity` per row. Only `size` and `stats` are meant to be read from outside.
 */
export interface IdentityIndex {
  readonly size: number
  readonly stats: IdentityIndexStats
  /** @internal */ readonly byName: ReadonlyMap<string, readonly LibraryRow[]>
  /** @internal */ readonly lineageByRowId: ReadonlyMap<string, Lineage>
  /** @internal */ readonly narrowedByName: ReadonlyMap<
    string,
    ReadonlyMap<IdentityAxis, ReadonlyMap<string, number>>
  >
}

// ── the lineage rules (D-12 / D-13) ───────────────────────────────────────────────────

/**
 * The copy-fork slug shape — `<base>-<6 base-36 chars>`, the shape `freshHash()` mints.
 *
 * ⚠ IT IS GREEDY ON PURPOSE. `risk-register-fill-101uat` captures `risk-register-fill`, NOT
 * `risk-register` — and `risk-register` really does exist in the operator's library, so a lazy
 * quantifier would resolve that row to the wrong parent and print a confident lie.
 */
const COPY_SLUG_SHAPE = /^(.*)-[a-z0-9]{6}$/

/** D-04's priority order — now the tie-break (D-31), still total. */
const AXIS_ORDER: readonly IdentityAxis[] = ["lineage", "project", "state", "version"]

/**
 * A row's value on one axis: `key` is what the histogram counts, `seg` is what a person reads.
 * They differ on purpose in two places — `unknown` lineage and a NAMED project both have a value
 * a row can share (so they narrow) while having nothing this module may print (so they cannot be
 * spent). `null` from an extractor means the axis is ABSENT for this row: unknowable, not empty.
 */
interface AxisValue {
  key: string
  seg: string | null
}

/** A key that no rendered phrase can collide with — silence is a value siblings can share. */
const SILENT_KEY = " silent"

/**
 * The rendered lineage phrase, or `null` for D-13's silence.
 *
 * The runtime default is `libraryFilter.ts:234-240`'s exhaustiveness guard applied to a union
 * rather than to a feed: a fifth lineage state is a COMPILE error via `_never`, and at runtime an
 * unrecognised one goes quiet rather than printing a shape nobody wrote — silence is this
 * module's honest answer everywhere else, so it is the honest answer here too.
 */
function lineagePhrase(lineage: Lineage): string | null {
  switch (lineage.kind) {
    case "original":
      return LINEAGE_ORIGINAL
    case "copy":
      return LINEAGE_COPY_OF + lineage.ofName + (lineage.ofIsStarter ? LINEAGE_STARTER_SUF : "")
    case "version":
      return lineageVersionOf(lineage.mine, lineage.parent)
    case "unknown":
      return null
    default: {
      const _never: never = lineage
      void _never
      return null
    }
  }
}

/**
 * ⚠ THE BRANCH IS DERIVED, NEVER READ FROM A FIELD, and the order is the sketch's — VERSION
 * FIRST. The mockup selects the version branch from a generator-only bookkeeping field that has no
 * production equivalent (RESEARCH §4d); deleting it is exactly what admits D-13's orphans.
 *
 * The order matters and is exercised by the suite: `compliance-gap-report` at v2 matches the copy
 * shape AND has a lower-versioned sibling. It is a version fork, and the same row alone in a list
 * goes quiet.
 *
 * ⚠ THE COPY PARENT IS THE ORIGIN OF THE PARENT SLUG (its lowest version), NOT WHICHEVER ROW CAME
 * LAST. The sketch's `parent = o` overwrite is feed-order dependent, so on a slug carrying both a
 * v1 starter and a v2 draft it flips the ` starter` suffix depending on which feed answered first
 * — observed, not reasoned: the sketch-shaped stub failed exactly that case on the fixture.
 */
function resolveLineage(
  row: LibraryRow,
  bySlug: ReadonlyMap<string, readonly LibraryRow[]>,
  predecessorBySlug: ReadonlyMap<string, ReadonlyMap<number, number>>,
): Lineage {
  if (typeof row.version === "number") {
    const parentVersion = predecessorBySlug.get(row.slug)?.get(row.version)
    if (typeof parentVersion === "number") {
      return { kind: "version", mine: row.version, parent: parentVersion }
    }
  }

  const shape = COPY_SLUG_SHAPE.exec(row.slug)
  if (!shape) return { kind: "original" }

  // ⚠ A `Map`, so a base named `constructor` / `__proto__` / `toString` is ABSENT rather than
  // inherited. See the ⚠ D-32 block in the header — this is the line that bug lands on.
  const parents = bySlug.get(shape[1])
  if (!parents || parents.length === 0) return { kind: "unknown" }

  let origin = parents[0]
  for (const candidate of parents) {
    if ((candidate.version ?? Number.MAX_SAFE_INTEGER) < (origin.version ?? Number.MAX_SAFE_INTEGER)) {
      origin = candidate
    }
  }
  return { kind: "copy", ofName: origin.name, ofIsStarter: origin.provenance === "starter" }
}

// ── the four axes (D-04 / D-31) ───────────────────────────────────────────────────────

/**
 * One value extractor per axis, in the `deriveTier.ts:57-79` idiom that `libraryFilter.ts:143-166`
 * cites: `as const satisfies Record<IdentityAxis, …>`, so the union and the table cannot drift.
 */
const AXES = {
  /** What it came from. Silence RANKS (siblings can share it) but cannot be SPENT. */
  lineage: (_row: LibraryRow, lineage: Lineage): AxisValue => {
    const phrase = lineagePhrase(lineage)
    return phrase === null ? { key: SILENT_KEY, seg: null } : { key: phrase, seg: phrase }
  },
  /** Where it lives. See the ⚠ project block in the header for why only the absence speaks. */
  project: (row: LibraryRow): AxisValue | null => {
    if (!row.def) return null // SEED-154 / P-7 — unknowable, not "no project"
    const bound = row.def.project_folder_id
    return bound ? { key: `folder:${bound}`, seg: null } : { key: "folder:none", seg: NO_PROJECT }
  },
  /** What it is right now. */
  state: (row: LibraryRow): AxisValue | null => {
    switch (row.provenance) {
      case "draft":
        return { key: STATE_DRAFT, seg: STATE_DRAFT }
      case "starter":
        return { key: STATE_STARTER, seg: STATE_STARTER }
      case "published":
        return { key: STATE_RUNNABLE, seg: STATE_RUNNABLE }
      default: {
        // A fourth feed decides its own word here rather than inheriting one silently.
        const _never: never = row.provenance
        void _never
        return null
      }
    }
  },
  /** Which cut of it. `undefined` stays absent — a fabricated `v1` is a lie a reader cannot see. */
  version: (row: LibraryRow): AxisValue | null => {
    if (typeof row.version !== "number") return null
    const label = versionLabel(row.version)
    return { key: label, seg: label }
  },
} as const satisfies Record<IdentityAxis, (row: LibraryRow, lineage: Lineage) => AxisValue | null>

// ── the index ─────────────────────────────────────────────────────────────────────────

function pushInto<K, V>(into: Map<K, V[]>, key: K, value: V): void {
  const bucket = into.get(key)
  if (bucket) bucket.push(value)
  else into.set(key, [value])
}

/**
 * Build the whole library's identity index. Call it ONCE per `rows` change (D-34) — the page's
 * `useMemo` key is `[rows]` and nothing else (D-05).
 */
export function buildIdentityIndex(rows: readonly LibraryRow[]): IdentityIndex {
  const stats: IdentityIndexStats = {
    rows: rows.length,
    lineageResolutions: 0,
    versionSorts: 0,
    resolveCalls: 0,
    resolveAxisComputations: 0,
  }

  // ── pass 1 — O(n). Every lookup a Map, every key a user-influenced string (D-32).
  const bySlug = new Map<string, LibraryRow[]>()
  const byName = new Map<string, LibraryRow[]>()
  const versionsBySlug = new Map<string, number[]>()
  for (const row of rows) {
    pushInto(bySlug, row.slug, row)
    pushInto(byName, row.name, row)
    if (typeof row.version === "number") pushInto(versionsBySlug, row.slug, row.version)
  }

  // ── pass 1b — the nearest-lower-version table, ONE per multi-version slug.
  // ⚠ THIS SORTS A SLUG'S OWN VERSION NUMBERS — **NEVER THE ROW LIST** (T-7 / P-4). A slug with
  // one version skips it entirely, which is the overwhelming majority: 222 rows / 201 slugs.
  const predecessorBySlug = new Map<string, Map<number, number>>()
  for (const [slug, versions] of versionsBySlug) {
    if (versions.length < 2) continue
    const ascending = [...new Set(versions)].sort((a, b) => a - b)
    if (ascending.length < 2) continue
    stats.versionSorts += 1
    const predecessor = new Map<number, number>()
    for (let i = 1; i < ascending.length; i++) predecessor.set(ascending[i], ascending[i - 1])
    predecessorBySlug.set(slug, predecessor)
  }

  // ── pass 2 — each row's lineage, resolved exactly ONCE. O(n).
  const lineageByRowId = new Map<string, Lineage>()
  for (const row of rows) {
    lineageByRowId.set(row.id, resolveLineage(row, bySlug, predecessorBySlug))
    stats.lineageResolutions += 1
  }

  // ── pass 3 — per-FAMILY value histograms, once per family rather than once per row. O(n×axes).
  // This is the whole D-31 ranker's input: `narrowed(A)` for a row is a Map lookup afterwards.
  const narrowedByName = new Map<string, Map<IdentityAxis, Map<string, number>>>()
  for (const [name, family] of byName) {
    const perAxis = new Map<IdentityAxis, Map<string, number>>()
    for (const axis of AXIS_ORDER) perAxis.set(axis, new Map<string, number>())
    for (const sibling of family) {
      const lineage = lineageByRowId.get(sibling.id) ?? { kind: "unknown" }
      for (const axis of AXIS_ORDER) {
        const value = AXES[axis](sibling, lineage)
        const histogram = perAxis.get(axis)
        if (!value || !histogram) continue
        histogram.set(value.key, (histogram.get(value.key) ?? 0) + 1)
      }
    }
    narrowedByName.set(name, perAxis)
  }

  return { size: rows.length, stats, byName, lineageByRowId, narrowedByName }
}

/**
 * A row's lineage as the index resolved it.
 *
 * Exported so D-13's four states are assertable DIRECTLY rather than through the prose they
 * render — a type nothing can produce a value of is a type no test can pin. A row the index never
 * saw claims nothing: `unknown`, never `original`, for the same reason the orphans go quiet.
 */
export function lineageOf(index: IdentityIndex, row: LibraryRow): Lineage {
  return index.lineageByRowId.get(row.id) ?? { kind: "unknown" }
}

// ── the D-31 discrimination ranker ────────────────────────────────────────────────────

interface RankedAxis {
  narrowed: number
  priority: number
  seg: string
}

/**
 * The replacement for the sketch's `varies()` — see the ⚠ D-31 block in the header.
 *
 * Drop what excludes nobody, rank what remains by how much it narrows, break ties on D-04's
 * order, spend two. An axis that cannot RENDER for this row (a named project, D-13's silence) is
 * not a candidate — but its value is already in the histogram, so it still narrows the siblings
 * that CAN spend it.
 */
function rankedSegments(
  index: IdentityIndex,
  row: LibraryRow,
  lineage: Lineage,
  familySize: number,
): string[] {
  const histograms = index.narrowedByName.get(row.name)
  const candidates: RankedAxis[] = []

  for (let priority = 0; priority < AXIS_ORDER.length; priority++) {
    const axis = AXIS_ORDER[priority]
    index.stats.resolveAxisComputations += 1
    const value = AXES[axis](row, lineage)
    if (!value || value.seg === null) continue
    const narrowed = histograms?.get(axis)?.get(value.key) ?? 1
    // D-31's first clause: an axis every namesake answers identically excludes NOBODY, so
    // spending a slot on it costs the reader a segment and buys nothing.
    if (narrowed === familySize) continue
    candidates.push({ narrowed, priority, seg: value.seg })
  }

  // ⚠ AXIS RANKING — this orders at most FOUR CANDIDATE AXES for one row, **NEVER THE ROW LIST**.
  candidates.sort((a, b) => a.narrowed - b.narrowed || a.priority - b.priority)
  return candidates.slice(0, 2).map((candidate) => candidate.seg)
}

/**
 * One row's identity line, resolved. O(1) — every question below is a Map lookup or a bounded
 * per-row computation; nothing here walks the list.
 */
export function resolveIdentity(index: IdentityIndex, row: LibraryRow, now: number): RowIdentity {
  index.stats.resolveCalls += 1

  const lineage = lineageOf(index, row)
  const family = index.byName.get(row.name)
  // A row the index never saw collides with nobody — the honest reading of "not in the list".
  const familySize = family ? family.length : 1
  const collides = familySize > 1
  const phrase = lineagePhrase(lineage)

  let segs: string[]
  if (collides) {
    segs = rankedSegments(index, row, lineage, familySize)
    // D-06's identity half: when NOTHING narrows this row, it can still say what it came from.
    // That is identity rather than disambiguation, and it is the sketch's own final clause
    // (`if (!segs.length && lp)`) — kept, because D-31 replaces `varies()` and nothing else.
    if (segs.length === 0 && phrase !== null) segs = [phrase]
  } else {
    // D-06's operator decision — a unique name carries NO discriminators. Lineage only, and only
    // when the row is really a fork: `Original` on a row nothing collides with is noise.
    segs = phrase !== null && phrase !== LINEAGE_ORIGINAL ? [phrase] : []
  }

  return {
    own: CHIP_PREDICATES.yours(row) ? OWN_YOURS : OWN_SHARED,
    segs,
    // ⚠ D-05 — counted over the FULL merged library, BEFORE search / chip / project filtering.
    ofN: collides ? oneOfLabel(familySize) : null,
    when: relativeChanged(row.updatedAt, now),
  }
}

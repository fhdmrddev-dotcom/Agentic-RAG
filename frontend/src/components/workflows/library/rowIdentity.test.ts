/**
 * Phase 192.1-05 (LIB-05 / SC#1 / SC#2 — D-03…D-07, D-09, D-12, D-13, D-16, D-31, D-32, D-34)
 * — THE IDENTITY RESOLVER'S CONTRACT.
 *
 * Pure arithmetic over a list of rows, so every rule below is proved with ZERO rendering —
 * the `libraryFilter.test.ts` posture, and for its stated reason: the correctness of an
 * identity line is arithmetic, and arithmetic proved through a DOM is proved expensively and
 * incompletely.
 *
 * ── EVERY ABSENCE CARRIES A POSITIVE CONTROL (S-6) ─────────────────────────────────────
 * `libraryFilter.test.ts:34-38`'s clause, applied to a resolver rather than to a filter:
 * *"a corpus where every row answers every predicate the same way makes each assertion pass
 * for the wrong reason."* So a test that a segment is ABSENT is always paired with one that
 * makes the SAME call produce it.
 *
 * ── THE SKETCH IS THE CONTROL, NOT JUST THE TARGET ─────────────────────────────────────
 * D-31 replaces the approved sketch's `varies()` because a measurement contradicted it on the
 * exact cluster this phase was inserted for. A replacement asserted only against its own
 * output is a claim; so `sketchVaries()` below is the mockup's algorithm, transcribed from
 * `163/index.html:297-320`, run on the SAME families as the shipped ranker. Where the two
 * differ the difference is measured, and where the ranker CANNOT do better that is measured
 * too (the D-31 residual) rather than left for a reader to discover.
 */
import { describe, it, expect } from "vitest"

import source from "./rowIdentity?raw"
import { buildIdentityIndex, lineageOf, resolveIdentity, type Lineage } from "./rowIdentity"
import { CHIP_PREDICATES } from "./libraryFilter"
import type { LibraryRow, Provenance } from "./libraryRow"
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
  oneOfLabel,
  versionLabel,
} from "./libraryVocabulary"
import { relativeChanged } from "./relativeChanged"
import {
  FIXTURE_NOW,
  INHERENT_ORPHANS,
  makeLibraryFixture,
} from "./__fixtures__/libraryScale"

// ── hand-built rows (the `WorkflowCard.test.tsx:84-95` posture) ───────────────────────

let seq = 0

/**
 * One row, small and explicit. `def` defaults to `undefined` — the SEED-154 shape 83 of 104
 * dev rows really carry — so a case that wants the project axis has to ask for it, and no
 * assertion here accidentally leans on a definition the operator's library does not have.
 */
const rowOf = (over: Partial<LibraryRow> = {}): LibraryRow => {
  seq += 1
  const base: LibraryRow = {
    id: `r-${seq}`,
    slug: "vendor-risk-review",
    name: "Vendor Risk Review",
    version: 1,
    def: undefined,
    provenance: "published",
    isMine: true,
    updatedAt: "2026-08-12T09:00:00.000000+00:00",
    source: { id: `r-${seq}` } as unknown as LibraryRow["source"],
  }
  return { ...base, ...over }
}

/** The whole line as a person reads it — own · segs · 1 of N · changed rel. */
const lineOf = (rows: readonly LibraryRow[], row: LibraryRow, now = FIXTURE_NOW): string => {
  const id = resolveIdentity(buildIdentityIndex(rows), row, now)
  return [id.own, ...id.segs, id.ofN, id.when].filter((p) => p !== null).join(" · ")
}

/** The DISCRIMINATOR half only — what the ranker actually chose, with the clock removed. */
const segsOf = (rows: readonly LibraryRow[], row: LibraryRow): readonly string[] =>
  resolveIdentity(buildIdentityIndex(rows), row, FIXTURE_NOW).segs

// ═══════════════════════════════════════════════════════════════════════════════════════
// TASK 1 — the index, the four-state lineage, ownership and recency
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * ⚠ SOURCE FENCES ARE VERIFIED OVER NON-COMMENT CODE LINES, AND THAT IS THIS REPOSITORY'S OWN
 * RECORDED RESOLUTION RATHER THAN A CONVENIENCE. The 187-24 trap: a module that DOCUMENTS why a
 * symbol is absent reds a raw grep for it. It fired here on its **sixth** recorded instance —
 * three of the fences below were observed RED against this module's own header, which explains
 * that a `Lineage | null` return cannot carry D-13 and that a `def ?? fetchDefinition()` path
 * would leave the plan. (Prior instances: F1 had to become AST-parsed; the `HighlightTitle` fence
 * was written raw and observed RED against a comment; `libraryFilter.test.ts:461-468` scopes its
 * own fence the same way; 192.1-03 hit it on three greps at once; 192.1-04 on `Math.random`.)
 */
const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

describe("the module's own source keeps the promises no test can see", () => {
  it("is really the file under test (non-vacuity)", () => {
    expect(source.length).toBeGreaterThan(2000)
    expect(source).toContain("export function buildIdentityIndex")
    expect(source).toContain("export function resolveIdentity")
  })

  it("the comment stripper leaves the CODE and removes the PROSE (non-vacuity)", () => {
    // Without this, every fence below could pass by stripping the whole file.
    expect(code.length).toBeGreaterThan(1500)
    expect(code).toContain("export function buildIdentityIndex")
    expect(code).toContain("export function resolveIdentity")
    expect(source).toContain("D-31")
    expect(code).not.toContain("D-31")
  })

  it("D-32 — every lookup is a Map or a Set, never an object literal", () => {
    const constructions = code.match(/new (?:Map|Set)\b/g) ?? []
    expect(constructions.length).toBeGreaterThanOrEqual(4)
    // POSITIVE CONTROL — the needle really can find the shapes it forbids.
    expect("const bySlug = {}").toMatch(/=\s*\{\}/)
    expect("const bySlug = Object.create(null)").toMatch(/Object\.create\(null\)/)
    // …and neither shape is in this module. `= {}` would be a slug-keyed lookup table with a
    // prototype; `Object.create(null)` is the workaround a `Map` makes unnecessary.
    expect(code).not.toMatch(/=\s*\{\}/)
    expect(code).not.toMatch(/Object\.create\(null\)/)
  })

  it("D-16 — the draft's opaque concurrency string is never named, in code OR in prose", () => {
    // The stricter of the two readings: the word does not appear at all, so no future reader
    // finds it here and follows it. (`libraryRow.ts` is where that trap is documented.)
    expect(source).not.toMatch(/token/i)
  })

  it("derives lineage from the slug — no fixture-only bookkeeping field is read", () => {
    expect(source).not.toMatch(/forkKind/)
    expect(source).not.toMatch(/parentSlug/)
  })

  it("D-09 — the ownership predicate is READ ONCE, never re-implemented", () => {
    const lines = source.split("\n").filter((l) => l.includes("CHIP_PREDICATES.yours"))
    expect(lines).toHaveLength(1)
    // POSITIVE CONTROL — a second copy of the predicate would look like this, and it is absent.
    expect("row.isMine ?? row.provenance !== 'starter'").toMatch(/isMine\s*\?\?/)
    expect(source).not.toMatch(/isMine\s*\?\?/)
  })

  it("D-09 — no owner display name anywhere in the module", () => {
    for (const forbidden of ["created_by", "owner_name", "user_name", "display_name", "full_name"]) {
      expect(source).not.toContain(forbidden)
    }
  })

  it("D-13 — nothing returns `Lineage | null`; the fourth state is a union member", () => {
    // POSITIVE CONTROL — the needle catches the forbidden signature, and it is the SAME needle
    // that (correctly) reds on the header prose explaining why the signature is forbidden.
    expect("function lineageOf(): Lineage | null {").toMatch(/Lineage\s*\|\s*null/)
    expect(source).toMatch(/Lineage\s*\|\s*null/) // ← the prose, in the docblock, on purpose
    expect(code).not.toMatch(/Lineage\s*\|\s*null/)
    expect(code).not.toMatch(/null\s*\|\s*Lineage/)
    expect(source).toMatch(/export type Lineage =/)
    for (const kind of ['kind: "original"', 'kind: "copy"', 'kind: "version"', 'kind: "unknown"']) {
      expect(source).toContain(kind)
    }
  })

  it("T-7 / P-4 — the ROW LIST is never re-ordered, and every sort says what it sorts", () => {
    const sorts = code.split("\n").filter((l) => l.includes(".sort("))
    // POSITIVE CONTROL — the needle catches the shape 163/index.html:557 ships and this must not.
    expect("const shown = rows.sort((a, b) => a.name.localeCompare(b.name))").toMatch(
      /\brows\.sort\(|\bfamily\.sort\(|\blist\.sort\(/,
    )
    expect(sorts.length).toBeGreaterThan(0) // non-vacuity: there ARE sorts to judge
    for (const line of sorts) {
      expect(line).not.toMatch(/\brows\.sort\(|\bfamily\.sort\(|\blist\.sort\(/)
    }
    // …and each one is annotated as such, in the prose the stripper removed.
    expect((source.match(/NEVER THE ROW LIST/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })

  it("is pure — no await, no fetch, no definition round trip", () => {
    expect(code).not.toMatch(/await /)
    expect(code).not.toMatch(/fetchDefinition/)
    expect(code).not.toMatch(/from "@\/lib\/api"/)
  })
})

describe("lineage has FOUR states, and the fourth is silence (D-12 / D-13)", () => {
  it("a slug with no fork shape is an Original", () => {
    const row = rowOf({ slug: "audit-trail-extract", name: "Audit Trail Extract" })
    expect(lineageOf(buildIdentityIndex([row]), row)).toEqual({ kind: "original" })
  })

  it("a copy shape whose parent is PRESENT names the parent", () => {
    const parent = rowOf({ id: "p", slug: "access-review", name: "Access Review Attestation" })
    const child = rowOf({ id: "c", slug: "access-review-a1b2c3", name: "Access Review Attestation" })
    expect(lineageOf(buildIdentityIndex([parent, child]), child)).toEqual({
      kind: "copy",
      ofName: "Access Review Attestation",
      ofIsStarter: false,
    })
  })

  it("…and says ` starter` when the parent came from the starters feed", () => {
    const parent = rowOf({ id: "p", slug: "access-review", provenance: "starter", isMine: false })
    const child = rowOf({ id: "c", slug: "access-review-a1b2c3" })
    const lin = lineageOf(buildIdentityIndex([parent, child]), child)
    expect(lin).toMatchObject({ kind: "copy", ofIsStarter: true })
    expect(segsOf([parent, child], child)).toContain(
      LINEAGE_COPY_OF + "Vendor Risk Review" + LINEAGE_STARTER_SUF,
    )
  })

  it("a lower version on the SAME slug is a version fork, and it wins over the copy shape", () => {
    // ⚠ The order is the sketch's and it is load-bearing: this slug matches the copy shape
    // (`report` is six legal lowercase alphanumerics) AND has a lower-versioned sibling.
    const v1 = rowOf({ id: "v1", slug: "compliance-gap-report", version: 1 })
    const v2 = rowOf({ id: "v2", slug: "compliance-gap-report", version: 2 })
    expect(lineageOf(buildIdentityIndex([v1, v2]), v2)).toEqual({
      kind: "version",
      mine: 2,
      parent: 1,
    })
    // POSITIVE CONTROL — without the v1 sibling the SAME row falls through to the copy branch,
    // and its parent is absent, so it goes quiet. The two branches really are both reachable.
    expect(lineageOf(buildIdentityIndex([v2]), v2)).toEqual({ kind: "unknown" })
  })

  it("the version parent is the NEAREST lower version, not the lowest", () => {
    const rows = [1, 2, 5].map((version) => rowOf({ id: `v${version}`, slug: "risk-register", version }))
    const index = buildIdentityIndex(rows)
    expect(lineageOf(index, rows[2])).toEqual({ kind: "version", mine: 5, parent: 2 })
    expect(lineageOf(index, rows[1])).toEqual({ kind: "version", mine: 2, parent: 1 })
    // ⚠ MEASURED, and it corrects a plausible reading of D-13: `risk-register` is NOT a copy
    // shape. The pattern needs a hyphen followed by EXACTLY six characters to the end, and
    // `register` is eight — the false positives are `…-report` and `…-101uat`, not every
    // hyphenated slug. So the v1 here is an Original, and this is the row that says so.
    expect(lineageOf(index, rows[0])).toEqual({ kind: "original" })
  })

  it("⚠ D-13's FOURTH STATE — copy shape, parent ABSENT, renders NOTHING", () => {
    const orphan = rowOf({ slug: "pm-weekly-status-report", name: "PM Weekly Status Report" })
    expect(lineageOf(buildIdentityIndex([orphan]), orphan)).toEqual({ kind: "unknown" })
    // The claim that matters is not the union member — it is that NO WORD REACHES THE LINE.
    expect(segsOf([orphan], orphan)).toEqual([])
    expect(lineOf([orphan], orphan)).not.toContain(LINEAGE_ORIGINAL)
    // POSITIVE CONTROL — the same slug with its parent present DOES produce a phrase, so the
    // silence above is the guard firing rather than the resolver being broken.
    const parent = rowOf({ id: "base", slug: "pm-weekly-status", name: "PM Weekly Status" })
    expect(segsOf([parent, orphan], orphan)).toEqual([LINEAGE_COPY_OF + "PM Weekly Status"])
  })

  it("the four states are all REACHABLE from one corpus (no state is dead code)", () => {
    const rows = [
      rowOf({ id: "orig", slug: "board-minutes-formatter", name: "A" }),
      rowOf({ id: "base", slug: "access-review", name: "B" }),
      rowOf({ id: "copy", slug: "access-review-a1b2c3", name: "B" }),
      rowOf({ id: "v1", slug: "risk-register", name: "C", version: 1 }),
      rowOf({ id: "v2", slug: "risk-register", name: "C", version: 2 }),
      rowOf({ id: "orph", slug: "weekly-status-report", name: "D" }),
    ]
    const index = buildIdentityIndex(rows)
    const kinds = new Set(rows.map((r) => lineageOf(index, r).kind))
    expect(kinds).toEqual(new Set<Lineage["kind"]>(["original", "copy", "version", "unknown"]))
  })

  it("a row the index never saw claims nothing (the honest default)", () => {
    const stranger = rowOf({ id: "stranger", slug: "access-review-a1b2c3" })
    expect(lineageOf(buildIdentityIndex([]), stranger)).toEqual({ kind: "unknown" })
  })
})

describe("D-32 — a slug named after a prototype member cannot reach one", () => {
  // `phaseVocabulary.test.ts:750-762`'s inherited-key probe. Two prototype-pollution bugs of
  // exactly this class are OPEN in this repo (BUG-260807-01, BUG-260808-01).
  const INHERITED = ["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf"]

  it.each(INHERITED)("a copy of `%s` whose parent is absent goes quiet, not to a function", (base) => {
    const child = rowOf({ id: `c-${base}`, slug: `${base}-a1b2c3`, name: `Copy of ${base}` })
    const lin = lineageOf(buildIdentityIndex([child]), child)
    expect(lin).toEqual({ kind: "unknown" })
    // The failure this guards is not an exception — an object literal would resolve the base
    // to an inherited FUNCTION and print `Copy of function Object() { … }`.
    expect(segsOf([child], child)).toEqual([])
  })

  it.each(INHERITED)("…and with a REAL `%s` row present it resolves normally (control)", (base) => {
    const parent = rowOf({ id: `p-${base}`, slug: base, name: "Real Parent" })
    const child = rowOf({ id: `c-${base}`, slug: `${base}-a1b2c3`, name: "Real Parent" })
    expect(lineageOf(buildIdentityIndex([parent, child]), child)).toEqual({
      kind: "copy",
      ofName: "Real Parent",
      ofIsStarter: false,
    })
  })

  it.each(INHERITED)("a NAME of `%s` counts its real namesakes, not a prototype member", (name) => {
    const rows = [rowOf({ id: "a", name }), rowOf({ id: "b", name })]
    const id = resolveIdentity(buildIdentityIndex(rows), rows[0], FIXTURE_NOW)
    expect(id.ofN).toBe(oneOfLabel(2))
    // A lone row of that name collides with nobody — the inherited key would say otherwise.
    const solo = rowOf({ id: "solo", name })
    expect(resolveIdentity(buildIdentityIndex([solo]), solo, FIXTURE_NOW).ofN).toBeNull()
  })
})

describe("ownership reads the ONE shipped predicate (D-09)", () => {
  const cases: { label: string; provenance: Provenance; isMine: boolean | undefined }[] = [
    { label: "the wire said yes", provenance: "published", isMine: true },
    { label: "the wire said no", provenance: "published", isMine: false },
    { label: "the wire did not say, on a draft", provenance: "draft", isMine: undefined },
    { label: "the wire did not say, on a starter", provenance: "starter", isMine: undefined },
    { label: "the wire said yes on a starter", provenance: "starter", isMine: true },
  ]

  it.each(cases)("$label — own agrees with the chip's predicate", ({ provenance, isMine }) => {
    const row = rowOf({ provenance, isMine })
    const own = resolveIdentity(buildIdentityIndex([row]), row, FIXTURE_NOW).own
    expect(own).toBe(CHIP_PREDICATES.yours(row) ? OWN_YOURS : OWN_SHARED)
  })

  it("⚠ `undefined` is NEVER read as `false` — the stale-deploy case", () => {
    const draft = rowOf({ provenance: "draft", isMine: undefined })
    expect(resolveIdentity(buildIdentityIndex([draft]), draft, FIXTURE_NOW).own).toBe(OWN_YOURS)
    // POSITIVE CONTROL — the other side of the pill is reachable, so the line above is not
    // passing because every row says `Yours`.
    const starter = rowOf({ provenance: "starter", isMine: undefined })
    expect(resolveIdentity(buildIdentityIndex([starter]), starter, FIXTURE_NOW).own).toBe(OWN_SHARED)
  })

  it("only two owner words exist across the whole fixture", () => {
    const rows = makeLibraryFixture()
    const index = buildIdentityIndex(rows)
    const words = new Set(rows.map((r) => resolveIdentity(index, r, FIXTURE_NOW).own))
    expect(words).toEqual(new Set([OWN_YOURS, OWN_SHARED]))
  })
})

describe("recency comes from `updatedAt` and from nothing else (D-15 / D-16 / D-18)", () => {
  it("`when` is exactly what the shipped formatter says", () => {
    const row = rowOf({ updatedAt: "2026-06-12T09:30:15.123456+00:00" })
    const id = resolveIdentity(buildIdentityIndex([row]), row, FIXTURE_NOW)
    expect(id.when).toBe(relativeChanged(row.updatedAt, FIXTURE_NOW))
    expect(id.when).toBe("changed 2 months ago")
  })

  it("an absent timestamp renders NO recency segment — never a fabricated one", () => {
    const row = rowOf({ updatedAt: undefined })
    expect(resolveIdentity(buildIdentityIndex([row]), row, FIXTURE_NOW).when).toBeNull()
    // POSITIVE CONTROL — the same row with a timestamp does produce one.
    const dated = rowOf({ updatedAt: new Date(FIXTURE_NOW).toISOString() })
    expect(resolveIdentity(buildIdentityIndex([dated]), dated, FIXTURE_NOW).when).toBe("changed just now")
  })

  it("`now` is a parameter — two instants give two answers for one row", () => {
    const row = rowOf({ updatedAt: new Date(FIXTURE_NOW).toISOString() })
    const index = buildIdentityIndex([row])
    expect(resolveIdentity(index, row, FIXTURE_NOW).when).toBe("changed just now")
    expect(resolveIdentity(index, row, FIXTURE_NOW + 86_400_000).when).toBe("changed yesterday")
  })
})

describe("the fixture's real shape resolves the way D-13 says it must", () => {
  const rows = makeLibraryFixture()
  const index = buildIdentityIndex(rows)
  const bySlug = (slug: string) => rows.filter((r) => r.slug === slug)

  it("⚠ `compliance-gap-report` — the 43-family's OWN ORIGINAL renders no lineage", () => {
    const v1 = bySlug("compliance-gap-report").find((r) => r.version === 1)
    expect(v1).toBeDefined()
    if (!v1) return
    expect(lineageOf(index, v1)).toEqual({ kind: "unknown" })
    expect(resolveIdentity(index, v1, FIXTURE_NOW).segs).not.toContain(LINEAGE_ORIGINAL)
  })

  it("⚠ …while its v2 draft, ONE SLUG LATER, resolves as a version fork", () => {
    // Wave 3's correction, asserted: the orphan count is over SLUGS, not rows. One slug, two
    // rows, two different lineage answers — which is exactly the case D-13 exists to get right.
    const v2 = bySlug("compliance-gap-report").find((r) => r.version === 2)
    expect(v2).toBeDefined()
    if (!v2) return
    expect(lineageOf(index, v2)).toEqual({ kind: "version", mine: 2, parent: 1 })
  })

  it("…and its 40 children DO name it, so the silence above is a guard, not a gap", () => {
    const children = rows.filter(
      (r) => /^compliance-gap-report-[a-z0-9]{6}$/.test(r.slug) && r.version === 1,
    )
    expect(children.length).toBeGreaterThan(30)
    for (const child of children) {
      expect(lineageOf(index, child)).toMatchObject({
        kind: "copy",
        ofName: "Compliance Gap Report",
        ofIsStarter: true,
      })
    }
    // ⚠ THE `version === 1` FILTER IS LOAD-BEARING AND WAS FOUND BY A FAILING ASSERTION, not
    // predicted: the fixture also tweaks ONE of those copies, and that v2 row shares its slug
    // with a v1 sibling, so the VERSION branch answers first — on a slug that also matches the
    // copy shape. It is the second proof of the branch order, on real generated data.
    const tweakedCopy = rows.find(
      (r) => /^compliance-gap-report-[a-z0-9]{6}$/.test(r.slug) && r.version === 2,
    )
    expect(tweakedCopy).toBeDefined()
    if (tweakedCopy) expect(lineageOf(index, tweakedCopy)).toEqual({ kind: "version", mine: 2, parent: 1 })
  })

  it("every INHERENT_ORPHAN slug the fixture publishes really goes quiet", () => {
    for (const slug of INHERENT_ORPHANS) {
      const originals = bySlug(slug).filter((r) => r.version === 1)
      expect(originals.length).toBeGreaterThan(0)
      for (const row of originals) expect(lineageOf(index, row).kind).toBe("unknown")
    }
  })

  it("MEASURED — how many rows resolve, how many go quiet, and how many lie", () => {
    const kinds = { original: 0, copy: 0, version: 0, unknown: 0 }
    for (const row of rows) kinds[lineageOf(index, row).kind] += 1
    // The shape, not a pinned constant: every row lands in exactly one state, all four are
    // populated, and NOTHING is labelled `Original` while carrying a copy-shaped slug.
    expect(kinds.original + kinds.copy + kinds.version + kinds.unknown).toBe(rows.length)
    expect(kinds.copy).toBeGreaterThan(40)
    expect(kinds.unknown).toBeGreaterThanOrEqual(INHERENT_ORPHANS.length)
    const liars = rows.filter(
      (r) => lineageOf(index, r).kind === "original" && /-[a-z0-9]{6}$/.test(r.slug),
    )
    expect(liars).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// TASK 2 — the D-31 discrimination ranker, and the sketch it replaces
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * ── THE SKETCH'S `varies()`, TRANSCRIBED AS THE CONTROL (163/index.html:297-320) ───────
 *
 * D-31 overrides an OPERATOR-APPROVED mockup. A replacement asserted only against its own output
 * is a claim, so the thing being replaced is implemented here and run on the SAME families.
 *
 * ⚠ THE CONTROL SHARES THE MODULE'S AXIS VALUES AND DIFFERS ONLY IN THE SELECTION RULE. That is
 * deliberate: it makes every measured delta below attributable to `varies()`-versus-ranking rather
 * than to a rendering difference smuggled into the comparison. (It therefore also inherits D-13's
 * honesty fix and the project axis's "rank but do not speak" rule — neither is what D-31 changes.)
 */
interface ControlAxisValue {
  key: string
  seg: string | null
}

const controlAxisValue = (
  axis: "lineage" | "project" | "state" | "version",
  row: LibraryRow,
  phrase: string | null,
): ControlAxisValue | null => {
  if (axis === "lineage") return phrase === null ? { key: " silent", seg: null } : { key: phrase, seg: phrase }
  if (axis === "project") {
    if (!row.def) return null
    const bound = row.def.project_folder_id
    return bound ? { key: `folder:${bound}`, seg: null } : { key: "folder:none", seg: NO_PROJECT }
  }
  if (axis === "state") {
    const word =
      row.provenance === "draft" ? STATE_DRAFT : row.provenance === "starter" ? STATE_STARTER : STATE_RUNNABLE
    return { key: word, seg: word }
  }
  if (typeof row.version !== "number") return null
  return { key: versionLabel(row.version), seg: versionLabel(row.version) }
}

const phraseOf = (index: ReturnType<typeof buildIdentityIndex>, row: LibraryRow): string | null => {
  const lin = lineageOf(index, row)
  if (lin.kind === "original") return LINEAGE_ORIGINAL
  if (lin.kind === "copy") return LINEAGE_COPY_OF + lin.ofName + (lin.ofIsStarter ? LINEAGE_STARTER_SUF : "")
  if (lin.kind === "version") return `v${lin.mine} of v${lin.parent}`
  return null
}

/** The mockup's rule: the FIRST TWO axes that vary at all, in D-04's order. */
function sketchSegs(rows: readonly LibraryRow[], row: LibraryRow): string[] {
  const index = buildIdentityIndex(rows)
  const sibs = rows.filter((r) => r.name === row.name)
  const mine = phraseOf(index, row)
  const segs: string[] = []
  if (sibs.length > 1) {
    for (const axis of ["lineage", "project", "state", "version"] as const) {
      if (segs.length >= 2) break
      const keys = new Set(
        sibs.map((s) => controlAxisValue(axis, s, phraseOf(index, s))?.key ?? " absent"),
      )
      const own = controlAxisValue(axis, row, mine)
      if (keys.size > 1 && own && own.seg !== null) segs.push(own.seg)
    }
    if (segs.length === 0 && mine !== null) segs.push(mine)
  } else if (mine !== null && mine !== LINEAGE_ORIGINAL) {
    segs.push(mine)
  }
  return segs
}

/** The size of the largest block of rows whose discriminators are byte-identical. */
const largestIdenticalBlock = (lines: readonly string[]): number => {
  const counts = new Map<string, number>()
  for (const line of lines) counts.set(line, (counts.get(line) ?? 0) + 1)
  return Math.max(...counts.values())
}

// ── the three rules, on families small enough to reason about by hand ─────────────────

/** A family of `n` rows sharing one name, each on its own non-fork-shaped slug. */
const familyOf = (n: number, over: (i: number) => Partial<LibraryRow>): LibraryRow[] =>
  Array.from({ length: n }, (_, i) =>
    rowOf({ id: `fam-${i}`, slug: `twin-workflow-number-${i}`, name: "Twin", ...over(i) }),
  )

describe("D-31 — the ranker drops what excludes nobody", () => {
  it("an axis every namesake answers identically is DROPPED, however high its priority", () => {
    // lineage: 4 × `Original` → 4 of 4. state: 4 × draft → 4 of 4. Both are D-04 seniors and
    // both buy the reader nothing. version 1,1,2,3 → the junior axis is the only real one.
    const rows = familyOf(4, (i) => ({ provenance: "draft", version: [1, 1, 2, 3][i] }))
    expect(segsOf(rows, rows[0])).toEqual([versionLabel(1)])
    // …and the SKETCH spends both slots on the two that exclude nobody? No — `varies()` at least
    // skips a constant axis. This is the case where the two rules AGREE, and saying so keeps the
    // disagreement below honest rather than universal.
    expect(sketchSegs(rows, rows[0])).toEqual([versionLabel(1)])
  })

  it("POSITIVE CONTROL — make that same axis vary and it IS spent", () => {
    const rows = familyOf(4, (i) => ({
      provenance: i === 3 ? "published" : "draft",
      version: [1, 1, 2, 3][i],
    }))
    // state now narrows row 0 to 3 of 4; version narrows it to 2 of 4 → version first, state next.
    expect(segsOf(rows, rows[0])).toEqual([versionLabel(1), STATE_DRAFT])
  })

  it("ranks by NARROWING, not by D-04's order — the whole of D-31 in one assertion", () => {
    // lineage narrows row 0 to 5 of 6 · state to 3 of 6 · version to 2 of 6.
    const rows = familyOf(6, (i) => ({
      provenance: i < 3 ? "draft" : "published",
      version: [1, 1, 2, 2, 3, 3][i],
      // one outlier on lineage, exactly the 43-of-44 shape at small scale
      slug: i === 5 ? "twin-parent-a1b2c3" : `twin-workflow-number-${i}`,
    }))
    const parent = rowOf({ id: "twin-parent", slug: "twin-parent", name: "Other" })
    const all = [...rows, parent]
    expect(segsOf(all, rows[0])).toEqual([versionLabel(1), STATE_DRAFT])
    // ⚠ AND THE SKETCH SPENDS ITS FIRST SLOT ON THE 5-OF-6 PHRASE — the exact waste D-31 exists
    // to stop, reproduced here at a scale a reader can check by hand.
    expect(sketchSegs(all, rows[0])).toEqual([LINEAGE_ORIGINAL, STATE_DRAFT])
  })

  it("D-04's order survives as the TIE-BREAK", () => {
    // state and version narrow row 0 identically (2 of 4). D-04 puts state first.
    const rows = familyOf(4, (i) => ({
      provenance: i < 2 ? "draft" : "published",
      version: [1, 1, 2, 2][i],
    }))
    const segs = segsOf(rows, rows[0])
    expect(segs).toEqual([STATE_DRAFT, versionLabel(1)])
    // POSITIVE CONTROL — break the tie the other way and the order flips, so the assertion above
    // is about the tie-break rather than about a hard-coded sequence.
    const skewed = familyOf(4, (i) => ({
      provenance: i === 0 ? "draft" : "published",
      version: [1, 1, 2, 2][i],
    }))
    expect(segsOf(skewed, skewed[0])).toEqual([STATE_DRAFT, versionLabel(1)])
    const skewedOther = familyOf(4, (i) => ({
      provenance: i < 2 ? "draft" : "published",
      version: [1, 2, 3, 4][i],
    }))
    expect(segsOf(skewedOther, skewedOther[0])).toEqual([versionLabel(1), STATE_DRAFT])
  })

  it("spends AT MOST two, even when all four axes narrow", () => {
    const rows = familyOf(5, (i) => ({
      provenance: (["draft", "published", "starter", "draft", "published"] as const)[i],
      version: i + 1,
      def: { project_folder_id: i === 0 ? null : `p-${i}` } as unknown as LibraryRow["def"],
      slug: i === 0 ? "twin-parent-a1b2c3" : `twin-workflow-number-${i}`,
    }))
    const parent = rowOf({ id: "twin-parent", slug: "twin-parent", name: "Other" })
    expect(segsOf([...rows, parent], rows[0])).toHaveLength(2)
  })
})

// ── the flagship family, and the residual it cannot dissolve ──────────────────────────

/**
 * THE OPERATOR'S 44-ROW *Compliance Gap Report* FAMILY, at CONTEXT D-31's MEASURED DISTRIBUTION:
 * lineage 43 copies + 1 silent base · project ABSENT on all 44 (SEED-154: `def` is undefined
 * because the definition is a double-encoded string scalar) · state 41 draft / 3 published ·
 * version 42 × v1 / 2 × v2.
 */
const devShapeFamily = (): LibraryRow[] => {
  const rows: LibraryRow[] = [
    rowOf({ id: "cgr-base", slug: "compliance-gap-report", name: "Compliance Gap Report", provenance: "published", version: 1 }),
  ]
  for (let i = 0; i < 43; i++) {
    const hash = `h${String(i).padStart(5, "0")}`
    rows.push(
      rowOf({
        id: `cgr-${i}`,
        slug: `compliance-gap-report-${hash}`,
        name: "Compliance Gap Report",
        // 41 drafts / 3 published overall (the base is one of the three)
        provenance: i < 41 ? "draft" : "published",
        // 42 × v1, 2 × v2 — and each v2 sits on its OWN slug, so it is a copy, not a version fork
        version: i === 20 || i === 21 ? 2 : 1,
      }),
    )
  }
  return rows
}

describe("⚠ THE FLAGSHIP REGRESSION — the 44-row family this phase was inserted for", () => {
  const rows = devShapeFamily()
  const typical = rows.find((r) => r.id === "cgr-0")
  const COPY_PHRASE = LINEAGE_COPY_OF + "Compliance Gap Report"

  it("the family really has the measured distribution (non-vacuity)", () => {
    expect(rows).toHaveLength(44)
    expect(rows.filter((r) => r.provenance === "draft")).toHaveLength(41)
    expect(rows.filter((r) => r.version === 1)).toHaveLength(42)
    expect(rows.filter((r) => r.def !== undefined)).toHaveLength(0)
    const index = buildIdentityIndex(rows)
    expect(rows.filter((r) => lineageOf(index, r).kind === "copy")).toHaveLength(43)
    expect(rows.filter((r) => lineageOf(index, r).kind === "unknown")).toHaveLength(1)
  })

  it("the SKETCH spends slot 1 on a phrase 43 of 44 rows share", () => {
    expect(typical).toBeDefined()
    if (!typical) return
    expect(sketchSegs(rows, typical)).toEqual([COPY_PHRASE, STATE_DRAFT])
  })

  it("…and the RANKER does not — it drops the 43-of-44 axis for the two that narrow more", () => {
    expect(typical).toBeDefined()
    if (!typical) return
    const segs = segsOf(rows, typical)
    expect(segs).not.toContain(COPY_PHRASE)
    expect(segs).toEqual([STATE_DRAFT, versionLabel(1)])
  })

  it("⚠ THE RESIDUAL, MEASURED AND REPORTED RATHER THAN PAPERED OVER", () => {
    // No ranker can separate rows identical in every fact the product holds. On THIS family the
    // ranker's best pair is a two-row improvement on the sketch's, and that is the honest number:
    // it does NOT solve the flagship. `1 of 44` is then exactly what it says — a true warning
    // that this row is not distinguishable — and the product's answer is the 162-B rename.
    //
    // MEASURED, 2026-08-12: largest byte-identical block — sketch **41**, ranker **39**, of 44.
    // Two rows. Stated rather than smoothed, because the temptation at this exact spot is to
    // reach for a slug fragment and turn 39 into 1, which would trade a true warning for a
    // meaningless one (the vocabulary drift the 187 node-face ladder forbids).
    const index = buildIdentityIndex(rows)
    const ranker = rows.map((r) => resolveIdentity(index, r, FIXTURE_NOW).segs.join(" · "))
    const sketch = rows.map((r) => sketchSegs(rows, r).join(" · "))
    const rankerBlock = largestIdenticalBlock(ranker)
    const sketchBlock = largestIdenticalBlock(sketch)
    expect(rankerBlock).toBeLessThanOrEqual(sketchBlock)
    // ⚠ ASSERTED AS A FLOOR SO IT CANNOT QUIETLY BECOME A CLAIM OF SUCCESS: on dev data the
    // ranker still leaves a large indistinguishable block. If a future change makes this pass by
    // inventing a technical discriminator, THIS line is what fails.
    expect(rankerBlock).toBeGreaterThanOrEqual(35)
    // …and every one of those rows carries the warning.
    for (const row of rows) {
      expect(resolveIdentity(index, row, FIXTURE_NOW).ofN).toBe(oneOfLabel(44))
    }
  })

  it("NO TECHNICAL DISCRIMINATOR is ever invented — not a slug, an id or a hash", () => {
    const index = buildIdentityIndex(rows)
    for (const row of rows) {
      for (const seg of resolveIdentity(index, row, FIXTURE_NOW).segs) {
        expect(seg).not.toContain(row.slug)
        expect(seg).not.toContain(row.id)
        expect(seg).not.toMatch(/h\d{5}/)
      }
    }
    // …and the same sweep over the whole realistic fixture, where the slugs carry real hashes.
    const scale = makeLibraryFixture()
    const scaleIndex = buildIdentityIndex(scale)
    for (const row of scale) {
      for (const seg of resolveIdentity(scaleIndex, row, FIXTURE_NOW).segs) {
        expect(seg).not.toContain(row.slug)
        expect(seg).not.toContain(row.id)
      }
    }
  })
})

describe("⚠ WHERE THE RANKER EARNS ITS KEEP — an axis D-04's order buries", () => {
  /**
   * PURPOSE-BUILT, and named as such. Same weak seniors as the family above (lineage 43 of 44,
   * state 43 of 44), but the JUNIOR axis genuinely narrows — the shape a family takes when the
   * copies have each been tweaked to their own version. `varies()` cannot reach it, because it
   * spends both slots before it gets there.
   */
  const rows: LibraryRow[] = [
    rowOf({ id: "buried-base", slug: "buried-family", name: "Buried", provenance: "published", version: 1 }),
    ...Array.from({ length: 43 }, (_, i) =>
      rowOf({
        id: `buried-${i}`,
        slug: `buried-family-c${String(i).padStart(5, "0")}`,
        name: "Buried",
        provenance: "draft",
        version: i + 2, // every copy at its own version
      }),
    ),
  ]

  it("the SKETCH renders a 40+ row block of byte-identical discriminators", () => {
    const sketch = rows.map((r) => sketchSegs(rows, r).join(" · "))
    expect(largestIdenticalBlock(sketch)).toBeGreaterThanOrEqual(40)
  })

  it("…and the RANKER renders 44 distinct ones, because it can reach the junior axis", () => {
    const index = buildIdentityIndex(rows)
    const ranker = rows.map((r) => resolveIdentity(index, r, FIXTURE_NOW).segs.join(" · "))
    expect(new Set(ranker).size).toBe(44)
    expect(largestIdenticalBlock(ranker)).toBe(1)
  })
})

// ── the properties the sketch's own drive measured, on the D-30 fixture ───────────────

/**
 * ⚠ THE THRESHOLDS BELOW ARE THE SKETCH'S OWN (`> 20` from `163/drive.cjs:65-68`, `> 8` from
 * `160/drive.cjs:92-95`), NOT THE MEASUREMENTS. Measured on THIS fixture with the shipped ranker,
 * 2026-08-12 (192.1-05):
 *
 *     distinct identity LINES        75 of 106
 *     distinct DISCRIMINATOR strips  24 of 93 colliding rows
 *     largest byte-identical block    5 rows
 *     lineage states                 original 20 · copy 64 · version 15 · unknown 7
 *
 * The measurements are recorded and the THRESHOLDS are asserted, deliberately: a fixture pinned
 * to `75` reds on any future fixture tweak and teaches its reader to edit the number, while the
 * property the sketch actually drove — *the line is computed, not templated* — survives both.
 * ⚠ And `94` from `BUILD-CONTRACT.generated.md` is NOT the count to compare against: it was
 * measured at 108 cards, one of which the 162-B drive created.
 */
describe("the approved sketch's driven properties SURVIVE the D-31 change", () => {
  const rows = makeLibraryFixture()
  const index = buildIdentityIndex(rows)
  const identities = rows.map((r) => resolveIdentity(index, r, FIXTURE_NOW))
  const lines = identities.map((id) => [id.own, ...id.segs, id.ofN, id.when].filter(Boolean).join("·"))

  it("163/drive.cjs — identity lines are COMPUTED, not templated (> 20 distinct)", () => {
    expect(new Set(lines).size).toBeGreaterThan(20)
  })

  it("160/drive.cjs — the DISCRIMINATOR strips alone are not all the same (> 8 distinct)", () => {
    // The stronger half of the property: the clock is removed, so distinctness cannot be bought
    // by `changed 3 days ago` varying. This is 160-B's `.disc` set, reproduced on the build.
    const strips = identities.filter((id) => id.ofN !== null).map((id) => id.segs.join("·"))
    expect(strips.length).toBeGreaterThan(80) // non-vacuity: there ARE colliding rows
    expect(new Set(strips).size).toBeGreaterThan(8)
  })

  it("163/drive.cjs — max 2 computed segments on ANY row", () => {
    for (const id of identities) expect(id.segs.length).toBeLessThanOrEqual(2)
  })

  it("163/drive.cjs — `1 of N` appears exactly on the rows whose name collides", () => {
    const nameCounts = new Map<string, number>()
    for (const row of rows) nameCounts.set(row.name, (nameCounts.get(row.name) ?? 0) + 1)
    let colliding = 0
    let solo = 0
    rows.forEach((row, i) => {
      const n = nameCounts.get(row.name) ?? 1
      if (n > 1) {
        colliding += 1
        expect(identities[i].ofN).toBe(oneOfLabel(n))
      } else {
        solo += 1
        expect(identities[i].ofN).toBeNull()
      }
    })
    // Both branches were exercised — the assertion above cannot pass because one side is empty.
    expect(colliding).toBeGreaterThan(80)
    expect(solo).toBeGreaterThan(5)
  })

  it("D-06 — a unique name carries NO discriminators, and a unique FORK still says what it is", () => {
    const soloOriginal = rowOf({ id: "solo-1", slug: "audit-trail-extract", name: "Audit Trail Extract" })
    expect(segsOf([soloOriginal], soloOriginal)).toEqual([])
    // POSITIVE CONTROL — the same shape of row, but really a fork, keeps its lineage. That is
    // identity, not disambiguation, which is exactly the distinction D-06 draws.
    const parent = rowOf({ id: "solo-p", slug: "access-review", name: "Access Review Attestation" })
    const fork = rowOf({ id: "solo-f", slug: "access-review-a1b2c3", name: "Q3 EU gap review" })
    expect(segsOf([parent, fork], fork)).toEqual([LINEAGE_COPY_OF + "Access Review Attestation"])
    // …and it never says `Original` on a row nothing collides with.
    expect(lineOf([soloOriginal], soloOriginal)).not.toContain(LINEAGE_ORIGINAL)
  })
})

// ── D-05: `N` is a property of the LIBRARY, not of what you are looking at ────────────

describe("D-05 — `N` counts the FULL merged library, before any filtering", () => {
  it("the same row resolved against a FILTERED list reports a different N", () => {
    const rows = makeLibraryFixture()
    const row = rows.find((r) => r.name === "Compliance Gap Report")
    expect(row).toBeDefined()
    if (!row) return

    const full = resolveIdentity(buildIdentityIndex(rows), row, FIXTURE_NOW)
    // What a `[rows, query]` memo key would produce after two keystrokes — the D-05 violation.
    const narrowed = rows.filter((r) => r.provenance !== "draft")
    const filtered = resolveIdentity(buildIdentityIndex(narrowed), row, FIXTURE_NOW)

    expect(full.ofN).toBe(oneOfLabel(43))
    expect(filtered.ofN).not.toBe(full.ofN)
    // The count is therefore a property of the list handed to `buildIdentityIndex`, which is WHY
    // Plan 06's memo key must be `[rows]` ALONE — the nearest precedent on the page
    // (`counts`, keyed `[rows, query, selectedProjectId]`) would make this number shrink as a
    // person types, and a count that flickers misdescribes the library.
  })

  it("D-28 — a failed feed collapses N and the resolver does NOT suppress the count", () => {
    // Drafts are 72 % of the operator's merged rows, so a drafts 403 genuinely shrinks the number.
    // The `source-failed` banner is the disclosure, spent ONCE rather than 106 times.
    const rows = makeLibraryFixture()
    const withoutDrafts = rows.filter((r) => r.provenance !== "draft")
    const row = withoutDrafts.find((r) => r.name === "Compliance Gap Report")
    expect(row).toBeDefined()
    if (!row) return
    const id = resolveIdentity(buildIdentityIndex(withoutDrafts), row, FIXTURE_NOW)
    expect(id.ofN).not.toBeNull()
  })
})

// ── D-34: the index is built once, and resolving is O(1) ──────────────────────────────

describe("D-34 — the work is done ONCE per list, never once per row per render", () => {
  it("every row's lineage is resolved exactly once during the build", () => {
    const rows = makeLibraryFixture()
    const index = buildIdentityIndex(rows)
    expect(index.stats.lineageResolutions).toBe(rows.length)
    expect(index.stats.resolveAxisComputations).toBe(0)
    expect(index.size).toBe(rows.length)
  })

  it("resolving all 106 rows does NOT rebuild the index", () => {
    const rows = makeLibraryFixture()
    const index = buildIdentityIndex(rows)
    for (const row of rows) resolveIdentity(index, row, FIXTURE_NOW)
    expect(index.stats.resolveCalls).toBe(rows.length)
    expect(index.stats.lineageResolutions).toBe(rows.length) // unchanged — no rebuild
  })

  it("⚠ resolving one row costs a CONSTANT, whatever the size of its family (the O(1) claim)", () => {
    // This is the anti-n³ property. In the sketch, resolving a row in the 43-family costs
    // 43 × a full list scan; here it costs four value computations, the same as in a family of 3.
    const rows = makeLibraryFixture()
    const big = rows.find((r) => r.name === "Compliance Gap Report")
    const small = rows.find((r) => r.name === "Vendor Risk Review")
    expect(big).toBeDefined()
    expect(small).toBeDefined()
    if (!big || !small) return

    const indexA = buildIdentityIndex(rows)
    resolveIdentity(indexA, big, FIXTURE_NOW)
    const costBig = indexA.stats.resolveAxisComputations

    const indexB = buildIdentityIndex(rows)
    resolveIdentity(indexB, small, FIXTURE_NOW)
    const costSmall = indexB.stats.resolveAxisComputations

    expect(costBig).toBe(4)
    expect(costSmall).toBe(costBig)
  })

  it("the whole render costs O(n) value computations, not O(n²)", () => {
    const rows = makeLibraryFixture()
    const index = buildIdentityIndex(rows)
    for (const row of rows) resolveIdentity(index, row, FIXTURE_NOW)
    expect(index.stats.resolveAxisComputations).toBeLessThanOrEqual(4 * rows.length)
    // The sketch's shape, for scale: ≈ 230,000 inner-loop iterations on this list, twice a render.
    expect(index.stats.resolveAxisComputations).toBeLessThan(1000)
  })

  it("pass 1b is SKIPPED for the single-version majority", () => {
    const rows = makeLibraryFixture()
    const index = buildIdentityIndex(rows)
    // Only slugs carrying two or more distinct versions are sorted at all, which is what keeps
    // the build linear in practice on a table of 222 rows across 201 slugs.
    const multiVersionSlugs = new Set(
      rows
        .filter((r) => rows.some((o) => o.slug === r.slug && o.version !== r.version))
        .map((r) => r.slug),
    )
    expect(index.stats.versionSorts).toBe(multiVersionSlugs.size)
    expect(index.stats.versionSorts).toBeLessThan(rows.length / 5)
    expect(index.stats.versionSorts).toBeGreaterThan(0) // non-vacuity: some slug DOES have two
  })
})

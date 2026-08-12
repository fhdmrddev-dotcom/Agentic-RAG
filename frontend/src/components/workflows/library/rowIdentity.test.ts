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
  OWN_SHARED,
  OWN_YOURS,
  oneOfLabel,
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

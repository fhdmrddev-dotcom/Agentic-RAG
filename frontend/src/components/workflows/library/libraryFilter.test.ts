/**
 * Phase 192-05 Task 2 — libraryFilter tests.
 *
 * The chips' correctness is ARITHMETIC, so it is proved as arithmetic. Everything asserted
 * here is a property of a pure function over fixtures; nothing renders, which is the whole
 * reason the merge and the filter were split out of the components in the first place.
 *
 * What is pinned:
 *  - D-16: the merge dedupes by `id`, and a same-slug v(N+1) fork SURVIVES it (the trap a
 *    slug-keyed dedupe falls into, asserted as a positive case rather than as a comment).
 *  - D-03: every chip's number equals the rows that chip renders — mechanically, as
 *    `chipCounts(rows, q, p)[c] === filterLibrary(rows, {query: q, chips: [c], …}).length`.
 *  - D-07 / D-08: substring over name AND purpose, and the paraphrase returns ZERO.
 *  - D-17: starters stay visible under a project selection while published and drafts narrow.
 *  - D-04: an absent `is_mine` falls back to feed-derived provenance, never to `false`.
 *  - The purity claim, in its mechanical form: no runtime import from the API client.
 */
import { describe, it, expect } from "vitest"
import libraryFilterSource from "./libraryFilter?raw"
import type { PublishedWorkflow, WorkflowDraftRow } from "@/lib/api"
import type { ChipId } from "./libraryRow"
import {
  CHIP_PREDICATES,
  UNBOUND,
  chipCounts,
  filterLibrary,
  fromDraft,
  fromPublished,
  matchesProject,
  matchesQuery,
  mergeLibrary,
} from "./libraryFilter"

// ── fixtures ─────────────────────────────────────────────────────────────────────────
//
// Spread across all six chips and both search fields on purpose (the 045 real-scale
// lesson in miniature): a corpus where every row answers every predicate the same way
// makes each assertion below pass for the wrong reason.

/** A workflow that ends in a strict emit phase → STRICT tier, and makes a file. */
const strictEmitDef = (purpose: string, project: string | null, version: number) => ({
  version,
  business_requirement: purpose,
  project_folder_id: project,
  phases: [
    { slug: "gather", phase_index: 0, config: { phase_type: "llm_agent" } },
    { slug: "emit", phase_index: 1, config: { phase_type: "llm_emit", citation_policy: "strict" } },
  ],
})

/** A workflow with no emit phase at all → LOOSE tier, and answers in chat. */
const chatOnlyDef = (purpose: string, project: string | null, version: number) => ({
  version,
  business_requirement: purpose,
  project_folder_id: project,
  phases: [{ slug: "think", phase_index: 0, config: { phase_type: "llm_agent" } }],
})

const PROJECT_A = "folder-aaa"
const PROJECT_B = "folder-bbb"

/** Published, mine, strict, makes a file, bound to project A. */
const publishedVendor: PublishedWorkflow = {
  id: "id-pub-vendor",
  slug: "vendor-risk-review",
  name: "Vendor risk review",
  definition: strictEmitDef("Check every supplier against the approved register.", PROJECT_A, 3),
  is_mine: true,
  is_system_global: false,
}

/** Published, mine, chat-only, UNBOUND (no project) — and its purpose carries the word
 *  the search test looks for while its NAME deliberately does not. */
const publishedRecap: PublishedWorkflow = {
  id: "id-pub-recap",
  slug: "quarterly-recap",
  name: "Quarterly recap",
  definition: chatOnlyDef("Summarise the board assessments for the quarter.", null, 1),
  is_mine: true,
  is_system_global: false,
}

/** A starter: shared, not mine, strict, and carrying NO project (mig 094 seeds none). */
const starterClause: PublishedWorkflow = {
  id: "id-star-clause",
  slug: "clause-extractor",
  name: "Clause extractor",
  definition: strictEmitDef("Pull the obligations out of a signed contract.", null, 1),
  is_mine: false,
  is_system_global: true,
}

/** The same-slug fork: a draft at v4 of the published vendor workflow above. Its wire
 *  `name` is null, so the row falls back to the slug. */
const draftVendorFork: WorkflowDraftRow = {
  id: "id-draft-vendor-v4",
  slug: "vendor-risk-review",
  version: 4,
  name: null,
  definition: strictEmitDef("Check every supplier, now with the new register.", PROJECT_A, 4),
  token: "2026-08-10T00:00:00.123456Z",
}

/** A second draft, bound to a different project, chat-only. */
const draftSignoff: WorkflowDraftRow = {
  id: "id-draft-signoff",
  slug: "sign-off-tracker",
  version: 1,
  name: "Sign-off tracker",
  definition: chatOnlyDef("Track who still owes a sign-off.", PROJECT_B, 1),
  token: "2026-08-10T00:00:01.123456Z",
}

const merged = () =>
  mergeLibrary([publishedVendor, publishedRecap], [starterClause], [draftVendorFork, draftSignoff])

const idsOf = (rows: { id: string }[]) => rows.map((r) => r.id)

// ── normalize ────────────────────────────────────────────────────────────────────────

describe("normalize — two wire types, one row", () => {
  it("reads a published version out of the definition and keeps the original row", () => {
    const row = fromPublished(publishedVendor, "published")
    expect(row.version).toBe(3)
    expect(row.provenance).toBe("published")
    // The ORIGINAL object, not a rebuild — the D-186-07 silent-clobber shape is what
    // carrying it whole makes unavailable.
    expect(row.source).toBe(publishedVendor)
  })

  it("falls back a null draft name to the slug, and keeps the opaque token reachable", () => {
    const row = fromDraft(draftVendorFork)
    expect(row.name).toBe("vendor-risk-review")
    expect(row.version).toBe(4)
    expect(row.source).toBe(draftVendorFork)
    expect((row.source as WorkflowDraftRow).token).toBe(draftVendorFork.token)
  })

  it("leaves version undefined rather than faking one when the definition has none", () => {
    const row = fromPublished({ id: "x", slug: "x", name: "X" }, "published")
    expect(row.version).toBeUndefined()
    expect(row.def).toBeUndefined()
  })
})

// ── D-16: merge, dedupe, provenance ──────────────────────────────────────────────────

describe("D-16 — the merge", () => {
  it("assigns provenance from FEED ORIGIN, not from the row's own contents", () => {
    const rows = merged()
    expect(rows.find((r) => r.id === starterClause.id)?.provenance).toBe("starter")
    expect(rows.find((r) => r.id === publishedVendor.id)?.provenance).toBe("published")
    expect(rows.find((r) => r.id === draftVendorFork.id)?.provenance).toBe("draft")
  })

  it("dedupes by id when the SAME row arrives on two feeds", () => {
    // The property that holds today because the page passes `?scope=mine`; the Map is
    // what keeps it holding if a later phase drops that parameter.
    const rows = mergeLibrary([starterClause], [starterClause], [])
    expect(rows).toHaveLength(1)
    expect(idsOf(rows)).toEqual([starterClause.id])
    // The later write wins: a row the caller also owns reads as theirs.
    expect(rows[0].provenance).toBe("published")
  })

  it("a same-slug v(N+1) fork SURVIVES the merge beside its published original", () => {
    // The trap: `onTweak` deliberately mints a second row with the same slug, so a
    // slug-keyed dedupe would swallow exactly the row a user just created.
    const rows = mergeLibrary([publishedVendor], [], [draftVendorFork])
    expect(publishedVendor.slug).toBe(draftVendorFork.slug) // the premise, asserted
    expect(rows).toHaveLength(2)
    expect(idsOf(rows).sort()).toEqual([draftVendorFork.id, publishedVendor.id].sort())
    expect(rows.map((r) => r.version).sort()).toEqual([3, 4])
  })

  it("produces no duplicate id across the whole three-feed merge", () => {
    const rows = merged()
    expect(new Set(idsOf(rows)).size).toBe(rows.length)
    expect(rows).toHaveLength(5)
  })
})

// ── D-07 / D-08: search ──────────────────────────────────────────────────────────────

describe("D-07 / D-08 — substring search over name and purpose", () => {
  it("matches on the NAME", () => {
    const rows = filterLibrary(merged(), { query: "quarterly", chips: [], projectId: null })
    expect(idsOf(rows)).toEqual([publishedRecap.id])
  })

  it("matches on the PURPOSE sentence when the name does not carry the word", () => {
    expect(publishedRecap.name.toLowerCase()).not.toContain("assessments") // the premise
    const rows = filterLibrary(merged(), { query: "assessments", chips: [], projectId: null })
    expect(idsOf(rows)).toEqual([publishedRecap.id])
  })

  it("is case-insensitive and matches mid-word, because it is substring matching", () => {
    const row = fromPublished(publishedVendor, "published")
    expect(matchesQuery(row, "ENDOR")).toBe(true)
    expect(matchesQuery(row, "  supplier  ")).toBe(true)
  })

  it("a blank query passes everything through", () => {
    expect(filterLibrary(merged(), { query: "   ", chips: [], projectId: null })).toHaveLength(5)
  })

  it("substring, not meaning: the paraphrase returns ZERO rows", () => {
    // D-08 is a promise about capability. Every row in the corpus is about checking
    // suppliers or contracts; not one is returned, and that is the shipped behaviour.
    const rows = filterLibrary(merged(), {
      query: "the thing that checks vendors",
      chips: [],
      projectId: null,
    })
    expect(rows).toEqual([])
    // …and the words ARE there separately, so the zero above is about the phrase rather
    // than about a corpus that never matched anything.
    expect(
      filterLibrary(merged(), { query: "vendor", chips: [], projectId: null }).length,
    ).toBeGreaterThan(0)
  })
})

// ── D-03 / D-04: the six chips ───────────────────────────────────────────────────────

describe("D-03 — the six chip predicates", () => {
  it("splits the corpus the way the six words say it does", () => {
    const rows = merged()
    const pick = (chip: ChipId) => idsOf(rows.filter(CHIP_PREDICATES[chip])).sort()
    expect(pick("ready-to-run")).toEqual([publishedRecap.id, publishedVendor.id, starterClause.id].sort())
    expect(pick("still-building")).toEqual([draftSignoff.id, draftVendorFork.id].sort())
    expect(pick("starters")).toEqual([starterClause.id])
    expect(pick("yours")).toEqual(
      [draftSignoff.id, draftVendorFork.id, publishedRecap.id, publishedVendor.id].sort(),
    )
    expect(pick("makes-a-file")).toEqual(
      [draftVendorFork.id, publishedVendor.id, starterClause.id].sort(),
    )
    expect(pick("strict")).toEqual([draftVendorFork.id, publishedVendor.id, starterClause.id].sort())
  })

  it("derives Strict through tierForDefinition — the strictest emit phase wins, not the first", () => {
    // WR-03: a hand-rolled check that stops at the first emit phase reads "draft" here
    // and gets the tier wrong. The shared derivation does not.
    const looseThenStrict = fromPublished(
      {
        id: "id-two-emits",
        slug: "two-emits",
        name: "Two emits",
        definition: {
          phases: [
            { slug: "a", config: { phase_type: "llm_emit", citation_policy: "draft" } },
            { slug: "b", config: { phase_type: "llm_emit", citation_policy: "strict" } },
          ],
        },
      },
      "published",
    )
    expect(CHIP_PREDICATES.strict(looseThenStrict)).toBe(true)
  })

  it("D-04 — an absent is_mine falls back to feed-derived provenance, never to false", () => {
    // The stale-deploy case: a frontend ahead of its backend receives no ownership bits.
    const noBits: PublishedWorkflow = { id: "id-nb", slug: "nb", name: "No bits" }
    expect(CHIP_PREDICATES.yours(fromPublished(noBits, "published"))).toBe(true)
    expect(CHIP_PREDICATES.yours(fromPublished(noBits, "starter"))).toBe(false)
    expect(CHIP_PREDICATES.yours(fromDraft(draftSignoff))).toBe(true)
    // …and when the wire DOES say, the wire wins over the fallback.
    const sharedButMine: PublishedWorkflow = { ...starterClause, is_mine: true }
    expect(CHIP_PREDICATES.yours(fromPublished(sharedButMine, "starter"))).toBe(true)
  })
})

// ── D-17: the project filter ─────────────────────────────────────────────────────────

describe("D-17 — the project filter holds starters OUT", () => {
  it("narrows published and drafts to the selected project while starters stay", () => {
    const rows = filterLibrary(merged(), { query: "", chips: [], projectId: PROJECT_A })
    // Published rows arrive already narrowed by the server, so both are passed through;
    // the drafts narrow here, and the starter stays because it has no project at all.
    expect(idsOf(rows).sort()).toEqual(
      [publishedRecap.id, publishedVendor.id, draftVendorFork.id, starterClause.id].sort(),
    )
    expect(idsOf(rows)).not.toContain(draftSignoff.id)
  })

  it("a starter is visible under EVERY project selection, including Unbound", () => {
    for (const projectId of [null, UNBOUND, PROJECT_A, PROJECT_B]) {
      const rows = filterLibrary(merged(), { query: "", chips: [], projectId })
      expect(idsOf(rows)).toContain(starterClause.id)
    }
  })

  it("Unbound keeps only the rows with no project — the case the server cannot express", () => {
    const rows = filterLibrary(merged(), { query: "", chips: [], projectId: UNBOUND })
    expect(idsOf(rows).sort()).toEqual([publishedRecap.id, starterClause.id].sort())
  })

  it("All projects narrows nothing", () => {
    expect(matchesProject(fromDraft(draftSignoff), null)).toBe(true)
    expect(filterLibrary(merged(), { query: "", chips: [], projectId: null })).toHaveLength(5)
  })
})

// ── D-03's promise, mechanically ─────────────────────────────────────────────────────

describe("D-03 — a chip can never promise results it cannot deliver", () => {
  const CHIPS = Object.keys(CHIP_PREDICATES) as ChipId[]

  it.each(CHIPS)("%s: its count equals the rows selecting it renders (no query)", (chip) => {
    const rows = merged()
    const counts = chipCounts(rows, "", null)
    expect(counts[chip]).toBe(
      filterLibrary(rows, { query: "", chips: [chip], projectId: null }).length,
    )
  })

  it.each(CHIPS)("%s: the same holds under a LIVE query and a project", (chip) => {
    const rows = merged()
    const counts = chipCounts(rows, "supplier", PROJECT_A)
    expect(counts[chip]).toBe(
      filterLibrary(rows, { query: "supplier", chips: [chip], projectId: PROJECT_A }).length,
    )
  })

  it("counts are non-vacuous — the query really does move them", () => {
    const rows = merged()
    expect(chipCounts(rows, "", null)["ready-to-run"]).toBe(3)
    expect(chipCounts(rows, "quarterly", null)["ready-to-run"]).toBe(1)
    expect(chipCounts(rows, "quarterly", null).strict).toBe(0)
  })

  it("chips combine as a UNION, so two disjoint chips never render an empty list", () => {
    const rows = merged()
    const both = filterLibrary(rows, {
      query: "",
      chips: ["ready-to-run", "still-building"],
      projectId: null,
    })
    expect(both).toHaveLength(5)
  })
})

// ── purity ───────────────────────────────────────────────────────────────────────────

describe("the module is pure — it imports NOTHING from the API client at runtime", () => {
  const VALUE_IMPORT_FROM_API = /^import\s+(?!type\b)[^\n]*from\s+["']@\/lib\/api["']/m

  it("POSITIVE CONTROL — the detector catches a value import of the API client", () => {
    // A fence whose matcher is broken passes vacuously and looks exactly like one that holds.
    expect('import { listStarterWorkflows } from "@/lib/api"').toMatch(VALUE_IMPORT_FROM_API)
    expect('import listStarterWorkflows from "@/lib/api"').toMatch(VALUE_IMPORT_FROM_API)
    // …and the legal spelling is NOT caught, or the assertion below is unsatisfiable.
    expect('import type { PublishedWorkflow } from "@/lib/api"').not.toMatch(VALUE_IMPORT_FROM_API)
  })

  it("the source carries the type-only import and no value import", () => {
    expect(libraryFilterSource.length).toBeGreaterThan(0)
    expect(libraryFilterSource).toMatch(/^import type .*from "@\/lib\/api"$/m)
    expect(libraryFilterSource).not.toMatch(VALUE_IMPORT_FROM_API)
  })

  it("it holds no React, no JSX and no DOM", () => {
    expect(libraryFilterSource).not.toMatch(/from\s+["']react["']/)
    expect(libraryFilterSource).not.toMatch(/document\./)
  })
})

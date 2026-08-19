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
import workflowsPageSource from "@/pages/WorkflowsPage?raw"
import type { PublishedWorkflow, WorkflowDraftRow } from "@/lib/api"
import type { ChipId } from "./libraryRow"
import type { LibrarySelection, MatchReason } from "./libraryFilter"
import {
  CHIP_PREDICATES,
  UNBOUND,
  chipCounts,
  filterLibrary,
  fromDraft,
  fromPublished,
  matchReasons,
  matchesProject,
  matchesQuery,
  mergeLibrary,
} from "./libraryFilter"
// 192.2-09 (WR-04) — the reason WORDS, imported so the cases compare two EXPORTS rather than
// a rendered string against a literal typed here. A re-spelling in either home then reds.
import {
  CHIP_WORDS,
  MATCH_REASON_PREFIX,
  MATCH_REASON_PURPOSE,
  MATCH_REASON_SEPARATOR,
  MATCH_REASON_WORDS,
} from "./libraryVocabulary"

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

  // ── WR-01 (2026-08-18) — AN EMPTY NAME IS NOT A NAME ────────────────────────────────
  //
  // Found by the phase-197 code review. `??` answers only for `null`/`undefined`, so an
  // EMPTY-STRING name passed straight through to the card, which renders `{row.name}` with
  // no fallback of its own — a blank library title with nothing to click toward.
  //
  // ⚠ IT IS A REGRESSION PHASE 197 INTRODUCED, and naming the cause matters more than the
  // patch: `197-05` shipped `setName`, the first path by which a workflow's name can be
  // EMPTIED. The docblocks justified accepting `""` with "the server owns emptiness", and
  // that is MEASURED FALSE for this field — `grounding.py`'s rule is
  // `business_requirement_missing`; nothing anywhere refuses an empty workflow NAME, and
  // `db/workflows.py:764` writes it through with `SET name = $3`.
  //
  // The fix is a DISPLAY fallback, deliberately not a client-side trim: the author's stored
  // value is theirs, and rejecting it here would be the second copy of a rule that has no
  // first copy on the server.

  it("WR-01 — an EMPTY draft name falls back to the slug, exactly as a null one does", () => {
    const row = fromDraft({ ...draftVendorFork, name: "" })
    expect(row.name).toBe("vendor-risk-review")
  })

  it("WR-01 — an EMPTY published name falls back too, and that arm had no fallback at all", () => {
    // `fromPublished` read `row.name` RAW — it did not even have the `??` its sibling had,
    // so a published workflow with an empty name was blank by a second, different route.
    const row = fromPublished({ id: "p", slug: "quarterly-brief", name: "" }, "published")
    expect(row.name).toBe("quarterly-brief")
  })

  it("WR-01 — a WHITESPACE-ONLY name falls back, because it reads blank to a person", () => {
    // The rule is about what the reader SEES. A name of three spaces is not null, is not
    // empty, and renders as nothing at all.
    expect(fromDraft({ ...draftVendorFork, name: "   " }).name).toBe("vendor-risk-review")
  })

  it("POSITIVE CONTROL — a REAL name is never replaced by the slug", () => {
    // Without this, the three cases above would pass on a function that had simply started
    // returning the slug unconditionally.
    expect(fromDraft({ ...draftVendorFork, name: "Vendor risk review" }).name).toBe(
      "Vendor risk review",
    )
    expect(
      fromPublished({ id: "p", slug: "quarterly-brief", name: "Quarterly brief" }, "published")
        .name,
    ).toBe("Quarterly brief")
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

// ── D-15: updated_at → updatedAt ─────────────────────────────────────────────────────
//
// The recency half of the identity line. One wire field, two normalizers, and one rule that
// matters more than either: an ABSENT field renders nothing rather than a fabricated time.

/** ISO-8601 with MICROSECONDS, as Postgres renders it — not a value a JS `Date` round-trips. */
const PUB_UPDATED = "2026-06-12T09:30:15.123456+00:00"
const DRAFT_UPDATED = "2026-08-11T14:02:44.987654+00:00"

const publishedWithTime: PublishedWorkflow = { ...publishedVendor, updated_at: PUB_UPDATED }
const draftWithTime: WorkflowDraftRow = { ...draftVendorFork, updated_at: DRAFT_UPDATED }

describe("D-15 — the wire's updated_at reaches LibraryRow.updatedAt", () => {
  it("POSITIVE CONTROL — fromPublished lifts the field when the wire carries it", () => {
    // Paired with the absence cases below so neither can pass for the wrong reason (S-6):
    // if the lift were missing entirely, the `undefined` assertions would still be green.
    expect(fromPublished(publishedWithTime, "published").updatedAt).toBe(PUB_UPDATED)
  })

  it("POSITIVE CONTROL — fromDraft lifts the field when the wire carries it", () => {
    expect(fromDraft(draftWithTime).updatedAt).toBe(DRAFT_UPDATED)
  })

  it("carries the string through VERBATIM, microseconds included", () => {
    // The server formats it; this client only carries it. A normalizer that re-rendered the
    // value through a `Date` would silently truncate `.123456` to `.123`.
    const row = fromPublished(publishedWithTime, "published")
    expect(row.updatedAt).toContain("123456")
    expect(row.updatedAt).toBe(PUB_UPDATED)
  })

  it("an ABSENT wire field yields undefined, never a fabricated time", () => {
    // `publishedVendor` predates this field, which is exactly the stale-deploy shape.
    expect(fromPublished(publishedVendor, "published").updatedAt).toBeUndefined()
    expect(fromDraft(draftVendorFork).updatedAt).toBeUndefined()
  })

  it("an explicit NULL collapses to undefined — one 'nothing to render' case, not two", () => {
    expect(fromPublished({ ...publishedVendor, updated_at: null }, "published").updatedAt)
      .toBeUndefined()
    expect(fromDraft({ ...draftVendorFork, updated_at: null }).updatedAt).toBeUndefined()
  })

  it("the provenance a published row was normalized under does not change the answer", () => {
    expect(fromPublished(publishedWithTime, "starter").updatedAt).toBe(PUB_UPDATED)
    expect(fromPublished(publishedWithTime, "published").updatedAt).toBe(PUB_UPDATED)
  })

  it("survives the merge on all three provenances, including a partial feed", () => {
    // mergeLibrary needs no edit of its own — it runs over whatever arrived — so this pins
    // that the `source-failed` partial path carries the field by construction.
    const rows = mergeLibrary(
      [publishedWithTime],
      [{ ...starterClause, updated_at: PUB_UPDATED }],
      [draftWithTime],
    )
    expect(rows).toHaveLength(3)
    expect(rows.every((r) => typeof r.updatedAt === "string")).toBe(true)

    const draftsOnly = mergeLibrary([], [], [draftWithTime])
    expect(draftsOnly[0].updatedAt).toBe(DRAFT_UPDATED)
  })
})

// ── D-16: the timestamp is NOT the token ─────────────────────────────────────────────

describe("D-16 — fromDraft reads updated_at and never the opaque token", () => {
  it("a token that DISAGREES with updated_at does not become the timestamp", () => {
    // The mechanical form of the fence. Both are rendered from one column server-side, so a
    // normalizer reading `row.token` would look correct against any realistic fixture. Here
    // they are made to disagree, so only the right source can produce the right answer.
    const row = fromDraft({ ...draftWithTime, token: "1999-01-01T00:00:00.000001Z" })

    expect(row.updatedAt).toBe(DRAFT_UPDATED)
    expect(row.updatedAt).not.toBe("1999-01-01T00:00:00.000001Z")
  })

  it("a draft with a token but NO updated_at stays undefined rather than borrowing it", () => {
    // The tempting shortcut, denied: `token` is always present on a draft row, so a
    // `?? row.token` fallback would make this case silently "work" and break every save.
    const row = fromDraft(draftVendorFork)

    expect((row.source as WorkflowDraftRow).token).toBe(draftVendorFork.token)
    expect(row.updatedAt).toBeUndefined()
  })

  it("the token still reaches its handler untouched through `source`", () => {
    expect((fromDraft(draftWithTime).source as WorkflowDraftRow).token)
      .toBe(draftVendorFork.token)
  })

  it("SOURCE FENCE — every updatedAt assignment reads `row.updated_at`", () => {
    // ⚠ SCOPED TO NON-COMMENT LINES ON PURPOSE. Both normalizers carry a comment explaining
    // why `row.token` is forbidden, so a naive search for "token" near "updatedAt" would go
    // RED on a clean tree — the trap `librarySubtree.fences.test.ts` records twice. Stripping
    // line comments first is what makes this fence about code rather than prose.
    const code = libraryFilterSource
      .split("\n")
      .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n")

    const assignments = code.match(/updatedAt:\s*[^,\n]+/g) ?? []
    expect(assignments).toHaveLength(2)
    for (const assignment of assignments) {
      expect(assignment).toContain("row.updated_at")
      expect(assignment).not.toContain("token")
    }
  })

  it("POSITIVE CONTROL — that fence catches a token-derived assignment", () => {
    const planted = "    updatedAt: row.token ?? undefined,"
    const assignments = planted.match(/updatedAt:\s*[^,\n]+/g) ?? []

    expect(assignments).toHaveLength(1)
    expect(assignments[0]).toContain("token")
    expect(assignments[0]).not.toContain("row.updated_at")
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 193.2 / SC#3 — WHERE A FRESHLY-PUBLISHED ROW ACTUALLY LANDS
// ═══════════════════════════════════════════════════════════════════════════════════════
//
// Plan `193.2-03` changed the SERVER: `list_published_workflows` and `list_draft_workflows`
// now `ORDER BY updated_at DESC`, while the curated starters shelf deliberately stays
// `ORDER BY name` (D-16). ⚠ **THAT IS NOT THE SAME CLAIM AS "the newest row appears at the
// top of the library."** The rendered order is decided AFTER the wire, by two pure
// functions in this module, and it is:
//
//     [all starters] ++ [all published] ++ [all drafts]
//
// because `mergeLibrary` inserts into a `Map` in that order (`libraryFilter.ts:145-147`) and
// `[...byId.values()]` returns insertion order, and because `filterLibrary` is a
// `rows.filter(...)` that preserves order and adds no sort of its own. So a recency-first
// published feed lands its newest row at index `starters.length` — NOT at index 0.
//
// ⚠ THE MEASURED RESIDUAL, STATED RATHER THAN SMOOTHED. Against the live operator data
// (`193.2-RESEARCH.md` §R2): 3 curated starters + 28 published (the page passes `?scope=mine`)
// + 78 drafts = 109 rendered rows. The newest published row rendered at **17 of 109** before
// the server change and renders at **4 of 109** after it. **Position 4 is not position 1, and
// no SQL change can make it 1** — the starters block is concatenated CLIENT-side, ahead of
// everything, by this module.
//
// ⚠ AND THE ARITHMETIC IN `BUG-260815-02` WAS OVER THE WRONG FEED. The report's "129 of 146"
// was a `row_number() over (order by name)` across the WHOLE `workflow_definitions` table;
// the page requests `?scope=mine`, so the true before-figure is 17 of 109. Both are recorded,
// neither over the other.
//
// The three honest readings `193.2-RESEARCH.md` §R2 offers, and which one this phase took:
//   1. ACCEPT position 4 and say so — no code, no client sort, D-17's fence stays green.
//      **This is the reading taken.**
//   2. Re-order `mergeLibrary`'s three loops to `published, drafts, starters`. Not a sort, but
//      it inverts the dedupe precedence the `libraryFilter.ts:143-144` comment records ("the
//      later write wins: a row the caller owns should read as theirs rather than as a shared
//      starter"), so it needs its own decision. **Not recommended, and not taken here.**
//   3. Lean on the post-publish Run CTA alone. **Weakest** (§R3).
//
// ⚠ WHETHER POSITION 4 SATISFIES "findable" IS AN OPERATOR JUDGEMENT, NOT A MEASUREMENT.
// It is `OQ-5`, and it goes in front of the operator at the D-21 UAT run. Nothing in this
// file may be read as that verdict; what is pinned below is the arithmetic only.
//
// D-17 / D-18: no client sort is added anywhere, and NO sort control is built. A recency ⇄ A–Z
// toggle belongs to the deferred library sketch (G-2 fires there, `SEED-155` binds); building
// it now would be building it twice. Nothing here touches `LibraryToolbar`.

/** A published/starter feed row carrying a wire `updated_at`, for the ordering fixtures. */
const sc3Published = (id: string, name: string, updatedAt: string): PublishedWorkflow => ({
  id,
  slug: id,
  name,
  definition: chatOnlyDef(`What ${name} is for.`, null, 1),
  is_mine: true,
  is_system_global: false,
  updated_at: updatedAt,
})

const sc3Draft = (id: string, name: string, updatedAt: string): WorkflowDraftRow => ({
  id,
  slug: id,
  version: 1,
  name,
  definition: chatOnlyDef(`What ${name} is for.`, null, 1),
  token: `${updatedAt}-token`,
  updated_at: updatedAt,
})

/**
 * The curated shelf, in the order `list_starter_workflows` still returns it — `ORDER BY name`
 * (D-16, deliberately NOT changed by `193.2-03`).
 */
const SC3_STARTERS: readonly PublishedWorkflow[] = [
  sc3Published("id-s1", "Clause extractor", "2026-01-04T00:00:00.000000+00:00"),
  sc3Published("id-s2", "Meeting minutes", "2026-01-05T00:00:00.000000+00:00"),
  sc3Published("id-s3", "Report builder", "2026-01-06T00:00:00.000000+00:00"),
]

/**
 * The author's own published feed, in the order `list_published_workflows` returns it AFTER
 * `193.2-03` — `ORDER BY updated_at DESC`. This fixture simulates the WIRE; it reaches no
 * database, and it deliberately does not re-derive the ordering client-side.
 *
 * ⚠ THE NEWEST ROW IS NAMED SO THAT IT SORTS **LAST** ALPHABETICALLY (`Z…` against `A…`,
 * `B…`, `M…`). That is what makes the index assertion below able to tell a recency-first
 * feed from the alphabetical one that shipped before — an assertion that passes under both
 * orderings would be inert, which is the class of defect `193.2-03` found a third of its own
 * fence suffering from.
 */
const SC3_PUBLISHED: readonly PublishedWorkflow[] = [
  sc3Published("id-p1", "Zebra quarterly board recap", "2026-08-15T02:07:02.343741+00:00"),
  sc3Published("id-p2", "Missing-clause sweep", "2026-08-14T11:20:00.000000+00:00"),
  sc3Published("id-p3", "Beta supplier ledger", "2026-08-02T09:00:00.000000+00:00"),
  sc3Published("id-p4", "Annual audit pack", "2026-07-01T08:00:00.000000+00:00"),
]

/**
 * The drafts feed, also `updated_at DESC` after `193.2-03`. ⚠ `id-d1` is deliberately the
 * GLOBALLY newest row in the whole fixture — newer than the newest published row — because
 * the rendered order is BLOCK-WISE, not globally recency-sorted, and a fixture where the
 * blocks happen to agree with a global sort could not tell the two apart.
 */
const SC3_DRAFTS: readonly WorkflowDraftRow[] = [
  sc3Draft("id-d1", "Sign-off tracker", "2026-08-15T09:00:00.000000+00:00"),
  sc3Draft("id-d2", "Renewal checker", "2026-08-13T09:00:00.000000+00:00"),
  sc3Draft("id-d3", "Handover pack", "2026-08-09T09:00:00.000000+00:00"),
]

/** The newest published row — the one a person just published and then goes looking for. */
const SC3_NEWEST_PUBLISHED = SC3_PUBLISHED[0]

/**
 * The page's defaults, verbatim: blank query (`WorkflowsPage.tsx:251`), no chips (`:252`),
 * All projects (`:249`). No chip has to be clicked for the published block to be on screen.
 */
const SC3_DEFAULTS: LibrarySelection = { query: "", chips: [], projectId: null }

const sc3Merged = () => mergeLibrary(SC3_PUBLISHED, SC3_STARTERS, SC3_DRAFTS)

describe("193.2 / SC#3 — where a freshly-published row actually lands", () => {
  it("the merge is `starters ++ published ++ drafts`, and it adds no order of its own", () => {
    const ids = idsOf(sc3Merged())

    expect(ids).toEqual([
      ...SC3_STARTERS.map((r) => r.id),
      ...SC3_PUBLISHED.map((r) => r.id),
      ...SC3_DRAFTS.map((r) => r.id),
    ])

    // …and each block's INTERNAL order is the order that block arrived in, unmodified — the
    // server's `ORDER BY` survives the merge rather than being re-decided here (D-17).
    expect(ids.slice(0, SC3_STARTERS.length)).toEqual(SC3_STARTERS.map((r) => r.id))
    expect(ids.slice(SC3_STARTERS.length, SC3_STARTERS.length + SC3_PUBLISHED.length)).toEqual(
      SC3_PUBLISHED.map((r) => r.id),
    )
    expect(ids.slice(SC3_STARTERS.length + SC3_PUBLISHED.length)).toEqual(
      SC3_DRAFTS.map((r) => r.id),
    )
  })

  it("a recency-first published feed lands its newest row at index `starters.length`", () => {
    // The premise, asserted rather than assumed: the newest published row sorts LAST by name,
    // so this index would be a DIFFERENT row under the alphabetical ordering that shipped
    // before `193.2-03`. Without this, the assertion below could not distinguish the change
    // from its absence.
    const byName = [...SC3_PUBLISHED].sort((a, b) => a.name.localeCompare(b.name))
    expect(byName[byName.length - 1].id).toBe(SC3_NEWEST_PUBLISHED.id)
    expect(byName[0].id).not.toBe(SC3_NEWEST_PUBLISHED.id)

    const rows = sc3Merged()

    // ⚠ THE INDEX IS THE EXPRESSION `SC3_STARTERS.length`, NEVER A HARD-CODED 3. A literal
    // rots the moment the curated shelf grows by one — which is exactly how
    // `GSD_VITEST_MAX_WORKERS=4` rotted: a constant that was correct when written and became
    // wrong when the thing it was a function of changed.
    expect(rows[SC3_STARTERS.length].id).toBe(SC3_NEWEST_PUBLISHED.id)
    expect(rows[SC3_STARTERS.length].provenance).toBe("published")
  })

  it("`filterLibrary` under the page's defaults preserves that index — the RENDERED claim", () => {
    // This is the case that makes the claim about the list a person SEES rather than about
    // the merge in isolation: `visibleRows` (`WorkflowsPage.tsx:458-461`) is what
    // `visibleRows.map(...)` renders into ONE FLAT LIST (`:1045-1055`), with no shelf and no
    // section header between the blocks.
    const rows = sc3Merged()
    const visible = filterLibrary(rows, SC3_DEFAULTS)

    // Order-identical on the mapped ids, not merely equal in length — a length check would
    // pass under any permutation, which is the whole property under test.
    expect(idsOf(visible)).toEqual(idsOf(rows))
    expect(visible[SC3_STARTERS.length].id).toBe(SC3_NEWEST_PUBLISHED.id)

    // …and non-vacuously: every fixture row survives the defaults, so the index above is an
    // index into the whole library rather than into a filtered remnant.
    expect(visible).toHaveLength(
      SC3_STARTERS.length + SC3_PUBLISHED.length + SC3_DRAFTS.length,
    )
  })

  it("THE RESIDUAL — the newest published row is NOT at index 0 while there are starters", () => {
    // ⚠ STATED, NOT SMOOTHED. SC#3 asks for a just-published workflow to be findable "without
    // knowing its name — it is near the top of the list, or both". Measured against the live
    // operator data, the after-state is **rendered position 4 of 109**, not 1.
    //
    // THE REASON is client-side concatenation, not the SQL: `mergeLibrary` writes the three
    // starters into the `Map` first (`libraryFilter.ts:145`), so the published block can never
    // begin before index `starters.length` however the server orders it. No `ORDER BY` change
    // can move this.
    //
    // THE OPTION NOT TAKEN: re-ordering the three loops to `published, drafts, starters` WOULD
    // put the newest row at index 0. It is `193.2-RESEARCH.md` §R2 reading 2 and it is NOT
    // recommended — it silently inverts the dedupe precedence recorded at
    // `libraryFilter.ts:143-144` ("the later write wins"), so any future feed collision would
    // resolve the other way round. That is a decision of its own, not a side effect of a
    // findability fix. Reading 1 (accept position 4, and say so here) is the one taken.
    //
    // ⚠ WHETHER POSITION 4 IS GOOD ENOUGH IS `OQ-5` — a product judgement carried into the
    // D-21 UAT run for the operator to make. This case pins the arithmetic; it does not, and
    // may not, be read as a verdict that the row is "findable".
    const rows = sc3Merged()

    expect(SC3_STARTERS.length).toBeGreaterThan(0) // the premise the residual depends on
    expect(rows[0].provenance).toBe("starter")
    expect(rows[0].id).not.toBe(SC3_NEWEST_PUBLISHED.id)
    expect(idsOf(rows).indexOf(SC3_NEWEST_PUBLISHED.id)).toBe(SC3_STARTERS.length)
    expect(idsOf(rows).indexOf(SC3_NEWEST_PUBLISHED.id)).not.toBe(0)

    // The counterfactual, so the residual reads as a consequence rather than as a mood: with
    // an EMPTY starters shelf the very same feeds put the newest published row at index 0.
    const noShelf = mergeLibrary(SC3_PUBLISHED, [], SC3_DRAFTS)
    expect(noShelf[0].id).toBe(SC3_NEWEST_PUBLISHED.id)
  })

  it("the rendered order is BLOCK-WISE, never globally recency-sorted", () => {
    // A second measured residual, recorded because it is the one a reader is most likely to
    // assume away: `id-d1` is the newest row in the entire fixture, and it still renders in
    // the drafts block, behind every published row. "Order by recency" is true of each FEED,
    // and false of the LIST.
    const newestOfAll = [...SC3_STARTERS, ...SC3_PUBLISHED, ...SC3_DRAFTS].reduce((a, b) =>
      (a.updated_at ?? "") > (b.updated_at ?? "") ? a : b,
    )
    expect(newestOfAll.id).toBe("id-d1") // the premise, asserted

    const ids = idsOf(sc3Merged())
    expect(ids.indexOf("id-d1")).toBeGreaterThan(ids.indexOf(SC3_NEWEST_PUBLISHED.id))
    expect(ids.indexOf("id-d1")).toBe(SC3_STARTERS.length + SC3_PUBLISHED.length)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// F-7 EXTENDED — D-17: SERVER `ORDER BY` IS THE SOLE ORDERING AUTHORITY
// ═══════════════════════════════════════════════════════════════════════════════════════
//
// The shipped F-7 fence (`rowIdentity.test.ts:167-179`, T-7 / P-4) is scoped to
// `rowIdentity.ts`'s OWN source, so **nothing today would catch a client sort introduced in
// `libraryFilter.ts` or `WorkflowsPage.tsx`** — which are precisely the two modules that hold
// the merged list and could most plausibly grow one. `193.2-03` moved two feeds to
// `ORDER BY updated_at DESC` on the server; that change is only sufficient while no client
// re-orders the result. This block extends the fence to those two modules.
//
// It reproduces ALL FOUR parts of the canonical `rowIdentity.test.ts` template — three is not
// enough, and each part answers a different way a fence goes blind:
//   1. SCOPE       — comments stripped first, so a docblock DESCRIBING a forbidden shape does
//                    not red a clean tree (the 187-24 trap; `libraryFilter.test.ts:461-468`
//                    and `rowIdentity.test.ts:89-99` both already scope themselves this way).
//   2. NON-VACUITY — the stripper is proved to keep the CODE and drop the PROSE, and the
//                    swept corpus is stated explicitly rather than assumed non-empty.
//   3. ABSENCE     — the actual rule.
//   4. INLINE PLANT— a literal forbidden string asserted to MATCH the needle, kept permanently
//                    in the file rather than performed once and described in a summary.
//
// ⚠ AND PARTS 1-4 ARE STILL NOT SUFFICIENT ON THEIR OWN. An inline needle-match proves the
// REGEX sees the shape; only a REAL plant in production source proves the FENCE is pointed at
// the right file. Both arms were driven RED against real plants — one in `libraryFilter.ts`
// and one in `WorkflowsPage.tsx`, separately — and restored; the observations are recorded in
// `193.2-04-SUMMARY.md`. Phase 193.1 found FOUR fences that could not fire and every one was
// caught by planting, none by reading.
//
// ⚠ AND PART 4 WAS STILL NOT ENOUGH, WHICH IS THE 2026-08-15 `WR-04` LESSON — recorded here
// rather than only in the review, because the paragraph above reads as a completeness claim
// and was not one. Both arms WERE planted, and both plants used the MUTATING `rows.sort(` /
// `visibleRows.sort(` shape — the one form the needle already caught. Planting only the shape
// the needle was written for proves the fence is aimed at the right FILE and nothing at all
// about its coverage of the RULE. The seven-shape table the reviewer executed found six
// escapes. **A plant must be chosen to falsify the needle, not to confirm it.**
//
// The `WR-04` re-drive: TEN plants, one shape at a time, each in production source, each
// restored to an EMPTY `git diff --numstat` before the next — the seven shapes from the
// review's own table (`rows.sort(` · `[...rows].sort(` · `[...visibleRows].sort(` ·
// `visibleRows.slice().sort(` · `Array.from(rows).sort(` · `visibleRows.toSorted(` ·
// `[...rows].reverse()`), landed in whichever of the two modules binds that receiver, plus
// three more against `rowIdentity.ts` for the second home of this fence. All ten observed RED.
// ⚠ AND THE COUNTER-MEASUREMENT, which is what proves the old fence was blind rather than
// merely narrow: under the IDENTICAL plants, the PRE-`WR-04` fence reported **132 passed (132)
// — fully green** for `visibleRows.toSorted(` and for `[...rows].reverse()`, and for
// `[...rows].sort(` only the corpus check fired while the needle itself stayed silent.
// Measured, not inferred.
//
// ⚠ THE SHIPPED `rowIdentity.test.ts:167` FENCE IS NOT EDITED, WEAKENED OR DUPLICATED. It
// stays green and unchanged; this block adds coverage beside it, over different modules.

/**
 * Block comments first, then whole-line `//` comments — the same two-step
 * `rowIdentity.test.ts:99` uses. JSX comment bodies (a block comment wrapped in braces) are
 * removed by the first replacement, which is what takes `WorkflowsPage.tsx`'s prose out of
 * scope: `ONE FLAT LIST (D-02)` at `WorkflowsPage.tsx:1045` is one of those.
 */
const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const libraryFilterCode = stripComments(libraryFilterSource)
const workflowsPageCode = stripComments(workflowsPageSource)

/**
 * The forbidden shapes: a re-order of the MERGED ROW LIST under any of the five names the two
 * modules actually use for it. Deliberately NOT a bare `.sort(` — a sort that names a narrow
 * thing it sorts (a slug's version numbers, a row's candidate axes) is legal and is what
 * `rowIdentity.ts` does twice.
 *
 * ⚠ WIDENED 2026-08-15 (code review `WR-04`). WHAT THIS NEEDLE WAS UNTIL THEN IS RECORDED HERE
 * VERBATIM RATHER THAN DELETED, because the shape it had is the finding:
 *
 *     /\brows\.sort\(|\bvisibleRows\.sort\(|\bmerged\.sort\(|\bfamily\.sort\(|\blist\.sort\(/
 *
 * It matched the RECEIVER NAME immediately followed by `.sort(` — i.e. **only the MUTATING
 * form, the one a React developer already avoids.** Executed by the reviewer in `node` against
 * seven realistic shapes, it caught `rows.sort(` and missed all six others: `[...rows].sort(`,
 * `[...visibleRows].sort(`, `visibleRows.slice().sort(`, `Array.from(rows).sort(`,
 * `visibleRows.toSorted(` and `[...rows].reverse()`. `Array.prototype.sort` MUTATES, so someone
 * re-ordering a memoised list will write `[...visibleRows].sort(...)` — the needle was blind to
 * exactly what would be written. **That idiom is not hypothetical in this repository:** a sweep
 * of all 318 non-test modules under `frontend/src` finds `[...list].sort((a, b) =>` shipping
 * today in `SkillEvalSection.tsx:54` and `EvalsTab.tsx:51`. Neither is in this fence's scope —
 * they are the evidence that the missed shape is the NATURAL one, not a contrived evasion.
 *
 * The rule is now the SHAPE, in four named arms, rather than one hard-coded punctuation
 * sequence — and it covers the non-mutating `toSorted` / `reverse` / `toReversed` siblings that
 * escaped both this needle AND the corpus assertion below:
 *
 *   (a) direct        `rows.sort(`  ·  `visibleRows.toSorted(`  ·  `merged.reverse()`
 *   (b) spread copy   `[...rows].sort(`  ·  `[...starters, ...merged].toReversed(`
 *   (c) `Array.from`  `Array.from(rows).sort(`  ·  `Array.from(new Set(rows)).reverse(`
 *   (d) method copy   `rows.slice().sort(`  ·  `visibleRows.filter(p).toSorted(`
 *
 * ⚠ AND THE OPPOSITE FAILURE IS FENCED TOO, because a regex broad enough to catch `.toSorted(`
 * is broad enough to red legitimate code. The arms are anchored on a row-list receiver rather
 * than on a free gap — an earlier draft used `NAME …{0,40}? [\])] . REORDER(` and was measured
 * FALSE-POSITIVE on `if (rows.length) return items.map(f).sort(g)`, which is why (b)/(c)/(d)
 * are spelled out instead. Swept over the three files this fence actually reads AND over the
 * whole 13-module `library/` subtree: **ZERO hits**, with `rowIdentity.ts`'s two legal narrow
 * sorts (`[...new Set(versions)].sort(` and `candidates.sort(`) untouched by all four arms.
 *
 * ⚠ THIS NEEDLE HAS A SECOND HOME AND THEY MOVE TOGETHER: `rowIdentity.test.ts`'s T-7 / P-4
 * case carries the same rule over a THIRD module (`rowIdentity.ts`) and had the identical blind
 * spot. It was widened in the same commit. A cross-reference is kept in both files because the
 * two fences read different sources and neither may import the other's `?raw` scope.
 */
const ROW_LIST = "(?:rows|visibleRows|merged|family|list)"
const REORDER = "(?:sort|toSorted|reverse|toReversed)"
const COPY = "(?:slice|concat|filter|map|flat|flatMap|toSpliced|with)"
const DOT = "\\s*\\.\\s*"
const FORBIDDEN_ROW_SORT = new RegExp(
  [
    `\\b${ROW_LIST}${DOT}${REORDER}\\s*\\(`,
    `\\[[^\\]\\n]*\\.\\.\\.\\s*${ROW_LIST}\\b[^\\]\\n]*\\]${DOT}${REORDER}\\s*\\(`,
    `\\bArray${DOT}from\\s*\\([^;\\n]{0,60}?\\b${ROW_LIST}\\b[^;\\n]{0,40}?\\)${DOT}${REORDER}\\s*\\(`,
    `\\b${ROW_LIST}${DOT}${COPY}\\s*\\([^;\\n]{0,60}?\\)${DOT}${REORDER}\\s*\\(`,
  ].join("|"),
)

/** Every non-mutating sibling of `.sort(`, for the corpus assertion — `WR-04`'s other half. */
const ANY_REORDER_CALL = /\.\s*(?:sort|toSorted|reverse|toReversed)\s*\(/

const SWEPT = [
  ["libraryFilter.ts", libraryFilterCode],
  ["WorkflowsPage.tsx", workflowsPageCode],
] as const

describe("F-7 extended — no client sort on the merged list (D-17)", () => {
  it("is really the two files under test (non-vacuity)", () => {
    expect(libraryFilterSource.length).toBeGreaterThan(2000)
    expect(workflowsPageSource.length).toBeGreaterThan(20000)
    expect(libraryFilterSource).toContain("export function mergeLibrary")
    expect(workflowsPageSource).toContain("export function WorkflowsPage")
  })

  it("the comment stripper leaves the CODE and removes the PROSE (non-vacuity)", () => {
    // Without this pair, every fence below could pass by stripping the whole file — the
    // failure mode a fence cannot report about itself.
    expect(libraryFilterCode).toContain("export function mergeLibrary")
    expect(libraryFilterCode).toContain("export function filterLibrary")
    expect(workflowsPageCode).toContain("export function WorkflowsPage")

    // …and the prose really is gone. `D-16` is a decision id that appears ONLY inside comments
    // in BOTH modules (measured), so it is the one token that proves the strip on each.
    expect(libraryFilterSource).toContain("D-16")
    expect(libraryFilterCode).not.toContain("D-16")
    expect(workflowsPageSource).toContain("D-16")
    expect(workflowsPageCode).not.toContain("D-16")
    expect(workflowsPageSource).toContain("ONE FLAT LIST")
    expect(workflowsPageCode).not.toContain("ONE FLAT LIST")
  })

  it("SCOPE — the stripped page still contains the merged-list region the fence exists to watch", () => {
    // A stripper that survived its own non-vacuity guard could still have eaten the ~600 lines
    // where a sort would actually be written. These three anchors ARE that region: the merge,
    // the narrow, and the render.
    expect(workflowsPageCode).toContain("mergeLibrary(published, starters, drafts)")
    expect(workflowsPageCode).toContain("filterLibrary(rows, { query, chips: activeChips")
    expect(workflowsPageCode).toContain("visibleRows.map(")
  })

  it("NON-VACUITY — the swept corpus is EMPTY today: neither module re-orders anything at all", () => {
    // ⚠ STATED RATHER THAN GLOSSED. `rowIdentity.test.ts:173` can assert
    // `sorts.length > 0` because that module really does sort two narrow things. These two
    // modules sort NOTHING, so the equivalent guard here is the opposite assertion: the
    // corpus is empty, deliberately, and the absence fence below therefore sweeps zero lines
    // TODAY. That is a true statement about a clean tree, not a fence passing by accident —
    // and the real-plant RED runs recorded in `193.2-04-SUMMARY.md` are what prove the fence
    // starts seeing lines the moment one is written.
    //
    // ⚠ WIDENED FROM `.includes(".sort(")` TO EVERY REORDER SIBLING (`WR-04`, 2026-08-15).
    // The review's table found `.toSorted(` and `.reverse()` escaping BOTH this corpus check
    // and the needle — so on the two shapes a developer is MOST likely to write, the property
    // rested on nothing at all. This assertion is the totalising half of the pair: it never
    // looks at a receiver name, so no evasion by renaming is possible while it holds.
    for (const [name, code] of SWEPT) {
      const reorders = code.split("\n").filter((line) => ANY_REORDER_CALL.test(line))
      expect(reorders, name).toHaveLength(0)
    }
  })

  it("INLINE PLANT — the needle really catches the shapes it forbids, mutating AND not", () => {
    // Kept permanently in the file, exactly as `rowIdentity.test.ts:169-172` keeps its own.
    //
    // ⚠ ALL SEVEN OF THE REVIEW'S OWN `WR-04` SHAPES ARE HERE, INDIVIDUALLY. Six of them were
    // MEASURED escaping the pre-2026-08-15 needle; a fence that catches six of seven is the
    // same finding again, so each shape is spelled out rather than represented by a sample.
    for (const forbidden of [
      "const shown = rows.sort(cmp)", //                   caught before AND after
      "const shown = [...rows].sort(cmp)", //              ← escaped
      "const shown = [...visibleRows].sort(cmp)", //       ← escaped
      "const shown = visibleRows.slice().sort(cmp)", //    ← escaped
      "const shown = Array.from(rows).sort(cmp)", //       ← escaped
      "const shown = visibleRows.toSorted(cmp)", //        ← escaped (and the corpus check too)
      "const shown = [...rows].reverse()", //              ← escaped (and the corpus check too)
      // …and the same evasions on the other three receiver names this needle governs.
      "return merged.toSorted(byUpdatedAtDesc)",
      "return [...merged].reverse()",
      "const x = family.toReversed()",
      "const y = [...list].sort(byName)",
      "const z = list.slice().toSorted(byName)",
      "const w = visibleRows.filter(Boolean).sort(cmp)",
      "const v = Array.from(visibleRows).toSorted(cmp)",
      "  const ordered = visibleRows.sort(byUpdatedAtDesc)",
      "  return merged.sort((a, b) => b.updatedAt - a.updatedAt)",
    ]) {
      expect(forbidden, forbidden).toMatch(FORBIDDEN_ROW_SORT)
    }

    // …and the legal shapes are NOT caught, or the absence assertion would be unsatisfiable
    // the day either module legitimately sorts something narrow of its own.
    //
    // ⚠ THE OPPOSITE FAILURE IS AS REAL AS THE ONE BEING FIXED, and these rows are what keep
    // the widening honest. The first four are `rowIdentity.ts`'s ACTUAL shipped lines — a
    // needle that redded them would break a green module. The `rows.length … items.map(f)`
    // row is not decorative: an earlier draft of this needle used a free character gap and was
    // measured FALSE-POSITIVE on exactly it.
    for (const legal of [
      "const ascending = [...new Set(versions)].sort((a, b) => a - b)",
      "candidates.sort((a, b) => a.narrowed - b.narrowed || a.priority - b.priority)",
      "versions.sort((a, b) => a - b)",
      "candidates.sort(byRank)",
      "chips.sort()",
      "Object.keys(byId).sort()",
      "if (rows.length) return items.map(f).sort(g)",
      "const n = rows.length; return versions.sort(g)",
      "const listed = names.toSorted()",
      "segments.reverse()",
    ]) {
      expect(legal, legal).not.toMatch(FORBIDDEN_ROW_SORT)
    }
  })

  it("ABSENCE — no line in either stripped source re-orders the merged row list", () => {
    for (const [name, code] of SWEPT) {
      for (const line of code.split("\n")) {
        expect(line, `${name}: ${line.trim()}`).not.toMatch(FORBIDDEN_ROW_SORT)
      }
    }
  })

  it("D-18 — and no sort CONTROL is wired from either module either", () => {
    // The deferred library sketch owns any recency ⇄ A–Z toggle (G-2 fires there, `SEED-155`
    // binds). Building it now would be building it twice, so the absence is pinned rather
    // than left to good intentions.
    for (const [name, code] of SWEPT) {
      expect(code, name).not.toMatch(/\bsortOrder\b|\bsortBy\b|\bsetSortOrder\b|\borderBy\b/)
    }
    // POSITIVE CONTROL — the needle catches the state hook such a control would need.
    expect("const [sortOrder, setSortOrder] = useState('recent')").toMatch(/\bsortOrder\b/)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// Phase 192.2-09 (LIB-06 — gap-closure round 1, WR-04) — `matchReasons`
// ══════════════════════════════════════════════════════════════════════════════════════
//
// D-03 cut six atoms from the resting card; three ways into the list still select on facts
// that left with them. These cases prove the repair is DERIVED — the same predicates, the
// same needle — and, more importantly, that it emits NOTHING when nothing was asked, which
// is the property the resting card's byte-identity depends on.

/** Build a selection without re-typing the three fields at every call site. */
const sel = (over: Partial<LibrarySelection> = {}): LibrarySelection => ({
  query: "",
  chips: [],
  projectId: null,
  ...over,
})

const rowById = (id: string) => merged().find((r) => r.id === id)!

describe("192.2-09 (WR-04) — matchReasons emits nothing unless something was asked", () => {
  it("an EMPTY selection returns an EMPTY array — the property the resting card rests on", () => {
    // Asserted directly, on every row in the corpus, because "the card renders nothing at
    // rest" is a claim about this function before it is a claim about any DOM.
    for (const row of merged()) {
      expect(matchReasons(row, sel()), row.id).toEqual([])
    }
  })

  it("a BLANK or WHITESPACE-ONLY query emits nothing, on a row whose purpose would match", () => {
    const vendor = rowById(publishedVendor.id)
    expect(matchReasons(vendor, sel({ query: "" }))).toEqual([])
    expect(matchReasons(vendor, sel({ query: "   " }))).toEqual([])
    // POSITIVE CONTROL — the same row DOES answer once a real needle is typed, so the two
    // assertions above are not passing because the fixture can never match.
    expect(matchReasons(vendor, sel({ query: "supplier" }))).toEqual(["purpose"])
  })

  it("the four chips that already have a visible carrier emit NOTHING while pressed", () => {
    // Each is pressed on a row it genuinely selects — proved by the predicate, so the empty
    // result cannot be an artifact of a row the chip would not have returned anyway.
    const silent: [ChipId, string][] = [
      ["ready-to-run", publishedVendor.id],
      ["yours", publishedVendor.id],
      ["still-building", draftSignoff.id],
      ["starters", starterClause.id],
    ]
    for (const [chip, id] of silent) {
      const row = rowById(id)
      expect(CHIP_PREDICATES[chip](row), `${chip} must really select ${id}`).toBe(true)
      expect(matchReasons(row, sel({ chips: [chip] })), chip).toEqual([])
    }
  })
})

describe("192.2-09 (WR-04) — the two chips whose atoms D-03 cut", () => {
  it("Makes a file: pressed AND true yields the reason; pressed AND false yields nothing", () => {
    const makesFile = rowById(publishedVendor.id)
    const chatOnly = rowById(publishedRecap.id)
    expect(CHIP_PREDICATES["makes-a-file"](makesFile)).toBe(true)
    expect(CHIP_PREDICATES["makes-a-file"](chatOnly)).toBe(false)
    expect(matchReasons(makesFile, sel({ chips: ["makes-a-file"] }))).toEqual(["makes-a-file"])
    // The RIGHT reason for the empty answer: the chip is pressed, the row simply is not one.
    expect(matchReasons(chatOnly, sel({ chips: ["makes-a-file"] }))).toEqual([])
  })

  it("Makes a file: TRUE but NOT pressed yields nothing — a card never volunteers it", () => {
    const makesFile = rowById(publishedVendor.id)
    expect(CHIP_PREDICATES["makes-a-file"](makesFile)).toBe(true)
    expect(matchReasons(makesFile, sel({ chips: ["yours"] }))).toEqual([])
  })

  it("Strict: pressed AND true yields the reason; pressed AND false yields nothing", () => {
    const strictRow = rowById(starterClause.id)
    const looseRow = rowById(draftSignoff.id)
    expect(CHIP_PREDICATES.strict(strictRow)).toBe(true)
    expect(CHIP_PREDICATES.strict(looseRow)).toBe(false)
    expect(matchReasons(strictRow, sel({ chips: ["strict"] }))).toEqual(["strict"])
    expect(matchReasons(looseRow, sel({ chips: ["strict"] }))).toEqual([])
  })

  it("Strict: TRUE but NOT pressed yields nothing", () => {
    const strictRow = rowById(starterClause.id)
    expect(CHIP_PREDICATES.strict(strictRow)).toBe(true)
    expect(matchReasons(strictRow, sel({ chips: ["starters"] }))).toEqual([])
  })

  it("both chips pressed on a row that is both — both reasons, in ONE stable order", () => {
    const both = rowById(publishedVendor.id)
    expect(matchReasons(both, sel({ chips: ["makes-a-file", "strict"] }))).toEqual([
      "makes-a-file",
      "strict",
    ])
    // …and the order is the FUNCTION's, not the caller's array order — otherwise two people
    // who pressed the same two chips in a different sequence would read two different lines.
    expect(matchReasons(both, sel({ chips: ["strict", "makes-a-file"] }))).toEqual([
      "makes-a-file",
      "strict",
    ])
  })

  it("DERIVED, NOT RE-IMPLEMENTED — the reason agrees with the predicate on every row", () => {
    // T-192.2-41: a second copy of a predicate would let the card claim a reason the filter
    // did not act on. Swept over the whole corpus rather than spot-checked.
    for (const row of merged()) {
      const reasons = matchReasons(row, sel({ chips: ["makes-a-file", "strict"] }))
      expect(reasons.includes("makes-a-file"), row.id).toBe(CHIP_PREDICATES["makes-a-file"](row))
      expect(reasons.includes("strict"), row.id).toBe(CHIP_PREDICATES.strict(row))
    }
  })

  it("every row a chip RETURNS carries that chip's reason — the WR-04 gap, closed", () => {
    // The defect in its own terms: `filterLibrary` hands back a set, and before this plan
    // some members of that set carried no visible evidence of the property that selected
    // them. Now every member can say it.
    for (const chip of ["makes-a-file", "strict"] as const) {
      const selection = sel({ chips: [chip] })
      const returned = filterLibrary(merged(), selection)
      expect(returned.length).toBeGreaterThan(0) // non-vacuity
      for (const row of returned) {
        expect(matchReasons(row, selection), `${chip} ${row.id}`).toContain(chip)
      }
    }
  })
})

describe("192.2-09 (WR-04) — the purpose reason, and the name clause that guards it", () => {
  it("a needle that lives ONLY in the purpose yields the purpose reason", () => {
    const vendor = rowById(publishedVendor.id)
    expect(vendor.name.toLowerCase()).not.toContain("supplier")
    expect(matchReasons(vendor, sel({ query: "supplier" }))).toEqual(["purpose"])
  })

  it("a needle in the NAME yields NO purpose reason, even when the purpose carries it too", () => {
    // ⚠ THE CASE RULE 3's NAME CLAUSE EXISTS FOR. `HighlightTitle` already marks a name hit,
    // so repeating it underneath is precisely the duplication D-03 removed. Without this
    // case the clause is unguarded and could be deleted with every other test still green.
    const both = fromPublished(
      {
        id: "id-both",
        slug: "recap-both",
        name: "Quarterly recap",
        definition: chatOnlyDef("Recap the quarter for the board.", null, 1),
      },
      "published",
    )
    expect(both.name.toLowerCase()).toContain("recap")
    expect(String(both.def?.business_requirement).toLowerCase()).toContain("recap")
    expect(matchesQuery(both, "recap")).toBe(true) // it IS in the filtered set…
    expect(matchReasons(both, sel({ query: "recap" }))).toEqual([]) // …and says nothing extra
  })

  it("a needle in NEITHER field yields nothing — the row is not in the set at all", () => {
    const vendor = rowById(publishedVendor.id)
    expect(matchesQuery(vendor, "zzz-no-such-word")).toBe(false)
    expect(matchReasons(vendor, sel({ query: "zzz-no-such-word" }))).toEqual([])
  })

  it("the needle is normalized ONCE — the same trim and case-fold matchesQuery uses", () => {
    const vendor = rowById(publishedVendor.id)
    for (const query of ["supplier", "SUPPLIER", "  Supplier  ", "SuPpLiEr"]) {
      expect(matchesQuery(vendor, query), query).toBe(true)
      expect(matchReasons(vendor, sel({ query })), query).toEqual(["purpose"])
    }
    // Substring, mid-word, exactly as D-08 says — no second matching rule crept in here.
    expect(matchReasons(vendor, sel({ query: "uppli" }))).toEqual(["purpose"])
  })

  it("chip reasons come FIRST and the purpose reason LAST", () => {
    const vendor = rowById(publishedVendor.id)
    expect(
      matchReasons(vendor, sel({ query: "supplier", chips: ["strict", "makes-a-file"] })),
    ).toEqual(["makes-a-file", "strict", "purpose"])
  })
})

describe("192.2-09 (WR-04) — the words are READ from the chip table, never re-spelled", () => {
  it("the two chip reasons ARE the chip labels — the same value, not a matching literal", () => {
    // D-14 / DEC-09-D: the chip a person pressed and the reason the row gives back must be
    // one word. Comparing the two EXPORTS is what makes a re-spelling in either place red.
    expect(MATCH_REASON_WORDS["makes-a-file"]).toBe(CHIP_WORDS["makes-a-file"].label)
    expect(MATCH_REASON_WORDS.strict).toBe(CHIP_WORDS.strict.label)
  })

  it("the purpose word is this module's own, and is the exported one", () => {
    expect(MATCH_REASON_WORDS.purpose).toBe(MATCH_REASON_PURPOSE)
  })

  it("every MatchReason has a word, and the table has no member the union does not", () => {
    const ids: MatchReason[] = ["makes-a-file", "strict", "purpose"]
    expect(Object.keys(MATCH_REASON_WORDS).sort()).toEqual([...ids].sort())
    for (const id of ids) expect(MATCH_REASON_WORDS[id].length).toBeGreaterThan(0)
  })

  it("the prefix and separator exist and are non-empty — the line's fixed parts", () => {
    // The prefix is what stops a bare `Strict` beside a card from reading as the tier atom
    // D-03 cut; a blank one would silently re-create exactly that.
    expect(MATCH_REASON_PREFIX.length).toBeGreaterThan(0)
    expect(MATCH_REASON_SEPARATOR.length).toBeGreaterThan(0)
  })

  it("the module still holds NO user-facing string of its own", () => {
    // `libraryFilter.ts` has never spelled a word a person reads, and `matchReasons` returns
    // IDS precisely so it never starts. The words live one module over.
    expect(libraryFilterSource).not.toContain(MATCH_REASON_PURPOSE)
    expect(libraryFilterSource).not.toContain(MATCH_REASON_PREFIX)
  })
})

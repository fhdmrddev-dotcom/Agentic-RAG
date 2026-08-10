/**
 * Phase 192-05 Task 2 (LIB-01 — D-03 / D-04 / D-07 / D-08 / D-16 / D-17) — the library's
 * merge and filter, as ONE PURE FUNCTION SET.
 *
 * NORMALIZE → MERGE+DEDUPE → NARROW → COUNT. Three feeds arrive as two wire types; this
 * module turns them into one flat `LibraryRow[]`, then answers two questions about that
 * list: which rows does the current search / chip / project selection render, and what
 * number does each chip honestly promise. It renders nothing and holds no state, so every
 * rule below is unit-testable with zero rendering — which is the point: the chips'
 * correctness is arithmetic, and arithmetic proved through a DOM is proved expensively and
 * incompletely.
 *
 * PURE + CLIENT-SIDE, in the `soulData.ts:13-15` / `deriveTier.ts:12-13` sense: **this
 * module imports NOTHING from the API client at runtime**. It needs the two wire TYPES, and
 * a `import type` keeps the claim true — the distinction `runVocabulary.ts:34-36` states in
 * words and `libraryFilter.test.ts` asserts over this file's own source.
 *
 * DERIVE, DO NOT RE-IMPLEMENT. Two of the six chips are questions the codebase already
 * answers: *Makes a file* is `soulDeliverable`, *Strict* is `tierForDefinition`. Neither is
 * re-written here, and the *Strict* case is the one that matters — `tierForDefinition`
 * picks the STRICTEST citation policy across every emit phase deterministically
 * (`soulData.ts:100-102`, WR-03), so a hand-rolled equality test against the strict policy
 * on the first emit phase it finds is ORDER-DEPENDENT and already has a regression test
 * against it (`WorkflowsPage.test.tsx:279`). A second implementation of a derivation is a
 * second
 * answer, and two answers to one question is the drift `soulData.ts` exists to forbid.
 */
import { soulDeliverable, tierForDefinition, type DefShape } from "@/components/workflows/soulData"
import { TIERS } from "@/components/workflows/deriveTier"
import type { PublishedWorkflow, WorkflowDraftRow } from "@/lib/api"
import type { ChipId, LibraryRow, Provenance } from "./libraryRow"

/**
 * The "Unbound (no project)" sentinel — the SAME VALUE the page has shipped since IR-04
 * (`WorkflowsPage.tsx:67`), RE-HOMED here rather than re-invented, and re-homed for a
 * mechanical reason: no module under `library/` may name a `WorkflowsPage` specifier in any
 * import form (fence F4 — an import back typechecks clean, lints clean, and fails only at
 * runtime as a TDZ cycle). The sentinel therefore has to live at or below the leaves, and
 * this is the lowest module that needs it. The page adopts it from here when it is
 * rewritten; until then its own copy is the identical string, so neither side can drift
 * without the other noticing.
 *
 * It exists because "no project" is not expressible as a `?project_folder_id=` value: the
 * server filter narrows to a folder, and the absence of a folder is a client-side question.
 */
export const UNBOUND = "__unbound__"

/** The selection the library is narrowed by. `projectId === null` means "All projects". */
export interface LibrarySelection {
  query: string
  chips: readonly ChipId[]
  projectId: string | null
}

// ── normalize ────────────────────────────────────────────────────────────────────────

/** Read the definition JSONB in the shape the soul helpers take (the house cast). */
const defOf = (definition: unknown): DefShape | undefined =>
  (definition ?? undefined) as DefShape | undefined

/**
 * A `/published` or `/starters` row → a `LibraryRow`. `PublishedWorkflow` carries no
 * version of its own, so the version is read out of the definition exactly as the shipped
 * card reads it (`WorkflowsPage.tsx:762`) — and stays `undefined` rather than defaulting to
 * 1 when the definition has none, because a fabricated version is a lie a reader cannot see
 * through.
 */
export function fromPublished(
  row: PublishedWorkflow,
  provenance: Extract<Provenance, "starter" | "published">,
): LibraryRow {
  const def = defOf(row.definition)
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    version: typeof def?.version === "number" ? def.version : undefined,
    def,
    provenance,
    // Only ever what the wire said. `undefined` is "the backend did not tell us", which
    // the *Yours* predicate reads as the feed-derived fallback — never as `false`.
    isMine: row.is_mine,
    source: row,
  }
}

/**
 * A `/drafts` row → a `LibraryRow`. The nullable wire `name` falls back to the slug,
 * mirroring the shipped draft card (`WorkflowsPage.tsx:706`), and `isMine` is deliberately
 * left `undefined`: `/workflows/drafts` is already scoped to `created_by = $1`, so the
 * feed-derived fallback answers *yes* correctly without this row asserting a bit that no
 * payload ever carried.
 */
export function fromDraft(row: WorkflowDraftRow): LibraryRow {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name ?? row.slug,
    version: row.version,
    def: defOf(row.definition),
    provenance: "draft",
    isMine: undefined,
    source: row,
  }
}

// ── merge ────────────────────────────────────────────────────────────────────────────

/**
 * D-16 — the three feeds become ONE flat list, deduped by `id`, with `provenance` assigned
 * from FEED ORIGIN.
 *
 * ⚠ THE DEDUPE KEY IS `id` AND MAY NEVER BE `slug`. `onTweak` deliberately mints a second
 * row carrying the SAME slug at version N+1 (`WorkflowsPage.tsx:220-248`), so a slug-keyed
 * `Map` swallows a user's own fork the instant it lands in the drafts feed beside the
 * published original — silently, and only for the users who fork, which is the worst shape
 * a bug can take.
 *
 * ⚠ THE `Map` IS A GUARD FOR A PROPERTY IT DOES NOT CURRENTLY NEED. The feeds cannot
 * collide today, and the reason is a QUERY PARAMETER rather than a schema constraint: the
 * page passes `?scope=mine`, `/starters` requires `is_system_global = true`, and
 * `create_workflow_definition` binds that column to the literal `false`
 * (`db/workflows.py:477-478`) so no app path can ever produce a user-owned global row. Drop
 * `?scope=mine` in a later phase and the two feeds overlap on every starter. The `Map` is
 * what turns an invariant held by a call site into one held by code.
 */
export function mergeLibrary(
  published: readonly PublishedWorkflow[],
  starters: readonly PublishedWorkflow[],
  drafts: readonly WorkflowDraftRow[],
): LibraryRow[] {
  const byId = new Map<string, LibraryRow>()
  // Order decides only WHICH duplicate wins, and the later write wins: a row the caller
  // owns should read as theirs rather than as a shared starter.
  for (const row of starters) byId.set(row.id, fromPublished(row, "starter"))
  for (const row of published) byId.set(row.id, fromPublished(row, "published"))
  for (const row of drafts) byId.set(row.id, fromDraft(row))
  return [...byId.values()]
}

// ── the six chips ────────────────────────────────────────────────────────────────────

/**
 * The six D-03 predicates, in one `as const satisfies Record<ChipId, …>` table
 * (`deriveTier.ts:57-79`'s idiom) — a seventh chip added to `ChipId` without a predicate
 * here is a typecheck error rather than a chip that silently counts nothing.
 */
export const CHIP_PREDICATES = {
  /** Runnable now — the published feed and the shared starters both launch. */
  "ready-to-run": (row: LibraryRow) =>
    row.provenance === "published" || row.provenance === "starter",
  /**
   * D-04's degraded-state rule, and it is a CORRECTNESS rule rather than a courtesy: read
   * the wire bit when it is there, and when it is absent fall back to feed origin. A
   * frontend deployed ahead of its backend is then RIGHT, not merely non-fatal. Treating
   * `undefined` as `false` renders an empty *Yours* chip on a stale deploy — the failure
   * shape that looks like lost data.
   */
  yours: (row: LibraryRow) => row.isMine ?? row.provenance !== "starter",
  "still-building": (row: LibraryRow) => row.provenance === "draft",
  starters: (row: LibraryRow) => row.provenance === "starter",
  /** Derived, never re-implemented — see the header's "derive, do not re-implement". */
  "makes-a-file": (row: LibraryRow) => soulDeliverable(row.def).kind === "file",
  /** Same rule, and the one where a hand-rolled check is measurably wrong (WR-03). */
  strict: (row: LibraryRow) => tierForDefinition(row.def).id === TIERS.STRICT.id,
} as const satisfies Record<ChipId, (row: LibraryRow) => boolean>

// ── search (D-07 scope, D-08 word class) ─────────────────────────────────────────────

/**
 * SUBSTRING, case-insensitive, over the workflow NAME and the `business_requirement`
 * purpose sentence — and over nothing else (D-07). A blank query passes everything
 * through, matching the shipped `matchesTitle` convention (`threadGroups.tsx:74-77`).
 *
 * ⚠ There is no stemming here, no token expansion, no fuzzy distance and no ranking, and
 * that is the SHIPPED CAPABILITY rather than a shortcut taken under time pressure (D-08).
 * The paraphrase *"the thing that checks vendors"* returns zero rows, the placeholder says
 * what the field does in plain words, and a later phase that wants more is a different
 * engine and its own decision — never a quiet upgrade to this line.
 *
 * The purpose sentence is user-authored text on a rendering path. Nothing here escapes or
 * renders it: highlighting is `HighlightTitle`'s job (`threadGroups.tsx:137`), which emits
 * JSX text nodes and carries the T-156-01 control. Re-implementing that is the threat.
 */
export function matchesQuery(row: LibraryRow, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  if (row.name.toLowerCase().includes(needle)) return true
  const purpose = row.def?.business_requirement
  return typeof purpose === "string" && purpose.toLowerCase().includes(needle)
}

// ── the project filter (D-05 instrument, D-17 semantics) ─────────────────────────────

/**
 * D-17 — THE PROJECT FILTER, WITH STARTERS HELD OUT OF IT BY CONSTRUCTION.
 *
 * Three rules, one per provenance, and they differ because the data differs:
 *
 *  • **starter — always visible.** The three seeded starters carry no `project_folder_id`
 *    at all (`094_starter_workflows.sql`, measured: zero occurrences), and `/starters`
 *    takes no project parameter. Narrowing them client-side would make every starter
 *    VANISH the moment any project is picked; leaving them in silently would read as a
 *    filter that does not work. So they stay, and the toolbar SAYS they stay
 *    (`PROJECT_STARTERS_NOTE`) — a property of the data, stated, rather than a gap hidden.
 *  • **published — the server already narrowed it** (`?project_folder_id=`, D-05), so this
 *    function passes it through. The ONE case the server cannot express is "no project",
 *    which is why `UNBOUND` is narrowed here exactly as the shipped page narrows it
 *    (`WorkflowsPage.tsx:172-173`).
 *  • **draft — narrowed here**, on `definition.project_folder_id`. `/drafts` takes no
 *    project parameter either, but drafts genuinely carry the binding, so client-side is
 *    free and matches what a person expects.
 */
export function matchesProject(row: LibraryRow, projectId: string | null): boolean {
  if (projectId === null) return true // "All projects"
  const bound = row.def?.project_folder_id
  switch (row.provenance) {
    case "starter":
      return true
    case "published":
      return projectId === UNBOUND ? !bound : true
    case "draft":
      return projectId === UNBOUND ? !bound : bound === projectId
    default: {
      // Exhaustiveness guard — a fourth feed must decide its own project semantics here.
      // At RUNTIME an unknown provenance (a future feed, a malformed row) must not drop a
      // row out of the library silently, so the safe answer is to keep it visible.
      const _never: never = row.provenance
      void _never
      return true
    }
  }
}

// ── the narrowed list, and the numbers the chips promise ─────────────────────────────

/**
 * The rows the list renders, under the whole selection.
 *
 * ⚠ THE CHIPS COMBINE AS A UNION, NOT AN INTERSECTION, and the reason is D-03's own
 * promise rather than taste. *Ready to run* and *Still building* are DISJOINT by
 * construction, so under an intersection a person who clicks both gets an empty list that
 * both chips had just promised was full — which is exactly "a chip promising results it
 * cannot deliver". Under a union, selecting one chip yields precisely the number that chip
 * shows, and selecting more can only ever yield more.
 */
export function filterLibrary(rows: readonly LibraryRow[], selection: LibrarySelection): LibraryRow[] {
  const { query, chips, projectId } = selection
  return rows.filter(
    (row) =>
      matchesProject(row, projectId) &&
      matchesQuery(row, query) &&
      (chips.length === 0 || chips.some((chip) => CHIP_PREDICATES[chip](row))),
  )
}

/**
 * Each chip's honest number: how many rows that chip WOULD render, under the live search
 * and the live project selection.
 *
 * The invariant this exists to keep (D-03, and D-17's companion rule): a count always
 * describes rows the caller can actually reach. `chipCounts` therefore takes the SAME rows
 * the list is rendering from and the SAME query and project — it never sees a pending
 * fetch. While a project re-query is in flight the caller keeps passing the
 * previously-committed rows, so the numbers stay true for what is on screen under a quiet
 * "updating…" marker; they are never zeroed during a load, and never pre-computed for rows
 * that have not arrived.
 *
 * Note it does NOT take `chips`: the number a chip shows is the number clicking IT gives
 * you, which is what makes `chipCounts(rows, q, p)[c] === filterLibrary(rows, {query: q,
 * chips: [c], projectId: p}).length` hold identically — the mechanical form of the promise.
 */
export function chipCounts(
  rows: readonly LibraryRow[],
  query: string,
  projectId: string | null,
): Record<ChipId, number> {
  const visible = rows.filter((row) => matchesProject(row, projectId) && matchesQuery(row, query))
  const counts = {} as Record<ChipId, number>
  for (const chip of Object.keys(CHIP_PREDICATES) as ChipId[]) {
    counts[chip] = visible.filter((row) => CHIP_PREDICATES[chip](row)).length
  }
  return counts
}

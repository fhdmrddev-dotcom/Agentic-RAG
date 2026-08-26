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
 * WR-01 (2026-08-18) — THE ONE DISPLAY-NAME RULE FOR THE LIBRARY.
 *
 * A workflow's name is what a person scans the library by; when it is missing the slug is
 * the honest stand-in, because it is the identity the rest of the product already uses.
 * Both constructors below route through this, so the two wire shapes cannot drift into two
 * different answers to one question.
 *
 * ⚠ WHY `??` WAS NOT ENOUGH, and it is a regression Phase 197 introduced rather than an
 * old oversight. `??` answers only for `null`/`undefined`. `197-05` shipped `setName`, the
 * FIRST path by which a workflow's name can be EMPTIED, and an empty string sailed through
 * to a card that renders the name with no fallback of its own — a blank title with nothing
 * to click toward. `fromPublished` was worse: it read the field raw and had no fallback at
 * all, so the same blank arrived by a second route.
 *
 * ⚠ THE JUSTIFICATION FOR ACCEPTING `""` AT THE WRITE PATH IS MEASURED FALSE, and this is
 * a DISPLAY fallback precisely because of it. Those docblocks say *the server owns
 * emptiness*; the server's rule is `business_requirement_missing`, which is about a
 * different field. NOTHING refuses an empty workflow name — `db/workflows.py:764` writes it
 * through with `SET name = $3`. A client-side trim here would be the second copy of a rule
 * that has no first copy, so the author's stored value stays theirs and only the DISPLAY
 * falls back.
 *
 * Whitespace-only counts as absent: the rule is about what the reader SEES, and three
 * spaces render as nothing at all.
 */
export function libraryDisplayName(name: string | null | undefined, slug: string): string {
  return typeof name === "string" && name.trim() !== "" ? name : slug
}

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
    name: libraryDisplayName(row.name, row.slug),
    version: typeof def?.version === "number" ? def.version : undefined,
    def,
    provenance,
    // Only ever what the wire said. `undefined` is "the backend did not tell us", which
    // the *Yours* predicate reads as the feed-derived fallback — never as `false`.
    isMine: row.is_mine,
    // D-15. Same rule, one field over: only ever what the wire said. `?? undefined`
    // collapses the wire's `null` and its absence into ONE value, so a consumer has a single
    // "nothing to render" case instead of two — and neither becomes a fabricated time.
    updatedAt: row.updated_at ?? undefined,
    // LIB-06 / D-08 — ⚠ VERBATIM, AND THE ABSENT `?? undefined` IS THE WHOLE POINT. The line
    // directly above collapses `null` into `undefined` on purpose; doing the same here would
    // erase the difference between "the backend says there is no run" (`null`) and "the backend
    // never mentioned runs at all" (`undefined`), and the second one rendered as the first is
    // the product asserting *never run* about a workflow that may have run a hundred times.
    // `runFacts.ts` is the one module that reads the difference; this line's job is to preserve
    // it. Both fields pass through untouched — no default, no coalesce, no normalization.
    lastRunAt: row.last_run_at,
    lastRunStatus: row.last_run_status,
    // Phase 204.1 (SCHED-01 follow-up) — the active-schedule facts, on the SAME verbatim
    // rule as the two lines above: passed through with NO default and NO coalesce. An
    // absence here is a real answer ("nothing is scheduled"), and manufacturing one would be
    // the CR-01 shape a third time. ⚠ `fromDraft` below does NOT get these — a draft cannot
    // hold a schedule, so the field would be permanently null rather than merely empty.
    nextScheduleAt: row.next_schedule_at,
    nextScheduleCron: row.next_schedule_cron,
    nextScheduleIntervalSeconds: row.next_schedule_interval_seconds,
    nextScheduleTimezone: row.next_schedule_timezone,
    nextScheduleCount: row.next_schedule_count,
    // 192.2-10 (LIB-06 / CR-01 / DEC-10-A) — the ROW-LEVEL run bit, on the SAME verbatim rule
    // as the two lines above; the paragraph there is the argument and is deliberately not
    // written a third time. ⚠ NO `??`, NO `Boolean(...)`, NO DEFAULT: a `?? false` here would
    // manufacture the affirmative claim *nobody has run this* out of an absence, which is the
    // CR-01 defect this field exists to FIX, reproduced one layer down.
    hasAnyRun: row.has_any_run,
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
    name: libraryDisplayName(row.name, row.slug),
    version: row.version,
    def: defOf(row.definition),
    provenance: "draft",
    isMine: undefined,
    // D-15 / ⚠ D-16 — `row.updated_at`, NEVER `row.token`. The server renders both from the
    // same column, so `row.token` would look like it works and would even read correctly in
    // a fixture. It is forbidden: the token is opaque by contract, Postgres keeps
    // microseconds where a JS `Date` keeps milliseconds, and anything that parses it
    // produces a value matching ZERO rows. This line reads the display field.
    updatedAt: row.updated_at ?? undefined,
    // LIB-06 / D-08 — verbatim, for the reason spelled out in `fromPublished` above: the two
    // absences are different facts and this normalizer is where they would be lost.
    //
    // ⚠ A DRAFT'S RUN IS ITS GOLDEN RUN. A draft cannot be Run from the library — publish is
    // the test — so these two fields answer *"did your test run pass?"*, which on a shelf that
    // is 69% drafts is the most useful thing the row can say.
    lastRunAt: row.last_run_at,
    lastRunStatus: row.last_run_status,
    // 192.2-10 (LIB-06 / CR-01 / DEC-10-A) — verbatim, for the reason spelled out in
    // `fromPublished` above. ⚠ The drafts feed is `created_by = $1`, so this bit and the two
    // scoped fields normally AGREE here — which is exactly why it must not be defaulted:
    // agreement is a property of this feed, not of the pair.
    hasAnyRun: row.has_any_run,
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
  const needle = needleOf(query)
  if (!needle) return true
  return carries(row.name, needle) || carries(row.def?.business_requirement, needle)
}

/**
 * The ONE normalization of a typed query, and the ONE containment test — extracted by
 * 192.2-09 so `matchesQuery` above and `matchReasons` below cannot answer *did this match*
 * two different ways.
 *
 * ⚠ A SECOND `.trim().toLowerCase()` WOULD BE A SECOND ANSWER TO ONE QUESTION, which is this
 * module's own stated rule and the exact drift `soulData.ts` exists to forbid. The reason a
 * row gives for matching has to be computed by the code that did the matching, or the card
 * can claim a reason the filter did not use (T-192.2-41).
 *
 * `carries` takes `unknown` because `business_requirement` is user-authored JSONB and may be
 * absent or not a string at all; the type guard IS the rule, not a defensive extra.
 */
const needleOf = (query: string): string => query.trim().toLowerCase()
const carries = (value: unknown, needle: string): boolean =>
  typeof value === "string" && value.toLowerCase().includes(needle)

// ── why THIS row is in the filtered set (192.2-09 / WR-04) ───────────────────────────

/**
 * THE THREE FACTS A FILTERED ROW CANNOT OTHERWISE SHOW — a closed union, and closed is the
 * point.
 *
 * D-03 cut six atoms from the resting card. Three of the six ways into the list still select
 * on facts that left with them: `"makes-a-file"` selects on the deliverable atom, `strict` on
 * the tier chip, and the search reaches inside the purpose sentence whose hero is gone. Those
 * three, and nothing else, are what this union names.
 *
 * ⚠ THE OTHER FOUR CHIPS EMIT NOTHING, AND THAT IS A DECISION RATHER THAN AN OMISSION.
 * `ready-to-run`, `yours`, `still-building` and `starters` each already have a visible carrier
 * on line 2 or in the identity line, so a reason for them would repeat what the card already
 * says — the noise D-03 exists to remove. Adding a fourth member here is a decision taken in
 * CONTEXT, not a tidy-up; the `satisfies Record<MatchReason, …>` table in
 * `libraryVocabulary.ts` makes forgetting its word a typecheck error.
 */
export type MatchReason = "makes-a-file" | "strict" | "purpose"

/**
 * The chip reasons, in `CHIP_ORDER`'s order so two reasons never render in two orders.
 *
 * ⚠ SPELLED HERE RATHER THAN DERIVED FROM `CHIP_ORDER`, which lives in `libraryVocabulary.ts`
 * — importing it would make this module depend on the WORDS at runtime, and this module has
 * deliberately held no user-facing string since it was written. The `satisfies` clause is what
 * keeps the two honest: every member must be BOTH a `ChipId` and a `MatchReason`, so a rename
 * on either side is a typecheck error rather than a silently-dropped reason.
 */
const CHIP_REASONS = ["makes-a-file", "strict"] as const satisfies readonly (ChipId & MatchReason)[]

/**
 * WHY IS THIS ROW HERE? — the reasons, as ids, for one row under one selection.
 *
 * ⚠ IT DERIVES; IT NEVER RE-IMPLEMENTS. The chip reasons call `CHIP_PREDICATES` — the very
 * functions that did the selecting — and the purpose reason uses the same `needleOf` /
 * `carries` pair `matchesQuery` uses. A hand-rolled copy of either would let the card state a
 * reason the filter did not act on, which is a claim the surface cannot back (T-192.2-41), and
 * the `strict` case is the one where a hand-rolled check is MEASURABLY wrong (WR-03).
 *
 * ⚠ THE NAME CLAUSE IN RULE 3 IS LOAD-BEARING. When the needle is in the row's NAME,
 * `HighlightTitle` has already shown the person why the row matched; saying it again in words
 * underneath is exactly the duplication D-03 removed. So the purpose reason fires only when
 * the name did NOT carry the needle.
 *
 * ⚠ AN EMPTY SELECTION RETURNS AN EMPTY ARRAY, AND THE RESTING CARD DEPENDS ON IT. No chip
 * pressed and a blank query means no reason, which is what makes the card's reason line
 * structurally unable to appear at rest — the mechanical half of DEC-09-A's argument.
 *
 * A pure leaf: no React, no DOM, no store, no `@/lib/api`. It returns IDS, never rendered
 * strings — the words are the card's to look up, the same DECISION-here / VOCABULARY-there
 * split `cardFace.ts` and `runFacts.ts` already made.
 */
export function matchReasons(row: LibraryRow, selection: LibrarySelection): readonly MatchReason[] {
  const reasons: MatchReason[] = []

  for (const chip of CHIP_REASONS) {
    if (selection.chips.includes(chip) && CHIP_PREDICATES[chip](row)) reasons.push(chip)
  }

  const needle = needleOf(selection.query)
  if (needle && !carries(row.name, needle) && carries(row.def?.business_requirement, needle)) {
    reasons.push("purpose")
  }

  return reasons
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

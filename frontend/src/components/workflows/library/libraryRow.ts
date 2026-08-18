/**
 * Phase 192-05 Task 1 (LIB-01 / D-12 / D-16) — the library row contract.
 *
 * THE NORMALIZED SHAPE THE WHOLE LIBRARY SURFACE READS, AND NOTHING ELSE. Three feeds
 * arrive as two different wire types (`PublishedWorkflow` from `/workflows/published` and
 * `/workflows/starters`, `WorkflowDraftRow` from `/workflows/drafts`); every module under
 * `library/` reads THIS type instead, so the toolbar, the chips, the card and the filter
 * cannot each invent their own view of a row.
 *
 * A LEAF, AND A TYPES-ONLY ONE. It emits no runtime code whatsoever — three exported type
 * names, two type-only imports, zero values — so nothing in it can be called, mutated or
 * hot-reloaded, and it cannot participate in a value-level module cycle at all. The
 * directory's precedent for this shape is `phaseNodeCardContract.ts:18-20`; the house
 * ORDERING it copies is `deriveTier.ts:24-50` (exported aliases first, then the exported
 * interface, one docblock per member).
 *
 * ⚠ WHY `source` EXISTS, AND WHY IT IS THE WHOLE ORIGINAL OBJECT. The handlers this row
 * feeds need fields the normalized view does not carry: `onOpenDraft` needs the draft's
 * opaque `token` (`api.ts:3345` — echo it VERBATIM or every later save refuses as stale),
 * and `onLaunch` needs the real `PublishedWorkflow`. A hand-rebuilt object that forgets one
 * of them is the D-186-07 SILENT CLOBBER — a behaviour bug that typechecks, which is why
 * `WorkflowBuilderPage.session.test.tsx:750` exists at all. Carrying the original whole is
 * the only shape in which that mistake is unavailable.
 */
import type { PublishedWorkflow, WorkflowDraftRow } from "@/lib/api"
import type { DefShape } from "@/components/workflows/soulData"

/**
 * Which feed a row came from (D-12). Assigned from FEED ORIGIN at merge time, never
 * re-derived per consumer: it is what the fork branch reads to pick between the two
 * handlers, which are SIBLINGS and not twins — `onTweak` mints the same slug at version
 * N+1, `onUseStarter` mints a fresh suffixed slug at version 1, because
 * `UNIQUE(slug, version)` is GLOBAL across all users. A row whose provenance was guessed
 * is a row whose fork can collide.
 */
export type Provenance = "starter" | "published" | "draft"

/**
 * The six D-03 chips. A closed union so the predicate table, the count table and the word
 * table are all exhaustive against it — a seventh chip is then a typecheck error rather
 * than a silently missing count.
 */
export type ChipId =
  | "ready-to-run"
  | "yours"
  | "still-building"
  | "starters"
  | "makes-a-file"
  | "strict"

/** One row of the merged library list. */
export interface LibraryRow {
  /**
   * The UUID primary key — and THE DEDUPE KEY (D-16). Never `slug`: `onTweak`
   * deliberately mints a second row carrying the SAME slug, so a slug-keyed dedupe
   * swallows a user's own fork the instant it appears in the drafts feed beside the
   * published original it forked from.
   */
  id: string
  /** The workflow slug. Shared across versions by design; see `id` above. */
  slug: string
  /**
   * The display name. A draft's wire `name` is nullable, so it falls back to the slug —
   * mirroring what the shipped draft card already renders (`WorkflowsPage.tsx:706`).
   */
  name: string
  /**
   * The version number, from two different places: a published row reads
   * `definition.version` (`WorkflowsPage.tsx:762` — `PublishedWorkflow` carries no
   * version of its own), a draft reads the row's own `version` column. `undefined` when
   * the definition is absent or carries no numeric version — never faked to 1.
   */
  version: number | undefined
  /**
   * The definition JSONB, read-shaped. The source of the *Makes a file* and *Strict*
   * chips via `soulDeliverable` / `tierForDefinition`, and of a draft's project binding.
   * `undefined` rather than `null` so the two shipped helpers' `null | undefined`
   * signatures take it without a cast at every call site.
   */
  def: DefShape | undefined
  /** Which feed this row came from — see `Provenance`. */
  provenance: Provenance
  /**
   * The D-04 ownership bit, LIFTED OUT of `source` so the *Yours* predicate needs no
   * type narrow. `undefined` means the wire did not say — a frontend deployed ahead of
   * its backend — and the honest reading of that is the feed-derived fallback
   * (`provenance !== "starter"`), NEVER `false`, which would render an empty *Yours*
   * chip on a stale deploy. Drafts carry `undefined` here on purpose: the field only
   * ever holds what the wire said, and `/workflows/drafts` is already scoped to
   * `created_by = $1`, so the fallback answers correctly without this row asserting a
   * fact no payload contained.
   */
  isMine: boolean | undefined
  /**
   * Phase 192.1 (LIB-05 / D-15) — WHEN THIS ROW LAST CHANGED, ISO-8601, exactly the string
   * the server rendered. The recency half of the identity line ("changed 2 months ago").
   *
   * camelCase because that is this type's habit: it already renames `is_mine` → `isMine`.
   * The wire spelling is `updated_at`; the normalized spelling is this one, and the two
   * normalizers are the only place they meet.
   *
   * `undefined` MEANS THE WIRE DID NOT SAY — a frontend deployed ahead of its backend, or a
   * row whose column was NULL — AND THE HONEST READING OF THAT IS TO RENDER NO `changed`
   * SEGMENT AT ALL. Never substitute `Date.now()`, never fall back to "just now", and never
   * treat it as the epoch: each of those prints a specific claim about a row nobody made.
   * This is the same rule `isMine` above states for its own `undefined`, for the same
   * reason — a field that only ever holds what the wire said cannot lie.
   *
   * ⚠ FOR A DRAFT ROW, THIS IS **NOT** `source.token`, EVEN THOUGH THE SERVER RENDERS BOTH
   * FROM ONE COLUMN. `token` is opaque by contract (`api.ts` — parsing it truncates the
   * microseconds and makes every later save refuse as stale). `fromDraft` reads
   * `row.updated_at` and must never read `row.token` (D-16).
   */
  updatedAt: string | undefined
  /**
   * Phase 192.2 (LIB-06 / D-07 / D-08) — WHEN THIS ROW LAST RAN, ISO-8601, exactly the string
   * the server rendered. The recency half of the run truth ("Worked 2 days ago").
   *
   * camelCase for the reason `updatedAt` above states: the wire spelling is `last_run_at`, the
   * normalized spelling is this one, and the two normalizers in `libraryFilter.ts` are the only
   * place they meet.
   *
   * ⚠ THREE STATES, AND THE THIRD IS WHY THIS MEMBER IS NOT `string | undefined` LIKE ITS
   * NEIGHBOUR. `updatedAt` deliberately collapses the wire's `null` into `undefined` — one
   * "nothing to render" case is enough there. HERE THAT COLLAPSE WOULD BE THE DEFECT D-08
   * NAMES BY NAME:
   *
   *   · `undefined` — THE WIRE DID NOT SAY. The key was absent from the payload, i.e. a
   *     frontend deployed ahead of its backend. We do not know whether this ever ran.
   *   · `null`      — THE BACKEND LOOKED AND THERE IS NO RUN. A different, stronger fact.
   *   · a string    — it ran, at that instant.
   *
   * Folding the first two together makes the product assert *"this has never run"* about a
   * workflow that may have run a hundred times. So this field carries the wire's own value
   * VERBATIM, and `runFacts.ts` is the one module that reads the difference.
   *
   * Never substitute `Date.now()`, never fall back to "just now", never treat it as the epoch —
   * the rule `updatedAt` states above, for the same reason.
   *
   * ⚠ AND IT IS NOT `updatedAt`. On a published row that field is the PUBLISH time and is
   * frozen there by design (`api.ts`, D-17). They disagree on real data. Do not read one for
   * the other and do not "fix" either.
   */
  lastRunAt: string | null | undefined
  /**
   * Phase 192.2 (LIB-06 / D-08) — the RAW status of that run, exactly as `workflow_runs.status`
   * spells it (`active` · `paused` · `cap_paused` · `completed` · `failed` · `cancelled` today,
   * and the column can gain a terminal state without this file changing).
   *
   * Deliberately NOT a union and deliberately NOT a business word. `runFacts.ts` owns the
   * mapping and the vocabulary; this member is the unread wire value, so that a status nobody
   * anticipated arrives intact and is resolved to an explicit unknown rather than being lost on
   * the way in. Same three states as `lastRunAt` above, for the same reason.
   */
  lastRunStatus: string | null | undefined
  /**
   * THE ORIGINAL WIRE OBJECT, KEPT WHOLE. See the ⚠ paragraph in this file's header —
   * `token` and the real `PublishedWorkflow` reach their handlers through here, and a
   * rebuilt object that drops one of them fails at runtime while typechecking clean.
   */
  source: PublishedWorkflow | WorkflowDraftRow
}

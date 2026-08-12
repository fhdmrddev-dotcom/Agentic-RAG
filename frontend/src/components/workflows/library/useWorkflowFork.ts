/**
 * Phase 192.1-03 Task 2 (LIB-05 — D-01 / D-22 / D-23 / D-24 / D-29, threats T-192.1-03 /
 * T-192.1-04 / T-192.1-06) — THE FORK CONCERN, LIFTED OFF `WorkflowsPage.tsx` UNDER G-5.
 *
 * `CLAUDE.md`'s hot-file ledger row for that page (30 commits / 11 phases / 1180 L) named this
 * seam and named its trigger, in the same sentence:
 *
 *   > "the next phase that adds a genuinely SECOND concern here still owes a refactor
 *   >  recommendation FIRST, and the natural next seam is named — **the two fork/create
 *   >  handlers with their slug/version mechanics** are now the largest self-contained concern
 *   >  left on the page, and **WR-08 … is the trigger that will force someone into them**."
 *
 * 162-B puts a modal, a name field, a pre-flight collision check and new state between the
 * fork click and the POST. That is the second concern arriving on exactly the named seam, so
 * the recommendation was produced as the first option and TAKEN — before the dialog is built,
 * not after (D-01).
 *
 * ── WHAT THIS HOOK OWNS, AND WHAT IT DELIBERATELY DOES NOT ──────────────────────────────
 *
 * OWNS: the `forkFailed` notice state, the by-slug draft index, both fork handlers, and the
 * two `LibraryRow →` wire adapters that feed them (D-29 — an adapter whose only job is to
 * cast an argument for a handler is part of that handler's concern; splitting them leaves
 * half a concern behind on a file G-5 has already fired on).
 *
 * DOES NOT OWN — and each exclusion is a measurement rather than a taste:
 *
 *  - **`refetchDrafts` is passed IN, never moved.** It is a `useCallback` on the page owning
 *    `draftsSeqRef` (a latest-wins ticket), `setDrafts` and `markSource("draft", …)` — the
 *    FETCH-ORCHESTRATION concern, which the ledger row lists as still living on the page.
 *
 *  - **`onOpenDraft` is passed IN, never moved (D-01).** It is the drafts-NAVIGATION concern,
 *    and 192-14 already recorded why its declaration order on the page is load-bearing.
 *
 *  - **`setBuilderInitial` and `setPageView` NEVER reach this file.** They are the page's
 *    Builder host. Both handlers hand a seed back through ONE `onForked` callback instead,
 *    and the reason is recorded in the shipped source this code came from
 *    (`WorkflowsPage.tsx:576-578`): 192-14 reused `onOpenDraft` inside `onTweak` *"rather than
 *    a third `setBuilderInitial` call site"*, because that **threads 186-07's opaque
 *    concurrency token by construction instead of by remembering to — a dropped token is a
 *    silent-clobber bug that typechecks.** One callback preserves that property; taking the
 *    setter directly would re-open two call sites for a future author to forget one of.
 *
 * ── F4 / S-4, AND THE NEAR-MISS THE FENCE DOES NOT COVER ────────────────────────────────
 *
 * No module under `library/` may name a `WorkflowsPage` specifier in any import form (fence
 * F4 — an import back typechecks clean, lints clean, and fails only at runtime as a TDZ
 * cycle). ⚠ **F4's regex does NOT match `WorkflowBuilderPage`** — "WorkflowsPage" is not a
 * substring of it — so importing the page's `BuilderInitial` type would pass every fence while
 * building exactly the coupling F4 exists to prevent. `ForkSeed` is therefore declared LOCALLY
 * and is structurally what the page's Builder state accepts; the page adapts it in `onForked`.
 * That is a judgement constraint, held on purpose, not a fenced one.
 *
 * ── THE SHIPPED ANALOG FOR THE POSTURE ──────────────────────────────────────────────────
 *
 * `frontend/src/hooks/useDraftPersistence.ts:472` — one args object IN, a CALLBACK out, so the
 * caller keeps ownership of what happens next. Same shape here.
 *
 * ── ⚠ THE SUBTREE DELTA, MEASURED IN 192.1-03 — AND THE "BEFORE" HAD TO BE RE-MEASURED ───
 *
 * Recorded HERE as well as in the SUMMARY, for 188.2's and 192-12's stated reason: a later
 * reader must not be able to mistake this growth for a regression, and the figure has to live
 * where the growth is. Same named line classifier (blank / comment / code, every line exactly
 * one of the three, JSX comment blocks counted as comment), and it was RE-VALIDATED before any
 * figure below was trusted — run against 188.2's published known-good, the pre-cut
 * `PhaseNodeCard.tsx` at `95a4c915`, it reproduced `797 / 518 / 249 / 30` exactly.
 *
 *   PAGE      `WorkflowsPage.tsx`  1180 → 1054  (−10.7 %)   CODE 518 → 440  (−15.1 %)
 *   SUBTREE   page + these 9 modules  3469 → **3781  (+9.0 %)**   CODE 1550 → 1592  (+2.7 %)
 *
 * ⚠ **THE "BEFORE" IS 3469, NOT the 3438 `192.1-BASELINE.md` §8b publishes, and the difference
 * is not an error in either number.** The baseline was measured at `8fc9bd74`, and Wave 1
 * (`192.1-01`) then added `updatedAt` to `libraryFilter.ts` (+10 L) and `libraryRow.ts` (+21 L)
 * — so the artifact's subtree figure was already stale by +31 at the commit this cut started
 * from. Re-measured at this plan's own base `d991a68c` rather than inherited, which is the
 * habit the CLAUDE.md ledger rows keep for exactly this reason: **a figure written at a
 * phase's close goes stale on the next commit that touches any file it counted.** Against the
 * artifact's 3438 the growth reads +10.0 %; against the honest base it is +9.0 %. Both are
 * printed so neither can be quoted as the other.
 *
 * ⚠ **THIS IS AN ORDER OF MAGNITUDE SMALLER THAN THE TWO PRIOR CUTS, and the reason is
 * structural rather than virtuous.** 188.2 measured **+67.1 %** and Phase 192 **+126.2 %**;
 * both REWROTE while they moved (192 replaced three card components with one and added a
 * filter engine, a vocabulary module and a merge that did not exist). This is a MOVE of ONE
 * self-contained concern into TWO modules, and almost every line landed where it already was.
 *
 * WHERE THE GROWTH WENT, so the number is attributable rather than merely admitted:
 * **COMMENT is again the dominant term — 1753 → 2014 (+261 L), which is 84 % of the +312.**
 * CODE grew just +42 (1550 → 1592): the two new modules carry 120 code lines against the 78
 * the page shed, and the difference is the two exported interfaces, the import block, the hook
 * wrapper and the page's one `onForked` callback — the irreducible cost of a seam.
 *
 * ⚠ AND THE PAGE FELL BY LESS THAN THE ~225 LINES THAT MOVED (126, not 225), WHICH IS STATED
 * RATHER THAN SMOOTHED: the cut left ~50 lines of RECEIPT prose at each site it emptied, in
 * this page's own recorded habit (`WorkflowsPage.tsx:1160` is 192's). A receipt is not free,
 * and pretending the delta is the span is how the next estimate goes wrong.
 * Re-derive: `wc -l` on the page and on this directory's nine SOURCE modules (test files
 * excluded, as 188.2 and 192 both excluded them); `git show d991a68c:<path> | wc -l` for the
 * before column. ⚠ THE FIGURES INCLUDE THIS DOCBLOCK — measured, written, then RE-measured,
 * and only the digits were corrected so the line count could not move again.
 */
import { useCallback, useMemo, useState } from "react"
import {
  createWorkflowDraft,
  type PublishedWorkflow,
  type WorkflowDefinitionJSON,
  type WorkflowDraftRow,
} from "@/lib/api"
import { CHIP_PREDICATES } from "./libraryFilter"
import { freshHash, isForkConflict } from "./libraryFork"
import type { LibraryRow } from "./libraryRow"

/**
 * What a successful fork hands back to the Builder host.
 *
 * ⚠ DECLARED HERE RATHER THAN IMPORTED, and the reason is the F4 near-miss above: the page's
 * `BuilderInitial` lives in `@/pages/WorkflowBuilderPage`, which no fence in this subtree
 * catches. The shape is what the page's `builderInitial` state accepts; `token` is `string`
 * (not `string | null`) because BOTH fork paths reach here only through a `createWorkflowDraft`
 * response, and `WorkflowDraftWriteResult.token` is non-nullable. A route that has not created
 * a row has no seed to hand back at all.
 */
export interface ForkSeed {
  definition: WorkflowDefinitionJSON
  draftId: string
  label: string
  token: string
}

/**
 * 192.1-07 (D-19 / D-23) — A FORK THAT HAS BEEN ASKED FOR BUT NOT YET NAMED.
 *
 * `kind` is what keeps D-12's never-merged rule intact through the prompt: ONE dialog serves
 * both fork paths (the user's intent is identical and the card spends one word on it), but the
 * two CREATE paths behind it stay siblings — same slug at v(N+1) versus a fresh auto-suffixed
 * slug at v1. Losing this discriminator is how the two handlers get merged by accident, which
 * breaks the GLOBAL `UNIQUE(slug, version)` constraint the moment two people fork one starter.
 *
 * ⚠ NOTHING IS WRITTEN WHILE THIS IS SET. It is the state between the click and the POST, and
 * the whole point of D-19 is that the person, not the system, supplies what goes in the gap.
 */
export interface PendingFork {
  row: LibraryRow
  kind: "version" | "starter"
}

export interface WorkflowForkArgs {
  /** The drafts feed, server-scoped to `created_by = caller`. Feeds `draftBySlug`. */
  drafts: WorkflowDraftRow[]
  /**
   * The MERGED library list the page already holds — D-21's pre-flight reads it and nothing
   * else, which is what makes the collision check free.
   *
   * ⚠ IT IS PASSED IN RATHER THAN REBUILT. `mergeLibrary` runs once on the page and feeds the
   * filter, the chip counts and the identity index; a second merge here would be a second
   * answer to "what is in this library", and the two would drift the first time a feed's
   * scope changed.
   */
  rows: readonly LibraryRow[]
  /** The page's fetch-orchestration concern. Passed IN — see the header. */
  refetchDrafts: () => Promise<unknown> | void
  /** The page's drafts-navigation concern. Passed IN (D-01) — see the header. */
  onOpenDraft: (draft: WorkflowDraftRow) => void
  /** The page's Builder handoff, as ONE call site. See the header for why it is a callback. */
  onForked: (seed: ForkSeed) => void
}

export interface WorkflowFork {
  /** The notice state. `null` = nothing to say. Rendered by the page's failure region. */
  forkFailed: { name: string; conflict: boolean } | null
  /** The caller's own drafts by slug, highest version wins. Also feeds `hasExistingFork`. */
  draftBySlug: Map<string, WorkflowDraftRow>
  /**
   * `WorkflowCard`'s fork verb on a PUBLISHED row — same slug at v(N+1).
   * ⚠ On a row this caller has ALREADY forked it opens that draft and creates nothing, so it
   * raises NO prompt either (D-23). See the handler.
   */
  onForkNewVersion: (row: LibraryRow) => void
  /** `WorkflowCard`'s fork verb on a STARTER row — a fresh suffixed slug at v1. */
  onForkStarter: (row: LibraryRow) => void
  /** 192.1-07 (D-19): the fork awaiting a name, or `null`. The page gates the dialog on it. */
  pendingFork: PendingFork | null
  /** The typed name, from the dialog. Runs the create path the pending fork's `kind` selects. */
  confirmFork: (name: string) => void
  /** Dismissed. Clears the pending fork and writes NOTHING. */
  cancelFork: () => void
  /** D-21's advisory pre-flight — see its declaration for what it is and is not. */
  isClash: (name: string) => boolean
}

export function useWorkflowFork(args: WorkflowForkArgs): WorkflowFork {
  const { drafts, rows, refetchDrafts, onOpenDraft, onForked } = args

  /**
   * 192-15 (WR-03) — A FORK CLICK THAT FAILED, HELD UNTIL THE NEXT FORK ATTEMPT.
   *
   * It carries a DISPLAY NAME and a BOOLEAN, deliberately, rather than the error itself: a
   * shape that cannot hold server prose, a status code or an id cannot leak one to the surface
   * (T-192-40). The raw error keeps going to `console.error` at the boundary for whoever is
   * debugging — the `WorkflowDraftUnreadableError` posture, where the developer's evidence and
   * the person's sentence are two different things and one never replaces the other.
   *
   * ⚠ 192.1-03 (T-192.1-03): THE SHAPE IS NOT WIDENED BY THE MOVE. Widening it is the whole
   * disclosure threat — it is the only path from a thrown server error to the screen.
   */
  const [forkFailed, setForkFailed] = useState<{ name: string; conflict: boolean } | null>(null)

  /**
   * 192.1-07 (D-19) — THE FORK THAT HAS BEEN ASKED FOR AND NOT YET NAMED.
   *
   * ⚠ IT IS THE ONLY NEW STATE THIS PLAN ADDS, and it holds a ROW rather than a half-built
   * definition on purpose: the slug and version mechanics stay inside the two create paths
   * where D-12 governs them, so a pending fork cannot carry a slug that was computed before
   * the person finished typing.
   */
  const [pendingFork, setPendingFork] = useState<PendingFork | null>(null)

  /**
   * 192-14 (the U5 blocker) — THE DRAFTS THIS CALLER ALREADY OWNS, BY SLUG.
   *
   * Built from the `drafts` feed, which `GET /workflows/drafts` scopes server-side to
   * `created_by = caller`. A slug match here can therefore only ever resolve to a row this
   * person already owns — the lookup widens no scope and reaches no new endpoint.
   *
   * ⚠ THE HIGHEST VERSION WINS, and the rule is stated because "the draft for this slug" is
   * genuinely ambiguous: measured in the live DB on 2026-08-11, `pm-weekly-status-report`
   * carries `1:published, 2:draft, 3:published, 4:draft` — TWO drafts under one slug. Left to
   * insertion order the answer would be whichever the server happened to return first, which is
   * not an answer. The most recent fork is the one a person means by "my copy".
   */
  const draftBySlug = useMemo(() => {
    const bySlug = new Map<string, WorkflowDraftRow>()
    for (const d of drafts) {
      const held = bySlug.get(d.slug)
      if (!held || d.version > held.version) bySlug.set(d.slug, d)
    }
    return bySlug
  }, [drafts])

  /**
   * 192.1-07 (D-21) — THE PRE-FLIGHT COLLISION CHECK, AND WHAT IT IS NOT.
   *
   * It reads the caller's OWN rows in the merged feed and compares DISPLAY NAMES — the thing
   * the human actually sees and the thing 43-of-104 duplicates are a problem about. It is free
   * because the page already holds the list; no request is made and no scope is widened.
   *
   * ⚠ THE OWNERSHIP TEST IS THE SHIPPED PREDICATE, READ RATHER THAN RE-WRITTEN (D-09). A
   * hand-rolled `row.isMine ?? …` here would be a SECOND answer to "is this mine", and the
   * shipped one is not the obvious expression: it falls back to feed origin when the wire bit
   * is absent, precisely so a frontend deployed ahead of its backend is RIGHT rather than
   * merely non-fatal. Copying the short version is how that correctness rule gets lost.
   *
   * ⚠ IT IS ADVISORY, AND IT IS NOT A SLUG CHECK. It must never be presented as a guarantee
   * that the create will succeed: WR-08's 409 is a `UNIQUE(slug, version)` violation on SLUGS,
   * and no name field prevents it (D-22 — the residual is named at the create path below).
   */
  const isClash = useCallback(
    (name: string) => {
      const wanted = name.trim()
      if (!wanted) return false
      return rows.some((row) => CHIP_PREDICATES.yours(row) && row.name === wanted)
    },
    [rows],
  )

  // ── Tweak: fork a v(N+1) DRAFT (INSERT) — never UPDATE the frozen published row —
  //    then open the FORKED copy's existing steps in the Builder (NOT the describe
  //    screen). The new draft id is captured so every save PATCHes the fork.
  //
  //    ⚠ 192.1-07 (D-19): THE EXISTING-DRAFT BRANCH IS NO LONGER IN THIS FUNCTION — it moved
  //    UP into `onForkNewVersion`, and the move is required rather than tidy. The prompt now
  //    stands between the click and the create, and D-23 says NO PROMPT APPEARS on the
  //    already-forked path *because nothing is being named there*. Leaving the branch down
  //    here would mean opening a name dialog and then silently discarding the name — which is
  //    the U5 blocker's own shape (a click that does something other than what it said).
  //    What reaches this function is therefore only ever a real create, with a real name. ──
  const createNewVersion = useCallback(
    async (wf: PublishedWorkflow, name: string) => {
      // ── THE CREATE PATH, DELIBERATELY UNCHANGED BELOW THIS LINE ──
      // `def.version` is read off the JSONB `definition`, where it is NULL on every live row
      // (the real version is the `version` COLUMN), so `nextVersion` is effectively the
      // constant 2. That is left ALONE on purpose: `PublishedWorkflow` carries no `version`
      // on the wire (root cause C in `192-UAT.md`), so the client is not told the real one,
      // and a "smarter" guess would only make the collision RARER — which is exactly what the
      // operator's decision rejected in favour of removing the failure class.
      //
      // ⚠ THE RESIDUAL, NAMED RATHER THAN SMOOTHED. Re-measured in the live local DB on
      // 2026-08-11: 18 slugs carry more than one version, and 2 of them —
      // `meridian-risk-summary-good-07aedc33` and `readonly_refusal_098uat` — are
      // `published + published` with NO draft at all. The branch above cannot help those:
      // their fork still 409s. Plan `192-15` is what makes that refusal VISIBLE instead of
      // silent. 16 of 18 is not "the class is gone", and this comment exists so nobody reads
      // it that way. (D-22: 162-B's name field does NOT close these either — the 409 is a
      // `UNIQUE(slug, version)` violation and the pre-flight check reads display names.)
      const def = (wf.definition ?? {}) as Record<string, unknown>
      const currentVersion = typeof def.version === "number" ? (def.version as number) : 1
      const nextVersion = currentVersion + 1
      // ⚠ 192.1-07 (LIB-05) — `name` IS THE WHOLE POINT OF THE PROMPT, AND IT IS A REAL FIELD
      // RATHER THAN A CAPTION. The server reads `definition.name` and writes it to the row's
      // `name` COLUMN (`db/workflows.py:508-513`), which is what every library feed renders —
      // so the copy genuinely ARRIVES under the typed name instead of inheriting its parent's.
      // That is the 43-of-104 measurement's actual fix; a Builder caption alone would have
      // left the library exactly as unreadable as it was.
      const forked = {
        ...def,
        name,
        slug: wf.slug,
        version: nextVersion,
        status: "draft",
      } as WorkflowDefinitionJSON
      // 192-15: clear any notice from a PREVIOUS attempt before making this one. A failure
      // message left standing over a later success is its own kind of lie (T-192-43).
      setForkFailed(null)
      try {
        const created = await createWorkflowDraft(forked)
        await refetchDrafts()
        // Load the fork's existing definition into the editing view with its NEW id.
        onForked({
          definition: forked,
          draftId: created.id,
          // ⚠ 192.1-07: THE CAPTION READS THE TYPED NAME, WHERE IT USED TO READ THE SLUG. The
          // Builder header is the first thing a person sees after naming a copy; showing them
          // the parent's slug back would be the surface disagreeing with the thing they just
          // told it. The version stays — it is the one fact the name cannot carry.
          label: `Tweak · ${name} v${nextVersion}`,
          // 186-07: the create response's own token guards the fork's first PATCH.
          token: created.token,
        })
      } catch (e) {
        // 192-15 (WR-03): the log STAYS — it is the developer's evidence — and the person
        // now gets a sentence too. This is the path the 2 measured `published + published`
        // residual slugs above take, and it is the only thing standing between them and a
        // dead button, so it reports rather than swallows. Tweak has NO retry and gains none:
        // its 409 is a deterministic collision, and a second identical write would fail
        // identically while making the surface look busy.
        // ⚠ 192.1-03: THE PREFIX MOVED WITH THE CODE. It read `[WorkflowsPage]` where this
        // handler used to live; a log line that sends a debugger to the file the code LEFT is
        // the wrong-pointer failure D-37 guards against, one layer below prose. Nothing
        // asserts on it (verified: no spy on `console.error` in the fork arc), so the honest
        // pointer costs nothing. The line's PURPOSE is unchanged — the developer's raw
        // evidence, which the person's sentence never replaces.
        console.error("[useWorkflowFork] Tweak fork failed", e)
        setForkFailed({ name: wf.name, conflict: isForkConflict(e) })
      }
    },
    // ⚠ `draftBySlug` AND `onOpenDraft` ARE NO LONGER READ HERE — the existing-draft branch
    // they served moved up to `onForkNewVersion` (D-23), so listing them would be a dependency
    // on nothing. `noUnusedLocals` cannot see a stale dep array; the exhaustive-deps rule can.
    [refetchDrafts, onForked],
  )

  // ── Use this starter (WF-01, D-143-1): a FRESH-COPY fork. A sibling of onTweak
  //    with exactly two deltas — a NEW auto-suffixed slug + version:1 (NOT the
  //    same-slug Tweak's v(N+1)) — required because UNIQUE(slug, version) is GLOBAL
  //    across all users, so two forkers of ONE shared starter can't both mint
  //    <slug> v(N+1). The server (createWorkflowDraft → POST /workflows) forces
  //    is_system_global=false / status=draft / created_by=caller; the published starter row
  //    stays frozen. On a 409 slug/version collision (astronomically unlikely hash
  //    clash) retry once with a fresh hash (Pitfall 5). Lands in the Builder (D-143-1a). ──
  const createFromStarter = useCallback(
    async (starter: PublishedWorkflow, name: string) => {
      const def = (starter.definition ?? {}) as Record<string, unknown>
      // 192-15: same rule as Tweak — clear before attempting, so a stale notice can never
      // sit above a fork that has just succeeded. BEFORE the loop, not inside it: the retry
      // is one attempt from the person's point of view.
      setForkFailed(null)
      for (let attempt = 0; attempt < 2; attempt++) {
        // NOTE: `def` may carry `category:"starter"` — that is SAFE (Plan 01 added the
        // additive field to WorkflowDefinition); do NOT strip it from the fork body.
        // ⚠ 192.1-07: `name` IS THE TYPED ONE, and it is inside the retry loop with the slug
        // for a reason — the retry re-mints the SLUG, never the name. A person who typed a
        // name once has answered once.
        const forked = {
          ...def,
          name,
          slug: `${starter.slug}-${freshHash()}`,
          version: 1,
          status: "draft",
        } as WorkflowDefinitionJSON
        try {
          const created = await createWorkflowDraft(forked)
          await refetchDrafts()
          onForked({
            definition: forked,
            draftId: created.id,
            // ⚠ 192.1-07: the typed name, not the STARTER's — same reason as Tweak's caption.
            label: `From starter · ${name}`,
            // 186-07: same as Tweak — the fresh copy's create response carries it.
            token: created.token,
          })
          return
        } catch (e) {
          // Retry ONCE on a slug/version collision; any other error surfaces + stops.
          //
          // ⚠ 192-15 — THE RETRY IS UNTOUCHED. Only the classification moved into
          // `isForkConflict` (byte-identical predicate, one home instead of two). Deleting the
          // retry would have been "fixing" the silence by removing the very behaviour that
          // needed reporting, so it is pinned from the inside by a case asserting exactly TWO
          // `createWorkflowDraft` calls (T-192-42).
          //
          // ⚠ 192.1-03 (D-24 / T-192.1-04): THE LOOP IS NOT RESTRUCTURED BY THE EXTRACTION,
          // and the bound is the mitigation. `attempt < 2` with a single `continue` is what
          // makes the retry EXACTLY ONE; a "tidied" loop is how an unbounded retry gets
          // introduced under cover of a refactor. This module holds exactly TWO draft-create
          // call sites in total — one here, one in Tweak — which is T-192-42's pin re-stated
          // where the code now lives.
          // ⚠ THE CLIENT'S NAME IS DESCRIBED RATHER THAN SPELLED ON THIS LINE, deliberately:
          // the pin is a RAW SOURCE COUNT of `createWorkflow` + `Draft(`, so a comment
          // explaining the count would satisfy the very grep that proves it. That is the
          // 187-24 trap, which 192-06/08/09 each hit once and this file declines to hit again.
          if (attempt === 0 && isForkConflict(e)) continue
          // The TERMINAL branch — the one that already logged and returned. Now it also says
          // so. Both fork handlers report, because they share ONE WORD on the card face (D-12)
          // and a person cannot tell which of them they clicked; a surface that reports only
          // half its failures is not honest.
          console.error("[useWorkflowFork] starter fork failed", e)
          setForkFailed({ name: starter.name, conflict: isForkConflict(e) })
          return
        }
      }
    },
    [refetchDrafts, onForked],
  )

  // ── 192-10 (D-09 / D-12) → 192.1-03 (D-29 / D-37) — THE CARD'S TWO FORK ADAPTERS ───────
  //
  // `WorkflowCard` speaks `LibraryRow`; both fork handlers above speak the WIRE types. These
  // two adapters are that seam, and each reads `row.source` — the original wire object, kept
  // whole by `libraryRow.ts` precisely so a handler never receives a rebuilt object that has
  // quietly lost a field (a rebuilt object that drops the draft's opaque `token` is the
  // D-186-07 SILENT CLOBBER — a behaviour bug that typechecks).
  //
  // They arrived here with their handlers under D-29: they exist solely to cast an argument
  // for those two handlers, and an adapter split from the handler it feeds leaves half a
  // concern behind on a file G-5 has already fired on. Their three siblings — the adapters for
  // `onRun`, `onOpen` and `onDeleted` — are NOT the fork concern and stayed on the page.
  //
  // ⚠ D-12 — THE TWO FORK ADAPTERS ARE SIBLINGS AND ARE NEVER MERGED. `onForkNewVersion`
  // reaches `createNewVersion` (SAME slug at version N+1) and `onForkStarter` reaches
  // `createFromStarter` (a FRESH auto-suffixed slug at version 1, retried once on a 409). They
  // share one word on the card face because the user's intent is identical; merging the
  // handlers behind that word breaks the GLOBAL `UNIQUE(slug, version)` constraint the moment
  // two people fork one shared starter. The card branches on `provenance` and constructs
  // neither slug nor version.
  //
  // ⚠ 192.1-07 (D-19): THEY ARE NO LONGER PURE CASTS — each is now the ENTRY to a two-step
  // flow (ask, then create), and `confirmFork` below is the second step. `kind` is what
  // carries D-12's distinction across the gap, so the ONE dialog cannot collapse the TWO
  // handlers by construction.
  const onForkNewVersion = useCallback(
    (row: LibraryRow) => {
      // ── THE EXISTING-DRAFT BRANCH (192-14), NOW THE FIRST THING THAT HAPPENS ──
      // Nothing is created and nothing is fetched, so there is no request that can 409 —
      // AND, since 192.1-07, no prompt either: nothing is being named on this path (D-23).
      // `onOpenDraft` is REUSED rather than a third `setBuilderInitial` call site added,
      // which is what threads 186-07's opaque concurrency token by construction instead of
      // by remembering to — a dropped token is a silent-clobber bug that typechecks.
      //
      // ⚠ THIS IS A SHIPPED BLOCKER FIX, NOT AN OPTIMISATION. It is the operator's 2026-08-11
      // decision on U5 (`192-UAT.md` test 11), where a fork click 409'd twice and the surface
      // said nothing at all; regressing it re-opens that blocker. It survived the 192.1-03
      // extraction by construction and it survives the prompt by ORDER — it runs before any
      // pending state is set, so the dialog cannot mount on this row. The card already says
      // so before the click (`FORK_CONSEQUENCE_EXISTING`, selected by `hasExistingFork`).
      const existing = draftBySlug.get(row.slug)
      if (existing) {
        onOpenDraft(existing)
        return
      }
      setPendingFork({ row, kind: "version" })
    },
    [draftBySlug, onOpenDraft],
  )

  // A starter fork ALWAYS creates — a fresh auto-suffixed slug at v1 belongs to nobody yet, so
  // there is no "the copy you already started" to open. It goes straight to the prompt.
  const onForkStarter = useCallback((row: LibraryRow) => {
    setPendingFork({ row, kind: "starter" })
  }, [])

  /**
   * 192.1-07 (D-19 / D-12) — THE SECOND STEP: the person has typed a name.
   *
   * `kind` selects which sibling runs, which is the only place the two paths could ever have
   * been merged and is therefore the only place worth guarding. The name is trimmed here as
   * well as in the dialog — the dialog is a UI and this is the write path, and a write path
   * that trusts its caller to have validated is one refactor away from not being validated.
   */
  const confirmFork = useCallback(
    (name: string) => {
      if (!pendingFork) return
      const chosen = name.trim()
      // D-20's one hard gate, restated where the write happens. An empty name is not a
      // preference; there is nothing to create.
      if (!chosen) return
      const wire = pendingFork.row.source as PublishedWorkflow
      const kind = pendingFork.kind
      setPendingFork(null)
      if (kind === "version") void createNewVersion(wire, chosen)
      else void createFromStarter(wire, chosen)
    },
    [pendingFork, createNewVersion, createFromStarter],
  )

  /** Dismissed — Escape, Cancel, the ✕ or the overlay. Nothing was written, so nothing undoes. */
  const cancelFork = useCallback(() => setPendingFork(null), [])

  return {
    forkFailed,
    draftBySlug,
    onForkNewVersion,
    onForkStarter,
    pendingFork,
    confirmFork,
    cancelFork,
    isClash,
  }
}

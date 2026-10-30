/**
 * Phase 235 plan 09 (SURF-03 · D-235-03) —
 * THE APP-SHELL ATTENTION REGISTRY: a GENERAL surface with EXACTLY ONE TENANT.
 * (Two since Phase 301 — see "CORRECTED at Phase 301 (D-11)" below.)
 *
 * ── ⛔ D-235-03, VERBATIM, BECAUSE THE SHAPE IS THE DECISION ──────────────────────────
 *
 * ~~*"The shell signal is a GENERAL surface with exactly ONE tenant — it renders a registry of
 * actionable app-level conditions, Phase 235 registers one producer (a broken source), and
 * ⛔ registering a second producer here is scope creep and is forbidden."*~~
 *
 * The seam exists so `SEED-231` (*nobody is told an approval is waiting*) can plug in later
 * **without a second surface** growing beside this one — the two-paths-one-outcome shape this
 * codebase has shipped five times. It does NOT exist so that this phase can quietly acquire a
 * second feature. `NavPanel.badge.test.tsx` asserts `ATTENTION_PRODUCERS.length === 1`
 * literally, which is what makes that sentence enforceable rather than aspirational: the next
 * author adding a tenant has to come here and argue with a number.
 *
 * ── ⚠ CORRECTED at Phase 301 (D-11) — THE SECOND TENANT, ARGUED RATHER THAN SMUGGLED ──
 *
 * The struck sentence above is kept, not deleted, because it is the reason this change had to be
 * a decision. **Phase 301 is the deliberate override that paragraph demanded**: its CONTEXT argued
 * the count against D-235-03 and registered ONE more tenant, `waiting-runs` — *a run is waiting on
 * you*. The register id for that tenant is **SEED-281**; every `SEED-231` in this file names the
 * same need under its superseded id. Both length pins (`NavPanel.badge.test.tsx`,
 * `attentionTab.test.ts`) now assert **2 plus both keys**, with the reason written beside the
 * original `1`, so a THIRD tenant still has to come here and argue with a number.
 *
 * What made a second tenant safe is that the shell's surfaces were never allowed to infer who a
 * condition belongs to: every condition now carries a REQUIRED `mark` (`"library"` |
 * `"waiting"`, D-31), the Library's badge, popover and tab marks count only `"library"`
 * conditions (D-12, `conditionsForMark`), and producers take ONE context object (D-13) so the
 * second tenant could lead somewhere other than Library health without a branch in any renderer.
 *
 * ── ⛔ THIS MODULE DERIVES NO VERDICT (D-235-05) ──────────────────────────────────────
 *
 * `useSourceAttention` returns the SERVER's `stopped[]`, with the soft-failure debounce already
 * applied. Nothing here filters it, re-counts it or second-guesses it. A source that failed once
 * and recovered is not in that array, so it produces no condition and no badge — SC#4's
 * *"a person who has ignored it once has not been trained to ignore it always"*, honoured by
 * having no second decider rather than by a threshold copied onto the client.
 *
 * ── ⚠ ONE READER PER MOUNTED SUBTREE — AND THE SHIPPED TREE HAS TWO ──────────────────
 *
 * ⚠ **CORRECTED at Phase 235 plan 15 (gap-closure round 1 · verification G4).** This block used
 * to be titled *"one reader per RENDER TREE"* and to warn that a second `useSourceAttention()`
 * call anywhere in the same tree would mean two polls and, in time, two answers that contradict
 * each other about one source.
 *
 * **The shipped tree already had two readers when that was written, and they cannot contradict
 * each other.** A docblock asserting an invariant the code breaks is worse than either fix: the
 * next author trusts it, and goes hunting a divergence that cannot happen.
 *
 * ⚠ The refuted sentence is deliberately NOT reproduced verbatim here — a false claim left as a
 * quotable string is the thing a future grep finds. It is preserved word for word in
 * `.planning/phases/235-the-source-says-what-it-did/235-15-SUMMARY.md`, which is where a
 * superseded claim belongs.
 *
 * ── WHAT IS ACTUALLY TRUE, MEASURED ──────────────────────────────────────────────────
 *
 *   • **The count is TWO.** `ChatLayout` resolves this registry once — the shell reader,
 *     always mounted — and hands the result to three renderers (the desktop rail, the mobile
 *     drawer's nav row, the drawer-opening hamburger). While the Library is open, its ACTIVE
 *     tab body mounts a second: `library/IngestionTab.tsx` on Ingestion, or
 *     `library/SourcesAttentionSection.tsx` on Health.
 *   • **Never three.** Those two call sites are mutually exclusive BY TAB: `components/ui/
 *     tabs.tsx` is bare Radix with no `forceMount`, and `LibraryPage`'s five `<TabsContent>`
 *     carry none either, so an inactive tab body is UNMOUNTED, not hidden.
 *   • **They cannot disagree, and that is structural, not lucky.** D-235-05 puts the
 *     soft-failure debounce on the SERVER. Every reader passes `stopped[]` through untouched,
 *     so two readers render one verdict. The real cost is one extra GET per poll interval
 *     while the Library is open — a doubled RATE, never a second opinion.
 *
 * ── WHY THE VERDICT WAS NOT THREADED DOWN INSTEAD (measured and DECLINED, in writing) ─
 *
 * The shell's verdict would have to cross `App` → `ChatLayout` → `LibraryPage` → the tab body.
 * Three of those four are G-5-firing hot files, and it would couple the Library page to the
 * app shell — to save one poll of a small payload on the one surface the person is looking at.
 * Declined here so the next author reads a decision rather than re-deriving it.
 *
 * ── ⛔ THE RE-OPEN TRIGGER — this is a deferral, not a shrug ──────────────────────────
 *
 * A deferral with no re-open trigger is a decision nobody can revisit, so here is this one's:
 * hoist the verdict into a context provider (one fetch, many consumers) the moment ANY of:
 *   1. a THIRD concurrent reader appears — i.e. two that are not mutually exclusive by tab;
 *   2. the server-named poll interval drops far enough that a doubled rate is material;
 *   3. any consumer needs to WRITE the verdict rather than read it (a local override, an
 *      optimistic dismissal, a refresh that must be seen by the other reader).
 *
 * ── WHAT GUARDS THE COUNT, AND WHAT CANNOT ───────────────────────────────────────────
 *
 * `ChatLayout.badge.test.tsx` asserts the shell fetch fires `toHaveBeenCalledTimes(1)`, never
 * `toHaveBeenCalled()` — the second is true of both worlds. ⚠ **But that case does not mount
 * the Library, so it is blind to the second reader and could never have caught this.** The
 * suite therefore also carries a `?raw` INVENTORY FENCE that sweeps every non-test source file
 * for `useSourceAttention(` call sites and pins the total, so a FOURTH reader reddens a test
 * instead of silently multiplying the poll rate again.
 *
 * ── ⭐ PHASE 244 PLAN 04 (SHELL-05 · BUG-260911-03 · C-5) — THE CONDITION LEARNS ITS TAB ─
 *
 * The operator's complaint was that *"the badge creates a question it then refuses to answer"*:
 * it names a count and stops at the Library door, leaving five tabs to hunt through.
 *
 * `BUG-260911-03` guessed the cause — *"the likely shape is that `attentionConditions` already
 * knows what KIND each condition is … **verify that before building anything**"* — and the
 * guess was **wrong, measured**: `AttentionCondition` carried four fields and no kind at all.
 * The kind lives on `AttentionProducer.key`, and on `StoppedSource.cause`, which the producer
 * below **consumes and discards** into the `detail` sentence. So the answer is one OPTIONAL
 * field, set by the producer that already exists.
 *
 * ⛔ **ARM 1 OF THE RE-OPEN TRIGGER WAS CHECKED BEFORE THIS CHANGE, NOT AFTER.** The trigger
 * five paragraphs up names *a third concurrent reader* as arm 1. The tab attribution is
 * threaded to `LibraryPage` **as data**, down the props path the shell already owns — so the
 * reader count is still TWO and the call-site inventory is still the same three files. Had it
 * been closed by calling `useSourceAttention()` in the page, this change would have fired its
 * own file's deferral to save one prop.
 *
 * ⚠ `244-03` independently fires arm 1's SHAPE for a different hook (`useAskUserPrompt`). The
 * deferral should be triggered ONCE, on both data points, rather than twice by halves.
 *
 * ⛔ **`SEED-231` (nobody is told an approval is waiting) WAS CONSIDERED AND NOT TAKEN.**
 * `SHELL-03` made it topical, which is exactly when a seam gets filled in by accident. It stays
 * the registry's INTENDED future tenant, re-openable only by a deliberate override with the
 * count argued against D-235-03 — never as a fill-in while a neighbouring field was added.
 *
 * ⚠ Phase 301 (D-11) is that deliberate override; the tenant is `waiting-runs` and its register
 * id is SEED-281 (this paragraph's SEED-231 is superseded). See the CORRECTED block at the top.
 */

import { useEffect, useMemo } from "react"

import { useSourceAttention } from "@/hooks/useSourceAttention"
import { useWaitingNotices } from "@/hooks/useWaitingNotices"
import { SENTENCE_FOR_CAUSE } from "@/components/sources/sourceHealthVocabulary"
// ⛔ IMPORTED, NEVER RE-TYPED. `librarySelection.ts` owns the five-member tab vocabulary and
// `LibraryPage`'s segmented control is DERIVED from it (`D-217-15` treats a sixth key as a
// schema change). A local copy of the union here would be a second place a sixth tab has to
// be spelled — which is the drift that rule exists to prevent.
import type { LibraryTab } from "@/pages/librarySelection"

/**
 * ONE actionable app-level condition — a thing that is true right now, that a person can do
 * something about, and that has somewhere to go.
 *
 * ⚠ Phase 301-02 (D-31): a UNION on a REQUIRED `mark`. Every renderer that shows a Library
 * signal reads `conditionsForMark(…, "library")`, so a waiting run can never add to the Library's
 * number, row or tab mark (D-12). The mark is required, never inferred from a missing field: an
 * absent `tab` already means "a Library condition with no tab", and must not also mean "not a
 * Library condition at all".
 */
export type AttentionCondition = LibraryCondition | WaitingCondition

/** A Library condition — today, a watched source the server judged to have stopped reading. */
export interface LibraryCondition {
  /** The Library's mark. Counted by the rail badge, its popover, the drawer badge and the tabs. */
  mark: "library"
  /** Stable across polls, so React keys and re-orders behave. */
  id: string
  /** What is affected, in the person's own words for it. */
  title: string
  /** Why it needs them. A SENTENCE from a vocabulary leaf — never a raw error string. */
  detail: string
  /**
   * The door this condition leads to. Injected by the shell, never resolved here — ~~this app
   * has no router (`SEED-185`), so navigation is always a callback and never a URL.~~
   *
   * ⚠ CORRECTED at Phase 301 (D-11 / F12): since 297/299 the app HAS routes — `openRun` pushes
   * `/app/runs/<id>`. What stays true is the shape: a condition carries a CALLBACK the shell
   * injected (through the D-13 context), never a URL string, so no renderer composes an address.
   *
   * ⚠ Phase 235's single tenant leads to the Library's Health tab, which is also the popover's
   * one footer action. It is carried PER CONDITION so a second tenant can lead somewhere else
   * without the popover growing a branch about who its conditions belong to.
   */
  onOpen: () => void
  /**
   * The Library tab that OWNS this condition — the shell says THAT something needs attention,
   * this is what lets the Library say WHERE (`BUG-260911-03`).
   *
   * ⚠ OPTIONAL, deliberately. A future tenant of this registry may have no Library home at all
   * (`SEED-231`'s waiting approval is not a tab), and a required field would force it to name
   * one it does not have. An absent `tab` marks nothing and is not an error.
   *
   * ⛔ It exists because the CONDITION carried no kind while the PRODUCER did (C-5). The report
   * that asked for this guessed the opposite and said so: *"verify that before building
   * anything — this report asserts the symptom, not the cause."* Verified; this is the answer.
   *
   * ⛔ It is a `LibraryTab` union member, which cannot carry free text — so this field can
   * never become the second route by which a raw provider error reaches the UI (T-244-04-02).
   *
   * ⚠ Phase 301-02 (D-31): the "future tenant with no Library home" this paragraph anticipated
   * arrived as its OWN mark (`WaitingCondition`, SEED-281 — SEED-231 above is superseded), which
   * carries no `tab` key at all. On a `LibraryCondition` an absent `tab` still means only "a
   * Library condition owned by no tab".
   */
  tab?: LibraryTab
}

/**
 * Phase 301-02 (D-11 / D-31) — a run that is waiting on THIS person (SEED-281).
 *
 * ⛔ It has no Library home, so it has no `tab` key and is never counted by the Library's badge,
 * popover or tab marks (D-12). It is rendered by 301-03's waiting list, which composes the row's
 * words (org · kind · origin · waited) at render time through its own vocabulary leaf — the
 * waited phrase ticks each minute, so it is never baked into `detail` here.
 *
 * ⛔ No field carries the question or the approval text (T-301-17).
 */
export interface WaitingCondition {
  mark: "waiting"
  /** The notice id — stable across refetches. */
  id: string
  /** The workflow's name, verbatim from the server (the renderer owns the "Untitled workflow" fallback). */
  title: string
  /** Always `""` for this mark: the row's words are composed at render time (see above). */
  detail: string
  /** Opens the run (`ctx.openRun(runId)`), never Library health. */
  onOpen: () => void
  /** The waiting run. */
  runId: string
  /** The org the run lives in — may differ from the active org (the list spans every org, D-27). */
  orgId: string
  /** That org's name (the renderer owns the "Unnamed org" fallback). */
  orgName: string
  /** When the run began waiting: the notice's `created_at`, ISO 8601. */
  since: string
  /** What the run is waiting for. */
  kind: "question" | "approval"
  /** Who started the run, when known. */
  origin?: "app" | "schedule" | "key" | null
  /**
   * The server's count of ALL open notices for this person — the same on every row, and it can
   * EXCEED the number of rows when the server caps them. A badge reads this (`waitingTotal`),
   * never the row count.
   */
  total: number
}

/**
 * Phase 301-02 (D-13) — what the waiting list's freshness is, as the producer knows it.
 *
 *   loading  → never answered, still asking
 *   failed   → never answered, and the ask failed
 *   stale    → answered before, but the latest refetch failed (the rows shown are the last answer)
 *   answered → the rows are the server's latest answer
 */
export type WaitingStatus = "loading" | "failed" | "answered" | "stale"

/**
 * Phase 301-02 (D-13) — the ONE object every producer receives. The shell builds it once, memoised,
 * so a producer's conditions stay stable across renders. Each producer reads only the doors it
 * leads to; a new door is a new key here, never a branch in a renderer.
 */
export interface AttentionContext {
  /** The Library's Health tab — the stopped-sources tenant's door. */
  openLibraryHealth: () => void
  /** A run's surface — the waiting-runs tenant's door. */
  openRun: (runId: string) => void
  /** Optional: told the waiting list's freshness, so a renderer can say "loading" / "may be out of date". */
  reportWaitingStatus?: (status: WaitingStatus) => void
}

/**
 * A tenant of the shell signal.
 *
 * ⚠ `use` is a HOOK and is called during render, unconditionally, in registry order. The array
 * below is a module constant of fixed length, so that order can never change between renders.
 */
export interface AttentionProducer {
  key: string
  use: (ctx: AttentionContext) => AttentionCondition[]
}

/**
 * The one registered tenant: sources the SERVER has judged to have stopped reading.
 *
 * `title` is the watched folder — the thing the person named and recognises. `detail` is the
 * cause sentence keyed off the server's own `cause`, so a revoked token says what is true of the
 * source and never what the code experienced.
 */
export function useStoppedSourceConditions(ctx: AttentionContext): AttentionCondition[] {
  const { stopped } = useSourceAttention()
  const onOpen = ctx.openLibraryHealth
  return useMemo(
    () =>
      stopped.map((source) => ({
        mark: "library" as const,
        id: source.watch_id,
        title: source.source_folder_name,
        detail: SENTENCE_FOR_CAUSE[source.cause](source.connection_name ?? ""),
        onOpen,
        // ⛔ FROM THE PRODUCER'S OWN KIND, never from the source's `cause`. A stopped watched
        // source is the Health tab's, whichever way it stopped — and a client that read the
        // cause to pick a destination would be the second decider D-235-05 forbids.
        tab: "health" as const,
      })),
    [stopped, onOpen],
  )
}

/**
 * Phase 301-02 (D-11 / D-14) — the SECOND tenant: runs waiting on this person (SEED-281).
 *
 * ⛔ THE ONE CALL SITE of `useWaitingNotices` in the product (D-14). The hook refetches on every
 * freshness trigger and treats Realtime as a hint (D-17); nothing here derives a verdict either —
 * the rows and the total are the server's, passed through.
 *
 * The freshness is reported through `ctx.reportWaitingStatus` from an effect whose dependency is
 * a string primitive, so reporting it can never loop a render.
 */
export function useWaitingRunConditions(ctx: AttentionContext): AttentionCondition[] {
  const { notices, total, loading, verdictKnown, failedSinceLast } = useWaitingNotices()
  const openRun = ctx.openRun
  const report = ctx.reportWaitingStatus

  const status: WaitingStatus = !verdictKnown
    ? loading
      ? "loading"
      : "failed"
    : failedSinceLast
      ? "stale"
      : "answered"

  useEffect(() => {
    report?.(status)
  }, [report, status])

  return useMemo(
    () =>
      notices.map((notice) => ({
        mark: "waiting" as const,
        id: notice.id,
        title: notice.workflow_name,
        detail: "",
        onOpen: () => openRun(notice.run_id),
        runId: notice.run_id,
        orgId: notice.org_id,
        orgName: notice.org_name,
        since: notice.created_at,
        kind: notice.kind,
        origin: notice.origin,
        total,
      })),
    [notices, total, openRun],
  )
}

/**
 * How many conditions each Library tab owns — the shell's count, attributed.
 *
 * ⛔ A STRICT LEAF: no React, no hook, no fetch. It exists so `LibraryPage` can be handed the
 * conditions the shell ALREADY resolved and render a mark, rather than calling
 * `useSourceAttention()` a third time to ask the same question again (arm 1 of the re-open
 * trigger above). That is the whole reason the attribution is cheap.
 *
 * ⚠ **A TAB WITH NOTHING IS ABSENT FROM THE MAP, NEVER PRESENT AS `0`.** The render rule on the
 * other side is *empty ⇒ render nothing* — no zero badges, no reserved space — and a map of
 * zeroes would make that rule the caller's problem instead of this function's.
 *
 * ⚠ A condition with NO `tab` is COUNTED NOWHERE. Bucketing it under a default would make the
 * shell's total and the tabs' totals disagree about the same thing, silently.
 */
export function attentionCountByTab(
  conditions: readonly AttentionCondition[],
): Partial<Record<LibraryTab, number>> {
  const counts: Partial<Record<LibraryTab, number>> = {}
  for (const condition of conditions) {
    // Phase 301-02 (D-12): only the Library's own conditions can mark a Library tab.
    if (condition.mark !== "library") continue
    if (!condition.tab) continue
    counts[condition.tab] = (counts[condition.tab] ?? 0) + 1
  }
  return counts
}

/**
 * Phase 301-02 (D-12) — the conditions that carry one mark.
 *
 * ⛔ A STRICT LEAF: no React, no hook, no fetch. Every Library renderer (the rail badge, its
 * popover, the drawer's Library badge) reads `conditionsForMark(…, "library")`, so a waiting run
 * can never be counted as a Library condition — the partition lives HERE, once, rather than as a
 * filter re-typed in each renderer.
 */
export function conditionsForMark(
  conditions: readonly AttentionCondition[],
  mark: "library",
): LibraryCondition[]
export function conditionsForMark(
  conditions: readonly AttentionCondition[],
  mark: "waiting",
): WaitingCondition[]
export function conditionsForMark(
  conditions: readonly AttentionCondition[],
  mark: AttentionCondition["mark"],
): AttentionCondition[] {
  return conditions.filter((condition) => condition.mark === mark)
}

/**
 * Phase 301-02 (D-12 / F8) — how many runs are waiting on this person, as the SERVER counts them.
 *
 * ⛔ A STRICT LEAF. It reads `total` off any waiting row (every row carries the same server count)
 * and returns 0 when there is none. ⛔ NEVER `.length`: the server may cap the rows, and a badge
 * that counted rows would under-report exactly when the list is longest.
 */
export function waitingTotal(conditions: readonly AttentionCondition[]): number {
  for (const condition of conditions) {
    if (condition.mark === "waiting") return condition.total
  }
  return 0
}

/**
 * ~~⛔ EXACTLY ONE ENTRY IN PHASE 235. See the docblock — a second one here is scope creep, and
 * the suite fails if you add it.~~
 *
 * ⚠ CORRECTED at Phase 301 (D-11): TWO entries, the second argued against D-235-03 in Phase 301's
 * CONTEXT (`waiting-runs`, SEED-281). Both length pins assert 2 plus both keys, so a THIRD entry
 * still fails the suite until someone argues for it the same way.
 */
export const ATTENTION_PRODUCERS: readonly AttentionProducer[] = Object.freeze([
  { key: "stopped-sources", use: useStoppedSourceConditions },
  { key: "waiting-runs", use: useWaitingRunConditions },
])

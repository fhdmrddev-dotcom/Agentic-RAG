/**
 * Phase 235 plan 09 (SURF-03 · D-235-03) —
 * THE APP-SHELL ATTENTION REGISTRY: a GENERAL surface with EXACTLY ONE TENANT.
 *
 * ── ⛔ D-235-03, VERBATIM, BECAUSE THE SHAPE IS THE DECISION ──────────────────────────
 *
 * *"The shell signal is a GENERAL surface with exactly ONE tenant — it renders a registry of
 * actionable app-level conditions, Phase 235 registers one producer (a broken source), and
 * ⛔ registering a second producer here is scope creep and is forbidden."*
 *
 * The seam exists so `SEED-231` (*nobody is told an approval is waiting*) can plug in later
 * **without a second surface** growing beside this one — the two-paths-one-outcome shape this
 * codebase has shipped five times. It does NOT exist so that this phase can quietly acquire a
 * second feature. `NavPanel.badge.test.tsx` asserts `ATTENTION_PRODUCERS.length === 1`
 * literally, which is what makes that sentence enforceable rather than aspirational: the next
 * author adding a tenant has to come here and argue with a number.
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
 */

import { useMemo } from "react"

import { useSourceAttention } from "@/hooks/useSourceAttention"
import { SENTENCE_FOR_CAUSE } from "@/components/sources/sourceHealthVocabulary"
// ⛔ IMPORTED, NEVER RE-TYPED. `librarySelection.ts` owns the five-member tab vocabulary and
// `LibraryPage`'s segmented control is DERIVED from it (`D-217-15` treats a sixth key as a
// schema change). A local copy of the union here would be a second place a sixth tab has to
// be spelled — which is the drift that rule exists to prevent.
import type { LibraryTab } from "@/pages/librarySelection"

/**
 * ONE actionable app-level condition — a thing that is true right now, that a person can do
 * something about, and that has somewhere to go.
 */
export interface AttentionCondition {
  /** Stable across polls, so React keys and re-orders behave. */
  id: string
  /** What is affected, in the person's own words for it. */
  title: string
  /** Why it needs them. A SENTENCE from a vocabulary leaf — never a raw error string. */
  detail: string
  /**
   * The door this condition leads to. Injected by the shell, never resolved here — this app
   * has no router (`SEED-185`), so navigation is always a callback and never a URL.
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
   */
  tab?: LibraryTab
}

/**
 * A tenant of the shell signal.
 *
 * ⚠ `use` is a HOOK and is called during render, unconditionally, in registry order. The array
 * below is a module constant of fixed length, so that order can never change between renders.
 */
export interface AttentionProducer {
  key: string
  use: (onOpen: () => void) => AttentionCondition[]
}

/**
 * The one registered tenant: sources the SERVER has judged to have stopped reading.
 *
 * `title` is the watched folder — the thing the person named and recognises. `detail` is the
 * cause sentence keyed off the server's own `cause`, so a revoked token says what is true of the
 * source and never what the code experienced.
 */
export function useStoppedSourceConditions(onOpen: () => void): AttentionCondition[] {
  const { stopped } = useSourceAttention()
  return useMemo(
    () =>
      stopped.map((source) => ({
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
 * ⛔ EXACTLY ONE ENTRY IN PHASE 235. See the docblock — a second one here is scope creep, and
 * the suite fails if you add it.
 */
export const ATTENTION_PRODUCERS: readonly AttentionProducer[] = Object.freeze([
  { key: "stopped-sources", use: useStoppedSourceConditions },
])

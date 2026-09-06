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
 * ── ⚠ ONE READER PER RENDER TREE, AND IT IS `ChatLayout` ─────────────────────────────
 *
 * `ChatLayout` calls the registry ONCE and hands the result to three renderers (the desktop
 * rail, the mobile drawer's nav row, and the drawer-opening hamburger). ⛔ A second
 * `useSourceAttention()` call anywhere in the same tree means two polls and, eventually, two
 * disagreeing answers about the same source — which is exactly the failure D-235-05 exists to
 * prevent. `ChatLayout.badge.test.tsx` asserts the verdict fetch fires
 * `toHaveBeenCalledTimes(1)`, never `toHaveBeenCalled()`, because the second is true of both
 * worlds.
 */

import { useMemo } from "react"

import { useSourceAttention } from "@/hooks/useSourceAttention"
import { SENTENCE_FOR_CAUSE } from "@/components/sources/sourceHealthVocabulary"

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

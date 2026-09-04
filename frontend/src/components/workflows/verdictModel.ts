/**
 * Phase 184-08 Task 1 (VALID-03 · D-182-06 · sketch 139-A) — verdictModel.
 *
 * IT GROUPS AND IT COUNTS. IT CLASSIFIES NOTHING.
 *
 * The server answers `POST /workflows/validate` with a flat list of findings, each one
 * already carrying its own severity, its own wording and the phase SLUG it belongs to.
 * This module turns that flat list into the two shapes a canvas needs — a per-node
 * lookup and a tray listing — and it does so WITHOUT forming a single opinion about
 * any of them.
 *
 * ── NO CODE TABLE. THIS IS THE RED LINE, NOT A PREFERENCE (D-182-06) ──
 * There is no list of finding identifiers in this file. No severity derivation, no
 * friendly-message map, no allow-list, no special case for the dual-source
 * terminal-step finding, for the registry-availability finding, or for any other. The
 * lint vocabulary has exactly ONE owner — the backend modules that mint it — and a
 * second copy on the client is a copy that drifts. Phase 185 will ship more findings
 * as new identifiers in the module that owns them, and this file must need no edit at
 * all for the canvas to render them.
 *
 * The ONLY reason this module knows the string `"incomplete"` at all is to READ
 * `verdict.severity`. It compares against the SOFT value and treats everything else as
 * the hard one — which is not a classification, it is the route's own fail-closed
 * default mirrored rather than substituted for. A finding whose severity is a value
 * this client has never seen therefore renders as a problem, never as a note, and
 * never disappears. `?raw` source guards in `verdictModel.test.ts` fail the moment an
 * identifier table, a request, or a runtime import of the API client appears here, and
 * each of them carries a positive control so a broken guard is visible rather than
 * vacuously green.
 *
 * ── WHY `workflowWide` IS A SEPARATE ARRAY AND NOT A DROPPED CASE ──
 * A `phase` of `null` means the finding belongs to the workflow rather than to any one
 * step — "this still needs a one-line description" points at no node on the canvas.
 * Sketch 139 variant B lost exactly those findings from the surface entirely, and that
 * is the recorded reason variant A won. Keeping them in their own array is what gives
 * the tray a home to put them in.
 *
 * ── TOTALITY ──
 * An empty list, a finding with an identifier this client has never seen, a finding
 * with a severity outside the wire union, and a `phase` that matches no node on the
 * canvas all resolve honestly and never throw. Nothing is filtered, nothing is
 * re-ordered, nothing is rewritten: every field of every finding survives into the
 * grouped output byte-for-byte, so the renderer can show the server's own words.
 *
 * ── PURITY ──
 * Zero React, zero DOM, zero clock, zero randomness, and no runtime dependency on the
 * API client or on the editing store. The `Verdict` shape is imported as a TYPE ONLY
 * (erased at compile time) so that this module does not become a third declaration of
 * a wire shape that already has one home and one compile-time bridge — see the
 * `Verdict` docblock in the api client for why a second copy is the failure mode and
 * not the fix.
 */
import type { Verdict } from "@/lib/api"
// Type-only, and therefore erased: the live loop owns the cause union, and keying the
// sentences off it is what stops a second spelling of the same two words appearing here.
// `ValidationState` rides the same erased import (187-27) so the outstanding-check
// predicate below is keyed on the loop's OWN state names rather than on a copy of them.
import type { DegradedValidationCause, ValidationState } from "@/hooks/useLiveValidation"

/**
 * The mark a node carries. Two values, because the canvas paints two: a red ✕ and a
 * dashed grey ○. There is no third — "we could not check" is a state of the CHECK, not
 * of a finding, and it belongs to the card's own degraded slot.
 */
export type NodeMark = "error" | "incomplete"

/**
 * The soft severity — the only wire value this module compares anything against.
 *
 * Everything that is not exactly this is treated as the hard severity, at the count,
 * at the mark and at the row. That single rule is applied in all three places so a
 * surface can never say "0 problems" while rendering a problem.
 */
const SOFT_SEVERITY = "incomplete"

/** The resting-state wording when the server returned nothing at all. It claims only
 *  what it can: the STATIC half. A publish still has to run its golden run and its
 *  judge, and this line must never be mistaken for that. */
export const NOTHING_OUTSTANDING = "Nothing to fix — the static checks pass"

/**
 * WHAT A SURFACE MAY SAY WHEN THE CHECK DID NOT RUN (D-184-14 · 187-27).
 *
 * The union means exactly one thing: **the check did not produce an answer.** The loop
 * can reach that state two ways, and a THIRD way reaches it without the loop being
 * involved at all — nobody has asked yet. All three are members of the same class, and
 * the widening below says so in the type rather than leaving the third to be discovered
 * as an absence.
 *
 * SAME BEHAVIOUR, DIFFERENT WORDS, ON PURPOSE. A shape rejection is reproducible: an
 * author who hits one and is told "try again" will try forever. An unreachable server
 * usually is worth retrying. And "nobody has asked yet" is neither a fault nor a
 * failure — it is a moment that ends on its own, so its sentence is the shortest of the
 * three and reads as a state rather than an alarm. None of the three renders the
 * rejected body — that is logged at the transport boundary and carried no further — and
 * none of them may EVER be swapped for silence or for the clean line above, because "we
 * could not check" rendering as "fine" is the single worst thing this surface can do.
 *
 * ── WHY `not-run` IS A MEMBER AND NOT A FORK (187-27, GAP B) ──
 * The obvious-looking tidy-up is to "fix the naming" by splitting never-ran off into its
 * own boolean, on the grounds that nothing degraded. Do not: every surface that reads
 * this union reads it to answer ONE question — *may I speak as though a check answered?*
 * — and the answer for never-ran is the same NO. A second channel would mean every
 * consumer growing a second branch, and the first consumer to forget one is the
 * fail-open this widening closed. `DegradedValidationCause` stays exactly what the LOOP
 * can emit; `TrayCheckCause` is what a SURFACE can be in, and it is deliberately wider.
 *
 * ── AND WHY IT IS SPELLED `not-run` RATHER THAN THE OBVIOUS WORD ──
 * DO NOT "TIDY" THIS SPELLING. The obvious single word for this member is on the graded
 * governance never-say list (`references/graded-governance.md` §VOCABULARY, binding —
 * *"Judgement is not a gap"*), and `governanceVocabulary.test.ts` sweeps every string
 * literal in this tree for it with the TypeScript parser. That sweep is deliberately
 * blunt: it does not care whether a literal is copy or a discriminant, because the way
 * banned copy actually arrives is somebody copying a nearby machine token into a
 * sentence. Renaming the member was the cheap side of that trade; adding an exemption to
 * a shipped governance fence to fit a spelling would have been the expensive one.
 *
 * They live in this module, and not beside the component that says them, for a
 * mechanical reason worth writing down: a component file may not export shared
 * constants (`react-refresh/only-export-components`). It is also the right home —
 * every word a surface says ABOUT a check now sits in one pure module, next to the
 * resting-state line it has to be chosen against.
 */
export type TrayCheckCause = DegradedValidationCause | "not-run"

export const DEGRADED_SENTENCE: Record<TrayCheckCause, string> = {
  unreadable: "We couldn't check this — the workflow's shape isn't something we can read yet.",
  unreachable: "We couldn't reach the check.",
  // Short on purpose: it sits in a strip whose only other occupant is the checking beat,
  // and a long sentence there reads as an alarm about something that is merely not
  // finished happening. It claims no pass and attributes nothing to anyone.
  "not-run": "Not checked yet.",
}

/**
 * IS THE CHECK STILL OUTSTANDING? — the one predicate behind the `not-run` cause.
 *
 * `idle` is "nobody has asked" and `checking` is "the FIRST request is in flight with no
 * previous answer to hold" (the loop's own docblock). Neither carries an `ok` field, by
 * construction, so neither may be read as a verdict — which makes them one state as far
 * as any surface is concerned, and exactly the state `not-run` words.
 *
 * It lives HERE, and is exported, so its two callers on the Builder page share one rule
 * instead of two inline comparisons that can drift apart — and so the page gains no
 * declaration of its own (D-187-14). It is keyed on `ValidationState["kind"]`, so a
 * renamed state in the loop is a typecheck error here rather than a branch that quietly
 * stops matching. It classifies nothing: it reads the loop's own discriminant and
 * answers a boolean.
 */
export function isCheckOutstanding(kind: ValidationState["kind"]): boolean {
  return kind === "idle" || kind === "checking"
}

/**
 * The sentence the publish surface LEADS a refusal with (D-186-11).
 *
 * ── THIS IS WORDING, NOT THE TABLE THE RED LINE FORBIDS ──
 * It is keyed on the publish STAGE the server refused at — the same server-fixed
 * sequence the gauntlet already draws as a row of nodes — and it classifies nothing. No
 * severity is derived, no refusal is turned into a pass or a pass into a refusal, and
 * nothing is filtered: a stage missing from this map is still a refusal, because
 * `blockedSentence` below answers a sentence for EVERY input. That totality is the whole
 * point. An allow-list that silently dropped an unfamiliar stage would be the client
 * owning a vocabulary it does not own, which is the rule stated on the wire type in the
 * API client and the one this map is deliberately built not to break.
 *
 * ── A MACHINE TOKEN MAY NEVER LEAD THIS SURFACE ──
 * The shipped headline interpolated the server's raw stage string for anything it had no
 * special case for, so an author read a refusal whose one load-bearing word was the one
 * word they could do nothing with. The verbatim string is still rendered, byte for byte,
 * inside the raw-verdict disclosure — it is DEMOTED, never removed. Only two stages earn
 * their own line here: the grader, whose refusal means something a generic line cannot
 * convey, and the publish-commit refusal, whose cause is entirely invisible from the
 * spine. Everything else leads with the fallback and names its cause underneath, where
 * the server's own words already render.
 *
 * They live in this module, and not beside the component that says them, for the same
 * mechanical reason as the two sentences above: a component file may not export shared
 * constants (`react-refresh/only-export-components`). It is also the right home — every
 * word a surface says about a check now sits in one pure module.
 */
export const BLOCKED_SENTENCE: Record<string, string> = {
  judge:
    "Blocked by the grader — the run finished, but the independent grader would not pass the result",
  draft_changed:
    "Blocked at the last step — the draft changed while it was being checked",
  /**
   * ── BUG-260815-06, THE HALF A CLIENT CAN CLOSE (2026-08-20) ─────────────────────────
   *
   * The report's fifth requirement, verbatim: *"Distinguish 'the run failed' from 'the
   * judge refused'. `blocked_stage: structural_gate` covers a run that never reached the
   * judge at all. An author reading 'fix the deliverable and re-publish' reasonably
   * concludes their OUTPUT was judged and found wanting, when in fact phase 1 of 5 never
   * produced anything. That copy is actively misdirecting on this path."*
   *
   * Before this line, `structural_gate` fell through to `BLOCKED_FALLBACK_SENTENCE`, which
   * says only that something below stopped it — and what rendered below was the server's
   * one-line `named_failures` entry restating the stage. The operator hit this three times
   * in one sitting and could not diagnose any of them.
   *
   * ⚠ WHAT THIS SENTENCE MAY AND MAY NOT CLAIM. The precise cause lives in
   * `workflow_phases` / `harness_audit` against the `golden_run_id` the response already
   * carries, and NOTHING joins them today — that is the report's requirements 1 and 2 and
   * it is a SERVER change. So this sentence must not pretend to name the failing step: it
   * says which SIDE of the pipeline stopped (the run's own checks, before any grading), so
   * the author stops looking at their deliverable, and it points at the run rather than
   * claiming to have read it. Requirement 3 — do not imply the gate is exhaustive, do not
   * promise a future capability — is why it names no step and offers no link.
   *
   * ── ⚠ THAT PARAGRAPH IS NOW FALSE, AND IT IS KEPT ABOVE RATHER THAN OVERWRITTEN ──────
   * `BUG-260828-09` (2026-08-28) made the server change it names. `PublishVerdict` now
   * carries an optional `blocked_step` — the failing phase's identity plus the engine's own
   * cause sentence — so the join it says nothing performs is performed, and the surface
   * leads with a card that DOES name the step (`PublishBlockedStepCard`).
   *
   * ⚠ **THIS SENTENCE IS UNCHANGED ANYWAY, AND THE REASON IS NOT INERTIA.** It is the
   * HEADLINE, and it is the arm that must still be right when `blocked_step` is absent — a
   * pre-fix server, a run that crashed before any phase failed, a `structural_gate` block
   * raised by the argument re-projection rather than by a step's own gate (which fails no
   * phase and therefore names none). It still claims only which SIDE stopped. What changed
   * is that a second, better-informed line now sits ABOVE it when the facts exist; a
   * headline that named a step would have to invent one on every path where they do not.
   *
   * ⚠ The measured cause of the operator's four identical blocks was NOT a missing sentence
   * — the engine wrote a good one every time. `_drive_golden_run`'s harvest treated a
   * `pending` phase's `{}` as the deliverable and overwrote the failed phase's reason before
   * anything could read it. Requirements 1 and 2 needed a plumbing fix, not new copy.
   */
  structural_gate:
    "Blocked during the trial run — a step's own checks refused what it produced, so the run never reached the review",
}

/**
 * What a refusal says when its stage is not one of the two above — including a stage
 * this client has never seen, which is the case that matters. It is a SENTENCE, and it
 * is honest in both directions: it claims a refusal happened (server truth), and it
 * claims nothing at all about where, because we do not know. "We could not place it" is
 * not "it was fine", and it is not a code either.
 */
export const BLOCKED_FALLBACK_SENTENCE =
  "Publish was blocked — nothing was published. What stopped it is named below."

/**
 * The one resolver, total by construction.
 *
 * Guarded on the RESULT being a string rather than merely present, because a lookup on a
 * plain object answers for inherited keys too — a stage named after something on the
 * prototype would otherwise hand a non-string back to a renderer. A canvas must not go
 * blank over a shape surprise, and neither must this.
 */
export function blockedSentence(code: string | null | undefined): string {
  const known = code == null ? undefined : BLOCKED_SENTENCE[code]
  return typeof known === "string" ? known : BLOCKED_FALLBACK_SENTENCE
}

/** The grouped, counted view of one server response. */
export interface VerdictGroups {
  /**
   * Findings keyed by `verdict.phase`, which IS `node.id` and IS the phase `slug`.
   * The client derives that identity from nothing — the server guarantees it, and the
   * whole per-node rendering path is a map lookup on a key it was handed.
   */
  byPhase: Map<string, Verdict[]>
  /** Every finding whose `phase` is `null` — the ones that belong to no node. */
  workflowWide: Verdict[]
  /** Findings at the hard severity. Counted by reading `severity`, never by deriving it. */
  errorCount: number
  /** Findings at the soft severity. Same rule. */
  incompleteCount: number
  /**
   * The mark a node should carry, or `undefined` when the server said nothing about it.
   *
   * PRECEDENCE, NOT CLASSIFICATION: a step the server reported twice gets ONE mark, and
   * the harder of the two wins, because a card has one corner. The severities compared
   * here were all supplied by the server; this function only decides which of the
   * supplied values is shown when a node has several.
   */
  markFor(slug: string): NodeMark | undefined
}

/** The house singular/plural helper, kept local so no shared util grows a phase-184
 *  special case. */
function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

/**
 * groupVerdicts — the whole module, in one pass over the server's list.
 *
 * Total by construction: a nullish list, a nullish entry and an unrecognised severity
 * are all handled without a throw, because the definition being validated is
 * author-supplied and a canvas must not go blank over a shape surprise.
 */
export function groupVerdicts(verdicts: readonly Verdict[]): VerdictGroups {
  const byPhase = new Map<string, Verdict[]>()
  const workflowWide: Verdict[] = []
  const marks = new Map<string, NodeMark>()
  let errorCount = 0
  let incompleteCount = 0

  for (const verdict of verdicts ?? []) {
    if (!verdict) continue

    // The one comparison in this file. Soft is the value we know; everything else is
    // hard, which mirrors the route's fail-closed default instead of second-guessing it.
    const soft = verdict.severity === SOFT_SEVERITY
    if (soft) incompleteCount += 1
    else errorCount += 1

    const slug = verdict.phase
    if (slug === null || slug === undefined) {
      workflowWide.push(verdict)
      continue
    }

    const bucket = byPhase.get(slug)
    if (bucket) bucket.push(verdict)
    else byPhase.set(slug, [verdict])

    // Precedence: hard wins, and once a node is hard it stays hard.
    if (!soft) marks.set(slug, "error")
    else if (!marks.has(slug)) marks.set(slug, "incomplete")
  }

  return {
    byPhase,
    workflowWide,
    errorCount,
    incompleteCount,
    markFor: (slug: string) => marks.get(slug),
  }
}

/**
 * summaryLine — the locked resting-state wording (sketch 139-A, CONTEXT `<specifics>`).
 *
 * *"1 problem · 2 things to finish."* THE TWO COUNTS ARE NEVER MERGED. Both severities
 * set `ok: false` and both block a publish, but only one of them is bad news:
 * "unfinished" is the state a canvas spends most of its life in, and a surface that
 * adds the two together into "3 problems" tells a person they have done something
 * wrong every time they pause halfway. Separating them IN WORDS, before anything is
 * opened, is the whole mechanism — which is why this string exists at rest and not
 * only inside an expanded tray.
 *
 * When one half is zero its clause is omitted entirely rather than rendered as a zero:
 * "0 problems · 3 things to finish" still leads with the word "problems".
 */
export function summaryLine(groups: VerdictGroups): string {
  const parts: string[] = []
  if (groups.errorCount > 0) parts.push(plural(groups.errorCount, "problem", "problems"))
  if (groups.incompleteCount > 0) {
    parts.push(plural(groups.incompleteCount, "thing to finish", "things to finish"))
  }
  return parts.length > 0 ? parts.join(" · ") : NOTHING_OUTSTANDING
}

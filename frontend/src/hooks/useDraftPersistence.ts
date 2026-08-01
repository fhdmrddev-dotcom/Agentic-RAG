/**
 * Phase 186-06 (CONCUR-01 / CONCUR-02 · D-186-01 · D-186-03 · D-186-04 · D-186-05 ·
 * D-186-08 · D-186-12) — the draft-persistence loop.
 *
 * THIS HOOK OWNS THE WHOLE WRITE SEAM: create-once-then-PATCH, the debounce timer, the
 * dirty/saved state, the concurrency token, and the honest refusal branches.
 * `builderStore.ts` carries the fence that says so by name (D-184-05 → D-186-05): that
 * store owns the definition STATE and may not name the API client at all, so the write has
 * to live somewhere else, and this is the somewhere. `WorkflowBuilderPage` composes it the
 * way it already composes `useLiveValidation` — one call, the result held as a plain value
 * and passed down as props.
 *
 * ── COMPOSED, NOT COPIED (the `useLiveValidation.ts:11-22` precedent) ──────────────
 *
 * Two halves are copied VERBATIM rather than paraphrased:
 *   1. The create-once guard — `draftIdRef` / `creatingRef` and their comment, from
 *      `WorkflowBuilderPage.tsx:532-538` and `:1132-1143`. `setDraftId` is async, so
 *      several writes can fire while the state is still null and each would re-run the
 *      create → a UniqueViolation storm on (slug, version). React is 19.2 and
 *      `<StrictMode>` is live in `main.tsx`, so the double-invoke is real: the refs are
 *      what make "exactly one create" true.
 *   2. The hand-rolled `setTimeout` debounce and its cleanup, from
 *      `useLiveValidation.ts:229-271`. The house answer to "do not add a debounce
 *      dependency" is the shipped closure shape, not a package.
 *
 * ── THE ONE DELIBERATE DIVERGENCE: A WRITE IS NEVER CANCELLED ─────────────────────
 *
 * `useLiveValidation` cancels its in-flight request in the effect cleanup, using the
 * abort-controller belt. That is correct for a READ and forbidden for a WRITE, so the belt
 * is absent here and no request this module issues is cancellable.
 *
 * Cancelling cancels the CLIENT's interest, not the server's execution. A cancelled write
 * may still have COMMITTED — and if it did, it consumed the concurrency token, so the very
 * next write would be refused as stale against a change the person actually made. A read is
 * idempotent; a write is not. In its place: the single-flight queue below, which serializes
 * writes instead of racing and then cancelling them.
 *
 * ── THE TOKEN IS OPAQUE, AND THIS MODULE CANNOT PARSE IT (D-186-07) ───────────────
 *
 * `tokenRef` holds bytes. It is echoed verbatim on the next write and is never inspected,
 * normalised, split, re-rendered, or turned into a JS Date value — Postgres keeps
 * microseconds and a JS date value keeps only milliseconds, so a parsed-and-re-rendered
 * token is truncated and matches ZERO rows: every save would then refuse as stale (probed
 * against the live database, 2026-08-01). A source fence in the co-located suite asserts
 * this module contains no date-parsing call form, with both a positive and a negative
 * control so the fence stays free to describe the hazard in prose.
 *
 * ── ONE DEBOUNCE RULE, ONE TIMER, ONE WRITER (D-186-01) ───────────────────────────
 *
 * Any change to the definition schedules one write. Cosmetic canvas drags are NOT edits
 * and never reach here (D-186-02: `canvasNudge` is browser-local by construction and
 * imports neither this module, the store, nor the API client).
 *
 * AND A FOLLOW-UP IS STILL AN AUTOSAVE BEAT, SO IT OWES THE SAME QUIET PERIOD (186-17,
 * WR-08). The rule a reader can check: under sustained editing this loop issues at most one
 * write per `AUTOSAVE_DEBOUNCE_MS`, measured over ELAPSED TIME rather than over edits or
 * round trips. The queue drain re-enters only where `pendingRef` says a beat was consumed by
 * an in-flight write; a supersession with a live timer behind it BREAKS and lets that timer
 * do its job. This paragraph was false for two plans: the drain's unthrottled `continue`
 * re-entered on every keystroke-driven supersession, so the rate was set by network latency.
 * F22 in the co-located suite bounds it by the clock, so a regression reads as a number.
 *
 * ── ONE HOLD MECHANISM, TWO SENTENCES (D-186-04 + D-186-12) ──────────────────────
 *
 * A write that cannot safely happen is HELD, not attempted and not silently dropped, and
 * the reason is stated. There are two reasons and exactly ONE mechanism: a publish in
 * flight, and a definition whose shape the last check could not read. 186-CONTEXT is
 * explicit — *"Do not build two."*
 *
 * Release FLUSHES; it does not retry on a timer. A held timer sets a flag and issues
 * nothing, and the transition out of the hold issues exactly one write. A publish runs for
 * minutes, and a re-arming timer would burn one per second for the whole gauntlet while
 * still writing nothing.
 *
 * ── A CONFLICT HALTS THE LOOP, AND THE PERSON PICKS THE EXIT (D-186-08) ──────────
 *
 * The instant the server refuses a write because the row moved, this loop stops writing
 * and stays stopped. No retry, no back-off, no re-send with a fresher token — a retry storm
 * against a row somebody else is writing is how an optimistic guard becomes a livelock, and
 * a silent re-send is precisely the clobber this phase exists to prevent.
 *
 * Two exits are RETURNED and neither is ever invoked from inside this hook: Reload (the
 * default — discard what is local, take the server's copy) and Overwrite (a deliberate
 * second click — keep what is on screen and force it through). Nothing here decides to
 * discard somebody's work. The person does.
 *
 * ── NEVER A FALSE RECEIPT (D-186-04, the T-185-04-01 lesson) ─────────────────────
 *
 * The store's receipt action has exactly ONE caller in this file, and the condition above
 * it is a statement about WHAT WAS WRITTEN: the receipt is filed only when the `phases` and
 * `meta` references the request carried are STILL the references the store holds. A
 * refusal — of any kind — leaves the draft dirty, so the leave guard still fires and the
 * toolbar still reads unsaved. A mid-edit definition can legitimately be refused; the
 * honest answer is "not saved, and here is why", never a receipt for something that did not
 * happen.
 *
 * ⚠ THIS USED TO BE INFERRED FROM A QUEUE FLAG, AND THAT WAS GAP-1 / CR-01. The old test
 * was a bare `if (pendingRef.current)`, and `pendingRef` is armed only where an edit is
 * observed while a write is ALREADY in flight — at timer fire, at `saveNow`, at hold
 * release. An edit that lands during an in-flight PATCH but before its own 1000 ms debounce
 * matures arms none of them: it merely reschedules the debounce effect, whose `inFlightRef`
 * re-check happens a full second later. A PATCH round trip is normally far shorter than
 * that, so the write completed against a clear flag, filed `Saved ✓` for a payload that
 * predated the edit, and cleared `dirty` — after which the edit's own timer read the
 * not-dirty gate and dropped the work silently. That also disarmed `beforeunload`, the
 * in-app leave guard and the blur rescue, all of which key on `dirty`.
 *
 * `pendingRef` is now ONE of three reasons a turn can be superseded, not the only one. The
 * lesson is T-185-04-01's, met a second time: a guard scoped to a proxy for the property is
 * green and worthless. Verify the PROPERTY, not the patch. F17 in the co-located suite
 * holds the interleaving open (the second edit's timer is deliberately left immature) and
 * records the {store, sent} pair at receipt time, so a regression reads as a number rather
 * than as an argument.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  createWorkflowDraft,
  listDraftWorkflows,
  updateWorkflowDraft,
  type WorkflowDefinitionJSON,
} from "@/lib/api"
import { selectDefinition, type BuilderStore } from "@/components/workflows/builderStore"
import type { BuilderDefinition } from "@/pages/WorkflowBuilderPage"

/**
 * The quiet period an edit burst coalesces over before ONE write is issued (D-186-01's
 * 500–1000 ms band, at the top of it).
 *
 * 1000 and not 500, deliberately: at 500 this loop and `useLiveValidation`
 * (`VALIDATE_DEBOUNCE_MS = 500`) mature on the SAME tick, so the check whose verdict would
 * have held the write has not answered yet — the hold gate would be reading a stale verdict
 * on precisely the edit that needed it. At 1000 the check has had a full extra half-second
 * (its own debounce plus a round trip) to land. It also halves the write rate against a row
 * that carries the golden-run history.
 *
 * ⚠ THAT LAST SENTENCE ONLY BECAME TRUE AGAIN IN 186-17 (WR-08). This constant can only halve
 * a rate the drain then respects: while the queue drain re-entered unthrottled on every
 * keystroke-driven supersession, the sustained rate was one write per ROUND TRIP, so doubling
 * this number changed nothing at all about the load on the row. The drain now breaks unless a
 * beat was actually consumed, which is what puts this constant back in charge of the rate.
 *
 * BE HONEST ABOUT WHAT THIS BUYS: a probability improvement, NOT a guarantee. Nothing here
 * orders the two loops. The authoritative backstop is the write's own 422, which surfaces
 * the same sentence the hold would have. This hook claims no ordering it does not have.
 */
export const AUTOSAVE_DEBOUNCE_MS = 1000

/**
 * D-186-12 — writes hold while a publish is in flight, because one stray keystroke
 * mid-gauntlet burns minutes of golden run and real provider cost. Edits accumulate as
 * dirty and flush when the publish resolves.
 *
 * ONE OF TWO SENTENCES ON ONE MECHANISM. This string has exactly ONE HOME: the page
 * renders it and must not re-declare it. Two spellings of a locked string is how a locked
 * string stops being locked (the `SAVED_STILL_A_DRAFT` docblock's rule, inherited).
 *
 * ⚠ IT PROMISES A FLUSH, SO IT IS ONLY TRUE WHERE ONE HAPPENS. Do not render this on a
 * surface where `enabled` is false — `HOLD_PUBLISHING_MANUAL` below is the honest spelling
 * for that case, and `holdReason` picks between them. See its docblock for why.
 */
export const HOLD_PUBLISHING = "Publishing — changes will save when it finishes"

/**
 * THE SAME HOLD, SAID HONESTLY ON A SURFACE WHERE THE FLUSH WILL NOT HAPPEN (186-13, WR-04).
 *
 * `HOLD_PUBLISHING` above PROMISES an automatic flush, and after 186-13 gated the
 * hold-release effect on `enabled` (D-181-01 — no automatic write past the revert switch)
 * that flush does not happen when the canvas flag is off. Using one sentence for both
 * surfaces would make the surface promise something the loop will not do: a receipt in the
 * future tense, for a save that is never coming. So the flag-off spelling INSTRUCTS instead
 * of promising, and it names the way out — the Save-draft button is still there and still
 * works the moment the gauntlet resolves.
 *
 * READ THIS AS ONE MECHANISM WITH A THIRD STRING, NOT AS A SECOND MECHANISM. D-186-12's
 * rule is *"Do not build two"* holds, and this does not build one: there is still exactly
 * one `holdRef`, one release effect and one `{kind:"held"}` state. What changed is that the
 * sentence the single mechanism carries is now selected on the same input that decides
 * whether the flush happens, which is the only way the two can agree.
 *
 * ONE HOME, same rule as its neighbours: the page renders it and must not re-declare it.
 */
export const HOLD_PUBLISHING_MANUAL =
  "Publishing — not saved; press Save draft again when it finishes"

/**
 * D-186-04 — a definition whose SHAPE the server could not read is held rather than
 * written, and the reason is stated. The same sentence is what a write REFUSED for that
 * reason carries, so one situation reads one way whether it was caught before the request
 * or by the request's own 422.
 *
 * THE OTHER SENTENCE ON THE SAME MECHANISM. One home, same rule as above.
 */
export const HOLD_UNREADABLE = "Not saved — we can't read this shape yet"

/**
 * Everything a refused write is told when this client cannot name the cause: a missing row,
 * a dropped connection, a timeout, a refusal minted after this client shipped.
 * Cause-neutral on purpose — a 404 or a dead network is a different thing from an
 * unreadable shape and must never be told it was one.
 */
export const SAVE_FAILED_SENTENCE = "Not saved — we couldn't complete the save"

/**
 * THE ROW IS GONE, SO THE LOOP STOPS AND SAYS SO (186-13, WR-05).
 *
 * WHY IT IS NOT THE CAUSE-NEUTRAL LINE ABOVE. `SAVE_FAILED_SENTENCE` describes a situation
 * a retry can fix — a dropped connection, a timeout — and it therefore INVITES one: the
 * honest thing to do after reading it is to press Save again. This situation cannot be
 * fixed by pressing anything. Telling a person "we couldn't complete the save" for a row
 * that no longer exists sends them back to press the same button forever, against a server
 * that will answer 404 every single time.
 *
 * So it states three things and nothing else: that the draft is gone, that this client has
 * stopped trying, and what they can still do about the work that is on their screen.
 *
 * IT DOES NOT OFFER AN EXIT, and that is deliberate — see `isTerminalRefusal` below.
 */
export const DRAFT_GONE_SENTENCE =
  "Not saved — this draft no longer exists, so we've stopped trying. Copy anything you still need before you leave this page."

/**
 * The published-row refusal (D-184-16 debt 3, MOVED HERE BY 186-07).
 *
 * IT LIVED ON `WorkflowBuilderPage` AND HAD TO MOVE, because the branch that chooses it
 * moved. 184-11 classified the 409 in the page's own `onSaveDraft` catch; 186-07 deleted
 * that catch when the write seam became this hook, and a sentence whose only chooser lives
 * here cannot be declared a module away — the page would have had to re-classify the error
 * it no longer sees, or this module would have had to mint a SECOND spelling of a locked
 * string, which is the failure 186-04 retired the store's parallel save enum for.
 *
 * ONE HOME, and the page re-exports the name so every existing caller and every existing
 * grep still finds it there — the `SAVED_STILL_A_DRAFT` precedent, applied a second time.
 *
 * It is business-plain and it NAMES THE WAY OUT (Tweak), because a bare "couldn't save" on
 * a frozen row sends a person back to press the same button again.
 */
export const PUBLISHED_CONFLICT_MESSAGE =
  "This version is published and can't be edited — use Tweak to start a new draft"

/**
 * THE EXIT ITSELF FAILED, AND THAT CHANGED NOTHING (186-14, GAP-4 / CR-02).
 *
 * An EXTRA LINE, never a sentence swap, and the distinction is the whole fix. The sentence
 * that may not be replaced is the banner's — the one that offers the two ways out — because
 * replacing it is precisely how a dropped request used to take both controls off the screen
 * with it. So this states what did NOT change and leaves the offer standing.
 *
 * WHY A NOTE AND NOT A NEW REFUSAL SENTENCE. `DRAFT_GONE_SENTENCE`'s docblock above records
 * the rule: the cause-neutral line INVITES a retry, and telling a person to retry something
 * that cannot work is the lie. Here the retry is exactly the right instinct — pressing
 * Reload again is what fixes this — so the invitation is honest and the only thing that must
 * not happen is the person losing the control that makes it possible.
 *
 * It is a FIXED client-authored constant with nothing interpolated: no status code, no URL,
 * no server body (T-186-14-05, the `WorkflowDraftUnreadableError` precedent — a raw body is
 * logged at the boundary and never rendered).
 *
 * ONE HOME, same rule as its neighbours: the banner renders it and must not re-declare it.
 */
export const RELOAD_FAILED_NOTE =
  "We couldn't reach the server to reload — nothing has changed, and both options above still work."

/**
 * The loop's distinguished states, in the `ValidationState` / `PublishOutcome`
 * discriminated-union idiom whose docblock states the rule this inherits: *a binary
 * ok/error handler is FORBIDDEN*. A boolean pair could represent "saved AND refused"; this
 * cannot, and a flat four-value enum could not carry the HELD and CONFLICT readings this
 * loop also needs — which is the recorded reason the store's old save slot was retired
 * rather than reused (186-04).
 *
 *   idle    — nothing is claimed. The resting state.
 *   saving  — a request is outstanding. At most one, ever.
 *   saved   — a CONFIRMED write, with nothing newer queued behind it.
 *   held     — the write is deliberately NOT being attempted, and `sentence` says why.
 *              Distinct from `error` on purpose: nothing was refused, and the person is
 *              not being asked to do anything except wait.
 *   conflict — the row moved somewhere else. The loop is halted and the person picks an
 *              exit. `currentToken` is what the server holds NOW, carried so that
 *              Overwrite costs ONE request rather than a re-read plus a request. It is
 *              opaque here exactly as everywhere else. `note` is an OPTIONAL extra line
 *              the banner may carry BESIDE its locked sentence — optional because the
 *              ordinary conflict, the one the server refused, needs no explanation beyond
 *              that sentence. Today it has exactly one producer: a reload that could not
 *              reach the server (186-14). It never replaces anything.
 *   error    — the write was attempted and refused. It carries no `ok` field BY
 *              CONSTRUCTION, so no path can turn a refusal into a clean reading.
 */
export type PersistState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  | { kind: "held"; sentence: string }
  | { kind: "conflict"; currentToken: string | null; note?: string }
  | { kind: "error"; sentence: string }

export interface DraftPersistenceArgs {
  /** The page's existing `useMemo` — identity changes once per EDIT, not per render. */
  definition: BuilderDefinition | null
  /** Drafted and canvas-enabled. While false the hook issues NOTHING. */
  enabled: boolean
  initialDraftId: string | null
  initialToken: string | null
  store: BuilderStore
  /** D-186-12 — a publish is running against this draft. */
  publishInFlight: boolean
  /**
   * D-186-04's signal, DERIVED BY THE CALLER and passed as a primitive on purpose.
   * `useLiveValidation` emits a NEW state object on every beat (including the
   * minimum-visible flips), so a caller handing the object in would make the hold gate
   * churn on beats that did not change the answer. A `string | null` is value-stable.
   */
  validationCause: "unreadable" | "unreachable" | null
  onDraftCreated: (id: string) => void
}

export interface DraftPersistence {
  state: PersistState
  draftId: string | null
  /**
   * An exit the person CHOSE is in progress (186-12). Deliberately NOT a member of
   * `PersistState`: that union describes the write loop's OUTCOME, and a resolution being
   * under way is not an outcome — `overwrite` is `saving` while it resolves, and `reload`
   * is not writing at all.
   *
   * It exists so the conflict banner can disable its two controls AND stay mounted for the
   * whole resolution. A banner gated on `conflict` alone unmounts the instant `overwrite`
   * sets `{kind:"saving"}`, so the disabled state would never be visible and a double-click
   * would stay an ordinary thing to do.
   */
  resolving: boolean
  /** The explicit Save-draft button (D-186-03). Resolves true on a confirmed write. */
  saveNow: () => Promise<boolean>
  /** The conflict escape hatch the banner offers FIRST (D-186-08). */
  reload: () => Promise<void>
  /** The conflict escape hatch that costs a deliberate SECOND click (D-186-08). */
  overwrite: () => Promise<void>
}

/**
 * The name a rejection carries, read structurally. Branching on the NAME rather than on a
 * constructor-identity check is the shipped `useLiveValidation.causeOf` idiom and its
 * reason transfers exactly: a rejection that crossed a module or realm boundary still
 * classifies, and nothing here ever parses a message. No prototype comparison of any kind
 * appears in this file, so a class that arrived through a second module copy still lands in
 * the right branch.
 */
function nameOf(err: unknown): string {
  return err && typeof err === "object" && "name" in err ? (err as { name: string }).name : ""
}

/**
 * Which honest state a refused write lands in. FOUR named branches — the stale token,
 * which is a conflict the person resolves; the 422, which is a cause they can act on; the
 * published row, which has a way out the generic line cannot name; and the missing row,
 * which has no way out at all and must say so — plus a genuine catch-all. A dropped
 * connection, a timeout and a refusal minted after this client shipped all mean "we could
 * not complete it", and none of them may borrow a specific wording they did not earn.
 *
 * ⚠ THE 404 BRANCH IS 186-13's, AND IT CLOSES WR-05. It used to fall into the catch-all, so
 * a draft deleted in another tab produced the cause-neutral line and the loop kept writing
 * — every subsequent edit issued another PATCH against a row that could not exist, forever,
 * and the sentence it showed invited exactly that. A retry is the right instinct for a dead
 * network and the wrong one here, which is why the two situations may not share a string.
 *
 * ⚠ THE PUBLISHED BRANCH IS 186-07's, AND IT CLOSES A DEBT 186-06 RECORDED RATHER THAN
 * GUESSED AT. 186-06 left `WorkflowConflictError` in the catch-all deliberately, because
 * its sentence still had exactly one home on the page and minting a second spelling here
 * would have been the two-enums failure. 186-07 moved the constant instead, so the branch
 * and the string now live together. Without it, a published-row save would have silently
 * lost the sentence 184-11 shipped for it.
 *
 * Module-level and pure, so the write loop's closure cannot capture a stale copy of it.
 */
function refusalOf(
  err: unknown,
): Extract<PersistState, { kind: "conflict" } | { kind: "error" }> {
  const name = nameOf(err)
  if (name === "WorkflowStaleTokenError") {
    const carried =
      err && typeof err === "object" && "currentToken" in err
        ? (err as { currentToken: string | null }).currentToken
        : null
    return { kind: "conflict", currentToken: carried ?? null }
  }
  if (name === "WorkflowDraftUnreadableError") {
    return { kind: "error", sentence: HOLD_UNREADABLE }
  }
  if (name === "WorkflowConflictError") {
    return { kind: "error", sentence: PUBLISHED_CONFLICT_MESSAGE }
  }
  if (name === "WorkflowNotFoundError") {
    return { kind: "error", sentence: DRAFT_GONE_SENTENCE }
  }
  return { kind: "error", sentence: SAVE_FAILED_SENTENCE }
}

/**
 * IS THIS REFUSAL THE END OF THE LOOP? (186-13, WR-05)
 *
 * A PREDICATE RATHER THAN A STRING COMPARISON, deliberately. Halting is a property of the
 * CAUSE, not of the sentence the cause happens to have been given this month; asking
 * `refusal.sentence === DRAFT_GONE_SENTENCE` would make a copy edit into a behaviour change.
 * Structural on the name, for `nameOf`'s reason: no prototype comparison appears in this
 * file, so a class that arrived through a second module copy still classifies.
 *
 * THREE HALTING CAUSES, AND THE TAXONOMY IS THE POINT RATHER THAN THE COUNT (186-14, WR-07
 * — this docblock said TWO until a published row was found retrying forever). What separates
 * them is not how bad they are; it is whether the person has an exit, and where it lives:
 *
 *   • a stale token halts into `{kind:"conflict"}`, because the row is still there and the
 *     person has two real IN-APP exits — take the server's copy, or force theirs through;
 *   • a missing row halts into `{kind:"error"}` with `DRAFT_GONE_SENTENCE`, because it has
 *     NEITHER. Reload would find nothing and Overwrite would PATCH a row that is not there,
 *     so offering them would be two dead affordances on a banner that promises a way out;
 *   • a PUBLISHED row halts into `{kind:"error"}` with `PUBLISHED_CONFLICT_MESSAGE`. The row
 *     is frozen by the `workflow_definitions_block_published_update` trigger
 *     (`056_workflow_definitions.sql`) and can never become a draft again, so NO PATCH
 *     against this id can ever succeed — "terminal" here is a fact about the row, not a
 *     guess about the network. It has no in-app exit either, but its sentence already NAMES
 *     the way out (Tweak, which forks a new draft), which is why it needs no banner and no
 *     machinery to re-state itself: nothing overwrites that state for the rest of the
 *     session, so the answer stays on screen beside the button.
 *
 * WR-07 IS WR-05's OWN ARGUMENT, APPLIED TO THE OTHER TERMINAL CAUSE. Before this, the
 * predicate named only `WorkflowNotFoundError`, so a published-row 409 refused the write,
 * showed the right sentence, and then let every subsequent keystroke burst re-issue a doomed
 * PATCH for the life of the session. The halt is what stops that loop; the sentence was
 * never the thing doing the work.
 *
 * AND IT MUST NOT AUTO-RECREATE THE DRAFT. The obvious alternative — clear `draftIdRef` so
 * the next write creates a fresh row — was rejected on the 404's own design: missing and
 * not-owned answer IDENTICALLY (T-103-01-01, so no existence leaks), which means this
 * client literally cannot tell "deleted elsewhere" from "not yours". Silently minting a new
 * row on a refusal it cannot classify is a worse failure than stopping. The loop stops, the
 * draft stays dirty, and every leave guard therefore fires — which is the right outcome for
 * work that cannot be persisted here.
 */
function isTerminalRefusal(err: unknown): boolean {
  const name = nameOf(err)
  return name === "WorkflowNotFoundError" || name === "WorkflowConflictError"
}

export function useDraftPersistence(args: DraftPersistenceArgs): DraftPersistence {
  const {
    definition,
    enabled,
    initialDraftId,
    initialToken,
    store,
    publishInFlight,
    validationCause,
    onDraftCreated,
  } = args

  const [state, setState] = useState<PersistState>({ kind: "idle" })
  const [draftId, setDraftId] = useState<string | null>(initialDraftId)

  // Synchronous mirrors of the persist state. setDraftId is async, so several
  // writes can fire while draftId is still null and each would re-run
  // createWorkflowDraft → a UniqueViolation storm on (slug, version). The refs
  // collapse the first save to EXACTLY ONE create (UAT-103 save-loop fix). For
  // Open/Tweak the ref is pre-seeded → every save PATCHes the existing row.
  const draftIdRef = useRef<string | null>(initialDraftId)
  const creatingRef = useRef(false)

  // WRITES ARE SERIALIZED, NEVER CANCELLED, AND NEVER CONCURRENT — AND THAT IS A PROPERTY
  // OF THE WRITER, NOT A RULE EACH CALLER REMEMBERS (186-12, GAP-2 / WR-01).
  //
  // Three refs and one rule: at most one write is in flight; a newer edit that arrives
  // while one is in flight sets `pendingRef` rather than issuing a second request; the
  // completion adopts the token that write returned and, if the flag is set, issues
  // exactly ONE follow-up carrying that FRESH token.
  //
  // WHY NOT "just send both": two writes carrying the SAME token means one of them matches
  // 0 rows. The loser would raise a conflict banner for a conflict that never existed — the
  // person would be told their own draft moved under them while they typed.
  //
  // ⚠ THIS PARAGRAPH USED TO NAME THREE CALLERS, AND THAT FRAMING IS WHAT LET TWO MORE SKIP
  // THE RULE. The `inFlightRef` check lived in the debounce timer, the hold release and
  // `saveNow`; the two conflict exits — `overwrite` and `reload` — called `performWrite`
  // with no check at all. An ordinary double-click on Overwrite therefore issued two
  // concurrent PATCHes carrying the SAME token, the server refused the loser `stale_token`,
  // and the loop raised a conflict banner for a conflict that had never happened. The
  // mechanism built to RESOLVE a concurrency conflict was manufacturing them.
  //
  // The check now has exactly ONE home, inside `performWrite`, which is the one place that
  // can enforce it for every caller including ones not yet written. An invariant each caller
  // must remember is not an invariant — the "one home per concern" red line, applied to the
  // write loop.
  //
  // The two exits additionally carry a re-entrancy guard (`reloadingRef`), which is a
  // DIFFERENT concern with a different reason: see `reload` below.
  const inFlightRef = useRef(false)
  const pendingRef = useRef(false)
  const tokenRef = useRef<string | null>(initialToken)

  // D-186-08 — set the instant a stale-token refusal arrives, and cleared only by one of
  // the two exits the person chooses. While it is set this loop issues NOTHING: no timer
  // matures into a request, no follow-up drains, no explicit save goes through.
  // `conflictTokenRef` holds what the server said it has NOW, so Overwrite is one request.
  const haltedRef = useRef(false)
  const conflictTokenRef = useRef<string | null>(null)

  // 186-12 — THE EXIT RE-ENTRANCY GUARD, and it is not the same thing as single flight.
  //
  // Single flight says "at most one request". This says "at most one RESOLUTION": an exit
  // may not be entered while a write is outstanding, nor while the other exit is running,
  // because the token an exit adopts is about to be superseded by the outstanding write's
  // response — and a second `reload` would call `setDrafted` twice, replacing the document
  // (and discarding the undo history) once more than the person asked for.
  //
  // `resolving` is the same fact as rendered state, so the banner can disable its controls
  // and stay on screen for the whole resolution.
  const reloadingRef = useRef(false)
  const [resolving, setResolving] = useState(false)

  // Hold conditions are read at FIRE time from refs, never from a dependency array — see
  // the autosave effect for why. `heldPendingRef` is the accumulated "there is unsent work"
  // flag that the release flushes.
  const holdRef = useRef<string | null>(null)
  const heldPendingRef = useRef(false)

  // The caller's callback, mirrored so the write loop can stay referentially stable.
  const onDraftCreatedRef = useRef(onDraftCreated)
  useEffect(() => {
    onDraftCreatedRef.current = onDraftCreated
  }, [onDraftCreated])

  /**
   * ONE hold mechanism, TWO sentences. Publishing outranks an unreadable shape — a publish
   * is the more consequential thing in flight, and its sentence is the one that tells the
   * person to wait rather than to look at their steps.
   *
   * The gate keys on the LAST KNOWN verdict, never on a check being in flight: waiting for
   * a check to complete would stall autosave for as long as the network is slow, which
   * turns a degraded check into lost work. The authoritative backstop for a shape that
   * really is unreadable is the write's own 422, which lands on the same sentence.
   *
   * ── THE PUBLISH SENTENCE READS `enabled`, AND THAT IS THE POINT (186-13, WR-04) ───
   *
   * The publish branch's sentence is a claim about what this loop will do when the hold
   * releases, and after 186-13 that is exactly what `enabled` decides — so the sentence and
   * the flush take the SAME input, and cannot disagree. Promise when the loop will flush,
   * instruction when it will not.
   *
   * The `unreadable` branch is deliberately UNCHANGED: `HOLD_UNREADABLE` ("Not saved — we
   * can't read this shape yet") promises nothing about a future write, so it is already
   * honest on both surfaces and a second spelling of it would be two strings for one fact.
   */
  const holdReason = useMemo<string | null>(() => {
    if (publishInFlight) return enabled ? HOLD_PUBLISHING : HOLD_PUBLISHING_MANUAL
    if (validationCause === "unreadable") return HOLD_UNREADABLE
    return null
  }, [publishInFlight, validationCause, enabled])

  /**
   * The write loop. `store` is the page's per-mount factory instance and never changes, so
   * this callback is referentially stable for the Builder session — which is what lets the
   * autosave effect close over it without listing it as a dependency.
   *
   * The store is read through a side-effect `getState()` at FIRE time rather than from a
   * closure over rendered state. That is the shipped `onPersist` shape and it is what makes
   * the payload the LATEST definition on every turn, including a follow-up issued long
   * after the timer that queued it matured.
   */
  const performWrite = useCallback(async (): Promise<boolean> => {
    if (haltedRef.current) return false

    // SINGLE FLIGHT, ENFORCED HERE AND NOWHERE ELSE (186-12, WR-01). Every entry point —
    // the debounce timer, `saveNow`, the hold release, both conflict exits, and any caller
    // added later — passes through this line, so none of them can forget it. The semantics
    // are exactly what the three caller-side checks used to do: arm the queue so the
    // outstanding write's drain picks the work up, and report that nothing was written.
    if (inFlightRef.current) {
      pendingRef.current = true
      return false
    }

    inFlightRef.current = true
    let ok = false
    try {
      // The queue drain. Each turn issues EXACTLY ONE request and adopts the token that
      // request returned, so a follow-up is guarded by the value the server minted a
      // moment ago rather than by the one this session started with.
      for (;;) {
        pendingRef.current = false

        const snapshot = store.getState()
        if (snapshot.builderPhase !== "drafted") break
        const def = selectDefinition(snapshot) as unknown as WorkflowDefinitionJSON

        // THE IDENTITY OF WHAT IS ABOUT TO BE WRITTEN, captured before the request leaves.
        //
        // Two references and not a deep compare, because two is the whole payload:
        // `selectDefinition` is literally `{ ...state.meta, phases: state.phases }`, so
        // `meta` and `phases` between them determine every byte that gets sent. Every store
        // action that changes either one REPLACES the reference — `setProjectFolder` spreads
        // a new `meta`, and the phase actions replace `phases`, which is exactly what the
        // store's own dirty subscription keys on. Two O(1) identity compares therefore cover
        // the payload completely, with no third field to forget.
        const writtenPhases = snapshot.phases
        const writtenMeta = snapshot.meta

        setState({ kind: "saving" })
        try {
          if (draftIdRef.current === null) {
            // First save: create EXACTLY ONCE. If a create is already in flight,
            // skip — re-running it would collide on UNIQUE(slug, version) → 500.
            if (creatingRef.current) break
            creatingRef.current = true
            try {
              const created = await createWorkflowDraft(def)
              draftIdRef.current = created.id // synchronous: subsequent calls PATCH
              tokenRef.current = created.token
              setDraftId(created.id)
              onDraftCreatedRef.current(created.id)
            } finally {
              creatingRef.current = false
            }
          } else {
            const written = await updateWorkflowDraft(
              draftIdRef.current,
              def,
              tokenRef.current,
            )
            tokenRef.current = written.token
          }
        } catch (err) {
          const refusal = refusalOf(err)
          if (refusal.kind === "conflict") {
            haltedRef.current = true
            conflictTokenRef.current = refusal.currentToken
          } else if (isTerminalRefusal(err)) {
            // The row is gone, or frozen by publication (186-14, WR-07): halt, but do NOT
            // set `conflictTokenRef` and do NOT produce a `conflict` state. In neither case
            // is there anything to reload or anything an overwrite could reach — the
            // refusal's own sentence is the whole answer. This arm is UNCHANGED by WR-07;
            // only the predicate above it learned the second cause, which is the point of
            // its being a predicate.
            haltedRef.current = true
          }
          setState(refusal)
          break
        }

        // TWO QUESTIONS, ASKED SEPARATELY (186-17, WR-08). They used to share one answer,
        // and that is what turned this loop into a write storm.
        const now = store.getState()

        // (1) MAY A RECEIPT BE FILED? Decided by WHAT WAS WRITTEN and by nothing else
        // (GAP-1 / CR-01): the receipt is honest exactly when the `phases` and `meta`
        // references the request carried are still the references the store holds.
        //
        // `pendingRef` IS DELIBERATELY ABSENT FROM THIS TEST. A queue flag is not evidence
        // that the payload moved — it says only that somebody asked for a write while one
        // was outstanding. Treating it as a supersession is what minted a redundant PATCH
        // for a Save press that changed nothing (WR-08's second instance): the token was
        // bumped for no reason, invalidating the optimistic guard every other open tab
        // holds. An unchanged payload files the receipt the outstanding write earned.
        const superseded = now.phases !== writtenPhases || now.meta !== writtenMeta

        if (superseded) {
          // A newer edit landed mid-flight, so this confirmed write is already superseded
          // and no receipt may be filed for it — clearing `dirty` here would tell the
          // person their latest change is safe when it has not been sent.
          if (haltedRef.current) break
          if (holdRef.current !== null) {
            // A hold began while this write was outstanding. The queued edit becomes held
            // work rather than a second request.
            heldPendingRef.current = true
            setState({ kind: "held", sentence: holdRef.current })
            break
          }

          // (2) MAY THE LOOP ISSUE ANOTHER REQUEST IMMEDIATELY? Decided by `pendingRef` and
          // by nothing else — and the reason is re-derivable from its three arming sites,
          // all of which mean the SAME thing. It is set only inside `performWrite`'s
          // single-flight guard above, reached from the MATURED debounce timer, from
          // `saveNow`, or from the hold release. Each of those had its beat CONSUMED by
          // finding a write outstanding, so there is no live timer behind it and the
          // follow-up it asked for is genuinely owed now.
          //
          // Every OTHER supersession is an edit that landed mid-flight and is still inside
          // its own AUTOSAVE_DEBOUNCE_MS. Those have a LIVE timer by construction: an edit
          // changes `definition`, and the debounce effect's deps are `[definition, enabled]`,
          // so it reschedules. The ordinary autosave beat writes them.
          if (pendingRef.current) continue

          // A FOLLOW-UP IS OWED ON THE CLOCK, NOT NOW — so nothing is outstanding, and the
          // reading must stop saying one is. `dirty` is still true (no receipt was filed),
          // which is what the leave guards, `beforeunload` and the toolbar all key on.
          //
          // Without this break the drain re-entered on every keystroke-driven supersession
          // and the sustained write rate became one per ROUND TRIP instead of one per
          // AUTOSAVE_DEBOUNCE_MS (WR-08). Two knock-ons made that a correctness problem
          // rather than a performance one: every extra write mints a new token, so the loop
          // manufactured the very conflicts this phase exists to prevent, and it widened the
          // publish-race window 186-16 guards.
          setState({ kind: "idle" })
          break
        }

        // A CONFIRMED write with nothing newer queued is the ONLY thing that clears `dirty`.
        store.getState().markSaved()
        setState({ kind: "saved", at: Date.now() })
        ok = true
        break
      }
    } finally {
      inFlightRef.current = false
    }
    return ok
  }, [store])

  /**
   * The debounce. Its dependency array is `[definition, enabled]` and NOTHING else — the
   * hard rule from RESEARCH §3. `useLiveValidation` emits a new state object on every beat,
   * so a hold condition in these deps would restart this timer on every check beat and a
   * slow check would starve autosave entirely. Everything situational (the hold reason, the
   * token, the draft id, the in-flight flag) is read from a ref at FIRE time.
   *
   * `definition` is the CHANGE SIGNAL, not the payload: it is here for its identity, while
   * the bytes that get written are read from the store when the timer matures.
   */
  useEffect(() => {
    if (!enabled || definition === null) return
    // A halted loop schedules nothing at all — not even a timer that would decline to fire.
    if (haltedRef.current) return

    const timer = setTimeout(() => {
      if (haltedRef.current) return
      if (holdRef.current !== null) {
        // Flush-on-release, not retry-on-a-timer: a publish runs for minutes and re-arming
        // a timer for it would burn one per second for the whole gauntlet.
        heldPendingRef.current = true
        setState({ kind: "held", sentence: holdRef.current })
        return
      }
      // Nothing changed since the last confirmed write. Without this, merely OPENING a
      // draft would PATCH it — bumping the row and invalidating the token every other tab
      // holds, which manufactures exactly the conflict this phase exists to prevent.
      if (!store.getState().dirty) return
      // No `inFlightRef` check here: the writer owns that rule (186-12). A matured timer
      // that finds a write outstanding still arms the queue — `performWrite` does it.
      void performWrite()
    }, AUTOSAVE_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [definition, enabled])

  /**
   * The release half of the hold, and the mirror that feeds `holdRef`. Both live in ONE
   * effect so there is no ordering question between them: the previous value is read before
   * it is overwritten, and only the non-null → null transition flushes.
   *
   * `heldPendingRef` OR the store's `dirty` is the trigger, because either alone can be the
   * truth — a timer matured while held, or an edit landed while held whose timer was
   * cleared by the next edit. Both mean there is unsent work.
   *
   * ── EVERY GATE BELOW IS A REASON NOT TO WRITE, AND NONE IS A REASON TO KEEP TALKING ──
   *
   * THE FIFTH FACT, AND IT GOVERNS THE WHOLE BLOCK (186-17, WR-09). The three gates under
   * the transition test — the halt, the `enabled` flag, and the nothing-pending check —
   * decide whether a WRITE happens. Not one of them is a reason to go on claiming that a
   * publish is running. So the `{kind:"held"}` reading is resolved to `{kind:"idle"}`
   * IMMEDIATELY after the non-null → null transition and ABOVE all three, and the gates
   * below it decide only what they were ever about.
   *
   * THE FAILURE IT CLOSES, stated so it is recognisable: with the canvas flag OFF, 186-13's
   * `if (!enabled) return` landed BEFORE anything resolved the state, so once the gauntlet
   * ended the header went on reading *"Publishing — not saved; press Save draft again when
   * it finishes"* — instructing a person to wait for something that had already finished.
   * Nothing was written, and the surface still made a false statement about system state.
   * It cleared only if the author happened to press Save again.
   *
   * THE FUNCTIONAL FORM IS REQUIRED, not stylistic. A bare `setState({kind:"idle"})` would
   * erase a `conflict` that arrived during the hold — and `conflict` is the ONLY reading that
   * carries Reload and Overwrite, so that would reintroduce GAP-4 through a second door. The
   * resolution is therefore a no-op for every reading that is not `held`, which also leaves
   * `saved` and `error` exactly where they were. F20h holds that open.
   *
   * ── THE FLAG GATE, AND WHY IT SITS EXACTLY WHERE IT SITS (186-13, GAP-3 / WR-03) ──
   *
   * This effect used not to read `enabled` at all, and the hold is REACHABLE with the flag
   * off: `renderPublish` (and so `setPublishInFlight`, the sole input to the publish half of
   * `holdReason`) is mounted unconditionally on the page, and the Save-draft button is too.
   * So a flag-off session that edited and published got an AUTOMATIC, unrequested PATCH the
   * moment the gauntlet resolved — a write past the revert switch, which is the one thing
   * D-181-01 exists to make impossible.
   *
   * The position of the `enabled` guard is load-bearing four ways:
   *   • AFTER the `holdRef.current = holdReason` mirror, which must run on every beat
   *     whatever the flag says — the debounce timer and `saveNow` read `holdRef` at FIRE
   *     time, and a stale mirror would let a write through mid-gauntlet on the flag-ON
   *     surface;
   *   • AFTER the `haltedRef` check, so a halted loop is still described as halted rather
   *     than as merely disabled;
   *   • BEFORE the unconditional `heldPendingRef.current = false`, so work accumulated while
   *     the flag was off is still found by a session where the flag is later turned on
   *     (186-17 keeps this and makes it exact — see the paragraph below);
   *   • BEFORE `performWrite()`, which is the leak itself.
   *
   * ── THE PENDING FLAG ON THE FLAG-OFF PATH IS SET TO THE TRUTH (186-17, WR-09) ────
   *
   * BOTH HALVES OF THE REASON, because 186-13 deliberately chose the opposite and a future
   * reader will find that plan. Leaving the flag ARMED lets a later hold-release flush a
   * write on the strength of a Save press made minutes earlier, in a session that may now
   * have a perfectly clean store — bypassing the `dirty` gate the debounce timer carries
   * precisely to stop "merely opening a draft" from PATCHing it, and so bumping the token
   * every other open tab holds for nothing. CLEARING it unconditionally would lose the other
   * half: work really accumulated while the flag was off must still be found if the flag
   * comes on later.
   *
   * `heldPendingRef.current = store.getState().dirty` satisfies both, because it stops being
   * a memory of a press and becomes a statement about the document: the flag claims unsent
   * work exactly when there IS unsent work. F20f drives both directions through a subsequent
   * enabled release, and asks the question by counting writes rather than by reading the ref.
   *
   * `saveNow`, `overwrite` and `reload` are deliberately NOT gated. They are things a person
   * pressed, D-186-03 keeps the explicit save working on the flag-off surface, and D-186-08
   * requires that somebody who has hit a conflict is offered BOTH exits on any surface. The
   * asymmetry is the decision: automatic writes obey the flag, chosen ones obey the person.
   */
  useEffect(() => {
    const previous = holdRef.current
    holdRef.current = holdReason
    if (previous === null || holdReason !== null) return
    // THE HOLD HAS ENDED, SO THE SENTENCE ABOUT IT ENDS TOO — above every gate below, and
    // functionally, so a `conflict`, `error` or `saved` reading that arrived during the hold
    // is untouched (186-17, WR-09).
    setState((s) => (s.kind === "held" ? { kind: "idle" } : s))
    if (haltedRef.current) return
    if (!enabled) {
      // No automatic write past the revert switch (D-181-01) — and no stale arming left
      // behind either: the flag is made to agree with the store rather than to remember a
      // press. See the docblock's pending-flag paragraph for both halves of the reason.
      heldPendingRef.current = store.getState().dirty
      return
    }
    if (!heldPendingRef.current && !store.getState().dirty) return
    heldPendingRef.current = false
    // D-186-12 literally: edits accumulated as dirty, and EXACTLY ONE write flushes them.
    // If one is already outstanding, `performWrite` arms the queue instead (186-12).
    void performWrite()
  }, [holdReason, enabled, store, performWrite])

  /** D-186-03 — the deliberate commit-now. It bypasses the debounce and the dirty gate (a
   *  person who presses Save means it), but never the hold and never the single-flight
   *  rule: the hold exists because the write cannot safely happen, and a button press does
   *  not change that. It reports the hold rather than pretending a save occurred. */
  const saveNow = useCallback(async (): Promise<boolean> => {
    if (haltedRef.current) return false
    if (holdRef.current !== null) {
      heldPendingRef.current = true
      setState({ kind: "held", sentence: holdRef.current })
      return false
    }
    // Single flight is the WRITER's rule, so this button does not re-implement it: with a
    // write outstanding `performWrite` arms the queue and resolves false, which is exactly
    // what the check that used to live here did (186-12).
    return performWrite()
  }, [performWrite])

  /**
   * The DEFAULT exit (D-186-08). Re-reads the owner-scoped drafts list — the EXACT read the
   * shipped Open-a-draft path already performs — rather than adding a new route, hands the
   * row to `setDrafted` (which clears the undo history and `dirty`, which is precisely what
   * "reload discards local changes" means), and adopts the row's token so the loop resumes
   * guarded by the value the server holds now.
   *
   * One call site, and no new function was added to the API client for it.
   *
   * ── THE RE-ENTRANCY GUARD (186-12) ───────────────────────────────────────────────
   *
   * It returns WITHOUT MUTATING ANY REF while a write is outstanding or the other exit is
   * running. Two reasons, and neither is the writer's single-flight rule:
   *   • a second `setDrafted` replaces the document a second time, clearing the undo
   *     history again — a double-click would discard more than the person chose to discard;
   *   • the token this adopts is about to be superseded by the outstanding write's
   *     response, so adopting it here would leave `tokenRef` holding the loser.
   * The guard is the FIRST thing in the function, before the read: a `listDraftWorkflows`
   * that is going to be thrown away is still a request.
   *
   * ── A FAILED EXIT IS NOT A FAILED WRITE (186-14, GAP-4 / CR-02) ──────────────────
   *
   * This docblock used to describe only the re-entrancy guard and the success path, and the
   * failure path it was silent about is where the loop lost its exits. `listDraftWorkflows`
   * throws on ANY non-2xx and on a dropped connection, the catch replaced the conflict with
   * `{kind:"error"}`, and the only surface that carries Reload and Overwrite renders on
   * `state.kind === "conflict" || resolving` — so one flaky request during one click on the
   * RECOMMENDED DEFAULT exit removed both controls from the DOM while `haltedRef` stayed set
   * for the rest of the session. Nothing could clear the halt after that: `saveNow` returns
   * at its halt check, the debounce effect schedules nothing, `dirty` stays true, and the
   * cause-neutral sentence invited a retry that had become structurally impossible.
   *
   * THE RULE, stated so it cannot be split again: the row still moved, so the loop is still
   * halted, so BOTH ways out must still be on screen. The catch therefore RESTORES the
   * conflict — the same shape the refusal produced, plus a note saying why the exit failed —
   * and mutates nothing else. `haltedRef`, `conflictTokenRef`, `tokenRef`, `pendingRef` and
   * `heldPendingRef` are all deliberately left exactly as they were, because a failed exit
   * changed nothing about the world. Clearing the halt here would "recover" the loop into
   * the silent clobber this phase exists to prevent.
   *
   * IT IS GUARDED ON `haltedRef`, and that guard is not decoration. A `reload()` that failed
   * while the loop was NOT halted keeps the cause-neutral line: claiming a conflict that did
   * not happen — telling a person their draft moved under them when nothing moved — is the
   * same class of lie in the other direction.
   */
  const reload = useCallback(async (): Promise<void> => {
    if (inFlightRef.current || reloadingRef.current) return
    reloadingRef.current = true
    setResolving(true)
    const id = draftIdRef.current
    try {
      const rows = id === null ? [] : await listDraftWorkflows()
      const row = rows.find((r) => r.id === id)
      if (!row || !row.definition) {
        // Deleted somewhere else, or never persisted. Land honestly, never silently — a
        // reload that quietly did nothing would look identical to one that worked.
        //
        // THE SAME SENTENCE THE WRITE PATH USES FOR THE SAME SITUATION (186-13). This is a
        // gone row discovered by a read instead of by a PATCH, and one situation reads one
        // way whichever path found it — the rule the two hold sentences already follow. The
        // catch below keeps the cause-neutral line, because a failed REQUEST is a different
        // thing from a row that is not there.
        setState({ kind: "error", sentence: DRAFT_GONE_SENTENCE })
        return
      }
      store.getState().setDrafted(row.definition as unknown as BuilderDefinition)
      tokenRef.current = row.token
      conflictTokenRef.current = null
      haltedRef.current = false
      heldPendingRef.current = false
      pendingRef.current = false
      setState({ kind: "idle" })
    } catch {
      // The exit failed, not the world. While the loop is still halted the conflict is
      // still the truth AND the only reading that carries the two ways out, so it is
      // restored rather than replaced — with a note, never a different sentence.
      if (haltedRef.current) {
        setState({
          kind: "conflict",
          currentToken: conflictTokenRef.current,
          note: RELOAD_FAILED_NOTE,
        })
      } else {
        setState({ kind: "error", sentence: SAVE_FAILED_SENTENCE })
      }
    } finally {
      reloadingRef.current = false
      setResolving(false)
    }
  }, [store])

  /**
   * The SECOND click (D-186-08). Adopts the token the refusal carried — the server's
   * disambiguating re-read already fetched it, so this costs ONE request and no extra round
   * trip — clears the halt, and re-enters the one writer rather than opening a second write
   * path (which is also why the receipt action still has exactly one caller).
   *
   * If that write is itself refused, the same catch puts the loop back into conflict with
   * the NEWER token, so an overwrite that lost a second race cannot silently do nothing.
   *
   * NEITHER EXIT IS EVER INVOKED FROM INSIDE THIS HOOK — no effect calls them, no catch
   * calls them. They are returned, and the person chooses.
   *
   * ── THE RE-ENTRANCY GUARD SITS ABOVE THE TOKEN ASSIGNMENT (186-12) ───────────────
   *
   * Order is the whole fix. Leaving the guard to `performWrite` alone would still let the
   * second click clobber `tokenRef` with the conflict token before the write was refused by
   * the writer's own check — a half-fix that swaps a duplicate request for a corrupted
   * token. Nothing is mutated until the exit is known to be takeable.
   */
  const overwrite = useCallback(async (): Promise<void> => {
    if (inFlightRef.current || reloadingRef.current) return
    reloadingRef.current = true
    setResolving(true)
    try {
      tokenRef.current = conflictTokenRef.current
      haltedRef.current = false
      await performWrite()
    } finally {
      reloadingRef.current = false
      setResolving(false)
    }
  }, [performWrite])

  return { state, draftId, resolving, saveNow, reload, overwrite }
}

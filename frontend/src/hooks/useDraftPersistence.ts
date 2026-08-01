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
 */
export const HOLD_PUBLISHING = "Publishing — changes will save when it finishes"

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
 *              opaque here exactly as everywhere else.
 *   error    — the write was attempted and refused. It carries no `ok` field BY
 *              CONSTRUCTION, so no path can turn a refusal into a clean reading.
 */
export type PersistState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  | { kind: "held"; sentence: string }
  | { kind: "conflict"; currentToken: string | null }
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
 * Which honest state a refused write lands in. THREE named branches — the stale token,
 * which is a conflict the person resolves; the 422, which is a cause they can act on; and
 * the published row, which has a way out the generic line cannot name — plus a genuine
 * catch-all. A 404, a dropped connection, a timeout and a refusal minted after this client
 * shipped all mean "we could not complete it", and none of them may borrow a specific
 * wording they did not earn.
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
  return { kind: "error", sentence: SAVE_FAILED_SENTENCE }
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

  // WRITES ARE SERIALIZED, NEVER CANCELLED, AND NEVER CONCURRENT.
  //
  // Three refs and one rule: at most one write is in flight; a newer edit that arrives
  // while one is in flight sets `pendingRef` rather than issuing a second request; the
  // completion adopts the token that write returned and, if the flag is set, issues
  // exactly ONE follow-up carrying that FRESH token.
  //
  // WHY NOT "just send both": two writes carrying the SAME token means one of them matches
  // 0 rows. The loser would raise a conflict banner for a conflict that never existed — the
  // person would be told their own draft moved under them while they typed.
  const inFlightRef = useRef(false)
  const pendingRef = useRef(false)
  const tokenRef = useRef<string | null>(initialToken)

  // D-186-08 — set the instant a stale-token refusal arrives, and cleared only by one of
  // the two exits the person chooses. While it is set this loop issues NOTHING: no timer
  // matures into a request, no follow-up drains, no explicit save goes through.
  // `conflictTokenRef` holds what the server said it has NOW, so Overwrite is one request.
  const haltedRef = useRef(false)
  const conflictTokenRef = useRef<string | null>(null)

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
   */
  const holdReason = useMemo<string | null>(() => {
    if (publishInFlight) return HOLD_PUBLISHING
    if (validationCause === "unreadable") return HOLD_UNREADABLE
    return null
  }, [publishInFlight, validationCause])

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
          }
          setState(refusal)
          break
        }

        // IS THIS CONFIRMED WRITE STILL THE TRUTH? Asked of WHAT WAS WRITTEN, never of a
        // queue flag (GAP-1 / CR-01). `pendingRef` is now ONE of three reasons a turn can be
        // superseded rather than the only one: it catches an edit whose own timer matured
        // while this request was outstanding, but an edit that landed mid-flight and is
        // still inside its 1000 ms debounce arms nothing at all, and that is the common
        // shape — type, pause about a second, resume. The store having moved on is the
        // property; the flag was only ever a proxy for it.
        const now = store.getState()
        const superseded =
          pendingRef.current || now.phases !== writtenPhases || now.meta !== writtenMeta

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
          continue
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
      if (inFlightRef.current) {
        pendingRef.current = true
        return
      }
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
   */
  useEffect(() => {
    const previous = holdRef.current
    holdRef.current = holdReason
    if (previous === null || holdReason !== null) return
    if (haltedRef.current) return
    if (!heldPendingRef.current && !store.getState().dirty) return
    heldPendingRef.current = false
    if (inFlightRef.current) {
      pendingRef.current = true
      return
    }
    // D-186-12 literally: edits accumulated as dirty, and EXACTLY ONE write flushes them.
    void performWrite()
  }, [holdReason, store, performWrite])

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
    if (inFlightRef.current) {
      pendingRef.current = true
      return false
    }
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
   */
  const reload = useCallback(async (): Promise<void> => {
    const id = draftIdRef.current
    try {
      const rows = id === null ? [] : await listDraftWorkflows()
      const row = rows.find((r) => r.id === id)
      if (!row || !row.definition) {
        // Deleted somewhere else, or never persisted. Land honestly, never silently — a
        // reload that quietly did nothing would look identical to one that worked.
        setState({ kind: "error", sentence: SAVE_FAILED_SENTENCE })
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
      setState({ kind: "error", sentence: SAVE_FAILED_SENTENCE })
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
   */
  const overwrite = useCallback(async (): Promise<void> => {
    tokenRef.current = conflictTokenRef.current
    haltedRef.current = false
    await performWrite()
  }, [performWrite])

  return { state, draftId, saveNow, reload, overwrite }
}

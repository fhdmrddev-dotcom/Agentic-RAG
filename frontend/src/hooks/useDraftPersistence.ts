/**
 * Phase 186-06 (CONCUR-01 / CONCUR-02 · D-186-01 · D-186-03 · D-186-05) — the
 * draft-persistence loop.
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
 * ── NEVER A FALSE RECEIPT (the T-185-04-01 lesson) ────────────────────────────────
 *
 * The store's receipt action has exactly ONE caller in this file and it sits on the
 * confirmed-write path with nothing newer queued. A refusal — of any kind — leaves the
 * draft dirty, so the leave guard still fires and the toolbar still reads unsaved.
 */
import { useCallback, useEffect, useRef, useState } from "react"

import {
  createWorkflowDraft,
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
 * Everything a refused write is told when this client cannot name the cause: a missing row,
 * a dropped connection, a timeout, a refusal minted after this client shipped.
 * Cause-neutral on purpose — a 404 or a dead network is a different thing from an
 * unreadable shape and must never be told it was one.
 */
export const SAVE_FAILED_SENTENCE = "Not saved — we couldn't complete the save"

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
 *   error   — the write was attempted and refused. It carries no `ok` field BY
 *             CONSTRUCTION, so no path can turn a refusal into a clean reading.
 */
export type PersistState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  | { kind: "error"; sentence: string }

export interface DraftPersistenceArgs {
  /** The page's existing `useMemo` — identity changes once per EDIT, not per render. */
  definition: BuilderDefinition | null
  /** Drafted and canvas-enabled. While false the hook issues NOTHING. */
  enabled: boolean
  initialDraftId: string | null
  initialToken: string | null
  store: BuilderStore
  onDraftCreated: (id: string) => void
}

export interface DraftPersistence {
  state: PersistState
  draftId: string | null
  /** The explicit Save-draft button (D-186-03). Resolves true on a confirmed write. */
  saveNow: () => Promise<boolean>
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
 * Which honest state a refused write lands in. A genuine catch-all: anything this client
 * cannot classify fails closed to the cause-neutral sentence rather than borrowing a
 * specific one it did not earn.
 *
 * Module-level and pure, so the write loop's closure cannot capture a stale copy of it.
 */
function refusalOf(err: unknown): Extract<PersistState, { kind: "error" }> {
  void nameOf(err)
  return { kind: "error", sentence: SAVE_FAILED_SENTENCE }
}

export function useDraftPersistence(args: DraftPersistenceArgs): DraftPersistence {
  const { definition, enabled, initialDraftId, initialToken, store, onDraftCreated } = args

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

  // The caller's callback, mirrored so the write loop can stay referentially stable.
  const onDraftCreatedRef = useRef(onDraftCreated)
  useEffect(() => {
    onDraftCreatedRef.current = onDraftCreated
  }, [onDraftCreated])

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
          setState(refusalOf(err))
          break
        }

        if (pendingRef.current) {
          // A newer edit landed mid-flight, so this confirmed write is already superseded
          // and no receipt may be filed for it — clearing `dirty` here would tell the
          // person their latest change is safe when it has not been sent.
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
   * so a per-beat value in these deps would restart this timer on every check beat and a
   * slow check would starve autosave entirely. Everything situational (the token, the draft
   * id, the in-flight flag) is read from a ref at FIRE time.
   *
   * `definition` is the CHANGE SIGNAL, not the payload: it is here for its identity, while
   * the bytes that get written are read from the store when the timer matures.
   */
  useEffect(() => {
    if (!enabled || definition === null) return

    const timer = setTimeout(() => {
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

  /** D-186-03 — the deliberate commit-now. It bypasses the debounce and the dirty gate (a
   *  person who presses Save means it), but never the single-flight rule. */
  const saveNow = useCallback(async (): Promise<boolean> => {
    if (inFlightRef.current) {
      pendingRef.current = true
      return false
    }
    return performWrite()
  }, [performWrite])

  return { state, draftId, saveNow }
}

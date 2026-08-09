/**
 * Phase 184-07 Task 1 (R3 · D-184-10 · sketch 138 winner "C-local") — canvasNudge.
 *
 * THE ONE HOME FOR THE COSMETIC VERTICAL NUDGE (`dy`), and the only module in the
 * canvas editing surface that touches browser storage at all.
 *
 * ── The C-local decision, recorded verbatim (sketch 138, operator 2026-07-26) ──
 * The winner was variant C ("spine order + a free vertical nudge"), taken in its
 * **C-local** form: *keep the interaction, move the storage.* The `dy` is a **per-user
 * view preference**, held in this browser — **never sent to the server, never written
 * into `definition`, and this phase adds ZERO migration files. Migration slot 114
 * (`workflow_layouts`) stays RESERVED, not spent.**
 *
 * Why that matters beyond saving a table:
 *   - A stale layout row pointing at a deleted step is **not representable**, because
 *     there is no row.
 *   - Phase 186 / CONCUR-01's requirement *"a cosmetic drag never mints a version"* is
 *     true **by construction** here rather than being a live code path someone has to
 *     defend. A nudge cannot mint a version because a nudge cannot reach the server.
 *   - The org-shared-workflow question ("if one editor nudges, does the other see it?")
 *     is never raised, because a view preference is not shared state.
 *
 * ── The written promotion trigger (so the door is provably open, not just claimed) ──
 * Promote `dy` into `workflow_layouts` — nullable, cosmetic-only, keyed by `phase_slug`,
 * migration slot 114 — when **either** a nudge must survive across devices, **or** a
 * layout is deliberately shared between editors. **Neither is true today.**
 *
 * ── Why this is a module of its own (D-184-02 + a shipped source guard) ──
 * Two independent reasons, both enforced by machine rather than by habit:
 *
 *  1. `WorkflowBuilderPage.canvas.test.tsx:414-418` is a SHIPPED guard asserting the
 *     Builder page's source names no browser-storage API at all (D-183-02 — the page
 *     persists no view preference). So the page passes a `draftId` in and this module
 *     owns every read and write.
 *  2. D-184-02: the `dy` must never enter the tracked builder store, so R4's *"a nudge
 *     adds no history entry"* is true structurally. This module therefore imports
 *     neither the builder store nor the canvas model nor the API client — the offset
 *     has no path into the definition JSONB or an outgoing request body even by
 *     accident. `canvasNudge.test.ts` pins all three with a source fence carrying
 *     positive controls, plus a whole-suite request spy that records zero calls.
 *
 * ── Why the key is scoped per USER as well as per draft ──
 * Structural analog: `lib/streamsCache.ts:29-44`, whose own docblock states the reason
 * this module inherits — a shared origin (a dev machine with two test logins, a kiosk,
 * a family device) must not leak one user's state into another's first paint. A `dy` is
 * cosmetic and low-value, but keying it per user costs nothing, so it is keyed per user.
 * `getCurrentUserIdSync()` is REUSED from that module rather than re-derived; a second
 * copy of the auth-token read is exactly the fork the G-5 discipline retires.
 *
 * Resolved key shape: `agentic-rag.canvas-nudge.v1.<user_id>.<draft_id>`.
 *
 * ── The unsaved-draft rule (184-CONTEXT "Claude's Discretion", implemented literally) ──
 * A draft that has never been saved has **no id**. Its nudges live in a module-level
 * in-memory bucket for the session only and **persist nothing** — so there is no
 * orphan-key bucket to garbage-collect and no key to reconcile when the draft is
 * finally saved (or abandoned). The same fallback applies when no user id resolves:
 * without one, the only available key would be unscoped, which is precisely the leak
 * the paragraph above exists to prevent.
 *
 * Nothing about that bucket is durable. It does not survive a reload, and it is cleared
 * when the module's owner unmounts — the canvas owner calls `clearNudges(null)` on
 * teardown, which is the same call "Tidy up" makes for an unsaved draft.
 *
 * ACCEPTED, RECORDED BEHAVIOUR (not a defect, and deliberately not "fixed"): nudges
 * made before a draft's first save are NOT migrated into the newly-minted key. Doing so
 * would mean a write path that invents durable state out of session state for a
 * vertical offset on a workflow of at most five steps. The cost of the honest version
 * is that the card returns to its lane after the first save.
 *
 * TOTALITY / degrade contract: every exported function is total. Private mode, a
 * missing `window`, a corrupt entry, a non-numeric value and an exhausted quota each
 * resolve honestly and NEVER throw. A cosmetic layer must not be able to crash the
 * authoring surface.
 */
import { getCurrentUserIdSync } from "@/lib/streamsCache"

/**
 * The key namespace, in the `streamsCache.ts:38` shape. `v1` is the shape version: a
 * future change to the stored value must bump it rather than reinterpret old entries.
 */
export const CANVAS_NUDGE_KEY_PREFIX = "agentic-rag.canvas-nudge.v1" as const

/** slug → cosmetic vertical offset in canvas pixels. Absent slug = no nudge. */
export type NudgeMap = Record<string, number>

/**
 * Build the user + draft scoped key. Both parts are REQUIRED and non-empty — a caller
 * with either half missing gets the in-memory bucket instead of an unscoped key.
 */
export function canvasNudgeKey(userId: string, draftId: string): string {
  return `${CANVAS_NUDGE_KEY_PREFIX}.${userId}.${draftId}`
}

/**
 * The session-only bucket for a draft with no id (or a session with no user id).
 * Module-level and deliberately NOT exported: the only ways in and out are the three
 * functions below, so "the nudge map" has exactly one shape wherever it is read.
 */
let sessionBucket: NudgeMap = {}

/**
 * Resolve the durable key, or `null` when this nudge must stay in memory.
 * `null` is returned for a draft with no id AND for a session with no resolvable user.
 */
function resolveKey(draftId: string | null): string | null {
  if (typeof draftId !== "string" || draftId.length === 0) return null
  const userId = getCurrentUserIdSync()
  if (userId === null || userId.length === 0) return null
  return canvasNudgeKey(userId, draftId)
}

/**
 * Coerce an arbitrary parsed value into a `NudgeMap`, dropping anything that is not a
 * finite number. The stored entry is author-adjacent data that survives reloads and
 * hand-edits, so it is treated as untrusted on the way in.
 */
function sanitize(parsed: unknown): NudgeMap {
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {}
  const out: NudgeMap = {}
  for (const [slug, dy] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof dy === "number" && Number.isFinite(dy)) out[slug] = dy
  }
  return out
}

/**
 * Read the slug → `dy` map for a draft.
 *
 * Defensive read in the `useResizablePanel.ts:67-76` shape: try/catch around the
 * storage read, a JSON parse guard, a finite check per value, and `{}` on ANY failure
 * (private mode, SSR, a corrupt entry, a hand-edited value). A missing entry and a
 * broken entry are the same answer — "no nudges" — because there is nothing else
 * honest to say about a cosmetic offset.
 *
 * Returns a fresh object every call; the in-memory bucket is copied out, never aliased.
 */
export function readNudges(draftId: string | null): NudgeMap {
  const key = resolveKey(draftId)
  if (key === null) return { ...sessionBucket }
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return {}
    return sanitize(JSON.parse(raw) as unknown)
  } catch {
    /* storage unavailable / corrupt entry — the cosmetic layer degrades to "no nudges" */
    return {}
  }
}

/**
 * Merge ONE entry into a draft's map.
 *
 * Quota discipline per `streamsCache.ts:19-22`: the write is wrapped, and an exhausted
 * quota (iOS Safari private mode is the named case) produces a `console.warn` and falls
 * through silently. `streamsCache`'s evict-half-and-retry is deliberately NOT copied —
 * that policy exists because chat scrollback is large; a map of at most five numbers is
 * not what filled the quota, and evicting another feature's data to store an offset
 * would be the wrong trade.
 *
 * A non-finite `dy` or an empty slug is ignored rather than stored: `readNudges` would
 * drop it on the way back out anyway, and writing a value that can never be read is how
 * a store starts lying about what it holds.
 */
export function writeNudge(draftId: string | null, slug: string, dy: number): void {
  if (typeof slug !== "string" || slug.length === 0) return
  if (typeof dy !== "number" || !Number.isFinite(dy)) return

  const key = resolveKey(draftId)
  if (key === null) {
    sessionBucket = { ...sessionBucket, [slug]: dy }
    return
  }

  const next: NudgeMap = { ...readNudges(draftId), [slug]: dy }
  try {
    window.localStorage.setItem(key, JSON.stringify(next))
  } catch (err) {
    // Silent degrade, never a crash: the card keeps its nudge for this session in the
    // live view; only the durable half is lost.
    console.warn("[canvasNudge] could not persist the layout nudge", err)
  }
}

/**
 * "Tidy up" — drop every nudge for THIS workflow.
 *
 * Clears **the current workflow's key only**. Never the whole prefix, never another
 * draft's key, never another user's key: "tidy up this canvas" is a statement about one
 * document, and a helpful sweep of the neighbours is a surprise, not a feature.
 *
 * With no draft id (or no user id) this clears the session bucket — the same document,
 * just the non-durable half of it.
 */
export function clearNudges(draftId: string | null): void {
  const key = resolveKey(draftId)
  if (key === null) {
    sessionBucket = {}
    return
  }
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* storage unavailable — there is nothing durable to clear */
  }
}

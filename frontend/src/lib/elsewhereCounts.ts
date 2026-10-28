/**
 * Phase 298-05 (ORG-06 / D-16 / D-21 / UI-D19) — the org-items client state: the elsewhere counts,
 * the lists' move version, and the one open move.
 *
 * 1. ELSEWHERE COUNTS. One `GET /org-items/elsewhere` per active org feeds every mount: the first
 *    `useElsewhereCounts(org)` asks, every other mount under the same org reads the same answer, so
 *    four lists cost one request. A switch asks again. The answer is tagged with the `X-Org-Id`
 *    header its request was SENT under (`getActiveOrgId()`, the 298-04 rule) and is kept only while
 *    that tag is the org asked for and no later request has been made — so an answer for another
 *    org never writes. A failed read is held as `failed`, which renders NOTHING (UI-D6), never a 0.
 * 2. THE MOVE VERSION. `noteMoved({kind, id})` is called once, on the server's 200 for a move. It
 *    bumps `version` (each list hook keeps it in its load-effect deps, so the list refetches and the
 *    item leaves only on that answer — never optimistically), records `lastMoved` (the Library
 *    resets a selection that moved), and refetches the counts at the same time.
 * 3. THE OPEN MOVE. A row's "Move to <org>…" lives in a dropdown menu, and a menu's content
 *    UNMOUNTS when it closes — a sheet rendered inside it would die the moment it opened. So the
 *    menu item only writes the request here, and the sheet is rendered by a host that outlives the
 *    menu (`MoveToOrgSheetHost`, mounted by the list's own `ElsewhereLine`). The request is tagged
 *    with the org it was opened in, so a switch closes it (UI-D10).
 *
 * ⚠ WHY THE CLIENT IS IMPORTED LAZILY, AND WHY THIS MODULE TAKES THE ORG AS AN ARGUMENT.
 * `setupTests.ts` imports this module to register `resetElsewhereCounts`, and a module a setup file
 * imports is cached before any test file's `vi.mock` is registered (measured 2026-10-20 at
 * `citationCheckStore.ts`). A static import of `lib/api/orgItems` (→ `_core` → Supabase) or of
 * `OrgProvider` (→ the `@/lib/api` barrel) here would silently hand every suite that mocks those the
 * real module. So the client and the header seam are loaded on first use, and the active org is
 * passed in by the caller (`ElsewhereLine` reads it from `useOrgOptional`).
 *
 * ⚠ STABLE REFERENCES: every selector returns a module constant when there is nothing to show, so
 * zustand v5 selectors cannot loop.
 */
import { useEffect } from "react"
import { create } from "zustand"
import type { ElsewhereOrgCounts } from "@/lib/api/orgItems"
import type { OrgMembership } from "@/lib/api/admin"

export type ElsewhereStatus = "loading" | "ready" | "failed"

export interface ElsewhereCountsView {
  status: ElsewhereStatus
  orgs: ElsewhereOrgCounts[]
}

export type MovedKind = "folder" | "document" | "draft"

export interface LastMoved {
  kind: MovedKind
  id: string
  /** A folder move whose subtree held the Library's selected folder (the Library returns to Root). */
  holdsSelection?: boolean
  /** Equals the version this move produced, so two moves of the same item read as two moves. */
  seq: number
}

/** The open move a row menu asked for (rendered by `MoveToOrgSheetHost`). */
export interface MoveSheetRequest {
  kind: "folder" | "draft"
  itemId: string
  itemName: string
  /** The orgs it may move to (never the active one), ordered by name. One = straight to the preview. */
  targets: OrgMembership[]
  /** The active org when it was opened; a switch closes the sheet. */
  openedIn: string | null
  holdsSelection?: boolean
}

interface OrgItemsState {
  /** The active org the held counts answer is for (null = nothing asked). */
  key: string | null
  status: ElsewhereStatus
  orgs: ElsewhereOrgCounts[]
  version: number
  lastMoved: LastMoved | null
  moveRequest: MoveSheetRequest | null
}

const NO_ORGS: ElsewhereOrgCounts[] = []

const INITIAL: OrgItemsState = {
  key: null,
  status: "loading",
  orgs: NO_ORGS,
  version: 0,
  lastMoved: null,
  moveRequest: null,
}

export const useOrgItemsStore = create<OrgItemsState>()(() => ({ ...INITIAL }))

const loadClient = () => Promise.all([import("@/lib/api/orgItems"), import("@/lib/api/_core")])

/** Latest-wins: only the newest request may write. Bumped by every ask and by reset. */
let reqId = 0

/**
 * Ask for `key`'s counts. `refresh` keeps the last answer on screen while asking (after a move);
 * a first ask under a new org drops the old one at once (it is another org's numbers).
 */
function ask(key: string, refresh: boolean): void {
  const my = ++reqId
  if (!refresh) useOrgItemsStore.setState({ key, status: "loading", orgs: NO_ORGS })
  void loadClient()
    .then(async ([client, core]) => {
      const sentUnder = core.getActiveOrgId()
      const orgs = await client.getElsewhereCounts()
      if (my !== reqId || useOrgItemsStore.getState().key !== key) return
      // The request carried another org's header: its numbers are not this org's. Leave the line
      // absent (loading) rather than paint them; the next switch or move asks again.
      if (sentUnder !== key) return
      useOrgItemsStore.setState({ status: "ready", orgs })
    })
    .catch((err: unknown) => {
      if (my !== reqId || useOrgItemsStore.getState().key !== key) return
      console.warn("Couldn't count your items in your other organizations:", err)
      useOrgItemsStore.setState({ status: "failed", orgs: NO_ORGS })
    })
}

/** Make sure `key`'s counts are asked for — once, however many mounts call this. */
export function ensureElsewhereCounts(key: string): void {
  if (useOrgItemsStore.getState().key === key) return
  ask(key, false)
}

/** Ask again for the active org's counts (after a move), keeping the last answer meanwhile. */
export function invalidateElsewhereCounts(): void {
  const { key } = useOrgItemsStore.getState()
  if (key !== null) ask(key, true)
}

/**
 * The counts for `activeOrgId`. `enabled` is false for a solo user (nothing elsewhere to count).
 * With no org or disabled: `ready` with no rows, and nothing is asked.
 */
export function useElsewhereCounts(activeOrgId: string | null, enabled = true): ElsewhereCountsView {
  const key = enabled ? activeOrgId : null
  useEffect(() => {
    if (key !== null) ensureElsewhereCounts(key)
  }, [key])
  const status = useOrgItemsStore((s) => (key === null ? "ready" : s.key === key ? s.status : "loading"))
  const orgs = useOrgItemsStore((s) => (key !== null && s.key === key ? s.orgs : NO_ORGS))
  return { status, orgs }
}

/** Called once on a move's 200: the lists refetch, the counts refetch, the selection may reset. */
export function noteMoved(moved: Omit<LastMoved, "seq">): void {
  const version = useOrgItemsStore.getState().version + 1
  useOrgItemsStore.setState({ version, lastMoved: { ...moved, seq: version } })
  invalidateElsewhereCounts()
}

/** The lists' move version: a list hook keeps it in its load-effect deps. */
export function useOrgItemsVersion(): number {
  return useOrgItemsStore((s) => s.version)
}

/** The last move (null before any). */
export function useLastMoved(): LastMoved | null {
  return useOrgItemsStore((s) => s.lastMoved)
}

/** A row menu asks for the move sheet. */
export function openMoveSheet(request: MoveSheetRequest): void {
  useOrgItemsStore.setState({ moveRequest: request })
}

export function closeMoveSheet(): void {
  useOrgItemsStore.setState({ moveRequest: null })
}

export function useMoveSheetRequest(): MoveSheetRequest | null {
  return useOrgItemsStore((s) => s.moveRequest)
}

/** Empty everything (counts, version, last move, open move). Called by setupTests.ts. */
export function resetElsewhereCounts(): void {
  reqId += 1
  useOrgItemsStore.setState({ ...INITIAL })
}

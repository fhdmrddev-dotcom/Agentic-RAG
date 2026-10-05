/**
 * Phase 274 plan 04 (D-11 / D-13 / D-15 / D-25 / T-274-26) — THE LIBRARY-LINKS STORE, one per thread.
 *
 * Every sent chip and the panel's Files row ask the same question: *is this attachment also in the
 * Library, where, and is it searchable yet?* 274-02 answers it for a whole thread in ONE request
 * (`GET .../library-links`). This module makes sure it is asked once:
 *
 *   · A module-scoped `Map<threadId, Entry>` read through `useSyncExternalStore`. The FIRST
 *     subscriber for a thread fetches the links and the folder list together; every later chip on
 *     that thread reads the same entry. ⛔ One request per tick per thread, however many chips mount.
 *   · ⛔ A FETCH, NEVER REALTIME (D-v2.5-03): Realtime is a best-effort hint and is not read here.
 *   · ⛔ THE POLL IS BOUNDED (T-274-26). An interval of `INDEXING_POLL_MS` exists only while some
 *     link's document is `pending | processing | paused`; it is cleared the moment none is, or when
 *     the last subscriber for the thread leaves. A `failed` document is terminal too, so the
 *     segment says `couldn't index` instead of `indexing…` forever (D-25).
 *   · A missed poll is a missed hint, not an error: a rejected fetch keeps the previous state and
 *     the next tick reconciles (the `ExpertCatalogPage` poll's rule).
 *   · `refreshLibraryLinks(threadId)` is called after a promote, so the mark appears without
 *     waiting for a tick.
 *
 * ⛔ A folder this person cannot see is absent from `listFolders()`, so its `leaf`/`path` are null
 * and no name is invented (T-274-25). Paths are spelled with the sketch's ` › ` (`folderDisplay`).
 *
 * ⚠ BEFORE THE FIRST ANSWER, `promotable` reads `true`: the store makes no refusal it has not been
 * told. The dialog's preview and the minter remain the authority on what may be saved.
 */
import { useCallback, useSyncExternalStore } from "react"
import { getLibraryLinks, type AttachmentLibraryState, type LibraryLinkInfo } from "@/lib/api/attachments"
import { listFolders } from "@/lib/api/documents"
import type { Folder } from "@/types"
import { folderPathParts, FOLDER_PATH_SEPARATOR } from "./folderDisplay"

/** How often a thread with an indexing document re-asks. */
export const INDEXING_POLL_MS = 4000

/** Document states that are not yet searchable (and not failed). */
const INDEXING = new Set(["pending", "processing", "paused"])

interface Snapshot {
  files: ReadonlyMap<string, AttachmentLibraryState>
  folders: readonly Folder[]
}

interface Entry {
  snapshot: Snapshot
  foldersLoaded: boolean
  listeners: Set<() => void>
  timer: ReturnType<typeof setInterval> | null
  inflight: Promise<void> | null
}

const EMPTY: Snapshot = { files: new Map(), folders: [] }
const store = new Map<string, Entry>()

function entryFor(threadId: string): Entry {
  let e = store.get(threadId)
  if (!e) {
    e = { snapshot: EMPTY, foldersLoaded: false, listeners: new Set(), timer: null, inflight: null }
    store.set(threadId, e)
  }
  return e
}

function emit(e: Entry) {
  for (const l of e.listeners) l()
}

function anyIndexing(s: Snapshot): boolean {
  for (const f of s.files.values()) {
    if (f.link && INDEXING.has(f.link.document_status)) return true
  }
  return false
}

/** Start or stop the bounded poll to match the entry's current state. */
function syncTimer(threadId: string, e: Entry) {
  const want = e.listeners.size > 0 && anyIndexing(e.snapshot)
  if (want && !e.timer) {
    e.timer = setInterval(() => {
      void load(threadId, false)
    }, INDEXING_POLL_MS)
  } else if (!want && e.timer) {
    clearInterval(e.timer)
    e.timer = null
  }
}

/** One fetch for a thread (deduplicated while in flight). Folders only until they have loaded. */
function load(threadId: string, withFolders: boolean): Promise<void> {
  const e = entryFor(threadId)
  if (e.inflight) return e.inflight
  const wantFolders = withFolders || !e.foldersLoaded
  const run = async () => {
    const [linksRes, foldersRes] = await Promise.allSettled([
      getLibraryLinks(threadId),
      wantFolders ? listFolders() : Promise.resolve(null),
    ])
    // The thread may have been reset (tests) or replaced while this was in flight.
    if (store.get(threadId) !== e) return
    let next = e.snapshot
    if (linksRes.status === "fulfilled") {
      const files = new Map<string, AttachmentLibraryState>()
      for (const f of linksRes.value.files ?? []) files.set(f.workspace_file_id, f)
      next = { ...next, files }
    }
    if (foldersRes.status === "fulfilled" && foldersRes.value) {
      next = { ...next, folders: foldersRes.value }
      e.foldersLoaded = true
    }
    if (next !== e.snapshot) {
      e.snapshot = next
      emit(e)
    }
    syncTimer(threadId, e)
  }
  e.inflight = run().finally(() => {
    e.inflight = null
  })
  return e.inflight
}

function subscribe(threadId: string, listener: () => void): () => void {
  const e = entryFor(threadId)
  const first = e.listeners.size === 0
  e.listeners.add(listener)
  // The first reader of a thread asks (again, on a re-mount: the cached answer may be stale).
  if (first) void load(threadId, true)
  return () => {
    e.listeners.delete(listener)
    syncTimer(threadId, e)
  }
}

/** Ask the server again for this thread's marks (after a promote). Safe for a thread nobody reads. */
export function refreshLibraryLinks(threadId: string): void {
  const e = store.get(threadId)
  if (!e) return
  // A fetch already in flight started BEFORE the promote, so its answer may predate the new link:
  // ask once more after it rather than riding on it.
  if (e.inflight) void e.inflight.then(() => load(threadId, false))
  else void load(threadId, false)
}

export interface AttachmentLinkState {
  promotable: boolean
  link: LibraryLinkInfo | null
  /** The folder's own name, or null when the folder is not visible to this person. */
  leaf: string | null
  /** The full path, ` › `-joined, or null when the folder is not visible. */
  path: string | null
}

const UNKNOWN: AttachmentLinkState = { promotable: true, link: null, leaf: null, path: null }

const noopSubscribe = () => () => {}
const emptySnapshot = () => EMPTY

export function useLibraryLinks(threadId: string | null): {
  stateFor: (fileId: string | undefined) => AttachmentLinkState
} {
  const sub = useCallback(
    (listener: () => void) => (threadId ? subscribe(threadId, listener) : noopSubscribe()),
    [threadId],
  )
  const get = useCallback(() => (threadId ? (store.get(threadId)?.snapshot ?? EMPTY) : EMPTY), [threadId])
  const snap = useSyncExternalStore(threadId ? sub : noopSubscribe, threadId ? get : emptySnapshot)

  const stateFor = useCallback(
    (fileId: string | undefined): AttachmentLinkState => {
      if (!fileId) return UNKNOWN
      const f = snap.files.get(fileId)
      if (!f) return UNKNOWN
      const parts = f.link ? folderPathParts(f.link.folder_id, snap.folders) : null
      return {
        promotable: f.promotable,
        link: f.link,
        leaf: parts ? parts[parts.length - 1] : null,
        path: parts ? parts.join(FOLDER_PATH_SEPARATOR) : null,
      }
    },
    [snap],
  )
  return { stateFor }
}

/** Test-only: drop every thread's entry and its interval. */
export function _resetLibraryLinksForTest(): void {
  for (const e of store.values()) {
    if (e.timer) clearInterval(e.timer)
  }
  store.clear()
}

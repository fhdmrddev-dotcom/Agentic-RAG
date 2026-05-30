/**
 * Phase 088-05 (D-16) — reconcile-if-missing-id guard for the workspace panel.
 *
 * The id-keyed workspace endpoints (GET /files/{id}/content · /versions · /diff —
 * workspace.py:124/202/238) 404 on an empty id segment (`/files//content`). In
 * the live (no-refresh) flow a freshly-written file *should* now arrive with its
 * `id` on the workspace_file_written SSE (Part A), but this hook is the defensive
 * backstop: if the selected file has no `id` (a legacy/replayed event, or a race),
 * resolve it ONCE via the GET listing (which always carries ids — workspace.py:99)
 * by matching on `path`, then hand the real id to the content/versions/diff fetch.
 *
 * Returns a discriminated status so callers can tell the three cases apart (an
 * id-less `null` cannot distinguish "still resolving" from "no match"):
 *   { status: "ready",      id }   → fetch by `id` (never empty → no `/files//…` 404)
 *   { status: "resolving",  id: null } → hold the spinner; a GET lookup is in flight
 *   { status: "unresolved", id: null } → no listing row matched the path / lookup
 *                                         failed → caller shows its graceful fallback
 *
 * The lookup is aborted on thread/path/file-change to avoid cross-thread bleed.
 */
import { useEffect, useState } from "react"
import { getThreadWorkspaceFiles } from "@/lib/api"
import type { WorkspaceFile } from "@/types"

export type ResolvedFileId =
  | { status: "ready"; id: string }
  | { status: "resolving"; id: null }
  | { status: "unresolved"; id: null }

export function useResolvedFileId(
  threadId: string,
  file: WorkspaceFile,
): ResolvedFileId {
  const [state, setState] = useState<ResolvedFileId>(
    // Seed from the file's own id (the happy path — SSE/GET both carry it now).
    file.id ? { status: "ready", id: file.id } : { status: "resolving", id: null },
  )

  useEffect(() => {
    // Already have a usable id → nothing to reconcile.
    if (file.id) {
      setState({ status: "ready", id: file.id })
      return
    }

    // No id on the selected file → backfill it from the GET listing by path.
    setState({ status: "resolving", id: null })
    const controller = new AbortController()
    let active = true
    getThreadWorkspaceFiles(threadId, controller.signal)
      .then((files) => {
        if (!active) return
        const match = files.find((f) => f.path === file.path)
        setState(
          match?.id
            ? { status: "ready", id: match.id }
            : { status: "unresolved", id: null },
        )
      })
      .catch((err: unknown) => {
        // Abort is expected on fast file/thread switches — keep "resolving" so the
        // caller doesn't flash a fallback for a fetch that was deliberately cancelled.
        if (!active) return
        if ((err as { name?: string })?.name === "AbortError") return
        setState({ status: "unresolved", id: null })
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [threadId, file.id, file.path])

  return state
}

/**
 * Phase 302 plan 01 (FIX-01 / BUG-261027-01) — the thread's GENERATED files, for the panel.
 *
 * MEASURED CAUSE (302-RESEARCH F1): a sandbox output never enters `workspace_files`. It lives in
 * the sandbox-outputs bucket and on the thread's messages as `finalOutputFiles`, and the panel
 * read only `workspace_files` — so a thread that produced files showed "No files yet."
 *
 * The fix is read-side (D-22): this pure fold turns the messages the chat already holds into the
 * panel's list. It reads `finalOutputFiles` only — `lib/api/threads.ts` already rebuilt that field
 * from the persisted tool calls on reload, so nothing here parses them a second time.
 *
 * UI-D3: one row per file NAME, latest turn wins (the chat keeps the per-turn story and its
 * "Replaces:" line; the panel shows what exists now). A name the workspace already lists is
 * listed once, as the workspace row, because that row can also preview and show versions.
 */
import type { Message, WorkspaceFile } from "@/types"

/** UI-D14 — the group label and its accessible name. `MessageItem.tsx`'s identical literal is
 *  left alone (hot file); sharing it is noted for that file's next extraction. */
export const GENERATED_FILES_LABEL = "Generated files"

export interface GeneratedFile {
  filename: string
  url?: string
  size?: number
  /** The producing message's `created_at`; null when the message carries no instant. */
  producedAt: string | null
}

const EMPTY: readonly GeneratedFile[] = Object.freeze([])

function inWorkspace(filename: string, workspace: readonly WorkspaceFile[]): boolean {
  for (const f of workspace) {
    if (f.path === filename || f.path.endsWith("/" + filename)) return true
  }
  return false
}

export function deriveGeneratedFiles(
  messages: readonly Message[],
  workspace: readonly WorkspaceFile[],
): readonly GeneratedFile[] {
  const seen = new Set<string>()
  const out: GeneratedFile[] = []
  // The chat bucket is chronological, so walking it backwards is newest turn first.
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    const files = m.finalOutputFiles
    if (!files || files.length === 0) continue
    for (const f of files) {
      if (seen.has(f.filename)) continue
      seen.add(f.filename)
      if (inWorkspace(f.filename, workspace)) continue
      out.push({ filename: f.filename, url: f.url, size: f.size, producedAt: m.created_at || null })
    }
  }
  return out.length === 0 ? EMPTY : out
}

/**
 * Phase 302 plan 01 (FIX-01 / BUG-261027-01, D-02 / D-22) — every file a thread has, for the panel.
 *
 * `workspace` is the thread's `workspace_files` rows (unchanged); `generated` is the thread's
 * sandbox outputs, folded from the SAME source the chat's "Generated files" list reads — the
 * chat's own message bucket (surface "chat"), the precedent `useDerivedPanel` set.
 * Nothing is fetched and nothing is written: this is a read-side fix (D-22).
 *
 * `count` is the one number the panel shows in all three places (UI-D6): `hasActivity`, the
 * FILES section count and the rail badge.
 */
import { useMemo } from "react"
import { useThreadMessages, useWorkspaceFiles } from "@/providers/StreamsProvider"
import type { WorkspaceFile } from "@/types"
import { deriveGeneratedFiles, type GeneratedFile } from "./generatedFiles"

export interface ThreadFiles {
  workspace: WorkspaceFile[]
  generated: readonly GeneratedFile[]
  count: number
}

export function useThreadFiles(threadId: string | null): ThreadFiles {
  const { data: workspace } = useWorkspaceFiles(threadId)
  const messages = useThreadMessages(threadId, "chat")
  const generated = useMemo(() => deriveGeneratedFiles(messages, workspace), [messages, workspace])
  return { workspace, generated, count: workspace.length + generated.length }
}

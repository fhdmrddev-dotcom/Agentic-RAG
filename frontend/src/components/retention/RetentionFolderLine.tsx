/**
 * Phase 275 plan 04 (S7 / D-17 / D-23) — the line under `FolderDetail` naming the selected
 * folder's policy and/or hold.
 *
 * Renders ONLY when the folder has a policy (its own, or inherited from the nearest ancestor —
 * D-23) or a hold. An admin's hold line names the matter; a member's never does (D-17) — and the
 * server sends a member no `hold_names` at all, so there is nothing here to leak.
 *
 * ⛔ PURE FUNCTION OF PROPS: no fetch (planning flag 2). `LibraryPage`'s `useRetentionStates` owns
 * the one batched read and passes the folder's state down.
 */
import { Pause } from "lucide-react"

import type { RetentionFolderState } from "@/lib/api/retention"
import { RETENTION_ACTION_META, RetentionChip, RichCopy } from "./RetentionChip"
import { RETENTION_COPY, fillCopy } from "./retentionCopy"

const C = RETENTION_COPY

export function RetentionFolderLine({
  state,
  canManage,
}: {
  state?: RetentionFolderState | null
  canManage: boolean
}) {
  if (!state) return null
  const policy = state.policy ?? null
  if (!policy && !state.held) return null
  const tag = policy ? RETENTION_ACTION_META[policy.action] ?? RETENTION_ACTION_META.review : null
  const matter = state.hold_names && state.hold_names.length > 0 ? state.hold_names[0] : null

  return (
    <div
      data-testid="retention-folder-line"
      className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-4 py-2 text-xs text-muted-foreground"
    >
      {policy && tag && (
        <>
          <RetentionChip tone={tag.tone} icon={tag.icon}>
            {tag.label}
          </RetentionChip>
          <span>
            <RichCopy text={fillCopy(C.sketchTemplates.folderPolicy, { kept_for: policy.kept_for_text, then: tag.then })} />
            {policy.kind === "inherited" &&
              fillCopy(C.specTemplates.folderInherited, {
                policy: policy.policy_name,
                path: policy.from_folder_path ?? "",
              })}
          </span>
        </>
      )}
      {state.held && (
        <>
          <RetentionChip tone="hold" icon={Pause}>
            {C.ported.chipOnHold}
          </RetentionChip>
          <span className="text-[hsl(32_90%_30%)] dark:text-warning">
            {canManage && matter ? fillCopy(C.specTemplates.folderHoldAdmin, { matter }) : C.contract.folderHoldMember}
          </span>
        </>
      )}
    </div>
  )
}

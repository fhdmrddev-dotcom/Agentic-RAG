/**
 * Phase 274 (D-05 / D-27) — ONE RULE, MANY READERS.
 *
 * A chat attachment is read by the composer chip, the transcript chip, the panel's Files row and
 * the Save-to-Library dialog. Each needs the same two answers, and each used to be free to derive
 * its own:
 *
 *   1. **What is this file called?** The server stores an upload as `<8 lowercase hex>-<name>` so
 *      two uploads of the same name cannot collide. A person never typed that prefix and must not
 *      read it. The backend's `library_filename` strips the SAME prefix before the Library sees
 *      the name (D-27), so `WORKSPACE_UPLOAD_PREFIX` is exported as the regex itself — 274-05
 *      fences the two in lockstep. ⛔ Never re-type the pattern elsewhere; import it.
 *   2. **Does it live with its thread?** `expires_at: null` on a `template_input` row means the
 *      file lives as long as its chat (D-05). An ABSENT `expires_at` means the wire did not say,
 *      which is NOT the same fact and must not be read as thread-life.
 *
 * The chip and the panel import these; nothing re-derives them.
 */
import type { WorkspaceFile } from "@/types"

/** The stored upload prefix: eight LOWERCASE hex digits and a dash, at the start of the name. */
export const WORKSPACE_UPLOAD_PREFIX = /^[0-9a-f]{8}-/

/** The name a person reads: the last path segment, upload prefix stripped, never empty. */
export function attachmentDisplayName(file: Pick<WorkspaceFile, "path">): string {
  const segments = file.path.split("/")
  const base = segments[segments.length - 1] || file.path
  const stripped = base.replace(WORKSPACE_UPLOAD_PREFIX, "")
  return stripped || base
}

/** True exactly when the row is a chat attachment that lives with its thread (D-05). */
export function isThreadLifeAttachment(file: Pick<WorkspaceFile, "kind" | "expires_at">): boolean {
  return file.kind === "template_input" && file.expires_at === null
}

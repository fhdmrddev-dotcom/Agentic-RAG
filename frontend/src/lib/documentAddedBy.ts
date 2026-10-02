/**
 * Phase 271-03 (FIND-01 / T-271-11) — the ONE home of "Added by" and of the "not recorded"
 * wording.
 *
 * MOVED verbatim out of `components/metadata/DocumentFileFacts.tsx` (Phase 270), where it was
 * module-private. The detail panel's File section and the Find result list's Added-by column
 * both import it from here, so the two can never disagree about who added a document — and
 * neither can ever show an email (270 P-02).
 */
import type { Document } from "@/types"

/** The wording for a fact the system does not hold (270 D-09/D-10): never 0, never a
 *  substituted value. */
export const NOT_RECORDED = "not recorded"

export function addedBy(doc: Document, currentUserId?: string): string {
  // A connected source owns its documents under the user who connected it, so the connection is
  // tested FIRST: otherwise every connector-placed file reads "You" beside a banner saying a
  // connected source placed it (270 UAT G4-4a).
  if (doc.source_connection_id) {
    return doc.source_connection_name
      ? `${doc.source_connection_name} (connected source)`
      : "a connected source"
  }
  if (currentUserId && doc.user_id === currentUserId) return "You"
  return "name not available"
}

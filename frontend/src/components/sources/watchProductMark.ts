/**
 * Phase 240 — which PRODUCT a watched folder belongs to, so the row can wear its mark.
 *
 * ⛔ WHY THIS IS NOT `service_id`, AND WHY THAT MATTERS HERE MORE THAN ANYWHERE ELSE.
 * Gmail and Drive are the SAME connection in this product — one Google row, one token, one
 * consent, one place to revoke (`oauth_service.py`, BUS-037 §B). So `service_id` is `"google"`
 * for both, and a row keyed on it would draw the SAME mark on a mail watch and a Drive watch.
 * That is precisely the ambiguity the operator reported.
 *
 * ⭐ The folder ID already carries the answer with certainty: a mail folder is addressed
 * `mailbox:<label>`, a Drive folder is not. **Read the address, never the vendor name.**
 *
 * ⚠ THIS PROJECT HAS PAID FOR THE ALTERNATIVE. `import_service.fetch_cloud_file` once picked an
 * adapter when `"google"` appeared in a connection's DISPLAY NAME, so a Microsoft connection
 * someone had typed "Google migration" into would have been read by the Google Drive adapter
 * holding a Microsoft token (Phase 238). Deriving identity from a name is the bug; deriving it
 * from a structural address is not.
 */

/** The mark key for a watched folder. `null` when nothing is known — the caller draws nothing. */
export function watchProductMarkKey(
  sourceFolderId: string | null | undefined,
  serviceId: string | null | undefined,
): string | null {
  const folder = (sourceFolderId || "").trim()
  const service = (serviceId || "").trim().toLowerCase()

  // Mail is decided by the ADDRESS and by nothing else.
  if (folder.startsWith("mailbox:") || folder === "mailbox_root") {
    if (service.startsWith("google")) return "google-gmail"
    // ⚠ No mark rather than a borrowed one. `connectionMark.tsx` records the rule: borrowing
    //   Gmail's mark for another vendor's mail is the ROADMAP's own named mistake.
    return null
  }

  if (service.startsWith("google")) return "google-drive"
  return null
}

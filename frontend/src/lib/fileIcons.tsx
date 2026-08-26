/**
 * `getFileIcon(filename)` — the documents / governance / detail-panel file mark.
 *
 * ⚠ THE HAND-DRAWN OFFICE LOGOS ARE GONE (2026-08-25). This module used to inline its own
 *   `<svg>` for each format: a `#2B579A` page with a hand-set `W`, a `#217346` page with an
 *   `X`, a `#E12106` page with the letters `PDF`. Those were approximations of real
 *   trademarks, which this project's icon convention forbids in production — and the switch
 *   had only five arms, so `.html`, `.epub`, `.eml`, `.msg`, `.json`, every image and every
 *   code file fell through to a BLANK GREY PAGE with no mark at all.
 *
 * ⚠ RESOLUTION NOW LIVES IN ONE PLACE: `lib/fileTypeMark.tsx`, which maps an extension (and
 *   optionally a mime type) to the genuine published mark via the `~icons/` seam this repo
 *   already uses for Slack/Jira/MCP. Adding a format means adding a row THERE, so this
 *   surface and any future one cannot drift into disagreeing about the same file.
 *
 * The signature is unchanged, so all four call sites — `ingestion/DocumentList.tsx`,
 * `metadata/DocumentDetailPanel.tsx`, `health/HealthDocumentRow.tsx`,
 * `health/GovernanceRow.tsx` — keep working untouched. `h-5 w-5` is preserved because those
 * rows lay out around it.
 *
 * ⚠ `mimeType` is OPTIONAL AND NO CALL SITE PASSES ONE TODAY — measured, not assumed: all
 *   four hand `getFileIcon` a bare `filename`. It is accepted because `markFor` resolves
 *   mime-first for the office/email types, which is what a file with NO extension needs, and
 *   because a caller that already holds `documents.mime_type` should not have to reach past
 *   this function to use it. Stated here so a reader does not infer it is already wired.
 */
import { FileTypeMark } from "@/lib/fileTypeMark"

export function getFileIcon(filename: string, mimeType?: string) {
  return <FileTypeMark filename={filename} mimeType={mimeType} />
}

/**
 * Phase 217.1 plan 02 (D-217.1-21) — the ONE home for "how big is this file, in words".
 *
 * ⚠ EXTRACTED RATHER THAN COPIED. This function lived privately inside
 * `components/ingestion/DocumentList.tsx` and the Ingestion tab's `Needs attention` row needs
 * the same sentence. Re-typing three thresholds in a second file is how two surfaces come to
 * disagree about what `1 MB` means — so the body below is `DocumentList`'s BYTE-FOR-BYTE, and
 * `DocumentList` now imports it rather than owning it.
 *
 * ⛔ Not a formatting library and not a place to add units. It answers one question, in the
 * three bands the document surfaces actually show.
 */

/** `"512 B"` · `"1.5 KB"` · `"2.3 MB"`. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

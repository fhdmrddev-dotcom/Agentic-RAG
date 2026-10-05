// Phase 276-03 — the browser copy of headingId() from scripts/lib/docs-content.cjs. The build
// stores page.headings with these ids (TOC, search) and the Markdown renderer sets the same id on
// each H2, so the two MUST agree; Article.test.tsx pins the parity against the .cjs.
export function headingId(text: string): string {
  return String(text)
    .toLowerCase()
    .replace(/[`*_~]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/** m:ss for a duration in seconds (video captions and play-button labels). */
export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

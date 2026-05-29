/**
 * Phase 087 Wave 0 — FilePreview per-type routing contract (PANEL-03, D-02).
 *
 * GREEN-only scaffolding: FilePreview is not built yet (Plan 03). The
 * `it.todo(...)` strings are the concrete assertions Plan 03 MUST flip to live
 * tests. Fixtures anchor the two-shape content payload (inline | bucket) and the
 * signed_url-null fallback (Pitfall 5).
 */
import { describe, it } from "vitest"
import { mockContentInline, mockContentBucket } from "./fixtures"

void mockContentInline
void mockContentBucket

describe("FilePreview (PANEL-03) — per-type routing + graceful fallback", () => {
  it.todo("inline + text/markdown → renders via MarkdownRenderer (reuse, not re-add)")
  it.todo("inline + code mime (text/x-python, application/json, …) → renders via ShikiCode with language from path")
  it.todo("inline + text/csv → renders via CsvTablePreview")
  it.todo("bucket + image mime + non-null signed_url → frames the signed URL in an <img>")
  it.todo("bucket + image mime + signed_url === null → calm 'No preview available · Download' fallback (Pitfall 5)")
  it.todo("bucket + binary mime (pptx) / too-large → calm 'No preview available · Download' fallback, never breaks layout")
  it.todo("renders a '‹ Files' back button that returns to the file list (full-replace drill-in, D1)")
  it.todo("never uses dangerouslySetInnerHTML on raw file content (XSS — T-087-02)")
})

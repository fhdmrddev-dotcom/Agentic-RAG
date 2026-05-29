/**
 * Phase 087 Wave 0 — CsvTablePreview contract (PANEL-03, D-01).
 *
 * GREEN-only scaffolding: CsvTablePreview is not built yet (Plan 03). The one
 * preview type with no existing renderer — a minimal in-panel <table>, NO new
 * dependency. The `it.todo(...)` strings are the concrete assertions Plan 03
 * MUST flip to live tests. Fixtures anchor the valid (quoted-comma) and
 * malformed CSV strings.
 */
import { describe, it } from "vitest"
import { mockCsvValid, mockCsvMalformed } from "./fixtures"

void mockCsvValid
void mockCsvMalformed

describe("CsvTablePreview (PANEL-03) — minimal <table>, no dependency", () => {
  it.todo("renders a header row + one <tr> per data row from a valid CSV")
  it.todo("parses a quoted field containing a comma as a single cell ('Acme, Inc.' → one <td>)")
  it.todo("renders cell text as plain text, never as HTML (no dangerouslySetInnerHTML)")
  it.todo("falls back to the calm 'No preview available · Download' notice on a malformed CSV (never crashes)")
  it.todo("falls back to the calm notice when the CSV is too large to preview")
})

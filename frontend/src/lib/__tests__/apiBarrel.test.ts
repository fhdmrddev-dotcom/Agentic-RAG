/**
 * Phase 212 (D-207-06) — API Barrel Completeness Test.
 *
 * Verifies that all runtime functions and classes exported from domain modules
 * (specifically `connectors.ts` and others split in Phase 207) are re-exported
 * by the public barrel `lib/api.ts`.
 */

import { describe, it, expect } from "vitest"
import * as ApiBarrel from "../api"
import * as ConnectorsDomain from "../api/connectors"
import * as DocumentsDomain from "../api/documents"

describe("lib/api.ts barrel re-exports (D-207-06)", () => {
  it("re-exports all runtime symbols from lib/api/connectors.ts", () => {
    const connectorExports = Object.keys(ConnectorsDomain)
    expect(connectorExports.length).toBeGreaterThan(0)

    for (const exportName of connectorExports) {
      expect(ApiBarrel).toHaveProperty(exportName)
      expect((ApiBarrel as Record<string, unknown>)[exportName]).toBe(
        (ConnectorsDomain as Record<string, unknown>)[exportName],
      )
    }
  })

  it("exports probeMcpServer from the barrel", () => {
    expect(typeof ApiBarrel.probeMcpServer).toBe("function")
    expect(ApiBarrel.probeMcpServer).toBe(ConnectorsDomain.probeMcpServer)
  })

  it("exports ConnectorApiError class from the barrel", () => {
    expect(ApiBarrel.ConnectorApiError).toBe(ConnectorsDomain.ConnectorApiError)
  })
})

/**
 * Phase 217 Plan 10 Task 1 (LIB-04 / D-207-06) — the SAME guard, extended to
 * `api/documents.ts`.
 *
 * ⚠ Until this block, D-207-06 was guarded for `connectors.ts` ALONE. Every other domain
 * module split out in Phase 207 — documents included — could export a symbol, typecheck
 * clean, and be unreachable from `@/lib/api`, which is the only path anything outside
 * `lib/` imports. The 217-10 client functions are the first five to land under the guard.
 *
 * The non-vacuity control is not decoration: a `for` loop over an empty export set passes
 * for free, so a rename of the module or a botched `import *` would turn this into a test
 * that asserts nothing while staying green.
 */
describe("lib/api.ts barrel re-exports — documents domain (Phase 217, D-207-06)", () => {
  it("re-exports all runtime symbols from lib/api/documents.ts", () => {
    const documentsExports = Object.keys(DocumentsDomain)
    // Non-vacuity control — an empty set would satisfy the loop below for free.
    expect(documentsExports.length).toBeGreaterThan(0)

    for (const exportName of documentsExports) {
      expect(ApiBarrel).toHaveProperty(exportName)
      expect((ApiBarrel as Record<string, unknown>)[exportName]).toBe(
        (DocumentsDomain as Record<string, unknown>)[exportName],
      )
    }
  })

  it("exports the five Phase 217 detail reads by name", () => {
    // Named individually as well as covered by the loop above: the loop proves the barrel
    // is COMPLETE, these prove the five this plan shipped are the ones present. A future
    // rename would pass the loop and fail here, which is the split we want.
    for (const fn of [
      "getDocumentContent",
      "listDocumentChunks",
      "listDocumentTables",
      "listDocumentImages",
      "listDocumentQueries",
    ] as const) {
      expect(typeof (ApiBarrel as Record<string, unknown>)[fn]).toBe("function")
      expect((ApiBarrel as Record<string, unknown>)[fn]).toBe(
        (DocumentsDomain as Record<string, unknown>)[fn],
      )
    }
  })
})

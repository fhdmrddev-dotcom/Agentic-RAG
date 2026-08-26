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

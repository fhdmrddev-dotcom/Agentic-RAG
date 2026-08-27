/**
 * Phase 212 (CAT-01 / CAT-02) — Unit Tests for Services Catalog Presentation Registry.
 */

import { describe, it, expect } from "vitest"
import {
  CATALOG_SERVICES,
  POPULAR_SERVICES,
  getServiceCatalogEntry,
} from "../servicesCatalog"

describe("servicesCatalog", () => {
  it("provides the curated popular roster with non-empty metadata", () => {
    expect(CATALOG_SERVICES.length).toBeGreaterThanOrEqual(POPULAR_SERVICES.length)
    const serviceIds = POPULAR_SERVICES.map((s) => s.serviceId)
    expect(serviceIds).toContain("slack")
    expect(serviceIds).toContain("jira")
    expect(serviceIds).toContain("smtp")
    expect(serviceIds).toContain("github")
    expect(serviceIds).toContain("google")
    expect(serviceIds).toContain("notion")
    expect(serviceIds).toContain("custom_mcp")

    for (const service of POPULAR_SERVICES) {
      expect(service.name.trim().length).toBeGreaterThan(0)
      expect(service.tagline.trim().length).toBeGreaterThan(0)
      expect(service.description.trim().length).toBeGreaterThan(0)
      expect(service.markKey.trim().length).toBeGreaterThan(0)
    }
  })

  it("returns curated entry for known service_id (case-insensitive)", () => {
    const slack = getServiceCatalogEntry("slack")
    expect(slack.name).toBe("Slack")
    expect(slack.markKey).toBe("slack")
    expect(slack.tagline).toContain("Post updates")

    const jiraUpper = getServiceCatalogEntry("JIRA")
    expect(jiraUpper.name).toBe("Jira")
    expect(jiraUpper.markKey).toBe("jira")
  })

  it("guarantees totality and returns clean fallback for unknown service_id or hostnames", () => {
    const customHost = getServiceCatalogEntry("mcp.deepwiki.com")
    expect(customHost).toBeDefined()
    expect(customHost.name).toBe("mcp.deepwiki.com")
    expect(customHost.markKey).toBe("mcp")
    expect(customHost.tagline).toBe("Connected MCP service")

    const empty = getServiceCatalogEntry("")
    expect(empty).toBeDefined()
    expect(empty.name).toBe("Custom Service")
    expect(empty.markKey).toBe("mcp")

    const nullish = getServiceCatalogEntry(null)
    expect(nullish).toBeDefined()
    expect(nullish.name).toBe("Custom Service")
  })
})

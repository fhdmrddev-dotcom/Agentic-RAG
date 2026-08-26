/**
 * Phase 212 (CAT-01 / CAT-02 / CAT-03 / CAT-05) — Catalog Copywriting Constants.
 */

export const CATALOG_SEARCH_PLACEHOLDER = "Search services or tools..."
export const PROVENANCE_ADDED_BY_URL = "ADDED BY URL"

export const STATE_FILTER_LABELS = {
  all: "All",
  connected: "Connected",
  not_connected: "Not connected",
} as const

export const CATALOG_EMPTY_SEARCH_HEADLINE = "No services match your search"
export const CATALOG_EMPTY_SEARCH_SUB = "Try searching for a different service name or tool description."
export const CATALOG_EMPTY_CONNECTED_HEADLINE = "No services connected yet"
export const CATALOG_EMPTY_CONNECTED_SUB = "Connect a popular service from the catalog or paste an MCP server URL."

export const CLOUD_LIVE_CONNECTORS_OFF_BANNER = {
  title: "Live sending is off for this platform",
  description: "An operator turns live_connectors on in the Control Room. Connections can be browsed in read-only mode.",
}

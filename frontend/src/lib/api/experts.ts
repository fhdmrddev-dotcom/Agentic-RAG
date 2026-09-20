/**
 * Phase 260 — domain module for Expert Bundles.
 */

import type { ExpertBundle } from "../../types"
import { API_BASE, getAuthHeaders } from "./_core"

export async function listExperts(
  includeSystem = true,
  enabledOnly = true,
): Promise<ExpertBundle[]> {
  const headers = await getAuthHeaders()
  const params = new URLSearchParams()
  if (!includeSystem) params.set("include_system", "false")
  if (!enabledOnly) params.set("enabled_only", "false")
  const qs = params.toString() ? `?${params.toString()}` : ""
  const res = await fetch(`${API_BASE}/experts${qs}`, { headers })
  if (!res.ok) {
    let msg = "Failed to list experts"
    try {
      const err = await res.json()
      if (typeof err.detail === "string") {
        msg = err.detail
      } else if (err.detail?.detail) {
        msg = err.detail.detail
      } else if (err.detail?.upgrade_hint) {
        msg = err.detail.upgrade_hint
      } else if (err.message) {
        msg = err.message
      }
    } catch {
      // Keep default
    }
    throw new Error(msg)
  }
  return res.json() as Promise<ExpertBundle[]>
}

export async function getExpert(bundleId: string): Promise<ExpertBundle> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/experts/${bundleId}`, { headers })
  if (!res.ok) {
    let msg = "Failed to get expert"
    try {
      const err = await res.json()
      if (typeof err.detail === "string") {
        msg = err.detail
      } else if (err.detail?.detail) {
        msg = err.detail.detail
      } else if (err.detail?.upgrade_hint) {
        msg = err.detail.upgrade_hint
      } else if (err.message) {
        msg = err.message
      }
    } catch {
      // Keep default
    }
    throw new Error(msg)
  }
  return res.json() as Promise<ExpertBundle>
}

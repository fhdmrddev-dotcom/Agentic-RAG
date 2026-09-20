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
  if (!res.ok) throw new Error("Failed to list experts")
  return res.json() as Promise<ExpertBundle[]>
}

export async function getExpert(bundleId: string): Promise<ExpertBundle> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/experts/${bundleId}`, { headers })
  if (!res.ok) throw new Error("Failed to get expert")
  return res.json() as Promise<ExpertBundle>
}

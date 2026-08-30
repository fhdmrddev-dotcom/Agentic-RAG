import { API_BASE, getAuthHeaders } from "./_core"

export interface TakeoffCandidate {
  code: string
  desc: string
  unit: string
  rate: number
}

export interface TakeoffBOQItem {
  item_key: string
  category: "block" | "spec"
  source_text: string
  quantity: number
  unit: string
  rate_code: string | null
  description: string
  rate: number | null
  amount: number | null
  basis: "read" | "matched" | "ambiguous" | "unpriced"
  status: "matched" | "ambiguous" | "unpriced"
  candidates: TakeoffCandidate[]
}

export interface TakeoffBOQ {
  items: TakeoffBOQItem[]
  totals: {
    total_estimated_cost: number
    counted_items_cost: number
    total_items: number
    matched_count: number
    ambiguous_count: number
    unpriced_count: number
  }
  refused: boolean
  refusal_reason: string | null
  units: string
}

export interface DocumentTakeoffPayload {
  units?: string
  insunits_code?: number
  to_m?: number | null
  refused?: boolean
  refusal_reason?: string | null
  blocks?: Record<string, number>
  dimensions?: number[]
  specs?: string[]
  length_by_layer?: Record<string, number>
  entity_total?: number
  text_summary?: string
  boq?: TakeoffBOQ
  rate_sheet_document_id?: string
  rate_sheet_filename?: string
}

export async function fetchDocumentTakeoff(documentId: string): Promise<DocumentTakeoffPayload> {
  const auth = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/documents/${documentId}/takeoff`, {
    headers: { ...auth },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to fetch takeoff data" }))
    throw new Error(err.detail || "Failed to fetch takeoff data")
  }
  return res.json()
}

export async function matchDocumentTakeoff(
  documentId: string,
  rateSheetDocumentId: string,
): Promise<TakeoffBOQ> {
  const auth = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/documents/${documentId}/takeoff/match`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...auth,
    },
    body: JSON.stringify({ rate_sheet_document_id: rateSheetDocumentId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to match takeoff" }))
    throw new Error(err.detail || "Failed to match takeoff")
  }
  return res.json()
}

export async function resolveDocumentTakeoffItem(
  documentId: string,
  itemKey: string,
  chosenRateCode: string,
): Promise<TakeoffBOQ> {
  const auth = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/documents/${documentId}/takeoff/resolve`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...auth,
    },
    body: JSON.stringify({ item_key: itemKey, chosen_rate_code: chosenRateCode }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to resolve takeoff item" }))
    throw new Error(err.detail || "Failed to resolve takeoff item")
  }
  return res.json()
}

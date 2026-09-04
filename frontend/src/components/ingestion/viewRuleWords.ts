import type { ViewCondition, ViewConditionOp, ViewFilter } from "@/types"

/**
 * Phase 217.1-07 (LIB-01 / D-217.1-07) — the plain-language rule-words renderer.
 *
 * Extracted from FilterBar.tsx:31-55 (CHIP_OP_LABEL + chipSummary) into a pure leaf
 * shared by FilterBar (the editor) and ViewCard (the library card face).
 */

/** Plain-language operator labels for the chip summary (sans, never jargon). */
export const CHIP_OP_LABEL: Record<ViewConditionOp, string> = {
  eq: "is",
  one_of: "is one of",
  contains: "contains",
  is_empty: "is empty",
  gte: "≥",
  lte: "≤",
  between: "between",
  within_next: "within next",
  older_than: "older than",
  before: "before",
  after: "after",
}

/** Render a single condition as a plain-language chip summary. */
export function chipSummary(c: ViewCondition): string {
  const op = CHIP_OP_LABEL[c.op]
  if (c.op === "is_empty") return `${c.field} ${op}`
  if (c.op === "one_of") return `${c.field} ${op} ${(c.values ?? []).join(", ")}`
  if (c.op === "between") return `${c.field} ${op} ${c.value} – ${c.value2}`
  if (c.op === "within_next" || c.op === "older_than") {
    return `${c.field} ${op} ${c.value} ${c.unit ?? "days"}`
  }
  return `${c.field} ${op} ${c.value}`
}

/** Render a complete filter expression as plain-language rule words joined with middle dot (·). */
export function ruleInWords(filterExpr?: ViewFilter | null): string {
  if (!filterExpr || !filterExpr.conditions || filterExpr.conditions.length === 0) {
    return "All documents"
  }
  return filterExpr.conditions.map(chipSummary).join(" · ")
}

/**
 * Phase 076.1 D-06: Frontend pattern matching for error categorization.
 * Maps common substrings in run error strings to user-friendly labels.
 * No backend schema changes — pure display-time utility.
 */

interface ErrorCategory {
  label: string
  /** Short suffix for inline display (e.g., "timed out") */
  shortLabel: string
}

const ERROR_PATTERNS: Array<{ test: RegExp; category: ErrorCategory }> = [
  { test: /timed?\s*out/i,                  category: { label: "Timed out",              shortLabel: "timed out" } },
  { test: /exceeded|truncat/i,              category: { label: "Output limit reached",   shortLabel: "output limit" } },
  { test: /code.*(?:error|fail)|sandbox/i,  category: { label: "Code execution failed",  shortLabel: "code error" } },
  { test: /cancel/i,                        category: { label: "Cancelled",              shortLabel: "cancelled" } },
  { test: /rate.?limit|429/i,              category: { label: "Rate limited",            shortLabel: "rate limited" } },
  { test: /auth|401|403|invalid.*key/i,    category: { label: "Authentication error",    shortLabel: "auth error" } },
]

const DEFAULT_CATEGORY: ErrorCategory = { label: "Run failed", shortLabel: "failed" }

/**
 * Categorize a run error string into a user-friendly label.
 * Returns a category object with label (tooltip) and shortLabel (inline).
 *
 * @param error - The raw error string from SSE terminal errorPayload or runs.error
 * @returns ErrorCategory with label and shortLabel
 */
export function categorizeError(error: string | null | undefined): ErrorCategory {
  if (!error) return DEFAULT_CATEGORY
  for (const { test, category } of ERROR_PATTERNS) {
    if (test.test(error)) return category
  }
  return DEFAULT_CATEGORY
}

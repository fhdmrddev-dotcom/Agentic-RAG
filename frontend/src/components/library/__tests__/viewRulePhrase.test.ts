import { describe, it, expect } from "vitest"
import { CHIP_OP_LABEL, chipSummary, ruleInWords } from "@/components/ingestion/viewRuleWords"
import type { ViewCondition, ViewConditionOp, ViewFilter } from "@/types"

describe("viewRuleWords", () => {
  it("exports CHIP_OP_LABEL covering all 11 ViewConditionOp values", () => {
    const allOps: ViewConditionOp[] = [
      "eq",
      "one_of",
      "contains",
      "is_empty",
      "gte",
      "lte",
      "between",
      "within_next",
      "older_than",
      "before",
      "after",
    ]
    for (const op of allOps) {
      expect(CHIP_OP_LABEL[op]).toBeDefined()
      expect(typeof CHIP_OP_LABEL[op]).toBe("string")
    }
  })

  it("chipSummary renders plain-language representations for all condition shapes", () => {
    const testCases: Array<{ condition: ViewCondition; expected: string }> = [
      {
        condition: { field: "title", op: "eq", value: "invoice" },
        expected: "title is invoice",
      },
      {
        condition: { field: "status", op: "is_empty" },
        expected: "status is empty",
      },
      {
        condition: { field: "department", op: "one_of", values: ["Sales", "Marketing"] },
        expected: "department is one of Sales, Marketing",
      },
      {
        condition: { field: "amount", op: "between", value: 10, value2: 100 },
        expected: "amount between 10 – 100",
      },
      {
        condition: { field: "created_at", op: "within_next", value: 7, unit: "days" },
        expected: "created_at within next 7 days",
      },
      {
        condition: { field: "created_at", op: "older_than", value: 30, unit: "days" },
        expected: "created_at older than 30 days",
      },
      {
        condition: { field: "content", op: "contains", value: "contract" },
        expected: "content contains contract",
      },
      {
        condition: { field: "score", op: "gte", value: 85 },
        expected: "score ≥ 85",
      },
      {
        condition: { field: "score", op: "lte", value: 50 },
        expected: "score ≤ 50",
      },
      {
        condition: { field: "date", op: "before", value: "2026-01-01" },
        expected: "date before 2026-01-01",
      },
      {
        condition: { field: "date", op: "after", value: "2026-01-01" },
        expected: "date after 2026-01-01",
      },
    ]

    for (const { condition, expected } of testCases) {
      expect(chipSummary(condition)).toBe(expected)
    }
  })

  it("ruleInWords joins multiple conditions with middle dot (·)", () => {
    const filter: ViewFilter = {
      op: "and",
      conditions: [
        { field: "type", op: "eq", value: "contract" },
        { field: "added", op: "older_than", value: 30, unit: "days" },
      ],
    }
    expect(ruleInWords(filter)).toBe("type is contract · added older than 30 days")
  })

  it("ruleInWords handles empty or missing filter gracefully", () => {
    expect(ruleInWords(null)).toBe("All documents")
    expect(ruleInWords(undefined)).toBe("All documents")
    expect(ruleInWords({ op: "and", conditions: [] })).toBe("All documents")
  })
})

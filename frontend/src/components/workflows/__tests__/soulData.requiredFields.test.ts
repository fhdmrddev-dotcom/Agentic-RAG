import { describe, expect, it } from "vitest"
import {
  missingRequiredFields,
  requiredFieldsMessage,
  type EntryInputField,
} from "../soulData"

/**
 * Phase 287-01 (START-01 / D-06 / A-08) — the shared required-field predicate.
 * Pure: the two launch confirm controls call it, the leaf `LaunchInputFields` does not.
 */
describe("missingRequiredFields", () => {
  it("treats an ABSENT required flag as required (server InputFieldSpec default)", () => {
    const fields: EntryInputField[] = [{ key: "to" }]
    expect(missingRequiredFields(fields, { to: "" }).map((f) => f.key)).toEqual(["to"])
  })

  it("counts whitespace-only as empty and real text as filled", () => {
    const fields: EntryInputField[] = [{ key: "a" }, { key: "b" }]
    expect(missingRequiredFields(fields, { a: "   ", b: "x" }).map((f) => f.key)).toEqual(["a"])
  })

  it("does NOT flag required:false with an empty value", () => {
    const fields: EntryInputField[] = [{ key: "opt", required: false }]
    expect(missingRequiredFields(fields, { opt: "" })).toEqual([])
  })

  it("counts a key absent from values as empty", () => {
    const fields: EntryInputField[] = [{ key: "gone", required: true }]
    expect(missingRequiredFields(fields, {}).map((f) => f.key)).toEqual(["gone"])
  })
})

describe("requiredFieldsMessage", () => {
  it("names the authored label if present, else the bare key; one sentence for two", () => {
    expect(requiredFieldsMessage([{ key: "to", label: "Recipient" }])).toBe("Recipient is required")
    expect(requiredFieldsMessage([{ key: "to" }])).toBe("to is required")
    expect(requiredFieldsMessage([{ key: "to", label: "Recipient" }, { key: "cc" }])).toBe(
      "Recipient and cc are required",
    )
  })

  it("returns empty string for zero missing", () => {
    expect(requiredFieldsMessage([])).toBe("")
  })

  it("avoids the words the ChatLaunchForm source fence forbids", () => {
    const s = requiredFieldsMessage([{ key: "a" }, { key: "b" }, { key: "c" }])
    expect(s).toBe("a, b and c are required")
    expect(s).not.toMatch(/messages|assistant|lastMessage|generate/)
  })
})

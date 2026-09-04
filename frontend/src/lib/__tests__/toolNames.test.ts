import { describe, it, expect } from "vitest"
import { toolName, TOOL_PHRASES } from "@/lib/toolNames"
import { toolLabel } from "@/lib/toolMeta"

describe("toolNames re-export and toolLabel human phrases", () => {
  it("re-exports toolName and TOOL_PHRASES correctly", () => {
    expect(TOOL_PHRASES.write_todos).toBe("Track its to-dos")
    expect(TOOL_PHRASES.workspace_write).toBe("Write a file")
    expect(TOOL_PHRASES.ask_user).toBe("Ask a person")
    expect(toolName("write_todos")).toBe("Track its to-dos")
    expect(toolName("workspace_write")).toBe("Write a file")
    expect(toolName("ask_user")).toBe("Ask a person")
  })

  it("safely falls back to raw id on unmapped tools without throwing or prototype pollution", () => {
    expect(toolName("constructor")).toBe("constructor")
    expect(toolName("__proto__")).toBe("__proto__")
    expect(toolName("unknown_custom_tool")).toBe("unknown_custom_tool")
  })

  it("toolLabel resolves unmapped schema tools through toolName rather than raw snake_case", () => {
    expect(toolLabel("write_todos")).toBe("Track its to-dos")
    expect(toolLabel("workspace_write")).toBe("Write a file")
    expect(toolLabel("ask_user")).toBe("Ask a person")
  })
})

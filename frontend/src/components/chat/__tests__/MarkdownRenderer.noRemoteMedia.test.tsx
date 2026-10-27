/**
 * 296 review FE-WR-02 — MarkdownRenderer's opt-in `noRemoteMedia` drops everything that would
 * fetch a resource at render (the evidence report's colleague audience), while chat rendering —
 * the default, prop absent — is byte-for-byte what it was.
 */
import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import { MarkdownRenderer } from "../MarkdownRenderer"

const BEACON = "https://attacker.example/p.png"

describe("MarkdownRenderer noRemoteMedia (296 review FE-WR-02)", () => {
  it("with the prop, a markdown image renders no <img> and no remote URL", () => {
    const { container } = render(<MarkdownRenderer content={`Hi ![x](${BEACON})`} noRemoteMedia />)
    expect(container.querySelector("img")).toBeNull()
    expect(container.innerHTML).not.toContain("attacker.example")
    expect(container.textContent).toContain("Hi")
  })

  it("with the prop, tables, code and links still render", () => {
    const md = "| a | b |\n|---|---|\n| 1 | 2 |\n\n`x = 1`\n\n```py\nprint(1)\n```\n\n[doc](https://example.com/d)"
    const { container } = render(<MarkdownRenderer content={md} noRemoteMedia />)
    expect(container.querySelectorAll("td")).toHaveLength(2)
    expect(container.querySelector("pre code")?.textContent).toContain("print(1)")
    expect(container.querySelector("a")?.getAttribute("href")).toBe("https://example.com/d")
  })

  it("without the prop (chat), an image still renders as before", () => {
    const { container } = render(<MarkdownRenderer content={`![x](${BEACON})`} />)
    expect(container.querySelector("img")?.getAttribute("src")).toBe(BEACON)
  })
})

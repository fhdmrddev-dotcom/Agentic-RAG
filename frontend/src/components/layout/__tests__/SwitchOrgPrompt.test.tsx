/**
 * Phase 299-03 (LINK-05 / D-16, D-17, D-39; UI-SPEC S3, sketch 299-2 A) — "This is in <org> — switch?"
 *
 * The prompt that replaces the main region when a link names an item in ANOTHER of the person's
 * orgs. Nothing switches without a click: the component only calls the handlers it is given, and
 * never `switchOrg` itself. Exactly one filled button (Switch); Stay is the outline default.
 *
 * ⛔ Asserted by the RENDERED WORDS, against the constants in `orgItemsCopy.ts` (one home).
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { SwitchOrgPrompt, type SwitchOrgPromptProps } from "../SwitchOrgPrompt"
import {
  BACK_TO_IT,
  KEEPS_GOING_TAIL,
  KIND_CAPTION,
  stayIn,
  stillAnsweringMany,
  stillAnsweringOne,
  switchToLabel,
  switchingTo,
  thisIsIn,
  workingIn,
} from "@/components/org/orgItemsCopy"
import promptSource from "../SwitchOrgPrompt.tsx?raw"
import copySource from "@/components/org/orgItemsCopy.ts?raw"

afterEach(cleanup)

function props(over: Partial<SwitchOrgPromptProps> = {}): SwitchOrgPromptProps {
  return {
    target: { kind: "run", org_id: "B", org_name: "Acme Legal", title: "Contract review" },
    currentOrgName: "Northwind",
    streaming: [],
    switching: false,
    onStay: vi.fn(),
    onSwitch: vi.fn(),
    onBackToIt: vi.fn(),
    ...over,
  }
}

const codeOf = (src: string) =>
  src.replace(/\r\n/g, "\n").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

describe("the words (orgItemsCopy.ts — one home)", () => {
  it("every sentence of S3, verbatim", () => {
    expect(thisIsIn("Acme Legal")).toBe("This is in Acme Legal")
    expect(workingIn("Northwind", "Acme Legal")).toBe("You're working in Northwind. Switch to Acme Legal to open it?")
    expect(KEEPS_GOING_TAIL).toBe(" Your chat that's answering now keeps going.")
    expect(KIND_CAPTION).toEqual({ thread: "Chat", workflow: "Workflow", run: "Workflow run", expert: "Expert" })
    expect(stayIn("Northwind")).toBe("Stay in Northwind")
    expect(switchToLabel("Acme Legal")).toBe("Switch to Acme Legal")
    expect(switchingTo("Acme Legal")).toBe("Switching to Acme Legal…")
    expect(stillAnsweringOne("Renewal clause comparison")).toBe("“Renewal clause comparison” is still answering")
    expect(stillAnsweringMany(2)).toBe("2 chats are still answering")
    expect(BACK_TO_IT).toBe("Back to it")
  })

  it("orgItemsCopy.ts is still a strict leaf: no import statement", () => {
    expect(copySource.match(/^\s*import\b/gm) ?? []).toHaveLength(0)
  })
})

describe("the prompt (sketch A)", () => {
  it("heading focused once, body, item box, Stay outline + Switch the only filled button, avatar initial", () => {
    const p = props()
    render(<SwitchOrgPrompt {...p} />)
    const h1 = screen.getByRole("heading", { level: 1, name: "This is in Acme Legal" })
    expect(document.activeElement).toBe(h1)
    expect(h1).toHaveAttribute("tabindex", "-1")
    expect(screen.getByText("You're working in Northwind. Switch to Acme Legal to open it?")).toBeInTheDocument()
    const caption = screen.getByText("Workflow run")
    expect(caption.className).toContain("uppercase")
    expect(screen.getByText("Contract review")).toBeInTheDocument()
    const stay = screen.getByRole("button", { name: "Stay in Northwind" })
    const sw = screen.getByRole("button", { name: "Switch to Acme Legal" })
    expect(stay.className).not.toContain("bg-primary")
    expect(sw.className).toContain("bg-primary")
    const filled = screen.getAllByRole("button").filter((b) => b.className.includes("bg-primary"))
    expect(filled).toEqual([sw])
    expect(screen.getByTestId("org-avatar")).toHaveTextContent("A")
    // Nothing switched, stayed or went back on render.
    expect(p.onSwitch).not.toHaveBeenCalled()
    expect(p.onStay).not.toHaveBeenCalled()
    expect(p.onBackToIt).not.toHaveBeenCalled()
  })

  it("is a section labelled by its heading, never an alert", () => {
    render(<SwitchOrgPrompt {...props()} />)
    const h1 = screen.getByRole("heading", { level: 1 })
    expect(h1.closest("section")).toHaveAttribute("aria-labelledby", h1.id)
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it.each<["thread" | "workflow" | "run" | "expert", string]>([
    ["thread", "Chat"],
    ["workflow", "Workflow"],
    ["run", "Workflow run"],
    ["expert", "Expert"],
  ])("a %s item is captioned %s", (kind, caption) => {
    render(<SwitchOrgPrompt {...props({ target: { kind, org_id: "B", org_name: "Acme Legal", title: "T" } })} />)
    expect(screen.getByText(caption)).toBeInTheDocument()
  })

  it("with no chat answering: no tail and no chip", () => {
    render(<SwitchOrgPrompt {...props()} />)
    expect(screen.queryByText(/keeps going/)).toBeNull()
    expect(screen.queryByText(/still answering/)).toBeNull()
    expect(screen.queryByRole("button", { name: "Back to it" })).toBeNull()
  })

  it("with one chat answering: the tail, and the chip names it in curly quotes", () => {
    render(<SwitchOrgPrompt {...props({ streaming: [{ id: "t1", title: "Renewal clause comparison" }] })} />)
    expect(
      screen.getByText("You're working in Northwind. Switch to Acme Legal to open it? Your chat that's answering now keeps going."),
    ).toBeInTheDocument()
    expect(screen.getByText("“Renewal clause comparison” is still answering")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Back to it" }).className).not.toContain("bg-primary")
  })

  it("with two chats answering: the count", () => {
    render(
      <SwitchOrgPrompt
        {...props({
          streaming: [
            { id: "t1", title: "One" },
            { id: "t2", title: "Two" },
          ],
        })}
      />,
    )
    expect(screen.getByText("2 chats are still answering")).toBeInTheDocument()
  })

  it("each button calls its own handler once, and only that one", () => {
    const p = props({ streaming: [{ id: "t1", title: "One" }] })
    render(<SwitchOrgPrompt {...p} />)
    fireEvent.click(screen.getByRole("button", { name: "Stay in Northwind" }))
    expect(p.onStay).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole("button", { name: "Back to it" }))
    expect(p.onBackToIt).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole("button", { name: "Switch to Acme Legal" }))
    expect(p.onSwitch).toHaveBeenCalledTimes(1)
    expect(p.onStay).toHaveBeenCalledTimes(1)
  })

  it("while switching: 'Switching to Acme Legal…' as a status in place of the buttons", () => {
    render(<SwitchOrgPrompt {...props({ switching: true })} />)
    expect(screen.getByRole("status")).toHaveTextContent("Switching to Acme Legal…")
    expect(screen.queryByRole("button", { name: "Switch to Acme Legal" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Stay in Northwind" })).toBeNull()
  })

  it("the title and org name are React text, never markup (T-299-28)", () => {
    render(
      <SwitchOrgPrompt
        {...props({ target: { kind: "run", org_id: "B", org_name: "<i>Acme</i>", title: "<b>Contract</b>" } })}
      />,
    )
    expect(screen.getByText("<b>Contract</b>")).toBeInTheDocument()
    expect(document.querySelector("b")).toBeNull()
    expect(document.querySelector("i")).toBeNull()
  })
})

describe("source facts", () => {
  it("never calls switchOrg itself, never renders HTML, and takes every word from orgItemsCopy", () => {
    const code = codeOf(promptSource)
    expect(code).not.toContain("switchOrg(")
    expect(code).not.toContain("dangerouslySetInnerHTML")
    expect(code).toContain('from "@/components/org/orgItemsCopy"')
    // No sentence is spelled here.
    expect(code).not.toMatch(/This is in|working in|still answering|Stay in|Switching to/)
  })
})

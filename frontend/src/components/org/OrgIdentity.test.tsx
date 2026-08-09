/**
 * Phase 177 Plan 01 Task 2 — OrgIdentity (RoleBadge + OrgAvatar) tests (D-04).
 *
 * ONE shared org-identity element extracted from the role badge duplicated
 * byte-identically at FOUR sites (OrgBand.tsx:78-87, ProfileMenu.tsx:133-142,
 * InvitationsTab.tsx:254-266, OrgMembersTab.tsx:147-165) + the gradient
 * initial-circle avatar (InvitationsTab.tsx:236-241 + the dashed pending variant
 * OrgMembersTab.tsx:225-228).
 *
 * Contract asserted here:
 *   - roleBadgeMeta reconciles the 4-tier drift: org-admin/super-admin + dept-admin
 *     are admin; everything else is Member (three distinct labels)
 *   - RoleBadge admin = the ◆ indigo primary pill (verbatim OrgBand.tsx:79 tokens),
 *     member = the muted pill; both are <span>, never interactive
 *   - never-colour-alone: the visible WORD is present in every state
 *   - the primitive READS role and renders — it gates NOTHING (D-05/D-06 stays at
 *     the call site)
 *   - OrgAvatar renders the gradient initial-circle and flips to the dashed indigo
 *     variant when `pending`
 */
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { RoleBadge, OrgAvatar, roleBadgeMeta } from "./OrgIdentity"

describe("roleBadgeMeta — reconciled 4-tier mapping (D-04)", () => {
  it.each([
    ["org-admin", "Org-admin", true],
    ["super-admin", "Org-admin", true],
    ["dept-admin", "Dept-admin", true],
    ["member", "Member", false],
    ["", "Member", false],
    ["something-unknown", "Member", false],
  ] as [string, string, boolean][])(
    "role=%s → { label: %s, admin: %s }",
    (role, label, admin) => {
      expect(roleBadgeMeta(role)).toEqual({ label, admin })
    },
  )

  it("distinguishes three labels: Org-admin / Dept-admin / Member", () => {
    const labels = new Set(
      ["org-admin", "dept-admin", "member"].map((r) => roleBadgeMeta(r).label),
    )
    expect(labels).toEqual(new Set(["Org-admin", "Dept-admin", "Member"]))
  })
})

describe("RoleBadge — admin ◆ indigo pill vs muted member pill", () => {
  it("admin role → the ◆ Org-admin primary pill (verbatim OrgBand.tsx:79 tokens)", () => {
    render(<RoleBadge role="org-admin" />)
    const el = screen.getByTestId("role-badge")
    expect(el.tagName).toBe("SPAN")
    expect(el.getAttribute("data-admin")).toBe("true")
    expect(el.textContent).toContain("Org-admin")
    // the ◆ glyph is decorative (aria-hidden); the WORD carries the meaning.
    expect(el.textContent).toContain("◆")
    expect(el.querySelector("[aria-hidden='true']")).not.toBeNull()
    for (const token of ["gap-1", "border-primary/30", "bg-primary/10", "text-primary", "px-2", "py-0.5"]) {
      expect(el.className).toContain(token)
    }
  })

  it("dept-admin → admin pill labelled Dept-admin", () => {
    render(<RoleBadge role="dept-admin" />)
    const el = screen.getByTestId("role-badge")
    expect(el.getAttribute("data-admin")).toBe("true")
    expect(el.textContent).toContain("Dept-admin")
  })

  it("non-admin role → the muted Member pill (verbatim OrgBand.tsx:84 tokens)", () => {
    render(<RoleBadge role="member" />)
    const el = screen.getByTestId("role-badge")
    expect(el.tagName).toBe("SPAN")
    expect(el.getAttribute("data-admin")).toBe("false")
    expect(el.textContent).toContain("Member")
    for (const token of ["border-border", "bg-muted/40", "text-muted-foreground"]) {
      expect(el.className).toContain(token)
    }
  })

  it("never-colour-alone: the visible WORD is present in both states, never a button", () => {
    const { rerender } = render(<RoleBadge role="org-admin" />)
    expect(screen.getByTestId("role-badge").textContent).toMatch(/Org-admin/)
    rerender(<RoleBadge role="viewer" />)
    expect(screen.getByTestId("role-badge").textContent).toMatch(/Member/)
    expect(screen.queryByRole("button")).toBeNull()
  })
})

describe("OrgAvatar — gradient initial circle + dashed pending variant", () => {
  it("default → gradient initial circle with the initial", () => {
    render(<OrgAvatar initial="A" />)
    const el = screen.getByTestId("org-avatar")
    expect(el.textContent).toBe("A")
    for (const token of ["h-9", "w-9", "rounded-full", "bg-gradient-to-br", "from-primary", "to-primary/60", "text-white"]) {
      expect(el.className).toContain(token)
    }
    expect(el.className).not.toContain("border-dashed")
  })

  it("pending → dashed indigo variant (verbatim OrgMembersTab.tsx:225-228 tokens)", () => {
    render(<OrgAvatar initial="B" pending />)
    const el = screen.getByTestId("org-avatar")
    expect(el.textContent).toBe("B")
    for (const token of ["border-dashed", "border-primary/40", "bg-primary/[0.06]", "text-primary"]) {
      expect(el.className).toContain(token)
    }
    expect(el.className).not.toContain("bg-gradient-to-br")
  })
})

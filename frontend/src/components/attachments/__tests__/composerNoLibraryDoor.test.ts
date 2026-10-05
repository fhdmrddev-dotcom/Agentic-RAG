/**
 * Phase 274 plan 04 Task 2 (ATT-02 / D-18 / T-274-23) — THE COMPOSER HAS NO LIBRARY DOOR.
 *
 * ATT-02's named failure is a hidden button while an API path still writes: a composer that LOOKS
 * door-free but can still mint a Library document, start a watch or install an Expert. A render
 * test cannot see that, so this is a NEGATIVE SOURCE PROOF over every composer file and the page
 * the composer's `connections` link opens. 274-02 pins the backend half (the minter set).
 *
 * ⚠ Comments are stripped first (`stripComments`): two of these files EXPLAIN in prose why they do
 * not call `importCloudFile`, and a fence that read prose would fail on the explanation.
 * ⚠ Non-vacuity first: an empty or wrong `?raw` import would pass every `not.toContain`.
 */
import { describe, expect, it } from "vitest"
import { stripComments } from "@/lib/stripComments.testutil"
import messageInput from "@/components/chat/MessageInput.tsx?raw"
import useComposerAttachments from "@/components/chat/useComposerAttachments.ts?raw"
import connectedFilePicker from "@/components/chat/ConnectedFilePickerModal.tsx?raw"
import connectorsFlyout from "@/components/chat/ConnectorsFlyout.tsx?raw"
import inviteExpert from "@/components/chat/InviteExpertDialog.tsx?raw"
import connectionsPage from "@/pages/ConnectionsPage.tsx?raw"
import connectionsTab from "@/components/settings/ConnectionsTab.tsx?raw"

const FILES: [string, string, string][] = [
  ["MessageInput.tsx", messageInput, "MessageInput"],
  ["useComposerAttachments.ts", useComposerAttachments, "useComposerAttachments"],
  ["ConnectedFilePickerModal.tsx", connectedFilePicker, "ConnectedFilePickerModal"],
  ["ConnectorsFlyout.tsx", connectorsFlyout, "ConnectorsFlyout"],
  ["InviteExpertDialog.tsx", inviteExpert, "InviteExpertDialog"],
  ["ConnectionsPage.tsx", connectionsPage, "ConnectionsPage"],
  ["ConnectionsTab.tsx", connectionsTab, "ConnectionsTab"],
]

/** Every client or route that writes the Library, starts a watch or installs an Expert. */
const MINTERS = [
  "uploadDocument",
  "importCloudFile",
  "createWatch",
  "installExpert",
  "promoteAttachment",
  "/documents/upload",
  "/sources/watches",
  "/install",
]

describe("D-18 — no composer file can reach a Library-writing API", () => {
  it("non-vacuity: every ?raw source is real and is the file it claims to be", () => {
    for (const [name, src, own] of FILES) {
      expect(src.length, name).toBeGreaterThan(200)
      expect(stripComments(src), name).toContain(own)
    }
  })

  it("none of the eight minting tokens appears in code (comments stripped)", () => {
    for (const [name, src] of FILES) {
      const code = stripComments(src)
      for (const token of MINTERS) {
        expect(code.includes(token), `${name} contains ${token}`).toBe(false)
      }
    }
  })

  it("the fence can fire: a planted minter call is caught after stripping", () => {
    const planted = `${connectorsFlyout}\nvoid importCloudFile("t", "c", "f")\n`
    expect(stripComments(planted).includes("importCloudFile")).toBe(true)
    // ...while the same token inside a comment is NOT a finding.
    expect(stripComments(`// importCloudFile\n/* createWatch */`).includes("importCloudFile")).toBe(false)
  })

  it("ConnectorsFlyout imports exactly `listConnectorConnections` from @/lib/api", () => {
    const code = stripComments(connectorsFlyout)
    const imports = [...code.matchAll(/import\s*\{([^}]*)\}\s*from\s*"@\/lib\/api"/g)]
    expect(imports).toHaveLength(1)
    const names = imports[0][1]
      .split(",")
      .map((n) => n.trim())
      .filter((n) => n && !n.startsWith("type "))
    expect(names).toEqual(["listConnectorConnections"])
  })
})

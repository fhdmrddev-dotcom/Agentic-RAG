/**
 * Phase 293-04 (D-18) — the workflow card's ⋯ menu offers "New API key…" on a published row the
 * caller owns and can run, directly under Schedules, and hands up `{ id, name }` (the ROW id: a
 * key pins the exact definition version, as a schedule does).
 *
 * Driven through the CARD so the `onApiKey` pass-through is proved too. Without `onApiKey` the
 * item is absent, which is what keeps `WorkflowCard.seam286.pin.test.tsx` and its snapshot
 * byte-unchanged (that pin passes no such prop).
 *
 * ⚠ Owned-only is the server's rule, not a UI preference: `GET /api-keys/startable-workflows` lists
 *   only the caller's OWN published workflows, so offering the item on a shared row would be an
 *   affordance that exists only to land on a draft card that cannot tick it.
 */
import { describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/lib/api", () => ({
  deleteWorkflowDraft: vi.fn(),
  deleteWorkflowCascade: vi.fn(),
  getWorkflowDeletePreview: vi.fn(),
}))

import { WorkflowCard, type WorkflowCardProps } from "../WorkflowCard"
import type { LibraryRow, Provenance } from "../libraryRow"
import { OWN_SHARED, OWN_YOURS } from "../libraryVocabulary"

const DEF = {
  slug: "vendor-risk",
  version: 3,
  business_requirement: "Review a vendor contract and flag the clauses that need sign-off.",
  inputs: [{ key: "contract_file" }],
  phases: [{ slug: "read", phase_index: 0, config: { phase_type: "llm_agent" } }],
}

const rowOf = (provenance: Provenance, over: Partial<LibraryRow> = {}): LibraryRow => ({
  id: `row-${provenance}`,
  slug: `vendor-risk-${provenance}`,
  name: "Vendor-risk review",
  version: 3,
  def: DEF as unknown as LibraryRow["def"],
  provenance,
  isMine: provenance === "starter" ? false : true,
  updatedAt: "2026-06-12T09:30:15.123456+00:00",
  lastRunAt: undefined,
  lastRunStatus: undefined,
  hasAnyRun: undefined,
  source: { id: `row-${provenance}`, slug: `vendor-risk-${provenance}`, name: "Vendor-risk review" } as unknown as LibraryRow["source"],
  ...over,
})

const ROOT: Record<Provenance, string> = { published: "published-card", starter: "starter-card", draft: "draft-card" }

function renderCard(row: LibraryRow, over: Partial<WorkflowCardProps> = {}) {
  const props: WorkflowCardProps = {
    row,
    folderName: null,
    onRun: vi.fn(),
    onOpen: vi.fn(),
    onRunLog: vi.fn(),
    onSchedule: vi.fn(),
    onForkNewVersion: vi.fn(),
    onForkStarter: vi.fn(),
    onDeleted: vi.fn(),
    identity: { own: row.isMine === false ? OWN_SHARED : OWN_YOURS, segs: [], ofN: null, when: "changed 2 months ago" },
    now: Date.parse("2026-06-20T12:00:00Z"),
    ...over,
  }
  render(<WorkflowCard {...props} />)
  return screen.getByTestId(ROOT[row.provenance])
}

async function openMenu(card: HTMLElement) {
  const user = userEvent.setup()
  await user.click(within(card).getByRole("button", { name: /workflow actions/i }))
  return { user, menu: await screen.findByRole("menu") }
}

describe("293-04 ⋯ menu → New API key…", () => {
  it("a published row the caller owns: the item sits directly under Schedules and hands up {id, name}", async () => {
    const onApiKey = vi.fn()
    const card = renderCard(rowOf("published"), { onApiKey })
    const { user, menu } = await openMenu(card)
    const items = within(menu).getAllByRole("menuitem")
    const schedules = items.findIndex((el) => el.getAttribute("data-testid") === "workflow-schedules")
    expect(items[schedules + 1]).toHaveAttribute("data-testid", "workflow-api-key")
    expect(items[schedules + 1]).toHaveTextContent("New API key…")
    await user.click(items[schedules + 1])
    expect(onApiKey).toHaveBeenCalledWith({ id: "row-published", name: "Vendor-risk review" })
  })

  it("a draft row: absent", async () => {
    const card = renderCard(rowOf("draft"), { onApiKey: vi.fn() })
    const { menu } = await openMenu(card)
    expect(within(menu).queryByTestId("workflow-api-key")).toBeNull()
  })

  it("a published row someone else owns: absent", async () => {
    const card = renderCard(rowOf("published", { id: "shared", isMine: false }), { onApiKey: vi.fn() })
    const { menu } = await openMenu(card)
    expect(within(menu).queryByTestId("workflow-api-key")).toBeNull()
  })

  it("no onApiKey: absent (the 286 seam pin's render)", async () => {
    const card = renderCard(rowOf("published"))
    const { menu } = await openMenu(card)
    expect(within(menu).queryByTestId("workflow-api-key")).toBeNull()
  })
})

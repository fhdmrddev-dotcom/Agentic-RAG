/**
 * Phase 286-04 (REG-07 / D-08 / D-12) — THE CHARACTERIZATION PIN FOR THE CARD'S `⋯` SEAM.
 *
 * Written and committed against the UNMOVED card, BEFORE the overflow menu, its armed-delete
 * state machine and its prompt leave `WorkflowCard.tsx` for `WorkflowCardMenu.tsx`. The move
 * commit must leave this file and its `.snap` byte-unchanged (empty numstat). If a line here
 * has to change for the move to pass, the move changed behaviour and the SOURCE is wrong.
 *
 * What it pins, per row state (published-owned, published-shared, starter, draft,
 * already-forked):
 *   · the resting card's DOM (`outerHTML`, ids kept raw — no normalising);
 *   · the open menu's DOM and the ordered roles of its direct element children (the WR-03
 *     five-role contract, restated as an exact sequence);
 * and, on a draft, every grade of the arm-to-confirm delete: arms without calling anything,
 * Cancel disarms, Confirm shows the spinner with both buttons disabled, resolve re-fetches
 * once and closes, reject says so out loud and re-fetches nothing. Plus the callback
 * payloads (Run log `{slug,name}`, Schedules `{id,name}` — the row ID, not the slug) and the
 * endpoint choice (single-draft client with `row.id`; the slug-wide pair stays untouched).
 *
 * ⚠ Radix ids come from React's `useId`, a mount-order counter, so they are deterministic for
 * a full run of this file in its written order. A move that changed one would be a finding to
 * explain, not something to mask — which is why they are snapshotted raw.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const { mockDeleteDraft, mockCascade, mockPreview } = vi.hoisted(() => ({
  mockDeleteDraft: vi.fn(),
  mockCascade: vi.fn(),
  mockPreview: vi.fn(),
}))

// The SAME specifier the card imports, so the mock intercepts wherever the call lives.
vi.mock("@/lib/api", () => ({
  deleteWorkflowDraft: mockDeleteDraft,
  deleteWorkflowCascade: mockCascade,
  getWorkflowDeletePreview: mockPreview,
}))

import { WorkflowCard, type WorkflowCardProps } from "../WorkflowCard"
import type { LibraryRow, Provenance } from "../libraryRow"
import { OWN_SHARED, OWN_YOURS } from "../libraryVocabulary"
import type { RowIdentity } from "../rowIdentity"

// ── fixtures (shape copied from WorkflowCard.test.tsx, never imported from a test file) ──

const DEF = {
  slug: "vendor-risk",
  version: 3,
  business_requirement: "Review a vendor contract and flag the clauses that need sign-off.",
  inputs: [{ key: "contract_file" }],
  phases: [
    { slug: "read", phase_index: 0, config: { phase_type: "llm_agent", citation_policy: "must_cite" } },
  ],
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
  source: {
    id: `row-${provenance}`,
    slug: `vendor-risk-${provenance}`,
    name: "Vendor-risk review",
  } as unknown as LibraryRow["source"],
  ...over,
})

const PUBLISHED_OWNED = rowOf("published")
const PUBLISHED_SHARED = rowOf("published", { id: "row-published-shared", isMine: false })
const STARTER = rowOf("starter")
const DRAFT = rowOf("draft")

/** A fixed instant, so recency words can never drift between two runs of the snapshot. */
const NOW = Date.parse("2026-06-20T12:00:00Z")

const identityOf = (own: string): RowIdentity => ({
  own,
  segs: [],
  ofN: null,
  when: "changed 2 months ago",
})

interface Case {
  label: string
  row: LibraryRow
  hasExistingFork?: boolean
}

const STATES: Case[] = [
  { label: "published-owned", row: PUBLISHED_OWNED },
  { label: "published-shared", row: PUBLISHED_SHARED },
  { label: "starter", row: STARTER },
  { label: "draft", row: DRAFT },
  { label: "already-forked", row: PUBLISHED_OWNED, hasExistingFork: true },
]

const ROOT_TESTID: Record<Provenance, string> = {
  published: "published-card",
  starter: "starter-card",
  draft: "draft-card",
}

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
    identity: identityOf(row.isMine === false ? OWN_SHARED : OWN_YOURS),
    now: NOW,
    ...over,
  }
  render(<WorkflowCard {...props} />)
  const card = screen.getByTestId(ROOT_TESTID[row.provenance])
  return { props, card }
}

async function openOverflow(card: HTMLElement) {
  const user = userEvent.setup()
  await user.click(within(card).getByRole("button", { name: /workflow actions/i }))
  const menu = await screen.findByRole("menu")
  return { user, menu }
}

const childRoles = (menu: HTMLElement): string[] =>
  Array.from(menu.children).map((el) => el.getAttribute("role") ?? `${el.tagName.toLowerCase()}[none]`)

beforeEach(() => {
  vi.clearAllMocks()
  mockDeleteDraft.mockResolvedValue(undefined)
})

// ── 1 · the resting card ────────────────────────────────────────────────────────────

describe("286-04 pin — the resting card's DOM, per row state", () => {
  it.each(STATES)("$label renders byte-identical DOM at rest", ({ row, hasExistingFork }) => {
    const { card } = renderCard(row, { hasExistingFork })
    expect(card.outerHTML).toMatchSnapshot()
  })
})

// ── 2 · the open menu ───────────────────────────────────────────────────────────────

describe("286-04 pin — the open `⋯` menu, per row state", () => {
  const EXPECTED_ROLES: Record<string, string[]> = {
    // Run log, Schedules, the fork verb, the heavy delete, the consequence note.
    "published-owned": ["menuitem", "menuitem", "menuitem", "menuitem", "group"],
    // Same minus the heavy delete: `runnable && owned` gates it.
    "published-shared": ["menuitem", "menuitem", "menuitem", "group"],
    // Run log, the fork verb, the consequence note (no Schedules: published only; no delete).
    starter: ["menuitem", "menuitem", "group"],
    // Run log, the light delete. No fork, no Schedules, no consequence note.
    draft: ["menuitem", "menuitem"],
    "already-forked": ["menuitem", "menuitem", "menuitem", "menuitem", "group"],
  }

  it.each(STATES)("$label opens a menu with the same items and DOM", async ({ label, row, hasExistingFork }) => {
    const { card } = renderCard(row, { hasExistingFork })
    const { menu } = await openOverflow(card)
    expect(childRoles(menu)).toEqual(EXPECTED_ROLES[label])
    expect(menu.outerHTML).toMatchSnapshot()
  })

  it("the heavy delete is offered only on a published row the viewer owns", async () => {
    const owned = renderCard(PUBLISHED_OWNED)
    await openOverflow(owned.card)
    expect(screen.getByTestId("published-delete")).toBeTruthy()
    expect(screen.queryByTestId("draft-delete")).toBeNull()
  })

  it("a shared published row offers no heavy delete", async () => {
    const shared = renderCard(PUBLISHED_SHARED)
    await openOverflow(shared.card)
    expect(screen.queryByTestId("published-delete")).toBeNull()
    expect(screen.queryByTestId("draft-delete")).toBeNull()
  })
})

// ── 3 · callback payloads ──────────────────────────────────────────────────────────

describe("286-04 pin — what each menu item hands up", () => {
  it("Run log hands up { slug, name }", async () => {
    const { card, props } = renderCard(PUBLISHED_OWNED)
    const { user } = await openOverflow(card)
    await user.click(screen.getByTestId("workflow-run-log"))
    expect(props.onRunLog).toHaveBeenCalledTimes(1)
    expect(props.onRunLog).toHaveBeenCalledWith({ slug: PUBLISHED_OWNED.slug, name: PUBLISHED_OWNED.name })
  })

  it("Schedules hands up { id, name } — the row ID, never the slug", async () => {
    const { card, props } = renderCard(PUBLISHED_OWNED)
    const { user } = await openOverflow(card)
    await user.click(screen.getByTestId("workflow-schedules"))
    expect(props.onSchedule).toHaveBeenCalledTimes(1)
    expect(props.onSchedule).toHaveBeenCalledWith({ id: PUBLISHED_OWNED.id, name: PUBLISHED_OWNED.name })
  })

  it("Schedules is not offered on a draft", async () => {
    const { card } = renderCard(DRAFT)
    await openOverflow(card)
    expect(screen.queryByTestId("workflow-schedules")).toBeNull()
  })

  it("the published fork calls onForkNewVersion(row)", async () => {
    const { card, props } = renderCard(PUBLISHED_OWNED)
    const { user } = await openOverflow(card)
    await user.click(screen.getByTestId("published-tweak"))
    expect(props.onForkNewVersion).toHaveBeenCalledWith(PUBLISHED_OWNED)
    expect(props.onForkStarter).not.toHaveBeenCalled()
  })

  it("the starter fork calls onForkStarter(row)", async () => {
    const { card, props } = renderCard(STARTER)
    const { user } = await openOverflow(card)
    await user.click(screen.getByTestId("use-starter"))
    expect(props.onForkStarter).toHaveBeenCalledWith(STARTER)
    expect(props.onForkNewVersion).not.toHaveBeenCalled()
  })
})

// ── 4 · the draft delete's grades ─────────────────────────────────────────────────────

describe("286-04 pin — the draft delete arms first and deletes only on Confirm", () => {
  async function arm() {
    const rendered = renderCard(DRAFT)
    const { user } = await openOverflow(rendered.card)
    await user.click(screen.getByTestId("draft-delete"))
    const prompt = await screen.findByTestId("draft-delete-prompt")
    return { ...rendered, user, prompt }
  }

  it("the first click arms, renders the prompt, and calls no endpoint", async () => {
    const { prompt, props } = await arm()
    expect(prompt.outerHTML).toMatchSnapshot()
    expect(mockDeleteDraft).not.toHaveBeenCalled()
    expect(mockCascade).not.toHaveBeenCalled()
    expect(mockPreview).not.toHaveBeenCalled()
    expect(props.onDeleted).not.toHaveBeenCalled()
  })

  it("Cancel disarms and calls nothing", async () => {
    const { user } = await arm()
    await user.click(screen.getByTestId("draft-delete-cancel"))
    expect(screen.queryByTestId("draft-delete-prompt")).toBeNull()
    expect(mockDeleteDraft).not.toHaveBeenCalled()
  })

  it("Confirm with a pending delete shows the spinner and disables both buttons; resolve re-fetches once", async () => {
    let resolveDelete: () => void = () => {}
    mockDeleteDraft.mockImplementation(
      () => new Promise<void>((resolve) => {
        resolveDelete = resolve
      }),
    )
    const { user, props } = await arm()
    await user.click(screen.getByTestId("draft-delete-confirm"))

    const prompt = screen.getByTestId("draft-delete-prompt")
    expect((screen.getByTestId("draft-delete-confirm") as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByTestId("draft-delete-cancel") as HTMLButtonElement).disabled).toBe(true)
    expect(prompt.outerHTML).toMatchSnapshot()

    // The single-draft endpoint, with THIS row's id and nothing else.
    expect(mockDeleteDraft).toHaveBeenCalledTimes(1)
    expect(mockDeleteDraft).toHaveBeenCalledWith(DRAFT.id)
    expect(mockCascade).not.toHaveBeenCalled()
    expect(mockPreview).not.toHaveBeenCalled()
    expect(props.onDeleted).not.toHaveBeenCalled()

    await act(async () => {
      resolveDelete()
    })
    await waitFor(() => expect(screen.queryByTestId("draft-delete-prompt")).toBeNull())
    expect(props.onDeleted).toHaveBeenCalledTimes(1)
  })

  it("a rejected delete is said out loud and re-fetches nothing", async () => {
    mockDeleteDraft.mockRejectedValue(new Error("boom"))
    const { user, props } = await arm()
    await user.click(screen.getByTestId("draft-delete-confirm"))
    const error = await screen.findByTestId("draft-delete-error")
    expect(error.textContent).toBeTruthy()
    expect(screen.getByTestId("draft-delete-prompt").outerHTML).toMatchSnapshot()
    expect(props.onDeleted).not.toHaveBeenCalled()
    expect(mockCascade).not.toHaveBeenCalled()
    expect(mockPreview).not.toHaveBeenCalled()
  })
})

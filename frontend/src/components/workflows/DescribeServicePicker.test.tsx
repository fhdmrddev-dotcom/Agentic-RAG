/**
 * Phase 214-13 Task 1 — DescribeServicePicker tests (sketch 217 invariants #6, #8, #9, #10, #13).
 *
 * THE PROPERTY THIS FILE IS ABOUT: the describe door offers the author's CONNECTED services
 * as the generator's vocabulary, at the GRANT grain, and never manufactures one.
 *
 * ⚠ EVERY FENCE CARRIES A POSITIVE CONTROL. A guard nobody has watched fail is a gesture —
 * and this phase has already measured the 187-24 trap firing on prose that merely FORBIDS a
 * thing, so the credential fence below is anchored on an attribute assignment rather than on
 * a bare word, and its control proves the needle can match.
 *
 * COPY IS IMPORTED, NEVER RE-TYPED. Six of the seven strings come from `doorVocabulary.ts`
 * (they are sketch 217 §1's contract) and the seventh from the component (the authored
 * `unavailable` arm, on the `DESCRIBE_KB_UNAVAILABLE` precedent).
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"

import describeServicePickerSource from "./DescribeServicePicker?raw"
import {
  DescribeServicePicker,
  SERVICES_UNAVAILABLE,
  actionIsGranted,
  grantedActionsOf,
} from "./DescribeServicePicker"
import {
  SERVICES_EMPTY,
  SERVICES_EMPTY_NEXT,
  SERVICES_HINT,
  SERVICES_LABEL,
  SERVICE_ACTIONS,
  SERVICE_NO_GRANTS,
  SERVICE_NO_GRANTS_NEXT,
} from "./doorVocabulary"

// ── The api seam. ONE symbol may be called; the rest EXIST so "it called nothing else" is an
//    OBSERVATION rather than an absence (the `DescribeKbPicker` discipline, copied). ──
const api = vi.hoisted(() => ({
  listConnectorConnections: vi.fn(),
  getConnectorConnection: vi.fn(),
  createConnectorConnection: vi.fn(),
  updateConnectorConnection: vi.fn(),
  deleteConnectorConnection: vi.fn(),
  checkConnectorConnection: vi.fn(),
  listFolders: vi.fn(),
  generateWorkflow: vi.fn(),
}))
vi.mock("@/lib/api", () => api)

/** Everything the picker may NOT reach. All must stay at zero. */
const FORBIDDEN_SYMBOLS = [
  "getConnectorConnection",
  "createConnectorConnection",
  "updateConnectorConnection",
  "deleteConnectorConnection",
  "checkConnectorConnection",
  "listFolders",
  "generateWorkflow",
] as const

/** A connection row, narrowed to what this surface reads. `as never` keeps the fixture from
 *  having to restate every field of `ConnectorConnection` — the component reads six. */
const conn = (over: Record<string, unknown>) =>
  ({
    id: "c1",
    org_id: "o1",
    service_id: "slack",
    name: "Acme Slack",
    config: {},
    is_enabled: true,
    ...over,
  }) as never

beforeEach(() => {
  vi.clearAllMocks()
  api.listConnectorConnections.mockResolvedValue([])
})

type PickerProps = React.ComponentProps<typeof DescribeServicePicker>

const renderPicker = (
  props: Partial<Omit<PickerProps, "onChange">> & { onChange?: PickerProps["onChange"] } = {},
) => {
  const onChange = vi.fn(props.onChange ?? (() => {}))
  const utils = render(
    <DescribeServicePicker {...props} value={props.value ?? []} onChange={onChange} />,
  )
  return { onChange, ...utils }
}

describe("DescribeServicePicker — the grant grain IS the vocabulary grain (#9)", () => {
  it("a service with one ALLOWED tool is tickable and reports (1)", async () => {
    api.listConnectorConnections.mockResolvedValue([
      conn({
        discovered_tools: [{ name: "post_message", inputSchema: {} }],
        tool_grants: { post_message: "allow" },
        default_approval_posture: "ask",
      }),
    ])
    const { onChange } = renderPicker()
    const chip = await screen.findByTestId("describe-service-c1")
    expect(chip).toHaveAttribute("data-granted", "true")
    expect(screen.getByTestId("describe-service-actions-c1").textContent).toBe(
      `${SERVICE_ACTIONS({ service: "Acme Slack" })} (1)`,
    )
    fireEvent.click(chip)
    expect(onChange).toHaveBeenCalledWith(["c1"])
  })

  it("SERVICE_ACTIONS pluralises — TWO granted tools report (2) (#13)", async () => {
    api.listConnectorConnections.mockResolvedValue([
      conn({
        discovered_tools: [{ name: "post_message" }, { name: "read_channel" }],
        tool_grants: { post_message: "allow", read_channel: "allow" },
      }),
    ])
    renderPicker()
    await screen.findByTestId("describe-service-c1")
    expect(screen.getByTestId("describe-service-actions-c1").textContent).toBe(
      `${SERVICE_ACTIONS({ service: "Acme Slack" })} (2)`,
    )
  })

  it("⭐ a service whose EVERY posture is ask or deny counts as UNGRANTED, and says why", async () => {
    api.listConnectorConnections.mockResolvedValue([
      conn({
        discovered_tools: [{ name: "post_message" }, { name: "read_channel" }],
        tool_grants: { post_message: "ask", read_channel: "deny" },
        default_approval_posture: "ask",
      }),
    ])
    renderPicker()
    const chip = await screen.findByTestId("describe-service-c1")
    // PRESENT — hiding it would leave the author describing around a service they can see
    // in Settings.
    expect(chip).toBeTruthy()
    expect(chip).toHaveAttribute("data-granted", "false")
    // …NOT SELECTABLE…
    expect(chip.getAttribute("aria-pressed")).toBe("false")
    expect(chip.getAttribute("aria-disabled")).toBe("true")
    // …AND SAYS WHY, with its own next action.
    expect(screen.getByTestId("describe-service-nogrants-c1").textContent).toBe(SERVICE_NO_GRANTS)
    expect(screen.getByTestId("describe-service-nogrants-next-c1").textContent).toBe(
      SERVICE_NO_GRANTS_NEXT,
    )
  })

  it("clicking an UNGRANTED chip leaves the selected set unchanged (#9)", async () => {
    api.listConnectorConnections.mockResolvedValue([
      conn({ discovered_tools: [{ name: "post_message" }], tool_grants: { post_message: "deny" } }),
    ])
    const { onChange } = renderPicker()
    const chip = await screen.findByTestId("describe-service-c1")
    onChange.mockClear()
    fireEvent.click(chip)
    fireEvent.click(chip)
    expect(onChange).not.toHaveBeenCalled()
  })

  it("an ungranted chip is NEVER pre-selected, even when the parent still holds its id (#8)", async () => {
    api.listConnectorConnections.mockResolvedValue([
      conn({ discovered_tools: [{ name: "post_message" }], tool_grants: { post_message: "ask" } }),
    ])
    // The parent holds a stale tick — a grant revoked since the pick was made.
    renderPicker({ value: ["c1"] })
    const chip = await screen.findByTestId("describe-service-c1")
    expect(chip.getAttribute("aria-pressed")).toBe("false")
  })

  it("a stale tick on an unofferable connection is SURRENDERED back to the parent", async () => {
    api.listConnectorConnections.mockResolvedValue([
      conn({ discovered_tools: [{ name: "post_message" }], tool_grants: { post_message: "ask" } }),
    ])
    const onChange = vi.fn()
    renderPicker({ value: ["c1"], onChange })
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([]))
  })

  it("every chip declares pressed · grants · service (#8)", async () => {
    api.listConnectorConnections.mockResolvedValue([
      conn({ tool_grants: { post_message: "allow" }, discovered_tools: [{ name: "post_message" }] }),
    ])
    renderPicker({ value: ["c1"] })
    const chip = await screen.findByTestId("describe-service-c1")
    expect(chip.getAttribute("aria-pressed")).toBe("true")
    expect(chip.getAttribute("data-granted")).toBe("true")
    expect(chip.getAttribute("data-service")).toBe("slack")
  })
})

describe("DescribeServicePicker — the four states, held apart", () => {
  it("the EMPTY picker states itself AND offers the next action (#10)", async () => {
    api.listConnectorConnections.mockResolvedValue([])
    renderPicker()
    await screen.findByTestId("describe-services-empty")
    expect(screen.getByText(SERVICES_EMPTY)).toBeTruthy()
    expect(screen.getByTestId("describe-services-empty-next").textContent).toBe(SERVICES_EMPTY_NEXT)
    expect(screen.getByTestId("describe-services-state").getAttribute("data-state")).toBe("none")
  })

  it('"we could not ask" is a DIFFERENT fact and never borrows SERVICES_EMPTY\'s words', async () => {
    api.listConnectorConnections.mockRejectedValue(new Error("network"))
    renderPicker()
    await screen.findByTestId("describe-services-unavailable")
    expect(screen.getByText(SERVICES_UNAVAILABLE)).toBeTruthy()
    expect(screen.queryByText(SERVICES_EMPTY)).toBeNull()
    expect(screen.getByTestId("describe-services-state").getAttribute("data-state")).toBe(
      "unavailable",
    )
  })

  it("the next action is a CONTROL only when a destination is supplied (SEED-185)", async () => {
    api.listConnectorConnections.mockResolvedValue([])
    const onOpenSettings = vi.fn()
    const { unmount } = renderPicker({ onOpenSettings })
    const asButton = await screen.findByTestId("describe-services-empty-next")
    expect(asButton.tagName).toBe("BUTTON")
    fireEvent.click(asButton)
    expect(onOpenSettings).toHaveBeenCalledTimes(1)
    unmount()

    renderPicker()
    const asStatement = await screen.findByTestId("describe-services-empty-next")
    // POSITIVE CONTROL for the negative half above: the words render EITHER WAY, so the
    // author is never left with nothing at all.
    expect(asStatement.tagName).not.toBe("BUTTON")
    expect(asStatement.textContent).toBe(SERVICES_EMPTY_NEXT)
  })

  it("the label and the hint render on every settled arm, and the group is not a gate", async () => {
    api.listConnectorConnections.mockResolvedValue([
      conn({ tool_grants: { post_message: "allow" }, discovered_tools: [{ name: "post_message" }] }),
    ])
    renderPicker()
    await screen.findByTestId("describe-service-c1")
    expect(screen.getByText(SERVICES_LABEL)).toBeTruthy()
    expect(screen.getByTestId("describe-services-hint").textContent).toBe(SERVICES_HINT)
    // A CONTROL, never a GATE: nothing here is required or marked invalid.
    const group = screen.getByTestId("describe-services")
    expect(group.querySelectorAll("[required]").length).toBe(0)
    expect(group.querySelectorAll("[aria-invalid='true']").length).toBe(0)
  })
})

describe("DescribeServicePicker — what it may not do", () => {
  it("⛔ NO CREDENTIAL FIELD ON THIS DOOR (#6, D-214-21)", () => {
    // ⚠ ANCHORED ON AN ATTRIBUTE ASSIGNMENT, NEVER A BARE WORD. The 187-24 trap fired
    // repeatedly in this phase: a raw-text grep counts its own prose, including a docblock
    // that merely FORBIDS the thing — and the docblock above says "credential" three times.
    const needles = [
      `type=${'"'}password${'"'}`,
      `name=${'"'}token${'"'}`,
      `name=${'"'}secret${'"'}`,
      `name=${'"'}client_id${'"'}`,
    ]
    for (const needle of needles) {
      expect(describeServicePickerSource).not.toContain(needle)
    }
    // POSITIVE CONTROL — the needle SHAPE can match, so the zeros above are not free.
    expect(`<input type=${'"'}password${'"'} />`).toContain(needles[0])
    // …and the source really was read.
    expect(describeServicePickerSource.length).toBeGreaterThan(2000)
    // No raw-HTML sink either — anchored on the PROP ASSIGNMENT (the 214-03 remedy), since
    // eight files under this directory name the API only in a docblock promising never to
    // use it.
    expect(describeServicePickerSource).not.toContain("dangerouslySetInnerHTML=")
    expect(`<p dangerouslySetInnerHTML={x} />`).toContain("dangerouslySetInnerHTML=")
  })

  it("it consults the shipped connections read and NOTHING else", async () => {
    api.listConnectorConnections.mockResolvedValue([])
    renderPicker()
    await screen.findByTestId("describe-services-empty")
    expect(api.listConnectorConnections).toHaveBeenCalledTimes(1)
    for (const name of FORBIDDEN_SYMBOLS) expect(api[name]).toHaveBeenCalledTimes(0)
    // POSITIVE CONTROL — the forbidden list is non-empty and its members are real mocks, so
    // the zeros above are assertions rather than typos.
    expect(FORBIDDEN_SYMBOLS.length).toBeGreaterThan(3)
    for (const name of FORBIDDEN_SYMBOLS) expect(typeof api[name]).toBe("function")
  })

  it("a row with no usable id is DROPPED rather than rendered as an untickable blank", async () => {
    api.listConnectorConnections.mockResolvedValue([
      conn({ id: "   ", tool_grants: { post_message: "allow" } }),
      conn({ id: "c2", name: "", service_id: "jira", tool_grants: { create_ticket: "allow" } }),
    ])
    renderPicker()
    const kept = await screen.findByTestId("describe-service-c2")
    // TOTALITY: a nameless connection names ITSELF rather than rendering blank.
    expect(kept.textContent).toContain("jira")
    expect(screen.queryByTestId("describe-service-   ")).toBeNull()
  })
})

describe("grantedActionsOf — the executor's question, not the toggle's", () => {
  it("an ABSENT key inherits default_approval_posture (D-213-06), both ways", () => {
    const allowByDefault = { tool_grants: {}, default_approval_posture: "allow" } as never
    const askByDefault = { tool_grants: {}, default_approval_posture: "ask" } as never
    expect(actionIsGranted(allowByDefault, "post_message")).toBe(true)
    expect(actionIsGranted(askByDefault, "post_message")).toBe(false)
  })

  it("an EXPLICIT key wins over the default, and an unrecognised value fails CLOSED", () => {
    const explicitDeny = {
      tool_grants: { post_message: "deny" },
      default_approval_posture: "allow",
    } as never
    expect(actionIsGranted(explicitDeny, "post_message")).toBe(false)
    const nonsense = { tool_grants: { post_message: "yes" }, default_approval_posture: "allow" } as never
    // ⚠ It must NOT fall through to the inherited `allow` — the server fails closed to
    // `deny`, and a client that inherited here would offer a vocabulary the server refuses.
    expect(actionIsGranted(nonsense, "post_message")).toBe(false)
  })

  it("the LEGACY boolean spelling is honoured, exactly as the server honours it", () => {
    expect(actionIsGranted({ tool_grants: { t: true } } as never, "t")).toBe(true)
    expect(actionIsGranted({ tool_grants: { t: false }, default_approval_posture: "allow" } as never, "t")).toBe(
      false,
    )
  })

  it("a prototype key is not a grant", () => {
    // `grants["constructor"]` reaches `Object.prototype` on a bare index.
    expect(actionIsGranted({ tool_grants: {}, default_approval_posture: "ask" } as never, "constructor")).toBe(
      false,
    )
  })

  it("a NATIVE connection's candidate action is its capability — gate 5.5's own fallback", () => {
    const native = conn({
      capability: "send_email",
      discovered_tools: undefined,
      tool_grants: { send_email: "allow" },
    })
    expect(grantedActionsOf(native)).toEqual(["send_email"])
  })

  it("a grant for an action the server no longer advertises is still a grant", () => {
    const drifted = conn({ discovered_tools: [{ name: "read_channel" }], tool_grants: { post_message: "allow" } })
    expect(grantedActionsOf(drifted)).toEqual(["post_message"])
  })
})

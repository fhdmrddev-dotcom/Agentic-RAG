import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { useOperatorProbe } from "./useOperatorProbe"
import { getOperatorProbe, type OperatorIdentity } from "@/lib/api"

// Mock the api module so the hook never touches the network — the contract we
// pin is: identity → isOperator true; null (404) → isOperator false; and (WR-01)
// the probe is keyed to the authenticated user id, re-running on change and
// clearing on sign-out.
vi.mock("@/lib/api", () => ({
  getOperatorProbe: vi.fn(),
}))

const mockedProbe = vi.mocked(getOperatorProbe)

const IDENTITY: OperatorIdentity = {
  id: "op-1",
  email: "operator@example.com",
  granted_at: "2026-07-10T00:00:00Z",
}

describe("useOperatorProbe", () => {
  beforeEach(() => {
    mockedProbe.mockReset()
  })

  it("200 → isOperator true with the identity populated", async () => {
    mockedProbe.mockResolvedValue(IDENTITY)

    const { result } = renderHook(() => useOperatorProbe("u1"))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isOperator).toBe(true)
    expect(result.current.identity).toEqual(IDENTITY)
    expect(mockedProbe).toHaveBeenCalledTimes(1)
  })

  it("404 (null) → isOperator false with identity null", async () => {
    mockedProbe.mockResolvedValue(null)

    const { result } = renderHook(() => useOperatorProbe("u1"))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isOperator).toBe(false)
    expect(result.current.identity).toBeNull()
    expect(mockedProbe).toHaveBeenCalledTimes(1)
  })

  it("WR-01: no userId (signed out) → never probes, resolves fail-closed", async () => {
    const { result } = renderHook(() => useOperatorProbe(null))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isOperator).toBe(false)
    expect(result.current.identity).toBeNull()
    expect(mockedProbe).not.toHaveBeenCalled()
  })

  it("WR-01: re-probes when the userId changes (fresh SPA sign-in)", async () => {
    // Start signed-out: no probe, no shield.
    mockedProbe.mockResolvedValue(IDENTITY)
    const { result, rerender } = renderHook(
      ({ uid }: { uid: string | null }) => useOperatorProbe(uid),
      { initialProps: { uid: null as string | null } },
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isOperator).toBe(false)
    expect(mockedProbe).not.toHaveBeenCalled()

    // Operator signs in via onAuthStateChange (SPA state change, no reload):
    // the effect re-fires on the new userId and the shield appears.
    rerender({ uid: "op-user" })
    await waitFor(() => expect(result.current.isOperator).toBe(true))
    expect(result.current.identity).toEqual(IDENTITY)
    expect(mockedProbe).toHaveBeenCalledTimes(1)
  })

  it("WR-01: clears stale operator state on a same-tab user switch to a non-operator", async () => {
    // First user is an operator.
    mockedProbe.mockResolvedValueOnce(IDENTITY)
    const { result, rerender } = renderHook(
      ({ uid }: { uid: string | null }) => useOperatorProbe(uid),
      { initialProps: { uid: "op-user" as string | null } },
    )
    await waitFor(() => expect(result.current.isOperator).toBe(true))

    // Switch to a different, non-operator user (probe now resolves null): the
    // prior operator identity/email must NOT leak.
    mockedProbe.mockResolvedValueOnce(null)
    rerender({ uid: "other-user" })
    await waitFor(() => expect(result.current.isOperator).toBe(false))
    expect(result.current.identity).toBeNull()
    expect(mockedProbe).toHaveBeenCalledTimes(2)
  })
})

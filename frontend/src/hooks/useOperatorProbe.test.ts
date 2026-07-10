import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { useOperatorProbe } from "./useOperatorProbe"
import { getOperatorProbe, type OperatorIdentity } from "@/lib/api"

// Mock the api module so the hook never touches the network — the contract we
// pin is: identity → isOperator true; null (404) → isOperator false.
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

    const { result } = renderHook(() => useOperatorProbe())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isOperator).toBe(true)
    expect(result.current.identity).toEqual(IDENTITY)
    expect(mockedProbe).toHaveBeenCalledTimes(1)
  })

  it("404 (null) → isOperator false with identity null", async () => {
    mockedProbe.mockResolvedValue(null)

    const { result } = renderHook(() => useOperatorProbe())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isOperator).toBe(false)
    expect(result.current.identity).toBeNull()
    expect(mockedProbe).toHaveBeenCalledTimes(1)
  })
})

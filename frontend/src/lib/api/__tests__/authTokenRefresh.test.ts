/**
 * BUG-260906-01 — the 401 burst at access-token expiry.
 *
 * ⛔ THE SYMPTOM, from the operator's backend log: dozens of consecutive
 *      GET /sources/watches 401 · GET /sources/health 401 · GET /connectors/connections 401
 *    repeating, then recovering to 200 unaided.
 *
 * ⚠ The 401s PROVE a token was sent — `getAuthHeaders` throws when there is no session, so an
 *   unauthenticated request is never issued. The JWT was present and EXPIRED: Supabase access
 *   tokens are short-lived and `getSession()` returns the stale one during the refresh window.
 *
 * ⚠ It burst because every surface asks independently: three pollers, three dead tokens, three
 *   401s, each retrying on its own clock. So the fix has TWO halves and this file drives both —
 *   refresh BEFORE use, and exactly ONE refresh no matter how many callers race.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const getSession = vi.fn()
const refreshSession = vi.fn()

vi.mock("../../supabase", () => ({
  supabase: { auth: { getSession: () => getSession(), refreshSession: () => refreshSession() } },
}))

const NOW = () => Math.floor(Date.now() / 1000)
const session = (token: string, expiresInSeconds: number) => ({
  data: { session: { access_token: token, expires_at: NOW() + expiresInSeconds } },
})

async function freshImport() {
  vi.resetModules()
  return await import("../_core")
}

beforeEach(() => {
  getSession.mockReset()
  refreshSession.mockReset()
})

describe("access token freshness", () => {
  it("uses the existing token untouched when it is comfortably valid", async () => {
    getSession.mockResolvedValue(session("good-token", 3600))
    const { getAuthToken } = await freshImport()

    expect(await getAuthToken()).toBe("good-token")
    expect(refreshSession).not.toHaveBeenCalled()
  })

  it("⛔ refreshes BEFORE sending when the token is already expired", async () => {
    getSession.mockResolvedValue(session("dead-token", -30))
    refreshSession.mockResolvedValue({ data: { session: { access_token: "new-token" } } })
    const { getAuthToken } = await freshImport()

    expect(await getAuthToken()).toBe("new-token")
    expect(refreshSession).toHaveBeenCalledTimes(1)
  })

  it("refreshes inside the skew window too — a token about to die must not be sent", async () => {
    getSession.mockResolvedValue(session("nearly-dead", 10))
    refreshSession.mockResolvedValue({ data: { session: { access_token: "new-token" } } })
    const { getAuthToken } = await freshImport()

    expect(await getAuthToken()).toBe("new-token")
  })

  it("⛔ SIX CONCURRENT CALLERS CAUSE EXACTLY ONE REFRESH — the burst, at its source", async () => {
    getSession.mockResolvedValue(session("dead-token", -30))
    let resolveRefresh: (v: unknown) => void = () => {}
    refreshSession.mockReturnValue(
      new Promise((r) => {
        resolveRefresh = r
      }),
    )
    const { getAuthToken } = await freshImport()

    const all = Promise.all(Array.from({ length: 6 }, () => getAuthToken()))
    resolveRefresh({ data: { session: { access_token: "new-token" } } })

    expect(await all).toEqual(Array(6).fill("new-token"))
    expect(refreshSession).toHaveBeenCalledTimes(1)
  })

  it("a later expiry refreshes again — the de-dupe must not latch", async () => {
    getSession.mockResolvedValue(session("dead-token", -30))
    refreshSession.mockResolvedValue({ data: { session: { access_token: "new-token" } } })
    const { getAuthToken } = await freshImport()

    await getAuthToken()
    await getAuthToken()
    expect(refreshSession).toHaveBeenCalledTimes(2)
  })
})

describe("failure behaviour is unchanged", () => {
  it("still throws the identical error when there is no session at all", async () => {
    getSession.mockResolvedValue({ data: { session: null } })
    const { getAuthToken, getAuthHeaders } = await freshImport()

    await expect(getAuthToken()).rejects.toThrow("Not authenticated")
    await expect(getAuthHeaders()).rejects.toThrow("Not authenticated")
    expect(refreshSession).not.toHaveBeenCalled()
  })

  // ⚠ CORRECTED, AND THE ORIGINAL IS QUOTED RATHER THAN QUIETLY DELETED. This test used to
  //   assert "a FAILED refresh degrades to the held token — the old behaviour, not a new
  //   failure", and it passed. It was WRONG, and it was defending the exact behaviour that
  //   produced BUG-260906-03: an EXPIRED token whose refresh failed was handed back and sent,
  //   which is how one dead session became ~100 consecutive 401s from three pollers.
  //
  // ⚠ THE DISTINCTION THE ORIGINAL MISSED is between a token we merely could not refresh and
  //   one we KNOW is unusable. A transient blip on a still-valid token must not become a hard
  //   throw — that case is preserved, and is proven by the last test in this file.
  it("⛔ an EXPIRED token whose refresh fails is refused, not sent", async () => {
    getSession.mockResolvedValue(session("dead-token", -30))
    refreshSession.mockRejectedValue(new Error("network down"))
    const { getAuthToken } = await freshImport()

    await expect(getAuthToken()).rejects.toThrow("Not authenticated")
  })

  it("carries the Authorization header with the REFRESHED token", async () => {
    getSession.mockResolvedValue(session("dead-token", -30))
    refreshSession.mockResolvedValue({ data: { session: { access_token: "new-token" } } })
    const { getAuthHeaders } = await freshImport()

    expect(await getAuthHeaders()).toMatchObject({ Authorization: "Bearer new-token" })
  })
})

describe("BUG-260906-03 — a rejected session must stop the retry flood", () => {
  it("⛔ a dead token is NOT sent again once the refresh also fails", async () => {
    getSession.mockResolvedValue(session("dead-token", -30))
    refreshSession.mockResolvedValue({ data: { session: null } })
    const { getAuthToken } = await freshImport()

    // Refusing here is the whole fix: the request is never issued, so it cannot 401.
    await expect(getAuthToken()).rejects.toThrow("Not authenticated")
  })

  it("a 401 latches the session as rejected, forcing a refresh on a still-valid token", async () => {
    getSession.mockResolvedValue(session("looks-fine", 3600))
    refreshSession.mockResolvedValue({ data: { session: { access_token: "rotated" } } })
    const { getAuthToken, ApiError } = await freshImport()

    expect(await getAuthToken()).toBe("looks-fine")
    expect(refreshSession).not.toHaveBeenCalled()

    // The server says otherwise — a token can be inside its exp and still be dead (a
    // Supabase restart rotates the JWT secret).
    new ApiError("Invalid or expired token", 401)

    expect(await getAuthToken()).toBe("rotated")
    expect(refreshSession).toHaveBeenCalledTimes(1)
  })

  it("⚠ a SUCCESSFUL refresh lifts the latch — one spurious 401 must not sign anybody out", async () => {
    getSession.mockResolvedValue(session("looks-fine", 3600))
    refreshSession.mockResolvedValue({ data: { session: { access_token: "rotated" } } })
    const { getAuthToken, ApiError } = await freshImport()

    new ApiError("Invalid or expired token", 401)
    expect(await getAuthToken()).toBe("rotated")

    // Latch lifted: the next call goes straight through with no further refresh.
    expect(await getAuthToken()).toBe("looks-fine")
    expect(refreshSession).toHaveBeenCalledTimes(1)
  })

  it("a transient refresh blip on a VALID token still sends it — no new failure mode", async () => {
    getSession.mockResolvedValue(session("valid-token", 3600))
    refreshSession.mockRejectedValue(new Error("network blip"))
    const { getAuthToken } = await freshImport()

    expect(await getAuthToken()).toBe("valid-token")
  })
})

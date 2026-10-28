/**
 * Phase 298-04 (D-15 / UI-D11) — the out-of-org folder marker's words, and the read behind them.
 *
 * `folderLabel.ts` is the one place a bound folder's picker text is decided: an in-org name, a
 * visible folder in another org with "lives in {Org}", or `UNNAMED_KB_OPTION` when the caller
 * cannot see it — never a raw id. `getFolderLabels` is the 298-01 route's client: no request for
 * no ids, comma-joined, chunked at 50, a non-OK answer throws.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("@/lib/api/_core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/_core")>()
  return {
    ...actual,
    getAuthHeaders: vi.fn().mockResolvedValue({ Authorization: "Bearer t", "X-Org-Id": "org-a" }),
  }
})

import { chipLabel, optionLabel } from "@/components/workflows/folderLabel"
import { getFolderLabels, type FolderLabel } from "@/lib/api/orgItems"
import { ApiError } from "@/lib/api/_core"
import { UNNAMED_KB_OPTION } from "@/components/workflows/builderCopy"
import { LIVES_IN } from "@/components/org/orgItemsCopy"

const Q3: FolderLabel = { id: "q3", name: "Q3 Contracts", org_id: "org-legal", org_name: "Acme Legal" }

describe("optionLabel / chipLabel — the marker's words (UI-D11)", () => {
  it("an in-org folder reads as its name", () => {
    expect(optionLabel("q3", { inOrgName: "Q3 Contracts" })).toBe("Q3 Contracts")
    expect(chipLabel("q3", { inOrgName: "Q3 Contracts" })).toBe("Q3 Contracts")
  })

  it("a visible folder in another org reads as its name plus where it lives", () => {
    expect(optionLabel("q3", { label: Q3 })).toBe("Q3 Contracts — lives in Acme Legal")
    expect(chipLabel("q3", { label: Q3 })).toBe("Q3 Contracts · lives in Acme Legal")
    expect(LIVES_IN("Acme Legal")).toBe("lives in Acme Legal")
  })

  it("a label for the ACTIVE org reads as a plain name (nothing to mark)", () => {
    expect(optionLabel("q3", { label: Q3, activeOrgId: "org-legal" })).toBe("Q3 Contracts")
  })

  it("a folder the caller cannot see reads as UNNAMED_KB_OPTION — never the raw id", () => {
    expect(optionLabel("aaaaaaaa-0000-4000-8000-000000000001", {})).toBe(UNNAMED_KB_OPTION)
    expect(chipLabel("aaaaaaaa-0000-4000-8000-000000000001", { label: null })).toBe(UNNAMED_KB_OPTION)
    expect(optionLabel("x", {})).not.toContain("x")
  })
})

describe("getFolderLabels — the folder-labels read (298-01 route)", () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  const ok = (labels: FolderLabel[]) =>
    Promise.resolve(new Response(JSON.stringify({ labels }), { status: 200 }))

  it("resolves [] for [] without a request", async () => {
    await expect(getFolderLabels([])).resolves.toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("sends the ids comma-joined, with the auth headers, and returns the labels", async () => {
    fetchMock.mockReturnValueOnce(ok([Q3]))
    await expect(getFolderLabels(["q3", "zz", "q3"])).resolves.toEqual([Q3])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain("/org-items/folder-labels?")
    expect(new URL(url, "http://x").searchParams.get("ids")).toBe("q3,zz")
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer t")
  })

  it("chunks a long list at 50 ids per request", async () => {
    fetchMock.mockImplementation(() => ok([]))
    const ids = Array.from({ length: 120 }, (_, i) => `id-${i}`)
    await getFolderLabels(ids)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    const sizes = fetchMock.mock.calls.map(
      ([url]) => (new URL(url as string, "http://x").searchParams.get("ids") ?? "").split(",").length,
    )
    expect(sizes).toEqual([50, 50, 20])
  })

  it("a non-OK answer throws ApiError", async () => {
    fetchMock.mockReturnValueOnce(Promise.resolve(new Response("{}", { status: 422 })))
    await expect(getFolderLabels(["q3"])).rejects.toBeInstanceOf(ApiError)
  })
})

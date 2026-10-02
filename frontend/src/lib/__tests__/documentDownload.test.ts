/**
 * Phase 270 (270-03) — the ONE label/request derivation for the document download control.
 * Spike 270-SPIKE.md chose NAVIGATION (transient anchor to the signed URL).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const getDocumentDownloadUrl = vi.fn()

vi.mock("@/lib/api", () => {
  class DownloadError extends Error {
    readonly status: number | "network"
    constructor(status: number | "network", message: string) {
      super(message)
      this.status = status
      this.name = "DownloadError"
    }
  }
  return { getDocumentDownloadUrl: (...a: unknown[]) => getDocumentDownloadUrl(...a), DownloadError }
})

import { DownloadError } from "@/lib/api"
import {
  downloadLabel,
  downloadErrorCopy,
  startDocumentDownload,
  VersionMismatchError,
} from "../documentDownload"

describe("downloadLabel", () => {
  it("reads 'Download' when there is no version or only v1", () => {
    expect(downloadLabel({ version_number: undefined, is_latest: undefined })).toBe("Download")
    expect(downloadLabel({ version_number: 1, is_latest: true })).toBe("Download")
  })
  it("names the latest version", () => {
    expect(downloadLabel({ version_number: 3, is_latest: true })).toBe("Download v3 (latest)")
    expect(downloadLabel({ version_number: 3, is_latest: undefined })).toBe("Download v3 (latest)")
  })
  it("says so when the viewed version is not the latest", () => {
    expect(downloadLabel({ version_number: 2, is_latest: false })).toBe(
      "Download v2 (viewed, not latest)",
    )
  })
})

describe("startDocumentDownload", () => {
  let created: HTMLAnchorElement[]
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    getDocumentDownloadUrl.mockReset()
    created = []
    const realCreate = document.createElement.bind(document)
    vi.spyOn(document, "createElement").mockImplementation((tag: string, o?: ElementCreationOptions) => {
      const el = realCreate(tag, o)
      if (tag === "a") {
        created.push(el as HTMLAnchorElement)
        vi.spyOn(el as HTMLAnchorElement, "click").mockImplementation(() => {})
      }
      return el
    })
    fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  const doc = { id: "d1", version_number: 3, filename: "contract.pdf" }

  it("mints for the same doc id, exactly once", async () => {
    getDocumentDownloadUrl.mockResolvedValue({ url: "https://s/x", expires_in: 60, version_number: 3, filename: "contract.pdf" })
    await startDocumentDownload(doc)
    expect(getDocumentDownloadUrl).toHaveBeenCalledTimes(1)
    expect(getDocumentDownloadUrl).toHaveBeenCalledWith("d1")
  })

  it("saves via ONE transient anchor and leaves none behind; resolves undefined", async () => {
    getDocumentDownloadUrl.mockResolvedValue({ url: "https://s/x", expires_in: 60, version_number: 3, filename: "contract.pdf" })
    const out = await startDocumentDownload(doc)
    expect(out).toBeUndefined()
    expect(created).toHaveLength(1)
    expect(created[0].getAttribute("href")).toBe("https://s/x")
    expect(created[0].click).toHaveBeenCalledTimes(1)
    expect(document.body.querySelectorAll("a")).toHaveLength(0)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("refuses to save when the returned version differs from the labelled one", async () => {
    getDocumentDownloadUrl.mockResolvedValue({ url: "https://s/x", expires_in: 60, version_number: 2, filename: "contract.pdf" })
    await expect(startDocumentDownload(doc)).rejects.toBeInstanceOf(VersionMismatchError)
    expect(created).toHaveLength(0)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("treats an absent version as v1", async () => {
    getDocumentDownloadUrl.mockResolvedValue({ url: "https://s/x", expires_in: 60, version_number: 1, filename: "a.pdf" })
    await expect(startDocumentDownload({ id: "d2", version_number: undefined, filename: "a.pdf" })).resolves.toBeUndefined()
  })
})

describe("downloadErrorCopy", () => {
  it("maps each failure to its own sentence", () => {
    const noAccess = "You don't have access to this file, so no download link was created."
    expect(downloadErrorCopy(new DownloadError(404, "x"))).toBe(noAccess)
    expect(downloadErrorCopy(new DownloadError(403, "x"))).toBe(noAccess)
    expect(downloadErrorCopy(new DownloadError(410, "x"))).toBe(
      "The original file is missing from storage. Upload it again to make it downloadable.",
    )
    expect(downloadErrorCopy(new DownloadError(409, "x"))).toBe(
      "File lives in a connected source, not stored here.",
    )
    expect(downloadErrorCopy(new VersionMismatchError(3))).toBe(
      "The file returned was not v3. Nothing was downloaded.",
    )
    const generic = "Download failed. Check your connection and try again."
    expect(downloadErrorCopy(new DownloadError("network", "x"))).toBe(generic)
    expect(downloadErrorCopy(new DownloadError(500, "x"))).toBe(generic)
    expect(downloadErrorCopy(new TypeError("boom"))).toBe(generic)
  })
})

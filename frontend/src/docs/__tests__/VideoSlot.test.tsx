// Phase 276-03 (D-12, D-13, T-276-12) — an empty slot renders NOTHING; a YouTube slot loads nothing
// from YouTube until the reader presses play, and then only from youtube-nocookie.com.
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { VideoSlot } from "../video/VideoSlot"

vi.mock("../video/videos", () => ({
  VIDEOS: {
    "explainer.empty": {
      kind: "youtube",
      youtubeId: null,
      poster: null,
      title: "Not uploaded",
      durationSec: 60,
      aspect: "16:9",
    },
    "explainer.ready": {
      kind: "youtube",
      youtubeId: "abc123XYZ_-",
      poster: "/docs/posters/explainer-ready.jpg",
      title: "Workflows You Can Trust",
      durationSec: 95,
      aspect: "9:16",
    },
  },
}))

describe("VideoSlot", () => {
  it("renders nothing for an unknown slot", () => {
    const { container } = render(<VideoSlot slot="clip.nope" />)
    expect(container.innerHTML).toBe("")
  })

  it("renders nothing for a null slot", () => {
    const { container } = render(<VideoSlot slot={null} />)
    expect(container.innerHTML).toBe("")
  })

  it("renders nothing for a YouTube entry with no id yet", () => {
    const { container } = render(<VideoSlot slot="explainer.empty" />)
    expect(container.innerHTML).toBe("")
  })

  it("shows a poster button and the consent line, and no iframe, until clicked", () => {
    const { container } = render(<VideoSlot slot="explainer.ready" />)
    const button = screen.getByRole("button", { name: "Play video: Workflows You Can Trust, 1:35" })
    expect(button).toBeInTheDocument()
    expect(
      screen.getByText("Plays from YouTube in privacy-enhanced mode. Nothing loads from YouTube until you press play."),
    ).toBeInTheDocument()
    expect(screen.getByText("Workflows You Can Trust · 1:35")).toBeInTheDocument()
    expect(container.querySelector("iframe")).toBeNull()
    const img = container.querySelector("img") as HTMLImageElement
    expect(img.getAttribute("src")?.startsWith("/")).toBe(true)
    expect(container.innerHTML).not.toMatch(/ytimg|youtube\.com\/iframe_api/)

    fireEvent.click(button)
    const iframe = container.querySelector("iframe") as HTMLIFrameElement
    expect(iframe).not.toBeNull()
    expect(iframe.getAttribute("src")?.startsWith("https://www.youtube-nocookie.com/embed/abc123XYZ_-")).toBe(true)
    expect(iframe.getAttribute("title")).toBe("Workflows You Can Trust")
  })
})

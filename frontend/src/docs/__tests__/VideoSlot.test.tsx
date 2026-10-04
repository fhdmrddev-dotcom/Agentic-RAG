// Phase 276-03 (D-12, D-13, T-276-12) — an empty slot renders NOTHING; a YouTube slot loads nothing
// from YouTube until the reader presses play, and then only from youtube-nocookie.com.
// Phase 276-05 (D-11, D-18, T-276-20) — a Remotion slot downloads nothing (no @remotion/player, no
// composition) until the reader presses play; the overview is the NARRATED SyrelEnergetic; web
// playback renders no remote SFX (SfxOn=false); a failed load shows the exact error copy + retry.
import { act, createElement, lazy, Suspense, useMemo, type ComponentType } from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { VideoSlot } from "../video/VideoSlot"
import type { RemotionEntry, VideoEntry } from "../video/videos"

type PlayerProps = Record<string, unknown> & {
  component?: ComponentType<Record<string, unknown>>
  lazyComponent?: () => Promise<{ default: ComponentType<Record<string, unknown>> }>
  inputProps?: Record<string, unknown>
}

const h = vi.hoisted(() => ({ importSpy: vi.fn(), playerProps: [] as Record<string, unknown>[] }))

// The Player stand-in renders the composition it is handed (component or lazyComponent) so the
// composition's own render — and kit's Sfx under the web provider — is exercised for real.
vi.mock("@remotion/player", () => {
  h.importSpy()
  function Player(props: PlayerProps) {
    h.playerProps.push(props)
    const Comp = useMemo<ComponentType<Record<string, unknown>> | null>(
      () => (props.lazyComponent ? lazy(props.lazyComponent) : (props.component ?? null)),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [],
    )
    return createElement(
      "div",
      { "data-testid": "remotion-player" },
      Comp ? createElement(Suspense, { fallback: null }, createElement(Comp, props.inputProps ?? {})) : null,
    )
  }
  return { Player }
})

// Fonts: the compositions call @remotion/google-fonts at import time (jsdom has no FontFace).
vi.mock("@remotion/google-fonts/Manrope", () => ({ loadFont: () => ({ fontFamily: "Manrope" }) }))
vi.mock("@remotion/google-fonts/Inter", () => ({ loadFont: () => ({ fontFamily: "Inter" }) }))

// The compositions themselves are stubbed for the slot tests; each stub renders kit's REAL Sfx so
// the web provider (SfxOn=false) is what keeps it from rendering. The duration test (last) drops
// these stubs and reads the REAL modules.
vi.mock("@video/energetic/SyrelEnergetic", async () => {
  const kit = await import("@video/energetic/kit")
  return {
    ENERGETIC_DURATION: 1199,
    SyrelEnergetic: (p: Record<string, unknown>) =>
      createElement(
        "div",
        { "data-testid": "composition", "data-music": String(p.musicSrc) },
        createElement(kit.Sfx, { at: 0, src: kit.SFX.whoosh }),
      ),
  }
})
vi.mock("@video/clips/FeatureClip", async () => {
  const kit = await import("@video/energetic/kit")
  return {
    clipDuration: (id: string) => (id === "chat" ? 457 : 0),
    FeatureClip: (p: Record<string, unknown>) =>
      createElement(
        "div",
        { "data-testid": "composition", "data-clip": String(p.id) },
        createElement(kit.Sfx, { at: 0, src: kit.SFX.whoosh }),
      ),
  }
})

const broken = vi.hoisted(() => ({ load: vi.fn() }))

vi.mock("../video/videos", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../video/videos")>()
  const extra: Record<string, VideoEntry> = {
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
    "clip.broken": {
      kind: "remotion",
      load: broken.load,
      poster: "/docs-assets/posters/clip-broken.jpg",
      title: "Broken clip",
      durationInFrames: 300,
      durationSec: 10,
      aspect: "16:9",
    } as RemotionEntry,
  }
  return { ...actual, VIDEOS: { ...actual.VIDEOS, ...extra } }
})

beforeEach(() => {
  h.playerProps.length = 0
})

const lastPlayer = () => h.playerProps[h.playerProps.length - 1] as PlayerProps

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

describe("VideoSlot — Remotion (276-05)", () => {
  // ⚠ ORDER-DEPENDENT BY DESIGN: this must be the first Remotion test, because the module registry
  // is shared across the file and the import spy proves the FIRST download happens on click.
  it("home.overview: poster only, nothing imported until the click; then a licensed, controlled Player", async () => {
    const { container } = render(<VideoSlot slot="home.overview" />)
    const button = screen.getByRole("button", { name: "Play video: Watch the Syrel overview, 0:40" })
    expect(screen.getByText("Watch the Syrel overview · 0:40")).toBeInTheDocument()
    const img = container.querySelector("img") as HTMLImageElement
    expect(img.getAttribute("src")).toBe("/docs-assets/posters/home-overview.jpg")
    expect(img.getAttribute("loading")).toBe("lazy")
    expect(h.importSpy).not.toHaveBeenCalled()
    expect(screen.queryByTestId("remotion-player")).toBeNull()

    fireEvent.click(button)
    expect(await screen.findByTestId("remotion-player")).toBeInTheDocument()
    expect(h.importSpy).toHaveBeenCalledTimes(1)
    const p = lastPlayer()
    expect(p.acknowledgeRemotionLicense).toBe(true)
    expect(p.controls).toBe(true)
    expect(p.autoPlay).toBe(true)
    expect(p.clickToPlay).toBe(true)
    expect(p.fps).toBe(30)
    expect(p.compositionWidth).toBe(1920)
    expect(p.compositionHeight).toBe(1080)
    expect(p.durationInFrames).toBe(1199)
    expect(p.inputProps).toEqual({ musicSrc: null })
    // the narrated composition rendered, and web playback suppressed its remote SFX
    const comp = await screen.findByTestId("composition")
    expect(comp.getAttribute("data-music")).toBe("null")
    expect(comp.innerHTML).toBe("")
    expect(container.innerHTML).not.toMatch(/remotion\.media/)
  })

  it("the overview exposes its transcript", () => {
    render(<VideoSlot slot="home.overview" />)
    const summary = screen.getByText("Read the transcript")
    expect(summary.tagName.toLowerCase()).toBe("summary")
    expect(summary.closest("details")?.textContent).toMatch(/Answers from your knowledge\. With receipts\./)
  })

  it("clip.chat passes inputProps { id: 'chat' } and the clip's duration", async () => {
    render(<VideoSlot slot="clip.chat" />)
    fireEvent.click(screen.getByRole("button", { name: /^Play video: Chat with your knowledge, 0:15$/ }))
    expect(await screen.findByTestId("remotion-player")).toBeInTheDocument()
    const p = lastPlayer()
    expect(p.inputProps).toEqual({ id: "chat" })
    expect(p.durationInFrames).toBe(457)
    expect((await screen.findByTestId("composition")).getAttribute("data-clip")).toBe("chat")
  })

  it("an IA clip key with no shipped clip renders nothing (D-13)", () => {
    const { container } = render(<VideoSlot slot="clip.use-library-find" />)
    expect(container.innerHTML).toBe("")
    const { container: c2 } = render(<VideoSlot slot="clip.find" />)
    expect(c2.innerHTML).toBe("")
  })

  it("a failed load shows the exact error copy and a retry that loads again", async () => {
    broken.load.mockRejectedValueOnce(new Error("offline"))
    render(<VideoSlot slot="clip.broken" />)
    fireEvent.click(screen.getByRole("button", { name: "Play video: Broken clip, 0:10" }))
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("This video couldn't load. Check your connection and try again.")
    expect(screen.queryByTestId("remotion-player")).toBeNull()
    // the poster returned
    expect(screen.getByRole("button", { name: "Play video: Broken clip, 0:10" })).toBeInTheDocument()

    broken.load.mockResolvedValueOnce({
      component: () => createElement("div", { "data-testid": "composition" }),
      durationInFrames: 300,
    })
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Try loading the video again" }))
    })
    expect(await screen.findByTestId("remotion-player")).toBeInTheDocument()
    expect(broken.load).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull())
  })

  it("kit's Sfx is a real renderer outside the web provider (non-vacuity of the SfxOn arm)", async () => {
    const kit = await import("@video/energetic/kit")
    expect(kit.SfxOn).toBeDefined()
    // Outside a composition, a live Sfx needs Remotion's video config and throws — proving the
    // empty render above was the provider's doing, not an Sfx that renders nothing anyway.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() => render(createElement(kit.Sfx, { at: 0, src: kit.SFX.whoosh }))).toThrow()
    spy.mockRestore()
    const { container } = render(
      createElement(kit.SfxOn.Provider, { value: false }, createElement(kit.Sfx, { at: 0, src: kit.SFX.whoosh })),
    )
    expect(container.innerHTML).toBe("")
  })

  it("every Remotion duration in VIDEOS equals its composition's own constant", async () => {
    // vi.importActual cannot reach files outside the vitest root on this box (measured: "Cannot find
    // module '/@fs/…/video/src/…'"), so the composition stubs are dropped and the module registry
    // reset instead. This test therefore runs LAST in the file.
    vi.doUnmock("@video/clips/FeatureClip")
    vi.doUnmock("@video/energetic/SyrelEnergetic")
    vi.resetModules()
    const { VIDEOS } = await import("../video/videos")
    const fc = await import("@video/clips/FeatureClip")
    const en = await import("@video/energetic/SyrelEnergetic")
    expect(fc.clipDuration("admin")).toBeGreaterThan(0) // the real function (the stub returns 0 here)
    expect(typeof en.SyrelEnergetic).toBe("function")
    expect(Object.keys(en)).toContain("E_SCENES") // the real module (the stub exports no E_SCENES)
    const overview = VIDEOS["home.overview"] as RemotionEntry
    expect(overview.kind).toBe("remotion")
    expect(overview.durationInFrames).toBe(en.ENERGETIC_DURATION)
    expect(overview.durationSec).toBeCloseTo(en.ENERGETIC_DURATION / 30, 5)
    const ids = ["chat", "library", "workflows", "connections", "experts", "admin"] as const
    for (const id of ids) {
      const e = VIDEOS[`clip.${id}`] as RemotionEntry
      expect(e?.kind, `clip.${id}`).toBe("remotion")
      expect(e.durationInFrames, `clip.${id}`).toBe(fc.clipDuration(id))
      expect(e.poster).toBe(`/docs-assets/posters/clip-${id}.jpg`)
      expect(e.transcript && e.transcript.length > 20, `clip.${id} transcript`).toBe(true)
    }
    // exactly the shipped set — no entry for the clips that do not exist (D-13), no silent overview
    const remotionKeys = Object.entries(VIDEOS)
      .filter(([, v]) => v.kind === "remotion")
      .map(([k]) => k)
      .sort()
    expect(remotionKeys).toEqual(["clip.admin", "clip.chat", "clip.connections", "clip.experts", "clip.library", "clip.workflows", "home.overview"])
  })
})

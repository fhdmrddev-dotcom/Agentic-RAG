import { describe, it, expect } from "vitest"
import { render } from "@testing-library/react"
import {
  ChatScene,
  LibraryScene,
  WorkflowsScene,
  SkillsScene,
  ConnectionsScene,
  SettingsScene,
  OrgScene,
  ControlRoomScene,
} from "../index"
import { GAUNTLET_STAGES, MODEL_PROVIDERS } from "../../facts"

describe("Landing Tour Scenes (SEED-241 / D-226-07 / Plan 03)", () => {
  it("renders ChatScene with all story elements", () => {
    const { container } = render(<ChatScene />)
    const scene = container.querySelector(".scene.sc-chat")
    expect(scene).toBeTruthy()
    expect(container.querySelector(".c-prompt")).toBeTruthy()
    expect(container.querySelector(".c-run")).toBeTruthy()
    expect(container.querySelector(".c-ask")).toBeTruthy()
  })

  it("renders LibraryScene with decomposition layers", () => {
    const { container } = render(<LibraryScene />)
    const scene = container.querySelector(".scene.sc-lib")
    expect(scene).toBeTruthy()
    expect(container.querySelector(".l-pdf")).toBeTruthy()
    expect(container.querySelector(".l-text")).toBeTruthy()
    expect(container.querySelector(".l-table")).toBeTruthy()
    expect(container.querySelector(".l-img")).toBeTruthy()
    expect(container.querySelector(".l-folder")).toBeTruthy()
  })

  it("renders WorkflowsScene with step spine and exact gauntlet stages", () => {
    const { container } = render(<WorkflowsScene />)
    const scene = container.querySelector(".scene.sc-wf")
    expect(scene).toBeTruthy()
    const pips = container.querySelectorAll(".wp")
    expect(pips).toHaveLength(GAUNTLET_STAGES.length)
    expect(container.querySelector(".w-seal")?.textContent).toBe("PUBLISHED")
  })

  it("renders SkillsScene with eval bars and version stepper", () => {
    const { container } = render(<SkillsScene />)
    const scene = container.querySelector(".scene.sc-sk")
    expect(scene).toBeTruthy()
    expect(container.querySelector(".k-card")).toBeTruthy()
    expect(container.querySelectorAll(".kb")).toHaveLength(5)
    expect(container.querySelectorAll(".kv")).toHaveLength(3)
  })

  it("renders ConnectionsScene with 3D ring and permission gate", () => {
    const { container } = render(<ConnectionsScene />)
    const scene = container.querySelector(".scene.sc-cx")
    expect(scene).toBeTruthy()
    expect(container.querySelectorAll(".xt")).toHaveLength(6)
    expect(container.querySelector(".x-gate")).toBeTruthy()
    expect(container.querySelector(".x-ok")).toBeTruthy()
  })

  it("renders SettingsScene with model dial and re-embedding progress", () => {
    const { container } = render(<SettingsScene />)
    const scene = container.querySelector(".scene.sc-st")
    expect(scene).toBeTruthy()
    expect(container.querySelector(".t-dial")).toBeTruthy()
    expect(container.querySelector(".t-needle")).toBeTruthy()
    expect(container.querySelector(".t-prog")).toBeTruthy()
  })

  it("renders OrgScene with 6 avatars and SSO lock", () => {
    const { container } = render(<OrgScene />)
    const scene = container.querySelector(".scene.sc-org")
    expect(scene).toBeTruthy()
    expect(container.querySelectorAll(".oa")).toHaveLength(6)
    expect(container.querySelector(".o-sso")).toBeTruthy()
  })

  it("renders ControlRoomScene with vitals derived from MODEL_PROVIDERS and kill switch", () => {
    const { container } = render(<ControlRoomScene />)
    const scene = container.querySelector(".scene.sc-cr")
    expect(scene).toBeTruthy()
    expect(container.querySelectorAll(".rv")).toHaveLength(4)
    expect(scene?.textContent).toContain(`${MODEL_PROVIDERS.length - 1} / ${MODEL_PROVIDERS.length} keyed`)
    expect(container.querySelector(".r-run")).toBeTruthy()
    expect(container.querySelector(".r-stopped")).toBeTruthy()
    expect(container.querySelector(".r-switch")).toBeTruthy()
  })

  it("all 8 scenes have valid accessible aria-labels and sfloor backdrop", () => {
    const scenes = [
      <ChatScene key="1" />,
      <LibraryScene key="2" />,
      <WorkflowsScene key="3" />,
      <SkillsScene key="4" />,
      <ConnectionsScene key="5" />,
      <SettingsScene key="6" />,
      <OrgScene key="7" />,
      <ControlRoomScene key="8" />,
    ]

    for (const SceneElem of scenes) {
      const { container } = render(SceneElem)
      const scene = container.querySelector(".scene")
      expect(scene?.getAttribute("aria-label")).toBeTruthy()
      expect(container.querySelector(".sfloor")).toBeTruthy()
    }
  })
})

// @vitest-environment node
//
// Phase 276-02 — the dev/preview rewrite as a PURE function (frontend/devRouting.ts).
// Pitfall 2: before this phase every non-root, dot-less path went to app.html, so a pasted
// /docs/use/chat link in `vite dev` opened the app's login. The /docs rule must run BEFORE the
// app.html rule, and everything the old rule left alone must stay alone.
import { describe, expect, it } from "vitest"
import { rewriteDevUrl } from "../../../devRouting"

describe("rewriteDevUrl — docs entry (276-02)", () => {
  it("leaves the landing root alone", () => {
    expect(rewriteDevUrl("/")).toBe("/")
  })

  it("sends /docs, /docs/ and every /docs/* path to docs.html, keeping the query", () => {
    expect(rewriteDevUrl("/docs")).toBe("/docs.html")
    expect(rewriteDevUrl("/docs/")).toBe("/docs.html")
    expect(rewriteDevUrl("/docs/use/chat")).toBe("/docs.html")
    expect(rewriteDevUrl("/docs/use/chat?x=1")).toBe("/docs.html?x=1")
    expect(rewriteDevUrl("/docs/changelog/v4.5")).toBe("/docs.html")
  })

  it("does not treat a path that merely starts with the letters 'docs' as docs", () => {
    expect(rewriteDevUrl("/docsfoo")).toBe("/app.html")
  })

  it("leaves dotted asset paths alone (docs assets, VO, music)", () => {
    expect(rewriteDevUrl("/docs-assets/search-index.json")).toBe("/docs-assets/search-index.json")
    expect(rewriteDevUrl("/vo/clip-chat.wav")).toBe("/vo/clip-chat.wav")
    expect(rewriteDevUrl("/music/syrel-pulse.mp3")).toBe("/music/syrel-pulse.mp3")
    expect(rewriteDevUrl("/docs.html")).toBe("/docs.html")
  })
})

describe("rewriteDevUrl — today's app rule is preserved", () => {
  it("routes app paths to app.html, keeping the query", () => {
    expect(rewriteDevUrl("/app")).toBe("/app.html")
    expect(rewriteDevUrl("/setup?t=1")).toBe("/app.html?t=1")
    expect(rewriteDevUrl("/invite/abc")).toBe("/app.html")
    expect(rewriteDevUrl("/admin/spend")).toBe("/app.html")
  })

  it("leaves Vite internals and source paths alone", () => {
    expect(rewriteDevUrl("/src/main.tsx")).toBe("/src/main.tsx")
    expect(rewriteDevUrl("/@vite/client")).toBe("/@vite/client")
    expect(rewriteDevUrl("/__x")).toBe("/__x")
    expect(rewriteDevUrl("/node_modules/x")).toBe("/node_modules/x")
  })

  it("treats an empty url as the root", () => {
    expect(rewriteDevUrl("")).toBe("/")
  })
})

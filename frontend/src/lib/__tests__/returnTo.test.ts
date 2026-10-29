/**
 * Phase 299-05 (LINK-06 / D-22, D-23, D-24 / T-299-11, T-299-12, T-299-14) — the return-target leaf.
 *
 * A link opened signed out must survive sign-in, and nothing off-site may ever be accepted on the
 * way. `returnTarget` is the one gate: it returns `formatAppRoute(parseAppLocation(...))` for a
 * parsed `/app` route and `null` for everything else, so the value stored or forwarded is always
 * the REBUILT string, never the input. `kindWord` names the kind of thing (never its title).
 * The sessionStorage copy is re-validated on read, expires after 15 minutes and is consumed once.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

import {
  RETURN_LINE,
  forgetReturnTarget,
  kindWord,
  rememberReturnTarget,
  returnTarget,
  takeReturnTarget,
} from "@/lib/returnTo"

const RUN_ID = "229f45ae-c85e-4707-a46c-bf4787541547"
const RUN_ID_UPPER = RUN_ID.toUpperCase()

/** The appRoutes HOSTILE set (appRoutes.test.ts), copied: every one of them must yield null. */
const HOSTILE = [
  "//evil.com",
  "//evil.com/app",
  "/\\evil.com",
  "/app/\\evil.com",
  "/app/%2e%2e",
  "/app/%2F%2Fevil.com",
  "/app/../admin",
  "/app/./library",
  "/app/library.json",
  "/app.html",
  "/app//library",
  `/app/${"a".repeat(10_000)}`,
  "/app/ライブラリ",
  "/https://evil.com",
  "/app/https:/evil.com",
  "",
  "app/library",
  "/APP/LIBRARY",
  "/nonsense",
  "/app/nonsense",
]

describe("returnTarget — rebuilt, never echoed (D-23 / T-299-11)", () => {
  it("a run address comes back canonical and lower-cased", () => {
    expect(returnTarget(`/app/runs/${RUN_ID_UPPER}`, "")).toBe(`/app/runs/${RUN_ID}`)
  })

  it("chat home is /app", () => {
    expect(returnTarget("/app", "")).toBe("/app")
  })

  it("a view address returns its view path", () => {
    expect(returnTarget("/app/library", "")).toBe("/app/library")
  })

  it("a bare-prefix run address returns the canonical /app/runs path", () => {
    expect(returnTarget(`/runs/${RUN_ID}`, "")).toBe(`/app/runs/${RUN_ID}`)
  })

  it.each(["/setup", "/invite"])("the pre-auth page %s is never a return target", (path) => {
    expect(returnTarget(path, "")).toBeNull()
  })

  it.each(HOSTILE)("%s never throws and is never a return target", (path) => {
    let out: string | null = "unset"
    expect(() => {
      out = returnTarget(path, "")
    }).not.toThrow()
    expect(out).toBeNull()
  })

  it("no output for any input ever starts // or names a host", () => {
    const inputs = [...HOSTILE, "/app", "/app/library", `/app/runs/${RUN_ID}`, `/runs/${RUN_ID}`]
    for (const input of inputs) {
      const out = returnTarget(input, "")
      if (out === null) continue
      expect(out.startsWith("/app")).toBe(true)
      expect(out.startsWith("//")).toBe(false)
      expect(out).not.toContain("://")
    }
  })

  it("a non-string input never throws (the parse is total)", () => {
    expect(() => returnTarget(undefined as unknown as string, undefined as unknown as string)).not.toThrow()
    expect(returnTarget(undefined as unknown as string, "")).toBeNull()
  })
})

describe("kindWord — the kind only, never a title (D-22 / T-299-14)", () => {
  it("a run address is a workflow run", () => {
    expect(kindWord(`/app/runs/${RUN_ID}`, "")).toBe("a workflow run")
  })

  it("the legacy ?run= link is a workflow run too", () => {
    expect(kindWord("/app", `?run=${RUN_ID}`)).toBe("a workflow run")
  })

  it.each(["/app", "/", "/app/library", "/app/workflows", "/app/experts", "/app/settings"])(
    "%s names no thing, so no kind",
    (path) => {
      expect(kindWord(path, "")).toBeNull()
    },
  )

  it.each(["//evil.com/app", "/https://evil.com", "/nonsense", "/setup"])("%s off-site or unknown: no kind", (path) => {
    expect(kindWord(path, "")).toBeNull()
  })

  it("the two return lines carry the exact S5 words", () => {
    expect(RETURN_LINE.signin("a workflow run")).toBe("After you sign in, you'll go to a workflow run.")
    expect(RETURN_LINE.signup("an Expert")).toBe("After you sign up, you'll go to an Expert.")
  })
})

describe("the stored copy — re-validated, 15-minute TTL, consumed once (D-24 / T-299-12)", () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    window.sessionStorage.clear()
  })

  it("a remembered target is taken once, then null", () => {
    rememberReturnTarget(`/app/runs/${RUN_ID}`)
    expect(takeReturnTarget()).toBe(`/app/runs/${RUN_ID}`)
    expect(takeReturnTarget()).toBeNull()
  })

  it("only a returnTarget-valid string is ever stored", () => {
    rememberReturnTarget("//evil.com/app")
    expect(window.sessionStorage.length).toBe(0)
    expect(takeReturnTarget()).toBeNull()
  })

  it("what is stored is the rebuilt path, not the input", () => {
    rememberReturnTarget(`/app/runs/${RUN_ID_UPPER}`)
    expect(takeReturnTarget()).toBe(`/app/runs/${RUN_ID}`)
  })

  it("an entry older than 15 minutes is null", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-28T10:00:00Z"))
    rememberReturnTarget(`/app/runs/${RUN_ID}`)
    vi.setSystemTime(new Date("2026-10-28T10:15:01Z"))
    expect(takeReturnTarget()).toBeNull()
  })

  it("an entry inside 15 minutes is still taken", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-28T10:00:00Z"))
    rememberReturnTarget(`/app/runs/${RUN_ID}`)
    vi.setSystemTime(new Date("2026-10-28T10:14:59Z"))
    expect(takeReturnTarget()).toBe(`/app/runs/${RUN_ID}`)
  })

  it("a hand-planted //evil entry is null (re-validated on read)", () => {
    for (const raw of [
      JSON.stringify({ path: "//evil.com/app", at: Date.now() }),
      JSON.stringify({ path: "https://evil.com/app", at: Date.now() }),
      JSON.stringify({ path: 42, at: Date.now() }),
      "not json",
    ]) {
      // Plant under every key the module could use: the leaf owns exactly one.
      rememberReturnTarget(`/app/runs/${RUN_ID}`)
      const key = window.sessionStorage.key(0)
      expect(key).not.toBeNull()
      window.sessionStorage.setItem(key as string, raw)
      expect(takeReturnTarget()).toBeNull()
    }
  })

  it("forgetReturnTarget clears it", () => {
    rememberReturnTarget(`/app/runs/${RUN_ID}`)
    forgetReturnTarget()
    expect(takeReturnTarget()).toBeNull()
  })

  it("storage that throws (private mode) is swallowed everywhere", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError")
    })
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError")
    })
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("SecurityError")
    })
    expect(() => rememberReturnTarget(`/app/runs/${RUN_ID}`)).not.toThrow()
    expect(() => takeReturnTarget()).not.toThrow()
    expect(takeReturnTarget()).toBeNull()
    expect(() => forgetReturnTarget()).not.toThrow()
  })
})

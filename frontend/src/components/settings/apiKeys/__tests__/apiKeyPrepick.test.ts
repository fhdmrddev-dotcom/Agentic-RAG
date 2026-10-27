/**
 * Phase 293-04 (D-18, T-293-22) — the workflow card's ⋯ menu hands Settings → API keys ONE
 * workflow to pre-pick, through sessionStorage, read exactly once.
 *
 * It carries `{ workflowId, name }` and nothing else: it is written before a key exists, so it
 * can never hold a secret, and the module refuses to store any other field.
 */
import { afterEach, describe, expect, it } from "vitest"
import apiKeyPrepickRaw from "../apiKeyPrepick.ts?raw"
import { API_KEYS_PREPICK_KEY, readApiKeyPrepickOnce, writeApiKeyPrepick } from "../apiKeyPrepick"

afterEach(() => {
  sessionStorage.clear()
  localStorage.clear()
})

describe("293-04 apiKeyPrepick", () => {
  it("writes JSON under sessionStorage api_keys_prepick", () => {
    expect(API_KEYS_PREPICK_KEY).toBe("api_keys_prepick")
    writeApiKeyPrepick({ workflowId: "w-1", name: "Contract review" })
    expect(JSON.parse(sessionStorage.getItem("api_keys_prepick") ?? "null")).toEqual({
      workflowId: "w-1",
      name: "Contract review",
    })
    expect(localStorage.getItem("api_keys_prepick")).toBeNull()
  })

  it("reads once, then the key is gone", () => {
    writeApiKeyPrepick({ workflowId: "w-1", name: "Contract review" })
    expect(readApiKeyPrepickOnce()).toEqual({ workflowId: "w-1", name: "Contract review" })
    expect(sessionStorage.getItem("api_keys_prepick")).toBeNull()
    expect(readApiKeyPrepickOnce()).toBeNull()
  })

  it("malformed JSON returns null and clears", () => {
    sessionStorage.setItem("api_keys_prepick", "{not json")
    expect(readApiKeyPrepickOnce()).toBeNull()
    expect(sessionStorage.getItem("api_keys_prepick")).toBeNull()
  })

  it("a stored object without a string workflowId is refused", () => {
    sessionStorage.setItem("api_keys_prepick", JSON.stringify({ workflowId: 7, name: "x" }))
    expect(readApiKeyPrepickOnce()).toBeNull()
  })

  it("stores only workflowId and name, whatever else the caller hands it", () => {
    writeApiKeyPrepick({ workflowId: "w-1", name: "N", ...({ secret: "srl_live_LEAK" } as object) } as {
      workflowId: string
      name: string
    })
    const raw = sessionStorage.getItem("api_keys_prepick") ?? ""
    expect(raw).not.toContain("srl_live_LEAK")
    expect(Object.keys(JSON.parse(raw) as object).sort()).toEqual(["name", "workflowId"])
  })

  it("the module source never names a secret outside comments", () => {
    const code = apiKeyPrepickRaw
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n")
    expect(code).not.toMatch(/secret/i)
  })
})

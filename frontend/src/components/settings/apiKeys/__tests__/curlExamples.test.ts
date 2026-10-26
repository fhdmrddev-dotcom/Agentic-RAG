/**
 * Phase 293-04 (D-19, T-293-25) — the copy-ready `curl` text on the show-once card.
 *
 * UI-SPEC failure 2: "the start curl copied from the show-once card, with only its placeholder
 * values replaced, fails". So the text is built from the REAL base URL, the real secret, the real
 * workflow id and the workflow's declared launch keys, and these cases pin each of those.
 */
import { describe, expect, it } from "vitest"
import { apiBaseForCurl, startCurl, statusCurl, statusSampleJson } from "../curlExamples"

const BASE = "http://localhost:8000"
const SECRET = "srl_live_X"

describe("293-04 apiBaseForCurl", () => {
  it("keeps an absolute base and drops a trailing slash", () => {
    expect(apiBaseForCurl("http://localhost:8000", "http://localhost:5173")).toBe(BASE)
    expect(apiBaseForCurl("https://api.example.test/", "https://app.example.test")).toBe("https://api.example.test")
  })

  it("resolves a relative base against the page origin", () => {
    expect(apiBaseForCurl("/api", "https://app.example.test")).toBe("https://app.example.test/api")
    expect(apiBaseForCurl("", "https://app.example.test")).toBe("https://app.example.test")
  })
})

describe("293-04 startCurl", () => {
  it("POSTs to the inbound start path with the bearer secret and the declared fields in order", () => {
    const text = startCurl({
      base: BASE,
      secret: SECRET,
      workflowId: "W",
      fields: [{ key: "counterparty" }, { key: "due_date" }],
    })
    expect(text).toContain('curl -X POST "http://localhost:8000/inbound/workflows/W/runs"')
    expect(text).toContain('-H "Authorization: Bearer srl_live_X"')
    expect(text).toContain('-H "Content-Type: application/json"')
    expect(text).toContain(`-d '{"inputs": {"counterparty": "<counterparty>", "due_date": "<due_date>"}}'`)
    expect(text.indexOf("counterparty")).toBeLessThan(text.indexOf("due_date"))
  })

  it("a workflow with no inputs sends an empty inputs object", () => {
    const text = startCurl({ base: BASE, secret: SECRET, workflowId: "W", fields: [] })
    expect(text).toContain(`-d '{"inputs": {}}'`)
  })

  it("JSON-escapes a field key containing a quote, and shell-escapes a single quote", () => {
    const text = startCurl({ base: BASE, secret: SECRET, workflowId: "W", fields: [{ key: 'say "hi"' }] })
    expect(text).toContain('"say \\"hi\\"": "<say \\"hi\\">"')
    const apos = startCurl({ base: BASE, secret: SECRET, workflowId: "W", fields: [{ key: "it's" }] })
    expect(apos).toContain(`"it'\\''s"`)
  })

  it("encodes the workflow id as a path segment", () => {
    const text = startCurl({ base: BASE, secret: SECRET, workflowId: "a/b", fields: [] })
    expect(text).toContain("/inbound/workflows/a%2Fb/runs")
  })
})

describe("293-04 statusCurl and the sample", () => {
  it("targets /inbound/runs/RUN_ID with the same bearer header", () => {
    const text = statusCurl({ base: BASE, secret: SECRET })
    expect(text).toContain('curl "http://localhost:8000/inbound/runs/RUN_ID"')
    expect(text).toContain('-H "Authorization: Bearer srl_live_X"')
  })

  it("the status sample is valid JSON carrying the InboundRunRead fields", () => {
    const sample = JSON.parse(statusSampleJson()) as Record<string, unknown>
    for (const k of ["status", "step_index", "step_total", "waiting_on", "output_text", "end_reason", "steps", "files"]) {
      expect(sample).toHaveProperty(k)
    }
    const files = sample.files as { url: string; expires_in: number }[]
    expect(files[0].expires_in).toBe(300)
    expect(files[0].url).toContain("/inbound/files/")
    // 293-REVIEW WR-01: the server sends an ABSOLUTE link, so the sample does too.
    expect(files[0].url).toMatch(/^https:\/\//)
  })

  it("296-04 (293-IN-02): the completed sample has no current step, as the server sends it", () => {
    // `api/inbound.py` sets step_index only while the run is active; a finished run reads null.
    const sample = JSON.parse(statusSampleJson()) as Record<string, unknown>
    expect(sample.status).toBe("completed")
    expect(sample.step_index).toBeNull()
  })
})

/**
 * Phase 308-05 (D-11, A-27, T-293-21) — the verify snippets on the secret-once card.
 *
 * They use the library's own import lines (the Python one is the line the D-11 interop test runs
 * against `standardwebhooks==1.1.0`), read the secret from `SYREL_WEBHOOK_SECRET`, verify the RAW
 * body, and TAKE NO SECRET: a builder that accepted one could put it on the page twice.
 */
import { describe, expect, it } from "vitest"
import { WEBHOOK_SECRET_ENV, nodeSnippet, pythonSnippet } from "../webhookSnippets"

describe("308-05 webhookSnippets", () => {
  it("Python imports Webhook from standardwebhooks.webhooks and verifies the raw body", () => {
    const s = pythonSnippet()
    expect(s).toContain("pip install standardwebhooks")
    expect(s).toContain("from standardwebhooks.webhooks import Webhook")
    expect(s).toContain('Webhook(os.environ["SYREL_WEBHOOK_SECRET"])')
    expect(s).toContain("wh.verify(raw_body, headers)")
  })

  it("Node imports { Webhook } from standardwebhooks and verifies the raw body", () => {
    const s = nodeSnippet()
    expect(s).toContain("npm install standardwebhooks")
    expect(s).toContain('import { Webhook } from "standardwebhooks";')
    expect(s).toContain("new Webhook(process.env.SYREL_WEBHOOK_SECRET)")
    expect(s).toContain("wh.verify(rawBody, headers)")
  })

  it("both read the one env var and take no argument (no secret can be handed in)", () => {
    expect(WEBHOOK_SECRET_ENV).toBe("SYREL_WEBHOOK_SECRET")
    expect(pythonSnippet.length).toBe(0)
    expect(nodeSnippet.length).toBe(0)
    expect(pythonSnippet()).not.toMatch(/whsec_/)
    expect(nodeSnippet()).not.toMatch(/whsec_/)
  })
})

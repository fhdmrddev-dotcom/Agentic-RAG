/**
 * Phase 293-04 (D-05, D-17) — wire → key-card facts, and the one string home they read.
 *
 * UI-SPEC failures 3 and 4: a key with an unpublished workflow must never read `● active` with no
 * amber chip, and a refused call must never say only "refused". Every reason code the server
 * writes (293-01 `api_key_auth.py`, 293-02 `inbound.py`) maps to the "Activity reasons" table,
 * and an unknown one shows its raw code rather than nothing.
 *
 * Dates are built with LOCAL constructors because the card formats in the viewer's zone.
 */
import { describe, expect, it } from "vitest"
import apiKeysCopyRaw from "../apiKeysCopy.ts?raw"
import apiKeyFactsRaw from "../apiKeyFacts.ts?raw"
import inboundPy from "../../../../../../backend/app/api/inbound.py?raw"
import apiKeyAuthPy from "../../../../../../backend/app/security/api_key_auth.py?raw"
import inboundInputsPy from "../../../../../../backend/app/services/inbound_inputs.py?raw"
import type { ApiKeyCall, ApiKeyRead, StartableWorkflow } from "@/lib/api/apiKeys"
import {
  callBars,
  callDetailLine,
  callWords,
  formatCallTime,
  formatDay,
  keyCardFacts,
  orderKeys,
  runCellText,
  startableRowFacts,
} from "../apiKeyFacts"

const NOW = new Date(2026, 9, 25, 12, 0) // Sun 25 Oct 2026, 12:00 local
const iso = (y: number, m: number, d: number, h = 9, min = 0) => new Date(y, m, d, h, min).toISOString()

function key(over: Partial<ApiKeyRead> = {}): ApiKeyRead {
  return {
    id: "k1",
    label: "n8n-prod",
    key_prefix: "srl_live_Ab3d",
    workflows: [{ id: "w1", name: "Contract review", state: "startable" }],
    state: "active",
    expires_at: iso(2027, 0, 22),
    revoked_at: null,
    revoked_by_name: null,
    revoked_by_admin: false,
    last_used_at: iso(2026, 9, 25, 10, 42),
    created_at: iso(2026, 9, 1),
    owner_name: "Dana Kim",
    owner_is_you: true,
    calls: [],
    ...over,
  }
}

function call(over: Partial<ApiKeyCall> = {}): ApiKeyCall {
  return {
    at: iso(2026, 9, 25, 10, 42),
    verb: "start",
    workflow_id: "w1",
    workflow_name: "Contract review",
    run_id: "7f3a91c2-0000-4000-8000-000000000000",
    ok: true,
    outcome: "started",
    reason: null,
    detail: null,
    ...over,
  }
}

describe("293-04 keyCardFacts — tags, chips, lines", () => {
  it("every workflow startable → ● active, plain chips, no refusal line", () => {
    const f = keyCardFacts(key(), NOW)
    expect(f.tag).toEqual({ kind: "active", text: "● active" })
    expect(f.dead).toBe(false)
    expect(f.chips).toEqual([{ id: "w1", name: "Contract review", refused: false, text: "Contract review" }])
    expect(f.refusalLines).toEqual([])
  })

  it("one unpublished → ⚠ 1 workflow refused + a dashed chip + the unpublished line", () => {
    const f = keyCardFacts(
      key({
        workflows: [
          { id: "w1", name: "Contract review", state: "startable" },
          { id: "w2", name: "Renewal brief", state: "unpublished" },
        ],
      }),
      NOW,
    )
    expect(f.tag).toEqual({ kind: "refused", text: "⚠ 1 workflow refused" })
    expect(f.chips[1]).toEqual({ id: "w2", name: "Renewal brief", refused: true, text: "⚠ Renewal brief · no longer published" })
    expect(f.refusalLines).toEqual([
      "Renewal brief was unpublished, so calls to it are refused. Publish it again, or make a key without it.",
    ])
  })

  it("two refused → ⚠ 2 workflows refused; a deleted one has its own chip and line", () => {
    const f = keyCardFacts(
      key({
        workflows: [
          { id: "w2", name: "Renewal brief", state: "unpublished" },
          { id: "w3", name: "Old intake", state: "deleted" },
        ],
      }),
      NOW,
    )
    expect(f.tag.text).toBe("⚠ 2 workflows refused")
    expect(f.chips[1].text).toBe("⚠ Old intake · deleted")
    expect(f.refusalLines[1]).toBe("Old intake was deleted, so calls to it are refused. Make a key without it.")
  })

  it("cannot_run and file_upload are refused too, never read as active", () => {
    const f = keyCardFacts(
      key({
        workflows: [
          { id: "w4", name: "Board pack", state: "cannot_run" },
          { id: "w5", name: "Scan intake", state: "file_upload" },
        ],
      }),
      NOW,
    )
    expect(f.tag.kind).toBe("refused")
    expect(f.chips.every((c) => c.refused && c.text.startsWith("⚠ "))).toBe(true)
    expect(f.refusalLines).toHaveLength(2)
  })

  // 296-06 (293-IN-06): a workflow that declares no launch field starts from a typed task,
  // which a key can't send. The card says so in the UI-SPEC F words, never as `cannot_run`.
  it("needs_task reads its own chip and line", () => {
    const f = keyCardFacts(
      key({ workflows: [{ id: "w6", name: "Literature review", state: "needs_task" }] }),
      NOW,
    )
    expect(f.tag.kind).toBe("refused")
    expect(f.chips[0].text).toBe("⚠ Literature review · needs a typed task")
    expect(f.refusalLines[0]).toBe(
      "Literature review starts from a typed task, which a key can't send, so calls to it are refused. Make a key without it.",
    )
  })

  it("expired and revoked keys carry their tag and are dead", () => {
    const exp = keyCardFacts(key({ state: "expired", expires_at: iso(2026, 9, 22) }), NOW)
    expect(exp.tag).toEqual({ kind: "expired", text: "expired" })
    expect(exp.dead).toBe(true)
    expect(exp.expiresRelative).toBe("expired 3 days ago")
    const rev = keyCardFacts(key({ state: "revoked", revoked_at: iso(2026, 9, 20), revoked_by_name: "Dana Kim" }), NOW)
    expect(rev.tag).toEqual({ kind: "revoked", text: "revoked" })
    expect(rev.dead).toBe(true)
  })

  it("an expired key with an unpublished workflow reads expired, not refused", () => {
    const f = keyCardFacts(
      key({ state: "expired", workflows: [{ id: "w2", name: "Renewal brief", state: "unpublished" }] }),
      NOW,
    )
    expect(f.tag.kind).toBe("expired")
  })

  it("the meta facts: expiry date + relative, last used, created", () => {
    const f = keyCardFacts(key(), NOW)
    expect(f.expires).toBe("Fri 22 Jan 2027")
    expect(f.expiresRelative).toBe("in 89 days")
    expect(f.lastUsed).toBe("10:42")
    expect(f.created).toBe("Thu 1 Oct")
    const never = keyCardFacts(key({ expires_at: null, last_used_at: null }), NOW)
    expect(never.expires).toBe("never")
    expect(never.expiresRelative).toBe("never expires")
    expect(never.lastUsed).toBe("never used")
  })

  it("the revoke receipt names who revoked it", () => {
    const own = keyCardFacts(key({ state: "revoked", revoked_at: iso(2026, 9, 20), revoked_by_name: "Dana Kim" }), NOW)
    expect(own.receipt).toBe("✎ Revoked by you · Tue 20 Oct · recorded")
    const admin = keyCardFacts(
      key({ state: "revoked", revoked_at: iso(2026, 9, 20), revoked_by_name: "Priya Shah", revoked_by_admin: true }),
      NOW,
    )
    expect(admin.receipt).toBe("✎ Revoked by Priya Shah, an admin · Tue 20 Oct · recorded")
    expect(keyCardFacts(key(), NOW).receipt).toBeNull()
  })
})

describe("293-04 orderKeys", () => {
  it("active by last used desc, never-used by created desc, then expired, then revoked", () => {
    const keys = [
      key({ id: "revoked", state: "revoked" }),
      key({ id: "never-old", last_used_at: null, created_at: iso(2026, 8, 1) }),
      key({ id: "expired", state: "expired" }),
      key({ id: "used-old", last_used_at: iso(2026, 9, 1) }),
      key({ id: "never-new", last_used_at: null, created_at: iso(2026, 9, 20) }),
      key({
        id: "used-new-refused",
        last_used_at: iso(2026, 9, 24),
        workflows: [{ id: "w2", name: "R", state: "unpublished" }],
      }),
    ]
    expect(orderKeys(keys).map((k) => k.id)).toEqual([
      "used-new-refused",
      "used-old",
      "never-new",
      "never-old",
      "expired",
      "revoked",
    ])
  })
})

describe("293-04 callWords — every reason has words", () => {
  const ctx = {
    key: key({ revoked_at: iso(2026, 9, 6), expires_at: iso(2026, 9, 6) }),
    limits: { starts_per_minute: 10, reads_per_minute: 120 },
    orgName: "Acme",
  }

  it("ok reads and starts", () => {
    expect(callWords(call(), ctx)).toEqual({ ok: true, text: "✓ started" })
    expect(callWords(call({ verb: "read", outcome: "running", detail: { step_index: 2, step_total: 4 } }), ctx).text).toBe(
      "✓ running · step 2 of 4",
    )
    expect(callWords(call({ verb: "read", outcome: "running" }), ctx).text).toBe("✓ running")
    expect(
      callWords(call({ verb: "read", outcome: "waiting_for_person", detail: { who: "Priya Shah" } }), ctx).text,
    ).toBe("✓ waiting for a person · Priya Shah")
    expect(callWords(call({ verb: "read", outcome: "completed", detail: { files: 2 } }), ctx).text).toBe("✓ finished · 2 files")
    expect(callWords(call({ verb: "read", outcome: "completed", detail: { files: 1 } }), ctx).text).toBe("✓ finished · 1 file")
    expect(callWords(call({ verb: "read", outcome: "completed" }), ctx).text).toBe("✓ finished")
    expect(callWords(call({ verb: "read", outcome: "failed" }), ctx).text).toBe("✓ failed")
    expect(callWords(call({ verb: "read", outcome: "cancelled" }), ctx).text).toBe("✓ stopped")
  })

  it.each([
    ["revoked", {}, "✕ refused: key revoked on Tue 6 Oct"],
    ["expired", {}, "✕ refused: key expired on Tue 6 Oct"],
    ["not_member", {}, "✕ refused: Dana Kim is no longer a member of Acme"],
    ["not_on_key", {}, "✕ refused: not found: that workflow is not on this key"],
    ["run_not_found", {}, "✕ refused: not found: this key did not start that run"],
    ["unpublished", {}, "✕ refused: workflow is no longer published"],
    ["cannot_run", {}, "✕ refused: Dana Kim can no longer run this workflow"],
    ["entitlement", {}, "✕ refused: your organisation's plan doesn't include workflow runs"],
    ["unknown_input", { names: ["colour", "size"] }, "✕ refused: unknown input: colour, size"],
    ["missing_input", { names: ["customer"] }, "✕ refused: missing required input: customer"],
    ["file_upload", {}, "✕ refused: needs a file upload, not possible with a key yet"],
    ["needs_task", {}, "✕ refused: needs a typed task, not possible with a key yet"],
    ["over_limit", {}, "✕ refused: over the limit: 10 starts a minute"],
  ] as const)("%s", (reason, detail, text) => {
    expect(callWords(call({ ok: false, outcome: null, run_id: null, reason, detail: { ...detail } }), ctx)).toEqual({
      ok: false,
      text,
    })
  })

  it("over the limit on a read names the read allowance", () => {
    expect(callWords(call({ ok: false, verb: "read", reason: "over_limit" }), ctx).text).toBe(
      "✕ refused: over the limit: 120 reads a minute",
    )
  })

  it("banned, invalid_body and deleted all have words", () => {
    for (const reason of ["banned", "invalid_body", "deleted"]) {
      const t = callWords(call({ ok: false, reason }), ctx).text
      expect(t.startsWith("✕ refused: ")).toBe(true)
      expect(t).not.toContain(reason)
    }
  })

  // 293 UAT: CR-01 added `workflows_disabled` after this map was written, and the activity row
  // showed the raw code. Read every reason the backend audits, so a new one cannot fall through.
  it("every refusal reason the backend audits has words, never the raw code", () => {
    const literal = /reason\s*=\s*\(?\s*"([a-z_]+)"(?:[ \t]+if[^\n]*?else[ \t]+"([a-z_]+)")?/g
    const emitted = new Set<string>()
    for (const src of [inboundPy, apiKeyAuthPy]) {
      for (const m of src.matchAll(literal)) {
        emitted.add(m[1])
        if (m[2]) emitted.add(m[2])
      }
    }
    const codes = inboundInputsPy.match(/RefusalCode = Literal\[([^\]]+)\]/)?.[1] ?? ""
    for (const m of codes.matchAll(/"([a-z_]+)"/g)) emitted.add(m[1])
    // Guard the extraction itself: an empty or shrunken set would pass vacuously.
    expect(emitted.size).toBeGreaterThanOrEqual(15)
    for (const known of ["revoked", "over_limit", "workflows_disabled", "no_template", "unknown_input"]) {
      expect(emitted.has(known)).toBe(true)
    }
    for (const reason of emitted) {
      const t = callWords(call({ ok: false, reason }), ctx).text
      expect(t.startsWith("✕ refused: "), reason).toBe(true)
      expect(t, reason).not.toBe(`✕ refused: ${reason}`)
    }
  })

  it("an unknown reason renders the raw code, never empty", () => {
    expect(callWords(call({ ok: false, reason: "brand_new_code" }), ctx).text).toBe("✕ refused: brand_new_code")
    expect(callWords(call({ ok: false, reason: null }), ctx).text).toBe("✕ refused")
  })

  it("names fall back to plain words when the key or org is unknown", () => {
    expect(callWords(call({ ok: false, reason: "not_member" }), {}).text).toBe(
      "✕ refused: the key's owner is no longer a member of this organisation",
    )
    expect(callWords(call({ ok: false, reason: "revoked" }), {}).text).toBe("✕ refused: key revoked")
  })
})

describe("293-04 callBars, times, rows", () => {
  it("the last 20 calls, oldest first, kinded start / read / refused", () => {
    const calls = Array.from({ length: 25 }, (_, i) =>
      call({ at: iso(2026, 9, 25, 0, 59 - i), verb: i % 2 ? "read" : "start", ok: i !== 0 }),
    ) // newest first, as the server sends them
    const bars = callBars(calls)
    expect(bars).toHaveLength(20)
    expect(bars[bars.length - 1].call).toBe(calls[0])
    expect(bars[bars.length - 1].kind).toBe("refused")
    expect(bars[bars.length - 2].kind).toBe("read")
    expect(bars[0].call).toBe(calls[19])
  })

  it("times: today, yesterday, older", () => {
    expect(formatCallTime(iso(2026, 9, 25, 10, 42), NOW)).toBe("10:42")
    expect(formatCallTime(iso(2026, 9, 24, 2, 4), NOW)).toBe("Yesterday 02:04")
    expect(formatCallTime(iso(2026, 9, 6, 9, 0), NOW)).toBe("6 Oct 09:00")
    expect(formatCallTime(iso(2025, 9, 6, 9, 0), NOW)).toBe("6 Oct 2025 09:00")
    expect(formatDay(iso(2026, 9, 27), NOW)).toBe("Tue 27 Oct")
    expect(formatDay(iso(2027, 0, 4), NOW)).toBe("Mon 4 Jan 2027")
  })

  it("run cell and the one-line detail", () => {
    expect(runCellText("7f3a91c2-0000")).toBe("run 7f3a91")
    expect(runCellText(null)).toBe("no run")
    expect(callDetailLine(call(), {}, NOW)).toBe("10:42 · start · Contract review · run 7f3a91 · ✓ started")
    expect(callDetailLine(call({ workflow_name: null, run_id: null }), {}, NOW)).toBe("10:42 · start · — · no run · ✓ started")
  })

  it("startable rows: declared keys, no inputs, or the file-upload reason", () => {
    const w = (over: Partial<StartableWorkflow>): StartableWorkflow => ({
      id: "w",
      name: "W",
      fields: [],
      startable: true,
      reason: null,
      ...over,
    })
    expect(
      startableRowFacts(
        w({
          fields: [
            { key: "counterparty", label: "Counterparty", required: true },
            { key: "due_date", label: "Due", required: false },
          ],
        }),
      ),
    ).toEqual({ disabled: false, right: "counterparty, due_date" })
    expect(startableRowFacts(w({}))).toEqual({ disabled: false, right: "no inputs" })
    expect(startableRowFacts(w({ startable: false, reason: "file_upload" }))).toEqual({
      disabled: true,
      right: "needs a file upload, not possible with a key yet",
    })
    // 296-06 (293-IN-06)
    expect(startableRowFacts(w({ startable: false, reason: "needs_task" }))).toEqual({
      disabled: true,
      right: "needs a typed task, not possible with a key yet",
    })
  })
})

describe("293-04 the copy module is a true leaf, the facts module spells no copy", () => {
  it("apiKeysCopy.ts imports nothing", () => {
    expect(apiKeysCopyRaw.split("\n").filter((l) => /^\s*import\s/.test(l))).toEqual([])
  })

  it("apiKeyFacts.ts imports no React", () => {
    expect(apiKeyFactsRaw).not.toMatch(/from "react"/)
  })
})

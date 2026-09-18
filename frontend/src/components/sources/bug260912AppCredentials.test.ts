/**
 * BUG-260912-01 — `invalid_client` is the DEPLOYMENT's fault, and the surface must say so.
 *
 * ── ⭐ THE DEFECT ──────────────────────────────────────────────────────────────────────
 *
 * Measured 2026-09-12 against the live local stack. `GOOGLE_OAUTH_CLIENT_SECRET` stopped
 * matching `GOOGLE_OAUTH_CLIENT_ID`, so Google answered every token refresh with
 * `401 {"error": "invalid_client"}`. `classifySourceFailure` resolved that to
 * `token_revoked` — on the `\b401\b` tell — whose sentence is *"Access to … was withdrawn"*
 * and whose control is **Reconnect**. The operator reconnected. Nothing changed, and nothing
 * could: `oauth_service.resolve_client_credentials` hands the authorization-code exchange the
 * same broken secret.
 *
 * ⛔ THE BINDING DISTINCTION, and it is about WHO FIXES IT:
 *   · `token_revoked`            — one person's authorisation ended. Fixed by that person.
 *   · `app_credentials_invalid`  — this deployment's app registration is wrong. Fixed by the
 *                                  operator, on the server, and by nobody else.
 * Offering Reconnect for the second is the same defect `connection_disabled` was added to
 * close: a control that provably cannot change the state it is offered for.
 *
 * ⚠ The count re-baselines (5 → 6) live in `sourceHealthVocabulary.test.ts` beside the ones
 * they replace, so the history of the number stays readable. This file holds the new member's
 * OWN properties, mirroring `test_bug_260912_invalid_client_is_its_own_cause.py` one layer
 * down.
 */

import { describe, it, expect } from "vitest"

import failureCausePySource from "../../../../backend/app/services/sources/failure_cause.py?raw"
import vocabularySource from "./sourceHealthVocabulary.ts?raw"
import {
  CONTROL_FOR_CAUSE,
  SENTENCE_FOR_CAUSE,
  classifySourceFailure,
  sourceFailureSentence,
} from "./sourceHealthVocabulary"

/** Google's exact answer, quoted from the 2026-09-12 measurement. */
const GOOGLE_INVALID_CLIENT =
  'Token refresh failed at google: 401 {\n  "error": "invalid_client",\n' +
  '  "error_description": "The provided client secret is invalid."\n}'

describe("BUG-260912-01 — the deployment's own credentials are their own cause", () => {
  it("⚠ NON-VACUITY — both tables carry the new member", () => {
    expect(Object.keys(SENTENCE_FOR_CAUSE)).toContain("app_credentials_invalid")
    expect(Object.keys(CONTROL_FOR_CAUSE)).toContain("app_credentials_invalid")
  })

  it("⭐ THE BUG: the real Google body no longer reads as a revoked token", () => {
    expect(classifySourceFailure(GOOGLE_INVALID_CLIENT)).toBe("app_credentials_invalid")
    expect(classifySourceFailure(GOOGLE_INVALID_CLIENT)).not.toBe("token_revoked")
  })

  it("the matcher is asked BEFORE token_revoked, because both tells are in one message", () => {
    // The body carries `401` — the token_revoked tell — AND `invalid_client`. Order is the
    // whole fix: a matcher list that asked token_revoked first would still be wrong.
    expect(GOOGLE_INVALID_CLIENT).toContain("401")
    expect(classifySourceFailure(GOOGLE_INVALID_CLIENT)).toBe("app_credentials_invalid")
  })

  it.each([
    '{"error": "invalid_client"}',
    "invalid_client",
    "The provided client secret is invalid.",
    "The OAuth client was not found. (invalid_client)",
  ])("recognises %s", (message) => {
    expect(classifySourceFailure(message)).toBe("app_credentials_invalid")
  })

  it("⛔ CONTAINMENT — a genuinely revoked grant keeps its own cause and its own control", () => {
    for (const message of [
      "invalid_grant",
      "Token has been expired or revoked.",
      "The caller does not have permission",
      "insufficient authentication scopes",
    ]) {
      expect(classifySourceFailure(message)).not.toBe("app_credentials_invalid")
    }
    expect(classifySourceFailure("invalid_grant")).toBe("token_revoked")
  })

  it("⭐ the sentence names WHOSE credentials, and does not instruct a reconnect", () => {
    const s = SENTENCE_FOR_CAUSE.app_credentials_invalid("Google Workspace")
    expect(s).toContain("Google Workspace")
    expect(s).toMatch(/this server|administrator/i)
    // ⚠ NOT a substring ban on "reconnect". The sentence may — and does — name the useless
    //   action in order to RULE IT OUT, which is strictly better than silence: the operator
    //   has already tried it. What it must never be is an INSTRUCTION.
    expect(s).not.toMatch(/reconnect it|needs to be authorised again/i)
  })

  it("the sentence degrades honestly with no connection name", () => {
    expect(SENTENCE_FOR_CAUSE.app_credentials_invalid("")).toContain("the connection")
    expect(SENTENCE_FOR_CAUSE.app_credentials_invalid("   ")).toContain("the connection")
  })

  it("⭐ D-235-11 — its control is NOT `Reconnect X`, because that provably cannot fix it", () => {
    const label = CONTROL_FOR_CAUSE.app_credentials_invalid.label("Google Workspace")
    expect(label).not.toBe("Reconnect Google Workspace")
    expect(label).toContain("Google Workspace")
    // The ACTION reuses the existing `reconnect` DOOR — the Connections surface, which is
    // exactly where an operator corrects these credentials. The shipped "three named
    // actions" pin therefore stays green BY CONSTRUCTION, never by being loosened.
    expect(CONTROL_FOR_CAUSE.app_credentials_invalid.action).toBe("reconnect")
  })

  it("⭐ the whole point, end to end — the raw body becomes the right sentence", () => {
    const said = sourceFailureSentence(GOOGLE_INVALID_CLIENT, "Google Workspace")
    expect(said).toBe(SENTENCE_FOR_CAUSE.app_credentials_invalid("Google Workspace"))
    // ⛔ And the provider's machine text never survives — the shipped guarantee, re-asserted
    //    on the one message this bug is about.
    expect(said).not.toContain("invalid_client")
    expect(said).not.toContain("{")
  })

  it("⭐ V-09 — the backend can emit it, so this table MUST carry it", () => {
    const m = failureCausePySource.match(/^Cause = Literal\[(.+)\]$/m)
    expect(m).not.toBeNull()
    const backendCauses = Array.from((m?.[1] ?? "").matchAll(/"([a-z_]+)"/g)).map((x) => x[1])
    expect(backendCauses).toContain("app_credentials_invalid")
  })

  it("⭐ PROVED over the shipped source — FIVE occurrences, and every one is a table", () => {
    // ⚠ ONE MORE than the count `connection_disabled` is pinned at, and the difference is
    //   the point rather than a loosening: that cause is WRITTEN ONLY and has no matcher by
    //   decision, while this cause is RECOGNISED FROM A MESSAGE and so needs a row in
    //   `MATCHERS` too. The union, the sentence table, the control table, the matcher list —
    //   and now the connection-pill table. An occurrence beyond the tables would mean
    //   somebody reached for a branch.
    //
    // ⚠ RE-BASELINED 4 → 5 in Phase 252 (W-1 / D-29), in the SAME commit that added the fifth
    //   TABLE. **The invariant is unchanged and still holds: "every one is a table".** This
    //   cause is one of the two the new table exists for — it used to render `● Connected`
    //   while the credentials this deployment uses had been rejected.
    // ⛔ A RE-BASELINE, NOT A LOOSENING: still an exact equality, and the `case`-literal fence
    //   on the next line still proves no branch was smuggled in as the extra occurrence.
    const occurrences = vocabularySource.split("app_credentials_invalid").length - 1
    expect(occurrences).toBe(5)
    expect(vocabularySource).not.toMatch(/case\s+["']app_credentials_invalid["']/)
  })
})

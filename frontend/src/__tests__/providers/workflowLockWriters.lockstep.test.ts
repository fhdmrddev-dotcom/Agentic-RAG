/**
 * Phase 244-14 (review WR-02) — THE TWO MOUNT-TIME WRITERS OF ONE LOCK MUST AGREE.
 *
 * ⛔ THE FINDING. Two effects fire on every thread open, both call `getThreadWorkflow(threadId)`,
 * both take the `locked && !lock_is_stale && active_workflow_run_id` branch, and both write the
 * SAME store key — with DIFFERENT values for `capPaused`:
 *
 *   · `StreamsProvider.tsx` (reconcile, write site 2 of 6) wrote `capPaused: wf.cap_paused`
 *   · `ChatArea.tsx`        (mount effect, write site 5 of 6) writes `capPaused: false`
 *
 * `244-08` ruled on the ChatArea site (`T-244-03-01`) and the mirrored site in the provider was
 * left passing the server's flag through. Whichever promise resolves last wins, and NOTHING
 * orders them. While `workflowLocked` read `!capPaused` that race was WR-07's bug surface; after
 * `244-13` moved it onto `mode`, the surviving consequence is WR-01's — whether a genuine LIVE
 * harness run renders the Continue card at all is decided by a promise race.
 *
 * ⛔ WHY A SOURCE FENCE AND NOT A RENDER. The defect is that two writers DISAGREE, and a render
 * test observes whichever one happened to settle last — i.e. it observes the race rather than
 * the disagreement. The disagreement is a property of the source, so this reads the source, in
 * the `workspaceAllowedExt.lockstep.test.ts` style: extract both branch bodies, assert both are
 * non-empty FIRST, then assert the two `capPaused` expressions are IDENTICAL.
 *
 * ⚠ COMMENTS ARE STRIPPED BEFORE ANYTHING IS EXTRACTED, and here that is load-bearing rather
 * than defensive: `ChatArea.tsx`'s own comment on this branch QUOTES the rejected expression
 * (*"This read `capPaused: state.cap_paused`"*), so an unstripped sweep would read the prose as
 * code and could match the very value the branch does not use. Shared normaliser
 * (`@/lib/stripComments.testutil`) — see IN-02.
 *
 * ⚠ CRLF-SAFE: `[\s\S]` throughout, never `.` across lines, and the sources are LF-normalised
 * before matching.
 */
import { describe, it, expect } from "vitest"

import streamsProviderSource from "@/providers/StreamsProvider.tsx?raw"
import chatAreaSource from "@/components/chat/ChatArea.tsx?raw"
import { stripComments } from "@/lib/stripComments.testutil"

const lf = (s: string) => s.replace(/\r\n/g, "\n")

const PROVIDER = stripComments(lf(streamsProviderSource))
const CHAT_AREA = stripComments(lf(chatAreaSource))

/**
 * The body of the genuine-harness-lock branch — from its `if (…locked && …lock_is_stale &&
 * …active_workflow_run_id)` guard to the end of the `setWorkflowLockForThread` object literal.
 *
 * The receiver differs between the two files (`wf` vs `state`), so the prefix is a parameter and
 * everything else is shared: one extractor, two call sites, which is the same discipline the
 * fence itself is asserting.
 */
function genuineLockBranch(src: string, recv: string, label: string): string {
  const re = new RegExp(
    `if \\(${recv}\\.locked && !${recv}\\.lock_is_stale && ${recv}\\.active_workflow_run_id\\)` +
      `[\\s\\S]*?setWorkflowLockForThread\\([\\s\\S]*?\\{([\\s\\S]*?)\\}\\)`,
  )
  const m = re.exec(src)
  expect(m, `${label}: the genuine-harness-lock branch was not found — this fence is pointing at nothing`).not.toBeNull()
  const body = m![1]
  expect(
    body.length,
    `${label}: the branch body parsed EMPTY — the fence would pass vacuously`,
  ).toBeGreaterThan(20)
  return body
}

/** The `capPaused:` right-hand side inside a branch body, whitespace-normalised. */
function capPausedExpr(body: string, label: string): string {
  const m = /capPaused:\s*([^,\n]+)/.exec(body)
  expect(m, `${label}: no capPaused assignment in the genuine-lock branch`).not.toBeNull()
  return m![1].trim()
}

describe("244-14 / WR-02 — the two mount-time workflow-lock writers are in lockstep", () => {
  it("reads a non-empty source for both writers before anything rests on it", () => {
    // ⚠ Measured AFTER stripping: 95,350 chars of the provider's 4,700 lines survive.
    expect(PROVIDER.length).toBeGreaterThan(50000)
    expect(CHAT_AREA.length).toBeGreaterThan(10000)
  })

  it("both files really carry the genuine-harness-lock branch", () => {
    expect(genuineLockBranch(PROVIDER, "wf", "StreamsProvider")).toContain("mode:")
    expect(genuineLockBranch(CHAT_AREA, "state", "ChatArea")).toContain("mode:")
  })

  it("both write mode: \"harness\" on that branch — the server's own definition of harness", () => {
    expect(genuineLockBranch(PROVIDER, "wf", "StreamsProvider")).toContain('mode: "harness"')
    expect(genuineLockBranch(CHAT_AREA, "state", "ChatArea")).toContain('mode: "harness"')
  })

  it("⛔ the two capPaused expressions are IDENTICAL — a race must not decide the value", () => {
    const provider = capPausedExpr(genuineLockBranch(PROVIDER, "wf", "StreamsProvider"), "StreamsProvider")
    const chatArea = capPausedExpr(genuineLockBranch(CHAT_AREA, "state", "ChatArea"), "ChatArea")
    expect(
      provider,
      "the two mount-time writers of workflowLockByThread disagree about capPaused on the same " +
        "branch of the same GET. Whichever promise settles last wins, and nothing orders them — " +
        `StreamsProvider writes \`${provider}\`, ChatArea writes \`${chatArea}\`.`,
    ).toBe(chatArea)
  })

  it("⛔ and the agreed value is `false` — 244-08's T-244-03-01 ruling, at BOTH sites", () => {
    // ⚠ This is the DIRECTION, not merely the agreement. Fail-closed: a harness run paused at
    // its own cap keeps the composer locked, so the person clicks Cancel instead of typing.
    // Agreeing on `wf.cap_paused` would satisfy the case above and re-open the hole 244-08 shut.
    expect(capPausedExpr(genuineLockBranch(PROVIDER, "wf", "StreamsProvider"), "StreamsProvider")).toBe("false")
    expect(capPausedExpr(genuineLockBranch(CHAT_AREA, "state", "ChatArea"), "ChatArea")).toBe("false")
  })
})

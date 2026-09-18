/**
 * Phase 252 plan 03 (D-03 / D-19 · SC#4 · W-1 / W-2 / W-3) —
 * THE FIRST TEST SUITE `WatchRowCard.tsx` HAS EVER HAD.
 *
 * ── ⛔ WHY ITS ABSENCE IS THE ROOT CAUSE, NOT A SIDE NOTE ────────────────────────────
 *
 * `find frontend/src -name "*WatchRowCard*"` returned the SOURCE AND NOTHING ELSE, and
 * `src/components/sources` is not a TARGETS *directory* entry — only ten individually-named
 * files under it are. **TARGETS decides what RUNS; BASELINE decides what is GUARDED, and this
 * component was on the wrong side of both.** So B-4's three defects, W-1, W-2 and W-3 all
 * shipped with every gate green, at every count.
 *
 * ⚠ The audit's note that SC#3's evidence was a *"does NOT unmount or collapse"* assertion
 * understates it: **there was no suite for that assertion to be weak in.**
 *
 * ── ⛔⛔ EVERY ASSERTION HERE IS OVER RENDERED CONTENT ───────────────────────────────
 *
 * `getByText` / `queryByText` / `toHaveTextContent`. A `data-testid` may **scope** a query
 * (`within(...)`, or as the argument of a `toHaveTextContent`) — it may **never be** the
 * assertion. *Presence assertions cannot see content drift* is this project's own recorded
 * finding, and it is **precisely how B-4 shipped green**: the card's own fence asserted the
 * card did not collapse, while the card said `✓ Synced just now (0 changes)` about a request
 * the server had **refused**.
 *
 * ── ⚠ THE CONTROLS CARRY AS MUCH WEIGHT AS THE NEGATIVES ───────────────────────────
 *
 * Cases 5 and 7 PASS before and after any source change. Without them a suite of `queryByText`
 * negatives would also pass on a card that renders nothing at all — the vacuity
 * `ConnectedSourceSection.test.tsx` recorded one file over.
 */
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { WatchRowCard, type SourceState } from "../WatchRowCard"
import type { ConnectorWatch, StoppedSource } from "@/lib/api/sources"
import type { SourceFailureCause } from "../sourceHealthVocabulary"

// ⛔ `@/lib/api/sources` is NOT in the `@/lib/api` barrel (235-RESEARCH P-10). The factory must
//    declare BOTH exports the card imports, or the mount throws about a missing export rather
//    than about the thing under test (the Phase 196-08 failure mode).
vi.mock("@/lib/api/sources", () => ({
  getWatch: vi.fn(),
  listSyncRuns: vi.fn(),
}))

const { getWatch, listSyncRuns } = await import("@/lib/api/sources")
const mockGetWatch = getWatch as unknown as ReturnType<typeof vi.fn>
const mockListSyncRuns = listSyncRuns as unknown as ReturnType<typeof vi.fn>

function watch(over: Partial<ConnectorWatch> = {}): ConnectorWatch {
  return {
    id: "watch-1",
    user_id: "user-1",
    connection_id: "conn-1",
    connection_name: "Work Drive",
    service_id: "google",
    source_folder_id: "gdrive-fld-1",
    source_folder_name: "Invoices",
    library_folder_id: "lib-1",
    interval_minutes: 30,
    is_active: true,
    last_run_at: new Date(Date.now() - 5 * 60_000).toISOString(),
    last_status: "success",
    last_error: null,
    item_count: 4,
    ...over,
  }
}

function stoppedSource(cause: SourceFailureCause): StoppedSource {
  return {
    watch_id: "watch-1",
    source_folder_name: "Invoices",
    connection_name: "Work Drive",
    cause,
    hard: true,
    stopped_since: new Date(Date.now() - 20 * 60_000).toISOString(),
    last_good_at: new Date(Date.now() - 90 * 60_000).toISOString(),
  }
}

/**
 * The real call site, prop for prop (`WatchedFoldersSection.tsx:440-455`). ⚠ `onSyncNow` is
 * overridden per case; everything else is what the section actually passes.
 */
function mountCard(
  over: {
    watch?: ConnectorWatch
    state?: SourceState
    stopped?: StoppedSource
    refusal?: string | null
    pendingSays?: string | null
    onSyncNow?: (w: ConnectorWatch) => unknown
  } = {},
) {
  const onSyncNow = over.onSyncNow ?? vi.fn().mockResolvedValue(undefined)
  render(
    <WatchRowCard
      watch={over.watch ?? watch()}
      state={over.state ?? "healthy"}
      stopped={over.stopped}
      libraryFolderName="Finance"
      busy={false}
      pendingSays={over.pendingSays ?? null}
      refusal={over.refusal ?? null}
      canReconnect
      onFix={vi.fn()}
      onSyncNow={onSyncNow as never}
      onToggleActive={vi.fn()}
      onPurge={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
  return { onSyncNow }
}

/**
 * A `healthy` / `waiting` row renders as ONE LINE until it is opened; every control this suite
 * asserts about lives on the CARD.
 *
 * ⚠ The click target is the `<button>` INSIDE `sources-source-line`, not the line itself — the
 *   handler is on the child, so clicking the wrapper opens nothing. The first RED drive of this
 *   suite failed cases 1-3 with *"Unable to find `sources-sync-now`"* rather than on the defect,
 *   which proves nothing. A RED for the wrong reason is not a RED.
 */
async function openCard(user: ReturnType<typeof userEvent.setup>) {
  const line = screen.queryByTestId("sources-source-line")
  if (line) await user.click(within(line).getByRole("button"))
  await screen.findByTestId("sources-source-card")
}

/** The card's whole rendered text — the only thing any assertion below reads. */
function cardText(): string {
  return document.body.textContent ?? ""
}

beforeEach(() => {
  mockGetWatch.mockReset()
  mockListSyncRuns.mockReset()
  mockGetWatch.mockResolvedValue({ items: [] })
  mockListSyncRuns.mockResolvedValue([])
})

// ══════════════════════════════════════════════════════════════════════════════════════
// B-4 — WHAT ONE CLICK ON "SYNC NOW" IS ALLOWED TO SAY
// ══════════════════════════════════════════════════════════════════════════════════════

describe("B-4 — the card says what actually happened", () => {
  it("1 ⛔ never claims a change COUNT, because the response carries none", async () => {
    // `WatchSyncResponse` (`lib/api/sources.ts:117-126`) is `status` / `message` /
    // `next_run_at?` / `next_check_within_seconds?` / `reader_running?`. There is no field
    // from which any number could be true — so `(0 changes)` renders identically for zero
    // changes and for five hundred.
    const user = userEvent.setup()
    mountCard()
    await openCard(user)

    await user.click(screen.getByTestId("sources-sync-now"))

    expect(cardText()).not.toContain("0 changes")
  })

  it("2 ⛔⛔ a REFUSAL and a SUCCESS cannot both be on the card — B-4's headline", async () => {
    // The parent records the refusal correctly into its own state and passes it down; the card
    // then invents a success beside it. Two independent slots, one click, two contradictory
    // statements.
    const user = userEvent.setup()
    const refusal = "Reading is switched off for this source."
    mountCard({ refusal })
    await openCard(user)

    await user.click(screen.getByTestId("sources-sync-now"))

    const text = cardText()
    expect(text).toContain(refusal)
    expect(text).not.toContain("Synced just now")
    expect(text).not.toContain("✓ Synced")
  })

  it("3 ⛔ a REJECTED sync renders a failure reading, never a success one", async () => {
    // D-18. ⚠ D-04 measured that the shipped parent never rejects — so this case is about the
    // NEXT caller, and about not leaving a stale success standing when one does.
    const user = userEvent.setup()
    mountCard({ onSyncNow: vi.fn().mockRejectedValue(new Error("The check could not be asked for.")) })
    await openCard(user)

    await user.click(screen.getByTestId("sources-sync-now"))

    const text = cardText()
    expect(text).toContain("The check could not be asked for.")
    expect(text).not.toContain("Synced just now")
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// W-2 — A 429 IS A CLAIM, AND A CLAIM NEEDS EVIDENCE
// ══════════════════════════════════════════════════════════════════════════════════════

describe("W-2 — the run pill claims rate limiting only from evidence", () => {
  it("4 ⛔ a 503 / DNS failure / socket timeout is NOT reported as a 429", async () => {
    // `isRateLimited` is `cause === "unreachable" && classifySourceFailure(last_error) ===
    // "unreachable"`, and `cause` already DEFAULTS to that same expression — a tautology over
    // the CATCH-ALL cause. So every transport failure there is renders `Run failed (429)`.
    const user = userEvent.setup()
    mountCard({ watch: watch({ last_status: "failed", last_error: "503 Service Unavailable" }) })
    await openCard(user)

    expect(within(screen.getByTestId("sources-run-pill")).queryByText(/429/)).toBeNull()
  })

  it("5 ⭐ CONTROL — the taxonomy cannot tell a 429 from a 503, so neither may the card", async () => {
    // ⚠ MEASURED, NOT ASSUMED. `failure_cause.py:97` maps `429: "unreachable"`, and the client
    // mirror (`sourceHealthVocabulary.ts:313`) puts `\b429\b|rate ?limit|quota exceeded` inside
    // the SAME `unreachable` matcher as `tim(?:ed|e) ?out` and `\b5\d\d\b`. **No cause in the
    // taxonomy means rate-limited.** So the honest reading of a genuine 429 is whatever a 503
    // reads — and this control asserts exactly that indistinguishability, which is true both
    // before the fix (both said `Run failed (429)`) and after it (both say the state label).
    // ⛔ It deliberately does NOT assert a rate-limit sentence: inventing a cause to keep the
    //    string alive is the defect, not the fix.
    const user = userEvent.setup()
    mountCard({
      watch: watch({ last_status: "failed", last_error: "429 Too Many Requests: rate limit exceeded" }),
    })
    await openCard(user)
    const rateLimited = screen.getByTestId("sources-run-pill").textContent
    cleanup()

    mountCard({ watch: watch({ last_status: "failed", last_error: "503 Service Unavailable" }) })
    await openCard(user)
    const unreachable = screen.getByTestId("sources-run-pill").textContent

    // ⚠ NON-VACUITY — two empty strings would compare equal while proving nothing.
    expect(rateLimited?.trim().length ?? 0).toBeGreaterThan(0)
    expect(rateLimited).toBe(unreachable)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// W-1 / W-3 — THE CONNECTION PILL, AND THE DOOR THE CONTROL OPENS
// ══════════════════════════════════════════════════════════════════════════════════════

describe("W-1 — the connection pill reads the cause", () => {
  it("6a ⛔ a REVOKED token does not read `Connected`", async () => {
    const user = userEvent.setup()
    mountCard({ state: "stopped", stopped: stoppedSource("token_revoked") })
    await openCard(user)

    expect(screen.getByTestId("sources-connection-pill")).not.toHaveTextContent(/connected/i)
  })

  it("6b ⛔ REJECTED app credentials do not read `Connected`", async () => {
    const user = userEvent.setup()
    mountCard({ state: "stopped", stopped: stoppedSource("app_credentials_invalid") })
    await openCard(user)

    expect(screen.getByTestId("sources-connection-pill")).not.toHaveTextContent(/connected/i)
  })

  it("7 ⭐ CONTROL — a healthy source still reads `Connected`", async () => {
    // ⚠ Without this, every negative above would also pass on a card whose pill rendered
    //   nothing at all. It also pins the other half of D-29: `folder_gone` and `unreachable`
    //   are NOT connection-level failures and must keep saying the connection is fine.
    const user = userEvent.setup()
    mountCard()
    await openCard(user)

    expect(screen.getByTestId("sources-connection-pill")).toHaveTextContent(/connected/i)
  })
})

describe("W-3 — the control names the door", () => {
  it("8 ⛔ `token_revoked`'s control says WHERE reconnecting happens, like its two siblings", async () => {
    // `runFix` only NAVIGATES for `action: "reconnect"` (`WatchedFoldersSection.tsx:357-367`).
    // `connection_disabled` → "Open {n} in Settings ↗" and `app_credentials_invalid` →
    // "Check {n} in Settings" were both reworded to name the door; this one still read a bare
    // "Reconnect {n}".
    // ⭐ Unlike its two siblings the VERB survives — for a revoked token, reconnecting genuinely
    //   IS the fix. What was missing was only WHERE.
    const user = userEvent.setup()
    mountCard({ state: "stopped", stopped: stoppedSource("token_revoked") })
    await openCard(user)

    const fix = screen.getByTestId("sources-fix")
    expect(fix).toHaveTextContent(/Reconnect/)
    expect(fix).toHaveTextContent(/Settings/)
  })
})

/**
 * Phase 221 (D-221-12) — the connections list row's verdict, DERIVED and never stored.
 *
 * ── THE DEFECT THIS EXISTS TO CLOSE ────────────────────────────────────────────────────
 * Measured 2026-08-30/31: **Microsoft 365 shows `OAuth connected · ✓ Ready` with ZERO
 * tools.** It is an `oauth_byo` row whose discovery never completed, so the connection is
 * real, the token is real, and the row can do nothing at all. *Ready* there is not
 * optimistic — it is false.
 *
 * ── ⚠ AND THE FIRST CUT OF THIS FILE OVERCORRECTED, WHICH IS WORTH RECORDING ───────────
 * It returned `unusable` for ANY zero-action row, and **nine tests in
 * `ConnectionsTab.test.tsx` and `ConnectionFormPanel.oauth.test.tsx` went red** — correctly.
 * Phase 206.1 recorded the opposite rule (AR-03) for a good reason:
 *
 *   > "⚠ an EMPTY discovery is NOT evidence — absence read as success is the old defect"
 *
 * A row nobody has discovered yet has an empty `discovered_tools` for the same reason a row
 * discovered and found barren does. Calling the first one *Not usable* asserts a fact we
 * have not measured — **the identical error as calling it Ready, pointed the other way.**
 *
 * So the two facts are separated: **`discoveryHasRun` is what distinguishes them.**
 *   · zero actions, never checked   → `undiscovered` → the row keeps reading `◌ Not checked`
 *   · zero actions, checked anyway  → `unusable`     → `⚠ Not usable`
 * Both stop the row claiming `✓ Ready`, which is the whole defect. Neither invents
 * knowledge.
 *
 * ⚠ **DERIVED, WHICH IS THE POINT.** A stored flag has to be maintained by whoever changes
 * the world, and the world here is a Google Cloud console nobody tells us about: on
 * 2026-08-31 three of Google's six applications were switched off, and back on hours later,
 * with no write to our database in either direction. A verdict computed from what the row
 * can actually do degrades and recovers on its own.
 *
 * ⚠ **`blockedApplicationCount` is 0 until plan 02 supplies it.** Deliberate rather than
 * unfinished: plan 01 ships the shape and the honest zero-action cases, and the day the
 * availability probe lands the same row starts reading `Partly ready` with no change here.
 */

export type RowVerdict = "ready" | "partly" | "unusable" | "undiscovered" | "source-only"

export interface RowVerdictInput {
  /** How many actions this connection advertises. */
  toolCount: number
  /** How many of its applications cannot currently run. Plan 02 fills this. */
  blockedApplicationCount: number
  /**
   * Phase 239 (D-239-08 / BUG-260907-01) — can this connection be BROWSED as a file source?
   *
   * ⭐ **THE INPUT SET WENT INCOMPLETE; THE LOGIC NEVER WENT WRONG.** Everything this file
   * says above is still true about ACTIONS. What changed underneath it is that Phase 238
   * shipped `SourceAdapter`s — a connection can now have zero actions and still browse,
   * preview and be watched. The live OneDrive row read `⚠ Not usable` on the first screen
   * after its OAuth round trip while `browse()` returned six real folders and `read_file()`
   * returned 1395 correct bytes the same session.
   *
   * ⚠ **NOT A GUESS MADE HERE.** It is the server's answer, resolved by
   * `sourceCapability.isSourceCapable` from `GET /connectors/source-families` plus the
   * row's own declared protocol — the same two doors `services/sources/base.py` uses.
   *
   * ⚠ **DEFAULT `false`, AND THAT DIRECTION IS TM-239-07.** The families list arrives over
   * the network; a default of `true` would turn every loading render into a green claim.
   * A caller that has not been told says nothing, and nothing reads as *not capable*.
   */
  isSourceCapable?: boolean
  /**
   * Has a discovery/check actually run against this connection?
   *
   * ⚠ Load-bearing, per AR-03 above: it is the ONLY thing separating *"we looked and there
   * is nothing"* from *"nobody has looked"*. Default `false` — the safe reading, because
   * assuming a check happened is how an absence gets reported as a finding.
   */
  discoveryHasRun?: boolean
}

/**
 * ⚠ **ORDER MATTERS: the zero-action arms are checked FIRST.** A connection with no actions
 * has no applications either, so its `blockedApplicationCount` is legitimately 0 — testing
 * "blocked === 0 ⇒ ready" first is exactly how Microsoft 365 came to claim Ready.
 * *Nothing is broken* and *nothing works* are different facts and must not collide.
 */
export function connectionRowVerdict({
  toolCount,
  blockedApplicationCount,
  discoveryHasRun = false,
  isSourceCapable = false,
}: RowVerdictInput): RowVerdict {
  if (toolCount <= 0) {
    // ⚠ **ABOVE the `discoveryHasRun` split, and that placement is the decision.** AR-03
    // forbids reading an ABSENCE as success — but this is not an absence. `✓ Ready` asserts
    // that actions exist, which an empty discovery cannot evidence; `✓ Ready as source`
    // asserts that an ADAPTER is registered for this family and the credential is not
    // revoked or errored. Both are facts we HOLD (the server's published registry, and the
    // row's own status), so the claim is measured rather than assumed — which is exactly
    // what separates it from the defect this file was written to close.
    if (isSourceCapable) return "source-only"
    return discoveryHasRun ? "unusable" : "undiscovered"
  }
  if (blockedApplicationCount > 0) return "partly"
  return "ready"
}

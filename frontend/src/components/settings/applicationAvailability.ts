/**
 * Phase 221 plan 02 (D-221-04) — one application's verdict, turned into a REMEDY.
 *
 * ── THE VERDICT IS THE SERVER'S; THE WORDS ARE OURS ───────────────────────────────────
 * ⚠ **THIS FILE DOES NOT CLASSIFY, AND THAT IS A DELIBERATE NARROWING OF THE PLAN.** The
 * plan's sketched signature took `grantedScopes` and a raw probe body and decided the state
 * here. That would be a SECOND classifier: the backend already owns one, built on Google's
 * enum vocabulary, sharing its predicate with the refusal site so a panel and a refusal
 * cannot disagree about the same connection on the same afternoon. Re-deciding the state in
 * the browser would recreate exactly the defect `availability.py` refuses to create —
 * *"two parsers that disagree is how a refusal comes to name the wrong cause."*
 *
 * So the split is: the server decides WHICH state (it holds the scopes and made the call),
 * this file decides WHAT IT SAYS. That is also the rule `check_connection` already states
 * for every other verdict on this surface — *"No user-facing sentence is authored here."*
 *
 * ── THE REMEDY NAMES THE ACTION, NOT THE STATUS ───────────────────────────────────────
 * *"The Sheets API is switched off in your Google Cloud project"* is actionable.
 * *"Sheets: error"* is not. Every non-ready state carries the thing a person can go and do.
 *
 * ── ⚠ `ready` HAS NO REMEDY AND MUST RENDER NOTHING ───────────────────────────────────
 * A working application says NOTHING. Silence is the healthy state — the noise audit of
 * 2026-08-31 deleted twelve items that each said nothing, and six availability lines all
 * reading "fine" would put them straight back. `remedy` is `undefined` for `ready`, and the
 * component asserts the ELEMENT IS ABSENT rather than empty.
 *
 * ── ⚠ THE CONSOLE LINK EXISTS ON EXACTLY ONE ARM ──────────────────────────────────────
 * `api_off` is a console visit where reconnecting is useless; `scope_missing` is a
 * re-consent where the console is useless. Their remedies are OPPOSITE, so handing a
 * console link to a scope problem is worse than handing over nothing.
 */

import type { ApplicationAvailabilityWire } from "@/lib/api"
import { applicationLabel } from "./toolGroups"
import { AVAILABILITY_COPY } from "./grantsVocabulary"

/** The four states, exactly as the server's `ApplicationAvailability.state` union. */
export type AvailabilityState = "ready" | "api_off" | "scope_missing" | "unknown"

export interface AvailabilityRemedy {
  sentence: string
  /** The thing to go and do. `href` only where a destination genuinely helps. */
  action: { label: string; href?: string }
}

export interface ApplicationAvailability {
  app: string
  state: AvailabilityState
  /** Present only when `state !== "ready"`. The REMEDY, never a status. */
  remedy?: AvailabilityRemedy
}

/** ⚠ THE WIRE SHAPE IS NOT REDECLARED HERE. It lives once, beside the client call that
 *  receives it (`lib/api/connectors.ts`), and is re-exported for convenience below. A
 *  second copy in this file would be two definitions of one payload, free to drift the day
 *  the server grows a field — which is the same class of defect as two error parsers. */
export type { ApplicationAvailabilityWire }

/**
 * ⚠ ORIGIN-WHITELISTED IN THE BROWSER TOO, and NOT because the backend forgot.
 *
 * `_http.activation_url` already refuses any URL outside Google's two console origins. This
 * is the second gate on the same value for a different reason: this one is rendered as a
 * live `href` a person clicks, and a link is the one place where a value that travelled
 * through several layers becomes an action. Two cheap gates on a vendor-supplied URL is the
 * correct number when one of them is an anchor tag.
 */
const CONSOLE_ORIGINS = [
  "https://console.developers.google.com/",
  "https://console.cloud.google.com/",
] as const

function safeConsoleUrl(raw: string | null | undefined): string | undefined {
  if (typeof raw !== "string" || !raw) return undefined
  return CONSOLE_ORIGINS.some((origin) => raw.startsWith(origin)) ? raw : undefined
}

/**
 * One application's wire verdict → what the panel should say about it.
 *
 * ⚠ An unrecognised state is treated as `unknown`, never as `ready`. A future server that
 * grows a fifth state must not be read by an old client as "everything is fine" — that is
 * absence of evidence being rendered as evidence of absence, which is the AR-03 defect.
 */
export function applicationAvailability(
  wire: ApplicationAvailabilityWire,
): ApplicationAvailability {
  const label = applicationLabel(wire.app) || wire.app
  const state: AvailabilityState =
    wire.state === "ready" || wire.state === "api_off" || wire.state === "scope_missing"
      ? wire.state
      : "unknown"

  if (state === "ready") return { app: wire.app, state }

  if (state === "api_off") {
    const href = safeConsoleUrl(wire.console_url)
    return {
      app: wire.app,
      state,
      remedy: {
        sentence: AVAILABILITY_COPY.API_OFF(label),
        // ⚠ Without a usable URL the sentence still stands and still names the right place.
        // A missing link degrades the ACTION, never the diagnosis.
        action: href
          ? { label: AVAILABILITY_COPY.API_OFF_ACTION, href }
          : { label: AVAILABILITY_COPY.API_OFF_ACTION_NO_LINK },
      },
    }
  }

  if (state === "scope_missing") {
    return {
      app: wire.app,
      state,
      remedy: {
        // ⚠ NO `href`. The console cannot fix a scope, and offering it here would send
        // someone to the one place guaranteed not to help.
        sentence: AVAILABILITY_COPY.SCOPE_MISSING(label),
        action: { label: AVAILABILITY_COPY.SCOPE_MISSING_ACTION },
      },
    }
  }

  return {
    app: wire.app,
    state: "unknown",
    remedy: {
      sentence: AVAILABILITY_COPY.UNKNOWN(label),
      action: { label: AVAILABILITY_COPY.UNKNOWN_ACTION },
    },
  }
}

/**
 * How many of a connection's applications are known to be blocked.
 *
 * ⚠ `unknown` DOES NOT COUNT, and that is the whole correctness of this function. A
 * probe that could not reach Google measured nothing; counting it would put
 * `⚠ Partly ready · 1 needs attention` on a healthy connection because someone's wifi
 * dropped. Only the two states with a NAMED cause and a real remedy count.
 *
 * ⚠ An EMPTY list is 0 — "nothing was measured", never "everything is fine". That
 * distinction is carried by the caller: `connectionRowVerdict` reads a 0 here alongside
 * `discoveryHasRun`, exactly as it already does for the tool count.
 */
export function blockedApplicationCount(
  verdicts: readonly ApplicationAvailabilityWire[] | null | undefined,
): number {
  if (!verdicts?.length) return 0
  return verdicts.filter((v) => v.state === "api_off" || v.state === "scope_missing").length
}

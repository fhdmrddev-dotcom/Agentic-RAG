/**
 * Phase 307-03 (OAUTH-04; D-12, D-13, D-35; T-307-01, T-307-07) — the consent page's pure rules.
 *
 * PURE: no React, no fetch, no browser global. Words come from `OAUTH_COPY` (and the 304 blocker
 * words stay in `MCP_KEY_COPY`, mapped by the page).
 *
 *   • `summaryParts` / `summarySentence` — the one sentence the member agrees to, built from the live
 *     choices (its {can} and {where} slots bold). The subject is always "This app", never the name.
 *   • `firstUnmetAllow` — why Allow is disabled, in the UI-SPEC §1a order.
 *   • `whyLine` — the who-well's last line. Every WEB case ends with "Only allow it if you just
 *     started connecting from {host}." (the 307-03 security decision, see `oauthCopy.ts`).
 *   • `redirectMatchesShown` — ⛔ the last gate before the browser leaves Syrel: the server's URL must
 *     parse, be https (or http on a loopback host), and name exactly the host the page showed.
 *   • `copyParts` — a template split into text and named slots, so a slot can be bold without HTML.
 */
import type { McpToolRef } from "@/lib/api/apiKeys"
import { fillCopy } from "@/components/settings/apiKeys/apiKeysCopy"
import { draftTools, type McpDraft } from "@/components/settings/apiKeys/mcpKeyFacts"
import type { ConsentClient } from "@/lib/api/oauth"
import { OAUTH_COPY } from "./oauthCopy"

const C = OAUTH_COPY.consent

export interface CopyPart {
  text: string
  /** The slot this text filled, or null for the template's own words. */
  slot: string | null
}

/** `template` with each `{slot}` filled, as parts. An empty slot is dropped with the space after it. */
export function copyParts(template: string, vars: Record<string, string>): CopyPart[] {
  const out: CopyPart[] = []
  const re = /\{([a-zA-Z]+)\}/g
  let last = 0
  let skipSpace = false
  for (let m = re.exec(template); m !== null; m = re.exec(template)) {
    let lead = template.slice(last, m.index)
    if (skipSpace) lead = lead.replace(/^ /, "")
    if (lead) out.push({ text: lead, slot: null })
    const value = vars[m[1]]
    if (value === undefined) out.push({ text: m[0], slot: null })
    else if (value === "") skipSpace = true
    else out.push({ text: value, slot: m[1] })
    if (value !== "") skipSpace = false
    last = re.lastIndex
  }
  let tail = template.slice(last)
  if (skipSpace) tail = tail.replace(/^ /, "")
  if (tail) out.push({ text: tail, slot: null })
  return out
}

export interface SummaryInput {
  draft: McpDraft
  catalogue: readonly McpToolRef[] | null
  /** Folders the member ticked that are sent (`draftFolderIds`), for "Only these folders". */
  folderCount: number
  orgName: string
}

/** The sentence's parts; {can} and {where} are the bold slots. */
export function summaryParts({ draft, catalogue, folderCount, orgName }: SummaryInput): CopyPart[] {
  const toolCount = catalogue ? draftTools(draft, catalogue).length : draft.custom.length
  const can = draft.preset === "custom" ? fillCopy(C.can.custom, { N: toolCount }) : C.can[draft.preset]
  const scope =
    draft.folderMode === "all" ? fillCopy(C.where.all, { org: orgName }) : fillCopy(C.where.only, { N: folderCount, org: orgName })
  const where = scope + (draft.external ? C.where.external : C.where.noExternal)
  const cannot = draft.preset === "read" ? C.cannot.read : draft.preset === "ask" ? C.cannot.ask : ""
  return copyParts(C.summary, { can, where, cannot, org: orgName })
}

/** The sentence as one string, its bold slots wrapped in `**` (what the tests compare). */
export function summarySentence(input: SummaryInput): string {
  return summaryParts(input)
    .map((p) => (p.slot === "can" || p.slot === "where" ? `**${p.text}**` : p.text))
    .join("")
}

export type AllowBlocker = "needOrg" | "needTool" | "needFolder" | "waitTools" | "waitFolders"

/** The first unmet Allow condition (UI-SPEC §1a item 7): org -> tool -> folder -> still loading. */
export function firstUnmetAllow(d: {
  orgOn: boolean
  draft: McpDraft
  catalogue: readonly McpToolRef[] | null
  foldersLoaded: boolean
  /** 307 WR-06: how many folders Allow would actually SEND (`draftFolderIds`), when known. */
  sentFolderCount?: number
}): AllowBlocker | null {
  if (!d.orgOn) return "needOrg"
  const tools = d.catalogue ? draftTools(d.draft, d.catalogue) : []
  if (d.catalogue && tools.length === 0) return "needTool"
  const folderCount = d.sentFolderCount ?? d.draft.folderIds.length
  if (d.draft.folderMode === "only" && folderCount === 0) return "needFolder"
  if (!d.catalogue) return "waitTools"
  if (d.draft.folderMode === "only" && !d.foldersLoaded) return "waitFolders"
  return null
}

/** The who-well's last line; the first matching case wins (UI-SPEC §1a "Why line"). */
export function whyLine(
  client: Pick<ConsentClient, "redirect_kind" | "name_source" | "host_seeded" | "redirect_host" | "published_host">,
): string {
  if (client.redirect_kind === "loopback") return C.why.loopback
  const host = displayHost(client.redirect_host)
  if (client.name_source === "cimd") {
    return fillCopy(C.why.cimd, { publisher: displayHost(client.published_host ?? ""), host })
  }
  return fillCopy(client.host_seeded ? C.why.dcrSeeded : C.why.dcrOther, { host })
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"])
const MAX_HOST = 253

/** A host as the page shows it: the hostname only (a loopback port carries no trust), lowercase,
 *  `[::1]` with its brackets, capped at 253 characters. */
export function displayHost(host: string): string {
  const h = (host ?? "").trim().toLowerCase()
  const bracketed = h.match(/^\[[^\]]*\]/)
  const bare = bracketed ? bracketed[0] : h.replace(/:\d+$/, "")
  return bare.slice(0, MAX_HOST)
}

/**
 * ⛔ T-307-01 / D-35: may the page send the browser to `url`? Only when it parses, its scheme is
 * `https:` (or `http:` on a loopback host), and its hostname is exactly the host the page showed.
 * `kind` null (a deployment-off request names no kind): https on the shown host, http only on loopback.
 */
export function redirectMatchesShown(url: string, shownHost: string, kind: "web" | "loopback" | null): boolean {
  const shown = displayHost(shownHost)
  if (!shown || typeof url !== "string" || !url) return false
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.username || parsed.password) return false
  const host = parsed.hostname.toLowerCase()
  if (host !== shown) return false
  if (parsed.protocol === "https:") return kind !== "loopback" || LOOPBACK.has(host)
  if (parsed.protocol === "http:") return kind !== "web" && LOOPBACK.has(host)
  return false
}

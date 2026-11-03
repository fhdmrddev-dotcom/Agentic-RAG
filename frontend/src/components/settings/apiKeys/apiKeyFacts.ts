/**
 * Phase 293-04 (D-05, D-17) — the wire → key-card facts. PURE: no React, no fetch, no storage, and
 * it spells no copy (every word comes from `apiKeysCopy.ts`).
 *
 * ⚠ THE SERVER IS THE TRUTH. A key's `state` and each workflow's `state` are read live by the
 *   server on every list; this module never recomputes them. It only decides how they READ:
 *   a key whose workflow is no longer startable must never say `● active` (UI-SPEC failure 3),
 *   and a refused call must always say why (failure 4) — an unknown reason shows its raw code.
 *
 * Dates format in the viewer's local zone, en-GB parts, with `now` injected for tests.
 */
import type {
  ApiKeyCall,
  ApiKeyLimits,
  ApiKeyRead,
  ApiKeyWorkflowRef,
  McpOff,
  McpToolRef,
  StartableWorkflow,
} from "@/lib/api/apiKeys"
import { API_KEYS_COPY, fillCopy } from "./apiKeysCopy"
import { MCP_KEY_COPY } from "./mcpKeyCopy"
import { mcpScopeChips } from "./mcpKeyFacts"
import { mcpCallDetailLine, mcpCallWords } from "./mcpCallWords" // 305-03 (D-53)

const C = API_KEYS_COPY
const M = MCP_KEY_COPY
const DAY_MS = 86_400_000

// ── dates ─────────────────────────────────────────────────────────────────────────────────────

const pad2 = (n: number) => String(n).padStart(2, "0")

function hhmm(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** Whole calendar days from `a` to `b` in local time (DST-safe: midnight to midnight). */
function calendarDays(a: Date, b: Date): number {
  const ma = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()
  const mb = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime()
  return Math.round((mb - ma) / DAY_MS)
}

/** `Mon 27 Oct`, with the year when it is not the current one: `Mon 4 Jan 2027`. */
export function formatDay(iso: string, now: Date): string {
  const d = new Date(iso)
  const base = `${C.dates.weekdays[d.getDay()]} ${d.getDate()} ${C.dates.months[d.getMonth()]}`
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`
}

/** An activity time: `10:42` today, `Yesterday 02:04`, `6 Oct 09:00` older (+ year if not this one). */
export function formatCallTime(iso: string, now: Date): string {
  const d = new Date(iso)
  const days = calendarDays(d, now)
  if (days === 0) return hhmm(d)
  if (days === 1) return fillCopy(C.dates.yesterday, { time: hhmm(d) })
  const day = `${d.getDate()} ${C.dates.months[d.getMonth()]}`
  return d.getFullYear() === now.getFullYear() ? `${day} ${hhmm(d)}` : `${day} ${d.getFullYear()} ${hhmm(d)}`
}

// ── one key card ──────────────────────────────────────────────────────────────────────────────

export type KeyTagKind = "active" | "refused" | "expired" | "revoked" | "off"

export interface KeyChipFacts {
  id: string
  name: string
  refused: boolean
  text: string
  /** 304-05: an MCP scope chip's full list (the tool names, or the collapsed folders). */
  title?: string
}

export interface KeyCardFacts {
  tag: { kind: KeyTagKind; text: string }
  /** Expired or revoked: the card renders dimmed. */
  dead: boolean
  chips: KeyChipFacts[]
  /** One amber line per refused workflow, in chip order. */
  refusalLines: string[]
  expires: string
  expiresRelative: string
  lastUsed: string
  created: string
  /** The revoke receipt (`✎ Revoked by …`), or null on a key that was not revoked. */
  receipt: string | null
  /** 304-05, MCP keys only: which switch has MCP off on a live key (the deployment's wins), or null. */
  mcpOff?: McpOff | null
}

const REFUSED_WORDS: Record<Exclude<ApiKeyWorkflowRef["state"], "startable">, { chip: string; line: string }> = {
  unpublished: { chip: C.card.chipUnpublished, line: C.card.lineUnpublished },
  deleted: { chip: C.card.chipDeleted, line: C.card.lineDeleted },
  cannot_run: { chip: C.card.chipCannotRun, line: C.card.lineCannotRun },
  file_upload: { chip: C.card.chipFileUpload, line: C.card.lineFileUpload },
  needs_task: { chip: C.card.chipNeedsTask, line: C.card.lineNeedsTask },
}

function chipFacts(w: ApiKeyWorkflowRef): { chip: KeyChipFacts; line: string | null } {
  if (w.state === "startable") return { chip: { id: w.id, name: w.name, refused: false, text: w.name }, line: null }
  // An unknown future state is refused-looking too: never read a workflow as fine by default.
  const words = REFUSED_WORDS[w.state] ?? REFUSED_WORDS.cannot_run
  return {
    chip: { id: w.id, name: w.name, refused: true, text: fillCopy(words.chip, { workflow: w.name }) },
    line: fillCopy(words.line, { workflow: w.name }),
  }
}

function expiryFacts(key: ApiKeyRead, now: Date): { expires: string; expiresRelative: string } {
  if (!key.expires_at) return { expires: C.card.never, expiresRelative: C.card.neverExpires }
  const days = calendarDays(now, new Date(key.expires_at))
  const expires = formatDay(key.expires_at, now)
  if (key.state === "expired" || days < 0 || (days === 0 && new Date(key.expires_at) <= now)) {
    const ago = -days
    return { expires, expiresRelative: ago <= 0 ? C.card.expiredToday : fillCopy(C.card.expiredDaysAgo, { N: ago }) }
  }
  return { expires, expiresRelative: days === 0 ? C.card.today : fillCopy(C.card.inDays, { N: days }) }
}

function receipt(key: ApiKeyRead, now: Date): string | null {
  if (key.state !== "revoked") return null
  const date = key.revoked_at ? formatDay(key.revoked_at, now) : "—"
  if (key.revoked_by_admin) return fillCopy(C.card.receiptAdmin, { name: key.revoked_by_name ?? C.calls.ownerFallback, date })
  if (key.owner_is_you) return fillCopy(C.card.receiptYou, { date })
  return fillCopy(C.card.receiptOwner, { name: key.owner_name ?? key.revoked_by_name ?? C.sheet.unknownOwner, date })
}

/** 304-05: an MCP key's scope as card chips — the preset or a tool count, All folders or up to
 *  four folder names then `+N more`, and the external chip only when included. */
function mcpChips(key: ApiKeyRead, catalogue: readonly McpToolRef[] | undefined): KeyChipFacts[] {
  const m = mcpScopeChips(key, catalogue)
  const chip = (id: string, text: string, title?: string): KeyChipFacts =>
    title === undefined ? { id, name: text, refused: false, text } : { id, name: text, refused: false, text, title }
  const toolText =
    m.tools.preset === "custom" ? fillCopy(M.mcp.chipNTools, { N: m.tools.count }) : M.mcp.presets[m.tools.preset]
  const chips = [chip("tools", toolText, m.tools.names.join(", "))]
  if (m.folders.all) chips.push(chip("folders", M.mcp.chipAllFolders))
  for (const f of m.folders.shown) chips.push(chip(`folder:${f.id}`, f.name))
  if (m.folders.more.length > 0) {
    const more = fillCopy(M.mcp.chipMore, { N: m.folders.more.length })
    chips.push(chip("more", more, m.folders.more.map((f) => f.name).join(", ")))
  }
  if (m.external) chips.push(chip("external", M.mcp.chipExternal))
  return chips
}

function mcpKeyCardFacts(key: ApiKeyRead, now: Date, catalogue: readonly McpToolRef[] | undefined): KeyCardFacts {
  let tag: KeyCardFacts["tag"]
  if (key.state === "revoked") tag = { kind: "revoked", text: C.card.tagRevoked }
  else if (key.state === "expired") tag = { kind: "expired", text: C.card.tagExpired }
  // WR-02: `unknown` is not "switched off" — the card's notice line says we couldn't check.
  else if (key.mcp_off && key.mcp_off !== "unknown") tag = { kind: "off", text: M.mcp.tagOff }
  else tag = { kind: "active", text: C.card.tagActive }
  return {
    tag,
    // Switched off is not dead: switching back on restores the key (D-19).
    dead: key.state !== "active",
    chips: mcpChips(key, catalogue),
    refusalLines: [],
    ...expiryFacts(key, now),
    lastUsed: key.last_used_at ? formatCallTime(key.last_used_at, now) : M.mcp.notUsedYet,
    created: formatDay(key.created_at, now),
    receipt: receipt(key, now),
    mcpOff: key.state === "active" ? key.mcp_off : null,
  }
}

/** The card's facts. `catalogue` is the server's MCP tool list (`list.mcp.tools`), read only for an
 *  MCP key's preset name; a workflow key's facts never depend on it. */
export function keyCardFacts(key: ApiKeyRead, now: Date, catalogue?: readonly McpToolRef[]): KeyCardFacts {
  if (key.kind === "mcp") return mcpKeyCardFacts(key, now, catalogue)
  const parts = key.workflows.map(chipFacts)
  const chips = parts.map((p) => p.chip)
  const refusalLines = parts.map((p) => p.line).filter((l): l is string => l !== null)
  const refusedCount = chips.filter((c) => c.refused).length
  let tag: KeyCardFacts["tag"]
  if (key.state === "revoked") tag = { kind: "revoked", text: C.card.tagRevoked }
  else if (key.state === "expired") tag = { kind: "expired", text: C.card.tagExpired }
  else if (refusedCount > 0) tag = { kind: "refused", text: fillCopy(C.card.tagRefused, { N: refusedCount }) }
  else tag = { kind: "active", text: C.card.tagActive }
  return {
    tag,
    dead: key.state !== "active",
    chips,
    refusalLines,
    ...expiryFacts(key, now),
    lastUsed: key.last_used_at ? formatCallTime(key.last_used_at, now) : C.card.neverUsed,
    created: formatDay(key.created_at, now),
    receipt: receipt(key, now),
  }
}

/** Card order: active keys (refused-for-some included) by last used, newest first; never-used
 *  active keys after them by creation, newest first; then expired; then revoked. */
export function orderKeys(keys: readonly ApiKeyRead[]): ApiKeyRead[] {
  const rank = (k: ApiKeyRead) => (k.state === "revoked" ? 3 : k.state === "expired" ? 2 : k.last_used_at ? 0 : 1)
  const time = (k: ApiKeyRead) => new Date((rank(k) === 0 ? k.last_used_at : k.created_at) ?? 0).getTime()
  return [...keys].sort((a, b) => rank(a) - rank(b) || time(b) - time(a))
}

// ── one call ──────────────────────────────────────────────────────────────────────────────────

export interface CallContext {
  key?: ApiKeyRead
  limits?: ApiKeyLimits
  orgName?: string | null
  now?: Date
}

function detailNumber(call: ApiKeyCall, k: string): number | null {
  const v = call.detail?.[k]
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

function detailString(call: ApiKeyCall, k: string): string | null {
  const v = call.detail?.[k]
  return typeof v === "string" && v.trim() ? v : null
}

function detailNames(call: ApiKeyCall): string | null {
  const v = call.detail?.names
  if (!Array.isArray(v)) return null
  const names = v.filter((n): n is string => typeof n === "string" && n !== "")
  return names.length ? names.join(", ") : null
}

function okWords(call: ApiKeyCall): string {
  if (call.verb === "start") return C.calls.started
  switch (call.outcome) {
    case "running": {
      const i = detailNumber(call, "step_index")
      const n = detailNumber(call, "step_total")
      return i !== null && n !== null ? fillCopy(C.calls.runningStep, { i, n }) : C.calls.running
    }
    case "waiting_for_person": {
      const who = detailString(call, "who")
      return who ? fillCopy(C.calls.waitingWho, { name: who }) : C.calls.waiting
    }
    case "paused":
      return C.calls.paused
    case "completed":
    case "finished": {
      const files = detailNumber(call, "files")
      return files ? fillCopy(C.calls.finishedFiles, { N: files }) : C.calls.finished
    }
    case "failed":
      return C.calls.failed
    case "cancelled":
    case "stopped":
      return C.calls.stopped
    case "started":
      return C.calls.started
    case null:
    case undefined:
    case "":
      return C.calls.read
    default:
      return call.outcome
  }
}

function refusedWords(call: ApiKeyCall, ctx: CallContext): string | null {
  const now = ctx.now ?? new Date()
  const owner = ctx.key?.owner_name ?? C.calls.ownerFallback
  const org = ctx.orgName ?? C.calls.orgFallback
  switch (call.reason) {
    case "revoked":
      return ctx.key?.revoked_at ? fillCopy(C.calls.revoked, { date: formatDay(ctx.key.revoked_at, now) }) : C.calls.revokedNoDate
    case "expired":
      return ctx.key?.expires_at ? fillCopy(C.calls.expired, { date: formatDay(ctx.key.expires_at, now) }) : C.calls.expiredNoDate
    case "not_member":
      return fillCopy(C.calls.notMember, { owner, org })
    case "banned":
      return fillCopy(C.calls.banned, { owner, org })
    case "not_on_key":
    case "deleted":
      return C.calls.notOnKey
    case "run_not_found":
      return C.calls.runNotFound
    case "unpublished":
      return C.calls.unpublished
    case "cannot_run":
      return fillCopy(C.calls.cannotRun, { owner })
    case "entitlement":
      return C.calls.entitlement
    case "unknown_input": {
      const names = detailNames(call)
      return names ? fillCopy(C.calls.unknownInput, { names }) : C.calls.unknownInputBare
    }
    case "missing_input": {
      const names = detailNames(call)
      return names ? fillCopy(C.calls.missingInput, { names }) : C.calls.missingInputBare
    }
    case "file_upload":
      return C.calls.fileUpload
    case "needs_task":
      return C.calls.needsTask
    case "invalid_body":
      return C.calls.invalidBody
    case "no_template":
    case "no_template_bound":
      return C.calls.noTemplate
    case "foreign_folder": // 298-02 (ORG-05)
      return C.calls.foreignFolder
    case "workflows_disabled":
      return C.calls.workflowsDisabled
    case "limiter_unavailable":
      return C.calls.limiterUnavailable
    case "admission:credential": // 306-02 (GUARD-01, D-19)
      return C.calls.admissionKey
    case "admission:org":
      return C.calls.admissionOrg
    case "admission:provider":
      return C.calls.admissionProvider
    case "admission_unavailable":
      return C.calls.limiterUnavailable
    case "wrong_resource": // 307 (D-18) — an OAuth token minted for another resource
      return M.calls.wrongResource
    case "wrong_kind": // 304-02 (D-36)
      return M.calls.wrongKind
    case "mcp_off_org":
      return M.calls.mcpOffOrg
    case "mcp_off_deployment":
      return M.calls.mcpOffDeployment
    case "over_limit": {
      const fromDetail = detailNumber(call, "limit")
      const fromLimits = call.verb === "read" ? ctx.limits?.reads_per_minute : ctx.limits?.starts_per_minute
      const N = fromDetail ?? fromLimits ?? null
      if (N === null) return C.calls.overBare
      return fillCopy(call.verb === "read" ? C.calls.overReads : C.calls.overStarts, { N })
    }
    case null:
    case undefined:
    case "":
      return null
    default:
      return call.reason
  }
}

/** The result words of one call: `✓ started`, `✕ refused: key revoked on Tue 6 Oct`, … */
export function callWords(call: ApiKeyCall, ctx: CallContext = {}): { ok: boolean; text: string } {
  const mcp = ctx.key?.kind === "mcp" ? mcpCallWords(call, ctx) : null
  if (mcp) return mcp
  if (call.ok) return { ok: true, text: fillCopy(C.calls.ok, { words: okWords(call) }) }
  const words = refusedWords(call, ctx)
  return { ok: false, text: words === null ? C.calls.refusedBare : fillCopy(C.calls.refused, { words }) }
}

export type BarKind = "start" | "read" | "refused"

/** The call strip: the last 20 calls, OLDEST first (the server sends newest first). */
export function callBars(calls: readonly ApiKeyCall[]): { kind: BarKind; call: ApiKeyCall }[] {
  return calls
    .slice(0, 20)
    .reverse()
    .map((call) => ({ kind: call.ok ? call.verb : "refused", call }))
}

/** `run 7f3a91` (first 6 characters) or `no run`. */
export function runCellText(runId: string | null): string {
  return runId ? fillCopy(C.activity.run, { id: runId.slice(0, 6) }) : C.activity.noRun
}

/** The tapped bar's one line: `{time} · {verb} · {workflow} · {run} · {result}`. */
export function callDetailLine(call: ApiKeyCall, ctx: CallContext, now: Date): string {
  if (ctx.key?.kind === "mcp") return mcpCallDetailLine(call, formatCallTime(call.at, now), callWords(call, { ...ctx, now }).text)
  return [
    formatCallTime(call.at, now),
    call.verb,
    call.workflow_name ?? C.activity.noWorkflow,
    runCellText(call.run_id),
    callWords(call, { ...ctx, now }).text,
  ].join(C.activity.separator)
}

// ── the create form's workflow rows ───────────────────────────────────────────────────────────

/** A picker row: its declared keys on the right (or "no inputs"), or why it can't be picked. */
export function startableRowFacts(w: StartableWorkflow): { disabled: boolean; right: string } {
  if (!w.startable) {
    const right =
      w.reason === "file_upload" ? C.draft.fileUpload : w.reason === "needs_task" ? C.draft.needsTask : C.draft.cannotPick
    return { disabled: true, right }
  }
  return { disabled: false, right: w.fields.length ? w.fields.map((f) => f.key).join(", ") : C.draft.noInputs }
}

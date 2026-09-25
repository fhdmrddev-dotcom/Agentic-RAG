/**
 * Phase 262 plan 03 (PACK-11) — the catalog's pure decisions.
 *
 * Search, category derivation and knowledge-folder naming, decided here so the page is left with
 * nothing to decide but what to draw. No React, no fetch, no module-level state.
 *
 * ⛔ THE CATEGORY PILLS ARE DERIVED, NEVER LISTED. Sketch 261-262 draws five named pills; the
 * `category` column (migration 189) is free text defaulting to `'General'`, so a hardcoded pill
 * menu would advertise categories nobody authored — a sixth demo-Expert-class artefact in the
 * same phase that retired five (RESEARCH R-7 / plan 02). `categoriesOf` reads the rows. The page
 * prepends an "All" affordance; "All" is a UI control, never a member of the derived set.
 *
 * ⛔ AN UNRESOLVABLE FOLDER ID IS A REAL STATE, NOT DEFENSIVE PADDING. The one seeded system
 * Expert binds a knowledge folder whose row migration 188 seeds into a SINGLE org, so any other
 * org's `listFolders()` returns nothing for it (RESEARCH §4b / P-6). `ResolvedFolder` is a
 * discriminated union so a caller can say "a knowledge folder you cannot see" rather than render
 * a blank or silently shorten the list — this repository's own rule, recorded at
 * `nav-items.ts:104-117` ("unknown is not denied") and in the `SourceFolderPicker` ledger row
 * ("a failed child load renders a REASON").
 */

import type { ExpertBundle, Folder } from "@/types"
import type { ExpertInstallSummary, ExpertScopePreview } from "@/lib/api/experts"
import type { LedgerColumn } from "@/components/experts/ScopeLedger"
import {
  classifyIngestionError,
  UNKNOWN_FAILURE_SENTENCE,
} from "@/components/library/ingestionErrorVocabulary"
import { getCuratedServiceEntry } from "@/components/settings/servicesCatalog"

/**
 * A knowledge folder id, resolved or honestly not. ⛔ There is no third shape and no `name?:` —
 * an optional name would let a caller render `undefined` and call it a label.
 */
export type ResolvedFolder =
  | { id: string; known: true; name: string }
  | { id: string; known: false }

export interface CatalogFilter {
  /** Free text over the sketch's stated surface: "name, topic, or capability". */
  query: string
  /** A derived category value, or {@link ALL_CATEGORIES}. */
  category: string
}

/**
 * The "show everything" sentinel. ⚠ It is a plain string, so an Expert whose author typed the
 * literal category `all` would be unfilterable by that pill. Left as-is deliberately: a sentinel
 * that cannot collide would have to be spelled in the page too, and the collision costs one
 * unreachable pill rather than a wrong list.
 */
export const ALL_CATEGORIES = "all"

/** The four fields the sketch's search box promises. `member_skills` are already NAMES (RESEARCH §4b). */
function searchableText(e: ExpertBundle): string {
  return [e.name, e.description, e.when_to_use ?? "", ...(e.member_skills ?? [])].join("\n")
}

export function filterExperts(experts: ExpertBundle[], opts: CatalogFilter): ExpertBundle[] {
  const q = opts.query.trim().toLowerCase()
  const wantsCategory = opts.category !== ALL_CATEGORIES
  return experts.filter((e) => {
    // An Expert with no category is never returned under a NAMED category — it was not
    // categorised, and putting it under someone else's heading would be an invented fact.
    if (wantsCategory && (e.category ?? "").trim() !== opts.category) return false
    if (!q) return true
    return searchableText(e).toLowerCase().includes(q)
  })
}

export function categoriesOf(experts: ExpertBundle[]): string[] {
  const seen = new Set<string>()
  for (const e of experts) {
    const c = (e.category ?? "").trim()
    if (c) seen.add(c)
  }
  return [...seen].sort((a, b) => a.localeCompare(b))
}

/**
 * Resolve folder ids to names, IN INPUT ORDER, with an honest entry for every id that cannot be
 * named. ⛔ Never drops, never returns a blank name.
 *
 * `folders` is typed by the two fields this function reads rather than by the whole `Folder`
 * shape — a `Folder[]` satisfies it, and nothing here can grow a dependency on a column it does
 * not use.
 */
export function resolveFolderNames(
  ids: string[],
  folders: Pick<Folder, "id" | "name">[],
): ResolvedFolder[] {
  const byId = new Map<string, string>()
  for (const f of folders) byId.set(f.id, f.name)
  return ids.map((id) => {
    const name = byId.get(id)
    // A folder that resolved to a blank name is treated as unnameable: rendering "" would be a
    // blank where a reason belongs, which is the same failure as dropping the id.
    if (typeof name === "string" && name.trim()) {
      return { id, known: true as const, name }
    }
    return { id, known: false as const }
  })
}

// ── Phase 266 plan 04 (PACK-18 / PACK-19 · D-266-01 / D-266-03) — THE INSTALL ──────────────
//
// ⭐ THE ONE HOME of install wording and of the state → control mapping. The modal, the card and
// the composer's invite dialog all ask `installView` / `inviteGate`; none of them branches on
// `install.state` itself, and none of them spells a literal below. `expertCatalog.test.ts` pins
// the literals.
//
// ⛔ The UI never decides readiness: `state` and `can_install` are server facts (T-266-26 — a
// forged click is still refused by `require_expert_manage`). ⛔ A failure cause is NEVER shown raw:
// a document cause goes through `classifyIngestionError`, the Library's own vocabulary, so a
// driver dict cannot reach a person (T-266-25).

export const INSTALL_COPY = {
  installAction: "Install",
  retryAction: "Retry install",
  failedHeadline: "Install failed — retry",
  installing:
    "Installing… copying this Expert's documents into your Library and indexing them. It can join a chat once every document is ready.",
  needsAdmin:
    "An org admin needs to install this Expert before it can answer from its documents.",
  failedNeedsAdmin: "Install failed. An org admin can retry it.",
  starting: "Starting the install…",
  inviteNotInstalled:
    "Install this Expert from the Experts catalog first — until then it has no documents to answer from.",
  inviteInstalling: "Still installing — it can join a chat once its documents are indexed.",
  inviteFailed: "Its install failed — an org admin can retry it from the Experts catalog.",
  // The CARD's short forms of the three status lines. The card face carries no paragraph
  // (sketch 261-262 §1), so it states the reason in a few words and keeps the full sentence as
  // the pill's title; the detail modal carries the full sentence.
  cardInstalling: "Installing…",
  cardNeedsAdmin: "An admin must install it",
  cardFailedNeedsAdmin: "Install failed — an admin can retry",
  /** The Library folder's provenance note, appended to NavRow's existing "Shared with org". */
  provenance: (expertName: string) => `from ${expertName}`,
} as const

// ── Phase 267 plan 03 (PACK-22 · D-267-05 / D-267-06 / D-267-27) — THE CONNECTION GATE ───────
//
// ⭐ Same discipline as INSTALL_COPY above: the card, the detail modal and the invite dialog all
// ask `connectionGate` / `installView` / `inviteGate`, none of them reads the overlay itself, and
// none of them spells a literal below. `expertCatalog.test.ts` pins every string.
//
// ⛔ The UI never decides readiness: `connection_state[].connected` and `can_connect` are server
// facts (267-01's ONE "is it connected" rule, and `org:manage` ∧ `live_connectors` — the exact
// permission `POST /connections` enforces). ⛔ `brings` and `missing` are two lists from ONE
// payload, never two computed strings that could disagree (D-267-27).

/** "A", "A and B", "A, B and C". */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ""
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}

/** The PACK-22 / SC#2 literal, visible at rest on the card, the modal and the invite row. */
const gateLine = (names: string[]): string => `Requires ${joinNames(names)} — not connected`
const memberAsk = (names: string[]): string => `Ask an org admin to connect ${joinNames(names)}.`

export const CONNECTION_COPY = {
  gateLine,
  memberAsk,
  modalMemberLine: (names: string[]): string => `${gateLine(names)}. ${memberAsk(names)}`,
  cardMemberPill: (names: string[]): string =>
    names.length === 1
      ? `An org admin must connect ${names[0]}`
      : `An org admin must connect ${names.length} services`,
  connectOne: (name: string): string => `Connect ${name} →`,
  connectMany: "Open Connections →",
  modalMissingPill: (name: string): string => `${name} · not connected`,
} as const

/** A catalog start in flight (SEED-309 R265-262-04): the card's and the modal's button label. */
export const START_COPY = {
  busy: "Starting…",
} as const

/** Ledger headings live beside the selector that builds the ledger's payload (UI-SPEC §7). */
export const LEDGER_COPY = {
  brings: "Brings",
  missing: "Missing",
  more: (k: number): string => `and ${k} more`,
  // Phase 267 plan 04 (PACK-25 / D-267-18 / D-267-19): the restricted-cost ledger's headings.
  willUse: "Will use",
  /** ⛔ `n` is the server's `excluded_count`, never a list length (the list is capped at five). */
  wontUse: (n: number): string => `Won't use · ${n}`,
  /** Always readable, whatever the scope (D-267-19) — listed last in the Will use column. */
  chatAttachments: "Chat attachments",
  /** 267-REVIEW WR-06 (D-267-35): the no-count heading over `All your documents`. */
  wontUseAll: "Won't use",
} as const

export interface ConnectionGate {
  missing: { slug: string; name: string }[]
  /** The CONNECTED names, in payload order — the same payload `missing` came from. */
  brings: string[]
  line: string
  /** Non-null only when the server says the caller may connect (`can_connect`). */
  action: { label: string } | null
  /** Non-null only when `action` is null — exactly one of the two is set. */
  ask: string | null
}

/**
 * A name a person can read: the server's name; when the server could only echo the slug (the org
 * has no row for it at all — 267-05 F-2), the curated service catalog's name; else the slug —
 * never a blank.
 */
function connectionName(c: { slug: string; name: string }): string {
  const name = c.name?.trim()
  if (name && name !== c.slug) return name
  return getCuratedServiceEntry(c.slug)?.name ?? c.slug
}

/**
 * `null` when nothing is missing (or the server said nothing); otherwise the whole statement.
 * ⛔ No arm is a disabled button: a member gets the `ask` sentence and no control (D-267-06).
 */
export function connectionGate(expert: ExpertBundle): ConnectionGate | null {
  const state = expert.connection_state ?? []
  const missing = state
    .filter((c) => !c.connected)
    .map((c) => ({ slug: c.slug, name: connectionName(c) }))
  if (missing.length === 0) return null
  const names = missing.map((m) => m.name)
  const brings = state.filter((c) => c.connected).map(connectionName)
  const line = CONNECTION_COPY.gateLine(names)
  if (expert.can_connect === true) {
    const label =
      names.length === 1 ? CONNECTION_COPY.connectOne(names[0]) : CONNECTION_COPY.connectMany
    return { missing, brings, line, action: { label }, ask: null }
  }
  return { missing, brings, line, action: null, ask: CONNECTION_COPY.memberAsk(names) }
}

/**
 * Every required connection as a pill: the server's name and whether it is missing. Without an
 * overlay (an older server) the stored slugs are listed and nothing is claimed about them.
 */
export function connectionPills(expert: ExpertBundle): { label: string; missing: boolean }[] {
  const state = expert.connection_state
  if (!state) {
    return (expert.required_connections ?? []).map((slug) => ({ label: slug, missing: false }))
  }
  return state.map((c) =>
    c.connected
      ? { label: connectionName(c), missing: false }
      : { label: CONNECTION_COPY.modalMissingPill(connectionName(c)), missing: true },
  )
}

/**
 * The Brings / Missing ledger (D-267-27), built from the SAME overlay payload as the gate.
 * `card` counts folders (the card's "names are the modal's job" rule); `dialog` omits them.
 * An empty column is omitted, so a ledger that brings nothing is the Missing column alone.
 */
export function connectionLedgerColumns(
  expert: ExpertBundle,
  surface: "card" | "dialog",
): LedgerColumn[] {
  const state = expert.connection_state ?? []
  const brings: LedgerColumn["items"] = []
  const folderCount = expert.knowledge_folder_ids?.length ?? 0
  if (surface === "card" && folderCount > 0) {
    brings.push({ label: `${folderCount} folder${folderCount === 1 ? "" : "s"}` })
  }
  for (const s of expert.member_skills ?? []) brings.push({ label: s })
  for (const c of state) if (c.connected) brings.push({ label: connectionName(c) })
  const missing = state.filter((c) => !c.connected).map((c) => ({ label: connectionName(c) }))
  const columns: LedgerColumn[] = []
  if (brings.length) columns.push({ tone: "yes", heading: LEDGER_COPY.brings, items: brings })
  if (missing.length) columns.push({ tone: "no", heading: LEDGER_COPY.missing, items: missing })
  return columns
}

/**
 * What an Expert's primary control is, given its org's install AND its required connections.
 * ⛔ No arm is a disabled button: a state that cannot act renders a `status` LINE with the reason
 * instead (D-262-02). The same rule covers connections: the `connect` arm carries either an
 * action (a caller who may connect) or the member's ask — never a Start control that would lead to
 * a run silently lacking a connection (D-267-06).
 *
 *   • `legacy`  — no `install` key (org-authored) or `install: null` (first-party, no corpus):
 *                 behave exactly as before 266.
 *   • `chat`    — installed and ready: the existing Start Chat control.
 *   • `connect` — install ready/legacy, but a required connection is missing. Gate order is
 *                 install → connection: an install that is not ready always wins.
 */
export type InstallView =
  | { kind: "legacy" }
  | { kind: "chat" }
  | { kind: "install"; action: string }
  | { kind: "retry"; action: string; headline: string; cause: string }
  | { kind: "status"; line: string; cause?: string }
  | { kind: "connect"; gate: ConnectionGate }

/** A failure cause, as ONE sentence a person can read. Never "null", never a driver dict. */
function installCause(install: NonNullable<ExpertBundle["install"]>): string {
  const raw = (install.cause ?? "").trim()
  if (!raw) return UNKNOWN_FAILURE_SENTENCE
  // The installer's own refusals are authored sentences; everything else (a document's
  // `error_message`, or an unlabelled cause) goes through the Library's classifier.
  if (install.cause_source === "install") return raw
  return classifyIngestionError(raw)
}

export function installView(expert: ExpertBundle): InstallView {
  const view = installOnlyView(expert)
  // Gate order install → connection: only an Expert that could otherwise start a chat is asked
  // about its connections, so a surface never shows two gate reasons at once.
  if (view.kind === "legacy" || view.kind === "chat") {
    const gate = connectionGate(expert)
    if (gate) return { kind: "connect", gate }
  }
  return view
}

function installOnlyView(expert: ExpertBundle): InstallView {
  const install = expert.install
  if (!install) return { kind: "legacy" }
  switch (install.state) {
    case "ready":
      return { kind: "chat" }
    case "installing":
      return { kind: "status", line: INSTALL_COPY.installing }
    case "failed":
      return install.can_install
        ? {
            kind: "retry",
            action: INSTALL_COPY.retryAction,
            headline: INSTALL_COPY.failedHeadline,
            cause: installCause(install),
          }
        : { kind: "status", line: INSTALL_COPY.failedNeedsAdmin, cause: installCause(install) }
    case "not_installed":
    default:
      return install.can_install
        ? { kind: "install", action: INSTALL_COPY.installAction }
        : { kind: "status", line: INSTALL_COPY.needsAdmin }
  }
}

/**
 * The card's short status words for a `status` view, or `null` when the card has a control to
 * draw instead. Same decision as `installView` — this only picks the shorter wording.
 */
export function installCardLine(expert: ExpertBundle): string | null {
  if (installView(expert).kind !== "status") return null
  const state = expert.install?.state
  if (state === "installing") return INSTALL_COPY.cardInstalling
  if (state === "failed") return INSTALL_COPY.cardFailedNeedsAdmin
  return INSTALL_COPY.cardNeedsAdmin
}

/**
 * The Library's provenance map (D-266-13): folder id → "from <Expert name>", one entry per
 * install that has a folder. Decided here so the page reads no install field itself.
 */
export function provenanceByFolder(installs: ExpertInstallSummary[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const i of installs) {
    if (i.folder_id) out[i.folder_id] = INSTALL_COPY.provenance(i.expert_name)
  }
  return out
}

/**
 * The composer's invite gate (D-266-01): `null` means invite as before; a string is the reason
 * the Expert cannot join a chat yet. ⛔ A first-party Expert whose knowledge is not installed
 * never starts a run against an empty scope.
 *
 * Phase 267 (D-267-06): gate order install → connection. With the install ready (or no install at
 * all) a missing required connection returns its gate line — the first blocking fact wins.
 */
export function inviteGate(expert: ExpertBundle): string | null {
  const install = expert.install
  if (!install || install.state === "ready") return connectionGate(expert)?.line ?? null
  if (install.state === "installing") return INSTALL_COPY.inviteInstalling
  if (install.state === "failed") return INSTALL_COPY.inviteFailed
  return INSTALL_COPY.inviteNotInstalled
}

// ── Phase 267 plan 04 (PACK-22 / PACK-24 / PACK-25 · D-267-06 / D-267-13 / D-267-16 / D-267-18) ──
//    THE INVITE DIALOG'S WORDS AND ITS ROW GATE
//
// ⭐ Same discipline as the two blocks above: `InviteExpertDialog` spells none of these, and decides
// no gate itself — it asks `inviteBlock` (install → connection, first blocking fact wins) and
// `previewLedgerColumns` (one preview response → both columns).

export const PREVIEW_COPY = {
  contextPrefix: "This chat · ",
  contextFolder: (name: string): string => `/${name}`,
  contextAll: "All your documents",
  checking: (expert: string): string => `Checking what ${expert} will read…`,
  checkFailed: (expert: string): string => `Couldn't check which documents ${expert} will skip.`,
  tryAgain: "Try again",
  noFolders: (expert: string): string =>
    `${expert} has no knowledge folders yet, so it cannot answer from documents.`,
  activeHere: (active: string): string => `${active} is active here.`,
  replace: (active: string): string => `Replace ${active}`,
  newChatWith: (expert: string): string => `New chat with ${expert} →`,
  summarising: "Summarising this chat…",
  /** ⛔ Always ends "Nothing was created." — the D-267-16 guarantee made visible. */
  refusal: (expert: string, reason: string): string =>
    `Couldn't start a new chat with ${expert}. ${reason} Nothing was created.`,
  summaryFailedReason: "This chat could not be summarised.",
  networkReason: "The server could not be reached.",
  emptyHeading: "No Experts available yet",
  emptyBody: "An org admin can add one from the Experts catalog.",
  listLoading: "Loading Experts…",
  listError: (reason: string): string => `Couldn't load Experts. ${reason}`,
  /** 267-REVIEW WR-04: an Expert change is refused while this chat's answer streams (server: 409). */
  waitForAnswer: "Wait for this answer to finish before changing the Expert.",
} as const

/** Why an invite row cannot invite, in gate order — or `null` when nothing blocks it. */
export type InviteBlock =
  | { kind: "install"; line: string }
  | { kind: "connection"; gate: ConnectionGate }

export function inviteBlock(expert: ExpertBundle): InviteBlock | null {
  const install = expert.install
  if (install && install.state !== "ready") {
    const line = inviteGate(expert)
    if (line) return { kind: "install", line }
  }
  const gate = connectionGate(expert)
  return gate ? { kind: "connection", gate } : null
}

/**
 * `Will use` = the Expert's folders (server-named) then `Chat attachments`; `Won't use · N` only
 * when the server excluded something. ⛔ ONE response feeds both columns, and the heading's N is
 * `excluded_count` — the names list is capped, so its length is never the count.
 */
export function previewLedgerColumns(preview: ExpertScopePreview): LedgerColumn[] {
  const will: LedgerColumn["items"] = (preview.expert_folders ?? []).map((f) =>
    typeof f.name === "string" && f.name.trim()
      ? { label: f.name }
      : { label: "", unnameable: true },
  )
  // 267-REVIEW WR-08: pinned, so an Expert with five or more folders never folds D-267-19's promise
  // into "and k more" — it stays last, and always visible.
  will.push({ label: LEDGER_COPY.chatAttachments, pinned: true })
  const columns: LedgerColumn[] = [{ tone: "yes", heading: LEDGER_COPY.willUse, items: will }]
  const count = preview.excluded_count ?? 0
  if (count > 0) {
    // The ledger shows five and counts the rest itself; `more` carries what the server counted
    // but did not name.
    const names = preview.excluded_names ?? []
    columns.push({
      tone: "no",
      heading: LEDGER_COPY.wontUse(count),
      items: names.map((label) => ({ label })),
      more: Math.max(0, count - names.length),
    })
  }
  return columns
}

/**
 * 267-REVIEW WR-06 (D-267-35) — a BIASED Expert on a chat with NO folder reads only its own folders
 * (kept, and STATED — never silent). `Will use` = the same column `previewLedgerColumns` builds;
 * `Won't use` = `All your documents`. `null` when the preview shows no narrowing: a restricted
 * Expert (its own ledger), a chat with a folder (thread ∪ Expert), or an Expert with no folders
 * (an empty composition reaches retrieval as no filter). ⛔ Built from the ONE preview payload.
 */
export function narrowingLedgerColumns(preview: ExpertScopePreview): LedgerColumn[] | null {
  if (preview.mode !== "biased" || preview.thread_folder) return null
  if ((preview.expert_folders ?? []).length === 0) return null
  const [will] = previewLedgerColumns({ ...preview, excluded_count: 0, excluded_names: [] })
  return [
    will,
    { tone: "no", heading: LEDGER_COPY.wontUseAll, items: [{ label: PREVIEW_COPY.contextAll }] },
  ]
}

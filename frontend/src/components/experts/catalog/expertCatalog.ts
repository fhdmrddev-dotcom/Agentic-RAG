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
import {
  classifyIngestionError,
  UNKNOWN_FAILURE_SENTENCE,
} from "@/components/library/ingestionErrorVocabulary"

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

/**
 * What an Expert's primary control is, given its org's install. ⛔ No arm is a disabled button:
 * a state that cannot act renders a `status` LINE with the reason instead (D-262-02).
 *
 *   • `legacy` — no `install` key (org-authored) or `install: null` (first-party, no corpus):
 *                behave exactly as before 266.
 *   • `chat`   — installed and ready: the existing Start Chat control.
 */
export type InstallView =
  | { kind: "legacy" }
  | { kind: "chat" }
  | { kind: "install"; action: string }
  | { kind: "retry"; action: string; headline: string; cause: string }
  | { kind: "status"; line: string; cause?: string }

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
 * The composer's invite gate (D-266-01): `null` means invite as before; a string is the reason
 * the Expert cannot join a chat yet. ⛔ A first-party Expert whose knowledge is not installed
 * never starts a run against an empty scope.
 */
export function inviteGate(expert: ExpertBundle): string | null {
  const install = expert.install
  if (!install || install.state === "ready") return null
  if (install.state === "installing") return INSTALL_COPY.inviteInstalling
  if (install.state === "failed") return INSTALL_COPY.inviteFailed
  return INSTALL_COPY.inviteNotInstalled
}

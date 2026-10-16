/**
 * Phase 275 plan 04 (S3 / D-05 / D-35) — place a new legal hold, or add coverage to one.
 *
 * Placing or extending a hold is PROTECTIVE (066: reversible, no victim), so there is no confirm:
 * the primary acts directly, the server writes the receipt, and the band marker flashes.
 *
 * Covers = folders (an indented checkbox list built from the folders the admin can see) and
 * documents (a typeahead by name over the documents the admin can see, picked as chips — the 117
 * picker shape). The live line is the SERVER's count (`POST /retention/holds/count`); a count that
 * cannot be computed reads `Couldn't count the documents yet.` — never 0.
 *
 * A failure keeps the dialog open with every field as typed and says what did NOT happen.
 *
 * Phase 284-04 (D-15 / R-05 / UI-SPEC S13) — the documents typeahead searches on the SERVER. It
 * used to read the whole library (the unpaged list client) and then run a SECOND whole-library loop of
 * `document-states` calls to drop other orgs' documents; at 50,000 documents the first read was
 * silently cut at 1,000. Now each debounced query is ONE `POST /document-search` (latest, archived
 * included, 20 rows; an empty query is the 20 most recent), and the active-org check runs over the
 * ≤ 20 ids that came back. A failure SAYS so — the old catch silently offered nothing.
 */
import { useEffect, useMemo, useRef, useState } from "react"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useDocumentFind } from "@/hooks/useDocumentFind"
import { cn } from "@/lib/utils"
import { ApiRefusal } from "@/lib/api/refusal"
import {
  addHoldCoverage,
  countHoldCoverage,
  createHold,
  getDocumentStates,
  type LegalHold,
} from "@/lib/api/retention"
import { useFolders } from "@/hooks/useFolders"
import type { Document, Folder } from "@/types"
import { AMBER_TEXT_CLASS } from "./RetentionChip"
import { RETENTION_COPY, fillCopy } from "./retentionCopy"

const C = RETENTION_COPY

/**
 * 275-REVIEW F-WR-02 — keep only the documents in the ACTIVE org.
 *
 * Document search (like `GET /documents`) is scoped by visibility, not by org, so an admin in two
 * orgs gets the other org's documents too — and every one of them would be refused (422) by the
 * hold write. The document rows carry no `org_id`; `document-states` reads the requested ids through
 * RLS **filtered to the active org** (`X-Org-Id`), so the ids it answers for are exactly the ones a
 * hold may cover. 284-04: ONE call over at most one search page (≤ 20 ids), never the library.
 */
async function inActiveOrg<T extends Document>(docs: readonly T[]): Promise<T[]> {
  if (docs.length === 0) return []
  const answer = await getDocumentStates({ document_ids: docs.map((d) => d.id), folder_ids: [] })
  const inOrg = new Set((answer.documents ?? []).map((d) => d.document_id))
  return docs.filter((d) => inOrg.has(d.id))
}

interface LegalHoldDialogProps {
  open: boolean
  /** Absent → a new hold. Present → add coverage to this hold. */
  hold?: LegalHold | null
  onClose: () => void
  /** The write landed: re-read the list and pulse the band. */
  onDone: () => void
  /** 275-REVIEW F-WR-02: the server refused because the list is stale (409) — re-read, record nothing. */
  onStale?: () => void
}

interface FolderRow {
  folder: Folder
  depth: number
}

/** Depth-first, name-ordered, cycle-safe flattening of the visible folder tree. */
function flattenFolders(folders: readonly Folder[]): FolderRow[] {
  const ids = new Set(folders.map((f) => f.id))
  const children = new Map<string | null, Folder[]>()
  for (const f of folders) {
    const parent = f.parent_id && ids.has(f.parent_id) ? f.parent_id : null
    children.set(parent, [...(children.get(parent) ?? []), f])
  }
  const out: FolderRow[] = []
  const seen = new Set<string>()
  const walk = (parent: string | null, depth: number) => {
    const kids = [...(children.get(parent) ?? [])].sort((a, b) => a.name.localeCompare(b.name))
    for (const f of kids) {
      if (seen.has(f.id)) continue
      seen.add(f.id)
      out.push({ folder: f, depth })
      walk(f.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
}

export function LegalHoldDialog({ open, hold, onClose, onDone, onStale }: LegalHoldDialogProps) {
  const isAdd = Boolean(hold)
  const { folders } = useFolders()
  const [name, setName] = useState("")
  const [reason, setReason] = useState("")
  const [folderIds, setFolderIds] = useState<string[]>([])
  const [picked, setPicked] = useState<Document[]>([])
  const [query, setQuery] = useState("")
  // 284-04: the last search answer that passed the active-org check, and whether that check failed.
  const [orgRows, setOrgRows] = useState<Document[]>([])
  const [orgCheckFailed, setOrgCheckFailed] = useState(false)
  const [count, setCount] = useState<number | null | "failed">(null)
  const [errors, setErrors] = useState<{ name?: string; reason?: string }>({})
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  // A 4xx refusal: the server's own sentence (which pick it refused, or that the hold is released).
  const [refused, setRefused] = useState<string | null>(null)
  const alive = useRef(true)
  // Each open is a generation: a read started for an earlier open never lands in this one.
  const openGen = useRef(0)
  const openRef = useRef(open)
  useEffect(() => {
    openRef.current = open
  }, [open])

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  // A fresh dialog each time it opens.
  useEffect(() => {
    if (!open) return
    setName("")
    setReason("")
    setFolderIds([])
    setPicked([])
    setQuery("")
    setCount(null)
    setErrors({})
    setFailed(false)
    setRefused(null)
    setOrgRows([])
    setOrgCheckFailed(false)
    ++openGen.current
  }, [open])

  // 284-04 (D-15 / R-05): ONE server search per debounced query — 20 rows, latest, archived
  // included; an empty query is the 20 most recent. `request: null` while closed costs nothing.
  const typed = query.trim()
  const find = useDocumentFind({
    request: open
      ? {
          filter_expr: { op: "and", conditions: [] },
          name: typed === "" ? null : typed,
          version: "latest",
          sort: "added_desc",
          offset: 0,
          limit: 20, // one page — and so the most ids the org check below ever asks about
          include_archived: true,
        }
      : null,
    debounceMs: 250,
  })

  // The active-org check over the answer (≤ 20 ids). Two guards: the dialog's `openGen` (a check
  // started for an earlier open never lands in this one) and `orgReq` (the hook already drops a
  // stale SEARCH answer; this drops a stale CHECK of an earlier answer).
  const orgReq = useRef(0)
  useEffect(() => {
    const my = ++orgReq.current
    const gen = openGen.current
    if (!open) return
    inActiveOrg(find.rows)
      .then((docs) => {
        if (!alive.current || gen !== openGen.current || my !== orgReq.current) return
        setOrgRows(docs)
        setOrgCheckFailed(false)
      })
      .catch(() => {
        if (!alive.current || gen !== openGen.current || my !== orgReq.current) return
        // never a guess: nothing is offered, and the line below says the search failed
        setOrgRows([])
        setOrgCheckFailed(true)
      })
  }, [open, find.rows])

  const searchFailed = find.error !== null || orgCheckFailed
  const retrySearch = () => {
    setOrgCheckFailed(false)
    find.retry()
  }

  const docIds = useMemo(() => picked.map((d) => d.id), [picked])
  const hasPick = folderIds.length > 0 || docIds.length > 0

  // The live, server-derived count of what the picks would hold today.
  useEffect(() => {
    // 275-REVIEW IN-05: a recount clears the last number first — the line never shows the
    // PREVIOUS selection's count while this one is being counted.
    setCount(null)
    if (!open || !hasPick) return
    let current = true
    countHoldCoverage({ document_ids: docIds, folder_ids: folderIds })
      .then((res) => {
        if (current && alive.current) setCount(res.count)
      })
      .catch(() => {
        if (current && alive.current) setCount("failed")
      })
    return () => {
      current = false
    }
  }, [open, hasPick, docIds, folderIds])

  const folderRows = useMemo(() => flattenFolders(folders ?? []), [folders])
  // The server's answer IS the name match (no client re-filter, RESEARCH Pitfall 10); only the
  // documents already picked are left out.
  const suggestions = useMemo(() => {
    const taken = new Set(docIds)
    return orgRows.filter((d) => !taken.has(d.id))
  }, [orgRows, docIds])
  // No number: the org check runs AFTER the server's count, so a number would include other orgs.
  const moreMatch = find.total !== null && find.total > find.rows.length

  const toggleFolder = (id: string) =>
    setFolderIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  async function handleSubmit() {
    if (!hasPick || busy) return
    if (!isAdd) {
      const next = {
        name: name.trim() ? undefined : C.contract.nameMatter,
        reason: reason.trim() ? undefined : C.contract.sayWhy,
      }
      setErrors(next)
      if (next.name || next.reason) return
    }
    setBusy(true)
    setFailed(false)
    setRefused(null)
    const gen = openGen.current
    try {
      if (hold) {
        await addHoldCoverage(hold.id, { document_ids: docIds, folder_ids: folderIds })
      } else {
        await createHold({ name: name.trim(), reason: reason.trim(), document_ids: docIds, folder_ids: folderIds })
      }
      if (!alive.current) return
      onDone() // the write landed: re-read and pulse, whichever dialog is open now
      // 275-REVIEW IN-05: only close the dialog THIS submit came from — never one reopened since.
      if (gen === openGen.current && openRef.current) onClose()
    } catch (err) {
      if (!alive.current || gen !== openGen.current) return
      // 275-REVIEW F-WR-02: a 4xx is the server's sentence (e.g. a pick that is not in this org,
      // or a hold released meanwhile) — render it. The contract copy is for a silent failure.
      if (err instanceof ApiRefusal && err.status >= 400 && err.status < 500) {
        setRefused(err.message)
        if (err.status === 409) onStale?.()
      } else {
        setFailed(true)
      }
    } finally {
      if (alive.current && gen === openGen.current) setBusy(false)
    }
  }

  const title = hold ? fillCopy(C.specTemplates.addTitle, { matter: hold.name }) : C.contract.newHoldTitle
  const primary = isAdd ? C.contract.addToHold : C.contract.placeHold

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-headline text-base">{title}</DialogTitle>
          <DialogDescription className="text-sm">{C.ported.holdsSub}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {!isAdd && (
            <>
              <div className="grid gap-1">
                <Label htmlFor="hold-matter" className="text-sm font-normal">
                  {C.contract.matterName}
                </Label>
                <Input id="hold-matter" value={name} onChange={(e) => setName(e.target.value)} />
                {errors.name && <p className={`text-xs ${AMBER_TEXT_CLASS}`}>{errors.name}</p>}
              </div>
              <div className="grid gap-1">
                <Label htmlFor="hold-reason" className="text-sm font-normal">
                  {C.contract.reason}
                </Label>
                <Textarea id="hold-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
                {errors.reason && <p className={`text-xs ${AMBER_TEXT_CLASS}`}>{errors.reason}</p>}
              </div>
            </>
          )}

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm">{C.contract.covers}</legend>
            <p className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">{C.contract.folders}</p>
            <ul className="max-h-48 overflow-y-auto rounded-md border border-border p-2" aria-label={C.contract.folders}>
              {folderRows.map(({ folder, depth }) => (
                <li key={folder.id} style={{ paddingLeft: depth * 16 }}>
                  <label className="flex min-h-8 cursor-pointer items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      className="accent-[hsl(var(--primary))]"
                      checked={folderIds.includes(folder.id)}
                      onChange={() => toggleFolder(folder.id)}
                    />
                    {folder.name}
                  </label>
                </li>
              ))}
            </ul>

            <Label htmlFor="hold-docs" className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              {C.contract.documents}
            </Label>
            <Input id="hold-docs" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
            {suggestions.length > 0 && (
              <ul
                role="listbox"
                aria-label={C.contract.documents}
                aria-busy={find.loading ? true : undefined}
                className={cn(
                  "max-h-48 overflow-y-auto rounded-md border border-border",
                  find.loading && "transition-opacity opacity-60",
                )}
              >
                {suggestions.map((d) => (
                  <li key={d.id} role="option" aria-selected={false}>
                    <button
                      type="button"
                      className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted/40"
                      onClick={() => {
                        setPicked((prev) => [...prev, d])
                        setQuery("")
                      }}
                    >
                      {d.filename}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {/* 284-04 (S13): what the search is doing — after the list, never inside it. */}
            {searchFailed ? (
              <p role="alert" className={`text-xs ${AMBER_TEXT_CLASS}`}>
                Couldn’t search documents.{" "}
                <button type="button" onClick={retrySearch} className="text-xs text-primary hover:underline">
                  Try again
                </button>
              </p>
            ) : find.loading ? (
              <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
                Searching…
              </p>
            ) : moreMatch ? (
              <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
                More documents match. Type more of the name to narrow.
              </p>
            ) : null}
            {picked.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {picked.map((d) => (
                  <span key={d.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs">
                    {d.filename}
                    <button
                      type="button"
                      aria-label={fillCopy(C.specTemplates.removeDocAria, { doc: d.filename })}
                      className="rounded-sm p-1"
                      onClick={() => setPicked((prev) => prev.filter((x) => x.id !== d.id))}
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </fieldset>

          <p className="text-sm text-muted-foreground" data-testid="hold-count-line" aria-live="polite">
            {!hasPick
              ? C.contract.pickOne
              : count === "failed"
                ? C.contract.countFailed
                : typeof count === "number"
                  ? fillCopy(C.specTemplates.holdCountLine, { N: count })
                  : ""}
          </p>

          {(failed || refused !== null) && (
            <p role="alert" className={`text-sm ${AMBER_TEXT_CLASS}`}>
              {refused ?? (isAdd ? C.contract.addFailed : C.contract.placeFailed)}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" className="font-semibold" onClick={onClose}>
            {C.contract.close}
          </Button>
          <Button
            type="button"
            className="font-semibold"
            onClick={handleSubmit}
            aria-disabled={!hasPick || busy}
            disabled={busy}
          >
            {primary}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

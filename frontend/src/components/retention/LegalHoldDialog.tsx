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
import { listDocuments } from "@/lib/api"
import { addHoldCoverage, countHoldCoverage, createHold, type LegalHold } from "@/lib/api/retention"
import { useFolders } from "@/hooks/useFolders"
import type { Document, Folder } from "@/types"
import { AMBER_TEXT_CLASS } from "./RetentionChip"
import { RETENTION_COPY, fillCopy } from "./retentionCopy"

const C = RETENTION_COPY
const MAX_SUGGESTIONS = 8

interface LegalHoldDialogProps {
  open: boolean
  /** Absent → a new hold. Present → add coverage to this hold. */
  hold?: LegalHold | null
  onClose: () => void
  /** The write landed: re-read the list and pulse the band. */
  onDone: () => void
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

export function LegalHoldDialog({ open, hold, onClose, onDone }: LegalHoldDialogProps) {
  const isAdd = Boolean(hold)
  const { folders } = useFolders()
  const [name, setName] = useState("")
  const [reason, setReason] = useState("")
  const [folderIds, setFolderIds] = useState<string[]>([])
  const [picked, setPicked] = useState<Document[]>([])
  const [query, setQuery] = useState("")
  const [allDocs, setAllDocs] = useState<Document[]>([])
  const [count, setCount] = useState<number | null | "failed">(null)
  const [errors, setErrors] = useState<{ name?: string; reason?: string }>({})
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const alive = useRef(true)

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
    listDocuments()
      .then((docs) => {
        if (alive.current) setAllDocs(docs)
      })
      .catch(() => {
        /* the typeahead offers nothing rather than a guess */
      })
  }, [open])

  const docIds = useMemo(() => picked.map((d) => d.id), [picked])
  const hasPick = folderIds.length > 0 || docIds.length > 0

  // The live, server-derived count of what the picks would hold today.
  useEffect(() => {
    if (!open || !hasPick) {
      setCount(null)
      return
    }
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
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const taken = new Set(docIds)
    return allDocs
      .filter((d) => !taken.has(d.id) && d.filename.toLowerCase().includes(q))
      .slice(0, MAX_SUGGESTIONS)
  }, [query, allDocs, docIds])

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
    try {
      if (hold) {
        await addHoldCoverage(hold.id, { document_ids: docIds, folder_ids: folderIds })
      } else {
        await createHold({ name: name.trim(), reason: reason.trim(), document_ids: docIds, folder_ids: folderIds })
      }
      if (!alive.current) return
      onDone()
      onClose()
    } catch {
      if (alive.current) setFailed(true)
    } finally {
      if (alive.current) setBusy(false)
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
              <ul role="listbox" aria-label={C.contract.documents} className="rounded-md border border-border">
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

          {failed && (
            <p role="alert" className={`text-sm ${AMBER_TEXT_CLASS}`}>
              {isAdd ? C.contract.addFailed : C.contract.placeFailed}
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

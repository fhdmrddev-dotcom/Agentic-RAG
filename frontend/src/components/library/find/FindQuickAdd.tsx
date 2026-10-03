/**
 * Phase 271-04 (FIND-01 / FIND-03 / D-04 / D-06 / D-07 / P-10) — Find's quick-add chip row,
 * rendered INSIDE the one shipped FilterBar through its `quickAdd` slot (D-114-1: one builder).
 *
 * ⛔ EVERY CHIP IS ONE CONDITION. A ＋ chip opens one editor (`StructurePopovers.tsx`); Apply
 * emits one value and this row turns it into ONE reducer action, or ONE metadata condition on
 * the shared filter (P-10: Document type and "Date in the document"). A set chip's words say
 * exactly what is sent — a chip that looks set while sending something else is the failure
 * ROADMAP names (T-271-15).
 *
 * ⛔ THE VERSION CHIP IS ALWAYS VISIBLE (D-06). "Version: Latest" hides older uploads by
 * default, and a filter that hides rows must show that it does. It takes no ✕ at the default;
 * any other value gets a ✕ that returns it to Latest.
 *
 * Layout: the slots keep a fixed order (Document type, Added by, Date, Folder, Relationship,
 * Version) so controls never move under the person's pointer; a single-value dimension that is
 * set shows its chip IN PLACE of its ＋. One editor is open at a time, anchored below the bar
 * (the ConditionPopover anchor) and capped at the viewport width so it never opens off-screen.
 * Esc and Apply both return focus to the chip that opened it.
 */
import { useRef, useState, type ReactElement } from "react"
import type { Document, Folder, ViewCondition, ViewFilter } from "@/types"
import { FilterChip } from "@/components/ingestion/FilterBar"
import { folderPathOf } from "@/components/chat/scopeCopy"
import { RELATIONSHIP_FILTER_VERBS } from "@/components/relationships/relationshipLabels"
import type {
  FindAction,
  FindDateCondition,
  FindFolderCondition,
  FindRelationshipCondition,
  FindState,
} from "@/pages/findState"
import {
  AddedByEditor,
  DateEditor,
  DocumentTypeEditor,
  FolderEditor,
  RelationshipEditor,
  VERSION_OPTIONS,
  VersionEditor,
  WHICH_DATE_OPTIONS,
} from "./StructurePopovers"

export interface FindQuickAddProps {
  find: FindState
  dispatch: (action: FindAction) => void
  filter: ViewFilter
  onFilterChange: (filter: ViewFilter) => void
  documents: readonly Document[]
  folders: readonly Folder[]
}

/** Which editor is open. A date chip being edited carries its `which`. */
type OpenEditor =
  | { kind: "document_type" }
  | { kind: "added_by" }
  | { kind: "date"; which: FindDateCondition["which"] | null }
  | { kind: "folder" }
  | { kind: "relationship" }
  | { kind: "version" }

// ── THE CHIP WORDS (each pinned by FindQuickAdd.test.tsx) ─────────────────────────────

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** "2019-01-01" → "1 Jan 2019". Read as a CALENDAR date (no time zone can shift the day);
 *  anything that is not a plain date is shown as given. */
function formatDay(value: string | number | null): string {
  if (value === null) return ""
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value))
  if (!m) return String(value)
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}`
}

function whichLabel(which: FindDateCondition["which"]): string {
  return WHICH_DATE_OPTIONS.find((o) => o.value === which)?.label ?? which
}

export function dateSummary(d: FindDateCondition): string {
  const who = whichLabel(d.which)
  switch (d.op) {
    case "between":
      return `${who} between ${formatDay(d.value)} and ${formatDay(d.value2)}`
    case "before":
      return `${who} before ${formatDay(d.value)}`
    case "after":
      return `${who} after ${formatDay(d.value)}`
    case "within_next":
      return `${who} within next ${d.value} ${d.unit ?? "days"}`
    case "older_than":
      return `${who} older than ${d.value} ${d.unit ?? "days"}`
  }
}

export function folderSummary(f: FindFolderCondition, folders: readonly Folder[]): string {
  if (f.folderId === null) return "Folder: Not in a folder"
  const path = folderPathOf(f.folderId, [...folders]) ?? "a folder you cannot see"
  return `Folder /${path} ${f.includeSubfolders ? "+ subfolders" : "only"}`
}

export function relationshipSummary(r: FindRelationshipCondition): string {
  const label = RELATIONSHIP_FILTER_VERBS.find((v) => v.key === r.verb)?.label ?? r.verb
  return `Relationship ${label.charAt(0).toLowerCase()}${label.slice(1)} ${r.documentName}`
}

function versionSummary(version: FindState["version"]): string {
  if (version === "latest") return "Version: Latest"
  return `Version: ${VERSION_OPTIONS.find((o) => o.value === version)?.label ?? version}`
}

/** Replace the filter's first condition on `field`, or append one (one condition per field). */
function withCondition(filter: ViewFilter, condition: ViewCondition): ViewFilter {
  const i = filter.conditions.findIndex((c) => c.field === condition.field)
  const conditions =
    i === -1
      ? [...filter.conditions, condition]
      : filter.conditions.map((c, j) => (j === i ? condition : c))
  return { op: "and", conditions }
}

const PLUS_CHIP =
  "inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-muted-foreground hover:text-foreground hover:border-foreground/30"

// ── THE ROW ───────────────────────────────────────────────────────────────────────────

export function FindQuickAdd({
  find,
  dispatch,
  filter,
  onFilterChange,
  documents,
  folders,
}: FindQuickAddProps) {
  const [open, setOpen] = useState<OpenEditor | null>(null)
  // The chip each editor was opened from, so closing it returns focus there.
  const openerRef = useRef<HTMLButtonElement | null>(null)

  function openFrom(editor: OpenEditor, el: HTMLButtonElement) {
    openerRef.current = el
    setOpen(editor)
  }

  function close() {
    setOpen(null)
    const el = openerRef.current
    // After the editor unmounts, the opener is still in the tree unless the action it took
    // replaced it (a ＋ that became a chip); focus it when it is.
    queueMicrotask(() => {
      if (el && el.isConnected) el.focus()
    })
  }

  // Synchronous focus for Esc, so the person's focus never falls to <body> in between.
  function cancel() {
    setOpen(null)
    openerRef.current?.focus()
  }

  const isOpen = (kind: OpenEditor["kind"], which?: FindDateCondition["which"] | null) =>
    open?.kind === kind && (kind !== "date" || (open as { which: unknown }).which === (which ?? null))

  const plus = (label: string, editor: OpenEditor, key: string) => (
    <button
      key={key}
      type="button"
      className={PLUS_CHIP}
      aria-haspopup="dialog"
      aria-expanded={isOpen(editor.kind, editor.kind === "date" ? editor.which : undefined)}
      onClick={(e) => openFrom(editor, e.currentTarget)}
    >
      {`＋ ${label}`}
    </button>
  )

  const docTypeCondition = filter.conditions.find((c) => c.field === "document_type")

  let editor: ReactElement | null = null
  if (open?.kind === "document_type") {
    editor = (
      <DocumentTypeEditor
        initial={docTypeCondition}
        documents={documents}
        onCancel={cancel}
        onApply={(c) => {
          onFilterChange(withCondition(filter, c))
          close()
        }}
      />
    )
  } else if (open?.kind === "added_by") {
    editor = (
      <AddedByEditor
        initial={find.addedBy}
        documents={documents}
        onCancel={cancel}
        onApply={(addedBy) => {
          dispatch({ type: "SET_ADDED_BY", addedBy })
          close()
        }}
      />
    )
  } else if (open?.kind === "date") {
    editor = (
      <DateEditor
        initial={open.which ? find.dates.find((d) => d.which === open.which) : null}
        onCancel={cancel}
        onApply={(date) => {
          // Editing a chip and switching WHICH date it is replaces it, not adds a second.
          if (open.which && open.which !== date.which) {
            dispatch({ type: "REMOVE_DATE", which: open.which })
          }
          dispatch({ type: "SET_DATE", date })
          close()
        }}
        onFilterCondition={(c) => {
          if (open.which) dispatch({ type: "REMOVE_DATE", which: open.which })
          onFilterChange(withCondition(filter, c))
          close()
        }}
      />
    )
  } else if (open?.kind === "folder") {
    editor = (
      <FolderEditor
        initial={find.folder}
        folders={folders}
        onCancel={cancel}
        onApply={(folder) => {
          dispatch({ type: "SET_FOLDER", folder })
          close()
        }}
      />
    )
  } else if (open?.kind === "relationship") {
    editor = (
      <RelationshipEditor
        initial={find.relationship}
        documents={documents}
        onCancel={cancel}
        onApply={(relationship) => {
          dispatch({ type: "SET_RELATIONSHIP", relationship })
          close()
        }}
      />
    )
  } else if (open?.kind === "version") {
    editor = (
      <VersionEditor
        initial={find.version}
        onCancel={cancel}
        onApply={(version) => {
          dispatch({ type: "SET_VERSION", version })
          close()
        }}
      />
    )
  }

  return (
    <>
      {plus("Document type", { kind: "document_type" }, "document_type")}

      {find.addedBy ? (
        <SetChip
          summary={`Added by ${find.addedBy.label}`}
          removeLabel="Remove Added by condition"
          expanded={isOpen("added_by")}
          onOpen={(el) => openFrom({ kind: "added_by" }, el)}
          onRemove={() => dispatch({ type: "SET_ADDED_BY", addedBy: null })}
        />
      ) : (
        plus("Added by", { kind: "added_by" }, "added_by")
      )}

      {find.dates.map((d) => (
        <SetChip
          key={d.which}
          summary={dateSummary(d)}
          removeLabel={`Remove Date condition (${whichLabel(d.which)})`}
          expanded={isOpen("date", d.which)}
          onOpen={(el) => openFrom({ kind: "date", which: d.which }, el)}
          onRemove={() => dispatch({ type: "REMOVE_DATE", which: d.which })}
        />
      ))}
      {plus("Date", { kind: "date", which: null }, "date")}

      {find.folder ? (
        <SetChip
          summary={folderSummary(find.folder, folders)}
          removeLabel="Remove Folder condition"
          expanded={isOpen("folder")}
          onOpen={(el) => openFrom({ kind: "folder" }, el)}
          onRemove={() => dispatch({ type: "SET_FOLDER", folder: null })}
        />
      ) : (
        plus("Folder", { kind: "folder" }, "folder")
      )}

      {find.relationship ? (
        <SetChip
          summary={relationshipSummary(find.relationship)}
          removeLabel="Remove Relationship condition"
          expanded={isOpen("relationship")}
          onOpen={(el) => openFrom({ kind: "relationship" }, el)}
          onRemove={() => dispatch({ type: "SET_RELATIONSHIP", relationship: null })}
        />
      ) : (
        plus("Relationship", { kind: "relationship" }, "relationship")
      )}

      {/* D-06: always visible; a ✕ only away from the default. */}
      <SetChip
        summary={versionSummary(find.version)}
        removeLabel="Remove Version condition"
        expanded={isOpen("version")}
        onOpen={(el) => openFrom({ kind: "version" }, el)}
        onRemove={
          find.version === "latest"
            ? undefined
            : () => dispatch({ type: "SET_VERSION", version: "latest" })
        }
      />

      {editor && (
        <div className="absolute left-0 top-full z-20 mt-2 max-w-[calc(100vw-2rem)]">{editor}</div>
      )}
    </>
  )
}

/** A set structure chip: the shipped FilterChip, plus a ref so its editor can return focus. */
function SetChip({
  summary,
  removeLabel,
  expanded,
  onOpen,
  onRemove,
}: {
  summary: string
  removeLabel: string
  expanded: boolean
  onOpen: (el: HTMLButtonElement) => void
  onRemove?: () => void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  return (
    <FilterChip
      summary={summary}
      removeLabel={removeLabel}
      expanded={expanded}
      editRef={ref}
      onEdit={() => {
        if (ref.current) onOpen(ref.current)
      }}
      onRemove={onRemove}
    />
  )
}

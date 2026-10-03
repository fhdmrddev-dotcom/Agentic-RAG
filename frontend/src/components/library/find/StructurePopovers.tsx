/**
 * Phase 271-04 (FIND-01 / FIND-03 / D-04 / D-06 / D-07 / P-10) — the six editors behind Find's
 * quick-add chips: Version, Relationship, Folder, Added by, Date, Document type.
 *
 * ⛔ EACH EDITOR SETS EXACTLY ONE CONDITION. It emits one value through `onApply`; the chip
 * row (`FindQuickAdd`) turns that into one reducer action or one filter condition. Nothing here
 * fetches, and nothing here decides what matches: the server evaluates every condition
 * (271-01), and each condition this file can emit has a content-level test there.
 *
 * ⛔ ONE POPOVER IDIOM. Every editor uses ConditionPopover's shell (`w-72 rounded-lg border
 * border-border bg-popover p-3 shadow-md space-y-3`, `role="dialog"` + an aria-label, Esc
 * cancels) so Find's editors read as the same builder as ＋ condition, not a second one
 * (D-114-1). New section headings are 12px uppercase (UI-SPEC S6); ConditionPopover keeps
 * its own shipped labels untouched.
 *
 * Where each dimension lands (P-10): "Date in the document" and Document type are METADATA
 * conditions and go into the shared filter (`onFilterCondition` / a `ViewCondition`); the
 * three file/added dates, Folder, Added by, Relationship and Version are Find-only state.
 *
 * Vocabulary (UI-SPEC): every date says WHOSE date it is; the version words keep "superseded"
 * beside "older versions" / "version history" so they never read like the Supersedes link
 * (D-07).
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { Check, Folder as FolderIcon } from "lucide-react"
import type { Document, Folder, ViewCondition } from "@/types"
import { cn } from "@/lib/utils"
import { LinkTargetCombobox } from "@/components/relationships/LinkTargetCombobox"
import {
  RELATIONSHIP_FILTER_VERBS,
  type RelVerbKey,
} from "@/components/relationships/relationshipLabels"
import { RelativeDateControl, type RelativeUnit } from "@/components/ingestion/RelativeDateControl"
import type {
  FindAddedByCondition,
  FindDateCondition,
  FindFolderCondition,
  FindRelationshipCondition,
  FindVersion,
} from "@/pages/findState"

// ── THE SHARED SHELL ──────────────────────────────────────────────────────────────────

const SHELL = "w-72 rounded-lg border border-border bg-popover p-3 shadow-md space-y-3"
const HEADING = "block text-xs font-medium uppercase tracking-wider text-muted-foreground"
const SELECT =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"

function EditorShell({
  label,
  onCancel,
  onApply,
  canApply,
  children,
}: {
  label: string
  onCancel: () => void
  onApply: () => void
  canApply: boolean
  children: ReactNode
}) {
  // Move focus INTO the editor when it opens (271-05 G-4 finding): otherwise focus stays on the
  // chip, Esc never reaches this handler and Tab walks to the next chip instead of the editor.
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("input:not([disabled]), select:not([disabled]), button:not([disabled])")?.focus()
  }, [])
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation()
      onCancel()
    }
  }
  return (
    <div ref={ref} className={SHELL} role="dialog" aria-label={label} onKeyDown={onKeyDown}>
      {children}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!canApply}
          className={cn(
            "inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground",
            "disabled:opacity-40 disabled:cursor-not-allowed",
          )}
          onClick={onApply}
        >
          <Check className="h-3.5 w-3.5" aria-hidden="true" /> Apply
        </button>
      </div>
    </div>
  )
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <span data-section-heading className={HEADING}>
      {children}
    </span>
  )
}

/** One native radio with its own `<label htmlFor>` (so its accessible name is the label alone)
 *  and an optional helper line tied by `aria-describedby`. */
function Radio({
  name,
  label,
  checked,
  onSelect,
  helper,
  icon,
}: {
  name: string
  label: string
  checked: boolean
  onSelect: () => void
  helper?: string
  icon?: ReactNode
}) {
  const id = useId()
  return (
    <div className="flex items-start gap-2">
      <input
        id={id}
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        aria-describedby={helper ? `${id}-help` : undefined}
        className="mt-0.5 accent-[hsl(var(--primary))]"
      />
      <div className="min-w-0">
        <label htmlFor={id} className="flex items-center gap-1.5 text-sm text-foreground">
          {icon}
          {label}
        </label>
        {helper && (
          <p id={`${id}-help`} className="text-xs text-muted-foreground">
            {helper}
          </p>
        )}
      </div>
    </div>
  )
}

function Checkbox({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-[hsl(var(--primary))]"
      />
      <label htmlFor={id} className={cn("text-sm text-foreground", disabled && "opacity-50")}>
        {label}
      </label>
    </div>
  )
}

// ── VERSION (D-06 / D-07) ─────────────────────────────────────────────────────────────

/** The version options, in order, default first. Exported so the chip row reads the SAME
 *  words (UI-SPEC §Copywriting). */
export const VERSION_OPTIONS: ReadonlyArray<{ value: FindVersion; label: string; helper: string }> = [
  { value: "latest", label: "Latest versions", helper: "One row per document. Default." },
  {
    value: "has_earlier",
    label: "Has earlier versions",
    helper: "Latest rows that have older uploads in their history.",
  },
  {
    value: "older",
    label: "Older versions (superseded)",
    helper:
      "Earlier uploads replaced by a newer version of the same document. This is version history, not a Supersedes link.",
  },
]

export function VersionEditor({
  initial = "latest",
  onApply,
  onCancel,
}: {
  initial?: FindVersion
  onApply: (version: FindVersion) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState<FindVersion>(initial)
  const name = useId()
  return (
    <EditorShell label="Version" onCancel={onCancel} onApply={() => onApply(value)} canApply>
      <div className="space-y-2" role="radiogroup" aria-label="Version">
        {VERSION_OPTIONS.map((o) => (
          <Radio
            key={o.value}
            name={name}
            label={o.label}
            helper={o.helper}
            checked={value === o.value}
            onSelect={() => setValue(o.value)}
          />
        ))}
      </div>
    </EditorShell>
  )
}

// ── RELATIONSHIP (D-04) ───────────────────────────────────────────────────────────────

const NO_EXCLUDED: ReadonlySet<string> = new Set()

export function RelationshipEditor({
  initial,
  documents,
  onApply,
  onCancel,
}: {
  initial?: FindRelationshipCondition | null
  /** The documents the person can see. Only LATEST versions are offered as the target. */
  documents: readonly Document[]
  onApply: (relationship: FindRelationshipCondition) => void
  onCancel: () => void
}) {
  const [verb, setVerb] = useState<RelVerbKey | null>(initial?.verb ?? null)
  const [target, setTarget] = useState<{ id: string; filename: string } | null>(
    initial ? { id: initial.documentId, filename: initial.documentName } : null,
  )
  const name = useId()
  const inputId = useId()
  // The target is a DOCUMENT, so only its latest version is offered (UI-SPEC S6): an older
  // upload is reached through Version, never through a relationship.
  const candidates = useMemo(() => documents.filter((d) => d.is_latest !== false), [documents])

  return (
    <EditorShell
      label="Relationship"
      onCancel={onCancel}
      canApply={verb !== null && target !== null}
      onApply={() => {
        if (verb && target) {
          onApply({ verb, documentId: target.id, documentName: target.filename })
        }
      }}
    >
      <div className="space-y-1.5">
        <Heading>Documents that…</Heading>
        <div className="space-y-1" role="radiogroup" aria-label="Documents that…">
          {RELATIONSHIP_FILTER_VERBS.map((v) => (
            <Radio
              key={v.key}
              name={name}
              label={v.label}
              checked={verb === v.key}
              onSelect={() => setVerb(v.key)}
            />
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor={inputId} className={HEADING} data-section-heading>
          …this document
        </label>
        <LinkTargetCombobox
          candidates={candidates}
          excludeIds={NO_EXCLUDED}
          value={target?.id ?? null}
          onChoose={(d) => setTarget(d ? { id: d.id, filename: d.filename } : null)}
          placeholder="Type a document name"
          maxVisible={8}
          inputId={inputId}
          initialQuery={initial?.documentName ?? ""}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        A link someone added between two documents. Older uploads of the same document are under
        Version.
      </p>
    </EditorShell>
  )
}

// ── FOLDER (SC#3) ─────────────────────────────────────────────────────────────────────

/** The folders in tree order (parents before children, siblings by name), with their depth.
 *  A folder whose parent is not visible is shown at the top level. */
function folderRows(folders: readonly Folder[]): Array<{ folder: Folder; depth: number }> {
  const ids = new Set(folders.map((f) => f.id))
  const children = new Map<string | null, Folder[]>()
  for (const f of folders) {
    const parent = f.parent_id && ids.has(f.parent_id) ? f.parent_id : null
    const list = children.get(parent) ?? []
    list.push(f)
    children.set(parent, list)
  }
  for (const list of children.values()) list.sort((a, b) => a.name.localeCompare(b.name))
  const rows: Array<{ folder: Folder; depth: number }> = []
  const seen = new Set<string>()
  const walk = (parent: string | null, depth: number) => {
    for (const f of children.get(parent) ?? []) {
      if (seen.has(f.id)) continue
      seen.add(f.id)
      rows.push({ folder: f, depth })
      walk(f.id, depth + 1)
    }
  }
  walk(null, 0)
  return rows
}

/** The "not in a folder" choice, distinct from "nothing chosen yet". */
const NOT_IN_A_FOLDER = "__not_in_a_folder__"

export function FolderEditor({
  initial,
  folders,
  onApply,
  onCancel,
}: {
  initial?: FindFolderCondition | null
  folders: readonly Folder[]
  onApply: (folder: FindFolderCondition) => void
  onCancel: () => void
}) {
  const [choice, setChoice] = useState<string | null>(
    initial ? (initial.folderId ?? NOT_IN_A_FOLDER) : null,
  )
  // SC#3: subfolders are ON by default.
  const [includeSubfolders, setIncludeSubfolders] = useState(initial?.includeSubfolders ?? true)
  const name = useId()
  const rows = useMemo(() => folderRows(folders), [folders])
  const notInFolder = choice === NOT_IN_A_FOLDER

  return (
    <EditorShell
      label="Folder"
      onCancel={onCancel}
      canApply={choice !== null}
      onApply={() => {
        if (choice === null) return
        onApply(
          notInFolder
            ? { folderId: null, includeSubfolders: false }
            : { folderId: choice, includeSubfolders },
        )
      }}
    >
      <Heading>Folder</Heading>
      <div className="max-h-56 space-y-1 overflow-y-auto" role="radiogroup" aria-label="Folder">
        <div data-depth={0}>
          <Radio
            name={name}
            label="Not in a folder"
            checked={notInFolder}
            onSelect={() => setChoice(NOT_IN_A_FOLDER)}
          />
        </div>
        {rows.map(({ folder, depth }) => (
          <div key={folder.id} data-depth={depth} style={{ paddingLeft: `${depth * 16}px` }}>
            <Radio
              name={name}
              label={folder.name}
              icon={<FolderIcon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />}
              checked={choice === folder.id}
              onSelect={() => setChoice(folder.id)}
            />
          </div>
        ))}
      </div>
      <Checkbox
        label="Include subfolders"
        checked={notInFolder ? false : includeSubfolders}
        disabled={notInFolder}
        onChange={setIncludeSubfolders}
      />
    </EditorShell>
  )
}

// ── ADDED BY (T-271-11: never an email) ───────────────────────────────────────────────

export function AddedByEditor({
  initial,
  documents,
  onApply,
  onCancel,
}: {
  initial?: FindAddedByCondition | null
  /** The connections offered are the distinct ones that placed these documents. */
  documents: readonly Document[]
  onApply: (addedBy: FindAddedByCondition) => void
  onCancel: () => void
}) {
  const options = useMemo<FindAddedByCondition[]>(() => {
    const connections = new Map<string, string>()
    for (const d of documents) {
      if (d.source_connection_id && !connections.has(d.source_connection_id)) {
        // The connection's NAME, never a person's address (270 P-02).
        connections.set(
          d.source_connection_id,
          `${d.source_connection_name ?? "Unnamed connection"} (connected source)`,
        )
      }
    }
    const connectionOptions = [...connections.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, label]): FindAddedByCondition => ({ kind: "connection", connectionId: id, label }))
    return [
      { kind: "me", connectionId: null, label: "You" },
      ...connectionOptions,
      { kind: "others", connectionId: null, label: "Anyone else" },
    ]
  }, [documents])

  const keyOf = (o: FindAddedByCondition) => `${o.kind}:${o.connectionId ?? ""}`
  const [choice, setChoice] = useState<string | null>(initial ? keyOf(initial) : null)
  const name = useId()
  const chosen = options.find((o) => keyOf(o) === choice) ?? null

  return (
    <EditorShell
      label="Added by"
      onCancel={onCancel}
      canApply={chosen !== null}
      onApply={() => {
        if (chosen) onApply(chosen)
      }}
    >
      <Heading>Added by</Heading>
      <div className="space-y-1" role="radiogroup" aria-label="Added by">
        {options.map((o) => (
          <Radio
            key={keyOf(o)}
            name={name}
            label={o.label}
            checked={choice === keyOf(o)}
            onSelect={() => setChoice(keyOf(o))}
          />
        ))}
      </div>
    </EditorShell>
  )
}

// ── DATE (P-10 — WHOSE date) ──────────────────────────────────────────────────────────

/** "Which date", the four 270 labels verbatim. `document` is the metadata field `date`. */
export const WHICH_DATE_OPTIONS: ReadonlyArray<{
  value: "document" | FindDateCondition["which"]
  label: string
}> = [
  { value: "document", label: "Date in the document" },
  { value: "added", label: "Added to Agentic RAG" },
  { value: "source_created", label: "Created in the file" },
  { value: "source_modified", label: "Last modified in the file" },
]

type DateOp = FindDateCondition["op"]

const DATE_OPS: ReadonlyArray<{ value: DateOp; label: string }> = [
  { value: "within_next", label: "within next…" },
  { value: "older_than", label: "older than…" },
  { value: "before", label: "before" },
  { value: "after", label: "after" },
  { value: "between", label: "between" },
]

const isRelative = (op: DateOp) => op === "within_next" || op === "older_than"

export function DateEditor({
  initial,
  onApply,
  onFilterCondition,
  onCancel,
}: {
  /** A Find date being edited (the metadata `date` is edited through ＋ condition's chip). */
  initial?: FindDateCondition | null
  /** Added / Created in the file / Last modified in the file → Find state (SET_DATE). */
  onApply: (date: FindDateCondition) => void
  /** Date in the document → a metadata condition on the shared filter. */
  onFilterCondition: (condition: ViewCondition) => void
  onCancel: () => void
}) {
  const [which, setWhich] = useState<"document" | FindDateCondition["which"]>(
    initial?.which ?? "added",
  )
  const [op, setOp] = useState<DateOp>(initial?.op ?? "within_next")
  const [value, setValue] = useState(
    initial && !isRelative(initial.op) && typeof initial.value === "string" ? initial.value : "",
  )
  const [value2, setValue2] = useState(initial?.value2 ?? "")
  const [relN, setRelN] = useState<number>(typeof initial?.value === "number" ? initial.value : 30)
  const [relUnit, setRelUnit] = useState<RelativeUnit>(initial?.unit ?? "days")
  const name = useId()

  const canApply = isRelative(op)
    ? relN >= 1
    : op === "between"
      ? value !== "" && value2 !== ""
      : value !== ""

  function apply() {
    if (which === "document") {
      const base: ViewCondition = { field: "date", op }
      onFilterCondition(
        isRelative(op)
          ? { ...base, value: relN, unit: relUnit }
          : op === "between"
            ? { ...base, value, value2 }
            : { ...base, value },
      )
      return
    }
    onApply(
      isRelative(op)
        ? { which, op, value: relN, value2: null, unit: relUnit }
        : { which, op, value, value2: op === "between" ? value2 : null, unit: null },
    )
  }

  const inputCls =
    "h-9 w-full min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"

  return (
    <EditorShell label="Date" onCancel={onCancel} onApply={apply} canApply={canApply}>
      <div className="space-y-1.5">
        <Heading>Which date</Heading>
        <div className="space-y-1" role="radiogroup" aria-label="Which date">
          {WHICH_DATE_OPTIONS.map((o) => (
            <Radio
              key={o.value}
              name={name}
              label={o.label}
              checked={which === o.value}
              onSelect={() => setWhich(o.value)}
            />
          ))}
        </div>
      </div>
      <label className="block space-y-1">
        <Heading>Condition</Heading>
        <select
          aria-label="Condition"
          value={op}
          onChange={(e) => setOp(e.target.value as DateOp)}
          className={SELECT}
        >
          {DATE_OPS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {isRelative(op) ? (
        <RelativeDateControl
          direction={op as "within_next" | "older_than"}
          value={relN}
          unit={relUnit}
          onChange={({ value: v, unit: u }) => {
            setRelN(v)
            setRelUnit(u)
          }}
        />
      ) : op === "between" ? (
        <div className="flex items-center gap-2">
          <input
            type="date"
            aria-label="From date"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={inputCls}
          />
          <span className="text-xs text-muted-foreground">and</span>
          <input
            type="date"
            aria-label="To date"
            value={value2}
            onChange={(e) => setValue2(e.target.value)}
            className={inputCls}
          />
        </div>
      ) : (
        <input
          type="date"
          aria-label="On date"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={inputCls}
        />
      )}
    </EditorShell>
  )
}

// ── DOCUMENT TYPE (P-10 — a metadata condition) ───────────────────────────────────────

/** The document types an existing filter condition already holds (to pre-tick them). */
function typesOf(condition: ViewCondition | undefined): string[] {
  if (!condition) return []
  if (condition.op === "one_of") return (condition.values ?? []).map(String)
  if (condition.op === "eq" && condition.value != null) return [String(condition.value)]
  return []
}

export function DocumentTypeEditor({
  initial,
  documents,
  onApply,
  onCancel,
}: {
  /** The filter's existing `document_type` condition, when there is one. */
  initial?: ViewCondition
  documents: readonly Document[]
  onApply: (condition: ViewCondition) => void
  onCancel: () => void
}) {
  const options = useMemo(() => {
    // A type the filter already holds is always offered, even if no loaded document carries
    // it now — otherwise the person could not untick the condition they are looking at.
    const set = new Set<string>(typesOf(initial))
    for (const d of documents) {
      const t = d.metadata?.document_type
      if (typeof t === "string" && t.trim() !== "") set.add(t)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [documents, initial])
  const [picked, setPicked] = useState<string[]>(() => typesOf(initial))

  // Keep the person's pick order stable by reading it through the option order.
  const ordered = options.filter((o) => picked.includes(o))

  return (
    <EditorShell
      label="Document type"
      onCancel={onCancel}
      canApply={ordered.length > 0}
      onApply={() => {
        if (ordered.length === 1) {
          onApply({ field: "document_type", op: "eq", value: ordered[0] })
        } else if (ordered.length > 1) {
          onApply({ field: "document_type", op: "one_of", values: ordered })
        }
      }}
    >
      <Heading>Document type</Heading>
      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground">No document types recorded yet.</p>
      ) : (
        <div className="max-h-56 space-y-1 overflow-y-auto">
          {options.map((o) => (
            <Checkbox
              key={o}
              label={o}
              checked={picked.includes(o)}
              onChange={(next) =>
                setPicked((prev) => (next ? [...prev, o] : prev.filter((p) => p !== o)))
              }
            />
          ))}
        </div>
      )}
    </EditorShell>
  )
}

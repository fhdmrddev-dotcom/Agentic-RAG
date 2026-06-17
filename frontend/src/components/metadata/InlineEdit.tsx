/**
 * Phase 112 Plan 04 Task 1 — InlineEdit (the honest metadata correction control).
 *
 * Mirrors the FolderNode inline-rename pattern (ingestion/FolderNode.tsx:151-170):
 * the value is a real <button> trigger; click/Enter swaps it to a type-appropriate
 * control IN PLACE (no panel-wide edit mode, no bottom Save bar — sketch 028 winner A).
 * Enter (single-line) / Cmd-Ctrl+Enter (summary) is the EXPLICIT commit path; Esc
 * cancels + restores focus to the trigger (useRef).
 *
 * Blur does NOT commit a half-typed edit (WR-04 data-loss guard): a blur-commit
 * only fires when the value changed AND Esc didn't fire AND the explicit Enter
 * commit path was taken — clicking another field row or the close button (focus
 * moving OUTSIDE the control via `e.relatedTarget`) abandons the in-progress draft
 * without writing, so an accidental click can never destroy an extracted value.
 *
 * field_type → control mapping (LOCKED per RESEARCH Open Q1/Q2 + the plan):
 *   string | title | author → <Input> (h-8)
 *   summary                 → <Textarea> (Cmd/Ctrl+Enter commits; plain Enter = newline)
 *   date                    → <input type="date">
 *   enum                    → <Select> over options
 *   topics | array          → comma-separated text input (v1; pill editor is a later upgrade)
 *   number                  → <input type="number">
 *   boolean                 → two-option <Select>
 *
 * Honesty contract: editing an EMPTY/absent field is how you ADD a value — the empty
 * state is a focusable dashed "Not extracted — add" button that opens the same control.
 * On a successful commit, `onCommit(field, value)` is called (the parent awaits the
 * PATCH and only then shows the "Saved · audit logged" receipt).
 *
 * a11y: panel-scoped AA tokens only; the trigger carries an sr-only field-name label
 * so each editable value is disambiguated; never colour-alone (the empty state shows a
 * "+ add" word, not just a dashed border).
 */
import { useRef, useState } from "react"
import { Pencil } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

/** The display + control type for a metadata field. Built-ins (title/author/summary/
 *  topics) are not in the custom-field `field_type` vocab, so this is a superset. */
export type InlineFieldType =
  | "string"
  | "title"
  | "author"
  | "summary"
  | "date"
  | "enum"
  | "topics"
  | "array"
  | "number"
  | "boolean"

export interface InlineEditProps {
  /** The metadata field_key being edited (e.g. "title", "document_type", a custom key). */
  field: string
  /** Drives the control rendered when editing. */
  fieldType: InlineFieldType
  /** The current stored value (undefined/null/empty string ⇒ the empty "add" affordance). */
  value?: unknown
  /** Enum/select options (for `enum`). */
  options?: string[] | null
  /** Called with the committed value once the user commits a CHANGED value. The parent
   *  performs the PATCH + receipt; InlineEdit never claims the write succeeded. */
  onCommit: (field: string, value: unknown) => void
}

/** Stringify a stored value for the editing control. Arrays/topics → comma-joined. */
function toEditString(value: unknown, fieldType: InlineFieldType): string {
  if (value == null) return ""
  if (Array.isArray(value)) return value.join(", ")
  if (fieldType === "boolean") return value ? "true" : "false"
  return String(value)
}

/** Parse the editing-control string back into the committed value shape. */
function fromEditString(raw: string, fieldType: InlineFieldType): unknown {
  const trimmed = raw.trim()
  if (fieldType === "topics" || fieldType === "array") {
    // Comma-separated → string[]; drop empties. An empty input ⇒ [] (cleared).
    return trimmed
      ? trimmed
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : []
  }
  if (fieldType === "number") {
    if (trimmed === "") return null
    const n = Number(trimmed)
    return Number.isNaN(n) ? null : n
  }
  if (fieldType === "boolean") return trimmed === "true"
  // string-likes: empty ⇒ null (the merge guard honours a cleared user field).
  return trimmed === "" ? null : trimmed
}

/** True when a value is "absent" for display purposes (the empty-add affordance). */
function isEmptyValue(value: unknown): boolean {
  if (value == null) return true
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === "string") return value.trim() === ""
  return false
}

export function InlineEdit({
  field,
  fieldType,
  value,
  options,
  onCommit,
}: InlineEditProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const triggerRef = useRef<HTMLButtonElement>(null)
  // Set while Esc cancels so the control's onBlur doesn't ALSO commit.
  const cancelledRef = useRef(false)
  // WR-04: set ONLY by the explicit Enter / Cmd-Ctrl+Enter path. A blur that did
  // not follow an explicit Enter must NOT commit (an accidental click elsewhere
  // would otherwise overwrite an extracted value + stamp _source='user').
  const explicitCommitRef = useRef(false)

  const empty = isEmptyValue(value)
  const original = toEditString(value, fieldType)

  function startEditing() {
    setDraft(toEditString(value, fieldType))
    cancelledRef.current = false
    explicitCommitRef.current = false
    setEditing(true)
  }

  /** The shared write path: leave editing mode and fire onCommit when dirty.
   *  Called by the explicit Enter path. Idempotent — the trailing blur an
   *  explicit commit triggers (the control unmounts) is absorbed by clearing
   *  the explicit flag here, so onCommit fires exactly once. */
  function commit() {
    if (cancelledRef.current) return
    explicitCommitRef.current = false
    setEditing(false)
    // Only fire onCommit when the value actually changed (dirty guard).
    if (draft === original) return
    onCommit(field, fromEditString(draft, fieldType))
  }

  /** Explicit commit (Enter / Cmd-Ctrl+Enter). Marks the commit explicit so the
   *  trailing blur it triggers is recognised as intentional, not accidental. */
  function commitExplicit() {
    explicitCommitRef.current = true
    commit()
  }

  /** WR-04 focus-target guard. Blur fires when focus leaves the control. After an
   *  explicit Enter, `commit()` has already cleared the explicit flag + left editing
   *  mode, so this is a no-op. A blur the user caused by clicking another row / the
   *  close button / outside (no Enter) must NOT commit — it abandons the in-progress
   *  draft (no write, no audit row, the extracted value survives) and drops back to
   *  display mode. Focus moving to an in-control affordance (relatedTarget still
   *  inside this control) keeps editing. */
  function handleBlur(e: React.FocusEvent<HTMLElement>) {
    if (cancelledRef.current || explicitCommitRef.current) return
    const next = e.relatedTarget as Node | null
    if (next && e.currentTarget.contains(next)) {
      // Focus stayed inside this control (an in-control affordance) — keep editing.
      return
    }
    // Accidental blur to outside the control — abandon the draft, don't write.
    setEditing(false)
  }

  function cancel() {
    cancelledRef.current = true
    setEditing(false)
    // Restore focus to the trigger (matches FolderNode Esc behaviour).
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  // ── Display mode ──
  if (!editing) {
    const label = `Edit ${field}`
    if (empty) {
      return (
        <button
          ref={triggerRef}
          type="button"
          onClick={startEditing}
          aria-label={`Add ${field}`}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border border-dashed border-border/70",
            "px-2 py-0.5 text-xs italic text-panel-muted-foreground",
            "transition-colors hover:border-primary/40 hover:text-foreground",
            "focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
          )}
        >
          <span aria-hidden="true">+</span>
          <span>Not extracted — add</span>
        </button>
      )
    }
    return (
      <button
        ref={triggerRef}
        type="button"
        onClick={startEditing}
        aria-label={label}
        className={cn(
          "group inline-flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left text-sm",
          "transition-colors hover:bg-accent/40",
          "focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
        )}
      >
        <span className="truncate">{original}</span>
        <Pencil
          aria-hidden="true"
          className="h-3 w-3 flex-none text-panel-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
        />
      </button>
    )
  }

  // ── Editing mode ──
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault()
      cancel()
    }
  }

  // enum / boolean → Select (no text control; commit on value change).
  if (fieldType === "enum" || fieldType === "boolean") {
    const selectOptions =
      fieldType === "boolean" ? ["true", "false"] : options ?? []
    return (
      <Select
        defaultOpen
        value={draft || undefined}
        onValueChange={(v) => {
          setDraft(v)
          // Commit immediately on selection (a Select has no "Enter").
          if (v !== original) onCommit(field, fromEditString(v, fieldType))
          setEditing(false)
          requestAnimationFrame(() => triggerRef.current?.focus())
        }}
      >
        <SelectTrigger
          aria-label={`Edit ${field}`}
          className="h-8 w-full text-sm"
          onKeyDown={onKeyDown}
        >
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent>
          {selectOptions.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  // summary → Textarea (Cmd/Ctrl+Enter commits; plain Enter inserts a newline).
  if (fieldType === "summary") {
    return (
      <Textarea
        autoFocus
        aria-label={`Edit ${field}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault()
            cancel()
          }
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            commitExplicit()
          }
        }}
        className="min-h-[60px] text-sm focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:ring-offset-0"
      />
    )
  }

  // date / number / string-likes / topics → single-line Input.
  const inputType =
    fieldType === "date" ? "date" : fieldType === "number" ? "number" : "text"

  return (
    <Input
      autoFocus
      type={inputType}
      aria-label={`Edit ${field}`}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          commitExplicit()
        }
        if (e.key === "Escape") {
          e.preventDefault()
          cancel()
        }
      }}
      placeholder={
        fieldType === "topics" || fieldType === "array"
          ? "comma, separated, values"
          : undefined
      }
      className="h-8 text-sm focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:ring-offset-0"
    />
  )
}

export default InlineEdit

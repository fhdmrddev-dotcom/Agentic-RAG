/**
 * Phase 270 (270-03) — the File section's facts: eight labelled rows in fixed order, a pure function of `doc`.
 *
 * D-09/D-10: a fact that is null or <= 0 reads italic "not recorded" — never 0, never a fallback to created_at.
 * "Created in the file" / "Last modified in the file" read ONLY source_created_at / source_modified_at.
 * P-02: "Added by" never shows an email. P-08: the footnote tells the reader to re-ingest — that sentence
 * depends on 270-01 proving `/reingest` writes the facts; remove it if that proof ever fails (UI-SPEC rule).
 * No state, no fetch, no title attribute.
 */
import type { Document } from "@/types"
import { formatBytes } from "@/lib/formatBytes"
import { extensionOf } from "@/lib/fileTypeMark"

function NotRecorded() {
  return <span className="italic text-panel-muted-foreground">not recorded</span>
}

function formatFactDate(iso: string | null | undefined) {
  if (!iso) return <NotRecorded />
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return <NotRecorded />
  const text = d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
  return <time dateTime={iso}>{text}</time>
}

function addedBy(doc: Document, currentUserId?: string): string {
  // A connected source owns its documents under the user who connected it, so the connection is
  // tested FIRST: otherwise every connector-placed file reads "You" beside a banner saying a
  // connected source placed it (270 UAT G4-4a).
  if (doc.source_connection_id) {
    return doc.source_connection_name
      ? `${doc.source_connection_name} (connected source)`
      : "a connected source"
  }
  if (currentUserId && doc.user_id === currentUserId) return "You"
  return "name not available"
}

export function DocumentFileFacts({
  doc,
  currentUserId,
}: {
  doc: Document
  currentUserId?: string
}) {
  const ext = extensionOf(doc.filename).toUpperCase()
  const pages = doc.page_count
  const hasPages = pages != null && pages > 0
  const hasSize = doc.file_size != null && doc.file_size > 0
  const version = doc.version_number ?? 1

  const noFileFacts =
    !hasPages && !doc.source_created_at && !doc.source_modified_at && !doc.source_author

  return (
    <div>
      <dl className="grid grid-cols-[152px_minmax(0,1fr)] gap-x-3 gap-y-2 px-4 pt-1">
        <dt className="text-xs text-panel-muted-foreground">File type</dt>
        <dd className="text-sm text-foreground">
          {ext && <span>{ext}</span>}
          {doc.mime_type && (
            <span className={ext ? "ml-2 font-mono text-xs text-panel-muted-foreground" : "font-mono text-xs"}>
              {doc.mime_type}
            </span>
          )}
          {!ext && !doc.mime_type && <NotRecorded />}
        </dd>

        <dt className="text-xs text-panel-muted-foreground">File size</dt>
        <dd className="text-sm text-foreground">
          {hasSize ? formatBytes(doc.file_size) : <NotRecorded />}
        </dd>

        <dt className="text-xs text-panel-muted-foreground">Pages</dt>
        <dd className="text-sm text-foreground">
          {hasPages ? `${pages} ${pages === 1 ? "page" : "pages"}` : <NotRecorded />}
        </dd>

        <dt className="text-xs text-panel-muted-foreground">Created in the file</dt>
        <dd className="text-sm text-foreground">{formatFactDate(doc.source_created_at)}</dd>

        <dt className="text-xs text-panel-muted-foreground">Last modified in the file</dt>
        <dd className="text-sm text-foreground">{formatFactDate(doc.source_modified_at)}</dd>

        <dt className="text-xs text-panel-muted-foreground">Author in the file</dt>
        <dd className="text-sm text-foreground">
          {doc.source_author ? doc.source_author : <NotRecorded />}
        </dd>

        <dt className="text-xs text-panel-muted-foreground">Added to Agentic RAG</dt>
        <dd className="text-sm text-foreground">
          {formatFactDate(doc.created_at)}
          {version > 1 && ` · when v${version} was added`}
        </dd>

        <dt className="text-xs text-panel-muted-foreground">Added by</dt>
        <dd className="text-sm text-foreground">{addedBy(doc, currentUserId)}</dd>
      </dl>
      {noFileFacts && (
        <p className="px-4 pt-2 text-xs text-panel-muted-foreground">
          These facts are read from the file when it is added. This file was added before they were
          recorded, or its type does not carry them. Re-ingest it to read them.
        </p>
      )}
    </div>
  )
}

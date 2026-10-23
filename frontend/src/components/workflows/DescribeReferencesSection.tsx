/**
 * Phase 291-04 (AUTH-02 · D-03 / D-05 / D-08) — THE REFERENCES SECTION.
 *
 * Sketch 291-describe-files winner B: the template row answers "have a document to fill in?"
 * and THIS section, its peer below a hairline rule, answers "anything it should read first?".
 * One question per section — never a single tray with roles (variant C, rejected) and never a
 * sub-block inside the template row (variant A, rejected).
 *
 * ── PRESENTATIONAL. IT OWNS NO FETCH ─────────────────────────────────────────────────────
 * The same shape as `DescribeTemplateRow`: props in, callbacks out. Every read, the five-place
 * limit, the duplicate and refusal decisions and their worded notice live in the hook
 * (`useReferenceReads`); this file renders what it is handed. That is what lets every reading
 * be driven in a test without a server.
 *
 * ── WHAT IT RENDERS, AND WHAT IT MAY NEVER SAY ───────────────────────────────────────────
 *  · Each reading line is a FACT in the server's words or the vocabulary's — never a verdict.
 *    No line calls a file safe or checked (D-17), and no line says a step reads a reference
 *    when the workflow runs: references inform the draft only (orchestrator decision 2).
 *  · ONE live region wraps the list (the shipped single-live-region pattern). Nothing here is
 *    an alert: a declined pick is the author's own choice being answered, not an emergency.
 *  · Every file-derived string — filenames, server sentences — is a React TEXT CHILD.
 *
 * ── THE SPACING FENCE ────────────────────────────────────────────────────────────────────
 * The section's frame, notes and footing are the shipped constants imported BY NAME from
 * `./surfaceClasses`. This file types none of the off-grid values itself; its suite reads the
 * raw source to hold that.
 */
import { useId } from "react"

import { FACT_CLASSES, FOOTING_CLASSES, NOTE_CLASSES, ROW_CLASSES } from "./surfaceClasses"
import {
  REFS_ACCEPT,
  REFS_FOOTING_READING,
  REFS_FULL,
  REFS_KEEP,
  REFS_LABEL,
  REFS_NOTE,
  REFS_POWERS,
  REFS_PROMPT,
  REFS_READING,
  REFS_READ_FULL,
  REFS_REMOVE,
  REFS_TYPES,
  SCAN_UNREADABLE,
  refsCount,
  refsRemoveLabel,
  refsSendFailed,
} from "./templateFirstVocabulary"

import type { DescribeReadState } from "./useTemplateFirstDraft"

/** The five places (D-03). The hook enforces it; this only knows when the picker is full. */
const REFERENCE_LIMIT = 5

export interface DescribeReferencesSectionProps {
  /** The held references, in the order the author added them, each with its reading. */
  references: ReadonlyArray<{ file: File; state: DescribeReadState }>
  /** The one line under the picker — already worded by the hook — or `null`. */
  notice: { kind: "refused" | "overflow" | "duplicate"; text: string } | null
  /** A file is held ANYWHERE on the door (the form slot or here): the powers and keep lines. */
  anyFileHeld: boolean
  /** A reference is still being read: the footing says the draft waits for it. */
  anyReading: boolean
  /** The author picked one or more files. This component performs no read and no upload. */
  onAddFiles: (files: File[]) => void
  /** The author removed the reference at this index. No confirmation: nothing was stored. */
  onRemove: (index: number) => void
}

/** One reading line: its words and whether they are a FACT (foreground) or an explanation. */
function readingOf(file: File, state: DescribeReadState): { text: string; fact: boolean } | null {
  switch (state.kind) {
    case "idle":
      return null
    case "loading":
      return { text: REFS_READING, fact: false }
    case "unavailable":
      return { text: refsSendFailed(file.name), fact: true }
    case "read": {
      const r = state.result
      if (r.arm === "scan_unreadable") return { text: SCAN_UNREADABLE, fact: true }
      // The server's own sentence, verbatim — a long file is never cut silently.
      if (r.cut_short !== null) return { text: r.cut_short, fact: true }
      return { text: REFS_READ_FULL, fact: false }
    }
  }
}

const INPUT_CLASSES =
  "mt-1 w-full text-[11px] text-muted-foreground file:mr-2 file:rounded file:border file:border-border file:bg-card file:px-2 file:py-1 file:text-[11px] file:text-foreground hover:file:bg-accent/40"

const REMOVE_CLASSES =
  "min-h-6 flex-none text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary"

export function DescribeReferencesSection({
  references,
  notice,
  anyFileHeld,
  anyReading,
  onAddFiles,
  onRemove,
}: DescribeReferencesSectionProps) {
  const inputId = useId()
  const fullId = useId()
  const count = references.length
  const full = count >= REFERENCE_LIMIT

  return (
    <section data-testid="describe-reference-row" className={ROW_CLASSES}>
      <p data-testid="describe-reference-prompt" className="text-[11px] font-medium text-foreground">
        {REFS_PROMPT}
      </p>

      <p data-testid="describe-reference-note" className={NOTE_CLASSES}>
        {REFS_NOTE}
      </p>

      {/* ONE live region around the whole list — never one per file. */}
      <div role="status">
        <ul data-testid="describe-reference-list" className="mt-2 flex flex-col gap-2">
          {references.map(({ file, state }, index) => {
            const reading = readingOf(file, state)
            return (
              <li key={`${file.name}-${file.size}-${file.lastModified}-${index}`} className="flex flex-col gap-1">
                <div className="flex items-baseline gap-1 text-[11px]">
                  <span aria-hidden="true">📎</span>
                  <span className="min-w-0 flex-1 text-foreground [overflow-wrap:anywhere]">{file.name}</span>
                  <button
                    type="button"
                    aria-label={refsRemoveLabel(file.name)}
                    onClick={() => onRemove(index)}
                    className={REMOVE_CLASSES}
                  >
                    {REFS_REMOVE}
                  </button>
                </div>
                {reading !== null && (
                  <p
                    data-testid="describe-reference-reading"
                    className={`${reading.fact ? FACT_CLASSES : NOTE_CLASSES} pl-4`}
                  >
                    {reading.text}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      <label
        htmlFor={inputId}
        data-testid="describe-reference-label"
        className="mt-2 block text-[11px] font-medium text-foreground"
      >
        {REFS_LABEL} <span className="font-normal text-muted-foreground">{refsCount(count)}</span>
      </label>
      {/* The NATIVE picker, the template row's reasoning inherited. At the limit it is disabled
          and SAYS WHY through `aria-describedby` — a disabled control that does not say why
          reads as broken. */}
      <input
        id={inputId}
        type="file"
        multiple
        data-testid="describe-reference-input"
        accept={REFS_ACCEPT}
        disabled={full}
        {...(full ? { "aria-describedby": fullId } : {})}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          // Reset NOW, before the callback, so re-picking the same file re-fires `change`.
          event.target.value = ""
          if (files.length > 0) onAddFiles(files)
        }}
        className={full ? `${INPUT_CLASSES} pointer-events-none opacity-50` : INPUT_CLASSES}
      />

      {full ? (
        <p id={fullId} data-testid="describe-reference-types" className={NOTE_CLASSES}>
          {REFS_FULL}
        </p>
      ) : (
        <p data-testid="describe-reference-types" className={NOTE_CLASSES}>
          {REFS_TYPES}
        </p>
      )}

      {notice !== null && (
        <p data-testid="describe-reference-notice" className={FACT_CLASSES}>
          {notice.text}
        </p>
      )}

      {anyReading && (
        <p data-testid="describe-reference-footing" className={FOOTING_CLASSES}>
          {REFS_FOOTING_READING}
        </p>
      )}

      {/* A STRUCTURAL claim about what files can do, shown only once a file is held (the
          3-second read at rest). It is never a claim that a file is fine (D-17). */}
      {anyFileHeld && (
        <>
          <p data-testid="describe-reference-powers" className={NOTE_CLASSES}>
            {REFS_POWERS}
          </p>
          <p data-testid="describe-reference-keep" className={NOTE_CLASSES}>
            {REFS_KEEP}
          </p>
        </>
      )}
    </section>
  )
}

export default DescribeReferencesSection

/**
 * Phase 095 Plan 01 Task 2 — the D-07 single per-extension file-icon module.
 *
 * `fileIcon(filename, sizePx?)` is THE one shared file icon every output-file
 * card reuses (the 014/015 chat file cards + the 016 hero/working cards). No
 * second icon system — this resolves SKETCH-CONSISTENCY G1 ("one shared
 * fileIcon()").
 *
 * It maps a file extension to a Lucide glyph (FileText / Table / Image / Code /
 * Presentation) tinted with the canonical category color, plus a small mono
 * `.{EXT}` ribbon label. The ext→(color, glyph-category) map is the canonical
 * one from the sketch (chat-tool-card-unification.md §"Per-extension file
 * icon"): pptx orange · pdf red · docx blue · md slate · csv green · png
 * violet · json teal · default gray.
 *
 * SECURITY (T-095-01-01): the filename is model/sandbox-derived (user-
 * influenced) and crosses into the render layer here. It is rendered ONLY as a
 * parsed extension label via React text children — never as raw-HTML innerHTML,
 * never interpolated into markup. The raw filename never reaches the DOM.
 *
 * NOT yet consumed — OutputFileCard imports this in Plan 05.
 */
import {
  Code,
  FileText,
  Image as ImageIcon,
  Presentation,
  Table,
  type LucideIcon,
} from "lucide-react"
import type { JSX } from "react"

/** A glyph category and the category color (canonical sketch hexes). */
type IconSpec = { color: string; Glyph: LucideIcon }

const DEFAULT_SPEC: IconSpec = { color: "#687076", Glyph: FileText }

// The canonical ext→(color, glyph) map. Each row carries the sketch hex for
// the "named" extension; sibling extensions in the same category reuse the
// category glyph (a neutral category color where the sketch did not pin one).
const EXT_MAP: Record<string, IconSpec> = {
  // slides — Presentation glyph
  pptx: { color: "#f76707", Glyph: Presentation },
  ppt: { color: "#f76707", Glyph: Presentation },
  // text / documents — FileText glyph
  pdf: { color: "#e03131", Glyph: FileText },
  docx: { color: "#1c7ed6", Glyph: FileText },
  doc: { color: "#1c7ed6", Glyph: FileText },
  md: { color: "#5c677d", Glyph: FileText },
  txt: { color: "#5c677d", Glyph: FileText },
  rtf: { color: "#5c677d", Glyph: FileText },
  // tables — Table glyph
  csv: { color: "#2f9e44", Glyph: Table },
  xls: { color: "#2f9e44", Glyph: Table },
  xlsx: { color: "#2f9e44", Glyph: Table },
  // images — Image glyph
  png: { color: "#7048e8", Glyph: ImageIcon },
  jpg: { color: "#7048e8", Glyph: ImageIcon },
  jpeg: { color: "#7048e8", Glyph: ImageIcon },
  gif: { color: "#7048e8", Glyph: ImageIcon },
  svg: { color: "#7048e8", Glyph: ImageIcon },
  webp: { color: "#7048e8", Glyph: ImageIcon },
  // code — Code glyph
  json: { color: "#0c8599", Glyph: Code },
  js: { color: "#0c8599", Glyph: Code },
  ts: { color: "#0c8599", Glyph: Code },
  html: { color: "#0c8599", Glyph: Code },
  py: { color: "#0c8599", Glyph: Code },
  xml: { color: "#0c8599", Glyph: Code },
}

/**
 * Render the per-extension file icon: a category-colored Lucide glyph plus a
 * small mono `.{EXT}` ribbon label.
 *
 * @param filename the file name (model/user-derived — rendered as a parsed
 *   extension label ONLY; never injected as markup)
 * @param sizePx glyph size in px (default 24)
 */
export function fileIcon(filename: string, sizePx: number = 24): JSX.Element {
  // Parse the extension defensively — `.pop()` on a name without a "." returns
  // the whole string, so guard on the presence of a dot to detect "no ext".
  const hasDot = filename.includes(".")
  const ext = hasDot ? (filename.split(".").pop() ?? "").toLowerCase() : ""
  const { color, Glyph } = EXT_MAP[ext] ?? DEFAULT_SPEC
  // The ribbon label is the ONLY thing derived from the filename, and it is the
  // PARSED extension only (or "FILE") — never the raw filename. Plain text.
  const label = `.${(ext || "FILE").toUpperCase()}`

  return (
    <span
      className="inline-flex flex-col items-center gap-0.5"
      style={{ color }}
      aria-hidden="true"
    >
      <Glyph size={sizePx} strokeWidth={1.75} />
      <span
        className="font-mono font-semibold leading-none"
        style={{ fontSize: Math.max(8, Math.round(sizePx / 3)), color }}
      >
        {label}
      </span>
    </span>
  )
}

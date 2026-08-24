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
 *
 * ───────────────────────────────────────────────────────────────────────────
 * PHASE 195 PLAN 03 TASK 1 — the widening, and TWO STALE NOTES CORRECTED BESIDE
 * THEIR ORIGINALS (the house pattern: `phaseGlyph.tsx:107-119`,
 * `StopControl.baseline.test.tsx:517-520`, `rowIdentity.test.ts:89-98`).
 *
 * ⚠ CORRECTION 1 — the line 21 above reads, verbatim:
 *     "NOT yet consumed — OutputFileCard imports this in Plan 05."
 *   That was true when written (Phase 095 Plan 01) and is now FALSE TWICE OVER.
 *   `OutputFileCard.tsx:83` has consumed it since Phase 095.1, and from Phase 195
 *   it acquires FOUR consumers via the shared `components/files/FileRow.tsx`:
 *   the chat output card, the panel file list, the run page's deliverable list
 *   and the shared row itself. The original line is kept rather than edited so
 *   the drift is visible instead of overwritten.
 *
 * ⚠ CORRECTION 2 — `195-CONTEXT.md`'s `<code_context>` says this module
 *   "needs consumers, not changes". Phase 195 CHANGED it, ADDITIVELY, and the
 *   reason is measured (195-RESEARCH.md § F10): the panel and the run page each
 *   ship a 16px MONOCHROME glyph on a theme token, and the panel's token
 *   (`text-panel-muted-foreground`) is a deliberate Phase 088-05 AA decision —
 *   light-theme `--muted-foreground` measured 4.01:1, BELOW the 4.5:1 AA floor.
 *   The only construction that satisfies BOTH "exactly ONE icon path" (SC#2) and
 *   both surfaces' shipped contrast decisions is additive optional params here.
 *   Plan 195-08 records the same correction in the CONTEXT file itself.
 *
 * ⚠ THE GLYPH DELTA — MEASURED, and RECORDED AS A DECISION rather than
 *   discovered at UAT. `FilesSection.tsx:52-71` and `WorkflowRunPage.tsx:164-188`
 *   each carry their own ext/mime→glyph mapping, and this module's map differs
 *   from theirs on FOUR categories. Phase 195 keeps THIS module's glyphs (it is
 *   the DECLARED one shared icon module — D-07 — and its 11 shipped cases stay
 *   green). Same category, different lucide glyph:
 *       tables   FileSpreadsheet → Table
 *       code     FileCode        → Code
 *       images   FileImage       → Image
 *       unknown  File            → FileText
 *   This is a VISIBLE change to the panel and the run page when plans 05/06
 *   convert them. It is the price of one icon path. D-18 declined a sketch for a
 *   surface that is already design-reviewed, so it is on record here.
 * ───────────────────────────────────────────────────────────────────────────
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
import { cn } from "@/lib/utils"

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
  // ── Phase 195 Plan 03 Task 1 — the NINE extensions the panel's `codeExts`
  //    covered and this map omitted. This is a MEASURED regression fix, not a
  //    completeness gesture: `195-02-SUMMARY.md` recorded that `sh`, `bash`,
  //    `sql`, `yml`, `yaml`, `css`, `jsx` and `mjs` (plus `tsx`) resolve to
  //    `FileCode` in the panel TODAY (`FilesSection.tsx:62-65`) and would have
  //    fallen to `DEFAULT_SPEC` (`FileText`) the moment the panel adopted this
  //    module — a visibly WORSE glyph on files the 11 shipped cases never
  //    exercise. Same category, same hex as the code rows above.
  tsx: { color: "#0c8599", Glyph: Code },
  jsx: { color: "#0c8599", Glyph: Code },
  mjs: { color: "#0c8599", Glyph: Code },
  sh: { color: "#0c8599", Glyph: Code },
  bash: { color: "#0c8599", Glyph: Code },
  sql: { color: "#0c8599", Glyph: Code },
  yml: { color: "#0c8599", Glyph: Code },
  yaml: { color: "#0c8599", Glyph: Code },
  css: { color: "#0c8599", Glyph: Code },
}

// ── The mime branches (Phase 195 Plan 03 Task 1) ────────────────────────────
// The panel is MIME-FIRST (`FilesSection.tsx:52-71`) and extension-only
// resolution cannot express that: a workspace file can arrive with a
// meaningful `mime_type` and NO extension at all. Both existing copies keep
// the OOXML mimes as named consts; so does this one.
const MIME_OOXML_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
const MIME_OOXML_PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
const MIME_OOXML_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

// The per-category specs the mime branches resolve to are DERIVED FROM `EXT_MAP`
// rather than re-typed, so a colour can never drift between the mime branch and
// the extension branch for the same category. (A second hand-typed `#2f9e44`
// would be exactly the split-brain `phaseGlyph.tsx:86-96` guards against.)
const SPEC_DOCUMENT: IconSpec = EXT_MAP.docx
const SPEC_TABLE: IconSpec = EXT_MAP.xlsx
const SPEC_SLIDES: IconSpec = EXT_MAP.pptx
const SPEC_IMAGE: IconSpec = EXT_MAP.png
const SPEC_CODE: IconSpec = EXT_MAP.json
const SPEC_TEXT: IconSpec = EXT_MAP.md

/**
 * Resolve the icon spec for a parsed extension and an OPTIONAL mime type.
 *
 * ⚠ THE BRANCH ORDER MIRRORS `FilesSection.tsx:52-71` `iconFor` EXACTLY, and the
 * one place it looks like it does not is the load-bearing part. The plan's
 * wording was "check mime BEFORE the extension lookup"; taken literally — with
 * the bare `text/` fallthrough hoisted above `EXT_MAP` too — it REGRESSES the
 * very thing this task exists to prevent: `script.py` served as `text/plain`
 * would resolve `text/` → document, where the panel resolves it to CODE
 * (`codeExts.includes("py")` is checked BEFORE the bare `text/` arm, at
 * `FilesSection.tsx:62-69`). So every SPECIFIC mime branch is mime-first, and
 * only the deliberately-last `text/` FALLTHROUGH sits after the extension
 * lookup — which is what "fallthrough" means and what the panel already does.
 *
 * The three OOXML arms keep the panel's `ext === "docx" || mime === …` shape
 * verbatim, so extension and mime cannot disagree about an office file.
 */
function resolveSpec(ext: string, mimeType?: string): IconSpec {
  if (mimeType !== undefined) {
    if (ext === "docx" || mimeType === MIME_OOXML_DOCX) return SPEC_DOCUMENT
    if (ext === "xlsx" || mimeType === MIME_OOXML_XLSX) return SPEC_TABLE
    if (ext === "pptx" || mimeType === MIME_OOXML_PPTX) return SPEC_SLIDES
    if (mimeType === "text/markdown") return SPEC_TEXT
    if (mimeType === "text/csv") return SPEC_TABLE
    if (mimeType.startsWith("image/")) return SPEC_IMAGE
    if (mimeType.startsWith("text/x-") || mimeType === "application/json") return SPEC_CODE
  }
  // ⚠ OWN-PROPERTY GUARD, and it is not defensive style — it is a SHIPPED SCAR.
  // `EXT_MAP` is a plain object literal, so it INHERITS `constructor`,
  // `toString`, `__proto__` and friends: `EXT_MAP["constructor"]` is the
  // `Object` FUNCTION, which is never nullish, so a `?? DEFAULT_SPEC` does NOT
  // fire and `const { color, Glyph } = Object` destructures to `undefined` —
  // `<undefined size={30}/>` is a HARD RENDER CRASH of the row, not a wrong
  // icon. `phaseGlyph.tsx:107-122` records this exact crash being observed on
  // `PHASE_GLYPH_MARKS`. Filenames here are model/sandbox-derived, so a file
  // literally named `x.constructor` is reachable input (T-195-03-03).
  if (Object.prototype.hasOwnProperty.call(EXT_MAP, ext)) return EXT_MAP[ext]
  if (mimeType !== undefined && mimeType.startsWith("text/")) return SPEC_TEXT
  return DEFAULT_SPEC
}

/** Options for {@link fileIcon}. Every field defaults to TODAY'S behaviour, so
 *  the shipped chat call site (`OutputFileCard.tsx:83`) cannot move. */
export interface FileIconOptions {
  /** The stacked mono `.EXT` ribbon label. Default `true` (today's shape).
   *  `false` omits that span entirely — the 16px monochrome panel/run glyph. */
  ribbon?: boolean
  /** `"category"` (default) paints the canonical category hex inline.
   *  `"inherit"` omits the inline colour on BOTH the wrapper and the ribbon, so
   *  the caller's `className` token supplies it. That is what lets the panel
   *  keep `text-panel-muted-foreground` (Phase 088-05 AA) and the run page keep
   *  `text-muted-foreground` WITHOUT the page ever naming a panel-scoped token
   *  — `WorkflowRunPage.test.tsx:1428-1429` forbids `--panel-` in page source. */
  tone?: "category" | "inherit"
  /** Merged onto the wrapper span with `cn`. */
  className?: string
  /** When supplied, resolve MIME-FIRST, mirroring the panel's shipped order. */
  mimeType?: string
}

/**
 * Render the per-extension file icon: a category-colored Lucide glyph plus a
 * small mono `.{EXT}` ribbon label.
 *
 * @param filename the file name (model/user-derived — rendered as a parsed
 *   extension label ONLY; never injected as markup)
 * @param sizePx glyph size in px (default 24)
 * @param opts Phase 195 Plan 03 — ADDITIVE options, each defaulting to today's
 *   behaviour. The first two parameters are untouched so every shipped call
 *   site (`OutputFileCard.tsx:83`, all 11 shipped cases) stays byte-unchanged.
 */
export function fileIcon(
  filename: string,
  sizePx: number = 24,
  opts: FileIconOptions = {},
): JSX.Element {
  const { ribbon = true, tone = "category", className, mimeType } = opts
  // Parse the extension defensively — `.pop()` on a name without a "." returns
  // the whole string, so guard on the presence of a dot to detect "no ext".
  const hasDot = filename.includes(".")
  const ext = hasDot ? (filename.split(".").pop() ?? "").toLowerCase() : ""
  const { color, Glyph } = resolveSpec(ext, mimeType)
  // The ribbon label is the ONLY thing derived from the filename, and it is the
  // PARSED extension only (or "FILE") — never the raw filename. Plain text.
  const label = `.${(ext || "FILE").toUpperCase()}`
  // `tone: "inherit"` drops the inline colour so the caller's token class wins.
  const inlineColor = tone === "inherit" ? undefined : color

  return (
    <span
      className={cn("inline-flex flex-col items-center gap-0.5", className)}
      style={inlineColor === undefined ? undefined : { color: inlineColor }}
      aria-hidden="true"
    >
      <Glyph size={sizePx} strokeWidth={1.75} />
      {ribbon && (
        <span
          className="font-mono font-semibold leading-none"
          style={{ fontSize: Math.max(8, Math.round(sizePx / 3)), color: inlineColor }}
        >
          {label}
        </span>
      )}
    </span>
  )
}

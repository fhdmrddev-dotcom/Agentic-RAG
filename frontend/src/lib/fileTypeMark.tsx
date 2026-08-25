/**
 * The ONE ext/mime → OFFICIAL file-type mark map.
 *
 * ⚠ THIS EXISTS BECAUSE THE DOCUMENTS SURFACE WAS DRAWING ITS OWN OFFICE LOGOS BY HAND.
 *   `lib/fileIcons.tsx` shipped inline `<svg>` approximations — a blue page with a hand-set
 *   `W`, a green page with an `X`, a red page with the letters `PDF` — and the project's own
 *   icon convention forbids exactly that: *"hand-drawing or approximating a … logo in
 *   production"*. Worse, the switch had FIVE arms, so `.html`, `.epub`, `.eml`, `.msg`,
 *   `.json`, images and every code file fell through to a BLANK GREY PAGE carrying no mark,
 *   no letter and no colour. Measured 2026-08-25: of the 12 extensions the ingestion
 *   allowlist accepts, only 8 rendered anything at all, and none of the 8 was official.
 *
 * ⚠ THE MARKS ARE THE REAL ONES, SOURCED THE WAY THIS REPO ALREADY SOURCES BRAND MARKS:
 *   `~icons/<set>/<slug>` through `unplugin-icons`, the same seam
 *   `settings/connectionMark.tsx` uses for Slack/Jira/MCP. The set is `vscode-icons`, which
 *   is where the genuine Word / Excel / PowerPoint / Acrobat / Markdown / Outlook marks live.
 *
 * ⚠ A BRAND MARK CARRIES ITS OWN FILLS AND MUST NEVER BE GIVEN A `fill-*` UTILITY. Word's
 *   body alone declares `#41a5ee`, `#2b7cd3` and `#185abd`; a `fill-current` would overwrite
 *   all three and flatten the logo to one colour. This is the inverse of the MCP-mark lesson
 *   recorded in `connectionMark.tsx`, where a body with ZERO fills needed `fill-current` to
 *   be visible at all — the rule is not "always tint" or "never tint", it is *"match the
 *   mark's own body"*.
 *
 * ⚠ TWO TYPES HAVE NO OFFICIAL MARK IN EXISTENCE, AND THEY ARE NAMED RATHER THAN FAKED.
 *   `.csv` is a format, not a product — mapping it to the Excel logo would tell a person
 *   their CSV is an Excel file, which is the small lie this module was written to remove.
 *   `.eml` likewise: RFC-822 is a standard, so it gets a neutral mail mark, while `.msg`
 *   DOES get the Outlook logo because `.msg` genuinely IS Outlook's proprietary format.
 *
 * ⚠ SCOPE — `lib/fileIcon.tsx` IS DELIBERATELY NOT CONVERTED, and this is a decision, not an
 *   omission. That module renders a *monochrome* glyph plus a `.EXT` ribbon and supports
 *   `tone: "inherit"`, which the workspace panel and the run page rely on to paint the glyph
 *   with `text-panel-muted-foreground` — a Phase 088-05 AA decision taken because the light
 *   theme's `--muted-foreground` measured 4.01:1, below the 4.5:1 floor. A full-colour brand
 *   mark cannot honour a contrast token, so converting it would trade an accessibility
 *   guarantee for a logo. RE-OPEN TRIGGER: a design decision that the chat/panel/run file
 *   rows should be full-colour too — at which point the AA question must be answered first,
 *   not discovered.
 */
import type { ComponentType, SVGProps } from "react"

import ExcelMark from "~icons/vscode-icons/file-type-excel"
import HtmlMark from "~icons/vscode-icons/file-type-html"
import ImageMark from "~icons/vscode-icons/file-type-image"
import JsonMark from "~icons/vscode-icons/file-type-json"
import JsMark from "~icons/vscode-icons/file-type-js"
import MailMark from "~icons/vscode-icons/file-type-mailing"
import MarkdownMark from "~icons/vscode-icons/file-type-markdown"
import OutlookMark from "~icons/vscode-icons/file-type-outlook"
import PdfMark from "~icons/vscode-icons/file-type-pdf2"
import PowerpointMark from "~icons/vscode-icons/file-type-powerpoint"
import PythonMark from "~icons/vscode-icons/file-type-python"
import ReactJsMark from "~icons/vscode-icons/file-type-reactjs"
import ReactTsMark from "~icons/vscode-icons/file-type-reactts"
import ShellMark from "~icons/vscode-icons/file-type-shell"
import SqlMark from "~icons/vscode-icons/file-type-sql"
import SvgMark from "~icons/vscode-icons/file-type-svg"
import CssMark from "~icons/vscode-icons/file-type-css"
import TextMark from "~icons/vscode-icons/file-type-text"
import TypescriptMark from "~icons/vscode-icons/file-type-typescript"
import WordMark from "~icons/vscode-icons/file-type-word"
import XmlMark from "~icons/vscode-icons/file-type-xml"
import YamlMark from "~icons/vscode-icons/file-type-yaml"
import ZipMark from "~icons/vscode-icons/file-type-zip"
import EpubMark from "~icons/vscode-icons/file-type-epub"

import { cn } from "@/lib/utils"

type Mark = ComponentType<SVGProps<SVGSVGElement>>

/** The neutral shown when an extension has no mark of its own. NAMED, never `null` —
 *  an unknown file still needs to look like a file. */
const UNKNOWN_MARK: Mark = TextMark

/**
 * ext → official mark. Every value is a real published mark; nothing here is drawn by us.
 *
 * ⚠ READ THROUGH `hasOwnProperty`, NEVER `EXT_MARKS[ext] ?? UNKNOWN_MARK`. This is a plain
 *   object literal, so it inherits `constructor`, `toString` and `__proto__`; those are never
 *   nullish, so a `??` fallback does NOT fire and hands back a FUNCTION that React then tries
 *   to render. `lib/fileIcon.tsx` records this exact crash being observed, and filenames on
 *   this surface are user- and model-derived, so a file named `x.constructor` is real input.
 */
const EXT_MARKS: Record<string, Mark> = {
  // ── documents ────────────────────────────────────────────────────────────
  pdf: PdfMark,
  doc: WordMark,
  docx: WordMark,
  rtf: TextMark,
  txt: TextMark,
  md: MarkdownMark,
  markdown: MarkdownMark,
  epub: EpubMark,
  // ── spreadsheets ─────────────────────────────────────────────────────────
  xls: ExcelMark,
  xlsx: ExcelMark,
  // ⚠ NOT the Excel logo — see the header. A CSV is a format, not a product.
  csv: TextMark,
  // ── slides ───────────────────────────────────────────────────────────────
  ppt: PowerpointMark,
  pptx: PowerpointMark,
  // ── email ────────────────────────────────────────────────────────────────
  // `.msg` IS Outlook's own format, so the Outlook mark is accurate. `.eml` is RFC-822,
  // which belongs to no vendor, so it gets the neutral mail mark instead.
  msg: OutlookMark,
  eml: MailMark,
  // ── images ───────────────────────────────────────────────────────────────
  png: ImageMark,
  jpg: ImageMark,
  jpeg: ImageMark,
  gif: ImageMark,
  webp: ImageMark,
  bmp: ImageMark,
  svg: SvgMark,
  // ── code & data ──────────────────────────────────────────────────────────
  html: HtmlMark,
  htm: HtmlMark,
  css: CssMark,
  json: JsonMark,
  xml: XmlMark,
  yml: YamlMark,
  yaml: YamlMark,
  js: JsMark,
  mjs: JsMark,
  cjs: JsMark,
  jsx: ReactJsMark,
  ts: TypescriptMark,
  tsx: ReactTsMark,
  py: PythonMark,
  sh: ShellMark,
  bash: ShellMark,
  sql: SqlMark,
  zip: ZipMark,
}

const MIME_OOXML_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
const MIME_OOXML_PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
const MIME_OOXML_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

/**
 * Resolve the mark for a parsed extension and an OPTIONAL mime type.
 *
 * MIME-first for the types a browser reports reliably and an extension may be missing for —
 * mirroring the resolution order `lib/fileIcon.tsx` already ships, so the two modules cannot
 * disagree about the same file. The bare `text/` arm is deliberately LAST, after the
 * extension lookup: a `script.py` served as `text/plain` must stay Python.
 */
export function markFor(ext: string, mimeType?: string): Mark {
  if (mimeType !== undefined) {
    if (ext === "docx" || mimeType === MIME_OOXML_DOCX) return WordMark
    if (ext === "xlsx" || mimeType === MIME_OOXML_XLSX) return ExcelMark
    if (ext === "pptx" || mimeType === MIME_OOXML_PPTX) return PowerpointMark
    if (mimeType === "application/pdf") return PdfMark
    if (mimeType === "application/epub+zip") return EpubMark
    if (mimeType === "text/markdown") return MarkdownMark
    if (mimeType === "text/html") return HtmlMark
    if (mimeType === "message/rfc822") return MailMark
    if (mimeType === "application/vnd.ms-outlook" || mimeType === "application/x-msg") {
      return OutlookMark
    }
    if (mimeType === "application/vnd.ms-excel") return ExcelMark
    if (mimeType === "application/json") return JsonMark
    if (mimeType.startsWith("image/")) return mimeType === "image/svg+xml" ? SvgMark : ImageMark
  }
  if (Object.prototype.hasOwnProperty.call(EXT_MARKS, ext)) return EXT_MARKS[ext]
  if (mimeType !== undefined && mimeType.startsWith("text/")) return TextMark
  return UNKNOWN_MARK
}

/** Parse a trailing extension. A name with no dot has NO extension — `.pop()` would
 *  otherwise return the whole filename and match nothing, or worse, match by accident. */
export function extensionOf(filename: string): string {
  if (!filename.includes(".")) return ""
  return (filename.split(".").pop() ?? "").toLowerCase()
}

export interface FileTypeMarkProps {
  /** The file name. User/model-derived — used ONLY to parse an extension; never rendered. */
  filename: string
  /** Optional wire mime type; resolved first for the types listed in {@link markFor}. */
  mimeType?: string
  /** Merged onto the svg. ⚠ MUST NOT contain a `fill-*` utility — see the module header. */
  className?: string
}

/**
 * Render the official mark for a file.
 *
 * `aria-hidden` because every call site already renders the filename as text beside it — a
 * second announcement of the same fact is noise to a screen reader, not information.
 */
export function FileTypeMark({ filename, mimeType, className }: FileTypeMarkProps) {
  const MarkComponent = markFor(extensionOf(filename), mimeType)
  return <MarkComponent className={cn("h-5 w-5 shrink-0", className)} aria-hidden="true" />
}

/**
 * Phase 154 Plan 01 (LANG-01 / D-02, D-02a) — the single-source term-map.
 *
 * ONE glossary mapping each display concern → `{ plain, helper?, technical }`.
 * Every plain-language relabel in the app routes through this map (via
 * `usePlainLabel` / `<PlainLabel>`) so nothing drifts and future surfaces inherit
 * the two-audience contract for free (the SEED-085 generalization).
 *
 *   plain     — the new DEFAULT copy a non-technical user reads.
 *   helper    — an optional one-line plain-English explanation (the ⓘ affordance).
 *   technical — TODAY's shipped string, VERBATIM (the reveal shows exactly the
 *               current wording when the toggle is ON).
 *
 * ⚠️ CONTRACT (D-02a / Pitfall 15): these are DISPLAY strings ONLY. The keys are
 * display keys (e.g. "ingest.chunking"), NOT the backend's `"chunking"` status
 * enum; the `technical:` side is a label, NOT a wire value. NOTHING in this file
 * is ever posted to an API, stored, or used as an audit-action string — renaming
 * an enum/field/audit key is the cardinal LANG-01 failure and never happens here.
 *
 * Direction-of-change note: most mapped surfaces predate the two-audience
 * contract, so their CURRENTLY-SHOWN string is the technical term. This phase
 * flips the default to plain; the current string becomes the `technical` reveal.
 */
import { useTechnicalNamesOptional } from "@/providers/TechnicalNamesProvider"

export interface Term {
  /** Plain-language default copy (shown when the reveal is OFF). */
  plain: string
  /** Optional one-line plain-English helper (the ⓘ affordance). */
  helper?: string
  /** Today's shipped string, verbatim — shown when the reveal is ON. */
  technical: string
  /**
   * Optional MICRO-LABEL for surfaces too small to carry `plain` (Phase 217.1 / D-217.1-19).
   *
   * ⚠ ADDED BECAUSE A SURFACE WENT BLANK RATHER THAN SHORT. `IngestionStrip` renders six
   * ~24px-wide segments; `plain` ("Splitting into sections") does not fit, so the strip made
   * the label `sr-only` and shipped six empty boxes — a component whose whole job is to name
   * a stage, naming none of them. The honest fix is a SHORTER WORD, never a hidden one.
   *
   * ⛔ It is NOT a third audience. `plain` and `technical` are the two-audience contract and
   * the ⌥ reveal still swaps those; `short` is the same PLAIN voice at a smaller size, so a
   * surface that cannot fit a sentence still says a true word. Populated today only for the
   * six `ingest.*` stages — the one surface that measured the need.
   */
  short?: string
}

export const TERM_MAP = {
  // ── Surface A — document ingestion status badge (top priority; every uploader
  //    sees it, and it currently shows RAW technical step names by default). ──
  // ⚠ ALL SIX CARRY `short` — the ingestion strip renders it as VISIBLE TEXT, so a missing
  // one is a blank segment (D-217.1-19). ⛔ Do not add a seventh vocabulary for these words:
  // `ingestionStages.ts` routes every stage label through THIS map, deliberately.
  "ingest.extracting": {
    plain: "Reading the file",
    helper: "Pulling the text out of your document.",
    technical: "Extracting",
    short: "Read",
  },
  "ingest.extracting_tables": {
    plain: "Reading tables",
    helper: "Pulling structured tables out.",
    technical: "Extracting tables",
    short: "Tables",
  },
  "ingest.extracting_images": {
    plain: "Reading images",
    helper: "Pulling images and figures out.",
    technical: "Extracting images",
    short: "Images",
  },
  "ingest.chunking": {
    plain: "Splitting into sections",
    helper: "Breaking the text into searchable pieces.",
    technical: "Chunking",
    short: "Split",
  },
  "ingest.embedding": {
    plain: "Making it searchable",
    helper: "Building the search index for this document.",
    technical: "Embedding",
    short: "Index",
  },
  "ingest.metadata": {
    plain: "Reading document details",
    helper: "Detecting title, author, dates, and similar facts.",
    technical: "Extracting metadata",
    short: "Label",
  },
  "status.pending": {
    plain: "Waiting",
    helper: "Queued, not started yet.",
    technical: "pending",
  },
  "status.processing": {
    plain: "Working…",
    helper: "Being read and indexed now.",
    technical: "processing",
  },
  "status.completed": {
    plain: "Ready",
    helper: "Indexed and searchable.",
    technical: "completed",
  },
  "status.failed": {
    plain: "Couldn't process",
    helper: "Something went wrong reading this file.",
    technical: "failed",
  },
  "status.paused": {
    plain: "Paused",
    helper: "Provider rate limited — waiting to resume automatically.",
    technical: "paused",
  },

  // ── Surface B — document detail / metadata (mostly plain from Phase 112). ──
  "doc.metadata_section": {
    plain: "Details",
    helper: "Facts about this document.",
    technical: "Metadata",
  },

  // ── Surface C — chat composer mode (labels already plain; the technical side
  //    is the enum wording, so plain === technical here — helper carries the
  //    guidance). The underlying "default"/"explorer" enum is NEVER touched. ──
  "agentmode.default": {
    plain: "General",
    helper: "Quick, direct answers.",
    technical: "General",
  },
  "agentmode.explorer": {
    plain: "Explorer",
    helper: "Digs deeper — searches your documents across multiple steps.",
    technical: "Explorer",
  },

  // ── Surface D — Settings user-facing labels (deep expert-config knobs stay
  //    technical-audience and are intentionally NOT mapped — Pitfall 4). ──
  "settings.tab.retrieval": {
    plain: "Search",
    helper: "How the app searches your documents.",
    technical: "Search & Retrieval",
  },
  "settings.temperature": {
    plain: "Creativity",
    helper: "Higher = more varied; lower = more focused.",
    technical: "temperature",
  },
  "settings.context_window": {
    plain: "How much it reads at once",
    helper: "The most text the model considers per reply.",
    technical: "context window max tokens",
  },
  "settings.embedding": {
    plain: "Search index",
    helper: "The model that makes your documents searchable.",
    technical: "Embedding model",
  },
  "settings.reembed": {
    plain: "Rebuild the search index",
    helper: "Re-index all documents with a new model.",
    technical: "re-embed",
  },
} as const satisfies Record<string, Term>

export type TermKey = keyof typeof TERM_MAP

/**
 * The reveal-aware label accessor. Reads the shared reveal context via the
 * NON-throwing optional accessor so a leaf can still render outside the provider
 * (falls back to plain). Returns the technical string when the reveal is ON, the
 * plain string when OFF/absent, and — for an unmapped key — the raw key as an
 * honest passthrough (the AuditTab `platformLabel` fallback-to-raw idiom), never
 * a throw.
 */
export function usePlainLabel(key: TermKey): string {
  const ctx = useTechnicalNamesOptional()
  const showTechnical = ctx?.showTechnical ?? false
  const term = TERM_MAP[key]
  if (!term) return String(key)
  return showTechnical ? term.technical : term.plain
}

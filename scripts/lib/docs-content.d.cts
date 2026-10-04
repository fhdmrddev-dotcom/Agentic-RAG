// Type declarations for scripts/lib/docs-content.cjs (Phase 276). The .cjs is plain JavaScript so
// the coverage gate runs with bare `node`; this file lets the Vite plugin and the frontend tests
// import it with types. Keep it in step with the .cjs in the SAME commit.

export type Audience = "user" | "admin" | "operator" | "developer"
export type Status = "written" | "stub"
export type ReleaseTag = "shipped" | "v4.5"

export interface Heading {
  id: string
  text: string
}

export interface ParsedPage {
  slug: string
  title: string
  section: string
  audience: Audience
  status: Status
  release: ReleaseTag
  covers: string[]
  unreleased: string[]
  summary: string | null
  nearest: string | null
  video: string | null
  reviewed: string | null
  updated: string | null
  headings: Heading[]
  readMinutes: number
  /** POSIX path relative to docs/public, e.g. "use/chat.md" */
  file: string
  /** Markdown body without the frontmatter block */
  body: string
}

export type FindingCode = "bad-frontmatter" | "unlisted-page" | "missing-page" | "unreadable"

export interface Finding {
  code: FindingCode
  file: string
  key: string | null
  message: string
}

export interface SectionGroup {
  title: string
  slugs: string[]
}

export interface Section {
  id: string
  title: string
  purpose: string
  groups?: SectionGroup[]
  slugs: string[]
}

export interface Chapter {
  n: number
  title: string
  range: string
}

export interface Release {
  version: string
  name: string
  date: string | null
  released: boolean
  chapter: Chapter
  oneLiner: string
  shipped: string[]
  note: string | null
}

export interface SearchDoc {
  id: string
  title: string
  headings: string
  summary: string
  body: string
  slug: string
  section: string
  status: Status
  release: string
  url: string
}

export interface LoadResult {
  root: string
  scanned: number
  pages: ParsedPage[]
  findings: Finding[]
  skipped: Record<string, number>
  readError?: string
}

export interface CodeKeys {
  nav: string[]
  view: string[]
  tool: string[]
  step: string[]
  check: string[]
  router: string[]
  settingsTab: string[]
}

export interface RepoIO {
  readFile?: (rel: string) => string
  listDir?: (rel: string) => string[]
}

export declare const AUDIENCES: Audience[]
export declare const STATUSES: Status[]
export declare const RELEASES: ReleaseTag[]
export declare const CODE_KEY_PREFIXES: string[]
export declare const MIN_HISTORY_FILES: number
export declare const MIN_NAV: number
export declare const MIN_VIEW: number
export declare const MIN_TOOL: number
export declare const MIN_STEP: number
export declare const MIN_CHECK: number
export declare const MIN_ROUTER: number
export declare const MIN_SETTINGS_TAB: number
export declare const SEARCH_BODY_CHARS: number
export declare const SOURCES: Record<string, string>

export declare function parsePage(text: string, relPath: string): { page: ParsedPage | null; body: string; findings: Finding[] }
export declare function loadAllPages(root: string): LoadResult
export declare function readSections(sectionsPath: string): Section[]
export declare function validatePages(pages: ParsedPage[], sections: Section[]): Finding[]
export declare function formatFinding(f: Finding): string
export declare function headingId(text: string): string
export declare function markdownToText(md: string): string
export declare function listHistoryFiles(historyDir: string): string[]
export declare function parseChapters(historyDir: string): Chapter[]
export declare function parseHistory(historyDir: string, overridesPath?: string): Release[]
export declare function buildSearchDocs(
  pages: ParsedPage[],
  changelog: Release[],
  sections: Section[],
  bodies?: Record<string, string>,
): SearchDoc[]
export declare function extractCodeKeys(repoRoot: string, io?: RepoIO): CodeKeys
export declare function readRepoFile(repoRoot: string, rel: string): string
export declare function findRepoRoot(start?: string): string

/** Phase 276-05 — the coverage inventory reader (shared by the scaffolder and the coverage gate). */
export interface InventoryRow {
  id: string
  surface: string
  status: string
  audience: string
  pages: string[]
}
export type InventoryStatusKind = "v4.5" | "locked" | "not-built" | "gated" | "flag" | "internal" | "shipped"
export declare const INVENTORY_PATH: string
export declare function markdownTables(text: string): { header: string[]; rows: string[][] }[]
export declare function parseInventory(text: string): InventoryRow[]
export declare function inventoryStatusKind(status: string): InventoryStatusKind

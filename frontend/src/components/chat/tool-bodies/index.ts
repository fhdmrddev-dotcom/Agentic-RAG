// Phase 075.7 Plan 01 (D-02 atomic extraction): per-tool body registry.
// Replaces the inline `renderResult` dispatch at ToolCallPanel.tsx:411-423
// and the per-tool branch inside `resultSummary` at L146-173. Each *Body.tsx
// owns its own result rendering AND its own `summarize(tc)` derivation
// (D-03). Plans 02/03 consume this registry without modification.

import LsBody, { summarize as lsSummarize } from "./LsBody"
import TreeBody, { summarize as treeSummarize } from "./TreeBody"
import GrepBody, { summarize as grepSummarize } from "./GrepBody"
import GlobBody, { summarize as globSummarize } from "./GlobBody"
import ReadDocumentBody, { summarize as readDocumentSummarize } from "./ReadDocumentBody"
import SearchDocumentsBody, { summarize as searchDocumentsSummarize } from "./SearchDocumentsBody"
import QueryDocumentsBody, { summarize as queryDocumentsSummarize } from "./QueryDocumentsBody"
import WebSearchBody, { summarize as webSearchSummarize } from "./WebSearchBody"
import GenericBody, { summarize as genericSummarize } from "./GenericBody"
import ExecuteCodeBody, { summarize as executeCodeSummarize } from "./ExecuteCodeBody"
import ShowArtifactBody, { summarize as showArtifactSummarize } from "./ShowArtifactBody"
import type { ToolCall } from "@/types"

/**
 * Phase 273-05 (SC#2 · L-1 / L-2, OV-273-04) — THE ONE HOME OF ARGS VISIBILITY in the rail.
 *
 * - `livePanel`: tools whose live args panel (fed by `tool_args_progress.code_so_far`, the raw
 *   cumulative args JSON) renders header-only. Read by `ToolCallPanel`.
 * - `paramsBlock`: tools whose "Show parameters" block never renders. Read by `ToolCallDetails`.
 *
 * `show_artifact`'s args ARE the spec (columns + up to 500 rows), so it is in both. `execute_code`
 * keeps today's parameters block (it renders for every done call) and joins only `livePanel`,
 * which is exactly its pre-273 `hideBody` behaviour. Both readers import this; neither re-types it.
 */
export const ARGS_HIDDEN = {
  livePanel: new Set<string>(["execute_code", "show_artifact"]),
  paramsBlock: new Set<string>(["show_artifact"]),
} as const

export {
  LsBody,
  TreeBody,
  GrepBody,
  GlobBody,
  ReadDocumentBody,
  SearchDocumentsBody,
  QueryDocumentsBody,
  WebSearchBody,
  GenericBody,
  ExecuteCodeBody,
  ShowArtifactBody,
}

export const TOOL_BODIES = {
  ls: LsBody,
  tree: TreeBody,
  grep: GrepBody,
  glob: GlobBody,
  read_document: ReadDocumentBody,
  search_documents: SearchDocumentsBody,
  query_documents: QueryDocumentsBody,
  web_search: WebSearchBody,
  execute_code: ExecuteCodeBody,
  show_artifact: ShowArtifactBody,
} as const

export const TOOL_SUMMARIES: Record<string, (tc: ToolCall) => string> = {
  ls: lsSummarize,
  tree: treeSummarize,
  grep: grepSummarize,
  glob: globSummarize,
  read_document: readDocumentSummarize,
  search_documents: searchDocumentsSummarize,
  query_documents: queryDocumentsSummarize,
  web_search: webSearchSummarize,
  execute_code: executeCodeSummarize,
  show_artifact: showArtifactSummarize,
}

export function summarizeToolCall(tc: ToolCall): string {
  const fn = TOOL_SUMMARIES[tc.name]
  return fn ? fn(tc) : genericSummarize(tc)
}

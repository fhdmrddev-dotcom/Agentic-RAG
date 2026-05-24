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
import type { ToolCall } from "@/types"

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
}

export function summarizeToolCall(tc: ToolCall): string {
  const fn = TOOL_SUMMARIES[tc.name]
  return fn ? fn(tc) : genericSummarize(tc)
}

# Phase 088 — Deferred / Out-of-Scope Items

Logged by the executor per the SCOPE BOUNDARY rule (only auto-fix issues directly
caused by the current task's changes; log unrelated pre-existing failures here).

## 088-01 (a11y + vitest-axe gate)

### Pre-existing `tsc -b` type errors (NOT caused by 088-01)

Discovered while running `npx tsc -b` as a sanity check after Task 2. None of these
are in files this plan touched (the plan edited only `index.css`, `setupTests.ts`,
`TodosSection.tsx`, `VersionDiff.tsx`, `FilesSection.tsx`, and the 8 panel test files
— all of which are tsc-clean). Vitest transpiles with esbuild (not tsc), so these do
not block the test suite (the actual plan gate). Left untouched — out of scope for an
a11y phase.

Affected files (pre-existing drift):
- `src/__tests__/components/FolderNode.test.tsx` — `FolderNodeProps` missing `currentUserId`/`onToggleGlobal` (test fixtures lag the component props)
- `src/__tests__/components/FolderTree.test.tsx` — same `FolderTreeProps` drift
- `src/__tests__/components/IngestionPage.test.tsx` — `Cannot find name 'beforeEach'` (missing import)
- `src/__tests__/hooks/useDocuments.test.ts` — return-type mismatch (`isDuplicate` vs `void`)
- `src/__tests__/hooks/useFolders.test.ts` — unused `result` (TS6133)
- `src/__tests__/hooks/useMessages.test.ts` — `isStreaming` not in `StreamsState`; arg-count drift
- `src/components/chat/MessageSkeleton.tsx` — `Cannot find namespace 'JSX'`
- `src/components/ingestion/DocumentList.tsx` — unused `currentVersionNumber` (TS6133)

Suggested routing: a dedicated v2.8 test/type-hygiene sweep (not a milestone-close gate item).

## 088-04 (SEED-034 fold-gate baseline run)

### Google secondary-model 404 — `gemini-v4p1s-rev24-ajax-sentinel` (NOT caused by 088-04)

During the Task-1 baseline eval, ALL FOUR Google `gemini-3.5-flash` cells terminated with
`run_status=failed`. DB evidence (`runs.error`) shows the run STARTS correctly on
`gemini-3.5-flash` (it emits real `search_documents`/`query_documents` tool calls) but a
LATER iteration crashes with:

```
ClientError: 404 NOT_FOUND. {'error': {'code': 404, 'message':
'Model not found: models/gemini-v4p1s-rev24-ajax-sentinel', 'status': 'NOT_FOUND'}}
```

`gemini-v4p1s-rev24-ajax-sentinel` is a non-existent / placeholder model name being sent on a
SECONDARY call (consistent with the known title-generation / secondary-model routing bug —
memory `project_title_gen_deepseek_moonshot_broken`: "title gen broken on DeepSeek/Moonshot
(sends wrong model name)"). This is a pre-existing local-env config/routing artifact, NOT
introduced by 088-04 (which only appended two entries to the eval PROVIDERS list — Google was
already present). It CONFOUNDS the Google axis of the fold-gate baseline: Google's primary-model
tool selection cannot be cleanly measured while the run crashes on an unrelated 404.

Impact on the fold-gate: Google's `factual-doc-search` still shows `invoked=PASS` (search_documents
fired before the crash); its multi-tool/task/ask_user rows are FAIL-but-confounded (the run died
before the tool sequence could complete). The fold-gate decision does NOT rely on Google —
the SEED-034 failing-row evidence is reproduced cleanly on `completed` runs from the other providers.

Suggested routing: investigate the secondary/title-gen model-name routing for Google (and re-check
DeepSeek/Moonshot per the same memory) in v2.8 — out of scope for the 088 close-out fold-gate.
Do NOT fix in 088-04.

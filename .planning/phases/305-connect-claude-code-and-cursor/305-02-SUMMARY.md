---
phase: 305-connect-claude-code-and-cursor
plan: 02
subsystem: mcp-read-tools
tags: [mcp, read-tools, narrowing, result-hygiene, document-address]
requires:
  - "305-01: app/mcp package (edge, server, dispatch, empty ToolSpec registry), unit + live harnesses"
  - "304: services/acting_member_reads (narrowed reads on the acting connection), mcp_tool_catalogue labels"
provides:
  - "search_knowledge_base / list_documents / read_document registered on /mcp (static specs, READ_ONLY, Pydantic in/out schemas)"
  - "app/mcp/results.py: arg/result models, RedactableText marker (305-04 walks by it), cursors, 8,000-char chunker, doc_link, defang, render"
  - "app/mcp/read_tools.py: handlers returning a model or a sentence (the 305-04 guard slot sits between handler and render)"
  - "dispatch render stage: sentence -> isError; model -> validated structuredContent + text rendered from the model"
  - "acting_member_reads.list_documents(folder_id=, root_only=); search builds its client off the loop (IN-03)"
  - "/app/library/<uuid> document address + DocumentCantBeOpened in-page refusal"
affects: [305-03, 305-04]
tech-stack:
  added: []
  patterns:
    - "handler returns a result model or a refusal sentence; dispatch renders (never a CallToolResult from a handler)"
    - "text fields typed RedactableText = Annotated[str, REDACTABLE]"
    - "live MCP suites drive register_mcp + mcp_lifespan in-process over httpx.ASGITransport with a real minted key"
key-files:
  created:
    - backend/app/mcp/results.py
    - backend/app/mcp/read_tools.py
    - backend/tests/unit/test_305_paging_chunking.py
    - backend/tests/unit/test_305_search_shape.py
    - backend/tests/unit/test_305_tool_defs.py
    - backend/tests/integration/phase305_mcp_client.py
    - backend/tests/integration/test_305_tools_live.py
    - backend/tests/integration/test_305_narrowed_tools_live.py
    - frontend/src/components/library/DocumentCantBeOpened.tsx
    - frontend/src/components/library/__tests__/DocumentCantBeOpened.test.tsx
  modified:
    - backend/app/services/acting_member_reads.py
    - backend/tests/unit/test_304_acting_reads_fence.py
    - backend/app/mcp/tools.py
    - backend/app/mcp/dispatch.py
    - backend/tests/integration/test_305_two_worker_stateless.py
    - frontend/src/lib/appRoutes.ts
    - frontend/src/hooks/useAppNavigation.ts
    - frontend/src/lib/citationNav.tsx
    - frontend/src/App.tsx
    - frontend/src/hooks/useLibraryDocuments.ts
    - frontend/src/pages/LibraryPage.tsx
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
key-decisions:
  - "The document address is an EntityLink field (entityLink.document), not a target kind: LinkGate resolves every non-null target through the link resolver and D-52 rules out a document resolver kind"
  - "The /app/library/<uuid> arrival records the pending document WITHOUT navigating (UI-SPEC Surface 4: the address stays as opened while the panel shows it); the plan text said navigate('documents'), which would push /app/library and drop the address"
  - "A document address is never lastPlace (Stay never returns to it)"
  - "list_documents takes an optional limit (1..100, default 50); a cursor that does not belong to the listing is refused BEFORE visibility is consulted, so the refusal says nothing about the folder"
  - "A readable document with no stored text answers NO_TEXT_SENTENCE as isError; it is only ever said about a document the key can see"
  - "Live tool suites run in-process on register_mcp + mcp_lifespan (real edge, resolver, server, dispatch, reads) rather than app.main.app, whose lifespan starts loops that claim shared local-DB work; the full app is proven by the spawned two-worker suite calling list_documents"
requirements-completed: [MCP-02, MCP-03, MCP-07]
duration: "~3 h"
completed: 2026-10-31
---

# Phase 305 Plan 02: The three read tools and the document address Summary

**`search_knowledge_base`, `list_documents` and `read_document` are live on `/mcp`: thin wrappers over 304's narrowed reads with bounded arguments, 8,000-character validated-cursor reads, delimited and defanged passages carrying title / citation / "Open in Syrel" link / origin, one byte-identical refusal for every unavailable document, and per-tool narrowing proven at `tools/call`; plus the `/app/library/<uuid>` address that opens the document panel for a member and shows one in-page "This document can't be opened" notice to anyone else.**

## Tasks and commits

| # | Task | Commits |
|---|---|---|
| 1 | Reads extension (folder_id, IN-03) + pure result layer | `2b39a574f` (RED) · `c7205b577` |
| 2 | The three tools, render stage, identical refusal, narrowing live | `182585e7d` (RED) · `944003e32` |
| 3 | Document address, in-page refusal, bookkeeping | `eb0a878c3` (RED) · `f97986517` · `baab1631d` (count-gate pins) |

## How each RED was driven

- Task 1: both new suites failed on `cannot import name 'results' from 'app.mcp'`; the rewritten 304 fence arm failed against the inline `get_service_role_supabase(...)` call.
- Task 2: unit and live suites failed on `cannot import name 'read_tools'`; the spawned two-worker suite failed on the real server with `{'error': {'code': -32602, 'message': 'Unknown tool: list_documents'}}`.
- Task 3: 14 of the new frontend arms failed (route not parsed, no `entityLink.document`, no `leaveDocumentAddress`, no `selectedDocRefused`, missing component). The "document address is never lastPlace" arm passed vacuously in RED (the address was not-found then), so it was driven RED separately after implementation by deleting the one `!("documentId" in parsed)` condition: it failed, and passed again once restored.

## Measured

- **Largest local document:** 266,924 characters reads in **36** `read_document` calls (pieces 3,102..7,998 chars); 315 latest documents carry text. Research estimated about 34.
- **D-16 body** (nine cases: missing, a co-member's private document, other org, out of a narrowed key's scope, superseded, archived, malformed, a tampered cursor, another document's cursor), byte-identical: `{"jsonrpc":"2.0","id":7,"result":{"content":[{"text":"No document with that id is available to this key.","type":"text"}],"isError":true}}`
- **Two workers:** `POST /mcp` served by worker PIDs `[145392, 165148]` (86 responses over 26 fresh connections); `tools/call list_documents` (on `/mcp/`) served by both PIDs `[145392, 165148]`, every result `isError: false` with `structuredContent`.

## Gate verdicts (verbatim)

- Backend baseline: `[GATE PASSED] Backend unit baseline satisfied (failed: 70 <= 71, errors: 0).` Summary: `70 failed, 11121 passed, 1 skipped, 2 xfailed, 2 xpassed, 60 warnings in 542.54s (0:09:02)`. 70 = the measured base; no new failure.
- Vitest (repo root, `GSD_VITEST_MAX_WORKERS=2`), after the pins commit: `count gate OK — 591/591 pinned files present, no per-file decrease, 0 failing.` (total 13656, pinned 12616). Before the pins: `count gate OK — 589/589 pinned files present, no per-file decrease, 0 failing.` (total 13633).
- tsc (`npx tsc -p tsconfig.app.json --noEmit`): **61 errors = base 61**. The first run read 65; the 4 new ones were all `TS2741 Property 'document' is missing` in four test fixtures that build an `EntityLink` literal (ExpertCatalogPage.link, AppViewSwitch.addressStates, LinkGate, useThreadAddress). Each gained `document: null`. No error in any file this plan touched except LibraryPage.tsx's two pre-existing TS6133 (`TabsList`, `TabsTrigger`, line 59).
- `node scripts/check-hot-file-ledger.cjs .planning/phases/305-connect-claude-code-and-cursor`: `ledger gate OK — every watched file has a row.`
- `node scripts/check-claude-md-size.cjs`: `CLAUDE.md 106553 chars 71% of limit headroom 43447 [OK]` / `claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.`
- Targeted backend set (all test_305 units, test_259 (still 30), test_304 fence, test_300 clean image, test_304 tool catalogue, test_305_refusals_live, test_304_narrowed_key_live, test_304_two_org_parity_live): **255 passed, no skips**. Live tool + narrowed suites: **15 passed**; two-worker: **passed**.
- G-5 budgets: `git diff bca6c3e82 --numstat -- frontend/src/App.tsx` = `1 1`; LibraryPage `^+[^+]` = **2** (one import, one mount); LinkGate.tsx untouched.

## Deviations from Plan

1. **[Decision, UI-SPEC over plan text] The arrival does not call `navigate("documents")`.** The plan's behaviour line said the arrival goes through `openDocument` (which navigates). Measured: `onNavigate("documents")` on `/app/library/<id>` PUSHES `/app/library`, because `isOnScreen` compares the formatted route. That would break UI-SPEC Surface 4 ("while the panel shows that document the address stays as opened, so a reload reopens it"). The provider sets the pending document directly. Seeing no document address forgets the last id, so Back onto the address opens it again.
2. **[Rule 2] A document address is excluded from `lastPlace`.** Without this, a later Stay (`leave()` with no route) could return to the refused document address. One condition in useAppNavigation.ts, driven RED.
3. **[Rule 1] The 299 appRoutes pin `"/app/library/" + THREAD` is not-found was retired deliberately.** The reason is written in the test body. Two library rows replace it: a malformed id and an extra segment, both still not-found.
4. **[Rule 3] Four EntityLink test fixtures gained `document: null`** (tsc TS2741). These are test-only edits.
5. **[Rule 2] Extra frontend arms in files the plan did not list:** `src/__tests__/hooks/useLibraryDocuments.test.ts` (+3) and `src/pages/__tests__/LibraryPage.states284.test.tsx` (+3). These are where the hook and page behaviours are actually tested. Their pins were raised with the rest.
6. **[Plan adjustment] `citationNav.test.tsx` had no count-gate pin.** It got a first pin (18) plus a FILE-LEVEL target, as `DocumentCantBeOpened.test.tsx` did (5). The plan said "raise".
7. **[Plan adjustment] `ListArgs.limit` (1..100, default 50) was added**, so "page size default 50, max 100" is reachable. `BAD_CURSOR_SENTENCE` was added for a listing cursor that belongs to another folder. It is checked before visibility.
8. **[Rule 1, test bugs found in GREEN]** test_305_tool_defs used TestClient's default `testserver` host, which got a 421 from transport security. It now uses `base_url=h.BASE`, as the 305-01 suites do. The live suites first treated `NO_TEXT_SENTENCE` (seeded documents carry no `full_markdown`) as "not readable". That sentence is only said about a document the key can see, so `_readable` now distinguishes it from `NOT_AVAILABLE_SENTENCE`.
9. **[Process] One live suite ran without the lock.** `test_304_narrowed_key_live` (Task 1 regression check) ran before the lock was taken. Nobody held the lock at that moment (no lock file present), and the suite cleans up its own world. Every later live and baseline run held the lock, and it is released.
10. **[Observation] `LibraryPage.initialTab.test.tsx` red twice under a broad parallel run,** then green alone (15/15) and green in both full count-gate runs. Byte-unchanged by this plan.

## Threat surface

No new surface beyond the plan's register. T-305-04 (byte-identical refusal across nine cases), T-305-05 (grant re-checked at call; one narrowed arm per tool), T-305-08 (marked blocks, neutralised markers, defang), T-305-09 (byte-equal definitions across two keys; fixture strings absent), T-305-18 (cursor forgery = same bytes), T-305-21 (package fence green with results.py + read_tools.py; no SQL or service role in app/mcp), T-305-26 (kind-only notice; LinkGate untouched), T-305-27 (8,000 chars, page ≤ 100, search ≤ 20): all implemented and tested.

## Known Stubs

None. The outbound-guard slot in `dispatch.py` is a marked comment for 305-04, not a stub. Results flow unredacted until 305-04 lands, as planned.

## Hot-file notes

`appRoutes.ts`, `useAppNavigation.ts` and `useLibraryDocuments.ts` **now FIRE** (3 phases each). They were added to the CLAUDE.md FIRING table, with named seams in their ledger sections. `App.tsx` and `LibraryPage.tsx` took exactly their budgeted edits. `citationNav.tsx` got its first section in the same commit as its first edit.

## Owed

- **G-4 row 1 (D-42) at phase verification:** a real `claude` CLI session lists the three tools and searches. The link must open the document in Chrome, and a non-member must see "This document can't be opened".
- `graphify update .` in the main checkout after merge.

## TDD Gate Compliance

RED before GREEN for every task: `2b39a574f` -> `c7205b577`, `182585e7d` -> `944003e32`, `eb0a878c3` -> `f97986517`.

## Self-Check: PASSED

- Files exist: backend/app/mcp/results.py, backend/app/mcp/read_tools.py, frontend/src/components/library/DocumentCantBeOpened.tsx and every test file listed above.
- Commits present: 2b39a574f, c7205b577, 182585e7d, 944003e32, eb0a878c3, f97986517, baab1631d.
- The local-DB lock is released, and no spawned uvicorn remains (the live harness kills the whole process tree).

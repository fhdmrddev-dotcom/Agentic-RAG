---
phase: 153-inline-citations
verified: 2026-07-15T08:58:53Z
status: human_needed
score: 4/4 roadmap truths verified (code-level); live SC#10 4-axis UAT pending
overrides_applied: 0
human_verification:
  - test: "Cross-provider markers + graceful degradation — one representative model each for OpenAI, Anthropic, Google, OpenRouter"
    expected: "Markers render on native providers that comply; a model that emits none degrades to footer-only (D-06/D-07) — no provider ends up worse than today. OpenRouter axis may be blocked by external BUG-260714-02 (operator-accept precedent from Phase 152)."
    why_human: "Model-emission variance (whether/how a live model places [n] markers) is only observable against a running backend + live provider APIs — cannot be unit-tested end-to-end."
  - test: "Multi-tool grounding — one prompt exercising search_documents (chunk) + fetch_document_file/full-doc read in the same answer"
    expected: "Both chunk and full-doc citations produce markers/footer rows; the full-doc peek shows 'Full document — no single passage' + Open document (no snippet/score, D-10)."
    why_human: "Needs a real retrieval mix from a live agent run; the shape is unit-tested per-component but the end-to-end mix is not."
  - test: "Parallel-thread isolation — Thread A streaming (calm, unmarked) while Thread B accepts a new prompt"
    expected: "Markers attach to Thread A only on ITS settle, with zero bleed into Thread B."
    why_human: "Concurrent SSE streams across two threads cannot be exercised by the unit/component test suite."
  - test: "Long-message settle reconcile — ≥50 prior messages or a ≥5KB prompt"
    expected: "The terminal reconcile still swaps live→normalized content correctly; no marker flash/drift on a long thread."
    why_human: "Requires a live long-running thread and the real StreamsProvider reconcile timing."
  - test: "General-knowledge non-regression — a no-retrieval turn"
    expected: "Renders nothing extra: no footer, no markers, no absence-ⓘ — byte-identical to today's non-cited turn."
    why_human: "Confirms the D-12/D-14 byte-identical guarantee holds against a live model response, not just the unit-tested apply_citation_instruction no-op path."
  - test: "Set-membership integrity (DB corroboration) — via psycopg2 :54322"
    expected: "The persisted assistant message content contains no [n] whose index exceeds that run's source_refs/citations count."
    why_human: "Requires inspecting a live-persisted row after a real retrieval run; the backend strip is unit-tested in isolation but not corroborated against a live persisted row this phase."
---

# Phase 153: Inline Citations Verification Report

**Phase Goal:** Chat answers show per-claim citation markers tied to what the agent actually retrieved this run, with click-through to the source passage, and claims without a marker read as general knowledge (the converged industry pattern).
**Verified:** 2026-07-15T08:58:53Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

All codebase-level must-haves are implemented, wired, and test-covered. The phase's own SUMMARY.md files and STATE.md correctly flag that CITE-01 stays open at the requirement level until the live SC#10 4-axis cross-provider UAT (authored in `153-VALIDATION.md`) runs — this verification independently confirms that framing is accurate: the honesty mechanism (set-membership strip/renumber, dual-channel injection, owned marker nodes, click-through, absence signal, always-on footer floor) is real and correctly built, but the "renders consistently across all providers" claim (SC#10, roadmap SC#4) cannot be closed without a live model run. No codebase gap was found; the remaining work is manual verification, not code changes.

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A grounded claim shows an inline citation marker keyed to the run's ACTUAL retrieval set (set-membership, never post-hoc LLM re-ask) | ✓ VERIFIED (code) | `citation_markers.py:79-92` (`_transform_prose` keeps `[n]` iff `1 <= n <= k`, drops the rest) wired at the settle point `agent_loop.py:2800-2808` (`unique_citations[:] = _deduplicate_citations(...)` then `full_content = normalize_citation_markers(full_content, unique_citations)`, immediately before persist). Frontend belt-and-suspenders range-check in `CitedMarkdown.tsx:150` (`if (n < 1 \|\| n > k) continue`). No re-ask anywhere in the module (grep confirmed no LLM call in `citation_markers.py`). 9/9 backend unit tests green (`test_153_citation_markers.py`, `test_153_citation_instruction.py`), re-run live during this verification. |
| 2 | Clicking a marker opens the source passage | ✓ VERIFIED (code) | `CitedMarkdown.tsx` `onClick`/`onKeyDown` → `pinMarker` → mounts `CitationPeek` (chunk variant renders the `passage` snippet + loc; full-doc variant renders "Full document — no single passage" per D-10, `CitationPeek.tsx`). `CitationPeek.test.tsx` 13/13 green (re-run); `CitedMarkdown.test.tsx` 6/6 green including an activation → peek + row-flash assertion. |
| 3 | Claims without a marker read as general knowledge (absence-as-signal) — no fabricated attributions | ✓ VERIFIED (code) | `AbsenceHint.tsx` renders the verbatim UI-SPEC copy ("Unmarked claims read as general knowledge" / "Unmarked sentences are the model's general knowledge...") mounted once under cited answers (`MessageItem.tsx:501-504`), self-guards to null on no-citations. Non-member/out-of-range markers are stripped before persist (D-02), so a claim the model didn't/couldn't validly mark simply has no marker — never a fabricated one. `AbsenceHint.test.tsx` 6/6 green (re-run). |
| 4 | Inline markers render consistently across all providers (SC#10) and Deep Mode stays byte-identical where unchanged | ✓ VERIFIED (code) / ? LIVE CONFIRMATION PENDING | `apply_citation_instruction` (`citation_markers.py:145-177`) appends the SAME note to both `active_system_prompt` (native channel, reaches `agent_loop.py:2030` and `:2105` `system_prompt=active_system_prompt` GatewayRequest sites) AND `messages[0]`'s system entry (compat channel) — grep-confirmed `provider ==` fork count is 0 in `citation_markers.py`, `CitedMarkdown.tsx`, `CitationPeek.tsx`, `AbsenceHint.tsx`, `citationNav.tsx`. Gated on `if retrieved_citations:` (`agent_loop.py:1824-1827`) so non-retrieval turns are byte-identical (unit-tested `test_no_inject_without_retrieval`). **The live cross-provider render behavior (does each of the 4 native providers actually place markers / degrade gracefully) has NOT been executed** — this is the SC#10 4-axis UAT in `153-VALIDATION.md`, not yet run (no `153-UAT.md` exists in the phase directory; `STATE.md` explicitly says "ready for `/gsd:verify-work 153` (run 153-VALIDATION SC#10 4-axis UAT first...)"). |

**Score:** 4/4 truths verified at the codebase level; roadmap SC#4's live cross-provider claim requires the human UAT below before CITE-01 can close.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/services/citation_markers.py` | Pure strip/renumber + manifest + dual-channel instruction helpers | ✓ VERIFIED | 178 lines; no Redis/DB/await/provider-fork (grep-confirmed); exports `normalize_citation_markers`, `apply_citation_instruction`, `format_citation_manifest`, `CITATION_INSTRUCTION` all present and used. |
| `backend/tests/unit/test_153_citation_markers.py` + `test_153_citation_instruction.py` | Strip/renumber/code-span + dual-channel/byte-identical coverage | ✓ VERIFIED | Re-run live: 9/9 passed. |
| `frontend/src/lib/citationNav.tsx` | Nav provider + flash helpers + shared DOM constants | ✓ VERIFIED | `CitationNavProvider`, `useCitationNav`, `useCitationNavOptional`, `flashCitationRow`, `flashCitationMarker`, `CITATION_ROW_ATTR`/`CITATION_MARKER_ATTR`/`CITATION_FLASH_CLASS`/`CITATION_ACTIVE_CLASS` all exported and consumed downstream. |
| `frontend/src/index.css` (citation block) | Marker states + markerPop + ref-row flash + reduced-motion | ✓ VERIFIED | `markerPop` and `prefers-reduced-motion` both present (per 153-02 SUMMARY grep-gate, corroborated by citationNav.tsx importing the constants these classes key on). |
| `frontend/src/components/chat/CitationCard.tsx` | Numbered `[n]` row + Open document + full-doc branch + flash target | ✓ VERIFIED | `n?`/`flashContainer?` props, `CITATION_ROW_ATTR`, `openDocument` wiring present (153-03 SUMMARY greps corroborated by CitationList.tsx read — threads `n = i+1` into each card). |
| `frontend/src/components/chat/CitationList.tsx` | `References · {N} source(s)` header + canonical `defaultOpen` + numbering | ✓ VERIFIED | Read directly: `defaultOpen = false` default, `useState(defaultOpen)`, header copy exact match, `n = i + 1` threaded, `citations.length === 0 → null` guard intact. |
| `frontend/src/components/chat/CitationPeek.tsx` | Chunk + full-doc popover, a11y pin/Esc, Open document | ✓ VERIFIED | 13/13 tests re-run green; exports `CitationPeek`. |
| `frontend/src/components/chat/CitedMarkdown.tsx` | Reused pipeline + owned `<sup>` marker upgrade + peek/flash wiring | ✓ VERIFIED | Read directly: `document.createElement("sup")` (line 70) with attributes set programmatically (role/tabindex/aria-label), TreeWalker + `isInSkippedAncestor` code/pre/a skip (line 58-66), range-check `n < 1 \|\| n > k` (line 150), delegated listeners attached in `useLayoutEffect` (never via the sanitized string). `dangerouslySetInnerHTML` appears only in comments (0 JSX usages, grep-confirmed) — the layout effect solely owns the container's innerHTML by design. |
| `frontend/src/components/chat/AbsenceHint.tsx` | Quiet, non-blocking absence-as-signal ⓘ | ✓ VERIFIED | Read directly: `if (!citations?.length) return null` self-guard, no `role="alert"`/`role="banner"`, uses the vendored Radix `Tooltip` (non-blocking), verbatim UI-SPEC copy present. |
| `frontend/src/components/chat/MessageItem.tsx` | Additive cited branch, `defaultOpen`/`flashContainer` producer, AbsenceHint mount | ✓ VERIFIED | Read directly (lines 475-515): `CitedMarkdown` only on `message.role === "assistant" && message.citations && message.citations.length > 0`; `StreamingNarration`/`MarkdownRenderer` branches unchanged; `hasInRangeMarker` computes `defaultOpen`; `AbsenceHint` mounted once, gated off the streaming path. |
| `frontend/src/App.tsx` / `frontend/src/pages/IngestionPage.tsx` | Owner-scoped cross-view "Open document" wiring | ✓ VERIFIED | `App.tsx:189` mounts `CitationNavProvider navigate={setActiveView}` wrapping the chat subtree; `IngestionPage.tsx:149-156` consumes the one-shot intent into the EXISTING `setSelectedDocId` (no new fetch — `selectedDoc` still resolves only from the owner-scoped `documents` list). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `agent_loop.py` settle (~L2800) | `normalize_citation_markers(full_content, unique_citations)` | Reassign `full_content` before persist | ✓ WIRED | Confirmed at `agent_loop.py:2808`, immediately after `unique_citations[:] = _deduplicate_citations(...)` (L2800) and before `_persist_assistant_message()`. |
| `agent_loop.py` injection seam (~L1824) | `apply_citation_instruction(active_system_prompt, messages, retrieved_citations)` | Gated `if retrieved_citations:` | ✓ WIRED | Confirmed at `agent_loop.py:1824-1827`; result threads to both GatewayRequest `system_prompt=active_system_prompt` sites (L2030, L2105). |
| `MessageItem.tsx` settled-assistant path | `CitedMarkdown` | `message.role === "assistant" && message.citations?.length` ternary | ✓ WIRED | Confirmed lines 477-492 — additive branch; `StreamingNarration`/`MarkdownRenderer` paths untouched. |
| `CitedMarkdown.tsx` marker | `CitationPeek` + `flashCitationRow` | hover/focus → peek; click/Enter → pin + flash | ✓ WIRED | Confirmed `openPreview`/`pinMarker` (lines 179-193) call `setPeek` and `flashCitationRow(n, scope)`. |
| `CitationCard.tsx` row | `flashCitationMarker` + `openDocument` | row activate → flash; Open document → nav | ✓ WIRED | Confirmed via 153-03 SUMMARY grep gates + `CitationList.tsx`/`citationNav.tsx` reads — `CITATION_ROW_ATTR`/`flashCitationMarker` imported from the shared contract, not re-invented. |
| `App.tsx` | `IngestionPage` (documents view) | `CitationNavProvider` pending-intent → `setSelectedDocId` | ✓ WIRED | Confirmed `App.tsx:189` provider mount + `IngestionPage.tsx:149-156` consumption. |
| `citationNav.tsx` `openDocument` | existing owner/RLS-scoped `DocumentDetailPanel` fetch | `selectedDoc = documents.find(...)` over the owner-scoped list | ✓ WIRED | Confirmed `IngestionPage.tsx:137-140` — no new fetch/endpoint introduced (grep for new `fetch(`/`getDocument` in the diff: none). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `CitedMarkdown` markers | `citations` prop (from `message.citations`) | Real `citations` SSE event, populated from `unique_citations[:] = _deduplicate_citations(retrieved_citations)` — the actual retrieval results of the run | Yes — sourced from live tool-call citations, not a static/empty stub | ✓ FLOWING |
| `CitationList` footer rows | `citations` prop, same source | Same `unique_citations` set | Yes | ✓ FLOWING |
| `AbsenceHint` | `citations` prop, same source | Same | Yes (self-guards to null when genuinely empty — correct, not hollow) | ✓ FLOWING |
| Persisted `messages.content` | `full_content` (normalized) | `normalize_citation_markers` output at settle, over the model's real streamed answer | Yes | ✓ FLOWING |

No static/hardcoded-empty stub values found flowing into any of the phase's rendered surfaces.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend strip/renumber + dual-channel unit suite | `cd backend && venv/Scripts/python -m pytest tests/unit/test_153_citation_markers.py tests/unit/test_153_citation_instruction.py -q` | `9 passed` | ✓ PASS |
| `agent_loop.py` imports cleanly (no cycle) | `venv/Scripts/python -c "import app.services.agent_loop"` (implicit via pytest collection) | No import error | ✓ PASS |
| Frontend citation component suites | `cd frontend && npx vitest run <6 citation test files>` | `Test Files 6 passed (6)`, `Tests 57 passed (57)` | ✓ PASS |
| StreamsProvider / providers non-regression | `cd frontend && npx vitest run src/providers/__tests__` | `Test Files 2 passed (2)`, `Tests 22 passed (22)` | ✓ PASS |
| No `provider ==` fork in the new citation surface | `grep -rn "provider ==\|provider ===" <7 phase files>` | 0 matches | ✓ PASS |
| No `dangerouslySetInnerHTML` JSX usage in `CitedMarkdown.tsx` | `grep -n "dangerouslySetInnerHTML" CitedMarkdown.tsx` | 2 matches, both inside comments (lines 6, 264) — 0 in JSX | ✓ PASS |
| Red-line files untouched (`threads.py`, `StreamsProvider.tsx`) | `git diff --name-only <phase-01-commit>^..<phase-05-final-commit>` | Neither file listed | ✓ PASS |
| tsc baseline (0 net-new errors) | `cd frontend && npx tsc -b 2>&1 \| grep -c "error TS"` | `30` (matches the documented SEED-056/049 baseline) | ✓ PASS |
| Full backend unit suite (regression sweep) | `cd backend && venv/Scripts/python -m pytest tests/unit -q` | `63 failed, 1235 passed` — 0 of the 63 failures reference citations (`test_sandbox_service`, `test_sql_service`, `test_streaming_reliability`, etc.); matches the documented Phase-151 baseline-rot count | ✓ PASS (no new failures) |
| Full frontend unit suite (regression sweep) | `cd frontend && npx vitest run` | `9 files / 20 tests failed` of 150/1369 — all in pre-existing rot files (`streamsProvider.test.tsx`, `StreamsProvider.dedup.test.ts`, `soulData.test.ts`, `PublishGauntlet.test.tsx`, `useMessages.test.ts`, `Plan04.frontend.test.tsx`, `model-info.test.ts`, and one legacy `src/__tests__/components/MessageItem.test.tsx` copy-text assertion unrelated to citations); none reference citation components | ✓ PASS (no new failures) |

### Probe Execution

Not applicable — Phase 153 is a feature/UX phase, not a migration/tooling phase; no `scripts/*/tests/probe-*.sh` declared in PLAN/SUMMARY files, none found under `scripts/`.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| CITE-01 | 153-01..05 | Chat answers show inline per-claim citation markers keyed to the run's ACTUAL retrieval set with click-through, absence-as-signal, and cross-provider consistency (SC#10) | ? NEEDS HUMAN | All codebase mechanisms verified sound (see truths 1-4 above). Correctly left `Pending` in `REQUIREMENTS.md:97` per the project's false-green-avoidance convention — closes only after the live SC#10 4-axis UAT below. This verification independently confirms that convention is being followed correctly, not prematurely closed and not falsely stalled. |

No orphaned requirements found — `REQUIREMENTS.md` maps only CITE-01 to Phase 153, and all 5 plans declare `requirements: [CITE-01]`.

### Anti-Patterns Found

Sourced from `153-REVIEW.md` (deep code review, 0 BLOCKER / 0 HIGH) and independently spot-checked in this verification. None block the phase goal; listed here as non-blocking follow-up items, consistent with the review's own "None block ship" conclusion.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `frontend/src/lib/citationNav.tsx` + `IngestionPage.tsx` | 94-101 / 150-155 | "Open document" silently no-ops if the cited `document_id` is never present in the owner's `documents` list (vs. not-yet-loaded, which self-heals) | ⚠️ Warning (MD-01, non-blocking) | A narrow edge case (superseded document version not surfacing in the list) — fails safe (no unauthorized access) but the primary "click-through" affordance can look broken with no feedback. Independently confirmed by direct read of `IngestionPage.tsx:137-140` (`selectedDoc` resolves only from `documents.find(...)`). |
| `frontend/src/components/chat/MessageItem.tsx` | 280-289 | `hasInRangeMarker` (drives `defaultOpen`) does not skip code/pre/a spans the way `CitedMarkdown`'s `isInSkippedAncestor` does — a `[1]`-shaped token inside a fenced code block could open the footer with zero visible markers | ℹ️ Info (LW-01, non-blocking) | Narrow edge case; does not fabricate attribution or break the strip/renumber honesty core, only a footer default-open inconsistency. Independently confirmed by direct read. |
| `backend/app/services/citation_markers.py` | 133-142 | `_strip_citation_note` sentinel-matching is spoofable by user-derived content reaching the system prompt (self-inflicted, RLS-scoped) | ℹ️ Info (LW-02, non-blocking) | Correctness/robustness note on the "recompute fresh each turn" mechanism; does not affect citation honesty. |
| `frontend/src/components/chat/CitedMarkdown.tsx` | 245-256, 208-212 | Multiple pinned peeks can coexist across messages; unpinned peek doesn't close on keyboard blur | ℹ️ Info (LW-03/LW-04, non-blocking) | UX polish, feeds Phase 155 (Accessibility Sweep). |

No `TBD`/`FIXME`/`XXX` debt markers found in any of the 12 phase-153 files (grep-confirmed, 0 matches).

### Human Verification Required

The following SC#10 4-axis live UAT items are authored in `153-VALIDATION.md` §"Manual-Only Verifications" but have not yet been executed (no `153-UAT.md` exists; `STATE.md` explicitly defers this as the next step). Per this project's false-green-avoidance convention (Phases 148-152), these must be run — with the backend uvicorn restarted first to load the Phase 153-01 `agent_loop.py` changes — before CITE-01 can close.

### 1. Cross-provider markers + graceful degradation

**Test:** Run one representative model each for OpenAI, Anthropic, Google, and OpenRouter through a Deep-chat retrieval turn.
**Expected:** Markers render on native providers whose model complies with the citation-density instruction; a model that emits none degrades gracefully to footer-only (D-06/D-07) — no provider ends up worse than today. OpenRouter axis may be blocked by external BUG-260714-02 (operator-accept precedent already established at Phase 152).
**Why human:** Model-emission variance (whether/how a live model actually places `[n]` markers) is only observable against a running backend + live provider APIs.

### 2. Multi-tool grounding (chunk + full-doc)

**Test:** One prompt that exercises `search_documents` (chunk) AND `fetch_document_file`/a full-doc read in the same answer.
**Expected:** Both chunk and full-doc citations produce markers/footer rows; the full-doc peek shows "Full document — no single passage" + Open document only (no snippet/score, D-10).
**Why human:** Needs a real mixed retrieval result from a live agent run.

### 3. Parallel-thread isolation

**Test:** Thread A streaming (calm, unmarked body) while Thread B accepts a new prompt concurrently.
**Expected:** Markers attach to Thread A only on ITS settle, with zero bleed into Thread B.
**Why human:** Concurrent SSE streams across two threads cannot be exercised by the unit/component test suite.

### 4. Long-message settle reconcile

**Test:** A thread with ≥50 prior messages or a ≥5KB prompt.
**Expected:** The terminal reconcile still swaps live→normalized content correctly; no marker flash/drift.
**Why human:** Requires a live long-running thread and the real `StreamsProvider` reconcile timing.

### 5. General-knowledge non-regression

**Test:** A no-retrieval turn (a question the agent answers without calling `search_documents`/file tools).
**Expected:** Renders nothing extra — no footer, no markers, no absence-ⓘ — byte-identical to today's non-cited turn.
**Why human:** Confirms the D-12/D-14 byte-identical guarantee holds against a live model response, not just the unit-tested `apply_citation_instruction` no-op path.

### 6. Set-membership integrity (DB corroboration)

**Test:** Via psycopg2 :54322, inspect a persisted assistant message's `content` after a live retrieval run.
**Expected:** No `[n]` in the persisted text whose index exceeds that run's `source_refs`/`citations` count.
**Why human:** Requires inspecting a live-persisted row after a real retrieval run to corroborate the unit-tested strip against production data.

### Gaps Summary

No codebase gaps found. Every artifact declared across the 5 plans exists, is substantive (no stubs, no placeholder returns, no hardcoded-empty data), and is correctly wired end-to-end: backend settle-point strip/renumber → dual-channel provider-uniform injection → frontend owned-node marker upgrade → click-through peek → numbered always-on footer → absence-as-signal ⓘ. All red lines held (`threads.py`, `StreamsProvider.tsx` untouched; no `provider ==` fork; no new migration/package). All declared unit/component test suites pass (backend 9/9; the 6 phase-153 frontend suites 57/57; providers 22/22), and the wider regression sweep shows zero new failures beyond the documented pre-existing baseline rot (backend 63, frontend ~20 — both matching prior-phase-documented counts).

The single remaining gap is **not a code gap** — it is the live SC#10 4-axis cross-provider UAT (`153-VALIDATION.md`), which by its own nature (model-emission variance, concurrent streams, live DB corroboration) cannot be verified by static code inspection or unit tests. The phase's own SUMMARY.md files and STATE.md correctly identify this and defer requirement closure until it runs — this verification confirms that framing is accurate and not a stalling tactic: the code is genuinely ready, and only the live confirmation step remains.

---

_Verified: 2026-07-15T08:58:53Z_
_Verifier: Claude (gsd-verifier)_

---
phase: 153-inline-citations
reviewed: 2026-07-15T08:48:35Z
depth: deep
files_reviewed: 12
files_reviewed_list:
  - backend/app/services/citation_markers.py
  - backend/app/services/agent_loop.py
  - frontend/src/lib/citationNav.tsx
  - frontend/src/components/chat/CitedMarkdown.tsx
  - frontend/src/components/chat/CitationPeek.tsx
  - frontend/src/components/chat/AbsenceHint.tsx
  - frontend/src/components/chat/CitationList.tsx
  - frontend/src/components/chat/CitationCard.tsx
  - frontend/src/components/chat/MessageItem.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/IngestionPage.tsx
  - frontend/src/index.css
findings:
  blocker: 0
  high: 0
  medium: 1
  low: 4
  info: 4
  total: 9
status: issues
---

# Phase 153: Code Review Report — Inline Citations (CITE-01)

**Reviewed:** 2026-07-15T08:48:35Z
**Depth:** deep (cross-file: backend seam ↔ frontend render ↔ nav contract)
**Files Reviewed:** 12
**Status:** issues_found (0 blocker / 0 high — the load-bearing security + correctness surface is sound; remaining findings are robustness/UX)

## Summary

Reviewed the full Phase 153 inline-citations surface end-to-end: the backend honesty core (`citation_markers.py` + the two agent-loop seams), the frontend nav contract, the post-mount marker injection, the peek/absence UI, and the footer/MessageItem wiring. I traced the trust story across module boundaries (manifest numbering at Seam B → footer numbering at Seam A → frontend range-check) and adversarially probed the five named focus areas.

**The five load-bearing focus areas all hold** (details in "Verified Sound" below): the XSS/V5 marker-upgrade surface cannot be driven by model text, the set-membership strip is off-by-one/negative/`[0]`/duplicate correct, the cross-provider dual-channel injection has no `provider ==` fork and creates no mid-list system message, the "Open document" deep-link introduces no unscoped fetch (fail-closed against foreign docs), and the `MessageItem` cited branch is DOM-byte-identical on the non-cited/user path.

The findings that remain are one MEDIUM UX dead-end on the "Open document" affordance, plus LOW/INFO robustness and consistency notes. None block ship.

## Verified Sound (adversarial focus areas)

- **XSS / output encoding (V5):** `CitedMarkdown` sanitize call (`DOMPurify.sanitize(marked.parse(content))`, line 93-96) is byte-identical to the shared `MarkdownRenderer` (verified against `MarkdownRenderer.tsx:22-25`). Marker upgrade only walks `SHOW_TEXT` nodes and mutates via `createElement`/`setAttribute`/`textContent` (line 69-79) — no unsanitized model text is ever re-parsed or re-injected. A model-authored `<sup>`-lookalike is inert: the delegated handlers key on `closest([data-citation-marker])` (line 168-169), an attribute only OWNED markers carry, so model text can never become an interactive citation. `[n]` inside attributes/`code`/`pre`/`a` is skipped (`isInSkippedAncestor`, line 57-66). Range-check `n ∈ [1, k]` is enforced twice (injection line 150, handler `nOf` line 170-173).
- **Set-membership integrity (D-02/D-03):** `_transform_prose` (line 79-92) keeps `[n]` iff `1 ≤ n ≤ k`, drops the rest; `[0]`/out-of-range/`[-1]` (no `\d` after `[`) all fall out or stay literal. Backend normalize runs on the persisted answer at the settle point (`agent_loop.py:2808`), immediately after the footer dedup (`:2800`) with NO intervening `await`/`raise` — so any persisted message that carries citations is always normalized. Empty set strips every marker.
- **Cross-provider injection (SC#10 / D-12/D-14):** `apply_citation_instruction` (line 145-177) appends the note to BOTH `active_system_prompt` (native `system_prompt=` param, threaded to both GatewayRequest sites `agent_loop.py:2030` and `:2105`) AND the first `role=="system"` entry of `messages` (compat channel) — in place, never inserting a new mid-list system message. The call site (`agent_loop.py:1824-1827`) is gated on `retrieved_citations` with no `provider ==` fork; non-retrieval turns are untouched (byte-identical). Fresh strip+re-append each turn (`_strip_citation_note`) prevents double-stacking as the manifest grows.
- **Access control (V4):** `openDocument` records a one-shot intent + navigates (`citationNav.tsx:94-101`); `IngestionPage` consumes it into `setSelectedDocId` (`IngestionPage.tsx:150-155`), and `selectedDoc` resolves ONLY from the owner-scoped `documents` list via `documents.find(...)` (`:137-140`). `DocumentDetailPanel` receives the resolved object, never a raw id (`:582-583`). A foreign/unseeable `document_id` never resolves → panel never opens. No new fetch-by-id introduced.
- **G-5 non-regression:** the cited branch is additive (`MessageItem.tsx:481-489`); user messages (early return) and non-cited assistant messages fall through to the unchanged `MarkdownRenderer`/`StreamingNarration`/`dedupParagraphs` path. `AbsenceHint` self-guards to null when no citations (`AbsenceHint.tsx:32`), the `ref={setMessageBody}` callback renders no DOM, and `StreamsProvider.tsx` is untouched. Non-cited render is DOM-byte-identical.
- **Effect cleanup:** `CitedMarkdown`'s layout effect removes all 5 delegated listeners + nulls `activeMarkerRef` on teardown (line 233-240); the pinned outside-click effect and `CitationPeek`'s Escape effect both clean up; `CitationCard`'s `activeTimer` is cleared on unmount (line 54-59). No listener/timer leaks found.

## Medium

### MD-01: "Open document" is a silent dead-end when the cited doc is not in the owner list

**File:** `frontend/src/lib/citationNav.tsx:94-101` + `frontend/src/pages/IngestionPage.tsx:150-155`
**Issue:** `openDocument` unconditionally fires `navigate("documents")` and stores `pendingDocumentId`; `IngestionPage` sets `selectedDocId`, but `selectedDoc` only resolves from the `useDocuments()` owner list. When the cited `document_id` is not present in that list — e.g. it references an older document version row not surfaced in the list, or the list is not fully loaded/paginated — the user is switched to the Documents view but NO panel opens and no feedback is shown. (A not-yet-loaded doc self-heals once `documents` loads because `selectedDocId` persists; a genuinely-absent-but-owned row does not.) This is fail-safe for security, but a broken primary affordance (SC#2 "Open document") on a legitimate path.
**Failure scenario:** User clicks a citation's "Open document" for a chunk that belongs to a superseded document version → lands on an empty Documents view, no panel, no error → looks broken.
**Fix:** When consuming the pending intent and the id fails to resolve in `documents`, surface feedback instead of a silent no-op — e.g. after `setSelectedDocId`, if `documents.find(id)` is still empty after the list settles, show a toast ("This source's document isn't in your list") or fall back to fetching the single owner-scoped doc via the existing RLS-scoped document GET. At minimum, confirm the versioning model guarantees every citable `document_id` appears in `listDocuments()`; if it does, downgrade this to INFO.

## Low

### LW-01: `hasInRangeMarker` does not skip code/pre/a, so the footer can open with zero visible markers

**File:** `frontend/src/components/chat/MessageItem.tsx:279-289`
**Issue:** `hasInRangeMarker` regex-scans the whole content with no code-span/`<pre>`/`<a>` skipping, whereas `CitedMarkdown` (`isInSkippedAncestor`) DOES skip those. A citation-shaped token appearing only inside a code block (e.g. the answer prints `arr[1]` in a fenced block, and `citations.length ≥ 1`) makes `defaultOpen` compute `true` and the References footer open-by-default while CitedMarkdown renders zero interactive markers — contradicting the D-06/D-07 "footer opens only when markers exist" contract.
**Failure scenario:** A cited answer whose only `[1]` is inside a code fence opens the footer expanded with no in-text markers to justify it.
**Fix:** Share the code-skip logic — either reuse the same fenced/inline-code stripping as the backend `_CODE_RE`/`CitedMarkdown` before scanning, or export a single `countRenderableMarkers(content, k)` helper used by both the footer default and the injector so they can never disagree.

### LW-02: `_strip_citation_note` sentinel is spoofable by user content that reaches the system prompt

**File:** `backend/app/services/citation_markers.py:133-142`
**Issue:** The note is delimited by literal sentinels (`\n\n<<<CITATION_GUIDANCE>>>\n` / `\n<<<END_CITATION_GUIDANCE>>>`) and stripped by `str.find`. `active_system_prompt` (and `messages[0]`) accrue user-derived content upstream (memory_note `agent_loop.py:1392`, catalog_note `:1371`). If that user content contains the start sentinel, `_strip_citation_note` will match it first; the malformed-block branch (`start` found, `end` missing) does `return text[:start]`, truncating the real system prompt from the injected sentinel onward on every retrieval turn.
**Failure scenario:** A user stores a memory note containing `<<<CITATION_GUIDANCE>>>` on its own lines → on the next retrieval turn the citation strip truncates that user's own system prompt (dropping tool/security guidance below it). RLS-scoped (self-inflicted only), but a correctness/robustness hole in the "recompute fresh each turn" mechanism.
**Fix:** Use an unspoofable delimiter (e.g. a random per-run nonce embedded once, or a control-char sentinel) OR track the note's presence out-of-band (a boolean/length rather than a string search), so untrusted prompt content can never be mistaken for the injected note.

### LW-03: Multiple pinned citation peeks can coexist across messages

**File:** `frontend/src/components/chat/CitedMarkdown.tsx:245-256`
**Issue:** Each `CitedMarkdown` owns its own `pinned`/`peek` state, and the outside-click handler returns early for ANY `[data-citation-marker]` target (line 251). Clicking a marker in message B therefore does not dismiss message A's pinned peek, so two (or more) pinned popovers can be open at once.
**Failure scenario:** Pin a citation in answer A, scroll down, pin one in answer B → both popovers remain floating simultaneously.
**Fix:** Either lift pin state to a single shared context so only one peek is pinned app-wide, or in the outside-click handler only treat a click on THIS component's own marker (within `containerRef.current`) as "inside", closing the peek when the click lands on a different message's marker.

### LW-04: Hover/focus-opened peek never closes on blur

**File:** `frontend/src/components/chat/CitedMarkdown.tsx:208-212`
**Issue:** `onFocusIn` opens the (unpinned) peek on keyboard focus, but there is no `focusout` handler to close it. When unpinned, the peek only closes via `mouseout`, Escape, or pinning. Tabbing focus away from a marker to a non-marker element leaves a stale, orphaned peek anchored to the previous marker.
**Failure scenario:** Keyboard user Tabs onto a marker (peek shows), then Tabs forward to the next link → peek stays open, misaligned, until Escape.
**Fix:** Add a `focusout` listener (mirroring `mouseout`) that closes the peek when focus leaves the marker to a non-marker, non-peek target while unpinned.

## Info

### IN-01: `normalize_citation_markers` "renumber" is actually a keep/drop that relies on an unguarded invariant

**File:** `backend/app/services/citation_markers.py:79-92`
**Issue:** `_transform_prose` never rewrites `n` — it keeps in-range markers unchanged and drops the rest. This is correct ONLY because manifest position (Seam B, `apply_citation_instruction`) equals footer position (Seam A, settle), which holds today solely because `retrieved_citations` is append-only (`agent_loop.py:1723`, `:2544`) and `_deduplicate_citations` is first-occurrence order-preserving. There is no assertion tying the two; a future change that reorders `retrieved_citations`, filters it before the footer, or dedups differently between the seams would silently mis-attribute surviving markers with no test catching it.
**Fix:** Add a guard/invariant test asserting the Seam-B manifest order equals the Seam-A footer order for a growing citation set, and update the docstring to state the keep/drop-not-renumber behavior explicitly.

### IN-02: Stripped markers leave orphaned whitespace

**File:** `backend/app/services/citation_markers.py:82-90`
**Issue:** Dropping an out-of-range `[n]` leaves the surrounding spaces (e.g. `fact [3] .` → `fact  .`; test `test_no_markers_noop` encodes `"A [1] B [2]"` → `"A  B "`). Cosmetic double-spaces / space-before-punctuation in the persisted answer. This is arguably intentional under D-04 (no repair/fabrication).
**Fix:** If desired, collapse a single flanking space when a marker is dropped; otherwise leave as-is and document that D-04 forbids whitespace repair.

### IN-03: Inconsistent nav-hook variant between peek and card

**File:** `frontend/src/components/chat/CitationPeek.tsx:71`
**Issue:** `CitationPeek` uses the throwing `useCitationNav()` while `CitationCard` uses the non-throwing `useCitationNavOptional()`. Safe today (CitationPeek only mounts inside the chat subtree under `CitationNavProvider`), but the asymmetry means CitationPeek hard-crashes if ever reused outside a provider, unlike the card.
**Fix:** For consistency and reuse safety, use `useCitationNavOptional()` in `CitationPeek` and disable/hide "Open document" when null, or document why the throw is intentional here.

### IN-04: Settle-point normalize is skipped on non-clean exit paths (defense-in-depth, no observed defect)

**File:** `backend/app/services/agent_loop.py:2808`
**Issue:** The normalize only runs on the clean path; error/cancel/timeout finalizer paths persist `full_content` without it. In practice these paths raise BEFORE `unique_citations` is populated (`:2800`), so such messages carry no `source_refs` → the frontend renders them via `MarkdownRenderer` and any `[n]` stays literal text (no false interactive attribution). The honesty guarantee is therefore preserved by the frontend range-check + citations-absence, not by the backend strip, on those paths.
**Fix:** None required for correctness. If a non-CitedMarkdown consumer (export, API, plaintext) ever reads raw persisted content, consider normalizing inside `_persist_assistant_message` so the guarantee is uniform across all exit paths.

---

_Reviewed: 2026-07-15T08:48:35Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

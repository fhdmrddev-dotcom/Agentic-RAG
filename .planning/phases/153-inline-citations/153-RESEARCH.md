# Phase 153: Inline Citations - Research

**Researched:** 2026-07-15
**Domain:** RAG citation attribution / provider-uniform SSE render layer / markdown marker injection
**Confidence:** HIGH (grounded in the actual current code — every line reference below was re-verified against HEAD)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 — Set-membership is the ONLY mechanism.** Inline marker `n` = `citations[n]` from the run's finalized retrieval set. **Never** a post-hoc LLM re-ask (Pitfall 14).
- **D-02 — Non-member markers are STRIPPED.** Backend validates every emitted `[n]` against the finalized `unique_citations` set; any marker that doesn't map to a real retrieved source (out-of-range index, or a source absent from the final set) is **removed from the answer text** so that claim reads unmarked. Never render a broken/fabricated attribution.
- **D-03 — Survivors renumber `1..k` to match the footer.** The **backend is the single source of truth for numbering.** Numbered `[n]` footer + inline markers share ONE canonical numbering derived from the finalized dedup set.
- **D-04 — No backstop for false-negatives.** A grounded claim the model forgot to mark stays unmarked — never re-ask (Pitfall 14). Absence-as-signal accepts this floor.
- **D-05 — Validate/renumber at SETTLE.** Happens at the point `unique_citations` is finalized and the `citations` SSE fires (`agent_loop.py` ~L2781–2790, after sources, before confidence). Body streams calm/unmarked; validated markers attach when the set is known.
- **D-06 — Footer ALWAYS renders when retrieval ran.** Today's `CitationList`, now numbered, appears whenever there is a retrieval set — independent of whether the model emitted any inline markers.
- **D-07 — Inline markers render only when the model emitted valid (set-member) ones.** A weaker/non-compliant model degrades gracefully to **footer-only**. No provider ends up worse than today.
- **D-08 — Deep chat only this phase.** Workflow `llm_emit` answers keep their existing `citation_policy` gate; NOT retrofitted.
- **D-09 — Both chunk and full-doc grounding cite.** `search_documents` chunk retrieval AND full-doc / fetched-file reads both produce citations.
- **D-10 — Whole-doc peek shows "full document → Open", not a snippet.** A citation with `is_full_doc=true` has no chunk/similarity → "full document" affordance + "Open document".
- **D-11 — Always-on, no toggle.** On whenever retrieval ran (Glean/Beam converged pattern).
- **D-12 — Additive, retrieval-turns-only instruction.** Citation instruction added ONLY on turns where retrieval happened; Deep Mode byte-identical on every non-retrieval turn (D-14 red line). Provider differences stay at the gateway/adapter boundary — no shared-path fork.
- **Locked by the sketches (design contract — do NOT re-open):** marker form = superscript numeral chip (sparing/per load-bearing claim); absence = plain prose taught via a quiet ⓘ popover (never a banner); streaming = body streams calm & unmarked, markers attach on settle; click-through = hover-peek → click-to-pin, bidirectional marker↔row; footer = numbered `[n]` References list, open-by-default when markers exist.

### Claude's Discretion (this research resolves all four — see §"Discretion Calls Resolved")
1. Exact numbering mechanism handed to the model.
2. Backend vs. frontend split of marker parse/validate/renumber (SSE contract).
3. Marker-density prompt wording (retrieval-turns-only).
4. Full-doc peek exact shape.

### Deferred Ideas (OUT OF SCOPE)
- Inline citations on workflow `llm_emit` answers (D-08). Re-open: dedicated "workflow-output citations" phase or user demand once Deep ships.
- A user setting to disable citations (rejected, D-11). Re-open: real reports that always-on is unwanted.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CITE-01 | Chat responses show inline per-claim citation markers keyed to the run's ACTUAL retrieval set (set-membership, never a post-hoc LLM re-ask) with click-through to the source passage; claims without a marker read as general knowledge — G-2 sketch-gated, G-5 hot-file check first, SC#10 cross-provider | The full citation data channel already exists (`unique_citations` → `citations` SSE → `source_refs` persist → frontend `Citation[]`). This phase adds: (1) a backend normalize/strip/renumber seam at the D-05 settle point, (2) a retrieval-turns-only prompt instruction injected via the SAME dual-channel seam Phase 149 uses (byte-identical off-retrieval), (3) a frontend marker-render + hover-peek/pin interaction layer over the existing `MarkdownRenderer` + `CitationList`. All four success criteria map to seams verified in this research. |
</phase_requirements>

## Summary

Phase 153 is **not greenfield and not large in data-model terms** — the entire provider-uniform citation channel already ships and was verified line-by-line: tool handlers build `Citation` dicts (`tool_dispatcher.py:722–730` chunk, `:1041–1049` full-doc), the agent loop accumulates them (`agent_loop.py:1718–1719`, `:2524–2525`), dedups order-preserving (`_deduplicate_citations` at `:851`), finalizes `unique_citations` and fires the `citations` SSE (`:2781–2790`), persists them as `source_refs` on the message row (`:1511–1512`), and the frontend maps `source_refs → citations` on both live SSE (`StreamsProvider.tsx:839`) and DB reload (`api.ts:162`), rendering the footer via `CitationList`/`CitationCard`.

**The single most important architectural finding:** the "attach on settle" behavior the sketch requires **already has a home in the code.** On a clean Deep terminal the frontend already re-fetches the persisted message and swaps live `message.content` → the persisted final answer (`StreamsProvider.tsx:1988–2011`, the BUG-260707-03 reconcile). If the backend normalizes `full_content` (strip non-members + renumber survivors 1..k) **before persisting** at the D-05 settle point, the validated markers ride into the live view through that existing reconcile — and reload is byte-identical to live because both read the same persisted `content`. This means the phase needs **no new content-carrying SSE event** and **no violation of the locked "only onDelta may mutate content" reducer invariant** (`StreamsProvider.tsx:367–373`).

**Primary recommendation:** Backend owns validate/strip/renumber (D-02/D-03) at `agent_loop.py` ~L2781, rewriting `full_content` in place before persist; the numbering + density instruction is one additive note injected **only when `retrieved_citations` is non-empty**, applied to BOTH `active_system_prompt` (native providers) AND `messages[0].content` (compat providers) — mirroring the Phase 149 injection at `agent_loop.py:2097–2106` — so it is byte-identical on non-retrieval turns and reaches all 8 providers uniformly. The frontend renders markers by post-processing the parsed HTML of the settled answer (skipping code/link nodes) in a **new `CitedMarkdown` component used only when `message.citations?.length`**, leaving the shared `MarkdownRenderer` byte-identical for user + non-cited assistant messages (G-5 safe). The hover-peek/pin popover renders as a React portal driven by event delegation on the marker container.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Set-membership validation, strip non-members, renumber to footer (D-02/D-03) | API / Backend (`agent_loop.py` settle point) | — | Backend is the single source of numbering truth; the persisted `content` must already be consistent so reload == live |
| Numbering scheme handed to the model + density instruction (D-12) | API / Backend (prompt-assembly seam) | Gateway adapters (system-prompt placement) | Retrieval-turns-only instruction; provider-uniform by construction only if applied to both native `system_prompt` and compat `messages[0]` |
| Citation data channel (accumulate / dedup / SSE / persist) | API / Backend | — | Already exists — reused unchanged (D-14 shared path) |
| Marker render + hover-peek + pin + bidirectional flash | Browser / Client (`MessageItem` → new `CitedMarkdown` + peek portal) | — | Pure read-only render/interaction layer over the provider-uniform `citations` array |
| Footer numbering + open-by-default + marker↔row link | Browser / Client (`CitationList`/`CitationCard`) | — | Restructure of existing components |
| "Open document" deep-link | Browser / Client (cross-view nav intent → `IngestionPage` doc panel) | — | Reuses existing Phase 112 `DocumentDetailPanel` opened by `document_id` |
| Attach-on-settle content swap | Browser / Client (existing terminal reconcile `StreamsProvider.tsx:1988`) | API / Backend (persists normalized content) | Existing seam delivers the normalized markers live; no new event needed |

## Discretion Calls Resolved

### Discretion #1 — Exact numbering mechanism handed to the model

**Recommendation: a numbered source manifest embedded in the retrieval-turns-only instruction (option 1B), refreshed from the current deduped set each retrieval turn.** `[VERIFIED: codebase — agent_loop.py:2781, tool_dispatcher.py:722–730]`

The dedup key is `(document_id, chunk_index)` and `_deduplicate_citations` preserves **first-occurrence order** (`agent_loop.py:851–860`). So a source's position in `unique_citations` is deterministic: the order it first appeared across all tool results. Build the instruction's manifest from `_deduplicate_citations(retrieved_citations)` **at injection time** — its numbering is identical to the eventual footer numbering by construction. Example manifest line: `[1] Q3-report.pdf · chunk 4  ·  [2] roadmap.md · chunk 1  ·  [3] contract.docx · full document`.

- **Why 1B over 1A (embedding a per-hit ordinal inside each `search_documents` JSON result):** 1B keeps `search_documents`/`tool_dispatcher.py` **byte-identical** — no new field in the result JSON, no run-scoped ordinal registry threaded through `ToolContext`. Lower blast radius, and the manifest is naturally complete because it is rebuilt from the full accumulated set on each retrieval turn.
- **Robustness (why D-02/D-03 make this safe):** even if the model mis-numbers or hallucinates `[9]` when only 3 sources exist, the backend strip removes out-of-range/non-member markers and renumbers survivors to the canonical `unique_citations` order. The mechanism handed to the model is advisory; the backend re-derives truth.
- **Alternative considered (1A):** embed a stable ordinal in each result JSON via a run-scoped `dict[(doc_id,chunk_index) → ordinal]` threaded through `ToolContext` (like `_previous_files_in_run` at `agent_loop.py:1630`). Richer inline grounding (number sits next to the passage the model reads), but requires touching `tool_dispatcher.py` + `ToolContext`. Use only if UAT shows models cite more accurately with inline numbers. `[ASSUMED]` — accuracy delta not measured.

### Discretion #2 — Backend vs. frontend split + SSE contract

**Recommendation: backend owns parse/validate/strip/renumber and rewrites the persisted `content`; the frontend parses the (already-validated) `[n]` from the settled content and renders interactivity. No new content-carrying SSE event.** `[VERIFIED: codebase — agent_loop.py:1505,1532,2781–2803; StreamsProvider.tsx:1988–2011; api.ts:162]`

Rationale — the persist + reload path forces the backend to own normalization:
- Persisted `messages.content` = `_strip_nul(full_content)` (`agent_loop.py:1505`, `:1532`); persisted `source_refs` = `unique_citations` (`:1511–1512`).
- On reload, `_mapMessageResponse` maps `source_refs → message.citations` (`api.ts:162`) and `content → message.content`. The frontend has ONLY `content` + `citations` on reload — it cannot re-derive which markers were valid unless the persisted `content` already contains only validated, renumbered `[n]`. **Therefore the backend MUST strip/renumber into `full_content` before persist.** A frontend-only parse against `citations` would have to replicate the backend's strip logic and would drift from D-03.

Wire contract (minimal surface):
- **Backend, at ~`agent_loop.py:2781`** (right after `unique_citations[:] = _deduplicate_citations(...)`, before `_persist_assistant_message()` at `:2803`): call a new pure helper `normalize_citation_markers(full_content, unique_citations) -> str` and reassign `full_content`. The helper: (a) finds `[n]` tokens outside code spans, (b) maps each `n` (the number the model was shown) to a source, (c) drops out-of-range / non-member markers (D-02), (d) renumbers survivors to `unique_citations` 1-based order (D-03). Persist then writes the normalized text; the `citations` SSE (`:2790`) already carries `unique_citations` in canonical order.
- **Live attach-on-settle needs NO new event.** The existing terminal reconcile (`StreamsProvider.tsx:1988–2011`, gated on `kind === "done" || "reader_done"`) already calls `getMessages(threadId)` and swaps `m.content` → persisted `answer.content` when they differ. Because the normalized content differs from the raw streamed blob, this swap delivers the validated markers live. **This is the "markers attach on settle" seam.**
- **Optional robustness enhancement (not required):** to eliminate the brief pre-reconcile window where the raw streamed blob is visible, add the normalized answer text to the existing `citations` SSE payload (`_emit(..., 'citations', citations=..., answer=normalized)`) and have the **terminal handler** (not `onCitations` — respect the reducer invariant) prefer that captured value before falling back to `getMessages`. Present this as a plan option; the minimal version works because the settled assistant path only renders on the non-streaming branch (`MessageItem.tsx:451`) and the frontend range-checks markers (`n ∈ [1, citations.length]`) so out-of-range raw markers stay literal text.

**Non-regression constraints this split honors:**
- The reducer invariant "only `onDelta` may mutate `content`, and only by appending" (`StreamsProvider.tsx:367–373`) is preserved — the content swap happens in the terminal handler (outside `makeStreamCallbacks`), exactly as the existing BUG-260707-03 reconcile already does.
- `dedupParagraphs` (`MessageItem.tsx:220`) still runs before render; markers are mid-sentence and untouched by paragraph/sentence dedup.
- `StreamingNarration` (`MessageItem.tsx:449`) path is never given markers (it renders during streaming, before settle) — matches "body streams calm & unmarked."

### Discretion #3 — Marker-density prompt wording + injection point

**Recommendation: one additive instruction, injected only when `retrieved_citations` is non-empty, applied to BOTH `active_system_prompt` (native) and `messages[0].content` (compat), mirroring the Phase 149 pattern at `agent_loop.py:2097–2106`.** `[VERIFIED: codebase — agent_loop.py:2011,2086,2097–2106; anthropic_service.py:56–74; google_service.py:115–141]`

**Critical cross-provider finding (grounds D-12/D-14 and prevents an SC#10-breaking mistake):** you cannot inject the instruction as a mid-list `role:"system"` message. `_convert_messages_to_anthropic` **silently drops** any mid-list system message (`anthropic_service.py:72–74`: `if role == "system": i += 1; continue`), so Anthropic would never see the instruction and would emit no markers — a cross-provider regression. Google folds mid-list system messages into `system_instruction` (`google_service.py:138–141`), and compat reads `messages[0]`. The only channel that reaches **all** providers uniformly is the pair `(system_prompt=active_system_prompt, messages[0])`, because both GatewayRequest branches pass `system_prompt=active_system_prompt` (native, `:2011`; compat, `:2086`) AND `messages=messages`.

Injection shape (byte-identical off-retrieval):
```
# after the tool-result loop, before the next model turn — gate on retrieval
if retrieved_citations:                       # empty on every non-retrieval run/turn → D-12/D-14 satisfied
    manifest = _format_citation_manifest(_deduplicate_citations(retrieved_citations))
    note = CITATION_INSTRUCTION + manifest     # static guidance + current numbered set
    active_system_prompt = _base_system_prompt + note        # reaches native system_prompt=
    for i, m in enumerate(messages):           # reaches compat messages[0]  (mirror of :2099–2106)
        if m.get("role") == "system":
            messages[i] = {"role": "system", "content": _base_messages0 + note}
            break
```
Compute `note` fresh from the current deduped set each retrieval turn (do not accumulate) so the final answer turn always has the complete, correctly-numbered manifest.

**Density wording (avoids the term-paper effect, per the sketch's "sparing / per load-bearing claim"):**
> "When you state a specific fact, figure, name, quote, or claim that comes from the documents retrieved this turn, place a citation marker `[n]` immediately after it, where `n` is the source number from the list below. Cite **only load-bearing claims** — the specific facts a reader would want to verify. Do **not** cite framing sentences, transitions, your own reasoning, or general knowledge; those flow unmarked. One marker per claim is enough; never stack markers or add a marker to a sentence that is not grounded in a listed source. If a sentence draws on your general knowledge rather than a retrieved source, leave it unmarked — an unmarked sentence tells the reader it is general knowledge."

This encodes: mark load-bearing facts, leave prose unmarked, absence-as-signal, no over-citing. `[CITED: converged industry pattern — .planning/research/SUMMARY.md Pitfall 14; Glean/Beam study]`

### Discretion #4 — Full-doc peek exact shape (D-10)

**Recommendation:** the peek/footer branch on `citation.is_full_doc === true` — no chunk, no similarity. `[VERIFIED: codebase — tool_dispatcher.py:1041–1049; CitationCard.tsx:56–60; types/index.ts:111–118]`

A full-doc `Citation` has `chunk_index: null`, `passage: null`, `similarity: null`, `is_full_doc: true` (`tool_dispatcher.py:1041–1049`). `CitationCard` already branches on `is_full_doc` to render `"Full document"` (`:56–60`). Apply the SAME branch in the new peek popover:
- **Peek head:** `[n] {filename}` (+ `(v{version_number})` when `version_number > 1`, reusing `CitationCard.tsx:51–54`).
- **Peek body:** a "Full document" affordance line, NOT a snippet. Recommended copy (UI-SPEC §Copywriting): **"Full document — no single passage"**.
- **Peek footer:** `↗ Open document` only — no location, no score.
- **Footer row:** `· Full document` with no chunk/similarity (UI-SPEC contract).

Note: `passage` is `null` for full-doc AND may be truncated-to-400 for chunk citations in the SSE payload (`agent_loop.py:2783–2788`); the full passage lives in the persisted `source_refs` used on reload. The peek must tolerate a missing/short passage and degrade to the calm path (head + Open document, snippet omitted) — never an error banner (UI-SPEC §Error state).

## Standard Stack

**No new dependency is introduced by this phase.** Every primitive already ships (confirmed in `frontend/package.json`).

### Core (reused — verified present)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `marked` | ^17.0.4 | Markdown → HTML in `MarkdownRenderer` | Already the assistant render pipeline; markers inject into its output |
| `dompurify` | ^3.3.3 | Sanitize parsed HTML before `dangerouslySetInnerHTML` | Already in the render path; marker `<sup>` must survive it (see Pitfalls) |
| `lucide-react` | ^0.577.0 | `FileText`/`FileCode`/`ChevronDown/Right` icons | Already in `CitationCard`/`CitationList`; no new icons needed |
| `@radix-ui/react-collapsible` | ^1.1.12 | The References footer `Collapsible` | Already used by `CitationList` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Post-processing `marked`+`DOMPurify` HTML for markers | `react-markdown` (^10.1.0 — already installed) with a custom `text`/component renderer | Cleaner React-node markers, BUT switching `MessageItem`'s renderer is a change to a G-5 hot file and risks regressing the shared `dedupParagraphs`/streaming render path. **Rejected** — keep the existing pipeline, add a `CitedMarkdown` variant only on the cited path. |
| Backend numbered manifest (1B) | Per-result ordinal embedded in `search_documents` JSON (1A) | 1A gives inline grounding but touches `tool_dispatcher.py` + `ToolContext`. **Deferred** unless UAT shows a citation-accuracy gap. |

**Installation:** none — `npm install` unchanged.

**Version verification:** `npm view` not required — no packages added. Confirmed the four reused libs are already pinned in `frontend/package.json` `[VERIFIED: codebase]`.

## Package Legitimacy Audit

**No external packages are installed by this phase** — it is a pure render/interaction + backend-normalize layer over already-vendored dependencies. The Package Legitimacy Gate is **not triggered** (nothing to slopcheck). `[VERIFIED: codebase — frontend/package.json shows marked/dompurify/lucide-react/@radix-ui/react-collapsible/react-markdown already present; UI-SPEC §Registry Safety confirms "No third-party registry, no new block install."]`

## Architecture Patterns

### System Architecture Diagram

```
RETRIEVAL TURN (model calls search_documents / analyze_document / fetch_document_file)
        │
        ▼
tool_dispatcher builds Citation dicts ──► ToolResult.citations
  (chunk :722–730 | full-doc :1041–1049 | is_full_doc flag)
        │
        ▼
agent_loop accumulates retrieved_citations  (:1718–1719, :2524–2525)
        │
        ├──► [NEW] if retrieved_citations: inject citation instruction + numbered manifest
        │         into active_system_prompt (native) AND messages[0] (compat)   (mirror :2097–2106)
        │         └── byte-identical when retrieved_citations empty  (D-12/D-14)
        ▼
model ANSWER turn ──► delta SSE stream ──► full_content accumulates  (:1878)
        │                    │
        │                    └──► frontend message.content (raw, calm, folded by StreamingNarration)
        ▼
SETTLE (post-loop, :2775+)
        │
        ├── unique_citations[:] = _deduplicate_citations(retrieved_citations)   (:2781, order-preserving)
        ├── [NEW] full_content = normalize_citation_markers(full_content, unique_citations)
        │         └── strip non-member/out-of-range [n] (D-02) + renumber survivors 1..k (D-03)
        ├── emit 'citations' SSE (unique_citations, canonical order)             (:2790)
        └── _persist_assistant_message: content = normalized full_content, source_refs = unique_citations  (:2803)
        │
        ▼
FRONTEND
        │
        ├── LIVE: terminal reconcile getMessages → swap message.content → persisted normalized  (:1988–2011)
        │         onCitations → message.citations                                                (:839)
        └── RELOAD: _mapMessageResponse content→content, source_refs→citations                   (api.ts:162)
        │
        ▼
MessageItem settled assistant path  (:451)
        │
        ├── [NEW] CitedMarkdown(dedupParagraphs(content), citations)
        │         └── parse [n] (n∈[1,k], skip code/pre/a) → interactive <sup> markers
        │         └── hover/focus → peek portal;  click/Enter → pin + flash matching footer row
        └── CitationList(citations)  → numbered [n] rows, open-by-default when markers exist, marker↔row link
```

### Recommended Component / Seam Structure
```
backend/app/services/
├── agent_loop.py          # +normalize_citation_markers() call at ~:2781; +citation instruction inject (~:2097 mirror)
│                          #  (NOT threads.py — G-5 red line; NOT a provider fork)
└── (new) citation_markers.py  OR a helper next to _deduplicate_citations(:851)
                           #  pure fn: normalize_citation_markers(text, unique_citations) — unit-testable, no I/O

frontend/src/components/chat/
├── MessageItem.tsx        # G-5 — swap MarkdownRenderer→CitedMarkdown ONLY when message.citations?.length
├── (new) CitedMarkdown.tsx    # marked+DOMPurify pipeline (reused) + post-mount marker upgrade + peek portal
├── (new) CitationPeek.tsx     # hover-peek/pin popover (chunk + full-doc variants)
├── CitationList.tsx       # +numbering, +open-by-default-when-markers, +marker↔row link
└── CitationCard.tsx       # +[n] number, +↗ Open document, reuse is_full_doc branch
```

### Pattern 1: Retrieval-turns-only additive instruction (mirror Phase 149)
**What:** Inject citation guidance only when retrieval occurred, via the dual `(active_system_prompt, messages[0])` channel.
**When to use:** Every retrieval turn; never on non-retrieval turns/runs (byte-identical, D-14).
**Example:**
```python
# agent_loop.py — pattern verified at :2097–2106 (Phase 149 STRUCTURED-tools injection)
# Existing precedent this mirrors:
if calling_mode == CallingMode.STRUCTURED and tool_choice == "auto" and not _structured_tools_injected:
    _tl_fb = _format_tool_list(...)
    for _fi, _fm in enumerate(messages):
        if _fm.get("role") == "system":
            messages[_fi] = {"role": "system", "content": _fm["content"] + TOOL_USAGE_INSTRUCTIONS.format(...)}
            _structured_tools_injected = True
            break
# NEW citation injection follows the SAME shape BUT also appends to active_system_prompt (native path).
```

### Pattern 2: Marker injection into sanitized HTML via post-mount DOM upgrade
**What:** After `DOMPurify.sanitize(marked.parse(content))` sets innerHTML via a ref, a `useLayoutEffect` walks text nodes (TreeWalker), skips ancestors `code`/`pre`/`a`, and replaces `[n]` (n∈[1,k]) with a trusted `<sup>` element created via `document.createElement` (no re-sanitize needed — we own the node), wiring `tabindex`/`role`/`aria-label` + delegated listeners.
**When to use:** The cited assistant path only.
**Why this shape:** avoids relying on DOMPurify to preserve interactive attributes on injected markup, and structurally sidesteps the `[n]`-in-code-span collision.

### Anti-Patterns to Avoid
- **Injecting the citation instruction as a mid-list `role:"system"` message** — silently dropped by Anthropic (`anthropic_service.py:72–74`); breaks SC#10.
- **Mutating `message.content` inside `onCitations`** — violates the reducer invariant (`StreamsProvider.tsx:367–373`); do the swap in the terminal handler.
- **Naive `content.replace(/\[\d+\]/, …)`** — corrupts markdown links `[label](url)`, array indices in code, and footnote-like text. Walk parsed HTML text nodes and skip code/links.
- **Switching `MessageItem`'s renderer to `react-markdown`** — G-5 regression risk on the shared path.
- **Any post-hoc LLM re-ask to attribute claims** — Pitfall 14, explicitly forbidden (D-01/D-04).
- **Touching `backend/app/api/threads.py`** — G-5 red line; the settle/persist logic lives in `agent_loop.py`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dedup + canonical ordering of the retrieval set | A new dedup pass | `_deduplicate_citations` (`agent_loop.py:851`) — already order-preserving on `(document_id, chunk_index)` | It is the single source the footer numbers; reuse guarantees marker↔footer alignment |
| Citation data shape / persistence | New table or column | Existing `Citation` dict + `source_refs` message column + `_mapMessageResponse` | Full round-trip (live SSE + DB reload) already wired |
| Attach-on-settle content swap | New "final answer" SSE event + reducer | Existing terminal reconcile (`StreamsProvider.tsx:1988–2011`) | Already swaps raw→persisted on clean Deep terminal; normalized markers ride it for free |
| Footer collapse/expand | New disclosure UI | Existing `Collapsible` in `CitationList` | Only the default-open logic + numbering change |
| Full-doc vs chunk display | New conditional everywhere | Existing `is_full_doc` branch (`CitationCard.tsx:56`) | Reuse for peek + footer |
| Cross-provider uniformity | Per-provider marker logic | The already-uniform `citations` SSE | Provider differences already resolved at the gateway (`_convert_messages_to_*`) |
| HTML sanitization for injected markers | Custom escaping | `DOMPurify` (already in pipeline) + trusted `createElement` for the `<sup>` | Avoids XSS surface; markers are DOM nodes we create, not re-parsed HTML |

**Key insight:** the honesty guarantee (a marker can only point at something the agent truly retrieved this run) is enforced structurally by making the backend the sole author of both the footer set AND the in-text markers, derived from the SAME `unique_citations`. Any frontend-side re-derivation would re-introduce the fabrication risk D-02 exists to eliminate.

## Runtime State Inventory

This is a render/interaction + additive-backend phase, **not** a rename/migration. No runtime state is renamed or migrated.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Persisted `messages.content` will now carry validated `[n]` markers going forward; `messages.source_refs` unchanged (already the citation set). Historical messages have no markers in `content` and simply render footer-only (D-06) — graceful, no backfill. | None — verified additive; old rows degrade to footer-only. |
| Live service config | None — no external service config references citations. | None — verified by scope (Deep chat + agent loop only). |
| OS-registered state | None. | None. |
| Secrets/env vars | None. | None. |
| Build artifacts / installed packages | None — no new package, no migration (`supabase/migrations/` untouched). | None — verified: no schema change (`source_refs` column already exists). |

## Common Pitfalls

### Pitfall 1: Anthropic drops the citation instruction (SC#10 break)
**What goes wrong:** Injecting the instruction as a mid-list `system` message → Anthropic emits no markers → cross-provider regression.
**Why it happens:** `_convert_messages_to_anthropic` strips mid-list system messages (`anthropic_service.py:72–74`); native providers take `system_prompt` as a separate top-level param.
**How to avoid:** Apply the note to BOTH `active_system_prompt` (native) and `messages[0].content` (compat).
**Warning signs:** Live UAT shows markers on OpenAI/Google but not Anthropic.

### Pitfall 2: `[n]` collision with markdown/code
**What goes wrong:** Regex-replacing `[n]` corrupts `[label](url)` links, `arr[1]` in code, or footnote text.
**Why it happens:** `[n]` is not a unique token; the model's answer contains other bracketed integers.
**How to avoid:** Walk parsed-HTML text nodes and skip `code`/`pre`/`a` ancestors; only upgrade `[n]` where `n∈[1, citations.length]`. Apply the same code-span skip in the backend `normalize_citation_markers`.
**Warning signs:** A code block shows a clickable `[1]`, or a link renders half-broken.

### Pitfall 3: DOMPurify strips the marker's interactive attributes
**What goes wrong:** `tabindex`/`role`/`aria-label` on an injected `<sup>` get sanitized away → keyboard-unreachable markers (the Phase 117 HIGH a11y fail).
**Why it happens:** DOMPurify's default attribute allow-list may not preserve `tabindex` on arbitrary injected HTML.
**How to avoid:** Do NOT inject interactive attributes via the sanitized HTML string. Create the `<sup>` with `document.createElement` in a post-mount effect (a node we own — no re-sanitize) and set `tabindex`/`role`/`aria-label`/listeners programmatically. `[ASSUMED]` that DOMPurify would strip `tabindex` — the createElement approach sidesteps the question entirely; verify during implementation if the string-injection route is chosen instead.
**Warning signs:** Tab key skips the markers; axe reports focusable-name violations.

### Pitfall 4: Marker flash before the settle reconcile lands
**What goes wrong:** In the window between terminal (runStatus=completed) and the fire-and-forget `getMessages` reconcile, the raw streamed blob (with un-normalized model markers) is briefly visible.
**Why it happens:** The reconcile is `.catch(()=>{})` fire-and-forget (`StreamsProvider.tsx:1991–2009`).
**How to avoid:** Range-check markers (`n∈[1,k]`) so out-of-range raw markers stay literal; OR add the normalized answer to the `citations` SSE and swap in the terminal handler immediately (belt-and-suspenders). Non-member-but-in-range flashes are rare because the model cites sources it was shown.
**Warning signs:** A marker briefly points at the wrong footer row, then corrects.

### Pitfall 5: Regressing the shared render / streaming-narration path (G-5)
**What goes wrong:** Editing the shared `MarkdownRenderer` or the `StreamingNarration` branch breaks non-cited or user messages.
**Why it happens:** `MessageItem.tsx:451` `MarkdownRenderer` is used for ALL assistant content; `:449` `StreamingNarration` handles the live tool path.
**How to avoid:** Introduce `CitedMarkdown` used ONLY when `message.citations?.length`; leave `MarkdownRenderer` byte-identical; never give the streaming path markers. Re-run the replay/render tests (`MessageItem.test.tsx`, streaming provider tests).
**Warning signs:** User-message rendering changes; streaming narration fold behavior changes.

### Pitfall 6: Fabricated / broken markers (Pitfall 14)
**What goes wrong:** A marker points at nothing, or a post-hoc process invents attributions.
**Why it happens:** Trusting the model's raw markers without set-membership validation.
**How to avoid:** Backend strip (D-02) before persist; frontend renders only in-range markers keyed 1:1 to `citations`. Never re-ask the model to attribute (D-04).
**Warning signs:** A rendered marker with no matching footer row; a greyed/unclickable marker.

## Code Examples

### Backend: normalize markers at settle (pure, unit-testable)
```python
# NEW helper next to _deduplicate_citations (agent_loop.py:851). Pure — no I/O.
# Source of truth for numbering (D-03); strips non-members (D-02).
def normalize_citation_markers(text: str, unique_citations: list[dict]) -> str:
    """Rewrite [n] markers so survivors match the footer 1..k; drop the rest.

    `unique_citations` is the finalized, order-preserving dedup set (the footer).
    A marker n emitted by the model refers to the source at manifest position n.
    Because the manifest was built from the same dedup order, valid n already
    aligns; out-of-range / non-member markers are removed (claim reads unmarked).
    Skips [n] inside code spans/blocks (Pitfall 2).
    """
    k = len(unique_citations)
    # ... walk text outside `code`/fenced blocks; keep [n] iff 1 <= n <= k; drop others.
    # (renumber is a safety identity when the manifest and dedup order coincide.)
    return normalized
# Call site (agent_loop.py ~:2781, after unique_citations[:] = _deduplicate_citations(...)):
#   full_content = normalize_citation_markers(full_content, unique_citations)
```

### Frontend: cited-path gate in MessageItem (G-5 minimal)
```tsx
// MessageItem.tsx:451 — settled assistant path. Only the cited branch is new.
{message.role === "assistant" && message.citations?.length ? (
  <CitedMarkdown content={dedupParagraphs(message.content)} citations={message.citations} />
) : (
  <MarkdownRenderer content={message.role === "assistant" ? dedupParagraphs(message.content) : message.content} />
)}
// Non-cited assistant + user messages stay byte-identical on MarkdownRenderer (D-14 / G-5).
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sources-list footer only (unnumbered, collapsed) | Per-claim inline markers + numbered footer + click-through, set-membership attribution | This phase (2026-07) | Converged industry pattern (Glean/Beam); trust story = a marker can only point at a truly-retrieved source |
| Post-hoc "which source supports this claim?" re-ask | Set-membership (marker n = citations[n]) | Locked (D-01) | Eliminates fabricated attributions (Pitfall 14) |

**Deprecated/outdated:**
- Any design that greys out or renders "citation unavailable" markers — forbidden; D-02 strips non-members before render (UI-SPEC §Forbidden copy).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Option 1A (per-result inline ordinal) would improve model citation accuracy vs the 1B manifest | Discretion #1 | Low — 1B recommended; A1 only affects whether to invest in the richer variant. Resolve via UAT. |
| A2 | DOMPurify would strip `tabindex` from injected marker HTML | Pitfall 3 | Low — the recommended `createElement` post-mount approach sidesteps it regardless; only matters if the string-injection route is chosen. |
| A3 | Weaker/non-compliant models emit zero or few valid markers and must degrade to footer-only (D-07) | Cross-Provider Floor | Medium — this is the explicit floor; must be confirmed per-provider via live UAT, not assumed. |
| A4 | The existing terminal reconcile (`:1988–2011`) fires reliably enough that the optional normalized-content SSE field is not required | Discretion #2 | Low-Medium — the SSE enhancement is the fallback if UAT shows a persistent pre-reconcile flash. |

## Open Questions

1. **"Open document" cross-view navigation carrying a `document_id`.**
   - What we know: the doc-detail surface is `IngestionPage`'s `DocumentDetailPanel`, opened by local `selectedDocId` state (`IngestionPage.tsx:88,136–138,558–566`); app navigation is view-based via `ActiveView` (`App.tsx:73`), not react-router paths.
   - What's unclear: there is no existing mechanism to switch to the documents view AND pre-select a doc by ID from another surface.
   - Recommendation: the planner adds a lightweight cross-view "pending document intent" (e.g., a shared store field set alongside `setActiveView("documents")`, consumed by `IngestionPage` to `setSelectedDocId`). Small, additive; verify the doc is visible to the user (owner/RLS) before opening.

2. **Multi-search-round manifest completeness vs single injection.**
   - What we know: refreshing the note from the current deduped set each retrieval turn keeps the manifest complete.
   - What's unclear: whether refreshing (vs one-shot) measurably changes model behavior or prompt-cache economics on Anthropic.
   - Recommendation: refresh each retrieval turn (correctness first); measure cache impact in UAT if latency regresses.

## Environment Availability

This phase is code-only (no new external tools/services/runtimes). The one runtime dependency is the already-running app + provider keys for the cross-provider UAT.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Live provider keys (OpenAI, Anthropic, Google, OpenRouter) | SC#10 cross-provider marker UAT | ✓ (per prior phases 151/152 UAT) | — | OpenRouter axis may be blocked by external BUG-260714-02 (tool-404) — operator-accepted precedent from Phase 152 |
| Local Supabase + Redis (running app) | Live settle/reconcile UAT | ✓ | local containers | — |
| uvicorn (operator-started) | Load changed `agent_loop.py` | ✓ | — | Operator must restart uvicorn after backend edits |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** OpenRouter cross-provider axis (external tool-404 bug) — degrade per D-07 (footer-only) and operator-accept as in Phase 152 if the bug persists.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Backend: pytest (`asyncio_mode=auto`, `pytest.ini`, `testpaths=tests`). Frontend: vitest + jsdom + Testing Library (`vitest.config.ts`, setup `src/setupTests.ts`). |
| Config file | `backend/pytest.ini`; `frontend/vitest.config.ts` |
| Quick run command | Backend: `cd backend && venv/Scripts/python -m pytest tests/unit/test_153_citation_markers.py -x`. Frontend: `cd frontend && npx vitest run src/components/chat/__tests__/CitedMarkdown.test.tsx` |
| Full suite command | Backend: `cd backend && venv/Scripts/python -m pytest tests/unit -q`. Frontend: `cd frontend && npm test` (`vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CITE-01 | Backend strips out-of-range/non-member `[n]` against a synthetic citation set (D-02) | unit | `pytest tests/unit/test_153_citation_markers.py::test_strips_non_members -x` | ❌ Wave 0 |
| CITE-01 | Backend renumbers survivors 1..k to footer order (D-03) | unit | `pytest tests/unit/test_153_citation_markers.py::test_renumbers_to_footer -x` | ❌ Wave 0 |
| CITE-01 | `[n]` inside a code span/block is NOT treated as a marker (Pitfall 2) | unit | `pytest tests/unit/test_153_citation_markers.py::test_skips_code_spans -x` | ❌ Wave 0 |
| CITE-01 | Non-retrieval turn → instruction NOT injected → prompt byte-identical (D-12/D-14) | unit | `pytest tests/unit/test_153_citation_instruction.py::test_no_inject_without_retrieval -x` | ❌ Wave 0 |
| CITE-01 | Injection reaches BOTH `active_system_prompt` and `messages[0]` on a retrieval turn (SC#10) | unit | `pytest tests/unit/test_153_citation_instruction.py::test_dual_channel_inject -x` | ❌ Wave 0 |
| CITE-01 | Frontend renders `[n]` in settled content as interactive `<sup>` keyed to `citations[n-1]`; range-checks n | unit | `npx vitest run …/CitedMarkdown.test.tsx` | ❌ Wave 0 |
| CITE-01 | Footer numbered, open-by-default when markers exist; marker↔row bidirectional flash | unit | `npx vitest run …/CitationList.test.tsx` | ❌ Wave 0 (extend existing `CitationCard.test.tsx`) |
| CITE-01 | Full-doc peek shows "Full document" affordance + Open document, no snippet/score (D-10) | unit | `npx vitest run …/CitationPeek.test.tsx` | ❌ Wave 0 |
| CITE-01 | Non-cited assistant + user messages render byte-identical (G-5 non-regression) | unit | `npx vitest run …/MessageItem.test.tsx` | ✅ extend |
| CITE-01 | Streaming-narration / `dedupParagraphs` path unchanged | unit | `npx vitest run …/StreamsProvider*.test.tsx` | ✅ extend |

### Sampling Rate
- **Per task commit:** the touched-surface quick suite (the new backend marker test OR the touched frontend component test).
- **Per wave merge:** backend `pytest tests/unit -q` touched-surface subset + `npm test` (vitest run); frontend `npx vite build` (0 net-new tsc errors vs the captured ~30-error SEED-056/049 baseline).
- **Phase gate:** full suites green + the SC#10 4-axis live UAT below before `/gsd:verify-work`.

### SC#10 UAT axes (authored under VALIDATION.md, NOT plan tasks — per CLAUDE.md UAT recipe)
- **Cross-provider:** one representative model each for OpenAI, Anthropic, Google, OpenRouter — confirm markers render on native providers and degrade to footer-only where the model emits none (D-06/D-07). OpenRouter axis may be blocked by external BUG-260714-02 (operator-accept precedent).
- **Multi-tool:** one prompt exercising `search_documents` + `fetch_document_file`/full-doc in one answer — both chunk and full-doc citations produce markers/rows (D-09/D-10).
- **Parallel-thread:** Thread A streaming (calm, unmarked) while Thread B accepts a new prompt — markers attach on A's settle without bleeding into B.
- **Long-message:** ≥50 prior messages OR ≥5KB prompt — settle reconcile still swaps to normalized content; no marker flash/drift.
- **Non-regression:** a general-knowledge (no-retrieval) turn renders nothing extra (no footer, no markers, no ⓘ) and is byte-identical to today (D-14).

### Wave 0 Gaps
- [ ] `backend/tests/unit/test_153_citation_markers.py` — strip/renumber/code-span (pure helper).
- [ ] `backend/tests/unit/test_153_citation_instruction.py` — retrieval-gated dual-channel injection, byte-identical off-retrieval.
- [ ] `frontend/src/components/chat/__tests__/CitedMarkdown.test.tsx` — marker parse/render/range-check.
- [ ] `frontend/src/components/chat/__tests__/CitationPeek.test.tsx` — chunk + full-doc peek variants, pin, Esc, a11y name.
- [ ] `frontend/src/components/chat/__tests__/CitationList.test.tsx` — numbering + open-by-default + marker↔row flash (or extend existing `CitationCard.test.tsx`).
- [ ] Extend `MessageItem.test.tsx` + streaming provider tests for the G-5 non-regression assertions.

## Security Domain

`security_enforcement` is absent from `.planning/config.json` → treated as enabled. This phase is read-only / mutation-free; the meaningful surface is output-encoding of injected markers and attribution integrity.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (no auth surface) |
| V3 Session Management | no | — |
| V4 Access Control | yes (narrow) | "Open document" deep-link must respect owner/RLS visibility — only open a doc the current user can see (reuse existing doc-fetch gates). |
| V5 Input/Output Validation | **yes** | Marker injection into `dangerouslySetInnerHTML` — sanitize via existing `DOMPurify`; create marker `<sup>` via trusted `document.createElement` (never re-inject unsanitized model text). Backend strip/renumber is itself an output-integrity control. |
| V6 Cryptography | no | — |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Model emits `<script>`/HTML inside a claim that becomes a marker host | Tampering / XSS | `DOMPurify.sanitize` already runs on the parsed HTML; markers are created as owned DOM nodes, not re-parsed from model text |
| Fabricated attribution (marker → non-retrieved source) | Spoofing / Repudiation of the trust story | Set-membership validation (D-02) strips non-members before persist; frontend renders only in-range markers (Pitfall 14) |
| Deep-link opens a document the user cannot access | Information Disclosure | Gate "Open document" on the existing owner/RLS-scoped doc fetch; never open by raw `document_id` without a visibility check |
| Cross-provider fork sneaks into the shared path | Tampering (SC#10/D-14 break) | Injection applied only via the provider-uniform `(system_prompt, messages[0])` channel; provider specifics stay in `_convert_messages_to_*` adapters |

## Project Constraints (from CLAUDE.md)

- **No LangChain / LangGraph — raw SDK calls only.** The injection + normalization are plain Python in `agent_loop.py`; no framework.
- **Pydantic for structured LLM outputs.** N/A here — markers are free-text in the answer, validated by set-membership, not a structured schema. (Do not add a structured-output path — the whole point of D-01 is set-membership over the free-text answer.)
- **MODEL_CAPABILITIES registry / provider routing at the service boundary.** Honor it — no `provider ==` branch on the shared citation path; provider specifics already live in `_convert_messages_to_anthropic`/`_convert_messages_to_google`/`openai_compat`.
- **Provider-docs-first (evidence-based).** The cross-provider injection finding (Anthropic drops mid-list system messages) was verified against the actual adapter code; any prompt-density tuning must be validated per-provider via live cross-provider UAT, not assumed to transfer 1:1.
- **SSE streaming for chat; stateless completions.** Reuse the existing `citations` SSE + delta stream; do not add provider-side thread state.
- **Python backend uses venv.** Run backend tests via `backend/venv`.
- **G-5 hot files (ledger, both satisfied at 075.7):** `MessageItem.tsx` + `StreamsProvider.tsx` — additive only, re-run replay/render tests, do not regress. **`backend/app/api/threads.py` MUST stay untouched.**
- **Operator starts uvicorn** — plans must flag "restart uvicorn to load changed `agent_loop.py`" before UAT; never run backend in background.
- **Sketch-findings skill** (`.claude/skills/sketch-findings-agentic-rag/SKILL.md`) — auto-load when building `MessageItem`/`CitationList`/`MarkdownRenderer`/the citation surfaces; the markers must sit inside the Aether Deep Midnight calm-instrument language (accent `--primary` reserved for markers/`[n]`/active-row/Open-document per UI-SPEC §Color).

## Sources

### Primary (HIGH confidence) — verified this session against HEAD
- `backend/app/services/agent_loop.py` — `_deduplicate_citations` (:851), accumulation (:1718–1719, :2524–2525), settle + `citations` SSE (:2775–2790), persist (:1479–1534), delta stream (:1878), system-prompt assembly (:1231–1410, :2011, :2086), Phase 149 injection precedent (:2097–2106).
- `backend/app/services/tool_dispatcher.py` — chunk citations (:711–752), full-doc citations (:1031–1108), `ToolResult` (:173–178).
- `backend/app/services/anthropic_service.py` — mid-list system message DROP (:56–74).
- `backend/app/services/google_service.py` — system message → `system_instruction` fold (:115–141).
- `backend/app/services/provider_gateway/{anthropic,google,dispatcher}.py` — `system_prompt` as top-level param.
- `frontend/src/components/chat/MessageItem.tsx` — `dedupParagraphs` (:220), render branches (:442–459).
- `frontend/src/components/chat/MarkdownRenderer.tsx` — marked+DOMPurify+dangerouslySetInnerHTML pipeline.
- `frontend/src/components/chat/{CitationList,CitationCard}.tsx` — footer + is_full_doc branch.
- `frontend/src/providers/StreamsProvider.tsx` — reducer invariant (:367–373), `onCitations` (:839), terminal reconcile / attach-on-settle (:1988–2011).
- `frontend/src/lib/api.ts` — `_mapMessageResponse` source_refs→citations (:143–171), SSE citations parse (:748–749).
- `frontend/src/types/index.ts` — `Citation`/`SourceReference` (:106–119).
- `frontend/src/pages/IngestionPage.tsx` — `DocumentDetailPanel` open-by-`selectedDocId` (:88,136–138,558–566); `frontend/src/App.tsx` — `ActiveView` (:73).
- `.planning/phases/153-inline-citations/153-CONTEXT.md`, `153-UI-SPEC.md` (operator-approved design contract).
- `.planning/config.json` (nyquist_validation true), `frontend/vitest.config.ts`, `backend/pytest.ini`.

### Secondary (MEDIUM confidence)
- `.planning/research/SUMMARY.md` — Pitfall 14 (set-membership, never post-hoc re-ask), converged Glean/Beam industry pattern, Phase-4 rationale (:59, :91–96, :108).
- `.planning/STATE.md` — Phase 151/152 UAT precedent (OpenRouter tool-404 external-block operator-accept; false-green-avoidance convention).

### Tertiary (LOW confidence)
- Prompt-density wording — drafted from the sketch contract + industry pattern; exact wording is Claude's Discretion and must be tuned via live cross-provider UAT (D-07).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all reused libs verified in `package.json` and in the live render path.
- Architecture / seams: HIGH — every data-flow hop verified line-by-line against HEAD; the attach-on-settle reconcile and the Phase 149 injection precedent are real, cited code.
- Cross-provider injection finding: HIGH — Anthropic system-drop confirmed in `anthropic_service.py:72–74`.
- Prompt density wording: LOW-MEDIUM — design-sound but requires per-provider UAT validation (D-07).
- Pitfalls: HIGH for #1/#2/#5/#6 (code-verified); MEDIUM for #3/#4 (mitigations sidestep the uncertainty).

**Research date:** 2026-07-15
**Valid until:** 2026-08-14 (30 days — stable internal codebase; re-verify line numbers if `agent_loop.py`/`StreamsProvider.tsx`/`MessageItem.tsx` churn before planning).

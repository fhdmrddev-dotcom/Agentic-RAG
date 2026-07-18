# Phase 153: Inline Citations - Pattern Map

**Mapped:** 2026-07-15
**Files analyzed:** 9 (4 net-new + 5 modified) + Wave-0 test files
**Analogs found:** 8 / 9 (2 partial — the hover-peek/pin portal and the ⓘ teaching popover reuse Radix primitives but the exact affordance is net-new)

> Every line number below was re-verified against HEAD this session (not copied from
> RESEARCH.md). Where RESEARCH.md and HEAD agree, that is noted; nothing drifted.
> This phase is a **pure render/interaction + additive-backend layer** over the already
> provider-uniform `citations` channel — no schema, no new package, no `provider ==` fork,
> and `backend/app/api/threads.py` stays UNTOUCHED (G-5 red line).

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `frontend/src/components/chat/CitedMarkdown.tsx` | component | transform (md→HTML→DOM marker inject) | `MarkdownRenderer.tsx` + `MessageItem.tsx:442–459` | exact (pipeline) |
| `frontend/src/components/chat/CitationPeek.tsx` | component | event-driven (hover/focus/click→portal popover) | `components/ui/tooltip.tsx` (Radix primitive) + `CitationCard.tsx:56–60` | partial |
| `frontend/src/components/chat/AbsenceHint.tsx` | component | event-driven (ⓘ → non-blocking popover) | `components/ui/tooltip.tsx` (Radix primitive) + tiered-guidance ⓘ pattern | partial |
| `backend/app/services/citation_markers.py` (or helper by `_deduplicate_citations`) | utility (pure fn) | transform | `_deduplicate_citations()` `agent_loop.py:851` | exact (shape) |
| `backend/app/services/agent_loop.py` (MOD) | service | streaming / transform | (self — settle + Phase-149 inject seams) | in-place |
| `frontend/src/components/chat/CitationList.tsx` (MOD) | component | request-response (render) | (self — restructure) | in-place |
| `frontend/src/components/chat/CitationCard.tsx` (MOD) | component | request-response (render) | (self — add `[n]` + Open) | in-place |
| `frontend/src/components/chat/MessageItem.tsx` (MOD, **G-5 hot**) | component | request-response (render) | (self — additive branch only) | in-place |
| `frontend/src/providers/StreamsProvider.tsx` (MOD, **G-5 hot**) | provider / store | streaming / event-driven | (self — reuse existing reconcile) | in-place |

Wave-0 test files (all ❌ net-new except two ✅ extends) — see §"Wave 0 Test Files".

---

## Pattern Assignments

### `frontend/src/components/chat/CitedMarkdown.tsx` (component, transform) — NET-NEW

**Analog:** `frontend/src/components/chat/MarkdownRenderer.tsx` (the whole file) — the exact
`marked` + `DOMPurify` + `dangerouslySetInnerHTML` pipeline to reuse, plus `MessageItem.tsx:451`
for the settled-assistant call site.

**Reuse this pipeline verbatim** (`MarkdownRenderer.tsx:1–33`) — memoized parse+sanitize:
```typescript
import { useMemo } from "react"
import { marked } from "marked"
import DOMPurify from "dompurify"
import { cn } from "@/lib/utils"

marked.setOptions({ gfm: true, breaks: true })

const html = useMemo(
  () => DOMPurify.sanitize(marked.parse(content) as string),
  [content],
)
return (
  <div
    className={cn("markdown text-sm text-foreground leading-relaxed", className)}
    dangerouslySetInnerHTML={{ __html: html }}
  />
)
```

**What `CitedMarkdown` adds on top (net-new, no analog in-repo):** after the sanitized HTML is
mounted via a `ref`, a `useLayoutEffect` walks text nodes (`TreeWalker`), skips `code`/`pre`/`a`
ancestors, and replaces `[n]` (only where `n ∈ [1, citations.length]`) with a **trusted `<sup>`
created via `document.createElement`** — a node the component owns, so no DOMPurify re-pass and
no reliance on DOMPurify preserving `tabindex`/`role`/`aria-label` (Pitfall 3). Wire
`aria-label="Citation {n}: {filename}"`, `role="button"`, `tabindex="0"`, and delegated
hover/focus/click listeners programmatically (UI-SPEC §Marker Contract + §A11y).

**Why a NEW component and not an edit to `MarkdownRenderer`:** `MarkdownRenderer` is the shared
assistant+user render path. Keep it byte-identical; the cited branch is opt-in (see MessageItem
below). `react-markdown` (already installed) was rejected — switching the renderer risks the
shared `dedupParagraphs`/streaming path (G-5).

---

### `frontend/src/components/chat/CitationPeek.tsx` (component, event-driven) — NET-NEW

**Analog (partial):** `frontend/src/components/ui/tooltip.tsx` — the repo's Radix-primitive
wrapper pattern (the closest existing "positioned floating card over the answer"). NOTE:
`createPortal` is used **nowhere** in `frontend/src/**/*.tsx` today (verified) — the peek's
absolutely-positioned/portaled popover + click-to-pin lifecycle is genuinely net-new; see
§"No Analog Found".

**Radix-primitive wrapping shape to mirror** (`ui/tooltip.tsx:12–26`) — surface tokens + motion:
```typescript
<TooltipPrimitive.Content
  ref={ref}
  sideOffset={sideOffset}
  className={cn(
    "z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm " +
    "text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 …",
    className
  )}
  {...props}
/>
```
Use `bg-popover` / `border` / `shadow` tokens the same way; the UI-SPEC overrides sizing
(`width: 320px`, `--radius-md`, `padding: 12px 14px`, `z-index: 60`, positioning
`top = markerRect.bottom + scrollY + 8`, `left = min(markerRect.left, viewportWidth − 340)`).

**Full-doc vs chunk branch — copy this exact conditional** from `CitationCard.tsx:55–61`:
```tsx
<span className="text-muted-foreground/50 shrink-0">
  {citation.is_full_doc
    ? "Full document"
    : citation.chunk_index != null
      ? `Chunk ${citation.chunk_index + 1}`
      : ""}
</span>
```
Peek chunk variant → head `[n] {filename}` + snippet (`passage`, italic) + footer
`{loc} ↗ Open document`. Peek full-doc variant (D-10) → head + "Full document — no single
passage" + footer `↗ Open document` only (no snippet/score). Version suffix reuse
`CitationCard.tsx:51–54` (`(v{version_number})` when `> 1`). Passage may be null/≤400 (D-04) —
degrade to head + Open document, never an error banner (UI-SPEC §Error state).

**A11y (load-bearing, feeds Phase 155):** pin toggle needs a state-toggled name
(`aria-label="Pin citation {n}"` / `"Unpin citation {n}"`); pinned peek = `role="dialog"`
`aria-modal="false"` labelled by its head; Esc closes + restores focus to the marker; use
`--muted-foreground` (NOT the `--muted-foreground-dim` 3.6:1 trap) for meaningful text.

---

### `frontend/src/components/chat/AbsenceHint.tsx` (component, event-driven) — NET-NEW

**Analog (partial):** `frontend/src/components/ui/tooltip.tsx` — the existing Radix tooltip primitive (already vendored,
non-blocking, keyboard-reachable, never a banner). The ⓘ affordance follows the tiered-guidance ⓘ pattern (rule #13):
a quiet inline dot + label that reveals a teaching popover on hover/focus. No new package, no `createPortal` needed —
reuse the Radix tooltip surface.

**What it renders (UI-SPEC §Component Inventory "Absence-as-signal ⓘ popover" + §Copywriting):** one quiet inline row under
the answer — a lucide `Info` dot (rest `--muted-foreground-dim`, hover/focus → `--primary`, per §Color rule #6) + the VERBATIM
inline label "Unmarked claims read as general knowledge"; the ⓘ reveals the VERBATIM popover body "Unmarked sentences are the
model's general knowledge. Only claims grounded in what the agent retrieved this run carry a citation. No citation = not from
your documents." (lead sentence weight 600). Meaningful text (label + body) uses `--muted-foreground` (AA), never
`--muted-foreground-dim`. Both strings render at `text-xs` (§Typography).

**Gating (parity with the marker/footer):** `AbsenceHint` returns null when `!citations?.length`; `MessageItem` mounts it once
under the answer body ONLY on the settled cited-assistant branch — never on the streaming-narration/user path (G-5 additive).
It is NEVER a banner (no `role="alert"`/`role="banner"`, no always-open block) and non-blocking (tooltip, not a modal).

---

### `backend/app/services/citation_markers.py` (utility, transform) — NET-NEW

**Analog:** `_deduplicate_citations()` at `agent_loop.py:851–860` — the pure-helper shape to
mirror (no I/O, order-preserving, unit-testable). RESEARCH allows co-locating next to it OR a
new module; a new `citation_markers.py` keeps `agent_loop.py` (a G-5-adjacent hot file) leaner.

**Copy this pure-helper shape** (`agent_loop.py:851–860`):
```python
def _deduplicate_citations(citations: list[dict]) -> list[dict]:
    """Deduplicate citations by (document_id, chunk_index), preserving order (D-14)."""
    seen: set[tuple] = set()
    unique: list[dict] = []
    for c in citations:
        key = (c["document_id"], c.get("chunk_index"))
        if key not in seen:
            seen.add(key)
            unique.append(c)
    return unique
```

**New helper (D-02/D-03):** `normalize_citation_markers(text: str, unique_citations: list[dict]) -> str`
— finds `[n]` outside code spans/fences (same skip discipline as the frontend, Pitfall 2), keeps
`[n]` iff `1 <= n <= len(unique_citations)` (drops out-of-range/non-members → claim reads
unmarked, D-02), renumbers survivors to the `unique_citations` 1-based order (D-03). Pure — no
Redis, no DB, no `await`. `unique_citations` IS the canonical footer set, so its ordering is the
single source of numbering truth.

---

### `backend/app/services/agent_loop.py` (service, streaming/transform) — MODIFIED

**Two additive seams — both are self-analogs (mirror existing in-file precedent).**

**Seam A — settle/normalize/persist** (`agent_loop.py:2775–2803`, current state):
```python
# Emit citations event (D-03, D-07: after sources, before confidence)
unique_citations[:] = _deduplicate_citations(retrieved_citations)      # :2781  ← authoritative set
if unique_citations:
    sse_citations = []
    for c in unique_citations:
        sse_c = dict(c)
        if sse_c.get("passage") and len(sse_c["passage"]) > 400:
            sse_c["passage"] = sse_c["passage"][:400]
        sse_citations.append(sse_c)
    await _emit(redis, run_id, 'citations', citations=sse_citations)   # :2790  ← SSE fires
...
await _persist_assistant_message()                                      # :2803  ← persist
```
**Additive edit (D-05):** immediately after `:2781`, reassign
`full_content = normalize_citation_markers(full_content, unique_citations)` so the persisted
`content` at `:1505` (`content = _strip_nul(full_content)`) already carries only validated,
renumbered markers. `source_refs = unique_citations` persists unchanged at `:1511–1512`. No new
SSE event required — the frontend attach-on-settle reconcile delivers the normalized text live
(see StreamsProvider below).

**Persist call site to respect** (`agent_loop.py:1501–1514`, do not restructure):
```python
row: dict = { "thread_id": thread_id, "user_id": current_user["id"],
              "role": "assistant", "content": _strip_nul(full_content) }   # :1505
...
if unique_citations:
    row["source_refs"] = unique_citations   # Full citation objects (D-13)   # :1511–1512
```

**Seam B — retrieval-turns-only dual-channel instruction injection** — mirror the Phase 149
STRUCTURED-tools injection at `agent_loop.py:2097–2106` (current state):
```python
if calling_mode == CallingMode.STRUCTURED and tool_choice == "auto" and not _structured_tools_injected:
    _tl_fb = _format_tool_list(active_tools if active_tools is not None else get_tools(user_settings))
    for _fi, _fm in enumerate(messages):
        if _fm.get("role") == "system":
            messages[_fi] = {
                "role": "system",
                "content": _fm["content"] + TOOL_USAGE_INSTRUCTIONS.format(tool_list=_tl_fb),
            }
            _structured_tools_injected = True
            break
```
**Citation injection follows the SAME `messages[0]` loop BUT ALSO appends to
`active_system_prompt`**, gated on `if retrieved_citations:` (empty on every non-retrieval turn →
byte-identical, D-12/D-14). Both `GatewayRequest` branches already forward
`system_prompt=active_system_prompt` — native at **`agent_loop.py:2011`**, compat at
**`agent_loop.py:2086`** — AND `messages=messages`, so the `(system_prompt, messages[0])` pair is
the only channel that reaches all 8 providers (see Shared Pattern §Dual-channel).

---

### `frontend/src/components/chat/CitationList.tsx` (component, render) — MODIFIED

**Analog:** self (`CitationList.tsx:11–44`, current state). Three additive changes only.

```tsx
export function CitationList({ citations }: Props) {
  const [open, setOpen] = useState(false)          // :12  ← change default to open-when-markers
  if (!citations.length) return null                // :13  (D-06 footer always renders when set exists)
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-3">   // :16
      <CollapsibleTrigger asChild>
        <button aria-expanded={open} className="… text-xs text-muted-foreground …">
          {open ? <ChevronDown … /> : <ChevronRight … />}
          {citations.length} source{citations.length !== 1 ? "s" : ""}   // :27  → "References · N sources"
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="… duration-200 …">
        <div className="mt-2 flex flex-col gap-2">
          {citations.map((c, i) => (
            <CitationCard key={`${c.document_id}-${c.chunk_index ?? "full"}-${i}`}
              citation={c} />                        // :34–39  → pass index `n = i+1` + marker↔row link
          ))}
```
Changes: (1) default open when valid markers exist on the message (else keep `useState(false)`) —
the ONE default-state change (D-06/D-07, UI-SPEC §References Footer); (2) header copy →
`References · {N} source(s)`; (3) thread `n = i+1` + a bidirectional flash handler (marker↔row,
`scroll-margin-top: 70px`, `--primary/15%` bloom auto-clearing ~1700ms) down to each row.
Keep the existing `Collapsible` (do not hand-roll disclosure — "Don't Hand-Roll").

---

### `frontend/src/components/chat/CitationCard.tsx` (component, render) — MODIFIED

**Analog:** self (`CitationCard.tsx:31–95`, current state). Add the `[n]` number, an
`↗ Open document` link, and reuse the existing `is_full_doc` branch untouched.

**`is_full_doc` branch already present** (`CitationCard.tsx:55–61`) — reuse for full-doc rows
(D-09/D-10: `· Full document`, no chunk/similarity):
```tsx
<span className="text-muted-foreground/50 shrink-0">
  {citation.is_full_doc ? "Full document"
    : citation.chunk_index != null ? `Chunk ${citation.chunk_index + 1}` : ""}
</span>
```
**Version suffix reuse** (`:51–54`): `(v${version_number})` when `> 1`. **Passage line reuse**
(`:64–73`, `line-clamp-2` + Show more) unchanged. Additive: a mono `[n]` (`--font-mono`, weight
600, `--primary`) leading the row + `↗ Open document` primary link; the row becomes a
`<button>`/focusable with `aria-label` (filename + location) for the row→marker direction.
**Accent `--primary` is reserved** for the `[n]`, the active/flash state, and the Open-document
link only (UI-SPEC §Color) — never filenames/body/generic hover.

---

### `frontend/src/components/chat/MessageItem.tsx` (component, render) — MODIFIED · **G-5 HOT (additive only)**

**Analog:** self (`MessageItem.tsx:442–459`, current state). The ONLY new thing is the cited
branch; the shared render path stays byte-identical.

```tsx
{message.content ? (
  <div className="text-sm text-foreground">
    {isMessageStreaming && (message.tool_calls?.length ?? 0) > 0 && message.role === "assistant" ? (
      <StreamingNarration content={dedupParagraphs(message.content)} />              // :449 — NEVER give markers
    ) : (
      <MarkdownRenderer content={message.role === "assistant"
        ? dedupParagraphs(message.content) : message.content} />                     // :451 — keep byte-identical
    )}
    …
    {message.citations && message.citations.length > 0 && (
      <CitationList citations={message.citations} />                                 // :457–458
    )}
```
**Additive seam (G-5-safe, from RESEARCH §Code Examples):** swap in `CitedMarkdown` ONLY on the
settled assistant path when `message.citations?.length`:
```tsx
{message.role === "assistant" && message.citations?.length ? (
  <CitedMarkdown content={dedupParagraphs(message.content)} citations={message.citations} />
) : (
  <MarkdownRenderer content={message.role === "assistant" ? dedupParagraphs(message.content) : message.content} />
)}
```
- `dedupParagraphs` (`MessageItem.tsx:220`) still runs first — markers are mid-sentence, untouched.
- The `StreamingNarration` branch (`:449`) is NEVER given markers ("body streams calm & unmarked").
- Non-cited assistant + all user messages stay on `MarkdownRenderer` (D-14). Re-run
  `MessageItem.test.tsx` for the non-regression assertion.
- **Also mounts `AbsenceHint`** (the quiet absence-as-signal ⓘ, 074-A) ONCE under the answer body on the SAME cited-assistant
  branch (`message.role === "assistant" && message.citations?.length`) — never on the streaming/user path; see the AbsenceHint
  section above.

---

### `frontend/src/providers/StreamsProvider.tsx` (provider/store, streaming) — MODIFIED · **G-5 HOT (verify, likely no code change)**

**Analog:** self. RESEARCH's key finding: the "attach-on-settle" seam **already exists** — no new
event, no reducer change needed. Verify these three ranges hold; do NOT regress.

**Terminal reconcile / attach-on-settle** (`StreamsProvider.tsx:1988–2011`, current state) —
already swaps raw streamed `content` → persisted normalized `content`:
```tsx
if (kind === "done" || kind === "reader_done") {                    // :1988
  const rid = registeredRunId
  if (rid) {
    getMessages(threadId)
      .then((persisted) => {
        const answer = persisted.find((m) => m.runId === rid && m.role === "assistant")
        if (!answer) return
        useStreamsStore.getState().actions.setMessagesForBucket(surfaceId, threadId, (prev) =>
          prev.map((m) =>
            m.runId === rid && m.role === "assistant" && m.content !== answer.content
              ? { ...m, content: answer.content }                    // :2004 — normalized markers ride in here
              : m,
          ),
        )
      })
      .catch(() => {})
  }
}
```
Because the backend-normalized `content` differs from the raw streamed blob, this existing swap
delivers the validated markers live. **This is the seam — no new SSE event.**

**`onCitations`** (`:839–842`, current state) — already maps `citations` onto the message; do NOT
mutate `content` here (reducer invariant):
```tsx
onCitations: (citations: Citation[]) => {
  setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, citations } : m)))
}
```

**Reducer invariant to preserve** (`:367–373`): "Only `onDelta` may mutate `content`, and only by
appending." The content swap lives in the terminal handler (outside `makeStreamCallbacks`) — do
NOT move it into `onCitations`. Re-run `StreamsProvider*.test.tsx` (anthropic-ordering / replay).

---

## Shared Patterns

### Dual-channel retrieval-turns-only instruction injection (SC#10 by construction)
**Source:** `agent_loop.py:2097–2106` (Phase 149 precedent) + both `GatewayRequest` branches
(native `:2011`, compat `:2086`) + the anti-pattern proof `anthropic_service.py:72–74`.
**Apply to:** the `agent_loop.py` injection edit (Seam B) only.
```python
# anthropic_service.py:72–74 — WHY a mid-list system message is NOT enough:
if role == "system":
    i += 1
    continue  # extracted to top-level system param by caller  →  Anthropic never sees it
```
Rule: append the note to **both** `active_system_prompt` (reaches native `system_prompt=`) **and**
`messages[0].content` (reaches compat, which reads `messages[0]`). Gate on `if retrieved_citations:`
→ byte-identical on non-retrieval turns (D-12/D-14). Never a `provider ==` fork on the shared path.

### Set-membership is enforced by ONE authority (the honesty core)
**Source:** `_deduplicate_citations()` `agent_loop.py:851` → the SAME set numbers the footer AND
the in-text markers.
**Apply to:** `citation_markers.py` (normalize helper) + `CitationList`/`CitationCard` numbering.
The backend is the sole author of both the footer set and the markers, derived from the same
`unique_citations`. Any frontend-side re-derivation re-introduces the fabrication risk D-02 exists
to kill. Frontend still range-checks (`n ∈ [1, citations.length]`) as belt-and-suspenders.

### Code-span skip (Pitfall 2) — mirror in both tiers
**Apply to:** the backend `normalize_citation_markers` AND the frontend `CitedMarkdown` TreeWalker.
Never a naive `content.replace(/\[\d+\]/)` — it corrupts `[label](url)`, `arr[1]` in code, and
footnote text. Backend skips code spans/fences; frontend skips `code`/`pre`/`a` ancestor nodes.

### Full-doc vs chunk branch reuse (D-09/D-10)
**Source:** `CitationCard.tsx:55–61` (`is_full_doc ? "Full document" : chunk_index != null ? …`).
**Apply to:** `CitationPeek` (full-doc variant) + `CitationCard` full-doc rows. One branch, reused.

### Aether Deep Midnight — accent discipline
**Source:** `.claude/skills/sketch-findings-agentic-rag/SKILL.md` + UI-SPEC §Color; tokens live in
`frontend/src/index.css :.dark`.
**Apply to:** all three new/restructured citation components. `--primary` is reserved
EXCLUSIVELY for the `¹` marker, the `[n]` ref-number, the active/flashed row, the pinned-peek
ring, and the "Open document" link — never body/filenames/generic hover (those use `--accent` /
`--muted-foreground`). Meaningful muted text must clear 4.5:1 → use `--muted-foreground`, NOT the
`--muted-foreground-dim` (~3.6:1) trap flagged at Phase 117/088-05.

### Attach-on-settle reconcile — don't hand-roll a "final answer" event
**Source:** `StreamsProvider.tsx:1988–2011`.
**Apply to:** the backend persist edit — normalize `full_content` BEFORE persist so the existing
reconcile carries the markers live; reload is byte-identical because both read the same persisted
`content`.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `frontend/src/components/chat/CitationPeek.tsx` (peek→pin portal lifecycle) | component | event-driven | `createPortal` is used NOWHERE in `frontend/src/**/*.tsx` (verified). No existing absolutely-positioned/portaled hover-peek→click-to-pin popover with Esc/outside-click dismissal exists. Closest primitives are Radix `ui/tooltip.tsx` (surface tokens + motion classes) and the `is_full_doc` branch from `CitationCard.tsx` (content shape) — reuse those; the positioning + pin-state machine + focus management is genuinely net-new. Follow UI-SPEC §Click-through Contract + §A11y as the spec of record (the sketch IS the acceptance bar). |
| `normalize_citation_markers` behavior (strip + renumber over parsed text) | utility | transform | The *shape* has an analog (`_deduplicate_citations`), but the code-span-aware `[n]` parse/strip/renumber logic is new. Author against RESEARCH §"Backend: normalize markers at settle" + the Wave-0 unit tests. |

---

## Wave 0 Test Files

| Test file | Status | Mirrors |
|-----------|--------|---------|
| `backend/tests/unit/test_153_citation_markers.py` | ❌ net-new | pure-helper unit style (no I/O) — strip non-members / renumber / skip code spans |
| `backend/tests/unit/test_153_citation_instruction.py` | ❌ net-new | dual-channel inject reaches `active_system_prompt` + `messages[0]`; byte-identical off-retrieval |
| `frontend/src/components/chat/__tests__/CitedMarkdown.test.tsx` | ❌ net-new | vitest + Testing Library — marker parse/render/range-check |
| `frontend/src/components/chat/__tests__/CitationPeek.test.tsx` | ❌ net-new | chunk + full-doc variants, pin, Esc, a11y name |
| `frontend/src/components/chat/__tests__/AbsenceHint.test.tsx` | ❌ net-new | renders-under-cited-answer / not-a-banner / non-blocking popover / null-on-no-citations |
| `frontend/src/components/chat/__tests__/CitationList.test.tsx` | ❌ net-new (or extend `CitationCard.test.tsx`) | numbering + open-by-default + marker↔row flash |
| `frontend/src/components/chat/__tests__/MessageItem.test.tsx` | ✅ extend | G-5 non-regression: non-cited assistant + user render byte-identical |
| `frontend/src/providers/__tests__/StreamsProvider*.test.tsx` | ✅ extend | reducer invariant + `dedupParagraphs`/streaming-narration path unchanged |

Run commands (from RESEARCH §Validation Architecture): backend
`cd backend && venv/Scripts/python -m pytest tests/unit/test_153_citation_markers.py -x`;
frontend `cd frontend && npx vitest run src/components/chat/__tests__/CitedMarkdown.test.tsx`.

---

## Metadata

**Analog search scope:** `frontend/src/components/chat/`, `frontend/src/components/ui/`,
`frontend/src/providers/`, `frontend/src/types/`, `backend/app/services/`.
**Files scanned / verified against HEAD:** `MarkdownRenderer.tsx`, `CitationCard.tsx`,
`CitationList.tsx`, `MessageItem.tsx` (:200–240, :435–474), `ui/tooltip.tsx`, `types/index.ts`
(:100–125), `StreamsProvider.tsx` (:360–374, :828–855, :1982–2018), `agent_loop.py`
(:845–884, :1495–1539, :2000–2018, :2078–2106, :2770–2814), `anthropic_service.py` (:54–77).
**Line-drift check:** all RESEARCH.md references matched HEAD exactly — no adjustment needed.
**Pattern extraction date:** 2026-07-15

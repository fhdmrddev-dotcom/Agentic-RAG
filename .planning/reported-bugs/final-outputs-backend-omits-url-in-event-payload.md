---
id: BUG-260522-01
surface: Agentic-RAG
severity: major
status: open
affected_areas: [backend/agent-loop, backend/api/threads, backend/services/sandbox_service, frontend/components/chat/MessageItem]
folded_into: null
re_open_trigger: null
related: [BUG-260521-02, D-075.2-05]
captured: 2026-05-22
captured_during: phase-075.2-chrome-mcp-uat
---

# Final Outputs pinned panel cannot click-to-download — backend SSE event payload omits URL

## What we observed

After Phase 075.2 Plan 02 shipped the `<OutputFileCard>` reuse in `MessageItem.tsx:255-264`, Chrome MCP UAT
(Anthropic claude-sonnet-4-6, primes-matplotlib recipe) showed the pinned "Final outputs" panel rendering
the card stack correctly **but** with the `url`-absent fallback: download icon muted to `opacity-40`, no
size badge, no click target.

DOM evidence:
```html
<div data-testid="final-outputs-panel">
  <div>Final outputs</div>
  <div>
    <div class="ghost-border bg-muted/30">
      <svg class="lucide lucide-download opacity-40" ...>  <!-- url-absent muted state -->
      <span class="font-mono text-foreground/60 truncate">primes.png</span>
    </div>
  </div>
</div>
```

React fiber inspection at the same render confirmed the data shape:
```js
message.finalOutputFiles === [{ filename: "primes.png" }]   // no url, no size
```

Meanwhile the per-cell `<OutputFileCard>` inside the same tool card rendered correctly with the link
(`http://localhost:8000/sandbox-outputs/.../primes.png`) and size badge (`38.2 KB`) — proving URL data
is fully available elsewhere in the same message.

## Root cause (backend)

`backend/app/services/sandbox_service.py:185` collapses the harvest output to filenames only when
populating the cumulative set passed back to the agent loop:

```python
current_files_set = {f["filename"] for f in output_files}   # discards url + size
```

`backend/app/api/threads.py:1574` maintains the cumulative set as `set[str]`:

```python
_previous_files_in_run: set[str] = set()
```

And the SSE emit at `threads.py:2896-2902` projects only filenames into the event payload:

```python
if _previous_files_in_run:
    await _emit(
        redis,
        run_id,
        'final_output_files',
        files=[{"filename": fname} for fname in sorted(_previous_files_in_run)],
    )
```

So even though `harvest_output_files` builds the full `{filename, url, size}` triple at
`sandbox_service.py:175-179`, the agent loop deliberately drops `url` and `size` when
maintaining the cumulative cross-iteration set. The pinned panel's `final_output_files` event
is therefore filename-only by design.

## Why Phase 075.2 didn't catch this

Phase 075.2 CONTEXT.md `<domain>` explicitly locked "Any backend changes — Out of scope" and
RESEARCH.md §Q4 documented `url-optional handling: prop-level back-compat inside the card`
based on the assumption that fresh `finalOutputFiles` entries would carry `url` and only
legacy persisted messages would need the muted fallback. Live UAT revealed the data-layer
assumption was wrong: the backend payload has been filename-only since Phase 075.1
Plan 04 Atom E shipped (B-260519-11). The pinned panel's `<li>{filename}</li>` rendering
hid this fact for the past week.

## What works after Plan 02

- OutputFileCard extraction to shared module (`frontend/src/components/chat/OutputFileCard.tsx`)
- Per-cell rendering unchanged (still clickable with size badge — proves the refactor itself is sound)
- Pinned panel uses the card shape (visual consistency vs the per-cell entry — what the user asked for visually)
- Url-absent fallback renders correctly (muted icon + monospace filename + reduced opacity row)

## What still doesn't work

- Click-to-download from the pinned panel (because the card never receives a `url` prop)
- File-size badge in the pinned panel (because the card never receives a `size` prop)

## Suggested fix

Promote `_previous_files_in_run` from `set[str]` to `dict[str, {url: str, size: int}]` (or a
list of dicts) so the cumulative shape preserves the URL + size pair. Three sites change:

1. `backend/app/services/sandbox_service.py:185-189` — return the cumulative as a
   filename-keyed dict instead of a set of filenames. The delta-filter at line 188 also
   updates.
2. `backend/app/api/threads.py:1574` — type annotation `dict[str, dict]` instead of `set[str]`.
   The 4-iteration agent loop already passes the cumulative back to `harvest_output_files`
   verbatim, so call site at 2699-2703 keeps the same shape contract.
3. `backend/app/api/threads.py:2896-2902` — project the dict values into the SSE payload
   with full `{filename, url, size}` triples.

No migration. No new dependency. No frontend changes (the OutputFileCard already accepts
the url + size shape — it just falls back when they're absent). Estimated effort:
~30 lines, two backend files. Add a Vitest expectation in
`MessageItem.finalOutputs.test.tsx` that exercises the url-present branch with a
real URL.

## Re-open trigger

If a future phase ships a fix to `_previous_files_in_run` that wires URL + size through
the SSE event, this bug closes on Chrome MCP UAT verifying click-to-download from the
pinned panel on Anthropic primes-matplotlib (the same recipe used to surface this).

## Cross-references

- `.planning/phases/075.2-toolcallpanel-dedup-final-outputs-download-link/075.2-CONTEXT.md`
  D-075.2-05 (reuse intent), `<domain>` lock (why this wasn't caught), `<deferred>` section
  (where this should land after capture)
- `.planning/reported-bugs/final-outputs-pinned-panel-no-download-link.md` — the original
  BUG-260521-02 report which Phase 075.2 Plan 02 closed presentationally; this new bug
  is the data-layer half that Plan 02 deliberately left for a future phase
- `.planning/phases/075-seed-008-tool-args-progress-polish-bundle/075-CONTEXT.md` —
  Plan 04 Atom E (B-260519-11) origin of the `set[str]` cumulative shape

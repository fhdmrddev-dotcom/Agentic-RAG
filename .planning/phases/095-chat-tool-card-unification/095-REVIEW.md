---
phase: 095-chat-tool-card-unification
reviewed: 2026-06-06T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - backend/app/services/agent_loop.py
  - frontend/src/components/chat/MessageItem.tsx
  - frontend/src/components/chat/MessageList.tsx
  - frontend/src/components/chat/OutputFileCard.tsx
  - frontend/src/components/chat/RunCard.tsx
  - frontend/src/components/chat/RunStatusStrip.tsx
  - frontend/src/components/chat/ToolCallPanel.tsx
  - frontend/src/index.css
findings:
  critical: 0
  warning: 1
  info: 4
  total: 5
status: issues_found
---

# Phase 095: Code Review Report

**Reviewed:** 2026-06-06
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Reviewed the Phase 095 gap-closure changes (plans 06-09, diff base `13f16749..HEAD`)
across the four named focus areas: the ToolCallPanel per-step expand `Set` +
essence line + active bloom (Plan 06), the RunCard/RunStatusStrip header chrome
(Plan 07), the OutputFileCard/MessageItem/MessageList file-axis fidelity
(Plans 05/08), and the `agent_loop.py` single-hero `_select_hero_filenames`
backend fix (Plan 09).

The backend hero-selection logic is correct and well-defended. The single-hero
tie-break (`_hero_pick`: max size, then iteration) is now applied identically
across all three branches (agent-declared, requested-ext, fallback), so every
non-empty input collapses to exactly one hero. Most importantly, live emit and
persisted reload now provably agree: the per-cell persist writes an `is_hero=False`
placeholder (because `_previous_files_in_run` is only partial mid-loop), and a
single post-loop re-stamp recomputes every persisted `execute_code` row against
the one canonical `_hero_set` computed over the COMPLETE file set — the same set
the `final_output_files` SSE emit uses. The re-stamp mutates `persisted_tool_calls`
in place BEFORE the bound `_persist_assistant_message` closure (which reads that
list by reference at call time) is invoked by the shielded finalizer, so ordering
is sound. The `final_output_files` event shape is unchanged except for the additive
`is_hero` key, and the flag is presentation-only — it never feeds the owner-fenced
re-sign download path (`url`/`filename`/`size` are untouched). Direct `meta["size"]`
/ `meta["filename"]` indexing is safe because those metas come from
`harvest_output_files`'s `current_files_dict`, which always populates
`filename`/`url`/`size`/`iteration`.

React state correctness is solid: `expandedSteps` is a component-local `Set`
re-derived from `toolCalls` each render (survives the preparing→running→done id
mutation and DB reload), all updaters use the functional `(prev) => ...` form (no
stale closures), and per-step identity is keyed on the stable
`clientKey ?? id ?? composite` chain rather than the React reconciliation index.
The count consistency claim holds: `unifiedStepCount`/`dedupToolCalls`
(`@/lib/stepCount`) is the single source the header, strip, collapsed-row, and rail
snum all read.

No XSS surface was introduced. Model/sandbox-derived filenames reach the render
layer only through `fileIcon()` (parsed extension label via React text children)
and `OutputFileCard` (filename as text children). No `dangerouslySetInnerHTML`
appears on any user/model-derived path; `RunStatusStrip`'s only grep match was its
own "never raw-HTML innerHTML" doc comment. The shared chat-surface changes stay
additive/derivation-only — no StreamsProvider/api.ts/backend wire changes — so the
cross-provider path is unaffected. The `index.css` change is a purely cosmetic swap
of the active-tool glow for an inset bloom (no keyframes, no behavior).

The one Warning is a cross-plan visual regression: Plan 07 gave the
`placement="header"` strip its own pill chrome, which invalidated an assumption
baked into Plan 08's floating "Jump to live" chip — the chip now double-frames.

## Warnings

### WR-01: Plan 07 header-pill chrome double-frames Plan 08's floating "Jump to live" chip

**File:** `frontend/src/components/chat/MessageList.tsx:194-216` (in conjunction with `frontend/src/components/chat/RunStatusStrip.tsx:58-60`)

**Issue:** Plan 08 mounts `RunStatusStrip` with `placement="header"` *inside* the
floating chip button, deliberately relying on the header placement rendering as
plain text with no pill. The MessageList comment states this explicitly
(lines 186-188): *"the strip is mounted with placement='header' INSIDE it so the
live-status segments render as plain text WITHOUT a second nested pill border (a
placement='floating' strip would double-frame inside this pill)."*

At the diff base, `placement="header"` rendered only `"text-muted-foreground"`
(plain text, no border). Plan 07 (commit `011b7309`) then changed the header
placement to render a full pill:
`"rounded-full border border-border bg-[hsl(220_30%_11%/0.8)] px-2.5 py-1 text-muted-foreground"`.

The outer floating button (MessageList:201) is itself a
`rounded-full border border-primary/50 bg-popover/92 ...` pill. The result is a
pill-inside-a-pill — the exact nested double-frame Plan 08's comment intended to
avoid. The comment is now stale and the rendered chip contradicts its documented
intent. This is the kind of cross-plan interaction (07 changed the chrome, 08 still
assumes the pre-07 plain-text header) that live/visual UAT should catch but a
wire-format check would not.

**Fix:** Give the floating chip a variant of the strip that renders the segments
without the pill chrome. Cleanest option — add a segment-only placement (or a
`bare` flag) that yields only the inline segment markup, and use it in the floating
chip; keep the pill for the genuine standalone header chip:

```tsx
// RunStatusStrip.tsx — segment-only mode for embedding inside another pill
placement === "header-bare"
  ? "text-muted-foreground"           // plain segments, no nested pill
  : placement === "header"
    ? "rounded-full border border-border bg-[hsl(220_30%_11%/0.8)] px-2.5 py-1 text-muted-foreground"
    : "rounded-full border border-primary/40 bg-popover/92 px-3 py-1.5 shadow-lg backdrop-blur-md"
```

```tsx
// MessageList.tsx floating chip
<RunStatusStrip
  elapsedLabel={chipElapsed}
  stepCount={chipStepCount}
  activityVerb="Streaming…"
  placement="header-bare"   // was "header" — avoid the nested pill
/>
```

Alternatively, drop the outer button's pill chrome and let the strip's header pill
be the chip frame. Either way, update the now-inaccurate MessageList comment.

## Info

### IN-01: `snum` falls back to 0 for keyless+idless tools when skills are interleaved

**File:** `frontend/src/components/chat/ToolCallPanel.tsx:476-482, 692`

**Issue:** `toolStepNumber` is built over `deduplicatedToolCalls` using that list's
index (`idx`), but `stepKeyOf(tc, i)` is called in the render loop with the
`displayItems` index (`i`). For the normal case (live SSE or DB rows carrying
`clientKey`/`id`) the composite fallback is never reached, so the indices are
irrelevant and keys match. Only when BOTH `clientKey` and `id` are absent AND skill
activations are interleaved (which makes `displayItems` order diverge from
`deduplicatedToolCalls` order via the timestamp sort) does the composite key
`${tc.name}-${tc.startedAt ?? ''}-${idx}` differ between the two derivations —
causing `toolStepNumber.get(stepKeyOf(tc, i))` to miss and `snum` to render `0`.
This affects only legacy DB rows lacking both identity fields with interleaved
skills; it is cosmetic (a step shows "0") and does not corrupt the expand `Set`
(which keys add and check on the same `stepKeyOf(tc, i)` within a render pass).

**Fix:** Derive the step number from the same `stepKeyOf` the render loop uses, or
build `toolStepNumber` from a key that does not depend on a list-specific index.
Lowest-risk: when computing `snum`, fall back to
`toolStepNumber.get(tc.clientKey ?? tc.id ?? '')` first, then accept the composite
only as a last resort — or assign snum from the tool's position among tool-kind
`displayItems` entries.

### IN-02: Stale "075.6 ... collapse-at-3+ / N=3 collapse predicate" comments after Plan 06 removed the gate

**File:** `frontend/src/components/chat/ToolCallPanel.tsx:514-568`; `frontend/src/components/chat/RunCard.tsx:304-308`

**Issue:** Plan 06 replaced the shared `>=3` collapse boolean with the per-step
`expandedSteps` Set ("Focus Mode from step 1 — no >=3 gate", lines 535-546). But
several adjacent comments still describe the removed mechanism: the "075.6 Plan 03
/ SPEC Req #7: step-list collapse predicate ... Threshold N=3 locked" block
(lines 514-524) and RunCard's "step-list collapse-at-3+" comment (line 305).
`completedBeforeActive`/`collapsedIterationMin` (lines 528-568) survive only to
feed the `data-iteration-min` debug attribute that is now placed on a single row —
verify it still earns its keep.

**Fix:** Update the comments to describe the per-step Set model, and remove
`completedBeforeActive`/`collapsedIterationMin` if the `data-iteration-min` hint is
no longer load-bearing (it reads like a debug-only attribute).

### IN-03: `panelExpanded` and `expandedSteps` are never pruned when tool identities disappear

**File:** `frontend/src/components/chat/ToolCallPanel.tsx:510-554`

**Issue:** Both `panelExpanded` (Record) and `expandedSteps` (Set) accumulate keys
and are never garbage-collected. In practice ToolCallPanel is keyed per-run in
MessageList (`run-${runId}` / `msg.id`) and remounts on identity change, so the
maps reset and unbounded growth is not a real leak within a single run. Worth a
one-line note that the per-run remount is what bounds these — otherwise a future
refactor that stops remounting the panel would silently leak expand state across
runs. (Out of v1 perf scope; flagged as a maintainability note only.)

**Fix:** Add a comment documenting that the per-run remount bounds these maps, or
prune keys not present in `deduplicatedToolCalls` if the panel is ever made
long-lived.

### IN-04: `FinalOutputsPanel` keys hero/working cards by array index

**File:** `frontend/src/components/chat/MessageItem.tsx:87-88, 110-111`

**Issue:** `OutputFileCard` instances are keyed `hero-${i}` / `working-${i}` by
array position. Since `filename` is the natural stable identity of an output file
(already required on the prop), index keys are slightly less robust if the file
list is ever reordered or filtered between renders (the working group is derived
via `.filter` on `is_hero`, so its positions are already not 1:1 with the source
array). No current bug because the list is static once terminal, but filename keys
would be sturdier.

**Fix:** Key on the filename: ``key={`hero-${f.filename}`}`` /
``key={`working-${f.filename}`}`` (dedup is already guaranteed upstream by the
content-hash harvest, so collisions are not a concern).

---

_Reviewed: 2026-06-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

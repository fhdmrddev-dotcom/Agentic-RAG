# Tool-Call Panel

The single-tool component (G-5 hot file in `frontend/src/components/chat/ToolCallPanel.tsx` — 5+ historical touches). From sketch **002 (tool-call-panel)**.

## Design Decisions

### D1 — Tool call = editor inset; code is the focus

`execute_code` renders as a real editor pane: line-number gutter, syntax-highlighted code, lang-chip. Not a generic "code block in a card" — it should feel like a Jupyter cell or a Cursor inline edit.

**Why it won (vs. Unified Card / Stacked Step Rows):**
- Unified Card (002-A) is the current pattern: one container with args in head + plain mono body. Refinement-only. The body becomes opaque when content gets dense — same issue that drove ToolCallPanel's 5+ touches.
- Stacked Step Rows (002-B) decomposed each call into observable phases (args → sandbox warm → run → capture). Honest but vertical-space hungry; stacking 4-5 of these inside a run-card creates excessive scrolling.
- Editor Inset (002-C) makes the *code itself* legible at a glance — and pushes the per-tool nature of the rendering forward (different tools = different inner shapes, same outer frame).

### D2 — Different tools get different inner shapes; same outer frame

The outer container (header + collapsible body) is shared. The inner content varies per tool:

| Tool | Inner shape |
|------|-------------|
| `execute_code` | Editor pane (gutter + syntax + lang chip) + STDOUT/STDERR labeled regions + file-output preview cards |
| `search_documents` | Query meta row + ranked-result rows (score, doc name, chunk pointer) |
| `read_file` | File metadata row + preview (snippet for text, file card for binary) |
| `write_skill` / `list_files` / etc | Custom — design per-tool when added |

**Implementation note:** the outer frame is one React component (`<ToolCallPanel tool={...} status={...} />`); the inner is a tool-specific render (`<ExecuteCodeBody>`, `<SearchDocumentsBody>`, etc.) selected by tool name. Don't force every tool through a single string-template body — that was the root pain of the current implementation.

### D3 — STDOUT and STDERR are labeled regions

When a tool produces stream output, the stream lives below the code in its own region with a small uppercase label (`STDOUT`, `STDERR`). Active streams show a pulsing dot + "streaming" indicator in the divider; completed streams show a line count.

STDERR rows render in `#ffa198` (close to the existing destructive token but readable on the editor-dark `#0d1117` background).

**Why this matters:** failure-mode triage is fast — `STDERR · traceback` immediately tells the user what region to read.

### D4 — File outputs lift to inline preview cards

When `execute_code` produces a file (chart.png, output.csv, .pptx, etc.), it doesn't appear as plain text in STDOUT (`[chart saved to chart.png]`). It appears as a small preview card with:

- File-type icon (gradient bg matching the brand)
- File name + sub-meta (size, library, click hint)
- Action button (Open / Download)

```
┌─────────────────────────────────────────────────┐
│  📈   chart.png                                  │
│       142 KB · matplotlib · click to view    [Open] │
└─────────────────────────────────────────────────┘
```

This is the Claude.ai analysis-tool pattern. Outputs deserve their own visual surface.

### D5 — Status pill is the universal state indicator

Every tool head carries a status pill in the right edge:

| State | Pill |
|-------|------|
| running | `[●] running` — `var(--color-primary)` on `var(--color-primary-dim)` — dot animates with `dotBounce` |
| done | `[●] done · 11.3s` (or `[●] 4 results · 1.2s`) — `var(--color-success)` on `var(--color-success-dim)` |
| failed | `[●] failed · 0.8s` — `var(--color-danger)` on `var(--color-danger-dim)` |

Duration is shown only on completed/failed states. Running pills show the verb (`running`, `searching`, `reading`).

### D6 — Active tool gets a glow border + bottom progress bar

When a tool is mid-execution:

```css
.tc.active {
  border-color: var(--color-primary-glow);
  box-shadow: 0 0 24px hsl(239 100% 82% / 0.18);
}
```

A 2px progress shimmer bar lives at the bottom of the tool card (NOT the top — top is reserved for the run-card's progress bar to avoid double-shimmer noise).

### D7 — Click-to-expand by default; auto-expanded only when active

Tool heads are click-to-expand. Default state when complete = **collapsed**. Default state when `status === 'running'` = **open**. This matches Focus Mode (see `live-run-container.md` D3).

Visual affordance: chevron icon on the right that rotates 90° when open.

## CSS Patterns

### Outer frame (shared across tool types)

```css
.tc {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.tc.active {
  border-color: var(--color-primary-glow);
  box-shadow: var(--shadow-glow-primary);
}
.tc.err.active {
  border-color: var(--color-danger);
  box-shadow: 0 0 24px hsl(0 72% 51% / 0.18);
}
.tc-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: hsl(220 30% 8% / 0.65);
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  transition: background var(--dur-fast);
}
.tc-body { display: none; }
.tc.open .tc-body { display: block; }
```

### Editor inset (for execute_code)

```css
.tc-editor {
  display: grid;
  grid-template-columns: 32px 1fr;
  background: #0d1117;       /* editor dark — same as existing markdown pre */
  max-height: 180px;
  overflow-y: auto;
}
.tc-gutter {
  background: hsl(220 30% 7%);
  color: var(--color-text-dim);
  font-family: var(--font-mono);
  font-size: 11px;
  text-align: right;
  padding: 8px 6px 8px 0;
  line-height: 1.7;
  user-select: none;
  border-right: 1px solid var(--color-border);
}
.tc-code {
  padding: 8px 12px;
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1.7;
  color: #c9d1d9;
  white-space: pre;
}
/* Syntax tokens (GitHub-dark palette) */
.tc-code .kw  { color: #ff7b72; }   /* keyword */
.tc-code .str { color: #a5d6ff; }   /* string */
.tc-code .num { color: #79c0ff; }   /* number */
.tc-code .fn  { color: #d2a8ff; }   /* function */
.tc-code .cmt { color: #8b949e; font-style: italic; }
```

### STDOUT/STDERR divider + output region

```css
.tc-divider {
  display: flex;
  align-items: center;
  padding: 5px 12px;
  background: hsl(220 30% 9%);
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--color-text-dim);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.tc-divider .live {
  margin-left: auto;
  color: var(--color-primary);
  display: flex;
  align-items: center;
  gap: 6px;
}
.tc-divider .live .dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: currentColor;
  animation: dotBounce 1.4s ease-in-out infinite;
}
.tc-output {
  padding: 8px 12px;
  background: #0d1117;
  font-family: var(--font-mono);
  font-size: 11px;
  color: #c9d1d9;
  max-height: 120px;
  overflow-y: auto;
  line-height: 1.65;
}
.tc-output .line.stderr { color: #ffa198; }
```

### File-output preview card

```css
.tc-chart-preview {
  margin: 6px 12px 8px;
  padding: 10px;
  background: linear-gradient(135deg, hsl(220 30% 9%), hsl(220 30% 11%));
  border: 1px solid var(--color-border);
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.tc-chart-preview .chart-icon {
  width: 36px; height: 36px;
  border-radius: 6px;
  background: linear-gradient(135deg, var(--color-primary-strong), var(--color-accent-violet));
  display: flex; align-items: center; justify-content: center;
  color: #fff;
  font-size: 16px;
}
```

### Status pill (universal)

```css
.pill {
  font-family: var(--font-mono);
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 3px 8px;
  border-radius: var(--radius-full);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}
.pill .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.pill.running { background: var(--color-primary-dim); color: var(--color-primary); }
.pill.running .dot { animation: dotBounce 1.4s ease-in-out infinite; }
.pill.done    { background: var(--color-success-dim); color: var(--color-success); }
.pill.err     { background: var(--color-danger-dim);  color: var(--color-danger); }

@keyframes dotBounce {
  0%, 100% { transform: translateY(0); opacity: 0.4; }
  50%      { transform: translateY(-4px); opacity: 1; }
}
```

## HTML Structures

### execute_code — running

```html
<div class="tc active open">
  <div class="tc-head">
    <div class="tc-icon">▶</div>
    <div class="tc-name">execute_code</div>
    <span class="tc-lang">python</span>
    <span class="pill running"><span class="dot"></span>running</span>
  </div>
  <div class="tc-body">
    <div class="tc-editor">
      <div class="tc-gutter"><div>1</div><div>2</div>…</div>
      <div class="tc-code"><!-- highlighted code --></div>
    </div>
    <div class="tc-divider">
      <span>STDOUT</span>
      <span class="live"><span class="dot"></span>streaming</span>
    </div>
    <div class="tc-output">
      <div class="line">q3_rev = 28.4</div>
      <div class="line new">yoy_q3 = 30.87<span class="caret"></span></div>
    </div>
  </div>
  <div class="run-progress"></div>     <!-- bottom shimmer -->
</div>
```

### execute_code — done with file output

```html
<div class="tc">
  <div class="tc-head"><!-- ✓ icon + done pill --></div>
  <div class="tc-body">
    <div class="tc-editor"><!-- code --></div>
    <div class="tc-divider"><span>STDOUT</span><span>7 lines</span></div>
    <div class="tc-output"><!-- output --></div>
    <div class="tc-chart-preview">
      <div class="chart-icon">📈</div>
      <div class="chart-meta">
        <div class="chart-name">chart.png</div>
        <div class="chart-sub">142 KB · matplotlib · click to view</div>
      </div>
      <button>Open</button>
    </div>
  </div>
</div>
```

### search_documents — done (different inner shape, same outer frame)

```html
<div class="tc">
  <div class="tc-head">
    <div class="tc-icon done">🔍</div>
    <div class="tc-name">search_documents</div>
    <span class="tc-lang">query</span>
    <span class="pill done"><span class="dot"></span>4 results · 1.2s</span>
  </div>
  <div class="tc-body">
    <div class="tc-search-meta">
      <span class="k">query</span> › "Q3 2026 financial report" &nbsp;
      <span class="k">folder</span> › finance/
    </div>
    <div class="tc-search-results">
      <div class="tc-search-row">
        <span class="score">0.91</span>
        <div>Q3-2026-financials.pdf <span class="chunk">chunk 4 of 12</span></div>
      </div>
      <!-- … more rows … -->
    </div>
  </div>
</div>
```

### execute_code — error

```html
<div class="tc err active">
  <div class="tc-head">
    <div class="tc-icon err">!</div>
    <div class="tc-name">execute_code</div>
    <span class="tc-lang">python</span>
    <span class="pill err"><span class="dot"></span>failed · 0.8s</span>
  </div>
  <div class="tc-body">
    <div class="tc-divider"><span style="color:var(--color-danger);">STDERR</span></div>
    <div class="tc-output">
      <div class="line stderr">Traceback (most recent call last):</div>
      <div class="line stderr">  File "&lt;sandbox&gt;", line 3, in &lt;module&gt;</div>
      <div class="line stderr">ModuleNotFoundError: No module named 'scipy'</div>
    </div>
  </div>
</div>
```

## What to Avoid

- ❌ **Unified Card with one mono-block body (002-A)** — the existing pattern. Bug magnet because every tool type squeezes into the same opaque body.
- ❌ **Stacked Step Rows for every tool (002-B)** — pipeline-style decomposition (args → sandbox warm → run → capture) is great for CI views but vertical-space hungry. Inside a run-card with 4-5 tool cards it creates excessive scroll. Reserve for very-long-running tools if needed.
- ❌ **One string-template body for all tools** — current implementation's root pain. Always select an inner-body component by tool name; never try to render search results and matplotlib code through the same JSX path.
- ❌ **STDOUT and STDERR in the same region** — labeled regions matter. Failure triage needs an immediately-locatable error region.
- ❌ **File outputs as text in STDOUT** (`[chart saved to chart.png]`) — lift them to preview cards. Files deserve their own visual surface.
- ❌ **Top progress bar on the tool card** — reserved for the run-card. Tool-card progress lives at the bottom edge to avoid double-shimmer.
- ❌ **Auto-expand on done** — defaults: running = open, done = collapsed. Don't make the user collapse every completed step manually.

## Component Decomposition Sketch

```
<ToolCallPanel tool={tool} status={status} args={args} result={result} active={active}>
  <ToolHead icon={icon} name={tool.name} args={args} status={status} duration={duration} />
  {tool.name === 'execute_code'   && <ExecuteCodeBody     code={...} stdout={...} files={...} />}
  {tool.name === 'search_documents' && <SearchDocumentsBody query={...} results={...} />}
  {tool.name === 'read_file'      && <ReadFileBody         path={...} preview={...} />}
  {/* Add per-tool body components as tools are added. */}
  {active && <ProgressShimmer position="bottom" />}
</ToolCallPanel>
```

## Origin

Synthesized from sketch:
- `002-tool-call-panel` (winner: **C — Editor Inset**)

Source file: `sources/002-tool-call-panel/index.html` (all three variants preserved)

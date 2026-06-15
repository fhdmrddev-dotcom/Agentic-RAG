# Chat Tool-Card Unification (Phase 095)

The Deep-mode chat tool-call surface — **fixed and unified in place** (the cards stay in the chat;
094 D-01 kept them out of the panel). Synthesized from sketches **014 (unified-card-frame)**,
**015 (status-strip-and-scroll)**, **016 (output-files-hero)**. Refines the locked 001-C run-frame /
002-C tool-card / 003-B Focus-Mode language — not a new frame.

> **The one rule that governs the build: these three sketches are ONE component set, not three.**
> The honesty requirements (D-04 step count, D-05 zero-duplicate) are *single-source-of-truth*
> requirements, not styling. Build the inventory below ONCE; that is the phase. See
> `sources/095-grounding/CONSISTENCY.md` for the full drift audit.

---

## Design Decisions

### A. The unified card frame (sketch 014 — winner: Synthesis)

Every Deep tool card lives on **one borderless, step-numbered rail**:

- **Status nodes fill the rail** — filled-green = done, pulsing-primary ring = active, dim = queued —
  so the locked sequence is *felt* (B's instrument quality) **without per-card borders** (C's calm).
  The connecting line runs green up to the active node.
- **Resting state = one-line essence (D-01).** A finished card folds to a single calm line:
  `{step#} {icon} {tool} → {result}` (e.g. `🔍 search_documents → Found 14 chunks in "thesis.pdf" (avg 0.61)`).
  Essence text is **muted** (`--color-text-muted`); the active line is primary.
- **Focus Mode (D-02).** Only the step running *now* is open and live; it **blooms** (a
  `--color-primary-dim` wash + `inset 2px 0 0 --color-primary` left bar). As each finishes it folds to
  its essence and the next opens.
- **Click-to-expand (D-01).** Any finished essence row expands in place to its full per-tool body
  (search rows + confidence · read preview · code editor + STDOUT + file · sub-agent summary · todo
  list). Details are re-ranked, never hidden. Chevron rotates.
- **Row numbering is load-bearing.** The `{step#}` makes the honest count (D-04: the strip's "Step N"
  maps 1:1 to the numbered row) and zero-duplicate (D-05: a dup = two same-numbered rows) **structural**.

Why Synthesis won over the alternatives — A (flat essence rows) was calmest but gave no sequence
orientation on an 11-step run; B (bordered cards on a spine) gave orientation but re-introduced the
"wall of cards" the run-frame exists to avoid. Synthesis = A's low chrome + B's felt sequence.

### B. The honest status strip + follow-scroll (sketch 015 — winner: C, Hybrid)

A single `⏱ 3m12s · Step 5 · Running code…` strip that **never vanishes**:

- **Never-vanishes is a timer-derivation fix, not a placement choice.** Elapsed derives from a
  **stable start-timestamp** and renders **continuously** — immune to dropped SSE, background-tab
  `setInterval` throttling, and temp-id→DB-id remounts. It **freezes only on a TRUE terminal**
  (`stream_end`/`error`/`cancelled`/`timed_out`), never on a transient stream-end. This closes
  BUG-260528-01 (Kimi/Moonshot timer vanish, where the gate `isStreamingNow || elapsedMs>0` drops the
  whole timer mid-run).
- **Placement = hybrid (D-06).** The strip rides the run-card **header** while the run is in view (no
  chip occluding the live stream). The moment the user scrolls away, a **bottom live-chip** appears at
  the live edge carrying the full status + **"↓ Jump to live"**. Honest from both ends.
- **Smart follow-scroll (D-03).** Follow the live edge while at/near bottom; **release** the instant
  the user scrolls up (leave them in place); **re-arm** at the bottom; the Jump-to-live affordance
  appears whenever scrolled away. Standard ChatGPT/Claude.ai scroll discipline.

Why Hybrid won — A (header strip only) splits the eye on a tall run (timer at top, action at bottom);
B (bottom chip only) floats over the live content and loses identity at the top. C gives both with no
occlusion while following.

### C. Output files — hero / working split (sketch 016 — winner: A, Hero block)

At run end, **hero the deliverable the user asked for; keep intermediates present-but-quiet; every
link always downloads** (D-07/D-08):

- **Hero block.** The agent-flagged final output is a big "★ Your file" card with a prominent
  Download. Intermediates render as a quieter **"Working files (N)"** group — **visible by default**
  ("show all files") with a collapse affordance.
- **The agent flags the hero (D-08).** A small backend tag on the `final_output_files` payload marks
  the final deliverable (the agent knows the request intent). *(Exact field name = a planning/backend
  decision — render as "agent-flagged final output".)*
- **Always-downloadable, even tomorrow.** Every link works in one click and still works on a chat
  reopened the next day. **Investigate-first** the dead-link root (signed-URL 1h TTL vs sandbox
  cleanup vs `url`-missing entries), then re-sign on demand. Closes BUG-260514-01 with *re-rank
  instead of hide*.
- **Per-extension file icons.** Proper SVG file icons — a document with a folded corner, a
  type-specific glyph (text-lines · table grid · image · `</>` · slide bars), and a colored extension
  ribbon (`.PPTX` orange · `.PDF` red · `.DOCX` blue · `.CSV` green · `.PNG` violet · code teal),
  Untitled-UI / "40 file type" style. **One shared `fileIcon()` reused by the 014/015 chat file
  cards** (in code, a Lucide-based equivalent — FileText/Image/Table/Code/Presentation + colored ext
  label — is fine).

Why Hero block won — B (one list, starred hero) keeps everything visible but the hero is weaker;
C (hero card + chip row) is most compact but the chips hide metadata. A gives the strongest "this is
your file" emphasis while still showing the rest.

---

## Build-once component inventory (the canonical contract)

Build each row ONCE and share across the three concerns. **Forbid** re-introducing per-concern forks.

| Component / fn | Renders | Single source of truth |
|---|---|---|
| `RunFrame` | outer card: gradient bg, sticky header (avatar+title+sub+**strip slot**), progress bar, body, collapsed terminal row | `RunCard.tsx` (relabel "N tools"→"N steps") |
| `StepRail` + `StepRow` | rail (node+line+`snum`) · essence head · expand body; node states; active bloom | one wrapper; data = `(index, status)` from the `tool_calls` array |
| `ToolEssenceLine` | `#  icon · name → result · pill · chev` (active shows the verb) | `toolEssence(tool)` — one per-tool copy table (grounding §2) |
| `ToolBody` (per-tool) | expand body: search/read/code/sub-agent/todo | **ONE** renderer keyed by tool kind (reuse `ToolCallPanel` bodies) — collapses the `bodyHTML`/`detailHTML` fork |
| `RunStatusStrip` | `⏱ elapsed · Step N · activity` | ONE strip, **two placement wrappers** (header / floating chip); reads stable-start-ts elapsed + `unifiedStepCount()` + activity verb |
| `fileIcon` | SVG file icon (document + folded corner + glyph + ext ribbon) | ONE module; ext→(color, glyph-category) map |
| `OutputFileCard` (+Hero/Working) | generated-file row + hero emphasis + working group | **ONE** card (production already reuses it); hero/working = a layout flag + `dl-btn` states (idle/ok/dead) |
| `SubAgentEssence` | one-per-task sub-agent card + dedup badge | one component; the real D-05 fix = extend `clientKey`/`makeToolKey` to the sub-agent path |
| `unifiedStepCount()` | the single integer behind rail `snum`, strip "Step N", **and** collapsed "N steps" | ONE derivation — **the embodied D-04/D-05 fix** |
| `useFollowScroll` + `JumpToLive` | follow-edge / release / re-arm / jump | extend `MessageList` `isNearBottom` |

---

## CSS Patterns

### Rail + nodes + active bloom (the 014 winner)

```css
.step { display:grid; grid-template-columns:34px 1fr; border-radius:var(--radius-sm);
        animation:toolSlideIn var(--dur-base) var(--ease-out); }
.rail { position:relative; display:flex; justify-content:center; }
.node { position:absolute; top:12px; width:11px; height:11px; border-radius:50%;
        border:2px solid var(--color-success); background:var(--color-success); z-index:2; }      /* done */
.step.active .node { background:var(--color-bg); border-color:var(--color-primary);
        box-shadow:0 0 0 4px var(--color-primary-dim); animation:pulseGlow 1.6s ease-in-out infinite; }
.step.queued .node { background:var(--color-bg); border-color:var(--color-border); }
.rail-line { position:absolute; top:22px; bottom:-4px; width:2px; left:50%; transform:translateX(-50%);
        background:var(--color-success); }                                                         /* filled spine */
.step.active .rail-line { background:linear-gradient(180deg, var(--color-success), var(--color-primary)); }
.snum { font-family:var(--font-mono); font-size:10px; color:var(--color-success); }
.step.active .snum { color:var(--color-primary); font-weight:700; }
.step.active { background:var(--color-primary-dim); box-shadow:inset 2px 0 0 var(--color-primary); } /* bloom */
.ess-text { color:var(--color-text-muted); }            /* finished essence recedes */
.step.active .ess-text { color:var(--color-primary); }
```

### Status strip — one component, two homes (the 015 winner)

```css
.status-strip { display:inline-flex; align-items:center; font-family:var(--font-mono);
        font-size:var(--text-xs); background:hsl(220 30% 11% / .85); border:1px solid var(--color-border);
        border-radius:var(--radius-full); padding:4px; white-space:nowrap; }
.status-strip .seg.time::before { content:'⏱'; }
.status-strip .seg.act { color:var(--color-primary); }
.status-strip .seg.act .dot { width:6px; height:6px; border-radius:50%; background:currentColor;
        animation:dotBounce 1.4s ease-in-out infinite; }
.status-strip.done { color:var(--color-success); }      /* prefer the .done MODIFIER, not a parent selector */
/* the floating home (appears on scroll-away) reuses the SAME segment markup, wrapped: */
.live-chip { position:absolute; bottom:12px; left:50%; transform:translateX(-50%); z-index:30;
        border:1px solid var(--color-primary-glow); box-shadow:var(--shadow-lg), var(--shadow-glow-primary);
        border-radius:var(--radius-full); cursor:pointer; }
.live-chip .jump { background:var(--color-primary); color:hsl(216 45% 8%); border-radius:var(--radius-full);
        padding:3px 10px; font-weight:600; display:none; }
.live-chip.scrolled .jump { display:inline-flex; }      /* morphs to Jump-to-live when scrolled up */
```

### Smart follow-scroll (D-03)

```js
function nearBottom(vp){ return vp.scrollHeight - vp.scrollTop - vp.clientHeight < 56; }
vp.addEventListener('scroll', () => { following = nearBottom(vp); /* toggle .scrolled, show chip+jump */ });
function autoFollow(){ if (following) vp.scrollTop = vp.scrollHeight; }   // call on each stream tick
function jumpToLive(){ following = true; vp.scrollTop = vp.scrollHeight; }
```

### Output files — hero + working (the 016 winner)

```css
.hero { display:flex; align-items:center; gap:14px; padding:15px; border:1px solid var(--color-primary-glow);
        border-radius:var(--radius-lg); background:linear-gradient(135deg, hsl(239 100% 82% / .08), hsl(258 90% 66% / .05));
        box-shadow:var(--shadow-glow-primary); }
.hero .your { font-size:10px; text-transform:uppercase; letter-spacing:.1em; color:var(--color-primary);
        font-family:var(--font-mono); }                  /* "★ Your file" */
.working { margin-top:12px; }                            /* visible by default; collapse affordance retained */
.dl-btn.ok   { border-color:var(--color-success); background:var(--color-success-dim); color:var(--color-success); }
.dl-btn.dead { border-color:hsl(0 72% 51% / .4); background:var(--color-danger-dim); color:var(--color-danger); cursor:not-allowed; }
```

### Per-extension file icon — one shared `fileIcon()` (SVG, Untitled-UI style)

```js
function fileIcon(nm, px){
  const ext = (nm.split('.').pop()||'').toLowerCase();
  const T = { pptx:['#f76707','slides'], pdf:['#e03131','text'], docx:['#1c7ed6','text'], md:['#5c677d','text'],
    csv:['#2f9e44','table'], png:['#7048e8','image'], json:['#0c8599','code'] /* + ppt/doc/rtf/txt/xls/xlsx/jpg/jpeg/gif/svg/webp/js/ts/html/py/xml */ };
  const [color, cat] = T[ext] || ['#687076','text'];
  const label = '.' + (ext||'FILE').toUpperCase();
  // glyph per cat: text=lines · table=grid · image=mountain+sun · code=</> · slides=bar-chart-in-screen
  return `<svg width=${px} height=${px} viewBox="0 0 40 48">
    <path d="M10 3 H26.5 L33 9.5 V40 a3 3 0 0 1 -3 3 H10 a3 3 0 0 1 -3 -3 V6 a3 3 0 0 1 3 -3 Z"
          fill="#eef1f7" stroke="#cfd5e1"/>            <!-- light page -->
    <path d="M26.5 3 L33 9.5 H26.5 Z" fill="#cfd5e1"/> <!-- folded corner -->
    ${glyph(cat, color)}                                <!-- type glyph in the type color -->
    <rect x="6" y="32" width="28" height="11" rx="2.5" fill="${color}"/>
    <text x="20" y="39.6" text-anchor="middle" font-size="6.4" font-weight="700" fill="#fff">${label}</text>
  </svg>`;
}
```

---

## HTML Structures

### A step on the rail (essence resting → click to expand)

```html
<div class="step done">                                <!-- done | active | queued -->
  <div class="rail"><div class="node"></div><div class="rail-line"></div></div>
  <div class="step-main">
    <div class="step-head clickable" onclick="expandStep(i)">
      <span class="snum">7</span>
      <span class="ess-ic">🐍</span><span class="ess-name">execute_code</span>
      <span class="ess-arrow">→</span>
      <span class="ess-text">Executed 22 lines → chart_revenue.png (exit 0, 2.1s)</span>
      <span class="pill done"><span class="dot"></span>2.1s</span>
      <span class="chev">›</span>
    </div>
    <!-- when active OR peeked: -->
    <div class="step-body"><!-- per-tool ToolBody --></div>
  </div>
</div>
```

### The run-card with the header strip (hybrid placement, home #1)

```html
<div class="run-frame active">
  <div class="run-header">
    <div class="avatar streaming">A</div>
    <div><div class="run-title">Dissertation deck</div><div class="run-sub">kimi-k2.6 · turn 1</div></div>
    <div class="hdr-strip"><div class="status-strip">
      <span class="seg time">3m12s</span><span class="divider"></span>
      <span class="seg">Step 5</span><span class="divider"></span>
      <span class="seg act"><span class="dot"></span>Running code…</span>
    </div></div>
  </div>
  <div class="run-progress"></div>
  <div class="run-body"><!-- StepRail of StepRows --></div>
</div>
<!-- home #2: a sticky bottom .live-chip inside the message-list viewport, shown when scrolled away -->
```

### Output files area (below the answer)

```html
<div class="outputs">
  <div class="outputs-label">Generated files</div>
  <div class="hero">
    {fileIcon('dissertation_defense.pptx', 48)}
    <div class="meta"><div class="your">★ Your file</div>
      <div class="nm">dissertation_defense.pptx</div>
      <div class="sub">4.1 MB · the file you asked for</div></div>
    <button class="dl-btn">⤓ Download</button>
  </div>
  <div class="working open">
    <div class="working-head"><span class="chev">›</span> Working files (3) — intermediates, all downloadable</div>
    <div class="working-list"><!-- file-row × N, each fileIcon(name) + name + size + dl-btn --></div>
  </div>
</div>
```

---

## What to Avoid

- ❌ **Three forked implementations of the same primitive.** The biggest risk. `bodyHTML` vs `detailHTML`
  (two expand bodies), `.file-out` vs `.file-row` vs `.det-file` (four file-row classes), two
  `status-strip` stylesheets, two `+1` step-count literals — all must collapse to the single sources
  in the inventory. See `sources/095-grounding/CONSISTENCY.md` (13 drifts catalogued).
- ❌ **Per-card borders on the rail.** Bordered mini-cards (014 variant B) re-create the "wall of cards."
  The rail carries sequence; cards stay borderless.
- ❌ **Gating the timer on `isStreamingNow || elapsedMs>0`.** This is the exact vanish bug. Derive from a
  stable start-ts and render continuously; freeze only on a true terminal.
- ❌ **A bottom status chip that occludes the live stream while following.** In the hybrid, the chip
  appears only on scroll-away; while following, status lives in the header.
- ❌ **Auto-scroll on every update.** Follow only while near-bottom; release on user scroll-up; re-arm at
  bottom. A "Jump to live" affordance, not a forced snap.
- ❌ **A flat, index-ordered output list with no hero.** Re-rank, don't hide: hero the agent-flagged
  deliverable; intermediates present-but-quiet.
- ❌ **Solid color+text icon tiles for files.** Use a real file icon (document + folded corner + glyph +
  colored extension ribbon) so it tells the story.
- ❌ **Caging the chat in a bordered fixed-height scroll box with a chunky scrollbar.** The scroll region
  is seamless; only the run-card carries a frame; the slider is thin.

---

## Origin

Synthesized from sketches:
- `014-unified-card-frame` (winner: **Synthesis — rail + nodes + bloom**)
- `015-status-strip-and-scroll` (winner: **C — Hybrid**)
- `016-output-files-hero` (winner: **A — Hero block**)

Source files: `sources/014-unified-card-frame/`, `sources/015-status-strip-and-scroll/`,
`sources/016-output-files-hero/` (each holds all variants + the README Build-Handover). Grounding +
consistency: `sources/095-grounding/GROUNDING.md` (real SSE events, essence strings, bug mechanics)
and `sources/095-grounding/CONSISTENCY.md` (the build-once inventory + 13-drift audit). Read both
before wiring real event names or building any of the three surfaces.

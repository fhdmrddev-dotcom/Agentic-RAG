# Chat Tool-Card Unification (Phase 095)

The Deep-mode chat tool-call surface — **fixed and unified in place** (the cards stay in the chat;
094 D-01 kept them out of the panel). Synthesized from sketches **014 (unified-card-frame)**,
**015 (status-strip-and-scroll)**, **016 (output-files-hero)**. Refines the locked 001-C run-frame /
002-C tool-card / 003-B Focus-Mode language — not a new frame.

---

> ## ⚠ SITE 1 of 9 — REVERSAL BANNER: THE HERO / WORKING SPLIT WAS RETIRED. READ THIS BEFORE BUILDING ANYTHING FROM §C.
>
> **Reversed by: Phase 095.1, decision `D-095.1-06`** — an operator-approved CONTEXT decision, taken
> *immediately after* the phase this document records. **Recorded here 2026-08-17 by Phase 195 plan
> `195-08` (`195-CONTEXT.md` D-11).** The reversal was never written down here, and this record went on
> naming sketch 016-A "Hero block" as the winner for four milestones.
>
> **What is true in shipped code today:**
>
> | Claim in this document | Shipped state |
> |---|---|
> | `OutputFileCard` has Hero and Working variants | `variant` is **INERT** — *"no longer changes the rendered shape — every row renders the one quiet uniform style"* (`OutputFileCard.tsx:59-66`) |
> | A backend tag flags the hero deliverable | `is_hero` is **written-but-unread** (`:54-57`). The backend still WRITES it; **nothing reads it** |
> | Intermediates render in a separate "Working files (N)" group | There is **no grouping**. One uniform list |
> | The list is index-ordered | **Newest-first**, sorted client-side (Phase 195, D-12, `fileRowUtils.byNewestFirst`) |
>
> **The scale fact behind the reversal, measured rather than argued: 60 of 61 file-bearing runs have
> exactly ONE file.** A hero signal would be a pattern built for a population of one — and the
> workspace-file path (workflow deliverables) has no hero flag at all to build it from.
>
> ⚠ **EVERYTHING BELOW DESCRIBING A HERO / WORKING SPLIT IS HISTORICAL.** It is the record of what was
> *decided at sketch time*, and it is deliberately **not deleted** — the point of this file is the
> design record. The point of this banner is that a reader cannot mistake the record for current state.
> Each of the eight remaining stale sites carries its own marker; **do not build from an unmarked
> paragraph in §C without checking for one.**
>
> **Why this was worth a phase's attention rather than tidy-up:** a record that is present and WRONG
> answers the auditor and **stops the audit**. Left alone, the next UI phase reading this skill builds
> a hero block from it.

---

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

### C. Output files — hero / working split (sketch 016 — winner: A, Hero block) — ⚠ SITE 2 of 9: **SUPERSEDED**

> ⚠ **SUPERSEDED — the winner named in this heading was REVERSED by Phase 095.1 (`D-095.1-06`).**
> Recorded 2026-08-17 by Phase 195 plan `195-08`. The heading is kept verbatim because it is the
> record of what sketch 016 decided; **it is not what ships.** What ships is ONE uniform quiet row for
> every file, newest-first, with no hero and no working group. See the reversal banner at the top of
> this file.

At run end, **hero the deliverable the user asked for; keep intermediates present-but-quiet; every
link always downloads** (D-07/D-08):

> ⚠ **SITE 3 of 9 — THE PRESCRIPTION BELOW IS HISTORICAL (Phase 095.1 / `D-095.1-06`).** Only the third
> clause survived: **"every link always downloads"** is still binding and is still what
> `OutputFileCard`'s dead-link state exists for (`BUG-260523-03`). The first two clauses — *hero the
> deliverable*, *keep intermediates present-but-quiet* — were reversed. Marked 2026-08-17 by `195-08`.

- **Hero block.** The agent-flagged final output is a big "★ Your file" card with a prominent
  Download. Intermediates render as a quieter **"Working files (N)"** group — **visible by default**
  ("show all files") with a collapse affordance.
  > ⚠ **REVERSED (Phase 095.1, `D-095.1-06`).** No hero card and no "Working files (N)" group ship.
  > Every file — deliverable and intermediate alike — renders the same quiet row.
- **The agent flags the hero (D-08).** A small backend tag on the `final_output_files` payload marks
  the final deliverable (the agent knows the request intent). *(Exact field name = a planning/backend
  decision — render as "agent-flagged final output".)*
  > ⚠ **THE FIELD EXISTS AND NOTHING READS IT.** The backend tag shipped as `is_hero` and has been
  > **written-but-unread** since Phase 095.1 (`OutputFileCard.tsx:54-57`). Retiring the *write* is a
  > backend cleanup nobody has taken; its re-open trigger is *"any phase touching `harvest_output_files`
  > or `final_output_files`"* (`195-CONTEXT.md` § Deferred). ⚠ **The workflow-deliverable path has no
  > such flag at all** — a workspace file carries `{id, path, size_bytes, mime_type}` and nothing else —
  > so a hero signal could not be revived there without inventing one.
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

> ⚠ **SITE 4 of 9 — SUPERSEDED (Phase 095.1, `D-095.1-06`). Marked 2026-08-17 by `195-08`.**
> The paragraph above is preserved verbatim: it is a true record of *why A beat B and C at sketch time*.
> **It is not why the shipped code looks the way it does.** A was reversed after the phase shipped, and
> the outcome is closer to **B stripped of its star** than to any of the three variants — one list, no
> emphasis at all. ⚠ **Note what the comparison never weighed: how many files a real run actually
> produces.** All three variants optimise the multi-file reading; **60 of 61 file-bearing runs have
> exactly ONE file**, so on 98% of runs every variant renders the same single row and the "emphasis"
> the winner was chosen for has nothing to distinguish itself from. That is the measurement that
> retired it.

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
| `OutputFileCard` (+Hero/Working) ⚠ **SITE 5 of 9 — see the row below** | generated-file row + hero emphasis + working group | **ONE** card (production already reuses it); hero/working = a layout flag + `dl-btn` states (idle/ok/dead) |
| ⚠ **CORRECTION to the row above — `OutputFileCard` as it SHIPS** *(Phase 095.1 `D-095.1-06` + Phase 195; recorded 2026-08-17 by `195-08`)* | generated-file row, **one quiet uniform style, no hero emphasis and no working group**. The `variant` prop still exists and is **inert**; `is_hero` is written-but-unread | ⚠ **The card is no longer the single source of the row markup.** As of **Phase 195** the markup lives in the shared `components/files/FileRow.tsx` (Radix `asChild` + `Slottable`), and `OutputFileCard` is one of **three** callers — the others being the workspace panel's file list (`panel/FilesSection.tsx`) and the workflow run page's deliverable region (`pages/WorkflowRunPage.tsx`). The `dl-btn` idle/ok/dead states survive **byte-identical** and are the half of this row that was NOT reversed |
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

### Output files — hero + working (the 016 winner) — ⚠ SITE 6 of 9: **RETIRED MARKUP**

> ⚠ **THE `.hero`, `.hero .your` AND `.working` RULES BELOW DESCRIBE MARKUP THAT NO LONGER EXISTS IN
> THE APP.** Reversed by Phase 095.1 (`D-095.1-06`); marked 2026-08-17 by Phase 195 plan `195-08`.
> There is no hero card, no `★ Your file` eyebrow and no "Working files" group to style. **Copying this
> block into a component would be building a surface the app retired four milestones ago.**
>
> ⚠ **`.dl-btn.ok` / `.dl-btn.dead` are the EXCEPTION and are still live.** The dead state survives in
> shipped code as the red-bordered `aria-disabled` affordance carrying *"Download unavailable — this
> file has no link"* (`BUG-260523-03`'s cue), and Phase 195 propagated it to the workflow run page's
> id-less rows too. ⚠ **It is a `<span aria-disabled>`, never a `<button>`** — a fence asserts the row
> holds zero `<button>` elements, so re-implementing this as a disabled button reds the suite.
>
> **What ships instead:** one quiet row per file at three densities (`chat` / `panel` / `run`), all
> from `components/files/FileRow.tsx`.

```css
/* ⚠ RETIRED — see the note directly above. Kept as the sketch record, not as a build target. */
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

### Output files area (below the answer) — ⚠ SITE 7 of 9: **RETIRED MARKUP**

> ⚠ **THE FRAGMENT BELOW IS NOT WHAT RENDERS.** The `<div class="hero">` block, the `★ Your file`
> eyebrow and the `.working` group were reversed by Phase 095.1 (`D-095.1-06`); marked 2026-08-17 by
> Phase 195 plan `195-08`. **The shipped shape is a flat list of identical rows, newest-first, with no
> hero element and no group heading** — the exact structure §"What to Avoid" still forbids at site 8.
>
> ⚠ The `Generated files` label is likewise **not** the shipped copy on the workflow run surface. Phase
> 195 (D-02) relabelled that region **`Files in this run's workspace`**, because the read is
> thread-scoped and *"What this run produced"* was an authorship claim the read structurally cannot
> support.

```html
<!-- ⚠ RETIRED — see the note directly above. The sketch record, not a build target. -->
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
- ⚠ **SITE 8 of 9 — THIS ENTRY IS INVERTED. IT FORBADE EXACTLY WHAT SHIPS.** Inverted in place
  2026-08-17 by Phase 195 plan `195-08`; the original is quoted verbatim so the reversal is legible.

  > **THE ORIGINAL ENTRY, VERBATIM:** *"❌ **A flat, index-ordered output list with no hero.** Re-rank,
  > don't hide: hero the agent-flagged deliverable; intermediates present-but-quiet."*

  ✅ **A flat output list with no hero is CORRECT and is what ships.** Phase 095.1 (`D-095.1-06`)
  reversed the hero/working split; `variant` is inert and `is_hero` is written-but-unread, so there is
  no flag left to "re-rank" by. ⚠ **One half of the original entry survives and is worth keeping: *don't
  hide*.** Nothing is collapsed behind a "show all files" affordance — every file is visible.
  ⚠ **Only the word `index-ordered` is still an anti-pattern, and Phase 195 fixed it in the other
  direction:** the list is **newest-first**, sorted **client-side** (D-12, `fileRowUtils.byNewestFirst`),
  so the file a run just wrote sits above the template it filled. That sort has to handle a row with
  **no `created_at` at all** — the live-SSE payload carries `id/path/version/size/mime` only — and a
  comparator that sorts a missing key LAST puts the just-produced deliverable at the BOTTOM. Both
  regimes are pinned by tests.

  **So the anti-pattern to carry forward is:** ❌ *an output list ordered by arrival index rather than
  recency* — **not** the absence of a hero.
- ⚠ **ADDITIONAL SITE (a 10th, beyond the nine `195-CONTEXT.md` D-11 enumerated) — THE ICON RULE,
  CORRECTED BESIDE ITS ORIGINAL.** Phase 195 changed the facts this entry asserts, and the two design
  records disagreed with each other. Marked 2026-08-17 by `195-08`; Phase 095.1's reversal is not the
  cause here — Phase 195's own icon unification is.

  > **THE ORIGINAL ENTRY, VERBATIM:** *"❌ **Solid color+text icon tiles for files.** Use a real file
  > icon (document + folded corner + glyph + colored extension ribbon) so it tells the story."*

  **The original stands for the CHAT surface and is unchanged there** — chat still renders the full
  30 px `fileIcon()` glyph with its colored `.EXT` ribbon.

  ⚠ **But as written it forbade a form that ships deliberately, and two design records disagreed with
  each other for four milestones.** The workspace panel's file row renders a **flat 16 px monochrome
  glyph with no ribbon**, in `text-panel-muted-foreground` — and that is a **Phase 088-05 AA-contrast
  decision**, not a shortcut: `PanelSection.tsx:85` records that the light theme's global
  `--muted-foreground` measured **4.01:1**, below the 4.5:1 AA floor on the panel surface, while the
  panel token measures **7.21:1**. The workflow run page renders the same flat form.

  **How Phase 195 resolved it — by parameterising the ONE icon module rather than picking a winner.**
  `lib/fileIcon.tsx` now takes `ribbon` / `tone` / `className` / `mimeType`, so chat keeps its ribboned
  category-coloured glyph and the panel + run page keep their flat AA-cleared one, **from a single code
  path**. There is exactly one per-extension icon path in the tree and a source sweep proves it.

  ⚠ **The resulting glyph delta is a DECISION, not a regression** — the panel and run page previously
  used their own local maps, and adopting the shared one moved four categories:

  | Category | Pre-195 (local maps) | Now (shared module) |
  |---|---|---|
  | tables | `lucide-file-spreadsheet` | **`lucide-table`** |
  | code | `lucide-file-code` | **`lucide-code`** |
  | images | `lucide-file-image` | **`lucide-image`** |
  | unknown | `lucide-file` | **`lucide-file-text`** |

  `docx` / `pptx` are **unchanged**, which is why the flagship workflow deliverable looks identical.
  Nine code extensions (`sh` `bash` `sql` `yml` `yaml` `css` `jsx` `mjs` `tsx`) that the shared map
  omitted were added in the same phase, so no surface regressed to a worse glyph.

  ⚠ **The trap that makes this hard to review, recorded because a screenshot cannot see it:** in the
  shipped **dark** theme `--muted-foreground` and `--panel-muted-foreground` resolve to the **same**
  colour (`220 16% 65%`), and diverge **only in light**. A dark-theme visual diff of an icon-token
  change shows **nothing** while a light-theme AA regression ships. Assert the **token name**, never a
  resolved `rgb()`.

  **So the rule to carry forward is:** ❌ *solid color+text icon tiles* — and ✅ *ONE icon module,
  parameterised per surface; the ribbon and the tone are the surface's choice, the extension map is not.*
- ❌ **Caging the chat in a bordered fixed-height scroll box with a chunky scrollbar.** The scroll region
  is seamless; only the run-card carries a frame; the slider is thin.

---

## Origin

Synthesized from sketches:
- `014-unified-card-frame` (winner: **Synthesis — rail + nodes + bloom**)
- `015-status-strip-and-scroll` (winner: **C — Hybrid**)
- `016-output-files-hero` (winner: **A — Hero block**) — ⚠ **SITE 9 of 9: SUPERSEDED.** The sketch-time
  winner was **reversed by Phase 095.1 (`D-095.1-06`)**, an operator-approved CONTEXT decision taken
  right after Phase 095 shipped. Marked 2026-08-17 by `195-08`. **Sketch 016 has no live winner today:**
  what ships is a flat uniform list closest to variant **B with its star removed**, and it was arrived at
  by measurement (60 of 61 file-bearing runs carry exactly ONE file) rather than by re-running the
  sketch. ⚠ **A reader picking a variant to build from this line will build a retired surface** — read
  the reversal banner at the top of this file first.

Source files: `sources/014-unified-card-frame/`, `sources/015-status-strip-and-scroll/`,
`sources/016-output-files-hero/` (each holds all variants + the README Build-Handover). Grounding +
consistency: `sources/095-grounding/GROUNDING.md` (real SSE events, essence strings, bug mechanics)
and `sources/095-grounding/CONSISTENCY.md` (the build-once inventory + 13-drift audit). Read both
before wiring real event names or building any of the three surfaces.

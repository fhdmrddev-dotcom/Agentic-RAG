# Publish Gauntlet — Honesty Surface

Publishing a workflow is **not a button that succeeds** — it is a real, server-fixed **8-stage gauntlet** (owner → definition-valid → business_requirement → lint → interactive-phase → **a REAL golden run on your project KB** → structural gate → **an independent judge** → the flip) that can **honestly block**. The publish surface renders the server's `PublishVerdict` ABI — **exactly 5 fields, verbatim, never re-derived in the client** — and treats a judge fail as a **HARD WALL with no override**. The form that triggers all of this is a single `golden_input` textarea + a Publish button (the real `PublishRequest`). This is **NET-NEW**: there is no publish UI in `frontend/src` today — the only live route is `POST /workflows/{id}/publish`, so 020 proposes the first one. It upgrades sketch 012's binary "publish succeeded" toast into the staged gauntlet.

The winner is **Variant B — Progress-spine + long wait**: while the gauntlet runs, the 8-stage ladder collapses to a compact horizontal pip strip and the **golden-run wait panel becomes the hero of the canvas**; once resolved, a separate verdict card (success or block) renders below the spine.

## Design Decisions

### D1 — The publish form is ONE field: `golden_input` (not a multi-field form)
`PublishRequest` has a single field (`workflows.py:77-81`): `golden_input: str` — the author's representative kickoff prompt the golden run executes against the project KB (becomes `inputs.kickoff_prompt`). So the resting state is a **`.publish-card`** with one **`.gi-input` textarea + a Publish button**, not a wizard. The label is the literal field name `golden_input` with an ⓘ popover ("The single field of a PublishRequest… choose something typical, not a corner case"). The textarea drives the button: `oninput` sets `GI_VALUE` and `syncPublishBtn()` toggles `disabled` on empty/whitespace. Below the form sits the read-back **dial chip** (`⚑ STRICT · citations strict · …` — the strictness dial 018 set) so the author sees what they're publishing under.

### D2 — Show the REAL 8 ordered stages, NOT the stale 4
The Plan-05 SUMMARY's "4-stage" framing is OUTDATED (Plans 06-09 added stages). The ladder follows the **CODE**, the `STAGES` array, in server-fixed order — nine rows with their real stage numbers, "what it checks" line, and verbatim block code:

| `num` | label | what | sets `golden_run_id`? | `code` |
|---|---|---|---|---|
| `0` | Owner check | RLS-resolve + you own it | no | `not_found` |
| `0b` | Definition valid | re-validates as a WorkflowDefinition | no | `definition_invalid` |
| `1` | Business requirement | exactly one declared (the D-13 invariant) | no | `business_requirement` |
| `2` | Structural lint | reachable · terminal · inputs satisfied · no orphans | no | `lint` |
| `2.5` | Interactive-phase check | human-pause phases can't validate synchronously | no | `interactive_phase` |
| `3` | **Golden run on your KB** | a REAL harness run against the project KB | **set** | `golden_run_timeout` / `golden_run_error` |
| `3b` | Structural gate | citations / integrity checked during the run | **set** | `structural_gate` |
| `4` | **Independent judge** | an independent model grades the deliverable | **set** | `judge` |
| `5` | Publish (flip to published) | freeze this version · fork a new draft | n/a | `already_published` |

`golden_run_id` only becomes non-null at **stage 3+** — that gating is load-bearing for the run link (D6). The caption under the ladder header is explicit: *"8 ordered stages · run order is server-fixed · the dial cannot remove the judge (stage 4). A judge fail is a hard wall — no override."* A roll-up reads the live tally as `N passed · 1 running · 1 BLOCKED · M not reached`.

### D3 — Winner B: collapse the ladder to a progress-spine so the long wait is the hero
B's named idea is a **spine**: while the gauntlet runs, the full vertical ladder reduces to a single horizontal strip of pips (`.spine` of `.sp-pip` connected by `.sp-conn`), and the **golden-run wait panel becomes the hero of the canvas** (`.goldenrun-wait.hero` — larger padding, 1.5px border, 15px header). On a resolved verdict B keeps the spine compact and renders the verdict as **its own standalone card below** (success or block).

- **Won over A (Staged checklist):** A keeps the full vertical ladder as the hero and **expands the blocked stage in place** (`inlineBlock` — the judge card / lint list opens under the blocked row). That reads well for a block but **buries the long synchronous golden-run wait** as one inline panel under a running row, when the wait is the single most novel honesty moment (publishing blocks the request for real, up to `harness_publish_max_seconds`). B makes that wait the canvas.
- **Won over C (Verdict-first banner):** C is a compact pass/block banner up top that **expands on demand** (`.c-disclosure`) to the staged breakdown — great for fast scanning a *resolved* verdict, but it under-serves the *running* moment (the wait is just another banner). C's one genuinely good idea (auto-expand only the judge hard-wall, `defaultCExpanded() === 'block_judge'`) is worth borrowing if a banner is ever wanted.
- **Why B wins:** the long synchronous golden run is the real 103 design problem (§6 open Q5 — background-job publish is deferred). B is the only variant that makes "running the golden run on your KB" the hero rather than a side panel, while still rendering the full 5-field verdict card on resolution.

### D4 — The judge block is the QUAL-01 centerpiece and a HARD WALL — no override
After a successful golden run, the judge (`_block(stage='judge')`) fires when the verdict failed or `overall_passed is not True`. There is **no override, no opt-out, no "publish anyway"** anywhere in the surface. The judge block (`.judge-block`) renders:
- a head naming it the **independent judge** with the judge model chip (`judged by claude-opus-4-8 · independent of the run model` — `resolve_judge_model`, never the run model) and the line *"The golden run succeeded — but the judge would not pass its result."*
- **per-criterion `{criterion, score, evidence}` rows** (`.crit-row`) — each FAILED criterion as a row with a ✕ icon, the criterion name in mono, the evidence sentence, and a two-decimal score + a tiny score bar (e.g. `grounded_in_evidence`, `0.42`, "3 of 12 figures are uncited — residual-risk scores for 3 vendors trace to no source assessment").
- a **one-paragraph server-authored summary** (`.jb-summary`, labeled "judge summary (one paragraph, server-authored)").
- a **`.verbatim-cap`** proving provenance: *"rendered verbatim from `named_failures` (failed criteria + summary) — not re-derived in the client. The passing criteria + raw JudgeVerdict booleans live in the governance receipt, not here."*

The criterion rows + summary are **exactly what `PublishVerdict.named_failures` carries** for a judge block (`_judge_named_failures` returns per-criterion dicts where `passed is False` + a trailing `{summary}`). The raw `JudgeVerdict` booleans (`overall_passed`, `grounded_in_evidence`, etc.) are **NOT rendered** — they live in the `judge_verdict` governance receipt. The only forward affordance is **Fix & re-publish** (a fresh golden run + judge each attempt), and the deliberate absence of an override is itself rendered: `no override · <s>publish anyway</s>` (struck-through, in `.no-override`).

### D5 — PublishVerdict's 5 fields rendered VERBATIM, never re-derived
The response is **exactly 5 fields** (`workflows.py:84-94`, comment "Machine-renderable for 103"): `published`, `version`, `golden_run_id`, `blocked_stage`, `named_failures`. Every state snapshot in `VERDICTS` carries exactly these five (+ a non-rendered `http` hint). They render as a labeled 2-column grid (`.verdict-fields` / `.vf-row`): booleans as `true`/`false` (green/red), nulls as italic `null`, `blocked_stage` in danger red, `named_failures` summarized as "list · N items (rendered above)" or `[] (empty)`. The grid carries the **"rendered, not re-derived" caption** — the client never recomputes pass/block; it reads the server's verdict. The whole surface treats server-authored strings as opaque: stage codes, criterion names, evidence, the summary, the honest-failure line — all rendered verbatim.

### D6 — The "view the golden run" link gates on `golden_run_id != null`
The run link appears **only** when `golden_run_id` is non-null (stage 3+ reached — `hasRun = v.golden_run_id !== null`). On **success** and on a **judge block** (which happens *after* a successful golden run, so `golden_run_id` IS set) the link renders: `▦ Open the golden run that was judged · <8-char>…`. On a **pre-run block** (lint at stage 2, business_requirement at stage 1) there is no run — the UI renders an explicit **`.no-run-note`** instead: *"`golden_run_id` is `null` — this blocked before stage 3, so there is no run to open. (A pre-run block never has a run link.)"* The link is gated **per verdict field**, never assumed from "it blocked" or "it succeeded."

### D7 — The synchronous long-wait is honest about blocking the request
Background-job publish isn't built — publishing **blocks the HTTP request** up to `harness_publish_max_seconds`. The hero wait panel (`.goldenrun-wait.hero`) says so plainly: a live pulse dot + "Publishing… running the golden run on your KB", a sub-line ("same harness, same tools, same model — so the judge grades a **real** deliverable, not a dry-run. This is synchronous and can take a while."), an indeterminate progress bar, an elapsed/wall-budget meta row (`elapsed 0:38 · wall budget harness_publish_max_seconds`), and an `.grw-honest` footnote: *"background-job publish isn't built yet, so this blocks the request. Don't close the tab — the verdict comes back inline when the run + judge finish."*

### D8 — The full HTTP mapping is distinguished, not just success/fail
The client must **read the verdict body on a 200** to tell pass from block. The resting form renders an `.http-legend` of all four outcomes, and resolved verdicts carry an `.http-badge`:
- **200** — success OR a gauntlet block (judge / lint / golden-run / structural_gate / interactive / golden_run_timeout|error): the body is the `PublishVerdict`; **read `blocked_stage`** to tell them apart. This is the **primary "gauntlet failed" surface.**
- **400** — `business_requirement` (the D-13 invariant): the WHOLE verdict is in the response `detail`, not the body.
- **404** — `not_found`: you don't own it (or it doesn't exist). Cross-user collapses to the same 404 — **no existence leak**.
- **409** — `already_published`: this version is already published (a concurrent double-publish lost the race). Tweak forks a new draft version.

(`422` for a malformed `definition_id` is a FastAPI path-coercion framework error, not a verdict — not part of the honesty surface.)

### D9 — The 10 real `blocked_stage` strings, as code-chips, nothing invented
The block-reason is always one of **10 real strings** rendered as `.code-chip`s: `not_found`, `already_published`, `definition_invalid`, `business_requirement`, `lint`, `interactive_phase`, `golden_run_timeout`, `golden_run_error`, `structural_gate`, `judge`. On success `blocked_stage` is `null`. **No invented stage names, no "compliance/severity/level" labels.** The chip is shown next to the verdict title and in the field grid.

### D10 — An un-producible verdict fails CLOSED, never silent-passes
If the judge can't produce a verdict (model emitted nothing after retries / no judge model resolved), `named_failures` is a single string and the UI renders the honest-failure line verbatim in `.jb-honest`: *"the judge produced no verdict (judge model returned no structured output after 2 attempts) — honest failure, not a silent pass."* The card title is "The judge could not produce a verdict" with the sub-line "Treated as a block, never a pass." This is a distinct state (`block_honest`) from a graded judge block — the renderer branches on whether `named_failures` items have a `criterion` key vs are bare strings.

### Visual properties (from the winning variant)
- **Canvas:** `max-width:760px` centered, `.wide` variant `820px`; theme `../themes/default.css` (Aether Deep Midnight), tokens only, no new ones.
- **Color language (LOCKED, non-color-alone — glyph + text + token always):** green `--color-success` = done/passed/published; amber `--color-warning` = running/the golden-run wait; red `--color-danger` = blocked/judge-fail; violet `--color-accent-violet` = the "rendered verbatim / independent judge" provenance accents and the `NET-NEW` pill.
- **Typography:** `--font-headline` Manrope for titles, `--font-sans` Inter for prose, `--font-mono` JetBrains for every machine value (field keys, stage codes, criterion names, run-ids, HTTP codes).
- **Radius/spacing:** 4px grid (`--space-*`); cards `--radius-lg`, field grid & inner cards `--radius-md`, chips `--radius-sm`/`--radius-full`. Score bars are 3px; criterion icons 22px circles; verdict icons 38px.
- **Animation:** `fadeSlideUp` for cards appearing, `brandPulse` on the live wait dot, `dotBounce` mini-dots inside a running tag, `checkPop` (`--ease-bounce`) on the success ✓. Restraint — the wait panel is the only sustained-motion surface.

## CSS Patterns

```css
/* one shared "ink on a bright surface" token so dark-text-on-primary/warning
   spots collapse to one literal instead of drifting (mirrors sketch 019) */
:root { --color-on-bright: hsl(240 60% 8%); }

/* D1 — the resting publish form: ONE golden_input textarea + Publish */
.gi-label { display:flex; align-items:center; gap:6px; font-size:11px; color:var(--color-text-dim);
            font-family:var(--font-mono); margin:var(--space-5) 0 6px; text-transform:uppercase; letter-spacing:.05em; }
.gi-input { width:100%; background:var(--color-surface-hi); border:1px solid var(--color-border);
            border-radius:var(--radius-md); padding:var(--space-3); color:var(--color-text);
            font-family:inherit; font-size:13px; line-height:1.55; resize:vertical; min-height:88px; }
.gi-input:focus { outline:none; border-color:var(--color-primary); box-shadow:0 0 0 3px var(--color-primary-dim); }
.publish-btn:disabled { opacity:.45; cursor:not-allowed; }  /* gated on golden_input non-empty */

/* D3 — variant B's compact progress-spine (horizontal pip row, NOT the full ladder) */
.spine { display:flex; align-items:center; gap:6px; flex-wrap:wrap; padding:var(--space-3) 0 var(--space-4); }
.spine .sp-pip { display:inline-flex; align-items:center; gap:6px; padding:4px 9px; border-radius:var(--radius-full);
                 border:1px solid var(--color-border-soft); background:var(--color-surface);
                 font-family:var(--font-mono); font-size:9.5px; color:var(--color-text-dim); white-space:nowrap; }
.spine .sp-pip .sp-dot { width:7px; height:7px; border-radius:50%; background:var(--color-border); flex-shrink:0; }
.spine .sp-pip.done    { border-color:hsl(142 71% 45% / .4); color:var(--color-success); }
.spine .sp-pip.done .sp-dot    { background:var(--color-success); }
.spine .sp-pip.running { border-color:var(--color-warning); color:var(--color-warning); background:var(--color-warning-dim); }
.spine .sp-pip.running .sp-dot { background:var(--color-warning); animation:brandPulse 1.3s infinite; }
.spine .sp-pip.blocked { border-color:hsl(0 72% 51% / .5); color:var(--color-danger); background:var(--color-danger-dim); }
.spine .sp-conn { width:10px; height:2px; background:var(--color-border-soft); flex-shrink:0; }

/* D7 — B's HERO golden-run wait panel (the synchronous block is the canvas) */
.goldenrun-wait { border:1px solid hsl(38 92% 60% / .35); background:var(--color-warning-dim);
                  border-radius:var(--radius-md); padding:var(--space-4); animation:fadeSlideUp var(--dur-base) var(--ease-out); }
.goldenrun-wait.hero { margin-left:0; margin-top:0; padding:var(--space-5); border-width:1.5px; }
.goldenrun-wait.hero .grw-h { font-size:15px; }
.grw-h .live-dot { width:8px; height:8px; border-radius:50%; background:var(--color-warning); animation:brandPulse 1.3s infinite; }
.grw-honest { margin-top:var(--space-3); font-size:10.5px; color:var(--color-text-dim); font-family:var(--font-mono);
              line-height:1.6; border-top:1px dashed var(--color-border-soft); padding-top:8px; }

/* D5 — the 5-field PublishVerdict grid, "rendered, never re-derived" */
.verdict-fields { margin-top:var(--space-4); border:1px solid var(--color-border); border-radius:var(--radius-md); overflow:hidden; }
.vf-row { display:grid; grid-template-columns:160px 1fr; gap:var(--space-3); padding:8px var(--space-4);
          border-bottom:1px solid var(--color-border-soft); font-size:12px; align-items:center; }
.vf-key { font-family:var(--font-mono); font-size:10.5px; color:var(--color-text-dim); }
.vf-val { font-family:var(--font-mono); font-size:11.5px; color:var(--color-text); overflow-wrap:anywhere; }
.vf-val .v-bool-true { color:var(--color-success); }
.vf-val .v-bool-false { color:var(--color-danger); }
.vf-val .v-null { color:var(--color-text-dim); font-style:italic; }
.vf-val .v-block { color:var(--color-danger); }

/* D9 — the verbatim blocked_stage string as a code-chip (.ok variant for blocked_stage:null) */
.code-chip { font-family:var(--font-mono); font-size:9px; padding:2px 7px; border-radius:var(--radius-sm);
             border:1px solid hsl(0 72% 51% / .4); background:var(--color-danger-dim); color:var(--color-danger); }
.code-chip.ok { border-color:hsl(142 71% 45% / .35); background:var(--color-success-dim); color:var(--color-success); }

/* D4 — the judge-block criterion row {criterion, score, evidence} + the no-override wall */
.crit-row { display:grid; grid-template-columns:24px 1fr 64px; gap:var(--space-3); align-items:center;
            padding:var(--space-3); border:1px solid var(--color-border-soft); border-radius:var(--radius-md);
            margin-bottom:8px; background:var(--color-surface-hi); }
.crit-row.fail { border-color:hsl(0 72% 51% / .4); }
.crit-row.fail .cs-num { color:var(--color-danger); }
.cs-bar { height:3px; border-radius:2px; background:var(--color-muted); margin-top:4px; overflow:hidden; }
.cs-bar > i { display:block; height:100%; border-radius:2px; }
.crit-row.fail .cs-bar > i { background:var(--color-danger); }
.no-override s { color:var(--color-text-dim); opacity:.6; }   /* the deliberately-absent "publish anyway" */

/* D6 — the run link appears ONLY when golden_run_id non-null; the explicit absence note otherwise */
.run-link { display:inline-flex; align-items:center; gap:7px; font-size:12px; font-weight:600;
            color:var(--color-primary); text-decoration:none; padding:7px var(--space-4); border-radius:var(--radius-md);
            border:1px solid var(--color-primary-glow); background:var(--color-primary-dim); margin-top:var(--space-4); }
.no-run-note { margin-top:var(--space-4); font-size:11px; color:var(--color-text-dim); font-family:var(--font-mono);
               line-height:1.6; border:1px dashed var(--color-border); border-radius:var(--radius-md); padding:9px var(--space-3); }

/* D8 — the HTTP outcome badge (200 vs 4xx) + the four-outcome legend */
.http-badge.s200 { border-color:var(--color-border); }
.http-badge.s4xx { border-color:hsl(0 72% 51% / .4); color:var(--color-danger); background:var(--color-danger-dim); }

/* D4 — the "rendered verbatim" provenance caption (proves no client re-derivation) */
.verbatim-cap { font-family:var(--font-mono); font-size:9px; color:var(--color-text-dim);
                padding:8px var(--space-4); border-top:1px solid var(--color-border-soft);
                display:flex; align-items:center; gap:7px; }
.verbatim-cap .vc-glyph { color:var(--color-accent-violet); }
```

## HTML Structures

```html
<!-- D1 — resting: the single-field PublishRequest form -->
<div class="publish-card">
  <div class="pc-h">◆ Publish "Vendor-risk portfolio review"</div>
  <div class="pc-sub">Publishing runs the full <b>8-stage gauntlet</b> — including a
    <b>real golden run</b> of this workflow against your project KB and an
    <b>independent judge</b> of the result. It can honestly block.</div>
  <div class="gi-label">golden_input <span class="info">ⓘ<span class="pop">…</span></span></div>
  <textarea class="gi-input" id="giInput"
            oninput="GI_VALUE=this.value; syncPublishBtn();"></textarea>
  <div class="gi-foot">
    <span class="dial-chip">⚑ STRICT · citations strict · output valid · freshness ≤90d · judge</span>
    <button class="publish-btn" id="publishBtn" disabled>Publish ▸ run the gauntlet</button>
  </div>
</div>

<!-- D3 — running (winner B): the spine collapses, the wait is the hero -->
<div class="canvas">
  <div class="spine">
    <span class="sp-pip done"><span class="sp-dot"></span>0</span>
    <span class="sp-conn"></span>
    <!-- … pips for 0b,1,2,2.5 done … -->
    <span class="sp-pip running"><span class="sp-dot"></span>3</span>
    <!-- … pips for 3b,4,5 pending … -->
  </div>
  <div class="goldenrun-wait hero">
    <div class="grw-h"><span class="live-dot"></span> Publishing… running the golden run on your KB</div>
    <div class="grw-sub">…same harness, same tools, same model (claude-sonnet-4-6) — so the judge
      grades a <b>real</b> deliverable, not a dry-run. This is synchronous and can take a while.</div>
    <div class="grw-bar progress-bar"></div>
    <div class="grw-meta"><span>elapsed 0:38 · wall budget harness_publish_max_seconds</span>
      <span>step 4 / ~7 · ◆ rendering vendor-risk-brief.docx</span></div>
    <div class="grw-honest">↳ honest wait: background-job publish isn't built yet, so this blocks the
      request. Don't close the tab — the verdict comes back inline when the run + judge finish.</div>
  </div>
</div>

<!-- D4/D5/D6 — a judge BLOCK verdict card (after a successful golden run) -->
<div class="verdict block">
  <div class="verdict-top">
    <div class="verdict-icon">✕</div>
    <div>
      <div class="verdict-title">Blocked by the independent judge
        <span class="code-chip">judge</span></div>            <!-- D9: verbatim blocked_stage -->
      <div class="verdict-line">…This is a hard wall — there is no "publish anyway."…</div>
      <span class="http-badge s200">200 OK · read blocked_stage</span>  <!-- D8 -->
    </div>
  </div>

  <!-- D5: the 5 fields, verbatim -->
  <div class="verdict-fields">
    <div class="vf-row"><span class="vf-key">published</span><span class="vf-val"><span class="v-bool-false">false</span></span></div>
    <div class="vf-row"><span class="vf-key">version</span><span class="vf-val"><span class="v-null">null</span></span></div>
    <div class="vf-row"><span class="vf-key">golden_run_id</span><span class="vf-val">a7f3c1d2-…</span></div>
    <div class="vf-row"><span class="vf-key">blocked_stage</span><span class="vf-val"><span class="v-block">judge</span></span></div>
    <div class="vf-row"><span class="vf-key">named_failures</span><span class="vf-val">list · 1 item (rendered above)</span></div>
  </div>

  <!-- D4: the judge block — per-criterion rows + summary, NO raw booleans -->
  <div class="judge-block">
    <div class="jb-head">
      <div class="jb-glyph">⚖</div>
      <div><div class="jb-title">The independent judge blocked this</div>
        <div>The golden run succeeded — but the judge would not pass its result.</div></div>
      <div class="jb-model">judged by <span class="iv">claude-opus-4-8</span> · independent of the run model</div>
    </div>
    <div class="jb-criteria">
      <div class="jb-crit-cap">failed criteria — what blocked publish</div>
      <div class="crit-row fail">
        <div class="crit-icon">✕</div>
        <div class="crit-body">
          <div class="crit-name">grounded_in_evidence</div>
          <div class="crit-evidence">3 of 12 figures are uncited — residual-risk scores for 3 vendors trace to no source.</div>
        </div>
        <div class="crit-score"><div class="cs-num">0.42</div><div class="cs-lab">score</div>
          <div class="cs-bar"><i style="width:42%"></i></div></div>
      </div>
    </div>
    <div class="jb-summary">
      <div class="jbs-lab">judge summary (one paragraph, server-authored)</div>
      <div class="jbs-text">…a quarter of its quantitative claims are not grounded in a cited source…</div>
    </div>
    <div class="verbatim-cap"><span class="vc-glyph">▦</span> rendered verbatim from
      <span class="mono">named_failures</span> — not re-derived. The passing criteria + raw
      JudgeVerdict booleans live in the governance receipt, not here.</div>
  </div>

  <!-- D6: run link (golden_run_id IS set after a successful run) + D4: the no-override wall -->
  <a class="run-link" href="#">▦ Open the golden run that was judged · a7f3c1d2…</a>
  <div class="fix-strip">
    <span class="fx-note">The only path forward is to fix the deliverable and re-publish —
      each attempt is a brand-new golden run and a fresh judge verdict.</span>
    <span class="no-override">no override · <s>publish anyway</s></span>
    <button class="fix-btn">↻ Fix &amp; re-publish</button>
  </div>
</div>

<!-- D6/D10 — a PRE-RUN block (lint / business_requirement): NO run link, the explicit absence note -->
<div class="no-run-note">↳ <span class="mono">golden_run_id</span> is <span class="v-null">null</span>
  — this blocked before stage 3, so there is no run to open.
  (A pre-run block never has a run link.)</div>
```

## What to Avoid

- **The stale 4-stage framing.** The Plan-05 SUMMARY's "4 stages" is OUTDATED — Plans 06-09 added stages. Follow the **CODE** (`publish_service.py` / the `STAGES` array), the real **8 ordered stages** (numbered 0, 0b, 1, 2, 2.5, 3, 3b, 4, 5). Drawing four stages misrepresents what publish actually runs and which `blocked_stage` codes can appear.
- **Rendering raw `JudgeVerdict` booleans.** `overall_passed`, `grounded_in_evidence`, `answers_business_requirement`, `did_the_work_not_delegated`, `criteria[]` live in the **`judge_verdict` governance receipt**, not in `PublishVerdict`. The verdict card renders only the **flattened `named_failures`** (failed-criterion `{criterion, score, evidence}` rows + the `{summary}`). Never surface the boolean grid here.
- **Re-deriving the verdict in the client.** The 5 fields are server-authored and rendered **verbatim**; the client never recomputes pass/block, never re-infers `blocked_stage`, never reformats the summary. The `.verbatim-cap` exists to make that contract visible — do not add client-side logic that second-guesses the server.
- **A run-link on a pre-run block.** The "view/open the golden run" affordance gates strictly on **`golden_run_id != null`** (stage 3+ reached). A lint or business_requirement block has `golden_run_id: null` — there is **no run to open**. Render the explicit `.no-run-note` absence instead of a dead/fabricated link.
- **Any override / "publish anyway."** A judge fail (and any block) is a **HARD WALL**. There is no override, no opt-out, no "publish anyway" button — and the intentional absence is itself rendered (`<s>publish anyway</s>`). The only forward path is **Fix & re-publish** (a fresh golden run + judge each attempt). Never add an escape hatch.
- **Inventing stage names or codes.** Only the **10 real `blocked_stage` strings** (`not_found`, `already_published`, `definition_invalid`, `business_requirement`, `lint`, `interactive_phase`, `golden_run_timeout`, `golden_run_error`, `structural_gate`, `judge`). No "compliance mode", "severity", "level 1/2/3" — those aren't in the codebase.
- **Collapsing the HTTP outcomes to success/fail.** The client must **read the verdict body on a 200** — a 200 is success *or* a gauntlet block. `business_requirement` is a **400** (verdict in `detail`); `not_found` a **404** (no existence leak); `already_published` a **409**. A binary "200 = ok / else error" handler mis-reads the primary gauntlet-failed surface.
- **A silent pass on an un-producible verdict.** If the judge emits nothing, `named_failures` is the single honest-failure string and the surface **fails closed** — "honest failure, not a silent pass." Never default an absent verdict to success.
- **Treating publish as instant.** It is a **synchronous blocking** request up to `harness_publish_max_seconds` (a real provider golden run); background-job publish is deferred. The wait must be honest ("don't close the tab"), not a spinner that implies sub-second completion.

## Origin

Synthesized from sketch **020 — Publish Gauntlet Honesty** (winner **B — Progress-spine + long wait**). Source files in `sources/020-publish-gauntlet-honesty/` (`index.html`, `README.md`). The real-system grounding (the 8 ordered stages, the `PublishRequest`/`PublishVerdict` ABI, the 10 `blocked_stage` codes, the `_judge_named_failures` shape, the HTTP mapping, the always-on independent judge) comes from **`.planning/sketches/103-grounding/BRIEF.md` §3.1–3.3** — which cites `backend/app/services/harness/publish_service.py` (the 762-line orchestrator, NOT `backend/app/services/publish_service.py`), `backend/app/api/workflows.py:77-143`, and `validator_kinds.py` `JudgeVerdict`/`JudgeCriterionVerdict`.

To re-feel it: open `index.html` and use the **bottom-right state cycler** to walk the publish lifecycle — `1 resting` (the single `golden_input` form + the 4-outcome HTTP legend) → `2 golden-run wait` (winner B's hero — the spine collapses, the synchronous wait dominates) → `3 published v1` (a SUCCESS verdict with a real `golden_run_id` + run link) → `4 judge BLOCK ★` (the QUAL-01 centerpiece — per-criterion rows + summary, no override) → `5a/5b early block` (business_requirement / lint pre-run blocks — `golden_run_id: null`, no run link) → `4b judge — no verdict` (the un-producible-verdict honest-failure line). Flip the variant tabs (A · Staged checklist / **B · Progress-spine ★** / C · Verdict-first banner) to see why B's long-wait hero won.

Feeds **Phase 103 sketch 020** (Workflows Page + NL Authoring milestone, QUAL-01 publish-quality gate). This is **NET-NEW** — no publish UI exists in `frontend/src` today; the only live route is `POST /workflows/{id}/publish`. Cross-links:

- [workflows-page.md](workflows-page.md) — sketch 012 Workflows page; this **upgrades its binary "publish succeeded" toast** into the staged gauntlet, and the success verdict's "tweak → new version" forks a new draft from the published library.
- [workflow-builder.md](workflow-builder.md) — sketch 013 NL builder; the `golden_input` form + the read-back **dial chip** (`⚑ STRICT · …`) reflect the strictness dial the builder set, and "immutable on publish · tweak forks a new version" is the same versioning contract.

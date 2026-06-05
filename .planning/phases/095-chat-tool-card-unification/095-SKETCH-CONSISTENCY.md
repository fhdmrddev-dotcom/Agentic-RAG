# Phase 095 — Sketch Consistency & Linkage (build hand-off)

**Purpose:** the three 095 sketches (014 frame · 015 status-strip+scroll · 016 output-files) were
authored as standalone throwaway HTML files. They agree on **what** the unified chat tool-card is, and
the cross-concern hand-offs are clean in intent — but several shared primitives exist as 2–3
**drifted copies**. This doc is the instruction to the planner/executor: **build each shared primitive
ONCE**, from the canonical source named here, and do not re-fork it per concern. Verified by an
independent cross-sketch audit (2026-06-05).

> **One-line verdict:** the sketches are one design, three files. Wrap them as one component set.

---

## 1. Shared component inventory — build ONCE, share across all three

The minimal reusable set. Each row = one real component/function the code owns, the sketches that
use it, and the single source of truth it must read. **This is the contract for the build.**

| Component / fn | Renders | Sketch concerns | Single source of truth |
|---|---|---|---|
| **`RunFrame`** | Outer card: gradient bg, sticky header (avatar+title+sub+**strip slot**), progress bar, body slot, collapsed terminal row | 014 (frame) · 015 (host) · 016 (collapsed form) | `RunCard.tsx` verbatim per the 014 handover; relabel "N tools"→"N steps" |
| **`StepRail` + `StepRow`** | grid row: rail (`node`+`rail-line`+`snum`) · essence head · expand body; node states done/active/queued; active bloom | 014 (Synthesis) · 015 (lifted) | one presentational wrapper; data = `(index, status)` derived from the `tool_calls` array |
| **`ToolEssenceLine`** | `icon · name → result · pill · chev` one-liner (active variant shows the live verb) | 014 · 015 | `toolEssence(tool)` — ONE per-tool copy table (essence strings = grounding §2) |
| **`ToolBody` (per-tool)** | expand-on-click body: search meta/rows+confidence · read preview · code editor+STDOUT+caret · sub-agent summary · todo list | 014 `bodyHTML` ⊕ 015 `detailHTML` | **ONE** renderer keyed by tool kind — collapses the **G4 fork**; reuse existing `ToolCallPanel` bodies |
| **`StatusPill`** | running/done/err mono pill + dot | 014 · 015 · 016 | one component; state = card status |
| **`RunStatusStrip`** | `⏱ elapsed · Step N · activity` chip | 014 (header) · 015 (header **and** floating `live-chip`) | ONE strip, **two placement wrappers** (header / floating). Reads stable-start-ts elapsed + unified step count + activity verb. Resolves **G8/G9/G12** |
| **`fileIcon` / `iconFor`** | ext→gradient tile + uppercase label (`.ficx`) | 014 · 015 · 016 | **ONE** module; 016's superset map (incl. `rtf`/`ts`/`html`) is canonical. Resolves **G1** |
| **`OutputFileCard` (+Hero/Working)** | generated-file row: icon tile + name + size/sub + download btn; hero emphasis + working-group | 014 (`.file-out` inline) ⟶ must NOT fork · 016 (hero/working) | **ONE** card — production already reuses `OutputFileCard` (grounding §3). Hero/working = a layout flag + `dl-btn` states (idle/ok/dead). Resolves **G5/G11** |
| **`SubAgentEssence`** | single sub-agent card, one-per-task, dedup badge | 014 `.subrun` · 015 `.subrun-lite` | one component; the real fix = extend the `clientKey`/`makeToolKey` stamp to the sub-agent path (D-05). Resolves **G10** |
| **`unifiedStepCount()`** | the single integer behind rail `snum`, strip `Step N`, **and** collapsed "N steps" | 014 · 015 · 016 (all independent today) | ONE derivation feeding rail + strip + collapsed header — the **embodied D-04 fix**. Resolves **G6** |
| **`useFollowScroll` + `JumpToLive`** | follow-the-edge while near-bottom, release on scroll-up, re-arm, jump affordance | 015 | extend `MessageList` `isNearBottom`; one hook, the chip's morph is its only UI |

---

## 2. Cross-sketch LINKS (element → element)

| Link | How it's expressed | Status |
|---|---|---|
| 014 numbered rail `snum = i+1` → 015 strip `Step ${activeIndex+1}` (the D-04 count) | both compute `+1` independently; both READMEs assert the 1:1 map | **Intent-consistent, not embodied** → must become ONE `unifiedStepCount()` in code (not two literals) |
| 014 `.status-strip` in run-header → 015 header strip (winner C) | 014 defers placement to 015; 015's strip lives in 014's header | **Clean hand-off** |
| 014/015 finished run-card → 016 output area "below the answer" | 014 done-state copy literally points to "Sketch 016"; 016 renders collapsed run-card → answer → outputs | **Consistent** |
| Click-to-expand essence (D-01) in 014 → 015 | same `expandStep` + `peeked` Set | **Consistent logic, forked body renderers** (G4) |
| `fileIcon`/`iconFor` across 014 → 015 → 016 | each claims "one badge system" | **Divergent map bodies** (G1) — now reconciled (see §3) |
| 016 hero `.pptx` → 014 done-state deliverable | same `dissertation_defense.pptx` fixture | **Consistent file, divergent run length** (G6) |
| 014 `.file-out` → 016 hero/working card → 015 `.det-file` | one "generated file" concept, four class families | **Divergent** (G5/G11) → ONE `OutputFileCard` |

---

## 3. Consistency GAPS — reconciliation decisions

The audit found 13 drifts. Resolution (canonical source in **bold**); ✅ = fixed in the sketches now,
📋 = documented for the build (not worth re-editing throwaway HTML).

| # | Gap | Resolution |
|---|---|---|
| **G1** | `iconFor()` ext map: 016 is a superset (`rtf`/`ts`/`html`); 014/015 fall back to gray `?` for those | ✅ **014/015 aligned to 016's superset map.** Canonical = **016 `iconFor`**. Build = one module. |
| **G4** | Expand body forked: 014 `bodyHTML` (`.tc-search-*`/`.tc-editor`) vs 015 `detailHTML` (`.det-*`) | 📋 **ONE `ToolBody` keyed by tool kind** (reuse `ToolCallPanel` bodies). **Highest-risk drift** — forbid a second body system at build. |
| **G3** | Resting `.ess-text` base color: 014 bright (`--color-text`) vs 015 muted; (014 mutes finished via `.step.done`) | ✅ **014 base set to muted** to match 015 — finished essence lines recede uniformly; active → primary in both. |
| **G6** | Run-length fixture differs: 014=6 steps, 015=10, 016="10 steps", grounding §6=**11** | 📋 **Build to the §6 11-step fixture.** D-04 "count == cards" is proven per-sketch; cross-sketch counts intentionally not unified in throwaway mockups. |
| **G5/G11** | File-row class + download affordance fork: `.file-out`("Open") / `.file-row`("Download") / `.det-file`(no btn) | 📋 **ONE `OutputFileCard`**; the D-08 "every link downloads" states (idle/ok/dead) live on it. Forbid re-introducing `.file-out`. |
| **G12/G9/G8** | `live-chip` vs `status-strip` are near-twins with duplicated segment CSS; done-state via parent-selector (014) vs `.done` modifier (015); padding `…10px` vs `…4px` | 📋 **ONE `RunStatusStrip` + two placement wrappers**; pick the `.done` modifier; single padding. |
| **G10** | Sub-agent badge: 014 `dup-tag good/bad` (keeps the "today" 2-card demo) vs 015 `dup-ok` (good only) | 📋 **ONE `SubAgentEssence`**; the demo-only "bad" state is sketch scaffolding, drop in code. |
| **G2** | `.caret` height 13px (014) vs 12px (015) | 📋 trivial; pick one. |
| **G7** | `.avatar` 28/26/24px across 014/015/016 | 📋 one size (run-card identity element). |
| **G13** | per-tool icon vocabulary inline (emoji shorthand) vs grounding §2 Lucide names | 📋 one per-tool icon map at build (§2 is canonical: Lucide). |

**Canonical sources to carry into the build:** 014's **Synthesis frame** · 016's **superset `iconFor`** ·
the grounding **§6 11-step fixture** · the grounding **§2 per-tool icon + essence table**. Explicitly
**forbid** re-introducing `.file-out`, `detailHTML`, or a second `status-strip` stylesheet.

---

## 4. The single embodied invariant (why this matters)

D-04 ("one visible action = one step; strip == cards") and D-05 ("zero duplicates") are not styling —
they're **single-source-of-truth** requirements. The sketches *assert* the 1:1 map three times in three
files; the **code must embody it once**: `unifiedStepCount()` feeds the rail number, the strip "Step N",
and the collapsed "N steps"; the `clientKey`/`makeToolKey` stamp (extended to the sub-agent path) gives
every card one identity. If the build keeps these as parallel derivations, the honesty bugs (260528-02
step mismatch, 260529-02 sub-agent double-render) reopen. Build the inventory in §1 once; that is the
phase.

---

*Phase: 095-chat-tool-card-unification · Sketch consistency · 2026-06-05*
*Audit: independent cross-sketch read of 014/015/016 + READMEs + grounding brief + theme.*

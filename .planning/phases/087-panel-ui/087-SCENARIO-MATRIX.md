---
phase: 087-panel-ui
doc: scenario-matrix
purpose: Comprehensive workspace-panel/tool test scenarios — identified early so future panel/tool work stays clean. Status as of 2026-05-29 extended live testing.
status: living
---

# Phase 087 — Workspace Panel Scenario Matrix

Legend: ✅ verified live · ⬜ untested · ⚠️ known gap/design-question · 🔧 fixed this round

## Verified live (Chrome MCP + Supabase cross-check)

| Area | Scenario | Evidence |
|------|----------|----------|
| 004 shell | single nav-style toggle (open↔rail), ⌘., welcome-thread reopen-by-mouse, mobile bottom-sheet, no overflow/flush/stable, both themes | 087-08 Wave 2 |
| 005 file+diff | drill-in preview (md renders), 2-ver AND 3-ver VERSIONS selection (v1/v2/v3 pills), v→v diff, ⤢ overlay | toy /notes.md + real /exec-summary.md |
| 006 ask_user | paused amber run-card + locked composer + rail pulse-dot + pinned card (gated submit) + chat cue → answer (radio) → resume → green; 60s timeout → EXPIRED both surfaces | 2 runs |
| 007 seam | live quiet pointers; reload → self-contained resolved cards; no raw-JSON | reload test |
| PANEL-02/06 | todos live no-refresh, mixed statuses (COMPLETED/IN_PROGRESS), quiet pointers not dup cards | tea/real workflow |
| cross-provider | OpenAI · Anthropic · Google · OpenRouter identical; multi-tool; parallel-thread (no bleed); long-message (5.6KB) | scoreboard |
| **real KB workflow** | search_documents (real dissertation, "5 sources") → write_todos → workspace_write ×3 (v3) → ask_user → resume; panel == Supabase truth | dissertation run |
| **execute_code (success)** | generates file → surfaces as "Output files" link in CHAT run-card (sandbox-outputs URL), NOT in panel FILES; panel = "No workspace activity" | bar_chart.png |
| **execute_code (error)** | ZeroDivisionError → traceback in run-card, run "✓ done" gracefully, composer unlocks, panel intact (no crash) | 1/0 run |

## Fixed this round (UAT-found)
- 🔧 version-diff endpoint 500 — `delta_from_prev` JSONB double-encoding (`4d35b0f1`)
- 🔧 WRITE_TODOS SeamCard "0 todos" count (`9667a816`)
- 🔧 welcome-screen had no reopen toggle → nav-style collapse-to-rail (`c1d446f6`)
- 🔧 doubled back-chevron in FilePreview breadcrumb (`fde76fb9`)

## Untested (recommended next, by risk)

| Scenario | Why it matters |
|----------|----------------|
| PANEL-03 live: image preview, CSV table, large-file truncation, malformed/huge CSV → fallback | per-type routing only unit-tested; render live |
| free-text ask_user answer (vs radio) + reload mid-pending | answer path + persistence edge |
| run cancellation (Stop) mid workspace_write | partial-state rendering |
| non-adjacent diff (v1↔v3), >500-line truncated diff, identical-content (empty) diff | diff edges |
| nested/subtask todos (parent_id), large todo list (10+), empty workspace state | todo/section rendering |
| tool failure: workspace_write invalid path, search_documents empty result | error surfaces beyond execute_code |
| section-header collapse for each panel section | accordion (panel-shell D-04) |

## ⚠️ Gaps / design questions (future scope — see project_087_panel_followups memory)

1. **Office/PDF viewing in-panel** — FilePreview renders md/code/csv/text/image; pdf/docx/pptx → "Download / no preview" fallback. KB documents (the dissertation docx/pdf) aren't surfaced in the panel at all (panel = scratch `workspace_files`, KB = `documents`).
2. **Generated-files / artifacts consistency** — TWO separate file surfaces with different lifecycles: `execute_code` outputs = "Output files" links in chat (sandbox-ephemeral); `workspace_write` = panel FILES (persistent, versioned). Unifying / artifacts concept is a real design decision (ties to the tool-panel-consistency seed).
3. **Fast-thread-switch stale-id race** (low sev) — rapid thread-switch during run completion fired a versions fetch against a stale thread_id → 404 → "Could not load versions"; self-heals on reload, did not reproduce at human pace. Adjacent to deferred Phase 086 reconcile-abort.

## Extended testing round 2 (2026-05-29) — additional results

| Scenario | Result |
|----------|--------|
| PANEL-03 CSV render | ✅ `/people.csv` → proper table (headers name/age/city + 3 data rows), not fallback |
| Section collapse (accordion) | ✅ each section toggles independently via `aria-expanded` (collapsed Todos, expanded Versions, Files unaffected) |
| 3-version pills + default diff | ✅ pills v3/v2/v1 render; default v2→v3 diff `+4 −0`; no "could not load" on clean nav |
| Non-adjacent diff (v1↔v3) | ✅ VERIFIED round 3 (real Chrome MCP clicks) — see round-3 section. The "didn't reassign" was NOT a synthetic-event limit; it's a **two-click endpoint picker** (`VersionDiff.pickVersion`): 1st click only arms `lastClicked` (no visible change), 2nd click sets the pair. |
| Fast-interaction render glitch | ⚠️ rapid scripted new-chat+send+wait once left the panel at width 0 / no composer; self-healed on reload. Not reproduced at human pace — fragility under automation, low concern. |

## Extended testing round 3 (2026-05-29) — live Chrome MCP + Supabase/API cross-check

Setup: fresh thread "Community Hackathon To-Do List" (`9db1d9c5…`) — one run wrote 12 todos + `/broken.csv` (malformed) + `/dup.md` ×2 (identical content). Server truth cross-checked via the workspace REST API in-browser.

| Scenario | Result |
|----------|--------|
| **Non-adjacent diff (v1↔v3)** | ✅ on `/exec-summary.md` (3 ver). Two real clicks (v1 then v3) → pills "base v1 / target v3", summary **+8 −0**, header `--- v1 / +++ v3 / @@ -14,3 +14,11 @@` — matches API truth exactly (adjacent default was +4 −0). **Finding:** the picker is a 2-click model with NO feedback on the 1st click → discoverability gap (record). |
| **Empty workspace state** | ✅ fresh/new thread panel shows "No workspace activity yet" + helper line. |
| **Large todo list (12)** | ✅ TODOS "2/12"; all 12 rows render in `order_index` order, correct statuses (2 COMPLETED / 1 IN PROGRESS / 9 PENDING). No truncation/scroll issue. |
| **Nested/subtask todos** | ⚠️ render is **flat by design** — `TodosSection.tsx` sorts by `order_index` and renders one flat `<li>` per todo; `parent_id` is persisted (`replace_todos`/`todos` table) but **never visualized** (no indentation/tree). Not a bug vs PANEL-02 spec; note as a gap if hierarchy is ever wanted. |
| **Malformed CSV → fallback** | ✅ `/broken.csv` (61 B; unterminated `"` + ragged 2/4/5-col rows) → drill-in shows **"No preview available · Download"**, no broken/partial table. Parse-failure path (not size). |
| **Identical / empty diff** | ✅ `/dup.md` v1==v2 (16 B each). API diff = `{additions:0, deletions:0}`, empty string. UI default pair v1↔v2 → summary **+0 −0**, empty diff body. Minor UX: no explicit "No changes" affordance, just +0 −0. **Also confirmed `workspace_write` does NOT dedup identical content — it created v2.** |
| **Fast-interaction race (gap #3)** | ⚠️ CONFIRMED + self-heals. Rapid scripted (back→select file→expand VERSIONS→read, all instant) left `/dup.md` showing "No preview available" + "Could not load versions" while the **API returned 200 for both content and versions**. Reload + human-pace repeat rendered correctly (markdown + +0 −0 diff). Automation-pace artifact, not a backend fault. Adjacent to deferred Phase 086 reconcile-abort. |

**Still untested (carried to remainder of this session):** free-text ask_user answer + reload mid-pending; huge-diff >500-line truncation; huge CSV (>2000 rows / >256 KB) → "too large"; large-file >8192-char truncation; image preview (bucket — reachability in question, see note); Stop-mid-write; tool failure (invalid path); empty search result.

> **Bulk-content note:** `workspace_files` is populated ONLY by `workspace_write`, which takes a single literal `content` string (text→UTF-8, no append/edit mode). `execute_code` outputs go to sandbox-outputs (chat links), NOT the workspace. So >500-line diffs / >2000-row CSVs must be agent-emitted in one call — impractical/unreliable at that volume. These thresholds are unit-covered; live volume tests are attempted where the agent can plausibly emit the content, else flagged as code-confirmed-only.

## Architecture facts (for future work)
- **Workspace panel = agent scratch** (`workspace_write` → `workspace_files` table, versioned). **Separate** from the user's **KB** (`documents` table, read by `search_documents`).
- Panel-owned tools (render in panel + quiet chat pointer): `write_todos`, `workspace_write`, `ask_user`. All other tools (search_documents, execute_code, …) render in chat only.
- `execute_code` outputs are sandbox files served from `/sandbox-outputs/...`, surfaced as run-card "Output files" links — a third file concept distinct from both KB docs and workspace files.

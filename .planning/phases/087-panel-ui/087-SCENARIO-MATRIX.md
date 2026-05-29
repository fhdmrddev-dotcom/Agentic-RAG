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

## Architecture facts (for future work)
- **Workspace panel = agent scratch** (`workspace_write` → `workspace_files` table, versioned). **Separate** from the user's **KB** (`documents` table, read by `search_documents`).
- Panel-owned tools (render in panel + quiet chat pointer): `write_todos`, `workspace_write`, `ask_user`. All other tools (search_documents, execute_code, …) render in chat only.
- `execute_code` outputs are sandbox files served from `/sandbox-outputs/...`, surfaced as run-card "Output files" links — a third file concept distinct from both KB docs and workspace files.

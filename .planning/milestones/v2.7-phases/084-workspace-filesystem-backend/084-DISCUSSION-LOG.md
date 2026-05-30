# Phase 084: Workspace Filesystem Backend - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-28
**Phase:** 084-workspace-filesystem-backend
**Areas discussed:** File paths & structure, Storage limits & quotas, Visibility gap (no panel yet)

---

## File Paths & Structure

### Question 1: Nested vs flat paths

| Option | Description | Selected |
|--------|-------------|----------|
| Nested paths (Recommended) | Agent can write /analysis/charts/revenue.png — feels like a real filesystem. Stored as a path string, not actual OS directories. | ✓ |
| Flat only | Just filenames like report.md, chart.png — simpler, no folder concept needed | |
| You decide | Claude picks based on what the research recommends | |

**User's choice:** Nested paths (Recommended)
**Notes:** None

### Question 2: Max file count per thread

| Option | Description | Selected |
|--------|-------------|----------|
| Soft limit (100 files) | Agent gets a warning after 100 files but can still write. Prevents runaway loops. | ✓ |
| Unlimited for now | No cap — revisit when we see real usage. Less code to write now. | |
| You decide | Claude picks a sensible default | |

**User's choice:** Soft limit (100 files)
**Notes:** None

---

## Storage Limits & Quotas

### Question 3: Single-file size cap

| Option | Description | Selected |
|--------|-------------|----------|
| 10 MB (Recommended) | Covers generated PDFs, CSVs, images. Matches Supabase Storage free tier limits. | ✓ |
| 50 MB | Generous — covers large data exports. Unusual for a single LLM tool call. | |
| You decide | Claude picks based on typical agent output sizes | |

**User's choice:** 10 MB (Recommended)
**Notes:** None

### Question 4: Behavior when 100-file soft limit is exceeded

| Option | Description | Selected |
|--------|-------------|----------|
| Warning in tool result | Agent sees 'Warning: 102/100 files in workspace' but write succeeds. Agent can self-correct. | ✓ |
| Hard block after buffer | Soft warning at 100, hard block at 150 — agent must delete files first. | |
| You decide | Claude picks the approach that feels most natural for an AI agent | |

**User's choice:** Warning in tool result
**Notes:** None

---

## Visibility Gap (No Panel Yet)

### Question 5: User visibility of workspace files before panel ships

| Option | Description | Selected |
|--------|-------------|----------|
| API endpoints only (Recommended) | Build REST endpoints now — panel consumes them later. Devs can curl them. | ✓ |
| Minimal chat indicator | Show a small 'File saved: plan.md' badge in chat messages. No browsing. | |
| Invisible until panel | No user-facing surface at all until Phase 087. | |

**User's choice:** API endpoints only (Recommended)
**Notes:** None

---

## Claude's Discretion

- Whether workspace_service.py is one file or split into service + storage adapter
- Diff output format details (unified text vs JSON delta vs both)
- Migration numbering starting point (next after 053)
- Content preview in SSE events
- Test strategy scope

## Deferred Ideas

- User inline editing of workspace files (out of scope per REQUIREMENTS.md)
- Workspace files as RAG corpus (out of scope — would degrade search)
- Cross-thread file sharing (per-thread scoping for v1)
- Auto-pruning of old versions (keep all for now)

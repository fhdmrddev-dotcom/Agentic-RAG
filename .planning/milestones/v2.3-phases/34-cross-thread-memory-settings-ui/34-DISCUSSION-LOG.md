# Phase 34: Cross-Thread Memory — Settings UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-17
**Phase:** 34-cross-thread-memory-settings-ui
**Areas discussed:** Backend API approach, Edit interaction, Delete confirmation, Section placement & visual style

---

## Backend API Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Direct Supabase JS client | user_memory has full SELECT/UPDATE/DELETE RLS; frontend operates table directly | ✓ |
| New FastAPI CRUD endpoints | Consistent with audit log pattern; enables audit trail for memory edits | |
| Hybrid (Supabase reads + FastAPI writes) | Reads skip backend; writes go through FastAPI for audit logging | |

**User's choice:** "You decide based on best value" — selected Direct Supabase JS for minimum surface area; audit logging not required by MEM-02.

---

## Edit Interaction

| Option | Description | Selected |
|--------|-------------|----------|
| Inline click-to-edit | Click value → input + Save/Cancel inline; key readonly | ✓ |
| Edit icon + Dialog modal | Pencil icon opens Dialog with input field | |
| Always-visible inputs | All values shown as inputs (no toggle) | |

**User's choice:** Auto-decided — inline edit chosen for ChatGPT Memory parity and zero new component dependencies.
**Notes:** Only one row editable at a time; empty value blocks save.

---

## Delete Confirmation

| Option | Description | Selected |
|--------|-------------|----------|
| Dialog confirmation | Existing shadcn Dialog component (DocumentList.tsx pattern) | ✓ |
| Inline expand | "Confirm?" replaces row actions; no modal | |
| Toast-with-undo | Delete fires immediately, undo toast shown for 5s | |

**User's choice:** Auto-decided — Dialog chosen for consistency with DocumentList version restore pattern.

---

## Section Placement & Visual Style

| Option | Description | Selected |
|--------|-------------|----------|
| Above AuditLogSection, card-list rows | Memory is active management; placed before read-only audit log | ✓ |
| Below AuditLogSection | Memory treated as secondary to audit history | |
| Formal table (like AuditLog) | Same visual language; less intuitive for editable content | |

**User's choice:** Auto-decided — above audit log, card-list rows to signal editability vs read-only audit table.

---

## Claude's Discretion

- Exact Lucide icon choices (Pencil / Trash2)
- Column width allocations within row
- Transition/animation on edit mode (subtle)
- Supabase JS client import pattern

## Deferred Ideas

- Audit logging of memory edits/deletes — not in MEM-02 scope
- Bulk delete / "clear all memories"
- Memory import/export

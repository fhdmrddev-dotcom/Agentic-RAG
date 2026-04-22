# Phase 34: Cross-Thread Memory — Settings UI - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a Memory section to the Settings page where users can view, edit, and delete their `user_memory` entries. Four deliverables:
1. A Memory section (new `MemorySection` component) placed above the existing `AuditLogSection` in SettingsPage
2. List of all user memory entries showing key, value, and created date
3. Inline click-to-edit for the value field (key is never editable)
4. Per-row delete with Dialog confirmation, and an empty state with guidance

No new FastAPI endpoints. No new Supabase migrations. Phase 33 backend is complete.

</domain>

<decisions>
## Implementation Decisions

### A. Backend Access Pattern
- **D-01:** Use the Supabase JS client directly — `user_memory` table has full SELECT/UPDATE/DELETE RLS (auth.uid() = user_id) so the frontend can operate it without a FastAPI intermediary.
- **D-02:** No new FastAPI router or endpoints for this phase. Audit logging of memory edits/deletes is not required by MEM-02 and would be noise.
- **D-03:** Three Supabase JS operations needed:
  - `SELECT * FROM user_memory ORDER BY updated_at DESC` — load all entries
  - `UPDATE user_memory SET value = $1, updated_at = now() WHERE key = $2` — save edit
  - `DELETE FROM user_memory WHERE key = $1` — confirm delete
- **D-04:** No pagination — user_memory is a small personal table (bounded by the top-10 injection cap from Phase 33). Load all entries at once.

### B. Edit Interaction
- **D-05:** Inline click-to-edit — clicking the value text turns it into a controlled `<input>` pre-filled with the current value. Save/Cancel buttons appear inline to the right. The key is displayed as readonly text (never editable).
- **D-06:** "Save" calls the Supabase UPDATE; on success, patch the local state (no full reload). "Cancel" restores the display value without any network call.
- **D-07:** Only one row can be in edit mode at a time — opening a second row auto-cancels the first unsaved edit.
- **D-08:** Empty input is not saveable — Save button disabled when value is whitespace-only.

### C. Delete Confirmation
- **D-09:** Uses the existing shadcn `Dialog` component from `@/components/ui/dialog` — same component used by DocumentList.tsx for version restore confirmation.
- **D-10:** Dialog content: title "Delete memory entry?", body "This will permanently remove the memory for key **{key}**. The agent won't recall it in future conversations.", destructive "Delete" button + "Cancel".
- **D-11:** On confirm, call Supabase DELETE then remove the entry from local state (no full reload).

### D. Section Placement & Visual Style
- **D-12:** New `MemorySection` component placed **above** `AuditLogSection` in SettingsPage. Memory is actively managed; audit log is read-only history.
- **D-13:** Visual style: `SectionCard` wrapper (consistent with all other settings sections), rows separated by `divide-y divide-border/30`. NOT a formal `<table>` — the editable nature is signaled by the row-based layout.
- **D-14:** Row layout per entry:
  - Left: key in `font-mono text-xs bg-muted/30 px-2 py-1 rounded ghost-border` chip (same style as action_type in AuditLog), then value text (or input when editing), then muted `created_at` date
  - Right: edit pencil icon + trash icon, visible on row hover (`group-hover:opacity-100 opacity-0`)
- **D-15:** Empty state: centered text "No memories stored yet. The agent will remember facts and preferences you tell it during conversations." with a muted `Brain` icon above it.

### E. Loading & Error States
- **D-16:** Loading: spinner centered in the section (same `Loader2 animate-spin` pattern as AuditLogSection).
- **D-17:** Error: muted destructive message "Failed to load memories. Refresh to try again." (same pattern as AuditLogSection error state).
- **D-18:** Edit/delete errors surface as a transient inline error below the section header — auto-dismisses after 4 seconds. Does not replace the list.

### Claude's Discretion
- Exact Lucide icon choices for edit (Pencil) and delete (Trash2) — follow what's already imported in SettingsPage or add from lucide-react
- Exact column width allocations within the row
- Transition/animation on edit mode open/close (subtle, optional)
- Supabase JS import pattern — follow how it's used elsewhere in the frontend

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing frontend patterns
- `frontend/src/pages/SettingsPage.tsx` — `SectionCard`, `AuditLogSection` (structural template), existing imports, CSS patterns (`ghost-border`, `bg-muted/30`, `divide-y divide-border/30`)
- `frontend/src/components/ingestion/DocumentList.tsx` — Dialog usage for destructive confirmation (version restore pattern, lines ~244–260)
- `frontend/src/components/ui/dialog.tsx` — Dialog component available in the project

### Backend / DB (read-only reference)
- `backend/supabase/migrations/` — find the user_memory migration from Phase 33 for exact column names (`id`, `user_id`, `key`, `value`, `created_at`, `updated_at`)
- `backend/app/api/threads.py` §1146-1225 — remember/recall tool dispatch; shows exact table name and column usage

### Supabase JS client pattern
- Search `frontend/src/` for existing `supabase.from(` calls to follow the established client import and auth pattern

### Requirements
- `.planning/REQUIREMENTS.md` §MEM-02 — acceptance criteria this phase must satisfy

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SectionCard` (SettingsPage.tsx:113) — wraps the new Memory section; title + description + children
- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter` — from `@/components/ui/dialog`, already used in DocumentList.tsx
- `Button` (shadcn/ui) — Save/Cancel/Delete/edit action buttons
- `Loader2` (lucide-react) — loading spinner, already imported in SettingsPage
- `ChevronLeft`, `ChevronRight`, `Download` — already imported; check what icon imports exist before adding new ones

### Established Patterns
- `useEffect` fetch with `loading`/`error` state — same as `AuditLogSection` and settings form
- Row hover actions: `group` + `group-hover:opacity-100 opacity-0` for icon visibility — common pattern in the codebase
- `ghost-border` chip style for key display: `font-mono text-xs bg-muted/30 px-2 py-1 rounded ghost-border`
- Inline input: use the same `Input` from `@/components/ui/input` or a plain `<input>` with `className="text-sm bg-transparent border-b border-primary/40 focus:outline-none px-1"` (minimal inline style)

### Integration Points
- `SettingsPage.tsx` — insert `<MemorySection />` above `<AuditLogSection />`
- Supabase JS client — direct table operations on `user_memory`
- No new backend files, no new migrations, no new routes in `main.py`

</code_context>

<specifics>
## Specific Design References

- ChatGPT Memory (2024) is the product reference — agent-triggered storage, user-reviewable list with delete. Phase 34 mirrors the settings panel pattern.
- The inline edit approach (click value → input) is identical to how ChatGPT's memory editor works. The key is intentionally not editable — users should delete and re-remember if they want a different key.
- Memory entries are a personal, small dataset. No need for search, filter, or pagination in this phase.

</specifics>

<deferred>
## Deferred Ideas

- Audit logging of memory edits/deletes (`settings.update` action type) — not required by MEM-02; can be added in a future quality pass
- Bulk delete ("clear all memories") — scope creep for this phase
- Memory import/export — out of scope

</deferred>

---

*Phase: 34-cross-thread-memory-settings-ui*
*Context gathered: 2026-04-17*

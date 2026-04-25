# Phase 48: Settings & Navigation Polish — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-25
**Phase:** 48-settings-navigation-polish
**Areas discussed:** Web search toggle UX, Nav label alignment, Logo collapsed state

---

## Web Search Toggle — Placement & Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Toggle gates the section | Toggle at top; key+max-results fields hide when off. Same pattern as Reranking. | ✓ |
| Independent toggle + always-visible key | Toggle and key both always visible; toggle=off excludes tool. | |
| Key field rename only | No separate toggle — clearing key = disabled. No schema change. | |

**User's choice:** Toggle gates the section (recommended)
**Notes:** Matches the Reranking subsection pattern exactly.

---

## Web Search Toggle — No Key + Toggle On

| Option | Description | Selected |
|--------|-------------|----------|
| Warn in UI | Show "No Tavily key configured — web search will not run" when enabled without a key. | ✓ |
| Silent / backend handles it | Save succeeds, backend skips gracefully if no key. | |
| Block save | Prevent saving toggle=on without a key. | |

**User's choice:** Warn in UI (recommended)
**Notes:** Advisory amber text, not a hard block.

---

## Nav Label Alignment (NAV-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Only Sparkles logo disappears when collapsed | Nav item icons visible; only brand logo disappears. | ✓ |
| All icons disappear | Entire sidebar blank when collapsed. | |
| Labels far right in expanded state | Different visual bug. | |

**User's choice:** Only the Sparkles logo in the header area disappears
**Notes:** User clarified: "icon is not showing when the navigation panel is folded and then it become visible along with the label when panel expanded. I want to show only the logo when folded and logo + label when expanded." This confirms NAV-01 and NAV-02 are the same root cause — the entire logo group (icon + text) has opacity-0 when collapsed.

---

## Logo Collapsed State (NAV-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Sparkles icon only, centered in 64px strip | Icon visible, text hidden when collapsed. | ✓ |
| Nothing in logo slot | Logo area empty when collapsed. | |

**User's choice:** Sparkles icon only (recommended)
**Notes:** Fix is to move opacity class from container div to text span only.

---

## Claude's Discretion

- Exact amber shade for no-key warning
- Whether warning appears below the Toggle FieldRow or below the key input

## Deferred Ideas

- Frontend pre-flight upload size validation (from Phase 47)
- Folder-level doc count badges on FolderNode

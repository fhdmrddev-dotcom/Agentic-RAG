---
status: partial
phase: 041-ui-redesign-tool-call-visualizer-citations
source: [041-VERIFICATION.md]
started: 2026-04-19T00:00:00.000Z
updated: 2026-04-19T00:00:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Glassmorphic panel depth (ToolCallPanel done-state)
expected: A completed tool call panel shows frosted glass card (bg-card/80 backdrop-blur-sm); expanding parameters shows a darker nested frosted block (bg-card/50 backdrop-blur-md). GPU compositing renders both layers as visually distinct depth levels.
result: [pending]

### 2. Citation color-coded accents (CitationCard)
expected: Citation cards show colored left gradient strip — red for .pdf, blue for .docx, purple for .md — and matching colored file icons. Default (unknown extension) shows muted-foreground color. No solid border-l-2 visible.
result: [pending]

### 3. CitationList animation smoothness
expected: Clicking "N sources" reveals citation cards with a smooth 200ms slide-from-top + fade-in animation (not an instant pop). Collapsing also animates out smoothly.
result: [pending]

### 4. MessageInput floating pill
expected: The message input has visible breathing room on left, right, and bottom — it does not extend full-width to edges. Corners are visibly more rounded (rounded-2xl). A subtle primary-tinted shadow is visible below the pill.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

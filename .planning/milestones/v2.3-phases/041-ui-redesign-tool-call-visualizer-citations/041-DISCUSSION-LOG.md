# Phase 41: UI Redesign — Tool Call Visualizer & Citations - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-19
**Phase:** 041-ui-redesign-tool-call-visualizer-citations
**Areas discussed:** CitationCard gradient border, MessageInput pill shape, CitationList animation, ToolCallPanel glass depth

---

## CitationCard Gradient Border

| Option | Description | Selected |
|--------|-------------|----------|
| Left gradient accent | Replace border-l-2 with a gradient-colored left strip (w-0.5 bg-gradient-to-b per file type). Minimal DOM change, matches existing left-border style. | ✓ |
| Full gradient frame | Full-perimeter glowing border using gradient background on outer div + inner content div. Richer "ambient glow" but adds DOM nesting. | |

**User's choice:** Left gradient accent  
**Notes:** Color mapping: PDF=from-red-400/60, DOCX=from-blue-400/60, Markdown=from-purple-400/60, default=from-muted-foreground/30. All to-transparent.

---

## MessageInput Pill Shape

| Option | Description | Selected |
|--------|-------------|----------|
| True floating with air | Add mx-4 mb-3 on outer wrapper; remove full-width bar background. Pill sits with breathing room above page floor. | ✓ |
| Visual upgrade only | Keep full-width wrapper, upgrade inner shape to rounded-2xl shadow-lg. Subtler change, no layout shift. | |

**User's choice:** True floating with air  
**Notes:** Outer wrapper background becomes transparent; inner pill keeps ghost-border bg-card/80 backdrop-blur-sm. Inner rounded-xl → rounded-2xl, shadow-sm → shadow-lg shadow-primary/5.

---

## CitationList Animation

| Option | Description | Selected |
|--------|-------------|----------|
| Install shadcn Collapsible | npx shadcn add collapsible — Radix-based, handles accessibility and animation natively. Radix already in project. | ✓ |
| CSS max-height transition | No new dependency. Fixed max-height transition. Less clean (requires estimated max-height). | |

**User's choice:** Install shadcn Collapsible  
**Notes:** 200ms ease via Radix data attributes (data-[state=open]/data-[state=closed]). Trigger button keeps existing "N sources" + chevron pattern.

---

## ToolCallPanel Glass Depth

| Option | Description | Selected |
|--------|-------------|----------|
| SC-1 exactly: wrapper + params only | Outer wrapper bg-card/80 backdrop-blur-sm. Parameters block bg-card/50 backdrop-blur-md. Tool rows untouched. | ✓ |
| 3 levels: wrapper + rows + params | Outer wrapper + individual tool row headers (ghost-border + subtle bg) + parameters block. Richer layering. | |

**User's choice:** SC-1 exactly (wrapper + params only)  
**Notes:** Individual tool row headers not given glass treatment. Strictly additive per SC-5.

---

## Claude's Discretion

- Exact lucide-react icon choices for PDF, DOCX, Markdown file types
- Collapsible animation keyframe approach (slideDown custom keyframe vs. Radix CSS variable height)
- Whether to add animate-slideDown to tailwind.config.js

## Deferred Ideas

None.

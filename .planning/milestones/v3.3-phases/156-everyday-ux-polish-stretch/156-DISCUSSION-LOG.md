# Phase 156: Everyday UX Polish (STRETCH) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-16
**Phase:** 156-everyday-ux-polish-stretch
**Mode:** Autonomous (operator unattended-run directive — orchestrator auto-selected and
auto-decided every gray area; no AskUserQuestion turns). Decisions grounded in the three
operator-won sketches (076/077/078), SEED-045, and a live codebase scout.
**Areas discussed:** Layout/IA, New Chat reachability, Search, Grouping, ⌘K
implementation, Scope sequencing, Behavior preservation, Mobile, Bug routing

---

## Layout & Information Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Fix the collapsed rail in place | Keep the w-64/w-16 collapsible panel; just un-mask New Chat + Search when collapsed (Sketch 076 framing) | |
| Organize the list inside the sidebar | Add search + date/folder groups to the existing single column (Sketch 077 framing) | |
| **Permanent rail + dedicated history column (Sketch 078-D)** | Nav becomes a thin permanent icon rail; a separate full-height column owns chat history; ⌘K jumps anywhere | ✓ |

**Choice:** Sketch 078-D — the operator's own 2026-07-16 course-correction and marked
winner. **Notes:** 077's README explicitly records that organizing inside the sidebar
"doesn't fix the root problem — a growing nav and the chat history compete for one
column." 078 supersedes that framing. Selecting anything less would revert the operator's
deliberate reframe. Also structurally closes folded BUG-260711-01.

---

## New Chat reachability (SC#1)

| Option | Description | Selected |
|--------|-------------|----------|
| New Chat only in the history header | 078-D literal — column always visible on chat so New Chat always shows | |
| **New Chat in the rail (076-B) + history header** | Rail (+) reachable from every view; header "New" is the in-context entry | ✓ |

**Choice:** Both, rail-primary. **Notes:** Honors the separately-won 076-B affordance and
makes New Chat reachable from non-chat views in one click. SC#1 is satisfied by
construction — no state hides New Chat once the rail is permanent + the column always-on.

---

## Search (SC#2)

| Option | Description | Selected |
|--------|-------------|----------|
| Inline column filter only | Plain substring filter over loaded threads | |
| ⌘K global finder only | Command palette over all threads, no inline box | |
| **Both tiers (078-D)** | Inline "filter this list" box + a global ⌘K finder — two distinct jobs | ✓ |

**Choice:** Both (078-D). **Notes:** Verified pure-frontend — `GET /threads` has no limit,
so all threads are client-side already. Inline box satisfies SC#2 on its own; ⌘K is the
"jump anywhere across the whole backlog" layer.

---

## Grouping (SC#3)

| Option | Description | Selected |
|--------|-------------|----------|
| **Date buckets, folder as a row chip** | Today/Yesterday/Last 7/Last 30/Older + folder chip | ✓ |
| Folder groups (collapsible) | Container-first (077-B) | |
| Date⇄Folder toggle | Segmented switch (077-C) | optional |

**Choice:** Date default; folder chip on rows; toggle optional. **Notes:** Matches 078-D's
resting default; satisfies "date and/or folder." The toggle is include-if-cheap.

---

## ⌘K implementation

| Option | Description | Selected |
|--------|-------------|----------|
| **shadcn `Command` (cmdk)** | Battle-tested palette; a11y + keyboard nav free; small frontend dep | ✓ (research-validate) |
| Hand-roll on ui/dialog.tsx | No new dep; own the a11y + keyboard nav | fallback |

**Choice:** Prefer cmdk, validate in research. **Notes:** Phase 155 just closed A11Y-01 —
lean on a primitive that gives focus-trap + roving-tabindex for free rather than risk new
a11y debt. Fallback to Dialog if a new dep is unwanted.

---

## Scope sequencing (STRETCH discipline)

**Choice:** W1 = rail + history column + inline filter + date grouping (all 3 SCs) → W2 =
⌘K palette → W3 = mobile search + polish. **Notes:** The acceptance bar ships after W1;
⌘K is in scope but the designated cut-line if budget runs short.

---

## Behavior preservation & Mobile

**Choice:** Move `renderThreadList()` into the new column as lift-and-shift (preserve
rename/delete/SEED-064 dots+Stop/options/folder-scope/A11Y-01). Mobile keeps its drawer;
add title search to it. **Notes:** Do-no-harm — don't regress Phase 155 a11y or SEED-064
run visibility.

---

## Bug routing (mandatory reported-bugs cross-check)

**Folded:** BUG-260711-01 (chat-list-too-narrow-nav-panel-crowding, major, open) →
`folded_into: 156`. 078-D is the structural fix it asked for.
**Reviewed, not folded:** other open `surface: Agentic-RAG` reports are chat
run/streaming/provider issues, out of this nav/thread-list phase's domain.

## Claude's Discretion

- Exact rail/column widths, whether the history header repeats New Chat, and whether to
  ship the optional Date⇄Folder toggle + mobile grouping (include if cheap) — resolve
  against Sketch 078's `index.html` during planning.

## Deferred Ideas

- SEED-113 (user/profile menu — same rail real estate), Sketch 078-B (standalone Chats
  page), pinning/favourites, folder CRUD, per-thread URL routing (SEED-015).

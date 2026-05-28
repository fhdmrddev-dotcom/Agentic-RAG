# Phase 087: Panel UI - Context

**Gathered:** 2026-05-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the **right-side workspace panel** that makes the agent's work visible and interactive: a collapsible ~30%-width panel (bottom-sheet on mobile) with four sections — **Todos · Files (browser + preview) · Pending question (`ask_user`) · Versions (diff viewer)** — plus the **chat↔panel seam** (live one-line pointers in chat + reloaded self-contained cards).

Delivers requirements **PANEL-01, PANEL-02, PANEL-03, PANEL-04, PANEL-07**. (PANEL-05/06 — the single SSE subscription + separate state stores — already shipped in Phase 086.)

**In scope:** read / preview / diff / answer. Display the agent's workspace state reactively (no refresh), preview files with existing renderers, compare file versions, answer `ask_user` prompts to resume the agent.

**Out of scope:** user inline file editing (deferred to v2.8), any destructive control (`workspace_delete` is an agent tool, not a panel control), the broader chat tool-card unification (separate future phase — see Deferred).

</domain>

<decisions>
## Implementation Decisions

### File Preview (PANEL-03)
- **D-01:** CSV files get a **minimal in-panel `<table>`** rendered from the CSV — **no new dependency**. Graceful fallback to the standard "No preview available · Download" notice when the CSV is malformed or too large. This is the one preview type with no existing renderer; md/code/text reuse `MarkdownRenderer` + `react-syntax-highlighter` (locked by UI-SPEC).
- **D-02:** File content comes from `GET /workspace/files/{id}/content` (already built): inline files return `{storage_type:"inline", content}`; bucket/binary files return `{storage_type:"bucket", signed_url}` (60s TTL). Image preview frames the signed URL; binary/too-large → calm "no preview · Download" fallback (must not break layout).

### Pending Question (PANEL-04)
- **D-03:** Multiple simultaneous `ask_user` prompts **stack — newest pinned on top, each its own amber card, all sticky, no cap** (the case is rare). `useAskUserPrompt` returns `PendingAsk[]`; render the full array. Submit on any card un-pauses the run + unlocks the composer (per UI-SPEC `[ask]` D4).

### Versions / Diff (PANEL-07)
- **D-04:** Diff is fetched from `GET /workspace/files/{id}/diff?from=&to=` (already built). The wire shape is a **raw unified-diff string**, not pre-parsed hunks: `{ path, from_version, to_version, delta:{ format:"unified", diff:"<string>", stats:{additions,deletions}, truncated:bool }, stats }`. **`VersionDiff` parses the unified-diff string client-side** to render the in-column `+/−` with the fixed 16px sign-gutter. Backend already truncates at 500 diff lines and sets `truncated:true` — surface that state in the UI (the `⤢` overlay shows the same truncated payload; no extra fetch).

### Reported-Bug Routing (MANDATORY cross-check)
- **D-05:** **BUG-260529-02** (chat tool-cards: no auto-scroll, expanded-by-default, duplicate sub-agent cards — MAJOR, open) → **kept SEPARATE** as its own future phase. Phase 087 adds only the *additive* seam renderers (`SeamPointer`/`SeamCard`/`PausedRunCue`) and **must not worsen** the existing cards. Frontmatter updated with the 087-review note. Aligns with UI-SPEC's explicit ruling that `PausedRunCue` is additive and not folded into card unification.
- **D-06:** **BUG-260521-02** ("Final outputs" pinned panel — no download link, partial-closed) → **kept SEPARATE**. Different surface (old pinned card in `MessageItem`) from the new Workspace panel; backend now carries url+size so it's a quick Chrome-MCP re-verify later, not 087 scope. Its existing `re_open_trigger` stands.

### Claude's Discretion
- **Token additions** (UI-SPEC Open Contract #1): add `--warning: 38 92% 60%` (+ `--warning-foreground`) and a dim-text var to `index.css :.dark` before building — a token addition matching `[theme]`, not a visual redesign. Executor decides exact var naming.
- **Empty-state heading copy** (Open Contract #2): use UI-SPEC's recommended `No workspace activity yet` + body, unless a different voice surfaces at plan-phase.
- **Contrast verification**: executor verifies the two at-risk amber pairs hit ≥4.5:1 (darken dim background rather than lighten text if needed) — per UI-SPEC Color section.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design Contract (LOCKED — visuals not re-opened)
- `.planning/phases/087-panel-ui/087-UI-SPEC.md` — full visual + interaction contract (layout grid, color language, typography, spacing, copywriting, accessibility, component inventory). Approved 6/6. **Every visual decision is locked here; this CONTEXT only adds the implementation gaps the SPEC flagged.**
- `.claude/skills/sketch-findings-agentic-rag/SKILL.md` (+ `references/panel-shell.md`, `references/file-browser-and-diff.md`, `references/pending-question.md`, `references/chat-panel-seam.md`) — operator-approved sketches 004–007 (G-2 satisfied), the design substrate the UI-SPEC translates.

### Backend API (already built — Phases 084/085/086)
- `backend/app/api/workspace.py` — `GET /files`, `GET /files/{id}/content`, `GET /files/{id}/versions`, `GET /files/{id}/diff` (the file/preview/diff data source).
- `backend/app/services/workspace_service.py` §`compute_diff` (line 99) — defines the unified-diff `delta` shape + 500-line truncation the `VersionDiff` component must parse.
- `backend/app/api/panel.py` — `GET /todos`, `GET /ask_user/pending`, `GET /tasks` (panel section data source).

### Frontend integration points (Phase 086 — live)
- `frontend/src/providers/StreamsProvider.tsx` — exported hooks `useTodos` (L1758), `useWorkspaceFiles` (L1777), `useAskUserPrompt` (L1798, returns `PendingAsk[]`), `useTasks` (L1817), `useViewingThread` (L1836). Panel consumes reactively.

### Project rules
- `CLAUDE.md` — provider-uniform UX, hot-file ledger (G-5), reuse-first (no new UI deps), reported-bugs cross-check.
- `.planning/REQUIREMENTS.md` §PANEL-01..07 — acceptance criteria.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `MarkdownRenderer.tsx` — `.md` previews + `ask_user` rich text. **Reuse, do not re-add.**
- `react-syntax-highlighter` — code-file previews + diff syntax. Already in repo.
- shadcn `button` / `dialog` / `scroll-area` (and likely `sheet` for mobile bottom-sheet) — present in `components/ui/`.
- Phase 086 hooks (above) — all panel data is already reactive; **assume no page refresh.**
- All backend endpoints exist — **this phase is frontend-only** (panel components + token additions). No new migrations, no new API routes expected.

### Established Patterns
- New panel components live in a NEW dir `frontend/src/components/panel/` — prefer new files over re-touching G-5 hot files (`ToolCallPanel`/`MessageItem`/`StreamsProvider`/`useMessages`). Those four are G-5 *satisfied* (075.7), so additive seam mounting is allowed, but keep it additive.

### Integration Points
- `WorkspacePanel` mounts as the 3rd grid column next to chat; reads `useViewingThread` + all panel hooks.
- Seam renderers (`SeamPointer`/`SeamCard`/`PausedRunCue`) mount into the chat transcript surface — additive only (see D-05).

</code_context>

<specifics>
## Specific Ideas

- The whole panel is a **translation job**, not a design job — sketches 004–007 + the UI-SPEC already decided the look and behavior. Planner/executor implement; they do not re-open visual decisions.
- Single-source-of-truth for the seam: live state renders in the panel, history in the transcript — never the same data rendered richly in both (UI-SPEC `[seam]`).
- Carry-forward verification debt from Phase 086: re-run the deferred **rapid thread-switch reconcile-abort** UAT item live once the panel hooks have a real consumer mounted (was unit-tested FC#5 in the interim).

</specifics>

<deferred>
## Deferred Ideas

- **BUG-260529-02** (chat tool-card unification: auto-scroll, collapse-by-default, sub-agent card dedup) — its own future phase. 087 must not worsen it (D-05).
- **BUG-260521-02** ("Final outputs" pinned-panel download link) — separate re-verify via Chrome MCP later; not 087 (D-06).
- **User inline file editing** — explicitly out of scope per REQUIREMENTS; v2.8.
- **`workspace_delete` user-facing control** — agent tool only; no destructive panel UI this phase.

</deferred>

---

*Phase: 087-panel-ui*
*Context gathered: 2026-05-29*

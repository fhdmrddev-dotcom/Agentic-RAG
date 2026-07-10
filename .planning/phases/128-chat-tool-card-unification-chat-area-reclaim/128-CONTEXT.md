# Phase 128: Chat Tool-Card Unification + Chat-Area Reclaim - Context

**Gathered:** 2026-06-27
**Status:** Ready for planning

<domain>
## Phase Boundary

One honest, unified, space-efficient chat surface across **every** provider. The
tool card becomes the single canonical home for live run info; it reads
identically on all providers; redundant chrome is removed; long user prompts stop
eating the chat area.

**In scope (5 requirements):**
- **TDP-02** — a tool's `description` ("about to…") streams live during the
  `preparing` window, before `tool_start`.
- **CTC-01** — the tool-card header shows the actual provider's logo per-provider,
  replacing the generic brand-pulse "spot" avatar.
- **CTC-02** — the tool card carries a unified content/layout across ALL providers
  (status · elapsed · step/file counts · description) — the single canonical, complete
  surface for live run info, no per-provider gaps.
- **CTC-03** — remove the redundant sticky elapsed timer above the composer
  (`StickyTimerBar`), reclaiming chat-area space. **Gated on CTC-02 holding.**
- **CTC-04** — long **user** prompts collapse to a clamped preview + "Read more"
  instead of rendering full-height.

**Out of scope (explicitly NOT this phase):**
- The outer "Setting up agent…" banner honesty (reasoning/arg-streaming activity,
  `toolMeta.ts:73`) and title-gen serialization (`threads.py:1039`) — the other two
  causes of `setting-up-agent-hides-model-activity`. Deferred to a dedicated
  run-legibility phase (see `<deferred>`).
- The duplicate empty-assistant-avatar reconcile race (`BUG-260610-01` second
  symptom) — a StreamsProvider/MessageList double-mount, separate family.
- Any change to `backend/app/api/threads.py` (G-5 extraction-due — do not grow it).
- The assistant-answer message branch (CTC-04 clamps USER prompts only).
- New runtime / shared-path forks — provider differences stay at the
  gateway/adapter boundary (red line D-14).

</domain>

<decisions>
## Implementation Decisions

This phase is **G-2 sketch-gated** — sketches 048/049/050 (winners ALL **A**,
operator-approved 2026-06-27) are the acceptance bar. D-01..D-03 below are the
**locked sketch design** (carried forward, not re-litigated). D-04..D-08 are the
implementation decisions settled in this discussion.

### Sketch-locked design (G-2 acceptance bar — MANIFEST decisions 38–40)
- **D-01 (CTC-01 / CTC-02 / TDP-02 — sketch 048-A):** Unified cross-provider tool
  card. The brand-pulse `Bot` dot (`RunCard.tsx:280/287`) → the provider's REAL
  official logo per-provider on a faint per-provider tinted backing; the
  `brandPulse` ring stays while streaming. `tc.args.description` surfaces DURING the
  `preparing` window, before `tool_start`. The card reads byte-identically across
  all providers — only the logo differs. Already-wired (no flag): `message.provider`
  / `message.model` (the `{provider} · {model} · turn N` sub at `RunCard.tsx:246`),
  `tc.args.description`, `RunStatusStrip`.
- **D-02 (CTC-03 — sketch 049-A):** DELETE `StickyTimerBar` (`ChatArea.tsx:533-585`,
  the 076.1 D-03 bar) + its mount (`ChatArea.tsx:517-523`). Pure subtraction, **NO
  net-new wire** — keep the existing `showJumpToLive = !isPinned && isStreaming`
  floating chip. The header `RunStatusStrip` (in-view) + the `MessageList` floating
  "↓ Jump to live" chip (scroll-away) remain the ONLY two status homes. (Sketch B —
  the promoted floating-chip trigger — was REJECTED as imperceptible; it is the
  documented FALLBACK only if users report lost always-visible status post-ship.)
- **D-03 (CTC-04 — sketch 050-A):** Long USER prompt → `-webkit-line-clamp:7`
  preview + a fade **matched to the violet end of the bubble's 135° gradient** (not
  the page bg) + an inline "Read more"/"Show less" chip (`MessageItem.tsx:205-217`).
  SHORT prompts render UNCHANGED; right-alignment, `rounded-br-md` tail,
  `max-w-[70%]`, `pre-wrap`+`break-words`, the `User` avatar all preserved. **USER
  prompts ONLY** — do NOT clamp the assistant branch. Net-new: NONE (pure
  client-side clamp state over `message.content`). Cheapest honest impl =
  always-render the clamp container, reveal the fade + Read-more only when
  `scrollHeight > clientHeight`.

### Reported-bug folding (D-04)
- **D-04:** Fold the **TDP-02 description slice** of `setting-up-agent-hides-model-activity`
  (the "what's it about to do" window) — that is exactly D-01's preparing-window
  description. Fold `BUG-260610-01`'s **timer-reseed** fix (seed elapsed from the run's
  `started_at`, not component mount) **ONLY IF** the planner confirms the reseed is in
  the same canonical Deep `RunStatusStrip` that 128 makes the sole timer (vs the
  095.1-fixed Deep run-card, vs the harness/workflow run strip which is Phase 127's
  surface). If it's a different strip → leave open. The banner-honesty + title-gen
  causes, the duplicate-avatar race, and `BUG-260609-02` are NOT folded (see `<deferred>`).

### G-5 audit (D-05)
- **D-05:** **PROCEED — no refactor-first phase.** The four re-touched hot files
  (`ToolCallPanel.tsx` / `MessageItem.tsx` / `RunCard.tsx` / `ChatArea.tsx`) take
  **surgical + net-subtractive** changes (CTC-03 deletes a whole timer component —
  one of three redundant elapsed surfaces); `ToolCallPanel`/`MessageItem` debt was
  already paid at 075.7; `threads.py` stays untouched. **Required micro-extraction
  (honors G-5's spirit):** put the `message.provider → logo` map AND the
  preparing-description logic in ONE shared helper (e.g. `providerLogo()` + a small
  tool-card-header helper) so `RunCard` and `ToolCallPanel` do not each grow
  duplicate copies.

### Cross-provider proof bar + TDP-02 fallback (D-06)
- **D-06:** The acceptance gate that "CTC-02 holds" is a **LIVE SC#10 run across the
  full native-7 + OpenRouter** (OpenAI / Anthropic / Google / DeepSeek / Moonshot /
  GLM / MiniMax + OpenRouter) — NOT the static screenshot matrix, NOT the big-4 only
  (mocks/static have false-greened cross-provider here before — 122 caught 2 live
  bugs). Confirm the card carries {status · elapsed · step/file counts · description}
  on each. **TDP-02 honest fallback:** show `tc.args.description` only WHEN present;
  when absent, a quiet generic `Preparing {tool}…` — never fabricate. The card always
  renders (logo + status) regardless; the description is additive. Provider-docs-first:
  during research, confirm per-provider whether the description field is actually
  populated in the preparing window (cross-check via the `run:{run_id}` Redis stream,
  same method the bug report used).

### Sequencing (D-07) + logo dependency (D-08)
- **D-07:** CTC-03 (the `StickyTimerBar` deletion) is the **LAST plan** in the phase,
  explicitly gated on the D-06 live cross-provider proof passing. Build + prove
  CTC-01/CTC-02/TDP-02 first, then delete.
- **D-08:** Ship logos via the **`@lobehub/icons` npm package** (maintained,
  tree-shakeable official marks; ~8 marks = negligible bundle; MIT). NOT vendored
  SVGs. **Fallback rule (locked):** OpenRouter → the OpenRouter mark (the honest
  resolved `message.provider`; do NOT unwrap to the routed model's brand); Ollama →
  the Ollama mark; LM Studio / OpenAI-compatible / unknown → keep today's brand-pulse
  `Bot` dot (honest — no fake brand for a generic endpoint; zero regression). The
  `brandPulse` ring stays while streaming in every case. The `048/logos/` SVGs drop to
  reference only. (Planner: verify `@lobehub/icons` covers the exact provider set + is
  tree-shakeable under our Vite build — low risk.)

### Claude's Discretion
- Clamp threshold for CTC-04 (line-count vs char-count vs overflow-detect) — D-03
  records the cheapest honest impl (overflow-detect) as the default; planner may pick
  the cleanest equivalent.
- The exact shape/name of the D-05 shared header helper.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope + requirements
- `.planning/ROADMAP.md` — Phase 128 section (Goal, Depends-on, 6 Success Criteria,
  reframe note). The `#### Phase 128 (STRETCH)` block.
- `.planning/REQUIREMENTS.md` §44–48 — TDP-02 / CTC-01 / CTC-02 / CTC-03 / CTC-04 verbatim.

### G-2 sketch acceptance bar (LOCKED — read before planning)
- `.planning/sketches/MANIFEST.md` — **Running Design Decisions 38, 39, 40** (the
  locked card / reclaim / read-more direction); the Phase-128 wrap-up note (~line 259);
  the sketch index rows 048/049/050 (~263–265).
- `.planning/sketches/048-cross-provider-tool-card/` — winner **A** (the unified card;
  provider logo + preparing-description + uniform layout). Real `@lobehub/icons` marks at
  `.planning/sketches/048-cross-provider-tool-card/logos/`.
- `.planning/sketches/049-chat-area-reclaim/` — winner **A** (clean StickyTimerBar removal).
- `.planning/sketches/050-long-prompt-readmore/` — winner **A** (fade + inline Read more).
- `.planning/sketches/128-grounding/GROUNDING.md` — the real "before" code grounding.
- `.claude/skills/sketch-findings-agentic-rag/SKILL.md` — validated chat-surface design
  patterns (run-card frame, status-node rail, never-vanishes status strip, output-files).

### Reported bugs (cross-checked this discussion)
- `.planning/reported-bugs/setting-up-agent-hides-model-activity.md` — TDP-02 slice
  folded (D-04); banner + title-gen causes deferred.
- `.planning/reported-bugs/BUG-260610-01-workflow-run-nav-timer-reset-duplicate-avatar.md`
  — timer-reseed conditionally folded (D-04); dup-avatar deferred.
- `.planning/reported-bugs/BUG-260609-02.md` — left open (tangential).

### Hot files (the implementation surface — anchors verified 2026-06-27, no drift)
- `frontend/src/components/chat/RunCard.tsx` — `:280/:287` brand-pulse `Bot` avatar
  (CTC-01 target); `:246` the `{provider} · {model} · turn N` runSub (already threaded).
- `frontend/src/components/chat/ToolCallPanel.tsx` — the tool card (TDP-02 description
  surface; shares the D-05 header helper with RunCard).
- `frontend/src/components/chat/ChatArea.tsx` — `:517-523` mount + `:533-585`
  `StickyTimerBar` (CTC-03 DELETE target).
- `frontend/src/components/chat/MessageItem.tsx` — `:205-217` user bubble (CTC-04 clamp
  target); `:137` avatar predicate (mirrored by RunCard).
- `frontend/src/components/chat/MessageList.tsx` — the floating "↓ Jump to live" chip
  (`showJumpToLive`) that stays as a status home after CTC-03.
- `frontend/src/lib/toolMeta.ts` — `:73` `outerBannerLabel` (the deferred banner-honesty
  fix — NOT this phase; do not touch unless the operator later folds it).
- `frontend/package.json` — `@lobehub/icons` is NOT yet a dependency (D-08 adds it).

### Cross-provider mandate + roster
- `CLAUDE.md` → "UAT scoreboard recipe (MANDATORY)" — SC#10 4-axis (cross-provider ×
  multi-tool × parallel-thread × long-message); rows authored in VALIDATION.md.
- `CLAUDE.md` → "Workflow guardrails" hot-file ledger — the G-5 rows.
- `backend/app/services/` MODEL_CAPABILITIES registry + `provider_gateway/` — the
  native-7 + OpenRouter set + the local providers (Ollama / LM Studio / OpenAI-compat)
  that define the D-08 fallback cases.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `message.provider` / `message.model` — REAL resolved values threaded via the Phase
  095.1 D-04 enrich (`RunCard.tsx:246`). The CTC-01 logo map keys off `message.provider`
  with no new backend wire.
- `tc.args.description` — already present in the tool-call args; TDP-02 surfaces it,
  no new emission.
- `RunStatusStrip` (header) + the `MessageList` `showJumpToLive` floating chip — the two
  status homes that survive the CTC-03 deletion; both already exist.
- `@lobehub/icons` real marks already extracted to `.planning/sketches/048-.../logos/`
  (reference for D-08).

### Established Patterns
- **Run-honesty / never-fabricate** — the app's standing rule (Phase 094/095). TDP-02's
  "show description only when present, quiet `Preparing {tool}…` otherwise" (D-06) follows it.
- **Provider differences at the boundary, never a shared-path fork** (red line D-14). The
  logo map + fallback (D-08) is a pure presentation map over the already-resolved provider;
  no provider branch in the streaming path.
- **G-5 discipline** — 124 held PhaseTimeline/PhaseCard byte-identical; 128 continues it
  (threads.py untouched; CTC-03 is subtractive; D-05 de-duplicates rather than grows).

### Integration Points
- CTC-01/TDP-02 land in `RunCard.tsx` + `ToolCallPanel.tsx` via the D-05 shared header helper.
- CTC-03 removes the `StickyTimerBar` block + mount from `ChatArea.tsx` (last, gated plan D-07).
- CTC-04 is contained to the user branch of `MessageItem.tsx`.

</code_context>

<specifics>
## Specific Ideas

- "I want it like the sketch" — sketches 048-A / 049-A / 050-A are the literal visual
  acceptance bar (operator-approved 2026-06-27). The provider logos must be the REAL
  official `@lobehub/icons` marks (the operator already rejected approximations and had
  them replaced with the real marks during the sketch).
- The fade on the long-prompt clamp is matched to the **violet end of the bubble's 135°
  gradient**, NOT the page background — it must look like the bubble dissolving, not a
  panel cut.
- Operator accepted all four discussion recommendations verbatim (TDP-02 + conditional
  reseed · proceed + shared helper · live native-7 + OpenRouter proof bar · @lobehub/icons).

</specifics>

<deferred>
## Deferred Ideas

- **`setting-up-agent-hides-model-activity` — banner-honesty (cause b) + title-gen-async
  (cause c).** A dedicated "run legibility & latency" phase: `toolMeta.ts:73` banner honors
  reasoning/arg-streaming activity ("Reasoning… Ns"), title-gen fires fire-and-forget
  (`threads.py:1039` — and `threads.py` is the G-5 extraction-due file), and sandbox
  cold-start pre-warm. The report stays **open**; TDP-02 (this phase) closes only the
  description-window sub-cause. *Re-open trigger: next chat-surface/run-honesty polish slot.*
- **`BUG-260610-01` duplicate empty-assistant-avatar** — a StreamsProvider/MessageList
  optimistic-placeholder + first-SSE double-mount race (S3/S4 seams). Separate family from
  128's pure-subtraction scope. Stays open. *Re-open trigger: same run-honesty slot, alongside
  BUG-260609-02 / BUG-260609-04 / the 1-2s empty-bubble — the "close the workflow-run-display
  cluster together" routing.*
- **`BUG-260609-02` SUB-RESULTS sub-task desc loss on nav** — reconcile-on-nav, not the
  sketched card layout. Stays open.
- **Sketch 049-B (promoted floating-chip trigger)** — the documented fallback only if users
  report lost always-visible status after CTC-03 ships.

### Reviewed Todos (not folded)
None — the single pending todo had no phase-128 match (`todo.match-phase` returned 0 matches).

</deferred>

---

*Phase: 128-chat-tool-card-unification-chat-area-reclaim*
*Context gathered: 2026-06-27*

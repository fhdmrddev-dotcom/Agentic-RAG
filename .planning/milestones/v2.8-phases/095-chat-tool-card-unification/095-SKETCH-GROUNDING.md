# Phase 095 — Chat Tool-Card Unification: Sketch Grounding Brief

**For:** the designer authoring the 3 HTML mockups. Read this instead of the codebase.
**Scope reminder:** Deep-mode chat tool-cards stay IN the chat (094 D-01). 095 = fix-and-unify them in place — calm one-frame cards, follow-the-work scroll, zero duplicates, honest timer/step count, hero output file. NOT moving cards to the panel.
**Evidence basis:** real SSE wire format (`api.ts` dispatch + `agent_loop.py` `_emit` call sites) and the current render reality (`RunCard` / `ToolCallPanel` / `MessageItem` / `OutputFileCard` / `MessageList` / `StreamsProvider`). Anything not directly evidenced is tagged **(verify)**.

---

## 1. Real SSE event vocabulary

The sketches render the *result* of these events. The ones that drive visible chat state during a Deep run:

| Event | When fired | Key payload fields | Drives |
|---|---|---|---|
| `delta` | Per text token during LLM streaming | `content` | Assistant message body (real-time text) |
| `reasoning_delta` | Per reasoning token (DeepSeek/Kimi/MiniMax/GLM reasoning mode) | `content` | Reasoning/thinking panel accumulation |
| `iteration_start` | Top of each agent loop pass (`agent_loop.py:1287`) | `iteration` (0-indexed) | **RunCard step counter** (`iteration+1` for display, D-03/today) |
| `planning` | Between tool rounds (iteration > 0) | `iteration` | Planning signal (unused in current UI) |
| `tool_preparing` | Tool name known, args still streaming | `name`, `index` | ToolCard "Preparing…" state (pre-dispatch) |
| `tool_args_progress` | Every 5KB+ of tool args streamed (code-gen) | `tool_index`, `name`, `total_args_bytes_so_far`, `code_so_far` | ToolCard "Generating (12.7 KB)" + live code preview |
| `tool_start` | After args finish streaming (dispatch ready) | `name`, `args` (Record[str,str]) | ToolCard shows tool name + execution start; **panel counts these as steps** |
| `tool_end` | Tool execution completes | `name`, `result` (string), `id` (optional) | ToolCard collapses, stores result |
| `code_execution_start` | `execute_code` begins sandbox run | `code_preview` (first 200 chars) | ExecuteCodeCard "execution starting" |
| `code_executing` | Heartbeat ~1s during sandbox | `tool_index`, `elapsed_seconds` | Updates `tool_calls[tool_index].elapsedSeconds` (live elapsed in the cell) |
| `code_stdout` / `code_stderr` | Per line of sandbox output (CRLF→LF normalized) | `content` | ExecuteCodeCard terminal panels |
| `code_execution_complete` | Sandbox run ends (before final files) | `exit_code`, `duration_ms`, `output_files`, `error` | ExecuteCodeCard collapse, exit code + per-cell files |
| `sub_agent_start` | `analyze_document` sub-agent begins (legacy) OR `task()` spawns (TASK variant) | Legacy: `filename`, `task` · TASK: `sub_run_id`, `description`, `tools[]`, `max_steps` | SubAgentCard / TaskCard "starting" (discriminator: `sub_run_id != null` → TASK) |
| `sub_agent_delta` | Per token during sub-agent stream | `content` | SubAgentCard text accumulation |
| `sub_agent_done` | Sub-agent completes (legacy) OR `task()` done (TASK) | Legacy: none · TASK: `sub_run_id`, `status`, `summary` | SubAgentCard / TaskCard collapse/finalize |
| `skill_activated` → `skill_loaded` | `load_skill` called → description non-empty | `skill_name` (+ `description`) | Skill activation indicator + description hint |
| `final_output_files` | ONCE after the agent loop terminates (cumulative) | `files: [{filename, url?}]` | **Pinned "Final Outputs" panel below messages** |
| `citations` | `search_documents` / `analyze_document` completes | `citations:[{document_id, filename, chunk_index, passage, similarity, is_full_doc, version_number}]` | Citations panel / hover references |
| `confidence` | `search_documents` completes | `level` (high/medium/low), `avg_similarity` (0–1), `disclaimer` | Confidence badge + disclaimer (thresholds 0.54 / 0.38) |
| `suggestions` | After LLM response completes | `questions: string[]` | Follow-up suggestion buttons below message |
| `todo_updated` | `write_todos` called (full-state-replace) | `todos: Todo[]` (full list each call) | **Panel** todos store (not chat) |
| `workspace_file_written` / `_deleted` | `workspace_write` / `_delete` completes | `path`, `version`, `size_bytes`, `mime_type` (+ `id`) / `path` | **Panel** workspace files store |
| `ask_user_prompt` / `_response` | `ask_user` called / user answers | `tool_call_id`, `prompt`, `options[]`, `timeout_seconds`, `draft` / `tool_call_id` | **Panel** ask_user card (pauses run) |
| `task_start` / `task_done` | `task()` sub-agent begins/ends (TASK variant) | `sub_run_id`, `description`, `tools[]`, `max_steps` / `sub_run_id`, `status`, `summary` | **Panel** task card (1-level nesting max) |
| `phase_started` / `_completed` / `_transition` / `gate_failed` / `run_failed` / `run_completed` | Harness only (094) | phase / index / from→to / attempt / reason / status | **Panel** phase timeline (Harness, not Deep) |
| `cap_paused` | Iteration cap hit WITH buffered tool calls (non-terminal) | `tool_names`, `continues_used`, `continues_remaining`, `kind`, `message` | Continue card, pause for user resume |
| `system_warning` | Context-window truncation mid-iteration | `kind` (context_truncated), `message` | Durable yellow/orange warning banner (role=system message) |
| `title` | Once at run start | `content` | Thread title |
| `done` | LLM streaming completes (before terminal sentinel) | none | onDone (idempotent; allows post-LLM SSE like `suggestions`) |
| `stream_end` | TERMINAL: all events complete | none | Close stream, flip runStatus = completed |
| `error` / `cancelled` / `timed_out` | TERMINAL variants | `error` reason string (error/timed_out) | Error banner / cancelled state / "time limit" banner + Resume |

**Sketch-relevant takeaways:**
- The chat surface is driven by the `delta` / `iteration_*` / `tool_*` / `code_*` / `sub_agent_*` / `final_output_files` / terminal families. The `todo_*` / `workspace_*` / `ask_user_*` / `task_*` / `phase_*` families drive the **panel**, not the chat — out of scope for these sketches.
- A run can end via FOUR terminal events (`stream_end`, `error`, `cancelled`, `timed_out`) — the resting/finished card and the frozen timer must look right for all four. **(verify which terminal copy each shows)**

---

## 2. Tool set + resting-essence exemplars

24 tools max (Phase 085). These are the literal strings the sketches render at rest (one calm line) and what the expanded body holds. Icons are Lucide hints.

| Tool | Icon (Lucide) | Resting essence (REAL semantics) | Expanded body shape |
|---|---|---|---|
| `search_documents` | magnifying-glass | `Found 8 chunks in 'Q3 Report.pdf' (avg similarity 0.62)` | Query input + matching chunks (doc name, similarity, passage preview); confidence badge below message |
| `query_documents` | table | `SQL returned 5 rows — 3 PDFs, 2 Word docs in Finance/` | SQL result set as table (headers + rows); metadata filters applied |
| `ls` | folder-open | `Contents of /Reports: 4 documents, 2 subfolders` | Folder entry listing immediate children (files + folders) with icons |
| `tree` | git-branch | `Knowledge base hierarchy: 12 documents across 5 levels` | Indented tree view, folders + docs, optional depth limit |
| `grep` | search-x | `Pattern 'budget' found in 3 documents (5 matches)` | Regex results: doc names + line snippets, optional path scope |
| `glob` | asterisk | `Pattern '*.pdf' matched 12 files across /Reports /Research` | Glob matches, file list by folder |
| `read_document` | file-text | `Loaded lines 45–120 from 'PRD.docx' (76 lines total)` | Markdown content / line range, line numbers in margin |
| `analyze_document` | sparkles | `Analyzed 'Q3 Financial Report.pdf' (full doc, 87 pages) → summarized` | Sub-agent spawned (`sub_agent_*` events); nested summarize/compare/critique |
| `execute_code` | terminal-square | `Executed 12 lines Python → generated report.pptx + chart.png (exit 0, 4.2s)` | Code preview (first 200 chars) · stdout/stderr panels · exit code + elapsed · output files w/ download links |
| `web_search` | globe | `Searched 'latest AI models 2026' → 5 results from news/tech sites` | Tabbed web results: title, URL, snippet, date; cite in response |
| `load_skill` | zap | `Loaded skill 'financial-report' (3 instructions, 2 template files)` | Skill card: name, description, attachment files list |
| `save_skill` | save | `Created/updated skill 'my-template' with instructions` | Returns `{status: created\|updated, name}` |
| `read_skill_file` | file-code | `Read 'template.docx' from skill 'financial-report' → extracted 8 paragraphs` | Text content of skill attachment; binary shows metadata only |
| `remember` | brain | `Stored key='response_format' value='bullet points'` | Persists fact across conversations; returns `{status: ok}` |
| `recall` | bookmark | `Retrieved 5 user memories: industry=finance, response_format=bullet points, name=Alice, …` | Lists all (no args) / one (key=X); key-value pairs |
| `query_tables` | table-2 | `Queried 'Q3 Report': 1 revenue table (8 cols × 12 rows), filtered Region=APAC` | Table headers + rows (≤50/table), column filter, optional page scope |
| `workspace_write` | file-plus | `Wrote /plan.md (2.3 KB) v1 to workspace` | Stores versioned file; returns metadata (**panel-driven**) |
| `workspace_read` | file-open | `Read /reports/summary.md (v2, lines 1–50 of 148)` | Workspace file content + version metadata |
| `workspace_list` | folder-tree | `Listed 12 workspace files under /reports/ prefix` | File index (path, size, mime, modified) |
| `workspace_delete` | trash-2 | `Deleted /draft.md (v1–v4 all versions removed)` | Removes file + history; `{status: ok}` |
| `workspace_diff` | git-diff | `Diff /plan.md v1→v3: +18 lines, -5 lines, 3 hunks` | Unified diff (+ / −), truncated at 500 lines |
| `write_todos` | checklist | `Recorded 4 todos: analyze (in_progress) → create (pending) → review → finalize` | Full-state-replace todo list (**panel-driven**) |
| `task` | arrow-up-right | `Spawned sub-agent task: 'Find all mentions of budget across 5 documents' (max 5 steps) → returned summary` | Sub-agent card (`sub_agent_*` / `task_*`); restricted toolset, bounded summary, no nesting |
| `ask_user` | message-circle | `Asked user: 'Which 3 files should I overwrite?' with 3 button options (60s timeout)` | Pauses run; prompt + optional buttons (**panel-driven**) |
| `system_warning` | alert-triangle | `Context window truncated: 3 earlier messages dropped (context exceeded)` | Yellow/orange durable warning banner |

**Mode filtering (so sketches use the right set):**
- **Deep mode (95's surface):** all 22 mandatory + conditional `web_search` (if enabled) + `execute_code` (if sandbox enabled) = up to 24.
- **Explorer mode:** only `ls`, `tree`, `grep`, `glob`, `read_document`, `analyze_document` (6).
- The operator's recognizable essence shorthand (CONTEXT §specifics): `🔍 Searched "X" → 8 results`, `📄 Read thesis.pdf → 3 sections`, `🐍 Ran code → chart.png`. Match this calm one-line register; the table above is the literal data each line carries.

---

## 3. Current render reality (the "before")

What the sketches are replacing. Real component behavior:

**Finished-card default state (the D-01 complaint):**
- A **terminal run with tools mounts COLLAPSED** (`RunCard.tsx:73`: `expanded = isStreamingNow || !hasTools || userExpanded`). Collapsed row reads: `Run · N tools · ✓ done · 1.2s ▸` (`RunCard.tsx:222–248`). Click expands.
- **Within an expanded run**, finished tool cards in focus-mode (3+ completed before the active one) render as a one-line summary `→ {summary}` row (`ToolCallPanel.tsx:209`, focus logic ~410 / 466–483). Streaming/preparing cards show a chevron-toggle.
- **Streaming runs are always expanded** (cannot fold a live run — D-08/today).
- A pure-text reply has **no RunCard at all** — RunCard only mounts when `tool_calls.length > 0` (`MessageItem.tsx:305`).

**Dedup keying (`ToolCallPanel.tsx:328`):** three-tier fallback —
`const key = tc.clientKey ?? tc.id ?? `${tc.name}-${tc.startedAt ?? ''}-${idx}``. `clientKey` (stable, stamped by StreamsProvider at first observation) is preferred; `tc.id` (provider-mutable) is the fallback; composite is for legacy DB-loaded messages. Deduped into a `Set<string>` preserving first-occurrence order (lines 322–334). **Sub-agent entries have NO clientKey stamp** — they rely on single-slot `message.sub_agent` semantics, and a `tool_call.sub_agent` field can also exist (`ToolCallPanel.tsx:530–532`, priority `tc.sub_agent ?? subAgent`) → dual-render risk.

**Timer derivation (`RunCard.tsx:83–96`, mirrored in `ToolCallPanel` ElapsedTimer 83–94):** `performance.now()` baseline captured ONCE at effect init (`startedAtRef.current = performance.now()`, line 89); a 250ms `setInterval` ticks `elapsed = now − baseline`; frozen on streaming end (`clearInterval`, line 95). Displayed `{(elapsedMs/1000).toFixed(1)}s` (line 197). It is a start-to-now **delta**, NOT wall-clock or cumulative. Rendered conditionally: `{(isStreamingNow || elapsedMs > 0) && …}` (lines 192–199) — this condition is exactly the BUG-260528-01 vanish trap (below).

**Step-count source(s) + the D-04 mismatch (ROOT):** two independent counters, no shared source of truth.
- **RunCard** shows `Step {iterationCount + 1}` (`RunCard.tsx:132–135`), incremented once per `iteration_start` SSE (`agent_loop.py:1287`, the loop entry). That counts **semantic agent iterations** (thinking rounds, 1–15 range).
- **ToolCallPanel** shows `Used N tools` = `deduplicatedToolCalls.length` (`~line 336/350–360`), counting finalized `tool_start` entries (executable units).
- Within ONE iteration a model can emit **0–24 tool_calls**. So "Step 3" (iteration) and "Used 4 tools" (count) describe different things and routinely disagree. The fix (D-04): one visible action = one step; both strips read the same action/tool-card count.

**Output-file render (the "before"):** **flat list, no hero, no sorting.** `MessageItem.tsx:506–527` renders a `space-y-1.5` div mapping `OutputFileCard` (522–524) keyed by index; iteration order == backend array order. Each card: Download icon + filename + optional size badge + optional `Replaces: {supersedes}` subline (`OutputFileCard.tsx:130–143`). Per-cell `execute_code` outputs (ExecuteCodeBody) reuse the SAME `OutputFileCard` — uniform styling, no intermediate-vs-final distinction today.

**Download URL resolution (`OutputFileCard.tsx:14–22`, `resolveOutputUrl`):** if `url.startsWith('/')` → `API_BASE + url` (`API_BASE` = `VITE_API_BASE_URL`, empty string if undefined); otherwise pass the URL through unchanged. Relative `/sandbox-outputs/...` are backend harvest paths; absolute/signed URLs are legacy Supabase CDN (**1-hour decay**). onClick intercept (88–107): Bearer-token `fetch` via `downloadSandboxOutput`, then a programmatic `<a download>`. Static `href` kept for right-click "Save link as" (will 401 — accepted trade-off). **url-optional back-compat (72–86):** a file missing `url` renders as plain filename with NO download affordance. **Dead-link risk:** sandbox cleanup invalidates relative paths; signed URLs decay after 1h.

---

## 4. Three bug clusters → what each sketch must visibly prove

The CONTEXT folds five bug reports into three lived-experience clusters. Per cluster: the root mechanism + the on-screen proof the sketch must show.

### Cluster A — Calm, single, followed cards (BUG-260529-02 + BUG-260521-01)
**Root mechanism:** Three stacked chat-surface defects. (1) `MessageList` has no auto-scroll-during-stream — the view doesn't follow the agent (`MessageList.tsx:45–99` tracks `isNearBottomRef < 120px` but auto-scroll only on new messages). (2) Tool cards / bodies render verbose & expanded by default with no collapse-on-complete — read/summarize sub-agents dump full bodies inline, burying the conversation. (3) Read/summarize sub-agent cards **duplicate persistently** during streaming: regular tools got a stable `clientKey` stamp (StreamsProvider `onToolPreparing` 336–344 / `onToolStart` 443–448) and dedup by it, but the **sub-agent path (`onSubAgentStart/Done` 491–514) has NO equivalent stamp**, OR the duplicate is a composite render of both the sub-agent bookend events AND the inner `tool_call` for the same logical task. (BUG-260521-01 is the same family — the transient two-probe reattach replayed `tool_start` events; mostly fixed by 075.2 + the clientKey stamp, but resurfaces on the sub-agent path.)

**Sketch must visibly prove:**
- The chat **auto-scrolls to the live edge** during a streaming multi-tool run and stays pinned unless the user scrolls up; a **"↓ Jump to live"** affordance appears once they've scrolled away (D-03).
- Tool cards render **COLLAPSED by default on terminal** (historic DB-loaded AND fresh-completed), one-line essence, expand-on-click. During a live run, **Focus Mode**: only the running step is open/live, finished steps fold to their essence (D-01/D-02).
- A single read/summarize sub-agent card renders **with NO duplicate** — one card per logical task, matching the dedup invariant regular tools already hold (D-05).

### Cluster B — Timer never vanishes, freezes honestly (BUG-260528-01)
**Root mechanism:** The timer is gated by `{(isStreamingNow || elapsedMs > 0) && …}` (`RunCard.tsx:192–199`). On long non-Anthropic runs (Kimi/Moonshot), a premature/false-positive terminal — transient stream-end or `buffer_expired` — flips `runStatus` to `completed` mid-cycle (`StreamsProvider` `_isTransientStreamEnd` 166–208; `sendMessage` onTerminal ~1457) before tools actually finish. `isStreamingNow` goes false; if `elapsedMs` was never positive (stale interval timing), the whole condition is false and **the timer disappears entirely** mid-run.

**Sketch must visibly prove:**
- The timer stays **continuously visible** through a long run (11+ steps, Moonshot/Kimi) — never blinks out mid-stream.
- Elapsed **freezes at the correct final duration** only when the run TRULY terminates (real `stream_end` / terminal + SSE close), not mid-stream.
- The status line co-renders **activity text + timer + a step/file count** in one persistent sticky strip that survives the whole run, even on non-Anthropic providers with transient SSE closures (D-06 exemplar: `⏱ 3m12s · Step 5 · Running code…`).

### Cluster C — One honest count + always-working hero file (BUG-260528-02 + BUG-260514-01)
**Root mechanism (count):** the D-04 mismatch above — RunCard counts `iteration_start`, the panel counts `tool_start`; no shared source. **Root mechanism (files):** `final_output_files` is a single cumulative SSE at run terminal, stamped FULL-REPLACE onto `message.finalOutputFiles` (`StreamsProvider:620–623`). But the flat list shows intermediate scratch artifacts alongside deliverables, and dead links surface when: a transient reattach replays tool-result SSE with stale URLs, intermediate per-cell `outputFiles` render before `final_output_files` arrives, a snapshot reconcile swaps streaming-state (has per-cell files) for canonical DB state (no `finalOutputFiles` yet), or the final event carries a file missing its `url` (renders without a download affordance).

**Sketch must visibly prove:**
- RunCard's step label and the panel's count are **semantically consistent** — e.g. "Step 3" and "Used 4 tools in Step 3" read as an honest, clear pair, never a bare contradiction (D-04).
- The output area **heroes the agent-flagged final deliverable** ("Your file" — the `.docx`/`.pptx` the user asked for) above a quieter, collapsible "Working files (N)" group (D-07). Intermediates are present but secondary, not hidden.
- **Every** download link works in one click — the hero AND the working files — and still works on reopening the chat the next day (no 404 / dead links, surviving transient reattach) (D-07/D-08).

---

## 5. Invariants the sketch direction must honor

- **Per-thread demux / PANEL-06 isolation.** Streaming state lives in per-thread Maps (`streamingThreads`, `subscriptionsByThread`, `workflowLocksByThread`, `reconcileErrors`; panel Maps `todosByThread` / `filesByThread` / `tasksByThread` / `phasesByThread`) with immutable copy-then-mutate discipline. Thread A streaming must NOT bleed into Thread B; panel SSE re-renders panel hooks only, never the chat-message bucket. Sketches showing two threads must keep each thread's timer/cards/files fully independent. **The chat tool-card surface never touches panel stores.**
- **Stable identity from the first event.** Each card gets ONE identity at its first streamed frame and never mutates it — no transient double-render, no "self-heals in 10–15s" reliance. Regular tools: `makeToolKey({messageId, name, observedAt, index})` stamped once (`toolKey.ts:36–45`). D-05 extends the SAME discipline to the sub-agent/read-summarize path. Sketches must show one card per logical action from frame 1.
- **Reuse the locked sketch-findings frame.** Build on the already-validated `sketch-findings-agentic-rag` classes — the **001-C run-frame**, the **002-C tool-card**, and the **003-B Focus-Mode** ("past steps fold to essence; one outer frame + per-tool inner body") direction. Do not invent a new frame; 095 unifies onto this one. **(verify exact class names against the skill before final HTML.)**
- **Reuse-only CSS / no new keyframes.** Allowed classes: `ghost-border`, `gradient-primary`, `bg-card/50`, `bg-primary/5`, `text-muted-foreground`, `text-foreground/80`. Allowed animations ONLY (UI-SPEC §5.2 R-7, no new keyframes): `animate-fadeSlideUp`, `animate-brandPulse`, `animate-toolSlideIn`, `animate-dotBounce`, `animate-pulseGlow`, `animate-pulse`, `tool-progress-bar`. Components: Radix `ScrollArea`, `Collapsible/Trigger/Content`. Lucide icons available: `ChevronDown`, `ChevronRight`, `Loader2`, `Bot`, `Sparkles`, `Download`, `Zap`, `Clock`, `Terminal` (+ the per-tool icons in §2).
- **Cross-provider uniform UX.** One shared SSE vocabulary → one provider-agnostic render. The unified frame must look and behave **identically across all 6 native providers** (Anthropic, OpenAI, Google, Kimi/Moonshot, GLM, MiniMax). No per-provider card layouts; provider differences stay at the service boundary. The long-run sketch is Kimi/Moonshot specifically because that's where the timer-vanish + slow-stream defects bite hardest.
- **RunCard mounts only with tools.** Pure-text replies must render with NO run-frame and NO border — don't wrap plain answers in a card. The sketch's "before/after" must preserve this.

---

## 6. Sketch-ready exemplars

Concrete fixtures for the 3 mockups. Use these literal strings.

### Sketch 1 — Long ~11-step Kimi PPTX run (proves Clusters B + C-count + A-collapse, UAT #1)
A Moonshot/Kimi "build me a deck" job. Status strip stays pinned the whole time: `⏱ 3m12s · Step 7 · Running code…`. Steps (each fold to a one-line essence as it finishes; the live one is open):

1. `🔍 search_documents` → `Found 14 chunks in 'thesis.pdf' (avg similarity 0.61)`
2. `🔍 search_documents` → `Found 9 chunks in 'results.pdf' (avg similarity 0.58)`
3. `📄 read_document` → `Loaded lines 1–120 from 'thesis.pdf' (412 lines total)`
4. `📄 read_document` → `Loaded lines 1–88 from 'results.pdf' (203 lines total)`
5. `✨ analyze_document` → `Analyzed 'results.pdf' (full doc, 31 pages) → summarized` *(sub-agent — renders ONE card, not duplicated)*
6. `✅ write_todos` → `Recorded 4 todos: outline (in_progress) → draft → chart → assemble` *(panel-driven; in chat it's the essence line only)*
7. `🐍 execute_code` → `Generating (8.3 KB)…` → live: stdout streaming, elapsed ticking *(the CURRENTLY-open Focus-Mode step)*
8. `🐍 execute_code` → `Executed 22 lines Python → generated chart_revenue.png (exit 0, 2.1s)`
9. `🐍 execute_code` → `Executed 18 lines Python → generated chart_growth.png (exit 0, 1.8s)`
10. `🐍 execute_code` → `Executed 47 lines Python → generated dissertation_defense.pptx (exit 0, 6.4s)`
11. `✨ analyze_document` → `Reviewed draft deck → 2 fixes suggested`

On terminal: timer freezes at `3m48s`, the run collapses to `Run · 11 steps · ✓ done · 3m48s ▸`, step count == 11 cards on screen (D-04 honest).

### Sketch 2 — Multi-tool run: `search_documents` + `execute_code` (proves Cluster A frame/focus/scroll, UAT #2)
A single prompt triggering both tools. Shows the shared frame across two different tool types, Focus Mode, and follow-the-work auto-scroll:

1. `🔍 search_documents` → `Found 8 chunks in 'Q3 Report.pdf' (avg similarity 0.62)` — confidence badge `medium`, folded to essence once step 2 starts.
2. `🐍 execute_code` (live, open) → code preview top, `code_stdout` lines streaming below, `⏱ 4.2s` ticking, output file appearing: `chart.png`. Chat is auto-scrolled to this live edge; a `↓ Jump to live` pill is shown in the variant where the user has scrolled up.

Both cards share the identical outer frame (002-C) + per-tool inner body; finished step is one calm line, active step is expanded and followed.

### Sketch 3 — Output files: ONE hero `.docx`/`.pptx` + N working files (proves Cluster C-files, UAT #3)
The `final_output_files` panel, re-ranked (D-07). Agent-flagged final deliverable is the hero; intermediates are quiet but present and all downloadable:

- **Your file** (hero block, emphasized): `📊 dissertation_defense.pptx` — 4.1 MB — one-click Download.
- **Working files (3)** (collapsed-by-default, quieter group):
  - `🖼 chart_revenue.png` — 88 KB
  - `🖼 chart_growth.png` — 71 KB
  - `📄 outline.md` — 2.3 KB

Every file is reliably downloadable (Bearer-fetch intercept, no dead link); reopening the chat the next day still downloads. Contrast the "before" in the same sketch: today this is a flat index-ordered list with no hero and dead-link risk on stale/missing-`url` entries.

**Hero-flag note for the designer (D-08):** which file is the hero comes from a small backend tag on the final-outputs payload (the agent knows the user's intent). The sketch should show the hero/working split visually; the exact tag field name is a planning/backend detail — render it as "agent-flagged final output," not a specific JSON key. **(verify the final payload field at planning — not yet defined.)**

---

*Phase: 095-chat-tool-card-unification · Sketch grounding · 2026-06-05*
*Decision IDs (D-01..D-08) per 095-CONTEXT.md. Bug clusters per 095 bug-mechanics evidence. Wire format per api.ts dispatch + agent_loop.py `_emit` sites.*

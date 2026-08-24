# Sketch 200 — reference-vs-code audit: `run-surface` · `run-panel-parts` · `draft-arrival` · `connections`

**Read-only audit, 2026-08-20.** Derived from the four SHEETS only — `200-CHECKLIST.md` and
`index.html`'s `JOURNEY` array were deliberately not consulted. Every row carries a `file:line`,
a grep result, or the literal `grep → 0`.

**Buckets:** `SHIPS` renders today · `FE-WIRING` the capability exists but is not mounted/supplied
here · `BE-NEEDED` the data is not on the wire · `NEW` neither data nor surface exists.

⚠ `run-surface.html` has **no "shipped today" capture** (its `now` is `null`), so it is audited
against the CODE only and no before/after is claimed.

⚠ Where an element is **deliberately not built**, the row says so and still counts as `NEW` or
`FE-WIRING` — a refusal is never scored as `SHIPS`.

---

## `run-surface.html`

The shipped run surface is `frontend/src/pages/WorkflowRunPage.tsx` (1329 L): header →
`WorkflowCanvas` (a graph) → `RunReceipt` → deliverables. The sheet draws a **transcript centre +
vertical step spine on the right**, which is a different composition, not mostly a different
capability.

| Sheet element | Bucket | Evidence |
|---|---|---|
| Left nav rail, 56 px, fixed | **SHIPS** | `frontend/src/components/layout/NavPanel.tsx`; mounted `ChatLayout.tsx:442`. |
| Brand/logo mark at rail top | **SHIPS** | `NavPanel.tsx:18` — *"logo → New Chat (+) → nav icons → footer icons"*. |
| Expand (`menu`) control | **SHIPS** | `ChatLayout.tsx:184` `navExpanded`, `:191` `toggleNavExpanded`, threaded `:442-443`. |
| New Chat (`add_circle`) | **SHIPS** | `NavPanel.tsx:45-46` — *"the rail's New Chat (+) — reachable from EVERY view"*; `ChatLayout.tsx:509`. |
| Chat tab | **SHIPS** | `frontend/src/lib/nav-items.ts:31`. |
| Workflows tab, ACTIVE with left accent | **SHIPS** | `nav-items.ts:36`; active treatment follows `ChatLayout.tsx:608-616` (`aria-current="page"`). |
| Documents tab | **SHIPS** | `nav-items.ts:37`. |
| Classification tab | **SHIPS** | `nav-items.ts:41`. |
| Library Health tab | **SHIPS** | `nav-items.ts:42`. |
| Governance tab | **SHIPS** | `nav-items.ts:50`. |
| Skills tab | **SHIPS** | `nav-items.ts:54`. |
| Settings tab | **SHIPS** | `nav-items.ts:58`. |
| Account (`account_circle`, rail footer) | **SHIPS** | `frontend/src/components/layout/ProfileMenu.tsx`. |
| Header: workflow name headline | **SHIPS** | `WorkflowRunPage.tsx:1071` — `{run?.workflow_name \|\| COPY_NAME_UNAVAILABLE}`. |
| Header: version chip `v1.2` | **SHIPS** (differs) | `WorkflowRunPage.tsx:1074-1076` renders `v{run.workflow_version}`. ⚠ `workflow_version` is an **integer** (`backend/app/api/workflow_runs.py` `WorkflowRunRead.workflow_version: int`), so it reads `v1`, never `v1.2`. A dotted version would be `BE-NEEDED`. |
| Header: live pulse dot beside the clock | **SHIPS** (differs) | The liveness mark ships as a **static text glyph** inside the band sentence — `WorkflowRunPage.tsx:364` `"● Running"`, rendered `:1088`. `grep -c "animate-pulse\|animate-ping" frontend/src/pages/WorkflowRunPage.tsx` → **0**; no animated element on this page. |
| Header: elapsed clock `00:42` | **SHIPS** | `WorkflowRunPage.tsx:1089-1092` (`data-testid="run-elapsed"`), formatted by `fmtElapsed` `:973`, anchored and LABELLED at `:968` (`Ran for …`). |
| Header: "Stop this run" button | **SHIPS** (copy differs) | `WorkflowRunPage.tsx:1109` — `<StopControl threadId={…} variant="page" />`. Shipped label is `"Stop"` (`components/chat/StopControl.tsx:235`). |
| Centre **transcript region** (a chronological narrative of what happened) | **FE-WIRING** | The run page has no transcript — it hands off instead: `COPY_OPEN_THREAD = "Open the chat thread"` (`WorkflowRunPage.tsx:125`, rendered `:1113-1119`). `getMessages(threadId)` ships (`frontend/src/lib/api.ts:260`) and the page already holds `run.thread_id` (used at `:1116`). **Nothing supplies messages to this page today.** |
| Per-line `mm:ss` offset gutter (`00:00` … `00:42`) | **BE-NEEDED** | Durable per-EVENT time is missing. `ToolCall.startedAt` / `endedAt` are client-side `Date.now()` and are explicitly *"Undefined for tool calls loaded from DB (historical messages)"* — `frontend/src/types/index.ts:47-48`, `:70`. Only `messages.created_at` is durable (`backend/app/models/message.py:33`). Needs a persisted per-tool-call timestamp on the stored `tool_calls` payload. |
| Transcript line — completed/emphasised (`Extracted vendor list`) | **FE-WIRING** | Assistant + tool text already render in chat (`components/chat/MessageItem.tsx`, `components/chat/ToolCallPanel.tsx`); nothing renders them on the run surface (see the transcript row above). |
| Transcript line — in-flight/dim (`Pulling commercial agreements…`) | **FE-WIRING** | Live in-flight phrasing ships as sub-steps: `SUBSTEP_META` (`components/panel/PhaseCard.tsx:137-170`, e.g. `"Rendering the deliverable"`). Not mounted here. |
| Transcript line — external-system read (`Connecting to Northwind CRM instance…`) | **NEW** | No read-capable connector exists. `backend/app/services/connectors/registry.py:49-51` declares exactly three, all WRITES: `send_email`, `create_ticket`, `post_message`. `grep -rni "mcp" backend/app --include=*.py` → **0**. **Needs an MCP client (or a first-party read adapter) plus a read-scoped credential.** |
| Transcript line — violet attention flag + `priority_high` (`Flagged inconsistency… Awaiting review.`) | **FE-WIRING** | The awaiting-review state ships as `ask_user`: `PendingAsk` (`types/index.ts:925-937`), `PausedRunCue` mounted at `components/chat/MessageItem.tsx:534`. Nothing renders an attention line on the run page. |
| Transcript line — active with spinner (`Drafting executive summary…`) | **FE-WIRING** | The live active-node shape ships (`PhaseCard.tsx:137-149`, `node: "active"`). Not mounted here. |
| **Right-hand panel** on the run surface | **FE-WIRING** | `WorkspacePanel` has exactly ONE mount — `ChatLayout.tsx:673`, inside the `activeView === "chat"` branch (`:641`). The run view renders in the `else` branch (`:686+`) with **no panel**. `grep -c "WorkspacePanel" frontend/src/pages/WorkflowRunPage.tsx` → **0**. |
| Panel header "Workflow Progress" | **SHIPS** (differs, chat only) | `WorkspacePanel.tsx:541` — `<PanelSection title="Workflow" count={phases.length} />`, plus a `Phase i / N` counter (`PhaseTimeline.tsx:7-8`). |
| Vertical connector line behind the step nodes | **SHIPS** (chat only) | `components/panel/PhaseTimeline.tsx:18` — `<section aria-label="Workflow run timeline">` + `<ol aria-label="Phases">` of `PhaseCard` rows (`:36`). The RUN page renders `WorkflowCanvas` instead (`WorkflowRunPage.tsx:1180-1188`) — a graph, not a vertical spine. |
| Step node — completed, green check | **SHIPS** | Panel: `components/panel/phaseStatusMeta.ts:83` — `done: { glyph: "✓", text: "Complete" }`. Run page: the canvas ring (`components/workflows/NodeRunOverlay.tsx:248-252`) + `RUN_READING_WORD.done = "Complete"` (`runVocabulary.ts:82`). |
| Step title (`Pull usage and support history`) | **SHIPS** | `components/workflows/RunReceipt.tsx:158-163` (`receipt-row-title`, via `titleOf`); canvas node title via `nodeTitle` (`WorkflowRunPage.tsx:76`). |
| Step sub-status line (`Found 12 contracts`) | **SHIPS** | The declared per-step count is on the wire (`api/workflow_runs.py:133-152` `step_count`/`step_noun`; `backend/app/models/thread.py:124-125`) and renders twice: `RunReceipt.tsx:165-169` (`countDeclared`) and on the canvas edge (`components/workflows/FlowEdge.tsx:336` via `payloadLabel`, supplied `WorkflowRunPage.tsx:788-789`). ⚠ The noun is the executor's own (`sources` \| `agents` \| `fields`); a domain word like *contracts* must never be substituted (`api/workflow_runs.py:144-151`). |
| Step node — needs review, violet border + `priority_high` | **FE-WIRING** | The reading ships: `RUN_READING_WORD["waiting-for-you"] = "Paused for your answer"` (`runVocabulary.ts:84`), its own arc shape (`NodeRunOverlay.tsx:149-153`), derived at `WorkflowRunPage.tsx:766-769`. The **raised-card treatment inside a spine** is the panel's, not mounted here. |
| Violet left indicator bar marking the active step | **FE-WIRING** | Equivalent ships as `PhaseCard`'s violet border + `--accent-violet` tokens (`phaseStatusMeta.ts:86-90`); chat only. |
| Needs-review sub-line (`Needs your review before it continues.`) | **SHIPS** (copy differs) | `runVocabulary.ts:145` — `CLAUSE_WAITING = "— it needs your reply before it can continue"`, composed by `runReadingLabel` (`:262-264`) onto the canvas node. |
| **"Approve" button inline in the spine** | **FE-WIRING** | Expressible **today with no new code** as an ask OPTION: `PendingAsk.options` (`types/index.ts:928`) renders as a radiogroup of chips (`components/panel/PendingAskCard.tsx:501-525`), and the shipped test fixture is literally `options: ["Approve this step", "Do not run it"]` (`components/panel/__tests__/PendingAskCard.test.tsx:490`). Submit path: `answerAskUser` (`lib/api.ts:1234`) → `POST /runs/{runId}/ask_user_response` (`lib/api.ts:1240`). ⚠ `grep -rn "Approve" frontend/src/pages/WorkflowRunPage.tsx frontend/src/components/panel` → **1 hit, a test fixture** — no approve control renders on any run surface. |
| **"Send back" button** | **NEW** | `grep -rn "Send back" frontend/src` → **0**. An ask option is still an *answer*; there is no reject/return-to-step verb on the wire, no route beside `POST /runs/{id}/ask_user_response`, and no harness re-drive semantic distinct from `pause_run` (`backend/app/db/workflows.py:1723`). |
| Step node — in progress, pulse ring + solid dot | **SHIPS** (differs) | The canvas draws a per-reading **arc**, not a pulse: `NodeRunOverlay.tsx:149-153`, `:252` (`ringDash`); `:29-31` records it as *"the ONE module that animates"*. Panel equivalent: `phaseStatusMeta.ts:82` — `running: { glyph: "●", text: "Running" }`. |
| Per-step elapsed on the running step (`00:15`) | **SHIPS** | `components/workflows/receiptVocabulary.ts:192-194` — `timeRunning(d) → "${d} so far"`, resolved by `phaseRunFacts` (`components/workflows/phaseDuration.ts:267`) off `started_at` (migration `supabase/migrations/121_workflow_phases_timings.sql`), rendered `RunReceipt.tsx:162-164`. Also on the chat panel via `runFactsBySlug` (`PhaseTimeline.tsx:48`). |
| Step node — waiting / not reached, hollow ring, dimmed title | **SHIPS** | `RUN_READING_WORD["not-started"] = "Not started"` (`runVocabulary.ts:80`); `NodeRunOverlay.tsx:249-252` — a `null` from `ringDash` means *"paint NO arc"*, which is exactly this reading. Panel equivalent: `phaseStatusMeta.ts:81` — `pending: { glyph: "○", text: "Locked" }`. |
| Total runtime for the run | **SHIPS** | `RunReceipt.tsx:115-118` — `runSpan(phases)` = `min(started_at) → max(completed_at)` (`phaseDuration.ts:367`), worded by `headerSpan` (`receiptVocabulary.ts:81`). Mounted `WorkflowRunPage.tsx:1226`. |
| ⚠ Shipped on this surface but **not drawn by the sheet** (listed so the sheet is not read as complete) | — | The deliverables region (`WorkflowRunPage.tsx:1233-1310`: `FileRow` at `density="run"`, `downloadWorkspaceFile`) and the `sr-only` announcement band + `role="alert"` (`:1150-1170`). |

**`run-surface.html` → SHIPS 28 · FE-WIRING 9 · BE-NEEDED 1 · NEW 2**  (40 sheet elements + 1 note row, excluded)

The centre transcript and the right-hand spine both exist as components elsewhere and are simply
not mounted on this page. The only hard gaps are per-event timestamps, a read-capable connector,
and a "Send back" verb.

---

## `run-panel-parts.html`

Every part of this sheet lives in `frontend/src/components/panel/`, and every one reaches a user
**only** through `WorkspacePanel` → `ChatLayout.tsx:673` → the `activeView === "chat"` branch.
So *on the run surface* the whole sheet is `FE-WIRING`; the table classifies each part against the
component itself.

| Sheet element | Bucket | Evidence |
|---|---|---|
| Section heading "WHEN IT NEEDS YOU" | **SHIPS** (differs) | The ask stack is pinned above the sections (`PendingAskCard.tsx:576-578`); the shipped label is the card's own `"Needs you"` (`PendingAskCard.tsx:476`), not a section rule. |
| Ask card frame with violet 2 px left border | **SHIPS** (differs) | `PendingAskCard.tsx:465-468` — a full **amber** border + amber tint (`--warning`), not a violet left rule. |
| Ask card title (the question) | **SHIPS** | `PendingAskCard.tsx:496-498` — `{prompt}`, `id={labelId}`. |
| Ask card sub-line ("Check the agent's logic before proceeding.") | **NEW** | The only shipped sub-line is honest-wait copy, and only when there is no deadline: `NO_DEADLINE_WAITING_LINE` (`PendingAskCard.tsx:484-487`). A generic guidance line has no home. |
| Three choice chips (Low / Medium / High), horizontal | **SHIPS** (differs) | `PendingAskCard.tsx:501-525` — `role="radiogroup"` of `role="radio"` buttons over `options[]` (`types/index.ts:928`). ⚠ Shipped layout is `flex flex-col` (vertical, `:504`); the sheet draws a horizontal row. |
| "Reason" field label (visible) | **FE-WIRING** | The textarea ships with an **`sr-only`** label `"Type an answer"` (`PendingAskCard.tsx:536-538`). `grep -rn '"Reason"\|>Reason<' frontend/src/components/panel` → **0**. Making the label visible is a one-line change; no new data. |
| Free-text textarea + placeholder | **SHIPS** (differs) | `PendingAskCard.tsx:543` — `placeholder="Type an answer…"` vs the sheet's `"Type here..."`. |
| "Send back" button on the ask card | **NEW** | `grep -rn "Send back" frontend/src` → **0**. No reject verb on `POST /runs/{id}/ask_user_response` (`lib/api.ts:1234-1240`). Needs a new route + a harness re-drive distinct from `pause_run` (`backend/app/db/workflows.py:1723`). |
| "Approve" primary button | **FE-WIRING** | The control ships as `"Send Answer"` with a `"Preparing…"` pre-run arm (`PendingAskCard.tsx:558`); the word "Approve" is authorable as an ask OPTION (fixture at `components/panel/__tests__/PendingAskCard.test.tsx:490`). No approve-labelled control renders. |
| Resolved card at 60 % opacity | **SHIPS** (differs) | The answered arm is a **green** card, not a dimmed one: `PendingAskCard.tsx:448-459`. |
| Resolved card green check glyph | **SHIPS** (differs) | `PendingAskCard.tsx:450` — a green dot span; the word beside it is `"Answered · agent resumed"` (`:451`). |
| Resolved card "You approved this" | **SHIPS** (differs) | `PendingAskCard.tsx:456-458` — `You answered <b>{answeredValue}</b>`. It names the ANSWER, which is strictly more honest than a generic approval claim. |
| Resolved card timestamp `14:20` | **BE-NEEDED** | `PendingAsk` carries no answered-at field: `types/index.ts:925-937` (`tool_call_id`, `prompt`, `options`, `timeout_seconds`). The answered state is client-local (`PendingAskCard.tsx:230-232`), so nothing survives a reload. Needs `answered_at` on `GET /threads/{tid}/ask_user/pending` (`lib/api.ts:1140-1147`). |
| Section heading "WHEN IT IS WAITING FOR A PERSON" | **SHIPS** | The state ships as `components/panel/PausedRunCue.tsx`, mounted `components/chat/MessageItem.tsx:534`. |
| Waiting strip with violet left border | **SHIPS** (differs) | `PausedRunCue.tsx` (Phase 087 Plan 05 Task 2, sketch 006) — amber/`--warning` chrome, matching the ask card. |
| `front_hand` glyph | **NEW** (glyph) | `grep -rn "front_hand" frontend/src` → **0**. The icon convention forbids sourcing a second package (`components/settings/ConnectionsTab.tsx:28-34`), so this needs a convention-compatible substitute. |
| "Waiting for someone to approve" | **BE-NEEDED** | `grep -rn "Waiting for someone" frontend/src` → **0**. It is also a **different claim** from anything shipped: the shipped word is `"Paused for your answer"` (`runVocabulary.ts:84`). Saying *someone* truthfully needs an assignee on `PendingAsk` (`types/index.ts:925-937`), which does not exist. |
| Section heading "THE FILES IT MADE" | **SHIPS** (differs) | `WorkspacePanel.tsx:463` — `<PanelSection title="Files" count={files.length}>`. |
| File list frame | **SHIPS** | `components/panel/FilesSection.tsx:265` — `role="listbox" aria-label="Workspace files"`. |
| Per-row file glyph | **SHIPS** | `components/files/FileRow.tsx` resolves it once from `mimeType`/extension via `frontend/src/lib/fileIcon.tsx`. |
| Per-row file name | **SHIPS** | `FileRow.tsx:150-152` (`name`); the run page passes `baseName` (`WorkflowRunPage.tsx:1265`). |
| Per-row size (`1.2 MB`) | **SHIPS** | `components/files/fileRowUtils.ts:50` `formatBytes`; `FileRow.tsx:184` `sizeBytes`. |
| Per-row `•` separator | **SHIPS** (trivial markup) | The trailing group is a flex cell — `FileRow.tsx:101` / `:123` / `:135` (`trailingClass`). |
| Per-row relative time (`2m ago`) | **FE-WIRING** | Data is on the wire — `WorkspaceFile.created_at?` (`types/index.ts:915`) — and a nine-band formatter ships: `relativeBand` (`components/workflows/library/relativeChanged.ts:103-136`, e.g. `"5 min ago"`). ⚠ **No file row renders a time today**: `fileRowUtils.ts` exports only `formatBytes` (`:50`), `baseName` (`:67`), `byNewestFirst` (`:125`). ⚠ `relativeChanged.ts:23-24` explicitly rejects compact forms (`3h ago`) for its surface, so reuse is a decision, not a given. |
| Per-row `time unknown` (dimmed absent arm) | **FE-WIRING** | `created_at` is OPTIONAL and its absence is already load-bearing: `byNewestFirst` sorts a MISSING `created_at` **FIRST** (`fileRowUtils.ts:129-131`, reasoning `:95-104`). The panel already ships the same honesty shape for a neighbouring field — *"THE WORD IS `expiry unknown`, NEVER `no expiry`"* (`FilesSection.tsx:104`). Nothing renders it for time. |
| Files empty state "Nothing made yet." | **SHIPS** (differs) | `FilesSection.tsx:257` — `"No files yet."`. The run page carries two tense-correct variants: `COPY_NO_FILES_LIVE` / `COPY_NO_FILES_TERMINAL` (`WorkflowRunPage.tsx:182-183`). |
| Section heading "LOOKING INSIDE A FILE" | **SHIPS** | `components/panel/FilePreview.tsx`, opened from `FilesSection.tsx:149`. |
| Table preview frame + header row (ID / Name / Score) | **SHIPS** | `components/panel/CsvTablePreview.tsx:142-160` — `<thead>` built from the CSV's first row. |
| Table body rows | **SHIPS** | `CsvTablePreview.tsx:161-175`. |
| "Showing the first 50 rows" truncation footer | **NEW** | `grep -rn "Showing the first" frontend/src` → **0**, and shipped behaviour is **all-or-nothing, not truncate-with-notice**: past `MAX_ROWS = 2000` or `MAX_BYTES = 256_000` the whole preview is replaced by `"File too large to preview"` (`CsvTablePreview.tsx:28-29`, `:126`, `:137-139`). A partial-render-plus-notice arm has to be built. |
| Structured (JSON) preview frame | **SHIPS** (differs) | JSON falls to the `code` arm — `FilePreview.tsx:301-306` (`<ShikiCode …>` via `classifyInline`). There is no dedicated structured renderer. |
| Copy control (`content_copy`, top-right) | **FE-WIRING** | The content is already in hand — `WorkspaceFileContentInline.content` (`types/index.ts:1097-1104`) — and the clipboard idiom ships elsewhere (`components/setup/SetupTokenGate.tsx`, `components/org/InviteMemberDialog.tsx`). ⚠ `grep -rn "clipboard" frontend/src/components/panel frontend/src/components/chat` → **0**: no preview and no code block has a copy control. |
| Violet-keyed JSON body (key/value two-tone) | **NEW** | No JSON pretty-printer exists; `ShikiCode` applies a syntax theme, not a key/value split. The panel's only structured renderer is `CsvTablePreview`. |
| "End of preview" footer | **NEW** | `grep -rn "End of preview" frontend/src` → **0**. Inline content is returned **whole** (`WorkspaceFileContentInline`, `types/index.ts:1097-1104`), so there is no partial marker to render — a truncation contract would have to be added to `GET /content` (`getWorkspaceFileContent`, `lib/api.ts:1177`). |
| Section heading "WHAT CHANGED BETWEEN VERSIONS" | **SHIPS** (differs) | `WorkspacePanel.tsx:467` — `<PanelSection title="Versions" defaultOpen={false}>`; `components/panel/VersionDiff.tsx`. |
| Diff frame | **SHIPS** | `components/panel/DiffLines.tsx:40-46`; fed by `getWorkspaceFileDiff` (`lib/api.ts:1212`) and `getWorkspaceFileVersions` (`:1194`). |
| Line-number gutter (12 / 13 / 14 / 15) | **FE-WIRING** | ⚠ `DiffLine` has **no line-number field** — `frontend/src/lib/diffParse.ts:21-28` is `{ kind, text, sign? }`, and `DiffLines.tsx:80-90` renders a 16 px **sign** gutter, never a number. The numbers ARE on the wire, inside the unified diff's hunk headers (parsed as `kind: "hunk"`, `diffParse.ts:50`); the parser simply does not extract them. FE-only change, no backend. |
| Context line (dim) | **SHIPS** | `diffParse.ts:61-62`; rendered `DiffLines.tsx:77`. |
| Deletion line (red, tinted, sign prefix) | **SHIPS** (differs) | `DiffLines.tsx:69`, `:76` (`bg-[hsl(var(--destructive)/0.14)]`). ⚠ The sign is the Unicode minus `−` (`diffParse.ts:30`, `:59`), **not** the sheet's ASCII `-`; and there is no coloured left rule — the row tint carries it. |
| Addition line (green, tinted, `+` prefix) | **SHIPS** (differs) | `DiffLines.tsx:68`, `:75`; sign `"+"` (`diffParse.ts:56`). Same left-rule note. |
| Truncation notice on a long diff (**not** drawn by the sheet) | — *note* | `DiffLines.tsx:26-35` — `"diff truncated at 500 lines"`. Listed because it is the honest analogue of the two footers the sheet invents above. |
| Section heading "WHEN THERE IS NOTHING" | **SHIPS** | `components/panel/PanelEmpty.tsx`. |
| Dashed empty frame | **NEW** (styling) | `PanelEmpty.tsx:37` is a centred flex box with **no border at all**; the only occurrence of `dashed` in that file is line 16, inside a COMMENT describing the sheet. ⚠ `199-07` deliberately SUBTRACTED this state's only mark (the `Inbox` glyph — `PanelEmpty.tsx:14-22`), so adding a frame is a reversal to weigh, not a gap to close. |
| "Nothing here yet" heading | **SHIPS** (copy differs) | `PanelEmpty.tsx:39-41` — `"No workspace activity yet"`. ⚠ `PanelEmpty.tsx:26-27` records the heading is *"asserted in four places"*, so a rename is a fenced change. |
| Empty body ("Files, to-dos and anything needing your input will show up here.") | **SHIPS** (copy differs) | `PanelEmpty.tsx:42-45` — *"When the agent writes files, tracks todos, or needs your input, it'll show up here."* Same three subjects, different order. ⚠ `:32-33` — the blast radius is **CHAT**, because `PanelEmpty`'s only route is `WorkspacePanel` → `ChatLayout`. |
| ⚠ **The whole sheet, mounted on the RUN surface** | — *section verdict — see below* | Every part above reaches a user only via `WorkspacePanel`, whose sole mount is `ChatLayout.tsx:673` inside `activeView === "chat"` (`:641`). `grep -c "WorkspacePanel" frontend/src/pages/WorkflowRunPage.tsx` → **0**. |

**`run-panel-parts.html` → SHIPS 29 · FE-WIRING 6 · BE-NEEDED 2 · NEW 7**  (44 sheet elements + 2 note rows, excluded — one of them the section verdict below)

⚠ **Section verdict: on the RUN surface every row above is `FE-WIRING`,** because each reaches a
user only through `WorkspacePanel`, whose sole mount is `ChatLayout.tsx:673` inside
`activeView === "chat"` (`:641`). `grep -c "WorkspacePanel" frontend/src/pages/WorkflowRunPage.tsx`
→ **0**. The buckets above score each part against its own component.

---

## `draft-arrival.html`

The most-built of the four: `DraftArrivalCard` was authored **against sketch 200 itself** and is
mounted at `frontend/src/pages/WorkflowBuilderPage.tsx:2221`.

| Sheet element | Bucket | Evidence |
|---|---|---|
| Left nav rail, 64 px, tabs + settings | **SHIPS** | `lib/nav-items.ts:31-58`; `NavPanel.tsx` mounted `ChatLayout.tsx:442`. |
| Brand mark ("DM") | **SHIPS** (placeholder wordmark) | `NavPanel.tsx:18` (logo at rail top). |
| Workflows tab active, left accent bar | **SHIPS** | `nav-items.ts:36`; active treatment `ChatLayout.tsx:608-616`. |
| Centred column, `max-w-780px` | **SHIPS** (differs) | `DraftArrivalCard.tsx:322` — `max-w-[720px]`. ⚠ `:8-13` records the 780 px measurement the width was chosen against, and warns that a FOURTH sibling child strands the builder graph at 0 px. |
| Arrival card frame | **SHIPS** | `DraftArrivalCard.tsx:318-325` (`data-testid="draft-arrival-card"`). |
| **Pulsing border animation** | **NEW** — and **explicitly REFUSED** | `DraftArrivalCard.tsx:311-316`: *"THE SHEET'S PULSING BORDER IS NOT PORTED, DELIBERATELY. It animates a border colour forever, with no terminating condition and no state change behind it — an indefinite animation that means nothing is the 'pacing dressed as progress' `SeedReceipt`'s own docblock refuses, and this card reports a COMPLETED generation."* Counted `NEW` because nothing renders it. |
| Left 4 px accent rule | **SHIPS** | `DraftArrivalCard.tsx:326` — `<span className="absolute bottom-0 left-0 top-0 w-[4px] bg-primary" />`. |
| "Just drafted" badge | **SHIPS** | `components/workflows/decisionsVocabulary.ts:257` `ARRIVAL_BADGE = "Just drafted"`, rendered `DraftArrivalCard.tsx:330-336`. |
| Card title = the workflow's name | **SHIPS** | `DraftArrivalCard.tsx:348-355`; an empty name renders **nothing** rather than a placeholder (`:344-347`). |
| Step-count heading under the title (**not** drawn by the sheet) | — *note* | `DraftArrivalCard.tsx:357-363` via `seedReceiptHeading(phases.length)` (`components/workflows/definitionOps.ts`). Listed so the sheet is not read as the complete card. |
| Source line lead "From:" | **SHIPS** | `decisionsVocabulary.ts:265` `ARRIVAL_SOURCE_LEAD = "From:"`, rendered `DraftArrivalCard.tsx:386`. |
| Source echo text, clamped | **SHIPS** | `DraftArrivalCard.tsx:387-393` — `line-clamp-2` at rest, `whitespace-pre-wrap`, plain React text child (XSS note `:378-379`). An absent requirement removes the whole line (`:381-384`). |
| "See what I asked for" control | **SHIPS** | `decisionsVocabulary.ts:274` `ARRIVAL_SOURCE_ACTION`, rendered `DraftArrivalCard.tsx:395-407` with `aria-expanded`/`aria-controls`. |
| Footer action strip (tinted, top-ruled) | **SHIPS** | `DraftArrivalCard.tsx:443` — `border-t border-border bg-background/50 px-6 py-4 pl-8`. |
| Footer secondary buttons — the sheet draws **two, both reading "How long it looks back"** (a sheet duplication) | **SHIPS** (two, correctly distinct) | `DraftArrivalCard.tsx:446-476` (grounding fold, `GROUNDING_FOLD_ACTION = "why"`) and `:478-500` (decisions fold, `DECISIONS_FOLD_ACTION = "review"`) — `decisionsVocabulary.ts:164`, `:167`. Each renders only when its summary is non-empty (`:501-505` of the vocabulary's zero-returns-empty-string rule). |
| **"Publish…" primary button (right slot)** | **NEW** — and **explicitly REFUSED** | `DraftArrivalCard.tsx:424-441` gives three grounds: no wire (*"This component has no such handler and its caller passes none"*); its word is **banned** from this vocabulary by D-20's fence; and the gauntlet is another module's surface. The publish flow itself ships at `components/workflows/PublishGauntlet.tsx` with `PublishOutcome` (`lib/api.ts:3678-3682`). Counted `NEW` **on this card**. |
| "What I decided for you" heading | **FE-WIRING** | The list ships (`components/workflows/DecisionsList.tsx`); the heading does not — `grep -rn "What I decided" frontend/src` → **1 hit, inside a comment** (`DraftArrivalCard.tsx:478`). The list is reached via a fold summary instead (`decisionsFoldSummary`, `decisionsVocabulary.ts:157`). |
| Decisions list frame, 5 rows | **SHIPS** | `DecisionsList.tsx:258-266` with `data-row-count={DECISION_ROW_ORDER.length}`; the five keys at `decisionsVocabulary.ts:83-89`. |
| Row 1 label ("What it reads") | **SHIPS** (differs) | `decisionsVocabulary.ts:105-106` — `"The documents it can read"`. The five are asserted pairwise distinct (`:100-102`). |
| Row 2 label ("How it recognises the thing it's about") | **SHIPS** (differs) | `decisionsVocabulary.ts:107-108` — `"The document it fills in"`. |
| Row 3 label ("How long it looks back") | **SHIPS** (differs) | `decisionsVocabulary.ts:109-110` — `"The requirement it works to"`. ⚠ `DecisionsList.tsx:119-120` records that *"the sheet also invents its own five row subjects … neither of which is this application's."* |
| Row 4 label ("What it must cite") | **SHIPS** (differs) | `decisionsVocabulary.ts:111-112` — `"What this workflow is called"`. |
| Row 5 label ("How it decides") | **SHIPS** (differs) | `decisionsVocabulary.ts:113-114` — `"What it hands back"`. |
| **Per-row status word `Settled`** | **NEW** — and **explicitly REFUSED** | `DecisionsList.tsx:116-121`: *"the sheet draws a per-row status badge — an affirmative word on a satisfied row … that shape is exactly what the three-arm contract above exists to forbid, because an affirmative badge on a PRESENT readiness makes the present arm distinguishable from the ABSENT one."* `grep -rn "Settled" frontend/src` returns **17 hits, all `Promise.allSettled` or a local `settled` state variable** — zero user-facing uses. |
| **Per-row status word `Needs you`** (on a decision row) | **NEW** — same refusal | Same citation. ⚠ `"Needs you"` DOES ship, but on the run-time ask card (`PendingAskCard.tsx:476`) — a different surface making a different claim. |
| **Per-row status word `Not recorded`** | **NEW** — same refusal | ⚠ Correction to a naive grep: the word DOES ship, as `RUN_UNKNOWN = "Not recorded"` on the **workflows library card** (`components/workflows/library/libraryVocabulary.ts:507`, consumed `library/runFacts.ts:70`). It is about a past RUN's outcome, not a decision row, and nothing renders it in `DecisionsList`. |
| Row status icons (`check_circle` / `error` / `radio_button_unchecked`) | **NEW** — follows the refusal | No per-row glyph renders: `DecisionsList.tsx:265-345` emits label + answer + action + (one) verdict only. |
| Amber row wash on a needs-you row | **NEW** — follows the refusal | The only per-row wash shipped is a neutral hover (`ROW_HOVER_CLASS`, cited `DecisionsList.tsx:121-123` as *"the one thing the sheet asked for that this surface could express and did not"*). |
| Inline pre-filled text input on a row | **SHIPS** (on the name row, not the sheet's row 2) | `DecisionsList.tsx:328-339` — the name row's input IS the action (`DECISION_NAME_FIELD_LABEL`, `decisionsVocabulary.ts:212`), with `placeholder = DECISION_NAME_NONE`. |
| Inline action button beside a row's answer | **SHIPS** (differs) | Rows 1 and 3 carry `"Change"` (`decisionsVocabulary.ts:203`; rendered `:274-282`, `:305-313`); rows 2 and 5 carry `"Open the step"` (`:207`; rendered `:290-297`). ⚠ D-17: the name row has **no sibling control** by design (`DecisionsList.tsx:327`). |
| Row body "You cannot publish until this is settled." | **FE-WIRING** | The publish-gate verdict IS on the wire, but for **one row only**: `GenerateReadiness.business_requirement` `{status:"missing"; message}` (`lib/api.ts:3655-3659`), rendered verbatim at `DecisionsList.tsx:316-323` (`decision-verdict-requirement`) and gated at `:251-254`. ⚠ `decisionsVocabulary.ts` records that **only row 3 may claim a publish requirement** — the other four would claim a gate nothing enforces. Extending it is `BE-NEEDED`. |
| Receipt block frame | **SHIPS** | `DraftArrivalCard.tsx:513-516` (`data-testid="draft-arrival-applied"`), inside the grounding fold. |
| "What I applied" ruled heading | **SHIPS** | `decisionsVocabulary.ts:285` `APPLIED_HEADING`, rendered `DraftArrivalCard.tsx:517-519`. |
| Two-column label/value grid | **SHIPS** | `DraftArrivalCard.tsx:520-532` — `<dl className="grid grid-cols-1 … sm:grid-cols-2">`. |
| "Model" pair | **SHIPS** (conditional) | `decisionsVocabulary.ts:288` `APPLIED_MODEL_LABEL`; value from `declaredModel(phases)` (`DraftArrivalCard.tsx:216-230`) — rendered **only when the set of declared models has size one**, because a workflow declares a model per step. |
| "Reads from" pair | **SHIPS** (conditional) | `decisionsVocabulary.ts:291` `APPLIED_READS_LABEL`; `DraftArrivalCard.tsx:279-281` — absent ⇒ no pair, never a default. |
| "Fills in" pair (a third pair the sheet does not draw) | — *note* | `decisionsVocabulary.ts:294` `APPLIED_FILLS_LABEL`; `DraftArrivalCard.tsx:282-284`. |
| Closing note "This block is absent when nothing was applied." | **NEW** — and **explicitly REFUSED** | `DraftArrivalCard.tsx:505-510`: *"IT IS AN INSTRUCTION TO THE IMPLEMENTER RATHER THAN COPY FOR AN AUTHOR. Printing it would be printing the mechanism … It is HONOURED instead: with no pair to show, this block does not render at all."* |
| Staggered fade-in animations (`animation-delay: 50/100/150ms`) | **SHIPS** (differs) | `DraftArrivalCard.tsx:323` — one `animate-in fade-in-0 slide-in-from-bottom-1 duration-100 motion-reduce:animate-none`; no per-block stagger. |
| Dismiss control (**not** drawn by the sheet) | — *note* | `DraftArrivalCard.tsx:338-341`, using the receipt's own locked `SEED_RECEIPT_DISMISS_LABEL` / `_GLYPH` (`definitionOps.ts`). |
| Edit-limit note inside the opened decisions fold (**not** drawn) | — *note* | `decisionsVocabulary.ts:225-226` `DECISION_EDIT_LIMIT_NOTE`. |

**`draft-arrival.html` → SHIPS 27 · FE-WIRING 2 · BE-NEEDED 0 · NEW 8**  (37 sheet elements + 4 note rows, excluded)

⚠ **All eight `NEW` rows are documented refusals**, not oversights (pulsing border, Publish
button, three status words + their glyphs + the amber wash, and the mechanism sentence). They are
counted `NEW` because nothing renders them — **not** as an invitation to reopen them.

---

## `connections.html`

⚠ **The special case.** `grep -rni "mcp" backend/app --include=*.py` → **0**. What ships is a
**three-capability, write-only, credential-per-row connector table** (`supabase/migrations/116_connector_connections.sql`),
surfaced in Settings — not an application catalogue. The sheet's model (one OAuth-ish *account*
exposing many *capabilities*, most of them **reads**) is a different data model, not a restyle.
Each row below names what it needs: an **MCP client**, an **approval model**, a
**credential/OAuth store**, or **just a surface**.

| Sheet element | Bucket | Evidence · what it needs |
|---|---|---|
| Page title "Connections" | **SHIPS** | `components/settings/connectionsCopy.ts:449` `CONNECTIONS_SECTION_TITLE`; rendered `ConnectionsTab.tsx:277` (`aria-label="Connections"`). |
| Page subtitle "Other applications this workspace can reach. Connect once, use anywhere." | **SHIPS** (differs materially) | `connectionsCopy.ts:451-452` — *"The real destinations your organisation's workflows may send to. A step sends nothing until a person approves it in the run."* ⚠ The shipped sentence is **send-only and says so**; the sheet's promises *reach* and *reuse*. |
| Roster list frame | **SHIPS** | `ConnectionsTab.tsx:22-27` — the shipped `divide-y divide-border/60` instrument table (re-using the `UsersAndAccess.tsx:166-179` container). Columns: `Connection · Sends to · Used by · Credential · State` (`connectionsCopy.ts:74-80`). |
| Per-row **vendor logo** (Slack / Drive / Jira / GitHub / Notion) | **NEW** — and **explicitly REFUSED** | `ConnectionsTab.tsx:28-34`: *"CAPABILITY MARKS, NEVER VENDOR LOGOS (§10 / U-12) … `@lobehub/icons` is the single source for PROVIDER marks and it is an LLM-provider set — Slack/Jira/SMTP are not in its domain, and sourcing them from a second package is exactly the per-surface vocabulary the icon convention forbids."* Shipped marks are capability marks (`:29-33`, fluent-emoji envelope/ticket/speech-balloon). **Needs: a vendor icon set + a reversal of the icon convention.** |
| Per-row **vendor NAME** as the row identity ("Slack", "Notion") | **BE-NEEDED** | Rows are identified by an author-given `name` (`backend/app/models/connector.py:299`) over a `capability` (`:298`); the vendor appears only as a host string in `Sends to` (`connectionsCopy.ts:165` `SLACK_FIXED_HOST = "slack.com/api"`, derivation `:184-192`). **Needs: a `provider` field on `connector_connections` + a catalogue.** |
| Per-row provenance "Connected by Sarah, 2 days ago" | **BE-NEEDED** | `created_by uuid NOT NULL` exists in the table (`116_connector_connections.sql:67`) but is **absent from the wire model** — `ConnectorConnectionResponse` is `id, org_id, capability, name, config, is_enabled, last_checked_at, last_check_verdict, created_at, updated_at` (`backend/app/models/connector.py:296-305`). **Needs: `created_by` on the response + a display-name join.** (`created_at` is already there, `:304`.) |
| State "Connected" + green check | **SHIPS** (differs) | `connectionsCopy.ts:86` `CONNECTION_STATE_READY = "✓ Ready"`, derived from `last_check_verdict === "ok"` (`:115`). |
| State "Not connected" | **SHIPS** (differs) | `connectionsCopy.ts:87` `CONNECTION_STATE_NOT_CHECKED = "◌ Not checked"`. A row exists only once created, so *not connected* is the tab's empty state (`:299` `CONNECTIONS_EMPTY_HEADING = "No connections yet"`). |
| State "Connection expired" / "Needs signing in again" | **NEW** | No expiry concept exists. `backend/app/models/connector.py:33` states outright: *"There is **no** OAuth authorization-code flow anywhere in this module"*, and `grep -rni "oauth\|refresh_token\|token_expires" backend/app --include=*.py` returns that one comment and nothing else. Nearest shipped state: `✕ Credential failed` (`connectionsCopy.ts:88`, from `last_check_verdict === "failed"`, `:114`). **Needs: an OAuth/credential store with expiry + refresh.** |
| "Sign in" button | **NEW** | Same foundation. Shipped equivalents are `CONNECTIONS_ACTION_CHECK = "Check credential"` (`connectionsCopy.ts:320`) and a write-only secret supplied at create (`backend/app/services/connector_service.py:482-493`). **Needs: an OAuth authorization-code flow (redirect + callback route + token store).** |
| "Connect" button | **FE-WIRING** | Creating ships end-to-end: `CONNECTIONS_ADD_CTA = "＋ Add a connection"` (`connectionsCopy.ts:319`) → `createConnectorConnection` (`ConnectionsTab.tsx:76`) → `connector_service.create_connection` (`:461`). ⚠ A per-**vendor** Connect needs the catalogue above; the create path itself exists. |
| Section 2 card: **one connection exposing many capabilities** | **BE-NEEDED** | Schema-level: `capability text NOT NULL CHECK (capability IN ('send_email','create_ticket','post_message'))` — one row **is** one capability (`116_connector_connections.sql:71-75`), and the closed set is asserted against Python at `services/connectors/registry.py:58-60`. **Needs: an account↔capability split (a parent connection row + child capability grants).** |
| Connection instance name ("Slack Enterprise (Marketing)") | **SHIPS** | `name text NOT NULL` (`116_connector_connections.sql:76`); `ConnectorConnectionResponse.name` (`models/connector.py:299`); the roster's first column (`connectionsCopy.ts:74-75`). |
| Capability row "Read messages in a channel" | **NEW** | No read capability exists — `registry.py:49-51` is exactly `send_email` / `create_ticket` / `post_message`. **Needs: an MCP client (or a read adapter) + a read-scoped credential.** |
| Capability row "Search past conversations" | **NEW** | Same. **Needs: an MCP client + a read-scoped credential.** |
| Capability row "Post a message" | **SHIPS** | `registry.py:51` → `app.services.connectors.slack_adapter`; the capability literal at `116_connector_connections.sql:74`. |
| Capability row "Create a channel" | **NEW** | Not in the closed set (`registry.py:49-51`; CHECK constraint `116…:71-75`). **Needs: a 4th capability + adapter, and — per SEED-146 — an approval model, because it is a WRITE.** |
| "READS ONLY" badge | **NEW** | Nothing on the wire distinguishes read from write, because everything shipped is a write: the adapter key set is asserted equal to `EXTERNAL_ACTION_CAPABILITIES` (`registry.py:38`, `:58-60`). **Needs: a read/write classification field, which needs read capabilities first.** |
| "CHANGES THINGS" badge (amber) | **FE-WIRING** | The distinction is already made in words one level up: `STEP_CARD_OUTSIDE_SENTENCE` + `accent="consequence"` on the step card (`components/workflows/PhaseFormPanel.tsx:1424-1431`) — *"a person is being told something happens OUTSIDE the run"*. Nothing renders a per-capability badge on the Connections surface. |
| Per-capability toggle switch | **BE-NEEDED** | `is_enabled boolean NOT NULL DEFAULT true` (`116…:79`) → `ConnectorConnectionResponse.is_enabled` (`models/connector.py:301`) → `CONNECTIONS_ACTION_ENABLE`/`DISABLE` (`connectionsCopy.ts:321-322`) → `updateConnectorConnection` (`ConnectionsTab.tsx:78`). ⚠ Shipped as a **menu action behind an arm-to-confirm sheet** (`disableSheetTitle`/`disableConfirmLabel`, `connectionsCopy.ts:365-371`), not a switch. Several toggles under one connection needs the account↔capability split above. |
| Footer "Reading is safe. Anything that changes something has to be armed…" | **NEW** | `grep -rn "Reading is safe" frontend/src` → **0**. It also cannot be said truthfully yet — there is no reading to be safe about (`registry.py:49-51`). |
| Section 3 AT-REST card ("Post a message", off, disabled toggle) | **FE-WIRING** | `is_enabled=false` ships (`models/connector.py:301`) and the picker enforces it — *"A DISABLED connection is not listed at all — it is not a choice (UI-SPEC §6d)"* (`components/workflows/ConnectionPicker.tsx:229-230`). No per-capability card renders it. |
| AT-REST caption "Off. A workflow cannot post anything." | **SHIPS** (differs) | The shipped word is `CONNECTION_STATE_DISABLED = "⏻ Disabled"` (`connectionsCopy.ts:89`); the run-time terminal is `recorded_not_sent` → *"Not sent — recorded"* (`runVocabulary.ts:86`; `backend/app/services/harness/phase_types.py:2085`). |
| ARMING card with amber left rule | **SHIPS** (differs) | Shipped as an **arm-to-confirm sheet**, the middle rung of the graded action guard: `disableSheetTitle(name)`, `disableSheetBody(count)`, `disableConfirmLabel(name)`, `DISABLE_CANCEL_LABEL = "Keep it enabled"` (`connectionsCopy.ts:365-371`); delete uses the heavier victim-naming rung (`:355-363`). |
| ARMING title "Let workflows post to Slack?" | **SHIPS** (differs, and inverted) | `connectionsCopy.ts:365` — `Disable ${name}?`; `:355` — `Delete ${name}?`. ⚠ Shipped sheets are phrased as a **turn-off**; the sheet phrases an **opt-in**, which is the opposite default (shipped rows default `is_enabled = true`, `116…:79`). |
| ARMING body "Anything you approve here can post messages that other people will see." | **FE-WIRING** | The consequence sentence exists **per-step**: `components/workflows/ExternalActionSection.tsx` + `OutsideChangeLine` (`PhaseFormPanel.tsx:1430`). Nothing says it on the Connections surface. |
| "Cancel" button | **SHIPS** (differs) | `connectionsCopy.ts:363` `DELETE_CANCEL_LABEL = "Keep it"`; `:371` `DISABLE_CANCEL_LABEL = "Keep it enabled"`. |
| "Turn it on" amber primary | **FE-WIRING** | `CONNECTIONS_ACTION_ENABLE = "Enable"` (`connectionsCopy.ts:322`) with `updateConnectorConnection` (`ConnectionsTab.tsx:78`). ⚠ Only the **disable** direction has a confirm sheet — `grep -n "enableSheetTitle" frontend/src/components/settings/connectionsCopy.ts` → **0**. The sheet arms the ON direction, which is the inverse of what ships. |
| ON caption "Turned on by you, recorded in the audit log." | **SHIPS** | `connectionsCopy.ts:376-381` — `receiptFor(verb) → "✎ ${verb} · recorded"`, incl. `RECEIPT_ENABLED`. Durable rows land in `harness_audit` (`services/harness/phase_types.py:1993` `event_type="external_action_sent"`; migration 117). ⚠ The ledger BROWSER is operator-only (`backend/app/api/admin.py:684` `/audit`, `:729` `/platform-audit`), so a tenant admin cannot read back what the caption promises. |
| Section 4 card "What it can reach" | **NEW** (as one card) | No single card gathers this: the facts are split across `folder_scope` (`PhaseFormPanel.tsx:598-626`), the tool rail, and `ExternalActionSection` (`:1432`). Composition only — every atom below exists. |
| "Folders it can read" label + folder chip ("Contracts") | **SHIPS** | `PhaseFormPanel.tsx:598-605` — *"Render the folder_scope as real folder NAME(s) (📁 Name), with the bound id reachable via the per-chip ⓘ/title — never a path."* |
| "Other applications" label + app chips (Slack, Google Drive) | **BE-NEEDED** | The bound connection ships as a **single-select**, not chips: `ConnectionPicker` (`components/workflows/ConnectionPicker.tsx:191`), label `CONNECTION_PICKER_LABEL = "Where this sends"` (`:69`), writing exactly one key `connection_id` (`:243-247`). **Needs: a multi-bind on `ExternalActionPhaseConfig`.** |
| "+ Add" dashed chip button | **NEW** on the applications row · **already REFUSED** for folders | For folders the refusal is on record by name: *"An `Add a source` BUTTON. `folder_scope` is a READ-ONLY display in this panel"*, and writing it on a workflow with no `project_folder_id` raises a raw 422 (`PhaseFormPanel.tsx:614-618`). For applications it needs the multi-bind above. |
| Footer "Only connections you have already armed appear here." | **FE-WIRING** | Enforced in code: `ConnectionPicker.tsx:229-230` filters `rows.filter((row) => row.is_enabled)`, and a failing credential is declined at Gate 1 (`:255-260`). The sentence itself: `grep -rn "already armed" frontend/src` → **0**. |
| Section 5 chat bubble fragment | **SHIPS** | `components/chat/MessageItem.tsx` (assistant text) — the frame exists. |
| Chat tool receipt block ("Posted to #vendor-renewals") | **NEW** | ⚠ **Connections are not reachable from chat at all.** `_TOOL_REGISTRY` (`backend/app/services/tool_dispatcher.py:4134-4170`) lists 27 tools and **none** is a connector capability; `backend/app/services/harness/grounding.py:830` states the names are *"Latent while D-22 keeps the names out of `_TOOL_REGISTRY`"*. The tool-card frame ships (`components/chat/ToolCallPanel.tsx`). **Needs: an approval model FIRST (SEED-146 — every capability is a WRITE), then a registry entry.** |
| Chat receipt timestamp ("14:20") | **BE-NEEDED** | Persisted tool calls carry no time — `ToolCall.startedAt`/`endedAt` are client `Date.now()`, *"Undefined for tool calls loaded from DB"* (`types/index.ts:47-48`, `:70`). Same gap as `run-surface`'s transcript gutter. |
| Caption "A connection belongs to the workspace, not to one workflow — the same one works in chat." | **NEW** — and currently **false** | Half is true: connections are **org-scoped** (`org_id uuid NOT NULL`, `116…:64`; `list_connections` is org-scoped, `connector_service.py:511-518`). The chat half is not — see the row above. |

**`connections.html` → SHIPS 14 · FE-WIRING 6 · BE-NEEDED 6 · NEW 12**  (38 sheet elements, no note rows)

---

## Combined totals — four sheets

| Sheet | SHIPS | FE-WIRING | BE-NEEDED | NEW | rows |
|---|---:|---:|---:|---:|---:|
| `run-surface.html` | 28 | 9 | 1 | 2 | 40 |
| `run-panel-parts.html` | 29 | 6 | 2 | 7 | 44 |
| `draft-arrival.html` | 27 | 2 | 0 | 8 | 37 |
| `connections.html` | 14 | 6 | 6 | 12 | 38 |
| **Total** | **98** | **23** | **9** | **29** | **159** |

---

## The gating list — BE-NEEDED and NEW only

### BE-NEEDED — 8 distinct gaps (from 9 table rows; the two timestamp rows share one gap)

1. **Per-event timestamps on persisted tool calls.** `ToolCall.startedAt`/`endedAt` are client
   `Date.now()` and undefined for DB-loaded calls (`frontend/src/types/index.ts:47-48`, `:70`).
   Gates the `run-surface` transcript gutter **and** the `connections` chat-receipt time.
   Field: a timestamp on the stored `tool_calls` payload (`backend/app/models/message.py`).
2. **`answered_at` on an ask.** `PendingAsk` carries none (`types/index.ts:925-937`); the answered
   state is client-local (`PendingAskCard.tsx:230-232`) and does not survive a reload.
   Endpoint: `GET /threads/{tid}/ask_user/pending` (`lib/api.ts:1140-1147`).
3. **An assignee on an ask.** Needed before any surface can honestly say *"waiting for **someone**"*
   rather than *"paused for **your** answer"* (`runVocabulary.ts:84`). Same model as (2).
4. **`created_by` on `ConnectorConnectionResponse`** (+ a display-name join). The column exists
   (`116_connector_connections.sql:67`); the wire model does not carry it
   (`backend/app/models/connector.py:296-305`). Gates *"Connected by Sarah"*.
5. **A `provider` / vendor identity on a connection.** Rows are `name` over `capability`
   (`models/connector.py:298-299`); nothing names the application. Gates vendor-named roster rows
   and the whole catalogue framing.
6. **An account↔capability split.** `capability text NOT NULL CHECK (…)` makes one row exactly one
   capability (`116_connector_connections.sql:71-75`, asserted `registry.py:58-60`). Gates the
   sheet's entire Section 2 and per-capability toggles.
7. **A multi-bind for a step's external reach.** `ConnectionPicker` writes exactly one
   `connection_id` (`ConnectionPicker.tsx:243-247`). Gates the "Other applications" chip group.
8. **A publish-gate verdict for decision rows other than the requirement.** `GenerateReadiness`
   covers `business_requirement` only (`lib/api.ts:3655-3659`). Gates *"You cannot publish until
   this is settled."* anywhere but row 3.

### NEW — neither the data nor the surface exists (29 table rows, grouped below)

**Run surface + run panel (9)**

- **A "Send back" / reject verb on an ask** — `grep -rn "Send back" frontend/src` → 0. Needs a route
  beside `POST /runs/{id}/ask_user_response` and a harness re-drive distinct from `pause_run`
  (`backend/app/db/workflows.py:1723`).
- **A read-capable connector** (the transcript's *"Connecting to … CRM"*) — needs an MCP client or a
  read adapter; `grep -rni "mcp" backend/app` → 0.
- **A `front_hand`-equivalent glyph** — `grep → 0`; needs an icon-convention-compatible mark.
- **"Waiting for someone to approve"** — copy, blocked on BE-NEEDED (3).
- **An ask-card guidance sub-line** — the only shipped sub-line is the no-deadline honesty line.
- **A truncate-with-notice CSV preview** ("Showing the first 50 rows") — shipped behaviour is
  all-or-nothing (`CsvTablePreview.tsx:28-29`, `:137-139`).
- **A key/value JSON preview renderer** — JSON falls to `ShikiCode` (`FilePreview.tsx:301-306`).
- **An "End of preview" partial-content marker** — `GET /content` returns inline content whole
  (`types/index.ts:1097-1104`); needs a truncation contract on the endpoint.
- **A dashed empty-state frame** — `PanelEmpty.tsx` renders no border; ⚠ this reverses `199-07`'s
  deliberate subtraction (`PanelEmpty.tsx:14-22`).

**Draft arrival (8 — every one a documented refusal, listed for visibility, not to reopen)**

- Pulsing card border (`DraftArrivalCard.tsx:311-316`).
- "Publish…" primary on the arrival card (`DraftArrivalCard.tsx:424-441`).
- Per-row status words `Settled` / `Needs you` / `Not recorded` (`DecisionsList.tsx:116-121`).
- Per-row status glyphs, and the amber needs-you row wash (same refusal).
- The "this block is absent when…" mechanism sentence (`DraftArrivalCard.tsx:505-510`).

**Connections (13)**

- **Vendor logos** — needs a vendor icon set **and** a reversal of the icon convention
  (`ConnectionsTab.tsx:28-34`).
- **Connection expiry**, **"Needs signing in again"**, **"Sign in"** — need an **OAuth
  authorization-code flow + token store with refresh**; `backend/app/models/connector.py:33` states
  none exists anywhere in the module.
- **"Read messages in a channel"** and **"Search past conversations"** — need an **MCP client** (or
  read adapters) plus **read-scoped credentials**.
- **"Create a channel"** — a 4th write capability: adapter + closed-set change + (SEED-146) an
  **approval model**.
- **"READS ONLY" badge** — needs a read/write classification, which needs read capabilities first.
- **"Reading is safe…" footer** — copy that cannot be said truthfully today.
- **A single "What it can reach" card** on the step panel — composition of shipped atoms.
- **"+ Add" application chip** — needs BE-NEEDED (7).
- **A connector capability in chat** ("Posted to #vendor-renewals") — needs an **approval model
  FIRST**, then a `_TOOL_REGISTRY` entry (`tool_dispatcher.py:4134-4170`; `grounding.py:830`).
  ⚠ Standing rule: never add an outbound capability to `_TOOL_REGISTRY` before the approval model
  exists.
- **"…the same one works in chat" caption** — currently false; blocked on the row above.
- **A vendor catalogue + per-vendor "Connect"** — needs BE-NEEDED (5).

---

⚠ **Read `connections.html` as a milestone, not a screen.** Of its 38 audited elements only **14
ship**, and every remaining structural row traces to one of three absent foundations: an **MCP
client**, an **OAuth/credential store**, or an **approval model** (SEED-144 provider-shaped ·
SEED-145 platform assets · SEED-146 every capability is a WRITE).

⚠ **Read `draft-arrival.html` the opposite way.** It is essentially built: 27 of 37 elements ship,
and every one of its eight gaps is a deliberate refusal with its reasoning recorded in-file. The only
real work there is the "What I decided for you" heading and extending the publish-gate sentence
beyond the requirement row.

# Phase 244: The Chat Shell and the Composer - Context

**Gathered:** 2026-09-11
**Status:** Ready for planning
**Base SHA at discuss:** `5ebd0fbca` (`docs(242): CLOSED — Row 5 deferred under D-242-08, and it was never runnable`)

<domain>
## Phase Boundary

The **chrome around a conversation** — not the conversation itself. Five surfaces:

1. The chat page's scroll frame (the rail and composer hold still; the message list moves).
2. The composer's **lock semantics** at a cap-paused Deep run.
3. Where a human **approval** is answerable.
4. How a **file joins a message**, and what "this file is temporary" means in the data model.
5. What the **app shell** says when a watched source has stopped reading.

⛔ **Out of scope, named so a plan cannot drift into them:** the streaming architecture (D-243-08
carries forward), the thinking block / delta cadence / follow-scroll seam (Phase 243, closed), a
retrieval scope term, embedding a chat attachment, promote-to-Library, a second tenant in the
attention registry, and any chat-list grouping or pinning.
</domain>

<decisions>
## Implementation Decisions

### ⚠⚠ FIVE MEASURED FINDINGS THAT CHANGE THIS PHASE'S SHAPE — read these before planning anything

These were measured at `5ebd0fbca` during discuss, not inherited. **Three of them mean the ROADMAP's
own framing is wrong**, and each is recorded with how to re-derive it rather than as an assertion.
This is the Phase 242 pattern repeating ("three of its four requirements were already true"), and the
cost of not reading them is building what exists.

- **F-1 — ⛔ `SHELL-05`'s app-shell signal is ALREADY BUILT, so the ROADMAP's "two net-new surfaces"
  is wrong by one.** Phase 235 plan 09 shipped it under `SURF-03`:
  `frontend/src/components/layout/attentionConditions.ts` (148 L) is a producer REGISTRY with exactly
  one tenant — `useStoppedSourceConditions`, reading the server's `stopped[]` with the soft-failure
  debounce already applied server-side — rendered by `AttentionPopover.tsx` (109 L) and badged on
  **three** surfaces: the desktop rail, the mobile drawer's nav row, and the drawer-opening hamburger.
  Suites: `NavPanel.badge.test.tsx`, `ChatLayout.badge.test.tsx`, `useSourceAttention.test.tsx`.
  ⛔ **`D-235-03` forbids a second tenant in writing and `NavPanel.badge.test.tsx` asserts
  `ATTENTION_PRODUCERS.length === 1` literally.** Re-derive: read the docblock at the top of
  `attentionConditions.ts` — it is the decision record.
- **F-2 — ⭐⭐ `SHELL-04`'s hard half is ALREADY BUILT, and `SEED-042`'s own cost estimate is REFUTED
  at HEAD.** `POST /threads/{id}/workspace/files` (`backend/app/api/workspace.py:229`,
  `upload_template`, Phase 100 / TMPL-01) writes a **thread-scoped, TTL-expiring** file into
  `workspace_files` with `kind='template_input'`. It already has: magic-byte + content validation
  (`validate_upload`), **15 accepted extensions** (`_OOXML_EXT` `.docx/.pptx/.xlsx` ∪ `_TEXT_EXT`
  `.md/.json/.csv/.txt/.py/.js/.sh` ∪ `_IMAGE_EXT` `.png/.jpg/.jpeg/.gif/.webp`), a 10 MB cap
  enforced **three times** including before body materialisation (WR-04), a filename sanitiser (WR-05),
  an RLS **insert** policy for the user (`workspace_files_insert_own`, migration 054),
  `ON DELETE CASCADE` on `thread_id`, a panel renderer (`FilesSection.tsx:273`), an API client
  (`lib/api/documents.ts:56`), and a caller already in the chat shell (`ChatLayout.tsx:377`).
  The agent already reaches it via `workspace_read` / `workspace_list`.
  ⛔ **`SEED-042` says its option (ii) "costs a new write endpoint + RLS" — both exist.** That
  sentence is stale and must not be planned against.
- **F-3 — `SEED-029`'s Continue affordance is SHIPPED.** `_MAX_CONTINUES_PER_RUN = 3`
  (`backend/app/api/threads.py:1096`), `MessageItem.continueButton.test.tsx`,
  `MessageItem.capPaused.test.tsx`. So `SHELL-02` is **not** "build Continue" — the ROADMAP folds
  `SEED-029` as "IS this fix", and the fix that remains is only the composer lock.
- **F-4 — `SEED-045`'s two folded anchors are BOTH SHIPPED at Phase 156.** Collapsed-rail New Chat is
  permanent on the rail (`NavPanel.tsx:22-26`, `:232-234`, D-02 "reachable from EVERY view"), and the
  chat-list search shipped on desktop (⌘K) **and** mobile (`ChatLayout.tsx:643-656`, the shared
  `matchesTitle` predicate, Phase 156 Wave 3 / D-08). **The `SEED-045` fold into `SHELL-01` therefore
  has nothing left in it** — what is genuinely open on that surface is the three bug reports in D-244-16.
- **F-5 — `SHELL-01`'s cause is findable and named.** `ChatArea.tsx:552` is
  `flex flex-col h-full` → `MessageList.tsx:212` is `<ScrollArea className="flex-1">`, and there is
  **no `min-h-0`** anywhere on that chain. A flex child without `min-h-0` will not shrink below its
  content height, so `flex-1` does not bound the list and the overflow escapes the frame. The shell
  root is correct already (`ChatLayout.tsx:547` `flex h-screen`, `:790/:796/:831` `overflow-hidden`).
  ⚠ This is the **hypothesis with the strongest evidence, not a verdict** — drive the overflow before
  fixing it (the D-243-05 lesson: that phase's stated root cause was already fixed).

---

### The chat attachment — where it lives, and how the agent learns of it

- **D-244-01 — Reuse `workspace_files` via the shipped `POST /threads/{id}/workspace/files`.**
  No new table, no new bucket, no new RLS, **no migration** — which is what makes the ROADMAP's
  "Migrations: none expected" true rather than aspirational. This is `SEED-042` option (ii) and
  `SEED-247` Q1, answered. ⛔ The two rejected arms and why: a new `chat_attachments` table
  duplicates a store that already has the TTL, the cap, the validator and the cascade; `documents`
  with a scope flag puts conversational scratch in the Library table, which is the exact pollution
  `BUG-260905-01` and `SEED-247` exist to prevent, and drags retrieval plus the four Phase 231 RLS
  sites into this phase.
- **D-244-02 — The agent is told by a line in the turn's system prompt listing the thread's attached
  files.** Today **nothing announces an attachment** — the tools exist, the announcement does not, so
  a file joining the thread is not the same as the agent using it, and criterion 4 says *"and the
  agent can use it"*. Deterministic, provider-uniform, costs a handful of tokens, needs no tool call
  to discover existence. ⛔ Rejected: appending "I've attached X" to the user's own message (it edits
  the person's words), and leaving the agent to call `workspace_list` unprompted (the status quo — a
  weak model ignores the file entirely).
  ⚠⚠ **CROSS-PROVIDER OBLIGATION, not optional:** a system-prompt addition must be measured on the
  **full native roster + OpenRouter (8 rows)** per CLAUDE.md's roster rule, derived from
  `MODEL_CAPABILITIES` rather than re-typed. Moonshot/Kimi is the only `emit_tier: coerce` native row
  and is the weakest emission guarantee in the registry; OpenRouter rows are `native_tools: False`.
  A row with no key or a known defect is recorded ⛔ with its reason, **never dropped**.
- **D-244-03 — An attachment is read INLINE and is NEVER chunked or embedded.** The agent reads it
  with `workspace_read` when it needs it. No vectors, no scope term in retrieval, no touch to
  `search_documents` or the four RLS sites, no dedup ruling against `documents_dedup_idx`. ⭐ This is
  the only answer that makes *"not in the KB"* **structurally true** rather than a promise — which is
  `SEED-042`'s whole point and the ROADMAP's named failure mode (*"a local attach ships that quietly
  writes to the Library anyway"*).
- **D-244-04 — Lifetime is the existing TTL plus the existing cascade; no promote control in 244.**
  `app_settings.template_ttl_hours` (default **24**, `user_settings.py:292`) and
  `workspace_files.thread_id … ON DELETE CASCADE` (migration 054:7). ⚠ **The TTL is a READ gate, not
  a delete sweeper** — the four GET routes apply a PostgREST `.or_` expiry filter (`_now_iso()`
  docblock, D-06/D-11), so an expired row becomes invisible and **survives in the table**. A plan must
  say so rather than describe it as deletion. Promote-to-Library stays `SEED-247` Q4, planted.

### The two inverted doors

- **D-244-05 — The composer's cloud item is RE-POINTED at the thread, not the Library.** Both composer
  doors (hard drive, cloud) then mean the same thing — *this conversation* — and neither writes to the
  KB. `ConnectedFilePickerModal` mounts only at `MessageInput.tsx:27/:633`, so this is a contained
  change. It un-inverts `BUG-260905-01`'s table without building a second Library door.
- **D-244-06 — The folder-asking wiring IS built, and its door goes in the LIBRARY.** ⭐ Measured:
  `import_single_file` (`backend/app/services/sources/import_service.py:169-181`) **already accepts
  `folder_id`** — Phase 233 added it — and the chat route `POST /connections/{id}/files/{fid}/import`
  (`connectors.py:1787`) simply never passes one, which is why it lands at root. So criterion 4's
  second clause costs: a request body on that route + forwarding the parameter that already exists +
  an entry point beside the Library's existing upload button. ⛔ **Unset folder = refuse, never
  silently root** — silently rooting is the defect. ⛔ **`mint_document_row` / `splice_document` stay
  the only minter** (ROADMAP warning, Phase 229's splice); no hand-rolled insert.
- **D-244-07 — The Library already owns a folder-choosing cloud door** — Phase 233's
  `preview_source_folder` → commit path, which passes `body.folder_id` (`connectors.py:1830+`). The
  single-file import is the thin complement to it, not a replacement.

### The cap-paused composer

- **D-244-08 — Unlock the composer: gate on harness MODE, not on lock PRESENCE.**
  `ChatArea.tsx:116` is `const workflowLocked = workflowLock !== null` and feeds
  `MessageInput.tsx:339` `disabled={disabled || workflowLocked}` with placeholder *"Workflow running —
  Cancel to switch back"* (`:337`). A cap-paused **Deep** run is neither harness nor running;
  `BUG-260904-05`'s own analysis says the lock is the wrong instrument, quoting `WorkflowLock`'s
  docblock. Gate on `workflowLock?.mode === "harness"` (and/or `&& !capPaused`).
  ⭐ **Unlocking also makes the exhausted card's existing sentence TRUE** — *"Reached the Continue
  limit — this run is stopped. Start a new message to keep going."* (`MessageItem.tsx:576`) needs no
  rewrite once the composer obeys it. That is why no copy change is decided here.
- **D-244-09 — ⚠ The plan MUST ASSERT that a new message at `cap_paused` actually starts a run.**
  Measured: `POST /threads/{id}/messages` has **no `cap_paused` refusal**, and `cap_paused` is read at
  `threads.py:1234-1253` from the thread's latest `cap_paused` `runs` row. **Whether posting clears
  that row — and therefore whether the lock returns on the next poll — is UNVERIFIED.** Unlocking a
  composer that then posts into a still-locked thread is the same defect one layer down. ⛔ Drive it;
  do not reason about it.
- **D-244-10 — The harness lock copy is UNTOUCHED.** A genuine harness run *is* running and that
  sentence is true. Only the `cap_paused` branch is new. Keeps `SHELL-02` a bug fix rather than a
  composer redesign, and keeps the diff off a G-5-firing file's shipped behaviour.

### The approval in the thread

- **D-244-11 — Mount the SAME `PendingAskStack` in chat.** ⭐ Measured: it is **zero-prop and
  self-resolving** (`PendingAskCard.tsx:690-714`) — `useViewingThread()`, `useAskUserPrompt(threadId)`
  with `reconcile`, `useWorkflowLockForThread`, `usePhases`. `useAskUserPrompt` lives in
  `StreamsProvider.tsx:4004` and is a **store selector, not a fetch**, and **two concurrent readers
  are already the shipped state** (`WorkspacePanel.tsx:358` and `PendingAskCard.tsx:692`). So a third
  reader is free, and criterion 3's *"answering it in either home settles it in both"* becomes
  **STRUCTURAL** — one store slice, one `reconcile`, nothing to keep in sync. Honours Phase 095's
  build-once inventory rule. ⛔ Rejected: a chat-native second renderer of the same pause (two
  components that must agree forever — the thing the build-once rule forbids, and what `SEED-219`
  already complains about here).
- **D-244-12 — It sits INLINE at the paused message, beside the existing `PausedRunCue`.**
  `MessageItem.tsx:392-397` already renders a cue for an unanswered `ask_user` — the question text
  **with no controls**, which IS `BUG-260828-07`. Putting the controls where the cue already is means
  the operator answers where they were already looking, and the cue stops being a dead end.
  ⛔ Not pinned above the composer: that duplicates the panel's "pins to the very top" behaviour in a
  second place and competes with the never-vanishes run-status strip.
- **D-244-13 — ⚠ `PendingAskCard.tsx` is a CROSS-SURFACE SHELL, not a chat component.** Re-derived
  2026-09-11: **14 commits / 7 phases / 765 lines** (the ledger cell reads `13/7/736` and is STALE).
  A change here lands in chat **and** appears in `WorkspacePanel` and `WorkflowRunPage.tsx:1629`.
  **Both homes must be checked**, and `StepIdentity.coverage.test.tsx` pins it as one of the five
  step-identity surfaces (`RunTranscript` is deliberately not a sixth, D-214-16).
- **D-244-14 — `BUG-260828-07` is severity HIGH and closes on a DRIVEN row, not a fence.** Chrome
  MCP, a real armed approval, answered **from the thread**, the panel's copy read afterwards — then
  the reverse direction. ⚠ A synthetic test that the stack mounts proves mounting, not answering, and
  this project's own record says **presence assertions cannot see content drift**. The complaint is
  literally *"it looked right and did nothing"*.

### SHELL-05 — verify what shipped, then attribute the count

- **D-244-15 — Drive criterion 5 against the SHIPPED signal first, then build the tab attribution.**
  ⚠ **Phase 235 closed `SURF-03` UNTICKED and nothing has ever driven criterion 5 end to end** — so
  ticking it on a code reading would repeat exactly what this project keeps paying for. Two halves:
  **(a)** a genuinely stopped watch raises the badge while the operator is doing something else, and a
  **healthy** source does not (the ROADMAP's named failure mode: *"fires for a source that is healthy
  … a signal nobody will trust after the first false one"*); **(b)** the condition-kind → Library-tab
  mapping `BUG-260911-03` needs, so the shell says THAT and the tab says WHERE.
  ⛔ `BUG-260911-03` **asserts the symptom, not the cause** and says so — *"not traced in this
  session"*. **Verify that `attentionConditions` actually knows the KIND before building the
  mapping.** ⛔ **No second producer:** `D-235-03` forbids it and `NavPanel.badge.test.tsx` asserts
  `ATTENTION_PRODUCERS.length === 1`; `SEED-231` (approvals) stays the registry's *intended* future
  tenant and is **not** taken here, even though `SHELL-03` makes it topical.

### Scope, decomposition and the folded reports

- **D-244-16 — Three further open reports FOLD into 244** (operator, at this discuss). All are
  `surface: Agentic-RAG`, `status: open`, and on this phase's surface:
  | Report | Sev | Why it belongs here |
  |---|---|---|
  | `BUG-260911-03` | minor | Its `affected_areas` names `SURF-03` and it routes itself to Phase 244. Given **F-1**, it **is** the open half of `SHELL-05`. |
  | `BUG-260911-02` | major | First click on a thread highlights but does not open it; a second is required. Filed **yesterday** driving 243's UAT, and it is why prompts in that session silently went nowhere. ⛔ **Never checked against production** — the report names that as the first thing to do. |
  | `BUG-260816-03` | major | Thread-row identity: icon, folder chip, title truncation. Given **F-4**, this is what is actually left on the surface `SEED-045`'s fold pointed at. |
- **D-244-17 — FOUR plans, decomposed by surface seam** (G-8 target is 3-5; overhead is **per plan**):
  1. **The scroll frame + the three chat-list bugs** — `ChatLayout.tsx`, `NavPanel.tsx`, the chat-list
     rows. One plan because G-8 says two plans contending for the same files are one plan with two tasks.
  2. **The composer** — cap-pause unlock (D-244-08/09/10), the local-attach affordance (D-244-01/02),
     the cloud re-point (D-244-05), and the Library's folder-asking import (D-244-06) riding this
     plan's backend touch.
  3. **The approval in the thread** — D-244-11/12/13/14. Isolated because it is the highest-severity
     bug and a cross-surface shell.
  4. **SHELL-05** — verify the shipped signal, then the tab attribution (D-244-15).
  ⛔ **NEVER cut to save time:** the verifier, TDD RED drives, `security_enforcement` / `code_review`,
  and migration discipline. The lever is **targeted suites per task, FULL gates once per WAVE**.
- **D-244-18 — G-2 fires on ONE surface, not two.** Sketch **the composer's `+` menu and the
  destination moment** — the net-new thing a person sees, and where they form the "temporary vs
  permanent" mental model. ⛔ **Do NOT sketch `SHELL-05`'s signal:** per **F-1** it is shipped and the
  operator already approved its design at Phase 235, so sketching it would be re-designing live UI.
  `SHELL-01/02/03` are bug fixes on shipped surfaces with named causes and need no sketch — **say so
  explicitly in the plan rather than sketching everything or nothing** (the ROADMAP's own wording).
- **D-244-19 — `SHELL-01` closes on a MEASURED bound, not a screenshot.** Driven in Chrome: assert
  the page root does not overflow (`scrollHeight <= clientHeight` on `document.scrollingElement`) and
  the **rail's bounding rect is unchanged** after scrolling the list — at **≥3 viewport heights** ×
  **panel closed and open**. ⚠ **`scrollTop` is NOT the reader's position** (it once reported a
  1,039 px drag that never happened) — measure a **leaf element's bounding rect**. A `?raw` fence may
  additionally pin the `min-h-0` chain so the class cannot be deleted silently, but **a fence alone is
  a presence assertion** and does not satisfy this criterion. The ROADMAP's failure mode is *"fixed at
  one window height and the dead space returns at another"*, which one height cannot see.
- **D-244-20 — G-5: all of this phase's hot files HAVE ledger rows, and five triples are STALE.**
  Verified 2026-09-11 — `node scripts/check-hot-file-ledger.cjs 244` will not fail on a missing row.
  Re-derived triples, against what the ROADMAP/ledger say:
  | File | Measured `commits/phases/lines` | Register says |
  |---|---|---|
  | `frontend/src/components/layout/ChatLayout.tsx` | **49/25/997** | ✅ agrees |
  | `frontend/src/components/chat/MessageInput.tsx` | **29/14/643** | ✅ agrees |
  | `frontend/src/components/panel/PendingAskCard.tsx` | **14/7/765** | ⚠ ledger `13/7/736` — STALE |
  | `frontend/src/components/chat/ChatArea.tsx` | **70/35/678** | ✅ agrees |
  | `frontend/src/components/chat/MessageItem.tsx` | **69/33/755** | ⚠ ledger `68/33/755` — STALE |
  | `frontend/src/components/layout/NavPanel.tsx` | **21/11/344** | ⚠ ledger `20/11/329` — STALE |
  | `frontend/src/components/layout/attentionConditions.ts` | 2/1/148 | young, row present |
  | `frontend/src/components/layout/AttentionPopover.tsx` | 1/1/109 | young, row present |
  | `frontend/src/hooks/useSourceAttention.ts` | 2/1/131 | young, row present |
  **Re-derive rather than copy these forward** — this ledger's own recurring finding is that a figure
  written at a close goes stale on the next commit, sometimes the same afternoon, and **a row that is
  present and WRONG answers the auditor with `satisfied` and stops the audit.** All firing rows are
  expected **honoured by construction**; each plan reads that file's section in
  `docs/HOT-FILE-LEDGER.md` before planning and updates its row **in the same commit**.
- **D-244-21 — Solo running: this phase has no independent reviewer.** Gemini is unavailable, so a
  review round here is a **self-review** and `244-VERIFICATION.md` must say *"self-verified"*, never
  *"reviewed"* (`OV-SOLO-01`, the standard 242 and 243 both held). Operator-owed items batch to the end.

### Claude's Discretion
- The exact wording and placement of the system-prompt attachment line (D-244-02), subject to the
  8-row cross-provider measurement.
- The `+` menu's item labels and ordering, subject to the sketch's approved frame.
- How the tab attribution is rendered (count vs dot) once the condition-kind question is traced.
- Test-knob placement for any net-new suites (both `TARGETS` and `BASELINE`, per the 214 lesson that a
  suite can sit on the wrong side of exactly one of them).

### Folded Todos
None folded.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The phase's own contract
- `.planning/ROADMAP.md` → `#### Phase 244: The Chat Shell and the Composer` — the five success
  criteria, the `## How we'd know this failed` list, and the flags block. ⚠ Its "two net-new surfaces"
  claim is corrected by **F-1** above.
- `.planning/REQUIREMENTS.md` §`SHELL` (lines 140-157) — `SHELL-01..05` verbatim, and the
  `SEED-045` routing row at line 240.
- `.planning/STATE.md` — current position; Phase 243 closed, 242 code-complete with row 5 deferred.

### The reported bugs this phase closes
- `.planning/reported-bugs/BUG-260828-08-whole-page-scrolls-in-chat.md` — `SHELL-01`.
- `.planning/reported-bugs/BUG-260904-05-cap-paused-deep-run-disables-the-composer-it-tells-you-to-use.md`
  — `SHELL-02`. Read its *"Why the lock is the wrong instrument here"* section; it carries the fix shape.
- `.planning/reported-bugs/BUG-260828-07-approval-buttons-absent-in-chat-thread.md` — `SHELL-03`, HIGH.
- `.planning/reported-bugs/BUG-260905-01-cloud-import-lives-in-chat-and-dumps-into-library-root.md`
  — `SHELL-04`. Its *"What 'fixed' looks like"* table is the door inversion D-244-05/06 answer.
- `.planning/reported-bugs/BUG-260911-03-library-badge-does-not-say-which-tab-needs-attention.md`
  — folded (D-244-16); the open half of `SHELL-05`.
- `.planning/reported-bugs/BUG-260911-02-first-click-on-a-thread-selects-it-but-does-not-open-it.md`
  — folded; **check production first**.
- `.planning/reported-bugs/BUG-260816-03-thread-row-identity-icon-folder-chip-title-truncation.md`
  — folded.

### The seeds this phase answers or must not smuggle
- `.planning/seeds/SEED-247-thread-scoped-attachments-vs-library-documents.md` — **trigger #2 is now
  TRUE** ("anyone adds a local-file upload to the chat composer"). Its six questions: **Q1 answered**
  (D-244-01), **Q2 answered** (D-244-03 — inline only, so no retrieval scope term), **Q3 answered**
  (D-244-04 — cascade), **Q4 DEFERRED** (promote-to-Library), **Q5 moot** (no `documents` row, so no
  dedup collision), **Q6 answered** (D-244-03 — not embedded).
- `.planning/seeds/SEED-042-chat-input-modalities.md` — folded into `SHELL-04`'s attach half. ⛔ Its
  "option (ii) costs a new write endpoint + RLS" is **refuted** (F-2). Its STT half stays planted.
- `.planning/seeds/SEED-029-iteration-cap-continue-button.md` — folded; **already shipped** (F-3).
- `.planning/seeds/SEED-045-ui-ux-polish-pass.md` — its chat-list / nav-collapse anchors are folded but
  **already shipped at Phase 156** (F-4); grouping/pinning stay planted.
- `.planning/seeds/SEED-231-nobody-is-told-an-approval-is-waiting.md` — the attention registry's
  intended second tenant. ⛔ **NOT taken here** (D-235-03).
- `.planning/seeds/SEED-253-mobile-has-no-drawer-trigger-outside-the-chat-view.md` — planted while
  building the mobile home for this very signal; re-read it before touching the drawer.
- `.planning/seeds/SEED-219` — `stepIdentityVocabulary`'s pause sentences imported by nothing. Related
  to `SHELL-03` but **distinct** (that one is the words, this one is the controls) — the bug report
  says so itself.

### The code the decisions name
- `frontend/src/components/layout/attentionConditions.ts` — **the decision record for `SHELL-05`.**
  Read its docblock: `D-235-03` (one tenant), `D-235-05` (no client-side verdict), the two-readers
  correction, the declined threading, and the three-part re-open trigger.
- `backend/app/api/workspace.py` — `validate_upload` (`:180-218`), `POST /files` (`:229`), the
  `_ALLOWED_EXT` sets (`:124-130`), the `_now_iso()` expiry-gate docblock.
- `backend/app/services/sources/import_service.py:169-181` — `import_single_file`, **already takes
  `folder_id`** (Phase 233 / D-233-01).
- `backend/app/api/connectors.py:1787` — `import_connection_file`, the route with no body;
  `:1830+` — `preview_source_folder`, the sibling that does pass `body.folder_id`.
- `frontend/src/components/panel/PendingAskCard.tsx:690-714` — `PendingAskStack`, zero-prop, and the
  `runIsOver` two-conjunct docblock (both conjuncts load-bearing, each alone wrong).
- `frontend/src/providers/StreamsProvider.tsx:4004` — `useAskUserPrompt`, a store selector.
- `supabase/migrations/054_workspace_files.sql` — the table, the CHECKs, the four RLS policies, the
  `ON DELETE CASCADE`.

### Project rules that bind this phase
- `CLAUDE.md` → **UAT scoreboard recipe** (the 8-row roster rule, derived from `MODEL_CAPABILITIES`,
  blocked rows recorded ⛔ never omitted) — binds D-244-02.
- `CLAUDE.md` → **Workflow guardrails** G-2 (D-244-18), G-4 (D-244-14/19), G-5 (D-244-20),
  G-8 (D-244-17).
- `docs/HOT-FILE-LEDGER.md` — the per-file sections for every file in D-244-20's table; **same-commit
  sync rule**, disposition cell capped at 200 chars.
- `docs/PLANNING-PROPORTION.md` — the G-8 evidence and the per-agent catch-rate table.
- `.claude/skills/sketch-findings-agentic-rag/SKILL.md` — **load before the D-244-18 sketch and before
  touching `MessageInput`, `MessageItem`, `ChatArea`, `PendingAskCard`, the workspace panel or the
  nav/IA.** Covers the composer, the ask_user interrupt, the panel↔chat seam and the icon convention.
- `.planning/phases/243-the-thinking-block-and-the-follow-scroll-seam/243-CONTEXT.md` — D-243-08 (no
  streaming rewrite), D-243-11 (presence assertions), D-243-17/18 (gate-knob shapes, gate red at base).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`POST /threads/{id}/workspace/files`** (`backend/app/api/workspace.py:229`) — a complete
  thread-scoped ephemeral upload: validation, 15 extensions, 10 MB × 3 checks, TTL, RLS insert,
  cascade. `SHELL-04`'s local half is an affordance over this, not a subsystem.
- **`uploadWorkspaceTemplate`** (`frontend/src/lib/api/documents.ts:56`) — the client is written, and
  `ChatLayout.tsx:377` already calls it from the chat shell on workflow launch.
- **`TemplateUpload.tsx`** (panel) — an existing upload affordance whose `accept=` is kept in lockstep
  with `_ALLOWED_EXT`; the composer's affordance should reuse that contract, not restate it.
- **`FilesSection.tsx:273`** — already renders a `kind === 'template_input'` row distinctly, so an
  attachment is visible in the panel with no new renderer.
- **`workspace_read` / `workspace_list`** (`tool_dispatcher.py:3785`, `:4240-4241`) — the agent's
  existing reach into `workspace_files`. Nothing new is needed on the tool side.
- **`PendingAskStack`** — zero-prop, self-resolving; `<PendingAskStack />` is the whole mount.
- **`import_single_file(..., folder_id=None, ...)`** — the folder parameter exists; only the chat
  route fails to pass it.
- **`attentionConditions.ts` + `AttentionPopover.tsx` + `useSourceAttention.ts`** — the whole app-shell
  signal, on three surfaces, with three suites.
- **`matchesTitle`** — the shared chat-list filter predicate used by both desktop and mobile.

### Established Patterns
- **Build once, mount twice** (Phase 095 inventory rule) — why D-244-11 reuses `PendingAskStack`
  instead of authoring a chat-native control.
- **A registry with one tenant** — `attentionConditions.ts`'s shape, with the count enforced by a test
  so the next author must argue with a number.
- **Navigation is a callback, never a URL** — this app has no router (`SEED-185`); `AttentionCondition.onOpen`
  is injected by the shell. The tab attribution must follow that, not invent a route.
- **`mint_document_row` / `splice_document` are the only minter** (Phase 229's splice) — binds D-244-06.
- **Blocking I/O wrapped in `run_in_threadpool`** (D-v2.5-01) — any new `supabase-py` call.
- **Realtime is a hint, never truth** (D-v2.5-03) — reconcile on (re)connect.
- **Settings live in `app_settings` / `user_settings`, never env** — the TTL knob already does.

### Integration Points
- `MessageInput.tsx` `+` menu (`:363-379`) → the two file doors; `ConnectedFilePickerModal` (`:633`).
- `ChatArea.tsx:116` → `:436` → `MessageInput.tsx:339` — the single lock chain `SHELL-02` edits.
- `MessageItem.tsx:392-397` — the `PausedRunCue` the approval controls join (D-244-12).
- `ChatArea.tsx:552` → `MessageList.tsx:212` — the flex chain `SHELL-01` bounds.
- The agent-turn system-prompt assembly — where D-244-02's line is injected (the plan names the exact
  site; it must be the shared path, with nothing provider-specific above the service boundary).
- `LibraryPage.tsx` / its header bar — where the Library's single-file cloud-import door lands.

### ⚠ Gate state inherited at this base, so a plan does not misread it as its own damage
- Backend unit baseline is at the **ceiling of 71** with **zero headroom** — any new failure breaks the
  gate. Command: `pytest tests/unit -q --continue-on-collection-errors` in `backend/` with the venv.
- `src/components/sources/sourceComposition.test.tsx` is a **standing red** (~18 failed / 31 passed) in
  **neither** gate knob, by a Phase 235 decision. Invisible to the count-gate verdict line.
- `SEED-171`'s five cap-independent flaky suites exist; **capture failing filenames from the gate's own
  persisted JSON BEFORE re-running anything**, and never reach for the cap.
- **`npx tsc --noEmit` in `frontend/` checks ZERO files** (solution-style config). Use
  `npx tsc -p tsconfig.app.json --noEmit` and measure a **set diff** — base is **67** errors, so "zero"
  is not a reachable criterion.
- `GSD_VITEST_MAX_WORKERS=2`, gate run from the **repo root**, verdict line read verbatim.
</code_context>

<specifics>
## Specific Ideas

- The operator's own model, verbatim (`BUG-260905-01`): *"Anything in the chat should stay temporarily
  in that thread, not in the Library itself."* D-244-01/03/05 exist to make that **structurally** true
  rather than a promise — a file attached in chat has no `documents` row at all, so there is nothing to
  pollute the KB with and nothing for retrieval to find.
- `BUG-260911-03`'s framing is the right one and should survive into the build: *"the badge creates a
  question it then refuses to answer"* — and *"the cost scales the wrong way"*, because the badge is
  most useful exactly when several things need attention and "which tab?" is most expensive by hand.
- The cap-pause failure in one sentence (`BUG-260904-05`): *"The UI instructs an action it forbids."*
  Unlocking the composer is what makes the shipped sentence honest, which is why no copy is rewritten.
- ⛔ The ROADMAP's named anti-fix: *"the cap-paused composer is 'fixed' by removing the message that
  told the operator to use it — the sentence goes away and the operator is still stuck."* Deleting
  `MessageItem.tsx:576` is NOT the fix.
</specifics>

<deferred>
## Deferred Ideas

- **Promote a thread attachment to the Library** (`SEED-247` Q4) — the natural *"this turned out to be
  worth keeping"* flow. Needs a folder picker, the mint/splice path and a dedup ruling; not asked for
  by any criterion. **Re-open:** the first time a person asks to keep an attachment, or when `SEED-038`
  (generated-files/artifacts unification) is scheduled.
- **Chunking + embedding a thread attachment with a retrieval scope term** (`SEED-247` Q2/Q5/Q6) —
  explicitly out, per D-244-03. **Re-open:** when someone needs to *search* inside an attachment rather
  than have the agent read it.
- **Voice / STT in the composer** (`SEED-042`'s half C) — stays planted, rated LOW.
- **Chat-list grouping, date sections and pinning** (`SEED-045`'s remaining items) — the search and
  collapsed-rail anchors shipped at Phase 156; the rest waits for a polish pass.
- **A second tenant in the attention registry — approvals** (`SEED-231`) — forbidden by `D-235-03` and
  a test. **Re-open:** a deliberate override with the count argued, not a fill-in.
- **Hoisting the attention verdict into a context provider** — `attentionConditions.ts`'s own
  three-part re-open trigger (a third concurrent reader; a materially faster poll; a consumer that
  must WRITE the verdict). ⚠ D-244-15's tab attribution could trip arm 1 — check before adding a reader.
- **`SEED-253`** — mobile has no drawer trigger outside the chat view, found while building this very
  signal's mobile home. Not taken; re-read before touching the drawer.
- **A separate, longer TTL for chat attachments than for workflow templates** — only if 24 h is
  measured to be wrong.
- **`SEED-271`** — `retrieval_top_k` and `rrf_k` have no bound anywhere (Phase 242 finding). Not this
  phase's surface; triggered by Phase 246 or the next phase touching `settings.py`.

### Reviewed Todos (not folded)
- `spike-nl-workflow-authoring.md` (score 0.6) — matched on generic keywords only (*phases, run, 2026,
  first, move*). It is NL→workflow authoring, unrelated to the chat shell. Reviewed and **not folded**.
</deferred>

---

*Phase: 244-the-chat-shell-and-the-composer*
*Context gathered: 2026-09-11*

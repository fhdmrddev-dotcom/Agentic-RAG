# Phase 274: Thread-Scoped Attachments - Context

**Gathered:** 2026-10-05
**Status:** Ready for planning (G-2 sketch 274 resolved: winner A, see D-15)

<domain>
## Phase Boundary

What a person drops into a chat **stays in that chat**, and the Library grows only when somebody
**deliberately** puts something there (ATT-01, ATT-02, ATT-03).

⭐ **MEASURED AT DISCUSS (2026-10-05): most of ATT-01/02 is ALREADY BUILT at HEAD by Phase 244.** This
phase does NOT rebuild it. It does four things:

1. **Proves** what 244 built, live (it was never driven; `BUG-260905-01` still reads `folded` with an
   empty `verified_closed_by`).
2. **Builds ATT-03 promote-to-Library**, which is `SEED-247` Q4, the one open question.
3. **Fixes the SC#4 storage leak**: thread delete removes `workspace_files` rows by cascade but leaves
   the bytes in the `workspace-files` bucket.
4. **Changes attachment lifetime** from the 24h template TTL to the life of the thread.

### Measured at HEAD (code read, not yet driven)

| Claim | State | Evidence |
|---|---|---|
| Composer local attach writes the thread, not `documents` | ✅ built | `frontend/src/lib/api/documents.ts:66` → `POST /threads/{id}/workspace/files` |
| Composer cloud attach writes the thread, not `documents` | ✅ built | `useComposerAttachments.ts:113` → `…/workspace/files/from-connection` (NOT `importCloudFile`) |
| Attachment never chunked/embedded → not in Library, search, other threads | ✅ by construction | no `documents` row is minted (D-244-03) |
| Agent is told the file exists | ✅ built | `agent_loop.py:1252-1281` `_build_attachment_note`, allow-list on `_ATTACHMENT_KIND = "template_input"` |
| `.pdf` accepted | ✅ built | `workspace.py:139-144` `_PDF_EXT` in `_ALLOWED_EXT` |
| Library owns local upload + cloud import, folder REQUIRED | ✅ built | `LibraryCloudImport.tsx:115` `importCloudFile(…, { folder_id })`; `useDocuments.ts:118` |
| Composer "Tools and connectors" | agent-tool toggles + a "manage connections" link, no ingest | `MessageInput.tsx:667-675` `ConnectorsFlyout` |
| **Promote to Library** | ❌ **not built** | no route, no UI |
| **Thread delete removes attachment BYTES** | ❌ **gap** | `threads.py:1399-1455` cleans only `sandbox-outputs`; files over the inline threshold live at `workspace-files/{user}/{thread}/{file}/v{n}` (`workspace_service.py` ~:305) and are orphaned |
| **Attachment usable for the thread's life** | ❌ **24h** | `template_ttl_hours` (default 24, `user_settings.py:355`), shared with workflow template inputs |

</domain>

<decisions>
## Implementation Decisions

### 'Ingested' meaning (ATT-01)
- **D-01:** **Inline-only. D-244-03 stands.** A chat attachment is read by the agent (`workspace_read`,
  or `pypdf` in the sandbox for PDFs) and is **never chunked or embedded**. Retrieval gains no scope
  term, and the four Phase 231 RLS sites and 272's filter seam are untouched. "Ingested" in ATT-01 means
  *the agent can use it in that thread*, not *it has vectors*.
- **D-02:** **Keep the 10 MB cap** (`MAX_FILE_SIZE`, shared with the agent workspace). An oversize file
  gets the server's verbatim 422, as today. No separate attachment cap.
- **D-03:** **SC#1 is proven on the FULL native roster plus OpenRouter (8 rows)**, derived from
  `MODEL_CAPABILITIES` (one registry-backed, newest model per provider), never re-typed. Each row
  attaches a file with a **planted fact** that appears nowhere else, asks about it, and reads the
  answer. A row with no key or a known defect is recorded ⛔ with its reason, never dropped. This is the
  guard against the ROADMAP's named failure: *"ATT-01 passes only because the agent could never read the
  attachment."* Use the per-request `model` + `provider` method on `POST /threads/{id}/messages` (no
  global setting mutated).
- **D-04:** **The negative half of SC#1 is driven too:** the same planted fact, asked in a **second
  thread**, must not be answered from the attachment, and a document search for it returns nothing.

### Attachment lifetime (ATT-01, SC#4)
- **D-05:** **A chat attachment lives for the life of its thread.** No 24h cliff. It stays usable until
  the thread is deleted. Promotion does not end it (D-11).
- **D-06:** **Workflow template inputs keep their 24h TTL.** Chat attachments and workflow template
  inputs are currently the same `kind='template_input'` through the same upload route, so the phase
  must make them distinguishable. *How* (a new `kind` value, an upload-route parameter, or a per-row
  `expires_at = NULL`) is Claude's discretion (see below). ⚠ Whatever is chosen must keep the
  `agent_loop._ATTACHMENT_KIND` allow-list and `ChatAttachmentChip.attachmentsForMessage` agreeing. They
  test the same string on both sides, and a split there means the agent stops being told about the
  file.
- **D-07:** **The chip copy drops "· 24h".** It says `this chat only` (sketch 236 / D-244-22's scope
  word stays; the duration goes). The expired-chip state (D-244-25) still exists for rows that genuinely
  expired before this phase, plus workflow template inputs.
- **D-08:** **Thread delete removes the attachment rows AND their bucket bytes.** `delete_thread` gains
  a best-effort removal of the thread's `workspace-files` objects, the same shape as the existing
  `sandbox-outputs` cleanup at `threads.py:1413-1441`. "Removed" means the bytes are gone, not just
  unreachable. ⛔ RLS read first (the user's own thread), then the removal. Never a service-role sweep
  keyed on a client-supplied id.

### Promote flow (ATT-03)
- **D-09:** **One "Save to Library" action, two entry points:** the attachment chip on the sent message,
  and the file's row in the workspace panel's Files section. Both open **one shared dialog** (build once,
  mount twice, per the Phase 095 inventory rule). Only `template_input`/chat-attachment rows get it.
  Agent-written workspace files do not (out of scope; see Deferred).
- **D-10:** **The folder choice reuses `MoveToFolderDialog`** (`frontend/src/components/health/MoveToFolderDialog.tsx`).
  A folder is **required**: unset means refuse, never silently root (same rule as D-244-06). The confirm
  word is **`Save to Library`**. ⛔ Never `Attach` (the composer's word) and never `Import` (the cloud
  door's word).
  ⚠ **AMENDED 2026-10-05 by sketch 274 (the original above is kept, not deleted).** `MoveToFolderDialog`
  **cannot be reused as-is**: it is a flat `Select` that calls `moveDocument` itself and offers
  **"Root (no folder)"**, and `UploadFolderPicker` has the same Root sentinel. The binding rule is now:
  **a folder picker with NO Root option that returns a folder id and leaves the commit to the caller**,
  drawn as the sketch-274-A **searchable list of full paths** (D-15). Reuse `listFolders()`; do not
  reuse either shipped picker's Root branch.
- **D-11:** **Promotion COPIES.** The Library gets its own `documents` row through the shipped minter
  (`async_mint_document_row` → the normal splice/extraction/embedding pipeline). ⛔ No second ingest
  path, no hand-rolled insert. The thread attachment **stays** in the thread unchanged, and its chip
  gains an **`In Library · <folder>`** mark that links to the document. SC#4's *"promoted documents
  untouched by thread delete"* is then true by construction: the copy has no FK to the thread. The plan
  must still drive it (G-4 #4).
- **D-12:** **Rights are the Library upload door's rights.** Whoever can upload to that folder through
  the Library can promote into it. The folder-ownership/org check inside `async_mint_document_row` (its
  403) is the authority. No new permission concept. ⛔ The promote route reads the attachment through
  the **user-JWT / RLS path** (the person's own thread) before minting, never service role first (the
  `BUG-260903-02` shape).

### Duplicate rule (ATT-03)
- **D-13:** **Same bytes already in the org's Library → link, don't copy, and say where.** Same as the
  Library upload door (`documents.py:623`, `mint_result.is_duplicate` → 200 + existing doc). The dialog
  result and the chip both say **`Already in Library · <folder>`** and link to the existing document,
  **even when that folder differs from the one picked**. That difference is stated, never hidden. No
  dedup bypass. Mig 195/196's org-scoped indexes stand.
- **D-14:** **Same filename, different bytes, in the chosen folder → a new version, said up front.**
  This rides the shipped versioning (`is_latest` retirement). Before confirming, the dialog warns:
  *"This will become version N of `<name>` in `<folder>`."* There is no "keep both" (mint has no rename
  path).

### Guardrails
- **D-15:** **G-2 FIRES → sketch BEFORE plan-phase (operator, 2026-10-05).** `/gsd:sketch` covers:
  (a) the chip's `Save to Library` action, (b) the dialog: folder tree, the D-13 *already in Library*
  result, the D-14 version warning, and the refusal states, and (c) the chip's `In Library · <folder>`
  and `Already in Library · <folder>` states. It **extends sketch 236**
  (`.planning/sketches/236-the-file-that-belongs-to-this-chat/`) rather than starting fresh, and ports
  its `COPY.js`. The operator-approved mockup is the acceptance bar. Per D-244-27, a text-only contract is
  not sufficient: the sketch's ordered composition is what the build reproduces.
  ✅ **RESOLVED 2026-10-05: sketch `274-save-to-library`, winner A (Menu on the chip).** The
  acceptance bar is `.planning/sketches/274-save-to-library/index.html`, its README's *Build Contract*
  and *WINNER* sections, and `COPY.js` (**ported, not re-typed**). Binding atoms: an always-visible
  `⋯` in the chip (touch-reachable) → *Save to Library… / Open in panel*. The dialog is a searchable
  full-path listbox with no Root, and confirm is disabled until a folder is picked. The chip gains a
  segment (`✓ In Library · <leaf>` / `Already in Library · <leaf>`) carrying `· indexing…` until the
  document is searchable. The same `⋯` sits on the panel Files row, and agent-written files get none.
  The chip drops `24h` (D-07). ⚠ The listbox needs real listbox a11y (`role=option`, `aria-selected`,
  keyboard), the 035-A obligation.
- **D-16:** **G-4: all four operator scenarios are driven in Chrome at verification**, not just asserted:
  1. **Library pollution:** attach a PDF in chat → it is NOT in the Library and NOT found by document
     search.
  2. **Agent can't see it:** attach a file, ask about it → the agent answers from it (the planted fact),
     never "I have no file" or an invention.
  3. **Promote lands wrong:** Save to Library → pick folder X → the document is in X (not root, not
     elsewhere) and the chip says `In Library · X`.
  4. **Delete eats the keeper:** promote, then delete the thread → the Library copy still opens and
     downloads, and the attachment's bucket bytes are gone.
- **D-17:** **Close `BUG-260905-01` on these driven rows.** Its `verified_closed_by` has been empty since
  244 because no live row was driven. G-4 #1 and #3, plus a composer-door audit (D-18), are its
  reproduction. Flip `status: closed` only if they pass.
- **D-18:** **The ATT-02 audit is a NEGATIVE proof, not a visual one.** The ROADMAP's named failure is
  *"ATT-02 is met by hiding a button while an API path still writes Library rows from chat."* So the plan
  enumerates every `documents` minter (`async_mint_document_row` callers: `documents.py`,
  `import_service.py`, `watch_service.py`, `email_attachments.py`, `expert_install_service.py`, and the
  new promote route) and proves that none is reachable from a composer action **except** the explicit
  promote. The composer's `ConnectorsFlyout` "manage connections" link opens agent-tool connections and
  creates no watch. Confirm this; do not assume it.
- **D-19:** **G-5 audit at plan time.** Hot files this phase is likely to touch: `backend/app/api/threads.py`
  (FIRES, 88 phases), `backend/app/api/workspace.py` (FIRES), `backend/app/services/agent_loop.py`
  (FIRES, only if D-06 changes the allow-list), `frontend/src/components/chat/MessageItem.tsx`/`ChatArea.tsx`
  (FIRE, only if the chip mount changes), `frontend/src/components/panel/FilesSection.tsx` (FIRES),
  `frontend/src/components/chat/ChatAttachmentChip.tsx`, `backend/app/api/documents.py` (FIRES, if the
  promote route lives there), `backend/app/services/ingest_splice.py` (FIRES, read-only expected).
  Run `node scripts/check-hot-file-ledger.cjs` on the plan dir. Each touch on a FIRING file must be
  "honoured by construction" (additive, named seam) or propose the extraction first. The promote route
  goes in its **own small module**, not as another branch in `threads.py`.
- **D-20:** **G-8: target 3-5 plans.** Natural seams: (1) backend: promote route + lifetime split +
  delete cleanup; (2) frontend: the shared dialog + the two mounts + chip states; (3) live proof: the
  8-row roster + G-4 drives + negative ATT-02 audit + bug close.

### Resolved at plan-phase (Claude, 2026-10-05, autonomous chain; research open questions 1-6)
- **D-21:** **The workspace panel's `TemplateUpload` door keeps its 24h TTL.** Only the composer's two
  attach doors (local + cloud) write `expires_at = NULL`. The panel door is a workflow-template-input
  door (D-06). Re-open trigger: an operator reports a panel-uploaded file expiring mid-chat.
- **D-22:** **Types the Library door refuses (`.json .py .js .sh`) get the action disabled with a
  stated reason, before the dialog opens**, never a post-confirm surprise. The menu item stays visible
  and reads disabled with one line (ported into `COPY.js`-derived copy as a net-new string). The
  promote route still refuses them server-side (422, the Library door's own allow-list, never a
  second list).
- **D-23:** **"Open in panel" reveals the panel only** (`requestOpenPanel`). Selecting the file row
  inside `WorkspacePanel` is out of scope.
- **D-24:** **`expiredWhy` copy is corrected** so it no longer claims chat attachments are kept 24
  hours. It describes rows that expired under the old rule plus workflow template inputs.
- **D-25:** **The chip segment gains a failed state** (`couldn't index`) when the promoted document's
  ingestion fails, rather than reading `indexing…` forever. Net-new copy, flagged as such.
- **D-26:** **The agent note's "They expire" line (`agent_loop.py` ~:1331) is corrected** to say
  chat attachments last for the thread. This is a one-line, comment-sized string edit in a FIRING file
  and is honoured by construction (no branch, no allow-list change). Without it every model is told
  something false. `test_244_attachment_prompt_line.py` is updated deliberately in the same commit.
- **D-27:** **The 8-hex storage prefix is stripped from the filename before minting** (D-14 can never
  match otherwise), and `_EXT_MIME_OVERRIDES` is applied before `mimetypes` guessing.
- **D-28:** **Migration 203 adds the mark** (`workspace_files.library_document_id uuid REFERENCES
  documents ON DELETE SET NULL`, `library_link text CHECK in ('saved','already')`), with no paired
  CHECK that would block document delete. Applied via SQL editor / local psql, never `supabase db push`.

### Claude's Discretion
- **The mechanism that separates chat attachments from workflow template inputs** (D-06): a new `kind`,
  a route parameter, or `expires_at = NULL`. Pick the one that keeps the agent allow-list and the chip
  helper on one shared constant, and needs no migration if possible. If a `kind` CHECK constraint
  exists, a migration is unavoidable. Then: next free number, SQL-editor apply, regenerate
  `full-schema.sql`, `get_advisors(security)`.
- **Existing rows:** forward-only by default. Attachments that already expired under the 24h TTL are not
  resurrected, because a blanket `expires_at` reset would also revive workflow template inputs. Say so in
  the plan.
- **Where the promote route lives** (a new module is preferred over growing `threads.py`/`documents.py`),
  and whether promote copies bytes server-side from the workspace bucket/inline content into
  `documents` storage (expected: server-side, never a client re-upload).
- **What the `In Library` mark persists on** (a column on `workspace_files`, a `metadata.promoted_to`,
  or a lookup by `content_hash`). It must survive reload. Pick the cheapest honest option.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/ROADMAP.md` → `#### Phase 274: Thread-Scoped Attachments`: goal, SC#1-4, "How we'd know this failed", Flags
- `.planning/REQUIREMENTS.md`: ATT-01, ATT-02, ATT-03

### Prior decisions this phase stands on (do NOT re-propose)
- `.planning/milestones/v4.1-phases/244-the-chat-shell-and-the-composer/244-CONTEXT.md`: D-244-01 (reuse `workspace_files`), D-244-02 (system-prompt announcement + 8-row roster obligation), D-244-03 (inline, never embedded), D-244-04 (TTL is a READ gate, not a sweeper), D-244-05/06/07 (the door inversion), D-244-22..27 (sketch 236 chip contract, `.pdf`, expired chip, composition contract)
- `.planning/seeds/SEED-247-thread-scoped-attachments-vs-library-documents.md`: Q1-Q6 routing table; **Q4 is this phase**
- `.planning/reported-bugs/BUG-260905-01-cloud-import-lives-in-chat-and-dumps-into-library-root.md`: disposition table; closes on driven rows (D-17)

### Design
- `.planning/sketches/274-save-to-library/` (`index.html`, `COPY.js`, `README.md`): ⭐ **THE ACCEPTANCE BAR (winner A)**. Port `COPY.js`; reproduce the README *Build Contract* composition
- `.planning/sketches/236-the-file-that-belongs-to-this-chat/index.html` + `COPY.js`: the chip contract D-15 extends
- `.claude/skills/sketch-findings-agentic-rag/SKILL.md`: load before the sketch and before any chip/panel build

### Project rules
- `CLAUDE.md` → UAT scoreboard recipe (8-row roster rule), Workflow guardrails G-2/G-4/G-5/G-8, Supabase MCP (writes approval-gated), migration discipline
- `docs/HOT-FILE-LEDGER.md`: sections for every FIRING file D-19 names; same-commit sync rule

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `async_mint_document_row` (`backend/app/services/ingest_splice.py:126/363`): the ONE minter. It returns `MintResult(document, is_duplicate, storage_path, version_number)`; dedup and versioning come with it.
- `POST /documents/upload` (`backend/app/api/documents.py:610-660`): the reference shape for mint → bytes to `documents` bucket → durable `ingestion_jobs` (Phase 230). ⛔ BUG-260905-08: no bytes means no document, so stop on a storage failure.
- `MoveToFolderDialog` (`frontend/src/components/health/MoveToFolderDialog.tsx`): the folder tree dialog (D-10).
- `ChatAttachmentChip` (`frontend/src/components/chat/ChatAttachmentChip.tsx`): chip states (`chatAttachmentState`), `attachmentsForMessage`; gains the promote action + `In Library` states.
- `FilesSection` (`frontend/src/components/panel/FilesSection.tsx`): the panel's file rows, with `isTemplate = file.kind === "template_input"` at :283. This is the second mount.
- `delete_thread`'s `sandbox-outputs` cleanup (`backend/app/api/threads.py:1413-1441`): the shape D-08 copies for `workspace-files`.

### Established Patterns
- User-JWT/RLS read before any service-role action (`BUG-260903-02`).
- Unset folder = refuse, never root (D-244-06).
- Blocking supabase-py calls in async handlers wrapped with `aexec` / `run_in_threadpool` (D-v2.5-01).
- `?raw` copy fences: chip copy lives in `composerCopy.ts` (ported from sketch `COPY.js`); new copy is ported the same way.

### Integration Points
- `workspace_service.write_file`: inline vs bucket by size (`content_inline` / `content_storage_path`), so the promote route must read both.
- `agent_loop._ATTACHMENT_KIND` ↔ `ChatAttachmentChip.attachmentsForMessage`: one string, two sides (D-06).
- `app_settings.template_ttl_hours` → `workspace.py:326`: where the lifetime split lands.

</code_context>

<specifics>
## Specific Ideas

- The operator's model, verbatim (`BUG-260905-01`): *"Anything in the chat should stay temporarily in
  that thread, not in the Library itself."* Promotion is the ONE deliberate act that crosses that line.
- `SEED-247`'s phrasing of the promote flow: *"this turned out to be worth keeping"*, an explicit act.
- The four G-4 scenarios (D-16) are the operator's own "I'd recognize failure here" list.

</specifics>

<deferred>
## Deferred Ideas

- **Chunk + embed a large attachment under a thread-scoped retrieval term** (`SEED-247` Q2/Q5/Q6). Out per
  D-01. **Re-open:** someone needs to *search* inside an attachment rather than have the agent read it.
- **A higher size cap for chat attachments** than the shared 10 MB. Out per D-02. **Re-open:** a refused
  upload is reported as a real need.
- **Promote an AGENT-written workspace file** (a generated report) to the Library. That is `SEED-038`'s
  generated-files/artifacts unification and Phase 273's territory, not a person's attachment. Out per D-09.
- **"Keep both" on a same-name promote** (rename instead of version). Needs a rename path mint doesn't have.
- **Removing a single attachment from a thread** (without deleting the thread). Not asked for by any
  criterion.

### Reviewed Todos (not folded)
- `spike-nl-workflow-authoring.md` (score 0.6). It matched on generic keywords only (*first, move, before*)
  and is NL→workflow authoring, unrelated. Not folded (same ruling as Phase 244).

### Seeds
- **`SEED-247` FOLDED** (Q4 = ATT-03). The sweep printed `0 matched` only because the phase has no
  plans yet; this seed names this phase's subject directly.

</deferred>

---

*Phase: 274-thread-scoped-attachments*
*Context gathered: 2026-10-05*

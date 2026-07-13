# Phase 151: Agent File Tools - Context

**Gathered:** 2026-07-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Two net-new **agent tools** that close the KB↔sandbox↔skill *file* loop (files, not just extracted text). Both register in the flat `_TOOL_REGISTRY` via the documented G-5 extension contract (`tool_dispatcher.py:1707`) — **`backend/app/api/threads.py` stays byte-untouched.**

- **FILE-02 `fetch_document_file`** (READ; **built first**, lowest coupling) — streams a KB document's **original bytes** from Storage into the sandbox working dir so the agent can faithfully convert/render/operate on the real file instead of reconstructing from extracted text (closes SEED-108).
- **FILE-01 `attach_skill_file`** (WRITE) — the agent saves a file onto a skill it owns (reusing the existing `skill_files` table + `skill-files` bucket), including a template the user hands it mid-conversation (closes SEED-104 / carried from the never-executed v3.2 Phase 144).

Internal build order is locked by ROADMAP: **FILE-02 (read) → FILE-01 (write)** — FILE-01's WRITE surface becomes the reference upload/threat pattern reused by Phase 152's WFIN-01. Each tool carries its **own threat model**. SC#10 cross-provider proof required on both.

**In scope:** the two tools + a widened workspace-upload MIME allowlist (for SC#3 mid-chat hand-off).
**Out of scope:** any change to `threads.py`; sandbox binary parity (soffice/pandoc/pdftoppm — SEED-106); sandbox package-manager work (SEED-043); a delete/list-attached companion tool (deferred); the run-input channel + folder scope (Phase 152).
</domain>

<decisions>
## Implementation Decisions

### FILE-02 — `fetch_document_file` (READ)
- **D-01 (no-original behavior — HONEST ERROR):** When a KB document has no stored original file (older text-only ingests, or docs where only extracted markdown exists), the tool returns a **clear error** — e.g. *"No original file stored for this document — use `read_document`/`analyze_document` for its text."* It **never** silently falls back to writing extracted text as a file. The tool's contract is always "real bytes." Matches SEED-108's honesty tie-in (never present a reconstruction as the real file). The agent decides on its own whether to fall back to text.
- **D-02 (size cap — 50 MB, refuse-never-truncate):** Cap ~**50 MB** (covers virtually all real KB docx/pdf/pptx). Streamed to disk, **never into model context**. Over-cap ⇒ honest error stating the actual size. **Never truncate a binary** (a half `.docx`/`.pdf` is corrupt). The cap is an **operator-tunable env/setting knob**, not a hardcoded literal.
- **D-03 (landing convention):** Fetched file lands at **`/sandbox/input/<filename>`** (SEED-108's suggested convention — keeps fetched originals separate from `/sandbox/output/` harvested deliverables and the `/sandbox` scratch/chdir). The tool **returns the exact absolute path** it wrote so the agent never guesses.
- **D-04 (owner/RLS scope):** Same owner/global gating as `read_document` — resolve via the existing owner-scope pattern; **never cross-user**. Never read another user's private document.

### FILE-01 — `attach_skill_file` (WRITE)
- **D-05 (attach sources — COMPREHENSIVE, all four):** The tool accepts bytes from **all four** sources (matches SEED-104's "comprehensive, not a narrow patch" intent):
  1. **Thread workspace file** (`workspace_files`) — covers BOTH a file the agent wrote via `workspace_write` AND a user-uploaded template (Phase-100 `TemplateUpload` lands there). One source path serves both the agent-created and user-handed cases.
  2. **Sandbox output file** (`/sandbox/output/…` via `execute_code`) — a script/asset the agent just generated; reuses the existing harvest/`copy_from_runtime` mechanism.
  3. **Inline content** — agent passes file content directly as a tool arg (simplest for small text/config/scripts; weak models may mangle large/binary — planner should guard).
  4. **KB document id** — attach an existing owned KB document's original bytes onto a skill (couples to FILE-02's fetch path; see threat-model note T-03).
- **D-06 (write target — any OWNED skill):** The agent can attach to **any skill where `skills.user_id == current_user`** (the `.eq("user_id", …)` owner gate — the *real* runtime gate under service-role, RLS is defense-in-depth). Agent names the target skill explicitly. **Global skills and built-in `is_system` skills are NEVER writable** (enforced by the owner-only filter — they are not owned by the caller).
- **D-07 (filename collision — OVERWRITE IN PLACE):** On a filename that already exists on the skill, **replace** the existing `skill_files` bytes + row (upsert on `skill_id + filename`). Predictable for an authoring loop where the agent iterates on the same helper file; no orphan rows. Tool result reports `"updated"` vs `"created"`.
- **D-08 (reuse existing write path):** Reuse the `_upload_skill_files` mechanism (`skills.py:113`) — `skill-files` bucket + `skill_files` row at storage path `{user_id}/{skill_id}/{filename}`. Do NOT invent a new table/bucket.

### SC#3 — user hands the agent a template mid-conversation
- **D-09 (reuse Phase-100 upload, WIDEN types):** Reuse Phase-100's `TemplateUpload` → `POST /workspace/files` (`upload_template`) path — the user uploads, the file lands in the thread workspace, and the agent then calls `attach_skill_file` with the workspace source (D-05 source #1). **No net-new upload surface.** BUT the existing upload is magic-byte-gated to `.docx/.pptx/.xlsx` only; **widen its allowlist** so real skill assets (scripts, `.md`, `.json`, `.csv`, images) can be handed in. One gate to extend — see T-02 for the provenance implication.

### Claude's Discretion
- Whether either tool emits an SSE event (e.g. a `skill_file_attached` event mirroring `workspace_file_written` at `tool_dispatcher.py:1565`) so the UI reflects the attach live — planner decides; must stay additive + provider-uniform (no `provider ==` fork) if added.
- Exact env/setting key name + default for the D-02 size cap.
- Exact tool JSON-schema arg names/shapes (per-provider reliability wording is a planner/researcher concern — see SC#10).
- Whether a companion `list_skill_files` read affordance for the agent is needed (there is no `attach_skill_file` delete counterpart this phase — a deliberate scope line; D-07 overwrite covers the iterate-in-place case).

### Threat-model carries (each tool ships its OWN threat model — MANDATORY per ROADMAP)
- **T-01 (FILE-02 exfil / path / size):** RAG→sandbox bridge is a read-exfil surface — owner/RLS scope must be proven cross-user (SC#4/D-04); size cap enforced pre-download (D-02); filename must be sanitized so a crafted `documents.file_path`/filename cannot escape `/sandbox/input/` (path traversal).
- **T-02 (widened-upload provenance):** Widening the workspace-upload allowlist (D-09) to arbitrary types means a user-uploaded file can be attached to a skill (D-05 #1) and later **sandbox-injected + executed** (Python skill files are effectively run via the `execute_code` skill-file injection at `tool_dispatcher.py:1080`). The threat model must reason about this untrusted-file → skill → execution path (magic-byte / MIME allowlist, size cap, and the fact that `kind='template_input'` provenance exists on the workspace row).
- **T-03 (KB-doc → skill → global data movement):** D-05 source #4 + D-06/D-07 + the owner's ability to later toggle a skill `is_global` = a legitimate but real data-movement path (attach a doc I own → a skill I own → make it global → other users read it). Same owner-scope gate applies (only docs/skills the caller owns), and making a skill global is already an explicit owner action — but the FILE-01 threat model must state this explicitly rather than leave it implicit.
- **T-04 (owner-only WRITE gate):** `attach_skill_file` must resolve the target skill with `.eq("user_id", current_user["id"])` (owner-only), NOT the `.or_(…,is_global.eq.true)` read filter — otherwise the agent could write to a global/built-in skill.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirement + roadmap sources
- `.planning/ROADMAP.md` §"Phase 151: Agent File Tools" — goal, 4 success criteria, locked FILE-02→FILE-01 build order, dedicated-threat-model + SC#10 flags.
- `.planning/REQUIREMENTS.md` — FILE-01 (line 14) + FILE-02 (line 15) requirement text; traceability table (lines 92-93).

### Seeds (the source intent — read both in full)
- `.planning/seeds/SEED-108-rag-to-sandbox-file-bridge.md` — FILE-02 origin: the gap, live cross-provider evidence (OpenAI/Anthropic refuse vs DeepSeek/MiniMax reconstruct-and-overclaim), the `fetch_document_file` sketch, RLS/size/streaming considerations, and the exact code breadcrumbs.
- `.planning/seeds/SEED-104-agent-driven-skill-file-attachment.md` — FILE-01 origin: the comprehensive vision (agent-created + user-handed template), the confirmed `_TOOL_REGISTRY` gap, and the reuse-`skill_files`-don't-invent constraint.

### Codebase breadcrumbs (verified live during scout, 2026-07-13)
- `backend/app/services/tool_dispatcher.py` — `_handle_read_document` (:241, text-only today), `_handle_read_skill_file` (:908, owner-scope + snapshot pattern), `_handle_workspace_write` (:1552, WRITE-tool + SSE-emit pattern), `_handle_execute_code` skill-file **injection** (:1080, base64→`/sandbox/` + `session.copy_to_runtime`), the G-5 extension contract comment (:1707), and `_TOOL_REGISTRY` (:3193) + `dispatch_tool` (:3336).
- `backend/app/services/sandbox_service.py` — `SandboxSessionManager.get_or_create` (:25), `copy_from_runtime` (out), `harvest_output_files` (:201), `snapshot_output_baseline` (:364). The inverse (Storage object → sandbox input dir) is what FILE-02 adds; `session.copy_to_runtime` already exists (used at `tool_dispatcher.py:1137`).
- `backend/app/api/skills.py` — `_upload_skill_files` (:113, the write path FILE-01 reuses), `create_skill` `is_global` hard-set (:240), owner-only `.eq("user_id")` gates on update/delete (:439/:468), `delete_skill` removes `skill-files` (:475).
- `backend/app/api/documents.py` — original bytes at `storage.from_("documents").download(target["file_path"])` (:712/:1074); `file_path` column (:479).
- `backend/app/api/workspace.py` — `upload_template` / `POST /workspace/files` (:149-210, the SC#3 hand-off path), magic-byte gate `.docx/.pptx/.xlsx` (:120, the allowlist D-09 widens), `kind='template_input'` provenance.
- `frontend/src/components/panel/WorkspacePanel.tsx` (:224-227) + `frontend/src/components/panel/TemplateUpload.tsx` — the existing mid-chat upload affordance to reuse/extend.
- `supabase/full-schema.sql` — `skills.is_system` (:1284), `skill_files` RLS/policies (:3601/:3636), `skill_versions` owner-only note (:3783). No new migration expected unless a companion feature is added — reuse `skill_files` + `skill-files` bucket (D-08).

### Conventions
- `.planning/codebase/CONVENTIONS.md` — tool-handler + owner-scope idioms.
- `.claude/CLAUDE.md` — SC#10 UAT recipe (4-axis), G-5 hot-file ledger (`threads.py` extraction due — this phase MUST NOT touch it), provider-docs-first rule (cross-provider tool wording).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Sandbox file injection (FILE-02 core):** `_handle_execute_code` already downloads bytes from Storage and writes them into the sandbox via a base64 preamble + `session.copy_to_runtime` (`tool_dispatcher.py:1080-1137`). FILE-02 is essentially this mechanism generalized to KB documents landing in `/sandbox/input/`.
- **Skill-file write path (FILE-01 core):** `_upload_skill_files` (`skills.py:113`) already does bucket upload + `skill_files` insert with per-file error resilience — FILE-01 reuses it (add upsert semantics per D-07).
- **Mid-chat upload (SC#3):** Phase-100 `TemplateUpload` + `POST /workspace/files` already land a user file in the thread workspace — reuse + widen the MIME allowlist (D-09).
- **Owner-scope resolvers:** reads use `.or_(user_id.eq.{id},is_global.eq.true)`; owner-only writes use `.eq("user_id", …)` (the real service-role runtime gate — RLS is defense-in-depth). `read_path` handles document owner-scope.

### Established Patterns
- **G-5 tool-add contract (`tool_dispatcher.py:1707`):** a new tool = one `_handle_X(args, ctx)` + one `_TOOL_REGISTRY` entry + one schema. `threads.py` untouched. Both tools follow this — no exception.
- **Provider-uniform dispatch (D-14 red line):** all tools flow through the shared `dispatch_tool` + shared SSE vocabulary; **no `provider ==` fork**. SC#10 proof is on the shared path, not per-provider branches.
- **Honest-failure convention:** tools return `ToolResult(result=json.dumps({"error": …}))` on failure rather than raising into the loop (D-01/D-02 errors follow this).

### Integration Points
- New tools plug into `_TOOL_REGISTRY` (`tool_dispatcher.py:3193`) + the tool-schema list the LLM sees; auto-flow through `dispatch_tool` (:3336) for every provider.
- FILE-02 adds a Storage→sandbox copy alongside `sandbox_service.copy_from_runtime`.
- FILE-01 writes through `skill-files` bucket + `skill_files` table; frontend touch is only the widened `TemplateUpload` allowlist.
</code_context>

<specifics>
## Specific Ideas

- User wants the **comprehensive** version of both tools (chose all four FILE-01 attach sources), matching Anthropic's real skill-creator capability "according to our application's actual infrastructure" (SEED-104 operator framing) — not a narrow patch.
- Honesty is a first-class product value here: FILE-02 must never let a model present a text reconstruction as "your converted file" (the SEED-108 overclaim it exists to kill).
</specifics>

<deferred>
## Deferred Ideas

- **`attach_skill_file` delete/list companion tool** — no delete counterpart this phase (D-07 overwrite-in-place covers the iterate-on-one-file authoring loop). Revisit if the agent needs to prune skill files or enumerate what's attached.
- **Sandbox binary parity (soffice/pandoc/pdftoppm — SEED-106)** and **managed sandbox packages (SEED-043)** — FILE-02 unlocks python-native processing on real bytes today (python-docx/pptx/openpyxl/pypdf), but *faithful* format conversion needs these binaries. Out of scope; separate seeds.
- **BUG-260708-02 (execute_code `libraries` install-timing flakiness)** — LEFT OPEN, not folded (orthogonal root cause to file materialization). Note for FILE-02 UAT: its sandbox rows must not paper over this install-timing bug. `surface: Agentic-RAG`, `affected_areas: [sandbox, backend/tool-dispatcher, backend/sandbox-service]`.
- **BUG-260708-01 (DeepSeek tool-markup leak)** — LEFT OPEN, not folded (cross-provider honesty/streaming, agent-loop/skills — tangential to file tools).

### Reviewed Todos (not folded)
None — no `todo.match-phase` matches for Phase 151.
</deferred>

---

*Phase: 151-agent-file-tools*
*Context gathered: 2026-07-13*

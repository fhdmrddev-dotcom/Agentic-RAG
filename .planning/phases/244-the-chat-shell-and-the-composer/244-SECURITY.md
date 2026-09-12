---
phase: 244-the-chat-shell-and-the-composer
slug: the-chat-shell-and-the-composer
status: draft
threats_total: 41
threats_closed: 38
threats_open: 3
asvs_level: 1
created: 2026-09-12
base_commit: 223b3ea4f
head_commit: 144015cdd
---

# Phase 244 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> **Verification method:** every `mitigate` disposition was re-checked against the CURRENT tree at
> HEAD (`144015cdd`), after the `244-07` fix round. No verdict rests on a test assertion — each
> CLOSED row cites the mitigating CODE. Rows the prior code review had already looked at were
> re-derived here rather than inherited.

⚠ **COUNT DISCREPANCY, RECORDED NOT SILENTLY RESOLVED.** The audit brief states **40** threats.
The six `<threat_model>` blocks carry **41** rows — 35 register rows (01×4, 02×7, 03×6, 04×5,
05×6, 06×7) plus **6** `T-244-0N-SC` supply-chain rows, one per plan. All 41 are verified below;
the totals in the frontmatter are the measured 41, not the quoted 40.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| client → `POST /threads/{id}/workspace/files` | the local attach door | untrusted bytes + untrusted filename |
| client → `POST /threads/{id}/workspace/files/from-connection` | ⚠ **net-new** cloud attach door (unregistered flag UF-1) | a connection id + a provider file id; provider bytes + provider filename |
| client → `POST /connectors/connections/{id}/files/{fid}/import` | the Library cloud door | a destination folder id + a provider file id |
| backend → third-party cloud provider | outbound egress to fetch bytes | OAuth-bearing request, remote content |
| `workspace_files` → sandbox container | hydration into `/sandbox/attachments/` | file bytes; filename becomes a container path |
| filename → LLM system prompt | the announcement line | attacker-controlled text inside the model's instructions |
| client → `GET /threads/{id}/workflow` | the lock verdict the composer obeys | run status, `cap_paused`, continues |
| server → `useSourceAttention` | the `stopped[]` verdict | source health sentences (vocabulary leaves only) |
| user-authored text → chat rail / transcript | thread titles, folder labels, filenames | rendered React text nodes + `title=` attributes |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation (verified in code) | Status |
|-----------|----------|-----------|-------------|-------------------------------|--------|
| T-244-01-01 | Information disclosure | `ChatHistoryColumn.tsx` folder-chip `title=` | mitigate | `ChatHistoryColumn.tsx:210-211` — `max-w-[96px] … truncate` + React-escaped `title={folderLabel(...)}`. No `dangerouslySetInnerHTML` anywhere in the file (grep: 0 hits). | closed |
| T-244-01-02 | Tampering | `scripts/vitest-count-gate.cjs` knob edits | mitigate | `git diff --numstat 223b3ea4f HEAD -- scripts/vitest-count-gate.cjs` → **`305  0`** — append-only, zero deletions. | closed |
| T-244-01-03 | Repudiation | `BUG-260911-02` disposition | mitigate | `244-01-BUG-260911-02-TRACE.md:1-40` — verdict `NOT REPRODUCED BY THIS EXECUTOR — neither check could be run`, both attempted checks and their refusal reasons recorded verbatim. The report is **not** closed on a code reading. | closed |
| T-244-01-04 | Denial of service | unbounded `ScrollArea`, no viewport bound | mitigate | The four-link `min-h-0` chain is present: `ChatLayout.tsx:803,809` · `ChatArea.tsx:584` · `MessageList.tsx:219` (`ScrollArea className="min-h-0 flex-1"`). | closed |
| T-244-01-SC | Tampering | npm/pip/cargo installs | mitigate | `git diff --name-only 223b3ea4f HEAD` names **no** `package.json` / lockfile / `requirements.txt` / `pyproject` / `Cargo` file. Zero dependencies added. | closed |
| T-244-02-01 | Spoofing | `.pdf` extension, non-PDF bytes | mitigate | `workspace.py:197-208` `_pdf_magic_ok` → `raw[:5] == b"%PDF-"`, dispatched at `workspace.py:253-255` inside `validate_upload`; `.pdf` is its own category (`_PDF_EXT`, :138-143) so it cannot fall through to `_looks_like_text`. | closed |
| T-244-02-02 | Tampering | container path from a user filename | mitigate | `tool_dispatcher.py:1805-1831` `_attachment_container_path` — backslash normalise → `os.path.basename` → charset narrow to `[A-Za-z0-9._\- ]` → `lstrip(".")` → 120-char cap → fixed fallback. Used by BOTH readers (`tool_dispatcher.py:1893`, `agent_loop.py:1236`). | closed |
| T-244-02-03 | Elevation of privilege | **prompt injection** via filename into the system prompt | mitigate | `agent_loop.py:1173-1183` `_one_line` strips CR/LF + `\x00-\x1f`, collapses whitespace, deletes `` ` * _ # [ ] < > | `` and caps length; the announced name is derived from the already-narrowed container path (`agent_loop.py:1236-1237`) and emitted as exactly one `- ` bullet (`:1240`). | closed |
| T-244-02-04 | Information disclosure | prompt line leaking another thread's / user's files | mitigate | Route ownership gate first (`threads.py:777-782`, 404 on non-owner); the listing is `list_files_in_thread` keyed on `WHERE thread_id = $1` (`db/workspace.py:206,218`); the hydrator passes `ctx.thread_id` (`tool_dispatcher.py:1863`), never a client id. ⚠ See note N-2. | closed |
| T-244-02-05 | Denial of service | 10 MB × N hydration per `execute_code` | mitigate | Once-per-**session** marker `_hydrated_sessions` (`tool_dispatcher.py:1802`) checked at `:2049-2056` — re-homed from the per-iteration `ctx` by `244-07` (WR-02); file-count cap `_ATTACHMENT_HYDRATION_MAX_FILES = 50` (`:1779`, applied `:1867-1872`); `copy_to_runtime`, not a base64 preamble (`:1884`); 10 MB cap at the door. ⚠ Residual bound: 50 × 10 MB once per session. | closed |
| T-244-02-06 | Information disclosure | EXPIRED attachment resurfacing in prompt/sandbox | mitigate | One SQL gate, two readers: `db/workspace.py:207,219` — `(expires_at IS NULL OR expires_at > now())`. `agent_loop.py:1694` and `tool_dispatcher.py:1862` both consume that listing; neither adds a second expiry rule. | closed |
| T-244-02-07 | Repudiation | hydration failure silently dropping a file | mitigate | `tool_dispatcher.py:1897-1906` — per-file exception is logged AND appended to `notes`, surfaced in the tool result; the over-cap truncation is likewise named (`:1868-1871`). | closed |
| T-244-02-SC | Tampering | npm/pip/cargo installs | mitigate | Same measurement as `T-244-01-SC` — no manifest touched; the sandbox image tag is unchanged. | closed |
| **T-244-03-01** | **Elevation of privilege** | **unlocking the composer during a GENUINE harness run** | **mitigate** | ⛔ **PARTIAL — see OPEN-1.** `ChatArea.tsx:140` reads `workflowLock !== null && !workflowLock.capPaused`, but `capPaused` is ALSO set on the genuine-lock branch (`ChatArea.tsx:201-207`, `capPaused: state.cap_paused`), not only on the cap-paused branch (`:208-217`) the mitigation names. | **open** |
| T-244-03-02 | Tampering | an approval answerable twice | mitigate | ONE component in both homes — `MessageItem.tsx:544-547` mounts the shipped `PendingAskStack`, never a chat-native second renderer; one slice + one reconcile at `PendingAskCard.tsx:692`; the `runIsOver` two-conjunct guard is unchanged (`PendingAskCard.tsx:714`, `:427`). Server remains the authority. | closed |
| T-244-03-03 | Repudiation | chat/panel state divergence | mitigate | Structural, same citations as 03-02 (one slice, one reconcile, one component). ⚠ The both-directions **driven** row (`244-VALIDATION.md` L-4) is `⬜ owed` — structure is verified, behaviour is not. | closed |
| T-244-03-04 | Information disclosure | read bound exposing another thread's run row | mitigate | `threads.py:1117-1127` ownership gate (404 first); the new probe at `threads.py:1268-1276` is `WHERE thread_id = $1` executed through `_rls_fetchrow` (`:1137-1139`, `get_user_pg_connection` → `SET LOCAL ROLE authenticated`). No client-supplied run id. | closed |
| T-244-03-05 | Denial of service | 2 fetches × N message rows per render | mitigate | The mount is inside `isMessageStreaming && message.tool_calls?.length` (`MessageItem.tsx:504`) AND `hasPendingAsk(...)` (`:544`); `isMessageStreaming` is `message.runStatus === "streaming"` (`:408`), true for at most one row. | closed |
| T-244-03-06 | Tampering | second writer of `runs.status` drifting from `runs:active` | mitigate | Measured on the diff: `git diff 223b3ea4f HEAD -- backend/app` adds **no** `runs.status` write — every `cap_paused` hit in the added lines is a comment or the `SELECT` at `threads.py:1268-1281`. `continue_run` remains the sole clearer. | closed |
| T-244-03-SC | Tampering | npm/pip/cargo installs | mitigate | No manifest touched. | closed |
| T-244-04-01 | Spoofing | FALSE attention signal for a healthy source | mitigate | `attentionConditions.ts:177-190` — `const { stopped } = useSourceAttention()` mapped through untouched; `tab` is set from the producer's own key (`:185-189`), never from `source.cause`. No client-side verdict anywhere in the file. | closed |
| T-244-04-02 | Information disclosure | raw provider error string reaching the UI | mitigate | `attentionConditions.ts:183` — `detail: SENTENCE_FOR_CAUSE[source.cause](...)` from `sourceHealthVocabulary` (imported `:113`); the new field is typed `tab?: LibraryTab` (`:155`), a union that cannot carry free text. | closed |
| T-244-04-03 | Tampering | second writer of `libraryTab` | mitigate | Measured: `setLibraryTab` has exactly two call sites, both in `App.tsx` — the one-shot hand-off (`:180`) and the spend-on-navigate clear (`:195`, rule owned by `libraryTabAfterNavigate`). This phase adds neither. | closed |
| T-244-04-04 | Denial of service | a third `useSourceAttention()` reader multiplying the poll | mitigate | `git diff 223b3ea4f HEAD -- frontend/src` adds **no** `useSourceAttention(` call site (every `+` hit is a comment or a fence). Live call sites stay at three: `attentionConditions.ts:177`, `IngestionTab.tsx:181`, `SourcesAttentionSection.tsx:160`. Attribution is threaded as data. | closed |
| T-244-04-05 | Repudiation | `SURF-03` ticked on a code reading | mitigate | `BUG-260911-03` frontmatter reads `status: folded` / `verified_closed_by: null`; `244-VALIDATION.md:220-258` carries L-7 (a/b/c) as `⬜ owed`. Nothing is ticked on a unit test. | closed |
| T-244-04-SC | Tampering | npm/pip/cargo installs | mitigate | No manifest touched. | closed |
| T-244-05-01 | Spoofing | `accept=` treated as a security control | mitigate | The real gate is server-side `validate_upload` (`workspace.py:211-259`), called from the single writer `_persist_workspace_upload` (`:324`). The composer's `accept` is the shared constant (`MessageInput.tsx:798`), same as `TemplateUpload.tsx:62`. | closed |
| T-244-05-02 | Tampering | a re-typed extension list drifting from the server's | mitigate | One frontend source `workspaceAllowedExt.ts:30-54`; element-for-element equal to `workspace.py:129-143` (`_OOXML_EXT` / `_TEXT_EXT` / `_IMAGE_EXT` / `_PDF_EXT`), verified by reading both. Both `accept=` sites read `WORKSPACE_ACCEPT_ATTR`. ⚠ See note N-3 (`IN-07`). | closed |
| T-244-05-03 | Information disclosure | crafted filename rendered into the transcript | mitigate | `ChatAttachmentChip.tsx:215,228` — `truncate max-w-[140px]` on the name span in both arms; React text node, and no `dangerouslySetInnerHTML` in the file (only the docblock at `:37` naming its absence). | closed |
| T-244-05-04 | Denial of service | 10 MB+ upload from the composer | mitigate | Local door: pre-materialisation reject `workspace.py:289` (`file.size`), post-read `:322`, plus `FileTooLargeError` from `ws_write_file` (`:352-353`). Client adds no second cap. ⚠ The **cloud** door's copy of this is OPEN — see OPEN-3. | closed |
| **T-244-05-05** | **Repudiation** | **expired attachment vanishing from an old transcript** | **mitigate** | ⛔ **PARTIAL — see OPEN-2.** The `expired` arm exists and says `No longer available` (`ChatAttachmentChip.tsx:206-219`, `composerCopy.ts:97`), but the rows it renders come from a listing the SERVER already filters on expiry (`workspace.py:455`), so after expiry + reload the chip cannot render at all. | **open** |
| T-244-05-06 | Spoofing | UI implying the file is in the knowledge base | mitigate | Structurally true: the composer path writes only `workspace_files` (`workspace.py:301-357`) and mints no `documents` row. Copy: `composerCopy.ts:72,88` (`this chat only`) and `:85` (`cloudConfirm: "Attach"`, never `Import`); rendered at `ChatAttachmentChip.tsx:238`. | closed |
| T-244-05-SC | Tampering | npm/pip/cargo installs | mitigate | No manifest touched. | closed |
| T-244-06-01 | Elevation of privilege | writing into a Library folder the caller does not own | mitigate | Server: `ingest_splice.py:153-168` — folder existence 404 + `folder_check.data["user_id"] != user_id` → 403; `user_id` comes from `get_current_user` and the connection is resolved org-scoped (`connectors.py:1808-1815`). Client: the page's shipped predicate `LibraryPage.tsx:382` passed as a prop to `LibraryCloudImport.tsx:61`, never re-derived. | closed |
| T-244-06-02 | Tampering | silent root write when no destination chosen | mitigate | `models/connector.py:797` — `folder_id: LibraryFolderId`, i.e. `min_length=1` + `AfterValidator(_require_library_folder_id)` UUID check (`:133-155`) on an `extra="forbid"` base → FastAPI 422 before the handler. `connectors.py:1797-1803` documents the refusal as model-enforced and adds no root fallback. | closed |
| T-244-06-03 | Tampering | hand-rolled insert bypassing the splice | mitigate | `backend/app/api/workspace.py` imports neither `import_single_file` nor `ingest_splice` nor `mint_document_row` (grep: only the prose mention at `:379`). The Library route still calls `import_single_file` (`connectors.py:1812-1823`) as the only seam. | closed |
| T-244-06-04 | Information disclosure | disabled-connection failure masked as a generic 502 | mitigate | `connectors.py:1827-1841` — `except SourceConnectionDisabled` → 409, then `except HTTPException: raise` (added by `244-07`/WR-06 so deeper 403/404/409s keep their status), then the broad 502. Same ordering on the new workspace door (`workspace.py:404-419`). | closed |
| T-244-06-05 | Spoofing | chat cloud door quietly minting a Library row | mitigate | The composer posts to `POST /threads/{id}/workspace/files/from-connection` (`lib/api/documents.ts:93-101`, called at `useComposerAttachments.ts:125`), which lands in `workspace.py` — a module with no minter import (see 06-03). The negative is structural, not a positive-only test. | closed |
| T-244-06-06 | Information disclosure | untrusted provider filename/bytes entering thread or Library | mitigate | Workspace path: provider bytes go through the SAME `_persist_workspace_upload` (`workspace.py:420-427`) → `validate_upload` magic bytes, 10 MB cap, filename sanitiser (`:322-337`). Library path: unchanged splice (`connectors.py:1812-1823`). The filename also reaches the prompt through `_one_line` (see 02-03). | closed |
| **T-244-06-07** | **Denial of service** | **unbounded provider download** | **mitigate** | ⛔ **OPEN — see OPEN-3.** Egress half is closed (`adapters/google_drive.py:17`, `adapters/microsoft_graph.py:44` → `app.security.egress.send_pinned_http`). Size half is NOT: `workspace.py:400` awaits `fetch_cloud_file` with no bound, and the 10 MB cap is applied to `len(raw)` afterwards (`:322`). `import_service.py` carries no size check at all. | **open** |
| T-244-06-SC | Tampering | npm/pip/cargo installs | mitigate | No manifest touched. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Open Threats — detail

### OPEN-1 · `T-244-03-01` — the `capPaused` discriminator is set on BOTH branches (maps to `WR-07`)

**Declared mitigation:** *"The discriminator is `capPaused`, which is set only on the
`state.cap_paused` reconcile branch."*

**Measured at HEAD:** it is set on **two** branches.

```tsx
// ChatArea.tsx:201-207 — the GENUINE-LOCK branch
if (state.locked && !state.lock_is_stale && state.active_workflow_run_id) {
  streamActions.setWorkflowLockForThread(tid, { runId: …, mode: "harness",
    capPaused: state.cap_paused, … })     // ← the discriminator, on a real harness lock
```

`threads.py:1238` sets `cap_paused = run_status == "cap_paused"` from `workflow_runs.status`, and
`_TERMINAL_WORKFLOW_STATUSES` (`threads.py:1095`) does not contain `cap_paused` — so that state is
simultaneously `locked: true` and `cap_paused: true`, and `ChatArea.tsx:140` then evaluates
`workflowLocked === false`: **the composer unlocks during a genuine harness run.**

**Reachability:** latent. The review could not find a writer of `'cap_paused'` onto
`workflow_runs.status` (every located writer targets `runs.status`). ⛔ Do not close it as
unreachable — the value is schema-valid (`063_dual_mode_continue.sql:57`, added explicitly on BOTH
status columns) and is read as live by `db/workflows.py:1320`. D-244-08 asked for both conjuncts;
one shipped.

**Blast radius if it fires:** the composer lock is a client-side UX control — `POST
/threads/{id}/messages` has no `cap_paused` refusal (stated at `threads.py:1249-1251`), so this is
a UI-honesty/EoP-shaped defect, not a server privilege bypass.

**Tracked as:** `deferred-items.md` item 8. **Re-open trigger:** a plan naming `ChatArea.tsx`, or
the first writer of `'cap_paused'` onto `workflow_runs.status`.

### OPEN-2 · `T-244-05-05` — the expired chip cannot render after a reload

**Declared mitigation:** *"the chip must say `No longer available`, never disappear."*

**Measured at HEAD:** the arm exists (`ChatAttachmentChip.tsx:206-219`) and its state is derived,
not passed (`chatAttachmentState`, `:68-74`). But the rows it renders come from
`useWorkspaceFilesSnapshot` (`MessageItem.tsx:277` → `StreamsProvider.tsx:4016-4020`), whose slice
is filled by `getThreadWorkspaceFiles` (`lib/api/threads.ts:1106-1114`) → `GET
/threads/{id}/workspace/files`, and that route applies the expiry gate server-side:

```python
# workspace.py:455
.or_("expires_at.is.null,expires_at.gt." + _now_iso())   # D-06: exclude expired templates
```

So an expired attachment is **absent from the listing**, `attachmentsForMessage`
(`ChatAttachmentChip.tsx:177-185`) returns nothing for that row, and the chip **disappears** from
the old transcript — the exact repudiation the threat names. The `expired` arm is reachable only
within a live session whose slice was fetched before expiry.

**Not a new threat** — this is the declared mitigation failing to cover the path after a reload.
⚠ Related and separately tracked: `WR-08` (`deferred-items.md` item 9) — the transcript's
`Read <file>` line renders for Explorer/harness turns where no hydration happened, made
*worse-shaped* by `244-07`'s WR-03 fix.

### OPEN-3 · `T-244-06-07` — a new unbounded provider read (maps to `WR-04`)

**Declared mitigation:** *"the workspace cap is enforced before body materialisation. Assert no new
unbounded read is introduced."* A new unbounded read **was** introduced by this phase:

```python
# workspace.py:400 — inside the NET-NEW from-connection route
filename, raw, _mime = await fetch_cloud_file(conn, body.file_id)   # no size bound
…
# workspace.py:322 — the cap, applied AFTER the whole file is resident
if len(raw) > MAX_FILE_SIZE: raise HTTPException(422, "File too large…")
```

`import_service.py` contains no size check (grep for `max_file_size` / `len(raw)`: 0 hits), and
`fetch_cloud_file` (`import_service.py:274-292`) delegates straight to `adapter.read_file`. A
multi-GB pick from the person's own Drive is resident in a worker (`WORKER_COUNT=2`) before the
422. The **egress** half of the threat IS closed (`send_pinned_http`, both adapters).

⚠ Pre-existing on the Library path and **inherited by a new route whose docstring claims the guard
it does not have** (`workspace.py:383-384`). Also weakens the cloud half of `T-244-05-04`.

**Tracked as:** `deferred-items.md` item 7. **Re-open trigger:** a plan naming `workspace.py` or
`services/sources/import_service.py`. Fix: resolve the provider's declared size from the listing
the picker already rendered and refuse before `read_file`; stronger, a streaming read with a
running byte counter.

---

## Unregistered Flags

| ID | Flag | Source | Disposition verified here |
|----|------|--------|---------------------------|
| UF-1 | `new-endpoint` — `POST /threads/{id}/workspace/files/from-connection` | `244-06-SUMMARY.md` `## Threat Flags` | **WARNING, not a blocker.** Net-new surface absent from every plan's `<threat_model>`. Re-checked at HEAD: **auth** `_verify_thread_ownership` (`workspace.py:391`, 404 on non-owner) + org-scoped connection lookup (`:393-400`, 404 on cross-org, never 403); **content** provider bytes go through the shared `_persist_workspace_upload` (`:420-427`); **privilege** writes only `workspace_files`, cannot reach `documents` (no minter import); **error shape** disabled-connection arm precedes the broad handler (`:404-419`). ⛔ **It also carries OPEN-3** — the unbounded `fetch_cloud_file` at `:400` lives on this very route. |

No other `## Threat Flags` section declares new surface: `244-01`, `244-02`, `244-03`, `244-04`
and `244-07` all state **None** (verified by reading each); `244-05-SUMMARY.md` has **no
`## Threat Flags` section at all** — recorded as an omission, not read as "none".

---

## Notes carried from verification (not threats)

- **N-1 — every plan's closure is a self-verification.** `D-244-21` / `OV-SOLO-01` (Gemini
  unavailable). This audit is an independent re-derivation of the code, but no browser-driven row
  in `244-VALIDATION.md` has been driven (all `⬜ owed`), so behavioural claims for 03-03, 04-05
  and 05-05 rest on structure only.
- **N-2 — the hydrator is not kind-filtered.** `244-07` fixed `WR-01` in the ANNOUNCEMENT
  (`agent_loop.py:1226`, allow-list on `kind == "template_input"`) but `_hydrate_thread_attachments`
  (`tool_dispatcher.py:1862`) still copies every non-expired row — including agent-written
  `workspace_write` output — into a directory named `attachments`. Within-thread only, so it is
  **not** a `T-244-02-04` disclosure; it is a consistency wart. `deferred-items.md` item 11.
- **N-3 — `IN-07`.** The `accept=` lockstep fence sweeps `TemplateUpload.tsx` only, so a
  hand-typed `accept=` re-introduced in `MessageInput.tsx` would be invisible to it. The SHIPPED
  code reads the shared constant (`MessageInput.tsx:798`), so `T-244-05-02` is closed on code —
  but the guard protecting it is narrower than the surface.
- **N-4 — `_output_baseline_seeded`** (`tool_dispatcher.py:1996-1999`) still stores its flag on the
  per-iteration `ctx`, which is the exact bug `244-07` fixed one guard below it. Left deliberately
  (different claim, different cadence). `deferred-items.md` item 12. No register threat depends on
  it; `T-244-02-05` is closed on the WeakSet, not on this.

---

## Accepted Risks Log

No accepted risks. Every threat in this register carries disposition `mitigate`; the three open
rows are gaps in declared mitigations, **not** accepted risk, and none has been signed off by the
operator as accepted.

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| — | — | — | — | — |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-12 | 41 | 38 | 3 | `gsd-security-auditor` (Claude, solo — no independent reviewer available, D-244-21) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log (none)
- [ ] `threats_open: 0` confirmed — **NO: 3 open** (`T-244-03-01`, `T-244-05-05`, `T-244-06-07`)
- [ ] `status: verified` set in frontmatter

**Approval:** pending — three declared mitigations are incomplete. Each is already registered in
`deferred-items.md` with a re-open trigger (items 7, 8, and the 05-05 gap named here for the first
time); closing them requires either implementation or an explicit operator-signed accepted-risk
entry above, then a re-run of `/gsd:secure-phase`.

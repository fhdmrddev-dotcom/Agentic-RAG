---
phase: 244-the-chat-shell-and-the-composer
slug: the-chat-shell-and-the-composer
status: verified
threats_total: 42
threats_closed: 42
threats_open: 0
asvs_level: 1
created: 2026-09-12
base_commit: 223b3ea4f
head_commit: e79fbabd0
---

# Phase 244 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> **Verification method:** every `mitigate` disposition was re-checked against the CURRENT tree —
> first at `144015cdd` after the `244-07` fix round, then again at `e79fbabd0` after the `244-08`
> defect round closed the last three. No verdict rests on a test assertion — each CLOSED row cites
> the mitigating CODE. Rows the prior code review had already looked at were re-derived rather
> than inherited.

⚠ **COUNT DISCREPANCY, RECORDED NOT SILENTLY RESOLVED.** The audit brief states **40** threats.
The six `<threat_model>` blocks carry **41** rows — 35 register rows (01×4, 02×7, 03×6, 04×5,
05×6, 06×7) plus **6** `T-244-0N-SC` supply-chain rows, one per plan. All 41 are verified below;
the totals in the frontmatter were the measured 41, not the quoted 40.

⚠ **NOW 42**, and the extra row is not an accounting change: `244-08` registered
**`T-244-UF-1`** — the net-new `from-connection` route that appeared in no plan's
`<threat_model>` and that carried `T-244-06-07`. It is a row of its own precisely so the count
records that a threat surface once had none.

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
| T-244-03-01 | Elevation of privilege | unlocking the composer during a GENUINE harness run | mitigate | ✅ **CLOSED by `244-08`** (`d76b252a8`). `ChatArea.tsx:226` — the genuine-lock branch now sets `capPaused: false`, so the discriminator read at `ChatArea.tsx:140` is satisfied only from the `state.cap_paused` reconcile branch (`:229-238`), which is the declared mitigation verbatim. Fail-closed by choice, not deleted as unreachable — the reason is recorded at `ChatArea.tsx:205-223`. Fenced by case 5 of `ChatArea.capPausedComposer.test.tsx`, RED at `79cd5ba44` with `expected true to be false`. | closed |
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
| T-244-05-05 | Repudiation | expired attachment vanishing from an old transcript | mitigate | ✅ **CLOSED by `244-08`** (`8b6887a2a`). `workspace.py:475-528` — opt-in `include_expired`; `lib/api/threads.ts:1120-1123` and both slice-fillers (`StreamsProvider.tsx:4052` via `:3999`, and `:1302`) ask for it, so the `expired` arm at `ChatAttachmentChip.tsx:206-219` is reachable after a reload. A TOMBSTONE, not a resurrection: the content route keeps its gate (`workspace.py:558`), the hydrator reads the OTHER listing (`db/workspace.py:207,219`, untouched), and the panel filters expired rows back out (`StreamsProvider.tsx:4045`). ⚠ Three limits deferred — `deferred-items.md` item 14. | closed |
| T-244-05-06 | Spoofing | UI implying the file is in the knowledge base | mitigate | Structurally true: the composer path writes only `workspace_files` (`workspace.py:301-357`) and mints no `documents` row. Copy: `composerCopy.ts:72,88` (`this chat only`) and `:85` (`cloudConfirm: "Attach"`, never `Import`); rendered at `ChatAttachmentChip.tsx:238`. | closed |
| T-244-05-SC | Tampering | npm/pip/cargo installs | mitigate | No manifest touched. | closed |
| T-244-06-01 | Elevation of privilege | writing into a Library folder the caller does not own | mitigate | Server: `ingest_splice.py:153-168` — folder existence 404 + `folder_check.data["user_id"] != user_id` → 403; `user_id` comes from `get_current_user` and the connection is resolved org-scoped (`connectors.py:1808-1815`). Client: the page's shipped predicate `LibraryPage.tsx:382` passed as a prop to `LibraryCloudImport.tsx:61`, never re-derived. | closed |
| T-244-06-02 | Tampering | silent root write when no destination chosen | mitigate | `models/connector.py:797` — `folder_id: LibraryFolderId`, i.e. `min_length=1` + `AfterValidator(_require_library_folder_id)` UUID check (`:133-155`) on an `extra="forbid"` base → FastAPI 422 before the handler. `connectors.py:1797-1803` documents the refusal as model-enforced and adds no root fallback. | closed |
| T-244-06-03 | Tampering | hand-rolled insert bypassing the splice | mitigate | `backend/app/api/workspace.py` imports neither `import_single_file` nor `ingest_splice` nor `mint_document_row` (grep: only the prose mention at `:379`). The Library route still calls `import_single_file` (`connectors.py:1812-1823`) as the only seam. | closed |
| T-244-06-04 | Information disclosure | disabled-connection failure masked as a generic 502 | mitigate | `connectors.py:1827-1841` — `except SourceConnectionDisabled` → 409, then `except HTTPException: raise` (added by `244-07`/WR-06 so deeper 403/404/409s keep their status), then the broad 502. Same ordering on the new workspace door (`workspace.py:404-419`). | closed |
| T-244-06-05 | Spoofing | chat cloud door quietly minting a Library row | mitigate | The composer posts to `POST /threads/{id}/workspace/files/from-connection` (`lib/api/documents.ts:93-101`, called at `useComposerAttachments.ts:125`), which lands in `workspace.py` — a module with no minter import (see 06-03). The negative is structural, not a positive-only test. | closed |
| T-244-06-06 | Information disclosure | untrusted provider filename/bytes entering thread or Library | mitigate | Workspace path: provider bytes go through the SAME `_persist_workspace_upload` (`workspace.py:420-427`) → `validate_upload` magic bytes, 10 MB cap, filename sanitiser (`:322-337`). Library path: unchanged splice (`connectors.py:1812-1823`). The filename also reaches the prompt through `_one_line` (see 02-03). | closed |
| T-244-06-07 | Denial of service | unbounded provider download | mitigate | ✅ **CLOSED by `244-08`** (`085a57fe9`). `workspace.py:416` — `fetch_cloud_file(conn, body.file_id, max_bytes=MAX_FILE_SIZE)`; `import_service.py:303` threads it; `sources/base.py:104-127` `clamp_read_cap` is the ONE home for the clamp (a caller may only TIGHTEN the operator ceiling). Drive (`google_drive.py:322,358,373`) and Graph (`microsoft_graph.py:419`) hand it to `send_pinned_http`, which refuses a declared over-cap length BEFORE reading and abandons the wire read past it. `EgressResponseTooLarge` → 422 (`workspace.py:433-434`), never the provider 502. ⚠ The audit's "multi-GB" framing was measured OVERSTATED — see OPEN-3's correction. | closed |
| T-244-06-SC | Tampering | npm/pip/cargo installs | mitigate | No manifest touched. | closed |
| **T-244-UF-1** | Multiple (spoofing · EoP · info disclosure · DoS) | `POST /threads/{id}/workspace/files/from-connection` — **retroactively registered by `244-08`** | mitigate | ⚠ **REGISTERED LATE, AND THE LATENESS IS THE POINT — not folded into a neighbouring row.** This route is net-new surface that appeared in NO plan's `<threat_model>`, and it is the route that carried `T-244-06-07`. Four dispositions, each verified in code: **auth** `_verify_thread_ownership` (`workspace.py:389`, 404 on non-owner) + org-scoped connection lookup (`:391-398`, 404 on cross-org, never 403); **content** provider bytes go through the shared `_persist_workspace_upload` (`:444`, defined `:303`) — magic bytes, 10 MB cap, filename sanitiser; **privilege** writes only `workspace_files` and imports no minter, so it cannot reach `documents` (`T-244-06-03`/`06-05`); **error shape** the disabled-connection 409 and the size 422 both precede the broad 502 (`:420-441`); **size** now capped before materialisation (`:416`). | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Closed Threats — detail (these three were OPEN-1, OPEN-2 and OPEN-3)

⭐ **Closed by `244-08`, 2026-09-12.** The original findings are preserved verbatim under each
heading rather than deleted — a register that erases what it once said cannot be audited, and
**two of the three findings turned out to be partly WRONG**, which is only visible if the
original is still there to read.

Full evidence, RED drives and gate readings: **`244-08-SUMMARY.md`**.

---

### ✅ CLOSED-1 · `T-244-03-01` — the `capPaused` discriminator now lives on ONE branch

**Was OPEN-1 (maps to `WR-07`).** *Original finding, unaltered:* the discriminator was set on
**two** branches, so a run that is simultaneously `locked: true` and `cap_paused: true` made
`ChatArea.tsx:140` evaluate `workflowLocked === false` — **the composer unlocking during a
genuine harness run.**

**The finding was CORRECT and is fixed at `d76b252a8`.** `ChatArea.tsx:226` sets
`capPaused: false` on the genuine-lock branch; the reconcile branch at `:229-238` remains the
only producer of a `true`. That is `244-03`'s declared mitigation word for word.

⛔ **Fail-closed by choice, not deleted as unreachable.** OPEN-1's instruction — *"do not close
it as unreachable"* — was honoured: the state is still latent (no writer of `'cap_paused'` onto
`workflow_runs.status` has been found) but remains schema-valid and non-terminal, so the fence
CONSTRUCTS it rather than waiting for a writer.

⭐ **Why a green fence coexisted with the defect, which is the transferable part.**
`ChatArea.capPausedComposer.test.tsx`'s `HARNESS_LOCKED_STATE` sets `cap_paused: false`, so all
five shipped cases read the discriminator on a run that is locked **OR** paused — **never one
that is BOTH.** The missing case was a missing STATE, not a missing assertion.

---

### ✅ CLOSED-2 · `T-244-05-05` — the expired chip is reachable after a reload

**Was OPEN-2.** *Original finding, unaltered:* the `expired` arm existed but its rows came from
a listing the server filtered on expiry, so after expiry + reload the chip could not render at
all.

**The finding was CORRECT and is fixed at `8b6887a2a`** with an opt-in `include_expired`.

⚠ **ONE ASSUMPTION IN THE BRIEF WAS MEASURED WRONG, and it decided the shape of the fix.** The
instruction said *"`db/workspace.py:207,219` is ONE SQL expiry gate with TWO readers"* and
warned against opening the hydrator's gate while fixing the renderer's. **There are TWO
independent gates, in different modules, and the renderer never read the one named:**

| gate | readers | this round |
|---|---|---|
| `db/workspace.py:207,219` — asyncpg `list_files_in_thread` | sandbox hydrator (`tool_dispatcher.py:1862`) **and** prompt announcement (`agent_loop.py:1694`) | ⛔ **UNTOUCHED** |
| `workspace.py:530` — the supabase REST listing | panel **and** transcript, through ONE store slice | ⭐ opt-in widening |

Constraint **(a)** — *a tombstone, not a resurrection* — therefore holds in three independent
places: the content route keeps its gate (`workspace.py:558`), the hydrator reads the other
listing entirely, and the PANEL filters expired rows back out
(`StreamsProvider.tsx:4045`) so no preview is ever offered for one. A fence in
`test_244_08_expired_attachment_is_a_tombstone.py` refuses an `include_expired` ever appearing
in `db/workspace.py`, and was **driven RED against a planted gate removal**.

⛔ **What is NOT closed, and is deferred rather than claimed** — `deferred-items.md` item 14:
the detach registry is still session-scoped with no DELETE route; nothing re-fetches when a file
expires *while a tab stays open* (worst case an optimistic label — the content route still
404s); `useResolvedFileId` deliberately stays on the gated default.

---

### ✅ CLOSED-3 · `T-244-06-07` — the cloud door reads under its own 10 MB cap

**Was OPEN-3 (maps to `WR-04`).** *Original finding, unaltered:* the route awaited
`fetch_cloud_file` with no bound and the 10 MB cap was applied to `len(raw)` afterwards.

**That half was CORRECT and is fixed at `085a57fe9`.**

⚠ ⚠ **BUT THE SEVERITY WAS OVERSTATED, AND THE ORIGINAL SENTENCE IS KEPT ABOVE RATHER THAN
CORRECTED IN PLACE.** OPEN-3 states *"A multi-GB pick from the person's own Drive is resident in
a worker (`WORKER_COUNT=2`) before the 422."* **Measured false.** `send_pinned_http`
(`egress.py:830-852`) already refused a declared over-cap `content-length` **before a single
body byte was read**, then streamed with a running counter and abandoned the read past
`max_bytes` — and both first-party adapters already passed `max_bytes=source_max_file_bytes()`.

So the real residency bound was **the operator's source ceiling: 1–50 MB, default 25**
(`user_settings.py:1227-1242`). The gap was **2.5–5× the declared cap**, not unbounded.

⭐ **This mattered.** OPEN-3 prescribed *"a streaming read with a running byte counter"* as the
stronger fix — **that already existed.** What was missing was a way for a caller with a tighter
ceiling to SAY so. The fix is therefore a parameter, not a rewrite: `read_file` gains an
optional `max_bytes`, and `sources/base.py:104` `clamp_read_cap` is the ONE home for
`min(request, operator ceiling)` so a caller can only ever TIGHTEN.

⚠ **One family is asymmetric and it is stated, not hidden.** `mcp_source` enforces the cap
**after decode** — a file arrives base64 inside a JSON-RPC envelope, so no prefix of the
response means *"the file is this big"*. Residency there stays bounded by
`mcp_max_body_bytes()`, derived one-way from the same ceiling. **No envelope knob was added**
(SEED-258). `mock_source` accepts and does not enforce, and says so: it has no transport.

**Does this strengthen the cloud half of `T-244-05-04`?** **Yes, by exactly the measured
amount.** The cloud door's residual drops from *"up to the operator ceiling, 25 MB default"* to
*"10 MB"* for Drive, Graph and Gmail. ⚠ It does **not** become identical to the local door for
MCP, whose bound remains the envelope cap.

---

## Unregistered Flags

| ID | Flag | Source | Disposition verified here |
|----|------|--------|---------------------------|
| UF-1 | `new-endpoint` — `POST /threads/{id}/workspace/files/from-connection` | `244-06-SUMMARY.md` `## Threat Flags` | ⭐ **RETROACTIVELY REGISTERED by `244-08` as `T-244-UF-1`** — a row of its own in the register above, **never folded into a neighbouring row**, because the whole finding is that this surface was absent from every plan's `<threat_model>` and folding it in would erase that. Original verdict preserved: **WARNING, not a blocker.** All four dispositions were re-verified at HEAD (`workspace.py:389` auth · `:391-398` org scope · `:444` shared content gate · `:420-441` error ordering) and a fifth was ADDED — the size cap at `:416`, which is `T-244-06-07`'s fix and which lived on this very route. |

No other `## Threat Flags` section declares new surface: `244-01`, `244-02`, `244-03`, `244-04`
and `244-07` all state **None** (verified by reading each); `244-05-SUMMARY.md` has **no
`## Threat Flags` section at all** — recorded as an omission, not read as "none".

⛔ **`244-08` DID NOT BACK-FILL IT, deliberately.** Writing a `## Threat Flags` section into a
summary after the fact would make that summary claim a check its author never ran. The omission
stays an omission; what `244-08` owed was the missing REGISTER entry (`T-244-UF-1` above), and
that is where it was paid.

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

No accepted risks. Every threat in this register carries disposition `mitigate`, and as of
`244-08` every one of them is **closed on code**. The three rows that were open were gaps in
declared mitigations — **never** accepted risk — and none was ever signed off by the operator as
accepted. They were implemented, not waived.

⚠ **The unfinished work that remains is DEFERRED, not ACCEPTED**, and it lives where deferrals
live: `deferred-items.md` items 14 (three named limits of the tombstone fix), 15 (three inherited
red suites outside the count gate) and 16 (another writer was active in the tree during the
round). A deferral carries a re-open trigger; an accepted risk carries an operator's name. None
of these has one, so none of them belongs in the table below.

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| — | — | — | — | — |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-12 | 41 | 38 | 3 | `gsd-security-auditor` (Claude, solo — no independent reviewer available, D-244-21) |
| 2026-09-12 | 42 | 42 | 0 | `244-08` defect round (Claude, solo — ⚠ the same agent that wrote the fixes, so this row is a SELF-VERIFICATION; see N-1) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log (none)
- [x] `threats_open: 0` confirmed — `T-244-03-01`, `T-244-05-05` and `T-244-06-07` are each
      closed on CODE, with a file:line citation in the register and a RED-driven fence
- [x] `status: verified` set in frontmatter

**Approval:** the three declared mitigations are now implemented. ⛔ **Two qualifications, stated
rather than buried, because a gate that cannot fail is worthless:**

1. ⚠ **This is a SELF-VERIFICATION.** `244-08` wrote the fixes AND flipped these rows, and no
   independent reviewer exists (`D-244-21` / `OV-SOLO-01`). `N-1` stands unchanged.
2. ⚠ **`threats_open: 0` is a CODE verdict, not a DRIVEN one.** Every row in
   `244-VALIDATION.md` is still `⬜ owed` — including the one natural UAT for `T-244-05-05`
   (attach → wait out the TTL → reload → read the chip) and any live cloud pick that would
   exercise `T-244-06-07`'s cap against a real provider. **A closed register row means the
   mitigating code was read and fenced; it does not mean anybody watched it work.**

⭐ **What `244-08` measured WRONG in this document and corrected beside the original:** OPEN-3's
*"multi-GB resident"* severity (the real bound was the 25 MB operator ceiling, because the
streaming counter OPEN-3 prescribed already existed), and the brief's *"ONE SQL expiry gate with
TWO readers"* (there are two independent gates, and the renderer never read the one named).
Both originals are preserved above.

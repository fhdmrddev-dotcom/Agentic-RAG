---
phase: 296
slug: close-v4-7-debt
status: verified
threats_open: 0
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
diff_base: 27f1cdf9b
audited_at_head: 01546a07d
created: 2026-10-27
---

# Phase 296 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register: the seven `296-0{1..7}-PLAN.md` `<threat_model>` STRIDE tables, 44 rows (T-296-01..44).
> Every `mitigate` row was checked against the CURRENT code on `develop` (HEAD `01546a07d`), not
> against SUMMARY claims. File:line references are to that HEAD.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| browser → API (`X-Org-Id`) | untrusted org claim; only a membership-validated value may reach an INSERT | org id (tenancy) |
| colleague viewer → evidence read | non-owner reads of a run whose steps cite documents the viewer cannot read | step output, citations (confidential) |
| signup → `handle_new_user` (SECURITY DEFINER) | elevated function at `auth.users` insert | email (PII) |
| user → citation-check route → paid engine | each call can spend provider money | cost |
| test process → shared local DB | a TestClient lifespan could claim and re-drive a live run | run state |
| server boot → paused runs | the sweep decides whether a person's pending question is re-asked | run state |
| exception text → HTTP response | schedule trigger / delete errors may carry internals | internals |
| author files → describe parser / drafting model / judge | untrusted PDFs/Office text parsed server-side and read by models | untrusted text |
| rerank engine → LangSmith | span inputs/outputs leave the process | query, model object |
| server/model text → browser DOM | step outputs, reasons, notes, sentences rendered in chat, report, builder | untrusted text / HTML |
| outside caller → `/inbound` | unauthenticated-until-key bytes, file tokens, launch answers | untrusted bytes |
| tool schemas → Moonshot endpoint | provider-specific schema transform | tool definitions |
| board script → local stack; evidence → git | test writes; evidence must carry no credential | credentials |
| orchestrator → production Supabase | reads free, writes approval-gated | production data |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-296-01 | Tampering / Info disclosure | `api/folders.py`, `api/workflows.py` create | mitigate | `create_folder` stamps `row["org_id"]` only from `resolve_active_org_or_none` (`folders.py:62,94-95`); `create_draft` passes `org_id=UUID(_active_org) if _active_org else None` (`workflows.py:1216-1220`). The resolver checks membership on the caller's RLS connection (`dependencies.py:1044-1055`, `org_members ... user_id = auth.uid()`); a non-member/absent header → `None` → no key. Tests: `test_296_create_org_stamp.py` (9 cases), `tests/integration/test_296_two_org_create.py`. Live: G-4 scenario 1 PASS (`evidence/g4/1-two-org-db.json`). | closed |
| T-296-02 | Elevation | `create_folder` `parent_id` | mitigate | `folders.py:66-67`: `if parent is None or (_active_org and str(parent.get("org_id")) != _active_org): raise 404 "Parent folder not found"`. Test: `test_create_folder_refuses_a_parent_in_another_org`. Note: with no active org the plan deliberately keeps the pre-296 path (`test_create_folder_without_an_active_org_keeps_any_visible_parent`). | closed |
| T-296-03 | Info disclosure | `run_evidence.compose_phase_log` | mitigate | `run_evidence.py:287-292`: non-owner + a citation outside `readable_ids` → `WITHHELD_OUTPUT_SENTENCE`, sets `withheld_upstream`; every later step → `WITHHELD_UPSTREAM_SENTENCE` (`:96-97`). Owner path: `readable=None` (`workflow_run_evidence.py:341-342`). RLS failure → empty set → every citing step withheld (`:272-275`, fail closed). Tests: `test_289_run_evidence.py::test_a_colleague_gets_every_later_step_withheld_once_one_is`, `::test_a_human_input_step_never_starts_the_cascade`. Live: G-4 scenario 2 PASS as same-org colleague `s296-g4-colleague@example.test` (`evidence/g4/2-colleague.jpg`; "Weekly reports" 0 hits). | closed |
| T-296-04 | DoS / input validation | `run_evidence` cited-id `uuid[]` cast | mitigate | `_CANONICAL_UUID` + `is_canonical_uuid` (`run_evidence.py:103-110`), applied in `cited_document_ids` (`:398`) and again before the cast in `_viewer_reads` (`workflow_run_evidence.py:263`); dropped ids are never in `readable` → masked. Test: `test_289_run_evidence.py::test_a_malformed_cited_id_does_not_mask_the_readable_ones`. | closed |
| T-296-05 | Info disclosure | `handle_new_user` org name | mitigate | `supabase/migrations/216_neutral_default_org_name.sql:45-46` → `create_org_with_default_dept('My organization', NULL, 'General')`; verify SELECT asserts `NOT LIKE '%new.email%'`. Supplement copy in sync (`scripts/full-schema-supplement.sql:206`; `full-schema.sql:572,10573`). Tests: `test_296_migration_shape.py::test_216_org_name_has_no_email`, `::test_supplement_copy_uses_the_constant_name`. Live: colleague signup org read `My organization` (G-4 scenario 2). | closed |
| T-296-06 | Elevation | `handle_new_user` privileges | mitigate | Mig 216 is `CREATE OR REPLACE` only (ACL preserved); `full-schema.sql:11013-11016` keeps `REVOKE ... FROM PUBLIC/anon/authenticated`, `GRANT ... TO service_role`. `node scripts/check-schema-acl-parity.cjs` re-run by this audit: **exit OK** ("schema ACL parity OK"). `check-greenfield-privileges.py` (needs a DB) not re-run here; recorded as passing in 296-05 SUMMARY and in 296-REVIEW "Verified sound: Migration 216". Test: `test_216_keeps_definer_search_path_and_swallow`. | closed |
| T-296-07 | DoS / cost | `api/citation_checks.py` | mitigate | `citation_checks.py:162-164` calls `enforce_user_citation_limit` BEFORE the in-flight `SET NX` (`:168`). `rate_limit.py:123-137`: 429 `rate_limited` + `Retry-After`; any Redis exception → 503 `unavailable` (fail closed). Test: `test_296_citation_rate_limit.py`. | closed |
| T-296-08 | Tampering | mig 215 backfill | mitigate | `215_api_keys_and_run_origin.sql:133`: `AND wr.inputs->>'_schedule_id' ~* '^[0-9a-f]{8}-...-[0-9a-f]{12}$'` before the `::uuid` casts (`:126,128`). Test: `test_296_migration_shape.py::test_215_backfill_regex_is_canonical`. | closed |
| T-296-09 | Info disclosure | inbound `final_output_text` (key owner's API) | accept | See Accepted Risks AR-01. | closed |
| T-296-10 | Tampering (XSS) | `RunEvidenceReport` step output | mitigate | `RunEvidenceReport.tsx:342` renders only via `<MarkdownRenderer ... noRemoteMedia />`; `MarkdownRenderer.tsx:40-42` → `DOMPurify.sanitize(marked.parse(...), NO_REMOTE_MEDIA)`. Test: `RunEvidenceReport.test.tsx:464` (`<script>window.__pwned</script>` removed). **FE-WR-02 (post-plan) VERIFIED fixed** (`d3cc34ddb`): `NO_REMOTE_MEDIA` (`MarkdownRenderer.tsx:11-19`) is an allow-list — no img/picture/source/video/audio/iframe/svg/input/style, attrs limited to `href,title,align,start,class`, `ALLOW_DATA_ATTR:false`; chat keeps the default. Test: `MarkdownRenderer.noRemoteMedia.test.tsx` (3 cases). Both suites re-run by this audit: pass. | closed |
| T-296-11 | Info disclosure | evidence copy to colleagues | mitigate | Neutral `NO_MATCH_EXPLANATION` (`evidenceVocabulary.ts:50-51`) and `UNSOURCED_NOTE` (`:196-197`) — no "your documents". Withheld sentences are server constants rendered through the same sanitised renderer. | closed |
| T-296-12 | Repudiation / integrity | schedule Run now result | mitigate | `WorkflowScheduleModal.tsx:127-133` builds a row-local line from `outcome`/`detail`; rendered as React text `{runResult.text}` (`:434`); 0 `dangerouslySetInnerHTML` in the file. Server side see T-296-17. | closed |
| T-296-13 | DoS (client) | `ArtifactTooltip` scroll listeners | mitigate | `ArtifactTooltip.tsx:92` rAF throttle; cleanup `removeEventListener("scroll"/"resize")` + `cancelAnimationFrame` (`:100-102`), keydown cleanup (`:112`). Test: `ArtifactTooltip.test.tsx:100-149` (re-run: pass). | closed |
| T-296-14 | Info disclosure | reload-free reconcile | accept | See Accepted Risks AR-02. Verified the claim: `StreamsProvider.tsx:1912-1915` calls the store's existing `reconcile(threadId)` (the thread-open read), only for the viewed thread; no new endpoint. | closed |
| T-296-15 | Tampering / integrity | `main.py` boot sweeps under TestClient (SEED-363) | mitigate | `main.py:44` `RUN_BOOT_SWEEPS = True`; guards at `:415,:439,:495`; `tests/conftest.py:62` sets it `False`. No env var added (grep of deploy artifacts: none). Test: `test_296_lifespan_no_sweeps.py` (re-run: pass). | closed |
| T-296-16 | Integrity | `resume_stranded_workflows` human-input arm | mitigate | `harness_engine.py:2771-2779`: classified by the DEFINITION (`_active_spec(...).config.phase_type == "llm_human_input"`); latest prompt unanswered → `pause_run` + `continue` (lease released); answered → `ctx.resume_answered_tool_call_id = str(_hi_tcid)` (`:2823-2824`). Dead `active["config"]` branch deleted (`:2745-2749`). Test: `test_296_boot_sweep_human_ask`. Live: G-4 scenario 4 PASS across a uvicorn restart (prompts stayed 1). | closed |
| T-296-17 | Info disclosure | `api/schedules.py` trigger | mitigate | `schedules.py:282-285`: raw exception goes to `logger.error` only; wire carries `_TRIGGER_ERROR`. The `ScheduledLaunchRefused` arm (`:278-281`) forwards only our own worded sentences (`scheduler_service.py:122-132` `template_refusal`, `:215` `WORKFLOWS_DISABLED_DETAIL`). Test: `test_296_schedule_trigger_words.py::test_an_unexpected_error_never_puts_its_text_on_the_wire` (re-run: pass). | closed |
| T-296-18 | Repudiation | run stop record (295-RES-b) | mitigate | Stopper rides the cancel broadcast (`run_lifecycle.py:121-142`, sibling key set BEFORE the flag). `record_stop` (`run_handoff.py:423-444`) writes only when `_claim_terminal(...)` wins (first-writer-wins CAS); name via `_stopper_words` (`:409-420`) = profile display name, `viewer_email=None`. Callers: `run_lifecycle.py:572`, `run_producer.py:389`. Live: G-4 scenario 3 panel `continued by fhdmrd@gmail.com (you)` (owner self-view). | closed |
| T-296-19 | DoS | 289-WR-06b retry | mitigate | `runs.py:784-785` spawns `_redrive_after_lease` only when `_retry`; it re-calls with `_retry=False` (`:699-704`) — one retry, no loop; held reference in `_BACKGROUND_TASKS` (`:687-696`). Test: `test_296_run_ends_truthfully.py::test_a_lost_claim_retries_once_after_the_lease_and_never_loops`. | closed |
| T-296-20 | Elevation | judge note (295-IN-08) | mitigate | `validator_kinds.py:250-262` `recording_by_design`: True only for a golden run or `live_connectors` not `everyone`; on a live run a recorded step means a MISSING grant → `judge_system_prompt(by_design=False)` drops the excusing note (`:265-279`, wired at `:700`). Implemented as the executor's own by-design predicate rather than a direct grant read; equivalent for the declared threat (a missing grant is never excused). Review BE-IN-01 (audience freshness) is informational. Test: `test_296_judge_note_and_tasks.py` (re-run: pass). | closed |
| T-296-21 | DoS | `describe_files` PDF extraction (291-WR-07) | mitigate | `describe_files.py:78` `DESCRIBE_PDF_MAX_PAGES = 50`, `:83` `DESCRIBE_PDF_MAX_BYTES = 10 MiB`; byte check before open (`~:592`), `pdf.pages[:n]` single read (`~:610`), `_first_pages` cut for the classifier. Test: `test_296_describe_files.py` (pins the byte cap equal to the upload cap; re-run: pass). | closed |
| T-296-22 | Tampering (prompt injection) | restated requirement (291-S2-F2) | mitigate | `workflow_authoring.py:1179-1187`: with files supplied, `business_requirement = describe.strip() or None` — structural; file text never enters the graded requirement. | closed |
| T-296-23 | Spoofing | golden-run recipients | mitigate | `publish_service.py:1573` address-like keys → `golden-run-placeholder-{key}@example.invalid`; RFC 2606 rationale at `:1698`. | closed |
| T-296-24 | Info disclosure | rerank span inputs (294-IN-01) | mitigate | `rerank_engines/local.py:129-136`: `_score` takes `model_name: str` and resolves the model inside; `process_inputs=redact_inputs` on every engine (`cohere.py:28`, `jev.py:113`, `local.py:129`, `openai_decisions.py`). Test: `test_296_rerank_and_claims.py` (re-run: pass). | closed |
| T-296-25 | DoS | local rerank inference (294-LOCAL) | mitigate | `registry.py:53` `LOCAL_INFERENCE_TIMEOUT_S = 30.0`; `local.py:163-180` worker thread + `join(timeout_s)` → `LocalInferenceTimeout`, which the dispatcher treats as today's-order fallback. Residual (informational): an abandoned daemon thread finishes on its own. | closed |
| T-296-26 | Repudiation | provider-failure wording (291-S1-copy b) | accept | See Accepted Risks AR-03. Verified: `workflow_authoring.py:938-949` returns a fixed `"The drafting model's provider turned the request down."`, no provider text. | closed |
| T-296-27 | Tampering / input validation | kickoff sites (287-T01) | mitigate | `workflow_kickoff.py:263-267`: `missing_required(...)` → 422 before any INSERT (called first by `threads.py:1849`); key path `inbound_inputs.py:211` via `validate_inbound_inputs`. One predicate (`inbound_inputs.py:138-160`), parity fixture `backend/tests/fixtures/phase293/launch_fields_cases.json`. Test: `test_296_kickoff_and_keys.py` preflight 422 (re-run: pass). | closed |
| T-296-28 | DoS | `/inbound` POST body (293-IN-03) | mitigate | `inbound.py:83-101` `_BodyCapRoute`: `Content-Length` > `INBOUND_MAX_BODY_BYTES` (`inbound_inputs.py:37`) → 413 before the handler/body read; router `route_class=_BodyCapRoute` (`:104`). Declared mitigation is present. Chunked-body residual (BE-WR-02) is accepted: AR-05 — **read its warning**. | closed |
| T-296-29 | DoS / integrity | file-token GET (293-IN-01) | mitigate | `inbound.py:621-625` PEEK (`redis.get`), key/live checks, `_limit(...)` (`:657`), THEN `MULTI GET+DEL` with `consumed != raw` compare (`:658-663`) — a 429/503/refusal never burns the link; a race loses cleanly. Tests: 429/503 leave-token cases in `test_296_kickoff_and_keys.py`. | closed |
| T-296-30 | Elevation | `create_key` scope (293-IN-06) | mitigate | `api_keys.py:273-317`: refused unless in `list_startable_candidates` (the picker's own query) → 422; drafts, file-upload and `needs_typed_task` refused. Tests: create refusals for `needs_task` and globals. (Review BE-WR-03 is an over-refusal, fail-closed, not a security gap.) | closed |
| T-296-31 | Repudiation | key revoke audit (293-IN-08) | mitigate | `db/api_keys.py:189-191` `revoked_now = status == "UPDATE 1"`; audit only `if row.get("revoked_now")` (`api_keys.py:369,412`). Test: single audit row on re-revoke. | closed |
| T-296-32 | Tampering (prompt injection) | first-step launch answers (291-S6-F8) | mitigate | Key path: `inbound.py:379-381` `kickoff_prompt: inbound_kickoff(name, values)` (TRUST-03 envelope, `inbound_inputs.py:219-229`). `launch_kickoff` (`inbound_inputs.py:282-295`) is used only for trusted-author paths (in-app, scheduler `scheduler_service.py:163-167`, golden `publish_service.py:1704-1707`) and iterates `declared_fields` only. Test: `test_296_step_inputs_and_routing.py::test_s6_f8_b_key_start_carries_the_answer_once_inside_the_envelope` (re-run: pass). | closed |
| T-296-33 | Info disclosure | `agent_loop` save-point log (292.1-IN-02) | mitigate | `agent_loop.py:2036-2040` logs `len` + `sha256` only. Test: `test_296_chat_and_wire.py::test_in02_the_save_point_log_carries_no_answer_preview`. (The `preview=%r` at `:2886` is the 292.1 tool-markup log, `2d0f3bd0f`, outside this threat.) | closed |
| T-296-34 | Tampering | Moonshot schema transform | mitigate | `openai_compat.py:449,456`: `moonshot_tools(...)` only when `request.retries_provider() == "moonshot"` (routing/endpoint provider, `dispatcher.py:100-107`). Tests: `test_296_moonshot_schema.py::test_the_adapter_transforms_only_on_a_moonshot_endpoint`, `::test_every_chat_tool_comes_back_unchanged`, `::test_a_ref_free_schema_is_returned_as_the_same_object` (re-run: pass). | closed |
| T-296-35 | Info disclosure | delete 409 (293-DEL) | mitigate | `workflows.py:1428-1436`: `ForeignKeyViolationError` → fixed 409 sentence; constraint text never on the wire. Test: `test_296_chat_and_wire.py::test_293_del_a_delete_blocked_by_a_trial_run_is_a_worded_409`. | closed |
| T-296-36 | Repudiation / integrity | governance seal (BUG-261021-05 b) | mitigate | `canvasModel.ts:383-390` `isGrounded`: `cause !== null && cause !== "escalated"` (detected + already-set, both engine-enforced: `grounding.py:1178-1207`); escalated copy `definitionOps.ts:552` "...nothing is checked when it runs." Live: G-4 optional row 9 PASS (`evidence/g4/9-escalated-seal.jpg`). | closed |
| T-296-37 | Tampering | template/reference bind (291-WR-01/WR-02) | mitigate | Bind extracted to `templateDraftBind.ts` (snapshot taken at draft write, sent-only references); `DescribeTemplateRow.tsx:158,329` `disabled` while composing. Tests: `describeDoor296.test.tsx` "the bind reads the snapshot onDraft took", "a reference whose read never answered is not bound", "both file sections render disabled" (re-run: pass). | closed |
| T-296-38 | Tampering (XSS) | auto_answered / unplaced / removed strings | mitigate | No `dangerouslySetInnerHTML` sink in `DescribeTemplateRow.tsx`, `TemplateAttachSection.tsx` (line 359 is a comment saying it is NOT used), `WorkflowsPage.tsx`, `DraftArrivalCard.tsx`; strings rendered as React text children. | closed |
| T-296-39 | Integrity | Team view edits (290-WR-02) | mitigate | `WorkflowCanvas.tsx:1168,1172,1281,1419` and `WorkflowBuilderPage.tsx:935,1027` gate undo/redo + editing on `teamShown`; `PhaseFormPanel` not mounted when `teamShown` (`WorkflowBuilderPage.tsx:2831`). Live: G-4 scenario 6 PASS. | closed |
| T-296-40 | Tampering | `run-296-board.py` writes | mitigate | `run-296-board.py:641-643`: `assert_localhost_only()`, `assert_local_base_url()` (BE-WR-05 fix `d4011165c`), `_assert_local_db()` before any request; `conc_probe.is_local_url` parses the host (`conc_probe.py:119-127`, `:257-265`). Lock: `_db_lock` noclobber (`:108-115`) on every write mode. Cleanup ledger: `evidence/roster/cleanup.json` (threads 33 left 0, definitions 22 left 0). Test: `test_296_review_board_host_guard.py` (re-run: pass). | closed |
| T-296-41 | Info disclosure | evidence/roster files | mitigate | `run-296-board.py:138-148` `_write` redacts `org-…`/`ak-…` and refuses `Bearer ` / `sk-`. This audit's grep `Bearer \|sk-[A-Za-z0-9]` over `evidence/`: 0 files. | closed |
| T-296-42 | Repudiation | bug/seed records | mitigate | `01546a07d` flips 10 reports `folded → closed`, each citing its G-4 PASS row in `296-HUMAN-UAT.md`; row 12 FAIL left open (new, pre-existing). `evidence/gates/outcome-coverage.py` re-run by this audit: "inventory row IDs: 133 · outcome rows: 138 · missing: 0". | closed |
| T-296-43 | Elevation | Supabase MCP (production) | mitigate | Process control: `296-HUMAN-UAT.md` §(e) records only SELECTs (`schema_migrations`, `workflow_definitions`); 296-05 SUMMARY records no MCP call by 296-05; cloud migrations 214→216 listed in the DEPLOY row for separate per-action approval. This audit made no MCP call. | closed |
| T-296-44 | Info disclosure | 294-ENV dev `.env` lines | accept | See Accepted Risks AR-04. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-296-09 | Inbound `final_output_text` is returned to the key OWNER's own API caller, not to a colleague (RESEARCH F3); no cross-user disclosure. Recorded in 296-01-PLAN threat model and 296-01 SUMMARY. | 296-01 plan (planner), carried by 296-05 threat notes | 2026-10-26 |
| AR-02 | T-296-14 | The reload-free reconcile reads the same owner-scoped `GET /threads/{id}/messages` a thread switch already reads; no new data path (verified `StreamsProvider.tsx:1912-1915`). | 296-04 plan | 2026-10-26 |
| AR-03 | T-296-26 | Provider failures reach the author only as a fixed worded refusal; provider error text is never forwarded (verified `workflow_authoring.py:938-949`). The author loses diagnostic detail by design. | 296-03 plan | 2026-10-26 |
| AR-04 | T-296-44 | The 294-ENV dev `.env` lines are an operator-only edit; Claude never mutates `.env`. Listed as an owed operator item. | 296-05 plan | 2026-10-26 |
| AR-05 | T-296-28 residual · review BE-WR-02 · 296-06 `threat_flag: dos-residual` | `_BodyCapRoute` reads `Content-Length`; a `Transfer-Encoding: chunked` body has none, so the app does not cap it and FastAPI buffers/parses it before the IP limiter. Accepted as bounded by the onebox nginx `client_max_body_size 100m` (`frontend/nginx.conf:8`, which fronts `/api/` in `docker-compose.prod.yml`). Recorded as a flag in 296-06 SUMMARY and as "Accepted; re-open on any deploy target without that nginx" in 296-05 SUMMARY threat notes. **⚠ WARNING — the stated bound does not cover the cloud production topology.** `docs/DEPLOYMENT-PIPELINE.md:150` routes `api.superrag.cloud` straight to the Coolify VPS (Vercel serves the frontend), and 296-REVIEW BE-WR-02 itself says "a direct Coolify backend has no limit". So the acceptance's own re-open trigger is already true for production. The fix the review named is a stream-counting ASGI wrapper on `/inbound`; the alternative is a body cap at the Coolify proxy. | 296-06 executor (flag) + 296-05 orchestrator notes. No operator sign-off recorded. | 2026-10-27 |

---

## Unregistered Flags

| Flag | Source | Mapping | Note |
|------|--------|---------|------|
| `threat_flag: info-to-model` — `workflow_authoring._resolve_unticked_connections` puts the NAME of an unticked org connection into the drafting prompt when the author's own description already names it | 296-03 SUMMARY | **none** (no T-296 row) | WARNING, not a blocker. The SUMMARY reports it uses the existing `list_connections` + `_resolve_caller_org_ids` resolver, fails closed to `[]`, and grants nothing (`_check_allowed_connections` still refuses a step on an unticked connection). This audit did not verify those claims; the next register should add a row for it. |
| `threat_flag: content-render` (RunEvidenceReport remote images) | 296-04 SUMMARY | T-296-10 / FE-WR-02 | Informational. Fixed post-plan with `noRemoteMedia` and verified above. |
| `threat_flag: dos-residual` (chunked `/inbound` body) | 296-06 SUMMARY | T-296-28 / BE-WR-02 | Accepted as AR-05 (see warning). |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-27 | 44 | 44 (40 mitigate verified in code · 4 accept documented) | 0 | gsd-security-auditor (Claude), at `develop` `01546a07d`, diff base `27f1cdf9b` |

Re-run during the audit (all read-only): `node scripts/check-schema-acl-parity.cjs` (OK); backend `pytest` on 14 files (`test_296_migration_shape`, `_citation_rate_limit`, `_create_org_stamp`, `_schedule_trigger_words`, `_kickoff_and_keys`, `_moonshot_schema`, `_chat_and_wire`, `_step_inputs_and_routing`, `_lifespan_no_sweeps`, `_review_board_host_guard`, `_describe_files`, `_rerank_and_claims`, `_judge_note_and_tasks`, `test_289_run_evidence`): **202 passed**; frontend vitest (`MarkdownRenderer.noRemoteMedia`, `RunEvidenceReport`, `describeDoor296`, `ArtifactTooltip`, `--maxWorkers=2`): **74 passed**; `evidence/gates/outcome-coverage.py`: missing 0; credential grep over `evidence/`: 0 hits. Not re-run: `check-greenfield-privileges.py` (needs a DB), `tests/integration/test_296_two_org_create.py` (real DB). No implementation file was modified; no Supabase MCP call was made.

Post-plan review items in this record: FE-WR-02 verified fixed (T-296-10). BE-WR-02 accepted (AR-05). BE-WR-05 verified fixed (T-296-40). BE-WR-06 (`folders.py:81,96` now `aexec`) is a D-v2.5-01 fix, not a register threat; noted as verified. BE-CR-01 / FE-CR-01 are correctness findings outside the threat register.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter
- [ ] Operator decision owed on AR-05 before the next production push: re-ratify it knowing production is not behind the nginx, or close it in code or at the Coolify proxy.

**Approval:** verified 2026-10-27 (AR-05 warning open for operator decision)


## Post-audit update 2026-10-27 (orchestrator)

AR-05 is no longer an accepted risk: the auditor's warning (production's API reaches the Coolify VPS directly, past the onebox nginx cap) was acted on in-phase. `inbound.py` `_BodyCapRoute` now counts a body with no `Content-Length` as it streams and answers 413 at `INBOUND_MAX_BODY_BYTES` (RED `c8b5427c1`, fix `dbc43dbc1`; `test_an_oversize_CHUNKED_inbound_body_is_413_with_no_length_header`, 109 inbound tests pass). T-296-28 is therefore mitigated for both header and chunked bodies; the operator sign-off line for AR-05 is moot. threats_open: 0.

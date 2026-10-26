# Phase 296 — v4.7 debt inventory

**Built:** 2026-10-26 from four read-only sweeps of every v4.7 phase record (REVIEW, REVIEW-FIX,
deferred-items, VERIFICATION, UAT/HUMAN-UAT/VALIDATION, SUMMARY follow-ups), the open
`surface: Agentic-RAG` bug reports filed 2026-10-15..26, SEED-360..374, and the milestone audit
(`.planning/v4.7-MILESTONE-AUDIT.md`). Each item was checked against the code at `407b76f35`.

**This file is the scope of Phase 296 (SC#1).** Every row ends as **fixed**, **accepted (reason)**,
**seeded to v4.8**, **operator**, or **close-only** (record flip). A row is never dropped silently.

Size: S = ≤ 10 lines · M = more · L = large. UV = user-visible. Locations are as found; the
executor re-reads before editing.

Dispositions:
- **FIX** — a defect fixed in 296, RED test first.
- **TEST** — a test or gate fix, no product change.
- **CLOSE** — already fixed; flip the record with the fixing commit.
- **SEED** — feature-shaped; plant or update a v4.8 seed with a trigger.
- **ACCEPT** — recorded with its reason; no change.
- **OPERATOR** — needs the operator (billing, ruling, deploy).

---

## W1 — Tenancy, governance and privacy (backend)

| ID | Defect | Location | Sz | UV | Disp |
|---|---|---|---|---|---|
| BUG-261021-02 | Folder and workflow create ignore `X-Org-Id` (major, tenancy). The migration-106 trigger picks the org with `LIMIT 1` | `api/folders.py:46-86`, workflow create path → `db/workflows.py:1028` (confirm the route) | M | y | FIX: `resolve_active_org_or_none(request, user)` (`dependencies.py:1020`, as `threads.py:794`), stamp `org_id`; RED two-org test + foreign-org negative |
| BUG-261021-05 | An escalated step shows the "Must prove it" seal, but the engine adds the citations check only for `detected` (major) | `grounding.py:1387/1424` `effective_phase`, `engine_ask.py:740`, `WorkflowBuilderPage.tsx:440` `gatesFor` | M | y | FIX per D-04: the engine enforces the check on escalated steps |
| BUG-261020-02 (`evidence-page-later-step-carries-withheld-document-substance.md`) | A later step that cites nothing but builds on a withheld step ships its substance to a colleague | `services/run_evidence.py` (CR-01 is per citing step) | M | y | FIX per D-05: withhold downstream step output for non-owners once an upstream step is withheld |
| SEED-364 | Auto-created org names embed the founder's email | org creation path | S | y | FIX per D-06: neutral default name for NEW orgs; existing names untouched |
| SEED-365 (rate-limit half) | Citation checks have no per-user rate limit | `api/citation_checks.py` | M | n | FIX: per-user limit reusing the 293 Redis limiter; spend-ledger half stays SEED |
| 287-T01 | Required launch inputs are checked client-side only | no server predicate in `api/` / `services/` | M | y | FIX: server predicate at kickoff (reuse `soulData.missingRequiredFields` semantics) |
| 289-IN-04 | One malformed cited id fails the `uuid[]` cast and masks every source | `run_evidence.py:365-372` | S | n | FIX: drop non-UUID ids before the RLS query |
| 289-IN-06 | The no-match explanation says "your documents" to a colleague | `evidenceVocabulary.ts:49,180,190` | S | y | FIX: neutral wording |

## W2 — Runs end truthfully; inbound, providers, tracing (backend)

| ID | Defect | Location | Sz | UV | Disp |
|---|---|---|---|---|---|
| DEBT-3 | The ask re-drive guard accepts only `status='paused'`; an engine ask on a `cap_paused` run is skipped | `api/runs.py:746` | S | n | FIX if RED reproduces; else ACCEPT with the RED evidence |
| 295-IN-01 | The unloadable-definition sweep fails a paused run but leaves its prompt live | `run_handoff.py:370-380` | S | y | FIX: expire the prompt after the winning end |
| 295-IN-02 | The reconciler marks a run whose every step completed as `failed` | `run_reconciler.py:318-322` | S | y | FIX: `completed` when every step is completed / recorded_not_sent |
| 295-IN-03 | `_awaiting_answer` survives on a cancelled step | `db/workflows.py:2142` | S | n | FIX: strip the key on cancel |
| 295-IN-05 | Run-now reports a template refusal as a launch failure and echoes raw text | `api/schedules.py:271-276`, `scheduler_service.py:256` | S | y | FIX: worded refusal (backoff is SEED) |
| 295-IN-07 | A code-like audit string can render as "Why it stopped" | `api/runs.py:670` | S | y | FIX: worded sentence in the audit metadata |
| 295-IN-08 | The judge's "not sending is designed" note also applies when the send grant is missing | `validator_kinds.py:~206` | S | n | FIX per D-07: note only when the recording was by design |
| 295-RES-a | Duplicate `action_risk_pending` row on an armed re-drive | `harness_engine.py:1017-1024` | M | n | FIX (one-touch, G-5) |
| 295-RES-b | Stop on a live producer records no reason | `run_lifecycle.py:543`, `run_producer.py` | M | y | FIX: carry the user id on the cancel broadcast |
| 289-WR-06b | `claim_run` False arm only logs; a dead worker's lease waits for the boot sweep | `api/runs.py:754-756` | M | n | FIX: end truthfully or retry after the lease |
| 289-IN-05 | `_redrive_paused_workflow_run` returns True when nothing was spawned | `api/runs.py:695` | S | n | FIX: align return and docstring |
| 289-IN-07 | Run read `confidence` is an untyped dict | `api/workflow_runs.py:281` | S | n | FIX: reuse `RunEvidenceConfidence` |
| 289-IN-08 | Missing space in an import list | `main.py:878` | S | n | FIX |
| 289-F3 | Run-level confidence ignores the owner's buckets | `harness_engine.py:383` | S | y | FIX: pass `ctx.user_settings` |
| SEED-362 | A resumed run finishes on the owner's default model | `harness_engine._build_resume_context` | M | n | FIX: persist and reuse the run's model |
| SEED-363 | A TestClient lifespan can claim a live run in the shared DB | `main.py` lifespan sweep | S | n | FIX: guard the sweep under test |
| 288-WR-02 | The lint states the wrong ceiling when not a multiple of 60 | `publish_service.py:1322` | S | y | FIX |
| 288-IN-01 | `auto_answered` is untyped on the wire | `workflow_wire.py:319` | S | n | FIX + re-baseline the OpenAPI snapshot |
| 293-IN-01 | The file token is consumed before the limiter, so a 429/503 burns the link | `inbound.py:597` vs `:634` | S | y | FIX: limit first, then GETDEL |
| 293-IN-03 | No body-size cap on `POST /inbound/.../runs` | `inbound.py`, `inbound_inputs.py:16` | S | n | FIX: refuse oversize `Content-Length` |
| 293-IN-04 | `create_task(_drive_run)` holds no reference | `unattended_launch.py:223` | S | n | FIX: module task set + done callback |
| 293-IN-05 | Migration 215 backfill regex accepts non-uuid strings | `supabase/migrations/215_*.sql:131` | S | n | FIX: canonical uuid regex (215 not yet in cloud; cloud has 0 `_schedule_id` rows, read 2026-10-26) |
| 293-IN-06 | Zero-field `kickoff_prompt` workflows read `startable`; `create_key` accepts globals the picker hides | `inbound_inputs.py`, `api_keys.py:92-102` | M | y | FIX: mark `needs_task`, align scope (a `task` field is SEED) |
| 293-IN-08 | Re-revoking a key writes another audit row | `api_keys.py:337-349` | S | n | FIX: audit only on a matched update |
| 293-DEL | `DELETE /workflows/{id}` answers 500 after a blocked publish left a trial run | `api/workflows.py:1411-1420` | M | y | FIX: catch the FK violation, worded 409 |
| 293-F-4 | A step pinned to another provider's model id goes to the active provider (400 at trial run) | provider routing for steps | M | y | FIX after a RED re-drive |
| 294-IN-01 | Local rerank span records the CrossEncoder object | `rerank_engines/local.py:121-123` | S | n | FIX |
| 294-IN-02 | Unknown token counts reported as 0 | `rerank_engines/tracing.py:72-74` | S | n | FIX: omit when None |
| 294-IN-07 | Claim sentence keeps a space before punctuation | `citation_claims.py:157-161` | S | n | FIX |
| 294-CR-02-res | Claim ordinals not covered for HTML blocks / setext headings | `citation_claims.py` | M | y | FIX: fixtures measured against marked |
| 292.1-IN-01 | Raw DSML after an unclosed code fence is shown and saved | `text_tool_calls.py:~120` | S | y | FIX |
| 292.1-IN-02 | Save-point log previews the answer; substituted notice never streamed | `agent_loop.py:2037` | S | y | FIX |
| 292.1-IN-04 | The chat round cap also governs skill eval runs | `eval_runner_service.py:600` | S | n | FIX: fixed cap for eval runs |
| BUG-261024-01 | Moonshot rejects the workflow emit schema (recursive `$ref`) | emit schema / Moonshot boundary | M | y | FIX at the service boundary, provider-docs-first; live row ⛔ while the account is suspended |

## W3 — Describe-it authoring and the builder (291, 290, 288)

| ID | Defect | Location | Sz | UV | Disp |
|---|---|---|---|---|---|
| 291-WR-01 + IN-08 | Files stay editable while composing; bind reads live files; `bindFailed` keeps only the last | `useTemplateFirstDraft.ts` (G-5) | M | y | FIX: snapshot in `onDraft`, disable sections, list failures |
| 291-WR-02 | Never-read references are bound and listed "Used to write this draft" | `useTemplateFirstDraft.ts:~985`, `decisionsVocabulary.ts:343` | M | y | FIX: bind only what was sent |
| 291-WR-04 | Button `/V` written as text; read-back cannot see the type | `render_template.py:~396-445` | M | y | FIX: `NameObject` + typed read-back |
| 291-WR-06 (UI half) | "Look it up" (`kb_auto`) has no engine lookup | `declaredInputsVocabulary.ts`, `soulData.ts` | S | y | FIX: the UI says it is not wired / hides it. Engine lookup → SEED |
| 291-WR-07 | Untrusted PDFs extracted twice, no page/byte bound | `describe_files.py:265-267,559` | M | n | FIX: page + byte cap, extract once |
| 291-IN-01 | Citation retry fires with no KB evidence | `phase_types.py:1218/1267/1783`, `form_inputs.py` | S | n | FIX |
| 291-IN-03 | Partial Word placement returns 201 and drops sentences | `workflow_authoring_doors.py:469,576-581` | S | y | FIX: return the unplaced sentences |
| 291-IN-04 | `_has_template_marks` misses `{#` | `describe_files.py:800-802` | S | n | FIX |
| 291-IN-05 | `covered_by: null` breaks the client type; dead switch | `describe_draft_guards.py`, `knowledge.ts:800`, `DraftInputsFold.tsx:146` | S | y | FIX |
| 291-IN-06 | Unanswered optional inputs not overlaid as null | `form_inputs.py` | S | n | FIX |
| 291-S1-labels | Poor page-text labels for text fields | `describe_files.py:413` | M | y | FIX: filter junk, prefer adjacent label |
| 291-S1-copy a/b/c | "Nothing is saved" after Save; billing failure read as "describe more"; empty enum option in the hint | `definitionOps.ts:843`, `describeRefusalVocabulary.ts:97,117`, `declaredInputsVocabulary.ts:150` | S | y | FIX ×3 |
| 291-S2-F1 | Removing a power leaves a hollow step | `describe_draft_guards` | M | y | FIX: flag the orphaned step on the arrival card |
| 291-S2-F2 | File text reaches the restated requirement the judge grades | `describe_draft_guards` / `workflow_authoring` | M | y | FIX |
| 291-S2-F3 | "No Slack connection configured" when connected but unticked | `workflow_authoring.py:~583,~810` | S | y | FIX: wording |
| 291-S3-F2 / F3 | Raw AcroForm names in the step panel; Replace accepts only Office under a PDF | `PhaseFormPanel.tsx` | S | y | FIX ×2 |
| 291-S6-F7 | Golden run answers inputs with placeholders, so Publish never proves a fill | `publish_service.py:1655` | M | y | FIX per D-08 |
| 291-S6-F8 | First LLM step cannot see launch answers | `phase_types.py:206` | M | y | FIX: launch inputs in the first step's user turn |
| 291-S6-F9 | Run record title squeezed at 1536px | `WorkflowRunPage.tsx` | S | y | FIX (CSS) |
| 291-S7-F1 | "2 fields" when 4 were filled | `render_template.py` `_measure` | S | y | FIX |
| BUG-261024-02 | A generated draft is lost if left untouched | `WorkflowBuilderPage.tsx:116` dirty gate | S | y | FIX: persist on generation success |
| 290-WR-02 | Team view says "View only" but undo/redo and the panel still edit | `WorkflowCanvas.tsx:1156,1269`, `WorkflowBuilderPage.tsx` | M | y | FIX per D-09 (reverses the 2026-10-24 accept) |
| 290-IN-01..05 | Tie-break mismatch; two homes for "no type"; empty-slug label; tablist keys; scroller focus | `teamModel.ts`, `libraryVocabulary.ts`, `WorkflowBuilderPage.tsx:2163`, `TeamPicture.tsx` | S–M | mixed | FIX ×5 |
| 290-FU-canvas | Steps canvas armed detour reads only the stored flag | `phaseVocabulary.ts:512`, `canvasModel.ts` | S | y | FIX: always armed for `external_action` |
| 290-OBS-vocab | Bracket lookups and config-less throws in `phaseVocabulary.ts` | `phaseVocabulary.ts` | S | n | FIX: `own()` + guard |
| 288-F-4 | The `auto_answered` note is never seen on a successful publish | `WorkflowsPage.tsx:817-822`, `PublishGauntlet.tsx:1166` | M | y | FIX: carry the note to the library toast |

## W4 — Run surfaces, chat and settings (frontend)

| ID | Defect | Location | Sz | UV | Disp |
|---|---|---|---|---|---|
| BUG-261021-04 + -03 | Followed run's final answer missing / Unsourced mark lost until reopen | `StreamsProvider.tsx` end-of-run path, `PhaseCard.tsx` | M | y | FIX together (G-5 one-touch) |
| BUG-261025-03 | Several EXPIRED ask cards while the run still waits (major); SEED-360 residue | `PendingAskCard.tsx`, `harness/human_input.py` | M | y | FIX after a RED re-drive |
| BUG-261025-01 | Schedule "Run now" gives no feedback | `WorkflowScheduleModal.tsx:390` | S | y | FIX: pending state + result line |
| BUG-261025-02 | Evidence report title crushed by four buttons | `RunEvidenceReport.tsx:173-201` | S | y | FIX or CLOSE after measuring at 1536px |
| 295-D-uat-02 | Chat panel reads "act — Running" while the armed run is paused | panel / `PhaseCard.tsx` | S | y | FIX: step active + run paused → Waiting |
| 289-F-A | A run watched into `failed` raises no alert | `RunEvidenceReport.tsx` | S | y | FIX |
| 289-F-B | Step outputs render verbatim, not as markdown | `RunEvidenceReport.tsx` | M | y | FIX: the shared sanitised markdown renderer |
| 289-F-C | Unlinked deliverable has no "download unavailable" sentence | `RunEvidenceReport.tsx`, `evidenceVocabulary.ts` | S | y | FIX |
| 287-WR-02 + IN-03 | A rejected in-thread start leaves `Run <name>` in the composer; unhandled rejection | `useStartWorkflowInThread.ts:55-66` | M | y | FIX: the hook owns failure + Retry |
| 287-IN-01 / IN-02 / IN-04b | Refusal doesn't clear on typing; `" is required"` on empty label; picker has no Escape/outside-click | `ChatLaunchForm.tsx`, `RunModal.tsx`, `soulData.ts:233`, `ThreadWorkflowPicker.tsx` | S | y | FIX ×3 |
| 287-SCHED | Schedule form has no required-input block | `WorkflowScheduleModal.tsx` | M | y | FIX: reuse `missingRequiredFields` |
| 287-TSC | tsc TS2345 in the streams store initializer | `streamsStore.ts:492` | S | n | FIX |
| 292-IN-01 / IN-03 | Tooltip detaches on scroll; node labels clamped with no `title` | `ArtifactTooltip.tsx:65-73`, `DiagramArtifact.tsx:241` | S | y | FIX ×2 |
| 292-WR-04-res | Back-edge label can overlap a node | `diagramLayout.ts`, `DiagramArtifact.tsx:262` | M | y | FIX |
| 293-IN-02 | Sample status JSON shows step 3/3 on a completed run | `curlExamples.ts:56-57` | S | y | FIX |
| 294-IN-05 / IN-06 / IN-08 | Unknown provider maps to Cohere; availability never refreshes after 409; "N citations" counts sources | `rerankEngines.ts:120`, `citationCheckStore.ts`, `CitationCheckAction.tsx:66` | S | y | FIX ×3 |
| 294-LOCAL | Local engine: median 18.5 s per search, no note, no timeout | `rerank_engines/registry.py:78`, `rerankEngines.ts:64` | S | y | FIX: latency note + inference timeout with fallback |
| BUG-261024-04 (defect half) | Follow-up turns re-show every prior-turn file | `OutputFileCard.tsx`, `agent_loop.py` | M | y | FIX per D-10; the intermediates policy → SEED |
| 286-S04-2 | Stale MARK_ICON docblock | `WorkflowCard.tsx:532` | S | n | FIX (comment) |

## W5 — Tests, gates, records, live proof

| ID | Item | Location | Disp |
|---|---|---|---|
| 286-IN-02 | test_256 hard-codes line numbers | `tests/unit/test_256_finish_run_unchanged.py:135` | TEST: key on function name |
| 286-S04-1 | eslint `no-useless-escape` | `PublishedCardDelete.test.tsx:958` | TEST |
| 287-WR-03 | Fork-isolation test never attempts the attack | `test_287_fork_isolation.py:162` | TEST: user-JWT non-owner refusals |
| 288-T-2 | `test_nl_gen_regression_test_count_unchanged` expects 8, finds 11 | `tests/test_182_extraction_parity.py:305` | TEST |
| 288-T-3 | `test_182_canvas_gate` route-set fence unconfirmed | `tests/test_182_canvas_gate.py` | TEST: run under the lock |
| 289-T-1 | `test_no_twenty_fifth_audit_kind_was_added` red (25 vs 24) | `tests/test_200_human_gate_pause.py:360` | TEST |
| 289-V-2 | WR-01 / WR-06 re-drives never live-driven | — | TEST: fault-injection unit test, else ACCEPT |
| 291-R1-IN-01 | Client mirrors of caps have no parity pin | — | TEST: lockstep test |
| 292.1-test_075_4 | `test_known_providers_includes_all_five_providers` red | `tests/unit/test_075_4_unknown_provider_error.py` | TEST (lowers the 71 baseline) |
| 293-IN-07 | `--require-settled` matches only 3-digit seed ids | `scripts/check-seeds-register.cjs:65,488,707` | TEST: `\d{3,}` |
| 294-IN-03 | Fault server cannot answer `choice` | `scripts/decision-fault-server.py:63-88` | TEST |
| 293-INH / 295-TEST | 22 inherited frontend failures; count gate not shown OK since 295 | — | TEST: re-derive at close |
| CLOSE-ONLY | BUG-261020-03 (fixed `6d14ccf59`; Anthropic key rotated 2026-10-24); BUG-261020-01, BUG-261015-01, BUG-261020-07..12 (fixed in 295); SEED-361 (295-08); 290/291/292/292.1/293/294/295 review items already fixed | `.planning/reported-bugs/`, `.planning/seeds/` | CLOSE with commits |
| 287-V-3 | Migration 210 in cloud | — | CLOSE after a read-only cloud check |
| 288-F-1/2/3, 288-CR-01, 288-WR-01/03, 289-CR-01/02, 289-WR-01..06, 289-F1, 287-WR-01 | Fixed by later phases | — | CLOSE (records only) |

## SEED — feature-shaped, v4.8

| ID | What | Seed |
|---|---|---|
| DEBT-1 / 293-F-2 | An unattended run that pauses never expires and can only be answered in the app; no ThreadRunLine for a live key/schedule run | SEED-367 (update) |
| 294-WR-02 | Citation-check concurrency cap and spend ledger | SEED-365 (rate-limit half done in W1) |
| 291-WR-06 (engine) | `kb_auto` engine lookup | new seed |
| 291-network_mode | Sandbox egress for workflow-run `execute_code` | new seed (security capability decision, D-11) |
| 286-V-1 | `api/workflows.py` handler split (D-05 target missed) | new seed |
| 287-V-6 | Starter-card "answer arrives in chat" wording (needs a sketch) | new seed |
| 289-F-E | Deliverable size and path on the report | new seed |
| 293-IN-06 (task field) | An inbound `task` field for zero-field workflows | new seed |
| 295-RES-c | Paused-composer F2 lock server-path agreement | new seed |
| 295-IN-05 (backoff) | Back off a schedule refused every tick | new seed |
| BUG-261024-04 (intermediates) | Intermediate PNGs beside the final document | new seed |
| SEED-366, 368-374 | Already planted | stay `planted` |

## ACCEPT — recorded, no change

| ID | Reason |
|---|---|
| 293-AR-05 / AR-06 | Operator-accepted 2026-10-26 (`293-SECURITY.md`) |
| 294-WR-01 | Description corrected (`d413c5ae7`); behaviour intended |
| 295-IN-04 | Name already visible to the colleague |
| 295-IN-06 | Never skip an approval (deliberate) |
| 295-D-r2-03 | 0.2 s flash, recorded |
| 286-IN-01, 286-S02-1 | Type-only coupling; ordering only |
| 287-IN-04a | Redundant with the exact count check |
| 288-WR-04, 288-IN-02, 288-MIN, 288-V-1 | By design / not reproduced / operator accepted on unit tests |
| 289-IN-01, 289-IN-02, 289-IN-03, 289-F-D, 289-V-3 | Already exposed / reworded / live-run use / cosmetic |
| 291-IN-02, 291-IN-07, 291-R1-WR-01-res, 291-R1-IN-02, 291-R1-IN-03 | Judged safe in review; R1-WR-01 closes with the network_mode seed |
| 292-375px/TZ, 292-dead-key, 292.1-replay-409 | Chrome MCP limits; history; needs a state column (seed if it recurs) |
| 294-JEV | Measured cost-gate result; a product fact, not a defect |

## OPERATOR

| ID | Action |
|---|---|
| 287-V-1 | Rule on SC#4 "one click" (auto-pick in D-12: accept menu + name dialog) |
| 287-V-2, 291-roster, 292.1-OpenRouter-row, BUG-261024-03 | Top up OpenRouter, then `scripts/run-2921-board.py --run --providers openrouter` and the 291 roster row; flip BUG-261024-03 after |
| 292.1-Moonshot-row | Account suspended: reinstate, or record as permanently blocked |
| 287-V-4, 287-V-5 | Folded into the 296 G-4 drive / optional long-message row |
| 294-ENV | Remove the two dev `.env` lines (fault server) |
| 286-V-2 | SEED-280 status note |
| DEPLOY | After 296: cloud migrations 214, 215 (+216 if 296 adds one), backend, `get_advisors(security)`, each write shown first |

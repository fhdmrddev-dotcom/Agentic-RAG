# Phase 281 — live evidence (G-4, D-17..D-21, D-32)

Every row below is driven in Chrome against the **real local stack** and read from the rendered
**words** (DOM text), never from a block's presence, a screenshot or a test fixture (D-21). Each
row is then matched to the local database. A row is ✅ PASS only when both the screen and the DB
read agree; otherwise it is ⛔ OWED with its reason. No row is omitted.

- **Source under test:** plans 01-03 merged on `develop` (`3931b0978`); 281-04's own commits change
  docs only (ledger `6b85944da`, this file). The drives record the HEAD they ran at.
- **PHASE_BASE:** `95c62fc83`.
- **Reference data (research-measured, local DB):** pre-fix golden run
  `43b34171-35d9-4884-9f12-0d76f42b1352` (3 engine attempts / 9 shots: 7 × `covers_template` false
  with `rows` missing, 2 narrated, shot 1 also 2 uncited); draft `compliance-gap-report-cim40y`
  (status draft); freshness workflow `fresh-pause-102uat-20a89243`
  (`f59d361b-bc73-4f6c-b856-1a499195b59f`, published, carries a freshness validator).
- **Viewport:** ≥ 1280 px wide (WorkflowRunPage's run panel is `hidden … lg:flex`).
- **Org:** proven before each scenario by the DOM org switcher text plus a DB read of the user's
  memberships (the dev account is in two orgs).

## Operator reply (Task 2)

> `approved: org=fhdmrd@gmail.com's Organization model=deepseek-v4-flash`

Recorded verbatim (2026-10-15). ⛔ The reply does **not** approve scenario D's reversible
`archived_at` write, and does not approve renaming any workflow step, so neither was done.

**Drives ran at HEAD `33886624f`** (source = plans 01-03 at `3931b0978`; 281-04's own commits are docs
only), 2026-10-14 21:17-21:29 UTC, Chrome DevTools MCP page 1 at 1440x900, against the operator's
running backend :8000 and frontend :5173. Nothing was started, stopped or restarted, and no setting was
changed (the technical-names reveal stayed OFF: `localStorage['technical-names'] = "false"`).

**Org, proven before the drives:** `localStorage['active-org-id'] =
22f9c615-0eec-440a-8804-ed4784d6f57f`; every request carried `x-org-id: 22f9c615-…` (read from the
`POST /workflows/generate` request headers); DB `org_members` for user `d8a54002-…` = **1 row**
(`22f9c615-…`, `org-admin`), `organizations.name` = `fhdmrd@gmail.com's Organization`. The account
menu shows no org switcher (one membership); the "dev account is in two orgs" memory is stale for
this DB. The other org (`seed@system.local's Organization`) owns only the shared starter.

## Rows

| Row | Scenario | FAIL if (CONTEXT, verbatim) | Status | Evidence |
|---|---|---|---|---|
| A | **D-17** emit miss at publish (+ D-06 live half, + D-32 chat half) | "Publish `Compliance Gap Report` live. **FAIL if** the word "citations" appears, the missing fields are not named, or the step shows as a slug instead of its canvas name." | ⛔ OWED | **Model passed: no refusal to read.** Golden run `e4b3625a-5d4b-4cc2-96db-cf3e54c57bfc` (`deepseek-v4-flash`) `completed`; the emit step passed its gate on the FIRST model call. Publish was then refused by the **judge**, not the emit gate. See § Row A. |
| B | **D-18** golden-run link | "On a refused publish, click *Open the golden run…*. **FAIL if** "coming soon" appears anywhere, the button does nothing, or it opens a different run." | ✅ PASS (D-18's three FAIL-if conditions) · one plan sub-check not exercisable | `/coming soon/i` absent from the gauntlet's text AND innerHTML; the button rendered enabled and the click opened WorkflowRunPage; run id loaded = verdict `golden_run_id` = DB `is_golden_run` row = `e4b3625a-5d4b-4cc2-96db-cf3e54c57bfc`. The plan's extra clause (run panel's failed-step reason == A's cause) cannot be read: the run completed and no step failed. See § Row B. |
| C | **D-19** describe-door refusal (+ SEED-218 connect click) | "Draft a workflow whose step needs an unchosen service. **FAIL if** `connection_not_allowed` shows with technical names OFF, or no next step is given. With the toggle ON, the code appears small." | ⛔ OWED (`connection_not_allowed` never rendered) · SEED-218 connect click ✅ PASS | Two drafts with NO service ticked (`allowed_connection_ids: []`) both came back `could_not_generate` (`model_failed_to_emit`, then `provider_error`): the drafting model never reached the connection check. Those two refusals DID render the table's words with no code. The DOOR_REFUSAL `Connect Linear` click landed on Connections. See § Row C. |
| D | **D-20** freshness with an archived doc | "Run a freshness-checked step over a folder whose newest document is archived. **FAIL if** the archived document's date decides the verdict. This is proven by the run's verdict on screen plus a DB read." | ⛔ OWED | **(1)** The operator's reply did not approve the reversible `archived_at` write. **(2)** Read-only, the folder cannot produce the decisive arrangement anyway: all 3 documents date from 2026-06-08, far past `max_age_days = 2`, so only editing `created_at` (forbidden) or adding a new document could make the archived row decide the verdict. See § Row D. |

### What each row must paste before it can read PASS (281-04-PLAN.md Task 3)

- **A:** the gauntlet's WHAT STOPPED IT headline and cause, verbatim; the new golden run's
  `harness_audit` `emit_rejected` / `emit_failed` rows (per-shot kinds, `missing_keys`,
  `uncited_value_count`, `invented_citation_count`) beside the rendered bullets;
  `workflow_phases.output->>'_failure_reason'`; the failed step's `phases[].name` from the draft
  definition (or NULL/blank); the chat failure message's rendered words and the DB `messages.content`
  row (origin `harness`) for the run's thread, with the D-32 header verdict. "citation" may appear
  only if a row shows `uncited_value_count > 0` or `invented_citation_count > 0`, and then only in
  that bullet. If the model passes the gate: ⛔ OWED "model passed — no refusal to read" with the run id.
- **B:** a `/coming soon/i` search over the whole gauntlet text; the run id WorkflowRunPage loaded,
  the verdict's `golden_run_id`, and the DB `workflow_runs` row (`is_golden_run = true`, latest for
  this definition): all three equal, and the run panel's failed-step reason equal to A's cause.
- **C:** the generate-error block text with technical names OFF, compared with
  `describeRefusalVocabulary.ts`'s `no_service_chosen` sentence + next step; the mono
  `connection_not_allowed · no_service_chosen` with the toggle ON; the page the "Connect …" control
  lands on (SEED-218).
- **D:** the folder's documents (`id`, `created_at`, `archived_at`, `retrievable`) and the
  workflow's `max_age_days`; the newest document's `archived_at` before (expected NULL), after the
  approved write, and after the restore; the verdict on screen and the run's gate audit row.

## Row A: D-17 / D-06 live / D-32 (⛔ OWED, model passed)

**Draft:** `Compliance Gap Report` `compliance-gap-report-cim40y` (`c2672c18-5796-4003-97bb-193ea478541d`).
42 drafts share the name, so the library card was chosen by last-run status and updated_at order,
then confirmed by the Builder's own request `GET /workflows/c2672c18-…/template/placeholders`.

**⚠ Deviation, recorded: the draft had to be BOUND to a knowledge base before it could be published.**
Rendered on the disabled button: *"phase 'retrieve' reads your documents, but this workflow is not
bound to a knowledge base — it would search everything"*. The July reference failure (`43b34171…`)
ran unbound. To publish, the knowledge base was set to `Security & Compliance Policies`
(`1acc8391-a53f-4223-9725-a47ae4058f31`) through the Builder's own select, which auto-saved ("Saved ·
just now"). It was **restored to "No knowledge base · searches everything" after the drives**. DB read
after the restore: `project_folder_id = null`, `status = draft`. The binding is a confound: the live
run did not reproduce July's conditions, and today's app cannot (an unbound publish is refused upstream).

**Golden input typed:** *"Produce the compliance gap report for our security and compliance policies:
one row per obligation with its source clause, current state, gap, severity and owner."*

**What ran, from the DB (read-only `harness_audit` for run `e4b3625a-…`, ordered by created_at):**
`phase_started retrieve` → `gate_passed retrieve` → `phase_started emit` → `emit_forced` (attempt 1)
→ **`emit_validated`**: `covered_keys [report_date, report_title, scope, rows]`, `covers_template: true`,
`total_leaves 153`, `filled_value_count 151`, `cited_value_count 151`, `uncited_value_count 0`,
`invented_citation_count 0` → `emit_rendered` → `gate_passed emit` → `run_completed` →
`publish_attempted` → `judge_verdict overall_passed false, overall_score 18` → `publish_blocked
blocked_stage judge`. **Zero `emit_rejected` / `emit_failed` rows.**
`workflow_phases`: `retrieve completed`, `emit completed`, both `_failure_reason = null`.
`messages` on thread `b8c95273-8ffb-4e5b-b4d7-43d587edd93d`: one row, `origin harness`,
*"Produced the filled deliverable: /compliance-gap-report.docx"*. That is a success message, not a failure.

**What rendered (gauntlet DOM text):** headline *"Blocked by the grader — the run finished, but the
independent grader would not pass the result"*; three judge named failures (scores 2.00 / 2.00 / 3.00);
judge summary *"The submission appears to be a partial extract of the filled deliverable rather than a
fully validated artifact. …"*. This is the JUDGE stage, which 281 did not change. There is no emit
cause on screen to grade against D-17.

**D-32 inputs, recorded for the re-drive:** the emit step has `phases[].name = null` (unnamed), so a
live emit refusal on this draft would exercise only the `This step failed after N attempt(s):` arm.
The named arm stays unit-pinned. A screen DOES render a golden run's thread: WorkflowRunPage shows
**"Open the chat thread"**, so the chat half can be driven once a refusal exists.

**Why OWED and not retried:** 281-RESEARCH Pitfall 2 and the Task 3 rule ("If the model PASSED the
gate (no refusal), record ⛔ OWED … never fabricate a pass"). A second publish could also let the
judge pass and turn the operator's draft into a published workflow, which nothing approved.
**To re-drive:** publish live a draft whose emit reliably misses a template field (for example, a
template placeholder the retrieve step cannot supply), then copy the WHAT STOPPED IT cause and the
chat thread's failure message.

## Row B: D-18 (✅ PASS on its FAIL-if conditions)

On the refused verdict above (DOM of `[role=dialog]`, after a 3 s settle):
- `/coming soon/i` over `innerText` → **false**; over `innerHTML` (169,734 chars) → **false**.
- The control's rendered words: **`▦ Open the golden run that was judged ›`**, `disabled = false`.
- "Show raw verdict" expanded, verbatim: `published false` · `version null` · **`golden_run_id
  e4b3625a-5d4b-4cc2-96db-cf3e54c57bfc`** · `blocked_stage judge` · `named_failures list · 4 item(s)`.
- Click → no unsaved-work prompt (the draft had auto-saved) → WorkflowRunPage rendered *"Compliance Gap
  Report v1 … ✓ Complete … Ran 2m 38s · 2 steps … compliance-gap-report.docx 38.8 KB"*, and the page
  issued **`GET /workflow-runs/e4b3625a-5d4b-4cc2-96db-cf3e54c57bfc`** (reqid 2027 / 2029).
- DB: the latest `workflow_runs` row for `c2672c18-…` = `e4b3625a-5d4b-4cc2-96db-cf3e54c57bfc`,
  `is_golden_run = true`, `status completed`.

**The three ids are equal.** None of D-18's FAIL-if conditions occurred ("coming soon" appears, the
button does nothing, it opens a different run). ⛔ The plan's additional clause, that the run panel's
failed-step reason equals A's cause, **cannot be exercised** on this run because no step failed. It
rides Row A's re-drive.

## Row C: D-19 (⛔ OWED) + SEED-218 connect click (✅ PASS)

**Describe door, nothing ticked.** Workflows → `＋ Build a workflow` → `Draft it for me — Open ›`.
The picker *"Services this workflow may use"* listed DeepWiki, Email (SMTP), GitHub, Google Workspace,
Jira – KAN, Microsoft 365, Notion and Slack-rag-test, none ticked.

| Try | Typed (verbatim) | Wire (`POST /workflows/generate`) | Rendered (DOM text) |
|---|---|---|---|
| 1 | *Every Monday, summarise last week's new security policy documents and post the summary to our Slack channel #compliance.* | req `allowed_connection_ids: []` → `{"ok":false,"error":"could_not_generate","detail":"model_failed_to_emit"}` | *"The model couldn't produce a usable draft."* / *"Try again, or describe the work in more detail."* / *"Nothing was saved."* |
| 2 (the one retry) | *Two steps. Step 1: search the knowledge base for security policy documents added in the last 7 days and write a short summary. Step 2: send that summary as an email to compliance@example.com using our Email (SMTP) connection.* | req `allowed_connection_ids: []` → `{"ok":false,"error":"could_not_generate","detail":"provider_error"}` | the same three lines |

Both renders equal `REFUSAL_FOR_KEY.could_not_generate` in `describeRefusalVocabulary.ts` (sentence
and next step) byte for byte, and a regex over the page text for
`could_not_generate|model_failed_to_emit` returns **false** with technical names OFF. That is D-11/D-12
evidence for a *different* code. It is **not** D-19, whose subject is `connection_not_allowed ·
no_service_chosen`: the drafting model failed before any connection check ran, twice. The plan says
"retry once … else ⛔ OWED", so row C is OWED. The toggle-ON half (mono `connection_not_allowed ·
no_service_chosen`) was not driven: no such refusal existed to reveal, and the technical-names
preference was left alone. **To re-drive:** when the drafting model is healthy, use the same two
prompts, and first check that `POST /workflows/generate` returns `reason_code: no_service_chosen`.

**SEED-218: the DOOR_REFUSAL connect click.** Typed on the describe door: *"Every Friday, create a
Linear issue listing the week's new security policy documents."* The rendered refusal (DOM text of
`describe-refusal`):
> *"⊘ Linear is not connected — connect it in Settings, or describe this step without it."*
> *"Every Friday, create a Linear issue listing the week's new security policy documents. why this stopped"*
> buttons **`Connect Linear`** · `Revise the description`

Clicking `Connect Linear` opened no dialog. The rail's `aria-current` element became **`Connections`**,
and `main` showed the heading **"Connections"**, *"Services you can connect, and what they let the agent
do for you. …"*, `14 services` and `＋ Add a connection`. **The control lands on Connections.**
⚠ Residual, unchanged by 281: the governed `DOOR_REFUSAL` sentence (`doorVocabulary.ts:535`) still says
*"connect it in Settings"* while the destination is the Connections page.

## Row D: D-20 (⛔ OWED)

Read-only reads only (no write was approved):
- `fresh-pause-102uat-20a89243` (`f59d361b-bc73-4f6c-b856-1a499195b59f`): `project_folder_id` and
  `folder_scope` = `75755ec9-5ba7-495b-ad93-7500011cf6f2` (*Project Meridian — Risks*); validator
  `{"kind": "freshness", "config": {"max_age_days": 2, "check_versions": false}, "timing": "pre",
  "on_failure": "ask_user", "max_retries": 2}`.
- The folder's documents (newest first):

| id | filename | created_at | archived_at | retrievable |
|---|---|---|---|---|
| `b5ae9906-1f74-432a-9da9-8a9fd6954438` | Project-Meridian-Status-Report-Week09.docx | 2026-06-08 19:17:38.248759+00 | null | true |
| `ab8e2857-e769-47f1-b7f1-359c9e19f46a` | Project-Meridian-Risk-Workshop-Notes.docx | 2026-06-08 19:17:38.237111+00 | null | true |
| `8b95ddd2-b834-4b25-83df-85f8614c0aed` | Project-Meridian-Charter-Excerpt.docx | 2026-06-08 19:17:38.232960+00 | null | true |

The decisive arrangement needs the newest document to be **younger** than 2 days while the newest
remaining retrievable one is older. Every document here is about 128 days old, so archiving the newest
changes nothing the verdict can show: it reads stale either way. The plan forbids editing
`created_at`. **To re-drive (needs operator approval):** upload one fresh document into *Project
Meridian — Risks*, archive it with the approved reversible write (record `archived_at` before, restore
it after), and run the workflow. PASS iff the screen shows the staleness verdict and the audit row
names the 2026-06-08 date, not the fresh upload's.

## Operator sign-off (Task 4)

> `approved`

Recorded verbatim, **2026-10-15**. Before replying, the operator was shown: row A ⛔ OWED (the model
passed the emit gate; golden run `e4b3625a-5d4b-4cc2-96db-cf3e54c57bfc` completed and publish was
refused by the judge, score 18), row B ✅ PASS, row C ⛔ OWED (the drafting model returned
`could_not_generate` twice) with the SEED-218 connect click ✅ PASS, and row D ⛔ OWED (the archive
write was not approved, and the folder's data cannot produce the decisive arrangement). They were
offered two options: "close with A, C, D owed" (recommended) or "re-run". They were also told that
the draft was bound to *Security & Compliance Policies* for the publish and then restored (DB:
`project_folder_id = null`, `status = draft`), and told about the evidence-gated flips.

**What the verdict rules:**
- **Row B ✅ PASS is accepted.** The flip it gates stands: BUG-260815-06 → `closed`.
- **The SEED-218 connect click ✅ PASS is accepted.** SEED-218 → `answered` stands, with its
  `doorVocabulary.ts` "in Settings" copy residual.
- **Rows A, C and D are OWED by DECISION.** The phase closes with them owed. That is a decision, not
  a claim that they ran (CLAUDE.md G-7 note). Their flips stay unmade: BUG-260730-02 stays `folded`,
  SEED-221 stays `folded`.
- **No flip is disputed,** so none is reverted.

**Re-run order, A → C → D.** Run A first: it carries the most owed evidence (D-17, D-06 live half,
the D-32 chat half, and row B's leftover "failed-step reason equals A's cause" sub-check), and it
gates BUG-260730-02.
1. **A:** the re-drive recipe is at the end of § Row A ("To re-drive: publish live a draft whose emit
   reliably misses a template field …"). The D-32 inputs are recorded there too (emit step unnamed;
   "Open the chat thread" renders the thread).
2. **C:** the re-drive recipe is in § Row C ("To re-drive: when the drafting model is healthy …").
   First check that `POST /workflows/generate` returns `reason_code: no_service_chosen`. This row gates
   SEED-221.
3. **D:** the re-drive recipe is at the end of § Row D ("To re-drive (needs operator approval): upload
   one fresh document …"). It needs a new per-action approval for the reversible `archived_at` write.

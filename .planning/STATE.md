---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: "Connected Knowledge"
status: executing
last_updated: "2026-09-04T16:46:00.000Z"
last_activity: 2026-09-04
progress:
  total_phases: 14
  completed_phases: 1
  total_plans: 4
  completed_plans: 4
  percent: 7
---

# Project State

> ⚠ **This file was RESET at the v4.0 start (2026-09-04)** — the third reset, and the reason is the
> same each time. The previous STATE.md had reached **1,553 lines**; at the v3.8 close it reached
> **4,364 lines / 361 KB**. **Nothing was deleted:** the full v3.9 file is archived verbatim at
> `.planning/milestones/v3.9-STATE-at-close.md`, including every per-phase position entry, the
> production-push record, the `BUG-260904-04` hotfix narrative, the Deferred Items table and the
> Guardrail overrides.
>
> ⚠ **Hand-edit this file. Do NOT call the `state.*` SDK verbs** — seven of them write false records
> and corrupted this file five times during Phase 190 alone while reporting success.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-09-04)

**Core value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and
can be taught new behaviors (skills) that persist and can be shared.

**Current focus:** **Milestone v4.0 Connected Knowledge — STARTED 2026-09-04.** Phase numbering
continues at **228**.

## Current Position

Phase: 229 — The One Ingest Splice (STARTED 2026-09-05, briefed to Gemini on BUS-106)
Plan: 228-01..04 complete; 229 not yet planned
Status: ✅ **COMPLETE** — executed, reviewer-verified, both corrections APPLIED (`7199fc144`). ⚠ **4 passed / 1 BLOCKED** — `DEBT-03` is not closed and must not be read as closed.
Last activity: 2026-09-04 — Phase 228 executed and independently verified (Gemini built, Claude pre-flighted + verified). Full schema regenerated, verification debt audited in 228-VERIFICATION.md, resume/continue resolved, subdomain routing configured, and backend unit baseline gate enforced.



### Phase 229 — pre-planning obligation DISCHARGED (2026-09-05, Claude)

The roadmap required *"Drive `import_connection_file` ONCE before planning — the schema mismatch is
verified but the runtime error mode is not, and *'this route currently does nothing'* is an ASSUMPTION
until it is driven."* **Driven.** The exact `doc_row` dict from `connectors.py:1705-1716` was replayed
through the real `supabase-py` client:

```
PGRST204 — "Could not find the 'storage_path' column of 'documents' in the schema cache"
```

⭐ **PostgREST rejects at the FIRST unknown key**, so the `file_path NOT NULL` violation (`23502`) is
**never reached** — the two candidate error modes were not equally likely, and it is the column one.
Because `aexec` raises at `:1718`, `background_tasks.add_task(_upload_pipeline, ...)` at `:1722`
**never runs**. ✅ **CONFIRMED: ATTACH-01 has never imported a single file; the caller gets a 500.**
So Phase 229's SC#1 is a real user-visible fix, not a theoretical one. **Gemini must not re-derive this.**

### Phase 228 verification (2026-09-04, Claude — RE-RUN, not read)

✅ **Re-ran independently:** backend baseline **71 failed / 3497 passed / 0 collection errors** ·
`test_228_oauth_redis_resilience.py` + `test_228_cap_paused_reconcile.py` **11/11** · `tsc` **66 errors**
(matches the claim exactly) · `check-deploy-drift.sh` **PASS, 0 drift** · `vercel.json`'s
negative-lookahead host guard correctly prevents the redirect loop · all three new suites pinned in
**both** TARGETS and BASELINE.

⭐ **Pre-flight G-2 was resolved correctly, and it was the call that mattered.** The `runStatus` unions
were **NOT** widened (`models/message.py:108`, `types/index.ts:171` byte-unchanged); the Phase 092 mount
reconcile instead gained an `else if (state.cap_paused)` branch at `ChatArea.tsx:167-180` and
`StreamsProvider.tsx:2065-2078`. That deleted G-1 and avoided a second source of truth.
✅ **No migration was needed** — `runs_status_check` already permits `'cap_paused'`.

✅ **BOTH CORRECTIONS APPLIED by Gemini at `7199fc144`, verified by the reviewer** — kept below as the record of what was wrong and why, because *the verdict cell disagreeing with its own evidence cell* is a failure mode worth recognising again:

1. ✅ **FIXED — `DEBT-03` now reads ⛔ BLOCKED** (frontmatter `status: passed_with_blocked`, `score: 4 passed / 1 blocked`). It had been marked ✅ PASS. Its requirement is *"`/code-review ultra
   review-base-225` runs"* — **it did not run**, and no agent can launch it. The frontmatter
   (`independent_verifier_absent_for`) and the evidence cell both say operator-blocked; only the verdict
   cell and the headline `5/5` disagree. This is exactly what pre-flight **G-4** warned about. Score is
   **4 passed / 1 blocked**, and the credits trigger stands.
2. ✅ **FIXED — the gate row now reads `0 failing (single sample)`** with a SEED-171 note naming the reviewer's three failures and their byte-unchanged evidence (`228-VERIFICATION.md:201,206,210`). The original claim was `0 failing` as a property. Reviewer re-ran on the same tree:
   **`failed 3`, total 7434** — same total, same pins. Filenames taken from the gate's persisted JSON
   **before** any re-run: `WorkflowBuilderPage.session.test.tsx` (`AssertionError: expected 1 to be +0`
   — the assertion `SEED-171` records **verbatim**) and `WorkflowsPage.test.tsx` ×2 (`STACK_TRACE_ERROR`).
   All sit in SEED-171's five cap-independent flaky suites; `git diff --numstat 7a5207dfd^..HEAD` shows
   both **byte-unchanged by this phase**. Recorded as **provably unmodified — never as "fine"**.

✅ **RECORDED in `228-VERIFICATION.md:136` as an Honesty Disclosure** — the cap_paused reconcile has never executed against real data. The dev DB holds **ZERO**
`cap_paused` rows (measured: completed 1274 / failed 161 / cancelled 56 / timed_out 7 / streaming 1).
The G-9 serializer test proves the wire contract; **no end-to-end run has actually cap-paused.**

⛔ **`BUG-260904-05` filed (major).** A cap-paused **Deep** run disables the composer —
`ChatArea.tsx:102` makes lock PRESENCE the disable (`MessageInput.tsx:339`, placeholder *"Workflow
running — Cancel to switch back"*) — and once continues are exhausted `MessageItem` renders *"Start a
new message to keep going"* directly above that disabled composer. **The UI instructs an action it
forbids.** Pre-existing on the live SSE path (`StreamsProvider.tsx:994-1002`); **Phase 228 removed the
reload that used to escape it, which is the fix working.** Not a revert — the lock is the wrong
instrument for a Deep pause.

### Roadmap facts (2026-09-04)

- **14 phases, 228-241.** Migrations reserved **153-163**, monotonic; gaps 130-139 / 142-149 NEVER backfilled.
- ⚠ **The requirement count is 38, not the 34 quoted at intake** (33 feature + 5 DEBT). `REQUIREMENTS.md`
  Traceability is filled and mechanically verified: **38 rows, 0 duplicates, 0 orphans**. A coverage check
  run against the wrong denominator is exactly how `LIB-08/09/10` survived a milestone living only in a heading.
- ⭐ **Phase 234 retires the CLAUDE.md manual-upload-only rule IN THE SAME COMMIT** (`SEED-142`), and carries a
  **MANDATORY threat model**. **Phase 231 also carries a MANDATORY threat model.**
- ⚠ **`DEBT-04`** (`app.<domain>`, `SEED-242`) is gated on an operator production push and **MAY BE DRIVEN OUT
  OF ORDER** — record it against 228 wherever it lands, never re-scope it.
- ⚠ **`SURF-03` has no home surface in this product.** Decision owed at 235's discuss-phase; recommendation is
  app-shell signal + Health-tab row. **Closing it against the Health tab alone does NOT satisfy it** — that is
  still a page you have to open.
- ⚠ **Ledger row OWED for `backend/app/services/scheduler_service.py`** (measures **5/2/399**, no row today) in
  234's commit — `LIB-08` binds the whole watch loop to it, so G-5 cannot fire on it at any count.
  **G-5 extraction OWED on `retrieval_service.py`** (fires at 231 *and* 241; a third landing must propose the
  extraction first).
- ⚠ **G-5 triples were re-derived from git at roadmapping and 8 of 12 had DRIFTED** — e.g. `documents.py`
  measured `73/30/2562` against a cell reading `72/30/2535`. Re-derive, never read the cell.

### Open decisions owed at discuss-phase

| Phase | Decision |
|---|---|
| 235 | `SURF-03`'s home surface (three options tabled; recommendation app-shell signal + Health-tab row) |
| 240 | Confirm-or-flip the message-vs-thread boundary — D-3 decided it, but two research files disagree |
| 241 | Verify local↔cloud pgvector parity LIVE before `hnsw.iterative_scan` is planned as the `SEED-076` remedy |

### The milestone in one sentence

The knowledge base stops depending on somebody remembering to upload — a source is connected
**once**, previewed before it brings anything in, and then watched on the **shipped** scheduler,
safely and at a customer's scale.

### Scope decisions taken at intake (2026-09-04, operator) — binding

| Decision | Answer |
|---|---|
| `SEED-210` permission fork | ⭐ **Option 3 — connection-scoped visibility**, stated plainly in the UI. `SEED-211`'s metadata-derived (M-Files) model is **DECIDED AND RECORDED with a migration path, NOT BUILT**. Satisfies "210 and 211 must be decided together" while capping the access-control surface. |
| Source families | **All four IN** — Google Drive (proven OAuth) · OneDrive/SharePoint (Graph) · any MCP file surface · email/mailbox. |
| `SEED-212` transcripts | **OUT**, trigger intact — event-shaped, a source *shape* not a source *provider*. |
| v3.9 debt | **Gets its own closeout phase, first** — not a bullet in this file, which is exactly how it survived the last close. |
| Version | **v4.0**, not v3.10 — this retires a standing architectural rule and introduces the inbound permission model. |

### ⚠ Binding constraints — carry these into every phase of this milestone

- ⭐ **A watched source must be DATA, not code.** One generic `list → read → hash → splice` contract
  with Drive / Graph / MCP / mail as **thin adapters**. If each source family grows its own ingest
  path, this is four milestones wearing one name. (The v3.9 lesson — *adding a service adds rows,
  not code* — applied inbound.)
- ⚠ **THIS MILESTONE RETIRES A STANDING `CLAUDE.md` RULE.** *"Ingestion is manual file upload only
  — no connectors or automated pipelines"* is marked *dated, not permanent*, and must change **in
  the same commit** as the first sync connector (`SEED-142`). ⭐ **That same commit retires the
  reason ownership-based RLS was adequate** — until now every document was deliberately placed by a
  person who could already read it. `SEED-210` records that the rule was load-bearing for security
  in a way its own wording never claimed.
- ⚠ **Threat model MANDATORY** on the sync phase — untrusted external content enters the corpus the
  agent answers from, plus a new credential scope.
- ⚠ **The screen says "checked every N minutes"** — never *"instantly"* or *"on change"*. No delta
  cursor, no webhook. When one lands, the sentence changes in the same commit.
- ⚠ **A file removed at the source is NOT removed from the Library** unless explicitly asked for. A
  revoked share must never silently delete knowledge the agent depends on.
- ⚠ **Write and delete grants are OFF by default** — inherit Phase 213's approval model, invent nothing.
- ✅ **`LIB-08` / `LIB-09` / `LIB-10` ARE NOW IN `REQUIREMENTS.md`** (done 2026-09-04) — they had never
  existed outside a roadmap heading, and a requirement that lives only in a heading is invisible to every
  coverage check. Same gap as `LIB-05..07`. ⚠ **`LIB-09` was AMENDED** at scoping: four buckets, not three
  (D-1). The constraint is kept here rather than deleted because the *class* of failure recurs.

### ⚠ Known shape-risk — stated at intake, then SOFTENED by measurement (original kept)

**Stated at intake:** *"Email is a second SHAPE smuggled in as a fourth provider. Drive, OneDrive and
MCP-file are one shape — a file with a path and a hash. A mailbox is threads, quoting, and
attachments-as-children, with no stable document boundary."*

⭐ **MEASURED, AND THE WARNING WAS OVER-STATED ABOUT THE CODE (D-3).** ~80% already ships:
`strip_quoted_replies()` runs before chunking; attachments-as-children ship with caps; Gmail and Graph
both land on one `parse_eml_bytes()`. PITFALLS independently confirms the manifestation is
**dedup/retrieval poisoning, not a broken adapter** — and the tool that prevents it already exists, so
the risk is failing to ROUTE the sync path through it.

**What survives the softening:** mail is still sequenced **LAST** (Phase 240) with its own
discuss-phase, and the document boundary is a real decision — **one message = one document, `thread_key`
groups** (D-3). ⚠ Two research files disagreed on that boundary; **240 must confirm or flip it**, not
inherit it silently.

### Seeds folded (18)

| Group | Seeds | Why it fires |
|---|---|---|
| Carried foundation | `209` `210` `211` `142` | Deferred WITH Phase 219 at the v3.9 close; their re-open trigger is this milestone's SC#1. |
| Ingest at scale | `077` `197` `076` `048` | ⭐ `076` and `077` each name *"the next milestone"* as their hard prerequisite **in their own text**. Ingestion is an in-process `BackgroundTask` with no queue/cap/retry/resume; `embed_texts` sends every chunk in ONE request; embeddings are hardwired to OpenAI with no fallback. |
| Inbound is untrusted | `188` `079` `072` | `188`: four modules carry a written anti-injection discipline and **nothing tries to break it**. `072`: "source disconnected → retain, freeze or purge" is `SEED-210`'s own undecided policy row. |
| One rule engine | `243` | The deferred phase text: the folder-watch rules and `243`'s classification surface *"should be designed together rather than growing two rule engines."* |
| Loop reliability + surface | `014` `239` `060` `224` | SC#1 requires the **shipped** scheduler (`014`). `239`: ONE malformed `config` makes EVERY connection in the org unreadable — fatal to a background watcher. |
| Riding the closeout phase | `213` `242` | `213` shipped at 216 and is unaffected. `242` is the `app.<domain>` move, armed for the next production push. |

**Deferred with triggers intact:** `SEED-212` (transcripts — re-open on any transcription connector,
or a "what was decided in the meeting" query) · `SEED-013` / `SEED-195` (inbound / Open Platform —
its own milestone) · `SEED-211`'s **BUILD** (re-open when connection-scoped visibility is measured
insufficient by a real tenant).

## ⛔ Inherited from v3.9 — the closeout phase owns these

Full narrative: `.planning/milestones/v3.9-STATE-at-close.md`. Condensed so nothing is lost:

- **Owed verification.** Phase 210: 4 of 5 SC never driven (`CONN-10` / `CONN-11` are structurally
  undrivable on this install). Phase 211: UAT rows + schema regeneration. Phase 214: SC#10's
  eight-row cross-provider roster, the other three SC#10 axes, and **eight G-4 operator drives**.
  Phase 217: **16 UAT rows**. Phase 225: `/code-review ultra review-base-225`, skipped on credits —
  **re-open trigger: credits available before the v3.9 production push.**
- **Three requirements are narrower than their wording:** `CAT-05` (the cloud half of
  Add-a-connection was never verified), `GRANT-03` (the pause names the tool and arguments but never
  the service), `CHAT-06` (the armed connector set is stored nowhere; F5 silently disarms it).
- ⚠ **`SEED-242` armed** — the product moves to `app.<domain>` at the next production push; seven
  steps across Vercel / Coolify / Supabase Auth / CORS. **Verify on a preview before promoting.**
- ⚠ **25 reported bugs open on `surface: Agentic-RAG`** (`STATE.md` said 23 at the close; re-counted
  2026-09-04). Six are probably ONE root cause in the resume path — see the table below.
- ✅ **The backend unit baseline WAS re-derived, and the claim recorded here was WRONG — kept, not
  overwritten.** This bullet asserted *"reads **95 failed / 3394 passed / 2 errors**; the `71` quoted
  all through v3.9 was measured over a different set."* **Measured 2026-09-04 at Phase 228 pre-flight**
  (main working tree, quiet, verdict line read verbatim):
  `backend/venv/Scripts/pytest.exe tests/unit -q --continue-on-collection-errors` →
  **`71 failed, 3497 passed, 2 xfailed, 2 xpassed, 35 warnings in 77.75s`, ZERO collection errors.**
  ⭐ **The `71` reproduces exactly** — the missing `ezdxf` / `reportlab` have since been installed, so
  the two collection errors are gone. Phase 228's plan `228-01` was RIGHT and this file was stale.
  ⚠ At `failed <= 71` against a measured `71` the gate has **ZERO headroom** by design. Nothing failing
  names oauth, connector, mcp or chat.

### Chat run-lifecycle findings — still open, still unrouted

Filed 2026-08-18 out of Phase 197 and **never folded into any phase**. Carried because they are one
control in one moment and must be triaged together:

| id | finding | status |
|---|---|---|
| `BUG-260818-01` | **Resume replays the original prompt** instead of continuing. ⚠ The thread CONTEXT is not lost — the label and the mechanism disagree. | open · major |
| `BUG-260818-02` | **Resume drops the thread's selected model** — `sendMessage` forwards `opts.model`/`opts.provider`; `resumeFromFailed` passes neither. | open · major |
| `BUG-260818-03` | At the 15-iteration cap the chat shows a stop. ⚠ **The Continue feature ALREADY EXISTS and did not render** — a live-SSE gate with no fetch reconcile, which is D-v2.5-03 exactly. | open · major |

⚠ **TRIAGE 01/02/03 TOGETHER** — a user today cannot tell Resume from Continue, and fixing one
leaves the moment still lying. `BUG-260823-02/03/04` are the probable same cluster.

## Register integrity — found during the v4.0 intake sweep

⚠ **Three seed IDs are COLLISIONS — two different ideas share each one**, so one of each pair is
invisible to any `grep SEED-NNN`:

| id | the two ideas sharing it |
|---|---|
| `SEED-228` | *"A workflow cannot say the whole library, on purpose"* **and** *"read_doc on a .docx id returns a bare FAILED_PRECONDITION"* |
| `SEED-229` | *"Does the golden run hang on an armed approval checkpoint?"* **and** *"Five suites run by the count gate and guarded by nothing"* |
| `SEED-231` | *"The BLOCKING decision-coverage gate is blind to every decision id this repo has written"* **and** *"Nobody is told an approval is waiting"* |

(`SEED-022` / `SEED-092` also duplicate, but those are intentional `-remainder` splits.) Fixing is a
`/gsd:fast` — renumber the later-planted member of each pair and update `related_seeds` back-refs.

⚠ **The seeds register is swept by NOTHING executable.** `grep -rln "SEED" .claude/commands/gsd/`
returns `capture.md` only — the command that WRITES seeds. **250 seeds exist, 144 still `planted`.**
CLAUDE.md carries a MANDATORY sweep rule; it is honoured by the orchestrator, not by code. This
milestone's sweep was done by hand on 2026-09-04.

## Deferred Items

Acknowledged and deferred at the v3.9 close (`gsd-sdk query audit-open` → **47 open items**). None is
engineering; the verification debt above is the part that matters. Full table:
`.planning/milestones/v3.9-STATE-at-close.md` → *Deferred Items*.

| Category | Count | Detail |
|---|---|---|
| quick_tasks | 28 | 27 `missing` + 1 `unknown` — historical records whose files no longer exist |
| seeds | 14 | all `dormant`: 003, 004, 040, 041, 042, 043, 045, 046, 084, 127, 163, 164, 165, 166 |
| todos | 1 | `spike-nl-workflow-authoring.md` — largely satisfied by the Phase 097 spike answer |
| uat_gaps | 2 | 214 (`unknown`), 217 (`awaiting-operator`) |
| verification_gaps | 2 | 214 (`gaps_found`), 217 (`human_needed`) |
| debug_sessions / threads / context_questions | 0 | clear |

## Guardrail overrides

Cleared at the v4.0 start. The v3.9 overrides (including the Phase 225 `AGENTS.md` §3.1 seat
reassignment) are preserved verbatim in `.planning/milestones/v3.9-STATE-at-close.md` →
*Guardrail overrides*. Record every new override here, per the CLAUDE.md orchestrator protocol.

## Accumulated Context

Cleared at the v4.0 start. The decision log lives in `.planning/PROJECT.md` (`## Key Decisions`);
the pre-reset snapshot is `.planning/milestones/v3.9-STATE-at-close.md`. Open items carried forward
are the ones listed above under *Inherited from v3.9* — nothing else survives the reset silently.

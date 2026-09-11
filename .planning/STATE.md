---
gsd_state_version: 1.0
milestone: v4.1
milestone_name: "Ship It & Feel It"
status: roadmapped
last_updated: "2026-09-11T09:10:00.000Z"
last_activity: 2026-09-11
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 13
  completed_plans: 13
  percent: 0
requirements:
  total: 19
  delivered: 5
---

# Project State

> ⚠ **This file was RESET at the v4.0 close (2026-09-10)** — the fourth reset, and the reason is the
> same each time. The previous STATE.md had reached **1,893 lines**. **Nothing was deleted:** the
> full v4.0 file is archived verbatim at `.planning/milestones/v4.0-STATE-at-close.md`, including
> every per-phase position entry, the Phase 240 and 241 debt banners, the *Inherited from v3.9*
> section, the register-integrity sweep, the Deferred Items table and both guardrail overrides.
>
> ⚠ **Hand-edit this file. Do NOT call the `state.*` SDK verbs** — seven of them write false records
> and corrupted this file five times during Phase 190 alone while reporting success.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-09-10)

**Core value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and
can be taught new behaviors (skills) that persist and can be shared.

**Current focus:** **v4.1 Ship It & Feel It** — started 2026-09-11, a deliberate CONSOLIDATION
milestone (not v5.0: it opens no new capability axis). Ship v4.0 to production, then fix the chat
surface the operator uses daily. Phase numbering continues at **242**.

## Current Position

Phase: **242 — Ship It, and Prove What Already Shipped (CODE-COMPLETE, self-verified, UAT OWED)** · **243 — The Thinking Block and the Follow-Scroll Seam (CODE-COMPLETE, self-verified, UAT OWED)**
Plan: 242 — 2 plans + 2 G-3 fast tasks, all landed · 243 — 5 plans + 243-06 (review fixes), all landed

Status: **242 code-complete.** Commits `05203a1ed` (verifier repair) · `d3eae092b` (migration 178 + the class fence) · `1c67f20d5` (SEED-271) · `46292bb81` (changed-fields payload + stored-value refusal) · `681b82680` (register closure + VALIDATION).

⛔ **0 of 5 UAT rows driven — no browser was opened in this phase at any point.** `242-VALIDATION.md` carries them; **run Row 1 first**, and read the **network payload**, never the banner (`241-HUMAN-UAT.md` row 3: *"presence of an error is not evidence of the RIGHT error"*). SHIP-01 stays **UNTICKED** on that standard; **SHIP-02 / SHIP-03 / SHIP-04 are CLOSED with their evidence inline** in `REQUIREMENTS.md` — decisions, not quiet ticks.

⭐ **THE PHASE SHRANK BECAUSE THREE OF ITS FOUR REQUIREMENTS WERE ALREADY TRUE, AND SHRANK AGAIN WHEN A SECOND CONTEXT CLAIM WAS MEASURED FALSE.** `242-CONTEXT.md` deferred a CHECK sweep over five columns as *"a phase, not a gap"* — **migrations 174 and 176 had already constrained three of them**, so the real gap was two columns and migration **178** closed both. The fence's allow-list is therefore **EMPTY**, which is the only state in which a fence like that certifies anything. ⚠ What is genuinely open is a DIFFERENT finding: **`retrieval_top_k` and `rrf_k` have no bound anywhere** — not in Python, not in the schema. That is **`SEED-271`**, triggered by Phase 246 or the next phase touching `settings.py`.

⚠⚠ **CORRECTION TO `242-CONTEXT.md` D-242-07, measured over the read-only Supabase MCP: migration `177_rls_app_settings_user_settings.sql` IS APPLIED TO CLOUD.** The CONTEXT says *"written and NOT applied — awaits operator authorisation"*. Its own VERIFY block returns **7/7 PASS** in production and the security advisor's `rls_disabled_in_public` **ERROR is gone**. **`BUG-260911-01` is remediated in production.** ⛔ The 13 SECURITY DEFINER WARNs remain, exactly as 177's header predicted — a role-by-role revoke sweep would silently achieve nothing because the grant comes from `PUBLIC`.

⭐ **Two defects found that this phase did not cause, both fixed:** (1) `SettingsPage.a11y.test.tsx` was **RED on all four cases and in NEITHER gate knob** — proven inherited at the base commit; the cause was the suite's own `renderSettings` missing `EffectiveFeaturesProvider`, so every case audited a page whose tab never mounted. (2) ⛔⛔ **`check-hot-file-ledger.cjs` PASSED VACUOUSLY over a CRLF plan file** — `subject: 0 files · watched: 0`, `ledger gate OK`, exit 0, having parsed nothing. Both repaired and driven both ways. **A gate that passes because it read nothing answers the auditor with "clear" and stops the audit.**

⛔ **Operator-owed, named rather than implicit:** apply **migration 178 to cloud** (low urgency — cloud holds 100 and 50, both in range; it is a backstop) · walk the **non-code deploy parity half** · drive `242-VALIDATION.md`. `SEED-242` is **RE-ARMED** with a narrowed trigger (the next promotion to `production`), not closed.

⭐ **REVIEWED (self-review — solo) AND THE REVIEW ROUND FOUND A HOLE IN THIS PHASE'S BEST FENCE.** `242-VERIFICATION.md` = **3/5 mechanical · 2/5 operator-owed · 0 failed**; `242-REVIEW.md` = **0 critical · 10 warning**. The one that mattered: **§1's FIXTURE B held the `useState` INITIAL for NINE of 24 keys**, so a hard-coded baseline for any of them was green against every case — including `retrieval_match_threshold: 0.3`, the value an operator is most likely to drag the threshold BACK to. Fixture widened to differ on all 24; planting that constant now reds two cases. **The fence proves non-drift only as wide as its fixture.** Also fixed: Fast Refresh broken by exporting non-components (helpers moved to `settingsSearchPayload.ts`, eslint clean, ⚠ **`npm run lint` is NOT gated in CI**); the cloud verifier had **no row for migration 177**, the security fix (four added — **24/25 PASS against cloud**, the one FAIL being 178 as labelled); a fifth bound without the helper now reds (was `== 4`, silent); the refusal reads through an **allow-list**, not a bare `getattr` over a secrets-bearing object. ⛔ **And a safety defect in my own UAT doc:** `242-VALIDATION.md` Row 2 could be read as applying to CLOUD, which would have planted `1001` in production and broken the very tab this phase repaired. Rows 2/3 now say `LOCAL ONLY` in their own headers. Full round: `242-03-SUMMARY.md`.

⚠ Gates at 242's close: backend **71 failed / 4548 passed**, failing SET **identical** to `242-backend-base-set.txt` (ceiling held, zero headroom) · `count gate OK — 259/259, failed 0, 8046 → 8077`, every +1 attributed with no residual · typecheck **67**, set diff **empty both ways** · `check-deploy-drift.sh` **PASS** · ledger + CLAUDE.md-size gates exit 0. Both G-5 rows (`settings.py` **38/20/972**, `SettingsPage.tsx` **47/24/1773** — it SHRANK) were **stale for the third consecutive close** and were re-derived with the raw output in `242-02-SUMMARY.md`.
Status: **243 code-complete.** 5/5 ROADMAP success criteria verified MECHANICALLY, each opened in the code rather than scored from a SUMMARY. ⚠ **`243-VERIFICATION.md` reads `human_needed` and says "self-verified", never "reviewed"** (`OV-SOLO-01` — no independent reviewer exists). ⛔ **0 of 20 UAT rows driven — no browser has been opened in this phase at any point.** Run **L-2 first** (real wheel, ≥50-message thread): `243-06`'s HI-2 was exactly the class of defect a synthetic `WheelEvent` cannot see, and `BUG-260823-01`'s own history records two fixes that passed synthetic events and failed a real mouse. **CHAT-02 and CHAT-04 are ticked; CHAT-01, CHAT-03 and CHAT-05 are deliberately UNTICKED** — their deliverables are perceptions and every fence is synthetic. All three bug reports (`BUG-260718-02`, `BUG-260823-01`, `BUG-260707-03`) stay `folded`, not `closed`, on the same standard.

Status: **243-04 EXECUTED — sketch 234 V1 shipped, and the phase's one genuine design gap was closed by REFUSING the mockup's number.** The body drops the four classes and steps to `text-sm`, rendering REAL paragraphs (`b9819b7ab`); the tail clamps at 300px with a control that **removes itself** below the measured threshold — the shipped sketch-050 mechanism COPIED, never mounted (`96ca3909c`); and the fold label reads `Thought for N seconds` **only when a span was measured** (`2a988c3de`). ⛔ **D-243-13 honoured mechanically:** the sketch's `Math.round(chars / 180)` is a DEMO AFFORDANCE, and on the 32,951-char fixture it computes to *"Thought for 183 seconds"* — a plausible number derived from string length. `grep -c "/ 180"` is **0**; a DB-loaded message reads `Thinking` with **no digit**; `git diff --stat -- supabase/ backend/` is **EMPTY**. ⚠ **THE ONE DECLARED DIFFERENCE FROM THE ACCEPTANCE BAR** (for `243-VERIFICATION.md` to carry): the mockup reads `Thought for 6 seconds` on EVERY message including historical ones; the shipped surface reads `Thinking` on any message it did not watch stream. **Declared with its reason = a decision; undeclared = drift.** ⭐ **Two plan errors found by driving rather than assuming:** (1) §10's uniqueness needle matched **ZERO** files after the render shape changed — re-aimed as an alternation of two NAMED shapes, because the obvious widening was measured to match two innocents; (2) `MessageItem.tsx` had to take the new prop and is **not in `files_modified`** — edited anyway, with its ledger row updated in the same commit, since the ledger gate reads `files_modified` and not the diff. **That is the identical blindness the plan cites to CLOSE the formatter extraction, arriving from the other direction.** ⚠ `BUG-260718-02` → **`folded`, NOT `closed`**: the code half is measured and named commit-by-commit, but the reported defect is a PERCEPTION and every fence here is synthetic — the same standard 243-03 held its sibling to. `SEED-269` planted (three elapsed formatters, one home owed). `count gate OK — 254/254, failed 0, 7994→8017`; typecheck 67, **set diff empty both ways**. Four ledger triples re-derived; `StreamsProvider.tsx`'s row was STALE for the SECOND time in two plans, written one plan earlier the same day.

Status: **243-03 EXECUTED — the phase’s most consequential plan, and the RED drive changed its shape.** CHAT-02: the delta path now coalesces PRODUCER-side (`makeAccumulatingCoalescer`, 60 ms, leading edge) — **60 deltas made 61 `setMessages` calls and now make 12** (`bfdf899b1`). CHAT-03: **D-243-05 outcome 3** — a residual DID reproduce at HEAD and it is **NOT** the defect `BUG-260823-01` names; that report’s cause was deleted by `64357e979`, which is measured to be a **quick task 7h48m BEFORE Phase 228 was scoped**, not a 228 commit. The real residual: a nudge up under 120px releases the pin but stays “near bottom”, so between the 900 ms hard clock and the 1500 ms gesture window **any** scroll event re-pinned the reader. One ref, one clause, at the line D-243-05 predicted (`8d7dfab43`); the mirror (a flick back DOWN still re-arms) stays green. ⭐ **D-243-04 MEASURED rather than asserted:** 60 real deltas produced **61** `scrollIntoView` calls before the coalescing and **13** after, with `useFollowScroll.ts` held constant — and `MessageList.tsx` needed **no edit at all**. ⚠ A trap the plan did not name broke two shipped tests and was caught by a base-set diff (13 base / 15 / 13): every STRUCTURAL callback must drain the text buffer or Anthropic’s interleaved text/tool_use order inverts. `count gate OK — 253/253, failed 0`; typecheck 67, set diff empty. Three suites into both knobs — **`throttle.ts` had been ungated since 068.5**. Four ledger triples re-derived; `useFollowScroll.ts` and `throttle.ts` had **NO ROW AT ALL**, so G-5 was structurally absent on the very file this bug is about. ⚠ `BUG-260823-01` stays **`folded`, not `closed`** — every fence here is a synthetic `WheelEvent`, and this file’s own history records two fixes that passed those and failed a real mouse. **A real-wheel UAT row is owed** (`re_open_trigger` now says so; `SEED-049`/D-243-09 agree).
Progress: 0 / 5 phases CLOSED · **2 of 5 CODE-COMPLETE (242, 243), both UAT-owed** · 4 / 19 requirements delivered (SHIP-02, SHIP-03, SHIP-04, CHAT-02, CHAT-04 — ⚠ SHIP-01, CHAT-01, CHAT-03, CHAT-05 are code-complete and deliberately UNTICKED pending G-4 rows) · `[██░░░░░░░░] 21%`
Last activity: 2026-09-11 — **Phase 242 planned and executed end-to-end**: a Python-only bound became a schema constraint over an EMPTY fence allow-list, the Search tab stopped sending what nobody changed, and three SHIP claims closed by measurement — while two guards that were passing vacuously turned out to be the phase's most useful finding

**Phases:** 242 Ship It · 243 Thinking block + follow-scroll seam (⚠ sketch first) ·
244 Chat shell + composer · 245 The verification debt · 246 The recall cliff.
Full detail: [`ROADMAP.md`](ROADMAP.md).

### ⚠⚠ THE FORCED ORDER WAS RESOLVED BY EVENTS — the original is kept below, never overwritten

This section read, at scoping:

> ⚠ **Order is FORCED at the front of this milestone and cannot be re-sequenced for convenience:**
> `BUG-260910-03` (blocking, Settings→Search unsaveable) → **241 UAT row 5 on CLOUD** → migrations
> `153-156, 166-176` in numeric order → production push. Row 5 proves an arm that becomes
> **unreproducible forever** once migration 176 reaches cloud.

⛔ **Every clause after the first is already spent, measured at HEAD on 2026-09-11 while writing the roadmap:**

- **The production push already landed** — `1f313670b` *"Merge master into production — deploy v4.0 Connected Knowledge"* (2026-09-10), plus `e65610ac2` for the `app.<domain>` routing half. `git log --oneline production..develop` returns **2 commits, both v4.1 planning docs**.
- **Row 5's cloud window is CLOSED, and its loss is already written down.** `241-HUMAN-UAT.md` reads `status: complete`, 6/6 driven; row 5 ran on a **local substitute** and its closing section states the fifteen migrations — 176 included — went to cloud as one batch during the production prep. Retired in writing at `dbd63864b`. **`SHIP-02` is not re-plannable.**
- **The migrations are therefore CLAIMED applied**, by a record rather than by a measurement. Phase 242 runs `scripts/verify-v40-cloud-migrations.sql` **against cloud**.
- **`SHIP-01` is genuinely open** — but only its structural half: `settings.py:466-467`'s bound, `SettingsPage.tsx:888`'s all-or-nothing payload, and the missing CHECK constraint are all still live at HEAD. The `1001 → 1000` data fix landed **locally** and was left in place, so the bug no longer reproduces there. ⚠⚠ **The value cloud holds is UNMEASURED, and cloud is what production serves.**

⭐ **This is the milestone's own method rule paying for itself on day one:** *a register knows only the register below it, and the code is the bottom.* Two sections of this file and four requirement statements were true when written and false within twenty-four hours. **`STATE.md` and `REQUIREMENTS.md` both still say "v4.0 has never deployed" elsewhere; those sentences are stale and are corrected here rather than deleted there.**

⚠ **What STILL stands, unchanged:** `RECALL-01` depends on `SHIP-01` (Phase 246 after Phase 242, and its plans assert the tab saves rather than assuming it) · `CHAT-02` and `CHAT-03` are one mechanism and share Phase 243 · G-2 fires on Phase 243 with the operator-approved mockup as the acceptance bar · `retrieval_service.py`'s extraction, owed since Phase 231, is **proposed first** at Phase 246.

### ⚠ Two phases can be blocked on something that is not engineering

| Phase | Blocked on | Deliverable without it |
|---|---|---|
| **242** | a read-capable **cloud DSN** | SC#2 + SC#3 — the CHECK migration, the changed-fields-only payload, the worded refusal. Sequence these first so the phase is never idle |
| **245** | **one Azure app registration** — ⚠ **run row M-1 first, it unblocks the other 8** | `DEBT-02` and `DEBT-03` in full, plus `DEBT-01`'s retirement arm |

### ⚠ G-8 is the governor on this milestone

Plan targets: **242 → 3-4 · 243 → 4-5 · 244 → 4-5 · 245 → 2-3 · 246 → 3-4.** A phase above **6** must name in CONTEXT.md what genuinely cannot share a worktree. A fix that is ≤ 1 file / ≤ 10 lines with no schema or API surface is **`/gsd:fast` under G-3, never a plan**. The named failure mode is Phase 235's **17 plans for 4-6 plans of substance** — and a consolidation milestone has no natural stopping point.

⚠ **`OV-SOLO-01` was RULED ON at this milestone's scoping (2026-09-11, operator), not left to
lapse.** Solo running continues. The substitute for the independent gate: the dispatched
code-review subagent is **MANDATORY** on any phase touching a trust boundary, and every phase closed
under it reads **"self-verified"** in its own VERIFICATION.md — never "reviewed".

⚠ **`SURF-03` was RULED ON at the same moment** — its home is the **app shell**, landing in the
chat-shell phase. It is no longer an open scoping question.

---

## Carried into v4.1 from the v4.0 close

The nine sections below were written at the v4.0 close. **They are the input to this milestone, not
history** — items 1, 2, 3, 4, 5 and 6 are now scoped into v4.1 phases; items 7, 8 and 9 remain live
constraints on how it is built.

---

## ✅ v4.0 CONNECTED KNOWLEDGE — CLOSED 2026-09-10

**The premise came true.** A source is connected once and then read by itself: Google Drive,
OneDrive/SharePoint via Microsoft Graph, **any** MCP file server, and mail — four families over ONE
`browse / list / read / check` contract, with connection-scoped visibility enforced at all four RLS
sites and a durable queue underneath.

**Record:** [`MILESTONES.md`](MILESTONES.md) · roadmap archive
[`milestones/v4.0-ROADMAP.md`](milestones/v4.0-ROADMAP.md) · requirements
[`milestones/v4.0-REQUIREMENTS.md`](milestones/v4.0-REQUIREMENTS.md) · audit
[`milestones/v4.0-MILESTONE-AUDIT.md`](milestones/v4.0-MILESTONE-AUDIT.md) · state at close
[`milestones/v4.0-STATE-at-close.md`](milestones/v4.0-STATE-at-close.md).

⚠ **All fourteen phase directories moved to `.planning/milestones/v4.0-phases/` at this close**, so every `NNN-*.md` named below lives there — e.g. `.planning/milestones/v4.0-phases/238-microsoft-graph-onedrive/238-UAT.md`. `.planning/phases/` is now empty of v4.0 work. ⚠ One stray remains there: `206-mcp-connector-client-workflow-scoped/206-01-PLAN.md`, an **older draft** of a file already archived complete under `milestones/v3.8-phases/` (it reappeared at `ba59d36b0`, after the v3.8 archive). Left in place rather than deleted — it is not this milestone's to remove.

---

## ⛔ CARRIED PAST THE CLOSE — decisions, not oversights

Each of these was **stated at the close rather than absorbed into it.** A closing milestone that
lists only what passed is not a record.

### 1. ⚠⚠ ONE OWED ITEM HAS AN EXPIRY DATE — read this before any production push

**Phase 241's UAT row 5 must run on CLOUD *before* migration 176 is applied there.** After 176
lands, the "no columns" arm it exists to prove is unreproducible **forever**. Five of 241's six rows
are driven and passed; row 5 is the one that dies. File: `.planning/milestones/v4.0-phases/241-recall-at-corpus-scale/241-HUMAN-UAT.md`.

⚠ It collides with the item directly below: **applying the pending migrations is exactly what kills
it.** Row 5 first, then the migrations — in that order, or not at all.

### 2. ⛔ Cloud is 15 migrations behind

`153, 154, 155, 156, 166..176` are all pending; **v4.0 has not deployed.** Operator decision
2026-09-10: they are applied immediately **before** the next push, not now. Run
`bash scripts/pending-cloud-migrations.sh` and apply the printed set in NUMERIC ORDER, once each,
by pasting into the cloud Supabase SQL editor.

### 3. ⛔ Three phases owe an independent §6.3 review — 238, 240, 241

No independent reviewer exists: Gemini has been unavailable since 2026-09-09 and the operator has
ruled out `/code-review ultra` on cost. **Their verdicts are the builder's own, and the v4.0
milestone audit is a self-audit for the same reason.** What that does not weaken is the mechanical
evidence — a hash, a byte-identical file, a driven function. What it weakens is every judgement call
about whether an owed item was acceptable. ⚠ See `OV-SOLO-01` below: **its re-arm trigger has now
fired and the condition it described is still true.**

### 4. ⛔ Two UAT sets are credential-blocked

| Phase | Rows | Blocked on |
|---|---|---|
| 238 | **9** | one Azure app registration (`MICROSOFT_OAUTH_CLIENT_ID/SECRET`) — **run M-1 first, it unblocks the other 8**; SharePoint rows S-1/S-2 separately on `SEED-256` (no work/school tenant) |
| 241 | **1** (row 5 of 6) | a read-capable cloud DSN — ⚠ **and it expires, see item 1** |

Also owed from earlier in the milestone and never driven: **233's five G-4 rows**, **236's live
SC#1 was driven** (2026-09-06, 8/8 providers — this one is DONE), **237's rule-builder surface was
never manually clicked** (owed by decision).

### 5. ⛔ `QUEUE-06` is not met out of the box

241 measured the defect and shipped the remedy, but **the default is unchanged**: at
`hnsw.ef_search = 40` a tenant owning 0.2% of a 100k-chunk corpus scores `recall@20` **0.040**.
`ef_search = 200` restores **1.000**. ⚠ The degradation is a **cliff, not a slope** — an install can
cross it with **no deploy and no setting change**. `D-v4.0-EF-DEFAULT` records why the default was
left alone; the cost is that the requirement is honestly unticked.

### 6. ⛔ `SURF-03`'s home is an open SCOPING decision, not a build

There is no in-app notification surface in this product. The recommendation is an app-shell signal
**plus** the Health-tab row; **closing it against the Health tab alone does not satisfy it.** This
is a product question for the operator at the next `/gsd:new-milestone`.

### 7. ⚠ `retrieval_service.py`'s G-5 extraction, owed since 231

241 was the deliberate **second** landing (11 non-comment lines, fence driven RED at 13).
**A third landing must propose the extraction FIRST.**

### 8. ⚠ Register debt that the next milestone opens against

| | |
|---|---|
| Planted seeds | **161** of 275 — ⚠ CLAUDE.md's sweep rule says `/gsd:new-milestone` reads every `trigger_when`. **At 161 that sweep is a phase of work, not a step in a command**, and a `trigger_when` nobody reads is a deferral with no re-open, which is a deletion that looks like a decision |
| Open reported bugs (`surface: Agentic-RAG`) | **34** |
| New seeds from 241 | `SEED-265` (connection-by-id / saved-View recall axes were never built) · `SEED-266` (`full-schema.sql` ACL + `row_security`) · `SEED-267` / `SEED-268` (WR-02/03/04/06, and the harness's unproven exact arm) |
| ⚠ `SEED-177` | still reads `status: planted` while its retire-the-egress-fence trigger **already fired** |
| Plans with no SUMMARY.md | `232-04` (landed `1ae6defbb`) and `235-17` (landed `29858f01f`) — in git, absent from the phase record |
| `BUS-171` | the operator-queue triage (23 items `--to operator`) is **parked, not dropped** |
| `SEED-242` | still armed — `app.<domain>` at the next production push |

### 9. ⭐ The method finding worth carrying into the next milestone

**A review is a CLAIM about code, not the code.** Measured three times in one hour by the audit
written to catch it: the audit asked *"is a VERIFICATION file present?"* and never opened the review
that was there; the correction opened the review and escalated its two CRITICALs to *"open, data
loss"* and never opened the code — they had been fixed two days earlier, in an ancestor of the
auditing commit. **Each register only knows the one below it, and the code is the bottom. Drive it,
or do not report it.**

---

## Deferred Items

Acknowledged and deferred at the v4.0 close (`gsd-sdk query audit-open` → **48 open items**). None
is engineering; **the verification debt listed above is the part that matters.** Full item-level
table: `.planning/milestones/v4.0-STATE-at-close.md` is the pre-close snapshot; the live list is
re-derivable at any time with `gsd-sdk query audit-open`.

| Category | Count | Detail |
|---|---|---|
| quick_tasks | **29** | 28 `missing` + 1 `unknown` — historical records whose files no longer exist (was 28 at the v3.9 close; one added) |
| seeds | **14** | all `dormant`: 003, 004, 040, 041, 042, 043, 045, 046, 084, 127, 163, 164, 165, 166 — ⚠ unchanged for two milestones running |
| todos | **1** | `spike-nl-workflow-authoring.md` — largely satisfied by the Phase 097 spike answer |
| uat_gaps | **2** | 233 (`unknown`, 5 rows) · 241 (`partial`, 5/6 driven) |
| verification_gaps | **2** | 239 (`human_needed`, **no code defects** — its 2 CRITICALs and 4 HIGHs are closed and were independently re-driven) · 241 (`human_needed`) |
| debug_sessions / threads / context_questions | **0** | clear |

## Guardrail overrides

Both v4.0 overrides are preserved verbatim in `.planning/milestones/v4.0-STATE-at-close.md` →
*Guardrail overrides*. Record every new override here, per the CLAUDE.md orchestrator protocol.

### ⭐ OV-SOLO-01 — RULED ON 2026-09-11 BY THE OPERATOR. It did NOT lapse.

**Ruling (operator, 2026-09-11, at v4.1 scoping):** **solo running continues.** The substitute for the
independent gate is the **dispatched code-review subagent**, which is **MANDATORY** on any phase
touching a trust boundary. ⛔ **It is NOT an independent gate**, and every phase closed under it must
read **"self-verified"** in its own VERIFICATION.md — never "reviewed". `/code-review ultra` stays
**ruled out on cost**.

⭐ **It is also not worthless, and that is measured rather than assumed:** on Phase 239 exactly this
arrangement returned **19 findings including 2 Criticals**, one being a destructive tool bindable as
the file *reader* and then called by the watch loop on every file, unattended.

**What does NOT lapse either way:** decisions still go to the operator, never self-settled. Baselines
are still captured before source work. RED-first still holds. The mechanical gates — backend ceiling,
count gate, hot-file ledger, CLAUDE.md size — are unaffected by who is at the keyboard and remain the
honest floor.

**Re-arm trigger:** Gemini's quota returns, **or the v4.1 close, whichever is first.** ⚠ The previous
version of this override carried a date-based trigger that arrived and was not acted on for a day —
which is precisely how a self-verification comes to read like a review. **`DEBT-03` (Phase 245) exists
to close that gap in writing**, on phases 238, 240 and 241.

**Applies to:** every phase in v4.1 (242-246).

---

#### ⚠ The original entry, preserved — OV-SOLO-01 before the ruling

`OV-SOLO-01` (operator, 2026-09-08) set aside `AGENTS.md` §3 / §6.3 — the two-agent separation
itself — for 2026-09-08 and 2026-09-09, with the re-arm trigger *"Gemini's quota returns, or
**2026-09-10**, whichever is first."*

⛔ **2026-09-10 has arrived and Gemini is still unavailable.** The override is therefore **neither
expired-and-honoured nor silently extended** — it is recorded here as an **open operator decision**,
because letting it lapse unnoticed is exactly how a self-verification comes to read like a review.
Three phases (238, 240, 241) already closed under it.

**The operator's ruling is needed on one question:** does solo running continue into the next
milestone, and if so, what stands in for the independent gate? `/code-review ultra` is ruled out on
cost, and a code-review subagent that claude dispatches is claude's own work checking itself —
⭐ **though not worthless: on Phase 239 exactly that arrangement returned 19 findings including 2
Criticals**, one of which (a destructive tool bindable as the file *reader*, then called by the
watch loop on every file, unattended) would otherwise have shipped.

**What does NOT lapse either way:** decisions still go to the operator, never self-settled.
Baselines are still captured before source work. RED-first still holds. The mechanical gates —
backend ceiling, count gate, ledger, CLAUDE.md size — are unaffected by who is at the keyboard and
remain the honest floor.

## Gates at the v4.0 close

| Gate | Reading |
|---|---|
| Backend unit | **71 failed / 4491 passed** — the project ceiling **exactly**, and the failing **SET** diffed identical in both directions, not merely an equal count |
| Vitest count gate | RED on 3-4 **provably-unmodified** `SEED-171` flakes — captured before any re-run, per the triage procedure |
| Hot-file ledger · CLAUDE.md size · G-7 | all clear |

## Accumulated Context

Cleared at the v4.0 close. The decision log lives in `.planning/PROJECT.md` (`## Key Decisions`) —
eight v4.0 decisions were added there at this close. The pre-reset snapshot is
`.planning/milestones/v4.0-STATE-at-close.md`. **Open items carried forward are the nine sections
above — nothing else survives the reset silently.**

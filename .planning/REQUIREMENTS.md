# Requirements — v4.1 Ship It & Feel It

**Milestone:** v4.1 · **Started:** 2026-09-11 · **Phase numbering continues at 242**

**Goal:** v4.0 stops being code that exists and becomes a product in production — and the surface the
operator touches every day stops feeling busier than the bar it is aimed at.

⭐ **This is a CONSOLIDATION milestone.** It opens no new capability axis; that is why it is v4.1 and
not v5.0. Every requirement below closes something already in a register — a shipped-but-undeployed
migration, an open reported bug, a seed whose trigger is already true, or a v4.0 item carried past
its close by decision. **Nothing here is a new idea.**

⚠ **Where a requirement inherits a claim from a bug report or a seed, the claim is to be DRIVEN
before it is planned against.** `BUG-260718-02`'s part B was already fixed in code while its report
still read `status: open` — found by opening `MessageItem.tsx:470`, not by reading the register. A
register knows only the register below it; the code is the bottom.

---

## v4.1 Requirements

### SHIP — v4.0 reaches production

> ### ⛔ CORRECTION 2026-09-11, hours after this section was written — MEASURED, not read
>
> **The four SHIP requirements below were written from `STATE.md`'s v4.0-close text, which was true
> when written and false within a day.** The originals are preserved verbatim rather than
> overwritten, because *how* they went stale is the finding. Driven at HEAD while writing the roadmap:
>
> | Claim below | Measured |
> |---|---|
> | *"v4.0 has never deployed"* / *"cloud is 15 migrations behind"* | ⛔ **FALSE.** `production` is at `e65610ac2`, containing `1f313670b "Merge master into production — deploy v4.0 Connected Knowledge"` (2026-09-10). `git log --oneline production..develop` = **2 commits, both v4.1 planning docs** |
> | **SHIP-02** — row 5 is owed and expires | ⛔ **SPENT, and its loss already written.** `241-HUMAN-UAT.md` reads `status: complete`, 6/6; row 5 ran on a **local substitute** and its own text says the fifteen migrations, 176 included, went to cloud as one batch during the deploy prep. Retired in writing at `dbd63864b`. **Not re-plannable — the database shape it needs exists nowhere** |
> | **SHIP-03** — migrations owed | ⚠ **CLAIMED applied by the deploy record, UNVERIFIED by measurement.** Phase 242 queries cloud rather than re-reading the record |
> | **SHIP-04** — the push is owed | ⛔ **ALREADY HAPPENED.** Not a push to schedule; a deployed state to verify. `SEED-242`'s routing half also landed, at `f63a8ebcc` |
> | **SHIP-01** — blocking bug | ✅ **STILL OPEN, and the register UNDERSTATES it.** `settings.py:466-467`'s bound, `SettingsPage.tsx:888`'s all-or-nothing payload and the missing CHECK constraint are all live. But the `1001 → 1000` data fix landed **locally and was left there**, so it no longer reproduces on the install the report names. ⚠⚠ **What cloud holds is UNMEASURED, and cloud is what production serves** |
>
> ⚠ **The forced ordering — row 5 → migrations → push — was RESOLVED BY EVENTS, in the wrong order.**
> The rule stands for any future expiring row; what is corrected is the belief that *this* window is
> still open. **A roadmap that plans an unreproducible drive is a roadmap that cannot close.**
>
> ⭐ **This milestone's own method rule paid for itself on day one:** *a register knows only the
> register below it, and the code is the bottom.*
>
> ### ⛔ SECOND PASS 2026-09-11 — CLOUD ITSELF WAS READ, and it closes three of the four
>
> The corrections above were driven against **git**. At `/gsd:discuss-phase 242` the **Supabase MCP**
> was authenticated (read-only OAuth) and production was queried directly — the read path the phase
> was written as *blocked on*. ⭐ **The DSN blocker does not exist.**
>
> | | Measured against CLOUD |
> |---|---|
> | **SHIP-01** | `multimodal_max_vision_calls = 100` — in range. **The Search tab saves fine in production.** The defect was local-only and the local data fix already cleared it. What remains is preventive: a CHECK constraint and a changed-fields-only payload |
> | **SHIP-03** | ✅ **17 structural checks PASS** — `153-156, 166..176` all present. ⚠ TWO FALSE ALARMS: `156` read FAIL because `information_schema.column_privileges` only shows grants visible to the connecting role; `pg_attribute.attacl` shows `authenticated=arw, service_role=arw`, migration 156's exact set — **the script is wrong, not the database**. `176`'s FAIL is its designed inversion |
> | **SHIP-04** | ✅ confirmed against the database, not only against git |
> | **`RECALL-01`** | ⚠ **NOT live in production.** `hnsw_ef_search` is NULL, but cloud is **2,068 chunks · 47 docs · 1 owner · 1 org** — the cliff needs a small tenant fraction of a large corpus, and this is single-tenant at 50× smaller. **Scale-ahead work; stays in Phase 246.** Re-open at a second tenant or ~20k chunks |
>
> Full record: `.planning/phases/242-ship-it-and-prove-what-already-shipped/242-CONTEXT.md`.

- [ ] **SHIP-01**: An operator can save the Settings → Search tab. Today every save returns HTTP 400
      because a **stored** `multimodal_max_vision_calls` of `1001` sits outside the bound the API
      enforces, and the banner names a field the operator never touched. Closes `BUG-260910-03`
      (**severity: blocking**, reported 2026-09-10, reproduces on the operator's live local install).
      ⚠ **This is a prerequisite for RECALL-01, not a parallel item** — `hnsw_ef_search` is set on the
      tab that cannot save, so the `QUEUE-06` remedy Phase 241 shipped is presently unreachable.
- [ ] **SHIP-02**: Phase 241's UAT row 5 is driven on **cloud** and recorded, or explicitly retired
      with a written reason. ⚠ **It expires:** the "no columns" arm it exists to prove becomes
      unreproducible **forever** once migration 176 is applied to cloud. Source:
      `.planning/milestones/v4.0-phases/241-recall-at-corpus-scale/241-HUMAN-UAT.md`.
- [ ] **SHIP-03**: Cloud runs v4.0. Migrations `153, 154, 155, 156, 166..176` applied in numeric
      order, once each, by pasting into the cloud Supabase SQL editor — never `db push` / `db reset`.
      The non-code parity half (env vars, seed rows, provider keys, `SANDBOX_IMAGE`) completed per
      `docs/DEPLOYMENT-WORKFLOW.md`.
- [ ] **SHIP-04**: The production push is proposed to the operator and waits for an explicit yes.
      `develop` → `master` → `production`, promoted surgically. Carries `SEED-242` (`app.<domain>`),
      whose routing half already landed at `f63a8ebcc`.

### CHAT — the thinking block and the follow-scroll seam

- [ ] **CHAT-01**: During a reasoning stream the thinking block reads as a calm, structured surface,
      not a flat `whitespace-pre-wrap` font-mono blob (`RunCard.tsx:501`). The operator's stated
      comparison is Claude.ai — a single calm line while streaming, expandable into a timeline.
      ⚠ **G-2 fires: `/gsd:sketch` first, and the operator-approved mockup is the acceptance bar.**
      Closes `BUG-260718-02` part A. Folds `SEED-032` (reasoning real-time UI parity).
- [ ] **CHAT-02**: Reasoning deltas reach the UI on a coalesced cadence. Today
      `StreamsProvider.tsx:421-425` fires a full `setMessages` **per token**, unthrottled — while
      `lib/throttle.ts` exists and is wired only to the cache writer, never to the UI path.
- [ ] **CHAT-03**: Scrolling up during a tool call leaves you where you scrolled. Today
      `MessageList.tsx:164-176` re-runs per token (its deps include `messages`) and calls
      `scrollIntoView` each time — with `behavior: "smooth"` whenever a tool is preparing.
      ⭐ **This is the same seam as CHAT-02's repaint**, and it is `BUG-260823-01`'s root cause:
      two open bugs, one mechanism. Scoping them apart would fix one and re-break the other.
- [x] **CHAT-04**: Reasoning is visible on pure-text replies, not only on tool-bearing turns.
      ~~`MessageItem.tsx:437-439` gates it on tool calls today, so a reasoning model answering a
      plain question shows no thinking at all.~~
      ⚠ **THE LINE NUMBER WAS WRONG AND THE DIAGNOSIS WAS WRONG, and the original is struck
      through rather than deleted because the correction is the useful part** (D-243-14). The
      gate was at `MessageItem.tsx:359-361`, not `:437-439` — `:425` is the `StreamingNarration`
      branch, a different construct that gates on the same predicate, which is why the wrong line
      survived three documents. And **removing a gate would have revealed nothing**: `RunCard` was
      the ONLY renderer of `reasoningContent` in the codebase, and it is mounted only on a
      tool-bearing turn.
      ✅ **CLOSED 2026-09-11 by `243-02`** (`2a62acb60`): the fold is now `ThinkingBlock.tsx`,
      self-guarding on its own content and mounted from `MessageItem` with **no tool test
      anywhere** — the conditionality disappears by construction. Measured: exactly ONE JSX-child
      render of the reasoning value in `frontend/src`. 105 of 340 reasoning-bearing rows (**31%**)
      are the shape that had never been drawn.
- [ ] **CHAT-05**: A finished answer resolves out of the narration fold live, on the mount/navigation
      path as well as the send path. `BUG-260707-03`'s send-path reconcile shipped; its residual #2
      (a backgrounded run watched after navigation) still relies on a reload.

### SHELL — the chat shell and composer

- [ ] **SHELL-01**: Chat scrolls inside chat. The nav rail stays put and no dead space opens under
      the composer. Closes `BUG-260828-08`.
- [ ] **SHELL-02**: A cap-paused Deep run leaves the operator a usable composer, or offers the
      control that actually resumes it — never a disabled composer alongside a message telling them
      to use it. Closes `BUG-260904-05`; folds `SEED-029` (Continue-on-cap), which **is** this fix
      rather than a separate idea.
- [ ] **SHELL-03**: Approve / Do-not-run render in the chat thread, not only in the workflow panel.
      Closes `BUG-260828-07` (**severity: high**).
- [ ] **SHELL-04**: A person can attach a local file to a chat message, and a cloud import chooses
      its Library folder instead of writing permanently to the Library root. Closes
      `BUG-260905-01`; folds `SEED-042` (ephemeral file attach — the "not in the KB" half).
- [ ] **SHELL-05**: A watched source that has stopped reading raises a signal in the **app shell**,
      not only on the Health tab. Closes `SURF-03`, carried unticked out of v4.0 as an open scoping
      decision and **ruled on at this milestone's scoping**: the Health tab alone was already
      recorded as insufficient.

### DEBT — v4.0's verification debt, discharged or explicitly retired

- [ ] **DEBT-01**: Phase 238's **9** UAT rows driven, or retired row by row with a written reason.
      Blocked on one Azure app registration (`MICROSOFT_OAUTH_CLIENT_ID` / `_SECRET`) — ⚠ **run M-1
      first: it unblocks the other 8.** SharePoint rows S-1 / S-2 sit separately on `SEED-256`
      (no work/school tenant) and may be retired on that ground alone.
- [ ] **DEBT-02**: Phase 233's **5** G-4 operator rows driven. Owed since the phase shipped and never
      run.
- [ ] **DEBT-03**: Every v4.0 phase that closed without an independent §6.3 review (**238, 240, 241**)
      says **"self-verified"** in its own record, and the `OV-SOLO-01` ruling is written into
      `STATE.md → Guardrail overrides` rather than left to lapse. ⚠ **A verdict that reads "reviewed"
      when it was the builder's own is the failure this requirement exists to prevent.**

### RECALL — the cliff, and the screen that describes it

- [ ] **RECALL-01**: A tenant owning a small share of a large corpus gets honest recall **out of the
      box**. Measured at the v4.0 close: at the default `hnsw.ef_search = 40`, a tenant owning 0.2% of
      a 100k-chunk corpus scores `recall@20` of **0.040**; `ef_search = 200` restores **1.000**.
      ⚠ **It is a cliff, not a slope** — an install crosses it with no deploy and no setting change.
      `QUEUE-06` is honestly unticked today; this ticks it. Depends on **SHIP-01**.
      ⚠ **`retrieval_service.py` is at its THIRD G-5 landing** (owed since 231, second landing was
      241): the extraction must be **proposed before** any change lands there.
- [ ] **RECALL-02**: The Settings screen cannot display a search breadth that is not in effect.
      Today the no-op shortcut compares against a hardcoded `40` rather than what the server holds.
      Folds `SEED-268`.

---

## Traceability

Filled by the roadmapper 2026-09-11. **Every REQ-ID above maps to exactly one phase. 19 / 19 mapped, no orphans, no duplicates.**

⚠ **THE COUNT IS 19, NOT 17.** This file's own header block, `PROJECT.md`, and commit `c1a395abf` (*"17 REQ-IDs, 5 categories"*) all say **17**. Counted from the checkboxes above: **SHIP 4 · CHAT 5 · SHELL 5 · DEBT 3 · RECALL 2 = 19.** The original figure is recorded rather than overwritten, because **a coverage check run against the wrong denominator is exactly how a requirement survives a whole milestone unnoticed** — and this is the second consecutive milestone it has happened on (v4.0 opened saying *34* against an actual *38*).

| REQ-ID | Phase | Status |
|---|---|---|
| SHIP-01 | 242 — Ship It | Pending |
| SHIP-02 | 242 — Ship It | Pending — ⚠ **its second arm is ALREADY SATISFIED**, retired in writing at `dbd63864b`; the drive is unreproducible |
| SHIP-03 | 242 — Ship It | Pending — ⚠ claimed done by the deploy record, **unverified against cloud** |
| SHIP-04 | 242 — Ship It | Pending — ⚠ **the push already landed** at `1f313670b` (2026-09-10); what is owed is the verification |
| CHAT-01 | 243 — Thinking block + follow-scroll seam | **Code-complete, UAT-owed.** G-2 sketch DONE (234 V1 / 235 B). 243-01 the net; **243-02 the STRUCTURE**; **243-04 the APPEARANCE** — four classes out, `text-sm`, real paragraphs, a self-removing clamp, and an HONEST duration (`b9819b7ab`, `96ca3909c`, `2a988c3de`). ⚠ **The box stays unticked deliberately:** the requirement's words are *"reads as a calm surface"*, which is a PERCEPTION, and every fence shipped for it is synthetic — the same standard on which `BUG-260718-02` was left `folded` rather than `closed`. Tick it at `/gsd:verify-work 243`, after the G-4 row. ⚠ One DECLARED difference from the acceptance bar (D-243-13) is recorded in `243-04-SUMMARY.md` for `243-VERIFICATION.md` to carry |
| CHAT-02 | 243 — Thinking block + follow-scroll seam | Pending |
| CHAT-03 | 243 — Thinking block + follow-scroll seam | Pending — ⭐ **one mechanism with CHAT-02; may not be split** |
| CHAT-04 | 243 — Thinking block + follow-scroll seam | ✅ **DONE 2026-09-11 (`243-02`, `2a62acb60`)** — 243-01 pinned the defect as §8; 243-02 INVERTED it. One reasoning renderer, mounted unconditionally. ⚠ The requirement's own line number (`:437-439`) was wrong — corrected in place, not deleted |
| CHAT-05 | 243 — Thinking block + follow-scroll seam | Pending |
| SHELL-01 | 244 — Chat shell + composer | Pending |
| SHELL-02 | 244 — Chat shell + composer | Pending |
| SHELL-03 | 244 — Chat shell + composer | Pending |
| SHELL-04 | 244 — Chat shell + composer | Pending — ⚠ G-2 sketch owed (net-new surface) |
| SHELL-05 | 244 — Chat shell + composer | Pending — ⚠ G-2 sketch owed (net-new surface) |
| DEBT-01 | 245 — The verification debt | Pending — ⚠ blocked on one Azure app registration; **M-1 first** |
| DEBT-02 | 245 — The verification debt | Pending |
| DEBT-03 | 245 — The verification debt | Pending — ⭐ **honesty requirement, NOT a re-review** |
| RECALL-01 | 246 — The recall cliff | Pending — ⚠ **depends on SHIP-01**; `retrieval_service.py`'s extraction must be proposed first |
| RECALL-02 | 246 — The recall cliff | Pending — its home is `retrieval_tuning.py`, which has **no ledger row** |

**Coverage: 19 / 19 ✓**

⚠ **Four of these requirements were written against a world that changed on 2026-09-10 and the corrections are in the roadmap, not here** — see `.planning/ROADMAP.md` → *"Corrections measured at HEAD on 2026-09-11"*. **Do not plan `SHIP-02`, `SHIP-03` or `SHIP-04` from the wording above without reading that block first.**

---

## Future Requirements (deferred, triggers intact)

| Item | Why deferred | Re-open trigger |
|---|---|---|
| `SEED-013` / `SEED-195` — Open Platform (public REST API, webhooks, service accounts, us-as-an-MCP-server) | **This is v5.0.** It is a capability axis, and mixing it into a consolidation milestone is how a consolidation milestone stops having a stopping point | The next capability milestone |
| `SEED-049` — E2E Playwright suite revival | ⚠ **Its trigger IS already true** — it names *"a chat-surface / streaming / RunCard phase"* verbatim, which is CHAT-01..05. Deferred **by decision, not by oversight**: reviving a rotted E2E suite is a phase of its own and would double this milestone | Recorded as fired-and-deferred. Re-open at the first chat phase that cannot be verified without it |
| `SEED-045` — UI/UX polish umbrella | Its trigger (*"a dedicated UI/UX polish milestone is scoped"*) fires now, and its **chat-list / nav-collapse** items are folded into SHELL-01. The remaining umbrella items are not | Next polish pass |
| `SEED-211` BUILD — metadata-derived permissions | Decided and recorded with a migration path in v4.0, deliberately not built | Connection-scoped visibility measured insufficient by a real tenant |
| `SEED-224` — document-space redesign (five-tab RAG honesty) | A redesign, not a consolidation | A Documents-surface milestone |
| `SEED-265` / `266` / `267` — v4.0 recall-harness residue | Narrower than RECALL-01 and not on the cliff path | A retrieval-quality milestone |
| `SEED-004` — org / department / role multi-tenancy | ⚠ **Department access has been owed since Phase 231.** 46 tables carry `org_id`, exactly one carries `dept_id` (0 rows), and no dept routes exist | A tenancy milestone, or the first customer with departments |
| `BUS-171` — the 23-item operator queue triage | Parked at the v4.0 close, still parked. **Parked is not dropped** | Operator's call; the method is written into the bus item itself |

## Out of Scope (explicit exclusions)

| Excluded | Reasoning |
|---|---|
| Any new source family, connector, or provider | v4.1 opens no capability axis. Four families over one contract shipped in v4.0 and have not yet run in production — adding a fifth before the first four deploy is the compounding this milestone exists to stop |
| A rewrite of the chat streaming architecture | CHAT-01..05 are surgical fixes on named lines in named files. `StreamsProvider.tsx` and `MessageList.tsx` carry live G-5 rows; the D-14 red line holds — provider differences stay at the gateway / adapter / sanitizer boundary |
| `/code-review ultra` on any phase | Ruled out on cost by the operator. The substitute is written into DEBT-03 |
| Meeting transcripts (`SEED-212`) | Deferred in v4.0 as a source *shape*, not a source *provider*. Nothing here changes that |
| A blind sweep of all 161 planted seeds | CLAUDE.md's rule asks `/gsd:new-milestone` to read every `trigger_when`. At 161 that is a phase of work, not a step in a command. The sweep run here was **targeted against this milestone's scope** and surfaced 6 firing seeds — the honest version, and the only one that finishes. ⚠ **The register's size is itself a finding**, and it does not shrink by being re-deferred |

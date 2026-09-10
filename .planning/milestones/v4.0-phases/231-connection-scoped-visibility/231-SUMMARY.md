# Phase 231 Summary: Connection-Scoped Visibility

**Built by:** Claude · **Reviewed by:** Gemini (independent, driven) · **Verdict: ✅ PASS**
**Commit range:** `11e7fd86c..230ed11b0` · **Baseline:** `d852cbc79`
**Requirements:** VIS-01, VIS-02, TRUST-04 · **Threat model:** MANDATORY — delivered, 8 threats

> ⚠ **This phase ran under the reciprocal-review pairing, INVERTED from 228/229/230.** Claude built
> it because it trips three of AGENTS.md §3.1's five criticality triggers (the permission model, a
> migration committing a table shape, and a path that can fail OPEN). Gemini reviewed it by driving
> the live database, not by reading the builder's claims.

---

## What shipped

### The predicate — one resolver, four sites, one transaction (VIS-01)

`public.connection_doc_is_visible(source_connection_id, ingest_visibility)` is the single resolver.
All four enforcement sites call it and none reimplements it:

1. the `documents` SELECT policy
2. the `document_chunks` SELECT policy
3. the body of `match_document_chunks` (`SECURITY DEFINER`)
4. the body of `keyword_search_chunks` (`SECURITY DEFINER`)

⭐ **H-1 was honoured exactly as the ROADMAP specified it** — RLS policies widened **first**, the two
`SECURITY DEFINER` bodies **last**, inside **ONE transaction**. The dangerous direction (DEFINER
first) would have made the agent cite chunks the Library refuses to show; that window never existed.

⭐ **The negative case was driven RED against all four sites BEFORE the widening**, and those four
assertions stayed in the suite afterwards
(`backend/tests/integration/test_231_connection_scoped_visibility.py`, 5/5).

### The sentence (VIS-02)

`IngestVisibilityField` + `IngestVisibilityFooter` mount **unconditionally** in
`ConnectionFormPanel.tsx`, above the actions row and **outside every capability branch** — so there
is no configuration path where the sentence is absent. Copy lives in `ingestVisibilityCopy.ts`.

⭐ **Read-only viewers read the sentence and get no control** (`1565e5102`) — the panel's rule is
that a write affordance is **absent, not disabled**. That is locked Sketch 228 **variant A**;
variant B is the interactive editor path. Both were operator-approved; C deferred to 233.

### Provenance (TRUST-04)

A citation says which connection placed the document (`CitationCard.tsx`), and the document detail
panel says the same thing (`DocumentDetailPanel.tsx`) — resolved once in `retrieval_service.py`,
which threads `source_connection_id` and resolves `source_connection_name`.

### The inert department dimension (D-5)

The `dept` branch is **written and derives to org-wide** while `dept_members` is empty. No UI, no
grant path, no third state a user can see — `OFFERED_VISIBILITIES` is `["private", "org"]`.
⭐ **It fails CLOSED on activation**, which the reviewer proved by inserting a real `dept_members`
row and watching User B get denied at all four sites.

---

## Success criteria — all four verified BY DRIVING

| SC | Verdict | Evidence |
|---|---|---|
| **1** — one plain sentence, no path without it | ✅ | mounted outside all capability branches; read-only path renders the footer with no control |
| **2** — a second org member cannot reach a private connection's document **by any route** | ✅ | Scenario 1: User B denied at all four sites; User C (cross-org) denied at all four |
| **3** — widening appears in Library **and** citations, never one without the other | ✅ | Scenario 2: lockstep True across all four sites for User B; User C still denied |
| **4** — the document and its citation both name the connection | ✅ | `CitationCard.tsx` + `DocumentDetailPanel.tsx`, one resolution in `retrieval_service.py` |

**Two further scenarios the reviewer drove unprompted, both fail-closed:**
- **Unconnected uploads are immune** — `ingest_visibility='org'` on a row with
  `source_connection_id IS NULL` widens nothing.
- **An unrecognised value fails closed** at all four sites.

---

## Gates at close

| Gate | Result |
|---|---|
| `tsc -p tsconfig.app.json` | **66** — exact baseline, zero new |
| Backend `tests/unit` | **74 failed / 3528 passed / 0 collection errors** — diff vs baseline EMPTY; touch-set 100% green |
| 231 integration suite | **5/5** |
| `ingestVisibility.test.tsx` | **16/16** (adopted into TARGETS **and** BASELINE) |
| `CitationList.test.tsx` | **15/15** (+4 adopted) |
| `ConnectionFormPanel.test.tsx` | **160/160** |
| `check-deploy-drift.sh` | **0 drift** |
| `CLAUDE.md` | **108,731 chars** (72.5%) |

⚠ **The backend figure is 74, not the 71 CLAUDE.md pins.** The diff against the baseline is EMPTY —
15 are pre-existing async-conversion rot in `test_retrieval_service.py` and the rest include the
order/GC flake. **This is `BUS-117` and it is open on the operator**, not a Phase 231 regression.

---

## Decisions recorded

- **D-5 — the inert department dimension.** Operator-decided. A second scope added *after* the
  predicate is set is a **re-ingest, not a migration**; 231 did not have to BUILD department access,
  it had to not FORECLOSE it.
- **TM-231-07 accepted, not fixed.** `fetch_full_document` (`retrieval_service.py:288-305`) is a
  fifth, owner-scoped retrieval path (`.eq("user_id", user_id)`). It **fails CLOSED**; widening it
  in Python outside the one SQL transaction is exactly the H-1 drift this phase exists to prevent.
  The reviewer independently judged the decision correct.
- **The `is_org_shared` "collision" is NOT one.** The flat column and the recursive
  `folder_is_org_shared()` are a node and a tree; nothing needs unifying. ⚠ **The real defect is
  narrower and was recorded, not fixed:** `folder_is_org_shared()` is never called from Python,
  while `documents.py:1640` and `:1817` read the flat column for move-target validation — so a
  folder shared only by inheritance is readable but rejected as a destination. It fails CLOSED.
  **It binds any future work in one way: the new connection arm must never be copied into those two
  Python sites as a third flat read, because a per-connection flat read would fail OPEN.**

---

## ⚠ Findings carried out of this phase

### 1. MIGRATION COLLISION — 231 consumed 154, 155 **and** 156; the ROADMAP reserved it only 154

The reservation table gave **155-158 to Phase 234**. Three migrations shipped here:

| # | File | Why it exists |
|---|---|---|
| **154** | `154_connection_scoped_visibility.sql` | the four-site widening + `ingest_visibility` + `source_connection_id`, one transaction |
| **155** | `155_connection_default_ingest_visibility.sql` | `default_ingest_visibility` on the connection, so ingest can stamp it |
| **156** | `156_grant_default_ingest_visibility_column.sql` | ⛔ **a hotfix — 155 broke the Connections page** by adding a column with no grant |

⭐ **156 is the `connector_connections` column-grant trap firing for the second time in this repo**
(migration 118 granted SELECT column by column, so a new column is invisible until granted). It is a
known trap with a memory entry and it still cost a broken page. **Numbers are monotonic and gaps are
never backfilled**, so 234 and everything after it shift up — corrected in the ROADMAP at this close.

### 2. Ledger cell written mid-phase falsified by the same phase's later commit

The cell read *"`retrieval_service.py` byte-unchanged by 231"*; commit `46b046c5e` then modified it
(+65/-3) for TRUST-04. **The reviewer caught it, not the builder.** Corrected to **18 / 10 / 423** in
`CLAUDE.md` and `docs/HOT-FILE-LEDGER.md` in the same commit (`b10a7262d`).
⭐ **The rule this produces: write the ledger note LAST, or re-derive at the phase's final commit.**
A phase that touches a file twice falsifies its own note.
⚠ **The G-5 extraction on `retrieval_service.py` stays OWED** — 241 is the second phase in this
milestone to land on it, and a third must propose the extraction before adding to it.

### 3. Blocker for Phase 232, found here

`connector_connections.capability` permits only `send_email | create_ticket | post_message` — **all
OUTBOUND writes.** The connection model has **no way to say "this is a file source"**, so 232 must
add an inbound capability before Drive can populate `source_connection_id` for real.

> ### ⚠ CORRECTION 2026-09-05 — **THIS BLOCKER IS MEASURED FALSE.** The original is kept above, never overwritten.
>
> **I wrote it, and it does not survive contact with the live schema.** Measured against the running
> database while capturing 232's reviewer baseline — full derivation in `232-MEASUREMENTS.md` §2:
>
> - **`capability` is NULLABLE** (migration **126** dropped `NOT NULL`), and a `CHECK ... IN (...)`
>   **passes when the column is NULL** — it evaluates to NULL, not FALSE.
> - Migration 126's *"one shape or the other"* guard (`capability IS NOT NULL OR mcp_server_url IS
>   NOT NULL`) **was DROPPED by migration 127** (`:178`) and replaced with `shape_is_not_ambiguous`,
>   which forbids **both being SET** and **permits both being NULL**.
> - ⭐ **TWO `service_id='google'` rows EXIST RIGHT NOW** with `capability = NULL` and no MCP URL,
>   plus a `microsoft` row of the same shape. `servicesCatalog.ts:84-93` gives Google
>   `shape: "oauth"` — a **third** shape beside capability and MCP.
>
> ⭐ **So `documents.source_connection_id` can point at a real Google connection today, and NO
> migration is required to represent one.** What is genuinely absent is narrower: nothing on the row
> **declares a connection INBOUND**. That is a contract-design question for 232, **not a schema
> blocker** — and `SEED-146` warns against committing the `connector_connections` shape a third time,
> so if 232 concludes a column is needed that is a **deviation to raise and an operator decision**,
> never something to absorb. ⚠ ROADMAP says 232 expects no migration; **157 is the next free number.**
>
> ⚠ **Why this matters beyond the fact itself:** the claim was carried into a handoff, a summary and
> a chat answer without once being run against the database. **It is the same shape as the finding
> this phase's own anti-pattern table records** — a verdict cell that disagrees with its evidence.


### 4. Three ROADMAP flags this phase did NOT discharge

Recorded rather than left silent — none is a defect, each is scope that went elsewhere:
- **Pitfall 3** — *"one `audit_log` row per connection-sourced retrieval hit from the first sync"*.
  No sync exists yet (232/234 build it). ⚠ Its own flag says retrofitting means the first months are
  permanently unauditable, so **it must land with the first sync, not after it**.
- **Pitfall 2** — the preview stating count and tree is **Phase 233's** subject.
- **`SEED-211`** — the M-Files metadata-derived model was to be *decided and recorded with a
  migration path, not built*. **The decision was not taken here.** It carries forward.

---

## Files

**Migrations:** 154, 155, 156 — all applied to the live local DB; `full-schema.sql` regenerated.
**Backend:** `models/connector.py` · `models/document.py` · `api/connectors.py` ·
`services/connector_service.py` · `services/ingest_splice.py` · `services/retrieval_service.py` ·
`services/tool_dispatcher.py`
**Frontend:** `settings/IngestVisibilityField.tsx` (new) · `settings/ingestVisibilityCopy.ts` (new) ·
`settings/ConnectionFormPanel.tsx` · `chat/CitationCard.tsx` · `metadata/DocumentDetailPanel.tsx` ·
`lib/api/org.ts` · `types/index.ts`
**Gate:** `scripts/vitest-count-gate.cjs` — both new suites pinned in **TARGETS and BASELINE**.

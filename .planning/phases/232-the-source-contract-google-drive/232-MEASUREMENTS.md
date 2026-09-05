# Phase 232 — Reviewer Measurement Pack

**Captured by:** Claude (REVIEWER on 232) · **Builder:** Gemini
**Tree:** `53bb866e4`, untouched, no sibling agent running · **Date:** 2026-09-05

> ⚠ **This is a BEFORE-picture, taken before the builder touched anything** (AGENTS.md §6.1). A
> baseline captured afterwards measures the change against itself.
>
> ⛔ **NO RECOMMENDATIONS ANYWHERE IN THIS PACK, by design.** Everything below is measured, with the
> command that produced it. Where a figure disagrees with what a planning document says, both are
> printed and the document is named — the builder decides what to do about it, not me.

---

## 1. Gate baselines

| Gate | Command | Baseline at `53bb866e4` |
|---|---|---|
| Frontend typecheck | `npx tsc -p tsconfig.app.json --noEmit` | **66 errors** |
| Backend unit | `pytest tests/unit -q --continue-on-collection-errors` | **72 failed · 3530 passed · 2 xfailed · 2 xpassed · 0 collection errors** |
| Deploy drift | `bash scripts/check-deploy-drift.sh` | **PASS — 0 drift** |
| `CLAUDE.md` budget | `node scripts/check-claude-md-size.cjs` | **107,507 chars · 71.7% · headroom 42,493 · OK** |
| Vitest count gate | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` | see §1.1 |

### 1.1 ⚠ Two gates cannot read clean for ANYONE, and neither is 232's fault

- **Backend reads 72, `CLAUDE.md` pins the ceiling at 71 with explicitly zero headroom.** That is
  **`BUS-117`, open on the operator** — the baseline is non-deterministic (71 *and* 72 measured on
  byte-identical trees by two independent agents). The unstable test is
  `test_cross_worker_cancellation.py::test_a_late_producer_finalize_may_not_write_failed_over_a_cancel`,
  which passes 28/28 in isolation. ⛔ **So a clean tree can fail the gate, and 232 can be blamed for
  a flake it did not cause.** Record the failure SET, not the count.
- **The vitest count gate has been RED since before Phase 229** — **`BUS-114`, open on the
  operator.** `documents.py` carries **7** distinct `ingestion_step` writes; the inherited
  `IngestionStrip` ordered fence asserts exactly **6**.
  ⚠ **Root cause of how this was missed, worth not repeating:** *"frontend untouched, so the gate
  cannot be affected"* is **UNSOUND here** — that suite imports `backend/app/api/documents.py?raw`.

---

## 2. ⭐⭐ THE HEADLINE — THE RECORDED "232 BLOCKER" IS FALSE, AND I MEASURED IT AGAINST THE LIVE DATABASE

`STATE.md` and `231-SUMMARY.md` both carry this claim, which **I wrote**, and it does not survive
contact with the schema:

> *"`connector_connections.capability` only permits `send_email | create_ticket | post_message` —
> all OUTBOUND writes. The connection model has **no way to say 'this is a file source'**, so 232
> must add an inbound capability before Drive can populate `source_connection_id` for real."*

**The second half is wrong, and the consequence is the opposite of what it says.**

### What is actually true — the live constraint set

```
connector_connections_capability_check
  CHECK (capability = ANY (ARRAY['send_email','create_ticket','post_message']))
connector_connections_shape_is_not_ambiguous
  CHECK (NOT ((capability IS NOT NULL) AND (mcp_server_url IS NOT NULL)))
connector_connections_has_a_service_identity
  CHECK (service_id IS NOT NULL AND length(btrim(service_id)) > 0)
connector_connections_auth_type_check
  CHECK (auth_type = ANY (ARRAY['static_key','oauth_byo','mcp']))
```

1. **`capability` is NULLABLE** — migration **126** dropped `NOT NULL`.
2. A `CHECK ... IN (...)` **passes when the column is NULL** (it evaluates to NULL, not FALSE), so
   the three-value list constrains only rows that *have* a capability.
3. ⚠ **Migration 126 DID add a guard forcing one shape or the other**
   (`capability IS NOT NULL OR mcp_server_url IS NOT NULL`, named
   `connector_connections_shape_is_one_of_two`) — **and migration 127 DROPPED it** (`:178`) and
   replaced it with `shape_is_not_ambiguous` (`:201-204`), which forbids **both being SET** and
   **permits both being NULL**.

### The measurement that settles it

```
service_id       capability      mcp_server_url   name
google           NULL            NULL             Google Workspace
google           NULL            NULL             Google Workspace
microsoft        NULL            NULL             Microsoft 365
mcp.deepwiki.com NULL            https://…        DeepWiki (206.1 UAT)
slack            post_message    NULL             Slack
jira             create_ticket   NULL             Jira — KAN
smtp             send_email      NULL             Email (SMTP)
```

⭐ **TWO GOOGLE CONNECTION ROWS EXIST RIGHT NOW**, with `capability = NULL` and no MCP URL. The
identity is carried by `service_id = 'google'` + `auth_type`, and `servicesCatalog.ts:84-93` gives
Google `shape: "oauth"` / `oauthProvider: "google"` — **a third shape beside capability and MCP.**

**So `documents.source_connection_id` (added by migration 154, FK to `connector_connections`) can be
pointed at a real Google connection today. No migration is required to represent one.**

### What IS genuinely absent — a different thing, and narrower

Nothing on the row **declares that a connection is INBOUND**. `service_id` says *who*, `auth_type`
says *how it authenticates*, `capability` says *which outbound action* — and there is no field that
says *this connection is a source of files*. ⚠ **That is a design question for 232's contract, not a
schema blocker**, and it is not the same claim. **Whether it needs a column at all is the builder's
call and the operator's decision if it changes the table shape** — `SEED-146`'s standing warning is
that the `connector_connections` shape must not be committed a third time.

⚠ **ROADMAP says 232 expects NO migration.** If the builder concludes one is needed, that is a
**deviation to raise, not to absorb** — and **157 is the next free number** (231 consumed 154/155/156
and the reservations from 234 on were shifted +2 at 231's close).

---

## 3. G-5 blast radius — RE-DERIVED, and every triple in the ROADMAP has DRIFTED

Recipe: `git log --oneline -- <f> | wc -l` · phase buckets with six-digit dated quick-tasks
subtracted · `wc -l`.

| File | ROADMAP / ledger says | **Measured `53bb866e4`** | Drift |
|---|---|---|---|
| `backend/app/api/connectors.py` | **27 / 11 / 1727** | **30 / 14 / 1736** | +3 commits, **+3 phases** |
| `backend/app/services/connector_service.py` | **21 / 7 / 1601** | **22 / 8 / 1613** | +1 / +1 / +12 |
| `backend/app/models/connector.py` | **12 / 6 / 471** | **17 / 9 / 594** | ⚠ **+5 / +3 / +123** |
| `frontend/src/lib/api/connectors.ts` | *(no ledger row)* | **10 / 5 / 552** | ⚠ **FIRES G-5, absent from the ledger** |
| `backend/app/services/cloud_storage.py` | **retired at 232** | **4 / 1 / 236** | young |

⚠ **`frontend/src/lib/api/connectors.ts` fires G-5 at 5 phases and has NO ledger row**, so G-5 cannot
fire on it at any count. **`lib/api.ts`'s row is the BARREL, not this module** — the same distinction
already recorded for `lib/api/org.ts`, `lib/api/knowledge.ts`, `lib/api/threads.ts` and
`lib/api/workflows.ts`.

⚠ `connectors.py` is the file the ROADMAP says gets a **PARTIAL DISCHARGE** at 232 (the file-import
route moves out to `services/sources/`) — *"not merely construction"*. It is now **3 phases hotter**
than the figure that disposition was written against.

---

## 4. `cloud_storage.py` retirement — the four consumers, measured

The ROADMAP says `cloud_storage.py` is **retired** at 232. It has **four** call sites today, and one
of them is not obvious from its name:

| Consumer | Line | What it calls |
|---|---|---|
| `backend/app/api/connectors.py` | `:1646` | `list_cloud_files` |
| `backend/app/api/connectors.py` | `:1680` | `fetch_cloud_file` (inside `import_connection_file`, `:1671`) |
| `backend/app/services/connectors/service_tools.py` | `:1689`, `:1722` | `_list_google_drive_files`, `_fetch_google_drive_file` — ⚠ **the PRIVATE functions**, and its own comment at `:1677` says *"IT CALLS `cloud_storage`, IT DOES NOT REIMPLEMENT DRIVE"* |
| `backend/app/services/google/sheets.py` | `:4` | documents that `_fetch_google_drive_file` exports a native Sheet to PDF first |
| `backend/app/security/egress.py` | `:250` | a comment recording that `cloud_storage` was the reason a code path exists |

⚠ **Two of the four reach past the public surface into `_`-prefixed functions**, so "retire the
module" is not a same-signature move for `service_tools.py`.

---

## 5. Registers — swept, routed to nobody

**Open `surface: Agentic-RAG` bugs whose area touches this phase** (the full open list is 19; these
are the ones naming connectors, import or the Library door):

| Report | Note |
|---|---|
| `BUG-260905-01-cloud-import-lives-in-chat-and-dumps-into-library-root.md` | ⭐ **ROADMAP routes the folder-picker half to 233, not 232** — but the *"writes to Library root with no `folder_id` and no `org_id`"* half is `connectors.py:1703-1709`, which is inside 232's blast radius |
| `BUG-260828-05` / `06` / `07` | connector send-path defects; outbound, not this phase's direction |

**Seeds naming this surface** — every one still reads `status: planted` except where noted:

| Seed | Status |
|---|---|
| `SEED-142` two-way connectors / read-pull auto-ingest | `open` — ⭐ **its retirement is Phase 234's commit, not 232's** |
| `SEED-146` integration capability surface | `planted` — ⚠ **"do not commit the `connector_connections` shape a second time"**; §2 above is exactly that question |
| `SEED-144` provider-shaped connections (OAuth) | `planted` |
| `SEED-209` connector ingestion must route through the classification splice | `planted` |
| `SEED-210` inbound permission and lifecycle envelope | `planted` |
| `SEED-211` permissions derived from metadata — the M-Files fork | `planted` — ⚠ **231 was to DECIDE and RECORD its migration path and did NOT**; it carries forward unanswered |
| `SEED-213` human-initiated attach from a connected source | `planted` |
| `SEED-177` MCP connections — connect and be connected | `planted` |

⚠ **`status:` frontmatter IS the index** — a seed that shipped but still reads `planted` is
re-proposed forever, and the frontmatter write belongs to whoever routes it at discuss-phase.

---

## 6. Numbering and sequence facts

- **Highest migration on disk: `156`. The next free number is `157`.**
- ⚠ **231 consumed 154, 155 AND 156 against a reservation of ONE** — every reservation from 234 on
  was shifted **+2** at 231's close (234 → 157-160 · 235 → 161 · 237 → 162 · 239 → 163 ·
  240 → 164 · 241 → 165). Milestone range is now **153-165**. Gaps are NEVER backfilled.
- **`156` was a HOTFIX**: `155` added `default_ingest_visibility` with no grant and broke the
  Connections page — the `connector_connections` **column-grant trap** firing for the **second** time
  (migration 118 was the first, granting SELECT column by column). ⚠ **Any new column on
  `connector_connections` needs its GRANT in the same migration.**
- **H-2 is satisfied**: Phase 229's splice (`services/ingest_splice.py`) shipped and is the mint every
  adapter is supposed to call. `mint_document_row` was **driven against the real DB** at 229's
  verification — it inserts the row PostgREST used to refuse with `PGRST204`.
- **`documents.source_connection_id`** exists (migration 154 `:28`), is FK'd, and carries a partial
  index `WHERE source_connection_id IS NOT NULL` (`:57-58`).

---

## 7. What I did NOT measure, stated so it is not read as absent

- **Shared-drive invisibility** — the ROADMAP marks it **INFERRED, not driven**. I did not drive it.
  It stays inferred until somebody runs it.
- **The count gate's per-file deltas** — the run was still in flight when this pack was written; the
  headline is §1.1's standing RED, which is inherited and operator-owned either way.
- **Whether `drive.readonly` is actually live on the two Google rows.** The ROADMAP says the scope was
  granted at Phase 221 and that 232 needs **no new OAuth scope**; I did not verify the grant on these
  specific rows.

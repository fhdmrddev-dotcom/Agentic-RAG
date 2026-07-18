---
phase: 140
slug: smart-dispatch-relevance-pre-filter-stretch
status: verified
threats_open: 0
asvs_level: 2
created: 2026-07-07
---

# Phase 140 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Mode: VERIFY-MITIGATIONS (register authored at plan time; every mitigation confirmed
> present in implemented code with file:line evidence — documentation/intent alone rejected).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Agent hot path → Postgres (`match_skills` RPC) | The over-budget pre-filter calls a `SECURITY DEFINER` cosine RPC that bypasses RLS. Its WHERE clause is the only cross-user access gate. | Query embedding (1536-dim vector) + `match_user_id`; returns owner+global enabled skills only |
| Backfill job (service-role client) → `skill_embeddings` | The reembed job runs as service-role (RLS bypassed); the app-layer `.eq("user_id", …)` hand-scope + payload `user_id` is the isolation gate. | One vector row per skill, keyed + scoped by `user_id` |
| `app_settings.skill_catalog_max_tokens` (admin knob) → hot-path token math | Untrusted admin-tunable integer feeds budget accounting on every general-mode turn. | Integer budget (0 = inject-all kill switch) |
| Eval-tuple seam (`skill_catalog_override`) → catalog assembly | The pre-filter (embed/RPC/kick/trim) must stay strictly inside the `is None` branch so eval A/B arms are byte-identical (D-06). | Catalog note string; tuple/`()` arms never embed, rank, or kick |
| Migration 091 file → live DB | Operator-applied SQL (psycopg2-direct to :54322, SQL-editor-equivalent) — the reviewed file must equal the applied file. | DDL (table + RLS + RPC + triggers + budget column) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-140-01 | Information Disclosure | `match_skills` RPC WHERE clause | mitigate | WHERE byte-clones today's scope `(s.user_id = match_user_id OR s.is_global = true) AND s.is_enabled = true` (`supabase/migrations/091_skill_embeddings.sql:104-105`); owner-only RLS SELECT defense-in-depth (`:66-71`). | closed |
| T-140-02 | Tampering / Denial | stale/cross-space vectors mis-rank | mitigate | `p_embedding_model` D-10 filter (`091:103`) + `LEFT JOIN` (`:101-102`) + `ORDER BY similarity DESC NULLS LAST` (`:106`) → a should-fire skill with stale/absent vector is kept last, never dropped (fail-open). | closed |
| T-140-EL | Elevation of Privilege | SECURITY DEFINER shadowing | mitigate | `SET search_path = public, pg_temp` on all three definer fns: `match_skills` (`091:93`), `stale_skill_embedding` (`:127`), `stale_skill_embedding_from_case` (`:155`). | closed |
| T-140-03 | Information Disclosure | backfill reads/writes another user's vectors | mitigate | Read hand-scoped `.eq("user_id", user_id)` (`backend/app/services/skill_embedding_service.py:173`); write scope is `"user_id": user_id` baked into the upsert payload (`:218`) since PostgREST upsert can't chain `.eq`. | closed |
| T-140-04 | Denial of Service | sync embed + sync supabase-py block event loop | mitigate | `run_in_threadpool` wraps the read (`skill_embedding_service.py:180`), the `embed_texts` call (`:203`), and every `.upsert` write (`:213`). | closed |
| T-140-12 | Denial | failed backfill crashes caller / half-written vectors | mitigate | Job `try/except → logger.warning(exc_info) + honest partial` (`skill_embedding_service.py:239-245`); non-destructive per-skill upsert, no bulk DELETE (`:212-229`); `kick_skill_backfill` double-wraps (job `try/except :272-281` + spawn `try/except :284-294`) and strong-refs the task in `_BACKFILL_TASKS` (`:286-287`). | closed |
| T-140-05 | Tampering / Denial | untrusted `app_settings.skill_catalog_max_tokens` | mitigate | `resolve_skill_catalog_budget` coerces `int()` and maps negative/invalid/`NaN`/`None` → `0` clean disable, never negative/NaN token math (`backend/app/services/skill_catalog_filter.py:42-62`). Knob wired app_settings-only (`config.py:823`, `user_settings.py:180,550`). | closed |
| T-140-06 | Repudiation / Denial | silent truncation hides skills | mitigate | Any cut appends the honest `_CATALOG_TRIM_MARKER` with the real N-cut (`skill_catalog_filter.py:30-33,168,177`); `load_skill`-by-name escape hatch is real — `_handle_load_skill` resolves by exact `name + is_enabled`, catalog-independent (`backend/app/services/tool_dispatcher.py:666-683`). | closed |
| T-140-14 | Denial | mixed None+float similarity crashes sort (TypeError) | mitigate | None-safe resolver `raw if raw is not None else -1.0` (never `dict.get(id,-1.0)`) so present-but-None sorts last, no `-(None)` (`skill_catalog_filter.py:96-107`); used in the sort key (`:160`). | closed |
| T-140-07 | Information Disclosure | over-budget branch surfaces another user's skill | mitigate | Pre-filter lives inside `if skill_catalog_override is None:` (`agent_loop.py:1235`); `match_skills` called with `match_user_id` scope (`:1264-1272`); fail-open sets `sim_by_id=None` (`:1297-1308`) and `build_skill_catalog_block` ranks only this user's `enabled_skills` set (`:1309`). | closed |
| T-140-08 | Denial of Service | per-turn embed as latency amplifier | mitigate | Embed only on the over-budget branch behind `budget > 0 and estimate_tokens(...) > budget` (`agent_loop.py:1256`); `run_in_threadpool(embed_texts, ...)` (`:1258`); fail-open on exception (`:1296-1308`); fire-and-forget self-limiting kick (`:1290`). Fits path makes zero embed/RPC/kick calls. | closed |
| T-140-09 | Tampering | pre-filter breaks the eval A/B seam (D-06) | mitigate | Embed/RPC/kick/trim strictly inside the `is None` branch (`agent_loop.py:1235-1315`); the `else` tuple branch reproduces the old `catalog_lines`/`catalog_note` verbatim (`:1316-1326`). Seam proven by `test_deep_mode_unchanged` / `_with_arm` / `_without_arm` / `_tuple_branch_never_embeds_or_kicks` (`backend/tests/test_agent_loop_catalog_override.py:197,224,249,526`). | closed |
| T-140-10 | Tampering / Elevation | applying unreviewed SQL to the live DB | mitigate | `git diff 02b965f3..HEAD -- supabase/migrations/091_skill_embeddings.sql` is EMPTY — the applied file == the single committed reviewed file (only commit touching it is `02b965f3`); applied via psycopg2-direct (SQL-editor-equivalent), no `db push`/`db reset`, idempotent objects (`140-05-SUMMARY.md`). | closed |
| T-140-11 | Information Disclosure | backfill writing/reading cross-user vectors | mitigate | `.eq("user_id", …)` read hand-scope + `user_id` write scope (`skill_embedding_service.py:173,218`) + owner-only RLS (`091:66-71`); Plan 05 live backfill wrote 7 rows split 6 owner / 1 seed, zero cross-owner bleed (`140-05-SUMMARY.md`). | closed |
| T-140-SC | Tampering / supply-chain | npm/pip/cargo installs | accept | Zero new packages — `git diff cb9fef39..HEAD -- backend/requirements.txt backend/Dockerfile.sandbox` is EMPTY (verified this run). | closed |
| T-140-13 | Tampering | malicious skill description as prompt injection | accept | Pre-existing surface — the catalog already injects skill descriptions today (same `- **{name}**: {description}` line format on both branches); this phase only TRIMS the catalog, it does not widen exposure. No new mitigation required. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-140-01 | T-140-SC | No new dependencies introduced. The phase reuses the existing pgvector / psycopg2 / embedding / RPC / trigger substrates. `git diff cb9fef39..HEAD -- backend/requirements.txt backend/Dockerfile.sandbox` returns empty — no supply-chain surface added. | gsd-security-auditor (verified) | 2026-07-07 |
| AR-140-02 | T-140-13 | Skill descriptions are already injected into the system prompt on every general-mode turn (pre-140 behavior). Phase 140 only TRIMS that catalog under a token budget; it adds no new content source and does not widen exposure. The prompt-injection surface is unchanged from the accepted pre-existing baseline. | gsd-security-auditor (verified) | 2026-07-07 |

*Accepted risks do not resurface in future audit runs.*

---

## Unregistered Flags

None. All five plan SUMMARY.md `## Threat surface` sections declare "No threat flags" (140-02, 140-04, 140-05 explicit; 140-01, 140-03 confirm T-140-SC zero-new-deps). No new attack surface appeared during implementation without a threat mapping.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-07 | 16 | 16 | 0 | gsd-security-auditor (VERIFY-MITIGATIONS mode) |

Notes: 14 `mitigate` threats each confirmed present in implemented code with file:line evidence (migration 091 DDL, `skill_embedding_service.py`, `skill_catalog_filter.py`, `agent_loop.py` override-None branch, `tool_dispatcher.py` escape hatch, seam tests). 2 `accept` threats confirmed still valid (empty dependency diff; trim-not-widen). Migration file immutability confirmed (`git diff 02b965f3..HEAD` empty). No implementation files were modified by this audit.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-07

---
phase: 104
slug: pm-flagship-content-pack
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-15
---

# Phase 104 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> PM Flagship Content Pack (PM-01) — synthetic corpus + docxtpl templates + an
> idempotent Supabase seed script + a cross-provider scoreboard harness + the
> operator live-UAT checkpoint. A "content-only" phase that shipped ONE additive
> engine gating change at the live-UAT gate (commit `6a607169`).

State B run (no prior SECURITY.md): register built from the three PLAN
`<threat_model>` blocks (104-01 / 104-02 / 104-03) + the SUMMARY `## Threat Flags`
sections, then **verified against the shipped HEAD code** (not plan-time intent) by
the gsd-security-auditor. The Phase 102/103 lesson — *static / plan-time "mitigated"
can false-green* — was applied: every `mitigate` was grepped/read to a `file:line`
on the live path, and the additive double-gate engine fix was read in full plus its
data-provenance traced end-to-end to confirm no def-author / model-output bypass.

All three SUMMARY `## Threat Flags` sections report **None** (no net-new attack
surface from the executors) — confirmed: the seed writes existing tables via the
service-role client (RLS bypass by design, scoped to `DEMO_USER_ID`), and the
scoreboard harness is a pure client on shipped routes.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| inline Jinja Score expression → docxtpl render | an author-fixed dict-lookup×multiply rendered in `SandboxedEnvironment(autoescape=True)` over model-emitted, citation-gated cells | `r.probability.value` / `r.impact.value` |
| synthetic corpus text → retrieval/citation gate | KB text is retrieved + cited; a fake `<doc id=…>` in passage text could attempt a false-green | corpus markdown, retrieved passages |
| seed script → Supabase Storage (service-role) | RLS bypassed by design — every object MUST be keyed under the demo uid | `{DEMO_USER_ID}/_library/<slug>.docx` |
| seed script → workflow_definitions / documents / folders | service-role psycopg2 writes — RLS bypassed; only `DEMO_USER_ID` may be written into every owner column | owner-scoped SQL params |
| `DEMO_USER_ID` constant → live `auth.users` | a stale carried-forward uid (local DB reset) would seed the wrong RLS owner | uid pre-flight comparison |
| `<slug>` constant → Storage key | the slug is interpolated into the server-side Storage path | author-fixed slug string |
| scoreboard harness → POST `/threads/{id}/messages` | a pure client posting kickoffs as the demo user; inherits the run path's RLS/scope binding | `workflow_definition_id`, model override |
| Tweak fork → publish gauntlet | re-authoring forks a NEW draft (INSERT) + re-drives the real golden run + judge; published v1 stays frozen | new draft JSONB |
| **engine emit verdict → post-phase 102 validators (additive 6a607169)** | the `llm_emit` success output carries the engine's `retrieved_ids` + integrity verdict so the post-phase `citations_required` / `output_file_valid` validators honor the SAME verdict the internal gate passed | engine-computed `retrieved_ids`, `opened`/`residual_clean` |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation (verified `file:line`) | Status |
|-----------|----------|-----------|-------------|------------------------------------|--------|
| T-104-01-01 | Tampering (SSTI) | inline Jinja Score expression in risk-register.docx | mitigate | `make_pm_templates.py:95-98` — the expression is a fixed dict-literal `{'low':1,'medium':2,'med':2,'high':3}.get(...|trim|lower, 0) * (...)`; no `__class__`/`__globals__`/`import`/builtin access. Rendered in `SandboxedEnvironment(autoescape=True)` on BOTH prod paths (`tool_dispatcher.py:1267`, `template_render_service.py:657`). Operates only on model-emitted, citation-gated `r.probability.value`/`r.impact.value`. | closed |
| T-104-01-02 | Information Disclosure | synthetic corpus content | accept | Fictional "Project Meridian" / "Brightline Insurance" data with invented names (`sample-corpus/project-charter-source.md:1-7`) — authored, not derived from real records. No PII/secrets. See AR-104-01. | closed |
| T-104-01-03 | Tampering (citation false-green) | corpus must contain no adversarial citation strings | mitigate | Grep of `scripts/pm-pack/sample-corpus/` for `<doc id=`/`source_chunk_id`/`chunk_id`/`document_id` → **no matches** (hand-authored prose, no fake markers). The valid-id set is computed SERVER-SIDE from the upstream retrieval refs (`phase_types.py:789-857` `_emit_evidence`/`_retrieved_ids`) — a fake `<doc id=…>` in passage TEXT is not in the set (docstring `:800-804`). | closed |
| T-104-02-01 | Tampering (path traversal) | Storage key built from `<slug>` | mitigate | `seed-pm-pack.py:98` `_SLUG_RE = ^[a-z0-9-]+$`; `_assert_slug(slug)` (`:118-124`) runs at `upload_template:300` BEFORE the key is built at `:304` (`f"{DEMO_USER_ID}/_library/{slug}.docx"`). Author-fixed constants; no `../`. | closed |
| T-104-02-02 | Information Disclosure (cross-tenant pollution) | demo corpus folder | mitigate | `resolve_demo_folder` (`seed-pm-pack.py:187-199`) SELECT/INSERT with `is_global = false`; every doc (`:260`) + def INSERT (`:505` `is_global` bound `false`) is per-account `DEMO_USER_ID`. No global seed path exists. | closed |
| T-104-02-03 | Information Disclosure (secret leakage) | SERVICE_ROLE / OPENAI keys / DSN | mitigate | NAME-ONLY via `os.environ.get` (`:130,135,136`); `load_dotenv(BACKEND_DIR / ".env")` (`:80`). Grep found no literal key strings. Summary `print` (`:604-608`) emits folder/def ids + asset paths only — no secret values. | closed |
| T-104-02-04 | Tampering (immutability bypass) | UPDATE of a published pack def | mitigate | `upsert_definition` (`seed-pm-pack.py:470-499`) does DELETE-then-INSERT only; never UPDATEs a published row. Backstop trigger `workflow_definitions_block_published` (`migrations/056_workflow_definitions.sql:81-99`) raises `check_violation` (23514) on any UPDATE where `OLD.status='published'`. | closed |
| T-104-02-05 | Spoofing (citation false-green via content injection) | retrieved corpus text | accept | Engine-side: the emit valid-id set is computed SERVER-SIDE in `_retrieved_ids`/`_emit_evidence` (`phase_types.py:833-857`, `:789-830`) from the upstream retrieval phase's `source_refs`/`citations` — a fake `<doc id=…>` in passage text is not in the set. Shipped engine control; the synthetic corpus adds authoring discipline (T-104-01-03). See AR-104-02. | closed |
| T-104-02-06 | Elevation of Privilege (wrong-uid write) | service-role writes | mitigate | Single constant `DEMO_USER_ID` (`:86`) written into every `user_id`/`created_by`/Storage path (folder `:198`, doc `:260`, def `created_by` `:514`, Storage key `:304`). No other uid is writable. | closed |
| T-104-02-07 | Tampering/EoP (RLS-owner mismatch, stale DEMO_USER_ID) | carried-forward `DEMO_USER_ID` vs live `auth.users` | mitigate | `assert_demo_uid(conn)` (`:143-172`) `SELECT id FROM auth.users WHERE email=DEMO_USER_EMAIL`; raises SystemExit on missing row, count≠1, or `found != DEMO_USER_ID`. Called FIRST in `main()` (`:577`) BEFORE any write — fail-closed, never a silent wrong-owner seed. | closed |
| T-104-03-01 | Spoofing (scoreboard false-green) | model narrates the field-map as text instead of forcing | mitigate | `scoreboard_smoke.py` derives `narrated_text` (`:253` — terminal `completed` + NO `.docx` + not truncated = the false-green trap), `honest_failure` (`:256`), `produced_file` from DB truth. FORCE-tier passes only on a real produced file; `narrated_text:true` is ALWAYS a FAIL (`:375-383`). Tier defaults are case-correct PascalCase registry IDs (`:72-79`). | closed |
| T-104-03-02 | Information Disclosure (provider spend) | cross-provider runs | accept | PREVIEW-only unless `--run` / `PM_SCOREBOARD_RUN=1` (`scoreboard_smoke.py:23`); without the gate it lists the matrix and exits 0, firing no provider call and not even a DB connection. Bounded to the pinned tier IDs. See AR-104-03. | closed |
| T-104-03-03 | Tampering (publish bypasses judge) | Tweak-fork publish | mitigate | The judge is a HARD blocker BEFORE the flip: `publish_service.py:285-294` — `if verdict.get("failure") or verdict.get("overall_passed") is not True: return await _block(stage="judge", ...)`; only `:296-297 publish_definition` flips when the judge explicitly passed. Fail-closed (`is not True`). Driven live on the real golden run (104-03 UAT: judge blocked a weak run, passed a clean one). | closed |
| T-104-03-04 | Tampering (re-author mutates v1) | Tweak→v(N+1) fork | mitigate | Tweak is an INSERT of a new draft (new id, same slug, version+1) — never an UPDATE of v1; the immutability trigger (`migrations/056:81-99`, `check_violation` 23514) blocks any published-row UPDATE. UAT-4 psql-confirmed v1 unchanged + v3 published. | closed |
| T-104-ADD-01 | Tampering (engine bypass — additive double-gate fix) | `llm_emit` success output carries `retrieved_ids` (citations_required) + `opened`/`residual_clean` (output_file_valid) for the post-phase 102 validators (commit `6a607169`) | mitigate | **(a)** `retrieved_ids` exposed at `phase_types.py:1443` is `sorted(retrieved_ids)` from the SAME engine `_emit_evidence`/`_retrieved_ids` set (`:1132`, `:789-857`) — computed server-side from the upstream retrieval refs, NOT model- or def-supplied; a fake `<doc id=…>` cannot inflate it (docstring `:800-804`). **(b)** `output_file.opened`/`residual_clean` set at `phase_types.py:1410-1416` ONLY on the engine-only `status=="ok"` branch from `render_out.get("verdict")` (the executor's own `assert_integrity`). The validator (`validator_kinds.py:272-273`) honors a pre-computed `opened=True`. The `output` reaching the validator is the return value of `_execute_phase` (`harness_engine.py:686-705`), i.e. always engine-produced — a def author authors only `phases`/`validators`/`assets`/`prompts`, a model emits only a field-map. No path lets either inject `output_file.opened=True`; all other phase outputs set `output_file=None` (only the verified-render branch builds it). | closed |

---

## Accepted Risks Log

| ID | Threat | Justification | Owner | Date |
|----|--------|---------------|-------|------|
| AR-104-01 | T-104-01-02 — synthetic corpus content disclosure | The corpus is fully fictional ("Project Meridian" / "Brightline Insurance" with invented names like Marcus Alvarez, Dana Whitfield) authored for the demo, not derived from any real customer/employee record — there is no PII or secret to disclose. Verified: `sample-corpus/project-charter-source.md:1-22`. No control needed. | operator | 2026-06-15 |
| AR-104-02 | T-104-02-05 — citation false-green via KB-content injection | The defense is an engine-side, already-shipped control: the citation valid-id set is computed server-side from the retrieval phase's refs (`phase_types.py:_retrieved_ids`/`_emit_evidence`), so a `<doc id=…>` string embedded in passage TEXT can never whitelist itself. This phase adds no new attack surface (synthetic corpus is clean — T-104-01-03) and authors no new control; it relies on the shipped engine guarantee. Reasonable accept. | operator | 2026-06-15 |
| AR-104-03 | T-104-03-02 — cross-provider scoreboard provider spend | The scoreboard is opt-in gated (`--run` / `PM_SCOREBOARD_RUN=1`) and PREVIEW-only by default (no provider call, no DB connection). The live cross-provider sweep + per-tier golden run is the *intended, operator-initiated* cost of the SC#10 acceptance bar, bounded to the pinned representative IDs. No control beyond the opt-in gate is warranted. | operator | 2026-06-15 |

---

## Unregistered Threat Flags

None. All three SUMMARY `## Threat Flags` sections (104-01 / 104-02 / 104-03) report
**None**, and the additive engine change (`6a607169`) is captured above as T-104-ADD-01.

---

## Informational Notes (not security gaps)

- **Scoreboard MiniMax pin drift (content, not security):** `scoreboard_smoke.py:76`
  pins `MiniMax-M2.7` while the VALIDATION/plan named `MiniMax-M3` (M3 not in the live
  registry; the harness comment documents the substitution). This is a cross-provider
  scoreboard *accuracy* note — the case-correct PascalCase ID that prevents the
  silent-coerce degrade (the T-104-03-01 load-bearing property) is preserved. Not a
  threat-mitigation gap.
- **WR-02 idempotency fix in `upsert_definition`** (`seed-pm-pack.py:487-492`):
  parsed-dict compare instead of raw-text compare avoids a needless DELETE-then-INSERT
  every run. A correctness/idempotency improvement; the DELETE-then-INSERT (never
  UPDATE) immutability discipline is unchanged — no security effect.

---

## Audit Trail

- Verifier: gsd-security-auditor (State B — register from PLAN `<threat_model>` blocks
  + SUMMARY Threat Flags, verified against shipped HEAD).
- Additive engine change `6a607169` (phase_types.py + validator_kinds.py +
  test_llm_emit_executor.py, +85 LOC, +56 test LOC) read in full; data provenance of
  `retrieved_ids` and `output_file.opened`/`residual_clean` traced end-to-end to
  confirm engine-only origin (no def-author / model-output bypass).
- Highest-stakes controls read in full (not trusted on plan prose): the additive
  double-gate fix (T-104-ADD-01), the judge hard-blocker (T-104-03-03), the
  `assert_demo_uid` pre-flight ordering (T-104-02-07), the immutability trigger
  (T-104-02-04 / -03-04), and both `SandboxedEnvironment` render paths (T-104-01-01).
- `threats_open: 0` — **15 threats total**: 12 `mitigate` (11 planned + the additive
  T-104-ADD-01) verified to `file:line` on the live path + 3 `accept` documented
  (AR-104-01..03). The additive engine control (T-104-ADD-01) is one of the 12
  mitigates and was traced bypass-free end-to-end.
- Orchestrator hand-spot-check (not trusted on the auditor's word — the 102/103
  "static would false-green" discipline applied to the auditor too): independently
  read the immutability trigger (`056:86-90`), the judge hard-blocker
  (`publish_service.py:285`), and the new `opened=True` validator seam
  (`validator_kinds.py:272`, sourced from `output.get("output_file")`) — all three
  match the recorded evidence verbatim.

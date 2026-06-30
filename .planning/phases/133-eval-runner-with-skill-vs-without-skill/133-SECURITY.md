---
phase: 133
slug: eval-runner-with-skill-vs-without-skill
status: verified
threats_open: 0
asvs_level: 2
created: 2026-07-01
---

# Phase 133 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Eval Runner (EVAL-02) — runs a skill WITH vs WITHOUT itself across 2 arms over the shared agent loop, owner-scoped, with an honest token/result delta.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| client → eval router | Untrusted `skill_id`/`run_id` path params + provider/model request body cross here | Path params, provider/model strings (low sensitivity; validated server-side) |
| service-role client → Postgres | All eval writes use the service-role key which BYPASSES RLS; the table RLS SELECT policy is defense-in-depth only | eval_runs / eval_results rows (owner-private) |
| background job → provider gateway | The eval job drives real (paid) LLM completions; unbounded fan-out is a cost/DoS risk | Prompts + skill catalog → provider |
| background job → eval_results / public.runs writes | Service-role writes; the job is the only writer and must stamp `user_id` from `current_user` | Result rows, error strings, run status |
| eval service → RunContext → shared agent loop | The eval arms drive the shared Deep/agent-loop path; any change here risks Deep Mode regression (D-14, G-5 hot file) | `skill_catalog_override` (name/description only) |
| inner run_agent_loop emit → shared eval SSE buffer | The inner loop's `done`/`error` terminals would corrupt the shared `run:{run_id}` stream if not isolated | SSE events |
| eval router → public.runs / Redis sorted sets | The companion `runs` row + sorted sets feed the reused reattach/cancel machinery | run_id, owner id |
| migration apply → live dev DB | A wrong apply path (`db push`/`db reset`) destroys dev data | Schema DDL |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation (verified evidence) | Status |
|-----------|----------|-----------|-------------|--------------------------------|--------|
| T-133-01 | Information Disclosure | eval_runs/eval_results SELECT + GET run/results/list routes + reused stream/cancel + thin client | mitigate | Owner-only RLS SELECT `USING (auth.uid() = user_id)` on both tables (`080:111-115`, RLS enabled `:108-109`) as defense-in-depth; real gate = app-code `.eq("user_id")` + **404-not-403** on all 3 eval routes (`evals.py:_verify_owned_skill:90-105`, POST `:131`, GET-results `:351-362`, GET-list `:394`); reused stream owner-check `runs.py:400-407` + reused cancel owner-check `runs.py:1107-1119` (both 404 cross-user via companion runs row); thin client renders only owner-scoped responses (`SkillEvalSection.tsx:17,63,123`) | **closed** |
| T-133-02 | Denial of Service | unbounded fan-out / cost blow-up / repeat POST kickoffs | mitigate | Single provider/run (`StartEvalRunBody`=provider/model only, `eval_run.py:27-28`); bounded N cases + zero-case 400 reject (`evals.py:186-190`); atomic Redis `SET NX` in-flight claim → 409 (`evals.py:200-207`); cancel checkpoint each arm (`eval_runner_service.py:397,414`); per-call timeout inherited from shared loop (`agent_loop.py:1803,1847-1852,471`) caught by `_run_arm` → `timed_out` (`eval_runner_service.py:289`) — see Note 1 | **closed** |
| T-133-03 | Tampering / EoP | row ownership / forged skill_id·user_id in body | mitigate | `user_id` from `current_user` never body (`evals.py:128,243`; `eval_runner_service.py:253,369`); `StartEvalRunBody` exposes no user_id/skill_id (`eval_run.py:23-28`); `skill_id` from path + latest `skill_version` resolved owner-scoped `.eq("skill_id").eq("user_id")` (`evals.py:152-161`); writes owner-stamped (`_persist_result:219`, `_update_eval_run_status` `.eq("user_id"):333`) | **closed** |
| T-133-04 | Information Disclosure | eval_results.error / runs.error strings | mitigate | `_truncate_error` caps `[:200]` (`eval_runner_service.py:150-153`) applied at both per-arm exception sites (`:291,295`) + unknown_model (`:377`); router error details carry only validated input, no tracebacks; `_verify_owned_skill` swallows error shape → generic 404 (`evals.py:99-105`) | **closed** |
| T-133-05 | Tampering | shared agent_loop catalog injection (G-5 hot file) | mitigate | `skill_catalog_override: tuple[dict, ...] | None = None` additive default-off (`agent_loop.py:202`); single read-site branch — `None` runs identical DB query (`:1191-1199`), else `list(override)` (`:1201`); shared catalog build byte-identical below (`:1203-1213`); regression guard `test_deep_mode_unchanged` (`test_agent_loop_catalog_override.py:191`) | **closed** |
| T-133-06 | Elevation of Privilege | catalog override content | mitigate | Catalog build reads ONLY `s['name']`/`s['description']` (`agent_loop.py:1205`); WITH-override sourced from version-snapshot name/description only (`eval_runner_service.py:386-391`), snapshot fetched owner-scoped (`evals.py:152-161`) — never arbitrary client input | **closed** |
| T-133-07 | Tampering | shared eval SSE buffer corruption | mitigate | `_noop` handed to inner loop as `emit`+`emit_terminal` (`eval_runner_service.py:100-104,285`); only the service emits the single terminal (`:430,438`); `test_sse_vocabulary` asserts ordered `eval_*` with no chat terminal mid-run | **closed** |
| T-133-08 | Input Validation | unknown provider/model in POST body | mitigate | `get_model_capability` registry check → 400 on unknown (`evals.py:136-141`); provider must match registry provider → 400 (`:142-146`) | **closed** |
| T-133-09 | Tampering | client-chosen provider/model | mitigate | Model validated server-side (`evals.py:136-146`); routing fix `306dd2d4` present — `override_provider(user_settings, body.provider)` + `llm_model` pin (`evals.py:278-290`); picker is convenience only (`SkillEvalSection.tsx:120,179`) | **closed** |
| T-133-EoP | Elevation of Privilege | eval_runs/eval_results INSERT/UPDATE/DELETE policies | mitigate | Zero `FOR INSERT/UPDATE/DELETE` policies (grep=0); exactly 2 `CREATE POLICY`, both `FOR SELECT` (`080:111,114`); RLS enabled both tables (`:108-109`); service-role-only writes (079/035 precedent) | **closed** |
| T-133-DATA | Tampering | dev DB during migration apply | mitigate (process control) | Migration well-formed; header mandates apply via SQL editor / psycopg2 :54322, never `db push`/`db reset` (`080:33-37`); `133-01-SUMMARY.md:51` confirms applied via psycopg2 :54322 with dev data preserved — no code surface, checkpoint control honored | **closed** |
| T-133-SC | Tampering (supply chain) | package installs | accept | Zero new dependencies — all five SUMMARY `tech-stack.added: []`; no requirements.txt/package.json/Dockerfile.sandbox/pyproject.toml in any `files_modified`; new backend files import only stdlib + pre-existing modules, new frontend file imports only existing `lucide-react`/`@/components/ui/button`/`@/lib/api` (see Accepted Risks Log) | **closed** |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-133-01 | T-133-SC | Phase 133 adds **zero new dependencies** (no npm/pip/cargo manifest touched; new code imports only stdlib + pre-existing modules). Supply-chain risk accepted for this phase — there is no new third-party surface to vet. Re-open trigger: any future change to this phase's code that adds a package. | fhdmrd@gmail.com (operator) | 2026-07-01 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-01 | 12 | 12 | 0 | gsd-security-auditor (opus) — verify-mitigations mode (register authored at plan time) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-01

---

## Auditor Notes

1. **T-133-02 per-call timeout — inherited, not local (CLOSED, by design).** The register named `get_per_call_timeout`; the eval code does not re-wrap it. The deadline is enforced one layer down in the shared `run_agent_loop` (`get_per_call_timeout_async` → `asyncio.timeout`), which every arm inherits, and `_run_arm` catches the propagated `asyncio.TimeoutError`. Binding each LLM call once at the gateway layer is the correct design; the mitigation is present and effective.
2. **No unregistered flags.** Every SUMMARY carries a `## Threat Surface` section confirming "No new threat surface beyond the plan's `<threat_model>`." Recorded deviations (Plan 04 `list_eval_runs` owner-verify + ephemeral eval thread for the companion FK; Plan 05 `listEvalRuns` reattach + 4 additive wire types + additive `eval_*` dispatch) are all additive and owner-scoped. The post-implementation `override_provider` routing fix (`306dd2d4`) loads only the caller's own owner-scoped settings.
3. **First audit (State B).** No prior SECURITY.md existed. All implementation files were treated as read-only; nothing was modified during the audit.

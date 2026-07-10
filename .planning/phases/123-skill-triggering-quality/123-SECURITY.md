---
phase: 123
slug: skill-triggering-quality
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-26
---

# Phase 123 — Security (Skill Triggering Quality · TRIG-01 / TRIG-03 / CTX-03)

> Per-phase security contract: threat register, accepted risks, and audit trail.

**Audit date:** 2026-06-26
**Auditor:** gsd-security-auditor (opus, FORCE stance)
**ASVS Level:** L1 · **block_on:** high
**register_authored_at_plan_time:** true (register verified in source, not re-derived)
**Result:** SECURED — 29/29 threats CLOSED (23 `mitigate` verified non-vacuous + 6 `accept` documented) · **threats_open: 0**

The codebase also contains Phase 123.1 follow-on hardening (CR-01 run↔skill IDOR
bind, WR-01 atomic `SET NX` in-flight claim, TT-* honesty fixes). 123.1 is
strictly ADDITIVE to the Phase 123 dispositions — it strengthens the IDOR /
owner-scoping / honesty mitigations, never weakens them. Migration `077_tuner_runs.sql`
(durable persistence, added in 123.1) ships RLS (owner-OR-global SELECT) and documents
the app-code `_fetch_owned_or_global_skill` gate as the sole read-side leak gate.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| client/agent → POST/PATCH /skills | Author- or model-typed description crosses into persisted skill state | Skill description text |
| model → load_skill firing decision | The relaxed catalog note influences which skill the model loads | Skill instructions |
| stored history → reconstructed message list | DB rows become the in-memory message list the trim path operates on | Chat/tool messages |
| trim path → provider request | The trimmed (pin-aware) message list is sent to a provider | Message list |
| author cases / description → forced_emit | User-authored text crosses into builder + target model prompts | Benchmark prompts |
| client → POST /skills/{id}/tuner/runs | An authenticated user requests a tuning run for a skill id | skill_id, cases |
| tuner route → skills table | The route must only operate on the caller's own/global skills | Owner-scoped read/write |
| background task → N provider APIs | Multi-minute live LLM fan-out — resource/cost surface | API-key presence |
| scoreboard render → server scores | The UI renders only server-computed scores (no client-side fabrication) | Provider scores |
| Settings picker → app_settings | The builder-model id is written to settings (a value, not a secret) | Model id |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation (verified in source) | Status |
|-----------|----------|-----------|-------------|---------------------------------|--------|
| T-123-01-01 | Tampering/Elevation | D-01 catalog relaxation false-fires an unrelated skill | mitigate | `skill_lint.py:52-56` `LOAD_SKILL_POLICY` = "...Do not load a skill for an unrelated request"; interpolated at `agent_loop.py:1120-1122`; load_skill stays owner-scoped (`agent_loop.py:1106-1112`). | closed |
| T-123-01-02 | Info Disclosure | Sibling-description duplicate check on create/PATCH | mitigate | `skills.py:106-130` `_sibling_descriptions` uses `.or_(user_id.eq.{id},is_global.eq.true)` (`:120`); PATCH excludes edited skill (`:127`); degrades to `[]`. Same filter `tool_dispatcher.py:731`. | closed |
| T-123-01-03 | DoS | Lint on agent save_skill path aborts the task | mitigate | `skill_lint.py:198` top-level `try/except` — never raises. `tool_dispatcher.py:726-764` save proceeds regardless; `lint_warnings` non-fatal. | closed |
| T-123-01-SC | Tampering | npm/pip installs | accept | Zero new deps — `requirements.txt` @075.5, `package.json` @088; no manifest change in the 123/123.1 range. | closed |
| T-123-02-01 | DoS | Pin budget starves the recent-message budget | mitigate | `context_window.py:76` `PIN_BUDGET_FRACTION=1/3`; `:338-346` LRU evict until pins fit; recent tail still protected (`:216-222`). | closed |
| T-123-02-02 | Tampering→400 | Pinned tool-result kept while parent trimmed → orphaned tool message | mitigate | `context_window.py:256-284` `_atomic_groups` keeps assistant+tool_calls parent with tool-result; pinned groups extracted whole (`:341,349`). | closed |
| T-123-02-03 | Info Disclosure/Integrity | Sniffing tool-result JSON could mis-pin arbitrary content | mitigate | Flag set in code from parent tc name only: `agent_loop.py:828-830` `if tc.get("name")=="load_skill"`. NO `json.loads`/`instructions` in `context_window.py` (grep=0). | closed |
| T-123-02-04 | Repudiation/honesty | Silent eviction of a pinned skill hides context loss | mitigate | `context_window.py:325-346` every demotion sets `trimmed_any=True` → honest `_TRIM_MARKER` (`:213-214,375`). Never silent. | closed |
| T-123-02-SC | Tampering | npm/pip installs | accept | Zero new deps (see T-123-01-SC). | closed |
| T-123-03-01 | Info Disclosure | Sibling auto-seed leaks another user's private skill names | mitigate | `skill_tuner_service.py:406-428` owner-scoped `.or_(user_id.eq.{id},is_global.eq.true)`; `auto_seed_cases` (`:289-338`) does NO DB I/O — scope cannot widen in the seeder. | closed |
| T-123-03-02 | Info Disclosure | configured_targets reads provider API keys | mitigate | `skill_tuner_service.py:633-691` reads key/base_url PRESENCE only (`if p.api_key` / truthy), never the value, never logs it. `settings.py:160,169,178,187` `has_key` booleans only. | closed |
| T-123-03-03 | Tampering | Prompt-injection in author should-NOT case steers classifier | mitigate | `skill_tuner_service.py:245-285` `classify_fires` gives the target model ONLY the emit tool (`:173-197`) — no write/agent capability. Worst case = a wrong cell visible to the author. | closed |
| T-123-03-04 | Tampering/honesty | Classifier measures a DIFFERENT policy than production | mitigate | `skill_tuner_service.py:47` imports `LOAD_SKILL_POLICY` from `skill_lint`; `:141-148` interpolates it — SAME constant `agent_loop.py:1122` uses. No forked copy. | closed |
| T-123-03-05 | Elevation (D-14 RED LINE) | New raw SDK / agent-loop path forks the shared provider boundary | mitigate | Emission only via `forced_emit` (`:223,267`). NO raw SDK / `.messages.create` / agent_loop entry (grep=0; docstring prose only). | closed |
| T-123-03-SC | Tampering | npm/pip installs | accept | Zero new deps (see T-123-01-SC). | closed |
| T-123-04-01 | Info Disclosure/Elevation (IDOR) | A user starts/streams/reads a tuning run for another user's non-global skill | mitigate | `skill_tuner.py:177-206` `_fetch_owned_or_global_skill` = `.eq(id).or_(user_id.eq,is_global.eq.true)`, 404 on miss; called FIRST on every route (`:665,789,838,890,968,1023`). `get_supabase()`=service-role (`dependencies.py:19`) → app-scoping is the sole gate. 123.1 CR-01 run↔skill `zscore` bind (`:800,901,1026`). | closed |
| T-123-04-02 | DoS | Background run (cases × N × 3 × ≤5 iter live LLM) exhausts resources/cost | mitigate | `skill_tuner.py:67-75` MAX_CASES=40 / MAX_TARGETS=8 / MAX_ITERATIONS=5; per-call `asyncio.wait_for` (`:320,425`); atomic `SET NX` one-job-per-skill (`:676-683`, 409 on dup). | closed |
| T-123-04-03 | Tampering (event overload) | Overloading chat SSE event types with tuner progress | mitigate | `skill_tuner.py:79-81` only `tuner_progress`/`tuner_provider_done`/`tuner_complete`; `_emit_tuner`/`_emit_terminal` (`:210-240`) emit only these + generic `done`/`error`. No chat event type. | closed |
| T-123-04-04 | Info Disclosure | Run state persisted cross-user | mitigate | Cases client-held (`:167-173`); scoreboard at owner-bound `tuner_result:{run_id}` (`:569-573`); only winning description persists via owner-scoped PATCH. No other user's data in `run:{id}`. | closed |
| T-123-04-SC | Tampering | npm/pip installs | accept | Zero new deps (see T-123-01-SC). | closed |
| T-123-05-01 | Tampering/honesty | Scoreboard fabricates an aggregate or renders a provider the org doesn't run | mitigate | `ProviderScoreboard.tsx:88-93` rows = `cells.map` (server-only — non-target never renders); `:176-186` EVERY cell shows BOTH `fires` + `no-false`; `:98-129` unmeasured renders honest "could not measure". | closed |
| T-123-05-02 | Tampering (auto-apply) | Winner auto-applied without author confirmation | mitigate | `CandidateCard.tsx:54-67` `onConfirm` fires only inside `handleConfirm`, reachable only via explicit "Use"→"Confirm & save" (`:172-189`). Not on mount/render. | closed |
| T-123-05-03 | Repudiation/honesty | Fake percent for a queued provider, or timer vanishes mid-run | mitigate | `LiveRunCard.tsx:122` queued lane = "queued" (no %); `:123-128` running = spinner+"running" (no %); `:79-80` elapsed from stable `startTs`, frozen via `frozenAt` (`:63-79`), never reset on transient stream-end. | closed |
| T-123-05-04 | Info Disclosure | Tuner reads/streams another user's skill via crafted skillId | mitigate | Server-side owner-scoping is the gate (T-123-04-01 routes 404 cross-user). UI calls owner-scoped routes with the author bearer; carries no service-role capability. | closed |
| T-123-05-SC | Tampering | npm/pip installs | accept | Zero new deps (see T-123-01-SC). | closed |
| T-123-06-01 | Repudiation/honesty | Lint warning silent or non-specific, letting a weak description ship | mitigate | `SkillFormDialog.tsx:103` renders only when `lintWarnings.length>0`; `:114-115` maps each `{w.message}` verbatim (specific reason). Silent when healthy; never-block by design. | closed |
| T-123-06-02 | Tampering/availability (SPOF) | Hardcoding a paid provider as the only builder option | mitigate | `SettingsPage.tsx:1038-1084` picker offers cloud + LOCAL (Ollama/LM Studio/OpenAI-compat — `:40-41,1033`); honest `Auto · {resolved}` default; resolver honest-None floor `skill_tuner_service.py:82-110`. Test asserts ≥1 local option. | closed |
| T-123-06-03 | Info Disclosure | Builder-model id treated as a secret / echoed where keys live | mitigate | A model id is a value — rides the settings contract (`settings.py:78-79,143,195-196,344-345`). No API key rendered/echoed (only `resolved_skill_builder_model` label + `has_key` booleans). | closed |
| T-123-06-SC | Tampering | npm/pip installs | accept | Zero new deps (see T-123-01-SC). | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Unregistered Flags

None. All six SUMMARY.md `## Threat Surface` sections explicitly state
"No new security surface introduced beyond the plan's threat model. No threat flags."
No new attack surface requires registration.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-123-SC | T-123-01-SC / 02-SC / 03-SC / 04-SC / 05-SC / 06-SC | Zero new dependencies shipped in the Phase 123 / 123.1 commit range. `backend/requirements.txt` last changed at Phase 075.5; `frontend/package.json` at Phase 088. No supply-chain surface added by this phase. | Operator (fhdmrd) | 2026-06-26 |
| R-123.1-05 | T-123.1-05 (global-skill last-runner attribution, `077_tuner_runs.sql:12-16`) | For a GLOBAL skill the single `tuner_runs` row's `user_id` is "the last runner", not an access gate; the SELECT-by-skill is identical for all global viewers. Low risk — global skills are an explicitly shared scope. (123.1 disposition, recorded for completeness.) | Operator (fhdmrd) | 2026-06-26 |

*Accepted risks do not resurface in future audit runs.*

---

## Notes on the load-bearing IDOR / owner-scoping threats

- `get_supabase()` is the SERVICE-ROLE client (`dependencies.py:16-19`,
  `supabase_service_role_key`) → RLS is bypassed, so the app-code `.or_(...own,global)`
  / `.eq("user_id", ...)` scoping is the SOLE leak gate. Verified present and
  called-first on every tuner route and every skill mutation route.
- The CR-01 run↔skill bind (`redis.zscore(runs_by_thread:tuner:{skill_id}, run_id)`)
  is real and non-vacuous: it refuses a leaked/foreign `run_id` even for a skill the
  caller CAN see, closing the shared-`run:{run_id}`-keyspace cross-buffer read. The
  integration test injects a `secret_marker` into a foreign run buffer and asserts a
  404 on BOTH stream and results (`test_skill_tuner_routes.py:294-344`).
- T-123-03-04 single-source policy is genuine: `classify_fires` imports
  `LOAD_SKILL_POLICY` from `skill_lint` (not a forked copy) — the exact string
  `agent_loop.py` injects into the production catalog note.
- T-123-03-02 / T-123-06-03 key handling is presence-only: no API key value is read,
  logged, rendered, or echoed; only truthiness booleans and resolved-model-id labels
  cross any boundary.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-26 | 29 | 29 | 0 | gsd-security-auditor (opus) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-26

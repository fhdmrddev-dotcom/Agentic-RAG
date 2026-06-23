---
phase: 123-skill-triggering-quality
reviewed: 2026-06-23T20:36:54Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - backend/app/api/settings.py
  - backend/app/api/skill_tuner.py
  - backend/app/api/skills.py
  - backend/app/config.py
  - backend/app/main.py
  - backend/app/models/skill.py
  - backend/app/models/user_settings.py
  - backend/app/services/agent_loop.py
  - backend/app/services/context_window.py
  - backend/app/services/skill_lint.py
  - backend/app/services/skill_tuner_service.py
  - backend/app/services/tool_dispatcher.py
  - backend/tests/integration/test_skill_tuner_routes.py
  - backend/tests/integration/test_skills_lint.py
  - backend/tests/unit/test_context_window.py
  - backend/tests/unit/test_skill_builder_model.py
  - backend/tests/unit/test_skill_catalog_note.py
  - backend/tests/unit/test_skill_lint.py
  - backend/tests/unit/test_skill_tuner_scoring.py
  - backend/tests/unit/test_skill_tuner_service.py
  - frontend/src/App.tsx
  - frontend/src/components/layout/ChatLayout.tsx
  - frontend/src/components/skills/SkillFormDialog.tsx
  - frontend/src/components/skills/tuner/CandidateCard.tsx
  - frontend/src/components/skills/tuner/CaseEditor.tsx
  - frontend/src/components/skills/tuner/LiveRunCard.tsx
  - frontend/src/components/skills/tuner/ProviderScoreboard.tsx
  - frontend/src/lib/api.ts
  - frontend/src/pages/SettingsPage.tsx
  - frontend/src/pages/SkillsPage.tsx
  - frontend/src/pages/SkillTunerPage.tsx
  - frontend/src/types/index.ts
findings:
  critical: 2
  warning: 8
  info: 4
  total: 14
status: resolved
resolution: All 2 Critical + 5 of 8 Warning findings were adversarially re-verified (7/7 confirmed real, 1 reviewer-fix corrected) and fixed in commits c5b2757a/d7328212/e64ffc0c/14f25439/d1910de6/aae0ef0e/fd80cf21. Remaining 3 Warnings (WR-03/WR-05/WR-08) + 4 Info accepted as non-blocking backlog. See Resolution Log at end.
---

# Phase 123: Code Review Report

**Reviewed:** 2026-06-23T20:36:54Z
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues_found

## Summary

Reviewed the Phase 123 (Skill Triggering Quality — TRIG-01/03/CTX-03) implementation:
the Skill Trigger Tuner (router + service + frontend surface), the deterministic skill
lint, the D-01 catalog-note relaxation, and the CTX-03 trim-pin change. The load-bearing
boundaries the prompt called out are mostly sound: **owner-scoping on the tuner routes is
correct** (every route gates through `_fetch_owned_or_global_skill` with `.or_(own,global)`
and 404-not-403, proven by `test_skill_tuner_routes.py`); the **lint is genuinely
warn-never-block** across all three save surfaces; the **trim-pin atomic grouping never
orphans a tool_call parent** (whole groups move together); the **Gemini schema risk is
neutralized** by the google adapter's `_sanitize_schema_for_google`.

However the review surfaced two correctness defects that defeat documented design intent:
(1) the tuner background job resolves the **skill-builder model and the configured target
set from the env-level `app.config.settings` object, not from the DB-backed app_settings**,
so the Settings-UI knob and UI-configured provider keys are silently ignored; and (2) the
**OpenRouter target is never actually scored** because its representative model is empty and
the job skips empty-model targets — directly contradicting the "OpenRouter = distinct
first-class target" contract. Plus a clutch of WARNINGs around the in-flight-guard race, the
unbalanced held-out split, the shared `consumer_timeout` falsely flagging long runs as
failed, a silent save-failure path in the frontend, and a documented-but-absent auto-seed
display.

## Critical Issues

### CR-01: Tuner job ignores the configured skill-builder model and provider keys (reads env settings, not app_settings)

**File:** `backend/app/api/skill_tuner.py:217` and `backend/app/api/skill_tuner.py:401`
**Issue:** Both `resolve_skill_builder_model(settings)` (line 217) and
`configured_targets(settings)` (line 401) are passed the **env-level config object**
imported at line 56 (`from app.config import ... settings`). But the user-facing
`skill_builder_model` knob and the provider API keys are persisted to the DB-backed
`app_settings` row (via `update_settings` → `save_app_settings`, see
`backend/app/api/settings.py:344-345` and `:262`), surfaced through
`UserEffectiveSettings` (`load_app_settings_async`). The env `Settings` object's
`skill_builder_model` is `None` for any deployment that configures it through the Settings
UI, so the resolver always falls through to the registry default — the knob has **no
effect on the actual run**. Likewise `configured_targets` probes `settings.openai_api_key`
etc. on the env object; a provider whose key was saved only through the Settings UI
(stored in `app_settings.{provider}_api_key`) is invisible, so the default target set is
wrong/empty for UI-configured installs. Note `settings.py:196` correctly resolves the
*displayed* label from `UserEffectiveSettings s`, making the bug worse: the UI shows the
configured model as resolved while the run uses a different one.
**Fix:** Resolve effective settings inside the route/job and pass THAT, not the env object:
```python
# in start_tuner_run (and/or _run_tuner_job) — mirror settings.py:196
from app.models.user_settings import load_app_settings_async
eff = await load_app_settings_async()
targets = skill_tuner_service.configured_targets(eff)   # was configured_targets(settings)
# and inside _run_tuner_job:
builder_model = skill_tuner_service.resolve_skill_builder_model(eff)  # was settings
```
`resolve_skill_builder_model` / `configured_targets` already accept any object exposing the
attributes (the unit tests pass a `SimpleNamespace`), so only the call sites change. If env
keys are genuinely the intended source for some providers, the resolution must at minimum
union env + app_settings, not silently prefer the (usually empty) env value.

### CR-02: OpenRouter target is configured but never scored — empty representative model is skipped

**File:** `backend/app/services/skill_tuner_service.py:386` and `backend/app/api/skill_tuner.py:271-274`
**Issue:** `_REPRESENTATIVE_MODEL["openrouter"] = ""` (skill_tuner_service.py:387).
`configured_targets` emits an OpenRouter target with `model=""` whenever the OpenRouter key
is present. The job then hits `model = target.get("model") or ""` / `if not model: continue`
(skill_tuner.py:272-274) and **skips that target entirely** — no `classify_fires`, no
`build_cell`, no `tuner_provider_done` event. The result: the OpenRouter column never
appears in the scoreboard, and the frontend lane built from `started.targets`
(`SkillTunerPage.tsx:102`) stays stuck on `"queued"` forever because `onProviderDone` never
fires for it. This directly contradicts the load-bearing design contract recorded for this
phase ("OpenRouter = gateway, a DISTINCT first-class target"). An author who configures only
OpenRouter gets a run with zero scored columns and a permanently-queued lane.
**Fix:** Resolve a concrete OpenRouter model rather than emitting an empty one — derive it
from the user's selected/routed model (`UserEffectiveSettings.llm_model` when
`active_provider == "openrouter"`) or require the caller to pass an explicit OpenRouter
target. Then either score it or, if no model can be resolved, do NOT emit the target at all
so the UI never shows an unscoreable lane:
```python
# configured_targets — resolve OpenRouter's representative model instead of ""
if provider == "openrouter":
    model = getattr(settings, "llm_model", "") if getattr(settings, "active_provider", "") == "openrouter" else ""
    if not model:
        continue  # don't emit an unscoreable column
    targets.append({"provider": provider, "model": model})
```

## Warnings

### WR-01: TOCTOU race + per-process scope defeats the "exactly one job per skill" DoS bound

**File:** `backend/app/api/skill_tuner.py:391` and `:432`
**Issue:** The in-flight guard checks `if skill_id in _INFLIGHT_SKILLS` at line 391 but only
`_INFLIGHT_SKILLS.add(skill_id)` at line 432 — separated by multiple `await`s
(`run_in_threadpool(fetch_owner_scoped_siblings)` at 408, the redis ZADDs at 426-427). Under
FastAPI's concurrent request handling two near-simultaneous POSTs both pass the check before
either adds, so both spawn jobs — violating the documented "exactly ONE in-flight job per
skill". Separately, `_INFLIGHT_SKILLS` is a per-process `set`, but CLAUDE.md states
multi-worker uvicorn (`WORKER_COUNT=2`) is the default, so two workers each keep their own
set and a per-skill duplicate across workers is never caught. The DoS guard (T-123-04-02) is
weaker than claimed.
**Fix:** Mark in-flight immediately after the ownership check and before any other await
(check-and-set with no intervening await), and use a Redis-backed guard (e.g. `SET
tuner_inflight:{skill_id} NX EX <ttl>`) so the bound holds across workers. Discard the Redis
key in the job's `finally` alongside the `_INFLIGHT_SKILLS.discard`.

### WR-02: Held-out split is unbalanced — the deterministic ordered cut leaves one axis vacuous

**File:** `backend/app/services/skill_tuner_service.py:297-315` (consumed at `backend/app/api/skill_tuner.py:413-417`)
**Issue:** Cases are built as `[should_fire...] + [should_not...]` (skill_tuner.py:413-416),
then `split_held_out` deterministically takes the first 60% as train and the last 40% as
held-out (no shuffle, by design). Because the list is sorted by class, the held-out 40%
(the tail) skews heavily — often entirely — toward should-NOT cases. The job scores ONLY on
held-out (`for case in held_out_cases`, skill_tuner.py:280). `_score_axis` returns `1.0` for
an empty axis (skill_tuner_service.py:329), so a candidate's `fires` (recall) sub-score is a
**vacuous 1.0** whenever the held-out partition contains no should-fire cases (and vice
versa). The scoreboard then reports artificially perfect recall/precision and the
"winner-by-held-out" pick is made on a degenerate signal. (`train` is never used for
anything since candidates are pre-generated, so 60% of cases are simply discarded.)
**Fix:** Split per class so held-out preserves both rails — e.g. interleave or split
should_fire and should_not independently and concatenate, so the held-out set always
carries cases of both kinds:
```python
fire = [c for c in cases if c.get("should_fire")]
nofire = [c for c in cases if not c.get("should_fire")]
tr_f, ho_f = split_held_out(fire, ratio); tr_n, ho_n = split_held_out(nofire, ratio)
train, held_out = tr_f + tr_n, ho_f + ho_n
```

### WR-03: Long tuner runs are falsely flagged as failed by the shared consumer_timeout

**File:** `backend/app/api/skill_tuner.py:470-478` (re-uses `replay_tail_consumer`); `backend/app/api/runs.py:109,114-116,199-200`
**Issue:** The tuner stream reuses the shared `replay_tail_consumer`, which enforces a
wall-clock `deadline = settings.consumer_timeout_seconds` (610s, config.py:899) and yields
`{"type": "error", "error": "consumer_timeout"}` when exceeded. A bounded tuner run can be
long (up to MAX_ITERATIONS=5 × MAX_TARGETS=8 × held-out cases × DEFAULT_REPEATS=3 provider
calls, each up to its per-call timeout), so a worst-case run can approach/exceed 610s. The
frontend `streamTunerRun` maps `t === "error"` → `onTerminal("error", "consumer_timeout")`
(api.ts:2828-2830) and `SkillTunerPage` then sets `runPhase="error"` with "The tuning run
failed." (SkillTunerPage.tsx:136-140) — even though the job keeps computing server-side and
the scoreboard is still readable via GET results. The `error` terminal path does NOT
reconcile via `getTunerResults`; only the non-error terminal does (SkillTunerPage.tsx:142-149).
**Fix:** Treat a `consumer_timeout` (and `redis_timeout` / `reader_done`-equivalent) as a
transient, NON-failure terminal in the tuner page: on those, reconcile via
`getTunerResults` (and optionally re-subscribe) rather than showing a hard failure. Long
term, give the tuner stream its own, longer deadline rather than borrowing the chat-tuned
610s.

### WR-04: Frontend candidate "Confirm & save" swallows errors and surfaces no failure feedback

**File:** `frontend/src/components/skills/tuner/CandidateCard.tsx:36-46` and `frontend/src/pages/SkillTunerPage.tsx:173-179`
**Issue:** `handleConfirm` awaits `onConfirm(candidate)` inside a `try/finally` with NO
`catch`. `onConfirm` is `handleConfirmWinner`, which does `await updateSkill(...)` with no
error handling (SkillTunerPage.tsx:176). If the PATCH fails, `setDone(true)` is never
reached, `saving` resets to false, the diff strip stays open, and the rejected promise
propagates out of the `onClick` async handler as an **unhandled promise rejection** — with
zero user-visible feedback. The author clicks "Confirm & save", nothing changes, and they
have no idea the live description was not written.
**Fix:** Catch the error and surface it inline:
```tsx
const handleConfirm = async () => {
  if (saving) return
  setSaving(true); setSaveError(null)
  try { await onConfirm(candidate); setDone(true); setConfirming(false) }
  catch { setSaveError("Couldn't save the description. Please try again.") }
  finally { setSaving(false) }
}
```
and render `saveError` near the Confirm button.

### WR-05: CaseEditor advertises auto-seed it never performs; run config miscounts auto-seeded cases

**File:** `frontend/src/components/skills/tuner/CaseEditor.tsx:1-13,90,115` and `frontend/src/pages/SkillTunerPage.tsx:68,260-262`
**Issue:** The CaseEditor docstring and empty-state copy promise hybrid auto-seed ("add one
or run to auto-seed", "hybrid auto-seed + author edits (D-04)"), and the `EditorCase`
provenance union includes `"seeded" | "sibling" | "held"`. But there is no client-side
auto-seed: `cases` starts `[]` (SkillTunerPage.tsx:68), the `skill` prop is destructured as
unused `_skill` (CaseEditor.tsx:115), and `addCase` only ever produces provenance `"you"`
(CaseEditor.tsx:132) — so `seeded`/`sibling`/`held` are dead values. The backend DOES
auto-seed when the POST body's `cases` is empty (skill_tuner.py:405-417), but those seeded
cases are never echoed back, so the editor stays empty, the split bar reads "0 train · 0
held-out", and the run-config bar shows "0 cases × N models" (SkillTunerPage.tsx:260-262)
while the run actually executes against auto-seeded cases. Confusing, dishonest UI vs the
documented intent.
**Fix:** Either (a) fetch/display the server-seeded cases (add a preview endpoint or return
the seeded set on the POST response and hydrate the editor + provenance tags), or (b) remove
the auto-seed copy and the dead provenance values and state plainly that an empty editor
means "server seeds defaults at run time", and reflect the seeded count after kickoff.

### WR-06: `_pinned_skill` extra key on tool messages is sent verbatim to the OpenAI-compat SDK

**File:** `backend/app/services/agent_loop.py:830`; flows through `backend/app/services/context_window.py` (never stripped) into `backend/app/services/openai_service.py:1490`
**Issue:** `_reconstruct_history` stamps `tool_msg["_pinned_skill"] = skill_name` on
load_skill tool-result messages (agent_loop.py:830). `trim_messages_to_fit` preserves the
field (it is the de-dupe key; `_build_candidate` extends the pinned messages verbatim,
context_window.py:376-378), and the resulting `messages` are handed to the gateway. For the
OpenAI-compat path the list is passed straight to
`client.chat.completions.create(messages=messages, ...)` (openai_service.py:1490) with no
key stripping. openai-python serializes message dicts as-is; the OpenAI API and several
compat providers reject unrecognized message-level properties with a 400. The Anthropic and
Google adapters convert messages (so the field is dropped there), and the existing
`reasoning_content` precedent is only added on DeepSeek (which accepts it) — `_pinned_skill`
is added unconditionally on EVERY provider that has a load_skill in history. The code comment
at agent_loop.py:800-803 asserts "non-Google providers ignore unknown fields", but that
claim is about extra keys on the tool_call dict, not the tool *message*, and is unverified
for the message level.
**Fix:** Strip `_pinned_skill` (an internal-only marker) from messages immediately before
the provider call — e.g. in `_build_candidate`'s output or at the gateway boundary, drop any
key starting with `_` from each message dict. Add a cross-provider UAT row that reloads a
thread containing a load_skill and re-streams on OpenAI/OpenRouter to confirm no 400.

### WR-07: `update_skill` PATCH is unbounded — `update_data` can carry only `name=None` edge

**File:** `backend/app/api/skills.py:303-307`
**Issue:** `update_data = body.model_dump(exclude_none=True)` then `if not update_data:
raise 400`. If a client sends `{"name": null}` (or all-null), `exclude_none` drops it and
the 400 fires — fine. But if a client sends `{"name": "   "}` (whitespace), line 305 strips
it to `""` and the empty name is written, allowing a skill to be renamed to blank. The lint
(`name_echo`/etc.) is advisory only, so nothing prevents persisting an empty/whitespace name,
which would break the catalog-note rendering (`- **{name}**: {desc}`) and the dedupe-by-name
in `_handle_save_skill`.
**Fix:** After stripping, reject an empty name: `if "name" in update_data and not
update_data["name"]: raise HTTPException(422, "Skill name cannot be empty")`. Mirror the same
guard in `create_skill` (skills.py:155-180), which currently inserts `body.name.strip()`
without an empty check.

### WR-08: Tuner result store read maps a transient Redis hiccup to a hard 503 mid-poll

**File:** `backend/app/api/skill_tuner.py:496-508`
**Issue:** `get_tuner_results` does `raw = await redis.get(...)` and on ANY exception raises
503 (lines 498-503). But the normal lifecycle is that the result key does not yet exist
until the job finishes — that path returns 404 (correct). A transient Redis read error
during the author's polling window turns into a 503 that the frontend `getTunerResults` maps
to a non-404 ApiError ("Failed to load tuner results.", api.ts:2734-2737), which in the
`onTerminal` reconcile path is swallowed by `.catch(() => {})` (SkillTunerPage.tsx:147-149)
— so a real result-store outage is silently indistinguishable from "kept the SSE scoreboard".
Combined with WR-03, an author can end up with no scoreboard and no actionable signal.
**Fix:** Keep the 503 for the route, but in the frontend distinguish 404 (poll again /
in-progress) from 503 (transient — retry with backoff) instead of silently swallowing, and
log/surface the 503 case.

## Info

### IN-01: `TriggerDecision.skill_name: str | None` renders as `anyOf` — docstring claims "no anyOf/oneOf"

**File:** `backend/app/services/skill_tuner_service.py:104-117`
**Issue:** The module docstring and the schema comment assert "FLAT, single-typed … No
discriminated multi-model unions and no multi-type `type:[...]` arrays". Pydantic v2 renders
`skill_name: str | None` as `anyOf: [{type: string}, {type: null}]` (the test at
`test_skill_tuner_service.py:341-345` explicitly acknowledges this). This is NOT a Gemini
break in practice because `google_service._sanitize_schema_for_google` strips `anyOf`
(`_GOOGLE_UNSUPPORTED_SCHEMA_KEYS`, google_service.py:257) and the load-bearing field
`would_load` is a plain boolean — but the docstring's blanket "no anyOf/oneOf" claim is
inaccurate and could mislead a future maintainer who adds a target that lacks the sanitizer.
**Fix:** Soften the docstring to "no multi-MODEL discriminated unions; an Optional renders as
the harmless string|null anyOf, which the google adapter sanitizes", matching the test's own
qualifier.

### IN-02: SKILL_BUILDER_MODEL_OPTIONS contains placeholder local model ids

**File:** `frontend/src/pages/SettingsPage.tsx:51-53`
**Issue:** `lm-studio/qwen3` and `openai-compat/local-model` are example/placeholder ids.
Selecting one persists it verbatim; `resolve_skill_builder_model` returns it unchanged and
the gateway routes by inference. `openai-compat/local-model` is not a real model and would
honest-fail at run time (caught by the tuner's honest-fail floor, so no crash), but the
picker presents it as a selectable option with no hint that the operator must substitute a
real local id.
**Fix:** Label these as templates (e.g. "LM Studio · <your model>") or drive the local
options from the user's actually-configured provider model lists rather than hardcoded
placeholders.

### IN-03: Pinned skill groups are reordered to the front of the conversation

**File:** `backend/app/services/context_window.py:356-380`
**Issue:** `_build_candidate` places pinned load_skill groups immediately after the system
message, ahead of older trimmable + protected turns. A skill loaded recently is thus moved
out of chronological order. The assistant+tool atomic pair stays contiguous (so no provider
adjacency rule is broken), but the conversation no longer reflects true turn order, which can
subtly confuse models about when the skill was loaded relative to user turns. Low risk;
noted for awareness.
**Fix:** None required for correctness; if turn fidelity matters, consider keeping pinned
groups in place and instead protecting them from trimming where they sit.

### IN-04: `_started_score` variable named "score" is actually a timestamp

**File:** `backend/app/api/skill_tuner.py:422-427`
**Issue:** `_started_score = time_mod.time()` is used as the ZADD sort score, but the name
reads like a tuning score. Minor readability nit on a brand-new module.
**Fix:** Rename to `_started_at` / `_zadd_score`.

---

## Resolution Log (2026-06-24)

The 7 load-bearing findings were re-verified by 7 independent adversarial verifiers (each tasked to *refute* the claim) before any fix. Result: **6 confirmed, 1 partial (defect real, reviewer's proposed fix was wrong), 0 refuted.** The adversarial pass corrected CR-01 (the review's "pass `eff` into `configured_targets`" fix would have produced empty scoreboards — `UserEffectiveSettings` keys live in `.providers`, not flat attrs) and escalated WR-06 to top priority (confirmed it hits the **shared chat path**, not just the tuner). Each fix is a single atomic commit with tests run on the canonical `develop` tree under the project venv/node_modules.

| ID | Severity | Verdict | Fix commit | Tests |
|----|----------|---------|-----------|-------|
| WR-06 | (shared-path regression) | confirmed | `c5b2757a` | strip `_`-keys before OpenAI-compat call + new `test_openai_service_message_sanitize.py` (3) + `test_context_window.py` (36) |
| CR-02 | Critical | confirmed | `d7328212` | OpenRouter → concrete `deepseek/deepseek-chat` representative; `test_skill_tuner_service.py` |
| CR-01 | Critical | partial (fix corrected) | `e64ffc0c` | DB-effective builder model + duck-typed target derivation from `eff.providers`; service+routes tests |
| WR-02 | Warning | confirmed | `14f25439` | per-class held-out split; `test_skill_tuner_scoring.py` |
| WR-01 | Warning | confirmed | `d1910de6` | Redis `SET NX EX 1800` one-job guard; `test_skill_tuner_routes.py` |
| WR-07 | Warning | confirmed | `aae0ef0e` | reject empty/whitespace name on POST+PATCH; `test_skills_lint.py` |
| WR-04 | Warning | confirmed | `fd80cf21` | inline save-error in `CandidateCard`; `ProviderScoreboard.test.tsx` |

Re-verified green on `develop` with the real venv: 78 backend tests across the touched files + shared-path regression files; 8 frontend tests; `tsc --noEmit` clean.

**WR-03 — FIXED after live UAT (`af73f75d`).** Promoted from backlog when the operator hit it live: a tuner run hard-failed at ~62s with `redis_timeout` (the shared SSE consumer's socket-read deadline during the long builder phase), even though the bounded job kept computing server-side. `SkillTunerPage` now treats transient transport terminals (`redis_timeout` / `consumer_timeout`) as non-fatal — reconcile via `getTunerResults`, else reconnect the stream from the buffer (bounded by MAX_RECONNECTS). Mirrors the chat path + D-v2.5-03. Proven live: a run survived past 120s, reconnected through the logged `redis_timeout`, and kept scoring providers (network: stream 200 → results 404 → stream 200). +2 regression tests. Frontend-only; shared chat consumer untouched.

**Accepted as non-blocking backlog (not fixed in-phase):**
- **WR-05** — `CaseEditor` advertises client auto-seed it never performs; dead `seeded`/`sibling`/`held` provenance values; run-config shows "0 cases" while the server auto-seeds. (Honesty/clarity; the backend DOES seed correctly.)
- **WR-08** — transient Redis read during results-poll maps to a 503 the frontend silently swallows; should distinguish 404 (poll again) from 503 (retry/surface).
- **IN-01** (`Optional` renders harmless `str|null` anyOf — google adapter sanitizes; soften docstring), **IN-02** (placeholder local model ids in the Settings picker), **IN-03** (pinned groups reordered to front — atomic pairs intact, low risk), **IN-04** (`_started_score` is a timestamp — rename nit).

These map to observability/UX polish, not correctness or security boundaries; suitable for a follow-up phase or `/gsd:code-review 123 --fix`.

---

_Reviewed: 2026-06-23T20:36:54Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Resolution: 2026-06-24 (orchestrator + 7 adversarial verifiers)_
_Depth: standard_

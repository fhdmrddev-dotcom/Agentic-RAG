---
phase: 186
slug: concurrency-autosave
status: verified
threats_open: 0
asvs_level: 1
created: 2026-08-01
---

# Phase 186 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

**Audit mode:** verification of a plan-time register (112 rows across 20 PLAN files). No blind
scan for new vulnerabilities was performed — the register is authoritative.

**Evidence rule applied.** Every `CLOSED` verdict below cites a `file:line` re-derived by
reading the shipped source in THIS audit session. No SUMMARY.md "None — every threat is
mitigated and asserted" claim was inherited; all 8 `## Threat Flags` tables were treated as
claims and re-checked against source. (Project standing lesson: 4 of 4 executors in this phase
found an inherited claim false.)

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| browser → `PATCH /workflows/{id}` | The only client write path to a draft row. | Untrusted `If-Match` token value + the full definition body |
| FastAPI route → service-role asyncpg pool | **The pool BYPASSES RLS — the WHERE clause is the only authorization wall** (T-103-01-01). | `definition_id`, `user_id` (trusted, from JWT), token, definition JSONB |
| browser → `POST /workflows/{id}/publish` | The gauntlet. Stage 0 reads the draft token; stage 5 re-checks it before the flip. | `golden_input`, definition id |
| server refusal body → client error classification | A malformed / unknown-coded refusal crosses here. | HTTP 404 / 409 / 422 bodies |
| server `PublishVerdict` → rendered spine | A `blocked_stage` code the client has never seen crosses here. | Verdict object |
| builder store → network | **None, by construction** — the store may not name the API client (D-184-03); a `?raw` source fence asserts it. | — |

---

## Threat Register

Legend — `Status`: `closed` (verified this session) · `open` (mitigation absent).

### Plan 186-01 — concurrency token & clobber guard (backend write path)

| Threat ID | Category | Component | Disposition | Mitigation (verified) | Status |
|-----------|----------|-----------|-------------|------------------------|--------|
| T-186-01-01 | Elevation of Privilege | `update_workflow_definition` WHERE clause | mitigate | Token is the **third** conjunct, never a replacement: `backend/app/db/workflows.py:560-561` (`WHERE id = $1 AND created_by = $2 AND status = 'draft' AND <token> = $5`). The un-tokened branch keeps the same owner scope at `:572`. A forger with a perfect token still matches 0 rows on another user's draft. | closed |
| T-186-01-02 | Information Disclosure | the D-186-09 disambiguating re-read | mitigate | The probe is owner-scoped: `backend/app/db/workflows.py:589-591` (`WHERE id = $1 AND created_by = $2`). It can only ever describe a row the caller already owns. | closed |
| T-186-01-03 | Information Disclosure | the new 409 branch as an existence oracle | mitigate | **Verified as a property, not a patch.** `not_found` and every unrecognised cause reach a SINGLE raise site — `backend/app/api/workflows.py:1032-1034`, `detail="draft not found"`, a bare string with no `code` field. Byte-identity is by construction (one code path), not by test coincidence. Falsifiable test: `backend/tests/unit/test_186_concurrent_patch.py:496-522` asserts `missing.detail == minted.detail` AND `isinstance(detail, str)` — it would fail the moment a code were added. | closed |
| T-186-01-04 | Information Disclosure | the `token` returned in the 409 body | accept | See Accepted Risks R-01. Disclosed at `backend/app/api/workflows.py:1029`; reachable only after the owner-scoped probe returned a row. | closed |
| T-186-01-05 | Tampering | SQL injection via the token | mitigate | (a) token bound as `$5` — `backend/app/db/workflows.py:567`, never interpolated as a value; (b) `CONCURRENCY_TOKEN_SQL` is a module-level code literal at `backend/app/db/workflows.py:90-92` containing zero user input; (c) the token is echoed verbatim and never parsed (`frontend/src/lib/api.ts:3355-3356`, `frontend/src/hooks/useDraftPersistence.ts:40`). Every f-string splice in the file is the constant, never a value. | closed |
| T-186-01-06 | Tampering | published-row immutability | mitigate | The `CheckViolationError` → 409 handler is **KEPT** alongside the `status='draft'` conjunct: `backend/app/api/workflows.py:1006-1012`. Race case covered by `backend/tests/unit/test_186_concurrent_patch.py:525`. | closed |
| T-186-01-SC | Tampering | package installs | n/a | See §Supply Chain. | closed |

### Plan 186-02 — publish-race guard

| Threat ID | Category | Component | Disposition | Mitigation (verified) | Status |
|-----------|----------|-----------|-------------|------------------------|--------|
| T-186-02-01 | Repudiation | the `-1` / `-2` sentinel pair | mitigate | Two distinct returns at `backend/app/db/workflows.py:432` (`return -2 if still_a_draft else -1`), routed to two distinct branches with two distinct `named_failures` at `backend/app/services/harness/publish_service.py:379-388` (`already_published`) and `:399-411` (`draft_changed`). No collapse into `{published: True}` on either path — `publish_succeeded` is written only at `:412-422`, after both sentinel checks. | closed |
| T-186-02-02 | Spoofing / EoP | `publish_definition`'s owner-free probe | accept | See Accepted Risks R-02. Probe at `backend/app/db/workflows.py:428-431` returns a bare `1`, never row contents; caller owner-checked at `publish_service.py:103`. | closed |
| T-186-02-03 | Information Disclosure | `not_found` at stage 0 | mitigate | Unchanged and uniform: `publish_service.py:104-113` → `backend/app/api/workflows.py:833-835`, one 404 for missing and cross-user alike. No branch added by this phase. | closed |
| T-186-02-04 | Tampering | publishing a definition that never passed the gauntlet | mitigate | Structural WHERE guard, not a client hold: `backend/app/db/workflows.py:413-419` (`AND {CONCURRENCY_TOKEN_SQL} = $2`), fed the stage-0 token captured at `publish_service.py:122` and spent at `:372`. | closed |
| T-186-02-05 | Repudiation | the golden-run audit trail | mitigate | `_block` only ADDS a `publish_blocked` row — `publish_service.py:449-460`; it performs no delete/update, and `golden_run_id` is carried through at `:458`. | closed |
| T-186-02-SC | Tampering | package installs | n/a | See §Supply Chain. | closed |

### Plan 186-03 — transport client, token & named refusals

| Threat ID | Category | Component | Disposition | Mitigation (verified) | Status |
|-----------|----------|-----------|-------------|------------------------|--------|
| T-186-03-01 | Spoofing (of success) | the 409 arm's body parse | mitigate | `frontend/src/lib/api.ts:3456-3465` — `res.json().catch(() => ({}))`, then `if (code === "stale_token") … ; throw new WorkflowConflictError()` as the terminal fallback. An unparseable body, an absent `detail` and a code minted after this client shipped all THROW; nothing on this path can resolve. | closed |
| T-186-03-02 | Information Disclosure | the 422 raw body | mitigate | `frontend/src/lib/api.ts:3381-3388` — fixed `message` (`:3383`), raw body reaches exactly one `console.warn` at the boundary (`:3386`) and is not stored on the instance. The hook maps it to the fixed `HOLD_UNREADABLE` sentence (`useDraftPersistence.ts:414-416`). | closed |
| T-186-03-03 | Tampering | narrowing the server's refusal vocabulary client-side | mitigate | `detail?: { code?: string }` at `frontend/src/lib/api.ts:3457` — a `string`, not a literal union. No client allow-list exists. | closed |
| T-186-03-04 | Information Disclosure | the `If-Match` header value | accept | See Accepted Risks R-03. Header added (never substituted) at `frontend/src/lib/api.ts:3440-3443`. | closed |
| T-186-03-SC | Tampering | package installs | n/a | See §Supply Chain. | closed |

### Plan 186-04 — builder store KB binding

| Threat ID | Category | Component | Disposition | Mitigation (verified) | Status |
|-----------|----------|-----------|-------------|------------------------|--------|
| T-186-04-01 | Tampering | the D-184-03 no-network fence | mitigate | `setProjectFolder` writes state only — `frontend/src/components/workflows/builderStore.ts:586-590`; no `fetch`/API import anywhere in the module. `?raw` source fence intact at `frontend/src/components/workflows/builderStore.test.ts:20`. | closed |
| T-186-04-02 | Repudiation | silent loss of a KB binding | mitigate | Binding and `dirty` are armed in ONE `set()`: `builderStore.ts:589` (`set({ meta: {…, project_folder_id: id}, dirty: true })`). | closed |
| T-186-04-03 | Repudiation | assertion loss during retirement | mitigate | The untracked-setter invariant was RETARGETED, not deleted — `builderStore.test.ts:339-347` ("an untracked setter followed by markSaved leaves the undo stack untouched"), with the retirement rationale recorded in place. | closed |
| T-186-04-SC | Tampering | package installs | n/a | See §Supply Chain. | closed |

### Plan 186-05 — publish spine fails closed

| Threat ID | Category | Component | Disposition | Mitigation (verified) | Status |
|-----------|----------|-----------|-------------|------------------------|--------|
| T-186-05-01 | Spoofing (of success) | `GauntletSpine` `isPassed` / `connReached` | mitigate | **The research-flagged fail-open is FIXED.** `frontend/src/components/workflows/PublishGauntlet.tsx:428` derives `unknownBlock = blockedStage != null && blockedIndex === -1` ONCE, above the map; both reads consume it first — `:437` (`isPassed`) and `:444` (`connReached`). Verified as a PROPERTY (any unknown stage), not a `draft_changed` special case. Falsification test with a bogus code: `PublishGauntlet.test.tsx:564` ("paints no passed node, no reached connector and no ✓ badge"). | closed |
| T-186-05-02 | Information Disclosure | `wordedHeadline` | mitigate | The raw token is no longer interpolated into user copy: `frontend/src/components/workflows/verdictModel.ts:153-156` (`blockedSentence`, total, string-typed guard) with the sentence fallback at `:142-143`. Consumed at `PublishGauntlet.tsx:647`. | closed |
| T-186-05-03 | Tampering | a client-side stage allow-list | mitigate | None exists. `BLOCKED_SENTENCE` (`verdictModel.ts:128-133`) is a wording map of two entries whose miss path is total, not a filter; the red-line docblock at `verdictModel.ts:12-29` and its 25 `?raw` fences remain. | closed |
| T-186-05-04 | Repudiation | a silently empty stage glyph | mitigate | Render assertion proving child nodes: `PublishGauntlet.test.tsx:802-806` ("renders a real glyph on EVERY spine node — an unverified icon slug cannot ship as an invisible node"). | closed |
| T-186-05-SC | Tampering | package installs | n/a | See §Supply Chain. | closed |

### Plan 186-06 — `useDraftPersistence` core

| Threat ID | Category | Component | Disposition | Mitigation (verified) | Status |
|-----------|----------|-----------|-------------|------------------------|--------|
| T-186-06-01 | Spoofing (of success) | the completion handler | mitigate | `markSaved()` has EXACTLY ONE call site in the hook — `frontend/src/hooks/useDraftPersistence.ts:733` — reached only after a confirmed non-throwing write AND `!superseded`. Every refusal path `break`s at `:672` before it. | closed |
| T-186-06-02 | Tampering | a stale write clobbering a newer one | mitigate | Every PATCH carries `tokenRef.current` — `useDraftPersistence.ts:650-654` → `api.ts:3440-3443`. The client re-derives no staleness verdict of its own; the server WHERE is authoritative. | closed |
| T-186-06-03 | Denial of Service | retry storm after a conflict | mitigate | `haltedRef` stops the loop at three levels: `:596` (writer), `:757` (effect schedules nothing), `:760` (matured timer). Combined with `AUTOSAVE_DEBOUNCE_MS` and single-flight (`:603`), write rate is bounded. | closed |
| T-186-06-04 | Tampering | an aborted-but-committed PATCH consuming the token | mitigate | No `AbortController` on the write path: the hook constructs none (only a prose reference at `:29`), and the call at `:650-654` passes no `signal` argument to `updateWorkflowDraft`. Writes are serialized, never cancelled. | closed |
| T-186-06-05 | Information Disclosure | the raw 422 body reaching a rendered value | mitigate | `refusalOf` maps `WorkflowDraftUnreadableError` to the fixed `HOLD_UNREADABLE` constant — `:414-416`; no body substring enters `PersistState`, and `BuilderSaveRegion` renders `state.sentence` verbatim (`BuilderSaveRegion.tsx:194`). | closed |
| T-186-06-06 | Tampering | an automatic overwrite | mitigate | `overwrite()` is defined at `:1053` and returned at `:1080`; it is invoked nowhere inside the hook (verified by full-file grep — remaining matches are the type declaration `:365` and docblocks). Reload is the DOM-first default. | closed |
| T-186-06-SC | Tampering | package installs | n/a | See §Supply Chain. | closed |

### Plan 186-07 — page composition

| Threat ID | Category | Component | Disposition | Mitigation (verified) | Status |
|-----------|----------|-----------|-------------|------------------------|--------|
| T-186-07-01 | Spoofing (of success) | the quiet status line | mitigate | `frontend/src/components/workflows/BuilderSaveRegion.tsx:144-153` — `Saved · just now` is reachable only from `receiptVisible` (`:125`: `state.kind === "saved" && !dirty`). Held and error kinds render their own sentences (`:146`, `:192-196`). | closed |
| T-186-07-02 | Tampering | a cosmetic drag entering the write path | mitigate | Zero-write assertions past the debounce: `WorkflowBuilderPage.canvas.test.tsx:1045`, `:1243-1252`, `:1560` ("Well past the live loop's debounce, so 'zero' is not 'not yet'"), with the positive control at `:547`. `canvasNudge.ts` shows a **0-line diff** across the whole phase (`git diff 56742a9a..HEAD`). | closed |
| T-186-07-03 | Repudiation | silent loss of unsaved work on navigate-away | mitigate | `dirty`-keyed guards KEPT: `WorkflowBuilderPage.tsx:1365` (`canLeave`, dep `[…, dirty]` at `:1367`) and `:1380-1387` (`beforeunload` mounted only while dirty). A failed write leaves `dirty` true (no `markSaved`), so the guard fires exactly when it should. | closed |
| T-186-07-04 | Tampering | an accidental overwrite | mitigate | Reload renders FIRST in DOM order — `BuilderSaveRegion.tsx:245-253` — Overwrite second at `:254-262`. Neither is auto-invoked (T-186-06-06). | closed |
| T-186-07-05 | Tampering | scope creep into a G-5 read-only file | mitigate | Verified by `git diff` rather than by claim: `WorkflowCanvas.tsx` and `canvasNudge.ts` show 0 lines changed across the entire phase. `CanvasToolbar.tsx` shows 12+/5- — **attributable to plan 186-04 only** (commit `699aede7`, docblock prose retiring the store's `SaveState` reference); plan 186-07 touched none of the three. Noted as a scope observation, not a breach: the plan-07 criterion holds. | closed |
| T-186-07-SC | Tampering | package installs | n/a | See §Supply Chain. | closed |

### Plan 186-08 — KB binding on the header

| Threat ID | Category | Component | Disposition | Mitigation (verified) | Status |
|-----------|----------|-----------|-------------|------------------------|--------|
| T-186-08-01 | Spoofing (of a verdict) | `UNBOUND_KB_INVITATION` | mitigate | Declared at `WorkflowBuilderPage.tsx:324`; its ONLY render site is the chip option at `:1688`. Re-derived independently: it does **not** appear in `blockedReason` (`:1093-1102`), nor in `verdicts`/`groupVerdicts`. Source fence + tray-count control at `WorkflowBuilderPage.header.test.tsx:563-576`, `:704`, `:717-720`. | closed |
| T-186-08-02 | DoS (self-inflicted) | unbinding while a phase carries `folder_scope` | mitigate | No authoring control writes `folder_scope`: `PhaseFormPanel.tsx:347` / `:370-385` render it through the read-only `BoundValue` path; the only writes in the tree are fixtures. Carry-forward recorded with a re-open trigger at `deferred-items.md:9-38`. A client-side refusal was rejected (would be the client computing a validation rule). | closed |
| T-186-08-03 | Elevation of Privilege | the folder id written into the definition | accept | See Accepted Risks R-04. | closed |
| T-186-08-04 | Repudiation | a binding silently lost on navigate-away | mitigate | `setProjectFolder` arms `dirty` (`builderStore.ts:589`) and the call site flips `hasEdited` (`WorkflowBuilderPage.tsx:1658`), so both the leave guard and the live check see the edit. | closed |
| T-186-08-SC | Tampering | package installs | n/a | See §Supply Chain. | closed |

### Plan 186-09 — receipt gate on payload identity

| Threat ID | Category | Component | Disposition | Mitigation (verified) | Status |
|-----------|----------|-----------|-------------|------------------------|--------|
| T-186-09-01 | Repudiation | `performWrite`'s receipt path | mitigate | The receipt is gated on payload identity, captured before the request leaves (`useDraftPersistence.ts:630-631`) and compared at `:689` (`now.phases !== writtenPhases \|\| now.meta !== writtenMeta`). `markSaved()` at `:733` is unreachable when superseded. | closed |
| T-186-09-02 | Tampering (data loss) | the debounce reschedule + the drain | mitigate | The superseded branch `continue`s at `:716` into a fresh turn that re-reads the store at `:617`, so a mid-flight edit is written rather than dropped; the non-pending case falls to `:728` leaving `dirty` true and a live debounce timer (deps `[definition, enabled]`, `:778`). | closed |
| T-186-09-03 | Denial of Service | the drain's `continue` loop | accept | See Accepted Risks R-05. | closed |
| T-186-09-SC | Tampering | npm installs | accept | See §Supply Chain (measured empty diff). | closed |

### Plan 186-10 — the Commit row on the spine

| Threat ID | Category | Component | Disposition | Mitigation (verified) | Status |
|-----------|----------|-----------|-------------|------------------------|--------|
| T-186-10-01 | Spoofing (false status) | `GauntletSpine` node tones | mitigate | The F7 `unknownBlock` property survives the added row unchanged (`PublishGauntlet.tsx:428/437/444`) — no per-code special case was introduced. Both drives present: every server stage (`PublishGauntlet.test.tsx:675`, `:686`, `:764`) and a genuinely unknown one (`:564`). | closed |
| T-186-10-02 | Information Disclosure | the new `what` gloss | mitigate | Plain-language `title` gloss (`PublishGauntlet.tsx:460`); the raw `blocked_stage` appears only inside the raw-verdict disclosure — `PublishGauntlet.tsx:329` — pinned by `PublishGauntlet.test.tsx:603` ("still renders the unfamiliar stage VERBATIM in the raw-verdict grid — demoted, never removed"). | closed |
| T-186-10-03 | Repudiation | the running-node pulse | mitigate | Derived from the Golden-run row, not an index literal: `PublishGauntlet.tsx:197` (`RUNNING_STAGE_INDEX = STAGES.findIndex(s => s.codes.includes("golden_run_timeout"))`), consumed at `:438`. Retargeted test at `PublishGauntlet.test.tsx:826` ("pulses the Golden run row WHEREVER it sits — and pulses nothing else"). | closed |
| T-186-10-SC | Tampering | npm installs | accept | See §Supply Chain (measured empty diff). | closed |

### Plan 186-11 — backend test reachability

| Threat ID | Category | Component | Disposition | Mitigation (verified) | Status |
|-----------|----------|-----------|-------------|------------------------|--------|
| T-186-11-01 | Repudiation | module-level `pytestmark` in the two 186 suites | mitigate | **No module-level `pytestmark` assignment exists** in `test_186_concurrent_patch.py`, `test_186_publish_race.py` or `test_103_published_409.py` (grep `^pytestmark` → 0 hits). Skips are per-test `@pytest.mark.skipif(not PG_AVAILABLE, …)` (e.g. `test_186_concurrent_patch.py:116`, `:192`, `:263`, `:339`). Unreachable-DSN run recorded as `3 passed, 9 skipped` vs a RED baseline of `12 skipped, 0 passed` (`186-11-SUMMARY.md:96`, `:102-103`). | closed |
| T-186-11-02 | Tampering | the seven live-DB tests | accept | See Accepted Risks R-06. | closed |
| T-186-11-03 | Repudiation | test coverage accounting | mitigate | Measured, not asserted: three-file collected count 12 → 12; whole suite 3457 → 3465 with the failure band unmoved at 211 (`186-11-SUMMARY.md:123`, `:127`, `:197`) — command output pasted. | closed |
| T-186-11-SC | Tampering | pip installs | accept | See §Supply Chain (measured empty diff). | closed |

### Plan 186-12 — single flight and the conflict exits

| Threat ID | Category | Component | Disposition | Mitigation (verified) | Status |
|-----------|----------|-----------|-------------|------------------------|--------|
| T-186-12-01 | Spoofing (false conflict) | `overwrite()` → `performWrite` | mitigate | Single flight has exactly ONE home — `useDraftPersistence.ts:603-606` — through which every entry point passes, so two concurrent PATCHes carrying the same token are unreachable and the loop cannot mint a `stale_token` banner for a conflict that never happened. `overwrite` additionally guards at `:1054`. | closed |
| T-186-12-02 | Tampering | `reload()`'s ref resets vs. an outstanding write | mitigate | The re-entrancy guard returns BEFORE any ref mutation: `useDraftPersistence.ts:989` (`if (inFlightRef.current \|\| reloadingRef.current) return`), with `tokenRef`/`haltedRef`/`pendingRef` written only at `:1009-1013`. | closed |
| T-186-12-03 | Elevation of privilege | the exits are user-only | accept | See Accepted Risks R-07. | closed |
| T-186-12-04 | Repudiation | the disabled banner controls | mitigate | The banner stays mounted through the resolution — `BuilderSaveRegion.tsx:228` (`state.kind === "conflict" \|\| resolving`) — and both controls read inert: `disabled={resolving}` at `:249` and `:259`. | closed |
| T-186-12-SC | Tampering | npm installs | accept | See §Supply Chain (measured empty diff). | closed |

### Plan 186-13 — the revert switch and the 404 halt

| Threat ID | Category | Component | Disposition | Mitigation (verified) | Status |
|-----------|----------|-----------|-------------|------------------------|--------|
| T-186-13-01 | EoP (past the revert switch) | the hold-release effect | mitigate | **Both automatic write paths are gated, verified independently.** Debounce effect: `useDraftPersistence.ts:755` (`if (!enabled \|\| definition === null) return`) with `enabled` in the dep array at `:778`. Hold release: `:900-918` returns before `performWrite()` at `:923`. The only ungated writers are `saveNow` / `reload` / `overwrite` — all person-pressed (see R-07/R-09). | closed |
| T-186-13-02 | Repudiation | the publish hold sentence | mitigate | The sentence takes the SAME input as the flush: `useDraftPersistence.ts:580` (`if (publishInFlight) return enabled ? HOLD_PUBLISHING : HOLD_PUBLISHING_MANUAL`), dep array `[publishInFlight, validationCause, enabled]` at `:583`. | closed |
| T-186-13-03 | Repudiation | `BuilderSaveRegion`'s silent `held` | mitigate | `held` is evaluated ABOVE the flag gate: `BuilderSaveRegion.tsx:144-147` (`state.kind === "held" ? state.sentence : !autosaveEnabled ? null : …`). The flag-off resting pin `FLAG_OFF_HEADER_MARKUP` (`WorkflowBuilderPage.header.test.tsx:302`, used `:312`/`:322`) shows a **0-line diff across the entire phase**. | closed |
| T-186-13-04 | DoS (self-inflicted) | the 404 retry path | mitigate | `WorkflowNotFoundError` halts the loop: `useDraftPersistence.ts:467-470` (`isTerminalRefusal`) → `:662-669` sets `haltedRef`, which blocks the writer (`:596`), the effect (`:757`) and the matured timer (`:760`). | closed |
| T-186-13-05 | Information disclosure | the 404-collapse | accept | See Accepted Risks R-08. | closed |
| T-186-13-SC | Tampering | npm installs | accept | See §Supply Chain (measured empty diff). | closed |

### Plan 186-14 — the failed exit

| Threat ID | Category | Component | Disposition | Mitigation (verified) | Status |
|-----------|----------|-----------|-------------|------------------------|--------|
| T-186-14-01 | DoS (permanent, self-inflicted) | `reload()`'s catch | mitigate | A failed exit RESTORES the conflict rather than replacing it: `useDraftPersistence.ts:1015-1027` — so `haltedRef` cannot outlive the only two controls that clear it (`:1011` and `:1059`). Both exits stay mounted and pressable (`BuilderSaveRegion.tsx:228`, `:245`, `:254`). | closed |
| T-186-14-02 | Repudiation (false state claim) | the sentence after a failed exit | mitigate | The banner carries `RELOAD_FAILED_NOTE` (`useDraftPersistence.ts:289-290`) as a SECOND line beside the unreplaced `CONFLICT_BANNER_MESSAGE` — `BuilderSaveRegion.tsx:235-243`. `SAVE_FAILED_SENTENCE` no longer describes a no-retry-possible state. | closed |
| T-186-14-03 | Spoofing (a conflict that never happened) | `reload`'s catch when not halted | mitigate | The restore is guarded: `useDraftPersistence.ts:1019` (`if (haltedRef.current)`), with the cause-neutral `SAVE_FAILED_SENTENCE` on the else arm at `:1026`. | closed |
| T-186-14-04 | DoS (server load) | the published-row 409 retry loop | mitigate | `isTerminalRefusal` names `WorkflowConflictError` — `useDraftPersistence.ts:469` — so a frozen row halts the loop rather than drawing one doomed PATCH per keystroke burst. | closed |
| T-186-14-05 | Information disclosure | `RELOAD_FAILED_NOTE` / the conflict `note` | accept | See Accepted Risks R-09. Constant verified interpolation-free at `useDraftPersistence.ts:289-290`. | closed |
| T-186-14-06 | EoP (past the revert switch) | the exits stay ungated by `enabled` | accept | See Accepted Risks R-10. Re-derived: the only `performWrite()` call sites are `:774` (gated `:755`), `:923` (gated `:900`), `:940` (`saveNow`), `:1073` (`overwrite`) — no automatic path added. | closed |
| T-186-14-SC | Tampering | npm installs | accept | See §Supply Chain (measured empty diff). | closed |

### Plan 186-15 — backend refusal coverage

| Threat ID | Category | Component | Disposition | Mitigation (verified) | Status |
|-----------|----------|-----------|-------------|------------------------|--------|
| T-186-15-01 | Repudiation | `test_186_concurrent_patch.py`'s module `pytestmark` | mitigate | Same evidence as T-186-11-01: no module-level `pytestmark`; per-test skipif. DB-free block runs in any CI. | closed |
| T-186-15-02 | Information disclosure | the 404-collapse under a NEW refusal cause | mitigate | `test_186_concurrent_patch.py:496-522` drives a literally-named unknown cause (`"cause_minted_after_this_test_shipped"`) and asserts `missing.detail == minted.detail`, `isinstance(detail, str)`, `"code" not in detail`. **Falsifiable** — adding any machine code to the 404 turns it red. | closed |
| T-186-15-03 | Information disclosure | the `stale_token` 409 carrying a token | accept | See Accepted Risks R-11. | closed |
| T-186-15-04 | Tampering | the test fixtures' token literals | mitigate | Opaque sentinels only — `T-NOW` / `T-OLD` (`test_186_concurrent_patch.py:39`, `:409`, `:463-472`, `:591-597`, `:714`). Nothing in the coverage can be cited as evidence the token is a parseable datetime. | closed |
| T-186-15-05 | Repudiation (inherited measurement) | `WorkflowBuilderPage.session.test.tsx:591` | mitigate | Re-measured and recorded in both directions rather than inherited: `186-15-SUMMARY.md:123-126` (the prior "passes in isolation" claim recorded as FALSE when measured), `:249-250` (3/3 isolation, 50/50 paired, 260/260 under load, on this machine). | closed |
| T-186-15-SC | Tampering | npm / pip installs | accept | See §Supply Chain (measured empty diff). | closed |

### Plan 186-16 — the publish pre-flight refusal

| Threat ID | Category | Component | Disposition | Mitigation (verified) | Status |
|-----------|----------|-----------|-------------|------------------------|--------|
| T-186-16-01 | DoS (billed golden run) | `runGauntlet` | mitigate | `canPublish = goldenInput.trim().length > 0 && !loading && !blocked` — `PublishGauntlet.tsx:592`; `runGauntlet` returns immediately at `:607`. `blocked` derives from the reason string at `:846`. Falsification + positive control: `PublishGauntlet.test.tsx:900` (refused click issues NO request), `:914` (reason clearing re-opens the gate, exactly one request), `:949` (whitespace-only reason blocks nothing). | closed |
| T-186-16-02 | Repudiation (unaccountable refusal) | the `draft_changed` verdict | mitigate | The click is refused up front with a cause-naming, momentary sentence: `WorkflowBuilderPage.tsx:298` (`SAVING_PUBLISH_WAIT`) returned at `:1094`. | closed |
| T-186-16-03 | EoP (past the revert switch) | the rejected `flushPendingWrites()` seam | mitigate | **The seam is not built** — grep for `flushPendingWrites` across `frontend/src` + `backend/app` returns 0 hits. The rejection and its reason are recorded at `deferred-items.md:135-162` with a re-open trigger. ⚠ **Documentation drift, non-blocking:** the plan's mitigation prose still says *"`blockedReason` is already `null` when `!canvasEnabled` … the publish trigger there stays byte-identical"*, which 186-18 deliberately superseded (`WorkflowBuilderPage.tsx:1094` now evaluates above the gate). The SECURITY PROPERTY — no automatic write past the revert switch — is intact and is now governed by T-186-18-04; only the stale sentence is wrong. | closed |
| T-186-16-04 | Repudiation (greyed in silence) | the inner Publish button | mitigate | Reason rendered inside the modal and tied to the control: `PublishGauntlet.tsx:694-700` (`data-testid="publish-inner-blocked-reason"`) + `:706` (`aria-describedby={blocked ? innerBlockedReasonId : undefined}`), with the same pairing on the outer trigger at `:921-938`. Asserted at `PublishGauntlet.test.tsx:883`, `:937`. | closed |
| T-186-16-05 | Tampering (a client-computed verdict) | the new `blockedReason` branch | accept | See Accepted Risks R-12. Re-derived: the branch carries no severity/code/tray row and never enters `verdicts`/`groupVerdicts` (`WorkflowBuilderPage.tsx:1093-1102`). | closed |
| T-186-16-06 | DoS (author locked out of publishing) | a `blockedReason` that never clears | accept | See Accepted Risks R-13. Boundedness re-derived at `useDraftPersistence.ts:738-740` (`finally { inFlightRef.current = false }`) and every terminal branch setting a non-`saving` state. | closed |
| T-186-16-SC | Tampering | npm installs | accept | See §Supply Chain (measured empty diff). | closed |

### Plan 186-17 — the drain, bounded

| Threat ID | Category | Component | Disposition | Mitigation (verified) | Status |
|-----------|----------|-----------|-------------|------------------------|--------|
| T-186-17-01 | DoS (self-inflicted) | the drain's `continue` | mitigate | Re-entry is gated on `pendingRef` alone: `useDraftPersistence.ts:716` (`if (pendingRef.current) continue`), whose only arming site is the single-flight guard at `:604`. Every other supersession falls to the `break` at `:729`. | closed |
| T-186-17-02 | Spoofing (a conflict that never happened) | the token minted by every extra write | mitigate | Structural consequence of T-186-17-01 — fewer writes means fewer minted tokens. The no-op-PATCH source (`pendingRef` inside the receipt test) was removed: `:689` compares payload references only, with the reason recorded at `:683-688`. | closed |
| T-186-17-03 | Repudiation (a false receipt) | the receipt gate | mitigate | CR-01's property preserved verbatim: `:689` is a pure payload-identity compare; `pendingRef` is explicitly absent from it (`:683`). | closed |
| T-186-17-04 | Repudiation (a false status) | `{kind:"saving"}` left by the new break | mitigate | The break resolves the reading first: `:728` (`setState({ kind: "idle" })`) then `:729` (`break`). | closed |
| T-186-17-05 | Repudiation (false state claim) | the flag-off hold sentence | mitigate | The `held` reading is resolved unconditionally on the non-null → null transition, ABOVE every write gate: `:896` (`setState(s => s.kind === "held" ? { kind: "idle" } : s)`) precedes `:899` (halt) and `:900` (flag). | closed |
| T-186-17-06 | EoP (past the revert switch) | the `!enabled` arm of the hold release | mitigate | The arm still returns before `performWrite()`: `:900-918` vs `:923`. Call-site enumeration matches 186-13's exactly (four sites: `:774`, `:923`, `:940`, `:1073`). | closed |
| T-186-17-07 | Tampering (a stale arming that writes later) | `heldPendingRef` on the flag-off path | mitigate | Set to the store's own `dirty`, one read two uses: `:907-908` (`const unsent = store.getState().dirty; heldPendingRef.current = unsent`). It can neither claim work that does not exist nor survive into a clean enabled session. | closed |
| T-186-17-SC | Tampering | npm installs | accept | See §Supply Chain (measured empty diff). | closed |

### Plan 186-18 — CR-03 gap closure (the flag-off refusal)

| Threat ID | Category | Component | Disposition | Mitigation (verified) | Status |
|-----------|----------|-----------|-------------|------------------------|--------|
| T-186-18-01 | Tampering | the client publish pre-flight refusal | accept | See Accepted Risks R-14. Server-side backstop re-derived: `publish_service.py:122` (stage-0 token) → `:372` (stage-5 guarded flip) → `:399-411` (`draft_changed` block preserving the golden-run receipt). | closed |
| T-186-18-02 | Information disclosure | `SAVING_PUBLISH_WAIT` on the flag-off header | mitigate | Fixed client-authored constant with nothing interpolated: `WorkflowBuilderPage.tsx:298`. Task 2 changed only WHERE the branch is evaluated (`:1094`), not what it renders. | closed |
| T-186-18-03 | Denial of Service | publish disabled while `persistState.kind === "saving"` | mitigate | Bounded by construction: `useDraftPersistence.ts:738-740` (`finally` always clears `inFlightRef`) and every terminal branch resolves to a non-`saving` state (`:671`, `:700`, `:728`, `:734`). The one unbounded branch is recorded as a deferral (`deferred-items.md` §WR-15) rather than introduced. | closed |
| T-186-18-04 | Elevation of privilege | the D-181-01 revert switch | mitigate | **Independently confirmed — this is the CR-03 fix and it is real.** `WorkflowBuilderPage.tsx:1094` (`if (persistState.kind === "saving") return SAVING_PUBLISH_WAIT`) sits ABOVE the gate at `:1095` (`if (!canvasEnabled \|\| builderPhase !== "drafted") return null`); all four verdict branches (`:1096`, `:1097`, `:1098-1101`) stay BELOW it, so the reverted surface still shows no server verdict. `FLAG_OFF_HEADER_MARKUP` is unedited across the entire phase (measured `git diff` — 0 matching lines). | closed |
| T-186-18-SC | Tampering | package installs | n/a | See §Supply Chain. | closed |

### Plan 186-19 — the flag-off hold sentence

| Threat ID | Category | Component | Disposition | Mitigation (verified) | Status |
|-----------|----------|-----------|-------------|------------------------|--------|
| T-186-19-01 | Spoofing (a false receipt) | `HOLD_ENDED_UNSAVED` | mitigate | Carried by `{kind:"held"}` (`useDraftPersistence.ts:915`), a variant with no `at` and no `ok` field (`:212` declaration + the union at `:293+`). `BuilderSaveRegion` maps `held` to the quiet line only (`:146`), never to `SAVED_STILL_A_DRAFT` (gated `state.kind === "saved"` at `:183`) and never to the `builder-save-error` alert (gated `state.kind === "error"` at `:192`). `markSaved` is not called on this path. | closed |
| T-186-19-02 | Information disclosure | the new constant's text | mitigate | Fixed string, nothing interpolated: `useDraftPersistence.ts:212`. Distinct from `HOLD_PUBLISHING` (`:162`), `HOLD_PUBLISHING_MANUAL` (`:183-184`) and `SAVE_FAILED_SENTENCE` (`:229`). | closed |
| T-186-19-03 | Tampering / integrity | `heldPendingRef` cleared in `overwrite()` | mitigate | Cleared at `:1072` with `await performWrite()` on the very next line (`:1073`), which writes the CURRENT store definition bypassing the dirty gate — so nothing is lost. Mirrors `reload()`'s success path (`:1012`). | closed |
| T-186-19-04 | DoS / economics | the no-op PATCH | mitigate | Closed by T-186-19-03's clear; every PATCH mints a fresh token (`:655`), so the unrequested write that would invalidate other tabs' optimistic guards no longer occurs. | closed |
| T-186-19-05 | Elevation of privilege | D-181-01's no-automatic-write guarantee | mitigate | The `!enabled` branch keeps its `return` above `performWrite()` — `:917` vs `:923`; only `setState` was added below the gate (`:915`). | closed |
| T-186-19-SC | Tampering | package installs | n/a | See §Supply Chain. | closed |

### Plan 186-20 — round-closure bookkeeping

| Threat ID | Category | Component | Disposition | Mitigation (verified) | Status |
|-----------|----------|-----------|-------------|------------------------|--------|
| T-186-20-01 | Repudiation | the five deferred warnings | mitigate | All five carry an observable re-open trigger: `deferred-items.md:159` (flush seam), `:181` (conflict/error publish), `:226` (WR-14), `:261` (WR-15), `:289` (WR-16), `:309` (WR-17), `:345` (WR-18). WR-18 additionally states its residual exposure — "what a null token loses is the **optimistic** guard" (`deferred-items.md` §WR-18, line ~341) — sized as not-an-authorization loss. | closed |
| T-186-20-02 | Tampering (with the record) | `186-VALIDATION.md` sign-off | mitigate | Verified by `git`: the three plan-20 commits (`5a1cc5c8`, `a72b1fd7`, `5002f249`) touch `.planning/` files only — **zero source files**, and `.planning/REQUIREMENTS.md` is not among them (0 hits). No false-completion SDK verb was used. | closed |
| T-186-20-03 | Information disclosure | WR-18's deferral text | accept | See Accepted Risks R-15. | closed |
| T-186-20-04 | DoS (of the next verification) | inheriting counts instead of measuring | mitigate | Command output pasted for every number: `186-20-SUMMARY.md:128-129` (11 files / 429 tests), `:169-172` (21 passed, 0 skipped), `:179` (3474 collected), `:229-230` (5 files / 227 tests), with the attribution at `:317`. | closed |
| T-186-20-SC | Tampering | package installs | n/a | See §Supply Chain. | closed |

---

## Supply Chain — the 11 `n/a` rows + the 9 `accept` rows, verified once

All 20 `T-186-NN-SC` rows claim the phase installs zero packages. **Measured, not inherited:**

```
git diff --stat 56742a9a..HEAD -- frontend/package.json frontend/package-lock.json backend/requirements.txt
→ (empty)
```

(`56742a9a` = `docs(state): close Phase 185`, the last commit before the phase-186 register was
authored; `HEAD` = `4d446670`.) Zero dependency change across the entire phase in either stack.
All 20 SC rows — 11 `n/a` (plans 01–08, 18, 19, 20) and 9 `accept` (plans 09–17) — resolve
**closed** on this single measurement.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-01 | T-186-01-04 | The 409 body's `token` is a timestamp of a row the caller already owns — the disambiguating probe that produced it is owner-scoped (`db/workflows.py:589-591`). No `created_by`, `slug` or other field joins the refusal body (`api/workflows.py:1026-1030`). | Phase 186 plan 01 | 2026-08-01 |
| R-02 | T-186-02-02 | `publish_definition`'s disambiguating probe carries no owner clause. The caller has already owner-checked via `get_definition` at stage 0 (`publish_service.py:103`), the function is unreachable from any un-owner-checked path, and the probe returns a bare `1` — never row contents (`db/workflows.py:428-431`). | Phase 186 plan 02 | 2026-08-01 |
| R-03 | T-186-03-04 | The `If-Match` value on the wire is not a secret and carries no integrity claim; it is a timestamp of a row the caller owns. | Phase 186 plan 03 | 2026-08-01 |
| R-04 | T-186-08-03 | `project_folder_id` is an existing declared field; retrieval scope is resolved server-side by `scope.py` against the caller's own access, so binding a folder the caller cannot read grants nothing. Unchanged by this phase. | Phase 186 plan 08 | 2026-08-01 |
| R-05 | T-186-09-03 | The drain's `continue` loop terminates when the store stops changing between snapshot and completion; each turn issues exactly one request and every turn requires a real edit to re-arm. No timer re-arms inside the drain. Bounded further by 186-17's `pendingRef` gate. | Phase 186 plan 09 | 2026-08-01 |
| R-06 | T-186-11-02 | The seven live-DB tests still skip rather than fail when Postgres is down — the shipped Phase 102 posture, deliberate and unchanged. The risk that a live-only regression escapes CI is not widened by this phase. | Phase 186 plan 11 | 2026-08-01 |
| R-07 | T-186-12-03 | `reload` / `overwrite` stay ungated by `enabled` on purpose: they are user-initiated, and D-186-08 requires that a person who hit a conflict is always offered both ways out on any surface. The re-entrancy guard adds no automatic write, so D-181-01 is untouched. | Phase 186 plan 12 | 2026-08-01 |
| R-08 | T-186-13-05 | The client deliberately cannot distinguish "deleted elsewhere" from "not yours" — that collapse IS the existence-leak defence (T-103-01-01) and is preserved. Consequence: the client must NOT auto-recreate the draft, which is why the terminal sentence stops rather than recovers. | Phase 186 plan 13 | 2026-08-01 |
| R-09 | T-186-14-05 | `RELOAD_FAILED_NOTE` and the conflict `note` are fixed client-authored constants with NOTHING interpolated — no status code, no URL, no server body. `conflictTokenRef` is echoed into state as before and is never rendered; the token stays opaque and is never parsed. | Phase 186 plan 14 | 2026-08-01 |
| R-10 | T-186-14-06 | The exits stay ungated by `enabled` — unchanged from 186-12/13 and deliberate: `saveNow` / `reload` / `overwrite` run because a person pressed them. Re-verified: the `performWrite()` call-site set is unchanged (four sites), so no automatic path was added. | Phase 186 plan 14 | 2026-08-01 |
| R-11 | T-186-15-03 | Disclosing the current token in the `stale_token` 409 is deliberate and already accepted (R-01). The new tests assert the token is CARRIED and deliberately assert nothing about its format. | Phase 186 plan 15 | 2026-08-01 |
| R-12 | T-186-16-05 | The `blockedReason` write-outstanding branch states a fact about THIS CLIENT's own write loop; it carries no severity/code/tray row and never enters `verdicts` or `groupVerdicts`, so D-182-06 (the server owns every verdict) is intact. | Phase 186 plan 16 | 2026-08-01 |
| R-13 | T-186-16-06 | A `blockedReason` that never clears would need a stuck `saving`, which `performWrite`'s own `finally` prevents. A conflict or error state does NOT block publish under this phase (recorded as a deferral with a re-open trigger). | Phase 186 plan 16 | 2026-08-01 |
| R-14 | T-186-18-01 | The client publish pre-flight refusal is ECONOMICS AND UX, never the security boundary. A user who bypasses it (devtools, stale bundle, scripted POST) still meets the server's stage-0/stage-5 token guard in `publish_service.py`, which refuses the drifted publish with `draft_changed` and preserves the golden-run receipt. Nothing was moved from server to client. | Phase 186 plan 18 | 2026-08-01 |
| R-15 | T-186-20-03 | WR-18's deferral text describes an unguarded-write path in a planning document inside the repo. It names no credential, no token value and no bypass technique not already visible in the source it cites; the repo's threat model treats `.planning/` as trusted-internal. | Phase 186 plan 20 | 2026-08-01 |
| R-SC | all 20 `T-186-NN-SC` | Zero packages installed in either stack across the whole phase — measured, see §Supply Chain. | Phase 186, all plans | 2026-08-01 |

*Accepted risks do not resurface in future audit runs.*

---

## Unregistered Flags (WARNING — not blockers)

All 8 `## Threat Flags` sections in the 20 SUMMARY files declare "None". Each substantive
per-threat enforcement/assertion table (plans 01, 02, 03, 05, 15, 16, 19, 20) was re-checked
against source rather than inherited; no claim was found false. Two items nonetheless appeared
during the phase with **no threat-register mapping**:

| Flag | Category | Where | Why it is unregistered | Recommendation |
|------|----------|-------|------------------------|----------------|
| **WR-19** | Repudiation (honesty gap, not write-safety) | `useDraftPersistence.ts:915` — the replacement hold sentence fires only when the pre-hold reading was `idle` (`s.kind === "idle" ? … : s`). A `saved`-then-edited author who hits a publish hold on the flag-off surface still lands in silence — the verbatim WR-12 symptom through a sibling prior state. | Discovered by the gap-closure review AFTER plan 186-20 authored `deferred-items.md`, so it received no `##` entry and no re-open trigger. It does not create a false receipt (T-186-19-01's property holds: `markSaved` is uncalled, `dirty` stays true) — the failure is silence, not a lie. | Add a `deferred-items.md` entry with a re-open trigger, matching the WR-14..18 treatment, before the next phase touches the hold-release effect. |
| **WR-20** | Repudiation (honesty gap) | `useDraftPersistence.ts:889-891` — a `held` reading is never refreshed when a second hold begins immediately after the first; the release effect skips non-null → non-null transitions. | Same origin as WR-19: found after the deferral ledger was written. Stale sentence, not a write-safety defect; the server token guard and the halt-and-offer-exits mechanism are untouched. | Same as WR-19; these two re-open together. |
| **Doc drift (informational)** | — | `186-16-PLAN.md` T-186-16-03 mitigation prose | It still asserts *"`blockedReason` is already `null` when `!canvasEnabled` … the publish trigger there stays byte-identical"*. 186-18 deliberately superseded that ordering (`WorkflowBuilderPage.tsx:1094`). The security property is intact and is now governed by T-186-18-04 — only the sentence is stale. | Correct the prose the next time the register is touched; no code change owed. |
| **Scope observation (informational)** | — | `CanvasToolbar.tsx` | T-186-07-05 declares a 0-file diff on `WorkflowCanvas.tsx` / `canvasNudge.ts` / `CanvasToolbar.tsx`. Measured across the whole phase, `CanvasToolbar.tsx` carries 12+/5- — all of it docblock prose from plan **186-04** (`699aede7`), none from plan 186-07. The plan-07 criterion holds; the phase-level statement does not. | None owed. Recorded so a future audit does not read the phase-level claim as measured. |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-01 | 112 | 112 | 0 | gsd-security-auditor |

Breakdown: **77 mitigate** (all verified in shipped source with `file:line`) · **24 accept**
(15 threat rows + 9 SC rows, each with a recorded rationale in the Accepted Risks Log) ·
**11 n/a** (SC rows, closed on one measured `git diff`).

### Priority-focus verdicts (the seven targets named at audit intake)

| # | Target | Verdict |
|---|--------|---------|
| 1 | RLS-bypassing write path — `created_by = $N` on BOTH the guarded UPDATE and the re-read probe | **CONFIRMED PRESENT.** `db/workflows.py:560` (UPDATE, owner conjunct precedes the token conjunct at `:561`), `:572` (un-tokened branch), `:589-591` (probe). |
| 2 | Existence-oracle collapse — one identical, code-less 404 | **CONFIRMED.** Single raise site `api/workflows.py:1034`; byte-identity is structural, and the test that pins it is falsifiable. |
| 3 | Token opacity + SQL injection | **CONFIRMED.** `$5` bind (`:567`), module constant (`:90-92`), echoed-never-parsed on the client. |
| 4 | CR-03 fail-open publish guard | **REFUTED as still-open — the fix shipped.** `WorkflowBuilderPage.tsx:1094` precedes `:1095`. Independently re-derived; `deferred-items.md:198-204` now cites the corrected ordering, so the rejection of the stronger `flushPendingWrites` fix no longer rests on the defeated premise. No threat left open. |
| 5 | `PublishGauntlet` fail-open painting (`findIndex` → `-1`) | **FIXED.** `PublishGauntlet.tsx:428/437/444` — the sentinel is interpreted once into two named states; both reads consume `unknownBlock` first. No false green receipt. |
| 6 | Sentinel collision (`-1` vs `-2`) | **CANNOT COLLAPSE.** `db/workflows.py:432` returns two values; `publish_service.py:379` and `:399` are two separate early-return branches, both ahead of the `publish_succeeded` audit write at `:412`. |
| 7 | Published-row immutability race (`CheckViolationError` → 409) | **KEPT.** `api/workflows.py:1006-1012`, alongside — not replaced by — the `status='draft'` conjunct. |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Note for the phase gate:** this audit certifies the threat register only. It does not
substitute for `186-VALIDATION.md`'s operator UAT rows, nor does it discharge WR-19/WR-20,
which are logged above as unregistered flags with a recommended action.

**Approval:** verified 2026-08-01

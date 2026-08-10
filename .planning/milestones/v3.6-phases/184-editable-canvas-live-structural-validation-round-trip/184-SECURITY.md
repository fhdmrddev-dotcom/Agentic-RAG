---
phase: 184
slug: editable-canvas-live-structural-validation-round-trip
status: verified
threats_open: 0
threats_total: 72
asvs_level: 1 (L2 applied to the multi-tenant isolation + authz-adjacent items)
created: 2026-07-28
audited_by: gsd-security-auditor
audit_mode: verify-declared-mitigations (register authored at plan time; no fresh STRIDE scan)
---

# Phase 184 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> **Independent verification.** Every `CLOSED` below was reached by reading the named
> file/line or by running a grep/git command in this audit — NOT by accepting the
> executor's `## Threat Model Disposition` attestation. Where a claim could only be
> confirmed against the executor's run record (a green test suite, a passing build), the
> row says so explicitly in **Verified how**.

---

## Scope of this audit

- **Register:** 70 plan-time threats across 13 plans (55 `mitigate`, 15 `accept`).
- **Commit range:** `f10684f65846d597123f03afb397b716990b5ece^..HEAD` (Phase 184 plans
  01–13, the 184.1 header insert, the operator-UAT fix wave, and UAT closure).
- **Minted during this audit:** 2 new threats (`T-184-UAT-01`, `T-184-UAT-02`) for the
  backend change that landed after all 13 registers were authored. See
  [The uncovered change](#the-uncovered-change--adjudication).
- **Not run by this audit (per constraints):** `vitest`, `npm run build`, Docker, the
  backend, the dev server. Test *source* was read as evidence of what is asserted.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| npm registry → build tree | One net-new dependency (`zundo`) enters `frontend/package.json` | Third-party code |
| in-memory store → outgoing draft payload | `selectDefinition` is the single seam where store state becomes a `POST /workflows` / `PATCH /workflows/{id}` body | Author-supplied `WorkflowDefinition` JSONB |
| client → `POST /workflows/validate` | An unsaved, author-controlled definition crosses on every debounced edit | Author-supplied definition |
| server 422 body → business-user surface | A shape rejection carries Pydantic `loc`/`msg` internals | Server internals |
| server verdict `severity`/`code`/`message` → rendered tray row + node label | The client must present, never adjudicate (D-182-06) | Server-authored strings |
| `GET /workflows/grounding-bundle` → rendered option set | The server-owned registry is the only legitimate tool whitelist | Server-owned capability list |
| shared browser origin → `localStorage` | Two users on one machine share an origin; the cosmetic `dy` map must not cross | Cosmetic layout offset |
| pointer/keyboard gesture → definition mutation | A drag is the one input that can silently change what runs | Structural definition edit |
| live Supabase → committed source artifact | The one-off dump copies real definition shapes into a repo file | Redacted workflow definitions |
| operator kill-switch write → per-worker settings cache → `/features` + `CanvasGateMiddleware` | **Added post-plan.** The enforcement path for the whole flag-off revert gate | Feature audience (`off` / `everyone` / `role`) |

---

## Threat Register

Status legend: **CLOSED** = mitigation independently confirmed in code · **CLOSED (record)** =
confirmed in code, with one sub-claim resting on the executor's run record · **OPEN** = not
confirmed.

### Cluster 1 — Layout-key leakage into the definition JSONB

| Threat ID | Category | Disposition | Verified how | Status |
|---|---|---|---|---|
| T-184-04-01 | Tampering | mitigate | `builderStore.ts:256-258` — `selectDefinition` is literally `{ ...state.meta, phases: state.phases }`, adds no key. Grepped the whole store for `position` / `dy` / `layout` / `x:` / `y:` — **zero** positional fields exist in the store (only docblock mentions at :32, :499). | CLOSED |
| T-184-05-03 | Tampering | mitigate | `canvasModel.ts:403-422` — `fromCanvas` carries phases through **by reference** (`bySlug.get(node.id)`); it cannot add or rename a key. Duplicate-slug fail-safe at `:411` returns `[...source]` so a phase can never be dropped. `canvasModel.roundtrip.test.ts:153` proves it with `toBe` (`Object.is`), which no rebuild can satisfy. | CLOSED |
| T-184-07-02 | Tampering | mitigate | `canvasNudge.ts:75` imports **only** `getCurrentUserIdSync` from `@/lib/streamsCache` — no builderStore, no canvasModel, no `@/lib/api`. Fence + planted-literal controls at `canvasNudge.test.ts:348-396`; whole-suite `fetch` spy at 0 (`:394-396`). **Scope fence verified directly:** `git diff f1068...^..HEAD -- supabase/migrations` = **0 lines**; highest migration on disk is `113_sso_configs_firming.sql`, so slot 114 is genuinely RESERVED. | CLOSED |
| T-184-10-02 | Tampering | mitigate | `WorkflowCanvas.tsx:855-882` — `dy` is merged into a node **copy** (`position` is a fresh object literal, the model's own object reused when `dy === 0`). `grep localStorage WorkflowCanvas.tsx` → **0**. | CLOSED |
| T-184-11-01 | Tampering | mitigate | `WorkflowBuilderPage.canvas.test.tsx:503-531`. The walk runs over `mockCreate.mock.calls[0]` and `mockUpdate.mock.calls[1]` — the **actual serialized body objects** handed to the API client, not a hand-built fixture. Positive control at `:528-531` genuinely fires (`["position","x","y"]`). See **Observation O-1** below for a coverage caveat. | CLOSED |

### Cluster 2 — Client adjudicating server verdicts (D-182-06 red line)

| Threat ID | Category | Disposition | Verified how | Status |
|---|---|---|---|---|
| T-184-02-03 | Repudiation | mitigate | `definitionOps.test.ts:426-431` fences `fetch(`, `workflows/validate`, `XMLHttpRequest\|EventSource\|sendBeacon` against `definitionOps?raw`; whole-suite `fetch` spy at 0 (`:791-793`). Both refusals are pure shape predicates over the phases array. | CLOSED |
| T-184-06-02 | Repudiation | mitigate | `useLiveValidation.ts:242-247` — `ok` and `verdicts` are set straight from `res`. Read the whole file: **no severity literal appears anywhere**, no code table, no re-mapping. `causeOf` branches on the *error name*, never on a verdict field. | CLOSED |
| T-184-07-04 | Repudiation | mitigate | `StepTypePicker.test.tsx:334-377` — `?raw` fence on `fetch(` and `workflows/validate`, with controls at `:363-364` that provably fire; whole-suite `fetch` spy at 0 (`:375-377`). Reason strings come from `definitionOps.allowedTypesAt`. | CLOSED |
| T-184-08-02 | Repudiation | mitigate | Read `verdictModel.ts` end to end: no code table. `verdictModel.test.ts:226-291` fences **eleven** real backend identifiers with a two-case positive control (`:237-241`), fences value-imports of `@/lib/api` with a line-scoped regex + control, and pins that the **only** severity comparison is `verdict.severity === SOFT_SEVERITY` (`:288-292`) with `=== "error"` explicitly forbidden. Unknown severity → hard (fail-closed) at `verdictModel.ts:150-152`. | CLOSED |
| T-184-12-02 | Repudiation | mitigate | `grep workflows/validate WorkflowCanvas.tsx` → **0**. Refusal and delete notices carry distinct testids (`canvas-notice-refusal:1245` vs `canvas-notice-undo:1268`) and distinct treatments. | CLOSED |

### Cluster 3 — Flag-off surface drift (inherits 181's revert gate)

| Threat ID | Category | Disposition | Verified how | Status |
|---|---|---|---|---|
| T-184-03-03 | EoP | mitigate | `revertByteIdentical.test.tsx` (at `frontend/src/components/admin/`) is **absent from the entire phase git diff** — `git log <range> -- "*revertByteIdentical*"` returns nothing. Its pin of 7 is registered in `scripts/vitest-count-gate.cjs:74`. *Greenness itself was not re-run here.* | CLOSED (record) |
| T-184-04-03 | EoP | mitigate | `BuilderStoreProvider.tsx:37-38` returns a bare `<BuilderStoreContext.Provider>` — **no DOM element**, so the flag-off grid child ordering is unchanged. Plus the unmodified revert test above. | CLOSED |
| T-184-09-03 | EoP | mitigate | The substitute guard is adequate and I read it: `PhaseFormPanel.rails.test.tsx:71-124` asserts a rails-absent render contains **none** of 7 rail markers, then a **positive control** (`:107-117`) asserts every one of them *does* render with rails, then `:119-123` asserts the two DOMs differ. That is a stronger guard than a byte-snapshot alone, and it covers exactly the component `revertByteIdentical.test.tsx` never mounts. | CLOSED |
| T-184-11-06 | EoP | mitigate | `WorkflowBuilderPage.tsx:1567-1573` — `{...(canvasEnabled ? { rails } : {})}`, spread-conditional. Asserted on the props object with `"rails" in props` → `false` (`WorkflowBuilderPage.canvas.test.tsx:605-606`) plus `Object.keys(props)` — **absent is genuinely distinguished from `undefined`** — with a flag-on control at `:611`. | CLOSED |
| T-184-13-05 | EoP | mitigate | `WorkflowCanvas.tsx:1304` — `editable && session ? (…) : null`; the whole bottom region is unrepresentable when `editable` is false. Undo keydown effect early-returns before `addEventListener` (`WorkflowBuilderPage.tsx:620-621`, listener registered at `:647`). | CLOSED |

> **Cross-cluster caveat.** All five threats above verify the *client renders nothing* given a
> flag-off answer. None of them verifies that the server *produces* a flag-off answer promptly
> after the operator flips the switch. The live UAT proved that half was broken — see
> `T-184-UAT-01` / `T-184-UAT-02`.

### Cluster 4 — Degraded-reads-as-clean / fail-closed

| Threat ID | Category | Disposition | Verified how | Status |
|---|---|---|---|---|
| T-184-06-03 | Spoofing | mitigate | `useLiveValidation.ts:118-127` — the `degraded` union member declares **no `ok` field**; a clean read is unrepresentable at the type level. `.catch` at `:249-261` funnels every non-abort rejection into `kind:"degraded"`; there is no other terminal branch. Traced every path — no route from a failed check to `kind:"verdicts"`. | CLOSED |
| T-184-08-03 | Spoofing | mitigate | `ProblemsTray.tsx:129-135` — `showCounts = hasAnyVerdict \|\| degraded === null`, so the clean counts line is suppressed while degraded; `:196-198` suppresses the "checked by the server" attribution too. `ProblemsTray.test.tsx:246-283` asserts no clean/ok affordance under either cause and proves the regex fires on the healthy state. | CLOSED |
| T-184-09-02 | Spoofing | mitigate | `useGroundingBundle.ts:69-73` — the `ready` member's `degraded` is typed `readonly []` (the **empty tuple**), so widening is a typecheck error, not a review question. `:129-137` maps `degraded.length > 0` → `kind:"unavailable"`; `:151` maps a throw to `unavailable`/`unreachable`. | CLOSED |
| T-184-11-04 | Spoofing | mitigate | `WorkflowBuilderPage.tsx:938-945` — `if (validation.kind === "degraded") return DEGRADED_SENTENCE[...]` **before** any unblock path; `PublishGauntlet.tsx:709` blocks on any non-empty reason. The `ok:false` branch returns `first.message` **verbatim**. See **Observation O-2**. | CLOSED |

### Cluster 5 — 422 body / server-internals disclosure

| Threat ID | Category | Disposition | Verified how | Status |
|---|---|---|---|---|
| T-184-06-01 | Info disclosure | mitigate | `api.ts:3454-3461` read directly. The raw body reaches exactly **one** `console.warn` inside the constructor; `super(...)` carries a fixed literal with **nothing interpolated**; the body is never stored on the instance. `ValidationState` (`useLiveValidation.ts:118-127`) carries only a `cause` discriminator — there is no field the body could ride on. | CLOSED |
| T-184-08-04 | Info disclosure | mitigate | `ProblemsTray.tsx:119` — `useTechnicalNamesOptional()?.showTechnical ?? false`, the fail-closed optional accessor. `verdict.code` renders only inside `{showTechnical ? … : null}` at `:249-253` and `:289+`, as a plain text child. The 422 body never reaches this layer. | CLOSED |
| T-184-11-05 | Info disclosure | mitigate | `WorkflowBuilderPage.tsx:1105-1118` — the catch reads only `err.name`; `err.message` is **never** used. Only two fixed literals can be surfaced: `PUBLISHED_CONFLICT_MESSAGE` (`:238-239`) and the generic state. No status code, no Pydantic `loc`/`msg`. | CLOSED |

> **Auditor judgement on the `console.warn` (asked for explicitly).** Acceptable for this data
> class. The 422 body is a Pydantic shape rejection over a definition **the same user just
> authored in their own browser** — it discloses nothing they did not supply, and no other
> tenant's data can appear in it (the route validates a raw body, not a stored row). The
> browser console is same-origin and same-session. It would *not* be acceptable if the route
> echoed stored rows or cross-tenant identifiers; it does not. Residual: the line survives in
> the production bundle, so a shape rejection is visible to anyone with the user's devtools
> open — accepted as noise, not as disclosure.

### Cluster 6 — XSS / HTML sinks

| Threat ID | Category | Disposition | Verified how | Status |
|---|---|---|---|---|
| T-184-03-01 | Tampering | mitigate | **Independent whole-diff grep** (not the per-file greps the summaries cite): every changed file scanned for `dangerouslySetInnerHTML`, `innerHTML`, `insertAdjacentHTML`, `document.write`, `srcdoc`, `eval(`, `new Function(`. **Zero sinks.** Every `innerHTML` hit is a *read* inside a test (`container.innerHTML`); every `dangerouslySetInnerHTML` hit is a docblock or the positive control at `PhaseNodeCard.test.tsx:361`. | CLOSED |
| T-184-07-05 | Tampering | mitigate | Same whole-diff grep — `StepTypePicker.tsx` has no sink. | CLOSED |
| T-184-08-01 | Tampering | mitigate | Same whole-diff grep — `ProblemsTray.tsx`, `PhaseNodeCard.tsx` have no sink; `verdict.message` renders as a text child at `ProblemsTray.tsx:248`; `blockedReason` renders as a text child at `PublishGauntlet.tsx:789`. | CLOSED |
| T-184-13-04 | Tampering | mitigate | Same whole-diff grep — `WorkflowCanvas.tsx`, `CanvasToolbar.tsx` have no sink. | CLOSED |

### Cluster 7 — Supply chain

| Threat ID | Category | Disposition | Verified how | Status |
|---|---|---|---|---|
| T-184-04-SC | Tampering | mitigate | `frontend/package.json:49` → `"zundo": "^2.3.0"`. Lockfile `node_modules/zundo`: version `2.3.0`, `license: MIT`, `integrity` pinned (sha512), **no `hasInstallScript`** → no `postinstall`. Peer range `zustand ^4.3.0 \|\| ^5.0.0` vs installed `zustand@5.0.13` — clean. | CLOSED |
| T-184-01-SC, 02-SC, 03-SC, 05-SC, 06-SC, 07-SC, 08-SC, 09-SC, 10-SC, 11-SC, 12-SC, 13-SC (12 entries) | Tampering | accept | Verified **structurally, once, for all twelve**: `git log <range> -- frontend/package.json frontend/package-lock.json` returns exactly **one** commit — `5ff18388 feat(184-04)`. No other plan touched a dependency manifest. `psycopg2` (184-05) is pre-existing. | CLOSED |

### Cluster 8 — Destructive / gesture safety

| Threat ID | Category | Disposition | Verified how | Status |
|---|---|---|---|---|
| T-184-10-01 | Tampering | mitigate | `definitionOps.ts:450-460` — `if (pitch <= 0 \|\| Math.abs(dx) < pitch / 2) return { reorderTo: null, dy }`. A purely vertical drop never enters the reorder branch. | CLOSED |
| T-184-10-03 | EoP | mitigate | `WorkflowCanvas.tsx:1442-1447` — shell `nodesDraggable={false}`, plus `nodesConnectable`, `edgesReconnectable`, `connectOnClick`, `edgesFocusable` all `false` and `deleteKeyCode={null}`; `<Controls showInteractive={false} />` at `:1475`. The **only** flip is per-node at `:875` (`draggable: editable`), guarded by `if (node.type !== CANVAS_NODE_TYPES.phase) return node` at `:857` — the end cap and the broken-reference stub stay non-draggable. A free-wired branch is unrepresentable. | CLOSED |
| T-184-12-01 | Tampering | mitigate | Delete is immediate, no modal. Recovery: `WorkflowBuilderPage.tsx:906-912` wires the notice's inline Undo to `store.temporal.getState().undo()` (zundo). `WorkflowBuilderPage.canvas.test.tsx:944-955` asserts `latest().phases` `toStrictEqual` the pre-delete array. | CLOSED |
| T-184-12-03 | EoP | mitigate | `WorkflowCanvas.tsx:1447` — `deleteKeyCode={null}`. Backspace cannot delete via the library; `✕` is the only path. | CLOSED |
| T-184-13-01 | Tampering | mitigate | `WorkflowBuilderPage.tsx:619-649`. Gate `if (!canvasEnabled \|\| activeGraphView !== "canvas") return` sits **above** `addEventListener` (:647) — no listener exists on the Spine or flag-off. `event.repeat` guard at `:624`. Yield at `:632-634`: `INPUT` / `TEXTAREA` / `isContentEditable`. Dependency array includes both gate values. | CLOSED |

### Cluster 9 — Corpus dump data handling

| Threat ID | Category | Disposition | Verified how | Status |
|---|---|---|---|---|
| T-184-05-01 | Info disclosure | mitigate | **Independently parsed the committed fixture** (`__fixtures__/corpusDump.json`, 37 KB, 108 rows). `org_id` / `user_id` / `created_by` → **0 occurrences**. All 111 distinct UUIDs are synthetic (`00000000-0000-4000-8000-0000000000NN`). Every `prompt` value is the single-char placeholder `…`. `folder_scope` and `skill_ref` values are synthetic UUIDs. Slugs aliased (`wf-001`, `step-1`). Script selects only 5 columns (`dump-workflow-corpus.py:72-76`) — the sensitive columns are never SELECTed, so a redactor bug could not leak them. | CLOSED |
| T-184-05-02 | Tampering | mitigate | `dump-workflow-corpus.py:210` — `conn.set_session(readonly=True, autocommit=True)`. Grepped the whole script for `INSERT` / `UPDATE` / `DELETE` / `DROP` / `TRUNCATE` / `--apply` / `db push` / `db reset` → only docblock mentions, **no executable write verb**. One `SELECT`, one table, no widening predicate. | CLOSED |

> **Record correction.** `184-05-SUMMARY.md` states *"The committed file contains zero
> definition rows"* and 184's own notes list *"corpusDump regen"* as owed. Both are now
> **stale**: commit `cb7d9244` regenerated the fixture from live local Supabase with **108
> definitions**, and I verified the redaction on that regenerated file. The debt is
> discharged; the summary is what is out of date, not the artifact.
>
> **Minor note (not a finding).** `_provenance.source` records the local DSN with its
> default dev credentials (`postgres:postgres@127.0.0.1:54322`). That is the shipped
> project convention for local one-off scripts and carries no secret.

### Cluster 10 — Multi-user isolation on a shared browser (ASVS L2)

| Threat ID | Category | Disposition | Verified how | Status |
|---|---|---|---|---|
| T-184-04-04 | Info disclosure | mitigate | `WorkflowBuilderPage.tsx:475` — `useState(() => createBuilderStore(...))`, created once **per mount**. No module-level store, no singleton. One workflow's zundo history cannot appear in another's session. | CLOSED |
| T-184-07-01 | Info disclosure | mitigate | `canvasNudge.ts:90-92` — `` `${CANVAS_NUDGE_KEY_PREFIX}.${userId}.${draftId}` ``, i.e. `agentic-rag.canvas-nudge.v1.<user_id>.<draft_id>`, via the shipped `getCurrentUserIdSync()` (`:107`). `resolveKey` returns `null` when **either** half is missing (`:105-110`), and every caller then falls back to the module-level in-memory `sessionBucket` (`:139`, `:169-172`, `:195-198`) — **an unscoped key is never written**. `clearNudges` removes one key only. | CLOSED |

> **Auditor judgement on user-vs-org scoping (asked for explicitly).** Per-**user** is the
> correct boundary here, and it is strictly *tighter* than per-org — an org-scoped key would
> let two colleagues on one kiosk see each other's offsets, which is exactly the leak the
> user segment prevents. Org identity would only be needed if the value were org-shared
> state; a cosmetic `dy` is a personal view preference that never leaves the browser
> (`canvasNudge.ts` imports no API client — verified above). ASVS L2 V8 satisfied. No change
> recommended.

### Cluster 11 — Scope fences that are themselves security claims

| Threat ID | Category | Disposition | Verified how | Status |
|---|---|---|---|---|
| T-184-07-02 (fence half) | Tampering | mitigate | `git diff <range> -- supabase/migrations` → **0 lines**, confirmed against the repo. `ls supabase/migrations` tops out at `113_sso_configs_firming.sql`. Slot 114 RESERVED. | CLOSED |
| T-184-09-05 | Tampering | mitigate | `grep grounding_mode PhaseFormPanel.tsx` → **0**. The token appears only in the guard's own regex and its positive control (`PhaseFormPanel.rails.test.tsx:281,288`). No creep into Phase 185's governance field. | CLOSED |

### Remaining registered threats

| Threat ID | Category | Disposition | Verified how | Status |
|---|---|---|---|---|
| T-184-01-01 | Tampering | mitigate | All six `~icons/fluent-emoji/<slug>` imports read at `phaseGlyph.tsx:42-47`. **Independently confirmed** every slug (`gear`, `memo`, `compass`, `handshake`, `raised-hand`, `package`) is present in the installed `@iconify-json/fluent-emoji` `icons.json`, so the build-time resolution the mitigation relies on is real. | CLOSED |
| T-184-01-02 | Info disclosure | accept | Rationale re-checked against shipped code: icon slugs are static asset names in a frozen map; no user/org/tenant value and no authz decision touches them. Holds. | CLOSED |
| T-184-01-03 | Tampering | mitigate | `scripts/vitest-count-gate.cjs:145` writes under `os.tmpdir()`; `:107-116` `assertOutsideWatchedTree()` **hard-refuses** any resolved path inside `frontend/` or `backend/`. The Windows reload-watcher hazard is structurally excluded. (The post-run `git status --porcelain frontend/` cleanliness rests on the run record.) | CLOSED (record) |
| T-184-02-01 | DoS | mitigate | `definitionOps.test.ts:365-399` — empty array, unknown slug, missing `validators` key, unknown `phase_type` (`"a_type_from_the_future"`), non-finite index all assert no throw and honest resolution; `:501` pins the malformed-`on_failure` case. Totality asserted, not documented. | CLOSED |
| T-184-02-02 | Tampering | mitigate | `definitionOps.ts:315-342` — `SLUG_BASE` is a closed 6-member `satisfies Record<PhaseTypeId, string>` map + `FALLBACK_SLUG_BASE`, plus a decimal suffix. No user text can reach the output. `/^[a-z0-9-]+$/` asserted at `definitionOps.test.ts:598,608,616,629`. `minimalPhaseFor` emits union-required keys only (`:344-357` docblock + the absent-optional-field test). | CLOSED |
| T-184-03-02 | DoS | mitigate | `nodePresentation.ts:63-72` — `ICON_TINT` lookup with `DEFAULT_TINT` fallback. `PhaseNodeCard.test.tsx:269-287` renders `phaseType: "llm_time_travel"` without throwing, at the default tint, with a control proving a *known* type differs. | CLOSED |
| T-184-04-02 | Repudiation | mitigate | `builderStore.test.ts:385-395` — `?raw` fence on `fetch(`, `@/lib/api`, `XMLHttpRequest\|EventSource\|sendBeacon`, each with a planted-literal control at `:391-394`; whole-suite `fetch` spy at 0 (`:577-579`). An undo cannot PATCH. | CLOSED |
| T-184-05-04 | DoS | mitigate | `__fixtures__/shapeGenerator.ts:252-271` — index gap `[0,1,4]`, duplicate `phase_index`, duplicate slug, plus a broken branch, a deep chain and one fully-populated phase per config-union member. The property suite fails loudly; nothing throws. | CLOSED |
| T-184-06-04 | Info disclosure | accept (unchanged) | Rationale re-checked against the repo: `git diff <range> -- backend/app/api backend/app/middleware backend/app/services` = **0 lines**. `CanvasGateMiddleware` (`backend/app/middleware/canvas_gate.py:107`) is untouched; 184 mounts no route and changes no auth decision. **But see `T-184-UAT-02`** — the middleware's *input* (the settings cache) is now in scope. | CLOSED (see UAT-02) |
| T-184-06-05 | DoS | mitigate | `useLiveValidation.ts:229-262` — one `setTimeout(VALIDATE_DEBOUNCE_MS=500)`, cleared in the cleanup at `:266`, plus `controller.abort()` at `:270`. `useLiveValidation.test.tsx:210-227` asserts three definitions inside the window issue **zero** calls, then exactly one carrying the LAST definition. | CLOSED |
| T-184-07-03 | DoS | mitigate | `canvasNudge.ts:140-147` try/catch → `{}` on any failure; `:175-181` catches the write, `console.warn`s and falls through; `:200-204` catches the remove. Every exported function is total. | CLOSED |
| T-184-09-01 | EoP | mitigate | `WorkflowBuilderPage.tsx:748` — `bundle.kind === "ready" ? bundle.tools : "degraded"`. The option set is the server bundle and nothing else. `PhaseFormPanel.rails.test.tsx:129-151` asserts option-set **equality** over two different arrays; `:154-166` asserts no free-text box binds `available_tools` in the rails variant, so KB content cannot whitelist itself. | CLOSED |
| T-184-09-04 | Tampering | mitigate | `PhaseFormPanel.rails.test.tsx:236-239` — a `data-locked="true"` row's subtree contains **zero** `button`, `[role="button"]` or `input` (structural absence, not a disabled control that still exists), and reads "Cannot be removed". Control at `:255-257` proves an unlocked row does carry controls. | CLOSED |
| T-184-10-04 | Repudiation | mitigate | `WorkflowCanvas.tsx:227-230` + `:232-237` — two `ARIA_LABELS` tables, chosen by `editable`; the read-only one is byte-unchanged so the shipped WR-06 assertion still measures what it was written to measure. `onSelectNode` docblock at `:95` matches the `:1185` behaviour. | CLOSED |
| T-184-10-05 | Info disclosure | accept | Rationale re-checked: `WorkflowCanvas.tsx:880` threads `verdict: marks?.(node.id)` through node `data`, the same channel the shipped ⌥ reveal uses. `grep workflows/validate WorkflowCanvas.tsx` → 0 — no new fetch, no new data class. Holds. | CLOSED |
| T-184-11-02 | Repudiation | mitigate | `WorkflowBuilderPage.session.test.tsx:495-560` — all three dismissal paths (✕, Escape, plane click) carry the zero-PATCH assertion. `clearSelection` (`WorkflowBuilderPage.tsx:568-571`) calls `flushHistory()` on every path, so the ✕ asymmetry is removed at the mechanism, not papered over. | CLOSED |
| T-184-11-03 | DoS | mitigate | `WorkflowBuilderPage.tsx:509-510,1066` — `draftIdRef` / `creatingRef` create-once guard byte-unchanged; re-asserted in the session suite. Avoids the `UNIQUE(slug, version)` 500. | CLOSED |
| T-184-12-04 | Tampering | mitigate | `WorkflowCanvas.editing.test.tsx:630,634` — every `＋` and `✕` reports `closest(".react-flow__node")` → `null`; control at `:640` proves the query is live against a real node. One-tab-stop-per-node invariant preserved. | CLOSED |
| T-184-12-05 | Tampering | mitigate | `StepTypePicker.tsx:33-36,71` — the picker has **no slug field**; `onChoose(type)` passes only a `PhaseTypeId` from the closed 6-member set. The slug is derived by `slugForType` (see T-184-02-02). | CLOSED |
| T-184-13-02 | Repudiation | mitigate | `CanvasToolbar.tsx:153,157` call only `store.temporal.getState().undo()/redo()`; whole-suite `fetch` spy at 0 (`CanvasToolbar.test.tsx:216`). `WorkflowBuilderPage.canvas.test.tsx:1206` pins the create/update clients at 0 after an undo. | CLOSED |
| T-184-13-03 | Spoofing | mitigate | `CanvasToolbar.tsx:147-148` — `useBuilderTemporal((t) => t.pastStates.length > 0)` / `futureStates`, i.e. **selector** reads on `store.temporal` (via `useStore`, `BuilderStoreProvider.tsx:78-80`). `getState()` appears only in the side-effect handlers at `:153,157`, which is where it is correct. The React-19 staleness landmine is discharged structurally. | CLOSED |

**Registered register: 70 / 70 CLOSED.**

---

## The uncovered change — adjudication

Commit `1c94ffd4 fix(184-uat): make a settings write visible to the SYNC reader` modified
`backend/app/models/user_settings.py` (+83) and added `backend/tests/test_184_settings_rewarm.py`
(+199). It landed during UAT, **after** all 13 plan-time registers were authored, so no
registered threat covers it. This is **not benign** — it is the enforcement half of the
control that cluster 3's five threats depend on — and it is minted below.

### What it actually is

`invalidate_settings_cache()` zeroes `_settings_cache_time` but never clears `_settings_cache`.
Only the **async** reader (`_load_settings_from_db`) checks that timestamp; the **sync**
`load_app_settings()` (`user_settings.py:892-899`) reads the dict directly **with no staleness
check at all**. Both `GET /features` (`backend/app/api/features.py:38`) and
`CanvasGateMiddleware` (`backend/app/middleware/canvas_gate.py:87-89`) resolve through
`feature_audience` → `_feature_record` → `load_app_settings` — the sync path. So an operator
flipping `visual_workflow_canvas` **off** wrote Postgres, got a 204, saw the Control Room radio
move to Off — and the server kept answering `true` for minutes. **The kill switch did not kill.**

The fix adds `refresh_settings_cache()` (`user_settings.py:316-362`): expire → re-read → re-expire,
called from both write seams (`save_app_settings:456`, `set_feature_visibility:1263`).

### STRIDE assessment

- **Spoofing / EoP:** No new authz decision. `git diff <range> -- backend/app/api backend/app/middleware backend/app/services` = **0 lines**, so the admin write allowlist established by `b9c5012d feat(181-01)` and the caller-side validation at `admin.py:1015` are **untouched**. `set_feature_visibility` stays on the service-role pool with the asyncpg `$1` + JSONB codec (SQLi-safe) it already had.
- **Information disclosure / cross-user cache bleed:** **Not possible.** `_settings_cache` holds exactly one row — `SELECT * FROM app_settings WHERE id = 'global'` (`user_settings.py:287`). It is global app config, never per-user or per-org, so a re-warm cannot mix tenants. ASVS L2 V8 clear.
- **Tampering:** The re-warm is a read; it cannot write. The `finally: invalidate_settings_cache()` re-expire keeps D-07 (`test_147_flag_failure_semantics`) literally true.
- **DoS:** Two extra queries per settings write, on an admin-only path. Negligible.
- **Availability / fail-safe:** `refresh_settings_cache` swallows all exceptions (`except Exception` → `logger.warning(..., exc_info=True)`), so a refresh blip cannot turn a successful write into an error, and the zeroed timestamp means the next async read repairs it. Correct design. The `exc_info=True` traceback is asyncpg-level and does not render row values; low residual.
- **Net effect on posture: an IMPROVEMENT.** It converts an unbounded fail-open on the writing worker into an immediate flip.

| Threat ID | Category | Component | Disposition | Verified how | Status |
|---|---|---|---|---|---|
| **T-184-UAT-01** | Spoofing / EoP | `user_settings.save_app_settings` + `set_feature_visibility` → `_settings_cache` → `/features` + `CanvasGateMiddleware` | mitigate | The kill-switch OFF flip is now observable to the SYNC reader **on the writing worker**. `refresh_settings_cache()` read at `user_settings.py:316-362`; both write seams confirmed to call it (`:456`, `:1263`). Backed by 4 backend tests written-first and falsified (`backend/tests/test_184_settings_rewarm.py:105,133,154,179`), incl. the re-warm-failure fail-safe. Authz surface confirmed unchanged (0-line diff across `api/`, `middleware/`, `services/`). Cache scope confirmed global-only, so no cross-user bleed. | **CLOSED** |
| **T-184-UAT-02** | Spoofing (stale security state) | the same path, on **non-writing** workers | **mitigate** (was *accept — pending*; operator chose to fix) | **FINDING, independently re-confirmed before fixing:** `load_app_settings()` (`user_settings.py:892`) performs **no staleness check whatsoever** — it returns `_settings_cache` as-is; `_SETTINGS_CACHE_TTL = 30.0` (`:269`) is honored only by the **async** `_load_settings_from_db` (`:280`). Under the `WORKER_COUNT=2` default a sibling worker kept serving the pre-flip audience to **both** `/features` and the route-existence middleware, with **no code-level bound**. **FIX (2026-07-28):** new `ensure_settings_fresh()` (`user_settings.py:365`) — TTL-checked, non-raising — awaited at the three gated reads: `CanvasGateMiddleware.__call__` via `_ensure_flag_fresh` (canvas paths **and** `/openapi.json`, whose filter hook is sync and cannot refresh for itself), `require_canvas._dep` step (0), and `GET /features`. A blanket TTL check on `load_app_settings()` itself was **deliberately rejected** and the reasoning is recorded at the function: that reader is sync and could only DEGRADE to Pydantic defaults, so a merely-quiet worker would serve default models/ceilings for the whole app. **EVIDENCE:** 8 new tests, all 8 falsified against the pre-fix tree (`backend/tests/test_184_uat02_staleness_bound.py`) — the stale→fresh bound in both directions, the fail-safe, the three call sites, **and** `test_warm_cache_costs_no_db_read`, which guards the opposite over-correction so the fix cannot drift into a per-request query. Full-suite differential: failure set **byte-identical** to baseline (201 pre-existing, 0 new). | **CLOSED** |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---|---|---|---|---|
| AR-184-01 | T-184-01-02 | Icon slugs are static asset names in a frozen map — no user/org/tenant data, no authz decision. | plan-time register (184-01) | 2026-07-24 |
| AR-184-02 | T-184-01-SC · 02-SC · 03-SC · 05-SC · 06-SC · 07-SC · 08-SC · 09-SC · 10-SC · 11-SC · 12-SC · 13-SC | Twelve plans installed no dependency. Verified structurally: the manifests appear in exactly one commit in the whole range (`5ff18388`, plan 184-04). | plan-time registers | 2026-07-24 |
| AR-184-03 | T-184-06-04 | Route existence under a flag-off canvas is already covered by the shipped pre-auth 404 (`CanvasGateMiddleware`); 184 mounts no route and changes no auth decision (0-line backend API/middleware diff). | plan-time register (184-06) | 2026-07-24 |
| AR-184-04 | T-184-10-05 | Verdict marks are already-server-derived values threaded through node data on the same channel as the shipped ⌥ reveal. No new data class, no new fetch. | plan-time register (184-10) | 2026-07-24 |
| AR-184-05 | T-184-06-01 (residual) | The 422 `console.warn` survives into the production bundle. Data class is the user's own just-authored definition, same-origin, same-session; no stored rows and no cross-tenant identifiers can appear in it. Accepted as console noise, not disclosure. | **auditor — pending ratification** | 2026-07-28 |
| AR-184-06 | ~~T-184-UAT-02~~ | **WITHDRAWN — not accepted, FIXED.** The operator chose option 2 (bound it in code) over ratifying the window. No residual risk remains to accept; see the resolution below the Escalation. | operator, 2026-07-28 | 2026-07-28 |

---

## Observations (not threats, recorded for the next auditor)

- **O-1 — T-184-11-01 coverage caveat.** The R3 payload walk is genuine (real serialized
  bodies, working positive control), but the session it drives is a *panel field edit*
  (`click spine-node-research` → change instructions → save), despite the test's fixture
  string naming "a nudged, reordered, still-flat draft". It does **not** perform a canvas
  nudge or a drag-reorder before saving. The threat still closes, because the leak is
  excluded *structurally* upstream (the store holds no positional field — T-184-04-01 —
  and `canvasNudge.ts` cannot reach the API — T-184-07-02), so the walk is a third line of
  defence rather than the only one. Worth tightening if a future phase ever puts layout
  state into the store.
- **O-2 — `kind:"checking"` does not pre-block publish.** `blockedReason` returns `null`
  while the very first check is in flight (`WorkflowBuilderPage.tsx:941-943`). This is not
  a fail-open: the client `blockedReason` is a courtesy pre-block, and the server's 8-stage
  publish gauntlet remains the authority. `degraded` — the case the threat names — *does*
  block. Recorded so a later reader does not mistake it for a gap.
- **O-3 — `definitionOps.test.ts:426-431` has no positive control** on its
  `workflows/validate` / `fetch(` fence, unlike the equivalent fences in
  `StepTypePicker.test.tsx`, `canvasNudge.test.ts`, `builderStore.test.ts` and
  `verdictModel.test.ts`, which all carry one. The regexes are literal and the whole-suite
  0-call `fetch` spy is the belt, so T-184-02-03 still closes — but this is the one fence
  in the phase that could go vacuously green on a typo.
- **O-4 — the 184.1 header insert is registered, not unregistered.** Commits `0e9466de`,
  `12c557b3`, `90f07551`, `fec929d7`, `b42ad9bf` fall inside this diff range but belong to
  `.planning/phases/184.1-builder-header-consolidation/`, which carries its own 3-threat
  register (T-184.1-01..03). Its shared gate `useCanvasGate()`
  (`WorkflowBuilderPage.tsx:207-214`) is fail-closed and correct: `featuresCtx !== null &&
  !featuresCtx.loading && features.visual_workflow_canvas === true`. Audited separately.

---

## Unregistered flags

| Flag | Source | Mapping |
|---|---|---|
| `backend/app/models/user_settings.py` settings-cache re-warm | commit `1c94ffd4` (UAT wave) | **Was unregistered.** Now minted as `T-184-UAT-01` (closed) + `T-184-UAT-02` (open). |
| Operator kill-switch defect found in live UAT | commit `1c94ffd4` message | **Not recorded in `184-UAT-RESULTS.md`** — that file lists six defects and this is a seventh, the only one with a security consequence. Records gap. |

---

## Record corrections owed (documentation, not code)

1. **`184-VALIDATION.md:14`** asserts *"zero backend change, zero migration; the backend suite
   is not in this sampling loop."* The migration half is **true** (verified: 0-line
   `supabase/migrations` diff). The backend half is now **false** — `user_settings.py` changed
   and 4 backend tests were added. `184-SPEC.md:123` hedged correctly ("no backend change
   *unless discuss-phase surfaces a concrete blocker*"), and UAT surfaced one, so this is a
   stale assertion rather than a violated fence — but it must be corrected, along with the
   project note describing 184 as "ZERO backend / ZERO migration".
2. **`184-UAT-RESULTS.md`** should gain the kill-switch defect as a seventh row (root cause:
   sync settings reader never checks the cache timestamp; commit `1c94ffd4`).
3. **`184-05-SUMMARY.md`** — "the committed file contains zero definition rows" is superseded
   by `cb7d9244` (108 rows, redaction independently verified here). The owed corpus regen is
   **done**.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|---|---|---|---|---|
| 2026-07-28 | 72 (70 registered + 2 minted) | 71 | 1 (`T-184-UAT-02`) | gsd-security-auditor |
| 2026-07-28 (same day, post-fix) | 72 | **72** | **0** | orchestrator — operator chose "bound it in code" over ratifying `AR-184-06` |

---

## Escalation — operator decision required

**`T-184-UAT-02` — kill-switch enforcement latency on non-writing workers.**

The phase's entire flag-off revert gate (five registered threats: T-184-03-03, 04-03, 09-03,
11-06, 13-05) is client-side-correct and independently verified. But its *server-side*
enforcement reads a per-worker cache through a sync reader that performs no staleness check.
The UAT fix makes the **writing** worker correct immediately; on any other worker the pre-flip
audience persists with no code-level bound.

Severity assessed **MEDIUM**, not HIGH — so it does not trip the default `block_on: HIGH`:
the consequence is a *feature-visibility* surface staying reachable longer than the operator
intended, not an authn/authz bypass. A user who reaches the canvas in that window still faces
every per-user/org RLS control (v3.4), and the canvas authors only their own workflows.

Three options for the operator:

1. **Accept and document** — ratify `AR-184-06` with the practical ~30 s window, and fix the
   overstated `canvas_gate.py:72` docblock so it does not promise a TTL the sync path does not
   honour. *(Lowest cost; recommended if `WORKER_COUNT` stays at 2 and traffic is steady.)*
2. **Bound it in code** — give `load_app_settings()` the same TTL check the async reader has,
   or have `_feature_record` resolve through the async path. Small, local, removes the
   unbounded tail.
3. **Cross-worker invalidation** — publish settings writes on the existing Redis channel.
   Correct but out of proportion to a feature-visibility flag; belongs to a later phase.

Until one is chosen, `threats_open: 1`.

### RESOLVED — 2026-07-28, same day

**The operator chose option 2, "bound it in code."** Option 1 (accept + fix the docblock) was
declined, so `AR-184-06` is WITHDRAWN rather than ratified — there is no residual window to
accept. Option 3 (Redis cross-worker invalidation) remains out of proportion and unbuilt.

What shipped, and the two judgement calls worth recording:

1. **Not the obvious one-liner.** Putting the TTL check inside `load_app_settings()` — the
   literal reading of "give the sync reader the TTL check" — was rejected after reading the
   call graph. That reader is sync, so an expired cache could only degrade to
   `env_settings`/Pydantic defaults, and EVERY setting resolves through it. A worker that
   merely went quiet for 30 s would have served default models, token ceilings and extraction
   knobs for the whole app. Bounding a kill switch is worth a per-TTL query; reverting the
   platform's configuration to defaults is not. The reasoning is written at
   `ensure_settings_fresh` so the next person does not "simplify" it back.
2. **The bound is paid only where staleness has a consequence.** `_read_canvas_is_off` is
   documented as doing no per-request DB I/O (D-v2.5-01), and `build_canvas_aware_openapi`'s
   hook is SYNC and cannot await at all. So the refresh is awaited by the *callers* on gated
   paths — the canvas routes, `/openapi.json`, `require_canvas`, `/features` — and ordinary
   requests are untouched. `test_gated_paths_bound_the_flag` asserts both halves, so a future
   change cannot quietly put a query on the hot path or drop the bound.

Evidence: 8 tests, **all 8 red against the pre-fix tree**, including
`test_warm_cache_costs_no_db_read` (guards the over-correction) and the both-directions bound.
Full-suite differential: 201 failures at baseline, 201 at HEAD, **sets byte-identical** — zero
regressions across 3113 passing tests. Zero frontend change; `git diff -- supabase/migrations`
is **0 lines**, so the phase's slot-114-RESERVED fence still holds.

**One shipped test was edited, deliberately and narrowly.** `test_148_effective_features.py`
asserts the `_GOVERNED_FEATURES` cold-read polarity, which needs an EMPTY `feature_visibility`.
That held *by accident*: `/features` never read the DB, so the map was empty unless something
warmed it. Now that the endpoint reads the real row, the local DB's actual value (this box has
`visual_workflow_canvas: everyone`, left on from the 184 UAT) reached the assertion and turned
it red. **The assertions are unchanged**; a `_cold_defaults(monkeypatch)` helper now STATES the
precondition, using the same idiom `test_182_canvas_gate.py:72` already uses. This is a test
that was passing for the wrong reason, made honest — not an assertion relaxed to fit a fix.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Every registered `mitigate` threat verified against the named file/mechanism, not against the executor's attestation
- [x] Whole-diff HTML-sink sweep run independently of the per-file greps the summaries cite
- [x] Both scope fences (migrations · `grounding_mode`) verified against the repo
- [x] Uncovered backend change adjudicated and minted (`T-184-UAT-01`, `T-184-UAT-02`)
- [x] Accepted risks documented in the Accepted Risks Log
- [x] `threats_open: 0` confirmed — `T-184-UAT-02` FIXED (not accepted) and covered by 8 falsified tests
- [x] `status: verified` set in frontmatter
- [x] Post-fix regression differential run — failure set byte-identical to baseline (201/201, 0 new)

**Approval:** pending — operator decision on `T-184-UAT-02` + three record corrections.

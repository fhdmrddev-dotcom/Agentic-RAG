---
phase: 159
plan: 05
subsystem: frontend / model-registry operator surface
tags: [model-registry, curation, add-by-id, control-room, 070-A, source-labeled-defaults]
requires:
  - "159-04: api.ts addModelById(body) + AddModelBody type + ApiError; model-defaults.ts familyDefaults(idOrProvider)"
  - "149-07: the shipped 070-A ModelRegistryTab pure leaf + the ControlRoomPage model-registry shell (fetchRegistry + pulseRecording + write-then-refetch)"
provides:
  - "ModelRegistryTab: optional onAddModel prop + the '+ Add model by ID' form (070-A idiom) — 8-cloud provider select, 3 source-labeled capability knobs, direct-submit + in-header ✎ receipt + in-form 409/422 refusal, lands-disabled copy"
  - "ControlRoomPage: handleAddModel (addModelById → pulseRecording → fetchRegistry) wired to <ModelRegistryTab onAddModel=…> — server-is-source-of-truth re-fetch, errors propagate"
affects:
  - "SC#2 delivered end-to-end (an operator adds one model by id with capabilities + editable per-family defaults pre-filled, landing disabled)"
  - "159-06: the discovery filter/hand-fill reuses the same CapSourceTag three-source idiom + familyDefaults pre-fill"
  - "phase verify (/gsd:verify-work 159): live Chrome-MCP UAT — add kimi-k3/moonshot → confirm a DISABLED row → enable from the table"
tech-stack:
  added: []
  patterns:
    - "conditional-inclusion body build mirroring ModelDiscoveryPanel.coerce()+if(c!==undefined) — omit a cap when absent; OMIT native_tools on the tri-state 'unknown' (never a bare false)"
    - "three-way source badge extending SourceTag (OVR/DEF → amber 'default — confirm' / primary 'you set it' / blank)"
    - "write chokepoint mirroring ModelRow.write — busy → onAddModel → receipt/collapse or in-form ApiError refusal"
    - "derive-on-render pre-fill: familyDefaults(id||provider) drives untouched fields; a per-field touched flag flips value + source to operator-owned (no useEffect re-seed)"
key-files:
  created: []
  modified:
    - "frontend/src/components/admin/ModelRegistryTab.tsx"
    - "frontend/src/components/admin/__tests__/ModelRegistryTab.test.tsx"
    - "frontend/src/components/admin/ControlRoomPage.tsx"
decisions:
  - "onAddModel made OPTIONAL (plan text implied required) — keeps BOTH task commits atomically green: ControlRoomPage compiles before Task 2 wires the prop, and the shipped a11y/functional test render paths that pass no onAddModel stay byte-identical. The '+ Add model by ID' affordance renders ONLY when the shell provides the handler (always, in prod)."
  - "provider picker = a native <select> over the 8-cloud roster [openai,anthropic,google,deepseek,moonshot,zhipu,minimax,openrouter] + the SELECTED provider's @lobehub mark rendered beside it. A native <option> cannot embed an SVG (HTML limitation), so the icon convention is realized as a selection-synced logo adjacent to the keyboard-accessible select rather than one-logo-per-option."
  - "native_tools = a THREE-state <select> (unknown / native ✓ / none) mirroring ModelDiscoveryPanel.NewModelRow — NOT RowToggle (a strict boolean role=switch has no unset state and would silently submit false for an unmatched family). The body OMITS native_tools on 'unknown' → the row lands NULL → the server serves the inferred provider default (SC#3, never a hard false)."
  - "capability pre-fill is DERIVE-ON-RENDER: familyDefaults(model_id||provider) drives every untouched field each render (id wins over provider, so typing 'kimi-k3' resolves the Kimi family regardless of the picked provider); a per-field touched flag makes the operator's edit win + flips the badge to 'you set it'. No useEffect re-seed → no clobbering of operator edits."
  - "in-header ✎ receipt survives the form's post-add collapse (owned by AddModelSection, 3500ms), complementing the shell's band pulseRecording — mirrors the ModelRow local-receipt + shell-band dual confirmation."
  - "optional deprecation-note field: a non-empty note sets deprecated:true + deprecated_reason (mirrors DeprecatedControl's reason-implies-deprecated idiom); empty → both omitted."
  - "MODEL-03 NOT marked complete — phase-spanning STRETCH requirement; the discovery filter (SC#1) is plan 06; closes at /gsd:verify-work 159 (per the 148–156 false-green-avoidance convention)."
metrics:
  duration: "~30 min"
  tasks: 2
  files: 3
  commits: 2
  completed: "2026-07-18"
---

# Phase 159 Plan 05: + Add Model by ID Form + Shell Wiring Summary

**One-liner:** The operator-facing add-by-ID vertical — a "+ Add model by ID" form in `ModelRegistryTab` (the 070-A instrument-table idiom) that pre-fills the 3 capability knobs from `familyDefaults` with three source-honest labels (D-159-02 + D-159-03), plus the `ControlRoomPage` `handleAddModel` wiring that calls `addModelById` and re-fetches the registry so the new (disabled) row appears — delivering SC#2 end-to-end and generalizing the SEED-088 GPT-5.6 hand-add into a first-class UI path.

## What Was Built

Both tasks are pure-frontend, consuming the Plan-04 client contract (`addModelById`, `AddModelBody`, `familyDefaults`) and the shipped 070-A/149-07 surfaces. No backend, no migration, no new package.

### Task 1 — the "+ Add model by ID" form in ModelRegistryTab (commit `b32eb34d`)

`ModelRegistryTab.tsx` gained an OPTIONAL `onAddModel` prop and three new sub-components appended after `RowToggle` (the shipped provider-grouped table stays byte-identical — the section render, `groupByProvider`, `ModelRow`, `SourceTag`, `NumericCell`, `RowToggle`, `LockControl` are untouched; the affordance is wrapped above the table in a `<div>`):

- **`AddModelSection`** — the reveal button ("Add model by ID", `Plus` glyph) + the collapsible form + the post-add in-header ✎ receipt (survives the form's collapse for 3500ms).
- **`AddModelForm`** — model_id (mono text) + provider (native `<select>` over the 8-cloud roster, the selected provider's `@lobehub` mark beside it) + the 3 capability knobs: `context_window_tokens` / `max_output_tokens` (number inputs) and `native_tools` as a **tri-state `<select>`** (unknown / native ✓ / none) mirroring `ModelDiscoveryPanel.NewModelRow` + an optional deprecation note. Capabilities **derive-on-render** from `familyDefaults(model_id || provider)`; a per-field touched flag flips the value + source to operator-owned. The submit is a write chokepoint mirroring `ModelRow.write`: build the body by **conditional inclusion** (start `{model_id, provider}`; add a numeric cap only when finite; add `native_tools` ONLY on `native`→true / `none`→false; OMIT it on `unknown`), `await onAddModel(body)` → collapse + receipt, or render the server `ApiError.detail` in-form. `enabled` is never in the body (`AddModelBody` has no such field). Copy: "Added disabled — enable it from the table."
- **`CapSourceTag`** — extends the 2-state `SourceTag` (OVR/DEF) to three visually-distinct sources: amber "default — confirm" (untouched family suggestion), primary "you set it" (operator edited), or nothing (blank input when `familyDefaults` returned null). **`CapField`** — a small labeled control column.

`ModelRegistryTab.test.tsx` extended with **8 add-by-ID contract cases** (affordance-hidden-without-onAddModel, form fields + 8 roster options, moonshot pre-fill→amber→"you set it" on edit, openrouter blank + tools-rests-unknown, submit body {model_id, provider} + caps + NO enabled with native_tools=true, unknown-family OMITS native_tools, ApiError renders in-form, lands-disabled copy).

### Task 2 — ControlRoomPage handleAddModel wiring (commit `7397b842`)

`ControlRoomPage.tsx` imports `addModelById` + `AddModelBody` and adds `handleAddModel = useCallback(async (body) => { await addModelById(body); pulseRecording(); if (alive.current) void fetchRegistry() }, [fetchRegistry, pulseRecording])` — a verbatim mirror of `handleSetCapability`: the server is the source of truth (re-fetch, no optimistic add), and errors are **not** swallowed (they propagate so the form surfaces the 409/422 refusal). Passed as `onAddModel={handleAddModel}` to `<ModelRegistryTab>`; every other prop and the `<ModelDiscoveryPanel>` wiring (Plan 06's surface) are untouched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `onAddModel` made optional (plan text implied a required prop)**
- **Found during:** Task 1 design — the plan splits ModelRegistryTab (Task 1) and ControlRoomPage (Task 2) into two atomic commits.
- **Issue:** A required `onAddModel` would leave `ControlRoomPage.tsx` with a missing-prop type error between the Task 1 and Task 2 commits (broken intermediate build), and would force TS errors in the shipped `ModelRegistryTab.test.tsx` + `.a11y.test.tsx` render paths that pass no such prop.
- **Fix:** Declared `onAddModel?: …` optional; the `AddModelSection` renders only when it is provided (`{onAddModel && <AddModelSection …/>}`). Both task commits stay independently green; the shell always provides it in prod. The must_haves artifact/`contains: onAddModel` + the key_links are all satisfied.
- **Files:** `ModelRegistryTab.tsx` (commit `b32eb34d`).

**2. [Rule 3 - Blocking] Provider picker: native `<select>` + adjacent selected-logo (a native `<option>` cannot hold an SVG)**
- **Found during:** Task 1 — the plan says the provider `<select>` options are "each labeled with `providerLogo(provider)`".
- **Issue:** An HTML `<option>` renders text only — a React SVG component cannot be embedded inside it. "A logo per option" is not implementable with a native `<select>` (which the plan explicitly and repeatedly specifies for keyboard-a11y, mirroring `ModelDiscoveryPanel`/`ProviderKeyStep`).
- **Fix:** Kept the keyboard-accessible native `<select>` (the 8 roster options, testable as a `combobox` with 8 `option`s) and rendered the **selected** provider's `@lobehub` mark immediately beside it (selection-synced). The icon convention is honored for the picker; the mark tracks the chosen provider rather than appearing per-option.
- **Files:** `ModelRegistryTab.tsx` (commit `b32eb34d`).

**3. [Rule 3 - Path correction] Test files live under `__tests__/`**
- The plan's `<verify>` commands reference `src/components/admin/ModelRegistryTab.test.tsx` / `ControlRoomPage.test.tsx`, but the shipped suites live under `src/components/admin/__tests__/`. Ran the correct paths. No code impact.

**4. [Note - not a deviation] ControlRoomPage.test.tsx passes UNMODIFIED**
- The suite's factory `vi.mock("@/lib/api", …)` is deliberately minimal (only the functions the shell calls on the rendered/tab-open paths). `addModelById` is only invoked on add-submit (never on the tested paths), so the test passes without touching its mock. Left unmodified (Task 2's `<files>` is `ControlRoomPage.tsx` only).

## Verification Results

- `cd frontend && npx vitest run src/components/admin/__tests__/ModelRegistryTab.test.tsx src/components/admin/__tests__/ModelRegistryTab.a11y.test.tsx src/components/admin/__tests__/ControlRoomPage.test.tsx` — **43/43 passed** (35 baseline + 8 new add-by-ID cases; a11y unchanged since the affordance is absent without `onAddModel`).
- `cd frontend && npx tsc -b --force` — **29 errors, 0 net-new** (identical file:line fingerprint before/after; ZERO errors reference `ModelRegistryTab.tsx`, `ControlRoomPage.tsx`, or `model-defaults.ts`). The 29 are pre-existing SEED-056/frontend-vitest-rot in unrelated files.
- `cd frontend && npx vite build` — **exit 0** (the app bundles with the changes; `npm run build` = `tsc -b && vite build` fails only at the pre-existing SEED-056 `tsc -b` step, not from this plan — proven by the identical error fingerprint; the project deploys via `vite build`).
- `grep -c "dangerouslySetInnerHTML" frontend/src/components/admin/ModelRegistryTab.tsx` — **0**.
- `grep -c "onAddModel\|handleAddModel" frontend/src/components/admin/ControlRoomPage.tsx` — **2** (the `handleAddModel` definition + the `onAddModel={handleAddModel}` wiring).

### Acceptance criteria (all met)
- Opening "+ Add model by ID" shows `model_id` + a `provider` `<select>` with 8 roster options + the 3 capability inputs. ✓
- Selecting moonshot (or typing "kimi-k3") pre-fills context/maxOutput/tools from `familyDefaults` as amber "default — confirm"; editing a field flips its label to "you set it"; openrouter (null family) shows a blank numeric input + `native_tools` resting on `unknown` (never a defaulted false). ✓
- Submitting calls `onAddModel` once with `{model_id, provider}` + supplied numeric caps and NO `enabled` key; `native_tools` included only on `native`(true)/`none`(false), OMITTED on `unknown`. ✓
- An unknown-family add with `native_tools` left `unknown` → the body carries no `native_tools` key (→ NULL row → the served capability falls through to the inferred provider default; SC#3). ✓
- A rejected submit (`ApiError`) renders the server `detail` in-form; no crash, no silent success. ✓
- Form copy states the model is added disabled and enabled from the table. ✓
- ControlRoomPage imports `addModelById`, defines `handleAddModel` (addModelById → pulseRecording → fetchRegistry), does NOT swallow the error, and passes `onAddModel={handleAddModel}` with all existing props intact. ✓

## Known Stubs

None. A blank capability input is the documented D-159-03 / SC#3 contract (an operator-filled field when `familyDefaults` returns null), not an unwired placeholder. The form is fully wired: `onAddModel` → `addModelById` → `POST /admin/models` → registry re-fetch. No hardcoded empty values flow to UI rendering.

## Threat Flags

None new. The form is a client caller only — no new network endpoint, auth path, or trust boundary is introduced. The threat_model's mitigations are honored client-side: the client adds NO authority (the Plan-02 `require_operator` 404 + roster/type/duplicate validation + parameterized upsert is the real wall — T-159-08); the body NEVER carries `enabled` and OMITS `native_tools` on `unknown` (T-159-09); success pulses the shell ✎ ledger receipt and an `ApiError` renders the server detail in-form, never a silent fail (T-159-10). No package installs (T-159-SC).

## Self-Check: PASSED

- FOUND: `frontend/src/components/admin/ModelRegistryTab.tsx` (modified)
- FOUND: `frontend/src/components/admin/__tests__/ModelRegistryTab.test.tsx` (modified)
- FOUND: `frontend/src/components/admin/ControlRoomPage.tsx` (modified)
- FOUND commit: `b32eb34d` (feat(159-05): + Add model by ID form in ModelRegistryTab)
- FOUND commit: `7397b842` (feat(159-05): wire handleAddModel in ControlRoomPage)

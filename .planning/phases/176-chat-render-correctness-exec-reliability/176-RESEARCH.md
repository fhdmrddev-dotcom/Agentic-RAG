# Phase 176: Chat Render Correctness + Exec Reliability - Research

**Researched:** 2026-07-22
**Domain:** Frontend chat-render reconcile logic (React/Zustand `StreamsProvider`) + one backend sandbox-install seam (`llm_sandbox` 0.3.37 / `tool_dispatcher`)
**Confidence:** HIGH (all cited seams re-scouted against current code; EXEC-01 root cause read from the actual installed `llm_sandbox` source, not theorized)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01..D-16 — do NOT re-open)
- **D-01 (EXEC-01 root):** Root mechanism is a *swallowed* install failure, not a skipped install. `session.install(libraries=...)` IS called (`tool_dispatcher.py`), but the `except Exception` only logs and runs the user code anyway. Researcher probes WHY `session.install` sometimes returns/no-ops fast on a warm session.
- **D-02 (EXEC-01 scope):** Two failure modes fixed — (1) declared `libraries` install deterministically, retry once on failure, never silently swallow; (2) undeclared imports → on `ModuleNotFoundError`, auto-install the named module + re-run the code once.
- **D-03 (EXEC-01 contract):** On persistent failure return an honest tool result ("Could not install X: `<reason>`"), bounded to **1 heal cycle per module**. No silent swallow anywhere.
- **D-04 (EXEC-01 red line):** Entirely in tool dispatcher / sandbox service, below the provider adapter — provider-uniform, no `provider ==` fork, cannot touch the shared Deep/agent-loop path. Preinstalled-set awareness is a nice-to-have signal, not required.
- **D-05 (RENDER-01):** No-migration reconcile-identity fix — researcher picks the cleaner of (a) re-key the optimistic user temp to the persisted user-row id, or (b) drop an untyped user temp when the snapshot already holds an identical-content user row newer than the temp's `created_at`. Durable `client_msg_id` + column was REJECTED as over-scoped.
- **D-06 (RENDER-01):** The 075.7 blank-thread preserve-guard is load-bearing — dedup *against the snapshot*, NEVER "stop preserving temps". Mirror the assistant-side dedup precedents (BUG-260609-03 / BUG-260626-01) on the user side.
- **D-07 (RENDER-02):** Keep the applied 2026-07-07 send-path `onTerminal` content-reconcile; EXTEND the same reconcile to the mount/reconcile-path terminal (the SC#10 parallel-thread case).
- **D-08 (RENDER-02):** Live verification is part of acceptance — one live Deep run resolving un-folded at run-end with no reload.
- **D-09 (RENDER-02):** SEED-094 (backend stray-last-line emit) is OUT of scope.
- **D-10 (RENDER-03):** Race-fix + honesty guarantee, honesty load-bearing — (1) tighten fresh-thread ordering; (2) don't clear/lose the composer draft until dispatch is confirmed, restore text + quiet "couldn't send — retry" hint on any non-dispatch.
- **D-11 (RENDER-03):** Route through the existing per-thread `failedSendDrafts` / `reconcileErrors` recovery seam. Root of invisibility: `MessageInput` clears text synchronously before dispatch is confirmed. Verify-and-close-only was REJECTED.
- **D-12 (RENDER-04):** In `handleApproveDescription`, after `approveDescriptionProposal(...)` + `loadSkills()`, ALSO invalidate/refetch the `skill_versions` query that drives the Studio header `vN` + Versions-tab LIVE badge. No migration, no realtime.
- **D-13 (G-2):** NO fresh sketch — reconcile-logic honesty; visual target already defined by the 2026-07-07 fix + sketch 014 + existing `StreamingNarration`.
- **D-14 (G-5 + red line):** Additive reconcile fixes at existing seams; Deep Mode byte-identical; no shared-path fork. Re-run render/replay tests; do not regress the shared render path.
- **D-15 (SC#10):** 4-axis live UAT mandatory (cross-provider × multi-tool × parallel-thread × long-message), authored under VALIDATION.md, NOT PLAN tasks.
- **D-16 (no migration):** Every fix is app-layer. Flag explicitly if RENDER-01/04 truly needs schema (not expected).

### Claude's Discretion
- RENDER-01 mechanism (D-05 a vs b) — **resolved below → option (b), content-supersede drop in the preserve-guard.**
- EXEC-01 fix shape within D-01/D-02/D-03 — **resolved below.**
- RENDER-04 refetch mechanism within D-12 — **resolved below.**

### Deferred Ideas (OUT OF SCOPE)
- SEED-094 backend stray-last-line final-answer emit (RENDER-02 residual #3).
- SEED-043 full half-b remainder (managed-set UI, cross-provider install matrix, permanent `libraries` reshaping).
- BUG-260609-02 / BUG-260609-04 (panel-side run-honesty) → routed to STRETCH Phase 178.
- RENDER-01 durable `client_msg_id` + column (re-open only if the no-migration reconcile proves flaky under UAT).
- RENDER-02 verify-only option.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RENDER-01 | No duplicate user bubble (optimistic temp + persisted row reconcile to one) | Preserve-guard content-supersede drop at `StreamsProvider.tsx:1441-1468` (mechanism resolved → §Delegated Unknown 2) |
| RENDER-02 | Final answer renders un-folded at a clean terminal, no reload | Extend the applied send-path content-reconcile (`:2004-2027`) to the mount-path `onTerminal` (`:1631-1648`); render switch at `MessageItem.tsx:496-510` |
| RENDER-03 | No silent send-drop — always sends or surfaces honest failure | Draft-hold at `MessageInput.tsx:137-150`; route non-dispatch through `failedSendDrafts`/`reconcileErrors` (`StreamsProvider.tsx:2111-2117`, surfaced `ChatArea.tsx:365`); fresh-thread ordering `ChatArea.tsx:301-325` |
| RENDER-04 | Approved version pointer updates without reload | Refetch `listSkillVersions` in `SkillStudioPage.tsx` (shell `versions` state `:85`) + VersionsTab internal fetch (`VersionsTab.tsx:138-166`), threaded from `handleApproveDescription` (`SkillTunerPage.tsx:531-547`) |
| EXEC-01 | `execute_code` `libraries` installs reliably | Root cause read from `llm_sandbox` source (§Delegated Unknown 1); fix shape §Delegated Unknown 1+3; hook at `tool_dispatcher.py:1793` after `exec_result` |
</phase_requirements>

## Summary

This is a bug-fix + honesty phase. Four of the five fixes are surgical edits at existing, well-commented reconcile seams in `StreamsProvider.tsx` / `MessageInput.tsx` / `SkillStudioPage.tsx`; the fifth (EXEC-01) is a backend install-path fix in `tool_dispatcher.py` that stays entirely below the provider boundary. No new packages, no migration, no shared-path fork.

The single highest-value finding is the **EXEC-01 root cause**, which I read directly from the installed `llm_sandbox` 0.3.37 source rather than theorizing. There are **three compounding, verified defects**, not one: (1) `session.install()` never raises on a pip failure — it discards the failed exit code internally, so the `except Exception` at `tool_dispatcher.py:1653` is dead code for the actual failure mode; (2) `session.install()` installs into `llm_sandbox`'s **venv** (`/sandbox/venv/bin/pip`), but our code run executes the bare string `python -u <file>` which is the **system** interpreter — a venv-installed package is invisible to `python -u` (the venv is `--system-site-packages`, one-directional), so a declared library can install "successfully" and still `ModuleNotFound`; (3) the code-run exit code is always `0` because streaming mode makes docker return `exit_code=None`, and the compensating error-marker scan only reads **stdout** while `ModuleNotFoundError` goes to **stderr** — so the run reports `completed` with a raw traceback and zero honest signal. This trio fully explains "declared libraries install unreliably, model sees a raw ModuleNotFoundError."

**Primary recommendation:** For EXEC-01, stop relying on `session.install` for declared libraries — install with **system pip in the same interpreter the code runs under** (`session.execute_command("python -m pip install …")`, non-streaming → reliable exit code), retry once, then hook a bounded (1-per-module) `ModuleNotFoundError` auto-heal + honest tool result right after `exec_result` is available (`tool_dispatcher.py:1793`). For RENDER-01, use D-05 **option (b)** — a content-supersede drop inside the existing untyped-temp preserve branch — because the WR-04 id re-key already exists yet the dup still persists. RENDER-02/03/04 extend patterns that already exist in the file.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Dedup user bubble (RENDER-01) | Frontend store (StreamsProvider reconcile) | — | Duplicate is a client merge artifact; DB persists exactly one row. Pure render-layer. |
| Un-fold final answer (RENDER-02) | Frontend store (onTerminal content-reconcile) | Backend (persisted clean answer is the source of truth) | Backend already persists the clean answer; the fold is a live-render artifact. |
| Honest send outcome (RENDER-03) | Frontend composer + store recovery seam | — | Invisibility is a synchronous client text-clear; dispatch race is client ordering. |
| Live version pointer (RENDER-04) | Frontend page state (SkillStudioPage) | Backend (DB already correct) | DB was correct throughout (BUG-260706-01); pure frontend refetch. |
| Reliable library install (EXEC-01) | Backend tool dispatcher (below provider boundary) | Sandbox service / `llm_sandbox` | Install + auto-heal must be provider-uniform and cannot touch the agent loop. |

## Standard Stack

No new libraries. This phase edits code that already ships. The only external dependency touched is the already-installed sandbox runtime.

### Core (already installed — versions verified in venv)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `llm_sandbox` | 0.3.37 | Docker-backed sandbox session (`InteractiveSandboxSession`) that `execute_code` runs in | Already the project's sandbox runtime (`sandbox_service.py`) |
| `zustand` (via existing store) | (existing) | Chat message buckets / reconcile state | Already the chat store |
| `vitest` | ^4.1.0 | Frontend unit/render tests | Project standard (`frontend/package.json`) |
| `pytest` | (existing) | Backend unit/integration tests | Project standard (`backend/pytest.ini`) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| System `python -m pip install` for declared libs | Keep `session.install` (venv pip) | REJECTED — venv install is invisible to the `python -u` code run (root cause below). Installing into the run interpreter is the fix, not an alternative. |
| Content-supersede drop (RENDER-01 D-05b) | Durable `client_msg_id` column (D-05a-durable) | Explicitly rejected in CONTEXT.md as over-scoped for a minor bug in a no-migration milestone. |

**Installation:** None. (`llm_sandbox==0.3.37` already present at `backend/venv/Lib/site-packages/llm_sandbox`.)

## Package Legitimacy Audit

**No external packages are installed by this phase.** All fixes edit existing source. The sandbox runtime `llm_sandbox==0.3.37` is already installed and unchanged.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (none — no new packages) | — | — | — | — | — | N/A |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

> Note: EXEC-01's auto-heal installs a **model-named** package from PyPI at runtime (bounded 1-per-module). This is not a build-time dependency and not new behavior — the model can already `pip install` inside its own code today, and declared `libraries` already install model-named packages. See §Security Domain for the (unchanged) trust posture.

---

# Delegated Unknowns — Resolved (primary deliverable)

## Delegated Unknown 1 — EXEC-01 root cause (D-01, highest value)

I read the actual installed `llm_sandbox` 0.3.37 source. There are **three compounding, verified defects**. Together they fully explain "declared `libraries` install unreliably and the model sees a raw `ModuleNotFoundError` with no signal."

### Defect A — `session.install` silently swallows pip failures (never raises)
`[VERIFIED: llm_sandbox 0.3.37 source]`

- `BaseSession.install()` (`core/session_base.py:240-295`) builds a `pip install …` command and calls `self.execute_commands([...])` — **and discards the return value** (line 295 is the last statement; the returned `ConsoleOutput` is ignored).
- `execute_commands()` (`core/session_base.py:325-342`) returns the failed command's `ConsoleOutput` on a non-zero exit (`if output.exit_code: return output`, line 339) — it **does not raise**.
- Net: a failed `pip install` (bad name, no wheel, network blip, non-zero exit) makes `install()` **return `None` silently**. The only things that CAN raise out of `install()` are `LibraryInstallationNotSupportedError`, `SecurityViolationError`, or a docker-connection error.
- Therefore the `try/except Exception` at `tool_dispatcher.py:1651-1657` is **dead code for the real failure mode** — it never sees a pip failure. D-01's "swallow" is inside `llm_sandbox` itself, one level below our `except`.

### Defect B — install targets the venv; the code run uses the system interpreter (the intermittency driver)
`[VERIFIED: llm_sandbox 0.3.37 source]`

- `install()` builds a `RuntimeContext` whose `pip_executable_path` = `self.pip_executable_path` = `f"{workdir}/venv/bin/pip"` (`session_base.py:284-286, 350-352`), and `PythonHandler.get_library_installation_command` uses that venv pip when present (`language_handlers/python_handler.py:63-66`). So `session.install(["fpdf2"])` runs **`/sandbox/venv/bin/pip install fpdf2`** — installing into the **venv** site-packages.
- On session open, `environment_setup()` (`session_base.py:359-437`, called from `docker.py:393`) creates that venv with **`python -m venv --system-site-packages`** (line 414). `--system-site-packages` is **one-directional**: the venv can see system packages, but the system interpreter **cannot** see venv-only packages. (For a re-attached warm container, `environment_setup` early-returns at `session_base.py:378`; the venv persists from the original open.)
- Our code run is `tool_dispatcher.py:1662`: `session.execute_command(f"python -u {code_file}", …)` — the bare string `python` = the **system** interpreter (`/usr/local/bin/python`), NOT the venv python.
- **Consequence:** a library installed via `session.install` lands in the venv and is **invisible** to `python -u`. Preinstalled packages (reportlab/pandas/matplotlib/… baked into the *system* python by `Dockerfile.sandbox`) ARE visible to `python -u` and work fine — which is exactly why preinstalled libs work but declared `libraries` are unreliable.
- This makes the 68 ms-vs-6607 ms evidence (BUG-260708-02) coherent: the venv/system split means a declared install is unreliable *by construction*; the specific 6607 ms success ([23]) is a real install that happened to land somewhere visible (most plausibly a system-pip install triggered by the model's own in-code fallback, or a differently-structured retry). The fix below makes this moot — install into the interpreter the code actually runs under.

### Defect C — the code-run exit code is always 0, and the error scan misses stderr
`[VERIFIED: llm_sandbox + tool_dispatcher source]`

- The code run passes `on_stdout`/`on_stderr` callbacks → `effective_stream=True` (`core/mixins.py:306`). In streaming mode `DockerContainerAPI.execute_command` returns `result.exit_code or 0` where docker-py's `exec_run(stream=True)` yields `exit_code=None` → **always `0`** (`docker.py:59-60`).
- `tool_dispatcher.py:1798-1817` already knows this is unreliable and compensates by scanning for error markers — but it scans **`stdout` only** (`stdout_text = exec_result.stdout`, line 1800). A `ModuleNotFoundError` from `python -u <file>` is written to **stderr**, so the scan misses it → `actual_exit_code` stays 0 → status `"completed"`. The model still sees the traceback because stderr is passed through in the tool result (`"stderr": exec_result.stderr`, line 1866) — i.e. a raw `ModuleNotFoundError` with a "completed" status and no honest failure signal. This is the D-01 symptom.

### Fix shape (satisfies D-01/D-02/D-03/D-04)
1. **Declared install hardening (D-01/D-02.1):** Replace `session.install(libraries=libraries)` (`tool_dispatcher.py:1652`) with an explicit, exit-code-checked, same-interpreter install:
   - Run `session.execute_command("python -m pip install --disable-pip-version-check <lib> …")` **without** stream callbacks → non-streaming → **reliable exit code** (`ConsoleOutput.exit_code`) + captured stderr.
   - Using `python -m pip` (system interpreter) guarantees the package is visible to the `python -u` code run (fixes Defect B).
   - On non-zero exit, **retry once**; on persistent failure, do NOT swallow — carry the pip stderr into the honest tool result (D-03).
2. **ModuleNotFound auto-heal (D-02.2) + honest result (D-03):** see Delegated Unknown 3 for the exact hook + module extraction + 1-per-module bound + message shape.
3. **Provider-uniform (D-04):** all edits are inside `_handle_execute_code` / a helper; no `provider ==` branch; the shared Deep/agent-loop path is untouched. Preinstalled-peer hint (from `docs/SANDBOX-PACKAGES.md`) is optional flavor on the honest message.

> Note the same-interpreter install ALSO closes the `render_template` sibling behavior — `_handle_render_template` already returns an honest "sandbox_image_stale" message on `ModuleNotFoundError` (`tool_dispatcher.py:3119-3130`), a good tone precedent for D-03.

## Delegated Unknown 2 — RENDER-01 mechanism pick (D-05) → **option (b)**

`[VERIFIED: codebase read]`

**Decision: D-05 option (b)** — drop the untyped user temp inside the existing preserve-guard when the snapshot already holds an identical-content persisted user row. Reason option (a) is insufficient: the WR-04 id re-key **already exists** at `StreamsProvider.tsx:1856-1858` (`if (m.id === userMsg.id) return { ...m, id: message_id }`), yet the dup still persists "for the life of the view." The dup is created by the reconcile merge, not by a missing re-key, so the fix belongs in the merge.

**Where the dup is born** (`StreamsProvider.tsx:1434-1468`, the 075.7-widened preserve-guard):
- The optimistic user temp is inserted at `:1757-1769` (`id: makeTempId()`, `role: "user"`, no `runId`).
- A concurrent reconcile (`getSnapshot` from `setViewingThread` / Realtime nudge / watchdog) lands while the send is in flight. The merge is `return [...snapshot.messages, ...liveTempPlaceholders]` (`:1468`). `snapshot.messages` already contains the **persisted** user row (server wrote it), and the untyped temp falls through to `return sendInFlightOnThisThread` (`:1466`) = `true` → **preserved** → two user bubbles. There is no content-level dedup for user temps (the assistant-side `!dbRunIds.has(m.runId)` drop at `:1443-1465` can't apply — user temps carry no `runId`).

**The fix (mirror the assistant precedent on the user side):** in the untyped-temp branch (`:1466`), before preserving, check the snapshot for an identical-content persisted user row and drop the temp if present:

```ts
// user temp (no runId): preserve only while a send is in flight on this thread
// AND the snapshot does not YET hold its persisted twin. Mirrors the assistant-side
// !dbRunIds.has(runId) drop (BUG-260609-03/-01) — user temps match on content, not runId.
if (!sendInFlightOnThisThread) return false
const supersededByPersisted = snapshot.messages.some(
  (s) =>
    s.role === "user" &&
    s.content === m.content &&
    !s.id.startsWith("temp-") &&
    new Date(s.created_at) >= new Date(m.created_at), // "newer than the temp" (D-05b)
)
return !supersededByPersisted
```

**Why this honors D-06:** it still preserves the temp whenever the snapshot does NOT yet hold the persisted twin — the exact pre-stamp race the 075.7 guard protects. It only drops the temp once the DB twin exists ("dedup against the snapshot, never stop preserving temps"). It does not touch the assistant-side branches or the `dedupMessagesByRunId` helper (`lib/dedupMessages.ts`, which is runId/assistant-oriented and should stay so).

## Delegated Unknown 3 — EXEC-01 auto-heal hook point (D-02/D-03)

`[VERIFIED: codebase read]`

**Hook point:** after the drain loop completes and `exec_result = await fut` is available (`tool_dispatcher.py:1793`), and after `actual_exit_code` is derived (`:1798-1817`), **before** the tool-result JSON is built (`:1859`). This sits naturally alongside the existing post-hoc `_classify_runtime_gap` block (`:1891-1900`).

**Module-name extraction — reuse the existing regex.** `_NO_MODULE_RE = re.compile(r"no module named ['\"]?([\w\.\-]+)")` already exists at `tool_dispatcher.py:2654`. Run it over `exec_result.stderr` (and stdout, lowercased, mirroring `_classify_runtime_gap`'s `out_l` at `:2721`). Note: `_classify_runtime_gap` **deliberately passes through** an unknown `No module named 'X'` (returns `None` unless `X ∈ KNOWN_MISSING_MODULES`, `:2744-2748`) — precisely so EXEC-01 can install+retry `X`.

**The 1-cycle-per-module bound (D-03):** mirror the existing run-scoped repeat-guard `ctx.dead_gap_tokens_in_run` (a set threaded on `ToolContext`, guarded `is not None` so unwired Deep/eval callers no-op — `:1491`, `:1898`). Add a sibling `ctx.healed_modules_in_run: set[str] | None`. Before healing module `X`: if `X in ctx.healed_modules_in_run`, do NOT heal again → go straight to the honest result. Otherwise `add(X)`, install, re-run once. This guarantees "no loops, no wasted retry rounds" and keeps Deep byte-identical (guarded on `is not None`).

**Auto-heal sequence:**
1. Detect `ModuleNotFoundError` in `exec_result.stderr` → extract `X` via `_NO_MODULE_RE`.
2. If `X` is a KNOWN_MISSING permanent gap (already classified) or already in `healed_modules_in_run` → skip heal, emit honest result.
3. Else `session.execute_command("python -m pip install --disable-pip-version-check X")` (non-stream → reliable exit code + stderr).
4. If install exit != 0 → honest result "Could not install X: `<pip stderr, truncated>`" (+ optional preinstalled-peer hint).
5. If install ok → re-run the code once (a second `_run_sync`-style exec or a lighter blocking `session.execute_command("python -u <same file>")`; the file is still in the container at `code_file`). If it still `ModuleNotFound`s → honest result.

**Honest message shape (D-03):** put it on the **model-facing `llm_content`** (mirroring the `_llm_payload["runtime_gap"]` pattern at `:1896-1900`), so the persisted/UI copy stays a normal error while the model gets the actionable framing:
```json
{ "status": "error", "install_failed": { "module": "X",
  "reason": "<pip stderr, truncated ~300 chars>",
  "hint": "Could not install X. Use a preinstalled library (reportlab, pandas, matplotlib, python-docx, python-pptx, openpyxl, docxtpl, numpy, scipy, seaborn, plotly, pypdf) or tell the user this package is unavailable. Do not retry the same install." } }
```
The preinstalled set is single-sourced in `docs/SANDBOX-PACKAGES.md` / `Dockerfile.sandbox`.

---

# Per-Requirement Implementation Guidance (current file:line)

## RENDER-01 — dedup user bubble
- Optimistic user temp: `StreamsProvider.tsx:1757-1769`.
- WR-04 id re-key (already present): `:1856-1858`.
- Preserve-guard merge (075.7-widened): `:1434-1468`; the assistant-side dedup precedents to mirror: `:1443-1465` (BUG-260609-03 / BUG-260626-01 comments). **Edit point: `:1466`** (the untyped-temp `return sendInFlightOnThisThread`).
- `dedupMessagesByRunId` helper (do NOT overload for user rows): `lib/dedupMessages.ts:64-97`.
- `postMessage` return shape (`{ message_id, run_id, model, provider }`): `api.ts:298-300` (destructured at `StreamsProvider.tsx:1807-1812`).
- **Mechanism:** option (b), §Delegated Unknown 2.

## RENDER-02 — un-fold final answer
- Applied 2026-07-07 send-path content-reconcile (KEEP, do not rebuild): `StreamsProvider.tsx:2004-2027` (fire-and-forget `getMessages(threadId)` → find `m.runId === registeredRunId && role==="assistant"` → swap only that bucket message's `content`).
- The `:358` append invariant (why `message.content` is the accumulated blob): referenced at `:1989-1991`; the `onDelta` append is at `makeStreamCallbacks` (`:396` / `:456-457`).
- **D-07 extension target — the mount/reconcile-path `onTerminal`:** `:1571-1648`. It sets `runStatus` (`:1631-1642`) and cleans subscriptions (`:1645-1648`) but has **no** content-reconcile. **Add the same `getMessages → swap content by runId` block after `:1648`, keyed on `run.run_id`** (this path's runId) instead of `registeredRunId`. This resolves a backgrounded parallel-thread run un-folded on switch-back with no reload (the SC#10 parallel-thread case).
- Render switch (`isMessageStreaming → StreamingNarration vs MarkdownRenderer`): `MessageItem.tsx:397` (`isMessageStreaming = message.runStatus === "streaming"`), the fold at `:496-502` (`StreamingNarration` while streaming + tools), the clean render at `:510` (`MarkdownRenderer`). The reconcile only needs to swap `content`; the switch already flips to `MarkdownRenderer` at terminal — no `MessageItem` edit required.
- `getMessages` returns `runId` (`api.ts:197`, `_mapRow`), `role`, `content` — the reconcile predicate holds.
- SEED-094 (backend stray last-line) is OUT (D-09) — the reconcile faithfully shows whatever the backend persisted.

## RENDER-03 — no silent send-drop
- Root of invisibility (synchronous clear): `MessageInput.tsx:137-150` — `handleSend` fires `onSend(trimmed)` (`:143`, not awaited), then `setValue("")` (`:144`) + `composerDraftsByThread.delete(draftKey)` (`:146`) synchronously.
- Fresh-thread send ordering: `ChatArea.tsx:301-325` — `await onCreateThread` (`:304`) → `setViewingThread(activeThread.id)` (`:315`, fires the reconcile) → `await sendMessage(...)` (`:317`). The per-thread guard `sendingThreadsRef.current.add(threadId)` is set INSIDE `sendMessage` at `StreamsProvider.tsx:1754` — i.e. AFTER `setViewingThread`'s reconcile has already fired. **Mechanism-#2 tighten (D-10.1):** mark the thread as sending BEFORE `setViewingThread` (e.g. expose a pre-mark, or move the guard-add ahead of the reconcile-triggering nav) so the reconcile's preserve-guard (`:1440`) sees the in-flight flag.
- **Existing recovery seam (D-11) — reuse, don't reinvent:** `failedSendDrafts` (Map threadId→content) + `reconcileErrors` (Map threadId→Error) are set on `ApiError` at `StreamsProvider.tsx:2114-2117`; surfaced by `ChatArea.tsx:365` as `prefillMessage={failedDraft ?? prefillMessage}` → restored via `MessageInput.tsx:124-129` prefill effect; the banner reads `reconcileErrors` (`ChatArea.tsx:102-132`, tests in `ChatAreaBanner.test.tsx`). **The gap:** the SILENT-drop paths (the per-thread guard early-return at `:1753`, and a mechanism-#2 race that drops before any POST) do NOT set `failedSendDrafts`. **D-11 fix:** on those non-dispatch paths, set `failedSendDrafts[threadId]=content` + a quiet `reconcileErrors` hint ("Couldn't send — tap to retry"), which the existing prefill + banner seam then restores.
- **Honesty guarantee (D-10.2, load-bearing):** the durable property is "the draft is never lost silently." Because `MessageInput` clears at `:144` before dispatch is confirmed, the robust shape is: keep the draft until dispatch is confirmed. Two viable routes (planner's call): (i) have the non-dispatch paths populate `failedSendDrafts` so the existing prefill restores the text (minimal, reuses the seam per D-11); or (ii) make `MessageInput.handleSend` await `onSend` (ChatArea's `handleSend` is already async) and clear only on confirmed dispatch — but note `sendMessage`'s guard early-return at `:1753` resolves without throwing, so route (ii) also needs `sendMessage` to SIGNAL the drop (return/throw). Route (i) is the smaller, D-11-aligned change.

## RENDER-04 — live version pointer
- `handleApproveDescription`: `SkillTunerPage.tsx:531-547` — calls `approveDescriptionProposal` (`:535`) then `loadSkills()` (WR-05, `:541`).
- `loadSkills` reconciles the shared `useSkills()` skills list — so `SkillStudioPage`'s `skill` (`SkillStudioPage.tsx:58-62`, read from `useSkills`) DOES reconcile. What does NOT reconcile: the shell's `versions` state.
- **Version pointer source:** `SkillStudioPage.tsx:127` `liveVersionNumber = deriveLiveVersion(skill, versions)` drives BOTH the header `vN` (`:147`) and the VersionsTab prop (`:207`). `versions` is fetched ONCE per skillId via `listSkillVersions(skillId)` at `:85` (effect keyed `[skillId]`, `:71-94`). After approve, the new v8 row is absent from `versions`, so `deriveLiveVersion` falls back to the MAX version_number in the STALE list = v7 (fallback confirmed: `SkillStudioPage.test.tsx:152`).
- **VersionsTab** has its OWN internal fetch keyed `[skillId]` (`VersionsTab.tsx:138-166`), so the Versions-table row list is ALSO stale; `isLive = v.version_number === liveVersionNumber` (`:213`).
- **The tuner is embedded in the Triggering tab:** `TriggeringTab.tsx:23` renders `<SkillTunerPage … embedded />` (a thin wrapper).
- **D-12 fix (mirror the existing `refreshGate` pattern at `SkillStudioPage.tsx:98-106`):**
  1. Extract a `refreshVersions` useCallback in `SkillStudioPage` that re-runs `listSkillVersions(skillId)` and `setVersions(...)` (skill-switch-guarded like `refreshGate`).
  2. Thread it down as an optional callback: `SkillStudioPage → TriggeringTab → SkillTunerPage` (e.g. `onVersionPromoted`). Call it inside `handleApproveDescription` after `approveDescriptionProposal` succeeds (alongside `loadSkills()`).
  3. Make VersionsTab re-fetch too — pass a `refreshNonce` prop bumped by the same callback and add it to the effect deps at `VersionsTab.tsx:166` (`[skillId, refreshNonce]`), OR lift the versions list to the shell and pass it down (heavier). The nonce-bump is the lightest, matches the existing self-fetch pattern.
  - `skill` already reconciles via `loadSkills`/`useSkills`, so the ONLY missing input is `versions` → refetch closes both the header `vN` and the Versions LIVE badge. No migration, no realtime (DB correct per BUG-260706-01).

## EXEC-01 — reliable install
- Install seam: `tool_dispatcher.py:1642-1657` (the swallowed `except` at `:1653`); `libraries` arg `:1476`; code run `:1661-1666`; `exec_result` available `:1793`; exit-code derivation `:1798-1817`; post-hoc classify block `:1891-1900`; tool-result build `:1859-1908`.
- Sandbox session: `sandbox_service.py:25-85` (`get_or_create`, warm re-attach via `container_id`, D-077-05).
- Reuse: `_NO_MODULE_RE` (`:2654`), `ctx.dead_gap_tokens_in_run` guard pattern (`:1491`, `:1898`).
- **Fix shape:** §Delegated Unknown 1 (root + declared-install) + §Delegated Unknown 3 (auto-heal + honest result).

## Architecture Patterns

### Data flow (RENDER-02, the parallel-thread case D-07)
```
[Deep run streams] → onDelta APPENDS to message.content (:358 invariant)
        → live blob = narration + final answer  → StreamingNarration folds it (MessageItem:496)
[clean terminal: kind = done/reader_done]
   ├─ send-path onTerminal (:2004-2027)  ── getMessages → swap content by runId → un-folds LIVE   [EXISTS]
   └─ mount-path onTerminal (:1631-1648) ── (no content-reconcile)                 → needs D-07 EXTENSION
[runStatus flips completed] → MessageItem switches StreamingNarration → MarkdownRenderer (:510)
```

### Data flow (EXEC-01)
```
execute_code(code, libraries)
  ├─ declared libs → [FIX] python -m pip install <libs> (system interp, non-stream, exit-code checked, retry×1)
  ├─ python -u <file>  (system interpreter — MUST match install interpreter)
  ├─ exec_result (:1793): stderr may carry ModuleNotFoundError; streamed exit_code always 0 (:1798 compensator)
  └─ [FIX heal, bounded 1/module via ctx.healed_modules_in_run]
        detect No module named 'X' (_NO_MODULE_RE) → pip install X → re-run once
        └─ still failing / install failed → honest llm_content "Could not install X: <reason>"
```

### Anti-Patterns to Avoid
- **Overloading `dedupMessagesByRunId` for user rows (RENDER-01).** It is runId/assistant-oriented and runs on every bucket read; content-dedup for user temps belongs in the reconcile preserve-guard, not the read seam.
- **Weakening the 075.7 preserve-guard (RENDER-01/D-06).** Never make the guard "stop preserving temps"; only drop a temp when its persisted twin is already in the snapshot.
- **Keeping `session.install` for declared libs (EXEC-01).** It swallows failures AND targets the wrong interpreter. Install into the interpreter that runs the code.
- **Unbounded auto-heal (EXEC-01/D-03).** Always gate on `ctx.healed_modules_in_run` — 1 cycle per module, else honest result.
- **Any `provider ==` branch on the install/heal path (D-04/D-14).** The fix is provider-uniform below the adapter boundary.
- **A full `loadMessages` replace for RENDER-02.** Scope to `content` only (preserves tool_calls / suggestions / output-files / runStatus).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Module name from a traceback (EXEC-01) | A new regex | `_NO_MODULE_RE` (`tool_dispatcher.py:2654`) | Already exists + tested (`test_142_runtime_gap.py`) |
| Run-scoped "already tried" bound (EXEC-01) | A new global/dict | Sibling of `ctx.dead_gap_tokens_in_run` (`ToolContext`, guarded `is not None`) | Proven Deep-byte-identical guard pattern |
| Draft restore + per-thread banner (RENDER-03) | A new toast/error channel | `failedSendDrafts` + `reconcileErrors` + prefill seam (`StreamsProvider.tsx:2114`, `ChatArea.tsx:365`) | Already stashes draft + surfaces banner (D-11) |
| Versions refetch (RENDER-04) | A realtime subscription / migration | Mirror `refreshGate` (`SkillStudioPage.tsx:98`) | WR-05/refreshGate is the established reconcile-via-fetch pattern |
| Content-reconcile at terminal (RENDER-02) | A new fetch mechanism | The applied `getMessages → swap content by runId` (`:2004-2027`) | D-07 says extend the SAME block |

**Key insight:** every fix in this phase extends a pattern already present in the file. The novelty is confined to EXEC-01's install-interpreter correction, which is a source-level `llm_sandbox` fact, not a new abstraction.

## Common Pitfalls

### Pitfall 1: Re-running the code for auto-heal without re-draining the queue
**What goes wrong:** the first run's drain loop is single-use; a naive re-run of `_run_sync` without a fresh `asyncio.Queue` + drain deadlocks or drops output.
**How to avoid:** for the (rare) heal re-run, use a fresh queue/drain or a simpler blocking `session.execute_command("python -u <same code_file>")` (the file persists in the container). Keep the heal path minimal — it fires at most once per module.
**Warning signs:** heal re-run hangs; SSE code-card spins with no `code_execution_complete`.

### Pitfall 2: RENDER-02 content-swap keyed on the wrong runId (mount path)
**What goes wrong:** copying the send-path block verbatim uses `registeredRunId` (undefined on the mount/reconcile path) → the swap no-ops.
**How to avoid:** on the mount-path `onTerminal` (`:1571-1648`) key on `run.run_id`.
**Warning signs:** send-path un-folds live but a switched-back backgrounded run still needs a reload.

### Pitfall 3: RENDER-01 drop firing on the pre-stamp race (regresses 075.7)
**What goes wrong:** dropping the temp before the snapshot holds the persisted twin re-opens the blank-fresh-thread race.
**How to avoid:** the drop condition MUST require a persisted (non-temp) identical-content user row in `snapshot.messages` that is `>=` the temp's `created_at`. If absent, preserve (D-06).
**Warning signs:** fresh thread blanks on send; the 075.7 reconcile-race test fails.

### Pitfall 4: RENDER-03 clearing the draft before dispatch is confirmed
**What goes wrong:** `setValue("")` at `MessageInput.tsx:144` runs before `sendMessage` proves a dispatch; a dropped send loses the text with no feedback.
**How to avoid:** route non-dispatch through `failedSendDrafts` (D-11) so the prefill seam restores it, and/or gate the clear on confirmed dispatch.
**Warning signs:** message vanishes with no bubble/error on a fresh-thread immediate send.

### Pitfall 5: EXEC-01 installing into the venv again
**What goes wrong:** reaching for `session.install` (or venv pip) keeps the invisible-to-`python -u` mismatch.
**How to avoid:** install with `python -m pip install` (system interpreter), matching the code-run interpreter (Defect B).
**Warning signs:** pip reports success yet the code still `ModuleNotFound`s.

## Code Examples

### RENDER-02 D-07 — extend content-reconcile to the mount-path onTerminal
```ts
// Source: mirror of StreamsProvider.tsx:2004-2027 (send-path), inserted after :1648.
// Keyed on run.run_id (this path's runId), NOT registeredRunId.
if (kind === "done" || kind === "reader_done") {
  const rid = run.run_id
  getMessages(threadId)
    .then((persisted) => {
      const answer = persisted.find((m) => m.runId === rid && m.role === "assistant")
      if (!answer) return
      useStreamsStore.getState().actions.setMessagesForBucket(surfaceId, threadId, (prev) =>
        prev.map((m) =>
          m.runId === rid && m.role === "assistant" && m.content !== answer.content
            ? { ...m, content: answer.content }
            : m,
        ),
      )
    })
    .catch(() => {})
}
```

### EXEC-01 — same-interpreter declared install with reliable exit code (replaces :1652)
```python
# Source: derived from llm_sandbox 0.3.37 source facts (Defects A/B/C).
# Non-streaming execute_command => ConsoleOutput.exit_code is RELIABLE; python -m pip
# targets the SAME interpreter as `python -u` (system), unlike session.install (venv).
def _pip_install(session, libs: list[str]):
    joined = " ".join(shlex.quote(l) for l in libs)
    return session.execute_command(
        f"python -m pip install --disable-pip-version-check {joined}"
    )  # no on_stdout/on_stderr => non-stream => real exit_code + stderr

if libraries:
    await ctx.emit(ctx.redis, ctx.run_id, 'code_executing',
                   tool_index=ctx.tool_index,
                   elapsed_seconds=round(time_mod.time() - _setup_started, 1),
                   phase='installing_libraries')
    res = await run_in_threadpool(_pip_install, session, libraries)
    if getattr(res, "exit_code", 0):
        res = await run_in_threadpool(_pip_install, session, libraries)  # retry once (D-02.1)
    _declared_install_stderr = (getattr(res, "stderr", "") or "") if getattr(res, "exit_code", 0) else ""
    # persistent failure carried into the honest tool result below — NEVER swallowed (D-03)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `session.install(libraries=…)` (venv pip, swallows failures) | `python -m pip install` in the run interpreter, exit-code checked, retry×1, honest fallback | this phase | Declared libraries become reliable + honest |
| Prose-only "pip install and retry" in SYSTEM_PROMPT (`agent_loop.py`) | Deterministic backend auto-heal at the tool boundary (bounded 1/module) | this phase | Reliability no longer depends on each provider obeying the prompt (SEED-043 half-b) |
| Send-path-only content-reconcile (2026-07-07) | Reconcile on BOTH send and mount/nav terminals | this phase (D-07) | Backgrounded parallel-thread runs un-fold live |

**Deprecated/outdated:**
- The `Dockerfile.sandbox:27` "network is sealed" comment is inaccurate for egress (PyPI reachable — SEED-043 Finding 2). Not this phase's job to fix, but relevant: runtime pip install is viable.

## Runtime State Inventory

Not a rename/refactor/migration phase — no stored-data/OS-registered/secret rename surface. **None — verified: all five fixes are code-only reconcile/dispatch edits; no datastore key, OS registration, env var, or build artifact carries a renamed identifier.**

## Validation Architecture

> nyquist_validation is ENABLED (config.json). SC#10 4-axis is a mandatory acceptance axis (D-15).

### Test Framework
| Property | Value |
|----------|-------|
| Frontend framework | vitest ^4.1.0 (`frontend/package.json`) |
| Backend framework | pytest (`backend/pytest.ini`) |
| Frontend quick run | `cd frontend && npx vitest run src/__tests__/providers/ src/lib/__tests__/dedupMessages.test.ts` |
| Backend quick run | `cd backend && ./venv/Scripts/python -m pytest tests/unit/test_tool_dispatcher.py tests/unit/test_142_runtime_gap.py -x` |
| Full suites | `cd frontend && npx vitest run` · `cd backend && ./venv/Scripts/python -m pytest -q` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RENDER-01 | Optimistic user temp dropped once snapshot holds identical-content persisted row; temp preserved while twin absent (075.7 held) | unit (store) | `npx vitest run src/__tests__/providers/streamsProvider_075_7_reconcile_race.test.tsx` (+ new user-dedup case) | ✅ (extend) / ❌ new user-dedup case = Wave 0 |
| RENDER-02 | Clean terminal on BOTH send + mount paths swaps content to persisted answer by runId | unit (store) | `npx vitest run src/__tests__/providers/streamsProvider_bug_260707_03_final_answer_resolve.test.tsx` (+ mount-path case) | ✅ (extend for mount path) |
| RENDER-03 | Silent-drop path stashes `failedSendDrafts`; prefill restores text + banner shows | unit (component) | `npx vitest run src/components/chat/__tests__/ChatAreaBanner.test.tsx src/components/chat/__tests__/MessageInputDrafts.test.tsx` (+ non-dispatch case) | ✅ (extend) |
| RENDER-04 | `refreshVersions` after approve re-derives liveVersionNumber → header vN + VersionsTab badge update | unit (page/tab) | `npx vitest run src/pages/SkillStudioPage.test.tsx src/components/skills/studio/VersionsTab.test.tsx` (+ approve-refetch case) | ✅ (extend) |
| EXEC-01 | Declared install uses `python -m pip`, exit-code checked, retry×1; ModuleNotFound → install X + re-run once (bounded); honest result on persistent failure | unit (dispatcher) | `./venv/Scripts/python -m pytest tests/unit/test_tool_dispatcher.py tests/unit/test_142_runtime_gap.py -x` (+ heal + honest-result cases) | ✅ (extend) |

### Sampling Rate
- **Per task commit:** the requirement's quick command above.
- **Per wave merge:** full frontend `npx vitest run` + backend `pytest -q`.
- **Phase gate:** full suites green + the differential (git-stash old-vs-new = zero net-new failures, D-14) before `/gsd:verify-work`.

### SC#10 4-axis (live UAT, authored under VALIDATION.md — D-15, NOT PLAN tasks)
| Axis | Concrete scenario (from bug-DB evidence) |
|------|------------------------------------------|
| Cross-provider | OpenAI + Anthropic + Google + one of DeepSeek/Moonshot/GLM — each: single send renders ONE user bubble (RENDER-01), final answer un-folds live (RENDER-02) |
| Multi-tool | ≥1 row exercising `execute_code` with a declared library that must install (EXEC-01 declared) + an undeclared-import case (EXEC-01 auto-heal), e.g. DeepSeek/fpdf2 warm-session (thread `5a86a9fd`) |
| Parallel-thread | Thread A streaming while Thread B sends; switch back to A after terminal → answer un-folds with NO reload (RENDER-02 mount-path D-07) + no dup bubble (RENDER-01) |
| Long-message | ≥50 prior msgs OR ≥5KB prompt, per provider — send lands or fails honestly (RENDER-03) |
| (RENDER-04 anchor) | Approve a description proposal in the Skill Studio Triggering tab → header `vN` + Versions LIVE badge update with no reload (BUG-260706-01) |

### Wave 0 Gaps
- [ ] New user-side content-dedup case in `streamsProvider_075_7_reconcile_race.test.tsx` — covers RENDER-01 (drop-when-twin-present AND preserve-when-twin-absent).
- [ ] Mount-path content-reconcile case in `streamsProvider_bug_260707_03_final_answer_resolve.test.tsx` — covers RENDER-02 D-07.
- [ ] Non-dispatch → `failedSendDrafts` case (extend `ChatAreaBanner`/`MessageInputDrafts` tests) — covers RENDER-03 honesty guarantee.
- [ ] Approve→refetch case in `SkillStudioPage.test.tsx` / `VersionsTab.test.tsx` — covers RENDER-04.
- [ ] EXEC-01 dispatcher cases in `test_tool_dispatcher.py`: (a) declared install failure surfaces honest result (not swallowed); (b) ModuleNotFound → install + re-run once; (c) 1-per-module bound (second same-module miss goes straight to honest result). Mock `session.execute_command` to assert `python -m pip install` is used and exit codes are checked.

## Security Domain

> Roadmap declares NO threat model this milestone (cleanup over already-secured surfaces). `security_enforcement` is not set in config; the phase is UI/bug-fix with no new authz. One boundary is worth an explicit note.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes (mild) | EXEC-01 auto-heal installs a **model-named** package from PyPI. Bound to 1/module; module name is extracted from a controlled traceback via `_NO_MODULE_RE`. |
| V6 Cryptography | no | — |
| V2/V3/V4 (authn/session/access) | no | Render-layer + below-provider-boundary changes; no new endpoint, no authz change. |

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Model names a slopsquat/typo package for auto-heal install | Tampering / supply-chain | **Not a new trust boundary** — the model can already `pip install` in its own sandbox code today, and declared `libraries` already install model-named packages; the sandbox is a disposable per-thread Docker container with no host access. Bound 1-per-module caps churn. If tightening is ever wanted, restrict auto-heal to a curated allowlist (deferred — SEED-043 half-b). |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The 6607 ms success ([23], BUG-260708-02) came from a system-pip path (model in-code or differently-structured retry), given the verified venv/system mismatch | Delegated Unknown 1 Defect B | Low — the fix (install into the run interpreter) makes the specific 68ms/6607ms path moot regardless; a live probe during UAT confirms |
| A2 | `deriveLiveVersion` falls back to MAX `version_number` when content doesn't match the stale list (→ shows v7 pre-refetch) | RENDER-04 | Low — corroborated by `SkillStudioPage.test.tsx:152`; if it instead reads `skill.live_version`, the `loadSkills` reconcile might already fix the header and only the Versions table needs refetch |
| A3 | The heal re-run can reuse the container-resident `code_file` for a lightweight second exec | Delegated Unknown 3 / Pitfall 1 | Low — the file is written to the container before the first run; planner verifies during implementation |

**These are the only `[ASSUMED]` items.** Everything else is `[VERIFIED: …source]` or `[CITED]`.

## Open Questions

1. **RENDER-03 honesty route (i vs ii)** — populate `failedSendDrafts` on non-dispatch (reuses D-11 seam) vs. await-dispatch-then-clear (needs `sendMessage` to signal drops).
   - What we know: route (i) is smaller and D-11-aligned; the prefill+banner seam already restores text.
   - Recommendation: route (i); add the await-signal only if UAT still shows a lost draft.
2. **RENDER-04 VersionsTab refetch mechanism** — nonce-prop bump vs. lift-versions-to-shell.
   - Recommendation: nonce-prop (matches the existing self-fetch pattern; smallest diff).
3. **EXEC-01 declared install: `python -m pip` vs `sys.executable -m pip`** — the code run is a literal `python -u`, so `python -m pip` matches. Confirm `python` on PATH in the custom image resolves to the same interpreter as `python -u` (it does in `python:3.11-slim`; verify once live).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker + `agentic-rag-sandbox:101.1` image | EXEC-01 live UAT | ✓ (per CLAUDE.md sandbox setup) | 101.1 | — |
| PyPI egress from sandbox | EXEC-01 install + auto-heal | ✓ (SEED-043 Finding 2 — fpdf2 fetched in 6.6s) | — | Honest "could not install" message already the fallback |
| `llm_sandbox` | sandbox session | ✓ | 0.3.37 | — |
| Local dev app + backend (uvicorn) | live UAT | ✓ (operator-started) | — | — |

**Missing dependencies with no fallback:** none.

## Sources

### Primary (HIGH confidence)
- `llm_sandbox` 0.3.37 installed source (`backend/venv/Lib/site-packages/llm_sandbox/`): `core/session_base.py:240-437` (install/execute_commands/environment_setup), `core/mixins.py:277-333` (execute_command streaming), `docker.py:43-60,354-393` (DockerContainerAPI + open), `language_handlers/python_handler.py:52-69` (pip command), `interactive.py:117-348` (InteractiveSandboxSession, runner uses venv python).
- Current codebase (re-scouted 2026-07-22): `backend/app/services/tool_dispatcher.py` (`:1461-1914`, `:2573-2843`, `:3117-3136`), `backend/app/services/sandbox_service.py` (`:25-198`), `frontend/src/providers/StreamsProvider.tsx` (`:1415-1520`, `:1560-1648`, `:1745-2197`), `frontend/src/components/chat/{MessageItem,MessageInput,ChatArea}.tsx`, `frontend/src/lib/{api.ts,dedupMessages.ts}`, `frontend/src/pages/{SkillTunerPage,SkillStudioPage}.tsx`, `frontend/src/components/skills/studio/{VersionsTab,TriggeringTab}.tsx`.
- CONTEXT.md (D-01..D-16), REQUIREMENTS.md (RENDER-01..04, EXEC-01), the 5 folded bug reports, SEED-043.

### Secondary (MEDIUM confidence)
- SEED-043 2026-07-08 assessment (Findings 2 & 3 — PyPI egress + `libraries` unreliability), consistent with the source-level root cause.

### Tertiary (LOW confidence)
- None relied upon.

## Metadata

**Confidence breakdown:**
- EXEC-01 root cause: HIGH — read from actual `llm_sandbox` 0.3.37 source (three verified defects); intermittency's exact per-call timing is A1 (fix makes it moot).
- RENDER-01/02/03/04 seams: HIGH — every cited line re-scouted against current code post-174/175.
- Fix shapes: HIGH — each extends an existing in-file pattern; no new abstraction.

**Research date:** 2026-07-22
**Valid until:** ~2026-08-21 (stable surfaces; re-scout line numbers if another phase touches these files first)

## RESEARCH COMPLETE

**Phase:** 176 - Chat Render Correctness + Exec Reliability
**Confidence:** HIGH

### Key Findings
- **EXEC-01 root cause is three compounding VERIFIED defects** (read from `llm_sandbox` 0.3.37 source): `session.install` never raises on pip failure (swallow is inside the library, our `except` is dead); install targets the **venv** while the code runs on the **system** interpreter (`python -u`) so declared libs are invisible; streamed exit code is always 0 and the error scan reads stdout only while `ModuleNotFoundError` goes to stderr. Fix: install with `python -m pip` in the run interpreter, exit-code checked + retry once, then a bounded (1/module) ModuleNotFound auto-heal + honest tool result at `tool_dispatcher.py:1793`.
- **RENDER-01 → D-05 option (b)**: the WR-04 id re-key already exists (`:1858`); the dup is born in the reconcile merge, so add a content-supersede drop in the untyped-temp preserve branch (`:1466`) — honors D-06.
- **RENDER-02 → D-07**: extend the applied send-path content-reconcile (`:2004-2027`) to the mount-path `onTerminal` (`:1631-1648`), keyed on `run.run_id`.
- **RENDER-03**: root is the synchronous clear at `MessageInput.tsx:144`; route non-dispatch through the existing `failedSendDrafts`/`reconcileErrors` prefill+banner seam; pre-mark the thread as sending before `setViewingThread` to tighten the fresh-thread race.
- **RENDER-04**: header `vN` + Versions badge both derive from `deriveLiveVersion(skill, versions)` on the shell; `loadSkills` reconciles `skill` but not the shell `versions` — add a `refreshVersions` (mirror `refreshGate`) threaded through TriggeringTab→SkillTunerPage, plus a nonce to re-run VersionsTab's fetch.

### File Created
`.planning/phases/176-chat-render-correctness-exec-reliability/176-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | No new packages; versions verified in venv |
| Architecture / seams | HIGH | Every cited line re-scouted against current code post-174/175 |
| EXEC-01 root cause | HIGH | Read from actual llm_sandbox 0.3.37 source, not theorized |
| Pitfalls | HIGH | Derived directly from the verified mechanisms |

### Open Questions
- RENDER-03 honesty route (populate failedSendDrafts vs await-and-signal) — recommend the former.
- RENDER-04 VersionsTab refetch (nonce-prop vs lift-to-shell) — recommend nonce-prop.
- Confirm `python`/`python -u` PATH resolves to one interpreter in the custom image (expected in python:3.11-slim).

### Ready for Planning
Research complete. No migration, no new package, no shared-path fork. Planner can create PLAN.md files against the resolved mechanisms and the Validation Architecture / SC#10 axes above.

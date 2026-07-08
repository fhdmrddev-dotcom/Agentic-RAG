---
phase: 142-non-python-skill-script-honesty-stretch
reviewed: 2026-07-08T01:34:33Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - backend/app/services/tool_dispatcher.py
  - backend/app/services/openai_service.py
  - backend/app/services/agent_loop.py
  - backend/app/services/task_service.py
  - backend/app/api/skills.py
  - frontend/src/lib/api.ts
  - frontend/src/pages/SkillsPage.tsx
findings:
  critical: 2
  warning: 2
  info: 2
  total: 6
status: issues_found
---

# Phase 142: Code Review Report

**Reviewed:** 2026-07-08T01:34:33Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Phase 142 adds a runtime-gap classifier (`_classify_runtime_gap`), a run-scoped
repeat-guard (`dead_gap_tokens_in_run`), a proactive `execute_code`
tool-description block, an honest `read_skill_file` decode branch, and a
non-blocking import note. The phase brief correctly identifies **T-142-01 (the
classifier must never suppress a genuine error) as the single most important
property** — and that is exactly where the implementation fails.

Two of the four things the brief asked me to verify hold up cleanly:

- **T-142-05 by-reference threading is correct.** `_dead_gap_tokens_in_run` is
  initialized once per `run_agent_loop` (outside the iteration loop), threaded
  by reference into both `ToolContext` builds (`agent_loop.py:1645`, `:2429`),
  given a **fresh `set()`** for sub-agents (`task_service.py`), and defaults to
  `None` (not a mutable default) for every unwired caller. No cross-run or
  cross-sub-agent bleed.
- **The static ZIP scan is robust** (`skills.py:323-340`) — guarded against
  non-prefix entries, directory entries, and empty basenames; `os.path.splitext`
  is total so malformed entries cannot raise.
- **`_decode_skill_file_bytes` byte-symmetry is preserved** — the new
  `SCRIPT_EXTS` branch lives in the shared decoder, so both the live read
  (`tool_dispatcher.py:953`) and the 099 snapshot read (`:918`) inherit the
  identical string.

However, the classifier itself (**CR-01**) uses bare substring matching plus an
over-generic `"not found"` phrase and runs on *successful* executions, so it
reshapes and **hides genuine Python errors** — the precise T-142-01 failure. That
defect is then **amplified by the repeat-guard (CR-02)**: any token it records
(including a real hit) is matched as a bare substring against *all* subsequent
code, so a generic token like `"node"` or the JS token `"let "` silently blocks
unrelated legitimate `execute_code` calls for the rest of the run. These two
must be fixed before this ships. Everything else is secondary.

## Critical Issues

### CR-01: `_classify_runtime_gap` suppresses genuine errors (T-142-01 violation)

**File:** `backend/app/services/tool_dispatcher.py:2122-2180` (invoked unconditionally at `:1366`)
**Outcome:** fixed (commit `330453f3`) — POST-HOC classifier now gated on `actual_exit_code != 0` (1a); G-C binary detection uses precise per-token boundary-anchored regexes that require the shell to NAME the token as missing, not bare co-occurrence (1b); `"let "` dropped from JS_TOKENS and Python line-comments stripped before the G-B scan (1c). Adversarial regression tests added.
**Issue:** The classifier is documented as "NEVER reshape ... a genuine error,"
but three independent, reachable paths do exactly that:

1. **Generic token substring + bare `"not found"` (branch a, `:2146-2148`).**
   `NOT_FOUND_PHRASES` (`:2061-2064`) includes the bare phrase `"not found"`, and
   the token test is a bare `tok in out_l`. The token `"node"` matches inside
   `"nodes"`, `"node_modules"`, `"inode"`, etc. A completely ordinary Python
   failure such as `raise ValueError("config node 'db' not found")` — common in
   graph/tree/XML/config code — puts both `"node"` and `"not found"` in the
   output and is reshaped into *"This sandbox runs Python only … Do NOT retry as
   JavaScript. Re-implement the step in Python."* The real `ValueError` never
   reaches the model.

2. **Runs on successful executions.** `_classify_runtime_gap` is called at
   `:1366` **unconditionally** — there is no `if exec_status == "error"` /
   non-zero-exit gate. A run that exits 0 but merely *prints* a string like
   `"node 3 not found in graph"` is reshaped as a permanent gap and its token is
   recorded in the repeat-guard (feeding CR-02).

3. **Incidental JS token + real `SyntaxError` (branch c, `:2161-2164`).**
   `JS_TOKENS` contains `"let "`, `"=>"`, and `"const "`. A genuine, *fixable*
   Python `SyntaxError` whose source happens to contain a comment like
   `# let me handle this` (`"let "` is a substring) or a string containing `=>`
   is reshaped into "this is JavaScript, re-implement in Python" — hiding the
   typo the model should have fixed.

**Fix:** Gate on failure, drop the bare phrase, and require the token adjacent to
a not-found marker (or a word boundary), not a bare substring:

```python
# 1. only classify actual failures
if actual_exit_code == 0 and "traceback" not in (exec_result.stderr or "").lower():
    _gap = None
else:
    _gap = _classify_runtime_gap(...)

# 2. remove the catch-all "not found"; keep specific phrases only
NOT_FOUND_PHRASES = ("no such file or directory", "filenotfounderror",
                     "command not found")

# 3. require the binary token to be named by the shell, at a boundary
import re
def _binary_named(tok: str, out_l: str) -> bool:
    return re.search(rf"(?<![\w/-]){re.escape(tok)}(?![\w-])"
                     rf".{{0,40}}(command not found|: not found|no such file)",
                     out_l) is not None
```

Also tighten branch (c): only treat it as G-B when the offending
`SyntaxError` line itself contains the JS token, or when *multiple* JS-exclusive
tokens co-occur — not a single `"let "` anywhere in the buffer.

---

### CR-02: Run-scoped repeat-guard poisons the whole run via bare substring match

**File:** `backend/app/services/tool_dispatcher.py:987-995` (pre-flight), `:1371-1372` (record)
**Outcome:** fixed (commit `6904701c`) — new `_code_references_dead_token` matches binary/module identifiers at word boundaries (`\bnode\b`, escaped, case-insensitive) and keeps containment only for distinctive JS markers / G-A path tokens, so a substring inside a larger word (`annotate`, `node_list`) never re-blocks. Residual accepted edge documented. Adversarial tests added.
**Issue:** On any classifier hit, `ctx.dead_gap_tokens_in_run.add(_gap["token"])`
records the token (`:1372`). The pre-flight (`:987-995`) then blocks *any*
subsequent `execute_code` whose code contains that token as a **bare
lowercase substring** (`t.lower() in _code_lower`). The recorded tokens are not
all safe to match this way:

- For **G-C**, the token is a binary name like `"node"` → after one hit, every
  later cell that uses the word `node` (networkx `for node in G.nodes()`, a
  variable named `node`, a DOM/tree walk) is short-circuited with a fake
  "permanent runtime gap" error for the rest of the run.
- For **G-B**, the token is a JS marker like `"let "`, `"=>"`, or `"const "`
  (`:2164`). A *single* G-B hit means every later cell containing the substring
  `"let "` (e.g. a comment `# let us compute`) is blocked. This is
  catastrophic — it disables large classes of ordinary Python for the run.

This is worse than CR-01 because it fires even on a **legitimate** hit: a real
Node.js gap correctly records `"node"`, then a genuinely-different later cell
that merely mentions `node` is blocked. Combined with CR-01's false positives,
one misclassification permanently poisons the run.

**Fix:** Never store or match generic/JS tokens as bare substrings. Record only
precise, unambiguous identifiers and match them at word/command boundaries:

```python
# record: for G-B, store a class marker, not the raw JS substring
if _gap["class"] == "G-B":
    ctx.dead_gap_tokens_in_run.add("__js__")   # never substring-matched
else:
    ctx.dead_gap_tokens_in_run.add(_gap["token"])

# pre-flight: boundary match for binaries, exact-segment match for G-A paths;
# a "__js__" marker only re-blocks when the NEW code is itself JS-shaped.
import re
def _code_hits_dead_token(code: str, tok: str) -> bool:
    if tok == "__js__":
        return sum(j in code for j in JS_TOKENS) >= 2
    if "/" in tok:                      # G-A path
        return tok in code
    return re.search(rf"(?<![\w-]){re.escape(tok)}(?![\w-])", code) is not None
```

Secondary: the dataclass comment claims the set is "Bounded by the fixed
allowlist => no key growth (T-142-04)," but G-A stores an arbitrary
model-supplied path (`:2176`), so the claim is false — the set grows one entry
per distinct missing relative path (bounded only by call count, not the
allowlist). See WR-01.

## Warnings

### WR-01: G-A branch misclassifies genuine missing relative paths as permanent

**File:** `backend/app/services/tool_dispatcher.py:2170-2178`
**Outcome:** fixed (commit `017e7000`) — G-A now fires only when the missing relative path is prefixed by a known skill-bundle subdir (`scripts/`|`assets/`|`resources/`); any other relative miss (`data/input.json`) passes through as None. Dataclass T-142-04 comment reconciled to reflect that G-A records only these narrowed paths. Tests added.
**Issue:** Branch (d) treats *any* not-found path that contains `/` and is not
absolute as a lost, flattened skill-tree path and tells the model *"Do NOT retry
the same path."* But a model reading its own relative input — `open("data/input.json")`,
`open("config/settings.yaml")` — that is genuinely missing produces exactly that
signature (`No such file or directory: 'data/input.json'`, relative, has `/`).
This is a **recoverable** error (create the dir / fix the path); instructing "do
NOT retry" and recording the path in the repeat-guard suppresses it and blocks
the corrected retry. The design law explicitly requires "a genuine missing
`/sandbox/output/*.csv` passes through," but only *absolute* paths are exempted —
genuine *relative* misses are swallowed.
**Fix:** Restrict G-A to paths that actually look like a bundled-skill helper —
e.g. require a known skill-tree prefix segment (`scripts/`, `assets/`,
`resources/`) or that the referenced basename matches a file the loaded skill
bundles — rather than "any relative path with a slash." When in doubt, return
`None` (pass through) per the safe-default posture.

### WR-02: Pre-flight short-circuit skips SSE lifecycle events and execution logging

**File:** `backend/app/services/tool_dispatcher.py:993-995`
**Outcome:** fixed (commit `8ba38181`) — the short-circuit now emits a matched `code_execution_start` + `code_execution_complete` pair before returning (mirroring the normal path), so the UI code-card resolves instead of spinning forever. Still a no-op for unwired callers and touches no sandbox. Test added.
**Issue:** The repeat-guard short-circuit returns before the handler emits
`code_execution_start` / `code_execution_complete` (`:998`, `:1335`), before the
`code_executions` DB insert (`:1301`), and before the audit entry (`:1374`).
Every other exit path from `_handle_execute_code` — including the timeout abort
(`:1206`) and the exception path (`:1385`) — emits a `code_execution_complete`.
A blocked call therefore produces a tool result with **no matching UI execution
events**, so the frontend code panel for that call can render as
never-completing, and the blocked execution leaves no `code_executions` row.
**Fix:** Before returning the short-circuit, emit a minimal start/complete pair
so the UI closes the card, e.g.:

```python
if _dead_token is not None:
    await ctx.emit(ctx.redis, ctx.run_id, 'code_execution_start', code_preview=code[:200])
    await ctx.emit(ctx.redis, ctx.run_id, 'code_execution_complete',
                   exit_code=1, duration_ms=0, output_files=[])
    _short_circuit = _repeat_blocked_result(_dead_token)
    return ToolResult(result=_short_circuit, llm_content=_short_circuit)
```

## Info

### IN-01: Extension extraction is inconsistent across the three new sites

**File:** `backend/app/services/tool_dispatcher.py:857` vs `:696`(`_skill_runtime_note`) and `backend/app/api/skills.py:338`
**Issue:** `_decode_skill_file_bytes` derives the extension with
`filename.rsplit(".", 1)[-1]`, while `_skill_runtime_note` and the import scan use
`os.path.splitext(...)[1].lstrip(".")`. For dotfiles these disagree: `".bashrc"`
→ `"bashrc"` under `rsplit` but `""` under `splitext`. It does not affect any
current `SCRIPT_EXTS` member, but the divergent logic is a latent
inconsistency.
**Fix:** Use `os.path.splitext` in all three sites for one ext-extraction rule.

### IN-02: Stale docstring and redundant phrase entry

**File:** `backend/app/services/tool_dispatcher.py:855` and `:2061-2064`
**Issue:** (a) `_decode_skill_file_bytes`'s docstring still asserts "Behavior here
MUST stay identical to the pre-099 inline block," which Phase 142 intentionally
broke by adding the `SCRIPT_EXTS` branch — the contract comment now contradicts
the code. (b) `NOT_FOUND_PHRASES` lists both `"command not found"` and the bare
`"not found"`; the former is fully subsumed by the latter (dead once the bare
phrase is removed per CR-01).
**Fix:** Update the docstring to note the 142 script-ext addition; drop
`"command not found"` if the bare phrase stays, or drop the bare phrase per
CR-01.

---

_Reviewed: 2026-07-08T01:34:33Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
